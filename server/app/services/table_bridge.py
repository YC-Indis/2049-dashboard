"""结构化表的整表读写桥。

前端 store 是按「整表读、整表写」写的，一时半会不会改。但项目、排期、账号这几张
又必须是真表，否则 Agent 没法校验和跨表查。

于是在这里搭个桥：前端照旧整表存取，落到库里是关系表。等哪天前端逐个 store 改成
调结构化接口，把对应的适配器删掉就行，两边可以分开推进。

写入用「按主键对齐」而不是清空重建：整表 PUT 里没出现的行会被删掉，这是前端语义
本来就有的意思，但保留已有行的 created_at 和同步字段——那些前端根本不知道。
"""

from __future__ import annotations

import logging
from typing import Any, Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import AccountVideo, MatrixAccount, Project, ProjectRuntime, ScheduleBlock
from .workspace import derive_run_status

log = logging.getLogger("dojo.bridge")


# ---- projects -------------------------------------------------------------


def read_projects(db: Session) -> list[dict]:
    rows = db.scalars(select(Project).order_by(Project.created_at)).all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "aliases": r.aliases or [],
            "region": r.region,
            "status": r.status,
            "active": r.active,
        }
        for r in rows
    ]


def write_projects(db: Session, payload: Any) -> None:
    rows = payload if isinstance(payload, list) else []
    keep: set[str] = set()

    for item in rows:
        if not isinstance(item, dict) or not item.get("id"):
            continue
        pid = str(item["id"])
        keep.add(pid)
        row = db.get(Project, pid)
        if row is None:
            row = Project(id=pid, name=item.get("name") or pid)
            db.add(row)
        row.name = item.get("name") or row.name
        row.aliases = item.get("aliases") or []
        row.region = item.get("region")
        row.status = item.get("status")
        row.active = bool(item.get("active", True))

    for row in db.scalars(select(Project)).all():
        if row.id not in keep:
            db.delete(row)
    db.flush()


# ---- projectRuntime -------------------------------------------------------


def read_runtime(db: Session) -> dict:
    out: dict[str, Any] = {}
    for row in db.scalars(select(ProjectRuntime)).all():
        kpi = row.kpi or {}
        out[row.project_id] = {
            "projectId": row.project_id,
            "brand": row.brand,
            "priority": row.priority,
            "runStatus": derive_run_status(kpi.get("cycleStart"), kpi.get("cycleEnd")),
            "owner": row.owner,
            "clientContact": row.client_contact,
            "kpi": kpi,
            "current": row.current or {},
            "todoMeta": row.todo_meta or {},
        }
    return out


def write_runtime(db: Session, payload: Any) -> None:
    data = payload if isinstance(payload, dict) else {}
    for project_id, item in data.items():
        if not isinstance(item, dict):
            continue
        # 项目本身还没写进来时先跳过，前端会先存 projects 再存 runtime
        if db.get(Project, project_id) is None:
            log.debug("runtime 里的 %s 还没有对应项目，跳过", project_id)
            continue
        row = db.get(ProjectRuntime, project_id)
        if row is None:
            row = ProjectRuntime(project_id=project_id)
            db.add(row)
        row.brand = item.get("brand") or ""
        row.priority = item.get("priority") or "medium"
        row.owner = item.get("owner") or ""
        row.client_contact = item.get("clientContact") or ""
        row.kpi = item.get("kpi") or {}
        row.current = item.get("current") or {}
        row.todo_meta = item.get("todoMeta") or {}
    db.flush()


# ---- scheduleBlocks -------------------------------------------------------


def read_blocks(db: Session) -> list[dict]:
    rows = db.scalars(select(ScheduleBlock).order_by(ScheduleBlock.start)).all()
    return [
        {
            "id": r.id,
            "projectId": r.project_id,
            "projectName": r.project_name,
            "title": r.title,
            "type": r.type,
            "start": r.start,
            "end": r.end,
            "note": r.note,
            "source": r.source,
            "owner": r.owner,
            "status": r.status,
            "done": r.done,
            "target": r.target,
            "lane": r.lane,
        }
        for r in rows
    ]


def write_blocks(db: Session, payload: Any) -> None:
    rows = payload if isinstance(payload, list) else []
    keep: set[str] = set()
    known = {p.id for p in db.scalars(select(Project)).all()}

    for item in rows:
        if not isinstance(item, dict) or not item.get("id"):
            continue
        pid = item.get("projectId")
        if pid not in known:
            # 外键会拦，但拦下来整批就失败了。跳过并留个日志更实用
            log.debug("排期块 %s 指向不存在的项目 %s，跳过", item["id"], pid)
            continue

        bid = str(item["id"])
        keep.add(bid)
        row = db.get(ScheduleBlock, bid)
        if row is None:
            row = ScheduleBlock(id=bid, project_id=pid, title="", start="", end="")
            db.add(row)
        row.project_id = pid
        row.project_name = item.get("projectName") or ""
        row.title = item.get("title") or ""
        row.type = item.get("type") or "task"
        row.start = item.get("start") or ""
        row.end = item.get("end") or item.get("start") or ""
        row.note = item.get("note")
        row.source = item.get("source") or "manual"
        row.owner = item.get("owner")
        row.status = item.get("status")
        row.done = item.get("done")
        row.target = item.get("target")
        row.lane = item.get("lane")

    for row in db.scalars(select(ScheduleBlock)).all():
        if row.id not in keep:
            db.delete(row)
    db.flush()


# ---- accounts -------------------------------------------------------------


def read_accounts(db: Session) -> list[dict]:
    from .accounts import account_dict

    rows = db.scalars(select(MatrixAccount).order_by(MatrixAccount.added_at.desc())).all()
    return [account_dict(r) for r in rows]


def write_accounts(db: Session, payload: Any) -> None:
    """只接受人工可填的那几个字段。

    粉丝数、最后同步时间这些是同步链路写的，前端整表推上来时带的是它自己那份
    可能已经过期的副本，照单全收会把刚同步到的新数据盖回去。
    """
    rows = payload if isinstance(payload, list) else []
    keep: set[str] = set()

    for item in rows:
        if not isinstance(item, dict) or not item.get("handle"):
            continue
        handle = str(item["handle"])
        if not handle.startswith("@"):
            handle = f"@{handle}"
        keep.add(handle)

        row = db.get(MatrixAccount, handle)
        if row is None:
            row = MatrixAccount(handle=handle, project_id=item.get("projectId") or "")
            db.add(row)
        row.project_id = item.get("projectId") or row.project_id
        row.segment = item.get("segment") or ""
        row.status = item.get("status") or "pending"
        row.source = item.get("source") or "manual"
        row.added_at = item.get("addedAt") or row.added_at or ""
        row.link = item.get("link") or ""
        row.note = item.get("note") or ""

        # 库里还没同步过的号，允许前端把历史值带进来做一次性迁移
        if row.followers is None and isinstance(item.get("followers"), int):
            row.followers = item["followers"]
            row.nickname = item.get("nickname")
            row.last_synced_at = item.get("lastSyncedAt")
            row.sync_source = item.get("syncSource")

    for row in db.scalars(select(MatrixAccount)).all():
        if row.handle not in keep:
            db.delete(row)
    db.flush()


# ---- accountVideos --------------------------------------------------------


def read_account_videos(db: Session) -> dict:
    from .accounts import video_dict

    grouped: dict[str, list[dict]] = {}
    for row in db.scalars(select(AccountVideo)).all():
        grouped.setdefault(row.handle, []).append(video_dict(row))
    return grouped


def write_account_videos(db: Session, payload: Any) -> None:
    data = payload if isinstance(payload, dict) else {}
    known = {a.handle for a in db.scalars(select(MatrixAccount)).all()}

    for handle, videos in data.items():
        key = handle if handle.startswith("@") else f"@{handle}"
        if key not in known or not isinstance(videos, list):
            continue
        existing = {
            v.video_id: v
            for v in db.scalars(
                select(AccountVideo).where(AccountVideo.handle == key)
            ).all()
        }
        for item in videos:
            if not isinstance(item, dict) or not item.get("videoId"):
                continue
            row = existing.get(item["videoId"])
            if row is None:
                row = AccountVideo(handle=key, video_id=item["videoId"])
                db.add(row)
            row.video_url = item.get("videoUrl") or ""
            row.description = item.get("description") or ""
            row.publish_date = item.get("publishDate") or ""
            row.views = int(item.get("views") or 0)
            row.likes = int(item.get("likes") or 0)
            row.comments = int(item.get("comments") or 0)
            row.shares = int(item.get("shares") or 0)
            row.engagement_rate = float(item.get("engagementRate") or 0)
            row.duration = item.get("duration")
            row.cover = item.get("cover")
            row.is_ad = bool(item.get("isAd"))
    db.flush()


Reader = Callable[[Session], Any]
Writer = Callable[[Session, Any], None]

ADAPTERS: dict[str, tuple[Reader, Writer]] = {
    "projects": (read_projects, write_projects),
    "projectRuntime": (read_runtime, write_runtime),
    "scheduleBlocks": (read_blocks, write_blocks),
    "accounts": (read_accounts, write_accounts),
    "accountVideos": (read_account_videos, write_account_videos),
}
