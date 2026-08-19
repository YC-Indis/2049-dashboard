"""前端是 camelCase 的 TS 接口，库里是 snake_case 的列。

映射统一在这里做，别在 router 里手写 dict 转换——之前漏掉一个 clientContact
就查了半天为什么客户对接人一保存就空。
"""

from pydantic import BaseModel, ConfigDict


def to_camel(name: str) -> str:
    head, *rest = name.split("_")
    return head + "".join(word.capitalize() for word in rest)


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )
