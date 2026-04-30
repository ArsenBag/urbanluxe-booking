/* seo-map-upgrade.js — SEO structured data + интерактивная карта комплексов
   Подключение: <script src="/seo-map-upgrade.js"></script> перед </body> в index.html */
(function(){
'use strict';

// ===== 1. SEO: Structured Data (schema.org) =====
// Main business schema
const structuredData = {
  "@context": "https://schema.org",
  "@type": "LodgingBusiness",
  "name": "Urban Luxe — Премиальные апартаменты в Ташкенте",
  "alternateName": "Urban Luxe Tashkent",
  "description": "Посуточная аренда 22 премиальных апартаментов в лучших комплексах Ташкента: Nest One, U-Tower NRG, Mirabad Avenue, Kislorod. Студии и квартиры с полной кухней, Wi-Fi, кондиционером. Заезд 24/7, консьерж-сервис. Идеально для командировок, туризма и релокации.",
  "url": "https://urbanluxe.cc",
  "logo": "https://urbanluxe.cc/logo.png",
  "image": [
    "https://sebvfvtofiysbywxjqut.supabase.co/storage/v1/object/public/apartments/hero/IMG_6080.jpg"
  ],
  "telephone": ["+998936900044", "+998999579485"],
  "email": "noreply@urbanluxe.cc",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Tashkent City, Батыра Закирова 1А",
    "addressLocality": "Ташкент",
    "addressRegion": "Ташкентская область",
    "postalCode": "100000",
    "addressCountry": "UZ"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 41.311,
    "longitude": 69.279
  },
  "hasMap": "https://yandex.com/maps/-/CHuAFTEI",
  "priceRange": "$85 - $125",
  "currenciesAccepted": "USD, UZS, EUR",
  "paymentAccepted": "Cash, Credit Card, Bank Transfer",
  "numberOfRooms": 22,
  "starRating": { "@type": "Rating", "ratingValue": "4.9" },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.9",
    "reviewCount": "350",
    "bestRating": "5"
  },
  "amenityFeature": [
    {"@type": "LocationFeatureSpecification", "name": "Бесплатный WiFi", "value": true},
    {"@type": "LocationFeatureSpecification", "name": "Полностью оборудованная кухня", "value": true},
    {"@type": "LocationFeatureSpecification", "name": "Кондиционер", "value": true},
    {"@type": "LocationFeatureSpecification", "name": "Стиральная машина", "value": true},
    {"@type": "LocationFeatureSpecification", "name": "Бесплатная парковка", "value": true},
    {"@type": "LocationFeatureSpecification", "name": "Консьерж 24/7", "value": true},
    {"@type": "LocationFeatureSpecification", "name": "Смарт ТВ", "value": true},
    {"@type": "LocationFeatureSpecification", "name": "Сейф", "value": true},
    {"@type": "LocationFeatureSpecification", "name": "Утюг и гладильная доска", "value": true},
    {"@type": "LocationFeatureSpecification", "name": "Фен", "value": true},
    {"@type": "LocationFeatureSpecification", "name": "Постельное бельё и полотенца", "value": true},
    {"@type": "LocationFeatureSpecification", "name": "Уборка", "value": true}
  ],
  "checkinTime": "14:00",
  "checkoutTime": "12:00",
  "availableLanguage": [
    {"@type": "Language", "name": "Russian"},
    {"@type": "Language", "name": "English"},
    {"@type": "Language", "name": "Uzbek"}
  ],
  "sameAs": ["https://www.instagram.com/urbanluxe.uz"],
  "potentialAction": {
    "@type": "ReserveAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://urbanluxe.cc/#booking"
    },
    "result": {
      "@type": "LodgingReservation",
      "name": "Бронирование апартаментов Urban Luxe"
    }
  }
};

// FAQ schema — повышает видимость в Google
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Сколько стоит посуточная аренда квартиры в Ташкенте?",
      "acceptedAnswer": {"@type": "Answer", "text": "Стоимость посуточной аренды апартаментов Urban Luxe в Ташкенте от $85 до $125 за ночь в зависимости от комплекса и типа квартиры. В стоимость включены Wi-Fi, уборка, постельное бельё."}
    },
    {
      "@type": "Question",
      "name": "Какие комплексы доступны для аренды?",
      "acceptedAnswer": {"@type": "Answer", "text": "Urban Luxe предлагает апартаменты в 4 лучших комплексах Ташкента: Nest One (самый высокий небоскрёб, 51 этаж), U-Tower NRG, Mirabad Avenue и Kislorod. Все комплексы расположены в центре города."}
    },
    {
      "@type": "Question",
      "name": "Можно ли заселиться ночью?",
      "acceptedAnswer": {"@type": "Answer", "text": "Да, заселение возможно 24/7. Стандартное время заезда — 14:00, выезда — 12:00, но мы гибко подходим к времени заселения."}
    },
    {
      "@type": "Question",
      "name": "Есть ли парковка?",
      "acceptedAnswer": {"@type": "Answer", "text": "Да, во всех комплексах есть бесплатная охраняемая парковка для гостей."}
    }
  ]
};

// Inject structured data
[structuredData, faqSchema].forEach(data => {
  const s = document.createElement('script');
  s.type = 'application/ld+json';
  s.textContent = JSON.stringify(data);
  document.head.appendChild(s);
});

// Canonical URL
if(!document.querySelector('link[rel="canonical"]')){
  const canonical = document.createElement('link');
  canonical.rel = 'canonical';
  canonical.href = 'https://urbanluxe.cc';
  document.head.appendChild(canonical);
}

// Enhanced description
const descMeta = document.querySelector('meta[name="description"]');
if(descMeta) descMeta.content = 'Посуточная аренда премиальных апартаментов в Ташкенте от $85/ночь. 22 квартиры в Nest One, U-Tower, Mirabad, Kislorod. Wi-Fi, кухня, парковка, заезд 24/7. Бронируйте онлайн!';

// Enhanced OG description
const ogDesc = document.querySelector('meta[property="og:description"]');
if(ogDesc) ogDesc.content = '22 премиальных апартамента в лучших комплексах Ташкента от $85/ночь. Полная кухня, Wi-Fi, консьерж 24/7. Забронируйте онлайн!';

// Keywords — максимальный охват
if(!document.querySelector('meta[name="keywords"]')){
  const kw = document.createElement('meta');
  kw.name = 'keywords';
  kw.content = [
    // Русские ключи — основные
    'посуточная аренда Ташкент', 'квартира посуточно Ташкент', 'снять квартиру Ташкент',
    'аренда квартиры Ташкент', 'апартаменты Ташкент', 'квартира на сутки Ташкент',
    'жилье посуточно Ташкент', 'съем квартиры Ташкент', 'снять апартаменты Ташкент',
    'квартира на ночь Ташкент', 'аренда жилья Ташкент', 'премиум апартаменты Ташкент',
    // Комплексы
    'Nest One квартира', 'U-Tower аренда', 'Mirabad апартаменты', 'Kislorod квартира',
    'Tashkent City аренда', 'квартира Tashkent City', 'небоскрёб Nest One',
    // Типы жилья
    'студия Ташкент посуточно', 'однокомнатная посуточно', 'двухкомнатная посуточно',
    'квартира с кухней Ташкент', 'апартаменты с видом Ташкент',
    // Цели поездки
    'квартира для командировки Ташкент', 'жилье для туристов Ташкент',
    'квартира для бизнеса Ташкент', 'апартаменты для релокации',
    'квартира рядом с аэропортом Ташкент', 'жилье в центре Ташкента',
    // Английские ключи
    'apartments Tashkent', 'rent apartment Tashkent', 'short term rental Tashkent',
    'serviced apartments Tashkent', 'luxury apartments Tashkent', 'Tashkent accommodation',
    'furnished apartments Tashkent', 'corporate housing Tashkent',
    'holiday rental Tashkent', 'vacation rental Tashkent Uzbekistan',
    'best apartments Tashkent', 'premium rental Tashkent',
    'Airbnb Tashkent alternative', 'Booking Tashkent apartments',
    // Узбекские ключи
    'kvartira Toshkent', 'ijaraga kvartira Toshkent', 'sutkalik kvartira Toshkent',
    // Бренд
    'Urban Luxe', 'Urban Luxe Tashkent', 'urbanluxe.cc'
  ].join(', ');
  document.head.appendChild(kw);
}

// Additional OG tags
const ogTags = {
  'og:locale': 'ru_RU',
  'og:locale:alternate': 'en_US',
  'og:site_name': 'Urban Luxe'
};
Object.entries(ogTags).forEach(([prop, content]) => {
  if(!document.querySelector(`meta[property="${prop}"]`)){
    const m = document.createElement('meta');
    m.setAttribute('property', prop);
    m.content = content;
    document.head.appendChild(m);
  }
});


// ===== 2. INTERACTIVE MAP =====
const COMPLEXES = [
  {
    id: 'nest_one',
    name: 'Nest One',
    address: 'ул. Батыра Закирова 1А, Шайхантахурский район',
    lat: 41.312058,
    lng: 69.251817,
    color: '#2ecc71',
    desc: 'Самый высокий небоскрёб Узбекистана. 51 этаж, панорамный вид на город.',
    apts: 5,
    price: 'от $90',
    filter: 'nest_one'
  },
  {
    id: 'utower',
    name: 'U-Tower NRG',
    address: 'мкр. Бешагач 1/1, Шайхантахурский район',
    lat: 41.311097,
    lng: 69.239303,
    color: '#3498db',
    desc: 'Современный жилой комплекс бизнес-класса. 30 этажей, Smart Home.',
    apts: 12,
    price: 'от $85',
    filter: 'utower'
  },
  {
    id: 'mirabad',
    name: 'Mirabad Avenue',
    address: 'ул. Айбек 38А, Мирабадский район',
    lat: 41.291499,
    lng: 69.271517,
    color: '#e67e22',
    desc: 'Престижный район в центре. Рядом парки, рестораны, метро.',
    apts: 2,
    price: 'от $90',
    filter: 'mirabad'
  },
  {
    id: 'kislorod',
    name: 'Kislorod',
    address: 'ул. Бурижар 1, Яккасарайский район',
    lat: 41.296878,
    lng: 69.242924,
    color: '#e74c3c',
    desc: 'Эко-комплекс с зелёным двором вдоль реки. Тишина и комфорт.',
    apts: 3,
    price: 'от $105',
    filter: 'kislorod'
  }
];

const css = document.createElement('style');
css.textContent = `
/* Map Section */
#seo-map-section{padding:80px 60px;background:var(--bg,#0a0a0a)}
@media(max-width:900px){#seo-map-section{padding:50px 16px}}
.map-header{margin-bottom:32px}
.map-header .sh__label{font-size:10px;text-transform:uppercase;letter-spacing:.15em;color:var(--gold,#c9a961);margin-bottom:8px}
.map-header h2{font-size:36px;font-weight:300;color:var(--ink,#e8e2d6);font-family:'Cormorant Garamond',Georgia,serif}
.map-header h2 em{font-style:italic;color:var(--gold,#c9a961)}
@media(max-width:480px){.map-header h2{font-size:24px}}

.map-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}
@media(max-width:768px){.map-grid{grid-template-columns:1fr;gap:16px}}

/* Map container */
.map-embed{border-radius:12px;overflow:hidden;height:420px;border:1px solid rgba(201,169,97,.15)}
.map-embed iframe{width:100%;height:100%;border:0;filter:invert(90%) hue-rotate(180deg) brightness(0.8) contrast(1.1)}
@media(max-width:480px){.map-embed{height:280px}}

/* Complex cards */
.map-cards{display:flex;flex-direction:column;gap:10px}
.map-card{display:flex;gap:14px;padding:16px;border-radius:10px;border:1px solid var(--line,rgba(232,226,214,.08));background:var(--bg2,#141414);cursor:pointer;transition:all .3s}
.map-card:hover{border-color:rgba(201,169,97,.3);transform:translateX(4px)}
.map-card.active{border-color:var(--gold,#c9a961);background:rgba(201,169,97,.05)}
.map-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;margin-top:4px}
.map-card-info{flex:1}
.map-card-name{font-size:14px;font-weight:500;color:var(--ink,#e8e2d6);margin-bottom:2px}
.map-card-addr{font-size:11px;color:var(--ink-d,#6b665e);margin-bottom:4px}
.map-card-desc{font-size:12px;color:var(--ink-m,#a8a096);line-height:1.4}
.map-card-meta{display:flex;gap:12px;margin-top:6px;font-size:11px}
.map-card-meta span{color:var(--gold,#c9a961)}
.map-card-btn{font-size:10px;padding:4px 10px;border:1px solid var(--gold,#c9a961);color:var(--gold);background:none;border-radius:4px;cursor:pointer;text-transform:uppercase;letter-spacing:.08em;font-family:inherit;margin-top:8px;transition:all .2s;align-self:flex-start}
.map-card-btn:hover{background:var(--gold);color:#0a0a0a}
`;
document.head.appendChild(css);

function insertMap(){
  // Find the booking section to insert map before it
  const bookingSection = document.getElementById('booking');
  const contactSection = document.getElementById('contacts');
  const insertBefore = bookingSection || contactSection;
  if(!insertBefore) return;
  if(document.getElementById('seo-map-section')) return;

  const section = document.createElement('section');
  section.id = 'seo-map-section';
  
  // Build cards
  let cardsHTML = '';
  COMPLEXES.forEach(cx => {
    cardsHTML += `
      <div class="map-card" data-cx="${cx.id}" onclick="window._mapSelect('${cx.id}')">
        <div class="map-dot" style="background:${cx.color}"></div>
        <div class="map-card-info">
          <div class="map-card-name">${cx.name}</div>
          <div class="map-card-addr">${cx.address}</div>
          <div class="map-card-desc">${cx.desc}</div>
          <div class="map-card-meta">
            <span>${cx.apts} апартаментов</span>
            <span>${cx.price}/ночь</span>
          </div>
          <button class="map-card-btn" onclick="event.stopPropagation();window._mapFilter('${cx.name}')">Смотреть апартаменты</button>
        </div>
      </div>
    `;
  });

  // Center of Tashkent for initial map
  const centerLat = 41.3080;
  const centerLng = 69.2680;
  
  // Build markers for all complexes
  const markers = COMPLEXES.map(cx => 
    `markers=color:0x${cx.color.slice(1)}|label:${cx.name[0]}|${cx.lat},${cx.lng}`
  ).join('&');

  section.innerHTML = `
    <div class="map-header">
      <div class="sh__label">Наши комплексы</div>
      <h2>Четыре адреса <em>одного</em> стиля.</h2>
    </div>
    <div class="map-grid">
      <div class="map-embed" id="mapEmbed">
        <div id="mapPlaceholder" style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--ink-d,#6b665e);font-size:13px;cursor:pointer" onclick="window._mapLoadIframe()">📍 Нажмите чтобы загрузить карту</div>
      </div>
      <div class="map-cards">
        ${cardsHTML}
      </div>
    </div>
  `;

  insertBefore.parentElement.insertBefore(section, insertBefore);

  // Lazy-load map when section becomes visible
  const mapObs = new IntersectionObserver(entries => {
    if(entries[0].isIntersecting){
      mapObs.disconnect();
      window._mapLoadIframe();
    }
  }, {threshold: 0.1});
  mapObs.observe(section);
}

window._mapLoadIframe = function(){
  const embed = document.getElementById('mapEmbed');
  const placeholder = document.getElementById('mapPlaceholder');
  if(!embed || embed.querySelector('iframe')) return;
  const centerLat = 41.303, centerLng = 69.252;
  const iframe = document.createElement('iframe');
  iframe.id = 'mapFrame';
  iframe.loading = 'lazy';
  iframe.title = 'Карта комплексов Urban Luxe в Ташкенте';
  iframe.src = `https://www.openstreetmap.org/export/embed.html?bbox=${centerLng-0.03}%2C${centerLat-0.015}%2C${centerLng+0.03}%2C${centerLat+0.015}&layer=mapnik&marker=${centerLat}%2C${centerLng}`;
  embed.innerHTML = '';
  embed.appendChild(iframe);
};

// Map interactions
window._mapSelect = function(cxId) {
  const cx = COMPLEXES.find(c => c.id === cxId);
  if(!cx) return;
  
  // Update active card
  document.querySelectorAll('.map-card').forEach(c => c.classList.remove('active'));
  document.querySelector(`.map-card[data-cx="${cxId}"]`)?.classList.add('active');
  
  // Update map to center on selected complex
  const frame = document.getElementById('mapFrame');
  if(frame){
    frame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${cx.lng-0.008}%2C${cx.lat-0.005}%2C${cx.lng+0.008}%2C${cx.lat+0.005}&layer=mapnik&marker=${cx.lat}%2C${cx.lng}`;
  }
};

window._mapFilter = function(complexName) {
  // Scroll to apartments and filter
  const aptsSection = document.getElementById('apartments');
  if(aptsSection) aptsSection.scrollIntoView({behavior:'smooth'});
  
  // Find and click the filter button
  setTimeout(() => {
    const filterBtns = document.querySelectorAll('.filters button, [class*="filter"] button');
    filterBtns.forEach(btn => {
      if(btn.textContent.toLowerCase().includes(complexName.toLowerCase().split(' ')[0])){
        btn.click();
      }
    });
  }, 500);
};

// ===== INIT =====
// Insert map after apartments load
setTimeout(insertMap, 2000);

// Also add nav item for map
setTimeout(() => {
  const navMenu = document.querySelector('.nav__menu');
  if(navMenu && !navMenu.querySelector('[href="#seo-map-section"]')){
    const li = document.createElement('li');
    li.innerHTML = '<a href="#seo-map-section" data-i18n="nav_map">Карта</a>';
    const lastLi = navMenu.querySelector('li:last-child');
    if(lastLi) navMenu.insertBefore(li, lastLi.nextSibling);
  }
}, 1000);

console.log('[SEO+Map] Structured data + интерактивная карта загружены ✓');
})();
