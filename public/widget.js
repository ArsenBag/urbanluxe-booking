/* Urban Luxe PMS — виджет бронирования для сайтов партнёров (16.10.2026).
   <script src="https://urbanluxe.cc/widget.js" data-key="pk_live_…" [data-target="#id"] [data-lang="ru|en"] [data-apartments="id1,id2"]></script>
   Работает поверх публичного API /api/v1 с публичным ключом: свободно на даты → цена → заявка (status=request). Стили с префиксом ulw-. */
(function () {
  var S = document.currentScript; if (!S) return;
  var KEY = S.getAttribute('data-key'); if (!KEY) { console.error('[urbanluxe widget] data-key required'); return; }
  var BASE = (S.getAttribute('data-base') || S.src.replace(/\/widget\.js.*$/, '')) + '/api/v1';
  var LANG = (S.getAttribute('data-lang') || 'ru').slice(0, 2);
  var ONLY = (S.getAttribute('data-apartments') || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  var target = S.getAttribute('data-target') ? document.querySelector(S.getAttribute('data-target')) : null;
  var root = document.createElement('div'); root.className = 'ulw';
  if (target) target.appendChild(root); else S.parentNode.insertBefore(root, S.nextSibling);
  var T = {
    ru: { ci: 'Заезд', co: 'Выезд', g: 'Гостей', show: 'Показать', loading: 'Проверяю занятость…', none: 'На эти даты всё занято — попробуйте другие даты', night: 'ночь', nights2: 'ночи', nights5: 'ночей', total: 'за', book: 'Забронировать', name: 'Имя', phone: 'Телефон', msg: 'Telegram или WhatsApp', notes: 'Пожелания', send: 'Отправить заявку', sending: 'Отправляю…', ok: 'Заявка принята! Менеджер свяжется с вами для подтверждения.', err: 'Не получилось отправить: ', taken: 'Даты уже заняты, выберите другие', upto: 'до', guests: 'гостей', floor: 'этаж', noPrepay: 'Без предоплаты', back: 'Назад' },
    en: { ci: 'Check-in', co: 'Check-out', g: 'Guests', show: 'Search', loading: 'Checking availability…', none: 'Nothing available for these dates — try other dates', night: 'night', nights2: 'nights', nights5: 'nights', total: 'for', book: 'Book', name: 'Name', phone: 'Phone', msg: 'Telegram or WhatsApp', notes: 'Notes', send: 'Send request', sending: 'Sending…', ok: 'Request received! Our manager will contact you to confirm.', err: 'Could not send: ', taken: 'These dates are already taken, please choose others', upto: 'up to', guests: 'guests', floor: 'floor', noPrepay: 'No prepayment', back: 'Back' }
  };
  T = T[LANG] || T.ru;
  function tr(k) { return (T[k] !== undefined ? T[k] : k); }
  var css = '.ulw{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;max-width:760px;margin:0 auto;font-size:15px}.ulw *{box-sizing:border-box}.ulw-row{display:grid;grid-template-columns:1fr 1fr 90px auto;gap:8px;align-items:end}.ulw label{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#777;margin-bottom:4px}.ulw input,.ulw select,.ulw textarea{width:100%;padding:10px 12px;border:1px solid #d8dce2;border-radius:8px;font-size:15px;font-family:inherit;background:#fff}.ulw button{background:#1a1a1a;color:#fff;border:0;padding:11px 18px;border-radius:8px;font-size:14px;cursor:pointer;font-family:inherit}.ulw button.ulw-ghost{background:#fff;color:#1a1a1a;border:1px solid #d8dce2}.ulw button:disabled{opacity:.5}.ulw-st{font-size:13px;color:#777;margin:10px 0}.ulw-card{display:grid;grid-template-columns:180px 1fr;gap:14px;border:1px solid #e6e8ec;border-radius:12px;overflow:hidden;margin:12px 0;background:#fff}.ulw-ph{aspect-ratio:4/3;background:#f2f3f5;overflow:hidden}.ulw-ph img{width:100%;height:100%;object-fit:cover;display:block}.ulw-bd{padding:12px 14px 12px 0}.ulw-nm{font-weight:600;font-size:16px}.ulw-meta{font-size:13px;color:#777;margin:2px 0 8px}.ulw-pr{font-size:18px;font-weight:600}.ulw-pr span{font-size:13px;color:#777;font-weight:400}.ulw-f{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.ulw-f .w{grid-column:1/3}.ulw-ok{color:#1a7f37;font-weight:500;margin-top:8px}.ulw-er{color:#c0392b;font-size:13px;margin-top:8px}@media(max-width:560px){.ulw-row{grid-template-columns:1fr 1fr}.ulw-row button{grid-column:1/-1}.ulw-card{grid-template-columns:1fr}.ulw-bd{padding:0 14px 14px}.ulw-f{grid-template-columns:1fr}.ulw-f .w{grid-column:1}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  function api(path, opt) { opt = opt || {}; return fetch(BASE + path, { method: opt.method || 'GET', headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: opt.body ? JSON.stringify(opt.body) : undefined }).then(function (r) { return r.json().then(function (j) { if (!j.ok) { var e = new Error(j.error && j.error.message || r.status); e.code = j.error && j.error.code; throw e; } return j.data; }); }); }
  function pl(n) { var m10 = n % 10, m100 = n % 100; return n + ' ' + (m10 === 1 && m100 !== 11 ? tr('night') : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? tr('nights2') : tr('nights5')); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function iso(d) { return d.toISOString().slice(0, 10); }
  var today = new Date(); var d1 = iso(today), d2 = iso(new Date(today.getTime() + 864e5));
  root.innerHTML = '<div class="ulw-row"><div><label>' + tr('ci') + '</label><input type="date" class="ulw-ci" value="' + d1 + '" min="' + d1 + '"></div><div><label>' + tr('co') + '</label><input type="date" class="ulw-co" value="' + d2 + '" min="' + d2 + '"></div><div><label>' + tr('g') + '</label><input type="number" class="ulw-g" value="2" min="1" max="10"></div><button class="ulw-go">' + tr('show') + '</button></div><div class="ulw-st"></div><div class="ulw-list"></div>';
  var ci = root.querySelector('.ulw-ci'), co = root.querySelector('.ulw-co'), g = root.querySelector('.ulw-g'), stEl = root.querySelector('.ulw-st'), list = root.querySelector('.ulw-list');
  ci.onchange = function () { if (co.value <= ci.value) co.value = iso(new Date(new Date(ci.value).getTime() + 864e5)); co.min = iso(new Date(new Date(ci.value).getTime() + 864e5)); };
  var APTS = null;
  function search() {
    var a = ci.value, b = co.value; if (!a || !b || b <= a) return;
    stEl.textContent = tr('loading'); list.innerHTML = '';
    var pA = APTS ? Promise.resolve(APTS) : api('/apartments').then(function (x) { APTS = x; return x; });
    Promise.all([pA, api('/availability?from=' + a + '&to=' + b)]).then(function (r) {
      var apts = r[0].filter(function (x) { return (!ONLY.length || ONLY.indexOf(x.id) > -1) && r[1].free.indexOf(x.id) > -1 && (!x.max_guests || x.max_guests >= Number(g.value || 1)); });
      if (!apts.length) { stEl.textContent = tr('none'); return; }
      var n = Math.round((new Date(b) - new Date(a)) / 864e5); stEl.textContent = '';
      list.innerHTML = apts.map(function (x) { var d = r[1].days[x.id] || {}; var sum = 0, k = 0; for (var key in d) { sum += Number(d[key].price || 0); k++; } return '<div class="ulw-card" data-id="' + esc(x.id) + '"><div class="ulw-ph">' + (x.photos[0] ? '<img src="' + esc(x.photos[0]) + '" alt="" loading="lazy">' : '') + '</div><div class="ulw-bd"><div class="ulw-nm">' + esc(x.name) + '</div><div class="ulw-meta">' + esc(x.complex || '') + (x.floor ? ' · ' + x.floor + ' ' + tr('floor') : '') + (x.rooms ? ' · ' + esc(x.rooms) : '') + (x.max_guests ? ' · ' + tr('upto') + ' ' + x.max_guests + ' ' + tr('guests') : '') + '</div><div class="ulw-pr" data-p="' + esc(x.id) + '">$' + Math.round(sum) + ' <span>' + tr('total') + ' ' + pl(n) + '</span></div><div style="margin-top:10px"><button class="ulw-book">' + tr('book') + '</button> <span style="font-size:12px;color:#777">' + tr('noPrepay') + '</span></div><div class="ulw-form"></div></div></div>'; }).join('');
      apts.forEach(function (x) { api('/price?apartment_id=' + encodeURIComponent(x.id) + '&check_in=' + a + '&check_out=' + b + '&guests=' + (g.value || 1)).then(function (p) { var el = list.querySelector('[data-p="' + x.id + '"]'); if (el && p.total) el.innerHTML = '$' + Math.round(p.total) + ' <span>' + tr('total') + ' ' + pl(p.nights) + (p.discount_label ? ' · ' + esc(p.discount_label) : '') + '</span>'; }).catch(function () { }); });
      Array.prototype.forEach.call(list.querySelectorAll('.ulw-card'), function (card) {
        card.querySelector('.ulw-book').onclick = function () {
          var f = card.querySelector('.ulw-form'); if (f.innerHTML) { f.innerHTML = ''; return; }
          f.innerHTML = '<div class="ulw-f"><div><label>' + tr('name') + '</label><input class="ulw-n" required></div><div><label>' + tr('phone') + '</label><input class="ulw-p" type="tel" required></div><div class="w"><label>' + tr('msg') + '</label><input class="ulw-m"></div><div class="w"><label>' + tr('notes') + '</label><input class="ulw-t"></div><div class="w"><button class="ulw-send">' + tr('send') + '</button></div><div class="w ulw-res"></div></div>';
          f.querySelector('.ulw-send').onclick = function () {
            var btn = this, res = f.querySelector('.ulw-res'); var name = f.querySelector('.ulw-n').value.trim(), phone = f.querySelector('.ulw-p').value.trim();
            if (!name || !phone) { res.className = 'w ulw-res ulw-er'; res.textContent = tr('name') + ' / ' + tr('phone'); return; }
            btn.disabled = true; btn.textContent = tr('sending');
            api('/bookings', { method: 'POST', body: { apartment_id: card.getAttribute('data-id'), check_in: a, check_out: b, guests_count: Number(g.value || 1), status: 'request', guest: { name: name, phone: phone, telegram: f.querySelector('.ulw-m').value.trim() || null }, notes: f.querySelector('.ulw-t').value.trim() || null, external_ref: 'widget:' + location.hostname } })
              .then(function (bk) { f.innerHTML = '<div class="ulw-ok">' + tr('ok') + (bk.ref ? ' № ' + esc(bk.ref) : '') + '</div>'; })
              .catch(function (e) { res.className = 'w ulw-res ulw-er'; res.textContent = (e.code === 'dates_taken' ? tr('taken') : tr('err') + e.message); btn.disabled = false; btn.textContent = tr('send'); });
          };
        };
      });
    }).catch(function (e) { stEl.textContent = tr('err') + e.message; });
  }
  root.querySelector('.ulw-go').onclick = search;
})();
