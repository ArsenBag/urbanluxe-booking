/* Urban Luxe — «Аналитика+»: полноэкранная аналитика в админке.
   Тянет данные с Google-таблицы через /.netlify/functions/sheets-proxy?sheet=month.
   Показывает: KPI, помесячный P&L (выручка→расходы→прибыль, маржа, загрузка, рост),
   рейтинг прибыльности по квартирам, графики. Подключение в admin.html (одна строка):
     <script src="/analytics-pro.js" defer></script>  */
(function () {
  'use strict';
  var MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  function daysIn(label, year) {
    var mi = MONTHS_RU.indexOf(label); var y = parseInt(year, 10) || 2026;
    if (mi < 0) return 30;
    return new Date(y, mi + 1, 0).getDate();
  }
  var fmt = function (n) { return (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('ru-RU'); };
  var pct = function (n) { return (n * 100).toFixed(1).replace('.', ',') + '%'; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };

  var DATA = null;

  function load() {
    return fetch('/.netlify/functions/sheets-proxy?sheet=month', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { DATA = d; return d; });
  }

  // Сводка по месяцам (только месяцы с выручкой)
  function monthlyRows() {
    if (!DATA || !DATA.summary) return [];
    var s = DATA.summary, out = [];
    DATA.months.forEach(function (m) {
      var L = m.label, rev = (s.total_revenue || {})[L] || 0;
      if (!rev) return;
      var active = (DATA.apartments || []).filter(function (a) { return a.monthly[L] && (a.monthly[L].revenue > 0 || a.monthly[L].occupancy > 0); });
      var apts = active.length;
      var nights = active.reduce(function (t, a) { return t + (a.monthly[L].occupancy || 0); }, 0);
      var di = daysIn(L, m.year);
      var rent = (s.rent || {})[L] || 0, comm = (s.commission || {})[L] || 0,
        exp = (s.expenses || {})[L] || 0, cln = (s.cleaning || {})[L] || 0,
        sal = (s.salary || {})[L] || 0, mkt = (s.marketing || {})[L] || 0,
        net = (s.net_profit || {})[L] || 0;
      out.push({
        label: L + ' ' + m.year, rev: rev, rent: rent, comm: comm, exp: exp, cleaning: cln, salary: sal, marketing: mkt,
        net: net, apts: apts, nights: nights, days: di,
        occ: apts && di ? nights / (apts * di) : 0,
        margin: rev ? net / rev : 0,
        adr: nights ? rev / nights : 0,
        revPerApt: apts ? rev / apts : 0
      });
    });
    return out;
  }

  // Рейтинг прибыльности по квартирам (сумма за все месяцы)
  function aptRows() {
    if (!DATA || !DATA.apartments) return [];
    return DATA.apartments.map(function (a) {
      var rev = 0, profit = 0, nights = 0, active = 0;
      for (var L in a.monthly) {
        var mm = a.monthly[L]; if (mm.revenue > 0) { rev += mm.revenue; profit += mm.profit; nights += mm.occupancy; active++; }
      }
      var name = a.name.replace(/\s*\/?\s*Бронь.*/i, '').replace(/\s*\d+\$.*$/, '').trim() || a.name;
      return { name: name, rev: rev, profit: profit, nights: nights, active: active, margin: rev ? profit / rev : 0 };
    }).filter(function (a) { return a.rev > 0; }).sort(function (a, b) { return b.profit - a.profit; });
  }

  // ---- SVG столбчатый график ----
  function svgBars(series, opts) {
    opts = opts || {};
    var W = 760, H = 220, pad = 34, n = series.length;
    var max = Math.max.apply(null, series.map(function (s) { return s.value; }).concat([1]));
    var min = Math.min.apply(null, series.map(function (s) { return s.value; }).concat([0]));
    var bw = (W - pad * 2) / n * 0.6, gap = (W - pad * 2) / n;
    var base = H - pad, scale = (H - pad * 2) / (max - (min < 0 ? min : 0) || 1);
    var zeroY = base + (min < 0 ? min * scale : 0);
    var bars = series.map(function (s, i) {
      var x = pad + i * gap + (gap - bw) / 2;
      var h = Math.abs(s.value) * scale;
      var y = s.value >= 0 ? zeroY - h : zeroY;
      var col = s.color || (s.value >= 0 ? '#3b82f6' : '#ef4444');
      return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(h, 1).toFixed(1) + '" rx="3" fill="' + col + '"/>' +
        '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (s.value >= 0 ? y - 4 : y + h + 12).toFixed(1) + '" font-size="10" fill="#cbd5e1" text-anchor="middle">' + esc(s.top || '') + '</text>' +
        '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 8) + '" font-size="10" fill="#94a3b8" text-anchor="middle">' + esc(s.label) + '</text>';
    }).join('');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto">' +
      '<line x1="' + pad + '" y1="' + zeroY.toFixed(1) + '" x2="' + (W - pad) + '" y2="' + zeroY.toFixed(1) + '" stroke="#334155"/>' + bars + '</svg>';
  }

  function kpi(label, value, sub) {
    return '<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:14px 16px;min-width:150px;flex:1">' +
      '<div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">' + esc(label) + '</div>' +
      '<div style="font-size:22px;font-weight:700;color:#f1f5f9;margin-top:4px">' + esc(value) + '</div>' +
      (sub ? '<div style="font-size:11px;color:#64748b;margin-top:2px">' + esc(sub) + '</div>' : '') + '</div>';
  }

  function render() {
    var rows = monthlyRows(), apts = aptRows();
    var totRev = rows.reduce(function (a, r) { return a + r.rev; }, 0);
    var totNet = rows.reduce(function (a, r) { return a + r.net; }, 0);
    var avgOcc = rows.length ? rows.reduce(function (a, r) { return a + r.occ; }, 0) / rows.length : 0;
    var avgMargin = totRev ? totNet / totRev : 0;
    var last = rows[rows.length - 1] || {};
    var best = apts[0], worst = apts[apts.length - 1];

    var html = '';
    // KPI
    html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px">' +
      kpi('Выручка (период)', fmt(totRev)) +
      kpi('Чистая прибыль', fmt(totNet), 'маржа ' + pct(avgMargin)) +
      kpi('Ср. загрузка', pct(avgOcc)) +
      kpi('Квартир (посл. мес.)', String(last.apts || 0)) +
      kpi('Лучшая по прибыли', best ? best.name : '—', best ? fmt(best.profit) : '') +
      '</div>';

    // Charts
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px">';
    html += '<div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:14px"><div style="color:#e2e8f0;font-weight:600;margin-bottom:6px">Выручка и чистая прибыль по месяцам</div>' +
      svgBars(rows.map(function (r) { return { label: r.label.split(' ')[0].slice(0, 3), value: r.rev, top: '$' + Math.round(r.rev / 1000) + 'k', color: '#3b82f6' }; })) +
      svgBars(rows.map(function (r) { return { label: r.label.split(' ')[0].slice(0, 3), value: r.net, top: '$' + Math.round(r.net / 1000) + 'k', color: '#22c55e' }; })) + '</div>';
    html += '<div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:14px"><div style="color:#e2e8f0;font-weight:600;margin-bottom:6px">Загрузка по месяцам</div>' +
      svgBars(rows.map(function (r) { return { label: r.label.split(' ')[0].slice(0, 3), value: Math.round(r.occ * 100), top: Math.round(r.occ * 100) + '%', color: '#f59e0b' }; })) + '</div>';
    html += '</div>';

    // Monthly P&L table
    var th = function (t) { return '<th style="padding:8px 10px;text-align:right;color:#94a3b8;font-size:11px;text-transform:uppercase;border-bottom:1px solid #334155;white-space:nowrap">' + t + '</th>'; };
    html += '<div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:14px;margin-bottom:18px;overflow-x:auto">' +
      '<div style="color:#e2e8f0;font-weight:600;margin-bottom:8px">P&L по месяцам</div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px;color:#e2e8f0"><thead><tr>' +
      '<th style="padding:8px 10px;text-align:left;color:#94a3b8;font-size:11px;text-transform:uppercase;border-bottom:1px solid #334155">Месяц</th>' +
      th('Кв.') + th('Загрузка') + th('Выручка') + th('Аренда') + th('Комиссия') + th('Расходы') + th('Клининг') + th('Зарплата') + th('Маркетинг') + th('Чистыми') + th('Маржа') + th('Рост м/м') + '</tr></thead><tbody>';
    rows.forEach(function (r, i) {
      var growth = i === 0 ? '' : (function () { var p = rows[i - 1].rev; return p ? pct((r.rev - p) / p) : ''; })();
      var gcol = growth.indexOf('-') === 0 ? '#ef4444' : '#22c55e';
      var td = function (v, col) { return '<td style="padding:7px 10px;text-align:right;white-space:nowrap' + (col ? ';color:' + col : '') + '">' + v + '</td>'; };
      html += '<tr style="border-bottom:1px solid #1e293b">' +
        '<td style="padding:7px 10px;font-weight:600">' + esc(r.label) + '</td>' +
        td(r.apts) + td(pct(r.occ), r.occ >= 0.85 ? '#22c55e' : r.occ >= 0.7 ? '#f59e0b' : '#ef4444') +
        td(fmt(r.rev)) + td(fmt(r.rent)) + td(fmt(r.comm)) + td(fmt(r.exp)) + td(fmt(r.cleaning)) + td(fmt(r.salary)) + td(fmt(r.marketing)) +
        td('<b>' + fmt(r.net) + '</b>', r.net >= 0 ? '#22c55e' : '#ef4444') + td(pct(r.margin)) + td(growth, gcol) + '</tr>';
    });
    html += '</tbody></table></div>';

    // Per-apartment profitability
    html += '<div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:14px;overflow-x:auto">' +
      '<div style="color:#e2e8f0;font-weight:600;margin-bottom:8px">Прибыльность по квартирам (за период)</div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px;color:#e2e8f0"><thead><tr>' +
      '<th style="padding:8px 10px;text-align:left;color:#94a3b8;font-size:11px;text-transform:uppercase;border-bottom:1px solid #334155">#</th>' +
      '<th style="padding:8px 10px;text-align:left;color:#94a3b8;font-size:11px;text-transform:uppercase;border-bottom:1px solid #334155">Квартира</th>' +
      th('Выручка') + th('Прибыль') + th('Маржа') + th('Ночей') + th('Мес. в работе') + '</tr></thead><tbody>';
    apts.forEach(function (a, i) {
      var td = function (v, col) { return '<td style="padding:7px 10px;text-align:right;white-space:nowrap' + (col ? ';color:' + col : '') + '">' + v + '</td>'; };
      html += '<tr style="border-bottom:1px solid #1e293b">' +
        '<td style="padding:7px 10px;color:#64748b">' + (i + 1) + '</td>' +
        '<td style="padding:7px 10px">' + esc(a.name) + '</td>' +
        td(fmt(a.rev)) + td('<b>' + fmt(a.profit) + '</b>', a.profit >= 0 ? '#22c55e' : '#ef4444') + td(pct(a.margin)) + td(a.nights) + td(a.active) + '</tr>';
    });
    html += '</tbody></table>' +
      '<div style="font-size:11px;color:#64748b;margin-top:8px">Источник: Google-таблица «Юнит экономика квартир», вкладка «Месяц». Данные подгружаются автоматически. Загрузка = ночи / (активные квартиры × дни месяца).</div>' +
      '</div>';

    return html;
  }

  // ---- Оверлей и пункт меню ----
  function openOverlay() {
    var ov = document.getElementById('ul-apro-overlay');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'ul-apro-overlay';
      ov.style.cssText = 'position:fixed;inset:0;background:#020617;z-index:99999;overflow:auto;padding:20px 24px;font-family:Arial,system-ui,sans-serif';
      document.body.appendChild(ov);
    }
    ov.style.display = 'block';
    ov.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<div style="font-size:20px;font-weight:700;color:#f8fafc">📊 Аналитика+ <span style="font-size:13px;color:#64748b;font-weight:400">— сезонность, P&L, прибыльность</span></div>' +
      '<button id="ul-apro-close" style="background:#1e293b;color:#f1f5f9;border:1px solid #334155;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:14px">✕ Закрыть</button></div>' +
      '<div id="ul-apro-body" style="color:#94a3b8">Загрузка данных с таблицы…</div>';
    document.getElementById('ul-apro-close').onclick = function () { ov.style.display = 'none'; };
    var body = document.getElementById('ul-apro-body');
    var go = function () { try { body.innerHTML = render(); } catch (e) { body.innerHTML = '<div style="color:#ef4444">Ошибка отрисовки: ' + esc(e.message) + '</div>'; } };
    if (DATA) go(); else load().then(go).catch(function (e) { body.innerHTML = '<div style="color:#ef4444">Не удалось загрузить данные: ' + esc(e.message) + '</div>'; });
  }

  function addNav() {
    if (document.getElementById('ul-apro-nav')) return;
    // ищем сайдбар-навигацию по пункту «Аналитика»
    var ref = [...document.querySelectorAll('a,button,li,div,span')].find(function (e) {
      return e.textContent.trim() === 'Аналитика' && e.children.length <= 1 && e.offsetParent !== null;
    });
    if (!ref) return;
    var item = ref.cloneNode(true);
    item.id = 'ul-apro-nav';
    item.textContent = '📊 Аналитика+';
    item.removeAttribute('onclick');
    item.style.cursor = 'pointer';
    item.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openOverlay(); });
    ref.parentElement.insertBefore(item, ref.nextSibling);
  }

  function init() { addNav(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  var tries = 0, t = setInterval(function () { addNav(); if (document.getElementById('ul-apro-nav') || ++tries > 40) clearInterval(t); }, 300);

  /* ---- Фикс «Топ-5 по загрузке» / «Наименее загруженные» на вкладке «Аналитика» ----
     Родной код рендерит их только при данных за ТЕКУЩИЙ месяц; если месяц в таблице
     ещё не заполнен — блоки вечно висят «Загрузка...». Дорисовываем данными за
     последний заполненный месяц с подписью. admin.html не трогаем. */
  function fixTop5() {
    var top = document.getElementById('bizTop5'), bot = document.getElementById('bizBottom5');
    if (!top || top.textContent.indexOf('Загрузка') < 0) return;
    fetch('/.netlify/functions/sheets-proxy?sheet=month').then(function (r) { return r.json(); }).then(function (d) {
      var months = d.months || [], rev = (d.summary || {}).total_revenue || {};
      var last = null;
      months.forEach(function (m) {
        var v = rev[m.label + ' ' + m.year];
        if (v === undefined) v = rev[m.label];
        if (v > 0) last = m;
      });
      if (!last) return;
      var dim = daysIn(last.label, last.year);
      var stats = (d.apartments || []).map(function (a) {
        var md = (a.monthly || {})[last.label] || {};
        var nights = md.occupancy || 0;
        return {
          name: String(a.name || '').replace(/\/\s*Бронь.*$/i, '').replace(/-?\s*\d+\$\s*$/, '').trim(),
          pct: Math.min(100, Math.round(nights / dim * 100)),
          revenue: md.revenue || 0
        };
      }).filter(function (s) { return s.pct > 0 || s.revenue > 0; });
      if (!stats.length) {
        var em = '<div style="color:#64748b;font-size:13px;padding:14px">Нет данных за ' + last.label + '</div>';
        top.innerHTML = em; if (bot) bot.innerHTML = em;
        return;
      }
      stats.sort(function (a, b) { return b.pct - a.pct; });
      function rows(list) {
        return '<div style="color:#64748b;font-size:11px;padding:4px 0 8px">данные за ' + last.label + ' ' + last.year + '</div>' +
          list.map(function (s) {
            return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px">' +
              '<span style="color:#e2e8f0">' + s.name + '</span>' +
              '<span><span style="color:#94a3b8;margin-right:12px">' + fmt(s.revenue) + '</span>' +
              '<b style="color:' + (s.pct >= 80 ? '#22c55e' : s.pct >= 50 ? '#f59e0b' : '#ef4444') + '">' + s.pct + '%</b></span></div>';
          }).join('');
      }
      top.innerHTML = rows(stats.slice(0, 5));
      if (bot) bot.innerHTML = rows(stats.slice(-5).reverse());
    }).catch(function () {});
  }
  setInterval(fixTop5, 2500);
})();
