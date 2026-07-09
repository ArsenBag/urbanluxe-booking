/* Urban Luxe — «🗓 Операции дня»: центр ежедневных операций в админке.
   Тянет брони с /.netlify/functions/sync-ical (RealtyCalendar) + имена квартир из _allApts.
   Показывает: заезды/выезды сегодня, квартиры на уборку, турноверы (выезд+заезд в один день),
   ближайшие заезды (7 дней), свободные сегодня, загрузку. Подключение в admin.html:
     <script src="/ops-center.js" defer></script>  */
(function () {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };
  function aptMap() {
    var m = {};
    (window._allApts || []).forEach(function (a) { m[a.id] = a; });
    return m;
  }
  function aptName(id, M) { var a = M[id]; return a ? (a.name + (a.complex ? ' · ' + a.complex : '')) : id; }
  function ddmm(s) { if (!s) return ''; var p = s.split('-'); return p.length === 3 ? p[2] + '.' + p[1] : s; }
  function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

  var DATA = null;
  function load() {
    return fetch('/.netlify/functions/sync-ical', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) { DATA = d; return d; });
  }

  function kpi(label, value, color) {
    return '<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:14px 16px;min-width:140px;flex:1">' +
      '<div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">' + esc(label) + '</div>' +
      '<div style="font-size:26px;font-weight:700;color:' + (color || '#f1f5f9') + ';margin-top:2px">' + esc(value) + '</div></div>';
  }
  function tableWrap(title, headCols, rowsHtml, emptyMsg) {
    var th = headCols.map(function (h) { return '<th style="padding:8px 10px;text-align:left;color:#94a3b8;font-size:11px;text-transform:uppercase;border-bottom:1px solid #334155;white-space:nowrap">' + h + '</th>'; }).join('');
    return '<div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:14px;margin-bottom:16px;overflow-x:auto">' +
      '<div style="color:#e2e8f0;font-weight:600;margin-bottom:8px">' + title + '</div>' +
      (rowsHtml ? '<table style="width:100%;border-collapse:collapse;font-size:13px;color:#e2e8f0"><thead><tr>' + th + '</tr></thead><tbody>' + rowsHtml + '</tbody></table>'
        : '<div style="color:#64748b;font-size:13px;padding:6px 0">' + (emptyMsg || 'Нет данных') + '</div>') + '</div>';
  }

  function render() {
    var M = aptMap();
    var today = (DATA.synced_at || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
    var checkins = DATA.checkins || [], checkouts = DATA.checkouts || [], all = DATA.all_bookings || [];
    var coApts = {}; checkouts.forEach(function (b) { coApts[b.apartment_id] = true; });
    var ciApts = {}; checkins.forEach(function (b) { ciApts[b.apartment_id] = true; });
    var turnovers = checkouts.filter(function (b) { return ciApts[b.apartment_id]; });

    var occupied = {}; all.forEach(function (b) { if (b.check_in <= today && b.check_out > today) occupied[b.apartment_id] = true; });
    var totalApts = (window._allApts || []).length || 25;
    var occCount = Object.keys(occupied).length;
    var freeList = (window._allApts || []).filter(function (a) { return !occupied[a.id]; });

    var upcoming = all.filter(function (b) { var d = daysBetween(today, b.check_in); return d > 0 && d <= 7; })
      .sort(function (a, b) { return a.check_in < b.check_in ? -1 : 1; });

    var html = '';
    // KPI
    html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px">' +
      kpi('Заезды сегодня', checkins.length, '#22c55e') +
      kpi('Выезды сегодня', checkouts.length, '#f59e0b') +
      kpi('Турноверы', turnovers.length, turnovers.length ? '#ef4444' : '#f1f5f9') +
      kpi('Занято / всего', occCount + ' / ' + totalApts) +
      kpi('Загрузка сегодня', Math.round(occCount / totalApts * 100) + '%', occCount / totalApts >= 0.85 ? '#22c55e' : '#f59e0b') +
      '</div>';

    // Заезды
    var ciRows = checkins.map(function (b) {
      var turn = coApts[b.apartment_id] ? ' <span style="background:#7f1d1d;color:#fecaca;font-size:10px;padding:1px 6px;border-radius:6px">турновер</span>' : '';
      return '<tr style="border-bottom:1px solid #1e293b"><td style="padding:7px 10px;font-weight:600">' + esc(aptName(b.apartment_id, M)) + turn + '</td>' +
        '<td style="padding:7px 10px">' + ddmm(b.check_in) + ' → ' + ddmm(b.check_out) + '</td>' +
        '<td style="padding:7px 10px;text-align:center">' + (b.nights || daysBetween(b.check_in, b.check_out)) + '</td>' +
        '<td style="padding:7px 10px;color:#94a3b8">' + esc(b.guest_name || '—') + '</td></tr>';
    }).join('');
    html += tableWrap('🟢 Заезды сегодня', ['Квартира', 'Даты', 'Ночей', 'Гость'], ciRows, 'Сегодня заездов нет');

    // Выезды / уборка
    var coRows = checkouts.map(function (b) {
      var turn = ciApts[b.apartment_id] ? ' <span style="background:#7f1d1d;color:#fecaca;font-size:10px;padding:1px 6px;border-radius:6px">заезд сегодня — срочная уборка</span>' : '';
      return '<tr style="border-bottom:1px solid #1e293b"><td style="padding:7px 10px;font-weight:600">' + esc(aptName(b.apartment_id, M)) + turn + '</td>' +
        '<td style="padding:7px 10px">выехал ' + ddmm(b.check_out) + '</td></tr>';
    }).join('');
    html += tableWrap('🧹 На уборку сегодня (выезды: ' + checkouts.length + ')', ['Квартира', 'Статус'], coRows, 'Сегодня выездов нет');

    // Ближайшие заезды
    var upRows = upcoming.map(function (b) {
      var d = daysBetween(today, b.check_in);
      return '<tr style="border-bottom:1px solid #1e293b"><td style="padding:7px 10px;font-weight:600">' + esc(aptName(b.apartment_id, M)) + '</td>' +
        '<td style="padding:7px 10px">' + ddmm(b.check_in) + ' <span style="color:#64748b">(через ' + d + ' дн.)</span></td>' +
        '<td style="padding:7px 10px">' + ddmm(b.check_in) + ' → ' + ddmm(b.check_out) + '</td>' +
        '<td style="padding:7px 10px;text-align:center">' + (b.nights || daysBetween(b.check_in, b.check_out)) + '</td></tr>';
    }).join('');
    html += tableWrap('📅 Ближайшие заезды (7 дней)', ['Квартира', 'Когда', 'Даты', 'Ночей'], upRows, 'В ближайшие 7 дней заездов нет');

    // Свободные сегодня
    var freeRows = freeList.length ? '<tr><td style="padding:7px 10px;color:#cbd5e1">' +
      freeList.map(function (a) { return esc(a.name + (a.complex ? ' (' + a.complex + ')' : '')); }).join(' · ') + '</td></tr>' : '';
    html += tableWrap('🔓 Свободно сегодня (' + freeList.length + ')', ['Квартиры'], freeRows, 'Все квартиры заняты');

    html += '<div style="font-size:11px;color:#64748b;margin-top:4px">Источник: RealtyCalendar (sync-ical). Обновлено: ' + esc((DATA.synced_at || '').replace('T', ' ').slice(0, 16)) + '. Всего активных броней: ' + (DATA.total_bookings || all.length) + '.</div>';
    return html;
  }

  function openOverlay() {
    var ov = document.getElementById('ul-ops-overlay');
    if (!ov) { ov = document.createElement('div'); ov.id = 'ul-ops-overlay'; ov.style.cssText = 'position:fixed;inset:0;background:#020617;z-index:99999;overflow:auto;padding:20px 24px;font-family:Arial,system-ui,sans-serif'; document.body.appendChild(ov); }
    ov.style.display = 'block';
    var todayStr = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    ov.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<div style="font-size:20px;font-weight:700;color:#f8fafc">🗓 Операции дня <span style="font-size:13px;color:#64748b;font-weight:400">— ' + esc(todayStr) + '</span></div>' +
      '<div><button id="ul-ops-refresh" style="background:#1e293b;color:#f1f5f9;border:1px solid #334155;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:14px;margin-right:8px">🔄 Обновить</button>' +
      '<button id="ul-ops-close" style="background:#1e293b;color:#f1f5f9;border:1px solid #334155;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:14px">✕ Закрыть</button></div></div>' +
      '<div id="ul-ops-body" style="color:#94a3b8">Загрузка операций…</div>';
    document.getElementById('ul-ops-close').onclick = function () { ov.style.display = 'none'; };
    var body = document.getElementById('ul-ops-body');
    var go = function () { try { body.innerHTML = render(); } catch (e) { body.innerHTML = '<div style="color:#ef4444">Ошибка: ' + esc(e.message) + '</div>'; } };
    var refresh = function () { body.innerHTML = 'Загрузка операций…'; load().then(go).catch(function (e) { body.innerHTML = '<div style="color:#ef4444">Не удалось загрузить: ' + esc(e.message) + '</div>'; }); };
    document.getElementById('ul-ops-refresh').onclick = refresh;
    if (DATA) go(); else refresh();
  }

  function addNav() {
    if (document.getElementById('ul-ops-nav')) return;
    var ref = [].slice.call(document.querySelectorAll('a,button,li,div,span')).filter(function (e) {
      return e.textContent.trim() === 'Дашборд' && e.children.length <= 1 && e.offsetParent !== null;
    })[0];
    if (!ref) return;
    var item = ref.cloneNode(true);
    item.id = 'ul-ops-nav'; item.textContent = '🗓 Операции дня'; item.removeAttribute('onclick'); item.style.cursor = 'pointer';
    item.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openOverlay(); });
    ref.parentElement.insertBefore(item, ref);
  }
  function init() { addNav(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  var tries = 0, t = setInterval(function () { addNav(); if (document.getElementById('ul-ops-nav') || ++tries > 40) clearInterval(t); }, 300);
})();
