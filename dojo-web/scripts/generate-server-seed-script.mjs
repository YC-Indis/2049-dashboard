/**
 * 生成 scripts/deploy/server-apply-seed.sh
 * 运行: node scripts/generate-server-seed-script.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.join(__dirname, '..')
const seedPath = path.join(webRoot, 'public', 'dojo-seed.json')
const outSh = path.join(webRoot, '..', 'scripts', 'deploy', 'server-apply-seed.sh')
const outOneliner = path.join(webRoot, '..', 'scripts', 'deploy', 'server-apply-seed-oneliner.txt')

if (!fs.existsSync(seedPath)) {
  console.error('missing', seedPath)
  process.exit(1)
}

const seedB64 = fs.readFileSync(seedPath).toString('base64')

const sh = `#!/bin/bash
# Dojo · 仅服务器执行：写入业务种子 + 注入首访 bootstrap
# 用法: bash server-apply-seed.sh
# 可选: bash server-apply-seed.sh --redeploy   # 若 /root/dojo-web-release.tar.gz 已是新版
set -euo pipefail

WEB="/var/www/dojo"
SEED="$WEB/dojo-seed.json"
INDEX="$WEB/index.html"
TARBALL="/root/dojo-web-release.tar.gz"

if [[ "\${1:-}" == "--redeploy" ]]; then
  if [[ ! -f "$TARBALL" ]]; then
    echo "错误: 找不到 $TARBALL ，请先上传到服务器 /root/"
    exit 1
  fi
  echo "==> 全量重装（保留 /etc/dojo/secrets.env）"
  systemctl stop nginx 2>/dev/null || true
  rm -rf /var/www/dojo
  mkdir -p /var/www/dojo
  rm -rf /tmp/dojo-web-release
  tar -xzf "$TARBALL" -C /tmp
  rsync -a --delete /tmp/dojo-web-release/dist/ "$WEB/"
  bash /tmp/dojo-web-release/install-on-server.sh || true
fi

echo "==> 写入 $SEED"
mkdir -p "$WEB"
echo '${seedB64}' | base64 -d > "$SEED"
chmod 644 "$SEED"
echo "    size: \$(wc -c < \"\$SEED\") bytes"

if [[ ! -f "$INDEX" ]]; then
  echo "错误: 找不到 $INDEX"
  exit 1
fi

if grep -q 'dojo-seed.json' "$INDEX"; then
  echo "==> index.html 已有 bootstrap，跳过"
else
  echo "==> 注入 index.html bootstrap"
  python3 - <<'PY'
from pathlib import Path

index = Path("/var/www/dojo/index.html")
html = index.read_text(encoding="utf-8")
snippet = """    <script>
      ;(function () {
        try {
          if (typeof Storage === 'undefined' || !window.localStorage) return
          var raw = localStorage.getItem('dojo:v1:projects')
          if (raw) {
            try {
              var env = JSON.parse(raw)
              if (env && Array.isArray(env.data) && env.data.length > 0) return
            } catch (e) {}
          }
          var xhr = new XMLHttpRequest()
          xhr.open('GET', '/dojo-seed.json', false)
          xhr.send(null)
          if (xhr.status < 200 || xhr.status >= 300 || !xhr.responseText) return
          var dump = JSON.parse(xhr.responseText)
          Object.keys(dump).forEach(function (k) {
            if (dump[k] != null) localStorage.setItem(k, dump[k])
          })
        } catch (e) {
          console.warn('Dojo seed bootstrap skipped:', e)
        }
      })()
    </script>
"""
marker = '<script type="module"'
if marker not in html:
    raise SystemExit('index.html 结构异常，找不到 module script')
html = html.replace(marker, snippet + marker, 1)
index.write_text(html, encoding="utf-8")
print("    patched")
PY
fi

echo "==> 重载 nginx"
nginx -t
systemctl reload nginx || systemctl start nginx

echo ""
echo "=========================================="
echo " 完成"
echo " 种子: $SEED"
echo " 项目: XROS 6 英国2.0 / 德国1.0"
echo " 打开: http://$(curl -s --max-time 3 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')/"
echo " 若浏览器仍空：无痕窗口，或 Console 清 dojo:v1:* 后刷新"
echo " 验收: curl -sI http://127.0.0.1/dojo-seed.json | head -3"
echo "=========================================="
curl -sI http://127.0.0.1/dojo-seed.json | sed -n '1,4p' || true
`

fs.mkdirSync(path.dirname(outSh), { recursive: true })
fs.writeFileSync(outSh, sh.replace(/\r\n/g, '\n'), 'utf8')
fs.chmodSync(outSh, 0o755)

const oneliner = `curl -fsSL https://raw.githubusercontent.com/PLACEHOLDER/server-apply-seed.sh | bash`
// 本地无法托管时，用 base64 单行安装包
const onelinerB64 = `echo '${Buffer.from(sh).toString('base64')}' | base64 -d | bash`

fs.writeFileSync(
  outOneliner,
  `# 在服务器 SSH 里粘贴执行（一行）:\n${onelinerB64}\n`,
  'utf8'
)

console.log('wrote', outSh, fs.statSync(outSh).size)
console.log('wrote', outOneliner)
console.log('oneliner bytes', onelinerB64.length)
