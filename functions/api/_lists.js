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

import { catalogue, venuesByIds, addedByIds, isAdded } from './_lib.js';

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

  /* Whatever the catalogue did not know is looked for in google_venues, which
     is where the other seven hundred places live — a list holds a catalogue
     slug or a Google key and does not care which. Twenty rows at the most,
     and only the ids this list actually holds. */
  let venues = new Map();
  try {
    const strangers = results
      .map((r) => r.place_id)
      .filter((id) => !roll || !roll.has(id))
      /* Minus the ones somebody added by hand, which are in neither roll and
         are looked for in their own table below. Filtered by the shape of the
         id rather than by asking google_venues and finding nothing: a query
         that can be skipped is better than a query that comes back empty. */
      .filter((id) => !isAdded(id));
    if (strangers.length) venues = await venuesByIds(env, strangers);
  } catch (e) { /* same cost, same reason */ }

  /* And the third roll: the places somebody added by hand because neither of
     the other two had them. Same shape as the other two, so the row below
     cannot tell which it came out of.

     Anybody's, not only this reader's. Only its author ever sees one in a
     picker, but the whole point of the feature is that it goes on a list and
     the list gets shared — so a stranger opening that list has to see the
     place and its pin like every other place on it. Without this the row
     would fall back to its stored name with no point, and the map would
     silently drop it: seatList() in assets/app.js has nowhere to put a pin
     for a place that does not know where it is. */
  let added = new Map();
  try {
    const byHand = results.map((r) => r.place_id).filter(isAdded);
    if (byHand.length) added = await addedByIds(env, byHand);
  } catch (e) { /* same cost, same reason */ }

  /* How many people have kept this list, and whether the reader is one of
     them. The module comment in functions/api/lists.js has promised both of
     these were in this answer since the keep was written; they were not, so
     every keep button on the site drew itself empty on a list you kept last
     week and corrected itself only when you pressed it — which un-kept it.

     Not wrapped in a try the way the catalogue lookups above are. Those are
     enrichment, and a list without addresses is still a list; these come out
     of the same database as the row this function has already read, so a
     failure here is not a missing address, it is the request having failed.
     A keep that reports itself as a nought is the feature lying about
     somebody's own collection, and the one thing this must not do quietly. */
  const keeps = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM list_keeps WHERE list_id = ?')
    .bind(id)
    .first();
  /* Signed out there is nobody for this to be true of, and the query is
     skipped rather than run with a null owner. */
  const kept = user
    ? !!(await env.DB
        .prepare('SELECT 1 AS x FROM list_keeps WHERE list_id = ? AND owner = ?')
        .bind(id, user.id)
        .first())
    : false;

  return {
    id: list.id,
    title: list.title,
    intro: list.intro,
    by: list.username || null,
    public: !!list.public,
    mine: mine,
    updated: list.updated_at,
    keeps: keeps ? keeps.n : 0,
    kept: kept,
    items: results.map((r) => {
      const known = (roll ? roll.get(r.place_id) : null) ||
                    venues.get(r.place_id) ||
                    added.get(r.place_id) ||
                    null;
      return {
        place: r.place_id,
        name: known ? known.name : r.name,
        address: known ? known.address : '',
        lat: known && typeof known.lat === 'number' ? known.lat : null,
        lng: known && typeof known.lng === 'number' ? known.lng : null,
        map: !!(known && known.map),
        /* Set only on a Google row for a place that is also on my map: the
           write-up is filed under the map's id, not Google's key. */
        mapId: (known && known.mapId) || null,
        /* Whether this place was added by hand rather than found on either
           roll. The page draws the row the same; this is what lets it say so,
           and what stops a stranger's typed name reading as one of mine. */
        added: added.has(r.place_id),
        say: r.say
      };
    })
  };
}
