/**
 * Tallinn Tastebuds — GET /api/discover
 *
 * What the front page offers a phone before the map: the newest public lists,
 * the most opened ones, and which places on the map get opened most. One
 * answer for all three shelves, because the page that draws them — Discover,
 * assets/discover.js — is the first thing a stranger sees and three requests
 * would be three chances for it to arrive in pieces.
 *
 *   { fresh:   [ { id, title, by, pin, taste } … ],   newest first
 *     popular: [ the same shape … ],                  most opened first
 *     opened:  [ place id … ],                        most opened first
 *     routes:  [ { id, title, pin, places, finished, best, mode } … ],
 *     route:   the first of routes, or null }
 *
 * WHAT IT IS MADE OF, AND WHY NOTHING IN IT IS NEW
 *
 * The two shelves of lists are the directory's own query — mostKept() in
 * _mostkept.js, under the two orders /lists already offers — cut to SHELF
 * rows and to the fields a card prints. So a list is on a shelf exactly when
 * it is on /lists: public, and past MIN_ITEMS there. Google's six are ranked
 * among everybody else's, which is that file's decision and its argument.
 *
 * The places are press_counts, the table /admin/stats ranks the map from,
 * read for its order alone. THE NUMBERS NEVER LEAVE: a count under a place is
 * a score, and this map does not score — being on it is the verdict. The
 * order says what people look at, which is a fact about the visitors rather
 * than a judgement about the kitchens, and the shelf says so in its own line.
 * Ids only, too: the page already holds data/map.json, and decides for itself
 * which of these are still on the map and still open. More ids than a shelf
 * draws, so a place that has closed since costs a card and not the row.
 *
 * THE ROUTES ARE LISTS TO GO ROUND
 *
 * Any list can be walked — functions/api/walk.js is the game — and nothing on
 * the front page said so. `routes` are the lists the page's Play card offers,
 * swiped through one at a time, at most ROUTES: first the public lists most
 * people have finished, the latest finish breaking a tie, each with how many
 * finished it, the fastest of them in milliseconds and how that one went
 * round; then, to fill what is left, the most opened lists, with `finished`
 * nought, where the card invites rather than reports. `places` is the doors a
 * walk counts, the ones with a location, so the number on the card is the
 * number a walker has to reach, and a list with none is left out. Empty where
 * no list can be offered, and the card is then not drawn. `route` is the
 * first of them, which is all a page from before the swipe reads.
 *
 * They are the same for everybody, which is why they can live in this answer.
 * The reader's own walks, where they have some going, are per person and are
 * asked of /api/walk?mine=1 by a signed-in page alone.
 *
 * WHO MAY ASK, AND WHAT IT COSTS
 *
 * Anybody, signed in or not, and the answer is the same for all of them — it
 * reads no session, which is what lets it be kept: five minutes in the
 * browser and five in the colo, the way GET /api/saves keeps its counts. A
 * list made a minute ago is on the shelf within five, and nothing here is
 * worth a purge.
 *
 * Without a database, or on the wrong one, the answer is three empty shelves
 * rather than an error: the page draws the map's own card, leaves the lists
 * out, and is still a front page. A shelf that throws is left empty and the
 * others stand — press_counts arriving late on a database must not cost the
 * lists, and the other way round.
 */

import { json, weakTag, withNotModified, wrongDatabase } from './_lib.js';
import { mostKept } from './_mostkept.js';
import { readList } from './_lists.js';
import { doors } from './walk.js';

/* How many lists a shelf carries. A shelf scrolls sideways, and past eight
   the door at its end — See all, to /lists — is the better way on. */
const SHELF = 8;

/* How many place ids are sent for a shelf that draws SHELF of them: the
   spares are for the ones the page drops as closed or gone. */
const OPENED = 16;

/* How many lists the Play card can be swiped through, before the reader's own
   walks are put in front of them. Past five the dots under it stop being
   countable at a glance, and /lists is the way on. */
const ROUTES = 5;

const TTL = 300;

const EMPTY = { fresh: [], popular: [], opened: [], route: null, routes: [] };

function discoverKey(request) {
  return new Request(new URL('/api/discover', request.url).toString());
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
    return (await mostKept(context, { sort })).all.slice(0, SHELF).map(card);
  } catch (e) {
    return [];
  }
}

async function opened(env) {
  try {
    const { results } = await env.DB
      .prepare("SELECT id FROM press_counts WHERE kind = 'place' ORDER BY n DESC, id ASC LIMIT ?")
      .bind(OPENED)
      .all();
    return results.map((row) => row.id);
  } catch (e) {
    return [];
  }
}

/* The lists the Play card offers — THE ROUTES ARE LISTS TO GO ROUND. Two small
   reads where somebody has finished something: which lists, most finishers
   first, and every finished walk of those lists, of which the fastest is
   kept. `fallback` is the most opened lists' ids, which fill whatever is left
   of ROUTES. Anything thrown — the two tables not applied yet among them — is
   no finish to report, and the fallback stands alone. */
async function routes(context, fallback) {
  const { env } = context;
  let top = [];
  const best = new Map();
  try {
    top = (await env.DB
      .prepare(
        'SELECT w.list_id AS id, COUNT(*) AS n FROM walks w ' +
        'JOIN lists l ON l.id = w.list_id ' +
        'WHERE w.finished_at IS NOT NULL AND l.public = 1 ' +
        'GROUP BY w.list_id ORDER BY n DESC, MAX(w.finished_at) DESC LIMIT ?'
      )
      .bind(ROUTES)
      .all()).results;
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
  } catch (e) { /* nobody has finished anything this database knows of */ }

  const finished = new Map(top.map((row) => [row.id, row.n]));
  const ids = [...new Set([...top.map((row) => row.id), ...fallback])].slice(0, ROUTES);
  const lists = await Promise.all(ids.map((id) => readList(context, id, null).catch(() => null)));
  return lists
    .map((list) => {
      const places = list ? doors(list).length : 0;
      if (!places) return null;
      const fastest = best.get(list.id);
      return {
        id: list.id,
        title: list.title,
        pin: list.pin,
        places,
        finished: finished.get(list.id) || 0,
        best: fastest ? fastest.took : null,
        mode: fastest ? fastest.mode : null
      };
    })
    .filter(Boolean);
}

export async function onRequestGet(context) {
  const { env, request } = context;
  if (!env.DB || await wrongDatabase(env)) return json(EMPTY, 200, TTL);

  const cache = caches.default;
  const key = discoverKey(request);
  const hit = await cache.match(key);
  if (hit) return withNotModified(request, hit);

  const [fresh, popular, places] = await Promise.all([
    shelf(context, 'new'),
    shelf(context, 'views'),
    opened(env)
  ]);

  const play = await routes(context, popular.map((list) => list.id));

  const body = JSON.stringify({ fresh, popular, opened: places, route: play[0] || null, routes: play });
  const res = new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=' + TTL,
      etag: await weakTag(body)
    }
  });
  context.waitUntil(cache.put(key, res.clone()));
  return withNotModified(request, res);
}
