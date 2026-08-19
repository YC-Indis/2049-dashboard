"""账号矩阵与视频指标。

account_videos 是全库唯一会到十万行量级的表（账号数 × 每号最多十页视频），
所以它不用 JSON 兜着，老老实实拆列 + 建索引。
"""

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, created_column, updated_column


class MatrixAccount(Base):
    __tablename__ = "accounts"

    # handle 全局唯一，同一个号不允许挂在两个项目下
    handle: Mapped[str] = mapped_column(String(100), primary_key=True)
    project_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    segment: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)
    source: Mapped[str] = mapped_column(String(16), default="manual", nullable=False)
    added_at: Mapped[str] = mapped_column(String(32), default="", nullable=False)
    link: Mapped[str] = mapped_column(Text, default="", nullable=False)
    note: Mapped[str] = mapped_column(Text, default="", nullable=False)

    # 以下整段来自 RapidAPI 同步，不接受人工填写。同步失败时保持上一次的值，
    # 只更新 sync_error，前端据此显示「上次同步于…，本次失败」而不是显示 0。
    nickname: Mapped[str | None] = mapped_column(String(200))
    followers: Mapped[int | None] = mapped_column(Integer)
    following: Mapped[int | None] = mapped_column(Integer)
    total_videos: Mapped[int | None] = mapped_column(Integer)
    total_hearts: Mapped[int | None] = mapped_column(Integer)
    region: Mapped[str | None] = mapped_column(String(16))
    verified: Mapped[bool | None] = mapped_column(Boolean)
    is_private: Mapped[bool | None] = mapped_column(Boolean)
    last_synced_at: Mapped[str | None] = mapped_column(String(32))
    sync_source: Mapped[str | None] = mapped_column(String(16))
    sync_error: Mapped[str | None] = mapped_column(Text)

    created_at = created_column()
    updated_at = updated_column()

    videos: Mapped[list["AccountVideo"]] = relationship(
        back_populates="account",
        cascade="all, delete-orphan",
    )


class AccountVideo(Base):
    __tablename__ = "account_videos"

    # 同一条视频只会属于一个号，(handle, video_id) 做联合主键即可去重
    handle: Mapped[str] = mapped_column(
        String(100), ForeignKey("accounts.handle", ondelete="CASCADE"), primary_key=True
    )
    video_id: Mapped[str] = mapped_column(String(64), primary_key=True)

    video_url: Mapped[str] = mapped_column(Text, default="", nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    publish_date: Mapped[str] = mapped_column(String(32), default="", nullable=False, index=True)
    views: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    likes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    comments: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    shares: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    engagement_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    duration: Mapped[int | None] = mapped_column(Integer)
    cover: Mapped[str | None] = mapped_column(Text)
    is_ad: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    fetched_at = updated_column()

    account: Mapped[MatrixAccount] = relationship(back_populates="videos")


class SyncRun(Base):
    """每次账号同步留一条，用来回答「这个号上次什么时候同步的、失败过几次」。

    没有它的时候只能看 accounts.last_synced_at，成功才更新，连续失败在界面上
    完全看不出来，排查全靠猜。
    """

    __tablename__ = "sync_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    handle: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    ok: Mapped[bool] = mapped_column(Boolean, nullable=False)
    provider: Mapped[str] = mapped_column(String(16), default="rapidapi", nullable=False)
    video_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    message: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict | None] = mapped_column(JSON)

    started_at: Mapped[str | None] = mapped_column(DateTime(timezone=True))
    created_at = created_column()
