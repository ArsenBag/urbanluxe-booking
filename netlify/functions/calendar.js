const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function formatDate(dateStr) {
    return dateStr.replace(/-/g, '');
}

function generateUID(id) {
    return `${id}@urbanluxe.uz`;
}

exports.handler = async (event) => {
    const aptId = event.queryStringParameters?.apt;

  if (!aptId) {
    return {
      statusCode: 400,
      body: 'Missing apt parameter'
};
}

  try {
    // Get confirmed bookings for this apartment
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, guest_name, check_in, check_out, status')
      .eq('apartment_id', aptId)
      .in('status', ['confirmed', 'pending'])
      .order('check_in', { ascending: true });

    if (error) throw error;

    // Get apartment info
    const { data: apt } = await supabase
      .from('apartments')
      .select('name, complex')
      .eq('id', aptId)
      .single();

    const aptName = apt ? `${apt.complex} - ${apt.name}` : aptId;
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    // Build iCal
    let ical = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Urban Luxe//Booking Calendar//RU',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${aptName}`,
      'X-WR-TIMEZONE:Asia/Tashkent',
    ];

    for (const booking of bookings || []) {
      ical = ical.concat([
                'BEGIN:VEVENT',
                `UID:${generateUID(booking.id)}`,
                `DTSTAMP:${now}`,
                `DTSTART;VALUE=DATE:${formatDate(booking.check_in)}`,
                `DTEND;VALUE=DATE:${formatDate(booking.check_out)}`,
                `SUMMARY:Занято`,
                `STATUS:${booking.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE'}`,
                'END:VEVENT',
              ]);
                         }

    ical.push('END:VCALENDAR');

    return {
            statusCode: 200,
            headers: {
              'Content-Type': 'text/calendar; charset=utf-8',
                        'Content-Disposition': `attachment; filename="${aptId}.ics"`,
                        'Cache-Control': 'no-cache, no-store',
                        'Access-Control-Allow-Origin': '*',
                },
                      body: ical.join('\r\n'),
                        };

                                                       } catch (err) {
    console.error('Calendar error:', err);
    return { statusCode: 500, body: 'Server error' };
}
};
