/**
 * Urban Luxe — «Лист бронера» ↔ бот бронеров / база. Двусторонняя синхронизация листа «Лист2». 09.10.2026
 *
 * Установка (один раз): в таблице «Лист бронера» → Расширения → Apps Script → удалить всё, вставить этот файл,
 * Ctrl+S → вверху выбрать функцию `setup` → ▶ Запустить → разрешить доступ. Готово: лист «Лист2» синхронизируется
 * каждые 5 минут и при каждой правке. Ключ уже внутри файла, ничего вводить не нужно.
 *
 * Колонки остались вашими (A–U). Добавлены справа: V «Дата» и W «ID» (служебные, серые). «Квартира», «Статус», «Бронер»,
 * «Дата», «ID», «Уборка» (статус из бота горничных) — только чтение. Новая строка: написать квартиру в A («U 171», «N 481», «K 31», «MA 111») — строка
 * создастся в базе на сегодня и получит ID. Статус считается сам: Заезд / Живёт / Бронь / Выехал.
 */
var API = 'https://urbanluxe.cc/.netlify/functions/sheet-sync';
var KEY = 'av-VWisFMYlW4hKOPigHtqIz';
var SHEET = 'Лист2';
var COLS = [ // [заголовок, поле базы | null, тип]
  ['Квартира', 'apt', 'ro'], ['Статус', 'status', 'ro'], ['Владелец', 'source', 'list:Telegram,WhatsApp,Сайт,Instagram,Airbnb,Booking,Продление,Другое'], ['Гость', 'guest_name', 'text'],
  ['Заезд', 'checkin_time', 'text'], ['Выезд', 'checkout_time', 'text'], ['Кол-во гостей', 'guests', 'num'],
  ['Паспорт', 'passport', 'check'], ['Доступ', 'access', 'check'], ['Заехал', 'checked_in', 'check'], ['Рег нужна', 'registration', 'list:Да,Нет'], ['Рег отправ', 'reg_sent', 'check'],
  ['Ут.заезд', 'confirm_checkin', 'check'], ['Ут.выезд', 'confirm_checkout', 'check'], ['Оплачено $', 'payment_paid', 'num'], ['Нужно оплатить $', 'payment_total', 'num'],
  ['Депозит получен', 'deposit_received', 'check'], ['Депозит Возвращен', 'deposit_returned', 'check'], ['Отзыв', 'review', 'check'], ['Заметка', 'note', 'text'], ['Бронер', 'updated_by', 'ro'],
  ['Дата', 'date', 'ro'], ['ID', 'id', 'ro'], ['Уборка', 'cleaning', 'ro']
];
var COL = {}; COLS.forEach(function (c, i) { COL[c[1]] = i + 1; });

function onOpen() { SpreadsheetApp.getUi().createMenu('Urban Luxe').addItem('Обновить сейчас', 'pullAll').addItem('Включить автосинхронизацию', 'setup').addItem('Проверить связь', 'pullWeek').addToUi(); }
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('pullAll').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('onEditSync').forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('IMPORTED')) { importExisting(); props.setProperty('IMPORTED', '1'); }
  pullAll(); onOpen();
  SpreadsheetApp.getActive().toast('Синхронизация включена: каждые 5 минут + при правке');
}
function sheet_() { var sh = SpreadsheetApp.getActive().getSheetByName(SHEET); if (!sh) throw new Error('Нет листа ' + SHEET); return sh; }
function fmt_(d) { return Utilities.formatDate(d, 'Asia/Tashkent', 'yyyy-MM-dd'); }
function who_() { return (Session.getActiveUser().getEmail() || 'google').split('@')[0]; }

/** Разовый импорт того, что уже заполнено в листе (на сегодня), в базу — чтобы ничего не потерять при первом обновлении. */
function importExisting() {
  var sh = sheet_(); var n = sh.getLastRow() - 1; if (n < 1) return;
  var vals = sh.getRange(2, 1, n, 21).getValues(); var rows = [];
  vals.forEach(function (v) {
    if (!v[0]) return; var f = {};
    COLS.forEach(function (c, i) { if (i < 21 && c[2] !== 'ro' && v[i] !== '' && v[i] !== null) f[c[1]] = v[i] instanceof Date ? Utilities.formatDate(v[i], 'Asia/Tashkent', 'HH:mm') : v[i]; });
    rows.push({ apt: String(v[0]).trim(), fields: f });
  });
  if (!rows.length) return;
  var r = post_({ key: KEY, op: 'import', date: fmt_(new Date()), who: who_(), rows: rows });
  var bad = (r.result || []).filter(function (x) { return x.error; });
  SpreadsheetApp.getActive().toast('Импортировано строк: ' + rows.length + (bad.length ? ' · ошибки: ' + bad.map(function (x) { return x.apt + ' — ' + x.error; }).join('; ') : ''));
}

/** База → лист: три блока — ЗАЕЗДЫ сегодня, ВЫЕЗДЫ сегодня, ЗАЕЗДЫ завтра. */
function pullWeek() { pull(); }
function pull() {
  var res = UrlFetchApp.fetch(API + '?key=' + encodeURIComponent(KEY) + '&view=day', { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) { SpreadsheetApp.getActive().toast('Ошибка API: ' + res.getContentText().slice(0, 120)); return; }
  var data = JSON.parse(res.getContentText());
  var sh = sheet_(); var lock = LockService.getScriptLock(); lock.tryLock(10000);
  try {
    PropertiesService.getScriptProperties().setProperty('PULLING', '1');
    if (sh.getMaxColumns() < COLS.length) sh.insertColumnsAfter(sh.getMaxColumns(), COLS.length - sh.getMaxColumns());
    var need = 2 + data.sections.reduce(function (a, s) { return a + s.rows.length + 3; }, 0) + 5; if (sh.getMaxRows() < need) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows());
    sh.getRange(1, 1, 1, COLS.length).setValues([COLS.map(function (c) { return c[0]; })]).setFontWeight('bold');
    var n = sh.getLastRow() - 1; if (n > 0) { var all = sh.getRange(2, 1, n, COLS.length); all.clearContent().clearDataValidations().setBackground(null).setFontColor(null).setFontWeight('normal'); all.breakApart(); }
    var r = 2;
    data.sections.forEach(function (sec) {
      var bg = sec.kind === 'out' ? '#fde2d4' : (sec.date === data.today ? '#fff3c4' : '#e3f0ff');
      sh.getRange(r, 1, 1, COLS.length).merge().setValue(sec.title + ' · ' + sec.rows.length).setFontWeight('bold').setBackground('#1f1f1f').setFontColor('#c9a45c');
      sh.getRange(r, COL.date).setValue(sec.date); // дата блока (для новых строк)
      r++;
      if (sec.rows.length) {
        var values = sec.rows.map(function (x) { return COLS.map(function (c) { var v = x[c[1]]; if (c[2] === 'check') return !!v; return v === null || v === undefined ? '' : v; }); });
        sh.getRange(r, 1, values.length, COLS.length).setValues(values);
        COLS.forEach(function (c, i) {
          var rng = sh.getRange(r, i + 1, values.length, 1);
          if (c[2] === 'check') rng.insertCheckboxes();
          else if (c[2].indexOf('list:') === 0) rng.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(c[2].slice(5).split(','), true).setAllowInvalid(true).build());
          if (c[2] === 'ro') rng.setBackground('#f3f3f3').setFontColor('#555');
        });
        sec.rows.forEach(function (x, i) { sh.getRange(r + i, 1, 1, 2).setBackground(bg); if (x.payment_total !== '' && Number(x.payment_paid || 0) < Number(x.payment_total)) sh.getRange(r + i, COL.payment_total).setFontColor('#c0392b'); });
        r += values.length;
      }
      r += 2; // две пустые строки под блоком — для ручного добавления
    });
    sh.getRange(1, 1).setNote('Обновлено из базы: ' + Utilities.formatDate(new Date(), 'Asia/Tashkent', 'dd.MM HH:mm') + '. Новую строку пишите в пустую строку под нужным блоком: квартира в колонке A.');
  } finally { PropertiesService.getScriptProperties().deleteProperty('PULLING'); lock.releaseLock(); }
}

/** Лист → база (установленный триггер onEdit). */
function onEditSync(e) {
  try {
    if (!e || !e.range) return; var sh = e.range.getSheet(); if (sh.getName() === BSHEET) { onEditBookings(e); return; } if (sh.getName() !== SHEET) return;
    if (PropertiesService.getScriptProperties().getProperty('PULLING')) return;
    var row = e.range.getRow(), col = e.range.getColumn(); if (row < 2) return;
    var c = COLS[col - 1]; if (!c) return;
    var a1 = String(sh.getRange(row, 1).getValue()); if (a1.indexOf('ЗАЕЗДЫ') === 0 || a1.indexOf('ВЫЕЗДЫ') === 0) return; // заголовок блока
    var id = sh.getRange(row, COL.id).getValue();
    if (!id) { // новая строка: квартира в A
      var apt = sh.getRange(row, 1).getValue(); if (!apt) return;
      var d = fmt_(new Date()); for (var rr = row - 1; rr >= 2; rr--) { var t = String(sh.getRange(rr, 1).getValue()); if (t.indexOf('ЗАЕЗДЫ') === 0 || t.indexOf('ВЫЕЗДЫ') === 0) { var dv = sh.getRange(rr, COL.date).getValue(); if (dv) d = (dv instanceof Date ? fmt_(dv) : String(dv)); break; } }
      var r = post_({ key: KEY, op: 'add', date: d, apt: String(apt), who: who_() });
      if (!r.ok) { sh.getRange(row, COL.id).setValue('ОШИБКА: ' + (r.error || '')); return; }
      sh.getRange(row, COL.id).setValue(r.id); sh.getRange(row, 1).setValue(r.apt); sh.getRange(row, COL.date).setValue(r.date); sh.getRange(row, 2).setValue(r.date === fmt_(new Date()) ? 'Заезд' : 'Бронь');
      id = r.id; if (col === 1) return;
    }
    if (String(id).indexOf('ОШИБКА') === 0 || c[2] === 'ro') return;
    var v = e.range.getValue(); if (v instanceof Date) v = Utilities.formatDate(v, 'Asia/Tashkent', 'HH:mm');
    var res = post_({ key: KEY, op: 'update', id: String(id), field: c[1], value: v, who: who_() });
    if (!res.ok) e.range.setNote('Не сохранено: ' + (res.error || '')); else { e.range.clearNote(); sh.getRange(row, COL.updated_by).setValue(who_()); }
  } catch (err) { try { e.range.setNote('Ошибка синхронизации: ' + err); } catch (_) {} }
}
function post_(payload) {
  var res = UrlFetchApp.fetch(API, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true });
  try { return JSON.parse(res.getContentText()); } catch (_) { return { ok: false, error: 'HTTP ' + res.getResponseCode() }; }
}

/* ================= ЛИСТ «Брони»: новые брони на будущее + ближайшие 30 дней ================= */
var BSHEET = 'Брони';
var BCOLS = ['Квартира', 'Заезд', 'Выезд', 'Гость', 'Телефон / @', 'Гостей', 'Сумма $', 'Предоплата $', 'Канал', 'Время заезда', 'Заметка', 'Результат', 'ID'];
var BLIST = ['Квартира', 'Заезд', 'Выезд', 'Ночей', 'Гость', 'Телефон / @', 'Гостей', 'Сумма', 'Оплачено', 'Остаток', 'Канал', 'Время заезда', 'Заметка', 'Статус', 'Кто создал', 'ID'];
var BFORM_ROWS = 8; // строк для ввода новых броней
function pullAll() { pull(); try { pullBookings(); } catch (e) { SpreadsheetApp.getActive().toast('Брони: ' + e); } }
function bsheet_() {
  var ss = SpreadsheetApp.getActive(); var sh = ss.getSheetByName(BSHEET);
  if (!sh) { sh = ss.insertSheet(BSHEET); sh.setFrozenRows(2); }
  if (sh.getMaxColumns() < BLIST.length) sh.insertColumnsAfter(sh.getMaxColumns(), BLIST.length - sh.getMaxColumns());
  return sh;
}
/** Верх листа: форма новой брони (8 строк). Ниже: список броней на 30 дней вперёд (только чтение). */
function pullBookings() {
  var res = UrlFetchApp.fetch(API + '?key=' + encodeURIComponent(KEY) + '&view=upcoming', { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error(res.getContentText().slice(0, 100));
  var rows = JSON.parse(res.getContentText()).rows; var sh = bsheet_();
  var lock = LockService.getScriptLock(); lock.tryLock(10000);
  try {
    PropertiesService.getScriptProperties().setProperty('PULLING', '1');
    var formTop = 2, listTitle = formTop + BFORM_ROWS + 1, listHead = listTitle + 1, listTop = listHead + 1;
    var need = listTop + rows.length + 3; if (sh.getMaxRows() < need) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows());
    // заголовок формы
    sh.getRange(1, 1, 1, BLIST.length).breakApart(); sh.getRange(1, 1, 1, BCOLS.length).merge().setValue('➕ НОВАЯ БРОНЬ — заполните квартиру, заезд, выезд, гостя (остальное по желанию). Бронь создаётся сама, результат — в колонке «Результат». Даты: 25.10 или 2026-10-25').setFontWeight('bold').setBackground('#1f1f1f').setFontColor('#c9a45c');
    sh.getRange(formTop, 1, 1, BCOLS.length).setValues([BCOLS]).setFontWeight('bold').setBackground('#fff3c4');
    // сохраняем незавершённые строки формы (без ID/результата), чистим завершённые
    var form = sh.getRange(formTop + 1, 1, BFORM_ROWS, BCOLS.length).getValues();
    var keep = form.filter(function (r) { return r[0] && !r[12]; }).slice(0, BFORM_ROWS);
    var blank = []; for (var i = 0; i < BFORM_ROWS; i++) blank.push(keep[i] || BCOLS.map(function () { return ''; }));
    sh.getRange(formTop + 1, 1, BFORM_ROWS, BCOLS.length).clearDataValidations().setValues(blank).setBackground('#fffdf3');
    sh.getRange(formTop + 1, 9, BFORM_ROWS, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Telegram', 'WhatsApp', 'Сайт', 'Instagram', 'Airbnb', 'Booking', 'Ostrovok', 'Яндекс', 'Корпоратив', 'Другое'], true).setAllowInvalid(true).build());
    if (data.apts && data.apts.length) sh.getRange(formTop + 1, 1, BFORM_ROWS, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(data.apts, true).setAllowInvalid(false).setHelpText('Выберите квартиру из списка').build());
    sh.getRange(formTop + 1, 2, BFORM_ROWS, 2).setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(true).setHelpText('Дата: 25.10.2026').build()).setNumberFormat('dd.MM.yyyy');
    sh.getRange(formTop + 1, 12, BFORM_ROWS, 2).setBackground('#f3f3f3').setFontColor('#555');
    // список
    var n = sh.getMaxRows() - listTitle + 1; sh.getRange(listTitle, 1, n, BLIST.length).clearContent().clearDataValidations().setBackground(null).setFontColor(null).setFontWeight('normal').breakApart();
    sh.getRange(listTitle, 1, 1, BLIST.length).merge().setValue('БРОНИ НА 30 ДНЕЙ ВПЕРЁД · ' + rows.length + ' (только чтение; правки — в шахматке admin3 или боте)').setFontWeight('bold').setBackground('#1f1f1f').setFontColor('#c9a45c');
    sh.getRange(listHead, 1, 1, BLIST.length).setValues([BLIST]).setFontWeight('bold').setBackground('#e3f0ff');
    if (rows.length) {
      var vals = rows.map(function (b) { return [b.apt, b.check_in, b.check_out, b.nights, b.guest_name, b.guest_phone, b.guests, b.total, b.paid, b.debt, b.channel, b.arrival_time, b.note, b.status, b.created_by, b.id]; });
      sh.getRange(listTop, 1, vals.length, BLIST.length).setValues(vals).setBackground('#f8f8f8');
      vals.forEach(function (v, i) { if (v[9] > 0) sh.getRange(listTop + i, 10).setFontColor('#c0392b'); });
    }
    BLIST.forEach(function (_, i) { sh.setColumnWidth(i + 1, [90, 90, 90, 55, 160, 130, 60, 75, 80, 80, 95, 90, 220, 100, 110, 110][i] || 100); });
  } finally { PropertiesService.getScriptProperties().deleteProperty('PULLING'); lock.releaseLock(); }
}
/** Правка в форме «Брони»: когда заполнены квартира, заезд, выезд и гость — создаём бронь. */
function onEditBookings(e) {
  var sh = e.range.getSheet(); var row = e.range.getRow(); if (row < 3 || row > 2 + BFORM_ROWS) return;
  if (PropertiesService.getScriptProperties().getProperty('PULLING')) return;
  var v = sh.getRange(row, 1, 1, BCOLS.length).getValues()[0];
  if (v[12] || !v[0] || !v[1] || !v[2] || !v[3]) return; // уже создана или не всё заполнено
  var fd = function (x) { return x instanceof Date ? Utilities.formatDate(x, 'Asia/Tashkent', 'yyyy-MM-dd') : String(x); };
  sh.getRange(row, 12).setValue('⏳ создаю…');
  var r = post_({ key: KEY, op: 'book', apt: String(v[0]), check_in: fd(v[1]), check_out: fd(v[2]), guest_name: v[3], guest_phone: v[4], guests: v[5], total: v[6], prepaid: v[7], channel: v[8], arrival_time: v[9] instanceof Date ? Utilities.formatDate(v[9], 'Asia/Tashkent', 'HH:mm') : v[9], note: v[10], who: who_() });
  if (r.ok) { sh.getRange(row, 12).setValue('✓ ' + r.apt + ' ' + r.check_in + '→' + r.check_out + ' · $' + r.total); sh.getRange(row, 13).setValue(r.id); sh.getRange(row, 7).setValue(r.total); }
  else sh.getRange(row, 12).setValue('✗ ' + (r.error || 'ошибка'));
}
