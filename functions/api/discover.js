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
 *     route:   null | { id, title, pin, places, finished, best, mode } }
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
 * THE ROUTE IS ONE LIST TO GO ROUND
 *
 * Any list can be walked — functions/api/walk.js is the game — and nothing on
 * the front page said so. `route` is the one list the page's Play card offers:
 * the public list most people have finished, the latest finish breaking a
 * tie, with how many finished it, the fastest of them in milliseconds and how
 * that one went round. Until anybody has finished anything it is the most
 * opened list, with `finished` nought, and the card invites rather than
 * reports. `places` is the doors a walk counts, the ones with a location, so
 * the number on the card is the number a walker has to reach. Null where no
 * list can be offered, and the card is then not drawn.
 *
 * It is the same for everybody, which is why it can live in this answer. The
 * reader's own walk, where they have one going, is per person and is asked of
 * /api/walk?mine=1 by a signed-in page alone.
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

const TTL = 300;

const EMPTY = { fresh: [], popular: [], opened: [], route: null };

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

/* The list the Play card offers — THE ROUTE IS ONE LIST TO GO ROUND. Two small
   reads where somebody has finished something: which list, and its fastest
   walk. `fallback` is the most opened list's id, for the days before that.
   Anything thrown — the two tables not applied yet among them — is no finish
   to report, and the fallback stands. */
async function route(context, fallback) {
  const { env } = context;
  let id = fallback;
  let finished = 0;
  let best = null;
  try {
    const top = await env.DB
      .prepare(
        'SELECT w.list_id AS id, COUNT(*) AS n FROM walks w ' +
        'JOIN lists l ON l.id = w.list_id ' +
        'WHERE w.finished_at IS NOT NULL AND l.public = 1 ' +
        'GROUP BY w.list_id ORDER BY n DESC, MAX(w.finished_at) DESC LIMIT 1'
      )
      .first();
    if (top) {
      id = top.id;
      finished = top.n;
      best = await env.DB
        .prepare(
          'SELECT finished_at - started_at AS took, mode FROM walks ' +
          'WHERE list_id = ? AND finished_at IS NOT NULL ' +
          'ORDER BY took, finished_at LIMIT 1'
        )
        .bind(id)
        .first();
    }
  } catch (e) { /* nobody has finished anything this database knows of */ }

  if (!id) return null;
  try {
    const list = await readList(context, id, null);
    const places = list ? doors(list).length : 0;
    if (!places) return null;
    return {
      id: list.id,
      title: list.title,
      pin: list.pin,
      places,
      finished,
      best: best ? best.took : null,
      mode: best ? best.mode : null
    };
  } catch (e) {
    return null;
  }
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

  const play = await route(context, popular.length ? popular[0].id : '');

  const body = JSON.stringify({ fresh, popular, opened: places, route: play });
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
