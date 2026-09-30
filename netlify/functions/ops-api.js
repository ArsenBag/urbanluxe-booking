// Urban Luxe — ops-api.js (01.10.2026). API для Mini App «Лист заездов» (public/ops.html) внутри бота бронеров.
// Авторизация: Telegram initData (подпись HMAC токеном бота) → staff.telegram_chat_id с ролью booker/ops, либо админ.
// GET  ?date=YYYY-MM-DD&initData=…   → { date, staff, rows:[…все квартиры с занятостью и полями daily_ops…], month:{дни с заездами} }
// POST { initData, date, apartment_id, patch:{…} }  → upsert строки daily_ops
// POST { initData, date, from, to } (dates) → занятость всех квартир на период (для календаря/шахматки)

const crypto = require('crypto');
const T = require('./_tg.js');
const OPS = require('./ops.js');

const H = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const out = (code, body) => ({ statusCode: code, headers: H, body: JSON.stringify(body) });

function verify(initData) {
  const token = T.TOKENS.booker;
  if (!initData || !token) return null;
  const p = new URLSearchParams(initData);
  const hash = p.get('hash'); if (!hash) return null;
  p.delete('hash');
  const check = [...p.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => k + '=' + v).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const sig = crypto.createHmac('sha256', secret).update(check).digest('hex');
  if (sig !== hash) return null;
  const age = Date.now() / 1000 - Number(p.get('auth_date') || 0);
  if (age > 86400 * 7) return null;
  try { return JSON.parse(p.get('user') || '{}'); } catch (e) { return null; }
}

async function staffOf(user) {
  if (!user || !user.id) return null;
  const id = String(user.id);
  if (id === T.ADMIN) return { id: null, name: 'Админ', role: 'admin', chat_id: id };
  const r = await T.sb('staff?select=id,name,role&is_active=eq.true&telegram_chat_id=eq.' + id).then(x => x.json()).catch(() => []);
  const s = r[0];
  if (!s || ['booker', 'ops'].indexOf(s.role) < 0) return null;
  s.chat_id = id; return s;
}

const FIELDS = ['source', 'checkin_time', 'checkout_time', 'guests', 'passport', 'access', 'registration', 'reg_sent', 'confirm_checkin', 'confirm_checkout', 'payment_total', 'payment_paid', 'review', 'note', 'guest_name'];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: H, body: '' };
  try {
    const q = event.queryStringParameters || {};
    const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
    const user = verify(body.initData || q.initData);
    const staff = await staffOf(user);
    if (!staff) return out(403, { error: 'no access', user_id: user && user.id });

    const base = process.env.URL || 'https://urbanluxe.cc';
    const ical = await fetch(base + '/.netlify/functions/sync-ical').then(r => r.json()).catch(() => ({ all_bookings: [] }));
    const all = ical.all_bookings || [];

    if (event.httpMethod === 'POST' && body.patch) {
      const date = body.date, aptId = body.apartment_id;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !aptId) return out(400, { error: 'bad request' });
      const patch = {}; FIELDS.forEach(k => { if (k in body.patch) patch[k] = body.patch[k]; });
      patch.updated_by = staff.name; patch.updated_at = new Date().toISOString(); patch.auto = false;
      const ex = await T.sb('daily_ops?select=id&date=eq.' + date + '&apartment_id=eq.' + encodeURIComponent(aptId)).then(x => x.json());
      let r;
      if (ex.length) r = await T.sb('daily_ops?id=eq.' + ex[0].id, { method: 'PATCH', body: JSON.stringify(patch) });
      else r = await T.sb('daily_ops', { method: 'POST', body: JSON.stringify([Object.assign({ date, apartment_id: aptId }, patch)]) });
      if (!r.ok) return out(500, { error: 'save failed: ' + (await r.text()).slice(0, 200) });
      // уведомить опер-менеджера об отметке бронера
      if (staff.role === 'booker') {
        const bot = T.makeBot('booker', 'tg-free');
        const ops = await T.sb('staff?select=telegram_chat_id&is_active=eq.true&role=eq.ops&telegram_chat_id=not.is.null').then(x => x.json()).catch(() => []);
        const ids = new Set(ops.map(o => o.telegram_chat_id)); if (T.ADMIN) ids.add(T.ADMIN);
        const apt = (await T.sb('apartments?select=name,complex&id=eq.' + encodeURIComponent(aptId)).then(x => x.json()))[0] || { name: aptId };
        const what = Object.keys(patch).filter(k => FIELDS.indexOf(k) > -1).map(k => k + '=' + patch[k]).join(', ');
        for (const id of ids) if (id !== staff.chat_id) await bot.send(id, '🔔 <b>' + T.esc(apt.name) + ' · ' + T.esc(apt.complex || '') + '</b> ' + T.ruDate(date) + ': ' + T.esc(what) + ' <i>(' + T.esc(staff.name) + ')</i>');
      }
      return out(200, { ok: true });
    }

    // занятость на период (шахматка)
    if (body.from && body.to) {
      const apts = await T.sb('apartments?select=id,name,complex,floor,rooms&is_active=eq.true&order=complex,name').then(x => x.json());
      const days = []; for (let d = body.from; d <= body.to && days.length < 62; d = addDays(d, 1)) days.push(d);
      const grid = apts.map(a => ({ id: a.id, name: a.name, complex: a.complex, rooms: a.rooms, days: days.map(d => { const b = all.find(x => x.apartment_id === a.id && x.check_in <= d && x.check_out > d); return b ? (b.check_in === d ? 'in' : 'busy') : ''; }) }));
      return out(200, { from: body.from, to: body.to, days, grid });
    }

    // день
    const date = /^\d{4}-\d{2}-\d{2}$/.test(q.date || body.date || '') ? (q.date || body.date) : T.tashToday(0);
    await OPS.ensureDay(date);
    const [apts, rowsRaw] = await Promise.all([
      T.sb('apartments?select=id,name,complex,floor,rooms,weekday_price,weekend_price&is_active=eq.true&order=complex,name').then(x => x.json()),
      T.sb('daily_ops?select=*&date=eq.' + date).then(x => x.json())
    ]);
    const ops = {}; rowsRaw.forEach(r => { ops[r.apartment_id] = r; });
    const rows = apts.map(a => {
      const cur = all.find(b => b.apartment_id === a.id && b.check_in <= date && b.check_out > date);
      const inB = all.find(b => b.apartment_id === a.id && b.check_in === date);
      const outB = all.find(b => b.apartment_id === a.id && b.check_out === date);
      const next = all.filter(b => b.apartment_id === a.id && b.check_in > date).sort((x, y) => x.check_in < y.check_in ? -1 : 1)[0];
      return Object.assign({
        apartment_id: a.id, name: a.name, complex: a.complex, floor: a.floor, rooms: a.rooms,
        status: inB ? 'in' : cur ? 'busy' : outB ? 'out' : 'free',
        stay: cur ? { check_in: cur.check_in, check_out: cur.check_out, nights: cur.nights } : null,
        free_until: (!cur && next) ? next.check_in : null
      }, ops[a.id] ? pick(ops[a.id]) : {});
    });
    // дни месяца с заездами (для календаря)
    const month = {}; all.forEach(b => { if (b.check_in.slice(0, 7) === date.slice(0, 7)) month[b.check_in] = (month[b.check_in] || 0) + 1; });
    return out(200, { date, staff: { name: staff.name, role: staff.role }, rows, month, sources: OPS.SOURCES, synced_at: ical.synced_at });
  } catch (e) {
    return out(500, { error: String(e.message || e) });
  }
};
function pick(r) { const o = {}; FIELDS.concat(['id', 'updated_by', 'updated_at']).forEach(k => { o[k] = r[k]; }); return o; }
function addDays(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
