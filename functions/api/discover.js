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
 *     opened:  [ place id … ] }                       most opened first
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

/* How many lists a shelf carries. A shelf scrolls sideways, and past eight
   the door at its end — See all, to /lists — is the better way on. */
const SHELF = 8;

/* How many place ids are sent for a shelf that draws SHELF of them: the
   spares are for the ones the page drops as closed or gone. */
const OPENED = 16;

const TTL = 300;

const EMPTY = { fresh: [], popular: [], opened: [] };

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

  const body = JSON.stringify({ fresh, popular, opened: places });
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
