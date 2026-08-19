#!/bin/bash
# Dojo 前端 · Ubuntu 一键安装（强制用最新包完整替换旧站）
# 前置：dojo-web-release.tgz / .tar.gz 已上传到 /root 或 /home/ubuntu
set -euo pipefail

STAGE="/tmp/dojo-web-release"
WEB_ROOT="/var/www/dojo"
SECRETS="/etc/dojo/secrets.env"
NGINX_SITE="/etc/nginx/sites-available/dojo"

echo "==> 安装 nginx / rsync"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y nginx rsync curl

# 在常见上传位置里，按修改时间选最新的包（避免 /root 旧包盖住家目录新包）
RELEASE=""
BEST_MTIME=0
for candidate in \
  /root/dojo-web-release.tgz \
  /root/dojo-web-release.tar.gz \
  /home/ubuntu/dojo-web-release.tgz \
  /home/ubuntu/dojo-web-release.tar.gz \
  "$HOME/dojo-web-release.tgz" \
  "$HOME/dojo-web-release.tar.gz"
do
  if [[ -f "$candidate" ]]; then
    mtime=$(stat -c %Y "$candidate" 2>/dev/null || stat -f %m "$candidate")
    echo "    发现包: $candidate (mtime=$mtime)"
    if (( mtime >= BEST_MTIME )); then
      BEST_MTIME=$mtime
      RELEASE=$candidate
    fi
  fi
done

if [[ -z "$RELEASE" ]]; then
  echo "错误: 找不到发布包。请先上传 dojo-web-release.tgz 到 /root/ 或家目录"
  exit 1
fi

echo "==> 选用最新包: $RELEASE"
# 同步一份到 /root，避免下次又捡到旧文件（已是 /root 同文件时跳过，否则 set -e 会直接退出）
if [[ "$RELEASE" != "/root/dojo-web-release.tgz" ]]; then
  cp -f "$RELEASE" /root/dojo-web-release.tgz
fi
RELEASE=/root/dojo-web-release.tgz

echo "==> 解压并清空旧暂存"
rm -rf "$STAGE"
mkdir -p /tmp
tar -xzf "$RELEASE" -C /tmp
# 兼容包内目录名
if [[ ! -d "$STAGE" ]]; then
  found=$(find /tmp -maxdepth 2 -type d -name 'dojo-web-release' | head -1 || true)
  if [[ -n "$found" ]]; then
    STAGE=$found
  else
    echo "错误: 解压后未找到 dojo-web-release 目录"
    exit 1
  fi
fi

if [[ -f "$STAGE/dist/VERSION.txt" ]]; then
  echo "==> 包内版本:"
  sed 's/^/    /' "$STAGE/dist/VERSION.txt"
fi

echo "==> 密钥 /etc/dojo/secrets.env"
mkdir -p /etc/dojo
if [[ ! -f "$SECRETS" ]]; then
  if [[ -f "$STAGE/secrets.env" ]]; then
    cp "$STAGE/secrets.env" "$SECRETS"
    chmod 600 "$SECRETS"
    echo "    已从发布包复制 $SECRETS"
  elif [[ -f "$STAGE/secrets.env.example" ]]; then
    cp "$STAGE/secrets.env.example" "$SECRETS"
    chmod 600 "$SECRETS"
  else
    cat > "$SECRETS" <<'EOF'
DEEPSEEK_API_KEY=sk-REPLACE_ME
RAPIDAPI_KEY=REPLACE_ME
EOF
    chmod 600 "$SECRETS"
  fi
  echo "    已创建 $SECRETS — 请 nano 编辑密钥后重新运行本脚本"
  exit 0
fi
# shellcheck disable=SC1090
source "$SECRETS"
if [[ "${DEEPSEEK_API_KEY:-}" == *REPLACE* ]]; then
  echo "    请编辑 $SECRETS 填入真实密钥后再运行"
  exit 1
fi

echo "==> 完整替换静态站 $WEB_ROOT（删除旧文件）"
mkdir -p "$WEB_ROOT"
# 先清空再同步，确保没有残留旧 chunk
find "$WEB_ROOT" -mindepth 1 -delete 2>/dev/null || rm -rf "${WEB_ROOT:?}/"*
rsync -a --delete "$STAGE/dist/" "$WEB_ROOT/"

echo "==> Nginx（覆盖站点配置）"
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
echo " Dojo 已用最新包替换上线: http://${IP}/"
echo " 登录口令见 /etc/dojo/secrets.env"
echo " 静态目录: $WEB_ROOT"
if [[ -f "$WEB_ROOT/VERSION.txt" ]]; then
  echo " 线上版本:"
  sed 's/^/   /' "$WEB_ROOT/VERSION.txt"
fi
echo "=========================================="
