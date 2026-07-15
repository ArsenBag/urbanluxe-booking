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
      title: 'Инструкция по заселению', close: 'Закрыть' },
    en: { instr: '🔑 Check-in instructions', again: '↻ Book again',
      none: 'Instructions for this apartment are not added yet — message our manager on Telegram and we will help.',
      title: 'Check-in instructions', close: 'Close' },
    uz: { instr: '🔑 Joylashish koʼrsatmasi', again: '↻ Qayta bron qilish',
      none: 'Bu kvartira uchun koʼrsatma hali qoʼshilmagan — Telegram orqali menejerga yozing, yordam beramiz.',
      title: 'Joylashish koʼrsatmasi', close: 'Yopish' }
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

  function enhance() {
    var c = sb(); if (!c) return;
    c.auth.getUser().then(function (r) {
      var u = r.data && r.data.user; if (!u) return;
      return c.from('bookings').select('id,booking_ref,apartment_id,status,check_out')
        .or('user_id.eq.' + u.id + ',guest_email.eq.' + u.email + ',booker_email.eq.' + u.email);
    }).then(function (r) {
      if (!r || !r.data) return;
      var today = new Date().toISOString().slice(0, 10);
      var s = t();
      r.data.forEach(function (b) {
        if (!b.booking_ref) return;
        var card = [].find.call(document.querySelectorAll('.bcard'), function (el) {
          return el.textContent.indexOf(b.booking_ref) > -1 && !el.querySelector('.ulg-row');
        });
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
    if (++n > 20) clearInterval(iv);
  }, 700);
})();
