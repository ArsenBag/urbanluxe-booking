// Urban Luxe — calendar-api.js (07.10.2026). Собственный календарь броней: bookings — мастер, RealtyCalendar — зеркало.
// Авторизация как в admin3-api: Bearer <supabase access_token>, email в app_users (роли admin/manager пишут, viewer читает).
//
// GET  ?a=grid&from=2026-10-01&to=2026-11-15[&complex=]   → квартиры + брони за период (для шахматки)
// GET  ?a=booking&id=                                     → бронь + платежи + события
// GET  ?a=free&check_in=&check_out=[&guests=]             → свободные квартиры на даты (по своей базе)
// GET  ?a=today                                           → заезды/выезды/живут сегодня, долги, уборки (живая доска)
// GET  ?a=guest_search&q=                                 → поиск гостя по имени/телефону по прошлым броням
// POST {a:'create', apartment_id, check_in, check_out, guest_name, guest_phone, guest_telegram, guests_count, total_price, currency, channel, notes, arrival_time, prepaid}
// POST {a:'update', id, ...поля}                          → перенос/правка (пересечения отклоняет база)
// POST {a:'status', id, status}                           → request|confirmed|checked_in|checked_out|cancelled|blocked
// POST {a:'payment', booking_id, amount, method, kind, note}   | POST {a:'payment_delete', id}
// POST {a:'block', apartment_id, check_in, check_out, notes}  → блок (ремонт/собственник)
// POST {a:'rc_sync'}                                      → подтянуть брони из RealtyCalendar (нужен RC_TOKEN в env)

const T = require('./_tg.js');
const SB_URL = process.env.SUPABASE_URL || 'https://sebvfvtofiysbywxjqut.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI';
const H = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const out = (code, body) => ({ statusCode: code, headers: H, body: JSON.stringify(body) });
const STATUSES = ['request', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'blocked'];
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const addDays = (iso, k) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };

async function q(path, opt) { const r = await T.sb(path, opt); if (!r.ok) { const t = await r.text(); const e = new Error(t.slice(0, 300)); e.status = r.status; throw e; } return r.status === 204 ? null : r.json(); }
function dbError(e) { // понятные ошибки базы
  const m = String(e.message || e);
  if (/bookings_no_overlap|exclusion/.test(m)) return 'Даты пересекаются с другой бронью этой квартиры';
  if (/bookings_status_chk/.test(m)) return 'Недопустимый статус';
  return m;
}

async function auth(event) {
  const h = event.headers || {};
  const tok = ((h.authorization || h.Authorization || '').match(/^Bearer\s+(.+)$/i) || [])[1];
  if (!tok) return null;
  const r = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: ANON, Authorization: 'Bearer ' + tok } });
  if (!r.ok) return null;
  const u = await r.json(); if (!u || !u.email) return null;
  const rows = await q('app_users?select=*&email=eq.' + encodeURIComponent(u.email.toLowerCase()));
  if (!rows.length) return null;
  return { email: u.email.toLowerCase(), role: rows[0].role, name: rows[0].name || u.email };
}
const canWrite = u => u && ['admin', 'manager'].includes(u.role);

// ---------- чтение ----------
async function grid(p) {
  const from = isDate(p.from) ? p.from : addDays(T.tashToday(0), -3);
  const to = isDate(p.to) ? p.to : addDays(from, 45);
  let apts = await q('apartments?select=id,name,complex,floor,rooms,weekday_price,weekend_price,is_active&is_active=eq.true&order=complex,floor,name');
  if (p.complex) apts = apts.filter(a => (a.complex || '').toLowerCase().indexOf(String(p.complex).toLowerCase()) === 0);
  const bk = await q('v_bookings?select=*&status=neq.cancelled&check_in=lt.' + to + '&check_out=gt.' + from + '&order=check_in&limit=5000');
  return { from, to, today: T.tashToday(0), apartments: apts, bookings: bk };
}
async function booking(id) {
  const [b, pays, ev] = await Promise.all([
    q('v_bookings?select=*&id=eq.' + encodeURIComponent(id)),
    q('payments?select=*&booking_id=eq.' + encodeURIComponent(id) + '&order=paid_at'),
    q('booking_events?select=*&booking_id=eq.' + encodeURIComponent(id) + '&order=created_at')
  ]);
  if (!b.length) throw Object.assign(new Error('not found'), { status: 404 });
  return { booking: b[0], payments: pays, events: ev };
}
async function free(p) {
  const ci = p.check_in, co = p.check_out; if (!isDate(ci) || !isDate(co) || co <= ci) throw new Error('check_in/check_out');
  const apts = await q('apartments?select=id,name,complex,floor,rooms,weekday_price,weekend_price,max_guests&is_active=eq.true&order=complex,floor,name');
  const busy = await q('bookings?select=apartment_id&status=neq.cancelled&check_in=lt.' + co + '&check_out=gt.' + ci);
  const set = new Set(busy.map(b => b.apartment_id)); const g = parseInt(p.guests || 0) || 0;
  const nights = Math.round((new Date(co) - new Date(ci)) / 86400000);
  const price = a => { let s = 0; for (let i = 0; i < nights; i++) { const d = new Date(addDays(ci, i) + 'T00:00:00Z').getUTCDay(); s += (d === 5 || d === 6) ? a.weekend_price : a.weekday_price; } return s; };
  return { check_in: ci, check_out: co, nights, free: apts.filter(a => !set.has(a.id) && (!g || (a.max_guests || 3) >= g)).map(a => Object.assign({ total: price(a) }, a)) };
}
async function today() {
  const d = T.tashToday(0), d1 = addDays(d, 1);
  const [living, cleaning] = await Promise.all([
    q('v_bookings?select=*&status=in.(confirmed,checked_in,checked_out,request)&check_in=lte.' + d1 + '&check_out=gte.' + d + '&order=apartment_id'),
    q('cleaning_tasks?select=*&date=gte.' + addDays(d, -1) + '&date=lte.' + d1)
  ]);
  const checkins = living.filter(b => b.check_in === d), checkouts = living.filter(b => b.check_out === d), tomorrow = living.filter(b => b.check_in === d1);
  const inhouse = living.filter(b => b.check_in <= d && b.check_out > d);
  return { date: d, checkins, checkouts, tomorrow, inhouse, cleaning, debts: inhouse.filter(b => (b.debt || 0) > 0 && b.currency === 'USD') };
}
async function guestSearch(qs) {
  const s = String(qs || '').trim(); if (s.length < 2) return [];
  const rows = await q('bookings?select=guest_name,guest_phone,guest_telegram,check_in,apartment_id&or=(guest_name.ilike.*' + encodeURIComponent(s) + '*,guest_phone.ilike.*' + encodeURIComponent(s) + '*)&order=check_in.desc&limit=20');
  const seen = {}; return rows.filter(r => { const k = (r.guest_phone || r.guest_name || '').toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; });
}

// ---------- запись ----------
const FIELDS = ['apartment_id', 'check_in', 'check_out', 'guest_name', 'guest_phone', 'guest_email', 'guest_telegram', 'guest_whatsapp', 'guests_count', 'total_price', 'currency', 'channel', 'notes', 'admin_notes', 'client_notes', 'arrival_time', 'departure_time', 'prepaid', 'deposit', 'color', 'status'];
function pick(body) { const o = {}; for (const f of FIELDS) if (body[f] !== undefined) o[f] = body[f]; return o; }
function ref() { const d = new Date(); return 'UL-' + d.toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(); }

async function create(body, user) {
  const o = pick(body);
  if (!o.apartment_id || !isDate(o.check_in) || !isDate(o.check_out) || o.check_out <= o.check_in) throw new Error('Нужны квартира и даты (выезд позже заезда)');
  if (!o.guest_name) o.guest_name = o.status === 'blocked' ? 'Блок' : 'Гость';
  o.status = STATUSES.includes(o.status) ? o.status : 'confirmed';
  o.source = 'manual'; o.channel = o.channel || 'telegram'; o.currency = o.currency || 'USD';
  o.nights = Math.round((new Date(o.check_out) - new Date(o.check_in)) / 86400000);
  o.total_price = Math.round(Number(o.total_price) || 0);
  o.created_by = user.email; o.booking_ref = ref();
  const rows = await q('bookings', { method: 'POST', body: JSON.stringify(o) });
  const b = rows[0];
  if (body.paid_now && Number(body.paid_now) > 0) await q('payments', { method: 'POST', body: JSON.stringify({ booking_id: b.id, amount: Number(body.paid_now), currency: o.currency, method: body.paid_method || 'cash', received_by: user.email, note: 'при создании' }) });
  return (await booking(b.id));
}
async function update(body, user) {
  if (!body.id) throw new Error('id');
  const o = pick(body); delete o.status;
  if (o.check_in && o.check_out && o.check_out <= o.check_in) throw new Error('Выезд должен быть позже заезда');
  if (o.check_in || o.check_out) { const cur = (await q('bookings?select=check_in,check_out&id=eq.' + body.id))[0]; const ci = o.check_in || cur.check_in, co = o.check_out || cur.check_out; o.nights = Math.round((new Date(co) - new Date(ci)) / 86400000); }
  o.created_by = user.email; // кто последним менял (для журнала)
  await q('bookings?id=eq.' + encodeURIComponent(body.id), { method: 'PATCH', body: JSON.stringify(o) });
  return booking(body.id);
}
async function setStatus(body, user) {
  if (!STATUSES.includes(body.status)) throw new Error('status');
  const o = { status: body.status, created_by: user.email };
  if (body.status === 'checked_in') o.checked_in = true; if (body.status === 'checked_out') o.checked_out = true; if (body.status === 'cancelled') o.cancelled_at = new Date().toISOString();
  await q('bookings?id=eq.' + encodeURIComponent(body.id), { method: 'PATCH', body: JSON.stringify(o) });
  return booking(body.id);
}
async function payment(body, user) {
  if (!body.booking_id || !(Number(body.amount) > 0)) throw new Error('Сумма платежа');
  const kind = ['payment', 'deposit', 'refund', 'deposit_return'].includes(body.kind) ? body.kind : 'payment';
  await q('payments', { method: 'POST', body: JSON.stringify({ booking_id: body.booking_id, amount: Number(body.amount), currency: body.currency || 'USD', method: body.method || 'cash', kind, note: body.note || null, received_by: user.email, paid_at: body.paid_at || new Date().toISOString() }) });
  return booking(body.booking_id);
}

// ---------- RealtyCalendar → мы ----------
async function rcSync() {
  const tok = process.env.RC_TOKEN; if (!tok) throw new Error('RC_TOKEN не задан в Netlify env');
  const map = await q('rpc/rc_apartment_map', { method: 'POST', body: '{}' });
  const ids = map.map(m => m.rc_id).join(',');
  const d = T.tashToday(0); const ranges = [[addDays(d, -40), addDays(d, 39)], [addDays(d, 40), addDays(d, 119)], [addDays(d, 120), addDays(d, 199)]];
  const ev = {};
  for (const [b, e] of ranges) {
    const r = await fetch('https://realtycalendar.ru/v2/event_calendars/?begin_date=' + b + '&end_date=' + e + '&statuses[]=booked&statuses[]=request&apartment_ids=' + ids, { headers: { 'X-User-Token': tok, Accept: 'application/json' } });
    if (!r.ok) throw new Error('RC ' + r.status + ' ' + (await r.text()).slice(0, 100));
    const j = await r.json();
    for (const it of (j.items || [])) for (const x of (it.events || [])) ev[x.id] = Object.assign({ apartment_id: it.apartment_id }, x);
  }
  const res = await q('rpc/calendar_import_rc', { method: 'POST', body: JSON.stringify({ items: Object.values(ev), actor: 'sync:rc' }) });
  return Object.assign({ fetched: Object.keys(ev).length }, res);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: H, body: '' };
  const p = event.queryStringParameters || {};
  try {
    // планировщик (Netlify schedule) — без авторизации: синхронизация RC
    if (event.httpMethod === 'POST' && p.a === 'rc_sync' && !event.headers.authorization && (event.headers['x-netlify-event'] || p.key === process.env.RC_SYNC_KEY)) return out(200, await rcSync());
    const user = await auth(event); if (!user) return out(401, { error: 'unauthorized' });
    if (event.httpMethod === 'GET') {
      switch (p.a) {
        case 'grid': return out(200, await grid(p));
        case 'booking': return out(200, await booking(p.id));
        case 'free': return out(200, await free(p));
        case 'today': return out(200, await today());
        case 'guest_search': return out(200, await guestSearch(p.q));
        default: return out(400, { error: 'unknown action' });
      }
    }
    const body = JSON.parse(event.body || '{}');
    if (!canWrite(user)) return out(403, { error: 'read only' });
    switch (body.a) {
      case 'create': return out(200, await create(body, user));
      case 'block': return out(200, await create(Object.assign({}, body, { status: 'blocked', guest_name: 'Блок', total_price: 0 }), user));
      case 'update': return out(200, await update(body, user));
      case 'status': return out(200, await setStatus(body, user));
      case 'payment': return out(200, await payment(body, user));
      case 'payment_delete': { const pr = (await q('payments?select=booking_id&id=eq.' + body.id))[0]; await q('payments?id=eq.' + body.id, { method: 'DELETE' }); return out(200, await booking(pr.booking_id)); }
      case 'rc_sync': return out(200, await rcSync());
      default: return out(400, { error: 'unknown action' });
    }
  } catch (e) { return out(e.status || 400, { error: dbError(e) }); }
};
exports.rcSync = rcSync;
