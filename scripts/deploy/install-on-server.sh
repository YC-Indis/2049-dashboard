#!/bin/bash
# Dojo 前端 · Ubuntu 一键安装
# 前置：/root/dojo-web-release.tgz 或 .tar.gz 已上传
set -euo pipefail

RELEASE=""
for candidate in /root/dojo-web-release.tar.gz /root/dojo-web-release.tgz; do
  if [[ -f "$candidate" ]]; then
    RELEASE="$candidate"
    break
  fi
done

STAGE="/tmp/dojo-web-release"
WEB_ROOT="/var/www/dojo"
SECRETS="/etc/dojo/secrets.env"
NGINX_SITE="/etc/nginx/sites-available/dojo"

echo "==> 安装 nginx / rsync"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y nginx rsync curl

if [[ -z "$RELEASE" ]]; then
  echo "错误: 请先上传 /root/dojo-web-release.tgz（或 .tar.gz）"
  exit 1
fi

echo "==> 解压 $RELEASE"
rm -rf "$STAGE"
tar -xzf "$RELEASE" -C /tmp

echo "==> 密钥 /etc/dojo/secrets.env"
mkdir -p /etc/dojo
if [[ ! -f "$SECRETS" ]]; then
  if [[ -f "$STAGE/secrets.env" ]]; then
    cp "$STAGE/secrets.env" "$SECRETS"
    chmod 600 "$SECRETS"
    echo "    已从发布包复制 $SECRETS"
  elif [[ -f "$STAGE/secrets.env.example" ]]; then
    cp "$STAGE/secrets.env.example" "$SECRETS"
  else
    cat > "$SECRETS" <<'EOF'
DEEPSEEK_API_KEY=sk-REPLACE_ME
RAPIDAPI_KEY=REPLACE_ME
EOF
  fi
  chmod 600 "$SECRETS"
  echo "    已创建 $SECRETS — 请 nano 编辑密钥后重新运行本脚本"
  exit 0
fi
# shellcheck disable=SC1090
source "$SECRETS"
if [[ "$DEEPSEEK_API_KEY" == *REPLACE* ]]; then
  echo "    请编辑 $SECRETS 填入真实密钥后再运行"
  exit 1
fi

echo "==> 部署静态文件 -> $WEB_ROOT"
mkdir -p "$WEB_ROOT"
rsync -a --delete "$STAGE/dist/" "$WEB_ROOT/"

echo "==> Nginx"
sed \
  -e "s|__DEEPSEEK_KEY__|${DEEPSEEK_API_KEY}|g" \
  -e "s|__RAPIDAPI_KEY__|${RAPIDAPI_KEY}|g" \
  "$STAGE/nginx-dojo.conf" > "$NGINX_SITE"
ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/dojo
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t
systemctl enable nginx
systemctl reload nginx

IP=$(curl -s --max-time 3 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
echo ""
echo "=========================================="
echo " Dojo 已上线: http://${IP}/"
echo " 登录 Super / 123456"
echo " 静态目录: $WEB_ROOT"
echo "=========================================="
