// Urban Luxe — chat-email.js (22.09.2026)
// Зачем: гость редко заходит в кабинет, поэтому ответ менеджера из чата админки дублируем письмом.
// Кто может вызвать: только админ — в заголовке Authorization приходит Supabase JWT, мы проверяем
// его через /auth/v1/user и сверяем email со списком админов (тот же, что в is_admin() в базе).
// Отправка: Resend (RESEND_API_KEY уже задан в Netlify для писем-подтверждений в book.js).
// Вызов (admin-chat-upgrade.js):
//   POST /.netlify/functions/chat-email  { to, guest_name, booking_ref, apartment, dates, text }
// Файл кладётся в netlify/functions/.

const SB_URL = process.env.SUPABASE_URL || 'https://sebvfvtofiysbywxjqut.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI';
const ADMINS = ['admin@urbanluxe.cc', 'arsenalkingt10@gmail.com'];

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function esc(s) { return String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }
function json(code, body) { return { statusCode: code, headers: HEADERS, body: JSON.stringify(body) }; }

async function adminEmailFromToken(auth) {
  const m = /^Bearer\s+(.+)$/i.exec(auth || '');
  if (!m) return null;
  const r = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + m[1] } });
  if (!r.ok) return null;
  const u = await r.json();
  const email = String((u && u.email) || '').toLowerCase();
  return ADMINS.indexOf(email) > -1 ? email : null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: 'ok' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  try {
    const admin = await adminEmailFromToken(event.headers.authorization || event.headers.Authorization);
    if (!admin) return json(401, { error: 'Только для админа' });

    let b; try { b = JSON.parse(event.body || '{}'); } catch (e) { b = {}; }
    const to = String(b.to || '').trim();
    const text = String(b.text || '').trim().slice(0, 4000);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) return json(400, { error: 'Нет email гостя' });
    if (!text) return json(400, { error: 'Пустое сообщение' });

    const key = process.env.RESEND_API_KEY || process.env.RESEND_KEY || process.env.EMAIL_API_KEY;
    if (!key) return json(200, { ok: false, skipped: 'RESEND_API_KEY не задан' });
    const from = process.env.RESEND_FROM || 'Urban Luxe <booking@urbanluxe.cc>';
    const replyTo = process.env.RESEND_REPLY_TO || process.env.CHAT_REPLY_TO || '';

    const gold = '#c9a96e', dark = '#171310';
    const name = String(b.guest_name || '').split(' ')[0];
    const ref = String(b.booking_ref || '');
    const apt = String(b.apartment || '');
    const dates = String(b.dates || '');
    const subj = 'Urban Luxe: сообщение по вашей брони' + (ref ? ' ' + ref : '');
    const html =
      '<div style="background:#f4f2ee;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">' +
      '<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e8e4dc">' +
      '<div style="background:' + dark + ';padding:22px 32px;text-align:center">' +
      '<div style="color:' + gold + ';font-size:20px;letter-spacing:.35em;font-family:Georgia,serif">URBAN&nbsp;LUXE</div>' +
      '<div style="color:#9a938a;font-size:11px;letter-spacing:.18em;margin-top:6px">СООБЩЕНИЕ ОТ МЕНЕДЖЕРА</div></div>' +
      '<div style="padding:26px 32px">' +
      '<p style="margin:0 0 14px;color:#222;font-size:15px">' + (name ? 'Здравствуйте, ' + esc(name) + '!' : 'Здравствуйте!') + '</p>' +
      (ref || apt || dates ? '<p style="margin:0 0 16px;color:#666;font-size:13px">По брони ' +
        (ref ? '<b style="color:' + gold + '">' + esc(ref) + '</b>' : '') + (apt ? ' · ' + esc(apt) : '') + (dates ? ' · ' + esc(dates) : '') + '</p>' : '') +
      '<div style="background:#faf8f4;border:1px solid #eee7d9;border-left:4px solid ' + gold + ';border-radius:10px;padding:14px 18px;color:#222;font-size:15px;line-height:1.55;white-space:pre-line">' + esc(text) + '</div>' +
      '<p style="margin:20px 0 0;color:#666;font-size:13px;line-height:1.6">Ответить можно прямо на это письмо, в личном кабинете или в мессенджере:</p>' +
      '<div style="margin:12px 0 0">' +
      '<a href="https://urbanluxe.cc/guest.html" style="background:' + gold + ';color:#241d10;padding:11px 18px;border-radius:9px;text-decoration:none;display:inline-block;font-weight:bold;font-size:13px;margin:0 8px 8px 0">Личный кабинет</a>' +
      '<a href="https://t.me/Arsen_bnb" style="background:#2AABEE;color:#fff;padding:11px 18px;border-radius:9px;text-decoration:none;display:inline-block;font-weight:bold;font-size:13px;margin:0 8px 8px 0">Telegram</a>' +
      '<a href="https://wa.me/998936900044" style="background:#25D366;color:#fff;padding:11px 18px;border-radius:9px;text-decoration:none;display:inline-block;font-weight:bold;font-size:13px;margin:0 8px 8px 0">WhatsApp</a>' +
      '</div>' +
      '<p style="margin:18px 0 0;color:#9a938a;font-size:11px">Urban Luxe · Ташкент · +998 93 690 00 44 · urbanluxe.cc</p>' +
      '</div></div></div>';

    const payload = { from, to: [to], subject: subj, html, text: text + '\n\n— Urban Luxe · https://urbanluxe.cc/guest.html' };
    if (replyTo) payload.reply_to = replyTo;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const out = await r.text();
    if (!r.ok) return json(502, { ok: false, error: 'Resend ' + r.status + ': ' + out.slice(0, 200) });
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { ok: false, error: String(e.message || e) });
  }
};
