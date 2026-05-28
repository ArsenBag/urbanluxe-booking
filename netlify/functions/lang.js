/* Urban Luxe — мультиязычные страницы /en и /uz.
   Один источник — index.html (RU). Эта функция берёт главную, подменяет
   в <head> title/description/og/lang/canonical под нужный язык, вставляет
   hreflang и авто-переключение языка (setLang), и Netlify-rewrite отдаёт её на /en и /uz.
   Краулеры (Google, Яндекс) получают готовые переведённые мета-теги в HTML. */
const https = require('https');

const ORIGIN = 'https://urbanluxe.cc';

const T = {
  en: {
    lang: 'en',
    locale: 'en_US',
    path: '/en',
    title: 'Urban Luxe — Premium Serviced Apartments in Tashkent',
    desc: 'Daily rental of premium apartments in Tashkent from $85/night. 25 units across Nest One, U-Tower, Mirabad and Kislorod. Wi-Fi, full kitchen, parking, 24/7 check-in. Book direct — no commission.',
    ogDesc: '25 premium apartments in the best residences of Tashkent from $85/night. Full kitchen, Wi-Fi, 24/7 concierge. Book direct — no commission.',
  },
  uz: {
    lang: 'uz',
    locale: 'uz_UZ',
    path: '/uz',
    title: 'Urban Luxe — Toshkentdagi premium kvartiralar',
    desc: 'Toshkentda premium kvartiralarni sutkalik ijaraga olish — $85/kechadan. Nest One, U-Tower, Mirabad va Kislorod majmualarida 25 ta kvartira. Wi-Fi, oshxona, parking, 24/7 kirish. To‘g‘ridan-to‘g‘ri, komissiyasiz band qiling.',
    ogDesc: 'Toshkentning eng yaxshi majmualarida 25 ta premium kvartira — $85/kechadan. To‘liq oshxona, Wi-Fi, 24/7 konserj. To‘g‘ridan-to‘g‘ri, komissiyasiz band qiling.',
  },
};

function escAttr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function fetchHome() {
  return new Promise((resolve, reject) => {
    https.get(ORIGIN + '/', { headers: { 'User-Agent': 'UrbanLuxeLangFn' } }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

function buildHead(lang) {
  const t = T[lang];
  const url = ORIGIN + t.path;
  const hreflang =
    `\n<link rel="alternate" hreflang="ru" href="${ORIGIN}/">` +
    `\n<link rel="alternate" hreflang="en" href="${ORIGIN}/en">` +
    `\n<link rel="alternate" hreflang="uz" href="${ORIGIN}/uz">` +
    `\n<link rel="alternate" hreflang="x-default" href="${ORIGIN}/">` +
    // canonical и og:locale инжектируем явно — seo-map-upgrade.js их не тронет (создаёт только при отсутствии)
    `\n<link rel="canonical" href="${url}">` +
    `\n<meta property="og:locale" content="${t.locale}">`;
  const altLocales = Object.keys(T)
    .filter((k) => k !== lang)
    .map((k) => `\n<meta property="og:locale:alternate" content="${T[k].locale}">`)
    .join('') + `\n<meta property="og:locale:alternate" content="ru_RU">`;
  const forceScript =
    `\n<script>(function(){var L=${JSON.stringify(lang)};function go(){try{if(window.setLang)setLang(L);}catch(e){}}` +
    `if(document.readyState!=='loading')go();else document.addEventListener('DOMContentLoaded',go);` +
    `setTimeout(go,400);setTimeout(go,1200);})();</script>`;
  return { t, url, hreflang, altLocales, forceScript };
}

exports.handler = async (event) => {
  // Язык берём из пути (/.netlify/functions/lang/en) — Netlify-rewrite query-параметры теряет.
  // Query (?lang=en) оставлен как запасной вход для прямого вызова/отладки.
  const params = event.queryStringParameters || {};
  const seg = (event.path || '').split('/').filter(Boolean).pop();
  const cand = params.lang || ((seg === 'en' || seg === 'uz') ? seg : null);
  const lang = (cand === 'uz') ? 'uz' : (cand === 'en' ? 'en' : null);
  if (!lang) {
    return { statusCode: 302, headers: { Location: ORIGIN + '/' }, body: '' };
  }

  let html;
  try {
    html = await fetchHome();
  } catch (e) {
    return { statusCode: 302, headers: { Location: ORIGIN + '/' }, body: '' };
  }

  const { t, url, hreflang, altLocales, forceScript } = buildHead(lang);

  // Подмена мета-тегов (толерантные регэкспы; функция-замена, чтобы '$' в тексте не ломал результат)
  const set = (re, val) => { html = html.replace(re, (m, p1, p2) => p1 + val + p2); };
  html = html
    .replace(/<html\s+lang="ru"/i, () => `<html lang="${t.lang}"`)
    .replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escHtml(t.title)}</title>`);
  set(/(<meta\s+name="description"\s+content=")[^"]*("\s*\/?>)/i, escAttr(t.desc));
  set(/(<meta\s+property="og:title"\s+content=")[^"]*("\s*\/?>)/i, escAttr(t.title));
  set(/(<meta\s+property="og:description"\s+content=")[^"]*("\s*\/?>)/i, escAttr(t.ogDesc));
  set(/(<meta\s+property="og:locale"\s+content=")[^"]*("\s*\/?>)/i, t.locale);
  set(/(<meta\s+property="og:url"\s+content=")[^"]*("\s*\/?>)/i, url);
  set(/(<link\s+rel="canonical"\s+href=")[^"]*("\s*\/?>)/i, url);

  // i18n.js подключён относительным путём — на /en он бы резолвился в /.netlify/functions/i18n.js (404).
  // Делаем абсолютным, иначе setLang не определится и контент не переключится.
  html = html.replace(/(<script[^>]+src=")i18n\.js(")/i, (m, p1, p2) => p1 + '/i18n.js' + p2);

  // Вставка hreflang + альтернативных локалей + авто-переключения языка перед </head>
  html = html.replace(/<\/head>/i, `${hreflang}${altLocales}${forceScript}\n</head>`);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600' },
    body: html,
  };
};
