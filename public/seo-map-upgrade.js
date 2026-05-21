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
  "description": "Посуточная аренда 25 премиальных апартаментов в лучших комплексах Ташкента: Nest One, U-Tower NRG, Mirabad Avenue, Kislorod. Студии и квартиры с полной кухней, Wi-Fi, кондиционером. Заезд 24/7, консьерж-сервис. Идеально для командировок, туризма и релокации.",
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
  "priceRange": "$85 - $150",
  "currenciesAccepted": "USD, UZS, EUR",
  "paymentAccepted": "Cash, Credit Card, Bank Transfer",
  "numberOfRooms": 25,
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
if(descMeta) descMeta.content = 'Посуточная аренда премиальных апартаментов в Ташкенте от $85/ночь. 25 квартир в Nest One, U-Tower, Mirabad, Kislorod. Wi-Fi, кухня, парковка, заезд 24/7. Бронируйте напрямую без комиссии.';

// Enhanced OG description
const ogDesc = document.querySelector('meta[property="og:description"]');
if(ogDesc) ogDesc.content = '25 премиальных апартаментов в лучших комплексах Ташкента от $85/ночь. Полная кухня, Wi-Fi, консьерж 24/7. Бронируйте напрямую без комиссии.';

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
    apts: 7,
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
    apts: 13,
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

// === Dynamic Schema.org: Apartment list (loaded from Supabase) ===
async function _injectApartmentsSchema(){
  if(typeof window.supabase === 'undefined') return;
  const SB_URL = 'https://sebvfvtofiysbywxjqut.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI';
  let _sb;
  try { _sb = window.sb || window.supabase.createClient(SB_URL, SB_KEY); } catch(e){ return; }
  
  const COMPLEX_ADDR = {
    'Nest One':  {addr:'ул. Батыра Закирова 1А, Шайхантахурский район', lat:41.312058, lng:69.251817},
    'U-Tower':   {addr:'мкр. Бешагач 1/1, Шайхантахурский район',         lat:41.311097, lng:69.239303},
    'U-Tower 2': {addr:'мкр. Бешагач 1/1, Шайхантахурский район',         lat:41.311097, lng:69.239303},
    'Mirabad':   {addr:'ул. Айбек 38А, Мирабадский район',                  lat:41.291499, lng:69.271517},
    'Kislorod':  {addr:'ул. Бурижар 1, Яккасарайский район',                 lat:41.296878, lng:69.242924}
  };
  
  try {
    const {data: apts, error} = await _sb.from('apartments').select('id,name,complex,floor,style,rooms,weekday_price,weekend_price,max_guests,description,photo_url,amenities').eq('is_active', true);
    if(error || !apts || !apts.length) return;
    
    // ItemList — Google индексирует список целиком и каждый Apartment
    const itemList = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Апартаменты Urban Luxe в Ташкенте",
      "numberOfItems": apts.length,
      "itemListElement": apts.map((a, idx) => {
        const cxInfo = COMPLEX_ADDR[a.complex] || {addr: 'Ташкент', lat: 41.302, lng: 69.252};
        let photos = [];
        try { photos = Array.isArray(a.photo_url) ? a.photo_url : (typeof a.photo_url === 'string' ? JSON.parse(a.photo_url) : []); } catch(e){}
        photos = photos.filter(Boolean).slice(0, 6);
        
        const item = {
          "@type": "Apartment",
          "@id": "https://urbanluxe.cc/?apt=" + a.id,
          "url": "https://urbanluxe.cc/?apt=" + a.id,
          "name": a.name + " · " + a.complex,
          "description": (a.description || ("Премиальный апартамент " + a.style + " в комплексе " + a.complex + ", " + a.floor + " этаж. До " + (a.max_guests || 2) + " гостей.")).slice(0, 500),
          "numberOfRooms": (a.style && a.style.match(/^(\d+)/)) ? parseInt(RegExp.$1) : 1,
          "occupancy": {"@type": "QuantitativeValue", "maxValue": a.max_guests || 2},
          "floorLevel": String(a.floor),
          "address": {
            "@type": "PostalAddress",
            "streetAddress": cxInfo.addr,
            "addressLocality": "Ташкент",
            "addressRegion": "Ташкент",
            "addressCountry": "UZ"
          },
          "geo": {"@type": "GeoCoordinates", "latitude": cxInfo.lat, "longitude": cxInfo.lng},
          "offers": {
            "@type": "Offer",
            "url": "https://urbanluxe.cc/?apt=" + a.id,
            "priceCurrency": "USD",
            "price": a.weekday_price || a.weekend_price,
            "priceValidUntil": new Date(Date.now() + 180*24*3600*1000).toISOString().slice(0,10),
            "availability": "https://schema.org/InStock",
            "businessFunction": "https://schema.org/LeaseOut"
          }
        };
        if(photos.length) item.image = photos;
        return {"@type": "ListItem", "position": idx + 1, "item": item};
      })
    };
    
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.id = 'schema-apartments-list';
    s.textContent = JSON.stringify(itemList);
    document.head.appendChild(s);
    
    console.log('[SEO] Schema.org: ' + apts.length + ' apartments injected ✓');
  } catch(e){
    console.warn('[SEO] Schema injection failed:', e.message);
  }
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => setTimeout(_injectApartmentsSchema, 800));
} else {
  setTimeout(_injectApartmentsSchema, 800);
}

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

/* Static map fallback (без WebGL) */
.map-static-wrap{position:relative;width:100%;height:100%;background:#1a1a1a;overflow:hidden}
.map-static-img{display:block;width:100%;height:100%;object-fit:cover;filter:invert(90%) hue-rotate(180deg) brightness(.85) contrast(1.05)}
.map-static-noimg{background:linear-gradient(135deg,#1a1a1a 0%,#0f0f0f 50%,#1a1a1a 100%)}
.map-static-pins{position:absolute;inset:0;pointer-events:none}
.map-static-pin{position:absolute;transform:translate(-50%,-100%);background:none;border:none;padding:0;cursor:pointer;pointer-events:auto;display:flex;flex-direction:column;align-items:center;font-family:inherit}
.map-static-pin-dot{width:16px;height:16px;background:var(--pin-color);border-radius:50%;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5),0 0 0 4px color-mix(in srgb,var(--pin-color) 30%,transparent);transition:transform .25s}
.map-static-pin-label{margin-top:4px;font-size:11px;color:#fff;background:rgba(20,20,20,.85);padding:3px 8px;border-radius:4px;white-space:nowrap;letter-spacing:.04em;border:1px solid rgba(255,255,255,.1);font-family:var(--fb,sans-serif)}
.map-static-pin:hover .map-static-pin-dot{transform:scale(1.25)}
.map-static-open{position:absolute;bottom:12px;right:12px;background:rgba(20,20,20,.85);color:var(--gold,#c9a961);padding:8px 14px;border-radius:6px;text-decoration:none;font-size:11px;letter-spacing:.05em;border:1px solid rgba(201,169,97,.3);transition:all .2s}
.map-static-open:hover{background:var(--gold,#c9a961);color:#0a0a0a}
@media(max-width:480px){.map-static-pin-label{font-size:10px;padding:2px 6px}.map-static-open{font-size:10px;padding:6px 10px}}
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

function _hasWebGL(){
  try{
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  }catch(e){return false;}
}

function _renderStaticMap(embed){
  // Static fallback: красивая карта Tashkent с пинами комплексов, без WebGL
  const centerLat = 41.302, centerLng = 69.250;
  // Bounding box, чтобы все 4 комплекса попали в кадр
  const minLat = 41.288, maxLat = 41.316, minLng = 69.235, maxLng = 69.275;
  const mapW = 800, mapH = 420;
  
  // Wikimedia статичная карта (бесплатно, без ключа)
  const tileUrl = `https://maps.wikimedia.org/img/osm-intl,13,${centerLat},${centerLng},${mapW}x${mapH}.png`;
  
  // Преобразуем lat/lng пинов в проценты внутри картинки
  const pins = COMPLEXES.map(cx => {
    const xPct = ((cx.lng - minLng) / (maxLng - minLng)) * 100;
    const yPct = 100 - ((cx.lat - minLat) / (maxLat - minLat)) * 100;
    return `<button class="map-static-pin" style="left:${xPct.toFixed(2)}%;top:${yPct.toFixed(2)}%;--pin-color:${cx.color}" data-cx="${cx.id}" onclick="window._mapSelect('${cx.id}')" aria-label="${cx.name}"><span class="map-static-pin-dot"></span><span class="map-static-pin-label">${cx.name}</span></button>`;
  }).join('');
  
  embed.innerHTML = `
    <div class="map-static-wrap">
      <img class="map-static-img" src="${tileUrl}" alt="Карта комплексов Urban Luxe в Ташкенте" width="${mapW}" height="${mapH}" loading="lazy" onerror="this.onerror=null;this.style.display='none';this.parentElement.classList.add('map-static-noimg')"/>
      <div class="map-static-pins">${pins}</div>
      <a class="map-static-open" href="https://yandex.com/maps/-/CHuAFTEI" target="_blank" rel="noopener" title="Открыть в Яндекс.Картах">📍 Открыть в Яндекс.Картах</a>
    </div>
  `;
}

window._mapLoadIframe = function(){
  const embed = document.getElementById('mapEmbed');
  if(!embed || embed.querySelector('iframe') || embed.querySelector('.map-static-wrap')) return;
  
  if(!_hasWebGL()){
    _renderStaticMap(embed);
    return;
  }
  
  const centerLat = 41.303, centerLng = 69.252;
  const iframe = document.createElement('iframe');
  iframe.id = 'mapFrame';
  iframe.loading = 'lazy';
  iframe.title = 'Карта комплексов Urban Luxe в Ташкенте';
  iframe.src = `https://www.openstreetmap.org/export/embed.html?bbox=${centerLng-0.03}%2C${centerLat-0.015}%2C${centerLng+0.03}%2C${centerLat+0.015}&layer=mapnik&marker=${centerLat}%2C${centerLng}`;
  // Если iframe не отрисуется за 5 секунд (например, OSM требует WebGL внутри iframe) — fallback на статику
  let fellback = false;
  const fallbackTimer = setTimeout(() => {
    if(fellback) return;
    fellback = true;
    _renderStaticMap(embed);
  }, 5000);
  iframe.addEventListener('load', () => {
    clearTimeout(fallbackTimer);
  });
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
