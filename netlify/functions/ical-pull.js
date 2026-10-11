// ical-pull.js — каждые 10 минут читает iCal-календари площадок без API (Яндекс Путешествия, Sutochno) из ical_sources
// и превращает события в брони: source='ical', channel=<канал>, external_id=UID. Исчезло событие → отмена.
// Персональных данных в iCal нет — гость = название площадки, бронер дополняет из экстранета.
const C = require('./_channex.js');

function parseICS(text) {
  const ev = [];
  for (const b of text.split('BEGIN:VEVENT').slice(1)) {
    const body = b.split('END:VEVENT')[0].replace(/\r?\n[ \t]/g, '');
    const get = re => { const m = body.match(re); return m ? m[1].trim() : ''; };
    const ds = get(/DTSTART(?:;[^:]*)?:(\d{8})/), de = get(/DTEND(?:;[^:]*)?:(\d{8})/);
    if (!ds || !de) continue;
    const f = s => s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
    const ci = f(ds), co = f(de); if (co <= ci) continue;
    ev.push({ uid: get(/UID:([^\r\n]+)/) || (ci + '_' + co), check_in: ci, check_out: co, summary: get(/SUMMARY:([^\r\n]+)/), description: get(/DESCRIPTION:([^\r\n]+)/) });
  }
  return ev;
}

async function pullOne(src) {
  const r = await fetch(src.url, { headers: { 'User-Agent': 'UrbanLuxe-PMS/1.0' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const text = await r.text(); if (!/BEGIN:VCALENDAR/.test(text)) throw new Error('не iCal');
  const events = parseICS(text);
  const today = C.today();
  const existing = await C.q('bookings?select=id,external_id,check_in,check_out,status&source=eq.ical&channel=eq.' + encodeURIComponent(src.channel) + '&apartment_id=eq.' + encodeURIComponent(src.apartment_id) + '&check_out=gte.' + today + '&limit=1000');
  const byUid = {}; existing.forEach(b => byUid[b.external_id] = b);
  const seen = new Set(); let created = 0, updated = 0, cancelled = 0, conflicts = 0;
  const label = { yandex: 'Яндекс Путешествия', sutochno: 'Sutochno' }[src.channel] || src.channel;
  for (const e of events) {
    if (e.check_out < today) continue;
    const uid = src.channel + ':' + e.uid; seen.add(uid);
    // своя же бронь, отражённая площадкой обратно (наш iCal → их → к нам): пропускаем, если даты уже заняты нашей не-ical бронью
    const own = await C.q('bookings?select=id,source&apartment_id=eq.' + encodeURIComponent(src.apartment_id) + '&status=neq.cancelled&check_in=lt.' + e.check_out + '&check_out=gt.' + e.check_in + '&limit=5');
    const cur = byUid[uid];
    if (cur) { if (cur.check_in !== e.check_in || cur.check_out !== e.check_out) { try { await C.q('bookings?id=eq.' + cur.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ check_in: e.check_in, check_out: e.check_out, nights: Math.round((new Date(e.check_out) - new Date(e.check_in)) / 864e5), updated_at: new Date().toISOString(), created_by: 'ical:' + src.channel }) }); updated++; } catch (err) { conflicts++; } } continue; }
    if (own.some(b => b.source !== 'ical')) continue;   // это отражение нашей брони — не дублируем
    if (own.length) { conflicts++; continue; }
    try {
      await C.q('bookings', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ apartment_id: src.apartment_id, guest_name: label, check_in: e.check_in, check_out: e.check_out, nights: Math.round((new Date(e.check_out) - new Date(e.check_in)) / 864e5), status: 'confirmed', source: 'ical', channel: src.channel, external_id: uid, total_price: 0, currency: 'USD', notes: [e.summary, e.description].filter(Boolean).join(' · ').slice(0, 500) || null, booking_ref: 'UL-' + src.channel.slice(0, 2).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(), created_by: 'ical:' + src.channel }) });
      created++;
      await C.alertAdmin('🆕 Бронь ' + label + ' (iCal): ' + src.apartment_id + ' ' + C.addDays(e.check_in, 0) + ' → ' + e.check_out + '\nДетали гостя и сумма — в экстранете ' + label + '. Дополните бронь в /pms.');
    } catch (err) { conflicts++; await C.alertAdmin('🚨 ' + label + ': бронь ' + src.apartment_id + ' ' + e.check_in + '→' + e.check_out + ' не записана: ' + String(err.message).slice(0, 120)); }
  }
  for (const b of existing) if (!seen.has(b.external_id) && b.status !== 'cancelled' && b.check_in >= today) { await C.q('bookings?id=eq.' + b.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'cancelled', cancelled_at: new Date().toISOString(), created_by: 'ical:' + src.channel }) }); cancelled++; }
  return { events: events.length, created, updated, cancelled, conflicts };
}

async function pullAll() {
  const srcs = await C.q('ical_sources?select=*&is_active=eq.true');
  const res = {};
  for (const s of srcs) {
    try { const r = await pullOne(s); res[s.apartment_id + '/' + s.channel] = r; await C.q('ical_sources?id=eq.' + s.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ last_fetch_at: new Date().toISOString(), last_ok_at: new Date().toISOString(), error: null, events_count: r.events }) }); }
    catch (e) { res[s.apartment_id + '/' + s.channel] = { error: String(e.message) }; await C.q('ical_sources?id=eq.' + s.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ last_fetch_at: new Date().toISOString(), error: String(e.message).slice(0, 300) }) }); }
  }
  return { sources: srcs.length, res };
}

exports.handler = async () => { try { return { statusCode: 200, body: JSON.stringify(await pullAll()) }; } catch (e) { return { statusCode: 500, body: String(e.message) }; } };
exports.pullAll = pullAll;
