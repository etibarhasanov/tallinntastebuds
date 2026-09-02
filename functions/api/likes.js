/**
 * Tallinn Tastebuds — the likes.
 *
 * Two things live at /api/likes: GET hands back how many people have liked
 * each place, POST records or withdraws one. They are the only way anything
 * outside Cloudflare can reach the database, which is the whole security
 * story: D1 has no public endpoint of its own. There is no host, no port and
 * no connection string a stranger can point a tool at. It is reachable from a
 * Worker holding a binding to it, or from the Cloudflare API with the
 * account's own credentials, and from nowhere else. So the attack surface of
 * the database is exactly this file.
 *
 * Which is why this file is written the way it is:
 *
 *   - Every query is a prepared statement with bound parameters. No value
 *     from a request is ever concatenated into SQL. That is the whole of the
 *     injection defence and it is not negotiable.
 *   - The only DELETE takes a client id as well as a place, so it can only
 *     ever remove the caller's own row. Guessing somebody else's would mean
 *     guessing a v4 UUID.
 *   - A place id that is not in data/restaurants.json is refused, so nobody
 *     can fill the table with rows for places that do not exist.
 *   - Nothing personal is stored. Not the IP, not the user agent — only an
 *     HMAC of them under a secret that never leaves the environment, which is
 *     one-way and useless to anybody who does not hold the secret.
 *
 * WHAT A LIKE IS TIED TO
 *
 * There are no accounts here and no cookies, so "one person" has to be
 * approximated, and it is approximated twice over:
 *
 *   client_id  a random UUID the browser keeps in localStorage. It is what
 *              makes the heart still look liked when you come back, and the
 *              UNIQUE key that stops the same browser liking twice. It is
 *              also client-supplied, so it is a convenience, not a defence:
 *              anybody can send a fresh one.
 *
 *   ip_hash    HMAC(secret, ip + user agent). This is the part that cannot
 *              be forged from a browser, and it backs a CAP rather than a
 *              second unique key. That distinction is the important one —
 *              see the note on the cap below.
 *
 * Neither is proof of a person and this file does not pretend otherwise. The
 * README has the honest write-up of what that means.
 */

/* How many likes for one place may come from a single network fingerprint.
 *
 * A cap, deliberately, and not "one like per IP". Estonian mobile carriers
 * put thousands of phones behind one public address, and this site is opened
 * from an Instagram link on a phone more than anywhere else — so a hard
 * per-IP rule would let the first Elisa customer like a bakery and silently
 * refuse every other Elisa customer in the country. Folding the user agent in
 * separates most of them again, and a cap of five leaves room for a household,
 * a table of friends and the handful of identical phones that will still
 * collide, while the tenth attempt from one fingerprint on one place is the
 * clear-your-storage-and-do-it-again loop this is here to stop.
 */
const PER_PLACE_CAP = 5;

/* The list of real places, kept for five minutes per isolate. It comes from
   the deployed data/restaurants.json rather than a copy in here, so adding a
   place to the map is all it takes for likes to work on it. */
let known = null;
let knownAt = 0;

async function knownPlaces(context) {
  if (known && Date.now() - knownAt < 300000) return known;
  const url = new URL('/data/restaurants.json', context.request.url);
  /* env.ASSETS reads the deployment's own static files without going back out
     to the network. Plain fetch is the fallback for `wrangler pages dev`. */
  const res = context.env.ASSETS
    ? await context.env.ASSETS.fetch(new Request(url.toString()))
    : await fetch(url.toString());
  if (!res.ok) throw new Error('restaurants.json unreadable: ' + res.status);
  const places = await res.json();
  known = new Set(places.map((p) => p.id));
  knownAt = Date.now();
  return known;
}

/* One-way, and salted with a secret that lives in the Pages environment. The
   raw IP never reaches the database, so a copy of the table tells nobody
   where anybody was. */
async function fingerprint(secret, ip, ua) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(ip + '|' + ua));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/* Turnstile is the only layer here that stops a script rather than a person,
   and it is optional: with no secret set the check is skipped and the other
   layers carry the feature on their own. Set TURNSTILE_SECRET and it comes on
   with no other change. */
async function challengePassed(secret, token, ip) {
  if (!secret) return true;
  if (!token) return false;
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form
    });
    const out = await res.json();
    return out.success === true;
  } catch (e) {
    /* Cloudflare's own verifier being unreachable is not the visitor's fault,
       and refusing every like until it comes back would be a worse outage
       than the one it is protecting against. The cap still applies. */
    return true;
  }
}

function json(body, status, maxAge) {
  const headers = { 'content-type': 'application/json; charset=utf-8' };
  headers['cache-control'] = maxAge
    ? 'public, max-age=' + maxAge
    : 'no-store';
  return new Response(JSON.stringify(body), { status: status || 200, headers });
}

/* ------------------------------------------------------------------ counts
 * Every place's count in one request, so the map asks once on the way in
 * rather than seventy-four times. Held at the edge for a minute: the
 * aggregate runs once per minute per colo however much traffic arrives, and
 * a count that is up to a minute stale is a count nobody can tell from a
 * fresh one. The liker themself never sees the stale copy — the POST hands
 * back the new number directly.
 */
export async function onRequestGet(context) {
  if (!context.env.DB) return json({}, 200, 60);

  const cache = caches.default;
  const key = new Request(new URL('/api/likes', context.request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;

  const { results } = await context.env.DB
    .prepare('SELECT place_id, COUNT(*) AS n FROM likes GROUP BY place_id')
    .all();

  const counts = {};
  for (const row of results) counts[row.place_id] = row.n;

  const res = json(counts, 200, 60);
  context.waitUntil(cache.put(key, res.clone()));
  return res;
}

/* -------------------------------------------------------------- one like
 * { place, client, on, token } in, { place, n, on } back.
 *
 * `on: false` withdraws a like rather than adding one, because the heart is a
 * toggle and a like nobody can take back is a support request waiting to
 * happen. It can only remove a row that carries the caller's own client id.
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DB) {
    return json({ error: 'no-database' }, 503);
  }
  /* Fail closed, and loudly. Without the salt the stored fingerprints would
     be a plain hash of an address, which is guessable given the whole of
     IPv4 — so this refuses to write rather than write something weaker than
     it claims. Set LIKE_SALT in the Pages project and it starts working. */
  if (!env.LIKE_SALT) {
    return json({ error: 'no-salt' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'malformed' }, 400);
  }

  const place = typeof body.place === 'string' ? body.place : '';
  const client = typeof body.client === 'string' ? body.client : '';
  const on = body.on !== false;

  /* A UUID and nothing else. This is a primary-key column, so the shape is
     checked before it is allowed anywhere near the table. */
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(client)) {
    return json({ error: 'client' }, 400);
  }

  let places;
  try {
    places = await knownPlaces(context);
  } catch (e) {
    return json({ error: 'places' }, 503);
  }
  if (!places.has(place)) return json({ error: 'place' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') || '';
  const ua = request.headers.get('User-Agent') || '';

  if (on && !(await challengePassed(env.TURNSTILE_SECRET, body.token, ip))) {
    return json({ error: 'challenge' }, 403);
  }

  const hash = await fingerprint(env.LIKE_SALT, ip, ua);

  if (on) {
    const seen = await env.DB
      .prepare('SELECT COUNT(*) AS n FROM likes WHERE place_id = ? AND ip_hash = ?')
      .bind(place, hash)
      .first();
    /* The caller's own row counts towards this, so somebody who has already
       liked and is pressing again is under the cap and lands on the conflict
       below — which is a no-op, not a rejection. */
    if (seen && seen.n >= PER_PLACE_CAP) {
      const total = await env.DB
        .prepare('SELECT COUNT(*) AS n FROM likes WHERE place_id = ?')
        .bind(place)
        .first();
      return json({ error: 'capped', place: place, n: total ? total.n : 0 }, 429);
    }

    await env.DB
      .prepare(
        'INSERT INTO likes (place_id, client_id, ip_hash, created_at) ' +
        'VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING'
      )
      .bind(place, client, hash, Date.now())
      .run();
  } else {
    await env.DB
      .prepare('DELETE FROM likes WHERE place_id = ? AND client_id = ?')
      .bind(place, client)
      .run();
  }

  const total = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM likes WHERE place_id = ?')
    .bind(place)
    .first();

  return json({ place: place, n: total ? total.n : 0, on: on }, 200);
}
