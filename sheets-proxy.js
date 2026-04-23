const https = require('https');

// Google Sheets ID — таблица "Юнит экономика квартир"
const SHEET_ID = '1NHqPZV8Dx2dKmfTCpb8LcdA4AtuqSfKyyyWs5UF2HtY';

function fetchCSV(sheetName) {
  return new Promise((resolve, reject) => {
    const encoded = encodeURIComponent(sheetName);
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encoded}`;
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

function parseCSV(csv) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  const lines = [];
  
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (ch === '"') {
      if (inQuotes && csv[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (current || lines.length > 0) {
        lines.push(current);
        rows.push([...lines, current].length > 1 ? lines.concat(current) : [current]);
      }
      // Actually, let me redo this with a cleaner approach
    }
  }
  
  // Simpler CSV parser
  return parseCSVSimple(csv);
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
        if (inQuotes && line[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
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
  // Remove $ signs, all space types (regular, non-breaking, thin), percentage
  // Handle comma as decimal separator (Russian locale: $31 123,93)
  const cleaned = str.replace(/[$%\s\u00a0\u202f\u2009]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseMonthlyData(rows) {
  // Вкладка "Месяц": 
  // Row 0: Год | 2025 | 2026 | 2026 | 2026 | 2026 | 2026 ...
  // Row 1: Аппартамент / Месяц | Декабрь | Январь | Февраль | Март | Апрель | Май ...
  // Then blocks of 5 rows per apartment:
  //   Name (revenue) | Аренда | Комиссия | Кол-во заселении | Прибыль
  // Summary rows at bottom (row ~113+):
  //   113: Количество заселении
  //   114: Итого забронировали
  //   115: Аренда + офис
  //   116: Комиссия
  //   117: Расходы
  //   118: Клининг
  //   119: Зарплата
  //   120: Маркетинг
  //   121: Итого чистыми
  //   122: доля маркетинга

  if (rows.length < 3) return null;

  const months = [];
  const headerRow = rows[1] || [];
  const yearRow = rows[0] || [];
  
  // Build month labels from row 1 (skip column A)
  for (let i = 1; i < headerRow.length; i++) {
    if (headerRow[i]) {
      months.push({
        label: headerRow[i],
        year: yearRow[i] || yearRow[i - 1] || '2026',
        index: i
      });
    }
  }

  // Parse apartment blocks (rows 2 onwards, blocks of 5)
  const apartments = [];
  let r = 2;
  while (r < rows.length) {
    const nameRow = rows[r];
    if (!nameRow || !nameRow[0]) { r++; continue; }
    
    const name = nameRow[0];
    
    // Check if this is a summary row
    if (name.includes('Количество заселении') || name.includes('Итого забронировали')) break;
    
    // Check if it looks like an apartment name (contains $ or /бронь)
    if (!name.includes('$') && !name.includes('бронь') && !name.includes('Бронь')) { r++; continue; }
    
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

  // Parse summary rows
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
  // Вкладка "Неделя": monthly blocks separated by month headers
  // Each block starts with month name, then has:
  // "Неделя" row with day-of-week headers
  // "Аппартамент / дата" row with dates 
  // Then pairs of rows: apartment data + commission

  if (rows.length < 5) return null;

  const blocks = [];
  let currentMonth = null;
  let i = 0;

  while (i < rows.length) {
    const row = rows[i];
    if (!row || !row[0]) { i++; continue; }

    const cell = row[0].trim();

    // Detect month headers (e.g., "Декабрь 2025", "январь 2026", "Апрель 2026")
    if (/^(Декабрь|январь|Январь|Февраль|Март|Апрель|Май|Июнь|Июль|Август|Сентябрь|Октябрь|Ноябрь)\s*\d{4}/i.test(cell)) {
      currentMonth = cell;
      i++;
      continue;
    }

    // Detect "Неделя" row
    if (cell === 'Неделя' && currentMonth) {
      // Next row should be dates
      i++;
      if (i >= rows.length) break;
      const dateRow = rows[i]; // "Аппартамент / дата" + dates
      i++;

      // Collect apartment daily data until next month or end
      const dailyData = [];
      while (i < rows.length) {
        const r = rows[i];
        if (!r || !r[0]) { i++; continue; }
        const c = r[0].trim();
        if (/^(Декабрь|январь|Январь|Февраль|Март|Апрель|Май|Июнь|Июль|Август|Сентябрь|Октябрь|Ноябрь)\s*\d{4}/i.test(c)) break;
        if (c === 'Неделя') break;
        
        // Check for weekly summary rows (Поступления, Аренда, etc.)
        if (['Поступления', 'Аренда', 'Расходы', 'Клининг', 'Зарплата', 'Маркетинг', 'Чистыми'].some(s => c.includes(s))) {
          // This is a summary row - capture it
          dailyData.push({ type: 'summary', label: c, values: r.slice(1) });
          i++;
          continue;
        }

        if (c === 'Комиссия') {
          // Commission row for previous apartment
          i++;
          continue;
        }

        // Apartment data row
        dailyData.push({ type: 'apartment', name: c, values: r.slice(1).map(v => parseNumber(v)) });
        i++;
      }

      blocks.push({
        month: currentMonth,
        dates: dateRow ? dateRow.slice(1) : [],
        data: dailyData
      });
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

  const sheet = (event.queryStringParameters || {}).sheet || 'month';

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

    // Default: return both
    const [monthCSV, weekCSV] = await Promise.all([
      fetchCSV('Месяц'),
      fetchCSV('Неделя'),
    ]);
    
    const monthRows = parseCSVSimple(monthCSV);
    const weekRows = parseCSVSimple(weekCSV);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        monthly: parseMonthlyData(monthRows),
        weekly: parseWeeklyData(weekRows),
      }),
    };

  } catch (e) {
    console.error('[SHEETS-PROXY] Error:', e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch sheet data', details: e.message }),
    };
  }
};
