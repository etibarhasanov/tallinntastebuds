/**
 * Tallinn Tastebuds — the pieces both API routes need.
 *
 * Underscore-prefixed files under functions/ are not routed, so this is a
 * module and never an endpoint. Everything here is shared by /api/saves,
 * /api/account and /api/lists. Three things at the bottom hold a value
 * between requests — which database this deployment is holding, the places on
 * the map, and the catalogue a list draws from — and all three are caches of
 * something that only a deploy changes, kept per isolate and re-asked every
 * five minutes. Nothing else here remembers anything.
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

/* ---------------------------------------------------------------- Tallinn
 * The box a point has to fall inside to be one of ours. Roughly 60km around
 * the city, which is generous — it reaches Paldiski and past Kehra — and
 * still refuses a point in another country.
 *
 * It lives here rather than beside either of its users because there are two:
 * /api/lists checks a submitted pin against it, and /api/geocode asks
 * Nominatim to look only inside it. Two copies would be one drifting copy,
 * and the drift would show up as an address the geocoder was happy to find
 * and the save then refused.
 */
export const TALLINN = { lat: 59.437, lng: 24.7536, degLat: 0.55, degLng: 1.1 };

export function nearTallinn(lat, lng) {
  return Math.abs(lat - TALLINN.lat) <= TALLINN.degLat &&
    Math.abs(lng - TALLINN.lng) <= TALLINN.degLng;
}

/* ------------------------------------------------------------- catalogue
 * The other roll of places, and a wider one: data/places.json is the map plus
 * whatever came out of the Google Maps export, and it is what a list draws
 * from. Same five-minute cache per isolate, same reason — it changes when a
 * deploy changes it and not otherwise.
 *
 * A Map of whole entries rather than a Set of ids, because /api/lists answers
 * with the address and the pin as well as the name: a shared list has to draw
 * completely for somebody who has never been here, and making that browser
 * fetch the entire catalogue to render ten rows would be a hundred kilobytes
 * for a page that needs a few hundred bytes of it.
 */
let roll = null;
let rollAt = 0;

export async function catalogue(context) {
  if (roll && Date.now() - rollAt < 300000) return roll;
  const url = new URL('/data/places.json', context.request.url);
  const res = context.env.ASSETS
    ? await context.env.ASSETS.fetch(new Request(url.toString()))
    : await fetch(url.toString());
  if (!res.ok) throw new Error('places.json unreadable: ' + res.status);
  const places = await res.json();
  roll = new Map(places.map((p) => [p.id, p]));
  rollAt = Date.now();
  return roll;
}

/* --------------------------------------------------------------- venues
 * google_venues — the Google Places export, seven hundred and fifty-one places
 * this city can eat in, in the database rather than in a file. See the table in
 * db/schema.sql for why it is a mirror and what the columns mean.
 *
 * The catalogue above is the map plus a hand-kept CSV, and it is small. This
 * is everywhere else, and a list may point at either: a list item's place_id
 * holds a catalogue slug or a Google key, and the two cannot be confused —
 * a slug is lowercase and a Google key always carries capitals.
 *
 * Nothing here is cached the way the catalogue is. The catalogue is a file
 * that changes when a deploy changes it; this is a table, and the two callers
 * that read it ask for a handful of rows by key.
 */

/* Google's category and cuisine, said in the map's own words.
 *
 * The export files a place as "Sushi Restaurant" and "Japanese";
 * data/taxonomy.json calls those `restaurant` and `asian`, and carries both
 * in ten languages. A list row draws the taxonomy ids for the same reason
 * every other visible string on this site comes out of a translated file: a
 * picker that prints Google's English at a Ukrainian reader is the one thing
 * this codebase refuses to do.
 *
 * Only the descriptive half of the taxonomy is reachable from here. `casual`,
 * `date`, `laptop`, `hidden-gem` and `cheap-eats` are verdicts about a place
 * I have eaten at, and no amount of Google's category text is evidence for
 * one. `caucasian` is descriptive and still not in the table: nothing in the
 * export's 751 rows says Georgian or Armenian, so a rule for it would be a
 * line that has never once run.
 *
 * Category, cuisine and the leftover tags are matched as one string, which is
 * what makes "Bar & Grill" both a pub and a restaurant. Counted over the
 * export as it stands: 740 of the 751 rows come out with at least one type,
 * exactly one comes out with four, and the eleven with none are kebab shops,
 * sandwich shops, a theatre and a caterer — which get no types at all rather
 * than a wrong one.
 *
 * Every word below matches at least one of those rows. "Diner", "eatery",
 * "patisserie", "tavern" and "poke" all read like they belong in this table
 * and matched nothing at all, so they are not in it, for the same reason
 * `caucasian` is not: a line that has never run is a line the next person has
 * to work out the intent of. Worth re-measuring against a refreshed export —
 * counting the rows each word is the only match for takes a minute and says
 * which of these have started or stopped earning their place.
 */
const VENUE_TYPES = [
  ['restaurant',  /restaurant|bistro|steak|grill|buffet/],
  ['bakery',      /bakery|pastry|donut|dessert/],
  ['coffee',      /cafe|coffee|tea house|brunch|cafeteria/],
  ['pub',         /\bbar\b|\bpub\b|brewpub|brewery|beer|wine|cocktail/],
  ['asian',       /asian|japanese|sushi|ramen|izakaya|chinese|thai|korean|vietnamese|taiwanese|indonesian|malaysian|filipino|noodle|dumpling/],
  ['vegan',       /vegan|vegetarian/],
  ['fine-dining', /fine dining/]
];

/* One venue as the catalogue draws a place — with two things the catalogue
 * has no column for, and one flag that says where they came from.
 *
 * The name, the address, the pin, `map` and `mapId` are what all three rolls
 * answer with, so a row can be drawn without knowing which one it came out
 * of. `types`, `price`, `rating`, `reviews` and `google` are the exception,
 * and a deliberate one: they are Google's description of a place I have never
 * eaten at, and the page that draws them has to be able to say so. See
 * sourceLine() in assets/lists.js and in assets/app.js, which are the two
 * things that read them, and which print the attribution before anything
 * else on the line.
 *
 * The score travels here and nowhere near the map's own places. There are no
 * scores on this site — none of the seventy-four places I have eaten at is
 * ranked, and none ever will be — and this is not one: it is Google's number,
 * on Google's place, with Google's name on it, which is the only shape in
 * which a number like that can be honest here.
 *
 * The contact half — the phone, the site, the week of opening hours and the
 * Google listing — is not here. It is added by venuesByIds() below, because
 * it is drawn on one card and asked for by one caller: the picker fetches all
 * 751 rows and would carry sixty kilobytes of numbers no row on that page
 * prints.
 *
 * The address is Google's street line and the two columns beside it, joined
 * the way the catalogue writes one: "Kopli tn 16, 10412 Tallinn".
 */
export function venueEntry(row) {
  const where = [row.address, [row.postal_code, row.city].filter(Boolean).join(' ')]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');

  /* Google's "$" to "$$$$" as the map's band of four. db/schema.sql keeps the
     string verbatim rather than converting it on the way in — a mirror that
     stores an opinion has stopped being a mirror — and says the conversion is
     one line wherever it is actually needed. This is that line. Fifty-seven
     of the rows carry no price at all and get no gauge. */
  const dollars = /^\$+$/.test(row.price || '') ? String(row.price).length : 0;
  const said = [row.category, row.cuisine, row.tags].join(' ').toLowerCase();

  return {
    id: row.place_id,
    name: row.name,
    address: where,
    lat: typeof row.latitude === 'number' ? row.latitude : null,
    lng: typeof row.longitude === 'number' ? row.longitude : null,
    /* Thirty-two of them are also places on my map. `map` is what makes a row
       link to a write-up instead of out to Google, and `mapId` is where that
       write-up lives — the map's own id, not Google's key. */
    map: !!row.map_id,
    mapId: row.map_id || null,
    types: VENUE_TYPES.filter((pair) => pair[1].test(said)).map((pair) => pair[0]),
    price: dollars >= 1 && dollars <= 4 ? dollars : null,
    /* Google's own, both of them, and null where the export has neither. The
       count travels with the score because a 5.0 is worth what the number of
       people behind it is worth, and one without the other is the half that
       flatters. */
    rating: typeof row.rating === 'number' ? row.rating : null,
    reviews: typeof row.reviews === 'number' ? row.reviews : null,
    /* Not "is this row from the table" — the id already says that. It is
       "whose description this is", and it travels with the description so
       that nothing downstream can draw one without the other. */
    google: true
  };
}

/* The venues behind a set of ids, as a Map. Ids that are not in the table —
   a catalogue slug, a key from an export that no longer carries it — are
   simply not in the answer, which is what every caller here already handles.

   The list is bound one placeholder per id and capped well above the twenty
   places a list can hold, so nothing a request sends decides the shape of the
   statement and nothing it sends can make it long. */
export async function venuesByIds(env, ids) {
  const keys = (Array.isArray(ids) ? ids : [])
    .filter((id) => typeof id === 'string' && id.length > 0 && id.length <= 128)
    .slice(0, 50);
  if (!env.DB || keys.length === 0) return new Map();

  const holes = keys.map(() => '?').join(', ');
  const { results } = await env.DB
    .prepare(
      'SELECT place_id, name, category, cuisine, tags, price, rating, reviews, ' +
      'address, postal_code, city, phone, website, opening_hours, maps_url, ' +
      'latitude, longitude, map_id ' +
      'FROM google_venues WHERE place_id IN (' + holes + ')'
    )
    .bind(...keys)
    .all();

  /* The contact half, added here rather than in venueEntry() because these
     four columns are selected here and nowhere else. A place off the export
     has no write-up behind its name, and until this travelled the card the
     map drew for one was a name, an address and a Directions button — while
     the row it came from held the number to ring, the site to read, the hours
     to turn up in and the listing all three came off. */
  return new Map((results || []).map((row) => [row.place_id, {
    ...venueEntry(row),
    phone: row.phone || '',
    website: row.website || '',
    hours: venueHours(row.opening_hours),
    mapsUrl: row.maps_url || ''
  }]));
}

/* Google's one-line week as seven days the browser can draw.
 *
 * The column holds "Mon 11:00-22:00; Tue closed; ..." — one line, 24-hour,
 * semicolons between days, and the only English in it is the word "closed".
 * That word is the reason this is parsed here rather than sent as it stands:
 * a card that prints "closed" at a Ukrainian reader has broken the rule every
 * other string on this site keeps, and a day the place is shut is exactly the
 * day somebody needs to read.
 *
 * Out comes an array of seven, Monday first, each either the times as Google
 * wrote them — "11:00-22:00", or "12:00-15:00, 17:00-22:00" where a kitchen
 * shuts in the afternoon — or null for a day it does not open. The times are
 * digits and a hyphen and carry no language at all, so they travel verbatim.
 *
 * An empty column, or one in a shape this does not recognise, comes back as
 * an empty array: no hours rather than a week with holes in it. Fifty-odd of
 * the 751 rows carry no hours, RØST Bakery among them.
 */
const HOUR_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function venueHours(text) {
  const week = [null, null, null, null, null, null, null];
  let said = false;

  for (const part of String(text || '').split(';')) {
    const m = /^\s*([a-z]{3})\s+(\S.*?)\s*$/i.exec(part);
    if (!m) continue;
    const day = HOUR_DAYS.indexOf(m[1].toLowerCase());
    if (day === -1) continue;
    said = true;
    /* Left null, which is what the card draws as shut. */
    if (/^closed$/i.test(m[2])) continue;
    week[day] = m[2];
  }

  return said ? week : [];
}

/* ----------------------------------------------------------- added places
 * The third roll, and the smallest: the places somebody added by hand because
 * neither the catalogue nor google_venues had them. See added_places in
 * db/schema.sql, and addPlace() in lists.js which is the only thing that
 * writes one.
 */

/* Which of the three kinds of id a list row holds.
 *
 *   catalogue   180-degrees                   lowercase, digits and hyphens
 *   Google      ChIJUdUjCV2TkkYRcg8TxVp1XUI   always carries a capital
 *   added here  new_k3fmqw8x2p                lowercase, and has an underscore
 *
 * Both halves of the test are needed, and that is measured rather than
 * assumed. Counted over the two tables as they actually stand:
 *
 *   all 74 catalogue ids     lowercase, and not one contains an underscore
 *   161 of 750 Google keys   DO contain an underscore
 *   0 of 750 Google keys     are all-lowercase
 *
 * So "contains an underscore" on its own would misread 161 real places as
 * added-by-hand and send them to the wrong table; "is lowercase" on its own
 * would not separate one from a catalogue slug. Together they are exact, with
 * nothing on either roll matching. The "new_" prefix is for a person reading a
 * row in the database; this is what the code trusts.
 *
 * Re-run the count if google_venues is ever re-synced from a different export:
 *
 *   SELECT SUM(place_id = lower(place_id) AND instr(place_id,'_') > 0)
 *     FROM google_venues;   -- must be 0
 */
export function isAdded(id) {
  return typeof id === 'string' && id === id.toLowerCase() && id.indexOf('_') !== -1;
}

/* One added place as the catalogue draws a place, so the rest of the lists
   code cannot tell which of the three rolls an entry came out of.

   `map` is false and `mapId` is null, always: those two mean "this is also on
   data/restaurants.json, so link the row to its write-up", and a place
   somebody typed in has no write-up. Being on the map is still the verdict. */
export function addedEntry(row) {
  return {
    id: row.id,
    name: row.name,
    address: row.address || '',
    lat: typeof row.lat === 'number' ? row.lat : null,
    lng: typeof row.lng === 'number' ? row.lng : null,
    map: false,
    mapId: null
  };
}

/* The added places behind a set of ids, as a Map. Same contract as
   venuesByIds: ids that are not in the table are simply not in the answer,
   which every caller already handles.

   Not filtered by owner, and that is deliberate. Only its author sees one of
   these in a picker, but a list is shared and a stranger opening it has to see
   every place on it — including this one, with its pin. Filtering by the
   reader here would draw somebody's list with a hole in it. */
export async function addedByIds(env, ids) {
  const keys = (Array.isArray(ids) ? ids : [])
    .filter((id) => typeof id === 'string' && id.length > 0 && id.length <= 128)
    .slice(0, 50);
  if (!env.DB || keys.length === 0) return new Map();

  const holes = keys.map(() => '?').join(', ');
  const { results } = await env.DB
    .prepare('SELECT id, name, address, lat, lng FROM added_places WHERE id IN (' + holes + ')')
    .bind(...keys)
    .all();

  const out = new Map();
  results.forEach((row) => out.set(row.id, addedEntry(row)));
  return out;
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
