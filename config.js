// ─── CHS Theatre — site configuration ───────────────────────────────
// API_URL: the Google Apps Script web-app URL (ends with /exec).
// Leave empty to run in DEMO mode (data kept only in this browser).
window.CHS_CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbx0TUdcxvnuNpXRT7JtWna1iHZ0nDaOkvtIZf6ofnPfB4TD-wm_Cyw8L655KsoODssrYg/exec",
  SCHOOL_DOMAIN: "cambridge.edu.jo",
  MIN_DAYS_AHEAD: 3, // "Handle facility form 3 days before event"
  DAY_START: "07:00", // bookable window shown on the day timeline
  DAY_END: "21:00",
  STEP_MIN: 15, // times snap to 15 minutes
  MANAGER: {
    en: "Mr. Omar Abdelrahim Abdelnabi",
    ar: "الأستاذ عمر عبدالرحيم عبدالنبي",
    phone: "0776982541",
    email: "Omarabdelnabi@cambridge.edu.jo",
  },
};
