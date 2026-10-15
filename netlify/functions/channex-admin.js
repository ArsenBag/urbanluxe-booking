// channex-admin.js — управление хабом каналов из /pms (раздел «Каналы»). Только admin (app_users.role).
// GET  ?a=status                       → properties, units, очередь, конфликты, последние брони, iCal-источники, связь с Channex
// POST {a:'setup_complex', complex, title?}   → создать в Channex property + room type/rate plan на каждую квартиру ЖК → channel_units
// POST {a:'setup_webhook'}             → global webhook Channex → /.netlify/functions/channex-webhook
// POST {a:'push_full', apt?}           → полная отправка цен/занятости (очередь + отправка сейчас)
// POST {a:'feed'}                      → забрать неподтверждённые брони из Channex
// POST {a:'unit_update', apartment_id, markup_pct?, push_rates?, push_availability?, is_active?}
// POST {a:'resolve_conflict', id, resolution:'moved'|'cancelled_on_ota'|'accept'} → accept = повторить запись брони (даты освободили)
// POST {a:'ical_add', apartment_id, channel, url} | {a:'ical_delete', id} | {a:'ical_pull'}
const C = require('./_channex.js');
const SB_URL = process.env.SUPABASE_URL || 'https://sebvfvtofiysbywxjqut.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI';
const H = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const out = (c, b) => ({ statusCode: c, headers: H, body: JSON.stringify(b) });
const enc = encodeURIComponent;
const COMPLEX_ADDR = { 'Nest One': 'Batyr Zakirov st. 1A', 'U-Tower': 'Beshagach 1/1', 'Mirabad': 'Aybek st. 38A', 'Kislorod': 'Burijar st. 1', 'Gardens Residence': 'Tashkent City', 'Modera Towers': 'Shota Rustaveli st. 19' };

async function auth(event) {
  const h = event.headers || {}; const tok = ((h.authorization || h.Authorization || '').match(/^Bearer\s+(.+)$/i) || [])[1]; if (!tok) return null;
  const r = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: ANON, Authorization: 'Bearer ' + tok } }); if (!r.ok) return null;
  const u = await r.json(); if (!u || !u.email) return null;
  const rows = await C.q('app_users?select=*&email=eq.' + enc(u.email.toLowerCase())); if (!rows.length || rows[0].is_active === false) return null;
  return { email: rows[0].email, role: rows[0].role, name: rows[0].name || rows[0].email, org_id: rows[0].org_id || 1 };
}

async function status(user) {
  const org = '&org_id=eq.' + user.org_id;
  const [props, units, apts, pending, conflicts, recent, icals, failed] = await Promise.all([
    C.q('channel_properties?select=*' + org + '&order=id'),
    C.q('channel_units?select=*&order=apartment_id'),
    C.q('apartments?select=id,name,complex,floor,max_guests,catalog_no,is_active' + org + '&order=complex,catalog_no'),
    C.q('channel_outbox?select=id&sent_at=is.null&limit=1000'),
    C.q('channel_conflicts?select=*&resolved=eq.false&order=created_at.desc'),
    C.q('channel_bookings?select=id,unique_id,ota_name,status,received_at,processed_at,acked_at,error,conflict,booking_id&order=received_at.desc&limit=30'),
    C.q('ical_sources?select=*&order=apartment_id'),
    C.q('channel_outbox?select=apartment_id,error,attempts,created_at&sent_at=is.null&attempts=gte.1&order=created_at.desc&limit=20')
  ]);
  let channex = null, channels = [];
  if (process.env.CHANNEX_API_KEY) {
    try { const j = await C.cx('GET', '/properties?pagination[limit]=50'); channex = { ok: true, base: C.BASE, properties: (j.data || []).map(p => ({ id: p.id, title: p.attributes && p.attributes.title, channels: p.attributes && p.attributes.acc_channels_count })) }; } catch (e) { channex = { ok: false, base: C.BASE, error: String(e.message).slice(0, 200) }; }
    try { const j = await C.cx('GET', '/channels?pagination[limit]=100'); channels = (j.data || []).map(c => { const a = c.attributes || {}; const props = a.properties || ((c.relationships && c.relationships.properties && c.relationships.properties.data) || []).map(x => x.id); return { id: c.id, title: a.title, channel: a.channel, is_active: a.is_active, properties: props }; }); } catch (e) { channels = []; }
  }
  else channex = { ok: false, error: 'CHANNEX_API_KEY не задан' };
  const mine = new Set(apts.map(a => a.id));
  const markups = {}; (await C.q('channel_markups?select=*&org_id=eq.' + user.org_id)).forEach(m => markups[m.channel] = Number(m.pct));
  return { channex, channels, markups, ota_plans: C.OTA_PLANS, properties: props, units: units.filter(u => mine.has(u.apartment_id)), apartments: apts, pending: pending.length, failed, conflicts, recent, icals, webhook_url: (process.env.URL || 'https://urbanluxe.cc') + '/.netlify/functions/channex-webhook', ical_base: (process.env.URL || 'https://urbanluxe.cc') + '/.netlify/functions/calendar?apt=' };
}

async function setupComplex(body, user) {
  const complex = body.complex; if (!complex) throw new Error('complex');
  const apts = await C.q('apartments?select=id,name,complex,floor,max_guests,weekday_price,description_en,description&complex=eq.' + enc(complex) + '&org_id=eq.' + user.org_id + '&is_active=eq.true&order=catalog_no,name');
  if (!apts.length) throw new Error('В ЖК нет активных квартир');
  let prop = (await C.q('channel_properties?select=*&complex=eq.' + enc(complex) + '&org_id=eq.' + user.org_id))[0];
  const log = [];
  if (!prop || !prop.external_id) {
    const title = body.title || ('Urban Luxe ' + complex);
    const j = await C.cx('POST', '/properties', { property: { title, currency: 'USD', email: process.env.CHANNEX_CONTACT_EMAIL || 'booking@urbanluxe.cc', phone: '+998936900044', country: 'UZ', city: 'Tashkent', address: COMPLEX_ADDR[complex] || 'Tashkent', zip_code: '100000', timezone: 'Asia/Tashkent', property_type: 'apartment', website: 'https://urbanluxe.cc', settings: { min_stay_type: 'arrival', state_length: 500, allow_availability_autoupdate_on_modification: false, allow_availability_autoupdate_on_cancellation: false } } });
    const ext = j.data.id;
    if (prop) { await C.q('channel_properties?id=eq.' + prop.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ external_id: ext, name: title, updated_at: new Date().toISOString() }) }); prop.external_id = ext; }
    else prop = (await C.q('channel_properties', { method: 'POST', body: JSON.stringify({ provider: 'channex', external_id: ext, name: title, complex, currency: 'USD', org_id: user.org_id }) }))[0];
    log.push('property created ' + ext);
  }
  const existing = {}; (await C.q('channel_units?select=*&channel_property_id=eq.' + prop.id)).forEach(u => existing[u.apartment_id] = u);
  for (const a of apts) {
    const u = existing[a.id];
    if (u && u.external_room_type_id && u.external_rate_plan_id) { log.push(a.id + ': already'); continue; }
    const occ = Math.max(1, Math.min(10, a.max_guests || 2));
    let rt = u && u.external_room_type_id;
    if (!rt) { const r = await C.cx('POST', '/room_types', { room_type: { property_id: prop.external_id, title: a.name, count_of_rooms: 1, occ_adults: occ, occ_children: 0, occ_infants: 1, default_occupancy: occ, room_kind: 'room', codes: { apartment_id: a.id }, content: { description: (a.description_en || a.description || '').slice(0, 2000) || null } } }); rt = r.data.id; }
    let rp = u && u.external_rate_plan_id;
    if (!rp) { const r = await C.cx('POST', '/rate_plans', { rate_plan: { property_id: prop.external_id, room_type_id: rt, title: 'Standard', sell_mode: 'per_room', rate_mode: 'manual', currency: 'USD', meal_type: 'none', options: [{ occupancy: occ, is_primary: true, rate: String(a.weekday_price || 100) + '.00' }], min_stay_arrival: 1, meta: { apartment_id: a.id } } }); rp = r.data.id; }
    await C.q('channel_units?on_conflict=apartment_id', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' }, body: JSON.stringify({ apartment_id: a.id, channel_property_id: prop.id, external_room_type_id: rt, external_rate_plan_id: rp, is_active: true, updated_at: new Date().toISOString() }) });
    log.push(a.id + ': room ' + rt.slice(0, 8) + ' rate ' + rp.slice(0, 8));
  }
  // производные тарифы площадок (по умолчанию 0 %, регулируются в «Каналы → Наценки»)
  const mk = {}; (await C.q('channel_markups?select=*&org_id=eq.' + user.org_id)).forEach(m => mk[m.channel] = Number(m.pct));
  const unitsNow = await C.q('channel_units?select=*&channel_property_id=eq.' + prop.id);
  for (const u of unitsNow) for (const ch of Object.keys(C.OTA_PLANS)) { try { await C.ensureDerived(u, prop, ch, mk[ch] || 0); } catch (e) { log.push(u.apartment_id + ' ' + ch + ': ' + String(e.message).slice(0, 100)); } }
  // в очередь — только квартиры этого ЖК (полная очередь по всем квартирам упиралась в лимит Channex 429 на уже подключённых)
  let full = 0; for (const a of apts) { try { full += Number(await C.rpc('pms_outbox_full', { p_apt: a.id })) || 0; } catch (_) { } }
  const pushed = await C.processOutbox();
  return { property: prop, log, queued: full, pushed };
}

async function setupWebhook() {
  const url = (process.env.URL || 'https://urbanluxe.cc') + '/.netlify/functions/channex-webhook';
  const secret = process.env.CHANNEX_WEBHOOK_SECRET; if (!secret) throw new Error('CHANNEX_WEBHOOK_SECRET не задан в Netlify env');
  const list = await C.cx('GET', '/webhooks?pagination[limit]=100');
  const mine = (list.data || []).filter(w => w.attributes && w.attributes.callback_url === url);
  const body = { webhook: { callback_url: url, event_mask: 'booking;booking_unmapped_room;booking_unmapped_rate;sync_error;rate_error;non_acked_booking;reservation_request;inquiry', property_id: null, is_global: true, is_active: true, send_data: true, headers: { 'X-UL-Secret': secret }, request_params: {} } };
  if (mine.length) { const w = await C.cx('PUT', '/webhooks/' + mine[0].id, body); return { updated: w.data.id }; }
  const w = await C.cx('POST', '/webhooks', body); return { created: w.data.id };
}


// 14.10.2026: переход staging → production. Все внешние id (property / room type / rate plan / производные тарифы) у Channex
// на проде другие, поэтому: сбрасываем id в channel_properties/channel_units (маппинг квартира→property сохраняем), чистим очередь,
// затем setup_complex по каждому ЖК + setup_webhook. Защита: работает только если CHANNEX_BASE указывает на app.channex.io
// и в базе ещё нет прод-id (settings.env = 'production').
async function goProduction(body, user) {
  const base = (process.env.CHANNEX_BASE || '').replace(/\/$/, '');
  if (!/app\.channex\.io$/.test(base)) throw new Error('CHANNEX_BASE должен быть https://app.channex.io (сейчас ' + (base || 'не задан') + ')');
  const props = await C.q('channel_properties?select=*&org_id=eq.' + user.org_id);
  const already = props.filter(p => p.settings && p.settings.env === 'production');
  if (already.length && !body.force) throw new Error('Уже на проде: ' + already.map(p => p.complex).join(', ') + ' (force:true — повторить сброс)');
  // проверка ключа: должен открываться прод
  const me = await C.cx('GET', '/properties?pagination[limit]=1');
  const log = ['prod key ok, properties visible: ' + ((me.meta && me.meta.total) != null ? me.meta.total : (me.data || []).length)];
  // 1. сброс id
  for (const p of props) {
    await C.q('channel_properties?id=eq.' + p.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ external_id: null, settings: Object.assign({}, p.settings || {}, { env: 'production', staging_id: p.external_id }), updated_at: new Date().toISOString() }) });
    await C.q('channel_units?channel_property_id=eq.' + p.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ external_room_type_id: null, external_rate_plan_id: null, derived: {}, last_task: null, last_error: null, last_pushed_at: null }) });
  }
  await C.q('channel_outbox?sent_at=is.null', { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  log.push('reset ' + props.length + ' properties, outbox cleared');
  // 2. заново создать property/комнаты/тарифы по каждому ЖК (последовательно — лимиты Channex)
  const complexes = [...new Set(props.map(p => p.complex))];
  const results = {};
  for (const cx of complexes) { try { const r = await setupComplex({ complex: cx }, user); results[cx] = { property: r.property.external_id, units: r.log.length, queued: r.queued }; } catch (e) { results[cx] = { error: String(e.message).slice(0, 200) }; } }
  // 3. вебхук
  let webhook; try { webhook = await setupWebhook(); } catch (e) { webhook = { error: String(e.message).slice(0, 200) }; }
  return { log, results, webhook };
}

// 15.10.2026: Booking.com на проде. Одна карточка Booking (hotel_id) = один канал Channex = одно property (ЖК).
// booking_probe  {hotel_id}                       → test_connection + mapping_details + connection_details (посмотреть номера/тарифы карточки)
// booking_connect {hotel_id, title?, pairs:{<booking_room_id>:<apartment_id>}, activate?:true}
//   → канал BookingCom с маппингом: каждый номер карточки → производный тариф «Booking.com» квартиры; все parent-тарифы номера
//   на один наш тариф (одинаковая цена), primary — первый тариф и максимальная occupancy; OBP — по одному маппингу на каждую occupancy.
async function bookingProbe(body) {
  const settings = { hotel_id: String(body.hotel_id) };
  const t = await C.cx('POST', '/channels/test_connection', { channel: 'BookingCom', settings });
  const m = await C.cx('POST', '/channels/mapping_details', { channel: 'BookingCom', settings });
  let cd = null; try { cd = await C.cx('POST', '/channels/connection_details', { channel: 'BookingCom', settings }); } catch (e) { cd = { error: String(e.message).slice(0, 120) }; }
  return { test: t.data, mapping: m.data, connection: cd && cd.data };
}

async function bookingConnect(body, user) {
  const hotel_id = String(body.hotel_id || ''); if (!hotel_id) throw new Error('hotel_id');
  const pairs = body.pairs || {}; if (!Object.keys(pairs).length) throw new Error('pairs');
  const settings = { hotel_id };
  const t = await C.cx('POST', '/channels/test_connection', { channel: 'BookingCom', settings });
  if (!(t.data && t.data.success)) throw new Error('test_connection: ' + JSON.stringify(t.data));
  const m = await C.cx('POST', '/channels/mapping_details', { channel: 'BookingCom', settings });
  const md = m.data || {}; const pricing = md.pricing_type || 'Standard';
  const units = await C.q('channel_units?select=*&is_active=eq.true');
  const byApt = {}; units.forEach(u => byApt[u.apartment_id] = u);
  const log = []; const rate_plans = []; const propIds = new Set();
  for (const room of (md.rooms || [])) {
    const apt = pairs[String(room.id)]; if (!apt) { log.push('skip room ' + room.id + ' ' + room.title + ' (нет пары)'); continue; }
    const u = byApt[apt]; if (!u) { log.push('no unit ' + apt); continue; }
    const d = (u.derived || {}).booking; if (!d || !d.rate_plan_id) { log.push('no derived Booking.com plan for ' + apt); continue; }
    propIds.add(u.channel_property_id);
    const rates = (room.rates || []).filter(r => !r.readonly);
    if (!rates.length) { log.push('room ' + room.id + ' без тарифов'); continue; }
    rates.forEach((r, ri) => {
      const occs = (pricing === 'OBP' && r.occupancies && r.occupancies.length) ? [...r.occupancies].sort((a, b) => b - a) : [r.max_persons || 2];
      occs.forEach((occ, oi) => rate_plans.push({ rate_plan_id: d.rate_plan_id, settings: { room_type_code: room.id, rate_plan_code: r.id, occupancy: occ, pricing_type: r.pricing || pricing, primary_occ: oi === 0, readonly: !!r.readonly } }));
      log.push(room.title + ' / ' + r.title + ' → ' + apt + ' (occ ' + occs.join(',') + ')');
    });
  }
  if (!rate_plans.length) throw new Error('нечего мапить: ' + log.join('; '));
  if (propIds.size !== 1) throw new Error('номера карточки из разных property Channex: ' + [...propIds].join(','));
  const prop = (await C.q('channel_properties?select=*&id=eq.' + [...propIds][0]))[0];
  const groups = await C.cx('GET', '/groups?pagination[limit]=10'); const group_id = ((groups.data || [])[0] || {}).id; if (!group_id) throw new Error('нет group в Channex');
  const existing = (await C.cx('GET', '/channels?pagination[limit]=100')).data || [];
  const dup = existing.find(c => c.attributes && c.attributes.channel === 'BookingCom' && String((c.attributes.settings || {}).hotel_id) === hotel_id);
  let ch;
  if (dup) { ch = await C.cx('PUT', '/channels/' + dup.id, { channel: { title: body.title || dup.attributes.title, properties: [prop.external_id], settings, rate_plans } }); log.unshift('updated existing channel ' + dup.id); }
  else ch = await C.cx('POST', '/channels', { channel: { channel: 'BookingCom', group_id, title: body.title || ('Booking ' + hotel_id), properties: [prop.external_id], settings: Object.assign({}, settings, { send_email_notifications: false }), rate_plans } });
  const id = ch.data.id; let activated = null, loaded = null;
  if (body.activate !== false) {
    try { await C.cx('POST', '/channels/' + id + '/activate'); activated = true; } catch (e) { activated = String(e.message).slice(0, 200); }
    try { loaded = (await C.cx('POST', '/channels/' + id + '/execute/load_future_reservations')).data || true; } catch (e) { loaded = String(e.message).slice(0, 200); }
  }
  return { channel_id: id, property: prop.complex, pricing, mappings: rate_plans.length, activated, loaded, log };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: H, body: '' };
  try {
    const user = await auth(event); if (!user) return out(401, { error: 'unauthorized' });
    if (user.role !== 'admin') return out(403, { error: 'только admin' });
    const p = event.queryStringParameters || {};
    if (event.httpMethod === 'GET') { if (p.a === 'status') return out(200, await status(user)); return out(400, { error: 'unknown action' }); }
    const body = JSON.parse(event.body || '{}');
    switch (body.a) {
      case 'setup_complex': return out(200, await setupComplex(body, user));
      case 'setup_webhook': return out(200, await setupWebhook());
      case 'go_production': return out(200, await goProduction(body, user));
      case 'booking_probe': return out(200, await bookingProbe(body));
      case 'booking_connect': return out(200, await bookingConnect(body, user));
      case 'reconcile_derived': { const props = await C.q('channel_properties?select=*&external_id=not.is.null&org_id=eq.' + user.org_id); const r = []; for (const p of props) r.push(Object.assign({ property: p.name }, await C.reconcileDerived(p.external_id))); return out(200, r); }
      case 'push_full': {
        // full sync: вся сеть / одна квартира / один ЖК (complex → все квартиры ЖК; Channex: 1 property = 2 запроса)
        let q = 0;
        if (body.complex) { const apts = await C.q('apartments?select=id&is_active=eq.true&complex=eq.' + enc(body.complex)); for (const a of apts) q += (await C.rpc('pms_outbox_full', { p_apt: a.id })) || 0; }
        else q = await C.rpc('pms_outbox_full', { p_apt: body.apt || null });
        const r = await C.processOutbox(); return out(200, { queued: q, pushed: r });
      }
      case 'feed': return out(200, await C.ingestFeed());
      // Маппинг Airbnb через API: phase='unmap' снимает маппинги листингов со Standard; phase='map' (через ~40 с) ставит на производный тариф «Airbnb»
      case 'airbnb_remap': {
        const chId = body.channel_id; if (!chId) return out(400, { error: 'channel_id' });
        const ch = await C.cx('GET', '/channels/' + chId); const attrs = ch.data.attributes || {};
        const maps = attrs.rate_plans || attrs.mappings || [];
        const units = await C.q('channel_units?select=*&is_active=eq.true');
        const byStd = {}, byDer = {}; units.forEach(u => { byStd[u.external_rate_plan_id] = u; const d = (u.derived || {}).airbnb; if (d) byDer[d.rate_plan_id] = u; });
        const log = [];
        if (body.phase === 'unmap') {
          for (const m of maps) { if (byStd[m.rate_plan_id]) { try { await C.cx('DELETE', '/channels/' + chId + '/mappings/' + m.id); log.push('unmapped ' + byStd[m.rate_plan_id].apartment_id + ' listing ' + (m.settings || {}).listing_id); } catch (e) { log.push('ERR ' + String(e.message).slice(0, 120)); } } }
          return out(200, { phase: 'unmap', log, total: maps.length });
        }
        if (body.phase === 'map') {
          const have = new Set(maps.map(m => String((m.settings || {}).listing_id)));
          const list = await C.cx('GET', '/channels/' + chId + '/action/listings');
          const listings = (((list.data || {}).listing_id_dictionary || {}).values) || [];
          const apts = await C.q('apartments?select=id,name,catalog_no');
          for (const l of listings) {
            if (have.has(String(l.id))) { log.push('skip (mapped) ' + l.title); continue; }
            const want = body.pairs && body.pairs[String(l.id)];
            const u = want ? units.find(x => x.apartment_id === want) : null;
            if (!u) { log.push('no pair for ' + l.title + ' (' + l.id + ')'); continue; }
            const d = (u.derived || {}).airbnb; if (!d) { log.push('no derived plan ' + u.apartment_id); continue; }
            try { await C.cx('POST', '/channels/' + chId + '/mappings', { mapping: { rate_plan_id: d.rate_plan_id, settings: { listing_id: String(l.id) } } }); log.push('mapped ' + l.title + ' → ' + u.apartment_id + ' / Airbnb'); } catch (e) { log.push('ERR ' + l.title + ': ' + String(e.message).slice(0, 160)); }
          }
          return out(200, { phase: 'map', log });
        }
        return out(200, { mappings: maps.map(m => ({ id: m.id, rate_plan_id: m.rate_plan_id, apt: (byStd[m.rate_plan_id] || byDer[m.rate_plan_id] || {}).apartment_id, plan: byStd[m.rate_plan_id] ? 'Standard' : byDer[m.rate_plan_id] ? 'Airbnb' : '?', listing_id: (m.settings || {}).listing_id })) });
      }
      case 'markup_set': {
        const ch = String(body.channel || ''); const pct = Math.max(0, Math.min(100, Number(body.pct) || 0));
        if (!C.OTA_PLANS[ch]) return out(400, { error: 'channel' });
        await C.q('channel_markups?on_conflict=org_id,channel', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' }, body: JSON.stringify({ org_id: user.org_id, channel: ch, pct, updated_at: new Date().toISOString(), updated_by: user.name }) });
        const r = await C.applyMarkup(user.org_id, ch, pct);
        return out(200, Object.assign({ channel: ch, pct }, r));
      }
      case 'unit_update': { const o = {}; for (const f of ['markup_pct', 'push_rates', 'push_availability', 'is_active']) if (body[f] !== undefined) o[f] = body[f] === '' ? null : body[f]; o.updated_at = new Date().toISOString(); await C.q('channel_units?apartment_id=eq.' + enc(body.apartment_id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(o) }); if (o.markup_pct !== undefined || o.is_active) await C.rpc('pms_outbox_full', { p_apt: body.apartment_id }); return out(200, { ok: true }); }
      case 'resolve_conflict': {
        const c = (await C.q('channel_conflicts?select=*&id=eq.' + enc(body.id)))[0]; if (!c) return out(404, { error: 'not found' });
        let r = null;
        if (body.resolution === 'accept') { r = await C.rpc('pms_channel_booking_upsert', { p_cb: c.channel_booking_id }); if (r && r.conflict) return out(409, { error: 'Даты всё ещё заняты', r }); }
        await C.q('channel_conflicts?id=eq.' + c.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ resolved: true, resolution: body.resolution || 'manual', resolved_by: user.name, resolved_at: new Date().toISOString() }) });
        return out(200, { ok: true, r });
      }
      case 'ical_add': { if (!body.apartment_id || !body.channel || !/^https?:\/\//.test(body.url || '')) return out(400, { error: 'apartment_id, channel, url' }); const rows = await C.q('ical_sources?on_conflict=apartment_id,channel', { method: 'POST', headers: { Prefer: 'return=representation,resolution=merge-duplicates' }, body: JSON.stringify({ apartment_id: body.apartment_id, channel: body.channel, url: body.url, is_active: true }) }); return out(200, rows[0]); }
      case 'ical_delete': await C.q('ical_sources?id=eq.' + enc(body.id), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); return out(200, { ok: true });
      case 'ical_pull': return out(200, await require('./ical-pull.js').pullAll());
      default: return out(400, { error: 'unknown action' });
    }
  } catch (e) { return out(e.status && e.status < 500 ? e.status : 400, { error: String(e.message || e).slice(0, 600) }); }
};
