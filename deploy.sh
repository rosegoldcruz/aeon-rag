#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/aeon-rag"
APP_NAME="aeonops"
BRANCH="main"
COMMIT_MESSAGE="${1:-user commit}"

cd "$APP_DIR"

echo "========================================"
echo " AEON OPS PUSH + DEPLOY"
echo " Commit: $COMMIT_MESSAGE"
echo "========================================"

echo ""
echo "1) Git status..."
git status --short

echo ""
echo "2) Stage..."
git add -A

echo ""
echo "3) Commit..."
git commit -m "$COMMIT_MESSAGE" || echo "No changes to commit."

echo ""
echo "4) Push..."
git push origin "$BRANCH"

echo ""
echo "5) Install..."
pnpm approve-builds --all || true
pnpm install

echo ""
echo "6) Migrate..."
pnpm run migrate || true

echo ""
echo "7) Check..."
pnpm check || true

echo ""
echo "8) Typecheck..."
pnpm exec tsc --noEmit

echo ""
echo "9) Build..."
pnpm build

echo ""
echo "10) Restart PM2..."
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 restart ecosystem.config.cjs --only "$APP_NAME" --update-env
else
  pm2 start ecosystem.config.cjs --env production
fi

echo ""
echo "11) Save PM2..."
pm2 save

echo ""
echo "12) Verify..."
pm2 list
sleep 3
curl -I http://127.0.0.1:3000 || true
curl -I https://aeonops.com || true
curl -I https://www.aeonops.com || true

echo ""
echo "========================================"
echo " AEON OPS PUSH + DEPLOY COMPLETE"
echo "========================================"
