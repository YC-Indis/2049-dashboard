"""登录校验。

原先登录整个在浏览器里做，口令写死在 api/auth.ts 里。本机自己用无所谓，可一旦
挂到公网，等于把工作台连同全部业务数据敞开。所以把校验挪到服务端。

没上 JWT 库：需要的只是「这串 token 是我签的、还没过期」，标准库的 hmac 够用，
少一个依赖少一处升级负担。令牌是无状态的，服务端不存会话；想让所有人立即掉线，
改一下 DOJO_AUTH_SECRET 重启即可。

DOJO_AUTH_PASSWORD 留空时整个校验不启用，前端继续走本地模式——本机开发和离线
演示不该被登录卡住。
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time

from fastapi import APIRouter, Header

from ..config import get_settings
from ..errors import AuthFailed

router = APIRouter(prefix="/auth", tags=["auth"])

# 用户名到角色的映射。这套工作台只有「能改配置的」和「只管日常执行的」两档，
# 再细的权限没有实际使用场景，多做一层只会让每次加页面都要想一遍归属。
ROLES = {"super": "R_SUPER", "admin": "R_ADMIN"}

# 未配置签名盐时用进程内随机值，重启后旧令牌自然失效
_RUNTIME_SECRET = secrets.token_urlsafe(32)


def _secret() -> bytes:
    return (get_settings().auth_secret or _RUNTIME_SECRET).encode("utf-8")


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def sign_token(user: str, role: str, ttl_hours: int) -> str:
    payload = {"u": user, "r": role, "exp": int(time.time()) + ttl_hours * 3600}
    body = _b64(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = _b64(hmac.new(_secret(), body.encode("ascii"), hashlib.sha256).digest())
    return f"{body}.{sig}"


def verify_token(token: str) -> dict:
    try:
        body, sig = token.split(".", 1)
    except ValueError:
        raise AuthFailed("令牌格式不对")

    expect = _b64(hmac.new(_secret(), body.encode("ascii"), hashlib.sha256).digest())
    # 定长比较，避免按字节提前返回泄露签名前缀
    if not hmac.compare_digest(sig, expect):
        raise AuthFailed("令牌签名不匹配，请重新登录")

    try:
        payload = json.loads(_unb64(body))
    except (ValueError, json.JSONDecodeError):
        raise AuthFailed("令牌内容已损坏")

    if payload.get("exp", 0) < time.time():
        raise AuthFailed("登录已过期，请重新登录")
    return payload


@router.get("/mode")
def auth_mode() -> dict:
    """前端启动时问一句：这个部署要不要走服务端登录。"""
    return {"enabled": get_settings().auth_enabled}


@router.post("/login")
def login(body: dict) -> dict:
    settings = get_settings()
    if not settings.auth_enabled:
        raise AuthFailed("这个部署没有开启服务端登录")

    name = str(body.get("userName") or "").strip().lower()
    password = str(body.get("password") or "")

    role = ROLES.get(name)
    # 用户名错和密码错回同一句话，免得被拿来枚举账号
    if role is None or not hmac.compare_digest(password, settings.auth_password):
        raise AuthFailed("账号或密码错误")

    return {
        "token": sign_token(name, role, settings.auth_ttl_hours),
        "refreshToken": "",
        "role": role,
    }


@router.get("/me")
def me(authorization: str = Header(default="")) -> dict:
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise AuthFailed("缺少登录令牌")

    payload = verify_token(token)
    role = payload.get("r", "R_ADMIN")
    name = payload.get("u", "admin")
    return {
        "userId": 1 if role == "R_SUPER" else 2,
        "userName": name.capitalize(),
        "roles": [role],
        "buttons": ["*"],
        "email": "",
    }
