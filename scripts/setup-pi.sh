#!/usr/bin/env bash
# Idempotent Raspberry Pi install for the house kiosk.
# Safe to re-run. Does not require being in /home/pi — uses this repo's path.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_USER="${SUDO_USER:-${USER}}"
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
if [ -z "$TARGET_HOME" ]; then
  TARGET_HOME="$HOME"
fi

echo "House kiosk setup"
echo "  project : $ROOT"
echo "  user    : $TARGET_USER"
echo "  home    : $TARGET_HOME"

chmod +x "$ROOT"/scripts/*.sh

need_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "Some steps want sudo (packages, raspi-config). Re-run with: sudo $0" >&2
    return 1
  fi
}

# ---------- packages ----------
if [ "$(id -u)" -eq 0 ]; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y python3 curl
  apt-get install -y chromium || apt-get install -y chromium-browser || true
  apt-get install -y unclutter || apt-get install -y unclutter-xfixes || true
  apt-get install -y wlr-randr || true
else
  echo "Skipping apt (not root). Install later: python3 chromium unclutter wlr-randr"
fi

# ---------- autologin + blanking (best-effort) ----------
if [ "$(id -u)" -eq 0 ] && command -v raspi-config >/dev/null 2>&1; then
  # B4 = desktop autologin on Raspberry Pi OS.
  raspi-config nonint do_boot_behaviour B4 || true
  # 1 = disable screen blanking on current raspi-config; ignore if the flag flipped.
  # 1 == No on the 'enable screen blanking?' prompt.
  raspi-config nonint do_blanking 1 || true
fi

# ---------- X11 blanking + rotation on graphical login ----------
AUTOSTART_DIR="$TARGET_HOME/.config/autostart"
mkdir -p "$AUTOSTART_DIR"

cat > "$AUTOSTART_DIR/house-kiosk.desktop" << EOF
[Desktop Entry]
Type=Application
Name=House Kiosk
Comment=Portrait house dashboard
Exec=$ROOT/scripts/start.sh
X-GNOME-Autostart-enabled=true
StartupNotify=false
Terminal=false
EOF

# ---------- Wayland / labwc (Raspberry Pi OS Bookworm default) ----------
LABWC_DIR="$TARGET_HOME/.config/labwc"
mkdir -p "$LABWC_DIR"

# labwc concatenates system + user autostart. Rotation + no idle blank.
AUTOSTART_FILE="$LABWC_DIR/autostart"
touch "$AUTOSTART_FILE"
# Remove previous house-kiosk blocks, then append a fresh one.
if grep -q "house-kiosk" "$AUTOSTART_FILE" 2>/dev/null; then
  tmp="$(mktemp)"
  awk 'BEGIN{skip=0} /# house-kiosk begin/{skip=1} !skip{print} /# house-kiosk end/{skip=0; next}' \
    "$AUTOSTART_FILE" > "$tmp"
  mv "$tmp" "$AUTOSTART_FILE"
fi
cat >> "$AUTOSTART_FILE" << EOF
# house-kiosk begin
# HDMI-A-1 is Wayland; HDMI-1 is the X11 name. Try both.
wlr-randr --output HDMI-A-1 --transform 90 >/dev/null 2>&1 || \\
wlr-randr --output HDMI-1 --transform 90 >/dev/null 2>&1 || \\
wlr-randr --output HDMI-A-2 --transform 90 >/dev/null 2>&1 || true
# If the picture is the wrong way, change 90 to 270 (or run scripts/rotate-display.sh right).
# house-kiosk end
EOF

# labwc: hide the cursor after a moment of stillness (supported on recent labwc).
RC="$LABWC_DIR/rc.xml"
if [ ! -f "$RC" ]; then
  cat > "$RC" << 'EOF'
<?xml version="1.0"?>
<labwc_config>
  <core>
    <gap>0</gap>
  </core>
</labwc_config>
EOF
fi

# ---------- wayfire.ini (older Bookworm desktop compositor) ----------
WAYFIRE="$TARGET_HOME/.config/wayfire.ini"
mkdir -p "$(dirname "$WAYFIRE")"
touch "$WAYFIRE"
if ! grep -q "house-kiosk" "$WAYFIRE" 2>/dev/null; then
  cat >> "$WAYFIRE" << 'EOF'

# house-kiosk — rotate the HDMI panel 90° (portrait).
# If this is the wrong direction, use transform = 270.
[output:HDMI-A-1]
transform = 90

[output:HDMI-1]
transform = 90
EOF
fi

# ---------- X11 xrandr on session start (Openbox / LXDE-pi fallback) ----------
XPROFILE="$TARGET_HOME/.xprofile"
touch "$XPROFILE"
if ! grep -q "house-kiosk" "$XPROFILE" 2>/dev/null; then
  cat >> "$XPROFILE" << EOF
# house-kiosk
xset s off; xset s noblank; xset -dpms
xrandr --output HDMI-1 --rotate left 2>/dev/null || xrandr --output HDMI-A-1 --rotate left 2>/dev/null || true
EOF
fi

# ---------- systemd user service ----------
UNIT_DIR="$TARGET_HOME/.config/systemd/user"
mkdir -p "$UNIT_DIR"
cat > "$UNIT_DIR/house-kiosk.service" << EOF
[Unit]
Description=House kiosk display
After=graphical-session.target
PartOf=graphical-session.target

[Service]
Type=simple
WorkingDirectory=$ROOT
Environment=DISPLAY=:0
Environment=WAYLAND_DISPLAY=wayland-0
Environment=XDG_RUNTIME_DIR=/run/user/%U
ExecStart=$ROOT/scripts/start.sh
Restart=on-failure
RestartSec=4

[Install]
WantedBy=graphical-session.target
EOF

# Desktop file is the reliable autostart on Pi OS. Enable linger so a user
# systemd service can also come up after autologin.
if command -v loginctl >/dev/null 2>&1; then
  if [ "$(id -u)" -eq 0 ]; then
    loginctl enable-linger "$TARGET_USER" || true
  else
    loginctl enable-linger "$TARGET_USER" 2>/dev/null || true
  fi
fi

if [ "$TARGET_USER" = "$(id -un)" ]; then
  systemctl --user daemon-reload 2>/dev/null || true
  systemctl --user enable house-kiosk.service 2>/dev/null || true
fi

# Ownership if we ran as root
if [ "$(id -u)" -eq 0 ]; then
  chown -R "$TARGET_USER:$TARGET_USER" \
    "$TARGET_HOME/.config/autostart" \
    "$TARGET_HOME/.config/labwc" \
    "$TARGET_HOME/.config/systemd" \
    "$WAYFIRE" "$XPROFILE" 2>/dev/null || true
fi

echo
echo "Done."
echo "  Autostart desktop file : $AUTOSTART_DIR/house-kiosk.desktop"
echo "  labwc autostart        : $LABWC_DIR/autostart  (wlr-randr HDMI-A-1 transform 90)"
echo "  systemd user unit      : $UNIT_DIR/house-kiosk.service"
echo
echo "HDMI names: X11 usually HDMI-1; Wayland/labwc usually HDMI-A-1."
echo "If the TV is rotated the other way:  $ROOT/scripts/rotate-display.sh right"
echo "  …and change transform 90 → 270 in $LABWC_DIR/autostart (and wayfire.ini)."
echo
echo "Preview now (from a graphical session):"
echo "  $ROOT/scripts/start.sh"
echo
echo "Autologin: sudo raspi-config  →  System Options  →  Boot / Auto Login  →  Desktop autologin"
