#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT/artifacts/api-server"
APP_DIR="$ROOT/artifacts/gymquest"

if [[ ! -f "$API_DIR/package.json" ]]; then
  echo "Hata: $API_DIR bulunamadi."
  exit 1
fi
if [[ ! -f "$APP_DIR/package.json" ]]; then
  echo "Hata: $APP_DIR bulunamadi."
  exit 1
fi

echo ""
echo "=== Gym-Quest: API + Expo (temiz cache) ==="
echo ""

cleanup() {
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" 2>/dev/null; then kill "$API_PID" 2>/dev/null || true; fi
  if [[ -n "${EXPO_PID:-}" ]] && kill -0 "$EXPO_PID" 2>/dev/null; then kill "$EXPO_PID" 2>/dev/null || true; fi
}
trap cleanup INT TERM

(
  cd "$API_DIR"
  echo "[API] npm run dev"
  npm run dev
) &
API_PID=$!

sleep 2

(
  cd "$APP_DIR"
  echo "[Expo] npx expo start --clear"
  npx expo start --clear
) &
EXPO_PID=$!

wait "$API_PID" "$EXPO_PID" 2>/dev/null || wait
