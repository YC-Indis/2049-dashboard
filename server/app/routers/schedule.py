from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_session
from ..schemas.workspace import ScheduleBlockPatch, ScheduleBlockUpsert
from ..services import workspace as svc

router = APIRouter(prefix="/schedule-blocks", tags=["schedule"])


def _block_dict(row) -> dict:
    return {
        "id": row.id,
        "projectId": row.project_id,
        "projectName": row.project_name,
        "title": row.title,
        "type": row.type,
        "start": row.start,
        "end": row.end,
        "note": row.note,
        "source": row.source,
        "owner": row.owner,
        "status": row.status,
        "done": row.done,
        "target": row.target,
        "lane": row.lane,
    }


@router.get("")
def list_blocks(project_id: str | None = None, db: Session = Depends(get_session)) -> list[dict]:
    return [_block_dict(row) for row in svc.list_blocks(db, project_id=project_id)]


@router.put("")
def upsert_block(body: ScheduleBlockUpsert, db: Session = Depends(get_session)) -> dict:
    """KPI 同步块会带着幂等 id 反复推过来，所以用 PUT 而不是 POST。"""
    return _block_dict(svc.upsert_block(db, body))


@router.patch("/{block_id}")
def patch_block(
    block_id: str, body: ScheduleBlockPatch, db: Session = Depends(get_session)
) -> dict:
    return _block_dict(svc.patch_block(db, block_id, body))


@router.delete("/{block_id}")
def delete_block(block_id: str, db: Session = Depends(get_session)) -> dict:
    svc.remove_block(db, block_id)
    return {"ok": True}
