// Urban Luxe — admin/dash.js (14.10.2026). Раздел «Дашборд»: заявки с сайта → сегодня → месяц (KPI по базе) → график 13 мес → загрузка 14 дней.
// Данные: admin-api ?a=requests | ?a=today | ?a=kpi&month= | ?a=dashboard (occupancy14, marketing). Цифры считает SQL adm_month_kpi.
(function () {
const A = window.ADM, { $, $$, esc, money, pct, ruD, ruDM, ruMonth, addMonths, kpiTile, toast, api, CH, DN } = A;
let MONTH = A.iso(Date.now() + 5 * 36e5).slice(0, 7);   // Ташкент = UTC+5
let chart = null, busyIds = new Set();

A.views.dash = function () {
  $('#main').innerHTML = `
    <div class="page">
      <div id="req" class="card"><h3>Заявки с сайта <span class="n" id="req_n"></span><span class="sp"></span><button class="sm" id="req_rl">⟳</button></h3><div id="req_b" class="empty">Загрузка…</div></div>
      <div id="today" class="card"><h3>Сегодня <span class="n" id="today_d"></span><span class="sp"></span><a href="/pms#today" class="sm">открыть в PMS →</a></h3><div id="today_b" class="empty">Загрузка…</div></div>
      <div class="card"><h3>
        <div class="seg"><button id="m_prev">‹</button><button id="m_cur" class="on"></button><button id="m_next">›</button></div>
        <span class="n">по базе: брони × ночи в месяце, оплаты по дате платежа, расходы из журнала</span><span class="sp"></span>
        <button class="sm" id="imp">⟳ импорт из Google-таблиц</button></h3>
        <div id="kpi_b" class="empty">Загрузка…</div></div>
      <div class="grid2">
        <div class="card"><h3>13 месяцев <span class="n">начислено · касса · расходы</span></h3><div class="chart"><canvas id="ch13"></canvas></div></div>
        <div class="card"><h3>Загрузка на 14 дней <span class="n">по календарю цен (занято / активных)</span></h3><div id="occ14" class="empty">Загрузка…</div></div>
      </div>
    </div>`;
  $('#req_rl').onclick = loadRequests;
  $('#m_prev').onclick = () => { MONTH = addMonths(MONTH, -1); loadKpi(); };
  $('#m_next').onclick = () => { MONTH = addMonths(MONTH, 1); loadKpi(); };
  $('#imp').onclick = importSheets;
  loadRequests(); loadToday(); loadKpi(); loadOcc14();
};

// Перерисовка по realtime: заявки и «сегодня» — при любом изменении броней/платежей
let rt = null;
A.onChange(() => { if (!$('#req')) return; clearTimeout(rt); rt = setTimeout(() => { loadRequests(); loadToday(); }, 600); });

// ---------- заявки ----------
async function loadRequests() {
  try {
    const rows = await api({ a: 'requests' });
    $('#req_n').textContent = rows.length ? rows.length : 'нет новых';
    document.title = (rows.length ? '(' + rows.length + ') ' : '') + 'Urban Luxe · Админка';
    if (!rows.length) { $('#req_b').innerHTML = '<div class="empty">Новых заявок нет. Бронь с сайта появится здесь — подтвердите или отмените одной кнопкой, гостю уйдёт письмо.</div>'; return; }
    $('#req_b').className = '';
    $('#req_b').innerHTML = rows.map(r => {
      const age = Math.round((Date.now() - new Date(r.created_at)) / 60000);
      const ageS = age < 60 ? age + ' мин' : age < 1440 ? Math.round(age / 60) + ' ч' : Math.round(age / 1440) + ' дн';
      const tg = String(r.guest_telegram || '').trim(), wa = String(r.guest_whatsapp || '').trim();
      const tgL = tg ? (tg[0] === '@' ? 'https://t.me/' + tg.slice(1) : 'https://t.me/+' + tg.replace(/\D/g, '')) : '';
      const waL = wa ? 'https://wa.me/' + wa.replace(/\D/g, '') : '';
      return `<div class="req${busyIds.has(r.id) ? ' busy' : ''}" data-id="${r.id}">
        <div>
          <div class="h">${r.catalog_no ? '<span class="muted">№' + esc(r.catalog_no) + '</span> ' : ''}${esc(r.apartment_name)} <span class="muted" style="font-weight:400">· ${esc(r.complex || '')}</span><span class="ref">${esc(r.booking_ref)}</span></div>
          <div class="s">📅 <b>${ruDM(r.check_in)} → ${ruDM(r.check_out)}</b> · ${r.nights} ноч. · ${r.guests_count || 1} гост. · <b>${money(r.total_price, r.currency)}</b> <span class="tag src">${esc(CH[r.source] || r.source || '')}</span></div>
          <div class="s">👤 <b>${esc(r.guest_name || '—')}</b>${r.guest_phone ? ' · <a href="tel:' + esc(r.guest_phone) + '">' + esc(r.guest_phone) + '</a>' : ''}${tg ? ' · <a href="' + tgL + '" target="_blank">✈️ ' + esc(tg) + '</a>' : ''}${wa ? ' · <a href="' + waL + '" target="_blank">💬 WhatsApp</a>' : ''}${r.guest_email ? ' · <a href="mailto:' + esc(r.guest_email) + '">' + esc(r.guest_email) + '</a>' : ''}</div>
          ${r.notes ? '<div class="s">📝 ' + esc(r.notes) + '</div>' : ''}
          <div class="s muted">получена ${ageS} назад${age > 60 ? ' <span class="tag bad">гость ждёт</span>' : ''}</div>
        </div>
        <div class="acts">
          <button class="ok" data-ok="${r.id}">✓ Подтвердить</button>
          <button class="danger" data-no="${r.id}">Отменить</button>
          <a class="sm" href="/pms#booking=${r.id}" target="_blank"><button class="sm">в PMS</button></a>
        </div></div>`;
    }).join('');
    $$('#req_b [data-ok]').forEach(b => b.onclick = () => act(b.dataset.ok, 'request_confirm'));
    $$('#req_b [data-no]').forEach(b => b.onclick = () => { const reason = prompt('Причина отмены (попадёт в письмо гостю):', 'даты уже заняты'); if (reason === null) return; act(b.dataset.no, 'request_cancel', reason); });
  } catch (e) { $('#req_b').innerHTML = '<div class="warn">' + esc(e.message) + '</div>'; }
}
async function act(id, a, reason) {
  if (busyIds.has(id)) return;
  busyIds.add(id); const el = $('#req_b [data-id="' + id + '"]'); if (el) el.classList.add('busy');
  try {
    const r = await api(null, { a, id, reason });
    toast((a === 'request_confirm' ? '✅ Подтверждена' : '❌ Отменена') + (r.mail && r.mail.sent ? ' · письмо отправлено' : r.mail ? ' · письмо не ушло: ' + r.mail.reason : '') + (r.tg && !r.tg.ok ? ' · TG: ' + r.tg.error : ''), 5000);
  } catch (e) { toast((e.status === 409 ? '⚠️ ' : '') + e.message, 5000); }
  busyIds.delete(id);
  loadRequests(); loadToday(); loadKpi();
}

// ---------- сегодня ----------
async function loadToday() {
  try {
    const t = await api({ a: 'today' });
    $('#today_d').textContent = ruD(t.date);
    const dirty = (t.cleaning || []).filter(c => c.status && !/done|clean|ok/i.test(c.status)).length;
    const debt = (t.debts || []).reduce((s, b) => s + (b.debt || 0), 0);
    const line = (b, kind) => `<div class="li"><span class="no">${esc(b.catalog_no || '')}</span><div class="g"><div class="n">${esc(b.apartment_name || b.apartment_id)} <span class="muted" style="font-weight:400">· ${esc(b.guest_name || '')}</span></div>
      <div class="s">${kind === 'in' ? 'заезд ' + esc(b.arrival_time || b.check_in_time || '15:00') + ' · до ' + ruD(b.check_out) : 'выезд ' + esc(b.departure_time || '12:00') + ' · с ' + ruD(b.check_in)} · ${b.nights} ноч. · ${esc(CH[b.channel] || CH[b.source] || '')}${b.debt > 0 ? ' · <span class="tag bad">долг ' + money(b.debt, b.currency) + '</span>' : ''}${b.status === 'request' ? ' · <span class="tag">заявка</span>' : ''}</div></div>
      <span class="st" style="background:${(A.ST[b.status] || ['', '#eee'])[1]}">${(A.ST[b.status] || [b.status])[0]}</span></div>`;
    $('#today_b').className = '';
    $('#today_b').innerHTML = `
      <div class="kpi">
        <div>Заезды<b>${t.checkins.length}</b></div><div>Выезды<b>${t.checkouts.length}</b></div><div>Живут<b>${t.inhouse.length}</b></div>
        <div class="${dirty ? 'warn' : ''}">Уборки не закрыты<b>${dirty}</b></div><div class="${debt ? 'bad' : ''}">Долги гостей<b>${money(debt)}</b><div class="d muted">${t.debts.length} брон.</div></div>
        <div>Завтра заездов<b>${t.tomorrow.length}</b></div>
      </div>
      <div class="grid2">
        <div><div class="sec">Заезды сегодня</div>${t.checkins.length ? t.checkins.map(b => line(b, 'in')).join('') : '<div class="empty">нет</div>'}</div>
        <div><div class="sec">Выезды сегодня</div>${t.checkouts.length ? t.checkouts.map(b => line(b, 'out')).join('') : '<div class="empty">нет</div>'}</div>
      </div>`;
  } catch (e) { $('#today_b').innerHTML = '<div class="warn">' + esc(e.message) + '</div>'; }
}

// ---------- месяц ----------
async function loadKpi() {
  $('#m_cur').textContent = ruMonth(MONTH);
  try {
    const k = await api({ a: 'kpi', month: MONTH });
    const c = k.current || {}, p = k.previous || {};
    const isCur = MONTH === A.iso(Date.now() + 5 * 36e5).slice(0, 7);
    $('#kpi_b').className = '';
    $('#kpi_b').innerHTML = `
      <div class="kpi">
        ${kpiTile('Начислено (брони)', c.accrued, p.accrued)}
        ${kpiTile('Касса (оплаты)', c.cash, p.cash)}
        ${kpiTile('Загрузка', c.occupancy, p.occupancy, pct)}
        ${kpiTile('ADR · за ночь', c.adr, p.adr)}
        ${kpiTile('RevPAR', c.revpar, p.revpar)}
        ${kpiTile('Расходы' + (c.rent_is_plan ? ' (аренда по плану)' : ''), c.expenses, p.expenses, money, true)}
        ${kpiTile('EBITDA ≈ начислено − расходы', c.ebitda, p.ebitda)}
      </div>
      <div class="muted" style="font-size:11px">
        ${c.bookings} броней с заездом в месяце · ${c.nights} ночей · ${c.active} активных квартир${isCur ? ' · загрузка до конца месяца по календарю: <b>' + pct(c.occupancy_forward) + '</b>' : ''}
        ${c.sheet_n ? ' · по Google-таблице: <b>' + money(c.sheet_revenue) + '</b> (' + c.sheet_n + ' кв.)' + (c.accrued ? ', разница ' + money(c.sheet_revenue - c.accrued) : '') : ' · в Google-таблице за этот месяц записей нет'}
        · аренда ${money(c.rent)} + операционные ${money(c.opex)}${c.capex ? ' + капвложения ' + money(c.capex) + ' (не в EBITDA)' : ''}
        · <a href="/admin3">P&amp;L по месяцам →</a>
      </div>`;
    drawChart(k.series || []);
  } catch (e) { $('#kpi_b').innerHTML = '<div class="warn">' + esc(e.message) + '</div>'; }
}
function drawChart(series) {
  if (!window.Chart) return;
  const labels = series.map(s => ruMonth(s.month).slice(0, 3) + ' ' + String(s.month).slice(2, 4));
  const ds = [
    { label: 'Начислено', data: series.map(s => s.accrued || 0), borderColor: '#1a6fd1', backgroundColor: '#1a6fd1', tension: .3, pointRadius: 3 },
    { label: 'Касса', data: series.map(s => s.cash || 0), borderColor: '#2f9e5b', backgroundColor: '#2f9e5b', tension: .3, pointRadius: 3 },
    { label: 'Расходы', data: series.map(s => s.expenses || 0), borderColor: '#d9463e', backgroundColor: '#d9463e', tension: .3, pointRadius: 3 },
    { label: 'По таблице', data: series.map(s => s.sheet_revenue || null), borderColor: '#b8923f', backgroundColor: '#b8923f', borderDash: [4, 4], tension: .3, pointRadius: 2 }
  ];
  if (chart) { chart.data.labels = labels; chart.data.datasets = ds; chart.update(); return; }
  chart = new Chart($('#ch13'), { type: 'line', data: { labels, datasets: ds }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: x => ' ' + x.dataset.label + ': ' + money(x.raw) } } }, scales: { y: { ticks: { callback: v => '$' + (v / 1000) + 'k', font: { size: 10 } }, grid: { color: '#eef0f3' } }, x: { ticks: { font: { size: 10 } }, grid: { display: false } } } } });
}

// ---------- загрузка 14 дней ----------
async function loadOcc14() {
  try {
    const d = await api({ a: 'occ14' });
    const arr = d.days || [];
    $('#occ14').className = 'occ14';
    $('#occ14').innerHTML = arr.map(o => { const dt = new Date(o.date + 'T00:00:00Z'), we = dt.getUTCDay() === 0 || dt.getUTCDay() === 6; return `<div><div class="bar" title="${o.date}: занято ${o.busy} из ${d.active}"><i style="height:${o.pct}%"></i></div><b>${o.pct}%</b><span class="${we ? 'we' : ''}">${DN[dt.getUTCDay()]} ${+o.date.slice(8, 10)}</span></div>`; }).join('');
  } catch (e) { $('#occ14').innerHTML = '<div class="warn">' + esc(e.message) + '</div>'; }
}

// ---------- импорт из Google-таблиц ----------
async function importSheets() {
  const b = $('#imp'); b.disabled = true; b.textContent = '⟳ импортирую…';
  try { const r = await api(null, { a: 'import_sheets' }); toast('Импорт: ' + (r.imported != null ? r.imported + ' записей, месяцы ' + (r.months || []).slice(-3).join(', ') + (r.unmapped && r.unmapped.length ? ' · не сопоставлены: ' + r.unmapped.join(', ') : '') : JSON.stringify(r).slice(0, 120)), 7000); loadKpi(); }
  catch (e) { toast('Импорт не удался: ' + e.message, 6000); }
  b.disabled = false; b.textContent = '⟳ импорт из Google-таблиц';
}
})();
