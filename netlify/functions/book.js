const https = require('https');

const APARTMENTS = {
  'nest_15':    { name: 'Nest One — Кв. 15',    weekday: 90,  weekend: 100 },
  'nest_249':   { name: 'Nest One — Кв. 249',   weekday: 105, weekend: 115 },
  'nest_481':   { name: 'Nest One — Кв. 481',   weekday: 125, weekend: 135 },
  'nest_233':   { name: 'Nest One — Кв. 233',   weekday: 135, weekend: 145 },
  'nest_353':   { name: 'Nest One — Кв. 353',   weekday: 105, weekend: 115 },
  'utower_65':  { name: 'U-Tower — Кв. 65',     weekday: 90,  weekend: 100 },
  'utower_73':  { name: 'U-Tower — Кв. 73',     weekday: 90,  weekend: 100 },
  'utower_171': { name: 'U-Tower — Кв. 171',    weekday: 85,  weekend: 95 },
  'utower_208': { name: 'U-Tower — Кв. 208',    weekday: 85,  weekend: 95 },
  'utower_310': { name: 'U-Tower — Кв. 310',    weekday: 85,  weekend: 95 },
  'utower_410': { name: 'U-Tower — Кв. 410',    weekday: 95,  weekend: 105 },
  'utower2_5':  { name: 'U-Tower 2 — Кв. 5',    weekday: 115, weekend: 125 },
  'utower2_9':  { name: 'U-Tower 2 — Кв. 9',    weekday: 115, weekend: 125 },
  'utower2_207':{ name: 'U-Tower 2 — Кв. 207',  weekday: 135, weekend: 145 },
  'utower2_228':{ name: 'U-Tower 2 — Кв. 228',  weekday: 135, weekend: 145 },
  'utower2_296':{ name: 'U-Tower 2 — Кв. 296',  weekday: 105, weekend: 115 },
  'utower2_92': { name: 'U-Tower 2 — Кв. 92',   weekday: 105, weekend: 115 },
  'mirabad_111':{ name: 'Mirabad — Кв. 111',    weekday: 115, weekend: 125 },
  'mirabad_205':{ name: 'Mirabad — Кв. 205',    weekday: 90,  weekend: 100 },
  'kislorod_49':{ name: 'Kislorod — Кв. 49',    weekday: 105, weekend: 115 },
  'kislorod_58':{ name: 'Kislorod — Кв. 58',    weekday: 115, weekend: 125 },
  'kislorod_128':{ name: 'Kislorod — Кв. 128',  weekday: 115, weekend: 125 },
};

function httpsRequest(url, options, postData) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'POST',
      headers: options.headers || {},
    };
    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', (e) => { console.error('Request error:', e.message); reject(e); });
    if (postData) req.write(postData);
    req.end();
  });
}

function calculateTotal(checkIn, checkOut, weekdayPrice, weekendPrice) {
  let total = 0, nights = 0;
  const current = new Date(checkIn);
  const end = new Date(checkOut);
  while (current < end) {
    const day = current.getDay();
    total += (day === 5 || day === 6) ? weekendPrice : weekdayPrice;
    nights++;
    current.setDate(current.getDate() + 1);
  }
  return { total, nights };
}

// UL-XXXXXX (без 0/O/I/1 чтобы не путать)
function generateBookingRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return 'UL-' + code;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const data = JSON.parse(event.body);
    const {
      apartment_id,
      guest_name, guest_phone, guest_email,
      check_in, check_out, guests_count, notes,
      user_id,
      booker_name, booker_phone, booker_email,
    } = data;

    if (!apartment_id || !guest_name || !guest_phone || !check_in || !check_out) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Заполните обязательные поля' })
      };
    }

    const apt = APARTMENTS[apartment_id];
    if (!apt) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Апартамент не найден' })
      };
    }

    const { total, nights } = calculateTotal(check_in, check_out, apt.weekday, apt.weekend);
    const booking_ref = generateBookingRef();

    const booking = {
      apartment_id,
      guest_name,
      guest_phone,
      guest_email: guest_email || null,
      check_in,
      check_out,
      guests_count: guests_count || 1,
      notes: notes || null,
      total_price: total,
      nights,
      status: 'pending',
      source: 'website',
      booking_ref,
      user_id: user_id || null,
      booker_name: booker_name || null,
      booker_phone: booker_phone || null,
      booker_email: booker_email || null,
      created_at: new Date().toISOString(),
    };

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const postData = JSON.stringify(booking);

    console.log('[BOOK] Saving, ref:', booking_ref);

    const sbResult = await httpsRequest(
      `${supabaseUrl}/rest/v1/bookings`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=representation',
          'Content-Length': String(Buffer.byteLength(postData)),
        },
      },
      postData
    );

    console.log('[BOOK] Supabase status:', sbResult.statusCode);

    let savedBooking = null;
    try {
      const parsed = JSON.parse(sbResult.body);
      if (Array.isArray(parsed) && parsed.length) savedBooking = parsed[0];
    } catch (e) {}

    if (sbResult.statusCode >= 400) {
      console.error('[BOOK] Supabase error body:', sbResult.body);
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Ошибка сохранения. Попробуйте ещё раз.' })
      };
    }

    // Telegram notification
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChat = process.env.TELEGRAM_CHAT_ID;
    if (tgToken && tgChat) {
      const isForOther = booker_name && booker_name !== guest_name;
      const bookerLine = isForOther
        ? `\n💼 *Покупатель:* ${booker_name}${booker_phone ? ` · ${booker_phone}` : ''}${booker_email ? ` · ${booker_email}` : ''}`
        : '';
      const tgMessage =
        `🏠 *Новая заявка с сайта!*\n` +
        `🔖 \`${booking_ref}\`\n\n` +
        `📍 ${apt.name}\n` +
        `🛏️ *Гость заезда:* ${guest_name}\n📞 ${guest_phone}` +
        (guest_email ? `\n📧 ${guest_email}` : '') +
        bookerLine +
        `\n\n📅 Заезд: ${check_in}\n📅 Выезд: ${check_out}\n` +
        `🌙 Ночей: ${nights}\n👥 Гостей: ${guests_count || 1}\n\n` +
        `💰 Итого: $${total}\n` +
        `📝 ${notes || 'без комментариев'}\n\n` +
        `⏳ Статус: ожидает подтверждения`;

      const tgData = JSON.stringify({
        chat_id: tgChat,
        text: tgMessage,
        parse_mode: 'Markdown'
      });
      try {
        await httpsRequest(
          `https://api.telegram.org/bot${tgToken}/sendMessage`,
          { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(tgData)) } },
          tgData
        );
      } catch (e) {
        console.error('[BOOK] Telegram error:', e.message);
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'Заявка отправлена! Мы свяжемся с вами в течение часа.',
        booking: {
          id: savedBooking?.id || null,
          booking_ref,
          apartment: apt.name,
          apartment_id,
          check_in,
          check_out,
          nights,
          total,
          guest_name,
          guest_phone,
          guest_email: guest_email || null,
        },
      }),
    };
  } catch (e) {
    console.error('[BOOK] Error:', e);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Ошибка сервера' })
    };
  }
};
