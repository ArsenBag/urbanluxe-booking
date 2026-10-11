// channel-push.js — по расписанию каждую минуту: очередь channel_outbox → Channex (availability + restrictions).
// Каждые 10 минут дополнительно опрашивает feed неподтверждённых броней (страховка от пропущенных вебхуков).
// Ручной вызов: POST ?key=<RC_SYNC_KEY>&a=outbox|feed|full[&apt=]
const C = require('./_channex.js');

exports.handler = async (event) => {
  const p = (event && event.queryStringParameters) || {};
  const manual = !!p.key;
  if (manual && p.key !== process.env.RC_SYNC_KEY) return { statusCode: 403, body: 'forbidden' };
  if (!process.env.CHANNEX_API_KEY) return { statusCode: 200, body: JSON.stringify({ skipped: 'no CHANNEX_API_KEY' }) };
  const out = {};
  try {
    if (manual && p.a === 'full') out.full = await C.rpc('pms_outbox_full', { p_apt: p.apt || null });
    if (!manual || p.a === 'outbox' || p.a === 'full') out.outbox = await C.processOutbox();
    const m = new Date().getUTCMinutes();
    if ((!manual && m % 10 === 0) || p.a === 'feed') out.feed = await C.ingestFeed();
  } catch (e) { out.error = String(e.message || e); }
  return { statusCode: out.error ? 500 : 200, body: JSON.stringify(out) };
};
