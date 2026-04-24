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

const APARTMENTS = {
  'nest_15':     { name: 'Апартамент 15',   complex: 'Nest One',   floor: 3,  weekday: 90,  weekend: 100, style: 'Оливковая студия' },
  'nest_249':    { name: 'Апартамент 249',  complex: 'Nest One',   floor: 13, weekday: 105, weekend: 115, style: 'Лофт · Чёрный мрамор' },
  'nest_481':    { name: 'Апартамент 481',  complex: 'Nest One',   floor: 25, weekday: 125, weekend: 135, style: 'Светлый · Золотые акценты' },
  'nest_233':    { name: 'Апартамент 233',  complex: 'Nest One',   floor: 12, weekday: 135, weekend: 145, style: 'Классика · 3+1' },
  'nest_353':    { name: 'Апартамент 353',  complex: 'Nest One',   floor: 18, weekday: 105, weekend: 115, style: 'Студия' },
  'utower_65':   { name: 'Апартамент 65',   complex: 'U-Tower',    floor: 6,  weekday: 90,  weekend: 100, style: 'Студия' },
  'utower_73':   { name: 'Апартамент 73',   complex: 'U-Tower',    floor: 6,  weekday: 90,  weekend: 100, style: 'Дерево + оранжевый' },
  'utower_171':  { name: 'Апартамент 171',  complex: 'U-Tower',    floor: 11, weekday: 85,  weekend: 95,  style: 'Студия' },
  'utower_208':  { name: 'Апартамент 208',  complex: 'U-Tower',    floor: 13, weekday: 85,  weekend: 95,  style: 'Премиум' },
  'utower_310':  { name: 'Апартамент 310',  complex: 'U-Tower',    floor: 18, weekday: 85,  weekend: 95,  style: 'Студия' },
  'utower_410':  { name: 'Апартамент 410',  complex: 'U-Tower',    floor: 24, weekday: 95,  weekend: 105, style: 'Студия · Высокий этаж' },
  'utower2_5':   { name: 'Апартамент 5',    complex: 'U-Tower 2',  floor: 3,  weekday: 115, weekend: 125, style: '2+1 · Просторный' },
  'utower2_9':   { name: 'Апартамент 9',    complex: 'U-Tower 2',  floor: 4,  weekday: 115, weekend: 125, style: '2+1' },
  'utower2_207': { name: 'Апартамент 207',  complex: 'U-Tower 2',  floor: 13, weekday: 135, weekend: 145, style: 'Премиум · Панорамный вид' },
  'utower2_228': { name: 'Апартамент 228',  complex: 'U-Tower 2',  floor: 13, weekday: 135, weekend: 145, style: 'Премиум · Панорамный вид' },
  'utower2_296': { name: 'Апартамент 296',  complex: 'U-Tower 2',  floor: 17, weekday: 105, weekend: 115, style: 'Студия' },
  'utower2_92':  { name: 'Апартамент 92',   complex: 'U-Tower 2',  floor: 7,  weekday: 105, weekend: 115, style: 'Студия' },
  'mirabad_111': { name: 'Апартамент 111',  complex: 'Mirabad',    floor: 8,  weekday: 115, weekend: 125, style: '2+1 · Просторный' },
  'mirabad_205': { name: 'Апартамент 205',  complex: 'Mirabad',    floor: 8,  weekday: 90,  weekend: 100, style: 'Студия' },
  'kislorod_49': { name: 'Апартамент 49',   complex: 'Kislorod',   floor: 10, weekday: 105, weekend: 115, style: '2+1' },
  'kislorod_58': { name: 'Апартамент 58',   complex: 'Kislorod',   floor: 11, weekday: 115, weekend: 125, style: '2+1' },
  'kislorod_128':{ name: 'Апартамент 128',  complex: 'Kislorod',   floor: 13, weekday: 115, weekend: 125, style: '2+1' },
};

function fetchIcal(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 8000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchIcal(res.headers.location).then(resolve);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
  });
}

function parseIcalDates(icalData) {
  const events = [];
  const lines = icalData.split(/\r?\n/);
  let inEvent = false;
  let start = null, end = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { inEvent = true; start = null; end = null; }
    if (line === 'END:VEVENT' && inEvent) {
      if (start && end) events.push({ start, end });
      inEvent = false;
    }
    if (inEvent) {
      const dtMatch = line.match(/^(DTSTART|DTEND)[^:]*:(\d{4})(\d{2})(\d{2})/);
      if (dtMatch) {
        const dateStr = `${dtMatch[2]}-${dtMatch[3]}-${dtMatch[4]}`;
        if (dtMatch[1] === 'DTSTART') start = dateStr;
        else end = dateStr;
      }
    }
  }
  return events;
}

function isAvailable(events, checkIn, checkOut) {
  const reqStart = new Date(checkIn);
  const reqEnd = new Date(checkOut);
  for (const ev of events) {
    const evStart = new Date(ev.start);
    const evEnd = new Date(ev.end);
    if (reqStart < evEnd && reqEnd > evStart) return false;
  }
  return true;
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

// Fetch photo_url and description from Supabase
function fetchAptPhotos() {
  return new Promise((resolve) => {
    const sbUrl = process.env.SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_KEY;
    if (!sbUrl || !sbKey) { resolve({}); return; }
    const url = sbUrl + '/rest/v1/apartments?select=id,photo_url,description,amenities';
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: { 'apikey': sbKey, 'Authorization': 'Bearer ' + sbKey, 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const map = {};
          if (Array.isArray(parsed)) {
            parsed.forEach(a => {
              let photos = [];
              try { const p = JSON.parse(a.photo_url); if (Array.isArray(p)) photos = p; } catch(e) { if (a.photo_url) photos = [a.photo_url]; }
              map[a.id] = { photo_url: photos[0] || '', photos, description: a.description || '', amenities: a.amenities || [] };
            });
          }
          resolve(map);
        } catch(e) { resolve({}); }
      });
    });
    req.on('error', () => resolve({}));
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const params = event.queryStringParameters || {};
  const checkIn = params.check_in;
  const checkOut = params.check_out;
  const aptId = params.apt;

  // Mode 1: Get booked dates for a single apartment
  if (aptId && !checkIn) {
    const url = ICAL_URLS[aptId];
    if (!url) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Apartment not found' }) };
    const icalData = await fetchIcal(url);
    const events = parseIcalDates(icalData);
    return { statusCode: 200, headers, body: JSON.stringify({ apartment: aptId, booked_dates: events }) };
  }

  // Mode 2: Search available apartments for given dates
  if (checkIn && checkOut) {
    const results = [];
    
    // Fetch photos from Supabase in parallel with iCal
    const [photoMap] = await Promise.all([fetchAptPhotos()]);
    
    const fetchPromises = Object.entries(ICAL_URLS).map(async ([id, url]) => {
      try {
        const icalData = await fetchIcal(url);
        const events = parseIcalDates(icalData);
        const available = isAvailable(events, checkIn, checkOut);
        const apt = APARTMENTS[id];
        const { total, nights } = calculateTotal(checkIn, checkOut, apt.weekday, apt.weekend);
        const photos = photoMap[id] || {};
        
        results.push({
          id,
          ...apt,
          available,
          total,
          nights,
          check_in: checkIn,
          check_out: checkOut,
          photo_url: photos.photo_url || '',
          photos: photos.photos || [],
          description: photos.description || '',
          amenities: photos.amenities || [],
        });
      } catch (e) {
        const apt = APARTMENTS[id];
        const { total, nights } = calculateTotal(checkIn, checkOut, apt.weekday, apt.weekend);
        const photos = photoMap[id] || {};
        results.push({ id, ...apt, available: true, total, nights, check_in: checkIn, check_out: checkOut, error: true, photo_url: photos.photo_url || '', photos: photos.photos || [] });
      }
    });

    await Promise.all(fetchPromises);

    results.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      return a.weekday - b.weekday;
    });

    const available = results.filter(r => r.available);
    const unavailable = results.filter(r => !r.available);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        check_in: checkIn,
        check_out: checkOut,
        total_apartments: results.length,
        available_count: available.length,
        available,
        unavailable,
      }),
    };
  }

  // Mode 3: No params — return info
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      usage: {
        search: '?check_in=2026-05-01&check_out=2026-05-05',
        single: '?apt=nest_15',
      },
      apartments: Object.keys(APARTMENTS),
    }),
  };
};
