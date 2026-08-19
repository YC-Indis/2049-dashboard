"""项目、项目运行态、排期块。

这三张是唯一做了结构化建模的执行域表，因为 Agent 的写操作绝大多数落在它们身上，
需要服务端能校验字段、判重名、算周期。其余长尾数据走 blobs.TableBlob。
"""

from sqlalchemy import Boolean, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, created_column, updated_column


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    # 匹配投放/分发表格里的各种写法，检索项目时按片段命中
    aliases: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    region: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str | None] = mapped_column(String(64))
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at = created_column()
    updated_at = updated_column()

    runtime: Mapped["ProjectRuntime"] = relationship(
        back_populates="project",
        uselist=False,
        cascade="all, delete-orphan",
    )
    blocks: Mapped[list["ScheduleBlock"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )


class ProjectRuntime(Base):
    """跟项目 1:1。

    kpi / current / todo_meta 保持 JSON 而不是拆列：这几组字段前端还在调整，
    拆成列每改一次就要动表结构，而服务端对它们只做整体读写和数值校验。
    runStatus 不落库，读的时候按周期日期现算。
    """

    __tablename__ = "project_runtime"

    project_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    brand: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    priority: Mapped[str] = mapped_column(String(16), default="medium", nullable=False)
    owner: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    client_contact: Mapped[str] = mapped_column(String(100), default="", nullable=False)

    kpi: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    current: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    todo_meta: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    updated_at = updated_column()

    project: Mapped[Project] = relationship(back_populates="runtime")


class ScheduleBlock(Base):
    """日历 / 时间线共用的日期事项。

    KPI 同步块的 id 由前端按 `KPI-{phase}-{projectId}` 拼，是幂等键，所以主键用
    前端给的字符串而不是自增，重复 upsert 不会长出第二条。
    """

    __tablename__ = "schedule_blocks"

    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    project_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # 冗余一份项目名：前端日历直接渲染，避免每条都回查
    project_name: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    type: Mapped[str] = mapped_column(String(24), default="task", nullable=False)
    start: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    end: Mapped[str] = mapped_column(String(10), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(24), default="manual", nullable=False)
    owner: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str | None] = mapped_column(String(32))
    done: Mapped[int | None] = mapped_column(Integer)
    target: Mapped[int | None] = mapped_column(Integer)
    lane: Mapped[int | None] = mapped_column(Integer)

    created_at = created_column()
    updated_at = updated_column()

    project: Mapped[Project] = relationship(back_populates="blocks")
