// POST /cancel-confirm
// Body: { booking_ref, code }
// Проверяет код + срок действия, ставит status='cancelled', чистит код.

const https = require('https');

function httpsRequest(url, options, postData) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

const APARTMENT_NAMES = {
  'nest_15': 'Nest One — Кв. 15', 'nest_249': 'Nest One — Кв. 249', 'nest_481': 'Nest One — Кв. 481',
  'nest_233': 'Nest One — Кв. 233', 'nest_353': 'Nest One — Кв. 353',
  'utower_65': 'U-Tower — Кв. 65', 'utower_73': 'U-Tower — Кв. 73', 'utower_171': 'U-Tower — Кв. 171',
  'utower_208': 'U-Tower — Кв. 208', 'utower_310': 'U-Tower — Кв. 310', 'utower_410': 'U-Tower — Кв. 410',
  'utower2_5': 'U-Tower 2 — Кв. 5', 'utower2_9': 'U-Tower 2 — Кв. 9', 'utower2_207': 'U-Tower 2 — Кв. 207',
  'utower2_228': 'U-Tower 2 — Кв. 228', 'utower2_296': 'U-Tower 2 — Кв. 296', 'utower2_92': 'U-Tower 2 — Кв. 92',
  'mirabad_111': 'Mirabad — Кв. 111', 'mirabad_205': 'Mirabad — Кв. 205',
  'kislorod_49': 'Kislorod — Кв. 49', 'kislorod_58': 'Kislorod — Кв. 58', 'kislorod_128': 'Kislorod — Кв. 128',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { booking_ref, code } = JSON.parse(event.body || '{}');
    if (!booking_ref || !code) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Укажите номер брони и код' }) };
    }

    const ref = String(booking_ref).trim().toUpperCase();
    const codeStr = String(code).trim();

    const SUPA_URL = process.env.SUPABASE_URL;
    const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

    // Найти бронь
    const findRes = await httpsRequest(
      `${SUPA_URL}/rest/v1/bookings?booking_ref=eq.${encodeURIComponent(ref)}&select=*`,
      { method: 'GET', headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` } }
    );
    let rows = [];
    try { rows = JSON.parse(findRes.body) || []; } catch (e) {}
    if (!rows.length) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Бронирование не найдено' }) };
    }
    const booking = rows[0];

    if (booking.status === 'cancelled') {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Это бронирование уже отменено' }) };
    }
    if (!booking.cancel_code) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Сначала запросите код отмены' }) };
    }
    if (booking.cancel_code !== codeStr) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Неверный код' }) };
    }
    if (booking.cancel_code_expires_at && new Date(booking.cancel_code_expires_at) < new Date()) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Срок действия кода истёк. Запросите новый.' }) };
    }

    // Отменяем
    const updRes = await httpsRequest(
      `${SUPA_URL}/rest/v1/bookings?id=eq.${booking.id}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPA_KEY,
          'Authorization': `Bearer ${SUPA_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
      },
      JSON.stringify({
        status: 'cancelled',
        cancel_code: null,
        cancel_code_expires_at: null,
        updated_at: new Date().toISOString(),
      })
    );

    if (updRes.statusCode >= 400) {
      console.error('[CANCEL-CONFIRM] Supabase update error:', updRes.body);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Не удалось отменить. Попробуйте снова.' }) };
    }

    // Уведомление в Telegram
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChat = process.env.TELEGRAM_CHAT_ID;
    const aptName = APARTMENT_NAMES[booking.apartment_id] || booking.apartment_id;
    if (tgToken && tgChat) {
      const tgMsg =
        `❌ *Бронь отменена гостем*\n` +
        `🔖 \`${ref}\`\n` +
        `📍 ${aptName}\n` +
        `👤 ${booking.guest_name} · ${booking.guest_phone}\n` +
        `📅 ${booking.check_in} → ${booking.check_out}\n` +
        `💰 $${booking.total_price}`;
      const tgData = JSON.stringify({ chat_id: tgChat, text: tgMsg, parse_mode: 'Markdown' });
      try {
        await httpsRequest(
          `https://api.telegram.org/bot${tgToken}/sendMessage`,
          { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(tgData)) } },
          tgData
        );
      } catch (e) {
        console.error('[CANCEL-CONFIRM] Telegram error:', e.message);
      }
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        success: true,
        message: 'Бронирование отменено',
        booking: {
          booking_ref: ref,
          apartment: aptName,
          check_in: booking.check_in,
          check_out: booking.check_out,
          status: 'cancelled',
        },
      }),
    };
  } catch (e) {
    console.error('[CANCEL-CONFIRM] Error:', e);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Ошибка сервера' }) };
  }
};
