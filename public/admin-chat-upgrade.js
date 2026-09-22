/* Urban Luxe — admin-chat-upgrade.js (22.09.2026): чат админки поверх admin.html.
   Что даёт:
   1) Диалог на каждую бронь появляется сам — триггер в базе (booking_open_chat) кладёт карточку
      брони первым сообщением (conversation_id = bookings.id). Здесь карточка рисуется отдельно,
      а список диалогов обновляется по realtime (новая бронь → диалог сверху + всплывашка).
   2) В шапке диалога — кнопки связи по данным брони: Telegram (номер или @ник), WhatsApp,
      позвонить, email, скопировать номер.
   3) Ответ менеджера дублируется гостю письмом через /.netlify/functions/chat-email
      (проверяет JWT админа, шлёт через Resend). Статус — под полем ответа.
   Ничего в admin.html не переписываем: оборачиваем глобальные openConversation / adminSendMsg.
   Подключение в admin.html (после admin-rent.js):
     <script src="/admin-chat-upgrade.js" defer></script> */
(function () {
  'use strict';

  var CARD = '🆕 Новая бронь';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function digits(p) { return String(p || '').replace(/\D/g, ''); }
  function tgLink(v) {
    v = String(v || '').trim(); if (!v) return '';
    if (v.charAt(0) === '@') return 'https://t.me/' + v.slice(1);
    var d = digits(v); return d ? 'https://t.me/+' + d : '';
  }
  function waLink(v) { var d = digits(v); return d ? 'https://wa.me/' + d : ''; }
  function isCard(m) { return m && typeof m.content === 'string' && m.content.indexOf(CARD) === 0; }
  function client() { try { return sb; } catch (e) { return window.sb || null; } }
  function convId() { try { return currentConvId; } catch (e) { return window.__ulConvId || null; } }
  function aptName(id) {
    var a = (window._allApts || []).filter(function (x) { return x.id === id; })[0];
    return a ? a.name + (a.complex ? ' · ' + a.complex : '') : (id || '');
  }
  function fmtD(s) { return s ? String(s).slice(8, 10) + '.' + String(s).slice(5, 7) : ''; }

  // ---------- стили ----------
  var st = document.createElement('style');
  st.textContent =
    '#ul-chat-contacts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}' +
    '#ul-chat-contacts a,#ul-chat-contacts button{display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border-radius:8px;font-size:11.5px;text-decoration:none;border:1px solid var(--line,#333);background:var(--bg,#111);color:var(--ink,#e8e4dc);cursor:pointer;font-family:inherit;white-space:nowrap}' +
    '#ul-chat-contacts a.tg{border-color:#2AABEE66;color:#5cc0f5}#ul-chat-contacts a.wa{border-color:#25D36666;color:#4fe08a}' +
    '#ul-chat-contacts a.off{opacity:.45;pointer-events:none}' +
    '#ul-chat-contacts .note{font-size:10.5px;color:var(--ink-d,#8a857a);align-self:center}' +
    '.ul-chat-card{align-self:center !important;max-width:88% !important;width:100%;background:rgba(201,169,110,.08) !important;border:1px solid rgba(201,169,110,.35);white-space:pre-line;font-size:12.5px !important;line-height:1.5}' +
    '#ul-chat-mailstatus{font-size:11px;color:var(--ink-d,#8a857a);padding:4px 12px 8px;min-height:14px}' +
    '#ul-chat-toast{position:fixed;right:18px;bottom:18px;background:#1c1710;border:1px solid #c9a96e;color:#e8e4dc;padding:12px 16px;border-radius:10px;font-size:13px;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,.5);max-width:320px;line-height:1.45;cursor:pointer;display:none;white-space:pre-line}';
  document.head.appendChild(st);

  function toast(msg, ms) {
    var t = document.getElementById('ul-chat-toast');
    if (!t) { t = document.createElement('div'); t.id = 'ul-chat-toast'; document.body.appendChild(t); t.onclick = function () { t.style.display = 'none'; }; }
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(t.__tm); t.__tm = setTimeout(function () { t.style.display = 'none'; }, ms || 6000);
  }

  // ---------- 1. Кнопки связи + карточка в открытом диалоге ----------
  var lastBk = null;
  async function decorate(id) {
    var c = client(); if (!c) return;
    var title = document.getElementById('chatConvTitle'); if (!title) return;
    var r = await c.from('bookings').select('id,booking_ref,guest_name,guest_phone,guest_email,guest_telegram,guest_whatsapp,booker_name,booker_phone,apartment_id,check_in,check_out,status,nights,total_price').eq('id', id).maybeSingle();
    var bk = r && r.data; lastBk = bk || null; window.__ulChatBk = lastBk;
    var old = document.getElementById('ul-chat-contacts'); if (old) old.remove();
    if (!bk) return;
    var tg = tgLink(bk.guest_telegram || bk.guest_phone), wa = waLink(bk.guest_whatsapp || bk.guest_phone);
    var tgLabel = bk.guest_telegram ? bk.guest_telegram : (bk.guest_phone ? 'по номеру' : '');
    var waLabel = bk.guest_whatsapp ? bk.guest_whatsapp : (bk.guest_phone ? 'по номеру' : '');
    var bar = document.createElement('div'); bar.id = 'ul-chat-contacts';
    bar.innerHTML =
      (tg ? '<a class="tg" href="' + esc(tg) + '" target="_blank" rel="noopener">✈️ Telegram <span style="opacity:.75">' + esc(tgLabel) + '</span></a>' : '<a class="tg off">✈️ Telegram —</a>') +
      (wa ? '<a class="wa" href="' + esc(wa) + '" target="_blank" rel="noopener">💬 WhatsApp <span style="opacity:.75">' + esc(waLabel) + '</span></a>' : '<a class="wa off">💬 WhatsApp —</a>') +
      (bk.guest_phone ? '<a href="tel:' + esc(bk.guest_phone) + '">📞 ' + esc(bk.guest_phone) + '</a>' : '') +
      (bk.guest_phone ? '<button type="button" data-copy="' + esc(bk.guest_phone) + '">⧉ номер</button>' : '') +
      (bk.guest_email ? '<a href="mailto:' + esc(bk.guest_email) + '">✉️ ' + esc(bk.guest_email) + '</a>' : '<span class="note">без email — ответы не дублируются письмом</span>') +
      (bk.booker_phone && bk.booker_phone !== bk.guest_phone ? '<span class="note">бронирует: ' + esc(bk.booker_name || '') + ' ' + esc(bk.booker_phone) + '</span>' : '') +
      (!bk.guest_telegram && !bk.guest_whatsapp ? '<span class="note">мессенджер не указан — ссылки по телефону</span>' : '');
    title.appendChild(bar);
    bar.querySelectorAll('button[data-copy]').forEach(function (b) {
      b.onclick = function () {
        var v = b.getAttribute('data-copy');
        try { navigator.clipboard.writeText(v).then(function () { b.textContent = '✓ скопировано'; setTimeout(function () { b.textContent = '⧉ номер'; }, 1500); }); } catch (e) { prompt('Номер:', v); }
      };
    });
    styleCards();
  }
  function styleCards() {
    var box = document.getElementById('adminChatMessages'); if (!box) return;
    [].forEach.call(box.children, function (row) {
      var bubble = row.firstElementChild; if (!bubble) return;
      var txt = (bubble.textContent || '').trim();
      if (txt.indexOf(CARD) === 0 && !bubble.classList.contains('ul-chat-card')) {
        bubble.classList.add('ul-chat-card');
        row.style.justifyContent = 'center';
      }
    });
  }

  function wrapOpen() {
    if (typeof window.openConversation !== 'function' || window.openConversation.__ul) return false;
    var orig = window.openConversation;
    window.openConversation = async function (id) {
      window.__ulConvId = id;
      var res = await orig.apply(this, arguments);
      try { await decorate(id); } catch (e) { console.warn('chat decorate', e); }
      return res;
    };
    window.openConversation.__ul = true;
    return true;
  }

  // ---------- 2. Ответ → письмо гостю ----------
  function mailStatus(msg, ok) {
    var bar = document.getElementById('chatReplyBar'); if (!bar) return;
    var s = document.getElementById('ul-chat-mailstatus');
    if (!s) { s = document.createElement('div'); s.id = 'ul-chat-mailstatus'; bar.parentElement.insertBefore(s, bar.nextSibling); }
    s.textContent = msg; s.style.color = ok ? '#4fe08a' : '#e5a34b';
    clearTimeout(s.__tm); s.__tm = setTimeout(function () { s.textContent = ''; }, 8000);
  }
  function wrapSend() {
    if (typeof window.adminSendMsg !== 'function' || window.adminSendMsg.__ul) return false;
    var orig = window.adminSendMsg;
    window.adminSendMsg = async function () {
      var input = document.getElementById('adminChatInput');
      var text = ((input && input.value) || '').trim();
      var id = convId();
      var res = await orig.apply(this, arguments);
      if (!text || !id) return res;
      var bk = lastBk && lastBk.id === id ? lastBk : null;
      if (!bk) { try { await decorate(id); bk = lastBk; } catch (e) {} }
      if (!bk) return res;               // диалог не по брони (старый чат по user_id) — письма нет
      if (!bk.guest_email) { mailStatus('Сообщение в чате. У гостя нет email — письмо не отправлено.', false); return res; }
      try {
        var c = client();
        var sess = await c.auth.getSession();
        var token = sess && sess.data && sess.data.session && sess.data.session.access_token;
        var r = await fetch('/.netlify/functions/chat-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({
            to: bk.guest_email, guest_name: bk.guest_name, booking_ref: bk.booking_ref,
            apartment: aptName(bk.apartment_id), dates: fmtD(bk.check_in) + ' → ' + fmtD(bk.check_out), text: text
          })
        });
        var j = await r.json().catch(function () { return {}; });
        if (r.ok && j.ok) mailStatus('✉️ Письмо гостю отправлено на ' + bk.guest_email, true);
        else mailStatus('В чате есть, письмо не ушло: ' + (j.error || j.skipped || r.status), false);
      } catch (e) { mailStatus('В чате есть, письмо не ушло: ' + e.message, false); }
      return res;
    };
    window.adminSendMsg.__ul = true;
    return true;
  }

  // ---------- 3. Realtime: новые диалоги/сообщения без кнопки «Обновить» ----------
  var seen = {};
  function chatVisible() { var el = document.getElementById('chatConvList'); return !!(el && el.offsetParent !== null); }
  function subscribeAll() {
    var c = client(); if (!c || subscribeAll.done) return; subscribeAll.done = true;
    try {
      c.channel('ul-admin-chat-all').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, function (p) {
        var m = p && p.new; if (!m || seen[m.id]) return; seen[m.id] = 1;
        if (m.sender_role === 'admin') return;
        if (chatVisible() && typeof window.loadConversations === 'function') window.loadConversations();
        if (convId() === m.conversation_id && chatVisible()) setTimeout(styleCards, 400);
        var first = String(m.content || '').split('\n').slice(0, 3).join('\n');
        toast((isCard(m) ? '🆕 Новая бронь — чат открыт\n' : '💬 Сообщение от гостя\n') + first, 9000);
        try {
          if (window.Notification && Notification.permission === 'granted') new Notification(isCard(m) ? 'Urban Luxe: новая бронь' : 'Urban Luxe: сообщение гостя', { body: first });
        } catch (e) {}
      }).subscribe();
    } catch (e) { console.warn('realtime chat', e); }
    // страховка без realtime: раз в 60 с обновляем список, если вкладка чата открыта
    setInterval(function () { if (chatVisible() && typeof window.loadConversations === 'function') window.loadConversations(); }, 60000);
    // разрешение на системные уведомления — спрашиваем один раз по клику в админке
    try {
      if (window.Notification && Notification.permission === 'default') {
        document.addEventListener('click', function ask() { document.removeEventListener('click', ask); Notification.requestPermission().catch(function () {}); }, { once: true });
      }
    } catch (e) {}
  }

  // ---------- старт ----------
  var n = 0, iv = setInterval(function () {
    var a = wrapOpen(), b = wrapSend();
    if (client()) subscribeAll();
    if ((a || window.openConversation && window.openConversation.__ul) && (b || window.adminSendMsg && window.adminSendMsg.__ul) && subscribeAll.done) clearInterval(iv);
    if (++n > 40) clearInterval(iv);
  }, 300);
  // карточки в уже открытом диалоге (если модуль загрузился позже)
  var mo = new MutationObserver(function () { styleCards(); });
  var m0 = 0, miv = setInterval(function () {
    var box = document.getElementById('adminChatMessages');
    if (box) { clearInterval(miv); mo.observe(box, { childList: true }); styleCards(); }
    else if (++m0 > 40) clearInterval(miv);
  }, 500);
})();
