// booking-pull.js — каждые 10 минут просит Channex подтянуть будущие брони Booking.com по всем активным BookingCom-каналам
// (execute/load_future_reservations). Нужно, пока Booking не включил push новых броней новому провайдеру (15.10.2026:
// бронь 6065920185 на nest_325 не пришла сама, появилась только после ручного «Pull Future Reservations»). Брони, которых у нас нет,
// Channex отдаёт вебхуком → channex-webhook → /pms. Отключить, когда push заработает (см. CHANNEX-CERT.md).
const C = require('./_channex.js');

exports.handler = async () => {
  if (!process.env.CHANNEX_API_KEY) return { statusCode: 200, body: 'no key' };
  const out = { pulled: [], errors: [] };
  try {
    const j = await C.cx('GET', '/channels?pagination[limit]=100');
    const chans = (j.data || []).filter(c => c.attributes && c.attributes.channel === 'BookingCom' && c.attributes.is_active);
    for (const c of chans) {
      try { await C.cx('POST', '/channels/' + c.id + '/execute/load_future_reservations'); out.pulled.push(c.attributes.title); }
      catch (e) { out.errors.push(c.attributes.title + ': ' + String(e.message).slice(0, 120)); }
    }
  } catch (e) { out.errors.push(String(e.message).slice(0, 200)); }
  return { statusCode: 200, body: JSON.stringify(out) };
};
