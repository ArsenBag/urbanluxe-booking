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
      calHint: 'Или нажмите на свободную (зелёную) дату в календаре: первый тап — заезд, второй — выезд',
      eName: 'Укажите имя', ePhone: 'Укажите телефон (минимум 9 цифр)', eEmail: 'Укажите корректный email — на него придёт подтверждение',
      eCitizen: 'Выберите гражданство', eTime: 'Укажите время заезда',
      openBrowser: 'Вы в браузере Instagram — для надёжного бронирования откройте сайт в обычном браузере (⋯ в углу → «Открыть в браузере»)', copyLink: 'Скопировать ссылку', copied: 'Ссылка скопирована ✓',
      accMade: '👤 Мы создали вам личный кабинет — на почту отправлена ссылка для установки пароля. Внутри: ваша бронь, отмена и инструкция по заселению.',
      accExists: '👤 У вас уже есть личный кабинет — войдите, там появится эта бронь.',
      summary: 'Ваша бронь', nights: 'ночей', guests: 'гостей', total: 'Итого',
      payTitle: 'Оплата', payQr: 'Оплатить по QR', payQrHint: 'любое банковское приложение',
      payLater: 'Оплата при заселении', payLaterHint: 'наличные или карта, подходит иностранным гостям',
      qrTitle: 'Отсканируйте QR для оплаты', qrHint: 'Сумма к оплате', qrDone: 'После оплаты мы подтвердим бронь и пришлём инструкцию по заселению.',
      verify: 'Проверьте контактные данные — по ним мы подтвердим бронь' },
    en: { step: 'Step', of: 'of', s1: 'Dates & guests', s2: 'Contacts', s3: 'Confirmation',
      next: 'Next', back: 'Back', confirm: 'Confirm booking',
      needDates: 'Select check-in and check-out dates', needContact: 'Enter your name and phone',
      calHint: 'Or tap a free (green) date in the calendar: first tap — check-in, second — check-out',
      eName: 'Enter your name', ePhone: 'Enter phone (min 9 digits)', eEmail: 'Enter a valid email — confirmation goes there',
      eCitizen: 'Select citizenship', eTime: 'Enter arrival time',
      openBrowser: 'You are in the Instagram browser — for reliable booking open the site in a regular browser (⋯ menu → "Open in browser")', copyLink: 'Copy link', copied: 'Link copied ✓',
      accMade: '👤 We created your personal account — a password link was sent to your email. Inside: your booking, cancellation and check-in instructions.',
      accExists: '👤 You already have an account — sign in to see this booking.',
      summary: 'Your booking', nights: 'nights', guests: 'guests', total: 'Total',
      payTitle: 'Payment', payQr: 'Pay by QR', payQrHint: 'any banking app',
      payLater: 'Pay at check-in', payLaterHint: 'cash or card, best for foreign guests',
      qrTitle: 'Scan the QR to pay', qrHint: 'Amount due', qrDone: 'After payment we confirm your booking and send check-in instructions.',
      verify: 'Check your contact details — we use them to confirm the booking' },
    uz: { step: 'Qadam', of: '/', s1: 'Sanalar va mehmonlar', s2: 'Kontaktlar', s3: 'Tasdiqlash',
      next: 'Keyingi', back: 'Orqaga', confirm: 'Bronni tasdiqlash',
      needDates: 'Kirish va chiqish sanalarini tanlang', needContact: 'Ism va telefon raqamini kiriting',
      calHint: "Yoki kalendardagi bo'sh (yashil) sanani bosing: birinchi bosish — kirish, ikkinchisi — chiqish",
      eName: 'Ismingizni kiriting', ePhone: 'Telefon kiriting (kamida 9 raqam)', eEmail: "To'g'ri email kiriting — tasdiq shu manzilga boradi",
      eCitizen: 'Fuqarolikni tanlang', eTime: 'Kelish vaqtini kiriting',
      openBrowser: "Siz Instagram brauzeridasiz — ishonchli bron uchun saytni oddiy brauzerda oching (⋯ menyu → «Brauzerda ochish»)", copyLink: 'Havolani nusxalash', copied: 'Nusxalandi ✓',
      accMade: "👤 Sizga shaxsiy kabinet yaratdik — parol o'rnatish havolasi emailga yuborildi. Ichida: broningiz, bekor qilish va joylashish ko'rsatmasi.",
      accExists: "👤 Sizda kabinet bor — kiring, bron o'sha yerda ko'rinadi.",
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
    '#ulv2-s1 input.flatpickr-input,#ulv2-s1 input.flatpickr-mobile{background:rgba(255,255,255,.05) !important;border:1px solid rgba(201,169,110,.55) !important;border-radius:10px !important;padding:12px 14px !important;color:#e8e4dc !important;min-height:48px;box-sizing:border-box;width:100%}' +
    '#ulv2-s1 input.flatpickr-input:focus,#ulv2-s1 input.flatpickr-mobile:focus{border-color:#c9a96e !important;box-shadow:0 0 0 2px rgba(201,169,110,.25)}' +
    '.ulv2-calhint{font-size:12px;color:#8a857a;margin:8px 0 4px;text-align:center}' +
    '#modalAvailCal div[data-ul-free]{cursor:pointer}' +
    '.ulv2-iab{background:rgba(232,163,61,.12);border:1px solid rgba(232,163,61,.5);border-radius:10px;padding:10px 12px;font-size:12.5px;color:#e8a33d;margin:0 0 12px;line-height:1.5}' +
    '.ulv2-iab button{margin-top:8px;background:#e8a33d;color:#241d10;border:0;border-radius:8px;padding:8px 14px;font-size:12.5px;font-weight:700;cursor:pointer}' +
    '@media(max-width:640px){' +
      '.ulv2-btn{min-height:52px}' +
      '#modalGuestFields input,#modalGuestFields select{width:100% !important;box-sizing:border-box;display:block;margin:0 0 10px !important;min-height:48px;padding:12px 14px !important;border-radius:10px}' +
      '#modalGuestFields{display:block !important}' +
      '#ulv2 .ulv2-nav{position:sticky;bottom:0;background:linear-gradient(transparent,#14100c 30%);padding:10px 0 4px;z-index:5}' +
      '#modalCheckIn,#modalCheckOut{min-height:48px;box-sizing:border-box}' +
      '.ulv2-pay label{padding:14px}' +
      '#modalAvailCal{overflow-x:auto}' +
    '}';
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

  // Встроенные браузеры Instagram/Facebook: урезанные localStorage/куки ломают бронь.
  function inAppBrowser() {
    var ua = navigator.userAgent || '';
    return /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|TikTok/i.test(ua);
  }
  function storageOk() {
    try { localStorage.setItem('__ul_t', '1'); localStorage.removeItem('__ul_t'); return true; }
    catch (e) { return false; }
  }
  function iabBanner() {
    if (!inAppBrowser() && storageOk()) return null;
    var t = lang();
    var d = document.createElement('div');
    d.className = 'ulv2-iab';
    d.innerHTML = esc(t.openBrowser) + '<br><button type="button">' + esc(t.copyLink) + '</button>';
    d.querySelector('button').onclick = function (e) {
      e.stopPropagation();
      var url = location.origin + location.pathname + (location.search || '');
      var done = function () { d.querySelector('button').textContent = t.copied; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { prompt('URL:', url); });
      else prompt('URL:', url);
    };
    return d;
  }

  // Свой supabase-клиент только для чтения сессии (общий localStorage с клиентом сайта)
  var SB_URL = 'https://sebvfvtofiysbywxjqut.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI';
  var sbc = null;
  function sb() {
    try {
      if (!sbc && window.supabase && window.supabase.createClient) sbc = window.supabase.createClient(SB_URL, SB_KEY);
    } catch (e) { /* вебвью без storage — работаем без клиента */ }
    return sbc;
  }
  function prefillContacts() {
    var c = sb(); if (!c) return;
    c.auth.getUser().then(function (r) {
      var u = r && r.data && r.data.user; if (!u) return;
      var md = u.user_metadata || {};
      var nm = $('modalGuestName'), ph = $('modalGuestPhone'), em = $('modalGuestEmail');
      if (nm && !nm.value && md.name) nm.value = md.name;
      if (ph && !ph.value && (md.phone || u.phone)) ph.value = md.phone || u.phone;
      if (em && !em.value && u.email) em.value = u.email;
    }).catch(function () {});
  }

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
    clearInterval(state.gfiv);
    if (n === 2) {
      // checkModalAuth прячет контакты у залогиненных — принудительно показываем и заполняем
      var showGf = function () {
        var gf = $('modalGuestFields');
        if (gf && gf.offsetParent === null) gf.style.setProperty('display', 'block', 'important');
      };
      showGf(); prefillContacts();
      state.gfiv = setInterval(function () { if (state.step === 2) showGf(); else clearInterval(state.gfiv); }, 400);
    }
    if (n === 3) buildSummary();
    var sc = box.closest('#modalContent') || box;
    try { box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
  }

  function buildSummary() {
    var t = lang();
    var ci = ($('modalCheckIn') || {}).value || '', co = ($('modalCheckOut') || {}).value || '';
    var total = ($('modalTotalPrice') || {}).textContent || '';
    function pd(s) { var p = s.split('.'); return p.length === 3 ? new Date(p[2], p[1] - 1, p[0]) : new Date(s); }
    var nn = Math.round((pd(co) - pd(ci)) / 86400000);
    var nightsLbl = (nn > 0 ? nn + ' ' + t.nights : '');
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

  function markBad(el, bad) {
    if (!el) return;
    el.style.border = bad ? '1px solid #e5534b' : '';
    if (bad && !el.__badHook) {
      el.__badHook = true;
      el.addEventListener('input', function () { el.style.border = ''; });
      el.addEventListener('change', function () { el.style.border = ''; });
    }
  }
  function validate(n) {
    var t = lang();
    if (n === 1) {
      if (!(($('modalCheckIn') || {}).value) || !(($('modalCheckOut') || {}).value)) return t.needDates;
    }
    if (n === 2) {
      var bad = [];
      var nm = $('modalGuestName'), ph = $('modalGuestPhone'), em = $('modalGuestEmail'),
          cz = $('modalCitizenship'), nt = $('modalGuestNotes');
      if (!nm || nm.value.trim().length < 2) bad.push([nm, t.eName]);
      var digits = (ph && ph.value || '').replace(/\D/g, '');
      if (digits.length < 9) bad.push([ph, t.ePhone]);
      if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em.value.trim())) bad.push([em, t.eEmail]);
      if (cz && !cz.value) bad.push([cz, t.eCitizen]);
      if (nt && !nt.value.trim()) bad.push([nt, t.eTime]);
      var fo = $('modalForOther');
      if (fo && fo.checked) {
        var on = $('modalOtherName'), op = $('modalOtherPhone');
        if (on && on.value.trim().length < 2) bad.push([on, t.eName]);
        if (op && (op.value || '').replace(/\D/g, '').length < 9) bad.push([op, t.ePhone]);
      }
      [nm, ph, em, cz, nt].forEach(function (el) { markBad(el, false); });
      if (bad.length) {
        bad.forEach(function (b) { markBad(b[0], true); });
        try { bad[0][0].scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
        return bad[0][1];
      }
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
    var iab = iabBanner();
    if (iab) s1.appendChild(iab);
    var datesRow = commonBox(ciEl, $('modalCheckOut'));
    if (datesRow && datesRow !== sidebar) s1.appendChild(datesRow);
    else { s1.appendChild(ciEl); s1.appendChild($('modalCheckOut')); }
    if ($('modalPriceCalc')) s1.appendChild($('modalPriceCalc'));
    if ($('modalAvailCal')) {
      var hint = document.createElement('div');
      hint.className = 'ulv2-calhint'; hint.textContent = t.calHint;
      s1.appendChild(hint);
      s1.appendChild($('modalAvailCal'));
      calClicks();
    }
    setTimeout(fixModalPickers, 300);
    setTimeout(fixModalPickers, 1200);

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
      var contact = {
        email: (($('modalGuestEmail') || {}).value || '').trim(),
        name: (($('modalGuestName') || {}).value || '').trim(),
        phone: (($('modalGuestPhone') || {}).value || '').trim()
      };
      watchSuccess(contact);
    }, true);

    state.step = 1; state.pay = qrOk === false ? 'later' : 'qr';
    goto(1);
    return true;
  }

  // flatpickr в модалке создан с minDate: new Date() (с текущим временем) —
  // на телефоне нативный пикер возвращает дату 00:00, setDate() её отбрасывает.
  // Обнуляем время в minDate.
  function fixModalPickers() {
    ['modalCheckIn', 'modalCheckOut'].forEach(function (id) {
      var el = $(id), fp = el && el._flatpickr;
      if (!fp || !fp.config.minDate) return;
      var d = fp.config.minDate;
      if (d.getHours() || d.getMinutes() || d.getSeconds()) {
        var z = new Date(d); z.setHours(0, 0, 0, 0);
        fp.config.minDate = z;
        if (fp.mobileInput) { try { fp.mobileInput.min = fp.formatDate(z, 'Y-m-d'); } catch (e) {} }
      }
    });
  }

  // Выбор дат тапом по календарю доступности: зелёная ячейка = свободно.
  // Первый тап — заезд, второй (позже заезда) — выезд.
  var CAL_MONTHS = {
    'янв': 0, 'фев': 1, 'мар': 2, 'апр': 3, 'май': 4, 'мая': 4, 'июн': 5, 'июл': 6, 'авг': 7, 'сен': 8, 'окт': 9, 'ноя': 10, 'дек': 11,
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5, 'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11,
    'yan': 0, 'fev': 1, 'iyn': 5, 'iyl': 6, 'avg': 7, 'sen': 8, 'okt': 9, 'noy': 10, 'dek': 11
  };
  function calHeadDate(cal) {
    var head = cal.querySelector('div');
    var m = ((head && head.textContent) || '').trim().toLowerCase().match(/([a-zа-яё']+)[.\s]+(\d{4})/);
    if (!m) return null;
    var mo = CAL_MONTHS[m[1].slice(0, 3)];
    return mo === undefined ? null : { mo: mo, yr: +m[2] };
  }
  function calMark(cal) {
    var h = calHeadDate(cal); if (!h) return;
    var fi = $('modalCheckIn'), fo = $('modalCheckOut');
    var a = fi && fi._flatpickr && fi._flatpickr.selectedDates[0];
    var b = fo && fo._flatpickr && fo._flatpickr.selectedDates[0];
    cal.querySelectorAll('div').forEach(function (c) {
      var tx = (c.textContent || '').trim();
      if (!/^\d{1,2}$/.test(tx) || c.children.length) return;
      var st = c.getAttribute('style') || '';
      if (st.indexOf('46,204,113') > -1) c.setAttribute('data-ul-free', '1');
      var d = new Date(h.yr, h.mo, +tx).getTime();
      var sel = a && ((b && d >= a.getTime() && d <= b.getTime()) || (!b && d === a.getTime()));
      c.style.outline = sel ? '2px solid #c9a96e' : '';
      c.style.outlineOffset = sel ? '-2px' : '';
    });
  }
  function calClicks() {
    var cal = $('modalAvailCal');
    if (!cal || cal.dataset.ulClick) return;
    cal.dataset.ulClick = '1';
    calMark(cal);
    var mo = new MutationObserver(function () { calMark(cal); });
    mo.observe(cal, { childList: true, subtree: true });
    cal.addEventListener('click', function (e) {
      var cell = e.target;
      var tx = (cell.textContent || '').trim();
      if (!/^\d{1,2}$/.test(tx) || cell.children.length) return;
      var st = cell.getAttribute('style') || '';
      if (st.indexOf('46,204,113') === -1) return; // только свободные
      var h = calHeadDate(cal); if (!h) return;
      var d = new Date(h.yr, h.mo, +tx);
      var fi = $('modalCheckIn'), fo = $('modalCheckOut');
      var fpi = fi && fi._flatpickr, fpo = fo && fo._flatpickr;
      if (!fpi || !fpo) return;
      fixModalPickers();
      var ci = fpi.selectedDates[0];
      if (!ci || fpo.selectedDates[0] || d <= ci) {
        fpi.setDate(d, true); fpo.clear();
      } else {
        fpo.setDate(d, true);
      }
      calMark(cal);
    });
  }

  // После успешной заявки: QR с суммой (если выбран) + авто-создание кабинета
  function watchSuccess(contact) {
    var total = ($('modalTotalPrice') || {}).textContent || '';
    var tries = 0, t = lang();
    var iv = setInterval(function () {
      var mc = $('modalContent');
      if (!mc) { clearInterval(iv); return; }
      var txt = mc.textContent || '';
      if (!/UL-[A-Z0-9]{4,}/.test(txt)) { if (++tries > 120) clearInterval(iv); return; }
      clearInterval(iv);
      var host = mc.querySelector('h2,h3') || mc.firstElementChild;
      var parent = host && host.parentElement ? host.parentElement : mc;
      if (state.pay === 'qr' && qrOk && !$('ulv2-qrblock')) {
        var d = document.createElement('div'); d.id = 'ulv2-qrblock';
        d.innerHTML = '<p style="text-align:center;color:#c9a96e;margin:14px 0 0;font-size:15px">' + esc(t.qrTitle) + '</p>' +
          '<div class="ulv2-qr"><img src="' + QR_SRC + '" alt="QR"></div>' +
          '<p style="text-align:center;color:#cfcabd;margin:0;font-size:14px">' + esc(t.qrHint) + ': <b style="color:#c9a96e">' + esc(total) + '</b></p>' +
          '<p style="text-align:center;color:#8a857a;font-size:12px;margin:6px 0 0">' + esc(t.qrDone) + '</p>';
        parent.appendChild(d);
      }
      autoAccount(contact, parent, t);
    }, 500);
  }

  // Гость бронирует без регистрации; кабинет создаём автоматически по email
  function autoAccount(contact, parent, t) {
    if (!contact || !contact.email || $('ulv2-accblock')) return;
    var c = sb(); if (!c) return;
    function show(msg) {
      var d = document.createElement('div'); d.id = 'ulv2-accblock';
      d.style.cssText = 'background:rgba(201,169,110,.1);border:1px solid rgba(201,169,110,.4);border-radius:10px;padding:12px 14px;font-size:13px;color:#c9a96e;margin:14px auto 0;max-width:420px;line-height:1.55';
      d.textContent = msg;
      parent.appendChild(d);
    }
    c.auth.getSession().then(function (r) {
      if (r.data && r.data.session) return; // уже в кабинете
      var rndPass = 'UL!' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6).toUpperCase();
      c.auth.signUp({ email: contact.email, password: rndPass, options: { data: { name: contact.name, phone: contact.phone } } })
        .then(function (res) {
          if (res.error) {
            if (/already|registered|exists/i.test(res.error.message)) show(t.accExists);
            return;
          }
          // письмо для установки пароля (наш password-reset flow)
          c.auth.resetPasswordForEmail(contact.email, { redirectTo: location.origin + '/?pwreset=1' })
            .then(function () { show(t.accMade); }, function () { show(t.accMade); });
        }, function () {});
    }).catch(function () {});
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

  // ---------- deep-link /?book=<apartment_id> (из кабинета «Забронировать снова») ----------
  (function () {
    var m = location.search.match(/[?&]book=([^&]+)/);
    if (!m) return;
    var id = decodeURIComponent(m[1]), n = 0;
    var iv = setInterval(function () {
      if (typeof window.openModal === 'function' && document.readyState === 'complete') {
        clearInterval(iv);
        setTimeout(function () {
          window.openModal(id);
          history.replaceState(null, '', location.pathname);
        }, 600);
      } else if (++n > 50) clearInterval(iv);
    }, 250);
  })();

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
