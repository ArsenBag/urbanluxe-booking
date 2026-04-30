/* immersive-upgrade.js — Иммерсивный вау-эффект для Urban Luxe
   Добавить: <script src="/immersive-upgrade.js"></script> перед </body>
   
   Добавляет:
   - Parallax hero background
   - Smooth scroll-reveal анимации (fade-up, scale, slide)
   - 3D tilt эффект на карточках квартир
   - Sticky header с backdrop-blur
   - Animated counters (22, 4, 4.9)
   - Smooth page load animation
   - Enhanced hover effects
   - Scroll progress indicator
   - Cursor glow effect on hero
*/
(function(){
'use strict';

// ===== INJECT CSS =====
const css = document.createElement('style');
css.textContent = `
/* === PAGE LOAD === */
@keyframes iu-fadeUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
@keyframes iu-fadeIn{from{opacity:0}to{opacity:1}}
@keyframes iu-scaleIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
@keyframes iu-slideL{from{opacity:0;transform:translateX(-60px)}to{opacity:1;transform:translateX(0)}}
@keyframes iu-slideR{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:translateX(0)}}
@keyframes iu-blur{from{opacity:0;filter:blur(12px)}to{opacity:1;filter:blur(0)}}

/* Reveal classes */
.iu-hidden{opacity:0;transform:translateY(40px);transition:opacity .8s cubic-bezier(.16,1,.3,1),transform .8s cubic-bezier(.16,1,.3,1),filter .8s ease}
.iu-hidden.iu-scale{transform:scale(.92)}
.iu-hidden.iu-slide-l{transform:translateX(-60px)}
.iu-hidden.iu-slide-r{transform:translateX(60px)}
.iu-hidden.iu-blur{filter:blur(10px);transform:translateY(20px)}
.iu-visible{opacity:1!important;transform:translateY(0) scale(1) translateX(0)!important;filter:blur(0)!important}

/* Stagger delays */
.iu-d1{transition-delay:.1s!important}.iu-d2{transition-delay:.2s!important}.iu-d3{transition-delay:.3s!important}
.iu-d4{transition-delay:.4s!important}.iu-d5{transition-delay:.5s!important}.iu-d6{transition-delay:.6s!important}

/* === STICKY HEADER === */
.nav.iu-scrolled{background:rgba(10,10,10,.85)!important;backdrop-filter:blur(20px) saturate(1.5)!important;-webkit-backdrop-filter:blur(20px) saturate(1.5)!important;border-bottom:1px solid rgba(201,169,97,.12)!important;box-shadow:0 4px 30px rgba(0,0,0,.3)!important;transition:all .4s cubic-bezier(.16,1,.3,1)!important}

/* === SCROLL PROGRESS === */
#iu-progress{position:fixed;top:0;left:0;height:2px;background:linear-gradient(90deg,#c9a961,#e8d5a3);z-index:10000;transition:width .1s linear;pointer-events:none}

/* === PARALLAX HERO === */
.hero__bg{transition:transform .1s linear!important;will-change:transform}

/* === 3D TILT CARDS === */
#aptGrid>*{transition:transform .4s cubic-bezier(.16,1,.3,1),box-shadow .4s ease!important;transform-style:preserve-3d;perspective:800px}
#aptGrid>*:hover{box-shadow:0 20px 60px rgba(0,0,0,.4),0 0 0 1px rgba(201,169,97,.15)!important}
#aptGrid>* img{transition:transform .6s cubic-bezier(.16,1,.3,1),filter .4s ease!important}
#aptGrid>*:hover img{transform:scale(1.05)!important;filter:brightness(1.08)!important}

/* Card photo count badge glow */
#aptGrid .photo-count{transition:all .3s ease!important}
#aptGrid>*:hover .photo-count{background:rgba(201,169,97,.9)!important;box-shadow:0 0 15px rgba(201,169,97,.4)!important}

/* === HERO GLOW CURSOR === */
#iu-glow{position:fixed;width:400px;height:400px;border-radius:50%;pointer-events:none;z-index:1;background:radial-gradient(circle,rgba(201,169,97,.06) 0%,transparent 70%);transform:translate(-50%,-50%);transition:opacity .3s;opacity:0;mix-blend-mode:screen}
.hero:hover~#iu-glow,.hero #iu-glow{opacity:1}

/* === COUNTER ANIMATION === */
.iu-counter{display:inline-block;min-width:1.2em;transition:opacity .3s}

/* === ENHANCED BUTTONS === */
.hero__cta,.btn-gold,a[href="#booking"]{position:relative!important;overflow:hidden!important}
.hero__cta::after,.btn-gold::after{content:'';position:absolute;top:-50%;left:-50%;width:200%;height:200%;background:linear-gradient(45deg,transparent 40%,rgba(255,255,255,.1) 50%,transparent 60%);transform:translateX(-100%);transition:none}
.hero__cta:hover::after,.btn-gold:hover::after{animation:iu-shine .6s ease forwards}
@keyframes iu-shine{to{transform:translateX(100%)}}

/* === SECTION DIVIDERS === */
.sh__label{position:relative}
.sh__label::before{content:'';position:absolute;left:0;top:50%;width:30px;height:1px;background:var(--gold,#c9a961);transform:translateX(-40px);opacity:0;transition:all .6s .2s}
.iu-visible .sh__label::before,.visible .sh__label::before{opacity:1;transform:translateX(-40px)}

/* === REVIEWS CAROUSEL ENHANCE === */
.review{transition:transform .5s cubic-bezier(.16,1,.3,1),opacity .5s ease!important}
.review:hover{transform:translateY(-4px)!important}

/* === STEPS ENHANCE === */
.step{transition:all .5s cubic-bezier(.16,1,.3,1)!important}
.step:hover{transform:translateY(-6px)!important;border-color:rgba(201,169,97,.3)!important}
.step .step-num{transition:all .4s ease!important}
.step:hover .step-num{transform:scale(1.15)!important;color:var(--gold,#c9a961)!important}

/* === FOOTER ENHANCE === */
footer a{transition:color .3s,transform .3s!important;display:inline-block!important}
footer a:hover{color:var(--gold,#c9a961)!important;transform:translateX(4px)!important}

/* === SMOOTH SCROLL === */
html{scroll-behavior:smooth!important}

/* === LOADING SCREEN === */
#iu-loader{position:fixed;inset:0;background:#0a0a0a;z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;transition:opacity .6s,visibility .6s}
#iu-loader.done{opacity:0;visibility:hidden;pointer-events:none}
#iu-loader .iu-logo{font-family:'Cormorant Garamond',serif;font-size:28px;letter-spacing:.2em;color:#c9a961;animation:iu-fadeIn .8s ease}
#iu-loader .iu-bar{width:120px;height:2px;background:rgba(201,169,97,.15);border-radius:2px;overflow:hidden}
#iu-loader .iu-bar span{display:block;height:100%;width:0;background:#c9a961;animation:iu-loading 1.2s ease forwards}
@keyframes iu-loading{to{width:100%}}

/* === MOBILE RESPONSIVE === */
@media(max-width:768px){
  #iu-glow{display:none}
  .iu-hidden{transform:translateY(24px)!important}
  #aptGrid>*:hover{transform:none!important}
}

/* === REDUCED MOTION === */
@media(prefers-reduced-motion:reduce){
  .iu-hidden{transition:opacity .3s!important;transform:none!important;filter:none!important}
  .hero__bg{transition:none!important}
  #iu-loader{display:none}
}
`;
document.head.appendChild(css);

// ===== LOADING SCREEN =====
const loader = document.createElement('div');
loader.id = 'iu-loader';
loader.innerHTML = '<div class="iu-logo">URBAN LUXE</div><div class="iu-bar"><span></span></div>';
document.body.prepend(loader);
window.addEventListener('load', () => setTimeout(() => loader.classList.add('done'), 800));
// Fallback: remove after 3s regardless
setTimeout(() => loader.classList.add('done'), 3000);

// ===== SCROLL PROGRESS BAR =====
const progress = document.createElement('div');
progress.id = 'iu-progress';
document.body.appendChild(progress);

// ===== CURSOR GLOW =====
const glow = document.createElement('div');
glow.id = 'iu-glow';
document.body.appendChild(glow);

const heroEl = document.querySelector('.hero');
if(heroEl) {
  heroEl.addEventListener('mousemove', e => {
    glow.style.left = e.clientX + 'px';
    glow.style.top = e.clientY + 'px';
    glow.style.opacity = '1';
  });
  heroEl.addEventListener('mouseleave', () => { glow.style.opacity = '0'; });
}

// ===== SCROLL HANDLER =====
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const scrollY = window.scrollY;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    
    // Progress bar
    progress.style.width = (scrollY / docH * 100) + '%';
    
    // Sticky header
    const nav = document.querySelector('.nav, #navbar');
    if (nav) {
      if (scrollY > 80) nav.classList.add('iu-scrolled');
      else nav.classList.remove('iu-scrolled');
    }
    
    // Parallax hero
    const heroBg = document.querySelector('.hero__bg');
    if (heroBg && scrollY < window.innerHeight) {
      heroBg.style.transform = `translateY(${scrollY * 0.3}px) scale(1.1)`;
    }
    
    ticking = false;
  });
}
window.addEventListener('scroll', onScroll, {passive: true});

// ===== INTERSECTION OBSERVER (REVEAL) =====
function setupReveal() {
  // Assign reveal classes to elements
  const selectors = [
    {sel: '.sh__left', cls: 'iu-slide-l'},
    {sel: '.sh__right', cls: 'iu-slide-r'},
    {sel: '.philosophy__text', cls: 'iu-slide-l'},
    {sel: '.philosophy__img', cls: 'iu-slide-r'},
    {sel: '#aptGrid > *', cls: 'iu-scale'},
    {sel: '.amenity, .amenity-item, #amenities .grid > *', cls: 'iu-blur'},
    {sel: '.step', cls: ''},
    {sel: '.review', cls: ''},
    {sel: '.booking-section .reveal, .booking-grid > *', cls: ''},
    {sel: 'footer > *', cls: ''},
    {sel: '.hero__content > *', cls: ''},
  ];

  const staggerGroups = new Map();
  
  selectors.forEach(({sel, cls}) => {
    document.querySelectorAll(sel).forEach((el, i) => {
      // Don't re-add if already has reveal
      if (el.classList.contains('iu-hidden') || el.classList.contains('iu-visible')) return;
      el.classList.add('iu-hidden');
      if (cls) el.classList.add(cls);
      
      // Stagger children of same parent
      const parent = el.parentElement;
      if (!staggerGroups.has(parent)) staggerGroups.set(parent, 0);
      const idx = staggerGroups.get(parent);
      if (idx < 6) el.classList.add('iu-d' + (idx + 1));
      staggerGroups.set(parent, idx + 1);
    });
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('iu-visible');
        // Don't unobserve - keep for scroll up/down effect
      }
    });
  }, {threshold: 0.1, rootMargin: '0px 0px -60px 0px'});

  document.querySelectorAll('.iu-hidden').forEach(el => observer.observe(el));
}

// Run after a short delay to let page render
setTimeout(setupReveal, 200);

// ===== 3D TILT ON CARDS =====
function setupTilt() {
  document.querySelectorAll('#aptGrid > *').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateZ(10px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}
setTimeout(setupTilt, 500);

// Re-setup tilt after apt grid re-renders
const aptGrid = document.getElementById('aptGrid');
if (aptGrid) {
  const mo = new MutationObserver(() => setTimeout(setupTilt, 100));
  mo.observe(aptGrid, {childList: true});
}

// ===== ANIMATED COUNTERS =====
function animateCounters() {
  // Find counter elements in hero stats
  const statEls = document.querySelectorAll('.hero__stat-num, .stat-num, [class*="stat"] strong, [class*="stat"] span:first-child');
  
  statEls.forEach(el => {
    const text = el.textContent.trim();
    const num = parseFloat(text);
    if (isNaN(num)) return;
    
    const isDecimal = text.includes('.');
    const target = num;
    const duration = 1500;
    const start = performance.now();
    el.classList.add('iu-counter');
    
    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = target * ease;
      el.textContent = isDecimal ? current.toFixed(1) : Math.round(current);
      if (progress < 1) requestAnimationFrame(tick);
    }
    
    // Only animate when visible
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        requestAnimationFrame(tick);
        obs.disconnect();
      }
    }, {threshold: 0.5});
    obs.observe(el);
  });
}
setTimeout(animateCounters, 300);

// ===== SMOOTH ANCHOR SCROLL =====
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({behavior: 'smooth', block: 'start'});
    }
  });
});

// ===== HERO PARALLAX INITIAL STATE =====
const heroBg = document.querySelector('.hero__bg');
if (heroBg) {
  heroBg.style.transform = 'scale(1.1)';
  heroBg.style.willChange = 'transform';
}

// ===== IMAGE LAZY LOAD WITH BLUR-UP =====
document.querySelectorAll('#aptGrid img[loading="lazy"]').forEach(img => {
  if (img.complete) return;
  img.style.filter = 'blur(8px)';
  img.style.transition = 'filter .5s ease';
  img.addEventListener('load', () => {
    img.style.filter = '';
  }, {once: true});
});

// ===== KEYBOARD NAV ENHANCEMENT =====
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    // Close any open modals
    const overlay = document.getElementById('modalOverlay');
    if (overlay && overlay.style.display !== 'none') {
      if (typeof closeModal === 'function') closeModal();
    }
  }
});

console.log('[Immersive Upgrade] Вау-эффекты загружены ✓');
})();
