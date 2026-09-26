/**
 * Tallinn Tastebuds — the roll a list is built from.
 *
 * GET /api/places
 *
 * One answer, two sources, and two things ask for it — the picker on the
 * lists page, and the find bar across the top of the map:
 *
 *   data/places.json   the map and the hand-kept CSV beside it. Seventy-six
 *                      places I have been to, and the only ones that link
 *                      through to a write-up.
 *
 *   google_venues      the Google Places export, in the database. Every place
 *                      in Tallinn you can eat or drink in — eleven hundred and
 *                      eleven of them — so that somebody building "top ten
 *                      bars" can find the bar whether or not I have filmed
 *                      it. See db/schema.sql.
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
 * WHAT A ROW CARRIES BEYOND A NAME, AND FOR WHOM
 *
 * The map's find bar searches this same roll — see the find section of
 * assets/app.js — and a name and a street were all it had to search a Google
 * row by, so "pizza" found the pizzerias with pizza in the name and not the
 * fifty-three the export files under it. Two things ride on a Google row now
 * that the picker never reads: `kitchens`, what Google says the place cooks
 * in the directory's cuisine ids, the same kitchensOf() the directory and
 * the chat read a row with, so the bar can say them in ten languages; and
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
 */

import { json, catalogue, venueEntry, wrongDatabase } from './_lib.js';
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

export async function onRequestGet(context) {
  const { env } = context;

  /* The map's places first: they carry ids that are already written into
     lists, and they are the only rows that link to a write-up. Unreadable is
     not fatal — the export below is most of the roll — but it is the half
     this site actually stands behind, so it is worth saying nothing at all
     rather than answering a catalogue that lost it. */
  let roll;
  try {
    roll = await catalogue(context);
  } catch (e) {
    return json({ error: 'places' }, 503);
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
      const { results } = await env.DB
        .prepare(
          'SELECT place_id, name, category, cuisine, tags, price, rating, reviews, ' +
          'address, postal_code, city, latitude, longitude, map_id ' +
          'FROM google_venues ' +
          /* hidden is the curation switch — a duplicate, or a car park Google
             thinks is a restaurant. missing_since is a row the last sync no
             longer carried. A place Google says is shut is not somewhere to
             send anybody, so it is not offered; it is never deleted, and a
             list already holding one still draws it. */
          "WHERE hidden = 0 AND missing_since IS NULL AND status <> 'Temporarily closed'"
        )
        .all();

      for (const row of results || []) {
        if (!row || typeof row.name !== 'string' || !row.name) continue;
        if (ids.has(row.place_id)) continue;
        if (row.map_id && ids.has(row.map_id)) {
          /* The row goes, and what Google says it cooks stays with the place
             it is a row for. */
          mine.get(row.map_id).kitchens = kitchensOf(row);
          continue;
        }
        const name = fold(row.name);
        if (names.has(name)) continue;
        ids.add(row.place_id);
        names.add(name);
        out.push({ ...venueEntry(row), kitchens: kitchensOf(row), category: row.category || '' });
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

  return json(out, 200, 300);
}
