// Urban Luxe — admin/staff.js (14.10.2026). Персонал: сотрудники (staff), табель по дням (staff_attendance), уборки из HK-бота как подсказка,
// расчёт за месяц (дни × ставка) и выплаты (staff_payments). Ставки и выплаты видит только admin (API режет для ops).
(function () {
const A = window.ADM, { $, $$, esc, toast, api, drawer, closeDrawer, ruMonth, addMonths, ruD, DN } = A;
const today = () => A.iso(Date.now() + 5 * 36e5);
let MONTH = today().slice(0, 7), D = null;
const ROLE = { cleaning: 'горничная', supervisor: 'старшая', booker: 'бронер', ops: 'опер-менеджер', tech: 'техник', other: 'другое' };

A.views.staff = function () {
  $('#main').innerHTML = `<div class="page"><h2>Персонал <div class="seg"><button id="s_prev">‹</button><button id="s_lbl" class="on">${ruMonth(MONTH)}</button><button id="s_next">›</button></div>
      <span class="n muted">табель: клик по дню — отметка; ✓ — вышел, 🧹 — уборки по боту</span><span class="sp"></span>${A.ME.role === 'admin' ? '<button class="pri sm" id="s_new">+ сотрудник</button>' : ''}</h2><div id="s_body" class="empty">Загрузка…</div></div>`;
  $('#s_prev').onclick = () => { MONTH = addMonths(MONTH, -1); $('#s_lbl').textContent = ruMonth(MONTH); load(); };
  $('#s_next').onclick = () => { MONTH = addMonths(MONTH, 1); $('#s_lbl').textContent = ruMonth(MONTH); load(); };
  if ($('#s_new')) $('#s_new').onclick = () => edit(null);
  load();
};
async function load() {
  try { D = await api({ a: 'staff_month', month: MONTH }); } catch (e) { $('#s_body').innerHTML = '<div class="warn">' + esc(e.message) + '</div>'; return; }
  const dim = Math.round((new Date(addMonths(MONTH, 1) + '-01') - new Date(MONTH + '-01')) / 864e5), days = Array.from({ length: dim }, (_, i) => MONTH + '-' + String(i + 1).padStart(2, '0'));
  const att = {}; D.attendance.forEach(a => { att[a.staff_id + '|' + a.work_date] = a; });
  const cl = {}; D.cleanings.forEach(c => { if (c.hk_maid) { const k = c.hk_maid.trim().toLowerCase(); cl[k + '|' + c.date] = (cl[k + '|' + c.date] || 0) + 1; } });
  const isAdmin = A.ME.role === 'admin';
  const rows = D.staff.map(s => {
    const present = days.filter(d => (att[s.id + '|' + d] || {}).present).length;
    const paid = D.payments.filter(p => p.staff_id === s.id).reduce((a, p) => a + (+p.amount || 0), 0);
    const cleanN = days.reduce((a, d) => a + (cl[String(s.name).trim().toLowerCase() + '|' + d] || 0), 0);
    const due = s.daily_rate ? present * s.daily_rate : null;
    return { s, present, paid, cleanN, due };
  });
  $('#s_body').className = '';
  $('#s_body').innerHTML = `<div class="card" style="overflow:auto"><table class="t tabel"><thead><tr><th>Сотрудник</th>${days.map(d => `<th class="${[0, 6].includes(new Date(d + 'T00:00:00Z').getUTCDay()) ? 'we' : ''} ${d === today() ? 'td' : ''}">${+d.slice(8, 10)}<br><span class="muted">${DN[new Date(d + 'T00:00:00Z').getUTCDay()]}</span></th>`).join('')}<th class="num">Дней</th>${isAdmin ? '<th class="num">Ставка</th><th class="num">К выплате</th><th class="num">Выплачено</th><th class="num">Остаток</th>' : ''}<th></th></tr></thead><tbody>
    ${rows.map(r => `<tr class="${r.s.is_active ? '' : 'muted'}"><td class="b nowrap">${esc(r.s.name)} <span class="muted" style="font-weight:400">${ROLE[r.s.role] || esc(r.s.role || '')}</span>${r.s.is_active ? '' : ' <span class="tag">выкл</span>'}</td>
      ${days.map(d => { const a = att[r.s.id + '|' + d]; const c = cl[String(r.s.name).trim().toLowerCase() + '|' + d]; return `<td class="dc ${a && a.present ? 'on' : ''} ${d > today() ? 'fut' : ''}" data-s="${r.s.id}" data-d="${d}" title="${d}${c ? ' · уборок по боту: ' + c : ''}">${a && a.present ? '✓' : c ? '🧹' : ''}</td>`; }).join('')}
      <td class="num b">${r.present}${r.cleanN ? '<div class="muted" style="font-size:10px">🧹 ' + r.cleanN + '</div>' : ''}</td>
      ${isAdmin ? `<td class="num">${r.s.daily_rate ? r.s.daily_rate.toLocaleString('ru-RU') : '—'}</td><td class="num">${r.due != null ? r.due.toLocaleString('ru-RU') : '—'}</td><td class="num">${r.paid ? r.paid.toLocaleString('ru-RU') : '—'}</td><td class="num ${r.due != null && r.due - r.paid > 0 ? 'down' : 'up'}">${r.due != null ? (r.due - r.paid).toLocaleString('ru-RU') : '—'}</td>` : ''}
      <td class="nowrap">${isAdmin ? `<button class="sm" data-pay="${r.s.id}">+ выплата</button> <button class="sm" data-ed="${r.s.id}">✎</button>` : ''}</td></tr>`).join('') || '<tr><td class="muted">сотрудников нет</td></tr>'}</tbody></table>
    <div class="muted" style="font-size:11px;margin-top:8px">Ставка и суммы — в валюте, как записано в карточке (обычно сум/день). Уборки 🧹 — из бота уборок по имени горничной (подсказка для табеля, не отметка).</div></div>
    ${isAdmin ? `<div class="card"><h3>Выплаты · ${ruMonth(MONTH)} <span class="n">${D.payments.length}</span></h3><table class="t">${D.payments.map(p => `<tr><td>${ruD(p.payment_date)}</td><td class="b">${esc((D.staff.find(s => s.id === p.staff_id) || {}).name || '')}</td><td class="num">${(+p.amount).toLocaleString('ru-RU')}</td><td class="muted">${esc(p.notes || '')}</td><td><button class="sm danger" data-pd="${p.id}">✕</button></td></tr>`).join('') || '<tr><td class="muted">выплат нет</td></tr>'}</table></div>` : ''}`;
  $$('#s_body .dc').forEach(td => td.onclick = async () => { try { await api(null, { a: 'attendance', staff_id: td.dataset.s, date: td.dataset.d }); load(); } catch (e) { toast(e.message, 4000); } });
  $$('#s_body [data-ed]').forEach(b => b.onclick = () => edit(D.staff.find(s => s.id === b.dataset.ed)));
  $$('#s_body [data-pay]').forEach(b => b.onclick = () => pay(D.staff.find(s => s.id === b.dataset.pay)));
  $$('#s_body [data-pd]').forEach(b => b.onclick = async () => { if (!confirm('Удалить выплату?')) return; await api(null, { a: 'staff_payment_delete', id: b.dataset.pd }); load(); });
}
function edit(s) {
  s = s || { role: 'cleaning', is_active: true };
  drawer(s.id ? 'Сотрудник' : 'Новый сотрудник', `<div class="f"><label class="w">Имя<input id="st_name" value="${esc(s.name || '')}"></label>
    <label>Роль<select id="st_role">${Object.entries(ROLE).map(([k, v]) => `<option value="${k}" ${s.role === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label>Ставка за день<input id="st_rate" type="number" value="${s.daily_rate ?? ''}"></label>
    <label>Телефон<input id="st_phone" value="${esc(s.phone || '')}"></label>
    <label>Telegram chat_id<input id="st_tg" value="${esc(s.telegram_chat_id || '')}" placeholder="из /start в боте"></label>
    <label class="w"><span><input type="checkbox" id="st_act" ${s.is_active !== false ? 'checked' : ''}> активен</span></label></div>
    <div class="muted" style="font-size:11px">Доступ в бот уборок выдаётся в самом боте (/add_user роль id имя); доступ в /pms и /admin — раздел «Доступы».</div>`,
    `<button class="pri" id="st_ok">Сохранить</button><button onclick="ADM.closeDrawer()">Отмена</button>`);
  $('#st_ok').onclick = async () => { try { await api(null, { a: 'staff_save', id: s.id, name: $('#st_name').value, role: $('#st_role').value, daily_rate: $('#st_rate').value, phone: $('#st_phone').value, telegram_chat_id: $('#st_tg').value, is_active: $('#st_act').checked }); closeDrawer(); toast('Сохранено'); load(); } catch (e) { toast(e.message, 4000); } };
}
function pay(s) {
  drawer('Выплата · ' + esc(s.name), `<div class="f"><label>Дата<input id="p_date" type="date" value="${today()}"></label><label>Сумма<input id="p_amt" type="number"></label><label class="w">Заметка<input id="p_note" placeholder="аванс / зарплата за месяц / премия"></label></div>`, `<button class="pri" id="p_ok">Записать</button><button onclick="ADM.closeDrawer()">Отмена</button>`);
  $('#p_ok').onclick = async () => { if (!(+$('#p_amt').value)) { toast('Сумма'); return; } try { await api(null, { a: 'staff_payment', staff_id: s.id, amount: $('#p_amt').value, payment_date: $('#p_date').value, notes: $('#p_note').value }); closeDrawer(); toast('Записано'); load(); } catch (e) { toast(e.message, 4000); } };
}
})();
