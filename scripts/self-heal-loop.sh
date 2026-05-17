#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/aeon-rag"
CHECK_SCRIPT="${APP_DIR}/scripts/self-heal-check.sh"
INTERVAL="${SELF_HEAL_INTERVAL_SECONDS:-30}"

cd "$APP_DIR"

while true; do
  bash "$CHECK_SCRIPT" || true
  sleep "$INTERVAL"
done
