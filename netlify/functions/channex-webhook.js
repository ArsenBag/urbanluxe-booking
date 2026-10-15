// channex-webhook.js — приём вебхуков Channex (global webhook, event_mask booking;booking_unmapped_room;sync_error;non_acked_booking).
// Защита: заголовок X-UL-Secret = CHANNEX_WEBHOOK_SECRET (Channex подписей не делает). Вебхук — только триггер: данные тянем запросом.
const C = require('./_channex.js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST only' };
  const h = event.headers || {};
  const secret = process.env.CHANNEX_WEBHOOK_SECRET;
  if (secret && (h['x-ul-secret'] || h['X-UL-Secret']) !== secret) return { statusCode: 401, body: 'bad secret' };
  let body; try { body = JSON.parse(event.body || '{}'); } catch (_) { return { statusCode: 400, body: 'bad json' }; }
  const ev = body.event || ''; const pl = body.payload || {};
  // B (16.10): у клиента может быть свой ключ Channex — ищем по property_id из payload (channel_properties.external_id → organizations.settings.channex.api_key)
  let key = null;
  try { const pid = pl.property_id || body.property_id; if (pid) { const pr = (await C.q('channel_properties?select=org_id&external_id=eq.' + encodeURIComponent(pid)))[0]; if (pr && (pr.org_id || 1) !== 1) { const o = (await C.q('organizations?select=settings&id=eq.' + pr.org_id))[0]; key = (((o || {}).settings || {}).channex || {}).api_key || null; } } } catch (_) { }
  try {
    if (/^booking(_new|_modification|_cancellation)?$/.test(ev)) {
      const rid = pl.revision_id || pl.booking_revision_id;
      if (!rid) { const f = await C.ingestFeed(); return { statusCode: 200, body: JSON.stringify({ via: 'feed', f }) }; }
      const r = await C.ingestRevision(rid, key);
      return { statusCode: 200, body: JSON.stringify(r) };
    }
    if (ev === 'booking_unmapped_room' || ev === 'booking_unmapped_rate') {
      await C.alertAdmin('⚠️ Channex: бронь на несопоставленную комнату/тариф (' + ev + '). Проверьте маппинг в Channex. booking ' + (pl.booking_id || ''));
      if (pl.booking_revision_id) { try { await C.ingestRevision(pl.booking_revision_id, key); } catch (_) { } }
      return { statusCode: 200, body: 'ok' };
    }
    if (ev === 'sync_error' || ev === 'rate_error') { await C.alertAdmin('⚠️ Channex sync_error: ' + (pl.channel_name || pl.channel || '') + ' · ' + (pl.error_type || '') + ' · ' + (pl.property_name || '')); return { statusCode: 200, body: 'ok' }; }
    if (ev === 'non_acked_booking') { await C.alertAdmin('⚠️ Channex: бронь не подтверждена 30 мин — ' + (pl.booking_unique_id || '') + ' ' + (pl.customer_name || '')); if (pl.booking_revision_id) { try { await C.ingestRevision(pl.booking_revision_id, key); } catch (_) { } } return { statusCode: 200, body: 'ok' }; }
    if (ev === 'reservation_request' || ev === 'inquiry' || ev === 'alteration_request') { await C.alertAdmin('📩 Airbnb ' + ev + ' — ответить в Channex / Airbnb'); return { statusCode: 200, body: 'ok' }; }
    return { statusCode: 200, body: 'ignored ' + ev };
  } catch (e) {
    // 5xx → Channex повторит с backoff
    return { statusCode: 500, body: String(e.message || e).slice(0, 300) };
  }
};
