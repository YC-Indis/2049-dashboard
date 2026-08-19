from typing import Literal

from pydantic import Field

from .common import CamelModel

Priority = Literal["high", "medium", "low"]
BlockType = Literal["script", "publish", "ad", "milestone", "other", "task"]
BlockSource = Literal["timeline", "calendar", "distribution", "manual"]


class ProjectKpi(CamelModel):
    cycle_start: str = ""
    cycle_end: str = ""
    accounts: int = 0
    videos: int = 0
    exposure: int = 0
    # 脚本是项目总目标，不按账号均分。旧数据里的 scriptsPerAccount 只读不写。
    scripts: int = 0
    scripts_per_account: int | None = None


class ProjectCurrent(CamelModel):
    accounts: int = 0
    scripts: int = 0
    edited: int = 0
    approved: int = 0
    distributed: int = 0
    exposure: int = 0


class ProjectRuntimeOut(CamelModel):
    project_id: str
    brand: str = ""
    priority: Priority = "medium"
    # 由周期日期现算，不落库
    run_status: str = ""
    owner: str = ""
    client_contact: str = ""
    kpi: ProjectKpi = Field(default_factory=ProjectKpi)
    current: ProjectCurrent = Field(default_factory=ProjectCurrent)
    todo_meta: dict = Field(default_factory=dict)


class ProjectOut(CamelModel):
    id: str
    name: str
    aliases: list[str] = Field(default_factory=list)
    region: str | None = None
    status: str | None = None
    active: bool = True


class ProjectDetail(ProjectOut):
    runtime: ProjectRuntimeOut | None = None


class ProjectCreate(CamelModel):
    name: str
    brand: str | None = None
    region: str | None = None
    priority: Priority = "medium"
    cycle_start: str | None = None
    cycle_end: str | None = None
    aliases: list[str] = Field(default_factory=list)
    owner: str | None = None
    client_contact: str | None = None
    kpi: ProjectKpi | None = None


class ProjectPatch(CamelModel):
    name: str | None = None
    region: str | None = None
    status: str | None = None
    active: bool | None = None
    aliases: list[str] | None = None


class RuntimePatch(CamelModel):
    brand: str | None = None
    priority: Priority | None = None
    owner: str | None = None
    client_contact: str | None = None
    kpi: ProjectKpi | None = None
    current: ProjectCurrent | None = None
    # 只覆盖传进来的键，不整包替换
    current_patch: dict[str, int] | None = None
    todo_meta: dict | None = None


class ScheduleBlockOut(CamelModel):
    id: str
    project_id: str
    project_name: str = ""
    title: str
    type: BlockType = "task"
    start: str
    end: str
    note: str | None = None
    source: BlockSource = "manual"
    owner: str | None = None
    status: str | None = None
    done: int | None = None
    target: int | None = None
    lane: int | None = None


class ScheduleBlockUpsert(CamelModel):
    # KPI 块自带幂等 id；用户新建的任务不传，服务端生成
    id: str | None = None
    project_id: str
    project_name: str | None = None
    title: str
    type: BlockType = "task"
    start: str
    end: str
    note: str | None = None
    source: BlockSource = "manual"
    owner: str | None = None
    status: str | None = None
    done: int | None = None
    target: int | None = None
    lane: int | None = None


class ScheduleBlockPatch(CamelModel):
    title: str | None = None
    start: str | None = None
    end: str | None = None
    note: str | None = None
    owner: str | None = None
    status: str | None = None
    done: int | None = None
    target: int | None = None
    lane: int | None = None
