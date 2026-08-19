"""执行域的写入逻辑：项目、运行态、排期块。

router 只做参数校验和序列化，真正的规则都在这里，因为 Agent 的工具执行器也要
走同一套——两边各写一遍迟早会漂。
"""

from __future__ import annotations

import re
import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..errors import ProjectAmbiguous, RecordNotFound, WriteRejected
from ..models import Project, ProjectRuntime, ScheduleBlock
from ..schemas.workspace import (
    ProjectCreate,
    ProjectPatch,
    RuntimePatch,
    ScheduleBlockPatch,
    ScheduleBlockUpsert,
)

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def today_key() -> str:
    return date.today().isoformat()


def derive_run_status(cycle_start: str | None, cycle_end: str | None, today: str | None = None) -> str:
    """与前端 dojoProjectImport.deriveRunStatus 保持同样的判定。

    不落库是有意的：存下来就会过期，每天零点还得有人去刷。
    """
    if not cycle_start or not cycle_end:
        return "未开始"
    now = today or today_key()
    if now < cycle_start:
        return "未开始"
    if now > cycle_end:
        return "完结"
    return "进行中"


def _check_date(value: str | None, field: str) -> None:
    if value and not DATE_RE.match(value):
        raise WriteRejected(f"{field} 需要 YYYY-MM-DD，收到的是 {value!r}")


def _check_cycle(start: str | None, end: str | None) -> None:
    _check_date(start, "cycleStart")
    _check_date(end, "cycleEnd")
    if start and end and end < start:
        raise WriteRejected(f"周期结束日 {end} 早于开始日 {start}")


def make_project_id(name: str) -> str:
    """人能读懂的 id 优先，纯中文名退化成随机短码。

    id 会出现在 KPI 排期块的 id 里（KPI-scripts-xxx），所以只留 ASCII。
    """
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    if slug:
        return slug[:40]
    return f"p-{uuid.uuid4().hex[:8]}"


def list_projects(db: Session, *, active_only: bool = False) -> list[Project]:
    stmt = select(Project).order_by(Project.created_at)
    if active_only:
        stmt = stmt.where(Project.active.is_(True))
    return list(db.scalars(stmt).all())


def get_project(db: Session, project_id: str) -> Project:
    row = db.get(Project, project_id)
    if row is None:
        raise RecordNotFound(f"项目不存在：{project_id}")
    return row


def find_project_by_text(db: Session, text: str) -> Project | None:
    """在一句话里找项目名或别名。

    命中多个时取名字最长的那个——「巴西站」和「巴西站二期」同时存在时，
    用户说「巴西站二期」不该被前者截胡。
    """
    if not text:
        return None
    hits: list[tuple[int, Project]] = []
    for row in list_projects(db):
        for token in [row.name, *(row.aliases or [])]:
            if token and token in text:
                hits.append((len(token), row))
                break
    if not hits:
        return None
    hits.sort(key=lambda item: item[0], reverse=True)
    return hits[0][1]


def resolve_write_target(db: Session, *, text: str = "", project_id: str | None = None) -> Project:
    """项目级写操作的收口。

    AGENTS.md 的硬规则：没点名且不止一个项目时必须列候选再问，不能默默写进
    界面上当前选中的那个。所以这里只认两种情况——显式 id / 文本命中，再不然
    就是全库只有一个项目。其余一律抛 ProjectAmbiguous。
    """
    if project_id:
        return get_project(db, project_id)

    named = find_project_by_text(db, text)
    if named is not None:
        return named

    rows = list_projects(db)
    if len(rows) == 1:
        return rows[0]
    if not rows:
        raise RecordNotFound("工作台里还没有项目，先建一个再说")
    raise ProjectAmbiguous(
        "这条操作要落到具体项目上，请点名是哪一个",
        [{"id": row.id, "name": row.name} for row in rows],
    )


def create_project(db: Session, body: ProjectCreate) -> Project:
    name = body.name.strip()
    if not name:
        raise WriteRejected("项目名不能为空")

    exists = db.scalar(select(Project).where(Project.name == name))
    if exists is not None:
        raise WriteRejected(f"已经有叫「{name}」的项目了")

    kpi = body.kpi.model_dump(by_alias=True) if body.kpi else {}
    cycle_start = body.cycle_start or kpi.get("cycleStart") or ""
    cycle_end = body.cycle_end or kpi.get("cycleEnd") or ""
    _check_cycle(cycle_start, cycle_end)
    kpi["cycleStart"] = cycle_start
    kpi["cycleEnd"] = cycle_end

    project_id = make_project_id(name)
    while db.get(Project, project_id) is not None:
        project_id = f"{project_id}-{uuid.uuid4().hex[:4]}"

    project = Project(
        id=project_id,
        name=name,
        aliases=list(body.aliases or []),
        region=body.region,
        status=None,
        active=True,
    )
    project.runtime = ProjectRuntime(
        project_id=project_id,
        brand=body.brand or name,
        priority=body.priority,
        owner=body.owner or "",
        client_contact=body.client_contact or "",
        kpi=kpi,
        current={
            "accounts": 0,
            "scripts": 0,
            "edited": 0,
            "approved": 0,
            "distributed": 0,
            "exposure": 0,
        },
        todo_meta={},
    )
    db.add(project)
    db.flush()
    return project


def update_project(db: Session, project_id: str, patch: ProjectPatch) -> Project:
    project = get_project(db, project_id)
    data = patch.model_dump(exclude_unset=True)

    if "name" in data and data["name"]:
        new_name = data["name"].strip()
        clash = db.scalar(
            select(Project).where(Project.name == new_name, Project.id != project_id)
        )
        if clash is not None:
            raise WriteRejected(f"已经有叫「{new_name}」的项目了")
        project.name = new_name
        # 项目名冗余在排期块里，改名要一起刷，否则日历上还是旧名字
        for block in project.blocks:
            block.project_name = new_name

    for field in ("region", "status", "active", "aliases"):
        if field in data and data[field] is not None:
            setattr(project, field, data[field])

    db.flush()
    return project


def delete_project(db: Session, project_id: str) -> None:
    db.delete(get_project(db, project_id))


def get_runtime(db: Session, project_id: str) -> ProjectRuntime:
    project = get_project(db, project_id)
    if project.runtime is None:
        project.runtime = ProjectRuntime(project_id=project_id, kpi={}, current={}, todo_meta={})
        db.flush()
    return project.runtime


def patch_runtime(db: Session, project_id: str, patch: RuntimePatch) -> ProjectRuntime:
    runtime = get_runtime(db, project_id)
    data = patch.model_dump(exclude_unset=True)

    for field in ("brand", "priority", "owner", "client_contact"):
        if field in data and data[field] is not None:
            setattr(runtime, field, data[field])

    if patch.kpi is not None:
        kpi = patch.kpi.model_dump(by_alias=True, exclude_none=True)
        _check_cycle(kpi.get("cycleStart"), kpi.get("cycleEnd"))
        runtime.kpi = {**(runtime.kpi or {}), **kpi}

    if patch.current is not None:
        runtime.current = patch.current.model_dump(by_alias=True)

    # 「把已发视频改成 120」这种只动一两个数的场景，整包替换会把别的字段抹成 0
    if patch.current_patch:
        merged = dict(runtime.current or {})
        for key, value in patch.current_patch.items():
            if value < 0:
                raise WriteRejected(f"{key} 不能是负数")
            merged[key] = value
        runtime.current = merged

    if patch.todo_meta is not None:
        runtime.todo_meta = {**(runtime.todo_meta or {}), **patch.todo_meta}

    db.flush()
    return runtime


def list_blocks(db: Session, *, project_id: str | None = None) -> list[ScheduleBlock]:
    stmt = select(ScheduleBlock).order_by(ScheduleBlock.start)
    if project_id:
        stmt = stmt.where(ScheduleBlock.project_id == project_id)
    return list(db.scalars(stmt).all())


def upsert_block(db: Session, body: ScheduleBlockUpsert) -> ScheduleBlock:
    project = get_project(db, body.project_id)
    _check_date(body.start, "start")
    _check_date(body.end, "end")
    if body.end < body.start:
        raise WriteRejected(f"结束日 {body.end} 早于开始日 {body.start}")

    block_id = body.id or f"blk-{uuid.uuid4().hex[:10]}"
    row = db.get(ScheduleBlock, block_id)
    payload = body.model_dump(exclude={"id"})
    payload["project_name"] = body.project_name or project.name

    if row is None:
        row = ScheduleBlock(id=block_id, **payload)
        db.add(row)
    else:
        for key, value in payload.items():
            setattr(row, key, value)
    db.flush()
    return row


def patch_block(db: Session, block_id: str, patch: ScheduleBlockPatch) -> ScheduleBlock:
    row = db.get(ScheduleBlock, block_id)
    if row is None:
        raise RecordNotFound(f"排期项不存在：{block_id}")

    data = patch.model_dump(exclude_unset=True)
    start = data.get("start", row.start)
    end = data.get("end", row.end)
    _check_date(start, "start")
    _check_date(end, "end")
    if end < start:
        raise WriteRejected(f"结束日 {end} 早于开始日 {start}")

    for key, value in data.items():
        if value is not None:
            setattr(row, key, value)
    db.flush()
    return row


def remove_block(db: Session, block_id: str) -> None:
    row = db.get(ScheduleBlock, block_id)
    if row is None:
        raise RecordNotFound(f"排期项不存在：{block_id}")
    db.delete(row)


def runtime_payload(runtime: ProjectRuntime | None) -> dict | None:
    """补上不落库的 runStatus 再给出去。"""
    if runtime is None:
        return None
    kpi = runtime.kpi or {}
    return {
        "projectId": runtime.project_id,
        "brand": runtime.brand,
        "priority": runtime.priority,
        "runStatus": derive_run_status(kpi.get("cycleStart"), kpi.get("cycleEnd")),
        "owner": runtime.owner,
        "clientContact": runtime.client_contact,
        "kpi": kpi,
        "current": runtime.current or {},
        "todoMeta": runtime.todo_meta or {},
    }
