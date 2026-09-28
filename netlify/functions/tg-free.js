// Urban Luxe — tg-free.js (28.09.2026). Telegram-бот «что свободно».
// Бронер пишет боту (тому же, что шлёт уведомления) даты — бот отвечает готовым списком по каталогу.
// Примеры сообщений: «5.10»  «5.10-7.10»  «5.10 7.10»  «/free 05.10.2026 09.10.2026»  «сегодня»  «завтра»
// Отвечает только разрешённым чатам: TELEGRAM_CHAT_ID (менеджер) + TELEGRAM_STAFF_CHAT_IDS (через запятую).
// Подключение (один раз, Арсен): открыть в браузере
//   https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://urbanluxe.cc/.netlify/functions/tg-free
// и убедиться, что ответ {"ok":true}. Узнать chat_id сотрудника: он пишет боту /start — бот отвечает его id.

const { buildFree } = require('./free.js');
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function allowedChats() {
  const ids = [process.env.TELEGRAM_CHAT_ID].concat(String(process.env.TELEGRAM_STAFF_CHAT_IDS || '').split(','));
  return new Set(ids.map(s => String(s || '').trim()).filter(Boolean));
}

async function send(chatId, text) {
  await fetch('https://api.telegram.org/bot' + TOKEN + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
  });
}

function tashToday() { return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10); }
function addDays(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

// Текст сообщения → {from, to} или null
function parseRequest(text) {
  let s = String(text || '').trim().toLowerCase().replace(/^\/(free|svobodno|своб)\S*\s*/i, '');
  if (!s) return null;
  if (/^(сегодня|today)$/.test(s)) return { from: tashToday(), to: addDays(tashToday(), 1) };
  if (/^(завтра|tomorrow)$/.test(s)) return { from: addDays(tashToday(), 1), to: addDays(tashToday(), 2) };
  const dates = s.match(/\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[.\/]\d{1,2}(?:[.\/]\d{2,4})?|\d{1,2}\s*[а-я]{3,}/g);
  if (!dates || !dates.length) return null;
  return { from: dates[0], to: dates[1] || null };
}

exports.handler = async (event) => {
  const ok = { statusCode: 200, body: 'ok' }; // Telegram ждёт 200 всегда, иначе повторяет запрос
  if (event.httpMethod !== 'POST' || !TOKEN) return ok;
  let upd; try { upd = JSON.parse(event.body || '{}'); } catch (e) { return ok; }
  const msg = upd.message || upd.edited_message;
  if (!msg || !msg.text) return ok;
  const chatId = String(msg.chat.id);
  const text = msg.text.trim();

  if (/^\/start/.test(text)) {
    await send(chatId, 'Urban Luxe · бот занятости.\nВаш chat_id: ' + chatId + '\n\nНапишите даты — отвечу списком свободных квартир по каталогу:\n5.10 — одна ночь\n5.10-7.10 — с 5 по 7 октября\nсегодня / завтра');
    return ok;
  }
  if (!allowedChats().has(chatId)) {
    await send(chatId, 'Доступ только для сотрудников Urban Luxe. Ваш chat_id: ' + chatId + ' — передайте его администратору.');
    return ok;
  }
  const q = parseRequest(text);
  if (!q) {
    await send(chatId, 'Не понял даты. Примеры: «5.10», «5.10-7.10», «05.10.2026 09.10.2026», «сегодня», «завтра».');
    return ok;
  }
  try {
    const res = await buildFree(q.from, q.to);
    await send(chatId, res.text);
  } catch (e) {
    await send(chatId, 'Не удалось получить занятость: ' + String(e.message || e));
  }
  return ok;
};
