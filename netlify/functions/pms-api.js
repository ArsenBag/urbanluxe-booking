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
// Шаг 3 (13.10.2026):
// POST {a:'guest_link', booking_id, guest_id|null}       → привязать / отвязать гостя от брони
// POST {a:'guest_create', booking_id?, name, phone, …}   → новая карточка (дубль по телефону/TG → существующая) [+ привязка]
// GET  ?a=users (admin)                                  → сотрудники app_users + staff (chat_id из ботов) + организации
// POST {a:'user_save', user:{email,name,role,org_id,apartment_ids?,telegram_chat_id?,is_active,password?}} (admin) → создаёт auth-пользователя при первом сохранении
// POST {a:'user_logout_all', email} (admin)              → снять все сессии

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
// 14.10.2026: страницы после первой грузятся параллельно (Content-Range даёт общее число строк) — шахматка на 3 месяца
// (4–5 тыс. строк rate_calendar) раньше шла 5 последовательными запросами.
async function qAll(path, page) {
  page = page || 1000;
  const first = await T.sb(path, { headers: { Range: '0-' + (page - 1), Prefer: 'count=exact' } });
  if (!first.ok && first.status !== 416) { const t = await first.text(); throw new Error(t.slice(0, 300)); }
  if (first.status === 416) return [];
  const rows = await first.json();
  const total = parseInt(String(first.headers.get('content-range') || '').split('/')[1], 10);
  if (!(total > rows.length)) return rows;
  const pages = []; for (let off = page; off < total && pages.length < 50; off += page) pages.push(off);
  const rest = await Promise.all(pages.map(off => T.sb(path, { headers: { Range: off + '-' + (off + page - 1), Prefer: 'count=none' } }).then(r => r.ok ? r.json() : [])));
  return rows.concat(...rest);
}
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
  admin: { write: 1, rates: 1, report: 1, pay: 1, pay_full: 1, guests: 1, guests_write: 1, status_only: 0, users: 1, objects: 1, objects_archive: 1 },
  booker: { write: 1, rates: 0, report: 0, pay: 1, pay_full: 1, guests: 1, guests_write: 1 }, // 16.10.2026: бронерам «Цены» и «Отчёт» не нужны
  ops: { write: 0, rates: 0, pay: 1, pay_full: 0, guests: 1, guests_write: 0, status_only: 1, objects: 1 },
  partner: { write: 0, rates: 0, pay: 1, pay_full: 0, guests: 0 }
};
// 14.10.2026: вход кэшируется на тёплом инстансе функции (токен → пользователь, 2 мин). Раньше каждый вызов API делал
// 4 последовательных запроса к Supabase (auth → app_users → organizations → rpc) — при функциях в США и базе во Франкфурте
// это ~1 с на каждый клик. Теперь 1 раз на 2 минуты; org и доступ к квартирам грузятся параллельно.
const AUTH_CACHE = new Map(); const AUTH_TTL = 120000;
async function auth(event) {
  const h = event.headers || {};
  const tok = ((h.authorization || h.Authorization || '').match(/^Bearer\s+(.+)$/i) || [])[1];
  if (!tok) return null;
  const qp = event.queryStringParameters || {}; const wantOrg = Number(qp.org || h['x-org'] || h['X-Org'] || 0) || 0;   // B: платформа-админ смотрит другую организацию
  const ckey = tok + '|' + wantOrg;
  const hit = AUTH_CACHE.get(ckey); if (hit && hit.exp > Date.now()) return hit.user;
  const r = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: ANON, Authorization: 'Bearer ' + tok } });
  if (!r.ok) return null;
  const u = await r.json(); if (!u || !u.email) return null;
  const rows = await q('app_users?select=*&email=eq.' + enc(u.email.toLowerCase()));
  if (!rows.length || rows[0].is_active === false) return null;
  const me = rows[0];
  const platformAdmin = me.role === 'admin' && (me.org_id || 1) === 1;
  const orgId = platformAdmin && wantOrg ? wantOrg : (me.org_id || 1);
  const [orgRows, accRows] = await Promise.all([q('organizations?select=id,name,short,slug,logo_url,plan_limit,tg_chat_id,settings,is_active&id=eq.' + orgId), q('rpc/pms_org_apartments', { method: 'POST', body: JSON.stringify({ p_org: orgId }) })]);
  const org = orgRows[0] || { id: 1, name: 'Urban Luxe', short: 'UL' };
  if (org.settings && org.settings.channex) org.settings = Object.assign({}, org.settings, { channex: Object.assign({}, org.settings.channex, { api_key: org.settings.channex.api_key ? '•••' : null }) });   // ключ в интерфейс не отдаём
  const access = {}; accRows.forEach(x => access[x.apartment_id] = x.mode);
  const user = { email: me.email, role: me.role, name: me.name || me.email, apartment_ids: me.apartment_ids || null, can: CAN[me.role] || {}, org, access, platform_admin: platformAdmin, home_org_id: me.org_id || 1 };
  if (AUTH_CACHE.size > 200) AUTH_CACHE.clear();
  AUTH_CACHE.set(ckey, { user, exp: Date.now() + AUTH_TTL });
  return user;
}
// Видимость квартир: партнёр-собственник — свой список; остальные — квартиры своей организации + общие (apartment_access)
const canSeeApt = (user, id) => user.role === 'partner' ? (user.apartment_ids || []).includes(id) : !!user.access[id];
const fullApt = (user, id) => user.role === 'partner' ? false : user.access[id] === 'full';
const aptFilter = (user, apts) => apts.filter(a => canSeeApt(user, a.id));
const aptIn = user => { const ids = user.role === 'partner' ? (user.apartment_ids || []) : Object.keys(user.access); return '&apartment_id=in.(' + (ids.length ? ids : ['-']).map(enc).join(',') + ')'; };
// ops/partner не видят способы оплаты и суммы по кассе — только paid/debt; чужая квартира в режиме «занятость» — без гостя и денег
function stripPay(user, b) {
  let o = b;
  if (!fullApt(user, b.apartment_id) && user.role !== 'partner') { o = Object.assign({}, b, { guest_name: 'Занято · ' + (b.org_short || ''), guest_phone: null, guest_telegram: null, guest_whatsapp: null, guest_email: null, notes: null, admin_notes: null, client_notes: null, total_price: null, paid: null, debt: null, prepaid: null, deposit: null, pay_state: 'none', guest_id: null, external_id: null, occupancy_only: true }); return o; }
  if (b.org_id && user.org && b.org_id !== user.org.id) o = Object.assign({}, b, { foreign_org: true });
  if (user.can.pay_full) return o; o = Object.assign({}, o); delete o.prepaid; delete o.deposit; delete o.deposit_held; return o;
}
const needFull = (user, apt) => { if (!fullApt(user, apt)) { const e = new Error('Нет доступа к этой квартире'); e.status = 403; throw e; } };

// ---------- чтение ----------
async function grid(user, p) {
  const today = T.tashToday(0);
  const from = isDate(p.from) ? p.from : addDays(today, -30);
  const to = isDate(p.to) ? p.to : addDays(from, 90);
  const [apts, bk, rates, cleaning] = await Promise.all([
    q('apartments?select=id,name,complex,floor,rooms,max_guests,catalog_no,weekday_price,weekend_price,min_nights,is_active,org_id&is_active=eq.true&order=complex,catalog_no.nullslast,floor,name'),
    // 17.10: ?cancelled=1 — вместе с отменёнными (флажок «отменённые» в шахматке: найти/открыть удалённую бронь)
    qAll('v_bookings?select=*' + (p.cancelled ? '' : '&status=neq.cancelled') + '&check_in=lt.' + to + '&check_out=gt.' + addDays(from, -1) + aptIn(user) + '&order=check_in'),
    qAll('rate_calendar?select=apartment_id,date,price,min_nights,closed,closed_to_arrival,available,source&date=gte.' + from + '&date=lt.' + to + aptIn(user) + '&order=apartment_id,date'),
    qAll('cleaning_tasks?select=apartment_id,date,done,hk_status,hk_maid&date=gte.' + from + '&date=lt.' + to + aptIn(user) + '&order=date').catch(() => [])
  ]);
  const orgs = await q('organizations?select=id,name,short&is_active=eq.true'); const orgOf = id => orgs.find(o => o.id === id) || {};
  // B: mode = full (своя/общая) | occupancy (квартира партнёра сети — только занятость); partner_of — чья квартира
  const list = aptFilter(user, apts).map(a => Object.assign(a, { mode: user.role === 'partner' ? 'owner' : (user.access[a.id] || 'full'), partner_of: a.org_id && a.org_id !== user.org.id ? (orgOf(a.org_id).short || orgOf(a.org_id).name || '') : null }));
  return { from, to, today, me: { role: user.role, name: user.name, can: user.can, org: user.org, access: user.access, platform_admin: user.platform_admin }, apartments: list, bookings: bk.map(b => stripPay(user, b)), rates, cleaning };
}
async function booking(user, id) {
  const b = (await q('v_bookings?select=*&id=eq.' + enc(id)))[0];
  if (!b) throw Object.assign(new Error('not found'), { status: 404 });
  if (!canSeeApt(user, b.apartment_id)) throw Object.assign(new Error('forbidden'), { status: 403 });
  if (!fullApt(user, b.apartment_id)) return { booking: stripPay(user, b), payments: [], events: [], guest: null };
  const [pays, ev, g, cb] = await Promise.all([
    user.can.pay_full ? q('payments?select=*&booking_id=eq.' + enc(id) + '&order=paid_at') : [],
    q('booking_events?select=*&booking_id=eq.' + enc(id) + '&order=created_at'),
    b.guest_id && user.can.guests ? q('guests?select=id,name,phone,telegram,whatsapp,email,lang,tags,blacklisted,doc_verified,total_bookings,total_spent,last_stay,notes&id=eq.' + enc(b.guest_id)).then(r => r[0] || null) : null,
    // 17.10: всё, что прислала площадка (последняя ревизия Channex) — комиссия, кто собирает оплату, карта, цены по ночам, сообщение гостя
    b.source === 'channex' ? q('channel_bookings?select=id,revision_id,received_at,payload&booking_id=eq.' + enc(id) + '&order=id.desc&limit=1').then(r => r[0] || null).catch(() => null) : null
  ]);
  let ota = null;
  if (cb && cb.payload) {
    const p = Object.assign({}, cb.payload); delete p.raw_message;
    const room = (p.rooms || [])[0] || {};
    const ch = (b.channel || '').toLowerCase();
    const mk = (await q('channel_markups?select=commission_pct&org_id=eq.' + user.org.id + '&channel=eq.' + enc(ch)).catch(() => []))[0];
    // карта гарантии: только тип и последние 4 цифры (полные данные — в Channex, PCI)
    const gq = p.guarantee && typeof p.guarantee === 'object' ? { card_type: p.guarantee.card_type || null, last4: String(p.guarantee.card_number || '').replace(/\D/g, '').slice(-4) || null, expiration: p.guarantee.expiration_date || null, holder: p.guarantee.cardholder_name || null, is_virtual: p.guarantee.is_virtual || null } : null;
    ota = { ota_name: p.ota_name, unique_id: p.unique_id, code: p.ota_reservation_code, status: p.status, inserted_at: p.inserted_at, received_at: cb.received_at, imported: !!(p.meta && p.meta.is_imported), amount: p.amount, currency: p.currency,
      ota_commission: p.ota_commission, payment_collect: p.payment_collect, payment_type: p.payment_type, guarantee: gq, notes: p.notes || null, services: p.services || [], deposits: p.deposits || [], occupancy: room.occupancy || p.occupancy || null,
      days: room.days || null, taxes: room.taxes || [], meal_plan: room.meta && room.meta.meal_plan || null, cancel_penalties: room.meta && room.meta.cancel_penalties || [], promotion: room.meta && (room.meta.days_breakdown || []).find(d => d.promotion) ? (room.meta.days_breakdown || []).filter(d => d.promotion).map(d => d.promotion) : [],
      commission_pct_default: mk && mk.commission_pct != null ? Number(mk.commission_pct) : null, secondary_ota: p.secondary_ota || null, agent: p.agent || null, arrival_hour: p.arrival_hour || null };
  }
  return { booking: stripPay(user, b), payments: pays, events: ev, guest: g, ota };
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
  return { date: d, checkins: L.filter(b => b.check_in === d), checkouts: L.filter(b => b.check_out === d), tomorrow: L.filter(b => b.check_in === d1), inhouse, cleaning, debts: L.filter(b => (b.debt || 0) > 0 && b.currency === 'USD' && b.status !== 'request' && isRealDebt(b)) };
}
async function guestSearch(s, user) {
  s = String(s || '').trim(); if (s.length < 2) return [];
  const digits = s.replace(/\D/g, '');
  const or = ['name.ilike.*' + enc(s) + '*', 'telegram.ilike.*' + enc(s.replace(/^@/, '')) + '*'];
  if (digits.length >= 4) { or.push('phone_norm.ilike.*' + digits + '*'); or.push('phone.ilike.*' + enc(digits) + '*'); }
  return q('guests?select=id,name,phone,telegram,whatsapp,email,lang,tags,blacklisted,total_bookings,total_spent,last_stay&org_id=eq.' + user.org.id + '&or=(' + or.join(',') + ')&order=total_bookings.desc&limit=15');
}
async function guest(id) {
  const g = (await q('guests?select=*&id=eq.' + enc(id)))[0]; if (!g) throw Object.assign(new Error('not found'), { status: 404 });
  const bk = await q('v_bookings?select=id,apartment_id,apartment_name,complex,check_in,check_out,nights,status,total_price,currency,paid,debt,pay_state,channel&guest_id=eq.' + enc(id) + '&order=check_in.desc&limit=200');
  return { guest: g, bookings: bk };
}
const isRealDebt = b => b.status !== 'blocked' && !(b.source === 'rc' && !(b.paid > 0) && !(b.prepaid > 0));
async function debts(user) {
  const rows = await q('v_bookings?select=*&status=in.(checked_in,checked_out)&debt=gt.0&check_out=gte.' + addDays(T.tashToday(0), -120) + aptIn(user) + '&order=check_out&limit=1000');
  // 14.10.2026: брони из RC без единого платежа у нас — не долг (RC не отдаёт оплаты; Арсен: «долг — только по нашим броням»)
  return rows.filter(b => b.total_price > 0 && isRealDebt(b)).map(b => Object.assign(stripPay(user, b), { days: nightsOf(b.check_out, T.tashToday(0)) }));
}

// ---------- запись ----------
const FIELDS = ['apartment_id', 'check_in', 'check_out', 'guest_name', 'guest_phone', 'guest_email', 'guest_telegram', 'guest_whatsapp', 'guests_count', 'total_price', 'currency', 'channel', 'notes', 'admin_notes', 'client_notes', 'arrival_time', 'departure_time', 'prepaid', 'deposit', 'color', 'status', 'guest_id'];
function pick(body) { const o = {}; for (const f of FIELDS) if (body[f] !== undefined) o[f] = body[f]; return o; }
function ref() { const d = new Date(); return 'UL-' + d.toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(); }
// 16.10: автор действия в журнале — «Имя (UL)» / «Имя (HL)»: видно, какой сотрудник какой организации что сделал
const actorOf = user => (user.name || user.email) + (user.org && user.org.short ? ' (' + user.org.short + ')' : '');
const logEvent = (booking_id, type, payload, user) => q('booking_events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ booking_id, type, payload, actor: actorOf(user) }) }).catch(() => null);

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
  needFull(user, o.apartment_id);
  o.created_by = actorOf(user); o.updated_by = actorOf(user); o.booking_ref = ref(); o.org_id = user.org.id;
  const b = (await q('bookings', { method: 'POST', body: JSON.stringify(o) }))[0];
  if (b.guest_id) q('guests?id=eq.' + enc(b.guest_id) + '&org_id=eq.1', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ org_id: user.org.id }) }).catch(() => null);
  if (list && list.total && Math.abs(list.total - o.total_price) > 1) await logEvent(b.id, 'price_manual', { list_price: list.total, price: o.total_price, diff: o.total_price - list.total }, user);
  if (body.paid_now && Number(body.paid_now) > 0) await payment({ booking_id: b.id, amount: Number(body.paid_now), method: body.paid_method || 'cash', kind: 'prepayment', note: 'при создании', currency: o.currency }, user);
  return booking(user, b.id);
}
async function update(body, user) {
  if (!body.id) throw new Error('id');
  const o = pick(body); delete o.status;
  const cur = (await q('bookings?select=id,apartment_id,check_in,check_out,total_price,status&id=eq.' + enc(body.id)))[0];
  if (!cur) throw new Error('not found');
  needFull(user, cur.apartment_id); if (o.apartment_id) needFull(user, o.apartment_id);
  const ci = o.check_in || cur.check_in, co = o.check_out || cur.check_out;
  if (co <= ci) throw new Error('Выезд должен быть позже заезда');
  if (o.check_in || o.check_out) o.nights = nightsOf(ci, co);
  if (o.total_price !== undefined) o.total_price = Math.round(Number(o.total_price) || 0);
  o.updated_by = actorOf(user); o.updated_at = new Date().toISOString();
  await q('bookings?id=eq.' + enc(body.id), { method: 'PATCH', body: JSON.stringify(o) });
  if (o.total_price !== undefined && o.total_price !== cur.total_price) await logEvent(body.id, 'price_change', { from: cur.total_price, to: o.total_price }, user);
  // событие 'moved' пишет триггер bookings_log_event (объект from/to) — второе здесь было дублем
  return booking(user, body.id);
}
async function setStatus(body, user) {
  if (!STATUSES.includes(body.status)) throw new Error('status');
  if (user.can.status_only && !['checked_in', 'checked_out'].includes(body.status)) throw Object.assign(new Error('Только отметки заехал/выехал'), { status: 403 });
  const cur = (await q('v_bookings?select=id,status,debt,total_price,currency,apartment_id&id=eq.' + enc(body.id)))[0];
  if (!cur) throw new Error('not found'); needFull(user, cur.apartment_id);
  if (body.status === 'checked_out' && cur.total_price > 0 && (cur.debt || 0) > 0 && !body.close_with_debt) {
    const e = new Error('DEBT:' + cur.debt); e.status = 409; throw e;   // интерфейс спросит «закрыть с долгом?» + причину
  }
  const o = { status: body.status, updated_by: actorOf(user) };
  if (body.status === 'checked_in') o.checked_in = true; if (body.status === 'checked_out') o.checked_out = true; if (body.status === 'cancelled') { o.cancelled_at = new Date().toISOString(); if (body.reason) o.cancel_reason = String(body.reason).slice(0, 300); }
  // 14.10.2026: заявка с сайта (request) подтверждается/отменяется из /pms так же, как из /admin — письмо гостю + TG
  if (cur.status === 'request' && body.status === 'confirmed') { o.confirmed_at = new Date().toISOString(); o.confirmed_by = user.email; }
  await q('bookings?id=eq.' + enc(body.id), { method: 'PATCH', body: JSON.stringify(o) });
  if (body.close_with_debt) await logEvent(body.id, 'closed_with_debt', { debt: cur.debt, reason: body.reason || '' }, user);
  if (cur.status === 'request' && (body.status === 'confirmed' || body.status === 'cancelled')) {
    try {
      const b = (await q('bookings?select=*&id=eq.' + enc(body.id)))[0] || {}; const apt = (await q('apartments?select=id,name,complex,floor&id=eq.' + enc(b.apartment_id)))[0] || {};
      const MAIL = require('./_booking-mail.js'), NOTIFY = require('./notify.js');
      if (body.status === 'confirmed') { await MAIL.mailConfirmed(b, apt); await NOTIFY.sendTg({ type: 'request_confirmed', apartment: apt.name, guest_name: b.guest_name, check_in: b.check_in, check_out: b.check_out, total: b.total_price, ref: b.booking_ref, actor: user.name }); }
      else { await MAIL.mailCancelled(b, apt, body.reason || ''); await NOTIFY.sendTg({ type: 'request_cancelled', apartment: apt.name, guest_name: b.guest_name, check_in: b.check_in, check_out: b.check_out, ref: b.booking_ref, reason: body.reason || '', actor: user.name }); }
    } catch (e) { /* письмо/TG не роняют смену статуса */ }
  }
  return booking(user, body.id);
}
async function payment(body, user) {
  if (!body.booking_id || !(Number(body.amount) > 0)) throw new Error('Сумма платежа');
  const kind = ['payment', 'prepayment', 'deposit', 'refund', 'deposit_return'].includes(body.kind) ? body.kind : 'payment';
  const method = ['cash', 'card', 'transfer', 'payme', 'click', 'ota'].includes(body.method) ? body.method : 'cash';
  const bk = (await q('bookings?select=apartment_id&id=eq.' + enc(body.booking_id)))[0]; if (!bk) throw new Error('not found'); needFull(user, bk.apartment_id);
  const rec = { booking_id: body.booking_id, amount: Number(body.amount), currency: body.currency || 'USD', method, kind, note: body.note || null, received_by: user.name || user.email, paid_at: body.paid_at || new Date().toISOString(), org_id: user.org.id };
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
  ids.forEach(id => needFull(user, id));
  const days = nightsOf(body.from, body.to) + 1; if (days > 370 || ids.length * days > 5000) throw new Error('Слишком большой диапазон (до 5 000 дней за раз)');
  const rows = [];
  for (const id of ids) for (let i = 0; i < days; i++) {
    const r = { apartment_id: id, date: addDays(body.from, i), set_by: user.name || user.email, set_at: new Date().toISOString(), note: body.note || null };
    if (body.price !== undefined && body.price !== null && body.price !== '') r.price = Math.round(Number(body.price) * 100) / 100; // цены с копейками (Channex)
    if (body.min_nights !== undefined && body.min_nights !== null && body.min_nights !== '') r.min_nights = Math.max(1, parseInt(body.min_nights));
    if (body.closed !== undefined) r.closed = !!body.closed;
    if (body.closed_to_arrival !== undefined) r.closed_to_arrival = body.closed_to_arrival === null ? null : !!body.closed_to_arrival;
    rows.push(r);
  }
  // merge: не затираем поля, которые не переданы
  await q('rate_overrides?on_conflict=apartment_id,date', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' }, body: JSON.stringify(rows) });
  return { ok: true, rows: rows.length };
}
// 17.10.2026: построчная правка по дням (таблица «как в RealtyCalendar»): days = [{date, price?, min_nights?, closed?, closed_to_arrival?}]
// Поля, которых нет в строке, не трогаются (merge). Пустая строка (только date) пропускается.
async function rateSetDays(body, user) {
  const ids = Array.isArray(body.apartment_ids) ? body.apartment_ids.filter(Boolean) : [];
  const days = Array.isArray(body.days) ? body.days.filter(d => d && isDate(d.date)) : [];
  if (!ids.length || !days.length) throw new Error('apartment_ids, days');
  ids.forEach(id => needFull(user, id));
  if (ids.length * days.length > 5000) throw new Error('Слишком большой диапазон (до 5 000 дней за раз)');
  const rows = [];
  for (const id of ids) for (const d of days) {
    const r = { apartment_id: id, date: d.date, set_by: user.name || user.email, set_at: new Date().toISOString(), note: body.note || null }; let any = false;
    if (d.price !== undefined && d.price !== null && d.price !== '') { r.price = Math.round(Number(d.price) * 100) / 100; any = true; }
    if (d.min_nights !== undefined && d.min_nights !== null && d.min_nights !== '') { r.min_nights = Math.max(1, parseInt(d.min_nights)); any = true; }
    if (d.closed !== undefined && d.closed !== null) { r.closed = !!d.closed; any = true; }
    if (d.closed_to_arrival !== undefined && d.closed_to_arrival !== null) { r.closed_to_arrival = !!d.closed_to_arrival; any = true; }
    if (any) rows.push(r);
  }
  if (!rows.length) return { ok: true, rows: 0 };
  // merge-duplicates по частям: в одном батче у строк могут быть разные наборы колонок — PostgREST требует одинаковые, поэтому группируем по набору ключей
  const groups = {}; rows.forEach(r => { const k = Object.keys(r).sort().join(','); (groups[k] = groups[k] || []).push(r); });
  for (const k of Object.keys(groups)) await q('rate_overrides?on_conflict=apartment_id,date', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' }, body: JSON.stringify(groups[k]) });
  await logEvent(null, 'rates_edited', { apartment_ids: ids, days: rows.length }, user).catch(() => null);
  return { ok: true, rows: rows.length };
}
async function rateClear(body, user) {
  const ids = Array.isArray(body.apartment_ids) ? body.apartment_ids.filter(Boolean) : [];
  if (!ids.length || !isDate(body.from) || !isDate(body.to)) throw new Error('apartment_ids, from, to');
  ids.forEach(id => needFull(user, id));
  await q('rate_overrides?apartment_id=in.(' + ids.map(enc).join(',') + ')&date=gte.' + body.from + '&date=lte.' + body.to, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  return { ok: true };
}
const RULE_FIELDS = ['name', 'scope', 'complex', 'apartment_id', 'date_from', 'date_to', 'weekdays', 'kind', 'value', 'min_nights', 'closed_to_arrival', 'min_nights_for', 'channel', 'priority', 'is_active'];
async function ruleSave(body, user) {
  const r = body.rule || {}; const o = {}; for (const f of RULE_FIELDS) if (r[f] !== undefined) o[f] = r[f] === '' ? null : r[f];
  if (!o.name || !o.kind) throw new Error('name, kind');
  o.updated_at = new Date().toISOString();
  if (r.id) { await q('rate_rules?id=eq.' + enc(r.id), { method: 'PATCH', body: JSON.stringify(o) }); return (await q('rate_rules?select=*&id=eq.' + enc(r.id)))[0]; }
  o.created_by = user.name || user.email; o.org_id = user.org.id;
  return (await q('rate_rules', { method: 'POST', body: JSON.stringify(o) }))[0];
}
// ---------- гости ↔ брони (шаг 3) ----------
async function guestLink(body, user) {
  if (!body.booking_id) throw new Error('booking_id');
  const bk = (await q('bookings?select=id,apartment_id,guest_id,guest_name&id=eq.' + enc(body.booking_id)))[0]; if (!bk) throw new Error('not found'); needFull(user, bk.apartment_id);
  const gid = body.guest_id || null;
  if (gid) { const g = (await q('guests?select=id,name,phone,telegram&id=eq.' + enc(gid)))[0]; if (!g) throw new Error('Гость не найден'); }
  await q('bookings?id=eq.' + enc(body.booking_id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ guest_id: gid, updated_by: actorOf(user) }) });
  await logEvent(body.booking_id, gid ? 'guest_link' : 'guest_unlink', { from: bk.guest_id, to: gid }, user);
  return booking(user, body.booking_id);
}
async function guestCreate(body, user) {
  const o = {}; for (const f of ['name', 'phone', 'email', 'telegram', 'whatsapp', 'citizenship', 'lang', 'tags', 'notes']) if (body[f] !== undefined && body[f] !== '') o[f] = body[f];
  if (!o.name && !o.phone && !o.telegram) throw new Error('Нужно имя, телефон или Telegram');
  o.org_id = user.org.id;
  // не плодим дубли: тот же телефон / Telegram → существующая карточка
  const existing = await rpc('pms_guest_match', { p_name: o.name || null, p_phone: o.phone || null, p_telegram: o.telegram || null, p_email: o.email || null, p_create: false });
  const g = existing ? (await q('guests?select=*&id=eq.' + enc(existing)))[0] : (await q('guests', { method: 'POST', body: JSON.stringify(o) }))[0];
  if (body.booking_id) await guestLink({ booking_id: body.booking_id, guest_id: g.id }, user);
  return Object.assign(await guest(g.id), { existed: !!existing });
}

// ---------- сотрудники (admin) ----------
const ROLES = ['admin', 'booker', 'ops', 'partner'];
const SERVICE = process.env.SUPABASE_SERVICE_KEY;
const authAdmin = (path, opt) => fetch(SB_URL + '/auth/v1/admin/' + path, Object.assign({ headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' } }, opt || {}));
async function users(user) {
  const [rows, staff, orgs, invitations] = await Promise.all([
    q('app_users?select=email,name,role,org_id,apartment_ids,telegram_chat_id,is_active,auth_user_id,created_at&org_id=eq.' + user.org.id + '&order=is_active.desc,role,name'),
    user.org.id === 1 ? q('staff?select=id,name,role,telegram_chat_id,is_active&order=role,name').catch(() => []) : [],
    q('organizations?select=id,name,short&order=id'),
    q('invitations?select=token,email,name,role,apartment_ids,invited_by,created_at,expires_at,accepted_at&org_id=eq.' + user.org.id + '&order=created_at.desc&limit=50').catch(() => [])
  ]);
  return { users: rows, staff, orgs: user.platform_admin ? orgs : orgs.filter(o => o.id === user.org.id), invitations, me: user.email, org: user.org };
}
async function authUserId(email) {
  const rows = await rpc('pms_auth_user_id', { p_email: email }).catch(() => null);
  return rows || null;
}
async function userSave(body, user) {
  AUTH_CACHE.clear();
  const u = body.user || {};
  const email = String(u.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Некорректный email');
  if (!ROLES.includes(u.role)) throw new Error('Роль: admin / booker / ops / partner');
  if (email === user.email && (u.role !== 'admin' || u.is_active === false)) throw new Error('Нельзя снять права с самого себя');
  const cur = (await q('app_users?select=*&email=eq.' + enc(email)))[0];
  if (cur && !user.platform_admin && (cur.org_id || 1) !== user.org.id) throw new Error('Сотрудник другой организации');
  const o = { email, name: String(u.name || '').trim() || email, role: u.role, org_id: user.platform_admin ? (Number(u.org_id) || user.org.id) : user.org.id, is_active: u.is_active !== false,
    apartment_ids: u.role === 'partner' ? (Array.isArray(u.apartment_ids) ? u.apartment_ids.filter(Boolean) : null) : null,
    telegram_chat_id: u.telegram_chat_id ? String(u.telegram_chat_id).trim() : null };
  const pwd = u.password ? String(u.password) : '';
  if (!cur) {
    if (pwd.length < 6) throw new Error('Для нового сотрудника задайте пароль (от 6 символов)');
    const r = await authAdmin('users', { method: 'POST', body: JSON.stringify({ email, password: pwd, email_confirm: true, user_metadata: { name: o.name } }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) o.auth_user_id = j.id;
    else if (!/already|exists|registered/i.test(JSON.stringify(j))) throw new Error('Auth: ' + (j.msg || j.message || j.error_description || r.status));
    else o.auth_user_id = await authUserId(email);
    await q('app_users', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(o) });
  } else {
    if (pwd) {
      if (pwd.length < 6) throw new Error('Пароль от 6 символов');
      const id = cur.auth_user_id || await authUserId(email);
      if (!id) { const r = await authAdmin('users', { method: 'POST', body: JSON.stringify({ email, password: pwd, email_confirm: true }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error('Auth: ' + (j.msg || j.message || r.status)); o.auth_user_id = j.id; }
      else { const r = await authAdmin('users/' + id, { method: 'PUT', body: JSON.stringify({ password: pwd }) }); if (!r.ok) throw new Error('Auth: не удалось сменить пароль (' + r.status + ')'); o.auth_user_id = id; }
    }
    await q('app_users?email=eq.' + enc(email), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(o) });
    if (o.is_active === false) await rpc('pms_logout_all', { p_email: email }).catch(() => null);
  }
  await logEvent(null, 'user_save', { email, role: o.role, is_active: o.is_active, password_changed: !!pwd }, user);
  return users(user);
}
async function userLogoutAll(body, user) {
  AUTH_CACHE.clear();
  const email = String(body.email || '').trim().toLowerCase(); if (!email) throw new Error('email');
  const n = await rpc('pms_logout_all', { p_email: email });
  await logEvent(null, 'user_logout_all', { email, sessions: n }, user);
  return { ok: true, sessions: n };
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

// ---- PMS v2-A (16.10.2026): объекты (ЖК и квартиры), история брони, подборки для гостя. Спека docs/superpowers/specs/2026-10-15-pms-objects-channels-v2-design.md
// 17.10.2026: описания, удобства и стиль редактируются в карточке объекта PMS (партнёры не ходят в /admin); фото — apt_photos
const APT_FIELDS = ['name', 'complex', 'floor', 'max_guests', 'rooms', 'weekday_price', 'weekend_price', 'min_nights', 'catalog_no', 'tracked', 'org_id', 'is_active', 'description', 'description_en', 'description_uz', 'amenities', 'style'];
const parsePhotos = a => { let ph = []; try { const p = JSON.parse(a.photo_url); if (Array.isArray(p)) ph = p; } catch (e) { if (a.photo_url) ph = [a.photo_url]; } return ph.filter(Boolean); };
async function objects(user) {
  const org = '&org_id=eq.' + user.org.id;
  const [cx, apts, units, access, orgs] = await Promise.all([
    q('complexes?select=*' + org + '&order=name'),
    q('apartments?select=id,name,complex,floor,max_guests,rooms,weekday_price,weekend_price,min_nights,catalog_no,tracked,org_id,is_active,photo_url,updated_at,description,description_en,description_uz,amenities,style' + org + '&order=complex,catalog_no.nullslast,name').then(rows => rows.map(a => Object.assign(a, { photos: parsePhotos(a) }))),
    q('channel_units?select=apartment_id,channel_property_id,external_room_type_id,external_rate_plan_id,is_active,derived,channels,last_error,last_pushed_at'),
    q('apartment_access?select=apartment_id,org_id,mode'),
    q('organizations?select=id,name,short&is_active=eq.true&order=id')
  ]);
  const byApt = {}; units.forEach(u => byApt[u.apartment_id] = u);
  const acc = {}; access.forEach(x => (acc[x.apartment_id] = acc[x.apartment_id] || []).push({ org_id: x.org_id, mode: x.mode }));
  // партнёрские квартиры (16.10): одна запись в bookings/rate_calendar, видна и ведётся обеими организациями через apartment_access
  return { complexes: cx, orgs, apartments: apts.map(a => Object.assign(a, { unit: byApt[a.id] || null, partners: acc[a.id] || [] })) };
}
async function complexSave(body, user) {
  const o = { name: String(body.name || '').trim(), address: body.address || null, city: body.city || 'Tashkent', timezone: body.timezone || 'Asia/Tashkent', notes: body.notes || null, is_active: body.is_active !== false };
  if (!o.name) throw new Error('Название ЖК обязательно');
  if (body.id) {
    const cur = (await q('complexes?select=*&id=eq.' + enc(body.id) + '&org_id=eq.' + user.org.id))[0]; if (!cur) throw new Error('ЖК не найден');
    if (cur.name !== o.name) await rpc('pms_complex_rename', { p_id: cur.id, p_name: o.name });
    delete o.name;
    const rows = await q('complexes?id=eq.' + enc(body.id), { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(o) });
    return rows[0];
  }
  o.org_id = user.org.id;
  const rows = await q('complexes', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(o) });
  return rows[0];
}
async function aptSave(body, user) {
  const id = String(body.id || '').trim();
  if (!/^[a-z0-9_]{3,40}$/.test(id)) throw new Error('Код квартиры: латиница, цифры, _ (например kislorod_77)');
  const o = {}; APT_FIELDS.forEach(f => { if (body[f] !== undefined) o[f] = body[f]; });
  ['floor', 'max_guests', 'weekday_price', 'weekend_price', 'min_nights', 'catalog_no'].forEach(f => { if (o[f] === '' || o[f] === null) o[f] = null; else if (o[f] !== undefined) o[f] = Number(o[f]); });
  if (o.amenities !== undefined && !Array.isArray(o.amenities)) o.amenities = String(o.amenities || '').split(',').map(x => x.trim()).filter(Boolean);
  ['description', 'description_en', 'description_uz', 'style'].forEach(f => { if (o[f] !== undefined) o[f] = o[f] == null ? null : String(o[f]).slice(0, 8000); });
  // org_id с клиента принимает только администратор платформы — иначе клиент мог бы «переложить» квартиру в чужую организацию
  if (o.org_id !== undefined && !user.platform_admin) delete o.org_id;
  if (o.org_id === undefined) o.org_id = user.org.id;
  if (!o.name) throw new Error('Название обязательно');
  if (!o.complex) throw new Error('Выберите ЖК');
  const cx = await q('complexes?select=id&name=eq.' + enc(o.complex) + '&org_id=eq.' + o.org_id); if (!cx.length) throw new Error('ЖК «' + o.complex + '» не найден');
  const cur = (await q('apartments?select=id,org_id&id=eq.' + enc(id)))[0];
  // партнёр (одна организация-партнёр на квартиру): partner_org_id null = убрать, иначе apartment_access с mode full|occupancy
  if (body.partner_org_id !== undefined) {
    const pid = body.partner_org_id ? Number(body.partner_org_id) : null; const mode = body.partner_mode === 'occupancy' ? 'occupancy' : 'full';
    if (pid && pid === (o.org_id || user.org.id)) throw new Error('Партнёр не может совпадать с владельцем');
    await q('apartment_access?apartment_id=eq.' + enc(id) + (pid ? '&org_id=neq.' + pid : ''), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => null);
    if (pid) await q('apartment_access?on_conflict=apartment_id,org_id', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' }, body: JSON.stringify({ apartment_id: id, org_id: pid, mode }) });
    AUTH_CACHE.clear();
  }
  if (cur) {
    if ((cur.org_id || 1) !== user.org.id && !user.platform_admin) throw Object.assign(new Error('Чужая квартира'), { status: 403 });
    if (!user.platform_admin) delete o.org_id;
    o.updated_at = new Date().toISOString();
    const rows = await q('apartments?id=eq.' + enc(id), { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(o) });
    await logEvent(null, 'apartment_updated', { apartment_id: id, fields: Object.keys(o) }, user);
    return rows[0];
  }
  o.id = id; if (o.is_active === undefined) o.is_active = true; if (o.tracked === undefined) o.tracked = true; if (o.floor == null) o.floor = 1; if (o.max_guests == null) o.max_guests = 2;   // NOT NULL в apartments
  if (user.org.plan_limit) { const n = (await q('apartments?select=id&is_active=eq.true&org_id=eq.' + o.org_id)).length; if (n >= user.org.plan_limit) throw new Error('Лимит тарифа: ' + user.org.plan_limit + ' активных квартир. Обратитесь к администратору платформы'); }
  const rows = await q('apartments', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(o) });
  AUTH_CACHE.clear();   // чтобы новая квартира сразу была в access (шахматка, архив)
  await logEvent(null, 'apartment_created', { apartment_id: id }, user);
  return rows[0];
}
// Фото квартиры (17.10.2026): файлы грузит браузер прямо в Storage (bucket apartments/<id>/…), сюда приходит итоговый список —
// порядок, обложка (первое), удалённые файлы чистятся из Storage, превью 800px пересобирается через weserv. Та же логика, что в admin-api.
const SB_URL_ = process.env.SUPABASE_URL || 'https://sebvfvtofiysbywxjqut.supabase.co';
const SB_SERVICE_ = process.env.SUPABASE_SERVICE_KEY;
async function aptThumb(id, coverUrl) {
  if (!coverUrl || !SB_SERVICE_) return { ok: false };
  try {
    const src = 'https://images.weserv.nl/?url=' + encodeURIComponent(String(coverUrl).replace(/^https?:\/\//, '')) + '&w=800&h=600&fit=cover&q=72&output=webp';
    const img = await fetch(src); if (!img.ok) return { ok: false, reason: 'weserv ' + img.status };
    const buf = Buffer.from(await img.arrayBuffer());
    const up = await fetch(SB_URL_ + '/storage/v1/object/apartments/thumbs/' + encodeURIComponent(id) + '_thumb.webp', { method: 'POST', headers: { apikey: SB_SERVICE_, Authorization: 'Bearer ' + SB_SERVICE_, 'Content-Type': 'image/webp', 'x-upsert': 'true', 'Cache-Control': 'max-age=3600' }, body: buf });
    return { ok: up.ok, size: buf.length, reason: up.ok ? undefined : (await up.text()).slice(0, 120) };
  } catch (e) { return { ok: false, reason: String(e.message || e) }; }
}
async function aptPhotos(body, user) {
  const id = String(body.id || ''); const photos = (body.photos || []).map(String).filter(u => /^https?:\/\//.test(u)).slice(0, 60);
  const a = (await q('apartments?select=id,org_id,photo_url&id=eq.' + enc(id)))[0]; if (!a) throw Object.assign(new Error('Квартира не найдена'), { status: 404 });
  if ((a.org_id || 1) !== user.org.id && !user.platform_admin) throw Object.assign(new Error('Чужая квартира'), { status: 403 });
  const prev = parsePhotos(a);
  await q('apartments?id=eq.' + enc(id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ photo_url: photos.length > 1 ? JSON.stringify(photos) : (photos[0] || ''), updated_at: new Date().toISOString() }) });
  const removed = prev.filter(u => !photos.includes(u)); const deleted = [];
  for (const u of removed) {
    const m = u.match(/\/storage\/v1\/object\/public\/apartments\/(.+)$/); if (!m || !SB_SERVICE_ || /^(thumbs|hero)\//.test(m[1])) continue;
    try { const d = await fetch(SB_URL_ + '/storage/v1/object/apartments/' + m[1], { method: 'DELETE', headers: { apikey: SB_SERVICE_, Authorization: 'Bearer ' + SB_SERVICE_ } }); if (d.ok) deleted.push(m[1]); } catch (e) { /* не критично */ }
  }
  const thumb = prev[0] !== photos[0] || body.force_thumb ? await aptThumb(id, photos[0]) : { ok: true, skipped: true };
  await logEvent(null, 'apartment_photos', { apartment_id: id, count: photos.length }, user);
  return { ok: true, photos, deleted, thumb };
}
// ---- PMS v2-B (16.10.2026): организации, приглашения, сброс пароля, отчёт собственника. Спека docs/superpowers/specs/2026-10-16-pms-orgs-partners-design.md
const SITE = process.env.URL || 'https://urbanluxe.cc';
const needPlatform = user => { if (!user.platform_admin) throw Object.assign(new Error('Только администратор платформы'), { status: 403 }); };
async function orgs(user) {
  needPlatform(user);
  const [list, apts, usersN, partners] = await Promise.all([
    q('organizations?select=id,slug,name,short,logo_url,telegram,tg_chat_id,plan_limit,settings,is_active,created_at&order=id'),
    q('apartments?select=org_id&is_active=eq.true'), q('app_users?select=org_id&is_active=eq.true'), q('org_partners?select=org_id,partner_org_id')
  ]);
  return list.map(o => ({ id: o.id, slug: o.slug, name: o.name, short: o.short, logo_url: o.logo_url, telegram: o.telegram, tg_chat_id: o.tg_chat_id, plan_limit: o.plan_limit, is_active: o.is_active, created_at: o.created_at,
    apartments: apts.filter(a => (a.org_id || 1) === o.id).length, users: usersN.filter(u => (u.org_id || 1) === o.id).length,
    channex: { group_id: (((o.settings || {}).channex) || {}).group_id || null, own_key: !!(((o.settings || {}).channex) || {}).api_key },
    partners: partners.filter(x => x.org_id === o.id).map(x => x.partner_org_id) }));
}
async function orgSave(body, user) {
  needPlatform(user);
  const o = { name: String(body.name || '').trim(), short: String(body.short || '').trim().slice(0, 6) || null, slug: String(body.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || null, telegram: body.telegram || null, tg_chat_id: body.tg_chat_id || null, plan_limit: body.plan_limit ? Number(body.plan_limit) : null, logo_url: body.logo_url || null, is_active: body.is_active !== false };
  if (!o.name) throw new Error('Название организации');
  if (!o.slug) o.slug = o.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || ('org' + Date.now());
  if (body.id) {
    const cur = (await q('organizations?select=*&id=eq.' + enc(body.id)))[0]; if (!cur) throw new Error('Организация не найдена');
    if (cur.id === 1 && o.is_active === false) throw new Error('Нельзя выключить Urban Luxe');
    const settings = Object.assign({}, cur.settings || {});
    if (body.channex_api_key !== undefined) settings.channex = Object.assign({}, settings.channex || {}, { api_key: body.channex_api_key ? String(body.channex_api_key).trim() : null });
    o.settings = settings;
    const rows = await q('organizations?id=eq.' + cur.id, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(o) });
    AUTH_CACHE.clear(); return rows[0] && { id: rows[0].id, name: rows[0].name };
  }
  o.created_by = actorOf(user); o.settings = body.channex_api_key ? { channex: { api_key: String(body.channex_api_key).trim() } } : {};
  const rows = await q('organizations', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(o) });
  await logEvent(null, 'org_created', { id: rows[0].id, name: o.name }, user);
  return { id: rows[0].id, name: rows[0].name };
}
async function orgPartnerSet(body, user) {
  needPlatform(user);
  const a = Number(body.org_id), b = Number(body.partner_org_id); if (!a || !b || a === b) throw new Error('org_id / partner_org_id');
  if (body.on) { for (const [x, y] of [[a, b], [b, a]]) await q('org_partners?on_conflict=org_id,partner_org_id', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' }, body: JSON.stringify({ org_id: x, partner_org_id: y }) }); }
  else { await q('org_partners?or=(and(org_id.eq.' + a + ',partner_org_id.eq.' + b + '),and(org_id.eq.' + b + ',partner_org_id.eq.' + a + '))', { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); }
  AUTH_CACHE.clear(); return { ok: true };
}
// 17.10.2026: удаление квартиры / ЖК своей организации (клиент сам чистит за собой, напр. тестовые объекты). Только без броней — иначе «В архив».
// Квартира: комната в Channex (room_type + тарифы) удаляется, строки календаря чистятся. ЖК: все его квартиры + property в Channex.
async function channexKeyOf(user) { const org = (await q('organizations?select=settings&id=eq.' + user.org.id))[0] || {}; return ((org.settings || {}).channex || {}).api_key || null; }
async function aptDelete(body, user) {
  const id = String(body.id || ''); const a = (await q('apartments?select=id,name,org_id&id=eq.' + enc(id)))[0]; if (!a) throw new Error('Квартира не найдена');
  if ((a.org_id || 1) !== user.org.id && !user.platform_admin) throw Object.assign(new Error('Чужая квартира'), { status: 403 });
  const n = (await q('bookings?select=id&apartment_id=eq.' + enc(id) + '&limit=1')).length; if (n) throw new Error('У квартиры есть брони — удалить нельзя, уберите в архив');
  const C = require('./_channex.js'); const key = await channexKeyOf(user); const log = [];
  const u = (await q('channel_units?select=*&apartment_id=eq.' + enc(id)))[0];
  if (u) { for (const rp of [u.external_rate_plan_id].concat(Object.values(u.derived || {}).map(d => d && d.rate_plan_id)).filter(Boolean)) { try { await C.cx('DELETE', '/rate_plans/' + rp, null, key); } catch (e) { log.push('rate ' + String(e.message).slice(0, 60)); } }
    if (u.external_room_type_id) { try { await C.cx('DELETE', '/room_types/' + u.external_room_type_id, null, key); log.push('channex room deleted'); } catch (e) { log.push('room: ' + String(e.message).slice(0, 80)); } } }
  for (const t of ['channel_outbox', 'channel_restrictions', 'channel_units', 'rate_calendar', 'rate_overrides', 'cleaning_tasks', 'apartment_access', 'ical_sources']) await q(t + '?apartment_id=eq.' + enc(id), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => null);
  await q('apartments?id=eq.' + enc(id), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  AUTH_CACHE.clear(); await logEvent(null, 'apartment_deleted', { apartment_id: id, name: a.name }, user);
  return { ok: true, log };
}
async function complexDelete(body, user) {
  const cx = (await q('complexes?select=*&id=eq.' + enc(body.id) + '&org_id=eq.' + user.org.id))[0]; if (!cx) throw new Error('ЖК не найден');
  const apts = await q('apartments?select=id&complex=eq.' + enc(cx.name) + '&org_id=eq.' + user.org.id);
  if (apts.length) { const inA = '&apartment_id=in.(' + apts.map(a => enc(a.id)).join(',') + ')'; if ((await q('bookings?select=id' + inA + '&limit=1')).length) throw new Error('В ЖК есть брони — удалить нельзя (уберите квартиры в архив)'); }
  const log = []; for (const a of apts) { const r = await aptDelete({ id: a.id }, user); log.push(a.id + ': ' + (r.log.join(', ') || 'ok')); }
  const C = require('./_channex.js'); const key = await channexKeyOf(user);
  const props = await q('channel_properties?select=id,external_id&complex=eq.' + enc(cx.name) + '&org_id=eq.' + user.org.id);
  for (const pr of props) { if (pr.external_id) { try { await C.cx('DELETE', '/properties/' + pr.external_id, null, key); log.push('channex property deleted'); } catch (e) { log.push('channex property: ' + String(e.message).slice(0, 80)); } } }
  await q('channel_properties?complex=eq.' + enc(cx.name) + '&org_id=eq.' + user.org.id, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => null);
  await q('complexes?id=eq.' + cx.id, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  await logEvent(null, 'complex_deleted', { complex: cx.name, apartments: apts.length }, user);
  return { ok: true, log };
}
// удалить организацию целиком (только платформа-админ, не Urban Luxe): Channex property/группа, квартиры с бронями, ЖК, сотрудники (и auth), приглашения
async function orgDelete(body, user) {
  needPlatform(user); const id = Number(body.id); if (!id || id === 1) throw new Error('Нельзя удалить Urban Luxe');
  const org = (await q('organizations?select=*&id=eq.' + id))[0]; if (!org) throw new Error('Организация не найдена');
  if (String(body.confirm || '') !== org.name) throw new Error('Для подтверждения введите точное название организации');
  const C = require('./_channex.js'); const log = [];
  const key = ((org.settings || {}).channex || {}).api_key || null;
  const props = await q('channel_properties?select=id,external_id&org_id=eq.' + id);
  for (const pr of props) { if (pr.external_id) { try { await C.cx('DELETE', '/properties/' + pr.external_id, null, key); log.push('channex property deleted ' + pr.external_id.slice(0, 8)); } catch (e) { log.push('channex property: ' + String(e.message).slice(0, 80)); } } }
  const gid = ((org.settings || {}).channex || {}).group_id; if (gid && !key) { try { await C.cx('DELETE', '/groups/' + gid); log.push('channex group deleted'); } catch (e) { log.push('channex group: ' + String(e.message).slice(0, 80)); } }
  const apts = (await q('apartments?select=id&org_id=eq.' + id)).map(a => a.id);
  if (apts.length) {
    const inA = '&apartment_id=in.(' + apts.map(enc).join(',') + ')';
    for (const t of ['channel_outbox', 'channel_restrictions', 'channel_units', 'rate_calendar', 'rate_overrides', 'cleaning_tasks', 'apartment_access', 'ical_sources']) await q(t + '?apartment_id=neq.__none__' + inA, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => null);
    const bks = await q('bookings?select=id' + inA);
    if (bks.length) { const inB = 'booking_id=in.(' + bks.map(b => b.id).join(',') + ')'; for (const t of ['payments', 'booking_events', 'channel_bookings']) await q(t + '?' + inB, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => null); await q('bookings?id=in.(' + bks.map(b => b.id).join(',') + ')', { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); }
    await q('apartments?id=in.(' + apts.map(enc).join(',') + ')', { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); log.push('apartments ' + apts.length + ', bookings ' + bks.length);
  }
  await q('channel_properties?org_id=eq.' + id, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => null);
  await q('complexes?org_id=eq.' + id, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => null);
  const us = await q('app_users?select=email,auth_user_id&org_id=eq.' + id);
  for (const u of us) { const aid = u.auth_user_id || await authUserId(u.email); if (aid) { try { await authAdmin('users/' + aid, { method: 'DELETE' }); } catch (_) { } } }
  await q('app_users?org_id=eq.' + id, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); log.push('users ' + us.length);
  for (const t of ['invitations', 'org_partners', 'channel_markups', 'channel_accounts', 'rate_rules', 'selections', 'payments', 'guests']) await q(t + '?org_id=eq.' + id, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => null);
  await q('org_partners?partner_org_id=eq.' + id, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => null);
  await q('organizations?id=eq.' + id, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  AUTH_CACHE.clear(); await logEvent(null, 'org_deleted', { id, name: org.name, log }, user);
  return { ok: true, log };
}
// письмо (Resend) без привязки к брони
async function sendMail(to, subject, html, text) {
  const key = process.env.RESEND_API_KEY || process.env.RESEND_KEY || process.env.EMAIL_API_KEY; if (!key) return { sent: false, reason: 'no RESEND_API_KEY' };
  const from = process.env.RESEND_FROM || 'Urban Luxe <booking@urbanluxe.cc>';
  try { const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [to], subject, html, text }) }); if (!r.ok) return { sent: false, reason: 'resend ' + r.status + ' ' + (await r.text()).slice(0, 120) }; return { sent: true }; }
  catch (e) { return { sent: false, reason: String(e.message || e) }; }
}
const mailShell = (title, body, btnText, btnUrl) => `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a"><div style="font-size:12px;letter-spacing:.2em;color:#a88d45;margin-bottom:12px">URBAN LUXE · PMS</div><h2 style="font-weight:500;margin:0 0 12px">${title}</h2><div style="font-size:15px;line-height:1.5">${body}</div>${btnUrl ? '<p style="margin:22px 0"><a href="' + btnUrl + '" style="background:#c9a961;color:#111;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">' + btnText + '</a></p><p style="font-size:12px;color:#777">Если кнопка не работает, откройте ссылку: ' + btnUrl + '</p>' : ''}</div>`;
async function inviteCreate(body, user) {
  const email = String(body.email || '').trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Некорректный email');
  const role = String(body.role || 'booker'); if (!ROLES.includes(role)) throw new Error('Роль');
  if (role === 'admin' && !user.platform_admin && user.role !== 'admin') throw new Error('Админа приглашает админ');
  const existing = (await q('app_users?select=email,org_id&email=eq.' + enc(email)))[0]; if (existing) throw new Error('Этот email уже сотрудник' + ((existing.org_id || 1) === user.org.id ? '' : ' другой организации'));
  let inv = (await q('invitations?select=*&email=eq.' + enc(email) + '&org_id=eq.' + user.org.id + '&accepted_at=is.null'))[0];
  const rec = { email, org_id: user.org.id, role, name: String(body.name || '').trim() || null, apartment_ids: role === 'partner' && Array.isArray(body.apartment_ids) ? body.apartment_ids.filter(Boolean) : null, invited_by: actorOf(user), expires_at: new Date(Date.now() + 7 * 864e5).toISOString() };
  if (inv) inv = (await q('invitations?token=eq.' + enc(inv.token), { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(rec) }))[0];
  else { rec.token = [...Array(32)].map(() => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join(''); inv = (await q('invitations', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(rec) }))[0]; }
  const url = SITE + '/pms?invite=' + inv.token;
  const ROLE_RU = { admin: 'администратор', booker: 'бронер', ops: 'опер-менеджер', partner: 'собственник' };
  const mail = await sendMail(email, 'Приглашение в PMS · ' + user.org.name, mailShell('Вас приглашают в ' + user.org.name, '<p>' + (rec.name ? rec.name + ', ' : '') + user.name + ' приглашает вас в систему управления бронированиями <b>' + user.org.name + '</b> с ролью «' + ROLE_RU[role] + '».</p><p>Нажмите кнопку, задайте пароль — и вы в кабинете. Ссылка действует 7 дней.</p>', 'Принять приглашение', url), 'Приглашение в PMS ' + user.org.name + ': ' + url);
  await logEvent(null, 'invite', { email, role, sent: mail.sent, reason: mail.reason }, user);
  return { ok: true, url, mail };
}
async function inviteInfo(token) {
  const inv = (await q('invitations?select=token,email,name,role,org_id,expires_at,accepted_at&token=eq.' + enc(String(token || ''))))[0];
  if (!inv) throw Object.assign(new Error('Приглашение не найдено'), { status: 404 });
  const org = (await q('organizations?select=name,short,logo_url&id=eq.' + inv.org_id))[0] || {};
  return { email: inv.email, name: inv.name, role: inv.role, org: org.name, logo_url: org.logo_url, expired: new Date(inv.expires_at) < new Date(), accepted: !!inv.accepted_at };
}
async function inviteAccept(body) {
  const inv = (await q('invitations?select=*&token=eq.' + enc(String(body.token || ''))))[0];
  if (!inv) throw new Error('Приглашение не найдено'); if (inv.accepted_at) throw new Error('Приглашение уже принято — войдите паролем'); if (new Date(inv.expires_at) < new Date()) throw new Error('Приглашение истекло — попросите выслать новое');
  const pwd = String(body.password || ''); if (pwd.length < 6) throw new Error('Пароль от 6 символов');
  const name = String(body.name || inv.name || '').trim() || inv.email;
  if ((await q('app_users?select=email&email=eq.' + enc(inv.email))).length) throw new Error('Этот email уже зарегистрирован — войдите паролем или восстановите его');
  let authId = null;
  const r = await authAdmin('users', { method: 'POST', body: JSON.stringify({ email: inv.email, password: pwd, email_confirm: true, user_metadata: { name } }) });
  const j = await r.json().catch(() => ({}));
  if (r.ok) authId = j.id;
  else if (/already|exists|registered/i.test(JSON.stringify(j))) { authId = await authUserId(inv.email); if (authId) { const r2 = await authAdmin('users/' + authId, { method: 'PUT', body: JSON.stringify({ password: pwd }) }); if (!r2.ok) throw new Error('Auth: не удалось задать пароль'); } }
  else throw new Error('Auth: ' + (j.msg || j.message || r.status));
  await q('app_users', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ email: inv.email, name, role: inv.role, org_id: inv.org_id, apartment_ids: inv.apartment_ids, is_active: true, auth_user_id: authId }) });
  await q('invitations?token=eq.' + enc(inv.token), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ accepted_at: new Date().toISOString() }) });
  AUTH_CACHE.clear();
  return { ok: true, email: inv.email };
}
async function passwordReset(body) {
  const email = String(body.email || '').trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Некорректный email');
  const u = (await q('app_users?select=email,name,is_active&email=eq.' + enc(email)))[0];
  if (u && u.is_active !== false) {
    const r = await authAdmin('generate_link', { method: 'POST', body: JSON.stringify({ type: 'recovery', email }) });
    const j = await r.json().catch(() => ({}));
    const th = j.hashed_token || (j.properties && j.properties.hashed_token);
    if (th) { const url = SITE + '/pms?reset=' + th; await sendMail(email, 'Сброс пароля · Urban Luxe PMS', mailShell('Новый пароль', '<p>' + (u.name || '') + ', вы запросили сброс пароля в PMS. Нажмите кнопку и задайте новый. Если это не вы — просто проигнорируйте письмо.</p>', 'Задать новый пароль', url), 'Сброс пароля: ' + url); }
  }
  return { ok: true };   // всегда ok — не раскрываем, есть ли такой email
}
// отчёт собственника: по своим квартирам помесячно — ночи, загрузка, доход (пропорционально ночам месяца), доля собственника
async function ownerReport(user, p) {
  const year = Number(p.year) || Number(T.tashToday(0).slice(0, 4));
  const ids = user.role === 'partner' ? (user.apartment_ids || []) : (p.apartment_id ? [p.apartment_id] : Object.keys(user.access).filter(id => user.access[id] === 'full'));
  if (!ids.length) return { year, apartments: [], months: [] };
  const apts = await q('apartments?select=id,name,complex,catalog_no,owner_share_pct&id=in.(' + ids.map(enc).join(',') + ')');
  const from = year + '-01-01', to = (year + 1) + '-01-01';
  const bks = await qAll('bookings?select=apartment_id,check_in,check_out,total_price,currency,status&status=in.(confirmed,checked_in,checked_out)&check_in=lt.' + to + '&check_out=gt.' + from + '&apartment_id=in.(' + ids.map(enc).join(',') + ')');
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, nights: 0, income: 0, bookings: 0, by_apt: {} }));
  for (const b of bks) {
    const n = nightsOf(b.check_in, b.check_out); if (n <= 0) continue; const perNight = Number(b.total_price || 0) / n;
    for (let d = b.check_in; d < b.check_out; d = addDays(d, 1)) { if (d < from || d >= to) continue; const m = months[Number(d.slice(5, 7)) - 1]; m.nights++; m.income += perNight; const a = (m.by_apt[b.apartment_id] = m.by_apt[b.apartment_id] || { nights: 0, income: 0 }); a.nights++; a.income += perNight; }
    const m0 = months[Number(b.check_in.slice(5, 7)) - 1]; if (b.check_in >= from && b.check_in < to) m0.bookings++;
  }
  const daysIn = m => new Date(Date.UTC(year, m, 0)).getUTCDate();
  const share = {}; apts.forEach(a => share[a.id] = a.owner_share_pct == null ? 100 : Number(a.owner_share_pct));
  return { year, apartments: apts, months: months.map(m => ({ month: m.month, days: daysIn(m.month), nights: m.nights, occupancy: Math.round(100 * m.nights / (daysIn(m.month) * ids.length)), bookings: m.bookings, income: Math.round(m.income), owner_income: Math.round(Object.keys(m.by_apt).reduce((s, id) => s + m.by_apt[id].income * share[id] / 100, 0)), adr: m.nights ? Math.round(m.income / m.nights) : 0, by_apt: m.by_apt })) };
}
// ---- Интеграции (16.10.2026): API-ключи, вебхуки, лог доставок. Спека docs/superpowers/specs/2026-10-16-public-api-webhooks-design.md
const crypto = require('crypto');
const randKey = (pfx) => pfx + crypto.randomBytes(24).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 32);
async function integrations(user) {
  const [keys, hooks, log] = await Promise.all([
    q('api_keys?select=id,name,kind,prefix,scopes,is_active,last_used_at,created_by,created_at&org_id=eq.' + user.org.id + '&order=created_at.desc'),
    q('webhooks?select=*&org_id=eq.' + user.org.id + '&order=created_at.desc'),
    q('api_log?select=key_id,method,path,status,ms,created_at&org_id=eq.' + user.org.id + '&order=created_at.desc&limit=30').catch(() => [])
  ]);
  const deliveries = hooks.length ? await q('webhook_deliveries?select=id,webhook_id,event,booking_id,attempts,sent_at,status,response,created_at,next_at&webhook_id=in.(' + hooks.map(h => h.id).join(',') + ')&order=created_at.desc&limit=50') : [];
  const pub = keys.find(k => k.kind === 'public' && k.is_active);
  return { keys, webhooks: hooks, deliveries, log, public_key: pub ? pub.prefix : null, widget_snippet: pub ? '<script src="' + SITE + '/widget.js" data-key="' + pub.prefix + '"></script>' : null, docs_url: SITE + '/api/docs', api_base: SITE + '/api/v1' };
}
async function apiKeyCreate(body, user) {
  const kind = body.kind === 'public' ? 'public' : 'secret'; const name = String(body.name || '').trim() || (kind === 'public' ? 'Виджет' : 'Сайт');
  const scopes = kind === 'public' ? ['read', 'book'] : (Array.isArray(body.scopes) && body.scopes.length ? body.scopes.filter(x => ['read', 'book', 'cancel', 'manage'].includes(x)) : ['read', 'book', 'cancel']);
  const key = randKey(kind === 'public' ? 'pk_live_' : 'sk_live_');
  const rec = { org_id: user.org.id, name, kind, prefix: kind === 'public' ? key : key.slice(0, 12) + '…', key_hash: kind === 'public' ? key : crypto.createHash('sha256').update(key).digest('hex'), scopes, created_by: actorOf(user) };
  const rows = await q('api_keys', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(rec) });
  await logEvent(null, 'api_key_created', { id: rows[0].id, name, kind, scopes }, user);
  return { id: rows[0].id, key, kind, name, scopes };   // ключ показывается один раз
}
async function apiKeyToggle(body, user) {
  const k = (await q('api_keys?select=id,org_id&id=eq.' + enc(body.id)))[0]; if (!k || k.org_id !== user.org.id) throw new Error('Ключ не найден');
  await q('api_keys?id=eq.' + k.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ is_active: !!body.is_active }) });
  await logEvent(null, 'api_key_toggle', { id: k.id, is_active: !!body.is_active }, user); return { ok: true };
}
async function webhookSave(body, user) {
  const url = String(body.url || '').trim(); if (!/^https:\/\/[^\s]+$/i.test(url)) throw new Error('URL вебхука должен начинаться с https://');
  const events = (Array.isArray(body.events) ? body.events : ['booking.created', 'booking.updated', 'booking.cancelled']).filter(e => /^booking\.(created|updated|cancelled)$/.test(e));
  if (!events.length) throw new Error('Выберите хотя бы одно событие');
  if (body.id) {
    const w = (await q('webhooks?select=id,org_id,secret&id=eq.' + enc(body.id)))[0]; if (!w || w.org_id !== user.org.id) throw new Error('Вебхук не найден');
    const patch = { url, events, is_active: body.is_active !== false }; if (body.rotate_secret) patch.secret = randKey('whsec_');
    const rows = await q('webhooks?id=eq.' + w.id, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) }); return rows[0];
  }
  const rows = await q('webhooks', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ org_id: user.org.id, url, secret: randKey('whsec_'), events, created_by: actorOf(user) }) });
  await logEvent(null, 'webhook_created', { id: rows[0].id, url }, user); return rows[0];
}
async function webhookDelete(body, user) {
  const w = (await q('webhooks?select=id,org_id&id=eq.' + enc(body.id)))[0]; if (!w || w.org_id !== user.org.id) throw new Error('Вебхук не найден');
  await q('webhooks?id=eq.' + w.id, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); return { ok: true };
}
async function webhookPing(body, user) {
  const w = (await q('webhooks?select=id,org_id,url&id=eq.' + enc(body.id)))[0]; if (!w || w.org_id !== user.org.id) throw new Error('Вебхук не найден');
  const rows = await q('webhook_deliveries', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ webhook_id: w.id, event: 'ping', payload: { message: 'Проверка вебхука из Urban Luxe PMS', organization: user.org.name, at: new Date().toISOString() } }) });
  const r = await require('./webhook-dispatch.js').run(5);
  const d = (await q('webhook_deliveries?select=*&id=eq.' + rows[0].id))[0];
  return { delivery: d, run: r };
}
async function webhookRetry(body, user) {
  const d = (await q('webhook_deliveries?select=id,webhook_id&id=eq.' + enc(body.id)))[0]; if (!d) throw new Error('Доставка не найдена');
  const w = (await q('webhooks?select=org_id&id=eq.' + d.webhook_id))[0]; if (!w || w.org_id !== user.org.id) throw new Error('Вебхук не найден');
  await q('webhook_deliveries?id=eq.' + d.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ sent_at: null, attempts: 0, next_at: new Date().toISOString(), status: null, response: null }) });
  const r = await require('./webhook-dispatch.js').run(5);
  return { delivery: (await q('webhook_deliveries?select=*&id=eq.' + d.id))[0], run: r };
}
// квартира принадлежит организации пользователя (по базе, а не по кэшу доступа — новая квартира попадает в кэш только через 2 мин)
async function ownApt(user, id) { const a = (await q('apartments?select=org_id&id=eq.' + enc(id)))[0]; return !!a && ((a.org_id || 1) === user.org.id || user.role === 'admin'); }
async function selectionCreate(body, user) {
  const ids = (body.apartment_ids || []).filter(id => canSeeApt(user, id)); if (!ids.length) throw new Error('Выберите квартиры');
  if (!body.check_in || !body.check_out || body.check_out <= body.check_in) throw new Error('Даты');
  const code = Math.random().toString(36).slice(2, 10);
  const rows = await q('selections', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ code, org_id: user.org.id, check_in: body.check_in, check_out: body.check_out, apartment_ids: ids, note: body.note || null, created_by: user.name }) });
  return { code, url: (process.env.URL || 'https://urbanluxe.cc') + '/s/' + code, row: rows[0] };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: H, body: '' };
  const p = event.queryStringParameters || {};
  try {
    // B: действия без входа — приглашение и сброс пароля
    if (event.httpMethod === 'GET' && p.a === 'invite_info') return out(200, await inviteInfo(p.token));
    if (event.httpMethod === 'POST') { const b0 = JSON.parse(event.body || '{}'); if (b0.a === 'invite_accept') return out(200, await inviteAccept(b0)); if (b0.a === 'password_reset') return out(200, await passwordReset(b0));
      // 16.10: первичная настройка синка с RC партнёра по одноразовому ключу (app_settings.partner_sync_once): токен RC HighLife уходит со страницы RC прямо сюда
      if (b0.a === 'partner_sync_setup') {
        const once = (await q('app_settings?select=value&key=eq.partner_sync_once'))[0]; if (!once || !once.value || once.value !== String(b0.once || '')) return out(403, { error: 'bad once' });
        await q('app_settings?key=eq.partner_sync_once', { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        if (b0.token) await q('app_settings?on_conflict=key', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' }, body: JSON.stringify({ key: 'rc_partner_token', value: String(b0.token), note: 'X-User-Token RC HighLife (agency 75311)', updated_at: new Date().toISOString() }) });
        return out(200, await require('./partner-rc-sync.js').sync());
      } }
    // 16.10: одноразовая выдача секретов для установки CRM на нашем сервере (app_settings.crm_setup_once: {once, PMS_API_KEY, PMS_WEBHOOK_SECRET}); запись удаляется при первом чтении
    if (event.httpMethod === 'GET' && p.a === 'crm_setup') {
      const row = (await q('app_settings?select=value&key=eq.crm_setup_once'))[0]; let v = null; try { v = row && JSON.parse(row.value); } catch (_) { }
      if (!v || !p.once || v.once !== String(p.once)) return out(403, { error: 'bad once' });
      await q('app_settings?key=eq.crm_setup_once', { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      return out(200, { PMS_API_KEY: v.PMS_API_KEY, PMS_WEBHOOK_SECRET: v.PMS_WEBHOOK_SECRET });
    }
    const user = await auth(event); if (!user) return out(401, { error: 'unauthorized' });
    if (event.httpMethod === 'GET') {
      switch (p.a) {
        case 'me': return out(200, { email: user.email, role: user.role, name: user.name, apartment_ids: user.apartment_ids, can: user.can, org: user.org, access: user.access, platform_admin: user.platform_admin, home_org_id: user.home_org_id, orgs: user.platform_admin ? await q('organizations?select=id,name,short,is_active&order=id') : [{ id: user.org.id, name: user.org.name, short: user.org.short }], has_partners: Object.values(user.access).some(m => m === 'occupancy') });
        case 'orgs': return out(200, await orgs(user));
        case 'integrations': if (user.role !== 'admin') return out(403, { error: 'только admin' }); return out(200, await integrations(user));
        case 'owner_report': if (!(user.role === 'partner' || user.can.report)) return out(403, { error: 'forbidden' }); return out(200, await ownerReport(user, p));
        case 'grid': return out(200, await grid(user, p));
        case 'booking': return out(200, await booking(user, p.id));
        case 'price': return out(200, await price(p));
        case 'free': return out(200, await free(user, p));
        case 'today': return out(200, await today(user));
        case 'guest_search': if (!user.can.guests) return out(403, { error: 'forbidden' }); return out(200, await guestSearch(p.q, user));
        case 'guest': if (!user.can.guests) return out(403, { error: 'forbidden' }); return out(200, await guest(p.id));
        case 'debts': if (!user.can.pay) return out(403, { error: 'forbidden' }); return out(200, await debts(user));
        case 'rules': if (!user.can.rates) return out(403, { error: 'forbidden' }); return out(200, await q('rate_rules?select=*&org_id=eq.' + user.org.id + '&order=is_active.desc,priority.desc,date_from.desc.nullslast'));
        case 'users': if (!user.can.users) return out(403, { error: 'forbidden' }); return out(200, await users(user));
        case 'objects': if (!user.can.objects) return out(403, { error: 'forbidden' }); return out(200, await objects(user));
        case 'booking_history': { const b = (await q('bookings?select=apartment_id&id=eq.' + enc(p.id)))[0]; if (!b || !canSeeApt(user, b.apartment_id)) return out(404, { error: 'not found' }); return out(200, { events: await rpc('pms_booking_history', { p_id: p.id }) }); }
        case 'selections': return out(200, await q('selections?select=*&org_id=eq.' + user.org.id + '&order=created_at.desc&limit=50'));
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
      case 'rate_set_days': need('rates'); return out(200, await rateSetDays(body, user));
      case 'rate_clear': need('rates'); return out(200, await rateClear(body, user));
      case 'rule_save': need('rates'); return out(200, await ruleSave(body, user));
      case 'rule_delete': need('rates'); await q('rate_rules?id=eq.' + enc(body.id), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); return out(200, { ok: true });
      case 'guest_update': need('guests_write'); return out(200, await guestUpdate(body, user));
      case 'guest_link': need('write'); return out(200, await guestLink(body, user));
      case 'guest_create': need('guests_write'); return out(200, await guestCreate(body, user));
      case 'user_save': need('users'); return out(200, await userSave(body, user));
      case 'org_save': return out(200, await orgSave(body, user));
      case 'org_partner_set': return out(200, await orgPartnerSet(body, user));
      case 'org_delete': return out(200, await orgDelete(body, user));
      case 'api_key_create': need('users'); return out(200, await apiKeyCreate(body, user));
      case 'api_key_toggle': need('users'); return out(200, await apiKeyToggle(body, user));
      case 'webhook_save': need('users'); return out(200, await webhookSave(body, user));
      case 'webhook_delete': need('users'); return out(200, await webhookDelete(body, user));
      case 'webhook_ping': need('users'); return out(200, await webhookPing(body, user));
      case 'webhook_retry': need('users'); return out(200, await webhookRetry(body, user));
      case 'invite_create': need('users'); return out(200, await inviteCreate(body, user));
      case 'invite_delete': need('users'); await q('invitations?token=eq.' + enc(body.token) + '&org_id=eq.' + user.org.id + '&accepted_at=is.null', { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); return out(200, { ok: true });
      case 'user_logout_all': need('users'); return out(200, await userLogoutAll(body, user));
      case 'complex_save': need('objects'); return out(200, await complexSave(body, user));
      case 'apt_save': need('objects'); return out(200, await aptSave(body, user));
      case 'apt_photos': need('objects'); return out(200, await aptPhotos(body, user));
      case 'apt_delete': need('objects_archive'); return out(200, await aptDelete(body, user));
      case 'complex_delete': need('objects_archive'); return out(200, await complexDelete(body, user));
      case 'apt_archive': need('objects_archive'); {
        // закрыть 500 дней (rate_overrides → пересчёт → очередь) → отправить в Channex сейчас → только потом выключить квартиру и unit
        if (!(await ownApt(user, body.id))) return out(403, { error: 'не ваша квартира' });
        const r = await rpc('pms_apt_archive', { p_apt: body.id, p_actor: user.name });
        let pushed = null; try { pushed = await require('./_channex.js').processOutbox(); } catch (e) { pushed = { error: String(e.message).slice(0, 200) }; }
        await q('apartments?id=eq.' + enc(body.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ is_active: false, updated_at: new Date().toISOString() }) });
        await q('channel_units?apartment_id=eq.' + enc(body.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ is_active: false, updated_at: new Date().toISOString() }) });
        await logEvent(null, 'apartment_archived', { apartment_id: body.id }, user); return out(200, Object.assign({}, r, { pushed }));
      }
      case 'apt_restore': need('objects_archive'); { if (!(await ownApt(user, body.id))) return out(403, { error: 'не ваша квартира' }); AUTH_CACHE.clear(); const r = await rpc('pms_apt_restore', { p_apt: body.id }); await logEvent(null, 'apartment_restored', { apartment_id: body.id }, user); return out(200, r); }
      case 'selection_create': return out(200, await selectionCreate(body, user));
      default: return out(400, { error: 'unknown action' });
    }
  } catch (e) { return out(e.status || 400, { error: dbError(e) }); }
};
// 14.10.2026 (админка v4): admin-api.js переиспользует вход и «сегодня», чтобы не дублировать логику
exports.authFor = auth;
exports.todayFor = today;
exports.usersFor = users; exports.userSaveFor = userSave; exports.userLogoutAllFor = userLogoutAll;
