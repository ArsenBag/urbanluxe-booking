/* Urban Luxe — admin-instructions.js: пункт «🔑 Заселение» в админке.
   Редактор инструкций по заселению (checkin_instructions): выбор квартиры,
   тексты RU/EN/UZ, сохранение. Гость видит инструкцию в кабинете только
   при подтверждённой брони (RLS).
   Подключение в admin.html (рядом с ops-center.js):
     <script src="/admin-instructions.js" defer></script> */
(function () {
  'use strict';

  var SB_URL = 'https://sebvfvtofiysbywxjqut.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI';
  var sbc = null;
  function sb() {
    if (!sbc && window.supabase && window.supabase.createClient) sbc = window.supabase.createClient(SB_URL, SB_KEY, { auth: { detectSessionInUrl: false } });
    return sbc;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  var ROWS = {};   // apartment_id -> row из checkin_instructions
  var CUR = null;  // выбранная квартира

  function loadAll() {
    return sb().from('checkin_instructions').select('*').then(function (r) {
      ROWS = {};
      (r.data || []).forEach(function (row) { ROWS[row.apartment_id] = row; });
    });
  }

  function aptList() {
    var apts = (window._allApts || []).slice();
    apts.sort(function (a, b) { return (a.complex + a.name) < (b.complex + b.name) ? -1 : 1; });
    return apts;
  }

  function renderList() {
    var box = document.getElementById('ulai-list');
    if (!box) return;
    box.innerHTML = aptList().map(function (a) {
      var has = ROWS[a.id] && (ROWS[a.id].content_ru || ROWS[a.id].content_en || ROWS[a.id].content_uz);
      return '<div data-apt="' + esc(a.id) + '" style="padding:9px 12px;border-radius:8px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px;' +
        (CUR === a.id ? 'background:#3a3324;border:1px solid #c9a96e' : 'background:#1c1c1c;border:1px solid #2a2a2a') + '">' +
        '<span style="color:#e2e8f0;font-size:13px">' + esc(a.name) + ' <span style="color:#64748b">· ' + esc(a.complex || '') + '</span></span>' +
        '<span style="font-size:12px;color:' + (has ? '#22c55e' : '#64748b') + '">' + (has ? '✓' : '—') + '</span></div>';
    }).join('');
    [].forEach.call(box.querySelectorAll('[data-apt]'), function (el) {
      el.onclick = function () { openApt(el.getAttribute('data-apt')); };
    });
  }

  function openApt(id) {
    CUR = id;
    renderList();
    var row = ROWS[id] || {};
    var a = (window._allApts || []).filter(function (x) { return x.id === id; })[0] || { name: id };
    document.getElementById('ulai-title').textContent = a.name + (a.complex ? ' · ' + a.complex : '') + '  (' + id + ')';
    ['ru', 'en', 'uz'].forEach(function (l) {
      document.getElementById('ulai-' + l).value = row['content_' + l] || '';
    });
    document.getElementById('ulai-form').style.display = '';
    document.getElementById('ulai-msg').textContent = '';
  }

  function save() {
    if (!CUR) return;
    var msg = document.getElementById('ulai-msg');
    var payload = {
      apartment_id: CUR,
      content_ru: document.getElementById('ulai-ru').value.trim() || null,
      content_en: document.getElementById('ulai-en').value.trim() || null,
      content_uz: document.getElementById('ulai-uz').value.trim() || null,
      updated_at: new Date().toISOString()
    };
    msg.style.color = '#94a3b8'; msg.textContent = 'Сохраняю…';
    sb().from('checkin_instructions').upsert(payload).then(function (r) {
      if (r.error) { msg.style.color = '#ef4444'; msg.textContent = 'Ошибка: ' + r.error.message; return; }
      ROWS[CUR] = payload;
      msg.style.color = '#22c55e'; msg.textContent = 'Сохранено ✓';
      renderList();
    });
  }

  function ta(id, label, ph) {
    return '<div style="margin-bottom:10px"><div style="font-size:11px;color:#94a3b8;text-transform:uppercase;margin-bottom:4px">' + label + '</div>' +
      '<textarea id="' + id + '" rows="7" placeholder="' + esc(ph) + '" style="width:100%;box-sizing:border-box;background:#1c1c1c;border:1px solid #334155;border-radius:9px;color:#e2e8f0;padding:10px;font-size:13px;font-family:inherit;resize:vertical"></textarea></div>';
  }

  function openOverlay() {
    var ov = document.getElementById('ulai-overlay');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'ulai-overlay';
      ov.style.cssText = 'position:fixed;inset:0;background:#020617;z-index:99999;overflow:auto;padding:20px 24px;font-family:Arial,system-ui,sans-serif';
      document.body.appendChild(ov);
    }
    ov.style.display = 'block';
    ov.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<div style="font-size:20px;font-weight:700;color:#f8fafc">🔑 Инструкции по заселению <span style="font-size:12px;color:#64748b;font-weight:400">— гость видит после подтверждения брони</span></div>' +
      '<button id="ulai-close" style="background:#1e293b;color:#f1f5f9;border:1px solid #334155;border-radius:8px;padding:8px 16px;cursor:pointer">✕ Закрыть</button></div>' +
      '<div style="display:grid;grid-template-columns:280px 1fr;gap:16px;align-items:start">' +
      '<div id="ulai-list" style="display:grid;gap:6px;max-height:75vh;overflow:auto"></div>' +
      '<div id="ulai-form" style="display:none;background:#0f172a;border:1px solid #334155;border-radius:12px;padding:16px">' +
      '<div id="ulai-title" style="color:#c9a96e;font-weight:600;margin-bottom:12px"></div>' +
      ta('ulai-ru', 'Русский', 'Адрес, подъезд, этаж, код домофона, как получить ключи, Wi-Fi, парковка, контакты…') +
      ta('ulai-en', 'English (необязательно — без него гостю покажется русский)', 'Address, entrance, floor, door code, keys, Wi-Fi…') +
      ta('ulai-uz', 'Oʼzbekcha (lotin, необязательно)', 'Manzil, kirish, qavat, kod, kalitlar, Wi-Fi…') +
      '<div style="display:flex;gap:10px;align-items:center">' +
      '<button id="ulai-save" style="background:#c9a96e;color:#241d10;border:0;border-radius:9px;padding:11px 26px;font-weight:600;cursor:pointer">Сохранить</button>' +
      '<span id="ulai-msg" style="font-size:13px"></span></div></div></div>';
    document.getElementById('ulai-close').onclick = function () { ov.style.display = 'none'; };
    document.getElementById('ulai-save').onclick = save;
    if (window.event === undefined || true) {
      document.addEventListener('keydown', function esc2(e) { if (e.key === 'Escape' && ov.style.display !== 'none') { ov.style.display = 'none'; document.removeEventListener('keydown', esc2); } });
    }
    loadAll().then(renderList);
  }

  function addNav() {
    if (document.getElementById('ulai-nav')) return;
    var ref = [].slice.call(document.querySelectorAll('a,button,li,div,span')).filter(function (e) {
      return e.textContent.trim() === 'Дашборд' && e.children.length <= 1 && e.offsetParent !== null;
    })[0];
    if (!ref) return;
    var item = ref.cloneNode(true);
    item.id = 'ulai-nav'; item.textContent = '🔑 Заселение'; item.removeAttribute('onclick'); item.style.cursor = 'pointer';
    item.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openOverlay(); });
    ref.parentElement.insertBefore(item, ref.nextSibling);
  }
  function init() { addNav(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  var tries = 0, tm = setInterval(function () { addNav(); if (document.getElementById('ulai-nav') || ++tries > 40) clearInterval(tm); }, 300);
})();
