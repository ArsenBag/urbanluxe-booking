/**
 * Urban Luxe — Dynamic Apartments Loader
 * Replaces hardcoded apartment cards with data from Supabase
 * Adds modal with photo gallery, description, amenities
 */

(function() {
  const SB_URL = 'https://sebvfvtofiysbywxjqut.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI';

  const AMENITY_LABELS = {
    wifi: '📶 Wi-Fi',
    ac: '❄️ Кондиционер',
    kitchen: '🍳 Кухня',
    washer: '🧺 Стир. машина',
    tv: '📺 Smart TV',
    parking: '🅿️ Парковка',
    balcony: '🌇 Балкон',
    view: '🏙️ Панорамный вид',
    gym: '🏋️ Спортзал',
    pool: '🏊 Бассейн',
    iron: '👔 Утюг',
    hairdryer: '💇 Фен'
  };

  // Inject modal CSS
  const style = document.createElement('style');
  style.textContent = `
    .apt-modal-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.85);z-index:1000;align-items:center;justify-content:center;padding:20px}
    .apt-modal-overlay.show{display:flex}
    .apt-modal{background:#0C0B0A;border:1px solid rgba(232,226,214,.12);max-width:900px;width:100%;max-height:90vh;overflow-y:auto;position:relative}
    .apt-modal-close{position:absolute;top:16px;right:16px;background:none;border:none;color:#a8a096;font-size:28px;cursor:pointer;z-index:10;width:40px;height:40px;display:flex;align-items:center;justify-content:center}
    .apt-modal-close:hover{color:#e8e2d6}
    .apt-modal-gallery{position:relative;width:100%;height:400px;overflow:hidden;background:#0a0a0a}
    .apt-modal-gallery img{width:100%;height:100%;object-fit:cover;display:none}
    .apt-modal-gallery img.active{display:block}
    .apt-modal-gallery-nav{position:absolute;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.6);color:#fff;border:none;font-size:24px;cursor:pointer;padding:12px 16px;z-index:5}
    .apt-modal-gallery-nav.prev{left:0;border-radius:0 4px 4px 0}
    .apt-modal-gallery-nav.next{right:0;border-radius:4px 0 0 4px}
    .apt-modal-gallery-dots{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:5}
    .apt-modal-gallery-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.4);cursor:pointer;border:none}
    .apt-modal-gallery-dot.active{background:#c9a961}
    .apt-modal-body{padding:32px}
    .apt-modal-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
    .apt-modal-title{font-size:28px;font-weight:300;font-family:'Cormorant Garamond',serif}
    .apt-modal-subtitle{color:#a8a096;font-size:14px;margin-top:4px}
    .apt-modal-price{text-align:right}
    .apt-modal-price .price{font-size:28px;color:#c9a961;font-weight:300}
    .apt-modal-price .price span{font-size:14px;color:#6b665e}
    .apt-modal-price .weekend{font-size:12px;color:#6b665e;margin-top:4px}
    .apt-modal-desc{color:#a8a096;line-height:1.7;margin-bottom:24px;font-size:15px}
    .apt-modal-amenities{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px}
    .apt-modal-amenity{background:rgba(201,169,97,.08);border:1px solid rgba(201,169,97,.15);padding:8px 14px;font-size:13px;color:#e8e2d6;border-radius:4px}
    .apt-modal-details{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:24px}
    .apt-modal-detail{text-align:center;padding:16px;background:rgba(232,226,214,.04);border:1px solid rgba(232,226,214,.08)}
    .apt-modal-detail .val{font-size:20px;color:#c9a961;font-weight:300}
    .apt-modal-detail .lab{font-size:11px;color:#6b665e;text-transform:uppercase;letter-spacing:.1em;margin-top:4px}
    .apt-modal-cta{display:flex;gap:12px}
    .apt-modal-cta .btn-book{flex:1;padding:16px;background:#c9a961;color:#0a0a0a;border:none;font-size:13px;letter-spacing:.15em;text-transform:uppercase;cursor:pointer;font-weight:600;font-family:inherit}
    .apt-modal-cta .btn-book:hover{background:#a88947}
    .apt-modal-video{margin-bottom:24px}
    .apt-modal-video iframe{width:100%;height:300px;border:none}
    @media(max-width:768px){
      .apt-modal-gallery{height:250px}
      .apt-modal-body{padding:20px}
      .apt-modal-details{grid-template-columns:1fr 1fr}
      .apt-modal-title{font-size:22px}
    }
  `;
  document.head.appendChild(style);

  // Create modal HTML
  const modalEl = document.createElement('div');
  modalEl.className = 'apt-modal-overlay';
  modalEl.id = 'aptDetailModal';
  modalEl.innerHTML = `
    <div class="apt-modal">
      <button class="apt-modal-close" onclick="closeAptModal()">&times;</button>
      <div class="apt-modal-gallery" id="aptModalGallery"></div>
      <div class="apt-modal-body">
        <div class="apt-modal-header">
          <div>
            <div class="apt-modal-title" id="aptModalTitle"></div>
            <div class="apt-modal-subtitle" id="aptModalSubtitle"></div>
          </div>
          <div class="apt-modal-price">
            <div class="price" id="aptModalPrice"></div>
            <div class="weekend" id="aptModalWeekend"></div>
          </div>
        </div>
        <div class="apt-modal-desc" id="aptModalDesc"></div>
        <div class="apt-modal-amenities" id="aptModalAmenities"></div>
        <div class="apt-modal-video" id="aptModalVideo" style="display:none"></div>
        <div class="apt-modal-details" id="aptModalDetails"></div>
        <div class="apt-modal-cta">
          <button class="btn-book" id="aptModalBookBtn" onclick="bookFromModal()">Забронировать</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modalEl);

  // Close modal on overlay click
  modalEl.addEventListener('click', function(e) {
    if (e.target === modalEl) closeAptModal();
  });

  let apartments = [];
  let currentModalApt = null;
  let currentGalleryIndex = 0;

  // Fetch apartments from Supabase
  async function loadApartments() {
    try {
      const res = await fetch(SB_URL + '/rest/v1/apartments?is_active=eq.true&select=*&order=complex', {
        headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY }
      });
      if (!res.ok) return;
      apartments = await res.json();
      if (apartments.length > 0) {
        renderCards();
      }
    } catch (e) {
      console.warn('Failed to load apartments from Supabase:', e);
    }
  }

  function getPhotos(apt) {
    let photos = [];
    if (apt.photo_url) {
      try {
        const parsed = JSON.parse(apt.photo_url);
        if (Array.isArray(parsed)) photos = parsed;
        else photos = [apt.photo_url];
      } catch (e) {
        photos = [apt.photo_url];
      }
    }
    return photos.filter(p => p && p.trim());
  }

  function getComplexFilter(complex) {
    const c = complex.toLowerCase();
    if (c.includes('nest')) return 'nest';
    if (c.includes('u-tower') || c.includes('utower')) return 'utower';
    if (c.includes('mirabad')) return 'mirabad';
    if (c.includes('kislorod')) return 'kislorod';
    return c;
  }

  function renderCards() {
    const grid = document.getElementById('aptGrid');
    if (!grid) return;

    grid.innerHTML = apartments.map(apt => {
      const photos = getPhotos(apt);
      const mainPhoto = photos[0] || '';
      const complexFilter = getComplexFilter(apt.complex);
      const imgTag = mainPhoto
        ? `<img src="${mainPhoto}" alt="${apt.name}" loading="lazy">`
        : `<div style="width:100%;height:100%;background:#1a1816;display:flex;align-items:center;justify-content:center;color:#6b665e;font-size:14px">Нет фото</div>`;
      const hasDesc = apt.description && apt.description.length > 5;
      const amenCount = apt.amenities ? apt.amenities.length : 0;

      return `<article class="card" data-complex="${complexFilter}" onclick="openAptModal('${apt.id}')" style="cursor:pointer">
        <div class="card__img">${imgTag}<div class="card__badge">${apt.complex} · Этаж ${apt.floor}</div></div>
        <div class="card__info">
          <h3 class="card__title">${apt.name}</h3>
          <p class="card__sub">${apt.style || apt.rooms || ''}</p>
          <div class="card__foot">
            <div class="card__price">$${apt.weekday_price} <span>/ ночь</span></div>
          </div>
        </div>
      </article>`;
    }).join('');
  }

  // Modal functions
  window.openAptModal = function(aptId) {
    const apt = apartments.find(a => a.id === aptId);
    if (!apt) return;
    currentModalApt = apt;
    currentGalleryIndex = 0;

    const photos = getPhotos(apt);

    // Gallery
    const gallery = document.getElementById('aptModalGallery');
    if (photos.length > 0) {
      gallery.innerHTML = photos.map((p, i) =>
        `<img src="${p}" alt="${apt.name}" class="${i === 0 ? 'active' : ''}">`
      ).join('') +
        (photos.length > 1 ? `
          <button class="apt-modal-gallery-nav prev" onclick="galleryNav(-1)">‹</button>
          <button class="apt-modal-gallery-nav next" onclick="galleryNav(1)">›</button>
          <div class="apt-modal-gallery-dots">${photos.map((_, i) =>
            `<button class="apt-modal-gallery-dot${i === 0 ? ' active' : ''}" onclick="galleryGo(${i})"></button>`
          ).join('')}</div>
        ` : '');
    } else {
      gallery.innerHTML = '<div style="width:100%;height:100%;background:#1a1816;display:flex;align-items:center;justify-content:center;color:#6b665e;font-size:18px">Фото не добавлены</div>';
    }

    // Title & Price
    document.getElementById('aptModalTitle').textContent = apt.name;
    document.getElementById('aptModalSubtitle').textContent = `${apt.complex} · Этаж ${apt.floor} · ${apt.rooms || 'Студия'}`;
    document.getElementById('aptModalPrice').innerHTML = `$${apt.weekday_price} <span>/ ночь</span>`;
    document.getElementById('aptModalWeekend').textContent = `Пт-Вс: $${apt.weekend_price} / ночь`;

    // Description
    let desc = apt.description || '';
    let videoUrl = '';
    const vidMatch = desc.match(/\[VIDEO:(.*?)\]/);
    if (vidMatch) { videoUrl = vidMatch[1]; desc = desc.replace(/\n?\[VIDEO:.*?\]/, ''); }
    document.getElementById('aptModalDesc').textContent = desc || 'Описание будет добавлено позже.';

    // Video
    const videoEl = document.getElementById('aptModalVideo');
    if (videoUrl) {
      const ytId = videoUrl.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
      if (ytId) {
        videoEl.innerHTML = `<iframe src="https://www.youtube.com/embed/${ytId[1]}" allowfullscreen></iframe>`;
        videoEl.style.display = 'block';
      }
    } else {
      videoEl.style.display = 'none';
    }

    // Amenities
    const amenities = apt.amenities || [];
    document.getElementById('aptModalAmenities').innerHTML = amenities.length > 0
      ? amenities.map(a => `<div class="apt-modal-amenity">${AMENITY_LABELS[a] || a}</div>`).join('')
      : '<div style="color:#6b665e;font-size:13px">Удобства не указаны</div>';

    // Details
    document.getElementById('aptModalDetails').innerHTML = `
      <div class="apt-modal-detail"><div class="val">${apt.max_guests || 3}</div><div class="lab">Макс. гостей</div></div>
      <div class="apt-modal-detail"><div class="val">${apt.floor}</div><div class="lab">Этаж</div></div>
      <div class="apt-modal-detail"><div class="val">${apt.rooms || 'Студия'}</div><div class="lab">Тип</div></div>
    `;

    // Book button
    document.getElementById('aptModalBookBtn').onclick = function() {
      closeAptModal();
      // Scroll to booking section and pre-select apartment
      const bookingSection = document.getElementById('booking');
      if (bookingSection) bookingSection.scrollIntoView({ behavior: 'smooth' });
      if (typeof selectForBooking === 'function') {
        setTimeout(() => selectForBooking(apt.id, apt.name, apt.complex), 500);
      }
    };

    document.getElementById('aptDetailModal').classList.add('show');
    document.body.style.overflow = 'hidden';
  };

  window.closeAptModal = function() {
    document.getElementById('aptDetailModal').classList.remove('show');
    document.body.style.overflow = '';
  };

  window.galleryNav = function(dir) {
    const photos = getPhotos(currentModalApt);
    currentGalleryIndex = (currentGalleryIndex + dir + photos.length) % photos.length;
    updateGallery();
  };

  window.galleryGo = function(idx) {
    currentGalleryIndex = idx;
    updateGallery();
  };

  function updateGallery() {
    const gallery = document.getElementById('aptModalGallery');
    gallery.querySelectorAll('img').forEach((img, i) => {
      img.classList.toggle('active', i === currentGalleryIndex);
    });
    gallery.querySelectorAll('.apt-modal-gallery-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === currentGalleryIndex);
    });
  }

  // Keyboard navigation
  document.addEventListener('keydown', function(e) {
    if (!document.getElementById('aptDetailModal').classList.contains('show')) return;
    if (e.key === 'Escape') closeAptModal();
    if (e.key === 'ArrowLeft') galleryNav(-1);
    if (e.key === 'ArrowRight') galleryNav(1);
  });

  // Load apartments when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadApartments);
  } else {
    loadApartments();
  }
})();
