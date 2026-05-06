/* site-fixes.js v3 — Lazy carousel, phones, favorites
   Carousel loads ONLY on hover/touch — no extra photos loaded upfront. */
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
.sf-arrow{pointer-events:all;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,.5);color:#fff;border:none;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
.sf-arrow:hover{background:rgba(0,0,0,.7)}
@media(max-width:900px){.sf-arrows{opacity:1}.sf-arrow{width:32px;height:32px}}
.nav__phones{display:flex;align-items:center;gap:6px;margin-left:8px}
.nav__phone{display:flex;align-items:center;gap:4px;color:var(--ink-m,#a8a096);font-size:11px;text-decoration:none;transition:color .2s;white-space:nowrap}
.nav__phone:hover{color:var(--gold,#c9a961)}
@media(max-width:900px){.nav__phones{display:none}}
.sf-dots-hint{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);display:flex;gap:4px;z-index:2}
`;
document.head.appendChild(css);

let aptPhotos={};
async function loadPhotoData(){
  try{
    const{data}=await sb.from('apartments').select('id,photo_url').eq('is_active',true);
    (data||[]).forEach(a=>{try{const p=JSON.parse(a.photo_url);if(Array.isArray(p)&&p.length>1)aptPhotos[a.id]=p}catch(e){}});
  }catch(e){}
}

function goToSlide(c,idx){
  if(idx<0)idx=0;if(idx>=c._total)idx=c._total-1;
  c._cur=idx;
  c.querySelector('.sf-track').style.transform='translateX(-'+idx*100+'%)';
  c.querySelectorAll('.sf-dot').forEach((d,i)=>d.classList.toggle('active',i===idx));
  const imgs=c.querySelectorAll('.sf-track img');
  [idx,idx+1,idx+2].forEach(j=>{if(j>=0&&j<imgs.length&&!imgs[j].src&&imgs[j].dataset.src)imgs[j].src=imgs[j].dataset.src});
}

function buildCarousel(card,aptId){
  if(card.querySelector('.sf-carousel'))return;
  const photos=aptPhotos[aptId];if(!photos||photos.length<2)return;
  const imgDiv=card.querySelector('.card__img');if(!imgDiv)return;
  const old=imgDiv.querySelector('img');
  const h=old?old.offsetHeight||240:240;
  const coverSrc=old?old.src:photos[0];

  const carousel=document.createElement('div');carousel.className='sf-carousel';
  const track=document.createElement('div');track.className='sf-track';
  photos.forEach((url,i)=>{
    const img=document.createElement('img');
    if(i===0)img.src=coverSrc; else if(i===1)img.src=url; else img.dataset.src=url;
    img.alt='';img.style.height=h+'px';track.appendChild(img);
  });
  const dots=document.createElement('div');dots.className='sf-dots';
  for(let i=0;i<Math.min(photos.length,7);i++){const d=document.createElement('span');d.className='sf-dot'+(i?'':' active');d.addEventListener('click',e=>{e.stopPropagation();goToSlide(carousel,i)});dots.appendChild(d)}
  const arrows=document.createElement('div');arrows.className='sf-arrows';
  const pb=document.createElement('button');pb.className='sf-arrow';pb.textContent='\u2039';
  const nb=document.createElement('button');nb.className='sf-arrow';nb.textContent='\u203a';
  arrows.appendChild(pb);arrows.appendChild(nb);
  carousel.appendChild(track);carousel.appendChild(dots);carousel.appendChild(arrows);
  carousel._cur=0;carousel._total=photos.length;

  const badge=imgDiv.querySelector('.card__badge'),fav=imgDiv.querySelector('button'),ptag=imgDiv.querySelector('[style*="bottom:14px"]');
  const hint=imgDiv.querySelector('.sf-dots-hint');
  imgDiv.innerHTML='';imgDiv.appendChild(carousel);
  if(badge)imgDiv.appendChild(badge);if(fav)imgDiv.appendChild(fav);if(ptag)imgDiv.appendChild(ptag);

  pb.addEventListener('click',e=>{e.stopPropagation();goToSlide(carousel,carousel._cur-1)});
  nb.addEventListener('click',e=>{e.stopPropagation();goToSlide(carousel,carousel._cur+1)});

  let sx=0,drag=false,moved=false;
  carousel.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;drag=true;moved=false;track.style.transition='none'},{passive:true});
  carousel.addEventListener('touchmove',e=>{if(!drag)return;const dx=e.touches[0].clientX-sx;if(Math.abs(dx)>10){moved=true;track.style.transform='translateX('+(-(carousel._cur*100)+(dx/carousel.offsetWidth*100))+'%)'}},{passive:true});
  carousel.addEventListener('touchend',e=>{if(!drag)return;drag=false;track.style.transition='transform .3s ease';if(moved){const dx=e.changedTouches[0].clientX-sx;dx<-50?goToSlide(carousel,carousel._cur+1):dx>50?goToSlide(carousel,carousel._cur-1):goToSlide(carousel,carousel._cur);card._sw=true;setTimeout(()=>card._sw=false,300)}});
  carousel.addEventListener('mousedown',e=>{if(e.target.closest('.sf-arrow'))return;sx=e.clientX;drag=true;moved=false;track.style.transition='none';e.preventDefault()});
  document.addEventListener('mousemove',e=>{if(!drag)return;const dx=e.clientX-sx;if(Math.abs(dx)>10){moved=true;track.style.transform='translateX('+(-(carousel._cur*100)+(dx/carousel.offsetWidth*100))+'%)'}});
  document.addEventListener('mouseup',e=>{if(!drag)return;drag=false;track.style.transition='transform .3s ease';if(moved){const dx=e.clientX-sx;dx<-50?goToSlide(carousel,carousel._cur+1):dx>50?goToSlide(carousel,carousel._cur-1):goToSlide(carousel,carousel._cur);card._sw=true;setTimeout(()=>card._sw=false,300)}});

  card.removeAttribute('onclick');
  card.addEventListener('click',e=>{if(card._sw||e.target.closest('.sf-arrow,.sf-dot,.sf-dots,button'))return;openModal(aptId)});
}

function attachLazyCarousel(){
  document.querySelectorAll('#aptGrid > .card').forEach(card=>{
    if(card._sfReady)return;card._sfReady=true;
    const m=card.getAttribute('onclick')?.match(/'([^']+)'/);
    const aptId=m?m[1]:null;
    if(!aptId||!aptPhotos[aptId]||aptPhotos[aptId].length<2)return;
    // Show dot hints
    const imgDiv=card.querySelector('.card__img');
    if(imgDiv&&!imgDiv.querySelector('.sf-dots-hint')){
      const d=document.createElement('div');d.className='sf-dots-hint';
      for(let i=0;i<Math.min(aptPhotos[aptId].length,5);i++){const s=document.createElement('span');s.style.cssText='width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,'+(i?'.35':'1')+')';d.appendChild(s)}
      imgDiv.appendChild(d);
    }
    const go=()=>{card.removeEventListener('mouseenter',go);card.removeEventListener('touchstart',go);buildCarousel(card,aptId)};
    card.addEventListener('mouseenter',go,{once:true});
    card.addEventListener('touchstart',go,{once:true,passive:true});
  });
}

function addPhonesToNav(){
  const nav=document.querySelector('.nav,#navbar');if(!nav||nav.querySelector('.nav__phones'))return;
  const p=document.createElement('div');p.className='nav__phones';
  p.innerHTML='<a href="tel:+998936900044" class="nav__phone">\ud83d\udcde +998 93 690 00 44</a><span style="color:var(--line,#333);font-size:10px">|</span><a href="tel:+998999579485" class="nav__phone">\ud83d\udcde +998 99 957 94 85</a>';
  const c=nav.querySelector('.nav__cta,[class*="cta"]');if(c)c.parentElement.insertBefore(p,c);else nav.appendChild(p);
}

function fixFavorites(){
  if(window.location.pathname.includes('guest'))document.querySelectorAll('a[href*="apt="]').forEach(a=>{const id=a.href.match(/apt=([^&]+)/)?.[1];if(id)a.href='/?apt='+id});
  if(['/','/index.html',''].includes(window.location.pathname)){const id=new URLSearchParams(window.location.search).get('apt');if(id&&typeof openModal==='function'){const w=setInterval(()=>{if(document.querySelector('#aptGrid > .card')){clearInterval(w);setTimeout(()=>openModal(id),500)}},500);setTimeout(()=>clearInterval(w),10000)}}
}

addPhonesToNav();fixFavorites();
loadPhotoData().then(()=>{
  const g=document.getElementById('aptGrid');
  if(g&&g.children.length>0)setTimeout(attachLazyCarousel,300);
  if(g){const mo=new MutationObserver(()=>setTimeout(attachLazyCarousel,300));mo.observe(g,{childList:true})}
});
const of=window.filterApts;if(of){window.filterApts=function(){of.apply(this,arguments);setTimeout(attachLazyCarousel,500)}}
console.log('[Site Fixes v3] Lazy carousel \u2713');
})();
