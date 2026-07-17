#!/bin/zsh
set -e

ROOT_DIR="${0:A:h}"
cd "$ROOT_DIR"

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi

API_PORT="${PORT:-8080}"
WEB_PORT="${XUNMENG_WEB_PORT:-3001}"

cleanup() {
  [[ -n "${API_PID:-}" ]] && kill "$API_PID" 2>/dev/null || true
  [[ -n "${WEB_PID:-}" ]] && kill "$WEB_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

(
  cd "$ROOT_DIR/artifacts/api-server"
  PORT="$API_PORT" NODE_ENV=development pnpm run dev
) &
API_PID=$!

(
  cd "$ROOT_DIR/artifacts/xun-meng"
  PORT="$WEB_PORT" BASE_PATH=/ API_PROXY_TARGET="http://localhost:$API_PORT" pnpm run dev
) &
WEB_PID=$!

echo "巡梦前端: http://localhost:$WEB_PORT"
echo "巡梦 API: http://localhost:$API_PORT"
echo "按 Ctrl+C 可同时停止两个服务。"

wait
