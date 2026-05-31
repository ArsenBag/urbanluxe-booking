const https = require('https');

// Google Sheets ID — таблица "Юнит экономика квартир"
const SHEET_ID = '1NHqPZV8Dx2dKmfTCpb8LcdA4AtuqSfKyyyWs5UF2HtY';

function fetchCSV(sheetName) {
  const encoded = encodeURIComponent(sheetName);
  return fetchUrl(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encoded}`);
}

// Сырой GET с обработкой редиректа Google — возвращает тело как есть
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, { timeout: 15000 }, (res2) => {
          let data = '';
          res2.on('data', chunk => data += chunk);
          res2.on('end', () => resolve(data));
        }).on('error', reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseCSVSimple(csv) {
  const result = [];
  const lines = csv.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        row.push(cell.trim());
        cell = '';
      } else if (ch === '\r') {
        // skip
      } else {
        cell += ch;
      }
    }
    row.push(cell.trim());
    result.push(row);
  }
  return result;
}

function parseNumber(str) {
  if (!str) return 0;
  const cleaned = str.replace(/[$%\s   ]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseMonthlyData(rows) {
  if (rows.length < 3) return null;

  const yearRow = rows[0] || [];
  const headerRow = rows[1] || [];

  const MONTH_NAMES = ['Декабрь','Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

  const months = [];
  let foundMonths = false;

  for (let i = 1; i < headerRow.length; i++) {
    if (headerRow[i] && headerRow[i].length > 2) { foundMonths = true; break; }
  }

  if (foundMonths) {
    for (let i = 1; i < headerRow.length; i++) {
      if (headerRow[i]) months.push({ label: headerRow[i], year: yearRow[i] || '2026', index: i });
    }
  } else {
    let monthIdx = 0;
    let prevYear = '';
    for (let i = 1; i < yearRow.length; i++) {
      const year = yearRow[i]?.trim();
      if (!year) continue;
      if (year !== prevYear) {
        if (year === '2025') monthIdx = 12;
        else monthIdx = 1;
        prevYear = year;
      }
      if (monthIdx >= 1 && monthIdx <= 12) months.push({ label: MONTH_NAMES[monthIdx], year: year, index: i });
      monthIdx++;
    }
  }

  if (months.length === 0) return { months: [], apartments: [], summary: {} };

  const apartments = [];
  let r = 2;
  while (r < rows.length) {
    const nameRow = rows[r];
    if (!nameRow || !nameRow[0]) { r++; continue; }
    const name = nameRow[0].trim();
    if (name.includes('Количество заселении') || name.includes('Итого забронировали') ||
        name.includes('количество заселении') || name.includes('итого забронировали')) break;
    if (!name.includes('$') && !name.toLowerCase().includes('бронь')) { r++; continue; }
    const apt = { name, monthly: {} };
    for (let mi = 0; mi < months.length; mi++) {
      const ci = months[mi].index;
      apt.monthly[months[mi].label] = {
        revenue: parseNumber(nameRow[ci]),
        rent: parseNumber(rows[r + 1] ? rows[r + 1][ci] : '0'),
        commission: parseNumber(rows[r + 2] ? rows[r + 2][ci] : '0'),
        occupancy: parseNumber(rows[r + 3] ? rows[r + 3][ci] : '0'),
        profit: parseNumber(rows[r + 4] ? rows[r + 4][ci] : '0'),
      };
    }
    apartments.push(apt);
    r += 5;
  }

  const summary = {};
  const summaryLabels = [
    'bookings_count', 'total_revenue', 'rent', 'commission',
    'expenses', 'cleaning', 'salary', 'marketing', 'net_profit', 'marketing_share'
  ];
  for (let si = 0; si < summaryLabels.length && r < rows.length; r++) {
    if (!rows[r] || !rows[r][0]) continue;
    const label = rows[r][0].toLowerCase();
    if (label.includes('количество') || label.includes('итого') || label.includes('аренда') ||
        label.includes('комисс') || label.includes('расход') || label.includes('клининг') ||
        label.includes('зарплат') || label.includes('маркетинг') || label.includes('чистыми') ||
        label.includes('доля')) {
      const key = summaryLabels[si];
      summary[key] = {};
      for (let mi = 0; mi < months.length; mi++) {
        const ci = months[mi].index;
        const val = rows[r][ci] || '0';
        summary[key][months[mi].label] = key === 'marketing_share'
          ? val.replace('%', '').trim()
          : parseNumber(val);
      }
      si++;
    }
  }

  return { months: months.map(m => ({ label: m.label, year: m.year })), apartments, summary };
}

function parseWeeklyData(rows) {
  if (rows.length < 5) return null;
  const blocks = [];
  let currentMonth = null;
  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    if (!row || !row[0]) { i++; continue; }
    const cell = row[0].trim();
    if (/^(Декабрь|январь|Январь|Февраль|Март|Апрель|Май|Июнь|Июль|Август|Сентябрь|Октябрь|Ноябрь)\s*\d{4}/i.test(cell)) {
      currentMonth = cell; i++; continue;
    }
    if (cell === 'Неделя' && currentMonth) {
      i++;
      if (i >= rows.length) break;
      const dateRow = rows[i];
      i++;
      const dailyData = [];
      while (i < rows.length) {
        const r = rows[i];
        if (!r || !r[0]) { i++; continue; }
        const c = r[0].trim();
        if (/^(Декабрь|январь|Январь|Февраль|Март|Апрель|Май|Июнь|Июль|Август|Сентябрь|Октябрь|Ноябрь)\s*\d{4}/i.test(c)) break;
        if (c === 'Неделя') break;
        if (['Поступления', 'Аренда', 'Расходы', 'Клининг', 'Зарплата', 'Маркетинг', 'Чистыми'].some(s => c.includes(s))) {
          dailyData.push({ type: 'summary', label: c, values: r.slice(1) });
          i++; continue;
        }
        if (c === 'Комиссия') { i++; continue; }
        dailyData.push({ type: 'apartment', name: c, values: r.slice(1).map(v => parseNumber(v)) });
        i++;
      }
      blocks.push({ month: currentMonth, dates: dateRow ? dateRow.slice(1) : [], data: dailyData });
      continue;
    }
    i++;
  }
  return blocks;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=600',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const q = event.queryStringParameters || {};

  // RAW passthrough: фронт админки (loadWeeklySheets/loadAptSheets) шлёт gviz-запрос
  // напрямую в Google и упирается в CORS. Перехватчик admin-sheets-fix.js перенаправляет
  // его сюда (?gvizpass=1&tqx=...&sheet=...). Отдаём тело gviz как есть, тем же origin.
  if (q.gvizpass === '1') {
    try {
      const usp = new URLSearchParams();
      Object.keys(q).forEach(k => { if (k !== 'gvizpass') usp.set(k, q[k]); });
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?${usp.toString()}`;
      const body = await fetchUrl(gvizUrl);
      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' },
        body,
      };
    } catch (e) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'gviz passthrough failed', details: e.message }) };
    }
  }

  const sheet = q.sheet || 'month';

  try {
    if (sheet === 'month') {
      const csv = await fetchCSV('Месяц');
      const rows = parseCSVSimple(csv);
      const data = parseMonthlyData(rows);
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    if (sheet === 'week') {
      const csv = await fetchCSV('Неделя');
      const rows = parseCSVSimple(csv);
      const data = parseWeeklyData(rows);
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    const [monthCSV, weekCSV] = await Promise.all([fetchCSV('Месяц'), fetchCSV('Неделя')]);
    const monthRows = parseCSVSimple(monthCSV);
    const weekRows = parseCSVSimple(weekCSV);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ monthly: parseMonthlyData(monthRows), weekly: parseWeeklyData(weekRows) }),
    };
  } catch (e) {
    console.error('[SHEETS-PROXY] Error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to fetch sheet data', details: e.message }) };
  }
};
