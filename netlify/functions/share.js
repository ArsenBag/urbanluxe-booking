const https = require('https');

const SB_URL = 'https://sebvfvtofiysbywxjqut.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI';

function fetchApartment(id) {
  return new Promise((resolve) => {
    const u = new URL(`${SB_URL}/rest/v1/apartments`);
    u.searchParams.set('id', `eq.${id}`);
    u.searchParams.set('is_active', 'eq.true');
    u.searchParams.set('select', 'id,name,complex,floor,style,weekday_price,max_guests,description,photo_url');
    u.searchParams.set('limit', '1');
    const opts = {
      hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
      headers: { 'apikey': SB_ANON, 'Authorization': `Bearer ${SB_ANON}` },
    };
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { const a = JSON.parse(body); resolve({apt: Array.isArray(a) && a[0] ? a[0] : null, raw: body, status: res.statusCode}); } catch (e) { resolve({apt: null, raw: body, status: res.statusCode, parseErr: e.message}); } });
    });
    req.on('error', (e) => resolve({apt: null, err: e.message}));
    req.end();
  });
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function firstPhoto(photo_url) {
  try {
    const arr = Array.isArray(photo_url) ? photo_url : JSON.parse(photo_url || '[]');
    const p = arr[0];
    return p && String(p).startsWith('http') ? p : null;
  } catch (e) { return null; }
}

function isCrawler(ua) {
  if (!ua) return true; // нет UA — считаем ботом (Telegram иногда не шлёт UA)
  return /facebookexternalhit|Facebot|Twitterbot|TelegramBot|WhatsApp|LinkedInBot|Pinterest|Slackbot|vkShare|Discordbot|Googlebot|bingbot|redditbot|Applebot|SkypeUriPreview|Telegram/i.test(ua);
}

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const aptId = params.apt || '';
  const forceOg = params._og === '1';
  const debug = params._debug === '1';
  const target = `https://urbanluxe.cc/?apt=${encodeURIComponent(aptId)}`;
  const ua = (event.headers && (event.headers['user-agent'] || event.headers['User-Agent'])) || '';

  // DEBUG: возвращает диагностику в виде JSON (для отладки нами)
  if (debug) {
    const dbg = aptId ? await fetchApartment(aptId) : {note: 'no aptId in query'};
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        received_query: params,
        received_apt_id: aptId,
        received_ua: ua,
        is_crawler: isCrawler(ua),
        force_og: forceOg,
        supabase_response: dbg,
      }, null, 2),
    };
  }

  if (!isCrawler(ua) && !forceOg) {
    return { statusCode: 302, headers: { Location: target, 'Cache-Control': 'no-cache' }, body: '' };
  }

  const result = aptId ? await fetchApartment(aptId) : null;
  const apt = result && result.apt;
  const DEFAULT_IMG = 'https://sebvfvtofiysbywxjqut.supabase.co/storage/v1/object/public/apartments/hero/IMG_6080.jpg';
  let title, desc, image;

  if (apt) {
    const rooms = apt.style || 'Апартамент';
    title = `${apt.name} · ${apt.complex} — Urban Luxe Ташкент`;
    const shortDesc = (apt.description || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    desc = `${rooms}, ${apt.floor} этаж, до ${apt.max_guests || 2} гостей. От $${apt.weekday_price}/ночь. ${shortDesc}`.slice(0, 200);
    image = firstPhoto(apt.photo_url) || DEFAULT_IMG;
  } else {
    title = 'Urban Luxe — Премиальные апартаменты в Ташкенте';
    desc = 'Премиальные апартаменты посуточно в Ташкенте. Заезд 24/7, без комиссии.';
    image = DEFAULT_IMG;
  }

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Urban Luxe">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${esc(target)}">
<meta property="og:locale" content="ru_RU">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0; url=${esc(target)}">
<link rel="canonical" href="${esc(target)}">
</head>
<body>
<p>Переход к апартаменту… <a href="${esc(target)}">Открыть Urban Luxe</a></p>
</body>
</html>`;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600' },
    body: html,
  };
};
