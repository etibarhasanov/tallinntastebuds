/**
 * Tallinn Tastebuds — the pieces both API routes need.
 *
 * Underscore-prefixed files under functions/ are not routed, so this is a
 * module and never an endpoint. Everything here is shared by /api/saves and
 * /api/account. Two things at the bottom hold a value between requests — the
 * list of real places and which database this deployment is holding — and
 * both are caches of something that does not change, kept per isolate and
 * re-asked every five minutes. Nothing else here remembers anything.
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
 * On the number: OWASP's recommendation for PBKDF2-SHA256 is considerably
 * higher than this, and the ceiling here is not security but Cloudflare's CPU
 * budget — the Workers free plan allows 10ms per request and a derive at
 * OWASP's number takes an order of magnitude more than that. 100k is the
 * compromise: far past the point where a leaked table is trivially reversed,
 * and survivable inside a free-plan request. If sign-in ever starts returning
 * CPU-limit errors, this is the number to lower — or the cue to move to the
 * paid Workers plan and raise it instead. Nothing here holds anything more
 * sensitive than a list of restaurants somebody liked the look of.
 */
export const PW_ITERATIONS = 100000;

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

/* ------------------------------------------------- which database is this
 * The preview deployments and the live site run the same code against two
 * different D1 databases — `tallinntastebuds-preview` and `tallinntastebuds`
 * — and wrangler.toml is what keeps them apart. This is what notices when it
 * has not.
 *
 * Two halves have to agree. The deployment carries an ENVIRONMENT variable
 * out of wrangler.toml, saying which half of the split it belongs to; the
 * database carries a meta row saying which one it was stamped as. A preview
 * holding the live database disagrees with it, and this shuts the API down
 * rather than let a save pressed while checking a change land in the live
 * counts — the counts simply do not appear, which is a state the site already
 * handles, instead of a test row nobody can pick out of the table afterwards.
 *
 * It only ever blocks a disagreement. An unstamped database, or a deployment
 * with no ENVIRONMENT set, means the check cannot tell what it is looking at,
 * and refusing to run on a missing row would be a worse failure than the one
 * this guards against.
 *
 * One read per isolate rather than one per request: the answer is a property
 * of the binding, which cannot change under a running isolate, and the five
 * minutes are only so a database restamped by hand is picked up without a
 * redeploy.
 */
let stamp = null;
let stampAt = 0;

export async function wrongDatabase(env) {
  const expected = env.ENVIRONMENT || '';
  if (!env.DB || !expected) return false;

  if (stamp === null || Date.now() - stampAt > 300000) {
    try {
      const row = await env.DB
        .prepare("SELECT value FROM meta WHERE key = 'environment'")
        .first();
      stamp = row && typeof row.value === 'string' ? row.value : '';
    } catch (e) {
      /* No meta table at all: a database from before the split. Unknowable,
         so not blocked — and re-asked in five minutes rather than never, so
         applying db/schema.sql to it is enough to switch the check on. */
      stamp = '';
    }
    stampAt = Date.now();
  }

  return stamp !== '' && stamp !== expected;
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
