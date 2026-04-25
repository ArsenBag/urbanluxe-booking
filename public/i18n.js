// i18n.js — Multilingual support for Urban Luxe
window.UL_LANG = localStorage.getItem('ul_lang') || 'ru';

const T = {
  ru: {
    // Nav
    nav_apartments: 'Апартаменты',
    nav_amenities: 'Удобства',
    nav_booking: 'Бронирование',
    nav_contacts: 'Контакты',
    nav_book: 'Забронировать',
    nav_account: 'Личный кабинет',
    // Hero
    hero_label: 'Ташкент · 22 резиденции',
    hero_title: 'Город ваш.<br>Дом <em>уже готов</em>.',
    hero_text: 'Частные резиденции в лучших комплексах Ташкента. Не отель. Не съёмная квартира. Образ жизни, который подстраивается под вас.',
    hero_btn1: 'Выбрать резиденцию',
    hero_btn2: 'Забронировать →',
    hero_s1: 'Резиденции', hero_s2: 'Комплекса', hero_s3: 'Рейтинг',
    // Philosophy
    phil_h: 'Не номер в отеле.<br><em>Временный адрес</em> с характером дома.',
    phil_p1: 'Urban Luxe — это про то, каким Ташкент становится, когда у вас есть своя панорама на его огни. Когда утренний кофе варится на вашей кухне.',
    phil_p2: 'NEST One, U-Tower NRG, Mirabad Avenue, Kislorod — мы выбираем самые новые, самые продуманные комплексы города. Заезд круглосуточный. Уборка по расписанию. Консьерж в одном сообщении.',
    // Apartments
    apt_label: 'Наши резиденции',
    apt_title: 'Выберите <em>свой</em><br>Ташкент.',
    apt_sub: 'От студий до просторных резиденций.<br>Каждый стиль — с характером.',
    apt_all: 'Все',
    apt_nophoto: 'ФОТО СКОРО',
    apt_per_night: '/ночь',
    // Amenities
    amen_label: 'Что включено',
    amen_title: 'Всё для <em>жизни</em>,<br>не для ночёвки.',
    amen_kitchen: 'Полная кухня', amen_kitchen_d: 'Плита, духовка, холодильник, посуда — всё для настоящей еды',
    amen_washer: 'Стиральная машина', amen_washer_d: 'В каждом апартаменте — не нужно искать прачечную',
    amen_wifi: 'Высокоскоростной Wi-Fi', amen_wifi_d: 'До 100 Мбит/с — работайте, стримьте, звоните',
    amen_tv: 'Smart TV', amen_tv_d: 'YouTube, Netflix, все приложения на большом экране',
    amen_ac: 'Кондиционер', amen_ac_d: 'Центральный кондиционер в каждой комнате',
    amen_concierge: 'Консьерж 24/7', amen_concierge_d: 'Telegram @Arsen_bnb — любой вопрос в одном сообщении',
    // Steps
    steps_label: 'Как это работает',
    steps_title: 'Три шага до <em>вашего</em><br>Ташкента.',
    step1: 'Выберите даты', step1_d: 'Укажите даты заезда и выезда — мы покажем все свободные апартаменты с точной стоимостью',
    step2: 'Выберите апартамент', step2_d: 'Посмотрите фото, удобства, расположение. Каждый апартамент — уникальный стиль и характер',
    step3: 'Забронируйте', step3_d: 'Оставьте заявку — мы подтвердим в течение 15 минут. Заезд круглосуточный, ключи у консьержа',
    // Reviews
    rev_label: 'Отзывы',
    rev_title: 'Что говорят <em>гости</em>.',
    // Booking
    book_label: 'Бронирование',
    book_title: 'Найдите <em>свободную</em><br>резиденцию.',
    book_sub: 'Выберите даты — мы покажем свободные апартаменты. Нажмите на понравившийся для просмотра деталей и бронирования.',
    book_search: 'Поиск по датам',
    book_checkin: 'Дата заезда', book_checkout: 'Дата выезда',
    book_find: 'Найти апартаменты',
    book_select: 'Выберите дату',
    // Modal
    m_per_night: 'за ночь', m_floor: 'Этаж', m_guests: 'гостей',
    m_amenities: 'Удобства', m_availability: 'Доступность',
    m_free: 'Свободно', m_booked: 'Занято',
    m_checkin: 'Заезд', m_checkout: 'Выезд',
    m_nights: 'ноч.', m_avg: 'Ср. за ночь',
    m_book: 'Забронировать', m_check: 'Проверить доступность',
    m_cancel_free: 'Бесплатная отмена · Подтверждение за 15 мин',
    m_name: 'Ваше имя', m_phone: 'Телефон',
    m_week_discount: 'Скидка за неделю',
    m_month_discount: 'Скидка за месяц',
    // Footer
    f_desc: 'Премиальные апартаменты в лучших комплексах Ташкента. Стиль, комфорт и вдохновение.',
    f_complexes: 'Комплексы', f_contacts: 'Контакты', f_info: 'Информация',
    f_terms: 'Условия бронирования', f_rules: 'Правила проживания',
    // Search results
    sr_found: 'Найдено', sr_of: 'из', sr_for: 'на',
    sr_none: 'К сожалению, на эти даты нет свободных апартаментов',
    // General
    loading: 'Загрузка...',
  },
  en: {
    nav_apartments: 'Apartments', nav_amenities: 'Amenities', nav_booking: 'Booking', nav_contacts: 'Contacts',
    nav_book: 'Book Now', nav_account: 'My Account',
    hero_label: 'Tashkent · 22 residences',
    hero_title: 'Your city.<br>Home <em>is ready</em>.',
    hero_text: 'Private residences in the best complexes of Tashkent. Not a hotel. Not a rental. A lifestyle that adapts to you.',
    hero_btn1: 'Choose a residence', hero_btn2: 'Book now →',
    hero_s1: 'Residences', hero_s2: 'Complexes', hero_s3: 'Rating',
    phil_h: 'Not a hotel room.<br>A <em>temporary address</em> with the character of home.',
    phil_p1: 'Urban Luxe is about what Tashkent becomes when you have your own panorama of its lights. When morning coffee brews in your kitchen.',
    phil_p2: 'NEST One, U-Tower NRG, Mirabad Avenue, Kislorod — we select the newest, most thoughtfully designed complexes. 24/7 check-in. Scheduled cleaning. Concierge in one message.',
    apt_label: 'Our residences', apt_title: 'Choose <em>your</em><br>Tashkent.',
    apt_sub: 'From studios to spacious residences.<br>Each style — with character.',
    apt_all: 'All', apt_nophoto: 'PHOTO SOON', apt_per_night: '/night',
    amen_label: 'What\'s included', amen_title: 'Everything for <em>living</em>,<br>not just staying.',
    amen_kitchen: 'Full Kitchen', amen_kitchen_d: 'Stove, oven, fridge, dishes — everything for real cooking',
    amen_washer: 'Washing Machine', amen_washer_d: 'In every apartment — no laundromat needed',
    amen_wifi: 'High-Speed Wi-Fi', amen_wifi_d: 'Up to 100 Mbps — work, stream, call',
    amen_tv: 'Smart TV', amen_tv_d: 'YouTube, Netflix, all apps on a big screen',
    amen_ac: 'Air Conditioning', amen_ac_d: 'Central AC in every room',
    amen_concierge: 'Concierge 24/7', amen_concierge_d: 'Telegram @Arsen_bnb — any question in one message',
    steps_label: 'How it works', steps_title: 'Three steps to <em>your</em><br>Tashkent.',
    step1: 'Choose dates', step1_d: 'Select check-in and check-out dates — we\'ll show all available apartments with exact pricing',
    step2: 'Choose apartment', step2_d: 'Browse photos, amenities, location. Each apartment — a unique style and character',
    step3: 'Book', step3_d: 'Submit a request — we\'ll confirm within 15 minutes. 24/7 check-in, keys with the concierge',
    rev_label: 'Reviews', rev_title: 'What <em>guests</em> say.',
    book_label: 'Booking', book_title: 'Find an <em>available</em><br>residence.',
    book_sub: 'Choose dates — we\'ll show available apartments. Click on your favorite to view details and book.',
    book_search: 'Search by dates', book_checkin: 'Check-in', book_checkout: 'Check-out',
    book_find: 'Find apartments', book_select: 'Select date',
    m_per_night: 'per night', m_floor: 'Floor', m_guests: 'guests',
    m_amenities: 'Amenities', m_availability: 'Availability',
    m_free: 'Available', m_booked: 'Booked',
    m_checkin: 'Check-in', m_checkout: 'Check-out',
    m_nights: 'nights', m_avg: 'Avg per night',
    m_book: 'Book for', m_check: 'Check availability',
    m_cancel_free: 'Free cancellation · Confirmed in 15 min',
    m_name: 'Your name', m_phone: 'Phone',
    m_week_discount: 'Weekly discount', m_month_discount: 'Monthly discount',
    f_desc: 'Premium apartments in the best complexes of Tashkent. Style, comfort and inspiration.',
    f_complexes: 'Complexes', f_contacts: 'Contacts', f_info: 'Information',
    f_terms: 'Booking terms', f_rules: 'House rules',
    sr_found: 'Found', sr_of: 'of', sr_for: 'for',
    sr_none: 'Unfortunately, no apartments available for these dates',
    loading: 'Loading...',
  },
  uz: {
    nav_apartments: 'Kvartiralar', nav_amenities: 'Qulayliklar', nav_booking: 'Bron qilish', nav_contacts: 'Kontaktlar',
    nav_book: 'Bron qilish', nav_account: 'Shaxsiy kabinet',
    hero_label: 'Toshkent · 22 rezidensiya',
    hero_title: 'Shahringiz.<br>Uy <em>tayyor</em>.',
    hero_text: 'Toshkentning eng yaxshi komplekslarida xususiy rezidensiyalar. Mehmonxona emas. Ijara emas. Sizga moslashuvchi turmush tarzi.',
    hero_btn1: 'Rezidensiyani tanlang', hero_btn2: 'Bron qilish →',
    hero_s1: 'Rezidensiya', hero_s2: 'Kompleks', hero_s3: 'Reyting',
    phil_h: 'Mehmonxona xonasi emas.<br>Uy xarakteriga ega <em>vaqtinchalik manzil</em>.',
    phil_p1: 'Urban Luxe — bu Toshkent sizning panoramangiz bo\'lganda qanday bo\'lishi haqida. Ertalabki qahva o\'z oshxonangizda tayyorlanganda.',
    phil_p2: 'NEST One, U-Tower NRG, Mirabad Avenue, Kislorod — biz eng yangi, eng o\'ylangan komplekslarni tanlaymiz. 24/7 ro\'yxatga olish. Tozalash jadval bo\'yicha.',
    apt_label: 'Rezidensiyalarimiz', apt_title: 'O\'z <em>Toshkentingizni</em><br>tanlang.',
    apt_sub: 'Studiyalardan keng rezidensiyalargacha.<br>Har bir uslub — o\'ziga xos.',
    apt_all: 'Barchasi', apt_nophoto: 'RASM TEZ KUNDA', apt_per_night: '/kecha',
    amen_label: 'Nimalar kiritilgan', amen_title: '<em>Yashash</em> uchun hamma narsa,<br>faqat tunash uchun emas.',
    amen_kitchen: 'To\'liq oshxona', amen_kitchen_d: 'Plita, pech, muzlatgich, idishlar',
    amen_washer: 'Kir yuvish mashinasi', amen_washer_d: 'Har bir kvartirada',
    amen_wifi: 'Tezkor Wi-Fi', amen_wifi_d: '100 Mbit/s gacha',
    amen_tv: 'Smart TV', amen_tv_d: 'YouTube, Netflix, barcha ilovalar',
    amen_ac: 'Konditsioner', amen_ac_d: 'Har bir xonada markaziy konditsioner',
    amen_concierge: 'Konsyerj 24/7', amen_concierge_d: 'Telegram @Arsen_bnb',
    steps_label: 'Qanday ishlaydi', steps_title: 'Sizning <em>Toshkentingizga</em><br>uch qadam.',
    step1: 'Sanalarni tanlang', step1_d: 'Kirish va chiqish sanalarini ko\'rsating',
    step2: 'Kvartira tanlang', step2_d: 'Suratlar, qulayliklar, joylashuvni ko\'ring',
    step3: 'Bron qiling', step3_d: 'Ariza qoldiring — biz 15 daqiqada tasdiqlaymiz',
    rev_label: 'Sharhlar', rev_title: '<em>Mehmonlar</em> nima deydi.',
    book_label: 'Bron qilish', book_title: '<em>Bo\'sh</em> rezidensiyani<br>toping.',
    book_sub: 'Sanalarni tanlang — biz bo\'sh kvartiralarni ko\'rsatamiz.',
    book_search: 'Sanalar bo\'yicha qidirish', book_checkin: 'Kirish sanasi', book_checkout: 'Chiqish sanasi',
    book_find: 'Kvartiralarni topish', book_select: 'Sanani tanlang',
    m_per_night: 'kechada', m_floor: 'Qavat', m_guests: 'mehmon',
    m_amenities: 'Qulayliklar', m_availability: 'Mavjudlik',
    m_free: 'Bo\'sh', m_booked: 'Band',
    m_checkin: 'Kirish', m_checkout: 'Chiqish',
    m_nights: 'kecha', m_avg: 'O\'rtacha kechada',
    m_book: 'Bron qilish', m_check: 'Mavjudlikni tekshirish',
    m_cancel_free: 'Bepul bekor qilish · 15 daqiqada tasdiqlash',
    m_name: 'Ismingiz', m_phone: 'Telefon',
    m_week_discount: 'Haftalik chegirma', m_month_discount: 'Oylik chegirma',
    f_desc: 'Toshkentning eng yaxshi komplekslarida premium kvartiralar.',
    f_complexes: 'Komplekslar', f_contacts: 'Kontaktlar', f_info: 'Ma\'lumot',
    f_terms: 'Bron qilish shartlari', f_rules: 'Yashash qoidalari',
    sr_found: 'Topildi', sr_of: 'dan', sr_for: 'ga',
    sr_none: 'Afsuski, bu sanalarda bo\'sh kvartiralar yo\'q',
    loading: 'Yuklanmoqda...',
  }
};

function t(key) { return T[window.UL_LANG]?.[key] || T.ru[key] || key; }

function setLang(lang) {
  window.UL_LANG = lang;
  localStorage.setItem('ul_lang', lang);
  // Update all elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (el.tagName === 'INPUT') el.placeholder = val;
    else el.innerHTML = val;
  });
  // Update lang switcher active state
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
  // Reload apartments with new language
  if (typeof renderAptGrid === 'function' && typeof allApts !== 'undefined') renderAptGrid(allApts);
}

// Dynamic pricing calculator
function calcDynamicPrice(apt, checkIn, checkOut) {
  const ci = new Date(checkIn), co = new Date(checkOut);
  const nights = Math.round((co - ci) / 864e5);
  if (nights <= 0) return { total: 0, nights: 0, avgPerNight: 0, discount: 0, discountLabel: '' };
  
  let total = 0;
  const cur = new Date(ci);
  const seasonal = apt.seasonal_prices || {};
  
  while (cur < co) {
    const dow = cur.getDay();
    const month = cur.getMonth() + 1;
    let price = (dow === 5 || dow === 6) ? apt.weekend_price : apt.weekday_price;
    
    // Seasonal adjustment
    if (seasonal.high && seasonal.high.months && seasonal.high.months.includes(month)) {
      price = Math.round(price * (seasonal.high.multiplier || 1.2));
    } else if (seasonal.low && seasonal.low.months && seasonal.low.months.includes(month)) {
      price = Math.round(price * (seasonal.low.multiplier || 0.85));
    }
    
    total += price;
    cur.setDate(cur.getDate() + 1);
  }
  
  // Length-of-stay discounts
  let discount = 0, discountLabel = '';
  const discWeek = apt.discount_week || 10;
  const discMonth = apt.discount_month || 25;
  
  if (nights >= 30) {
    discount = discMonth;
    discountLabel = t('m_month_discount') + ' -' + discMonth + '%';
  } else if (nights >= 7) {
    discount = discWeek;
    discountLabel = t('m_week_discount') + ' -' + discWeek + '%';
  }
  
  const discountAmount = Math.round(total * discount / 100);
  const finalTotal = total - discountAmount;
  const avgPerNight = Math.round(finalTotal / nights);
  
  return { total: finalTotal, originalTotal: total, nights, avgPerNight, discount, discountAmount, discountLabel };
}

window.t = t;
window.setLang = setLang;
window.calcDynamicPrice = calcDynamicPrice;
