// Urban Luxe — _booking-mail.js (14.10.2026). Письма гостю по брони: заявка принята / подтверждена / отменена.
// Один шаблон (шапка, карточка деталей, правила, футер) из book.js; меняются заголовок, вводный текст и тема.
// Отправка через Resend (RESEND_API_KEY, RESEND_FROM). Ошибка письма никогда не роняет вызов — возвращаем {sent:false, reason}.

const COMPLEX_ADDR = {
  'Nest One': 'ул. Батыра Закирова 1А, Tashkent City',
  'U-Tower': 'мкр. Бешагач 1/1, Шайхантахурский район',
  'U-Tower 2': 'мкр. Бешагач 1/1, Шайхантахурский район',
  'Mirabad': 'ул. Айбек 38А, Мирабадский район',
  'Kislorod': 'ул. Бурижар 1, Яккасарайский район',
  'Gardens Residence': 'Tashkent City, Шайхантахурский район',
  'Modera Towers': 'ул. Шота Руставели 19, Яккасарайский район'
};
const esc = s => String(s || '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const ruDate = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? m[3] + '.' + m[2] + '.' + m[1] : iso; };

const KINDS = {
  request: {
    subject: b => 'Заявка ' + b.booking_ref + ' принята · Urban Luxe',
    title: b => 'Спасибо за заявку' + (b.guest_name ? ', ' + esc(String(b.guest_name).split(' ')[0]) : '') + '!',
    intro: () => 'Мы получили вашу заявку и держим даты за вами. Подтверждение придёт отдельным письмом в течение часа (ночью — утром). Ниже — детали поездки.',
    plain: () => 'Мы получили вашу заявку и держим даты за вами. Подтверждение придёт отдельным письмом в течение часа.',
    badge: 'ЗАЯВКА ПРИНЯТА'
  },
  confirmed: {
    subject: b => 'Ваша бронь ' + b.booking_ref + ' подтверждена · Urban Luxe',
    title: b => 'Бронь подтверждена' + (b.guest_name ? ', ' + esc(String(b.guest_name).split(' ')[0]) : '') + '!',
    intro: () => 'Ваша бронь подтверждена. Ниже — все детали поездки. Адрес, код доступа и инструкцию по заселению отправим перед заездом.',
    plain: () => 'Ваша бронь подтверждена.',
    badge: 'ПОДТВЕРЖДЕНО'
  },
  cancelled: {
    subject: b => 'Бронь ' + b.booking_ref + ' отменена · Urban Luxe',
    title: () => 'Бронь отменена',
    intro: (b, o) => 'К сожалению, мы не можем подтвердить эту бронь' + (o.reason ? ': ' + esc(o.reason) : '') + '. Если даты ещё актуальны — напишите нам, подберём другой вариант.',
    plain: (b, o) => 'К сожалению, мы не можем подтвердить эту бронь' + (o.reason ? ': ' + o.reason : '') + '. Напишите нам — подберём другой вариант.',
    badge: 'ОТМЕНЕНО'
  }
};

function render(kind, booking, apt, opts) {
  const k = KINDS[kind]; const gold = '#c9a96e', dark = '#171310';
  const addr = COMPLEX_ADDR[apt.complex] || 'Ташкент';
  const aptLine = esc(apt.name) + (apt.complex ? ' · ' + esc(apt.complex) : '') + (apt.floor ? ' · этаж ' + esc(apt.floor) : '');
  const row = (label, val) => '<tr><td style="padding:7px 0;color:#8a8a8a;font-size:13px;vertical-align:top;white-space:nowrap">' + label + '</td><td style="padding:7px 0 7px 18px;color:#222;font-size:14px;text-align:right">' + val + '</td></tr>';
  const rules = kind === 'cancelled' ? '' :
    '<div style="border-top:1px solid #eee7d9;padding-top:20px;margin-bottom:20px"><div style="font-size:14px;font-weight:bold;color:#1c1c1c;margin-bottom:8px">🔑 Заселение</div>' +
    '<p style="margin:0;color:#555;font-size:13px;line-height:1.65">Заезд с 15:00, выезд до 12:00. Адрес, код доступа и подробную инструкцию мы отправим перед заездом.</p></div>' +
    '<div style="border-top:1px solid #eee7d9;padding-top:20px;margin-bottom:20px"><div style="font-size:14px;font-weight:bold;color:#1c1c1c;margin-bottom:8px">❌ В апартаментах запрещено</div>' +
    '<p style="margin:0;color:#555;font-size:13px;line-height:1.9">🚭 Курить внутри апартамента<br>🎉 Проводить вечеринки и шумные мероприятия<br>🔊 Шуметь после 22:00<br>👥 Заселять посторонних гостей без согласования<br>🔑 Передавать ключи и карту третьим лицам<br>🚫 Нарушать правила ЖК и заниматься незаконной деятельностью</p>' +
    '<p style="margin:12px 0 0;color:#9a6b1f;font-size:12px;line-height:1.6;background:#fdf6e7;border-radius:8px;padding:10px 12px">⚠️ При нарушении правил проживания может быть удержан депозит и/или досрочно прекращено проживание.</p></div>';
  const buttons = kind === 'cancelled' ? '' :
    '<div style="text-align:center;margin-bottom:26px"><a href="https://urbanluxe.cc/guest.html" style="background:' + gold + ';color:#241d10;padding:13px 26px;border-radius:9px;text-decoration:none;display:inline-block;font-weight:bold;font-size:14px">Личный кабинет</a>' +
    '<div style="margin-top:10px"><a href="https://urbanluxe.cc/cancel.html?ref=' + encodeURIComponent(booking.booking_ref) + '" style="color:#8a8a8a;font-size:12px">Управление бронированием / отмена</a></div></div>';
  const html =
    '<div style="background:#f4f2ee;padding:24px 12px;font-family:Arial,Helvetica,sans-serif"><div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e8e4dc">' +
    '<div style="background:' + dark + ';padding:26px 32px;text-align:center"><div style="color:' + gold + ';font-size:20px;letter-spacing:.35em;font-family:Georgia,serif">URBAN&nbsp;LUXE</div><div style="color:#9a938a;font-size:11px;letter-spacing:.18em;margin-top:6px">ПРЕМИАЛЬНЫЕ АПАРТАМЕНТЫ · ТАШКЕНТ</div></div>' +
    '<div style="padding:30px 32px"><div style="display:inline-block;background:' + (kind === 'cancelled' ? '#f3c4c1' : kind === 'request' ? '#fde68a' : '#9ee0a8') + ';color:#1c1c1c;font-size:11px;letter-spacing:.12em;padding:4px 10px;border-radius:6px;margin-bottom:12px">' + k.badge + '</div>' +
    '<h2 style="margin:0 0 6px;font-weight:600;font-size:21px;color:#1c1c1c">' + k.title(booking) + '</h2>' +
    '<p style="margin:0 0 22px;color:#666;font-size:14px">' + k.intro(booking, opts) + '</p>' +
    '<div style="background:#faf8f4;border:1px solid #eee7d9;border-radius:12px;padding:18px 20px;margin-bottom:24px"><table style="width:100%;border-collapse:collapse">' +
    row('Номер брони', '<strong style="font-size:16px;color:' + gold + ';letter-spacing:.05em">' + esc(booking.booking_ref) + '</strong>') +
    row('Апартамент', '<strong>' + aptLine + '</strong>') + row('Адрес', esc(addr)) +
    row('Заезд', '<strong>' + ruDate(booking.check_in) + '</strong> · c 15:00') + row('Выезд', '<strong>' + ruDate(booking.check_out) + '</strong> · до 12:00') +
    row('Гостей', esc(booking.guests_count || 1)) + row('Итого', '<strong style="font-size:17px">$' + esc(booking.total_price) + '</strong>') +
    '</table></div>' + buttons + rules +
    '<div style="border-top:1px solid #eee7d9;padding-top:18px;text-align:center"><p style="margin:0 0 10px;color:#444;font-size:14px">' + (kind === 'cancelled' ? 'Будем рады помочь с другими датами.' : 'Будем рады видеть вас в наших апартаментах! ✨') + '</p>' +
    '<p style="margin:0;color:#8a8a8a;font-size:12px;line-height:1.8">Вопросы 24/7: <a href="https://t.me/Arsen_bnb" style="color:' + gold + '">Telegram @Arsen_bnb</a><br>+998 93 690 00 44 · +998 99 957 94 85<br><a href="https://urbanluxe.cc" style="color:' + gold + '">urbanluxe.cc</a></p></div>' +
    '</div></div></div>';
  const text = k.plain(booking, opts) + '\n\nНомер брони: ' + booking.booking_ref + '\nАпартамент: ' + apt.name + (apt.complex ? ' (' + apt.complex + ')' : '') + '\nАдрес: ' + addr +
    '\nЗаезд: ' + ruDate(booking.check_in) + ' c 15:00\nВыезд: ' + ruDate(booking.check_out) + ' до 12:00\nГостей: ' + (booking.guests_count || 1) + '\nИтого: $' + booking.total_price +
    (kind === 'cancelled' ? '' : '\n\nЛичный кабинет: https://urbanluxe.cc/guest.html\nУправление бронированием: https://urbanluxe.cc/cancel.html?ref=' + encodeURIComponent(booking.booking_ref)) +
    '\n\nВопросы 24/7: Telegram @Arsen_bnb · +998 93 690 00 44 · urbanluxe.cc';
  return { subject: k.subject(booking), html, text };
}

async function send(kind, booking, apt, opts) {
  opts = opts || {};
  const key = process.env.RESEND_API_KEY || process.env.RESEND_KEY || process.env.EMAIL_API_KEY;
  const to = opts.to || booking.guest_email;
  if (!key) return { sent: false, reason: 'no RESEND_API_KEY' };
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { sent: false, reason: 'no guest_email' };
  const from = process.env.RESEND_FROM || 'Urban Luxe <booking@urbanluxe.cc>';
  const m = render(kind, booking, apt || {}, opts);
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [to], subject: m.subject, html: m.html, text: m.text }) });
    if (!r.ok) return { sent: false, reason: 'resend ' + r.status + ' ' + (await r.text()).slice(0, 120) };
    return { sent: true };
  } catch (e) { return { sent: false, reason: String(e.message || e) }; }
}

module.exports = { send, render, mailRequest: (b, a) => send('request', b, a), mailConfirmed: (b, a) => send('confirmed', b, a), mailCancelled: (b, a, reason) => send('cancelled', b, a, { reason }), COMPLEX_ADDR };
