/* Urban Luxe — ui-fixes.js: мелкие UX-фиксы главной страницы.
   1) Плавающие чипы телефонов (перекрывали карточки каталога) → компактная
      круглая кнопка 📞, раскрывается по клику/наведению.
   2) Страховка i18n: если при переключении языка в меню мигает сырой ключ
      NAV_MAP — заменяем переводом.
   3) Скорость: фото грузились ОРИГИНАЛАМИ из Storage (2–11 МБ каждое, hero 11 МБ,
      33 карточки — десятки МБ). Подменяем src на резайзер images.weserv.nl
      (WebP, карточки 640px / модалка 1280px / hero 1600px) — тот же приём,
      что для og:image. Оригиналы в Storage не трогаем.
   Подключение в index.html:
     <script src="/ui-fixes.js" defer></script> */
(function () {
  'use strict';

  // ---------- 0. Лёгкие фото через weserv ----------
  var STOR = '/storage/v1/object/public/apartments/';
  function resized(src, w) {
    var clean = src.replace(/^https?:\/\//, '');
    return 'https://images.weserv.nl/?url=ssl:' + encodeURIComponent(clean) + '&w=' + w + '&q=75&output=webp';
  }
  function optimizeImg(img) {
    var src = img.getAttribute('src') || '';
    if (src.indexOf(STOR) < 0 || src.indexOf('weserv') > -1) return;
    var inModal = !!img.closest('#modalContent, #modalOverlay');
    var isHero = src.indexOf('/hero/') > -1;
    var w = isHero ? 1600 : inModal ? 1280 : 640;
    if (!img.getAttribute('loading') && !isHero) img.setAttribute('loading', 'lazy');
    // Страховка: если резайзер недоступен (CSP/сеть) — возвращаем оригинал
    img.onerror = function () { img.onerror = null; img.src = src; };
    img.src = resized(src, w);
  }
  function optimizeAll() { [].forEach.call(document.querySelectorAll('img[src*="' + STOR + '"]'), optimizeImg); }
  var mo = new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      [].forEach.call(m.addedNodes || [], function (n) {
        if (n.nodeType !== 1) return;
        if (n.tagName === 'IMG') optimizeImg(n);
        else if (n.querySelectorAll) [].forEach.call(n.querySelectorAll('img'), optimizeImg);
      });
      if (m.type === 'attributes' && m.target.tagName === 'IMG') optimizeImg(m.target);
    });
  });
  function startImgOpt() {
    optimizeAll();
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startImgOpt); else startImgOpt();

  // ---------- 1. Телефонные чипы → FAB ----------
  function fixPhones() {
    if (document.getElementById('ul-phone-fab')) return true;
    var box = [].find.call(document.querySelectorAll('div'), function (e) {
      if (e.children.length < 1 || e.children.length > 3) return false;
      var s = getComputedStyle(e);
      if (s.position !== 'fixed') return false;
      var tels = e.querySelectorAll('a[href^="tel:"]');
      return tels.length >= 2 && tels.length === e.children.length;
    });
    if (!box) return false;
    box.id = 'ul-phone-fab';

    var st = document.createElement('style');
    st.textContent =
      '#ul-phone-fab{display:flex;flex-direction:column;gap:8px;align-items:flex-start}' +
      '#ul-phone-fab a[href^="tel:"]{display:none;background:#161616;border:1px solid #c9a96e55;color:#e8e4dc;padding:9px 14px;border-radius:24px;text-decoration:none;font-size:13px;white-space:nowrap;animation:ulfab .2s ease}' +
      '#ul-phone-fab.open a[href^="tel:"]{display:block}' +
      '@keyframes ulfab{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}' +
      '#ul-fab-btn{width:52px;height:52px;border-radius:50%;background:#c9a96e;color:#241d10;border:0;font-size:22px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center}' +
      '#ul-fab-btn:active{transform:scale(.95)}';
    document.head.appendChild(st);

    var btn = document.createElement('button');
    btn.id = 'ul-fab-btn'; btn.type = 'button'; btn.textContent = '📞';
    btn.setAttribute('aria-label', 'Телефоны');
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      box.classList.toggle('open');
      btn.textContent = box.classList.contains('open') ? '✕' : '📞';
    });
    box.appendChild(btn);
    document.addEventListener('click', function (e) {
      if (!box.contains(e.target) && box.classList.contains('open')) {
        box.classList.remove('open'); btn.textContent = '📞';
      }
    });
    return true;
  }

  // ---------- 2. Страховка NAV_MAP ----------
  var MAP_LABEL = { ru: 'Карта', en: 'Map', uz: 'Xarita' };
  function fixNavMap() {
    [].forEach.call(document.querySelectorAll('a,span,li,div,button'), function (e) {
      if (e.children.length === 0 && e.textContent.trim() === 'NAV_MAP') {
        var l = (document.documentElement.lang || 'ru').slice(0, 2).toLowerCase();
        e.textContent = MAP_LABEL[l] || MAP_LABEL.ru;
      }
    });
  }

  function init() { fixPhones(); fixNavMap(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  var n = 0, iv = setInterval(function () {
    var done = fixPhones(); fixNavMap();
    if ((done && n > 10) || ++n > 60) clearInterval(iv);
  }, 500);
})();
