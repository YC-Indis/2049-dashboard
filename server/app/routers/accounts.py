from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import get_session
from ..services import accounts as svc

router = APIRouter(prefix="/accounts", tags=["accounts"])


class AccountUpsert(BaseModel):
    handle: str
    projectId: str
    segment: str | None = None
    status: str | None = None
    source: str | None = None
    addedAt: str | None = None
    link: str | None = None
    note: str | None = None


class SyncRequest(BaseModel):
    handles: list[str] = Field(default_factory=list)
    # 不传 handles 时同步全部；limit 用来兜住一次点「同步全部」打爆配额
    all: bool = False
    limit: int = 50


@router.get("")
def list_accounts(project_id: str | None = None, db: Session = Depends(get_session)) -> list[dict]:
    return [svc.account_dict(row) for row in svc.list_accounts(db, project_id=project_id)]


@router.get("/overview")
def overview(db: Session = Depends(get_session)) -> dict:
    return svc.account_overview(db)


@router.put("")
def upsert_account(body: AccountUpsert, db: Session = Depends(get_session)) -> dict:
    return svc.account_dict(svc.upsert_account(db, body.model_dump()))


@router.delete("/{handle}")
def delete_account(handle: str, db: Session = Depends(get_session)) -> dict:
    svc.remove_account(db, handle)
    return {"ok": True}


@router.get("/{handle}/videos")
def account_videos(
    handle: str, limit: int | None = None, db: Session = Depends(get_session)
) -> list[dict]:
    return [svc.video_dict(row) for row in svc.list_videos(db, handle, limit)]


@router.post("/{handle}/sync")
async def sync_one(handle: str, db: Session = Depends(get_session)) -> dict:
    return await svc.sync_account(db, handle)


@router.post("/sync")
async def sync_batch(body: SyncRequest, db: Session = Depends(get_session)) -> dict:
    handles = body.handles
    if body.all or not handles:
        handles = [row.handle for row in svc.list_accounts(db)][: body.limit]
    return await svc.sync_many(db, handles)
