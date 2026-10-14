// Urban Luxe — admin/strategy.js (14.10.2026). Раздел «Стратегия» = витрина «Масштабирование» из старой admin.html, перенесена как есть
// (площадки, комплексы, ROI, действия, команда, дорожная карта, симулятор 10x, лидеры мира). Статичные данные — правятся прямо здесь.
(function () {
const A = window.ADM;
const SCALE_PLATFORMS_CURRENT=[
  {n:"Airbnb",c:"15%",a:"Иностранные туристы"},{n:"Booking.com",c:"15-18%",a:"Весь мир"},
  {n:"Ostrovok.ru",c:"12-15%",a:"Россия, СНГ"},{n:"Яндекс Путешествия",c:"10-15%",a:"Россия"},
  {n:"Sutochno.ru",c:"10-12%",a:"Россия, СНГ"},{n:"urbanluxe.cc",c:"0%",a:"Прямые брони"},
  {n:"OLX.uz",c:"0%",a:"Локальная реклама"},
];
const SCALE_PLATFORMS_NEW=[
  {n:"Trip.com",c:"12-15%",a:"Китай, Азия",w:"Растущий поток из Китая",p:1},
  {n:"Agoda",c:"15-18%",a:"ЮВА, Корея, Япония",w:"Сильна в Азии",p:1},
  {n:"Expedia / Hotels.com",c:"15-20%",a:"США, Европа",w:"2-й в мире после Booking",p:1},
  {n:"Google Vacation Rentals",c:"0%",a:"Глобально",w:"Бесплатный трафик из Google",p:1},
  {n:"Vrbo",c:"8-12%",a:"Семьи, группы",w:"Фокус на целые квартиры",p:2},
  {n:"101Hotels.com",c:"10-15%",a:"Россия, СНГ",w:"Популярен в Узбекистане",p:2},
  {n:"Hotellook",c:"Агрегатор",a:"Россия",w:"Сравнивает 70 площадок",p:2},
  {n:"Realting.uz",c:"Объявления",a:"Узбекистан",w:"Премиум, местный рынок",p:2},
  {n:"Tvil.ru",c:"10-15%",a:"Россия",w:"200K+ объектов",p:3},
  {n:"Krisha.kz",c:"Объявления",a:"Казахстан",w:"Казахстанские туристы",p:3},
  {n:"m2bomber",c:"Объявления",a:"Узбекистан",w:"Агрегатор посуточной",p:3},
];
const SCALE_COMPLEXES=[
  {n:"Nest One",cl:"Premium",d:"Шайхантахур",s:"current",u:5,t:20,r:800,a:120,note:"51 эт. HighLife: 22 кв., 90%",dm:"🔥🔥🔥"},
  {n:"U-Tower NRG",cl:"Business+",d:"Шайхантахур",s:"current",u:12,t:25,r:700,a:105,note:"UL+HL=34 кв.",dm:"🔥🔥🔥"},
  {n:"Mirabad Avenue",cl:"Premium",d:"Мирабад",s:"current",u:2,t:8,r:900,a:135,note:"Элитный район",dm:"🔥🔥"},
  {n:"Kislorod",cl:"Business+",d:"Юнусабад",s:"current",u:3,t:10,r:600,a:95,note:"K_128 топ по доходу",dm:"🔥🔥"},
  {n:"Boulevard",cl:"Premium",d:"Шайхантахур",s:"enter",u:0,t:12,r:750,a:130,note:"Tashkent City",dm:"🔥🔥🔥"},
  {n:"Gardens Residence",cl:"Premium",d:"Шайхантахур",s:"enter",u:0,t:10,r:800,a:125,note:"Tashkent City Park",dm:"🔥🔥🔥"},
  {n:"Modera Towers",cl:"Business+",d:"Шайхантахур",s:"enter",u:0,t:8,r:550,a:90,note:"HighLife 4кв 82%",dm:"🔥🔥"},
  {n:"Akay City",cl:"Business+",d:"Яккасарай",s:"enter",u:0,t:8,r:650,a:110,note:"Центр, метро",dm:"🔥🔥"},
  {n:"Skyline Towers",cl:"Premium",d:"Мирзо-Улугбек",s:"enter",u:0,t:6,r:700,a:115,note:"Rooftop pool",dm:"🔥🔥"},
  {n:"Labzak Park City",cl:"Premium",d:"Шайхантахур",s:"next",u:0,t:6,r:800,a:120,note:"4 башни, SPA",dm:"🔥🔥"},
  {n:"Parisien",cl:"Luxury",d:"Мирабад",s:"next",u:0,t:4,r:900,a:150,note:"Ультра-люкс",dm:"🔥"},
  {n:"Prestige Gardens",cl:"Premium",d:"Яккасарай",s:"next",u:0,t:6,r:700,a:120,note:"Тихий район",dm:"🔥🔥"},
  {n:"Baroque",cl:"Business+",d:"Яккасарай",s:"next",u:0,t:6,r:700,a:115,note:"RNB здесь",dm:"🔥🔥"},
  {n:"Seoul Riverside",cl:"Business+",d:"Шайхантахур",s:"next",u:0,t:6,r:650,a:100,note:"HL SM-169",dm:"🔥"},
  {n:"Infinity Club",cl:"Club",d:"Мирабад",s:"next",u:0,t:3,r:1200,a:180,note:"35 кв клубный дом",dm:"🔥"},
  {n:"Newport",cl:"Premium",d:"Шайхантахур",s:"next",u:0,t:6,r:700,a:110,note:"15 корпусов",dm:"🔥"},
  {n:"Minor Towers",cl:"Business+",d:"Шайхантахур",s:"future",u:0,t:6,r:600,a:95,note:"Метро Minor",dm:"🔥"},
  {n:"Bodomzor",cl:"Business+",d:"Юнусабад",s:"future",u:0,t:6,r:550,a:90,note:"Бассейн",dm:"🔥"},
  {n:"NRJ City",cl:"Business+",d:"Шайхантахур",s:"future",u:0,t:6,r:600,a:100,note:"TNM Home здесь",dm:"🔥"},
  {n:"Saadiyat",cl:"Premium",d:"Шайхантахур",s:"future",u:0,t:6,r:750,a:115,note:"Murad Buildings",dm:"🔥🔥"},
  {n:"Nirvana Luxury",cl:"Luxury",d:"Яккасарай",s:"future",u:0,t:4,r:900,a:140,note:"11га парка",dm:"🔥🔥"},
  {n:"Assalom Sohil",cl:"Business+",d:"Яккасарай",s:"future",u:0,t:8,r:500,a:85,note:"Большой потенциал",dm:"🔥"},
  {n:"Parkwood",cl:"Business+",d:"Мирабад",s:"future",u:0,t:4,r:600,a:95,note:"HL 2кв 75%",dm:"🔥"},
  {n:"GC Tower",cl:"Premium",d:"Яккасарай",s:"future",u:0,t:4,r:700,a:110,note:"Новый премиум",dm:"🔥"},
  {n:"Mavera Town",cl:"Premium",d:"Яккасарай",s:"future",u:0,t:4,r:700,a:115,note:"Новостройка",dm:"🔥"},
  {n:"Celebrity Res.",cl:"Premium",d:"Яккасарай",s:"future",u:0,t:4,r:750,a:120,note:"Премиум",dm:"🔥"},
  {n:"Yakkasaroy Palace",cl:"Premium",d:"Яккасарай",s:"future",u:0,t:4,r:700,a:115,note:"Дворцовый",dm:"🔥"},
  {n:"Kazakhstan Res.",cl:"Business+",d:"Юнусабад",s:"future",u:0,t:6,r:600,a:95,note:"Метро Minor",dm:"🔥"},
  {n:"Loft Residence",cl:"Business+",d:"Мирабад",s:"future",u:0,t:4,r:650,a:100,note:"Лофт стиль",dm:"🔥"},
  {n:"Glinka Premium",cl:"Premium",d:"Шайхантахур",s:"future",u:0,t:4,r:700,a:110,note:"Центр",dm:"🔥"},
];
const SCALE_ACTIONS=[
  {a:"Pricelabs — динамические цены",i:"ADR +15-25%, +$8-12K/мес",c:"$22-44/мес",t:"1 день",p:"🔴"},
  {a:"Фото всех 22 апартаментов",i:"Конверсия +30-50%",c:"$200-500",t:"2-3 дня",p:"🔴"},
  {a:"Smart locks на все юниты",i:"Экономия 2ч/день",c:"$50-100/замок",t:"1 неделя",p:"🔴"},
  {a:"+10 кв. в Nest One",i:"+$10-15K/мес",c:"$15-30K",t:"1-2 мес",p:"🔴"},
  {a:"Trip.com + Agoda + Expedia",i:"+20-30% бронирований",c:"Бесплатно",t:"3-5 дней",p:"🟡"},
  {a:"Авто-сообщения гостям",i:"Рейтинг 5.0 удержание",c:"$0",t:"2-3 дня",p:"🟡"},
  {a:"Google Ads urbanluxe.cc",i:"+10-20 прямых/мес",c:"$200-500/мес",t:"1 неделя",p:"🟡"},
  {a:"Партнёрство HighLife",i:"52→80+ юнитов",c:"$0",t:"1 встреча",p:"🟢"},
  {a:"Корпоративные контракты",i:"+$5-10K/мес стабильно",c:"$0",t:"1-2 мес",p:"🟢"},
];

function showScaleTab(id){
  document.querySelectorAll('#scaleTabs button').forEach(b=>b.classList.toggle('on',b.dataset.s===id));
  const el=document.getElementById('scaleContent');
  const sColors={current:'var(--green)',enter:'var(--red)',next:'var(--gold)',future:'var(--blue)'};
  const sNames={current:'✅ Работаем',enter:'🔴 Сейчас',next:'🟡 Следующий',future:'🔵 Будущее'};
  
  if(id==='platforms'){
    el.innerHTML='<div style="margin-bottom:20px"><h3 style="font-size:14px;font-weight:400;color:var(--green);margin-bottom:10px">✅ Подключены ('+SCALE_PLATFORMS_CURRENT.length+')</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px">'+SCALE_PLATFORMS_CURRENT.map(p=>'<div style="background:var(--bg2);border:1px solid rgba(46,204,113,.15);padding:10px;border-radius:6px"><strong style="font-size:12px">'+p.n+'</strong><div style="font-size:10px;color:var(--muted)">'+p.c+' · '+p.a+'</div></div>').join('')+'</div></div><h3 style="font-size:14px;font-weight:400;color:var(--red);margin-bottom:10px">🔴 Подключить ('+SCALE_PLATFORMS_NEW.length+')</h3><div style="display:grid;gap:4px">'+SCALE_PLATFORMS_NEW.sort((a,b)=>a.p-b.p).map(p=>'<div style="display:grid;grid-template-columns:24px 1.5fr 0.8fr 2fr 1fr;gap:8px;padding:8px 12px;background:var(--bg2);border:1px solid '+(p.p===1?'rgba(231,76,60,.15)':'var(--line)')+';border-radius:4px;font-size:11px;align-items:center"><span>'+(p.p===1?'🔴':p.p===2?'🟡':'🟢')+'</span><strong>'+p.n+'</strong><span style="color:var(--gold)">'+p.c+'</span><span style="color:var(--muted)">'+p.w+'</span><span style="color:var(--muted)">'+p.a+'</span></div>').join('')+'</div>';
  }
  
  if(id==='complexes'){
    const totCur=SCALE_COMPLEXES.reduce((s,c)=>s+c.u,0);
    const totTgt=SCALE_COMPLEXES.reduce((s,c)=>s+c.t,0);
    let html='<div style="font-size:12px;color:var(--muted);margin-bottom:12px">'+totCur+' текущих → <strong style="color:var(--gold)">'+totTgt+'</strong> целевых · '+SCALE_COMPLEXES.length+' комплексов</div>';
    ['current','enter','next','future'].forEach(st=>{
      const cxs=SCALE_COMPLEXES.filter(c=>c.s===st);
      if(!cxs.length)return;
      const stRev=cxs.reduce((s,c)=>s+Math.round(c.t*c.a*30*0.87),0);
      html+='<div style="margin-bottom:16px"><h4 style="font-size:13px;font-weight:400;margin-bottom:8px;color:'+sColors[st]+'">'+sNames[st]+' ('+cxs.length+' ЖК · $'+stRev.toLocaleString()+'/мес)</h4><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:6px">';
      cxs.forEach(c=>{
        const rev=Math.round(c.t*c.a*30*0.87);
        const pct=c.u>0?Math.round(c.u/c.t*100):0;
        html+='<div style="background:var(--bg2);border:1px solid '+sColors[st]+'22;padding:12px;border-radius:6px"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><strong style="font-size:12px">'+c.n+'</strong><span style="font-size:9px;color:'+sColors[st]+'">'+c.cl+'</span></div><div style="font-size:10px;color:var(--muted);margin-bottom:6px">📍 '+c.d+' · '+c.dm+'</div><div style="font-size:10px;color:var(--muted);margin-bottom:6px">'+c.note+'</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:4px;font-size:10px"><div><span style="color:var(--muted)">Сейчас</span><br><strong'+(c.u>0?' style="color:var(--green)"':'')+'>'+c.u+'</strong></div><div><span style="color:var(--muted)">Цель</span><br><strong style="color:var(--gold)">'+c.t+'</strong></div><div><span style="color:var(--muted)">Аренда</span><br><strong>$'+c.r+'</strong></div><div><span style="color:var(--muted)">$/ночь</span><br><strong style="color:var(--gold)">$'+c.a+'</strong></div></div><div style="height:4px;background:var(--bg3);border-radius:2px;margin-top:6px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+sColors[st]+';border-radius:2px;min-width:'+(pct>0?'4px':'0')+'"></div></div><div style="font-size:10px;color:var(--green);margin-top:4px">→ $'+rev.toLocaleString()+'/мес</div></div>';
      });
      html+='</div></div>';
    });
    el.innerHTML=html;
  }
  
  if(id==='roi'){
    el.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div style="background:var(--bg2);border:1px solid var(--line);padding:16px;border-radius:8px"><h3 style="font-size:14px;font-weight:400;margin-bottom:12px">Параметры объекта</h3><div style="margin-bottom:10px"><div style="display:flex;gap:4px;margin-bottom:8px">'
    +['Студия','1к','2к','3к','4к+'].map(r=>'<button class="sm" onclick="setROIPreset(\''+r+'\')">'+r+'</button>').join('')
    +'</div><div id="roiSliders"><label style="font-size:11px;color:var(--muted)">Аренда ($/мес): <strong id="roiRentV" style="color:var(--gold)">$1000</strong></label><br><input type="range" id="roiRent" min="700" max="3000" step="50" value="1000" oninput="calcROI()" style="width:100%;accent-color:var(--gold)"><br><label style="font-size:11px;color:var(--muted)">$/ночь: <strong id="roiAdrV" style="color:var(--gold)">$100</strong></label><br><input type="range" id="roiAdr" min="50" max="300" step="5" value="100" oninput="calcROI()" style="width:100%;accent-color:var(--gold)"><br><label style="font-size:11px;color:var(--muted)">Загрузка: <strong id="roiOccV" style="color:var(--gold)">85%</strong></label><br><input type="range" id="roiOcc" min="50" max="100" step="1" value="85" oninput="calcROI()" style="width:100%;accent-color:var(--gold)"></div></div><div style="padding:8px;background:var(--bg3);border-radius:6px;font-size:10px;color:var(--muted);margin-top:8px"><strong style="color:var(--text)">Быстрый подбор:</strong><div style="display:flex;gap:3px;margin-top:4px;flex-wrap:wrap">'
    +[{l:'NO Ст',r:800,a:80},{l:'NO 1к',r:1000,a:100},{l:'NO 2к',r:1400,a:120},{l:'NO 3к',r:1800,a:150},{l:'UT Ст',r:700,a:75},{l:'UT 1к',r:900,a:95},{l:'Blvd 2к',r:1400,a:130},{l:'Paris',r:1600,a:150}].map(p=>'<button class="sm" style="padding:2px 6px;font-size:9px" onclick="document.getElementById(\'roiRent\').value='+p.r+';document.getElementById(\'roiAdr\').value='+p.a+';calcROI()">'+p.l+'</button>').join('')
    +'</div></div></div><div style="background:var(--bg2);border:1px solid var(--line);padding:16px;border-radius:8px"><h3 style="font-size:14px;font-weight:400;margin-bottom:12px">Результат</h3><div id="roiResult" style="text-align:center"><div style="color:var(--muted)">Двигайте ползунки</div></div></div></div>';
    calcROI();
  }
  
  if(id==='actions'){
    el.innerHTML='<h3 style="font-size:14px;font-weight:400;margin-bottom:12px">Что делать прямо сейчас</h3><div style="display:grid;gap:4px">'+SCALE_ACTIONS.map(a=>'<div style="display:grid;grid-template-columns:24px 2.5fr 1.5fr 0.8fr 0.8fr;gap:8px;padding:8px 12px;background:var(--bg2);border:1px solid var(--line);border-radius:4px;font-size:11px;align-items:center"><span style="font-size:14px">'+a.p+'</span><strong>'+a.a+'</strong><span style="color:var(--green)">'+a.i+'</span><span style="color:var(--gold)">'+a.c+'</span><span style="color:var(--muted)">'+a.t+'</span></div>').join('')+'</div><div style="margin-top:8px;font-size:10px;color:var(--muted);display:grid;grid-template-columns:24px 2.5fr 1.5fr 0.8fr 0.8fr;gap:8px;padding:4px 12px"><span></span><span>ДЕЙСТВИЕ</span><span>ВЛИЯНИЕ</span><span>ЦЕНА</span><span>ВРЕМЯ</span></div>';
  }

  if(id==='team'){
    const units=parseInt(document.getElementById('dAp')?.textContent||22);
    const calcTeam=(n)=>{
      const t=[
        {r:'Операционный менеджер',per:50,s:'$1500-2000'},
        {r:'Клининг-менеджер',per:40,s:'$800-1000'},
        {r:'Клинер',per:8,s:'200K сум/день'},
        {r:'Техник',per:50,s:'$600-800'},
        {r:'Контент-менеджер',per:100,s:'$800-1200'},
        {r:'Revenue менеджер',per:80,s:'$1000-1500'},
        {r:'Бухгалтер',per:100,s:'$600-800'},
        {r:'Закупщик',per:60,s:'$400-600'},
      ];
      return t.map(x=>({...x,count:Math.max(1,Math.ceil(n/x.per))}));
    };
    el.innerHTML='<h3 style="font-size:14px;font-weight:400;margin-bottom:12px">Калькулятор команды</h3>'
    +'<div style="margin-bottom:16px"><label style="font-size:11px;color:var(--muted)">Количество апартаментов: <strong id="teamUnitsV" style="color:var(--gold);font-size:16px">'+units+'</strong></label><br><input type="range" id="teamUnits" min="22" max="200" value="'+units+'" oninput="updateTeam()" style="width:100%;accent-color:var(--gold)"></div>'
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">'
    +'<div style="background:var(--bg2);border:1px solid var(--line);padding:14px;border-radius:8px;text-align:center"><div style="font-size:9px;color:var(--muted);text-transform:uppercase">Всего сотрудников</div><div id="teamTotal" style="font-size:28px;font-family:Playfair Display,serif;color:var(--gold)">'+calcTeam(units).reduce((s,x)=>s+x.count,0)+'</div></div>'
    +'<div style="background:var(--bg2);border:1px solid var(--line);padding:14px;border-radius:8px;text-align:center"><div style="font-size:9px;color:var(--muted);text-transform:uppercase">Клинеров</div><div id="teamCleaners" style="font-size:28px;font-family:Playfair Display,serif">'+calcTeam(units).find(x=>x.r==='Клинер').count+'</div></div>'
    +'<div style="background:var(--bg2);border:1px solid var(--line);padding:14px;border-radius:8px;text-align:center"><div style="font-size:9px;color:var(--muted);text-transform:uppercase">1 клинер на</div><div style="font-size:28px;font-family:Playfair Display,serif">8 <span style="font-size:12px;color:var(--muted)">апт.</span></div></div></div>'
    +'<div id="teamTable" style="background:var(--bg2);border:1px solid var(--line);border-radius:8px;overflow:hidden">'+calcTeam(units).map(s=>'<div style="display:grid;grid-template-columns:2fr 0.6fr 0.8fr 1fr;gap:8px;padding:8px 14px;border-bottom:1px solid var(--line);font-size:11px"><strong>'+s.r+'</strong><span style="color:var(--gold);font-size:14px;font-weight:500">'+s.count+'</span><span style="color:var(--muted)">/'+s.per+' юн.</span><span>'+s.s+'</span></div>').join('')+'</div>';
  }

  if(id==='roadmap'){
    const phases=[
      {q:'Q1 (0-3 мес)',t:'ДОМИНИРОВАНИЕ',c:'var(--red)',u:'22→40',r:'$52K→$95K',tasks:['+10 Nest One','+5 U-Tower','+2 Kislorod','Pricelabs','Фото всех 22','Smart locks','HighLife партнёрство','Booking.com','Google Ads $300/мес']},
      {q:'Q2 (3-6 мес)',t:'ЭКСПАНСИЯ',c:'#e67e22',u:'40→70',r:'$95K→$180K',tasks:['+8 Boulevard','+6 Gardens','+4 Modera','+3 U-Tower','+1 менеджер','+3 клинера','Корпоративные','Revenue менеджер','Instagram 3/нед']},
      {q:'Q3-Q4 (6-12 мес)',t:'МАСШТАБ',c:'var(--gold)',u:'70→120',r:'$180K→$310K',tasks:['+8 Akay City','+6 Skyline','+6 Prestige','+5 Baroque','Guesty PMS','Turno клининг','Авто-сообщения','Самарканд пилот','HR + бухгалтер']},
      {q:'Q5-Q6 (12-18 мес)',t:'10X ЦЕЛЬ',c:'var(--green)',u:'120→160+',r:'$310K→$500K+',tasks:['+4 Parisien','+6 Seoul','+6 Minor','+20 новые','Самарканд 10-20','Бренд-отель','Управление (20-30%)','AI-консьерж','Инвесторы / IPO']},
    ];
    el.innerHTML='<h3 style="font-size:14px;font-weight:400;margin-bottom:12px">18 месяцев до 10x</h3>'+phases.map(p=>'<div style="display:flex;gap:12px;margin-bottom:14px"><div style="width:4px;background:'+p.c+';border-radius:2px;flex-shrink:0"></div><div style="flex:1;background:var(--bg2);border:1px solid var(--line);padding:14px;border-radius:8px"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><div><h4 style="font-size:14px;font-weight:400;margin:0;color:'+p.c+'">'+p.q+' — '+p.t+'</h4></div><div style="text-align:right"><div style="font-size:11px;color:var(--muted)">'+p.u+'</div><div style="font-size:15px;color:var(--green)">'+p.r+'</div></div></div><div style="display:flex;gap:4px;flex-wrap:wrap">'+p.tasks.map(t=>'<span style="font-size:10px;padding:3px 8px;background:var(--bg3);border-radius:3px;color:var(--muted)">→ '+t+'</span>').join('')+'</div></div></div>').join('')
    +'<div style="background:rgba(201,169,97,.06);border:1px solid rgba(201,169,97,.15);padding:12px;border-radius:8px;display:grid;grid-template-columns:repeat(5,1fr);gap:6px;text-align:center;font-size:11px">'+[{l:'Сейчас',u:22,r:'$52K',x:'1x'},{l:'Ф1',u:40,r:'$95K',x:'1.8x'},{l:'Ф2',u:70,r:'$180K',x:'3.5x'},{l:'Ф3',u:120,r:'$310K',x:'6x'},{l:'Ф4',u:160,r:'$500K+',x:'10x'}].map(f=>'<div style="padding:8px;background:var(--bg2);border-radius:6px"><div style="font-size:9px;color:var(--muted)">'+f.l+'</div><div style="font-size:18px;color:var(--gold)">'+f.x+'</div><div style="color:var(--muted)">'+f.u+' юн.</div></div>').join('')+'</div>';
  }

  if(id==='simulator'){
    el.innerHTML='<h3 style="font-size:14px;font-weight:400;margin-bottom:12px">Симулятор роста 10x</h3>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div style="background:var(--bg2);border:1px solid var(--line);padding:16px;border-radius:8px">'
    +'<label style="font-size:11px;color:var(--muted)">Апартаментов: <strong id="simUV" style="color:var(--gold);font-size:15px">22</strong></label><br><input type="range" id="simU" min="22" max="300" value="22" oninput="calcSim()" style="width:100%;accent-color:var(--gold)"><br>'
    +'<label style="font-size:11px;color:var(--muted)">ADR ($/ночь): <strong id="simAV" style="color:var(--gold);font-size:15px">$96</strong></label><br><input type="range" id="simA" min="50" max="200" value="96" oninput="calcSim()" style="width:100%;accent-color:var(--gold)"><br>'
    +'<label style="font-size:11px;color:var(--muted)">Загрузка: <strong id="simOV" style="color:var(--gold);font-size:15px">94%</strong></label><br><input type="range" id="simO" min="50" max="100" value="94" oninput="calcSim()" style="width:100%;accent-color:var(--gold)">'
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:12px">'+[{l:'Ф1',u:40,a:100,o:90},{l:'Ф2',u:70,a:110,o:88},{l:'Ф3',u:120,a:120,o:87},{l:'Ф4',u:160,a:130,o:85},{l:'ЦЕЛЬ',u:200,a:140,o:85},{l:'MAX',u:300,a:150,o:85}].map(p=>'<button class="sm" style="font-size:9px;padding:3px" onclick="document.getElementById(\'simU\').value='+p.u+';document.getElementById(\'simA\').value='+p.a+';document.getElementById(\'simO\').value='+p.o+';calcSim()">'+p.l+' ('+p.u+')</button>').join('')+'</div>'
    +'</div><div style="background:var(--bg2);border:1px solid var(--line);padding:16px;border-radius:8px;text-align:center">'
    +'<div id="simResult"><div style="font-size:42px;font-family:Playfair Display,serif;color:var(--gold)">$59,314</div><div style="font-size:12px;color:var(--muted)">валовый доход / мес</div><div style="font-size:24px;color:var(--gold);margin-top:8px">1.1x</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px"><div style="background:var(--bg3);padding:8px;border-radius:6px"><div style="font-size:8px;color:var(--muted)">ПРИБЫЛЬ/МЕС</div><div style="font-size:16px;color:var(--green)">$26,098</div></div><div style="background:var(--bg3);padding:8px;border-radius:6px"><div style="font-size:8px;color:var(--muted)">ПРИБЫЛЬ/ГОД</div><div style="font-size:16px;color:var(--green)">$313,176</div></div></div></div>'
    +'</div></div>';
    calcSim();
  }

  if(id==='leaders'){
    const leaders=[
      {n:'Casago-Vacasa',u:'43,000',c:'USA',y:2001,s:'M&A',k:'Купили Vacasa за $47M',l:'Масштаб через покупку',r:'Vacasa -97% стоимости'},
      {n:'Awaze',u:'110,000',c:'EU 36 стран',y:1994,s:'Multi-brand',k:'Wyndham продал за $1.3B',l:'Диверсификация по странам',r:'Сложность 36 стран'},
      {n:'Evolve',u:'30,000',c:'USA',y:2011,s:'Tech-first',k:'$400M+ привлечено, 10x за 5 лет',l:'Технологии = быстрый рост',r:'Зависимость от OTA'},
      {n:'Sykes',u:'21,000',c:'UK',y:2009,s:'Качество',k:'British Travel Award 8 лет',l:'Качество + бренд = устойчивость',r:'Только UK'},
      {n:'Houst',u:'7,000',c:'UK/EU',y:2015,s:'Urban STR',k:'0→7K за 10 лет',l:'Городские апартаменты',r:'Регулирование'},
      {n:'Sonder ☠️',u:'БАНКРОТ',c:'USA',y:2014,s:'Lease',k:'Банкротство 2025',l:'Рост без прибыли = смерть',r:'$500M сгорело'},
    ];
    el.innerHTML='<h3 style="font-size:14px;font-weight:400;margin-bottom:12px">Топ компании STR мира — уроки для Urban Luxe</h3>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:8px;margin-bottom:16px">'+leaders.map(l=>'<div style="background:'+(l.n.includes('☠️')?'rgba(231,76,60,.04)':'var(--bg2)')+';border:1px solid '+(l.n.includes('☠️')?'rgba(231,76,60,.2)':'var(--line)')+';padding:14px;border-radius:8px"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><strong style="font-size:13px">'+l.n+'</strong><span style="font-size:16px;font-family:Playfair Display,serif;color:'+(l.u==='БАНКРОТ'?'var(--red)':'var(--gold)')+'">'+l.u+'</span></div><div style="font-size:10px;color:var(--muted);margin-bottom:6px">📍 '+l.c+' · '+l.y+' · '+l.s+'</div><div style="font-size:11px;color:var(--muted);line-height:1.6"><div>🚀 '+l.k+'</div><div style="color:var(--green)">✅ '+l.l+'</div><div style="color:'+(l.n.includes('☠️')?'var(--red)':'#e67e22')+'">⚠️ '+l.r+'</div></div></div>').join('')+'</div>'
    +'<div style="background:rgba(201,169,97,.06);border:1px solid rgba(201,169,97,.15);padding:14px;border-radius:8px"><h4 style="font-size:13px;font-weight:400;color:var(--gold);margin-bottom:8px">💡 3 главных урока</h4><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;font-size:11px;color:var(--muted)"><div><strong style="color:var(--green)">Качество > Количество</strong><br>Ваш рейтинг 5.0 — главный актив. Не жертвуйте им ради скорости.</div><div><strong style="color:var(--gold)">Технологии = рост</strong><br>Pricelabs, AI pricing, автоматизация. 52% операторов уже используют AI.</div><div><strong style="color:var(--red)">Unit Economics!</strong><br>Sonder сжёг $500M без прибыли. Каждый юнит должен быть прибыльным.</div></div></div>';
  }
}

function setROIPreset(type){
  const presets={Студия:{r:800,a:80},'1к':{r:1000,a:100},'2к':{r:1400,a:120},'3к':{r:1800,a:150},'4к+':{r:2500,a:200}};
  const p=presets[type];if(!p)return;
  document.getElementById('roiRent').value=p.r;document.getElementById('roiAdr').value=p.a;calcROI();
}

function calcROI(){
  const rent=parseInt(document.getElementById('roiRent')?.value||1000);
  const adr=parseInt(document.getElementById('roiAdr')?.value||100);
  const occ=parseInt(document.getElementById('roiOcc')?.value||85);
  document.getElementById('roiRentV').textContent='$'+rent;
  document.getElementById('roiAdrV').textContent='$'+adr;
  document.getElementById('roiOccV').textContent=occ+'%';
  const nights=Math.round(30*occ/100);
  const gross=adr*nights;
  const commis=Math.round(gross*0.15);
  const clean=Math.round(nights/2.5*15)+50;
  const total=rent+commis+clean+80+150;
  const profit=gross-total;
  const margin=gross>0?Math.round(profit/gross*100):0;
  const vCol=profit>800?'var(--green)':profit>400?'var(--gold)':'var(--red)';
  const vTxt=profit>800?'✅ ОТЛИЧНО — брать!':profit>400?'⚠️ Нормально':profit>0?'⚡ Слабо':'❌ Убыточно';
  const el=document.getElementById('roiResult');
  el.innerHTML='<div style="font-size:14px;padding:6px 16px;border-radius:6px;display:inline-block;border:1px solid '+vCol+'44;color:'+vCol+';margin-bottom:12px">'+vTxt+'</div>'
  +'<div style="text-align:left;font-size:12px">'
  +[{l:'Валовый доход',v:'$'+gross.toLocaleString(),c:'var(--green)'},{l:'— Аренда',v:'-$'+rent,c:'var(--red)'},{l:'— Комиссии 15%',v:'-$'+commis,c:'var(--red)'},{l:'— Клининг+расх.',v:'-$'+clean,c:'var(--red)'},{l:'— Комм.+ФОТ',v:'-$230',c:'var(--red)'}].map(r=>'<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--line)"><span style="color:var(--muted)">'+r.l+'</span><strong style="color:'+r.c+'">'+r.v+'</strong></div>').join('')
  +'</div><div style="display:flex;justify-content:space-between;padding:8px 0;font-size:14px;margin-top:4px"><strong>Прибыль</strong><strong style="color:'+vCol+';font-size:18px">$'+profit.toLocaleString()+'/мес</strong></div>'
  +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:8px">'
  +[{l:'МАРЖА',v:margin+'%'},{l:'ГОД',v:'$'+(profit*12).toLocaleString()},{l:'НОЧЕЙ',v:nights}].map(k=>'<div style="background:var(--bg3);padding:6px;border-radius:4px;text-align:center"><div style="font-size:8px;color:var(--muted)">'+k.l+'</div><div style="font-size:14px;color:var(--gold)">'+k.v+'</div></div>').join('')
  +'</div>';
}

// ============ APT REPORT MODAL ============

A.views.strategy = function () {
  A.$('#main').innerHTML = `<div class="page"><h2>Стратегия <span class="n muted">масштабирование 10x — витрина из старой админки</span></h2>
    <div class="card"><div class="seg" id="scaleTabs" style="margin-bottom:14px;flex-wrap:wrap">
      <button data-s="platforms" class="on">📡 Площадки</button><button data-s="complexes">🏢 Комплексы</button><button data-s="roi">💰 ROI</button><button data-s="actions">⚡ Действия</button><button data-s="team">👥 Команда</button><button data-s="roadmap">🗓️ Дорожная карта</button><button data-s="simulator">📈 Симулятор 10x</button><button data-s="leaders">🌍 Лидеры мира</button></div>
    <div id="scaleContent"></div></div></div>`;
  A.$$('#scaleTabs button').forEach(b => b.onclick = () => showScaleTab(b.dataset.s));
  showScaleTab('platforms');
};
function updateTeam(){
  const n=parseInt(document.getElementById('teamUnits').value);
  document.getElementById('teamUnitsV').textContent=n;
  const t=[
    {r:'Операционный менеджер',per:50,s:'$1500-2000'},
    {r:'Клининг-менеджер',per:40,s:'$800-1000'},
    {r:'Клинер',per:8,s:'200K сум/день'},
    {r:'Техник',per:50,s:'$600-800'},
    {r:'Контент-менеджер',per:100,s:'$800-1200'},
    {r:'Revenue менеджер',per:80,s:'$1000-1500'},
    {r:'Бухгалтер',per:100,s:'$600-800'},
    {r:'Закупщик',per:60,s:'$400-600'},
  ].map(x=>({...x,count:Math.max(1,Math.ceil(n/x.per))}));
  document.getElementById('teamTotal').textContent=t.reduce((s,x)=>s+x.count,0);
  document.getElementById('teamCleaners').textContent=t.find(x=>x.r==='Клинер').count;
  document.getElementById('teamTable').innerHTML=t.map(s=>'<div style="display:grid;grid-template-columns:2fr 0.6fr 0.8fr 1fr;gap:8px;padding:8px 14px;border-bottom:1px solid var(--line);font-size:11px"><strong>'+s.r+'</strong><span style="color:var(--gold);font-size:14px;font-weight:500">'+s.count+'</span><span style="color:var(--muted)">/'+s.per+' юн.</span><span>'+s.s+'</span></div>').join('');
}

function calcSim(){
  const u=parseInt(document.getElementById('simU')?.value||22);
  const a=parseInt(document.getElementById('simA')?.value||96);
  const o=parseInt(document.getElementById('simO')?.value||94);
  document.getElementById('simUV').textContent=u;
  document.getElementById('simAV').textContent='$'+a;
  document.getElementById('simOV').textContent=o+'%';
  const rev=Math.round(u*a*30*(o/100));
  const profit=Math.round(rev*0.44);
  const mult=(rev/51887).toFixed(1);
  const col=parseFloat(mult)>=10?'var(--green)':'var(--gold)';
  document.getElementById('simResult').innerHTML='<div style="font-size:42px;font-family:Playfair Display,serif;color:var(--gold)">$'+rev.toLocaleString()+'</div><div style="font-size:12px;color:var(--muted)">валовый доход / мес</div><div style="font-size:24px;color:'+col+';margin-top:8px">'+mult+'x'+(parseFloat(mult)>=10?' ✅ ЦЕЛЬ!':'')+'</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px"><div style="background:var(--bg3);padding:8px;border-radius:6px"><div style="font-size:8px;color:var(--muted)">ПРИБЫЛЬ/МЕС</div><div style="font-size:16px;color:var(--green)">$'+profit.toLocaleString()+'</div></div><div style="background:var(--bg3);padding:8px;border-radius:6px"><div style="font-size:8px;color:var(--muted)">ПРИБЫЛЬ/ГОД</div><div style="font-size:16px;color:var(--green)">$'+(profit*12).toLocaleString()+'</div></div></div>';
}
window.updateTeam = updateTeam; window.calcSim = calcSim; window.setROIPreset = setROIPreset; window.calcROI = calcROI; window.showScaleTab = showScaleTab;
})();
