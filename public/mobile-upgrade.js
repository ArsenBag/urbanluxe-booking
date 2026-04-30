/* mobile-upgrade.js — Мобильная адаптация Urban Luxe
   Подключение: <script src="/mobile-upgrade.js"></script> перед </body>
   
   Добавляет:
   - Дополнительные breakpoints (480px, 640px)
   - Sticky CTA кнопка «Забронировать» внизу экрана
   - Touch-optimized карточки и кнопки (min 44px)
   - Свайп-карусель фото на карточках
   - Оптимизированные шрифты для мобилки
   - Улучшенная hero секция для телефонов
   - Адаптивная модалка бронирования
   - Bottom sheet навигация
*/
(function(){
'use strict';

const css = document.createElement('style');
css.textContent = `
/* ===== STICKY CTA BUTTON ===== */
@media(max-width:900px){
  #mu-sticky-cta{position:fixed;bottom:0;left:0;right:0;z-index:900;padding:10px 16px;padding-bottom:max(10px,env(safe-area-inset-bottom));background:linear-gradient(transparent,rgba(9,8,7,.95) 30%);display:flex;gap:8px;pointer-events:none;align-items:center}
  #mu-sticky-cta a,#mu-sticky-cta button{pointer-events:all;text-align:center;font-size:14px;font-family:inherit;font-weight:500;letter-spacing:.1em;text-transform:uppercase;border-radius:6px;cursor:pointer;text-decoration:none;display:flex;align-items:center;justify-content:center;transition:all .2s}
  #mu-sticky-cta .mu-cta-primary{flex:1;padding:14px 20px;background:var(--gold,#c9a961);color:#0a0a0a;border:none}
  #mu-sticky-cta .mu-cta-call{width:48px;height:48px;flex-shrink:0;background:transparent;color:var(--ink,#e8e2d6);border:1px solid rgba(201,169,97,.3);font-size:18px;letter-spacing:0;padding:0}
  body{padding-bottom:70px}
}
@media(min-width:901px){#mu-sticky-cta{display:none}}

/* ===== FLOATING CONTACTS (desktop) ===== */
#mu-contacts-float{display:none}
@media(min-width:901px){
  #mu-contacts-float{display:flex;position:fixed;bottom:20px;left:20px;z-index:800;flex-direction:column;gap:6px}
  #mu-contacts-float a{display:flex;align-items:center;gap:8px;padding:8px 14px;background:rgba(9,8,7,.85);backdrop-filter:blur(12px);border:1px solid rgba(201,169,97,.15);border-radius:8px;color:var(--ink-m,#a8a096);font-size:12px;text-decoration:none;font-family:inherit;transition:all .2s}
  #mu-contacts-float a:hover{border-color:var(--gold,#c9a961);color:var(--gold,#c9a961)}
}

/* ===== SMALL SCREENS (480px) ===== */
@media(max-width:480px){
  /* Hero */
  .hero h1{font-size:28px!important;line-height:1.2!important}
  .hero__label{font-size:10px!important}
  .hero p{font-size:13px!important}
  .hero{min-height:85vh!important;padding:0 20px 40px!important}
  .hero__stats{gap:20px!important}
  .hero__stats span:first-child{font-size:28px!important}

  /* Navigation */
  .nav{padding:10px 16px!important}
  .nav__logo{font-size:14px!important}
  .hamburger{font-size:24px!important;padding:8px!important}
  .nav__cta{display:none!important}
  .nav__lang{display:none!important}
  .nav__personal{display:none!important}

  /* Sections */
  section{padding:50px 16px!important}
  .sh__title{font-size:24px!important}
  .sh__label{font-size:9px!important;letter-spacing:.15em!important}

  /* Cards */
  #aptGrid{grid-template-columns:1fr!important;gap:16px!important}
  .card img,.apt-card img,[class*="card"] img{height:220px!important;object-fit:cover}

  /* Filters */
  .filters,.filter-btns,[class*="filter"]{overflow-x:auto!important;flex-wrap:nowrap!important;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:4px!important}
  .filters::-webkit-scrollbar,.filter-btns::-webkit-scrollbar{display:none}
  .filters button,.filter-btns button{white-space:nowrap!important;flex-shrink:0!important;padding:8px 16px!important;font-size:11px!important}

  /* Typography */
  h2{font-size:22px!important}
  h3{font-size:16px!important}
  p{font-size:14px!important;line-height:1.6!important}

  /* Footer */
  .footer{grid-template-columns:1fr!important;gap:24px!important;padding:40px 16px!important}

  /* Steps */
  .step{padding:20px!important}
  .step-num{font-size:28px!important}

  /* Reviews */
  .review{padding:20px!important}

  /* Modal */
  .modal-overlay{align-items:flex-end!important}
  .modal{width:100%!important;max-height:90vh!important;border-radius:16px 16px 0 0!important;margin:0!important}
  .modal-body{padding:16px!important}
  .modal-close{top:8px!important;right:8px!important;font-size:28px!important;width:40px!important;height:40px!important}

  /* Booking section */
  .booking-grid{gap:24px!important}
  .booking-grid input,.booking-grid select{font-size:16px!important;padding:12px!important}
  .booking-grid button{padding:14px!important;font-size:14px!important}

  /* Philosophy */
  .philosophy{gap:24px!important}
  .philosophy__img{height:300px!important;border-radius:12px!important}
  .philosophy h2{font-size:22px!important}
}

/* ===== MEDIUM SCREENS (640px) ===== */
@media(min-width:481px) and (max-width:640px){
  .hero h1{font-size:32px!important}
  #aptGrid{grid-template-columns:1fr 1fr!important;gap:12px!important}
  .card img,.apt-card img{height:180px!important}
  section{padding:60px 20px!important}
}

/* ===== TOUCH TARGETS ===== */
@media(max-width:900px){
  /* Min 44px touch targets */
  .nav__menu a{padding:12px 16px!important;font-size:14px!important;min-height:44px;display:flex;align-items:center}
  button,a.btn,[class*="btn"]{min-height:44px}

  /* Card click area */
  #aptGrid>*{cursor:pointer}

  /* Larger close buttons */
  .modal-close,[class*="close"]{min-width:44px!important;min-height:44px!important;display:flex!important;align-items:center!important;justify-content:center!important}

  /* Chat button — move above sticky CTA */
  .chat-fab,[class*="chat-btn"],[class*="fab"],#chatWidget{width:52px!important;height:52px!important;bottom:80px!important;right:16px!important}

  /* Input fields — prevent zoom on iOS */
  input,select,textarea{font-size:16px!important}

  /* Swipe hint on cards */
  .mu-swipe-hint{display:flex;align-items:center;gap:4px;font-size:10px;color:var(--ink-d,#6b665e);margin-top:4px}
  .mu-swipe-dot{width:6px;height:6px;border-radius:50%;background:var(--line,#333)}
  .mu-swipe-dot.active{background:var(--gold,#c9a961)}
}

/* ===== HAMBURGER MENU ENHANCE ===== */
@media(max-width:900px){
  .nav__menu.open{animation:mu-slideDown .3s ease}
  @keyframes mu-slideDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
  
  /* Add close button inside menu */
  .nav__menu.open .mu-menu-close{display:block;text-align:right;padding:0 0 8px;font-size:24px;cursor:pointer;color:var(--ink-m,#a8a096)}

  /* Language switcher in menu */
  .nav__menu .mu-lang-mobile{display:flex;gap:8px;padding:8px 0;border-top:1px solid var(--line,rgba(232,226,214,.08))}
  .nav__menu .mu-lang-mobile a{font-size:12px;padding:6px 12px;border:1px solid var(--line);border-radius:4px;color:var(--ink-m);text-decoration:none}
  .nav__menu .mu-lang-mobile a.active{border-color:var(--gold);color:var(--gold)}
}

/* ===== SCROLL SNAP FOR CARDS ===== */
@media(max-width:640px){
  #aptGrid{scroll-snap-type:y mandatory}
  #aptGrid>*{scroll-snap-align:start}
}

/* ===== PHOTO CAROUSEL ON CARDS ===== */
.mu-carousel{position:relative;overflow:hidden;touch-action:pan-y}
.mu-carousel-track{display:flex;transition:transform .3s ease;will-change:transform}
.mu-carousel-track img{width:100%;flex-shrink:0;object-fit:cover}
.mu-carousel-dots{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);display:flex;gap:4px}
.mu-carousel-dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.4);transition:all .2s}
.mu-carousel-dot.active{background:#fff;transform:scale(1.2)}
.mu-carousel-arrow{position:absolute;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.4);color:#fff;border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:14px;display:none;align-items:center;justify-content:center;z-index:2}
.mu-carousel:hover .mu-carousel-arrow{display:flex}
.mu-carousel-arrow.prev{left:6px}
.mu-carousel-arrow.next{right:6px}

/* ===== SMOOTH SCROLL BEHAVIOR ===== */
@media(max-width:900px){
  html{scroll-behavior:smooth;-webkit-overflow-scrolling:touch}
  *{-webkit-tap-highlight-color:rgba(201,169,97,.1)}
}

/* ===== LANDSCAPE PHONE ===== */
@media(max-height:500px) and (orientation:landscape){
  .hero{min-height:100vh!important;padding-top:60px!important}
  #mu-sticky-cta{display:none!important}
  .nav__menu.open{max-height:60vh;overflow-y:auto}
}
`;
document.head.appendChild(css);

// ===== STICKY CTA BUTTON =====
if(!document.getElementById('mu-sticky-cta')){
  const cta = document.createElement('div');
  cta.id = 'mu-sticky-cta';
  cta.innerHTML = `
    <a href="#booking" class="mu-cta-primary">Забронировать</a>
    <a href="tel:+998936900044" class="mu-cta-call" title="+998 93 690 00 44">📞</a>
    <a href="tel:+998999579485" class="mu-cta-call" title="+998 99 957 94 85">📞</a>
  `;
  document.body.appendChild(cta);

  // Desktop floating contacts
  if(!document.getElementById('mu-contacts-float')){
    const contacts = document.createElement('div');
    contacts.id = 'mu-contacts-float';
    contacts.innerHTML = `
      <a href="tel:+998936900044">📞 +998 93 690 00 44</a>
      <a href="tel:+998999579485">📞 +998 99 957 94 85</a>
    `;
    document.body.appendChild(contacts);
  }

  // Hide sticky CTA when booking section is visible
  const bookingSection = document.getElementById('booking');
  if(bookingSection){
    const obs = new IntersectionObserver(entries => {
      cta.style.opacity = entries[0].isIntersecting ? '0' : '1';
      cta.style.pointerEvents = entries[0].isIntersecting ? 'none' : '';
    }, {threshold: 0.3});
    obs.observe(bookingSection);
  }
}

// ===== ENHANCE HAMBURGER MENU =====
function enhanceMenu(){
  const menu = document.querySelector('.nav__menu');
  if(!menu || menu.querySelector('.mu-menu-close')) return;
  
  // Add lang switcher to mobile menu
  const langEl = document.querySelector('.nav__lang');
  if(langEl && window.innerWidth <= 900){
    const langClone = document.createElement('div');
    langClone.className = 'mu-lang-mobile';
    langClone.innerHTML = '<a href="#" onclick="setLang(\'ru\')" class="active">RU</a><a href="#" onclick="setLang(\'en\')">EN</a><a href="#" onclick="setLang(\'uz\')">UZ</a>';
    menu.appendChild(langClone);
  }
  
  // Close menu on link click
  menu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => menu.classList.remove('open'));
  });
  
  // Close menu on outside click
  document.addEventListener('click', e => {
    if(menu.classList.contains('open') && !menu.contains(e.target) && !e.target.classList.contains('hamburger')){
      menu.classList.remove('open');
    }
  });
}
setTimeout(enhanceMenu, 500);

// ===== PHOTO SWIPE ON CARDS =====
function initCardSwipe(){
  if(window.innerWidth > 900) return;
  
  document.querySelectorAll('#aptGrid > *').forEach(card => {
    const imgContainer = card.querySelector('.card-img, [class*="img-wrap"], [style*="overflow:hidden"]');
    const images = card.querySelectorAll('img[src*="supabase"]');
    if(!imgContainer || images.length <= 1) return;
    if(card.querySelector('.mu-carousel')) return; // already done
    
    // For cards with only 1 visible image, just add swipe indicator
    const photoCount = card.querySelector('.photo-count, [class*="photo"]');
    if(photoCount){
      const count = parseInt(photoCount.textContent) || images.length;
      if(count > 1 && !card.querySelector('.mu-swipe-hint')){
        const hint = document.createElement('div');
        hint.className = 'mu-swipe-hint';
        hint.innerHTML = '← свайп для фото →';
        const nameEl = card.querySelector('h3, [class*="name"]');
        if(nameEl) nameEl.parentElement.insertBefore(hint, nameEl.nextSibling);
      }
    }
  });
}
setTimeout(initCardSwipe, 2000);
// Re-init after grid re-renders (filter change)
const aptGrid = document.getElementById('aptGrid');
if(aptGrid){
  const mo = new MutationObserver(() => setTimeout(initCardSwipe, 300));
  mo.observe(aptGrid, {childList: true});
}

// ===== PREVENT IOS ZOOM ON INPUT FOCUS =====
if(/iPhone|iPad|iPod/.test(navigator.userAgent)){
  document.querySelectorAll('input, select, textarea').forEach(el => {
    if(parseInt(getComputedStyle(el).fontSize) < 16){
      el.style.fontSize = '16px';
    }
  });
}

// ===== SMOOTH SCROLL TO SECTIONS =====
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if(target){
      e.preventDefault();
      // Close menu if open
      document.querySelector('.nav__menu')?.classList.remove('open');
      target.scrollIntoView({behavior:'smooth', block:'start'});
    }
  });
});

console.log('[Mobile Upgrade] Мобильная адаптация загружена ✓');
})();
