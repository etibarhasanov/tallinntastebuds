/**
 * Tallinn Tastebuds — what the two public doors say the same way.
 *
 * Two routes hand the map and the public lists to code somebody else wrote:
 * ./mcp.js, to an AI assistant over the Model Context Protocol, and
 * ./api/v1/[[path]].js, the public API, to anybody's app or web page as
 * plain JSON. Each answers in its own shape and is held to its own promise —
 * tools/mcpcheck.mjs and tools/apicheck.mjs — but underneath they read the
 * same rows the same way, and two copies of that would be two answers to
 * "which places does the word `soup` find" drifting apart a week at a time.
 * So the reading is here and the shaping is in each route:
 *
 *   photoUrl()       a photograph's address on the site
 *   mapsSearch()     a Google Maps search for a name and an address
 *   matchPlaces()    the places a query's words land on, and how well
 *   publicLists()    every public list long enough to be offered, with its
 *                    places' names, in one read
 *   listRows()       one list's rows, each said where it opens on the map
 *
 * It was in ./mcp.js while that was the only door, and came out the day the
 * second arrived.
 */

import { foldWords } from './api/_lib.js';
import { MIN_ITEMS } from './api/_mostkept.js';
import { SITE } from './_shell.js';

/* The version of /api/v1 — the `version` every public answer under it
   carries and the API-Version header beside it: ./api/v1/[[path]].js, and
   of the apps' routes the one that says it too, ./api/route.js. */
export const VERSION = 1;

/* The language a write-up falls back to when the one asked for is missing,
   and the one a search is read in beside the asked-for one. The same
   constant is DEFAULT_LANG in functions/index.js and assets/app.js. */
export const DEFAULT_LANG = 'en';

export function photoUrl(place, photo) {
  return SITE + '/photos/' + encodeURIComponent(place.id) + '/' + encodeURIComponent(photo);
}

export const placeUrl = (id) => SITE + '/?spot=' + encodeURIComponent(id);
export const listUrl = (id) => SITE + '/list/' + encodeURIComponent(id);

/* A Google Maps search for a name and an address, which is a link anybody
   could type and carries nothing out of the export: a place read by its id
   has one, and so does a place on a list typed in by hand. With
   Google's key beside it, the search opens that one listing rather than
   Google's guess at the words — the address Google documents for it, and
   the one the map's own panel sends. */
export function mapsSearch(name, address, key) {
  return 'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(address ? name + ', ' + address : name + ', Tallinn') +
    (key ? '&query_place_id=' + encodeURIComponent(key) : '');
}

/* A query as words: folded, split on anything that is not a letter or a
   digit, and the one-character pieces dropped, since "a" is in every name. */
export function wordsOf(query) {
  return foldWords(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1);
}

/* ------------------------------------------------------------- a search
 * What a query's words are matched against, per place: the name, the kinds
 * of place in the asked-for language and in English, the dishes, the
 * street, and the write-up in both languages — folded the way the map's
 * find bar folds, so an accent typed or left out makes no difference. The
 * weights say where a word landing counts for more: a word in the name is
 * the place, a word in the write-up is a mention.
 */
const WEIGHTS = [['name', 4], ['kinds', 3], ['dishes', 3], ['where', 2], ['words', 1]];

function haystack(place, types, lang) {
  const kinds = (place.types || []).map((id) => {
    const type = types.find((t) => t.id === id);
    return type ? [type[lang], type[DEFAULT_LANG]].join(' ') : id;
  });
  const blurb = place.blurb || {};
  return {
    name: foldWords(place.name),
    kinds: foldWords(kinds.join(' ')),
    dishes: foldWords((place.mustOrder || []).join(' ')),
    where: foldWords(place.address),
    words: foldWords([blurb[lang], blurb[DEFAULT_LANG]].join(' '))
  };
}

/* How well the words land on one place: nought for none of them, which a
   caller with words reads as "not found". A word counts once, at the
   heaviest field it is in. */
export function matchScore(place, types, lang, words) {
  const hay = haystack(place, types, lang);
  let total = 0;
  for (const word of words) {
    for (const [field, weight] of WEIGHTS) {
      if (hay[field].includes(word)) { total += weight; break; }
    }
  }
  return total;
}

/* Alphabetical by the folded name: the tie-break both doors use, since the
   order places come back in is never a ranking. */
export function byName(a, b) {
  const x = foldWords(a.name);
  const y = foldWords(b.name);
  return x < y ? -1 : x > y ? 1 : 0;
}

/* ------------------------------------------------------------- the lists
 * Every public list of MIN_ITEMS places or more, with its places' names, in
 * one read: the lists joined to their rows and grouped here, so a word can
 * land on a place deep in a list and not only on the three the lists page
 * prints. Every row of every public list, a couple of hundred today; it
 * grows with what people write, and READ_CAP is where it stops rather than
 * where it should ever arrive — the day it does, this wants the LIKE search
 * mostKept() in functions/api/_mostkept.js already runs, with its paging.
 */
const READ_CAP = 2000;

export const LIST_WEIGHTS = [['title', 4], ['intro', 3], ['by', 2], ['names', 2]];

export async function publicLists(env) {
  const { results } = await env.DB
    .prepare(
      'SELECT l.id AS id, l.title AS title, l.intro AS intro, u.username AS by, i.name AS name ' +
      'FROM lists l LEFT JOIN users u ON u.id = l.owner ' +
      'JOIN list_items i ON i.list_id = l.id ' +
      'WHERE l.public = 1 ORDER BY l.id, i.pos LIMIT ?'
    )
    .bind(READ_CAP)
    .all();
  const lists = new Map();
  for (const row of results) {
    if (!lists.has(row.id)) {
      lists.set(row.id, { id: row.id, title: row.title, intro: row.intro || '', by: row.by || null, names: [] });
    }
    lists.get(row.id).names.push(row.name);
  }
  return [...lists.values()].filter((l) => l.names.length >= MIN_ITEMS);
}

/* The public lists the words land on, best first and then by title — not by
   how often a list is opened, which is the lists page's order and a ranking
   neither door has any reason to repeat. `by` keeps one author's alone. */
export function matchLists(lists, words, by) {
  const found = [];
  for (const list of lists) {
    if (by && foldWords(list.by || '') !== by) continue;
    const hay = {
      title: foldWords(list.title),
      intro: foldWords(list.intro),
      by: foldWords(list.by || ''),
      names: foldWords(list.names.join(' '))
    };
    let hits = 0;
    for (const word of words) {
      for (const [field, weight] of LIST_WEIGHTS) {
        if (hay[field].includes(word)) { hits += weight; break; }
      }
    }
    if (words.length && !hits) continue;
    found.push({ list, hits, title: hay.title });
  }
  found.sort((a, b) => b.hits - a.hits || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
  return found.map((f) => f.list);
}

/* One list's rows as readList() in ./api/_lists.js hands them over, each in
 * the author's order and words, with its name, address and point, where it
 * opens, and the map's id when the place is approved.
 *
 * A Google row for a place on the map is `map` too, and carries the map's id
 * in `mapId`; a row of mine has only `map`, and its own id is the map's.
 * Every other Google row is on the map as well, out of the find bar's roll,
 * and ?spot= with its key opens it there — a Google key always carries
 * capitals, the rule paintShare() in assets/app.js reads. Only a place typed
 * in by hand, lowercase and in no roll, has nowhere on the map to open, and
 * gets a Google Maps search.
 *
 * `all` is the whole roll, closed places included: a place on the map brings
 * its video onto the list with it, since the list row does not carry one, and
 * a place that has closed since says so.
 */
export function listRows(list, all) {
  const closed = new Set(all.filter((p) => p.closed).map((p) => p.id));
  const reels = new Map(all.filter((p) => p.reel).map((p) => [p.id, p.reel]));
  return list.items.map((row, i) => {
    const mapId = row.mapId || (row.map ? row.place : null);
    const spot = mapId || (/[A-Z]/.test(row.place) ? row.place : null);
    const out = {
      position: i + 1,
      name: row.name,
      note: row.say || null,
      must_order: row.mustOrder || null,
      address: row.address || null,
      lat: row.lat,
      lng: row.lng,
      approved: !!mapId,
      place_id: mapId || null,
      reel: mapId && reels.get(mapId) || null,
      url: spot ? placeUrl(spot) : mapsSearch(row.name, row.address)
    };
    if (mapId && closed.has(mapId)) out.closed = true;
    return out;
  });
}
