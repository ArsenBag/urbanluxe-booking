// public-api.js (16.10.2026) — публичный API v1 для сайтов партнёров и клиентов PMS. Маршрут: /api/v1/* (netlify.toml).
// Авторизация: Authorization: Bearer <ключ>. Ключи — api_keys (secret sk_live_… хранится как sha256; public pk_live_… для виджета).
// Организация ключа видит только свои квартиры (apartments.org_id) + общие (apartment_access). Ответ: {ok:true,data} | {ok:false,error:{code,message}}.
// Спека: docs/superpowers/specs/2026-10-16-public-api-webhooks-design.md. Документация для партнёров: /api/docs
const crypto = require('crypto');
const T = require('./_tg.js');
const NOTIFY = require('./notify.js');

const enc = encodeURIComponent;
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const addDays = (iso, k) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
async function q(path, opt) { const r = await T.sb(path, opt); const t = await r.text(); if (!r.ok) { const e = new Error(t.slice(0, 300)); e.status = r.status; throw e; } if (!t) return null; try { return JSON.parse(t); } catch (_) { return null; } }
async function qAll(path, page) { page = page || 1000; const all = []; for (let i = 0; i < 20; i++) { const r = await T.sb(path, { headers: { Range: (i * page) + '-' + ((i + 1) * page - 1), Prefer: 'count=none' } }); if (!r.ok && r.status !== 416) throw new Error((await r.text()).slice(0, 300)); const rows = r.status === 416 ? [] : await r.json(); all.push(...rows); if (rows.length < page) break; } return all; }
const rpc = (name, args) => q('rpc/' + name, { method: 'POST', body: JSON.stringify(args || {}) });

const ApiError = (status, code, message) => Object.assign(new Error(message), { status, code });
const RATE = new Map(); // key_id → { m: minute, n }
const LIMIT = 120;

// ---- ключ → контекст (организация, права, квартиры)
async function auth(event) {
  const h = event.headers || {};
  const raw = ((h.authorization || h.Authorization || '').match(/^Bearer\s+(.+)$/i) || [])[1] || (event.queryStringParameters || {}).key;
  if (!raw) throw ApiError(401, 'unauthorized', 'Нет ключа: заголовок Authorization: Bearer <api key>');
  const key = String(raw).trim();
  const hash = key.startsWith('pk_') ? key : sha(key);
  const k = (await q('api_keys?select=*&key_hash=eq.' + enc(hash)))[0];
  if (!k || !k.is_active) throw ApiError(401, 'unauthorized', 'Ключ не найден или отключён');
  // лимит: атомарный счётчик api_rate (key, минута) — общий для всех инстансов функции; память — запасной вариант
  const m = Math.floor(Date.now() / 60000); const r = RATE.get(k.id) || { m, n: 0 }; if (r.m !== m) { r.m = m; r.n = 0; } r.n++; RATE.set(k.id, r);
  if (r.n > LIMIT) throw ApiError(429, 'rate_limited', 'Больше ' + LIMIT + ' запросов в минуту');
  try { const n = await rpc('api_rate_hit', { p_key: k.id }); if (Number(n) > LIMIT) throw ApiError(429, 'rate_limited', 'Больше ' + LIMIT + ' запросов в минуту'); } catch (e) { if (e.code === 'rate_limited') throw e; }
  const org = (await q('organizations?select=id,name,short,slug,logo_url,telegram,tg_chat_id,is_active&id=eq.' + k.org_id))[0];
  if (!org || org.is_active === false) throw ApiError(403, 'org_inactive', 'Организация отключена');
  const acc = await q('rpc/pms_org_apartments', { method: 'POST', body: JSON.stringify({ p_org: org.id }) });
  const apts = new Set(acc.filter(x => x.mode === 'full').map(x => x.apartment_id));
  q('api_keys?id=eq.' + k.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ last_used_at: new Date().toISOString() }) }).catch(() => null);
  return { key: k, org, apts, scopes: k.scopes || [], isPublic: k.kind === 'public' };
}
const need = (ctx, scope) => { if (!ctx.scopes.includes(scope) && !ctx.scopes.includes('manage')) throw ApiError(403, 'forbidden', 'У ключа нет права «' + scope + '»'); };
const aptIn = ctx => '&id=in.(' + ([...ctx.apts].length ? [...ctx.apts] : ['-']).map(enc).join(',') + ')';
const aptInB = ctx => '&apartment_id=in.(' + ([...ctx.apts].length ? [...ctx.apts] : ['-']).map(enc).join(',') + ')';
// то же представление, что api_booking_json в SQL (вебхуки) — без платежей и служебных заметок
const toApi = b => ({ id: b.id, ref: b.booking_ref, apartment_id: b.apartment_id, status: b.status, check_in: b.check_in, check_out: b.check_out, nights: Math.round((new Date(b.check_out) - new Date(b.check_in)) / 864e5), arrival_time: b.arrival_time, departure_time: b.departure_time, guest: { name: b.guest_name, phone: b.guest_phone, email: b.guest_email, telegram: b.guest_telegram }, guests_count: b.guests_count, total_price: b.total_price, currency: b.currency || 'USD', source: b.source, channel: b.channel, external_ref: (b.meta || {}).external_ref || null, notes: b.notes, created_at: b.created_at, updated_at: b.updated_at, cancelled_at: b.cancelled_at });
const photos = a => { const p = a.photo_url || ''; if (!p) return []; try { const arr = JSON.parse(p); return Array.isArray(arr) ? arr.filter(Boolean) : [p]; } catch (_) { return [p]; } };

// ---- ресурсы
async function apartments(ctx) {
  need(ctx, 'read');
  const rows = await q('apartments?select=id,name,complex,floor,rooms,max_guests,weekday_price,weekend_price,min_nights,catalog_no,description,description_en,description_uz,amenities,photo_url,style&is_active=eq.true' + aptIn(ctx) + '&order=complex,catalog_no.nullslast,name');
  return rows.map(a => ({ id: a.id, name: a.name, complex: a.complex, floor: a.floor, rooms: a.rooms, max_guests: a.max_guests, catalog_no: a.catalog_no, style: a.style, weekday_price: a.weekday_price, weekend_price: a.weekend_price, min_nights: a.min_nights, currency: 'USD', photos: photos(a), description: { ru: a.description || null, en: a.description_en || null, uz: a.description_uz || null }, amenities: a.amenities || null }));
}
async function availability(ctx, p) {
  need(ctx, 'read');
  const today = T.tashToday(0);
  const from = isDate(p.from) ? p.from : today; let to = isDate(p.to) ? p.to : addDays(from, 30);
  if (to <= from) throw ApiError(400, 'bad_dates', 'to должен быть позже from');
  if ((new Date(to) - new Date(from)) / 864e5 > 400) to = addDays(from, 400);
  if (p.apartment_id && !ctx.apts.has(p.apartment_id)) throw ApiError(404, 'not_found', 'Квартира не найдена');
  const ids = p.apartment_id ? [p.apartment_id] : [...ctx.apts];
  if (!ids.length) return { from, to, free: [], days: {} };
  const rows = await qAll('rate_calendar?select=apartment_id,date,price,min_nights,closed,closed_to_arrival,available&date=gte.' + from + '&date=lt.' + to + '&apartment_id=in.(' + ids.map(enc).join(',') + ')&order=apartment_id,date');
  const days = {}; const nights = Math.round((new Date(to) - new Date(from)) / 864e5);
  for (const r of rows) (days[r.apartment_id] = days[r.apartment_id] || {})[r.date] = { available: !!r.available && !r.closed, price: r.price, min_nights: r.min_nights || 1, closed_to_arrival: !!r.closed_to_arrival };
  const free = ids.filter(id => { const d = days[id] || {}; if (Object.keys(d).length < nights) return false; return Object.values(d).every(x => x.available); });
  return { from, to, free, days };
}
async function price(ctx, p) {
  need(ctx, 'read');
  if (!p.apartment_id || !ctx.apts.has(p.apartment_id)) throw ApiError(404, 'not_found', 'Квартира не найдена');
  if (!isDate(p.check_in) || !isDate(p.check_out) || p.check_out <= p.check_in) throw ApiError(400, 'bad_dates', 'check_in / check_out');
  const r = await rpc('pms_price', { p_apt: p.apartment_id, p_in: p.check_in, p_out: p.check_out, p_channel: 'partner', p_guests: p.guests ? Number(p.guests) : null, p_exclude: null });
  const nights = Math.round((new Date(p.check_out) - new Date(p.check_in)) / 864e5);
  return { apartment_id: p.apartment_id, check_in: p.check_in, check_out: p.check_out, nights, total: r.total, per_night: nights ? Math.round(r.total / nights) : null, currency: 'USD', ok: r.ok !== false, reason: r.reason || null, discount_label: r.discount_label || null };
}
async function bookingCreate(ctx, body, ip) {
  need(ctx, 'book');
  const apt = String(body.apartment_id || ''); if (!ctx.apts.has(apt)) throw ApiError(404, 'not_found', 'Квартира не найдена');
  const ci = body.check_in, co = body.check_out; if (!isDate(ci) || !isDate(co) || co <= ci) throw ApiError(400, 'bad_dates', 'check_in / check_out (YYYY-MM-DD, выезд позже заезда)');
  if (ci < T.tashToday(0)) throw ApiError(400, 'bad_dates', 'Дата заезда уже прошла');
  const g = body.guest || {}; const name = String(g.name || body.guest_name || '').trim(); const phone = String(g.phone || body.guest_phone || '').trim();
  if (!name) throw ApiError(400, 'validation', 'guest.name обязателен');
  let status = body.status === 'confirmed' ? 'confirmed' : 'request';
  if (ctx.isPublic && status !== 'request') throw ApiError(403, 'forbidden', 'Публичный ключ создаёт только заявки (status=request)');
  const nights = Math.round((new Date(co) - new Date(ci)) / 864e5);
  let total = Number(body.total_price) > 0 ? Math.round(Number(body.total_price)) : null;
  if (total == null) { try { const r = await rpc('pms_price', { p_apt: apt, p_in: ci, p_out: co, p_channel: 'partner', p_guests: body.guests_count ? Number(body.guests_count) : null, p_exclude: null }); if (r && r.total) total = Math.round(r.total); } catch (_) { } }
  const row = { apartment_id: apt, check_in: ci, check_out: co, nights, status, source: 'api', channel: 'partner-site', org_id: ctx.org.id,
    guest_name: name, guest_phone: phone || null, guest_email: g.email || null, guest_telegram: g.telegram || null, guest_whatsapp: g.whatsapp || null,
    guests_count: Number(body.guests_count) || 1, total_price: total || 0, currency: 'USD', notes: body.notes ? String(body.notes).slice(0, 1000) : null,
    booking_ref: 'UL-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
    created_by: 'api:' + ctx.key.name, updated_by: 'api:' + ctx.key.name, meta: { api_key_id: ctx.key.id, external_ref: body.external_ref ? String(body.external_ref).slice(0, 100) : null, ip } };
  let b;
  try { b = (await q('bookings', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) }))[0]; }
  catch (e) { if (/23P01|conflicts with existing|exclusion|overlap|пересек/i.test(e.message)) throw ApiError(409, 'dates_taken', 'Даты заняты'); throw e; }
  // уведомление в TG организации (или наш чат)
  try { const a = (await q('apartments?select=name&id=eq.' + enc(apt)))[0]; const chat = ctx.org.tg_chat_id || null;
    const text = (status === 'request' ? '🆕 <b>Заявка через API</b>' : '✅ <b>Бронь через API</b>') + ' (' + T.esc(ctx.key.name) + ')' + ' · <b>' + T.esc(a ? a.name : apt) + '</b>\n📅 ' + ci + ' → ' + co + ' · ' + nights + ' ноч.\n👤 ' + T.esc(name) + (phone ? ' · ' + T.esc(phone) : '') + (total ? '\n💰 $' + total : '') + '\n#️⃣ ' + b.booking_ref + (row.meta.external_ref ? ' · ' + T.esc(row.meta.external_ref) : '') + '\n<a href="https://urbanluxe.cc/pms#booking=' + b.id + '">Открыть в PMS</a>';
    if (chat && T.TOKENS.bookings) await T.api(T.TOKENS.bookings, 'sendMessage', { chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true });
    else await NOTIFY.sendTg({ type: status === 'request' ? 'new_request' : 'new_booking', apartment: a ? a.name : apt, guest_name: name + ' (API ' + ctx.key.name + ')', guest_phone: phone, guest_telegram: g.telegram, check_in: ci, check_out: co, nights, total, ref: b.booking_ref }); } catch (_) { }
  return toApi(b);
}
async function bookingGet(ctx, id) {
  need(ctx, 'read');
  const b = (await q('bookings?select=*&id=eq.' + enc(id)))[0];
  if (!b || !ctx.apts.has(b.apartment_id)) throw ApiError(404, 'not_found', 'Бронь не найдена');
  if (ctx.isPublic && (!b.meta || b.meta.api_key_id !== ctx.key.id)) throw ApiError(404, 'not_found', 'Бронь не найдена');
  return toApi(b);
}
async function bookingsList(ctx, p) {
  need(ctx, 'read'); if (ctx.isPublic) throw ApiError(403, 'forbidden', 'Список броней — только по секретному ключу');
  const today = T.tashToday(0); const from = isDate(p.from) ? p.from : today, to = isDate(p.to) ? p.to : addDays(from, 90);
  let path = 'bookings?select=*&check_in=lt.' + to + '&check_out=gt.' + from + aptInB(ctx) + '&order=check_in&limit=500';
  if (p.status) path += '&status=eq.' + enc(p.status); else path += '&status=neq.cancelled';
  const rows = await q(path);
  return rows.map(toApi);
}
async function bookingCancel(ctx, id, body) {
  need(ctx, 'cancel');
  const b = (await q('bookings?select=*&id=eq.' + enc(id)))[0];
  if (!b || !ctx.apts.has(b.apartment_id)) throw ApiError(404, 'not_found', 'Бронь не найдена');
  const own = b.meta && b.meta.api_key_id && (await q('api_keys?select=org_id&id=eq.' + b.meta.api_key_id))[0]?.org_id === ctx.org.id;
  if (!own && !ctx.scopes.includes('manage')) throw ApiError(403, 'forbidden', 'Отменять можно только брони, созданные через API вашей организации (или право manage)');
  if (b.status === 'cancelled') return toApi(b);
  if (['checked_in', 'checked_out'].includes(b.status)) throw ApiError(409, 'bad_status', 'Гость уже заехал — отмена невозможна');
  const rows = await q('bookings?id=eq.' + enc(id), { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason: body && body.reason ? String(body.reason).slice(0, 300) : 'api', updated_by: 'api:' + ctx.key.name }) });
  return toApi(rows[0]);
}

const H = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const cors = ctx => ctx && ctx.isPublic ? { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } : {};
exports.handler = async (event) => {
  const t0 = Date.now();
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: Object.assign({}, H, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }), body: '' };
  const path = (event.path || '').replace(/^.*\/api\/v1/, '').replace(/^\/\.netlify\/functions\/public-api/, '').replace(/\/+$/, '') || '/';
  const p = event.queryStringParameters || {}; const ip = (event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || '').split(',')[0];
  let ctx = null, status = 200, body;
  try {
    ctx = await auth(event);
    let data; const m = event.httpMethod; let json = {}; if (m === 'POST') { try { json = JSON.parse(event.body || '{}'); } catch (_) { throw ApiError(400, 'bad_json', 'Тело запроса — JSON'); } }
    let mm;
    if (m === 'GET' && path === '/me') data = { organization: { id: ctx.org.id, name: ctx.org.name, short: ctx.org.short, logo_url: ctx.org.logo_url }, key: { name: ctx.key.name, kind: ctx.key.kind, scopes: ctx.scopes }, limits: { per_minute: LIMIT }, apartments: ctx.apts.size };
    else if (m === 'GET' && path === '/apartments') data = await apartments(ctx);
    else if (m === 'GET' && path === '/availability') data = await availability(ctx, p);
    else if (m === 'GET' && path === '/price') data = await price(ctx, p);
    else if (m === 'POST' && path === '/bookings') { data = await bookingCreate(ctx, json, ip); status = 201; }
    else if (m === 'GET' && path === '/bookings') data = await bookingsList(ctx, p);
    else if (m === 'GET' && (mm = path.match(/^\/bookings\/([0-9a-f-]{36})$/))) data = await bookingGet(ctx, mm[1]);
    else if (m === 'POST' && (mm = path.match(/^\/bookings\/([0-9a-f-]{36})\/cancel$/))) data = await bookingCancel(ctx, mm[1], json);
    else throw ApiError(404, 'no_route', 'Нет такого метода: ' + m + ' ' + path + '. Документация: https://urbanluxe.cc/api/docs');
    body = { ok: true, data };
  } catch (e) {
    status = e.status && e.status < 600 ? e.status : 500; if (status >= 500) status = 500;
    body = { ok: false, error: { code: e.code || (status === 500 ? 'internal' : 'error'), message: String(e.message || e).slice(0, 300) } };
  }
  try { await q('api_log', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ key_id: ctx ? ctx.key.id : null, org_id: ctx ? ctx.org.id : null, method: event.httpMethod, path, status, ms: Date.now() - t0, ip }) }); } catch (_) { }
  return { statusCode: status, headers: Object.assign({}, H, cors(ctx)), body: JSON.stringify(body) };
};
