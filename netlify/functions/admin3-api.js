// Urban Luxe — admin3-api.js (04.10.2026). API новой админки /admin3.html.
// Авторизация: Supabase-сессия админа (Authorization: Bearer <access_token>) → email должен быть в таблице app_users.
// Данные: finance_monthly (импорт таблиц + ручной ввод), daily_ops (живая выручка по заездам), expenses, apartment_terms,
// partners, marketing_spend, occupancy_daily, bookings, cleaning_tasks.
//
// GET  ?a=me
// GET  ?a=dashboard                       → KPI текущего месяца + ряд 13 месяцев
// GET  ?a=pl&from=2026-01&to=2026-12      → P&L по месяцам (выручка, аренда, комиссии, расходы по категориям, результат, доля партнёров)
// GET  ?a=apartments&month=2026-09        → квартиры: модель, аренда, партнёр, выручка/прибыль за месяц и за 3 мес, загрузка
// GET  ?a=apartment&id=nest_481           → история по квартире
// GET  ?a=expenses&month=2026-09[&apartment_id=] | POST {a:'expense', ...} | POST {a:'expense_delete', id}
// GET  ?a=terms | POST {a:'term', ...} | POST {a:'term_delete', id}
// GET  ?a=partners | POST {a:'partner', ...}
// GET  ?a=partner_report&partner_id=&month=2026-09
// GET  ?a=marketing&from=&to= | POST {a:'marketing', ...}
// POST {a:'finance', apartment_id, month, revenue, rent, commission, nights, notes}  → ручная запись (source=manual, перекрывает импорт)
// GET  ?a=ops                              → сегодня: заезды/выезды/уборки/долги, загрузка на 14 дней
// GET  ?a=categories

const T = require('./_tg.js');

const SB_URL = process.env.SUPABASE_URL || 'https://sebvfvtofiysbywxjqut.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI';
const H = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const out = (code, body) => ({ statusCode: code, headers: H, body: JSON.stringify(body) });
const n = v => { const x = parseFloat(v); return isNaN(x) ? 0 : x; };
const r2 = v => Math.round(n(v) * 100) / 100;
const monthStart = ym => (ym && /^\d{4}-\d{2}$/.test(ym) ? ym + '-01' : T.tashToday(0).slice(0, 7) + '-01');
const addMonths = (iso, k) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + k); return d.toISOString().slice(0, 10); };
const ym = iso => String(iso).slice(0, 7);

async function q(path) { const r = await T.sb(path); if (!r.ok) throw new Error(path.split('?')[0] + ': ' + (await r.text()).slice(0, 200)); return r.json(); }

// ---------- auth ----------
async function auth(event) {
  const h = event.headers || {};
  const tok = ((h.authorization || h.Authorization || '').match(/^Bearer\s+(.+)$/i) || [])[1];
  if (!tok) return null;
  const r = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: ANON, Authorization: 'Bearer ' + tok } });
  if (!r.ok) return null;
  const u = await r.json();
  if (!u || !u.email) return null;
  const rows = await q('app_users?select=*&email=eq.' + encodeURIComponent(u.email.toLowerCase()));
  if (!rows.length) return null;
  return { email: u.email.toLowerCase(), role: rows[0].role, name: rows[0].name || u.email, partner_id: rows[0].partner_id };
}

// ---------- базовые выборки ----------
async function apartments() {
  const list = await q('apartments?select=id,name,complex,floor,rooms,weekday_price,weekend_price,is_active&order=complex,name');
  list.forEach(a => { a.short = (a.complex || '') + ' ' + String(a.name || '').replace(/\D/g, ''); });
  return list;
}
async function termsAll() { return q('apartment_terms?select=*,partners(id,name)&order=apartment_id,valid_from.desc'); }
function termFor(terms, aptId, monthIso) {
  const m = monthIso || T.tashToday(0);
  return terms.find(t => t.apartment_id === aptId && t.valid_from <= m && (!t.valid_to || t.valid_to >= m)) || terms.find(t => t.apartment_id === aptId) || null;
}

// Выручка за месяц по квартирам: ручная запись > импорт > живые данные листа заездов (daily_ops.payment_total по дате заезда)
async function monthRevenue(from, to) { // from/to — первые числа месяцев, включительно
  const toEnd = addMonths(to, 1);
  const [fin, ops] = await Promise.all([
    q('finance_monthly?select=apartment_id,apt_label,month,revenue,rent,commission,nights,profit,is_partner,source&month=gte.' + from + '&month=lt.' + toEnd),
    q('daily_ops?select=apartment_id,date,payment_total,payment_paid,source,check_out_date&date=gte.' + from + '&date=lt.' + toEnd + '&limit=5000')
  ]);
  const map = {}; // key apt|month → {revenue, rent, commission, nights, source}
  const put = (apt, mo, rec) => { map[apt + '|' + mo] = rec; };
  // живые данные
  const live = {};
  ops.forEach(o => { if (!o.apartment_id) return; const k = o.apartment_id + '|' + ym(o.date); live[k] = live[k] || { revenue: 0, paid: 0, nights: 0, stays: 0 }; live[k].revenue += n(o.payment_total); live[k].paid += n(o.payment_paid); live[k].stays++; if (o.check_out_date) live[k].nights += Math.max(0, (new Date(o.check_out_date) - new Date(o.date)) / 864e5); });
  Object.keys(live).forEach(k => { const [apt, mo] = k.split('|'); put(apt, mo, Object.assign({ apartment_id: apt, month: mo, rent: null, commission: 0, source: 'live' }, live[k])); });
  // импорт поверх живых (история), ручные поверх всего
  const order = { import: 1, manual: 2 };
  fin.sort((a, b) => (order[a.source] || 0) - (order[b.source] || 0)).forEach(f => {
    const apt = f.apartment_id || ('label:' + f.apt_label);
    const prev = map[apt + '|' + ym(f.month)];
    if (prev && prev.source === 'manual' && f.source !== 'manual') return;
    put(apt, ym(f.month), { apartment_id: f.apartment_id, apt_label: f.apt_label, month: ym(f.month), revenue: n(f.revenue), rent: n(f.rent), commission: n(f.commission), nights: n(f.nights), profit_sheet: n(f.profit), is_partner: !!f.is_partner, source: f.source, live: prev && prev.source === 'live' ? prev : null });
  });
  return map;
}

async function expensesBetween(from, to) {
  const toEnd = addMonths(to, 1);
  return q('expenses?select=*&expense_date=gte.' + from + '&expense_date=lt.' + toEnd + '&order=expense_date.desc&limit=5000');
}
async function categories() { return q('expense_categories?select=*&order=sort'); }

// ---------- P&L ----------
async function pl(from, to) {
  const [rev, exps, cats, terms, apts, mkt] = await Promise.all([monthRevenue(from, to), expensesBetween(from, to), categories(), termsAll(), apartments(), q('marketing_spend?select=spend_date,channel,amount_usd,clicks,tg_clicks,leads,bookings&spend_date=gte.' + from + '&spend_date=lt.' + addMonths(to, 1))]);
  const kind = {}; cats.forEach(c => { kind[c.code] = c.kind; });
  const months = []; for (let m = from; m <= to; m = addMonths(m, 1)) months.push(ym(m));
  const rows = months.map(mo => {
    const recs = Object.values(rev).filter(r => r.month === mo);
    const partnerRecs = recs.filter(r => { if (r.is_partner != null) return r.is_partner; const t = termFor(terms, r.apartment_id, mo + '-01'); return t && t.model === 'partner'; });
    const sum = (arr, k) => arr.reduce((s, r) => s + n(r[k]), 0);
    // аренда: из записи месяца, если нет — из условий квартиры
    const rentOf = r => r.rent != null && r.rent !== 0 ? n(r.rent) : (r.apartment_id ? n((termFor(terms, r.apartment_id, mo + '-01') || {}).rent) : 0);
    const rent = recs.reduce((s, r) => s + rentOf(r), 0);
    const e = exps.filter(x => ym(x.expense_date) === mo);
    const byCat = {}; const byKind = {};
    e.forEach(x => { const c = x.category || 'other'; byCat[c] = (byCat[c] || 0) + n(x.amount); const k = kind[c] || 'other'; byKind[k] = (byKind[k] || 0) + n(x.amount); });
    const revenue = sum(recs, 'revenue'), commission = sum(recs, 'commission');
    const opex = (byKind.opex || 0) + (byKind.payroll || 0) + (byKind.marketing || 0) + (byKind.platform || 0) + (byKind.other || 0) + (byKind.tax || 0);
    const capex = byKind.capex || 0;
    const mktSpend = mkt.filter(x => ym(x.spend_date) === mo).reduce((s, x) => s + n(x.amount_usd), 0);
    const gross = revenue - rent - commission;
    // доля партнёров: 50 % от (выручка − аренда − комиссия − общие расходы по их квартирам)
    const partnerShare = partnerRecs.reduce((s, r) => { const t = termFor(terms, r.apartment_id, mo + '-01'); const share = t && t.partner_share != null ? n(t.partner_share) : 50; const shared = e.filter(x => x.apartment_id === r.apartment_id && x.partner_shared).reduce((a, x) => a + n(x.amount), 0); return s + Math.max(0, (n(r.revenue) - rentOf(r) - n(r.commission) - shared)) * share / 100; }, 0);
    return {
      month: mo, apartments: recs.length, partner_apartments: partnerRecs.length,
      revenue: r2(revenue), rent: r2(rent), commission: r2(commission), gross: r2(gross),
      expenses_opex: r2(opex), expenses_capex: r2(capex), by_category: Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, r2(v)])), by_kind: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, r2(v)])),
      marketing_tracked: r2(mktSpend),
      ebitda: r2(gross - opex), partner_share: r2(partnerShare), net: r2(gross - opex - partnerShare),
      dividends: r2(byKind.dividend || 0), credit: r2(byKind.credit || 0),
      nights: recs.reduce((s, r) => s + n(r.nights), 0),
      sources: recs.reduce((acc, r) => { acc[r.source] = (acc[r.source] || 0) + 1; return acc; }, {})
    };
  });
  return { from: ym(from), to: ym(to), months: rows, categories: cats };
}

// ---------- квартиры ----------
async function aptTable(monthIso) {
  const m0 = monthIso, from = addMonths(m0, -2);
  const [apts, terms, rev, occ, exps] = await Promise.all([apartments(), termsAll(), monthRevenue(from, m0), q('occupancy_daily?select=apartment_id,date,busy&date=gte.' + m0 + '&date=lt.' + addMonths(m0, 1) + '&busy=eq.true&limit=5000'), expensesBetween(m0, m0)]);
  const dim = Math.round((new Date(addMonths(m0, 1)) - new Date(m0)) / 864e5);
  const busy = {}; occ.forEach(o => { busy[o.apartment_id] = (busy[o.apartment_id] || 0) + 1; });
  const rows = apts.map(a => {
    const t = termFor(terms, a.id, m0);
    const cur = rev[a.id + '|' + ym(m0)] || {};
    const hist = [0, 1, 2].map(k => rev[a.id + '|' + ym(addMonths(m0, -k))] || { revenue: 0 });
    const rent = cur.rent || n((t || {}).rent);
    const aptExp = exps.filter(e => e.apartment_id === a.id).reduce((s, e) => s + n(e.amount), 0);
    const gross = n(cur.revenue) - rent - n(cur.commission);
    return {
      id: a.id, short: a.short, complex: a.complex, name: a.name, rooms: a.rooms, floor: a.floor, is_active: a.is_active,
      model: (t || {}).model || 'sublease', partner: t && t.partners ? t.partners.name : null, partner_share: t ? t.partner_share : null, rent: r2(rent),
      lease_end: (t || {}).lease_end || null,
      revenue: r2(cur.revenue), commission: r2(cur.commission), nights: n(cur.nights), source: cur.source || null,
      expenses: r2(aptExp), gross: r2(gross), net: r2(gross - aptExp),
      ul_share: r2(t && t.model === 'partner' ? Math.max(0, gross - aptExp) * (100 - n(t.partner_share || 50)) / 100 : gross - aptExp),
      occupancy: Math.round(100 * (busy[a.id] || 0) / dim), busy_days: busy[a.id] || 0,
      revpar: r2(n(cur.revenue) / dim), adr: cur.nights ? r2(n(cur.revenue) / n(cur.nights)) : null,
      rev3: hist.map(h => r2(h.revenue)), price: a.weekday_price
    };
  });
  // квартиры из таблиц, которых нет в базе
  Object.values(rev).filter(r => r.month === ym(m0) && !r.apartment_id).forEach(r => rows.push({ id: null, short: r.apt_label, complex: '—', model: r.is_partner ? 'partner' : 'sublease', rent: r2(r.rent), revenue: r2(r.revenue), commission: r2(r.commission), nights: n(r.nights), gross: r2(n(r.revenue) - n(r.rent) - n(r.commission)), net: r2(n(r.revenue) - n(r.rent) - n(r.commission)), occupancy: null, rev3: [r2(r.revenue), 0, 0], source: r.source }));
  rows.sort((a, b) => n(b.revenue) - n(a.revenue));
  const tot = rows.reduce((s, r) => { s.revenue += n(r.revenue); s.rent += n(r.rent); s.gross += n(r.gross); s.net += n(r.net); s.ul += n(r.ul_share); s.busy += n(r.busy_days); s.active += r.is_active ? 1 : 0; return s; }, { revenue: 0, rent: 0, gross: 0, net: 0, ul: 0, busy: 0, active: 0 });
  tot.occupancy = tot.active ? Math.round(100 * tot.busy / (tot.active * dim)) : 0;
  return { month: ym(m0), days: dim, rows, totals: tot };
}

async function aptHistory(id) {
  const [a, terms, fin, exps, ops] = await Promise.all([q('apartments?select=*&id=eq.' + id), q('apartment_terms?select=*,partners(id,name)&apartment_id=eq.' + id + '&order=valid_from.desc'), q('finance_monthly?select=*&apartment_id=eq.' + id + '&order=month'), q('expenses?select=*&apartment_id=eq.' + id + '&order=expense_date.desc&limit=200'), q('daily_ops?select=date,check_out_date,guest_name,source,payment_total,payment_paid,checked_in,checked_out&apartment_id=eq.' + id + '&order=date.desc&limit=60')]);
  return { apartment: a[0] || null, terms, finance: fin, expenses: exps, stays: ops };
}

// ---------- партнёрский отчёт ----------
async function partnerReport(partnerId, monthIso) {
  const [terms, rev, exps, partners] = await Promise.all([termsAll(), monthRevenue(monthIso, monthIso), expensesBetween(monthIso, monthIso), q('partners?select=*&id=eq.' + partnerId)]);
  const mine = terms.filter(t => t.partner_id === partnerId && t.model === 'partner' && t.valid_from <= addMonths(monthIso, 1) && (!t.valid_to || t.valid_to >= monthIso));
  const apts = await apartments();
  const rows = mine.map(t => {
    const a = apts.find(x => x.id === t.apartment_id) || {};
    const r = rev[t.apartment_id + '|' + ym(monthIso)] || {};
    const rent = r.rent || n(t.rent);
    const e = exps.filter(x => x.apartment_id === t.apartment_id);
    const shared = e.filter(x => x.partner_shared).reduce((s, x) => s + n(x.amount), 0);
    const profit = n(r.revenue) - rent - n(r.commission) - shared;
    const share = n(t.partner_share == null ? 50 : t.partner_share);
    return { apartment_id: t.apartment_id, short: a.short || t.apartment_id, revenue: r2(r.revenue), rent: r2(rent), commission: r2(r.commission), nights: n(r.nights), shared_expenses: r2(shared), expenses: e.map(x => ({ date: x.expense_date, category: x.category, amount: x.amount, description: x.description, shared: x.partner_shared })), profit: r2(profit), partner_share_pct: share, partner_amount: r2(profit * share / 100), ul_amount: r2(profit * (100 - share) / 100), source: r.source || null };
  });
  const tot = rows.reduce((s, r) => { ['revenue', 'rent', 'commission', 'shared_expenses', 'profit', 'partner_amount', 'ul_amount'].forEach(k => { s[k] = r2((s[k] || 0) + r[k]); }); return s; }, {});
  return { partner: partners[0] || null, month: ym(monthIso), rows, totals: tot };
}

// ---------- дашборд ----------
async function dashboard() {
  const today = T.tashToday(0), m0 = today.slice(0, 7) + '-01', from = addMonths(m0, -12);
  const [p, tbl, ops, occ14, mkt] = await Promise.all([
    pl(from, m0), aptTable(m0),
    q('daily_ops?select=id,apartment_id,date,check_out_date,checked_in,checked_out,payment_total,payment_paid,source,guest_name&date=gte.' + addMonths(m0, -1) + '&order=date.desc&limit=400'),
    q('occupancy_daily?select=date,busy&busy=eq.true&date=gte.' + today + '&date=lt.' + T.tashToday(14) + '&limit=5000'),
    q('marketing_spend?select=spend_date,channel,amount_usd,tg_clicks,leads&spend_date=gte.' + m0)
  ]);
  const cur = p.months[p.months.length - 1], prev = p.months[p.months.length - 2] || {};
  const debt = ops.filter(o => n(o.payment_total) > n(o.payment_paid)).reduce((s, o) => s + n(o.payment_total) - n(o.payment_paid), 0);
  const inToday = ops.filter(o => o.date === today).length, outToday = ops.filter(o => o.check_out_date === today).length;
  const active = tbl.totals.active || 1;
  const occByDay = {}; occ14.forEach(o => { occByDay[o.date] = (occByDay[o.date] || 0) + 1; });
  const occ14arr = []; for (let i = 0; i < 14; i++) { const d = T.tashToday(i); occ14arr.push({ date: d, pct: Math.round(100 * (occByDay[d] || 0) / active) }); }
  const mktSum = mkt.reduce((s, x) => { s.amount += n(x.amount_usd); s.tg += n(x.tg_clicks); s.leads += n(x.leads); return s; }, { amount: 0, tg: 0, leads: 0 });
  return {
    today, month: ym(m0), current: cur, previous: prev, series: p.months, apartments: tbl.totals,
    top: tbl.rows.slice(0, 5).map(r => ({ short: r.short, revenue: r.revenue, net: r.net, occupancy: r.occupancy })),
    bottom: tbl.rows.filter(r => r.id && r.is_active).slice(-5).map(r => ({ short: r.short, revenue: r.revenue, net: r.net, occupancy: r.occupancy })),
    ops: { checkins_today: inToday, checkouts_today: outToday, debt: r2(debt), debtors: ops.filter(o => n(o.payment_total) > n(o.payment_paid)).slice(0, 10).map(o => ({ apt: o.apartment_id, date: o.date, guest: o.guest_name, due: r2(n(o.payment_total) - n(o.payment_paid)) })) },
    occupancy14: occ14arr, marketing: mktSum
  };
}

// ---------- операционка ----------
async function opsToday() {
  const today = T.tashToday(0);
  const [apts, ops, cl, occ] = await Promise.all([apartments(), q('daily_ops?select=*&or=(date.eq.' + today + ',check_out_date.eq.' + today + ',date.eq.' + T.tashToday(1) + ')&order=date'), q('cleaning_tasks?select=*&date=eq.' + today), q('occupancy_daily?select=apartment_id,date&busy=eq.true&date=gte.' + today + '&date=lt.' + T.tashToday(14) + '&limit=5000')]);
  const byApt = {}; apts.forEach(a => { byApt[a.id] = a.short; });
  const grid = {}; occ.forEach(o => { grid[o.apartment_id] = grid[o.apartment_id] || {}; grid[o.apartment_id][o.date] = 1; });
  return { today, checkins: ops.filter(o => o.date === today).map(o => Object.assign({ short: byApt[o.apartment_id] }, o)), checkouts: ops.filter(o => o.check_out_date === today).map(o => Object.assign({ short: byApt[o.apartment_id] }, o)), tomorrow: ops.filter(o => o.date === T.tashToday(1)).map(o => Object.assign({ short: byApt[o.apartment_id] }, o)), cleaning: cl.map(c => Object.assign({ short: byApt[c.apartment_id] }, c)), grid: apts.filter(a => a.is_active).map(a => ({ id: a.id, short: a.short, days: Array.from({ length: 14 }, (_, i) => (grid[a.id] || {})[T.tashToday(i)] ? 1 : 0) })), days: Array.from({ length: 14 }, (_, i) => T.tashToday(i)) };
}

// ---------- импорт из Google-таблиц (пока бронеры ведут выручку там) ----------
const SHEETS = { main: '1NHqPZV8Dx2dKmfTCpb8LcdA4AtuqSfKyyyWs5UF2HtY', partner: '191ila7T-7dUWUfITNffd7yjUDXqUBwAcfqLS52V_MhU' };
async function fetchCsv(bookId, sheetName, gid) {
  const url = 'https://docs.google.com/spreadsheets/d/' + bookId + '/gviz/tq?tqx=out:csv&' + (gid ? 'gid=' + gid : 'sheet=' + encodeURIComponent(sheetName));
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error('sheet ' + sheetName + ': ' + r.status);
  return r.text();
}
function parseCsvLine(l) { return (l.match(/("([^"]*)"|[^,]*)(,|$)/g) || []).map(c => c.replace(/,$/, '').replace(/^"|"$/g, '')); }
const numS = s => { if (!s) return 0; const v = parseFloat(String(s).replace(/[$\s %]/g, '').replace(',', '.')); return isNaN(v) ? 0 : v; };
function parseMonthlySheet(csv, isPartner) {
  const rows = csv.split('\n').map(parseCsvLine);
  const years = rows[0].slice(1); const months = []; let m = 0, prev = '';
  for (let i = 0; i < years.length; i++) { const y = (years[i] || '').trim(); if (!y) continue; if (y !== prev) { m = y === '2025' ? 12 : 1; prev = y; } if (m >= 1 && m <= 12) months.push({ i: i + 1, ym: y + '-' + String(m).padStart(2, '0') }); m++; }
  const out = []; let cur = null;
  for (const r of rows) {
    const nm = (r[0] || '').trim(); if (!nm) continue;
    if (/^(Количество|Итого|Год|Аппартамент)/.test(nm)) { if (/^(Количество|Итого)/.test(nm)) break; continue; }
    if (!/^(Аренда|Комиссия|Кол-во|Прибыль)/.test(nm)) { cur = { name: nm.replace(/\s+/g, ' '), rev: r }; out.push(cur); }
    else if (cur) { if (/^Аренда/.test(nm)) cur.rent = r; if (/^Комиссия/.test(nm)) cur.com = r; if (/^Кол-во/.test(nm)) cur.nig = r; if (/^Прибыль/.test(nm)) cur.pr = r; }
  }
  const recs = [];
  for (const a of out) for (const mo of months) {
    const rev = numS(a.rev[mo.i]), rent = numS((a.rent || [])[mo.i]), com = numS((a.com || [])[mo.i]), nig = numS((a.nig || [])[mo.i]), pr = numS((a.pr || [])[mo.i]);
    if (!rev && !rent && !pr && !nig) continue;
    recs.push({ apt_label: a.name, month: mo.ym + '-01', revenue: rev, rent, commission: com, nights: Math.round(nig), profit: pr, is_partner: !!isPartner, source: 'import' });
  }
  return recs;
}
async function importSheets() {
  const [m, p] = await Promise.all([fetchCsv(SHEETS.main, 'Месяц'), fetchCsv(SHEETS.partner, null, '1256424830')]);
  const recs = [...parseMonthlySheet(m, false), ...parseMonthlySheet(p, true)];
  // сопоставление с apartments через SQL-функцию admin3_map_apt (rpc) — проще: берём существующие сопоставления
  const known = await q('finance_monthly?select=apt_label,apartment_id&source=eq.import&apartment_id=not.is.null');
  const map = {}; known.forEach(k => { map[k.apt_label] = k.apartment_id; });
  recs.forEach(r => { r.apartment_id = map[r.apt_label] || null; r.updated_at = new Date().toISOString(); });
  let n = 0;
  for (let i = 0; i < recs.length; i += 200) {
    const r = await T.sb('finance_monthly?on_conflict=apt_label,month,source', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' }, body: JSON.stringify(recs.slice(i, i + 200)) });
    if (!r.ok) throw new Error('upsert: ' + (await r.text()).slice(0, 200));
    n += Math.min(200, recs.length - i);
  }
  // досопоставить новые названия с квартирами (SQL-функция admin3_map_apt)
  await T.sb('rpc/admin3_remap', { method: 'POST', body: '{}' });
  const still = await q('finance_monthly?select=apt_label&source=eq.import&apartment_id=is.null');
  return { ok: true, imported: n, months: [...new Set(recs.map(r => r.month))].sort(), unmapped: [...new Set(still.map(s => s.apt_label))] };
}

// ---------- запись ----------
async function write(body, user) {
  const a = body.a;
  if (a === 'import_sheets') return importSheets();
  if (a === 'expense') {
    const rec = { apartment_id: body.apartment_id || null, amount: n(body.amount), category: body.category || 'other', description: body.description || '', expense_date: body.expense_date || T.tashToday(0), currency: body.currency || 'USD', amount_uzs: body.amount_uzs ? n(body.amount_uzs) : null, partner_shared: !!body.partner_shared, vendor: body.vendor || '', paid_by: body.paid_by || '', created_by: user.email };
    if (body.id) { const r = await T.sb('expenses?id=eq.' + body.id, { method: 'PATCH', body: JSON.stringify(rec) }); return r.json(); }
    const r = await T.sb('expenses', { method: 'POST', body: JSON.stringify(rec) }); return r.json();
  }
  if (a === 'expense_delete') { await T.sb('expenses?id=eq.' + body.id, { method: 'DELETE' }); return { ok: true }; }
  if (a === 'term') {
    const rec = { apartment_id: body.apartment_id, valid_from: body.valid_from || monthStart(), valid_to: body.valid_to || null, model: body.model || 'sublease', rent: n(body.rent), partner_id: body.partner_id || null, partner_share: body.partner_share == null ? 50 : n(body.partner_share), mgmt_fee_pct: body.mgmt_fee_pct == null ? null : n(body.mgmt_fee_pct), deposit: n(body.deposit), launch_cost: n(body.launch_cost), lease_start: body.lease_start || null, lease_end: body.lease_end || null, owner_name: body.owner_name || '', owner_phone: body.owner_phone || '', notes: body.notes || '', updated_at: new Date().toISOString() };
    if (body.id) { const r = await T.sb('apartment_terms?id=eq.' + body.id, { method: 'PATCH', body: JSON.stringify(rec) }); return r.json(); }
    const r = await T.sb('apartment_terms', { method: 'POST', body: JSON.stringify(rec) }); return r.json();
  }
  if (a === 'term_delete') { await T.sb('apartment_terms?id=eq.' + body.id, { method: 'DELETE' }); return { ok: true }; }
  if (a === 'partner') {
    const rec = { name: body.name, phone: body.phone || '', email: body.email || '', telegram: body.telegram || '', default_share: body.default_share == null ? 50 : n(body.default_share), notes: body.notes || '', is_active: body.is_active !== false };
    if (body.id) { const r = await T.sb('partners?id=eq.' + body.id, { method: 'PATCH', body: JSON.stringify(rec) }); return r.json(); }
    const r = await T.sb('partners', { method: 'POST', body: JSON.stringify(rec) }); return r.json();
  }
  if (a === 'marketing') {
    const rec = { spend_date: body.spend_date, channel: body.channel, campaign: body.campaign || '', amount_usd: n(body.amount_usd), impressions: n(body.impressions), clicks: n(body.clicks), tg_clicks: n(body.tg_clicks), leads: n(body.leads), bookings: n(body.bookings), notes: body.notes || '' };
    const r = await T.sb('marketing_spend?on_conflict=spend_date,channel,campaign', { method: 'POST', headers: { Prefer: 'return=representation,resolution=merge-duplicates' }, body: JSON.stringify(rec) }); return r.json();
  }
  if (a === 'marketing_delete') { await T.sb('marketing_spend?id=eq.' + body.id, { method: 'DELETE' }); return { ok: true }; }
  if (a === 'finance') {
    const apt = body.apartment_id ? (await q('apartments?select=id,name,complex&id=eq.' + body.apartment_id))[0] : null;
    const label = body.apt_label || (apt ? (apt.complex + ' ' + String(apt.name).replace(/\D/g, '')) : null);
    if (!label) return { error: 'apartment_id or apt_label required' };
    const rec = { apartment_id: body.apartment_id || null, apt_label: label, month: monthStart(body.month), revenue: n(body.revenue), rent: n(body.rent), commission: n(body.commission), nights: n(body.nights), profit: n(body.revenue) - n(body.rent) - n(body.commission), is_partner: !!body.is_partner, source: 'manual', notes: body.notes || '', updated_at: new Date().toISOString() };
    const r = await T.sb('finance_monthly?on_conflict=apt_label,month,source', { method: 'POST', headers: { Prefer: 'return=representation,resolution=merge-duplicates' }, body: JSON.stringify(rec) }); return r.json();
  }
  if (a === 'finance_delete') { await T.sb('finance_monthly?id=eq.' + body.id, { method: 'DELETE' }); return { ok: true }; }
  if (a === 'cash') {
    const rec = { month: monthStart(body.month), opening: n(body.opening), closing: n(body.closing), closing_fact: body.closing_fact == null ? null : n(body.closing_fact), notes: body.notes || '' };
    const r = await T.sb('cash_monthly?on_conflict=month', { method: 'POST', headers: { Prefer: 'return=representation,resolution=merge-duplicates' }, body: JSON.stringify(rec) }); return r.json();
  }
  if (a === 'user' && user.role === 'admin') {
    const rec = { email: String(body.email || '').toLowerCase(), role: body.role || 'manager', name: body.name || '', partner_id: body.partner_id || null };
    const r = await T.sb('app_users?on_conflict=email', { method: 'POST', headers: { Prefer: 'return=representation,resolution=merge-duplicates' }, body: JSON.stringify(rec) }); return r.json();
  }
  return { error: 'unknown action' };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: H, body: '' };
  try {
    const user = await auth(event);
    if (!user) return out(401, { error: 'unauthorized' });
    const qs = event.queryStringParameters || {};
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (user.role === 'viewer' || (user.role === 'partner')) return out(403, { error: 'read only' });
      return out(200, await write(body, user));
    }
    const a = qs.a || 'me';
    const month = monthStart(qs.month);
    // партнёр видит только свой отчёт
    if (user.role === 'partner') {
      if (a === 'partner_report') return out(200, await partnerReport(user.partner_id, month));
      if (a === 'me') return out(200, user);
      return out(403, { error: 'partner access only' });
    }
    switch (a) {
      case 'me': return out(200, user);
      case 'dashboard': return out(200, await dashboard());
      case 'pl': { const from = monthStart(qs.from || ym(addMonths(month, -11))), to = monthStart(qs.to || ym(month)); return out(200, await pl(from, to)); }
      case 'apartments': return out(200, await aptTable(month));
      case 'apartment': return out(200, await aptHistory(qs.id));
      case 'expenses': { const f = ['select=*', 'order=expense_date.desc', 'limit=1000']; if (qs.month) { f.push('expense_date=gte.' + month, 'expense_date=lt.' + addMonths(month, 1)); } if (qs.apartment_id) f.push('apartment_id=eq.' + qs.apartment_id); return out(200, await q('expenses?' + f.join('&'))); }
      case 'categories': return out(200, await categories());
      case 'terms': return out(200, await termsAll());
      case 'partners': return out(200, await q('partners?select=*&order=name'));
      case 'partner_report': return out(200, await partnerReport(qs.partner_id, month));
      case 'marketing': { const from = monthStart(qs.from || ym(addMonths(month, -2))), to = monthStart(qs.to || ym(month)); return out(200, await q('marketing_spend?select=*&spend_date=gte.' + from + '&spend_date=lt.' + addMonths(to, 1) + '&order=spend_date.desc')); }
      case 'finance': return out(200, await q('finance_monthly?select=*&order=month.desc,apt_label&limit=2000' + (qs.month ? '&month=eq.' + month : '')));
      case 'cash': return out(200, await q('cash_monthly?select=*&order=month'));
      case 'ops': return out(200, await opsToday());
      case 'users': return out(200, user.role === 'admin' ? await q('app_users?select=*&order=email') : []);
      case 'apts': return out(200, await apartments());
      default: return out(400, { error: 'unknown action ' + a });
    }
  } catch (e) {
    return out(500, { error: String(e.message || e) });
  }
};
