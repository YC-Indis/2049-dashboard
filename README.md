# 2049 Dashboard

TikTok 海外矩阵的内容运营中控台。不是通用后台模板——它按一条内容从「找选题」到
「看数据」的实际流程组织页面：采集线索 → 灵感库 → 脚本 → 排期 → 分发 → 账号数据回流。

内置的 SixNine49 智能体挂在同一套数据上，可以直接问「这周哪些排期逾期了」，也可以
让它建项目、改周期、同步账号——**改数据的操作一律先出确认卡片，用户点了才执行**。

## 结构

```
dojo-web/    前端 Vue 3.5 + TypeScript + Vite + Element Plus
server/      后端 FastAPI + SQLite
scripts/     打包与部署
docs/        设计与部署文档
```

数据有两层落点：核心的项目、排期、账号在服务端建了关系表，服务端负责校验和判重；
其余长尾表走通用的整表读写接口。前端始终先写 localStorage 再异步推送，所以后端
连不上时页面照常能用，只是不同步。

## 本地启动

后端：

```bash
cd server
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
cp .env.example .env        # 填 DOJO_LLM_API_KEY / RAPIDAPI_KEY / DOJO_AUTH_PASSWORD
.venv/Scripts/python -m uvicorn app.main:app --port 8000
```

前端：

```bash
cd dojo-web
pnpm install
pnpm dev:local              # http://127.0.0.1:5191
```

Vite 已经把 `/api/dojo` 转发到本地 8000，不用额外配代理。

登录账号 `Super`（管理员用 `Admin`）。口令由服务端校验，取 `server/.env` 里的
`DOJO_AUTH_PASSWORD`；该项留空时不启用服务端校验，前端退回本地模式，只适合本机。

## 密钥

模型和 RapidAPI 的密钥只放在 `server/.env`，浏览器侧任何时候都拿不到。前端的
`.env.local` 里那两个不带 `VITE_` 前缀的变量只给 Vite 的 dev 代理用，不会进构建产物。

## 验证

```bash
cd server && .venv/Scripts/python -m pytest -q     # 后端 35 项
cd dojo-web && pnpm build                          # 前端类型检查 + 构建
```
