"""组装给模型看的工作区快照。

数据以服务端库里的为准。前端也会传一份 context 过来，但只取它那些服务端不知道
的东西——当前在哪个页面、界面上选中了哪个项目。业务数字一律自己查，不然前端
状态一旦滞后，模型就会拿着旧数字言之凿凿。
"""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ...models import AccountVideo, MatrixAccount, Project, ScheduleBlock, TableBlob
from ..workspace import derive_run_status, today_key

# 只透传这几个键，其余前端字段一概忽略
FRONTEND_KEYS = ("page", "route", "selectedProject", "scene")

# 送进 system prompt 的上限。上下文再大模型也读不细，还挤占对话轮次
MAX_CHARS = 12000


def _project_row(project: Project) -> dict:
    runtime = project.runtime
    kpi = (runtime.kpi if runtime else {}) or {}
    current = (runtime.current if runtime else {}) or {}
    return {
        "id": project.id,
        "name": project.name,
        "active": project.active,
        "region": project.region,
        "priority": runtime.priority if runtime else "medium",
        "owner": runtime.owner if runtime else "",
        "runStatus": derive_run_status(kpi.get("cycleStart"), kpi.get("cycleEnd")),
        "cycle": f"{kpi.get('cycleStart', '')} ~ {kpi.get('cycleEnd', '')}".strip(" ~"),
        "kpi": kpi,
        "current": current,
    }


def _schedule_summary(db: Session) -> dict:
    today = today_key()
    rows = list(db.scalars(select(ScheduleBlock)).all())
    today_rows = [r for r in rows if r.start <= today <= r.end]
    overdue = [r for r in rows if r.end < today and (r.status or "") != "已完成"]
    return {
        "total": len(rows),
        "today": [
            {"title": r.title, "project": r.project_name, "end": r.end}
            for r in today_rows[:8]
        ],
        "overdue": len(overdue),
        "overdueSample": [
            {"title": r.title, "project": r.project_name, "end": r.end} for r in overdue[:5]
        ],
    }


def _account_summary(db: Session) -> dict:
    total = db.scalar(select(func.count()).select_from(MatrixAccount)) or 0
    synced = (
        db.scalar(
            select(func.count())
            .select_from(MatrixAccount)
            .where(MatrixAccount.last_synced_at.is_not(None))
        )
        or 0
    )
    followers = db.scalar(select(func.sum(MatrixAccount.followers))) or 0
    video_count = db.scalar(select(func.count()).select_from(AccountVideo)) or 0

    top = db.scalars(
        select(MatrixAccount)
        .where(MatrixAccount.followers.is_not(None))
        .order_by(MatrixAccount.followers.desc())
        .limit(10)
    ).all()

    return {
        "total": total,
        "synced": synced,
        "totalFollowers": int(followers),
        "videos": video_count,
        "top": [
            {"handle": a.handle, "followers": a.followers, "lastSyncedAt": a.last_synced_at}
            for a in top
        ],
    }


def _blob(db: Session, name: str) -> Any:
    row = db.get(TableBlob, name)
    return row.payload if row else None


def _library_summary(db: Session) -> dict:
    """灵感相关的数据还整包存在 blob 里，这里只数个数、取标题。

    不把整包塞给模型：候选池能到几百条，全带上会把上下文挤爆，
    真要细看有 list_library 工具。
    """
    state = _blob(db, "inspirationLocalState") or {}
    explore = _blob(db, "inspirationExplore") or {}
    if not isinstance(state, dict):
        state = {}
    if not isinstance(explore, dict):
        explore = {}

    executable = state.get("executableInspirations") or []
    scripts = state.get("scripts") or []
    sources = state.get("sources") or []
    candidates = state.get("candidates") or []
    benchmarks = explore.get("accounts") or []

    return {
        "inspirationCount": len(executable),
        "scriptCount": len(scripts),
        "sourceCount": len(sources),
        "candidateCount": len(candidates),
        "benchmarkCount": len(benchmarks),
        "recentInspirations": [
            {"id": item.get("id"), "title": item.get("title")}
            for item in executable[:8]
            if isinstance(item, dict)
        ],
        "recentScripts": [
            {"id": item.get("id"), "title": item.get("title")}
            for item in scripts[:8]
            if isinstance(item, dict)
        ],
    }


def build_snapshot(db: Session, frontend: dict | None = None) -> dict:
    frontend = frontend or {}
    projects = list(db.scalars(select(Project).order_by(Project.created_at)).all())

    snapshot: dict[str, Any] = {
        "today": today_key(),
        "projectCount": len(projects),
        "projects": [_project_row(p) for p in projects],
        "schedule": _schedule_summary(db),
        "accounts": _account_summary(db),
        "library": _library_summary(db),
    }
    for key in FRONTEND_KEYS:
        if key in frontend:
            snapshot[key] = frontend[key]
    return snapshot


def render(snapshot: dict) -> str:
    text = json.dumps(snapshot, ensure_ascii=False)
    if len(text) <= MAX_CHARS:
        return text
    # 超长时优先砍项目明细，它是唯一会线性增长的部分
    trimmed = dict(snapshot)
    trimmed["projects"] = [
        {"id": p["id"], "name": p["name"], "runStatus": p["runStatus"]}
        for p in snapshot.get("projects", [])
    ]
    trimmed["note"] = "项目明细已省略，需要时调 project_progress 查"
    return json.dumps(trimmed, ensure_ascii=False)[:MAX_CHARS]
