// calendar.js — iCal export для импорта в RealtyCalendar.
// URL: /.netlify/functions/calendar?apt=nest_15
//
// Формат полностью совпадает с тем, что отдаёт сам RealtyCalendar
// (PRODID:icalendar-ruby) — это гарантирует что их парсер примет файл.
//
// Ключевые требования:
//  - CRLF (\r\n) везде, обязательный финальный CRLF после END:VCALENDAR
//  - DTSTART/DTEND — datetime YYYYMMDDTHHMMSS (без VALUE=DATE)
//  - DTSTAMP, UID, CREATED, LAST-MODIFIED — обязательные поля
//  - Минимум полей: SUMMARY с коротким идентификатором без эмодзи и прочего

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  };

  const apt = event.queryStringParameters?.apt;
  if (!apt) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'Missing apt parameter'
    };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sebvfvtofiysbywxjqut.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

  let bookings = [];
  if (SUPABASE_KEY) {
    try {
      const https = require('https');
      const url = `${SUPABASE_URL}/rest/v1/bookings?apartment_id=eq.${encodeURIComponent(apt)}&status=neq.cancelled&select=id,booking_ref,guest_name,check_in,check_out,created_at,updated_at`;
      const data = await new Promise((resolve) => {
        https.get(url, {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Accept': 'application/json'
          }
        }, (res) => {
          let d = '';
          res.on('data', c => d += c);
          res.on('end', () => {
            try { resolve(JSON.parse(d)) } catch (e) { resolve([]) }
          });
        }).on('error', () => resolve([]));
      });
      if (Array.isArray(data)) bookings = data;
    } catch (e) {
      // молча — отдадим валидный пустой календарь
    }
  }

  const CRLF = '\r\n';

  // Формат YYYYMMDDTHHMMSSZ для DTSTAMP (UTC)
  function fmtUtcStamp(date) {
    const d = date instanceof Date ? date : new Date(date || Date.now());
    if (isNaN(d.getTime())) return fmtUtcStamp(new Date());
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  // Формат YYYYMMDDTHHMMSS для DTSTART/DTEND (без Z, локальная полночь как у RC)
  function fmtDateOnly(dateStr) {
    if (!dateStr) return '';
    return dateStr.replace(/-/g, '') + 'T000000';
  }

  // Безопасный апартамент-ID
  const safeApt = String(apt).replace(/[^a-zA-Z0-9_-]/g, '');
  const nowStamp = fmtUtcStamp(new Date());

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Urban Luxe//Booking Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-TIMEZONE:Asia/Tashkent',
    `X-WR-CALNAME:Urban Luxe ${safeApt}`,
  ];

  bookings.forEach((b) => {
    const dtstart = fmtDateOnly(b.check_in);
    const dtend = fmtDateOnly(b.check_out);
    if (!dtstart || !dtend) return;

    // UID должен быть стабильным между sync-ами. booking_ref уже начинается с UL- — используем его как есть.
    const uidBase = b.booking_ref || b.id || `${safeApt}-${b.check_in}`;
    const uid = `${uidBase}@urbanluxe.cc`;

    // SUMMARY — короткий идентификатор как у RC: "UL(UL-XXXXXX)"
    const refLabel = b.booking_ref ? b.booking_ref : (b.id || safeApt).slice(0, 8);
    const summary = `UL(${refLabel})`;

    const created = fmtUtcStamp(b.created_at || nowStamp);
    const modified = fmtUtcStamp(b.updated_at || b.created_at || nowStamp);

    lines.push(
      'BEGIN:VEVENT',
      `DTSTAMP:${nowStamp}`,
      `UID:${uid}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `CREATED:${created}`,
      `LAST-MODIFIED:${modified}`,
      `SUMMARY:${summary}`,
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');

  const ical = lines.join(CRLF) + CRLF;

  return {
    statusCode: 200,
    headers,
    body: ical
  };
};
