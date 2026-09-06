# House kiosk

Portrait (9:16) dashboard for a 16:9 TV stood on its end. Built for a Raspberry Pi running Chromium in kiosk mode — a wall-mounted home display for clock, weather, and upcoming events.

Compact top bar: clock/date upper left, current Open-Meteo weather upper right; events fill the rest (notes shown when present). Footer: location left, events sync time (or offline) right. Default timezone `America/Indiana/Indianapolis` (override in config). Designed for about ten feet. No mouse, no scrollbars, no browser chrome.

## Configure your location (do this on the Pi)

Public `config.js` ships with **example** downtown Indianapolis coordinates and `locationName: "Your city"`. It is a template — not anyone’s home.

On the device:

1. Copy the example local overrides file:
   ```bash
   cp config.local.example.js config.local.js
   ```
2. Edit `config.local.js` and set `timezone`, `latitude`, `longitude`, and `locationName` for your place.
3. Optionally set `EVENTS_URL` (see below).

`config.local.js` is listed in `.gitignore` so personal coords stay off the public repo. Until that file exists, the browser may log a single 404 for `config.local.js`; that is harmless.

You can also edit `config.js` directly on the Pi — just **do not commit or push** personal location data.

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

Then create `config.local.js` from the example and set your location (see above) before relying on weather.

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

This repo also ships optional supplements `data/events-b.json` and `data/events-c.json` (`{ "events": [ … ] }`). `app.js` merges them with the primary file (by sibling path next to `EVENTS_URL` / `./data/events.json`), so the full calendar works without one oversized JSON blob.

```json
{
  "updatedAt": "2026-08-27T16:56:13-04:00",
  "location": "Local area",
  "events": [
    {
      "id": "unique-id",
      "title": "Event name",
      "start": "2026-08-27T20:30:00-04:00",
      "end": "2026-08-27T21:30:00-04:00",
      "venue": "Place",
      "city": "Some City, IN",
      "distanceMiles": 50,
      "category": "park",
      "url": "https://…",
      "notes": "optional"
    }
  ]
}
```

Categories: `convention` · `haunted` · `museum` · `retro-games` · `book` · `fair` · `anime` · `sci-fi` · `fantasy` · `concert` · `park` · `movie` · `other`

Ended events (past `end`, or past `start` when there is no `end`) are hidden. The rest are grouped by day and slowly scrolled; no mouse needed. When an event has `notes`, that text is shown under the meta line (never invented). `venue` appears in meta when present and not already covered by the title or city.

### Remote feed (optional)

By default `EVENTS_URL` is empty, so the kiosk loads `./data/events.json` from the local server (plus `events-b.json` / `events-c.json` if present).

For live updates from GitHub (or any host), set `EVENTS_URL` in **`config.local.js`** to the raw JSON URL, for example:

```js
EVENTS_URL: "https://raw.githubusercontent.com/<you>/house-kiosk/main/data/events.json",
```

`app.js` will also fetch sibling `events-b.json` and `events-c.json` under the same `data/` path on that host.

You can also pass a one-off URL:

- Query string: `http://127.0.0.1:8080/?events=https://example.com/events.json`

The host must send CORS headers (`Access-Control-Allow-Origin: *`) if it is a different origin. GitHub raw URLs generally work for this.

## Weather

Live Open-Meteo forecast using the latitude/longitude from config (template defaults are **example** downtown Indianapolis coords). No API key. Temperatures are never invented: if the network is down, the last successful reading is shown, or a calm “Unavailable” state. Nothing crashes.

## Refresh rates

| What | Interval |
| --- | --- |
| Clock | 1 second |
| Weather | 15 minutes |
| Events file | 5 minutes |

Change them in `config.js` or `config.local.js` (`clockIntervalMs`, `weatherIntervalMs`, `eventsIntervalMs`).

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Page shell |
| `styles.css` | Portrait 1080×1920 / 2160×3840 layout |
| `app.js` | Clock, weather, events, auto-scroll |
| `config.js` | Public template: timezone, example coords, intervals, `EVENTS_URL` |
| `config.local.example.js` | Copy → `config.local.js` for personal overrides |
| `config.local.js` | Device-local overrides (gitignored; create on the Pi) |
| `data/events.json` | Primary local events feed |
| `data/events-b.json` | Optional events supplement (merged by `app.js`) |
| `data/events-c.json` | Optional events supplement (merged by `app.js`) |
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
