/**
 * Tallinn Tastebuds — reading one person.
 *
 * Underscore-prefixed, so this is a module and never a route. It holds the one
 * thing two files both need: the shape of a profile as the page wants it.
 *
 *   functions/api/profile.js   answers GET /api/profile?name=<name> with it
 *   functions/u/[name].js      seeds it into the page /u/<name> serves
 *
 * The same arrangement functions/api/_lists.js has, for the same reason, and
 * it lives beside it rather than inside it because a person is not a list.
 *
 * TWO READERS, ONE PRIVACY RULE
 *
 * readShelf() at the foot of this file is the same person read for the other
 * page that draws them: the map, opened on everything they have published at
 * once — /?by=<name>, answered by GET /api/lists?by=<name>. Rows for the
 * profile, places for the map.
 *
 * They are in one file because they are one rule. `l.public = 1` is the whole
 * of the privacy of this feature, it is the same clause in both queries, and
 * the way that goes wrong is one of them growing a case the other does not
 * have. Side by side, a change to what a stranger may read about somebody is
 * a change to two lines nobody can miss.
 *
 * WHAT A PROFILE IS
 *
 * The public lists somebody has made, how many times anybody has kept them,
 * and the line they wrote about themselves. Nothing else. Not their saves —
 * those are anonymous by design and
 * filed under a device as often as under an account — not when they were
 * last seen, and not the lists they have kept, which are a drawer of somebody
 * else's pages rather than anything they published. An account holds no
 * address to leave off in the first place; see functions/api/account.js.
 *
 * A private list is not on it. That is the whole of the privacy rule here and
 * it is the same one /list/<id> already enforces: a list is public or it is
 * its owner's, and this page reads only the first kind — including for the
 * owner looking at their own profile, so that what they see is what everybody
 * sees.
 *
 * THE NUMBER
 *
 * How many times, in total, other people have kept the lists on this page.
 * That is the whole of the standing this site has: it counts the one thing
 * anybody can do to somebody else's list, and it says the same thing the
 * numbers beside each list say — added up.
 *
 * It is summed here out of the per-list counts rather than asked for in a
 * query of its own, so the total on the page and the numbers under it cannot
 * disagree. Twenty-four lists at the most and one indexed prefix each.
 *
 * WHAT IT IS DELIBERATELY NOT
 *
 * A position. "Third of everybody" would mean counting the keeps of every
 * list on the site to find out where this one person stands, which is a
 * GROUP BY over the whole of list_keeps on every profile view — the exact
 * query db/schema.sql says wants a counts table before anything asks it. A
 * number that stands on its own needs none of that, so this is the number and
 * not the place in a table.
 */

import { fillItems } from './_lists.js';

/* The same shape functions/api/account.js mints a username in, said again
   here so nothing that is not a plausible name goes near a query. */
export const USERNAME = /^[a-z0-9][a-z0-9-]{2,23}$/;

/**
 * One profile, or null.
 *
 * Null covers a name that is not a name and a name nobody has, which are the
 * same answer on purpose: this must not become a way of asking which
 * usernames are taken. The sign-up sheet is where that question belongs, and
 * it is rate-limited.
 *
 * Who is asking does not come into it. The answer is the same for the owner
 * and for a stranger, and the page has nothing to draw differently for the
 * owner either — it once offered them a link back to /account.html, and the
 * name in the header was already that.
 */
export async function readProfile(context, name) {
  const { env } = context;

  const who = String(name || '').trim().toLowerCase();
  if (!USERNAME.test(who)) return null;

  /* `about` is a column applied by hand — see db/schema.sql — so a deployment
     can reach the site before somebody has run the ALTER. Asking for it is
     worth one failed statement and no round trips in the ordinary case, and
     the fallback is the same read without the one optional field: a profile
     is a page about somebody's lists, and it must not 404 because the line
     under their name has nowhere to live yet. */
  let row;
  try {
    row = await env.DB
      .prepare('SELECT id, username, created_at, about FROM users WHERE username = ? COLLATE NOCASE')
      .bind(who)
      .first();
  } catch (e) {
    row = await env.DB
      .prepare('SELECT id, username, created_at FROM users WHERE username = ? COLLATE NOCASE')
      .bind(who)
      .first();
  }
  if (!row) return null;

  /* Their public lists, newest edit first — the same row the index draws for
     your own, minus the ones nobody else may read. The keeps are a scalar
     subquery rather than a second join for the reason the index gives: two
     aggregates over two tables in one GROUP BY multiply each other, and a
     list of ten places kept by three people would report thirty of each.

     Then by title, which decides nothing for a person — no two of your lists
     were last edited in the same millisecond — and everything for lists a
     tool wrote: the five Google top tens are one INSERT, so all five carry
     the same updated_at and the order among them was whatever the query plan
     felt like. It was not the same plan as readShelf()'s below, so the chips
     on the map came out in one order and the rows on this page in another.
     A tie-break nobody can see is a tie-break two readers can disagree on. */
  const { results } = await env.DB
    .prepare(
      'SELECT l.id AS id, l.title AS title, ' +
      'COUNT(i.place_id) AS n, ' +
      '(SELECT COUNT(*) FROM list_keeps k WHERE k.list_id = l.id) AS keeps ' +
      'FROM lists l LEFT JOIN list_items i ON i.list_id = l.id ' +
      'WHERE l.owner = ? AND l.public = 1 GROUP BY l.id ' +
      'ORDER BY l.updated_at DESC, l.title'
    )
    .bind(row.id)
    .all();

  let kept = 0;
  for (const r of results) kept += r.keeps;

  return {
    name: row.username,
    since: row.created_at,
    kept: kept,
    /* Left out when it is empty rather than sent as '', the way every other
       answer here drops a field with nothing in it. Nearly every account has
       no line, and the page draws nothing for one it was not given. */
    about: row.about || undefined,
    /* The four things a row on this page draws and no more — listRow() in
       assets/lists.js takes a title, a count and a number of keeps, and the
       id is what it links to. The line under a list and the date it was last
       edited are on the list's own page, one press away. */
    lists: results.map((r) => ({
      id: r.id,
      title: r.title,
      n: r.n,
      keeps: r.keeps
    }))
  };
}

/**
 * Every public list one person has, with the places on them. Null for a name
 * that is not a name and for a name nobody has, the same two-into-one answer
 * readProfile() gives and for the same reason.
 *
 * This is what the map opens on. /?by=<name> draws somebody's lists as the
 * chips along the top — All, and one per list — and All is every place on any
 * of them, once. So the answer has to carry the places and not only the
 * titles, and it has to carry all of them in one response: five round trips
 * for five lists would draw the map five times.
 *
 * WHAT IT COSTS
 *
 * Five statements whatever the shelf holds. The lists, their items, the three
 * rolls behind those items — read once for the lot, see fillItems() in
 * functions/api/_lists.js — the keep counts, and, signed in, which of them
 * this reader has kept. The ceiling is the two caps the writer already
 * enforces — MAX_LISTS and MAX_ITEMS in functions/api/lists.js, twenty-four
 * lists an account and twenty places a list — and there is no LIMIT here on
 * top of them, deliberately: readProfile() above has none either, and a
 * number in one of these two and not the other is the map drawing a chip
 * short of the rows on the page it was opened from. The shelf this was built
 * for is five lists of ten.
 *
 * `by` is on every list rather than on the answer alone, so a list here is
 * the same object the map already has a renderer for — the one GET
 * /api/lists?id= hands it. A shape that is nearly the same is worse than
 * either.
 *
 * A person with no public lists is an empty shelf and not a null: the name
 * exists, and the map says so by staying the map.
 */
export async function readShelf(context, name, user) {
  const { env } = context;

  const who = String(name || '').trim().toLowerCase();
  if (!USERNAME.test(who)) return null;

  const row = await env.DB
    .prepare('SELECT id, username FROM users WHERE username = ? COLLATE NOCASE')
    .bind(who)
    .first();
  if (!row) return null;

  /* Newest edit first and then by title, which is exactly the order
     readProfile() draws above: the chips along the top of the map and the
     rows on /u/<name> are the same lists, and two orders for one set of lists
     is the map disagreeing with the page it was opened from. */
  const { results } = await env.DB
    .prepare(
      'SELECT id, title, intro FROM lists ' +
      'WHERE owner = ? AND public = 1 ORDER BY updated_at DESC, title'
    )
    .bind(row.id)
    .all();

  if (!results.length) return { by: row.username, lists: [] };

  const ids = results.map((r) => r.id);
  const holes = ids.map(() => '?').join(', ');

  /* Every list's places in one read, ordered by list and then by the order
     its owner dragged them into. Split back up below by the list_id each row
     still carries. */
  const items = await env.DB
    .prepare(
      'SELECT list_id, place_id, name, say, pos FROM list_items ' +
      'WHERE list_id IN (' + holes + ') ORDER BY list_id, pos'
    )
    .bind(...ids)
    .all();

  /* One item per row, in the order the rows came back, so the answer splits
     straight back up by the list_id each row still carries. */
  const rows = items.results || [];
  const filled = await fillItems(context, rows);
  const byList = new Map(ids.map((id) => [id, []]));
  rows.forEach((r, at) => {
    const on = byList.get(r.list_id);
    if (on) on.push(filled[at]);
  });

  /* The keeps, and whether this reader is one of them. Not wrapped in a try
     the way the rolls are, for the reason _lists.js gives: a keep that reports
     itself as a nought is the feature lying about somebody's own collection,
     and the button the map draws under each list is the same button. */
  const keeps = await env.DB
    .prepare(
      'SELECT list_id, COUNT(*) AS n FROM list_keeps ' +
      'WHERE list_id IN (' + holes + ') GROUP BY list_id'
    )
    .bind(...ids)
    .all();
  const counted = new Map((keeps.results || []).map((k) => [k.list_id, k.n]));

  /* Signed out there is nobody for this to be true of, and the query is
     skipped rather than run with a null owner. */
  const mine = new Set();
  if (user) {
    const kept = await env.DB
      .prepare(
        'SELECT list_id FROM list_keeps WHERE owner = ? AND list_id IN (' + holes + ')'
      )
      .bind(user.id, ...ids)
      .all();
    (kept.results || []).forEach((k) => mine.add(k.list_id));
  }

  return {
    by: row.username,
    lists: results.map((r) => ({
      id: r.id,
      title: r.title,
      intro: r.intro,
      by: row.username,
      keeps: counted.get(r.id) || 0,
      kept: mine.has(r.id),
      items: byList.get(r.id) || []
    }))
  };
}
