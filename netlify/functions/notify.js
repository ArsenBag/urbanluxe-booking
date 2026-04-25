const https = require('https');
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || ''; 
const TG_CHAT_ID = process.env.TG_CHAT_ID || '8194250618';

function sendTelegram(text) {
  return new Promise((resolve) => {
    if (!TG_BOT_TOKEN) { resolve(false); return; }
    const data = JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: 'HTML' });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TG_BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(true)); });
    req.on('error', () => resolve(false));
    req.write(data);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  
  try {
    const body = JSON.parse(event.body || '{}');
    const { type, apartment, guest_name, guest_phone, check_in, check_out, nights, total, message, booking_id } = body;
    
    let text = '';
    if (type === 'new_booking') {
      text = `🏠 <b>Новое бронирование!</b>\n\n📍 ${apartment || 'Апартамент'}\n👤 ${guest_name} | ${guest_phone}\n📅 ${check_in} → ${check_out} (${nights} ноч.)\n💰 $${total}\n\n⏰ Подтвердите в админ-панели`;
    } else if (type === 'cancel') {
      text = `❌ <b>Отмена бронирования</b>\n\n📍 ${apartment || 'Апартамент'}\n👤 ${guest_name}\n📅 ${check_in} → ${check_out}`;
    } else if (type === 'modify') {
      text = `✏️ <b>Изменение дат</b>\n\n📍 ${apartment || 'Апартамент'}\n👤 ${guest_name}\n📅 Новые даты: ${check_in} → ${check_out}`;
    } else if (type === 'message') {
      text = `💬 <b>Новое сообщение</b>\n\n👤 ${guest_name || 'Гость'}\n📍 ${apartment || ''}\n\n${message || ''}`;
    } else if (type === 'review') {
      text = `⭐ <b>Новый отзыв</b>\n\n📍 ${apartment || ''}\n👤 ${guest_name || 'Гость'}\n${'⭐'.repeat(body.rating || 5)}\n${message || ''}`;
    }
    
    if (text) await sendTelegram(text);
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
