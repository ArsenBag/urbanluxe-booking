/* Urban Luxe — tg-attribution.js (15.09.2026)
   Зачем: сделки закрываются в Telegram, а откуда пришёл гость — неизвестно.
   Что делает: в каждую ссылку на менеджера (t.me/Arsen_bnb) подставляет черновик
   первого сообщения с меткой источника и контекстом (квартира, даты):
     «Здравствуйте! Пишу с сайта urbanluxe.cc — интересует Nest One 325 на 20–22 сентября. #сайт #meta»
   Гость просто нажимает «Отправить». В Telegram считаем по поиску: #сайт (все), #meta, #direct, #google.
   Канал @UrbanLuxehotel не трогаем. Подключение — в index.html и в layout apt-page.js:
     <script src="/tg-attribution.js" defer></script>
   Ничего в index.html не переписывает: только слушает клики (capture) и меняет href перед переходом. */
(function () {
  'use strict';

  var MANAGER = /t\.me\/Arsen_bnb/i;      // ссылки, куда добавляем черновик
  var KEY = 'ul_src';                        // localStorage: источник визита (7 дней)
  var TTL = 7 * 24 * 3600 * 1000;

  // --- 1) Запоминаем источник (utm / referrer) ---
  function detectSource() {
    try {
      var q = new URLSearchParams(location.search);
      var s = (q.get('utm_source') || '').toLowerCase();
      var m = (q.get('utm_medium') || '').toLowerCase();
      if (!s) {
        if (q.get('fbclid')) s = 'meta';
        else if (q.get('yclid')) s = 'yandex';
        else if (q.get('gclid')) s = 'google';
      }
      var ref = (document.referrer || '').toLowerCase();
      if (!s && ref) {
        if (/instagram|facebook|fb\.com|l\.instagram/.test(ref)) s = 'instagram';
        else if (/yandex/.test(ref)) s = 'yandex-org';
        else if (/google/.test(ref)) s = 'google-org';
        else if (/t\.me|telegram/.test(ref)) s = 'telegram';
      }
      if (s) localStorage.setItem(KEY, JSON.stringify({ s: s, m: m, c: q.get('utm_campaign') || '', t: Date.now() }));
    } catch (e) {}
  }
  function getSource() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v && Date.now() - v.t < TTL) return v;
    } catch (e) {}
    return null;
  }
  function tag(v) {
    if (!v) return '#прямой';
    var s = v.s;
    if (/meta|facebook|instagram|fb/.test(s)) return /cpc|paid|ads/.test(v.m) || s === 'meta' || s === 'facebook' ? '#meta' : '#instagram';
    if (/yandex|direct/.test(s)) return /org/.test(s) ? '#яндекс' : '#direct';
    if (/google/.test(s)) return /org/.test(s) ? '#google' : '#gads';
    if (/telegram/.test(s)) return '#tg';
    return '#' + s.replace(/[^a-z0-9а-я_]/gi, '').slice(0, 20);
  }
  detectSource();

  // --- 2) Контекст: квартира и даты ---
  var COMPLEX = { nest: 'Nest One', utower: 'U-Tower', utower2: 'U-Tower', kislorod: 'Kislorod', gardens: 'Gardens Residence', modera: 'Modera Towers', mirabad: 'Mirabad Avenue' };
  function aptLabel(id) {
    var m = String(id || '').match(/^([a-z]+2?)_(\d+)/i);
    if (!m) return '';
    return (COMPLEX[m[1].toLowerCase()] || m[1]) + ' ' + m[2];
  }
  function currentApt() {
    // SSR-страница /apartments/<id>
    var p = location.pathname.match(/^\/apartments\/([a-z0-9_]+)/i);
    if (p) return aptLabel(p[1]);
    // Модалка на главной — как в analytics.js: id из src картинки
    var img = document.querySelector('#modalContent img, .modal img');
    if (img && img.src) { var mm = img.src.match(/\/apartments\/([^\/]+)\//); if (mm && mm[1] && mm[1] !== 'hero') return aptLabel(mm[1]); }
    // Deep-link /?book=<id>
    var b = new URLSearchParams(location.search).get('book');
    if (b) return aptLabel(b);
    return '';
  }
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function fmt(d) { var m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? (parseInt(m[3], 10) + ' ' + MONTHS[parseInt(m[2], 10) - 1]) : ''; }
  function currentDates() {
    var ins = Array.prototype.slice.call(document.querySelectorAll('input[type="date"]')).filter(function (i) { return i.value; });
    if (ins.length >= 2 && ins[0].value < ins[1].value) {
      var a = fmt(ins[0].value), b = fmt(ins[1].value);
      if (a && b) return a.split(' ')[1] === b.split(' ')[1] ? a.split(' ')[0] + '–' + b : a + ' – ' + b;
    }
    var q = new URLSearchParams(location.search);
    if (q.get('check_in') && q.get('check_out')) return fmt(q.get('check_in')) + ' – ' + fmt(q.get('check_out'));
    return '';
  }

  // --- 3) Текст черновика ---
  function draft() {
    var apt = currentApt(), dates = currentDates();
    var t = 'Здравствуйте! Пишу с сайта urbanluxe.cc';
    if (apt || dates) t += ' — интересует ' + (apt || 'апартамент') + (dates ? ' на ' + dates : '');
    t += '. #сайт ' + tag(getSource());
    return t;
  }
  function withText(href) {
    try {
      var u = new URL(href, location.href);
      if (u.searchParams.get('text')) return href; // уже есть черновик
      // encodeURIComponent (пробел = %20), а не URLSearchParams ('+'): Telegram '+' не всегда разбирает как пробел
      u.search = (u.search ? u.search + '&' : '?') + 'text=' + encodeURIComponent(draft());
      return u.toString();
    } catch (e) { return href; }
  }

  // --- 4) Подмена href перед переходом (capture — раньше обработчиков сайта) ---
  document.addEventListener('click', function (e) {
    if (!e.target || !e.target.closest) return;
    var a = e.target.closest('a[href]');
    if (!a || !MANAGER.test(a.href)) return;
    a.href = withText(a.href);
  }, true);

  // Ссылки, открываемые через window.open (например, FAB) — оборачиваем
  if (window.open && !window.open.__ulTg) {
    var oo = window.open;
    window.open = function (url) {
      try { if (typeof url === 'string' && MANAGER.test(url)) arguments[0] = withText(url); } catch (e) {}
      return oo.apply(window, arguments);
    };
    window.open.__ulTg = true;
  }

  window.__ulTgDraft = draft; // для проверки в консоли
})();
