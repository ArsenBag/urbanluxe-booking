/* immersive-upgrade.js — Лёгкие эффекты для Urban Luxe (v2 — performance optimized)
   Убраны: 3D tilt, cursor glow, parallax, blur-up (все тяжёлые GPU операции)
   Оставлены: scroll-reveal, sticky header, scroll progress, smooth load */
(function(){
'use strict';

const css = document.createElement('style');
css.textContent = `
@keyframes iu-fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
.iu-hidden{opacity:0;transform:translateY(30px);transition:opacity .6s ease,transform .6s ease}
.iu-visible{opacity:1!important;transform:none!important}
.iu-d1{transition-delay:.05s!important}.iu-d2{transition-delay:.1s!important}.iu-d3{transition-delay:.15s!important}
.iu-d4{transition-delay:.2s!important}.iu-d5{transition-delay:.25s!important}.iu-d6{transition-delay:.3s!important}
.nav.iu-scrolled{background:rgba(10,10,10,.92)!important;backdrop-filter:blur(16px)!important;-webkit-backdrop-filter:blur(16px)!important;border-bottom:1px solid rgba(201,169,97,.12)!important;box-shadow:0 2px 20px rgba(0,0,0,.3)!important;transition:all .3s ease!important}
#iu-progress{position:fixed;top:0;left:0;height:2px;background:linear-gradient(90deg,#c9a961,#e8d5a3);z-index:10000;pointer-events:none}
#aptGrid>*{transition:transform .3s ease,box-shadow .3s ease!important}
#aptGrid>*:hover{transform:translateY(-4px)!important;box-shadow:0 12px 40px rgba(0,0,0,.3)!important}
#aptGrid>* img{transition:transform .4s ease!important}
#aptGrid>*:hover img{transform:scale(1.03)!important}
.step{transition:transform .3s ease!important}.step:hover{transform:translateY(-4px)!important}
.review{transition:transform .3s ease!important}.review:hover{transform:translateY(-3px)!important}
footer a{transition:color .3s!important}footer a:hover{color:var(--gold,#c9a961)!important}
html{scroll-behavior:smooth!important}
@media(prefers-reduced-motion:reduce){.iu-hidden{transition:none!important;transform:none!important;opacity:1!important}}
`;
document.head.appendChild(css);

// Scroll progress + sticky header (throttled)
const progress = document.createElement('div');
progress.id = 'iu-progress';
document.body.appendChild(progress);

let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const scrollY = window.scrollY;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = (scrollY / docH * 100) + '%';
    const nav = document.querySelector('.nav');
    if (nav) nav.classList.toggle('iu-scrolled', scrollY > 80);
    ticking = false;
  });
}, {passive: true});

// Reveal on scroll (lightweight IntersectionObserver)
function setupReveal() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('iu-visible');
      }
    });
  }, {threshold: 0.08, rootMargin: '0px 0px -40px 0px'});

  const targets = document.querySelectorAll('section:not(.hero) > *, .card, .step, .review, .amenity, .amenity-item, .sh, .philosophy__text, .philosophy__img, footer > *');
  targets.forEach((el, i) => {
    if (el.classList.contains('iu-visible') || el.closest('.hero')) return;
    el.classList.add('iu-hidden');
    const parent = el.parentElement;
    const siblings = [...parent.children];
    const idx = siblings.indexOf(el);
    if (idx < 6) el.classList.add('iu-d' + (idx + 1));
    observer.observe(el);
  });
}
setTimeout(setupReveal, 100);

// Smooth anchor scroll
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({behavior: 'smooth', block: 'start'}); }
  });
});

// Escape to close modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && typeof closeModal === 'function') closeModal();
});

console.log('[Immersive v2] Лёгкие эффекты загружены ✓');
})();
