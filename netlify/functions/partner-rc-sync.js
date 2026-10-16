// partner-rc-sync.js (16.10.2026) — брони из RealtyCalendar ПАРТНЁРА (HighLife, agency 75311) → наша bookings каждые 2 минуты.
// Зачем: 11 общих квартир живут у HighLife в RC (их Airbnb и ручные брони), у нас — Booking/Ostrovok через Channex.
// До 16.10 брони HighLife к нам не попадали вовсе (только занятость на сайте по iCal) → шахматка и Channex считали даты
// свободными → овербукинг (nest_179 18–25.10). Теперь: токен RC партнёра (env RC_PARTNER_TOKEN или app_settings.rc_partner_token)
// → /v2/event_calendars по их квартирам → calendar_import_rc(items, 'sync:rc-hl', p_apts, 'UL(') (эхо наших броней UL(…) пропускается,
// сверка «удалено в RC» только по этим квартирам). Пересечения с нашими бронями → TG-тревога (один раз на набор).
// Обратно (наши брони → их RC) идёт нашим iCal-экспортом, который у них подключён как канал «urbanluxe».
// Ручной запуск: POST с заголовком x-once = app_settings.partner_sync_once (одноразовый ключ), тело {token?} — токен сохраняется в app_settings.
const T = require('./_tg.js');
const C = require('./_channex.js');

const MAP_KEY = 'rc_partner_map';   // app_settings: JSON { "<rc apartment id>": "<наш apartment_id>" }
const addDays = (iso, k) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };

async function setting(key) { const r = await C.q('app_settings?select=value&key=eq.' + encodeURIComponent(key)); return r && r[0] ? r[0].value : null; }
async function setSetting(key, value, note) { await C.q('app_settings?on_conflict=key', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' }, body: JSON.stringify({ key, value, note: note || null, updated_at: new Date().toISOString() }) }); }

async function sync() {
  const tok = process.env.RC_PARTNER_TOKEN || await setting('rc_partner_token');
  if (!tok) return { skipped: 'нет токена RC партнёра (RC_PARTNER_TOKEN / app_settings.rc_partner_token)' };
  const map = JSON.parse(await setting(MAP_KEY) || '{}');
  const rcIds = Object.keys(map); if (!rcIds.length) return { skipped: 'нет карты ' + MAP_KEY };
  const apts = [...new Set(Object.values(map))];
  const d = T.tashToday(0); const ev = {};
  for (let s = -10; s < 440; s += 80) {
    const r = await fetch('https://realtycalendar.ru/v2/event_calendars/?begin_date=' + addDays(d, s) + '&end_date=' + addDays(d, s + 79) + '&statuses[]=booked&statuses[]=request&apartment_ids=' + rcIds.join(','), { headers: { 'X-User-Token': tok, Accept: 'application/json' } });
    if (r.status === 401 || r.status === 403) { await C.alertAdmin('⚠️ RC партнёра (HighLife): токен не принят (' + r.status + ') — синхронизация их броней остановлена. Нужен новый токен из их RC.'); return { error: 'rc auth ' + r.status }; }
    if (!r.ok) throw new Error('RC ' + r.status + ' ' + (await r.text()).slice(0, 100));
    const j = await r.json();
    for (const it of (j.items || [])) for (const x of (it.events || [])) {
      const apt = map[String(it.apartment_id)]; if (!apt) continue;
      ev[x.id] = { id: x.id, apartment_id: apt, begin_date: x.begin_date, end_date: x.end_date, status: x.status, is_delete: x.is_delete, amount: x.amount, price: x.price, prepayment: x.prepayment,
        client: { fio: x.client && x.client.fio, phone: x.client && x.client.phone }, short_notes: (x.short_notes || '').slice(0, 300), notes: (x.notes || '').slice(0, 500), client_notes: (x.client_notes || '').slice(0, 500),
        arrival_time: x.arrival_time, departure_time: x.departure_time, is_external: x.is_external, platform_name: x.platform_name || (x.source_id === 2 ? 'booking' : x.source_id === 3 ? 'airbnb' : null), source_id: x.source_id, updated_at: x.updated_at, created_at: x.created_at };
    }
  }
  const items = Object.values(ev);
  const res = await C.rpc('calendar_import_rc', { items, actor: 'sync:rc-hl', p_apts: apts, p_skip_prefix: 'UL(' });
  // тревога об овербукинге — только когда набор пересечений изменился
  const ov = (res && res.overlaps) || [];
  const sig = JSON.stringify(ov.map(o => [o.apartment_id, o.rc_id, o.ours]).sort());
  const last = await setting('partner_sync_overlaps');
  if (ov.length && sig !== last) {
    const names = {}; (await C.q('apartments?select=id,name&id=in.(' + apts.map(encodeURIComponent).join(',') + ')')).forEach(a => names[a.id] = a.name);
    await C.alertAdmin('🚨 Овербукинг с RC HighLife (' + ov.length + '):\n' + ov.map(o => '• ' + T.esc(names[o.apartment_id] || o.apartment_id) + ': у HighLife ' + T.ruDate(o.rc_from) + '→' + T.ruDate(o.rc_to) + ' ' + T.esc(o.rc_guest || o.rc_note || '') + ' ⟷ у нас ' + T.esc(o.ours || '') + ' ' + T.ruDate(o.ours_from) + '→' + T.ruDate(o.ours_to) + ' ' + T.esc(o.ours_guest || '') + ' (' + T.esc(o.ours_source || '') + ')').join('\n') + '\nРешить с HighLife вручную; наша бронь в базе остаётся.');
  }
  if (sig !== last) await setSetting('partner_sync_overlaps', sig);
  return Object.assign({ fetched: items.length, apartments: apts.length }, res);
}

exports.sync = sync;
exports.handler = async (event) => {
  const h = (event && event.headers) || {};
  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-once', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  if (event && event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event && event.httpMethod === 'POST' && (h['x-once'] || h['X-Once'])) {
    const once = await setting('partner_sync_once');
    if (!once || (h['x-once'] || h['X-Once']) !== once) return { statusCode: 403, body: 'bad once' };
    await setSetting('partner_sync_once', null);
    let body = {}; try { body = JSON.parse(event.body || '{}'); } catch (_) { }
    if (body.token) await setSetting('rc_partner_token', String(body.token), 'X-User-Token RC HighLife (agency 75311), ' + new Date().toISOString().slice(0, 10));
    if (body.map) await setSetting(MAP_KEY, JSON.stringify(body.map), 'RC id партнёра → наш apartment_id');
  }
  const out = {};
  try { out.sync = await sync(); } catch (e) { out.error = String(e.message || e); }
  return { statusCode: out.error ? 500 : 200, headers: CORS, body: JSON.stringify(out) };
};
