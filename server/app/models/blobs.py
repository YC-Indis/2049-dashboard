"""长尾表的整表存储。

前端 dojoPersist 的形状是「一张表一个 key、整表读写」。灵感库、榜单、复盘、
工作日志这些结构还在动，拆成关系表的收益抵不上每次改结构的成本，所以照原样
整包存 JSON，由前端保持既有的读写语义。

需要服务端参与校验或跨表查询的（项目、排期、账号），才升格成真正的表。
"""

from sqlalchemy import Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, updated_column


class TableBlob(Base):
    __tablename__ = "table_blobs"

    name: Mapped[str] = mapped_column(String(100), primary_key=True)
    # 对齐前端 dojoPersist 的 SCHEMA_VERSION，对不上时按「没有数据」处理
    version: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    payload: Mapped[object] = mapped_column(JSON, nullable=False)

    saved_at = updated_column()
