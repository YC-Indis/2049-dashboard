# XIA Creator OS

依据 `CREATOR_OS_REBUILD_SPEC.md` 实现的本地个人内容管理工具。当前版本已经接通内容流转、制作任务、节奏日历、目标和复盘的统一数据闭环。

## 本地运行

```powershell
pnpm install
pnpm dev
```

默认地址由 Vite 输出，通常为 `http://127.0.0.1:5173`。

## 生产验证

```powershell
pnpm build
pnpm preview
```

## 已有页面

- `/today` 今日推进
- `/calendar` 节奏日历
- `/flow` 内容流转
- `/strategy` 经营策略
- `/goals` 目标进度
- `/review` 复盘沉淀

## 已实现能力

- 新建内容与快速捕捉灵感
- Flow 同列排序与跨阶段拖拽
- Calendar 周/月视图
- 制作任务排期、改期、取消排期
- 批量复盘与直播固定动作排期
- 内容详情抽屉与制作时间线
- 完成阶段后自动生成下一阶段任务
- 发布后进入待复盘，复盘可沉淀规则
- Today、Goals、Review 使用统一 Store 派生数据
- 浏览器 `localStorage` 自动持久化

## 验证

```powershell
pnpm test:smoke
pnpm build
```
