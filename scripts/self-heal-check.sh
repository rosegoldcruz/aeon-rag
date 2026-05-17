#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/aeon-rag"
APP_NAME="aeonops"
WATCHDOG_NAME="aeonops-watchdog"
HEALTH_URL="${AEON_HEALTH_URL:-http://127.0.0.1:3000/api/health}"

cd "$APP_DIR"

start_app_if_missing() {
  if ! pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    pm2 start ecosystem.config.cjs --only "$APP_NAME" --env production
  fi
}

start_watchdog_if_missing() {
  if ! pm2 describe "$WATCHDOG_NAME" >/dev/null 2>&1; then
    pm2 start ecosystem.config.cjs --only "$WATCHDOG_NAME" --env production
  fi
}

start_app_if_missing
start_watchdog_if_missing

if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
  exit 0
fi

pm2 restart "$APP_NAME" --update-env || true

for _ in {1..20}; do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    exit 0
  fi
  sleep 1
done

pm2 resurrect || true

if ! pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 start ecosystem.config.cjs --only "$APP_NAME" --env production
fi

if ! pm2 describe "$WATCHDOG_NAME" >/dev/null 2>&1; then
  pm2 start ecosystem.config.cjs --only "$WATCHDOG_NAME" --env production
fi

pm2 save || true

for _ in {1..20}; do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    exit 0
  fi
  sleep 1
done

exit 1
