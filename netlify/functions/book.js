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

async function sendGuestEmail(booking, aptName) {
  const key = process.env.RESEND_API_KEY || process.env.RESEND_KEY || process.env.EMAIL_API_KEY;
  if (!key || !booking.guest_email) return;
  const from = process.env.RESEND_FROM || 'Urban Luxe <booking@urbanluxe.cc>';
  const html =
    '<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#222">' +
    '<h2 style="font-weight:400">Ваша бронь подтверждена</h2>' +
    '<p>Номер брони: <strong style="font-size:18px">' + esc(booking.booking_ref) + '</strong></p>' +
    '<p>' + esc(aptName) + '<br>Заезд: <strong>' + esc(booking.check_in) + '</strong> · Выезд: <strong>' + esc(booking.check_out) + '</strong><br>' +
    'Итого: <strong>$' + esc(booking.total_price) + '</strong> · Гостей: ' + esc(booking.guests_count) + '</p>' +
    '<p><a href="https://urbanluxe.cc/guest.html" style="background:#c9a96e;color:#241d10;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">Личный кабинет</a></p>' +
    '<p style="font-size:13px;color:#777">Управление бронированием: <a href="https://urbanluxe.cc/cancel.html?ref=' + encodeURIComponent(booking.booking_ref) + '">urbanluxe.cc/cancel</a><br>' +
    'Вопросы: Telegram <a href="https://t.me/Arsen_bnb">@Arsen_bnb</a> · +998 93 690 00 44</p></div>';
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: [booking.guest_email],
        subject: 'Urban Luxe — бронь ' + booking.booking_ref + ' подтверждена',
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
      SB_URL + '/rest/v1/apartments?select=id,name,weekday_price,weekend_price,ical_export_url,is_active&id=eq.' + encodeURIComponent(aptId),
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

    await sendGuestEmail(saved, apt.name);

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
