/* checkin-upgrade.js — Учёт заселения/выселения для Urban Luxe admin.html
   Подключение: <script src="/checkin-upgrade.js"></script> перед </body>
   
   Добавляет:
   - Панель заездов сегодня с кнопками «Заселён» / «Ожидает»
   - Указание времени заезда
   - Панель выездов с кнопкой «Выехал»
   - Цветовая индикация статуса
   - Обновление в реальном времени
*/
(function(){
'use strict';

const css = document.createElement('style');
css.textContent = `
/* Check-in Panel */
.ci-panel{background:var(--bg2);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:12px}
.ci-title{font-size:13px;font-weight:500;color:var(--gold);margin-bottom:10px;display:flex;align-items:center;gap:8px}
.ci-title .ci-badge{background:var(--gold);color:var(--bg);font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600}
.ci-list{display:flex;flex-direction:column;gap:6px}
.ci-row{display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg);border-radius:8px;border:1px solid var(--line);transition:border-color .2s}
.ci-row:hover{border-color:rgba(201,169,97,.3)}
.ci-row.checked-in{border-left:3px solid var(--green,#2ecc71);background:rgba(46,204,113,.03)}
.ci-row.waiting{border-left:3px solid var(--gold,#c9a961)}
.ci-row.checked-out{border-left:3px solid var(--ink-d,#6b665e);opacity:.6}
.ci-apt{font-size:12px;font-weight:500;min-width:110px;color:var(--ink)}
.ci-guest{font-size:11px;color:var(--ink-m);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ci-source{font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(201,169,97,.1);color:var(--ink-d)}
.ci-time{display:flex;align-items:center;gap:4px}
.ci-time input{width:70px;padding:4px 6px;background:var(--bg2);border:1px solid var(--line);color:var(--ink);font-size:11px;font-family:inherit;border-radius:4px;text-align:center}
.ci-time input:focus{border-color:var(--gold);outline:none}
.ci-btn{padding:4px 10px;border:1px solid var(--line);background:none;color:var(--ink-m);font-size:10px;font-family:inherit;border-radius:4px;cursor:pointer;transition:all .2s;text-transform:uppercase;letter-spacing:.05em}
.ci-btn:hover{border-color:var(--gold);color:var(--gold)}
.ci-btn.active{background:var(--green,#2ecc71);color:#fff;border-color:var(--green,#2ecc71)}
.ci-btn.out-active{background:var(--ink-d,#6b665e);color:#fff;border-color:var(--ink-d)}
.ci-empty{color:var(--ink-d);font-size:12px;text-align:center;padding:16px}
.ci-summary{display:flex;gap:16px;margin-top:8px;font-size:11px;color:var(--ink-d)}
.ci-summary strong{color:var(--ink)}
`;
document.head.appendChild(css);

// ========== RENDER CHECK-IN PANEL ==========
async function renderCheckInPanel() {
  const today = new Date().toISOString().split('T')[0];
  
  // Fetch today's check-ins and check-outs
  const [arrivals, departures] = await Promise.all([
    sb.from('bookings')
      .select('id, apartment_id, guest_name, guest_phone, check_in, check_out, source, checked_in, check_in_time, booking_ref, nights, total_price')
      .eq('check_in', today)
      .neq('status', 'cancelled')
      .order('check_in_time', {ascending: true, nullsFirst: false}),
    sb.from('bookings')
      .select('id, apartment_id, guest_name, check_out, checked_out, source, booking_ref')
      .eq('check_out', today)
      .neq('status', 'cancelled')
  ]);

  const arrData = arrivals.data || [];
  const depData = departures.data || [];
  const allApts = window._allApts || [];

  // Find the check-in container in dashboard
  let container = document.getElementById('ci-arrivals');
  if (!container) {
    // Create the panel after the first row of dashboard cards
    const dashTab = document.getElementById('tab-dash');
    if (!dashTab) return;
    
    // Find the first row of stat cards (Заезды, Выезды, Сообщения, Загрузка)
    const firstRow = dashTab.querySelector('.drow, .d-row, [style*="grid"], [style*="flex"]');
    
    // Create check-in/out panels
    const panelHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0" id="ci-panels">
        <div class="ci-panel" id="ci-arrivals"></div>
        <div class="ci-panel" id="ci-departures"></div>
      </div>
    `;
    
    // Insert after first row
    if (firstRow) {
      firstRow.insertAdjacentHTML('afterend', panelHTML);
    } else {
      dashTab.insertAdjacentHTML('afterbegin', panelHTML);
    }
    container = document.getElementById('ci-arrivals');
  }

  const depContainer = document.getElementById('ci-departures');
  
  // ===== ARRIVALS =====
  const checkedCount = arrData.filter(b => b.checked_in).length;
  const waitingCount = arrData.length - checkedCount;
  
  let arrHTML = `
    <div class="ci-title">
      ✈️ Заезды сегодня 
      <span class="ci-badge">${arrData.length}</span>
      ${waitingCount > 0 ? `<span style="color:var(--gold);font-size:10px">⏳ ${waitingCount} ожидают</span>` : ''}
      ${checkedCount > 0 ? `<span style="color:var(--green,#2ecc71);font-size:10px">✅ ${checkedCount} заселены</span>` : ''}
    </div>
    <div class="ci-list">
  `;
  
  if (arrData.length === 0) {
    arrHTML += '<div class="ci-empty">Нет заездов сегодня</div>';
  } else {
    arrData.forEach(bk => {
      const apt = allApts.find(a => a.id === bk.apartment_id);
      const aptName = apt ? apt.name : bk.apartment_id;
      const isCheckedIn = bk.checked_in;
      const rowClass = isCheckedIn ? 'checked-in' : 'waiting';
      const srcLabel = {airbnb:'Airbnb',booking:'Booking',ostrovok:'Ostrovok',website:'Сайт',phone:'Тел'}[bk.source] || bk.source || '';
      
      arrHTML += `
        <div class="ci-row ${rowClass}" data-id="${bk.id}">
          <div class="ci-apt">${aptName}</div>
          <div class="ci-guest">${bk.guest_name || '—'} ${bk.guest_phone ? '· ' + bk.guest_phone : ''}</div>
          <div class="ci-source">${srcLabel}</div>
          <div class="ci-time">
            <span style="font-size:10px;color:var(--ink-d)">🕐</span>
            <input type="time" value="${bk.check_in_time || ''}" placeholder="14:00" 
              onchange="window._ciSetTime('${bk.id}', this.value)" 
              title="Время заезда">
          </div>
          <button class="ci-btn ${isCheckedIn ? 'active' : ''}" 
            onclick="window._ciToggle('${bk.id}', ${!isCheckedIn})">
            ${isCheckedIn ? '✅ Заселён' : '⏳ Ожидает'}
          </button>
        </div>
      `;
    });
  }
  arrHTML += '</div>';
  container.innerHTML = arrHTML;

  // ===== DEPARTURES =====
  const doneCount = depData.filter(b => b.checked_out).length;
  
  let depHTML = `
    <div class="ci-title">
      🚪 Выезды сегодня 
      <span class="ci-badge">${depData.length}</span>
      ${doneCount > 0 ? `<span style="color:var(--ink-d);font-size:10px">✅ ${doneCount} выехали</span>` : ''}
    </div>
    <div class="ci-list">
  `;
  
  if (depData.length === 0) {
    depHTML += '<div class="ci-empty">Нет выездов сегодня</div>';
  } else {
    depData.forEach(bk => {
      const apt = allApts.find(a => a.id === bk.apartment_id);
      const aptName = apt ? apt.name : bk.apartment_id;
      const isDone = bk.checked_out;
      const rowClass = isDone ? 'checked-out' : '';
      const srcLabel = {airbnb:'Airbnb',booking:'Booking',ostrovok:'Ostrovok',website:'Сайт'}[bk.source] || bk.source || '';
      
      depHTML += `
        <div class="ci-row ${rowClass}" data-id="${bk.id}">
          <div class="ci-apt">${aptName}</div>
          <div class="ci-guest">${bk.guest_name || '—'}</div>
          <div class="ci-source">${srcLabel}</div>
          <button class="ci-btn ${isDone ? 'out-active' : ''}" 
            onclick="window._ciToggleOut('${bk.id}', ${!isDone})">
            ${isDone ? '✅ Выехал' : '🏠 В квартире'}
          </button>
        </div>
      `;
    });
  }
  depHTML += '</div>';
  if (depContainer) depContainer.innerHTML = depHTML;
}

// ========== ACTIONS ==========
window._ciToggle = async function(id, val) {
  const { error } = await sb.from('bookings').update({
    checked_in: val,
    updated_at: new Date().toISOString()
  }).eq('id', id);
  if (error) { alert('Ошибка: ' + error.message); return; }
  renderCheckInPanel();
};

window._ciSetTime = async function(id, time) {
  const { error } = await sb.from('bookings').update({
    check_in_time: time,
    updated_at: new Date().toISOString()
  }).eq('id', id);
  if (error) alert('Ошибка: ' + error.message);
};

window._ciToggleOut = async function(id, val) {
  const { error } = await sb.from('bookings').update({
    checked_out: val,
    updated_at: new Date().toISOString()
  }).eq('id', id);
  if (error) { alert('Ошибка: ' + error.message); return; }
  renderCheckInPanel();
};

// ========== INIT ==========
// Wait for data to load, then render
const origRDash = window.rDash;
if (origRDash) {
  window.rDash = function() {
    origRDash.apply(this, arguments);
    setTimeout(renderCheckInPanel, 500);
  };
}

// Also render on tab switch to dashboard
const origSwitchTab = window.switchTab;
if (origSwitchTab) {
  window.switchTab = function(tab) {
    origSwitchTab.apply(this, arguments);
    if (tab === 'dash') setTimeout(renderCheckInPanel, 800);
  };
}

// Initial render after page load
setTimeout(renderCheckInPanel, 3000);

console.log('[Check-in Upgrade] Учёт заселения загружен ✓');
})();
