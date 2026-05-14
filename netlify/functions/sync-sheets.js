const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const SHEET_ID = '1NHqPZV8Dx2dKmfTCpb8LcdA4AtuqSfKyyyWs5UF2HtY';
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

function fetchCSV(sheetName, range) {
  return new Promise((resolve, reject) => {
    const encoded = encodeURIComponent(sheetName);
    const rangeParam = range ? `&range=${range}` : '';
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encoded}${rangeParam}`;
    https.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, { timeout: 15000 }, (res2) => {
          let data = ''; res2.on('data', c => data += c); res2.on('end', () => resolve(data));
        }).on('error', reject);
        return;
      }
      let data = ''; res.on('data', c => data += c); res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseCSVRow(line) {
  const cells = []; let cell = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i+1] === '"') { cell += '"'; i++; } else inQ = !inQ; }
    else if (ch === ',' && !inQ) { cells.push(cell.trim()); cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  cells.push(cell.trim());
  return cells;
}

// Parse apartment name from Sheets format - extract LAST multi-digit number as apt number
// "MA - 8 -111 - 1300$ /Бронь" → number:111, floor:8, complex:Mirabad
// "NO-13-249 - 1200$ /Бронь" → number:249, floor:13, complex:Nest One
// "NO-3B-15 - 1000$ /Бронь" → number:15, floor:3, complex:Nest One
// "U-13-207 - 1500$ /Бронь" → number:207, floor:13, complex:U-Tower
// "Kislorod Apartment 58 1200$" → number:58, complex:Kislorod
function parseAptName(name) {
  if (!name) return null;
  const clean = name.replace(/"/g, '').trim();
  
  // Kislorod format: "Kislorod Apartment 58 1200$"
  let m = clean.match(/Kislorod\s+Apartment\s+0*(\d+)/i);
  if (m) return { number: parseInt(m[1]), complex: 'Kislorod', id: 'kislorod_' + parseInt(m[1]) };
  
  // Мирабад format: "Мирабад Авеню 205 1000$"
  m = clean.match(/Мирабад\s+(?:Авеню\s+)?(\d+)/i);
  if (m) return { number: parseInt(m[1]), complex: 'Mirabad', id: 'mirabad_' + parseInt(m[1]) };
  
  // Nest One format: "Nest One 353" or "NO_9_163" or "NO-3B-15" or "NO-13-249 - 1200$"
  // First try "Nest One NNN" format (number right after Nest One)
  m = clean.match(/Nest\s*One\s+(\d{2,})/i);
  if (m) return { number: parseInt(m[1]), complex: 'Nest One', id: 'nest_' + parseInt(m[1]) };
  // Then try NO-floor-number format
  m = clean.match(/NO[_\-\s]+(?:\d+[A-Za-z]?[_\-\s]+)?(\d{2,})/i);
  if (m) {
    const num = parseInt(m[1]);
    // Try to get floor from prefix
    const floorMatch = clean.match(/(?:NO|Nest\s*One)[_\-\s]+(\d+)/i);
    const floor = floorMatch ? parseInt(floorMatch[1]) : null;
    return { number: num, floor: floor !== num ? floor : null, complex: 'Nest One', id: 'nest_' + num };
  }
  
  // U-Tower format: "U-13-207 - 1500$" or "U -7-92"
  m = clean.match(/U\s*[\-_]\s*(\d+)\s*[\-_]\s*(\d+)/i);
  if (m) return { number: parseInt(m[2]), floor: parseInt(m[1]), complex: 'U-Tower', id: 'utower_' + parseInt(m[2]) };
  
  // MA (Mirabad) format: "MA - 8 -111 - 1300$"
  m = clean.match(/MA\s*[\-_]\s*(\d+)\s*[\-_]\s*(\d+)/i);
  if (m) return { number: parseInt(m[2]), floor: parseInt(m[1]), complex: 'Mirabad', id: 'mirabad_' + parseInt(m[2]) };
  
  return null;
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  
  try {
    const sb = createClient(SB_URL, SB_KEY);
    
    // 1. Get current apartments from Supabase
    const { data: existing } = await sb.from('apartments').select('id,name');
    const existingNums = new Set((existing || []).map(a => {
      const m = a.name.match(/\d+/);
      return m ? m[0] : '';
    }).filter(Boolean));
    
    // 2. Get apartments from Sheets "Месяц" column A
    const csv = await fetchCSV('Месяц', 'A1:A140');
    const rows = csv.split('\n').filter(l => l.trim());
    const aptNames = rows.map(r => parseCSVRow(r)[0]).filter(n => n && (n.includes('$') || n.includes('Бронь') || n.includes('бронь')));
    
    // 3. Find missing apartments
    const added = [];
    const skipped = [];
    
    for (const name of aptNames) {
      const parsed = parseAptName(name);
      if (!parsed) { skipped.push({ name, reason: 'parse_failed' }); continue; }
      
      if (existingNums.has(String(parsed.number))) {
        skipped.push({ name, reason: 'exists', number: parsed.number });
        continue;
      }
      
      // Add to Supabase
      const aptData = {
        id: parsed.id,
        name: 'Апартамент ' + parsed.number,
        complex: parsed.complex,
        floor: parsed.floor || 1,
        style: 'Студия',
        rooms: 'Студия',
        weekday_price: 90,
        weekend_price: 100,
        is_active: true,
        max_guests: 2,
        description: `Urban Luxe, ${parsed.complex}, ${parsed.floor ? parsed.floor + ' этаж' : ''}`.trim(),
        photo_url: '[]',
      };
      
      const { error } = await sb.from('apartments').insert(aptData);
      if (error) {
        skipped.push({ name, reason: 'insert_error: ' + error.message, number: parsed.number });
      } else {
        added.push({ name, id: parsed.id, number: parsed.number, complex: parsed.complex });
        existingNums.add(String(parsed.number));
      }
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        sheetsApts: aptNames.length,
        supabaseApts: (existing || []).length,
        added,
        skipped: skipped.filter(s => s.reason !== 'exists'),
        existingSkipped: skipped.filter(s => s.reason === 'exists').length
      })
    };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
