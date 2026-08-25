/* Urban Luxe — admin-rent.js: пункт «🏠 Аренда» в админке.
   График оплат аренды из вкладок « АРЕНДА» обеих Google-книг (своя + партнёрская 50/50):
   сумма, день выплаты, статус текущего месяца (оплачено / ожидается / просрочено),
   ближайшие платежи. Отметки об оплате ставятся в самой таблице (чекбоксы) — тут просмотр.
   Подключение в admin.html (рядом с ops-center.js):
     <script src="/admin-rent.js" defer></script> */
(function () {
  'use strict';
  var MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function fmt(n) { return '$' + Math.round(n).toLocaleString('ru-RU'); }

  function curLabel() {
    var d = new Date(Date.now() + 5 * 3600 * 1000);
    return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }
  function today() { return new Date(Date.now() + 5 * 3600 * 1000).getUTCDate(); }

  function status(item, label) {
    var paid = item.paid[label];
    if (paid === true) return { t: 'Оплачено ✓', c: '#22c55e', ord: 2 };
    var d = today();
    if (item.pay_day == null) return { t: '—', c: '#64748b', ord: 3 };
    if (item.pay_day < d) return { t: 'Просрочено · ' + item.pay_day + '-е', c: '#ef4444', ord: 0 };
    if (item.pay_day - d <= 5) return { t: 'Скоро · ' + item.pay_day + '-е', c: '#f59e0b', ord: 1 };
    return { t: 'До ' + item.pay_day + '-го', c: '#94a3b8', ord: 1.5 };
  }

  function table(title, data, label, partner) {
    var items = (data.items || []).slice();
    items.forEach(function (it) { it.__s = status(it, label); });
    items.sort(function (a, b) { return a.__s.ord - b.__s.ord || (a.pay_day || 99) - (b.pay_day || 99); });
    var unpaid = items.filter(function (i) { return i.paid[label] !== true; });
    var unpaidSum = unpaid.reduce(function (s, i) { return s + (i.rent || 0); }, 0);
    var rows = items.map(function (it) {
      return '<tr style="border-bottom:1px solid #1e293b">' +
        '<td style="padding:7px 10px;color:#e2e8f0;font-weight:600">' + esc(it.name) + '</td>' +
        '<td style="padding:7px 10px;color:#e2e8f0">' + fmt(it.rent) + (partner ? ' <span style="color:#64748b;font-size:11px">50/50</span>' : '') + '</td>' +
        '<td style="padding:7px 10px;text-align:center;color:#94a3b8">' + (it.pay_day || '—') + '</td>' +
        '<td style="padding:7px 10px"><span style="color:' + it.__s.c + '">' + it.__s.t + '</span></td></tr>';
    }).join('');
    return '<div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:14px;margin-bottom:16px;overflow-x:auto">' +
      '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px">' +
      '<span style="color:#e2e8f0;font-weight:600">' + title + '</span>' +
      '<span style="color:#94a3b8;font-size:13px">Всего/мес: <b style="color:#c9a96e">' + fmt(data.total_monthly || 0) + '</b>' +
      ' · Не оплачено (' + esc(label.split(' ')[0]) + '): <b style="color:' + (unpaidSum ? '#ef4444' : '#22c55e') + '">' + fmt(unpaidSum) + '</b></span></div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr>' +
      ['Объект', 'Аренда', 'День', 'Статус ' + esc(label.split(' ')[0])].map(function (h) {
        return '<th style="padding:8px 10px;text-align:left;color:#94a3b8;font-size:11px;text-transform:uppercase;border-bottom:1px solid #334155">' + h + '</th>';
      }).join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function openOverlay() {
    var ov = document.getElementById('ulrent-ov');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'ulrent-ov';
      ov.style.cssText = 'position:fixed;inset:0;background:#020617;z-index:99999;overflow:auto;padding:20px 24px;font-family:Arial,system-ui,sans-serif';
      document.body.appendChild(ov);
    }
    ov.style.display = 'block';
    ov.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<div style="font-size:20px;font-weight:700;color:#f8fafc">🏠 Аренда — график оплат <span style="font-size:12px;color:#64748b;font-weight:400">отметки об оплате — чекбоксы в Google-таблице</span></div>' +
      '<button id="ulrent-close" style="background:#1e293b;color:#f1f5f9;border:1px solid #334155;border-radius:8px;padding:8px 16px;cursor:pointer">✕ Закрыть</button></div>' +
      '<div id="ulrent-body" style="color:#94a3b8">Загрузка…</div>';
    document.getElementById('ulrent-close').onclick = function () { ov.style.display = 'none'; };
    var label = curLabel();
    fetch('/.netlify/functions/sheets-proxy?sheet=rent_all')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var own = d.own || { items: [], total_monthly: 0 };
        var pt = d.partner || { items: [], total_monthly: 0 };
        // если в таблице заголовок месяца без года или с годом — подберём подходящий ключ
        function pickLabel(data) {
          if (!data.months || !data.months.length) return label;
          var short = label.split(' ')[0];
          return data.months.filter(function (m) { return m.indexOf(short) === 0; })[0] || data.months[data.months.length - 1];
        }
        var html = '';
        html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">';
        [['Свои квартиры', own.total_monthly], ['Партнёрские (50/50)', pt.total_monthly], ['Итого в месяц', (own.total_monthly || 0) + (pt.total_monthly || 0)]].forEach(function (k) {
          html += '<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:12px 16px;flex:1;min-width:150px">' +
            '<div style="font-size:11px;color:#94a3b8;text-transform:uppercase">' + k[0] + '</div>' +
            '<div style="font-size:24px;font-weight:700;color:#c9a96e;margin-top:2px">' + fmt(k[1] || 0) + '</div></div>';
        });
        html += '</div>';
        html += table('Свои квартиры', own, pickLabel(own), false);
        html += table('🤝 Партнёрские квартиры', pt, pickLabel(pt), true);
        document.getElementById('ulrent-body').innerHTML = html;
      })
      .catch(function (e) {
        document.getElementById('ulrent-body').innerHTML = '<span style="color:#ef4444">Не удалось загрузить: ' + esc(e.message) + '</span>';
      });
  }

  function addNav() {
    if (document.getElementById('ulrent-nav')) return;
    var ref = [].slice.call(document.querySelectorAll('a,button,li,div,span')).filter(function (e) {
      return e.textContent.trim() === 'Дашборд' && e.children.length <= 1 && e.offsetParent !== null;
    })[0];
    if (!ref) return;
    var item = ref.cloneNode(true);
    item.id = 'ulrent-nav'; item.textContent = '🏠 Аренда'; item.removeAttribute('onclick'); item.style.cursor = 'pointer';
    item.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openOverlay(); });
    ref.parentElement.insertBefore(item, ref.nextSibling);
  }
  function init() { addNav(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  var tries = 0, t = setInterval(function () { addNav(); if (document.getElementById('ulrent-nav') || ++tries > 40) clearInterval(t); }, 300);
})();
