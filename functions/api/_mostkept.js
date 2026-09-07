/**
 * Tallinn Tastebuds — every public list, most kept first.
 *
 * Underscore-prefixed, so this is a module and never a route. Like _lists.js
 * beside it, it holds one query two files both need:
 *
 *   functions/api/lists.js    answers GET /api/lists?all=1 with it
 *   functions/lists/kept.js   seeds its first page into /lists/kept, so the
 *                             page draws without a second round trip
 *
 * It is not in _lists.js because that file is the shape of *one* list as the
 * page wants it — a title, its places, their sentences. This is the other
 * question entirely: every public list, in an order, without any of them.
 *
 * "Most kept" and not "the directory", in the filename and all the way
 * through: this repository already has a directory, at /google, and it is a
 * directory of restaurants. Two things under one word in one codebase is one
 * of them being read as the other at three in the morning.
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

/* One page of /lists/kept. Long enough to be worth scrolling, short enough
   that Show more arrives before anybody has stopped reading. */
const PAGE = 20;

/* How many places off each list the page prints under its title. A page of
   titles is a search result — "Top ten burgers" tells a stranger nothing —
   and three names is what lets them judge a list by somebody they have never
   heard of. Capped rather than complete, because the row is a reason to open
   the list and not a copy of it.

   It goes into the LIMIT by concatenation rather than as a bound parameter,
   which is the one place in these three files that happens. It is a constant
   in this file and no request can reach it — the rule the header of
   functions/api/lists.js states is that no value from a request is ever
   concatenated into SQL, and this is not one. */
const TASTE = 3;

/* Where the next page starts: the keep count, the edit time and the id of the
   last row of the page before it.

   A cursor and not an OFFSET, because the thing being paged through moves.
   Somebody keeps a list while page one is being read; it climbs past rows
   already on the screen, and OFFSET 20 would then hand back one of them a
   second time and skip whatever it displaced. A cursor asks "everything after
   this row" and is right whatever happened in between.

   Three parts because the sort has three. The id is what makes it total: two
   lists kept by the same number of people and last edited in the same
   millisecond still have exactly one order, and without that last clause a
   page boundary falling between them could show one of them twice. */
const CURSOR = /^(\d{1,9})\.(\d{1,15})\.([a-z0-9][a-z0-9-]{2,47})$/;

/* One page of every public list, most kept first.
 *
 * The order is the whole of this feature and it is the one thing on this site
 * that ranks. See **Lists people kept** in README.md, which sets out what
 * that costs and why it was chosen anyway.
 *
 * Lists nobody has kept are not filtered out. They sort to the bottom, where
 * they read as the rest of the page rather than as a verdict — and the
 * count stays hidden at zero for the same reason it is hidden everywhere else
 * on this site. It is also what makes the page work on the day it ships,
 * before anybody has kept anything.
 */
export async function mostKept(context, from) {
  const { env } = context;

  const at = CURSOR.exec(from || '');
  /* A cursor that is not one is the first page rather than an error. It can
     only have come from a hand-edited URL, and the top of the page is the
     honest answer to that. */
  const after = at
    ? ' AND (COALESCE(c.n, 0) < ? ' +
      'OR (COALESCE(c.n, 0) = ? AND l.updated_at < ?) ' +
      'OR (COALESCE(c.n, 0) = ? AND l.updated_at = ? AND l.id > ?))'
    : '';
  const bind = at
    ? [Number(at[1]), Number(at[1]), Number(at[2]), Number(at[1]), Number(at[2]), at[3]]
    : [];

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
      'SELECT l.id AS id, l.title AS title, l.updated_at AS updated_at, ' +
      'u.username AS by, COALESCE(c.n, 0) AS keeps ' +
      'FROM lists l ' +
      'LEFT JOIN users u ON u.id = l.owner ' +
      'LEFT JOIN (SELECT list_id, COUNT(*) AS n FROM list_keeps GROUP BY list_id) c ' +
      '  ON c.list_id = l.id ' +
      'WHERE l.public = 1 ' +
      '  AND EXISTS (SELECT 1 FROM list_items i WHERE i.list_id = l.id ' +
      '              LIMIT 1 OFFSET ?)' + after + ' ' +
      'ORDER BY keeps DESC, l.updated_at DESC, l.id ASC LIMIT ?'
    )
    .bind(MIN_ITEMS - 1, ...bind, PAGE + 1)
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
      taste: taste[r.id] || []
    })),
    /* Empty rather than absent when this is the last page, so the page has
       one thing to test rather than two. */
    next: more ? last.keeps + '.' + last.updated_at + '.' + last.id : ''
  };
}
