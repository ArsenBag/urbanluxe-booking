/* checkin-upgrade.js v2 — Toggle заселения прямо в строках заездов/выездов
   Подключение: <script src="/checkin-upgrade.js"></script> перед </body>
   
   Инжектит:
   - Toggle «Заселён» в каждую строку заездов
   - Поле времени заезда
   - Toggle «Выехал» в каждую строку выездов
   - Цветовую индикацию
   НЕ создаёт отдельных панелей
*/
(function(){
'use strict';

const css = document.createElement('style');
css.textContent = `
.ci-toggle{position:relative;width:34px;height:18px;flex-shrink:0;cursor:pointer}
.ci-toggle input{opacity:0;width:0;height:0;position:absolute}
.ci-toggle .ci-slider{position:absolute;inset:0;background:var(--line);border-radius:9px;transition:background .3s}
.ci-toggle .ci-slider::before{content:'';position:absolute;left:2px;top:2px;width:14px;height:14px;background:#888;border-radius:50%;transition:transform .3s,background .3s}
.ci-toggle input:checked+.ci-slider{background:rgba(46,204,113,.3)}
.ci-toggle input:checked+.ci-slider::before{transform:translateX(16px);background:#2ecc71}
.ci-toggle.co input:checked+.ci-slider{background:rgba(107,102,94,.3)}
.ci-toggle.co input:checked+.ci-slider::before{background:#6b665e}
.ci-time-input{width:58px;padding:2px 4px;background:var(--bg);border:1px solid var(--line);color:var(--ink);font-size:10px;font-family:inherit;border-radius:3px;text-align:center;flex-shrink:0}
.ci-time-input:focus{border-color:var(--gold);outline:none}
.ci-status{font-size:9px;min-width:52px;text-align:center;padding:2px 4px;border-radius:3px;flex-shrink:0}
.ci-status.in{background:rgba(46,204,113,.12);color:#2ecc71}
.ci-status.wait{background:rgba(201,169,97,.12);color:var(--gold)}
.ci-status.out{background:rgba(107,102,94,.12);color:#999}
[data-ci-row].ci-done{opacity:.5}
`;
document.head.appendChild(css);

function removeOldPanels(){const old=document.getElementById('ci-panels');if(old)old.remove()}

async function injectCheckinToggles(){
  removeOldPanels();
  const today=new Date().toISOString().split('T')[0];
  const allApts=window._allApts||[];

  // Fetch existing check-in statuses from bookings table
  const[arrRes,depRes]=await Promise.all([
    sb.from('bookings').select('id,apartment_id,checked_in,check_in_time').eq('check_in',today).neq('status','cancelled'),
    sb.from('bookings').select('id,apartment_id,checked_out').eq('check_out',today).neq('status','cancelled')
  ]);
  const dbArrivals=arrRes.data||[];
  const dbDepartures=depRes.data||[];

  // Helper: find or create booking record for iCal arrivals
  async function ensureBooking(aptId, date, type){
    // Check if DB booking exists
    const existing = type==='in'
      ? dbArrivals.find(b=>b.apartment_id===aptId)
      : dbDepartures.find(b=>b.apartment_id===aptId);
    if(existing) return existing;
    // No DB record — this is an iCal-only booking, insert minimal record
    const co = type==='in' ? undefined : date;
    const ci = type==='in' ? date : undefined;
    // Don't create — just use localStorage fallback
    return null;
  }

  function addToggle(container, type){
    if(!container) return;
    const rows=[...container.querySelectorAll('div[style*="cursor:pointer"]')];
    rows.forEach(row=>{
      if(row.querySelector('.ci-toggle'))return;
      const nameEl=row.querySelector('strong');
      if(!nameEl)return;
      const nameText=nameEl.textContent.trim();
      const aptMatch=nameText.match(/Апартамент\s+(\d+)/);
      if(!aptMatch)return;
      const aptNum=aptMatch[1];
      const apt=allApts.find(a=>a.name==='Апартамент '+aptNum);
      if(!apt)return;

      const dbRecord = type==='in'
        ? dbArrivals.find(b=>b.apartment_id===apt.id)
        : dbDepartures.find(b=>b.apartment_id===apt.id);

      // State: prefer DB, fallback to localStorage
      const lsKey=`ci_${type}_${apt.id}_${today}`;
      const lsTimeKey=`ci_time_${apt.id}_${today}`;
      const isActive = dbRecord
        ? (type==='in' ? dbRecord.checked_in : dbRecord.checked_out)
        : localStorage.getItem(lsKey)==='1';
      const timeVal = dbRecord?.check_in_time || localStorage.getItem(lsTimeKey) || '';

      const w=document.createElement('span');
      w.style.cssText='display:flex;align-items:center;gap:4px;margin-left:auto;flex-shrink:0;';
      
      if(type==='in'){
        w.innerHTML=`<input type="time" class="ci-time-input" value="${timeVal}" title="Время заезда" onclick="event.stopPropagation()" onchange="window._ciSetTime3('${apt.id}','${dbRecord?.id||''}',this.value)"><label class="ci-toggle" onclick="event.stopPropagation()"><input type="checkbox" ${isActive?'checked':''} onchange="window._ciToggle3('${apt.id}','${dbRecord?.id||''}','in',this.checked,this)"><span class="ci-slider"></span></label><span class="ci-status ${isActive?'in':'wait'}">${isActive?'✅ Заселён':'⏳ Ждём'}</span>`;
      } else {
        w.innerHTML=`<label class="ci-toggle co" onclick="event.stopPropagation()"><input type="checkbox" ${isActive?'checked':''} onchange="window._ciToggle3('${apt.id}','${dbRecord?.id||''}','out',this.checked,this)"><span class="ci-slider"></span></label><span class="ci-status ${isActive?'out':'wait'}">${isActive?'✅ Выехал':'🏠 Здесь'}</span>`;
      }
      row.appendChild(w);
      row.setAttribute('data-ci-row',apt.id);
      if(isActive)row.classList.add('ci-done');
    });
  }

  addToggle(document.getElementById('todayCheckins'), 'in');
  addToggle(document.getElementById('todayCheckouts'), 'out');
}

window._ciToggle3=async function(aptId,dbId,type,val,el){
  const today=new Date().toISOString().split('T')[0];
  const lsKey=`ci_${type}_${aptId}_${today}`;
  localStorage.setItem(lsKey,val?'1':'0');
  if(dbId){
    const field=type==='in'?'checked_in':'checked_out';
    await sb.from('bookings').update({[field]:val,updated_at:new Date().toISOString()}).eq('id',dbId);
  }
  const row=el.closest('[data-ci-row]');const status=row?.querySelector('.ci-status');
  if(type==='in'){
    if(status){status.className='ci-status '+(val?'in':'wait');status.textContent=val?'✅ Заселён':'⏳ Ждём'}
  } else {
    if(status){status.className='ci-status '+(val?'out':'wait');status.textContent=val?'✅ Выехал':'🏠 Здесь'}
  }
  if(row)row.classList.toggle('ci-done',val);
};
window._ciSetTime3=async function(aptId,dbId,time){
  const today=new Date().toISOString().split('T')[0];
  localStorage.setItem(`ci_time_${aptId}_${today}`,time);
  if(dbId) await sb.from('bookings').update({check_in_time:time,updated_at:new Date().toISOString()}).eq('id',dbId);
};

// Use MutationObserver to detect when todayCheckins/todayCheckouts get populated
let injectTimeout = null;
function scheduleInject() {
  if (injectTimeout) clearTimeout(injectTimeout);
  injectTimeout = setTimeout(injectCheckinToggles, 600);
}

function setupObserver() {
  const ci = document.getElementById('todayCheckins');
  const co = document.getElementById('todayCheckouts');
  const observer = new MutationObserver(scheduleInject);
  if (ci) observer.observe(ci, {childList: true, subtree: true});
  if (co) observer.observe(co, {childList: true, subtree: true});
}

// Watch for todayCheckins to appear in DOM
const bodyObserver = new MutationObserver(() => {
  if (document.getElementById('todayCheckins')) {
    bodyObserver.disconnect();
    setupObserver();
    scheduleInject();
  }
});
if (document.getElementById('todayCheckins')) {
  setupObserver();
  scheduleInject();
} else {
  bodyObserver.observe(document.body, {childList: true, subtree: true});
}

// Also re-inject on tab switch
const origSwitch=window.switchTab;
if(origSwitch){window.switchTab=function(tab){origSwitch.apply(this,arguments);if(tab==='dash'){setTimeout(()=>{setupObserver();scheduleInject()},1500)}}}

console.log('[Check-in Upgrade v2] Ползунки заселения загружены ✓');
})();
