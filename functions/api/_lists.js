/**
 * Tallinn Tastebuds — reading one list.
 *
 * Underscore-prefixed, so this is a module and never a route. It holds the one
 * thing two files both need: the shape of a list as the page wants it.
 *
 *   functions/api/lists.js     answers GET /api/lists?id=<id> with it
 *   functions/list/[id].js     seeds it into the page it serves, so a shared
 *                              link draws without a second round trip
 *
 * It lives here rather than in _lib.js because _lib.js is the plumbing every
 * route needs — hashing, sessions, which database this is — and this is one
 * feature's query.
 */

import { catalogue } from './_lib.js';
/* Which of the three kinds of id a list row holds. See addedId() there for
   why the test is a shape and not a prefix. */
import { isAdded } from './lists.js';

/* The share code's shape. A slug, a dash and six characters, but written as a
   general slug rather than as that exact pattern: it is the primary key of a
   row, and the only thing this has to be sure of is that it cannot be
   anything but a plausible id before it goes near a query. */
export const LIST_ID = /^[a-z0-9][a-z0-9-]{2,47}$/;

/**
 * One list, or null.
 *
 * Null covers three different things on purpose — no such list, a private
 * list somebody else owns, and a malformed id — because telling them apart
 * would turn this into a way of asking which codes are real.
 *
 * `mine` is what the page reads to decide whether to draw the editing at all.
 * It is a convenience for the client and never the thing that authorises a
 * write: every write in functions/api/lists.js proves ownership again, on the
 * server, before it touches a row.
 */
export async function readList(context, id, user) {
  const { env } = context;
  if (!LIST_ID.test(id || '')) return null;

  const list = await env.DB
    .prepare(
      'SELECT l.id AS id, l.owner AS owner, l.title AS title, l.intro AS intro, ' +
      'l.public AS public, l.created_at AS created_at, l.updated_at AS updated_at, ' +
      'u.username AS username ' +
      'FROM lists l LEFT JOIN users u ON u.id = l.owner WHERE l.id = ?'
    )
    .bind(id)
    .first();

  if (!list) return null;

  const mine = !!user && user.id === list.owner;
  if (!list.public && !mine) return null;

  /* How many people kept it, and whether the person reading is one of them.
     Both come off the primary key of list_keeps — the count on its leading
     column, the membership on the whole of it — so this is two indexed reads
     and never a scan. See the note under that table in db/schema.sql about
     why there is no counts table behind it yet.

     The count is on a private list too, where it is always zero: a private
     list cannot be kept, because it is not served to anybody who might keep
     it. Answering with the column rather than omitting it means the page has
     one shape to draw and not two. */
  const keeps = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM list_keeps WHERE list_id = ?')
    .bind(id)
    .first();

  /* Only asked when there is somebody to ask about. Signed out, the mark is
     drawn as the door to an account rather than as a state, so the answer
     would change nothing. */
  const kept = user
    ? await env.DB
        .prepare('SELECT 1 AS x FROM list_keeps WHERE list_id = ? AND owner = ?')
        .bind(id, user.id)
        .first()
    : null;

  const { results } = await env.DB
    .prepare('SELECT place_id, name, say, pos FROM list_items WHERE list_id = ? ORDER BY pos')
    .bind(id)
    .all();

  /* Each row filled out from the catalogue: today's name, the address, the
     pin, and whether the place is also on my map. That last one is what lets
     a row link to a write-up rather than to a Google search.

     The row's own stored name is the fallback, and the reason a list never
     renders with a hole in it — see list_items in db/schema.sql. A place the
     catalogue has lost keeps its name and its sentence and stops linking
     anywhere, which is the smallest loss available.

     Filled in here rather than looked up in the browser on purpose: a shared
     list is opened by somebody who has never been to this site, and making
     them download the whole catalogue to draw ten rows would be a hundred
     kilobytes to render a few hundred bytes of it. */
  let roll = null;
  try {
    roll = await catalogue(context);
  } catch (e) { /* unreadable costs the addresses and the links, not the list */ }

  /* The rows whose places somebody added by hand, fetched in one query rather
     than one per row. Without this they would fall back to the stored name
     with no address and no point — which reads as a place on the list and then
     silently is not on the map, because seatList() in assets/app.js drops a
     row that does not know where it is.

     Anybody's, not just this reader's: the whole point is that a shared list
     draws completely for a stranger. Only the author ever sees one in a
     picker; everyone sees the ones on a list they opened. */
  const wanted = results.filter((r) => isAdded(r.place_id)).map((r) => r.place_id);
  const added = new Map();
  if (wanted.length) {
    /* One placeholder per id, built from the array's own length and never from
       anything in it, so this stays a prepared statement with bound
       parameters like every other query here. A list is capped at twenty
       places, so this is at most twenty. */
    const holes = wanted.map(() => '?').join(',');
    const { results: rows } = await env.DB
      .prepare('SELECT id, name, address, lat, lng FROM added_places WHERE id IN (' + holes + ')')
      .bind(...wanted)
      .all();
    rows.forEach((row) => added.set(row.id, row));
  }

  return {
    id: list.id,
    title: list.title,
    intro: list.intro,
    by: list.username || null,
    public: !!list.public,
    mine: mine,
    /* How many people have this list bookmarked, and whether the reader is
       one of them. Not a score and nothing sorts by it — see the README —
       but it is the number a directory would one day be ordered on. */
    keeps: keeps ? keeps.n : 0,
    kept: !!kept,
    updated: list.updated_at,
    items: results.map((r) => {
      /* The catalogue, or the added-places table, or neither — in which case
         the row keeps the name it was added under and stops linking anywhere,
         which is the smallest loss available. */
      const known = added.get(r.place_id) || (roll ? roll.get(r.place_id) : null);
      return {
        place: r.place_id,
        name: known ? known.name : r.name,
        address: known ? known.address : '',
        lat: known && typeof known.lat === 'number' ? known.lat : null,
        lng: known && typeof known.lng === 'number' ? known.lng : null,
        /* Never true for a place somebody added: `map` means "this is also on
           data/restaurants.json, so link the row to its write-up", and an
           added place has none. added_places rows carry no `map` column, so
           this is already false for them — said here so it stays that way. */
        map: !!(known && known.map),
        /* Whether this is a place somebody added rather than one off either
           roll. The page draws it the same; this is what lets it say so. */
        added: added.has(r.place_id),
        say: r.say
      };
    })
  };
}
