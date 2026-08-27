#!/usr/bin/env bash
# Portrait rotation for a 16:9 TV stood on its side.
# Default "left" matches: xrandr --output HDMI-1 --rotate left
# If the picture is upside-down or the floor is at the top, run:
#   scripts/rotate-display.sh right
set -u

DIR="${1:-left}"
case "$DIR" in
  left|90)   XROT="left";  WL="90"  ;;
  right|270) XROT="right"; WL="270" ;;
  normal|0)  XROT="normal"; WL="normal" ;;
  inverted|180) XROT="inverted"; WL="180" ;;
  *)
    echo "Usage: $0 [left|right|normal|inverted]" >&2
    exit 1
    ;;
esac

# HDMI names differ: X11 often HDMI-1 / HDMI-2; Wayland/labwc uses HDMI-A-1.
OUTPUTS="HDMI-1 HDMI-2 HDMI-A-1 HDMI-A-2 HDMI-1-1 HDMI-2-1"

rotated=""

if [ -n "${DISPLAY:-}" ] && command -v xrandr >/dev/null 2>&1; then
  for out in $OUTPUTS; do
    if xrandr --output "$out" --rotate "$XROT" >/dev/null 2>&1; then
      echo "X11: rotated $out $XROT"
      rotated=1
      break
    fi
  done
  if [ -z "$rotated" ]; then
    connected="$(xrandr 2>/dev/null | awk '/ connected/{print $1; exit}')"
    if [ -n "$connected" ] && xrandr --output "$connected" --rotate "$XROT" >/dev/null 2>&1; then
      echo "X11: rotated $connected $XROT"
      rotated=1
    fi
  fi
fi

if command -v wlr-randr >/dev/null 2>&1; then
  for out in $OUTPUTS; do
    if wlr-randr --output "$out" --transform "$WL" >/dev/null 2>&1; then
      echo "Wayland: transformed $out $WL"
      rotated=1
      break
    fi
  done
  if [ -z "$rotated" ]; then
    first="$(wlr-randr 2>/dev/null | awk '/^[^ ]/{print $1; exit}')"
    if [ -n "$first" ] && wlr-randr --output "$first" --transform "$WL" >/dev/null 2>&1; then
      echo "Wayland: transformed $first $WL"
      rotated=1
    fi
  fi
fi

if [ -z "$rotated" ]; then
  echo "No live output accepted rotation (tried HDMI-1 and HDMI-A-1). The setup script still writes autostart copies." >&2
  exit 0
fi
