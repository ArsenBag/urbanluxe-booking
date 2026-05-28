/* Urban Luxe — доперевод секций, которых нет в i18n.js:
   отзывы, FAQ, блок «Сервис», блок «Нам доверяют», строка площадок.
   Переводит по тексту узла (точное совпадение) и по innerHTML заголовков —
   без data-i18n и без правок index.html. Оборачивает setLang. */
(function () {
  'use strict';

  // Текстовые фразы (точное совпадение текстового узла)
  var PH = [
    // --- Отзывы ---
    { ru: '«Потрясающий вид на город, чистота идеальная, всё продумано до мелочей. Лучший выбор в Ташкенте!»',
      en: '"Stunning city views, spotless cleanliness, every detail thought through. The best choice in Tashkent!"',
      uz: '"Shaharning ajoyib manzarasi, benuqson tozalik, har bir tafsilot o\'ylangan. Toshkentdagi eng yaxshi tanlov!"' },
    { ru: '«Как дома, только лучше. Кухня, стиральная машина, шикарный телевизор. Консьерж отвечает мгновенно.»',
      en: '"Like home, only better. Kitchen, washing machine, a great TV. The concierge replies instantly."',
      uz: '"Uydagidek, faqat yaxshiroq. Oshxona, kir yuvish mashinasi, zo\'r televizor. Konsyerj darhol javob beradi."' },
    { ru: '«Бронировали на неделю, остались на месяц. U-Tower — это другой уровень комфорта. Рекомендую всем!»',
      en: '"Booked for a week, stayed for a month. U-Tower is a different level of comfort. Highly recommend!"',
      uz: '"Bir haftaga bron qildik, bir oy qoldik. U-Tower — boshqa darajadagi qulaylik. Hammaga tavsiya qilaman!"' },
    { ru: 'Дмитрий К. · Москва', en: 'Dmitry K. · Moscow', uz: 'Dmitriy K. · Moskva' },
    { ru: 'Анна М. · Санкт-Петербург', en: 'Anna M. · St. Petersburg', uz: 'Anna M. · Sankt-Peterburg' },
    { ru: 'Алексей Б. · Алматы', en: 'Alexey B. · Almaty', uz: 'Aleksey B. · Olmaota' },

    // --- FAQ: вопросы ---
    { ru: 'Как происходит заселение?', en: 'How does check-in work?', uz: 'Ko\'chib o\'tish qanday amalga oshiriladi?' },
    { ru: 'Какие способы оплаты?', en: 'What payment methods are available?', uz: 'Qanday to\'lov usullari mavjud?' },
    { ru: 'Можно ли отменить бронирование?', en: 'Can I cancel a booking?', uz: 'Bronni bekor qilish mumkinmi?' },
    { ru: 'Предоставляете ли вы отчётные документы?', en: 'Do you provide accounting documents?', uz: 'Hisobot hujjatlarini berasizmi?' },
    { ru: 'Есть ли скидки при длительном проживании?', en: 'Are there discounts for long stays?', uz: 'Uzoq muddatli yashashda chegirmalar bormi?' },
    { ru: 'Оформляете ли временную регистрацию?', en: 'Do you arrange temporary registration?', uz: 'Vaqtinchalik ro\'yxatdan o\'tkazasizmi?' },

    // --- FAQ: ответы ---
    { ru: 'Заезд круглосуточный. После подтверждения бронирования вы получите адрес, код от двери и инструкцию. Консьерж встретит вас на месте или ключи будут в сейф-боксе. Среднее время заселения — 5 минут.',
      en: 'Check-in is available 24/7. Once your booking is confirmed, you\'ll receive the address, door code and instructions. The concierge will meet you on site, or the keys will be in a safe box. Average check-in time — 5 minutes.',
      uz: 'Kirish 24/7. Bron tasdiqlangach, manzil, eshik kodi va ko\'rsatmalarni olasiz. Konsyerj sizni joyida kutib oladi yoki kalitlar seyf-boksda bo\'ladi. O\'rtacha kirish vaqti — 5 daqiqa.' },
    { ru: 'Наличные (USD, UZS), банковские карты (Visa, Mastercard, Humo, UzCard), переводы. При бронировании через сайт предоплата не требуется — оплата при заселении.',
      en: 'Cash (USD, UZS), bank cards (Visa, Mastercard, Humo, UzCard), transfers. When booking via the website, no prepayment is required — you pay on check-in.',
      uz: 'Naqd pul (USD, UZS), bank kartalari (Visa, Mastercard, Humo, UzCard), pul o\'tkazmalari. Sayt orqali bron qilishda oldindan to\'lov talab qilinmaydi — to\'lov kirishda.' },
    { ru: 'Да, бесплатная отмена до 18:00 дня заезда. Вы получите email с подтверждением отмены. Для отмены используйте ссылку из письма-подтверждения или напишите в Telegram.',
      en: 'Yes, free cancellation until 18:00 on the check-in day. You\'ll receive an email confirming the cancellation. To cancel, use the link in your confirmation email or message us on Telegram.',
      uz: 'Ha, kirish kuni soat 18:00 gacha bepul bekor qilish. Bekor qilish tasdig\'i emailga keladi. Bekor qilish uchun tasdiq xatidagi havoladan foydalaning yoki Telegramga yozing.' },
    { ru: 'Да, предоставляем полный пакет отчётных документов для командировочных: договор, акт, чек. Запрашивайте при бронировании.',
      en: 'Yes, we provide a full set of accounting documents for business trips: contract, act, receipt. Request them when booking.',
      uz: 'Ha, xizmat safari uchun to\'liq hisobot hujjatlar to\'plamini beramiz: shartnoma, dalolatnoma, chek. Bron qilishda so\'rang.' },
    { ru: 'Да! 7+ ночей — скидка 10%, 14+ ночей — 15%, 30+ ночей — индивидуальный тариф. Напишите нам для расчёта.',
      en: 'Yes! 7+ nights — 10% off, 14+ nights — 15%, 30+ nights — a custom rate. Message us for a quote.',
      uz: 'Ha! 7+ kecha — 10% chegirma, 14+ kecha — 15%, 30+ kecha — individual tarif. Hisob-kitob uchun yozing.' },
    { ru: 'Да, оформляем временную регистрацию для всех иностранных граждан на весь срок проживания. Это бесплатно и входит в стоимость.',
      en: 'Yes, we arrange temporary registration for all foreign citizens for the entire stay. It\'s free and included in the price.',
      uz: 'Ha, barcha xorijiy fuqarolar uchun butun yashash muddatiga vaqtinchalik ro\'yxatdan o\'tkazamiz. Bu bepul va narxga kiritilgan.' },

    // --- Блок «Сервис» (extras) ---
    { ru: 'Дополнительно', en: 'Extras', uz: 'Qo\'shimcha' },
    { ru: 'Трансфер из аэропорта', en: 'Airport transfer', uz: 'Aeroportdan transfer' },
    { ru: 'Временная регистрация', en: 'Temporary registration', uz: 'Vaqtinchalik ro\'yxat' },
    { ru: 'Long-stay скидки', en: 'Long-stay discounts', uz: 'Uzoq muddat chegirmalari' },
    { ru: 'Ежедневная уборка', en: 'Daily cleaning', uz: 'Kunlik tozalash' },
    { ru: 'Встретим в аэропорту Ташкента или на вокзале. Комфортный автомобиль, водитель с табличкой.',
      en: 'We\'ll meet you at Tashkent airport or the railway station. A comfortable car, driver with a sign.',
      uz: 'Sizni Toshkent aeroportida yoki vokzalda kutib olamiz. Qulay avtomobil, peshtaxtali haydovchi.' },
    { ru: 'Оформляем временную регистрацию для иностранных граждан на весь срок проживания.',
      en: 'We arrange temporary registration for foreign citizens for the whole stay.',
      uz: 'Xorijiy fuqarolar uchun butun muddatga vaqtinchalik ro\'yxatdan o\'tkazamiz.' },
    { ru: 'Проживание от 7 ночей — скидка 10%. От 30 ночей — индивидуальный тариф.',
      en: 'Stays of 7+ nights — 10% off. From 30 nights — a custom rate.',
      uz: '7+ kecha yashash — 10% chegirma. 30 kechadan — individual tarif.' },
    { ru: 'Профессиональный клининг по расписанию или по запросу. Свежие полотенца и бельё.',
      en: 'Professional cleaning on schedule or on request. Fresh towels and linens.',
      uz: 'Jadval bo\'yicha yoki so\'rov bo\'yicha professional tozalash. Yangi sochiqlar va choyshablar.' },
    { ru: 'от $15', en: 'from $15', uz: '$15 dan' },
    { ru: 'Бесплатно', en: 'Free', uz: 'Bepul' },
    { ru: 'до -20%', en: 'up to -20%', uz: '-20% gacha' },
    { ru: 'Включено', en: 'Included', uz: 'Kiritilgan' },

    // --- Блок «Нам доверяют» (trust) ---
    { ru: 'Нам доверяют', en: 'Trusted by', uz: 'Bizga ishonishadi' },
    { ru: 'РЕЙТИНГ ГОСТЕЙ', en: 'GUEST RATING', uz: 'MEHMONLAR REYTINGI' },
    { ru: 'РЕЗИДЕНЦИЙ В 4 ЖК', en: 'RESIDENCES IN 4 COMPLEXES', uz: '4 MAJMUADA REZIDENSIYA' },
    { ru: 'ПОДДЕРЖКА И ЗАЕЗД', en: 'SUPPORT & CHECK-IN', uz: 'QO\'LLAB-QUVVATLASH VA KIRISH' },
    { ru: 'ПОДТВЕРЖДЕНИЕ БРОНИ', en: 'BOOKING CONFIRMATION', uz: 'BRON TASDIG\'I' },
    { ru: '15 мин', en: '15 min', uz: '15 daq' },
    { ru: 'БРОНИРУЙТЕ НА:', en: 'BOOK ON:', uz: 'BU YERDA BRON QILING:' },

    // --- Прочее ---
    { ru: 'Вопросы', en: 'Questions', uz: 'Savollar' },

    // --- Стили/типы апартаментов (подзаголовок карточки) ---
    { ru: 'Студия', en: 'Studio', uz: 'Studiya' },
    { ru: 'Оливковая студия', en: 'Olive studio', uz: 'Zaytun studiya' },
    { ru: '2+1 · Просторный', en: '2+1 · Spacious', uz: '2+1 · Keng' },
    { ru: 'двухкомнатная', en: 'Two-room', uz: 'Ikki xonali' },
    { ru: 'Классика · 3+1', en: 'Classic · 3+1', uz: 'Klassika · 3+1' },
    { ru: 'Лофт · Чёрный мрамор', en: 'Loft · Black marble', uz: 'Loft · Qora marmar' },
    { ru: '3х', en: '3-room', uz: '3 xonali' },
    { ru: 'Светлый · Золотые акценты', en: 'Bright · Gold accents', uz: 'Yorug\' · Oltin aksentlar' },
    { ru: 'Премиум', en: 'Premium', uz: 'Premium' },
    { ru: 'Студия · Высокий этаж', en: 'Studio · High floor', uz: 'Studiya · Baland qavat' },
    { ru: 'Премиум · Панорамный вид', en: 'Premium · Panoramic view', uz: 'Premium · Panoramali manzara' },

    // --- Блок карты (seo-map-upgrade.js, вставляется динамически) ---
    { ru: 'Наши комплексы', en: 'Our complexes', uz: 'Bizning majmualar' },
    { ru: 'Самый высокий небоскрёб Узбекистана. 51 этаж, панорамный вид на город.',
      en: 'The tallest skyscraper in Uzbekistan. 51 floors, panoramic city views.',
      uz: 'O\'zbekistondagi eng baland osmono\'par bino. 51 qavat, shaharning panoramali manzarasi.' },
    { ru: 'Современный жилой комплекс бизнес-класса. 30 этажей, Smart Home.',
      en: 'A modern business-class residential complex. 30 floors, Smart Home.',
      uz: 'Zamonaviy biznes-klass turar-joy majmuasi. 30 qavat, Smart Home.' },
    { ru: 'Престижный район в центре. Рядом парки, рестораны, метро.',
      en: 'A prestigious district in the centre. Parks, restaurants and the metro nearby.',
      uz: 'Markazdagi nufuzli hudud. Yaqinida bog\'lar, restoranlar, metro.' },
    { ru: 'Эко-комплекс с зелёным двором вдоль реки. Тишина и комфорт.',
      en: 'An eco-complex with a green courtyard along the river. Quiet and comfort.',
      uz: 'Daryo bo\'yidagi yashil hovlili eko-majmua. Sokinlik va qulaylik.' },
    { ru: 'ул. Батыра Закирова 1А, Шайхантахурский район', en: '1A Batyr Zakirov St., Shaykhantakhur district', uz: 'Botir Zokirov ko\'chasi 1A, Shayxontohur tumani' },
    { ru: 'мкр. Бешагач 1/1, Шайхантахурский район', en: 'Beshagach 1/1, Shaykhantakhur district', uz: 'Beshyog\'och mavzesi 1/1, Shayxontohur tumani' },
    { ru: 'ул. Айбек 38А, Мирабадский район', en: '38A Aybek St., Mirabad district', uz: 'Oybek ko\'chasi 38A, Mirobod tumani' },
    { ru: 'ул. Бурижар 1, Яккасарайский район', en: '1 Burijar St., Yakkasaray district', uz: 'Burijar ko\'chasi 1, Yakkasaroy tumani' },
    { ru: '7 апартаментов', en: '7 apartments', uz: '7 ta kvartira' },
    { ru: '13 апартаментов', en: '13 apartments', uz: '13 ta kvartira' },
    { ru: '2 апартамента', en: '2 apartments', uz: '2 ta kvartira' },
    { ru: '3 апартамента', en: '3 apartments', uz: '3 ta kvartira' },
    { ru: 'от $90/ночь', en: 'from $90/night', uz: '$90/kechadan' },
    { ru: 'от $85/ночь', en: 'from $85/night', uz: '$85/kechadan' },
    { ru: 'от $105/ночь', en: 'from $105/night', uz: '$105/kechadan' },
    { ru: 'Смотреть апартаменты', en: 'View apartments', uz: 'Kvartiralarni ko\'rish' },
    { ru: '📍 Нажмите чтобы загрузить карту', en: '📍 Click to load the map', uz: '📍 Xaritani yuklash uchun bosing' },
    { ru: '📍 Открыть в Яндекс.Картах', en: '📍 Open in Yandex Maps', uz: '📍 Yandex Xaritalarda ochish' }
  ];

  // Заголовки с разметкой (точное совпадение innerHTML)
  var HD = [
    { ru: 'Более <em>500 гостей</em> из 30 стран.', en: 'More than <em>500 guests</em> from 30 countries.', uz: '30 davlatdan <em>500+ mehmon</em>.' },
    { ru: 'Сервис, который <em>решает</em> всё.', en: 'Service that <em>handles</em> everything.', uz: 'Hammasini <em>hal qiladigan</em> xizmat.' },
    { ru: 'Часто <em>задаваемые</em> вопросы.', en: 'Frequently <em>asked</em> questions.', uz: 'Tez-tez <em>so\'raladigan</em> savollar.' },
    { ru: 'Четыре адреса <em>одного</em> стиля.', en: 'Four addresses, <em>one</em> style.', uz: 'Bitta uslubdagi <em>to\'rt</em> manzil.' }
  ];

  function buildMap(arr) {
    var m = {};
    arr.forEach(function (e) {
      ['ru', 'en', 'uz'].forEach(function (l) { if (e[l]) m[e[l].trim()] = e; });
    });
    return m;
  }
  var phMap = buildMap(PH);
  var hdMap = buildMap(HD);

  // --- Описание апартамента в модалке: подмена из БД (description_en/uz) ---
  var SB_URL = 'https://sebvfvtofiysbywxjqut.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI';
  var descTr = null; // {id: {ru, en, uz}}
  function escHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function loadDescTr() {
    if (descTr || !(window.supabase || window.sb)) return;
    try {
      var sb = window.sb || window.supabase.createClient(SB_URL, SB_KEY);
      sb.from('apartments').select('id,description,description_en,description_uz').eq('is_active', true).then(function (res) {
        if (res && res.data) {
          descTr = {};
          res.data.forEach(function (r) { descTr[r.id] = { ru: r.description, en: r.description_en, uz: r.description_uz }; });
          applyDesc(window.UL_LANG || 'ru');
        }
      });
    } catch (e) {}
  }
  function modalAptId() {
    var img = document.querySelector('#modalContent img, .modal img');
    if (img && img.src) { var m = img.src.match(/\/apartments\/([^\/]+)\//); if (m && m[1] && m[1] !== 'hero') return m[1]; }
    return null;
  }
  function applyDesc(lang) {
    var d = document.querySelector('.modal-desc'); if (!d || !descTr) return;
    var id = modalAptId(); if (!id || !descTr[id]) return;
    var txt = descTr[id][lang] || descTr[id].ru;
    if (txt == null) return;
    var html = escHtml(txt).replace(/\r?\n/g, '<br>');
    if (d.innerHTML !== html) d.innerHTML = html;
  }

  // Названия апартаментов «Апартамент N» / «Apartment N» / «Kvartira N» — одно правило на все
  var APT_WORD = { ru: 'Апартамент', en: 'Apartment', uz: 'Kvartira' };
  var APT_RE = /^(Апартамент|Apartment|Kvartira)\s+(\d+)$/;
  function applyText(lang) {
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) {
      var raw = n.nodeValue, key = raw.trim();
      if (!key) continue;
      var e = phMap[key];
      if (e && e[lang] && key !== e[lang]) { n.nodeValue = raw.replace(key, e[lang]); continue; }
      var m = key.match(APT_RE);
      if (m) {
        var target = APT_WORD[lang] + ' ' + m[2];
        if (key !== target) n.nodeValue = raw.replace(key, target);
      }
    }
  }
  function applyHeadings(lang) {
    document.querySelectorAll('.sh__title, h2').forEach(function (el) {
      var key = el.innerHTML.trim(), e = hdMap[key];
      if (e && e[lang] && key !== e[lang]) el.innerHTML = e[lang];
    });
  }
  var observer = null;
  function applyLang(lang) {
    if (lang !== 'ru' && lang !== 'en' && lang !== 'uz') lang = 'ru';
    if (observer) observer.disconnect();            // не реагируем на собственные правки
    try { applyText(lang); applyHeadings(lang); applyDesc(lang); } catch (e) {}
    if (observer && document.body) observer.observe(document.body, { childList: true, subtree: true });
  }

  // Динамический контент (карта, карточки апартаментов) вставляется скриптами позже —
  // наблюдаем за DOM и доводим перевод по мере появления.
  var reTimer;
  function setupObserver() {
    if (observer || !document.body || typeof MutationObserver === 'undefined') return;
    observer = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        if (muts[i].addedNodes && muts[i].addedNodes.length) {
          clearTimeout(reTimer);
          reTimer = setTimeout(function () { applyLang(window.UL_LANG || 'ru'); }, 200);
          return;
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Оборачиваем setLang: после штатного перевода добавляем наш
  function hook() {
    if (typeof window.setLang === 'function' && !window.setLang.__extraHooked) {
      var orig = window.setLang;
      window.setLang = function (l) {
        var r = orig.apply(this, arguments);
        applyLang(window.UL_LANG || l);
        return r;
      };
      window.setLang.__extraHooked = true;
    }
  }
  hook();
  var tries = 0, ht = setInterval(function () { hook(); if ((window.setLang && window.setLang.__extraHooked) || ++tries > 40) clearInterval(ht); }, 250);

  function init() { setupObserver(); loadDescTr(); applyLang(window.UL_LANG || 'ru'); }
  if (document.readyState !== 'loading') init(); else document.addEventListener('DOMContentLoaded', init);
  setTimeout(init, 600);
  setTimeout(init, 1500);
  setTimeout(init, 3000); // карта вставляется ~2с
})();
