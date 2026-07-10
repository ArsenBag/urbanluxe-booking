/* Urban Luxe — booking-v2.js: пошаговое бронирование (3 шага) поверх существующей модалки.
   Ничего в index.html не переписываем: модуль перестраивает DOM модалки после openModal.
   Шаг 1: даты + доступность + цена. Шаг 2: контакты (всегда видимы, даже для залогиненных).
   Шаг 3: сводка + способ оплаты (QR / при заселении) + подтверждение.
   Бонус: клик по фото карточки открывает модалку квартиры.
   Оплата по QR: положи файл public/pay-qr.png — опция появится автоматически.
   Подключение в index.html (после i18n-extra.js):
     <script src="/booking-v2.js" defer></script> */
(function () {
  'use strict';

  // ---------- i18n ----------
  var L = {
    ru: { step: 'Шаг', of: 'из', s1: 'Даты и гости', s2: 'Контакты', s3: 'Подтверждение',
      next: 'Далее', back: 'Назад', confirm: 'Подтвердить бронь',
      needDates: 'Выберите даты заезда и выезда', needContact: 'Укажите имя и телефон',
      summary: 'Ваша бронь', nights: 'ночей', guests: 'гостей', total: 'Итого',
      payTitle: 'Оплата', payQr: 'Оплатить по QR', payQrHint: 'любое банковское приложение',
      payLater: 'Оплата при заселении', payLaterHint: 'наличные или карта, подходит иностранным гостям',
      qrTitle: 'Отсканируйте QR для оплаты', qrHint: 'Сумма к оплате', qrDone: 'После оплаты мы подтвердим бронь и пришлём инструкцию по заселению.',
      verify: 'Проверьте контактные данные — по ним мы подтвердим бронь' },
    en: { step: 'Step', of: 'of', s1: 'Dates & guests', s2: 'Contacts', s3: 'Confirmation',
      next: 'Next', back: 'Back', confirm: 'Confirm booking',
      needDates: 'Select check-in and check-out dates', needContact: 'Enter your name and phone',
      summary: 'Your booking', nights: 'nights', guests: 'guests', total: 'Total',
      payTitle: 'Payment', payQr: 'Pay by QR', payQrHint: 'any banking app',
      payLater: 'Pay at check-in', payLaterHint: 'cash or card, best for foreign guests',
      qrTitle: 'Scan the QR to pay', qrHint: 'Amount due', qrDone: 'After payment we confirm your booking and send check-in instructions.',
      verify: 'Check your contact details — we use them to confirm the booking' },
    uz: { step: 'Qadam', of: '/', s1: 'Sanalar va mehmonlar', s2: 'Kontaktlar', s3: 'Tasdiqlash',
      next: 'Keyingi', back: 'Orqaga', confirm: 'Bronni tasdiqlash',
      needDates: 'Kirish va chiqish sanalarini tanlang', needContact: 'Ism va telefon raqamini kiriting',
      summary: 'Sizning broningiz', nights: 'kecha', guests: 'mehmon', total: 'Jami',
      payTitle: "To'lov", payQr: "QR orqali to'lash", payQrHint: 'istalgan bank ilovasi',
      payLater: "Joylashishda to'lash", payLaterHint: 'naqd yoki karta, chet ellik mehmonlar uchun qulay',
      qrTitle: "To'lov uchun QR ni skanerlang", qrHint: "To'lov summasi", qrDone: "To'lovdan so'ng bronni tasdiqlaymiz va joylashish bo'yicha ko'rsatma yuboramiz.",
      verify: "Kontakt ma'lumotlarini tekshiring — bron shu orqali tasdiqlanadi" }
  };
  function lang() {
    var l = (document.documentElement.lang || 'ru').slice(0, 2).toLowerCase();
    return L[l] || L.ru;
  }

  // ---------- QR availability ----------
  var QR_SRC = '/pay-qr.png', qrOk = null;
  (function () {
    var im = new Image();
    im.onload = function () { qrOk = true; };
    im.onerror = function () { qrOk = false; };
    im.src = QR_SRC;
  })();

  // ---------- CSS ----------
  var css = document.createElement('style');
  css.textContent =
    '.ulv2-head{display:flex;justify-content:space-between;align-items:center;margin:0 0 14px}' +
    '.ulv2-title{font-size:12px;letter-spacing:.08em;color:#c9a96e;text-transform:uppercase}' +
    '.ulv2-dots{display:flex;gap:6px}.ulv2-dot{width:8px;height:8px;border-radius:50%;background:#3a3a3a;transition:background .2s}' +
    '.ulv2-dot.on{background:#c9a96e}' +
    '.ulv2-step{display:none}.ulv2-step.on{display:block;animation:ulv2f .25s ease}' +
    '@keyframes ulv2f{from{opacity:0;transform:translateX(8px)}to{opacity:1;transform:none}}' +
    '.ulv2-nav{display:flex;gap:10px;margin-top:16px}' +
    '.ulv2-btn{flex:1;min-height:48px;border-radius:10px;border:0;cursor:pointer;font-size:15px;font-weight:600;font-family:inherit}' +
    '.ulv2-btn.gold{background:#c9a96e;color:#241d10;flex:2}.ulv2-btn.gold:active{transform:scale(.98)}' +
    '.ulv2-btn.ghost{background:transparent;border:1px solid #4a4a4a;color:#cfcabd}' +
    '.ulv2-err{color:#e88;font-size:13px;margin-top:8px;min-height:16px}' +
    '.ulv2-note{background:rgba(201,169,110,.1);border:1px solid rgba(201,169,110,.35);border-radius:9px;padding:8px 12px;font-size:12px;color:#c9a96e;margin:0 0 12px}' +
    '.ulv2-sum{background:rgba(255,255,255,.04);border-radius:12px;padding:14px;margin:0 0 14px;font-size:14px}' +
    '.ulv2-sum-row{display:flex;justify-content:space-between;margin:4px 0;color:#cfcabd}' +
    '.ulv2-sum-total{border-top:1px solid rgba(255,255,255,.12);margin-top:8px;padding-top:8px;font-size:16px}' +
    '.ulv2-sum-total b{color:#c9a96e;font-weight:600}' +
    '.ulv2-pay{display:grid;gap:8px;margin:0 0 14px}' +
    '.ulv2-pay label{display:flex;justify-content:space-between;align-items:center;gap:10px;border:1px solid #3a3a3a;border-radius:10px;padding:12px 14px;cursor:pointer;font-size:14px;color:#e8e4dc}' +
    '.ulv2-pay label.on{border-color:#c9a96e}.ulv2-pay small{color:#8a857a;font-size:11px}' +
    '.ulv2-pay input{accent-color:#c9a96e}' +
    '.ulv2-qr{text-align:center;padding:14px;background:#fff;border-radius:12px;margin:12px auto;max-width:240px}' +
    '.ulv2-qr img{width:100%;display:block}' +
    '#ulv2 input,#ulv2 select{font-size:16px}' +
    '@media(max-width:640px){.ulv2-btn{min-height:52px}}';
  document.head.appendChild(css);

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function commonBox(a, b) {
    var p = a.parentElement;
    while (p && !p.contains(b)) p = p.parentElement;
    return p;
  }

  var state = { step: 1, pay: 'qr' };

  function goto(n) {
    state.step = n;
    var t = lang();
    var box = $('ulv2'); if (!box) return;
    box.querySelectorAll('.ulv2-step').forEach(function (el, i) { el.classList.toggle('on', i === n - 1); });
    box.querySelectorAll('.ulv2-dot').forEach(function (el, i) { el.classList.toggle('on', i < n); });
    $('ulv2-t').textContent = t.step + ' ' + n + ' ' + t.of + ' 3 · ' + t['s' + n];
    $('ulv2-back').style.display = n === 1 ? 'none' : '';
    $('ulv2-next').style.display = n === 3 ? 'none' : '';
    $('ulv2-err').textContent = '';
    if (n === 3) buildSummary();
    var sc = box.closest('#modalContent') || box;
    try { box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
  }

  function buildSummary() {
    var t = lang();
    var ci = ($('modalCheckIn') || {}).value || '', co = ($('modalCheckOut') || {}).value || '';
    var total = ($('modalTotalPrice') || {}).textContent || '';
    var nightsLbl = ($('modalNightsLabel') || {}).textContent || '';
    var gc = ($('modalGuestsCount') || {}).value || '';
    var name = ($('modalGuestName') || {}).value || '';
    var phone = ($('modalGuestPhone') || {}).value || '';
    $('ulv2-sum').innerHTML =
      '<div style="color:#fff;margin-bottom:6px">' + esc(t.summary) + '</div>' +
      '<div class="ulv2-sum-row"><span>' + esc(ci) + ' → ' + esc(co) + '</span><span>' + esc(nightsLbl) + '</span></div>' +
      '<div class="ulv2-sum-row"><span>' + esc(name) + ' · ' + esc(phone) + '</span><span>' + esc(gc) + ' ' + esc(t.guests) + '</span></div>' +
      '<div class="ulv2-sum-row ulv2-sum-total"><span>' + esc(t.total) + '</span><b>' + esc(total) + '</b></div>';
    var payBox = $('ulv2-pay');
    if (qrOk === false) { payBox.style.display = 'none'; state.pay = 'later'; }
  }

  function validate(n) {
    var t = lang();
    if (n === 1) {
      if (!(($('modalCheckIn') || {}).value) || !(($('modalCheckOut') || {}).value)) return t.needDates;
    }
    if (n === 2) {
      var nm = ($('modalGuestName') || {}).value || '', ph = ($('modalGuestPhone') || {}).value || '';
      if (!nm.trim() || !ph.trim()) return t.needContact;
    }
    return '';
  }

  // ---------- rebuild modal into steps ----------
  function initV2() {
    if ($('ulv2')) return true;
    var btn = $('modalBookBtn'), ciEl = $('modalCheckIn'), gf = $('modalGuestFields');
    if (!btn || !ciEl || !gf) return false;
    var t = lang();
    var sidebar = commonBox(ciEl, btn);
    if (!sidebar) return false;

    var wrap = document.createElement('div'); wrap.id = 'ulv2';
    wrap.innerHTML =
      '<div class="ulv2-head"><span class="ulv2-title" id="ulv2-t"></span>' +
      '<span class="ulv2-dots"><span class="ulv2-dot"></span><span class="ulv2-dot"></span><span class="ulv2-dot"></span></span></div>' +
      '<div class="ulv2-step" id="ulv2-s1"></div>' +
      '<div class="ulv2-step" id="ulv2-s2"></div>' +
      '<div class="ulv2-step" id="ulv2-s3"><div class="ulv2-sum" id="ulv2-sum"></div>' +
      '<div class="ulv2-pay" id="ulv2-pay">' +
      '<label class="on"><span>' + esc(t.payQr) + '<br><small>' + esc(t.payQrHint) + '</small></span><input type="radio" name="ulv2pay" value="qr" checked></label>' +
      '<label><span>' + esc(t.payLater) + '<br><small>' + esc(t.payLaterHint) + '</small></span><input type="radio" name="ulv2pay" value="later"></label>' +
      '</div><div id="ulv2-s3btn"></div></div>' +
      '<div class="ulv2-err" id="ulv2-err"></div>' +
      '<div class="ulv2-nav"><button type="button" class="ulv2-btn ghost" id="ulv2-back"></button>' +
      '<button type="button" class="ulv2-btn gold" id="ulv2-next"></button></div>';

    sidebar.appendChild(wrap);

    // Шаг 1: даты + цена + календарь доступности
    var s1 = $('ulv2-s1');
    var datesRow = commonBox(ciEl, $('modalCheckOut'));
    if (datesRow && datesRow !== sidebar) s1.appendChild(datesRow);
    else { s1.appendChild(ciEl); s1.appendChild($('modalCheckOut')); }
    if ($('modalPriceCalc')) s1.appendChild($('modalPriceCalc'));
    if ($('modalAvailCal')) s1.appendChild($('modalAvailCal'));

    // Шаг 2: контакты — показываем всегда (даже залогиненным), чтобы не было брони одним кликом
    var s2 = $('ulv2-s2');
    var note = document.createElement('div'); note.className = 'ulv2-note'; note.textContent = t.verify;
    s2.appendChild(note);
    gf.style.display = '';
    s2.appendChild(gf);
    if ($('modalForOtherWrap')) s2.appendChild($('modalForOtherWrap'));

    // Шаг 3: кнопка бронирования + статус
    $('ulv2-s3btn').appendChild(btn);
    btn.style.width = '100%'; btn.style.minHeight = '48px';
    if ($('modalBookStatus')) $('ulv2-s3btn').appendChild($('modalBookStatus'));

    // Прочее в сайдбаре (старый заголовок цены и т.п.) не трогаем — остаётся сверху.

    // Навигация
    $('ulv2-back').textContent = t.back;
    $('ulv2-next').textContent = t.next;
    $('ulv2-back').onclick = function () { if (state.step > 1) goto(state.step - 1); };
    $('ulv2-next').onclick = function () {
      var err = validate(state.step);
      if (err) { $('ulv2-err').textContent = err; return; }
      goto(state.step + 1);
    };
    wrap.querySelectorAll('input[name=ulv2pay]').forEach(function (r) {
      r.addEventListener('change', function () {
        state.pay = r.value;
        wrap.querySelectorAll('.ulv2-pay label').forEach(function (lb) { lb.classList.toggle('on', lb.contains(r)); });
      });
    });

    // Способ оплаты — в notes (сервер book.js менять не нужно)
    btn.addEventListener('click', function () {
      var notes = $('modalGuestNotes');
      if (notes && !/\[pay:/.test(notes.value)) {
        notes.value = (notes.value ? notes.value + ' ' : '') + '[pay:' + (state.pay === 'qr' ? 'QR' : 'checkin') + ']';
      }
      if (state.pay === 'qr') watchSuccess();
    }, true);

    state.step = 1; state.pay = qrOk === false ? 'later' : 'qr';
    goto(1);
    return true;
  }

  // После успешной заявки показываем QR с суммой
  function watchSuccess() {
    var total = ($('modalTotalPrice') || {}).textContent || '';
    var tries = 0, t = lang();
    var iv = setInterval(function () {
      var mc = $('modalContent');
      if (!mc) { clearInterval(iv); return; }
      var txt = mc.textContent || '';
      if (/UL-[A-Z0-9]{4,}/.test(txt) && !$('ulv2-qrblock') && qrOk) {
        clearInterval(iv);
        var host = mc.querySelector('h2,h3') || mc.firstElementChild;
        var d = document.createElement('div'); d.id = 'ulv2-qrblock';
        d.innerHTML = '<p style="text-align:center;color:#c9a96e;margin:14px 0 0;font-size:15px">' + esc(t.qrTitle) + '</p>' +
          '<div class="ulv2-qr"><img src="' + QR_SRC + '" alt="QR"></div>' +
          '<p style="text-align:center;color:#cfcabd;margin:0;font-size:14px">' + esc(t.qrHint) + ': <b style="color:#c9a96e">' + esc(total) + '</b></p>' +
          '<p style="text-align:center;color:#8a857a;font-size:12px;margin:6px 0 0">' + esc(t.qrDone) + '</p>';
        (host && host.parentElement ? host.parentElement : mc).appendChild(d);
      }
      if (++tries > 120) clearInterval(iv);
    }, 500);
  }

  // ---------- hook openModal ----------
  function hookOpen() {
    if (typeof window.openModal !== 'function' || window.openModal.__ulv2) return false;
    var orig = window.openModal;
    window.openModal = function () {
      var r = orig.apply(this, arguments);
      var tries = 0;
      var iv = setInterval(function () { if (initV2() || ++tries > 25) clearInterval(iv); }, 200);
      return r;
    };
    window.openModal.__ulv2 = true;
    return true;
  }
  if (!hookOpen()) {
    var ht = 0, hiv = setInterval(function () { if (hookOpen() || ++ht > 40) clearInterval(hiv); }, 250);
  }

  // ---------- бонус: клик по фото карточки открывает квартиру ----------
  document.addEventListener('click', function (e) {
    var img = e.target && e.target.tagName === 'IMG' ? e.target : null;
    if (!img || !img.src) return;
    if (img.closest('#modalContent') || img.closest('#modalOverlay')) return;
    var m = img.src.match(/\/apartments\/([^\/]+)\//);
    if (!m || m[1] === 'hero') return;
    if (!img.closest('[class*=card],[class*=apt],[class*=grid]')) return;
    e.preventDefault(); e.stopPropagation();
    if (typeof window.openModal === 'function') window.openModal(m[1]);
  }, true);
})();
