/**
 * Tallinn Tastebuds — every public list, most kept first, or newest, or
 * changed lately.
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
 * feeds is called Everybody's lists — the name is about whose they are, this
 * file is about the order they come back in, and those are two different
 * sentences.
 * Three orders now, and the keep count is still the one the page opens on;
 * the other two are the ways past the top of it — see SORTS.
 */

import { catalogue, venuesByIds, addedByIds, isAdded } from './_lib.js';
import { readingPins, pinSelect, pinsOf } from './_pins.js';

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

/* How many places off each list the row draws as dots on the city.
 *
 * A row on the directory carries a small sky: every place on the map as a
 * faint dot, and the list's own places over them in the accent, so a coffee
 * list reads as a cluster in Kalamaja and a Caucasus list as a scatter east
 * before anybody has read a name. It is the one picture only this site can
 * draw of a list, and the coordinates already exist.
 *
 * Ten and not all twenty, on the same argument TASTE makes above: the row is a
 * reason to open the list, not a copy of it, and ten dots draw the shape as
 * well as twenty. It is also what bounds the cost — see the read below, which
 * fetches these ten rows and takes the first three names off them, so the
 * taste costs nothing extra. Two hundred item rows for a page of twenty lists,
 * plus one batched lookup for whichever of them are not on the map.
 *
 * It goes into the LIMIT by concatenation rather than as a bound parameter,
 * which is the one place in these three files that happens. It is a constant
 * in this file and no request can reach it — the rule the header of
 * functions/api/lists.js states is that no value from a request is ever
 * concatenated into SQL, and this is not one. The same is true of the ORDER
 * BY built out of SORTS: the request picks a key, and the SQL is the
 * constant filed under it. */
const DOTS = 10;

/* The account the five Google top tens are filed under. It is minted by
   tools/googlelists.mjs, which is the only thing that writes under the name,
   and assets/lists.js carries the same string as GOOGLE_BY to swap its
   byline. Three copies; grep finds them all. */
const GOOGLE_BY = 'google-statistics';

/* The three orders the page can be read in, and the two columns each one
 * sorts by before the id breaks the tie. `kept` is the page's own order and
 * the default; the other two are the ways a reader who has seen the top of
 * the ranking gets to the rest of it — what arrived lately, and what somebody
 * is still working on. Each is two numbers descending and then the id
 * ascending, which is what lets one cursor shape page all three.
 *
 * The first column is an expression and not a name because `kept` sorts on
 * an aggregate the query joins in; it is a constant in this file, never a
 * value from the request — the request chooses a key, and an unknown key is
 * the default. */
const SORTS = {
  kept:    { a: 'COALESCE(c.n, 0)', b: 'l.updated_at', keys: ['keeps', 'updated_at'] },
  new:     { a: 'l.created_at',     b: 'l.updated_at', keys: ['created_at', 'updated_at'] },
  changed: { a: 'l.updated_at',     b: 'l.created_at', keys: ['updated_at', 'created_at'] }
};

/* The sort the request asked for, or the default. Exported for the same
   reason query() is: functions/lists/index.js seeds the order back into the
   page it serves, and the chips have to be drawn pressed on the one the rows
   are actually in. */
export function sortOf(s) {
  return Object.prototype.hasOwnProperty.call(SORTS, s) ? s : 'kept';
}

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
 * page boundary falling between them could show one of them twice.
 *
 * The same shape pages all three orders — see SORTS — because every order
 * here is two numbers descending and then the id; which two is the sort's
 * business, and a cursor minted under one order is only ever handed back
 * under the same one, since the page sends both together. */
const CURSOR = /^(\d{1,15})\.(\d{1,15})\.([a-z0-9][a-z0-9-]{2,47})$/;

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

/* One page of every public list, in one of three orders.
 *
 * Takes an options object rather than positional arguments, because most of
 * them are usually absent and `mostKept(context, '', '', null)` says nothing
 * about which empty string is which.
 *
 *   from   the cursor the page before it ended on, or ''
 *   q      what somebody typed into the search field, or ''
 *   sort   'kept' (the default), 'new' or 'changed' — see SORTS
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
 *
 * The answer carries two sets of rows. `all` is the page; `start` is the five
 * lists Google's numbers wrote, sent with the first page of an unsearched
 * directory and drawn as a strip of their own above it. They are the lists a
 * stranger can trust without knowing anybody on this site, and left in the
 * ranking they were five rows somewhere in the pile, wherever their keep
 * count happened to put them. While they are drawn as the strip they are
 * kept out of `all`, on every page of it, so a list is never on the screen
 * twice; a search puts them back into the rows, because a search is a
 * question and the strip is not an answer to it.
 */
export async function mostKept(context, opts) {
  const { env } = context;
  const { from = '', q = '', user = null } = opts || {};
  const order = SORTS[sortOf(opts && opts.sort)];

  const at = CURSOR.exec(from || '');
  /* A cursor that is not one is the first page rather than an error. It can
     only have come from a hand-edited URL, and the top of the page is the
     honest answer to that. */
  const after = at
    ? ' AND (' + order.a + ' < ? ' +
      'OR (' + order.a + ' = ? AND ' + order.b + ' < ?) ' +
      'OR (' + order.a + ' = ? AND ' + order.b + ' = ? AND l.id > ?))'
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

  /* The five Google lists are a strip of their own on an unsearched
     directory, so they are kept out of its rows — every page of them, not
     only the first, or page two would hand back what the strip already
     shows. NOT IN over a subquery rather than a join against the id, because
     the account may not exist on a fresh database and `!=` against a NULL
     would empty the page; NOT IN over an empty set is true. */
  const strip = !needle;
  const apart = strip ? ' AND l.owner NOT IN (SELECT id FROM users WHERE username = ?)' : '';
  const apartBind = strip ? [GOOGLE_BY] : [];

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
  /* A function of whether the two pin columns are there rather than a
     string, because the answer is not known until the first statement has
     been tried — see readingPins() in _pins.js, which asks once per isolate
     and then knows. Both queries below read it, and the second one is free. */
  const select = (pins) =>
    'SELECT l.id AS id, l.title AS title, l.owner AS owner, ' +
    'l.created_at AS created_at, l.updated_at AS updated_at, ' +
    pinSelect(pins) +
    'u.username AS by, COALESCE(c.n, 0) AS keeps' + mineSel + ' ' +
    'FROM lists l ' +
    'LEFT JOIN users u ON u.id = l.owner ' +
    'LEFT JOIN (SELECT list_id, COUNT(*) AS n FROM list_keeps GROUP BY list_id) c ' +
    '  ON c.list_id = l.id' + mine + ' ' +
    'WHERE l.public = 1 ' +
    '  AND EXISTS (SELECT 1 FROM list_items i WHERE i.list_id = l.id ' +
    '              LIMIT 1 OFFSET ?)';

  const { results } = await readingPins(env, (pins) => env.DB
    .prepare(
      select(pins) + search + apart + after + ' ' +
      'ORDER BY ' + order.a + ' DESC, ' + order.b + ' DESC, l.id ASC LIMIT ?'
    )
    .bind(...mineBind, MIN_ITEMS - 1, ...searchBind, ...apartBind, ...afterBind, PAGE + 1)
    .all());

  const more = results.length > PAGE;
  const rows = more ? results.slice(0, PAGE) : results;

  /* The strip: the Google account's lists, by title, with the first page of
     an unsearched directory and never otherwise. The same statement as the
     rows, narrowed to one owner, so a Google list carries exactly what any
     other row carries — including whether you kept it. Five rows today; the
     LIMIT is the page's, because nothing else bounds an account. */
  let starts = [];
  if (strip && !at) {
    const found = await readingPins(env, (pins) => env.DB
      .prepare(
        select(pins) + ' AND l.owner IN (SELECT id FROM users WHERE username = ?) ' +
        'ORDER BY l.title ASC LIMIT ?'
      )
      .bind(...mineBind, MIN_ITEMS - 1, GOOGLE_BY, PAGE)
      .all());
    starts = found.results || [];
  }

  /* The first ten places off each list on the page, in the list's own order:
     one small indexed read per list, sent as a single batch. The first three
     names are what the row prints under its title; all ten are what it draws
     as dots.

     One statement per list rather than one IN() over all twenty, because the
     shapes cost wildly different amounts. An IN() has to read every item of
     every list on the page and it grows with how much people write. Each of
     these stops after ten, on the index list_items already has for reading a
     list in its own order, so the page costs two hundred rows however long
     the lists are. batch() sends them in one round trip.

     ORDER BY pos rather than a filter on it, because pos is not contiguous:
     drop() takes a row out and leaves the numbering alone — only order()
     renumbers — so a list of three can sit at 0, 5 and 9. "The first ten"
     is the first ten of the list's own order, never the rows numbered under
     ten. */
  const every = rows.concat(starts);
  const items = {};
  if (every.length) {
    const read = env.DB.prepare(
      'SELECT place_id, name FROM list_items WHERE list_id = ? ORDER BY pos LIMIT ' + DOTS
    );
    const pages = await env.DB.batch(every.map((r) => read.bind(r.id)));
    every.forEach((r, i) => { items[r.id] = pages[i].results || []; });
  }
  const dots = await pins(context, items);

  const shape = (r) => ({
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
    /* The pin its owner chose, which this page draws twice: once in front of
       the title, and once as the colour of the row's own scatter of dots —
       so twenty rows of somebody else's opinions are twenty distinguishable
       things rather than twenty identical red constellations. */
    ...pinsOf(r),
    taste: (items[r.id] || []).slice(0, TASTE).map((row) => row.name),
    dots: dots[r.id] || []
  });

  const last = rows[rows.length - 1];

  return {
    all: rows.map(shape),
    start: starts.map(shape),
    sort: sortOf(opts && opts.sort),
    /* Empty rather than absent when this is the last page, so the page has
       one thing to test rather than two. Minted under the order the page is
       in, out of the two columns that order sorts by. */
    next: more ? last[order.keys[0]] + '.' + last[order.keys[1]] + '.' + last.id : ''
  };
}

/* Where each list's places are, as [lat, lng] pairs, four decimals — a city
 * block, which is all a dot the size of a full stop can show.
 *
 * The same three rolls readList() in _lists.js draws a list from, asked once
 * for the whole page rather than once per list: the catalogue is a Map held
 * per isolate, so a slug costs nothing; the Google keys among the ids go to
 * google_venues in chunks of the fifty venuesByIds() takes at a time, and the
 * hand-added ones to added_places the same way. Two hundred ids at the most,
 * most of them slugs, so it is usually one query and never more than a few,
 * all in flight together.
 *
 * Any roll that cannot be read costs its dots and nothing else — a row that
 * draws fewer places than it holds is still a row, and the page must not
 * wait on a picture. A place none of the rolls knows is skipped: a list
 * never renders with a hole in it (see list_items in db/schema.sql), and a
 * sky with one dot fewer is the same rule. */
async function pins(context, items) {
  const { env } = context;
  const ids = new Set();
  Object.keys(items).forEach((id) => items[id].forEach((row) => ids.add(row.place_id)));
  if (!ids.size) return {};

  let roll = null;
  try { roll = await catalogue(context); } catch (e) { /* the map's dots go */ }

  const strangers = [];
  const byHand = [];
  ids.forEach((id) => {
    if (roll && roll.has(id)) return;
    if (isAdded(id)) byHand.push(id);
    else strangers.push(id);
  });

  const chunk = (list, n) => {
    const out = [];
    for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
    return out;
  };
  const found = new Map();
  try {
    const lookups = chunk(strangers, 50).map((part) => venuesByIds(env, part))
      .concat(chunk(byHand, 50).map((part) => addedByIds(env, part)));
    const maps = await Promise.all(lookups);
    maps.forEach((m) => m.forEach((v, k) => found.set(k, v)));
  } catch (e) { /* the dots off the other two rolls go, the rows stay */ }

  const where = (id) => {
    const p = (roll && roll.get(id)) || found.get(id);
    if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number') return null;
    return [Math.round(p.lat * 1e4) / 1e4, Math.round(p.lng * 1e4) / 1e4];
  };

  const out = {};
  Object.keys(items).forEach((id) => {
    out[id] = items[id].map((row) => where(row.place_id)).filter(Boolean);
  });
  return out;
}
