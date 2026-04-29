/* chess-upgrade.js — Drag & Drop шахматка для Urban Luxe admin.html
   Подключение: добавить <script src="/chess-upgrade.js"></script> перед </body> в admin.html
   Переопределяет: renderChessGrid, showBookingDetail, chessCreateBooking
   Добавляет: drag & drop, resize, booking bars, tooltips, quick-edit panel */

(function(){
'use strict';

// ===== INJECT CSS =====
const css = document.createElement('style');
css.textContent = `
/* Chess Booking Bars */
.chess-bar{position:absolute;top:2px;height:calc(100% - 5px);border-radius:4px;display:flex;align-items:center;padding:0 5px;font-size:8px;font-weight:500;color:#fff;cursor:grab;z-index:3;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;transition:box-shadow .15s;user-select:none;min-width:16px;left:2px}
.chess-bar:hover{box-shadow:0 2px 12px rgba(0,0,0,.5);z-index:4;filter:brightness(1.15)}
.chess-bar.cb-dragging{opacity:.5;z-index:10;cursor:grabbing}
.chess-bar .cb-label{overflow:hidden;text-overflow:ellipsis;flex:1;font-size:9px}
.chess-bar .cb-price{font-size:7px;opacity:.7;margin-left:3px;flex-shrink:0}
.chess-bar .cb-resize{position:absolute;right:0;top:0;bottom:0;width:7px;cursor:e-resize;z-index:5;border-radius:0 4px 4px 0}
.chess-bar .cb-resize:hover{background:rgba(255,255,255,.25)}
.chess-bar.src-airbnb{background:#FF5A5F}.chess-bar.src-booking{background:#003580}.chess-bar.src-ostrovok{background:#2ecc71}
.chess-bar.src-yandex{background:#f39c12}.chess-bar.src-sutochno{background:#3498db}.chess-bar.src-website{background:var(--gold)}
.chess-bar.src-phone{background:#9b59b6}.chess-bar.src-telegram{background:#0088cc}
.chess-bar.src-other{background:#555}.chess-bar.src-blocked{background:#222;border:1px dashed #444}
/* Drop target */
td.cb-drop{background:rgba(201,169,97,.15)!important;outline:1px dashed var(--gold)}
/* Tooltip */
#cbTooltip{position:fixed;background:var(--bg2);border:1px solid var(--line);border-radius:6px;padding:10px 12px;font-size:11px;z-index:200;pointer-events:none;box-shadow:0 8px 25px rgba(0,0,0,.6);max-width:250px;display:none;color:var(--ink)}
#cbTooltip.show{display:block}
#cbTooltip .cbt-title{font-size:12px;font-weight:500;color:var(--gold);margin-bottom:4px}
#cbTooltip .cbt-r{display:flex;justify-content:space-between;padding:1px 0;color:var(--ink-m)}
#cbTooltip .cbt-r strong{color:var(--ink)}
/* Quick Edit */
#cbQE{position:fixed;background:var(--bg2);border:1px solid var(--gold);border-radius:8px;padding:16px;z-index:210;box-shadow:0 8px 40px rgba(0,0,0,.6);width:300px;display:none;font-size:12px}
#cbQE.show{display:block}
#cbQE h3{font-size:13px;font-weight:400;color:var(--gold);margin-bottom:10px}
#cbQE label{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-d);display:block;margin-bottom:2px;margin-top:6px}
#cbQE input,#cbQE select{width:100%;padding:6px 8px;background:var(--bg);border:1px solid var(--line);color:var(--ink);font-size:12px;font-family:inherit;border-radius:3px;outline:none}
#cbQE input:focus,#cbQE select:focus{border-color:var(--gold)}
.cbqe-row{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.cbqe-acts{display:flex;gap:6px;margin-top:10px;justify-content:flex-end}
.cbqe-del{color:var(--red);background:none;border:none;font-size:10px;cursor:pointer;margin-right:auto;font-family:inherit}
`;
document.head.appendChild(css);

// ===== INJECT TOOLTIP + QE =====
if(!document.getElementById('cbTooltip')){
  const tt=document.createElement('div');tt.id='cbTooltip';document.body.appendChild(tt);
}
if(!document.getElementById('cbQE')){
  const qe=document.createElement('div');qe.id='cbQE';
  qe.innerHTML=`<h3 id="cbqeTitle">Редактировать</h3>
<input type="hidden" id="cbqeId"><input type="hidden" id="cbqeApt">
<div class="cbqe-row"><div><label>Заезд</label><input type="date" id="cbqeCI"></div><div><label>Выезд</label><input type="date" id="cbqeCO"></div></div>
<label>Гость</label><input type="text" id="cbqeGuest" placeholder="Имя">
<div class="cbqe-row"><div><label>Цена ($)</label><input type="number" id="cbqePrice" placeholder="0"></div><div><label>Источник</label><select id="cbqeSrc"><option value="website">Сайт</option><option value="airbnb">Airbnb</option><option value="booking">Booking</option><option value="ostrovok">Ostrovok</option><option value="yandex">Яндекс</option><option value="phone">Телефон</option><option value="blocked">Блок</option></select></div></div>
<label>Телефон</label><input type="text" id="cbqePhone" placeholder="+998...">
<div class="cbqe-acts"><button class="cbqe-del" id="cbqeDelBtn" onclick="window._cbDeleteBooking()">🗑 Удалить</button><button class="btn btn-sm btn-outline" onclick="window._cbCloseQE()">Отмена</button><button class="btn btn-sm" onclick="window._cbSaveQE()">💾</button></div>`;
  document.body.appendChild(qe);
}

// ===== CONSTANTS =====
const SRC_CLS={airbnb:'src-airbnb',booking:'src-booking',ostrovok:'src-ostrovok',yandex:'src-yandex',sutochno:'src-sutochno',website:'src-website',phone:'src-phone',telegram:'src-telegram',blocked:'src-blocked',other:'src-other'};
const SRC_NM={airbnb:'Airbnb',booking:'Booking.com',ostrovok:'Ostrovok',yandex:'Яндекс',website:'Сайт',phone:'Телефон',blocked:'Блок',other:'RC/Другое'};
const CX_CL={'Nest One':'#2ecc71','U-Tower':'#3498db','U-Tower 2':'#3498db','Mirabad':'#e67e22','Kislorod':'#e74c3c'};

// ===== HELPERS =====
function fmtD(y,m,d){return`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`}
function dayOf(ds){return parseInt(ds.split('-')[2])}
function dDiff(a,b){return Math.round((new Date(b)-new Date(a))/864e5)}
function addD(ds,n){const d=new Date(ds);d.setDate(d.getDate()+n);return d.toISOString().split('T')[0]}

// ===== MERGE BOOKINGS =====
function mergedBookings(aptId){
  const db=(chessDbData||[]).filter(b=>b.apartment_id===aptId);
  const ic=(chessIcalData||[]).filter(b=>b.apartment_id===aptId);
  const m=[...db];
  ic.forEach(i=>{
    if(!db.some(d=>d.check_in===i.check_in))
      m.push({id:'ical_'+i.check_in+'_'+aptId,apartment_id:aptId,guest_name:i.summary||'',check_in:i.check_in,check_out:i.check_out,total_price:null,source:i.source||'other',status:'confirmed',nights:i.nights||1,_ical:true});
  });
  return m;
}

// ===== OVERRIDE renderChessGrid =====
window.renderChessGrid = function(){
  const el=document.getElementById('chessGrid');
  const apts=window._allApts||[];
  if(!apts.length||!chessIcalData){el.innerHTML='<div style="color:var(--ink-d);padding:20px;text-align:center">Нет данных. Нажмите 🔄</div>';return}

  const dm=new Date(chessYear,chessMonth+1,0).getDate();
  const today=new Date().toISOString().split('T')[0];
  const dayNames=['вс','пн','вт','ср','чт','пт','сб'];
  const label=document.getElementById('chessMonthLabel');
  label.textContent=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][chessMonth]+' '+chessYear;

  // Group by complex
  const groups={};
  apts.forEach(a=>{const cx=a.complex==='U-Tower 2'?'U-Tower':a.complex;if(!groups[cx])groups[cx]=[];groups[cx].push(a)});

  // Build table
  let h='<table style="border-collapse:collapse;width:100%;min-width:'+(160+dm*38)+'px;font-size:11px">';
  
  // Header
  h+='<thead><tr><th style="position:sticky;left:0;z-index:6;background:var(--bg);padding:4px 8px;text-align:left;min-width:150px;border-bottom:2px solid var(--line);font-size:10px;color:var(--ink-d)">Апартамент</th>';
  for(let d=1;d<=dm;d++){
    const dt=new Date(chessYear,chessMonth,d);
    const ds=fmtD(chessYear,chessMonth,d);
    const isT=ds===today, isW=dt.getDay()===0||dt.getDay()===6;
    h+=`<th style="padding:2px 0;min-width:36px;text-align:center;border-bottom:2px solid var(--line);${isT?'background:rgba(201,169,97,.12);':''}${isW?'color:var(--red);':'color:var(--ink-d);'}font-weight:${isT?700:400}"><div style="font-size:8px">${dayNames[dt.getDay()]}</div>${d}</th>`;
  }
  h+='</tr></thead><tbody>';

  let totalOcc=0,totalCells=0;
  const cxOrder=['Kislorod','Mirabad','Nest One','U-Tower'];
  
  cxOrder.forEach(cx=>{
    if(!groups[cx])return;
    h+=`<tr><td colspan="${dm+1}" style="padding:6px 8px;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:${CX_CL[cx]||'#888'};border-top:2px solid var(--line);background:var(--bg)"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${CX_CL[cx]||'#888'};margin-right:6px"></span>${cx} (${groups[cx].length})</td></tr>`;

    groups[cx].forEach(apt=>{
      const bks=mergedBookings(apt.id);
      h+=`<tr><td style="position:sticky;left:0;z-index:4;background:var(--bg2);padding:3px 8px;border-bottom:1px solid var(--line);border-right:1px solid var(--line);font-size:11px;font-weight:500;white-space:nowrap">${apt.name}</td>`;
      
      for(let d=1;d<=dm;d++){
        const ds=fmtD(chessYear,chessMonth,d);
        const isT=ds===today, isW=new Date(chessYear,chessMonth,d).getDay()%6===0;
        const booked=bks.some(b=>ds>=b.check_in&&ds<b.check_out);
        totalCells++;if(booked)totalOcc++;
        
        h+=`<td data-apt="${apt.id}" data-date="${ds}" data-day="${d}" style="padding:0;height:30px;border-bottom:1px solid var(--line);border-right:1px solid var(--line);position:relative;cursor:pointer;${isT&&!booked?'background:rgba(201,169,97,.04);':''}${isW&&!booked?'background:rgba(231,76,60,.015);':''}"></td>`;
      }
      h+='</tr>';
    });
  });
  
  h+='</tbody></table>';
  el.innerHTML=h;

  // Overlay booking bars
  apts.forEach(apt=>{
    const bks=mergedBookings(apt.id);
    const monthStart=fmtD(chessYear,chessMonth,1);
    const monthEnd=fmtD(chessYear,chessMonth,dm);
    
    bks.forEach(bk=>{
      if(bk.check_out<=monthStart||bk.check_in>monthEnd)return;
      const sd=Math.max(1,dayOf(bk.check_in));
      const rawEnd=dayOf(bk.check_out);
      const ed=bk.check_out>monthEnd?dm:Math.max(sd,rawEnd-1);
      if(ed<sd)return;
      
      const cell=el.querySelector(`td[data-apt="${apt.id}"][data-day="${sd}"]`);
      if(!cell)return;
      
      const span=ed-sd+1;
      const bar=document.createElement('div');
      bar.className=`chess-bar ${SRC_CLS[bk.source]||'src-other'}`;
      bar.style.width=`calc(${span} * 100% + ${(span-1)}px)`;
      bar.dataset.bid=bk.id;bar.dataset.apt=apt.id;bar.dataset.ci=bk.check_in;bar.dataset.co=bk.check_out;bar.dataset.ical=bk._ical?'1':'0';

      const guest=bk.guest_name||'';
      const ref=bk.booking_ref||'';
      const pn=bk.total_price&&bk.nights?Math.round(bk.total_price/bk.nights):null;
      bar.innerHTML=`<span class="cb-label">${ref?ref+' ':''}${guest}</span>${pn?'<span class="cb-price">$'+pn+'</span>':''}${bk._ical?'':'<div class="cb-resize"></div>'}`;

      // Events
      bar.addEventListener('mouseenter',e=>_cbShowTT(e,bk,apt));
      bar.addEventListener('mouseleave',_cbHideTT);
      bar.addEventListener('click',e=>{e.stopPropagation();if(!bar.classList.contains('cb-dragging'))_cbOpenQE(bk,apt,e)});
      if(!bk._ical){
        bar.addEventListener('mousedown',e=>_cbMouseDown(e,bk,bar));
      }
      cell.appendChild(bar);
    });
  });

  // Click empty cells → new booking
  el.querySelectorAll('td[data-apt][data-date]').forEach(td=>{
    td.addEventListener('click',e=>{
      if(e.target===td||e.target.tagName==='TD'){
        _cbNewAt(td.dataset.apt,td.dataset.date,e);
      }
    });
  });

  // Stats
  const occPct=totalCells?Math.round(totalOcc/totalCells*100):0;
  let cxStats='';
  cxOrder.forEach(cx=>{
    if(!groups[cx])return;
    let ct=0,cb=0;
    groups[cx].forEach(apt=>{
      const bks=mergedBookings(apt.id);
      for(let d=1;d<=dm;d++){const ds=fmtD(chessYear,chessMonth,d);ct++;if(bks.some(b=>ds>=b.check_in&&ds<b.check_out))cb++}
    });
    const p=ct?Math.round(cb/ct*100):0;
    cxStats+=`<span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:${CX_CL[cx]||'#888'}"></span>${cx}: <strong style="color:${p>80?'var(--green)':p>50?'var(--gold)':'var(--red)'}">${p}%</strong></span>`;
  });
  document.getElementById('chessStats').innerHTML=`<span>Загрузка: <strong style="color:${occPct>80?'var(--green)':occPct>50?'var(--gold)':'var(--red)'}">${occPct}%</strong></span><span>Занято: <strong>${totalOcc}</strong>/${totalCells}</span>${cxStats}<span style="flex:1"></span><span style="color:var(--ink-d);font-size:10px">Drag для перемещения · Правый край для продления · Клик для edit</span>`;

  renderCleaningTasks();
};

// ===== DRAG & DROP =====
let _drag=null;

function _cbMouseDown(e,bk,bar){
  if(e.button!==0)return;
  const isResize=e.target.classList.contains('cb-resize');
  _drag={bk,bar,mode:isResize?'resize':'move',sx:e.clientX,sy:e.clientY,moved:false,origCI:bk.check_in,origCO:bk.check_out,origApt:bk.apartment_id};
  document.addEventListener('mousemove',_cbDragMove);
  document.addEventListener('mouseup',_cbDragEnd);
  e.preventDefault();
}

function _cbDragMove(e){
  if(!_drag)return;
  const dx=e.clientX-_drag.sx,dy=e.clientY-_drag.sy;
  if(!_drag.moved&&Math.abs(dx)<4&&Math.abs(dy)<4)return;
  _drag.moved=true;
  _drag.bar.classList.add('cb-dragging');
  _cbHideTT();

  document.querySelectorAll('.cb-drop').forEach(c=>c.classList.remove('cb-drop'));

  if(_drag.mode==='move'){
    _drag.bar.style.transform=`translate(${dx}px,${dy}px)`;
    _drag.bar.style.zIndex='10';
    // Find target cell
    _drag.bar.style.pointerEvents='none';
    const under=document.elementFromPoint(e.clientX,e.clientY);
    _drag.bar.style.pointerEvents='';
    const cell=under?.closest?.('td[data-apt][data-date]');
    if(cell){cell.classList.add('cb-drop');_drag.tDate=cell.dataset.date;_drag.tApt=cell.dataset.apt}
  } else {
    // Resize
    const cellW=_drag.bar.parentElement?.offsetWidth||36;
    const daysD=Math.round(dx/cellW);
    const origN=dDiff(_drag.origCI,_drag.origCO);
    const newN=Math.max(1,origN+daysD);
    _drag.bar.style.width=`calc(${newN} * 100% + ${(newN-1)}px)`;
    _drag.newCO=addD(_drag.origCI,newN);
  }
}

async function _cbDragEnd(){
  document.removeEventListener('mousemove',_cbDragMove);
  document.removeEventListener('mouseup',_cbDragEnd);
  if(!_drag)return;
  document.querySelectorAll('.cb-drop').forEach(c=>c.classList.remove('cb-drop'));
  _drag.bar.classList.remove('cb-dragging');
  _drag.bar.style.transform='';_drag.bar.style.zIndex='';

  if(!_drag.moved){_drag=null;return}

  const bk=_drag.bk;

  if(_drag.mode==='move'&&_drag.tDate){
    const nights=dDiff(bk.check_in,bk.check_out);
    const nCI=_drag.tDate, nCO=addD(nCI,nights), nApt=_drag.tApt||bk.apartment_id;
    if(nCI!==bk.check_in||nApt!==bk.apartment_id){
      const{error}=await sb.from('bookings').update({check_in:nCI,check_out:nCO,apartment_id:nApt,updated_at:new Date().toISOString()}).eq('id',bk.id);
      if(error)alert('Ошибка: '+error.message);
      else loadChessmate();
    }
  } else if(_drag.mode==='resize'&&_drag.newCO&&_drag.newCO!==bk.check_out){
    const nights=dDiff(bk.check_in,_drag.newCO);
    const{error}=await sb.from('bookings').update({check_out:_drag.newCO,nights,updated_at:new Date().toISOString()}).eq('id',bk.id);
    if(error)alert('Ошибка: '+error.message);
    else loadChessmate();
  }
  _drag=null;
}

// ===== TOOLTIP =====
function _cbShowTT(e,bk,apt){
  const tt=document.getElementById('cbTooltip');
  const n=bk.nights||dDiff(bk.check_in,bk.check_out);
  const ppn=bk.total_price?Math.round(bk.total_price/Math.max(1,n)):null;
  tt.innerHTML=`<div class="cbt-title">${apt.name} · ${apt.complex||''}</div>
<div class="cbt-r"><span>Гость</span><strong>${bk.guest_name||'—'}</strong></div>
<div class="cbt-r"><span>Даты</span><strong>${bk.check_in} → ${bk.check_out}</strong></div>
<div class="cbt-r"><span>Ночей</span><strong>${n}</strong></div>
${bk.total_price?`<div class="cbt-r"><span>Цена</span><strong>$${bk.total_price}${ppn?' ($'+ppn+'/н)':''}</strong></div>`:''}
<div class="cbt-r"><span>Источник</span><strong>${SRC_NM[bk.source]||bk.source||'—'}</strong></div>
${bk.booking_ref?`<div class="cbt-r"><span>Реф</span><strong>${bk.booking_ref}</strong></div>`:''}
${bk._ical?'<div style="color:var(--ink-d);font-size:9px;margin-top:4px">📋 RealtyCalendar (только чтение)</div>':'<div style="color:var(--ink-d);font-size:9px;margin-top:4px">Drag для перемещения · Клик для редактирования</div>'}`;
  tt.style.left=Math.min(e.clientX+10,window.innerWidth-270)+'px';
  tt.style.top=Math.min(e.clientY+10,window.innerHeight-200)+'px';
  tt.classList.add('show');
}
function _cbHideTT(){document.getElementById('cbTooltip').classList.remove('show')}

// ===== QUICK EDIT =====
function _cbOpenQE(bk,apt,e){
  _cbHideTT();
  const qe=document.getElementById('cbQE');
  document.getElementById('cbqeTitle').textContent=bk._ical?`${apt.name} (только чтение)`:`✎ ${apt.name}`;
  document.getElementById('cbqeId').value=bk.id;
  document.getElementById('cbqeApt').value=bk.apartment_id;
  document.getElementById('cbqeCI').value=bk.check_in;
  document.getElementById('cbqeCO').value=bk.check_out;
  document.getElementById('cbqeGuest').value=bk.guest_name||'';
  document.getElementById('cbqePrice').value=bk.total_price||'';
  document.getElementById('cbqeSrc').value=bk.source||'website';
  document.getElementById('cbqePhone').value=bk.guest_phone||'';
  document.getElementById('cbqeDelBtn').style.display=bk._ical?'none':'inline';
  qe.querySelectorAll('input,select').forEach(i=>i.disabled=!!bk._ical);
  qe.style.left=Math.min(e.clientX,window.innerWidth-320)+'px';
  qe.style.top=Math.min(Math.max(10,e.clientY-60),window.innerHeight-350)+'px';
  qe.classList.add('show');
  setTimeout(()=>document.addEventListener('click',_cbQEOutside),10);
}
window._cbCloseQE=function(){document.getElementById('cbQE').classList.remove('show');document.removeEventListener('click',_cbQEOutside)};
function _cbQEOutside(e){if(!document.getElementById('cbQE').contains(e.target))window._cbCloseQE()}

window._cbSaveQE=async function(){
  const id=document.getElementById('cbqeId').value;
  if(!id||id.startsWith('ical_'))return;
  const ci=document.getElementById('cbqeCI').value,co=document.getElementById('cbqeCO').value;
  const nights=dDiff(ci,co);
  const upd={check_in:ci,check_out:co,nights,guest_name:document.getElementById('cbqeGuest').value,total_price:parseFloat(document.getElementById('cbqePrice').value)||0,source:document.getElementById('cbqeSrc').value,guest_phone:document.getElementById('cbqePhone').value,updated_at:new Date().toISOString()};
  const{error}=await sb.from('bookings').update(upd).eq('id',id);
  if(error){alert(error.message);return}
  window._cbCloseQE();loadChessmate();
};

window._cbDeleteBooking=async function(){
  const id=document.getElementById('cbqeId').value;
  if(!confirm('Удалить бронь?'))return;
  await sb.from('bookings').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('id',id);
  window._cbCloseQE();loadChessmate();
};

// ===== NEW BOOKING (click empty cell) =====
function _cbNewAt(aptId,date,e){
  const apt=(window._allApts||[]).find(a=>a.id===aptId);
  const qe=document.getElementById('cbQE');
  document.getElementById('cbqeTitle').textContent=`➕ ${apt?.name||aptId}`;
  document.getElementById('cbqeId').value='_new_';
  document.getElementById('cbqeApt').value=aptId;
  document.getElementById('cbqeCI').value=date;
  document.getElementById('cbqeCO').value=addD(date,1);
  document.getElementById('cbqeGuest').value='';
  document.getElementById('cbqePrice').value='';
  document.getElementById('cbqeSrc').value='website';
  document.getElementById('cbqePhone').value='';
  document.getElementById('cbqeDelBtn').style.display='none';
  qe.querySelectorAll('input,select').forEach(i=>i.disabled=false);
  qe.style.left=Math.min(e.clientX,window.innerWidth-320)+'px';
  qe.style.top=Math.min(Math.max(10,e.clientY-60),window.innerHeight-350)+'px';
  qe.classList.add('show');

  // Temporarily override save
  const origSave=window._cbSaveQE;
  window._cbSaveQE=async function(){
    const ci=document.getElementById('cbqeCI').value,co=document.getElementById('cbqeCO').value;
    const src=document.getElementById('cbqeSrc').value;
    const{error}=await sb.from('bookings').insert({
      apartment_id:aptId,
      guest_name:src==='blocked'?'🔒 БЛОКИРОВКА':(document.getElementById('cbqeGuest').value||'Гость'),
      guest_phone:document.getElementById('cbqePhone').value,
      check_in:ci,check_out:co,nights:dDiff(ci,co),
      total_price:parseFloat(document.getElementById('cbqePrice').value)||0,
      source:src,status:src==='blocked'?'blocked':'confirmed'
    });
    if(error){alert(error.message);return}
    window._cbSaveQE=origSave;
    window._cbCloseQE();loadChessmate();
  };
  setTimeout(()=>document.addEventListener('click',_cbQEOutside),10);
}

// Override old modal-based functions to prevent conflicts
window.showBookingDetail=function(){};
window.chessCreateBooking=function(){};

console.log('[Chess Upgrade] Drag & drop шахматка загружена ✓');
})();
