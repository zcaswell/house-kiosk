/* House kiosk — edit this file on the Pi without touching app.js */
window.KIOSK_CONFIG = {
  timezone: "America/Indiana/Indianapolis",
  latitude: 39.5214,
  longitude: -85.7769,
  locationName: "Shelbyville, IN",
  owner: "Zachary",

  clockIntervalMs: 1000,
  weatherIntervalMs: 15 * 60 * 1000,
  eventsIntervalMs: 5 * 60 * 1000,

  /* Leave empty to use ./data/events.json.
     Override at runtime with ?events=https://example.com/events.json */
  EVENTS_URL: "",

  weatherHours: 6,
};
