// Urban Luxe — admin/finance.js (14.10.2026). Раздел «Финансы»: перенос admin3 на общий каркас /admin.
// Вкладки: P&L · Расходы · Аренда · Партнёры · Маркетинг · Касса. API — admin-api (те же действия, что admin3-api).
// Выручка в P&L: ручная запись (finance_monthly manual) → импорт из Google-таблиц → живые данные; аренда — запись месяца или условия квартиры.
(function () {
const A = window.ADM, { $, $$, esc, money, pct, ruMonth, addMonths, toast, api, drawer, closeDrawer } = A;
const today = () => A.iso(Date.now() + 5 * 36e5);
let MONTH = today().slice(0, 7), TAB = 'pl', APTS = [], CATS = [], PARTNERS = [], charts = {};
const ml = ym => ruMonth(ym).slice(0, 3) + ' ' + String(ym).slice(2, 4);
const cls = v => v > 0 ? 'up' : v < 0 ? 'down' : '';
const catName = c => (CATS.find(x => x.code === c) || {}).name_ru || c;
const aptShort = id => id ? ((APTS.find(a => a.id === id) || {}).short || id) : 'общий';
const aptOptions = sel => '<option value="">— общий —</option>' + APTS.map(a => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(a.short)}${a.is_active === false ? ' (не на сайте)' : ''}</option>`).join('');
const monthInput = () => `<input type="month" id="f_month" value="${MONTH}">`;
const kill = () => { Object.values(charts).forEach(c => { try { c.destroy(); } catch (e) { } }); charts = {}; };
const chart = (id, cfg) => { if (window.Chart && $('#' + id)) charts[id] = new Chart($('#' + id), cfg); };
const TABS = [['pl', 'P&L'], ['exp', 'Расходы'], ['rent', 'Аренда'], ['partners', 'Партнёры'], ['mkt', 'Маркетинг'], ['cash', 'Касса']];

A.views.finance = async function () {
  const sub = (location.hash.split('/')[1] || '').replace(/[^a-z]/g, ''); if (TABS.some(t => t[0] === sub)) TAB = sub;
  $('#main').innerHTML = `<div class="page"><h2>Финансы <div class="seg" id="ftabs">${TABS.map(t => `<button data-t="${t[0]}" class="${t[0] === TAB ? 'on' : ''}">${t[1]}</button>`).join('')}</div>
    <span class="sp"></span><div class="seg"><button id="m_prev">‹</button><button id="m_lbl" class="on">${ruMonth(MONTH)}</button><button id="m_next">›</button></div></h2><div id="fbody" class="empty">Загрузка…</div></div>`;
  $$('#ftabs button').forEach(b => b.onclick = () => { TAB = b.dataset.t; history.replaceState(null, '', '#finance/' + TAB); $$('#ftabs button').forEach(x => x.classList.toggle('on', x === b)); render(); });
  $('#m_prev').onclick = () => { MONTH = addMonths(MONTH, -1); $('#m_lbl').textContent = ruMonth(MONTH); render(); };
  $('#m_next').onclick = () => { MONTH = addMonths(MONTH, 1); $('#m_lbl').textContent = ruMonth(MONTH); render(); };
  try { [APTS, CATS, PARTNERS] = await Promise.all([api({ a: 'apts' }), api({ a: 'categories' }), api({ a: 'partners' })]); } catch (e) { $('#fbody').innerHTML = '<div class="warn">' + esc(e.message) + '</div>'; return; }
  render();
};
function render() { kill(); const f = $('#fbody'); if (!f) return; f.className = 'empty'; f.textContent = 'Загрузка…'; (R[TAB] || R.pl)().catch(e => { f.innerHTML = '<div class="warn">' + esc(e.message) + '</div>'; }); }
const R = {};
const body = html => { const f = $('#fbody'); f.className = ''; f.innerHTML = html; };

// ---------------- P&L ----------------
R.pl = async () => {
  const d = await api({ a: 'pl', from: addMonths(MONTH, -11), to: MONTH }); const M = d.months;
  const cats = d.categories.filter(c => M.some(m => (m.by_category[c.code] || 0) !== 0));
  const row = (label, f, c) => `<tr><td>${label}</td>${M.map(m => `<td class="num ${c ? cls(f(m)) : ''}">${money(f(m))}</td>`).join('')}</tr>`;
  body(`<div class="card"><h3>P&amp;L · 12 месяцев до ${ruMonth(MONTH)}<span class="sp"></span>
      <button class="sm" id="pl_manual">+ выручка вручную</button><button class="sm" id="pl_imp">⟳ из Google-таблиц</button><button class="sm" id="pl_csv">CSV</button></h3>
      <div class="chart" style="height:220px"><canvas id="chPL"></canvas></div></div>
    <div class="card" style="overflow:auto"><table class="t" id="plTable"><thead><tr><th>Статья</th>${M.map(m => `<th class="num">${ml(m.month)}</th>`).join('')}</tr></thead><tbody>
      <tr><td class="muted">Квартир / ночей</td>${M.map(m => `<td class="num muted">${m.apartments} / ${m.nights || '—'}</td>`).join('')}</tr>
      ${row('<b>Выручка</b>', m => m.revenue)}${row('Аренда собственникам', m => -m.rent)}${row('Комиссии площадок', m => -m.commission)}${row('<b>Валовая прибыль</b>', m => m.gross, 1)}
      ${cats.filter(c => !['dividend', 'credit', 'rent'].includes(c.kind)).map(c => row('&nbsp;&nbsp;' + esc(c.name_ru), m => -(m.by_category[c.code] || 0))).join('')}
      ${row('<b>EBITDA</b>', m => m.ebitda, 1)}${row('Доля партнёров', m => -m.partner_share)}${row('<b>Результат Urban Luxe</b>', m => m.net, 1)}
      <tr><td class="muted">Маржа UL</td>${M.map(m => `<td class="num muted">${m.revenue ? pct(100 * m.net / m.revenue) : '—'}</td>`).join('')}</tr>
      ${row('Дивиденды', m => -m.dividends)}${row('Кредит', m => -m.credit)}
      <tr><td class="muted">Источник выручки</td>${M.map(m => `<td class="num muted" style="font-size:10px">${Object.entries(m.sources).map(([k, v]) => k + ':' + v).join(' ') || '—'}</td>`).join('')}</tr>
    </tbody></table>
    <div class="muted" style="font-size:11px;margin-top:8px">Выручка: ручная запись → импорт из Google-таблиц → живые данные. По базе (брони × ночи) — см. Дашборд и Аналитику. Аренда — из записи месяца или из условий квартиры. Доля партнёров — % от прибыли их квартир после аренды, комиссий и общих расходов.</div></div>`);
  $('#pl_manual').onclick = () => openFinance(); $('#pl_imp').onclick = importSheets; $('#pl_csv').onclick = () => csvTable('plTable', 'pl-' + MONTH + '.csv');
  chart('chPL', { type: 'bar', data: { labels: M.map(x => ml(x.month)), datasets: [{ label: 'Валовая', data: M.map(x => x.gross), backgroundColor: '#b8923f' }, { label: 'Opex', data: M.map(x => -x.expenses_opex), backgroundColor: '#d9463e' }, { label: 'Результат UL', data: M.map(x => x.net), type: 'line', borderColor: '#2f9e5b', backgroundColor: '#2f9e5b', tension: .3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } }, scales: { x: { stacked: true, ticks: { font: { size: 10 } } }, y: { stacked: true, ticks: { callback: v => '$' + (v / 1000) + 'k', font: { size: 10 } } } } } });
};
async function importSheets() { toast('Импортирую из Google-таблиц…'); try { const r = await api(null, { a: 'import_sheets' }); toast('Импортировано ' + r.imported + ' строк' + (r.unmapped && r.unmapped.length ? ' · не сопоставлены: ' + r.unmapped.join(', ') : ''), 6000); render(); } catch (e) { toast('Ошибка импорта: ' + e.message, 6000); } }
function csvTable(id, name) { const t = $('#' + id); if (!t) return; const rows = [...t.querySelectorAll('tr')].map(tr => [...tr.children].map(td => '"' + td.innerText.replace(/"/g, '""') + '"').join(';')); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click(); }
function openFinance(aptId) {
  drawer('Выручка за месяц (вручную)', `<p class="muted" style="margin-top:0">Перекрывает импорт из таблиц и живые данные за этот месяц по этой квартире.</p><div class="f">
    <label class="w">Квартира<select id="m_apt">${aptOptions(aptId)}</select></label>
    <label>Месяц<input id="m_month" type="month" value="${MONTH}"></label><label>Выручка, $<input id="m_rev" type="number"></label>
    <label>Аренда, $<input id="m_rent" type="number"></label><label>Комиссия площадок, $<input id="m_com" type="number" value="0"></label>
    <label>Ночей<input id="m_n" type="number"></label><label style="justify-content:flex-end"><span><input type="checkbox" id="m_p"> партнёрская</span></label>
    <label class="w">Заметка<input id="m_notes"></label></div>`, `<button class="pri" id="m_ok">Сохранить</button><button onclick="ADM.closeDrawer()">Отмена</button>`);
  $('#m_ok').onclick = async () => { const b = { a: 'finance', apartment_id: $('#m_apt').value || null, month: $('#m_month').value, revenue: $('#m_rev').value, rent: $('#m_rent').value, commission: $('#m_com').value, nights: $('#m_n').value, is_partner: $('#m_p').checked, notes: $('#m_notes').value }; if (!b.apartment_id) { toast('Выберите квартиру'); return; } try { await api(null, b); closeDrawer(); toast('Сохранено'); render(); } catch (e) { toast(e.message); } };
}

// ---------------- РАСХОДЫ ----------------
R.exp = async () => {
  const list = await api({ a: 'expenses', month: MONTH }); const tot = list.reduce((s, e) => s + (+e.amount || 0), 0);
  const byCat = {}; list.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + (+e.amount || 0); });
  const ent = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  body(`<div class="grid2" style="grid-template-columns:2fr 1fr"><div class="card"><h3>Расходы · ${ruMonth(MONTH)}<span class="sp"></span><button class="pri sm" id="e_new">+ расход</button></h3>
    <table class="t"><thead><tr><th>Дата</th><th>Квартира</th><th>Категория</th><th>Описание</th><th class="num">Сумма</th><th>50/50</th><th></th></tr></thead><tbody>
    ${list.map(e => `<tr><td class="nowrap">${A.ruD(e.expense_date)}</td><td>${esc(aptShort(e.apartment_id))}</td><td>${esc(catName(e.category))}</td><td>${esc(e.description || '')}${e.vendor ? ' <span class="muted">· ' + esc(e.vendor) + '</span>' : ''}${e.paid_by ? ' <span class="muted">· оплатил ' + esc(e.paid_by) + '</span>' : ''}</td><td class="num">${money(e.amount)}${e.amount_uzs ? `<div class="muted" style="font-size:10px">${Math.round(e.amount_uzs).toLocaleString('ru-RU')} сум</div>` : ''}</td><td>${e.partner_shared ? '✓' : ''}</td><td class="nowrap"><button class="sm" data-ed="${e.id}">✎</button> <button class="sm danger" data-del="${e.id}">✕</button></td></tr>`).join('') || '<tr><td class="muted" colspan="7">Расходов за месяц нет. Внесите аренду, зарплаты, коммуналку, расходники — тогда P&L и EBITDA на дашборде станут полными.</td></tr>'}
    </tbody><tfoot><tr><th colspan="4">Итого</th><th class="num">${money(tot)}</th><th></th><th></th></tr></tfoot></table></div>
    <div class="card"><h3>По категориям</h3><div class="chart" style="height:200px"><canvas id="chCat"></canvas></div><table class="t" style="margin-top:8px">${ent.map(([c, v]) => `<tr><td>${esc(catName(c))}</td><td class="num">${money(v)}</td><td class="num muted">${pct(100 * v / (tot || 1))}</td></tr>`).join('')}</table></div></div>`);
  $('#e_new').onclick = () => openExpense();
  $$('#fbody [data-ed]').forEach(b => b.onclick = () => openExpense(null, list.find(e => e.id === b.dataset.ed)));
  $$('#fbody [data-del]').forEach(b => b.onclick = async () => { if (!confirm('Удалить расход?')) return; await api(null, { a: 'expense_delete', id: b.dataset.del }); render(); });
  if (ent.length) chart('chCat', { type: 'doughnut', data: { labels: ent.map(e => catName(e[0])), datasets: [{ data: ent.map(e => e[1]), backgroundColor: ['#b8923f', '#1a6fd1', '#2f9e5b', '#d9463e', '#e0a71e', '#8a919b', '#7fb4ff', '#f0c27b', '#9fd8b4', '#b06bd6'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } } } });
};
function openExpense(aptId, e) {
  e = e || { apartment_id: aptId || '', expense_date: today(), category: 'utilities' };
  drawer(e.id ? 'Расход' : 'Новый расход', `<div class="f">
    <label>Дата<input id="e_date" type="date" value="${e.expense_date}"></label>
    <label>Категория<select id="e_cat">${CATS.map(c => `<option value="${c.code}" ${c.code === e.category ? 'selected' : ''}>${esc(c.name_ru)}</option>`).join('')}</select></label>
    <label class="w">Квартира (пусто = общий расход)<select id="e_apt">${aptOptions(e.apartment_id)}</select></label>
    <label>Сумма, $<input id="e_amt" type="number" step="0.01" value="${e.amount ?? ''}"></label>
    <label>Сумма в сумах (справочно)<input id="e_uzs" type="number" value="${e.amount_uzs ?? ''}"></label>
    <label class="w">Описание<input id="e_desc" value="${esc(e.description || '')}"></label>
    <label>Поставщик / кому<input id="e_vendor" value="${esc(e.vendor || '')}"></label>
    <label>Кто оплатил<input id="e_paid" value="${esc(e.paid_by || '')}"></label>
    <label class="w"><span><input type="checkbox" id="e_shared" ${e.partner_shared ? 'checked' : ''}> делится с партнёром 50/50 (вычитается из прибыли партнёрской квартиры)</span></label></div>`,
    `<button class="pri" id="e_ok">Сохранить</button><button onclick="ADM.closeDrawer()">Отмена</button>`);
  $('#e_uzs').oninput = function () { if (!$('#e_amt').value && this.value) $('#e_amt').value = (this.value / 12800).toFixed(2); };
  $('#e_ok').onclick = async () => { const b = { a: 'expense', id: e.id || undefined, expense_date: $('#e_date').value, category: $('#e_cat').value, apartment_id: $('#e_apt').value || null, amount: $('#e_amt').value, amount_uzs: $('#e_uzs').value || null, description: $('#e_desc').value, vendor: $('#e_vendor').value, paid_by: $('#e_paid').value, partner_shared: $('#e_shared').checked }; if (!(+b.amount)) { toast('Введите сумму'); return; } try { await api(null, b); closeDrawer(); toast('Сохранено'); render(); } catch (er) { toast(er.message); } };
}

// ---------------- АРЕНДА (график платежей собственникам) ----------------
R.rent = async () => {
  const [terms, exps] = await Promise.all([api({ a: 'terms' }), api({ a: 'expenses', month: MONTH })]);
  const m0 = MONTH + '-01';
  const cur = {}; terms.forEach(t => { if (t.valid_from <= addMonths(MONTH, 1) + '-01' && (!t.valid_to || t.valid_to >= m0)) { if (!cur[t.apartment_id] || cur[t.apartment_id].valid_from < t.valid_from) cur[t.apartment_id] = t; } });
  const paid = {}; exps.filter(e => e.category === 'rent' && e.apartment_id).forEach(e => { paid[e.apartment_id] = (paid[e.apartment_id] || 0) + (+e.amount || 0); });
  const generalRent = exps.filter(e => e.category === 'rent' && !e.apartment_id).reduce((s, e) => s + (+e.amount || 0), 0);
  const rows = APTS.filter(a => a.is_active !== false || cur[a.id]).map(a => Object.assign({ apt: a }, { t: cur[a.id] || null, paid: paid[a.id] || 0 }));
  const plan = rows.reduce((s, r) => s + (r.t ? +r.t.rent || 0 : 0), 0), paidSum = rows.reduce((s, r) => s + r.paid, 0);
  const MODEL = { sublease: 'субаренда', partner: 'партнёр', management: 'управление', own: 'своя' };
  body(`<div class="kpi"><div>План аренды<b>${money(plan)}</b><div class="d muted">${rows.filter(r => r.t).length} квартир с условиями</div></div><div>Оплачено по квартирам<b>${money(paidSum)}</b><div class="d muted">${rows.filter(r => r.paid > 0).length} кв.</div></div>${generalRent ? `<div>Аренда общей строкой<b>${money(generalRent)}</b><div class="d muted">расход без квартиры</div></div>` : ''}<div class="${plan - paidSum - generalRent > 0 ? 'warn' : ''}">Осталось<b>${money(Math.max(0, plan - paidSum - generalRent))}</b></div></div>
    <div class="card"><h3>Аренда собственникам · ${ruMonth(MONTH)}<span class="n">нажмите «оплачено» — запишется расход категории «Аренда» по квартире</span><span class="sp"></span><button class="sm" id="t_new">+ условия</button></h3>
    <table class="t"><thead><tr><th>Квартира</th><th>Модель</th><th class="num">Аренда/мес</th><th>Собственник</th><th>Договор до</th><th class="num">Оплачено</th><th></th></tr></thead><tbody>
    ${rows.map(r => `<tr><td class="b">${esc(r.apt.short)}${r.apt.is_active === false ? ' <span class="tag">не на сайте</span>' : ''}</td>
      <td>${r.t ? `<span class="tag">${MODEL[r.t.model] || r.t.model}</span>${r.t.partners ? ' <span class="muted">' + esc(r.t.partners.name) + ' ' + (r.t.partner_share || 50) + '%</span>' : ''}` : '<span class="muted">нет условий</span>'}</td>
      <td class="num">${r.t ? money(r.t.rent) : '—'}</td><td>${r.t ? esc(r.t.owner_name || '') + (r.t.owner_phone ? ' <span class="muted">' + esc(r.t.owner_phone) + '</span>' : '') : ''}</td>
      <td>${r.t && r.t.lease_end ? (r.t.lease_end < A.addD(today(), 45) ? '<span class="tag bad">' : '<span>') + A.ruD(r.t.lease_end) + '.' + r.t.lease_end.slice(0, 4) + '</span>' : ''}</td>
      <td class="num ${r.t && r.paid >= +r.t.rent ? 'up' : r.paid ? '' : 'muted'}">${r.paid ? money(r.paid) : '—'}</td>
      <td class="nowrap">${r.t && +r.t.rent > 0 && r.paid < +r.t.rent ? `<button class="sm ok" data-pay="${r.apt.id}">оплачено</button> ` : ''}<button class="sm" data-term="${r.apt.id}" data-tid="${r.t ? r.t.id : ''}">условия</button></td></tr>`).join('')}
    </tbody></table></div>`);
  $('#t_new').onclick = () => openTerm();
  $$('#fbody [data-term]').forEach(b => b.onclick = () => openTerm(b.dataset.term, b.dataset.tid || null, terms));
  $$('#fbody [data-pay]').forEach(b => b.onclick = async () => { const r = rows.find(x => x.apt.id === b.dataset.pay); const amt = prompt('Сумма аренды за ' + ruMonth(MONTH) + ', $', String(+r.t.rent - r.paid)); if (amt === null || !(+amt)) return; try { await api(null, { a: 'expense', expense_date: MONTH + '-' + (today().slice(0, 7) === MONTH ? today().slice(8, 10) : '05'), category: 'rent', apartment_id: r.apt.id, amount: +amt, description: 'Аренда ' + ruMonth(MONTH) + (r.t.owner_name ? ' · ' + r.t.owner_name : '') }); toast('Записано'); render(); } catch (e) { toast(e.message); } });
};
function openTerm(aptId, termId, all, onDone) {
  const done = onDone || render;
  let t = { apartment_id: aptId || '', model: 'sublease', rent: '', partner_share: 50, valid_from: MONTH + '-01' };
  if (termId && all) t = all.find(x => x.id === termId) || t;
  const opt = (v, cur, label) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${label}</option>`;
  drawer(termId ? 'Условия по квартире' : 'Новые условия', `<div class="f">
    <label class="w">Квартира<select id="f_apt">${aptOptions(t.apartment_id)}</select></label>
    <label>Модель<select id="f_model">${opt('sublease', t.model, 'Субаренда (аренда у собственника)')}${opt('partner', t.model, 'Партнёр 50/50')}${opt('management', t.model, 'Управление (% выручки)')}${opt('own', t.model, 'Своя квартира')}</select></label>
    <label>Аренда собственнику, $/мес<input id="f_rent" type="number" step="1" value="${t.rent ?? ''}"></label>
    <label>Партнёр<select id="f_partner"><option value="">—</option>${PARTNERS.map(p => opt(p.id, t.partner_id, esc(p.name))).join('')}</select></label>
    <label>Доля партнёра, %<input id="f_share" type="number" value="${t.partner_share ?? 50}"></label>
    <label>Комиссия управления, % выручки<input id="f_fee" type="number" value="${t.mgmt_fee_pct ?? ''}"></label>
    <label>Депозит, $<input id="f_dep" type="number" value="${t.deposit ?? ''}"></label>
    <label>Запуск (мебель/техника), $<input id="f_launch" type="number" value="${t.launch_cost ?? ''}"></label>
    <label>Действует с<input id="f_from" type="date" value="${t.valid_from || ''}"></label>
    <label>Действует по<input id="f_to" type="date" value="${t.valid_to || ''}"></label>
    <label>Договор аренды до<input id="f_lease" type="date" value="${t.lease_end || ''}"></label>
    <label>Собственник<input id="f_owner" value="${esc(t.owner_name || '')}"></label>
    <label>Телефон собственника<input id="f_ophone" value="${esc(t.owner_phone || '')}"></label>
    <label class="w">Заметка<input id="f_notes" value="${esc(t.notes || '')}"></label></div>`,
    `<button class="pri" id="f_ok">Сохранить</button><button onclick="ADM.closeDrawer()">Отмена</button><span class="sp"></span>${termId ? '<button class="danger" id="f_del">удалить</button>' : ''}`);
  $('#f_ok').onclick = async () => { const b = { a: 'term', id: termId || undefined, apartment_id: $('#f_apt').value, model: $('#f_model').value, rent: $('#f_rent').value, partner_id: $('#f_partner').value || null, partner_share: $('#f_share').value, mgmt_fee_pct: $('#f_fee').value || null, deposit: $('#f_dep').value, launch_cost: $('#f_launch').value, valid_from: $('#f_from').value, valid_to: $('#f_to').value || null, lease_end: $('#f_lease').value || null, owner_name: $('#f_owner').value, owner_phone: $('#f_ophone').value, notes: $('#f_notes').value }; if (!b.apartment_id) { toast('Выберите квартиру'); return; } try { await api(null, b); closeDrawer(); toast('Сохранено'); done(); } catch (e) { toast(e.message); } };
  if ($('#f_del')) $('#f_del').onclick = async () => { if (!confirm('Удалить условия?')) return; await api(null, { a: 'term_delete', id: termId }); closeDrawer(); done(); };
}
// условия нужны и в разделе «Квартиры»: подгружаем справочники, если раздел «Финансы» ещё не открывали
A.openTerm = async (aptId, termId, all, onDone) => { if (!APTS.length) { [APTS, CATS, PARTNERS] = await Promise.all([api({ a: 'apts' }), api({ a: 'categories' }), api({ a: 'partners' })]); } openTerm(aptId, termId, all, onDone); };

// ---------------- ПАРТНЁРЫ ----------------
R.partners = async () => {
  PARTNERS = await api({ a: 'partners' });
  const act = PARTNERS.filter(p => p.is_active !== false);
  const reports = await Promise.all(act.map(p => api({ a: 'partner_report', partner_id: p.id, month: MONTH }).catch(() => null)));
  body(`<div class="card"><h3>Партнёры · ${ruMonth(MONTH)}<span class="sp"></span><button class="pri sm" id="p_new">+ партнёр</button></h3>${act.length ? '' : '<div class="empty">Партнёров нет</div>'}</div>` +
    reports.map((r, i) => { const p = act[i]; if (!r) return `<div class="card"><b>${esc(p.name)}</b> <span class="muted">отчёт не загрузился</span></div>`; const t = r.totals || {};
      return `<div class="card"><h3>${esc(p.name)} <span class="n">${esc(p.phone || '')} ${esc(p.telegram || '')} · ${r.rows.length} кв.</span><span class="sp"></span><button class="sm" data-pe="${p.id}">✎</button> <button class="sm" data-pr="${i}">🖨 отчёт для партнёра</button></h3>
      <div class="kpi"><div>Выручка<b>${money(t.revenue)}</b></div><div>Аренда + комиссии + общие<b>${money((t.rent || 0) + (t.commission || 0) + (t.shared_expenses || 0))}</b></div><div>Прибыль к разделу<b>${money(t.profit)}</b></div><div>Партнёру<b style="color:var(--gold)">${money(t.partner_amount)}</b></div><div>Urban Luxe<b class="up">${money(t.ul_amount)}</b></div></div>
      <table class="t"><thead><tr><th>Квартира</th><th class="num">Выручка</th><th class="num">Ночей</th><th class="num">Аренда</th><th class="num">Комиссия</th><th class="num">Общие</th><th class="num">Прибыль</th><th class="num">%</th><th class="num">Партнёру</th><th class="num">UL</th><th>Источник</th></tr></thead><tbody>${r.rows.map(x => `<tr><td>${esc(x.short)}</td><td class="num">${money(x.revenue)}</td><td class="num">${x.nights}</td><td class="num">${money(x.rent)}</td><td class="num">${money(x.commission)}</td><td class="num">${money(x.shared_expenses)}</td><td class="num ${cls(x.profit)}">${money(x.profit)}</td><td class="num">${x.partner_share_pct}%</td><td class="num">${money(x.partner_amount)}</td><td class="num">${money(x.ul_amount)}</td><td><span class="tag">${x.source || '—'}</span></td></tr>`).join('') || '<tr><td class="muted" colspan="11">нет квартир с моделью «партнёр» — назначьте во вкладке «Аренда» → условия</td></tr>'}</tbody></table></div>`; }).join(''));
  $('#p_new').onclick = () => openPartner();
  $$('#fbody [data-pe]').forEach(b => b.onclick = () => openPartner(PARTNERS.find(p => p.id === b.dataset.pe)));
  $$('#fbody [data-pr]').forEach(b => b.onclick = () => printPartner(reports[+b.dataset.pr]));
};
function openPartner(p) {
  p = p || { default_share: 50 };
  drawer(p.id ? 'Партнёр' : 'Новый партнёр', `<div class="f"><label class="w">Имя<input id="p_name" value="${esc(p.name || '')}"></label><label>Телефон<input id="p_phone" value="${esc(p.phone || '')}"></label><label>Telegram<input id="p_tg" value="${esc(p.telegram || '')}"></label><label>Email (для кабинета /pms)<input id="p_email" value="${esc(p.email || '')}"></label><label>Доля по умолчанию, %<input id="p_share" type="number" value="${p.default_share ?? 50}"></label><label class="w">Заметки<textarea id="p_notes" rows="2">${esc(p.notes || '')}</textarea></label></div>`, `<button class="pri" id="p_ok">Сохранить</button><button onclick="ADM.closeDrawer()">Отмена</button>`);
  $('#p_ok').onclick = async () => { const b = { a: 'partner', id: p.id || undefined, name: $('#p_name').value, phone: $('#p_phone').value, telegram: $('#p_tg').value, email: $('#p_email').value, default_share: $('#p_share').value, notes: $('#p_notes').value }; if (!b.name) { toast('Укажите имя'); return; } try { await api(null, b); closeDrawer(); toast('Сохранено'); render(); } catch (e) { toast(e.message); } };
}
function printPartner(r) {
  if (!r) return; const w = window.open('', '_blank');
  w.document.write(`<html><head><meta charset="utf-8"><title>Отчёт ${esc(r.partner.name)} ${ruMonth(r.month)}</title><style>body{font:14px Arial;padding:30px;color:#111}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px 8px;text-align:right}td:first-child,th:first-child{text-align:left}h1{font-size:20px}.g{color:#777}</style></head><body><h1>Urban Luxe · отчёт партнёра</h1><div>${esc(r.partner.name)} · ${ruMonth(r.month)}</div><br><table><tr><th>Квартира</th><th>Выручка</th><th>Ночей</th><th>Аренда</th><th>Комиссия</th><th>Общие расходы</th><th>Прибыль</th><th>Доля</th><th>К выплате партнёру</th></tr>${r.rows.map(x => `<tr><td>${esc(x.short)}</td><td>${money(x.revenue)}</td><td>${x.nights}</td><td>${money(x.rent)}</td><td>${money(x.commission)}</td><td>${money(x.shared_expenses)}</td><td>${money(x.profit)}</td><td>${x.partner_share_pct}%</td><td><b>${money(x.partner_amount)}</b></td></tr>`).join('')}<tr><th colspan="6">Итого</th><th>${money(r.totals.profit)}</th><th></th><th>${money(r.totals.partner_amount)}</th></tr></table><br><div class="g">Прибыль = выручка − аренда собственнику − комиссии площадок − согласованные общие расходы. Сформировано ${new Date().toLocaleDateString('ru-RU')}.</div><script>window.print()<\/script></body></html>`); w.document.close();
}

// ---------------- МАРКЕТИНГ ----------------
R.mkt = async () => {
  const list = await api({ a: 'marketing', from: addMonths(MONTH, -2), to: MONTH });
  const byM = {}; list.forEach(x => { const k = x.spend_date.slice(0, 7) + '|' + x.channel; byM[k] = byM[k] || { amount: 0, clicks: 0, tg: 0, leads: 0, bookings: 0 }; byM[k].amount += +x.amount_usd; byM[k].clicks += +x.clicks; byM[k].tg += +x.tg_clicks; byM[k].leads += +x.leads; byM[k].bookings += +x.bookings; });
  const months = [addMonths(MONTH, -2), addMonths(MONTH, -1), MONTH], ch = ['yandex', 'meta', 'google', 'instagram', 'telegram', 'other'], cn = { yandex: 'Яндекс Директ', meta: 'Meta', google: 'Google Ads', instagram: 'Instagram', telegram: 'Telegram', other: 'Другое' };
  const f1 = v => v == null || isNaN(v) ? '—' : '$' + (Math.round(v * 10) / 10).toLocaleString('ru-RU');
  body(`<div class="grid2" style="grid-template-columns:3fr 2fr"><div class="card"><h3>Маркетинг · по каналам<span class="sp"></span><button class="pri sm" id="k_new">+ запись</button></h3>
    <table class="t"><thead><tr><th>Канал</th>${months.map(m => `<th colspan="3" class="num">${ml(m)}</th>`).join('')}</tr><tr><th></th>${months.map(() => '<th class="num">$</th><th class="num">TG-клики</th><th class="num">$/TG</th>').join('')}</tr></thead><tbody>
    ${ch.map(c => `<tr><td>${cn[c]}</td>${months.map(m => { const v = byM[m + '|' + c] || {}; return `<td class="num">${v.amount ? money(v.amount) : '—'}</td><td class="num">${v.tg || '—'}</td><td class="num">${v.tg ? f1(v.amount / v.tg) : '—'}</td>`; }).join('')}</tr>`).join('')}
    <tr><th>Итого</th>${months.map(m => { let a = 0, t = 0; ch.forEach(c => { const v = byM[m + '|' + c]; if (v) { a += v.amount; t += v.tg; } }); return `<th class="num">${money(a)}</th><th class="num">${t}</th><th class="num">${t ? f1(a / t) : '—'}</th>`; }).join('')}</tr></tbody></table>
    <div class="muted" style="font-size:11px;margin-top:8px">Сделки закрываются в Telegram — главный KPI: цена TG-клика (цель TG_CLICK в Метрике / Meta / Google) и брони по хэштегам #сайт / #meta.</div></div>
    <div class="card"><h3>Записи</h3><div style="max-height:60vh;overflow:auto"><table class="t">${list.map(x => `<tr><td class="nowrap">${A.ruD(x.spend_date)}</td><td>${cn[x.channel] || esc(x.channel)}</td><td class="muted">${esc(x.campaign || '')}</td><td class="num">${money(x.amount_usd)}</td><td class="num">${x.tg_clicks} tg</td><td><button class="sm danger" data-km="${x.id}">✕</button></td></tr>`).join('') || '<tr><td class="muted">нет записей</td></tr>'}</table></div></div></div>`);
  $('#k_new').onclick = () => { drawer('Расход на рекламу', `<div class="f"><label>Дата<input id="k_date" type="date" value="${today()}"></label><label>Канал<select id="k_ch">${ch.map(c => `<option value="${c}">${cn[c]}</option>`).join('')}</select></label><label class="w">Кампания<input id="k_camp"></label><label>Расход, $<input id="k_amt" type="number" step="0.01"></label><label>Показы<input id="k_imp" type="number"></label><label>Клики<input id="k_clk" type="number"></label><label>TG-клики<input id="k_tg" type="number"></label><label>Заявки<input id="k_leads" type="number"></label><label>Брони<input id="k_book" type="number"></label></div>`, `<button class="pri" id="k_ok">Сохранить</button><button onclick="ADM.closeDrawer()">Отмена</button>`);
    $('#k_ok').onclick = async () => { try { await api(null, { a: 'marketing', spend_date: $('#k_date').value, channel: $('#k_ch').value, campaign: $('#k_camp').value, amount_usd: $('#k_amt').value, impressions: $('#k_imp').value, clicks: $('#k_clk').value, tg_clicks: $('#k_tg').value, leads: $('#k_leads').value, bookings: $('#k_book').value }); closeDrawer(); toast('Сохранено'); render(); } catch (e) { toast(e.message); } }; };
  $$('#fbody [data-km]').forEach(b => b.onclick = async () => { if (!confirm('Удалить запись?')) return; await api(null, { a: 'marketing_delete', id: b.dataset.km }); render(); });
};

// ---------------- КАССА (остатки по месяцам) ----------------
R.cash = async () => {
  const rows = await api({ a: 'cash' });
  body(`<div class="card"><h3>Касса · остатки на начало/конец месяца<span class="n">сверка с ОДДС: план (closing) и факт (closing_fact)</span><span class="sp"></span><button class="pri sm" id="c_new">+ месяц</button></h3>
    <table class="t"><thead><tr><th>Месяц</th><th class="num">На начало</th><th class="num">На конец (расчёт)</th><th class="num">На конец (факт)</th><th class="num">Разница</th><th>Заметка</th><th></th></tr></thead><tbody>
    ${rows.slice().reverse().map(r => `<tr><td>${ruMonth(r.month.slice(0, 7))}</td><td class="num">${money(r.opening)}</td><td class="num">${money(r.closing)}</td><td class="num">${r.closing_fact == null ? '—' : money(r.closing_fact)}</td><td class="num ${r.closing_fact == null ? '' : cls(r.closing_fact - r.closing)}">${r.closing_fact == null ? '—' : money(r.closing_fact - r.closing)}</td><td class="muted">${esc(r.notes || '')}</td><td><button class="sm" data-c="${r.month.slice(0, 7)}">✎</button></td></tr>`).join('') || '<tr><td class="muted" colspan="7">записей нет</td></tr>'}</tbody></table></div>`);
  const open = m => { const r = rows.find(x => x.month.slice(0, 7) === m) || { month: m }; drawer('Касса · ' + ruMonth(m), `<div class="f"><label>Месяц<input id="c_m" type="month" value="${m}"></label><label>На начало, $<input id="c_o" type="number" value="${r.opening ?? ''}"></label><label>На конец (расчёт), $<input id="c_c" type="number" value="${r.closing ?? ''}"></label><label>На конец (факт), $<input id="c_f" type="number" value="${r.closing_fact ?? ''}"></label><label class="w">Заметка<input id="c_n" value="${esc(r.notes || '')}"></label></div>`, `<button class="pri" id="c_ok">Сохранить</button><button onclick="ADM.closeDrawer()">Отмена</button>`);
    $('#c_ok').onclick = async () => { try { await api(null, { a: 'cash', month: $('#c_m').value, opening: $('#c_o').value, closing: $('#c_c').value, closing_fact: $('#c_f').value === '' ? null : $('#c_f').value, notes: $('#c_n').value }); closeDrawer(); toast('Сохранено'); render(); } catch (e) { toast(e.message); } }; };
  $('#c_new').onclick = () => open(MONTH);
  $$('#fbody [data-c]').forEach(b => b.onclick = () => open(b.dataset.c));
};
})();
