const https = require('https');
let sharp;
try { sharp = require('sharp'); } catch(e) { sharp = null; }

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 25000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

exports.handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=31536000, immutable',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const url = event.queryStringParameters?.url;
  const w = parseInt(event.queryStringParameters?.w) || 800;
  
  if (!url || !url.includes('supabase.co')) {
    return { statusCode: 400, headers: CORS, body: 'Invalid URL' };
  }

  try {
    const buf = await fetchBuffer(url);
    
    let output, contentType;
    
    if (sharp) {
      // Resize to w pixels wide, convert to WebP q=80
      output = await sharp(buf)
        .resize(w, null, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      contentType = 'image/webp';
    } else {
      // No sharp — return original
      output = buf;
      contentType = 'image/jpeg';
    }

    // Netlify Functions have 6MB limit
    if (output.length > 5.5 * 1024 * 1024) {
      // Too big even after compression — redirect to original
      return { statusCode: 302, headers: { Location: url, 'Cache-Control': 'public, max-age=86400' }, body: '' };
    }
    
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': contentType },
      body: output.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (e) {
    return { statusCode: 302, headers: { Location: url, 'Cache-Control': 'public, max-age=3600' }, body: '' };
  }
};
