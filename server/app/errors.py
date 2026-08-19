"""业务异常。

分类的依据是「调用方拿到之后该怎么办」，不是「哪里出错了」：
    CredentialMissing / UpstreamUnavailable -> 降级，走本地兜底并告诉用户原因
    ToolArgumentMissing / ProjectAmbiguous  -> 不降级，回头追问用户
    RecordNotFound / WriteRejected          -> 直接拒绝，前端提示

Agent 编排里就是按这三组分支处理的，所以别再往里塞语义不明的通用异常。
"""

from typing import Any


class DojoError(Exception):
    """所有可预期的业务失败都从这里继承，未继承的一律当 500 处理。"""

    status_code = 400
    code = "dojo_error"

    def __init__(self, message: str, **extra: Any) -> None:
        super().__init__(message)
        self.message = message
        self.extra = extra

    def payload(self) -> dict[str, Any]:
        body: dict[str, Any] = {"code": self.code, "message": self.message}
        if self.extra:
            body.update(self.extra)
        return body


class CredentialMissing(DojoError):
    """没配 Key。属于部署问题，不是用户操作问题，文案要区分开。"""

    status_code = 503
    code = "credential_missing"


class UpstreamUnavailable(DojoError):
    """上游（模型 / RapidAPI）连不上或返回了非 2xx。"""

    status_code = 502
    code = "upstream_unavailable"


class RecordNotFound(DojoError):
    status_code = 404
    code = "record_not_found"


class ToolArgumentMissing(DojoError):
    """模型给的工具参数不全。missing 里放字段名，前端据此组织追问。"""

    status_code = 422
    code = "tool_argument_missing"

    def __init__(self, message: str, missing: list[str]) -> None:
        super().__init__(message, missing=missing)
        self.missing = missing


class ProjectAmbiguous(DojoError):
    """项目级写操作没点名，且候选不止一个。

    对应 AGENTS.md 那条硬规则：不允许默认写进当前选中项，必须列候选再问。
    candidates 直接给前端渲染成可点选项。
    """

    status_code = 409
    code = "project_ambiguous"

    def __init__(self, message: str, candidates: list[dict[str, str]]) -> None:
        super().__init__(message, candidates=candidates)
        self.candidates = candidates


class WriteRejected(DojoError):
    """校验没过的写操作，例如把周期结束日填到开始日之前。"""

    status_code = 422
    code = "write_rejected"
