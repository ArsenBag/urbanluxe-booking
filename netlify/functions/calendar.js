const https = require('https');

// Apartment IDs mapping
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
  return new Promise((resolve, reject) => {
    const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/bookings`);
    url.searchParams.set('apartment_id', `eq.${aptId}`);
    url.searchParams.set('select', '*');
    url.searchParams.set('status', 'neq.cancelled');

    const options = {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
    };

    https.get(url.toString(), options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

exports.handler = async (event) => {
  const aptId = event.queryStringParameters?.apt;

  // If no apt specified, return list of all available calendars
  if (!aptId) {
    const baseUrl = event.headers?.host 
      ? `https://${event.headers.host}` 
      : 'https://fastidious-blancmange-678804.netlify.app';
    
    const list = Object.entries(APARTMENTS).map(([id, apt]) => ({
      id,
      name: apt.name,
      complex: apt.complex,
      ical_url: `${baseUrl}/.netlify/functions/calendar?apt=${id}`,
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(list, null, 2),
    };
  }

  // Validate apartment ID
  if (!APARTMENTS[aptId]) {
    return {
      statusCode: 404,
      body: `Apartment "${aptId}" not found. Call without ?apt= to see all available IDs.`,
    };
  }

  const apt = APARTMENTS[aptId];
  const bookings = await fetchFromSupabase(aptId);

  // Generate iCal
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  let ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Urban Luxe//Booking System//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Urban Luxe — ${apt.name}`,
    'X-WR-TIMEZONE:Asia/Tashkent',
  ];

  bookings.forEach((booking, index) => {
    if (booking.check_in && booking.check_out) {
      const uid = `booking-${booking.id || index}-${aptId}@urbanluxe.cc`;
      ical.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTART;VALUE=DATE:${formatDate(booking.check_in)}`,
        `DTEND;VALUE=DATE:${formatDate(booking.check_out)}`,
        `DTSTAMP:${now}`,
        `SUMMARY:Бронь — ${booking.guest_name || 'Гость'}`,
        `DESCRIPTION:Гость: ${booking.guest_name || 'N/A'}\\nТелефон: ${booking.guest_phone || 'N/A'}\\nEmail: ${booking.guest_email || 'N/A'}\\nГостей: ${booking.guests_count || 'N/A'}\\nЗаметки: ${booking.notes || 'нет'}`,
        `LOCATION:${apt.name}, ${apt.complex}, Ташкент`,
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
      'Content-Disposition': `attachment; filename="urbanluxe-${aptId}.ics"`,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
    body: ical.join('\r\n'),
  };
};
