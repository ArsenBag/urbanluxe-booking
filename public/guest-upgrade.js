/* Urban Luxe — guest-upgrade.js: доработки личного кабинета гостя.
   1) «🔑 Инструкция по заселению» на подтверждённых бронях (таблица checkin_instructions,
      RLS отдаёт её только гостю с confirmed/paid бронью на эту квартиру).
   2) «Забронировать снова» на прошедших/отменённых бронях → /?book=<apartment_id>
      (модалку открывает booking-v2.js на главной).
   Подключение в guest.html:
     <script src="/guest-upgrade.js" defer></script> */
(function () {
  'use strict';

  var SB_URL = 'https://sebvfvtofiysbywxjqut.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI';

  var L = {
    ru: { instr: '🔑 Инструкция по заселению', again: '↻ Забронировать снова',
      none: 'Инструкция для этой квартиры ещё не добавлена — напишите менеджеру в Telegram, и мы всё подскажем.',
      title: 'Инструкция по заселению', close: 'Закрыть',
      today0: 'Заезд сегодня!', today1: 'Заезд завтра', todayN: 'Заезд через {n} дн.',
      newBook: '+ Новая бронь', ctTitle: 'Мы всегда на связи', ctSub: 'Консьерж 24/7 — звоните или пишите, отвечаем в течение 5 минут',
      ctSite: '🏙 Все апартаменты на сайте →', ctChannel: '📣 Канал с каталогом' },
    en: { instr: '🔑 Check-in instructions', again: '↻ Book again',
      none: 'Instructions for this apartment are not added yet — message our manager on Telegram and we will help.',
      title: 'Check-in instructions', close: 'Close',
      today0: 'Check-in today!', today1: 'Check-in tomorrow', todayN: 'Check-in in {n} days',
      newBook: '+ New booking', ctTitle: 'We are always in touch', ctSub: 'Concierge 24/7 — call or write, we reply within 5 minutes',
      ctSite: '🏙 All apartments on the site →', ctChannel: '📣 Catalog channel' },
    uz: { instr: '🔑 Joylashish koʼrsatmasi', again: '↻ Qayta bron qilish',
      none: 'Bu kvartira uchun koʼrsatma hali qoʼshilmagan — Telegram orqali menejerga yozing, yordam beramiz.',
      title: 'Joylashish koʼrsatmasi', close: 'Yopish',
      today0: 'Bugun kirish!', today1: 'Ertaga kirish', todayN: '{n} kundan keyin kirish',
      newBook: '+ Yangi bron', ctTitle: 'Doim aloqadamiz', ctSub: 'Konsyerj 24/7 — qoʼngʼiroq qiling yoki yozing, 5 daqiqada javob beramiz',
      ctSite: '🏙 Saytdagi barcha kvartiralar →', ctChannel: '📣 Katalog kanali' }
  };
  function t() { var l = (document.documentElement.lang || 'ru').slice(0, 2).toLowerCase(); return L[l] || L.ru; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  var sbc = null;
  function sb() {
    if (!sbc && window.supabase && window.supabase.createClient) sbc = window.supabase.createClient(SB_URL, SB_KEY, { auth: { detectSessionInUrl: false } });
    return sbc;
  }

  function showInstr(aptId) {
    var s = t(), c = sb(); if (!c) return;
    var langCol = 'content_' + ((document.documentElement.lang || 'ru').slice(0, 2).toLowerCase());
    if (['content_ru', 'content_en', 'content_uz'].indexOf(langCol) < 0) langCol = 'content_ru';
    c.from('checkin_instructions').select('*').eq('apartment_id', aptId).maybeSingle().then(function (r) {
      var row = r.data;
      var text = row && (row[langCol] || row.content_ru);
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
      ov.innerHTML = '<div style="background:#161616;border:1px solid #333;border-radius:16px;padding:24px;max-width:460px;width:100%;max-height:80vh;overflow:auto">' +
        '<h3 style="margin:0 0 12px;color:#c9a96e;font-size:18px">' + esc(s.title) + '</h3>' +
        '<div style="color:#e8e4dc;font-size:14px;line-height:1.65;white-space:pre-wrap">' + (text ? esc(text) : esc(s.none)) + '</div>' +
        '<button style="margin-top:16px;width:100%;background:#c9a96e;color:#241d10;border:0;border-radius:9px;padding:12px;font-size:14px;font-weight:600;cursor:pointer">' + esc(s.close) + '</button></div>';
      ov.querySelector('button').onclick = function () { ov.remove(); };
      ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
      document.body.appendChild(ov);
    });
  }

  function btn(label, gold) {
    var b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'flex:1;min-height:40px;border-radius:9px;font-size:13px;cursor:pointer;font-family:inherit;' +
      (gold ? 'background:#c9a96e;color:#241d10;border:0;font-weight:600' : 'background:transparent;border:1px solid #4a4a4a;color:#cfcabd');
    return b;
  }

  /* фото квартир для карточек броней */
  var APTPH = null;
  function loadAptPhotos() {
    if (APTPH) return Promise.resolve(APTPH);
    var c = sb(); if (!c) return Promise.resolve({});
    return c.from('apartments').select('id,photo_url').then(function (r) {
      APTPH = {};
      (r.data || []).forEach(function (a) {
        var ph = '';
        try { ph = JSON.parse(a.photo_url)[0]; } catch (e) { ph = a.photo_url || ''; }
        if (ph) APTPH[a.id] = 'https://images.weserv.nl/?url=ssl:' + encodeURIComponent(ph.replace(/^https?:\/\//, '')) + '&w=420&q=75&output=webp';
      });
      return APTPH;
    }, function () { return {}; });
  }

  function enhance() {
    var c = sb(); if (!c) return;
    renderExtras();
    c.auth.getUser().then(function (r) {
      var u = r.data && r.data.user; if (!u) return;
      return Promise.all([
        c.from('bookings').select('id,booking_ref,apartment_id,status,check_in,check_out')
          .or('user_id.eq.' + u.id + ',guest_email.eq.' + u.email + ',booker_email.eq.' + u.email),
        loadAptPhotos()
      ]);
    }).then(function (res) {
      if (!res) return;
      var r = res[0];
      if (!r || !r.data) return;
      var today = new Date().toISOString().slice(0, 10);
      var s = t();
      r.data.forEach(function (b) {
        if (!b.booking_ref) return;
        var card = [].find.call(document.querySelectorAll('.bcard'), function (el) {
          return el.textContent.indexOf(b.booking_ref) > -1 && !el.querySelector('.ulg-row');
        });
        /* фото квартиры в карточку (если карточка без изображения) */
        var cardAny = [].find.call(document.querySelectorAll('.bcard'), function (el) {
          return el.textContent.indexOf(b.booking_ref) > -1;
        });
        if (cardAny && !cardAny.querySelector('img') && APTPH && APTPH[b.apartment_id]) {
          var im = document.createElement('img');
          im.src = APTPH[b.apartment_id];
          im.loading = 'lazy';
          im.style.cssText = 'width:100%;height:150px;object-fit:cover;border-radius:12px;margin-bottom:10px;display:block';
          cardAny.insertBefore(im, cardAny.firstChild);
        }
        /* «заезд через N дней» для будущих подтверждённых */
        if (cardAny && b.status === 'confirmed' && b.check_in >= today && !cardAny.querySelector('.ulg-soon')) {
          var days = Math.round((new Date(b.check_in) - new Date(today)) / 86400000);
          if (days <= 7) {
            var pl = document.createElement('div');
            pl.className = 'ulg-soon';
            pl.style.cssText = 'background:rgba(201,169,110,.14);color:#c9a96e;font-size:12px;padding:6px 12px;border-radius:8px;margin:8px 0 0';
            pl.textContent = days === 0 ? '🔑 ' + s.today0 : days === 1 ? s.today1 : s.todayN.replace('{n}', days);
            cardAny.appendChild(pl);
          }
        }
        if (!card) return;
        var row = document.createElement('div');
        row.className = 'ulg-row';
        row.style.cssText = 'display:flex;gap:8px;margin-top:10px';
        var added = false;
        if (b.status === 'confirmed' && b.check_out >= today) {
          var bi = btn(s.instr, true);
          bi.onclick = function () { showInstr(b.apartment_id); };
          row.appendChild(bi); added = true;
        }
        if (b.status === 'cancelled' || b.check_out < today) {
          var ba = btn(s.again, false);
          ba.onclick = function () { location.href = '/?book=' + encodeURIComponent(b.apartment_id); };
          row.appendChild(ba); added = true;
        }
        if (added) card.appendChild(row);
      });
    }).catch(function () {});
  }

  /* «+ Новая бронь» рядом с заголовком поездок + блок контактов внизу кабинета */
  function renderExtras() {
    var s = t();
    var dash = document.getElementById('dashPage');
    if (!dash || dash.offsetParent === null) return;
    /* кнопка новой брони над списком */
    var sec = document.getElementById('secBookings');
    if (sec && !document.getElementById('ulg-newbook')) {
      var nb = document.createElement('a');
      nb.id = 'ulg-newbook';
      nb.href = '/#apartments';
      nb.textContent = s.newBook;
      nb.style.cssText = 'display:inline-block;background:#c9a96e;color:#241d10;font-weight:700;font-size:13px;padding:10px 18px;border-radius:10px;text-decoration:none;margin:0 0 14px';
      sec.insertBefore(nb, sec.firstChild);
    }
    /* контакты внизу */
    if (!document.getElementById('ulg-contacts')) {
      var d = document.createElement('div');
      d.id = 'ulg-contacts';
      d.style.cssText = 'background:rgba(255,255,255,.03);border:1px solid rgba(201,169,110,.25);border-radius:16px;padding:18px 20px;margin:26px 0 10px';
      function cbtn(href, label, blank) {
        return '<a href="' + href + '"' + (blank ? ' target="_blank" rel="noopener"' : '') + ' style="display:inline-flex;align-items:center;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:11px;padding:10px 15px;font-size:13px;color:#ece9e2;text-decoration:none;margin:0 8px 8px 0">' + label + '</a>';
      }
      d.innerHTML = '<div style="font-size:16px;color:#ece9e2;margin-bottom:3px;font-weight:600">' + esc(s.ctTitle) + '</div>' +
        '<div style="font-size:12.5px;color:#9a958a;margin-bottom:12px">' + esc(s.ctSub) + '</div>' +
        cbtn('tel:+998936900044', '📞 +998 93 690 00 44') +
        cbtn('tel:+998999579485', '📞 +998 99 957 94 85') +
        cbtn('https://t.me/Arsen_bnb', '✈️ Telegram @Arsen_bnb', true) +
        cbtn('https://t.me/UrbanLuxehotel', esc(s.ctChannel), true) +
        cbtn('https://instagram.com/urbanluxe.uz', '📷 Instagram', true) +
        cbtn('/#apartments', esc(s.ctSite));
      dash.appendChild(d);
    }
  }

  function hook() {
    if (typeof window.renderBookings === 'function' && !window.renderBookings.__ulg) {
      var orig = window.renderBookings;
      window.renderBookings = function () {
        var res = orig.apply(this, arguments);
        setTimeout(enhance, 150);
        return res;
      };
      window.renderBookings.__ulg = true;
    }
  }
  hook();
  var n = 0, iv = setInterval(function () {
    hook(); enhance();
    if (++n > 30) clearInterval(iv);
  }, 700);
})();
