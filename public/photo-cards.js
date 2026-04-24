(function(){
  var SB='https://sebvfvtofiysbywxjqut.supabase.co';
  var SK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI';
  var aptData=null;
  var css=document.createElement('style');
  css.textContent='\
    #aptGrid .card__img{aspect-ratio:3/2!important;height:auto!important;max-height:400px}\
    #aptGrid .card__img img{width:100%;height:100%;object-fit:cover;object-position:center}\
    #resultsList{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(320px,1fr))!important;gap:24px!important;padding:0!important}\
    #resultsList .card{border:1px solid rgba(232,226,214,.12)!important;border-radius:12px!important;overflow:hidden!important;background:#141414!important;cursor:pointer!important;transition:transform .2s,box-shadow .2s!important;display:flex!important;flex-direction:column!important}\
    #resultsList .card:hover{transform:translateY(-4px)!important;box-shadow:0 8px 30px rgba(0,0,0,.4)!important}\
    #resultsList .card__img{aspect-ratio:4/3!important;height:auto!important;min-height:0!important;position:relative!important;background-size:cover!important;background-position:center!important;overflow:hidden!important}\
    #resultsList .card__img:not([style*="background-image"]){background:#1e1e1e!important;display:flex!important;align-items:center!important;justify-content:center!important;min-height:200px!important}\
    #resultsList .card__info{padding:16px!important}\
    #resultsList .card__title{font-size:18px!important;margin-bottom:4px!important}\
    #resultsList .card__sub{color:#a8a096!important;font-size:13px!important;margin-bottom:12px!important}\
    .apt-modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .3s;pointer-events:none}\
    .apt-modal-overlay.active{opacity:1;pointer-events:all}\
    .apt-modal{background:#1a1a1a;border:1px solid rgba(232,226,214,.15);border-radius:16px;width:90%;max-width:900px;max-height:90vh;overflow-y:auto;position:relative}\
    .apt-modal-close{position:absolute;top:16px;right:16px;width:36px;height:36px;background:rgba(0,0,0,.6);border:none;color:#fff;font-size:20px;border-radius:50%;cursor:pointer;z-index:10;display:flex;align-items:center;justify-content:center}\
    .apt-modal-gallery{position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;border-radius:16px 16px 0 0;background:#1e1e1e}\
    .apt-modal-gallery img{width:100%;height:100%;object-fit:cover}\
    .gnav{position:absolute;top:50%;transform:translateY(-50%);width:40px;height:40px;background:rgba(0,0,0,.5);border:none;color:#fff;font-size:18px;border-radius:50%;cursor:pointer;z-index:5}\
    .gnav:hover{background:rgba(201,169,97,.8)}\
    .gnav.gp{left:12px}.gnav.gn{right:12px}\
    .gdots{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:5}\
    .gdots span{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.4);cursor:pointer}.gdots span.ac{background:#c9a961}\
    .apt-modal-body{padding:32px}\
    .amt{font-family:"Cormorant Garamond",serif;font-size:32px;font-weight:400;color:#e8e2d6}\
    .ampr{font-size:28px;color:#c9a961;font-weight:300}\
    .ammeta{display:flex;gap:12px;margin:16px 0 24px;flex-wrap:wrap}\
    .ammeta span{background:rgba(201,169,97,.1);color:#c9a961;padding:6px 14px;border-radius:6px;font-size:13px}\
    .amdesc{color:#a8a096;line-height:1.7;margin-bottom:24px;font-size:15px}\
    .amamen{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:32px}\
    .amamen div{display:flex;align-items:center;gap:8px;color:#a8a096;font-size:13px}\
    .amamen div::before{content:"\\2713";color:#c9a961;font-weight:700}\
    .ambook{display:flex;gap:16px;align-items:center;padding:24px;background:rgba(201,169,97,.05);border-top:1px solid rgba(232,226,214,.1);border-radius:0 0 16px 16px}\
    .ambook button{padding:14px 32px;background:#c9a961;color:#0a0a0a;border:none;font-size:14px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;font-family:inherit;border-radius:8px}\
    .ambook button:hover{background:#a88947}\
    @media(max-width:768px){#resultsList{grid-template-columns:1fr!important}.apt-modal{width:95%}.apt-modal-body{padding:20px}}\
  ';
  document.head.appendChild(css);

  var AL={wifi:'Wi-Fi',ac:'Кондиционер',kitchen:'Кухня',washer:'Стиральная машина',tv:'Smart TV',parking:'Парковка',balcony:'Балкон',view:'Панорамный вид',gym:'Спортзал',pool:'Бассейн',iron:'Утюг',hairdryer:'Фен'};

  function loadAptData(cb){
    if(aptData){cb(aptData);return}
    var x=new XMLHttpRequest();
    x.open('GET',SB+'/rest/v1/apartments?select=id,name,photo_url,description,amenities,complex,floor,style,weekday_price,weekend_price,rooms,max_guests');
    x.setRequestHeader('apikey',SK);
    x.setRequestHeader('Authorization','Bearer '+SK);
    x.onload=function(){
      try{
        var d=JSON.parse(x.responseText);aptData={};
        for(var i=0;i<d.length;i++){var a=d[i],ph=[];
          try{var p=JSON.parse(a.photo_url);if(p&&p.length)ph=p}catch(e){if(a.photo_url)ph=[a.photo_url]}
          a._photos=ph;a._cover=ph[0]||'';aptData[a.id]=a;
          var nm=a.name.match(/(\d+)/);if(nm)aptData['apt_'+nm[1]]=a;
        }cb(aptData);
      }catch(e){aptData={};cb(aptData)}
    };
    x.onerror=function(){aptData={};cb(aptData)};x.send();
  }

  function applyPhotos(){
    var cards=document.querySelectorAll('#resultsList .card__img');
    if(!cards.length)return;
    loadAptData(function(data){
      for(var i=0;i<cards.length;i++){var imgDiv=cards[i];
        if(imgDiv.getAttribute('data-pd'))continue;imgDiv.setAttribute('data-pd','1');
        var card=imgDiv.closest?imgDiv.closest('.card'):imgDiv.parentElement;if(!card)continue;
        var t=card.querySelector('.card__title')||card.querySelector('h3');if(!t)continue;
        var nm=t.textContent.trim().match(/(\d+)/);if(!nm)continue;
        var apt=data['apt_'+nm[1]];
        if(apt&&apt._cover){imgDiv.style.backgroundImage='url('+apt._cover+')';imgDiv.style.backgroundSize='cover';imgDiv.style.backgroundPosition='center'}
        (function(n){card.addEventListener('click',function(e){
          if(e.target.closest('span[onclick],a[onclick],button'))return;
          var a=data['apt_'+n];if(a)openModal(a);
        })})(nm[1]);
      }
    });
  }

  function fixStaticCards(){
    loadAptData(function(data){
      var g=document.getElementById('aptGrid');if(!g)return;
      var cards=g.querySelectorAll('.card__img');
      for(var i=0;i<cards.length;i++){var imgDiv=cards[i];
        if(imgDiv.getAttribute('data-pd2'))continue;imgDiv.setAttribute('data-pd2','1');
        var card=imgDiv.closest?imgDiv.closest('[data-complex]'):imgDiv.parentElement;if(!card)continue;
        var t=card.querySelector('.card__title')||card.querySelector('h3');if(!t)continue;
        var nm=t.textContent.trim().match(/(\d+)/);if(!nm)continue;
        (function(n){card.style.cursor='pointer';card.addEventListener('click',function(e){
          if(e.target.closest('a'))return;var a=data['apt_'+n];if(a)openModal(a);
        })})(nm[1]);
      }
    });
  }

  var ov=document.createElement('div');ov.className='apt-modal-overlay';
  ov.innerHTML='<div class="apt-modal" id="amc"></div>';
  ov.addEventListener('click',function(e){if(e.target===ov)closeModal()});
  document.body.appendChild(ov);
  var cpi=0,cph=[];

  function openModal(apt){
    cph=apt._photos||[];cpi=0;
    var desc=(apt.description||'').replace(/\[VIDEO:.*?\]/g,'').trim();
    var vm=(apt.description||'').match(/\[VIDEO:(.*?)\]/);
    var am=apt.amenities||[];
    var h='<button class="apt-modal-close" onclick="window._cm()">X</button>';
    if(cph.length){
      h+='<div class="apt-modal-gallery" id="ag"><img src="'+cph[0]+'" id="agi">';
      if(cph.length>1){
        h+='<button class="gnav gp" onclick="window._gn(-1)">&lsaquo;</button>';
        h+='<button class="gnav gn" onclick="window._gn(1)">&rsaquo;</button>';
        h+='<div class="gdots" id="gd">';
        for(var i=0;i<cph.length;i++)h+='<span'+(i===0?' class="ac"':'')+' onclick="window._gg('+i+')"></span>';
        h+='</div>';
      }
      h+='</div>';
    }else{
      h+='<div class="apt-modal-gallery" style="display:flex;align-items:center;justify-content:center"><span style="color:#6b665e;font-size:16px">Фото скоро будут добавлены</span></div>';
    }
    h+='<div class="apt-modal-body"><div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:16px"><div><div class="amt">'+apt.name+'</div>';
    if(apt.style)h+='<div style="color:#6b665e;font-size:14px;margin-top:4px">'+apt.style+'</div>';
    h+='</div><div style="text-align:right"><div class="ampr">от $'+apt.weekday_price+'</div><div style="font-size:12px;color:#6b665e">за ночь</div></div></div>';
    h+='<div class="ammeta"><span>'+apt.complex+'</span><span>Этаж '+apt.floor+'</span>';
    if(apt.rooms)h+='<span>'+apt.rooms+'</span>';
    if(apt.max_guests)h+='<span>До '+apt.max_guests+' гостей</span>';
    h+='</div>';
    if(desc)h+='<div class="amdesc">'+desc.replace(/\n/g,'<br>')+'</div>';
    if(am.length){h+='<h3 style="color:#e8e2d6;font-size:16px;font-weight:400;margin-bottom:12px">Удобства</h3><div class="amamen">';
      for(var i=0;i<am.length;i++)h+='<div>'+(AL[am[i]]||am[i])+'</div>';
      h+='</div>';
    }
    if(vm){var yt=vm[1].match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
      if(yt)h+='<div style="margin-bottom:24px"><iframe width="100%" height="315" src="https://www.youtube.com/embed/'+yt[1]+'" frameborder="0" allowfullscreen style="border-radius:8px"></iframe></div>';
    }
    h+='</div><div class="ambook"><div style="flex:1;color:#6b665e;font-size:13px">Выберите даты для проверки доступности</div><button onclick="window._cm();document.getElementById(\'booking\').scrollIntoView({behavior:\'smooth\'})">Забронировать</button></div>';
    document.getElementById('amc').innerHTML=h;
    ov.classList.add('active');document.body.style.overflow='hidden';
  }
  window._cm=function(){ov.classList.remove('active');document.body.style.overflow=''};
  window._gn=function(d){cpi=(cpi+d+cph.length)%cph.length;ug()};
  window._gg=function(i){cpi=i;ug()};
  function ug(){var img=document.getElementById('agi');if(img)img.src=cph[cpi];
    var dots=document.querySelectorAll('#gd span');for(var i=0;i<dots.length;i++)dots[i].className=i===cpi?'ac':'';
  }
  document.addEventListener('keydown',function(e){if(!ov.classList.contains('active'))return;
    if(e.key==='Escape')window._cm();if(e.key==='ArrowLeft')window._gn(-1);if(e.key==='ArrowRight')window._gn(1);
  });

  function start(){
    var el=document.getElementById('resultsList');
    if(el){var obs=new MutationObserver(function(){setTimeout(applyPhotos,100)});
      obs.observe(el,{childList:true,subtree:true});applyPhotos();}
    fixStaticCards();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
  else start();
})();
