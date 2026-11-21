/**
 * Tallinn Tastebuds — /api/admin/stats, the ranking of what gets pressed.
 *
 *   GET ?lang=&device=
 *                the whole ranking, the page's words beside it, and the
 *                UTC day of edge cache on the pair. What /admin/stats draws.
 *                `device` is `phone` for the presses made on phones and
 *                `other` for every device's less those — BY DEVICE in
 *                ../stats.js — and every device without. The saves and
 *                what the site holds are not presses and stay the same
 *                under any device.
 *
 * The presses themselves are counted by POST /api/stats in ../stats.js, which
 * anybody may send and every page does; that file says what is counted and
 * why. This is the other end of the same table, and it is the owner's alone.
 *
 * WHO MAY READ IT
 *
 * Only the owner. Everything under /api/admin/ is answered by the lock in
 * functions/_middleware.js first — adminUser() in ../_admin.js, a 403 to
 * anybody else — so this file never sees a request that is not the owner's
 * and does not check again. The ranking is how the site is used: which places
 * get opened and saved, which buttons get pushed, and what the site holds.
 *
 * The colo cache stays, because it is still the cost control, and what goes
 * back to the browser is `private, no-store` whatever the cached copy says,
 * so no cache between here and the owner's phone can hand the ranking to the
 * next person to ask. See privately() in ../_lib.js, which the three cached
 * routes under /api/admin/ share.
 *
 * THE MAP IS THE RANKING AND THE OTHER FIVE ARE FOOTNOTES
 *
 * The answer carries the map's own places in full, zeros included, because
 * those are the places this site is about and the bottom of that list is as
 * much of an answer as the top: a ranking that printed only what has been
 * opened would quietly drop the places nobody has, which is the half the page
 * was asked for. The 1,112 Google venues are an array of their own and only
 * the ones somebody has opened on the map, capped at VENUES — a thousand
 * rows tied at nought is not a ranking, and the directory is not the map —
 * and never the owner's presses on the directory, which ../stats.js counts
 * nowhere, since only the owner can open it. The
 * filters are the third array, in full, because there are fourteen of them,
 * and the rail is the fourth, in full, because there are nine across its
 * two shapes — "The short rail" in docs/handbook.md. The lists are the fifth, and
 * only the ones somebody has opened, capped at LISTS, each with the
 * countries it was opened from: the number a stranger never sees — the one
 * that orders /lists, **Public lists** in docs/handbook.md — drawn here for the
 * owner alone, beside where the readers were. And the posts members wrote
 * are the sixth, the same way: only the ones somebody has read, capped at
 * POSTS, each with its author — the number its author reads on /insights,
 * set beside everybody else's. The house's own posts are not among them;
 * they are counted by the day under `about`, and /admin/visitors is where
 * they are read.
 *
 * A place on the map or of Google's also carries `saves`, how many people
 * have saved it, out of save_counts — the number the map already keeps per
 * place and never ranks by, set beside how often the place is opened for
 * the owner alone.
 *
 * WHAT A FAILURE LOOKS LIKE
 *
 * `ready: false` and empty arrays, 200, with the words still in the answer —
 * no database, the other environment's database, or db/schema.sql not applied
 * yet, which is the one that will actually happen: the table arrives by hand
 * and there is always an afternoon between the deploy and somebody running it.
 * The page then says the numbers are not in yet and draws the rest of itself.
 *
 * WHAT THE SITE HOLDS
 *
 * `held` is nine numbers about the site rather than about a press — the
 * accounts, the saves and the places they are on, the lists and the public
 * ones among them, the lists saved by somebody else, the feedback still up,
 * the decks people made and the places added to lists by hand — each a
 * COUNT(*) of its table, HELD below, read with the rest of the answer once
 * a UTC day per colo — ONCE A DAY below. Rule 3 of **Every read has a
 * price** in CLAUDE.md wants a total kept by the write; this is the owner's
 * page, read a few times a day, and nine walks a day of a few hundred rows
 * is cheaper than nine counters every write route would have to keep in
 * step. Each count is a statement of its own, so a
 * table not there yet answers 0 rather than failing the others, the way the
 * ranking answers empty rather than failing when `press_counts` is not.
 *
 * ONCE A DAY, AND NO STATEMENT PAST A HUNDRED ROWS
 *
 * The owner reads this page to see how the site is used, not to watch it
 * move, so the answer is worked out once a UTC day per colo, language and
 * device view and held there until midnight — the date is in the cache key,
 * so the first open after midnight is the day's one read. Until 2026-11-21
 * it was five minutes, and every open past them read all of press_counts
 * (715 rows on 2026-11-19, every device's and every kind's, to keep a third
 * of them), all of save_counts and the nine counts: about 1,100 rows a miss,
 * and a statement answering 715 rows. The owner's line since then: no
 * statement here answers more than a hundred rows. So press_counts is asked
 * by its key, (kind, id), a kind at a time — the map's places by their ids,
 * a hundred at a time; Google's venues by the place kind, the top VENUES of
 * them; each other kind most pressed first, at most a hundred — and the
 * saves ride on the same statements. Rows read on a miss, from the counts by
 * kind on 2026-11-19: about 410 for every device, 250 for the phones, 560
 * for every device less the phones, which reads the phones' rows beside
 * every device's; plus the nine counts, about 250.
 *
 * The one part that is not held is `reads`, the day's database reads so far
 * — a figure about today is worth nothing a day old, and it is one row per
 * table read today, by the key, about twenty. It is read on every open and
 * put on the held answer on the way out.
 *
 * The directory's test is in the same table, under the `look` kind, and is
 * not read here: ./visitors.js carries it to /admin/visitors, to sit with
 * everything else about it. The colours' old `style` rows and the rails'
 * old `layout` rows are there too, and read by nothing since both tests
 * ended.
 */

import {
  json, wrongDatabase, mapPlaces, venuesByIds, dataFile, wordsFor, privately,
  OWNERS_TTL, ownersDay
} from '../_lib.js';
/* The kinds, the pills and the deal chip are the counting side's, so the
   ranking reads the table with the same words it was written with. */
import { PLACE, FILTER, RAIL, RAIL_PILLS, DEAL_FILTER, LIST, POST } from '../stats.js';
/* The countries under a list, read the way /insights reads them. */
import { listCountries } from '../_visits.js';
import { askedDevice } from '../_visitors.js';
import { AUTHOR } from '../_posts.js';
import { readsByTable, DAY_READS, BRAKE } from '../_meter.js';

/* What the answer looks like, in the cache key, so a deploy that changes it
   is not handed a copy of the old shape for the rest of the day — rule 9 of
   **The rules of a count** in the /stats skill. */
const SHAPE = '2';

/* The most rows any one statement here answers with — ONCE A DAY. */
const PAGE = 100;

/* A kind nothing is filed under, for "take nothing off" — see kindsOf(). */
const NONE = '-';

/* How many Google venues the second table prints. Twenty-five is a screen of
   them on a phone and about as far down a list of places nobody has been to as
   anybody reads. The cap is here rather than in the page because it also
   bounds the lookup below — venuesByIds() takes fifty ids at a time, so this
   is one query however many venues have been pressed. */
const VENUES = 25;

/* And how many lists the fifth table prints, most opened first. Fifty is
   every list anybody has opened for a long while yet, and it is also what
   listCountries() in ../_visits.js reads in one statement. */
const LISTS = 50;

/* And how many posts the sixth, for the same reason, and because three
   statements of fifty ids each is what the lookup below binds. */
const POSTS = 50;

/* What the site holds — see the header — as the statement that counts each.
   Feedback taken down is not held any more; a list made private still is. */
const HELD = {
  users: 'SELECT COUNT(*) AS n FROM users',
  saves: 'SELECT COUNT(*) AS n FROM saves',
  saved: 'SELECT COUNT(*) AS n FROM save_counts WHERE n > 0',
  lists: 'SELECT COUNT(*) AS n FROM lists',
  public: 'SELECT COUNT(*) AS n FROM lists WHERE public = 1',
  keeps: 'SELECT COUNT(*) AS n FROM list_keeps',
  feedback: 'SELECT COUNT(*) AS n FROM feedback WHERE hidden = 0',
  decks: 'SELECT COUNT(*) AS n FROM flashcard_decks',
  added: 'SELECT COUNT(*) AS n FROM added_places'
};

export async function onRequestGet(context) {
  const { request, env } = context;

  /* The words first, and before anything that can fail, because every answer
     this route gives carries them — including the ones that carry no numbers.
     A page that cannot say "nothing has been opened yet" in the language it is
     being read in is a page printing its own keys at somebody.

     Two of the three things wordsFor() answers with. The third is `langs`, the
     ten codes with each language's own name, and it is dropped here: the
     flashcards page has a switch to draw out of it and this one does not, so
     sending it would be ten pairs in every answer that nothing reads. */
  const params = new URL(request.url).searchParams;
  const { lang, ui } = await wordsFor(context, params.get('lang'));
  const device = askedDevice(params);
  const words = { lang: lang, ui: ui, device: device };

  /* The day's database reads so far, by table — ../_meter.js. One row a
     table read today, by the key, about twenty; null where read_meter is not
     there. Not filed by device: a read is the site's, not a visitor's. And
     read on every open rather than held — ONCE A DAY in the header. */
  const day = new Date().toISOString().slice(0, 10);
  const withReads = async (body) => {
    const byTable = await readsByTable(env.DB, day);
    const reads = byTable && {
      today: byTable.reduce((sum, r) => sum + r.rows, 0),
      limit: DAY_READS,
      brake: BRAKE,
      tables: byTable.map((r) => ({ name: r.what, n: r.rows }))
    };
    return privately(json({ ...body, reads: reads }, 200));
  };

  const cache = caches.default;
  /* A day in the colo — ownersDay() in ../_lib.js and ONCE A DAY in the
     header. It is the only thing between this route and the database, so it
     is also the cost control; nothing reaches it before the owner check in
     functions/_middleware.js, so holding it never hands the answer to
     anybody else. */
  const key = statsKey(request, words.lang, device);
  const hit = await cache.match(key);
  if (hit) return withReads(await hit.json());

  const empty = {
    ready: false, opens: 0, held: null,
    map: [], venues: [], filters: [], rail: [], lists: [], posts: [], ...words
  };
  if (!env.DB) return json(empty, 200);
  /* A deployment holding the other environment's database answers as though it
     had no database at all — the same rule /api/v1/saves follows, and for the
     same reason: a preview showing the live numbers is the same mistake as
     writing to them. */
  if (await wrongDatabase(env)) return json(empty, 200);

  let places;
  try {
    places = await mapPlaces(context);
  } catch (e) {
    /* The roll of places is unreadable, which is a broken deployment rather
       than an empty ranking. Say the same thing as no database: the page draws
       and has nothing to print. */
    return json(empty, 200);
  }
  const ids = places.map((p) => p.id);

  /* The presses, a kind at a time by the key — ONCE A DAY in the header.
     The map's places and Google's are asked with their saves beside them;
     the chips and pills whole; the lists and posts most opened first. */
  let mine;
  let theirs;
  let pressed;
  try {
    [mine, theirs, ...pressed] = await Promise.all([
      onTheMap(env, kindsOf(device, PLACE), ids),
      offTheMap(env, kindsOf(device, PLACE), ids),
      most(env, kindsOf(device, FILTER), PAGE),
      most(env, kindsOf(device, RAIL), PAGE),
      most(env, kindsOf(device, LIST), LISTS),
      most(env, kindsOf(device, POST), POSTS)
    ]);
  } catch (e) {
    /* No table yet — see the header. */
    return json(empty, 200);
  }
  const [chips, pills, lists, posts] = pressed;
  const counted = new Map();
  for (const row of chips) counted.set(FILTER + '\u0000' + row.id, row.n);
  for (const row of pills) counted.set(RAIL + '\u0000' + row.id, row.n);
  const countOf = (kind, id) => counted.get(kind + '\u0000' + id) || 0;

  /* The map, every one of them, most opened first.

     The tie-break is the name, and it has to be something: without it two
     places on nought come back in whatever order the roll happens to be in,
     which changes when a place is added and makes a stable-looking table
     shuffle for no reason anybody could explain. localeCompare rather than <,
     so Õ sorts where a reader expects rather than after Z. */
  const map = places
    .map((p) => ({
      id: p.id,
      name: p.name,
      n: (mine.get(p.id) || {}).n || 0,
      saves: (mine.get(p.id) || {}).saves || 0,
      /* A shut place is still on the map, still has a card and can still be
         opened, so it is still in the ranking — but a row at the bottom of one
         needs to say why it is there, or the table reads as a verdict on a
         restaurant that closed in March. See **Close a place instead of
         deleting it** in docs/handbook.md. */
      closed: !!p.closed
    }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));

  let venues = [];
  if (theirs.top.length) {
    try {
      const found = await venuesByIds(env, theirs.top.map((row) => row.id));
      /* A venue the export no longer carries is dropped rather than printed
         with its key for a name: a refresh takes rows out, and a row nobody
         can put a name to says nothing to anybody reading a ranking. Its count
         stays in the table and in `opens` below, because it happened. */
      venues = theirs.top
        .filter((row) => found.has(row.id))
        .map((row) => ({ id: row.id, name: found.get(row.id).name, n: row.n, saves: row.saves }));
    } catch (e) {
      /* The names did not come back. The map's own ranking is the page, and
         this half of it is not worth failing the other half for. */
      venues = [];
    }
  }

  /* Every open this site has counted — the venues past the cap and the ones
     with no name left included, and the filters and the lists not, because a
     chip pressed is not a place looked at, a list opened is somebody's page
     rather than a restaurant, and adding any of the three to the others would
     be a number about nothing.
     It is the one figure on the page that is about the site rather than about
     a restaurant. */
  const opens = map.reduce((sum, p) => sum + p.n, 0) + theirs.rest;

  /* What the site holds — see the header. Each count on its own, so a table
     not applied yet answers 0 and never fails the others or the ranking. */
  const kinds = Object.keys(HELD);
  const counts = await Promise.all(kinds.map((k) =>
    env.DB.prepare(HELD[k]).first().then((row) => (row && row.n) || 0, () => 0)));
  const held = Object.fromEntries(kinds.map((k, i) => [k, counts[i]]));

  const body = {
    ready: true, asOf: new Date().toISOString(), opens: opens, held: held,
    map: map, venues: venues,
    filters: await ranked(context, words, countOf),
    rail: railed(words, countOf),
    lists: await opened(env, lists),
    posts: await read(env, posts, words.lang),
    ...words
  };
  context.waitUntil(cache.put(key, json(body, 200, OWNERS_TTL)));
  return withReads(body);
}

/* The kind to read and the kind to take off it, for a device view — BY
 * DEVICE in ../stats.js. Every device is the kind as it is and the phones
 * are `phone.<kind>`, each with NONE taken off; every device less the phones
 * is the kind with `phone.<kind>` taken off, row by row, which is what
 * lessPhone() in ../_visitors.js does over rows already in hand. */
function kindsOf(device, kind) {
  if (device === 'phone') return ['phone.' + kind, NONE];
  return [kind, device ? 'phone.' + kind : NONE];
}

/* The map's own places, by id, with their saves: Map(id → { n, saves }).
 *
 * A lookup on press_counts' key (kind, id) per place, another for the
 * phones' row where one is taken off, and one on save_counts' key — so it
 * reads at most three rows a place and never a place that is not on the
 * map. The ids go in as one JSON array, a hundred to a statement, because a
 * statement binds at most a hundred values and answers at most PAGE rows.
 * 82 places on 2026-11-21: one statement, 82 rows answered, about 82 read
 * from press_counts (164 for every device less the phones) and one per
 * saved place from save_counts. */
async function onTheMap(env, [kind, less], ids) {
  const out = new Map();
  for (let at = 0; at < ids.length; at += PAGE) {
    const { results } = await env.DB
      .prepare(
        'SELECT j.value AS id, IFNULL(a.n, 0) - IFNULL(p.n, 0) AS n, IFNULL(s.n, 0) AS saves ' +
        'FROM json_each(?3) j ' +
        'LEFT JOIN press_counts a ON a.kind = ?1 AND a.id = j.value ' +
        'LEFT JOIN press_counts p ON p.kind = ?2 AND p.id = j.value ' +
        'LEFT JOIN save_counts s ON s.place_id = j.value'
      )
      .bind(kind, less, JSON.stringify(ids.slice(at, at + PAGE)))
      .all();
    for (const row of results || []) out.set(row.id, { n: row.n, saves: row.saves });
  }
  return out;
}

/* Everything counted as a place that is not on the map is one of Google's:
 * the top VENUES of them, most opened first, with their saves, and `rest`,
 * every open of all of them, past the cap too, for `opens`.
 *
 *   { top: [{ id, n, saves }], rest }
 *
 * The one statement here that walks: every row of the place kind, by the
 * key's first column, because nothing is ordered by `n` to find the top
 * without looking at them all — 275 rows on 2026-11-19, 145 for the phones,
 * and 420 for every device less the phones with their rows looked up
 * beside. It grows with the Google venues anybody has opened, at most the
 * 1,177 there are, and runs once a day — ONCE A DAY. The saves are looked
 * up for the VENUES rows that come out of it, not for every row walked. */
async function offTheMap(env, [kind, less], ids) {
  const { results } = await env.DB
    .prepare(
      'SELECT t.id, t.n, t.rest, IFNULL(s.n, 0) AS saves FROM (' +
        'SELECT a.id AS id, a.n - IFNULL(p.n, 0) AS n, SUM(a.n - IFNULL(p.n, 0)) OVER () AS rest ' +
        'FROM press_counts a ' +
        'LEFT JOIN press_counts p ON p.kind = ?2 AND p.id = a.id ' +
        'WHERE a.kind = ?1 AND a.id NOT IN (SELECT value FROM json_each(?3)) ' +
        'ORDER BY n DESC LIMIT ?4' +
      ') t LEFT JOIN save_counts s ON s.place_id = t.id ORDER BY t.n DESC'
    )
    .bind(kind, less, JSON.stringify(ids), VENUES)
    .all();
  const rows = results || [];
  return { top: rows.filter((row) => row.n > 0), rest: rows.length ? rows[0].rest : 0 };
}

/* One kind's ids, most pressed first, at most `limit` — [{ id, n }]. By the
 * key's first column, so it reads that kind's rows and, where the phones'
 * are taken off, a lookup each beside them: on 2026-11-19 14 chips, 11
 * pills, 31 lists and a post for every device. */
async function most(env, [kind, less], limit) {
  const { results } = await env.DB
    .prepare(
      'SELECT a.id AS id, a.n - IFNULL(p.n, 0) AS n FROM press_counts a ' +
      'LEFT JOIN press_counts p ON p.kind = ?2 AND p.id = a.id ' +
      'WHERE a.kind = ?1 ORDER BY n DESC LIMIT ?3'
    )
    .bind(kind, less, limit)
    .all();
  return (results || []).filter((row) => row.n > 0);
}

/* Every chip on the map, most pressed first, named in the reading language.
 *
 * In full rather than only the pressed ones, for the reason the map's own
 * places are in full: a chip nobody has pressed is the answer to the question
 * this table is for. **The order of the filter chips** in docs/handbook.md is what
 * that question is — the row is in a hand-written order today, and this is the
 * measurement that would argue for a different one.
 *
 * The labels come from the same two files the chips themselves are drawn from:
 * the types out of data/taxonomy.json in the language the answer is in, and
 * the one chip that is not a type out of the ui block already in hand. A type
 * with no label in that language is dropped rather than printed as its id,
 * which is the rule everywhere else on this site — though the validator fails
 * the build on a missing one, so it should not be reachable.
 */
async function ranked(context, words, countOf) {
  let types;
  try {
    const taxonomy = await dataFile(context, '/data/taxonomy.json');
    types = (taxonomy && taxonomy.types) || [];
  } catch (e) {
    /* No taxonomy, no filter table. The page draws the places, which is what
       it is mostly for. */
    return [];
  }

  /* A type the taxonomy keeps off the chip row (`"chip": false` — Tea) has
     no chip to press, and a row for it would read nought forever. */
  const rows = types
    .filter((type) => type && type.chip !== false && typeof type[words.lang] === 'string' && type[words.lang])
    .map((type) => ({ id: type.id, name: type[words.lang], n: countOf(FILTER, type.id) }));

  if (words.ui.filterDiscount) {
    rows.push({
      id: DEAL_FILTER,
      name: words.ui.filterDiscount,
      n: countOf(FILTER, DEAL_FILTER)
    });
  }

  return rows.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}

/* Every pill on the rail, most pressed first, named in the reading language.
 *
 * In full rather than only the pressed ones, for the reason the chips above
 * are in full: a button nobody presses is the answer to the question this
 * table is for. The rail is nine pills deep on a phone and the cascade that
 * introduces them is timed to the sentence under the mark — see
 * introduceRail() in assets/app.js — so which of them earns its slot is a
 * question with a real cost behind it.
 *
 * The tie-break is the rail's own order and not the name: nine buttons on
 * nought sorted alphabetically is a list nobody can read against the thing it
 * describes, and top-to-bottom is how they are stood. A pill whose label is
 * missing from the block is dropped rather than printed as its id, which is
 * the rule the chips follow — the validator fails the build on a missing
 * string, so it should not be reachable.
 */
function railed(words, countOf) {
  return RAIL_PILLS
    .map((pill, at) => ({
      id: pill.id,
      name: words.ui[pill.label],
      n: countOf(RAIL, pill.id),
      at: at
    }))
    .filter((row) => typeof row.name === 'string' && row.name)
    .sort((a, b) => b.n - a.n || a.at - b.at)
    .map((row) => ({ id: row.id, name: row.name, n: row.n }));
}

/* Every list somebody has opened, most opened first, capped at LISTS, each
 * with whose it is and where it was opened from:
 *
 *   [{ id, name, by, public, n, country }]
 *
 * `n` is the running count press_counts keeps under kind 'list', `most`
 * read by most() already ranked and capped — and `country` is [{ id, n }] out of list_counts,
 * most first, or null where that table is not applied. `by` is the owner's
 * username, so the row can lead to their page, and `public` is whether the
 * list still is: one made private since keeps the number it had and stops
 * growing, and the page marks it, the way /insights does. A list deleted
 * since is dropped rather than printed with its id for a name; its count
 * stays in the table, because it happened.
 *
 * Capped before the lookup, so the cap is what bounds the query. The names
 * did not come back, or `lists` is not there yet: an empty table rather
 * than a failed page, the way Google's venues answer. */
async function opened(env, most) {
  if (!most.length) return [];

  let named;
  try {
    const { results } = await env.DB
      .prepare(
        'SELECT l.id, l.title, l.public, u.username FROM lists l ' +
        'LEFT JOIN users u ON u.id = l.owner ' +
        'WHERE l.id IN (' + most.map(() => '?').join(',') + ')'
      )
      .bind(...most.map((row) => row.id))
      .all();
    named = new Map((results || []).map((l) => [l.id, l]));
  } catch (e) {
    return [];
  }

  const kept = most.filter((row) => named.has(row.id));
  const where = await listCountries(env, kept.map((row) => row.id));
  return kept.map((row) => {
    const l = named.get(row.id);
    return {
      id: row.id,
      name: l.title,
      by: l.username || '',
      public: l.public === 1,
      n: row.n,
      country: where ? where.get(row.id) || [] : null
    };
  });
}

/* Every member's post somebody has read, most read first, capped at POSTS,
 * each with who wrote it:
 *
 *   [{ id, name, by, draft, n }]
 *
 * `n` is the running count press_counts keeps under kind 'post', `most`
 * read by most() already ranked and capped — and `name` the title in the language the page is
 * read in where the post is written in it, the one it was first written in
 * where it is not, the way the blog picks. `draft` is whether it has been
 * taken back to draft since: it keeps the number it had and stops growing,
 * and the page marks it, the way /insights does. A post deleted since is
 * dropped, its count staying in the table because it happened. The posts
 * not there, or their names not back: an empty table rather than a failed
 * page, the way the lists answer. */
async function read(env, most, lang) {
  if (!most.length) return [];

  const ids = most.map((row) => row.id);
  const marks = ids.map(() => '?').join(',');
  let heads;
  let texts;
  try {
    [heads, texts] = await Promise.all([
      env.DB
        .prepare(
          'SELECT p.id, p.lang, p.status, u.username FROM posts p ' +
          'LEFT JOIN ' + AUTHOR + ' WHERE p.id IN (' + marks + ')'
        )
        .bind(...ids)
        .all(),
      env.DB
        .prepare('SELECT post, lang, title FROM post_texts WHERE post IN (' + marks + ')')
        .bind(...ids)
        .all()
    ]);
  } catch (e) {
    return [];
  }

  const titles = new Map();
  for (const t of texts.results || []) {
    if (!titles.has(t.post)) titles.set(t.post, {});
    titles.get(t.post)[t.lang] = t.title;
  }
  const named = new Map((heads.results || []).map((p) => [p.id, p]));
  return most
    .filter((row) => named.has(row.id) && titles.has(row.id))
    .map((row) => {
      const p = named.get(row.id);
      const by = titles.get(row.id);
      return {
        id: row.id,
        name: by[lang] || by[p.lang] || by[Object.keys(by)[0]],
        by: p.username || '',
        draft: p.status !== 'published',
        n: row.n
      };
    });
}

/* What the colo files the answer under: the route, the language, the
   device view, the UTC day and the shape, and never the rest of the address. The page sends its whole list
   of candidate languages — "et,en,ru" — and the answer only depends on
   which one of them won, so keying on the raw query would file the same ten
   answers under however many orders browsers happen to send. Thirty-three
   keys per colo a day at the most, one per language the site speaks and
   device view; the day is what makes each a day's — ONCE A DAY. */
function statsKey(request, lang, device) {
  const url = new URL('/api/admin/stats', request.url);
  url.searchParams.set('lang', lang);
  if (device) url.searchParams.set('device', device);
  url.searchParams.set('shape', SHAPE);
  return ownersDay(url);
}
