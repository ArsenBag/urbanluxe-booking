// Urban Luxe — tg-free.js (28.09.2026). Telegram-бот «что свободно».
// Бронер пишет боту (тому же, что шлёт уведомления) даты — бот отвечает готовым списком по каталогу.
// Примеры: «5.10»  «5.10-7.10»  «5.10 7.10»  «/free 05.10.2026 09.10.2026»  «сегодня»  «завтра»
//
// Доступ: TELEGRAM_CHAT_ID (Арсен) + сотрудники из таблицы staff с telegram_chat_id (is_active).
// Выдать доступ — Арсен пишет боту:  /allow <chat_id> <Имя>   (chat_id сотрудник узнаёт через /start)
// Забрать доступ:                     /deny <chat_id>
// Подключение вебхука (один раз): открыть https://urbanluxe.cc/.netlify/functions/tg-free?setup=1

const { buildFree } = require('./free.js');
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN = String(process.env.TELEGRAM_CHAT_ID || '').trim();
const SB_URL = process.env.SUPABASE_URL || 'https://sebvfvtofiysbywxjqut.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const sb = (path, opt) => fetch(SB_URL + '/rest/v1/' + path, Object.assign({}, opt, {
  headers: Object.assign({ apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' }, (opt && opt.headers) || {})
}));

async function isAllowed(chatId) {
  if (chatId === ADMIN) return true;
  const r = await sb('staff?select=id&is_active=eq.true&telegram_chat_id=eq.' + encodeURIComponent(chatId));
  const rows = r.ok ? await r.json() : [];
  return rows.length > 0;
}

async function send(chatId, text) {
  await fetch('https://api.telegram.org/bot' + TOKEN + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
  });
}

function tashToday() { return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10); }
function addDays(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

function parseRequest(text) {
  let s = String(text || '').trim().toLowerCase().replace(/^\/(free|svobodno|своб)\S*\s*/i, '');
  if (!s) return null;
  if (/^(сегодня|today)$/.test(s)) return { from: tashToday(), to: addDays(tashToday(), 1) };
  if (/^(завтра|tomorrow)$/.test(s)) return { from: addDays(tashToday(), 1), to: addDays(tashToday(), 2) };
  const dates = s.match(/\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[.\/]\d{1,2}(?:[.\/]\d{2,4})?|\d{1,2}\s*[а-я]{3,}/g);
  if (!dates || !dates.length) return null;
  return { from: dates[0], to: dates[1] || null };
}

const HELP = 'Напишите даты — отвечу списком свободных квартир по каталогу:\n5.10 — одна ночь\n5.10-7.10 — с 5 по 7 октября\nсегодня / завтра';

exports.handler = async (event) => {
  const ok = { statusCode: 200, body: 'ok' }; // Telegram ждёт 200 всегда, иначе повторяет запрос
  if (!TOKEN) return { statusCode: 500, body: 'TELEGRAM_BOT_TOKEN is not set' };

  // ---- разовая настройка вебхука (токен не покидает сервер) ----
  if (event.httpMethod === 'GET') {
    const p = event.queryStringParameters || {};
    if (p.setup) {
      const base = process.env.URL || 'https://urbanluxe.cc';
      const r = await fetch('https://api.telegram.org/bot' + TOKEN + '/setWebhook?url=' + encodeURIComponent(base + '/.netlify/functions/tg-free') + '&allowed_updates=%5B%22message%22%5D').then(x => x.json());
      const info = await fetch('https://api.telegram.org/bot' + TOKEN + '/getWebhookInfo').then(x => x.json());
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ setWebhook: r, webhook: info.result }) };
    }
    return { statusCode: 200, body: 'tg-free: POST from Telegram only' };
  }
  if (event.httpMethod !== 'POST') return ok;

  let upd; try { upd = JSON.parse(event.body || '{}'); } catch (e) { return ok; }
  const msg = upd.message || upd.edited_message;
  if (!msg || !msg.text) return ok;
  const chatId = String(msg.chat.id);
  const text = msg.text.trim();

  if (/^\/start/.test(text)) {
    await send(chatId, 'Urban Luxe · бот занятости.\nВаш chat_id: ' + chatId + '\n\n' + HELP);
    return ok;
  }

  // ---- админ: выдать / забрать доступ ----
  let m;
  if (chatId === ADMIN && (m = text.match(/^\/allow\s+(-?\d+)\s*(.*)$/))) {
    const id = m[1], name = (m[2] || '').trim() || ('Сотрудник ' + id);
    const ex = await sb('staff?select=id,name&telegram_chat_id=eq.' + id).then(r => r.json());
    if (ex.length) await sb('staff?telegram_chat_id=eq.' + id, { method: 'PATCH', body: JSON.stringify({ is_active: true }) });
    else await sb('staff', { method: 'POST', body: JSON.stringify({ name, role: 'бронер', is_active: true, telegram_chat_id: id }) });
    await send(chatId, '✅ Доступ выдан: ' + (ex.length ? ex[0].name : name) + ' (' + id + ')');
    await send(id, 'Вам открыт доступ к боту занятости Urban Luxe.\n\n' + HELP).catch(() => {});
    return ok;
  }
  if (chatId === ADMIN && (m = text.match(/^\/deny\s+(-?\d+)/))) {
    await sb('staff?telegram_chat_id=eq.' + m[1], { method: 'PATCH', body: JSON.stringify({ telegram_chat_id: null }) });
    await send(chatId, '🚫 Доступ закрыт: ' + m[1]);
    return ok;
  }

  if (!(await isAllowed(chatId))) {
    await send(chatId, 'Доступ только для сотрудников Urban Luxe. Ваш chat_id: ' + chatId + ' — передайте его администратору.');
    if (ADMIN) await send(ADMIN, '🔔 Запрос доступа к боту занятости: ' + (msg.from && (msg.from.first_name || '') + ' ' + (msg.from.last_name || '') + (msg.from.username ? ' @' + msg.from.username : '')).trim() + '\nВыдать: /allow ' + chatId + ' Имя');
    return ok;
  }
  const q = parseRequest(text);
  if (!q) { await send(chatId, 'Не понял даты. ' + HELP); return ok; }
  try {
    const res = await buildFree(q.from, q.to);
    await send(chatId, res.text);
  } catch (e) {
    await send(chatId, 'Не удалось получить занятость: ' + String(e.message || e));
  }
  return ok;
};
