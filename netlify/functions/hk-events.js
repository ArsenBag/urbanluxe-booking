// Urban Luxe — hk-events.js (01.10.2026). Приём событий уборок из housekeeping-бота (app/services/outbound.py).
// POST, заголовок X-Webhook-Token = HK_EVENTS_TOKEN. Тело: { type:'cleaning_event', event_type, old_status, new_status, task:{…} }
// Пишет в cleaning_tasks (apartment_id, date) — то же, что видит staff.html и лист заездов бронеров:
//   done = статус уборки в HK ∈ waiting_check / completed / verified; hk_status — точный статус, hk_maid — кто убирал.
// Все события — в hk_events (журнал). Проблемы/переделки — уведомление Арсену через бота бронеров.

const T = require('./_tg.js');
const HK = require('./_hk.js');
const H = { 'Content-Type': 'application/json' };
const out = (c, b) => ({ statusCode: c, headers: H, body: JSON.stringify(b) });

const DONE = new Set(['waiting_check', 'completed', 'verified']);
const RU = { plan: 'запланирована', guest_checked_out: 'гость выехал', assigned: 'назначена', in_progress: 'идёт уборка', completed: 'завершена', waiting_check: 'ждёт проверки', verified: 'проверена', rework: 'переделка', problem: 'проблема', overdue: 'просрочена', canceled: 'отменена' };

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return out(200, { ok: true, service: 'hk-events' });
  const token = process.env.HK_EVENTS_TOKEN;
  if (token && (event.headers['x-webhook-token'] || '') !== token) return out(401, { error: 'unauthorized' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch (e) { return out(400, { error: 'bad json' }); }
  const t = b.task || {};
  try {
    const apt = t.apartment_code ? await HK.byCode(t.apartment_code) : null;
    const date = t.planned_date || null;
    await T.sb('hk_events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify([{
      event_type: b.event_type, task_id: t.id, apartment_code: t.apartment_code, apartment_id: apt && apt.id, planned_date: date,
      old_status: b.old_status, new_status: b.new_status, payload: b
    }]) });
    if (apt && date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const status = b.new_status || t.status || null;
      const patch = { apartment_id: apt.id, date, hk_task_id: t.id, hk_status: status, hk_maid: t.maid_name || null, hk_updated_at: new Date().toISOString(), hk_booking_uid: t.external_booking_id || null };
      if (status && DONE.has(status)) { patch.done = true; patch.done_at = t.finished_at || t.verified_at || new Date().toISOString(); }
      else if (status && ['canceled', 'rework', 'plan', 'assigned', 'in_progress', 'problem'].indexOf(status) > -1) patch.done = false;
      await T.sb('cleaning_tasks?on_conflict=apartment_id,date', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' }, body: JSON.stringify([patch]) });
    }
    // проблемы и переделки — Арсену
    if (b.new_status && ['problem', 'rework', 'overdue'].indexOf(b.new_status) > -1 && T.ADMIN) {
      const bot = T.makeBot('booker', 'tg-free');
      await bot.send(T.ADMIN, '🧹 <b>' + T.esc(t.apartment_code || '?') + '</b> ' + (date ? T.ruDate(date) : '') + ': ' + (RU[b.new_status] || b.new_status) +
        (t.problem_type ? ' · ' + T.esc(t.problem_type) : '') + (t.rework_reason ? ' · ' + T.esc(t.rework_reason) : '') + (t.maid_name ? '\n' + T.esc(t.maid_name) : '') + (t.comment ? '\n' + T.esc(t.comment) : ''));
    }
    return out(200, { ok: true, apartment_id: apt && apt.id, date });
  } catch (e) {
    return out(500, { error: String(e.message || e) });
  }
};
