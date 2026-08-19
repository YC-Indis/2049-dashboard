import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .db import init_db
from .errors import DojoError
from .routers import accounts, agent, auth, health, projects, schedule, tables, tiktok

log = logging.getLogger("dojo")

# 前端 vite 把 /api/dojo 整段转发过来且不做 rewrite，所以前缀必须原样带上
API_PREFIX = "/api/dojo"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    settings = get_settings()
    if not settings.llm_ready:
        log.warning("DOJO_LLM_API_KEY 未配置，Agent 只能走本地兜底")
    if not settings.rapidapi_ready:
        log.warning("RAPIDAPI_KEY 未配置，账号同步不可用")
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Dojo 2049 工作台服务端",
        version="1.0.0",
        docs_url="/docs",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(DojoError)
    async def _business_error(_request: Request, exc: DojoError):
        # 业务失败是预期内的，按各自的 status_code 回，不打 traceback
        return JSONResponse(status_code=exc.status_code, content=exc.payload())

    for router in (
        health.router,
        auth.router,
        tables.router,
        projects.router,
        schedule.router,
        accounts.router,
        tiktok.router,
        agent.router,
    ):
        app.include_router(router, prefix=API_PREFIX)

    return app


app = create_app()
