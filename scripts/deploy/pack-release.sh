#!/usr/bin/env bash
# Linux/macOS 打包，产物与 pack-release.ps1 一致
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WEB="$ROOT/dojo-web"
RELEASE="$ROOT/release"
STAGE="$RELEASE/dojo-web-release"

cd "$WEB"
echo ">> pnpm install (if needed) && build"
if command -v pnpm >/dev/null 2>&1; then
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
  pnpm exec vue-tsc --noEmit
  pnpm exec vite build
else
  npm ci 2>/dev/null || npm install
  npx vue-tsc --noEmit
  npx vite build
fi

echo ">> stage release"
rm -rf "$STAGE"
mkdir -p "$STAGE/dist"
cp -a "$WEB/dist/." "$STAGE/dist/"
cp "$ROOT/scripts/deploy/nginx-dojo.conf" "$STAGE/"
cp "$ROOT/scripts/deploy/install-on-server.sh" "$STAGE/"
cp "$ROOT/scripts/deploy/secrets.env.example" "$STAGE/"

MAIN_JS=$(grep -oE 'index-[^"]+\.js' "$WEB/dist/index.html" | head -1 || echo unknown)
REVIEW_JS=$(ls "$WEB/dist/assets"/review-*.js 2>/dev/null | xargs -n1 basename | head -1 || echo unknown)
cat > "$WEB/dist/VERSION.txt" <<EOF
built_at=$(date '+%Y-%m-%d %H:%M:%S')
main_js=$MAIN_JS
review_js=$REVIEW_JS
EOF
cp "$WEB/dist/VERSION.txt" "$STAGE/dist/VERSION.txt"

mkdir -p "$RELEASE"
rm -f "$RELEASE/dojo-web-release.tgz" "$RELEASE/dojo-web-release.tar.gz"
tar -czf "$RELEASE/dojo-web-release.tgz" -C "$RELEASE" dojo-web-release
cp "$RELEASE/dojo-web-release.tgz" "$RELEASE/dojo-web-release.tar.gz"

echo ""
echo "Release: $RELEASE/dojo-web-release.tgz"
echo "Release: $RELEASE/dojo-web-release.tar.gz"
echo "VERSION main_js=$MAIN_JS"
