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

function postJSON(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(data);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...headers,
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function calculateTotal(checkIn, checkOut, weekdayPrice, weekendPrice) {
  let total = 0;
  let nights = 0;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const current = new Date(start);
  
  while (current < end) {
    const day = current.getDay(); // 0=Sun, 5=Fri, 6=Sat
    if (day === 5 || day === 6) {
      total += weekendPrice;
    } else {
      total += weekdayPrice;
    }
    nights++;
    current.setDate(current.getDate() + 1);
  }
  
  return { total, nights };
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const data = JSON.parse(event.body);
    const { apartment_id, guest_name, guest_phone, guest_email, check_in, check_out, guests_count, notes } = data;

    // Validation
    if (!apartment_id || !guest_name || !guest_phone || !check_in || !check_out) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Заполните обязательные поля: апартамент, имя, телефон, даты' }),
      };
    }

    const apt = APARTMENTS[apartment_id];
    if (!apt) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Апартамент не найден' }),
      };
    }

    // Calculate price
    const { total, nights } = calculateTotal(check_in, check_out, apt.weekday, apt.weekend);

    // Save to Supabase
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
      created_at: new Date().toISOString(),
    };

    const supabaseResult = await postJSON(
      `${process.env.SUPABASE_URL}/rest/v1/bookings`,
      booking,
      {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation',
      }
    );

    // Send Telegram notification
    const tgMessage = `🏠 *Новая заявка с сайта!*

📍 ${apt.name}
👤 ${guest_name}
📞 ${guest_phone}
📧 ${guest_email || 'не указан'}

📅 Заезд: ${check_in}
📅 Выезд: ${check_out}
🌙 Ночей: ${nights}
👥 Гостей: ${guests_count || 1}

💰 Итого: $${total}
📝 ${notes || 'без комментариев'}

⏳ Статус: ожидает подтверждения`;

    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      try {
        await postJSON(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text: tgMessage,
            parse_mode: 'Markdown',
          }
        );
      } catch (e) {
        console.error('Telegram error:', e);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Заявка отправлена! Мы свяжемся с вами в течение часа.',
        booking: { apartment: apt.name, check_in, check_out, nights, total },
      }),
    };

  } catch (e) {
    console.error('Error:', e);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Произошла ошибка. Попробуйте позже или напишите в Telegram.' }),
    };
  }
};
