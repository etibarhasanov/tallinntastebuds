#!/usr/bin/env node
/**
 * Tallinn Tastebuds — the public API's version 1, held to what it promised.
 *
 *     node tools/apicheck.mjs           every check, and the fields v1 now
 *                                       answers with that are not frozen yet
 *     node tools/apicheck.mjs --check   the checks alone (this is what CI runs)
 *
 * functions/api/v1/[[path]].js answers code nobody here will ever read, on a
 * promise written into its address: v1 only ever gains. A field renamed in a
 * tidy-up, a number that became a string, an array that became null on an
 * empty list — each is a break in somebody's app that nobody at this site
 * would see. So this calls the Function the way the deploy would —
 * onRequest() with a request and an env — over the real data/ files, with a
 * stand-in database holding two public lists, and holds every answer to the
 * shapes frozen in data/api-v1.json:
 *
 *   - every field the file lists is in the answer, and of a type it allows;
 *   - every error is `{ version, error: { code, message } }`, with a code
 *     from the file's list;
 *   - every answer carries `Access-Control-Allow-Origin: *` and `API-Version`;
 *   - a place that has closed is not in a search and is `closed` by its id;
 *   - every address the file lists under `apps` answers through the site's
 *     own route — the apps' v1 addresses are aliases, not copies — its old
 *     address under /api/ is a 410 naming it, but /api/google, where Google
 *     sends a sign-in back, and /api/v1/admin/… is not one of them.
 *
 * A field the answer has and the file does not is not a failure: that is v1
 * gaining, which is allowed. Without --check it is printed, so whoever added
 * it can freeze it in the same commit.
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

const frozen = JSON.parse(readFileSync(join(ROOT, 'data', 'api-v1.json'), 'utf8'));
const restaurants = JSON.parse(readFileSync(join(ROOT, 'data', 'restaurants.json'), 'utf8'));
const open = restaurants.filter((p) => !p.closed);
const closed = restaurants.find((p) => p.closed);

/* Two public lists of the map's own places and one Google row, the shape
   production holds them in, and nothing else in the database. */
const LIST_PLACES = open.slice(0, 5);
const LISTS = [
  { id: 'soups-abc123', title: 'Soups', intro: 'Warm ones.', by: 'etibar', owner: 'u1' },
  { id: 'coffee-def456', title: 'Coffee', intro: '', by: null, owner: 'u2' }
];
const ITEMS = LIST_PLACES.map((p, i) => ({ place_id: p.id, name: p.name, say: i ? null : 'Go early.', pos: i }))
  .concat([{ place_id: 'ChIJTestGoogleKey', name: 'A Google place', say: null, pos: 9 }]);

const DB = {
  prepare(sql) {
    let args = [];
    return {
      bind(...a) { args = a; return this; },
      all: async () => {
        if (/JOIN list_items i ON i.list_id = l.id/.test(sql)) {
          return { results: LISTS.flatMap((l) => ITEMS.map((it) => ({ id: l.id, title: l.title, intro: l.intro, by: l.by, name: it.name }))) };
        }
        if (/FROM list_items WHERE list_id/.test(sql)) return { results: ITEMS };
        return { results: [] };
      },
      first: async () => {
        if (/FROM lists l LEFT JOIN users u ON u.id = l.owner WHERE l.id = \?/.test(sql)) {
          const list = LISTS.find((l) => l.id === args[0]);
          return list ? { ...list, username: list.by, public: 1, created_at: 0, updated_at: 0 } : null;
        }
        return null;
      },
      run: async () => ({})
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
const v1 = await load('api', 'v1', '[[path]].js');
const middleware = await load('_middleware.js');

/* One request to v1, at the address it would be asked at, the catch-all's
   `path` worked out the way Pages works it out. */
async function ask(path, init) {
  const url = new URL(path, SITE);
  const request = new Request(url, init);
  const rest = url.pathname.replace(/^\/api\/v1\/?/, '');
  const params = { path: rest ? rest.split('/') : [] };
  const res = await v1({ request, env: { DB, ASSETS }, params, next: async () => new Response('', { status: 404 }) });
  let body = null;
  try { body = await res.clone().json(); } catch (e) { /* a 204 or a page */ }
  return { res, body };
}

const failures = [];
function check(what, ok, detail) {
  if (!ok) failures.push(what + (detail ? ' — ' + detail : ''));
  else if (!CHECK) console.log('  ok  ' + what);
}

/* ------------------------------------------------------------ the shapes
 * A spec is a type string ('string', 'number|null'), an array of one spec
 * (every element is that), an object of specs (a key ending in ? may be
 * missing; `"@": "name"` takes a shared shape's keys in as well), or
 * "@name" for a shared shape whole. Returns what is wrong, and collects the
 * keys the answer has beyond the spec into `extra`.
 */
const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

function expand(spec) {
  if (typeof spec === 'string' && spec.startsWith('@')) return expand(frozen.shapes[spec.slice(1)]);
  if (spec && typeof spec === 'object' && !Array.isArray(spec) && spec['@']) {
    const { '@': base, ...own } = spec;
    return { ...frozen.shapes[base], ...own };
  }
  return spec;
}

function shapeErrors(value, raw, at, extra) {
  const spec = expand(raw);
  if (typeof spec === 'string') {
    return spec.split('|').includes(typeOf(value)) ? [] : [at + ' is ' + typeOf(value) + ', frozen as ' + spec];
  }
  if (Array.isArray(spec)) {
    if (!Array.isArray(value)) return [at + ' is ' + typeOf(value) + ', frozen as an array'];
    return value.flatMap((v, i) => shapeErrors(v, spec[0], at + '[' + i + ']', extra));
  }
  if (typeOf(value) !== 'object') return [at + ' is ' + typeOf(value) + ', frozen as an object'];
  const out = [];
  const keys = new Set();
  for (const [key, sub] of Object.entries(spec)) {
    const name = key.replace(/\?$/, '');
    keys.add(name);
    if (!(name in value)) {
      if (!key.endsWith('?')) out.push(at + '.' + name + ' is gone');
      continue;
    }
    out.push(...shapeErrors(value[name], sub, at + '.' + name, extra));
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) extra.add(at.replace(/\[\d+\]/g, '[]') + '.' + key);
  }
  return out;
}

const extra = new Set();
function holds(label, body, spec) {
  const wrong = shapeErrors(body, spec, label, extra);
  check(label + ' keeps every frozen field and type', !wrong.length, wrong.slice(0, 5).join('; '));
}

function headed(label, res) {
  const lost = Object.entries(frozen.headers).filter(([k, v]) => res.headers.get(k) !== v);
  check(label + ' carries ' + Object.keys(frozen.headers).join(' and '), !lost.length,
    lost.map(([k]) => k + ' is ' + res.headers.get(k)).join('; '));
}

/* ------------------------------------------------------------ the checks */
const A = frozen.answers;
const near = open[0].lat + ',' + open[0].lng;
const asked = {
  '/api/v1': '/api/v1',
  '/api/v1/places': '/api/v1/places?limit=100',
  '/api/v1/places/{id}': '/api/v1/places/' + open[0].id,
  '/api/v1/lists': '/api/v1/lists',
  '/api/v1/lists/{id}': '/api/v1/lists/' + LISTS[0].id,
  '/api/v1/types': '/api/v1/types'
};
for (const [label, path] of Object.entries(asked)) {
  const { res, body } = await ask(path);
  check(path + ' answers 200', res.status === 200, 'it answered ' + res.status + ' ' + JSON.stringify(body));
  if (res.status !== 200) continue;
  holds(label, body, A[label]);
  headed(path, res);
}

{
  const { body } = await ask('/api/v1/places?near=' + near + '&limit=100&lang=et');
  holds('/api/v1/places?near=', body, A['/api/v1/places']);
  check('a search near a point carries distance_m on every row, nearest first',
    body.places.every((p, i, all) => typeof p.distance_m === 'number' && (!i || all[i - 1].distance_m <= p.distance_m)));
  check('every open place is in the roll and no closed one is',
    body.total === open.length && !body.places.some((p) => restaurants.find((r) => r.id === p.id).closed));
}
{
  const { body } = await ask('/api/v1/places?limit=2&offset=0');
  check('a page of two says where the next starts', body.places.length === 2 && body.next === 2);
  const ids = open.slice(0, 3).map((p) => p.id).reverse();
  const byIds = (await ask('/api/v1/places?ids=' + ids.join(','))).body;
  check('ids answers those places in the order asked', byIds.places.map((p) => p.id).join() === ids.join());
  const none = (await ask('/api/v1/places?q=zzzzqqqq')).body;
  check('a search that finds nothing is an empty places, not an error', none.places.length === 0 && none.total === 0);
}
{
  const { body } = await ask('/api/v1/lists/' + LISTS[0].id);
  const google = body.list.items.find((i) => i.place_id === null);
  check('a list row the map does not have is approved: false', google && google.approved === false);
  check('a list row of the map\'s own is approved, with its id', body.list.items[0].approved && body.list.items[0].place_id === LIST_PLACES[0].id);
}

/* The errors, each with its code and the error shape. */
const errors = [
  ['/api/v1/places?type=nothing', 400, 'bad-request'],
  ['/api/v1/places?near=1,1', 400, 'bad-request'],
  ['/api/v1/places?limit=0', 400, 'bad-request'],
  ['/api/v1/places/no-such-place', 404, 'not-found'],
  ['/api/v1/lists/no-such-list', 404, 'not-found'],
  ['/api/v1/nothing', 404, 'not-found']
];
if (closed) errors.push(['/api/v1/places/' + closed.id, 404, 'closed']);
for (const [path, status, code] of errors) {
  const { res, body } = await ask(path);
  check(path + ' is ' + status + ' ' + code, res.status === status && body && body.error && body.error.code === code,
    'it answered ' + res.status + ' ' + JSON.stringify(body));
  if (body) holds(path, body, frozen.shapes.error);
  check(code + ' is one of the frozen error codes', frozen.errors.includes(code));
  headed(path, res);
}
{
  const { res, body } = await ask('/api/v1/places', { method: 'DELETE' });
  check('a DELETE is 405 method-not-allowed', res.status === 405 && body.error.code === 'method-not-allowed');
  const pre = (await ask('/api/v1/places', { method: 'OPTIONS' })).res;
  check('a preflight is 204 with CORS', pre.status === 204 && pre.headers.get('Access-Control-Allow-Origin') === '*');
}

/* Without a database the places answer and the lists say so. */
{
  const url = new URL('/api/v1/lists', SITE);
  const res = await v1({ request: new Request(url), env: { ASSETS }, params: { path: ['lists'] } });
  const body = await res.json();
  check('the lists with no database are 503 unavailable', res.status === 503 && body.error.code === 'unavailable');
  const places = await v1({ request: new Request(new URL('/api/v1/places', SITE)), env: { ASSETS }, params: { path: ['places'] } });
  check('the places with no database still answer', places.status === 200);
}

/* The apps' addresses: each is the site's own route, called, and its old
   address under /api/ a 410 that says where it went — the MOVED block in
   functions/_middleware.js — but /api/google, which Google's console sends
   every sign-in back to. */
const throughMiddleware = (path) => middleware({
  request: new Request(SITE + path), env: {},
  next: async () => new Response('the route')
});
for (const name of frozen.apps) {
  const old = name === 'find' ? 'places' : name === 'me/lists' ? 'lists' : name;
  const mod = await import(pathToFileURL(join(ROOT, 'functions', 'api', old + '.js')).href);
  const own = mod.onRequestGet || mod.onRequestPost || mod.onRequest;
  check('/api/v1/' + name + ' has a route behind it in functions/api/' + old + '.js', typeof own === 'function');
  const res = await throughMiddleware('/api/' + old);
  if (name === 'google') {
    check('/api/google still answers, where Google sends a sign-in back', res.status === 200);
    continue;
  }
  const body = await res.json().catch(() => null);
  check('/api/' + old + ' is gone and names /api/v1/' + name, res.status === 410 && body && body.use === '/api/v1/' + name,
    'it answered ' + res.status + ' ' + JSON.stringify(body));
}
{
  const res = await throughMiddleware('/api/rides/abc123?x=1');
  const body = await res.json().catch(() => null);
  check('/api/rides/<id> is gone and names /api/v1/rides/<id>', res.status === 410 && body && body.use === '/api/v1/rides/abc123?x=1');
}
for (const [name, old] of [['account', 'account'], ['find', 'places'], ['me/lists', 'lists']]) {
  const mod = await import(pathToFileURL(join(ROOT, 'functions', 'api', old + '.js')).href);
  const env = { ASSETS };
  const own = await (await mod.onRequestGet({ request: new Request(SITE + '/api/v1/' + name), env, params: {} })).text();
  const { res } = await ask('/api/v1/' + name);
  check('/api/v1/' + name + ' answers what functions/api/' + old + '.js does', (await res.text()) === own);
}
{
  const { res } = await ask('/api/v1/admin/stats');
  check('/api/v1/admin/… is no way round the owner\'s lock', res.status === 404);
  const locked = await middleware({
    request: new Request(SITE + '/api/admin/stats'), env: {},
    next: async () => new Response('the owner\'s')
  });
  check('/api/admin/ is still the owner\'s alone', locked.status === 403);
}

if (!CHECK && extra.size) {
  console.log('\nAnswered and not frozen yet — v1 gaining, which is allowed; add them to data/api-v1.json:');
  for (const key of [...extra].sort()) console.log('  + ' + key);
}

if (failures.length) {
  console.error('\n' + failures.length + ' check' + (failures.length === 1 ? '' : 's') + ' failed:');
  for (const f of failures) console.error('  FAIL  ' + f);
  process.exit(1);
}
console.log('OK — /api/v1 keeps every shape data/api-v1.json froze, its apps\' addresses are the site\'s own routes, and their old ones are gone.');
