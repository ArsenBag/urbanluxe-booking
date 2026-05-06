/* site-fixes.js v2 — Карусель фото, телефоны, фикс избранного
   Подключение: <script src="/site-fixes.js"></script> перед </body> в index.html И guest.html */
(function(){
'use strict';

const css=document.createElement('style');
css.textContent=`
.sf-carousel{position:relative;overflow:hidden;cursor:grab;touch-action:pan-y}
.sf-carousel:active{cursor:grabbing}
.sf-track{display:flex;transition:transform .3s ease;will-change:transform}
.sf-track img{width:100%;flex-shrink:0;object-fit:cover;pointer-events:none;display:block}
.sf-dots{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);display:flex;gap:4px;z-index:2}
.sf-dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.4);transition:all .2s;cursor:pointer}
.sf-dot.active{background:#fff;transform:scale(1.3)}
.sf-arrows{position:absolute;top:50%;width:100%;display:flex;justify-content:space-between;transform:translateY(-50%);padding:0 6px;z-index:2;pointer-events:none;opacity:0;transition:opacity .2s}
.sf-carousel:hover .sf-arrows{opacity:1}
.sf-arrow{pointer-events:all;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,.5);color:#fff;border:none;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);transition:background .2s}
.sf-arrow:hover{background:rgba(0,0,0,.7)}
@media(max-width:900px){.sf-arrows{opacity:1}.sf-arrow{width:32px;height:32px}}
.nav__phones{display:flex;align-items:center;gap:6px;margin-left:8px}
.nav__phone{display:flex;align-items:center;gap:4px;color:var(--ink-m,#a8a096);font-size:11px;text-decoration:none;transition:color .2s;white-space:nowrap}
.nav__phone:hover{color:var(--gold,#c9a961)}
@media(max-width:900px){.nav__phones{display:none}}
`;
document.head.appendChild(css);

// ===== LOAD PHOTO DATA FROM SUPABASE =====
let aptPhotos={};
async function loadPhotoData(){
  try{
    const{data}=await sb.from('apartments').select('id,photo_url').eq('is_active',true);
    (data||[]).forEach(a=>{
      try{const p=JSON.parse(a.photo_url);if(Array.isArray(p)&&p.length>1)aptPhotos[a.id]=p}catch(e){}
    });
  }catch(e){}
}

// ===== CAROUSEL LOGIC =====
function goToSlide(carousel,idx){
  const total=carousel._total;
  if(idx<0)idx=0;if(idx>=total)idx=total-1;
  carousel._cur=idx;
  carousel.querySelector('.sf-track').style.transform=`translateX(-${idx*100}%)`;
  carousel.querySelectorAll('.sf-dot').forEach((d,i)=>d.classList.toggle('active',i===idx));
  // Lazy load current and adjacent images
  const imgs=carousel.querySelectorAll('.sf-track img');
  [idx-1,idx,idx+1].forEach(j=>{
    if(j>=0&&j<imgs.length&&!imgs[j].src&&imgs[j].dataset.src){
      imgs[j].src=imgs[j].dataset.src;
    }
  });
}

function initCarousels(){
  const cards=document.querySelectorAll('#aptGrid > .card');
  cards.forEach(card=>{
    if(card.querySelector('.sf-carousel'))return;
    const onclick=card.getAttribute('onclick')||'';
    const aptId=onclick.match(/'([^']+)'/)?.[1];
    if(!aptId||!aptPhotos[aptId])return;
    const photos=aptPhotos[aptId];

    const imgDiv=card.querySelector('.card__img');
    if(!imgDiv)return;
    const existingImg=imgDiv.querySelector('img');
    const imgH=existingImg?.getBoundingClientRect()?.height||240;

    // Build carousel
    const carousel=document.createElement('div');
    carousel.className='sf-carousel';

    const track=document.createElement('div');
    track.className='sf-track';
    photos.forEach((url,i)=>{
      const img=document.createElement('img');
      // Only first image loads immediately, rest are lazy
      if(i===0){img.src=url;}else{img.dataset.src=url;img.src='';}
      img.alt='';img.style.height=imgH+'px';
      img.loading=i===0?'eager':'lazy';
      track.appendChild(img);
    });

    const dots=document.createElement('div');
    dots.className='sf-dots';
    const maxDots=Math.min(photos.length,7);
    for(let i=0;i<maxDots;i++){
      const dot=document.createElement('span');
      dot.className='sf-dot'+(i===0?' active':'');
      dot.addEventListener('click',e=>{e.stopPropagation();goToSlide(carousel,i)});
      dots.appendChild(dot);
    }

    const arrows=document.createElement('div');
    arrows.className='sf-arrows';
    const prevBtn=document.createElement('button');prevBtn.className='sf-arrow';prevBtn.textContent='‹';
    const nextBtn=document.createElement('button');nextBtn.className='sf-arrow';nextBtn.textContent='›';
    arrows.appendChild(prevBtn);arrows.appendChild(nextBtn);

    carousel.appendChild(track);carousel.appendChild(dots);carousel.appendChild(arrows);
    carousel._cur=0;carousel._total=photos.length;

    // Keep badge & fav button
    const badge=imgDiv.querySelector('.card__badge');
    const favBtn=imgDiv.querySelector('button');
    const photoCount=imgDiv.querySelector('[style*="position:absolute"][style*="bottom"]');

    imgDiv.innerHTML='';
    imgDiv.appendChild(carousel);
    if(badge)imgDiv.appendChild(badge);
    if(favBtn)imgDiv.appendChild(favBtn);
    if(photoCount)imgDiv.appendChild(photoCount);

    // Arrow events
    prevBtn.addEventListener('click',e=>{e.stopPropagation();goToSlide(carousel,carousel._cur-1)});
    nextBtn.addEventListener('click',e=>{e.stopPropagation();goToSlide(carousel,carousel._cur+1)});

    // Touch swipe
    let sx=0,sy=0,drag=false,moved=false;
    carousel.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY;drag=true;moved=false;track.style.transition='none'},{passive:true});
    carousel.addEventListener('touchmove',e=>{
      if(!drag)return;
      const dx=e.touches[0].clientX-sx,dy=e.touches[0].clientY-sy;
      if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>10){
        moved=true;
        track.style.transform=`translateX(${-(carousel._cur*100)+(dx/carousel.offsetWidth*100)}%)`;
      }
    },{passive:true});
    carousel.addEventListener('touchend',e=>{
      if(!drag)return;drag=false;track.style.transition='transform .3s ease';
      if(moved){
        const dx=e.changedTouches[0].clientX-sx;
        if(dx<-50)goToSlide(carousel,carousel._cur+1);
        else if(dx>50)goToSlide(carousel,carousel._cur-1);
        else goToSlide(carousel,carousel._cur);
        card._sfSwiped=true;setTimeout(()=>card._sfSwiped=false,300);
      }
    });

    // Mouse drag
    carousel.addEventListener('mousedown',e=>{
      if(e.target.closest('.sf-arrow'))return;
      sx=e.clientX;drag=true;moved=false;track.style.transition='none';e.preventDefault();
    });
    const onMM=e=>{
      if(!drag)return;const dx=e.clientX-sx;
      if(Math.abs(dx)>10){moved=true;track.style.transform=`translateX(${-(carousel._cur*100)+(dx/carousel.offsetWidth*100)}%)`}
    };
    const onMU=e=>{
      if(!drag)return;drag=false;track.style.transition='transform .3s ease';
      if(moved){
        const dx=e.clientX-sx;
        if(dx<-50)goToSlide(carousel,carousel._cur+1);
        else if(dx>50)goToSlide(carousel,carousel._cur-1);
        else goToSlide(carousel,carousel._cur);
        card._sfSwiped=true;setTimeout(()=>card._sfSwiped=false,300);
      }
    };
    document.addEventListener('mousemove',onMM);
    document.addEventListener('mouseup',onMU);

    // Lazy load images on slide change
    const origGo=goToSlide;

    // Fix onclick — prevent modal on swipe
    card.removeAttribute('onclick');
    card.addEventListener('click',e=>{
      if(card._sfSwiped)return;
      if(e.target.closest('.sf-arrow,.sf-dot,.sf-dots,button'))return;
      openModal(aptId);
    });
  });
}

// ===== PHONE NUMBERS IN NAV =====
function addPhonesToNav(){
  const nav=document.querySelector('.nav,#navbar');
  if(!nav||nav.querySelector('.nav__phones'))return;
  const ph=document.createElement('div');
  ph.className='nav__phones';
  ph.innerHTML='<a href="tel:+998936900044" class="nav__phone">📞 +998 93 690 00 44</a><span style="color:var(--line,#333);font-size:10px">|</span><a href="tel:+998999579485" class="nav__phone">📞 +998 99 957 94 85</a>';
  const cta=nav.querySelector('.nav__cta,[class*="cta"]');
  if(cta)cta.parentElement.insertBefore(ph,cta);else nav.appendChild(ph);
}

// ===== FIX FAVORITES =====
function fixFavorites(){
  if(window.location.pathname.includes('guest')){
    document.querySelectorAll('a[href*="apt="]').forEach(a=>{
      const aptId=a.href.match(/apt=([^&]+)/)?.[1];
      if(aptId)a.href='/?apt='+aptId;
    });
  }
  if(window.location.pathname==='/'||window.location.pathname==='/index.html'||window.location.pathname===''){
    const params=new URLSearchParams(window.location.search);
    const aptId=params.get('apt');
    if(aptId&&typeof openModal==='function'){
      const wait=setInterval(()=>{
        if(document.querySelector('#aptGrid > .card')){clearInterval(wait);setTimeout(()=>openModal(aptId),500)}
      },500);
      setTimeout(()=>clearInterval(wait),10000);
    }
  }
}

// ===== INIT =====
addPhonesToNav();
fixFavorites();

// Load photos then init carousels
loadPhotoData().then(()=>{
  const grid=document.getElementById('aptGrid');
  if(grid&&grid.children.length>0)setTimeout(initCarousels,500);
  // Watch for grid re-render (filter, load)
  if(grid){
    const mo=new MutationObserver(()=>setTimeout(initCarousels,500));
    mo.observe(grid,{childList:true});
  }
});

// Re-init after filter
const origFilter=window.filterApts;
if(origFilter){window.filterApts=function(){origFilter.apply(this,arguments);setTimeout(initCarousels,800)}}

console.log('[Site Fixes v2] Карусель, телефоны, избранное загружены ✓');
})();
