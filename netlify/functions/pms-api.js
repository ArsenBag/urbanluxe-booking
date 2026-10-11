// Urban Luxe — pms-api.js (11.10.2026). API шахматки /pms. Спека: docs/superpowers/specs/2026-10-11-pms-core.md
// bookings — мастер; цены — rate_calendar (кэш) + rpc pms_price; права — app_users.role, проверяются здесь, не в интерфейсе.
//
// GET  ?a=me                                            → кто я (email, role, name, apartment_ids)
// GET  ?a=grid&from=&to=                                → квартиры + брони + цены по дням + уборки за период
// GET  ?a=booking&id=                                   → бронь + платежи + журнал + гость
// GET  ?a=price&apartment_id=&check_in=&check_out=[&channel=&guests=&exclude=] → pms_price
// GET  ?a=free&check_in=&check_out=[&guests=]           → свободные квартиры на даты с ценой по формуле
// GET  ?a=today                                         → заезды / выезды / живут / завтра / долги / уборки
// GET  ?a=guest_search&q=                               → гости по имени/телефону/Telegram
// GET  ?a=guest&id=                                     → карточка гостя + его брони
// GET  ?a=debts                                         → брони с остатком (живут/выехали)
// GET  ?a=rules                                         → правила тарифов
// POST {a:'create'|'block'|'update'|'status'|'payment'|'payment_delete'}           → как в calendar-api, плюс журнал
// POST {a:'rate_set', apartment_ids:[], from, to, price?, min_nights?, closed?, closed_to_arrival?, note?}  → ручная правка дней (rate_overrides)
// POST {a:'rate_clear', apartment_ids:[], from, to}     → снять ручные правки
// POST {a:'rule_save', rule:{…}} | {a:'rule_delete', id}
// POST {a:'guest_update', id, notes?, tags?, lang?, doc_verified?, blacklisted?, name?, phone?, email?, telegram?, whatsapp?, citizenship?}

const T = require('./_tg.js');
const SB_URL = process.env.SUPABASE_URL || 'https://sebvfvtofiysbywxjqut.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI';
const H = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const out = (code, body) => ({ statusCode: code, headers: H, body: JSON.stringify(body) });
const STATUSES = ['request', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'blocked'];
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const addDays = (iso, k) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
const nightsOf = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const enc = encodeURIComponent;

async function q(path, opt) { const r = await T.sb(path, opt); const t = await r.text(); if (!r.ok) { const e = new Error(t.slice(0, 300)); e.status = r.status; throw e; } if (!t) return null; try { return JSON.parse(t); } catch (_) { return null; } }
// Supabase отдаёт максимум 1000 строк за запрос — читаем страницами
async function qAll(path, page) { page = page || 1000; const all = []; for (let i = 0; i < 50; i++) { const r = await T.sb(path, { headers: { Range: (i * page) + '-' + ((i + 1) * page - 1), Prefer: 'count=none' } }); if (!r.ok && r.status !== 416) { const t = await r.text(); throw new Error(t.slice(0, 300)); } const rows = r.status === 416 ? [] : await r.json(); all.push(...rows); if (rows.length < page) break; } return all; }
async function rpc(name, args) { return q('rpc/' + name, { method: 'POST', body: JSON.stringify(args || {}) }); }
function dbError(e) {
  const m = String(e.message || e);
  if (/bookings_no_overlap|exclusion/.test(m)) return 'Даты пересекаются с другой бронью этой квартиры';
  if (/bookings_status_chk/.test(m)) return 'Недопустимый статус';
  try { const j = JSON.parse(m); if (j.message) return j.message; } catch (_) { }
  return m;
}

// ---------- права ----------
const CAN = {
  admin: { write: 1, rates: 1, pay: 1, pay_full: 1, guests: 1, guests_write: 1, status_only: 0, users: 1 },
  booker: { write: 1, rates: 1, pay: 1, pay_full: 1, guests: 1, guests_write: 1 },
  ops: { write: 0, rates: 0, pay: 1, pay_full: 0, guests: 1, guests_write: 0, status_only: 1 },
  partner: { write: 0, rates: 0, pay: 1, pay_full: 0, guests: 0 }
};
async function auth(event) {
  const h = event.headers || {};
  const tok = ((h.authorization || h.Authorization || '').match(/^Bearer\s+(.+)$/i) || [])[1];
  if (!tok) return null;
  const r = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: ANON, Authorization: 'Bearer ' + tok } });
  if (!r.ok) return null;
  const u = await r.json(); if (!u || !u.email) return null;
  const rows = await q('app_users?select=*&email=eq.' + enc(u.email.toLowerCase()));
  if (!rows.length || rows[0].is_active === false) return null;
  const me = rows[0];
  return { email: me.email, role: me.role, name: me.name || me.email, apartment_ids: me.apartment_ids || null, can: CAN[me.role] || {} };
}
const aptFilter = (user, apts) => user.role === 'partner' ? apts.filter(a => (user.apartment_ids || []).includes(a.id)) : apts;
const aptIn = user => user.role === 'partner' ? '&apartment_id=in.(' + (user.apartment_ids || ['-']).map(enc).join(',') + ')' : '';
// ops/partner не видят способы оплаты и суммы по кассе — только paid/debt
function stripPay(user, b) { if (user.can.pay_full) return b; const o = Object.assign({}, b); delete o.prepaid; delete o.deposit; return o; }

// ---------- чтение ----------
async function grid(user, p) {
  const today = T.tashToday(0);
  const from = isDate(p.from) ? p.from : addDays(today, -30);
  const to = isDate(p.to) ? p.to : addDays(from, 90);
  const [apts, bk, rates, cleaning] = await Promise.all([
    q('apartments?select=id,name,complex,floor,rooms,max_guests,catalog_no,weekday_price,weekend_price,min_nights,is_active&is_active=eq.true&order=complex,catalog_no.nullslast,floor,name'),
    qAll('v_bookings?select=*&status=neq.cancelled&check_in=lt.' + to + '&check_out=gt.' + addDays(from, -1) + aptIn(user) + '&order=check_in'),
    qAll('rate_calendar?select=apartment_id,date,price,min_nights,closed,closed_to_arrival,available,source&date=gte.' + from + '&date=lt.' + to + aptIn(user) + '&order=apartment_id,date'),
    qAll('cleaning_tasks?select=apartment_id,date,done,hk_status,hk_maid&date=gte.' + from + '&date=lt.' + to + aptIn(user) + '&order=date').catch(() => [])
  ]);
  return { from, to, today, me: { role: user.role, name: user.name, can: user.can }, apartments: aptFilter(user, apts), bookings: bk.map(b => stripPay(user, b)), rates, cleaning };
}
async function booking(user, id) {
  const b = (await q('v_bookings?select=*&id=eq.' + enc(id)))[0];
  if (!b) throw Object.assign(new Error('not found'), { status: 404 });
  if (user.role === 'partner' && !(user.apartment_ids || []).includes(b.apartment_id)) throw Object.assign(new Error('forbidden'), { status: 403 });
  const [pays, ev, g] = await Promise.all([
    user.can.pay_full ? q('payments?select=*&booking_id=eq.' + enc(id) + '&order=paid_at') : [],
    q('booking_events?select=*&booking_id=eq.' + enc(id) + '&order=created_at'),
    b.guest_id && user.can.guests ? q('guests?select=id,name,phone,telegram,whatsapp,email,lang,tags,blacklisted,doc_verified,total_bookings,total_spent,last_stay,notes&id=eq.' + enc(b.guest_id)).then(r => r[0] || null) : null
  ]);
  return { booking: stripPay(user, b), payments: pays, events: ev, guest: g };
}
async function price(p) {
  if (!p.apartment_id || !isDate(p.check_in) || !isDate(p.check_out)) throw new Error('apartment_id, check_in, check_out');
  return rpc('pms_price', { p_apt: p.apartment_id, p_in: p.check_in, p_out: p.check_out, p_channel: p.channel || 'booker', p_guests: p.guests ? Number(p.guests) : null, p_exclude: p.exclude || null });
}
async function free(user, p) {
  const ci = p.check_in, co = p.check_out; if (!isDate(ci) || !isDate(co) || co <= ci) throw new Error('check_in/check_out');
  const g = parseInt(p.guests || 0) || 0, n = nightsOf(ci, co);
  const apts = aptFilter(user, await q('apartments?select=id,name,complex,floor,rooms,max_guests,catalog_no&is_active=eq.true&order=catalog_no.nullslast,complex,name'));
  const rc = await qAll('rate_calendar?select=apartment_id,available,closed,closed_to_arrival,min_nights,price&date=gte.' + ci + '&date=lt.' + co + '&order=apartment_id,date');
  const by = {}; rc.forEach(r => { (by[r.apartment_id] = by[r.apartment_id] || []).push(r); });
  const res = [];
  for (const a of apts) {
    const d = by[a.id] || []; if (d.length < n) continue;
    if (!d.every(x => x.available)) continue;
    if (g && (a.max_guests || 3) < g) continue;
    const pr = await price({ apartment_id: a.id, check_in: ci, check_out: co, channel: p.channel || 'booker' });
    res.push(Object.assign({}, a, { total: pr.total, subtotal: pr.subtotal, discount_label: pr.discount_label, ok: pr.ok, reason: pr.reason }));
  }
  return { check_in: ci, check_out: co, nights: n, free: res };
}
async function today(user) {
  const d = T.tashToday(0), d1 = addDays(d, 1);
  const [living, cleaning] = await Promise.all([
    q('v_bookings?select=*&status=in.(confirmed,checked_in,checked_out,request)&check_in=lte.' + d1 + '&check_out=gte.' + d + aptIn(user) + '&order=apartment_id'),
    q('cleaning_tasks?select=*&date=gte.' + addDays(d, -1) + '&date=lte.' + d1 + aptIn(user)).catch(() => [])
  ]);
  const L = living.map(b => stripPay(user, b));
  const inhouse = L.filter(b => b.check_in <= d && b.check_out > d);
  return { date: d, checkins: L.filter(b => b.check_in === d), checkouts: L.filter(b => b.check_out === d), tomorrow: L.filter(b => b.check_in === d1), inhouse, cleaning, debts: L.filter(b => (b.debt || 0) > 0 && b.currency === 'USD' && b.status !== 'request') };
}
async function guestSearch(s) {
  s = String(s || '').trim(); if (s.length < 2) return [];
  const digits = s.replace(/\D/g, '');
  const or = ['name.ilike.*' + enc(s) + '*', 'telegram.ilike.*' + enc(s.replace(/^@/, '')) + '*'];
  if (digits.length >= 4) { or.push('phone_norm.ilike.*' + digits + '*'); or.push('phone.ilike.*' + enc(digits) + '*'); }
  return q('guests?select=id,name,phone,telegram,whatsapp,email,lang,tags,blacklisted,total_bookings,total_spent,last_stay&or=(' + or.join(',') + ')&order=total_bookings.desc&limit=15');
}
async function guest(id) {
  const g = (await q('guests?select=*&id=eq.' + enc(id)))[0]; if (!g) throw Object.assign(new Error('not found'), { status: 404 });
  const bk = await q('v_bookings?select=id,apartment_id,apartment_name,complex,check_in,check_out,nights,status,total_price,currency,paid,debt,pay_state,channel&guest_id=eq.' + enc(id) + '&order=check_in.desc&limit=200');
  return { guest: g, bookings: bk };
}
async function debts(user) {
  const rows = await q('v_bookings?select=*&status=in.(checked_in,checked_out)&debt=gt.0&check_out=gte.' + addDays(T.tashToday(0), -120) + aptIn(user) + '&order=check_out&limit=1000');
  return rows.filter(b => b.total_price > 0).map(b => Object.assign(stripPay(user, b), { days: nightsOf(b.check_out, T.tashToday(0)) }));
}

// ---------- запись ----------
const FIELDS = ['apartment_id', 'check_in', 'check_out', 'guest_name', 'guest_phone', 'guest_email', 'guest_telegram', 'guest_whatsapp', 'guests_count', 'total_price', 'currency', 'channel', 'notes', 'admin_notes', 'client_notes', 'arrival_time', 'departure_time', 'prepaid', 'deposit', 'color', 'status', 'guest_id'];
function pick(body) { const o = {}; for (const f of FIELDS) if (body[f] !== undefined) o[f] = body[f]; return o; }
function ref() { const d = new Date(); return 'UL-' + d.toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(); }
const logEvent = (booking_id, type, payload, user) => q('booking_events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ booking_id, type, payload, actor: user.name || user.email }) }).catch(() => null);

async function create(body, user) {
  const o = pick(body);
  if (!o.apartment_id || !isDate(o.check_in) || !isDate(o.check_out) || o.check_out <= o.check_in) throw new Error('Нужны квартира и даты (выезд позже заезда)');
  if (!o.guest_name) o.guest_name = o.status === 'blocked' ? 'Блок' : 'Гость';
  o.status = STATUSES.includes(o.status) ? o.status : 'confirmed';
  o.source = 'manual'; o.channel = o.channel || 'telegram'; o.currency = o.currency || 'USD';
  o.nights = nightsOf(o.check_in, o.check_out);
  // цена: если бронер не задал — по формуле; если задал — запоминаем расхождение с прайсом в журнале
  let list = null;
  if (o.status !== 'blocked') { try { list = await price({ apartment_id: o.apartment_id, check_in: o.check_in, check_out: o.check_out, channel: o.channel }); } catch (_) { } }
  if (!(Number(o.total_price) > 0) && list && list.total) o.total_price = list.total;
  o.total_price = Math.round(Number(o.total_price) || 0);
  o.created_by = user.email; o.booking_ref = ref();
  const b = (await q('bookings', { method: 'POST', body: JSON.stringify(o) }))[0];
  if (list && list.total && Math.abs(list.total - o.total_price) > 1) await logEvent(b.id, 'price_manual', { list_price: list.total, price: o.total_price, diff: o.total_price - list.total }, user);
  if (body.paid_now && Number(body.paid_now) > 0) await payment({ booking_id: b.id, amount: Number(body.paid_now), method: body.paid_method || 'cash', kind: 'prepayment', note: 'при создании', currency: o.currency }, user);
  return booking(user, b.id);
}
async function update(body, user) {
  if (!body.id) throw new Error('id');
  const o = pick(body); delete o.status;
  const cur = (await q('bookings?select=id,apartment_id,check_in,check_out,total_price,status&id=eq.' + enc(body.id)))[0];
  if (!cur) throw new Error('not found');
  const ci = o.check_in || cur.check_in, co = o.check_out || cur.check_out;
  if (co <= ci) throw new Error('Выезд должен быть позже заезда');
  if (o.check_in || o.check_out) o.nights = nightsOf(ci, co);
  if (o.total_price !== undefined) o.total_price = Math.round(Number(o.total_price) || 0);
  o.created_by = user.email; o.updated_at = new Date().toISOString();
  await q('bookings?id=eq.' + enc(body.id), { method: 'PATCH', body: JSON.stringify(o) });
  if (o.total_price !== undefined && o.total_price !== cur.total_price) await logEvent(body.id, 'price_change', { from: cur.total_price, to: o.total_price }, user);
  if ((o.apartment_id && o.apartment_id !== cur.apartment_id) || (o.check_in && o.check_in !== cur.check_in) || (o.check_out && o.check_out !== cur.check_out))
    await logEvent(body.id, 'moved', { from: [cur.apartment_id, cur.check_in, cur.check_out], to: [o.apartment_id || cur.apartment_id, ci, co] }, user);
  return booking(user, body.id);
}
async function setStatus(body, user) {
  if (!STATUSES.includes(body.status)) throw new Error('status');
  if (user.can.status_only && !['checked_in', 'checked_out'].includes(body.status)) throw Object.assign(new Error('Только отметки заехал/выехал'), { status: 403 });
  const cur = (await q('v_bookings?select=id,status,debt,total_price,currency&id=eq.' + enc(body.id)))[0];
  if (!cur) throw new Error('not found');
  if (body.status === 'checked_out' && cur.total_price > 0 && (cur.debt || 0) > 0 && !body.close_with_debt) {
    const e = new Error('DEBT:' + cur.debt); e.status = 409; throw e;   // интерфейс спросит «закрыть с долгом?» + причину
  }
  const o = { status: body.status, created_by: user.email };
  if (body.status === 'checked_in') o.checked_in = true; if (body.status === 'checked_out') o.checked_out = true; if (body.status === 'cancelled') o.cancelled_at = new Date().toISOString();
  await q('bookings?id=eq.' + enc(body.id), { method: 'PATCH', body: JSON.stringify(o) });
  if (body.close_with_debt) await logEvent(body.id, 'closed_with_debt', { debt: cur.debt, reason: body.reason || '' }, user);
  return booking(user, body.id);
}
async function payment(body, user) {
  if (!body.booking_id || !(Number(body.amount) > 0)) throw new Error('Сумма платежа');
  const kind = ['payment', 'prepayment', 'deposit', 'refund', 'deposit_return'].includes(body.kind) ? body.kind : 'payment';
  const method = ['cash', 'card', 'transfer', 'payme', 'click', 'ota'].includes(body.method) ? body.method : 'cash';
  const rec = { booking_id: body.booking_id, amount: Number(body.amount), currency: body.currency || 'USD', method, kind, note: body.note || null, received_by: user.name || user.email, paid_at: body.paid_at || new Date().toISOString() };
  const p = (await q('payments', { method: 'POST', body: JSON.stringify(rec) }))[0];
  await logEvent(body.booking_id, 'payment', { id: p.id, amount: rec.amount, currency: rec.currency, method, kind }, user);
  return booking(user, body.booking_id);
}
async function paymentDelete(body, user) {
  const pr = (await q('payments?select=*&id=eq.' + enc(body.id)))[0]; if (!pr) throw new Error('not found');
  await q('payments?id=eq.' + enc(body.id), { method: 'DELETE' });
  await logEvent(pr.booking_id, 'payment_delete', { amount: pr.amount, currency: pr.currency, method: pr.method, kind: pr.kind }, user);
  return booking(user, pr.booking_id);
}

// ---------- цены ----------
async function rateSet(body, user) {
  const ids = Array.isArray(body.apartment_ids) ? body.apartment_ids.filter(Boolean) : [];
  if (!ids.length || !isDate(body.from) || !isDate(body.to) || body.to < body.from) throw new Error('apartment_ids, from, to');
  const days = nightsOf(body.from, body.to) + 1; if (days > 370 || ids.length * days > 5000) throw new Error('Слишком большой диапазон (до 5 000 дней за раз)');
  const rows = [];
  for (const id of ids) for (let i = 0; i < days; i++) {
    const r = { apartment_id: id, date: addDays(body.from, i), set_by: user.name || user.email, set_at: new Date().toISOString(), note: body.note || null };
    if (body.price !== undefined && body.price !== null && body.price !== '') r.price = Math.round(Number(body.price));
    if (body.min_nights !== undefined && body.min_nights !== null && body.min_nights !== '') r.min_nights = Math.max(1, parseInt(body.min_nights));
    if (body.closed !== undefined) r.closed = !!body.closed;
    if (body.closed_to_arrival !== undefined) r.closed_to_arrival = body.closed_to_arrival === null ? null : !!body.closed_to_arrival;
    rows.push(r);
  }
  // merge: не затираем поля, которые не переданы
  await q('rate_overrides?on_conflict=apartment_id,date', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' }, body: JSON.stringify(rows) });
  return { ok: true, rows: rows.length };
}
async function rateClear(body) {
  const ids = Array.isArray(body.apartment_ids) ? body.apartment_ids.filter(Boolean) : [];
  if (!ids.length || !isDate(body.from) || !isDate(body.to)) throw new Error('apartment_ids, from, to');
  await q('rate_overrides?apartment_id=in.(' + ids.map(enc).join(',') + ')&date=gte.' + body.from + '&date=lte.' + body.to, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  return { ok: true };
}
const RULE_FIELDS = ['name', 'scope', 'complex', 'apartment_id', 'date_from', 'date_to', 'weekdays', 'kind', 'value', 'min_nights', 'closed_to_arrival', 'min_nights_for', 'channel', 'priority', 'is_active'];
async function ruleSave(body, user) {
  const r = body.rule || {}; const o = {}; for (const f of RULE_FIELDS) if (r[f] !== undefined) o[f] = r[f] === '' ? null : r[f];
  if (!o.name || !o.kind) throw new Error('name, kind');
  o.updated_at = new Date().toISOString();
  if (r.id) { await q('rate_rules?id=eq.' + enc(r.id), { method: 'PATCH', body: JSON.stringify(o) }); return (await q('rate_rules?select=*&id=eq.' + enc(r.id)))[0]; }
  o.created_by = user.name || user.email;
  return (await q('rate_rules', { method: 'POST', body: JSON.stringify(o) }))[0];
}
async function guestUpdate(body, user) {
  if (!body.id) throw new Error('id');
  const o = {}; for (const f of ['name', 'phone', 'email', 'telegram', 'whatsapp', 'citizenship', 'lang', 'tags', 'doc_verified', 'blacklisted', 'needs_registration']) if (body[f] !== undefined) o[f] = body[f];
  if (body.note) { const g = (await q('guests?select=notes&id=eq.' + enc(body.id)))[0]; o.notes = ((g && g.notes) ? g.notes + '\n' : '') + new Date().toISOString().slice(0, 10) + ' ' + (user.name || user.email) + ': ' + body.note; }
  if (body.notes !== undefined) o.notes = body.notes;
  o.updated_at = new Date().toISOString();
  await q('guests?id=eq.' + enc(body.id), { method: 'PATCH', body: JSON.stringify(o) });
  return guest(body.id);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: H, body: '' };
  const p = event.queryStringParameters || {};
  try {
    const user = await auth(event); if (!user) return out(401, { error: 'unauthorized' });
    if (event.httpMethod === 'GET') {
      switch (p.a) {
        case 'me': return out(200, { email: user.email, role: user.role, name: user.name, apartment_ids: user.apartment_ids, can: user.can });
        case 'grid': return out(200, await grid(user, p));
        case 'booking': return out(200, await booking(user, p.id));
        case 'price': return out(200, await price(p));
        case 'free': return out(200, await free(user, p));
        case 'today': return out(200, await today(user));
        case 'guest_search': if (!user.can.guests) return out(403, { error: 'forbidden' }); return out(200, await guestSearch(p.q));
        case 'guest': if (!user.can.guests) return out(403, { error: 'forbidden' }); return out(200, await guest(p.id));
        case 'debts': if (!user.can.pay) return out(403, { error: 'forbidden' }); return out(200, await debts(user));
        case 'rules': if (!user.can.rates) return out(403, { error: 'forbidden' }); return out(200, await q('rate_rules?select=*&order=is_active.desc,priority.desc,date_from.desc.nullslast'));
        default: return out(400, { error: 'unknown action' });
      }
    }
    const body = JSON.parse(event.body || '{}');
    const need = (flag) => { if (!user.can[flag]) { const e = new Error('Нет прав: ' + flag); e.status = 403; throw e; } };
    switch (body.a) {
      case 'create': need('write'); return out(200, await create(body, user));
      case 'block': need('write'); return out(200, await create(Object.assign({}, body, { status: 'blocked', guest_name: body.guest_name || 'Блок', total_price: 0 }), user));
      case 'update': need('write'); return out(200, await update(body, user));
      case 'status': if (!user.can.write && !user.can.status_only) need('write'); return out(200, await setStatus(body, user));
      case 'payment': need('pay_full'); return out(200, await payment(body, user));
      case 'payment_delete': need('pay_full'); return out(200, await paymentDelete(body, user));
      case 'rate_set': need('rates'); return out(200, await rateSet(body, user));
      case 'rate_clear': need('rates'); return out(200, await rateClear(body));
      case 'rule_save': need('rates'); return out(200, await ruleSave(body, user));
      case 'rule_delete': need('rates'); await q('rate_rules?id=eq.' + enc(body.id), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); return out(200, { ok: true });
      case 'guest_update': need('guests_write'); return out(200, await guestUpdate(body, user));
      default: return out(400, { error: 'unknown action' });
    }
  } catch (e) { return out(e.status || 400, { error: dbError(e) }); }
};
