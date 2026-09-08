// Urban Luxe — apt-page.js (сентябрь 2026)
// SEO-страницы апартаментов, собираемые из Supabase на лету:
//   /apartments            — каталог всех активных объектов (хаб)
//   /apartments/<id>       — страница объекта (фото, цена, описание, JSON-LD, перелинковка)
// Зачем: /?apt=<id> Google склеивает с главной как дубли (в индексе 7 страниц из 44).
// Настоящие URL с уникальным контентом индексируются и ранжируются по запросам
// «апартаменты Nest One посуточно», «квартира U-Tower на сутки» и т.д.
// Кэш: CDN Netlify держит страницу 1 час (Netlify-CDN-Cache-Control), база не нагружается.

const SB_URL = process.env.SUPABASE_URL || 'https://sebvfvtofiysbywxjqut.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI';
const SITE = 'https://urbanluxe.cc';

const COMPLEX = {
  'Nest One':          { url: '/nest-one',          addr: 'ул. Батыра Закирова 1А, Tashkent City',        district: 'Tashkent City',        lat: 41.3111, lng: 69.2513, about: 'Самый высокий небоскрёб Узбекистана (51 этаж) рядом с Tashkent City, Hilton и City Mall.' },
  'U-Tower':           { url: '/u-tower',           addr: 'мкр. Бешагач 1/1, Шайхантахурский район',       district: 'Бешагач',               lat: 41.3025, lng: 69.2408, about: 'Комплекс бизнес-класса U-Tower NRG: 27 этажей, Smart Home, закрытый двор.' },
  'Mirabad':           { url: '/mirabad',           addr: 'ул. Айбек 38А, Мирабадский район',              district: 'Мирабад',               lat: 41.2955, lng: 69.2740, about: 'Престижный центр: парки, рестораны, метро в шаговой доступности.' },
  'Kislorod':          { url: '/kislorod',          addr: 'ул. Бурижар 1, Яккасарайский район',            district: 'Яккасарай',             lat: 41.2846, lng: 69.2452, about: 'Эко-комплекс Kislorod с зелёным двором вдоль реки.' },
  'Gardens Residence': { url: '/gardens-residence', addr: 'Tashkent City, Шайхантахурский район',          district: 'Tashkent City',        lat: 41.3130, lng: 69.2480, about: 'Квартал-сад от Dream City рядом с Nest One и Tashkent City.' },
  'Modera Towers':     { url: '/modera-towers',     addr: 'ул. Шота Руставели 19, Яккасарайский район',   district: 'Яккасарай',             lat: 41.2860, lng: 69.2710, about: 'Две 24-этажные башни у парка Дружбы.' }
};
const AMEN = {
  wifi: 'Wi-Fi до 100 Мбит/с', ac: 'Кондиционер', kitchen: 'Полная кухня', washer: 'Стиральная машина', tv: 'Smart TV',
  view: 'Панорамный вид', iron: 'Утюг', hairdryer: 'Фен', balcony: 'Балкон', parking: 'Парковка', elevator: 'Лифт',
  gym: 'Спортзал', pool: 'Бассейн', concierge: 'Консьерж', dishwasher: 'Посудомоечная машина', workspace: 'Рабочее место'
};

function esc(s) { return String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }
function img(u, w) { return 'https://images.weserv.nl/?url=' + encodeURIComponent(String(u).replace(/^https?:\/\//, '')) + '&w=' + w + '&q=78&output=webp'; }
function photos(a) {
  const p = a.photo_url || '';
  if (!p) return [];
  try { const arr = JSON.parse(p); return Array.isArray(arr) ? arr.filter(Boolean) : [p]; } catch (e) { return [p]; }
}
function priceNow(a) {
  const m = new Date(Date.now() + 5 * 3600e3).getUTCMonth() + 1; // Ташкент
  const s = a.seasonal_prices || {};
  let mult = 1, label = '';
  if (s.high && s.high.months && s.high.months.indexOf(m) > -1) { mult = s.high.multiplier || 1.2; label = 'высокий сезон'; }
  else if (s.low && s.low.months && s.low.months.indexOf(m) > -1) { mult = s.low.multiplier || 0.85; label = 'скидка ' + Math.round((1 - mult) * 100) + '%'; }
  return { wd: Math.round((a.weekday_price || 0) * mult), we: Math.round((a.weekend_price || a.weekday_price || 0) * mult), base: a.weekday_price || 0, label };
}
function cleanDesc(d) {
  return String(d || '').replace(/\r/g, '').replace(/https?:\/\/\S+/g, '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    .map(p => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join('');
}
function roomsLabel(r) { if (!r) return 'Апартаменты'; return /студ/i.test(r) ? 'Студия' : r + ' комн.'; }

function layout(o) {
  return '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc(o.title) + '</title><meta name="description" content="' + esc(o.desc) + '">' +
    '<link rel="canonical" href="' + esc(o.url) + '">' +
    '<meta property="og:type" content="website"><meta property="og:title" content="' + esc(o.title) + '"><meta property="og:description" content="' + esc(o.desc) + '">' +
    (o.image ? '<meta property="og:image" content="' + esc(o.image) + '">' : '') + '<meta property="og:url" content="' + esc(o.url) + '"><meta property="og:locale" content="ru_RU">' +
    '<meta name="twitter:card" content="summary_large_image">' +
    '<link rel="icon" href="/favicon.ico">' +
    (o.jsonld ? '<script type="application/ld+json">' + JSON.stringify(o.jsonld) + '</script>' : '') +
    '<style>' +
    ':root{--bg:#0b0a09;--bg2:#141210;--line:#2a2622;--gold:#c9a96e;--ink:#e8e4dc;--mut:#9a948a}' +
    '*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:"Jost",Arial,Helvetica,sans-serif;line-height:1.6}' +
    'a{color:var(--gold)}.wrap{max-width:1100px;margin:0 auto;padding:0 20px}' +
    'header{border-bottom:1px solid var(--line);padding:16px 0}header .wrap{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}' +
    '.logo{color:var(--gold);letter-spacing:.35em;text-decoration:none;font-size:15px}nav a{color:var(--mut);text-decoration:none;margin-left:18px;font-size:13px;letter-spacing:.06em;text-transform:uppercase}' +
    '.crumbs{font-size:12px;color:var(--mut);margin:18px 0 8px}.crumbs a{color:var(--mut);text-decoration:none}' +
    'h1{font-family:Georgia,"Playfair Display",serif;font-weight:400;font-size:34px;margin:6px 0 4px}.sub{color:var(--mut);margin:0 0 18px}' +
    '.gal{display:grid;grid-template-columns:2fr 1fr 1fr;grid-auto-rows:210px;gap:8px;margin:14px 0 24px}.gal img{width:100%;height:100%;object-fit:cover;border-radius:10px;display:block;background:#1b1815}' +
    '.gal img:first-child{grid-row:span 2}' +
    '.grid{display:grid;grid-template-columns:1.5fr 1fr;gap:28px}@media(max-width:800px){.grid{grid-template-columns:1fr}.gal{grid-template-columns:1fr 1fr;grid-auto-rows:160px}h1{font-size:26px}}' +
    '.card{background:var(--bg2);border:1px solid var(--line);border-radius:14px;padding:20px}.price{font-family:Georgia,serif;font-size:34px;color:var(--gold)}' +
    '.price small{font-size:14px;color:var(--mut);font-family:inherit}.tag{display:inline-block;background:rgba(46,204,113,.12);color:#5fd38d;border-radius:8px;padding:3px 9px;font-size:12px;margin-left:8px}' +
    '.btn{display:block;text-align:center;background:var(--gold);color:#241d10;text-decoration:none;padding:14px;border-radius:10px;font-weight:600;margin:16px 0 8px}' +
    '.facts{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;margin:14px 0;font-size:14px}.facts b{color:var(--ink);font-weight:500}.facts span{color:var(--mut)}' +
    'ul.amen{list-style:none;padding:0;margin:8px 0;display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:14px}ul.amen li:before{content:"✓ ";color:var(--gold)}' +
    'h2{font-family:Georgia,serif;font-weight:400;font-size:22px;margin:28px 0 10px}.desc p{margin:0 0 12px;color:#cfcabd}' +
    '.list{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;margin:12px 0 30px}' +
    '.item{background:var(--bg2);border:1px solid var(--line);border-radius:12px;overflow:hidden;text-decoration:none;color:var(--ink)}.item img{width:100%;height:160px;object-fit:cover;display:block;background:#1b1815}' +
    '.item div{padding:12px 14px}.item b{font-weight:500}.item small{color:var(--mut);display:block;margin-top:3px}.item .p{color:var(--gold);margin-top:6px;display:block}' +
    'footer{border-top:1px solid var(--line);margin-top:40px;padding:24px 0;color:var(--mut);font-size:13px}footer a{color:var(--mut)}' +
    '</style></head><body>' +
    '<header><div class="wrap"><a class="logo" href="/">URBAN LUXE</a><nav><a href="/apartments">Апартаменты</a><a href="/#booking">Бронирование</a><a href="https://t.me/Arsen_bnb">Telegram</a></nav></div></header>' +
    '<main class="wrap">' + o.body + '</main>' +
    '<footer><div class="wrap">Urban Luxe · Премиальные апартаменты посуточно в Ташкенте · <a href="/">urbanluxe.cc</a> · <a href="https://t.me/Arsen_bnb">@Arsen_bnb</a> · +998 93 690 00 44<br>' +
    'Комплексы: ' + Object.keys(COMPLEX).map(k => '<a href="' + COMPLEX[k].url + '">' + esc(k) + '</a>').join(' · ') + '</div></footer>' +
    '</body></html>';
}

function itemCard(a) {
  const ph = photos(a)[0];
  const pr = priceNow(a);
  return '<a class="item" href="/apartments/' + esc(a.id) + '">' + (ph ? '<img src="' + img(ph, 520) + '" alt="' + esc(a.name + ' — ' + a.complex) + '" loading="lazy">' : '') +
    '<div><b>' + esc(a.name) + '</b><small>' + esc(a.complex) + (a.floor ? ' · этаж ' + a.floor : '') + ' · ' + esc(roomsLabel(a.rooms)) + '</small><span class="p">от $' + pr.wd + '/ночь</span></div></a>';
}

function pageApartment(a, siblings) {
  const c = COMPLEX[a.complex] || { url: '/', addr: 'Ташкент', district: 'Ташкент', about: '' };
  const ph = photos(a);
  const pr = priceNow(a);
  const url = SITE + '/apartments/' + a.id;
  const title = a.name + ' в ' + a.complex + ' — апартаменты посуточно в Ташкенте | Urban Luxe';
  const desc = (roomsLabel(a.rooms) + ' в ЖК ' + a.complex + (a.floor ? ', ' + a.floor + ' этаж' : '') + ', ' + c.district + '. От $' + pr.wd + ' за ночь. Заезд 24/7, полная кухня, Wi-Fi, стиральная машина. Бронирование напрямую без комиссии.').slice(0, 158);
  const amen = (a.amenities || []).map(k => AMEN[k] || k);
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'Accommodation', name: a.name + ' · ' + a.complex, description: desc, url,
    image: ph.slice(0, 5), numberOfRooms: /студ/i.test(a.rooms || '') ? 1 : undefined, occupancy: { '@type': 'QuantitativeValue', maxValue: a.max_guests || 2 },
    address: { '@type': 'PostalAddress', streetAddress: c.addr, addressLocality: 'Ташкент', addressCountry: 'UZ' },
    geo: c.lat ? { '@type': 'GeoCoordinates', latitude: c.lat, longitude: c.lng } : undefined,
    amenityFeature: amen.map(n => ({ '@type': 'LocationFeatureSpecification', name: n, value: true })),
    offers: { '@type': 'Offer', price: pr.wd, priceCurrency: 'USD', unitText: 'ночь', availability: 'https://schema.org/InStock', url: SITE + '/?book=' + a.id },
    containedInPlace: { '@type': 'LodgingBusiness', name: 'Urban Luxe Apartments', url: SITE, telephone: '+998936900044' }
  };
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Главная', item: SITE + '/' },
    { '@type': 'ListItem', position: 2, name: 'Апартаменты', item: SITE + '/apartments' },
    { '@type': 'ListItem', position: 3, name: a.complex, item: SITE + c.url },
    { '@type': 'ListItem', position: 4, name: a.name, item: url } ] };

  const body =
    '<div class="crumbs"><a href="/">Главная</a> › <a href="/apartments">Апартаменты</a> › <a href="' + c.url + '">' + esc(a.complex) + '</a> › ' + esc(a.name) + '</div>' +
    '<h1>' + esc(a.name) + ' — ' + esc(roomsLabel(a.rooms)) + ' в ' + esc(a.complex) + ', Ташкент</h1>' +
    '<p class="sub">' + esc(c.addr) + (a.floor ? ' · ' + a.floor + ' этаж' : '') + (a.style ? ' · ' + esc(a.style) : '') + ' · до ' + (a.max_guests || 2) + ' гостей</p>' +
    (ph.length ? '<div class="gal">' + ph.slice(0, 5).map((u, i) => '<img src="' + img(u, i ? 640 : 1200) + '" alt="' + esc(a.name + ', ' + a.complex + ' — фото ' + (i + 1)) + '"' + (i ? ' loading="lazy"' : '') + '>').join('') + '</div>' : '') +
    '<div class="grid"><div>' +
    '<h2>Об апартаментах</h2><div class="desc">' + (a.description ? cleanDesc(a.description) :
      '<p>' + esc(roomsLabel(a.rooms)) + ' в жилом комплексе ' + esc(a.complex) + (a.floor ? ' на ' + a.floor + '-м этаже' : '') + '. Полностью оборудованная кухня, стиральная машина, Smart TV, высокоскоростной Wi-Fi и кондиционер. Заезд круглосуточный, консьерж на связи в Telegram.</p>') + '</div>' +
    (amen.length ? '<h2>Удобства</h2><ul class="amen">' + amen.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul>' : '') +
    '<h2>О комплексе ' + esc(a.complex) + '</h2><p class="desc">' + esc(c.about) + ' <a href="' + c.url + '">Все апартаменты в ' + esc(a.complex) + ' →</a></p>' +
    '<h2>Условия</h2><p class="desc">Заезд с 15:00, выезд до 12:00. Бесплатная отмена до 18:00 дня заезда. Оплата при заселении: наличные, Visa/Mastercard, Humo, UzCard. Скидки: 7+ ночей −10%, 30+ ночей — индивидуально. Временная регистрация для иностранных граждан — бесплатно.</p>' +
    '</div><aside><div class="card">' +
    '<div class="price">$' + pr.wd + ' <small>/ ночь' + (pr.label ? '<span class="tag">' + esc(pr.label) + '</span>' : '') + '</small></div>' +
    '<div style="color:var(--mut);font-size:13px">будни $' + pr.wd + ' · пт–сб $' + pr.we + (pr.label && pr.base !== pr.wd ? ' · обычно $' + pr.base : '') + '</div>' +
    '<a class="btn" href="/?book=' + esc(a.id) + '">Забронировать</a>' +
    '<div style="text-align:center;font-size:12px;color:var(--mut)">подтверждение сразу · без комиссии</div>' +
    '<div class="facts"><span>Тип</span><b>' + esc(roomsLabel(a.rooms)) + '</b><span>Гостей</span><b>до ' + (a.max_guests || 2) + '</b><span>Этаж</span><b>' + (a.floor || '—') + '</b><span>Район</span><b>' + esc(c.district) + '</b></div>' +
    '<div style="font-size:13px;color:var(--mut)">Вопросы: <a href="https://t.me/Arsen_bnb">Telegram @Arsen_bnb</a> · <a href="tel:+998936900044">+998 93 690 00 44</a></div>' +
    '</div></aside></div>' +
    (siblings.length ? '<h2>Другие апартаменты в ' + esc(a.complex) + '</h2><div class="list">' + siblings.map(itemCard).join('') + '</div>' : '') +
    '<p style="color:var(--mut);font-size:13px">Смотрите также: <a href="/apartments">все апартаменты посуточно в Ташкенте</a> · ' + Object.keys(COMPLEX).filter(k => k !== a.complex).map(k => '<a href="' + COMPLEX[k].url + '">' + esc(k) + '</a>').join(' · ') + '</p>';

  return layout({ title, desc, url, image: ph[0] ? img(ph[0], 1200) : '', jsonld: [jsonld, crumbs], body });
}

function pageIndex(list) {
  const byC = {};
  list.forEach(a => { (byC[a.complex] = byC[a.complex] || []).push(a); });
  const min = Math.min.apply(null, list.map(a => priceNow(a).wd).filter(Boolean));
  const url = SITE + '/apartments';
  const title = 'Апартаменты посуточно в Ташкенте — ' + list.length + ' резиденций от $' + min + ' | Urban Luxe';
  const desc = ('Снять апартаменты в Ташкенте посуточно: ' + list.length + ' квартир в Nest One, U-Tower, Gardens Residence, Modera Towers, Mirabad, Kislorod. Заезд 24/7, кухня, Wi-Fi. От $' + min + '/ночь, без комиссии.').slice(0, 158);
  const jsonld = { '@context': 'https://schema.org', '@type': 'ItemList', name: title, itemListElement: list.map((a, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + '/apartments/' + a.id, name: a.name + ' · ' + a.complex })) };
  const body =
    '<div class="crumbs"><a href="/">Главная</a> › Апартаменты</div>' +
    '<h1>Апартаменты посуточно в Ташкенте</h1>' +
    '<p class="sub">' + list.length + ' частных резиденций в лучших жилых комплексах города. Полная кухня, стиральная машина, Smart TV, Wi-Fi. Заезд круглосуточный, подтверждение сразу, оплата при заселении. От $' + min + ' за ночь.</p>' +
    Object.keys(byC).map(k => {
      const c = COMPLEX[k] || {};
      return '<h2 id="' + esc(k.toLowerCase().replace(/\s+/g, '-')) + '">' + esc(k) + ' <small style="font-size:13px;color:var(--mut)">' + esc(c.addr || '') + '</small></h2>' +
        (c.about ? '<p class="desc" style="color:#cfcabd;margin:0 0 10px">' + esc(c.about) + (c.url ? ' <a href="' + c.url + '">О комплексе →</a>' : '') + '</p>' : '') +
        '<div class="list">' + byC[k].map(itemCard).join('') + '</div>';
    }).join('') +
    '<h2>Почему Urban Luxe</h2><div class="desc"><p>Мы выбираем самые новые и продуманные комплексы Ташкента — Tashkent City, Nest One, U-Tower NRG, Gardens Residence, Modera Towers. Каждая квартира — с дизайнерским интерьером, полной кухней и всем необходимым для жизни, а не ночёвки.</p>' +
    '<p>Бронируя напрямую на urbanluxe.cc, вы платите без комиссии площадок, получаете подтверждение мгновенно и консьержа в Telegram 24/7. Командировочным предоставляем отчётные документы, иностранным гостям — бесплатную временную регистрацию.</p></div>';
  return layout({ title, desc, url, image: photos(list[0] || {})[0] ? img(photos(list[0])[0], 1200) : '', jsonld, body });
}

const HDR = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'Netlify-CDN-Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' };

exports.handler = async (event) => {
  try {
    const seg = (event.path || '').split('/').filter(Boolean);
    const id = decodeURIComponent(seg[seg.length - 1] || '');
    const isIndex = !id || id === 'apt-page' || id === 'apartments';
    const q = SB_URL + '/rest/v1/apartments?select=id,name,complex,floor,style,rooms,max_guests,weekday_price,weekend_price,seasonal_prices,description,amenities,photo_url&is_active=eq.true&order=complex.asc,weekday_price.asc';
    const r = await fetch(q, { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
    if (!r.ok) throw new Error('supabase ' + r.status);
    const list = await r.json();
    if (isIndex) return { statusCode: 200, headers: HDR, body: pageIndex(list) };
    const a = list.find(x => x.id === id);
    if (!a) {
      return { statusCode: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: layout({ title: 'Апартамент не найден | Urban Luxe', desc: '', url: SITE + '/apartments', body: '<h1>Апартамент не найден</h1><p><a href="/apartments">Все апартаменты →</a></p>' }) };
    }
    const siblings = list.filter(x => x.complex === a.complex && x.id !== a.id).slice(0, 6);
    return { statusCode: 200, headers: HDR, body: pageApartment(a, siblings) };
  } catch (e) {
    return { statusCode: 500, headers: { 'Content-Type': 'text/plain' }, body: 'error: ' + (e.message || e) };
  }
};
