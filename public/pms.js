// Urban Luxe — pms.js (11.10.2026). Шахматка /pms. API: pms-api.js. Спека: docs/superpowers/specs/2026-10-11-pms-core.md
(function () {
const SB_URL = 'https://sebvfvtofiysbywxjqut.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI';
const sb = supabase.createClient(SB_URL, SB_KEY);
const API = '/.netlify/functions/pms-api';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DAYMS = 86400000, iso = d => new Date(d).toISOString().slice(0, 10), addD = (s, k) => iso(new Date(s + 'T00:00:00Z').getTime() + k * DAYMS);
const nightsOf = (a, b) => Math.round((new Date(b) - new Date(a)) / DAYMS);
const DN = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'], MN = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const ruD = s => s ? s.slice(8, 10) + '.' + s.slice(5, 7) : '';
const money = (v, cur) => v == null ? '—' : (cur === 'RUB' ? '₽' : cur === 'UZS' ? '' : '$') + Math.round(v).toLocaleString('ru-RU') + (cur === 'UZS' ? ' сум' : '');
const ST = { request: ['Заявка', '#fde68a'], confirmed: ['Подтверждена', '#f8a5a0'], checked_in: ['Живёт', '#9ee0a8'], checked_out: ['Выехал', '#d6dae0'], cancelled: ['Отменена', '#f3c4c1'], blocked: ['Блок', '#b8bec7'] }; // как полосы в шахматке (стиль RC), текст тёмный
const CH = { telegram: 'Telegram', website: 'Сайт', manual: 'Бронер', rc: 'RC', ostrovok: 'Ostrovok', yandex: 'Яндекс', booking: 'Booking', airbnb: 'Airbnb', sutochno: 'Sutochno', walk_in: 'Без брони', corporate: 'Корпоратив', ota: 'OTA', other: 'Другое' };
const OTA = ['ostrovok', 'yandex', 'booking', 'airbnb', 'sutochno', 'ota', 'agoda', 'expedia'];
const toast = (m, ms) => { const t = $('#toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(t._t); t._t = setTimeout(() => t.style.display = 'none', ms || 2600); };

// ---------- auth / api ----------
let ME = null;
async function token() { const { data: { session } } = await sb.auth.getSession(); return session ? session.access_token : null; }
async function api(params, body) {
  const t = await token(); if (!t) { showLogin(); throw new Error('no session'); }
  const r = await fetch(API + (body ? '' : '?' + new URLSearchParams(params)), { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({ error: 'bad json' }));
  if (!r.ok || j.error) { if (r.status === 401) showLogin(); const e = new Error(j.error || r.status); e.status = r.status; throw e; }
  return j;
}
function showLogin() { $('#login').classList.remove('hide'); $('#app').classList.add('hide'); }
window.login = async () => { const er = $('#loginErr'); er.style.display = 'none'; const { error } = await sb.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#pass').value }); if (error) { er.textContent = 'Не удалось войти: ' + error.message; er.style.display = 'block'; return; } boot(); };
window.logout = async () => { await sb.auth.signOut(); location.reload(); };
$('#pass').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });

async function boot() {
  try { ME = await api({ a: 'me' }); } catch (e) { showLogin(); return; }
  $('#login').classList.add('hide'); $('#app').classList.remove('hide');
  $('#me').textContent = (ME.org ? ME.org.name + ' · ' : '') + ME.name + ' · ' + ME.role;
  if (!ME.can.rates) $$('#top nav button[data-v=rules]').forEach(b => b.remove());
  if (ME.role !== 'admin') $$('#top nav button[data-v=channels]').forEach(b => b.remove());
  if (!ME.can.guests) $$('button[data-v=guests]').forEach(b => b.remove());
  if (!ME.can.pay) $$('button[data-v=debts]').forEach(b => b.remove());
  $$('[data-v]').forEach(b => b.onclick = () => go(b.dataset.v));
  realtime();
  go(innerWidth < 760 ? 'today' : 'cal');
}
const isMobile = () => innerWidth < 760;
let VIEW = 'cal';
function go(v) { VIEW = v; $$('[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === v)); closeDrawer(); hidePop(); ($('#main').innerHTML = ''); $('#tools').innerHTML = ''; (VIEWS[v] || VIEWS.cal)(); }
const VIEWS = {};

// =====================================================================
// ШАХМАТКА
// =====================================================================
let FROM = addD(iso(Date.now() + 5 * 36e5), -14), TO = addD(FROM, 90), G = null, COMPLEX = '', FLOOR = '', FREEQ = null, SEARCH = '', SHOWPRICE = localStorage.pms_prices !== '0', COLL = JSON.parse(localStorage.pms_coll || '{}');
let SEL = null;        // выделение: {apts:[], from, to}
let RATES = {};        // 'apt|date' → rate
let CLEAN = {};        // 'apt|date' → task
const hoursOf = (t, def) => { const m = String(t || '').match(/^(\d{1,2})(?::(\d{2}))?/); if (!m) return def; const h = +m[1] + (+m[2] || 0) / 60; return h >= 0 && h <= 24 ? h : def; };
const cellW = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cell')) || 34;

VIEWS.cal = async () => {
  $('#tools').innerHTML = `
    <button class="sm" id="prev">‹</button><button class="sm" id="tod">сегодня</button><button class="sm" id="next">›</button>
    <input type="date" id="from" value="${FROM}" class="desk">
    <select id="cx"><option value="">все ЖК</option></select>
    <select id="fl" class="desk"><option value="">этаж</option></select>
    <span class="desk" style="display:flex;gap:4px;align-items:center;font-size:12px"><span class="muted">свободно</span><input type="date" id="fq1" style="width:128px"><input type="date" id="fq2" style="width:128px"><button class="sm" id="fqx" title="сбросить">✕</button></span>
    <input id="q" placeholder="гость / телефон / № брони" style="width:170px">
    <button class="sm desk" id="tp">${SHOWPRICE ? 'скрыть цены' : 'показать цены'}</button>
    ${ME.can.write ? '<button class="sm pri" id="nb">+ бронь</button>' : ''}
    <span class="muted desk" id="cnt"></span>
    <span class="desk" style="display:flex;gap:2px;margin-left:4px"><button class="sm" id="zm" title="мельче">−</button><button class="sm" id="zp" title="крупнее">+</button></span>`;
  $('#main').innerHTML = '<div id="wrap"><div id="chess"></div></div><div id="pop" class="hide"></div>';
  $('#prev').onclick = () => shift(-14); $('#next').onclick = () => shift(14); $('#tod').onclick = () => { FROM = addD(G.today, -7); TO = addD(FROM, 90); load(); };
  $('#from').onchange = e => { FROM = e.target.value; TO = addD(FROM, 90); load(); };
  $('#cx').onchange = e => { COMPLEX = e.target.value; render(); }; $('#fl').onchange = e => { FLOOR = e.target.value; render(); };
  $('#fq1').onchange = $('#fq2').onchange = () => { const a = $('#fq1').value, b = $('#fq2').value; FREEQ = a && b && b > a ? [a, b] : null; render(); };
  $('#fqx').onclick = () => { $('#fq1').value = ''; $('#fq2').value = ''; FREEQ = null; render(); };
  $('#q').oninput = e => { SEARCH = e.target.value.trim().toLowerCase(); render(); };
  $('#tp').onclick = () => { SHOWPRICE = !SHOWPRICE; localStorage.pms_prices = SHOWPRICE ? '1' : '0'; $('#tp').textContent = SHOWPRICE ? 'скрыть цены' : 'показать цены'; render(); };
  if ($('#nb')) $('#nb').onclick = () => openBooking(null, { check_in: G.today, check_out: addD(G.today, 1) });
  // масштаб: три ступени, запоминается
  const ZOOMS = [[28, 34, 10], [32, 38, 11], [38, 44, 12]]; let zi = Math.min(2, Math.max(0, Number(localStorage.pms_zoom ?? 1)));
  const applyZoom = () => { const z = ZOOMS[zi]; const r = document.documentElement.style; r.setProperty('--cell', z[0] + 'px'); r.setProperty('--row', z[1] + 'px'); r.setProperty('--fs', z[2] + 'px'); localStorage.pms_zoom = zi; };
  if (!isMobile()) applyZoom();
  $('#zm').onclick = () => { if (zi > 0) { zi--; applyZoom(); render(); } }; $('#zp').onclick = () => { if (zi < 2) { zi++; applyZoom(); render(); } };
  await load();
};
function shift(k) { FROM = addD(FROM, k); TO = addD(FROM, 90); load(); }
async function load(silent) {
  if (!silent) $('#chess').innerHTML = '<div style="padding:20px" class="muted">загрузка…</div>';
  try { G = await api({ a: 'grid', from: FROM, to: TO }); } catch (e) { $('#chess').innerHTML = '<div style="padding:20px">Ошибка: ' + esc(e.message) + '</div>'; return; }
  const cmin = {}; G.apartments.forEach(a => { if (a.catalog_no) cmin[a.complex] = Math.min(cmin[a.complex] || 999, a.catalog_no); });
  G.apartments.sort((a, b) => ((cmin[a.complex] || 999) - (cmin[b.complex] || 999)) || a.complex.localeCompare(b.complex) || ((a.catalog_no || 999) - (b.catalog_no || 999)) || (a.floor || 0) - (b.floor || 0));
  RATES = {}; G.rates.forEach(r => RATES[r.apartment_id + '|' + r.date] = r);
  CLEAN = {}; G.cleaning.forEach(c => CLEAN[c.apartment_id + '|' + c.date] = c);
  const cx = $('#cx'); if (cx && cx.options.length <= 1) [...new Set(G.apartments.map(a => a.complex))].forEach(c => cx.add(new Option(c, c)));
  const fl = $('#fl'); if (fl && fl.options.length <= 1) [...new Set(G.apartments.map(a => a.floor).filter(Boolean))].sort((a, b) => a - b).forEach(f => fl.add(new Option(f + ' эт.', f)));
  const sc = $('#wrap') ? $('#wrap').scrollLeft : 0;
  render();
  if (!silent) { const idx = Math.max(0, nightsOf(FROM, G.today) - 3); $('#wrap').scrollLeft = idx * cellW(); } else $('#wrap').scrollLeft = sc;
}
function visibleApts() {
  let apts = G.apartments;
  if (COMPLEX) apts = apts.filter(a => a.complex === COMPLEX);
  if (FLOOR) apts = apts.filter(a => String(a.floor) === String(FLOOR));
  if (FREEQ) { const n = nightsOf(FREEQ[0], FREEQ[1]); apts = apts.filter(a => { for (let i = 0; i < n; i++) { const r = RATES[a.id + '|' + addD(FREEQ[0], i)]; if (!r || !r.available) return false; } return true; }); }
  if (SEARCH) { const ids = new Set(G.bookings.filter(b => [b.guest_name, b.guest_phone, b.guest_telegram, b.id, b.external_id].some(x => String(x || '').toLowerCase().includes(SEARCH))).map(b => b.apartment_id)); apts = apts.filter(a => ids.has(a.id)); }
  return apts;
}
function render() {
  const days = []; for (let d = FROM; d < TO; d = addD(d, 1)) days.push(d);
  const today = G.today, apts = visibleApts();
  const byApt = {}; G.bookings.forEach(b => (byApt[b.apartment_id] = byApt[b.apartment_id] || []).push(b));
  let h = `<div class="hd hd-apt">Квартира</div><div class="hd hd-days">` + days.map(d => { const x = new Date(d + 'T00:00:00Z'), dow = x.getUTCDay(), we = dow === 5 || dow === 6; return `<div class="hd-day ${we ? 'we' : ''} ${d === today ? 'today' : ''}" data-d="${d}">${x.getUTCDate() === 1 || d === FROM ? '<span class="mo">' + MN[x.getUTCMonth()] + '</span>' : ''}<b>${x.getUTCDate()}</b>${DN[dow]}</div>`; }).join('') + `</div>`;
  let lastC = '';
  for (const a of apts) {
    if (a.complex !== lastC) { lastC = a.complex; const n = apts.filter(x => x.complex === a.complex).length; h += `<div class="grp" data-c="${esc(a.complex)}"><span class="gt">${COLL[a.complex] ? '▸' : '▾'} ${esc(a.complex)}<span>${n}</span></span></div>`; }
    if (COLL[a.complex]) continue;
    h += `<div class="apt" title="${esc(a.name)}"><div class="n">${a.catalog_no ? '<span class="no">' + a.catalog_no + '</span>' : ''}${esc(a.name)}</div><div class="s">${a.floor ? a.floor + ' эт.' : ''}${a.rooms ? ' · ' + esc(a.rooms) : ''}${a.max_guests ? ' · до ' + a.max_guests : ''}</div></div>`;
    h += `<div class="row" data-apt="${a.id}">`;
    h += days.map(d => {
      const r = RATES[a.id + '|' + d] || {}, x = new Date(d + 'T00:00:00Z').getUTCDay(), we = x === 5 || x === 6, c = CLEAN[a.id + '|' + d];
      const cls = ['c', we ? 'we' : '', d === today ? 'today' : '', r.closed ? 'closed' : '', !r.closed && r.closed_to_arrival ? 'cta' : ''].join(' ');
      const pr = SHOWPRICE && r.price != null && !r.booking_id ? `<span class="${r.source === 'override' ? 'ov' : ''}">${r.price}</span>` : '';
      const mn = r.min_nights > 1 ? `<span class="mn">${r.min_nights}+</span>` : '';
      const cl = c && c.hk_status !== 'canceled' ? `<span class="cl ${c.done ? 'ok' : d < today ? 'no' : 'plan'}" title="${c.done ? 'убрано' : d < today ? 'не убрано' : 'уборка запланирована'}${c.hk_maid ? ' · ' + esc(c.hk_maid) : ''}"></span>` : '';
      return `<div class="${cls}" data-apt="${a.id}" data-d="${d}">${pr}${mn}${cl}</div>`;
    }).join('');
    const bs = (byApt[a.id] || []).slice().sort((x, y) => x.check_in < y.check_in ? -1 : 1);
    bs.forEach((b, i) => {
      const s0 = nightsOf(FROM, b.check_in), e0 = nightsOf(FROM, b.check_out); if (e0 < 0 || s0 > days.length) return;
      const cut = s0 < 0, s = cut ? 0 : s0, e = Math.min(e0, days.length);
      // полоса ровно по границам дней (с начала дня заезда до начала дня выезда); поздний выезд (после 12:00) — скошенный хвост в день выезда, ранний заезд (до 12:00) — скошенная голова
      const late = !cut && e0 <= days.length && hoursOf(b.departure_time, 12) > 12, early = !cut && hoursOf(b.arrival_time, 14) < 12;
      const sf = early ? -0.45 : 0, ef = late ? 0.45 : 0;
      const left = (s + sf), width = (e + ef) - left; if (width <= 0) return;
      const nx = bs[i + 1]; const gap = nx && nx.check_in === b.check_out && (hoursOf(nx.arrival_time, 14) - hoursOf(b.departure_time, 12)) < 2;
      const ch = (b.channel || '').toLowerCase(); const ota = OTA.includes(ch);
      const sum = b.status === 'blocked' || b.occupancy_only ? '' : money(b.total_price, b.currency);
      // точка долга — только по нашим броням: у импорта из RC платежи не ведутся, иначе красное на всём
      const orgTag = b.foreign_org && !b.occupancy_only ? ' · ' + esc(b.org_short || '') : '';
      h += `<div class="bar ${b.occupancy_only ? 'foreign' : b.status} ${ota && !b.occupancy_only ? 'ota ch-' + ch : ''} ${b.debt > 0 && b.status !== 'blocked' && b.total_price > 0 && b.source !== 'rc' ? 'debt' : ''} ${gap ? 'gap' : ''} ${late ? 'late' : ''} ${early ? 'early' : ''}" data-id="${b.id}" draggable="${ME.can.write && b.status !== 'checked_out' && !b.occupancy_only}" style="left:calc(${left} * var(--cell));width:calc(${width} * var(--cell) - 3px)" title="${esc(b.guest_name)} · ${ruD(b.check_in)}–${ruD(b.check_out)} · ${sum}${gap ? ' · стык < 2 ч на уборку' : ''}">
        <div class="t">${cut ? '◂ ' : ''}${esc(b.guest_name)}</div><div class="s">${sum}${b.channel && b.channel !== 'manual' && b.channel !== 'telegram' && !b.occupancy_only ? ' · ' + (CH[ch] || b.channel) : ''}${b.guests_count > 1 && !b.occupancy_only ? ' · ' + b.guests_count + ' чел.' : ''}${orgTag}</div>
        ${late ? '<span class="lt">' + esc(String(b.departure_time).slice(0, 5)) + '</span>' : ''}${early ? '<span class="et">' + esc(String(b.arrival_time).slice(0, 5)) + '</span>' : ''}<div class="pay ${b.pay_state || ''}"></div></div>`;
    });
    h += `</div>`;
  }
  $('#chess').innerHTML = h; $('#chess').style.gridTemplateColumns = 'var(--aptw) ' + (days.length * cellW()) + 'px';
  if ($('#cnt')) $('#cnt').textContent = apts.length + ' кв.';
  bindGrid();
}
function bindGrid() {
  const chess = $('#chess');
  chess.querySelectorAll('.grp').forEach(g => g.onclick = () => { COLL[g.dataset.c] = !COLL[g.dataset.c]; localStorage.pms_coll = JSON.stringify(COLL); render(); });
  chess.querySelectorAll('.bar').forEach(b => {
    b.onclick = e => { e.stopPropagation(); openBooking(b.dataset.id); };
    b.ondragstart = e => { const bk = G.bookings.find(x => x.id === b.dataset.id); const cell = e.target.closest('.row'); const rect = b.getBoundingClientRect(); const off = Math.floor((e.clientX - rect.left) / cellW()); e.dataTransfer.setData('text/plain', JSON.stringify({ id: bk.id, off, nights: nightsOf(bk.check_in, bk.check_out) })); b.classList.add('dragging'); };
    b.ondragend = () => b.classList.remove('dragging');
  });
  chess.querySelectorAll('.row').forEach(r => {
    r.ondragover = e => { e.preventDefault(); r.classList.add('over'); }; r.ondragleave = () => r.classList.remove('over');
    r.ondrop = async e => { e.preventDefault(); r.classList.remove('over'); let d; try { d = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (_) { return; }
      const cell = document.elementFromPoint(e.clientX, e.clientY).closest('.c'); if (!cell) return;
      const ci = addD(cell.dataset.d, -d.off), co = addD(ci, d.nights), apt = r.dataset.apt; const bk = G.bookings.find(x => x.id === d.id);
      if (bk.apartment_id === apt && bk.check_in === ci) return;
      const a = G.apartments.find(x => x.id === apt);
      let pr = null; try { pr = await api({ a: 'price', apartment_id: apt, check_in: ci, check_out: co, channel: bk.channel || 'booker', exclude: bk.id }); } catch (_) { }
      const msg = `Перенести «${bk.guest_name}» → ${a.name}, ${ruD(ci)}–${ruD(co)}?` + (pr && pr.total && pr.total !== bk.total_price ? `\nЦена по прайсу ${money(pr.total)} (сейчас ${money(bk.total_price, bk.currency)}). Оставить текущую — ОК, пересчитать — отмена и правка в панели.` : '');
      if (!confirm(msg)) return;
      try { await api(null, { a: 'update', id: bk.id, apartment_id: apt, check_in: ci, check_out: co }); toast('Перенесено'); load(true); } catch (err) { alert(err.message); }
    };
  });
  // 12.10: зажатая левая кнопка + движение = прокрутка шахматки (как карта); клик по свободной клетке = выбор одной ночи;
  // Shift + протяжка = выделение диапазона дат (и нескольких квартир по вертикали)
  let drag = null, pan = null;
  const wrap = $('#wrap');
  chess.onmousedown = e => {
    if (e.button !== 0 || e.target.closest('.bar')) return;
    const c = e.target.closest('.c');
    if (c && e.shiftKey) { hidePop(); drag = { apt: c.dataset.apt, d0: c.dataset.d, d1: c.dataset.d, apts: [c.dataset.apt], shift: true }; paintSel(drag); e.preventDefault(); return; }
    pan = { x: e.clientX, y: e.clientY, sl: wrap.scrollLeft, st: wrap.scrollTop, moved: false, cell: c }; e.preventDefault();
  };
  chess.onmousemove = e => {
    if (pan) { const dx = e.clientX - pan.x, dy = e.clientY - pan.y; if (!pan.moved && Math.abs(dx) + Math.abs(dy) > 4) { pan.moved = true; chess.classList.add('panning'); } if (pan.moved) { wrap.scrollLeft = pan.sl - dx; wrap.scrollTop = pan.st - dy; } return; }
    if (!drag) return; const c = e.target.closest('.c'); if (!c) return; drag.d1 = c.dataset.d; const ids = visibleApts().map(a => a.id); const i0 = ids.indexOf(drag.apt), i1 = ids.indexOf(c.dataset.apt); drag.apts = ids.slice(Math.min(i0, i1), Math.max(i0, i1) + 1); paintSel(drag);
  };
  document.onmouseup = e => {
    if (pan) { const p = pan; pan = null; chess.classList.remove('panning'); if (!p.moved && p.cell) { hidePop(); SEL = { apts: [p.cell.dataset.apt], from: p.cell.dataset.d, to: addD(p.cell.dataset.d, 1) }; paintSel({ apt: SEL.apts[0], d0: SEL.from, d1: SEL.from, apts: SEL.apts }); showPop(e, SEL); } return; }
    if (!drag) return; const s = drag; drag = null; const from = s.d0 < s.d1 ? s.d0 : s.d1, to = addD(s.d0 < s.d1 ? s.d1 : s.d0, 1); SEL = { apts: s.apts, from, to }; showPop(e, SEL);
  };
  document.onmouseleave = () => { if (pan) { pan = null; chess.classList.remove('panning'); } };
  // мобильный тап по клетке — сразу бронь
  if (isMobile()) chess.onclick = e => { const c = e.target.closest('.c'); if (!c) return; SEL = { apts: [c.dataset.apt], from: c.dataset.d, to: addD(c.dataset.d, 1) }; showPop(e, SEL); };
}
function paintSel(s) { const from = s.d0 < s.d1 ? s.d0 : s.d1, to = s.d0 < s.d1 ? s.d1 : s.d0; $$('.c.sel').forEach(c => c.classList.remove('sel')); $$('.c').forEach(c => { if (s.apts.includes(c.dataset.apt) && c.dataset.d >= from && c.dataset.d <= to) c.classList.add('sel'); }); }
function hidePop() { const p = $('#pop'); if (p) p.classList.add('hide'); $$('.c.sel').forEach(c => c.classList.remove('sel')); }
async function showPop(e, s) {
  const p = $('#pop'); const n = nightsOf(s.from, s.to); const multi = s.apts.length > 1; const a = G.apartments.find(x => x.id === s.apts[0]);
  p.style.left = Math.max(8, Math.min(e.clientX + 8, innerWidth - 300)) + 'px'; p.style.top = Math.max(8, Math.min(e.clientY + 8, innerHeight - 150)) + 'px'; p.classList.remove('hide');
  const allFree = s.apts.every(id => { for (let i = 0; i < n; i++) { const r = RATES[id + '|' + addD(s.from, i)]; if (!r || !r.available) return false; } return true; });
  p.innerHTML = `<div class="b">${multi ? s.apts.length + ' квартир' : esc(a.name)}</div><div class="muted">${ruD(s.from)} – ${ruD(s.to)} · ${n} ноч.</div><div id="pp" class="big">${multi ? '' : '…'}</div><div class="btns"></div>`;
  const btns = p.querySelector('.btns');
  if (!multi) {
    let pr = null; try { pr = await api({ a: 'price', apartment_id: a.id, check_in: s.from, check_out: s.to, channel: 'booker' }); } catch (_) { }
    const pp = p.querySelector('#pp');
    if (pr && pr.total != null) pp.innerHTML = money(pr.total) + (pr.discount ? ` <span class="muted" style="font-size:11px;font-weight:400">${esc(pr.discount_label)} (−${money(pr.discount)})</span>` : '') + (pr.ok ? '' : ` <span style="color:var(--red);font-size:11px">${{ occupied: 'занято', closed: 'закрыто', closed_to_arrival: 'заезд запрещён', min_nights: 'мин. ' + pr.min_nights_required + ' ноч.', no_rate: 'нет цены' }[pr.reason] || pr.reason}</span>`);
    else pp.textContent = '—';
    if (ME.can.write && allFree) { btns.innerHTML += `<button class="sm pri" id="pb">Бронь</button><button class="sm" id="pk">Блок</button>`; }
    if (ME.can.write && allFree) { p.querySelector('#pb').onclick = () => { hidePop(); openBooking(null, { apartment_id: a.id, check_in: s.from, check_out: s.to, total_price: pr && pr.total }); }; p.querySelector('#pk').onclick = async () => { const note = prompt('Блок: причина (ремонт / собственник / …)', ''); if (note === null) return; try { await api(null, { a: 'block', apartment_id: a.id, check_in: s.from, check_out: s.to, notes: note }); hidePop(); toast('Заблокировано'); load(true); } catch (err) { alert(err.message); } }; }
  }
  if (ME.can.rates) { btns.innerHTML += `<button class="sm" id="pr">Цена / ограничения</button>`; p.querySelector('#pr').onclick = () => { hidePop(); openRateEditor(s); }; }
  btns.innerHTML += `<button class="sm" id="px">✕</button>`; p.querySelector('#px').onclick = hidePop;
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') { hidePop(); closeDrawer(); } });

// ---------- правка цен (override) ----------
function openRateEditor(s) {
  const names = s.apts.map(id => (G.apartments.find(a => a.id === id) || {}).name).join(', ');
  openDrawer('Цена и ограничения', `
    <div class="muted" style="margin-bottom:8px">${esc(names)}<br>${ruD(s.from)} – ${ruD(addD(s.to, -1))} включительно (${nightsOf(s.from, s.to)} дн.)</div>
    <div class="f"><label>Цена за ночь, $ <input id="r_price" type="number" min="0" placeholder="не менять"></label>
      <label>Мин. ночей <input id="r_min" type="number" min="1" placeholder="не менять"></label>
      <label>Закрыть продажу <select id="r_closed"><option value="">не менять</option><option value="1">закрыть</option><option value="0">открыть</option></select></label>
      <label>Заезд в эти даты <select id="r_cta"><option value="">не менять</option><option value="1">запретить</option><option value="0">разрешить</option></select></label>
      <label class="w">Заметка <input id="r_note" placeholder="почему"></label></div>
    <div class="muted" style="font-size:11px">Ручная правка побеждает сезонные правила. «Снять правки» возвращает цену по прайсу и правилам.</div>`,
    `<button class="pri" id="r_ok">Применить</button><button id="r_clear">Снять правки</button><button onclick="closeDrawer()">Отмена</button>`);
  $('#r_ok').onclick = async () => {
    const b = { a: 'rate_set', apartment_ids: s.apts, from: s.from, to: addD(s.to, -1), note: $('#r_note').value };
    if ($('#r_price').value !== '') b.price = $('#r_price').value; if ($('#r_min').value !== '') b.min_nights = $('#r_min').value;
    if ($('#r_closed').value !== '') b.closed = $('#r_closed').value === '1'; if ($('#r_cta').value !== '') b.closed_to_arrival = $('#r_cta').value === '1';
    if (b.price === undefined && b.min_nights === undefined && b.closed === undefined && b.closed_to_arrival === undefined) return alert('Ничего не задано');
    try { await api(null, b); closeDrawer(); toast('Применено'); load(true); } catch (e) { alert(e.message); }
  };
  $('#r_clear').onclick = async () => { if (!confirm('Снять все ручные правки на эти даты?')) return; try { await api(null, { a: 'rate_clear', apartment_ids: s.apts, from: s.from, to: addD(s.to, -1) }); closeDrawer(); toast('Снято'); load(true); } catch (e) { alert(e.message); } };
}

// =====================================================================
// ПАНЕЛЬ БРОНИ
// =====================================================================
function openDrawer(title, body, foot) { $('#d_title').textContent = title; $('#d_body').innerHTML = body; $('#d_foot').innerHTML = foot || ''; $('#drawer').classList.add('open'); }
window.closeDrawer = () => $('#drawer').classList.remove('open');
let CUR = null;
async function openBooking(id, preset) {
  if (id) { openDrawer('Бронь', '<div class="muted">загрузка…</div>'); try { CUR = await api({ a: 'booking', id }); } catch (e) { $('#d_body').innerHTML = 'Ошибка: ' + esc(e.message); return; } renderBooking(); }
  else { CUR = null; renderForm(preset || {}); }
}
function statusBadge(st) { const s = ST[st] || ST.confirmed; return `<span class="st" style="background:${s[1]}">${s[0]}</span>`; }
function renderBooking() {
  const b = CUR.booking, apt = (G && G.apartments.find(a => a.id === b.apartment_id)) || { name: b.apartment_name };
  const g = CUR.guest; const canW = ME.can.write && b.status !== 'cancelled' && !b.occupancy_only;
  if (b.occupancy_only) { openDrawer('Занято', `<div class="muted">Квартира партнёра: видна только занятость.</div><table class="t"><tr><td>Квартира</td><td class="b">${esc(apt.name)}</td></tr><tr><td>Даты</td><td class="b">${ruD(b.check_in)} → ${ruD(b.check_out)}</td></tr><tr><td>Организация</td><td>${esc(b.org_short || '')}</td></tr></table>`, '<button onclick="closeDrawer()">Закрыть</button>'); return; }
  const nights = nightsOf(b.check_in, b.check_out);
  let h = `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${statusBadge(b.status)}<span class="muted">${esc(CH[(b.channel || '').toLowerCase()] || b.channel || '')}${b.external_id ? ' · ' + esc(b.external_id) : ''}</span><span class="sp" style="flex:1"></span><span class="muted" style="font-size:11px">${esc(b.id.slice(0, 8))}</span></div>
    <h2 style="margin:8px 0 2px;font-size:17px">${esc(b.guest_name)}</h2>
    <div>${b.guest_phone ? '<a href="tel:' + esc(b.guest_phone) + '">' + esc(b.guest_phone) + '</a>' : ''}${b.guest_telegram ? ' · <a target="_blank" href="https://t.me/' + esc(String(b.guest_telegram).replace(/^@/, '').replace(/^\+/, '')) + '">' + esc(b.guest_telegram) + '</a>' : ''}${b.guest_whatsapp ? ' · WA ' + esc(b.guest_whatsapp) : ''}</div>`;
  if (g && (g.blacklisted || (g.tags || []).length || g.total_bookings > 1)) h += `<div style="margin:6px 0">${g.blacklisted ? '<span class="tag bad">чёрный список</span>' : ''}${(g.tags || []).map(t => '<span class="tag ' + (t === 'VIP' ? 'vip' : '') + '">' + esc(t) + '</span>').join('')}${g.total_bookings > 1 ? '<span class="tag">' + g.total_bookings + ' броней · ' + money(g.total_spent) + '</span>' : ''} <a href="#" id="g_open">карточка гостя</a></div>`;
  else if (g) h += `<div style="margin:6px 0"><a href="#" id="g_open">карточка гостя</a></div>`;
  if (g && g.blacklisted) h += `<div class="warn">Гость в чёрном списке${g.notes ? ': ' + esc(g.notes.split('\n').pop()) : ''}</div>`;
  h += `<div class="sec">Проживание</div>
    <table class="t"><tr><td>Квартира</td><td class="b">${esc(apt.name)}${apt.catalog_no ? ' <span class="no tag">№' + apt.catalog_no + '</span>' : ''}</td></tr>
    <tr><td>Даты</td><td class="b">${ruD(b.check_in)} ${esc(b.arrival_time || '14:00')} → ${ruD(b.check_out)} ${esc(b.departure_time || '12:00')} · ${nights} ноч.</td></tr>
    <tr><td>Гостей</td><td>${b.guests_count || 1}</td></tr>
    <tr><td>Цена</td><td class="b">${money(b.total_price, b.currency)}${nights ? ' <span class="muted">(' + money(b.total_price / nights, b.currency) + '/ночь)</span>' : ''}</td></tr>
    ${b.total_price > 0 ? (b.source === 'rc' && !(b.paid > 0) ? `<tr><td>Оплачено</td><td class="muted">учёт оплат — в RC (у нас платежей нет)</td></tr>` : `<tr><td>Оплачено</td><td><span class="b" style="color:${b.pay_state === 'paid' ? 'var(--green)' : b.pay_state === 'partial' ? '#b07a00' : 'var(--red)'}">${money(b.paid, b.currency)}</span>${b.debt > 0 ? ' · остаток <b style="color:var(--red)">' + money(b.debt, b.currency) + '</b>' : ' · ✓'}</td></tr>`) : ''}
    ${b.deposit ? `<tr><td>Депозит</td><td>${money(b.deposit, b.currency)}</td></tr>` : ''}
    ${b.notes ? `<tr><td>Заметки</td><td>${esc(b.notes)}</td></tr>` : ''}${b.admin_notes ? `<tr><td>Для своих</td><td>${esc(b.admin_notes)}</td></tr>` : ''}${b.client_notes ? `<tr><td>От гостя</td><td>${esc(b.client_notes)}</td></tr>` : ''}
    </table>`;
  if (ME.can.pay_full && b.status !== 'blocked') {
    h += `<div class="sec">Платежи<span class="sp"></span>${canW ? '<button class="sm" id="p_add">+ платёж</button>' : ''}</div>`;
    h += CUR.payments.length ? `<table class="t">` + CUR.payments.map(p => `<tr><td>${ruD(p.paid_at.slice(0, 10))}</td><td class="b">${p.kind === 'refund' ? '−' : ''}${money(p.amount, p.currency)}</td><td>${{ payment: 'оплата', prepayment: 'предоплата', deposit: 'депозит', refund: 'возврат', deposit_return: 'возврат депозита' }[p.kind] || p.kind} · ${{ cash: 'нал', card: 'карта', transfer: 'перевод', payme: 'Payme', click: 'Click', ota: 'площадка' }[p.method] || p.method}</td><td class="muted">${esc(p.received_by || '')}${p.note ? ' · ' + esc(p.note) : ''}</td><td>${canW ? '<button class="sm danger" data-pd="' + p.id + '">✕</button>' : ''}</td></tr>`).join('') + `</table>` : `<div class="muted">${b.prepaid ? 'Предоплата из RC: ' + money(b.prepaid, b.currency) : 'платежей нет'}</div>`;
  }
  h += `<div class="sec">Журнал</div>` + (CUR.events.length ? CUR.events.slice().reverse().map(ev => `<div class="ev"><span class="muted">${ev.created_at.slice(0, 16).replace('T', ' ')}</span> <b>${esc(ev.actor || '')}</b> ${esc(evText(ev))}</div>`).join('') : '<div class="muted">пусто</div>');
  let foot = '';
  if (canW || (ME.can.status_only && b.status !== 'blocked')) {
    const nx = { request: ['confirmed', 'Подтвердить'], confirmed: ['checked_in', 'Заехал'], checked_in: ['checked_out', 'Выехал'] }[b.status];
    if (nx) foot += `<button class="pri" data-st="${nx[0]}">${nx[1]}</button>`;
  }
  if (canW) foot += `<button id="b_edit">Изменить</button>` + (b.status !== 'checked_out' && b.status !== 'blocked' ? `<button class="danger" data-st="cancelled">Отменить</button>` : '') + (b.status === 'blocked' ? `<button class="danger" data-st="cancelled">Снять блок</button>` : '');
  openDrawer(b.status === 'blocked' ? 'Блок' : 'Бронь', h, foot);
  if ($('#g_open')) $('#g_open').onclick = e => { e.preventDefault(); openGuest(g.id); };
  if ($('#p_add')) $('#p_add').onclick = () => addPayment(b);
  $$('#d_body [data-pd]').forEach(x => x.onclick = async () => { if (!confirm('Удалить платёж?')) return; try { CUR = await api(null, { a: 'payment_delete', id: x.dataset.pd }); renderBooking(); load(true); } catch (e) { alert(e.message); } });
  $$('#d_foot [data-st]').forEach(x => x.onclick = () => setStatus(b, x.dataset.st));
  if ($('#b_edit')) $('#b_edit').onclick = () => renderForm(b);
}
function evText(ev) {
  const p = ev.payload || {};
  switch (ev.type) {
    case 'payment': return 'платёж ' + money(p.amount, p.currency) + ' (' + (p.method || '') + (p.kind && p.kind !== 'payment' ? ', ' + p.kind : '') + ')';
    case 'payment_delete': return 'удалил платёж ' + money(p.amount, p.currency);
    case 'price_change': return 'цена ' + money(p.from) + ' → ' + money(p.to);
    case 'price_manual': return 'цена ' + money(p.price) + ' при прайсе ' + money(p.list_price) + ' (' + (p.diff > 0 ? '+' : '') + money(p.diff) + ')';
    case 'moved': return 'перенос: ' + (p.from || []).join(' ') + ' → ' + (p.to || []).join(' ');
    case 'closed_with_debt': return 'закрыл с долгом ' + money(p.debt) + (p.reason ? ': ' + p.reason : '');
    default: return ev.type + (p.status ? ' → ' + (ST[p.status] || [p.status])[0] : '') + (p.from && p.to && typeof p.from === 'string' ? ' ' + p.from + ' → ' + p.to : '');
  }
}
async function setStatus(b, st) {
  if (st === 'cancelled' && !confirm(b.status === 'blocked' ? 'Снять блок?' : 'Отменить бронь «' + b.guest_name + '»?')) return;
  try { CUR = await api(null, { a: 'status', id: b.id, status: st }); toast('Статус: ' + ST[st][0]); renderBooking(); load(true); }
  catch (e) {
    if (String(e.message).startsWith('DEBT:')) { const debt = e.message.slice(5); const reason = prompt('Остаток ' + money(debt) + ' не оплачен. Закрыть бронь с долгом? Укажите причину:', ''); if (reason === null) return; try { CUR = await api(null, { a: 'status', id: b.id, status: st, close_with_debt: true, reason }); toast('Закрыто с долгом'); renderBooking(); load(true); } catch (e2) { alert(e2.message); } }
    else alert(e.message);
  }
}
function addPayment(b) {
  const left = Math.max(0, b.debt || 0);
  openDrawer('Платёж · ' + b.guest_name, `<div class="f">
    <label>Сумма <input id="p_amt" type="number" min="0" step="1" value="${left || ''}"></label>
    <label>Валюта <select id="p_cur"><option>USD</option><option>UZS</option><option>RUB</option></select></label>
    <label>Вид <select id="p_kind"><option value="payment">оплата</option><option value="prepayment">предоплата</option><option value="deposit">депозит</option><option value="deposit_return">возврат депозита</option><option value="refund">возврат</option></select></label>
    <label>Способ <select id="p_m"><option value="cash">наличные</option><option value="card">карта</option><option value="transfer">перевод</option><option value="payme">Payme</option><option value="click">Click</option><option value="ota">площадка</option></select></label>
    <label class="w">Комментарий <input id="p_note"></label></div><div class="muted">Цена ${money(b.total_price, b.currency)} · оплачено ${money(b.paid, b.currency)} · остаток ${money(left, b.currency)}</div>`,
    `<button class="pri" id="p_ok">Провести</button><button id="p_back">Назад</button>`);
  $('#p_cur').value = b.currency || 'USD';
  $('#p_ok').onclick = async () => { try { CUR = await api(null, { a: 'payment', booking_id: b.id, amount: $('#p_amt').value, currency: $('#p_cur').value, kind: $('#p_kind').value, method: $('#p_m').value, note: $('#p_note').value }); toast('Платёж проведён'); renderBooking(); load(true); } catch (e) { alert(e.message); } };
  $('#p_back').onclick = renderBooking;
}
// форма создания / правки
function renderForm(b) {
  const isNew = !b.id; const apts = (G ? G.apartments : []);
  openDrawer(isNew ? 'Новая бронь' : 'Изменить бронь', `<div class="f">
    <label class="w">Квартира <select id="f_apt">${apts.map(a => `<option value="${a.id}" ${a.id === b.apartment_id ? 'selected' : ''}>${a.catalog_no ? '№' + a.catalog_no + ' · ' : ''}${esc(a.name)}</option>`).join('')}</select></label>
    <label>Заезд <input id="f_ci" type="date" value="${b.check_in || ''}"></label><label>Выезд <input id="f_co" type="date" value="${b.check_out || ''}"></label>
    <label>Время заезда <input id="f_at" value="${esc(b.arrival_time || '14:00')}" placeholder="14:00"></label><label>Время выезда <input id="f_dt" value="${esc(b.departure_time || '12:00')}" placeholder="12:00"></label>
    <label class="w" style="position:relative">Телефон <input id="f_ph" value="${esc(b.guest_phone || '')}" placeholder="+998 …" autocomplete="off"><div id="f_hint" class="hint hide"></div></label>
    <label class="w">Имя гостя <input id="f_nm" value="${esc(b.guest_name === 'Гость' ? '' : b.guest_name || '')}"></label>
    <label>Telegram <input id="f_tg" value="${esc(b.guest_telegram || '')}" placeholder="@ник или номер"></label><label>WhatsApp <input id="f_wa" value="${esc(b.guest_whatsapp || '')}"></label>
    <label>Гостей <input id="f_gc" type="number" min="1" value="${b.guests_count || 1}"></label>
    <label>Канал <select id="f_ch">${['telegram', 'website', 'walk_in', 'corporate', 'booking', 'airbnb', 'ostrovok', 'yandex', 'sutochno', 'other'].map(c => `<option value="${c}" ${(b.channel || 'telegram') === c ? 'selected' : ''}>${CH[c]}</option>`).join('')}</select></label>
    <label>Цена, итого <input id="f_pr" type="number" min="0" value="${b.total_price || ''}"></label><label>Валюта <select id="f_cur">${['USD', 'UZS', 'RUB'].map(c => `<option ${(b.currency || 'USD') === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    <div class="w muted" id="f_list" style="grid-column:1/3;font-size:11px"></div>
    ${isNew ? `<label>Получено сейчас <input id="f_paid" type="number" min="0" placeholder="0"></label><label>Способ <select id="f_pm"><option value="cash">наличные</option><option value="card">карта</option><option value="transfer">перевод</option><option value="payme">Payme</option></select></label>` : ''}
    <label class="w">Заметки <textarea id="f_nt">${esc(b.notes || '')}</textarea></label>
    <label class="w">Для своих (гость не видит) <input id="f_an" value="${esc(b.admin_notes || '')}"></label>
    </div>`,
    `<button class="pri" id="f_ok">${isNew ? 'Создать' : 'Сохранить'}</button><button id="f_cancel">${isNew ? 'Отмена' : 'Назад'}</button>`);
  const recalc = async () => { const apt = $('#f_apt').value, ci = $('#f_ci').value, co = $('#f_co').value; if (!apt || !ci || !co || co <= ci) return; try { const pr = await api({ a: 'price', apartment_id: apt, check_in: ci, check_out: co, channel: $('#f_ch').value, exclude: b.id || '' }); $('#f_list').innerHTML = pr.total != null ? `По прайсу: <b>${money(pr.total)}</b>` + (pr.discount ? ' (' + esc(pr.discount_label) + ')' : '') + (pr.ok ? '' : ' · <span style="color:var(--red)">' + ({ occupied: 'даты заняты', closed: 'закрыто', closed_to_arrival: 'заезд запрещён', min_nights: 'мин. ' + pr.min_nights_required + ' ноч.' }[pr.reason] || pr.reason) + '</span>') + (isNew && !$('#f_pr').value ? '' : '') : '—'; if (isNew && (!$('#f_pr').value || $('#f_pr').dataset.auto === '1') && pr.total) { $('#f_pr').value = pr.total; $('#f_pr').dataset.auto = '1'; } } catch (_) { } };
  if (isNew && b.total_price) $('#f_pr').dataset.auto = '1';
  ['#f_apt', '#f_ci', '#f_co', '#f_ch'].forEach(s => $(s).onchange = recalc); $('#f_pr').oninput = () => { $('#f_pr').dataset.auto = '0'; }; recalc();
  // подсказка гостя по телефону/имени
  let ht; const hint = $('#f_hint');
  const lookup = async (q) => { if (!ME.can.guests || q.length < 3) { hint.classList.add('hide'); return; } try { const rows = await api({ a: 'guest_search', q }); if (!rows.length) { hint.classList.add('hide'); return; } hint.innerHTML = rows.map(g => `<div data-g='${esc(JSON.stringify(g))}'>${esc(g.name || '—')} · ${esc(g.phone || g.telegram || '')}${g.blacklisted ? ' <span class="tag bad">ЧС</span>' : ''}${g.total_bookings ? ' <span class="muted">' + g.total_bookings + ' бр.</span>' : ''}</div>`).join(''); hint.classList.remove('hide'); hint.querySelectorAll('div').forEach(d => d.onclick = () => { const g = JSON.parse(d.dataset.g); $('#f_ph').value = g.phone || ''; $('#f_nm').value = g.name || ''; $('#f_tg').value = g.telegram || ''; $('#f_wa').value = g.whatsapp || ''; $('#f_ph').dataset.gid = g.id; hint.classList.add('hide'); }); } catch (_) { } };
  $('#f_ph').oninput = e => { clearTimeout(ht); ht = setTimeout(() => lookup(e.target.value.trim()), 250); }; $('#f_nm').oninput = e => { clearTimeout(ht); ht = setTimeout(() => lookup(e.target.value.trim()), 250); };
  document.addEventListener('click', e => { if (!e.target.closest('#f_hint') && !e.target.closest('#f_ph')) hint.classList.add('hide'); }, { once: true });
  $('#f_cancel').onclick = () => isNew ? closeDrawer() : renderBooking();
  $('#f_ok').onclick = async () => {
    const o = { apartment_id: $('#f_apt').value, check_in: $('#f_ci').value, check_out: $('#f_co').value, arrival_time: $('#f_at').value, departure_time: $('#f_dt').value, guest_phone: $('#f_ph').value.trim(), guest_name: $('#f_nm').value.trim() || 'Гость', guest_telegram: $('#f_tg').value.trim(), guest_whatsapp: $('#f_wa').value.trim(), guests_count: +$('#f_gc').value || 1, channel: $('#f_ch').value, total_price: +$('#f_pr').value || 0, currency: $('#f_cur').value, notes: $('#f_nt').value, admin_notes: $('#f_an').value };
    if ($('#f_ph').dataset.gid) o.guest_id = $('#f_ph').dataset.gid;
    if (!o.apartment_id || !o.check_in || !o.check_out || o.check_out <= o.check_in) return alert('Проверьте квартиру и даты');
    if (!o.guest_phone && !o.guest_telegram && o.channel !== 'walk_in' && !confirm('Нет ни телефона, ни Telegram. Создать всё равно?')) return;
    try {
      if (isNew) { if ($('#f_paid').value) { o.paid_now = +$('#f_paid').value; o.paid_method = $('#f_pm').value; } CUR = await api(null, Object.assign({ a: 'create' }, o)); toast('Бронь создана'); }
      else { CUR = await api(null, Object.assign({ a: 'update', id: b.id }, o)); toast('Сохранено'); }
      renderBooking(); if (G) load(true);
    } catch (e) { alert(e.message); }
  };
}
window.openBooking = openBooking;

// =====================================================================
// ГОСТИ
// =====================================================================
async function openGuest(id) {
  openDrawer('Гость', '<div class="muted">загрузка…</div>');
  let d; try { d = await api({ a: 'guest', id }); } catch (e) { $('#d_body').innerHTML = esc(e.message); return; }
  const g = d.guest; const canW = ME.can.guests_write;
  const TAGS = ['VIP', 'корпоративный', 'постоянный', 'шумный', 'долг'];
  let h = `<h2 style="margin:0 0 4px;font-size:17px">${esc(g.name || '—')}</h2>
    <div>${g.phone ? '<a href="tel:' + esc(g.phone) + '">' + esc(g.phone) + '</a>' : ''}${g.telegram ? ' · <a target="_blank" href="https://t.me/' + esc(String(g.telegram).replace(/^@/, '')) + '">' + esc(g.telegram) + '</a>' : ''}${g.whatsapp ? ' · WA ' + esc(g.whatsapp) : ''}${g.email ? ' · ' + esc(g.email) : ''}</div>
    <div class="kpi" style="margin-top:8px"><div><b>${g.total_bookings}</b>броней</div><div><b>${money(g.total_spent)}</b>за всё время</div><div><b>${g.last_stay ? ruD(g.last_stay) : '—'}</b>последний визит</div></div>`;
  if (canW) h += `<div class="f"><label>Язык <select id="g_lang"><option value="">—</option>${['ru', 'uz', 'en', 'kz', 'tr', 'other'].map(l => `<option ${g.lang === l ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label>Гражданство <input id="g_cit" value="${esc(g.citizenship || '')}"></label>
    <label class="w">Теги <div>${TAGS.map(t => `<label style="display:inline-flex;flex-direction:row;gap:3px;margin-right:8px;font-size:12px;color:var(--text)"><input type="checkbox" data-tag="${t}" ${(g.tags || []).includes(t) ? 'checked' : ''}>${t}</label>`).join('')}</div></label>
    <label style="flex-direction:row;gap:6px;align-items:center;color:var(--text)"><input type="checkbox" id="g_doc" ${g.doc_verified ? 'checked' : ''}>документ проверен</label>
    <label style="flex-direction:row;gap:6px;align-items:center;color:var(--red)"><input type="checkbox" id="g_bl" ${g.blacklisted ? 'checked' : ''}>чёрный список</label></div>`;
  else h += `<div>${(g.tags || []).map(t => '<span class="tag">' + esc(t) + '</span>').join('')}${g.blacklisted ? '<span class="tag bad">чёрный список</span>' : ''}${g.doc_verified ? '<span class="tag">документ ✓</span>' : ''}</div>`;
  h += `<div class="sec">Заметки</div><div style="white-space:pre-wrap;font-size:12px">${esc(g.notes || '—')}</div>` + (canW ? `<div style="display:flex;gap:6px;margin-top:6px"><input id="g_note" placeholder="добавить заметку" style="flex:1"><button class="sm" id="g_addn">+</button></div>` : '');
  h += `<div class="sec">Брони</div>` + (d.bookings.length ? `<table class="t">` + d.bookings.map(b => `<tr style="cursor:pointer" data-b="${b.id}"><td>${ruD(b.check_in)}–${ruD(b.check_out)}</td><td>${esc(b.apartment_name)}</td><td class="b">${money(b.total_price, b.currency)}</td><td>${statusBadge(b.status)}</td><td>${b.pay_state === 'paid' ? '✓' : b.pay_state === 'partial' ? '<span style="color:#b07a00">частично</span>' : b.pay_state === 'unpaid' ? '<span style="color:var(--red)">не опл.</span>' : ''}</td></tr>`).join('') + `</table>` : '<div class="muted">нет</div>');
  openDrawer('Гость', h, canW ? `<button class="pri" id="g_save">Сохранить</button><button onclick="closeDrawer()">Закрыть</button>` : `<button onclick="closeDrawer()">Закрыть</button>`);
  $$('#d_body [data-b]').forEach(r => r.onclick = () => openBooking(r.dataset.b));
  if (canW) {
    const save = async (extra) => { const tags = $$('#d_body [data-tag]:checked').map(x => x.dataset.tag); try { await api(null, Object.assign({ a: 'guest_update', id: g.id, lang: $('#g_lang').value || null, citizenship: $('#g_cit').value, tags, doc_verified: $('#g_doc').checked, blacklisted: $('#g_bl').checked }, extra || {})); toast('Сохранено'); openGuest(g.id); } catch (e) { alert(e.message); } };
    $('#g_save').onclick = () => save(); $('#g_addn').onclick = () => { const n = $('#g_note').value.trim(); if (n) save({ note: n }); };
  }
}
VIEWS.guests = () => {
  $('#tools').innerHTML = `<input id="gq" placeholder="имя, телефон, Telegram или № брони" style="width:min(420px,80vw)" autofocus>`;
  $('#main').innerHTML = `<div class="page"><div class="card" id="gl"><div class="muted">Введите минимум 3 символа</div></div></div>`;
  let t; $('#gq').oninput = e => { clearTimeout(t); t = setTimeout(async () => { const q = e.target.value.trim(); if (q.length < 3) return; try { const rows = await api({ a: 'guest_search', q }); $('#gl').innerHTML = rows.length ? rows.map(g => `<div class="li" data-g="${g.id}"><div class="g"><div class="n">${esc(g.name || '—')}${g.blacklisted ? ' <span class="tag bad">ЧС</span>' : ''}${(g.tags || []).map(t => ' <span class="tag">' + esc(t) + '</span>').join('')}</div><div class="s">${esc(g.phone || '')}${g.telegram ? ' · ' + esc(g.telegram) : ''} · ${g.total_bookings} бр. · ${money(g.total_spent)}${g.last_stay ? ' · был ' + ruD(g.last_stay) : ''}</div></div></div>`).join('') : '<div class="muted">не найдено</div>'; $$('#gl [data-g]').forEach(x => x.onclick = () => openGuest(x.dataset.g)); } catch (err) { $('#gl').innerHTML = esc(err.message); } }, 250); };
  $('#gq').focus();
};

// =====================================================================
// СЕГОДНЯ / СВОБОДНО / ДОЛГИ / ЦЕНЫ
// =====================================================================
const bookLine = (b, extra) => `<div class="li" data-b="${b.id}"><span class="no">${(G && (G.apartments.find(a => a.id === b.apartment_id) || {}).catalog_no) || ''}</span><div class="g"><div class="n">${esc(b.apartment_name)} · ${esc(b.guest_name)}</div><div class="s">${ruD(b.check_in)} ${esc(b.arrival_time || '')} → ${ruD(b.check_out)} ${esc(b.departure_time || '')} · ${money(b.total_price, b.currency)}${b.total_price > 0 ? (b.source === 'rc' && !(b.paid > 0) ? '' : b.debt > 0 ? ' · <span style="color:var(--red)">остаток ' + money(b.debt, b.currency) + '</span>' : ' · оплачено') : ''}${b.guest_phone ? ' · ' + esc(b.guest_phone) : ''}</div></div>${extra || ''}</div>`;
VIEWS.today = async () => {
  $('#main').innerHTML = '<div class="page"><div class="muted">загрузка…</div></div>';
  let d; try { d = await api({ a: 'today' }); if (!G) G = { today: d.date, apartments: await api({ a: 'grid', from: d.date, to: addD(d.date, 1) }).then(g => g.apartments) }; } catch (e) { $('#main').innerHTML = '<div class="page">' + esc(e.message) + '</div>'; return; }
  const btn = (b, st, label) => (ME.can.write || ME.can.status_only) ? `<button class="sm pri" data-st="${st}" data-b="${b.id}">${label}</button>` : '';
  const cl = d.cleaning.filter(c => c.date === d.date && c.hk_status !== 'canceled');
  const sec = (title, arr, f) => `<div class="card"><h3>${title} <span class="muted">${arr.length}</span></h3>${arr.length ? arr.map(f).join('') : '<div class="muted">—</div>'}</div>`;
  $('#main').innerHTML = `<div class="page"><div class="kpi"><div><b>${d.checkins.length}</b>заездов</div><div><b>${d.checkouts.length}</b>выездов</div><div><b>${d.inhouse.length}</b>живут</div><div><b>${d.debts.filter(b => !(b.source === 'rc' && !(b.paid > 0))).length}</b>с долгом</div><div><b>${cl.filter(c => !c.done).length}</b>не убрано</div></div>
    ${sec('Выезды сегодня', d.checkouts, b => bookLine(b, b.status !== 'checked_out' ? btn(b, 'checked_out', 'Выехал') : '<span class="tag">выехал</span>'))}
    ${sec('Заезды сегодня', d.checkins, b => bookLine(b, b.status === 'checked_in' ? '<span class="tag">заехал</span>' : btn(b, 'checked_in', 'Заехал')))}
    ${sec('Живут', d.inhouse.filter(b => b.check_in !== d.date), b => bookLine(b))}
    ${sec('Заезды завтра', d.tomorrow, b => bookLine(b))}
    ${cl.length ? sec('Уборки сегодня', cl, c => `<div class="li"><div class="g"><div class="n">${esc((G.apartments.find(a => a.id === c.apartment_id) || { name: c.apartment_id }).name)}</div><div class="s">${c.done ? '✓ убрано' : 'не убрано'}${c.hk_maid ? ' · ' + esc(c.hk_maid) : ''}${c.hk_status ? ' · ' + esc(c.hk_status) : ''}</div></div></div>`) : ''}</div>`;
  $$('#main .li[data-b] .g').forEach(x => x.onclick = () => openBooking(x.parentElement.dataset.b));
  $$('#main [data-st]').forEach(x => x.onclick = async e => { e.stopPropagation(); const b = [...d.checkins, ...d.checkouts].find(y => y.id === x.dataset.b); CUR = { booking: b, payments: [], events: [] }; await setStatus(b, x.dataset.st); VIEWS.today(); });
};
VIEWS.free = async () => {
  const t0 = G ? G.today : iso(Date.now() + 5 * 36e5);
  $('#tools').innerHTML = `<input type="date" id="q1" value="${t0}"><input type="date" id="q2" value="${addD(t0, 1)}"><input type="number" id="qg" placeholder="гостей" style="width:80px" min="1"><button class="pri sm" id="qgo">Показать</button><button class="sm" id="qcopy">Скопировать список</button>`;
  $('#main').innerHTML = '<div class="page"><div class="card" id="fl2"><div class="muted">выберите даты</div></div></div>';
  const run = async () => { const ci = $('#q1').value, co = $('#q2').value; if (!ci || !co || co <= ci) return; $('#fl2').innerHTML = '<div class="muted">считаю…</div>'; try { const d = await api({ a: 'free', check_in: ci, check_out: co, guests: $('#qg').value || '' }); window._free = d; $('#fl2').innerHTML = `<h3>Свободно ${ruD(ci)} → ${ruD(co)} · ${d.nights} ноч. · ${d.free.length} кв.</h3>` + (d.free.length ? d.free.map(a => `<div class="li" data-a="${a.id}"><span class="no">${a.catalog_no || '—'}</span><div class="g"><div class="n">${esc(a.name)}</div><div class="s">${a.floor ? a.floor + ' эт. · ' : ''}${esc(a.rooms || '')}${a.max_guests ? ' · до ' + a.max_guests : ''}${a.discount_label ? ' · ' + esc(a.discount_label) : ''}</div></div><div class="b nowrap">${money(a.total)}</div>${ME.can.write ? '<button class="sm pri">Бронь</button>' : ''}</div>`).join('') : '<div class="muted">всё занято</div>'); $$('#fl2 .li').forEach(x => { const a = d.free.find(y => y.id === x.dataset.a); const bt = x.querySelector('button'); if (bt) bt.onclick = () => openBooking(null, { apartment_id: a.id, check_in: ci, check_out: co, total_price: a.total }); }); } catch (e) { $('#fl2').innerHTML = esc(e.message); } };
  $('#qgo').onclick = run; $('#q1').onchange = $('#q2').onchange = run;
  $('#qcopy').onclick = () => { const d = window._free; if (!d) return; const txt = 'Свободно ' + ruD(d.check_in) + '–' + ruD(d.check_out) + ' (' + d.nights + ' ноч.):\n' + d.free.map(a => (a.catalog_no ? '№' + a.catalog_no + ' ' : '') + a.name + ' — ' + money(a.total)).join('\n'); navigator.clipboard.writeText(txt).then(() => toast('Скопировано')); };
  run();
};
VIEWS.debts = async () => {
  $('#main').innerHTML = '<div class="page"><div class="muted">загрузка…</div></div>';
  let rows; try { rows = (await api({ a: 'debts' })).filter(b => !(b.source === 'rc' && !(b.paid > 0))); /* импорт из RC без платежей — не долг, а отсутствие учёта */ if (!G) G = { today: iso(Date.now() + 5 * 36e5), apartments: [] }; } catch (e) { $('#main').innerHTML = '<div class="page">' + esc(e.message) + '</div>'; return; }
  const sum = rows.filter(b => b.currency === 'USD').reduce((s, b) => s + b.debt, 0);
  $('#main').innerHTML = `<div class="page"><div class="kpi"><div><b>${rows.length}</b>броней с остатком</div><div><b>${money(sum)}</b>всего (USD)</div></div><div class="card">${rows.length ? `<table class="t"><tr><th>Гость</th><th>Квартира</th><th>Даты</th><th>Цена</th><th>Остаток</th><th>Статус</th><th>Дней</th></tr>` + rows.map(b => `<tr style="cursor:pointer" data-b="${b.id}"><td class="b">${esc(b.guest_name)}<br><span class="muted">${esc(b.guest_phone || '')}</span></td><td>${esc(b.apartment_name)}</td><td class="nowrap">${ruD(b.check_in)}–${ruD(b.check_out)}</td><td>${money(b.total_price, b.currency)}</td><td class="b" style="color:var(--red)">${money(b.debt, b.currency)}</td><td>${statusBadge(b.status)}</td><td>${b.days > 0 ? b.days : ''}</td></tr>`).join('') + '</table>' : '<div class="muted">долгов нет</div>'}</div></div>`;
  $$('#main [data-b]').forEach(r => r.onclick = () => openBooking(r.dataset.b));
};
VIEWS.rules = async () => {
  $('#tools').innerHTML = `<button class="pri sm" id="nr">+ правило</button><span class="muted">Сезоны, акции, ограничения и наценки каналов. Ручные правки конкретных дней делаются в шахматке.</span>`;
  $('#main').innerHTML = '<div class="page"><div class="card" id="rl">загрузка…</div></div>';
  if (!G) try { G = await api({ a: 'grid', from: iso(Date.now()), to: addD(iso(Date.now()), 1) }); } catch (_) { G = { apartments: [] }; }
  const KIND = { multiplier: '× множитель', fixed: 'фикс. цена', delta: '± к цене', restriction: 'ограничение', long_stay: 'скидка от N ночей', channel_markup: 'наценка канала' };
  const list = async () => { const rows = await api({ a: 'rules' }); $('#rl').innerHTML = rows.length ? `<table class="t"><tr><th>Название</th><th>Где</th><th>Даты</th><th>Что</th><th>Огранич.</th><th>Приор.</th><th></th></tr>` + rows.map(r => `<tr style="${r.is_active ? '' : 'opacity:.5'}"><td class="b">${esc(r.name)}</td><td>${r.scope === 'all' ? 'вся сеть' : r.scope === 'complex' ? esc(r.complex) : esc((G.apartments.find(a => a.id === r.apartment_id) || { name: r.apartment_id }).name)}</td><td class="nowrap">${r.date_from ? ruD(r.date_from) : '…'} – ${r.date_to ? ruD(r.date_to) : '…'}${r.weekdays ? '<br><span class="muted">' + r.weekdays.map(d => DN[d]).join(' ') + '</span>' : ''}</td><td>${KIND[r.kind]} ${r.kind === 'multiplier' ? '×' + r.value : r.kind === 'fixed' ? '$' + r.value : r.kind === 'delta' ? (r.value > 0 ? '+' : '') + r.value : r.kind === 'long_stay' ? '−' + r.value + '% от ' + r.min_nights_for + ' ноч.' : r.kind === 'channel_markup' ? '+' + r.value + '% ' + (r.channel || 'все') : ''}</td><td>${r.min_nights ? 'мин ' + r.min_nights : ''}${r.closed_to_arrival ? ' без заезда' : ''}</td><td>${r.priority}</td><td class="nowrap"><button class="sm" data-e="${r.id}">✎</button> <button class="sm danger" data-x="${r.id}">✕</button></td></tr>`).join('') + '</table>' : '<div class="muted">правил нет</div>';
    $$('#rl [data-e]').forEach(b => b.onclick = () => edit(rows.find(r => String(r.id) === b.dataset.e))); $$('#rl [data-x]').forEach(b => b.onclick = async () => { if (!confirm('Удалить правило?')) return; await api(null, { a: 'rule_delete', id: b.dataset.x }); list(); }); };
  const edit = (r) => { r = r || { scope: 'all', kind: 'multiplier', priority: 0, is_active: true };
    openDrawer(r.id ? 'Правило' : 'Новое правило', `<div class="f">
      <label class="w">Название <input id="u_name" value="${esc(r.name || '')}" placeholder="Новый год ×1.5"></label>
      <label>Где <select id="u_scope"><option value="all" ${r.scope === 'all' ? 'selected' : ''}>вся сеть</option><option value="complex" ${r.scope === 'complex' ? 'selected' : ''}>ЖК</option><option value="apartment" ${r.scope === 'apartment' ? 'selected' : ''}>квартира</option></select></label>
      <label>ЖК / квартира <select id="u_target"><option value="">—</option>${[...new Set(G.apartments.map(a => a.complex))].map(c => `<option value="c:${esc(c)}" ${r.scope === 'complex' && r.complex === c ? 'selected' : ''}>ЖК ${esc(c)}</option>`).join('')}${G.apartments.map(a => `<option value="a:${a.id}" ${r.apartment_id === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
      <label>С даты <input id="u_from" type="date" value="${r.date_from || ''}"></label><label>По дату (включ.) <input id="u_to" type="date" value="${r.date_to || ''}"></label>
      <label>Тип <select id="u_kind">${Object.entries(KIND).map(([k, v]) => `<option value="${k}" ${r.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>Значение <input id="u_val" type="number" step="0.01" value="${r.value == null ? '' : r.value}" placeholder="1.5 / 150 / 20 / 10"></label>
      <label>Дни недели <div>${DN.map((d, i) => `<label style="display:inline-flex;flex-direction:row;gap:2px;margin-right:6px;color:var(--text)"><input type="checkbox" data-wd="${i}" ${(r.weekdays || []).includes(i) ? 'checked' : ''}>${d}</label>`).join('')}</div></label>
      <label>Мин. ночей <input id="u_min" type="number" min="1" value="${r.min_nights || ''}"></label>
      <label>Заезд запрещён <select id="u_cta"><option value="">—</option><option value="1" ${r.closed_to_arrival ? 'selected' : ''}>да</option></select></label>
      <label>От скольких ночей (скидка) <input id="u_mnf" type="number" min="1" value="${r.min_nights_for || ''}"></label>
      <label>Канал (наценка/скидка) <select id="u_ch"><option value="">все</option>${['site', 'booker', 'booking', 'airbnb', 'ostrovok', 'yandex', 'sutochno'].map(c => `<option ${r.channel === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <label>Приоритет <input id="u_pr" type="number" value="${r.priority || 0}"></label>
      <label style="flex-direction:row;gap:6px;align-items:center;color:var(--text)"><input type="checkbox" id="u_act" ${r.is_active !== false ? 'checked' : ''}>активно</label></div>
      <div class="muted" style="font-size:11px">Множитель: 1.5 = +50 %. Фикс: цена за ночь в $. Дельта: +20 или −10 к базовой. Скидка от N ночей: значение — процент. Наценка канала: процент сверху для площадки. При нескольких правилах побеждает больший приоритет, затем более узкое (квартира > ЖК > сеть).</div>`,
      `<button class="pri" id="u_ok">Сохранить</button><button onclick="closeDrawer()">Отмена</button>`);
    $('#u_ok').onclick = async () => { const t = $('#u_target').value; const rule = { id: r.id, name: $('#u_name').value.trim(), scope: $('#u_scope').value, complex: t.startsWith('c:') ? t.slice(2) : null, apartment_id: t.startsWith('a:') ? t.slice(2) : null, date_from: $('#u_from').value || null, date_to: $('#u_to').value || null, kind: $('#u_kind').value, value: $('#u_val').value === '' ? null : +$('#u_val').value, weekdays: (() => { const w = $$('#d_body [data-wd]:checked').map(x => +x.dataset.wd); return w.length && w.length < 7 ? w : null; })(), min_nights: $('#u_min').value ? +$('#u_min').value : null, closed_to_arrival: $('#u_cta').value ? true : null, min_nights_for: $('#u_mnf').value ? +$('#u_mnf').value : null, channel: $('#u_ch').value || null, priority: +$('#u_pr').value || 0, is_active: $('#u_act').checked };
      if (rule.scope === 'complex' && !rule.complex) return alert('Выберите ЖК'); if (rule.scope === 'apartment' && !rule.apartment_id) return alert('Выберите квартиру');
      if (['multiplier', 'fixed', 'delta', 'long_stay', 'channel_markup'].includes(rule.kind) && rule.value == null) return alert('Нужно значение');
      try { await api(null, { a: 'rule_save', rule }); closeDrawer(); toast('Сохранено'); list(); } catch (e) { alert(e.message); } };
  };
  $('#nr').onclick = () => edit(null); list();
};

// =====================================================================
// КАНАЛЫ (admin) — channex-admin.js
// =====================================================================
async function capi(params, body) {
  const t = await token(); const r = await fetch('/.netlify/functions/channex-admin' + (body ? '' : '?' + new URLSearchParams(params)), { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({ error: 'bad json' })); if (!r.ok || j.error) throw new Error(j.error || r.status); return j;
}
VIEWS.channels = async () => {
  $('#tools').innerHTML = `<button class="pri sm" id="c_full">⟳ Отправить всё на площадки</button><button class="sm" id="c_feed">⬇ Забрать брони</button><button class="sm" id="c_hook">Вебхук Channex</button><select id="c_cx"><option value="">+ подключить ЖК…</option></select><button class="sm" id="c_ical">⟳ iCal</button><span class="muted" id="c_msg"></span>`;
  $('#main').innerHTML = '<div class="page" id="ch"><div class="muted">загрузка…</div></div>';
  const say = (m, bad) => { const e = $('#c_msg'); e.textContent = m; e.style.color = bad ? 'var(--red)' : ''; };
  const run = async (fn, label) => { say(label + '…'); try { const r = await fn(); say('готово'); console.log(label, r); load(); } catch (e) { say(e.message, true); } };
  let S; const load = async () => {
    try { S = await capi({ a: 'status' }); } catch (e) { $('#ch').innerHTML = '<div class="card">' + esc(e.message) + '</div>'; return; }
    const cx = $('#c_cx'); if (cx.options.length <= 1) [...new Set(S.apartments.filter(a => a.is_active).map(a => a.complex))].forEach(c => cx.add(new Option(c, c)));
    const aptName = id => (S.apartments.find(a => a.id === id) || { name: id }).name;
    const propName = id => (S.properties.find(p => p.id === id) || {}).name || '—';
    const dt = s => s ? s.slice(5, 16).replace('T', ' ') : '—';
    let h = `<div class="kpi"><div><b style="color:${S.channex.ok ? 'var(--green)' : 'var(--red)'}">${S.channex.ok ? 'OK' : 'нет'}</b>Channex ${esc((S.channex.base || '').replace('https://', ''))}${S.channex.error ? '<div class="muted" style="font-size:11px">' + esc(S.channex.error) + '</div>' : ''}</div><div><b>${S.units.filter(u => u.is_active).length}</b>квартир подключено</div><div><b>${S.pending}</b>в очереди</div><div><b style="color:${S.conflicts.length ? 'var(--red)' : ''}">${S.conflicts.length}</b>конфликтов</div><div><b>${S.icals.length}</b>iCal-источников</div></div>`;
    if (S.conflicts.length) h += `<div class="card" style="border-color:#f3bdb8"><h3 style="color:var(--red)">Овербукинг с площадок</h3>` + S.conflicts.map(c => `<div class="li"><div class="g"><div class="n">${esc(aptName(c.apartment_id))} · ${ruD(c.check_in)} → ${ruD(c.check_out)} · ${esc(c.ota_name || '')} · ${esc(c.guest_name || '')} · ${money(c.amount, c.currency)}</div><div class="s">пересекается с бронью <a href="#" data-b="${c.conflicts_with}">${(c.conflicts_with || '').slice(0, 8)}</a> · ${dt(c.created_at)}</div></div><button class="sm" data-res="accept" data-id="${c.id}" title="другую бронь перенесли/отменили — записать эту">Даты освободили → записать</button><button class="sm danger" data-res="cancelled_on_ota" data-id="${c.id}">Отменено на площадке</button></div>`).join('') + `</div>`;
    // наценки площадкам (0 по умолчанию)
    const MK = S.markups || {}; const PL = S.ota_plans || { airbnb: 'Airbnb', booking: 'Booking.com', ostrovok: 'Ostrovok', agoda: 'Agoda', expedia: 'Expedia' };
    h += `<div class="card"><h3>Наценки площадкам <span class="muted" style="font-weight:400;font-size:12px">· % сверх прайса; 0 = цена как на сайте. Меняется — уходит на площадку за минуту</span></h3><div style="display:flex;gap:14px;flex-wrap:wrap">` +
      Object.keys(PL).map(ch => `<label style="display:flex;flex-direction:column;font-size:11px;color:var(--muted)">${PL[ch]}<span style="display:flex;align-items:center;gap:4px"><input type="number" min="0" max="100" step="1" value="${MK[ch] == null ? 0 : MK[ch]}" data-mkup="${ch}" style="width:70px"> %</span></label>`).join('') + `</div></div>`;
    // матрица квартиры × площадки
    const OTAS = [['booking', 'Booking', 'BookingCom'], ['airbnb', 'Airbnb', 'Airbnb'], ['ostrovok', 'Ostrovok', 'EmergingTravel'], ['agoda', 'Agoda', 'Agoda'], ['expedia', 'Expedia', 'Expedia']];
    const ICALS = [['yandex', 'Яндекс'], ['sutochno', 'Sutochno']];
    const unitOf = id => S.units.find(u => u.apartment_id === id);
    const chanFor = (u, code) => { const p = u && S.properties.find(x => x.id === u.channel_property_id); if (!p || !p.external_id) return null; return S.channels.find(c => (c.channel || '').toLowerCase().replace(/[^a-z]/g, '') === code.toLowerCase().replace(/[^a-z]/g, '') && (c.properties || []).includes(p.external_id)); };
    const icalFor = (id, ch) => S.icals.find(i => i.apartment_id === id && i.channel === ch);
    const cell = (ok, label, title, cls) => `<td style="text-align:center" title="${esc(title || '')}">${ok === null ? '<span class="muted">—</span>' : ok ? '<span style="color:var(--green);font-weight:700">✓</span>' : '<span class="' + (cls || 'muted') + '" style="font-size:11px">' + esc(label) + '</span>'}</td>`;
    const byCx = {}; S.apartments.filter(a => a.is_active).forEach(a => (byCx[a.complex] = byCx[a.complex] || []).push(a));
    h += `<div class="card"><h3>Менеджер каналов <span class="muted" style="font-weight:400;font-size:12px">· клик по квартире — ссылки iCal, наценка, статус; клик по ЖК — подключить к Channex</span></h3>
      <table class="t"><tr><th>Квартира</th><th>Channex</th>${OTAS.map(o => '<th style="text-align:center">' + o[1] + '</th>').join('')}${ICALS.map(o => '<th style="text-align:center">' + o[1] + '</th>').join('')}<th>Цены отпр.</th><th>Ошибка</th></tr>`;
    for (const cx of Object.keys(byCx)) {
      const hasProp = S.properties.some(p => p.complex === cx && p.external_id);
      h += `<tr style="background:#f7f8fa"><td colspan="${4 + OTAS.length + ICALS.length}" class="b">${esc(cx)} ${hasProp ? '<span class="tag">Channex ✓</span>' : '<button class="sm" data-cx="' + esc(cx) + '">подключить ЖК к Channex</button>'}</td></tr>`;
      for (const a of byCx[cx]) {
        const u = unitOf(a.id);
        h += `<tr data-apt="${a.id}" style="cursor:pointer"><td class="b">${a.catalog_no ? '<span class="no tag">' + a.catalog_no + '</span> ' : ''}${esc(a.name)}</td>`;
        h += cell(u && u.external_room_type_id ? true : (hasProp ? false : null), 'не создана', u ? 'room ' + (u.external_room_type_id || '').slice(0, 8) : '');
        for (const o of OTAS) { const c = chanFor(u, o[2]); h += cell(u && u.external_room_type_id ? !!c : null, 'подключить', c ? c.title : ''); }
        for (const o of ICALS) { const i = icalFor(a.id, o[0]); h += cell(i ? !i.error : false, 'ссылка', i ? (i.error || ('проверено ' + dt(i.last_ok_at))) : ''); }
        h += `<td class="nowrap">${u ? dt(u.last_pushed_at) : '—'}${u && !u.is_active ? ' <span class="tag bad">выкл</span>' : ''}</td><td style="color:var(--red);font-size:11px">${esc(((u && u.last_error) || '').slice(0, 60))}</td></tr>`;
      }
    }
    h += `</table><div class="muted" style="font-size:11px;margin-top:6px">Booking / Airbnb / Ostrovok / Agoda / Expedia подключаются в Channex: <a target="_blank" href="${esc((S.channex.base || 'https://staging.channex.io') + '/channels')}">Channels → Add new channel</a> → выбрать карточку ЖК и сопоставить комнаты. Яндекс и Sutochno — по ссылкам iCal в карточке квартиры.</div></div>`;
    if (S.failed.length) h += `<div class="card"><h3>Ошибки отправки</h3>` + S.failed.map(f => `<div class="ev"><b>${esc(aptName(f.apartment_id))}</b> попыток ${f.attempts}: ${esc((f.error || '').slice(0, 160))}</div>`).join('') + `</div>`;
    h += `<div class="card"><h3>iCal-площадки (Яндекс Путешествия, Sutochno)</h3><div class="muted" style="font-size:12px;margin-bottom:6px">Наша ссылка для экстранета площадки: <code>${esc(S.ical_base)}&lt;id квартиры&gt;</code>. Их ссылку вставьте сюда — брони появятся в шахматке.</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px"><select id="i_apt">${S.apartments.filter(a => a.is_active).map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select><select id="i_ch"><option value="yandex">Яндекс Путешествия</option><option value="sutochno">Sutochno</option><option value="other">другое</option></select><input id="i_url" placeholder="https://…ics" style="flex:1;min-width:260px"><button class="sm pri" id="i_add">Добавить</button></div>
      ${S.icals.length ? `<table class="t"><tr><th>Квартира</th><th>Канал</th><th>Ссылка</th><th>Проверено</th><th>Событий</th><th>Ошибка</th><th></th></tr>` + S.icals.map(i => `<tr><td>${esc(aptName(i.apartment_id))}</td><td>${esc(i.channel)}</td><td style="font-size:11px;max-width:260px;overflow:hidden;text-overflow:ellipsis">${esc(i.url)}</td><td class="nowrap">${dt(i.last_ok_at)}</td><td>${i.events_count == null ? '—' : i.events_count}</td><td style="color:var(--red);font-size:11px">${esc(i.error || '')}</td><td><button class="sm danger" data-idel="${i.id}">✕</button></td></tr>`).join('') + '</table>' : ''}</div>`;
    h += `<div class="card"><h3>Последние брони с площадок</h3>` + (S.recent.length ? `<table class="t"><tr><th>Когда</th><th>Площадка</th><th>№</th><th>Статус</th><th>Результат</th></tr>` + S.recent.map(b => `<tr><td class="nowrap">${dt(b.received_at)}</td><td>${esc(b.ota_name || '')}</td><td>${esc(b.unique_id || '')}</td><td>${esc(b.status || '')}</td><td>${b.conflict ? '<span class="tag bad">конфликт</span>' : b.error ? '<span class="tag bad">' + esc(b.error.slice(0, 60)) + '</span>' : b.booking_id ? '<a href="#" data-b="' + b.booking_id + '">бронь ' + b.booking_id.slice(0, 8) + '</a>' : '—'}${b.acked_at ? ' ✓' : ''}</td></tr>`).join('') + '</table>' : '<div class="muted">пока нет</div>') + `</div>`;
    $('#ch').innerHTML = h;
    $$('#ch [data-b]').forEach(x => x.onclick = e => { e.preventDefault(); openBooking(x.dataset.b); });
    $$('#ch [data-res]').forEach(x => x.onclick = () => run(() => capi(null, { a: 'resolve_conflict', id: x.dataset.id, resolution: x.dataset.res }), 'Решаю конфликт'));
    $$('#ch [data-mkup]').forEach(x => x.onchange = () => run(() => capi(null, { a: 'markup_set', channel: x.dataset.mkup, pct: x.value }), 'Наценка ' + x.dataset.mkup));
    $$('#ch [data-cx]').forEach(x => x.onclick = e => { e.stopPropagation(); const c = x.dataset.cx; if (confirm('Создать в Channex карточку «Urban Luxe ' + c + '» и комнаты для всех квартир ЖК?')) run(() => capi(null, { a: 'setup_complex', complex: c }), 'Подключаю ' + c); });
    $$('#ch tr[data-apt]').forEach(r => r.onclick = () => openUnit(r.dataset.apt));
    $$('#ch [data-push]').forEach(x => x.onclick = () => run(() => capi(null, { a: 'push_full', apt: x.dataset.push }), 'Отправляю'));
    $$('#ch [data-act]').forEach(x => x.onclick = () => run(() => capi(null, { a: 'unit_update', apartment_id: x.dataset.act, is_active: x.dataset.on === '1' }), 'Сохраняю'));
    $$('#ch [data-mk]').forEach(x => x.onchange = () => run(() => capi(null, { a: 'unit_update', apartment_id: x.dataset.mk, markup_pct: x.value }), 'Наценка'));
    $$('#ch [data-pr]').forEach(x => x.onchange = () => run(() => capi(null, { a: 'unit_update', apartment_id: x.dataset.pr, push_rates: x.checked }), 'Сохраняю'));
    $$('#ch [data-pa]').forEach(x => x.onchange = () => run(() => capi(null, { a: 'unit_update', apartment_id: x.dataset.pa, push_availability: x.checked }), 'Сохраняю'));
    $$('#ch [data-idel]').forEach(x => x.onclick = () => { if (confirm('Удалить источник?')) run(() => capi(null, { a: 'ical_delete', id: x.dataset.idel }), 'Удаляю'); });
    $('#i_add').onclick = () => run(() => capi(null, { a: 'ical_add', apartment_id: $('#i_apt').value, channel: $('#i_ch').value, url: $('#i_url').value.trim() }), 'Добавляю');
  };
  const openUnit = (id) => {
    const a = S.apartments.find(x => x.id === id), u = S.units.find(x => x.apartment_id === id) || {};
    const exp = S.ical_base + id;
    const ic = ch => S.icals.find(i => i.apartment_id === id && i.channel === ch) || {};
    openDrawer(a.name, `<div class="sec">Ссылки iCal</div>
      <label class="muted" style="font-size:11px">Экспорт (наша занятость → вставить в экстранет Яндекса / Sutochno)</label>
      <div style="display:flex;gap:6px;margin-bottom:10px"><input value="${esc(exp)}" readonly style="flex:1;font-size:11px" onclick="this.select()"><button class="sm" id="u_copy">копировать</button></div>
      ${[['yandex', 'Яндекс Путешествия'], ['sutochno', 'Sutochno']].map(([ch, nm]) => `<label class="muted" style="font-size:11px">Импорт — ссылка ${nm} (их брони → к нам)</label><div style="display:flex;gap:6px;margin-bottom:8px"><input data-ical="${ch}" value="${esc(ic(ch).url || '')}" placeholder="https://…ics" style="flex:1;font-size:11px"><button class="sm" data-isave="${ch}">сохранить</button>${ic(ch).id ? '<button class="sm danger" data-idel2="' + ic(ch).id + '">✕</button>' : ''}</div>${ic(ch).id ? '<div class="muted" style="font-size:11px;margin:-4px 0 8px">проверено ' + (ic(ch).last_ok_at || '—').slice(0, 16).replace('T', ' ') + (ic(ch).error ? ' · <span style="color:var(--red)">' + esc(ic(ch).error) + '</span>' : ' · событий ' + (ic(ch).events_count == null ? '—' : ic(ch).events_count)) + '</div>' : ''}`).join('')}
      <div class="sec">Channex</div>
      ${u.external_room_type_id ? `<div class="muted" style="font-size:11px">room ${esc(u.external_room_type_id)}<br>rate ${esc(u.external_rate_plan_id || '')}</div>
      <div class="f" style="margin-top:8px"><label>Наценка, % <input id="u_mk" type="number" value="${u.markup_pct == null ? '' : u.markup_pct}" placeholder="из правил «Цены»"></label><label>&nbsp;<button class="sm" id="u_push">⟳ отправить цены и занятость</button></label>
      <label style="flex-direction:row;gap:6px;align-items:center;color:var(--text)"><input type="checkbox" id="u_pr" ${u.push_rates ? 'checked' : ''}>слать цены</label><label style="flex-direction:row;gap:6px;align-items:center;color:var(--text)"><input type="checkbox" id="u_pa" ${u.push_availability ? 'checked' : ''}>слать занятость</label>
      <label style="flex-direction:row;gap:6px;align-items:center;color:var(--text)"><input type="checkbox" id="u_on" ${u.is_active !== false ? 'checked' : ''}>подключена</label></div>
      ${u.last_error ? '<div class="warn">' + esc(u.last_error) + '</div>' : ''}` : '<div class="muted">Комната в Channex не создана — нажмите «подключить ЖК к Channex» в строке ЖК.</div>'}`,
      `<button class="pri" id="u_save">Сохранить</button><button onclick="closeDrawer()">Закрыть</button>`);
    $('#u_copy').onclick = () => navigator.clipboard.writeText(exp).then(() => toast('Скопировано'));
    $$('#d_body [data-isave]').forEach(b => b.onclick = () => { const url = $('#d_body [data-ical="' + b.dataset.isave + '"]').value.trim(); if (!url) return; run(() => capi(null, { a: 'ical_add', apartment_id: id, channel: b.dataset.isave, url }), 'Сохраняю iCal').then(() => closeDrawer()); });
    $$('#d_body [data-idel2]').forEach(b => b.onclick = () => run(() => capi(null, { a: 'ical_delete', id: b.dataset.idel2 }), 'Удаляю').then(() => closeDrawer()));
    if ($('#u_push')) $('#u_push').onclick = () => run(() => capi(null, { a: 'push_full', apt: id }), 'Отправляю');
    $('#u_save').onclick = () => { if (!u.external_room_type_id) return closeDrawer(); run(() => capi(null, { a: 'unit_update', apartment_id: id, markup_pct: $('#u_mk').value, push_rates: $('#u_pr').checked, push_availability: $('#u_pa').checked, is_active: $('#u_on').checked }), 'Сохраняю').then(() => closeDrawer()); };
  };
  $('#c_full').onclick = () => run(() => capi(null, { a: 'push_full' }), 'Отправляю всё');
  $('#c_feed').onclick = () => run(() => capi(null, { a: 'feed' }), 'Забираю брони');
  $('#c_hook').onclick = () => run(() => capi(null, { a: 'setup_webhook' }), 'Вебхук');
  $('#c_ical').onclick = () => run(() => capi(null, { a: 'ical_pull' }), 'iCal');
  $('#c_cx').onchange = e => { const c = e.target.value; if (!c) return; e.target.value = ''; if (confirm('Создать в Channex карточку «Urban Luxe ' + c + '» и комнаты для всех квартир ЖК?')) run(() => capi(null, { a: 'setup_complex', complex: c }), 'Подключаю ' + c); };
  load();
};

// =====================================================================
// REALTIME
// =====================================================================
let rtTimer = null, lastOk = Date.now();
async function realtime() {
  const t = await token(); if (t) sb.realtime.setAuth(t);
  const bump = (payload) => { lastOk = Date.now(); setConn(true); if (VIEW !== 'cal' || !G) return; clearTimeout(rtTimer); rtTimer = setTimeout(async () => { await load(true); if (payload && payload.new && payload.new.id) { const el = document.querySelector('.bar[data-id="' + payload.new.id + '"]'); if (el) el.classList.add('flash'); } }, 400); };
  const ch = sb.channel('pms')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, bump)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, bump)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rate_calendar' }, () => { lastOk = Date.now(); if (VIEW === 'cal' && G) { clearTimeout(rtTimer); rtTimer = setTimeout(() => load(true), 1500); } })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cleaning_tasks' }, bump)
    .subscribe(status => setConn(status === 'SUBSCRIBED'));
  sb.auth.onAuthStateChange((ev, session) => { if (session) sb.realtime.setAuth(session.access_token); });
  setInterval(() => { const st = ch.state; setConn(st === 'joined'); }, 5000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && VIEW === 'cal' && G) load(true); });
}
function setConn(ok) { const c = $('#conn'); if (!c) return; c.classList.toggle('off', !ok); c.textContent = ok ? 'online' : 'нет связи · данные на ' + new Date(lastOk).toTimeString().slice(0, 5); }

sb.auth.getSession().then(({ data: { session } }) => session ? boot() : showLogin());
})();
