// photo-cards.js v3 — Airbnb-style cards with photo gallery modal
(function(){
  var SB='https://sebvfvtofiysbywxjqut.supabase.co';
  var SK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI';
  var aptData=null;

  // Inject CSS
  var css=document.createElement('style');
  css.textContent=`
    /* Fix cropped photos in static apartment grid */
    #aptGrid .card__img{aspect-ratio:3/2!important;height:auto!important;max-height:400px}
    #aptGrid .card__img img{width:100%;height:100%;object-fit:cover;object-position:center}
    
    /* Search result cards — Airbnb style */
    #resultsList{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(320px,1fr))!important;gap:24px!important;padding:0!important}
    #resultsList .card{border:1px solid rgba(232,226,214,.12)!important;border-radius:12px!important;overflow:hidden!important;background:#141414!important;cursor:pointer!important;transition:transform .2s,box-shadow .2s!important;display:flex!important;flex-direction:column!important}
    #resultsList .card:hover{transform:translateY(-4px)!important;box-shadow:0 8px 30px rgba(0,0,0,.4)!important}
    #resultsList .card__img{aspect-ratio:4/3!important;height:auto!important;min-height:0!important;position:relative!important;background-size:cover!important;background-position:center!important;overflow:hidden!important}
    #resultsList .card__img .card__badge{position:absolute!important;top:12px!important;left:12px!important;z-index:2!important}
    #resultsList .card__img>div:last-child{position:absolute!important;bottom:12px!important;right:12px!important;z-index:2!important;text-align:right!important}
    #resultsList .card__info{padding:16px!important}
    #resultsList .card__title{font-size:18px!important;margin-bottom:4px!important}
    #resultsList .card__sub{color:#a8a096!important;font-size:13px!important;margin-bottom:12px!important}
    
    /* Apartment detail modal */
    .apt-modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .3s;pointer-events:none}
    .apt-modal-overlay.active{opacity:1;pointer-events:all}
    .apt-modal{background:#1a1a1a;border:1px solid rgba(232,226,214,.15);border-radius:16px;width:90%;max-width:900px;max-height:90vh;overflow-y:auto;position:relative}
    .apt-modal-close{position:absolute;top:16px;right:16px;width:36px;height:36px;background:rgba(0,0,0,.6);border:none;color:#fff;font-size:20px;border-radius:50%;cursor:pointer;z-index:10;display:flex;align-items:center;justify-content:center}
    .apt-modal-close:hover{background:rgba(201,169,97,.8)}
    .apt-modal-gallery{position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;border-radius:16px 16px 0 0}
    .apt-modal-gallery img{width:100%;height:100%;object-fit:cover;transition:opacity .3s}
    .apt-modal-gallery-nav{position:absolute;top:50%;transform:translateY(-50%);width:40px;height:40px;background:rgba(0,0,0,.5);border:none;color:#fff;font-size:20px;border-radius:50%;cursor:pointer;z-index:5}
    .apt-modal-gallery-nav:hover{background:rgba(201,169,97,.8)}
    .apt-modal-gallery-nav.prev{left:12px}
    .apt-modal-gallery-nav.next{right:12px}
    .apt-modal-gallery-dots{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:5}
    .apt-modal-gallery-dots span{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.4);cursor:pointer}
    .apt-modal-gallery-dots span.active{background:#c9a961}
    .apt-modal-body{padding:32px}
    .apt-modal-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px}
    .apt-modal-title{font-family:'Cormorant Garamond',serif;font-size:32px;font-weight:400;color:#e8e2d6}
    .apt-modal-price{text-align:right}
    .apt-modal-price .price{font-size:28px;color:#c9a961;font-weight:300}
    .apt-modal-price .price-sub{font-size:12px;color:#6b665e}
    .apt-modal-meta{display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap}
    .apt-modal-meta span{background:rgba(201,169,97,.1);color:#c9a961;padding:6px 14px;border-radius:6px;font-size:13px}
    .apt-modal-desc{color:#a8a096;line-height:1.7;margin-bottom:24px;font-size:15px}
    .apt-modal-amenities{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:32px}
    .apt-modal-amenity{display:flex;align-items:center;gap:8px;color:#a8a096;font-size:13px}
    .apt-modal-amenity::before{content:'✓';color:#c9a961;font-weight:700}
    .apt-modal-book{display:flex;gap:16px;align-items:center;padding:24px;background:rgba(201,169,97,.05);border-top:1px solid rgba(232,226,214,.1);border-radius:0 0 16px 16px}
    .apt-modal-book .book-btn{padding:14px 32px;background:#c9a961;color:#0a0a0a;border:none;font-size:14px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;font-family:inherit;border-radius:8px}
    .apt-modal-book .book-btn:hover{background:#a88947}
    .apt-modal-book .book-info{flex:1;color:#6b665e;font-size:13px}

    @media(max-width:768px){
      #resultsList{grid-template-columns:1fr!important}
      .apt-modal{width:95%;max-height:95vh}
      .apt-modal-body{padding:20px}
      .apt-modal-header{flex-direction:column;gap:12px}
    }
  `;
  document.head.appendChild(css);

  // Load all apartment data from Supabase
  function loadAptData(cb){
    if(aptData){cb(aptData);return}
    var x=new XMLHttpRequest();
    x.open('GET',SB+'/rest/v1/apartments?select=id,name,photo_url,description,amenities,complex,floor,style,weekday_price,weekend_price,rooms,max_guests');
    x.setRequestHeader('apikey',SK);
    x.setRequestHeader('Authorization','Bearer '+SK);
    x.onload=function(){
      try{
        var data=JSON.parse(x.responseText);
        aptData={};
        for(var i=0;i<data.length;i++){
          var a=data[i],photos=[];
          try{var p=JSON.parse(a.photo_url);if(p&&p.length)photos=p}catch(e){if(a.photo_url)photos=[a.photo_url]}
          a._photos=photos;a._cover=photos[0]||'';
          aptData[a.id]=a;
          var numMatch=a.name.match(/(\d+)/);
          if(numMatch)aptData['apt_'+numMatch[1]]=a;
        }
        cb(aptData);
      }catch(e){aptData={};cb(aptData)}
    };
    x.onerror=function(){aptData={};cb(aptData)};
    x.send();
  }

  var AMENITY_LABELS={wifi:'Wi-Fi',ac:'Кондиционер',kitchen:'Кухня',washer:'Стиральная машина',tv:'Smart TV',parking:'Парковка',balcony:'Балкон',view:'Панорамный вид',gym:'Спортзал',pool:'Бассейн',iron:'Утюг',hairdryer:'Фен'};

  // Apply photos to search result cards
  function applyPhotos(){
    var cards=document.querySelectorAll('#resultsList .card__img');
    if(!cards.length)return;
    loadAptData(function(data){
      for(var i=0;i<cards.length;i++){
        var imgDiv=cards[i];
        if(imgDiv.getAttribute('data-phdone'))continue;
        imgDiv.setAttribute('data-phdone','1');
        var card=imgDiv.closest?imgDiv.closest('.card'):imgDiv.parentElement;
        if(!card)continue;
        var titleEl=card.querySelector('.card__title')||card.querySelector('h3');
        if(!titleEl)continue;
        var numMatch=titleEl.textContent.trim().match(/(\d+)/);
        if(!numMatch)continue;
        var apt=data['apt_'+numMatch[1]];
        if(apt&&apt._cover){
          imgDiv.style.backgroundImage='url('+apt._cover+')';
          imgDiv.style.backgroundSize='cover';
          imgDiv.style.backgroundPosition='center';
        }
        // Add click handler to open modal
        (function(aptNum){
          card.addEventListener('click',function(e){
            if(e.target.closest('span[onclick],a[onclick],button'))return;
            var a=data['apt_'+aptNum];
            if(a)openAptModal(a);
          });
        })(numMatch[1]);
      }
    });
  }

  // Also fix static apartment cards (Наши резиденции)
  function fixStaticCards(){
    loadAptData(function(data){
      var grid=document.getElementById('aptGrid');
      if(!grid)return;
      var cards=grid.querySelectorAll('.card__img');
      for(var i=0;i<cards.length;i++){
        var imgDiv=cards[i];
        if(imgDiv.getAttribute('data-phdone2'))continue;
        imgDiv.setAttribute('data-phdone2','1');
        var card=imgDiv.closest?imgDiv.closest('[data-complex]'):imgDiv.parentElement;
        if(!card)continue;
        var titleEl=card.querySelector('.card__title')||card.querySelector('h3');
        if(!titleEl)continue;
        var numMatch=titleEl.textContent.trim().match(/(\d+)/);
        if(!numMatch)continue;
        var apt=data['apt_'+numMatch[1]];
        // Add click handler for static cards too
        (function(aptNum){
          card.style.cursor='pointer';
          card.addEventListener('click',function(e){
            if(e.target.closest('a'))return;
            var a=data['apt_'+aptNum];
            if(a)openAptModal(a);
          });
        })(numMatch[1]);
      }
    });
  }

  // Create modal overlay (once)
  var modalOverlay=document.createElement('div');
  modalOverlay.className='apt-modal-overlay';
  modalOverlay.innerHTML='<div class="apt-modal" id="aptModalContent"></div>';
  modalOverlay.addEventListener('click',function(e){if(e.target===modalOverlay)closeAptModal()});
  document.body.appendChild(modalOverlay);

  var currentPhotoIdx=0;
  var currentPhotos=[];

  function openAptModal(apt){
    currentPhotos=apt._photos||[];
    currentPhotoIdx=0;
    var desc=(apt.description||'').replace(/\[VIDEO:.*?\]/g,'').trim();
    var vidMatch=(apt.description||'').match(/\[VIDEO:(.*?)\]/);
    var amenities=apt.amenities||[];
    
    var html='<button class="apt-modal-close" onclick="window._closeAptModal()">✕</button>';
    
    // Gallery
    if(currentPhotos.length){
      html+='<div class="apt-modal-gallery" id="aptGallery">';
      html+='<img src="'+currentPhotos[0]+'" id="aptGalleryImg">';
      if(currentPhotos.length>1){
        html+='<button class="apt-modal-gallery-nav prev" onclick="window._galleryNav(-1)">‹</button>';
        html+='<button class="apt-modal-gallery-nav next" onclick="window._galleryNav(1)">›</button>';
        html+='<div class="apt-modal-gallery-dots" id="aptGalleryDots">';
        for(var i=0;i<currentPhotos.length;i++){
          html+='<span'+(i===0?' class="active"':'')+' onclick="window._galleryGo('+i+')"></span>';
        }
        html+='</div>';
      }
      html+='</div>';
    }
    
    html+='<div class="apt-modal-body">';
    html+='<div class="apt-modal-header"><div><div class="apt-modal-title">'+apt.name+'</div>';
    if(apt.style)html+='<div style="color:#6b665e;font-size:14px;margin-top:4px">'+apt.style+'</div>';
    html+='</div><div class="apt-modal-price"><div class="price">от $'+apt.weekday_price+'</div><div class="price-sub">за ночь</div></div></div>';
    
    // Meta badges
    html+='<div class="apt-modal-meta">';
    html+='<span>'+apt.complex+'</span>';
    html+='<span>Этаж '+apt.floor+'</span>';
    if(apt.rooms)html+='<span>'+apt.rooms+'</span>';
    if(apt.max_guests)html+='<span>До '+apt.max_guests+' гостей</span>';
    html+='</div>';
    
    // Description
    if(desc)html+='<div class="apt-modal-desc">'+desc.replace(/\n/g,'<br>')+'</div>';
    
    // Amenities
    if(amenities.length){
      html+='<h3 style="color:#e8e2d6;font-size:16px;font-weight:400;margin-bottom:12px">Удобства</h3>';
      html+='<div class="apt-modal-amenities">';
      for(var i=0;i<amenities.length;i++){
        html+='<div class="apt-modal-amenity">'+(AMENITY_LABELS[amenities[i]]||amenities[i])+'</div>';
      }
      html+='</div>';
    }
    
    // Video
    if(vidMatch){
      var vidUrl=vidMatch[1];
      var ytMatch=vidUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
      if(ytMatch){
        html+='<div style="margin-bottom:24px"><iframe width="100%" height="315" src="https://www.youtube.com/embed/'+ytMatch[1]+'" frameborder="0" allowfullscreen style="border-radius:8px"></iframe></div>';
      }
    }
    
    html+='</div>';
    
    // Book section
    html+='<div class="apt-modal-book">';
    html+='<div class="book-info">Выберите даты в форме бронирования для проверки доступности и расчёта стоимости</div>';
    html+='<button class="book-btn" onclick="window._closeAptModal();document.getElementById(\'booking\').scrollIntoView({behavior:\'smooth\'})">Забронировать</button>';
    html+='</div>';
    
    document.getElementById('aptModalContent').innerHTML=html;
    modalOverlay.classList.add('active');
    document.body.style.overflow='hidden';
  }

  window._closeAptModal=function(){
    modalOverlay.classList.remove('active');
    document.body.style.overflow='';
  };
  window._galleryNav=function(dir){
    currentPhotoIdx=(currentPhotoIdx+dir+currentPhotos.length)%currentPhotos.length;
    updateGallery();
  };
  window._galleryGo=function(idx){
    currentPhotoIdx=idx;
    updateGallery();
  };
  function updateGallery(){
    var img=document.getElementById('aptGalleryImg');
    if(img)img.src=currentPhotos[currentPhotoIdx];
    var dots=document.querySelectorAll('#aptGalleryDots span');
    for(var i=0;i<dots.length;i++)dots[i].className=i===currentPhotoIdx?'active':'';
  }

  // Keyboard navigation
  document.addEventListener('keydown',function(e){
    if(!modalOverlay.classList.contains('active'))return;
    if(e.key==='Escape')window._closeAptModal();
    if(e.key==='ArrowLeft')window._galleryNav(-1);
    if(e.key==='ArrowRight')window._galleryNav(1);
  });

  // MutationObserver for search results
  function startObserving(){
    var el=document.getElementById('resultsList');
    if(!el)return;
    var obs=new MutationObserver(function(){setTimeout(applyPhotos,100)});
    obs.observe(el,{childList:true,subtree:true});
    applyPhotos();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){startObserving();fixStaticCards()});
  }else{
    startObserving();fixStaticCards();
  }
})();
