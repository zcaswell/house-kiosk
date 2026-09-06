/* Optional local overrides — copy to config.local.js on the Pi (gitignored).
 * Sets window.KIOSK_LOCAL_CONFIG; app.js merges this over config.js.
 * Use placeholder/example values only in the public repo; put real home
 * coords and personal URLs only in your local copy.
 */
window.KIOSK_LOCAL_CONFIG = {
  // timezone: "America/Indiana/Indianapolis",
  // latitude: 39.7684,   // example: downtown Indianapolis — replace with yours
  // longitude: -86.1581,
  // locationName: "Your city",

  /* Live GitHub feed (optional). Leave unset / "" to use ./data/events.json */
  // EVENTS_URL: "https://raw.githubusercontent.com/<you>/house-kiosk/main/data/events.json",
};
