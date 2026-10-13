// Urban Luxe — notify.js (v2, август 2026)
// Было: часть типов уведомлений (message из чата, modify — изменение дат)
// молча игнорировалась, менеджер не узнавал о сообщениях и запросах гостей.
// Стало: единый обработчик всех типов + понятный формат в Telegram.
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (уже заданы в Netlify).

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function esc(s) {
  return String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}

function buildText(b) {
  const t = String(b.type || '').toLowerCase();
  const apt = b.apartment ? ' · <b>' + esc(b.apartment) + '</b>' : '';
  const who = esc(b.guest_name || 'Гость');
  const dates = (b.check_in && b.check_out) ? '\n📅 ' + esc(b.check_in) + ' → ' + esc(b.check_out) : '';

  if (t === 'new_booking' || t === 'new_request') {
    // 22.09.2026: мессенджеры гостя (guest_telegram / guest_whatsapp) — кликабельные ссылки
    // 14.10.2026: бронь с сайта теперь заявка (status=request) — подтверждает человек в /admin
    const tg = String(b.guest_telegram || '').trim();
    const wa = String(b.guest_whatsapp || '').trim();
    const tgLink = tg ? (tg.charAt(0) === '@' ? 'https://t.me/' + tg.slice(1) : 'https://t.me/+' + tg.replace(/\D/g, '')) : '';
    const waLink = wa ? 'https://wa.me/' + wa.replace(/\D/g, '') : '';
    return '🆕 <b>Новая заявка с сайта</b>' + apt + dates +
      '\n👤 ' + who + (b.guest_phone ? ' · ' + esc(b.guest_phone) : '') +
      (tg ? '\n✈️ Telegram: <a href="' + tgLink + '">' + esc(tg) + '</a>' : '') +
      (wa ? '\n💬 WhatsApp: <a href="' + waLink + '">' + esc(wa) + '</a>' : '') +
      (b.total ? '\n💰 $' + esc(b.total) : '') +
      (b.nights ? ' · ' + esc(b.nights) + ' ноч.' : '') +
      (b.ref ? '\n#️⃣ ' + esc(b.ref) : '') +
      '\n\n⏳ Даты удержаны. Подтвердить или отменить: <a href="https://urbanluxe.cc/admin">urbanluxe.cc/admin</a>';
  }
  if (t === 'request_confirmed') {
    return '✅ <b>Заявка подтверждена</b>' + apt + dates + '\n👤 ' + who + (b.total ? '\n💰 $' + esc(b.total) : '') +
      (b.ref ? '\n#️⃣ ' + esc(b.ref) : '') + (b.actor ? '\n👨‍💼 ' + esc(b.actor) : '') + '\n\nГостю отправлено письмо.';
  }
  if (t === 'request_cancelled') {
    return '❌ <b>Заявка отменена</b>' + apt + dates + '\n👤 ' + who + (b.ref ? '\n#️⃣ ' + esc(b.ref) : '') +
      (b.reason ? '\n📝 ' + esc(b.reason) : '') + (b.actor ? '\n👨‍💼 ' + esc(b.actor) : '') + '\n\nГостю отправлено письмо.';
  }
  if (t === 'cancel' || t === 'cancelled' || t === 'cancellation') {
    return '❌ <b>Отмена брони</b>' + apt + dates + '\n👤 ' + who + (b.ref ? '\n#️⃣ ' + esc(b.ref) : '');
  }
  if (t === 'modify') {
    return '✏️ <b>Запрос на изменение дат</b>' + apt + dates +
      '\n👤 ' + who +
      '\n\n⚠️ Бронь переведена в «ожидает подтверждения» — подтвердите в админке (Заявки).';
  }
  if (t === 'message') {
    return '💬 <b>Сообщение в чате</b>' + apt + '\n👤 ' + who +
      (b.message ? '\n\n«' + esc(String(b.message).slice(0, 500)) + '»' : '') +
      '\n\nОтветить: админка → Чат';
  }
  if (t === 'corporate') {
    // 24.09.2026: запрос с корпоративной страницы /corporate (компании, TMC, экипажи)
    return '🏢 <b>Корпоративный запрос</b>' +
      '\n👤 ' + who + (b.company ? ' · <b>' + esc(b.company) + '</b>' : '') +
      (b.contact ? '\n📞 ' + esc(b.contact) : '') +
      (b.email ? '\n✉️ ' + esc(b.email) : '') +
      dates +
      (b.rooms ? '\n🏠 Квартир: ' + esc(b.rooms) : '') +
      (b.guests ? ' · гостей: ' + esc(b.guests) : '') +
      (b.message ? '\n\n«' + esc(String(b.message).slice(0, 600)) + '»' : '') +
      (b.lang ? '\n🌐 ' + esc(b.lang) : '') +
      '\n\nОтветить в течение часа — корпоративные сравнивают 3–4 предложения.';
  }
  // Неизвестный тип — всё равно показать, чтобы ничего не терялось
  return '🔔 <b>Уведомление</b> (' + esc(t || 'без типа') + ')' + apt + dates +
    '\n👤 ' + who + (b.message ? '\n' + esc(String(b.message).slice(0, 300)) : '');
}

// Серверная отправка (book.js, admin-api.js): тот же текст, та же группа. Никогда не бросает.
async function sendTg(b) {
  try {
    if (!TOKEN || !CHAT) return { ok: false, error: 'TELEGRAM env is not set' };
    const r = await fetch('https://api.telegram.org/bot' + TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, text: buildText(b), parse_mode: 'HTML', disable_web_page_preview: true })
    });
    const out = await r.json();
    return { ok: !!out.ok, error: out.ok ? undefined : out.description };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: 'ok' };
  if (event.httpMethod !== 'POST') return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) };
  let b;
  try { b = JSON.parse(event.body || '{}'); } catch (e) { b = {}; }
  const out = await sendTg(b);
  return { statusCode: 200, headers: HEADERS, body: JSON.stringify(out) };
};
exports.sendTg = sendTg;
exports.buildText = buildText;
