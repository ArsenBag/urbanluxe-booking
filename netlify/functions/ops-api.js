// Urban Luxe — ops-api.js (01.10.2026). API для Mini App «Лист заездов» (public/ops.html) внутри бота бронеров.
// Авторизация: Telegram initData (подпись HMAC токеном бота) → staff.telegram_chat_id с ролью booker/ops, либо админ.
// GET  ?date=YYYY-MM-DD&initData=…   → { date, staff, rows:[…все квартиры с занятостью и полями daily_ops…], month:{дни с заездами} }
// POST { initData, date, apartment_id, patch:{…} }  → upsert строки daily_ops
// POST { initData, date, from, to } (dates) → занятость всех квартир на период (для календаря/шахматки)
// POST { initData, free:{from,to,filter:{rooms,complex,max}} } → свободные на даты (+ готовый текст клиенту)
// POST { initData, book:{apartment_id,check_in,check_out,guest_name,guest_phone,guest_telegram,guest_whatsapp,total_price,source,guests_count,notes} }
//      → бронь в bookings (status=confirmed → закрывает даты на сайте и в iCal для RC) + строка daily_ops + уведомление Арсену/опер-менеджеру

const crypto = require('crypto');
const T = require('./_tg.js');
const OPS = require('./ops.js');
const { buildFree } = require('./free.js');

const H = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const out = (code, body) => ({ statusCode: code, headers: H, body: JSON.stringify(body) });

function verify(initData) {
  const token = T.TOKENS.booker;
  if (!initData || !token) return null;
  const p = new URLSearchParams(initData);
  const hash = p.get('hash'); if (!hash) return null;
  p.delete('hash');
  const check = [...p.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => k + '=' + v).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const sig = crypto.createHmac('sha256', secret).update(check).digest('hex');
  if (sig !== hash) return null;
  const age = Date.now() / 1000 - Number(p.get('auth_date') || 0);
  if (age > 86400 * 7) return null;
  try { return JSON.parse(p.get('user') || '{}'); } catch (e) { return null; }
}

async function staffOf(user) {
  if (!user || !user.id) return null;
  const id = String(user.id);
  if (id === T.ADMIN) return { id: null, name: 'Админ', role: 'admin', chat_id: id };
  const r = await T.sb('staff?select=id,name,role&is_active=eq.true&telegram_chat_id=eq.' + id).then(x => x.json()).catch(() => []);
  const s = r[0];
  if (!s || ['booker', 'ops'].indexOf(s.role) < 0) return null;
  s.chat_id = id; return s;
}

const FIELDS = ['checked_in', 'checked_out', 'deposit_received', 'deposit_returned', 'deposit_amount', 'source', 'checkin_time', 'checkout_time', 'guests', 'passport', 'access', 'registration', 'reg_sent', 'confirm_checkin', 'confirm_checkout', 'payment_total', 'payment_paid', 'review', 'note', 'guest_name'];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: H, body: '' };
  try {
    const q = event.queryStringParameters || {};
    const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
    const user = verify(body.initData || q.initData);
    const staff = await staffOf(user);
    if (!staff) return out(403, { error: 'no access', user_id: user && user.id });

    const base = process.env.URL || 'https://urbanluxe.cc';
    const ical = await fetch(base + '/.netlify/functions/sync-ical').then(r => r.json()).catch(() => ({ all_bookings: [] }));
    const all = ical.all_bookings || [];

    if (event.httpMethod === 'POST' && body.patch) {
      const date = body.date, aptId = body.apartment_id;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !aptId) return out(400, { error: 'bad request' });
      const patch = {}; FIELDS.forEach(k => { if (k in body.patch) patch[k] = body.patch[k]; });
      patch.updated_by = staff.name; patch.updated_at = new Date().toISOString(); patch.auto = false;
      const ex = await T.sb('daily_ops?select=id&date=eq.' + date + '&apartment_id=eq.' + encodeURIComponent(aptId)).then(x => x.json());
      let r;
      if (ex.length) r = await T.sb('daily_ops?id=eq.' + ex[0].id, { method: 'PATCH', body: JSON.stringify(patch) });
      else r = await T.sb('daily_ops', { method: 'POST', body: JSON.stringify([Object.assign({ date, apartment_id: aptId }, patch)]) });
      if (!r.ok) return out(500, { error: 'save failed: ' + (await r.text()).slice(0, 200) });
      // уведомить опер-менеджера об отметке бронера
      if (staff.role === 'booker') {
        const bot = T.makeBot('booker', 'tg-free');
        const ops = await T.sb('staff?select=telegram_chat_id&is_active=eq.true&role=eq.ops&telegram_chat_id=not.is.null').then(x => x.json()).catch(() => []);
        const ids = new Set(ops.map(o => o.telegram_chat_id)); if (T.ADMIN) ids.add(T.ADMIN);
        const apt = (await T.sb('apartments?select=name,complex&id=eq.' + encodeURIComponent(aptId)).then(x => x.json()))[0] || { name: aptId };
        const what = Object.keys(patch).filter(k => FIELDS.indexOf(k) > -1).map(k => k + '=' + patch[k]).join(', ');
        for (const id of ids) if (id !== staff.chat_id) await bot.send(id, '🔔 <b>' + T.esc(apt.name) + ' · ' + T.esc(apt.complex || '') + '</b> ' + T.ruDate(date) + ': ' + T.esc(what) + ' <i>(' + T.esc(staff.name) + ')</i>');
      }
      return out(200, { ok: true });
    }

    // свободные на даты (вкладка «Свободно» в Mini App)
    if (body.free) {
      const res = await buildFree(body.free.from, body.free.to, { filter: body.free.filter || {} });
      return out(200, res);
    }

    // создать бронь
    if (body.book) {
      const b = body.book;
      const ci = b.check_in, co = b.check_out;
      if (!b.apartment_id || !/^\d{4}-\d{2}-\d{2}$/.test(ci || '') || !/^\d{4}-\d{2}-\d{2}$/.test(co || '') || co <= ci) return out(400, { error: 'Неверные даты' });
      if (!String(b.guest_name || '').trim() || !String(b.guest_phone || '').trim()) return out(400, { error: 'Нужны имя и телефон гостя' });
      if (!String(b.guest_telegram || '').trim() && !String(b.guest_whatsapp || '').trim()) return out(400, { error: 'Укажи Telegram или WhatsApp гостя' });
      const busy = all.some(x => x.apartment_id === b.apartment_id && x.check_in < co && x.check_out > ci);
      const siteBusy = await T.sb('bookings?select=id&status=eq.confirmed&apartment_id=eq.' + encodeURIComponent(b.apartment_id) + '&check_in=lt.' + co + '&check_out=gt.' + ci).then(x => x.json());
      if (busy || siteBusy.length) return out(409, { error: 'Даты уже заняты (RC или сайт)' });
      const apt = (await T.sb('apartments?select=id,name,complex,weekday_price,weekend_price&id=eq.' + encodeURIComponent(b.apartment_id)).then(x => x.json()))[0];
      if (!apt) return out(404, { error: 'Квартира не найдена' });
      const nights = Math.round((new Date(co) - new Date(ci)) / 86400000);
      let total = parseInt(b.total_price, 10);
      if (!total) { total = 0; for (let d = ci; d < co; d = addDays(d, 1)) { const dow = new Date(d + 'T00:00:00Z').getUTCDay(); total += (dow === 5 || dow === 6) ? (apt.weekend_price || apt.weekday_price) : apt.weekday_price; } }
      const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let ref = 'UL-'; for (let i = 0; i < 6; i++) ref += A[Math.floor(Math.random() * A.length)];
      const row = {
        apartment_id: apt.id, guest_name: String(b.guest_name).trim(), guest_phone: String(b.guest_phone).trim(),
        guest_telegram: String(b.guest_telegram || '').trim() || null, guest_whatsapp: String(b.guest_whatsapp || '').trim() || null,
        check_in: ci, check_out: co, nights, guests_count: parseInt(b.guests_count, 10) || 2, status: 'confirmed',
        source: String(b.source || 'tg').slice(0, 32), total_price: total, booking_ref: ref, notes: String(b.notes || '').trim() || null,
        booker_name: staff.name, admin_notes: 'Создано из бота бронеров (' + staff.name + ')'
      };
      const ins = await T.sb('bookings', { method: 'POST', body: JSON.stringify([row]) });
      if (!ins.ok) return out(500, { error: 'Не сохранилось: ' + (await ins.text()).slice(0, 200) });
      // строка листа заездов на день заезда
      await T.sb('daily_ops', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' }, body: JSON.stringify([{ date: ci, apartment_id: apt.id, source: row.source, guest_name: row.guest_name, guests: row.guests_count, payment_total: total, auto: false, updated_by: staff.name }]) });
      // уведомление
      const bot = T.makeBot('booker', 'tg-free');
      const ops = await T.sb('staff?select=telegram_chat_id&is_active=eq.true&role=eq.ops&telegram_chat_id=not.is.null').then(x => x.json()).catch(() => []);
      const ids = new Set(ops.map(o => o.telegram_chat_id)); if (T.ADMIN) ids.add(T.ADMIN);
      const msg = '🆕 <b>Бронь из бота</b> · ' + T.esc(apt.name) + ' (' + T.esc(apt.complex || '') + ')\n📅 ' + T.ruDate(ci) + ' → ' + T.ruDate(co) + ' · ' + nights + ' ноч. · $' + total +
        '\n👤 ' + T.esc(row.guest_name) + ' · ' + T.esc(row.guest_phone) + (row.guest_telegram ? ' · TG ' + T.esc(row.guest_telegram) : '') + (row.guest_whatsapp ? ' · WA ' + T.esc(row.guest_whatsapp) : '') +
        '\n📍 ' + T.esc(OPS.SOURCES[row.source] || row.source) + ' · #' + ref + '\n✍️ ' + T.esc(staff.name);
      for (const id of ids) await bot.send(id, msg);
      return out(200, { ok: true, booking_ref: ref, total, nights });
    }

    // отчёт за период: выезды с оплатой/депозитом/отзывом (по строкам заезда)
    if (body.report) {
      const from = body.report.from, to = body.report.to;
      const stays = all.filter(b => b.check_out >= from && b.check_out <= to);
      const ids = new Set(stays.map(b => b.apartment_id));
      const opsRows = await T.sb('daily_ops?select=*&date=gte.' + addDays(from, -60) + '&date=lte.' + to).then(x => x.json()).catch(() => []);
      const byKey = {}; opsRows.forEach(r => { byKey[r.date + '|' + r.apartment_id] = r; });
      const apts = await T.sb('apartments?select=id,name,complex').then(x => x.json()); const an = {}; apts.forEach(a => { an[a.id] = a; });
      const list = stays.map(b => { const r = byKey[b.check_in + '|' + b.apartment_id] || {}; const a = an[b.apartment_id] || { name: b.apartment_id, complex: '' };
        return { apartment_id: b.apartment_id, name: a.name, complex: a.complex, check_in: b.check_in, check_out: b.check_out, nights: b.nights, source: r.source || null, guest_name: r.guest_name || null,
          payment_total: r.payment_total, payment_paid: r.payment_paid || 0, deposit_received: !!r.deposit_received, deposit_returned: !!r.deposit_returned, review: !!r.review, checked_in: !!r.checked_in, checked_out: !!r.checked_out, filled: !!r.id }; })
        .sort((x, y) => x.check_out < y.check_out ? -1 : x.check_out > y.check_out ? 1 : 0);
      const sum = { stays: list.length, nights: 0, total: 0, paid: 0, debt: 0, no_total: 0, deposit_open: 0, reviews: 0 };
      list.forEach(x => { sum.nights += x.nights || 0; if (x.payment_total != null) { sum.total += +x.payment_total; sum.paid += Math.min(+x.payment_paid, +x.payment_total); sum.debt += Math.max(0, +x.payment_total - +x.payment_paid); } else sum.no_total++; if (x.deposit_received && !x.deposit_returned) sum.deposit_open++; if (x.review) sum.reviews++; });
      const bySrc = {}; list.forEach(x => { const k = x.source || '—'; bySrc[k] = bySrc[k] || { n: 0, total: 0 }; bySrc[k].n++; bySrc[k].total += +(x.payment_total || 0); });
      return out(200, { from, to, list, sum, bySrc });
    }

    // занятость на период (шахматка)
    if (body.from && body.to) {
      const apts = await T.sb('apartments?select=id,name,complex,floor,rooms&is_active=eq.true&order=complex,name').then(x => x.json());
      const days = []; for (let d = body.from; d <= body.to && days.length < 62; d = addDays(d, 1)) days.push(d);
      const grid = apts.map(a => ({ id: a.id, name: a.name, complex: a.complex, rooms: a.rooms, days: days.map(d => { const b = all.find(x => x.apartment_id === a.id && x.check_in <= d && x.check_out > d); return b ? (b.check_in === d ? 'in' : 'busy') : ''; }) }));
      return out(200, { from: body.from, to: body.to, days, grid });
    }

    // день
    const date = /^\d{4}-\d{2}-\d{2}$/.test(q.date || body.date || '') ? (q.date || body.date) : T.tashToday(0);
    await OPS.ensureDay(date);
    const [apts, rowsRaw] = await Promise.all([
      T.sb('apartments?select=id,name,complex,floor,rooms,weekday_price,weekend_price&is_active=eq.true&order=complex,name').then(x => x.json()),
      T.sb('daily_ops?select=*&date=eq.' + date).then(x => x.json())
    ]);
    const ops = {}; rowsRaw.forEach(r => { ops[r.apartment_id] = r; });
    // выезды этого дня: строка листа берётся с даты заезда той же брони
    const outs = all.filter(b => b.check_out === date);
    const outRows = {};
    if (outs.length) {
      (await T.sb('daily_ops?select=*&or=(' + outs.map(b => 'and(date.eq.' + b.check_in + ',apartment_id.eq.' + b.apartment_id + ')').join(',') + ')').then(x => x.json()).catch(() => [])).forEach(r => { outRows[r.apartment_id] = r; });
    }
    const rows = apts.map(a => {
      const cur = all.find(b => b.apartment_id === a.id && b.check_in <= date && b.check_out > date);
      const inB = all.find(b => b.apartment_id === a.id && b.check_in === date);
      const outB = all.find(b => b.apartment_id === a.id && b.check_out === date);
      const next = all.filter(b => b.apartment_id === a.id && b.check_in > date).sort((x, y) => x.check_in < y.check_in ? -1 : 1)[0];
      return Object.assign({
        apartment_id: a.id, name: a.name, complex: a.complex, floor: a.floor, rooms: a.rooms,
        status: inB ? 'in' : cur ? 'busy' : outB ? 'out' : 'free',
        stay: cur ? { check_in: cur.check_in, check_out: cur.check_out, nights: cur.nights } : null,
        free_until: (!cur && next) ? next.check_in : null,
        checkout: outB ? Object.assign({ check_in: outB.check_in, nights: outB.nights }, outRows[a.id] ? pick(outRows[a.id]) : {}) : null
      }, ops[a.id] ? pick(ops[a.id]) : {});
    });
    // дни месяца с заездами (для календаря)
    const month = {}; all.forEach(b => { if (b.check_in.slice(0, 7) === date.slice(0, 7)) month[b.check_in] = (month[b.check_in] || 0) + 1; });
    return out(200, { date, staff: { name: staff.name, role: staff.role }, rows, month, sources: OPS.SOURCES, synced_at: ical.synced_at });
  } catch (e) {
    return out(500, { error: String(e.message || e) });
  }
};
function pick(r) { const o = {}; FIELDS.concat(['id', 'updated_by', 'updated_at']).forEach(k => { o[k] = r[k]; }); return o; }
function addDays(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
