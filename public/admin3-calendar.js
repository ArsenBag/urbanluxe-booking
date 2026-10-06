// Urban Luxe — admin3-calendar.js (07.10.2026). Шахматка собственного календаря (VIEWS.cal) + живая доска (VIEWS.board).
// Данные — calendar-api.js (bookings — мастер). Перенос брони перетаскиванием, создание кликом по пустой клетке,
// карточка брони: статус, оплаты, заметки. RealtyCalendar получает брони через iCal-импорт.
(function(){
const CAPI='/.netlify/functions/calendar-api';
async function capi(params,body){const t=await token();if(!t){showLogin();throw new Error('no session')}
  const r=await fetch(CAPI+(body?'':'?'+new URLSearchParams(params)),{method:body?'POST':'GET',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const j=await r.json().catch(()=>({error:'bad json'}));if(!r.ok||j.error){if(r.status===401)showLogin();throw new Error(j.error||r.status)}return j}
window.capi=capi;

const ST={request:['Запрос','#8a6d3b'],confirmed:['Подтверждена','#2b5a8a'],checked_in:['Живёт','#2f6f4e'],checked_out:['Выехал','#4a505a'],cancelled:['Отменена','#5a2e2e'],blocked:['Блок','#3a3f48']};
const CH={telegram:'Telegram',website:'Сайт',rc:'RC',ostrovok:'Ostrovok',yandex:'Яндекс',booking:'Booking',airbnb:'Airbnb',walk_in:'Без брони',corporate:'Корпоратив',ota:'OTA',other:'Другое'};
const DAYMS=86400000; const iso=d=>new Date(d).toISOString().slice(0,10); const addD=(s,k)=>iso(new Date(s+'T00:00:00Z').getTime()+k*DAYMS);
const nightsOf=(a,b)=>Math.round((new Date(b)-new Date(a))/DAYMS);
const DN=['вс','пн','вт','ср','чт','пт','сб'];
const money=(v,cur)=>v==null?'—':(cur==='RUB'?'₽':cur==='UZS'?'':'$')+Math.round(v).toLocaleString('ru-RU')+(cur==='UZS'?' сум':'');
let FROM=addD(iso(Date.now()+5*36e5),-3), DAYSN=35, G=null, COMPLEX='', DRAG=null;

// ---------------- ШАХМАТКА ----------------
VIEWS.cal=async()=>{killCharts();main.innerHTML='<div class="top"><h2>Шахматка</h2><span class="muted">загрузка…</span></div>';
  try{G=await capi({a:'grid',from:FROM,to:addD(FROM,DAYSN),complex:COMPLEX});}catch(e){main.innerHTML='<div class="panel">Ошибка: '+esc(e.message)+'</div>';return}
  renderGrid();
};
function renderGrid(){
  const days=[...Array(DAYSN)].map((_,i)=>addD(FROM,i)); const today=G.today;
  const byApt={}; G.bookings.forEach(b=>{(byApt[b.apartment_id]=byApt[b.apartment_id]||[]).push(b)});
  const complexes=[...new Set(G.apartments.map(a=>a.complex))];
  let html=`<div class="top"><h2>Шахматка</h2>
    <div class="row">
      <button class="btn ghost sm" onclick="CAL.shift(-7)">‹ неделя</button><button class="btn ghost sm" onclick="CAL.today()">сегодня</button><button class="btn ghost sm" onclick="CAL.shift(7)">неделя ›</button>
      <input type="date" value="${FROM}" onchange="CAL.setFrom(this.value)">
      <select onchange="CAL.setDays(this.value)"><option value="21" ${DAYSN==21?'selected':''}>3 недели</option><option value="35" ${DAYSN==35?'selected':''}>5 недель</option><option value="62" ${DAYSN==62?'selected':''}>2 месяца</option></select>
      <select onchange="CAL.setComplex(this.value)"><option value="">все ЖК</option>${complexes.map(c=>`<option ${COMPLEX===c?'selected':''}>${esc(c)}</option>`).join('')}</select>
      <button class="btn sm" onclick="CAL.newBooking()">+ бронь</button>
      <button class="btn ghost sm" onclick="CAL.rcSync()" title="подтянуть брони из RealtyCalendar">⟳ RC</button>
    </div></div>
    <div class="panel" style="padding:0;overflow:auto"><div class="chess" style="--n:${DAYSN}">`;
  // шапка дат
  html+=`<div class="ch-row ch-head"><div class="ch-apt">Квартира</div>`+days.map(d=>{const x=new Date(d+'T00:00:00Z');const we=x.getUTCDay()===0||x.getUTCDay()===6;return `<div class="ch-day ${we?'we':''} ${d===today?'today':''}"><b>${x.getUTCDate()}</b><small>${DN[x.getUTCDay()]}</small></div>`}).join('')+`</div>`;
  let lastC='';
  for(const a of G.apartments){
    if(a.complex!==lastC){lastC=a.complex;html+=`<div class="ch-row ch-group"><div class="ch-apt">${esc(a.complex)}</div><div class="ch-fill"></div></div>`;}
    const num=String(a.name||'').replace(/\D/g,'')||a.id;
    html+=`<div class="ch-row" data-apt="${a.id}"><div class="ch-apt"><b>${esc(num)}</b> <span class="muted">${a.floor}эт · ${esc(a.rooms||'')}</span><br><span class="muted">${a.weekday_price}/${a.weekend_price}</span></div><div class="ch-cells">`;
    html+=days.map(d=>`<div class="ch-cell ${d===today?'today':''} ${(new Date(d+'T00:00:00Z').getUTCDay()%6===0)?'we':''}" data-apt="${a.id}" data-d="${d}"></div>`).join('');
    for(const b of (byApt[a.id]||[])){
      const s=Math.max(0,nightsOf(FROM,b.check_in)), e=Math.min(DAYSN,nightsOf(FROM,b.check_out)); if(e<=s)continue;
      const st=ST[b.status]||ST.confirmed; const debt=b.currency==='USD'&&b.debt>0&&b.status!=='blocked';
      const cut1=b.check_in<FROM, cut2=b.check_out>addD(FROM,DAYSN);
      html+=`<div class="ch-bk ${b.status} ${debt?'debt':''} ${cut1?'cut1':''} ${cut2?'cut2':''}" draggable="true" data-id="${b.id}" style="--s:${s};--e:${e};background:${st[1]}" title="${esc(b.guest_name||'')} · ${b.check_in}→${b.check_out} · ${money(b.total_price,b.currency)}${debt?' · долг '+money(b.debt,b.currency):''}">
        <span class="g">${esc(b.guest_name||'Гость')}</span><span class="m">${b.status==='blocked'?'':money(b.total_price,b.currency)}${debt?' <i>!</i>':''}${b.channel&&b.channel!=='rc'&&b.channel!=='telegram'?' · '+esc(CH[b.channel]||b.channel):''}</span></div>`;
    }
    html+=`</div></div>`;
  }
  html+=`</div></div>
  <div class="row muted" style="font-size:12px">${Object.entries(ST).filter(([k])=>k!=='cancelled').map(([k,v])=>`<span><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${v[1]};margin-right:4px"></i>${v[0]}</span>`).join('')}<span><b style="color:var(--red)">!</b> долг</span><span>· клик по пустой клетке — новая бронь · перетащите бронь — перенос · клик по брони — карточка</span></div>`;
  main.innerHTML=html; bindGrid();
}
function bindGrid(){
  const root=main.querySelector('.chess');
  root.addEventListener('click',e=>{const bk=e.target.closest('.ch-bk'); if(bk){openBooking(bk.dataset.id);return;} const c=e.target.closest('.ch-cell'); if(c&&!DRAG){CAL.newBooking(c.dataset.apt,c.dataset.d);} });
  root.addEventListener('dragstart',e=>{const bk=e.target.closest('.ch-bk'); if(!bk)return; const b=G.bookings.find(x=>x.id===bk.dataset.id); const cell=e.target.closest('.ch-cells'); const rect=cell.getBoundingClientRect(); const cw=rect.width/DAYSN; const offs=Math.floor((e.clientX-rect.left)/cw)-nightsOf(FROM,b.check_in); DRAG={id:b.id,offs,nights:nightsOf(b.check_in,b.check_out)}; e.dataTransfer.effectAllowed='move'; bk.classList.add('dragging');});
  root.addEventListener('dragover',e=>{if(!DRAG)return; e.preventDefault(); const c=e.target.closest('.ch-cell'); root.querySelectorAll('.ch-cell.hint').forEach(x=>x.classList.remove('hint')); if(!c)return; const start=nightsOf(FROM,c.dataset.d)-DRAG.offs; const row=c.parentElement; [...row.querySelectorAll('.ch-cell')].forEach((x,i)=>{if(i>=start&&i<start+DRAG.nights)x.classList.add('hint')}); });
  root.addEventListener('drop',async e=>{e.preventDefault(); const c=e.target.closest('.ch-cell'); const d=DRAG; DRAG=null; root.querySelectorAll('.hint').forEach(x=>x.classList.remove('hint')); if(!c||!d)return; const ci=addD(c.dataset.d,-d.offs), co=addD(ci,d.nights); const b=G.bookings.find(x=>x.id===d.id); if(b.apartment_id===c.dataset.apt&&b.check_in===ci)return;
    try{await capi(null,{a:'update',id:d.id,apartment_id:c.dataset.apt,check_in:ci,check_out:co}); toast('Бронь перенесена'); VIEWS.cal();}catch(err){toast(err.message,true); VIEWS.cal();} });
  root.addEventListener('dragend',()=>{DRAG=null; root.querySelectorAll('.hint,.dragging').forEach(x=>x.classList.remove('hint','dragging'));});
}
window.CAL={
  shift(k){FROM=addD(FROM,k);VIEWS.cal()}, today(){FROM=addD(G.today,-3);VIEWS.cal()}, setFrom(v){if(v){FROM=v;VIEWS.cal()}}, setDays(v){DAYSN=+v;VIEWS.cal()}, setComplex(v){COMPLEX=v;VIEWS.cal()},
  async rcSync(){toast('Синхронизация с RealtyCalendar…');try{const r=await capi(null,{a:'rc_sync'});toast(`RC: получено ${r.fetched}, новых ${r.inserted}, обновлено ${r.updated}`);VIEWS.cal()}catch(e){toast(e.message,true)}},
  newBooking(apt,d){const ci=d||G.today, co=addD(ci,1); const a=G.apartments.find(x=>x.id===apt)||G.apartments[0];
    openModal(`<h3>Новая бронь</h3>
    <div class="form">
      <label>Квартира<select id="f_apt">${G.apartments.map(x=>`<option value="${x.id}" ${x.id===(a&&a.id)?'selected':''}>${esc(x.complex)} ${esc(String(x.name).replace(/\D/g,''))} · ${x.weekday_price}/${x.weekend_price}</option>`).join('')}</select></label>
      <div class="row"><label>Заезд<input type="date" id="f_ci" value="${ci}" onchange="CAL.calcPrice()"></label><label>Выезд<input type="date" id="f_co" value="${co}" onchange="CAL.calcPrice()"></label><label>Заезд в<input id="f_at" value="15:00" style="width:80px"></label></div>
      <div class="row"><label style="flex:1">Гость<input id="f_name" placeholder="Имя" list="guestList" oninput="CAL.guestLookup(this.value)"><datalist id="guestList"></datalist></label><label>Телефон<input id="f_phone" placeholder="+998…"></label><label>Telegram<input id="f_tg" placeholder="@ник"></label></div>
      <div class="row"><label>Гостей<input type="number" id="f_guests" value="2" min="1" style="width:70px"></label><label>Канал<select id="f_ch">${Object.entries(CH).filter(([k])=>k!=='rc').map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label>
        <label>Стоимость<input type="number" id="f_price" style="width:100px"></label><label>Валюта<select id="f_cur"><option>USD</option><option>RUB</option><option>UZS</option></select></label>
        <label>Оплачено сейчас<input type="number" id="f_paid" value="0" style="width:100px"></label><label>Способ<select id="f_pm"><option value="cash">наличные</option><option value="card">карта</option><option value="transfer">перевод</option><option value="payme">Payme</option><option value="click">Click</option></select></label></div>
      <label>Заметка<textarea id="f_notes" rows="2"></textarea></label>
      <div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn ghost" onclick="closeModal()">Отмена</button><button class="btn ghost" onclick="CAL.saveBooking('blocked')">Блок</button><button class="btn" onclick="CAL.saveBooking()">Создать</button></div>
    </div>`); $('#f_apt').onchange=CAL.calcPrice; CAL.calcPrice(); setTimeout(()=>$('#f_name').focus(),50);},
  calcPrice(){const a=G.apartments.find(x=>x.id===$('#f_apt').value); const ci=$('#f_ci').value, co=$('#f_co').value; if(!a||!ci||!co||co<=ci)return; let s=0; for(let d=ci; d<co; d=addD(d,1)){const w=new Date(d+'T00:00:00Z').getUTCDay(); s+=(w===5||w===6)?a.weekend_price:a.weekday_price;} const n=nightsOf(ci,co); if(n>=3)s=Math.round(s*0.9); $('#f_price').value=s; $('#f_price').title=n+' ноч.'+(n>=3?' · −10% от 3 ночей':'');},
  async guestLookup(v){if(v.length<2)return; try{const rows=await capi({a:'guest_search',q:v}); $('#guestList').innerHTML=rows.map(r=>`<option value="${esc(r.guest_name)}">${esc(r.guest_phone||'')} · был ${r.check_in}</option>`).join(''); const hit=rows.find(r=>r.guest_name===v); if(hit&&hit.guest_phone&&!$('#f_phone').value)$('#f_phone').value=hit.guest_phone;}catch(e){}},
  async saveBooking(status){const body={a:status==='blocked'?'block':'create',apartment_id:$('#f_apt').value,check_in:$('#f_ci').value,check_out:$('#f_co').value,guest_name:$('#f_name').value.trim(),guest_phone:$('#f_phone').value.trim(),guest_telegram:$('#f_tg').value.trim(),guests_count:+$('#f_guests').value||1,total_price:+$('#f_price').value||0,currency:$('#f_cur').value,channel:$('#f_ch').value,notes:$('#f_notes').value.trim(),arrival_time:$('#f_at').value.trim(),paid_now:+$('#f_paid').value||0,paid_method:$('#f_pm').value};
    try{const r=await capi(null,body); closeModal(); toast(status==='blocked'?'Блок поставлен':'Бронь создана · '+r.booking.guest_name); VIEWS.cal();}catch(e){toast(e.message,true)}},
  async setStatus(id,status){try{await capi(null,{a:'status',id,status}); toast('Статус: '+ST[status][0]); openBooking(id); if(location.hash==='#cal')refreshGridSoft(); if(location.hash==='#board')VIEWS.board();}catch(e){toast(e.message,true)}},
  async addPayment(id){const amount=+$('#p_amount').value; if(!(amount>0)){toast('Сумма',true);return} try{await capi(null,{a:'payment',booking_id:id,amount,method:$('#p_method').value,kind:$('#p_kind').value,note:$('#p_note').value,currency:$('#p_cur').value}); toast('Платёж записан'); openBooking(id); refreshGridSoft();}catch(e){toast(e.message,true)}},
  async delPayment(pid,bid){if(!confirm('Удалить платёж?'))return; try{await capi(null,{a:'payment_delete',id:pid}); openBooking(bid); refreshGridSoft();}catch(e){toast(e.message,true)}},
  async saveEdit(id){const body={a:'update',id,guest_name:$('#e_name').value.trim(),guest_phone:$('#e_phone').value.trim(),guest_telegram:$('#e_tg').value.trim(),guests_count:+$('#e_guests').value||1,total_price:+$('#e_price').value||0,currency:$('#e_cur').value,channel:$('#e_ch').value,check_in:$('#e_ci').value,check_out:$('#e_co').value,arrival_time:$('#e_at').value,departure_time:$('#e_dt').value,notes:$('#e_notes').value,admin_notes:$('#e_admin').value};
    try{await capi(null,body); toast('Сохранено'); openBooking(id); refreshGridSoft();}catch(e){toast(e.message,true)}}
};
async function refreshGridSoft(){ if(location.hash!=='#cal')return; try{G=await capi({a:'grid',from:FROM,to:addD(FROM,DAYSN),complex:COMPLEX}); const open=$('#modal').classList.contains('on'); const box=$('#modalBox').innerHTML; renderGrid(); if(open){openModal(box);} }catch(e){} }

async function openBooking(id){
  let d; try{d=await capi({a:'booking',id});}catch(e){toast(e.message,true);return}
  const b=d.booking, st=ST[b.status]||ST.confirmed; const canW=['admin','manager'].includes(ME.role);
  const paidTotal=d.payments.filter(p=>p.kind==='payment').reduce((s,p)=>s+Number(p.amount),0)-d.payments.filter(p=>p.kind==='refund').reduce((s,p)=>s+Number(p.amount),0);
  const debt=(b.total_price||0)-paidTotal-(b.prepaid||0);
  const stBtns=['confirmed','checked_in','checked_out','cancelled'].filter(s=>s!==b.status).map(s=>`<button class="btn ghost sm" onclick="CAL.setStatus('${b.id}','${s}')">${ST[s][0]}</button>`).join(' ');
  openModal(`<div class="row" style="justify-content:space-between"><h3 style="margin:0">${esc(b.complex)} ${esc(String(b.apartment_name).replace(/\D/g,''))} · ${esc(b.guest_name||'')}</h3><span class="tag" style="background:${st[1]};color:#fff">${st[0]}</span></div>
    <div class="muted" style="margin:4px 0 10px">${b.check_in} → ${b.check_out} · ${b.nights} ноч. · ${esc(CH[b.channel]||b.channel||'')} · ${b.external_id?'RC '+esc(b.external_id.replace('rc:','')):esc(b.source||'')}${b.created_by?' · '+esc(b.created_by):''}</div>
    ${canW&&b.status!=='blocked'?`<div class="row" style="margin-bottom:10px">${stBtns}</div>`:''}
    <div class="grid2">
      <div class="panel" style="margin:0"><h3>Гость и бронь</h3>
        ${canW?`<div class="form">
          <div class="row"><label style="flex:1">Имя<input id="e_name" value="${esc(b.guest_name||'')}"></label><label>Телефон<input id="e_phone" value="${esc(b.guest_phone||'')}"></label><label>Telegram<input id="e_tg" value="${esc(b.guest_telegram||'')}"></label></div>
          <div class="row"><label>Заезд<input type="date" id="e_ci" value="${b.check_in}"></label><label>Выезд<input type="date" id="e_co" value="${b.check_out}"></label><label>Время<input id="e_at" value="${esc(b.arrival_time||b.check_in_time||'')}" placeholder="15:00" style="width:70px"></label><label>Выезд в<input id="e_dt" value="${esc(b.departure_time||'')}" placeholder="12:00" style="width:70px"></label><label>Гостей<input type="number" id="e_guests" value="${b.guests_count||1}" style="width:60px"></label></div>
          <div class="row"><label>Стоимость<input type="number" id="e_price" value="${b.total_price||0}" style="width:100px"></label><label>Валюта<select id="e_cur">${['USD','RUB','UZS'].map(c=>`<option ${b.currency===c?'selected':''}>${c}</option>`).join('')}</select></label><label>Канал<select id="e_ch">${Object.entries(CH).map(([k,v])=>`<option value="${k}" ${b.channel===k?'selected':''}>${v}</option>`).join('')}</select></label></div>
          <label>Заметка гостя<textarea id="e_notes" rows="2">${esc(b.notes||b.client_notes||'')}</textarea></label>
          <label>Служебная заметка<textarea id="e_admin" rows="2">${esc(b.admin_notes||'')}</textarea></label>
          <div class="right"><button class="btn sm" onclick="CAL.saveEdit('${b.id}')">Сохранить</button></div>
        </div>`:`<div>${esc(b.guest_phone||'')} ${esc(b.guest_telegram||'')}<br>${esc(b.notes||'')}</div>`}
      </div>
      <div class="panel" style="margin:0"><h3>Оплата</h3>
        <div class="cards" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:10px"><div class="card"><div class="l">Стоимость</div><div class="v">${money(b.total_price,b.currency)}</div></div><div class="card"><div class="l">Оплачено</div><div class="v pos">${money(paidTotal+(b.prepaid||0),b.currency)}</div>${b.prepaid?`<div class="d">в т.ч. предоплата RC ${money(b.prepaid,b.currency)}</div>`:''}</div><div class="card"><div class="l">Остаток</div><div class="v ${debt>0?'neg':''}">${money(debt,b.currency)}</div></div></div>
        <table>${d.payments.map(p=>`<tr><td>${p.paid_at.slice(0,10)} ${esc(p.kind==='payment'?'оплата':p.kind==='refund'?'возврат':p.kind==='deposit'?'депозит':'возврат депозита')}</td><td>${esc(p.method||'')}</td><td>${money(p.amount,p.currency)}</td><td class="muted">${esc(p.received_by||'')}</td>${canW?`<td><a href="#" onclick="CAL.delPayment('${p.id}','${b.id}');return false" style="color:var(--red)">×</a></td>`:''}</tr>`).join('')||'<tr><td class="muted">платежей нет</td></tr>'}</table>
        ${canW?`<div class="row" style="margin-top:10px"><input type="number" id="p_amount" placeholder="сумма" value="${debt>0?debt:''}" style="width:100px"><select id="p_cur"><option ${b.currency==='USD'?'selected':''}>USD</option><option ${b.currency==='RUB'?'selected':''}>RUB</option><option ${b.currency==='UZS'?'selected':''}>UZS</option></select><select id="p_method"><option value="cash">наличные</option><option value="card">карта</option><option value="transfer">перевод</option><option value="payme">Payme</option><option value="click">Click</option><option value="ota">через OTA</option></select><select id="p_kind"><option value="payment">оплата</option><option value="deposit">депозит</option><option value="refund">возврат</option><option value="deposit_return">возврат депозита</option></select><input id="p_note" placeholder="заметка" style="flex:1"><button class="btn sm" onclick="CAL.addPayment('${b.id}')">+ платёж</button></div>`:''}
        <h3 style="margin-top:14px">История</h3>
        <div style="max-height:160px;overflow:auto;font-size:12px">${d.events.slice().reverse().map(e=>`<div class="muted">${e.created_at.slice(0,16).replace('T',' ')} · ${esc(e.type)} ${e.type==='status_changed'?esc((ST[e.payload.from]||[e.payload.from])[0]+' → '+(ST[e.payload.to]||[e.payload.to])[0]):e.type==='payment'?money(e.payload.amount):e.type==='moved'?'перенос':''} ${e.actor?'· '+esc(e.actor):''}</div>`).join('')}</div>
      </div>
    </div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn ghost" onclick="closeModal()">Закрыть</button></div>`);
}
window.openBooking=openBooking;

// ---------------- ЖИВАЯ ДОСКА ----------------
VIEWS.board=async()=>{killCharts();main.innerHTML='<div class="top"><h2>Доска дня</h2><span class="muted">загрузка…</span></div>';
  let d; try{d=await capi({a:'today'});}catch(e){main.innerHTML='<div class="panel">Ошибка: '+esc(e.message)+'</div>';return}
  const row=b=>`<tr onclick="openBooking('${b.id}')" style="cursor:pointer"><td>${esc(b.complex)} ${esc(String(b.apartment_name).replace(/\D/g,''))}</td><td>${esc(b.guest_name||'')}</td><td>${b.check_in} → ${b.check_out}</td><td>${esc(b.arrival_time||b.check_in_time||'')}</td><td>${money(b.total_price,b.currency)}</td><td class="${b.debt>0?'neg':'pos'}">${b.debt>0?'долг '+money(b.debt,b.currency):'оплачено'}</td><td><span class="tag" style="background:${(ST[b.status]||ST.confirmed)[1]};color:#fff">${(ST[b.status]||ST.confirmed)[0]}</span></td></tr>`;
  const tbl=(title,list,empty)=>`<div class="panel"><h3>${title} · ${list.length}</h3><table><tr><th>Квартира</th><th>Гость</th><th>Даты</th><th>Время</th><th>Сумма</th><th>Оплата</th><th>Статус</th></tr>${list.length?list.map(row).join(''):`<tr><td class="muted" colspan="7">${empty}</td></tr>`}</table></div>`;
  const clean=d.cleaning.filter(c=>c.date===d.date);
  main.innerHTML=`<div class="top"><h2>Доска дня · ${d.date}</h2><button class="btn sm" onclick="VIEWS.board()">обновить</button></div>
    <div class="cards">
      <div class="card"><div class="l">Живут сейчас</div><div class="v">${d.inhouse.length}</div></div>
      <div class="card"><div class="l">Заезды сегодня</div><div class="v">${d.checkins.length}</div><div class="d">завтра ${d.tomorrow.length}</div></div>
      <div class="card"><div class="l">Выезды сегодня</div><div class="v">${d.checkouts.length}</div></div>
      <div class="card"><div class="l">Долги (живут)</div><div class="v ${d.debts.length?'neg':''}">${d.debts.length}</div><div class="d">${money(d.debts.reduce((s,b)=>s+Number(b.debt),0),'USD')}</div></div>
      <div class="card"><div class="l">Уборки сегодня</div><div class="v">${clean.filter(c=>c.done).length}/${clean.length}</div><div class="d">${clean.filter(c=>c.hk_status&&!c.done).map(c=>esc(c.hk_status)).join(', ')}</div></div>
    </div>
    ${tbl('Заезды сегодня',d.checkins,'заездов нет')}${tbl('Выезды сегодня',d.checkouts,'выездов нет')}${tbl('Живут сейчас',d.inhouse,'пусто')}${tbl('Заезды завтра',d.tomorrow,'нет')}`;
};

// стили шахматки
const css=document.createElement('style'); css.textContent=`
.chess{min-width:900px;font-size:12px;--w:34px}
.ch-row{display:flex;border-bottom:1px solid var(--line);position:relative;min-height:46px}
.ch-head{position:sticky;top:0;background:var(--panel);z-index:3;min-height:40px}
.ch-apt{flex:0 0 150px;padding:5px 10px;border-right:1px solid var(--line);position:sticky;left:0;background:var(--panel);z-index:2;line-height:1.25}
.ch-group{background:var(--panel2);min-height:26px}.ch-group .ch-apt{font-weight:600;color:var(--gold);background:var(--panel2)}
.ch-day{flex:0 0 var(--w);text-align:center;padding:4px 0;border-right:1px solid var(--line);line-height:1.1}.ch-day small{display:block;color:var(--muted);font-size:10px}.ch-day.we{background:rgba(201,164,92,.06)}.ch-day.today b{color:var(--gold)}
.ch-cells{display:flex;position:relative;flex:1}
.ch-cell{flex:0 0 var(--w);border-right:1px solid var(--line);cursor:cell}.ch-cell.we{background:rgba(201,164,92,.04)}.ch-cell.today{background:rgba(201,164,92,.12)}.ch-cell:hover{background:rgba(255,255,255,.06)}.ch-cell.hint{background:rgba(201,164,92,.35)}
.ch-bk{position:absolute;top:5px;height:36px;left:calc(var(--s)*var(--w) + 10px);width:calc((var(--e) - var(--s))*var(--w) - 14px);border-radius:8px;color:#fff;padding:3px 8px;overflow:hidden;white-space:nowrap;cursor:grab;box-shadow:0 1px 3px rgba(0,0,0,.4);line-height:1.2;z-index:1}
.ch-bk .g{display:block;font-weight:600;text-overflow:ellipsis;overflow:hidden}.ch-bk .m{display:block;font-size:10.5px;opacity:.85}.ch-bk .m i{font-style:normal;color:#ffd54f;font-weight:700}
.ch-bk.debt{outline:2px solid #ff5252}.ch-bk.cut1{border-top-left-radius:0;border-bottom-left-radius:0;left:calc(var(--s)*var(--w))}.ch-bk.cut2{border-top-right-radius:0;border-bottom-right-radius:0}
.ch-bk.dragging{opacity:.4}.ch-bk.blocked{background-image:repeating-linear-gradient(45deg,transparent 0 6px,rgba(255,255,255,.08) 6px 12px)}
.form label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--muted);margin-bottom:8px}.form label>input,.form label>select,.form label>textarea{color:var(--text);font-size:13px}
#modalBox{max-width:1040px;width:min(96vw,1040px)}`;
document.head.appendChild(css);
// пункты меню
const nav=document.querySelector('.nav'); if(nav){const a1=document.createElement('a');a1.href='#cal';a1.dataset.v='cal';a1.textContent='Шахматка';const a2=document.createElement('a');a2.href='#board';a2.dataset.v='board';a2.textContent='Доска дня';const first=nav.querySelector('a[data-v="pl"]');nav.insertBefore(a2,first);nav.insertBefore(a1,a2);}
})();
