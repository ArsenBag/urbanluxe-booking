window.UL_LANG=localStorage.getItem('ul_lang')||'ru';
var T={
ru:{nav_apartments:'Апартаменты',nav_amenities:'Удобства',nav_booking:'Бронирование',nav_contacts:'Контакты',nav_book:'Забронировать',nav_account:'Личный кабинет',hero_label:'Ташкент · 22 резиденции',hero_title:'Город ваш.<br>Дом <em>уже готов</em>.',hero_text:'Частные резиденции в лучших комплексах Ташкента. Не отель. Не съёмная квартира. Образ жизни, который подстраивается под вас.',hero_btn1:'Выбрать резиденцию',hero_btn2:'Забронировать →',hero_s1:'Резиденции',hero_s2:'Комплекса',hero_s3:'Рейтинг',phil_h:'Не номер в отеле.<br><em>Временный адрес</em> с характером дома.',phil_p1:'Urban Luxe — это про то, каким Ташкент становится, когда у вас есть своя панорама на его огни. Когда утренний кофе варится на вашей кухне. Когда швейцар знает, во сколько вас ждёт такси.',phil_p2:'NEST One, U-Tower NRG, Mirabad Avenue, Kislorod — мы выбираем самые новые, самые продуманные комплексы города. Заезд круглосуточный. Уборка по расписанию. Консьерж в одном сообщении.',apt_label:'Наши резиденции',apt_title:'Выберите <em>свой</em><br>Ташкент.',apt_sub:'От студий до просторных резиденций.<br>Каждый стиль — с характером.',apt_all:'Все',apt_per_night:'/ночь',apt_floor:'Этаж',amen_label:'Что включено',amen_title:'Всё для <em>жизни</em>,<br>не для ночёвки.',amen_kitchen:'Полная кухня',amen_kitchen_d:'Плита, духовка, холодильник, посуда — всё для настоящей еды',amen_washer:'Стиральная машина',amen_washer_d:'В каждом апартаменте — не нужно искать прачечную',amen_wifi:'Высокоскоростной Wi-Fi',amen_wifi_d:'До 100 Мбит/с — работайте, стримьте, звоните',amen_tv:'Smart TV',amen_tv_d:'YouTube, Netflix, все приложения на большом экране',amen_ac:'Кондиционер',amen_ac_d:'Центральный кондиционер в каждой комнате',amen_concierge:'Консьерж 24/7',amen_concierge_d:'Telegram @Arsen_bnb — любой вопрос в одном сообщении',steps_label:'Как это работает',steps_title:'Три шага до <em>вашего</em><br>Ташкента.',step1:'Выберите даты',step1_d:'Укажите даты заезда и выезда — мы покажем все свободные апартаменты с точной стоимостью',step2:'Выберите апартамент',step2_d:'Посмотрите фото, удобства, расположение. Каждый апартамент — уникальный стиль и характер',step3:'Забронируйте',step3_d:'Оставьте заявку — мы подтвердим в течение 15 минут. Заезд круглосуточный, ключи у консьержа',rev_label:'Отзывы',rev_title:'Что говорят <em>гости</em>.',book_label:'Бронирование',book_title:'Найдите <em>свободную</em><br>резиденцию.',book_sub:'Выберите даты — мы покажем свободные апартаменты. Нажмите на понравившийся для просмотра деталей и бронирования.',book_search:'Поиск по датам',book_checkin:'Дата заезда',book_checkout:'Дата выезда',book_find:'Найти апартаменты',book_select:'Выберите дату',m_per_night:'за ночь',m_floor:'Этаж',m_guests:'гостей',m_amenities:'Удобства',m_availability:'Доступность',m_free:'Свободно',m_booked:'Занято',m_checkin:'Заезд',m_checkout:'Выезд',m_nights:'ноч.',m_avg:'Ср. за ночь',m_book:'Забронировать',m_check:'Проверить доступность',m_cancel_free:'Бесплатная отмена · Подтверждение за 15 мин',m_name:'Ваше имя',m_phone:'Телефон',m_week_discount:'Скидка за неделю',m_month_discount:'Скидка за месяц',f_desc:'Премиальные апартаменты в лучших комплексах Ташкента.',f_complexes:'Комплексы',f_contacts:'Контакты',f_info:'Информация',f_terms:'Условия бронирования',f_rules:'Правила проживания',sr_found:'Найдено',sr_of:'из',sr_for:'на',sr_none:'К сожалению, на эти даты нет свободных апартаментов'},
en:{nav_apartments:'Apartments',nav_amenities:'Amenities',nav_booking:'Booking',nav_contacts:'Contacts',nav_book:'Book Now',nav_account:'My Account',hero_label:'Tashkent · 22 residences',hero_title:'Your city.<br>Home <em>is ready</em>.',hero_text:'Private residences in the best complexes of Tashkent. Not a hotel. Not a rental. A lifestyle that adapts to you.',hero_btn1:'Choose a residence',hero_btn2:'Book now →',hero_s1:'Residences',hero_s2:'Complexes',hero_s3:'Rating',phil_h:'Not a hotel room.<br>A <em>temporary address</em> with the character of home.',phil_p1:'Urban Luxe is about what Tashkent becomes when you have your own panorama of its lights. When morning coffee brews in your kitchen.',phil_p2:'NEST One, U-Tower NRG, Mirabad Avenue, Kislorod — we select the newest, most thoughtfully designed complexes. 24/7 check-in. Scheduled cleaning. Concierge in one message.',apt_label:'Our residences',apt_title:'Choose <em>your</em><br>Tashkent.',apt_sub:'From studios to spacious residences.<br>Each style — with character.',apt_all:'All',apt_per_night:'/night',apt_floor:'Floor',amen_label:"What's included",amen_title:'Everything for <em>living</em>,<br>not just staying.',amen_kitchen:'Full Kitchen',amen_kitchen_d:'Stove, oven, fridge, dishes — everything for real cooking',amen_washer:'Washing Machine',amen_washer_d:'In every apartment — no laundromat needed',amen_wifi:'High-Speed Wi-Fi',amen_wifi_d:'Up to 100 Mbps — work, stream, call',amen_tv:'Smart TV',amen_tv_d:'YouTube, Netflix, all apps on a big screen',amen_ac:'Air Conditioning',amen_ac_d:'Central AC in every room',amen_concierge:'Concierge 24/7',amen_concierge_d:'Telegram @Arsen_bnb — any question in one message',steps_label:'How it works',steps_title:'Three steps to <em>your</em><br>Tashkent.',step1:'Choose dates',step1_d:'Select check-in and check-out — we show available apartments with pricing',step2:'Choose apartment',step2_d:'Browse photos, amenities, location. Each apartment — unique style',step3:'Book',step3_d:'Submit — we confirm in 15 minutes. 24/7 check-in, keys with concierge',rev_label:'Reviews',rev_title:'What <em>guests</em> say.',book_label:'Booking',book_title:'Find an <em>available</em><br>residence.',book_sub:'Choose dates — we show available apartments. Click your favorite for details and booking.',book_search:'Search by dates',book_checkin:'Check-in',book_checkout:'Check-out',book_find:'Find apartments',book_select:'Select date',m_per_night:'per night',m_floor:'Floor',m_guests:'guests',m_amenities:'Amenities',m_availability:'Availability',m_free:'Available',m_booked:'Booked',m_checkin:'Check-in',m_checkout:'Check-out',m_nights:'nights',m_avg:'Avg per night',m_book:'Book for',m_check:'Check availability',m_cancel_free:'Free cancellation · Confirmed in 15 min',m_name:'Your name',m_phone:'Phone',m_week_discount:'Weekly discount',m_month_discount:'Monthly discount',f_desc:'Premium apartments in the best complexes of Tashkent.',f_complexes:'Complexes',f_contacts:'Contacts',f_info:'Information',f_terms:'Booking terms',f_rules:'House rules',sr_found:'Found',sr_of:'of',sr_for:'for',sr_none:'Unfortunately, no apartments available for these dates'},
uz:{nav_apartments:'Kvartiralar',nav_amenities:'Qulayliklar',nav_booking:'Bron qilish',nav_contacts:'Kontaktlar',nav_book:'Bron qilish',nav_account:'Shaxsiy kabinet',hero_label:'Toshkent · 22 rezidensiya',hero_title:'Shahringiz.<br>Uy <em>tayyor</em>.',hero_text:'Toshkentning eng yaxshi komplekslarida xususiy rezidensiyalar. Mehmonxona emas. Ijara emas.',hero_btn1:'Rezidensiyani tanlang',hero_btn2:'Bron qilish →',hero_s1:'Rezidensiya',hero_s2:'Kompleks',hero_s3:'Reyting',phil_h:'Mehmonxona xonasi emas.<br>Uy xarakteriga ega <em>vaqtinchalik manzil</em>.',phil_p1:'Urban Luxe — Toshkent sizning panoramangiz bo\'lganda qanday bo\'lishi haqida.',phil_p2:'NEST One, U-Tower NRG, Mirabad Avenue, Kislorod — biz eng yangi komplekslarni tanlaymiz.',apt_label:'Rezidensiyalarimiz',apt_title:'O\'z <em>Toshkentingizni</em><br>tanlang.',apt_sub:'Studiyalardan keng rezidensiyalargacha.',apt_all:'Barchasi',apt_per_night:'/kecha',apt_floor:'Qavat',amen_label:'Nimalar kiritilgan',amen_title:'<em>Yashash</em> uchun hamma narsa.',amen_kitchen:'To\'liq oshxona',amen_kitchen_d:'Plita, pech, muzlatgich, idishlar',amen_washer:'Kir yuvish mashinasi',amen_washer_d:'Har bir kvartirada',amen_wifi:'Tezkor Wi-Fi',amen_wifi_d:'100 Mbit/s gacha',amen_tv:'Smart TV',amen_tv_d:'YouTube, Netflix, barcha ilovalar',amen_ac:'Konditsioner',amen_ac_d:'Har bir xonada',amen_concierge:'Konsyerj 24/7',amen_concierge_d:'Telegram @Arsen_bnb',steps_label:'Qanday ishlaydi',steps_title:'<em>Toshkentingizga</em><br>uch qadam.',step1:'Sanalarni tanlang',step1_d:'Kirish va chiqish sanalarini ko\'rsating',step2:'Kvartira tanlang',step2_d:'Suratlar, qulayliklar, joylashuvni ko\'ring',step3:'Bron qiling',step3_d:'Ariza qoldiring — 15 daqiqada tasdiqlaymiz',rev_label:'Sharhlar',rev_title:'<em>Mehmonlar</em> nima deydi.',book_label:'Bron qilish',book_title:'<em>Bo\'sh</em> rezidensiyani toping.',book_sub:'Sanalarni tanlang — bo\'sh kvartiralarni ko\'rsatamiz.',book_search:'Qidirish',book_checkin:'Kirish',book_checkout:'Chiqish',book_find:'Topish',book_select:'Tanlang',m_per_night:'kechada',m_floor:'Qavat',m_guests:'mehmon',m_amenities:'Qulayliklar',m_availability:'Mavjudlik',m_free:'Bo\'sh',m_booked:'Band',m_checkin:'Kirish',m_checkout:'Chiqish',m_nights:'kecha',m_avg:'O\'rtacha',m_book:'Bron qilish',m_check:'Tekshirish',m_cancel_free:'Bepul bekor qilish · 15 daqiqada',m_name:'Ismingiz',m_phone:'Telefon',m_week_discount:'Haftalik chegirma',m_month_discount:'Oylik chegirma',f_desc:'Toshkentda premium kvartiralar.',f_complexes:'Komplekslar',f_contacts:'Kontaktlar',f_info:'Ma\'lumot',f_terms:'Shartlar',f_rules:'Qoidalar',sr_found:'Topildi',sr_of:'dan',sr_for:'ga',sr_none:'Bu sanalarda bo\'sh kvartiralar yo\'q'}
};
function t(k){return T[window.UL_LANG]&&T[window.UL_LANG][k]||T.ru[k]||k}

// Selector-to-key mapping array (reliable iteration)
var SEL_MAP=[
['.hero__btns .btn:first-child','hero_btn1'],
['.hero__btns .btn--ghost','hero_btn2'],
['.hero__stat:nth-child(1) .l','hero_s1'],
['.hero__stat:nth-child(2) .l','hero_s2'],
['.hero__stat:nth-child(3) .l','hero_s3'],
['.philosophy__text h2','phil_h'],
['.philosophy__text p:nth-of-type(1)','phil_p1'],
['.philosophy__text p:nth-of-type(2)','phil_p2'],
['.amen-item:nth-child(1) h4','amen_kitchen'],['.amen-item:nth-child(1) p','amen_kitchen_d'],
['.amen-item:nth-child(2) h4','amen_washer'],['.amen-item:nth-child(2) p','amen_washer_d'],
['.amen-item:nth-child(3) h4','amen_wifi'],['.amen-item:nth-child(3) p','amen_wifi_d'],
['.amen-item:nth-child(4) h4','amen_tv'],['.amen-item:nth-child(4) p','amen_tv_d'],
['.amen-item:nth-child(5) h4','amen_ac'],['.amen-item:nth-child(5) p','amen_ac_d'],
['.amen-item:nth-child(6) h4','amen_concierge'],['.amen-item:nth-child(6) p','amen_concierge_d'],
['.step:nth-child(1) h4','step1'],['.step:nth-child(1) p','step1_d'],
['.step:nth-child(2) h4','step2'],['.step:nth-child(2) p','step2_d'],
['.step:nth-child(3) h4','step3'],['.step:nth-child(3) p','step3_d'],
['.footer > div:nth-child(1) p','f_desc'],
['.footer > div:nth-child(2) h4','f_complexes'],
['.footer > div:nth-child(3) h4','f_contacts'],
['.footer > div:nth-child(4) h4','f_info'],
['#searchBtn','book_find']
];

// Section labels by data-i18n or text match
var SEC_MAP=[
['apt_label','apt_title','apt_sub'],
['amen_label','amen_title',null],
['steps_label','steps_title',null],
['rev_label','rev_title',null],
['book_label','book_title',null]
];

function setLang(lang){
  window.UL_LANG=lang;
  localStorage.setItem('ul_lang',lang);
  
  // 1. data-i18n elements
  document.querySelectorAll('[data-i18n]').forEach(function(el){
    var k=el.getAttribute('data-i18n');
    if(el.tagName==='INPUT')el.placeholder=t(k);else el.innerHTML=t(k);
  });
  
  // 2. Selector map
  for(var i=0;i<SEL_MAP.length;i++){
    var el=document.querySelector(SEL_MAP[i][0]);
    if(el){
      if(el.tagName==='INPUT')el.placeholder=t(SEL_MAP[i][1]);
      else if(el.tagName==='BUTTON')el.textContent=t(SEL_MAP[i][1]);
      else el.innerHTML=t(SEL_MAP[i][1]);
    }
  }
  
  // 3. Section headers
  var labels=document.querySelectorAll('.sh__label');
  var secKeys=['apt','amen','steps','rev','book'];
  labels.forEach(function(lbl,idx){
    if(idx<secKeys.length){
      var k=secKeys[idx];
      lbl.innerHTML=t(k+'_label');
      var title=lbl.parentElement.querySelector('.sh__title');
      if(title)title.innerHTML=t(k+'_title');
    }
  });
  // Apt subtitle
  var aptSub=document.querySelector('.sh__right');
  if(aptSub)aptSub.innerHTML=t('apt_sub');
  
  // 4. Booking section
  var sf=document.querySelector('.search-form h3');if(sf)sf.textContent=t('book_search');
  var sLabels=document.querySelectorAll('.search-form label');
  if(sLabels[0])sLabels[0].textContent=t('book_checkin');
  if(sLabels[1])sLabels[1].textContent=t('book_checkout');
  var bSub=document.querySelector('.booking-grid p');
  if(bSub)bSub.innerHTML=t('book_sub');
  var ci=document.getElementById('searchCheckIn');if(ci)ci.placeholder=t('book_select');
  var co=document.getElementById('searchCheckOut');if(co)co.placeholder=t('book_select');
  
  // 5. Filter buttons (only "All")
  var fb=document.querySelectorAll('.filters button');
  if(fb[0])fb[0].textContent=t('apt_all');
  
  // 6. Lang switcher
  document.querySelectorAll('.lang-btn').forEach(function(b){b.classList.toggle('active',b.dataset.lang===lang)});
  
  // 7. Re-render apartments
  if(typeof renderAptGrid==='function'&&typeof allApts!=='undefined')renderAptGrid(allApts);
}

function calcDynamicPrice(apt,checkIn,checkOut){
  var ci=new Date(checkIn),co=new Date(checkOut),nights=Math.round((co-ci)/864e5);
  if(nights<=0)return{total:0,nights:0,avgPerNight:0,discount:0,discountLabel:''};
  var total=0,cur=new Date(ci),seasonal=apt.seasonal_prices||{};
  while(cur<co){var dow=cur.getDay(),month=cur.getMonth()+1,price=(dow===5||dow===6)?apt.weekend_price:apt.weekday_price;
    if(seasonal.high&&seasonal.high.months&&seasonal.high.months.indexOf(month)>=0)price=Math.round(price*(seasonal.high.multiplier||1.2));
    else if(seasonal.low&&seasonal.low.months&&seasonal.low.months.indexOf(month)>=0)price=Math.round(price*(seasonal.low.multiplier||0.85));
    total+=price;cur.setDate(cur.getDate()+1)}
  var discount=0,discountLabel='',dw=apt.discount_week||10,dm=apt.discount_month||25;
  if(nights>=30){discount=dm;discountLabel=t('m_month_discount')+' -'+dm+'%'}
  else if(nights>=7){discount=dw;discountLabel=t('m_week_discount')+' -'+dw+'%'}
  var da=Math.round(total*discount/100);
  return{total:total-da,originalTotal:total,nights:nights,avgPerNight:Math.round((total-da)/nights),discount:discount,discountAmount:da,discountLabel:discountLabel};
}

window.t=t;window.setLang=setLang;window.calcDynamicPrice=calcDynamicPrice;
