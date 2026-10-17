// channex-admin.js — управление хабом каналов из /pms (раздел «Каналы»). Только admin (app_users.role).
// GET  ?a=status                       → properties, units, очередь, конфликты, последние брони, iCal-источники, связь с Channex
// POST {a:'setup_complex', complex, title?}   → создать в Channex property + room type/rate plan на каждую квартиру ЖК → channel_units
// POST {a:'setup_webhook'}             → global webhook Channex → /.netlify/functions/channex-webhook
// POST {a:'push_full', apt?}           → полная отправка цен/занятости (очередь + отправка сейчас)
// POST {a:'feed'}                      → забрать неподтверждённые брони из Channex
// POST {a:'unit_update', apartment_id, markup_pct?, push_rates?, push_availability?, is_active?}
// POST {a:'resolve_conflict', id, resolution:'moved'|'cancelled_on_ota'|'accept'} → accept = повторить запись брони (даты освободили)
// POST {a:'ical_add', apartment_id, channel, url} | {a:'ical_delete', id} | {a:'ical_pull'}
// 16.10.2026 (PMS v2-A, менеджер каналов v2):
// POST {a:'setup_unit', apartment_id}                         → комната/тарифы одной новой квартиры в property её ЖК + ARI
// POST {a:'channel_toggle', apartment_id, channel, enabled}   → снять/вернуть маппинг квартиры на площадке (channels[ch].enabled/saved)
// POST {a:'unit_markup', apartment_id, channel, pct|null}     → наценка квартиры на площадке (null = общая)
// POST {a:'restriction_save', id?, apartment_id, channel, date_from, date_to, stop_sell, min_nights, note} | {a:'restriction_delete', id}
// POST {a:'unit_log', apartment_id}                           → очередь/брони/правила квартиры
// POST {a:'channel_account_set', channel_id, org_id}        → канал Channex принадлежит аккаунту организации (партнёрские квартиры)
// POST {a:'mapping_scan', channel?}                          → channels[ch].mapped по факту маппингов в Channex (одна площадка за вызов, next = следующая)
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
  // B (16.10): организация = кабинет; платформа-админ (admin org 1) может смотреть другую через ?org= / x-org
  const qp = event.queryStringParameters || {}; const want = Number(qp.org || h['x-org'] || h['X-Org'] || 0) || 0;
  const home = rows[0].org_id || 1; const platform = rows[0].role === 'admin' && home === 1;
  const orgId = platform && want ? want : home;
  const org = (await C.q('organizations?select=id,name,short,slug,settings,tg_chat_id&id=eq.' + orgId))[0] || { id: orgId, name: 'Urban Luxe', short: 'UL', settings: {} };
  return { email: rows[0].email, role: rows[0].role, name: rows[0].name || rows[0].email, org_id: orgId, org, platform_admin: platform, channex_key: ((org.settings || {}).channex || {}).api_key || null };
}
// группа Channex организации (клиенты без своего ключа живут в нашем аккаунте, каждый в своей Group)
async function orgGroupId(user) {
  const cx = ((user.org.settings || {}).channex) || {};
  if (cx.group_id) return cx.group_id;
  if (user.channex_key) return ((await C.cx('GET', '/groups?pagination[limit]=10')).data || [])[0]?.id || null;   // свой аккаунт клиента — его первая группа
  // 16.10 (вечер): клиенты без своего ключа — в нашей основной группе (одна Airbnb-учётка = одно подключение, а общие с нами
  // квартиры уже лежат в нашей группе; отдельные группы мешали бы подключить их Airbnb к общим и своим квартирам сразу)
  return ((await C.cx('GET', '/groups?pagination[limit]=10')).data || [])[0]?.id || null;
}

async function status(user) {
  const org = '&org_id=eq.' + user.org_id;
  // 16.10 (вечер): кабинет партнёра видит свои квартиры + общие (apartment_access mode=full), и ничего чужого
  const accessIds = user.org_id === 1 ? null : (await C.rpc('pms_org_apartments', { p_org: user.org_id })).filter(x => x.mode === 'full').map(x => x.apartment_id);
  const aptQ = accessIds ? ('&id=in.(' + (accessIds.length ? accessIds : ['-']).map(enc).join(',') + ')') : org;
  const [props0, units, apts, pending0, conflicts0, recent, icals, failed0] = await Promise.all([
    C.q('channel_properties?select=*&order=id'),
    C.q('channel_units?select=*&order=apartment_id'),
    C.q('apartments?select=id,name,complex,floor,max_guests,catalog_no,is_active,org_id' + aptQ + '&order=complex,catalog_no'),
    C.q('channel_outbox?select=apartment_id&sent_at=is.null&limit=2000'),
    C.q('channel_conflicts?select=*&resolved=eq.false&order=created_at.desc'),
    C.q('channel_bookings?select=id,unique_id,ota_name,status,received_at,processed_at,acked_at,error,conflict,booking_id&order=received_at.desc&limit=30'),
    C.q('ical_sources?select=*&order=apartment_id'),
    C.q('channel_outbox?select=apartment_id,error,attempts,created_at&sent_at=is.null&attempts=gte.1&order=created_at.desc&limit=20')
  ]);
  apts.forEach(a => { a.shared = (a.org_id || 1) !== user.org_id; });
  const myCx = new Set(apts.map(a => a.complex));
  // свои карточки Channex + чужие (владельца общих квартир) — помечены foreign: по ним нельзя создавать/пересоздавать
  const props = props0.filter(p => p.org_id === user.org_id || myCx.has(p.complex)).map(p => Object.assign(p, { foreign: p.org_id !== user.org_id }));
  const mineSet = new Set(apts.map(a => a.id));
  const pending = pending0.filter(o => mineSet.has(o.apartment_id)); const conflicts = conflicts0.filter(c => mineSet.has(c.apartment_id)); const failed = failed0.filter(f => mineSet.has(f.apartment_id));
  let channex = null, channels = [];
  if (process.env.CHANNEX_API_KEY) {
    try { const j = await C.cx('GET', '/properties?pagination[limit]=50'); channex = { ok: true, base: C.BASE, properties: (j.data || []).map(p => ({ id: p.id, title: p.attributes && p.attributes.title, channels: p.attributes && p.attributes.acc_channels_count })) }; } catch (e) { channex = { ok: false, base: C.BASE, error: String(e.message).slice(0, 200) }; }
    try { const j = await C.cx('GET', '/channels?pagination[limit]=100'); channels = (j.data || []).map(c => { const a = c.attributes || {}; const props = a.properties || ((c.relationships && c.relationships.properties && c.relationships.properties.data) || []).map(x => x.id); return { id: c.id, title: a.title, channel: a.channel, is_active: a.is_active, properties: props }; }); } catch (e) { channels = []; }
  }
  else channex = { ok: false, error: 'CHANNEX_API_KEY не задан' };
  const mine = new Set(apts.map(a => a.id));
  const myProps = new Set(props.map(p => p.external_id).filter(Boolean)); channels = channels.filter(c => (c.properties || []).some(x => myProps.has(x)));
  if (channex && channex.properties) channex.properties = channex.properties.filter(p => myProps.has(p.id));
  const restrictions = (await C.q('channel_restrictions?select=*&date_to=gte.' + C.today() + '&order=date_from')).filter(r => mine.has(r.apartment_id));
  // 16.10: партнёрские квартиры и принадлежность каналов аккаунтам организаций (Airbnb HighLife — отдельный канал в нашем Channex)
  const [access, accounts, orgs] = await Promise.all([C.q('apartment_access?select=apartment_id,org_id,mode'), C.q('channel_accounts?select=*'), C.q('organizations?select=id,name,short&is_active=eq.true&order=id')]);
  const accByCh = {}; accounts.forEach(a => accByCh[a.channel_id] = a.org_id);
  channels.forEach(c => c.org_id = accByCh[c.id] || 1);
  const markups = {}; (await C.q('channel_markups?select=*&org_id=eq.' + user.org_id)).forEach(m => markups[m.channel] = Number(m.pct));
  return { platform_admin: !!user.platform_admin, org_id: user.org_id, channex, channels, markups, ota_plans: C.OTA_PLANS, channel_codes: C.CHANNEL_CODES, restrictions, access: access.filter(x => mine.has(x.apartment_id)), accounts, orgs, properties: props, units: units.filter(u => mine.has(u.apartment_id)), apartments: apts, pending: pending.length, failed, conflicts, recent: user.org_id === 1 ? recent : [], icals: icals.filter(i => mineSet.has(i.apartment_id)), webhook_url: (process.env.URL || 'https://urbanluxe.cc') + '/.netlify/functions/channex-webhook', ical_base: (process.env.URL || 'https://urbanluxe.cc') + '/.netlify/functions/calendar?apt=' };
}

// Комната + тариф Standard одной квартиры в property ЖК → channel_units. Возвращает строку лога.
async function ensureUnit(a, prop, u) {
  if (u && u.external_room_type_id && u.external_rate_plan_id) return a.id + ': already';
  const occ = Math.max(1, Math.min(10, a.max_guests || 2));
  let rt = u && u.external_room_type_id;
  if (!rt) { const r = await C.cx('POST', '/room_types', { room_type: { property_id: prop.external_id, title: a.name, count_of_rooms: 1, occ_adults: occ, occ_children: 0, occ_infants: 1, default_occupancy: occ, room_kind: 'room', codes: { apartment_id: a.id }, content: { description: (a.description_en || a.description || '').slice(0, 2000) || null } } }); rt = r.data.id; }
  let rp = u && u.external_rate_plan_id;
  if (!rp) { const r = await C.cx('POST', '/rate_plans', { rate_plan: { property_id: prop.external_id, room_type_id: rt, title: 'Standard', sell_mode: 'per_room', rate_mode: 'manual', currency: 'USD', meal_type: 'none', options: [{ occupancy: occ, is_primary: true, rate: String(a.weekday_price || 100) + '.00' }], min_stay_arrival: 1, meta: { apartment_id: a.id } } }); rp = r.data.id; }
  await C.q('channel_units?on_conflict=apartment_id', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' }, body: JSON.stringify({ apartment_id: a.id, channel_property_id: prop.id, external_room_type_id: rt, external_rate_plan_id: rp, is_active: true, updated_at: new Date().toISOString() }) });
  return a.id + ': room ' + rt.slice(0, 8) + ' rate ' + rp.slice(0, 8);
}

// 16.10.2026: одна квартира (новая в /pms → Объекты) в уже подключённом ЖК: комната + Standard + производные тарифы площадок + отправка ARI
async function setupUnit(body, user) {
  const id = String(body.apartment_id || ''); if (!id) throw new Error('apartment_id');
  const a = (await C.q('apartments?select=id,name,complex,floor,max_guests,weekday_price,description_en,description,is_active&id=eq.' + enc(id) + '&org_id=eq.' + user.org_id))[0];
  if (!a) throw new Error('квартира не найдена'); if (!a.is_active) throw new Error('квартира в архиве');
  const prop = (await C.q('channel_properties?select=*&complex=eq.' + enc(a.complex) + '&org_id=eq.' + user.org_id))[0];
  if (!prop || !prop.external_id) throw new Error('ЖК «' + a.complex + '» не подключён к Channex — сначала «Подключить ЖК»');
  const u = (await C.q('channel_units?select=*&apartment_id=eq.' + enc(id)))[0];
  const log = [await ensureUnit(a, prop, u)];
  const mk = {}; (await C.q('channel_markups?select=*&org_id=eq.' + user.org_id)).forEach(m => mk[m.channel] = Number(m.pct));
  const unit = (await C.q('channel_units?select=*&apartment_id=eq.' + enc(id)))[0];
  for (const ch of Object.keys(C.OTA_PLANS)) { try { await C.ensureDerived(unit, prop, ch, mk[ch] || 0); } catch (e) { log.push(ch + ': ' + String(e.message).slice(0, 100)); } }
  const queued = Number(await C.rpc('pms_outbox_full', { p_apt: id })) || 0;
  const pushed = await C.processOutbox();
  return { apartment_id: id, property: prop.complex, log, queued, pushed };
}

// Каналы Channex площадки `ch`, привязанные к property квартиры (с маппингами rate_plans)
async function channelsFor(ch, prop) {
  const code = C.CHANNEL_CODES[ch]; if (!code) throw new Error('площадка ' + ch + ' не через Channex');
  const list = (await C.cx('GET', '/channels?pagination[limit]=100')).data || [];
  const mine = list.filter(c => { const a = c.attributes || {}; const props = a.properties || ((c.relationships && c.relationships.properties && c.relationships.properties.data) || []).map(x => x.id); return a.channel === code && props.includes(prop.external_id); });
  const out = [];
  for (const c of mine) { const d = (await C.cx('GET', '/channels/' + c.id)).data; const a = d.attributes || {}; out.push({ id: d.id, title: a.title, code, settings: a.settings || {}, properties: a.properties || [prop.external_id], is_active: a.is_active, maps: a.rate_plans || a.mappings || [] }); }
  return out;
}
const saveChannels = (unit, patch) => C.q('channel_units?apartment_id=eq.' + enc(unit.apartment_id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ channels: Object.assign({}, unit.channels || {}, patch), updated_at: new Date().toISOString() }) });
async function unitAndProp(apartment_id, user) {
  const unit = (await C.q('channel_units?select=*&apartment_id=eq.' + enc(apartment_id)))[0]; if (!unit) throw new Error('квартира не подключена к Channex');
  const prop = (await C.q('channel_properties?select=*&id=eq.' + unit.channel_property_id))[0]; if (!prop || !prop.external_id || (prop.org_id || 1) !== user.org_id) throw new Error('property не найдена');
  return { unit, prop };
}

// Вкл/выкл площадки для квартиры. Выкл = снять маппинг производного тарифа в Channex (Airbnb — DELETE mapping;
// Booking/Ostrovok/Agoda/Expedia — PUT канала без этой квартиры), снятое запомнить в channels[ch].saved. Вкл = вернуть из saved.
async function channelToggle(body, user) {
  const ch = String(body.channel || ''); const { unit, prop } = await unitAndProp(body.apartment_id, user);
  const d = (unit.derived || {})[ch]; if (!d || !d.rate_plan_id) throw new Error('нет производного тарифа ' + ch + ' — «Полная отправка ЖК» / reconcile');
  const cur = (unit.channels || {})[ch] || {}; const log = [];
  if (body.enabled === false) {
    const chans = await channelsFor(ch, prop); const saved = [];
    for (const c of chans) {
      const mine = c.maps.filter(m => m.rate_plan_id === d.rate_plan_id); if (!mine.length) continue;
      if (ch === 'airbnb') { for (const m of mine) { await C.cx('DELETE', '/channels/' + c.id + '/mappings/' + m.id); log.push('unmapped ' + c.title + ' listing ' + (m.settings || {}).listing_id); } }
      else { const rest = c.maps.filter(m => m.rate_plan_id !== d.rate_plan_id).map(m => ({ rate_plan_id: m.rate_plan_id, settings: m.settings })); await C.cx('PUT', '/channels/' + c.id, { channel: { rate_plans: rest } }); log.push('unmapped ' + c.title + ' (' + mine.length + ' mappings)'); }
      saved.push({ channel_id: c.id, title: c.title, mappings: mine.map(m => ({ rate_plan_id: m.rate_plan_id, settings: m.settings })) });
    }
    if (!saved.length && !cur.saved) throw new Error('квартира не замаплена на ' + C.OTA_PLANS[ch] + ' — нечего выключать');
    await saveChannels(unit, { [ch]: Object.assign({}, cur, { enabled: false, saved: saved.length ? saved : cur.saved, mapped: null, toggled_at: new Date().toISOString(), toggled_by: user.name }) });
    return { ok: true, enabled: false, log };
  }
  // включить
  if (!cur.saved || !cur.saved.length) { await saveChannels(unit, { [ch]: Object.assign({}, cur, { enabled: true }) }); return { ok: true, enabled: true, need_manual: true, log: ['маппинга нет — замапить в Channex: ' + C.BASE + '/channels'] }; }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (const sv of cur.saved) {
    const c = (await C.cx('GET', '/channels/' + sv.channel_id)).data; const a = c.attributes || {}; const maps = a.rate_plans || a.mappings || [];
    if (ch === 'airbnb') {
      // Channex снимает маппинг Airbnb асинхронно: POST сразу после DELETE «проходит», но маппинг не появляется — проверяем и повторяем
      for (const m of sv.mappings) {
        let ok = false;
        for (let i = 0; i < 3 && !ok; i++) {
          if (i) await sleep(7000);
          await C.cx('POST', '/channels/' + sv.channel_id + '/mappings', { mapping: { rate_plan_id: m.rate_plan_id, settings: m.settings } });
          await sleep(1500);
          const c2 = (await C.cx('GET', '/channels/' + sv.channel_id)).data; const a2 = c2.attributes || {}; ok = (a2.rate_plans || a2.mappings || []).some(x => x.rate_plan_id === m.rate_plan_id);
        }
        if (!ok) throw new Error('Channex не принял маппинг листинга ' + (m.settings || {}).listing_id + ' — попробуйте «Включить» ещё раз через минуту');
        log.push('mapped ' + sv.title + ' listing ' + (m.settings || {}).listing_id);
      }
    }
    else { const all = maps.map(m => ({ rate_plan_id: m.rate_plan_id, settings: m.settings })).concat(sv.mappings); await C.cx('PUT', '/channels/' + sv.channel_id, { channel: { rate_plans: all } }); log.push('mapped ' + sv.title + ' (' + sv.mappings.length + ')'); }
  }
  await saveChannels(unit, { [ch]: Object.assign({}, cur, { enabled: true, saved: null, mapped: { channel_ids: cur.saved.map(x => x.channel_id), n: cur.saved.reduce((s, x) => s + x.mappings.length, 0), checked_at: new Date().toISOString() }, toggled_at: new Date().toISOString(), toggled_by: user.name }) });
  await C.rpc('pms_outbox_full', { p_apt: unit.apartment_id }); await C.processOutbox();
  return { ok: true, enabled: true, log };
}

// Наценка квартиры на площадке (null = общая из channel_markups)
async function unitMarkup(body, user) {
  const ch = String(body.channel || ''); if (!C.OTA_PLANS[ch]) throw new Error('channel');
  const { unit, prop } = await unitAndProp(body.apartment_id, user);
  const pct = body.pct === null || body.pct === '' || body.pct === undefined ? null : Math.max(0, Math.min(100, Number(body.pct) || 0));
  const g = (await C.q('channel_markups?select=pct&org_id=eq.' + user.org_id + '&channel=eq.' + ch))[0]; const eff = pct != null ? pct : Number(g ? g.pct : 0);
  await C.ensureDerived(unit, prop, ch, eff);
  await saveChannels(unit, { [ch]: Object.assign({}, (unit.channels || {})[ch] || {}, { markup_pct: pct }) });
  return { ok: true, channel: ch, markup_pct: pct, effective_pct: eff };
}

// Закрытие дат / мин. ночи по площадке → channel_restrictions → очередь kind=restriction (_channex.unitValues шлёт производному тарифу)
async function ownRestrictions(unit, prop, ch, user) {
  const cur = (unit.channels || {})[ch] || {}; if (cur.own_restrictions) return false;
  const d = (unit.derived || {})[ch]; if (!d || !d.rate_plan_id) throw new Error('нет производного тарифа ' + ch);
  await C.cx('PUT', '/rate_plans/' + d.rate_plan_id, { rate_plan: { inherit_stop_sell: false, inherit_min_stay_arrival: false } });
  await saveChannels(unit, { [ch]: Object.assign({}, cur, { own_restrictions: true }) }); unit.channels = Object.assign({}, unit.channels || {}, { [ch]: Object.assign({}, cur, { own_restrictions: true }) });
  await C.rpc('pms_outbox_full', { p_apt: unit.apartment_id });   // первый раз — весь горизонт, чтобы производный тариф получил свои значения
  return true;
}
async function restrictionSave(body, user) {
  const ch = String(body.channel || ''); if (!C.OTA_PLANS[ch]) throw new Error('channel');
  if (!body.date_from || !body.date_to || body.date_to < body.date_from) throw new Error('даты');
  const { unit, prop } = await unitAndProp(body.apartment_id, user);
  const rec = { apartment_id: unit.apartment_id, channel: ch, date_from: body.date_from, date_to: body.date_to, stop_sell: !!body.stop_sell, min_nights: body.min_nights ? Math.max(1, Number(body.min_nights)) : null, note: body.note || null, created_by: user.name };
  if (!rec.stop_sell && !rec.min_nights) throw new Error('укажите закрытие или мин. ночи');
  let row;
  if (body.id) { const old = (await C.q('channel_restrictions?select=*&id=eq.' + enc(body.id)))[0]; if (!old) throw new Error('правило не найдено'); row = (await C.q('channel_restrictions?id=eq.' + old.id, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(rec) }))[0]; await C.rpc('pms_restriction_enqueue', { p_apt: old.apartment_id, p_channel: old.channel, p_from: old.date_from, p_to: old.date_to, p_rule: old.id }); }
  else row = (await C.q('channel_restrictions', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(rec) }))[0];
  const first = await ownRestrictions(unit, prop, ch, user);
  await C.rpc('pms_restriction_enqueue', { p_apt: row.apartment_id, p_channel: ch, p_from: row.date_from, p_to: row.date_to, p_rule: row.id });
  const pushed = await C.processOutbox();
  return { ok: true, rule: row, first, pushed };
}
async function restrictionDelete(body, user) {
  const old = (await C.q('channel_restrictions?select=*&id=eq.' + enc(body.id)))[0]; if (!old) throw new Error('правило не найдено');
  await unitAndProp(old.apartment_id, user);
  await C.q('channel_restrictions?id=eq.' + old.id, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  await C.rpc('pms_restriction_enqueue', { p_apt: old.apartment_id, p_channel: old.channel, p_from: old.date_from, p_to: old.date_to, p_rule: 0 });
  const pushed = await C.processOutbox();
  return { ok: true, pushed };
}

// Лог квартиры: очередь (50), брони с площадок (20), правила по площадкам
async function unitLog(body, user) {
  const id = String(body.apartment_id || ''); const { unit } = await unitAndProp(id, user);
  const [outbox, bookings, rules] = await Promise.all([
    C.q('channel_outbox?select=id,kind,fields,date_from,date_to,created_at,sent_at,attempts,error,task_ids&apartment_id=eq.' + enc(id) + '&order=created_at.desc&limit=50'),
    C.q('channel_bookings?select=id,unique_id,ota_name,ota_reservation_code,status,received_at,processed_at,acked_at,error,conflict,booking_id,payload&payload->rooms->0->>room_type_id=eq.' + enc(unit.external_room_type_id || '-') + '&order=received_at.desc&limit=20'),
    C.q('channel_restrictions?select=*&apartment_id=eq.' + enc(id) + '&order=date_from')
  ]);
  return { unit, outbox, bookings: bookings.map(b => { const p = b.payload || {}; const r = (p.rooms || [])[0] || {}; const c = p.customer || {}; return { id: b.id, ota: b.ota_name, code: b.ota_reservation_code, status: b.status, received_at: b.received_at, error: b.error, conflict: b.conflict, booking_id: b.booking_id, check_in: r.checkin_date, check_out: r.checkout_date, guest: [c.name, c.surname].filter(Boolean).join(' '), amount: p.amount, currency: p.currency }; }), rules };
}

// Скан маппингов: какие квартиры реально привязаны к каналам площадки (channels[ch].mapped). Один вызов = одна площадка
// ({channel:'airbnb'|'booking'|...}; без channel — первая, в ответе next = следующая). UI и booking-pull (раз в час) идут по всем.
async function mappingScan(body) {
  const codes = Object.keys(C.CHANNEL_CODES); const ch = body.channel || codes[0]; const code = C.CHANNEL_CODES[ch]; if (!code) throw new Error('channel');
  const list = ((await C.cx('GET', '/channels?pagination[limit]=100')).data || []).filter(c => (c.attributes || {}).channel === code);
  const units = await C.q('channel_units?select=*');
  const byPlan = {}; units.forEach(u => { const d = (u.derived || {})[ch]; if (d && d.rate_plan_id) byPlan[d.rate_plan_id] = u; });
  const accByCh = {}; (await C.q('channel_accounts?select=channel_id,org_id')).forEach(a => accByCh[a.channel_id] = a.org_id);
  const found = {}; let details = 0;
  for (const c of list) {
    const a0 = c.attributes || {};
    let maps = a0.rate_plans || a0.mappings; if (!maps) { details++; const d = (await C.cx('GET', '/channels/' + c.id)).data; const a = d.attributes || {}; maps = a.rate_plans || a.mappings || []; }
    for (const m of maps) { const u = byPlan[m.rate_plan_id]; if (!u) continue; const g = (found[u.apartment_id] = found[u.apartment_id] || { channel_ids: [], org_ids: [], n: 0, active: !!a0.is_active }); if (!g.channel_ids.includes(c.id)) { g.channel_ids.push(c.id); g.org_ids.push(accByCh[c.id] || 1); } g.n++; }
  }
  const now = new Date().toISOString(); let updated = 0;
  for (const u of units) {
    const prev = (u.channels || {})[ch] || {}; const m = found[u.apartment_id] || null;
    const next = Object.assign({}, prev, { mapped: m ? Object.assign(m, { checked_at: now }) : null, checked_at: now });
    if (JSON.stringify(Object.assign({}, prev, { checked_at: 0, mapped: prev.mapped && Object.assign({}, prev.mapped, { checked_at: 0 }) })) === JSON.stringify(Object.assign({}, next, { checked_at: 0, mapped: next.mapped && Object.assign({}, next.mapped, { checked_at: 0 }) }))) continue;
    await C.q('channel_units?apartment_id=eq.' + enc(u.apartment_id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ channels: Object.assign({}, u.channels || {}, { [ch]: next }) }) }); updated++;
  }
  const idx = codes.indexOf(ch);
  return { channel: ch, channels: list.length, details, mapped: Object.keys(found).length, updated, next: idx + 1 < codes.length ? codes[idx + 1] : null };
}

async function setupComplex(body, user) {
  const complex = body.complex; if (!complex) throw new Error('complex');
  const apts = await C.q('apartments?select=id,name,complex,floor,max_guests,weekday_price,description_en,description&complex=eq.' + enc(complex) + '&org_id=eq.' + user.org_id + '&is_active=eq.true&order=catalog_no,name');
  if (!apts.length) throw new Error('В ЖК нет активных квартир');
  let prop = (await C.q('channel_properties?select=*&complex=eq.' + enc(complex) + '&org_id=eq.' + user.org_id))[0];
  const log = [];
  if (!prop || !prop.external_id) {
    const title = body.title || ((user.org_id === 1 ? 'Urban Luxe' : (user.org.name || 'PMS')) + ' ' + complex);
    const gid = await orgGroupId(user);
    // 17.10: адрес/город — из карточки ЖК организации (раздел «Объекты»), у наших ЖК запасной список COMPLEX_ADDR
    const cxRow = (await C.q('complexes?select=address,city,timezone&name=eq.' + enc(complex) + '&org_id=eq.' + user.org_id).catch(() => []))[0] || {};
    const j = await C.cx('POST', '/properties', { property: { group_id: gid || undefined, title, currency: 'USD', email: process.env.CHANNEX_CONTACT_EMAIL || 'booking@urbanluxe.cc', phone: '+998936900044', country: 'UZ', city: cxRow.city || 'Tashkent', address: cxRow.address || COMPLEX_ADDR[complex] || 'Tashkent', zip_code: '100000', timezone: cxRow.timezone || 'Asia/Tashkent', property_type: 'apartment', website: 'https://urbanluxe.cc', settings: { min_stay_type: 'arrival', state_length: 500, allow_availability_autoupdate_on_modification: false, allow_availability_autoupdate_on_cancellation: false } } });
    const ext = j.data.id;
    if (prop) { await C.q('channel_properties?id=eq.' + prop.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ external_id: ext, name: title, updated_at: new Date().toISOString() }) }); prop.external_id = ext; }
    else prop = (await C.q('channel_properties', { method: 'POST', body: JSON.stringify({ provider: 'channex', external_id: ext, name: title, complex, currency: 'USD', org_id: user.org_id }) }))[0];
    log.push('property created ' + ext);
  }
  const existing = {}; (await C.q('channel_units?select=*&channel_property_id=eq.' + prop.id)).forEach(u => existing[u.apartment_id] = u);
  for (const a of apts) log.push(await ensureUnit(a, prop, existing[a.id]));
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

// 16.10.2026 (вечер): Airbnb по API Channex без входа в Channex — https://docs.channex.io/channel-api-examples/airbnb
// 1) airbnb_link {complexes:[...]} → ссылка авторизации (2 часа), владелец аккаунта Airbnb открывает её, Channex создаёт неактивный канал
//    и возвращает в /pms?airbnb=1&channel_id=…; 2) airbnb_listings {channel_id} → объявления аккаунта; 3) airbnb_map {channel_id, listing_id,
//    apartment_id} по одному (Channex отвечает ~30 с) на производный тариф «Airbnb»; 4) airbnb_activate → активация + загрузка броней.
const SITE_URL = process.env.URL || 'https://urbanluxe.cc';
async function assertChannelOrg(channelId, user) {
  if (!channelId) throw new Error('channel_id');
  if (user.org_id === 1) return;
  const acc = (await C.q('channel_accounts?select=org_id&channel_id=eq.' + enc(channelId)))[0];
  if (!acc || acc.org_id !== user.org_id) throw new Error('Канал не принадлежит вашей организации');
}
async function airbnbLink(body, user) {
  const names = Array.isArray(body.complexes) ? body.complexes.filter(Boolean) : [];
  if (!names.length) throw new Error('Выберите хотя бы один ЖК');
  const st = await status(user);
  const props = st.properties.filter(p => names.includes(p.complex) && p.external_id);
  const missing = names.filter(n => !props.some(p => p.complex === n));
  if (missing.length) throw new Error('ЖК ещё не подключены к Channex: ' + missing.join(', ') + ' — сначала «+ подключить ЖК»');
  const group_id = await orgGroupId(user); if (!group_id) throw new Error('нет group в Channex');
  const token = user.org_id + ':' + Date.now().toString(36);
  const r = await C.cx('POST', '/meta/airbnb/connection_link', { connection_link: {
    group_id, properties: props.map(p => p.external_id),
    redirect_uri: SITE_URL + '/pms?airbnb=1&org=' + user.org_id, failure_redirect_uri: SITE_URL + '/pms?airbnb=0&org=' + user.org_id, token,
    title: 'Airbnb ' + (user.org.short || user.org.name), settings: { min_stay_type: 'Arrival', send_email_notifications: false } } });
  await C.q('app_settings?on_conflict=key', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' }, body: JSON.stringify({ key: 'airbnb_link_' + user.org_id, value: JSON.stringify({ token, complexes: names, at: new Date().toISOString() }), note: 'ожидание OAuth Airbnb', updated_at: new Date().toISOString() }) });
  return { url: (r.data && r.data.attributes && r.data.attributes.url) || (r.data && r.data.url), complexes: names, properties: props.length };
}
async function airbnbListings(body, user) {
  const id = String(body.channel_id || ''); if (!id) throw new Error('channel_id');
  // первый заход после OAuth: канал ещё ничей — закрепляем за организацией (кроме платформы)
  const acc = (await C.q('channel_accounts?select=org_id&channel_id=eq.' + enc(id)))[0];
  if (!acc) { if (user.org_id !== 1) await C.q('channel_accounts?on_conflict=channel_id', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' }, body: JSON.stringify({ channel_id: id, org_id: user.org_id, channel: 'airbnb' }) }); }
  else if (acc.org_id !== user.org_id && user.org_id !== 1) throw new Error('Канал не принадлежит вашей организации');
  const ch = (await C.cx('GET', '/channels/' + id)).data; const a = ch.attributes || {};
  const mapped = {}; (a.rate_plans || []).forEach(m => { const lid = m.settings && m.settings.listing_id; if (lid) mapped[String(lid)] = m.rate_plan_id; });
  const r = await C.cx('GET', '/channels/' + id + '/action/listings');
  const vals = (((r.data || {}).listing_id_dictionary || {}).values) || ((r.data || {}).attributes && r.data.attributes.listing_id_dictionary && r.data.attributes.listing_id_dictionary.values) || [];
  // какой квартире соответствует уже существующий маппинг — по производному тарифу airbnb
  const units = await C.q('channel_units?select=apartment_id,derived');
  const aptByPlan = {}; units.forEach(u => { const d = (u.derived || {}).airbnb; if (d && d.rate_plan_id) aptByPlan[d.rate_plan_id] = u.apartment_id; });
  return { channel: { id, title: a.title, is_active: !!a.is_active, properties: a.properties || [] }, listings: vals.map(v => ({ id: String(v.id), title: v.title, city: v.city, occupancies: v.occupancies, quality_status: v.quality_status, mapped_apartment: mapped[String(v.id)] ? (aptByPlan[mapped[String(v.id)]] || '?') : null })) };
}
async function airbnbMap(body, user) {
  const id = String(body.channel_id || ''); await assertChannelOrg(id, user);
  const listing_id = String(body.listing_id || ''); const apt = String(body.apartment_id || ''); if (!listing_id || !apt) throw new Error('listing_id, apartment_id');
  const u = (await C.q('channel_units?select=*&apartment_id=eq.' + enc(apt)))[0]; if (!u || !u.external_rate_plan_id) throw new Error('Квартира не создана в Channex — сначала «+ подключить ЖК»');
  const prop = (await C.q('channel_properties?select=*&id=eq.' + u.channel_property_id))[0];
  let d = (u.derived || {}).airbnb;
  if (!d || !d.rate_plan_id) { const mk = (await C.q('channel_markups?select=pct&org_id=eq.' + user.org_id + '&channel=eq.airbnb'))[0]; await C.ensureDerived(u, prop, 'airbnb', mk ? Number(mk.pct) : 0); d = (u.derived || {}).airbnb; }
  if (!d || !d.rate_plan_id) throw new Error('нет производного тарифа Airbnb');
  const r = await C.cx('POST', '/channels/' + id + '/mappings', { mapping: { rate_plan_id: d.rate_plan_id, settings: { listing_id } } });
  return { ok: true, mapping_id: r.data && r.data.id, apartment_id: apt, listing_id };
}

// 15.10.2026: Booking.com на проде. Одна карточка Booking (hotel_id) = один канал Channex = одно property (ЖК).
// booking_probe  {hotel_id}                       → test_connection + mapping_details + connection_details (посмотреть номера/тарифы карточки)
// booking_connect {hotel_id, title?, pairs:{<booking_room_id>:<apartment_id>}, activate?:true}
//   → канал BookingCom с маппингом: каждый номер карточки → производный тариф «Booking.com» квартиры; все parent-тарифы номера
//   на один наш тариф (одинаковая цена), primary — первый тариф и максимальная occupancy; OBP — по одному маппингу на каждую occupancy.
// 15.10: обобщено — adapter: 'BookingCom' (тариф booking) | 'Ostrovok' (ETG, тариф ostrovok). Ostrovok: 1 объект ETG = 1 квартира, OBP — одна наша цена на все occupancy.
const ADAPTERS = { BookingCom: { derived: 'booking', readonly: true }, Ostrovok: { derived: 'ostrovok', readonly: false } };
// 16.10.2026: «+ Площадка» — любой адаптер Channex. Ключ площадки у нас: известный (booking/ostrovok/airbnb/agoda/expedia) или код адаптера в нижнем регистре.
function adapterInfo(code, title) {
  if (ADAPTERS[code]) return Object.assign({ code }, ADAPTERS[code]);
  const known = Object.keys(C.CHANNEL_CODES).find(k => C.CHANNEL_CODES[k] === code);
  const key = known || String(code).toLowerCase().replace(/[^a-z0-9]/g, '');
  return { code, derived: key, readonly: false, title: title || C.OTA_PLANS[key] || code, isNew: !known };
}
// список адаптеров Channex (кэш сутки в app_settings.channex_adapters)
async function adapters() {
  let cached = null; try { const r = await C.q('app_settings?select=value,updated_at&key=eq.channex_adapters'); if (r && r[0] && Date.now() - new Date(r[0].updated_at).getTime() < 86400000) cached = JSON.parse(r[0].value); } catch (_) { }
  let list = cached;
  if (!list) {
    const j = await C.cx('GET', '/channels/list');
    const raw = j.data || j.adapters || j || [];
    list = (Array.isArray(raw) ? raw : Object.keys(raw).map(k => Object.assign({ code: k }, typeof raw[k] === 'object' ? raw[k] : { title: raw[k] }))).map(x => { const a = x.attributes || x; return { code: a.code || a.id || x.id || a.channel, title: a.title || a.name || a.code || x.id }; }).filter(x => x.code);
    list.sort((a, b) => String(a.title).localeCompare(String(b.title)));
    await C.q('app_settings?on_conflict=key', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' }, body: JSON.stringify({ key: 'channex_adapters', value: JSON.stringify(list), note: 'адаптеры Channex (кэш)', updated_at: new Date().toISOString() }) });
  }
  const connected = {}; Object.keys(C.CHANNEL_CODES).forEach(k => connected[C.CHANNEL_CODES[k]] = k);
  return { adapters: list.map(x => Object.assign({}, x, { key: connected[x.code] || adapterInfo(x.code).derived })), catalog: C.OTA_PLANS };
}
async function bookingProbe(body) {
  const code = body.adapter || 'BookingCom';
  const settings = Object.assign({}, body.settings || {}, body.hotel_id ? { hotel_id: String(body.hotel_id) } : {}); if (!Object.keys(settings).length) throw new Error('нужны настройки площадки (ID объекта)');
  const t = await C.cx('POST', '/channels/test_connection', { channel: code, settings });
  let m = null; try { m = await C.cx('POST', '/channels/mapping_details', { channel: code, settings }); } catch (e) { m = { data: { error: String(e.message).slice(0, 200) } }; }
  let cd = null; try { cd = await C.cx('POST', '/channels/connection_details', { channel: code, settings }); } catch (e) { cd = { data: { error: String(e.message).slice(0, 120) } }; }
  return { adapter: code, test: t.data, mapping: m.data, connection: cd && cd.data };
}

async function bookingConnect(body, user) {
  const code = body.adapter || 'BookingCom'; const AD = adapterInfo(code, body.adapter_title);
  const settings = Object.assign({}, body.settings || {}, body.hotel_id ? { hotel_id: String(body.hotel_id) } : {}); const hotel_id = String(settings.hotel_id || Object.values(settings)[0] || ''); if (!hotel_id) throw new Error('hotel_id');
  const pairs = body.pairs || {}; if (!Object.keys(pairs).length) throw new Error('pairs');
  if (AD.isNew) await C.addCatalog(AD.derived, code, AD.title);
  if (!body.skip_test) { const t = await C.cx('POST', '/channels/test_connection', { channel: code, settings }); if (!(t.data && t.data.success)) throw new Error('test_connection: ' + JSON.stringify(t.data)); }
  const md = body.mapping || (await C.cx('POST', '/channels/mapping_details', { channel: code, settings })).data || {}; const pricing = md.pricing_type || 'Standard';
  // 17.10: только квартиры своей организации (общие с нами — у владельца, их площадки подключает владелец)
  const own = new Set((await C.q('apartments?select=id&org_id=eq.' + user.org_id)).map(a => a.id));
  const units = (await C.q('channel_units?select=*&is_active=eq.true')).filter(u => own.has(u.apartment_id));
  const byApt = {}; units.forEach(u => byApt[u.apartment_id] = u);
  const log = []; const rate_plans = []; const propIds = new Set();
  for (const room of (md.rooms || [])) {
    const apt = pairs[String(room.id)]; if (!apt) { log.push('skip room ' + room.id + ' ' + room.title + ' (нет пары)'); continue; }
    const u = byApt[apt]; if (!u) { log.push('no unit ' + apt); continue; }
    let d = (u.derived || {})[AD.derived];
    if (!d || !d.rate_plan_id) { // производного тарифа площадки ещё нет (новая площадка) — создаём с наценкой организации (0 по умолчанию)
      try { const pr = (await C.q('channel_properties?select=*&id=eq.' + u.channel_property_id))[0]; const mk = (await C.q('channel_markups?select=pct&org_id=eq.' + user.org_id + '&channel=eq.' + enc(AD.derived)))[0]; await C.ensureDerived(u, pr, AD.derived, mk ? Number(mk.pct) : 0); d = (u.derived || {})[AD.derived]; } catch (e) { log.push('derived ' + AD.derived + ' ' + apt + ': ' + String(e.message).slice(0, 120)); }
      if (!d || !d.rate_plan_id) { log.push('no derived ' + AD.derived + ' plan for ' + apt); continue; } }
    propIds.add(u.channel_property_id);
    const rates = (room.rates || []).filter(r => !r.readonly);
    if (!rates.length) { log.push('room ' + room.id + ' без тарифов'); continue; }
    rates.forEach((r, ri) => {
      const occs = (pricing === 'OBP' && r.occupancies && r.occupancies.length) ? [...r.occupancies].sort((a, b) => b - a) : [r.max_persons || 2];
      occs.forEach((occ, oi) => { const st = { room_type_code: room.id, rate_plan_code: r.id, occupancy: occ, pricing_type: r.pricing || pricing, primary_occ: oi === 0 }; if (AD.readonly) st.readonly = !!r.readonly; rate_plans.push({ rate_plan_id: d.rate_plan_id, settings: st }); });
      log.push(room.title + ' / ' + r.title + ' → ' + apt + ' (occ ' + occs.join(',') + ')');
    });
  }
  if (!rate_plans.length) throw new Error('нечего мапить: ' + log.join('; '));
  if (propIds.size !== 1) throw new Error('номера карточки из разных property Channex: ' + [...propIds].join(','));
  const prop = (await C.q('channel_properties?select=*&id=eq.' + [...propIds][0]))[0];
  const group_id = body.group_id || await orgGroupId(user); if (!group_id) throw new Error('нет group в Channex');
  const existing = body.no_dup_check ? [] : ((await C.cx('GET', '/channels?pagination[limit]=100')).data || []);
  const dup = existing.find(c => c.attributes && c.attributes.channel === code && String((c.attributes.settings || {}).hotel_id) === hotel_id);
  let ch;
  if (dup) { ch = await C.cx('PUT', '/channels/' + dup.id, { channel: { title: body.title || dup.attributes.title, properties: [prop.external_id], settings, rate_plans } }); log.unshift('updated existing channel ' + dup.id); }
  else ch = await C.cx('POST', '/channels', { channel: { channel: code, group_id, title: body.title || (code + ' ' + hotel_id), properties: [prop.external_id], settings: Object.assign({}, settings, { send_email_notifications: false }), rate_plans } });
  const id = ch.data.id; let activated = null, loaded = null;
  // 17.10: канал клиента (org≠1) закрепляем за его организацией — матрица показывает, чей аккаунт площадки
  if (user.org_id !== 1) { try { await C.q('channel_accounts?on_conflict=channel_id', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' }, body: JSON.stringify({ channel_id: id, org_id: user.org_id, channel: AD.derived, title: body.title || null, updated_at: new Date().toISOString() }) }); } catch (_) { } }
  if (body.activate !== false) {
    try { await C.cx('POST', '/channels/' + id + '/activate'); activated = true; } catch (e) { activated = String(e.message).slice(0, 200); }
    if (code === 'BookingCom') { try { loaded = (await C.cx('POST', '/channels/' + id + '/execute/load_future_reservations')).data || true; } catch (e) { loaded = String(e.message).slice(0, 200); } }
  }
  return { adapter: code, channel_id: id, property: prop.complex, pricing, mappings: rate_plans.length, activated, loaded, log };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: H, body: '' };
  try {
    const user = await auth(event); if (!user) return out(401, { error: 'unauthorized' });
    if (user.role !== 'admin') return out(403, { error: 'только admin' });
    C.setKey(user.channex_key);   // свой ключ Channex у организации — на время этого запроса
    await C.loadCatalog();        // площадки, добавленные через «+ Площадка»
    const p = event.queryStringParameters || {};
    if (event.httpMethod === 'GET') { if (p.a === 'status') return out(200, await status(user)); return out(400, { error: 'unknown action' }); }
    const body = JSON.parse(event.body || '{}');
    switch (body.a) {
      case 'setup_complex': return out(200, await setupComplex(body, user));
      case 'setup_webhook': return out(200, await setupWebhook());
      case 'setup_unit': return out(200, await setupUnit(body, user));
      case 'channel_toggle': return out(200, await channelToggle(body, user));
      case 'unit_markup': return out(200, await unitMarkup(body, user));
      case 'restriction_save': return out(200, await restrictionSave(body, user));
      case 'restriction_delete': return out(200, await restrictionDelete(body, user));
      case 'unit_log': return out(200, await unitLog(body, user));
      case 'mapping_scan': return out(200, await mappingScan(body));
      case 'channel_account_set': {
        // чей аккаунт площадки у канала Channex: org_id организации (1 = Urban Luxe). Нужно для партнёрских квартир (Airbnb HighLife).
        const id = String(body.channel_id || ''); const org = Number(body.org_id) || 1; if (!id) return out(400, { error: 'channel_id' });
        const ch = (await C.cx('GET', '/channels/' + id)).data; const a = ch.attributes || {};
        await C.q('channel_accounts?on_conflict=channel_id', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' }, body: JSON.stringify({ channel_id: id, org_id: org, channel: a.channel, title: a.title, updated_at: new Date().toISOString() }) });
        const codeToCh = {}; Object.keys(C.CHANNEL_CODES).forEach(k => codeToCh[C.CHANNEL_CODES[k]] = k);
        const r = codeToCh[a.channel] ? await mappingScan({ channel: codeToCh[a.channel] }) : null;
        return out(200, { ok: true, channel_id: id, org_id: org, rescan: r });
      }
      case 'go_production': return out(200, await goProduction(body, user));
      case 'adapters': return out(200, await adapters());
      case 'airbnb_link': return out(200, await airbnbLink(body, user));
      case 'airbnb_listings': return out(200, await airbnbListings(body, user));
      case 'airbnb_map': return out(200, await airbnbMap(body, user));
      case 'airbnb_activate': { const id = String(body.channel_id || ''); await assertChannelOrg(id, user); let act = null, loaded = null; try { await C.cx('POST', '/channels/' + id + '/activate'); act = true; } catch (e) { act = String(e.message).slice(0, 200); } try { loaded = (await C.cx('POST', '/channels/' + id + '/execute/load_future_reservations')).data || true; } catch (e) { loaded = String(e.message).slice(0, 200); } try { await mappingScan({ channel: 'airbnb' }); } catch (_) { } return out(200, { activated: act, loaded }); }
      case 'channel_probe': return out(200, await bookingProbe(body));
      case 'channel_connect': return out(200, await bookingConnect(body, user));
      case 'booking_probe': return out(200, await bookingProbe(body));
      case 'booking_connect': return out(200, await bookingConnect(body, user));
      case 'channel_activate': { const id = String(body.channel_id || ''); if (!id) return out(400, { error: 'channel_id' }); const r = await C.cx('POST', '/channels/' + id + '/activate'); return out(200, { ok: true, r: r && r.meta }); }
      case 'ostrovok_probe': return out(200, await bookingProbe(Object.assign({}, body, { adapter: 'Ostrovok' })));
      case 'ostrovok_connect': return out(200, await bookingConnect(Object.assign({}, body, { adapter: 'Ostrovok' }), user));
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
  finally { C.setKey(null); }
};
exports.mappingScan = mappingScan;
