// Urban Luxe — _hk.js (01.10.2026). Общее для интеграции с housekeeping-ботом (Python, aiogram, свой VPS).
//
// Env в Netlify:
//   HK_WEBHOOK_URL   = https://hk.urbanluxe.cc/webhooks/realtycalendar   (приём броней в HK-боте)
//   HK_WEBHOOK_TOKEN = тот же REALTYCALENDAR_WEBHOOK_TOKEN из .env HK-бота
//   HK_EVENTS_TOKEN  = тот же URBANLUXE_EVENTS_TOKEN из .env HK-бота (события уборок к нам)
//
// Код квартиры в HK-боте = «<ЖК> <номер>» (например «U-Tower 65», «Nest One 15», «Gardens Residence 65»).
// realty_id = id объекта в RealtyCalendar (зашит в base64 в ical_export_url).

const T = require('./_tg.js');

function hkCode(a) { return ((a.complex || '').trim() + ' ' + String(a.name || '').replace(/\D/g, '')).trim(); }
function realtyId(a) {
  const m = String(a.ical_export_url || '').match(/[?&]q=([A-Za-z0-9%=]+)/);
  if (!m) return null;
  try { const s = Buffer.from(decodeURIComponent(m[1]).replace(/\s/g, ''), 'base64').toString('utf8').trim(); return /^\d+$/.test(s) ? +s : null; } catch (e) { return null; }
}
function hkType(a) { // studio | one_bedroom (двухкомнатная) | large_one_bedroom | two_bedroom (трёхкомнатная) | three_bedroom
  const r = String(a.rooms || ''); if (/студ/i.test(r) || !r) return 'studio';
  const n = (r.match(/\d+/g) || []).map(Number); const rooms = n[0] || 1;   // «2+1» = 2 комнаты, «3+1» = 3 комнаты, «2+2+1» = 2 комнаты, больше санузлов/балкон
  if (rooms <= 1) return 'studio';
  if (rooms === 2) return n.length > 2 || n[1] >= 2 ? 'large_one_bedroom' : 'one_bedroom';
  if (rooms === 3) return 'two_bedroom';
  return 'three_bedroom';
}

let cache = null;
async function apartments() {
  if (cache && Date.now() - cache.at < 300000) return cache.list;
  const r = await T.sb('apartments?select=id,name,complex,floor,rooms,ical_export_url,is_active&order=complex,name');
  const list = (r.ok ? await r.json() : []).map(a => Object.assign(a, { hk_code: hkCode(a), realty_id: realtyId(a), hk_type: hkType(a) }));
  cache = { at: Date.now(), list };
  return list;
}
async function byCode(code) {
  const list = await apartments(); const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return list.find(a => norm(a.hk_code) === norm(code)) || null;
}

function csv(list) {
  const esc = v => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const rows = [['code', 'building', 'address', 'floor', 'apartment_type', 'area_m2', 'bathrooms_count', 'beds_count', 'sofa_beds_count', 'realty_id']];
  list.filter(a => a.is_active).forEach(a => rows.push([a.hk_code, a.complex || '', '', a.floor || 0, a.hk_type, 0, 1, a.hk_type === 'studio' ? 1 : 2, a.hk_type === 'studio' ? 1 : 0, a.realty_id || '']));
  return rows.map(r => r.map(esc).join(',')).join('\n') + '\n';
}

module.exports = { hkCode, realtyId, hkType, apartments, byCode, csv };
