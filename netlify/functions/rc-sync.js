// rc-sync.js — по расписанию (каждые 15 мин) подтягивает брони из RealtyCalendar в нашу таблицу bookings.
// Требует RC_TOKEN в env Netlify (X-User-Token пользователя RC). Логика — в calendar-api.js (rcSync).
const { rcSync } = require('./calendar-api.js');
exports.handler = async () => {
  try { const r = await rcSync(); return { statusCode: 200, body: JSON.stringify(r) }; }
  catch (e) { return { statusCode: 500, body: JSON.stringify({ error: String(e.message || e) }) }; }
};
