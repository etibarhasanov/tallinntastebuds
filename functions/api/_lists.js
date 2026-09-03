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
      const known = roll ? roll.get(r.place_id) : null;
      return {
        place: r.place_id,
        name: known ? known.name : r.name,
        address: known ? known.address : '',
        lat: known && typeof known.lat === 'number' ? known.lat : null,
        lng: known && typeof known.lng === 'number' ? known.lng : null,
        map: !!(known && known.map),
        say: r.say
      };
    })
  };
}
