#!/usr/bin/env bash
# Boot helper: rotate the panel, serve the site, then open the kiosk browser.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${KIOSK_PORT:-8080}"

if [ -x "$ROOT/scripts/rotate-display.sh" ]; then
  "$ROOT/scripts/rotate-display.sh" "${KIOSK_ROTATE:-left}" || true
fi

if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" >/dev/null 2>&1 || true
fi

"$ROOT/scripts/serve.sh" &
SERVE_PID=$!
cleanup() {
  kill "$SERVE_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

# Not exec: kiosk.sh execs Chromium; we wait so cleanup can stop the server.
"$ROOT/scripts/kiosk.sh"
