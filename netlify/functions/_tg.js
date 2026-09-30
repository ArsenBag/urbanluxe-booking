// Urban Luxe — _tg.js (30.09.2026). Общий модуль для трёх Telegram-ботов.
//
//  БОТ                 ТОКЕН (env в Netlify)              ЧТО ДЕЛАЕТ                                   ФАЙЛЫ
//  1. Горничные        TELEGRAM_STAFF_BOT_TOKEN           утренние уборки, «сегодня/завтра», ✅ убрано  tg-staff.js, morning-cleaning.js
//  2. Бронеры          TELEGRAM_BOOKER_BOT_TOKEN          «что свободно» по каталогу                     tg-free.js, free.js
//  3. Брони с сайта    TELEGRAM_BOT_TOKEN (старый)        уведомления: новая бронь, отмена, чат, RC      notify.js, rc-webhook.js, cancel-*.js
//
// Пока новый токен не задан, бот 1 и 2 работают на старом TELEGRAM_BOT_TOKEN (fallback) — ничего не ломается.
// Админ везде — TELEGRAM_CHAT_ID (Арсен). Доступ сотрудников — таблица staff (telegram_chat_id + role).
// Роли: 'cleaning' (горничные/хаускиперы) → бот 1; 'booker' (бронеры) и 'ops' (опер-менеджер) → бот 2.
// «/allow 123 Имя опер» — выдать роль ops; без слова — роль бота по умолчанию.
//
// Подключить вебхук (один раз после деплоя, токен наружу не выходит):
//   https://urbanluxe.cc/.netlify/functions/tg-staff?setup=1
//   https://urbanluxe.cc/.netlify/functions/tg-free?setup=1

const SB_URL = process.env.SUPABASE_URL || 'https://sebvfvtofiysbywxjqut.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN = String(process.env.TELEGRAM_CHAT_ID || '').trim();

const TOKENS = {
  staff: process.env.TELEGRAM_STAFF_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN,
  booker: process.env.TELEGRAM_BOOKER_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN,
  bookings: process.env.TELEGRAM_BOT_TOKEN
};

function sb(path, opt) {
  return fetch(SB_URL + '/rest/v1/' + path, Object.assign({}, opt, {
    headers: Object.assign({ apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' }, (opt && opt.headers) || {})
  }));
}

function api(token, method, body) {
  return fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  }).then(r => r.json()).catch(e => ({ ok: false, error: String(e) }));
}

function makeBot(kind, fnName) {
  const token = TOKENS[kind];
  const send = (chatId, text, extra) => api(token, 'sendMessage', Object.assign({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }, extra || {}));
  const edit = (chatId, msgId, text, extra) => api(token, 'editMessageText', Object.assign({ chat_id: chatId, message_id: msgId, text, parse_mode: 'HTML', disable_web_page_preview: true }, extra || {}));
  const answerCb = (id, text) => api(token, 'answerCallbackQuery', { callback_query_id: id, text: text || '' });

  async function setup(withCallbacks, webApp) {
    const base = process.env.URL || 'https://urbanluxe.cc';
    const allowed = withCallbacks ? ['message', 'callback_query'] : ['message'];
    const r = await api(token, 'setWebhook', { url: base + '/.netlify/functions/' + fnName, allowed_updates: allowed });
    // кнопка «меню» слева от поля ввода → Mini App
    if (webApp) await api(token, 'setChatMenuButton', { menu_button: { type: 'web_app', text: webApp.text, web_app: { url: base + webApp.path } } });
    const info = await api(token, 'getWebhookInfo');
    const me = await api(token, 'getMe');
    // Старый бот (брони с сайта) раньше был подключён к tg-free — снимаем с него вебхук, он только шлёт уведомления
    let oldBot = null;
    if (TOKENS.bookings && TOKENS.bookings !== token) {
      const oi = await api(TOKENS.bookings, 'getWebhookInfo');
      if (oi.result && oi.result.url) oldBot = await api(TOKENS.bookings, 'deleteWebhook', { drop_pending_updates: true });
    }
    return { bot: me.result && ('@' + me.result.username), setWebhook: r, webhook: info.result, old_bot_webhook_removed: oldBot };
  }

  // сотрудник по chat_id (только нужная роль); админ проходит всегда
  async function whoIs(chatId, roles) {
    if (chatId === ADMIN) return { admin: true, name: 'Админ', role: 'admin' };
    const r = await sb('staff?select=id,name,role&is_active=eq.true&telegram_chat_id=eq.' + encodeURIComponent(chatId));
    const rows = r.ok ? await r.json() : [];
    const s = rows[0];
    if (!s || (roles && roles.indexOf(s.role) < 0)) return null;
    return s;
  }

  // /allow <chat_id> <Имя> — привязать chat_id к сотруднику (по имени, иначе создать), /deny <chat_id>
  async function adminCommand(chatId, text, role) {
    if (chatId !== ADMIN) return false;
    let m;
    if ((m = text.match(/^\/allow\s+(-?\d+)\s*(.*)$/))) {
      const id = m[1]; let name = (m[2] || '').trim();
      // роль в конце: «/allow 123 Имя опер» → ops, «… бронер» → booker, «… горничная» → cleaning
      const rm = name.match(/\s*(опер\w*|ops|бронер\w*|booker|горничн\w*|cleaning)$/i);
      if (rm) { name = name.slice(0, rm.index).trim(); role = /опер|ops/i.test(rm[1]) ? 'ops' : /брон|booker/i.test(rm[1]) ? 'booker' : 'cleaning'; }
      let ex = await sb('staff?select=id,name,role&telegram_chat_id=eq.' + id).then(r => r.json());
      if (!ex.length && name) ex = await sb('staff?select=id,name,role&name=ilike.' + encodeURIComponent(name)).then(r => r.json());
      if (ex.length) await sb('staff?id=eq.' + ex[0].id, { method: 'PATCH', body: JSON.stringify({ is_active: true, telegram_chat_id: id, role: ex[0].role || role }) });
      else await sb('staff', { method: 'POST', body: JSON.stringify({ name: name || ('Сотрудник ' + id), role, is_active: true, telegram_chat_id: id }) });
      await send(chatId, '✅ Доступ выдан: ' + (ex.length ? ex[0].name : (name || id)) + ' (' + id + ')');
      await send(id, 'Вам открыт доступ к боту Urban Luxe. Напишите /start');
      return true;
    }
    if ((m = text.match(/^\/deny\s+(-?\d+)/))) {
      await sb('staff?telegram_chat_id=eq.' + m[1], { method: 'PATCH', body: JSON.stringify({ telegram_chat_id: null }) });
      await send(chatId, '🚫 Доступ закрыт: ' + m[1]);
      return true;
    }
    if (/^\/who/.test(text)) {
      const rows = await sb('staff?select=name,role,telegram_chat_id&is_active=eq.true&telegram_chat_id=not.is.null&order=role,name').then(r => r.json());
      await send(chatId, rows.length ? rows.map(s => '• ' + s.name + ' — ' + s.role + ' (' + s.telegram_chat_id + ')').join('\n') : 'Никто не подключён');
      return true;
    }
    return false;
  }

  async function denied(chatId, from, role) {
    const who = from ? ((from.first_name || '') + ' ' + (from.last_name || '') + (from.username ? ' @' + from.username : '')).trim() : '';
    await send(chatId, 'Доступ только для сотрудников Urban Luxe. Ваш chat_id: <code>' + chatId + '</code> — передайте администратору.');
    if (ADMIN) await send(ADMIN, '🔔 Запрос доступа (' + kind + '): ' + who + '\nВыдать: <code>/allow ' + chatId + ' Имя</code>');
  }

  return { token, send, edit, answerCb, setup, whoIs, adminCommand, denied, ADMIN, kind };
}

function tashToday(off) { const d = new Date(Date.now() + 5 * 3600 * 1000); d.setUTCDate(d.getUTCDate() + (off || 0)); return d.toISOString().slice(0, 10); }
function ruDate(iso) { return iso.split('-').reverse().join('.'); }
function esc(s) { return String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }

module.exports = { TOKENS, ADMIN, sb, api, makeBot, tashToday, ruDate, esc };
