// Urban Luxe — admin/ops.js (14.10.2026). Раздел «Операционка»: лист дня (заезды с галочками из daily_ops — тот же, что в боте бронеров
// и Google-таблице), выезды, живут, уборки (cleaning_tasks из HK-бота), персонал. Данные: admin-api ?a=ops_day&date= ; POST ops_toggle / ops_patch / ops_add.
(function () {
const A = window.ADM, { $, $$, esc, money, toast, api, ruD, ruDM, CH, ST } = A;
const today = () => A.iso(Date.now() + 5 * 36e5);
let DATE = today(), D = null, rt = null;
const SRC = { site: 'Сайт', tg: 'Telegram', wa: 'WhatsApp', booking: 'Booking', bnb: 'Airbnb', ig: 'Instagram', other: 'Другое', rc: 'RC', ota: 'OTA' };
const FLAGS = [['passport', 'Паспорт'], ['access', 'Доступ'], ['registration', 'Регистр.'], ['confirm_checkin', 'Подтв.'], ['checked_in', 'Заехал'], ['paid_full', 'Оплачено'], ['deposit_received', 'Депозит'], ['review', 'Отзыв']];

A.views.ops = function () {
  $('#main').innerHTML = `<div class="page"><h2>Операционка
      <div class="seg"><button id="o_prev">‹</button><button id="o_today">сегодня</button><button id="o_next">›</button></div><input type="date" id="o_date" value="${DATE}">
      <span class="n muted" id="o_sum"></span><span class="sp"></span><a href="/map" target="_blank"><button class="sm">🏙 на карте</button></a><a href="/pms#today" target="_blank"><button class="sm">в PMS</button></a></h2>
    <div id="o_body" class="empty">Загрузка…</div></div>`;
  $('#o_prev').onclick = () => { DATE = A.addD(DATE, -1); $('#o_date').value = DATE; load(); };
  $('#o_next').onclick = () => { DATE = A.addD(DATE, 1); $('#o_date').value = DATE; load(); };
  $('#o_today').onclick = () => { DATE = today(); $('#o_date').value = DATE; load(); };
  $('#o_date').onchange = e => { if (e.target.value) { DATE = e.target.value; load(); } };
  load();
};
A.onChange(() => { if (!$('#o_body')) return; clearTimeout(rt); rt = setTimeout(load, 800); });

async function load() {
  try { D = await api({ a: 'ops_day', date: DATE }); } catch (e) { $('#o_body').innerHTML = '<div class="warn">' + esc(e.message) + '</div>'; return; }
  const dirty = D.cleaning.filter(c => !c.done && !/done|clean|ok|готов/i.test(c.hk_status || '')).length;
  $('#o_sum').textContent = D.checkins.length + ' заезд. · ' + D.checkouts.length + ' выезд. · ' + D.inhouse.length + ' живут · уборок ' + D.cleaning.length + (dirty ? ' (не закрыто ' + dirty + ')' : '');
  $('#o_body').className = '';
  $('#o_body').innerHTML = `
    <div class="card"><h3>Заезды · ${ruDM(DATE)} <span class="n">лист дня — галочки общие с ботом бронеров и Google-таблицей</span><span class="sp"></span><button class="sm" id="o_add">+ строка</button></h3>
      ${D.rows.length ? `<table class="t"><thead><tr><th>Квартира</th><th>Гость</th><th>Заезд</th><th>Выезд</th><th class="num">Гостей</th><th>Площадка</th><th class="num">Оплата</th>${FLAGS.map(f => '<th>' + f[1] + '</th>').join('')}<th>Заметка</th></tr></thead><tbody>
      ${D.rows.map(r => { const paid = r.payment_total != null && Number(r.payment_paid || 0) >= Number(r.payment_total); const bk = D.checkins.find(b => b.apartment_id === r.apartment_id);
        return `<tr data-id="${r.id}"><td class="b">${esc(r.short)}${bk && bk.status === 'request' ? ' <span class="tag">заявка</span>' : ''}</td>
        <td><span data-f="guest_name" class="ed">${esc(r.guest_name || '—')}</span>${bk && bk.guest_phone ? '<div class="muted" style="font-size:10px">' + esc(bk.guest_phone) + '</div>' : ''}</td>
        <td><span data-f="checkin_time" class="ed">${esc(r.checkin_time || '15:00')}</span></td><td>${r.check_out_date ? ruD(r.check_out_date) : (bk ? ruD(bk.check_out) : '')} <span data-f="checkout_time" class="ed muted">${esc(r.checkout_time || '12:00')}</span></td>
        <td class="num"><span data-f="guests" class="ed">${r.guests || '—'}</span></td><td>${esc(SRC[r.source] || r.source || '—')}</td>
        <td class="num"><span data-f="pay" class="ed ${r.payment_total != null && !paid ? 'down' : ''}">${r.payment_total == null ? '—' : money(r.payment_paid) + ' / ' + money(r.payment_total)}</span></td>
        ${FLAGS.map(f => { const v = f[0] === 'registration' ? r.registration : f[0] === 'paid_full' ? paid : r[f[0]]; const txt = f[0] === 'registration' ? ({ needed: '⚠', done: '✓', not_needed: '–' }[r.registration] || '☐') : (v ? '✓' : '☐'); return `<td class="num"><button class="sm chk ${v === true || v === 'done' ? 'on' : v === 'needed' ? 'warn' : ''}" data-t="${f[0]}" title="${f[1]}">${txt}</button></td>`; }).join('')}
        <td><span data-f="note" class="ed muted">${esc(r.note || '…')}</span></td></tr>`; }).join('')}</tbody></table>` : '<div class="empty">заездов нет</div>'}</div>
    <div class="grid2">
      <div class="card"><h3>Выезды <span class="n">${D.checkouts.length}</span></h3>${D.checkouts.map(line).join('') || '<div class="empty">нет</div>'}</div>
      <div class="card"><h3>Уборки <span class="n">из бота уборок</span></h3>${D.cleaning.length ? '<table class="t">' + D.cleaning.map(c => `<tr><td class="b">${esc(aptName(c.apartment_id))}</td><td>${esc(c.hk_maid || '—')}</td><td><span class="tag ${c.done ? '' : 'bad'}">${c.done ? 'убрано' + (c.done_at ? ' ' + c.done_at.slice(11, 16) : '') : esc(c.hk_status || 'ожидает')}</span></td></tr>`).join('') + '</table>' : '<div class="empty">задач на эту дату нет</div>'}
        <div class="sec">Персонал</div>${D.staff.map(s => `<span class="tag">${esc(s.name)} · ${esc(s.role)}</span>`).join(' ') || '<span class="muted">нет</span>'}</div>
    </div>
    <div class="card"><h3>Живут <span class="n">${D.inhouse.length}</span></h3><div class="grid3">${D.inhouse.map(line).join('') || '<div class="empty">нет</div>'}</div></div>`;
  $$('#o_body .chk').forEach(b => b.onclick = async () => { const id = b.closest('tr').dataset.id; try { await api(null, { a: 'ops_toggle', id, key: b.dataset.t }); load(); } catch (e) { toast(e.message, 4000); } });
  $$('#o_body .ed').forEach(el => el.onclick = () => edit(el));
  $('#o_add').onclick = async () => { const a = prompt('Квартира (номер или «ЖК номер», например «Nest 15»):'); if (!a) return; try { await api(null, { a: 'ops_add', date: DATE, apartment: a }); load(); } catch (e) { toast(e.message, 4000); } };
}
function aptName(id) { const b = (D.inhouse.concat(D.checkouts, D.checkins)).find(x => x.apartment_id === id); return b ? b.apartment_name : id; }
function line(b) {
  return `<div class="li"><div class="g"><div class="n">${esc(b.apartment_name)} <span class="muted" style="font-weight:400">· ${esc(b.guest_name || '')}</span></div>
    <div class="s">${ruD(b.check_in)} → ${ruD(b.check_out)} · ${b.nights} ноч. · ${esc(CH[b.channel] || CH[b.source] || '')}${b.departure_time ? ' · выезд ' + esc(b.departure_time) : ''}${b.debt > 0 && b.source !== 'rc' ? ' · <span class="tag bad">долг ' + money(b.debt, b.currency) + '</span>' : ''}</div></div>
    <a href="/pms#booking=${b.id}" target="_blank"><span class="st" style="background:${(ST[b.status] || ['', '#eee'])[1]}">${(ST[b.status] || [b.status])[0]}</span></a></div>`;
}
async function edit(el) {
  const id = el.closest('tr').dataset.id, f = el.dataset.f; const cur = el.textContent.trim();
  let patch = {};
  if (f === 'pay') { const v = prompt('Оплата: «230» (оплачено всё) или «100 из 230»', ''); if (v === null) return; const m = v.replace(/\$/g, '').match(/(\d+(?:[.,]\d+)?)\s*(?:из|\/)\s*(\d+(?:[.,]\d+)?)/); if (m) patch = { payment_paid: +m[1].replace(',', '.'), payment_total: +m[2].replace(',', '.') }; else { const n = parseFloat(v.replace(',', '.')); if (isNaN(n)) return; patch = { payment_total: n, payment_paid: n }; } }
  else if (f === 'guests') { const v = prompt('Гостей:', cur === '—' ? '' : cur); if (v === null) return; patch = { guests: parseInt(v, 10) || null }; }
  else { const v = prompt({ guest_name: 'Имя гостя', checkin_time: 'Время заезда', checkout_time: 'Время выезда', note: 'Заметка' }[f] || f, cur === '—' || cur === '…' ? '' : cur); if (v === null) return; patch[f] = v; }
  try { await api(null, { a: 'ops_patch', id, patch }); load(); } catch (e) { toast(e.message, 4000); }
}
})();
