// Urban Luxe — admin/apartments.js (14.10.2026). Раздел «Квартиры»: карточки сайта (то, что видит гость) + условия + инструкции по заселению.
// Данные: admin-api ?a=apt_list | ?a=apt&id= ; POST apt_save / apt_photos / checkin_save. Фото грузятся из браузера прямо в Storage (bucket apartments/<id>/…),
// порядок и обложка (первое фото) сохраняются в apartments.photo_url (JSON-массив — так читает сайт); превью thumbs/<id>_thumb.webp пересобирает API.
(function () {
const A = window.ADM, { $, $$, esc, money, toast, api, drawer, closeDrawer, ruD } = A;
const AMEN = { wifi: 'Wi-Fi', ac: 'Кондиционер', kitchen: 'Полная кухня', washer: 'Стиральная машина', tv: 'Smart TV', view: 'Панорамный вид', iron: 'Утюг', hairdryer: 'Фен', balcony: 'Балкон', parking: 'Парковка', elevator: 'Лифт', gym: 'Спортзал', pool: 'Бассейн', concierge: 'Консьерж', dishwasher: 'Посудомойка', workspace: 'Рабочее место' };
const COMPLEXES = ['Nest One', 'U-Tower', 'U-Tower 2', 'Kislorod', 'Mirabad', 'Gardens Residence', 'Modera Towers'];
const SB_PUB = 'https://sebvfvtofiysbywxjqut.supabase.co/storage/v1/object/public/apartments/';
let LIST = [], CX = '', ONLY = 'all', Q = '';

A.views.apartments = async function () {
  $('#main').innerHTML = `<div class="page"><h2>Квартиры <span class="n muted" id="ap_n"></span>
      <select id="ap_cx"><option value="">все ЖК</option>${COMPLEXES.map(c => `<option ${c === CX ? 'selected' : ''}>${c}</option>`).join('')}</select>
      <div class="seg" id="ap_only"><button data-o="all" class="on">все</button><button data-o="active">на сайте</button><button data-o="off">скрытые</button><button data-o="nophoto">без фото</button><button data-o="noinstr">без инструкции</button></div>
      <input id="ap_q" placeholder="поиск: номер, id, название" style="width:200px">
      <span class="sp"></span><button class="pri sm" id="ap_new">+ квартира</button></h2><div id="ap_body" class="empty">Загрузка…</div></div>`;
  $('#ap_cx').onchange = e => { CX = e.target.value; renderList(); };
  $$('#ap_only button').forEach(b => b.onclick = () => { ONLY = b.dataset.o; $$('#ap_only button').forEach(x => x.classList.toggle('on', x === b)); renderList(); });
  $('#ap_q').oninput = e => { Q = e.target.value.trim().toLowerCase(); renderList(); };
  $('#ap_new').onclick = () => openApt(null);
  await loadList();
  const m = location.hash.match(/^#apartments\/([a-z0-9_]+)/); if (m) openApt(m[1]);
};
async function loadList() { try { LIST = await api({ a: 'apt_list' }); renderList(); } catch (e) { $('#ap_body').innerHTML = '<div class="warn">' + esc(e.message) + '</div>'; } }
function renderList() {
  const rows = LIST.filter(a => (!CX || a.complex === CX) && (ONLY === 'all' || (ONLY === 'active' ? a.is_active : ONLY === 'off' ? !a.is_active : ONLY === 'nophoto' ? !a.photo_count : !a.has_instructions))
    && (!Q || (String(a.catalog_no || '') === Q || a.id.includes(Q) || String(a.name || '').toLowerCase().includes(Q))));
  $('#ap_n').textContent = rows.length + ' из ' + LIST.length + ' · на сайте ' + LIST.filter(a => a.is_active).length;
  const groups = {}; rows.forEach(a => { (groups[a.complex || '—'] = groups[a.complex || '—'] || []).push(a); });
  $('#ap_body').className = '';
  $('#ap_body').innerHTML = Object.keys(groups).sort((x, y) => COMPLEXES.indexOf(x) - COMPLEXES.indexOf(y)).map(cx => `<div class="card"><h3>${esc(cx)} <span class="n">${groups[cx].length} кв.</span></h3><div class="apgrid">` +
    groups[cx].map(a => `<div class="ap ${a.is_active ? '' : 'off'}" data-id="${a.id}">
      <div class="img" style="background-image:url('${esc(a.photos[0] ? SB_PUB + 'thumbs/' + a.id + '_thumb.webp' : '')}')">${a.catalog_no ? '<span class="no">№' + a.catalog_no + '</span>' : ''}${a.photo_count ? '<span class="ph">📷 ' + a.photo_count + '</span>' : '<span class="ph bad">нет фото</span>'}</div>
      <div class="b">${esc(a.name)} <span class="muted" style="font-weight:400">· ${a.floor || '?'} эт. · ${esc(a.rooms || '')}</span></div>
      <div class="s">${money(a.weekday_price)} / ${money(a.weekend_price)} · до ${a.max_guests || 2} гост.${a.term ? ' · <span class="muted">' + ({ sublease: 'субаренда', partner: 'партнёр', management: 'управление', own: 'своя' }[a.term.model] || a.term.model) + '</span>' : ''}</div>
      <div class="s">${a.is_active ? '<span class="tag" style="background:#e5f5ea;color:#1f6f3f">на сайте</span>' : '<span class="tag">скрыта</span>'}${a.tracked === false ? ' <span class="tag">RC партнёра</span>' : ''}${a.has_instructions ? '' : ' <span class="tag bad">нет инструкции</span>'}${!a.description_en ? ' <span class="tag">нет EN</span>' : ''}</div>
    </div>`).join('') + '</div></div>').join('') || '<div class="empty">ничего не найдено</div>';
  $$('#ap_body .ap').forEach(el => el.onclick = () => openApt(el.dataset.id));
}

// ---------- карточка ----------
let CUR = null, PHOTOS = [], TAB = 'card';
async function openApt(id) {
  if (!id) { CUR = { apartment: { id: '', name: '', complex: 'Nest One', floor: '', rooms: '', max_guests: 2, weekday_price: '', weekend_price: '', discount_week: 10, discount_month: 25, min_nights: 1, amenities: [], photos: [], is_active: false, tracked: true, description: '', description_en: '', description_uz: '', seasonal_prices: null }, instructions: null, terms: [], finance: [], expenses: [] }; }
  else { try { CUR = await api({ a: 'apt', id }); } catch (e) { toast(e.message); return; } history.replaceState(null, '', '#apartments/' + id); }
  PHOTOS = CUR.apartment.photos.slice(); TAB = 'card';
  renderDrawer();
}
const TABS = [['card', 'Карточка'], ['photos', 'Фото'], ['desc', 'Описание'], ['prices', 'Цены'], ['instr', 'Инструкция'], ['terms', 'Условия'], ['links', 'Ссылки']];
function renderDrawer() {
  const a = CUR.apartment, isNew = !a.id;
  const foot = isNew ? '' : `<a href="/apartments/${a.id}" target="_blank"><button class="sm">на сайте ↗</button></a><a href="/pms" target="_blank"><button class="sm">в PMS ↗</button></a>`;
  drawer((isNew ? 'Новая квартира' : esc(a.name) + ' · ' + esc(a.complex)), `<div class="seg" id="ap_tabs" style="margin-bottom:12px">${TABS.filter(t => !isNew || t[0] === 'card').map(t => `<button data-t="${t[0]}" class="${t[0] === TAB ? 'on' : ''}">${t[1]}</button>`).join('')}</div><div id="ap_tab"></div>`, foot);
  $$('#ap_tabs button').forEach(b => b.onclick = () => { TAB = b.dataset.t; $$('#ap_tabs button').forEach(x => x.classList.toggle('on', x === b)); renderTab(); });
  renderTab();
}
function renderTab() { (TABR[TAB] || TABR.card)(); }
const TABR = {};
const fld = (label, id, val, type, extra) => `<label${extra && extra.w ? ' class="w"' : ''}>${label}<input id="${id}" type="${type || 'text'}" value="${esc(val == null ? '' : val)}"${extra && extra.ph ? ' placeholder="' + esc(extra.ph) + '"' : ''}></label>`;

TABR.card = () => {
  const a = CUR.apartment, isNew = !a.id;
  $('#ap_tab').innerHTML = `<div class="f">
    ${isNew ? fld('id (латиницей, напр. nest_15)', 'c_id', a.id, 'text', { ph: 'nest_15' }) : '<label>id<input value="' + esc(a.id) + '" disabled></label>'}
    ${fld('Название', 'c_name', a.name, 'text', { ph: 'Апартамент 15' })}
    <label>ЖК<select id="c_cx">${COMPLEXES.map(c => `<option ${c === a.complex ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    ${fld('Этаж', 'c_floor', a.floor, 'number')}
    ${fld('Комнаты (напр. 2+1)', 'c_rooms', a.rooms)}
    ${fld('Макс. гостей', 'c_guests', a.max_guests, 'number')}
    ${fld('№ в каталоге TG', 'c_cat', a.catalog_no, 'number')}
    ${fld('Стиль / подзаголовок', 'c_style', a.style, 'text', { w: 1 })}
    <label class="w">Удобства<div style="display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:4px">${Object.entries(AMEN).map(([k, v]) => `<span><input type="checkbox" data-am="${k}" ${(a.amenities || []).includes(k) ? 'checked' : ''}> ${v}</span>`).join('')}</div></label>
    <label><span><input type="checkbox" id="c_active" ${a.is_active ? 'checked' : ''}> показывать на сайте</span></label>
    <label title="Снимите, если брони квартиры не попадают в нашу базу (RC партнёра) — тогда она не портит загрузку и RevPAR"><span><input type="checkbox" id="c_tracked" ${a.tracked !== false ? 'checked' : ''}> брони в нашей базе (для аналитики)</span></label>
  </div><div style="display:flex;gap:6px"><button class="pri" id="c_ok">Сохранить</button>${isNew ? '' : '<span class="muted" style="align-self:center;font-size:11px">обновлено ' + (a.updated_at ? ruD(a.updated_at.slice(0, 10)) + '.' + a.updated_at.slice(0, 4) : '—') + '</span>'}</div>`;
  $('#c_ok').onclick = () => save({ id: isNew ? $('#c_id').value.trim().toLowerCase() : a.id, name: $('#c_name').value.trim(), complex: $('#c_cx').value, floor: $('#c_floor').value, rooms: $('#c_rooms').value.trim(), max_guests: $('#c_guests').value, catalog_no: $('#c_cat').value || null, style: $('#c_style').value.trim(), amenities: $$('#ap_tab [data-am]:checked').map(x => x.dataset.am), is_active: $('#c_active').checked, tracked: $('#c_tracked').checked });
};
async function save(patch) {
  const a = CUR.apartment; if (!patch.name && !a.name) { toast('Название обязательно'); return; }
  try { const r = await api(null, { a: 'apt_save', apt: Object.assign({ id: a.id }, patch) }); toast(r.created ? 'Квартира создана — теперь фото и описание' : 'Сохранено'); await loadList(); CUR = await api({ a: 'apt', id: r.id }); PHOTOS = CUR.apartment.photos.slice(); if (r.created) { history.replaceState(null, '', '#apartments/' + r.id); renderDrawer(); } else renderTab(); } catch (e) { toast(e.message, 5000); }
}

TABR.photos = () => {
  const a = CUR.apartment;
  $('#ap_tab').innerHTML = `<div class="muted" style="font-size:11px;margin-bottom:8px">Первое фото — обложка на сайте и в каталоге. Перетаскивать не нужно: стрелки ← → меняют порядок, ★ делает обложкой. Оригиналы ≤ 20 МБ; превью 800px для карточек пересобирается само.</div>
    <div class="phgrid" id="ph_grid"></div>
    <div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input type="file" id="ph_file" accept="image/*" multiple><button class="sm pri" id="ph_up">Загрузить</button><span class="sp"></span><button class="sm" id="ph_save">Сохранить порядок</button><button class="sm" id="ph_thumb" title="Пересобрать превью 800px из обложки">⟳ превью</button></div><div id="ph_st" class="muted" style="font-size:11px;margin-top:6px"></div>`;
  drawGrid();
  $('#ph_up').onclick = upload;
  $('#ph_save').onclick = () => savePhotos(false);
  $('#ph_thumb').onclick = () => savePhotos(true);
};
function drawGrid() {
  $('#ph_grid').innerHTML = PHOTOS.map((u, i) => `<div class="phc ${i === 0 ? 'cover' : ''}"><img src="${esc(u.includes('/storage/v1/object/public/') ? 'https://images.weserv.nl/?url=' + encodeURIComponent(u.replace(/^https?:\/\//, '')) + '&w=300&h=220&fit=cover&output=webp' : u)}" loading="lazy"><div class="acts"><button data-l="${i}" title="левее">←</button><button data-r="${i}" title="правее">→</button><button data-c="${i}" title="обложка">★</button><button data-x="${i}" class="danger" title="удалить">✕</button></div>${i === 0 ? '<span class="cv">обложка</span>' : ''}</div>`).join('') || '<div class="empty">фото нет — загрузите ниже</div>';
  const mv = (i, j) => { if (j < 0 || j >= PHOTOS.length) return; const t = PHOTOS[i]; PHOTOS[i] = PHOTOS[j]; PHOTOS[j] = t; drawGrid(); };
  $$('#ph_grid [data-l]').forEach(b => b.onclick = () => mv(+b.dataset.l, +b.dataset.l - 1));
  $$('#ph_grid [data-r]').forEach(b => b.onclick = () => mv(+b.dataset.r, +b.dataset.r + 1));
  $$('#ph_grid [data-c]').forEach(b => b.onclick = () => { const u = PHOTOS.splice(+b.dataset.c, 1)[0]; PHOTOS.unshift(u); drawGrid(); });
  $$('#ph_grid [data-x]').forEach(b => b.onclick = () => { if (!confirm('Удалить фото? Файл удалится из хранилища после «Сохранить порядок».')) return; PHOTOS.splice(+b.dataset.x, 1); drawGrid(); });
}
async function upload() {
  const inp = $('#ph_file'), st = $('#ph_st'), id = CUR.apartment.id; if (!inp.files.length) { st.textContent = 'Выберите файлы'; return; }
  $('#ph_up').disabled = true; let n = 0;
  for (const f of inp.files) {
    if (f.size > 20 * 1024 * 1024) { st.textContent = f.name + ': больше 20 МБ, пропущено'; continue; }
    const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = id + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    st.textContent = 'Загружаю ' + (n + 1) + ' из ' + inp.files.length + '…';
    const { error } = await A.sb.storage.from('apartments').upload(path, f, { cacheControl: '3600', upsert: false, contentType: f.type || undefined });
    if (error) { st.textContent = 'Ошибка: ' + error.message; break; }
    PHOTOS.push(SB_PUB + path); n++;
  }
  $('#ph_up').disabled = false; inp.value = ''; drawGrid();
  if (n) { st.textContent = '✓ ' + n + ' фото загружено — сохраняю порядок…'; await savePhotos(false); }
}
async function savePhotos(forceThumb) {
  try { const r = await api(null, { a: 'apt_photos', id: CUR.apartment.id, photos: PHOTOS, force_thumb: !!forceThumb }); $('#ph_st').textContent = 'Сохранено · фото ' + r.photos.length + (r.deleted.length ? ' · удалено файлов ' + r.deleted.length : '') + (r.thumb && r.thumb.ok ? (r.thumb.skipped ? '' : ' · превью обновлено') : ' · превью не обновилось' + (r.thumb && r.thumb.reason ? ': ' + r.thumb.reason : '')); CUR.apartment.photos = r.photos.slice(); toast('Фото сохранены'); loadList(); } catch (e) { toast(e.message, 5000); }
}

TABR.desc = () => {
  const a = CUR.apartment; const vm = String(a.description || '').match(/\[VIDEO:(.*?)\]/); const desc = String(a.description || '').replace(/\[VIDEO:.*?\]/g, '').trim();
  $('#ap_tab').innerHTML = `<div class="f"><label class="w">Описание (RU)<textarea id="d_ru" rows="7">${esc(desc)}</textarea></label><label class="w">Description (EN)<textarea id="d_en" rows="6">${esc(a.description_en || '')}</textarea></label><label class="w">Tavsif (UZ)<textarea id="d_uz" rows="6">${esc(a.description_uz || '')}</textarea></label>${fld('Видео (ссылка на mp4 / YouTube) — показывается в карточке на сайте', 'd_video', vm ? vm[1] : '', 'text', { w: 1 })}</div><button class="pri" id="d_ok">Сохранить</button>`;
  $('#d_ok').onclick = () => { const v = $('#d_video').value.trim(); save({ description: $('#d_ru').value.trim() + (v ? '\n[VIDEO:' + v + ']' : ''), description_en: $('#d_en').value.trim(), description_uz: $('#d_uz').value.trim() }); };
};

TABR.prices = () => {
  const a = CUR.apartment, s = a.seasonal_prices || {};
  const months = (sel) => Array.from({ length: 12 }, (_, i) => `<span><input type="checkbox" data-m="${i + 1}" ${(sel || []).includes(i + 1) ? 'checked' : ''}> ${A.MN[i]}</span>`).join(' ');
  $('#ap_tab').innerHTML = `<div class="muted" style="font-size:11px;margin-bottom:8px">Это цены <b>сайта</b> (urbanluxe.cc и модуль брони). Цены для площадок и шахматки считает PMS (правила и ручные правки по дням) — <a href="/pms#rules" target="_blank">открыть</a>.</div><div class="f">
    ${fld('Будни (Пн–Чт), $/ночь', 'p_wd', a.weekday_price, 'number')}${fld('Выходные (Пт–Вс), $/ночь', 'p_we', a.weekend_price, 'number')}
    ${fld('Скидка от 7 ночей, %', 'p_dw', a.discount_week, 'number')}${fld('Скидка от 30 ночей, %', 'p_dm', a.discount_month, 'number')}
    ${fld('Минимум ночей', 'p_min', a.min_nights, 'number')}<label></label>
    <label class="w">Высокий сезон — месяцы<div style="display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:4px" id="p_hi">${months(s.high && s.high.months)}</div></label>${fld('Множитель высокого сезона (1.2 = +20 %)', 'p_him', s.high ? s.high.multiplier : '', 'number')}
    <label class="w">Низкий сезон — месяцы<div style="display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:4px" id="p_lo">${months(s.low && s.low.months)}</div></label>${fld('Множитель низкого сезона (0.85 = −15 %)', 'p_lom', s.low ? s.low.multiplier : '', 'number')}
  </div><button class="pri" id="p_ok">Сохранить</button>`;
  $('#p_ok').onclick = () => { const hi = $$('#p_hi [data-m]:checked').map(x => +x.dataset.m), lo = $$('#p_lo [data-m]:checked').map(x => +x.dataset.m); const sp = {}; if (hi.length) sp.high = { months: hi, multiplier: +$('#p_him').value || 1.2 }; if (lo.length) sp.low = { months: lo, multiplier: +$('#p_lom').value || 0.85 };
    save({ weekday_price: $('#p_wd').value, weekend_price: $('#p_we').value, discount_week: $('#p_dw').value, discount_month: $('#p_dm').value, min_nights: $('#p_min').value, seasonal_prices: Object.keys(sp).length ? sp : null }); };
};

TABR.instr = () => {
  const c = CUR.instructions || {};
  $('#ap_tab').innerHTML = `<div class="muted" style="font-size:11px;margin-bottom:8px">Гость видит инструкцию в личном кабинете после подтверждения брони (адрес, код, парковка, Wi-Fi, правила). Без EN/UZ показывается русская.</div><div class="f"><label class="w">RU<textarea id="i_ru" rows="9">${esc(c.content_ru || '')}</textarea></label><label class="w">EN<textarea id="i_en" rows="7">${esc(c.content_en || '')}</textarea></label><label class="w">UZ<textarea id="i_uz" rows="7">${esc(c.content_uz || '')}</textarea></label></div><button class="pri" id="i_ok">Сохранить</button> <span class="muted" style="font-size:11px">${c.updated_at ? 'обновлено ' + ruD(c.updated_at.slice(0, 10)) + '.' + c.updated_at.slice(0, 4) : 'инструкции ещё нет'}</span>`;
  $('#i_ok').onclick = async () => { try { await api(null, { a: 'checkin_save', apartment_id: CUR.apartment.id, content_ru: $('#i_ru').value, content_en: $('#i_en').value, content_uz: $('#i_uz').value }); toast('Инструкция сохранена'); CUR.instructions = { content_ru: $('#i_ru').value, content_en: $('#i_en').value, content_uz: $('#i_uz').value, updated_at: new Date().toISOString() }; loadList(); } catch (e) { toast(e.message, 5000); } };
};

TABR.terms = () => {
  const MODEL = { sublease: 'субаренда', partner: 'партнёр', management: 'управление', own: 'своя' };
  $('#ap_tab').innerHTML = `<div class="sec">Условия (аренда, модель, партнёр)<span class="sp"></span><button class="sm" id="t_new">+ условия</button></div>
    <table class="t">${CUR.terms.map(t => `<tr><td>${ruD(t.valid_from)}.${t.valid_from.slice(0, 4)}${t.valid_to ? ' – ' + ruD(t.valid_to) + '.' + t.valid_to.slice(0, 4) : ''}</td><td>${MODEL[t.model] || t.model}</td><td class="num">${money(t.rent)}</td><td>${t.partners ? esc(t.partners.name) + ' ' + (t.partner_share || 50) + '%' : ''}</td><td>${t.lease_end ? 'договор до ' + ruD(t.lease_end) + '.' + t.lease_end.slice(0, 4) : ''}</td><td><button class="sm" data-t="${t.id}">✎</button></td></tr>`).join('') || '<tr><td class="muted">условий нет</td></tr>'}</table>
    <div class="sec">Выручка по месяцам (таблица / вручную)</div><table class="t">${CUR.finance.map(f => `<tr><td>${A.ruMonth(f.month.slice(0, 7))}</td><td><span class="tag">${f.source}</span></td><td class="num">${money(f.revenue)}</td><td class="num muted">аренда ${money(f.rent)}</td><td class="num">${f.nights} н.</td><td class="num ${f.profit < 0 ? 'down' : 'up'}">${money(f.profit)}</td></tr>`).join('') || '<tr><td class="muted">записей нет</td></tr>'}</table>
    <div class="sec">Расходы по квартире</div><table class="t">${CUR.expenses.slice(0, 15).map(e => `<tr><td class="nowrap">${ruD(e.expense_date)}</td><td>${esc(e.category)}</td><td>${esc(e.description || '')}</td><td class="num">${money(e.amount)}</td></tr>`).join('') || '<tr><td class="muted">расходов нет</td></tr>'}</table>`;
  const open = (tid) => { if (!A.openTerm) { toast('Откройте Финансы → Аренда → условия'); return; } A.openTerm(CUR.apartment.id, tid, CUR.terms, async () => { CUR = await api({ a: 'apt', id: CUR.apartment.id }); renderDrawer(); }); };
  $('#t_new').onclick = () => open(null);
  $$('#ap_tab [data-t]').forEach(b => b.onclick = () => open(b.dataset.t));
};

TABR.links = () => {
  const a = CUR.apartment;
  $('#ap_tab').innerHTML = `<div class="f">${fld('iCal экспорт RealtyCalendar (занятость → сайт/бот)', 'l_exp', a.ical_export_url, 'text', { w: 1 })}${fld('iCal импорт (ссылка площадки, если нужна)', 'l_imp', a.ical_import_url, 'text', { w: 1 })}</div>
    <div class="sec">Наши ссылки</div><table class="t">
    <tr><td>Страница на сайте</td><td><a href="/apartments/${a.id}" target="_blank">urbanluxe.cc/apartments/${a.id}</a></td></tr>
    <tr><td>Наш iCal (брони сайта/PMS → RC и площадки)</td><td><a href="/.netlify/functions/calendar?apt=${a.id}" target="_blank">urbanluxe.cc/.netlify/functions/calendar?apt=${a.id}</a></td></tr>
    <tr><td>Превью для карточек</td><td><a href="${SB_PUB}thumbs/${a.id}_thumb.webp" target="_blank">thumbs/${a.id}_thumb.webp</a></td></tr>
    <tr><td>Каналы продаж</td><td><a href="/pms#channels" target="_blank">PMS → Каналы</a></td></tr></table>
    <div style="margin-top:10px"><button class="pri" id="l_ok">Сохранить ссылки</button></div>`;
  $('#l_ok').onclick = () => save({ ical_export_url: $('#l_exp').value.trim(), ical_import_url: $('#l_imp').value.trim() });
};
})();
