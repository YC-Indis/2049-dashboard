import json
import logging
import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import SessionLocal, get_session
from ..errors import DojoError, RecordNotFound
from ..models import AgentMessage, AgentSession, ToolCallAudit
from ..services.agent import orchestrator
from ..services.agent.executor import run_write

log = logging.getLogger("dojo.agent.api")

router = APIRouter(prefix="/agent", tags=["agent"])

DEFAULT_SESSION = "default"


class ChatBody(BaseModel):
    message: str
    # 前端传的页面状态，只取 page / route / selectedProject
    context: dict = Field(default_factory=dict)
    history: list[dict] = Field(default_factory=list)
    sessionId: str = DEFAULT_SESSION


class ConfirmBody(BaseModel):
    tool: str
    arguments: dict = Field(default_factory=dict)
    sessionId: str = DEFAULT_SESSION
    # 用户点了取消也要发过来，审计里要留下「提过但被否了」
    confirmed: bool = True


class PanelBody(BaseModel):
    panel: dict | None = None
    pending: dict | None = None


def _ensure_session(db: Session, session_id: str) -> AgentSession:
    row = db.get(AgentSession, session_id)
    if row is None:
        row = AgentSession(id=session_id, panel={}, pending=None)
        db.add(row)
        db.flush()
    return row


def _append(db: Session, session_id: str, role: str, content: str, **extra) -> AgentMessage:
    _ensure_session(db, session_id)
    next_seq = (
        db.scalar(
            select(func.coalesce(func.max(AgentMessage.seq), 0)).where(
                AgentMessage.session_id == session_id
            )
        )
        or 0
    ) + 1
    row = AgentMessage(
        session_id=session_id,
        seq=next_seq,
        role=role,
        content=content,
        sources=extra.get("sources"),
        memory_hint=extra.get("memory_hint"),
    )
    db.add(row)
    db.flush()
    return row


@router.post("/chat")
async def chat(body: ChatBody, db: Session = Depends(get_session)) -> dict:
    """前端 src/api/llm.ts 已经在调这个路径，返回体保持 content/sources/memory_hint。

    pending 和 usedTools 是新增字段，老前端会忽略，不影响。
    """
    _append(db, body.sessionId, "user", body.message)
    turn = await orchestrator.run_turn(
        db, body.message, history=body.history, frontend=body.context
    )

    session = _ensure_session(db, body.sessionId)
    session.pending = turn.pending.as_dict() if turn.pending else None
    if turn.pending is not None:
        db.add(
            ToolCallAudit(
                session_id=body.sessionId,
                tool=turn.pending.tool,
                arguments=turn.pending.arguments,
            )
        )

    if turn.content:
        _append(db, body.sessionId, "assistant", turn.content, memory_hint=turn.memory_hint)

    return turn.as_dict()


@router.post("/stream")
async def stream(body: ChatBody) -> StreamingResponse:
    """SSE。事件名：tool / delta / pending / done。

    这里不能用 Depends(get_session)：响应返回时依赖就会把 session 关掉，而生成器
    还要继续跑。所以自己开一个，在生成器结束时关。
    """

    async def emit():
        db = SessionLocal()
        collected: list[str] = []
        pending_payload: dict | None = None
        try:
            _append(db, body.sessionId, "user", body.message)
            db.commit()

            async for event, payload in orchestrator.run_turn_stream(
                db, body.message, history=body.history, frontend=body.context
            ):
                if event == "delta" and payload:
                    collected.append(payload)
                if event == "pending":
                    pending_payload = payload
                yield f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"

            text = "".join(collected).strip()
            if text:
                _append(db, body.sessionId, "assistant", text)
            session = _ensure_session(db, body.sessionId)
            session.pending = pending_payload
            if pending_payload:
                db.add(
                    ToolCallAudit(
                        session_id=body.sessionId,
                        tool=pending_payload["tool"],
                        arguments=pending_payload["arguments"],
                    )
                )
            db.commit()
        except Exception as exc:
            log.exception("SSE 生成过程中断")
            db.rollback()
            yield f"event: error\ndata: {json.dumps({'message': str(exc)}, ensure_ascii=False)}\n\n"
        finally:
            db.close()

    return StreamingResponse(
        emit(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            # nginx 默认会缓冲整个响应，不关掉的话流式就退化成一次性返回
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/confirm")
async def confirm(body: ConfirmBody, db: Session = Depends(get_session)) -> dict:
    """执行（或否决）一个待确认的写操作。

    这是全系统唯一会真正改数据的 Agent 入口。
    """
    audit = ToolCallAudit(
        session_id=body.sessionId,
        tool=body.tool,
        arguments=body.arguments,
        confirmed=body.confirmed,
    )
    db.add(audit)

    session = _ensure_session(db, body.sessionId)
    session.pending = None

    if not body.confirmed:
        db.flush()
        return {"ok": True, "executed": False, "message": "已取消，没有改动任何数据"}

    try:
        result = await run_write(db, body.tool, body.arguments)
    except DojoError as exc:
        audit.executed = False
        audit.ok = False
        audit.error = exc.message
        db.flush()
        # 参数不全、项目歧义这类要原样抛回去，前端据此继续追问
        raise

    audit.executed = True
    audit.ok = True
    audit.result = result if isinstance(result, dict) else {"value": str(result)}
    db.flush()
    return {"ok": True, "executed": True, "result": result}


@router.get("/session/{session_id}")
def read_session(session_id: str, db: Session = Depends(get_session)) -> dict:
    row = _ensure_session(db, session_id)
    return {
        "id": row.id,
        "panel": row.panel or {},
        "pending": row.pending,
        "messages": [
            {
                "role": m.role,
                "content": m.content,
                "sources": m.sources or [],
                "memoryHint": m.memory_hint,
                "createdAt": m.created_at.isoformat(),
            }
            for m in row.messages
        ],
    }


@router.put("/session/{session_id}")
def update_session(
    session_id: str, body: PanelBody, db: Session = Depends(get_session)
) -> dict:
    row = _ensure_session(db, session_id)
    if body.panel is not None:
        row.panel = body.panel
    if body.pending is not None or body.pending is None:
        row.pending = body.pending
    db.flush()
    return {"ok": True}


@router.delete("/session/{session_id}/messages")
def clear_messages(session_id: str, db: Session = Depends(get_session)) -> dict:
    row = db.get(AgentSession, session_id)
    if row is None:
        raise RecordNotFound(f"会话不存在：{session_id}")
    for message in list(row.messages):
        db.delete(message)
    row.pending = None
    return {"ok": True}


@router.get("/audits")
def list_audits(
    session_id: str = DEFAULT_SESSION, limit: int = 50, db: Session = Depends(get_session)
) -> list[dict]:
    """谁在什么时候通过对话改了什么。排查和留痕都靠它。"""
    rows = db.scalars(
        select(ToolCallAudit)
        .where(ToolCallAudit.session_id == session_id)
        .order_by(ToolCallAudit.id.desc())
        .limit(limit)
    ).all()
    return [
        {
            "id": r.id,
            "tool": r.tool,
            "arguments": r.arguments,
            "confirmed": r.confirmed,
            "executed": r.executed,
            "ok": r.ok,
            "error": r.error,
            "createdAt": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.post("/session")
def create_session(db: Session = Depends(get_session)) -> dict:
    session_id = f"s-{uuid.uuid4().hex[:12]}"
    _ensure_session(db, session_id)
    return {"id": session_id}
