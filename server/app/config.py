"""运行期配置。

环境变量名沿用 docker-compose 与 nginx 模板里已经在用的那套（RAPIDAPI_KEY /
RAPIDAPI_HOST），业务相关的新变量统一加 DOJO_ 前缀。两套前缀混在一起，所以这里
逐个写 alias，而不是图省事用 env_prefix。
"""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    data_dir: Path = Field(default=Path("./data"), alias="DOJO_DATA_DIR")
    cors_origins: str = Field(
        default="http://localhost:3006,http://127.0.0.1:3006",
        alias="DOJO_CORS_ORIGINS",
    )

    llm_base_url: str = Field(default="https://api.deepseek.com", alias="DOJO_LLM_BASE_URL")
    llm_api_key: str = Field(default="", alias="DOJO_LLM_API_KEY")
    llm_model: str = Field(default="deepseek-chat", alias="DOJO_LLM_MODEL")
    llm_style: str = Field(default="openai", alias="DOJO_LLM_STYLE")

    rapidapi_key: str = Field(default="", alias="RAPIDAPI_KEY")
    rapidapi_host: str = Field(default="tiktok-api6.p.rapidapi.com", alias="RAPIDAPI_HOST")

    # 留空表示不启用服务端登录校验，前端沿用本地模式。公网部署必须填。
    auth_password: str = Field(default="", alias="DOJO_AUTH_PASSWORD")
    # 签发令牌用的签名盐。不填则每次启动随机生成，重启即失效，只适合本机。
    auth_secret: str = Field(default="", alias="DOJO_AUTH_SECRET")
    auth_ttl_hours: int = Field(default=72, alias="DOJO_AUTH_TTL_HOURS")

    @property
    def origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def sqlite_path(self) -> Path:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        return self.data_dir / "dojo.db"

    @property
    def llm_ready(self) -> bool:
        return bool(self.llm_api_key)

    @property
    def rapidapi_ready(self) -> bool:
        return bool(self.rapidapi_key)

    @property
    def auth_enabled(self) -> bool:
        return bool(self.auth_password)


@lru_cache
def get_settings() -> Settings:
    return Settings()
