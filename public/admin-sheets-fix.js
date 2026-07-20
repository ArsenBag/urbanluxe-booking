/* Urban Luxe — фикс загрузки Google Sheets в админке.
   1) loadWeeklySheets/loadAptSheets стучатся в Google gviz напрямую → CORS их режет.
      Перехватчик перенаправляет запросы к gviz нашей таблицы через sheets-proxy.
   2) Вкладка «Финансы»: в admin.html зашит диапазон сводки A128:G140 листа «Месяц»,
      но таблица выросла (квартир стало больше) и сводка съехала — в диапазоне теперь
      строки квартиры, парсер получает пустоту. Для этого запроса синтезируем CSV
      нужного формата из уже распарсенного sheets-proxy?sheet=month.
   admin.html не трогаем. Подключать РАНО (в <head>, до основного скрипта админки):
     <script src="/admin-sheets-fix.js"></script>  */
(function () {
  'use strict';
  if (window.__ulSheetsFix) return;
  window.__ulSheetsFix = true;
  var RE = /^https?:\/\/docs\.google\.com\/spreadsheets\/d\/[^/]+\/gviz\/tq\?(.*)$/i;
  var origFetch = window.fetch;

  // Сводка «Месяц» для вкладки «Финансы»: label + Декабрь..Май (формат parseSummaryCSV)
  function buildSummaryCSV() {
    return origFetch('/.netlify/functions/sheets-proxy?sheet=month')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var s = d.summary || {};
        var MONTHS = ['Декабрь', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май'];
        var ROWS = [
          ['Количество заселении', 'bookings_count'],
          ['Итого забронировали', 'total_revenue'],
          ['Аренда', 'rent'],
          ['Комиссия', 'commission'],
          ['Расходы', 'expenses'],
          ['Клининг', 'cleaning'],
          ['Зарплата', 'salary'],
          ['Маркетинг', 'marketing'],
          ['Чистыми', 'net_profit'],
          ['Доля маркетинга', 'marketing_share']
        ];
        var lines = ['"",' + MONTHS.map(function (m) { return '"' + m + '"'; }).join(',')];
        ROWS.forEach(function (row) {
          var vals = MONTHS.map(function (m) {
            var v = (s[row[1]] || {})[m];
            return '"' + (v == null ? '' : v) + '"';
          });
          lines.push('"' + row[0] + '",' + vals.join(','));
        });
        var csv = lines.join('\n');
        return new Response(csv, { status: 200, headers: { 'Content-Type': 'text/csv' } });
      });
  }

  window.fetch = function (input, init) {
    try {
      var url = (typeof input === 'string') ? input : (input && input.url) || '';
      var m = url.match(RE);
      if (m) {
        // Запрос сводки для «Финансов» (устаревший диапазон) → синтезируем CSV
        if (/range=A12[0-9]/.test(url) && /out[:%3A]csv/i.test(url)) {
          return buildSummaryCSV();
        }
        var proxied = '/.netlify/functions/sheets-proxy?gvizpass=1&' + m[1];
        return origFetch(proxied, init);
      }
    } catch (e) {}
    return origFetch.apply(this, arguments);
  };
})();
