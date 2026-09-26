/**
 * Tallinn Tastebuds — /api/admin/stats, the ranking of what gets pressed.
 *
 *   GET ?lang=   the whole ranking, the page's words beside it, and five
 *                minutes of edge cache on the pair. What /admin/stats draws.
 *
 * The presses themselves are counted by POST /api/stats in ../stats.js, which
 * anybody may send and every page does; that file says what is counted and
 * why. This is the other end of the same table, and it is the owner's alone.
 *
 * WHO MAY READ IT
 *
 * Only the owner. Everything under /api/admin/ is answered by the lock in
 * functions/_middleware.js first — adminUser() in ../_admin.js, a 403 to
 * anybody else — so this file never sees a request that is not the owner's
 * and does not check again. The ranking is how the site is used: which places
 * get opened, which buttons get pushed, how many accounts there are.
 *
 * The colo cache stays, because it is still the cost control, and what goes
 * back to the browser is `private, no-store` whatever the cached copy says,
 * so no cache between here and the owner's phone can hand the ranking to the
 * next person to ask. See privately() below.
 *
 * THE MAP IS THE RANKING AND THE OTHER THREE ARE FOOTNOTES
 *
 * The answer carries the map's own places in full, zeros included, because
 * those are the places this site is about and the bottom of that list is as
 * much of an answer as the top: a ranking that printed only what has been
 * opened would quietly drop the places nobody has, which is the half the page
 * was asked for. The 1,111 Google venues are an array of their own and only
 * the ones somebody has actually pressed, capped at VENUES — a thousand rows
 * tied at nought is not a ranking, and the directory is not the map. The
 * filters are the third array, in full, because there are fourteen of them,
 * and the rail is the fourth, in full, because there are nine.
 *
 * WHAT A FAILURE LOOKS LIKE
 *
 * `ready: false` and empty arrays, 200, with the words still in the answer —
 * no database, the other environment's database, or db/schema.sql not applied
 * yet, which is the one that will actually happen: the table arrives by hand
 * and there is always an afternoon between the deploy and somebody running it.
 * The page then says the numbers are not in yet and draws the rest of itself.
 *
 * ONE NUMBER ABOUT THE SITE RATHER THAN ABOUT A PRESS
 *
 * `users` is how many accounts exist, `SELECT COUNT(*) FROM users` read fresh
 * on every cache miss — the table is small enough that a running counter
 * would be one more thing to keep in step for no reason. It answers 0 rather
 * than failing the rest of the page when `users` is not there yet, the same
 * way the ranking above answers empty rather than failing when `press_counts`
 * is not.
 */

import {
  json, wrongDatabase, mapPlaces, venuesByIds, dataFile, wordsFor
} from '../_lib.js';
/* The kinds, the pills and the deal chip are the counting side's, so the
   ranking reads the table with the same words it was written with. */
import { PLACE, FILTER, RAIL, RAIL_PILLS, DEAL_FILTER } from '../stats.js';

/* Five minutes in the colo, which is what the page is allowed to be stale by.
 *
 * Nothing purges this. A save purges the counts cache because the number it
 * changed is on the screen that changed it — press the mark, see the count go
 * up — and nothing here is like that: the ranking is read on a page of its
 * own, by somebody who is not the person whose press moved it. Five minutes is
 * also what /api/places holds, and this reads the same shape of table it does.
 *
 * It is the only thing between this route and the database, so it is also the
 * cost control: however often /admin/stats is opened, each colo asks D1
 * twelve times an hour per language and no more. Nothing reaches it before the
 * owner check in functions/_middleware.js, so holding it never hands the
 * answer to anybody else. */
const TTL = 300;

/* How many Google venues the second table prints. Twenty-five is a screen of
   them on a phone and about as far down a list of places nobody has been to as
   anybody reads. The cap is here rather than in the page because it also
   bounds the lookup below — venuesByIds() takes fifty ids at a time, so this
   is one query however many venues have been pressed. */
const VENUES = 25;

export async function onRequestGet(context) {
  const { request, env } = context;

  /* The words first, and before anything that can fail, because every answer
     this route gives carries them — including the ones that carry no numbers.
     A page that cannot say "nothing has been opened yet" in the language it is
     being read in is a page printing its own keys at somebody.

     Two of the three things wordsFor() answers with. The third is `langs`, the
     ten codes with each language's own name, and it is dropped here: the
     flashcards page has a switch to draw out of it and this one does not, so
     sending it would be ten pairs in every answer that nothing reads. */
  const { lang, ui } = await wordsFor(context, new URL(request.url).searchParams.get('lang'));
  const words = { lang: lang, ui: ui };

  const cache = caches.default;
  const key = statsKey(request, words.lang);
  const hit = await cache.match(key);
  if (hit) return privately(hit);

  const empty = {
    ready: false, opens: 0, users: 0, map: [], venues: [], filters: [], rail: [], ...words
  };
  if (!env.DB) return json(empty, 200);
  /* A deployment holding the other environment's database answers as though it
     had no database at all — the same rule /api/saves follows, and for the
     same reason: a preview showing the live numbers is the same mistake as
     writing to them. */
  if (await wrongDatabase(env)) return json(empty, 200);

  let rows;
  try {
    const answer = await env.DB
      .prepare('SELECT kind, id, n FROM press_counts WHERE n > 0')
      .all();
    rows = answer.results || [];
  } catch (e) {
    /* No table yet — see the header. */
    return json(empty, 200);
  }

  const counted = new Map();
  for (const row of rows) counted.set(row.kind + '\u0000' + row.id, row.n);
  const countOf = (kind, id) => counted.get(kind + '\u0000' + id) || 0;

  let places;
  try {
    places = await mapPlaces(context);
  } catch (e) {
    /* The roll of places is unreadable, which is a broken deployment rather
       than an empty ranking. Say the same thing as no database: the page draws
       and has nothing to print. */
    return json(empty, 200);
  }

  /* The map, every one of them, most opened first.

     The tie-break is the name, and it has to be something: without it two
     places on nought come back in whatever order the roll happens to be in,
     which changes when a place is added and makes a stable-looking table
     shuffle for no reason anybody could explain. localeCompare rather than <,
     so Õ sorts where a reader expects rather than after Z. */
  const map = places
    .map((p) => ({
      id: p.id,
      name: p.name,
      n: countOf(PLACE, p.id),
      /* A shut place is still on the map, still has a card and can still be
         opened, so it is still in the ranking — but a row at the bottom of one
         needs to say why it is there, or the table reads as a verdict on a
         restaurant that closed in March. See **Close a place instead of
         deleting it** in README.md. */
      closed: !!p.closed
    }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));

  /* Everything counted as a place that is not on the map is one of Google's,
     most pressed first, capped. Sorted before the lookup, so the cap is what
     bounds the query. */
  const onMap = new Set(places.map((p) => p.id));
  const strangers = rows
    .filter((row) => row.kind === PLACE && !onMap.has(row.id))
    .sort((a, b) => b.n - a.n)
    .slice(0, VENUES);

  let venues = [];
  if (strangers.length) {
    try {
      const found = await venuesByIds(env, strangers.map((row) => row.id));
      /* A venue the export no longer carries is dropped rather than printed
         with its key for a name: a refresh takes rows out, and a row nobody
         can put a name to says nothing to anybody reading a ranking. Its count
         stays in the table and in `opens` below, because it happened. */
      venues = strangers
        .filter((row) => found.has(row.id))
        .map((row) => ({ id: row.id, name: found.get(row.id).name, n: row.n }));
    } catch (e) {
      /* The names did not come back. The map's own ranking is the page, and
         this half of it is not worth failing the other half for. */
      venues = [];
    }
  }

  /* Every open this site has counted — the venues past the cap and the ones
     with no name left included, and the filters and the lists not, because a
     chip pressed is not a place looked at, a list opened is somebody's page
     rather than a restaurant, and adding any of the three to the others would
     be a number about nothing.
     It is the one figure on the page that is about the site rather than about
     a restaurant. */
  let opens = 0;
  for (const row of rows) if (row.kind === PLACE) opens += row.n;

  const filters = await ranked(context, words, countOf);
  const rail = railed(words, countOf);

  /* How many accounts exist, about the site rather than about a press — see
     ONE NUMBER ABOUT THE SITE above. Failing this never fails the ranking: a table not
     yet applied answers 0, the same way press_counts answers empty. */
  let users = 0;
  try {
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
    users = (row && row.n) || 0;
  } catch (e) {
    users = 0;
  }

  const res = json(
    {
      ready: true, opens: opens, users: users,
      map: map, venues: venues, filters: filters, rail: rail,
      ...words
    },
    200, TTL
  );
  context.waitUntil(cache.put(key, res.clone()));
  return privately(res);
}

/* The colo's copy carries `public, max-age` because the Cache API will not
   store anything less; the browser's copy carries `private, no-store`,
   because the only person allowed to read it is the one who just asked. */
function privately(res) {
  const out = new Response(res.body, res);
  out.headers.set('cache-control', 'private, no-store');
  return out;
}

/* Every chip on the map, most pressed first, named in the reading language.
 *
 * In full rather than only the pressed ones, for the reason the map's own
 * places are in full: a chip nobody has pressed is the answer to the question
 * this table is for. **The order of the filter chips** in README.md is what
 * that question is — the row is in a hand-written order today, and this is the
 * measurement that would argue for a different one.
 *
 * The labels come from the same two files the chips themselves are drawn from:
 * the types out of data/taxonomy.json in the language the answer is in, and
 * the one chip that is not a type out of the ui block already in hand. A type
 * with no label in that language is dropped rather than printed as its id,
 * which is the rule everywhere else on this site — though the validator fails
 * the build on a missing one, so it should not be reachable.
 */
async function ranked(context, words, countOf) {
  let types;
  try {
    const taxonomy = await dataFile(context, '/data/taxonomy.json');
    types = (taxonomy && taxonomy.types) || [];
  } catch (e) {
    /* No taxonomy, no filter table. The page draws the places, which is what
       it is mostly for. */
    return [];
  }

  const rows = types
    .filter((type) => type && typeof type[words.lang] === 'string' && type[words.lang])
    .map((type) => ({ id: type.id, name: type[words.lang], n: countOf(FILTER, type.id) }));

  if (words.ui.filterDiscount) {
    rows.push({
      id: DEAL_FILTER,
      name: words.ui.filterDiscount,
      n: countOf(FILTER, DEAL_FILTER)
    });
  }

  return rows.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}

/* Every pill on the rail, most pressed first, named in the reading language.
 *
 * In full rather than only the pressed ones, for the reason the chips above
 * are in full: a button nobody presses is the answer to the question this
 * table is for. The rail is nine pills deep on a phone and the cascade that
 * introduces them is timed to the sentence under the mark — see
 * introduceRail() in assets/app.js — so which of them earns its slot is a
 * question with a real cost behind it.
 *
 * The tie-break is the rail's own order and not the name: nine buttons on
 * nought sorted alphabetically is a list nobody can read against the thing it
 * describes, and top-to-bottom is how they are stood. A pill whose label is
 * missing from the block is dropped rather than printed as its id, which is
 * the rule the chips follow — the validator fails the build on a missing
 * string, so it should not be reachable.
 */
function railed(words, countOf) {
  return RAIL_PILLS
    .map((pill, at) => ({
      id: pill.id,
      name: words.ui[pill.label],
      n: countOf(RAIL, pill.id),
      at: at
    }))
    .filter((row) => typeof row.name === 'string' && row.name)
    .sort((a, b) => b.n - a.n || a.at - b.at)
    .map((row) => ({ id: row.id, name: row.name, n: row.n }));
}

/* What the colo files the answer under: the route and the language, and never
   the rest of the address. The page sends its whole list of candidate
   languages — "et,en,ru" — and the answer only depends on which one of them
   won, so keying on the raw query would file the same ten answers under
   however many orders browsers happen to send. Ten keys per colo, one per
   language the site speaks. */
function statsKey(request, lang) {
  const url = new URL('/api/admin/stats', request.url);
  url.searchParams.set('lang', lang);
  return new Request(url.toString());
}
