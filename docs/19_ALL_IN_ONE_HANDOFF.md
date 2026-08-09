# Dojo｜完整单文件交接文档
> 本文件汇总完整交接包。各独立文件仍是首选阅读方式。


---

# 文件：00_START_HERE.md

# Dojo｜Codex 完整开发交接包 V5

## 1. 项目名称

产品名称：

```text
Dojo
```

现有技术与业务能力来源：

```text
YC-Indis/Velix
```

Velix 即原 BatterySee AI。

唯一前端视觉与组件基准：

```text
Daymychen/art-design-pro
```

## 2. 一句话定义

Dojo 是一个以 TikTok 海外矩阵运营为第一业务场景的 AI 协作中控台。

它把项目目标、周计划、今日任务、日历、脚本、素材、账号、发布、数据、检索、周报和知识沉淀串成一条工作流，并由全局 Agent 帮用户导航、检索、拆解计划、执行操作和持续复盘。

## 3. 技术分工

### Art Design Pro

负责：

- 新 Dojo 前端应用壳
- Sidebar、Topbar、Tabs
- 主题、布局和响应式
- 卡片、表格、表单、抽屉
- 图表容器
- Calendar 基础
- 通知、弹窗和页面交互
- 统一视觉系统

### Velix

负责：

- FastAPI
- SQLite
- DeepSeek
- Agent 既有表达方式
- RAG
- Memory
- TikTok RapidAPI
- 内容监测与数据能力
- 已有后端业务逻辑

### Plane

只作为后续可选集成：

- 通用团队任务
- 成员
- 周期
- 状态
- 评论

Dojo 第一版不能依赖 Plane 才能运行。

## 4. 前端实施方式

不要把 Art Design Pro 的样式零散复制进 Velix 原前端。

采用并行迁移：

```text
YC-Indis/Velix
├─ server/                 # 保留并扩展 FastAPI
├─ src/                    # 原 Velix 前端，迁移期保留
└─ dojo-web/               # 基于 Art Design Pro 的新 Dojo 前端
```

第一阶段：

1. 保留原 Velix 前端可运行。
2. 在 `dojo-web/` 初始化 Art Design Pro。
3. 清理示例业务。
4. 接入 Velix FastAPI。
5. 跑通 Dojo 纵向闭环。
6. 新前端稳定后，再决定是否移除旧前端。

## 5. 强制原则

1. 第一版只做 TikTok。
2. 第一版只接 DeepSeek。
3. 使用用户现有 RapidAPI TikTok 套餐。
4. Dojo Agent 是全局入口，不属于某一页面。
5. 写入型 Agent 操作必须先预览、再确认。
6. 播放量、完成率、预测等指标由代码计算，AI 只负责解释。
7. 自动采集与手动计划必须并存。
8. 每周生成不可变快照。
9. AI 提取的经验先进入候选区，用户确认后才成为正式规则。
10. 前端只采用 Art Design Pro 一套设计体系。
11. 不再使用此前自制的 UI 原型。
12. 不混合 Plane、Notion、ClickUp 等多套 UI 风格。
13. 不把新逻辑继续全部堆进 `server/main.py`。
14. 不提交 API Key、数据库和客户敏感数据。

## 6. 文档阅读顺序

1. `01_PRODUCT_PRD.md`
2. `02_VELIX_REUSE_AUDIT.md`
3. `03_SYSTEM_ARCHITECTURE.md`
4. `04_GLOBAL_AGENT_ARCHITECTURE.md`
5. `05_TIKTOK_DATA_PLAN.md`
6. `06_WORKFLOW_AND_PAGES.md`
7. `07_METRICS_AND_REPORTS.md`
8. `08_MEMORY_AND_COEVOLUTION.md`
9. `09_API_CONTRACT.md`
10. `10_DATABASE_SCHEMA.sql`
11. `11_MVP_VERTICAL_SLICE.md`
12. `12_TEST_DATA_PLAN.md`
13. `13_AGENT_EXAMPLES.md`
14. `15_ART_DESIGN_PRO_ADOPTION.md`
15. `16_DOJO_UI_PAGE_MAPPING.md`
16. `17_CODEX_UI_IMPLEMENTATION_PROMPT.md`
17. `18_DELIVERY_AND_ACCEPTANCE.md`
18. `19_ALL_IN_ONE_HANDOFF.md`
19. `14_CODEX_MASTER_PROMPT.md`

## 7. 参考文件

`references/` 中保存客户给出的项目、日历、目标表和周报截图。

这些截图只用于理解：

- 客户当前业务信息
- 页面需要包含哪些字段
- 原有工作流程
- 报表结构

不得把截图的视觉作为 Dojo UI 基准。

## 8. 明天交给 Codex

首选直接发送：

```text
14_CODEX_MASTER_PROMPT.md
```

并把整个文件夹放在 Velix 仓库或 Codex 工作目录中。

如 Codex 无法逐份读取，则发送：

```text
19_ALL_IN_ONE_HANDOFF.md
```


---

# 文件：01_PRODUCT_PRD.md

# PRD｜Dojo

## 1. 产品定位

Dojo 不是一个单纯的任务管理器，也不是给现有 Excel 套一个好看的皮。

它要把海外 TikTok 矩阵团队目前散落在 Google Docs、Excel、脚本链接、素材文件夹、群聊和口头汇报里的工作，变成一个可以直接执行、追踪和复盘的系统。

完整闭环：

```text
项目目标
→ 周期与批次
→ 周计划
→ 今日任务
→ 脚本与素材
→ 账号与发布
→ TikTok 数据采集
→ 目标进度与预测
→ AI 分析与复盘
→ 自动生成后续行动
→ 反哺下一轮脚本、拍摄、剪辑、分发与投放
```

## 2. 核心用户

### 项目管理者

需要回答：

- 项目距离目标还有多少？
- 按现在速度能不能完成？
- 本周计划多少，实际完成多少？
- 卡在哪个环节？
- 哪个成员或客户审核环节需要跟进？
- 哪些内容值得继续复制？
- 今天应该优先处理什么？

### 执行成员

需要回答：

- 我今天具体做什么？
- 这个任务的上游材料在哪里？
- 脚本、素材、成片和审核要求是什么？
- 当前任务为什么被阻塞？
- 完成后交给谁？
- 我的本周任务是否有延期风险？

### 新用户

不需要先理解所有菜单。

他可以直接问 Agent：

- 这个系统怎么用？
- Xros 6 项目现在到哪了？
- 今天我应该做什么？
- 帮我找第四周所有待审核脚本。
- 帮我把这段项目要求拆成计划。
- 给我总结上周做得好和不好的地方。

## 3. 第一版范围

只做：

- TikTok
- DeepSeek
- 用户现有 RapidAPI TikTok 套餐
- 项目、批次、周计划、今日任务
- 脚本与内容生产
- 账号矩阵
- 发布记录和数据快照
- 日历
- 统一检索
- 全局 Agent
- 周报与复盘
- AI 记忆与规则沉淀

暂不做：

- YouTube、X、Instagram、LinkedIn
- 多模型路由
- 自动投放
- 员工截屏、键鼠和隐形监控
- 复杂 CRM
- 薪资绩效
- 完整财务管理
- 原生移动 App
- 全量 Fork Plane

## 4. 业务对象

```text
Workspace
└─ Project 项目
   ├─ Batch 批次
   ├─ Weekly Plan 周计划
   ├─ Task 任务
   ├─ Script 脚本
   ├─ Content Item 内容条目
   │  └─ Publication 发布实例
   │     └─ Metric Snapshot 数据快照
   ├─ TikTok Account 账号
   ├─ Report 报告
   ├─ Action Item 行动项
   └─ Memory / Rule 记忆与规则
```

## 5. Dojo 的核心能力

### 5.1 项目目标

支持：

- 总播放量目标
- 内容数量目标
- 账号数量目标
- 周期
- 每周目标
- 实际值
- 剩余目标
- 预计结案值
- 风险提示

### 5.2 今日任务

“今日任务”不是人工再写一遍。

系统从以下内容生成：

- 今日截止任务
- 已逾期任务
- 被上游阻塞的任务
- 本周目标缺口
- 账号长期未更新
- 待审核内容
- 报告生成或复盘任务

Agent 再把仪表盘上的短任务扩写成可执行步骤。

### 5.3 日历

一个日历同时容纳：

- 内容生产截止日期
- 客户审核节点
- TikTok 发布日期
- 周计划里程碑
- 报告日期
- 复盘日期

支持按项目、负责人、账号、状态和任务类型筛选。

### 5.4 脚本

脚本不是一个普通文本框。

每份脚本关联：

- 项目
- 批次
- 选题
- 产品
- 国家
- 语言
- 目标账号
- Hook
- 正文
- CTA
- 版本
- 审核状态
- 素材要求
- 成片
- 发布实例
- 最终数据
- 复盘结论

### 5.5 统一检索

检索范围：

- 项目
- 批次
- 周计划
- 任务
- 脚本
- 账号
- TikTok 帖子
- 报告
- 历史复盘
- 可复用规则
- Velix 监测内容

用户可以通过搜索框或 Agent 查询。

### 5.6 每周复盘

每周固定生成一个不可变快照，然后生成报告：

- 项目目标和实际
- 本周计划和实际
- 内容生产进度
- 账号表现
- Top 内容
- 低表现内容
- 做得好的地方
- 做得不好的地方
- 原因和证据
- 下一周行动
- 候选规则和候选记忆

用户确认后：

- 行动项进入任务系统
- 规则进入知识库
- 项目记忆得到更新


---

# 文件：02_VELIX_REUSE_AUDIT.md

# Velix 复用审计

## 1. 已存在的能力

现有 Velix 已经不是空壳，Dojo 不应重复开发以下基础。

### 前端应用壳

现有 `src/App.vue` 已经具备：

- 全局 Sidebar
- 全局 ChatBar
- 多页面切换
- 页面级上下文
- 最近对话历史
- 帖子上下文
- API 健康状态
- 采集任务 watcher

### Agent 前端

现有调用链：

```text
ChatBar
→ App.vue / onChatSend
→ chatLlm('agent', ...)
→ /api/v1/llm/chat
```

现状限制：

- 对话按当前页面保存
- 只保存在 sessionStorage
- 最近只传 8 轮
- Agent 主要做问答，没有可靠的业务工具调用
- 无法创建计划、任务、报告或修改对象
- 无统一工作区上下文

### DeepSeek

后端已经具备：

- DeepSeek API Key
- 模型与 Base URL 配置
- OpenAI 兼容的 Chat Completions 请求
- 超时与错误处理
- 多场景 Prompt
- 人性化中文风格约束
- 模型连接测试

第一版 Dojo 只保留一个 DeepSeek 配置入口，不需要先做多模型产品化。

### RAG 与记忆

后端已经具备：

- 从监测帖子中检索相关内容
- 给来源编号
- 基于来源回答
- memories 表
- 增删改查记忆
- 在 Agent System Prompt 中注入记忆

现状限制：

- 记忆没有项目、成员、来源和置信度层级
- 没有候选记忆与确认流程
- 没有周快照
- 没有脚本和运营数据 RAG
- 没有记忆版本和审计

### TikTok RapidAPI

现有 `server/collector.py` 已经具备：

- TikTok RapidAPI 配置
- Keyword 搜索
- TikTok 内容标准化
- 播放、点赞、评论、分享字段
- 错误和额度异常提示
- 与其他平台统一的采集入口

现状限制：

- 当前重点是热点搜索，不是账号矩阵运营
- 没有账号详情采集
- 没有账号作品列表同步
- 没有单条发布实例的周期数据快照
- 没有增量同步
- 没有把数据关联到项目、账号和脚本

## 2. 代码改造原则

### 保留

- `src/styles/variables.scss`
- `src/styles/global.scss`
- `AppSidebar`
- `ChatBar` 的视觉与基础交互
- `src/api/llm.ts`
- DeepSeek 请求封装
- `HUMAN_STYLE`
- RAG 来源展示
- Settings 中的 API 配置
- TikTok RapidAPI 基础请求和标准化思路
- SQLite
- FastAPI
- ECharts

### 改造

- Chat 从 page-scoped 改为 workspace / project scoped
- sessionStorage 对话升级为数据库会话
- `scene` 升级为 Agent Intent 与 Tool Run
- RAG 扩展到 Dojo 全业务数据
- memory 扩展为分层记忆
- TikTok collector 拆成 Provider Adapter
- 现有单文件后端逐步拆成模块

### 不要第一轮做

- 重写前端框架
- 改成 React / Next.js
- 重做所有旧页面
- 删除 Velix 功能
- 直接把所有逻辑继续堆进 `server/main.py`
- 在 Agent 中直接执行未经确认的批量写入

## 3. 推荐目录增量

```text
src/
├─ dojo/
│  ├─ api/
│  ├─ components/
│  ├─ pages/
│  ├─ stores/
│  ├─ types/
│  └─ agent/
server/
├─ dojo/
│  ├─ router.py
│  ├─ models.py
│  ├─ schemas.py
│  ├─ repositories/
│  ├─ services/
│  ├─ metrics/
│  ├─ agent/
│  ├─ tiktok/
│  ├─ reports/
│  └─ migrations/
```

第一轮可以继续使用现有 `currentPage + PageId` 页面机制，避免同时引入 Vue Router 和业务重构。等纵向闭环跑通后再评估路由迁移。


---

# 文件：03_SYSTEM_ARCHITECTURE.md

# Dojo 系统架构

## 1. 总体架构

```text
┌───────────────────────────────────────────────────┐
│ Dojo Web｜Vue 3 + TypeScript + Vite               │
│ Dashboard / Today / Calendar / Scripts / Search   │
│ Accounts / Reports / Global Agent                 │
└────────────────────────┬──────────────────────────┘
                         │ Dojo API
┌────────────────────────▼──────────────────────────┐
│ FastAPI                                            │
│                                                   │
│ Dojo Domain Service                               │
│ Agent Orchestrator                                │
│ Metrics Engine                                    │
│ Report Engine                                     │
│ TikTok Provider Adapter                           │
│ Search / RAG                                      │
│ Memory Service                                    │
└────────────┬──────────────┬───────────────┬───────┘
             │              │               │
             ▼              ▼               ▼
        SQLite          DeepSeek       TikTok RapidAPI
             │
             ▼
        Optional Plane Adapter
```

## 2. Plane 的位置

Plane 不是 Dojo 的产品界面。

可使用 Plane 承担：

- 通用任务
- 成员
- 状态
- 周期
- 任务评论

Dojo 自己保存：

- 项目播放目标
- 批次
- 周计划数量
- 脚本
- TikTok 账号
- 发布实例
- 数据快照
- 指标
- 报告
- AI 记忆
- 内容规则

第一轮 Plane 可以做成可关闭 Adapter。

即使 Plane 没有配置，Dojo 的本地业务闭环也必须可以运行。

## 3. 自动与手动数据

### 自动

- TikTok 账号基本数据
- 帖子基本信息
- 播放量
- 点赞
- 评论
- 分享
- 发布时间
- 数据同步时间
- 项目指标计算
- 今日任务候选
- 周报指标部分

### 手动

- 项目目标
- 每周计划数量
- 客户要求
- 负责人
- 脚本内容
- 审核状态
- 素材和成片链接
- 账号阶段
- API 不支持的数据
- 人工纠错

### Agent 辅助录入

用户可以使用自然语言批量生成：

- 项目
- 批次
- 周计划
- 任务
- 负责人
- 依赖
- 风险规则

流程：

```text
用户描述
→ DeepSeek 结构化草案
→ 后端校验
→ 界面预览
→ 用户修改
→ 确认写入
→ 记录 Agent Run
```

## 4. DeepSeek 使用方式

只有一个模型也足够完成 MVP。

建议分两类调用：

### 自然语言调用

用于：

- 用户问答
- 总结
- 周报说明
- 脚本建议
- 解释数据

### 结构化调用

用于：

- 意图识别
- 任务拆解
- 工具选择
- 计划生成
- 行动项生成
- 记忆候选提取

结构化调用必须要求 JSON，并经过 Pydantic 校验。

不要把未经校验的模型 JSON 直接写入数据库。


---

# 文件：04_GLOBAL_AGENT_ARCHITECTURE.md

# 全局 Agent 架构

## 1. Agent 的角色

Dojo Agent 同时承担五种角色：

1. 导游：告诉新用户系统怎么用。
2. 检索入口：跨页面查找项目、任务、脚本、账号、帖子和报告。
3. 执行助手：创建、拆解和更新计划与任务。
4. 工作解释器：把仪表盘上的数字展开成具体行动。
5. 复盘伙伴：总结经验、提出建议并沉淀记忆。

它不是某个页面里的小功能。

## 2. 入口

Agent 应在所有页面可用：

- 底部 ChatBar
- 右侧抽屉
- 全局快捷键
- 页面选中对象后的“问 Agent”
- 今日任务卡的“展开为行动计划”
- 周报页面的“生成后续行动”

第一版可以继续复用 Velix 的 ChatBar，但必须升级为全局工作区会话。

## 3. Agent 上下文

每次请求由服务端组装：

```json
{
  "workspace": {},
  "user": {},
  "current_page": {},
  "selected_object": {},
  "active_project": {},
  "today": {},
  "recent_actions": [],
  "project_memory": [],
  "relevant_records": [],
  "permissions": []
}
```

前端只传当前页面和选中对象 ID。

核心业务上下文由服务端查询，避免让前端拼装大量不可信上下文。

## 4. 意图

第一版支持：

- `help`
- `navigate`
- `search`
- `explain`
- `today_plan`
- `create_plan`
- `create_tasks`
- `update_task`
- `generate_script`
- `analyze_project`
- `generate_weekly_review`
- `save_memory_candidate`

## 5. 工具

### 查询工具

- `search_all`
- `get_project_dashboard`
- `get_today_tasks`
- `get_weekly_plan`
- `get_task_detail`
- `get_script`
- `get_account`
- `get_publication_metrics`
- `get_report`
- `get_memory`
- `get_data_quality`

### 写入工具

- `draft_project`
- `draft_weekly_plan`
- `draft_tasks`
- `create_tasks`
- `update_task`
- `assign_task`
- `create_script_draft`
- `create_action_items`
- `save_memory_candidate`
- `confirm_memory`

### 系统工具

- `navigate_to`
- `open_object`
- `sync_tiktok`
- `generate_report`
- `export_report`

## 6. 工具调用流程

DeepSeek 不直接碰数据库。

```text
用户消息
→ Intent Planner
→ 返回结构化 Tool Plan
→ 后端校验权限与参数
→ 查询工具直接执行
→ 写入工具生成 Preview
→ 用户确认
→ 执行写入
→ DeepSeek 总结结果
→ 记录 Agent Run 与审计日志
```

### Tool Plan 示例

```json
{
  "intent": "create_plan",
  "reason": "用户提供了完整项目目标与周期",
  "tool_calls": [
    {
      "tool": "draft_project",
      "arguments": {
        "name": "Xros 6 UK",
        "target_views": 2600000
      }
    },
    {
      "tool": "draft_weekly_plan",
      "arguments": {}
    }
  ],
  "requires_confirmation": true
}
```

## 7. 今日任务解释

仪表盘只需要显示简洁任务：

> 完成第四周 5 条待修改脚本。

用户问 Agent：

> 这项今天具体怎么做？

Agent 应结合任务、审核意见、脚本版本和截止时间回答：

```text
今天先处理 5 条退回脚本，不要继续写新脚本。

1. 09:30 前汇总客户的 3 类共性修改。
2. 先改编号 041、043，它们明天进入剪辑。
3. 编号 044 缺产品卖点依据，先向 Lucas 确认。
4. 改完后统一提交审核，不要逐条零散发送。
5. 16:00 前确认至少 3 条通过，否则会影响周五发布计划。
```

## 8. 导游能力

系统要维护一份功能地图：

- 每个页面做什么
- 常见任务入口
- 字段含义
- 数据来源
- 同步时间
- Agent 能执行什么
- Agent 不能执行什么

Agent 回答“怎么用”时从功能地图检索，不靠模型猜。

## 9. 权限和确认

必须二次确认：

- 批量创建任务
- 批量修改日期
- 修改项目目标
- 修改负责人
- 删除对象
- 同步到 Plane
- 保存正式周报
- 将候选规则升级为正式规则

普通查询不需要确认。


---

# 文件：05_TIKTOK_DATA_PLAN.md

# TikTok 数据接入计划

## 1. 第一版只做 TikTok

不要保留“表面支持四个平台、实际都没做深”的产品结构。

Dojo V1 所有字段、筛选和报告先围绕 TikTok 做完整。

## 2. 现有能力与新增能力

### Velix 已有

- TikTok 关键词搜索
- RapidAPI 请求
- 帖子标题与链接
- 作者
- 发布时间
- 播放、点赞、评论、分享
- 采集错误提示

### Dojo 需要新增

- 按账号获取资料
- 获取账号作品列表
- 获取单条帖子详情
- 项目账号绑定
- 内容与发布实例绑定
- 数据快照
- 增量同步
- 数据质量
- 失败重试
- 手动校正

## 3. Provider Adapter

不要把某个 RapidAPI endpoint 写进业务服务。

```python
class TikTokProvider:
    async def search_posts(self, query, limit): ...
    async def get_account(self, account_ref): ...
    async def list_account_posts(self, account_ref, cursor, limit): ...
    async def get_post(self, post_ref): ...
```

具体 endpoint 由用户当前订阅的 RapidAPI 套餐决定。

Codex 第一步必须先读取现有 `.env.example`、collector 和用户提供的 RapidAPI 文档或调用样例，再实现真实字段映射。

## 4. 测试数据计划

用户可提供约 1000 条 TikTok 数据进行测试。

建议组成：

```text
20 个账号
× 每个账号约 50 条内容
= 约 1000 条发布记录
```

保留：

- 原始 API JSON
- 标准化账号
- 标准化帖子
- 首次指标快照
- 项目和内容关联

## 5. 配额控制

用户现有额度约 50,000，当前使用不足 10%。

测试阶段不要无节制轮询。

建议：

### 首次导入

- 读取约 1000 条历史作品
- 写入初始快照
- 不对历史内容反复请求

### 增量同步

- 每个账号只拉最近作品
- 对近 30 天内容每天刷新
- 30—90 天内容每周刷新
- 90 天以上默认停止刷新
- 手动标记的重点内容可单独刷新

### 配额记录

每次调用记录：

- provider
- endpoint
- object
- 请求时间
- 是否成功
- 返回数量
- 估算或实际消耗
- 错误
- 重试次数

## 6. 快照

不能只保留“当前播放量”。

```text
publication_id
captured_at
views
likes
comments
shares
favorites
source
raw_json
```

这样可以计算：

- 本周新增播放量
- 发布后第 1、3、7 天表现
- 增长速度
- 内容生命周期
- 项目结案预测

## 7. 数据质量

页面必须明确显示：

- 最后同步时间
- 失败账号
- 缺失字段
- 手动校正数量
- 是否使用缓存
- 数据是否完整

AI 报告不得把缺失数据描述成确定结论。


---

# 文件：06_WORKFLOW_AND_PAGES.md

# 页面与工作流

## 1. 左侧导航

```text
今日
项目
日历
内容生产
脚本库
账号矩阵
TikTok 检索
数据中心
周报复盘
知识与规则
系统设置
```

全局 Agent 不占一个普通菜单页面，它始终存在。

## 2. 今日

展示：

- 我今天的任务
- 已逾期
- 待审核
- 阻塞
- 本周目标缺口
- 今日发布
- 需要同步的数据
- AI 今日建议

每张任务卡支持：

- 查看详情
- 标记完成
- 调整日期
- 问 Agent
- 打开关联脚本 / 内容 / 账号

## 3. 项目驾驶舱

展示：

- 总播放目标
- 当前播放
- 完成率
- 预计结案
- 所需周速度
- 近 7 日速度
- 剩余周期
- 周计划 / 实际
- 内容漏斗
- 账号阶段
- 风险
- AI 摘要

## 4. 日历

支持：

- 月 / 周
- 任务截止
- 审核节点
- 发布
- 周报
- 复盘
- 拖拽调整
- 冲突和空档提示

## 5. 内容生产

看板状态：

```text
灵感
→ 脚本中
→ 待审核
→ 已通过
→ 待素材
→ 剪辑中
→ 待成片审核
→ 可分发
→ 已发布
→ 待复盘
→ 完成
```

## 6. 脚本库

支持：

- 脚本正文
- 版本
- 审核意见
- AI 修改建议
- 素材要求
- 关联成片
- 关联帖子
- 数据表现
- 复盘结论
- 一键复制为新脚本

## 7. 账号矩阵

支持：

- 待创建
- 养号
- 稳定运营
- 放量
- 暂停
- 结案

展示：

- 最近发布
- 近 7 日发布量
- 近 7 日播放量
- 累计播放
- 异常
- 负责人
- 同步时间

## 8. TikTok 检索

复用 Velix 内容检索和 RAG。

增加：

- 保存为选题
- 关联项目
- 转为脚本任务
- 加入参考内容
- Agent 总结共同特征

## 9. 周报复盘

结构：

- 目标与实际
- 本周完成
- 数据表现
- 做得好的
- 做得不好的
- 原因
- 下周行动
- 候选规则
- 候选记忆

## 10. 知识与规则

分类：

- 项目事实
- 客户要求
- 内容规则
- 脚本经验
- 拍摄经验
- 剪辑经验
- 分发经验
- 投放经验
- 失败教训
- 用户偏好

显示：

- 来源
- 置信度
- 生效项目
- 创建方式
- 是否由用户确认
- 最后复核时间


---

# 文件：07_METRICS_AND_REPORTS.md

# 指标与报告

## 1. 确定性指标

AI 不负责算以下数字：

- 项目完成率
- 剩余目标
- 近 7 日新增播放
- 要求周速度
- 预计结案
- 周计划完成率
- 任务延期率
- 内容生产漏斗
- 账号阶段分布
- 单条内容播放
- 内容中位播放
- 发布命中率

这些由后端代码计算并测试。

## 2. 项目指标

```text
完成率 = 当前累计播放 / 目标播放
剩余目标 = 目标播放 - 当前累计播放
要求周速度 = 剩余目标 / 剩余周数
预计结案 = 当前累计 + 近7日日均新增 × 剩余天数
```

预测模型第一版保持简单可解释。

## 3. 内容指标

- 一条内容跨多个账号的总播放
- 单次分发平均播放
- 单次分发中位播放
- 发布后 1 / 3 / 7 天播放
- 互动率
- 是否达到项目阈值
- 不同 Hook / 类型 / 账号的差异

## 4. 周报生成流程

```text
冻结周快照
→ 后端计算指标
→ 检索本周任务、脚本、帖子和历史报告
→ DeepSeek 解释
→ 生成行动项
→ 用户确认
→ 保存正式报告
→ 更新项目记忆
```

## 5. 周报必须回答

1. 本周发生了什么？
2. 目标完成到哪里？
3. 与计划差多少？
4. 差异出现在哪个环节？
5. 哪些内容表现好？
6. 哪些内容表现差？
7. 哪些结论是事实，哪些是推测？
8. 下周应该具体做什么？
9. 谁负责？
10. 何时完成？

## 6. 反哺生产

报告建议按五类输出：

- 脚本
- 拍摄
- 剪辑
- 分发
- 投放

每条建议必须包含：

- 发现
- 证据
- 建议动作
- 负责人
- 截止时间
- 是否转任务

## 7. 报告产物

支持：

- 系统内报告
- Markdown
- HTML
- 后续 PDF / DOCX
- 行动项
- 可复用规则
- 项目记忆更新


---

# 文件：08_MEMORY_AND_COEVOLUTION.md

# AI 记忆与共同进化

## 1. 目标

Dojo 不只是每周重新生成一次总结。

它需要逐步形成：

- 对项目的理解
- 对客户要求的理解
- 对团队工作方式的理解
- 对高表现内容的理解
- 对失败原因的理解
- 对用户表达和决策偏好的理解

## 2. 五类记忆

### Fact｜事实

例如：

- Xros 6 UK 目标是 260 万播放。
- 客户要求所有脚本先审核再剪辑。

事实来自结构化数据，不应由 AI 随意修改。

### Decision｜决策

例如：

- 第四周不继续扩账号，先解决审核积压。

必须记录决策者和时间。

### Preference｜偏好

例如：

- 周报先给结论，再给数据。
- 脚本不要写成长段落。

### Rule｜规则

例如：

- 产品结果画面应在前 3 秒出现。
- 账号稳定运营后才进入放量阶段。

### Lesson｜经验

例如：

- 批量逐条向客户送审会造成沟通阻塞，应先汇总共性问题。

## 3. 候选记忆

AI 每周可以提出候选记忆，但不能自动全部写成正式知识。

```text
AI 提取候选
→ 展示来源
→ 用户接受 / 修改 / 拒绝
→ 正式入库
```

## 4. 周快照

每周生成不可变快照：

- 项目状态
- 周计划
- 任务状态
- 内容状态
- 账号状态
- 发布指标
- 数据质量
- 当时的规则版本

报告应基于快照，而不是读取以后已经变化的数据。

## 5. 记忆检索

Agent 回答时按范围检索：

1. 当前项目事实
2. 当前客户要求
3. 当前工作流规则
4. 相关历史复盘
5. 用户偏好
6. 通用内容经验

不应把其他客户的敏感规则默认混入当前项目。

## 6. 共同进化循环

```text
用户设定目标
→ AI 拆解
→ 团队执行
→ 系统记录
→ AI 复盘
→ 用户判断
→ 形成新规则
→ 下一轮 Agent 使用新规则
```

AI 的价值不是替用户作最终决定，而是让每一轮经验不再丢失。


---

# 文件：09_API_CONTRACT.md

# API Contract

统一前缀：

```text
/api/dojo
```

## 1. 全局 Agent

### POST `/agent/chat`

```json
{
  "session_id": "optional",
  "message": "Xros 6 项目今天该做什么？",
  "current_page": "today",
  "active_project_id": 1,
  "selected_object": null
}
```

返回：

```json
{
  "session_id": "s1",
  "message": "今天先处理……",
  "intent": "today_plan",
  "tool_results": [],
  "sources": [],
  "preview": null,
  "requires_confirmation": false
}
```

### POST `/agent/confirm/{run_id}`

确认写入型工具计划。

### POST `/agent/cancel/{run_id}`

取消草案。

### GET `/agent/sessions/{id}`

读取持久化会话。

## 2. 全局检索

### GET `/search`

Query：

- `q`
- `types`
- `project_id`
- `limit`

类型：

- project
- task
- script
- account
- publication
- report
- memory
- monitored_post

## 3. 今日任务

- `GET /today`
- `GET /today/tasks`
- `POST /today/rebuild`
- `POST /tasks/{id}/expand-with-agent`

## 4. 项目

- `GET /projects`
- `POST /projects`
- `GET /projects/{id}`
- `PATCH /projects/{id}`
- `GET /projects/{id}/dashboard`
- `GET /projects/{id}/forecast`

## 5. 周计划

- `GET /projects/{id}/weekly-plans`
- `POST /projects/{id}/weekly-plans`
- `PATCH /weekly-plans/{id}`
- `GET /weekly-plans/{id}/progress`

## 6. 任务与日历

- `GET /tasks`
- `POST /tasks`
- `PATCH /tasks/{id}`
- `POST /tasks/bulk-preview`
- `POST /tasks/bulk-confirm`
- `GET /calendar/events`
- `PATCH /calendar/events/{id}`

## 7. 脚本与内容

- `GET /scripts`
- `POST /scripts`
- `GET /scripts/{id}`
- `POST /scripts/{id}/versions`
- `PATCH /scripts/{id}/review`

- `GET /content-items`
- `POST /content-items`
- `PATCH /content-items/{id}`
- `POST /content-items/{id}/transition`

## 8. TikTok

- `GET /tiktok/accounts`
- `POST /tiktok/accounts`
- `POST /tiktok/accounts/{id}/sync`
- `GET /tiktok/accounts/{id}/posts`
- `POST /tiktok/publications/import`
- `POST /tiktok/publications/{id}/sync`
- `GET /tiktok/publications/{id}/snapshots`
- `GET /tiktok/sync/logs`
- `GET /tiktok/quota`

## 9. 周报与记忆

- `POST /reports/weekly/preview`
- `POST /reports/weekly/confirm`
- `GET /reports`
- `GET /reports/{id}`
- `POST /reports/{id}/create-actions`

- `GET /memories`
- `GET /memories/candidates`
- `POST /memories/candidates/{id}/accept`
- `POST /memories/candidates/{id}/reject`
- `PATCH /memories/{id}`

## 10. Plane Adapter

- `GET /integrations/plane/status`
- `POST /integrations/plane/sync`
- `POST /tasks/{id}/sync-to-plane`

Plane 不可用不应阻塞 Dojo 本地业务。


---

# 文件：10_DATABASE_SCHEMA.sql

```sql
-- Dojo V1 建议表。Codex 必须按现有数据库方式建立迁移，不要直接覆盖生产库。

CREATE TABLE IF NOT EXISTS dojo_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plane_project_id TEXT,
    name TEXT NOT NULL,
    client_name TEXT,
    brand TEXT,
    product TEXT,
    region TEXT,
    start_date TEXT,
    end_date TEXT,
    target_views INTEGER NOT NULL DEFAULT 0,
    target_content_count INTEGER NOT NULL DEFAULT 0,
    target_account_count INTEGER NOT NULL DEFAULT 0,
    owner_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dojo_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    plane_module_id TEXT,
    name TEXT NOT NULL,
    start_date TEXT,
    end_date TEXT,
    target_views INTEGER NOT NULL DEFAULT 0,
    target_content_count INTEGER NOT NULL DEFAULT 0,
    actual_views INTEGER NOT NULL DEFAULT 0,
    forecast_views INTEGER,
    risk_level TEXT,
    status TEXT NOT NULL DEFAULT 'planned',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dojo_weekly_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    batch_id INTEGER,
    week_start TEXT NOT NULL,
    week_end TEXT NOT NULL,
    target_scripts INTEGER NOT NULL DEFAULT 0,
    target_assets INTEGER NOT NULL DEFAULT 0,
    target_edits INTEGER NOT NULL DEFAULT 0,
    target_approvals INTEGER NOT NULL DEFAULT 0,
    target_publications INTEGER NOT NULL DEFAULT 0,
    target_views INTEGER NOT NULL DEFAULT 0,
    actual_scripts INTEGER NOT NULL DEFAULT 0,
    actual_assets INTEGER NOT NULL DEFAULT 0,
    actual_edits INTEGER NOT NULL DEFAULT 0,
    actual_approvals INTEGER NOT NULL DEFAULT 0,
    actual_publications INTEGER NOT NULL DEFAULT 0,
    actual_views INTEGER NOT NULL DEFAULT 0,
    priorities_json TEXT,
    risks_json TEXT,
    created_by_type TEXT NOT NULL DEFAULT 'human',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dojo_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    weekly_plan_id INTEGER,
    plane_work_item_id TEXT,
    task_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT NOT NULL DEFAULT 'medium',
    owner_id TEXT,
    reviewer_id TEXT,
    start_at TEXT,
    due_at TEXT,
    dependency_ids_json TEXT,
    source_type TEXT,
    source_id TEXT,
    created_by_type TEXT NOT NULL DEFAULT 'human',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dojo_scripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    batch_id INTEGER,
    title TEXT NOT NULL,
    topic TEXT,
    language TEXT,
    region TEXT,
    hook TEXT,
    current_version_id INTEGER,
    review_status TEXT NOT NULL DEFAULT 'draft',
    owner_id TEXT,
    reviewer_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dojo_script_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_id INTEGER NOT NULL,
    version_no INTEGER NOT NULL,
    body TEXT NOT NULL,
    material_requirements TEXT,
    review_notes TEXT,
    created_by_type TEXT NOT NULL DEFAULT 'human',
    created_by_id TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(script_id, version_no)
);

CREATE TABLE IF NOT EXISTS dojo_content_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    batch_id INTEGER,
    script_id INTEGER,
    title TEXT NOT NULL,
    workflow_state TEXT NOT NULL DEFAULT 'idea',
    owner_id TEXT,
    asset_url TEXT,
    video_url TEXT,
    client_review_state TEXT,
    due_at TEXT,
    ready_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dojo_tiktok_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    external_account_id TEXT,
    username TEXT NOT NULL,
    display_name TEXT,
    account_url TEXT,
    region TEXT,
    stage TEXT NOT NULL DEFAULT 'pending',
    owner_id TEXT,
    followers INTEGER,
    total_posts INTEGER,
    total_views INTEGER,
    first_published_at TEXT,
    last_published_at TEXT,
    last_synced_at TEXT,
    sync_status TEXT,
    raw_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(external_account_id)
);

CREATE TABLE IF NOT EXISTS dojo_publications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    content_item_id INTEGER,
    account_id INTEGER NOT NULL,
    external_post_id TEXT,
    post_url TEXT NOT NULL,
    published_at TEXT,
    is_paid INTEGER NOT NULL DEFAULT 0,
    spend REAL NOT NULL DEFAULT 0,
    cumulative_views INTEGER NOT NULL DEFAULT 0,
    cumulative_likes INTEGER NOT NULL DEFAULT 0,
    cumulative_comments INTEGER NOT NULL DEFAULT 0,
    cumulative_shares INTEGER NOT NULL DEFAULT 0,
    last_synced_at TEXT,
    sync_status TEXT,
    raw_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(external_post_id)
);

CREATE TABLE IF NOT EXISTS dojo_metric_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    publication_id INTEGER NOT NULL,
    captured_at TEXT NOT NULL,
    views INTEGER,
    likes INTEGER,
    comments INTEGER,
    shares INTEGER,
    favorites INTEGER,
    source TEXT NOT NULL,
    raw_json TEXT,
    quality_status TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dojo_weekly_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    week_start TEXT NOT NULL,
    week_end TEXT NOT NULL,
    metrics_json TEXT NOT NULL,
    project_state_json TEXT NOT NULL,
    task_state_json TEXT NOT NULL,
    content_state_json TEXT NOT NULL,
    account_state_json TEXT NOT NULL,
    data_quality_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(project_id, week_start, week_end)
);

CREATE TABLE IF NOT EXISTS dojo_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    snapshot_id INTEGER,
    report_type TEXT NOT NULL,
    report_markdown TEXT,
    analysis_json TEXT,
    sources_json TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    approved_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dojo_memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    memory_type TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    source_type TEXT,
    source_id TEXT,
    confidence REAL,
    status TEXT NOT NULL DEFAULT 'active',
    user_confirmed INTEGER NOT NULL DEFAULT 0,
    created_by_type TEXT NOT NULL DEFAULT 'human',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dojo_memory_candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    memory_type TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    sources_json TEXT,
    confidence REAL,
    status TEXT NOT NULL DEFAULT 'pending',
    generated_by TEXT,
    created_at TEXT NOT NULL,
    reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS dojo_agent_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    active_project_id INTEGER,
    title TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dojo_agent_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    sources_json TEXT,
    tool_run_id INTEGER,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dojo_agent_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    intent TEXT NOT NULL,
    input_text TEXT,
    plan_json TEXT,
    result_json TEXT,
    status TEXT NOT NULL,
    requires_confirmation INTEGER NOT NULL DEFAULT 0,
    confirmed_by TEXT,
    model TEXT,
    prompt_version TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS dojo_sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    endpoint TEXT,
    object_type TEXT,
    object_id TEXT,
    request_count INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL,
    returned_count INTEGER,
    error_message TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT
);
```


---

# 文件：11_MVP_VERTICAL_SLICE.md

# MVP 纵向闭环

不要第一轮同时完成所有页面。

使用一个演示项目跑通下面的路径。

## 演示项目

```text
项目：Xros 6 UK
平台：TikTok
周期：6 周
总目标：2,600,000 播放
```

## 闭环

1. 用户打开 Dojo，Agent 介绍系统。
2. 用户用自然语言描述项目。
3. Agent 生成项目、批次、6 周计划和任务草案。
4. 用户预览并确认。
5. 系统生成今日任务。
6. 用户新建或导入 5 份脚本。
7. 用户录入 10 个 TikTok 账号。
8. 导入约 1000 条 TikTok 发布数据。
9. 系统生成初始数据快照。
10. 项目驾驶舱计算实际播放、完成率、要求周速度和预计结案。
11. 用户问 Agent：“今天具体做什么？”
12. Agent 根据任务、缺口和阻塞给出详细计划。
13. 系统生成周快照。
14. DeepSeek 生成周报草案。
15. 用户确认做得好、做得不好和后续建议。
16. 将 3 个后续行动转成任务。
17. 将 2 条经验转成候选规则。
18. 用户确认 1 条规则。
19. 下一轮脚本生成时自动使用这条规则。

## 第一轮页面

- 今日
- 项目驾驶舱
- 周计划
- 内容生产
- 脚本详情
- 账号矩阵
- 周报
- 全局 Agent

TikTok 检索可以直接复用 Velix 原页面入口。

## 验收

- 原 Velix 可以继续启动。
- Dojo 页面可以进入。
- Agent 会话不因切页面丢失。
- Agent 能跨项目数据查询。
- 写入操作必须预览。
- 1000 条测试数据通过统一导入服务进入数据库。
- 驾驶舱指标不是写死。
- 周报数字来自周快照。
- AI 建议能转任务。
- 规则确认后会影响下一次脚本提示词。
- DeepSeek 失败不影响任务、数据和手动录入。


---

# 文件：12_TEST_DATA_PLAN.md

# 1000 条 TikTok 测试数据方案

## 1. 数据组成

建议：

- 20 个 TikTok 账号
- 每个账号最多 50 条近期作品
- 总量约 1000 条

每条保留：

- account_id
- username
- external_post_id
- post_url
- description
- created_at
- views
- likes
- comments
- shares
- raw_json

## 2. 导入方式

支持三种：

1. 直接调用 RapidAPI。
2. 导入保存好的 RapidAPI JSON。
3. CSV 兜底。

所有方式统一进入：

```text
TikTok Provider
→ Normalizer
→ Upsert Account
→ Upsert Publication
→ Insert Snapshot
→ Recalculate Metrics
```

## 3. 测试项目映射

将 20 个账号分为：

- 4 个待测试
- 6 个养号
- 8 个稳定运营
- 2 个暂停

将 1000 条作品关联到：

- 100—200 个内容条目
- 多账号重复分发
- 不同脚本版本
- 不同周次

## 4. 测试异常

必须包含：

- 重复 post ID
- 缺失播放量
- 账号同步失败
- 帖子删除或不可见
- 手动播放量校正
- 发布时间缺失
- 同一内容多个账号发布
- 近 7 日无发布账号

## 5. 验证

- 去重正确
- 账号累计正确
- 内容跨账号汇总正确
- 本周新增播放正确
- 项目总播放正确
- 手动校正有审计
- 数据质量提示正确


---

# 文件：13_AGENT_EXAMPLES.md

# Agent 交互示例

## 1. 新手导游

用户：

> 我第一次用，应该从哪开始？

Agent：

> 先做三件事就够了：建立项目目标、录入本周计划、绑定 TikTok 账号。项目建好后，我可以帮你把自然语言计划拆成任务，不需要你逐项填写。账号接入后，Dojo 才能自动算播放进度和周报。你可以直接把客户要求整段发给我，我先生成草案给你确认。

## 2. 跨系统检索

用户：

> 找出第四周还没通过审核的脚本。

Agent 工具：

```text
search_all(
  type=script,
  project=Xros 6 UK,
  week=4,
  review_status!=approved
)
```

Agent：

> 第四周还有 9 条脚本未通过，其中 6 条在客户审核，3 条已经退回修改。编号 041、043 明天进入剪辑，优先级最高。我可以打开这 9 条，或者先汇总退回原因。

## 3. 今日详细计划

用户：

> 我今天具体做什么？

Agent：

> 今天不要继续新增脚本，先解决审核积压。
>
> 1. 上午汇总 9 条待审脚本的共性问题。
> 2. 先修改 041、043，它们会影响明天剪辑。
> 3. 044 缺少产品依据，先向 Lucas 确认。
> 4. 14:00 前把修改稿集中提交，不要逐条发送。
> 5. 16:00 检查是否至少 3 条通过；低于 3 条时调整本周发布计划。

## 4. 任务拆解

用户：

> 这周要完成 20 条脚本、15 条剪辑，周五前上线 10 条，Lucas 审脚本，小王剪辑。

Agent 返回预览：

```text
周目标
· 脚本：20
· 剪辑：15
· 上线：10

任务草案
· 周一：完成 8 条脚本初稿
· 周二：完成剩余 12 条脚本并提交 Lucas
· 周三：确保至少 10 条脚本通过，交给小王
· 周四：完成 10 条剪辑和成片审核
· 周五：上线 10 条，其余 5 条进入下周库存

依赖
· 剪辑任务必须等待脚本通过
· 发布任务必须等待成片通过

是否确认创建这些周计划和任务？
```

## 5. 数据解释

用户：

> 为什么项目完成率还这么低？

Agent：

> 当前完成率 39%，问题主要不在单条播放，而在上线数量。过去两周计划上线 50 条，实际只有 31 条；其中 9 条卡在客户脚本审核，7 条卡在剪辑。按近 7 日速度，预计结案约 198 万，低于 260 万目标。现在最有效的动作不是扩账号，而是先把审核到发布的周期缩短。

## 6. 复盘沉淀

Agent：

> 我从本周数据提取出两条候选经验：
>
> 1. 结果画面在前三秒出现的内容，中位播放量更高。证据来自 12 条已发布内容，置信度中。
> 2. 逐条向客户送审会延长等待时间，批量集中送审更稳定。证据来自第四周 9 条审核积压，置信度高。
>
> 这两条目前只是候选。确认后，我会在下一轮脚本和周计划中使用。


---

# 文件：15_ART_DESIGN_PRO_ADOPTION.md

# Dojo 前端基底｜Art Design Pro 接入方案

## 1. 唯一基准

Dojo 前端唯一基准：

```text
Daymychen/art-design-pro
```

不要再自行设计一套 UI，也不要混合多个产品风格。

## 2. 选择原因

它适合 Dojo 的原因：

- Vue 3 + TypeScript + Vite，与 Velix 技术方向一致。
- 已具备成熟的应用壳和主题系统。
- 已具备 Sidebar、Topbar、Tabs、卡片、表格、表单、抽屉和图表。
- 已有 Calendar 页面，可以直接进行业务改造。
- 视觉比普通管理后台更完整，同时比 Plane 更容易通过主题配置增加客户喜欢的色彩。
- MIT 许可，适合商业项目改造。

## 3. 代码落位

在 Velix 仓库中增加：

```text
dojo-web/
```

建议步骤：

```bash
git clone https://github.com/Daymychen/art-design-pro.git dojo-web
cd dojo-web
pnpm install
pnpm clean:dev
pnpm dev
```

Codex 开始前需要确认最新仓库的真实命令和结构，不得仅依据本文猜测。

## 4. 不直接覆盖旧前端

迁移阶段保留：

```text
src/
```

作为旧 Velix 前端。

原因：

- 便于对照已有业务。
- 旧功能可以继续使用。
- 降低一次性迁移风险。
- 新 Dojo 失败时可快速回退。

## 5. 需要保留的 Art Design Pro 能力

必须保留：

- Layout
- Sidebar
- Topbar
- Tabs 或页面历史
- Theme
- Dark Mode
- Responsive Layout
- Route
- Permission 基础结构
- Table
- Search Bar
- Form
- Drawer
- Dialog
- Calendar
- ECharts 容器
- Notification
- Loading
- Empty State
- Error State

## 6. 需要删除的内容

清理：

- 示例业务菜单
- 示例用户与权限数据
- 与 Dojo 无关的电商页面
- 与 Dojo 无关的系统管理 Demo
- 示例品牌和 Logo
- 无用 Mock API
- 演示图表和随机统计

不要删除通用组件和主题能力。

## 7. Dojo 品牌替换

替换：

- 应用名称：Dojo
- Logo
- Favicon
- 页面标题
- 登录文案
- 默认项目
- 菜单
- 默认主题
- 空状态文案

产品界面中不出现：

- Art Design Pro
- BatterySee AI
- Velix Matrix OS
- Plane Dashboard

技术文档中可以注明来源。

## 8. 主题策略

Art Design Pro 的主题系统保留，客户可以选择更鲜明的主色。

第一版提供三套主题：

### Dojo Blue

稳重、通用，默认主题。

### Dojo Purple

更接近客户原有偏好，但不用大面积渐变。

### Dojo Orange

更活泼，适合内容与创意团队。

三套主题只改变：

- 主色
- Sidebar 强调
- 按钮
- 标签
- 图表高亮

页面结构、间距和组件形态保持一致。

## 9. 不允许的做法

- 在 Dojo 页面中重新实现另一套 Sidebar。
- 在业务组件里散落硬编码颜色。
- 同时使用 Velix 原 `.dashboard-card` 和 Art Card。
- 使用 Emoji 作为正式导航图标。
- 每个业务模块使用完全不同的卡片风格。
- 把客户截图直接照搬。
- 在一个页面使用大量紫色渐变。
- 为了“高级”增加无意义的大阴影和动画。


---

# 文件：16_DOJO_UI_PAGE_MAPPING.md

# Dojo 页面与 Art Design Pro 映射

## 1. 总体映射

| Dojo 页面 | Art Design Pro 基础 |
|---|---|
| 今日 | Dashboard、统计卡、待办列表 |
| 项目驾驶舱 | Analysis Dashboard、ECharts、Metric Cards |
| 周计划 | Table、Search Bar、Drawer Form |
| 日历 | Calendar Template |
| 内容生产 | Table / Card List / 自定义 Kanban |
| 脚本库 | Table、Detail、Drawer、Editor |
| 账号矩阵 | Data Table、Filters、Status Tags |
| TikTok 检索 | Search Form、Card List、Drawer |
| 数据中心 | Table、Progress、Sync Logs |
| 周报复盘 | Analysis、Detail、Tabs |
| 知识与规则 | Table、Detail、Tag、Drawer |
| 全局 Agent | Art Bot 思路或自定义右侧抽屉 |

## 2. 今日

页面结构：

```text
顶部：日期、当前项目、数据更新时间
第一行：今日任务、逾期、待审核、阻塞、今日发布
第二行：三个最重要动作
第三行：完整任务列表
右侧或下方：Agent 今日建议
```

优先使用 Art Card、Table、Tag、Progress。

## 3. 项目驾驶舱

首屏：

- 总目标
- 当前播放
- 完成率
- 预计结案
- 剩余天数

第二屏：

- 目标 / 实际 / 预测趋势
- 本周计划与实际
- 内容生产漏斗
- 账号阶段
- AI 判断
- 数据质量

所有数字来自后端指标接口，不允许前端写死。

## 4. 周计划

表格字段：

- 周次
- 起止日期
- 计划脚本
- 实际脚本
- 计划剪辑
- 实际剪辑
- 计划发布
- 实际发布
- 目标播放
- 实际播放
- 风险
- 负责人

新增和修改通过 Drawer，不跳转到单独表单页。

## 5. 日历

直接改造 Art Design Pro 的 Calendar 页面。

增加：

- 月 / 周切换
- 左侧待排任务池
- 项目筛选
- 负责人筛选
- 账号筛选
- 任务类型筛选
- 发布事件
- 审核节点
- 周报日期
- 复盘日期

点击事件打开统一任务详情 Drawer。

## 6. 内容生产

MVP 可先使用表格与状态分组，不急于开发复杂拖拽看板。

第二阶段再增加 Kanban：

```text
灵感
→ 脚本中
→ 待审核
→ 已通过
→ 待素材
→ 剪辑中
→ 待成片审核
→ 可分发
→ 已发布
→ 待复盘
→ 完成
```

## 7. 脚本库

列表页使用 Art Table。

详情通过独立页面或大尺寸 Drawer：

- 基本属性
- Hook
- 正文
- CTA
- 素材要求
- 版本记录
- 审核意见
- 关联内容
- 发布表现
- 复盘规则

## 8. 账号矩阵

表格字段：

- 账号
- 阶段
- 负责人
- 最近发布
- 近 7 日发布
- 近 7 日播放
- 累计播放
- 同步状态
- 最后同步
- 异常

账号详情通过 Drawer 打开。

## 9. TikTok 检索

左侧或顶部使用 Art Search Bar：

- 关键词
- 日期范围
- 数量
- 项目
- 内容类型

结果区使用统一 Card List 或 Table。

每条结果可：

- 保存
- 加入参考库
- 转为选题
- 转为脚本任务
- 让 Agent 分析

## 10. 周报复盘

使用 Tabs：

- 概览
- 生产
- 数据
- 内容表现
- AI 分析
- 下周行动
- 候选规则

报告生成后，用户确认才能成为正式版本。

## 11. 全局 Agent

入口：

- Topbar 的 Agent 按钮
- 全局快捷键
- 页面对象上的“问 Agent”
- 底部轻量输入，可选

复杂回复放入右侧 Drawer。

工具预览卡必须展示：

- 将要执行什么
- 影响多少对象
- 哪些字段会变化
- 是否同步 Plane
- 确认与取消


---

# 文件：17_CODEX_UI_IMPLEMENTATION_PROMPT.md

# Codex UI 实施提示词

Dojo 前端唯一采用：

```text
Daymychen/art-design-pro
```

不得自行发明新的视觉体系，不得参考多个后台混合设计。

## 开始前

1. 克隆并运行 Art Design Pro。
2. 截图或列出其现有：
   - Dashboard
   - Analysis
   - Calendar
   - Table
   - Form
   - Drawer
   - Theme
   - Layout
3. 输出这些现有页面与 Dojo 页面的一一映射。
4. 检查许可证并保留必要声明。
5. 再开始改造。

## 代码结构

在现有 `YC-Indis/Velix` 中创建：

```text
dojo-web/
```

不要覆盖旧 `src/`。

## 第一轮只实现

1. Dojo 品牌替换
2. 应用壳
3. 今日
4. 项目驾驶舱
5. 周计划
6. 日历
7. 全局 Agent Drawer
8. API Client
9. Mock / Fixture 数据接口

## 设计约束

- 只使用 Art Design Pro 组件、Token 和布局。
- 不创建第二套 Card、Table、Button、Drawer。
- 不在业务组件中硬编码主题色。
- 正式导航不用 Emoji。
- 日历基于现有 Calendar Template 改造。
- 主题必须支持切换。
- 默认主题采用 Art Design Pro 现有成熟方案。
- 客户偏好的彩色效果通过主题与标签实现，不通过大面积渐变实现。
- 先完成可用性，再做个性化。


---

# 文件：18_DELIVERY_AND_ACCEPTANCE.md

# Dojo 交付计划与验收

## Phase 0｜环境与基线

交付：

- Velix 前后端启动记录
- Art Design Pro 启动记录
- 目录结构
- 现有 API 清单
- 迁移风险
- `docs/dojo-baseline.md`

验收：

- 原 Velix 仍可运行
- Art Design Pro 独立可运行
- 无 API Key 进入仓库

## Phase 1｜前端壳

交付：

- `dojo-web/`
- Dojo Logo 和名称
- Sidebar
- Topbar
- Theme
- Dojo 菜单
- API Client
- Loading / Empty / Error

验收：

- 1440、1280 宽度可用
- 菜单不溢出
- 主题可切换
- 无演示业务残留

## Phase 2｜业务纵向闭环

演示项目：

```text
Xros 6 UK
TikTok
6 周
目标 2,600,000 播放
```

交付：

- 项目
- 周计划
- 今日任务
- 日历
- 内容任务
- 账号
- 发布数据
- 指标
- 周报
- 行动项

验收：

- 数据来自 API
- 指标来自后端
- 页面不写死业务数字
- 写入操作有错误提示

## Phase 3｜Agent

交付：

- 持久化会话
- 全局上下文
- 搜索
- 今日计划
- 计划拆解
- 任务预览
- 用户确认
- 周报生成

验收：

- 切页面不丢会话
- 查询可直接执行
- 批量写入必须确认
- DeepSeek 失败不影响普通业务

## Phase 4｜TikTok 数据

交付：

- Provider Adapter
- 约 1000 条测试数据
- 账号和帖子
- 数据快照
- 同步日志
- 配额记录
- 失败重试

验收：

- 去重正确
- 同一内容跨账号统计正确
- 本周新增播放正确
- 数据更新时间可见
- API 失败不覆盖旧数据

## Phase 5｜复盘和记忆

交付：

- 周快照
- 周报草案
- 行动项
- 候选记忆
- 规则确认
- 脚本 Prompt 使用已确认规则

验收：

- 报告数字可追溯
- 规则有来源
- 未确认经验不进入正式规则
- 历史周报不因后续数据改变

## 最终交付内容

- 源代码
- 启动命令
- `.env.example`
- 数据库迁移
- API 文档
- 测试结果
- Demo 数据
- 已知限制
- 下一阶段计划
- Art Design Pro 许可证与来源说明


---

# 文件：14_CODEX_MASTER_PROMPT.md

# Codex 总提示词｜Dojo V5 完整版

你正在维护用户现有仓库：

```text
YC-Indis/Velix
```

Velix 即原 BatterySee AI。

新产品名称：

```text
Dojo
```

唯一前端基底：

```text
Daymychen/art-design-pro
```

## 一、必须先阅读

完整阅读本交接包中的：

- `00_START_HERE.md`
- `01_PRODUCT_PRD.md`
- `02_VELIX_REUSE_AUDIT.md`
- `03_SYSTEM_ARCHITECTURE.md`
- `04_GLOBAL_AGENT_ARCHITECTURE.md`
- `05_TIKTOK_DATA_PLAN.md`
- `06_WORKFLOW_AND_PAGES.md`
- `07_METRICS_AND_REPORTS.md`
- `08_MEMORY_AND_COEVOLUTION.md`
- `09_API_CONTRACT.md`
- `10_DATABASE_SCHEMA.sql`
- `11_MVP_VERTICAL_SLICE.md`
- `12_TEST_DATA_PLAN.md`
- `13_AGENT_EXAMPLES.md`
- `15_ART_DESIGN_PRO_ADOPTION.md`
- `16_DOJO_UI_PAGE_MAPPING.md`
- `17_CODEX_UI_IMPLEMENTATION_PROMPT.md`
- `18_DELIVERY_AND_ACCEPTANCE.md`
- `references/`

## 二、产品目标

开发一个以 TikTok 海外矩阵运营为第一业务场景的 AI 协作中控台。

完整闭环：

```text
项目目标
→ 批次
→ 周计划
→ 今日任务
→ 日历
→ 脚本
→ 内容生产
→ TikTok 账号
→ 发布实例
→ 数据快照
→ 指标与预测
→ AI 周报
→ 行动项
→ 记忆与规则
→ 反哺下一轮生产
```

## 三、前端强制架构

不要继续在 Velix 原前端上零散套样式。

在仓库中增加：

```text
dojo-web/
```

`dojo-web/` 基于 Art Design Pro。

迁移期保留原：

```text
src/
```

Dojo 前端只使用 Art Design Pro 的：

- Layout
- Theme
- Sidebar
- Topbar
- Tabs
- Card
- Table
- Form
- Drawer
- Dialog
- Calendar
- Chart 容器
- Loading
- Empty
- Error

不得混用 Velix 原 Card 和 Art Design Pro Card。

## 四、后端强制架构

保留 FastAPI、SQLite、DeepSeek、RAG、Memory 和 TikTok RapidAPI。

新增：

```text
server/dojo/
├─ router.py
├─ schemas.py
├─ models.py
├─ repositories/
├─ services/
├─ metrics/
├─ agent/
├─ tiktok/
├─ reports/
└─ migrations/
```

不要把新逻辑继续全部放进 `server/main.py`。

## 五、业务范围

第一版只做：

- TikTok
- DeepSeek
- 项目
- 批次
- 周计划
- 今日任务
- 日历
- 脚本
- 内容生产
- 账号矩阵
- 发布实例
- 数据快照
- 周报
- Agent
- Memory / Rule

Plane 只做可选 Adapter。Plane 未配置时，Dojo 必须完整运行。

## 六、Agent

Agent 是全局入口。

必须支持：

- 新手导览
- 跨系统检索
- 今日工作解释
- 自然语言计划拆解
- 批量任务草案
- 脚本辅助
- 项目分析
- 周报生成
- 行动项创建
- 候选记忆提取

执行方式：

```text
用户输入
→ Planner
→ JSON Tool Plan
→ Pydantic 校验
→ Tool Registry
→ 查询直接执行
→ 写入生成预览
→ 用户确认
→ 正式写入
→ 返回结果
```

DeepSeek 不直接执行 SQL。

## 七、数据与指标

核心指标由后端代码计算：

- 完成率
- 剩余目标
- 近 7 日新增播放
- 要求周速度
- 预计结案
- 周计划 / 实际
- 内容漏斗
- 账号阶段
- 单条内容跨账号播放
- 数据质量

AI 只负责解释和建议。

## 八、TikTok

复用现有 RapidAPI 代码，但新增 Provider Adapter：

- `search_posts`
- `get_account`
- `list_account_posts`
- `get_post`

具体 endpoint 不允许猜。

用户会在 Codex 中补充当前购买套餐的接口文档或调用样例。

无真实接口时，先使用 Fixture Provider，所有页面必须走统一 Service，不允许直接写死 JSON。

## 九、第一轮 Vertical Slice

演示项目：

```text
Xros 6 UK
TikTok
6 周
目标 2,600,000 播放
```

跑通：

1. 创建项目。
2. Agent 自然语言生成 6 周计划。
3. 用户确认。
4. 创建今日任务。
5. 添加脚本。
6. 添加账号。
7. 导入约 1000 条 TikTok 数据。
8. 建立数据快照。
9. 计算目标进度和预测。
10. 在项目驾驶舱展示。
11. 生成周快照。
12. 生成周报草案。
13. 行动项转任务。
14. 候选经验转规则。
15. 下一次脚本生成读取规则。

## 十、第一轮页面

- 今日
- 项目驾驶舱
- 周计划
- 日历
- 内容生产
- 脚本详情
- 账号矩阵
- 周报
- 全局 Agent Drawer

## 十一、开始前必须做

1. 运行 Velix。
2. 运行 Art Design Pro。
3. 输出两个项目的目录结构。
4. 输出可复用能力。
5. 输出计划新增和修改的文件。
6. 写入 `docs/dojo-baseline.md`。
7. 新建分支 `feature/dojo-mvp`。
8. 再开始编码。

不要只给方案，要直接实施。

## 十二、每阶段必须验证

- 前端构建
- 后端启动
- 核心测试
- 原 Velix 未被破坏
- Dojo 页面可访问
- 错误状态可见
- 没有真实 Key
- 没有写死指标

## 十三、最终汇报

必须如实给出：

- 已完成
- 未完成
- 修改文件
- 启动命令
- 测试结果
- 已知问题
- 下一轮任务

不得声称未验证的功能已经完成。
