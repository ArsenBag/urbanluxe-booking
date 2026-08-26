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

  if (t === 'new_booking') {
    return '🆕 <b>Новая бронь!</b>' + apt + dates +
      '\n👤 ' + who + (b.guest_phone ? ' · ' + esc(b.guest_phone) : '') +
      (b.total ? '\n💰 $' + esc(b.total) : '') +
      (b.nights ? ' · ' + esc(b.nights) + ' ноч.' : '') +
      (b.ref ? '\n#️⃣ ' + esc(b.ref) : '');
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
  // Неизвестный тип — всё равно показать, чтобы ничего не терялось
  return '🔔 <b>Уведомление</b> (' + esc(t || 'без типа') + ')' + apt + dates +
    '\n👤 ' + who + (b.message ? '\n' + esc(String(b.message).slice(0, 300)) : '');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: 'ok' };
  if (event.httpMethod !== 'POST') return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) };
  try {
    if (!TOKEN || !CHAT) throw new Error('TELEGRAM env is not set');
    let b;
    try { b = JSON.parse(event.body || '{}'); } catch (e) { b = {}; }
    const text = buildText(b);
    const r = await fetch('https://api.telegram.org/bot' + TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, text, parse_mode: 'HTML', disable_web_page_preview: true })
    });
    const out = await r.json();
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: !!out.ok }) };
  } catch (e) {
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: false, error: String(e.message || e) }) };
  }
};
