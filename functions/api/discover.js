/**
 * Tallinn Tastebuds — GET /api/v1/discover
 *
 * What the front page offers a phone before the map: the newest public lists,
 * the most opened ones, and which places on the map get opened least. One
 * answer for all three shelves, because the page that draws them — Discover,
 * assets/discover.js — is the first thing a stranger sees and three requests
 * would be three chances for it to arrive in pieces.
 *
 *   { fresh:   [ { id, title, by, pin, taste } … ],   newest first
 *     popular: [ the same shape … ],                  most opened first
 *     quiet:   [ place id … ],                        least opened first
 *     routes:  [ { id, title, pin, places, finished, best, mode } … ],
 *     route:   the first of routes, or null }
 *
 * WHAT IT IS MADE OF, AND WHY NOTHING IN IT IS NEW
 *
 * The two shelves of lists are the directory's own query — mostKept() in
 * _mostkept.js, under the two orders /lists already offers — asked for as a
 * shelf of SHELF rows, three names and no dots each, and cut to the fields a
 * card prints. So a list is on a shelf exactly when
 * it is on /lists: public, and past MIN_ITEMS there. Google's six are ranked
 * among everybody else's, which is that file's decision and its argument.
 *
 * The places are press_counts, the table /admin/stats ranks the map from,
 * read for its order alone. THE NUMBERS NEVER LEAVE: a count under a place is
 * a score, and this map does not score — being on it is the verdict. The
 * order says what people look at, which is a fact about the visitors rather
 * than a judgement about the kitchens, and the shelf says so in its own line.
 * Ids only, too: the page already holds data/map.json.
 *
 * THE SHELF IS THE QUIET END, AND IT EMPTIES ITSELF
 *
 * `quiet` is the QUIET places on the map that have been opened least, and it
 * is what the page draws. Until 2026-11-14 the shelf was the other end, the
 * most opened first, and a shelf like that feeds itself: the eight on it are
 * the eight that get pressed, so they stay the eight. The owner turned it
 * round. A place on this shelf gets opened from it, passes the one behind
 * it, and the one behind takes its card at the next week's making — so the
 * shelf walks up through the map from the bottom, a week at a time, and what
 * it shows is whatever nobody has looked at lately rather than what
 * everybody already has.
 *
 * It is worked out here and not on the page for two reasons. A place nobody
 * has opened has no row in press_counts at all, and it is the quietest there
 * is, so the order needs the map's roll beside the counts; and sending the
 * page enough of the order to find the bottom itself would be sending most
 * of the ranking. Closed places and the ones closed for now are left out
 * before the cut, or the shelf would stand on doors nobody can go through —
 * they are the bottom of the count precisely because they are shut. A tie is
 * broken by id, which is no order at all and is at least the same one twice.
 *
 * The other end of the order is not answered any more. `opened`, the old
 * shelf's ids, stayed for a day in case the iPhone app drew it; it never
 * did, and a field nothing reads is most of a ranking sent for nobody.
 *
 * THE ROUTES ARE LISTS TO GO ROUND
 *
 * Any list can be walked — functions/api/walk.js is the game — and nothing on
 * the front page said so. `routes` are the lists the page's Play card offers,
 * swiped through one at a time, at most ROUTES: first the public lists most
 * people had finished by this week's making, the latest finish breaking a
 * tie, each with how many finished it, the fastest of them in milliseconds
 * and how that one went round; then, to fill what is left, the most opened
 * lists, with `finished` nought, where the card invites rather than reports.
 * `places` is the doors a walk counts, the ones with a location, so the
 * number on the card is the number a walker has to reach, and a list with
 * none is left out. Empty where no list can be offered, and the card is then
 * not drawn. `route` is the first of them, which is all a page from before
 * the swipe reads.
 *
 * They are the same for everybody, which is why they can live in this answer.
 * The reader's own walks, where they have some going, are per person and are
 * asked of /api/v1/walk?mine=1 by a signed-in page alone.
 *
 * THE NUMBERS ARE THE WEEK'S
 *
 * Everything here that comes out of a count holds still from Monday to
 * Monday, as the owner asked on 21 November 2026: Popular lists, which is
 * lists.opens and so last Monday's — THE WEEK THE COUNTS ARE FROM in
 * ./_lists.js — and the quiet places and the Play card's finishers, which
 * are worked out on the first build of a week and kept for everybody in one
 * row of `meta`, `discover_week`, with the week they are of. So the quiet
 * shelf still walks up through the map from the bottom, a week at a time
 * rather than five minutes at a time, and a place opened from it today
 * stays on it until Monday. What a list says — its title, its pin, its
 * places — and which lists are newest are never the week's: those are read
 * on every build, and a build follows every edit.
 *
 * The week's quiet places are kept two deep, QUIET and as many again behind
 * them, so a place that closes during the week leaves the shelf at the next
 * deploy and the one behind it takes its card.
 *
 * WHO MAY ASK, AND WHAT IT COSTS
 *
 * Anybody, signed in or not, and the answer is the same for all of them — it
 * reads no session, which is what lets it be kept: in the colo under the
 * lists mark and the deployment's copy of the map, until a list changes, the
 * week turns or a deploy moves a place — WHEN A LIST LAST CHANGED in
 * ./_lists.js — and in the browser only as long as it takes to ask again
 * with the ETag it holds, a 304 where nothing moved. A list made a minute ago
 * is on New lists at the next visit. Each visit reads one row of `meta`; a
 * build reads the two shelves of lists, the week's row, and the lists the
 * Play card offers; the week's first build reads press_counts and the
 * finished walks besides, once.
 *
 * Without a database, or on the wrong one, the answer is three empty shelves
 * rather than an error: the page draws the map's own card, leaves the lists
 * out, and is still a front page. A shelf that throws is left empty and the
 * others stand — press_counts arriving late on a database must not cost the
 * lists, and the other way round.
 */

import { json, mapPlaces, wrongDatabase } from './_lib.js';
import { mostKept } from './_mostkept.js';
import { readList, listsMark } from './_lists.js';
import { weekOf } from './_rank.js';
import { doors } from './walk.js';
import { REVALIDATE, MARKED_TTL, coloKey, deployStamp, fromColo, keepInColo } from '../_shell.js';

/* How many lists a shelf carries. A shelf scrolls sideways, and past eight
   the door at its end — See all, to /lists — is the better way on. */
const SHELF = 8;

/* How many places the shelf of the least opened carries. Five is the owner's
   number: few enough that a week of opens moves the shelf. */
const QUIET = 5;

/* How many lists the Play card can be swiped through, before the reader's own
   walks are put in front of them. Past five the dots under it stop being
   countable at a glance, and /lists is the way on. */
const ROUTES = 5;

/* How long a browser keeps the three empty shelves a deployment with no
   database answers — the one answer here not kept under the mark, since
   there is no mark to keep it under. */
const EMPTY_TTL = 300;

const EMPTY = { fresh: [], popular: [], quiet: [], route: null, routes: [] };

/* The row of meta the week's numbers are kept in — THE NUMBERS ARE THE
   WEEK'S. */
const WEEKLY = 'discover_week';

/* The copy's address: the route, filed under the deployment's copy of the
   map — a deploy that closes a place makes a new one — and the lists mark. */
function discoverKey(request, stamp) {
  return coloKey(new URL('/api/v1/discover', request.url).toString(), stamp);
}

/* A row of the directory, as a card on a shelf prints it. */
const card = (row) => ({
  id: row.id,
  title: row.title,
  by: row.by,
  pin: row.pin,
  taste: row.taste
});

async function shelf(context, sort) {
  try {
    return (await mostKept(context, { sort, shelf: SHELF })).all.map(card);
  } catch (e) {
    return [];
  }
}

/* The places opened least — THE SHELF IS THE QUIET END — two deep, for the
   week to keep. Every row of the kind is read, because the bottom of the map
   is the roll less the rows and not a query: Google's venues are counted
   under the same kind and are simply never looked up. Once a week now, which
   is what makes that affordable. Null where a count or the roll cannot be
   read, which is a week not kept rather than a map of noughts kept all week. */
async function quiet(context) {
  try {
    const { results } = await context.env.DB
      .prepare("SELECT id, n FROM press_counts WHERE kind = 'place'")
      .all();
    const n = new Map(results.map((row) => [row.id, row.n]));
    return (await mapPlaces(context))
      .filter((place) => !place.closed)
      .map((place) => ({ id: place.id, n: n.get(place.id) || 0 }))
      .sort((a, b) => a.n - b.n || (a.id < b.id ? -1 : 1))
      .slice(0, QUIET * 2)
      .map((place) => place.id);
  } catch (e) {
    return null;
  }
}

/* The lists most people have finished walking, for the week to keep — THE
   ROUTES ARE LISTS TO GO ROUND. Two small reads: which lists, most finishers
   first, and every finished walk of those lists, of which the fastest is
   kept with how it went round. Each { id, n, best, mode }. Anything thrown
   — the two tables not applied yet among them — is nobody having finished
   anything this database knows of, and is not kept, so the week is made
   again by the next build. */
async function finishers(env) {
  try {
    const top = (await env.DB
      .prepare(
        'SELECT w.list_id AS id, COUNT(*) AS n FROM walks w ' +
        'JOIN lists l ON l.id = w.list_id ' +
        'WHERE w.finished_at IS NOT NULL AND l.public = 1 ' +
        'GROUP BY w.list_id ORDER BY n DESC, MAX(w.finished_at) DESC LIMIT ?'
      )
      .bind(ROUTES)
      .all()).results;
    const best = new Map();
    if (top.length) {
      const { results } = await env.DB
        .prepare(
          'SELECT list_id AS id, finished_at - started_at AS took, mode FROM walks ' +
          'WHERE finished_at IS NOT NULL AND list_id IN (' + top.map(() => '?').join(',') + ') ' +
          'ORDER BY took, finished_at'
        )
        .bind(...top.map((row) => row.id))
        .all();
      for (const row of results) if (!best.has(row.id)) best.set(row.id, row);
    }
    return top.map((row) => {
      const fastest = best.get(row.id);
      return { id: row.id, n: row.n, best: fastest ? fastest.took : null, mode: fastest ? fastest.mode : '' };
    });
  } catch (e) {
    return null;
  }
}

/* This week's quiet places and finishers: the row kept for the week where
   there is one, and otherwise made and kept — one row of meta by its key on
   every build, and the two reads above on the week's first. Made again,
   rather than kept, where either could not be read, so a database that was
   down for a moment on Monday morning is not an empty shelf until Sunday.
   Two builds making the same week at once both write it, the same rows a
   second apart. */
async function theWeek(context) {
  const { env } = context;
  const week = weekOf(Date.now());
  try {
    const row = await env.DB.prepare('SELECT value FROM meta WHERE key = ?').bind(WEEKLY).first();
    const kept = row ? JSON.parse(row.value) : null;
    if (kept && kept.week === week) return kept;
  } catch (e) { /* made below */ }

  const [places, finished] = await Promise.all([quiet(context), finishers(env)]);
  const made = { week: week, quiet: places || [], finished: finished || [] };
  if (places && finished) {
    try {
      await env.DB
        .prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        .bind(WEEKLY, JSON.stringify(made))
        .run();
    } catch (e) { /* made again by the next build */ }
  }
  return made;
}

/* The week's quiet places that are still open, QUIET of them. The map's roll
   is the deployment's, so a place closed since Monday is gone from it. */
async function stillOpen(context, ids) {
  try {
    const open = new Set((await mapPlaces(context)).filter((place) => !place.closed).map((place) => place.id));
    return ids.filter((id) => open.has(id)).slice(0, QUIET);
  } catch (e) {
    return [];
  }
}

/* The lists the Play card offers: the week's finishers, then `fallback`, the
   most opened lists' ids, to fill whatever is left of ROUTES — each read as
   it is now, so a title renamed this morning is the new one, and one made
   private or deleted since Monday drops out. */
async function routes(context, finished, fallback) {
  const byId = new Map(finished.map((row) => [row.id, row]));
  const ids = [...new Set([...finished.map((row) => row.id), ...fallback])].slice(0, ROUTES);
  const lists = await Promise.all(ids.map((id) => readList(context, id, null).catch(() => null)));
  return lists
    .map((list) => {
      const places = list ? doors(list).length : 0;
      if (!places) return null;
      const done = byId.get(list.id);
      return {
        id: list.id,
        title: list.title,
        pin: list.pin,
        places,
        finished: done ? done.n : 0,
        best: done ? done.best : null,
        /* How the fastest went round, or '' where they never said — HOW
           THEY WENT ROUND in ./walk.js. */
        mode: done && ['foot', 'bike', 'car', 'mixed'].includes(done.mode) ? done.mode : ''
      };
    })
    .filter(Boolean);
}

export async function onRequestGet(context) {
  const { env, request } = context;
  if (!env.DB || await wrongDatabase(env)) return json(EMPTY, 200, EMPTY_TTL);

  /* The copy this colo holds — WHO MAY ASK, AND WHAT IT COSTS. A stamp or a
     mark that cannot be read is an answer made and not kept. */
  let key = null;
  try {
    const [stamp, mark] = await Promise.all([deployStamp(context, ['/data/restaurants.json']), listsMark(env)]);
    key = discoverKey(request, stamp + '.' + mark);
    const hit = await fromColo(request, key, REVALIDATE);
    if (hit) return hit;
  } catch (e) {
    key = null;
  }

  const [fresh, popular, week] = await Promise.all([
    shelf(context, 'new'),
    shelf(context, 'views'),
    theWeek(context)
  ]);
  const [places, play] = await Promise.all([
    stillOpen(context, week.quiet),
    routes(context, week.finished, popular.map((list) => list.id))
  ]);

  const res = json({ fresh, popular, quiet: places, route: play[0] || null, routes: play }, 200);
  return key ? keepInColo(context, key, res, MARKED_TTL, REVALIDATE) : res;
}
