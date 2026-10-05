// Urban Luxe — tg-staff.js (30.09.2026). БОТ 1: горничные и хаускиперы.
// !!! 01.10.2026: ЗАМЕНЁН housekeeping-ботом (папка housekeeping/, свой VPS). Оставлен только для ?off=1 и как запасной вариант.
// Токен: TELEGRAM_STAFF_BOT_TOKEN (fallback — TELEGRAM_BOT_TOKEN). Доступ: staff.role = 'cleaning'.
//
// Горничная пишет:  сегодня / завтра  → список уборок с кнопками «✅ Убрано»
//                   /start            → свой chat_id + подсказка
// Кнопка «✅ Убрано» → cleaning_tasks (как в staff.html), сообщение обновляется.
// Админ: /allow <chat_id> Имя · /deny <chat_id> · /who · /all <текст> (рассылка всем горничным)
// Утреннее сообщение 07:30 шлёт morning-cleaning.js этим же ботом в TELEGRAM_CLEANING_CHAT_ID.
// Подключение вебхука: https://urbanluxe.cc/.netlify/functions/tg-staff?setup=1

const T = require('./_tg.js');
const bot = T.makeBot('staff', 'tg-staff');
const ROLE = 'cleaning';

async function dayData(d) {
  const base = process.env.URL || 'https://urbanluxe.cc';
  const [ical, aptsRes, tasksRes] = await Promise.all([
    fetch(base + '/.netlify/functions/sync-ical').then(r => r.json()),
    T.sb('apartments?select=id,name,complex,floor&is_active=eq.true'),
    T.sb('cleaning_tasks?select=apartment_id,done&date=eq.' + d)
  ]);
  const apts = {}; (await aptsRes.json()).forEach(a => { apts[a.id] = a; });
  const done = new Set(); (await tasksRes.json()).forEach(t => { if (t.done) done.add(t.apartment_id); });
  const all = ical.all_bookings || [];
  const checkins = all.filter(b => b.check_in === d && apts[b.apartment_id]);
  const ciSet = new Set(checkins.map(b => b.apartment_id));
  const cleanings = all.filter(b => b.check_out === d && apts[b.apartment_id]).map(b => {
    const a = apts[b.apartment_id];
    return { id: b.apartment_id, label: a.name + ' (' + (a.complex || '') + (a.floor ? ', эт. ' + a.floor : '') + ')', urgent: ciSet.has(b.apartment_id), done: done.has(b.apartment_id) };
  }).sort((x, y) => (y.urgent - x.urgent) || x.label.localeCompare(y.label));
  return { date: d, cleanings, checkins: checkins.map(b => ({ label: apts[b.apartment_id].name + ' (' + (apts[b.apartment_id].complex || '') + ')', nights: b.nights })) };
}

function render(dd, title) {
  const left = dd.cleanings.filter(c => !c.done).length;
  let t = '🧹 <b>' + title + ' — ' + T.ruDate(dd.date) + '</b>\n';
  if (!dd.cleanings.length) t += '\nВыездов нет — уборок нет 🎉\n';
  else {
    t += 'Уборок: ' + dd.cleanings.length + ' · осталось: ' + left + '\n\n';
    dd.cleanings.forEach(c => { t += (c.done ? '✅ ' : (c.urgent ? '⚡ ' : '• ')) + T.esc(c.label) + (c.urgent && !c.done ? ' — <b>срочно, сегодня заезд</b>' : '') + '\n'; });
  }
  if (dd.checkins.length) { t += '\n🔑 Заезды: ' + dd.checkins.length + '\n'; dd.checkins.forEach(c => { t += '• ' + T.esc(c.label) + ' — ' + c.nights + ' ноч.\n'; }); }
  const buttons = dd.cleanings.filter(c => !c.done).map(c => [{ text: '✅ Убрано: ' + c.label.split(' (')[0], callback_data: 'done|' + c.id + '|' + dd.date }]);
  return { text: t, reply_markup: buttons.length ? { inline_keyboard: buttons } : undefined };
}

async function sendDay(chatId, off, msgId) {
  const dd = await dayData(T.tashToday(off));
  const r = render(dd, off ? 'Уборки завтра' : 'Уборки сегодня');
  if (msgId) return bot.edit(chatId, msgId, r.text, { reply_markup: r.reply_markup });
  return bot.send(chatId, r.text, { reply_markup: r.reply_markup });
}

const HELP = 'Напишите <b>сегодня</b> или <b>завтра</b> — пришлю список уборок с кнопками «✅ Убрано».';

exports.handler = async (event) => {
  const ok = { statusCode: 200, body: 'ok' };
  if (!bot.token) return { statusCode: 500, body: 'TELEGRAM_STAFF_BOT_TOKEN is not set' };
  if (event.httpMethod === 'GET') {
    // 01.10.2026: бот «Уборки» передан housekeeping-боту (polling). Перед его запуском снять вебхук: ?off=1
    if ((event.queryStringParameters || {}).off) return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(await T.api(bot.token, 'deleteWebhook', { drop_pending_updates: true })) };
    if ((event.queryStringParameters || {}).setup) return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(await bot.setup(true)) };
    return { statusCode: 200, body: 'tg-staff: POST from Telegram only' };
  }
  if (event.httpMethod !== 'POST') return ok;
  let upd; try { upd = JSON.parse(event.body || '{}'); } catch (e) { return ok; }

  // ---- кнопка «Убрано» ----
  if (upd.callback_query) {
    const cq = upd.callback_query, chatId = String(cq.message.chat.id);
    const st = await bot.whoIs(chatId, [ROLE]);
    if (!st) { await bot.answerCb(cq.id, 'Нет доступа'); return ok; }
    const p = String(cq.data || '').split('|');
    if (p[0] === 'done' && p[1] && p[2]) {
      await T.sb('cleaning_tasks?on_conflict=apartment_id,date', {
        method: 'POST', headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
        body: JSON.stringify([{ apartment_id: p[1], date: p[2], done: true, done_by: st.admin ? null : st.id, done_at: new Date().toISOString() }])
      });
      await bot.answerCb(cq.id, 'Отмечено ✅');
      const off = p[2] === T.tashToday(0) ? 0 : 1;
      await sendDay(chatId, off, cq.message.message_id);
      if (bot.ADMIN && chatId !== bot.ADMIN) await bot.send(bot.ADMIN, '✅ ' + T.esc(st.name) + ' убрала ' + T.esc(p[1]) + ' (' + T.ruDate(p[2]) + ')');
    }
    return ok;
  }

  const msg = upd.message || upd.edited_message;
  if (!msg || !msg.text) return ok;
  const chatId = String(msg.chat.id), text = msg.text.trim();

  if (/^\/start/.test(text)) {
    const st = await bot.whoIs(chatId, [ROLE]);
    await bot.send(chatId, (st ? 'Здравствуйте, ' + T.esc(st.name) + '! ' : '') + 'Urban Luxe · бот уборок.\nВаш chat_id: <code>' + chatId + '</code>\n\n' + HELP);
    return ok;
  }
  if (await bot.adminCommand(chatId, text, ROLE)) return ok;

  // рассылка горничным от админа
  let m;
  if (chatId === bot.ADMIN && (m = text.match(/^\/all\s+([\s\S]+)/))) {
    const rows = await T.sb('staff?select=telegram_chat_id&is_active=eq.true&role=eq.' + ROLE + '&telegram_chat_id=not.is.null').then(r => r.json());
    for (const s of rows) await bot.send(s.telegram_chat_id, '📢 ' + T.esc(m[1]));
    await bot.send(chatId, 'Отправлено: ' + rows.length);
    return ok;
  }

  const st = await bot.whoIs(chatId, [ROLE]);
  if (!st) { await bot.denied(chatId, msg.from, ROLE); return ok; }

  const s = text.toLowerCase();
  try {
    if (/^(сегодня|bugun|today|\/today)$/.test(s)) await sendDay(chatId, 0);
    else if (/^(завтра|ertaga|tomorrow|\/tomorrow)$/.test(s)) await sendDay(chatId, 1);
    else await bot.send(chatId, HELP);
  } catch (e) {
    await bot.send(chatId, 'Ошибка: ' + T.esc(e.message || e));
  }
  return ok;
};
