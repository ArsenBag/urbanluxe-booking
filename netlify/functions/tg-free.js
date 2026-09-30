// Urban Luxe — tg-free.js (30.09.2026). БОТ 2: бронеры + опер-менеджер.
// Токен: TELEGRAM_BOOKER_BOT_TOKEN (fallback — TELEGRAM_BOT_TOKEN). Доступ: staff.role = 'booker' | 'ops'.
//
// 1) Что свободно: «5.10», «5.10-7.10», «сегодня», «завтра» → готовый список клиенту по каталогу с фото-ссылками.
// 2) Лист заездов (замена Google-таблицы): «лист», «лист завтра», «лист 3.10» → сводка дня с кнопками по квартирам;
//    карточка квартиры — галочки паспорт/доступ/регистрация/оплата/отзыв; текстом: «ю100 площадка bnb», «100 заезд 18:00»,
//    «100 оплата 100 из 230», «100 гостей 2», «100 гость Имя», «100 заметка …». «лист + 100» — добавить строку вручную.
//    Каждая отметка бронера уходит опер-менеджеру (role=ops) короткой строкой; кнопка «📢 Сообщить опер-менеджеру» — вся карточка.
// Админ: /allow <chat_id> Имя [опер|бронер] · /deny <chat_id> · /who
// Подключение вебхука: https://urbanluxe.cc/.netlify/functions/tg-free?setup=1

const T = require('./_tg.js');
const { buildFree, parseDate } = require('./free.js');
const OPS = require('./ops.js');
const bot = T.makeBot('booker', 'tg-free');
const ROLES = ['booker', 'ops'];

function parseRequest(text) {
  let s = String(text || '').trim().toLowerCase().replace(/^\/(free|svobodno|своб)\S*\s*/i, '');
  if (!s) return null;
  if (/^(сегодня|today)$/.test(s)) return { from: T.tashToday(0), to: T.tashToday(1) };
  if (/^(завтра|tomorrow)$/.test(s)) return { from: T.tashToday(1), to: T.tashToday(2) };
  const dates = s.match(/\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[.\/]\d{1,2}(?:[.\/]\d{2,4})?|\d{1,2}\s*[а-я]{3,}/g);
  if (!dates || !dates.length) return null;
  return { from: dates[0], to: dates[1] || null };
}
function parseListDate(s) {
  s = (s || '').trim().toLowerCase();
  if (!s || /^сегодня$/.test(s)) return T.tashToday(0);
  if (/^завтра$/.test(s)) return T.tashToday(1);
  if (/^вчера$/.test(s)) return T.tashToday(-1);
  return parseDate(s, '2020-01-01') || T.tashToday(0);
}

const HELP = '<b>Что свободно:</b> напишите даты — <code>5.10</code>, <code>5.10-7.10</code>, <code>сегодня</code>, <code>завтра</code>.\n' +
  '<b>Лист заездов:</b> кнопка «📋 Лист» внизу — таблица с календарём; или текстом <code>лист</code>, <code>лист завтра</code>.\n' +
  'Поля текстом: <code>ю100 площадка bnb</code> · <code>100 заезд 18:00</code> · <code>100 оплата 100 из 230</code> · <code>100 гостей 2</code>';

async function notifyOps(fromStaff, text) {
  const rows = await T.sb('staff?select=telegram_chat_id&is_active=eq.true&role=eq.ops&telegram_chat_id=not.is.null').then(r => r.json()).catch(() => []);
  const ids = new Set(rows.map(r => r.telegram_chat_id));
  if (bot.ADMIN) ids.add(bot.ADMIN);
  for (const id of ids) { if (fromStaff && String(fromStaff.chat_id) === String(id)) continue; await bot.send(id, text); }
}

const APP_BTN = () => [{ text: '📋 Открыть таблицу', web_app: { url: (process.env.URL || 'https://urbanluxe.cc') + '/ops.html' } }];
async function showList(chatId, date, msgId) {
  await OPS.ensureDay(date);
  const s = OPS.summary(date, await OPS.getRows(date));
  s.reply_markup.inline_keyboard.unshift(APP_BTN());
  if (msgId) return bot.edit(chatId, msgId, s.text, { reply_markup: s.reply_markup });
  return bot.send(chatId, s.text, { reply_markup: s.reply_markup });
}
async function showCard(chatId, row, msgId) {
  const c = OPS.rowCard(row);
  if (msgId) return bot.edit(chatId, msgId, c.text, { reply_markup: c.reply_markup });
  return bot.send(chatId, c.text, { reply_markup: c.reply_markup });
}

exports.handler = async (event) => {
  const ok = { statusCode: 200, body: 'ok' };
  if (!bot.token) return { statusCode: 500, body: 'TELEGRAM_BOOKER_BOT_TOKEN is not set' };
  if (event.httpMethod === 'GET') {
    if ((event.queryStringParameters || {}).setup) return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(await bot.setup(true, { text: '📋 Лист', path: '/ops.html' })) };
    return { statusCode: 200, body: 'tg-free: POST from Telegram only' };
  }
  if (event.httpMethod !== 'POST') return ok;
  let upd; try { upd = JSON.parse(event.body || '{}'); } catch (e) { return ok; }

  // ---------- кнопки ----------
  if (upd.callback_query) {
    const cq = upd.callback_query, chatId = String(cq.message.chat.id), mid = cq.message.message_id;
    const st = await bot.whoIs(chatId, ROLES);
    if (!st) { await bot.answerCb(cq.id, 'Нет доступа'); return ok; }
    const p = String(cq.data || '').split('|');
    try {
      if (p[0] === 'ops') { await bot.answerCb(cq.id); await showList(chatId, p[1], mid); }
      else if (p[0] === 'op') { const r = await OPS.getRow(p[1]); await bot.answerCb(cq.id); if (r) await showCard(chatId, r); }
      else if (p[0] === 'tg') {
        if (p[2] === 'notify') {
          const r = await OPS.getRow(p[1]);
          if (r) { await notifyOps({ chat_id: chatId }, '📢 От ' + T.esc(st.name) + ':\n\n' + OPS.rowCard(r).text.split('\n<i>Изменить')[0]); }
          await bot.answerCb(cq.id, 'Отправлено опер-менеджеру');
        } else {
          const res = await OPS.applyToggle(p[1], p[2], st.name);
          if (!res) { await bot.answerCb(cq.id, 'Строка не найдена'); return ok; }
          if (res.error) { await bot.answerCb(cq.id); await bot.send(chatId, res.error); return ok; }
          await bot.answerCb(cq.id, 'Сохранено');
          await showCard(chatId, res.row, mid);
          if (st.role !== 'ops') {
            const labels = { passport: 'Паспорт', access: 'Доступ', registration: 'Регистрация', reg_sent: 'Рег. отправлена', confirm_checkin: 'Заезд уточнён', confirm_checkout: 'Выезд уточнён', paid_full: 'Оплата', review: 'Отзыв' };
            const v = res.changed === 'registration' ? res.row.registration : (res.changed === 'paid_full' ? (Number(res.row.payment_paid) >= Number(res.row.payment_total) ? '☑' : '☐') : (res.row[res.changed] ? '☑' : '☐'));
            await notifyOps({ chat_id: chatId }, '🔔 <b>' + T.esc(res.row.short) + '</b> ' + T.ruDate(res.row.date) + ': ' + labels[res.changed] + ' → ' + T.esc(v) + ' <i>(' + T.esc(st.name) + ')</i>');
          }
        }
      }
    } catch (e) { await bot.answerCb(cq.id, 'Ошибка'); await bot.send(chatId, 'Ошибка: ' + T.esc(e.message || e)); }
    return ok;
  }

  // ---------- сообщения ----------
  const msg = upd.message || upd.edited_message;
  if (!msg || !msg.text) return ok;
  const chatId = String(msg.chat.id), text = msg.text.trim();

  if (/^\/start/.test(text)) {
    const st = await bot.whoIs(chatId, ROLES);
    await bot.send(chatId, (st ? 'Здравствуйте, ' + T.esc(st.name) + '! ' : '') + 'Urban Luxe · бот бронеров.\nВаш chat_id: <code>' + chatId + '</code>\n\n' + HELP, st ? { reply_markup: { inline_keyboard: [APP_BTN()] } } : {});
    return ok;
  }
  if (await bot.adminCommand(chatId, text, 'booker')) return ok;

  const st = await bot.whoIs(chatId, ROLES);
  if (!st) { await bot.denied(chatId, msg.from, 'booker'); return ok; }
  st.chat_id = chatId;

  let m;
  try {
    // лист заездов
    if ((m = text.match(/^(лист|список|\/list|\/ops)\s*(\+\s*(\S+))?\s*(.*)$/i))) {
      if (m[3]) { const r = await OPS.addRow(parseListDate(m[4]), m[3], st.name); if (r.error) await bot.send(chatId, r.error); else await showCard(chatId, r.row); }
      else await showList(chatId, parseListDate(m[4]));
      return ok;
    }
    // поле карточки: «ю100 площадка bnb» / «100 оплата 100 из 230» / «100 заметка …» [дата в конце не поддерживаем — сегодня]
    if ((m = text.match(/^([a-zа-яё]{0,3}\s?\d{1,4})\s+(площадка|источник|заезд|выезд|гостей|чел|людей|гость|имя|заметка|коммент|оплата|опл)\s+([\s\S]+)$/i))) {
      let date = T.tashToday(0), value = m[3].trim();
      const dm = value.match(/\s+(завтра|\d{1,2}\.\d{1,2})$/i); // «100 заезд 18:00 завтра»
      if (dm && !/^(заметка|коммент|гость|имя)$/i.test(m[2])) { date = parseListDate(dm[1]); value = value.slice(0, dm.index).trim(); }
      const r = await OPS.setField(date, m[1], m[2], value, st.name);
      if (r.error) await bot.send(chatId, r.error); else await showCard(chatId, r.row);
      return ok;
    }
    // что свободно
    const q = parseRequest(text);
    if (!q) { await bot.send(chatId, 'Не понял. ' + HELP); return ok; }
    const res = await buildFree(q.from, q.to);
    await bot.send(chatId, res.text, { parse_mode: undefined });
  } catch (e) {
    await bot.send(chatId, 'Ошибка: ' + T.esc(e.message || e));
  }
  return ok;
};
