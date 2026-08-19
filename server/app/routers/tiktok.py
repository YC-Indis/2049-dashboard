"""前端 src/api/tiktok.ts 已经在调的两个端点，路径和字段都不能改。

它们只回快照，不落库；要入库走 /accounts/{handle}/sync。
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_session
from ..errors import UpstreamUnavailable
from ..services import accounts as account_svc
from ..services import rapidapi

router = APIRouter(prefix="/tiktok", tags=["tiktok"])


class AccountSyncBody(BaseModel):
    handle: str


class VideoSyncBody(BaseModel):
    videoUrl: str


class SearchBody(BaseModel):
    query: str
    cursor: str | None = None


@router.post("/account/sync")
async def account_sync(body: AccountSyncBody) -> dict:
    return await rapidapi.fetch_account_snapshot(body.handle)


@router.post("/video/sync")
async def video_sync(body: VideoSyncBody, db: Session = Depends(get_session)) -> dict:
    """按链接查单条视频的播放/互动。

    上游没有「按 url 查单条」的端点，所以从链接里拆出作者和 video_id，
    拉这个号的作品列表再挑出来。命中不了就报错，不猜数字。
    """
    url = body.videoUrl.strip()
    handle, video_id = _split_video_url(url)
    if not handle or not video_id:
        raise UpstreamUnavailable(f"无法从链接里解析出账号和视频 id：{url}")

    # 先查库，同步过就不必再打上游，省配额
    cached = [v for v in account_svc.list_videos(db, handle) if v.video_id == video_id]
    if cached:
        row = cached[0]
        return {
            "videoUrl": row.video_url,
            "views": row.views,
            "likes": row.likes,
            "comments": row.comments,
            "engagementRate": row.engagement_rate,
            "syncedAt": row.fetched_at.isoformat(),
            "source": "rapidapi",
        }

    videos = await rapidapi.fetch_all_account_videos(handle)
    hit = next((v for v in videos if v["videoId"] == video_id), None)
    if hit is None:
        raise UpstreamUnavailable(f"在 @{handle} 的作品里没找到 {video_id}，可能已删除或设为私密")

    return {
        "videoUrl": hit["videoUrl"],
        "views": hit["views"],
        "likes": hit["likes"],
        "comments": hit["comments"],
        "engagementRate": hit["engagementRate"],
        "syncedAt": rapidapi.now_stamp(),
        "source": "rapidapi",
    }


@router.post("/search")
async def search(body: SearchBody) -> dict:
    return await rapidapi.search_videos(body.query, body.cursor)


def _split_video_url(url: str) -> tuple[str, str]:
    # https://www.tiktok.com/@someone/video/7300000000000000000
    parts = [p for p in url.split("?")[0].split("/") if p]
    handle = ""
    video_id = ""
    for index, part in enumerate(parts):
        if part.startswith("@"):
            handle = part[1:]
        if part == "video" and index + 1 < len(parts):
            video_id = parts[index + 1]
    return handle, video_id
