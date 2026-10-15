// Urban Luxe — admin-api.js (14.10.2026). Единый API админки v4 (/admin). Выросла из admin3-api.js (все её действия сохранены).
// Авторизация: та же, что в /pms (pms-api.authFor): Supabase-сессия → app_users (роли admin / booker / ops / partner, организации).
// Роли: admin — всё; ops — чтение всего кроме pl/finance/partner_report/users и действия с заявками; partner — только свой отчёт.
// Данные: finance_monthly (импорт таблиц + ручной ввод), daily_ops (живая выручка по заездам), expenses, apartment_terms,
// partners, marketing_spend, occupancy_daily, bookings, cleaning_tasks. Новое (v4): v_requests, adm_month_kpi(date).
//
// Новое в v4:
// GET  ?a=requests                        → заявки с сайта (status='request')
// POST {a:'request_confirm', id}          → confirmed + письмо гостю + TG (повтор → 409 «уже обработана»)
// POST {a:'request_cancel', id, reason}   → cancelled + письмо гостю + TG
// GET  ?a=kpi&month=2026-10               → { current, previous, series[13] } из adm_month_kpi (касса, начислено, загрузка, ADR, RevPAR)
// GET  ?a=today                           → то же, что pms-api?a=today (заезды/выезды/живут/уборки/долги)
// GET  ?a=occ14                           → загрузка на 14 дней по rate_calendar
// GET  ?a=analytics&from=YYYY-MM-DD&to=   → adm_analytics за период (загрузка по ЖК/квартирам, ADR/RevPAR, источники, дни недели, длина проживания) + months[]
// GET  ?a=ops_day&date=                   → лист дня (daily_ops c галочками) + заезды/выезды/живут/уборки/персонал; POST ops_toggle {id,key}, ops_patch {id,patch}, ops_add {date, apartment}
// GET  ?a=map&d0=&days=                   → данные для карты /map (квартиры с занятостью, брони окна, уборки, персонал, лист)
// GET  ?a=chat_list | ?a=chat_msgs&id= ; POST chat_send {id, text, email}   → чат с гостями (messages, conversation_id = bookings.id)
// GET  ?a=staff_month&month= ; POST staff_save / attendance {staff_id,date} / staff_payment / staff_payment_delete
// GET  ?a=pms_users ; POST pms_user_save {user} / pms_user_logout_all {email}  → доступы (общие с /pms)
// GET  ?a=apt_list | ?a=apt&id=            → карточки сайта (этап 4); POST apt_save {apt}, apt_photos {id, photos[]} (порядок/обложка/удаление + превью thumbs/), checkin_save {apartment_id, content_ru/en/uz}
//
// GET  ?a=me
// GET  ?a=dashboard                       → KPI текущего месяца + ряд 13 месяцев
// GET  ?a=pl&from=2026-01&to=2026-12      → P&L по месяцам (выручка, аренда, комиссии, расходы по категориям, результат, доля партнёров)
// GET  ?a=apartments&month=2026-09        → квартиры: модель, аренда, партнёр, выручка/прибыль за месяц и за 3 мес, загрузка
// GET  ?a=apartment&id=nest_481           → история по квартире
// GET  ?a=expenses&month=2026-09[&apartment_id=] | POST {a:'expense', ...} | POST {a:'expense_delete', id}
// GET  ?a=terms | POST {a:'term', ...} | POST {a:'term_delete', id}
// GET  ?a=partners | POST {a:'partner', ...}
// GET  ?a=partner_report&partner_id=&month=2026-09
// GET  ?a=marketing&from=&to= | POST {a:'marketing', ...}
// POST {a:'finance', apartment_id, month, revenue, rent, commission, nights, notes}  → ручная запись (source=manual, перекрывает импорт)
// GET  ?a=ops                              → сегодня: заезды/выезды/уборки/долги, загрузка на 14 дней
// GET  ?a=categories

const T = require('./_tg.js');
const PMS = require('./pms-api.js');
const MAIL = require('./_booking-mail.js');
const NOTIFY = require('./notify.js');

const SB_URL = process.env.SUPABASE_URL || 'https://sebvfvtofiysbywxjqut.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI';
const H = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const out = (code, body) => ({ statusCode: code, headers: H, body: JSON.stringify(body) });
const n = v => { const x = parseFloat(v); return isNaN(x) ? 0 : x; };
const r2 = v => Math.round(n(v) * 100) / 100;
const monthStart = ym => (ym && /^\d{4}-\d{2}$/.test(ym) ? ym + '-01' : T.tashToday(0).slice(0, 7) + '-01');
const addMonths = (iso, k) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + k); return d.toISOString().slice(0, 10); };
const ym = iso => String(iso).slice(0, 7);

async function q(path, opts) { const r = await T.sb(path, opts); if (!r.ok) throw new Error(path.split('?')[0] + ': ' + (await r.text()).slice(0, 200)); return r.json(); }

// ---------- auth (общий с /pms) ----------
async function auth(event) {
  const u = await PMS.authFor(event);
  if (!u) return null;
  if (u.partner_id === undefined) { const rows = await q('app_users?select=partner_id&email=eq.' + encodeURIComponent(u.email)); u.partner_id = rows[0] ? rows[0].partner_id : null; }
  return u;
}

// ---------- заявки с сайта (v4) ----------
const requests = () => q('v_requests?select=*');

async function kpi(monthIso) {
  // 14.10: один rpc на 13 месяцев вместо 13 параллельных (adm_kpi_series), ~90 мс в базе
  const r = await q('rpc/adm_kpi_series', { method: 'POST', body: JSON.stringify({ p_to: monthIso, p_months: 13 }) });
  const series = Array.isArray(r) ? r : (r || []);
  return { month: ym(monthIso), current: series[series.length - 1] || {}, previous: series[series.length - 2] || {}, series };
}

// Загрузка на 14 дней по календарю цен (rate_calendar.available — та же правда, что уходит на площадки), не по iCal-снапшоту
async function occ14() {
  const d0 = T.tashToday(0), d1 = T.tashToday(14);
  const [apts, rows] = await Promise.all([q('apartments?select=id&is_active=eq.true'), q('rate_calendar?select=date,apartment_id&available=eq.false&date=gte.' + d0 + '&date=lt.' + d1 + '&limit=5000')]);
  const act = new Set(apts.map(a => a.id)); const by = {};
  rows.forEach(r => { if (act.has(r.apartment_id)) by[r.date] = (by[r.date] || 0) + 1; });
  return { active: act.size, days: Array.from({ length: 14 }, (_, i) => { const d = T.tashToday(i); return { date: d, busy: by[d] || 0, pct: act.size ? Math.round(100 * (by[d] || 0) / act.size) : 0 }; }) };
}

// Аналитика за период (этап 2): adm_analytics(from,to) + помесячный ряд adm_month_kpi по месяцам периода (≤ 24)
async function analytics(from, to) {
  const okD = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
  if (!okD(from) || !okD(to) || to <= from) throw Object.assign(new Error('Период: from/to в формате YYYY-MM-DD, to > from'), { status: 400 });
  // ряд по месяцам: 12 месяцев до конца периода (чтобы график был осмысленным и для «месяца»), но не меньше самого периода
  const lastM = addDays(to, -1).slice(0, 7) + '-01'; const firstM = from.slice(0, 7) + '-01';
  let n = 0; for (let m = firstM; m <= lastM && n < 24; m = addMonths(m, 1)) n++;
  const [a, ms] = await Promise.all([q('rpc/adm_analytics', { method: 'POST', body: JSON.stringify({ p_from: from, p_to: to }) }), q('rpc/adm_kpi_series', { method: 'POST', body: JSON.stringify({ p_to: lastM, p_months: Math.max(n, 12) }) })]);
  const un = x => (Array.isArray(x) ? x[0] : x) || {};
  return Object.assign(un(a), { months: Array.isArray(ms) ? ms : [] });
}


// ---------- квартиры: карточки сайта (этап 4) ----------
const SB_SERVICE = process.env.SUPABASE_SERVICE_KEY;
const APT_FIELDS = ['name', 'complex', 'floor', 'style', 'rooms', 'max_guests', 'weekday_price', 'weekend_price', 'discount_week', 'discount_month', 'min_nights', 'seasonal_prices',
  'description', 'description_en', 'description_uz', 'amenities', 'ical_export_url', 'ical_import_url', 'is_active', 'catalog_no', 'tracked', 'org_id'];
const parsePhotos = a => { let ph = []; try { const p = JSON.parse(a.photo_url); if (Array.isArray(p)) ph = p; } catch (e) { if (a.photo_url) ph = [a.photo_url]; } return ph.filter(Boolean); };
async function aptList() {
  const [apts, terms, ci] = await Promise.all([q('apartments?select=*&order=complex,catalog_no.nullslast,name'), termsAll(), q('checkin_instructions?select=apartment_id,updated_at')]);
  const ciSet = new Set(ci.map(x => x.apartment_id)); const today = T.tashToday(0);
  return apts.map(a => Object.assign({}, a, { photos: parsePhotos(a), photo_count: parsePhotos(a).length, term: termFor(terms, a.id, today), has_instructions: ciSet.has(a.id) }));
}
async function aptOne(id) {
  const a = (await q('apartments?select=*&id=eq.' + encodeURIComponent(id)))[0];
  if (!a) throw Object.assign(new Error('Квартира не найдена'), { status: 404 });
  const [ci, terms, fin, exps] = await Promise.all([q('checkin_instructions?select=*&apartment_id=eq.' + encodeURIComponent(id)), q('apartment_terms?select=*,partners(id,name)&apartment_id=eq.' + encodeURIComponent(id) + '&order=valid_from.desc'),
    q('finance_monthly?select=month,source,revenue,rent,nights,profit&apartment_id=eq.' + encodeURIComponent(id) + '&order=month.desc&limit=12'), q('expenses?select=*&apartment_id=eq.' + encodeURIComponent(id) + '&order=expense_date.desc&limit=30')]);
  return { apartment: Object.assign({}, a, { photos: parsePhotos(a) }), instructions: ci[0] || null, terms, finance: fin, expenses: exps };
}
async function aptSave(body, user) {
  const src = body.apt || {}; const id = String(src.id || '').trim();
  if (!/^[a-z0-9_]{2,40}$/.test(id)) throw Object.assign(new Error('id квартиры: латиница/цифры/подчёркивание, например nest_15'), { status: 400 });
  const rec = {}; APT_FIELDS.forEach(f => { if (src[f] !== undefined) rec[f] = src[f]; });
  ['floor', 'max_guests', 'weekday_price', 'weekend_price', 'discount_week', 'discount_month', 'min_nights', 'catalog_no', 'org_id'].forEach(f => { if (rec[f] !== undefined) rec[f] = rec[f] === null || rec[f] === '' ? null : parseInt(rec[f], 10); });
  if (rec.amenities && !Array.isArray(rec.amenities)) rec.amenities = String(rec.amenities).split(',').map(x => x.trim()).filter(Boolean);
  if (typeof rec.seasonal_prices === 'string') { try { rec.seasonal_prices = rec.seasonal_prices ? JSON.parse(rec.seasonal_prices) : null; } catch (e) { throw Object.assign(new Error('seasonal_prices: некорректный JSON'), { status: 400 }); } }
  if (!rec.name) throw Object.assign(new Error('Название обязательно'), { status: 400 });
  rec.updated_at = new Date().toISOString();
  const exists = (await q('apartments?select=id&id=eq.' + encodeURIComponent(id))).length > 0;
  const r = exists ? await T.sb('apartments?id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(rec) })
                   : await T.sb('apartments', { method: 'POST', body: JSON.stringify(Object.assign({ id, photo_url: '', is_active: false, tracked: true }, rec)) });
  if (!r.ok) throw new Error('apartments: ' + (await r.text()).slice(0, 200));
  return { ok: true, id, created: !exists };
}
// Превью 800px webp для карточек сайта: thumbs/<id>_thumb.webp (через images.weserv.nl → Storage, service key)
async function aptThumb(id, coverUrl) {
  if (!coverUrl || !SB_SERVICE) return { ok: false };
  try {
    const src = 'https://images.weserv.nl/?url=' + encodeURIComponent(String(coverUrl).replace(/^https?:\/\//, '')) + '&w=800&h=600&fit=cover&q=72&output=webp';
    const img = await fetch(src); if (!img.ok) return { ok: false, reason: 'weserv ' + img.status };
    const buf = Buffer.from(await img.arrayBuffer());
    const up = await fetch(SB_URL + '/storage/v1/object/apartments/thumbs/' + encodeURIComponent(id) + '_thumb.webp', { method: 'POST', headers: { apikey: SB_SERVICE, Authorization: 'Bearer ' + SB_SERVICE, 'Content-Type': 'image/webp', 'x-upsert': 'true', 'Cache-Control': 'max-age=3600' }, body: buf });
    return { ok: up.ok, size: buf.length, reason: up.ok ? undefined : (await up.text()).slice(0, 120) };
  } catch (e) { return { ok: false, reason: String(e.message || e) }; }
}
async function aptPhotos(body) {
  const id = String(body.id || ''); const photos = (body.photos || []).map(String).filter(u => /^https?:\/\//.test(u));
  const a = (await q('apartments?select=id,photo_url&id=eq.' + encodeURIComponent(id)))[0]; if (!a) throw Object.assign(new Error('Квартира не найдена'), { status: 404 });
  const prev = parsePhotos(a);
  const r = await T.sb('apartments?id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ photo_url: photos.length > 1 ? JSON.stringify(photos) : (photos[0] || ''), updated_at: new Date().toISOString() }) });
  if (!r.ok) throw new Error('apartments: ' + (await r.text()).slice(0, 200));
  // удалённые из списка файлы — убрать из Storage (только наши объекты бакета apartments)
  const removed = prev.filter(u => !photos.includes(u)); const deleted = [];
  for (const u of removed) {
    const m = u.match(/\/storage\/v1\/object\/public\/apartments\/(.+)$/); if (!m || !SB_SERVICE || /^(thumbs|hero)\//.test(m[1])) continue;
    try { const d = await fetch(SB_URL + '/storage/v1/object/apartments/' + m[1], { method: 'DELETE', headers: { apikey: SB_SERVICE, Authorization: 'Bearer ' + SB_SERVICE } }); if (d.ok) deleted.push(m[1]); } catch (e) { /* не критично */ }
  }
  const thumb = prev[0] !== photos[0] || body.force_thumb ? await aptThumb(id, photos[0]) : { ok: true, skipped: true };
  return { ok: true, photos, deleted, thumb };
}
async function checkinSave(body) {
  const id = String(body.apartment_id || ''); if (!id) throw Object.assign(new Error('apartment_id'), { status: 400 });
  const rec = { apartment_id: id, content_ru: body.content_ru || '', content_en: body.content_en || '', content_uz: body.content_uz || '', updated_at: new Date().toISOString() };
  const r = await T.sb('checkin_instructions?on_conflict=apartment_id', { method: 'POST', headers: { Prefer: 'return=representation,resolution=merge-duplicates' }, body: JSON.stringify(rec) });
  if (!r.ok) throw new Error('checkin_instructions: ' + (await r.text()).slice(0, 200));
  return { ok: true };
}


// ---------- операционка (этап 5): лист дня + карта ----------
const OPS = require('./ops.js');
const addDays = (iso, k) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
const okDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
async function opsDay(date) {
  if (!okDate(date)) date = T.tashToday(0);
  await OPS.ensureDay(date);
  const [rows, bk, cl, staff] = await Promise.all([
    OPS.getRows(date),
    q('v_bookings?select=id,apartment_id,apartment_name,complex,check_in,check_out,nights,status,source,channel,guest_name,guest_phone,guest_telegram,guests_count,total_price,currency,paid,debt,arrival_time,departure_time,checked_in,checked_out,notes&status=in.(confirmed,checked_in,checked_out,request)&check_in=lte.' + date + '&check_out=gte.' + date + '&order=apartment_id'),
    q('cleaning_tasks?select=*&date=eq.' + date),
    q('staff?select=id,name,role,phone,telegram_chat_id&is_active=eq.true&order=name')
  ]);
  const inhouse = bk.filter(b => b.check_in < date && b.check_out > date), checkouts = bk.filter(b => b.check_out === date), checkins = bk.filter(b => b.check_in === date);
  return { date, rows, checkins, checkouts, inhouse, cleaning: cl, staff };
}
async function opsToggle(body, user) { const r = await OPS.applyToggle(body.id, body.key, user.email); if (!r) throw Object.assign(new Error('Строка не найдена'), { status: 404 }); if (r.error) throw Object.assign(new Error(r.error.replace(/<[^>]+>/g, '')), { status: 400 }); return r; }
async function opsPatch(body, user) {
  // прямая правка полей строки daily_ops из админки (время, гости, суммы, заметка, депозит)
  const ALLOW = ['checkin_time', 'checkout_time', 'guests', 'guest_name', 'note', 'payment_total', 'payment_paid', 'source', 'deposit_amount', 'registration'];
  const patch = { updated_by: user.email, updated_at: new Date().toISOString(), auto: false };
  ALLOW.forEach(k => { if (body.patch && body.patch[k] !== undefined) patch[k] = body.patch[k]; });
  const r = await T.sb('daily_ops?id=eq.' + encodeURIComponent(body.id), { method: 'PATCH', body: JSON.stringify(patch) });
  if (!r.ok) throw new Error('daily_ops: ' + (await r.text()).slice(0, 200));
  return { row: await OPS.getRow(body.id) };
}
async function opsAddRow(body, user) { const r = await OPS.addRow(body.date, body.apartment, user.email); if (r.error) throw Object.assign(new Error(r.error.replace(/<[^>]+>/g, '')), { status: 400 }); return r; }

// Карта /map: квартиры с занятостью на 15 дней + брони окна + уборки + персонал. Для квартир tracked=false занятость берём из iCal RC.
function parseICS(text) { const ev = []; String(text).split('BEGIN:VEVENT').slice(1).forEach(b => { const body = b.split('END:VEVENT')[0]; const g = re => { const m = body.match(re); return m ? m[1] : ''; }; const ds = g(/DTSTART(?:;VALUE=DATE)?[^:]*:(\d{8})/), de = g(/DTEND(?:;VALUE=DATE)?[^:]*:(\d{8})/); if (!ds || !de) return; const f = x => x.slice(0, 4) + '-' + x.slice(4, 6) + '-' + x.slice(6, 8); if (f(de) > f(ds)) ev.push({ check_in: f(ds), check_out: f(de) }); }); return ev; }
async function mapData(d0, days) {
  if (!okDate(d0)) d0 = T.tashToday(0); days = Math.min(Math.max(parseInt(days, 10) || 15, 7), 31);
  const d1 = addDays(d0, days);
  const [apts, bk, cl, staff, ops] = await Promise.all([
    q('apartments?select=id,name,complex,floor,rooms,weekday_price,weekend_price,catalog_no,tracked,ical_export_url&is_active=eq.true&order=complex,floor,name'),
    q('v_bookings?select=id,apartment_id,check_in,check_out,nights,status,source,channel,guest_name,guests_count,total_price,currency,paid,debt,arrival_time,departure_time,checked_in,checked_out&status=in.(confirmed,checked_in,checked_out,request,blocked)&check_in=lt.' + d1 + '&check_out=gt.' + addDays(d0, -1) + '&limit=3000'),
    q('cleaning_tasks?select=*&date=gte.' + addDays(d0, -1) + '&date=lt.' + d1),
    q('staff?select=id,name,role&is_active=eq.true&role=in.(cleaning,housekeeper,maid,supervisor)&order=name'),
    q('daily_ops?select=id,date,apartment_id,passport,access,registration,confirm_checkin,confirm_checkout,checked_in,checked_out,payment_total,payment_paid,checkin_time,checkout_time,guests,guest_name&date=gte.' + addDays(d0, -1) + '&date=lt.' + d1)
  ]);
  // занятость по дням: tracked — из броней базы; untracked — iCal RC (параллельно, 8 с, без падения)
  const ical = {};
  await Promise.all(apts.filter(a => a.tracked === false && /^https?:\/\//.test(a.ical_export_url || '')).map(async a => {
    try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 8000); const r = await fetch(a.ical_export_url, { signal: c.signal }); clearTimeout(t); const txt = await r.text(); if (r.ok && txt.includes('BEGIN:VCALENDAR')) ical[a.id] = parseICS(txt); } catch (e) { /* фид недоступен — пусто */ }
  }));
  const out = apts.map(a => {
    const ev = a.tracked === false ? (ical[a.id] || []) : bk.filter(b => b.apartment_id === a.id && b.status !== 'cancelled');
    let bits = ''; for (let i = 0; i < days; i++) { const d = addDays(d0, i); bits += ev.some(e => e.check_in <= d && e.check_out > d) ? '1' : '0'; }
    return { id: a.id, no: String(a.name || '').replace(/\D/g, '') || a.name, complex: a.complex, floor: a.floor, wd: a.weekday_price, we: a.weekend_price, rooms: a.rooms, bits, tracked: a.tracked !== false, catalog_no: a.catalog_no, ical_ok: a.tracked === false ? !!ical[a.id] : null };
  });
  return { d0, days, apts: out, bookings: bk.filter(b => b.status !== 'blocked'), cleaning: cl, staff, ops };
}


// ---------- чат с гостями (этап 6) ----------
const CARD = '🆕 Новая бронь';
async function chatList() { return q('v_chat_threads?select=*&order=unread.desc,last_at.desc&limit=300'); }
async function chatMsgs(id) {
  if (!id) throw Object.assign(new Error('id'), { status: 400 });
  const [msgs, th] = await Promise.all([q('messages?select=*&conversation_id=eq.' + encodeURIComponent(id) + '&order=created_at&limit=500'), q('v_chat_threads?select=*&conversation_id=eq.' + encodeURIComponent(id))]);
  await T.sb('messages?conversation_id=eq.' + encodeURIComponent(id) + '&sender_role=eq.guest&is_read=is.false', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ is_read: true }) }).catch(() => { });
  return { thread: th[0] || null, messages: msgs };
}
async function chatSend(body, user) {
  const id = String(body.id || ''), text = String(body.text || '').trim(); if (!id || !text) throw Object.assign(new Error('Пустое сообщение'), { status: 400 });
  const r = await T.sb('messages', { method: 'POST', body: JSON.stringify({ conversation_id: id, sender_role: 'admin', content: text, is_read: true }) });
  if (!r.ok) throw new Error('messages: ' + (await r.text()).slice(0, 200));
  let mail = { sent: false, reason: 'off' };
  if (body.email !== false) {
    const th = (await q('v_chat_threads?select=*&conversation_id=eq.' + encodeURIComponent(id)))[0];
    const key = process.env.RESEND_API_KEY || process.env.RESEND_KEY;
    if (th && th.guest_email && key) {
      try {
        const subj = 'Urban Luxe · ответ по брони ' + (th.booking_ref || '');
        const html = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222"><div style="color:#b8923f;letter-spacing:.3em;font-size:14px;margin-bottom:14px">URBAN LUXE</div><p style="white-space:pre-wrap;font-size:15px;line-height:1.6">' + String(text).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])) + '</p><p style="color:#777;font-size:12px">Бронь ' + (th.booking_ref || '') + ' · ' + (th.apartment_name || '') + ' · ' + (th.check_in || '') + ' → ' + (th.check_out || '') + '<br>Ответить можно в личном кабинете <a href="https://urbanluxe.cc/guest.html">urbanluxe.cc/guest.html</a> или в Telegram <a href="https://t.me/Arsen_bnb">@Arsen_bnb</a></p></div>';
        const rr = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.RESEND_FROM || 'Urban Luxe <booking@urbanluxe.cc>', to: [th.guest_email], subject: subj, html, text }) });
        mail = rr.ok ? { sent: true } : { sent: false, reason: 'resend ' + rr.status };
      } catch (e) { mail = { sent: false, reason: String(e.message || e) }; }
    } else mail = { sent: false, reason: th && th.guest_email ? 'no RESEND_API_KEY' : 'у гостя нет email' };
  }
  return { ok: true, mail };
}

// ---------- персонал (этап 6): staff, табель, выплаты, расчёт за месяц ----------
async function staffMonth(monthIso) {
  const m1 = addMonths(monthIso, 1);
  const [staff, att, pay, cl] = await Promise.all([
    q('staff?select=*&order=is_active.desc,name'),
    q('staff_attendance?select=*&work_date=gte.' + monthIso + '&work_date=lt.' + m1),
    q('staff_payments?select=*&payment_date=gte.' + monthIso + '&payment_date=lt.' + m1 + '&order=payment_date'),
    q('cleaning_tasks?select=date,hk_maid,done&date=gte.' + monthIso + '&date=lt.' + m1 + '&done=eq.true')
  ]);
  return { month: ym(monthIso), staff, attendance: att, payments: pay, cleanings: cl };
}
async function staffWrite(body, user) {
  const a = body.a;
  if (a === 'staff_save') {
    const rec = { name: String(body.name || '').trim(), role: body.role || 'cleaning', daily_rate: body.daily_rate == null || body.daily_rate === '' ? null : parseInt(body.daily_rate, 10), phone: body.phone || null, telegram_chat_id: body.telegram_chat_id ? String(body.telegram_chat_id) : null, is_active: body.is_active !== false };
    if (!rec.name) throw Object.assign(new Error('Имя обязательно'), { status: 400 });
    const r = body.id ? await T.sb('staff?id=eq.' + encodeURIComponent(body.id), { method: 'PATCH', body: JSON.stringify(rec) }) : await T.sb('staff', { method: 'POST', body: JSON.stringify(rec) });
    if (!r.ok) throw new Error('staff: ' + (await r.text()).slice(0, 200)); return r.json();
  }
  if (a === 'attendance') { // переключить день
    const rows = await q('staff_attendance?select=id,present&staff_id=eq.' + encodeURIComponent(body.staff_id) + '&work_date=eq.' + body.date);
    if (rows.length) { const r = await T.sb('staff_attendance?id=eq.' + rows[0].id, { method: 'PATCH', body: JSON.stringify({ present: body.present == null ? !rows[0].present : !!body.present, notes: body.notes || null }) }); return r.json(); }
    const r = await T.sb('staff_attendance', { method: 'POST', body: JSON.stringify({ staff_id: body.staff_id, work_date: body.date, present: body.present == null ? true : !!body.present, notes: body.notes || null }) }); return r.json();
  }
  if (a === 'staff_payment') { const r = await T.sb('staff_payments', { method: 'POST', body: JSON.stringify({ staff_id: body.staff_id, amount: parseInt(body.amount, 10) || 0, payment_date: body.payment_date || T.tashToday(0), notes: body.notes || null }) }); if (!r.ok) throw new Error('staff_payments: ' + (await r.text()).slice(0, 200)); return r.json(); }
  if (a === 'staff_payment_delete') { await T.sb('staff_payments?id=eq.' + encodeURIComponent(body.id), { method: 'DELETE' }); return { ok: true }; }
  throw Object.assign(new Error('unknown staff action'), { status: 400 });
}

async function bookingWithApt(id) {
  const rows = await q('bookings?select=*&id=eq.' + encodeURIComponent(id));
  const b = rows[0]; if (!b) { const e = new Error('Бронь не найдена'); e.status = 404; throw e; }
  const apt = (await q('apartments?select=id,name,complex,floor&id=eq.' + encodeURIComponent(b.apartment_id)))[0] || {};   // FK bookings→apartments нет, embed не работает
  return { b, apt };
}
const actorOf = user => (user.name || user.email) + (user.org && user.org.short ? ' (' + user.org.short + ')' : '');
async function logEvent(bookingId, type, payload, actor) {
  try { await T.sb('booking_events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ booking_id: bookingId, type, payload, actor }) }); } catch (e) { /* журнал не роняет действие */ }
}
async function requestConfirm(body, user) {
  const { b, apt } = await bookingWithApt(body.id);
  if (b.status !== 'request') { const e = new Error('Заявка уже обработана: ' + b.status); e.status = 409; throw e; }
  const now = new Date().toISOString();
  // Условие status=eq.request в самом PATCH — защита от двойного клика двух менеджеров: второй получит 0 строк
  const r = await T.sb('bookings?id=eq.' + encodeURIComponent(b.id) + '&status=eq.request', { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status: 'confirmed', confirmed_at: now, confirmed_by: user.email, updated_by: actorOf(user), updated_at: now }) });
  const upd = r.ok ? await r.json() : [];
  if (!upd.length) { const e = new Error('Заявка уже обработана'); e.status = 409; throw e; }
  const saved = Object.assign(b, upd[0]);
  await logEvent(b.id, 'request_confirmed', { by: user.email }, actorOf(user));
  const mail = await MAIL.mailConfirmed(saved, apt);
  const tg = await NOTIFY.sendTg({ type: 'request_confirmed', apartment: apt.name, guest_name: b.guest_name, check_in: b.check_in, check_out: b.check_out, total: b.total_price, ref: b.booking_ref, actor: user.name });
  return { ok: true, id: b.id, status: 'confirmed', mail, tg };
}
async function requestCancel(body, user) {
  const { b, apt } = await bookingWithApt(body.id);
  if (b.status !== 'request') { const e = new Error('Заявка уже обработана: ' + b.status); e.status = 409; throw e; }
  const reason = String(body.reason || '').trim().slice(0, 300);
  const now = new Date().toISOString();
  const r = await T.sb('bookings?id=eq.' + encodeURIComponent(b.id) + '&status=eq.request', { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status: 'cancelled', cancelled_at: now, cancel_reason: reason || null, updated_by: actorOf(user), updated_at: now }) });
  const upd = r.ok ? await r.json() : [];
  if (!upd.length) { const e = new Error('Заявка уже обработана'); e.status = 409; throw e; }
  await logEvent(b.id, 'request_cancelled', { by: user.email, reason }, actorOf(user));
  const mail = await MAIL.mailCancelled(b, apt, reason);
  const tg = await NOTIFY.sendTg({ type: 'request_cancelled', apartment: apt.name, guest_name: b.guest_name, check_in: b.check_in, check_out: b.check_out, ref: b.booking_ref, reason, actor: user.name });
  return { ok: true, id: b.id, status: 'cancelled', mail, tg };
}

// ---------- базовые выборки ----------
async function apartments() {
  const list = await q('apartments?select=id,name,complex,floor,rooms,weekday_price,weekend_price,is_active&order=complex,name');
  list.forEach(a => { a.short = (a.complex || '') + ' ' + String(a.name || '').replace(/\D/g, ''); });
  return list;
}
async function termsAll() { return q('apartment_terms?select=*,partners(id,name)&order=apartment_id,valid_from.desc'); }
function termFor(terms, aptId, monthIso) {
  const m = monthIso || T.tashToday(0);
  return terms.find(t => t.apartment_id === aptId && t.valid_from <= m && (!t.valid_to || t.valid_to >= m)) || terms.find(t => t.apartment_id === aptId) || null;
}

// Выручка за месяц по квартирам: ручная запись > импорт > живые данные листа заездов (daily_ops.payment_total по дате заезда)
async function monthRevenue(from, to) { // from/to — первые числа месяцев, включительно
  const toEnd = addMonths(to, 1);
  const [fin, ops] = await Promise.all([
    q('finance_monthly?select=apartment_id,apt_label,month,revenue,rent,commission,nights,profit,is_partner,source&month=gte.' + from + '&month=lt.' + toEnd),
    q('daily_ops?select=apartment_id,date,payment_total,payment_paid,source,check_out_date&date=gte.' + from + '&date=lt.' + toEnd + '&limit=5000')
  ]);
  const map = {}; // key apt|month → {revenue, rent, commission, nights, source}
  const put = (apt, mo, rec) => { map[apt + '|' + mo] = rec; };
  // живые данные
  const live = {};
  ops.forEach(o => { if (!o.apartment_id) return; const k = o.apartment_id + '|' + ym(o.date); live[k] = live[k] || { revenue: 0, paid: 0, nights: 0, stays: 0 }; live[k].revenue += n(o.payment_total); live[k].paid += n(o.payment_paid); live[k].stays++; if (o.check_out_date) live[k].nights += Math.max(0, (new Date(o.check_out_date) - new Date(o.date)) / 864e5); });
  Object.keys(live).forEach(k => { const [apt, mo] = k.split('|'); put(apt, mo, Object.assign({ apartment_id: apt, month: mo, rent: null, commission: 0, source: 'live' }, live[k])); });
  // импорт поверх живых (история), ручные поверх всего
  const order = { import: 1, manual: 2 };
  fin.sort((a, b) => (order[a.source] || 0) - (order[b.source] || 0)).forEach(f => {
    const apt = f.apartment_id || ('label:' + f.apt_label);
    const prev = map[apt + '|' + ym(f.month)];
    if (prev && prev.source === 'manual' && f.source !== 'manual') return;
    put(apt, ym(f.month), { apartment_id: f.apartment_id, apt_label: f.apt_label, month: ym(f.month), revenue: n(f.revenue), rent: n(f.rent), commission: n(f.commission), nights: n(f.nights), profit_sheet: n(f.profit), is_partner: !!f.is_partner, source: f.source, live: prev && prev.source === 'live' ? prev : null });
  });
  return map;
}

async function expensesBetween(from, to) {
  const toEnd = addMonths(to, 1);
  return q('expenses?select=*&expense_date=gte.' + from + '&expense_date=lt.' + toEnd + '&order=expense_date.desc&limit=5000');
}
async function categories() { return q('expense_categories?select=*&order=sort'); }

// ---------- P&L ----------
async function pl(from, to) {
  const [rev, exps, cats, terms, apts, mkt] = await Promise.all([monthRevenue(from, to), expensesBetween(from, to), categories(), termsAll(), apartments(), q('marketing_spend?select=spend_date,channel,amount_usd,clicks,tg_clicks,leads,bookings&spend_date=gte.' + from + '&spend_date=lt.' + addMonths(to, 1))]);
  const kind = {}; cats.forEach(c => { kind[c.code] = c.kind; });
  const months = []; for (let m = from; m <= to; m = addMonths(m, 1)) months.push(ym(m));
  const rows = months.map(mo => {
    const recs = Object.values(rev).filter(r => r.month === mo);
    const partnerRecs = recs.filter(r => { if (r.is_partner != null) return r.is_partner; const t = termFor(terms, r.apartment_id, mo + '-01'); return t && t.model === 'partner'; });
    const sum = (arr, k) => arr.reduce((s, r) => s + n(r[k]), 0);
    // аренда: из записи месяца, если нет — из условий квартиры
    const rentOf = r => r.rent != null && r.rent !== 0 ? n(r.rent) : (r.apartment_id ? n((termFor(terms, r.apartment_id, mo + '-01') || {}).rent) : 0);
    const rent = recs.reduce((s, r) => s + rentOf(r), 0);
    const e = exps.filter(x => ym(x.expense_date) === mo);
    const byCat = {}; const byKind = {};
    e.forEach(x => { const c = x.category || 'other'; byCat[c] = (byCat[c] || 0) + n(x.amount); const k = kind[c] || 'other'; byKind[k] = (byKind[k] || 0) + n(x.amount); });
    const revenue = sum(recs, 'revenue'), commission = sum(recs, 'commission');
    const opex = (byKind.opex || 0) + (byKind.payroll || 0) + (byKind.marketing || 0) + (byKind.platform || 0) + (byKind.other || 0) + (byKind.tax || 0);
    const capex = byKind.capex || 0;
    const mktSpend = mkt.filter(x => ym(x.spend_date) === mo).reduce((s, x) => s + n(x.amount_usd), 0);
    const gross = revenue - rent - commission;
    // доля партнёров: 50 % от (выручка − аренда − комиссия − общие расходы по их квартирам)
    const partnerShare = partnerRecs.reduce((s, r) => { const t = termFor(terms, r.apartment_id, mo + '-01'); const share = t && t.partner_share != null ? n(t.partner_share) : 50; const shared = e.filter(x => x.apartment_id === r.apartment_id && x.partner_shared).reduce((a, x) => a + n(x.amount), 0); return s + Math.max(0, (n(r.revenue) - rentOf(r) - n(r.commission) - shared)) * share / 100; }, 0);
    return {
      month: mo, apartments: recs.length, partner_apartments: partnerRecs.length,
      revenue: r2(revenue), rent: r2(rent), commission: r2(commission), gross: r2(gross),
      expenses_opex: r2(opex), expenses_capex: r2(capex), by_category: Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, r2(v)])), by_kind: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, r2(v)])),
      marketing_tracked: r2(mktSpend),
      ebitda: r2(gross - opex), partner_share: r2(partnerShare), net: r2(gross - opex - partnerShare),
      dividends: r2(byKind.dividend || 0), credit: r2(byKind.credit || 0),
      nights: recs.reduce((s, r) => s + n(r.nights), 0),
      sources: recs.reduce((acc, r) => { acc[r.source] = (acc[r.source] || 0) + 1; return acc; }, {})
    };
  });
  return { from: ym(from), to: ym(to), months: rows, categories: cats };
}

// ---------- квартиры ----------
async function aptTable(monthIso) {
  const m0 = monthIso, from = addMonths(m0, -2);
  const [apts, terms, rev, occ, exps] = await Promise.all([apartments(), termsAll(), monthRevenue(from, m0), q('occupancy_daily?select=apartment_id,date,busy&date=gte.' + m0 + '&date=lt.' + addMonths(m0, 1) + '&busy=eq.true&limit=5000'), expensesBetween(m0, m0)]);
  const dim = Math.round((new Date(addMonths(m0, 1)) - new Date(m0)) / 864e5);
  const busy = {}; occ.forEach(o => { busy[o.apartment_id] = (busy[o.apartment_id] || 0) + 1; });
  const rows = apts.map(a => {
    const t = termFor(terms, a.id, m0);
    const cur = rev[a.id + '|' + ym(m0)] || {};
    const hist = [0, 1, 2].map(k => rev[a.id + '|' + ym(addMonths(m0, -k))] || { revenue: 0 });
    const rent = cur.rent || n((t || {}).rent);
    const aptExp = exps.filter(e => e.apartment_id === a.id).reduce((s, e) => s + n(e.amount), 0);
    const gross = n(cur.revenue) - rent - n(cur.commission);
    return {
      id: a.id, short: a.short, complex: a.complex, name: a.name, rooms: a.rooms, floor: a.floor, is_active: a.is_active,
      model: (t || {}).model || 'sublease', partner: t && t.partners ? t.partners.name : null, partner_share: t ? t.partner_share : null, rent: r2(rent),
      lease_end: (t || {}).lease_end || null,
      revenue: r2(cur.revenue), commission: r2(cur.commission), nights: n(cur.nights), source: cur.source || null,
      expenses: r2(aptExp), gross: r2(gross), net: r2(gross - aptExp),
      ul_share: r2(t && t.model === 'partner' ? Math.max(0, gross - aptExp) * (100 - n(t.partner_share || 50)) / 100 : gross - aptExp),
      occupancy: Math.round(100 * (busy[a.id] || 0) / dim), busy_days: busy[a.id] || 0,
      revpar: r2(n(cur.revenue) / dim), adr: cur.nights ? r2(n(cur.revenue) / n(cur.nights)) : null,
      rev3: hist.map(h => r2(h.revenue)), price: a.weekday_price
    };
  });
  // квартиры из таблиц, которых нет в базе
  Object.values(rev).filter(r => r.month === ym(m0) && !r.apartment_id).forEach(r => rows.push({ id: null, short: r.apt_label, complex: '—', model: r.is_partner ? 'partner' : 'sublease', rent: r2(r.rent), revenue: r2(r.revenue), commission: r2(r.commission), nights: n(r.nights), gross: r2(n(r.revenue) - n(r.rent) - n(r.commission)), net: r2(n(r.revenue) - n(r.rent) - n(r.commission)), occupancy: null, rev3: [r2(r.revenue), 0, 0], source: r.source }));
  rows.sort((a, b) => n(b.revenue) - n(a.revenue));
  const tot = rows.reduce((s, r) => { s.revenue += n(r.revenue); s.rent += n(r.rent); s.gross += n(r.gross); s.net += n(r.net); s.ul += n(r.ul_share); s.busy += n(r.busy_days); s.active += r.is_active ? 1 : 0; return s; }, { revenue: 0, rent: 0, gross: 0, net: 0, ul: 0, busy: 0, active: 0 });
  tot.occupancy = tot.active ? Math.round(100 * tot.busy / (tot.active * dim)) : 0;
  return { month: ym(m0), days: dim, rows, totals: tot };
}

async function aptHistory(id) {
  const [a, terms, fin, exps, ops] = await Promise.all([q('apartments?select=*&id=eq.' + id), q('apartment_terms?select=*,partners(id,name)&apartment_id=eq.' + id + '&order=valid_from.desc'), q('finance_monthly?select=*&apartment_id=eq.' + id + '&order=month'), q('expenses?select=*&apartment_id=eq.' + id + '&order=expense_date.desc&limit=200'), q('daily_ops?select=date,check_out_date,guest_name,source,payment_total,payment_paid,checked_in,checked_out&apartment_id=eq.' + id + '&order=date.desc&limit=60')]);
  return { apartment: a[0] || null, terms, finance: fin, expenses: exps, stays: ops };
}

// ---------- партнёрский отчёт ----------
async function partnerReport(partnerId, monthIso) {
  const [terms, rev, exps, partners] = await Promise.all([termsAll(), monthRevenue(monthIso, monthIso), expensesBetween(monthIso, monthIso), q('partners?select=*&id=eq.' + partnerId)]);
  const mine = terms.filter(t => t.partner_id === partnerId && t.model === 'partner' && t.valid_from <= addMonths(monthIso, 1) && (!t.valid_to || t.valid_to >= monthIso));
  const apts = await apartments();
  const rows = mine.map(t => {
    const a = apts.find(x => x.id === t.apartment_id) || {};
    const r = rev[t.apartment_id + '|' + ym(monthIso)] || {};
    const rent = r.rent || n(t.rent);
    const e = exps.filter(x => x.apartment_id === t.apartment_id);
    const shared = e.filter(x => x.partner_shared).reduce((s, x) => s + n(x.amount), 0);
    const profit = n(r.revenue) - rent - n(r.commission) - shared;
    const share = n(t.partner_share == null ? 50 : t.partner_share);
    return { apartment_id: t.apartment_id, short: a.short || t.apartment_id, revenue: r2(r.revenue), rent: r2(rent), commission: r2(r.commission), nights: n(r.nights), shared_expenses: r2(shared), expenses: e.map(x => ({ date: x.expense_date, category: x.category, amount: x.amount, description: x.description, shared: x.partner_shared })), profit: r2(profit), partner_share_pct: share, partner_amount: r2(profit * share / 100), ul_amount: r2(profit * (100 - share) / 100), source: r.source || null };
  });
  const tot = rows.reduce((s, r) => { ['revenue', 'rent', 'commission', 'shared_expenses', 'profit', 'partner_amount', 'ul_amount'].forEach(k => { s[k] = r2((s[k] || 0) + r[k]); }); return s; }, {});
  return { partner: partners[0] || null, month: ym(monthIso), rows, totals: tot };
}

// ---------- дашборд ----------
async function dashboard() {
  const today = T.tashToday(0), m0 = today.slice(0, 7) + '-01', from = addMonths(m0, -12);
  const [p, tbl, ops, occ14, mkt] = await Promise.all([
    pl(from, m0), aptTable(m0),
    q('daily_ops?select=id,apartment_id,date,check_out_date,checked_in,checked_out,payment_total,payment_paid,source,guest_name&date=gte.' + addMonths(m0, -1) + '&order=date.desc&limit=400'),
    q('occupancy_daily?select=date,busy&busy=eq.true&date=gte.' + today + '&date=lt.' + T.tashToday(14) + '&limit=5000'),
    q('marketing_spend?select=spend_date,channel,amount_usd,tg_clicks,leads&spend_date=gte.' + m0)
  ]);
  const cur = p.months[p.months.length - 1], prev = p.months[p.months.length - 2] || {};
  const debt = ops.filter(o => n(o.payment_total) > n(o.payment_paid)).reduce((s, o) => s + n(o.payment_total) - n(o.payment_paid), 0);
  const inToday = ops.filter(o => o.date === today).length, outToday = ops.filter(o => o.check_out_date === today).length;
  const active = tbl.totals.active || 1;
  const occByDay = {}; occ14.forEach(o => { occByDay[o.date] = (occByDay[o.date] || 0) + 1; });
  const occ14arr = []; for (let i = 0; i < 14; i++) { const d = T.tashToday(i); occ14arr.push({ date: d, pct: Math.round(100 * (occByDay[d] || 0) / active) }); }
  const mktSum = mkt.reduce((s, x) => { s.amount += n(x.amount_usd); s.tg += n(x.tg_clicks); s.leads += n(x.leads); return s; }, { amount: 0, tg: 0, leads: 0 });
  return {
    today, month: ym(m0), current: cur, previous: prev, series: p.months, apartments: tbl.totals,
    top: tbl.rows.slice(0, 5).map(r => ({ short: r.short, revenue: r.revenue, net: r.net, occupancy: r.occupancy })),
    bottom: tbl.rows.filter(r => r.id && r.is_active).slice(-5).map(r => ({ short: r.short, revenue: r.revenue, net: r.net, occupancy: r.occupancy })),
    ops: { checkins_today: inToday, checkouts_today: outToday, debt: r2(debt), debtors: ops.filter(o => n(o.payment_total) > n(o.payment_paid)).slice(0, 10).map(o => ({ apt: o.apartment_id, date: o.date, guest: o.guest_name, due: r2(n(o.payment_total) - n(o.payment_paid)) })) },
    occupancy14: occ14arr, marketing: mktSum
  };
}

// ---------- операционка ----------
async function opsToday() {
  const today = T.tashToday(0);
  const [apts, ops, cl, occ] = await Promise.all([apartments(), q('daily_ops?select=*&or=(date.eq.' + today + ',check_out_date.eq.' + today + ',date.eq.' + T.tashToday(1) + ')&order=date'), q('cleaning_tasks?select=*&date=eq.' + today), q('occupancy_daily?select=apartment_id,date&busy=eq.true&date=gte.' + today + '&date=lt.' + T.tashToday(14) + '&limit=5000')]);
  const byApt = {}; apts.forEach(a => { byApt[a.id] = a.short; });
  const grid = {}; occ.forEach(o => { grid[o.apartment_id] = grid[o.apartment_id] || {}; grid[o.apartment_id][o.date] = 1; });
  return { today, checkins: ops.filter(o => o.date === today).map(o => Object.assign({ short: byApt[o.apartment_id] }, o)), checkouts: ops.filter(o => o.check_out_date === today).map(o => Object.assign({ short: byApt[o.apartment_id] }, o)), tomorrow: ops.filter(o => o.date === T.tashToday(1)).map(o => Object.assign({ short: byApt[o.apartment_id] }, o)), cleaning: cl.map(c => Object.assign({ short: byApt[c.apartment_id] }, c)), grid: apts.filter(a => a.is_active).map(a => ({ id: a.id, short: a.short, days: Array.from({ length: 14 }, (_, i) => (grid[a.id] || {})[T.tashToday(i)] ? 1 : 0) })), days: Array.from({ length: 14 }, (_, i) => T.tashToday(i)) };
}

// ---------- импорт из Google-таблиц (пока бронеры ведут выручку там) ----------
const SHEETS = { main: '1NHqPZV8Dx2dKmfTCpb8LcdA4AtuqSfKyyyWs5UF2HtY', partner: '191ila7T-7dUWUfITNffd7yjUDXqUBwAcfqLS52V_MhU' };
async function fetchCsv(bookId, sheetName, gid) {
  const url = 'https://docs.google.com/spreadsheets/d/' + bookId + '/gviz/tq?tqx=out:csv&' + (gid ? 'gid=' + gid : 'sheet=' + encodeURIComponent(sheetName));
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error('sheet ' + sheetName + ': ' + r.status);
  return r.text();
}
function parseCsvLine(l) { return (l.match(/("([^"]*)"|[^,]*)(,|$)/g) || []).map(c => c.replace(/,$/, '').replace(/^"|"$/g, '')); }
const numS = s => { if (!s) return 0; const v = parseFloat(String(s).replace(/[$\s %]/g, '').replace(',', '.')); return isNaN(v) ? 0 : v; };
function parseMonthlySheet(csv, isPartner) {
  const rows = csv.split('\n').map(parseCsvLine);
  const years = rows[0].slice(1); const months = []; let m = 0, prev = '';
  for (let i = 0; i < years.length; i++) { const y = (years[i] || '').trim(); if (!y) continue; if (y !== prev) { m = y === '2025' ? 12 : 1; prev = y; } if (m >= 1 && m <= 12) months.push({ i: i + 1, ym: y + '-' + String(m).padStart(2, '0') }); m++; }
  const out = []; let cur = null;
  for (const r of rows) {
    const nm = (r[0] || '').trim(); if (!nm) continue;
    if (/^(Количество|Итого|Год|Аппартамент)/.test(nm)) { if (/^(Количество|Итого)/.test(nm)) break; continue; }
    if (!/^(Аренда|Комиссия|Кол-во|Прибыль)/.test(nm)) { cur = { name: nm.replace(/\s+/g, ' '), rev: r }; out.push(cur); }
    else if (cur) { if (/^Аренда/.test(nm)) cur.rent = r; if (/^Комиссия/.test(nm)) cur.com = r; if (/^Кол-во/.test(nm)) cur.nig = r; if (/^Прибыль/.test(nm)) cur.pr = r; }
  }
  const recs = [];
  for (const a of out) for (const mo of months) {
    const rev = numS(a.rev[mo.i]), rent = numS((a.rent || [])[mo.i]), com = numS((a.com || [])[mo.i]), nig = numS((a.nig || [])[mo.i]), pr = numS((a.pr || [])[mo.i]);
    if (!rev && !rent && !pr && !nig) continue;
    recs.push({ apt_label: a.name, month: mo.ym + '-01', revenue: rev, rent, commission: com, nights: Math.round(nig), profit: pr, is_partner: !!isPartner, source: 'import' });
  }
  return recs;
}
async function importSheets() {
  const [m, p] = await Promise.all([fetchCsv(SHEETS.main, 'Месяц'), fetchCsv(SHEETS.partner, null, '1256424830')]);
  const recs = [...parseMonthlySheet(m, false), ...parseMonthlySheet(p, true)];
  // сопоставление с apartments через SQL-функцию admin3_map_apt (rpc) — проще: берём существующие сопоставления
  const known = await q('finance_monthly?select=apt_label,apartment_id&source=eq.import&apartment_id=not.is.null');
  const map = {}; known.forEach(k => { map[k.apt_label] = k.apartment_id; });
  recs.forEach(r => { r.apartment_id = map[r.apt_label] || null; r.updated_at = new Date().toISOString(); });
  let n = 0;
  for (let i = 0; i < recs.length; i += 200) {
    const r = await T.sb('finance_monthly?on_conflict=apt_label,month,source', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' }, body: JSON.stringify(recs.slice(i, i + 200)) });
    if (!r.ok) throw new Error('upsert: ' + (await r.text()).slice(0, 200));
    n += Math.min(200, recs.length - i);
  }
  // досопоставить новые названия с квартирами (SQL-функция admin3_map_apt)
  await T.sb('rpc/admin3_remap', { method: 'POST', body: '{}' });
  const still = await q('finance_monthly?select=apt_label&source=eq.import&apartment_id=is.null');
  return { ok: true, imported: n, months: [...new Set(recs.map(r => r.month))].sort(), unmapped: [...new Set(still.map(s => s.apt_label))] };
}

// ---------- запись ----------
async function write(body, user) {
  const a = body.a;
  if (a === 'import_sheets') return importSheets();
  if (a === 'expense') {
    const rec = { apartment_id: body.apartment_id || null, amount: n(body.amount), category: body.category || 'other', description: body.description || '', expense_date: body.expense_date || T.tashToday(0), currency: body.currency || 'USD', amount_uzs: body.amount_uzs ? n(body.amount_uzs) : null, partner_shared: !!body.partner_shared, vendor: body.vendor || '', paid_by: body.paid_by || '', created_by: user.email };
    if (body.id) { const r = await T.sb('expenses?id=eq.' + body.id, { method: 'PATCH', body: JSON.stringify(rec) }); return r.json(); }
    const r = await T.sb('expenses', { method: 'POST', body: JSON.stringify(rec) }); return r.json();
  }
  if (a === 'expense_delete') { await T.sb('expenses?id=eq.' + body.id, { method: 'DELETE' }); return { ok: true }; }
  if (a === 'term') {
    const rec = { apartment_id: body.apartment_id, valid_from: body.valid_from || monthStart(), valid_to: body.valid_to || null, model: body.model || 'sublease', rent: n(body.rent), partner_id: body.partner_id || null, partner_share: body.partner_share == null ? 50 : n(body.partner_share), mgmt_fee_pct: body.mgmt_fee_pct == null ? null : n(body.mgmt_fee_pct), deposit: n(body.deposit), launch_cost: n(body.launch_cost), lease_start: body.lease_start || null, lease_end: body.lease_end || null, owner_name: body.owner_name || '', owner_phone: body.owner_phone || '', notes: body.notes || '', updated_at: new Date().toISOString() };
    if (body.id) { const r = await T.sb('apartment_terms?id=eq.' + body.id, { method: 'PATCH', body: JSON.stringify(rec) }); return r.json(); }
    const r = await T.sb('apartment_terms', { method: 'POST', body: JSON.stringify(rec) }); return r.json();
  }
  if (a === 'term_delete') { await T.sb('apartment_terms?id=eq.' + body.id, { method: 'DELETE' }); return { ok: true }; }
  if (a === 'partner') {
    const rec = { name: body.name, phone: body.phone || '', email: body.email || '', telegram: body.telegram || '', default_share: body.default_share == null ? 50 : n(body.default_share), notes: body.notes || '', is_active: body.is_active !== false };
    if (body.id) { const r = await T.sb('partners?id=eq.' + body.id, { method: 'PATCH', body: JSON.stringify(rec) }); return r.json(); }
    const r = await T.sb('partners', { method: 'POST', body: JSON.stringify(rec) }); return r.json();
  }
  if (a === 'marketing') {
    const rec = { spend_date: body.spend_date, channel: body.channel, campaign: body.campaign || '', amount_usd: n(body.amount_usd), impressions: n(body.impressions), clicks: n(body.clicks), tg_clicks: n(body.tg_clicks), leads: n(body.leads), bookings: n(body.bookings), notes: body.notes || '' };
    const r = await T.sb('marketing_spend?on_conflict=spend_date,channel,campaign', { method: 'POST', headers: { Prefer: 'return=representation,resolution=merge-duplicates' }, body: JSON.stringify(rec) }); return r.json();
  }
  if (a === 'marketing_delete') { await T.sb('marketing_spend?id=eq.' + body.id, { method: 'DELETE' }); return { ok: true }; }
  if (a === 'finance') {
    const apt = body.apartment_id ? (await q('apartments?select=id,name,complex&id=eq.' + body.apartment_id))[0] : null;
    const label = body.apt_label || (apt ? (apt.complex + ' ' + String(apt.name).replace(/\D/g, '')) : null);
    if (!label) return { error: 'apartment_id or apt_label required' };
    const rec = { apartment_id: body.apartment_id || null, apt_label: label, month: monthStart(body.month), revenue: n(body.revenue), rent: n(body.rent), commission: n(body.commission), nights: n(body.nights), profit: n(body.revenue) - n(body.rent) - n(body.commission), is_partner: !!body.is_partner, source: 'manual', notes: body.notes || '', updated_at: new Date().toISOString() };
    const r = await T.sb('finance_monthly?on_conflict=apt_label,month,source', { method: 'POST', headers: { Prefer: 'return=representation,resolution=merge-duplicates' }, body: JSON.stringify(rec) }); return r.json();
  }
  if (a === 'finance_delete') { await T.sb('finance_monthly?id=eq.' + body.id, { method: 'DELETE' }); return { ok: true }; }
  if (a === 'cash') {
    const rec = { month: monthStart(body.month), opening: n(body.opening), closing: n(body.closing), closing_fact: body.closing_fact == null ? null : n(body.closing_fact), notes: body.notes || '' };
    const r = await T.sb('cash_monthly?on_conflict=month', { method: 'POST', headers: { Prefer: 'return=representation,resolution=merge-duplicates' }, body: JSON.stringify(rec) }); return r.json();
  }
  if (a === 'user' && user.role === 'admin') {
    const rec = { email: String(body.email || '').toLowerCase(), role: ['admin','booker','ops','partner'].includes(body.role) ? body.role : 'booker', name: body.name || '', partner_id: body.partner_id || null };
    const r = await T.sb('app_users?on_conflict=email', { method: 'POST', headers: { Prefer: 'return=representation,resolution=merge-duplicates' }, body: JSON.stringify(rec) }); return r.json();
  }
  return { error: 'unknown action' };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: H, body: '' };
  try {
    const user = await auth(event);
    if (!user) return out(401, { error: 'unauthorized' });
    const qs = event.queryStringParameters || {};
    const me = { email: user.email, role: user.role, name: user.name, org: user.org, partner_id: user.partner_id };
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      // Заявки: admin, booker и ops. Остальная запись — только admin и booker.
      if (body.a === 'request_confirm') { if (!['admin', 'booker', 'ops'].includes(user.role)) return out(403, { error: 'Нет прав' }); return out(200, await requestConfirm(body, user)); }
      if (body.a === 'request_cancel') { if (!['admin', 'booker', 'ops'].includes(user.role)) return out(403, { error: 'Нет прав' }); return out(200, await requestCancel(body, user)); }
      if (body.a === 'chat_send') { if (!['admin', 'booker', 'ops'].includes(user.role)) return out(403, { error: 'Нет прав' }); return out(200, await chatSend(body, user)); }
      if (body.a === 'attendance') { if (!['admin', 'booker', 'ops'].includes(user.role)) return out(403, { error: 'Нет прав' }); return out(200, await staffWrite(body, user)); }
      if (['staff_save', 'staff_payment', 'staff_payment_delete'].includes(body.a)) { if (user.role !== 'admin') return out(403, { error: 'Нет прав' }); return out(200, await staffWrite(body, user)); }
      if (body.a === 'pms_user_save') { if (user.role !== 'admin') return out(403, { error: 'Нет прав' }); return out(200, await PMS.userSaveFor(body, user)); }
      if (body.a === 'pms_user_logout_all') { if (user.role !== 'admin') return out(403, { error: 'Нет прав' }); return out(200, await PMS.userLogoutAllFor(body, user)); }
      if (['ops_toggle', 'ops_patch', 'ops_add'].includes(body.a)) { if (!['admin', 'booker', 'ops'].includes(user.role)) return out(403, { error: 'Нет прав' }); return out(200, body.a === 'ops_toggle' ? await opsToggle(body, user) : body.a === 'ops_patch' ? await opsPatch(body, user) : await opsAddRow(body, user)); }
      if (['viewer', 'ops', 'partner'].includes(user.role)) return out(403, { error: 'Только чтение' });
      if (body.a === 'apt_save') return out(200, await aptSave(body, user));
      if (body.a === 'apt_photos') return out(200, await aptPhotos(body));
      if (body.a === 'checkin_save') return out(200, await checkinSave(body));
      return out(200, await write(body, user));
    }
    const a = qs.a || 'me';
    const month = monthStart(qs.month);
    // партнёр видит только свой отчёт
    if (user.role === 'partner') {
      if (a === 'partner_report') return out(200, await partnerReport(user.partner_id, month));
      if (a === 'me') return out(200, me);
      return out(403, { error: 'partner access only' });
    }
    // опер-менеджер: без денег собственника (P&L, финансы, партнёры) и без доступов
    if (user.role === 'ops' && ['pl', 'finance', 'partner_report', 'partners', 'users', 'cash', 'terms'].includes(a)) return out(403, { error: 'Нет прав' });
    switch (a) {
      case 'me': return out(200, me);
      case 'requests': return out(200, await requests());
      case 'kpi': return out(200, await kpi(month));
      case 'today': return out(200, await PMS.todayFor(user));
      case 'occ14': return out(200, await occ14());
      case 'analytics': return out(200, await analytics(qs.from, qs.to));
      case 'chat_list': return out(200, await chatList());
      case 'chat_msgs': return out(200, await chatMsgs(qs.id));
      case 'staff_month': { const r = await staffMonth(month); if (user.role !== 'admin') { r.payments = []; r.staff = r.staff.map(x => Object.assign({}, x, { daily_rate: null })); } return out(200, r); }
      case 'pms_users': if (user.role !== 'admin') return out(403, { error: 'Нет прав' }); return out(200, await PMS.usersFor(user));
      case 'ops_day': return out(200, await opsDay(qs.date));
      case 'map': return out(200, await mapData(qs.d0, qs.days));
      case 'apt_list': return out(200, await aptList());
      case 'apt': return out(200, await aptOne(qs.id));
      case 'dashboard': return out(200, await dashboard());
      case 'pl': { const from = monthStart(qs.from || ym(addMonths(month, -11))), to = monthStart(qs.to || ym(month)); return out(200, await pl(from, to)); }
      case 'apartments': return out(200, await aptTable(month));
      case 'apartment': return out(200, await aptHistory(qs.id));
      case 'expenses': { const f = ['select=*', 'order=expense_date.desc', 'limit=1000']; if (qs.month) { f.push('expense_date=gte.' + month, 'expense_date=lt.' + addMonths(month, 1)); } if (qs.apartment_id) f.push('apartment_id=eq.' + qs.apartment_id); return out(200, await q('expenses?' + f.join('&'))); }
      case 'categories': return out(200, await categories());
      case 'terms': return out(200, await termsAll());
      case 'partners': return out(200, await q('partners?select=*&order=name'));
      case 'partner_report': return out(200, await partnerReport(qs.partner_id, month));
      case 'marketing': { const from = monthStart(qs.from || ym(addMonths(month, -2))), to = monthStart(qs.to || ym(month)); return out(200, await q('marketing_spend?select=*&spend_date=gte.' + from + '&spend_date=lt.' + addMonths(to, 1) + '&order=spend_date.desc')); }
      case 'finance': return out(200, await q('finance_monthly?select=*&order=month.desc,apt_label&limit=2000' + (qs.month ? '&month=eq.' + month : '')));
      case 'cash': return out(200, await q('cash_monthly?select=*&order=month'));
      case 'ops': return out(200, await opsToday());
      case 'users': return out(200, user.role === 'admin' ? await q('app_users?select=*&order=email') : []);
      case 'apts': return out(200, await apartments());
      default: return out(400, { error: 'unknown action ' + a });
    }
  } catch (e) {
    return out(e.status || 500, { error: String(e.message || e) });
  }
};
