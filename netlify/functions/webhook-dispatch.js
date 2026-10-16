// webhook-dispatch.js (16.10.2026) — доставка вебхуков партнёрам каждую минуту. Очередь webhook_deliveries наполняет триггер
// bookings_webhook_tg (booking.created / booking.updated / booking.cancelled) и «проверить» из /pms (ping).
// POST JSON {id, event, created_at, data}; заголовки X-UL-Event, X-UL-Delivery, X-UL-Signature: sha256=HMAC(secret, body).
// Повторы: 1, 5, 30, 120 минут; после 5 неудач — failed (status -1), TG в чат организации один раз.
const crypto = require('crypto');
const T = require('./_tg.js');
const C = require('./_channex.js');

const BACKOFF = [1, 5, 30, 120];
async function deliver(d, w) {
  const body = JSON.stringify({ id: d.id, event: d.event, created_at: d.created_at, data: d.payload });
  const sig = 'sha256=' + crypto.createHmac('sha256', w.secret).update(body).digest('hex');
  const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(w.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'UrbanLuxe-PMS-Webhooks/1.0', 'X-UL-Event': d.event, 'X-UL-Delivery': String(d.id), 'X-UL-Signature': sig }, body, signal: ctrl.signal });
    const txt = (await r.text().catch(() => '')).slice(0, 500);
    return { status: r.status, ok: r.ok, response: txt };
  } catch (e) { return { status: 0, ok: false, response: String(e.message || e).slice(0, 200) }; }
  finally { clearTimeout(tm); }
}

async function run(limit) {
  const now = new Date().toISOString();
  const items = await C.q('webhook_deliveries?select=*&sent_at=is.null&attempts=lt.5&next_at=lte.' + encodeURIComponent(now) + '&order=created_at&limit=' + (limit || 50));
  if (!items.length) return { sent: 0 };
  const hooks = {}; for (const w of await C.q('webhooks?select=*&id=in.(' + [...new Set(items.map(i => i.webhook_id))].join(',') + ')')) hooks[w.id] = w;
  const out = { sent: 0, failed: 0, retry: 0 };
  for (const d of items) {
    const w = hooks[d.webhook_id];
    if (!w || !w.is_active) { await C.q('webhook_deliveries?id=eq.' + d.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ sent_at: now, status: -2, response: 'webhook inactive' }) }); continue; }
    const r = await deliver(d, w);
    const attempts = (d.attempts || 0) + 1;
    const patch = { attempts, status: r.status, response: r.response };
    if (r.ok) { patch.sent_at = new Date().toISOString(); out.sent++; }
    else if (attempts >= 5) { patch.sent_at = new Date().toISOString(); patch.status = -1; out.failed++;
      try { const o = (await C.q('organizations?select=tg_chat_id,name&id=eq.' + w.org_id))[0]; const text = '⚠️ Вебхук не доставлен после 5 попыток: ' + T.esc(w.url) + '\nСобытие ' + d.event + ', последний ответ: ' + T.esc(String(r.status) + ' ' + (r.response || '').slice(0, 80)) + '\nПроверьте сервер партнёра; повторить можно в /pms → Интеграции.'; if (o && o.tg_chat_id && T.TOKENS.bookings) await T.api(T.TOKENS.bookings, 'sendMessage', { chat_id: o.tg_chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true }); else await C.alertAdmin(text); } catch (_) { } }
    else { patch.next_at = new Date(Date.now() + BACKOFF[Math.min(attempts - 1, BACKOFF.length - 1)] * 60000).toISOString(); out.retry++; }
    await C.q('webhook_deliveries?id=eq.' + d.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
    await C.q('webhooks?id=eq.' + w.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ last_status: r.status, last_at: new Date().toISOString() }) });
  }
  return out;
}
exports.run = run;
exports.handler = async () => { try { return { statusCode: 200, body: JSON.stringify(await run()) }; } catch (e) { return { statusCode: 500, body: String(e.message || e) }; } };
