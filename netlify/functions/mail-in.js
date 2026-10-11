// mail-in.js — приём писем bookings@urbanluxe.cc (Cloudflare Email Routing → Worker cloudflare/mail-worker.js → сюда).
// Заголовок X-UL-Secret = MAIL_IN_SECRET. Тело: сырое письмо (RFC 822) либо JSON {from,to,subject,text,html,raw}.
// Письма Яндекс Путешествий / Sutochno разбираются в брони: новая → bookings (или обогащает бронь, уже созданную по iCal
// на те же даты), отмена → cancelled. Всё письмо хранится в inbound_emails, нераспознанное — тревога в Telegram.
const C = require('./_channex.js');

// ---------- MIME ----------
function decodeQP(s) { return s.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))); }
function bytesToStr(bytes, charset) { try { return new TextDecoder((charset || 'utf-8').toLowerCase()).decode(bytes); } catch (_) { return new TextDecoder('utf-8').decode(bytes); } }
function decodeBody(body, enc, charset) {
  enc = (enc || '7bit').toLowerCase();
  if (enc === 'base64') return bytesToStr(Buffer.from(body.replace(/\s+/g, ''), 'base64'), charset);
  if (enc === 'quoted-printable') return bytesToStr(Buffer.from(decodeQP(body), 'latin1'), charset);
  return body;
}
function decodeHeader(v) { return String(v || '').replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (_, cs, t, d) => t.toUpperCase() === 'B' ? bytesToStr(Buffer.from(d, 'base64'), cs) : bytesToStr(Buffer.from(decodeQP(d.replace(/_/g, ' ')), 'latin1'), cs)); }
function parseHeaders(raw) { const h = {}; raw.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/).forEach(l => { const m = l.match(/^([\w-]+):\s*(.*)$/); if (m) h[m[1].toLowerCase()] = decodeHeader(m[2]); }); return h; }
function parseMime(raw) {
  const idx = raw.search(/\r?\n\r?\n/); const head = parseHeaders(idx < 0 ? raw : raw.slice(0, idx)); const body = idx < 0 ? '' : raw.slice(idx).replace(/^\r?\n\r?\n/, '');
  const ct = head['content-type'] || 'text/plain'; const out = { headers: head, text: '', html: '' };
  const bm = ct.match(/boundary="?([^";]+)"?/i);
  if (/^multipart\//i.test(ct) && bm) {
    for (const part of body.split('--' + bm[1]).slice(1)) { if (part.trim() === '--' || !part.trim()) continue; const sub = parseMime(part.replace(/^\r?\n/, '')); if (sub.text) out.text += sub.text; if (sub.html) out.html += sub.html; }
  } else {
    const cs = (ct.match(/charset="?([^";]+)"?/i) || [])[1]; const dec = decodeBody(body, head['content-transfer-encoding'], cs);
    if (/text\/html/i.test(ct)) out.html = dec; else if (/text\/plain/i.test(ct) || !/^(image|application|audio|video)\//i.test(ct)) out.text = dec;
  }
  return out;
}
const htmlToText = h => String(h || '').replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, '').replace(/<br\s*\/?>|<\/p>|<\/div>|<\/tr>|<\/li>|<\/h\d>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

// ---------- разбор ----------
const MONTHS = { январ: 1, феврал: 2, март: 3, апрел: 4, ма: 5, июн: 6, июл: 7, август: 8, сентябр: 9, октябр: 10, ноябр: 11, декабр: 12 };
function parseDate(s, yearHint) {
  if (!s) return null; s = s.trim();
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/); if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  m = s.match(/(\d{1,2})\s+([а-яё]+)\.?(?:\s+(\d{4}))?/i);
  if (m) { const k = Object.keys(MONTHS).find(k => m[2].toLowerCase().startsWith(k)); if (k) { const y = m[3] || yearHint || new Date().getFullYear(); return y + '-' + String(MONTHS[k]).padStart(2, '0') + '-' + m[1].padStart(2, '0'); } }
  return null;
}
function findDates(text) {
  // «Заезд: 12 октября 2026» / «Дата заезда 12.10.2026» / «12 окт — 15 окт» / «с 12.10 по 15.10»
  const res = {};
  let m = text.match(/(?:заезд|check-?in|прибыти[ея])[^\d]{0,30}(\d{1,2}[.\s][а-яё\d.]{2,12}(?:\s*\d{4})?)/i); if (m) res.check_in = parseDate(m[1]);
  m = text.match(/(?:выезд|check-?out|отъезд|убыти[ея])[^\d]{0,30}(\d{1,2}[.\s][а-яё\d.]{2,12}(?:\s*\d{4})?)/i); if (m) res.check_out = parseDate(m[1]);
  if (!res.check_in || !res.check_out) {
    m = text.match(/(\d{1,2}(?:\.\d{1,2}\.\d{4}|\s+[а-яё]+\.?(?:\s+\d{4})?))\s*[—–-]+\s*(\d{1,2}(?:\.\d{1,2}\.\d{4}|\s+[а-яё]+\.?(?:\s+\d{4})?))/i);
    if (m) { const a = parseDate(m[1]), b = parseDate(m[2]); if (a && b) { res.check_in = res.check_in || a; res.check_out = res.check_out || b; } }
  }
  if (res.check_in && res.check_out && res.check_out <= res.check_in) { const y = +res.check_out.slice(0, 4) + 1; res.check_out = y + res.check_out.slice(4); }
  return res;
}
function parseEmail(mail, platform) {
  const text = (mail.text && mail.text.length > 80 ? mail.text : htmlToText(mail.html)) || mail.text || '';
  const subj = mail.subject || '';
  const all = subj + '\n' + text;
  const p = { platform };
  p.kind = /отмен|cancel|аннул/i.test(subj) ? 'cancelled' : /измен|modif|перенос/i.test(subj) ? 'modified' : /нов|брон|подтвержд|заказ|new|booking|reservation/i.test(subj) ? 'new' : 'other';
  let m = all.match(/(?:номер\s+(?:брони|бронирования|заказа)|бронирование|заказ|бронь|booking|reservation)\s*(?:№|#|no\.?|id)?\s*[:：]?\s*([A-Z0-9-]{5,20})/i); if (m) p.code = m[1];
  Object.assign(p, findDates(all));
  m = all.match(/(?:гост|имя|guest|name|клиент|заказчик)[^\n:]{0,20}[:：]\s*([^\n]{2,60})/i); if (m) p.guest_name = m[1].trim();
  m = all.match(/(\+?\d[\d\s()-]{8,}\d)/); if (m) p.phone = m[1].replace(/[^\d+]/g, '');
  m = all.match(/[\w.+-]+@[\w-]+\.[\w.]+/); if (m && !/yandex|sutochno|urbanluxe/i.test(m[0])) p.email = m[0];
  m = all.match(/(?:сумма|стоимость|итого|к оплате|total|amount|цена)[^\d\n]{0,25}([\d\s]{2,9}(?:[.,]\d{1,2})?)\s*(₽|руб|rub|\$|usd|сум|uzs|€|eur)?/i); if (m) { p.amount = Number(m[1].replace(/\s/g, '').replace(',', '.')); p.currency = /₽|руб|rub/i.test(m[2] || '') ? 'RUB' : /\$|usd/i.test(m[2] || '') ? 'USD' : /сум|uzs/i.test(m[2] || '') ? 'UZS' : /€|eur/i.test(m[2] || '') ? 'EUR' : null; }
  m = all.match(/(?:гостей|guests|человек|взросл)[^\d\n]{0,15}(\d{1,2})/i); if (m) p.guests = +m[1];
  m = all.match(/(?:объект|апартамент|квартир|жиль[её]|property|listing|размещени[ея])[^\n:]{0,25}[:：]\s*([^\n]{3,100})/i); if (m) p.property_name = m[1].trim();
  if (/оплачен|предоплат|prepaid|paid/i.test(all) && !/не оплачен/i.test(all)) p.paid_hint = true;
  return p;
}
async function matchApartment(p, platform) {
  if (!p.property_name) return null;
  const name = p.property_name.toLowerCase();
  const aliases = await C.q('apartment_aliases?select=*');
  const al = aliases.find(a => (a.platform === '*' || a.platform === platform) && name.includes(a.alias.toLowerCase()));
  if (al) return al.apartment_id;
  const apts = await C.q('apartments?select=id,name,complex,floor&is_active=eq.true');
  // «Nest One 1/3/15», «Апартамент 15 Nest One», «кв. 15» — ищем номер квартиры и ЖК
  const slashes = [...name.matchAll(/\/(\d{1,4})\b/g)];
  const num = (name.match(/(?:кв\.?|апартамент[ыа]?|apt|№)\s*(\d{1,4})/i) || [])[1] || (slashes.length ? slashes[slashes.length - 1][1] : null);
  const cx = apts.map(a => a.complex).filter((v, i, s) => v && s.indexOf(v) === i).find(c => name.includes(c.toLowerCase().split(' ')[0]));
  if (num) { const c = apts.filter(a => a.id.endsWith('_' + num) && (!cx || a.complex === cx)); if (c.length === 1) return c[0].id; }
  const byName = apts.find(a => name.includes(a.name.toLowerCase())); return byName ? byName.id : null;
}

async function process(id) {
  const e = (await C.q('inbound_emails?select=*&id=eq.' + id))[0];
  const platform = /yandex|яндекс/i.test(e.from_addr + ' ' + e.subject) ? 'yandex' : /sutochno|суточно/i.test(e.from_addr + ' ' + e.subject) ? 'sutochno' : /ostrovok|островок/i.test(e.from_addr) ? 'ostrovok' : 'unknown';
  const p = parseEmail({ subject: e.subject, text: e.text_body, html: e.html_body }, platform);
  const patch = { platform, kind: p.kind, parsed: p, processed_at: new Date().toISOString() };
  if (platform === 'unknown' || p.kind === 'other') { patch.status = 'ignored'; await C.q('inbound_emails?id=eq.' + id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) }); return { id, status: 'ignored', platform, kind: p.kind }; }
  const apt = await matchApartment(p, platform); patch.apartment_id = apt;
  const label = { yandex: 'Яндекс Путешествия', sutochno: 'Sutochno', ostrovok: 'Ostrovok' }[platform] || platform;
  try {
    if (!apt || !p.check_in || !p.check_out) { patch.status = 'unmatched'; patch.error = !apt ? 'не распознан объект: ' + (p.property_name || '—') : 'не распознаны даты'; }
    else {
      const extId = platform + ':' + (p.code || (p.check_in + '_' + p.check_out));
      let b = (await C.q('bookings?select=*&apartment_id=eq.' + encodeURIComponent(apt) + '&external_id=eq.' + encodeURIComponent(extId) + '&limit=1'))[0];
      if (!b) b = (await C.q('bookings?select=*&apartment_id=eq.' + encodeURIComponent(apt) + '&source=eq.ical&channel=eq.' + platform + '&check_in=eq.' + p.check_in + '&check_out=eq.' + p.check_out + '&status=neq.cancelled&limit=1'))[0];
      const fields = { guest_name: p.guest_name || label, guest_phone: p.phone || null, guest_email: p.email || null, guests_count: p.guests || 1, total_price: p.amount ? Math.round(p.amount) : 0, currency: p.currency || 'RUB', notes: (label + (p.code ? ' · код ' + p.code : '') + (p.paid_hint ? ' · оплачено на площадке' : '')).slice(0, 300), channel: platform, created_by: 'mail:' + platform };
      if (p.kind === 'cancelled') {
        if (b) { await C.q('bookings?id=eq.' + b.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'cancelled', cancelled_at: new Date().toISOString(), created_by: 'mail:' + platform }) }); patch.status = 'cancelled'; patch.booking_id = b.id; }
        else { patch.status = 'unmatched'; patch.error = 'отмена неизвестной брони'; }
      } else if (b) {
        const upd = Object.assign({}, fields, { external_id: extId, source: 'mail', updated_at: new Date().toISOString() });
        if (b.guest_name && !/^(Яндекс|Sutochno|Ostrovok)/.test(b.guest_name) && !p.guest_name) delete upd.guest_name;
        if (!p.amount) { delete upd.total_price; delete upd.currency; }
        await C.q('bookings?id=eq.' + b.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(upd) }); patch.status = 'enriched'; patch.booking_id = b.id;
      } else {
        const rows = await C.q('bookings', { method: 'POST', body: JSON.stringify(Object.assign({ apartment_id: apt, check_in: p.check_in, check_out: p.check_out, nights: Math.round((new Date(p.check_out) - new Date(p.check_in)) / 864e5), status: 'confirmed', source: 'mail', external_id: extId, booking_ref: 'UL-' + platform.slice(0, 2).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(), prepaid: p.paid_hint && p.amount ? p.amount : null }, fields)) });
        patch.status = 'booked'; patch.booking_id = rows[0].id;
      }
    }
  } catch (err) { patch.status = 'error'; patch.error = String(err.message).slice(0, 300); }
  await C.q('inbound_emails?id=eq.' + id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
  const aptName = apt ? ((await C.q('apartments?select=name&id=eq.' + encodeURIComponent(apt)))[0] || {}).name : null;
  const icon = { booked: '🆕', enriched: '✏️', cancelled: '❌', unmatched: '⚠️', error: '🚨' }[patch.status] || 'ℹ️';
  await C.alertAdmin(icon + ' Письмо ' + label + ': ' + { booked: 'бронь создана', enriched: 'бронь дополнена', cancelled: 'бронь отменена', unmatched: 'НЕ РАСПОЗНАНО — ' + (patch.error || ''), error: 'ошибка — ' + (patch.error || '') }[patch.status] + '\n' + (aptName || p.property_name || '?') + ' · ' + (p.check_in || '?') + ' → ' + (p.check_out || '?') + '\n' + (p.guest_name || '') + (p.phone ? ' · ' + p.phone : '') + (p.amount ? ' · ' + p.amount + ' ' + (p.currency || '') : '') + (p.code ? '\nкод ' + p.code : '') + '\nТема: ' + (e.subject || '').slice(0, 80));
  return { id, status: patch.status, apartment_id: apt, parsed: p, error: patch.error };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST only' };
  const h = event.headers || {}; const secret = process.env.MAIL_IN_SECRET;
  if (secret && (h['x-ul-secret'] || h['X-UL-Secret']) !== secret) return { statusCode: 401, body: 'bad secret' };
  let from = h['x-mail-from'] || '', to = h['x-mail-to'] || '', subject = '', text = '', html = '', mid = '';
  const ctype = h['content-type'] || '';
  let raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf-8') : (event.body || '');
  if (/application\/json/i.test(ctype)) { try { const j = JSON.parse(raw); from = j.from || from; to = j.to || to; subject = j.subject || ''; text = j.text || ''; html = j.html || ''; if (j.raw) raw = j.raw; else raw = ''; } catch (_) { } }
  if (raw) { const m = parseMime(raw); from = from || m.headers.from || ''; to = to || m.headers.to || ''; subject = subject || m.headers.subject || ''; text = text || m.text; html = html || m.html; mid = m.headers['message-id'] || ''; }
  if (mid) { const dup = await C.q('inbound_emails?select=id&message_id=eq.' + encodeURIComponent(mid) + '&limit=1'); if (dup.length) return { statusCode: 200, body: JSON.stringify({ dup: dup[0].id }) }; }
  const rows = await C.q('inbound_emails', { method: 'POST', body: JSON.stringify({ message_id: mid || null, from_addr: from.slice(0, 200), to_addr: to.slice(0, 200), subject: decodeHeader(subject).slice(0, 300), text_body: (text || '').slice(0, 20000), html_body: (html || '').slice(0, 60000) }) });
  try { const r = await process(rows[0].id); return { statusCode: 200, body: JSON.stringify(r) }; }
  catch (e) { return { statusCode: 200, body: JSON.stringify({ id: rows[0].id, error: String(e.message) }) }; }
};
exports.process = process;
