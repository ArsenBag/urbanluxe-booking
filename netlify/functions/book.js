const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
    );

    const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    async function sendTelegram(message) {
      if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' })
                      });
                      }

                      exports.handler = async (event) => {
                        const headers = {
                            'Access-Control-Allow-Origin': '*',
                                'Access-Control-Allow-Headers': 'Content-Type',
                                    'Content-Type': 'application/json'
                                      };

                                        if (event.httpMethod === 'OPTIONS') {
                                            return { statusCode: 200, headers, body: '' };
                                              }

                                                if (event.httpMethod !== 'POST') {
                                                    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
                                                      }

                                                        try {
                                                            const body = JSON.parse(event.body);
                                                                const { apartment_id, guest_name, guest_phone, guest_email, check_in, check_out, guests_count } = body;

                                                                    if (!apartment_id || !guest_name || !guest_phone || !check_in || !check_out) {
                                                                          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
                                                                              }

                                                                                  // Check for conflicts
                                                                                      const { data: conflicts } = await supabase
                                                                                            .from('bookings')
                                                                                                  .select('id')
                                                                                                        .eq('apartment_id', apartment_id)
                                                                                                              .eq('status', 'confirmed')
                                                                                                                    .or(`check_in.lte.${check_out},check_out.gte.${check_in}`);
                                                                                                                    
                                                                                                                        if (conflicts && conflicts.length > 0) {
                                                                                                                              return { statusCode: 409, headers, body: JSON.stringify({ error: 'Dates not available' }) };
                                                                                                                                  }
                                                                                                                                  
                                                                                                                                      // Save booking
                                                                                                                                          const { data: booking, error } = await supabase
                                                                                                                                                .from('bookings')
                                                                                                                                                      .insert([{ apartment_id, guest_name, guest_phone, guest_email, check_in, check_out, guests_count: guests_count || 1, status: 'pending', source: 'website' }])
                                                                                                                                                            .select()
                                                                                                                                                                  .single();
                                                                                                                                                                  
                                                                                                                                                                      if (error) throw error;
                                                                                                                                                                      
                                                                                                                                                                          // Get apartment info
                                                                                                                                                                              const { data: apt } = await supabase
                                                                                                                                                                                    .from('apartments')
                                                                                                                                                                                          .select('name, complex, block, floor')
                                                                                                                                                                                                .eq('id', apartment_id)
                                                                                                                                                                                                      .single();
                                                                                                                                                                                                      
                                                                                                                                                                                                          // Send Telegram notification
                                                                                                                                                                                                              const msg = `🏠 <b>Новая бронь!</b>
                                                                                                                                                                                                              
                                                                                                                                                                                                              📍 <b>${apt?.complex || ''} ${apt?.block || ''}</b> — ${apt?.name || apartment_id}
                                                                                                                                                                                                              🔢 Этаж: ${apt?.floor || '—'}
                                                                                                                                                                                                              
                                                                                                                                                                                                              👤 Гость: <b>${guest_name}</b>
                                                                                                                                                                                                              📱 Телефон: <b>${guest_phone}</b>
                                                                                                                                                                                                              ${guest_email ? `📧 Email: ${guest_email}` : ''}
                                                                                                                                                                                                              👥 Гостей: ${guests_count || 1}
                                                                                                                                                                                                              
                                                                                                                                                                                                              📅 Заезд: <b>${check_in}</b>
                                                                                                                                                                                                              📅 Выезд: <b>${check_out}</b>
                                                                                                                                                                                                              
                                                                                                                                                                                                              ⏳ Статус: ОЖИДАЕТ ПОДТВЕРЖДЕНИЯ
                                                                                                                                                                                                              🔗 ID брони: ${booking.id}`;
                                                                                                                                                                                                              
                                                                                                                                                                                                                  await sendTelegram(msg);
                                                                                                                                                                                                                  
                                                                                                                                                                                                                      return { statusCode: 200, headers, body: JSON.stringify({ success: true, booking_id: booking.id }) };
                                                                                                                                                                                                                      
                                                                                                                                                                                                                        } catch (err) {
                                                                                                                                                                                                                            console.error('Booking error:', err);
                                                                                                                                                                                                                                return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
                                                                                                                                                                                                                                  }
                                                                                                                                                                                                                                  };
