"""模型访问层。

对外只暴露 chat / chat_stream 两个函数，OpenAI 和 Anthropic 的请求体差异在这里
抹平。工具调用统一按 OpenAI 的 tool_calls 形状交出去，Anthropic 那边的
tool_use 块会转换成同一形状，编排层不需要知道当前接的是谁。
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

import httpx

from ..config import get_settings
from ..errors import CredentialMissing, UpstreamUnavailable

log = logging.getLogger("dojo.llm")

TIMEOUT = httpx.Timeout(120.0, connect=10.0)


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict[str, Any] = field(default_factory=dict)


@dataclass
class LlmResult:
    content: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    # 模型自报的名字，前端拿去显示「由 xx 回答」
    model: str = ""

    @property
    def wants_tools(self) -> bool:
        return bool(self.tool_calls)


def _settings_or_fail():
    settings = get_settings()
    if not settings.llm_api_key:
        raise CredentialMissing("服务端未配置 DOJO_LLM_API_KEY")
    return settings


def _parse_arguments(raw: Any) -> dict[str, Any]:
    """模型偶尔会把参数塞成字符串，甚至带上 markdown 围栏。"""
    if isinstance(raw, dict):
        return raw
    if not isinstance(raw, str) or not raw.strip():
        return {}
    text = raw.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        log.warning("工具参数不是合法 JSON，按空参数处理：%s", text[:200])
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _openai_body(
    settings, messages: list[dict], tools: list[dict] | None, stream: bool
) -> dict:
    body: dict[str, Any] = {
        "model": settings.llm_model,
        "messages": messages,
        "temperature": 0.4,
        "stream": stream,
    }
    if tools:
        body["tools"] = tools
        body["tool_choice"] = "auto"
    return body


def _anthropic_body(settings, messages: list[dict], tools: list[dict] | None, stream: bool) -> dict:
    system = ""
    turns: list[dict] = []
    for item in messages:
        if item["role"] == "system":
            system = item["content"]
        else:
            turns.append(item)

    body: dict[str, Any] = {
        "model": settings.llm_model,
        "max_tokens": 4096,
        "system": system,
        "messages": turns,
        "stream": stream,
    }
    if tools:
        # OpenAI 的 {type:function, function:{...}} 要摊平成 Anthropic 的形状
        body["tools"] = [
            {
                "name": t["function"]["name"],
                "description": t["function"]["description"],
                "input_schema": t["function"]["parameters"],
            }
            for t in tools
        ]
    return body


def _endpoint(settings) -> tuple[str, dict[str, str]]:
    base = settings.llm_base_url.rstrip("/")
    if settings.llm_style == "anthropic":
        return f"{base}/v1/messages", {
            "x-api-key": settings.llm_api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
    return f"{base}/v1/chat/completions", {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "content-type": "application/json",
    }


async def chat(messages: list[dict], tools: list[dict] | None = None) -> LlmResult:
    settings = _settings_or_fail()
    url, headers = _endpoint(settings)
    body = (
        _anthropic_body(settings, messages, tools, False)
        if settings.llm_style == "anthropic"
        else _openai_body(settings, messages, tools, False)
    )

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        try:
            res = await client.post(url, headers=headers, json=body)
        except httpx.HTTPError as exc:
            raise UpstreamUnavailable(f"模型请求失败：{exc}") from exc

    if res.status_code >= 400:
        raise UpstreamUnavailable(f"模型返回 {res.status_code}：{res.text[:300]}")

    payload = res.json()
    if settings.llm_style == "anthropic":
        return _read_anthropic(payload)
    return _read_openai(payload)


def _read_openai(payload: dict) -> LlmResult:
    choice = (payload.get("choices") or [{}])[0]
    message = choice.get("message") or {}
    calls = [
        ToolCall(
            id=item.get("id") or f"call_{index}",
            name=(item.get("function") or {}).get("name", ""),
            arguments=_parse_arguments((item.get("function") or {}).get("arguments")),
        )
        for index, item in enumerate(message.get("tool_calls") or [])
    ]
    return LlmResult(
        content=message.get("content") or "",
        tool_calls=[c for c in calls if c.name],
        model=payload.get("model", ""),
    )


def _read_anthropic(payload: dict) -> LlmResult:
    text_parts: list[str] = []
    calls: list[ToolCall] = []
    for block in payload.get("content") or []:
        kind = block.get("type")
        if kind == "text":
            text_parts.append(block.get("text", ""))
        elif kind == "tool_use":
            calls.append(
                ToolCall(
                    id=block.get("id", ""),
                    name=block.get("name", ""),
                    arguments=block.get("input") or {},
                )
            )
    return LlmResult(
        content="".join(text_parts),
        tool_calls=calls,
        model=payload.get("model", ""),
    )


async def chat_stream(messages: list[dict]) -> AsyncIterator[str]:
    """纯文本流式。

    只在「确定不会再调工具」的收尾回合用：工具调用的增量拼接在各家实现里差异
    很大，为一点响应速度把编排搞复杂不划算。
    """
    settings = _settings_or_fail()
    url, headers = _endpoint(settings)
    body = (
        _anthropic_body(settings, messages, None, True)
        if settings.llm_style == "anthropic"
        else _openai_body(settings, messages, None, True)
    )

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        async with client.stream("POST", url, headers=headers, json=body) as res:
            if res.status_code >= 400:
                detail = (await res.aread()).decode("utf-8", "ignore")
                raise UpstreamUnavailable(f"模型返回 {res.status_code}：{detail[:300]}")

            async for line in res.aiter_lines():
                if not line.startswith("data:"):
                    continue
                chunk = line[5:].strip()
                if not chunk or chunk == "[DONE]":
                    continue
                try:
                    event = json.loads(chunk)
                except json.JSONDecodeError:
                    continue

                piece = (
                    _anthropic_delta(event)
                    if settings.llm_style == "anthropic"
                    else _openai_delta(event)
                )
                if piece:
                    yield piece


def _openai_delta(event: dict) -> str:
    choices = event.get("choices") or []
    if not choices:
        return ""
    return (choices[0].get("delta") or {}).get("content") or ""


def _anthropic_delta(event: dict) -> str:
    if event.get("type") != "content_block_delta":
        return ""
    return (event.get("delta") or {}).get("text") or ""
