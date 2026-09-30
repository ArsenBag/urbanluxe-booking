// Urban Luxe — ops.js (30.09.2026). Ежедневный лист заездов (замена Google-таблицы) для бота бронеров.
// Таблица daily_ops: по одной строке на (дата, квартира). Строки создаются сами из заездов RC + броней сайта,
// бронер/опер-менеджер заполняют галочки кнопками, текстовые поля — командами.
// Используется из tg-free.js. Экспортирует: ensureDay, getRows, rowCard, summary, applyToggle, setField, findApt.

const T = require('./_tg.js');

const SOURCES = { bnb: 'Airbnb', booking: 'Booking', tg: 'Telegram', wa: 'WhatsApp', site: 'Сайт', ig: 'Instagram', ext: 'Продление', other: 'Другое' };
const SOURCE_ALIASES = { airbnb: 'bnb', бнб: 'bnb', bnb: 'bnb', букинг: 'booking', booking: 'booking', тг: 'tg', tg: 'tg', телеграм: 'tg', вазап: 'wa', ватсап: 'wa', whatsapp: 'wa', wa: 'wa', сайт: 'site', site: 'site', инста: 'ig', instagram: 'ig', ig: 'ig', продление: 'ext', ext: 'ext' };
const REG = { needed: '☐ нужна', not_needed: '— не надо', done: '☑ сделана' };

let aptCache = null;
async function apts() {
  if (aptCache && Date.now() - aptCache.at < 300000) return aptCache.list;
  const r = await T.sb('apartments?select=id,name,complex,floor,rooms,weekday_price,weekend_price&order=complex,name');
  const list = r.ok ? await r.json() : [];
  aptCache = { at: Date.now(), list };
  return list;
}
function short(a) { // ю100 / НО33 стиль таблицы: первая буква ЖК + номер
  const num = (a.name || '').replace(/\D/g, '');
  const cx = (a.complex || '').split(' ')[0];
  return cx + ' ' + num;
}

// «100», «ю100», «nest 15», «Апартамент 15» → квартиры-кандидаты
async function findApt(q) {
  const list = await apts();
  const s = String(q || '').trim().toLowerCase();
  const num = s.replace(/\D/g, '');
  if (!num) return [];
  let c = list.filter(a => (a.name || '').replace(/\D/g, '') === num);
  const word = s.replace(/[\d\s]/g, '');
  if (c.length > 1 && word) {
    const map = { ю: 'u-tower', u: 'u-tower', н: 'nest', n: 'nest', м: 'mirabad', mi: 'mirabad', mo: 'modera', мо: 'modera', к: 'kislorod', k: 'kislorod', г: 'gardens', g: 'gardens' };
    const key = Object.keys(map).sort((a, b) => b.length - a.length).find(k => word.indexOf(k) === 0);
    if (key) c = c.filter(a => (a.complex || '').toLowerCase().indexOf(map[key]) === 0);
  }
  return c;
}

// создать недостающие строки дня из календаря (заезды RC + брони сайта)
async function ensureDay(date) {
  const base = process.env.URL || 'https://urbanluxe.cc';
  const [ical, siteRes, exRes] = await Promise.all([
    fetch(base + '/.netlify/functions/sync-ical').then(r => r.json()).catch(() => ({})),
    T.sb('bookings?select=apartment_id,guest_name,total_price,guests_count,check_out&status=eq.confirmed&check_in=eq.' + date),
    T.sb('daily_ops?select=apartment_id&date=eq.' + date)
  ]);
  const have = new Set((exRes.ok ? await exRes.json() : []).map(r => r.apartment_id));
  const site = {}; (siteRes.ok ? await siteRes.json() : []).forEach(b => { site[b.apartment_id] = b; });
  const rows = [];
  (ical.all_bookings || []).filter(b => b.check_in === date).forEach(b => {
    if (have.has(b.apartment_id)) return; have.add(b.apartment_id);
    const s = site[b.apartment_id];
    rows.push({ date, apartment_id: b.apartment_id, source: s ? 'site' : null, guest_name: s ? s.guest_name : (b.guest_name || null), guests: s ? s.guests_count : null, payment_total: s ? s.total_price : null, checkout_time: null, auto: true });
  });
  Object.keys(site).forEach(id => { if (!have.has(id)) { have.add(id); const s = site[id]; rows.push({ date, apartment_id: id, source: 'site', guest_name: s.guest_name, guests: s.guests_count, payment_total: s.total_price, auto: true }); } });
  if (rows.length) await T.sb('daily_ops', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' }, body: JSON.stringify(rows) });
}

async function getRows(date) {
  const r = await T.sb('daily_ops?select=*&date=eq.' + date + '&order=apartment_id');
  const rows = r.ok ? await r.json() : [];
  const list = await apts(); const byId = {}; list.forEach(a => { byId[a.id] = a; });
  rows.forEach(x => { x.apt = byId[x.apartment_id] || { name: x.apartment_id, complex: '' }; x.short = short(x.apt); });
  return rows.sort((a, b) => a.short.localeCompare(b.short));
}

function payStr(r) {
  const tot = r.payment_total != null ? Number(r.payment_total) : null, paid = Number(r.payment_paid || 0);
  if (tot == null) return paid ? paid + '$ (итог не задан)' : '☐';
  if (paid >= tot) return '☑ ' + tot + '$';
  if (paid > 0) return '◐ ' + paid + '/' + tot + '$ · осталось ' + (tot - paid) + '$';
  return '☐ 0/' + tot + '$';
}
function flag(v) { return v ? '☑' : '☐'; }
function statusLine(r) {
  const p = r.payment_total != null && Number(r.payment_paid || 0) >= Number(r.payment_total);
  return flag(r.passport) + flag(r.access) + (r.registration === 'not_needed' ? '—' : r.registration === 'done' ? '☑' : '☐') + (p ? '☑' : (Number(r.payment_paid) > 0 ? '◐' : '☐'));
}

function summary(date, rows) {
  let t = '📋 <b>Лист заездов — ' + T.ruDate(date) + '</b>\n<i>паспорт · доступ · регистрация · оплата</i>\n\n';
  if (!rows.length) t += 'Заездов нет.\n';
  rows.forEach(r => {
    t += '<b>' + T.esc(r.short) + '</b> ' + statusLine(r) + ' · ' + (SOURCES[r.source] || (r.source ? T.esc(r.source) : '<i>площадка?</i>')) + (r.checkin_time ? ' · ' + T.esc(r.checkin_time) : '') + (r.guests ? ' · ' + r.guests + ' чел' : '') + '\n';
  });
  t += '\nНажми квартиру — откроется карточка с галочками.\nДобавить вручную: <code>лист + 100</code> · другой день: <code>лист завтра</code>, <code>лист 3.10</code>';
  const kb = []; let row = [];
  rows.forEach(r => { row.push({ text: r.short, callback_data: 'op|' + r.id }); if (row.length === 4) { kb.push(row); row = []; } });
  if (row.length) kb.push(row);
  kb.push([{ text: '🔄 Обновить', callback_data: 'ops|' + date }]);
  return { text: t, reply_markup: { inline_keyboard: kb } };
}

function rowCard(r) {
  const a = r.apt;
  let t = '🏠 <b>' + T.esc(a.name) + ' · ' + T.esc(a.complex || '') + (a.floor ? ', эт. ' + a.floor : '') + '</b> — ' + T.ruDate(r.date) + '\n';
  t += 'Площадка: <b>' + (SOURCES[r.source] || (r.source ? T.esc(r.source) : '—')) + '</b>' + (r.guest_name ? ' · ' + T.esc(r.guest_name) : '') + '\n';
  t += 'Заезд: ' + (r.checkin_time ? T.esc(r.checkin_time) : '—') + ' · Выезд: ' + (r.checkout_time ? T.esc(r.checkout_time) : '—') + ' · Гостей: ' + (r.guests || '—') + '\n';
  t += 'Регистрация: ' + REG[r.registration] + (r.reg_sent ? ' · отправлена гостю ☑' : '') + '\n';
  t += 'Оплата: ' + payStr(r) + ' · Депозит: ' + (r.deposit_returned ? 'возвращён ☑' : r.deposit_received ? 'получен ☑' : '☐') + '\n';
  if (r.note) t += '📝 ' + T.esc(r.note) + '\n';
  t += '\n<i>Изменить текстом:</i> <code>' + r.short.replace(/\s/g, '') + ' площадка bnb</code> · <code>… заезд 18:00</code> · <code>… выезд 11:00</code> · <code>… гостей 2</code> · <code>… оплата 100 из 230</code> · <code>… гость Имя</code> · <code>… заметка текст</code>';
  const id = r.id;
  const b = (label, key) => ({ text: label, callback_data: 'tg|' + id + '|' + key });
  const kb = [
    [b(flag(r.passport) + ' Паспорт', 'passport'), b(flag(r.access) + ' Доступ', 'access')],
    [b('Рег: ' + REG[r.registration], 'registration'), b(flag(r.reg_sent) + ' Рег отправлена', 'reg_sent')],
    [b(flag(r.confirm_checkin) + ' Уточнён заезд', 'confirm_checkin'), b(flag(r.confirm_checkout) + ' Уточнён выезд', 'confirm_checkout')],
    [b((r.payment_total != null && Number(r.payment_paid || 0) >= Number(r.payment_total) ? '☑' : '☐') + ' Оплачено полностью', 'paid_full'), b(flag(r.review) + ' Отзыв', 'review')],
    [b(flag(r.deposit_received) + ' Депозит получен', 'deposit_received'), b(flag(r.deposit_returned) + ' Депозит возвращён', 'deposit_returned')],
    [b(flag(r.checked_in) + ' Гость заехал', 'checked_in'), b(flag(r.checked_out) + ' Гость выехал', 'checked_out')],
    [{ text: '📢 Сообщить опер-менеджеру', callback_data: 'tg|' + id + '|notify' }, { text: '↩ Список', callback_data: 'ops|' + r.date }]
  ];
  return { text: t, reply_markup: { inline_keyboard: kb } };
}

async function getRow(id) {
  const r = await T.sb('daily_ops?select=*&id=eq.' + id).then(x => x.json());
  if (!r.length) return null;
  const list = await apts(); const a = list.find(x => x.id === r[0].apartment_id) || { name: r[0].apartment_id, complex: '' };
  r[0].apt = a; r[0].short = short(a); return r[0];
}

async function applyToggle(id, key, who) {
  const r = await getRow(id); if (!r) return null;
  const patch = { updated_by: who, updated_at: new Date().toISOString(), auto: false };
  if (key === 'registration') patch.registration = r.registration === 'needed' ? 'done' : r.registration === 'done' ? 'not_needed' : 'needed';
  else if (key === 'paid_full') { patch.payment_paid = (r.payment_total != null && Number(r.payment_paid || 0) >= Number(r.payment_total)) ? 0 : (r.payment_total != null ? r.payment_total : r.payment_paid); if (r.payment_total == null) return { row: r, error: 'Сначала задай сумму: <code>' + r.short.replace(/\s/g, '') + ' оплата 230</code>' }; }
  else patch[key] = !r[key];
  await T.sb('daily_ops?id=eq.' + id, { method: 'PATCH', body: JSON.stringify(patch) });
  return { row: await getRow(id), changed: key, patch };
}

// «ю100 площадка bnb» / «100 заезд 18:00» / «100 оплата 100 из 230» / «100 оплата 230» / «100 гостей 2» / «100 гость Имя» / «100 заметка …» / «100 выезд 11:00»
async function setField(date, aptQ, field, value, who) {
  const cands = await findApt(aptQ);
  if (!cands.length) return { error: 'Не нашёл квартиру «' + T.esc(aptQ) + '»' };
  if (cands.length > 1) return { error: 'Уточни ЖК: ' + cands.map(a => '<code>' + short(a).replace(/\s/g, '') + '</code>').join(', ') };
  const a = cands[0];
  let rows = await T.sb('daily_ops?select=id&date=eq.' + date + '&apartment_id=eq.' + a.id).then(x => x.json());
  if (!rows.length) rows = await T.sb('daily_ops', { method: 'POST', body: JSON.stringify([{ date, apartment_id: a.id, auto: false }]) }).then(x => x.json());
  const id = rows[0].id;
  const f = field.toLowerCase(); const patch = { updated_by: who, updated_at: new Date().toISOString(), auto: false };
  if (/^(площадка|источник|src)$/.test(f)) { const k = SOURCE_ALIASES[value.toLowerCase()]; patch.source = k || value; }
  else if (/^(заезд|заезд:|in)$/.test(f)) patch.checkin_time = value;
  else if (/^(выезд|out)$/.test(f)) patch.checkout_time = value;
  else if (/^(гостей|чел|людей)$/.test(f)) patch.guests = parseInt(value, 10) || null;
  else if (/^(гость|имя)$/.test(f)) patch.guest_name = value;
  else if (/^(заметка|коммент|прим)$/.test(f)) patch.note = value;
  else if (/^(оплата|опл)$/.test(f)) {
    const m = value.replace(/\$/g, '').match(/(\d+(?:[.,]\d+)?)\s*(?:из|\/|of)\s*(\d+(?:[.,]\d+)?)/);
    if (m) { patch.payment_paid = +m[1].replace(',', '.'); patch.payment_total = +m[2].replace(',', '.'); }
    else { const n = parseFloat(value.replace(',', '.')); if (isNaN(n)) return { error: 'Формат: <code>оплата 230</code> (оплачено всё) или <code>оплата 100 из 230</code>' }; patch.payment_total = n; patch.payment_paid = n; }
  }
  else return { error: 'Не знаю поле «' + T.esc(field) + '». Поля: площадка, заезд, выезд, гостей, гость, оплата, заметка' };
  await T.sb('daily_ops?id=eq.' + id, { method: 'PATCH', body: JSON.stringify(patch) });
  return { row: await getRow(id) };
}

async function addRow(date, aptQ, who) {
  const cands = await findApt(aptQ);
  if (!cands.length) return { error: 'Не нашёл квартиру «' + T.esc(aptQ) + '»' };
  if (cands.length > 1) return { error: 'Уточни ЖК: ' + cands.map(a => '<code>' + short(a).replace(/\s/g, '') + '</code>').join(', ') };
  await T.sb('daily_ops', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' }, body: JSON.stringify([{ date, apartment_id: cands[0].id, auto: false, updated_by: who }]) });
  const rows = await T.sb('daily_ops?select=id&date=eq.' + date + '&apartment_id=eq.' + cands[0].id).then(x => x.json());
  return { row: await getRow(rows[0].id) };
}

module.exports = { ensureDay, getRows, getRow, rowCard, summary, applyToggle, setField, addRow, findApt, SOURCES, short };
