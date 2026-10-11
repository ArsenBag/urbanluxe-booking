// rc-sync.js — по расписанию (каждые 15 мин) подтягивает брони из RealtyCalendar в нашу таблицу bookings.
// Требует RC_TOKEN в env Netlify (X-User-Token пользователя RC). Логика — в calendar-api.js (rcSync).
// 11.10.2026: раз в сутки (первый запуск после 03:00 Ташкента) сдвигает горизонт кэша цен rate_calendar (pms_rebuild, ~0.4 с).
const { rcSync } = require('./calendar-api.js');
const T = require('./_tg.js');

async function shiftRateHorizon() {
  const h = Number(new Date().toLocaleString('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', hour12: false }));
  const m = new Date().getUTCMinutes();
  if (h !== 3 || m >= 15) return null;                       // одно окно в сутки
  const r = await T.sb('rpc/pms_rebuild', { method: 'POST', body: '{}' });
  return r.ok ? await r.json() : 'rebuild failed ' + r.status;
}

exports.handler = async () => {
  const out = {};
  try { out.rc = await rcSync(); } catch (e) { out.rc_error = String(e.message || e); }
  try { out.rates = await shiftRateHorizon(); } catch (e) { out.rates_error = String(e.message || e); }
  return { statusCode: out.rc_error ? 500 : 200, body: JSON.stringify(out) };
};
