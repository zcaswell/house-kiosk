/* House kiosk — public template defaults.
 * On your Pi: copy config.local.example.js → config.local.js and set YOUR
 * location / EVENTS_URL there (config.local.js is gitignored).
 * Do not commit personal coordinates or homeowner names.
 */
window.KIOSK_CONFIG = {
  timezone: "America/Indiana/Indianapolis",

  /* EXAMPLE coords: downtown Indianapolis (Monument Circle area).
   * Replace via config.local.js for your actual location. */
  latitude: 39.7684,
  longitude: -86.1581,
  locationName: "Your city",

  clockIntervalMs: 1000,
  weatherIntervalMs: 15 * 60 * 1000,
  eventsIntervalMs: 60 * 60 * 1000,

  /* Empty = use local ./data/events.json.
   * For live updates from this repo, set EVENTS_URL in config.local.js to:
   *   https://raw.githubusercontent.com/<you>/house-kiosk/main/data/events.json
   * Override ad-hoc with ?events=… */
  EVENTS_URL: "",

  weatherHours: 6,
};
