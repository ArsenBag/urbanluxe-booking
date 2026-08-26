// Urban Luxe — morning-cleaning.js (Netlify scheduled, 07:30 Ташкент).
// Утреннее сообщение в Telegram: уборки и заезды на сегодня.
// Шлёт в TELEGRAM_CLEANING_CHAT_ID (группа горничных), если задан,
// иначе — в TELEGRAM_CHAT_ID (менеджер). Env уже есть в Netlify.

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CLEANING_CHAT_ID || process.env.TELEGRAM_CHAT_ID;

function tashToday() {
  return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
}

exports.handler = async () => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    if (!TOKEN || !CHAT) throw new Error('TELEGRAM env is not set');
    const base = process.env.URL || 'https://urbanluxe.cc';
    const d = await fetch(base + '/.netlify/functions/sync-ical').then(r => r.json());
    const today = tashToday();
    const co = d.checkouts || [], ci = d.checkins || [];
    const ciSet = new Set(ci.map(b => b.apartment_id));

    // имена квартир
    const SB_URL = process.env.SUPABASE_URL || 'https://sebvfvtofiysbywxjqut.supabase.co';
    const KEY = process.env.SUPABASE_SERVICE_KEY;
    const aptsRes = await fetch(SB_URL + '/rest/v1/apartments?select=id,name,complex,floor', {
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY }
    });
    const apts = {}; (await aptsRes.json()).forEach(a => { apts[a.id] = a; });
    const nm = id => { const a = apts[id]; return a ? `${a.name} (${a.complex || ''}${a.floor ? ', эт. ' + a.floor : ''})` : id; };

    let msg = `🧹 <b>Уборки на сегодня — ${today.split('-').reverse().join('.')}</b>\n\n`;
    if (!co.length) msg += 'Выездов нет — уборок по выездам нет 🎉\n';
    else {
      const urgent = co.filter(b => ciSet.has(b.apartment_id));
      const rest = co.filter(b => !ciSet.has(b.apartment_id));
      if (urgent.length) {
        msg += `⚡ <b>Срочно (сегодня же заезд):</b>\n`;
        urgent.forEach(b => { msg += `• ${nm(b.apartment_id)}\n`; });
        msg += '\n';
      }
      if (rest.length) {
        msg += `<b>Обычные уборки:</b>\n`;
        rest.forEach(b => { msg += `• ${nm(b.apartment_id)}\n`; });
        msg += '\n';
      }
    }
    msg += `🔑 <b>Заезды сегодня: ${ci.length}</b>\n`;
    ci.forEach(b => { msg += `• ${nm(b.apartment_id)} — ${b.nights} ноч.\n`; });
    msg += `\nОтмечать уборки: ${base}/staff.html (личная ссылка у каждого)`;

    const tg = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, text: msg, parse_mode: 'HTML', disable_web_page_preview: true })
    });
    const tgRes = await tg.json();
    if (!tgRes.ok) throw new Error('telegram: ' + JSON.stringify(tgRes).slice(0, 200));
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, cleanings: co.length, checkins: ci.length }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};
