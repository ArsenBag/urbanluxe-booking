// Urban Luxe — admin/core.js (14.10.2026). Ядро админки v4: вход (общая Supabase-сессия с /pms), api(), роутер по hash,
// общие виджеты (drawer, toast, money, даты), realtime (новая заявка → тост + звук). Разделы регистрируются в ADM.views[name] = fn.
// Правило: ядро ≤ 400 строк, цифры считает сервер (admin-api.js), клиент рисует.
(function () {
const SB_URL = 'https://sebvfvtofiysbywxjqut.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI';
const sb = supabase.createClient(SB_URL, SB_KEY);
const API = '/.netlify/functions/admin-api';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DAYMS = 86400000, iso = d => new Date(d).toISOString().slice(0, 10), addD = (s, k) => iso(new Date(s + 'T00:00:00Z').getTime() + k * DAYMS);
const MN = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MNF = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const DN = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const ruD = s => s ? s.slice(8, 10) + '.' + s.slice(5, 7) : '';
const ruDM = s => s ? +s.slice(8, 10) + ' ' + MN[+s.slice(5, 7) - 1] : '';
const ruMonth = ym => ym ? MNF[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4) : '';
const addMonths = (ym, k) => { const d = new Date(ym.slice(0, 7) + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + k); return d.toISOString().slice(0, 7); };
const money = (v, cur) => v == null || isNaN(v) ? '—' : (cur === 'RUB' ? '₽' : cur === 'UZS' ? '' : '$') + Math.round(v).toLocaleString('ru-RU') + (cur === 'UZS' ? ' сум' : '');
const pct = v => v == null || isNaN(v) ? '—' : Math.round(v) + '%';
const toast = (m, ms) => { const t = $('#toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(t._t); t._t = setTimeout(() => t.style.display = 'none', ms || 2600); };
const ST = { request: ['Заявка', '#fde68a'], confirmed: ['Подтверждена', '#f8a5a0'], checked_in: ['Живёт', '#9ee0a8'], checked_out: ['Выехал', '#d6dae0'], cancelled: ['Отменена', '#f3c4c1'], blocked: ['Блок', '#b8bec7'] };
const CH = { telegram: 'Telegram', website: 'Сайт', manual: 'Бронер', rc: 'RC', ostrovok: 'Ostrovok', yandex: 'Яндекс', booking: 'Booking', airbnb: 'Airbnb', sutochno: 'Sutochno', walk_in: 'Без брони', corporate: 'Корпоратив', ota: 'OTA', mail: 'Почта', other: 'Другое' };

// ---------- auth / api ----------
let ME = null;
async function token() { const { data: { session } } = await sb.auth.getSession(); return session ? session.access_token : null; }
async function api(params, body) {
  const t = await token(); if (!t) { showLogin(); throw new Error('no session'); }
  const r = await fetch(API + (body ? '' : '?' + new URLSearchParams(params)), { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({ error: 'bad json' }));
  if (!r.ok || j.error) { if (r.status === 401) showLogin(); const e = new Error(j.error || ('HTTP ' + r.status)); e.status = r.status; throw e; }
  return j;
}
function showLogin() { $('#login').classList.remove('hide'); $('#app').classList.add('hide'); }
async function login() {
  const er = $('#loginErr'); er.style.display = 'none';
  const { error } = await sb.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#pass').value });
  if (error) { er.textContent = 'Не удалось войти: ' + error.message; er.style.display = 'block'; return; }
  boot();
}
async function logout() { await sb.auth.signOut(); location.reload(); }

// ---------- роутер ----------
const views = {};
let VIEW = '';
function go(v, keepHash) {
  if (!views[v]) v = 'dash';
  VIEW = v;
  $$('#top nav [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  closeDrawer();
  $('#main').innerHTML = '';
  if (!keepHash && location.hash.replace('#', '').split('/')[0] !== v) history.replaceState(null, '', '#' + v);
  try { views[v](); } catch (e) { $('#main').innerHTML = '<div class="warn">' + esc(e.message) + '</div>'; }
}
function soon(name) { return () => { $('#main').innerHTML = '<div class="page"><h2>' + esc(name) + '</h2><div class="card empty">Раздел переносится из старой админки — следующий этап. Пока: <a href="/admin3">/admin3</a> (финансы) · <a href="/admin-legacy.html">/admin-legacy.html</a> (остальное).</div></div>'; }; }
['analytics', 'finance', 'apartments', 'ops', 'chat', 'staff', 'users', 'strategy'].forEach(v => { views[v] = soon($('#top nav [data-v=' + v + ']').textContent); });

async function boot() {
  try { ME = await api({ a: 'me' }); } catch (e) { showLogin(); return; }
  if (ME.role === 'partner' || ME.role === 'booker') {
    // партнёр и бронер живут в /pms; админка — для admin и ops
    $('#login').classList.remove('hide'); $('#app').classList.add('hide');
    const er = $('#loginErr'); er.textContent = 'Для роли «' + ME.role + '» админка не предназначена — откройте /pms.'; er.style.display = 'block'; return;
  }
  $('#login').classList.add('hide'); $('#app').classList.remove('hide');
  $('#me').textContent = (ME.org ? ME.org.name + ' · ' : '') + ME.name + ' · ' + ME.role;
  if (ME.role !== 'admin') $$('#top nav [data-role=admin]').forEach(b => b.remove());
  $$('#top nav [data-v]').forEach(b => b.onclick = () => go(b.dataset.v));
  window.addEventListener('hashchange', () => { const v = location.hash.replace('#', '').split('/')[0]; if (v && v !== VIEW) go(v, true); });
  realtime();
  go(location.hash.replace('#', '').split('/')[0] || 'dash', true);
}

// ---------- drawer / виджеты ----------
function drawer(title, body, foot) { $('#d_title').textContent = title; $('#d_body').innerHTML = body; $('#d_foot').innerHTML = foot || ''; $('#drawer').classList.add('open'); }
function closeDrawer() { $('#drawer').classList.remove('open'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
// KPI-плитка с дельтой к прошлому периоду: delta>0 зелёная стрелка, <0 красная; invert — для расходов/долгов (рост = плохо)
function kpiTile(label, value, prev, fmt, invert) {
  fmt = fmt || money;
  let d = '';
  if (prev != null && !isNaN(prev) && value != null) {
    const diff = value - prev, good = invert ? diff <= 0 : diff >= 0;
    const rel = prev ? Math.round(100 * diff / Math.abs(prev)) : null;
    d = '<div class="d ' + (diff === 0 ? 'muted' : good ? 'up' : 'down') + '">' + (diff > 0 ? '▲' : diff < 0 ? '▼' : '•') + ' ' + fmt(Math.abs(diff)) + (rel != null && isFinite(rel) ? ' (' + Math.abs(rel) + '%)' : '') + '</div>';
  }
  return '<div>' + esc(label) + '<b>' + fmt(value) + '</b>' + d + '</div>';
}
// Звук новой заявки (короткий «динь» без файла)
function ding() {
  try { const ac = new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = 880; g.gain.value = .08; o.connect(g); g.connect(ac.destination); o.start(); o.frequency.exponentialRampToValueAtTime(1320, ac.currentTime + .12); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + .5); o.stop(ac.currentTime + .5); } catch (e) { /* автоплей запрещён — не страшно */ }
}

// ---------- realtime ----------
let lastOk = Date.now();
const listeners = [];
function onChange(fn) { listeners.push(fn); }
async function realtime() {
  const t = await token(); if (t) sb.realtime.setAuth(t);
  const bump = (payload) => {
    lastOk = Date.now(); setConn(true);
    const n = payload && payload.new, o = payload && payload.old;
    if (n && n.status === 'request' && (!o || o.status !== 'request')) { toast('🆕 Новая заявка с сайта: ' + (n.guest_name || '') + ' · ' + ruD(n.check_in) + '–' + ruD(n.check_out), 6000); ding(); }
    listeners.forEach(fn => { try { fn(payload); } catch (e) { /* раздел сам разберётся */ } });
  };
  const ch = sb.channel('admin')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, bump)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, bump)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cleaning_tasks' }, bump)
    .subscribe(status => setConn(status === 'SUBSCRIBED'));
  sb.auth.onAuthStateChange((ev, session) => { if (session) sb.realtime.setAuth(session.access_token); });
  setInterval(() => setConn(ch.state === 'joined'), 5000);
}
function setConn(ok) { const c = $('#conn'); if (!c) return; c.classList.toggle('off', !ok); c.textContent = ok ? 'online' : 'нет связи · данные на ' + new Date(lastOk).toTimeString().slice(0, 5); }

// ---------- старт: magic link из бота (?tk=) или существующая сессия ----------
async function start() {
  $('#pass').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  const tk = new URLSearchParams(location.search).get('tk');
  if (tk) {
    history.replaceState(null, '', location.pathname + location.hash);
    const { error } = await sb.auth.verifyOtp({ token_hash: tk, type: 'magiclink' });
    if (error) { showLogin(); const er = $('#loginErr'); er.textContent = 'Ссылка не подошла (' + error.message + '). Запросите новую командой /pms в боте или войдите по паролю.'; er.style.display = 'block'; return; }
  }
  const { data: { session } } = await sb.auth.getSession(); session ? boot() : showLogin();
}

window.ADM = { sb, api, get ME() { return ME; }, views, go, start, login, logout, drawer, closeDrawer, toast, kpiTile, onChange, $, $$, esc, iso, addD, addMonths, ruD, ruDM, ruMonth, money, pct, ST, CH, DN, MN };
})();
