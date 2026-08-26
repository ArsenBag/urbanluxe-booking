// Urban Luxe — book.js (v2, август 2026)
// Было: список апартаментов захардкожен → бронирование новых объектов падало
// с «Апартамент не найден». Стало: апартамент и занятость проверяются по Supabase
// (is_active=true) + живому iCal RealtyCalendar. Контракт ответа совместим:
//   { success:true, id, booking:{ booking_ref, apartment, total, check_in, check_out, guest_email } }
// Бонус: если в env задан RESEND_API_KEY — гостю уходит письмо-подтверждение.

const SB_URL = process.env.SUPABASE_URL || 'https://sebvfvtofiysbywxjqut.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI';
const READ_KEY = process.env.SUPABASE_SERVICE_KEY || ANON_KEY;   // чтение
const WRITE_KEY = process.env.SUPABASE_SERVICE_KEY || ANON_KEY;  // вставка (service обходит RLS)

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function h(key) { return { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }; }

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function tashkentToday() {
  return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
}
function parseICS(text) {
  const events = [];
  const blocks = String(text).split('BEGIN:VEVENT').slice(1);
  for (const b of blocks) {
    const body = b.split('END:VEVENT')[0];
    const get = (re) => { const m = body.match(re); return m ? m[1].trim() : ''; };
    const ds = get(/DTSTART(?:;VALUE=DATE)?[^:]*:(\d{8})/);
    const de = get(/DTEND(?:;VALUE=DATE)?[^:]*:(\d{8})/);
    if (!ds || !de) continue;
    const fmt = (s) => s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
    const ci = fmt(ds), co = fmt(de);
    if (co > ci) events.push({ check_in: ci, check_out: co });
  }
  return events;
}
function fetchWithTimeout(url, ms) {
  return Promise.race([
    fetch(url),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
  ]);
}
function makeRef() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)];
  return 'UL-' + s;
}
function nightPrice(dateIso, weekday, weekend) {
  const dow = new Date(dateIso + 'T00:00:00Z').getUTCDay();
  return (dow === 5 || dow === 6) ? weekend : weekday;
}
function esc(s) { return String(s || '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }

// Адреса комплексов (для письма гостю)
const COMPLEX_ADDR = {
  'Nest One': 'ул. Батыра Закирова 1А, Tashkent City',
  'U-Tower': 'мкр. Бешагач 1/1, Шайхантахурский район',
  'U-Tower 2': 'мкр. Бешагач 1/1, Шайхантахурский район',
  'Mirabad': 'ул. Айбек 38А, Мирабадский район',
  'Kislorod': 'ул. Бурижар 1, Яккасарайский район',
  'Gardens Residence': 'Tashkent City, Шайхантахурский район',
  'Modera Towers': 'ул. Шота Руставели 19, Яккасарайский район'
};

function ruDate(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? m[3] + '.' + m[2] + '.' + m[1] : iso;
}

async function sendGuestEmail(booking, apt) {
  const key = process.env.RESEND_API_KEY || process.env.RESEND_KEY || process.env.EMAIL_API_KEY;
  if (!key || !booking.guest_email) return;
  const from = process.env.RESEND_FROM || 'Urban Luxe <booking@urbanluxe.cc>';
  const gold = '#c9a96e', dark = '#171310';
  const addr = COMPLEX_ADDR[apt.complex] || 'Ташкент';
  const aptLine = esc(apt.name) + (apt.complex ? ' · ' + esc(apt.complex) : '') + (apt.floor ? ' · этаж ' + esc(apt.floor) : '');
  const row = (label, val) =>
    '<tr><td style="padding:7px 0;color:#8a8a8a;font-size:13px;vertical-align:top;white-space:nowrap">' + label + '</td>' +
    '<td style="padding:7px 0 7px 18px;color:#222;font-size:14px;text-align:right">' + val + '</td></tr>';
  const html =
    '<div style="background:#f4f2ee;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">' +
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e8e4dc">' +

    // Шапка
    '<div style="background:' + dark + ';padding:26px 32px;text-align:center">' +
    '<div style="color:' + gold + ';font-size:20px;letter-spacing:.35em;font-family:Georgia,serif">URBAN&nbsp;LUXE</div>' +
    '<div style="color:#9a938a;font-size:11px;letter-spacing:.18em;margin-top:6px">ПРЕМИАЛЬНЫЕ АПАРТАМЕНТЫ · ТАШКЕНТ</div>' +
    '</div>' +

    '<div style="padding:30px 32px">' +
    '<h2 style="margin:0 0 6px;font-weight:600;font-size:21px;color:#1c1c1c">Спасибо за бронирование' + (booking.guest_name ? ', ' + esc(String(booking.guest_name).split(' ')[0]) : '') + '!</h2>' +
    '<p style="margin:0 0 22px;color:#666;font-size:14px">Ваша бронь подтверждена. Ниже — все детали поездки.</p>' +

    // Карточка деталей
    '<div style="background:#faf8f4;border:1px solid #eee7d9;border-radius:12px;padding:18px 20px;margin-bottom:24px">' +
    '<table style="width:100%;border-collapse:collapse">' +
    row('Номер брони', '<strong style="font-size:16px;color:' + gold + ';letter-spacing:.05em">' + esc(booking.booking_ref) + '</strong>') +
    row('Апартамент', '<strong>' + aptLine + '</strong>') +
    row('Адрес', esc(addr)) +
    row('Заезд', '<strong>' + ruDate(booking.check_in) + '</strong> · c 15:00') +
    row('Выезд', '<strong>' + ruDate(booking.check_out) + '</strong> · до 12:00') +
    row('Гостей', esc(booking.guests_count)) +
    row('Итого', '<strong style="font-size:17px">$' + esc(booking.total_price) + '</strong>') +
    '</table></div>' +

    // Кнопки
    '<div style="text-align:center;margin-bottom:26px">' +
    '<a href="https://urbanluxe.cc/guest.html" style="background:' + gold + ';color:#241d10;padding:13px 26px;border-radius:9px;text-decoration:none;display:inline-block;font-weight:bold;font-size:14px">Личный кабинет</a>' +
    '<div style="margin-top:10px"><a href="https://urbanluxe.cc/cancel.html?ref=' + encodeURIComponent(booking.booking_ref) + '" style="color:#8a8a8a;font-size:12px">Управление бронированием / отмена</a></div>' +
    '</div>' +

    // Заселение
    '<div style="border-top:1px solid #eee7d9;padding-top:20px;margin-bottom:20px">' +
    '<div style="font-size:14px;font-weight:bold;color:#1c1c1c;margin-bottom:8px">🔑 Заселение</div>' +
    '<p style="margin:0;color:#555;font-size:13px;line-height:1.65">Заезд с 15:00, выезд до 12:00. Адрес, код доступа и подробную инструкцию мы отправим перед заездом.</p>' +
    '</div>' +

    // Правила
    '<div style="border-top:1px solid #eee7d9;padding-top:20px;margin-bottom:20px">' +
    '<div style="font-size:14px;font-weight:bold;color:#1c1c1c;margin-bottom:8px">❌ В апартаментах запрещено</div>' +
    '<p style="margin:0;color:#555;font-size:13px;line-height:1.9">' +
    '🚭 Курить внутри апартамента<br>' +
    '🎉 Проводить вечеринки и шумные мероприятия<br>' +
    '🔊 Шуметь после 22:00<br>' +
    '👥 Заселять посторонних гостей без согласования<br>' +
    '🔑 Передавать ключи и карту третьим лицам<br>' +
    '🚫 Нарушать правила ЖК и заниматься незаконной деятельностью</p>' +
    '<p style="margin:12px 0 0;color:#9a6b1f;font-size:12px;line-height:1.6;background:#fdf6e7;border-radius:8px;padding:10px 12px">⚠️ При нарушении правил проживания может быть удержан депозит и/или начислен штраф согласно условиям договора.</p>' +
    '</div>' +

    // Футер
    '<div style="border-top:1px solid #eee7d9;padding-top:18px;text-align:center">' +
    '<p style="margin:0 0 10px;color:#444;font-size:14px">Будем рады видеть вас в наших апартаментах! ✨</p>' +
    '<p style="margin:0;color:#8a8a8a;font-size:12px;line-height:1.8">' +
    'Вопросы 24/7: <a href="https://t.me/Arsen_bnb" style="color:' + gold + '">Telegram @Arsen_bnb</a><br>' +
    '+998 93 690 00 44 · +998 99 957 94 85<br>' +
    '<a href="https://urbanluxe.cc" style="color:' + gold + '">urbanluxe.cc</a></p>' +
    '</div>' +

    '</div></div></div>';
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: [booking.guest_email],
        subject: 'Спасибо за бронирование! Ваша бронь ' + booking.booking_ref + ' подтверждена · Urban Luxe',
        html
      })
    });
  } catch (e) { /* письмо не критично для брони */ }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: 'ok' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'POST only' }) };
  try {
    let b;
    try { b = JSON.parse(event.body || '{}'); } catch (e) { b = {}; }
    const aptId = String(b.apartment_id || '').trim();
    const ci = String(b.check_in || '').trim();
    const co = String(b.check_out || '').trim();
    const name = String(b.guest_name || '').trim();
    const phone = String(b.guest_phone || '').trim();

    if (!aptId || !name || !phone || !/^\d{4}-\d{2}-\d{2}$/.test(ci) || !/^\d{4}-\d{2}-\d{2}$/.test(co)) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Заполните обязательные поля' }) };
    }
    if (co <= ci) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Дата выезда должна быть позже даты заезда' }) };
    }
    if (ci < tashkentToday()) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Дата заезда уже прошла' }) };
    }

    // Апартамент — из Supabase (все 35 актуальных, без хардкода)
    const ar = await fetch(
      SB_URL + '/rest/v1/apartments?select=id,name,complex,floor,weekday_price,weekend_price,ical_export_url,is_active&id=eq.' + encodeURIComponent(aptId),
      { headers: h(READ_KEY) }
    );
    const apt = (ar.ok ? await ar.json() : [])[0];
    if (!apt || !apt.is_active) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Апартамент не найден' }) };
    }

    // Повторный клик той же брони — вернуть существующую, не дублировать
    const dupR = await fetch(
      SB_URL + '/rest/v1/bookings?select=id,booking_ref,total_price,guests_count,guest_email' +
      '&apartment_id=eq.' + encodeURIComponent(aptId) +
      '&check_in=eq.' + ci + '&check_out=eq.' + co +
      '&guest_phone=eq.' + encodeURIComponent(phone) + '&status=eq.confirmed',
      { headers: h(READ_KEY) }
    );
    const dup = (dupR.ok ? await dupR.json() : [])[0];
    if (dup) {
      return {
        statusCode: 200, headers: HEADERS,
        body: JSON.stringify({
          success: true, id: dup.id,
          booking: { booking_ref: dup.booking_ref, apartment: apt.name, total: dup.total_price, check_in: ci, check_out: co, guest_email: dup.guest_email || '' }
        })
      };
    }

    // Занятость: RC iCal + подтверждённые site-брони
    let busy = [];
    try {
      if (apt.ical_export_url && /^https?:\/\//.test(apt.ical_export_url)) {
        const icr = await fetchWithTimeout(apt.ical_export_url, 9000);
        if (icr.ok) busy = parseICS(await icr.text());
      }
    } catch (e) { /* фид упал — проверим хотя бы site-брони */ }
    const sbk = await fetch(
      SB_URL + '/rest/v1/bookings?select=check_in,check_out&apartment_id=eq.' + encodeURIComponent(aptId) + '&status=eq.confirmed',
      { headers: h(READ_KEY) }
    );
    if (sbk.ok) busy = busy.concat(await sbk.json());
    if (busy.some(e => e.check_in < co && e.check_out > ci)) {
      return { statusCode: 409, headers: HEADERS, body: JSON.stringify({ error: 'Эти даты уже заняты. Выберите другие даты.' }) };
    }

    // Суммы: доверяем фронту (как раньше), при отсутствии — считаем сами
    const nights = Math.round((new Date(co) - new Date(ci)) / 86400000);
    let total = parseInt(b.total_price, 10);
    if (!total || total < 0) {
      total = 0;
      for (let d = ci; d < co; d = addDays(d, 1)) {
        total += nightPrice(d, apt.weekday_price || 0, apt.weekend_price || apt.weekday_price || 0);
      }
    }

    const citizenship = String(b.citizenship || '').trim();
    let notes = String(b.notes || '').trim();
    if (citizenship) notes = (notes ? notes + ' ' : '') + '| Гражданство: ' + citizenship;

    const row = {
      apartment_id: aptId,
      guest_name: name,
      guest_phone: phone,
      guest_email: String(b.guest_email || '').trim() || null,
      check_in: ci,
      check_out: co,
      guests_count: parseInt(b.guests_count, 10) || 2,
      status: 'confirmed',
      source: 'website',
      notes: notes || null,
      nights: parseInt(b.nights, 10) || nights,
      total_price: total,
      booking_ref: makeRef(),
      booker_name: String(b.booker_name || '').trim() || null,
      booker_phone: String(b.booker_phone || '').trim() || null,
      booker_email: String(b.booker_email || '').trim() || null
    };
    if (b.user_id && /^[0-9a-f-]{36}$/i.test(String(b.user_id))) row.user_id = b.user_id;

    const ins = await fetch(SB_URL + '/rest/v1/bookings', {
      method: 'POST',
      headers: Object.assign(h(WRITE_KEY), { Prefer: 'return=representation' }),
      body: JSON.stringify(row)
    });
    if (!ins.ok) {
      const msg = await ins.text();
      throw new Error('insert failed ' + ins.status + ': ' + msg.slice(0, 200));
    }
    const saved = (await ins.json())[0] || row;

    await sendGuestEmail(saved, apt);

    return {
      statusCode: 200, headers: HEADERS,
      body: JSON.stringify({
        success: true, id: saved.id,
        booking: {
          booking_ref: saved.booking_ref, apartment: apt.name, total: saved.total_price,
          check_in: saved.check_in, check_out: saved.check_out, guest_email: saved.guest_email || ''
        }
      })
    };
  } catch (e) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};
