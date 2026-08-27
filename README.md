# House kiosk

Portrait (9:16) dashboard for a 16:9 TV stood on its end. Built for a Raspberry Pi running Chromium in kiosk mode, hung in Zachary’s house in Shelbyville, Indiana.

It shows a large live clock (America/Indiana/Indianapolis, EST/EDT), live Shelbyville weather from Open-Meteo, and upcoming events from `data/events.json`. Designed to be read from about ten feet. No mouse, no scrollbars, no browser chrome.

## Local preview

`file://` will **not** load events (or some browsers will block the weather fetch). Serve it:

```bash
cd /path/to/house-kiosk
./scripts/serve.sh
```

Then open http://127.0.0.1:8080/

Default bind is `127.0.0.1`. To preview from another machine on the LAN:

```bash
KIOSK_BIND=0.0.0.0 ./scripts/serve.sh
```

## Raspberry Pi install

Assumes Raspberry Pi OS Bookworm **desktop** (Wayland/labwc is the default; X11 still works). Pi 4 or 5 recommended. Copy this folder onto the Pi — there is nothing to compile.

```bash
cd /home/pi/house-kiosk     # or wherever you put it
chmod +x scripts/*.sh
sudo ./scripts/setup-pi.sh
```

The setup script is idempotent. It:

- Installs python3, Chromium, unclutter, wlr-randr when possible
- Asks raspi-config for desktop autologin and to disable screen blanking
- Writes an autostart `.desktop` file so the kiosk starts on graphical login
- Rotates the panel 90° for portrait on **both** X11 (`xrandr --output HDMI-1 --rotate left`) and Wayland/labwc (`wlr-randr --output HDMI-A-1 --transform 90`), plus a wayfire.ini snippet for older Bookworm
- Installs a systemd user service (`house-kiosk.service`) as a second way to start `scripts/start.sh`

Reboot onto a graphical session. `start.sh` launches the tiny server, then Chromium with `--kiosk --app=http://127.0.0.1:8080/`.

Manual start from a graphical login:

```bash
./scripts/start.sh
```

### HDMI port names

| Stack | Typical name | Fallback |
| --- | --- | --- |
| X11 (`xrandr`) | `HDMI-1` | `HDMI-2` |
| Wayland / labwc (`wlr-randr`) | `HDMI-A-1` | `HDMI-A-2` |

If rotation does nothing, list outputs:

```bash
xrandr --query
wlr-randr
```

then edit `~/.config/labwc/autostart` (or `~/.xprofile`) to the name you actually have.

### Flip rotation

If the TV is physically rotated the other way (picture is on its side or the floor is at the top):

```bash
./scripts/rotate-display.sh right
```

And change `transform 90` → `transform 270` in `~/.config/labwc/autostart` (and `transform = 270` in `~/.config/wayfire.ini`). `left` is `xrandr --rotate left` / Wayland `90`; `right` is `270`.

### Screen blanking

Setup tries `raspi-config` and `xset s off`. If the panel still sleeps, in `raspi-config`: Display Options → Screen Blanking → No. On labwc, remove or stretch any `swayidle` timeout in `/etc/xdg/labwc/autostart`.

## Events

Edit `data/events.json` in place (keep the existing shape) and save. The kiosk re-reads it every **5 minutes**. Reload the page to pick up a change immediately.

```json
{
  "updatedAt": "2026-08-27T16:56:13-04:00",
  "location": "Shelbyville, IN",
  "events": [
    {
      "id": "unique-id",
      "title": "Event name",
      "start": "2026-08-27T20:30:00-04:00",
      "end": "2026-08-27T21:30:00-04:00",
      "venue": "Place",
      "city": "Anderson, IN",
      "distanceMiles": 50,
      "category": "park",
      "url": "https://…",
      "notes": "optional"
    }
  ]
}
```

Categories: `sci-fi` · `fantasy` · `anime` · `retro-games` · `convention` · `museum` · `concert` · `fair` · `park` · `movie` · `haunted` · `other`

Ended events (past `end`, or past `start` when there is no `end`) are hidden. The rest are grouped by day and slowly scrolled; no mouse needed.

### Remote feed (optional)

Point the Pi at a hosted JSON file later:

- Query string: `http://127.0.0.1:8080/?events=https://example.com/events.json`
- Or set `EVENTS_URL` in `config.js`

The host must send CORS headers (`Access-Control-Allow-Origin: *`) if it is a different origin. Default is still `./data/events.json`.

## Weather

Live Open-Meteo forecast for Shelbyville, IN (`39.5214, -85.7769`). No API key. Temperatures are never invented: if the network is down, the last successful reading is shown, or a calm “Unavailable” state. Nothing crashes.

## Refresh rates

| What | Interval |
| --- | --- |
| Clock | 1 second |
| Weather | 15 minutes |
| Events file | 5 minutes |

Change them in `config.js` (`clockIntervalMs`, `weatherIntervalMs`, `eventsIntervalMs`). Timezone is `America/Indiana/Indianapolis`.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Page shell |
| `styles.css` | Portrait 1080×1920 / 2160×3840 layout |
| `app.js` | Clock, weather, events, auto-scroll |
| `config.js` | Timezone, coords, intervals, optional `EVENTS_URL` |
| `data/events.json` | Local events feed |
| `scripts/serve.sh` | `python3 -m http.server 8080` |
| `scripts/kiosk.sh` | Chromium/Chrome kiosk flags |
| `scripts/start.sh` | Rotate, serve, then kiosk |
| `scripts/rotate-display.sh` | X11 + Wayland portrait rotation |
| `scripts/setup-pi.sh` | Idempotent Pi bootstrap |

## Pi notes

- Google Fonts (Cormorant Garamond + Source Sans 3) load over the network; Palatino / system sans are the fallback if the Pi is offline.
- Weather still needs network. Events do not, if `data/events.json` is local.
- Chromium on Bookworm is the `chromium` package (not `chromium-browser`).
- `--user-data-dir` is a dedicated profile so Chromium does not nag about crashed sessions. `--incognito` is not used.
- 4K portrait (2160×3840) is a Pi 5 job; 1080×1920 is fine on a Pi 4.
