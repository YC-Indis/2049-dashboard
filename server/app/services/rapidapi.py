"""RapidAPI（TikTok）访问层。

两条硬规矩：

1. Key 只在这里出现。之前它随 vite 配置进了浏览器，任何人打开 network 面板
   就能抄走，这次搬到服务端。
2. 拿不到数据就抛 UpstreamUnavailable，绝不编数字。老版本在同步失败时会用
   handle 的 hash 拼一个「粉丝数」返回，界面上看不出真假，运营照着这个数
   做过判断——这类兜底比直接报错危害大得多。
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from ..config import get_settings
from ..errors import CredentialMissing, UpstreamUnavailable

log = logging.getLogger("dojo.rapidapi")

TIMEOUT = httpx.Timeout(20.0, connect=8.0)


def strip_handle(handle: str) -> str:
    return (handle or "").strip().lstrip("@")


def now_stamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _client() -> httpx.AsyncClient:
    settings = get_settings()
    if not settings.rapidapi_key:
        raise CredentialMissing("未配置 RAPIDAPI_KEY，账号同步不可用")
    return httpx.AsyncClient(
        base_url=f"https://{settings.rapidapi_host}",
        headers={
            "x-rapidapi-key": settings.rapidapi_key,
            "x-rapidapi-host": settings.rapidapi_host,
        },
        timeout=TIMEOUT,
    )


async def _get(path: str, params: dict[str, Any] | None = None) -> dict:
    async with _client() as client:
        try:
            res = await client.get(path, params=params)
        except httpx.HTTPError as exc:
            raise UpstreamUnavailable(f"RapidAPI 请求失败：{exc}") from exc

    if res.status_code == 429:
        raise UpstreamUnavailable("RapidAPI 触发限流，稍后再同步")
    if res.status_code >= 400:
        raise UpstreamUnavailable(f"RapidAPI 返回 {res.status_code}")
    try:
        return res.json()
    except ValueError as exc:
        raise UpstreamUnavailable("RapidAPI 返回的不是 JSON") from exc


def _dig(payload: Any, *names: str) -> Any:
    """RapidAPI 同一个字段在不同端点里叫法不一样，挨个试。"""
    if not isinstance(payload, dict):
        return None
    for name in names:
        if name in payload and payload[name] is not None:
            return payload[name]
    return None


def _as_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str) and value.strip().isdigit():
        return int(value.strip())
    return None


def normalize_user_details(payload: Any, fallback_handle: str) -> dict | None:
    """把 /user/details 的各种嵌套形状压平成账号快照。

    followers 取不到就返回 None：这是判断「这次同步到底成没成」的唯一依据，
    宁可整条判失败，也不要一个粉丝数为 0 的假账号进库。
    """
    root = payload if isinstance(payload, dict) else None
    if root is None:
        return None

    data = _dig(root, "data") or root
    user = _dig(data, "user", "userInfo", "user_info") or data
    stats = _dig(user, "stats", "statistics") or _dig(data, "stats", "statistics") or user

    followers = _as_int(
        _dig(user, "followers", "follower_count", "followerCount")
        or _dig(stats, "followers", "follower_count", "followerCount")
        or _dig(data, "followers", "follower_count")
    )
    if followers is None:
        return None

    username = (
        _dig(user, "username", "unique_id", "uniqueId")
        or _dig(data, "username")
        or _dig(root, "username")
        or fallback_handle
    )

    return {
        "handle": f"@{str(username).lstrip('@')}",
        "followers": followers,
        "following": _as_int(
            _dig(user, "following", "following_count", "followingCount")
            or _dig(stats, "following", "following_count", "followingCount")
        ),
        "likes": _as_int(
            _dig(user, "hearts", "total_heart", "heartCount")
            or _dig(stats, "hearts", "total_heart", "heartCount", "likes")
        ),
        "posts": _as_int(
            _dig(user, "videos", "video_count", "videoCount")
            or _dig(stats, "videos", "video_count", "videoCount")
        ),
        "nickname": _dig(user, "nickname", "nick_name", "display_name"),
        "region": _dig(user, "region", "country", "cc"),
        "verified": bool(_dig(user, "verified", "is_verified") or False),
        "isPrivate": bool(_dig(user, "is_private", "privateAccount") or False),
        "bioLink": _dig(user, "bio_link", "bioLink"),
        "syncedAt": now_stamp(),
        "source": "rapidapi",
    }


async def fetch_account_snapshot(handle: str) -> dict:
    clean = strip_handle(handle)
    if not clean:
        raise UpstreamUnavailable("账号 handle 为空")

    payload = await _get("/user/details", {"username": clean})
    snapshot = normalize_user_details(payload, clean)
    if snapshot is None:
        # 私密号、改名号、封号都会走到这里，错误文案要能区分于「网络不通」
        raise UpstreamUnavailable(f"RapidAPI 没有返回 @{clean} 的粉丝数，可能是私密号或已改名")
    return snapshot


def _normalize_video(raw: dict, fallback_author: str) -> dict:
    author = raw.get("author") or fallback_author
    stats = raw.get("statistics") or {}
    plays = _as_int(stats.get("number_of_plays")) or 0
    likes = _as_int(stats.get("number_of_hearts")) or 0
    comments = _as_int(stats.get("number_of_comments")) or 0
    shares = _as_int(stats.get("number_of_reposts")) or 0

    created = raw.get("create_time")
    publish_date = ""
    if isinstance(created, (int, float)) and created > 0:
        publish_date = datetime.fromtimestamp(created, tz=timezone.utc).date().isoformat()

    video_id = str(raw.get("video_id") or "")
    return {
        "videoId": video_id,
        "videoUrl": f"https://www.tiktok.com/@{author}/video/{video_id}",
        "handle": f"@{author}",
        "description": raw.get("description") or "",
        "publishDate": publish_date,
        "views": plays,
        "likes": likes,
        "comments": comments,
        "shares": shares,
        "engagementRate": (likes + comments + shares) / plays if plays > 0 else 0.0,
        "duration": _as_int(raw.get("duration")),
        "cover": raw.get("cover"),
        "isAd": bool(raw.get("is_ad")),
    }


async def fetch_account_videos(handle: str, continuation: str | None = None) -> dict:
    clean = strip_handle(handle)
    params: dict[str, Any] = {"username": clean}
    if continuation:
        params["continuation_token"] = continuation

    payload = await _get("/user/videos", params)
    raw_videos = payload.get("videos") if isinstance(payload, dict) else None
    videos = [
        _normalize_video(item, clean)
        for item in (raw_videos or [])
        if isinstance(item, dict) and item.get("video_id")
    ]
    return {
        "handle": f"@{clean}",
        "videos": videos,
        "continuationToken": payload.get("continuation_token") if isinstance(payload, dict) else None,
    }


async def fetch_all_account_videos(handle: str, max_pages: int = 10) -> list[dict]:
    """翻页拉完一个号的作品。

    max_pages 不是性能考虑，是防御：上游偶尔会返回一个始终不变的游标，
    不设上限就会在这里空转到超时。
    """
    collected: list[dict] = []
    seen: set[str] = set()
    token: str | None = None

    for _ in range(max_pages):
        page = await fetch_account_videos(handle, token)
        fresh = [v for v in page["videos"] if v["videoId"] not in seen]
        if not fresh:
            break
        collected.extend(fresh)
        seen.update(v["videoId"] for v in fresh)

        next_token = page.get("continuationToken")
        if not next_token or next_token == token:
            break
        token = next_token

    return collected


async def search_videos(query: str, cursor: str | None = None) -> dict:
    """灵感采集用的关键词检索。"""
    if not query.strip():
        raise UpstreamUnavailable("检索词为空")
    params: dict[str, Any] = {"keyword": query}
    if cursor:
        params["cursor"] = cursor
    return await _get("/search/videos/query", params)
