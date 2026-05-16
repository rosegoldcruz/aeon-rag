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
echo " App: $APP_DIR"
echo " Branch: $BRANCH"
echo "========================================"

echo ""
echo "1) Git status before staging..."
git status --short

echo ""
echo "2) Stage all changes..."
git add -A

echo ""
echo "3) Commit changes..."
git commit -m "$COMMIT_MESSAGE" || echo "No changes to commit."

echo ""
echo "4) Push to GitHub..."
git push origin "$BRANCH"

echo ""
echo "5) Approve pnpm builds if required..."
pnpm approve-builds --all || true

echo ""
echo "6) Install dependencies..."
pnpm install

echo ""
echo "7) Run migration if present..."
pnpm run migrate || true

echo ""
echo "8) Run project check if present..."
pnpm check || true

echo ""
echo "9) TypeScript check..."
pnpm exec tsc --noEmit

echo ""
echo "10) Build production app..."
pnpm build

echo ""
echo "11) Restart PM2..."
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 restart ecosystem.config.cjs --only "$APP_NAME" --update-env
else
  pm2 start ecosystem.config.cjs --env production
fi

echo ""
echo "12) Save PM2 process list..."
pm2 save

echo ""
echo "13) PM2 status..."
pm2 list

echo ""
echo "14) Health checks..."
sleep 3

echo ""
echo "Local app:"
curl -I http://127.0.0.1:3000 || true

echo ""
echo "Apex HTTPS:"
curl -I https://aeonops.com || true

echo ""
echo "WWW HTTPS:"
curl -I https://www.aeonops.com || true

echo ""
echo "Models endpoint:"
curl -I https://aeonops.com/api/models || true

echo ""
echo "15) Final git status..."
git status --short

echo ""
echo "========================================"
echo " AEON OPS PUSH + DEPLOY COMPLETE"
echo "========================================"
