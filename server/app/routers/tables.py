"""整表读写。

返回体刻意和前端 dojoPersist 的 Envelope 同形（version / savedAt / data），
前端那个文件换实现时不用做字段映射。

表分两类，对前端是透明的：
  - 长尾表直接整包存进 table_blobs
  - 项目/排期/账号这几张走 table_bridge，落到真正的关系表里
"""

import re
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_session
from ..errors import WriteRejected
from ..models import TableBlob
from ..services.table_bridge import ADAPTERS

router = APIRouter(prefix="/tables", tags=["tables"])

# 表名来自前端常量，不该出现路径分隔符之类的东西
NAME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_]{0,63}$")


class TablePayload(BaseModel):
    version: int = 2
    data: Any = Field(default=None)


class TableEnvelope(BaseModel):
    version: int
    savedAt: str | None = None
    data: Any = None


def _check(name: str) -> str:
    if not NAME_RE.match(name):
        raise WriteRejected(f"表名不合法：{name}")
    return name


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("")
def list_tables(full: bool = False, db: Session = Depends(get_session)) -> dict:
    """full=true 时连数据一起给。

    前端启动时要在渲染之前把所有表灌回 localStorage，一张表一个请求的话首屏
    要等二十来个往返。
    """
    out: dict[str, dict] = {}

    for row in db.scalars(select(TableBlob)).all():
        out[row.name] = {
            "version": row.version,
            "savedAt": row.saved_at.isoformat(),
            "data": row.payload if full else None,
        }

    for name, (read, _write) in ADAPTERS.items():
        out[name] = {
            "version": 2,
            "savedAt": _now(),
            "data": read(db) if full else None,
        }

    return {"tables": out}


@router.get("/{name}", response_model=TableEnvelope)
def read_table(name: str, db: Session = Depends(get_session)) -> TableEnvelope:
    key = _check(name)

    adapter = ADAPTERS.get(key)
    if adapter is not None:
        data = adapter[0](db)
        # 关系表没有整表意义上的「保存时间」，给个当前时间让前端的缓存判断能用
        return TableEnvelope(version=2, savedAt=_now(), data=data)

    row = db.get(TableBlob, key)
    if row is None:
        # 没存过不算错，前端会走各自的 fixture 初始化
        return TableEnvelope(version=2, savedAt=None, data=None)
    return TableEnvelope(version=row.version, savedAt=row.saved_at.isoformat(), data=row.payload)


@router.put("/{name}", response_model=TableEnvelope)
def write_table(
    name: str, body: TablePayload, db: Session = Depends(get_session)
) -> TableEnvelope:
    key = _check(name)

    adapter = ADAPTERS.get(key)
    if adapter is not None:
        adapter[1](db, body.data)
        return TableEnvelope(version=2, savedAt=_now(), data=adapter[0](db))

    row = db.get(TableBlob, key)
    if row is None:
        row = TableBlob(name=key, version=body.version, payload=body.data)
        db.add(row)
    else:
        row.version = body.version
        row.payload = body.data
    db.flush()
    return TableEnvelope(version=row.version, savedAt=row.saved_at.isoformat(), data=row.payload)


@router.delete("/{name}")
def drop_table(name: str, db: Session = Depends(get_session)) -> dict:
    key = _check(name)
    if key in ADAPTERS:
        raise WriteRejected(f"{key} 是关系表，要清空请逐条删除")
    row = db.get(TableBlob, key)
    if row is not None:
        db.delete(row)
    return {"ok": True}
