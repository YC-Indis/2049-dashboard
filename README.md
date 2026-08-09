# Dojo

TikTok 海外矩阵 AI 协作中控台 — **不是通用后台**，核心是给 PM 确认任务、执行填进度、看节奏与流转。

## 侧栏（7 项）

| 页面 | 作用 |
|------|------|
| 今日 | KPI + 三动作 + 任务表（对齐参考设计） |
| 项目 | 目标进度与闭环说明 |
| 节奏日历 | 左侧待排 → 拖到月历；看脚本/录制/剪辑/发布节点 |
| 内容流转 | 看板 + **时间线**（每条内容的起始→结束） |
| 待确认 | PM 预览确认后下发 |
| 执行进度 | 执行成员回填 |
| 账号矩阵 | RapidAPI 同步粉丝量 + 检阅 |

## Agent（Velix 风格）

- **底部 ChatBar**（非抽屉）：pill 输入框 + 圆形发送钮
- 切换页面 **session 保留** 对话
- 优先调 Velix `/api/v1/llm/chat`（DeepSeek）；失败走本地兜底
- 写入操作须预览确认；记忆规则候选在账号页展示

## 本地启动

```powershell
.\scripts\start-web.ps1
```

当前 dev：http://localhost:5311（若 5310 被占用会自动换端口）

登录：选角色，密码 `123456`

## 后端接入（下一步）

- `server/` 从 Velix 迁入：`/api/dojo/agent/chat`、`/api/dojo/tiktok/account/sync`
- RapidAPI TikTok 套餐配置 → 账号页「同步」走真实 API
- DeepSeek + RAG + 记忆自进化写回 Velix 既有能力
