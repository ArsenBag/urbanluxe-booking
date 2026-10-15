// Urban Luxe — pms-v2.js (16.10.2026). PMS v2-A: раздел «Объекты» (ЖК и квартиры), панель площадки в «Каналах»,
// подборка свободных квартир для гостя (/s/<code>). Работает поверх моста window.PMS из pms.js.
// API: pms-api.js (objects / complex_save / apt_save / apt_archive / apt_restore / selection_create),
//      channex-admin.js (setup_unit / channel_toggle / unit_markup / restriction_save / restriction_delete / unit_log).
// Спека: docs/superpowers/specs/2026-10-15-pms-objects-channels-v2-design.md
(function () {
const P = window.PMS; const { $, $$, esc, api, capi, openDrawer, toast, money, ruD, VIEWS } = P;
const OTA_RU = { airbnb: 'Airbnb', booking: 'Booking.com', ostrovok: 'Ostrovok', agoda: 'Agoda', expedia: 'Expedia', yandex: 'Яндекс Путешествия', sutochno: 'Sutochno' };
const dt = s => s ? String(s).slice(5, 16).replace('T', ' ') : '—';
const num = v => v == null || v === '' ? '' : v;

// =====================================================================
// ОБЪЕКТЫ — ЖК и квартиры (admin, ops)
// =====================================================================
VIEWS.objects = async () => {
  const ME = P.me(); const isAdmin = ME.role === 'admin';
  $('#tools').innerHTML = `<button class="pri sm" id="o_apt">+ Квартира</button><button class="sm" id="o_cx">+ ЖК</button><label style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--muted)"><input type="checkbox" id="o_arch">показать архив</label><span class="muted">Операционные поля квартиры. Описания, фото и SEO — в <a href="/admin#apartments" target="_blank">Админке → Квартиры</a>.</span>`;
  $('#main').innerHTML = '<div class="page" id="ob"><div class="muted">загрузка…</div></div>';
  let D;
  const load = async () => {
    try { D = await api({ a: 'objects' }); } catch (e) { $('#ob').innerHTML = '<div class="card">' + esc(e.message) + '</div>'; return; }
    const showArch = $('#o_arch').checked;
    const byCx = {}; D.complexes.forEach(c => byCx[c.name] = []); D.apartments.forEach(a => (byCx[a.complex] = byCx[a.complex] || []).push(a));
    let h = `<div class="kpi"><div><b>${D.complexes.length}</b>ЖК</div><div><b>${D.apartments.filter(a => a.is_active).length}</b>активных квартир</div><div><b>${D.apartments.filter(a => !a.is_active).length}</b>в архиве</div><div><b>${D.apartments.filter(a => a.unit && a.unit.external_room_type_id).length}</b>в Channex</div></div>`;
    for (const name of Object.keys(byCx).sort()) {
      const c = D.complexes.find(x => x.name === name); const apts = byCx[name].filter(a => showArch || a.is_active);
      const inCx = byCx[name].filter(a => a.unit && a.unit.external_room_type_id).length;
      h += `<div class="card"><h3 style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${esc(name)} <span class="muted" style="font-weight:400;font-size:12px">${byCx[name].filter(a => a.is_active).length} кв.${c && c.address ? ' · ' + esc(c.address) : ''}</span>${inCx ? '<span class="tag">Channex ' + inCx + '</span>' : '<span class="tag" style="opacity:.6">не в Channex</span>'}<span class="sp" style="flex:1"></span>${c ? '<button class="sm" data-cxe="' + c.id + '">✎ ЖК</button>' : '<button class="sm" data-cxn="' + esc(name) + '">создать запись ЖК</button>'}<button class="sm" data-apn="${esc(name)}">+ квартира</button></h3>` +
        (apts.length ? `<table class="t"><tr><th>№</th><th>Название</th><th>Код</th><th>Этаж</th><th>Гостей</th><th>Комнат</th><th>Будни</th><th>Вых.</th><th>Мин. ночей</th><th>Channex</th><th></th></tr>` +
          apts.map(a => `<tr style="${a.is_active ? '' : 'opacity:.5'}"><td>${num(a.catalog_no)}</td><td class="b">${esc(a.name)}${(a.partners || []).map(x => { const o = D.orgs.find(y => y.id === x.org_id) || {}; return ' <span class="tag" style="background:#e3ecff" title="партнёр: ' + esc(o.name || x.org_id) + (x.mode === 'occupancy' ? ' (только занятость)' : ' (полный доступ)') + '">' + esc(o.short || o.name || x.org_id) + '</span>'; }).join('')}${a.is_active ? '' : ' <span class="tag bad">архив</span>'}${a.tracked === false ? ' <span class="tag" title="не считается в загрузке">вне учёта</span>' : ''}</td><td><code style="font-size:11px">${esc(a.id)}</code></td><td>${num(a.floor)}</td><td>${num(a.max_guests)}</td><td>${esc(a.rooms || '')}</td><td>${a.weekday_price ? money(a.weekday_price) : ''}</td><td>${a.weekend_price ? money(a.weekend_price) : ''}</td><td>${num(a.min_nights)}</td><td>${a.unit && a.unit.external_room_type_id ? (a.unit.is_active ? '<span style="color:var(--green)">✓</span>' : '<span class="muted">выкл</span>') : '<span class="muted">—</span>'}${a.unit && a.unit.last_error ? ' <span class="tag bad" title="' + esc(a.unit.last_error) + '">ошибка</span>' : ''}</td><td><button class="sm" data-ape="${a.id}">✎</button></td></tr>`).join('') + `</table>` : '<div class="muted">квартир нет</div>') + `</div>`;
    }
    $('#ob').innerHTML = h;
    $$('#ob [data-cxe]').forEach(b => b.onclick = () => editComplex(D.complexes.find(c => String(c.id) === b.dataset.cxe)));
    $$('#ob [data-cxn]').forEach(b => b.onclick = () => editComplex({ name: b.dataset.cxn }));
    $$('#ob [data-apn]').forEach(b => b.onclick = () => editApt({ complex: b.dataset.apn }));
    $$('#ob [data-ape]').forEach(b => b.onclick = () => editApt(D.apartments.find(a => a.id === b.dataset.ape)));
  };
  const editComplex = (c) => { c = c || {}; const isNew = !c.id;
    openDrawer(isNew ? 'Новый ЖК' : 'ЖК · ' + c.name, `<div class="f">
      <label class="w">Название <input id="x_name" value="${esc(c.name || '')}" placeholder="Nest One"></label>
      <label class="w">Адрес <input id="x_addr" value="${esc(c.address || '')}" placeholder="Batyr Zakirov st. 1A"></label>
      <label>Город <input id="x_city" value="${esc(c.city || 'Tashkent')}"></label><label>Часовой пояс <input id="x_tz" value="${esc(c.timezone || 'Asia/Tashkent')}"></label>
      <label class="w">Заметки <input id="x_notes" value="${esc(c.notes || '')}" placeholder="консьерж, парковка, как попасть"></label>
      <label style="flex-direction:row;gap:6px;align-items:center;color:var(--text)"><input type="checkbox" id="x_act" ${c.is_active !== false ? 'checked' : ''}>активен</label></div>
      ${isNew ? '' : '<div class="muted" style="font-size:11px">Переименование ЖК переименует его у всех квартир и в карточке Channex (наше название, не в самом Channex).</div>'}`,
      `<button class="pri" id="x_ok">${isNew ? 'Создать' : 'Сохранить'}</button><button onclick="closeDrawer()">Отмена</button>`);
    $('#x_ok').onclick = async () => { try { await api(null, { a: 'complex_save', id: c.id, name: $('#x_name').value.trim(), address: $('#x_addr').value.trim(), city: $('#x_city').value.trim(), timezone: $('#x_tz').value.trim(), notes: $('#x_notes').value.trim(), is_active: $('#x_act').checked }); P.closeDrawer(); toast('Сохранено'); load(); } catch (e) { alert(e.message); } };
  };
  const editApt = (a) => { a = a || {}; const isNew = !a.id; const u = a.unit;
    const slug = (a.complex || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12);
    openDrawer(isNew ? 'Новая квартира' : a.name, `<div class="f">
      <label class="w">Код (латиница, цифры, _) <input id="a_id" value="${esc(a.id || '')}" ${isNew ? 'placeholder="' + esc(slug) + '_77"' : 'readonly'} autocomplete="off"></label>
      <label class="w">Название <input id="a_name" value="${esc(a.name || '')}" placeholder="Nest One 77"></label>
      <label>ЖК <select id="a_cx">${D.complexes.filter(c => c.is_active !== false).map(c => `<option ${c.name === a.complex ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label>№ в каталоге <input id="a_no" type="number" value="${num(a.catalog_no)}"></label>
      <label>Этаж <input id="a_fl" type="number" value="${num(a.floor)}"></label><label>Гостей макс. <input id="a_mg" type="number" min="1" value="${num(a.max_guests) || 2}"></label>
      <label>Комнат <input id="a_rm" value="${esc(a.rooms || '')}" placeholder="2 комн."></label><label>Мин. ночей <input id="a_mn" type="number" min="1" value="${num(a.min_nights)}"></label>
      <label>Цена будни, $ <input id="a_wd" type="number" min="0" value="${num(a.weekday_price)}"></label><label>Цена выходные, $ <input id="a_we" type="number" min="0" value="${num(a.weekend_price)}"></label>
      <label style="flex-direction:row;gap:6px;align-items:center;color:var(--text)"><input type="checkbox" id="a_tr" ${a.tracked !== false ? 'checked' : ''}>учитывать в загрузке и отчётах</label>
      <label>Партнёр <select id="a_po"><option value="">— нет</option>${D.orgs.filter(o => o.id !== (a.org_id || ME.org.id)).map(o => `<option value="${o.id}" ${(a.partners || []).some(x => x.org_id === o.id) ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label>
      <label>Доступ партнёра <select id="a_pm"><option value="full" ${((a.partners || [])[0] || {}).mode !== 'occupancy' ? 'selected' : ''}>полный — видит и ведёт брони как мы</option><option value="occupancy" ${((a.partners || [])[0] || {}).mode === 'occupancy' ? 'selected' : ''}>только занятость</option></select></label></div>
      <div class="muted" style="font-size:11px">Партнёрская квартира видна в обоих кабинетах одновременно: одна бронь, одна шахматка, одна история — кто что сделал, с пометкой организации (UL / HL).</div>
      ${isNew ? '<div class="muted" style="font-size:11px">После создания квартира появится в шахматке и на сайте (после описаний и фото в Админке). Если ЖК подключён к Channex — нажмите «Подключить к Channex» в карточке.</div>' : ''}
      ${!isNew && ME.role === 'admin' ? `<div class="sec">Channex</div>${u && u.external_room_type_id ? '<div class="muted" style="font-size:11px">room ' + esc(u.external_room_type_id) + ' · тарифы: Standard' + Object.keys(u.derived || {}).map(k => ', ' + (OTA_RU[k] || k)).join('') + (u.last_pushed_at ? ' · отправлено ' + dt(u.last_pushed_at) : '') + '</div>' : '<div class="muted" style="font-size:11px">Комнаты в Channex нет.</div><button class="sm" id="a_cxu" style="margin-top:6px">Подключить к Channex</button>'}` : ''}`,
      `<button class="pri" id="a_ok">${isNew ? 'Создать' : 'Сохранить'}</button>${!isNew && ME.can.objects_archive ? (a.is_active ? '<button class="danger" id="a_arch">В архив</button>' : '<button id="a_rest">Восстановить</button>') : ''}<button onclick="closeDrawer()">Отмена</button>`);
    $('#a_ok').onclick = async () => {
      const o = { id: ($('#a_id').value || '').trim().toLowerCase(), name: $('#a_name').value.trim(), complex: $('#a_cx').value, catalog_no: $('#a_no').value, floor: $('#a_fl').value, max_guests: $('#a_mg').value, rooms: $('#a_rm').value.trim(), min_nights: $('#a_mn').value, weekday_price: $('#a_wd').value, weekend_price: $('#a_we').value, tracked: $('#a_tr').checked, partner_org_id: $('#a_po').value || null, partner_mode: $('#a_pm').value };
      if (!o.id) return alert('Код квартиры'); if (!o.name) return alert('Название');
      try { await api(null, Object.assign({ a: 'apt_save' }, o)); P.closeDrawer(); toast(isNew ? 'Квартира создана' : 'Сохранено'); load(); } catch (e) { alert(e.message); }
    };
    if ($('#a_arch')) $('#a_arch').onclick = async () => { if (!confirm('Убрать «' + a.name + '» в архив? Продажи закроются на 500 дней вперёд на всех площадках, квартира исчезнет из шахматки и с сайта. Брони останутся.')) return; try { const r = await api(null, { a: 'apt_archive', id: a.id }); P.closeDrawer(); toast('В архиве · закрыто дней: ' + (r.days || 0)); load(); } catch (e) { alert(e.message); } };
    if ($('#a_rest')) $('#a_rest').onclick = async () => { try { await api(null, { a: 'apt_restore', id: a.id }); P.closeDrawer(); toast('Восстановлена, цены и занятость уйдут на площадки за минуту'); load(); } catch (e) { alert(e.message); } };
    if ($('#a_cxu')) $('#a_cxu').onclick = async () => { $('#a_cxu').disabled = true; $('#a_cxu').textContent = 'создаю комнату и тарифы…'; try { const r = await capi(null, { a: 'setup_unit', apartment_id: a.id }); toast('Channex: ' + r.log.join('; ').slice(0, 120)); P.closeDrawer(); load(); } catch (e) { alert(e.message); $('#a_cxu').disabled = false; $('#a_cxu').textContent = 'Подключить к Channex'; } };
  };
  $('#o_apt').onclick = () => editApt(null); $('#o_cx').onclick = () => editComplex(null); $('#o_arch').onchange = load;
  load();
};

// =====================================================================
// ПАНЕЛЬ ПЛОЩАДКИ ДЛЯ КВАРТИРЫ (Каналы → клик по ячейке)
// =====================================================================
P.channelPanel = async (S, aptId, ch, reload) => {
  const a = S.apartments.find(x => x.id === aptId) || { name: aptId }; const u = S.units.find(x => x.apartment_id === aptId);
  const title = a.name + ' · ' + (OTA_RU[ch] || ch);
  if (!u || !u.external_room_type_id) { openDrawer(title, '<div class="muted">Квартира не подключена к Channex — сначала «подключить ЖК к Channex» или «Подключить к Channex» в Объектах.</div>', '<button onclick="closeDrawer()">Закрыть</button>'); return; }
  const st = (u.channels || {})[ch] || {}; const gm = (S.markups || {})[ch] || 0; const d = (u.derived || {})[ch];
  const rules = (S.restrictions || []).filter(r => r.apartment_id === aptId && r.channel === ch);
  const mappedIds = (st.mapped && st.mapped.channel_ids) || (st.saved || []).map(x => x.channel_id) || [];
  const state = st.enabled === false ? '<span class="tag bad">выключена нами</span>' : st.mapped && st.mapped.n ? '<span class="tag" style="background:#d9f3dd">подключена · ' + st.mapped.n + ' маппинг' + (st.mapped.checked_at ? ' · ' + dt(st.mapped.checked_at) : '') + '</span>' : '<span class="tag">маппинг не найден' + (st.checked_at ? '' : ' (скан не делали)') + '</span>';
  const eff = st.markup_pct != null ? Number(st.markup_pct) : gm;
  const body = `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">${state}${u.last_error ? '<span class="tag bad" title="' + esc(u.last_error) + '">ошибка отправки</span>' : ''}</div>
    <div class="sec">Продажи на площадке</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${st.enabled === false ? '<button class="pri sm" id="cp_on">Включить (вернуть маппинг)</button>' : '<button class="sm danger" id="cp_off">Выключить на площадке</button>'}<span class="muted" style="font-size:11px">Выкл = снять привязку тарифа квартиры в канале Channex; объявление на площадке остаётся, но цены/занятость туда не идут. Вкл — вернуть.</span></div>
    <div class="sec">Наценка на ${esc(OTA_RU[ch] || ch)}</div>
    <div class="f"><label>Своя наценка квартиры, % <input id="cp_mk" type="number" min="0" max="100" step="1" value="${st.markup_pct == null ? '' : st.markup_pct}" placeholder="общая ${gm} %"></label><label>&nbsp;<button class="sm" id="cp_mks">Применить</button></label></div>
    <div class="muted" style="font-size:11px">Итог: Standard × ${(1 + eff / 100).toFixed(2)} (${eff} %). Пусто — действует общая наценка площадки (${gm} %). Применяется к производному тарифу в Channex сразу.</div>
    <div class="sec">Закрытия и мин. ночи только для ${esc(OTA_RU[ch] || ch)}</div>
    ${rules.length ? '<table class="t">' + rules.map(r => `<tr><td class="nowrap">${ruD(r.date_from)} – ${ruD(r.date_to)}</td><td>${r.stop_sell ? '<span class="tag bad">закрыто</span>' : ''}${r.min_nights ? ' мин. ' + r.min_nights + ' ноч.' : ''}</td><td class="muted" style="font-size:11px">${esc(r.note || '')} · ${esc(r.created_by || '')}</td><td><button class="sm danger" data-rdel="${r.id}">✕</button></td></tr>`).join('') + '</table>' : '<div class="muted" style="font-size:11px">правил нет — площадка получает наши общие закрытия и мин. ночи</div>'}
    <div class="f" style="margin-top:6px"><label>С <input id="cp_f" type="date"></label><label>По (включ.) <input id="cp_t" type="date"></label><label style="flex-direction:row;gap:6px;align-items:center;color:var(--text)"><input type="checkbox" id="cp_ss">закрыть продажи</label><label>Мин. ночей <input id="cp_mn" type="number" min="1" placeholder="—"></label><label class="w">Заметка <input id="cp_note" placeholder="например: держим под прямые брони"></label></div>
    <button class="sm pri" id="cp_radd">Добавить правило</button>
    <div class="sec">Чей аккаунт площадки</div>
    ${mappedIds.length ? mappedIds.map(id => { const c = (S.channels || []).find(x => x.id === id) || {}; return '<div style="display:flex;gap:6px;align-items:center;margin:4px 0;font-size:12px"><span style="min-width:180px">' + esc(c.title || id.slice(0, 8)) + '</span><select data-acc="' + esc(id) + '">' + (S.orgs || [{ id: 1, name: 'Urban Luxe' }]).map(o => '<option value="' + o.id + '" ' + ((c.org_id || 1) === o.id ? 'selected' : '') + '>' + esc(o.name) + '</option>').join('') + '</select></div>'; }).join('') : '<div class="muted" style="font-size:11px">квартира не замаплена ни в одном канале этой площадки</div>'}
    <div class="muted" style="font-size:11px">Один канал Channex = один аккаунт на площадке. Партнёрский Airbnb — отдельный канал, который партнёр авторизует сам; здесь отмечаем, чей он, чтобы в матрице было видно (бейдж HL).</div>
    <div class="sec">Лог отправок и броней</div><div id="cp_log" class="muted">загрузка…</div>
    <div class="sec">Ссылки</div><div style="font-size:12px">${mappedIds.length ? mappedIds.map(id => '<a target="_blank" href="' + esc((S.channex.base || 'https://app.channex.io') + '/channels/' + id) + '">Канал в Channex ' + esc(id.slice(0, 8)) + '</a>').join(' · ') : '<a target="_blank" href="' + esc((S.channex.base || 'https://app.channex.io') + '/channels') + '">Каналы в Channex</a>'}${d ? ' · <span class="muted">тариф ' + esc(d.rate_plan_id.slice(0, 8)) + '</span>' : ''}</div>`;
  openDrawer(title, body, '<button onclick="closeDrawer()">Закрыть</button>');
  const busy = (el, on, txt) => { if (!el) return; el.disabled = on; if (txt) el.textContent = txt; };
  const after = (msg) => { toast(msg); P.closeDrawer(); reload(); };
  if ($('#cp_off')) $('#cp_off').onclick = async () => { if (!confirm('Выключить «' + a.name + '» на ' + (OTA_RU[ch] || ch) + '? Маппинг в Channex будет снят (запомним, чтобы вернуть).')) return; busy($('#cp_off'), true, 'снимаю маппинг…'); try { const r = await capi(null, { a: 'channel_toggle', apartment_id: aptId, channel: ch, enabled: false }); after('Выключено: ' + r.log.join('; ').slice(0, 100)); } catch (e) { alert(e.message); busy($('#cp_off'), false, 'Выключить на площадке'); } };
  if ($('#cp_on')) $('#cp_on').onclick = async () => { busy($('#cp_on'), true, 'возвращаю маппинг…'); try { const r = await capi(null, { a: 'channel_toggle', apartment_id: aptId, channel: ch, enabled: true }); after(r.need_manual ? 'Сохранённого маппинга нет — замапьте в Channex вручную' : 'Включено: ' + r.log.join('; ').slice(0, 100)); } catch (e) { alert(e.message); busy($('#cp_on'), false, 'Включить (вернуть маппинг)'); } };
  $('#cp_mks').onclick = async () => { busy($('#cp_mks'), true, '…'); try { const r = await capi(null, { a: 'unit_markup', apartment_id: aptId, channel: ch, pct: $('#cp_mk').value === '' ? null : $('#cp_mk').value }); after('Наценка ' + (r.markup_pct == null ? 'общая' : r.markup_pct + ' %') + ' → итог ' + r.effective_pct + ' %'); } catch (e) { alert(e.message); busy($('#cp_mks'), false, 'Применить'); } };
  $('#cp_radd').onclick = async () => { const f = $('#cp_f').value, t = $('#cp_t').value; if (!f || !t || t < f) return alert('Даты'); if (!$('#cp_ss').checked && !$('#cp_mn').value) return alert('Отметьте закрытие или укажите мин. ночи'); busy($('#cp_radd'), true, 'отправляю…'); try { await capi(null, { a: 'restriction_save', apartment_id: aptId, channel: ch, date_from: f, date_to: t, stop_sell: $('#cp_ss').checked, min_nights: $('#cp_mn').value || null, note: $('#cp_note').value.trim() }); after('Правило добавлено и отправлено'); } catch (e) { alert(e.message); busy($('#cp_radd'), false, 'Добавить правило'); } };
  $$('#d_body [data-acc]').forEach(sel => sel.onchange = async () => { try { await capi(null, { a: 'channel_account_set', channel_id: sel.dataset.acc, org_id: sel.value }); after('Аккаунт канала сохранён'); } catch (e) { alert(e.message); } });
  $$('#d_body [data-rdel]').forEach(b => b.onclick = async () => { if (!confirm('Удалить правило? На площадку вернутся общие значения.')) return; try { await capi(null, { a: 'restriction_delete', id: b.dataset.rdel }); after('Правило удалено'); } catch (e) { alert(e.message); } });
  try {
    const L = await capi(null, { a: 'unit_log', apartment_id: aptId }); const el = $('#cp_log'); if (!el) return;
    const KIND = { both: 'цены+занятость', availability: 'занятость', rates: 'цены', restriction: 'правило площадки' };
    el.className = ''; el.innerHTML = (L.bookings.length ? `<div class="muted" style="font-size:11px;margin-bottom:4px">Брони с площадок (${L.bookings.length})</div>` + L.bookings.map(b => `<div class="ev"><span class="muted">${dt(b.received_at)}</span> <b>${esc(b.ota || '')}</b> ${esc(b.status || '')} · ${ruD(b.check_in)} → ${ruD(b.check_out)} · ${esc(b.guest || '')} · ${b.amount ? esc(b.amount) + ' ' + esc(b.currency || '') : ''}${b.conflict ? ' <span class="tag bad">конфликт</span>' : ''}${b.error ? ' <span class="tag bad">' + esc(b.error.slice(0, 50)) + '</span>' : ''}${b.booking_id ? ' <a href="#" data-ob="' + b.booking_id + '">открыть</a>' : ''}</div>`).join('') : '') +
      `<div class="muted" style="font-size:11px;margin:6px 0 4px">Очередь отправки (${L.outbox.length})</div>` + (L.outbox.length ? L.outbox.map(o => `<div class="ev"><span class="muted">${dt(o.created_at)}</span> ${KIND[o.kind] || o.kind}${o.fields && o.fields.length ? ' <span class="muted">[' + esc(o.fields.join(',')) + ']</span>' : ''} · ${ruD(o.date_from)}–${ruD(o.date_to)} · ${o.sent_at ? (o.error ? '<span style="color:#b07a00">отправлено с предупреждением</span>' : '<span style="color:var(--green)">отправлено ' + dt(o.sent_at) + '</span>') : o.attempts ? '<span style="color:var(--red)">ошибка ×' + o.attempts + '</span>' : '<span class="muted">ждёт</span>'}${o.error ? ' <span class="muted" style="font-size:11px" title="' + esc(o.error) + '">' + esc(o.error.slice(0, 70)) + '</span>' : ''}${o.task_ids && (o.task_ids.restrictions || o.task_ids.availability) ? ' <span class="muted" style="font-size:10px">task ' + esc(String(o.task_ids.restrictions || o.task_ids.availability).slice(0, 8)) + '</span>' : ''}</div>`).join('') : '<div class="muted">пусто</div>');
    $$('#cp_log [data-ob]').forEach(x => x.onclick = e => { e.preventDefault(); P.openBooking(x.dataset.ob); });
  } catch (e) { const el = $('#cp_log'); if (el) el.textContent = e.message; }
};

// =====================================================================
// ПОДБОРКА ДЛЯ ГОСТЯ — ссылка /s/<code>
// =====================================================================
P.makeSelection = async ({ check_in, check_out, apartment_ids }) => {
  const note = prompt('Подпись для гостя (необязательно):', '') ; if (note === null) return;
  try {
    const r = await api(null, { a: 'selection_create', check_in, check_out, apartment_ids, note });
    const url = r.url; const txt = 'Urban Luxe · свободные апартаменты ' + ruD(check_in) + '–' + ruD(check_out) + ': ' + url;
    openDrawer('Подборка для гостя', `<div class="muted" style="font-size:12px">${apartment_ids.length} кв. · ${ruD(check_in)} → ${ruD(check_out)} · ссылка действует 30 дней</div>
      <div style="display:flex;gap:6px;margin:10px 0"><input value="${esc(url)}" readonly style="flex:1" onclick="this.select()"><button class="sm" id="s_copy">копировать</button></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><a class="sm" style="padding:6px 10px;border:1px solid var(--line);border-radius:8px;text-decoration:none" target="_blank" href="https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Urban Luxe · свободные апартаменты ' + ruD(check_in) + '–' + ruD(check_out))}">Отправить в Telegram</a><a class="sm" style="padding:6px 10px;border:1px solid var(--line);border-radius:8px;text-decoration:none" target="_blank" href="https://wa.me/?text=${encodeURIComponent(txt)}">WhatsApp</a><a class="sm" style="padding:6px 10px;border:1px solid var(--line);border-radius:8px;text-decoration:none" target="_blank" href="${esc(url)}">Открыть</a></div>`,
      '<button onclick="closeDrawer()">Закрыть</button>');
    $('#s_copy').onclick = () => navigator.clipboard.writeText(url).then(() => toast('Ссылка скопирована'));
  } catch (e) { alert(e.message); }
};
})();
