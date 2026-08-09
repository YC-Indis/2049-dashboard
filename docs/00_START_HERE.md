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
