// RC Webhook — receives booking data from RealtyCalendar and saves to Supabase
// URL: https://urbanluxe.cc/.netlify/functions/rc-webhook
// Add this URL to RealtyCalendar → Настройки → Интеграции → Webhooks

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    // Parse incoming data from RealtyCalendar
    let data;
    const contentType = event.headers['content-type'] || '';
    
    if (contentType.includes('application/json')) {
      data = JSON.parse(event.body);
    } else if (contentType.includes('form-urlencoded')) {
      // RC might send as form data
      const params = new URLSearchParams(event.body);
      data = Object.fromEntries(params);
    } else {
      // Try JSON first, then form data
      try {
        data = JSON.parse(event.body);
      } catch {
        const params = new URLSearchParams(event.body);
        data = Object.fromEntries(params);
      }
    }

    // Log raw data for debugging (first few webhooks)
    console.log('RC WEBHOOK RAW:', JSON.stringify(data));
    console.log('RC WEBHOOK HEADERS:', JSON.stringify(event.headers));

    // Map RC source emails to platform names
    const sourceMap = {
      'airbnb@realtycalendar.ru': 'airbnb',
      'airbnb': 'airbnb',
      'booking_com@tutt.ru': 'booking',
      'booking.com': 'booking',
      'booking': 'booking',
      'ostrovok_ru@tutt.ru': 'ostrovok',
      'ostrovok': 'ostrovok',
      'sutochno_ru@tutt.ru': 'sutochno',
      'sutochno': 'sutochno',
      'tvil@realtycalendar.ru': 'tvil',
      'yandextravel@realtycalendar.ru': 'yandex',
      'yandex': 'yandex',
      '101hotels': '101hotels',
    };

    // Map apartment names from RC to our apartment_id format
    // RC uses names like K_10_49, NO_3В_15, U_13_207
    const aptMap = {
      'K_10_49': 'kislorod_49', 'K_11_58': 'kislorod_58', 'K_13_128': 'kislorod_128',
      'MA_8_111': 'mirabad_111', 'MA_8_205': 'mirabad_205',
      'NO_3В_15': 'nest_15', 'NO_3B_15': 'nest_15', 'NO_12_233': 'nest_233',
      'NO_13_249': 'nest_249', 'NO_18_353': 'nest_353', 'NO_25_481': 'nest_481',
      'U_3_5': 'utower_5', 'U_4_9': 'utower_9', 'U_6_65': 'utower_65',
      'U_6_73': 'utower_73', 'U_7_92': 'utower_92', 'U_11_171': 'utower_171',
      'U_13_207': 'utower_207', 'U_13_208': 'utower_208', 'U_13_228': 'utower_228',
      'U_17_296': 'utower_296', 'U_18_310': 'utower_310', 'U_24_410': 'utower_410',
    };

    // Extract booking details - try different possible field names from RC
    const booking = {
      rc_id: data.id || data.booking_id || data.reservation_id || null,
      apartment_rc: data.apartment || data.apartment_name || data.object || data.object_name || data.lot || null,
      guest_name: data.guest_name || data.client_name || data.name || data.fio || data.contacts?.split('\n')?.[0] || null,
      guest_phone: data.guest_phone || data.phone || data.tel || data.contacts?.split('\n')?.[1] || null,
      guest_email: data.guest_email || data.email || null,
      check_in: data.check_in || data.checkin || data.date_from || data.arrival || null,
      check_out: data.check_out || data.checkout || data.date_to || data.departure || null,
      total_price: parseFloat(data.total_price || data.price || data.sum || data.amount || 0),
      source: data.source || data.manager || data.channel || 'realtycalendar',
      guests_count: parseInt(data.guests || data.guests_count || data.persons || 1),
      status: data.status || 'confirmed',
      notes: data.notes || data.comment || data.description || '',
    };

    // Resolve source to our format
    const srcLower = (booking.source || '').toLowerCase();
    booking.source = sourceMap[srcLower] || sourceMap[booking.source] || 
      (srcLower.includes('airbnb') ? 'airbnb' : 
       srcLower.includes('booking') ? 'booking' : 
       srcLower.includes('ostrovok') ? 'ostrovok' :
       srcLower.includes('sutochno') ? 'sutochno' :
       srcLower.includes('yandex') ? 'yandex' : 'other');

    // Resolve apartment_id
    let apartment_id = null;
    if (booking.apartment_rc) {
      apartment_id = aptMap[booking.apartment_rc] || null;
      if (!apartment_id) {
        // Try to extract apartment number from name
        const numMatch = booking.apartment_rc.match(/(\d+)$/);
        if (numMatch) {
          const num = numMatch[1];
          const prefix = booking.apartment_rc.toLowerCase();
          if (prefix.includes('k_') || prefix.includes('kislorod')) apartment_id = 'kislorod_' + num;
          else if (prefix.includes('ma_') || prefix.includes('mirabad')) apartment_id = 'mirabad_' + num;
          else if (prefix.includes('no_') || prefix.includes('nest')) apartment_id = 'nest_' + num;
          else if (prefix.includes('u_') || prefix.includes('utower')) apartment_id = 'utower_' + num;
        }
      }
    }

    // Save to Supabase
    const sbUrl = process.env.SUPABASE_URL || 'https://sebvfvtofiysbywxjqut.supabase.co';
    const sbKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
    
    if (sbKey && apartment_id) {
      const sb = createClient(sbUrl, sbKey);
      
      const { data: inserted, error } = await sb.from('bookings').upsert({
        apartment_id: apartment_id,
        guest_name: booking.guest_name || 'Гость RC',
        guest_phone: booking.guest_phone || '',
        guest_email: booking.guest_email || '',
        check_in: booking.check_in,
        check_out: booking.check_out,
        total_price: booking.total_price,
        source: booking.source,
        status: booking.status === 'cancelled' ? 'cancelled' : 'confirmed',
        admin_notes: `RC#${booking.rc_id || '?'} | ${booking.notes}`.trim(),
      }, {
        onConflict: 'apartment_id,check_in'
      });

      if (error) {
        console.log('Supabase insert error:', error.message);
      } else {
        console.log('Saved booking to Supabase:', apartment_id, booking.check_in);
      }
    }

    // Send Telegram notification
    const tgToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN;
    const tgChat = process.env.TELEGRAM_CHAT_ID || process.env.TG_CHAT_ID;
    if (tgToken && tgChat) {
      const srcIcons = {airbnb:'🏠',booking:'📘',ostrovok:'🟢',sutochno:'🔵',yandex:'🟡','101hotels':'🏨',other:'📋'};
      const msg = `📥 *Новая бронь из RealtyCalendar*\n\n` +
        `${srcIcons[booking.source]||'📋'} *${booking.source.toUpperCase()}*\n` +
        `🏠 ${booking.apartment_rc || apartment_id || '?'}\n` +
        `👤 ${booking.guest_name || '—'}\n` +
        `📅 ${booking.check_in} → ${booking.check_out}\n` +
        `💰 $${booking.total_price || '—'}\n` +
        `👥 Гостей: ${booking.guests_count}\n` +
        (booking.guest_phone ? `📱 ${booking.guest_phone}\n` : '');
      
      try {
        await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: tgChat,
            text: msg,
            parse_mode: 'Markdown'
          })
        });
      } catch (tgErr) {
        console.log('Telegram send error:', tgErr.message);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Booking received',
        apartment_id,
        rc_id: booking.rc_id,
        raw_fields: Object.keys(data)
      })
    };

  } catch (err) {
    console.error('RC Webhook error:', err);
    return {
      statusCode: 200, // Return 200 even on error so RC doesn't retry
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
