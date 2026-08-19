# Dojo 2049 工作台服务端

FastAPI + SQLite。承担三件前端做不了或不该做的事：

1. **密钥托管**。模型 Key 和 RapidAPI Key 只存在服务端。之前它们随 Vite 配置进了
   浏览器产物，打开 network 面板就能抄走。
2. **Agent 编排**。工具定义、意图理解、写操作的确认与审计都在这里。
3. **数据落盘**。从 localStorage 搬到 SQLite，换台机器数据还在。

## 跑起来

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env    # 然后把 Key 填进去
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

前端 `vite.config.ts` 已经把 `/api/dojo` 转发到 `127.0.0.1:8000`，不用额外配置。
接口文档在 <http://127.0.0.1:8000/docs>。

不填 Key 也能启动：Agent 会走本地兜底（用库里的真实数字回答，但不做语言理解），
账号同步则直接报 `credential_missing`。

## 验证

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q      # 离线，用临时库
.\.venv\Scripts\python.exe scripts\smoke_live.py   # 打真在跑的服务
```

`tests` 覆盖的重点是 AGENTS.md 里那几条硬规则（项目歧义必须追问、检索词不许混
品牌名、取消的动作不能落库），这些不是普通的边界用例，是产品约定，改代码时不要
把它们改绿。

## 数据分两层

不是所有表都做了结构化建模，这是有意的：

| 层 | 内容 | 理由 |
| --- | --- | --- |
| 关系表 | 项目、项目运行态、排期块、账号、账号视频、会话、审计 | 服务端要校验字段、判重名、跨表聚合，Agent 的写操作也大多落在这里 |
| 整表 JSON (`table_blobs`) | 灵感库、榜单、复盘、工作日志等 | 结构还在动，拆成关系表的收益抵不过每次改结构的成本 |

整表那层的接口形状（`version` / `savedAt` / `data`）和前端 `dojoPersist.ts` 完全
一致，前端换实现时不用做字段映射。

## Agent 是怎么跑的

```
用户消息
   ↓
组装快照（服务端查库，不信前端传的业务数字）
   ↓
问模型（带上全部工具定义）
   ↓
   ├─ 要查数据 → 直接执行，结果回灌，再问一轮（最多 4 轮）
   ├─ 要改数据 → 立刻停下，转成待确认动作交给前端
   └─ 给了文本 → 返回
                      ↓
              用户点确认 → POST /agent/confirm → 真正执行 + 写审计
```

写操作永远不会在对话过程中自动执行。这条没有例外，也不因为模型看起来很确定
就放宽——`create_project` 理解错了还能删，`delete_record` 理解错了就没了。

工具表在 `app/services/agent/tools.py`。它取代了前端原先那一大堆意图识别正则：
正则的问题不在于写得糙，而在于「新建个项目吧」和「帮我把项目建一下」这类同义
说法穷举不完，漏一个用户就觉得它变笨了。

## 关于假数据

老版本前端在 RapidAPI 同步失败时，会用 handle 的 hash 拼一个粉丝数返回，界面上
看不出真假。服务端不做这件事：拿不到就抛 `upstream_unavailable`，账号记录保留上
一次同步的数字并标记 `syncError`，前端显示「上次同步于 X，本次失败」。

每次同步在 `sync_runs` 留一行。连续失败因此能在界面上看出来，而不是只能看到一个
不知道哪来的数。

## 目录

```
app/
  config.py             环境变量
  db.py                 SQLite 连接与 PRAGMA
  errors.py             业务异常（按「调用方该怎么办」分类）
  models/               SQLAlchemy 表
  schemas/              Pydantic，负责 camelCase ↔ snake_case
  routers/              HTTP 层，只做校验和序列化
  services/
    workspace.py        项目/排期的业务规则
    accounts.py         账号台账与同步
    rapidapi.py         RapidAPI 访问
    llm.py              模型访问，抹平 OpenAI/Anthropic 差异
    agent/
      tools.py          工具定义
      context.py        快照组装
      executor.py       工具执行
      orchestrator.py   对话编排
```

`routers` 里不写业务规则。Agent 的工具执行器和 HTTP 接口共用 `services`，
两边各写一遍迟早会漂。
