from fastapi import APIRouter

from ..config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    """前端启动时探一次，据此决定走服务端还是留在 localStorage 单机模式。"""
    settings = get_settings()
    return {
        "ok": True,
        "llm": settings.llm_ready,
        "rapidapi": settings.rapidapi_ready,
    }
