# Dojo 设计状态与对话进度记录

> **更新时间**：2026-08-08  
> **范围**：`dojo-web` 前端中控台 · 本轮 Cursor 对话交付  
> **状态**：时间规划 Gantt 已重构并通过本地验证；其余模块按下列清单为准

---

## 1. 项目定位（当前实现）

Dojo 是 **TikTok 海外矩阵项目全流程中控台**（非通用后台），面向 PM / 运营：

- 看今日任务、项目进度、节奏日历、时间规划（Gantt）
- 管理脚本、分发数据、投放检阅、账号矩阵
- 全局浮动 **助手（Agent）** 查数据、问现状、辅助排期确认

**技术栈**：Vue 3 + Element Plus + Vite（基于 Art Design Pro 壳）  
**AI**：DeepSeek API（`.env.local` 配置，经 `src/api/llm.ts`）  
**本地 dev**：`http://localhost:5310`（或 README 所述备用端口）

**登录**：超级管理员 / 管理员，密码 `123456`（已移除「普通用户」演示账号）

---

## 2. 对话进度时间线

### 阶段 A · 时间规划 / 助手 / 数据录入

| 需求 | 状态 | 说明 |
|------|------|------|
| 框选排期：可见选框 + 每行有轨道 | ✅ 已解决 | 见 §3.1 架构重构 |
| 助手界面底部灰色难看 | ✅ | `DojoFloatingAgent.vue` 线程区改白底 |
| DeepSeek 梳理项目明细写入中控台 | ✅ | 17 个项目 → `dojoProjectStore.ts` |
| 处理 `docs/source` 历史 CSV | ✅ 部分 | CSV 已解析；部分 xlsx 缺失 |

### 阶段 B · 分发数据

| 需求 | 状态 |
|------|------|
| 删除「3s 留存」筛选、表格列、表单、AI 导入字段 | ✅ `distribution/index.vue` |

### 阶段 C · UI / 逻辑多项

| 需求 | 状态 | 文件 |
|------|------|------|
| 脚本区间日期选择器正常宽度 ~280px | ✅ | `scripts/index.vue` |
| 节奏日历：点日期 / 「+」/ 工具栏可添加计划 | ✅ | `calendar/index.vue` |
| 时间规划：每行必有轨道；无排期也有空轨道；顶部时间轨冻结 | ✅ | `GanttBoard.vue` |
| 通知面板不透明；标为已读去掉铃铛红点 | ✅ | `art-notification` + `art-header-bar` |
| 用户菜单去掉锁定屏幕；头像改 Dojo logo | ✅ | `ArtUserMenu.vue` |
| 登录页强调海外项目全流程中控 | ✅ | `zh.json` / `en.json` + `login/index.vue` |
| 登录角色仅超管 / 管理员 | ✅ | `login/index.vue` |

### 阶段 D · 时间规划严重 Bug（用户反馈未修）

**现象**：左侧项目名完整，右侧大面积空白；框选坐标不准；竖格被行背景盖住。

**根因（已确认）**：

- 旧布局将 `gantt__names` 与 `gantt__track` **分列**，右侧 `overflow-y: hidden`，行数增多后轨道区高度与名称区不同步 → 下方行右侧不渲染。
- 框选坐标基于错误的 canvas rect，未扣除左侧 240px 名称列宽。
- 「白底盖竖格」的 per-row `<span>` 方案在错误布局下无效。

**修复（2026-08-08，用户确认「好了」）**：统一 sheet 布局 + CSS 渐变竖格 + `trackX()` 坐标。详见 §3.1。

---

## 3. 当前设计状态（按模块）

### 3.1 时间规划 · GanttBoard（核心）

**文件**：`dojo-web/src/views/dojo/timeline/GanttBoard.vue`

#### 布局架构（现行）

```
gantt__viewport
├── gantt__sticky-head          # 冻结顶栏
│   ├── gantt__names-head       # 240px 角标「类目 / 项目」
│   └── gantt__head-track       # 日期轨，scrollLeft 与 body 同步
└── gantt__sheet-scroll         # 单一滚动容器（overflow: auto）
    └── gantt__sheet            # 宽 = NAME_W + totalWidth
        ├── gantt__today-sheet  # 今天竖线（left = 240 + todayLeft）
        └── gantt__line × N     # 每一行
            ├── gantt__name-cell      # sticky left: 0, 宽 240px
            └── gantt__track-cell     # 宽 totalWidth，竖格 + 条 + 框选
```

#### 关键常量

| 常量 | 值 | 含义 |
|------|-----|------|
| `PX` | 30 | 每天像素宽度 |
| `NAME_W` | 240 | 左侧名称列宽（与 SCSS `$name-w` 一致） |
| `todayKey` | `2026-08-07` | 「今天」标记日期 |

#### 竖格渲染

- 每行 `gantt__track-cell::before` 使用 `repeating-linear-gradient`，每 30px 一条竖线。
- 不再为每行渲染数百个 `<span class="gantt__col">`（旧方案已删除）。

#### 框选排期

- **默认模式**：`interactMode = 'box'`（工具栏可切「浏览平移」）。
- **坐标公式**：`trackX(ev) = ev.clientX - scrollerRect.left - NAME_W + scrollLeft`
- **交互**：在 `gantt__track-cell` 上 pointerdown → 拖拽紫色 `gantt__box` + 日期标签 → pointerup 弹出「在框选区间添加任务」对话框 → 写入 `dojoScheduleStore` → AI 二次确认弹窗。
- **空轨道**：每个活跃项目至少一条 `laneOnly` 行，提示「空轨道 · 拖拽框选添加任务」。

#### 滚动行为

- **纵向**：普通滚轮在 sheet 内翻页。
- **横向**：Shift + 滚轮，或触控板横向 delta。
- **平移模式**：按住轨道空白处拖动（名称列不触发 pan）。
- **顶栏同步**：`headScroller.scrollLeft = scroller.scrollLeft`。

#### 数据来源

- 里程碑：`workflowStages`（Dojo 内容流转）
- 投放：`adTimeline`
- 自建排期：`dojoScheduleStore.blocks`
- 空轨道：无任务的项目自动补 `LANE-{projectId}`

---

### 3.2 浮动助手

**文件**：`dojo-web/src/components/dojo/DojoFloatingAgent.vue`

- 对话线程区：**白色背景**（已去掉底部大块灰色）
- 输入区：浅色底，随页面 context 切换 placeholder（如「在「时间规划」提问…」）
- 调用 `chatAgent()`，scene 随路由变化

---

### 3.3 节奏日历

**文件**：`dojo-web/src/views/dojo/calendar/index.vue`

- 点击日期格 / 格内「+」/ 工具栏「添加计划」→ 打开弹窗
- 支持手填或从待排脚本选择

---

### 3.4 脚本进度

**文件**：`dojo-web/src/views/dojo/scripts/index.vue`

- 区间日期选择器固定 **280px**（`filter-row__picker`）

---

### 3.5 分发数据

**文件**：`dojo-web/src/views/dojo/distribution/index.vue`

- 已移除：3s 留存筛选、表格列、表单字段、AI 解析字段、同步相关字段

---

### 3.6 通知与用户菜单

| 文件 | 改动 |
|------|------|
| `art-notification/index.vue` | 面板白底 + 阴影；`markAllRead()` 清空并 emit |
| `art-header-bar/index.vue` | 红点绑定 `noticeUnread` |
| `ArtUserMenu.vue` | 移除锁定屏幕；头像 `ArtLogo` |

---

### 3.7 登录

**文件**：`views/auth/login/index.vue`，`locales/langs/zh.json` / `en.json`

- 左栏文案：**Dojo · 海外项目全流程中控**
- 演示账号：Super / Admin，密码 `123456`

---

### 3.8 项目与历史数据

**项目 Store**：`dojo-web/src/store/dojoProjectStore.ts`

- **17 个活跃项目**：blast / purex / xros6 / 垂类矩阵系列 + dojo / elfbar / vibe-se 等
- 导入报告：`docs/_excel_digest/project_import_report.json`

**历史 CSV**：

| 文件 | 处理 |
|------|------|
| `docs/source/history/账号粉丝量-2026-08-04.csv` | → `historyImport.json` |
| `docs/source/history/账号发布内容-2026-08-04.csv` | 合并到总账号预览 / 项目页 |
| `battery-posts-export (6).csv` | 跳过（需 Velix 后端） |

**脚本**：

```bash
pnpm import:projects   # scripts/import-projects.mjs
pnpm import:history    # scripts/import-history-csv.mjs（需 Node ≥20）
```

---

## 4. 侧栏页面一览（现行路由）

| 路由 | 页面 | 说明 |
|------|------|------|
| `/today` | 今日 | KPI + 任务表 |
| `/project` | 项目概览 | 目标进度 |
| `/timeline` | **时间规划** | Gantt + 框选排期 |
| `/calendar` | 节奏日历 | 月历 + 添加计划 |
| `/scripts` | 脚本进度 | |
| `/distribution` | 分发数据 | 无 3s 留存 |
| `/accounts` | 总账号预览 | |
| `/ads` 等 | 投放检阅 / 视频监控 / 买量监看 | |
| `/review` | 复盘总结 | |

路由定义：`dojo-web/src/router/modules/dojo.ts`

---

## 5. 关键文件速查

| 功能 | 路径 |
|------|------|
| Gantt 主组件 | `src/views/dojo/timeline/GanttBoard.vue` |
| 时间规划页壳 | `src/views/dojo/timeline/index.vue` |
| 排期 Store | `src/store/dojoScheduleStore.ts` |
| 项目 Store | `src/store/dojoProjectStore.ts` |
| LLM API | `src/api/llm.ts` |
| 助手 | `src/components/dojo/DojoFloatingAgent.vue` |
| 投放时间线 mock | `src/mock/dojo/imported/ads.ts` |
| 里程碑 mock | `src/mock/dojo/imported`（workflowStages） |
| 环境变量 | `dojo-web/.env.local`（勿提交密钥） |

---

## 6. 已知问题与待办

| 项 | 优先级 | 说明 |
|----|--------|------|
| `docs/source` 缺 xlsx | 中 | `dojo脚本.xlsx` / `dojo数据.xlsx` / `PEN 项目涨粉.xlsx` 缺失，无法重跑 `import:excel` |
| `dist/` 可能是旧构建 | 低 | 部署前需 `pnpm build`；开发看 dev 热更新 |
| 周末 / 今日列高亮 | 低 | Gantt 竖格现为统一渐变，未按周末分色（可后续用多层 gradient） |
| Velix 后端 | 规划 | RapidAPI 真同步、battery-posts 等待 `server/` 迁入 |
| README 侧栏描述 | 低 | 根目录 `README.md` 仍为早期 7 项描述，与现行路由略有出入 |

---

## 7. 本地开发备忘

```powershell
# 推荐（若已配置 tools 路径）
$env:Path = "C:\coding\.tools\node;" + $env:Path
cd C:\coding\Dojo\dojo-web
pnpm dev -- --port 5310 --strictPort
```

- PowerShell 用 `;` 分隔命令，不用 `&&`
- 修改 Gantt 后 **Ctrl+Shift+R** 硬刷新
- Node 要求：`>=20.19.0`（见 `package.json` engines）

---

## 8. 验收要点（时间规划）

1. 打开 `#/timeline`，按项目分组，**每一行右侧都有竖格轨道**（含 Dojo 里程碑与空轨道）。
2. 默认「框选排期」，在任意轨道 **按住拖拽** → 出现紫色选框与日期 → 松手弹出添加任务对话框。
3. 纵向滚动时 **左侧名称 sticky**，**顶部日期轨冻结**且与横向滚动同步。
4. 点击「回到今天」视口对齐 `2026-08-07` 附近。

---

## 9. 相关文档

- 产品总览：`docs/00_START_HERE.md`
- 页面映射：`docs/16_DOJO_UI_PAGE_MAPPING.md`
- 历史 CSV 说明：`docs/HISTORY_IMPORT.md`
- 项目导入报告：`docs/_excel_digest/project_import_report.json`
- 文件清单：`docs/20_MANIFEST.md`

---

*本文档由 Cursor 对话整理，用于接续开发与验收。若 Gantt 或数据层有重大变更，请同步更新本节与 §3.1。*
