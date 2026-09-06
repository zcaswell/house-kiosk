(function () {
  "use strict";

  const cfg = Object.assign(
    {
      timezone: "America/Indiana/Indianapolis",
      latitude: 39.7684,
      longitude: -86.1581,
      locationName: "Your city",
      clockIntervalMs: 1000,
      weatherIntervalMs: 15 * 60 * 1000,
      eventsIntervalMs: 5 * 60 * 1000,
      EVENTS_URL: "",
    },
    window.KIOSK_CONFIG || {},
    window.KIOSK_LOCAL_CONFIG || {}
  );

  const TZ = cfg.timezone;
  const WX_CACHE = "house-kiosk-weather";
  const EV_CACHE = "house-kiosk-events";
  const FETCH_TIMEOUT_MS = 10000;
  const WX_RATE_BACKOFF_MS = 45 * 60 * 1000; /* 45 min mid of 30–60 */

  /* Built-in WMO → short label (fallback if descriptions JSON missing). */
  const WMO = {
    0: "Clear",
    1: "Clear",
    2: "Partly Cloudy",
    3: "Cloudy",
    45: "Fog",
    48: "Fog",
    51: "Drizzle",
    53: "Drizzle",
    55: "Drizzle",
    56: "Drizzle",
    57: "Drizzle",
    61: "Rain",
    63: "Rain",
    65: "Rain",
    66: "Icy Rain",
    67: "Icy Rain",
    71: "Snow",
    73: "Snow",
    75: "Snow",
    77: "Snow",
    80: "Showers",
    81: "Showers",
    82: "Showers",
    85: "Snow",
    86: "Snow",
    95: "Storm",
    96: "Storm",
    99: "Storm",
  };

  const WMO_ICON = {
    0: "sun",
    1: "sun",
    2: "partly-cloudy",
    3: "cloudy",
    45: "fog",
    48: "fog",
    51: "drizzle",
    53: "drizzle",
    55: "drizzle",
    56: "drizzle",
    57: "drizzle",
    61: "rain",
    63: "rain",
    65: "rain",
    66: "rain",
    67: "rain",
    71: "snow",
    73: "snow",
    75: "snow",
    77: "snow",
    80: "showers",
    81: "showers",
    82: "showers",
    85: "snow",
    86: "snow",
    95: "storm",
    96: "storm",
    99: "storm",
  };

  /* Compact inline SVGs (24 viewBox), currentColor stroke/fill for gold theme. */
  const WX_SVG = {
    sun:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.05 5.05l1.55 1.55M17.4 17.4l1.55 1.55M5.05 18.95l1.55-1.55M17.4 6.6l1.55-1.55"/></g></svg>',
    "partly-cloudy":
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="3.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 3.8v1.4M3.8 9H5.2M5.1 5.1l1 1M13 5.2l-.9.9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M8.5 16.5h8.2a3.3 3.3 0 0 0 .2-6.6 4.4 4.4 0 0 0-8.3 1.5 2.7 2.7 0 0 0-.1 5.1z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    cloudy:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 17.5h9.5a3.6 3.6 0 0 0 .25-7.2 4.8 4.8 0 0 0-9.2 1.7 3 3 0 0 0-.55 5.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    fog:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 9.5h16M5.5 12.5h13M4 15.5h16M6 18.5h12"/></g></svg>',
    drizzle:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 12.2h9.2a3.2 3.2 0 0 0 .2-6.4 4.4 4.4 0 0 0-8.5 1.5 2.7 2.7 0 0 0-.9 4.9z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M9 15.2v2.2M12 16v2.2M15 15.2v2.2"/></g></svg>',
    rain:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 11.5h9.2a3.2 3.2 0 0 0 .2-6.4 4.4 4.4 0 0 0-8.5 1.5 2.7 2.7 0 0 0-.9 4.9z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8.5 14.5l-1 3.2M12 14.5l-1 3.2M15.5 14.5l-1 3.2"/></g></svg>',
    showers:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 11h9.2a3.2 3.2 0 0 0 .2-6.4 4.4 4.4 0 0 0-8.5 1.5 2.7 2.7 0 0 0-.9 4.9z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 14.2l-.8 2.4M11.2 15l-.8 2.4M14.5 14.2l-.8 2.4M17.2 15l-.8 2.4"/></g></svg>',
    snow:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 11.2h9.2a3.2 3.2 0 0 0 .2-6.4 4.4 4.4 0 0 0-8.5 1.5 2.7 2.7 0 0 0-.9 4.9z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><g fill="currentColor"><circle cx="9" cy="15.5" r="1"/><circle cx="12" cy="17.2" r="1"/><circle cx="15" cy="15.5" r="1"/></g></svg>',
    storm:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 10.8h9.2a3.2 3.2 0 0 0 .2-6.4 4.4 4.4 0 0 0-8.5 1.5 2.7 2.7 0 0 0-.9 4.9z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M13.2 12.5l-3.4 4.2h2.6L10.8 21l4.2-5.2h-2.5z" fill="currentColor"/></svg>',
    unknown:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.2 1-1.2 1.9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="16.8" r="1" fill="currentColor"/></svg>',
  };

  const CAT_LABEL = {
    convention: "Con",
    haunted: "Haunt",
    museum: "Museum",
    "retro-games": "Retro",
    book: "Book",
    fair: "Fair",
    anime: "Anime",
    "sci-fi": "Sci-Fi",
    fantasy: "Fantasy",
    concert: "Concert",
    park: "Park",
    movie: "Movie",
    other: "Other",
  };

  /* zoo/science share museum color + label mapping */
  const CAT_ALIAS = { zoo: "museum", science: "museum" };

  const el = {
    weekday: document.getElementById("weekday"),
    fulldate: document.getElementById("fulldate"),
    time: document.getElementById("time"),
    meridiem: document.getElementById("meridiem"),
    weather: document.getElementById("weather"),
    wxTemp: document.getElementById("wx-temp"),
    wxDegree: document.getElementById("wx-degree"),
    wxIcon: document.getElementById("wx-icon"),
    wxCondLabel: document.getElementById("wx-cond-label"),
    wxCond: document.getElementById("wx-cond"),
    wxHl: document.getElementById("wx-hl"),
    viewport: document.getElementById("events-viewport"),
    track: document.getElementById("events-track"),
    place: document.getElementById("place"),
    syncStatus: document.getElementById("sync-status"),
  };

  if (cfg.locationName) {
    el.place.textContent = cfg.locationName.replace(", IN", ", Indiana");
  }

  /* —— Descriptions map (optional JSON) —— */
  let wxByCode = null; /* code → entry */

  function iconFromWmo(code) {
    const c = +code;
    if (Number.isNaN(c)) return "unknown";
    return WMO_ICON[c] || "cloudy";
  }

  function weatherMeta(code) {
    const c = +code;
    const entry = wxByCode && !Number.isNaN(c) ? wxByCode[c] : null;
    if (entry) {
      return {
        label: entry.label || entry.short || WMO[c] || "Cloudy",
        title: entry.description || entry.label || "",
        icon: entry.icon || iconFromWmo(c),
      };
    }
    if (code == null || Number.isNaN(c)) {
      return { label: "", title: "", icon: "unknown" };
    }
    return {
      label: WMO[c] || "Cloudy",
      title: "",
      icon: iconFromWmo(c),
    };
  }

  function setWxIcon(iconId, title) {
    if (!el.wxIcon) return;
    const id = iconId && WX_SVG[iconId] ? iconId : "unknown";
    el.wxIcon.innerHTML = WX_SVG[id] || "";
    el.wxIcon.dataset.icon = id;
    if (el.wxCond) {
      if (title) el.wxCond.setAttribute("title", title);
      else el.wxCond.removeAttribute("title");
    }
  }

  function clearWxIcon() {
    if (!el.wxIcon) return;
    el.wxIcon.innerHTML = "";
    el.wxIcon.dataset.icon = "";
    if (el.wxCond) el.wxCond.removeAttribute("title");
  }

  async function loadWeatherDescriptions() {
    try {
      const res = await fetchWithTimeout(
        "./data/weather-descriptions.json",
        { cache: "no-store" },
        8000
      );
      if (!res.ok) return;
      const doc = await res.json();
      if (!doc || !Array.isArray(doc.codes)) return;
      const map = Object.create(null);
      doc.codes.forEach(function (entry) {
        if (!entry) return;
        (entry.wmo || []).forEach(function (code) {
          map[+code] = entry;
        });
      });
      wxByCode = map;
    } catch (_) {
      /* built-in map is fine */
    }
  }

  /* —— Fetch helpers —— */
  async function fetchWithTimeout(url, opts, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(function () {
      ctrl.abort();
    }, ms == null ? FETCH_TIMEOUT_MS : ms);
    try {
      return await fetch(
        url,
        Object.assign({}, opts || {}, { signal: ctrl.signal })
      );
    } finally {
      clearTimeout(timer);
    }
  }

  function isRemoteUrl(url) {
    return /^https?:\/\//i.test(String(url || ""));
  }

  /* —— Time helpers —— */
  function tzOffsetMs(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const g = function (t) {
      return parts.find(function (p) {
        return p.type === t;
      }).value;
    };
    const asUTC = Date.UTC(
      +g("year"),
      +g("month") - 1,
      +g("day"),
      +g("hour"),
      +g("minute"),
      +g("second")
    );
    return asUTC - date.getTime();
  }

  function zonedLocalDate(y, m, d, hh, mm, tz) {
    let utc = Date.UTC(y, m - 1, d, hh, mm, 0);
    utc -= tzOffsetMs(new Date(utc), tz);
    utc = Date.UTC(y, m - 1, d, hh, mm, 0) - tzOffsetMs(new Date(utc), tz);
    return new Date(utc);
  }

  function parseWall(iso, tz) {
    const raw = iso.length === 16 ? iso + ":00" : iso;
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return new Date(iso);
    return zonedLocalDate(+m[1], +m[2], +m[3], +m[4], +m[5], tz);
  }

  function partsInTz(date, options) {
    return new Intl.DateTimeFormat(
      "en-US",
      Object.assign({ timeZone: TZ }, options)
    ).formatToParts(date);
  }

  function part(date, type, options) {
    const p = partsInTz(date, options).find(function (x) {
      return x.type === type;
    });
    return p ? p.value : "";
  }

  function ymd(date) {
    const p = partsInTz(date, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const g = function (t) {
      return p.find(function (x) {
        return x.type === t;
      }).value;
    };
    return g("year") + "-" + g("month") + "-" + g("day");
  }

  function calendarDaysBetween(a, b) {
    const ay = ymd(a).split("-").map(Number);
    const by = ymd(b).split("-").map(Number);
    const A = Date.UTC(ay[0], ay[1] - 1, ay[2]);
    const B = Date.UTC(by[0], by[1] - 1, by[2]);
    return Math.round((B - A) / 86400000);
  }

  function grab(parts, type) {
    const x = parts.find(function (p) {
      return p.type === type;
    });
    return x ? x.value : "";
  }

  function hms12(date) {
    const p = partsInTz(date, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return {
      hour: grab(p, "hour"),
      minute: grab(p, "minute").padStart(2, "0"),
      mer: grab(p, "dayPeriod"),
    };
  }

  function hms24(date) {
    const p = partsInTz(date, {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    return {
      hour: grab(p, "hour").padStart(2, "0"),
      minute: grab(p, "minute").padStart(2, "0"),
    };
  }

  function isMidnight(date) {
    const t = hms24(date);
    return t.hour === "00" && t.minute === "00";
  }

  function isEndOfDayish(date) {
    const t = hms24(date);
    return t.hour === "23" && +t.minute >= 50;
  }

  function formatTime(date) {
    const t = hms12(date);
    if (t.minute === "00") return t.hour + " " + t.mer;
    return t.hour + ":" + t.minute + " " + t.mer;
  }

  function formatClockBit(date) {
    const t = hms12(date);
    if (t.minute === "00") return t.hour + " " + t.mer;
    return t.hour + ":" + t.minute + " " + t.mer;
  }

  function formatShortDate(date) {
    return (
      part(date, "month", { month: "short" }) +
      " " +
      part(date, "day", { day: "numeric" })
    );
  }

  /* —— Sync footer —— */
  let lastSyncAt = null; /* ms of last successful events sync */
  let syncMode = "pending"; /* pending | live | offline | failed */
  let eventsAttempted = false;

  function setSyncStatus(state, label) {
    if (!el.syncStatus) return;
    el.syncStatus.dataset.state = state;
    el.syncStatus.textContent = label;
  }

  function refreshSyncLabel() {
    if (!el.syncStatus) return;
    if (syncMode === "live" && lastSyncAt != null) {
      const next = new Date(
        lastSyncAt + (cfg.eventsIntervalMs || 5 * 60 * 1000)
      );
      setSyncStatus(
        "live",
        "Synced " +
          formatClockBit(new Date(lastSyncAt)) +
          " · Next " +
          formatClockBit(next)
      );
      return;
    }
    if (syncMode === "offline" && lastSyncAt != null) {
      setSyncStatus(
        "offline",
        "Offline · last " + formatClockBit(new Date(lastSyncAt)) + " · retrying"
      );
      return;
    }
    if (syncMode === "failed") {
      setSyncStatus("failed", "Events failed · retrying");
      return;
    }
    if (syncMode === "pending" && !eventsAttempted) {
      setSyncStatus("pending", "Syncing…");
    }
  }

  function tickClock() {
    const now = new Date();
    const t = hms12(now);
    el.time.innerHTML =
      t.hour + '<span class="colon">:</span>' + t.minute;
    el.meridiem.textContent = t.mer;
    el.weekday.textContent = part(now, "weekday", { weekday: "long" });
    el.fulldate.textContent =
      part(now, "month", { month: "long" }) +
      " " +
      part(now, "day", { day: "numeric" });
    if (syncMode === "live") refreshSyncLabel();
  }

  /* —— Weather —— */
  let weatherBackoffUntil = 0;

  function weatherUrl() {
    const q = new URLSearchParams({
      latitude: String(cfg.latitude),
      longitude: String(cfg.longitude),
      current:
        "temperature_2m,weather_code,apparent_temperature,wind_speed_10m",
      hourly: "temperature_2m,weather_code",
      daily: "weather_code,temperature_2m_max,temperature_2m_min",
      temperature_unit: "fahrenheit",
      wind_speed_unit: "mph",
      timezone: TZ,
      forecast_days: "1",
      forecast_hours: "12",
    });
    return "https://api.open-meteo.com/v1/forecast?" + q.toString();
  }

  function deg(n) {
    if (n == null || Number.isNaN(+n)) return null;
    return Math.round(+n);
  }

  function readWxCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(WX_CACHE) || "null");
      if (cached && cached.data) return cached;
    } catch (_) {}
    return null;
  }

  function renderWeatherUnavailable(reason) {
    el.weather.dataset.state = "unavailable";
    el.wxTemp.textContent = "Unavailable";
    el.wxDegree.hidden = true;
    clearWxIcon();
    if (el.wxCondLabel) el.wxCondLabel.textContent = reason || "Will retry";
    else if (el.wxCond) el.wxCond.textContent = reason || "Will retry";
    el.wxHl.textContent = "";
  }

  function renderWeather(data, stale) {
    if (!data || !data.current) {
      renderWeatherUnavailable("Will retry");
      return;
    }
    const cur = data.current;
    const t = deg(cur.temperature_2m);
    if (t == null) {
      renderWeatherUnavailable("Will retry");
      return;
    }
    el.weather.dataset.state = stale ? "stale" : "live";
    el.wxTemp.textContent = String(t);
    el.wxDegree.hidden = false;
    const meta = weatherMeta(cur.weather_code);
    if (el.wxCondLabel) el.wxCondLabel.textContent = meta.label || "—";
    else if (el.wxCond) el.wxCond.textContent = meta.label || "—";
    setWxIcon(meta.icon, meta.title);
    const daily = data.daily || {};
    const hi = deg((daily.temperature_2m_max || [])[0]);
    const lo = deg((daily.temperature_2m_min || [])[0]);
    const wind = deg(cur.wind_speed_10m);
    const bits = [];
    if (hi != null && lo != null) {
      bits.push("H <strong>" + hi + "°</strong>  L <strong>" + lo + "°</strong>");
    }
    if (wind != null) bits.push(wind + " mph");
    el.wxHl.innerHTML = bits.join("  ·  ");
  }

  function showWeatherFailure(err) {
    const msg = String((err && err.message) || err || "");
    let reason = "Offline";
    if (/rate|limit|too many/i.test(msg)) reason = "Rate limited";
    else if (/abort|timeout/i.test(msg)) reason = "Offline";
    else if (/shape|error/i.test(msg) && /rate|limit/i.test(msg))
      reason = "Rate limited";

    const cached = readWxCache();
    if (cached && cached.data) {
      renderWeather(cached.data, true);
      return;
    }
    renderWeatherUnavailable(reason);
  }

  function classifyWeatherError(data, httpStatus) {
    if (data && data.error) {
      const reason = String(data.reason || "");
      if (/rate|limit|too many/i.test(reason)) {
        return new Error("rate limited: " + reason);
      }
      return new Error(reason || "weather api error");
    }
    if (httpStatus === 429) return new Error("rate limited");
    if (httpStatus && httpStatus >= 400) return new Error("weather " + httpStatus);
    return null;
  }

  async function loadWeather(force) {
    if (!force && Date.now() < weatherBackoffUntil) {
      const cached = readWxCache();
      if (cached && cached.data) renderWeather(cached.data, true);
      return;
    }
    try {
      const res = await fetchWithTimeout(
        weatherUrl(),
        { cache: "no-store" },
        FETCH_TIMEOUT_MS
      );
      const data = await res.json().catch(function () {
        return null;
      });
      const apiErr = classifyWeatherError(data, res.status);
      if (apiErr) throw apiErr;
      if (!res.ok) throw new Error("weather " + res.status);
      if (!data || data.current == null || data.current.temperature_2m == null) {
        throw new Error("weather shape");
      }
      weatherBackoffUntil = 0;
      try {
        localStorage.setItem(
          WX_CACHE,
          JSON.stringify({ savedAt: Date.now(), data: data })
        );
      } catch (_) {}
      renderWeather(data, false);
    } catch (err) {
      console.warn("weather fetch failed", err);
      const msg = String((err && err.message) || err || "");
      if (/rate|limit/i.test(msg)) {
        const jitter = Math.floor(Math.random() * 15 * 60 * 1000);
        weatherBackoffUntil = Date.now() + WX_RATE_BACKOFF_MS + jitter;
      }
      showWeatherFailure(err);
    }
  }

  /* —— Events —— */
  function resolveEventsUrl() {
    try {
      const q = new URLSearchParams(location.search).get("events");
      if (q) return q;
    } catch (_) {}
    if (cfg.EVENTS_URL) return cfg.EVENTS_URL;
    return "./data/events.json";
  }

  function eventEnd(ev) {
    if (ev.end) return new Date(ev.end);
    return new Date(ev.start);
  }

  function formatWhen(ev, now) {
    const start = new Date(ev.start);
    const end = ev.end ? new Date(ev.end) : null;
    const started = start.getTime() <= now.getTime();
    const sameDay = end && ymd(start) === ymd(end);
    const dateOnly =
      isMidnight(start) && (!end || isEndOfDayish(end) || !sameDay);
    if (dateOnly) {
      if (end && ymd(start) !== ymd(end)) {
        if (started) return "Through " + formatShortDate(end);
        return formatShortDate(start) + " – " + formatShortDate(end);
      }
      if (ymd(start) === ymd(now)) return "All day";
      return formatShortDate(start);
    }
    if (end && !sameDay) {
      if (started) return "Through " + formatShortDate(end);
      return formatShortDate(start) + " – " + formatShortDate(end);
    }
    if (end && sameDay) {
      if (started) return "Until " + formatTime(end);
      return formatTime(start) + " – " + formatTime(end);
    }
    return formatTime(start);
  }

  function venueUseful(ev) {
    const venue = (ev.venue || "").trim();
    if (!venue) return "";
    const title = (ev.title || "").trim().toLowerCase();
    const city = (ev.city || "").trim().toLowerCase();
    const v = venue.toLowerCase();
    if (title && title.indexOf(v) !== -1) return "";
    if (
      city &&
      (v === city || city.indexOf(v) !== -1 || v.indexOf(city) !== -1)
    )
      return "";
    return venue;
  }

  function formatDistance(mi) {
    if (mi == null || mi === "") return "";
    const n = Number(mi);
    if (Number.isNaN(n)) return "";
    if (n === 0) return "In town";
    return Math.round(n) + " mi";
  }

  function groupKey(ev, now) {
    const start = new Date(ev.start);
    const end = eventEnd(ev);
    const happening =
      start.getTime() <= now.getTime() && end.getTime() >= now.getTime();
    if (happening && ymd(start) !== ymd(now)) return "ongoing";
    if (
      ymd(start) === ymd(now) ||
      (happening && ymd(end) === ymd(now))
    )
      return "today";
    const delta = calendarDaysBetween(now, start);
    if (delta === 1) return "tomorrow";
    return "d:" + ymd(start);
  }

  function groupLabel(key, now) {
    if (key === "today") return "Today";
    if (key === "tomorrow") return "Tomorrow";
    if (key === "ongoing") return "Happening now";
    const iso = key.slice(2);
    const dt = parseWall(iso + "T12:00", TZ);
    const delta = calendarDaysBetween(now, dt);
    if (delta >= 2 && delta <= 6) {
      return part(dt, "weekday", { weekday: "long" });
    }
    return (
      part(dt, "weekday", { weekday: "long" }) +
      ", " +
      part(dt, "month", { month: "long" }) +
      " " +
      part(dt, "day", { day: "numeric" })
    );
  }

  function groupOrder(key) {
    if (key === "today") return 0;
    if (key === "ongoing") return 1;
    if (key === "tomorrow") return 2;
    return 10;
  }

  let stopScroll = null;

  function startScroller() {
    if (stopScroll) {
      stopScroll();
      stopScroll = null;
    }
    const viewport = el.viewport;
    const track = el.track;
    track.style.transform = "translateY(0px)";
    track.style.opacity = "1";
    let y = 0;
    let phase = "pause";
    let phaseUntil = performance.now() + 9000;
    let last = performance.now();
    let fading = false;
    let raf = 0;
    const SPEED = 26;
    function frame(now) {
      const dt = Math.min(48, now - last) / 1000;
      last = now;
      const max = Math.max(0, track.scrollHeight - viewport.clientHeight);
      if (max < 16) {
        y = 0;
        track.style.transform = "translateY(0px)";
        raf = requestAnimationFrame(frame);
        return;
      }
      if (phase === "pause") {
        if (now >= phaseUntil) phase = y <= 1 ? "down" : "reset";
      } else if (phase === "down") {
        y += SPEED * dt;
        if (y >= max) {
          y = max;
          phase = "pause";
          phaseUntil = now + 5000;
        }
      } else if (phase === "reset" && !fading) {
        fading = true;
        track.style.transition = "opacity 0.45s ease";
        track.style.opacity = "0";
        setTimeout(function () {
          y = 0;
          track.style.transform = "translateY(0px)";
          track.style.opacity = "1";
          fading = false;
          phase = "pause";
          phaseUntil = performance.now() + 8000;
        }, 480);
      }
      if (phase !== "reset") track.style.transform = "translateY(" + -y + "px)";
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    stopScroll = function () {
      cancelAnimationFrame(raf);
      track.style.transition = "";
      track.style.opacity = "1";
    };
  }


  function resolveCategory(raw) {
    const c = String(raw || "other").toLowerCase().trim();
    const mapped = CAT_ALIAS[c] || c;
    if (CAT_LABEL[mapped]) return mapped;
    return "other";
  }

  function categoryLabel(raw) {
    const c = String(raw || "").toLowerCase().trim();
    const mapped = CAT_ALIAS[c] || c;
    if (CAT_LABEL[mapped]) return CAT_LABEL[mapped];
    return raw || "";
  }

  /* Compact date tile: month on top, day/range below (America/Indiana/Indianapolis). */
  function formatDateTile(ev) {
    const start = new Date(ev.start);
    const end = ev.end ? new Date(ev.end) : null;
    const startYmd = ymd(start);
    const startMonth = part(start, "month", { month: "short" }).toUpperCase();
    const startDay = part(start, "day", { day: "numeric" });
    if (!end) {
      return { month: startMonth, day: startDay, dualMonth: false };
    }
    // Prefer calendar ymd; end-of-dayish still uses that calendar day.
    const endYmd = ymd(end);
    if (startYmd === endYmd) {
      return { month: startMonth, day: startDay, dualMonth: false };
    }
    const endMonth = part(end, "month", { month: "short" }).toUpperCase();
    const endDay = part(end, "day", { day: "numeric" });
    if (startYmd.slice(0, 7) === endYmd.slice(0, 7)) {
      return {
        month: startMonth,
        day: startDay + "–" + endDay,
        dualMonth: false,
      };
    }
    return {
      month: startMonth + "–" + endMonth,
      day: startDay + "–" + endDay,
      dualMonth: true,
    };
  }

  function renderEvents(payload) {
    const now = new Date();
    const list = Array.isArray(payload && payload.events)
      ? payload.events.slice()
      : [];
    const upcoming = list
      .filter(function (ev) {
        try {
          return ev && ev.start && eventEnd(ev).getTime() >= now.getTime();
        } catch (_) {
          return false;
        }
      })
      .sort(function (a, b) {
        return new Date(a.start) - new Date(b.start);
      });
    el.track.innerHTML = "";
    if (!upcoming.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.innerHTML =
        "<p>Nothing on the calendar</p><span>Check back soon</span>";
      el.track.appendChild(empty);
      startScroller();
      return;
    }
    const groups = new Map();
    upcoming.forEach(function (ev) {
      const k = groupKey(ev, now);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(ev);
    });
    const keys = Array.from(groups.keys()).sort(function (a, b) {
      const oa = groupOrder(a);
      const ob = groupOrder(b);
      if (oa !== ob) return oa - ob;
      if (a.startsWith("d:") && b.startsWith("d:")) return a.localeCompare(b);
      return 0;
    });
    keys.forEach(function (key) {
      const section = document.createElement("div");
      section.className = "day-group";
      const h = document.createElement("p");
      h.className = "day-label";
      h.textContent = groupLabel(key, now);
      section.appendChild(h);
      groups.get(key).forEach(function (ev) {
        const row = document.createElement("article");
        row.className = "event";
        const catKey = resolveCategory(ev.category);
        row.dataset.category = catKey;

        const tile = document.createElement("div");
        tile.className = "event-date";
        const tileParts = formatDateTile(ev);
        if (tileParts.dualMonth) tile.classList.add("event-date--range");
        const tileMonth = document.createElement("span");
        tileMonth.className = "event-date-month";
        tileMonth.textContent = tileParts.month;
        const tileDay = document.createElement("span");
        tileDay.className = "event-date-day";
        tileDay.textContent = tileParts.day;
        tile.appendChild(tileMonth);
        tile.appendChild(tileDay);

        const main = document.createElement("div");
        main.className = "event-main";
        const title = document.createElement("div");
        title.className = "event-title";
        title.textContent = ev.title || "Untitled";
        const meta = document.createElement("div");
        meta.className = "event-meta";
        const when = document.createElement("span");
        when.className = "when";
        when.textContent = formatWhen(ev, now);
        meta.appendChild(when);
        const extra = [];
        const venue = venueUseful(ev);
        if (venue) extra.push(venue);
        if (ev.city) extra.push(ev.city);
        const dist = formatDistance(ev.distanceMiles);
        if (dist) extra.push(dist);
        if (extra.length) {
          meta.appendChild(
            document.createTextNode("  ·  " + extra.join("  ·  "))
          );
        }
        main.appendChild(title);
        main.appendChild(meta);
        const notes = (ev.notes || "").trim();
        if (notes) {
          const notesEl = document.createElement("div");
          notesEl.className = "event-notes";
          notesEl.textContent = notes;
          main.appendChild(notesEl);
        }

        const cat = document.createElement("div");
        cat.className = "event-cat";
        cat.textContent = categoryLabel(ev.category);

        row.appendChild(tile);
        row.appendChild(main);
        row.appendChild(cat);
        section.appendChild(row);
      });
      el.track.appendChild(section);
    });
    requestAnimationFrame(startScroller);
  }

  /* Only merge sibling events-b/c for local ./data/events.json-style feeds.
   * Remote single-file URLs must not hang waiting on missing parts. */
  async function appendEventParts(data, url) {
    if (isRemoteUrl(url)) return data;
    const parts = ["events-b.json", "events-c.json"];
    const base = url.replace(/[^/]*$/, "");
    const seen = new Set(
      (data.events || [])
        .map(function (e) {
          return e && e.id;
        })
        .filter(Boolean)
    );
    for (let i = 0; i < parts.length; i++) {
      try {
        const r = await fetchWithTimeout(
          base + parts[i],
          { cache: "no-store" },
          FETCH_TIMEOUT_MS
        );
        if (!r.ok) continue;
        const p = await r.json();
        if (!p || !Array.isArray(p.events)) continue;
        for (let j = 0; j < p.events.length; j++) {
          const ev = p.events[j];
          if (!ev || !ev.id || seen.has(ev.id)) continue;
          seen.add(ev.id);
          data.events.push(ev);
        }
      } catch (_) {}
    }
    return data;
  }

  function readEvCache() {
    try {
      return JSON.parse(localStorage.getItem(EV_CACHE) || "null");
    } catch (_) {
      return null;
    }
  }

  async function loadEvents() {
    eventsAttempted = true;
    /* Avoid sticky Syncing… after first load — only show briefly on cold start. */
    if (syncMode === "pending" && lastSyncAt == null) {
      setSyncStatus("pending", "Syncing…");
    }
    try {
      const url = resolveEventsUrl();
      const res = await fetchWithTimeout(
        url,
        { cache: "no-store" },
        FETCH_TIMEOUT_MS
      );
      if (!res.ok) throw new Error("events " + res.status);
      let data = await res.json();
      if (!data || !Array.isArray(data.events)) throw new Error("events shape");
      data = await appendEventParts(data, url);
      const syncedAt = Date.now();
      try {
        localStorage.setItem(
          EV_CACHE,
          JSON.stringify({ savedAt: syncedAt, data: data })
        );
      } catch (_) {}
      lastSyncAt = syncedAt;
      syncMode = "live";
      renderEvents(data);
      refreshSyncLabel();
    } catch (err) {
      console.warn("events fetch failed", err);
      try {
        const cached = readEvCache();
        if (cached && cached.data && Array.isArray(cached.data.events)) {
          if (cached.savedAt) lastSyncAt = cached.savedAt;
          syncMode = "offline";
          renderEvents(cached.data);
          refreshSyncLabel();
        } else if (cached && Array.isArray(cached.events)) {
          syncMode = "offline";
          renderEvents(cached);
          refreshSyncLabel();
        } else {
          syncMode = "failed";
          renderEvents({ events: [] });
          refreshSyncLabel();
        }
      } catch (_) {
        syncMode = "failed";
        renderEvents({ events: [] });
        refreshSyncLabel();
      }
    }
  }

  /* —— Boot —— */
  tickClock();
  setInterval(tickClock, cfg.clockIntervalMs || 1000);

  loadWeatherDescriptions().then(function () {
    loadWeather(true);
  });
  loadEvents();

  setInterval(function () {
    loadWeather(false);
  }, cfg.weatherIntervalMs || 15 * 60 * 1000);
  setInterval(loadEvents, cfg.eventsIntervalMs || 5 * 60 * 1000);

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      tickClock();
      loadWeather(true);
      loadEvents();
    }
  });
})();
