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
  // 17.10.2026: фото и описания — в карточке квартиры здесь (партнёры в /admin не ходят); ссылка в Админку — только платформа-админу (SEO, условия, инструкции)
  $('#tools').innerHTML = `<button class="pri sm" id="o_apt">+ Квартира</button><button class="sm" id="o_cx">+ ЖК</button><label style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--muted)"><input type="checkbox" id="o_arch">показать архив</label><span class="muted">ЖК, квартиры, фото и описания — в карточке (✎).${ME.platform_admin ? ' SEO сайта, условия аренды и инструкции заселения — в <a href="/admin#apartments" target="_blank">Админке → Квартиры</a>.' : ''}</span>`;
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
        (apts.length ? `<table class="t"><tr><th>№</th><th>Название</th><th>Код</th><th>Этаж</th><th>Гостей</th><th>Комнат</th><th>Будни</th><th>Вых.</th><th>Мин. ночей</th><th>Фото</th><th>Channex</th><th></th></tr>` +
          apts.map(a => `<tr style="${a.is_active ? '' : 'opacity:.5'}"><td>${num(a.catalog_no)}</td><td class="b">${esc(a.name)}${(a.partners || []).map(x => { const o = D.orgs.find(y => y.id === x.org_id) || {}; return ' <span class="tag" style="background:#e3ecff" title="партнёр: ' + esc(o.name || x.org_id) + (x.mode === 'occupancy' ? ' (только занятость)' : ' (полный доступ)') + '">' + esc(o.short || o.name || x.org_id) + '</span>'; }).join('')}${a.is_active ? '' : ' <span class="tag bad">архив</span>'}${a.tracked === false ? ' <span class="tag" title="не считается в загрузке">вне учёта</span>' : ''}</td><td><code style="font-size:11px">${esc(a.id)}</code></td><td>${num(a.floor)}</td><td>${num(a.max_guests)}</td><td>${esc(a.rooms || '')}</td><td>${a.weekday_price ? money(a.weekday_price) : ''}</td><td>${a.weekend_price ? money(a.weekend_price) : ''}</td><td>${num(a.min_nights)}</td><td>${(a.photos || []).length ? (a.photos.length + (a.description_en ? '' : ' <span class="tag" title="нет описания EN — площадки не получат текст">без EN</span>')) : '<span class="tag bad" title="без фото квартира не пойдёт на площадки и в подборки">нет</span>'}</td><td>${a.unit && a.unit.external_room_type_id ? (a.unit.is_active ? '<span style="color:var(--green)">✓</span>' : '<span class="muted">выкл</span>') : '<span class="muted">—</span>'}${a.unit && a.unit.last_error ? ' <span class="tag bad" title="' + esc(a.unit.last_error) + '">ошибка</span>' : ''}</td><td><button class="sm" data-ape="${a.id}">✎</button></td></tr>`).join('') + `</table>` : '<div class="muted">квартир нет</div>') + `</div>`;
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
      `<button class="pri" id="x_ok">${isNew ? 'Создать' : 'Сохранить'}</button>${!isNew && ME.can.objects_archive ? '<button class="danger" id="x_del" title="Только если в ЖК нет броней: удаляются квартиры и карточка в Channex">Удалить ЖК</button>' : ''}<button onclick="closeDrawer()">Отмена</button>`);
    $('#x_ok').onclick = async () => { try { await api(null, { a: 'complex_save', id: c.id, name: $('#x_name').value.trim(), address: $('#x_addr').value.trim(), city: $('#x_city').value.trim(), timezone: $('#x_tz').value.trim(), notes: $('#x_notes').value.trim(), is_active: $('#x_act').checked }); P.closeDrawer(); toast('Сохранено'); load(); } catch (e) { alert(e.message); } };
    if ($('#x_del')) $('#x_del').onclick = async () => { if (!confirm('Удалить ЖК «' + c.name + '» со всеми его квартирами и карточкой Channex? Возможно только без броней.')) return; try { const r = await api(null, { a: 'complex_delete', id: c.id }); P.closeDrawer(); toast('Удалено: ' + (r.log || []).join('; ').slice(0, 120)); load(); } catch (e) { alert(e.message); } };
  };
  // --- карточка квартиры: вкладки Данные / Фото / Описание (17.10.2026) ---
  const SB_PUB = 'https://sebvfvtofiysbywxjqut.supabase.co/storage/v1/object/public/apartments/';
  const AMEN = { wifi: 'Wi-Fi', ac: 'Кондиционер', kitchen: 'Кухня', washer: 'Стиральная машина', tv: 'Smart TV', parking: 'Парковка', elevator: 'Лифт', balcony: 'Балкон', pool: 'Бассейн', gym: 'Спортзал', workspace: 'Рабочее место', pets: 'Можно с животными', crib: 'Детская кроватка', concierge: 'Консьерж' };
  const thumbOf = u => u.includes('/storage/v1/object/public/') ? 'https://images.weserv.nl/?url=' + encodeURIComponent(u.replace(/^https?:\/\//, '')) + '&w=300&h=220&fit=cover&output=webp' : u;
  const aptTabs = (a, cur) => `<div class="tabs" style="display:flex;gap:4px;margin:-4px 0 10px">${[['data', 'Данные'], ['photos', 'Фото' + (a.photos && a.photos.length ? ' · ' + a.photos.length : '')], ['desc', 'Описание']].map(([k, t]) => `<button class="sm ${cur === k ? 'pri' : ''}" data-at="${k}">${t}</button>`).join('')}</div>`;
  const editPhotos = (a) => {
    let PH = (a.photos || []).slice();
    openDrawer(a.name, aptTabs(a, 'photos') + `<div class="muted" style="font-size:11px;margin-bottom:8px">Первое фото — обложка (в подборках для гостей и на площадках). ← → меняют порядок, ★ делает обложкой. Файлы до 20 МБ.</div>
      <div id="ph_grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px"></div>
      <div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input type="file" id="ph_file" accept="image/*" multiple style="font-size:12px"><button class="sm pri" id="ph_up">Загрузить</button><span style="flex:1"></span><button class="sm" id="ph_save">Сохранить порядок</button></div><div id="ph_st" class="muted" style="font-size:11px;margin-top:6px"></div>`,
      `<button onclick="closeDrawer()">Закрыть</button>`);
    $$('#d_body [data-at]').forEach(b => b.onclick = () => b.dataset.at === 'data' ? editApt(a) : b.dataset.at === 'desc' ? editDesc(a) : null);
    const draw = () => {
      $('#ph_grid').innerHTML = PH.map((u, i) => `<div style="position:relative;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#f6f7f9"><img src="${esc(thumbOf(u))}" loading="lazy" style="width:100%;height:100px;object-fit:cover;display:block">${i === 0 ? '<span class="tag" style="position:absolute;left:6px;top:6px;background:#111;color:#fff">обложка</span>' : ''}<div style="display:flex;gap:2px;padding:4px;justify-content:center"><button class="sm" data-l="${i}" title="левее">←</button><button class="sm" data-r="${i}" title="правее">→</button><button class="sm" data-c="${i}" title="обложка">★</button><button class="sm danger" data-x="${i}" title="удалить">✕</button></div></div>`).join('') || '<div class="muted">фото нет — загрузите ниже</div>';
      const mv = (i, j) => { if (j < 0 || j >= PH.length) return; const t = PH[i]; PH[i] = PH[j]; PH[j] = t; draw(); };
      $$('#ph_grid [data-l]').forEach(b => b.onclick = () => mv(+b.dataset.l, +b.dataset.l - 1));
      $$('#ph_grid [data-r]').forEach(b => b.onclick = () => mv(+b.dataset.r, +b.dataset.r + 1));
      $$('#ph_grid [data-c]').forEach(b => b.onclick = () => { const u = PH.splice(+b.dataset.c, 1)[0]; PH.unshift(u); draw(); });
      $$('#ph_grid [data-x]').forEach(b => b.onclick = () => { if (!confirm('Удалить фото? Файл удалится из хранилища после «Сохранить порядок».')) return; PH.splice(+b.dataset.x, 1); draw(); });
    };
    const savePh = async () => { try { const r = await api(null, { a: 'apt_photos', id: a.id, photos: PH }); PH = r.photos.slice(); a.photos = PH.slice(); $('#ph_st').textContent = 'Сохранено · фото ' + r.photos.length + (r.deleted.length ? ' · удалено файлов ' + r.deleted.length : ''); toast('Фото сохранены'); $$('#d_body [data-at="photos"]').forEach(b => b.textContent = 'Фото' + (PH.length ? ' · ' + PH.length : '')); } catch (e) { alert(e.message); } };
    $('#ph_save').onclick = savePh;
    $('#ph_up').onclick = async () => {
      const inp = $('#ph_file'), st = $('#ph_st'); if (!inp.files.length) { st.textContent = 'Выберите файлы'; return; }
      $('#ph_up').disabled = true; let n = 0;
      for (const f of inp.files) {
        if (f.size > 20 * 1024 * 1024) { st.textContent = f.name + ': больше 20 МБ, пропущено'; continue; }
        const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const path = a.id + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
        st.textContent = 'Загружаю ' + (n + 1) + ' из ' + inp.files.length + '…';
        const { error } = await P.sb.storage.from('apartments').upload(path, f, { cacheControl: '3600', upsert: false, contentType: f.type || undefined });
        if (error) { st.textContent = 'Ошибка: ' + error.message; break; }
        PH.push(SB_PUB + path); n++;
      }
      $('#ph_up').disabled = false; inp.value = ''; draw();
      if (n) { st.textContent = '✓ ' + n + ' фото загружено — сохраняю…'; await savePh(); }
    };
    draw();
  };
  const editDesc = (a) => {
    openDrawer(a.name, aptTabs(a, 'desc') + `<div class="f">
      <label class="w">Подзаголовок / стиль <input id="ds_style" value="${esc(a.style || '')}" placeholder="Студия с видом на город"></label>
      <label class="w">Описание (RU) <textarea id="ds_ru" rows="6">${esc(a.description || '')}</textarea></label>
      <label class="w">Description (EN) <textarea id="ds_en" rows="5">${esc(a.description_en || '')}</textarea></label>
      <label class="w">Tavsif (UZ) <textarea id="ds_uz" rows="4">${esc(a.description_uz || '')}</textarea></label>
      <label class="w">Удобства <div style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:4px;font-size:12px;color:var(--text)">${Object.entries(AMEN).map(([k, v]) => `<span><input type="checkbox" data-am="${k}" ${(a.amenities || []).includes(k) ? 'checked' : ''}> ${v}</span>`).join('')}</div></label></div>
      <div class="muted" style="font-size:11px">Описание на английском уходит в карточку комнаты Channex при подключении квартиры (его видят площадки).</div>`,
      `<button class="pri" id="ds_ok">Сохранить</button><button onclick="closeDrawer()">Отмена</button>`);
    $$('#d_body [data-at]').forEach(b => b.onclick = () => b.dataset.at === 'data' ? editApt(a) : b.dataset.at === 'photos' ? editPhotos(a) : null);
    $('#ds_ok').onclick = async () => {
      const o = { a: 'apt_save', id: a.id, name: a.name, complex: a.complex, style: $('#ds_style').value.trim(), description: $('#ds_ru').value.trim(), description_en: $('#ds_en').value.trim(), description_uz: $('#ds_uz').value.trim(), amenities: $$('#d_body [data-am]:checked').map(x => x.dataset.am) };
      try { const r = await api(null, o); Object.assign(a, { style: r.style, description: r.description, description_en: r.description_en, description_uz: r.description_uz, amenities: r.amenities }); toast('Описание сохранено'); } catch (e) { alert(e.message); }
    };
  };
  const editApt = (a) => { a = a || {}; const isNew = !a.id; const u = a.unit;
    const slug = (a.complex || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12);
    openDrawer(isNew ? 'Новая квартира' : a.name, (isNew ? '' : aptTabs(a, 'data')) + `<div class="f">
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
      ${isNew ? '<div class="muted" style="font-size:11px">После создания квартира появится в шахматке; дальше — вкладки «Фото» и «Описание» в карточке' + (ME.org && ME.org.id === 1 ? ' (на сайт — после фото и описания)' : '') + '. Чтобы продавать на площадках: «Каналы» → подключить ЖК → в карточке квартиры «Подключить к Channex».</div>' : ''}
      ${!isNew && ME.role === 'admin' ? `<div class="sec">Channex</div>${u && u.external_room_type_id ? '<div class="muted" style="font-size:11px">room ' + esc(u.external_room_type_id) + ' · тарифы: Standard' + Object.keys(u.derived || {}).map(k => ', ' + (OTA_RU[k] || k)).join('') + (u.last_pushed_at ? ' · отправлено ' + dt(u.last_pushed_at) : '') + '</div>' : '<div class="muted" style="font-size:11px">Комнаты в Channex нет.</div><button class="sm" id="a_cxu" style="margin-top:6px">Подключить к Channex</button>'}` : ''}`,
      `<button class="pri" id="a_ok">${isNew ? 'Создать' : 'Сохранить'}</button>${!isNew && ME.can.objects_archive ? (a.is_active ? '<button class="danger" id="a_arch">В архив</button>' : '<button id="a_rest">Восстановить</button>') + '<button class="danger" id="a_del" title="Только без броней (например, тестовая или созданная по ошибке)">Удалить</button>' : ''}<button onclick="closeDrawer()">Отмена</button>`);
    if ($('#a_del')) $('#a_del').onclick = async () => { if (!confirm('Удалить квартиру «' + a.name + '» насовсем (вместе с комнатой в Channex)? Возможно только без броней.')) return; try { await api(null, { a: 'apt_delete', id: a.id }); P.closeDrawer(); toast('Квартира удалена'); load(); } catch (e) { alert(e.message); } };
    $('#a_ok').onclick = async () => {
      const o = { id: ($('#a_id').value || '').trim().toLowerCase(), name: $('#a_name').value.trim(), complex: $('#a_cx').value, catalog_no: $('#a_no').value, floor: $('#a_fl').value, max_guests: $('#a_mg').value, rooms: $('#a_rm').value.trim(), min_nights: $('#a_mn').value, weekday_price: $('#a_wd').value, weekend_price: $('#a_we').value, tracked: $('#a_tr').checked, partner_org_id: $('#a_po').value || null, partner_mode: $('#a_pm').value };
      if (!o.id) return alert('Код квартиры'); if (!o.name) return alert('Название');
      try { const r = await api(null, Object.assign({ a: 'apt_save' }, o)); toast(isNew ? 'Квартира создана — добавьте фото' : 'Сохранено'); await load();
        if (isNew) { const na = D.apartments.find(x => x.id === r.id) || Object.assign(r, { photos: [] }); editPhotos(na); } else P.closeDrawer(); } catch (e) { alert(e.message); }
    };
    if (!isNew) $$('#d_body [data-at]').forEach(b => b.onclick = () => b.dataset.at === 'photos' ? editPhotos(a) : b.dataset.at === 'desc' ? editDesc(a) : null);
    if ($('#a_arch')) $('#a_arch').onclick = async () => { if (!confirm('Убрать «' + a.name + '» в архив? Продажи закроются на 500 дней вперёд на всех площадках, квартира исчезнет из шахматки и с сайта. Брони останутся.')) return; try { const r = await api(null, { a: 'apt_archive', id: a.id }); P.closeDrawer(); toast('В архиве · закрыто дней: ' + (r.days || 0)); load(); } catch (e) { alert(e.message); } };
    if ($('#a_rest')) $('#a_rest').onclick = async () => { try { await api(null, { a: 'apt_restore', id: a.id }); P.closeDrawer(); toast('Восстановлена, цены и занятость уйдут на площадки за минуту'); load(); } catch (e) { alert(e.message); } };
    if ($('#a_cxu')) $('#a_cxu').onclick = async () => { $('#a_cxu').disabled = true; $('#a_cxu').textContent = 'создаю комнату и тарифы…'; try { const r = await capi(null, { a: 'setup_unit', apartment_id: a.id }); toast('Channex: ' + r.log.join('; ').slice(0, 120)); P.closeDrawer(); load(); } catch (e) { alert(e.message); $('#a_cxu').disabled = false; $('#a_cxu').textContent = 'Подключить к Channex'; } };
  };
  $('#o_apt').onclick = () => editApt(null); $('#o_cx').onclick = () => editComplex(null); $('#o_arch').onchange = load;
  load();
};

// =====================================================================
// ОРГАНИЗАЦИИ (платформа-админ) — PMS v2-B
// =====================================================================
VIEWS.orgs = async () => {
  $('#tools').innerHTML = `<button class="pri sm" id="g_new">+ Организация</button><span class="muted">Кабинеты клиентов и партнёров: свои объекты, сотрудники, каналы. Партнёры сети видят занятость и цены друг друга. Channex: по умолчанию — наша учётка (своя группа на организацию), либо свой ключ клиента.</span>`;
  $('#main').innerHTML = '<div class="page"><div class="card" id="og">загрузка…</div></div>';
  let L;
  const load = async () => {
    try { L = await api({ a: 'orgs' }); } catch (e) { $('#og').innerHTML = esc(e.message); return; }
    const nm = id => (L.find(o => o.id === id) || {}).short || id;
    $('#og').innerHTML = `<table class="t"><tr><th>#</th><th>Организация</th><th>Код</th><th>Квартир</th><th>Сотрудников</th><th>Channex</th><th>Партнёры</th><th>TG-чат</th><th></th></tr>` +
      L.map(o => `<tr style="${o.is_active ? '' : 'opacity:.5'}"><td>${o.id}</td><td class="b">${esc(o.name)}${o.id === 1 ? ' <span class="tag">платформа</span>' : ''}${o.is_active ? '' : ' <span class="tag bad">выкл</span>'}</td><td><code>${esc(o.slug || '')}</code> ${esc(o.short || '')}</td><td>${o.apartments}${o.plan_limit ? ' / ' + o.plan_limit : ''}</td><td>${o.users}</td><td class="muted" style="font-size:11px">${o.channex.own_key ? 'свой ключ' : o.channex.group_id ? 'группа ' + esc(String(o.channex.group_id).slice(0, 8)) : (o.id === 1 ? 'наш аккаунт' : '<span class="muted">группа при первом подключении</span>')}</td><td>${(o.partners || []).map(nm).map(esc).join(', ') || '<span class="muted">—</span>'}</td><td class="muted" style="font-size:11px">${esc(o.tg_chat_id || '')}</td><td><button class="sm" data-oe="${o.id}">✎</button></td></tr>`).join('') + '</table>';
    $$('#og [data-oe]').forEach(b => b.onclick = () => edit(L.find(o => String(o.id) === b.dataset.oe)));
  };
  const edit = (o) => { o = o || { is_active: true, partners: [] }; const isNew = !o.id;
    openDrawer(isNew ? 'Новая организация' : o.name, `<div class="f">
      <label class="w">Название <input id="g_name" value="${esc(o.name || '')}" placeholder="HighLife"></label>
      <label>Короткий код <input id="g_short" value="${esc(o.short || '')}" placeholder="HL" maxlength="6"></label><label>Slug (для ссылок) <input id="g_slug" value="${esc(o.slug || '')}" placeholder="highlife"></label>
      <label>Telegram <input id="g_tg" value="${esc(o.telegram || '')}" placeholder="@канал или ник"></label><label>TG chat_id для уведомлений <input id="g_chat" value="${esc(o.tg_chat_id || '')}" placeholder="пусто — наш чат"></label>
      <label>Лимит квартир (тариф) <input id="g_lim" type="number" min="1" value="${o.plan_limit || ''}" placeholder="без лимита"></label><label>Логотип (URL) <input id="g_logo" value="${esc(o.logo_url || '')}"></label>
      <label class="w">Свой ключ Channex <input id="g_key" type="password" autocomplete="off" placeholder="${o.channex && o.channex.own_key ? 'задан — пусто = не менять' : 'пусто = наш аккаунт, своя группа'}"></label>
      <label style="flex-direction:row;gap:6px;align-items:center;color:var(--text)"><input type="checkbox" id="g_act" ${o.is_active !== false ? 'checked' : ''}>активна</label></div>
      ${isNew ? '' : `<div class="sec">Партнёры сети</div><div class="muted" style="font-size:11px;margin-bottom:6px">Партнёры видят личные квартиры друг друга только занятостью и ценой (вкладка «Партнёры»). Общие квартиры задаются в карточке квартиры.</div>${L.filter(x => x.id !== o.id).map(x => `<label style="display:inline-flex;flex-direction:row;gap:4px;margin:2px 12px 2px 0;font-size:12px;color:var(--text)"><input type="checkbox" data-pt="${x.id}" ${(o.partners || []).includes(x.id) ? 'checked' : ''}>${esc(x.name)}</label>`).join('')}`}`,
      `<button class="pri" id="g_ok">${isNew ? 'Создать' : 'Сохранить'}</button>${!isNew && o.id !== 1 ? '<button class="danger" id="g_del">Удалить</button>' : ''}<button onclick="closeDrawer()">Отмена</button>`);
    if ($('#g_del')) $('#g_del').onclick = async () => { const c = prompt('Удалить организацию «' + o.name + '» со всеми квартирами, бронями, сотрудниками и Channex-карточками? Введите точное название для подтверждения:'); if (c === null) return; try { const r = await api(null, { a: 'org_delete', id: o.id, confirm: c }); P.closeDrawer(); toast('Удалено: ' + r.log.join('; ').slice(0, 150), 7000); load(); } catch (e) { alert(e.message); } };
    $$('#d_body [data-pt]').forEach(c => c.onchange = async () => { try { await api(null, { a: 'org_partner_set', org_id: o.id, partner_org_id: c.dataset.pt, on: c.checked }); toast(c.checked ? 'Партнёрство включено' : 'Партнёрство снято'); } catch (e) { alert(e.message); c.checked = !c.checked; } });
    $('#g_ok').onclick = async () => { const b = { id: o.id, name: $('#g_name').value.trim(), short: $('#g_short').value.trim(), slug: $('#g_slug').value.trim(), telegram: $('#g_tg').value.trim(), tg_chat_id: $('#g_chat').value.trim(), plan_limit: $('#g_lim').value, logo_url: $('#g_logo').value.trim(), is_active: $('#g_act').checked }; if ($('#g_key').value) b.channex_api_key = $('#g_key').value.trim();
      try { await api(null, Object.assign({ a: 'org_save' }, b)); P.closeDrawer(); toast(isNew ? 'Организация создана — теперь пригласите её администратора в «Сотрудниках», переключившись в её кабинет' : 'Сохранено', 6000); load(); } catch (e) { alert(e.message); } };
  };
  $('#g_new').onclick = () => edit(null); load();
};

// =====================================================================
// ИНТЕГРАЦИИ — API-ключи, вебхуки, виджет (admin организации)
// =====================================================================
VIEWS.integrations = async () => {
  $('#tools').innerHTML = `<button class="pri sm" id="k_new">+ API-ключ</button><button class="sm" id="w_new">+ Вебхук</button><span class="muted">Подключение сайта партнёра к PMS: ключи для API, вебхуки о бронях, готовый виджет бронирования. <a target="_blank" id="docs_link" href="/api/docs">Документация API</a></span>`;
  $('#main').innerHTML = '<div class="page" id="ig"><div class="muted">загрузка…</div></div>';
  let D; const SC = { read: 'чтение', book: 'брони', cancel: 'отмена', manage: 'управление' };
  const load = async () => {
    try { D = await api({ a: 'integrations' }); } catch (e) { $('#ig').innerHTML = '<div class="card">' + esc(e.message) + '</div>'; return; }
    const hookName = id => (D.webhooks.find(w => w.id === id) || {}).url || id;
    let h = `<div class="card"><h3>API-ключи <span class="muted">${D.keys.length}</span></h3><div class="muted" style="font-size:12px;margin-bottom:6px">Секретный ключ (sk_…) — для сервера партнёра, показывается один раз. Публичный (pk_…) — для виджета на сайте, умеет только смотреть свободное и создавать заявки. Базовый адрес: <code>${esc(D.api_base)}</code></div>` +
      (D.keys.length ? `<table class="t"><tr><th>Название</th><th>Тип</th><th>Ключ</th><th>Права</th><th>Использован</th><th></th></tr>` + D.keys.map(k => `<tr style="${k.is_active ? '' : 'opacity:.5'}"><td class="b">${esc(k.name)}</td><td>${k.kind === 'public' ? 'публичный' : 'секретный'}</td><td><code style="font-size:11px">${esc(k.prefix)}</code></td><td>${(k.scopes || []).map(x => SC[x] || x).join(', ')}</td><td class="muted nowrap">${dt(k.last_used_at)}</td><td><button class="sm ${k.is_active ? 'danger' : ''}" data-kt="${k.id}" data-on="${k.is_active ? 0 : 1}">${k.is_active ? 'отключить' : 'включить'}</button></td></tr>`).join('') + '</table>' : '<div class="muted">ключей нет</div>') + '</div>';
    h += `<div class="card"><h3>Вебхуки <span class="muted">${D.webhooks.length}</span></h3><div class="muted" style="font-size:12px;margin-bottom:6px">POST JSON на ваш URL при создании/изменении/отмене брони по вашим квартирам (с любой площадки). Подпись: заголовок <code>X-UL-Signature: sha256=HMAC(секрет, тело)</code>. Повторы 1/5/30/120 мин, до 5 попыток.</div>` +
      (D.webhooks.length ? D.webhooks.map(w => `<div class="li" data-wh="${w.id}"><div class="g"><div class="n">${esc(w.url)} ${w.is_active ? '' : '<span class="tag bad">выкл</span>'}</div><div class="s">${(w.events || []).join(', ')} · секрет <code>${esc(w.secret)}</code> · последний ответ ${w.last_status == null ? '—' : w.last_status} ${dt(w.last_at)}</div></div><button class="sm" data-wp="${w.id}">проверить</button><button class="sm" data-we="${w.id}">✎</button><button class="sm danger" data-wd="${w.id}">✕</button></div>`).join('') : '<div class="muted">вебхуков нет</div>') + '</div>';
    h += `<div class="card"><h3>Виджет бронирования</h3><div class="muted" style="font-size:12px">Одна строка на сайт партнёра — даты, свободные квартиры с фото и ценой, форма заявки. Заявки попадают в /pms как с сайта.</div>` + (D.widget_snippet ? `<div style="display:flex;gap:6px;margin-top:8px"><input value="${esc(D.widget_snippet)}" readonly style="flex:1;font-size:11px" onclick="this.select()"><button class="sm" id="ws_copy">копировать</button></div><div class="muted" style="font-size:11px;margin-top:4px">Опции: <code>data-target="#id"</code> — куда вставить, <code>data-lang="ru|en"</code>, <code>data-apartments="id1,id2"</code> — только эти квартиры.</div>` : '<div class="muted" style="margin-top:6px">Создайте публичный ключ (тип «публичный») — появится код для вставки.</div>') + '</div>';
    h += `<div class="card"><h3>Доставки вебхуков <span class="muted">${D.deliveries.length}</span></h3>` + (D.deliveries.length ? `<table class="t"><tr><th>Когда</th><th>Событие</th><th>Вебхук</th><th>Попыток</th><th>Статус</th><th>Ответ</th><th></th></tr>` + D.deliveries.map(d => `<tr><td class="nowrap">${dt(d.created_at)}</td><td>${esc(d.event)}</td><td style="font-size:11px;max-width:220px;overflow:hidden;text-overflow:ellipsis">${esc(hookName(d.webhook_id))}</td><td>${d.attempts}</td><td>${d.sent_at ? (d.status === -1 ? '<span class="tag bad">не доставлен</span>' : d.status === -2 ? '<span class="muted">выкл</span>' : '<span class="tag" style="background:#d9f3dd">' + d.status + '</span>') : '<span class="muted">ждёт ' + dt(d.next_at) + '</span>'}</td><td class="muted" style="font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis" title="${esc(d.response || '')}">${esc((d.response || '').slice(0, 60))}</td><td><button class="sm" data-dr="${d.id}">повторить</button></td></tr>`).join('') + '</table>' : '<div class="muted">доставок нет</div>') + '</div>';
    h += `<div class="card"><h3>Журнал API <span class="muted">${D.log.length}</span></h3>` + (D.log.length ? `<table class="t"><tr><th>Когда</th><th>Метод</th><th>Путь</th><th>Статус</th><th>мс</th></tr>` + D.log.map(l => `<tr><td class="nowrap">${dt(l.created_at)}</td><td>${l.method}</td><td>${esc(l.path)}</td><td style="color:${l.status >= 400 ? 'var(--red)' : ''}">${l.status}</td><td>${l.ms}</td></tr>`).join('') + '</table>' : '<div class="muted">запросов не было</div>') + '</div>';
    $('#ig').innerHTML = h;
    $$('#ig [data-kt]').forEach(b => b.onclick = async () => { try { await api(null, { a: 'api_key_toggle', id: b.dataset.kt, is_active: b.dataset.on === '1' }); load(); } catch (e) { alert(e.message); } });
    $$('#ig [data-wp]').forEach(b => b.onclick = async () => { b.disabled = true; b.textContent = 'шлю…'; try { const r = await api(null, { a: 'webhook_ping', id: b.dataset.wp }); toast(r.delivery.sent_at && r.delivery.status > 0 ? 'Доставлено: ' + r.delivery.status : 'Ошибка: ' + (r.delivery.status || '') + ' ' + (r.delivery.response || ''), 6000); } catch (e) { alert(e.message); } load(); });
    $$('#ig [data-we]').forEach(b => b.onclick = () => editHook(D.webhooks.find(w => w.id === b.dataset.we)));
    $$('#ig [data-wd]').forEach(b => b.onclick = async () => { if (!confirm('Удалить вебхук?')) return; await api(null, { a: 'webhook_delete', id: b.dataset.wd }); load(); });
    $$('#ig [data-dr]').forEach(b => b.onclick = async () => { b.disabled = true; try { const r = await api(null, { a: 'webhook_retry', id: b.dataset.dr }); toast(r.delivery.status > 0 ? 'Доставлено: ' + r.delivery.status : 'Ошибка: ' + (r.delivery.response || ''), 5000); } catch (e) { alert(e.message); } load(); });
    if ($('#ws_copy')) $('#ws_copy').onclick = () => navigator.clipboard.writeText(D.widget_snippet).then(() => toast('Скопировано'));
  };
  const newKey = () => {
    openDrawer('Новый API-ключ', `<div class="f"><label class="w">Название <input id="k_name" placeholder="Сайт партнёра / CRM"></label>
      <label>Тип <select id="k_kind"><option value="secret">секретный (сервер)</option><option value="public">публичный (виджет на сайте)</option></select></label>
      <div class="w" id="k_sc" style="grid-column:1/3"><div class="sec">Права</div>${[['read', 'чтение: квартиры, свободно, цены, брони'], ['book', 'создание заявок/броней'], ['cancel', 'отмена своих броней'], ['manage', 'управление всеми бронями квартир (отмена любых)']].map(([k, t]) => `<label style="display:flex;flex-direction:row;gap:6px;align-items:center;color:var(--text);font-size:12px;margin:3px 0"><input type="checkbox" style="width:auto;margin:0;flex:0 0 auto" data-sc="${k}" ${k !== 'manage' ? 'checked' : ''}>${t}</label>`).join('')}</div></div>`,
      `<button class="pri" id="k_ok">Создать</button><button onclick="closeDrawer()">Отмена</button>`);
    $('#k_kind').onchange = () => { $('#k_sc').style.display = $('#k_kind').value === 'public' ? 'none' : ''; };
    $('#k_ok').onclick = async () => { try { const r = await api(null, { a: 'api_key_create', name: $('#k_name').value.trim(), kind: $('#k_kind').value, scopes: $$('#k_sc [data-sc]:checked').map(x => x.dataset.sc) });
      openDrawer('Ключ создан', `<div class="warn">Скопируйте ключ сейчас — больше он не будет показан целиком.</div><div style="display:flex;gap:6px;margin:10px 0"><input value="${esc(r.key)}" readonly style="flex:1;font-family:monospace" onclick="this.select()"><button class="sm" id="k_copy">копировать</button></div><div class="muted" style="font-size:12px">${r.kind === 'public' ? 'Вставьте в виджет: <code>&lt;script src="' + esc(location.origin) + '/widget.js" data-key="' + esc(r.key) + '"&gt;&lt;/script&gt;</code>' : 'Заголовок запроса: <code>Authorization: Bearer ' + esc(r.key) + '</code>'}</div>`, '<button class="pri" onclick="closeDrawer()">Готово</button>');
      $('#k_copy').onclick = () => navigator.clipboard.writeText(r.key).then(() => toast('Скопировано')); load(); } catch (e) { alert(e.message); } };
  };
  const editHook = (w) => { w = w || {};
    openDrawer(w.id ? 'Вебхук' : 'Новый вебхук', `<div class="f"><label class="w">URL (https) <input id="h_url" value="${esc(w.url || '')}" placeholder="https://partner.site/hooks/urbanluxe"></label>
      <div class="w" style="grid-column:1/3"><div class="sec">События</div>${['booking.created', 'booking.updated', 'booking.cancelled'].map(e => `<label style="display:flex;flex-direction:row;gap:6px;align-items:center;color:var(--text);font-size:12px;margin:3px 0"><input type="checkbox" style="width:auto;margin:0;flex:0 0 auto" data-ev="${e}" ${!w.events || w.events.includes(e) ? 'checked' : ''}>${e}</label>`).join('')}</div>
      ${w.id ? `<label style="flex-direction:row;gap:6px;align-items:center;color:var(--text)"><input type="checkbox" id="h_act" ${w.is_active !== false ? 'checked' : ''}>активен</label><label style="flex-direction:row;gap:6px;align-items:center;color:var(--text)"><input type="checkbox" id="h_rot">перегенерировать секрет</label>` : ''}</div>
      ${w.secret ? '<div class="muted" style="font-size:12px">Секрет: <code>' + esc(w.secret) + '</code></div>' : '<div class="muted" style="font-size:12px">Секрет для подписи будет создан автоматически.</div>'}`,
      `<button class="pri" id="h_ok">Сохранить</button><button onclick="closeDrawer()">Отмена</button>`);
    $('#h_ok').onclick = async () => { try { await api(null, { a: 'webhook_save', id: w.id, url: $('#h_url').value.trim(), events: $$('#d_body [data-ev]:checked').map(x => x.dataset.ev), is_active: $('#h_act') ? $('#h_act').checked : true, rotate_secret: $('#h_rot') ? $('#h_rot').checked : false }); P.closeDrawer(); toast('Сохранено'); load(); } catch (e) { alert(e.message); } };
  };
  $('#k_new').onclick = newKey; $('#w_new').onclick = () => editHook(null); load();
};

// =====================================================================
// ОТЧЁТ СОБСТВЕННИКА / по квартире — PMS v2-B
// =====================================================================
VIEWS.report = async () => {
  const ME = P.me(); const y0 = new Date().getUTCFullYear();
  const apts = ((await P.ensureGrid()).apartments || []).filter(a => a.mode !== 'occupancy');
  $('#tools').innerHTML = `<select id="r_year">${[y0 - 1, y0, y0 + 1].map(y => `<option ${y === y0 ? 'selected' : ''}>${y}</option>`).join('')}</select>${ME.role === 'partner' ? '' : `<select id="r_apt"><option value="">все мои квартиры</option>${apts.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select>`}<button class="sm" id="r_csv">CSV</button><span class="muted">Доход — сумма броней (подтверждённые, живут, выехали) пропорционально ночам месяца. Доля собственника — по настройке квартиры (по умолчанию 100 %).</span>`;
  $('#main').innerHTML = '<div class="page"><div class="card" id="rp">загрузка…</div></div>';
  let R;
  const MN = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const load = async () => {
    try { R = await api({ a: 'owner_report', year: $('#r_year').value, apartment_id: $('#r_apt') ? $('#r_apt').value : '' }); } catch (e) { $('#rp').innerHTML = esc(e.message); return; }
    const tot = R.months.reduce((s, m) => ({ nights: s.nights + m.nights, income: s.income + m.income, owner: s.owner + m.owner_income, bookings: s.bookings + m.bookings }), { nights: 0, income: 0, owner: 0, bookings: 0 });
    $('#rp').innerHTML = `<h3>${R.year} · ${R.apartments.map(a => esc(a.name)).join(', ') || 'квартир нет'}</h3><div class="kpi"><div><b>${tot.nights}</b>ночей</div><div><b>${money(tot.income)}</b>доход</div><div><b>${money(tot.owner)}</b>доля собственника</div><div><b>${tot.bookings}</b>броней</div></div>
      <table class="t"><tr><th>Месяц</th><th>Ночей</th><th>Загрузка</th><th>Броней</th><th>Ср. цена/ночь</th><th>Доход</th><th>Доля собственника</th></tr>` + R.months.map(m => `<tr><td>${MN[m.month - 1]}</td><td>${m.nights}</td><td>${m.occupancy}%</td><td>${m.bookings}</td><td>${m.adr ? money(m.adr) : '—'}</td><td class="b">${money(m.income)}</td><td class="b">${money(m.owner_income)}</td></tr>`).join('') + `</table>`;
  };
  $('#r_csv').onclick = () => { if (!R) return; const rows = [['Месяц', 'Ночей', 'Загрузка %', 'Броней', 'Ср. цена', 'Доход USD', 'Доля собственника USD']].concat(R.months.map(m => [MN[m.month - 1], m.nights, m.occupancy, m.bookings, m.adr, m.income, m.owner_income])); const csv = rows.map(r => r.join(';')).join('\n'); const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,\ufeff' + encodeURIComponent(csv); a.download = 'report-' + R.year + '.csv'; a.click(); };
  $('#r_year').onchange = load; if ($('#r_apt')) $('#r_apt').onchange = load; load();
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
