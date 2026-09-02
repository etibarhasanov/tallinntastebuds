/**
 * Tallinn Tastebuds — the saves.
 *
 * Two things live at /api/saves: GET hands back how many people have saved
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
 * WHAT A SAVE IS TIED TO
 *
 * There are no accounts here and no cookies, so "one person" has to be
 * approximated, and it is approximated twice over:
 *
 *   client_id  a random UUID the browser keeps in localStorage. It is what
 *              makes the heart still look saved when you come back, and the
 *              UNIQUE key that stops the same browser saving twice. It is
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

/* How many saves for one place may come from a single network fingerprint.
 *
 * A cap, deliberately, and not "one save per IP". Estonian mobile carriers
 * put thousands of phones behind one public address, and this site is opened
 * from an Instagram link on a phone more than anywhere else — so a hard
 * per-IP rule would let the first Elisa customer save a bakery and silently
 * refuse every other Elisa customer in the country. Folding the user agent in
 * separates most of them again, and a cap of five leaves room for a household,
 * a table of friends and the handful of identical phones that will still
 * collide, while the tenth attempt from one fingerprint on one place is the
 * clear-your-storage-and-do-it-again loop this is here to stop.
 */
const PER_PLACE_CAP = 5;

/* The list of real places, kept for five minutes per isolate. It comes from
   the deployed data/restaurants.json rather than a copy in here, so adding a
   place to the map is all it takes for saves to work on it. */
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
       and refusing every save until it comes back would be a worse outage
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
 * rather than seventy-four times.
 *
 * This reads save_counts and never aggregates. The obvious way to answer
 * "how many saves has each place got" is COUNT(*) GROUP BY over the saves
 * table, and that was the first version of this — but its cost grows with
 * the data forever: ten thousand saves means reading ten thousand rows to
 * produce seventy-four numbers, on every cache miss, for a table that only
 * ever gets bigger. save_counts is one row per place, so this read is capped
 * at the number of places on the map no matter how popular the map gets, and
 * the count is brought up to date by the write that changed it rather than by
 * a query that runs on a timer. See the POST for how it is kept true.
 *
 * Two layers of not-fetching sit on top of that:
 *
 *   ETag        the answer carries one, so a browser that already has the
 *               counts sends If-None-Match and gets 304 and no body back
 *               when nothing has changed since. This is the part that is
 *               genuinely driven by changes rather than by a clock.
 *
 *   edge cache  a copy in the colo, deleted by any save that lands in that
 *               same colo, so a visitor there sees the new number at once.
 *               The TTL below is only a backstop for the other colos: the
 *               Cache API is per-location and a purge in Frankfurt cannot
 *               reach into Warsaw, so without it a colo that never sees a
 *               write would hold its copy indefinitely.
 */
const COUNTS_TTL = 60;

function countsKey(request) {
  return new Request(new URL('/api/saves', request.url).toString());
}

export async function onRequestGet(context) {
  if (!context.env.DB) return json({}, 200, COUNTS_TTL);

  const cache = caches.default;
  const key = countsKey(context.request);
  const hit = await cache.match(key);
  if (hit) return withNotModified(context.request, hit);

  /* Only the places somebody has actually saved. A row at zero is a place
     that was saved and then unsaved, and the client draws nothing at zero
     anyway, so sending it is bytes for no one. */
  const { results } = await context.env.DB
    .prepare('SELECT place_id, n FROM save_counts WHERE n > 0')
    .all();

  const counts = {};
  for (const row of results) counts[row.place_id] = row.n;

  const body = JSON.stringify(counts);
  const res = new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=' + COUNTS_TTL,
      etag: await weakTag(body)
    }
  });
  context.waitUntil(cache.put(key, res.clone()));
  return withNotModified(context.request, res);
}

/* A hash of the answer itself, so the tag changes when and only when the
   numbers do. No version column to keep in step with anything. */
async function weakTag(body) {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return 'W/"' + hex.slice(0, 16) + '"';
}

function withNotModified(request, res) {
  const tag = res.headers.get('etag');
  if (tag && request.headers.get('if-none-match') === tag) {
    return new Response(null, {
      status: 304,
      headers: { etag: tag, 'cache-control': res.headers.get('cache-control') }
    });
  }
  return res;
}

/* -------------------------------------------------------------- one save
 * { place, client, on, token } in, { place, n, on } back.
 *
 * `on: false` withdraws a save rather than adding one, because the heart is a
 * toggle and a save nobody can take back is a support request waiting to
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
     it claims. Set SAVE_SALT in the Pages project and it starts working. */
  if (!env.SAVE_SALT) {
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

  const hash = await fingerprint(env.SAVE_SALT, ip, ua);

  /* save_counts is brought level with saves in the same batch that changes
     them, and it is recomputed from the saves table rather than nudged up or
     down by one. A blind +1 would be cheaper and would drift the first time
     an insert quietly hit the conflict clause and the increment did not; this
     cannot drift, because it takes its answer from the rows themselves. The
     count is over one place's saves, which the primary key leads with, so it
     is an index range and not a scan of the table.

     batch() is one transaction: either the save and its count both land or
     neither does. There is no window in which the number on the map is a
     number the rows do not agree with. */
  const recount =
    'INSERT INTO save_counts (place_id, n) ' +
    'VALUES (?, (SELECT COUNT(*) FROM saves WHERE place_id = ?)) ' +
    'ON CONFLICT(place_id) DO UPDATE SET n = excluded.n';

  if (on) {
    const seen = await env.DB
      .prepare('SELECT COUNT(*) AS n FROM saves WHERE place_id = ? AND ip_hash = ?')
      .bind(place, hash)
      .first();
    /* The caller's own row counts towards this, so somebody who has already
       saved and is pressing again is under the cap and lands on the conflict
       below — which is a no-op, not a rejection. */
    if (seen && seen.n >= PER_PLACE_CAP) {
      const held = await env.DB
        .prepare('SELECT n FROM save_counts WHERE place_id = ?')
        .bind(place)
        .first();
      return json({ error: 'capped', place: place, n: held ? held.n : 0 }, 429);
    }

    await env.DB.batch([
      env.DB
        .prepare(
          'INSERT INTO saves (place_id, client_id, ip_hash, created_at) ' +
          'VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING'
        )
        .bind(place, client, hash, Date.now()),
      env.DB.prepare(recount).bind(place, place)
    ]);
  } else {
    await env.DB.batch([
      env.DB
        .prepare('DELETE FROM saves WHERE place_id = ? AND client_id = ?')
        .bind(place, client),
      env.DB.prepare(recount).bind(place, place)
    ]);
  }

  const total = await env.DB
    .prepare('SELECT n FROM save_counts WHERE place_id = ?')
    .bind(place)
    .first();

  /* The copy this colo is handing out is now wrong, so it goes. Only this
     colo's — the Cache API is per-location — but this is the one a visitor
     who just saved something is most likely to be served by, and everywhere
     else has the TTL as a backstop. Not awaited: the answer below does not
     depend on it. */
  context.waitUntil(caches.default.delete(countsKey(request)));

  return json({ place: place, n: total ? total.n : 0, on: on }, 200);
}
