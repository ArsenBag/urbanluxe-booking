// POST /cancel-request
// Body: { booking_ref, contact } — contact = email или телефон
// Проверяет совпадение, генерирует 6-значный код, шлёт в email + Telegram админу.

const https = require('https');
const { sendEmail, cancelCodeEmail } = require('./_send-email');

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

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizePhone(p) {
  return (p || '').replace(/[^\d+]/g, '');
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
    const { booking_ref, contact } = JSON.parse(event.body || '{}');
    if (!booking_ref || !contact) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Укажите номер брони и email или телефон' }) };
    }

    const ref = String(booking_ref).trim().toUpperCase();
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
      // Не выдаём, что брони нет — чтобы нельзя было перебирать. Имитируем "ОК, код выслан".
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, message: 'Если бронь существует, код выслан на указанный контакт.' }) };
    }

    const booking = rows[0];

    // Проверка контакта
    const contactStr = String(contact).trim().toLowerCase();
    const phoneNorm = normalizePhone(contactStr);
    const isEmail = contactStr.includes('@');
    let matched = false;

    if (isEmail) {
      const guestEmail = (booking.guest_email || '').toLowerCase();
      const bookerEmail = (booking.booker_email || '').toLowerCase();
      if (contactStr === guestEmail || contactStr === bookerEmail) matched = true;
    } else if (phoneNorm.length >= 7) {
      const guestPhone = normalizePhone(booking.guest_phone);
      const bookerPhone = normalizePhone(booking.booker_phone);
      // Совпадение по последним 7 цифрам
      const tail = phoneNorm.slice(-7);
      if (guestPhone.endsWith(tail) || bookerPhone.endsWith(tail)) matched = true;
    }

    if (!matched) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, message: 'Если бронь существует, код выслан на указанный контакт.' }) };
    }

    if (booking.status === 'cancelled') {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Это бронирование уже отменено' }) };
    }

    // Сгенерировать код, сохранить
    const code = generateCode();
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

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
      JSON.stringify({ cancel_code: code, cancel_code_expires_at: expires })
    );

    if (updRes.statusCode >= 400) {
      console.error('[CANCEL-REQ] Supabase update error:', updRes.body);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Ошибка сервера' }) };
    }

    // Отправить email если есть и контакт — email
    const emailTo = booking.guest_email || booking.booker_email || (isEmail ? contactStr : null);
    const aptName = APARTMENT_NAMES[booking.apartment_id] || booking.apartment_id;
    if (emailTo) {
      const tpl = cancelCodeEmail({
        guestName: booking.guest_name,
        bookingRef: ref,
        code,
        apartmentName: aptName,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
      });
      await sendEmail({ to: emailTo, subject: tpl.subject, html: tpl.html, text: tpl.text });
    }

    // Telegram админу
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChat = process.env.TELEGRAM_CHAT_ID;
    if (tgToken && tgChat) {
      const tgMsg =
        `🔓 *Запрос на отмену брони*\n` +
        `🔖 \`${ref}\`\n` +
        `📍 ${aptName}\n` +
        `👤 ${booking.guest_name} · ${booking.guest_phone}\n` +
        `📅 ${booking.check_in} → ${booking.check_out}\n\n` +
        `🔢 Код для гостя: *${code}* (15 мин)\n` +
        `${emailTo ? `📧 Отправлен на: ${emailTo}` : '⚠️ Email не указан — передайте код вручную'}`;
      const tgData = JSON.stringify({ chat_id: tgChat, text: tgMsg, parse_mode: 'Markdown' });
      try {
        await httpsRequest(
          `https://api.telegram.org/bot${tgToken}/sendMessage`,
          { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(tgData)) } },
          tgData
        );
      } catch (e) {
        console.error('[CANCEL-REQ] Telegram error:', e.message);
      }
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        success: true,
        message: 'Код подтверждения выслан на email и в Telegram администратору. Срок действия: 15 минут.',
        contact_hint: emailTo ? emailTo.replace(/(.{2}).*(@.*)/, '$1***$2') : 'Telegram администратору',
      }),
    };
  } catch (e) {
    console.error('[CANCEL-REQ] Error:', e);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Ошибка сервера' }) };
  }
};
