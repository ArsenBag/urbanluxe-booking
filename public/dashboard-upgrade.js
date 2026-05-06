/* dashboard-upgrade.js — Переключатель месяцев для дашборда
   Подключение: <script src="/dashboard-upgrade.js"></script> перед </body> в admin.html
   
   Добавляет:
   - Навигацию по месяцам (← ПРЕД / СЛЕД →) для основных метрик
   - Переключатель загрузки (iCal) за выбранный месяц
   - Заезды/выезды за выбранную дату
*/
(function(){
'use strict';

const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONTHS_SHORT = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

const css = document.createElement('style');
css.textContent = `
.du-month-nav{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.du-month-btn{padding:5px 12px;background:none;border:1px solid var(--line);color:var(--ink-m);font-size:11px;font-family:inherit;border-radius:4px;cursor:pointer;text-transform:uppercase;letter-spacing:.05em;transition:all .2s}
.du-month-btn:hover{border-color:var(--gold);color:var(--gold)}
.du-month-label{font-size:14px;font-weight:500;color:var(--ink);min-width:140px;text-align:center}
.du-month-today{padding:5px 10px;background:rgba(201,169,97,.1);border:1px solid var(--gold);color:var(--gold);font-size:10px;font-family:inherit;border-radius:4px;cursor:pointer;letter-spacing:.05em;transition:all .2s}
.du-month-today:hover{background:var(--gold);color:#0a0a0a}
`;
document.head.appendChild(css);

// State
let selectedYear = new Date().getFullYear();
let selectedMonth = new Date().getMonth(); // 0-indexed

function getMonthLabel(y, m) {
  return MONTHS_RU[m] + ' ' + y;
}

function getShortLabel(y, m) {
  return MONTHS_SHORT[m] + " '" + String(y).slice(2);
}

// ===== INJECT MONTH NAVIGATOR =====
function injectMonthNav() {
  const dashTab = document.getElementById('tab-dash');
  if (!dashTab) return;
  if (dashTab.querySelector('.du-month-nav')) return;

  // Find the stats row by locating dR (revenue card) and going up to parent row
  const dR = document.getElementById('dR');
  if (!dR) return;
  const statsRow = dR.parentElement?.parentElement;
  if (!statsRow || statsRow.id === 'tab-dash') return;

  const nav = document.createElement('div');
  nav.className = 'du-month-nav';
  nav.innerHTML = `
    <button class="du-month-btn" onclick="window._duChangeMonth(-1)">← Пред</button>
    <span class="du-month-label" id="duMonthLabel">${getMonthLabel(selectedYear, selectedMonth)}</span>
    <button class="du-month-btn" onclick="window._duChangeMonth(1)">След →</button>
    <button class="du-month-today" onclick="window._duGoToday()">Сегодня</button>
  `;

  statsRow.parentElement.insertBefore(nav, statsRow);
}

// ===== CHANGE MONTH =====
window._duChangeMonth = function(delta) {
  selectedMonth += delta;
  if (selectedMonth > 11) { selectedMonth = 0; selectedYear++; }
  if (selectedMonth < 0) { selectedMonth = 11; selectedYear--; }
  updateDashboardForMonth();
};

window._duGoToday = function() {
  selectedYear = new Date().getFullYear();
  selectedMonth = new Date().getMonth();
  updateDashboardForMonth();
};

function updateDashboardForMonth() {
  // Update label
  const label = document.getElementById('duMonthLabel');
  if (label) label.textContent = getMonthLabel(selectedYear, selectedMonth);

  // Override getCurrentMonthLabel temporarily
  const origGetMonth = window.getCurrentMonthLabel;
  window.getCurrentMonthLabel = function() {
    return MONTHS_RU[selectedMonth];
  };

  // Also update the today date picker to first/last day of selected month
  const datePicker = document.getElementById('todayDatePicker');
  if (datePicker) {
    // Set to today if current month, otherwise 1st of selected month
    const now = new Date();
    if (selectedYear === now.getFullYear() && selectedMonth === now.getMonth()) {
      datePicker.value = now.toISOString().split('T')[0];
    } else {
      // Last day of selected month
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      datePicker.value = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
    // Trigger change event for loadTodayForDate
    if (typeof loadTodayForDate === 'function') {
      loadTodayForDate(datePicker.value);
    }
  }

  // Re-render dashboard with new month
  if (typeof rDash === 'function') {
    rDash();
  }

  // Update occupancy for selected month
  updateOccupancyForMonth();

  // Restore original
  setTimeout(() => {
    if (origGetMonth) window.getCurrentMonthLabel = origGetMonth;
  }, 2000);
}

function updateOccupancyForMonth() {
  // Calculate occupancy from iCal data for selected month
  const icalData = window.chessIcalData || [];
  const dbData = window.chessDbData || [];
  const allApts = window._allApts || [];
  if (!allApts.length) return;

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  let totalCells = allApts.length * daysInMonth;
  let occupiedCells = 0;

  const allBookings = [...(dbData || []), ...(icalData || [])];

  allApts.forEach(apt => {
    const aptBookings = allBookings.filter(b => b.apartment_id === apt.id);
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (aptBookings.some(b => ds >= b.check_in && ds < b.check_out)) {
        occupiedCells++;
      }
    }
  });

  const pct = totalCells ? Math.round(occupiedCells / totalCells * 100) : 0;

  // Update occupancy display
  const occEl = document.querySelector('[id*="todayOccupied"], [class*="occ"]');
  if (occEl) {
    // Try to find the percentage text
    const allText = occEl.querySelectorAll('*');
    allText.forEach(el => {
      if (el.textContent.includes('%') && !el.textContent.includes('ЗАГРУЗКА')) {
        el.textContent = pct + '%';
      }
    });
  }
}

// ===== INIT =====
// Wait for dashboard to render, then inject
function tryInject() {
  if (document.getElementById('dR') && !document.querySelector('.du-month-nav')) {
    injectMonthNav();
  } else {
    setTimeout(tryInject, 1000);
  }
}

// Use MutationObserver
const dashTab = document.getElementById('tab-dash');
if (dashTab) {
  const obs = new MutationObserver(() => {
    if (document.getElementById('dR') && !document.querySelector('.du-month-nav')) {
      injectMonthNav();
    }
  });
  obs.observe(dashTab, { childList: true, subtree: true });
}

setTimeout(tryInject, 3000);

// Re-inject after tab switch
const origSwitch = window.switchTab;
if (origSwitch) {
  window.switchTab = function(tab) {
    origSwitch.apply(this, arguments);
    if (tab === 'dash') setTimeout(injectMonthNav, 500);
    if (tab === 'analytics') setTimeout(injectAnalyticsMonthNav, 800);
  };
}

// ===== ANALYTICS MONTH NAVIGATION =====
let analyticsYear = new Date().getFullYear();
let analyticsMonth = new Date().getMonth();

function injectAnalyticsMonthNav() {
  const tabBiz = document.getElementById('tab-analytics');
  if (!tabBiz) return;
  if (tabBiz.querySelector('.du-month-nav')) return;

  // Find the header "Аналитика" 
  const header = tabBiz.querySelector('h2, h3, [style*="font-size:2"]');
  if (!header) return;

  const nav = document.createElement('div');
  nav.className = 'du-month-nav';
  nav.style.marginTop = '12px';
  nav.innerHTML = `
    <button class="du-month-btn" onclick="window._duAnalyticsChange(-1)">← Пред</button>
    <span class="du-month-label" id="duAnalyticsLabel">${getMonthLabel(analyticsYear, analyticsMonth)}</span>
    <button class="du-month-btn" onclick="window._duAnalyticsChange(1)">След →</button>
    <button class="du-month-today" onclick="window._duAnalyticsToday()">Сегодня</button>
  `;

  header.parentElement.insertBefore(nav, header.nextSibling);
}

function runWithFakeDate(year, month, fn) {
  const OrigDate = window._OrigDateClass || Date;
  if (!window._OrigDateClass) window._OrigDateClass = Date;
  const target = new OrigDate(year, month, 15);
  const Fake = function(...a) { return a.length === 0 ? new OrigDate(target.getTime()) : new OrigDate(...a) };
  Fake.now = () => OrigDate.now(); Fake.parse = OrigDate.parse; Fake.UTC = OrigDate.UTC; Fake.prototype = OrigDate.prototype;
  window.Date = Fake;
  try { fn(); } catch(e) { console.error('Date override error:', e); }
  setTimeout(() => { window.Date = window._OrigDateClass || OrigDate; }, 5000);
}

window._duAnalyticsChange = function(delta) {
  analyticsMonth += delta;
  if (analyticsMonth > 11) { analyticsMonth = 0; analyticsYear++; }
  if (analyticsMonth < 0) { analyticsMonth = 11; analyticsYear--; }
  updateAnalyticsForMonth();
};

window._duAnalyticsToday = function() {
  analyticsYear = new Date().getFullYear();
  analyticsMonth = new Date().getMonth();
  updateAnalyticsForMonth();
};

function updateAnalyticsForMonth() {
  const label = document.getElementById('duAnalyticsLabel');
  if (label) label.textContent = getMonthLabel(analyticsYear, analyticsMonth);
  runWithFakeDate(analyticsYear, analyticsMonth, () => {
    if (typeof loadBizAnalytics === 'function') loadBizAnalytics();
    if (typeof loadAptSheets === 'function') loadAptSheets();
  });
}

// Init analytics nav
setTimeout(() => {
  const tabBiz = document.getElementById('tab-analytics');
  if (tabBiz) {
    const obs = new MutationObserver(() => {
      if (!tabBiz.querySelector('.du-month-nav') && tabBiz.querySelector('h2, h3')) {
        injectAnalyticsMonthNav();
      }
    });
    obs.observe(tabBiz, { childList: true, subtree: true });
  }
}, 2000);

console.log('[Dashboard Upgrade] Переключатель месяцев загружен ✓');
})();
