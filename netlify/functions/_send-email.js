// Универсальный отправитель email через Resend.
// Возвращает {sent: true} если отправка прошла или {sent: false, reason: '...'} если нет.
// НЕ кидает ошибку наверх — email опциональный, бронирование/отмена не должны падать из-за него.

const https = require('https');

function httpsRequest(url, options, postData) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'POST',
      headers: options.headers || {},
    };
    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'Urban Luxe <onboarding@resend.dev>';

  if (!apiKey) {
    console.warn('[EMAIL] RESEND_API_KEY не настроен — пропускаю отправку. Письмо для:', to);
    return { sent: false, reason: 'RESEND_API_KEY not configured' };
  }
  if (!to) {
    return { sent: false, reason: 'no recipient' };
  }

  const payload = JSON.stringify({
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html: html || undefined,
    text: text || undefined,
  });

  try {
    const res = await httpsRequest(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': String(Buffer.byteLength(payload)),
        },
      },
      payload
    );
    if (res.statusCode >= 400) {
      console.error('[EMAIL] Resend error', res.statusCode, res.body.slice(0, 300));
      return { sent: false, reason: `resend ${res.statusCode}`, body: res.body };
    }
    console.log('[EMAIL] Sent to', to, 'status', res.statusCode);
    return { sent: true };
  } catch (e) {
    console.error('[EMAIL] Exception:', e.message);
    return { sent: false, reason: e.message };
  }
}

// Шаблон письма с кодом отмены
function cancelCodeEmail({ guestName, bookingRef, code, apartmentName, checkIn, checkOut }) {
  const subject = `Код подтверждения отмены · ${bookingRef}`;
  const text =
    `Здравствуйте${guestName ? ', ' + guestName : ''}!\n\n` +
    `Вы запросили отмену бронирования ${bookingRef}\n` +
    `${apartmentName}, ${checkIn} – ${checkOut}\n\n` +
    `Код подтверждения: ${code}\n` +
    `Срок действия: 15 минут\n\n` +
    `Если вы не запрашивали отмену — просто проигнорируйте это письмо.\n\n` +
    `Urban Luxe · urbanluxe.cc`;

  const html = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#090807;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#ede8df">
  <div style="max-width:560px;margin:0 auto;padding:48px 32px">
    <div style="font-family:Georgia,serif;font-size:28px;color:#c9a961;letter-spacing:.15em;margin-bottom:32px;text-align:center">URBAN LUXE</div>
    <h1 style="font-family:Georgia,serif;font-weight:300;font-size:24px;margin:0 0 16px">Код подтверждения отмены</h1>
    <p style="color:#a09888;font-size:15px;line-height:1.6;margin:0 0 24px">
      Здравствуйте${guestName ? ', <strong style="color:#ede8df">' + guestName + '</strong>' : ''}!<br>
      Вы запросили отмену бронирования <strong style="color:#c9a961">${bookingRef}</strong>.
    </p>
    <div style="background:#171512;border:1px solid rgba(201,169,97,.15);border-radius:12px;padding:24px;margin:24px 0">
      <div style="font-size:13px;color:#a09888;margin-bottom:8px">${apartmentName}</div>
      <div style="font-size:13px;color:#a09888">${checkIn} → ${checkOut}</div>
    </div>
    <div style="background:rgba(201,169,97,.08);border:1px solid #c9a961;border-radius:12px;padding:32px;text-align:center;margin:24px 0">
      <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#a09888;margin-bottom:12px">Ваш код</div>
      <div style="font-size:42px;font-weight:300;letter-spacing:.3em;color:#c9a961;font-family:Georgia,serif">${code}</div>
      <div style="font-size:12px;color:#635c52;margin-top:12px">Действителен 15 минут</div>
    </div>
    <p style="color:#635c52;font-size:13px;line-height:1.6;margin:32px 0 0">
      Если вы не запрашивали отмену — просто проигнорируйте это письмо. Бронирование останется активным.
    </p>
    <div style="margin-top:48px;padding-top:24px;border-top:1px solid rgba(201,169,97,.1);text-align:center;font-size:12px;color:#635c52">
      Urban Luxe · <a href="https://urbanluxe.cc" style="color:#c9a961;text-decoration:none">urbanluxe.cc</a>
    </div>
  </div>
</body></html>`;

  return { subject, text, html };
}

// Шаблон письма-подтверждения брони
function bookingConfirmEmail({ guestName, bookingRef, apartmentName, checkIn, checkOut, nights, total }) {
  const subject = `Заявка получена · ${bookingRef}`;
  const text =
    `Здравствуйте${guestName ? ', ' + guestName : ''}!\n\n` +
    `Ваша заявка на бронирование принята.\n\n` +
    `Номер брони: ${bookingRef}\n` +
    `${apartmentName}\n${checkIn} – ${checkOut} (${nights} ноч.)\n` +
    `Сумма: $${total}\n\n` +
    `Мы свяжемся с вами для подтверждения в течение часа.\n\n` +
    `Управление бронированием: https://urbanluxe.cc/cancel.html?ref=${bookingRef}\n\n` +
    `Urban Luxe · urbanluxe.cc`;

  const html = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#090807;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#ede8df">
  <div style="max-width:560px;margin:0 auto;padding:48px 32px">
    <div style="font-family:Georgia,serif;font-size:28px;color:#c9a961;letter-spacing:.15em;margin-bottom:32px;text-align:center">URBAN LUXE</div>
    <h1 style="font-family:Georgia,serif;font-weight:300;font-size:24px;margin:0 0 16px">Заявка получена</h1>
    <p style="color:#a09888;font-size:15px;line-height:1.6">
      Здравствуйте${guestName ? ', <strong style="color:#ede8df">' + guestName + '</strong>' : ''}!<br>
      Ваша заявка на бронирование принята. Мы свяжемся с вами для подтверждения в течение часа.
    </p>
    <div style="background:#171512;border:1px solid rgba(201,169,97,.15);border-radius:12px;padding:24px;margin:24px 0">
      <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#a09888;margin-bottom:8px">Номер бронирования</div>
      <div style="font-size:24px;color:#c9a961;font-family:Georgia,serif;letter-spacing:.1em;margin-bottom:20px">${bookingRef}</div>
      <div style="font-size:16px;color:#ede8df;margin-bottom:6px">${apartmentName}</div>
      <div style="font-size:13px;color:#a09888;margin-bottom:16px">${checkIn} → ${checkOut} · ${nights} ноч.</div>
      <div style="border-top:1px solid rgba(201,169,97,.1);padding-top:16px;display:flex;justify-content:space-between">
        <span style="color:#a09888;font-size:13px">Сумма</span>
        <span style="color:#c9a961;font-size:18px">$${total}</span>
      </div>
    </div>
    <div style="text-align:center;margin:32px 0">
      <a href="https://urbanluxe.cc/cancel.html?ref=${bookingRef}" style="color:#a09888;font-size:13px;text-decoration:underline">Управление бронированием</a>
    </div>
    <div style="margin-top:48px;padding-top:24px;border-top:1px solid rgba(201,169,97,.1);text-align:center;font-size:12px;color:#635c52">
      Urban Luxe · <a href="https://urbanluxe.cc" style="color:#c9a961;text-decoration:none">urbanluxe.cc</a>
    </div>
  </div>
</body></html>`;

  return { subject, text, html };
}

module.exports = { sendEmail, cancelCodeEmail, bookingConfirmEmail };
