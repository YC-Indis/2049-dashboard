"""工具的实际执行。

读操作在对话过程中直接跑；写操作只有拿到用户确认之后才会走到 run_write，
编排层不会在没确认的情况下调它。
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ...errors import RecordNotFound, ToolArgumentMissing, WriteRejected
from ...models import Project, TableBlob
from ...schemas.workspace import (
    ProjectCreate,
    ProjectKpi,
    ProjectPatch,
    RuntimePatch,
    ScheduleBlockPatch,
    ScheduleBlockUpsert,
)
from .. import accounts as account_svc
from .. import workspace as ws
from ..workspace import today_key

log = logging.getLogger("dojo.agent.exec")

# 环节名 -> KPI 排期块 id 里用的 key，跟前端 PLAN_PHASE_META 对齐
PHASE_KEYS = {
    "脚本": "scripts",
    "起号": "accounts",
    "拍摄": "shoot",
    "剪辑": "edit",
    "分发": "distribute",
    "投放": "ads",
}

PROGRESS_FIELDS = ("accounts", "scripts", "edited", "approved", "distributed", "exposure")


# --------------------------------------------------------------------------
# 读
# --------------------------------------------------------------------------


def run_read(db: Session, name: str, args: dict[str, Any]) -> Any:
    handler = _READERS.get(name)
    if handler is None:
        raise RecordNotFound(f"没有这个查询工具：{name}")
    return handler(db, args)


def _read_projects(db: Session, args: dict) -> Any:
    rows = ws.list_projects(db, active_only=bool(args.get("activeOnly")))
    if not rows:
        return {"count": 0, "projects": [], "note": "工作台里还没有项目"}
    return {
        "count": len(rows),
        "projects": [
            {
                "id": r.id,
                "name": r.name,
                "region": r.region,
                "active": r.active,
                "runStatus": ws.derive_run_status(
                    (r.runtime.kpi or {}).get("cycleStart") if r.runtime else None,
                    (r.runtime.kpi or {}).get("cycleEnd") if r.runtime else None,
                ),
            }
            for r in rows
        ],
    }


def _read_progress(db: Session, args: dict) -> Any:
    text = args.get("project") or ""
    if text:
        target = ws.find_project_by_text(db, text)
        if target is None:
            return {"error": f"没找到叫「{text}」的项目"}
        rows = [target]
    else:
        rows = ws.list_projects(db)

    out = []
    for project in rows:
        runtime = project.runtime
        kpi = (runtime.kpi if runtime else {}) or {}
        current = (runtime.current if runtime else {}) or {}
        detail = {}
        for field in PROGRESS_FIELDS:
            target_value = kpi.get("videos" if field == "distributed" else field)
            done = current.get(field, 0)
            if isinstance(target_value, int) and target_value > 0:
                detail[field] = {
                    "done": done,
                    "target": target_value,
                    "pct": round(done * 100 / target_value, 1),
                }
            else:
                detail[field] = {"done": done, "target": None}
        out.append(
            {
                "id": project.id,
                "name": project.name,
                "cycle": f"{kpi.get('cycleStart', '')} ~ {kpi.get('cycleEnd', '')}",
                "runStatus": ws.derive_run_status(kpi.get("cycleStart"), kpi.get("cycleEnd")),
                "progress": detail,
            }
        )
    return {"projects": out}


def _read_accounts(db: Session, _args: dict) -> Any:
    data = account_svc.account_overview(db)
    if data["total"] == 0:
        return {"total": 0, "note": "台账里还没有账号"}
    return data


def _read_schedule(db: Session, args: dict) -> Any:
    scope = args.get("scope") or "all"
    project_id = None
    if args.get("project"):
        found = ws.find_project_by_text(db, args["project"])
        if found is None:
            return {"error": f"没找到叫「{args['project']}」的项目"}
        project_id = found.id

    rows = ws.list_blocks(db, project_id=project_id)
    today = today_key()
    if scope == "today":
        rows = [r for r in rows if r.start <= today <= r.end]
    elif scope == "overdue":
        rows = [r for r in rows if r.end < today and (r.status or "") != "已完成"]
    elif scope == "unassigned":
        rows = [r for r in rows if not r.start]

    return {
        "count": len(rows),
        "blocks": [
            {
                "id": r.id,
                "project": r.project_name,
                "title": r.title,
                "type": r.type,
                "start": r.start,
                "end": r.end,
                "status": r.status,
            }
            for r in rows[:30]
        ],
    }


def _read_library(db: Session, args: dict) -> Any:
    kind = args.get("kind")
    state = _blob_payload(db, "inspirationLocalState")
    explore = _blob_payload(db, "inspirationExplore")

    buckets = {
        "inspiration": (state.get("executableInspirations") or [], ("id", "title", "angle")),
        "script": (state.get("scripts") or [], ("id", "title", "status")),
        "source": (state.get("sources") or [], ("id", "name", "query", "enabled")),
        "benchmark": (explore.get("accounts") or [], ("id", "handle", "tier", "note")),
    }
    if kind not in buckets:
        raise RecordNotFound(f"没有这个库：{kind}")

    items, fields = buckets[kind]
    return {
        "kind": kind,
        "count": len(items),
        "items": [
            {f: item.get(f) for f in fields} for item in items[:25] if isinstance(item, dict)
        ],
    }


_READERS = {
    "list_projects": _read_projects,
    "project_progress": _read_progress,
    "account_overview": _read_accounts,
    "list_schedule": _read_schedule,
    "list_library": _read_library,
}


# --------------------------------------------------------------------------
# 写
# --------------------------------------------------------------------------


async def run_write(db: Session, name: str, args: dict[str, Any]) -> dict:
    handler = _WRITERS.get(name)
    if handler is None:
        raise RecordNotFound(f"没有这个写入工具：{name}")
    result = handler(db, args)
    if hasattr(result, "__await__"):
        result = await result
    return result


def _require(args: dict, *fields: str) -> None:
    missing = [f for f in fields if not args.get(f)]
    if missing:
        raise ToolArgumentMissing(f"还缺这几项：{'、'.join(missing)}", missing)


def _write_create_project(db: Session, args: dict) -> dict:
    _require(args, "name")
    kpi = {
        "cycleStart": args.get("cycleStart") or "",
        "cycleEnd": args.get("cycleEnd") or "",
        "accounts": int(args.get("accounts") or 0),
        "videos": int(args.get("videos") or 0),
        "exposure": int(args.get("exposure") or 0),
        "scripts": int(args.get("scripts") or 0),
    }
    project = ws.create_project(
        db,
        ProjectCreate(
            name=args["name"],
            region=args.get("region"),
            owner=args.get("owner"),
            cycle_start=kpi["cycleStart"] or None,
            cycle_end=kpi["cycleEnd"] or None,
            kpi=kpi,
        ),
    )
    return {"projectId": project.id, "name": project.name}


def _write_create_task(db: Session, args: dict) -> dict:
    _require(args, "title", "date")
    project = ws.resolve_write_target(db, text=args.get("project") or "")
    block = ws.upsert_block(
        db,
        ScheduleBlockUpsert(
            project_id=project.id,
            project_name=project.name,
            title=args["title"],
            type="task",
            start=args["date"],
            end=args.get("endDate") or args["date"],
            source="manual",
            owner=args.get("owner"),
        ),
    )
    return {"blockId": block.id, "project": project.name, "title": block.title}


def _write_reschedule(db: Session, args: dict) -> dict:
    _require(args, "start")
    start = args["start"]
    end = args.get("end") or start

    block_id = args.get("blockId")
    if not block_id:
        project = ws.resolve_write_target(db, text=args.get("project") or "")
        phase = args.get("phase")
        if not phase:
            raise ToolArgumentMissing("要改哪个环节？脚本 / 起号 / 拍摄 / 剪辑 / 分发 / 投放", ["phase"])
        key = PHASE_KEYS.get(phase)
        if key is None:
            raise WriteRejected(f"不认识的环节：{phase}")
        block_id = f"KPI-{key}-{project.id}"

    block = ws.patch_block(db, block_id, ScheduleBlockPatch(start=start, end=end))
    return {"blockId": block.id, "title": block.title, "start": block.start, "end": block.end}


# 工具参数名 -> ProjectKpi 字段名。target 前缀是给模型看的，免得跟「已完成量」混
KPI_TARGET_FIELDS = {
    "cycleStart": "cycle_start",
    "cycleEnd": "cycle_end",
    "targetAccounts": "accounts",
    "targetVideos": "videos",
    "targetExposure": "exposure",
    "targetScripts": "scripts",
}


def _write_update_project(db: Session, args: dict) -> dict:
    """项目信息落在两张表上，这里按字段归属拆开写。

    projects 表管名称和地区，周期与目标数在 project_runtime.kpi 里。对用户来说
    都是「改项目」，所以合成一个工具，拆分放在这层做。
    """
    project = ws.resolve_write_target(db, text=args.get("project") or "")
    changed: dict = {}

    base = {field: args[field] for field in ("name", "region") if args.get(field) is not None}
    kpi = {
        attr: args[key] for key, attr in KPI_TARGET_FIELDS.items() if args.get(key) is not None
    }
    runtime = {
        field: args[field] for field in ("owner", "priority") if args.get(field) is not None
    }

    if not base and not kpi and not runtime:
        raise ToolArgumentMissing(
            "要改这个项目的什么？名称、投放地区、周期、负责人、优先级或者目标数",
            ["name", "region", "cycleStart", "cycleEnd", "owner", "priority"],
        )

    for field in ("accounts", "videos", "exposure", "scripts"):
        if field in kpi:
            kpi[field] = int(kpi[field])
            if kpi[field] < 0:
                raise WriteRejected(f"目标{field}不能是负数")

    if base:
        updated = ws.update_project(db, project.id, ProjectPatch(**base))
        changed.update({"name": updated.name, "region": updated.region})

    if kpi or runtime:
        patched = ws.patch_runtime(
            db,
            project.id,
            RuntimePatch(kpi=ProjectKpi(**kpi) if kpi else None, **runtime),
        )
        if kpi:
            changed["kpi"] = patched.kpi
        changed.update(runtime)

    return {"projectId": project.id, "name": project.name, "changed": changed}


def _write_update_progress(db: Session, args: dict) -> dict:
    project = ws.resolve_write_target(db, text=args.get("project") or "")
    patch = {f: int(args[f]) for f in PROGRESS_FIELDS if args.get(f) is not None}
    if not patch:
        raise ToolArgumentMissing(
            "要更新哪几项？比如「已起号 12、已分发 40」", list(PROGRESS_FIELDS)
        )
    ws.patch_runtime(db, project.id, RuntimePatch(current_patch=patch))
    return {"projectId": project.id, "name": project.name, "patched": patch}


async def _write_sync_account(db: Session, args: dict) -> dict:
    _require(args, "handle")
    return await account_svc.sync_account(db, args["handle"])


async def _write_sync_all(db: Session, args: dict) -> dict:
    limit = int(args.get("limit") or 50)
    handles = [row.handle for row in account_svc.list_accounts(db)][:limit]
    if not handles:
        return {"ok": 0, "failed": [], "note": "台账里没有账号可同步"}
    return await account_svc.sync_many(db, handles)


def _write_create_collection(db: Session, args: dict) -> dict:
    _require(args, "query")
    query = str(args["query"]).strip()
    _guard_query(db, query)

    state = _blob_payload(db, "inspirationLocalState")
    sources = list(state.get("sources") or [])
    source = {
        "id": f"src-{len(sources) + 1}-{abs(hash(query)) % 100000}",
        "name": args.get("name") or query,
        "platform": "TikTok",
        "kind": "keyword",
        "query": query,
        "timeWindowDays": int(args.get("days") or 30),
        "defaultLimit": int(args.get("limit") or 20),
        "enabled": True,
        "createdAt": today_key(),
    }
    sources.append(source)
    state["sources"] = sources
    _save_blob(db, "inspirationLocalState", state)
    return {"sourceId": source["id"], "query": query}


def _guard_query(db: Session, query: str) -> None:
    """挡住把项目名/品牌名混进检索词的情况。

    AGENTS.md 明确禁止这件事：拿品牌名去搜只会搜到自己已经发过的东西，
    采集线索就废了。模型偶尔还是会自作主张拼上去，所以服务端再挡一道。
    """
    lowered = query.lower()
    for project in db.scalars(select(Project)).all():
        for token in [project.name, *(project.aliases or [])]:
            if token and len(token) >= 2 and token.lower() in lowered:
                raise WriteRejected(
                    f"检索词里混进了项目名「{token}」。"
                    f"采集要用独立检索词，请确认你要搜的是不是 "
                    f"「{query.replace(token, '').strip()}」"
                )


def _write_create_inspiration(db: Session, args: dict) -> dict:
    _require(args, "title")
    state = _blob_payload(db, "inspirationLocalState")
    items = list(state.get("executableInspirations") or [])
    item = {
        "id": f"insp-{abs(hash(args['title'] + today_key())) % 1000000}",
        "title": args["title"],
        "angle": args.get("angle") or "",
        "hook": "",
        "shotPlan": [],
        "copyPlan": [],
        "musicPlan": [],
        "annotations": [{"text": args["note"]}] if args.get("note") else [],
        "createdAt": today_key(),
        "updatedAt": today_key(),
    }
    items.insert(0, item)
    state["executableInspirations"] = items
    _save_blob(db, "inspirationLocalState", state)
    return {"id": item["id"], "title": item["title"]}


def _write_update_inspiration(db: Session, args: dict) -> dict:
    _require(args, "id")
    state = _blob_payload(db, "inspirationLocalState")
    items = list(state.get("executableInspirations") or [])
    for item in items:
        if isinstance(item, dict) and item.get("id") == args["id"]:
            if args.get("title"):
                item["title"] = args["title"]
            if args.get("angle"):
                item["angle"] = args["angle"]
            item["updatedAt"] = today_key()
            state["executableInspirations"] = items
            _save_blob(db, "inspirationLocalState", state)
            return {"id": item["id"], "title": item.get("title")}
    raise RecordNotFound(f"灵感库里没有 id 为 {args['id']} 的记录")


def _write_create_script(db: Session, args: dict) -> dict:
    _require(args, "title")
    state = _blob_payload(db, "inspirationLocalState")
    scripts = list(state.get("scripts") or [])
    item = {
        "id": f"scr-{abs(hash(args['title'] + today_key())) % 1000000}",
        "title": args["title"],
        "status": "draft",
        "hook": "",
        "body": "",
        "shots": [],
        "music": "",
        "notes": "",
        "createdAt": today_key(),
        "updatedAt": today_key(),
    }
    scripts.insert(0, item)
    state["scripts"] = scripts
    _save_blob(db, "inspirationLocalState", state)
    return {"id": item["id"], "title": item["title"]}


def _write_add_benchmark(db: Session, args: dict) -> dict:
    _require(args, "handle")
    handle = account_svc.normalize_handle(args["handle"])
    explore = _blob_payload(db, "inspirationExplore")
    rows = list(explore.get("accounts") or [])
    if any(isinstance(r, dict) and r.get("handle") == handle for r in rows):
        raise WriteRejected(f"{handle} 已经在对标库里了")
    item = {
        "id": f"bm-{abs(hash(handle)) % 1000000}",
        "handle": handle,
        "tier": "watch",
        "note": args.get("note") or "",
        "createdAt": today_key(),
    }
    rows.append(item)
    explore["accounts"] = rows
    _save_blob(db, "inspirationExplore", explore)
    return {"id": item["id"], "handle": handle}


def _write_delete(db: Session, args: dict) -> dict:
    _require(args, "kind", "id")
    kind = args["kind"]
    target_id = args["id"]

    if kind == "project":
        ws.delete_project(db, target_id)
        return {"deleted": target_id}
    if kind == "schedule":
        ws.remove_block(db, target_id)
        return {"deleted": target_id}

    blob_name, list_key = {
        "inspiration": ("inspirationLocalState", "executableInspirations"),
        "script": ("inspirationLocalState", "scripts"),
        "source": ("inspirationLocalState", "sources"),
        "benchmark": ("inspirationExplore", "accounts"),
    }[kind]

    payload = _blob_payload(db, blob_name)
    rows = list(payload.get(list_key) or [])
    kept = [r for r in rows if not (isinstance(r, dict) and r.get("id") == target_id)]
    if len(kept) == len(rows):
        raise RecordNotFound(f"没找到要删的记录：{target_id}")
    payload[list_key] = kept
    _save_blob(db, blob_name, payload)
    return {"deleted": target_id}


_WRITERS = {
    "create_project": _write_create_project,
    "create_task": _write_create_task,
    "reschedule": _write_reschedule,
    "update_project": _write_update_project,
    "update_progress": _write_update_progress,
    "sync_account": _write_sync_account,
    "sync_all_accounts": _write_sync_all,
    "create_collection": _write_create_collection,
    "create_inspiration": _write_create_inspiration,
    "update_inspiration": _write_update_inspiration,
    "create_script": _write_create_script,
    "add_benchmark": _write_add_benchmark,
    "delete_record": _write_delete,
}


# --------------------------------------------------------------------------


def _blob_payload(db: Session, name: str) -> dict:
    row = db.get(TableBlob, name)
    if row is None or not isinstance(row.payload, dict):
        return {}
    return dict(row.payload)


def _save_blob(db: Session, name: str, payload: dict) -> None:
    row = db.get(TableBlob, name)
    if row is None:
        db.add(TableBlob(name=name, payload=payload))
    else:
        row.payload = payload
    db.flush()
