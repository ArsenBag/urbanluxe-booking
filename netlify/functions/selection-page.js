// Urban Luxe — selection-page.js (16.10.2026). Публичная подборка свободных квартир для гостя: /s/<code> (redirect в netlify.toml).
// Создаётся в /pms («Свободно» → галочки → «Подборка для гостя») → таблица selections. Для каждой квартиры: фото, название,
// ЖК/этаж/гостей, цена за ночь и за период (pms_price, канал site), живая проверка занятости по rate_calendar;
// «Забронировать» → форма → POST /.netlify/functions/book (заявка, status=request, в заметке «Подборка <code>») + /notify в TG.
// Спека: docs/superpowers/specs/2026-10-15-pms-objects-channels-v2-design.md §5
const T = require('./_tg.js');
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const img = (u, w) => 'https://images.weserv.nl/?url=' + encodeURIComponent(String(u).replace(/^https?:\/\//, '')) + '&w=' + w + '&q=78&output=webp';
const photos = a => { const p = a.photo_url || ''; if (!p) return []; try { const arr = JSON.parse(p); return Array.isArray(arr) ? arr.filter(Boolean) : [p]; } catch (_) { return [p]; } };
const ruD = s => { const d = new Date(s + 'T00:00:00Z'); return d.getUTCDate() + ' ' + ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'][d.getUTCMonth()]; };
const nightsOf = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const plural = (n, f) => n + ' ' + f[n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2];
async function q(path, opt) { const r = await T.sb(path, opt); const t = await r.text(); if (!r.ok) throw new Error(t.slice(0, 200)); return t ? JSON.parse(t) : null; }

function page(title, body, extraHead) {
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="robots" content="noindex,nofollow"><link rel="icon" href="/favicon.ico">${extraHead || ''}
<style>
:root{--bg:#090807;--bg2:#0f0e0c;--bg3:#171512;--ink:#ede8df;--ink-m:#a09888;--ink-d:#635c52;--gold:#c9a961;--gold-d:#a88d45;--line:rgba(201,169,97,.15)}
*{box-sizing:border-box;margin:0;padding:0}body{background:var(--bg);color:var(--ink);font-family:Jost,-apple-system,Segoe UI,Roboto,sans-serif;font-weight:300;padding:18px 14px 40px;max-width:760px;margin:0 auto}
h1{font-family:Georgia,serif;font-weight:400;font-size:22px;color:var(--gold);letter-spacing:.06em;margin:4px 0 2px}.sub{font-size:13px;color:var(--ink-m);margin-bottom:14px}.note{font-size:14px;color:var(--ink);margin:0 0 16px;padding:10px 12px;border-left:2px solid var(--gold-d);background:var(--bg2)}
.card{background:var(--bg2);border:1px solid var(--line);border-radius:14px;overflow:hidden;margin-bottom:16px}.card.busy{opacity:.55}
.ph{position:relative;aspect-ratio:16/10;background:var(--bg3);overflow:hidden}.ph img{width:100%;height:100%;object-fit:cover;display:block}.ph .no{position:absolute;left:12px;top:12px;background:rgba(9,8,7,.75);color:var(--gold);font-size:11px;letter-spacing:.14em;padding:5px 9px;border-radius:6px}.ph .busy{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(9,8,7,.55);color:#fff;font-size:14px;letter-spacing:.2em;text-transform:uppercase}
.bd{padding:14px 16px 16px}.nm{font-family:Georgia,serif;font-size:19px;font-weight:400;margin-bottom:4px}.meta{font-size:13px;color:var(--ink-m);margin-bottom:10px}
.pr{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:12px}.pr b{font-size:22px;font-weight:400;color:var(--gold)}.pr span{font-size:13px;color:var(--ink-m)}.pr .lbl{font-size:11px;color:#2ecc71;border:1px solid rgba(46,204,113,.4);padding:2px 6px;border-radius:5px}
button,.btn{background:var(--gold);color:var(--bg);border:0;padding:12px 18px;border-radius:8px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;cursor:pointer;font-weight:500;font-family:inherit}button.ghost{background:transparent;color:var(--gold);border:1px solid var(--gold-d)}button:disabled{opacity:.5}
.frm{display:none;margin-top:12px;border-top:1px solid var(--line);padding-top:12px}.frm.open{display:block}.frm label{display:block;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-d);margin:8px 0 4px}.frm input{width:100%;background:var(--bg3);border:1px solid var(--line);color:var(--ink);padding:11px 12px;border-radius:8px;font-size:15px}.frm .r{display:grid;grid-template-columns:1fr 1fr;gap:10px}.frm .ok{color:#2ecc71;font-size:14px;margin-top:8px}.frm .er{color:#e74c3c;font-size:13px;margin-top:8px}
.foot{font-size:12px;color:var(--ink-d);margin-top:24px;text-align:center}.foot a{color:var(--gold)}.gal{display:flex;gap:4px;overflow-x:auto;padding:4px 0 0}.gal img{height:54px;width:80px;object-fit:cover;border-radius:4px;flex:none;cursor:pointer}
@media(max-width:480px){body{padding:12px 10px 40px}.frm .r{grid-template-columns:1fr}}
</style></head><body>${body}<div class="foot">Urban Luxe · апартаменты в Ташкенте · <a href="https://urbanluxe.cc">urbanluxe.cc</a> · <a href="https://t.me/UrbanLuxehotel">Telegram</a> · <a href="tel:+998936900044">+998 93 690 00 44</a></div></body></html>`;
}

exports.handler = async (event) => {
  const code = String((event.path || '').split('/').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const H = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' };
  if (!code) return { statusCode: 404, headers: H, body: page('Подборка', '<h1>URBAN LUXE</h1><div class="sub">Ссылка не найдена.</div>') };
  let s; try { s = (await q('selections?select=*&code=eq.' + encodeURIComponent(code)))[0]; } catch (e) { s = null; }
  if (!s) return { statusCode: 404, headers: H, body: page('Подборка', '<h1>URBAN LUXE</h1><div class="sub">Подборка не найдена. Напишите нам в <a style="color:var(--gold)" href="https://t.me/UrbanLuxehotel">Telegram</a> — подберём варианты.</div>') };
  const expired = s.expires_at && new Date(s.expires_at) < new Date();
  const today = T.tashToday(0); const past = s.check_in < today;
  if (expired || past) return { statusCode: 200, headers: H, body: page('Подборка устарела', `<h1>URBAN LUXE</h1><div class="sub">Эта подборка (${ruD(s.check_in)} → ${ruD(s.check_out)}) устарела. Напишите нам — пришлём свежие варианты.</div><a class="btn" href="https://t.me/UrbanLuxehotel" style="text-decoration:none;display:inline-block">Написать в Telegram</a>`) };
  q('selections?code=eq.' + encodeURIComponent(code), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ views: (s.views || 0) + 1 }) }).catch(() => null);
  const ids = s.apartment_ids || []; const n = nightsOf(s.check_in, s.check_out);
  const apts = ids.length ? await q('apartments?select=id,name,complex,floor,rooms,max_guests,catalog_no,photo_url,is_active&id=in.(' + ids.map(encodeURIComponent).join(',') + ')') : [];
  const rc = ids.length ? await q('rate_calendar?select=apartment_id,available&apartment_id=in.(' + ids.map(encodeURIComponent).join(',') + ')&date=gte.' + s.check_in + '&date=lt.' + s.check_out) : [];
  const by = {}; rc.forEach(r => { by[r.apartment_id] = by[r.apartment_id] || { n: 0, ok: true }; by[r.apartment_id].n++; if (!r.available) by[r.apartment_id].ok = false; });
  const cards = [];
  for (const id of ids) {
    const a = apts.find(x => x.id === id); if (!a) continue;
    const av = by[id]; const free = !!(a.is_active && av && av.n >= n && av.ok);
    let pr = null; if (free) { try { pr = await q('rpc/pms_price', { method: 'POST', body: JSON.stringify({ p_apt: id, p_in: s.check_in, p_out: s.check_out, p_channel: 'site', p_guests: null, p_exclude: null }) }); } catch (_) { pr = null; } }
    const ph = photos(a); const main = ph[0];
    cards.push(`<div class="card ${free ? '' : 'busy'}" id="c_${esc(id)}">
      <div class="ph">${main ? '<img src="' + esc(img(main, 900)) + '" alt="' + esc(a.name) + '" loading="lazy" id="im_' + esc(id) + '">' : ''}${a.catalog_no ? '<span class="no">№ ' + a.catalog_no + '</span>' : ''}${free ? '' : '<div class="busy">уже занято</div>'}</div>
      <div class="bd"><div class="nm">${esc(a.name)}</div><div class="meta">${esc(a.complex || '')}${a.floor ? ' · ' + a.floor + ' этаж' : ''}${a.rooms ? ' · ' + esc(a.rooms) : ''}${a.max_guests ? ' · до ' + plural(a.max_guests, ['гостя', 'гостей', 'гостей']) : ''}</div>
      ${ph.length > 1 ? '<div class="gal">' + ph.slice(1, 7).map(u => '<img src="' + esc(img(u, 240)) + '" data-big="' + esc(img(u, 900)) + '" loading="lazy" alt="">').join('') + '</div>' : ''}
      ${free && pr && pr.total ? `<div class="pr" style="margin-top:10px"><b>$${Math.round(pr.total)}</b><span>за ${plural(n, ['ночь', 'ночи', 'ночей'])} · $${Math.round(pr.total / n)}/ночь</span>${pr.discount_label ? '<span class="lbl">' + esc(pr.discount_label) + '</span>' : ''}</div>` : free ? '<div class="pr" style="margin-top:10px"><span>цену уточним при подтверждении</span></div>' : ''}
      ${free ? `<button data-bk="${esc(id)}">Забронировать</button>
      <form class="frm" data-f="${esc(id)}"><div class="r"><div><label>Имя</label><input name="guest_name" required placeholder="Как к вам обращаться"></div><div><label>Телефон</label><input name="guest_phone" required type="tel" placeholder="+998 …"></div></div>
      <div class="r"><div><label>Telegram или WhatsApp</label><input name="guest_telegram" placeholder="@ник или номер"></div><div><label>Гостей</label><input name="guests_count" type="number" min="1" max="${a.max_guests || 6}" value="2"></div></div>
      <label>Пожелания</label><input name="notes" placeholder="время заезда, детская кроватка…">
      <div style="margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button type="submit">Отправить заявку</button><span style="font-size:12px;color:var(--ink-m)">Без предоплаты. Менеджер подтвердит в течение часа.</span></div><div class="msg"></div></form>` : ''}
      </div></div>`);
  }
  const body = `<h1>URBAN LUXE</h1><div class="sub">Свободные апартаменты · заезд ${ruD(s.check_in)}, выезд ${ruD(s.check_out)} · ${plural(n, ['ночь', 'ночи', 'ночей'])}</div>${s.note ? '<div class="note">' + esc(s.note) + '</div>' : ''}${cards.join('') || '<div class="sub">Квартир в подборке нет.</div>'}
<script>
(function(){
  var CI=${JSON.stringify(s.check_in)},CO=${JSON.stringify(s.check_out)},CODE=${JSON.stringify(code)},N=${n};
  document.querySelectorAll('[data-bk]').forEach(function(b){b.addEventListener('click',function(){var f=document.querySelector('form[data-f="'+b.dataset.bk+'"]');f.classList.toggle('open');if(f.classList.contains('open'))f.querySelector('input').focus();});});
  document.querySelectorAll('.gal img').forEach(function(t){t.addEventListener('click',function(){var im=t.closest('.card').querySelector('.ph img');if(im){var old=im.src;im.src=t.dataset.big;t.dataset.big=old;}});});
  document.querySelectorAll('form[data-f]').forEach(function(f){f.addEventListener('submit',async function(e){e.preventDefault();var id=f.dataset.f,m=f.querySelector('.msg'),bt=f.querySelector('button[type=submit]');m.className='msg';m.textContent='';var d={};new FormData(f).forEach(function(v,k){d[k]=v});
    if(!d.guest_name||!d.guest_phone){m.className='msg er';m.textContent='Укажите имя и телефон';return;}
    bt.disabled=true;bt.textContent='Отправляю…';
    try{var r=await fetch('/.netlify/functions/book',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apartment_id:id,check_in:CI,check_out:CO,guest_name:d.guest_name,guest_phone:d.guest_phone,guest_telegram:d.guest_telegram||'',guests_count:d.guests_count||2,nights:N,notes:'Подборка '+CODE+(d.notes?' · '+d.notes:''),source_page:'selection'})});var j=await r.json();if(!r.ok||j.error)throw new Error(j.error||r.status);
      var card=f.closest('.card');var nm=card.querySelector('.nm').textContent;fetch('/.netlify/functions/notify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'new_booking',apartment:nm,guest_name:d.guest_name,guest_phone:d.guest_phone,check_in:CI,check_out:CO,nights:N,total:j.booking&&j.booking.total,note:'из подборки '+CODE})}).catch(function(){});
      f.innerHTML='<div class="ok">Заявка принята'+(j.booking&&j.booking.booking_ref?' · № '+j.booking.booking_ref:'')+'. Менеджер свяжется с вами для подтверждения.</div>';
    }catch(er){m.className='msg er';m.textContent='Не получилось: '+er.message+'. Напишите нам в Telegram @UrbanLuxehotel';bt.disabled=false;bt.textContent='Отправить заявку';}
  });});
})();
</script>`;
  return { statusCode: 200, headers: H, body: page('Urban Luxe · свободные апартаменты ' + ruD(s.check_in) + ' – ' + ruD(s.check_out), body, '<meta property="og:title" content="Urban Luxe · свободные апартаменты ' + esc(ruD(s.check_in) + ' – ' + ruD(s.check_out)) + '"><meta property="og:description" content="' + esc((s.note || 'Подборка апартаментов с фото и ценами').slice(0, 150)) + '">' + (apts.length && photos(apts[0])[0] ? '<meta property="og:image" content="' + esc(img(photos(apts[0])[0], 1200)) + '">' : '')) };
};
