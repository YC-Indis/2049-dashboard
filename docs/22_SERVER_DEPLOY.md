# 服务器部署指南

> **生产环境（2026-08-08 已上线）**  
> **团队入口**：http://dojo-vibing.duckdns.org/  
> **备用 IP**：http://129.226.147.77/  
> **登录**：Super / 123456  
> **服务器**：腾讯云轻量 · Ubuntu · OrcaTerm `root@VM-4-12-ubuntu`

---

## 一、访问地址（发给团队）

```text
Dojo 中控台：http://dojo-vibing.duckdns.org/
账号：Super
密码：123456
```

- 在浏览器**地址栏输入或点击链接**即可，**不需要 Google / 百度 SEO**。
- DuckDNS 免费域名指向服务器 IP；IP 直连仍可用作备用。

---

## 二、域名说明（DuckDNS · 免费）

| 项目 | 值 |
|------|-----|
| 域名 | `dojo-vibing.duckdns.org` |
| 解析服务 | [DuckDNS](https://www.duckdns.org)（免费） |
| 指向 IP | `129.226.147.77` |

**DNS 是什么（一句话）**：把域名翻译成 IP，让团队用名字访问而不是记数字。

### 域名维护

1. 登录 DuckDNS → 选中 `dojo-vibing`
2. **current ip** 填 `129.226.147.77` → 点 **update ip**
3. 若服务器换 IP，只需在 DuckDNS 更新这一条

### Nginx 域名（服务器上应已配置）

```bash
grep server_name /etc/nginx/sites-available/dojo
# 期望：server_name dojo-vibing.duckdns.org;
```

若需修改：

```bash
sed -i 's/server_name .*;/server_name dojo-vibing.duckdns.org;/' /etc/nginx/sites-available/dojo
nginx -t && systemctl restart nginx
```

### 防火墙

腾讯云轻量 → **防火墙** → 入站 **TCP 80**（HTTPS 需再加 443）。

---

## 三、本机打包（Windows）

```powershell
powershell -ExecutionPolicy Bypass -File C:\coding\Dojo\scripts\deploy\pack-release.ps1
```

产物：`C:\coding\Dojo\release\dojo-web-release.tar.gz`

打包脚本会：

- 注入 `.env.local` 中的 `VITE_DEEPSEEK_*` / `VITE_RAPIDAPI_*` 到生产构建
- 生成 `secrets.env`（Nginx 反代用，Unix 换行无 BOM）
- 写入 `VERSION.txt`（含 `main_js` / `review_js` 哈希，便于验收）

---

## 四、上传到服务器

OrcaTerm **文件上传** → `/root/dojo-web-release.tar.gz`（覆盖旧包）

---

## 五、服务器安装 / 更新

**每次更新前端，在 OrcaTerm 依次执行（一次一条，勿粘贴 shell 提示符）：**

```bash
tar -xzf /root/dojo-web-release.tar.gz -C /tmp
bash /tmp/dojo-web-release/install-on-server.sh
```

安装脚本会：

- 安装 `nginx` / `rsync`
- 解压 tar → `rsync --delete` 到 `/var/www/dojo`
- 从发布包写入 `/etc/dojo/secrets.env`（`grep` 读密钥，避免 Windows `\r` / BOM 问题）
- 配置 Nginx（SPA + DeepSeek / RapidAPI 反代）
- 校验 `review-*.js` 等 chunk 是否存在后 `systemctl restart nginx`

### 首次安装若缺密钥

```bash
nano /etc/dojo/secrets.env
# DEEPSEEK_API_KEY=sk-...
# RAPIDAPI_KEY=...
bash /tmp/dojo-web-release/install-on-server.sh
```

### 验收命令

```bash
curl -s http://127.0.0.1/VERSION.txt
curl -sI http://127.0.0.1/assets/review-Cdct2BrE.js | head -1
curl -I http://dojo-vibing.duckdns.org/
```

浏览器 **Ctrl+F5** 强刷后打开：http://dojo-vibing.duckdns.org/#/accounts/review  
应看到蓝色提示「未选项目时展示全部矩阵账号」及账号表格。

---

## 六、仅更新静态文件（不改 Nginx / 密钥）

```bash
tar -xzf /root/dojo-web-release.tar.gz -C /tmp
rsync -a --delete /tmp/dojo-web-release/dist/ /var/www/dojo/
cp /tmp/dojo-web-release/VERSION.txt /var/www/dojo/VERSION.txt
systemctl restart nginx
```

---

## 七、目录说明

| 路径 | 说明 |
|------|------|
| `/var/www/dojo` | 前端静态文件 |
| `/var/www/dojo/VERSION.txt` | 构建版本标识 |
| `/etc/dojo/secrets.env` | DeepSeek / RapidAPI 密钥（权限 600） |
| `/etc/nginx/sites-available/dojo` | Nginx 站点配置 |
| `/root/dojo-web-release.tar.gz` | 最新发布包 |
| `scripts/deploy/nginx-dojo.conf` | Nginx 模板（源码） |
| `scripts/deploy/install-on-server.sh` | 一键安装脚本（源码） |

---

## 八、可选：HTTPS

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d dojo-vibing.duckdns.org
```

之后可用 `https://dojo-vibing.duckdns.org/` 访问。

---

## 九、可选：自有付费域名

若日后购买域名（如 `dojo.xxx.com`），在域名 DNS 添加 **A 记录** → `129.226.147.77`，并把 Nginx `server_name` 改为新域名即可。无需 SEO。

---

## 十、演示页说明

| 页面 | 项目筛选 |
|------|----------|
| 投放检阅 / 视频监控 / 买量监看 | 下拉**留空 = 全部**；与全局筛选隔离 |
| 总账号预览 | 同上；勿使用多余 `<template>` 包裹（曾导致页面空白） |

---

## 十一、故障排查

| 现象 | 处理 |
|------|------|
| `secrets.env: command not found` | 密钥文件含 Windows 换行；重装最新 tar 或 `sed -i 's/\r$//' /etc/dojo/secrets.env` |
| 总账号预览空白 | 确认 `VERSION.txt` 中 `review_js` 与 `/assets/` 下文件一致；强刷浏览器 |
| 域名打不开、IP 能开 | DuckDNS IP 是否仍为 `129.226.147.77`；`ping dojo-vibing.duckdns.org` |
| 终端 `command not found` 一堆 | 勿把 `root@...#` 或 apt 输出粘贴进 bash |

---

*详见 `21_DESIGN_STATUS_AND_PROGRESS.md` · 打包时间见 `/var/www/dojo/VERSION.txt`*
