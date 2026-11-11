#!/usr/bin/env node
/**
 * Tallinn Tastebuds — the two doors an assistant reads the site through,
 * /mcp and the flashcards' /flashcard/mcp, asked what an assistant would ask.
 *
 *     node tools/mcpcheck.mjs           every check, with what is still missing
 *     node tools/mcpcheck.mjs --check   the checks alone (this is what CI runs)
 *
 * functions/mcp.js is read by a model, not a person, and a mistake in it is
 * the quiet kind: a field that went missing from a search row, a bakery
 * search that opens on a restaurant, an empty search that answers an error
 * instead of an empty list. The assistant writes something plausible either
 * way and nobody at the site sees the answer. So this calls the Function the
 * way the deploy would — onRequest() with a request and an env — over the
 * real data/ files, with a stand-in database holding Google rows shaped like
 * production's, and holds the answers to what the owner asked for:
 *
 *   - every place links to its own page on the site, and the instructions say
 *     to put that link on its name;
 *   - a place with a reel gives the reel's URL in a search, in a read by id,
 *     and in `fetch`; a place without one gives `reel: null`;
 *   - every `photo` answered is an address on the site, of a file that is in
 *     the repository;
 *   - a search by `type: "bakery"` lists the places whose primary type is
 *     bakery first, nearest first within each group when a point is given;
 *   - a search that finds nothing is an empty `places`, not an error;
 *   - a search row carries the name, the address, the point, the phone and
 *     the website, Google's phone only where the map has none;
 *   - a Google row that is not plainly the same door is not trusted;
 *   - the tools are listed, and the server introduces itself by name.
 *
 * And the flashcards' door, functions/flashcard/mcp.js, over the real
 * data/decks/ files and no database at all, since it reads none:
 *
 *   - a word is found from any of the four languages and from one of its
 *     forms, with the meaning in the language asked for;
 *   - a word that is on no card is an empty `words`, not an error;
 *   - every deck the shelf lists reads whole, with as many cards as it said;
 *   - every grammar lesson reads as text in each of the three languages, and
 *     the three are different texts;
 *   - no song, no song's deck and no conversation is answered;
 *   - the middleware answers /mcp on the flashcards' hostname with this door.
 *
 * Without --check it also prints what the data does not hold yet: the places
 * with a reel and no photograph, and with a reel and no reelSummary.
 *
 * Zero dependencies, like everything in tools/. Node 20's fetch, Request and
 * Response are the Workers runtime's for every purpose here.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const SITE = 'https://tallinntastebuds.ee';

const restaurants = JSON.parse(readFileSync(join(ROOT, 'data', 'restaurants.json'), 'utf8'));
const byId = new Map(restaurants.map((p) => [p.id, p]));

/* Google rows as production holds them on the day this was written: the
   category, a week, and the point — taken off the place's own, since the
   door test only needs them to agree. The last is filed against the wrong
   place on purpose. */
const WEEK = 'Mon 08:00-18:00; Tue 08:00-18:00; Wed 08:00-18:00; Thu 08:00-18:00; ' +
  'Fri 08:00-18:00; Sat 09:00-16:00; Sun closed';
function row(mapId, name, category, near) {
  const at = byId.get(near || mapId);
  return {
    map_id: mapId, place_id: 'ChIJ' + mapId, name, category, status: 'Open',
    opening_hours: WEEK, latitude: at.lat, longitude: at.lng,
    refreshed_at: Date.UTC(2026, 10, 1), synced_at: Date.UTC(2026, 8, 1)
  };
}
const ROWS = [
  row('bruto-bakehouse', 'BRUTO BAKEHOUSE', 'Bakery'),
  row('pulla-bakery', 'PullaBakery', 'Bakery'),
  row('la-boulangerie', 'La Boulangerie', 'Bakery'),
  row('francois-boulangerie', 'François Boulangerie', 'Bakery'),
  row('cafe-tempo', 'Cafe Tempo', 'Restaurant'),
  row('koho', 'Telliskivi KoHo', 'Restaurant'),
  row('karu-talu-sokolaad', 'Karu Talu Šokolaad', 'Chocolate Shop'),
  { ...row('varav-coffee-toast', 'Värav Coffee and toast', 'Cafe'), phone: '+372 555 0100' },
  /* A link nobody should trust: the right name, a door across town. */
  row('crustum-bakery', 'Crustum Bakery', 'Bakery', 'pulla-bakery')
];

const DB = {
  prepare(sql) {
    return {
      bind() { return this; },
      all: async () => ({ results: /FROM google_venues/.test(sql) ? ROWS : [] }),
      first: async () => null
    };
  }
};
const ASSETS = {
  fetch: async (request) => {
    const path = join(ROOT, decodeURIComponent(new URL(request.url).pathname));
    return existsSync(path) ? new Response(readFileSync(path)) : new Response('', { status: 404 });
  }
};

const load = async (...file) => (await import(pathToFileURL(join(ROOT, 'functions', ...file)).href)).onRequest;
const onRequest = await load('mcp.js');
const flashDoor = await load('flashcard', 'mcp.js');
const middleware = await load('_middleware.js');

/* One JSON-RPC call to a door: the map's unless handed another, at the
   address it would be asked at. */
let n = 0;
async function rpc(method, params, door = onRequest, url = SITE + '/mcp') {
  const request = new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++n, method, params })
  });
  const body = await (await door({ request, env: { DB, ASSETS }, next: async () => new Response('', { status: 404 }) })).json();
  if (body.error) throw new Error(method + ': ' + body.error.message);
  return body.result;
}
const call = (name, args) => rpc('tools/call', { name, arguments: args });
const places = async (args) => (await call('places', args)).structuredContent.places;

const failures = [];
function check(what, ok, detail) {
  if (!ok) failures.push(what + (detail ? ' — ' + detail : ''));
  else if (!CHECK) console.log('  ok  ' + what);
}

/* ------------------------------------------------------------ the checks */
const open = restaurants.filter((p) => !p.closed);
const reeled = open.find((p) => p.reel);
const unreeled = open.find((p) => !p.reel);

const init = await rpc('initialize', { protocolVersion: '2025-11-25' });
check('the server introduces itself as Tallinn Tastebuds', init.serverInfo.title === 'Tallinn Tastebuds');
check('the instructions say "Watch the video"', /Watch the video/.test(init.instructions));
check('the instructions make the site\'s own page the link on every place',
  /links to its url/.test(init.instructions) && /tallinntastebuds\.ee/.test(init.instructions));
const listed = (await rpc('tools/list', {})).tools.map((t) => t.name);
check('the tools are listed', ['places', 'lists', 'search', 'fetch'].every((t) => listed.includes(t)), listed.join(', '));

const found = await places({ query: reeled.name, limit: 10 });
const inSearch = found.find((p) => p.id === reeled.id);
check('a place with a reel gives its URL in a search', inSearch && inSearch.reel === reeled.reel);
const whole = (await places({ id: reeled.id }))[0];
check('a place with a reel gives its URL read by id', whole.reel === reeled.reel && whole.has_reel === true);
const fetched = JSON.parse((await call('fetch', { id: reeled.id })).content[0].text);
check('a place with a reel gives its URL in fetch',
  fetched.metadata.reel === reeled.reel && fetched.text.includes('Watch the video: ' + reeled.reel));
const plain = (await places({ id: unreeled.id }))[0];
check('a place without a reel gives reel: null', plain.reel === null && plain.has_reel === false);

const every = await places({ limit: 10, near_lat: 59.437, near_lng: 24.7536, radius_m: 100000 });
const fields = ['reel', 'has_reel', 'reel_summary', 'photo', 'last_visited', 'primary_type', 'opening_hours', 'phone', 'website', 'name', 'address', 'lat', 'lng'];
check('every search row carries the new fields', every.every((p) => fields.every((f) => f in p)));
check('every row\'s url is the place\'s own page on the site',
  every.every((p) => p.url === SITE + '/?spot=' + encodeURIComponent(p.id)));

const photos = [];
for (const p of open) photos.push(...(await places({ id: p.id })).map((r) => [p.id, r.photo]));
const bad = photos.filter(([, url]) => url !== null &&
  !(url.startsWith(SITE + '/photos/') && existsSync(join(ROOT, decodeURIComponent(url.slice(SITE.length))))));
check('every photo is a file on the site', !bad.length, bad.map(([id, url]) => id + ' ' + url).join(', '));

const bakeries = await places({ type: 'bakery', limit: 10 });
const firsts = bakeries.map((p) => p.primary_type === 'bakery');
check('the bakery filter lists primary_type bakery first',
  firsts.indexOf(false) === -1 || firsts.slice(firsts.indexOf(false)).every((x) => !x),
  bakeries.map((p) => p.id + ':' + p.primary_type).join(', '));
check('KoHo is not a bakery', !bakeries.some((p) => p.id === 'koho'));
const tempo = bakeries.find((p) => p.id === 'cafe-tempo');
check('a restaurant that bakes is filed as a restaurant', !tempo || tempo.primary_type === 'restaurant');

const near = await places({ type: 'bakery', near_lat: 59.437, near_lng: 24.7536, limit: 10 });
const group = (ok) => near.filter((p) => (p.primary_type === 'bakery') === ok).map((p) => p.distance_m);
const sorted = (xs) => xs.every((x, i) => i === 0 || xs[i - 1] <= x);
check('with a point, the bakeries come first and each group is nearest first',
  near.findIndex((p) => p.primary_type !== 'bakery') >= group(true).length && sorted(group(true)) && sorted(group(false)));

const none = await call('places', { query: 'zzzqqqxx' });
check('a search with no matches is an empty places list',
  !none.isError && Array.isArray(none.structuredContent.places) && none.structuredContent.places.length === 0);

const pulla = (await places({ id: 'pulla-bakery' }))[0];
check('Google\'s hours come with their source and day',
  pulla.opening_hours && pulla.opening_hours.weekday_text[0] === 'Monday: 08:00-18:00' &&
  pulla.opening_hours.weekday_text[6] === 'Sunday: Closed' && pulla.opening_hours.checked_at === '2026-11-01');
const varav = (await places({ query: 'Värav' })).find((p) => p.id === 'varav-coffee-toast');
check('a place with no phone of its own gives Google\'s, in a search row', varav && varav.phone === '+372 555 0100');
const crustum = (await places({ id: 'crustum-bakery' }))[0];
check('a Google row at another door is not trusted', crustum.opening_hours === null && crustum.primary_type === null &&
  !/query_place_id/.test(crustum.maps_url));
const unlisted = (await places({ id: unreeled.id }))[0];
check('a place Google does not list has null hours', ROWS.some((r) => r.map_id === unreeled.id) || unlisted.opening_hours === null);

/* ------------------------------------------------------- the flashcards */
const source = JSON.parse(readFileSync(join(ROOT, 'data', 'decks.json'), 'utf8'));
const LANGS = ['en', 'az', 'ru'];
const flash = (name, args) => rpc('tools/call', { name, arguments: args }, flashDoor, SITE + '/flashcard/mcp');
const got = async (name, args) => (await flash(name, args)).structuredContent[name === 'grammar' ? 'lessons' : name];

const flashInit = await rpc('initialize', {}, flashDoor, SITE + '/flashcard/mcp');
check('the flashcards introduce themselves as their own server', flashInit.serverInfo.name === 'tallinntastebuds-flashcards');
check('the flashcards\' instructions name the three languages and simple Estonian',
  LANGS.every((l) => flashInit.instructions.includes('(' + l + ')')) && /simple Estonian/.test(flashInit.instructions));
const flashTools = (await rpc('tools/list', {}, flashDoor, SITE + '/flashcard/mcp')).tools.map((t) => t.name);
check('the flashcards\' tools are listed', ['words', 'decks', 'grammar', 'search', 'fetch'].every((t) => flashTools.includes(t)), flashTools.join(', '));

/* A card with forms and all three backs, out of a deck the door answers. */
const taught = source.decks.filter((d) => d.level !== 'song');
const sample = taught.flatMap((d) => d.cards).find((c) => c.forms && LANGS.every((l) => c.back[l]) && !/[,;/(]/.test(LANGS.map((l) => c.back[l]).join('')));
const finds = async (query, language) => (await got('words', { query, language, limit: 20 })).find((w) => w.estonian === sample.front);
for (const lang of LANGS) {
  const hit = await finds(sample.back[lang], lang);
  check('a word is found from its ' + lang + ' meaning, and answers in ' + lang, hit && hit.meaning === sample.back[lang], sample.front);
}
check('a word is found from its Estonian', !!(await finds(sample.front, 'en')));
const byForm = await finds(sample.forms[1], 'en');
check('a word is found from one of its forms, and carries them', byForm && byForm.forms.join() === sample.forms.join(), sample.forms[1]);
const nothing = await flash('words', { query: 'zzzqqqxx' });
check('a word on no card is an empty words list', !nothing.isError && nothing.structuredContent.words.length === 0);

const shelfDecks = await got('decks', {});
check('the shelf is every deck but the songs\'', shelfDecks.map((d) => d.id).join() === taught.map((d) => d.id).join());
const short = [];
for (const row of shelfDecks) {
  const whole = (await got('decks', { id: row.id }))[0];
  const from = source.decks.find((d) => d.id === row.id);
  if (whole.words.length !== row.cards || whole.words.length !== from.cards.length ||
      whole.words.some((w, i) => w.estonian !== from.cards[i].front || !w.meaning)) short.push(row.id);
}
check('every deck reads whole, card for card', !short.length, short.join(', '));

const lessons = await got('grammar', {});
check('every grammar lesson is listed', lessons.map((l) => l.id).join() === source.lessons.map((l) => l.id).join());
const thin = [];
for (const row of lessons) {
  const texts = [];
  for (const lang of LANGS) texts.push((await got('grammar', { id: row.id, language: lang }))[0].text);
  if (texts.some((t) => t.length < 200) || new Set(texts).size !== LANGS.length) thin.push(row.id);
}
check('every lesson reads as text in three languages, each its own', !thin.length, thin.join(', '));
check('a lesson\'s practice deck is one the decks tool reads',
  lessons.every((l) => !l.practice_deck || shelfDecks.some((d) => d.id === l.practice_deck)));

const kept = [source.songs[0].id, source.songs[0].deck, source.talks[0].id];
const leaked = [];
for (const id of kept) {
  for (const name of ['decks', 'grammar', 'fetch']) if (!(await flash(name, { id })).isError) leaked.push(name + ' ' + id);
}
check('no song, song\'s deck or conversation is answered', !leaked.length, leaked.join(', '));
const fetchedDeck = JSON.parse((await flash('fetch', { id: taught[0].id })).content[0].text);
check('fetch reads a deck as text', fetchedDeck.text.includes(taught[0].cards[0].front) && fetchedDeck.url.endsWith('?d=' + taught[0].id));

const onHost = await rpc('initialize', {}, middleware, 'https://flashcard.tallinntastebuds.ee/mcp');
check('/mcp on the flashcards\' hostname is the flashcards\' door', onHost.serverInfo.name === 'tallinntastebuds-flashcards');

/* --------------------------------------------------------------- the end */
if (!CHECK) {
  const noPhoto = open.filter((p) => p.reel && !(p.photos || []).length).map((p) => p.id);
  const noSummary = open.filter((p) => p.reel && !p.reelSummary).map((p) => p.id);
  console.log('\n  missing  a reel and no photograph (' + noPhoto.length + '): ' + noPhoto.join(', '));
  console.log('  missing  a reel and no reelSummary (' + noSummary.length + ')');
}
if (failures.length) {
  for (const f of failures) console.error('  FAIL  ' + f);
  process.exit(1);
}
console.log('OK — /mcp and /flashcard/mcp answer ' + (CHECK ? 'every check' : 'as asked') + '.');
