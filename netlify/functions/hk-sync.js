// Urban Luxe — hk-sync.js (01.10.2026). Мост броней → housekeeping-бот.
// HK-бот сам не читает RealtyCalendar, а только принимает вебхуки. Эта функция каждые 15 минут (netlify.toml)
// берёт все актуальные брони (sync-ical = RC-фиды; + брони сайта/бота бронеров из bookings, которых RC ещё не импортировал)
// и отправляет их HK-боту в формате его вебхука. Отправляется только новое/изменённое (hash), исчезнувшие — как отмена.
//
// GET /.netlify/functions/hk-sync            → обычный прогон (до 40 отправок)
// GET ?limit=200                              → первичная загрузка большими порциями
// GET ?csv=1                                  → apartments.csv для импорта в HK-бот
// GET ?dry=1                                  → показать, что было бы отправлено, без отправки

const T = require('./_tg.js');
const HK = require('./_hk.js');
const crypto = require('crypto');

const URL_ = process.env.HK_WEBHOOK_URL;
const TOKEN = process.env.HK_WEBHOOK_TOKEN;
const H = { 'Content-Type': 'application/json' };
const out = (code, body) => ({ statusCode: code, headers: H, body: JSON.stringify(body) });

function addDays(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

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
    if (!URL_ || !TOKEN) return out(500, { error: 'HK_WEBHOOK_URL / HK_WEBHOOK_TOKEN не заданы' });
    const byId = {}; apts.forEach(a => { byId[a.id] = a; });

    const base = process.env.URL || 'https://urbanluxe.cc';
    const today = T.tashToday(0), horizon = addDays(today, 90);
    const ical = await fetch(base + '/.netlify/functions/sync-ical').then(r => r.json());
    const rc = (ical.all_bookings || []).filter(b => b.check_in <= horizon && byId[b.apartment_id] && byId[b.apartment_id].is_active);

    // брони сайта / бота бронеров, которых нет в RC (RC импортирует наш iCal с задержкой)
    const site = await T.sb('bookings?select=booking_ref,apartment_id,check_in,check_out,guests_count,guest_name,source&status=eq.confirmed&check_out=gte.' + today + '&check_in=lte.' + horizon).then(r => r.json()).catch(() => []);
    const rcKey = new Set(rc.map(b => b.apartment_id + '|' + b.check_in + '|' + b.check_out));
    const extra = site.filter(b => !rcKey.has(b.apartment_id + '|' + b.check_in + '|' + b.check_out) && byId[b.apartment_id])
      .map(b => ({ apartment_id: b.apartment_id, check_in: b.check_in, check_out: b.check_out, uid: 'UL-' + b.booking_ref, guests: b.guests_count, guest_name: b.guest_name, source: b.source || 'site' }));

    const wanted = rc.map(b => ({ apartment_id: b.apartment_id, check_in: b.check_in, check_out: b.check_out, uid: 'RC-' + b.uid, guests: null, guest_name: b.guest_name || '', source: 'rc' })).concat(extra);
    const hashOf = b => crypto.createHash('md5').update([b.apartment_id, b.check_in, b.check_out, b.guests || ''].join('|')).digest('hex');

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
        begin_date: w.check_in, end_date: w.check_out, arrival_time: '15:00', departure_time: '12:00',
        guests_count: w.guests || undefined, guest_name: w.guest_name || undefined, source: w.source
      };
      const r = await post(payload);
      await T.sb('hk_sync?on_conflict=uid', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
        body: JSON.stringify([{ uid: w.uid, apartment_id: w.apartment_id, check_in: w.check_in, check_out: w.check_out, guests: w.guests, hash: r.ok ? hashOf(w) : null, sent_at: new Date().toISOString(), canceled: false, last_response: r.status + ' ' + r.body }]) });
      if (r.ok) sent++; else errors.push(w.uid + ': ' + r.status);
    }
    for (const k of toCancel.slice(0, Math.max(0, limit - sent))) {
      const a = byId[k.apartment_id] || {};
      const r = await post({ event: 'cancel_booking', id: k.uid, status: 'canceled', apartment_code: a.hk_code, end_date: k.check_out });
      await T.sb('hk_sync?uid=eq.' + encodeURIComponent(k.uid), { method: 'PATCH', body: JSON.stringify({ canceled: r.ok, sent_at: new Date().toISOString(), last_response: r.status + ' ' + r.body }) });
      if (r.ok) canceled++; else errors.push('cancel ' + k.uid + ': ' + r.status);
    }
    return out(200, { ok: true, wanted: wanted.length, sent, canceled, pending: Math.max(0, toSend.length - sent), errors: errors.slice(0, 10), synced_at: ical.synced_at });
  } catch (e) {
    return out(500, { error: String(e.message || e) });
  }
};
