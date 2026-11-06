#!/usr/bin/env node
/**
 * Tallinn Tastebuds — the door at /mcp, asked what an assistant would ask.
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
 *   - a Google row that is not plainly the same door is not trusted;
 *   - the tools are listed, and the server introduces itself by name.
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

const { onRequest } = await import(pathToFileURL(join(ROOT, 'functions', 'mcp.js')).href);

let n = 0;
async function rpc(method, params) {
  const request = new Request(SITE + '/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++n, method, params })
  });
  const body = await (await onRequest({ request, env: { DB, ASSETS } })).json();
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
const fields = ['reel', 'has_reel', 'reel_summary', 'photo', 'last_visited', 'primary_type', 'google_place_id', 'opening_hours'];
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
const crustum = (await places({ id: 'crustum-bakery' }))[0];
check('a Google row at another door is not trusted', crustum.google_place_id === null && crustum.opening_hours === null);
const unlisted = (await places({ id: unreeled.id }))[0];
check('a place Google does not list has null hours', ROWS.some((r) => r.map_id === unreeled.id) || unlisted.opening_hours === null);

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
console.log('OK — /mcp answers ' + (CHECK ? 'every check' : 'as asked') + '.');
