/**
 * Tallinn Tastebuds — the pieces every API route needs.
 *
 * Underscore-prefixed files under functions/ are not routed, so this is a
 * module and never an endpoint. Everything here is shared by the routes under
 * functions/api/ — the answer shape, the session and how one is opened, which
 * database this is, the two rolls of places, the site's own words, and the
 * move that carries a browser's saves onto the account somebody has just
 * signed in to (two routes do that now: ./account.js and ./google.js). The
 * page routes a directory up reach in here too, for a session, for the
 * database check and for the map's places: functions/list/[id].js,
 * functions/u/[name].js, functions/lists/index.js, functions/index.js and
 * functions/split.js. Four things at the bottom hold a value between
 * requests — which database this deployment is holding, the places on the map,
 * the catalogue a list draws from, and the data files read as they are — and
 * all four are caches of something that only a deploy changes, kept per
 * isolate and re-asked every five minutes. Nothing else here remembers
 * anything.
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

/* HMAC-SHA256 under a secret out of the Pages environment, as hex. Two things
   here want exactly this and neither wants it for the same reason: a
   fingerprint is a value that must not be reversible, and a sealed cookie is
   a value that must not be forgeable. Both are one key and one message, so
   the WebCrypto dance is written once. */
export async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

/* One-way and salted with a secret that lives in the Pages environment. The
   raw address never reaches the database, so a copy of a table tells nobody
   where anybody was. */
export async function fingerprint(secret, ip, ua) {
  return hmacHex(secret, ip + '|' + ua);
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

/* The site is three hostnames now — tallinntastebuds.ee, the splitwise
   subdomain under it and the flashcards one — and a cookie set without a
   Domain is a cookie for the one host that set it. So signing in on the map
   would have been signing in on the map only, and either subdomain would have
   asked for the password again on a site the same person was already signed in
   to.
 *
   Scoping it to the domain is what makes one account cover all of them. It is
   not free: every subdomain of tallinntastebuds.ee receives this cookie, so
   nothing may be hosted under one that should not hold a session token. There
   are two subdomains and this file is where to come back to before there is a
   third.
 *
   Only where the domain is actually ours. A preview deployment answers at
   <branch>.tallinntastebuds.pages.dev, and a Set-Cookie naming another
   registrable domain is dropped by the browser outright — the sign-in would
   appear to work and the next request would arrive signed out. So the host is
   read from the request rather than assumed, and anything that is not the
   live domain or a subdomain of it gets the host-only cookie it always had.
 *
   THIS BLOCK ARRIVED FOR SPLITWISE AND IS NOT SPLITWISE'S ANY MORE. The
   flashcards subdomain is its second reader and signs people in by it too, so
   removing splitwise now leaves this exactly where it is — that was true for a
   while and is not; see **Taking it out** under **Splitwise** in README.md,
   where the row for this file says so. It goes when the last subdomain goes,
   and then it is the SESSION_DOMAIN constant, the two lines that read it, the
   third parameter and the second Set-Cookie in the logout branch of
   account.js — and sessionCookie(token, days) is back to what it was. */
const SESSION_DOMAIN = 'tallinntastebuds.ee';

/* `request` may be null, which asks for the host-only cookie whatever the
   host is. Only signing out passes null, to clear the cookie a session made
   before this was domain-scoped as well as the one it makes now. */
export function sessionCookie(token, days, request) {
  const host = request ? new URL(request.url).hostname : '';
  const ours = host === SESSION_DOMAIN || host.endsWith('.' + SESSION_DOMAIN);

  const parts = [
    SESSION_COOKIE + '=' + (token || ''),
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=' + (token ? days * 86400 : 0)
  ];
  if (ours) parts.push('Domain=' + SESSION_DOMAIN);
  return parts.join('; ');
}

/* A new session for an account, and the token to put in the cookie. Three
   places mint one — creating an account, signing in to one, and coming back
   from Google — and all three do exactly this. The fourth, a password change,
   deliberately does not use it: there the insert has to be in the same batch
   as the delete that clears the old sessions, or a change could leave an
   account with none.

   The token goes to the browser and only its SHA-256 is stored, which is the
   whole argument for the sessions table looking the way it does. */
export async function openSession(env, userId) {
  const token = randomHex(32);
  await env.DB
    .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256Hex(token), userId, Date.now(), Date.now() + SESSION_DAYS * 86400000)
    .run();
  return token;
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
 * The map's own places, kept for five minutes per isolate. They come from the
 * deployed data/restaurants.json rather than a copy in here, so adding a place
 * to the map is all it takes for saving to work on it.
 *
 * Two shapes of the same fetch, because two callers want different halves of
 * it and neither should cost a second request. /api/saves and /api/lists ask
 * only "is this a real id", which is the Set; /api/ask needs the write-ups,
 * the types and the prices to put in front of a model, which is the array.
 * The array is what is read, and the Set is built from it once beside it.
 */
let mapped = null;
let known = null;
let knownAt = 0;

export async function mapPlaces(context) {
  if (mapped && Date.now() - knownAt < 300000) return mapped;
  const url = new URL('/data/restaurants.json', context.request.url);
  const res = context.env.ASSETS
    ? await context.env.ASSETS.fetch(new Request(url.toString()))
    : await fetch(url.toString());
  if (!res.ok) throw new Error('restaurants.json unreadable: ' + res.status);
  mapped = await res.json();
  known = new Set(mapped.map((p) => p.id));
  knownAt = Date.now();
  return mapped;
}

export async function knownPlaces(context) {
  await mapPlaces(context);
  return known;
}

/* ---------------------------------------------------------------- Tallinn
 * The box a point has to fall inside to be one of ours. Roughly 60km around
 * the city, which is generous — it reaches Paldiski and past Kehra — and
 * still refuses a point in another country.
 *
 * It lives here rather than beside either of its users because there are two:
 * /api/lists checks a submitted pin against it, and /api/geocode asks
 * Photon to look only inside it. Two copies would be one drifting copy,
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

/* ------------------------------------------------------------ data files
 * A JSON file out of the deployment, by path, kept five minutes per isolate
 * the way the two rolls above are and for the same reason: it changes when a
 * deploy changes it and not otherwise. The two rolls keep their own readers
 * because each builds something beside the file — a Set of ids, a Map by id —
 * and this is for the files that are wanted as they are.
 *
 * functions/index.js reads two through it: data/ui.json, for the title, the
 * description and the tagline in the language its address names and for the
 * word a shut place's card opens with, and data/taxonomy.json, for what to
 * call a kind of place in that language. Everything else that prints a UI
 * string is a browser, and reads the file for itself.
 */
const files = new Map();

export async function dataFile(context, path) {
  const kept = files.get(path);
  if (kept && Date.now() - kept.at < 300000) return kept.value;
  const url = new URL(path, context.request.url);
  const res = context.env.ASSETS
    ? await context.env.ASSETS.fetch(new Request(url.toString()))
    : await fetch(url.toString());
  if (!res.ok) throw new Error(path + ' unreadable: ' + res.status);
  const value = await res.json();
  files.set(path, { value: value, at: Date.now() });
  return value;
}

/* ------------------------------------------------------------- the words
 * The page's strings in one language, and which language that is.
 *
 * Two routes answer with the words the page will print rather than leaving it
 * to fetch data/ui.json for itself: /api/flashcard, where the decks and the
 * strings arrive together — see THE WORDS ON THE PAGE COME WITH THE DECKS in
 * its header — and /api/stats, which is one request on the way in for the same
 * reason. The whole block goes rather than a list of keys, because a list here
 * would be a second copy of what the page asks for and the validator could not
 * see the two drift.
 *
 * `asked` is what the page sends: a comma-separated list of what it would have
 * picked from, most wanted first, straight out of the address bar, the store
 * and the browser — so it is untrusted and shaped here before anything looks
 * it up. A tag is lowercased and cut at its hyphen (en-GB is en), anything
 * that is not two or three letters after that is dropped, and only the first
 * ten are read at all. It is the same rule pickLanguage() applies on every
 * other page, moved to where the list of languages is.
 *
 * The first the file speaks wins; English if none does; the file's first
 * language if it somehow has no English. The strings themselves are a file
 * read through the same five-minute cache every other data file is, so a
 * missing or malformed one is an empty block rather than a throw — the page
 * then prints its keys, which is the same thing it did when the file failed
 * to fetch.
 *
 * `langs` comes back beside them: every language the file speaks, each with
 * the name it has for itself, for a page that draws a switch. The flashcards
 * page does and reads it; /stats does not and drops it on the way past. Ten
 * short pairs either way, which is a couple of hundred bytes against the eight
 * to ten KB of strings already in the answer, so it is not worth a second
 * shape of this function to leave out.
 */
const DEFAULT_LANG = 'en';
const LANG_TAG = /^[a-z]{2,3}$/;

function languageOf(asked, langs) {
  const wanted = String(asked || '')
    .split(',')
    .slice(0, 10)
    .map((tag) => tag.trim().toLowerCase().split('-')[0])
    .filter((tag) => LANG_TAG.test(tag));
  return wanted.find((tag) => langs.includes(tag)) ||
    (langs.includes(DEFAULT_LANG) ? DEFAULT_LANG : langs[0] || DEFAULT_LANG);
}

export async function wordsFor(context, asked) {
  let ui = null;
  try {
    ui = await dataFile(context, '/data/ui.json');
  } catch (e) {
    ui = null;
  }
  const langs = ui && typeof ui === 'object' ? Object.keys(ui) : [];
  const lang = languageOf(asked, langs);
  const block = ui && ui[lang] && typeof ui[lang] === 'object' ? ui[lang] : {};
  /* The menu's own rows: the code, and the name that language has for itself.
     Sorted by code rather than by name, which is what the map's switch does
     and for its reason — the codes are Latin whatever the language writes
     itself in, so Հայերեն keeps the place `hy` gives it instead of trailing
     the Latin names a collator would put it after. A language with no
     langName falls back to its code, the way the map's switch does; a file
     that could not be read is an empty list, and the page then draws no
     switch at all rather than one with nothing in it. */
  const names = langs.slice().sort().map((code) => ({
    code: code,
    name: (ui[code] && typeof ui[code].langName === 'string' && ui[code].langName) || code
  }));
  return { lang: lang, langs: names, ui: block };
}

/* --------------------------------------------------------------- venues
 * google_venues — the Google Places export, eleven hundred and ten places
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
 * export's 1,110 rows says Georgian or Armenian, so a rule for it would be a
 * line that has never once run.
 *
 * Category, cuisine and the leftover tags are matched as one string, which is
 * what makes "Bar & Grill" both a pub and a restaurant. Counted over the
 * export as it stands: 1,098 of the 1,110 rows come out with at least one
 * type, exactly one comes out with four, and the twelve with none are kebab
 * shops, sandwich shops, a juice bar, a theatre and a caterer — which get no
 * types at all rather than a wrong one.
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
 * scores on this site — none of the seventy-five places I have eaten at is
 * ranked, and none ever will be — and this is not one: it is Google's number,
 * on Google's place, with Google's name on it, which is the only shape in
 * which a number like that can be honest here.
 *
 * The contact half — the phone, the site, the week of opening hours and the
 * Google listing — is not here. It is added by venuesByIds() below, because
 * it is drawn on one card and asked for by one caller: the picker fetches all
 * 1,110 rows and would carry ninety kilobytes of numbers no row on that page
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
     one line wherever it is actually needed. This is that line. A hundred
     and eighteen of the rows carry no price at all and get no gauge. */
  const dollars = /^\$+$/.test(row.price || '') ? String(row.price).length : 0;
  const said = [row.category, row.cuisine, row.tags].join(' ').toLowerCase();

  return {
    id: row.place_id,
    name: row.name,
    address: where,
    lat: typeof row.latitude === 'number' ? row.latitude : null,
    lng: typeof row.longitude === 'number' ? row.longitude : null,
    /* Sixty of them are also places on my map. `map` is what makes a row
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

  return new Map((results || []).map((row) => [row.place_id, venueCard(row)]));
}

/* A venue with its contact half: the entry above plus the number to ring,
 * the site to read, the week as seven days and the Google listing all three
 * came off. Kept apart from venueEntry() because these four columns are
 * selected by the two callers that draw a card — venuesByIds() above for a
 * place on somebody's list, and /api/ask for a place it is recommending —
 * and by nothing that draws a row. A place off the export has no write-up
 * behind its name, and until this travelled the card the map drew for one
 * was a name, an address and a Directions button, while the row it came from
 * held all four. */
export function venueCard(row) {
  return {
    ...venueEntry(row),
    phone: row.phone || '',
    website: row.website || '',
    hours: venueHours(row.opening_hours),
    mapsUrl: row.maps_url || ''
  };
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
 * an empty array: no hours rather than a week with holes in it. Seventy-seven
 * of the 1,110 rows carry no hours.
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
 *   all 75 catalogue ids     lowercase, and not one contains an underscore
 *   215 of 1,110 Google keys DO contain an underscore
 *   0 of 1,110 Google keys   are all-lowercase
 *
 * So "contains an underscore" on its own would misread 215 real places as
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

/* ------------------------------------------------------- claiming the saves
 * Move a device's saves onto an account.
 *
 * Two routes do this and both do it at the same moment — the one where
 * somebody stops being a browser and starts being an account. /api/account
 * does it on a sign-up and a sign-in; /api/google does it when the round trip
 * comes back as somebody this site already knows.
 *
 * UPDATE OR IGNORE, then DELETE, and the order matters. A row that cannot
 * move — because the account already has that place, saved on another device
 * — is left alone by the update rather than failing the whole statement, and
 * the delete then clears it away. The effect is a merge: the union of what
 * the device had and what the account had, with nothing counted twice.
 *
 * Both places' counts are then recomputed from the rows, so a place that was
 * saved on two devices by one person who has now signed in on both drops from
 * two to one, which is the true number.
 */
export async function claimDeviceSaves(env, userId, clientId) {
  if (!clientId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(clientId)) {
    return [];
  }

  const { results } = await env.DB
    .prepare("SELECT place_id FROM saves WHERE owner = ? AND owner_kind = 'device'")
    .bind(clientId)
    .all();
  if (!results.length) return [];

  const touched = results.map((r) => r.place_id);

  const statements = [
    env.DB
      .prepare("UPDATE OR IGNORE saves SET owner = ?, owner_kind = 'user' WHERE owner = ? AND owner_kind = 'device'")
      .bind(userId, clientId),
    env.DB
      .prepare("DELETE FROM saves WHERE owner = ? AND owner_kind = 'device'")
      .bind(clientId)
  ];
  for (const place of touched) {
    statements.push(env.DB.prepare(RECOUNT_SQL).bind(place, place));
  }
  await env.DB.batch(statements);

  return touched;
}

export function countsKey(request) {
  return new Request(new URL('/api/saves', request.url).toString());
}
