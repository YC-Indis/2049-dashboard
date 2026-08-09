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
