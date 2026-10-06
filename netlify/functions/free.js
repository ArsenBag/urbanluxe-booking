// Urban Luxe — free.js (28.09.2026)
// «Что свободно на даты» в формате готового сообщения клиенту — по номерам из каталога
// t.me/UrbanLuxehotel/242. Раньше бронер вручную сверял RealtyCalendar с каталогом.
//
// GET /.netlify/functions/free?from=5.10&to=7.10            → text/plain (готово вставить в Telegram)
// GET ...&format=json                                       → { text, available:[…], missing:[…] }
// Даты: 5.10 · 05.10 · 5.10.2026 · 2026-10-05. Если to не задан — 1 ночь. Год: ближайший будущий.
// Занятость берётся из availability.js (iCal RealtyCalendar + брони сайта), цены — из базы.
// Используется страницей /free.html и Telegram-ботом (tg-free.js).

const CATALOG = [ // [номер в каталоге, id в базе, подпись как в каталоге, пост с фото в t.me/UrbanLuxehotel]
  [1, 'nest_15', 'Nest One 1/3/15', 402], [2, 'nest_249', 'Nest One 1/13/249', 161], [3, 'nest_325', 'Nest One 2/17/325', 770],
  [4, 'nest_481', 'Nest One 2/25/481', 68], [5, 'nest_233', 'Nest One 2/12/233', 492], [6, 'nest_353', 'Nest One 1/18/353', 512],
  [7, 'nest_163', 'Nest One 2/9/163', 639], [8, 'nest_193', 'Nest One 2/10/193', 667], [9, 'nest_477', 'Nest One 2/25/477', 684],
  [10, 'nest_609', 'Nest One 2/33/609', 851], [11, 'nest_166', 'Nest One 3/9/166', 607], [12, 'nest_179', 'Nest One 3/10/179', 876],
  [13, 'nest_168', 'Nest One 3/09/168', 860], [14, 'utower_65', 'U-Tower 1/6/65', 568], [15, 'utower_73', 'U-Tower 1/6/73', 586],
  [16, 'utower_171', 'U-Tower 1/11/171', 413], [17, 'utower_194', 'U-Tower 1/12/194', 819], [18, 'utower_208', 'U-Tower 1/13/208', 89],
  [19, 'utower_298', 'U-Tower 1/17/298', 828], [20, 'utower_310', 'U-Tower 1/18/310', 259], [21, 'utower_326', 'U-Tower 1/19/326', 838],
  [22, 'utower_400', 'U-Tower 3/23/400', 803], [23, 'utower2_5', 'U-Tower 2/3/5', 177], [24, 'utower2_9', 'U-Tower 2/4/9', 328],
  [25, 'utower2_207', 'U-Tower 2/13/207', 210], [26, 'utower2_228', 'U-Tower 2/13/228', 229], [27, 'utower_276', 'U-Tower 2/16/276', 744],
  [28, 'utower2_296', 'U-Tower 2/17/296', 55], [29, 'utower2_92', 'U-Tower 2/7/92', 471], [30, 'utower2_79', 'U-Tower 2/7/79', 735],
  [31, 'mirabad_111', 'Mirabad Aven 2/8/111', 143], [32, 'kislorod_6', 'Kislorod 3/02/06', 707], [33, 'kislorod_31', 'Kislorod 2/07/31', 759],
  [34, 'kislorod_49', 'Kislorod 2/10/49', 522], [35, 'kislorod_58', 'Kislorod 2/11/58', 359], [36, 'kislorod_128', 'Kislorod 2/13/128', 381],
  [37, 'gardens_65', 'Gardens Resid 2/3/65', 778], [38, 'modera_294', 'Modera T 1/11/294', 785], [39, 'modera_359', 'Modera T 1/16/359', 794]
];
const CATALOG_URL = 'https://t.me/UrbanLuxehotel/242';
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function tashToday() { return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10); }
function addDays(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function pad(n) { return String(n).padStart(2, '0'); }

// «5.10», «05.10.26», «2026-10-05», «5 октября» → YYYY-MM-DD (год — ближайший будущий)
function parseDate(s, notBefore) {
  s = String(s || '').trim().toLowerCase();
  if (!s) return null;
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return m[1] + '-' + pad(m[2]) + '-' + pad(m[3]);
  if ((m = s.match(/^(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{2,4}))?$/))) {
    let y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : null;
    const dd = pad(m[1]), mm = pad(m[2]);
    if (!y) {
      y = +tashToday().slice(0, 4);
      let iso = y + '-' + mm + '-' + dd;
      if (iso < (notBefore || tashToday())) iso = (y + 1) + '-' + mm + '-' + dd;
      return iso;
    }
    return y + '-' + mm + '-' + dd;
  }
  const names = { 'янв': 1, 'фев': 2, 'мар': 3, 'апр': 4, 'ма': 5, 'июн': 6, 'июл': 7, 'авг': 8, 'сен': 9, 'окт': 10, 'ноя': 11, 'дек': 12 };
  if ((m = s.match(/^(\d{1,2})\s*([а-я]+)/))) {
    const k = Object.keys(names).find(n => m[2].indexOf(n) === 0);
    if (k) return parseDate(m[1] + '.' + names[k], notBefore);
  }
  return null;
}

function fmtRange(ci, co) {
  const a = new Date(ci + 'T00:00:00Z'), b = new Date(co + 'T00:00:00Z');
  const nights = Math.round((new Date(co) - new Date(ci)) / 86400000);
  const n = nights === 1 ? '1 ночь' : (nights < 5 ? nights + ' ночи' : nights + ' ночей');
  
  const same = a.getUTCMonth() === b.getUTCMonth();
  return (same ? a.getUTCDate() + '–' + b.getUTCDate() + ' ' + MONTHS[b.getUTCMonth()]
    : a.getUTCDate() + ' ' + MONTHS[a.getUTCMonth()] + ' – ' + b.getUTCDate() + ' ' + MONTHS[b.getUTCMonth()]) + ' (' + n + ')';
}

async function buildFree(fromRaw, toRaw, opts) {
  opts = opts || {};
  const ci = parseDate(fromRaw) || tashToday();
  let co = toRaw ? parseDate(toRaw, ci) : addDays(ci, 1);
  if (!co || co <= ci) co = addDays(ci, 1);
  const base = process.env.URL || 'https://urbanluxe.cc';
  const r = await fetch(base + '/.netlify/functions/availability?check_in=' + ci + '&check_out=' + co);
  if (!r.ok) throw new Error('availability ' + r.status);
  const d = await r.json();
  const byId = {}; (d.available || []).forEach(a => { byId[a.id] = a; });
  // Страховка: сверяем с sync-ical (полные iCal RC). 28.09 availability показывал mirabad_111 свободным,
  // хотя в RC он закрыт до 11.2027 — если фиды расходятся, верим занятости.
  try {
    const s = await fetch(base + '/.netlify/functions/sync-ical').then(x => x.json());
    (s.all_bookings || []).forEach(b => { if (byId[b.apartment_id] && b.check_in < co && b.check_out > ci) delete byId[b.apartment_id]; });
  } catch (e) { /* sync-ical недоступен — остаёмся на availability */ }
  const lines = [], available = [];
  let lastComplex = '';
  // фильтры (кнопки в боте / Mini App): rooms = 'studio' | 'multi'; complex = 'nest' | 'utower' | …; max = потолок цены Пн–Чт
  const f = opts.filter || {};
  for (const [num, id, label, post] of CATALOG) {
    const a = byId[id];
    if (!a) continue;
    const isStudio = /студ/i.test(a.rooms || '') || (!a.rooms && !/комнат|\d\+|3х/i.test(a.style || ''));
    if (f.rooms === 'studio' && !isStudio) continue;
    if (f.rooms === 'multi' && isStudio) continue;
    if (f.complex && id.indexOf(f.complex) !== 0) continue;
    if (f.max && a.weekday > f.max) continue;
    const photo = 'https://t.me/UrbanLuxehotel/' + post;
    available.push({ num, id, label, photo, weekday: a.weekday, weekend: a.weekend, total: a.total, nights: a.nights, complex: a.complex });
    const complex = label.split(' ')[0];
    if (complex !== lastComplex) { if (lines.length) lines.push(''); lastComplex = complex; }
    lines.push(num + '. ' + label + ' — ' + a.weekday + '$/' + a.weekend + '$' + (a.nights > 1 ? ' · за ' + a.nights + ' ноч. ' + a.total + '$' : '') + '\n   📷 ' + photo);
  }
  // Квартиры, которых ещё нет в закреплённом каталоге (например, новые U-Tower 222/415): показываем в конце без номера,
  // фото — страница на сайте. Когда Арсен добавит их в каталог — вписать в CATALOG с номером и постом.
  const inCatalog = new Set(CATALOG.map(c => c[1]));
  const extra = Object.values(byId).filter(a => !inCatalog.has(a.id)).sort((x, y) => String(x.id).localeCompare(String(y.id)));
  for (const a of extra) {
    const isStudio = /студ/i.test(a.rooms || '');
    if (f.rooms === 'studio' && !isStudio) continue;
    if (f.rooms === 'multi' && isStudio) continue;
    if (f.complex && a.id.indexOf(f.complex) !== 0) continue;
    if (f.max && a.weekday > f.max) continue;
    const num = String(a.id).split('_').pop();
    const label = (a.complex || '') + ' ' + (a.floor ? a.floor + '/' : '') + num;
    const photo = 'https://urbanluxe.cc/apartments/' + a.id;
    available.push({ num: '•', id: a.id, label, photo, weekday: a.weekday, weekend: a.weekend, total: a.total, nights: a.nights, complex: a.complex });
    if (lastComplex !== '•') { if (lines.length) lines.push(''); lastComplex = '•'; }
    lines.push('• ' + label + ' (нет в каталоге) — ' + a.weekday + '$/' + a.weekend + '$' + (a.nights > 1 ? ' · за ' + a.nights + ' ноч. ' + a.total + '$' : '') + '\n   📷 ' + photo);
  }
  const total = d.total_apartments || 0;
  const fl = f.rooms === 'studio' ? ' · студии' : f.rooms === 'multi' ? ' · 2+ комнат' : '';
  const fc = f.complex ? ' · ' + ({ nest: 'Nest One', utower: 'U-Tower', kislorod: 'Kislorod', mirabad: 'Mirabad', gardens: 'Gardens', modera: 'Modera' }[f.complex] || f.complex) : '';
  const fm = f.max ? ' · до ' + f.max + '$' : '';
  const head = '🏠 Свободно на ' + fmtRange(ci, co) + fl + fc + fm + ': ' + available.length + (fl || fc || fm ? '' : ' из ' + total);
  const text = [head, '', ...(lines.length ? lines : ['Свободных нет 😔']), '', 'Цены: Пн–Чт / Пт–Вс. Полный каталог: ' + CATALOG_URL,
    'Бронь на сайте: https://urbanluxe.cc/?check_in=' + ci + '&check_out=' + co].join('\n');
  return { check_in: ci, check_out: co, total_apartments: total, available_count: available.length, available, text };
}

exports.buildFree = buildFree;
exports.parseDate = parseDate;

exports.handler = async (event) => {
  const p = (event && event.queryStringParameters) || {};
  try {
    const res = await buildFree(p.from || p.check_in || p.d, p.to || p.check_out);
    if (p.format === 'json') {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }, body: JSON.stringify(res) };
    }
    return { statusCode: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }, body: res.text };
  } catch (e) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};
