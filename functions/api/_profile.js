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

  const row = await env.DB
    .prepare('SELECT id, username, created_at, about FROM users WHERE username = ? COLLATE NOCASE')
    .bind(who)
    .first();
  if (!row) return null;

  /* Their public lists, newest edit first — the same row the index draws for
     your own, minus the ones nobody else may read. The keeps are a scalar
     subquery rather than a second join for the reason the index gives: two
     aggregates over two tables in one GROUP BY multiply each other, and a
     list of ten places kept by three people would report thirty of each. */
  const { results } = await env.DB
    .prepare(
      'SELECT l.id AS id, l.title AS title, ' +
      'COUNT(i.place_id) AS n, ' +
      '(SELECT COUNT(*) FROM list_keeps k WHERE k.list_id = l.id) AS keeps ' +
      'FROM lists l LEFT JOIN list_items i ON i.list_id = l.id ' +
      'WHERE l.owner = ? AND l.public = 1 GROUP BY l.id ORDER BY l.updated_at DESC'
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
