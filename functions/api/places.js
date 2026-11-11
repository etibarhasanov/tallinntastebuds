/**
 * Tallinn Tastebuds — the roll a list is built from.
 *
 * GET /api/places            the whole roll
 * GET /api/places?q=<words>    the twenty of it the words reach best, from
 *                              two letters — the one search of the city, for
 *                              the app, the blog editor's picker and anything
 *                              else that wants a place found; see search()
 *     &near=<lat>,<lng>        nearest first, and `distance` in metres a row
 *     &bbox=<s>,<w>,<n>,<e>    only that part of the map
 *     &limit=<n>               up to sixty rather than twenty
 * GET /api/places?ids=a,b,…    just those places — the cards in a post
 *
 * One answer, two sources, and two things ask for it whole — the picker on
 * the lists page, and the find bar across the top of the map:
 *
 *   data/places.json   the map and the hand-kept CSV beside it. Seventy-nine
 *                      places I have been to, and the only ones that link
 *                      through to a write-up.
 *
 *   google_venues      the Google Places export, in the database. Every place
 *                      in Tallinn you can eat or drink in — about eleven
 *                      hundred of them — so that somebody building "top ten
 *                      bars" can find the bar whether or not I have filmed
 *                      it. See db/schema.sql. And whatever the find bar
 *                      has since looked up on Google Maps when nothing here
 *                      answered — ./lookup.js — museums included, which
 *                      arrive carrying `kind: 'see'`.
 *
 * WHY IT IS ONE ANSWER AND NOT TWO
 *
 * A picker showing the same restaurant twice, once under my id and once under
 * Google's, is a picker that can put the same place on a list twice and draw
 * it as two rows. So the two rolls are merged here, once, on the way out: the
 * map's own entry always wins, and a Google row is dropped when it is that
 * same place — either because the table says so (map_id) or because the name
 * is the name.
 *
 * WHY IT IS CACHED WHEN NOTHING ELSE ON THIS FEATURE IS
 *
 * A list is read by its owner in the middle of writing it, so /api/lists
 * answers no-store. This is the opposite kind of thing: it changes when a
 * deploy or a sync changes it, it is the same for everybody, and it is the
 * one big answer on the page. Five minutes.
 *
 * Five minutes in two places, and the second is the one that matters. The
 * `max-age` only tells the browser; Cloudflare does not keep a Function's
 * answer at the edge because of it, so every request still ran this file.
 * And building the roll reads every row of google_venues — 1,127 rows read
 * for one request, measured against production in November 2026 — which on
 * D1's free plan is five million a day for the whole site: about four and a
 * half thousand asks of this route, `?q=` with a word nobody typed before
 * included, and every read the site makes fails until midnight UTC — the
 * saves, the lists, signing in. So the merged roll is also kept in the
 * isolate for ROLL_TTL, the way ./ask.js and ../mcp.js keep their copies of
 * the same table: a bare GET and every `?q=` inside those five minutes are
 * answered out of memory, and the table is read about once per isolate per
 * five minutes however hard the route is asked. A place somebody looks up on
 * Google Maps reaches the roll within the five minutes, which is the same
 * time the browser was already allowed to keep the old one.
 *
 * WHAT A ROW CARRIES BEYOND A NAME, AND FOR WHOM
 *
 * The map's find bar searches this same roll — see the find section of
 * assets/app.js — and a name and a street were all it had to search a Google
 * row by, so "pizza" found the pizzerias with pizza in the name and not the
 * fifty-three the export files under it. Two things ride on a Google row now
 * that the picker never reads: `kitchens`, what Google says the place cooks
 * in the directory's cuisine ids, the same kitchensOf() the directory and
 * the chat read a row with, so the bar can say them in eleven languages; and
 * `category`, Google's own word for what the place is — "Kebab Shop",
 * "Cocktail Bar" — which is matched and never printed, because a
 * Ukrainian reader typing "kebab" should find the kebab shops and should
 * not be shown Google's English for one. Measured over the export as it
 * stands, the two together are fifty kilobytes before compression and five
 * and a half after, on a roll the bar has already decided to download whole.
 *
 * And a place of mine is lent its linked row's kitchens on the way past:
 * nothing on my map records a cuisine beyond a name and its dishes, so
 * "thai" reached my Thai place only when its write-up said the word. The
 * chat's Function lends the same thing for the same reason (cooksOf() in
 * ./ask.js); this is where the two rolls are already joined, so it is one
 * line here rather than a second join in the browser.
 *
 * THE FIND BAR'S ORDER
 *
 * Google's `rating`, `reviews`, `rank` and `category` ride on the roll for
 * the same reader. A Google row carries its own; a place of mine is lent its
 * linked row's, by map_id, the way it is lent the kitchens — the category so
 * that "coffee" can tell a coffee shop of mine from a bakery Google lends a
 * coffee kitchen to. The bar offers at most
 * three of my places first, best by Google's reviews, and everything after
 * that — mine included — in the order `rank` puts the whole export in. None
 * of the four is ever printed on a row of the bar; the owner's reasoning is
 * under **The find bar's order** in README.md. The picker reads none of them.
 *
 * WHAT A SHUT ROW IS FOR
 *
 * A place Google calls temporarily closed used to be left out of the roll
 * altogether, on the argument that it is not somewhere to send anybody. That
 * made the find bar answer "Nothing matches" to the name of a place that is
 * on that street with its sign up, which reads as the site not knowing the
 * city. So the row is in the roll now, carrying `closed: true`, for the one
 * reader that can say so beside it: the find bar draws it under every open
 * row with Google's words on it. Nothing else offers one — `?q=` drops them
 * in findIndex(), so the app and the blog editor's picker answer as they
 * did, and the lists page's picker leaves them out of the roll it reads. A
 * Google row tied to a place of mine lends that place nothing here: whether
 * a place of mine is shut is `closed` in data/restaurants.json and nobody
 * else's to say.
 */

import { json, catalogue, dataFile, nearTallinn, venueEntry, venuesByIds, wrongDatabase, eatOnly } from './_lib.js';
import { find, findIndex } from './_find.js';
import { kitchensOf } from './venues.js';

/* How a name is compared when deciding whether two rows are one place. The
   same folding the map's search and the picker's do, so "Põhjala" and
   "Pohjala" are one name here too. */
function fold(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

/* Google's word for a door that should open again, as the export writes it. */
const SHUT = 'Temporarily closed';

/* The export's half of the roll, with `rank` when the table has it. The
   column arrived by a hand-run ALTER (db/schema.sql says so beside it), and a
   SELECT naming a column that is not there throws — which here would cost the
   find bar and the picker all eleven hundred of Google's rows over one number
   used for ordering. So a database without it is asked again without it, the
   way rankedRows() in ./venues.js does, and the bar falls back on the score. */
let ranks;
async function googleRows(env) {
  /* And `kind`, when the table has it, so a museum somebody looked up on
     Google Maps reaches the find bar saying so — eatOnly() in ./_lib.js is
     the same once-per-isolate question, and its clause is only non-empty
     where the column is there to select. */
  const kind = (await eatOnly(env)) ? ', kind' : '';
  const select = (withRank) => env.DB
    .prepare(
      'SELECT place_id, name, category, cuisine, tags, price, rating, reviews, ' +
      'address, postal_code, city, latitude, longitude, map_id, status' + kind + (withRank ? ', rank ' : ' ') +
      'FROM google_venues ' +
      /* hidden is the curation switch — a duplicate, or a car park Google
         thinks is a restaurant. missing_since is a row the last sync no
         longer carried. A place Google calls temporarily closed is kept,
         and says so: see WHAT A SHUT ROW IS FOR at the top. */
      'WHERE hidden = 0 AND missing_since IS NULL'
    )
    .all();
  if (ranks === false) return select(false);
  try {
    const answer = await select(true);
    ranks = true;
    return answer;
  } catch (e) {
    if (!/no such column/i.test(String((e && e.message) || e))) throw e;
    ranks = false;
    return select(false);
  }
}

/* The whole roll, merged and sorted: what a bare GET answers, and what ?q=
   searches. Null when the map's half cannot be read. Kept for ROLL_TTL — see
   WHY IT IS CACHED at the top — but only a roll that has Google's half in it,
   so a database that failed to answer once is asked again on the next
   request rather than leaving the find bar without the city for five
   minutes. */
const ROLL_TTL = 5 * 60 * 1000;
let kept = null;
let keptAt = 0;

async function cityRoll(context) {
  if (kept && Date.now() - keptAt < ROLL_TTL) return kept;
  const { env } = context;
  let whole = false;

  /* The map's places first: they carry ids that are already written into
     lists, and they are the only rows that link to a write-up. Unreadable is
     not fatal — the export below is most of the roll — but it is the half
     this site actually stands behind, so it is worth saying nothing at all
     rather than answering a catalogue that lost it. */
  let roll;
  try {
    roll = await catalogue(context);
  } catch (e) {
    return null;
  }

  const out = [...roll.values()].map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address || '',
    lat: typeof p.lat === 'number' ? p.lat : null,
    lng: typeof p.lng === 'number' ? p.lng : null,
    map: !!p.map,
    mapId: null,
    kitchens: []
  }));

  /* What the merge refuses: an id already in the answer, a Google row the
     table has tied to a place on my map, and a row whose name is a name the
     catalogue already carries. */
  const mine = new Map(out.map((p) => [p.id, p]));
  const ids = new Set(mine.keys());
  const names = new Set(out.map((p) => fold(p.name)));

  /* The export is the wider half and the one that can be missing: a preview
     database with the schema applied but no sync run against it has the table
     and no rows in it, and the picker should still open on the map's places
     rather than on an error. */
  if (env.DB && !(await wrongDatabase(env))) {
    try {
      const { results } = await googleRows(env);
      whole = true;

      /* The open rows first, so that of two rows with one name — a branch
         that shut and the one still trading — the open one is the one the
         name keeps. */
      const rows = (results || []).filter(Boolean);
      rows.sort((a, b) => (a.status === SHUT) - (b.status === SHUT));

      for (const row of rows) {
        if (typeof row.name !== 'string' || !row.name) continue;
        if (ids.has(row.place_id)) continue;
        if (row.map_id && ids.has(row.map_id)) {
          /* The row goes, and what Google says it cooks stays with the place
             it is a row for — and so do Google's numbers for it, which the
             find bar orders my places by and never prints: see "The find
             bar's order" at the top. */
          const place = mine.get(row.map_id);
          place.kitchens = kitchensOf(row);
          if (typeof row.rating === 'number') place.rating = row.rating;
          if (typeof row.reviews === 'number') place.reviews = row.reviews;
          if (typeof row.rank === 'number') place.rank = row.rank;
          if (row.category) place.category = row.category;
          continue;
        }
        const name = fold(row.name);
        if (names.has(name)) continue;
        ids.add(row.place_id);
        names.add(name);
        const entry = { ...venueEntry(row), kitchens: kitchensOf(row), category: row.category || '' };
        if (typeof row.rank === 'number') entry.rank = row.rank;
        if (row.status === SHUT) entry.closed = true;
        out.push(entry);
      }
    } catch (e) {
      /* No table, or a database that cannot answer. The map's places are
         still a roll, and the picker still opens. */
    }
  }

  /* Alphabetical, folded, so the sheet reads down the way a phone book does
     and a place is where somebody expects to find it whichever roll it came
     from. */
  out.sort((a, b) => {
    const x = fold(a.name);
    const y = fold(b.name);
    return x < y ? -1 : x > y ? 1 : 0;
  });

  if (whole) {
    kept = out;
    keptAt = Date.now();
  }
  return out;
}

/* ?q= — the one search of the city: the app's map and its picker, the blog
   editor's picker, and in time the find bar. ./_find.js is the matching and
   says why it is the find bar's own; this is what it is handed.

   The roll's haystacks are folded once per roll and kept beside it, with the
   three files that say what a kind is called and what only the map knows
   about a place of mine — data/map.json for its kinds, its dishes and
   whether it has shut. Each is read through the five-minute readers in
   ./_lib.js, and a file that cannot be read costs the words it carried and
   not the search. */
const SEARCH_MAX = 20;
const SEARCH_MOST = 60;

let index = null;
let indexOf = null;

async function searchIndex(context, roll) {
  if (indexOf === roll) return index;
  const file = (path) => dataFile(context, path).catch(() => null);
  const [taxonomy, cuisines, map] = await Promise.all([
    file('/data/taxonomy.json'), file('/data/cuisines.json'), file('/data/map.json')
  ]);
  index = findIndex(
    roll,
    (taxonomy && taxonomy.types) || [],
    (cuisines && cuisines.cuisines) || [],
    new Map((Array.isArray(map) ? map : []).map((place) => [place.id, place]))
  );
  indexOf = roll;
  return index;
}

/* `near=lat,lng` and `bbox=south,west,north,east`, each a list of numbers
   near Tallinn or nothing at all: a point somewhere else measures nothing
   worth ordering by. */
function numbers(value, count) {
  const out = String(value || '').split(',').map(Number);
  return out.length === count && out.every(Number.isFinite) ? out : null;
}

async function search(context, roll, query) {
  const typed = String(query.get('q') || '').slice(0, 80);
  const near = numbers(query.get('near'), 2);
  const limit = Math.floor(Number(query.get('limit')));
  return find(await searchIndex(context, roll), typed, {
    near: near && nearTallinn(near[0], near[1]) ? { lat: near[0], lng: near[1] } : null,
    box: numbers(query.get('bbox'), 4),
    limit: limit >= 1 ? Math.min(limit, SEARCH_MOST) : SEARCH_MAX
  });
}

/* ?ids=a,b,… — the places a post's cards name, for the name and the street
   on each card, without the roll. The map's out of the catalogue, open or
   closed; the rest out of the export by key, hidden or shut included, since a
   card written last spring still says which place it was. Fifty at most. */
async function byIds(context, ids) {
  let roll;
  try {
    roll = await catalogue(context);
  } catch (e) {
    return null;
  }
  const out = [];
  const rest = [];
  for (const id of ids) {
    const p = roll.get(id);
    if (p) out.push({ id: p.id, name: p.name, address: p.address || '', map: !!p.map });
    else rest.push(id);
  }
  if (rest.length && context.env.DB && !(await wrongDatabase(context.env))) {
    const found = await venuesByIds(context.env, rest).catch(() => new Map());
    for (const v of found.values()) out.push({ id: v.id, name: v.name, address: v.address || '', map: false });
  }
  return out;
}

export async function onRequestGet(context) {
  const query = new URL(context.request.url).searchParams;

  if (query.has('ids')) {
    const ids = [...new Set(String(query.get('ids')).split(',').filter((id) => id && id.length <= 128))].slice(0, 50);
    const out = await byIds(context, ids);
    return out ? json(out, 200, 300) : json({ error: 'places' }, 503);
  }

  const roll = await cityRoll(context);
  if (!roll) return json({ error: 'places' }, 503);
  if (query.has('q')) return json(await search(context, roll, query), 200, 300);
  return json(roll, 200, 300);
}
