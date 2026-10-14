// Urban Luxe — admin/chat.js (14.10.2026). Чат с гостями: диалог на каждую бронь (messages, conversation_id = bookings.id),
// непрочитанные, карточка брони, ответ → messages + письмо гостю (Resend), кнопки Telegram / WhatsApp / звонок / email, realtime.
(function () {
const A = window.ADM, { $, $$, esc, toast, api, ruD, ST } = A;
let THREADS = [], CUR = null, FILTER = 'all', rt = null;
const CARD = '🆕 Новая бронь';
const digits = p => String(p || '').replace(/\D/g, '');
const tgLink = v => { v = String(v || '').trim(); if (!v) return ''; if (v[0] === '@') return 'https://t.me/' + v.slice(1); const d = digits(v); return d ? 'https://t.me/+' + d : ''; };
const when = s => { if (!s) return ''; const d = new Date(s), t = new Date(d.getTime() + 5 * 36e5).toISOString(); const today = A.iso(Date.now() + 5 * 36e5); return t.slice(0, 10) === today ? t.slice(11, 16) : ruD(t.slice(0, 10)) + ' ' + t.slice(11, 16); };

A.views.chat = function () {
  $('#main').innerHTML = `<div class="page"><h2>Чат с гостями <span class="n muted" id="ch_n"></span>
      <div class="seg" id="ch_f"><button data-f="all" class="on">все</button><button data-f="unread">непрочитанные</button><button data-f="active">живут / скоро</button></div>
      <input id="ch_q" placeholder="гость, квартира, № брони" style="width:220px"><span class="sp"></span></h2>
    <div class="chat"><div class="threads" id="ch_list">Загрузка…</div><div class="thread" id="ch_thread"><div class="empty">Выберите диалог</div></div></div></div>`;
  $$('#ch_f button').forEach(b => b.onclick = () => { FILTER = b.dataset.f; $$('#ch_f button').forEach(x => x.classList.toggle('on', x === b)); renderList(); });
  $('#ch_q').oninput = renderList;
  loadList();
  const m = location.hash.match(/^#chat\/([0-9a-f-]+)/); if (m) open(m[1]);
};
A.onChange(p => { if (!$('#ch_list')) return; clearTimeout(rt); rt = setTimeout(() => { loadList(); if (CUR) open(CUR, true); }, 700); });
// realtime на messages: ядро слушает только bookings/payments/cleaning — подпишемся отдельно
let sub = null;
function subscribe() { if (sub) return; sub = A.sb.channel('chat').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, p => { if (!$('#ch_list')) return; const m = p.new || {}; if (m.sender_role === 'guest' && !String(m.content || '').startsWith(CARD)) { toast('💬 Сообщение гостя: ' + String(m.content).slice(0, 80), 6000); } loadList(); if (CUR && m.conversation_id === CUR) open(CUR, true); }).subscribe(); }
subscribe();

async function loadList() { try { THREADS = await api({ a: 'chat_list' }); renderList(); } catch (e) { $('#ch_list').innerHTML = '<div class="warn">' + esc(e.message) + '</div>'; } }
function renderList() {
  const q = ($('#ch_q').value || '').trim().toLowerCase(), today = A.iso(Date.now() + 5 * 36e5);
  const rows = THREADS.filter(t => (FILTER === 'all' || (FILTER === 'unread' ? t.unread > 0 : (t.check_out >= today && t.check_in <= A.addD(today, 7) && t.status !== 'cancelled')))
    && (!q || [t.guest_name, t.apartment_name, t.booking_ref, t.guest_phone].some(x => String(x || '').toLowerCase().includes(q))));
  const unread = THREADS.reduce((s, t) => s + (t.unread || 0), 0);
  $('#ch_n').textContent = rows.length + ' диалог.' + (unread ? ' · непрочитанных ' + unread : '');
  document.title = (unread ? '(' + unread + ') ' : '') + 'Urban Luxe · Админка';
  $('#ch_list').innerHTML = rows.map(t => `<div class="th ${t.unread ? 'un' : ''} ${t.conversation_id === CUR ? 'on' : ''}" data-id="${t.conversation_id}">
      <div class="h"><b>${esc(t.guest_name || 'Гость')}</b>${t.unread ? '<span class="badge">' + t.unread + '</span>' : ''}<span class="muted t">${when(t.last_at)}</span></div>
      <div class="s">${esc(t.apartment_name || '—')} · ${ruD(t.check_in)}–${ruD(t.check_out)} <span class="st" style="background:${(ST[t.status] || ['', '#eee'])[1]};padding:0 6px;font-size:10px">${(ST[t.status] || [t.status || ''])[0]}</span></div>
      <div class="s muted">${t.last_role === 'admin' ? '↩ ' : ''}${esc(String(t.last_text || '').startsWith(CARD) ? 'карточка брони' : String(t.last_text || '').slice(0, 70))}</div></div>`).join('') || '<div class="empty">диалогов нет</div>';
  $$('#ch_list .th').forEach(el => el.onclick = () => open(el.dataset.id));
}
async function open(id, silent) {
  CUR = id; if (!silent) history.replaceState(null, '', '#chat/' + id);
  $$('#ch_list .th').forEach(el => el.classList.toggle('on', el.dataset.id === id));
  let d; try { d = await api({ a: 'chat_msgs', id }); } catch (e) { $('#ch_thread').innerHTML = '<div class="warn">' + esc(e.message) + '</div>'; return; }
  const t = d.thread || {}; const card = d.messages.find(m => String(m.content || '').startsWith(CARD));
  const tg = tgLink(t.guest_telegram || t.guest_phone), wa = digits(t.guest_whatsapp || t.guest_phone) ? 'https://wa.me/' + digits(t.guest_whatsapp || t.guest_phone) : '';
  $('#ch_thread').innerHTML = `<div class="hd"><div><b>${esc(t.guest_name || 'Гость')}</b> <span class="muted">${esc(t.apartment_name || '')} · ${ruD(t.check_in)} → ${ruD(t.check_out)} · ${esc(t.booking_ref || '')}</span></div>
      <div class="contacts">${t.guest_phone ? '<a href="tel:' + esc(t.guest_phone) + '">📞 ' + esc(t.guest_phone) + '</a>' : ''}${tg ? '<a href="' + tg + '" target="_blank" class="tg">✈️ Telegram</a>' : ''}${wa ? '<a href="' + wa + '" target="_blank" class="wa">💬 WhatsApp</a>' : ''}${t.guest_email ? '<a href="mailto:' + esc(t.guest_email) + '">✉️ ' + esc(t.guest_email) + '</a>' : '<span class="muted">email нет — письмо не уйдёт</span>'}${t.booking_id ? '<a href="/pms#booking=' + t.booking_id + '" target="_blank">бронь в PMS ↗</a>' : ''}</div></div>
    <div class="msgs" id="ch_msgs">${card ? '<div class="m card"><pre>' + esc(card.content) + '</pre></div>' : ''}${d.messages.filter(m => m !== card).map(m => `<div class="m ${m.sender_role === 'admin' ? 'me' : 'guest'}"><div>${esc(m.content).replace(/\n/g, '<br>')}</div><span class="t">${m.sender_role === 'admin' ? 'вы' : 'гость'} · ${when(m.created_at)}</span></div>`).join('') || '<div class="empty">гость ещё ничего не писал — можно написать первым</div>'}</div>
    <div class="reply"><textarea id="ch_text" rows="3" placeholder="Ответ гостю… (Ctrl+Enter — отправить)"></textarea><div style="display:flex;gap:8px;align-items:center;margin-top:6px"><label class="muted" style="font-size:11px"><input type="checkbox" id="ch_mail" ${t.guest_email ? 'checked' : 'disabled'}> дублировать письмом</label><span class="sp"></span><button class="pri" id="ch_send">Отправить</button></div></div>`;
  const box = $('#ch_msgs'); box.scrollTop = box.scrollHeight;
  $('#ch_send').onclick = send; $('#ch_text').onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); };
  THREADS.forEach(x => { if (x.conversation_id === id) x.unread = 0; }); renderList();
}
async function send() {
  const text = $('#ch_text').value.trim(); if (!text) return; $('#ch_send').disabled = true;
  try { const r = await api(null, { a: 'chat_send', id: CUR, text, email: $('#ch_mail').checked }); toast('Отправлено' + (r.mail && r.mail.sent ? ' · письмо ушло' : r.mail && r.mail.reason && r.mail.reason !== 'off' ? ' · письмо: ' + r.mail.reason : ''), 4000); $('#ch_text').value = ''; open(CUR, true); loadList(); } catch (e) { toast(e.message, 5000); }
  $('#ch_send').disabled = false;
}
})();
