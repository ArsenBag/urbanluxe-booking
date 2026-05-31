/* Urban Luxe — фикс загрузки Google Sheets в админке.
   loadWeeklySheets и loadAptSheets стучатся в Google gviz напрямую → CORS их режет.
   Этот перехватчик перенаправляет любой запрос к gviz нашей таблицы через свой
   sheets-proxy (тот же origin → CORS нет, тело — тот же CSV). admin.html не трогаем.
   Подключать РАНО (в <head>, до основного скрипта админки):
     <script src="/admin-sheets-fix.js"></script>  */
(function () {
  'use strict';
  if (window.__ulSheetsFix) return;
  window.__ulSheetsFix = true;
  var RE = /^https?:\/\/docs\.google\.com\/spreadsheets\/d\/[^/]+\/gviz\/tq\?(.*)$/i;
  var origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      var url = (typeof input === 'string') ? input : (input && input.url) || '';
      var m = url.match(RE);
      if (m) {
        var proxied = '/.netlify/functions/sheets-proxy?gvizpass=1&' + m[1];
        return origFetch(proxied, init);
      }
    } catch (e) {}
    return origFetch.apply(this, arguments);
  };
})();
