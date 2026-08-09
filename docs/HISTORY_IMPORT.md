# 往日数据复刻

## 原则

先把历史账号矩阵与发布数据灌进 Dojo，再谈「今日」自动化。
指标由代码汇总，不依赖 AI 估算。

## 源文件（`docs/source/history/`）

| 文件 | 用途 |
|------|------|
| 账号粉丝量-2026-08-04*.csv | 账号 upsert：云机编号、链接、粉丝量 |
| 账号发布内容-2026-08-04*.csv | 帖子 upsert：日期、播放/赞/评/转、链接 |
| PEN 项目涨粉.xlsx | 涨粉增量写入 `raw_json.growth_followers` |
| battery-posts-export (6).csv | Velix 监测库（可选，默认不导入） |

## 导入

```powershell
cd D:\Dojo\server
py -3 -m dojo.fixtures.import_history
# 或指定目录
py -3 -m dojo.fixtures.import_history --src "E:\download"
```

导入后进入：

```text
账号粉丝 CSV / PEN 涨粉
  → dojo_tiktok_accounts
账号发布内容 CSV
  → dojo_publications + dojo_metric_snapshots
  → 回写账号 total_posts / total_views / last_published_at
```

## 验收

- 账号矩阵能按地区/云机编号看到历史账号
- 账号详情能看到往日帖子与播放
- 项目累计播放与 CSV 量级一致（非空壳 seed）
