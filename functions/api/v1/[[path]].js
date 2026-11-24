/**
 * Tallinn Tastebuds — the public API, version 1.
 *
 * GET /api/v1                  what this is: the version, the addresses, the docs
 * GET /api/v1/places           the places on the map, open ones only
 *     ?q=<words>               the ones the words land on, best first
 *     &type=<type id>          only that kind of place — /api/v1/types
 *     &max_price=<1-4>         no dearer than that, on the map's own scale
 *     &near=<lat>,<lng>        nearest first, with `distance_m` on each row
 *     &radius=<metres>         and no further than that (needs `near`)
 *     &ids=<id>,<id>,…         just those, in that order — what /embed?ids= asks
 *     &lang=<code>             the write-up and nothing else in that language
 *     &limit=<1-100>&offset=<n>  a page of them; `next` is the next offset
 * GET /api/v1/places/<id>      one place whole: every photo and a Google Maps link
 * GET /api/v1/lists            the public lists, ?q= &by=<username> &limit &offset
 * GET /api/v1/lists/<id>       one public list, its places in its author's order
 * GET /api/v1/types            the kinds of place, named in every language
 * OPTIONS anything             a browser's preflight, 204
 *
 *     /api/v1/account, /saves, /find, /me/lists and the rest
 *                              the site's own routes the apps read and write
 *                              through, each at its v1 address — THE APPS'
 *                              ROUTES below
 *
 * Every answer is JSON, says `"version": 1` and carries `API-Version: 1`;
 * every answer has `Access-Control-Allow-Origin: *`, so any page on any site
 * may call it from a browser. No key, no account, no cookie read, nothing
 * written, nothing counted. **The public API** in docs/handbook.md is the
 * long version, and /developers is what a stranger reads.
 *
 * WHY A VERSION IN THE ADDRESS
 *
 * Everything else under /api/ is the site's own: the pages, the iPhone app,
 * Kohuke and Rattatee read it, and CLAUDE.md's **What the app reads** is the
 * list of promises made to those four — fields may be added, never renamed or
 * removed. That promise is kept by hand, between people who can read each
 * other's code. This route makes the same promise to code nobody here will
 * ever see, so it is written into the address and enforced by a machine:
 *
 *   - v1 only ever gains. A field, a parameter, a whole new address may be
 *     added; nothing that is here is renamed, removed, retyped or made to
 *     mean something else. tools/apicheck.mjs holds every answer to the
 *     shapes frozen in data/api-v1.json, and CI fails when one loses a field
 *     or changes its type.
 *   - A change that cannot be made that way is version 2, at /api/v2, beside
 *     this one rather than instead of it. v1 then sets SUNSET below — a date
 *     at least six months out — and from that day every answer here carries
 *     `Deprecation: true` and `Sunset: <date>`, the two headers RFC 8594 and
 *     RFC 9745 name for it, so a client that logs its headers is told.
 *   - The routes the pages and the apps sign in, save and write through are
 *     v1 too, at /api/v1/<name> — THE APPS' ROUTES below — so everything
 *     asks for one version of everything. Their old addresses under /api/
 *     were taken out on 2026-11-21 and answer a 410 saying where each went.
 *
 * WHAT IS NOT HERE, ON PURPOSE
 *
 * Google's half. /api/v1/find, the site's own search, merges about eleven
 * hundred rows out of the Google Places export into the roll, and /mcp
 * lends an assistant Google's opening hours; this hands out neither. They
 * are Google's data under Google's terms, which allow showing them on this
 * site and not handing them on to anybody who asks. A place here is a place
 * on the map, in the map's own words, with the phone and website the map
 * holds and nothing borrowed — and on a list, a row somebody added off
 * Google comes with the name, the address and the point the list itself
 * stores, `approved: false`.
 *
 * And no routing, no geocoding for other sites: /api/v1/route and
 * /api/v1/geocode are the site's own and carry none of the CORS headers
 * below, since they pass the question on to other people's free services
 * (OSRM, Peatus, Photon), and opening them to everybody would be spending
 * those services' patience on strangers.
 *
 * WHAT IT COSTS
 *
 * The places are data/restaurants.json, five minutes per isolate through
 * mapPlaces() in ../_lib.js — no database at all. The lists read the database:
 * publicLists() in ../../_public.js is every row of every public list in one
 * statement, so its answer is kept per isolate until a list changes —
 * keptLists() there, under the lists mark in ../_lists.js — and every answer
 * this route gives is kept five minutes in the colo besides, keyed on the
 * whole address and, for the lists, on the mark too, which costs a lists
 * request one row of `meta`. A loop asking the same thing is answered from
 * the colo; a loop asking a thousand different things reads the lists once
 * per isolate per edit and one list's rows per new id. A database that is
 * down costs the lists and nothing else: 503 `unavailable` there, the places
 * as ever.
 */

import { mapPlaces, dataFile, languageIndex, nearTallinn, foldWords, km, wrongDatabase } from '../_lib.js';
import { readList, LIST_ID, listsMark } from '../_lists.js';
import {
  VERSION, DEFAULT_LANG, photoUrl, placeUrl, listUrl, mapsSearch, wordsOf,
  matchScore, byName, publicLists, keptLists, matchLists, listRows
} from '../../_public.js';
import { SITE } from '../../_shell.js';

/* The site's own routes, which v1 answers as well — THE APPS' ROUTES. */
import * as account from '../account.js';
import * as apple from '../apple.js';
import * as google from '../google.js';
import * as saves from '../saves.js';
import * as find from '../places.js';
import * as mine from '../lists.js';
import * as profile from '../profile.js';
import * as pass from '../pass.js';
import * as discover from '../discover.js';
import * as walk from '../walk.js';
import * as rides from '../rides.js';
import * as geocode from '../geocode.js';
import * as lookup from '../lookup.js';
import * as ask from '../ask.js';
import * as flashcard from '../flashcard.js';
import * as say from '../say.js';
import * as route from '../route.js';
import * as seen from '../seen.js';

/* The day v1 stops answering, once a v2 has been published — an ISO date at
   least six months after v2 went live. null while v1 is the current version,
   which it is. WHY A VERSION IN THE ADDRESS above. */
const SUNSET = null;

/* Five minutes, everywhere: the map moves when a deploy moves it and a list
   when its author presses something, and five minutes is how stale
   /api/v1/find is already allowed to be. In this colo a lists answer is filed
   under the lists mark as well, so it is never behind an edit here; five
   minutes is how long a browser, or another site's cache, may keep one. */
const MAX_AGE = 300;

const MAX_QUERY = 200;
const MAX_IDS = 100;
const PLACE_LIMIT = { fallback: 50, most: 100 };
const LIST_LIMIT = { fallback: 20, most: 50 };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Content-Type',
  'Access-Control-Expose-Headers': 'API-Version, Deprecation, Sunset, Link',
  'Access-Control-Max-Age': '86400'
};

/* ------------------------------------------------------------ the answers
 * Every answer goes out through here: the body with the version in it, the
 * CORS headers, API-Version, the sunset pair once there is a sunset, and a
 * cache time — five minutes for an answer, one for a 404 (an id somebody is
 * about to make public), none for anything else that went wrong.
 * `Cross-Origin-Resource-Policy: cross-origin` because a page on another
 * site is exactly who this is for; functions/_security.js would otherwise
 * hand every /api/ answer `same-site`.
 */
function answer(body, status) {
  const ok = !status || status === 200;
  const headers = {
    ...CORS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': ok ? 'public, max-age=' + MAX_AGE : status === 404 ? 'public, max-age=60' : 'no-store',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'API-Version': String(VERSION),
    'Link': '<' + SITE + '/developers>; rel="service-doc"'
  };
  if (SUNSET) {
    headers['Deprecation'] = 'true';
    headers['Sunset'] = new Date(SUNSET + 'T00:00:00Z').toUTCString();
  }
  return new Response(JSON.stringify({ version: VERSION, ...body }), { status: status || 200, headers });
}

/* An error is `{ version, error: { code, message } }`: the code is one of
   the five words below and is what a client branches on, the message is a
   sentence for whoever is reading the logs. */
const ERRORS = {
  'bad-request': 400,
  'not-found': 404,
  'closed': 404,
  'method-not-allowed': 405,
  'unavailable': 503
};

function fail(code, message) {
  return answer({ error: { code, message } }, ERRORS[code]);
}

/* A bad parameter, thrown from the readers below and turned into a 400. */
class Bad extends Error {}

/* ------------------------------------------------------------ the asking */
function intParam(params, key, { fallback, least, most }) {
  const raw = params.get(key);
  if (raw === null || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) throw new Bad(key + ' must be a whole number');
  const n = Number(raw);
  if (n < least || (most !== undefined && n > most)) {
    throw new Bad(key + ' must be ' + (most === undefined ? 'at least ' + least : least + ' to ' + most));
  }
  return n;
}

function page(params, limits) {
  return {
    limit: intParam(params, 'limit', { fallback: limits.fallback, least: 1, most: limits.most }),
    offset: intParam(params, 'offset', { fallback: 0, least: 0 })
  };
}

/* The rows of one page of `found`, and where the next page starts. */
function paged(found, { limit, offset }) {
  return {
    total: found.length,
    offset,
    limit,
    next: offset + limit < found.length ? offset + limit : null,
    rows: found.slice(offset, offset + limit)
  };
}

function langParam(params, langs) {
  const lang = params.get('lang');
  if (!lang) return DEFAULT_LANG;
  if (!langs.includes(lang)) throw new Bad('lang must be one of ' + langs.join(', '));
  return lang;
}

function nearParam(params) {
  const raw = params.get('near');
  if (!raw) return null;
  const m = raw.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (!m) throw new Bad('near must be <lat>,<lng>');
  const at = { lat: Number(m[1]), lng: Number(m[2]) };
  if (!nearTallinn(at.lat, at.lng)) throw new Bad('near is not in Tallinn');
  return at;
}

/* ------------------------------------------------------------- a place
 * One place as v1 says it — the map's own fields and nothing of Google's.
 * WHAT IS NOT HERE, ON PURPOSE. Every key is in data/api-v1.json, and none
 * may go.
 */
function placeRow(place, lang) {
  const photos = place.photos || [];
  return {
    id: place.id,
    name: place.name,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    types: place.types || [],
    price: place.price || null,
    blurb: place.blurb && (place.blurb[lang] || place.blurb[DEFAULT_LANG]) || '',
    must_order: place.mustOrder || [],
    photo: photos.length ? photoUrl(place, photos[0]) : null,
    phone: place.phone || null,
    website: place.website || null,
    reel: place.reel || null,
    reel_summary: place.reelSummary || null,
    visited: place.visited || null,
    added: place.added || null,
    url: placeUrl(place.id)
  };
}

function placeWhole(place, lang) {
  return {
    ...placeRow(place, lang),
    photos: (place.photos || []).map((photo) => photoUrl(place, photo)),
    maps_url: mapsSearch(place.name, place.address)
  };
}

async function deployment(context) {
  const [all, taxonomy, index] = await Promise.all([
    mapPlaces(context),
    dataFile(context, '/data/taxonomy.json'),
    languageIndex(context)
  ]);
  return { all, types: taxonomy.types, langs: Object.keys(index) };
}

async function places(context, params) {
  const { all, types, langs } = await deployment(context);
  const open = all.filter((p) => !p.closed);
  const lang = langParam(params, langs);

  const type = params.get('type');
  if (type && !types.some((t) => t.id === type)) {
    throw new Bad('type must be one of ' + types.map((t) => t.id).join(', '));
  }
  const maxPrice = intParam(params, 'max_price', { fallback: null, least: 1, most: 4 });
  const at = nearParam(params);
  const radius = intParam(params, 'radius', { fallback: null, least: 1 });
  if (radius !== null && !at) throw new Bad('radius needs near');
  const query = (params.get('q') || '').slice(0, MAX_QUERY);
  const words = wordsOf(query);
  const ids = params.get('ids');
  const asked = ids ? ids.split(',').map((id) => id.trim()).filter(Boolean) : null;
  if (asked && asked.length > MAX_IDS) throw new Bad('ids takes at most ' + MAX_IDS);
  const limits = page(params, PLACE_LIMIT);

  let pool = open;
  if (asked) {
    const byId = new Map(open.map((p) => [p.id, p]));
    pool = asked.map((id) => byId.get(id)).filter(Boolean);
  }
  let found = [];
  for (const place of pool) {
    if (type && !(place.types || []).includes(type)) continue;
    if (maxPrice !== null && place.price > maxPrice) continue;
    const far = at ? km(at, place) * 1000 : null;
    if (radius !== null && far > radius) continue;
    const hits = words.length ? matchScore(place, types, lang, words) : 0;
    if (words.length && !hits) continue;
    found.push({ place, far, hits });
  }
  /* `ids` keeps the order it was asked in; anything else is nearest, then
     best matched, then by name — never a ranking of the places. */
  if (!asked) {
    found.sort((a, b) => {
      if (at && a.far !== b.far) return a.far - b.far;
      if (b.hits !== a.hits) return b.hits - a.hits;
      return byName(a.place, b.place);
    });
  }
  const { rows, ...meta } = paged(found, limits);
  return answer({
    ...meta,
    places: rows.map((f) => {
      const row = placeRow(f.place, lang);
      if (at) row.distance_m = Math.round(f.far);
      return row;
    })
  });
}

async function place(context, params, id) {
  const { all, langs } = await deployment(context);
  const lang = langParam(params, langs);
  const found = all.find((p) => p.id === id);
  if (!found) return fail('not-found', 'There is no place with the id "' + id + '" on the map.');
  if (found.closed) return fail('closed', found.name + ' has closed and is no longer on the map.');
  return answer({ place: placeWhole(found, lang) });
}

async function types(context) {
  const { types: all, langs } = await deployment(context);
  return answer({
    types: all.map((t) => ({
      id: t.id,
      names: Object.fromEntries(langs.filter((code) => t[code]).map((code) => [code, t[code]]))
    }))
  });
}

/* ------------------------------------------------------------- the lists */
async function readable(env) {
  return !!env.DB && !(await wrongDatabase(env));
}

/* `mark` is the lists mark the door asked for the colo's key, and null where
   it could not be read — every public list read afresh then, and the answer
   not kept. */
async function listIndex(context, params, mark) {
  const by = foldWords((params.get('by') || '').slice(0, 40)).trim();
  const words = wordsOf((params.get('q') || '').slice(0, MAX_QUERY));
  const limits = page(params, LIST_LIMIT);
  if (!(await readable(context.env))) return fail('unavailable', 'The lists cannot be read right now; the places can.');
  const every = mark ? await keptLists(context.env, mark) : await publicLists(context.env);
  const found = matchLists(every, words, by);
  const { rows, ...meta } = paged(found, limits);
  return answer({
    ...meta,
    lists: rows.map((list) => ({
      id: list.id,
      title: list.title,
      intro: list.intro,
      by: list.by,
      places: list.names.length,
      first_places: list.names.slice(0, 3),
      url: listUrl(list.id)
    }))
  });
}

async function oneList(context, id) {
  if (!LIST_ID.test(id)) return fail('not-found', 'There is no public list with the id "' + id + '".');
  if (!(await readable(context.env))) return fail('unavailable', 'The lists cannot be read right now; the places can.');
  /* Signed out, whoever is asking: a private list is the same 404 as one
     that was never made. */
  const list = await readList(context, id, null);
  if (!list) return fail('not-found', 'There is no public list with the id "' + id + '".');
  const all = await mapPlaces(context);
  return answer({
    list: {
      id: list.id,
      title: list.title,
      intro: list.intro || '',
      by: list.by,
      /* The marker its author chose for its places, one of the forty-five
         ids in functions/api/_pins.js, and '' where they chose none. /embed
         draws it on every row the map does not have, as the map does. */
      pin: list.pin,
      places: list.items.length,
      url: listUrl(list.id),
      items: listRows(list, all)
    }
  });
}

/* ------------------------------------------------------------- the index */
function index() {
  return answer({
    name: 'Tallinn Tastebuds API',
    docs: SITE + '/developers',
    sunset: SUNSET,
    endpoints: [
      '/api/v1/places', '/api/v1/places/{id}',
      '/api/v1/lists', '/api/v1/lists/{id}',
      '/api/v1/types'
    ]
  });
}

/* ------------------------------------------------------ the apps' routes
 * Everything the site's pages, the iPhone app, Kohuke and Rattatee ask for,
 * at its v1 address. Each is the site's own route, called as it is — the
 * handler in ../<name>.js, the same cookie, the same answer, the same
 * errors — so the code is where it always was and only the address moved.
 *
 * Two are renamed, because v1's public reads above already hold the name:
 *
 *   /api/places   is   /api/v1/find       the city search, the map and
 *                                          Google's rows merged, which the
 *                                          apps' search and Where to? read
 *   /api/lists    is   /api/v1/me/lists   your lists, and every write to one
 *
 * Every other is the old name under /api/v1/: /api/v1/account, /api/v1/saves
 * and so on down APPS. One is not in APPS because it has a file of its own,
 * which Pages finds before this catch-all: /api/v1/rides/<id> is
 * ./rides/[id].js, one ride to its rider, a second segment this table has no
 * room for. The old addresses under /api/ answer a 410 naming the new one —
 * the MOVED block in functions/_middleware.js — since 2026-11-21, once the
 * apps' builds and then the pages had moved. Nothing under /api/admin/ is
 * here, deliberately: the middleware locks that prefix to the owner, and an
 * alias of it would be a way round the lock.
 *
 * Google's sign-in starts at /api/v1/google as well as at /api/google, and
 * still comes back to /api/google: the address Google returns to is
 * GOOGLE_PATH in ../_google.js, registered in Google's console, and moving
 * it is a change there first. So /api/google is the one old address that
 * still answers.
 *
 * None of this goes through the colo copy or the CORS headers the public
 * reads carry: these read sessions, and a cookie-bearing answer is nobody
 * else's to cache or to read from another site.
 */
const APPS = new Map([
  ['account', account], ['apple', apple], ['google', google], ['saves', saves],
  ['find', find], ['profile', profile], ['pass', pass], ['discover', discover],
  ['walk', walk], ['rides', rides], ['route', route], ['geocode', geocode],
  ['lookup', lookup], ['ask', ask], ['flashcard', flashcard], ['say', say],
  ['seen', seen]
]);

function appRoute(parts) {
  if (parts.length === 2 && parts[0] === 'me' && parts[1] === 'lists') return mine;
  return parts.length === 1 ? APPS.get(parts[0]) || null : null;
}

/* The handler a Pages route would have been called with for this method:
   onRequestGet for a GET (and a HEAD, as Pages does), and so on. */
function handlerOf(mod, method) {
  const name = 'onRequest' + (method === 'HEAD' ? 'Get' : method.charAt(0) + method.slice(1).toLowerCase());
  return mod[name] || mod.onRequest || null;
}

/* --------------------------------------------------------------- the door */
async function read(context, parts, params, mark) {
  const [what, id, more] = parts;
  if (more !== undefined) return null;
  if (what === undefined) return index();
  if (what === 'places') return id === undefined ? places(context, params) : place(context, params, id);
  if (what === 'lists') return id === undefined ? listIndex(context, params, mark) : oneList(context, id);
  if (what === 'types' && id === undefined) return types(context);
  return null;
}

export async function onRequest(context) {
  const { request } = context;
  const method = request.method;
  const parts = [].concat(context.params.path || []).filter(Boolean);

  const app = appRoute(parts);
  if (app) {
    const handler = handlerOf(app, method);
    if (handler) return handler(context);
    const allowed = ['Get', 'Post'].filter((m) => app['onRequest' + m]).map((m) => m.toUpperCase());
    return new Response(JSON.stringify({ error: 'method' }), {
      status: 405,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', Allow: allowed.join(', ') }
    });
  }

  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (method !== 'GET' && method !== 'HEAD') {
    const res = fail('method-not-allowed', 'This API only reads: GET, HEAD and OPTIONS.');
    res.headers.set('Allow', 'GET, HEAD, OPTIONS');
    return res;
  }

  /* The colo copy first — WHAT IT COSTS. Keyed on the address, since nothing
     here reads who is asking, and a lists answer on the lists mark as well,
     so this colo never hands one out from before an edit: WHEN A LIST LAST
     CHANGED in ../_lists.js. A lists answer whose mark could not be read is
     made and not kept. */
  const url = new URL(request.url);
  const address = new URL(url.toString());
  let mark = null;
  if (parts[0] === 'lists' && (await readable(context.env))) {
    try {
      mark = await listsMark(context.env);
      address.searchParams.set('lists', mark);
    } catch (e) {
      mark = null;
    }
  }
  const cache = typeof caches !== 'undefined' && (parts[0] !== 'lists' || mark) ? caches.default : null;
  const key = new Request(address.toString(), { method: 'GET' });
  const kept = cache ? await cache.match(key) : null;
  if (kept) return method === 'HEAD' ? new Response(null, kept) : kept;

  let res;
  try {
    res = await read(context, parts, url.searchParams, mark) ||
      fail('not-found', 'There is nothing at ' + url.pathname + '. ' + SITE + '/developers lists what there is.');
  } catch (e) {
    if (!(e instanceof Bad)) throw e;
    res = fail('bad-request', e.message);
  }
  if (cache && res.status === 200 && context.waitUntil) context.waitUntil(cache.put(key, res.clone()));
  return method === 'HEAD' ? new Response(null, res) : res;
}
