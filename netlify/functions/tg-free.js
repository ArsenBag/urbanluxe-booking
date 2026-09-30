// Urban Luxe — tg-free.js (30.09.2026). БОТ 2: бронеры — «что свободно».
// Токен: TELEGRAM_BOOKER_BOT_TOKEN (fallback — TELEGRAM_BOT_TOKEN). Доступ: staff.role = 'booker'.
//
// Бронер пишет даты — бот отвечает готовым списком по каталогу (t.me/UrbanLuxehotel/242) с фото-ссылками:
//   «5.10»  «5.10-7.10»  «5.10 7.10»  «05.10.2026 09.10.2026»  «сегодня»  «завтра»
// Админ: /allow <chat_id> Имя · /deny <chat_id> · /who
// Подключение вебхука: https://urbanluxe.cc/.netlify/functions/tg-free?setup=1

const T = require('./_tg.js');
const { buildFree } = require('./free.js');
const bot = T.makeBot('booker', 'tg-free');
const ROLE = 'booker';

function parseRequest(text) {
  let s = String(text || '').trim().toLowerCase().replace(/^\/(free|svobodno|своб)\S*\s*/i, '');
  if (!s) return null;
  if (/^(сегодня|today)$/.test(s)) return { from: T.tashToday(0), to: T.tashToday(1) };
  if (/^(завтра|tomorrow)$/.test(s)) return { from: T.tashToday(1), to: T.tashToday(2) };
  const dates = s.match(/\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[.\/]\d{1,2}(?:[.\/]\d{2,4})?|\d{1,2}\s*[а-я]{3,}/g);
  if (!dates || !dates.length) return null;
  return { from: dates[0], to: dates[1] || null };
}

const HELP = 'Напишите даты — отвечу списком свободных квартир по каталогу:\n<b>5.10</b> — одна ночь\n<b>5.10-7.10</b> — с 5 по 7 октября\n<b>сегодня</b> / <b>завтра</b>';

exports.handler = async (event) => {
  const ok = { statusCode: 200, body: 'ok' };
  if (!bot.token) return { statusCode: 500, body: 'TELEGRAM_BOOKER_BOT_TOKEN is not set' };
  if (event.httpMethod === 'GET') {
    if ((event.queryStringParameters || {}).setup) return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(await bot.setup(false)) };
    return { statusCode: 200, body: 'tg-free: POST from Telegram only' };
  }
  if (event.httpMethod !== 'POST') return ok;
  let upd; try { upd = JSON.parse(event.body || '{}'); } catch (e) { return ok; }
  const msg = upd.message || upd.edited_message;
  if (!msg || !msg.text) return ok;
  const chatId = String(msg.chat.id), text = msg.text.trim();

  if (/^\/start/.test(text)) {
    const st = await bot.whoIs(chatId, [ROLE]);
    await bot.send(chatId, (st ? 'Здравствуйте, ' + T.esc(st.name) + '! ' : '') + 'Urban Luxe · бот занятости.\nВаш chat_id: <code>' + chatId + '</code>\n\n' + HELP);
    return ok;
  }
  if (await bot.adminCommand(chatId, text, ROLE)) return ok;

  const st = await bot.whoIs(chatId, [ROLE]);
  if (!st) { await bot.denied(chatId, msg.from, ROLE); return ok; }

  const q = parseRequest(text);
  if (!q) { await bot.send(chatId, 'Не понял даты. ' + HELP); return ok; }
  try {
    const res = await buildFree(q.from, q.to);
    await bot.send(chatId, res.text, { parse_mode: undefined }); // текст без HTML — как есть, копируется клиенту
  } catch (e) {
    await bot.send(chatId, 'Не удалось получить занятость: ' + T.esc(e.message || e));
  }
  return ok;
};
