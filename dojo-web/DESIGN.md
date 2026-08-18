---
name: "2049 Warm Editorial Workbench"
description: "Current 2049 workflows expressed through the warm, editorial visual language of the earlier creator workspace."
colors:
  canvas-warm: "#f5f0ee"
  paper: "#fbf8f7"
  paper-strong: "#fffdfc"
  paper-tint: "#f2ecea"
  sidebar-plum: "#211d39"
  sidebar-plum-soft: "#2b2648"
  sidebar-plum-active: "#342e55"
  ink: "#24202b"
  ink-secondary: "#716a72"
  ink-muted: "#9a9297"
  line: "#e3dcdb"
  line-strong: "#d7cecd"
  action-coral: "#e8685e"
  action-coral-soft: "#f3a08e"
  ai-purple: "#7860cc"
  ai-purple-deep: "#403666"
  signal-green: "#78a69f"
  signal-blue: "#7e8fcb"
  signal-amber: "#b49a61"
  signal-danger: "#b84f5f"
typography:
  display:
    fontFamily: "Noto Serif SC, Source Han Serif SC, Songti SC, serif"
    fontSize: "clamp(28px, 3vw, 40px)"
    fontWeight: 500
    lineHeight: 1.22
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Noto Serif SC, Source Han Serif SC, Songti SC, serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0"
  title:
    fontFamily: "MiSans, HarmonyOS Sans SC, PingFang SC, sans-serif"
    fontSize: "16px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "0"
  body:
    fontFamily: "MiSans, HarmonyOS Sans SC, PingFang SC, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "0"
  label:
    fontFamily: "MiSans, HarmonyOS Sans SC, PingFang SC, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0"
  numbers:
    fontFamily: "Georgia, Noto Serif SC, serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0"
rounded:
  chip: "8px"
  control: "10px"
  small: "12px"
  medium: "18px"
  large: "24px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.action-coral}"
    textColor: "{colors.paper-strong}"
    rounded: "{rounded.small}"
    padding: "0 18px"
    height: "42px"
  button-ai:
    backgroundColor: "{colors.ai-purple-deep}"
    textColor: "{colors.paper-strong}"
    rounded: "{rounded.small}"
    padding: "0 18px"
    height: "42px"
  input:
    backgroundColor: "{colors.paper-strong}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "42px"
  panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.medium}"
    padding: "24px"
  navigation-active:
    backgroundColor: "{colors.sidebar-plum-active}"
    textColor: "{colors.paper-strong}"
    rounded: "{rounded.small}"
    padding: "0 16px"
    height: "46px"
---

# Design System: 2049 Warm Editorial Workbench

## Overview

**Creative North Star: "暖色编辑台"**

这套方向保留当前 2049 的多项目中台、灵感采集、可执行灵感、脚本、排期和运营监控逻辑，只替换视觉表达。暖纸色背景降低长时间工作的疲劳，深紫侧栏固定全局结构，珊瑚红标记人的下一步动作，紫色只标记 AI、深层编辑和已进入转化的状态。

界面应像长期使用的内容策划本，而不是通用企业后台。页面允许出现编辑式标题、柔和材质和富有节奏的分栏，但候选列表、证据编辑和日历仍优先服务扫描、比较和连续操作。

**Key Characteristics:**

- 暖纸色画布与接近白色的工作面。
- 深紫持久侧栏，活动项用珊瑚红边标记。
- 珊瑚红代表人的操作，紫色代表 AI 与深层转化。
- 大区域用留白和分栏组织，小状态用色彩和细线组织。
- 旧版气质与当前业务逻辑严格分离。

## Colors

颜色来自旧 `creator-os` 的实际 token，并按当前工作台语义重新命名。

### Primary

- **Action Coral:** 创建、晋升、保存、安排等明确的人类主操作。单屏占比应低于 10%。
- **Action Coral Soft:** 轻选中、悬停底色、图标底色和危险程度较低的提醒。

### Secondary

- **AI Purple:** AI 分析、脚本转化、深层编辑与智能建议。
- **AI Purple Deep:** AI 主按钮、分段控件当前项、深色编辑面板的稳定底色。
- **Signal Green / Blue / Amber:** 完成、处理中、等待或风险提示。只表达真实状态。

### Neutral

- **Canvas Warm:** 全局页面背景。
- **Paper / Paper Strong:** 面板与可编辑表面。
- **Paper Tint:** 次级分区、搜索框、静止 hover 面。
- **Sidebar Plum:** 唯一大面积深色结构。
- **Ink / Secondary / Muted:** 正文、辅助说明和元数据。
- **Line / Line Strong:** 分割和输入边界。

**The Coral Means Human Action Rule.** 珊瑚红只标记用户现在可以做的事情，不用来装饰标题或填满统计卡。

**The Purple Means Transformation Rule.** 紫色用于 AI、转化、已进入深层工作或稳定选择状态，不能与普通保存按钮混用。

**The Warm Neutral Lock.** 工作区统一使用暖中性色。不要在局部重新引入当前冷银蓝底色。

## Typography

**Display Font:** Noto Serif SC / Source Han Serif SC / Songti SC 退化栈  
**Body Font:** MiSans / HarmonyOS Sans SC / PingFang SC 退化栈

宋体只负责页面方向、详情标题和需要停顿阅读的编辑内容。所有表单、列表、指标、状态和操作继续使用无衬线字体。

### Hierarchy

- **Display:** 每个页面最多一个页名，对标执行日历：桌面 `clamp(28px, 3vw, 40px)`，字重 500，下一句短介绍 12px。不要再用长方向句占掉工作区。
- **Headline:** 详情标题或独立工作区标题，24-28px。
- **Title:** 卡片、列表项、面板和字段组标题，14-18px。
- **Body:** 主要说明与编辑内容，14px。
- **Label:** 筛选、状态、元信息和按钮，12px。
- **Meta:** 时间、来源、计数，10-11px，但不得低于可读下限。

**The Serif Has One Job Rule.** 宋体负责方向与内容感，不进入按钮、表格、输入标签和密集指标。

**The Numbers Stay Quiet Rule.** 数字可用 Georgia 作为旧版气质点缀，但只用于独立计数或日期，不用于整张表。

## Layout

全局使用深紫侧栏、暖纸工作区，没有全局顶栏。桌面侧栏展开宽 240px，收纳 64px。页头边距与字号一律对标执行日历：外层 `18px 20px 20px`，标题区 `margin: 0 2px 22px`。核心工作区依任务使用两栏或三栏。灵感库中间栏必须完整放下竖屏预览，不能裁切画面。

页面必须保持当前路由与导航分组。视觉可以接近旧版，但不能恢复旧版菜单或品牌内容。候选、灵感详情和脚本台使用分栏工作面；长列表优先使用行与分区，不使用重复的卡片矩阵。

在 800px 以下，侧栏变成抽屉，工作区自然单列。视频、证据、AI 面板等次级区域通过折叠区、抽屉或页内标签访问，不允许产生整页水平滚动。日历本体可在自身容器内横向滚动。

**The Workflow Owns the Grid Rule.** 页面先服从工作流，再服从视觉对称。采集、详情、脚本和日历不共用一套硬编码卡片网格。

## Elevation & Depth

大多数表面保持平坦，通过暖色明度、细线和内边距建立层级。常驻面板使用 `0 8px 28px rgba(55, 42, 62, 0.045)` 的轻环境阴影。下拉、抽屉、浮层和对话框可以加深，但阴影必须带紫灰色，不用纯黑。

**The Paper Plane Rule.** 静止内容都在同一纸面上。只有悬停、拖动、弹层和正在编辑的对象获得明显抬升。

## Shapes

输入和紧凑控件使用 10px 圆角，导航项与小组件使用 12px，标准工作面使用 18px，大型复合面板使用 24px。圆形只用于头像、日期和真实状态点。标签可以使用小圆角，不默认做成胶囊。

## Components

### Buttons

- **Primary:** 珊瑚红实色，42px 高，12px 圆角。
- **Create / Promote:** 允许使用珊瑚红到紫色的短渐变，但单个视口最多一个。
- **AI:** 深紫实色，文案必须明确动作，如“拆解并转化”。
- **Secondary:** 强纸色背景与加深边线。
- **Danger:** 低饱和红字和浅红边，不与主操作竞争。
- **State:** hover 上移最多 1px，active 下移 1px，focus 使用可见紫色外环。

### Chips

- 用于筛选、类目、真实状态和标签。
- 选中态必须同时改变背景、文字和边界，不能只变颜色。
- 状态颜色不得拿来区分类目。

### Cards / Containers

- 普通内容面使用 18px 圆角，大型工作区使用 24px。
- 候选池与脚本索引以列表和分割组织，不做每行独立悬浮卡。
- 可执行灵感详情可以使用少量功能面板，因为镜头、话术、音乐确实是不同工作对象。

### Inputs / Fields

- 强纸色背景、暖灰 1px 内描边、10px 圆角。
- 聚焦时用 AI Purple 的低透明外环。
- 标签永远在字段上方或清晰位于左侧，不依赖 placeholder 说明字段含义。

### Navigation

导航沿用当前“执行、内容、运营”分组。深紫底上默认文字为 68% 白，hover 为轻白叠层，active 为 `sidebar-plum-active`，左侧出现 3px 珊瑚红标记。收纳态只保留图标并提供 tooltip。

### Candidate Row

候选行是核心扫描组件。固定展示来源、发布时间、标题、摘要、热度、新鲜度、播放和当前状态。主操作放在最右侧，预览在前，忽略为次级，晋升为珊瑚红主操作。黑盒总分不能代替子指标。

### Evidence Editor

字幕 / 口播与画面证据必须并列或连续出现，并显示完整度。缺少任意一项时，“生成脚本草稿”保持可理解但不可误判为已完成。

## Do's and Don'ts

### Do:

- **Do** 保留当前多项目中台、当前路由和当前实体关系。
- **Do** 让珊瑚红、紫色和阶段色各自承担稳定语义。
- **Do** 使用旧版的暖纸材质、编辑式标题和深紫侧栏。
- **Do** 为 loading、empty、error、provider 未配置和权限确认提供完整状态。
- **Do** 在桌面保留高效分栏，在移动端按任务顺序折叠。

### Don't:

- **Don't** 恢复旧版品牌名、演示账号、吉祥物或旧导航。
- **Don't** 把每一块信息都做成圆角卡片。
- **Don't** 用珊瑚紫渐变填满页面、指标或大面积背景。
- **Don't** 用单一 AI 总分隐藏真实指标和证据。
- **Don't** 让 AI 状态看起来像已经看过视频或已经配置实时接口。
- **Don't** 为了视觉一致而改动当前字段名、route path、storage key 或确认语义。

