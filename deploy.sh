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
echo "PRIVATE ARTIFACT PREFLIGHT..."
if git ls-files | grep -E '(^storage/manifests/|^storage/imports/|^storage/uploads/|\.jsonl$|\.tsv$|tsconfig\.tsbuildinfo$)' >/dev/null 2>&1; then
  echo "Blocked: private/generated RAG artifacts are tracked by Git."
  git ls-files | grep -E '(^storage/manifests/|^storage/imports/|^storage/uploads/|\.jsonl$|\.tsv$|tsconfig\.tsbuildinfo$)' || true
  exit 1
fi

echo "1) Git status..."
git status --short

echo "2) Stage..."
git add -A

echo "3) Commit..."
git commit -m "$COMMIT_MESSAGE" || echo "No changes to commit."

echo "4) Push..."
git push origin "$BRANCH"

echo "5) Approve pnpm builds..."
pnpm approve-builds --all || true

echo "6) Install..."
pnpm install

echo "7) RAG migration..."
if node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts['rag:migrate'] ? 0 : 1)" 2>/dev/null; then
  pnpm run rag:migrate
else
  echo "No rag:migrate script configured, skipping."
fi

echo "8) Check..."
if node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts.check ? 0 : 1)" 2>/dev/null; then
  pnpm check || true
else
  echo "No check script configured, skipping."
fi

echo "9) Typecheck..."
pnpm exec tsc --noEmit

echo "10) Build..."
pnpm build

echo "11) Restart PM2..."
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 restart ecosystem.config.cjs --only "$APP_NAME" --update-env
else
  pm2 start ecosystem.config.cjs --env production
fi

echo "12) Save PM2..."
pm2 save

echo "13) Verify..."
pm2 list

echo "Waiting for local app on port 3000..."
for i in {1..30}; do
  if curl -fsS -I http://127.0.0.1:3000 >/dev/null 2>&1; then
    echo "Local app is responding."
    break
  fi
  sleep 1
done

curl -I http://127.0.0.1:3000 || true
curl -I http://aeonops.com || true
curl -I https://aeonops.com || true
curl -I https://www.aeonops.com || true
curl -I https://aeonops.com/api/models || true

echo "========================================"
echo " AEON OPS PUSH + DEPLOY COMPLETE"
echo "========================================"
