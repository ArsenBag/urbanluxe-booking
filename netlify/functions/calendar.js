const https = require('https');

const APARTMENTS = {
  'nest_15':    { name: 'Nest One — Кв. 15',    complex: 'Nest One 1', floor: 3 },
  'nest_249':   { name: 'Nest One — Кв. 249',   complex: 'Nest One 1', floor: 13 },
  'nest_481':   { name: 'Nest One — Кв. 481',   complex: 'Nest One 2', floor: 25 },
  'nest_233':   { name: 'Nest One — Кв. 233',   complex: 'Nest One 2', floor: 12 },
  'nest_353':   { name: 'Nest One — Кв. 353',   complex: 'Nest One 1', floor: 18 },
  'utower_65':  { name: 'U-Tower — Кв. 65',     complex: 'U-Tower 1',  floor: 6 },
  'utower_73':  { name: 'U-Tower — Кв. 73',     complex: 'U-Tower 1',  floor: 6 },
  'utower_171': { name: 'U-Tower — Кв. 171',    complex: 'U-Tower 1',  floor: 11 },
  'utower_208': { name: 'U-Tower — Кв. 208',    complex: 'U-Tower 1',  floor: 13 },
  'utower_310': { name: 'U-Tower — Кв. 310',    complex: 'U-Tower 1',  floor: 18 },
  'utower_410': { name: 'U-Tower — Кв. 410',    complex: 'U-Tower 1',  floor: 24 },
  'utower2_5':  { name: 'U-Tower 2 — Кв. 5',    complex: 'U-Tower 2',  floor: 3 },
  'utower2_9':  { name: 'U-Tower 2 — Кв. 9',    complex: 'U-Tower 2',  floor: 4 },
  'utower2_207':{ name: 'U-Tower 2 — Кв. 207',  complex: 'U-Tower 2',  floor: 13 },
  'utower2_228':{ name: 'U-Tower 2 — Кв. 228',  complex: 'U-Tower 2',  floor: 13 },
  'utower2_296':{ name: 'U-Tower 2 — Кв. 296',  complex: 'U-Tower 2',  floor: 17 },
  'utower2_92': { name: 'U-Tower 2 — Кв. 92',   complex: 'U-Tower 2',  floor: 7 },
  'mirabad_111':{ name: 'Mirabad — Кв. 111',    complex: 'Mirabad 2',  floor: 8 },
  'mirabad_205':{ name: 'Mirabad — Кв. 205',    complex: 'Mirabad 1',  floor: 8 },
  'kislorod_49':{ name: 'Kislorod — Кв. 49',    complex: 'Kislorod 2', floor: 10 },
  'kislorod_58':{ name: 'Kislorod — Кв. 58',    complex: 'Kislorod 2', floor: 11 },
  'kislorod_128':{ name: 'Kislorod — Кв. 128',  complex: 'Kislorod 2', floor: 13 },
};

function formatDate(dateStr) {
  return dateStr.replace(/-/g, '');
}

function fetchFromSupabase(aptId) {
  return new Promise((resolve) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) { resolve([]); return; }
    const requestUrl = supabaseUrl + '/rest/v1/bookings?apartment_id=eq.' + aptId + '&select=*';
    const urlObj = new URL(requestUrl);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': 'Bearer ' + supabaseKey,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Supabase status:', res.statusCode, 'body:', data.substring(0, 300));
        try {
          const parsed = JSON.parse(data);
          resolve(Array.isArray(parsed) ? parsed : []);
        } catch (e) { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.end();
  });
}

exports.handler = async (event) => {
  const aptId = event.queryStringParameters?.apt;
  if (!aptId) {
    const baseUrl = event.headers?.host ? 'https://' + event.headers.host : 'https://fastidious-blancmange-678804.netlify.app';
    const list = Object.entries(APARTMENTS).map(([id, apt]) => ({
      id, name: apt.name, complex: apt.complex,
      ical_url: baseUrl + '/.netlify/functions/calendar?apt=' + id,
    }));
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(list, null, 2) };
  }
  if (!APARTMENTS[aptId]) {
    return { statusCode: 404, body: 'Apartment "' + aptId + '" not found.' };
  }
  const apt = APARTMENTS[aptId];
  const bookings = await fetchFromSupabase(aptId);
  console.log('Found ' + bookings.length + ' bookings for ' + aptId);
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  let ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Urban Luxe//Booking System//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Urban Luxe — ' + apt.name,
    'X-WR-TIMEZONE:Asia/Tashkent',
  ];
  bookings.forEach((booking, index) => {
    if (booking.check_in && booking.check_out) {
      ical.push(
        'BEGIN:VEVENT',
        'UID:booking-' + (booking.id || index) + '-' + aptId + '@urbanluxe.cc',
        'DTSTART;VALUE=DATE:' + formatDate(booking.check_in),
        'DTEND;VALUE=DATE:' + formatDate(booking.check_out),
        'DTSTAMP:' + now,
        'SUMMARY:Бронь — ' + (booking.guest_name || 'Гость'),
        'DESCRIPTION:Гость: ' + (booking.guest_name || '') + '\\nТел: ' + (booking.guest_phone || ''),
        'LOCATION:' + apt.name + ', Ташкент',
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'END:VEVENT'
      );
    }
  });
  ical.push('END:VCALENDAR');
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="urbanluxe-' + aptId + '.ics"',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
    body: ical.join('\r\n'),
  };
};
