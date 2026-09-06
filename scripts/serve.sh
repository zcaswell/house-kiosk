#!/usr/bin/env bash
# Tiny static server for the house kiosk. file:// cannot fetch events.json.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT="${KIOSK_PORT:-8080}"
BIND="${KIOSK_BIND:-127.0.0.1}"
echo "Serving $ROOT on http://${BIND}:${PORT}/"
exec python3 -m http.server "$PORT" --bind "$BIND" --directory "$ROOT"
