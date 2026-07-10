/* Urban Luxe — аналитика: GA4 (gtag) + Facebook Pixel (fbq) + конверсии.
   ID вписаны (июль 2026). Залей в public/, подключи в index.html:
      <script src="/analytics.js" defer></script> */
(function () {
  'use strict';

  // ====== ID (боевые) ======
  var GA4_ID = 'G-R00JJKB9E7';        // GA4: ресурс urbanluxe.cc, поток Urban Luxe Website (15234552415)
  var FB_PIXEL_ID = '1057396590583083'; // Meta Pixel: Urban Luxe Pixel (портфолио Tor)
  // ============================

  var GA_ON = /^G-[A-Z0-9]+$/.test(GA4_ID);
  var FB_ON = /^\d{6,}$/.test(FB_PIXEL_ID);

  // --- GA4 (gtag.js) ---
  if (GA_ON) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', GA4_ID);
  } else if (!window.gtag) { window.gtag = function () {}; }

  // --- Facebook/Meta Pixel ---
  if (FB_ON) {
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', FB_PIXEL_ID);
    fbq('track', 'PageView');
  } else if (!window.fbq) { window.fbq = function () {}; }

  // track(gaEvent, gaParams, fb {std, name}, fbParams)
  function track(ga, gaParams, fb, fbParams) {
    try { if (GA_ON) gtag('event', ga, gaParams || {}); } catch (e) {}
    try { if (FB_ON && fb) fbq(fb.std ? 'track' : 'trackCustom', fb.name, fbParams || {}); } catch (e) {}
  }

  function curApt() {
    var img = document.querySelector('#modalContent img, .modal img');
    if (img && img.src) { var m = img.src.match(/\/apartments\/([^\/]+)\//); if (m && m[1] && m[1] !== 'hero') return m[1]; }
    return null;
  }

  // Обёртки глобальных функций сайта
  function wrap(name, before) {
    if (typeof window[name] === 'function' && !window[name].__aHook) {
      var orig = window[name];
      window[name] = function () { try { before.apply(null, arguments); } catch (e) {} return orig.apply(this, arguments); };
      window[name].__aHook = true;
      return true;
    }
    return false;
  }
  function hookAll() {
    wrap('openModal', function (id) {
      var a = (typeof id === 'string') ? id : curApt();
      track('view_item', { item_id: a }, { std: true, name: 'ViewContent' }, { content_ids: a ? [a] : [], content_type: 'product' });
    });
    wrap('searchAvailability', function () {
      track('search', { search_type: 'dates' }, { std: true, name: 'Search' });
    });
    wrap('modalBook', function () {
      track('begin_checkout', { item_id: curApt() }, { std: true, name: 'InitiateCheckout' });
    });
  }
  hookAll();
  var tries = 0, h = setInterval(function () { hookAll(); if (++tries > 40) clearInterval(h); }, 250);

  // Реальная конверсия брони: перехват POST на /.netlify/functions/book
  if (window.fetch) {
    var of = window.fetch;
    window.fetch = function (input, init) {
      var url = (typeof input === 'string') ? input : (input && input.url) || '';
      var isBook = /\/functions\/book(\?|$|\/)/.test(url) && (!init || ((init.method || 'GET').toUpperCase() === 'POST'));
      var p = of.apply(this, arguments);
      if (isBook) {
        p.then(function (res) {
          if (res && res.ok) track('generate_lead', { item_id: curApt(), value: 1 }, { std: true, name: 'Lead' });
        }).catch(function () {});
      }
      return p;
    };
  }

  // Делегированные клики: Telegram и «Поделиться»
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    if (e.target.closest('a[href*="t.me"], a[href*="telegram"]')) {
      track('telegram_click', { method: 'telegram' }, { std: true, name: 'Contact' });
      return;
    }
    if (e.target.closest('.ul-share-btn')) {
      track('share', { method: 'apartment_link' }, { std: false, name: 'Share' });
    }
  }, true);
})();
