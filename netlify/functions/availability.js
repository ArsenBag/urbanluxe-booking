// Urban Luxe — availability.js (v2, август 2026)
// Было: список апартаментов захардкожен → новые объекты (август 2026) отвечали
// «Apartment not found». Стало: апартаменты и занятость берутся из Supabase
// (is_active=true) + живые iCal-фиды RealtyCalendar. Форматы ответов совместимы:
//   ?apt=<id>                          -> { apartment, booked_dates:[{start,end}...] }
//   ?check_in=YYYY-MM-DD&check_out=…   -> { check_in, check_out, total_apartments,
//                                          available_count, available:[{...}] }

const SB_URL = process.env.SUPABASE_URL || 'https://sebvfvtofiysbywxjqut.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI';

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=60'
};

function sbHeaders() { return { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }; }

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// iCal RealtyCalendar -> [{check_in, check_out}]
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
    if (co <= ci) continue;
    events.push({ check_in: ci, check_out: co });
  }
  return events;
}

function fetchWithTimeout(url, ms) {
  return Promise.race([
    fetch(url),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
  ]);
}

// Кэш на тёплую лямбду: apartment_id -> { at, events }
const icalCache = global.__ulIcalCache || (global.__ulIcalCache = {});
const CACHE_MS = 90 * 1000;

async function icalEvents(apt) {
  if (!apt.ical_export_url || !/^https?:\/\//.test(apt.ical_export_url)) return [];
  const c = icalCache[apt.id];
  if (c && Date.now() - c.at < CACHE_MS) return c.events;
  try {
    const r = await fetchWithTimeout(apt.ical_export_url, 9000);
    if (!r.ok) throw new Error('ical ' + r.status);
    const events = parseICS(await r.text());
    icalCache[apt.id] = { at: Date.now(), events };
    return events;
  } catch (e) {
    // Фид недоступен: используем протухший кэш, если есть; иначе пусто
    return c ? c.events : [];
  }
}

async function siteBookings(aptId) {
  const q = SB_URL + '/rest/v1/bookings?select=apartment_id,check_in,check_out' +
    '&status=eq.confirmed' + (aptId ? '&apartment_id=eq.' + encodeURIComponent(aptId) : '');
  const r = await fetch(q, { headers: sbHeaders() });
  if (!r.ok) return [];
  return r.json();
}

function overlaps(events, ci, co) {
  return events.some(e => e.check_in < co && e.check_out > ci);
}

function nightPrice(dateIso, weekday, weekend) {
  const dow = new Date(dateIso + 'T00:00:00Z').getUTCDay(); // 5=пт, 6=сб
  return (dow === 5 || dow === 6) ? weekend : weekday;
}

exports.handler = async (event) => {
  try {
    const p = (event && event.queryStringParameters) || {};

    // ---------- режим 1: календарь занятости одного апартамента ----------
    if (p.apt) {
      const r = await fetch(
        SB_URL + '/rest/v1/apartments?select=id,ical_export_url,is_active&id=eq.' + encodeURIComponent(p.apt),
        { headers: sbHeaders() }
      );
      const rows = r.ok ? await r.json() : [];
      const apt = rows[0];
      if (!apt || !apt.is_active) {
        return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'Apartment not found' }) };
      }
      const [rc, site] = await Promise.all([icalEvents(apt), siteBookings(apt.id)]);
      const days = new Set();
      rc.concat(site).forEach(e => {
        for (let d = e.check_in; d < e.check_out; d = addDays(d, 1)) days.add(d);
      });
      const booked_dates = [...days].sort().map(d => ({ start: d, end: addDays(d, 1) }));
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ apartment: apt.id, booked_dates }) };
    }

    // ---------- режим 2: поиск свободных по датам ----------
    const ci = p.check_in, co = p.check_out;
    if (!ci || !co || !/^\d{4}-\d{2}-\d{2}$/.test(ci) || !/^\d{4}-\d{2}-\d{2}$/.test(co) || co <= ci) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Некорректные даты' }) };
    }
    const ar = await fetch(
      SB_URL + '/rest/v1/apartments?select=id,name,complex,floor,style,weekday_price,weekend_price,ical_export_url&is_active=eq.true',
      { headers: sbHeaders() }
    );
    if (!ar.ok) throw new Error('apartments fetch failed: ' + ar.status);
    const apts = await ar.json();
    const site = await siteBookings(null);
    const siteByApt = {};
    site.forEach(b => { (siteByApt[b.apartment_id] = siteByApt[b.apartment_id] || []).push(b); });

    const nights = Math.round((new Date(co) - new Date(ci)) / 86400000);
    const results = await Promise.all(apts.map(async (a) => {
      const rc = await icalEvents(a);
      const busy = rc.concat(siteByApt[a.id] || []);
      if (overlaps(busy, ci, co)) return null;
      let total = 0;
      for (let d = ci; d < co; d = addDays(d, 1)) {
        total += nightPrice(d, a.weekday_price || 0, a.weekend_price || a.weekday_price || 0);
      }
      return {
        id: a.id, name: a.name, complex: a.complex, floor: a.floor,
        weekday: a.weekday_price, weekend: a.weekend_price, style: a.style,
        available: true, total, nights, check_in: ci, check_out: co
      };
    }));
    const available = results.filter(Boolean);
    return {
      statusCode: 200, headers: HEADERS,
      body: JSON.stringify({
        check_in: ci, check_out: co,
        total_apartments: apts.length,
        available_count: available.length,
        available
      })
    };
  } catch (e) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};
