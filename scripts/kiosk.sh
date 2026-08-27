#!/usr/bin/env bash
# Full-screen Chromium/Chrome kiosk pointing at the local server.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
URL="${KIOSK_URL:-http://127.0.0.1:8080/}"
PROFILE="${KIOSK_PROFILE:-${XDG_CACHE_HOME:-$HOME/.cache}/house-kiosk-chromium}"
mkdir -p "$PROFILE"

# Hide the pointer on X11. Wayland relies on CSS cursor:none.
if command -v unclutter >/dev/null 2>&1; then
  pkill -x unclutter >/dev/null 2>&1 || true
  unclutter -idle 0.3 -root >/dev/null 2>&1 &
elif command -v unclutter-remote >/dev/null 2>&1; then
  true
fi

# Stop the panel from blanking while the kiosk is up (X11).
if command -v xset >/dev/null 2>&1 && [ -n "${DISPLAY:-}" ]; then
  xset s off >/dev/null 2>&1 || true
  xset s noblank >/dev/null 2>&1 || true
  xset -dpms >/dev/null 2>&1 || true
fi

CHROME=""
for c in chromium-browser chromium google-chrome google-chrome-stable; do
  if command -v "$c" >/dev/null 2>&1; then
    CHROME="$(command -v "$c")"
    break
  fi
done
if [ -z "$CHROME" ]; then
  echo "No Chromium/Chrome found. Install chromium (Bookworm: sudo apt install chromium)." >&2
  exit 1
fi

# Wait until the local server answers so the first paint is not a failed fetch.
for _ in $(seq 1 50); do
  if command -v curl >/dev/null 2>&1; then
    curl -sf -o /dev/null "$URL" && break
  else
    python3 - "$URL" << 'PY' && break
import sys, urllib.request
urllib.request.urlopen(sys.argv[1], timeout=1)
PY
  fi
  sleep 0.2
done

exec "$CHROME" \
  --kiosk \
  --app="$URL" \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-restore-session-state \
  --check-for-update-interval=31536000 \
  --user-data-dir="$PROFILE" \
  --no-first-run \
  --no-default-browser-check \
  --disable-translate \
  --disable-features=Translate,TranslateUI \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --autoplay-policy=no-user-gesture-required \
  --password-store=basic \
  --disable-dev-shm-usage \
  --start-fullscreen
