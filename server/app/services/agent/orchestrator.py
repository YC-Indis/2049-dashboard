"""一轮对话的编排。

循环形状：
    组装消息 -> 问模型 -> 拿到读工具就执行并回灌 -> 再问 -> 直到给出文本或提出写操作

写操作永远不在这个循环里执行。模型提出来之后立刻中断，转成待确认动作交给前端，
用户点了确认才走 confirm 分支。这条不能松：一个「帮我把这个项目删了」如果被
模型理解偏了还自动执行，就没有补救余地。
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.orm import Session

from ...errors import CredentialMissing, DojoError, UpstreamUnavailable
from .. import llm
from . import context as ctx
from . import tools as toolbox
from .executor import run_read

log = logging.getLogger("dojo.agent")

# 读工具往返几轮之后还不收敛，多半是模型在打转
MAX_ROUNDS = 4

SYSTEM_PROMPT = """你是 2049 工作台里的 SixNine49，负责陪运营把事推下去。

你能看到执行（项目/排期/日历）、内容（采集线索/灵感库/脚本/对标库）和运营
（账号矩阵/视频数据）的真实快照，也能通过工具去查更细的数据。

怎么说话：
先给结论，再用上下文里的真实数字支撑。引用项目名、账号名、榜单名时要用快照里
实际存在的，没有的数据就说没有，不要编。少说套话。

关于查询：
需要具体数据时直接调查询工具，不要凭快照里的概要硬答。快照是概览，工具才是细节。

关于写操作：
新建、修改、删除、同步这些会改数据的事，你只负责提出，不负责执行。提出之后系统
会让用户确认，用户点了才会真的改。所以不要说「已经帮你建好了」，要说「确认后
我就建」。

参数不全就问，别猜。缺哪几项说哪几项，同时把已经记下的复述一遍，让用户知道
不用重说。

关于项目：
中台同时对接很多项目，界面上选中哪个只是当前焦点，不代表用户要改那个。项目级
的写操作必须由用户点名是哪个项目。没点名就把项目参数留空，系统会列候选让用户
选。不要自作主张填一个。

关于采集：
检索词只用用户明确给出的那个词。不要把项目名、品牌名、竞品名拼进去——用自己
的品牌名去搜，搜到的全是自己发过的东西，这条线索就废了。

今天是 {today}。
当前工作区快照：
{snapshot}"""


@dataclass
class PendingAction:
    """等用户确认的写操作。"""

    tool: str
    arguments: dict[str, Any]
    summary: str

    def as_dict(self) -> dict:
        return {"tool": self.tool, "arguments": self.arguments, "summary": self.summary}


@dataclass
class AgentTurn:
    content: str = ""
    pending: PendingAction | None = None
    # 这一轮实际查了哪些数据，前端可以折叠展示，也是排查时的线索
    used_tools: list[str] = field(default_factory=list)
    memory_hint: str | None = None
    degraded: bool = False

    def as_dict(self) -> dict:
        return {
            "content": self.content,
            "pending": self.pending.as_dict() if self.pending else None,
            "usedTools": self.used_tools,
            "memory_hint": self.memory_hint,
            "degraded": self.degraded,
            "sources": [],
        }


def _build_messages(db: Session, message: str, history: list[dict], frontend: dict) -> list[dict]:
    snapshot = ctx.build_snapshot(db, frontend)
    system = SYSTEM_PROMPT.format(today=snapshot["today"], snapshot=ctx.render(snapshot))

    messages: list[dict] = [{"role": "system", "content": system}]
    # 只带最近几轮。带太多既费 token，也容易让模型翻出早就作废的意图
    for turn in history[-8:]:
        role = turn.get("role")
        if role in ("user", "assistant") and turn.get("content"):
            messages.append({"role": role, "content": turn["content"]})
    messages.append({"role": "user", "content": message})
    return messages


async def run_turn(
    db: Session,
    message: str,
    *,
    history: list[dict] | None = None,
    frontend: dict | None = None,
) -> AgentTurn:
    messages = _build_messages(db, message, history or [], frontend or {})
    schema = toolbox.openai_schema()
    used: list[str] = []

    try:
        for _ in range(MAX_ROUNDS):
            result = await llm.chat(messages, schema)

            if not result.wants_tools:
                return AgentTurn(content=result.content.strip(), used_tools=used)

            # 同一轮里模型可能既想查数据又想改数据。先看有没有写操作，
            # 有就立刻停下来问用户，查询留到确认之后再说。
            write_call = next(
                (c for c in result.tool_calls if _mode_of(c.name) == "write"), None
            )
            if write_call is not None:
                return AgentTurn(
                    content=result.content.strip(),
                    pending=PendingAction(
                        tool=write_call.name,
                        arguments=write_call.arguments,
                        summary=toolbox.confirm_text(write_call.name, write_call.arguments),
                    ),
                    used_tools=used,
                )

            messages.append(
                {
                    "role": "assistant",
                    "content": result.content,
                    "tool_calls": [
                        {
                            "id": call.id,
                            "type": "function",
                            "function": {"name": call.name, "arguments": _dump(call.arguments)},
                        }
                        for call in result.tool_calls
                    ],
                }
            )

            for call in result.tool_calls:
                used.append(call.name)
                payload = _safe_read(db, call.name, call.arguments)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call.id,
                        "name": call.name,
                        "content": _dump(payload),
                    }
                )

        # 轮次用尽还在要工具，说明它绕不出来了，直接把已查到的东西交代清楚
        log.warning("工具调用超过 %s 轮仍未收敛，已查：%s", MAX_ROUNDS, used)
        return AgentTurn(
            content="我查了几轮还是没拼出完整答案，你把问题说得更具体一点，比如指定项目名或时间范围。",
            used_tools=used,
        )

    except CredentialMissing as exc:
        return _degrade(db, message, exc.message)
    except UpstreamUnavailable as exc:
        log.warning("模型不可用，走本地兜底：%s", exc.message)
        return _degrade(db, message, exc.message)


async def run_turn_stream(
    db: Session,
    message: str,
    *,
    history: list[dict] | None = None,
    frontend: dict | None = None,
):
    """流式版本，产出 (事件名, 数据) 二元组。

    和 run_turn 的差别只在于把中间过程也交出去：模型去查账号数据时前端能显示
    「正在查账号矩阵」，而不是转圈十秒什么都没有。

    模型给出的最终答复是整段拿到再切块推的——只有轮次用尽那条兜底路径走真正的
    增量流。理由写在 llm.chat_stream 上：为了工具调用的增量拼接把编排复杂度
    翻倍，换来的那点首字延迟不值。
    """
    messages = _build_messages(db, message, history or [], frontend or {})
    schema = toolbox.openai_schema()
    used: list[str] = []

    try:
        for _ in range(MAX_ROUNDS):
            result = await llm.chat(messages, schema)

            write_call = next(
                (c for c in result.tool_calls if _mode_of(c.name) == "write"), None
            )
            if write_call is not None:
                if result.content.strip():
                    yield "delta", result.content.strip()
                pending = PendingAction(
                    tool=write_call.name,
                    arguments=write_call.arguments,
                    summary=toolbox.confirm_text(write_call.name, write_call.arguments),
                )
                yield "pending", pending.as_dict()
                yield "done", {"usedTools": used}
                return

            if not result.wants_tools:
                yield "delta", result.content.strip()
                yield "done", {"usedTools": used}
                return

            names = [c.name for c in result.tool_calls]
            used.extend(names)
            yield "tool", {"names": names}

            messages.append(
                {
                    "role": "assistant",
                    "content": result.content,
                    "tool_calls": [
                        {
                            "id": call.id,
                            "type": "function",
                            "function": {"name": call.name, "arguments": _dump(call.arguments)},
                        }
                        for call in result.tool_calls
                    ],
                }
            )
            for call in result.tool_calls:
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call.id,
                        "name": call.name,
                        "content": _dump(_safe_read(db, call.name, call.arguments)),
                    }
                )

        # 轮次用尽：不再给工具，逼它用已有材料收口，这一段走真增量
        async for piece in llm.chat_stream(messages):
            yield "delta", piece
        yield "done", {"usedTools": used}

    except (CredentialMissing, UpstreamUnavailable) as exc:
        turn = _degrade(db, message, exc.message)
        yield "delta", turn.content
        yield "done", {"usedTools": used, "degraded": True, "reason": exc.message}


def _mode_of(name: str) -> str:
    tool = toolbox.describe(name)
    return tool.mode if tool else "read"


def _safe_read(db: Session, name: str, args: dict) -> Any:
    """读工具出错不该中断整轮对话，把错误当成结果交回给模型自己解释。"""
    try:
        return run_read(db, name, args)
    except DojoError as exc:
        return {"error": exc.message}
    except Exception as exc:
        log.exception("执行查询工具 %s 失败", name)
        return {"error": f"查询出错：{exc}"}


def _dump(value: Any) -> str:
    import json

    return json.dumps(value, ensure_ascii=False, default=str)


def _degrade(db: Session, message: str, reason: str) -> AgentTurn:
    """模型连不上时的兜底。

    不装作能回答，但也别只回一句「服务不可用」——把库里的真实数字摆出来，
    用户至少知道现在什么情况。
    """
    snapshot = ctx.build_snapshot(db)
    accounts = snapshot["accounts"]
    schedule = snapshot["schedule"]
    library = snapshot["library"]

    lines = [
        "模型这会儿连不上，我先按工作台里的真实数据跟你对一下：",
        f"项目 {snapshot['projectCount']} 个，排期 {schedule['total']} 项（逾期 {schedule['overdue']} 项）。",
        f"账号 {accounts['total']} 个，已同步 {accounts['synced']} 个，合计粉丝 {accounts['totalFollowers']}。",
        f"灵感库 {library['inspirationCount']} 条，脚本 {library['scriptCount']} 条。",
        "",
        f"你刚才问的是「{message}」，等模型恢复后再问一次就行。",
    ]
    return AgentTurn(
        content="\n".join(lines),
        used_tools=[],
        memory_hint=reason,
        degraded=True,
    )
