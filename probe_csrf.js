const http = require('http');

function httpRequest(opts, postBody, extraHeaders) {
  return new Promise((resolve, reject) => {
    if (extraHeaders) opts.headers = { ...(opts.headers || {}), ...extraHeaders };
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    if (postBody) req.write(postBody);
    req.end();
  });
}

async function main() {
  // Step 1: GET /api/auth/csrf - let cookie jar handle duplicates (last wins)
  const csrf = await httpRequest({ hostname:'localhost', port:3000, path:'/api/auth/csrf', method:'GET' });

  const rawToken = JSON.parse(csrf.body).csrfToken;
  const setCookies = csrf.headers['set-cookie'] || [];

  // Build cookie jar - last value wins for duplicate names (browser behavior)
  const jar = {};
  for (const sc of setCookies) {
    const [kv] = sc.split(';');
    const eqIdx = kv.indexOf('=');
    const name = kv.substring(0, eqIdx).trim();
    const value = kv.substring(eqIdx + 1).trim();
    jar[name] = value;
  }

  console.log('Cookie jar:', JSON.stringify(jar, null, 2));
  console.log('Raw CSRF token from JSON:', rawToken);

  // Verify token matches cookie (URL-decoded first part before |)
  const csrfCookieEncoded = jar['authjs.csrf-token'];
  const csrfCookieDecoded = decodeURIComponent(csrfCookieEncoded);
  const [cookieToken, cookieHash] = csrfCookieDecoded.split('|');
  console.log('Cookie token part:', cookieToken);
  console.log('Cookie hash part:', cookieHash);
  console.log('Tokens match:', rawToken === cookieToken);

  const cookieHeader = Object.entries(jar).map(([k,v]) => k + '=' + v).join('; ');
  console.log('Cookie header to send:', cookieHeader);

  const formBody = new URLSearchParams({
    email: 'admin@acme.com',
    password: 'Password123!',
    csrfToken: rawToken,
    callbackUrl: 'http://localhost:3000',
    json: 'true'
  }).toString();

  console.log('\nForm body:', formBody);

  const result = await httpRequest({
    hostname: 'localhost', port: 3000,
    path: '/api/auth/callback/credentials',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(formBody),
    }
  }, formBody, { Cookie: cookieHeader });

  console.log('\n=== POST /api/auth/callback/credentials ===');
  console.log('Status:', result.status);
  console.log('Location:', result.headers['location']);
  const cookies = result.headers['set-cookie'] || [];
  console.log('All Set-Cookie headers:', JSON.stringify(cookies, null, 2));
  const sessionCookie = cookies.find(c => c.includes('session-token'));
  console.log('Session token cookie:', sessionCookie || 'NOT SET');
}

main().catch(console.error);
