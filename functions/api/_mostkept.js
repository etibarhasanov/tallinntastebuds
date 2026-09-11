/**
 * Tallinn Tastebuds — every public list, most kept first.
 *
 * Underscore-prefixed, so this is a module and never a route. Like _lists.js
 * beside it, it holds one query two files both need:
 *
 *   functions/api/lists.js       answers GET /api/lists?all=1 with it
 *   functions/lists/index.js     seeds its first page into /lists, so the
 *                                page draws without a second round trip
 *
 * It is not in _lists.js because that file is the shape of *one* list as the
 * page wants it — a title, its places, their sentences. This is the other
 * question entirely: every public list, in an order, without any of them.
 *
 * "Most kept" and not "the directory", in the filename and all the way
 * through: this repository already has a directory, at /google, and it is a
 * directory of restaurants. Two things under one word in one codebase is one
 * of them being read as the other at three in the morning. The page the query
 * feeds is called Public lists — the name is about what is on it, this file is
 * about the order it comes back in, and those are two different sentences.
 */

/* The floor a list clears before it is listed here, and the same three places
   assets/lists.js has always wanted before it will offer to share one: two
   places is a pair of opinions rather than a recommendation. Nothing is ever
   deleted for falling under it — an unfinished list simply is not listed yet,
   the same way it is not sharable yet.

   The two are separate judgements about the same number and neither is the
   other's rule. That one is about what its owner is ready to send; this one
   is about what a stranger's first sight of the feature should be, and a page
   of half-filled drafts recommends nothing. */
const MIN_ITEMS = 3;

/* One page of /lists. Long enough to be worth scrolling, short enough that
   Show more arrives before anybody has stopped reading. */
const PAGE = 20;

/* How many places off each list the page prints under its title. A page of
   titles is a search result — "Top ten burgers" tells a stranger nothing —
   and three names is what lets them judge a list by somebody they have never
   heard of. Capped rather than complete, because the row is a reason to open
   the list and not a copy of it.
 *
 * It goes into the LIMIT by concatenation rather than as a bound parameter,
 * which is the one place in these three files that happens. It is a constant
 * in this file and no request can reach it — the rule the header of
 * functions/api/lists.js states is that no value from a request is ever
 * concatenated into SQL, and this is not one. */
const TASTE = 3;

/* The longest search anybody types. The same cap a title has, because the
   longest useful search here is a whole title. */
const MAX_QUERY = 60;

/* Where the next page starts: the keep count, the edit time and the id of the
   last row of the page before it.
 *
 * A cursor and not an OFFSET, because the thing being paged through moves.
 * Somebody keeps a list while page one is being read; it climbs past rows
 * already on the screen, and OFFSET 20 would then hand back one of them a
 * second time and skip whatever it displaced. A cursor asks "everything after
 * this row" and is right whatever happened in between.
 *
 * Three parts because the sort has three. The id is what makes it total: two
 * lists kept by the same number of people and last edited in the same
 * millisecond still have exactly one order, and without that last clause a
 * page boundary falling between them could show one of them twice. */
const CURSOR = /^(\d{1,9})\.(\d{1,15})\.([a-z0-9][a-z0-9-]{2,47})$/;

/* What somebody typed, tidied: whitespace collapsed, ends trimmed, capped.
   Exported because functions/lists/index.js seeds the search back into the
   page it serves, and what it seeds has to be the question that was actually
   asked — a field showing five hundred characters over rows that answered
   sixty would be the page disagreeing with itself. */
export function query(q) {
  return String(typeof q === 'string' ? q : '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_QUERY);
}

/* That, on its way into a LIKE.
 *
 * Three characters mean something inside a LIKE pattern and have to stop
 * meaning it: % matches any run, _ matches any one character, and the escape
 * this uses has to escape itself. The backslash goes first or it would escape
 * the escapes the other two introduce. The value is still bound, never
 * concatenated — this is about what the pattern means, not about SQL
 * injection, which the binding already answers.
 *
 * Empty in, empty out, and the caller reads that as "no search" rather than
 * as a search for nothing: a query of two spaces must not be a page that
 * matches nothing at all.
 *
 * WHAT IT WILL AND WILL NOT MATCH
 *
 * SQLite's LIKE folds case for ASCII and for nothing else, so "Kohvik" finds
 * "kohvik" and "Õlle" does not find "õlle". That is a real limit on a site
 * read in ten languages and it is accepted here rather than papered over:
 * LOWER() is ASCII-only in exactly the same way, so pairing the two would buy
 * nothing, and the alternative is a second stored column of folded text kept
 * in step with the first by every write on the site. A search that is
 * substring-accurate and case-blind past ASCII is worth more than no search,
 * which is what this page had. */
function like(q) {
  const tidy = query(q);
  if (!tidy) return '';
  return '%' + tidy.replace(/[\\%_]/g, (c) => '\\' + c) + '%';
}

/* One page of every public list, most kept first.
 *
 * Takes an options object rather than three positional arguments, because two
 * of the three are usually absent and `mostKept(context, '', '', null)` says
 * nothing about which empty string is which.
 *
 *   from   the cursor the page before it ended on, or ''
 *   q      what somebody typed into the search field, or ''
 *   user   the session, or null — only for whether *you* kept each row
 *
 * The order is the whole of this feature and it is the one thing on this site
 * that ranks. See **Public lists** in README.md, which sets out what that
 * costs and why it was chosen anyway.
 *
 * Lists nobody has kept are not filtered out. They sort to the bottom, where
 * they read as the rest of the page rather than as a verdict — and the
 * count stays hidden at zero for the same reason it is hidden everywhere else
 * on this site. It is also what makes the page work on the day it ships,
 * before anybody has kept anything.
 */
export async function mostKept(context, opts) {
  const { env } = context;
  const { from = '', q = '', user = null } = opts || {};

  const at = CURSOR.exec(from || '');
  /* A cursor that is not one is the first page rather than an error. It can
     only have come from a hand-edited URL, and the top of the page is the
     honest answer to that. */
  const after = at
    ? ' AND (COALESCE(c.n, 0) < ? ' +
      'OR (COALESCE(c.n, 0) = ? AND l.updated_at < ?) ' +
      'OR (COALESCE(c.n, 0) = ? AND l.updated_at = ? AND l.id > ?))'
    : '';
  const afterBind = at
    ? [Number(at[1]), Number(at[1]), Number(at[2]), Number(at[1]), Number(at[2]), at[3]]
    : [];

  /* The search: the title, the line under it, whose it is, and the places on
   * it.
   *
   * The places were left out for a while, on cost: matching a name on a list
   * means looking at the items of every candidate list for one keystroke,
   * which is the join taken out of this file when the row stopped printing a
   * place count. What changed the decision is the row: it prints the first
   * three places under every title, so somebody who types a name they can see
   * on the screen and is told nothing matches has been told something false
   * about the page. The cost is bounded rather than avoided — an EXISTS into
   * each candidate's own items, on idx_list_items_pos, which stops at the
   * first hit and never reads past one list's twenty rows. Under sixty rows a
   * search at today's size; it grows with lists times items, and the day it
   * shows in a query time is the day the search text gets a column of its
   * own on `lists`, kept by the writes. */
  const needle = like(q);
  const search = needle
    ? " AND (l.title LIKE ? ESCAPE '\\' OR l.intro LIKE ? ESCAPE '\\' " +
      "OR u.username LIKE ? ESCAPE '\\' " +
      "OR EXISTS (SELECT 1 FROM list_items s WHERE s.list_id = l.id " +
      "           AND s.name LIKE ? ESCAPE '\\'))"
    : '';
  const searchBind = needle ? [needle, needle, needle, needle] : [];

  /* Whether the person reading kept each row, so the bookmark on it can draw
     itself pressed. A LEFT JOIN on the session's own id and nothing else — one
     row at most per list, on the key list_keeps is already unique over, so it
     cannot multiply the rows the way an aggregate join would.

     Signed out the join is not in the statement at all, which is most of the
     traffic this page gets: the answer is the same for everybody, and the
     column would only ever be null. */
  const mine = user
    ? ' LEFT JOIN list_keeps mk ON mk.list_id = l.id AND mk.owner = ?'
    : '';
  const mineSel = user ? ', mk.owner AS kept' : '';
  const mineBind = user ? [user.id] : [];

  /* The lists themselves, and nothing about what is on them.

     This asks list_items one question — is there a third row — and it asks it
     as EXISTS with an OFFSET rather than as a count, so it stops at the third
     row of each list instead of reading all twenty. The join it replaced read
     every item of every public list on the site to put twenty rows on a page,
     which is the one table here that grows fastest: a place count is not worth
     that, and the page does not need one until it knows which twenty lists it
     is drawing.

     OFFSET rather than `pos = 2`, because pos is not contiguous. drop() takes
     a row out and leaves the numbering alone — only order() renumbers — so a
     list of three can sit at 0, 5 and 9, and asking for pos 2 would miss it.
     Counting rows cannot be fooled that way.

     The keeps are grouped in a subquery and joined. Ordering by them means
     knowing them for every candidate list, so this one is unavoidable — but
     list_keeps is the small table: a keep needs an account and one account
     holds two hundred at the most. */
  const { results } = await env.DB
    .prepare(
      'SELECT l.id AS id, l.title AS title, l.owner AS owner, ' +
      'l.updated_at AS updated_at, u.username AS by, COALESCE(c.n, 0) AS keeps' +
      mineSel + ' ' +
      'FROM lists l ' +
      'LEFT JOIN users u ON u.id = l.owner ' +
      'LEFT JOIN (SELECT list_id, COUNT(*) AS n FROM list_keeps GROUP BY list_id) c ' +
      '  ON c.list_id = l.id' + mine + ' ' +
      'WHERE l.public = 1 ' +
      '  AND EXISTS (SELECT 1 FROM list_items i WHERE i.list_id = l.id ' +
      '              LIMIT 1 OFFSET ?)' + search + after + ' ' +
      'ORDER BY keeps DESC, l.updated_at DESC, l.id ASC LIMIT ?'
    )
    .bind(...mineBind, MIN_ITEMS - 1, ...searchBind, ...afterBind, PAGE + 1)
    .all();

  const more = results.length > PAGE;
  const rows = more ? results.slice(0, PAGE) : results;

  /* The first three places off each list on the page: one small indexed read
     per list, sent as a single batch.

     One statement per list rather than one IN() over all twenty, because the
     shapes cost wildly different amounts. An IN() has to read every item of
     every list on the page — four hundred rows to print sixty names, and it
     grows with how much people write. Each of these stops after three, on the
     index list_items already has for reading a list in its own order, so the
     page costs sixty rows however long the lists are. batch() sends them in
     one round trip.

     ORDER BY pos rather than a filter on it, because pos is not contiguous:
     drop() takes a row out and leaves the numbering alone — only order()
     renumbers — so a list of three can sit at 0, 5 and 9. "The first three"
     is the first three of the list's own order, never the rows numbered under
     three. */
  const taste = {};
  if (rows.length) {
    const read = env.DB.prepare(
      'SELECT name FROM list_items WHERE list_id = ? ORDER BY pos LIMIT ' + TASTE
    );
    const pages = await env.DB.batch(rows.map((r) => read.bind(r.id)));
    rows.forEach((r, i) => {
      taste[r.id] = (pages[i].results || []).map((row) => row.name);
    });
  }

  const last = rows[rows.length - 1];

  return {
    all: rows.map((r) => ({
      id: r.id,
      title: r.title,
      by: r.by || null,
      keeps: r.keeps,
      /* The two facts the bookmark on the row needs, and neither is the owner
         id itself: whose list it is, is answered as "yours or not" so the row
         can offer the gesture the API would refuse, and nothing about anybody
         else's account leaves this function. */
      mine: !!user && r.owner === user.id,
      kept: !!r.kept,
      taste: taste[r.id] || []
    })),
    /* Empty rather than absent when this is the last page, so the page has
       one thing to test rather than two. */
    next: more ? last.keeps + '.' + last.updated_at + '.' + last.id : ''
  };
}
