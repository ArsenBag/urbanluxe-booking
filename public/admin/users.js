// Urban Luxe — admin/users.js (14.10.2026). Доступы: тот же раздел «Сотрудники», что в /pms (общая таблица app_users, pms-api users/user_save/user_logout_all
// через admin-api pms_users / pms_user_save / pms_user_logout_all). Роли: admin — всё; booker — брони, платежи, цены (в /pms); ops — операционка, заявки, чат;
// partner — свои квартиры, только чтение (в /pms).
(function () {
const A = window.ADM, { $, $$, esc, toast, api, drawer, closeDrawer } = A;
const ROLE_RU = { admin: 'админ', booker: 'бронер', ops: 'опер-менеджер', partner: 'партнёр' };
let D = null, APTS = [];

A.views.users = function () {
  $('#main').innerHTML = `<div class="page"><h2>Доступы <span class="n muted">вход в /pms, /admin и /map одной учёткой</span><span class="sp"></span><button class="pri sm" id="u_new">+ сотрудник</button></h2>
    <div class="card" id="u_list">Загрузка…</div><div class="card" id="u_staff"></div>
    <div class="card muted" style="font-size:12px">Роли: <b>админ</b> — всё; <b>бронер</b> — брони, платежи, цены в /pms, заявки и операционка в /admin; <b>опер-менеджер</b> — заехал/выехал, операционка, чат, персонал без зарплат; <b>партнёр</b> — свои квартиры, только чтение. Вход из бота бронеров: команда <code>/pms</code> — ссылка подходит для всех трёх приложений.</div></div>`;
  $('#u_new').onclick = () => edit(null);
  list();
};
async function list() {
  try { [D, APTS] = await Promise.all([api({ a: 'pms_users' }), api({ a: 'apts' })]); } catch (e) { $('#u_list').innerHTML = '<div class="warn">' + esc(e.message) + '</div>'; return; }
  const orgName = id => ((D.orgs || []).find(o => o.id === id) || {}).short || id;
  $('#u_list').innerHTML = `<h3>Сотрудники <span class="n">${D.users.length}</span></h3><table class="t"><tr><th>Имя</th><th>Email</th><th>Роль</th><th>Орг.</th><th>Telegram</th><th>Квартиры</th><th></th><th></th></tr>` +
    D.users.map(u => `<tr style="${u.is_active ? '' : 'opacity:.45'}"><td class="b">${esc(u.name)}${u.email === D.me ? ' <span class="tag">вы</span>' : ''}${u.is_active ? '' : ' <span class="tag bad">выкл</span>'}</td><td>${esc(u.email)}</td><td>${ROLE_RU[u.role] || u.role}</td><td>${esc(orgName(u.org_id))}</td><td>${u.telegram_chat_id ? '<code>' + esc(u.telegram_chat_id) + '</code>' : '<span class="muted">—</span>'}</td><td class="muted" style="font-size:11px">${u.role === 'partner' ? (u.apartment_ids || []).length + ' кв.' : 'все'}</td><td><button class="sm" data-e="${esc(u.email)}">✎</button></td><td><button class="sm" data-lo="${esc(u.email)}" title="Снять все сессии">выйти везде</button></td></tr>`).join('') + '</table>';
  const st = (D.staff || []).filter(s => s.telegram_chat_id);
  $('#u_staff').innerHTML = `<h3>Chat_id из ботов <span class="n">${st.length}</span></h3><div class="muted" style="font-size:11px;margin-bottom:6px">Сотрудник пишет боту /start — бот показывает его chat_id. Сюда попадают те, кому выдан доступ в ботах (/allow).</div>` + (st.length ? '<table class="t">' + st.map(s => `<tr><td class="b">${esc(s.name)}</td><td>${esc(s.role || '')}</td><td><code>${esc(s.telegram_chat_id)}</code></td></tr>`).join('') + '</table>' : '<div class="muted">пока никого</div>');
  $$('#u_list [data-e]').forEach(b => b.onclick = () => edit(D.users.find(u => u.email === b.dataset.e)));
  $$('#u_list [data-lo]').forEach(b => b.onclick = async () => { if (!confirm('Снять все сессии ' + b.dataset.lo + '? Сотруднику придётся войти заново.')) return; try { const r = await api(null, { a: 'pms_user_logout_all', email: b.dataset.lo }); toast('Сессий снято: ' + r.sessions); } catch (e) { toast(e.message, 4000); } });
}
function edit(u) {
  const isNew = !u; u = u || { role: 'booker', org_id: (A.ME.org || {}).id || 1, is_active: true, apartment_ids: [] };
  const byC = {}; APTS.forEach(a => (byC[a.complex] = byC[a.complex] || []).push(a));
  drawer(isNew ? 'Новый сотрудник' : 'Сотрудник', `<div class="f">
    <label class="w">Email (логин)<input id="w_email" type="email" value="${esc(u.email || '')}" ${isNew ? '' : 'readonly'} autocomplete="off"></label>
    <label class="w">Имя<input id="w_name" value="${esc(u.name || '')}" placeholder="как в журнале и уведомлениях"></label>
    <label>Роль<select id="w_role">${Object.entries(ROLE_RU).map(([k, v]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label>Организация<select id="w_org">${(D.orgs || []).map(o => `<option value="${o.id}" ${u.org_id === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label>
    <label>Telegram chat_id<input id="w_tg" value="${esc(u.telegram_chat_id || '')}" placeholder="из /start в боте бронеров"></label>
    <label>${isNew ? 'Пароль' : 'Новый пароль'}<input id="w_pw" type="password" autocomplete="new-password" placeholder="${isNew ? 'от 6 символов' : 'пусто — не менять'}"></label>
    <label class="w"><span><input type="checkbox" id="w_act" ${u.is_active !== false ? 'checked' : ''}> активен (выключенный не может войти)</span></label>
    <div class="w" id="w_apts" style="grid-column:1/3;${u.role === 'partner' ? '' : 'display:none'}"><div class="sec">Квартиры партнёра</div>${Object.keys(byC).map(c => `<div style="margin:4px 0"><b style="font-size:12px">${esc(c)}</b><br>${byC[c].map(a => `<label style="display:inline-flex;flex-direction:row;gap:3px;margin:2px 10px 2px 0;font-size:12px"><input type="checkbox" data-apt="${a.id}" ${(u.apartment_ids || []).includes(a.id) ? 'checked' : ''}>${esc(String(a.name).replace('Апартамент ', ''))}</label>`).join('')}</div>`).join('')}</div></div>`,
    `<button class="pri" id="w_ok">${isNew ? 'Создать' : 'Сохранить'}</button><button onclick="ADM.closeDrawer()">Отмена</button>`);
  $('#w_role').onchange = () => { $('#w_apts').style.display = $('#w_role').value === 'partner' ? '' : 'none'; };
  $('#w_ok').onclick = async () => {
    const o = { email: $('#w_email').value.trim(), name: $('#w_name').value.trim(), role: $('#w_role').value, org_id: +$('#w_org').value, telegram_chat_id: $('#w_tg').value.trim(), is_active: $('#w_act').checked, password: $('#w_pw').value, apartment_ids: $$('#w_apts [data-apt]:checked').map(x => x.dataset.apt) };
    if (!o.email) { toast('Email'); return; } if (isNew && o.password.length < 6) { toast('Пароль от 6 символов'); return; }
    if (o.role === 'partner' && !o.apartment_ids.length && !confirm('Партнёр без квартир ничего не увидит. Сохранить?')) return;
    try { await api(null, { a: 'pms_user_save', user: o }); closeDrawer(); toast(isNew ? 'Сотрудник создан' : 'Сохранено'); list(); } catch (e) { toast(e.message, 5000); }
  };
}
})();
