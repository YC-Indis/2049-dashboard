"""SixNine49 的工具表。

这张表取代了原先前端 useDojoAgentChat 里那一大堆正则。正则的问题不是写得不好，
是「新建个项目吧」和「帮我把项目新建一下」这种同义说法穷举不完，漏一个用户就
觉得它变笨了。改成工具之后由模型负责理解，这里只负责声明「有哪些能力、每个
能力要什么参数」。

mode 决定拿到调用之后怎么办：
    READ  —— 直接查库，结果回灌给模型继续组织语言
    WRITE —— 一律不执行，转成待确认动作交给前端，等用户点确认

WRITE 绝不自动执行，这是 AGENTS.md 里写死的规矩，不因为模型「看起来很确定」
而放宽。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

Mode = Literal["read", "write"]

# 项目参数的统一说明。反复出现，抽出来免得各处措辞不一致，模型会被带偏。
PROJECT_HINT = (
    "项目名称或别名，必须是用户在对话里明确点名的。"
    "界面上当前选中的项目不算点名。如果用户没提项目名，就把这个参数留空，"
    "由系统列出候选让用户选，不要自己猜一个填进来。"
)


@dataclass(frozen=True)
class Tool:
    name: str
    mode: Mode
    description: str
    parameters: dict[str, Any]
    # 写操作在前端确认卡片上显示的一句话，{} 里填参数名
    confirm: str = ""

    def as_openai(self) -> dict:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


def _obj(properties: dict, required: list[str] | None = None) -> dict:
    return {
        "type": "object",
        "properties": properties,
        "required": required or [],
    }


STR = {"type": "string"}
INT = {"type": "integer"}


READ_TOOLS: list[Tool] = [
    Tool(
        name="list_projects",
        mode="read",
        description="列出工作台里的全部项目，含周期、优先级和运行状态。用户问「有几个项目」「都有什么项目」时用。",
        parameters=_obj({"activeOnly": {"type": "boolean", "description": "只看进行中的"}}),
    ),
    Tool(
        name="project_progress",
        mode="read",
        description="查一个或全部项目的 KPI 目标与当前完成量，含各环节进度百分比。用户问「进度怎么样」时用。",
        parameters=_obj({"project": {**STR, "description": PROJECT_HINT + " 留空表示看所有项目。"}}),
    ),
    Tool(
        name="account_overview",
        mode="read",
        description=(
            "账号矩阵运营概况：总数、已同步数、总粉丝、播放最高的视频、"
            "从未同步和同步失败的号。用户问「账号运营怎么样」「哪个号播放最好」"
            "「有没有停滞的号」时用。"
        ),
        parameters=_obj({}),
    ),
    Tool(
        name="list_schedule",
        mode="read",
        description="查排期。可以按项目筛，也可以只看今天的或已逾期的。",
        parameters=_obj(
            {
                "project": {**STR, "description": PROJECT_HINT + " 留空表示不限项目。"},
                "scope": {
                    "type": "string",
                    "enum": ["all", "today", "overdue", "unassigned"],
                    "description": "unassigned 指还没排日期的",
                },
            }
        ),
    ),
    Tool(
        name="list_library",
        mode="read",
        description="查内容库存：灵感库、脚本库、对标账号库、采集线索。用户问「灵感库里有什么」这类时用。",
        parameters=_obj(
            {
                "kind": {
                    "type": "string",
                    "enum": ["inspiration", "script", "benchmark", "source"],
                }
            },
            ["kind"],
        ),
    ),
]


WRITE_TOOLS: list[Tool] = [
    Tool(
        name="create_project",
        mode="write",
        description=(
            "新建项目。注意区分「新建项目」和「在某个项目下新建任务」——"
            "用户说「加个任务」时要用 create_task，不要用这个。"
            "参数不全时不要瞎填默认值，缺哪项就问哪项。"
        ),
        parameters=_obj(
            {
                "name": {**STR, "description": "项目名称"},
                "region": {**STR, "description": "投放地区，如 美国、巴西、东南亚"},
                "cycleStart": {**STR, "description": "周期开始日，YYYY-MM-DD"},
                "cycleEnd": {**STR, "description": "周期结束日，YYYY-MM-DD"},
                "accounts": {**INT, "description": "目标账号数"},
                "videos": {**INT, "description": "目标视频数"},
                "exposure": {**INT, "description": "目标曝光量，用户说「50万」要换算成 500000"},
                "scripts": {**INT, "description": "脚本总目标数，不是每个账号的数量"},
                "owner": {**STR, "description": "负责人"},
            },
            ["name"],
        ),
        confirm="新建项目「{name}」",
    ),
    Tool(
        name="create_task",
        mode="write",
        description="在某个项目下新建一条排期任务。",
        parameters=_obj(
            {
                "project": {**STR, "description": PROJECT_HINT},
                "title": {**STR, "description": "任务名称"},
                "date": {**STR, "description": "日期 YYYY-MM-DD；用户说今天/明天要换算成具体日期"},
                "endDate": {**STR, "description": "结束日，跨天任务才需要"},
                "owner": {**STR, "description": "负责人"},
            },
            ["title", "date"],
        ),
        confirm="在「{project}」下新建任务「{title}」（{date}）",
    ),
    Tool(
        name="reschedule",
        mode="write",
        description=(
            "改某个环节或任务的日期。环节指脚本、起号、拍摄、剪辑、分发、投放这六个。"
            "用户说「把投放推迟到下周三」就是这个。"
        ),
        parameters=_obj(
            {
                "project": {**STR, "description": PROJECT_HINT},
                "phase": {
                    "type": "string",
                    "enum": ["脚本", "起号", "拍摄", "剪辑", "分发", "投放"],
                    "description": "要改的环节；改的是自建任务就填 blockId 而不是这个",
                },
                "blockId": {**STR, "description": "排期项 id，改自建任务时用"},
                "start": {**STR, "description": "新的开始日 YYYY-MM-DD"},
                "end": {**STR, "description": "新的结束日 YYYY-MM-DD"},
            },
            ["start"],
        ),
        confirm="把「{project}」的 {phase} 改到 {start} ~ {end}",
    ),
    Tool(
        name="update_project",
        mode="write",
        description=(
            "改项目本身：名称、投放地区、周期起止、负责人、优先级，以及各项目标数。"
            "「把周期延到 12 月底」「目标曝光改成 100 万」都走这个。"
            "注意 target* 是目标值，不是已完成量——用户说「已经发了 40 条」那是 "
            "update_progress，别用这个。只传用户提到的字段。"
        ),
        parameters=_obj(
            {
                "project": {**STR, "description": PROJECT_HINT},
                "name": {**STR, "description": "新名称"},
                "region": {**STR, "description": "新投放地区"},
                "cycleStart": {**STR, "description": "新的周期开始日 YYYY-MM-DD"},
                "cycleEnd": {**STR, "description": "新的周期结束日 YYYY-MM-DD"},
                "owner": {**STR, "description": "负责人"},
                "priority": {
                    "type": "string",
                    "enum": ["high", "medium", "low"],
                    "description": "优先级",
                },
                "targetAccounts": {**INT, "description": "目标账号数"},
                "targetVideos": {**INT, "description": "目标视频数"},
                "targetExposure": {**INT, "description": "目标曝光量，「50万」要换算成 500000"},
                "targetScripts": {**INT, "description": "脚本总目标数"},
            },
            [],
        ),
        confirm="修改项目「{project}」",
    ),
    Tool(
        name="update_progress",
        mode="write",
        description=(
            "更新项目现状数字（已起号数、已写脚本、已成片、已过审、已分发、已获曝光）。"
            "只传用户提到的字段，没提的不要传，传了会把原值覆盖掉。"
        ),
        parameters=_obj(
            {
                "project": {**STR, "description": PROJECT_HINT},
                "accounts": {**INT, "description": "已起号数"},
                "scripts": {**INT, "description": "已完成脚本数"},
                "edited": {**INT, "description": "已成片数"},
                "approved": {**INT, "description": "已过审数"},
                "distributed": {**INT, "description": "已分发视频数"},
                "exposure": {**INT, "description": "已获曝光量"},
            },
            [],
        ),
        confirm="更新「{project}」的现状数字",
    ),
    Tool(
        name="sync_account",
        mode="write",
        description="同步单个 TikTok 账号的粉丝数和作品数据。",
        parameters=_obj({"handle": {**STR, "description": "账号 handle，带不带 @ 都行"}}, ["handle"]),
        confirm="同步账号 {handle}",
    ),
    Tool(
        name="sync_all_accounts",
        mode="write",
        description="批量同步账号。会消耗上游接口配额，数量多时先跟用户说清楚。",
        parameters=_obj({"limit": {**INT, "description": "最多同步几个，默认 50"}}),
        confirm="批量同步 {limit} 个账号",
    ),
    Tool(
        name="create_collection",
        mode="write",
        description=(
            "新建采集线索，按关键词去平台上捞内容。"
            "关键词必须是用户明确给出的独立检索词——绝对不要把当前项目名、"
            "品牌名或竞品品牌自动拼进去。用户说「采集 unboxing」，"
            "检索词就是 unboxing，不是「某某品牌 unboxing」。"
        ),
        parameters=_obj(
            {
                "query": {**STR, "description": "检索词，原样用用户给的词"},
                "name": {**STR, "description": "线索名称，不给就用检索词"},
                "limit": {**INT, "description": "采集条数"},
                "days": {"type": "integer", "enum": [7, 30, 90], "description": "时间窗口"},
            },
            ["query"],
        ),
        confirm="建采集线索「{query}」（近 {days} 天，{limit} 条）",
    ),
    Tool(
        name="create_inspiration",
        mode="write",
        description="往灵感库里手动加一条灵感。",
        parameters=_obj(
            {
                "title": {**STR, "description": "灵感标题"},
                "angle": {**STR, "description": "切入角度"},
                "note": {**STR, "description": "备注"},
            },
            ["title"],
        ),
        confirm="新增灵感「{title}」",
    ),
    Tool(
        name="update_inspiration",
        mode="write",
        description="改灵感库里已有的一条。",
        parameters=_obj(
            {
                "id": {**STR, "description": "灵感 id"},
                "title": {**STR, "description": "新标题"},
                "angle": {**STR, "description": "新角度"},
            },
            ["id"],
        ),
        confirm="修改灵感「{title}」",
    ),
    Tool(
        name="create_script",
        mode="write",
        description="新建一条脚本。",
        parameters=_obj({"title": {**STR, "description": "脚本标题"}}, ["title"]),
        confirm="新建脚本「{title}」",
    ),
    Tool(
        name="add_benchmark",
        mode="write",
        description=(
            "把一个账号加进对标库。只进本机对标库，不会去 TikTok 那边关注对方。"
        ),
        parameters=_obj(
            {
                "handle": {**STR, "description": "对标账号 handle"},
                "note": {**STR, "description": "为什么对标它"},
            },
            ["handle"],
        ),
        confirm="把 {handle} 加进对标库",
    ),
    Tool(
        name="delete_record",
        mode="write",
        description=(
            "删除一条记录。删除不可撤销，确认卡片上要把删的是什么说清楚。"
        ),
        parameters=_obj(
            {
                "kind": {
                    "type": "string",
                    "enum": ["project", "schedule", "inspiration", "script", "source", "benchmark"],
                },
                "id": {**STR, "description": "要删除的记录 id"},
                "title": {**STR, "description": "记录的名称，用于确认时复述"},
            },
            ["kind", "id"],
        ),
        confirm="删除{kind}「{title}」",
    ),
]


ALL_TOOLS: list[Tool] = [*READ_TOOLS, *WRITE_TOOLS]
BY_NAME: dict[str, Tool] = {tool.name: tool for tool in ALL_TOOLS}


def openai_schema() -> list[dict]:
    return [tool.as_openai() for tool in ALL_TOOLS]


def describe(name: str) -> Tool | None:
    return BY_NAME.get(name)


def confirm_text(name: str, args: dict[str, Any]) -> str:
    """把确认模板里的占位符填上。

    缺的参数填「未指定」而不是抛异常——确认卡片是给人看的，
    参数不全的情况本来就该让用户一眼看出来缺什么。
    """
    tool = BY_NAME.get(name)
    if tool is None or not tool.confirm:
        return name
    safe = {key: ("未指定" if value in (None, "") else value) for key, value in args.items()}
    try:
        return tool.confirm.format_map(_Missing(safe))
    except Exception:
        return tool.confirm


class _Missing(dict):
    def __missing__(self, key: str) -> str:
        return "未指定"
