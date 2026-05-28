/* Urban Luxe — кнопка «Поделиться» в модалке апартамента.
   Ставит круглую кнопку слева от крестика (.modal-close).
   Mobile: системное меню «Поделиться» (Web Share API).
   Desktop: копирование ссылки в буфер + тост.
   Ссылка: https://urbanluxe.cc/.netlify/functions/share?apt={id} (серверный OG). */
(function () {
  'use strict';
  if (window.__ulShareInit) return;
  window.__ulShareInit = true;

  var currentApt = null;

  // Запоминаем id из вызовов openModal(id) — самый надёжный источник
  function hookOpenModal() {
    if (typeof window.openModal === 'function' && !window.openModal.__shareHooked) {
      var orig = window.openModal;
      window.openModal = function (id) {
        try {
          if (typeof id === 'string' && /^(kislorod|mirabad|nest|utower)/.test(id)) currentApt = id;
        } catch (e) {}
        return orig.apply(this, arguments);
      };
      window.openModal.__shareHooked = true;
      return true;
    }
    return false;
  }
  hookOpenModal();
  var tries = 0;
  var hookTimer = setInterval(function () {
    if (hookOpenModal() || ++tries > 40) clearInterval(hookTimer);
  }, 250);

  // Фолбэки на случай, если хук не успел: путь картинки apartments/{id}/, затем URL
  function getAptId() {
    if (currentApt) return currentApt;
    var img = document.querySelector('#modalContent img, .modal img');
    if (img && img.src) {
      var m = img.src.match(/\/apartments\/([^\/]+)\//);
      if (m && m[1] && m[1] !== 'hero') return m[1];
    }
    return new URLSearchParams(location.search).get('apt') || null;
  }

  function toast(msg) {
    var d = document.createElement('div');
    d.textContent = msg;
    d.style.cssText = 'position:fixed;left:50%;bottom:32px;transform:translateX(-50%);background:#1e293b;color:#fff;padding:12px 20px;border-radius:10px;font-size:14px;font-family:inherit;z-index:100000;box-shadow:0 8px 24px rgba(0,0,0,.25);opacity:0;transition:opacity .2s';
    document.body.appendChild(d);
    requestAnimationFrame(function () { d.style.opacity = '1'; });
    setTimeout(function () { d.style.opacity = '0'; setTimeout(function () { d.remove(); }, 250); }, 1900);
  }

  function fallbackCopy(url) {
    try {
      var ta = document.createElement('textarea');
      ta.value = url;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast('Ссылка скопирована');
    } catch (e) {
      toast('Скопируйте ссылку: ' + url);
    }
  }

  function onShare(e) {
    e.preventDefault();
    e.stopPropagation();
    var id = getAptId();
    if (!id) { toast('Не удалось определить апартамент'); return; }
    var url = 'https://urbanluxe.cc/.netlify/functions/share?apt=' + encodeURIComponent(id);
    var title = ((document.querySelector('.modal-title') || {}).textContent || 'Urban Luxe').trim();
    if (navigator.share) {
      navigator.share({ title: title, url: url }).catch(function () {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { toast('Ссылка скопирована'); }, function () { fallbackCopy(url); });
    } else {
      fallbackCopy(url);
    }
  }

  function makeBtn() {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ul-share-btn';
    b.setAttribute('aria-label', 'Поделиться');
    b.title = 'Поделиться';
    b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>';
    b.style.cssText = 'position:absolute;top:18px;right:66px;width:40px;height:40px;border:none;border-radius:50%;background:rgba(0,0,0,.5);color:rgb(237,232,223);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:10;padding:0;transition:background .2s';
    b.onmouseenter = function () { b.style.background = 'rgba(0,0,0,.72)'; };
    b.onmouseleave = function () { b.style.background = 'rgba(0,0,0,.5)'; };
    b.addEventListener('click', onShare);
    return b;
  }

  // Следим за открытием модалки и добавляем кнопку рядом с крестиком
  function ensureBtn() {
    var close = document.querySelector('#modalContent .modal-close');
    if (!close) return;
    var parent = close.parentElement;
    if (parent.querySelector('.ul-share-btn')) return;
    parent.insertBefore(makeBtn(), close);
  }
  setInterval(ensureBtn, 300);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureBtn);
  } else {
    ensureBtn();
  }
})();
