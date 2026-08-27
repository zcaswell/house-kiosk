(function () {
  "use strict";

  const cfg = Object.assign(
    {
      timezone: "America/Indiana/Indianapolis",
      latitude: 39.5214,
      longitude: -85.7769,
      locationName: "Shelbyville, IN",
      clockIntervalMs: 1000,
      weatherIntervalMs: 15 * 60 * 1000,
      eventsIntervalMs: 5 * 60 * 1000,
      EVENTS_URL: "",
      weatherHours: 6,
    },
    window.KIOSK_CONFIG || {}
  );

  const TZ = cfg.timezone;
  const WX_CACHE = "house-kiosk-weather";
  const EV_CACHE = "house-kiosk-events";

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

  const CAT_LABEL = {
    "sci-fi": "Sci-Fi",
    fantasy: "Fantasy",
    anime: "Anime",
    "retro-games": "Retro",
    convention: "Con",
    museum: "Museum",
    concert: "Concert",
    fair: "Fair",
    park: "Park",
    movie: "Movie",
    haunted: "Haunt",
    other: "Other",
  };

  const el = {
    weekday: document.getElementById("weekday"),
    fulldate: document.getElementById("fulldate"),
    time: document.getElementById("time"),
    meridiem: document.getElementById("meridiem"),
    weather: document.getElementById("weather"),
    wxTemp: document.getElementById("wx-temp"),
    wxDegree: document.getElementById("wx-degree"),
    wxCond: document.getElementById("wx-cond"),
    wxHl: document.getElementById("wx-hl"),
    wxHours: document.getElementById("wx-hours"),
    viewport: document.getElementById("events-viewport"),
    track: document.getElementById("events-track"),
    place: document.getElementById("place"),
    footNote: document.getElementById("foot-note"),
  };

  if (cfg.locationName) {
    el.place.textContent = cfg.locationName.replace(", IN", ", Indiana");
  }

  /* ---------- time helpers ---------- */

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function tzOffsetMs(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const g = (t) => parts.find((p) => p.type === t).value;
    const asUTC = Date.UTC(+g("year"), +g("month") - 1, +g("day"), +g("hour"), +g("minute"), +g("second"));
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
    return new Intl.DateTimeFormat("en-US", Object.assign({ timeZone: TZ }, options)).formatToParts(date);
  }

  function part(date, type, options) {
    const p = partsInTz(date, options).find((x) => x.type === type);
    return p ? p.value : "";
  }

  function ymd(date) {
    const p = partsInTz(date, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const g = (t) => p.find((x) => x.type === t).value;
    return g("year") + "-" + g("month") + "-" + g("day");
  }

  function calendarDaysBetween(a, b) {
    const [ay, am, ad] = ymd(a).split("-").map(Number);
    const [by, bm, bd] = ymd(b).split("-").map(Number);
    const A = Date.UTC(ay, am - 1, ad);
    const B = Date.UTC(by, bm - 1, bd);
    return Math.round((B - A) / 86400000);
  }

  function grab(parts, type) {
    const x = parts.find(function (p) { return p.type === type; });
    return x ? x.value : "";
  }

  /* Always ask for hour+minute together — minute-only is not zero-padded. */
  function hms12(date) {
    const p = partsInTz(date, { hour: "numeric", minute: "2-digit", hour12: true });
    return {
      hour: grab(p, "hour"),
      minute: grab(p, "minute").padStart(2, "0"),
      mer: grab(p, "dayPeriod"),
    };
  }

  function hms24(date) {
    const p = partsInTz(date, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
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

  function formatShortDate(date) {
    return part(date, "month", { month: "short" }) + " " + part(date, "day", { day: "numeric" });
  }

  function formatHourTick(date) {
    const t = hms12(date);
    return t.hour + t.mer.charAt(0).toLowerCase();
  }

  /* ---------- clock ---------- */

  function tickClock() {
    const now = new Date();
    const t = hms12(now);
    el.time.innerHTML = t.hour + '<span class="colon">:</span>' + t.minute;
    el.meridiem.textContent = t.mer;
    el.weekday.textContent = part(now, "weekday", { weekday: "long" });
    el.fulldate.textContent =
      part(now, "month", { month: "long" }) + " " + part(now, "day", { day: "numeric" });
    if (el.footNote) {
      el.footNote.textContent = part(now, "timeZoneName", { timeZoneName: "short" });
    }
  }

  /* ---------- weather ---------- */

  function weatherUrl() {
    const q = new URLSearchParams({
      latitude: String(cfg.latitude),
      longitude: String(cfg.longitude),
      current: "temperature_2m,weather_code,apparent_temperature,wind_speed_10m",
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

  function wmoLabel(code) {
    if (code == null || Number.isNaN(+code)) return "";
    return WMO[+code] || "Cloudy";
  }

  function deg(n) {
    if (n == null || Number.isNaN(+n)) return null;
    return Math.round(+n);
  }

  function renderWeather(data, stale) {
    if (!data || !data.current) {
      el.weather.dataset.state = "unavailable";
      el.wxTemp.textContent = "Unavailable";
      el.wxDegree.hidden = true;
      el.wxCond.textContent = "Will retry";
      el.wxHl.textContent = "";
      el.wxHours.innerHTML = "";
      return;
    }

    const cur = data.current;
    const t = deg(cur.temperature_2m);
    if (t == null) {
      renderWeather(null, stale);
      return;
    }

    el.weather.dataset.state = stale ? "stale" : "live";
    el.wxTemp.textContent = String(t);
    el.wxDegree.hidden = false;
    el.wxCond.textContent = wmoLabel(cur.weather_code) || "—";

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

    const hours = data.hourly || { time: [], temperature_2m: [] };
    const now = new Date();
    const nShow = cfg.weatherHours || 6;
    const cells = [];
    for (let i = 0; i < (hours.time || []).length && cells.length < nShow; i++) {
      const ht = parseWall(hours.time[i], TZ);
      if (ht.getTime() <= now.getTime() - 20 * 60 * 1000) continue;
      if (ht.getTime() < now.getTime() && cells.length === 0) continue;
      const f = deg(hours.temperature_2m[i]);
      if (f == null) continue;
      cells.push({ label: formatHourTick(ht), f: f });
    }
    el.wxHours.innerHTML = "";
    cells.forEach((c) => {
      const div = document.createElement("div");
      div.className = "hour";
      const a = document.createElement("span");
      a.className = "hour-t";
      a.textContent = c.label;
      const b = document.createElement("span");
      b.className = "hour-f";
      b.textContent = c.f + "°";
      div.appendChild(a);
      div.appendChild(b);
      el.wxHours.appendChild(div);
    });
  }

  async function loadWeather() {
    try {
      const res = await fetch(weatherUrl(), { cache: "no-store" });
      if (!res.ok) throw new Error("weather " + res.status);
      const data = await res.json();
      if (!data || data.current == null || data.current.temperature_2m == null) {
        throw new Error("weather shape");
      }
      try {
        localStorage.setItem(WX_CACHE, JSON.stringify({ savedAt: Date.now(), data: data }));
      } catch (_) {}
      renderWeather(data, false);
    } catch (err) {
      console.warn("weather fetch failed", err);
      try {
        const cached = JSON.parse(localStorage.getItem(WX_CACHE) || "null");
        if (cached && cached.data) renderWeather(cached.data, true);
        else renderWeather(null, false);
      } catch (_) {
        renderWeather(null, false);
      }
    }
  }

  /* ---------- events ---------- */

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
    const dateOnly = isMidnight(start) && (!end || isEndOfDayish(end) || !sameDay);

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
    const happening = start.getTime() <= now.getTime() && end.getTime() >= now.getTime();
    if (happening && ymd(start) !== ymd(now)) return "ongoing";
    if (ymd(start) === ymd(now) || (happening && ymd(end) === ymd(now))) return "today";
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

  function renderEvents(payload) {
    const now = new Date();
    const list = Array.isArray(payload && payload.events) ? payload.events.slice() : [];
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
      empty.innerHTML = "<p>Nothing on the calendar</p><span>Check back soon</span>";
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

        const title = document.createElement("div");
        title.className = "event-title";
        title.textContent = ev.title || "Untitled";

        const cat = document.createElement("div");
        cat.className = "event-cat";
        cat.textContent = CAT_LABEL[ev.category] || ev.category || "";

        const meta = document.createElement("div");
        meta.className = "event-meta";
        const when = document.createElement("span");
        when.className = "when";
        when.textContent = formatWhen(ev, now);
        meta.appendChild(when);

        const extra = [];
        if (ev.city) extra.push(ev.city);
        const dist = formatDistance(ev.distanceMiles);
        if (dist) extra.push(dist);
        if (extra.length) {
          meta.appendChild(document.createTextNode("  ·  " + extra.join("  ·  ")));
        }

        row.appendChild(title);
        row.appendChild(cat);
        row.appendChild(meta);
        section.appendChild(row);
      });

      el.track.appendChild(section);
    });

    requestAnimationFrame(startScroller);
  }

  async function loadEvents() {
    try {
      const url = resolveEventsUrl();
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("events " + res.status);
      const data = await res.json();
      if (!data || !Array.isArray(data.events)) throw new Error("events shape");
      try {
        localStorage.setItem(EV_CACHE, JSON.stringify(data));
      } catch (_) {}
      renderEvents(data);
    } catch (err) {
      console.warn("events fetch failed", err);
      try {
        const cached = JSON.parse(localStorage.getItem(EV_CACHE) || "null");
        if (cached) renderEvents(cached);
        else renderEvents({ events: [] });
      } catch (_) {
        renderEvents({ events: [] });
      }
    }
  }

  /* ---------- boot ---------- */

  tickClock();
  setInterval(tickClock, cfg.clockIntervalMs || 1000);
  loadWeather();
  loadEvents();
  setInterval(loadWeather, cfg.weatherIntervalMs || 15 * 60 * 1000);
  setInterval(loadEvents, cfg.eventsIntervalMs || 5 * 60 * 1000);

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      tickClock();
      loadWeather();
      loadEvents();
    }
  });
})();
