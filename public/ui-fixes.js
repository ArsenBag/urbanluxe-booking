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

  // ---------- 1b. Стрелки карусели: текстовые ‹ › → SVG ----------
  // У части пользователей символы ‹ › коверкаются (автоперевод браузера/шрифты)
  // и выглядят как «л»/«ы». SVG не зависит ни от шрифта, ни от переводчика.
  var SVG_L = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>';
  var SVG_R = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>';
  function fixArrows() {
    [].forEach.call(document.querySelectorAll('.sf-arrow'), function (b) {
      if (b.querySelector('svg')) return;
      var txt = b.textContent.trim();
      var isLeft = txt === '‹' || txt === '<' || txt === '←' || b.className.indexOf('prev') > -1;
      var isRight = txt === '›' || txt === '>' || txt === '→' || b.className.indexOf('next') > -1;
      if (!isLeft && !isRight) { isLeft = b === b.parentElement.firstElementChild; isRight = !isLeft; }
      b.setAttribute('translate', 'no');
      b.innerHTML = isLeft ? SVG_L : SVG_R;
      b.style.display = 'inline-flex'; b.style.alignItems = 'center'; b.style.justifyContent = 'center';
    });
    var wrap = document.querySelectorAll('.sf-arrows');
    [].forEach.call(wrap, function (w) { w.setAttribute('translate', 'no'); });
  }
  var moArr = new MutationObserver(function () { fixArrows(); });
  function startArrowFix() {
    fixArrows();
    moArr.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startArrowFix); else startArrowFix();

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

  // ---------- 3. Актуальное число объектов (в текстах зашито «25») ----------
  function fixCounts() {
    fetch('https://sebvfvtofiysbywxjqut.supabase.co/rest/v1/apartments?select=id&is_active=eq.true', {
      headers: { apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI' }
    }).then(function (r) { return r.json(); }).then(function (list) {
      var n = list.length; if (!n || n < 25) return;
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        var v = node.nodeValue;
        if (/25\s*резиденций/i.test(v) || /25\s+квартир/i.test(v)) node.nodeValue = v.replace(/25(\s*(резиденций|квартир))/i, n + '$1');
        else if (v.trim() === '25' && node.parentElement && /резиденц/i.test((node.parentElement.parentElement || {}).textContent || '')) node.nodeValue = String(n);
      }
    }).catch(function () {});
  }

  // ---------- 4. Блок «адреса одного стиля»: живая карта + 6 комплексов ----------
  var COMPLEXES = [
    { key: 'Nest One', url: '/nest-one', lat: 41.3111, lng: 69.2513, color: '#31c46f', addr: 'ул. Батыра Закирова 1А, Tashkent City', desc: 'Самый высокий небоскрёб Узбекистана. 51 этаж, панорамные виды.' },
    { key: 'U-Tower', url: '/u-tower', lat: 41.3025, lng: 69.2408, color: '#5b9dd9', addr: 'мкр. Бешагач 1/1, Шайхантахурский район', desc: 'Бизнес-класс, 27 этажей, Smart Home.' },
    { key: 'Mirabad', url: '/mirabad', lat: 41.2955, lng: 69.2740, color: '#e8a33d', addr: 'ул. Айбек 38А, Мирабадский район', desc: 'Престижный центр: парки, рестораны, метро.' },
    { key: 'Kislorod', url: '/kislorod', lat: 41.2846, lng: 69.2452, color: '#e5534b', addr: 'ул. Бурижар 1, Яккасарайский район', desc: 'Эко-комплекс с зелёным двором вдоль реки.' },
    { key: 'Gardens Residence', url: '/gardens-residence', lat: 41.3130, lng: 69.2480, color: '#9fd356', addr: 'Tashkent City, Шайхантахурский район', desc: 'Квартал-сад от Dream City рядом с Nest One.' },
    { key: 'Modera Towers', url: '/modera-towers', lat: 41.2860, lng: 69.2710, color: '#b48be8', addr: 'ул. Шота Руставели 19, Яккасарайский район', desc: 'Две 24-этажные башни у парка Дружбы.' }
  ];
  function mapUpgrade() {
    if (document.getElementById('ulmap')) return true;
    /* находим секцию с заглушкой карты по заголовку */
    var head = [].find.call(document.querySelectorAll('h2,h3'), function (h) { return /адрес(а|ов) одного стиля/i.test(h.textContent); });
    if (!head) return false;
    var section = head.closest('section') || head.parentElement;
    if (!section) return false;
    /* контейнер после заголовка */
    var holder = document.createElement('div');
    holder.id = 'ulmap-wrap';
    holder.innerHTML =
      '<div id="ulmap" style="border-radius:16px;overflow:hidden;border:1px solid rgba(201,169,110,.25);height:440px;background:#15151a"></div>' +
      '<div id="ulmap-cards" style="display:grid;gap:10px;align-content:start;max-height:440px;overflow:auto;padding-right:4px"></div>';
    holder.style.cssText = 'display:grid;grid-template-columns:1.2fr 1fr;gap:18px;margin-top:22px';
    if (window.innerWidth < 800) holder.style.gridTemplateColumns = '1fr';
    /* прячем старое содержимое секции после заголовка */
    var nodes = [].slice.call(section.children);
    var afterHead = false;
    nodes.forEach(function (nd) {
      if (nd === head || nd.contains(head)) { afterHead = true; return; }
      if (afterHead) nd.style.display = 'none';
    });
    section.appendChild(holder);
    head.innerHTML = head.innerHTML.replace(/Четыре|Пять|Семь/i, 'Шесть');
    /* карточки комплексов с живыми данными */
    fetch('https://sebvfvtofiysbywxjqut.supabase.co/rest/v1/apartments?select=complex,weekday_price&is_active=eq.true', {
      headers: { apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI' }
    }).then(function (r) { return r.json(); }).then(function (apts) {
      var agg = {};
      apts.forEach(function (a) {
        var c = a.complex || '—';
        agg[c] = agg[c] || { n: 0, min: 1e9 };
        agg[c].n++; if (a.weekday_price) agg[c].min = Math.min(agg[c].min, a.weekday_price);
      });
      var cardsBox = document.getElementById('ulmap-cards');
      cardsBox.innerHTML = COMPLEXES.filter(function (c) { return agg[c.key] && agg[c.key].n; }).map(function (c, i) {
        var a = agg[c.key];
        return '<a href="' + c.url + '" data-ci="' + i + '" style="display:block;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:14px 16px;text-decoration:none;transition:border-color .2s,transform .15s" ' +
          'onmouseover="this.style.borderColor=\'rgba(201,169,110,.6)\';this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.borderColor=\'rgba(255,255,255,.09)\';this.style.transform=\'none\'">' +
          '<div style="display:flex;align-items:center;gap:8px"><span style="width:9px;height:9px;border-radius:50%;background:' + c.color + ';box-shadow:0 0 8px ' + c.color + '"></span>' +
          '<b style="color:#ece9e2;font-size:15px">' + c.key + '</b></div>' +
          '<div style="color:#8b8578;font-size:12px;margin:4px 0 2px">' + c.addr + '</div>' +
          '<div style="color:#b5b0a5;font-size:12.5px;margin-bottom:6px">' + c.desc + '</div>' +
          '<div style="color:#c9a96e;font-size:12.5px">' + a.n + ' апартаментов · от $' + a.min + '/ночь · <u>смотреть →</u></div></a>';
      }).join('');
      /* Leaflet: тёмная карта с пульсирующими маркерами */
      var css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.css';
      document.head.appendChild(css);
      var sc = document.createElement('script');
      sc.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.js';
      sc.onload = function () {
        var L = window.L;
        var map = L.map('ulmap', { scrollWheelZoom: false, attributionControl: false }).setView([41.299, 69.256], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(map);
        COMPLEXES.forEach(function (c) {
          if (!agg[c.key] || !agg[c.key].n) return;
          var m = L.circleMarker([c.lat, c.lng], { radius: 9, color: c.color, weight: 2, fillColor: c.color, fillOpacity: .55 }).addTo(map);
          m.bindPopup('<b style="font-size:14px">' + c.key + '</b><br><span style="color:#666">' + c.addr + '</span><br>' + agg[c.key].n + ' апартаментов · от $' + agg[c.key].min + '<br><a href="' + c.url + '">Смотреть →</a>', { closeButton: false });
          m.on('mouseover', function () { m.openPopup(); });
        });
      };
      document.head.appendChild(sc);
    }).catch(function () {});
    return true;
  }

  // ---------- 5. «Вау»-слой: появление секций и оживший счётчик ----------
  function wowLayer() {
    if (document.getElementById('ul-wow-css')) return;
    var st = document.createElement('style');
    st.id = 'ul-wow-css';
    st.textContent =
      '.ul-reveal{opacity:0;transform:translateY(26px);transition:opacity .7s cubic-bezier(.2,.6,.2,1),transform .7s cubic-bezier(.2,.6,.2,1)}' +
      '.ul-reveal.ul-in{opacity:1;transform:none}' +
      '@media(prefers-reduced-motion:reduce){.ul-reveal{opacity:1;transform:none;transition:none}}';
    document.head.appendChild(st);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('ul-in'); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    [].forEach.call(document.querySelectorAll('section, footer'), function (s, i) {
      if (i === 0) return; /* hero не трогаем */
      s.classList.add('ul-reveal');
      io.observe(s);
    });
    /* набегающие числа в статистике hero (35, 4.9 и т.п.) */
    var st2 = [].filter.call(document.querySelectorAll('div,span,b'), function (e) {
      return e.children.length === 0 && /^\d{1,3}([.,]\d)?$/.test(e.textContent.trim()) && e.offsetParent !== null &&
        parseFloat(getComputedStyle(e).fontSize) >= 24;
    }).slice(0, 6);
    st2.forEach(function (el) {
      var raw = el.textContent.trim().replace(',', '.');
      var target = parseFloat(raw); if (!target) return;
      var dec = raw.indexOf('.') > -1 ? 1 : 0;
      var t0 = null;
      var io2 = new IntersectionObserver(function (ens) {
        ens.forEach(function (en) {
          if (!en.isIntersecting) return;
          io2.unobserve(el);
          function stepFn(ts) {
            if (!t0) t0 = ts;
            var p = Math.min(1, (ts - t0) / 1100);
            var eased = 1 - Math.pow(1 - p, 3);
            el.textContent = (target * eased).toFixed(dec).replace('.', dec ? ',' : '.');
            if (p < 1) requestAnimationFrame(stepFn); else el.textContent = raw.replace('.', dec ? ',' : '.');
          }
          requestAnimationFrame(stepFn);
        });
      }, { threshold: 0.5 });
      io2.observe(el);
    });
  }

  // ---------- 6. Мобильный выбор даты: flatpickr minDate с временем ----------
  // На телефоне flatpickr подменяется нативным пикером; выбранное «сегодня» = 00:00,
  // а minDate: new Date() несёт текущее время -> setDate() отбрасывает дату (пустое поле).
  // Обнуляем время в minDate у всех инстансов.
  function fixDates() {
    var found = false;
    ['searchCheckIn', 'searchCheckOut'].forEach(function (id) {
      var el = document.getElementById(id);
      var fp = el && el._flatpickr;
      if (!fp) return;
      found = true;
      var d = fp.config.minDate;
      if (d && (d.getHours() || d.getMinutes() || d.getSeconds())) {
        var z = new Date(d); z.setHours(0, 0, 0, 0);
        fp.config.minDate = z;
        if (fp.mobileInput) { try { fp.mobileInput.min = fp.formatDate(z, 'Y-m-d'); } catch (e) {} }
      }
    });
    return found;
  }

  // ---------- 7. FAB-ы не перекрываются на мобильном ----------
  // На <=900px чат уезжает на bottom:80, а Telegram-кнопка на 84 -> накладываются.
  (function fabStack() {
    var st = document.createElement('style');
    st.textContent = '@media (max-width:900px){.ul-tg-fab{bottom:144px !important;right:16px !important;}}';
    document.head.appendChild(st);
  })();

  // ---------- 9. Фото заполняет карточку целиком ----------
  // CSS сайта: .card__img img{height:auto;object-fit:contain} при контейнере 4:3 ->
  // фото занимает ~80% высоты, снизу пустая полоса. Заполняем блок с обрезкой.
  (function cardImgFill() {
    var st = document.createElement('style');
    st.textContent = '.card__img img{height:100% !important;object-fit:cover !important;max-height:none !important;}';
    document.head.appendChild(st);
  })();

  // ---------- 10. Фильтры Gardens Residence и Modera Towers ----------
  function addFilters() {
    var btns = document.querySelectorAll('.filters button');
    if (!btns.length) return false;
    if (document.getElementById('ul-flt-gardens')) return true;
    var wrap = btns[btns.length - 1].parentElement;
    [['ul-flt-gardens', 'Gardens', 'Gardens Residence'], ['ul-flt-modera', 'Modera', 'Modera Towers']].forEach(function (f) {
      var b = document.createElement('button');
      b.id = f[0];
      b.className = btns[btns.length - 1].className.replace('active', '').trim();
      b.textContent = f[1];
      b.setAttribute('onclick', "filterApts('" + f[2] + "')");
      wrap.appendChild(b);
    });
    return true;
  }

  // ---------- 8. Мобильная модалка апартамента ----------
  // Сетка модалки задана инлайн-стилем grid-template-columns:1fr 320px и на телефоне
  // не складывается -> контент шире экрана, всё «плывёт». Складываем в столбик
  // и прячем горизонтальный скролл.
  (function modalMobile() {
    var st = document.createElement('style');
    st.textContent =
      '@media (max-width:760px){' +
      '.modal{overflow-x:hidden !important;}' +
      '.modal-body > div[style*="grid-template-columns"]{display:block !important;}' +
      '.modal-body > div > div[style*="sticky"]{position:static !important;margin-top:18px;}' +
      '.gallery-nav{opacity:1 !important;width:42px !important;height:42px !important;}' +
      '}';
    document.head.appendChild(st);
  })();

  // Свайп фото в галерее модалки (на телефоне листание пальцем)
  function galSwipe() {
    var g = document.querySelector('.modal .gallery');
    if (!g) return false;
    if (g.dataset.ulSwipe) return true;
    g.dataset.ulSwipe = '1';
    var x0 = null, y0 = null;
    g.addEventListener('touchstart', function (e) {
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, { passive: true });
    g.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      var dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        try { window.gNav(dx < 0 ? 1 : -1); } catch (err) {}
      }
    }, { passive: true });
    return true;
  }

  function init() { fixPhones(); fixNavMap(); setTimeout(fixCounts, 1200); setTimeout(wowLayer, 2300); var mTry = 0, mIv = setInterval(function () { if (mapUpgrade() || ++mTry > 25) clearInterval(mIv); }, 500); var dTry = 0, dIv = setInterval(function () { if (fixDates() || ++dTry > 30) clearInterval(dIv); }, 400); var gTry = 0, gIv = setInterval(function () { if (galSwipe() || ++gTry > 30) clearInterval(gIv); }, 500); var fTry = 0, fIv = setInterval(function () { if (addFilters() || ++fTry > 30) clearInterval(fIv); }, 500); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  var n = 0, iv = setInterval(function () {
    var done = fixPhones(); fixNavMap();
    if ((done && n > 10) || ++n > 60) clearInterval(iv);
  }, 500);
})();
