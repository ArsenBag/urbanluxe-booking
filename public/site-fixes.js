/* site-fixes.js — Исправления и улучшения для Urban Luxe
   Подключение: <script src="/site-fixes.js"></script> перед </body> в index.html
   
   Фиксы:
   1. Свайп/скролл фото на карточках без открытия модалки
   2. Телефоны в десктопной навигации
   3. Фикс избранного — открытие модалки вместо редиректа
   4. Дополнительные улучшения UX
*/
(function(){
'use strict';

// ===== INJECT CSS =====
const css = document.createElement('style');
css.textContent = `
/* Photo carousel on cards */
.sf-carousel{position:relative;overflow:hidden;cursor:grab;touch-action:pan-y}
.sf-carousel:active{cursor:grabbing}
.sf-carousel .sf-track{display:flex;transition:transform .3s ease;will-change:transform}
.sf-carousel .sf-track img{width:100%;flex-shrink:0;object-fit:cover;pointer-events:none;display:block}
.sf-dots{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);display:flex;gap:4px;z-index:2}
.sf-dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.4);transition:all .2s;cursor:pointer}
.sf-dot.active{background:#fff;transform:scale(1.3)}
.sf-arrows{position:absolute;top:50%;width:100%;display:flex;justify-content:space-between;transform:translateY(-50%);padding:0 6px;z-index:2;pointer-events:none;opacity:0;transition:opacity .2s}
.sf-carousel:hover .sf-arrows{opacity:1}
.sf-arrow{pointer-events:all;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,.5);color:#fff;border:none;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);transition:background .2s}
.sf-arrow:hover{background:rgba(0,0,0,.7)}
@media(max-width:900px){.sf-arrows{opacity:1}.sf-arrow{width:32px;height:32px}}

/* Phone in navbar */
.nav__phones{display:flex;align-items:center;gap:6px;margin-left:8px}
.nav__phone{display:flex;align-items:center;gap:4px;color:var(--ink-m,#a8a096);font-size:11px;text-decoration:none;transition:color .2s;white-space:nowrap}
.nav__phone:hover{color:var(--gold,#c9a961)}
.nav__phone-icon{font-size:13px}
@media(max-width:900px){.nav__phones{display:none}}

/* Fix for favorite cards click */
.sf-fav-overlay{cursor:pointer}
`;
document.head.appendChild(css);


// ===== 1. PHOTO CAROUSEL ON CARDS =====
function initCardCarousels(){
  const cards = document.querySelectorAll('#aptGrid > *');
  
  cards.forEach(card => {
    // Skip if already has carousel
    if(card.querySelector('.sf-carousel')) return;
    
    const imgContainer = card.querySelector('.card__img, [style*="overflow"]');
    if(!imgContainer) return;
    
    // Get apartment ID from onclick
    const onclickAttr = card.getAttribute('onclick') || '';
    const aptId = onclickAttr.match(/'([^']+)'/)?.[1];
    if(!aptId) return;
    
    // Get current image
    const existingImg = imgContainer.querySelector('img');
    if(!existingImg) return;
    
    // Load all photos for this apartment from Supabase storage
    loadPhotos(aptId).then(photos => {
      if(!photos || photos.length <= 1) return;
      
      // Create carousel
      const carousel = document.createElement('div');
      carousel.className = 'sf-carousel';
      carousel.style.cssText = imgContainer.getAttribute('style') || '';
      
      // Track with images
      const track = document.createElement('div');
      track.className = 'sf-track';
      
      photos.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.alt = '';
        img.loading = 'lazy';
        img.style.height = existingImg.style.height || '240px';
        track.appendChild(img);
      });
      
      // Dots
      const dots = document.createElement('div');
      dots.className = 'sf-dots';
      photos.forEach((_, i) => {
        const dot = document.createElement('span');
        dot.className = 'sf-dot' + (i === 0 ? ' active' : '');
        dot.onclick = e => { e.stopPropagation(); goToSlide(carousel, i); };
        dots.appendChild(dot);
      });
      
      // Arrows
      const arrows = document.createElement('div');
      arrows.className = 'sf-arrows';
      arrows.innerHTML = '<button class="sf-arrow prev" onclick="event.stopPropagation()">‹</button><button class="sf-arrow next" onclick="event.stopPropagation()">›</button>';
      
      carousel.appendChild(track);
      carousel.appendChild(dots);
      carousel.appendChild(arrows);
      
      // Replace img container content
      imgContainer.innerHTML = '';
      imgContainer.appendChild(carousel);
      
      // Re-add photo count badge and fav button
      const photoCountEl = document.createElement('div');
      photoCountEl.style.cssText = 'position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,.6);color:#fff;padding:3px 8px;border-radius:4px;font-size:10px;z-index:3;display:flex;align-items:center;gap:3px;backdrop-filter:blur(4px)';
      photoCountEl.innerHTML = '📷 ' + photos.length;
      imgContainer.appendChild(photoCountEl);
      
      // Initialize carousel state
      carousel._currentSlide = 0;
      carousel._totalSlides = photos.length;
      
      // Arrow click handlers
      arrows.querySelector('.prev').addEventListener('click', e => {
        e.stopPropagation();
        goToSlide(carousel, carousel._currentSlide - 1);
      });
      arrows.querySelector('.next').addEventListener('click', e => {
        e.stopPropagation();
        goToSlide(carousel, carousel._currentSlide + 1);
      });
      
      // Touch/swipe handlers
      let startX = 0, startY = 0, isDragging = false, moved = false;
      
      carousel.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isDragging = true;
        moved = false;
        track.style.transition = 'none';
      }, {passive: true});
      
      carousel.addEventListener('touchmove', e => {
        if(!isDragging) return;
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        if(Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10){
          moved = true;
          const offset = -(carousel._currentSlide * 100) + (dx / carousel.offsetWidth * 100);
          track.style.transform = `translateX(${offset}%)`;
        }
      }, {passive: true});
      
      carousel.addEventListener('touchend', e => {
        if(!isDragging) return;
        isDragging = false;
        track.style.transition = 'transform .3s ease';
        if(moved){
          const dx = e.changedTouches[0].clientX - startX;
          if(dx < -50) goToSlide(carousel, carousel._currentSlide + 1);
          else if(dx > 50) goToSlide(carousel, carousel._currentSlide - 1);
          else goToSlide(carousel, carousel._currentSlide);
          // Prevent card click
          card._sfSwiped = true;
          setTimeout(() => card._sfSwiped = false, 300);
        }
      });
      
      // Mouse drag for desktop
      carousel.addEventListener('mousedown', e => {
        if(e.target.classList.contains('sf-arrow')) return;
        startX = e.clientX;
        isDragging = true;
        moved = false;
        track.style.transition = 'none';
        e.preventDefault();
      });
      
      document.addEventListener('mousemove', e => {
        if(!isDragging) return;
        const dx = e.clientX - startX;
        if(Math.abs(dx) > 10){
          moved = true;
          const offset = -(carousel._currentSlide * 100) + (dx / carousel.offsetWidth * 100);
          track.style.transform = `translateX(${offset}%)`;
        }
      });
      
      document.addEventListener('mouseup', e => {
        if(!isDragging) return;
        isDragging = false;
        track.style.transition = 'transform .3s ease';
        if(moved){
          const dx = e.clientX - startX;
          if(dx < -50) goToSlide(carousel, carousel._currentSlide + 1);
          else if(dx > 50) goToSlide(carousel, carousel._currentSlide - 1);
          else goToSlide(carousel, carousel._currentSlide);
          card._sfSwiped = true;
          setTimeout(() => card._sfSwiped = false, 300);
        }
      });
    });
    
    // Prevent modal opening on swipe
    const origOnclick = card.getAttribute('onclick');
    if(origOnclick){
      card.removeAttribute('onclick');
      card.addEventListener('click', e => {
        if(card._sfSwiped) return;
        if(e.target.closest('.sf-arrow, .sf-dot, .sf-dots')) return;
        eval(origOnclick);
      });
    }
  });
}

function goToSlide(carousel, idx){
  const total = carousel._totalSlides;
  if(idx < 0) idx = 0;
  if(idx >= total) idx = total - 1;
  carousel._currentSlide = idx;
  const track = carousel.querySelector('.sf-track');
  track.style.transform = `translateX(-${idx * 100}%)`;
  // Update dots
  carousel.querySelectorAll('.sf-dot').forEach((d, i) => {
    d.classList.toggle('active', i === idx);
  });
}

async function loadPhotos(aptId){
  try{
    const SB_URL = 'https://sebvfvtofiysbywxjqut.supabase.co';
    const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI';
    
    const res = await fetch(`${SB_URL}/storage/v1/object/list/apartments/${aptId}`, {
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY }
    });
    if(!res.ok) return null;
    const files = await res.json();
    const photos = files
      .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(f => `${SB_URL}/storage/v1/object/public/apartments/${aptId}/${f.name}`);
    return photos.length > 0 ? photos : null;
  } catch(e){ return null; }
}


// ===== 2. PHONE NUMBERS IN DESKTOP NAV =====
function addPhonesToNav(){
  const nav = document.querySelector('.nav, #navbar');
  if(!nav || nav.querySelector('.nav__phones')) return;
  
  const phonesDiv = document.createElement('div');
  phonesDiv.className = 'nav__phones';
  phonesDiv.innerHTML = `
    <a href="tel:+998936900044" class="nav__phone"><span class="nav__phone-icon">📞</span>+998 93 690 00 44</a>
    <span style="color:var(--line);font-size:10px">|</span>
    <a href="tel:+998999579485" class="nav__phone"><span class="nav__phone-icon">📞</span>+998 99 957 94 85</a>
  `;
  
  // Insert before the CTA button or lang switcher
  const ctaBtn = nav.querySelector('.nav__cta, [class*="cta"]');
  if(ctaBtn){
    ctaBtn.parentElement.insertBefore(phonesDiv, ctaBtn);
  } else {
    nav.appendChild(phonesDiv);
  }
}


// ===== 3. FIX FAVORITES — OPEN MODAL INSTEAD OF REDIRECT =====
function fixFavorites(){
  // On guest.html favorites page, clicking a card should open modal on main site
  if(window.location.pathname.includes('guest')){
    // Fix links in favorites section
    document.querySelectorAll('[onclick*="location"], [onclick*="window.location"]').forEach(el => {
      const onclick = el.getAttribute('onclick') || '';
      const aptMatch = onclick.match(/apt=([^'"&]+)/);
      if(aptMatch){
        const aptId = aptMatch[1];
        el.setAttribute('onclick', `window.location.href='/?apt=${aptId}'`);
      }
    });
    
    // Also fix card links
    document.querySelectorAll('a[href*="apt="]').forEach(a => {
      const aptId = a.href.match(/apt=([^&]+)/)?.[1];
      if(aptId){
        a.href = '/?apt=' + aptId;
      }
    });
  }
  
  // On index page, check if ?apt= parameter exists and auto-open modal
  if(window.location.pathname === '/' || window.location.pathname === '/index.html'){
    const params = new URLSearchParams(window.location.search);
    const aptId = params.get('apt');
    if(aptId && typeof openModal === 'function'){
      // Wait for apartments to load
      const waitForModal = setInterval(() => {
        if(document.querySelector('#aptGrid > *')){
          clearInterval(waitForModal);
          setTimeout(() => openModal(aptId), 500);
        }
      }, 500);
      // Safety timeout
      setTimeout(() => clearInterval(waitForModal), 10000);
    }
  }
}


// ===== INIT =====
// Phone numbers — immediate
setTimeout(addPhonesToNav, 500);

// Favorites fix — immediate
fixFavorites();

// Card carousels — after grid renders
function waitForGrid(){
  const grid = document.getElementById('aptGrid');
  if(!grid) return;
  
  const obs = new MutationObserver(() => {
    setTimeout(initCardCarousels, 1000);
  });
  obs.observe(grid, {childList: true});
  
  // Also init if grid already has content
  if(grid.children.length > 0){
    setTimeout(initCardCarousels, 2000);
  }
}
waitForGrid();

// Re-init carousels after filter changes
const origFilter = window.filterApts;
if(origFilter){
  window.filterApts = function(){
    origFilter.apply(this, arguments);
    setTimeout(initCardCarousels, 1000);
  };
}

console.log('[Site Fixes] Фото-карусель, телефоны, фикс избранного загружены ✓');
})();
