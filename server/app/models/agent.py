"""SixNine49 的会话、待确认动作与执行审计。

会话之前只存在 localStorage 里，换台机器就没了，待确认动作也一样。搬到服务端
之后顺带补了 tool_calls 审计——软著和排查都需要能说清「哪一句话改了哪张表」。
"""

from sqlalchemy import Boolean, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, created_column, updated_column


class AgentSession(Base):
    __tablename__ = "agent_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    # 悬浮窗和椭圆按钮的坐标，刷新后要回到原位
    panel: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    # 等用户点确认的那个动作，同一时刻最多一个
    pending: Mapped[dict | None] = mapped_column(JSON)

    created_at = created_column()
    updated_at = updated_column()

    messages: Mapped[list["AgentMessage"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="AgentMessage.seq",
    )


class AgentMessage(Base):
    __tablename__ = "agent_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("agent_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # 会话内自增序号。用主键排序在并发写入时会乱，单独留一列由服务端算
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, default="", nullable=False)
    sources: Mapped[list | None] = mapped_column(JSON)
    memory_hint: Mapped[str | None] = mapped_column(String(300))

    created_at = created_column()

    session: Mapped[AgentSession] = relationship(back_populates="messages")


class ToolCallAudit(Base):
    """一次工具调用的完整记录：模型提了什么、用户确认没有、执行结果如何。

    confirmed 为 False 且 executed 为 False 的行是被用户取消的提议，保留不删，
    否则没法解释「我明明让它建了项目怎么没建」。
    """

    __tablename__ = "tool_call_audits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    tool: Mapped[str] = mapped_column(String(64), nullable=False)
    arguments: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    executed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ok: Mapped[bool | None] = mapped_column(Boolean)
    result: Mapped[dict | None] = mapped_column(JSON)
    error: Mapped[str | None] = mapped_column(Text)

    created_at = created_column()
    settled_at = updated_column()
