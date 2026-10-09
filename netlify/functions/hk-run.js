// Urban Luxe — hk-run.js (09.10.2026). Ручной запуск моста hk-sync (сама hk-sync — scheduled, Netlify отвечает 403 на HTTP).
// GET /.netlify/functions/hk-run?key=<SHEET_SYNC_KEY>&dry=1 | &limit=300 | &ping=1 | &csv=1
const T = require('./_tg.js');
const sync = require('./hk-sync.js');

exports.handler = async (event) => {
  const q = (event && event.queryStringParameters) || {};
  let key = process.env.SHEET_SYNC_KEY || '';
  if (!key) { try { const r = await T.sb('app_settings?select=value&key=eq.SHEET_SYNC_KEY'); const j = r.ok ? await r.json() : []; key = (j[0] || {}).value || ''; } catch (e) { /* ignore */ } }
  if (!key || q.key !== key) return { statusCode: 401, body: JSON.stringify({ error: 'bad key' }) };
  return sync.handler(event);
};
