// Urban Luxe — staff-portal.js: API портала горничных (/staff.html).
// Доступ по личному токену горничной (staff.access_token), без пароля.
// GET  ?token=XXX            → задания: уборки/заезды сегодня и завтра + статусы
// POST {token, apartment_id, date, done} → отметка «убрано»
// Работает через SUPABASE_SERVICE_KEY (RLS-таблицы staff/cleaning_tasks закрыты для anon).

const SB_URL = process.env.SUPABASE_URL || 'https://sebvfvtofiysbywxjqut.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function sbFetch(path, opts) {
  return fetch(SB_URL + path, Object.assign({
    headers: {
      apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json', Prefer: 'return=representation,resolution=merge-duplicates'
    }
  }, opts));
}
function tashToday(off) {
  const d = new Date(Date.now() + 5 * 3600 * 1000);
  d.setUTCDate(d.getUTCDate() + (off || 0));
  return d.toISOString().slice(0, 10);
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  try {
    if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_KEY is not set');
    const q = event.queryStringParameters || {};
    const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
    const token = (body.token || q.token || '').trim();
    if (!token || token.length < 8) return { statusCode: 401, headers, body: JSON.stringify({ error: 'no token' }) };

    // валидация горничной
    const stRes = await sbFetch('/rest/v1/staff?select=id,name,role&access_token=eq.' + encodeURIComponent(token) + '&is_active=eq.true');
    const staff = (await stRes.json())[0];
    if (!staff) return { statusCode: 403, headers, body: JSON.stringify({ error: 'invalid token' }) };

    // отметка уборки
    if (event.httpMethod === 'POST') {
      const { apartment_id, date, done } = body;
      if (!apartment_id || !date) return { statusCode: 400, headers, body: JSON.stringify({ error: 'bad request' }) };
      const up = await sbFetch('/rest/v1/cleaning_tasks?on_conflict=apartment_id,date', {
        method: 'POST',
        body: JSON.stringify([{ apartment_id, date, done: !!done, done_by: done ? staff.id : null, done_at: done ? new Date().toISOString() : null }])
      });
      if (!up.ok) throw new Error('save failed: ' + (await up.text()).slice(0, 150));
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    // данные заданий
    const today = tashToday(0), tomorrow = tashToday(1);
    const base = process.env.URL || 'https://urbanluxe.cc';
    const [ical, aptsRes, tasksRes] = await Promise.all([
      fetch(base + '/.netlify/functions/sync-ical').then(r => r.json()),
      sbFetch('/rest/v1/apartments?select=id,name,complex,floor&is_active=eq.true'),
      sbFetch('/rest/v1/cleaning_tasks?select=*&date=gte.' + today + '&date=lte.' + tomorrow)
    ]);
    const apts = {}; (await aptsRes.json()).forEach(a => { apts[a.id] = a; });
    const tasks = {}; (await tasksRes.json()).forEach(tk => { tasks[tk.apartment_id + '|' + tk.date] = tk; });
    const all = ical.all_bookings || [];

    function dayData(d) {
      const checkouts = all.filter(b => b.check_out === d && apts[b.apartment_id]);
      const checkins = all.filter(b => b.check_in === d && apts[b.apartment_id]);
      const ciSet = new Set(checkins.map(b => b.apartment_id));
      return {
        date: d,
        cleanings: checkouts.map(b => {
          const a = apts[b.apartment_id];
          const tk = tasks[b.apartment_id + '|' + d];
          return {
            apartment_id: b.apartment_id,
            name: a.name, complex: a.complex || '', floor: a.floor,
            urgent: ciSet.has(b.apartment_id),
            done: !!(tk && tk.done)
          };
        }),
        checkins: checkins.map(b => {
          const a = apts[b.apartment_id];
          return { name: a.name, complex: a.complex || '', floor: a.floor, nights: b.nights };
        })
      };
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ staff: { name: staff.name, role: staff.role }, today: dayData(today), tomorrow: dayData(tomorrow), generated_at: new Date().toISOString() })
    };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};
