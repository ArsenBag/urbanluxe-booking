// Urban Luxe — _channex.js (11.10.2026). Общий клиент Channex + Supabase для хаба каналов.
// env: CHANNEX_API_KEY, CHANNEX_BASE (https://staging.channex.io | https://app.channex.io), CHANNEX_WEBHOOK_SECRET
// Спека: docs/superpowers/specs/2026-10-11-channel-hub.md
const T = require('./_tg.js');

const BASE = (process.env.CHANNEX_BASE || 'https://staging.channex.io').replace(/\/$/, '');
const KEY = process.env.CHANNEX_API_KEY;

async function cx(method, path, body) {
  if (!KEY) throw new Error('CHANNEX_API_KEY не задан в Netlify env');
  const r = await fetch(BASE + '/api/v1' + path, { method, headers: { 'user-api-key': KEY, 'Content-Type': 'application/json', Accept: 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (_) { j = { raw: t.slice(0, 300) }; }
  if (!r.ok) { const e = new Error('Channex ' + r.status + ' ' + method + ' ' + path + ': ' + JSON.stringify(j && (j.errors || j)).slice(0, 400)); e.status = r.status; e.body = j; throw e; }
  return j;
}
async function q(path, opt) { const r = await T.sb(path, opt); const t = await r.text(); if (!r.ok) { const e = new Error(t.slice(0, 300)); e.status = r.status; throw e; } if (!t) return null; try { return JSON.parse(t); } catch (_) { return null; } }
async function qAll(path, page) { page = page || 1000; const all = []; for (let i = 0; i < 50; i++) { const r = await T.sb(path, { headers: { Range: (i * page) + '-' + ((i + 1) * page - 1), Prefer: 'count=none' } }); if (!r.ok && r.status !== 416) throw new Error((await r.text()).slice(0, 300)); const rows = r.status === 416 ? [] : await r.json(); all.push(...rows); if (rows.length < page) break; } return all; }
const rpc = (name, args) => q('rpc/' + name, { method: 'POST', body: JSON.stringify(args || {}) });
const addDays = (iso, k) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
const today = () => T.tashToday(0);

async function alertAdmin(text) { try { if (T.ADMIN && T.TOKENS.bookings) await T.api(T.TOKENS.bookings, 'sendMessage', { chat_id: T.ADMIN, text, parse_mode: 'HTML', disable_web_page_preview: true }); } catch (_) { } }

// Наценка канала для квартиры: channel_units.markup_pct → rate_rules(channel_markup, channel null/'ota') → 0
async function markupFor(unit, rulesCache) {
  if (unit.markup_pct != null) return Number(unit.markup_pct);
  if (!rulesCache.rules) rulesCache.rules = await q('rate_rules?select=*&kind=eq.channel_markup&is_active=eq.true&order=priority.desc');
  const apt = rulesCache.apts[unit.apartment_id];
  const r = rulesCache.rules.find(x => (!x.channel || x.channel === 'ota' || x.channel === 'channex') && (x.scope === 'all' || (x.scope === 'complex' && apt && x.complex === apt.complex) || (x.scope === 'apartment' && x.apartment_id === unit.apartment_id)));
  return r ? Number(r.value) : 0;
}

// Сжать дни в диапазоны с одинаковыми значениями
function ranges(rows, keyFn) {
  const out = []; let cur = null;
  for (const r of rows) {
    const k = keyFn(r);
    if (cur && cur.key === k && addDays(cur.to, 1) === r.date) { cur.to = r.date; continue; }
    cur = { key: k, from: r.date, to: r.date, row: r }; out.push(cur);
  }
  return out;
}

// Значения ARI одной квартиры за диапазон (включительно) — без отправки
async function unitValues(unit, from, to, kind, cache) {
  const t0 = today(); if (from < t0) from = t0; if (to < from) return null;
  const prop = cache.props[unit.channel_property_id]; if (!prop || !prop.external_id) throw new Error('property без external_id');
  if (!unit.external_room_type_id || !unit.external_rate_plan_id) throw new Error('unit без room_type/rate_plan');
  const rows = await qAll('rate_calendar?select=date,price,min_nights,closed,closed_to_arrival,available&apartment_id=eq.' + encodeURIComponent(unit.apartment_id) + '&date=gte.' + from + '&date=lte.' + to + '&order=date');
  if (!rows.length) return null;
  const v = { availability: [], restrictions: [], days: rows.length };
  if ((kind === 'both' || kind === 'availability') && unit.push_availability) {
    v.availability = ranges(rows, r => r.available ? '1' : '0').map(g => ({ property_id: prop.external_id, room_type_id: unit.external_room_type_id, date_from: g.from, date_to: g.to, availability: g.row.available ? 1 : 0 }));
  }
  if ((kind === 'both' || kind === 'rates') && unit.push_rates) {
    // наценка площадкам — не здесь: Standard = наш прайс, площадки получают производные тарифы Channex (+X %, см. ensureDerived)
    const m = unit.markup_pct != null ? Number(unit.markup_pct) : 0;
    v.restrictions = ranges(rows, r => [Math.round(r.price * (1 + m / 100)), r.min_nights, r.closed ? 1 : 0, r.closed_to_arrival ? 1 : 0].join('|')).map(g => ({
      property_id: prop.external_id, rate_plan_id: unit.external_rate_plan_id, date_from: g.from, date_to: g.to,
      rate: String(Math.max(1, Math.round(g.row.price * (1 + m / 100)))) + '.00',
      min_stay_arrival: Math.max(1, g.row.min_nights || 1), closed_to_arrival: !!g.row.closed_to_arrival, stop_sell: !!g.row.closed
    }));
  }
  return v;
}
// Отправить набор значений (одна property — один POST /availability и один POST /restrictions, как требует Channex)
async function sendValues(v) {
  const res = {};
  if (v.availability.length) res.availability = await cx('POST', '/availability', { values: v.availability });
  if (v.restrictions.length) res.restrictions = await cx('POST', '/restrictions', { values: v.restrictions });
  const warn = [].concat((res.availability && res.availability.meta && res.availability.meta.warnings) || [], (res.restrictions && res.restrictions.meta && res.restrictions.meta.warnings) || []);
  const taskOf = r => { if (!r || !r.data) return null; const d = Array.isArray(r.data) ? r.data[0] : r.data; return d && d.id || null; };
  const tasks = { availability: taskOf(res.availability), restrictions: taskOf(res.restrictions) };
  return { ok: true, warnings: warn.length ? warn.slice(0, 5) : undefined, tasks, days: v.days };
}
// Отправить ARI одной квартиры (push_full по квартире, проверки)
async function pushUnit(unit, from, to, kind, cache) {
  const v = await unitValues(unit, from, to, kind, cache); if (!v) return { skipped: true };
  return sendValues(v);
}

async function loadCache() {
  const [props, apts] = await Promise.all([q('channel_properties?select=*&is_active=eq.true'), q('apartments?select=id,name,complex,max_guests,floor,rooms,weekday_price&order=id')]);
  const cache = { props: {}, apts: {} }; props.forEach(p => cache.props[p.id] = p); apts.forEach(a => cache.apts[a.id] = a); return cache;
}

// Обработать очередь: квартиры → диапазоны, затем ЖК (property) → один запрос на занятость и один на цены/ограничения.
// 13.10.2026: группировка по property (было по квартире) — требование сертификации Channex «несколько номеров = 1 API-вызов»;
// task id ответа Channex пишется в channel_outbox.task_ids и channel_units.last_task.
async function processOutbox(limit) {
  const pending = await q('channel_outbox?select=*&sent_at=is.null&attempts=lt.5&order=created_at&limit=' + (limit || 2000));
  if (!pending.length) return { sent: 0 };
  const units = await q('channel_units?select=*&is_active=eq.true'); const byApt = {}; units.forEach(u => byApt[u.apartment_id] = u);
  const cache = await loadCache();
  const groups = {};
  for (const o of pending) { const g = groups[o.apartment_id] = groups[o.apartment_id] || { ids: [], from: o.date_from, to: o.date_to, kind: o.kind, attempts: o.attempts || 0 }; g.ids.push(o.id); if (o.date_from < g.from) g.from = o.date_from; if (o.date_to > g.to) g.to = o.date_to; if (o.kind !== g.kind) g.kind = 'both'; }
  const out = { sent: 0, errors: [], tasks: [] };
  const now = () => new Date().toISOString();
  const mark = (ids, patch) => q('channel_outbox?id=in.(' + ids.join(',') + ')', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
  // по property
  const byProp = {};
  for (const apt of Object.keys(groups)) {
    const g = groups[apt], u = byApt[apt];
    if (!u) { await mark(g.ids, { sent_at: now(), error: 'unit inactive' }); continue; }
    (byProp[u.channel_property_id] = byProp[u.channel_property_id] || []).push({ apt, g, u });
  }
  for (const pid of Object.keys(byProp)) {
    const items = byProp[pid];
    const v = { availability: [], restrictions: [], days: 0 }; const okItems = [];
    for (const it of items) {
      try { const uv = await unitValues(it.u, it.g.from, it.g.to, it.g.kind, cache); if (!uv) { await mark(it.g.ids, { sent_at: now(), error: 'no rows' }); continue; } v.availability.push(...uv.availability); v.restrictions.push(...uv.restrictions); v.days += uv.days; okItems.push(it); }
      catch (e) { const msg = String(e.message || e).slice(0, 500); await mark(it.g.ids, { attempts: it.g.attempts + 1, error: msg }); out.errors.push({ apt: it.apt, error: msg }); }
    }
    if (!okItems.length) continue;
    try {
      const r = await sendValues(v);
      const ids = okItems.flatMap(it => it.g.ids);
      await mark(ids, { sent_at: now(), error: r.warnings ? JSON.stringify(r.warnings).slice(0, 500) : null, task_ids: r.tasks });
      for (const it of okItems) await q('channel_units?apartment_id=eq.' + encodeURIComponent(it.apt), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ last_pushed_at: now(), last_error: r.warnings ? JSON.stringify(r.warnings).slice(0, 500) : null, last_task: r.tasks }) });
      out.sent += ids.length; out.tasks.push(Object.assign({ property: (cache.props[pid] || {}).name, apartments: okItems.map(it => it.apt) }, r.tasks));
    } catch (e) {
      const msg = String(e.message || e).slice(0, 500);
      for (const it of okItems) { await mark(it.g.ids, { attempts: it.g.attempts + 1, error: msg }); await q('channel_units?apartment_id=eq.' + encodeURIComponent(it.apt), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ last_error: msg }) }); out.errors.push({ apt: it.apt, error: msg }); }
      if (e.status === 429) break;
    }
  }
  // 429 (лимит Channex) — не ошибка, очередь уйдёт следующим запуском; в Telegram не шумим
  out.errors = out.errors.filter(x => !/^Channex 429/.test(x.error));
  if (out.errors.length) await alertAdmin('⚠️ Channex: ошибка отправки цен/занятости\n' + out.errors.map(x => x.apt + ': ' + x.error.slice(0, 120)).join('\n'));
  return out;
}

// Забрать ревизию брони из Channex, записать, ack
async function ingestRevision(revisionId) {
  const j = await cx('GET', '/booking_revisions/' + revisionId);
  const a = (j.data && j.data.attributes) || j.data || j;
  // запоздавший повтор вебхука (Channex ретраит после наших 5xx): если бронь в Channex уже отменена — не воскрешать её у нас
  if (a.status !== 'cancelled' && a.booking_id) { try { const b = await cx('GET', '/bookings/' + a.booking_id); const bs = b.data && b.data.attributes && b.data.attributes.status; if (bs === 'cancelled') a.status = 'cancelled'; } catch (_) { } }
  const rec = { provider: 'channex', external_booking_id: a.booking_id, revision_id: a.id || revisionId, unique_id: a.unique_id, ota_name: a.ota_name, ota_reservation_code: a.ota_reservation_code, status: a.status, payload: a };
  const rows = await q('channel_bookings?on_conflict=provider,revision_id', { method: 'POST', headers: { Prefer: 'return=representation,resolution=merge-duplicates' }, body: JSON.stringify(rec) });
  const cb = rows[0];
  const res = await rpc('pms_channel_booking_upsert', { p_cb: cb.id });
  // ack всегда (даже конфликт — он у нас в списке; Channex не должен слать повторно)
  try { await cx('POST', '/booking_revisions/' + revisionId + '/ack'); await q('channel_bookings?id=eq.' + cb.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ acked_at: new Date().toISOString() }) }); } catch (e) { await q('channel_bookings?id=eq.' + cb.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ error: 'ack: ' + String(e.message).slice(0, 200) }) }); }
  const apt = res.apartment_id ? (await q('apartments?select=name&id=eq.' + encodeURIComponent(res.apartment_id)))[0] : null;
  const r0 = a.rooms && a.rooms[0] || {};
  const head = res.conflict ? '🚨 ОВЕРБУКИНГ с площадки' : a.status === 'cancelled' ? '❌ Отмена с площадки' : a.status === 'modified' ? '✏️ Изменение брони с площадки' : '🆕 Бронь с площадки';
  const cust = a.customer || {};
  await alertAdmin(head + ' · ' + T.esc(a.ota_name || '') + '\n' + T.esc(apt ? apt.name : ('room ' + (r0.room_type_id || '?'))) + ' · ' + T.ruDate(r0.checkin_date) + ' → ' + T.ruDate(r0.checkout_date) + '\n' + T.esc([cust.name, cust.surname].filter(Boolean).join(' ')) + (cust.phone ? ' · ' + T.esc(cust.phone) : '') + '\n' + T.esc(String(a.amount || '')) + ' ' + T.esc(a.currency || '') + (a.payment_collect === 'ota' ? ' · оплачено на площадке' : '') + (res.error ? '\n⚠️ ' + T.esc(res.error) : '') + (res.conflict ? '\nДаты заняты другой бронью — решить в /pms → Каналы' : ''));
  return Object.assign({ revision_id: revisionId, channel_booking_id: cb.id }, res);
}

// Страховка: все неподтверждённые ревизии
async function ingestFeed() {
  const j = await cx('GET', '/booking_revisions/feed?pagination[limit]=50');
  const list = (j.data || []).map(d => d.id); const out = [];
  for (const id of list) { try { out.push(await ingestRevision(id)); } catch (e) { out.push({ revision_id: id, error: String(e.message).slice(0, 200) }); } }
  return { count: list.length, results: out };
}

// Производный тариф площадки: «Airbnb» = Standard + pct %. Создаётся один раз на квартиру, процент меняется PUT'ом.
const OTA_PLANS = { airbnb: 'Airbnb', booking: 'Booking.com', ostrovok: 'Ostrovok', agoda: 'Agoda', expedia: 'Expedia' };
const derivedRate = pct => ({ rate: Number(pct) > 0 ? [['increase_by_percent', Number(pct).toFixed(2)]] : [] });
async function ensureDerived(unit, prop, channel, pct) {
  const title = OTA_PLANS[channel]; if (!title) throw new Error('unknown channel ' + channel);
  const d = Object.assign({}, unit.derived || {});
  if (d[channel] && d[channel].rate_plan_id) {
    await cx('PUT', '/rate_plans/' + d[channel].rate_plan_id, { rate_plan: { options: [{ id: d[channel].option_id, occupancy: d[channel].occupancy, is_primary: true, derived_option: derivedRate(pct) }] } });
    return d;
  }
  const std = await cx('GET', '/rate_plans/' + unit.external_rate_plan_id);
  const occ = (((std.data.attributes || {}).options || [])[0] || {}).occupancy || 2;
  const r = await cx('POST', '/rate_plans', { rate_plan: { property_id: prop.external_id, room_type_id: unit.external_room_type_id, parent_rate_plan_id: unit.external_rate_plan_id, title, sell_mode: 'per_room', rate_mode: 'derived', currency: 'USD', inherit_rate: true, inherit_stop_sell: true, inherit_closed_to_arrival: true, inherit_closed_to_departure: true, inherit_min_stay_arrival: true, inherit_min_stay_through: true, inherit_max_stay: true, options: [{ occupancy: occ, is_primary: true, derived_option: derivedRate(pct) }], meta: { apartment_id: unit.apartment_id, channel } } });
  const opt = ((r.data.attributes || {}).options || [])[0] || {};
  d[channel] = { rate_plan_id: r.data.id, option_id: opt.id, occupancy: occ };
  await q('channel_units?apartment_id=eq.' + encodeURIComponent(unit.apartment_id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ derived: d, updated_at: new Date().toISOString() }) });
  unit.derived = d; // вызывающий цикл по каналам работает с тем же объектом — иначе каждый канал затирал предыдущий
  return d;
}
// Восстановить derived из Channex (тарифы несут meta.apartment_id/channel) — на случай расхождения
async function reconcileDerived(propExternalId) {
  const j = await cx('GET', '/rate_plans?filter[property_id]=' + propExternalId + '&pagination[limit]=500');
  const byApt = {};
  for (const rp of (j.data || [])) { const a = rp.attributes || {}; const m = a.meta || {}; if (a.rate_mode !== 'derived' || !m.apartment_id || !m.channel) continue; const opt = (a.options || [])[0] || {}; (byApt[m.apartment_id] = byApt[m.apartment_id] || {})[m.channel] = { rate_plan_id: rp.id, option_id: opt.id, occupancy: opt.occupancy }; }
  let n = 0; for (const apt of Object.keys(byApt)) { await q('channel_units?apartment_id=eq.' + encodeURIComponent(apt), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ derived: byApt[apt], updated_at: new Date().toISOString() }) }); n++; }
  return { units: n, plans: Object.values(byApt).reduce((s, d) => s + Object.keys(d).length, 0) };
}
// Применить наценку площадки ко всем квартирам организации
async function applyMarkup(orgId, channel, pct) {
  const units = await q('channel_units?select=*&is_active=eq.true');
  const cache = await loadCache();
  const out = { ok: 0, errors: [] };
  for (const u of units) {
    const apt = cache.apts[u.apartment_id]; const prop = cache.props[u.channel_property_id];
    if (!apt || !prop || !prop.external_id || !u.external_rate_plan_id) continue;
    if ((prop.org_id || 1) !== orgId) continue;
    try { await ensureDerived(u, prop, channel, pct); out.ok++; } catch (e) { out.errors.push(u.apartment_id + ': ' + String(e.message).slice(0, 160)); }
  }
  return out;
}
module.exports = { cx, q, qAll, rpc, BASE, addDays, today, alertAdmin, pushUnit, processOutbox, loadCache, ingestRevision, ingestFeed, ensureDerived, applyMarkup, reconcileDerived, OTA_PLANS };
