"""账号台账与同步。

同步的成败要留痕：成功刷新指标，失败只写 sync_error 并保留上一次的数字，
再往 sync_runs 记一条。界面上因此能说清「这个号的粉丝数是 3 天前那次同步的，
今天失败了」，而不是含糊地显示一个不知道哪来的数。
"""

from __future__ import annotations

import logging

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..errors import DojoError, RecordNotFound
from ..models import AccountVideo, MatrixAccount, SyncRun
from . import rapidapi
from .workspace import get_project

log = logging.getLogger("dojo.accounts")


def normalize_handle(handle: str) -> str:
    clean = rapidapi.strip_handle(handle)
    if not clean:
        raise RecordNotFound("账号 handle 不能为空")
    return f"@{clean}"


def list_accounts(db: Session, *, project_id: str | None = None) -> list[MatrixAccount]:
    stmt = select(MatrixAccount).order_by(MatrixAccount.added_at.desc())
    if project_id:
        stmt = stmt.where(MatrixAccount.project_id == project_id)
    return list(db.scalars(stmt).all())


def get_account(db: Session, handle: str) -> MatrixAccount:
    row = db.get(MatrixAccount, normalize_handle(handle))
    if row is None:
        raise RecordNotFound(f"账号不在台账里：{handle}")
    return row


def upsert_account(db: Session, payload: dict) -> MatrixAccount:
    handle = normalize_handle(payload.get("handle", ""))
    project_id = payload.get("projectId") or payload.get("project_id")
    if not project_id:
        raise RecordNotFound("新增账号必须指定所属项目")
    get_project(db, project_id)

    row = db.get(MatrixAccount, handle)
    if row is None:
        row = MatrixAccount(handle=handle, project_id=project_id)
        db.add(row)

    row.project_id = project_id
    for field, key in (
        ("segment", "segment"),
        ("status", "status"),
        ("source", "source"),
        ("added_at", "addedAt"),
        ("link", "link"),
        ("note", "note"),
    ):
        if key in payload and payload[key] is not None:
            setattr(row, field, payload[key])

    if not row.added_at:
        row.added_at = rapidapi.now_stamp()[:10]
    if not row.link:
        row.link = f"https://www.tiktok.com/{handle}"

    db.flush()
    return row


def remove_account(db: Session, handle: str) -> None:
    db.delete(get_account(db, handle))


def account_dict(row: MatrixAccount) -> dict:
    return {
        "handle": row.handle,
        "projectId": row.project_id,
        "segment": row.segment,
        "status": row.status,
        "source": row.source,
        "addedAt": row.added_at,
        "link": row.link,
        "note": row.note,
        "nickname": row.nickname,
        "followers": row.followers,
        "following": row.following,
        "totalVideos": row.total_videos,
        "totalHearts": row.total_hearts,
        "region": row.region,
        "verified": row.verified,
        "isPrivate": row.is_private,
        "lastSyncedAt": row.last_synced_at,
        "syncSource": row.sync_source,
        "syncError": row.sync_error,
    }


def video_dict(row: AccountVideo) -> dict:
    return {
        "videoId": row.video_id,
        "videoUrl": row.video_url,
        "handle": row.handle,
        "description": row.description,
        "publishDate": row.publish_date,
        "views": row.views,
        "likes": row.likes,
        "comments": row.comments,
        "shares": row.shares,
        "engagementRate": row.engagement_rate,
        "duration": row.duration,
        "cover": row.cover,
        "isAd": row.is_ad,
    }


def list_videos(db: Session, handle: str, limit: int | None = None) -> list[AccountVideo]:
    stmt = (
        select(AccountVideo)
        .where(AccountVideo.handle == normalize_handle(handle))
        .order_by(AccountVideo.publish_date.desc())
    )
    if limit:
        stmt = stmt.limit(limit)
    return list(db.scalars(stmt).all())


def _store_videos(db: Session, handle: str, videos: list[dict]) -> int:
    """整号覆盖。

    增量合并看着更省事，但上游删过的视频会永远留在库里，播放量统计跟着虚高。
    一个号最多几百条，全删重写代价可以接受。
    """
    db.execute(delete(AccountVideo).where(AccountVideo.handle == handle))
    for item in videos:
        if not item.get("videoId"):
            continue
        db.add(
            AccountVideo(
                handle=handle,
                video_id=item["videoId"],
                video_url=item.get("videoUrl", ""),
                description=item.get("description", ""),
                publish_date=item.get("publishDate", ""),
                views=item.get("views", 0),
                likes=item.get("likes", 0),
                comments=item.get("comments", 0),
                shares=item.get("shares", 0),
                engagement_rate=item.get("engagementRate", 0.0),
                duration=item.get("duration"),
                cover=item.get("cover"),
                is_ad=bool(item.get("isAd")),
            )
        )
    db.flush()
    return len(videos)


async def sync_account(db: Session, handle: str, *, with_videos: bool = True) -> dict:
    """同步单个账号。

    只要拿不到快照就整条判失败——半成功（有粉丝数没作品）会让「停滞账号」
    的判断出错，那个判断依赖最后发布时间。
    """
    key = normalize_handle(handle)
    row = db.get(MatrixAccount, key)

    try:
        snapshot = await rapidapi.fetch_account_snapshot(key)
    except DojoError as exc:
        if row is not None:
            row.sync_error = exc.message
            row.sync_source = None
        db.add(SyncRun(handle=key, ok=False, message=exc.message))
        db.flush()
        raise

    videos: list[dict] = []
    if with_videos:
        try:
            videos = await rapidapi.fetch_all_account_videos(key)
        except DojoError as exc:
            # 作品拉失败不影响账号资料入库，但要留痕，不能悄悄当成 0 条
            log.warning("账号 %s 资料已更新，作品列表拉取失败：%s", key, exc.message)

    if row is None:
        # Agent 直接同步一个还没进台账的号时，先落一条占位记录
        row = MatrixAccount(handle=key, project_id="", status="pending", source="manual")
        db.add(row)

    row.nickname = snapshot.get("nickname") or row.nickname
    row.followers = snapshot.get("followers")
    row.following = snapshot.get("following")
    row.total_hearts = snapshot.get("likes")
    row.total_videos = snapshot.get("posts") or (len(videos) if videos else row.total_videos)
    row.region = snapshot.get("region") or row.region
    row.verified = snapshot.get("verified")
    row.is_private = snapshot.get("isPrivate")
    row.last_synced_at = snapshot.get("syncedAt")
    row.sync_source = "rapidapi"
    row.sync_error = None

    stored = _store_videos(db, key, videos) if videos else 0
    db.add(SyncRun(handle=key, ok=True, video_count=stored, payload=snapshot))
    db.flush()

    return {"account": account_dict(row), "videoCount": stored, "snapshot": snapshot}


async def sync_many(db: Session, handles: list[str]) -> dict:
    """批量同步。

    单个号失败不中断整批，最后把失败清单一起交回去，前端据此逐条标红。
    """
    done: list[str] = []
    failed: list[dict] = []

    for handle in handles:
        try:
            await sync_account(db, handle)
            done.append(normalize_handle(handle))
        except DojoError as exc:
            failed.append({"handle": handle, "message": exc.message})
        except Exception as exc:  # 上游偶发的解析异常，不该拖垮整批
            log.exception("同步 %s 时出现未预期错误", handle)
            failed.append({"handle": handle, "message": str(exc)})

    return {"ok": len(done), "failed": failed, "synced": done}


def account_overview(db: Session) -> dict:
    """给 Agent 回答「账号运营怎么样」用的聚合。"""
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

    best = db.scalars(
        select(AccountVideo).order_by(AccountVideo.views.desc()).limit(5)
    ).all()
    never = db.scalars(
        select(MatrixAccount.handle).where(MatrixAccount.last_synced_at.is_(None)).limit(20)
    ).all()
    failing = db.scalars(
        select(MatrixAccount.handle).where(MatrixAccount.sync_error.is_not(None)).limit(20)
    ).all()

    return {
        "total": total,
        "synced": synced,
        "totalFollowers": int(followers),
        "neverSynced": list(never),
        "syncFailing": list(failing),
        "topVideos": [video_dict(v) for v in best],
    }
