const https = require('https');
const http = require('http');

const ICAL_URLS = {
  'nest_15': 'https://realtycalendar.ru/apartments/export.ics?q=MzEyMDUz%0A',
  'nest_249': 'https://realtycalendar.ru/apartments/export.ics?q=MzAwNDI4%0A',
  'nest_481': 'https://realtycalendar.ru/apartments/export.ics?q=MzEyMDM2%0A',
  'nest_233': 'https://realtycalendar.ru/apartments/export.ics?q=MzI5NTQz%0A',
  'nest_353': 'https://realtycalendar.ru/apartments/export.ics?q=MzM3MTgz%0A',
  'utower_65': 'https://realtycalendar.ru/apartments/export.ics?q=MzQwODEz%0A',
  'utower_73': 'https://realtycalendar.ru/apartments/export.ics?q=MzQwODE1%0A',
  'utower_171': 'https://realtycalendar.ru/apartments/export.ics?q=MzI5NTQ0%0A',
  'utower_208': 'https://realtycalendar.ru/apartments/export.ics?q=MzEyMDMw%0A',
  'utower_310': 'https://realtycalendar.ru/apartments/export.ics?q=MzAwMjMx%0A',
  'utower_410': 'https://realtycalendar.ru/apartments/export.ics?q=MzE2MTk3%0A',
  'utower2_5': 'https://realtycalendar.ru/apartments/export.ics?q=MzE2MTc4%0A',
  'utower2_9': 'https://realtycalendar.ru/apartments/export.ics?q=MzEyMDM0%0A',
  'utower2_207': 'https://realtycalendar.ru/apartments/export.ics?q=MzE2MTk0%0A',
  'utower2_228': 'https://realtycalendar.ru/apartments/export.ics?q=MzE2MTk2%0A',
  'utower2_296': 'https://realtycalendar.ru/apartments/export.ics?q=MzAwMjMy%0A',
  'utower2_92': 'https://realtycalendar.ru/apartments/export.ics?q=MzMxNTg1%0A',
  'mirabad_111': 'https://realtycalendar.ru/apartments/export.ics?q=MzAyMTk1%0A',
  'mirabad_205': 'https://realtycalendar.ru/apartments/export.ics?q=MzQzMDU1%0A',
  'kislorod_49': 'https://realtycalendar.ru/apartments/export.ics?q=MzM0MTk0%0A',
  'kislorod_58': 'https://realtycalendar.ru/apartments/export.ics?q=MzIxNzg5%0A',
  'kislorod_128': 'https://realtycalendar.ru/apartments/export.ics?q=MzI3ODg3%0A',
};

function fetchIcal(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(''));
  });
}

function parseIcalEvents(icalData) {
  const events = [];
  const blocks = icalData.split('BEGIN:VEVENT');
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0];
    const lines = block.split(/\r?\n/);
    let dtstart = '', dtend = '', summary = '', uid = '';
    for (const line of lines) {
      if (line.startsWith('DTSTART')) {
        const m = line.match(/(\d{4})(\d{2})(\d{2})/);
        if (m) dtstart = `${m[1]}-${m[2]}-${m[3]}`;
      }
      if (line.startsWith('DTEND')) {
        const m = line.match(/(\d{4})(\d{2})(\d{2})/);
        if (m) dtend = `${m[1]}-${m[2]}-${m[3]}`;
      }
      if (line.startsWith('SUMMARY')) summary = line.replace('SUMMARY:', '').trim();
      if (line.startsWith('UID')) uid = line.replace('UID:', '').trim();
    }
    if (dtstart && dtend) events.push({ dtstart, dtend, summary, uid });
  }
  return events;
}

function detectSource(summary) {
  const s = (summary || '').toLowerCase();
  if (s.includes('airbnb')) return 'airbnb';
  if (s.includes('booking.com') || s.includes('booking')) return 'booking';
  if (s.includes('ostrovok')) return 'ostrovok';
  if (s.includes('101hotels') || s.includes('101')) return '101hotels';
  if (s.includes('bronevik')) return 'bronevik';
  if (s.includes('sutochno')) return 'sutochno';
  if (s.includes('urbanluxe') || s.includes('urban luxe')) return 'website';
  if (s.includes('blocked') || s.includes('unavailable') || s.includes('not available')) return 'blocked';
  return 'other';
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const allBookings = [];
  const today = new Date().toISOString().split('T')[0];

  // Parse all iCal feeds
  for (const [aptId, url] of Object.entries(ICAL_URLS)) {
    try {
      const icalData = await fetchIcal(url);
      if (!icalData) continue;
      const events = parseIcalEvents(icalData);
      
      for (const ev of events) {
        // Only include current/future bookings (not past)
        if (ev.dtend < today) continue;
        
        const source = detectSource(ev.summary);
        const nights = Math.round((new Date(ev.dtend) - new Date(ev.dtstart)) / 864e5);
        
        allBookings.push({
          apartment_id: aptId,
          check_in: ev.dtstart,
          check_out: ev.dtend,
          nights,
          source,
          summary: ev.summary || '',
          uid: ev.uid || '',
        });
      }
    } catch (e) { /* skip errors */ }
  }

  // Group by today's check-ins and check-outs
  const todayCheckins = allBookings.filter(b => b.check_in === today);
  const todayCheckouts = allBookings.filter(b => b.check_out === today);
  
  // Source statistics
  const sourceCounts = {};
  allBookings.forEach(b => {
    sourceCounts[b.source] = (sourceCounts[b.source] || 0) + 1;
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      total_bookings: allBookings.length,
      today_checkins: todayCheckins.length,
      today_checkouts: todayCheckouts.length,
      checkins: todayCheckins,
      checkouts: todayCheckouts,
      source_stats: sourceCounts,
      all_bookings: allBookings,
      synced_at: new Date().toISOString()
    })
  };
};
