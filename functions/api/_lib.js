/**
 * Tallinn Tastebuds — the pieces both API routes need.
 *
 * Underscore-prefixed files under functions/ are not routed, so this is a
 * module and never an endpoint. Everything here is shared by /api/saves and
 * /api/account, and none of it holds state between requests.
 */

export function json(body, status, maxAge) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': maxAge ? 'public, max-age=' + maxAge : 'no-store'
    }
  });
}

export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || '';
}

export function hex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function randomHex(bytes) {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return hex(b.buffer);
}

export async function sha256Hex(text) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

/* One-way and salted with a secret that lives in the Pages environment. The
   raw address never reaches the database, so a copy of a table tells nobody
   where anybody was. */
export async function fingerprint(secret, ip, ua) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(ip + '|' + ua)));
}

/* ------------------------------------------------------------- passwords
 * PBKDF2-HMAC-SHA256 through WebCrypto, which is what a Worker has: there is
 * no bcrypt or argon2 in this runtime without shipping WASM, and PBKDF2 is
 * the standard, well-reviewed thing that is already here.
 *
 * The iteration count is stored on the row rather than baked in, so it can be
 * raised later and old rows re-hashed on their next successful sign-in
 * without a migration.
 *
 * ON THE NUMBER, WHICH IS A COMPROMISE AND SHOULD BE READ AS ONE
 *
 * The ceiling here is not security, it is Cloudflare's CPU budget. The
 * Workers free plan allows 10ms per request, and PBKDF2-SHA256 measured on a
 * comparable machine costs roughly:
 *
 *     10,000 iterations    ~5ms     fits
 *     50,000               ~25ms    over
 *    100,000               ~49ms    over
 *    210,000 (OWASP)      ~112ms    far over
 *
 * So the default is 10,000: the most that reliably fits, and well below what
 * anybody would recommend in the abstract. What it protects is a username and
 * a list of restaurants — no email, no address, no payment — and it is the
 * difference between a leaked table being readable and being work, not a
 * claim to be proof against a serious attacker.
 *
 * It is deliberately not a constant. Set PW_ITERATIONS in the Pages project
 * to raise it — on the paid plan, where the budget is 30 seconds rather than
 * 10 milliseconds, 210,000 is the number to use. Existing accounts are not
 * stranded by that: each row carries the count its own hash was made with, so
 * old passwords keep verifying, and the sign-in path re-derives a row that is
 * behind the current setting the next time its owner signs in successfully.
 */
const PW_DEFAULT_ITERATIONS = 10000;
const PW_MAX_ITERATIONS = 600000;

export function pwIterations(env) {
  const asked = parseInt((env && env.PW_ITERATIONS) || '', 10);
  if (!asked || asked < 1000) return PW_DEFAULT_ITERATIONS;
  return Math.min(asked, PW_MAX_ITERATIONS);
}

export async function derivePassword(password, saltHex, iterations) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
    key,
    256
  );
  return hex(bits);
}

/* Compares in time that does not depend on where the first difference is, so
   the comparison itself cannot be used to learn the hash one byte at a time. */
export function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* -------------------------------------------------------------- sessions
 * The cookie carries a random token; the database stores only its SHA-256.
 * A leaked copy of the sessions table is then a list of hashes and not a
 * drawer full of working keys.
 *
 * Server-set and HttpOnly for two reasons. Page scripts cannot read it, so
 * nothing on the page can leak somebody's session — and Safari's seven-day
 * cap on script-written storage does not apply to a cookie the server set,
 * which is the difference between a sign-in lasting a week and lasting a
 * year on an iPhone.
 */
export const SESSION_COOKIE = 'ttb_s';
export const SESSION_DAYS = 365;

export function sessionCookie(token, days) {
  const parts = [
    SESSION_COOKIE + '=' + (token || ''),
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=' + (token ? days * 86400 : 0)
  ];
  return parts.join('; ');
}

export function readCookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const at = part.indexOf('=');
    if (at === -1) continue;
    if (part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return '';
}

/* Who is signed in, or null. Every route that can act on somebody's behalf
   goes through this and nothing else — there is no other way to become a
   user in this codebase. */
export async function sessionUser(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;

  const row = await env.DB
    .prepare(
      'SELECT u.id AS id, u.username AS username, s.expires_at AS expires_at ' +
      'FROM sessions s JOIN users u ON u.id = s.user_id ' +
      'WHERE s.token_hash = ?'
    )
    .bind(await sha256Hex(token))
    .first();

  if (!row) return null;
  if (row.expires_at < Date.now()) return null;
  return { id: row.id, username: row.username };
}

/* ---------------------------------------------------------------- places
 * The list of real places, kept for five minutes per isolate. It comes from
 * the deployed data/restaurants.json rather than a copy in here, so adding a
 * place to the map is all it takes for saving to work on it.
 */
let known = null;
let knownAt = 0;

export async function knownPlaces(context) {
  if (known && Date.now() - knownAt < 300000) return known;
  const url = new URL('/data/restaurants.json', context.request.url);
  const res = context.env.ASSETS
    ? await context.env.ASSETS.fetch(new Request(url.toString()))
    : await fetch(url.toString());
  if (!res.ok) throw new Error('restaurants.json unreadable: ' + res.status);
  const places = await res.json();
  known = new Set(places.map((p) => p.id));
  knownAt = Date.now();
  return known;
}

/* save_counts is brought level with saves by the write that changes them, and
   it is recomputed FROM saves rather than nudged by one: an increment that ran
   when an insert had quietly hit its conflict clause would drift, and nothing
   would ever notice. Runs inside the same batch() as the write it follows. */
export const RECOUNT_SQL =
  'INSERT INTO save_counts (place_id, n) ' +
  'VALUES (?, (SELECT COUNT(*) FROM saves WHERE place_id = ?)) ' +
  'ON CONFLICT(place_id) DO UPDATE SET n = excluded.n';

export function countsKey(request) {
  return new Request(new URL('/api/saves', request.url).toString());
}
