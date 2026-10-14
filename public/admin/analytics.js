// Urban Luxe — admin/analytics.js (14.10.2026). Раздел «Аналитика»: период → adm_analytics (SQL) → таблицы и графики. Клиент только рисует.
// Данные: admin-api ?a=analytics&from=&to= → { totals, by_complex[], by_apartment[], sources[], weekday[], los[], months[] }.
(function () {
const A = window.ADM, { $, $$, esc, money, pct, ruD, ruMonth, addMonths, toast, api, CH, DN } = A;
const today = () => A.iso(Date.now() + 5 * 36e5);
let FROM = today().slice(0, 7) + '-01', TO = addMonths(FROM, 1) + '-01', PRESET = 'month';
let charts = {};
const SRC = { 'rc|rc': 'Напрямую (RC: Telegram, звонки)', 'rc|ota': 'Площадки (через RC)', 'rc|telegram': 'Telegram (RC)', 'website|': 'Сайт', 'website|rc': 'Сайт (ведётся в RC)', 'manual|other': 'Бронер', 'manual|telegram': 'Бронер · Telegram', 'channex|offline': 'Channex · тест' };
const srcName = s => SRC[s.source + '|' + s.channel] || ((CH[s.source] || s.source) + (s.channel ? ' · ' + (CH[s.channel] || s.channel) : ''));

A.views.analytics = function () {
  $('#main').innerHTML = `
    <div class="page">
      <h2>Аналитика
        <div class="seg" id="presets"><button data-p="month">Месяц</button><button data-p="quarter">Квартал</button><button data-p="year">Год</button><button data-p="custom">Период</button></div>
        <div class="seg"><button id="p_prev">‹</button><button id="p_lbl" class="on"></button><button id="p_next">›</button></div>
        <span id="custom" class="hide"><input type="date" id="p_from"> — <input type="date" id="p_to"> <button class="sm" id="p_go">Показать</button></span>
        <span class="sp"></span><button class="sm" id="csv">⬇ CSV по квартирам</button>
      </h2>
      <div id="an_kpi" class="kpi"></div>
      <div class="grid2">
        <div class="card"><h3>По месяцам <span class="n">начислено · загрузка</span></h3><div class="chart"><canvas id="ch_m"></canvas></div></div>
        <div class="card"><h3>Источники броней <span class="n">по начислено</span></h3><div class="chart"><canvas id="ch_src"></canvas></div><div id="src_t"></div></div>
      </div>
      <div class="card"><h3>По ЖК</h3><div id="cx_t"></div></div>
      <div class="grid2">
        <div class="card"><h3>Загрузка по дням недели <span class="n">доля занятых ночей</span></h3><div class="chart" style="height:200px"><canvas id="ch_dow"></canvas></div></div>
        <div class="card"><h3>Длина проживания <span class="n">броней по числу ночей</span></h3><div class="chart" style="height:200px"><canvas id="ch_los"></canvas></div></div>
      </div>
      <div class="card"><h3>По квартирам <span class="n">прибыль = начислено − аренда (по условиям, пропорционально) − расходы квартиры</span><span class="sp"></span>
        <div class="seg" id="apt_sort"><button data-s="net" class="on">по прибыли</button><button data-s="accrued">по выручке</button><button data-s="occupancy">по загрузке</button><button data-s="catalog_no">по № каталога</button></div></h3>
        <div id="apt_t"></div></div>
    </div>`;
  $$('#presets button').forEach(b => { b.classList.toggle('on', b.dataset.p === PRESET); b.onclick = () => setPreset(b.dataset.p); });
  $('#p_prev').onclick = () => shift(-1); $('#p_next').onclick = () => shift(1);
  $('#p_go').onclick = () => { FROM = $('#p_from').value; TO = $('#p_to').value; if (FROM && TO && TO > FROM) load(); };
  $('#csv').onclick = csv;
  $$('#apt_sort button').forEach(b => b.onclick = () => { $$('#apt_sort button').forEach(x => x.classList.toggle('on', x === b)); SORT = b.dataset.s; renderApts(); });
  load();
};
let SORT = 'net', DATA = null;

function setPreset(p) {
  PRESET = p; $$('#presets button').forEach(b => b.classList.toggle('on', b.dataset.p === p));
  $('#custom').classList.toggle('hide', p !== 'custom');
  const t = today(), y = t.slice(0, 4), m = +t.slice(5, 7);
  if (p === 'month') { FROM = t.slice(0, 7) + '-01'; TO = addMonths(FROM, 1) + '-01'; }
  if (p === 'quarter') { const qm = Math.floor((m - 1) / 3) * 3 + 1; FROM = y + '-' + String(qm).padStart(2, '0') + '-01'; TO = addMonths(FROM, 3) + '-01'; }
  if (p === 'year') { FROM = y + '-01-01'; TO = (+y + 1) + '-01-01'; }
  if (p === 'custom') { $('#p_from').value = FROM; $('#p_to').value = TO; return; }
  load();
}
function shift(k) {
  const step = PRESET === 'month' ? 1 : PRESET === 'quarter' ? 3 : PRESET === 'year' ? 12 : 0;
  if (!step) { const len = Math.round((new Date(TO) - new Date(FROM)) / 864e5); FROM = A.addD(FROM, k * len); TO = A.addD(TO, k * len); $('#p_from').value = FROM; $('#p_to').value = TO; }
  else { FROM = addMonths(FROM, k * step) + '-01'; TO = addMonths(TO, k * step) + '-01'; }
  load();
}
function label() {
  if (PRESET === 'month') return ruMonth(FROM);
  if (PRESET === 'quarter') return 'Q' + (Math.floor((+FROM.slice(5, 7) - 1) / 3) + 1) + ' ' + FROM.slice(0, 4);
  if (PRESET === 'year') return FROM.slice(0, 4);
  return ruD(FROM) + ' – ' + ruD(A.addD(TO, -1));
}

async function load() {
  if (!$('#p_lbl')) return; $('#p_lbl').textContent = label();
  $('#an_kpi').innerHTML = '<div class="empty">Считаю…</div>';
  try { DATA = await api({ a: 'analytics', from: FROM, to: TO }); if (!$('#an_kpi')) return; } catch (e) { if (!$('#an_kpi')) return; $('#an_kpi').innerHTML = '<div class="warn">' + esc(e.message) + '</div>'; return; }
  const t = DATA.totals || {};
  const isFuture = TO > today();
  $('#an_kpi').innerHTML = `
    <div>Начислено<b>${money(t.accrued)}</b><div class="d muted">${t.nights} ночей · ${t.bookings} броней</div></div>
    <div>Касса<b>${money(t.cash)}</b><div class="d muted">оплаты по дате платежа</div></div>
    <div>Загрузка<b>${pct(t.occupancy)}</b><div class="d muted">${DATA.active} кв. с данными${DATA.active_all > DATA.active ? ' из ' + DATA.active_all : ''} × ${DATA.days} дн.${isFuture ? ' · период не закончен' : ''}</div></div>
    <div>ADR<b>${money(t.adr)}</b><div class="d muted">за проданную ночь</div></div>
    <div>RevPAR<b>${money(t.revpar)}</b><div class="d muted">за доступную ночь</div></div>
    <div>Ср. проживание<b>${t.avg_los} ноч.</b><div class="d muted">${t.arrivals} заездов</div></div>
    <div>Аренда<b>${money(t.rent_tracked != null ? t.rent_tracked : t.rent)}</b><div class="d muted">по условиям квартир с данными${t.rent_tracked != null && t.rent !== t.rent_tracked ? ' · всего ' + money(t.rent) : ''}</div></div>
    <div>Прибыль ≈<b>${money((t.accrued || 0) - (t.rent_tracked != null ? t.rent_tracked : t.rent || 0) - (t.expenses || 0))}</b><div class="d muted">начислено − аренда − расходы кв.</div></div>`;
  renderMonths(); renderSources(); renderComplexes(); renderDow(); renderLos(); renderApts();
}

function mk(id, cfg) { if (charts[id]) { charts[id].destroy(); } const el = $('#' + id); if (!el || !window.Chart) return; charts[id] = new Chart(el, cfg); }
const base = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } } };

function renderMonths() {
  const ms = DATA.months || [];
  mk('ch_m', { type: 'bar', data: { labels: ms.map(m => ruMonth(m.month).slice(0, 3) + ' ' + String(m.month).slice(2, 4)), datasets: [
    { label: 'Начислено, $', data: ms.map(m => m.accrued || 0), backgroundColor: '#1a6fd1', yAxisID: 'y' },
    { label: 'Загрузка, %', data: ms.map(m => m.occupancy || 0), type: 'line', borderColor: '#e0a71e', backgroundColor: '#e0a71e', yAxisID: 'y2', tension: .3 }] },
    options: Object.assign({}, base, { scales: { y: { ticks: { callback: v => '$' + (v / 1000) + 'k', font: { size: 10 } } }, y2: { position: 'right', min: 0, max: 100, ticks: { callback: v => v + '%', font: { size: 10 } }, grid: { display: false } }, x: { ticks: { font: { size: 10 } } } } }) });
}
function renderSources() {
  const s = DATA.sources || [], colors = ['#1a6fd1', '#ff7a00', '#2f9e5b', '#b8923f', '#8a919b', '#d9463e', '#6b4fbb'];
  mk('ch_src', { type: 'doughnut', data: { labels: s.map(srcName), datasets: [{ data: s.map(x => x.accrued), backgroundColor: colors }] }, options: Object.assign({}, base, { plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 11 } } } } }) });
  const tot = s.reduce((a, x) => a + x.accrued, 0) || 1;
  $('#src_t').innerHTML = '<table class="t"><tr><th>Источник</th><th class="num">Броней</th><th class="num">Ночей</th><th class="num">Начислено</th><th class="num">Доля</th></tr>' +
    s.map(x => `<tr><td>${esc(srcName(x))}</td><td class="num">${x.bookings}</td><td class="num">${x.nights}</td><td class="num">${money(x.accrued)}</td><td class="num">${Math.round(100 * x.accrued / tot)}%</td></tr>`).join('') + '</table>';
}
function renderComplexes() {
  const c = DATA.by_complex || [];
  $('#cx_t').innerHTML = '<table class="t"><tr><th>ЖК</th><th class="num">Кв. (с данными)</th><th class="num">Ночей</th><th class="num">Загрузка</th><th class="num">ADR</th><th class="num">RevPAR</th><th class="num">Начислено</th><th class="num">Аренда</th><th class="num">Расходы</th><th class="num">Прибыль</th></tr>' +
    c.map(x => `<tr><td class="b">${esc(x.complex)}</td><td class="num">${x.apartments}${x.tracked < x.apartments ? ' <span class="muted">(' + x.tracked + ')</span>' : ''}</td><td class="num">${x.nights}</td><td class="num">${pct(x.occupancy)}</td><td class="num">${money(x.adr)}</td><td class="num">${money(x.revpar)}</td><td class="num">${money(x.accrued)}</td><td class="num">${money(x.rent)}</td><td class="num">${money(x.expenses)}</td><td class="num ${x.net < 0 ? 'down' : ''}">${money(x.net)}</td></tr>`).join('') + '</table>';
}
function renderDow() {
  const w = DATA.weekday || [], names = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
  mk('ch_dow', { type: 'bar', data: { labels: w.map(x => names[x.dow - 1]), datasets: [{ label: 'Загрузка, %', data: w.map(x => x.occupancy), backgroundColor: w.map(x => x.dow >= 6 ? '#d9463e' : '#1a6fd1') }] }, options: Object.assign({}, base, { plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%', font: { size: 10 } } } } }) });
}
function renderLos() {
  const l = DATA.los || [];
  mk('ch_los', { type: 'bar', data: { labels: l.map(x => x.bucket + ' ноч.'), datasets: [{ label: 'Броней', data: l.map(x => x.bookings), backgroundColor: '#2f9e5b' }] }, options: Object.assign({}, base, { plugins: { legend: { display: false } }, scales: { y: { ticks: { font: { size: 10 } } } } }) });
}
function renderApts() {
  const rows = (DATA.by_apartment || []).slice().sort((a, b) => SORT === 'catalog_no' ? (a.catalog_no || 999) - (b.catalog_no || 999) : (b[SORT] || 0) - (a[SORT] || 0));
  $('#apt_t').innerHTML = '<table class="t"><tr><th>#</th><th>Квартира</th><th>ЖК</th><th class="num">Ночей</th><th class="num">Загрузка</th><th class="num">ADR</th><th class="num">Начислено</th><th class="num">Аренда</th><th class="num">Расходы</th><th class="num">Прибыль</th></tr>' +
    rows.map((x, i) => x.tracked === false ? `<tr class="muted"><td>${x.catalog_no ? '№' + x.catalog_no : ''}</td><td>${esc(x.name)} <span class="tag" title="RC-аккаунт партнёра: в базе только занятость по iCal">RC партнёра · нет данных</span></td><td>${esc(x.complex || '')}</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">${money(x.rent)}</td><td class="num">${money(x.expenses)}</td><td class="num">—</td></tr>` : `<tr><td class="muted">${x.catalog_no ? '№' + x.catalog_no : ''}</td><td class="b"><a href="/pms" title="открыть шахматку">${esc(x.name)}</a>${x.tracked === false ? ' <span class="tag" title="Квартира на RC-аккаунте партнёра: в базе только занятость по iCal, броней и сумм нет">RC партнёра · нет данных</span>' : ''}</td><td>${esc(x.complex || '')}</td><td class="num">${x.nights}</td><td class="num">${pct(x.occupancy)}</td><td class="num">${money(x.adr)}</td><td class="num">${money(x.accrued)}</td><td class="num">${money(x.rent)}</td><td class="num">${money(x.expenses)}</td><td class="num ${x.net < 0 ? 'down' : 'up'}">${money(x.net)}</td></tr>`).join('') + '</table>';
}
function csv() {
  if (!DATA) return;
  const rows = [['catalog_no', 'apartment', 'complex', 'nights', 'occupancy_pct', 'adr', 'accrued_usd', 'rent_usd', 'expenses_usd', 'net_usd']].concat((DATA.by_apartment || []).map(x => [x.catalog_no || '', x.name, x.complex || '', x.nights, x.occupancy, x.adr || '', x.accrued, x.rent, x.expenses, x.net]));
  const txt = '﻿' + rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' })); a.download = 'urbanluxe-analytics-' + FROM + '-' + TO + '.csv'; a.click();
  toast('CSV скачан');
}
})();
