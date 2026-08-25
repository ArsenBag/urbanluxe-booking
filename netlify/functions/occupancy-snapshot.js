// Urban Luxe — occupancy-snapshot.js (Netlify scheduled function, 09:00 Ташкент)
// Каждый день фиксирует занятость всех квартир на 60 дней вперёд в occupancy_daily.
// Прошедшие даты не трогает — так копится честная история (iCal её не хранит).
// Запись через SUPABASE_SERVICE_KEY (env Netlify). Можно дернуть вручную:
//   /.netlify/functions/occupancy-snapshot

const SB_URL = process.env.SUPABASE_URL || 'https://sebvfvtofiysbywxjqut.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function tashToday() {
  return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
}
function addDays(iso, n) {
  const d = new Date(iso); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

exports.handler = async () => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_KEY is not set');
    const today = tashToday();
    const horizon = addDays(today, 60);

    // 1) Брони RC (sync-ical берёт фиды активных квартир из базы)
    const base = process.env.URL || 'https://urbanluxe.cc';
    const ical = await fetch(base + '/.netlify/functions/sync-ical').then(r => r.json());

    // 2) Подтверждённые брони сайта
    const siteRes = await fetch(
      SB_URL + '/rest/v1/bookings?select=apartment_id,check_in,check_out&status=eq.confirmed',
      { headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY } }
    );
    const site = siteRes.ok ? await siteRes.json() : [];

    // 3) Разворачиваем в дни
    const rows = new Map(); // key -> row
    function mark(list, source) {
      for (const b of list) {
        if (!b.apartment_id || !b.check_in || !b.check_out) continue;
        let d = b.check_in < today ? today : b.check_in;
        while (d < b.check_out && d <= horizon) {
          const key = b.apartment_id + '|' + d;
          if (!rows.has(key)) rows.set(key, { apartment_id: b.apartment_id, date: d, busy: true, source });
          d = addDays(d, 1);
        }
      }
    }
    mark(ical.all_bookings || [], 'rc');
    mark(site, 'site');

    // 4) Свободные дни тоже фиксируем (busy=false) — чтобы отличать «свободно» от «нет снапшота»
    const aptsRes = await fetch(
      SB_URL + '/rest/v1/apartments?select=id&is_active=eq.true',
      { headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY } }
    );
    const apts = aptsRes.ok ? await aptsRes.json() : [];
    for (const a of apts) {
      let d = today;
      while (d <= horizon) {
        const key = a.id + '|' + d;
        if (!rows.has(key)) rows.set(key, { apartment_id: a.id, date: d, busy: false, source: 'free' });
        d = addDays(d, 1);
      }
    }

    // 5) Upsert порциями
    const all = Array.from(rows.values()).map(r => ({ ...r, updated_at: new Date().toISOString() }));
    let saved = 0;
    for (let i = 0; i < all.length; i += 500) {
      const chunk = all.slice(i, i + 500);
      const up = await fetch(SB_URL + '/rest/v1/occupancy_daily?on_conflict=apartment_id,date', {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY,
          'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates'
        },
        body: JSON.stringify(chunk)
      });
      if (!up.ok) throw new Error('upsert failed: ' + up.status + ' ' + (await up.text()).slice(0, 200));
      saved += chunk.length;
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, date: today, horizon, rows: saved, busy: all.filter(r => r.busy).length }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};
