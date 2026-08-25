// Urban Luxe — sync-ical.js (v2, август 2026)
// Было: список iCal-фидов RealtyCalendar захардкожен → новые объекты не попадали
// в шахматку/операции/доступность без правки кода.
// Стало: фиды берутся из Supabase (apartments: is_active=true, ical_export_url задан).
// Формат ответа полностью совместим со старым (шахматка, ops-center, дашборд, календарь).

const SB_URL = process.env.SUPABASE_URL || 'https://sebvfvtofiysbywxjqut.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI';

function tashkentToday() {
  // Asia/Tashkent = UTC+5, без переходов
  const now = new Date(Date.now() + 5 * 3600 * 1000);
  return now.toISOString().slice(0, 10);
}

function parseICS(text, apartmentId) {
  const events = [];
  const blocks = text.split('BEGIN:VEVENT').slice(1);
  for (const b of blocks) {
    const body = b.split('END:VEVENT')[0];
    const get = (re) => { const m = body.match(re); return m ? m[1].trim() : ''; };
    const ds = get(/DTSTART(?:;VALUE=DATE)?[^:]*:(\d{8})/);
    const de = get(/DTEND(?:;VALUE=DATE)?[^:]*:(\d{8})/);
    if (!ds || !de) continue;
    const fmt = (s) => s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
    const uidRaw = get(/UID:([^\r\n]+)/);
    const uid = (uidRaw.match(/\d{6,}/) || [uidRaw])[0];
    const ci = fmt(ds), co = fmt(de);
    const nights = Math.round((new Date(co) - new Date(ci)) / 86400000);
    if (nights <= 0) continue;
    events.push({
      apartment_id: apartmentId,
      check_in: ci,
      check_out: co,
      nights,
      source: 'other',
      summary: 'RC(' + uid + ')',
      guest_name: '',
      uid
    });
  }
  return events;
}

exports.handler = async () => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=60'
  };
  try {
    // 1) Активные квартиры с фидами — из Supabase
    const aptRes = await fetch(
      SB_URL + '/rest/v1/apartments?select=id,ical_export_url&is_active=eq.true&ical_export_url=not.is.null',
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
    );
    if (!aptRes.ok) throw new Error('apartments fetch failed: ' + aptRes.status);
    const apts = (await aptRes.json()).filter(a => /^https?:\/\//.test(a.ical_export_url || ''));

    // 2) Все фиды параллельно (таймаут на каждый — 12с)
    const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
    const results = await Promise.allSettled(apts.map(async (a) => {
      const r = await withTimeout(fetch(a.ical_export_url.trim()), 12000);
      if (!r.ok) throw new Error('feed ' + a.id + ': ' + r.status);
      return parseICS(await r.text(), a.id);
    }));

    const today = tashkentToday();
    const feedErrors = [];
    let all = [];
    results.forEach((res, i) => {
      if (res.status === 'fulfilled') all = all.concat(res.value);
      else feedErrors.push(apts[i].id);
    });

    // Только актуальные (как раньше): ещё не выехали
    all = all.filter(b => b.check_out >= today);
    all.sort((x, y) => x.apartment_id < y.apartment_id ? -1 : x.apartment_id > y.apartment_id ? 1 : (x.check_in < y.check_in ? -1 : 1));

    const checkins = all.filter(b => b.check_in === today);
    const checkouts = all.filter(b => b.check_out === today);
    const source_stats = {};
    all.forEach(b => { source_stats[b.source] = (source_stats[b.source] || 0) + 1; });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        total_bookings: all.length,
        today_checkins: checkins.length,
        today_checkouts: checkouts.length,
        checkins,
        checkouts,
        source_stats,
        all_bookings: all,
        synced_at: new Date().toISOString(),
        feeds: apts.length,
        feed_errors: feedErrors
      })
    };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};
