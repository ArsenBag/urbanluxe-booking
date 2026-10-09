// Urban Luxe — sheet-sync.js (09.10.2026). Двусторонняя синхронизация листа заездов (daily_ops) с Google-таблицей
// «Лист бронера» (лист «Лист2»). Apps Script в таблице (sheets/UrbanLuxe-Zaezdy.gs) дёргает этот endpoint:
//   GET  ?key=…&from=&to=                              → строки daily_ops за период
//   POST {key, op:'update', id, field, value, who}      → правка одной ячейки (последняя запись побеждает)
//   POST {key, op:'add', date, apt, who}                → новая строка (apt — «U 171», «ю100», «Nest 481», «481»)
//   POST {key, op:'import', date, who, rows:[{apt, fields…}]} → разовый импорт существующих строк таблицы
// Ключ: app_settings.SHEET_SYNC_KEY (или env SHEET_SYNC_KEY). Логика полей — как в боте бронеров (ops.js).

const T = require('./_tg.js');
const OPS = require('./ops.js');
const H = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const out = (c, b) => ({ statusCode: c, headers: H, body: JSON.stringify(b) });
const addDays = (iso, k) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };

const SRC_AL = { airbnb: 'bnb', бнб: 'bnb', bnb: 'bnb', букинг: 'booking', booking: 'booking', тг: 'tg', tg: 'tg', телеграм: 'tg', telegram: 'tg', ватсап: 'wa', whatsapp: 'wa', wa: 'wa', сайт: 'site', site: 'site', инста: 'ig', instagram: 'ig', ig: 'ig', продление: 'ext', ext: 'ext', другое: 'other', other: 'other', ostrovok: 'other', островок: 'other', яндекс: 'other', yandex: 'other' };
const SRCL = { bnb: 'Airbnb', booking: 'Booking', tg: 'Telegram', wa: 'WhatsApp', site: 'Сайт', ig: 'Instagram', ext: 'Продление', other: 'Другое' };
function num(v) { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(',', '.')); return isNaN(n) ? null : n; }
function bool(v) { if (typeof v === 'boolean') return v; const s = String(v || '').trim().toLowerCase(); return ['true', '1', 'да', 'yes', '☑', '✓', 'v', '+'].includes(s); }
function timeStr(v) { if (v == null || v === '') return null; const s = String(v).trim(); if (/^\?+$/.test(s)) return null; const m = s.match(/(\d{1,2})[:.\/](\d{2})/); if (m) return m[1].padStart(2, '0') + ':' + m[2]; if (/^\d{1,2}$/.test(s)) return s.padStart(2, '0') + ':00'; return s.slice(0, 20); }
function dateStr(v) { if (!v) return null; const s = String(v).trim(); let m; if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] + '-' + m[2] + '-' + m[3]; if ((m = s.match(/^(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?/))) { const y = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : T.tashToday(0).slice(0, 4); return y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'); } return null; }

// поле → колонка daily_ops и нормализация
const FIELDS = {
  guest_name: v => String(v || '').trim() || null,
  guests: v => { const n = parseInt(v); return isNaN(n) ? null : n; },
  source: v => { const s = String(v || '').trim().toLowerCase(); return s ? (SRC_AL[s] || s) : null; },
  checkin_time: timeStr, checkout_time: timeStr, check_out_date: dateStr,
  payment_total: num, payment_paid: num, deposit_amount: num,
  passport: bool, access: bool, reg_sent: bool, checked_in: bool, checked_out: bool, deposit_received: bool, deposit_returned: bool, review: bool, confirm_checkin: bool, confirm_checkout: bool,
  registration: v => { if (typeof v === 'boolean') return v ? 'needed' : 'not_needed'; const s = String(v || '').trim().toLowerCase(); if (!s) return null; if (/сдел|done|☑|✓/.test(s)) return 'done'; if (/^(нет|не надо|не нужна|no|not)/.test(s)) return 'not_needed'; return 'needed'; },
  note: v => String(v || '').trim() || null
};

async function getKey() {
  if (process.env.SHEET_SYNC_KEY) return process.env.SHEET_SYNC_KEY;
  const r = await T.sb('app_settings?select=value&key=eq.SHEET_SYNC_KEY'); const rows = r.ok ? await r.json() : [];
  return rows.length ? rows[0].value : null;
}

function sheetShort(a) { // «U 171», «N 481», «K 31», «MA 111», «G 65», «MO 294» — как привыкли бронеры
  const num = (a.name || '').replace(/\D/g, ''); const c = (a.complex || '').toLowerCase();
  const p = c.indexOf('u-tower') === 0 ? 'U' : c.indexOf('nest') === 0 ? 'N' : c.indexOf('kislorod') === 0 ? 'K' : c.indexOf('mirabad') === 0 ? 'MA' : c.indexOf('gardens') === 0 ? 'G' : c.indexOf('modera') === 0 ? 'MO' : (a.complex || '').slice(0, 2).toUpperCase();
  return p + ' ' + num;
}
// «U 171», «ю171», «MA111», «Nest 481» → квартира
async function findApt(q) {
  const s = String(q || '').trim(); let c = await OPS.findApt(s);
  if (c.length > 1) { const w = s.replace(/[\d\s]/g, '').toLowerCase(); const map = { u: 'u-tower', ю: 'u-tower', n: 'nest', н: 'nest', k: 'kislorod', к: 'kislorod', ma: 'mirabad', ма: 'mirabad', m: 'mirabad', g: 'gardens', г: 'gardens', mo: 'modera', мо: 'modera' }; const key = Object.keys(map).sort((a, b) => b.length - a.length).find(k => w.indexOf(k) === 0); if (key) c = c.filter(a => (a.complex || '').toLowerCase().indexOf(map[key]) === 0); }
  return c;
}

async function rows(from, to) {
  const today = T.tashToday(0);
  for (let i = 0; i <= 7; i++) { const d = addDays(today, i); if (d >= from && d <= to) { try { await OPS.ensureDay(d); } catch (e) { /* не блокируем */ } } }
  const r = await T.sb('daily_ops?select=*&date=gte.' + from + '&date=lte.' + to + '&order=date,apartment_id&limit=5000');
  const list = r.ok ? await r.json() : [];
  const apts = await T.sb('apartments?select=id,name,complex').then(x => x.json());
  const byId = {}; apts.forEach(a => { byId[a.id] = a; });
  return list.map(x => {
    const a = byId[x.apartment_id] || { name: x.apartment_id, complex: '' };
    const status = x.checked_out ? 'Выехал' : x.date === today ? (x.checked_in ? 'Живёт' : 'Заезд') : x.date < today ? (x.checked_in ? 'Живёт' : 'Был заезд') : 'Бронь';
    return {
      id: x.id, date: x.date, apt: sheetShort(a), status, source: SRCL[x.source] || x.source || '', guest_name: x.guest_name || '',
      checkin_time: x.checkin_time || '', checkout_time: x.checkout_time || '', guests: x.guests || '',
      passport: !!x.passport, access: !!x.access, checked_in: !!x.checked_in, registration: x.registration === 'not_needed' ? 'Нет' : (x.registration ? 'Да' : ''), reg_sent: !!x.reg_sent || x.registration === 'done',
      confirm_checkin: !!x.confirm_checkin, confirm_checkout: !!x.confirm_checkout,
      payment_paid: x.payment_paid == null ? '' : Number(x.payment_paid), payment_total: x.payment_total == null ? '' : Number(x.payment_total),
      deposit_received: !!x.deposit_received, deposit_returned: !!x.deposit_returned, review: !!x.review, note: x.note || '',
      updated_by: (x.updated_by || '').replace(/^sheet:/, ''), check_out_date: x.check_out_date || '', checked_out: !!x.checked_out
    };
  });
}

// Блоки дня: заезды сегодня, выезды сегодня (по броням с check_out = сегодня, строка листа — от даты их заезда), заезды завтра
async function sections() {
  const today = T.tashToday(0), tomorrow = addDays(today, 1);
  const outs = await T.sb('bookings?select=id,apartment_id,check_in,check_out,guest_name,status&status=in.(confirmed,checked_in,request)&check_out=eq.' + today).then(x => x.ok ? x.json() : []);
  const dates = [...new Set([today, tomorrow].concat(outs.map(b => b.check_in)))];
  for (const d of dates) { try { await OPS.ensureDay(d); } catch (e) { /* не блокируем */ } }
  const all = await rows(dates.reduce((a, b) => a < b ? a : b), tomorrow);
  const byKey = {}; all.forEach(r => { byKey[r.date + '|' + r.apt] = r; });
  const apts = await T.sb('apartments?select=id,name,complex').then(x => x.json()); const byId = {}; apts.forEach(a => { byId[a.id] = a; });
  const outRows = outs.map(b => { const a = byId[b.apartment_id] || { name: b.apartment_id, complex: '' }; const r = byKey[b.check_in + '|' + sheetShort(a)]; if (!r) return null; return Object.assign({}, r, { status: r.checked_out ? 'Выехал' : 'Выезд', kind: 'out', booking_check_in: b.check_in }); }).filter(Boolean).sort((p, q) => p.apt.localeCompare(q.apt));
  const ruD = d => d.slice(8, 10) + '.' + d.slice(5, 7);
  return { today, sections: [
    { title: 'ЗАЕЗДЫ · сегодня ' + ruD(today), date: today, kind: 'in', rows: all.filter(r => r.date === today) },
    { title: 'ВЫЕЗДЫ · сегодня ' + ruD(today), date: today, kind: 'out', rows: outRows },
    { title: 'ЗАЕЗДЫ · завтра ' + ruD(tomorrow), date: tomorrow, kind: 'in', rows: all.filter(r => r.date === tomorrow) }
  ] };
}

// ---------- брони на будущее (лист «Брони») ----------
const CH_AL = { telegram: 'telegram', тг: 'telegram', whatsapp: 'whatsapp', ватсап: 'whatsapp', сайт: 'website', site: 'website', instagram: 'instagram', инста: 'instagram', airbnb: 'airbnb', booking: 'booking', букинг: 'booking', ostrovok: 'ostrovok', островок: 'ostrovok', яндекс: 'yandex', yandex: 'yandex', корпоратив: 'corporate', corporate: 'corporate', продление: 'other', другое: 'other' };
const CHL = { telegram: 'Telegram', whatsapp: 'WhatsApp', website: 'Сайт', instagram: 'Instagram', airbnb: 'Airbnb', booking: 'Booking', ostrovok: 'Ostrovok', yandex: 'Яндекс', corporate: 'Корпоратив', rc: 'RC', other: 'Другое', ota: 'OTA' };
async function priceFor(aptId, ci, co) {
  const a = (await T.sb('apartments?select=weekday_price,weekend_price&id=eq.' + aptId).then(x => x.json()))[0]; if (!a) return 0;
  let s = 0, n = 0; for (let d = ci; d < co; d = addDays(d, 1)) { const w = new Date(d + 'T00:00:00Z').getUTCDay(); s += (w === 5 || w === 6) ? a.weekend_price : a.weekday_price; n++; }
  return n >= 3 ? Math.round(s * 0.9) : s;
}
async function book(b, who) {
  const c = await findApt(b.apt); if (!c.length) throw new Error('Не нашёл квартиру «' + b.apt + '»'); if (c.length > 1) throw new Error('Уточни ЖК: ' + c.map(a => sheetShort(a)).join(', '));
  const ci = dateStr(b.check_in), co = dateStr(b.check_out); if (!ci || !co) throw new Error('Даты заезда/выезда'); if (co <= ci) throw new Error('Выезд должен быть позже заезда');
  const nights = Math.round((new Date(co) - new Date(ci)) / 86400000);
  const total = num(b.total) || await priceFor(c[0].id, ci, co);
  const row = { apartment_id: c[0].id, guest_name: String(b.guest_name || 'Гость').trim() || 'Гость', guest_phone: b.guest_phone ? String(b.guest_phone).trim() : null, guest_telegram: b.guest_telegram ? String(b.guest_telegram).trim() : null,
    check_in: ci, check_out: co, nights, guests_count: parseInt(b.guests) || 1, status: 'confirmed', source: 'manual', channel: CH_AL[String(b.channel || '').trim().toLowerCase()] || 'telegram',
    total_price: Math.round(total), currency: 'USD', notes: b.note ? String(b.note).trim() : null, arrival_time: b.arrival_time ? timeStr(b.arrival_time) : null, created_by: who,
    booking_ref: 'UL-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase() };
  const r = await T.sb('bookings', { method: 'POST', body: JSON.stringify(row) });
  if (!r.ok) { const t = await r.text(); throw new Error(/bookings_no_overlap|exclusion/.test(t) ? 'Даты заняты — у этой квартиры уже есть бронь на эти дни' : t.slice(0, 160)); }
  const created = (await r.json())[0];
  const prep = num(b.prepaid); if (prep > 0) await T.sb('payments', { method: 'POST', body: JSON.stringify({ booking_id: created.id, amount: prep, currency: 'USD', method: 'transfer', received_by: who, note: 'предоплата (таблица)' }) });
  return { id: created.id, ref: created.booking_ref, apt: sheetShort(c[0]), check_in: ci, check_out: co, total: Math.round(total || 0), nights };
}
async function upcoming() {
  const today = T.tashToday(0);
  const rows = await T.sb('v_bookings?select=id,apartment_id,complex,apartment_name,check_in,check_out,nights,status,channel,guest_name,guest_phone,guests_count,total_price,currency,paid,debt,arrival_time,notes,created_by&status=in.(confirmed,request,checked_in)&check_in=gt.' + today + '&check_in=lte.' + addDays(today, 30) + '&order=check_in,apartment_id&limit=500').then(x => x.ok ? x.json() : []);
  return rows.map(b => ({ id: b.id, apt: sheetShort({ name: b.apartment_name, complex: b.complex }), check_in: b.check_in, check_out: b.check_out, nights: b.nights, guest_name: b.guest_name || '', guest_phone: b.guest_phone || '', guests: b.guests_count || '', total: b.total_price == null ? '' : Number(b.total_price), currency: b.currency || 'USD', paid: Number(b.paid || 0), debt: Number(b.debt || 0), channel: CHL[b.channel] || b.channel || '', arrival_time: b.arrival_time || '', note: b.notes || '', status: b.status === 'request' ? 'Запрос' : 'Подтверждена', created_by: (b.created_by || '').replace(/^sheet:/, '') }));
}

async function applyFields(id, fields, who) {
  const patch = {}; for (const f in fields) if (FIELDS[f]) patch[f] = FIELDS[f](fields[f]);
  if (!Object.keys(patch).length) return;
  patch.updated_by = who; patch.updated_at = new Date().toISOString(); patch.auto = false;
  const r = await T.sb('daily_ops?id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(patch) });
  if (!r.ok) throw new Error((await r.text()).slice(0, 200));
  return patch;
}
async function rowFor(date, aptQ, who) { // найти/создать строку дня для квартиры
  const c = await findApt(aptQ); if (!c.length) throw new Error('Не нашёл квартиру «' + aptQ + '»'); if (c.length > 1) throw new Error('Уточни ЖК: ' + c.map(a => sheetShort(a)).join(', '));
  let rows = await T.sb('daily_ops?select=id&date=eq.' + date + '&apartment_id=eq.' + c[0].id).then(x => x.json());
  if (!rows.length) { await T.sb('daily_ops', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' }, body: JSON.stringify([{ date, apartment_id: c[0].id, auto: false, updated_by: who }]) }); rows = await T.sb('daily_ops?select=id&date=eq.' + date + '&apartment_id=eq.' + c[0].id).then(x => x.json()); }
  return { id: rows[0].id, apt: sheetShort(c[0]) };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: H, body: '' };
  try {
    const KEY = await getKey(); if (!KEY) return out(500, { error: 'SHEET_SYNC_KEY не задан' });
    if (event.httpMethod === 'GET') {
      const p = event.queryStringParameters || {};
      if (p.key !== KEY) return out(401, { error: 'bad key' });
      if (p.view === 'day') return out(200, await sections());
      if (p.view === 'upcoming') { const apts = await T.sb('apartments?select=id,name,complex&is_active=eq.true').then(x => x.json()); const order = { U: 1, N: 2, K: 3, MA: 4, G: 5, MO: 6 }; const names = apts.map(sheetShort).sort((a, b) => (order[a.split(' ')[0]] || 9) - (order[b.split(' ')[0]] || 9) || (parseInt(a.split(' ')[1]) - parseInt(b.split(' ')[1]))); return out(200, { today: T.tashToday(0), apts: names, rows: await upcoming() }); }
      const from = /^\d{4}-\d{2}-\d{2}$/.test(p.from || '') ? p.from : addDays(T.tashToday(0), -1);
      const to = /^\d{4}-\d{2}-\d{2}$/.test(p.to || '') ? p.to : addDays(T.tashToday(0), 7);
      return out(200, { from, to, today: T.tashToday(0), rows: await rows(from, to) });
    }
    const b = JSON.parse(event.body || '{}');
    if (b.key !== KEY) return out(401, { error: 'bad key' });
    const who = 'sheet:' + (b.who || 'google');
    if (b.op === 'update') {
      if (!b.id || !FIELDS[b.field]) return out(400, { error: 'id/field' });
      const patch = await applyFields(b.id, { [b.field]: b.value }, who);
      return out(200, { ok: true, id: b.id, field: b.field, value: patch[b.field] });
    }
    if (b.op === 'add') {
      const date = dateStr(b.date) || T.tashToday(0); if (!b.apt) return out(400, { error: 'apt' });
      const r = await rowFor(date, b.apt, who); return out(200, { ok: true, id: r.id, date, apt: r.apt });
    }
    if (b.op === 'book') { try { return out(200, Object.assign({ ok: true }, await book(b, who))); } catch (e) { return out(200, { ok: false, error: String(e.message || e) }); } }
    if (b.op === 'import') { // разовый перенос строк таблицы в базу
      const date = dateStr(b.date) || T.tashToday(0); const res = [];
      for (const row of (b.rows || [])) { try { if (!row.apt) continue; const r = await rowFor(date, row.apt, who); await applyFields(r.id, row.fields || {}, who); res.push({ apt: row.apt, id: r.id }); } catch (e) { res.push({ apt: row.apt, error: String(e.message || e) }); } }
      return out(200, { ok: true, date, result: res });
    }
    return out(400, { error: 'unknown op' });
  } catch (e) { return out(500, { error: String(e.message || e) }); }
};
