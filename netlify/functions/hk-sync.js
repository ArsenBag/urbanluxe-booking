// Urban Luxe — hk-sync.js (09.10.2026). Мост броней → housekeeping-бот (VPS, hk.urbanluxe.cc).
// HK-бот сам RC не читает, только принимает вебхуки. Эта функция каждые 15 минут (netlify.toml) берёт все актуальные
// брони из единого календаря `bookings` (RC через rc-sync + сайт + шахматка + лист «Брони») и отправляет их HK-боту
// в формате его вебхука. Отправляется только новое/изменённое (hash), исчезнувшие/отменённые — как отмена.
//
// GET /.netlify/functions/hk-sync            → обычный прогон (до 40 отправок)
// GET ?limit=300                              → первичная загрузка большими порциями (повторять, пока pending > 0)
// GET ?csv=1                                  → apartments.csv для импорта в HK-бот
// GET ?dry=1                                  → показать, что было бы отправлено, без отправки
// GET ?ping=1                                 → проверка связи с HK-ботом (/health)

const T = require('./_tg.js');
const HK = require('./_hk.js');
const crypto = require('crypto');

const URL_ = process.env.HK_WEBHOOK_URL;
const TOKEN = process.env.HK_WEBHOOK_TOKEN;
const H = { 'Content-Type': 'application/json' };
const out = (code, body) => ({ statusCode: code, headers: H, body: JSON.stringify(body) });

function addDays(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function hhmm(s, def) { const m = String(s || '').match(/(\d{1,2}):(\d{2})/); return m ? (m[1].length < 2 ? '0' : '') + m[1] + ':' + m[2] : def; }

async function post(payload) {
  const r = await fetch(URL_ + (URL_.indexOf('?') > -1 ? '&' : '?') + 'token=' + encodeURIComponent(TOKEN), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const t = await r.text();
  return { ok: r.ok, status: r.status, body: t.slice(0, 300) };
}

exports.handler = async (event) => {
  const q = (event && event.queryStringParameters) || {};
  try {
    const apts = await HK.apartments();
    if (q.csv) return { statusCode: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="apartments.csv"' }, body: HK.csv(apts) };
    if (!URL_ || !TOKEN) return out(500, { error: 'HK_WEBHOOK_URL / HK_WEBHOOK_TOKEN не заданы в Netlify' });
    if (q.ping) {
      const h = await fetch(URL_.replace(/\/webhooks\/.*$/, '/health')).then(r => r.text()).catch(e => 'ERR ' + e.message);
      return out(200, { health: h.slice(0, 200) });
    }
    const byId = {}; apts.forEach(a => { byId[a.id] = a; });

    const today = T.tashToday(0), horizon = addDays(today, 90);
    // единый календарь: всё, что живёт или заедет в ближайшие 90 дней (блоки владельца HK-боту не нужны)
    const rows = await T.sb('bookings?select=id,booking_ref,apartment_id,check_in,check_out,guests_count,guest_name,guest_phone,source,channel,status,arrival_time,departure_time,notes&status=in.(confirmed,checked_in)&check_out=gte.' + today + '&check_in=lte.' + horizon + '&order=check_in').then(r => r.json()).catch(() => []);
    const wanted = (Array.isArray(rows) ? rows : []).filter(b => byId[b.apartment_id] && byId[b.apartment_id].is_active).map(b => ({
      uid: 'UL-' + (b.booking_ref || b.id), apartment_id: b.apartment_id, check_in: b.check_in, check_out: b.check_out,
      guests: b.guests_count || null, guest_name: b.guest_name || '', guest_phone: b.guest_phone || '', source: b.channel || b.source || 'site',
      arrival: hhmm(b.arrival_time, '15:00'), departure: hhmm(b.departure_time, '12:00'), notes: b.notes || ''
    }));
    const hashOf = b => crypto.createHash('md5').update([b.apartment_id, b.check_in, b.check_out, b.guests || '', b.arrival, b.departure, b.guest_name].join('|')).digest('hex');

    const known = await T.sb('hk_sync?select=uid,apartment_id,check_in,check_out,hash,canceled').then(r => r.json()).catch(() => []);
    const knownBy = {}; known.forEach(k => { knownBy[k.uid] = k; });
    const wantedBy = {}; wanted.forEach(w => { wantedBy[w.uid] = w; });

    const toSend = wanted.filter(w => !knownBy[w.uid] || knownBy[w.uid].hash !== hashOf(w) || knownBy[w.uid].canceled);
    const toCancel = known.filter(k => !k.canceled && !wantedBy[k.uid] && k.check_out >= today);
    const limit = Math.min(+q.limit || 40, 300);
    if (q.dry) return out(200, { wanted: wanted.length, to_send: toSend.length, to_cancel: toCancel.length, sample: toSend.slice(0, 5), cancel: toCancel.slice(0, 5) });

    let sent = 0, canceled = 0, errors = [];
    for (const w of toSend.slice(0, limit)) {
      const a = byId[w.apartment_id];
      const payload = {
        event: 'update_booking', id: w.uid, status: 'confirmed',
        apartment_code: a.hk_code, realty_id: a.realty_id || undefined, building: a.complex,
        begin_date: w.check_in, end_date: w.check_out, arrival_time: w.arrival, departure_time: w.departure,
        guests_count: w.guests || undefined, guest_name: w.guest_name || undefined, guest_phone: w.guest_phone || undefined,
        source: w.source, notes: w.notes || undefined
      };
      const r = await post(payload);
      await T.sb('hk_sync?on_conflict=uid', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
        body: JSON.stringify([{ uid: w.uid, apartment_id: w.apartment_id, check_in: w.check_in, check_out: w.check_out, guests: w.guests, hash: r.ok ? hashOf(w) : null, sent_at: new Date().toISOString(), canceled: false, last_response: r.status + ' ' + r.body }]) });
      if (r.ok) sent++; else errors.push(w.uid + ': ' + r.status + ' ' + r.body.slice(0, 80));
    }
    for (const k of toCancel.slice(0, Math.max(0, limit - sent))) {
      const a = byId[k.apartment_id] || {};
      const r = await post({ event: 'cancel_booking', id: k.uid, status: 'canceled', apartment_code: a.hk_code, begin_date: k.check_in, end_date: k.check_out });
      await T.sb('hk_sync?uid=eq.' + encodeURIComponent(k.uid), { method: 'PATCH', body: JSON.stringify({ canceled: r.ok, sent_at: new Date().toISOString(), last_response: r.status + ' ' + r.body }) });
      if (r.ok) canceled++; else errors.push('cancel ' + k.uid + ': ' + r.status);
    }
    return out(200, { ok: true, wanted: wanted.length, sent, canceled, pending: Math.max(0, toSend.length - sent), errors: errors.slice(0, 10) });
  } catch (e) {
    return out(500, { error: String(e.message || e) });
  }
};
