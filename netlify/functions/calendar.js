// calendar.js — iCal export for RealtyCalendar import
// URL: /.netlify/functions/calendar?apt=nest_15
// Returns iCal format with bookings from Supabase for the given apartment

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  };
  
  const apt = event.queryStringParameters?.apt;
  if (!apt) {
    return { statusCode: 400, headers: {'Content-Type':'text/plain'}, body: 'Missing apt parameter' };
  }
  
  // Fetch bookings from Supabase
  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sebvfvtofiysbywxjqut.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
  
  let bookings = [];
  if (SUPABASE_KEY) {
    try {
      const https = require('https');
      const url = `${SUPABASE_URL}/rest/v1/bookings?apartment_id=eq.${apt}&status=neq.cancelled&select=id,guest_name,check_in,check_out`;
      const data = await new Promise((resolve) => {
        https.get(url, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        }, (res) => {
          let d = '';
          res.on('data', c => d += c);
          res.on('end', () => { try { resolve(JSON.parse(d)) } catch(e) { resolve([]) } });
        }).on('error', () => resolve([]));
      });
      if (Array.isArray(data)) bookings = data;
    } catch(e) {}
  }
  
  // Build iCal
  let ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Urban Luxe//Booking Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Urban Luxe ${apt}
`;

  bookings.forEach(b => {
    const uid = b.id || `${apt}-${b.check_in}`;
    const dtstart = (b.check_in || '').replace(/-/g, '');
    const dtend = (b.check_out || '').replace(/-/g, '');
    const summary = b.guest_name || 'Urban Luxe Booking';
    ical += `BEGIN:VEVENT
UID:${uid}@urbanluxe.cc
DTSTART;VALUE=DATE:${dtstart}
DTEND;VALUE=DATE:${dtend}
SUMMARY:${summary} - Urban Luxe
DESCRIPTION:Booking from urbanluxe.cc
STATUS:CONFIRMED
END:VEVENT
`;
  });

  ical += 'END:VCALENDAR';
  
  return { statusCode: 200, headers, body: ical };
};
