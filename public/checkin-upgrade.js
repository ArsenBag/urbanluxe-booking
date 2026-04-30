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
  const[arrRes,depRes]=await Promise.all([
    sb.from('bookings').select('id,apartment_id,checked_in,check_in_time').eq('check_in',today).neq('status','cancelled'),
    sb.from('bookings').select('id,apartment_id,checked_out').eq('check_out',today).neq('status','cancelled')
  ]);
  const arrivals=arrRes.data||[];const departures=depRes.data||[];const allApts=window._allApts||[];

  const ciContainer=document.getElementById('todayCheckins');
  if(ciContainer){
    const rows=[...ciContainer.querySelectorAll('div[style*="cursor:pointer"]')];
    rows.forEach(row=>{
      if(row.querySelector('.ci-toggle'))return;
      const text=row.textContent;const aptMatch=text.match(/Апартамент\s+(\d+)/);
      if(!aptMatch)return;
      const aptNum=aptMatch[1];
      const apt=allApts.find(a=>a.name&&a.name.includes(aptNum));
      const booking=apt?arrivals.find(b=>b.apartment_id===apt.id):null;
      if(!booking)return;
      const isIn=booking.checked_in||false;const timeVal=booking.check_in_time||'';
      const w=document.createElement('span');
      w.style.cssText='display:flex;align-items:center;gap:4px;margin-left:auto;flex-shrink:0;';
      w.innerHTML=`<input type="time" class="ci-time-input" value="${timeVal}" title="Время заезда" onclick="event.stopPropagation()" onchange="window._ciSetTime2('${booking.id}',this.value)"><label class="ci-toggle" onclick="event.stopPropagation()"><input type="checkbox" ${isIn?'checked':''} onchange="window._ciToggle2('${booking.id}',this.checked,this)"><span class="ci-slider"></span></label><span class="ci-status ${isIn?'in':'wait'}">${isIn?'✅ Заселён':'⏳ Ждём'}</span>`;
      row.appendChild(w);row.setAttribute('data-ci-row',booking.id);if(isIn)row.classList.add('ci-done');
    });
  }

  const coContainer=document.getElementById('todayCheckouts');
  if(coContainer){
    const rows=[...coContainer.querySelectorAll('div[style*="cursor:pointer"]')];
    rows.forEach(row=>{
      if(row.querySelector('.ci-toggle'))return;
      const text=row.textContent;const aptMatch=text.match(/Апартамент\s+(\d+)/);
      if(!aptMatch)return;
      const aptNum=aptMatch[1];
      const apt=allApts.find(a=>a.name&&a.name.includes(aptNum));
      const booking=apt?departures.find(b=>b.apartment_id===apt.id):null;
      if(!booking)return;
      const isDone=booking.checked_out||false;
      const w=document.createElement('span');
      w.style.cssText='display:flex;align-items:center;gap:4px;margin-left:auto;flex-shrink:0;';
      w.innerHTML=`<label class="ci-toggle co" onclick="event.stopPropagation()"><input type="checkbox" ${isDone?'checked':''} onchange="window._ciToggleOut2('${booking.id}',this.checked,this)"><span class="ci-slider"></span></label><span class="ci-status ${isDone?'out':'wait'}">${isDone?'✅ Выехал':'🏠 Здесь'}</span>`;
      row.appendChild(w);row.setAttribute('data-ci-row',booking.id);if(isDone)row.classList.add('ci-done');
    });
  }
}

window._ciToggle2=async function(id,val,el){
  const{error}=await sb.from('bookings').update({checked_in:val,updated_at:new Date().toISOString()}).eq('id',id);
  if(error){alert('Ошибка: '+error.message);return}
  const row=el.closest('[data-ci-row]');const status=row?.querySelector('.ci-status');
  if(status){status.className='ci-status '+(val?'in':'wait');status.textContent=val?'✅ Заселён':'⏳ Ждём'}
  if(row)row.classList.toggle('ci-done',val);
};
window._ciSetTime2=async function(id,time){await sb.from('bookings').update({check_in_time:time,updated_at:new Date().toISOString()}).eq('id',id)};
window._ciToggleOut2=async function(id,val,el){
  const{error}=await sb.from('bookings').update({checked_out:val,updated_at:new Date().toISOString()}).eq('id',id);
  if(error){alert('Ошибка: '+error.message);return}
  const row=el.closest('[data-ci-row]');const status=row?.querySelector('.ci-status');
  if(status){status.className='ci-status '+(val?'out':'wait');status.textContent=val?'✅ Выехал':'🏠 Здесь'}
  if(row)row.classList.toggle('ci-done',val);
};

const origRDash=window.rDash;
window.rDash=function(){
  if(origRDash)origRDash.apply(this,arguments);
  setTimeout(injectCheckinToggles,800);
};
const origSwitch=window.switchTab;
if(origSwitch){window.switchTab=function(tab){origSwitch.apply(this,arguments);if(tab==='dash')setTimeout(injectCheckinToggles,1200)}}
setTimeout(injectCheckinToggles,4000);

console.log('[Check-in Upgrade v2] Ползунки заселения загружены ✓');
})();
