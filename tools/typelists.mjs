#!/usr/bin/env node
/**
 * Tallinn Tastebuds — the filter chips, as lists.
 *
 * Reads data/restaurants.json and data/taxonomy.json and writes
 * db/type-lists.sql: thirteen public lists under the `tallinntastebuds`
 * account, one per chip on the map, each holding every open place that
 * carries that type, in the alphabet.
 *
 *   node tools/typelists.mjs           rewrite db/type-lists.sql
 *   node tools/typelists.mjs --check   report that it is stale, exit 1
 *   node tools/typelists.mjs --show    print the thirteen lists with counts
 *
 * The file loads the way db/google-lists.sql does — pasted into the D1
 * console, or from a signed-in terminal:
 *
 *   wrangler d1 execute tallinntastebuds-preview --remote --file=db/type-lists.sql
 *   wrangler d1 execute tallinntastebuds         --remote --file=db/type-lists.sql
 *
 * Preview first, and both, always. It is re-runnable: each list is upserted
 * on its fixed id and the rows under it are replaced whole, so adding a place
 * to the map and re-running moves what is on a list without moving its
 * address.
 *
 * WHY A CHIP IS WORTH A LIST, WHEN THE CHIP ALREADY ANSWERS
 *
 * Pressing Bakery narrows the map to seventeen pins and the panel to
 * seventeen rows, and that is a better way to *look* at them than any page.
 * What it is not is a thing you can send somebody. A filtered map is a URL
 * with `?type=bakery` on it that opens a map, not a page: no title that says
 * what it is, no line under each place, and nothing to keep. A list is the
 * shape this site already has for "here are the ones, and here is why" — it
 * unfurls in a chat with its own title and card, it has a bookmark, and it
 * sits on /lists beside everybody else's.
 *
 * So these are the same thirteen questions, asked in the other shape. The
 * lists are not a second opinion and cannot drift into one: the picks are
 * `types` out of restaurants.json and nothing else, which is exactly what
 * matchesFilters() in assets/app.js reads.
 *
 * WHOSE THEY ARE, AND WHY THE OWNER IS LOOKED UP RATHER THAN WRITTEN DOWN
 *
 * They belong to `tallinntastebuds` — the account whose map this is, not a
 * generated stand-in like `google-statistics`. That account already exists in
 * production, with a real password and a UUID for an id, and neither of those
 * belongs in a repository. So every list takes its owner from a subquery on
 * the username instead, and the account row above it is an INSERT OR IGNORE:
 * on a database that already holds the name — production — it does nothing at
 * all, and the password, the `about` line and the created_at date are the
 * ones that were there. On a database that does not — a fresh preview — it
 * mints a stand-in so the lists have somewhere to hang, with sixty-four zeros
 * for a hash, which is not the PBKDF2 of anything: nobody can sign in as it.
 *
 * That last part is the one cost. A preview database that has run this file
 * has the name `tallinntastebuds` taken by a row nobody can sign in as, so
 * claiming it there by signing up means deleting the row first. Preview is
 * the database that is allowed to be broken, and the alternative — baking a
 * production UUID into a tracked file — is worse in a way that does not wash
 * out.
 *
 * `owner` is NOT NULL, so if that subquery ever finds nothing the load fails
 * on the constraint rather than writing thirteen lists filed under nobody.
 * A load that half-worked is the failure worth designing against here.
 *
 * WHAT IS LEFT OFF, AND WHAT THAT COSTS
 *
 * Closed places. A chip still draws them — grey pins, still rows in the
 * panel, kept for the links pointing at them — so these lists are not quite
 * what the chip leaves on screen, and the intro under each says so. The
 * reason is that a list is somewhere to go: /list/<id> is a page somebody
 * opens on a phone in town, and "All the date night places" naming a
 * restaurant that shut is the list being wrong in the one way a reader would
 * notice. The Google top tens skip closed places for the same reason.
 *
 * Today that costs two places across four lists — Lokaal Tilk, which carried
 * Restaurant, Date night, Asian and Vegan, and Lendav Maaler, which carried
 * Restaurant.
 *
 * THE FIFTY, AND WHERE IT CAME FROM
 *
 * Casual/Solo comes out at forty-five places and Restaurant at twenty-seven
 * — twenty-nine on the chip, less the two that have closed — and a list held
 * twenty. Capping those two at twenty would have made two of the thirteen a
 * slice of the alphabet nobody chose, which is the one thing these lists are
 * not allowed to be: the whole claim is that the list is the chip.
 * So MAX_ITEMS in functions/api/lists.js is fifty now, and assets/lists.js
 * with it. See **The caps** in README.md for what that changed for everybody
 * else's lists.
 *
 * Casual/Solo is the one to watch: it is on three places in five and the cap
 * is five above it. When it reaches fifty this file will build a list the API
 * would refuse, and nothing here checks that — so the check is in
 * tools/validate.mjs, which fails on a list over the cap and names it.
 *
 * WHY THE LINE UNDER EACH PLACE IS THE FIRST SENTENCE OF THE WRITE-UP
 *
 * list_items.say is one string and there is no per-language version of it,
 * the way a blurb in restaurants.json has ten. So whatever goes there is
 * English on a site read in ten languages, and it had better be worth the
 * asymmetry: the first sentence of the write-up is the sentence that says
 * what the place is, in the same voice as the map, and it is already written.
 * The whole write-up would have been the other candidate and is the wrong
 * length — a list of forty-five paragraphs is not a list — and the must-order
 * dish, which reads best of the three, is missing on twenty-five of the
 * seventy-five places.
 *
 * "First sentence" is the run up to the first `.`, `!` or `?` that has
 * whitespace or the end of the string after it, so a price or an abbreviation
 * mid-sentence does not cut it short. Every one of the seventy-five comes out
 * between 23 and 195 characters, well inside MAX_SAY's 280, and the build
 * throws if one ever does not.
 *
 * WHY THE ORDER IS THE ALPHABET, AND WHOSE ALPHABET
 *
 * The panel behind a chip used to be A–Z and this file matched it. The panel
 * is ordered by distance now — from the reader, or from Raekoja plats when
 * they have not said where they are — and that is exactly the order a
 * published list cannot have: it is measured from somebody standing on the
 * page, and a stranger opening this link is standing somewhere else. There is
 * no distance that is true for every reader, so the list keeps the alphabet,
 * which is true for all of them. Same collator the panel used to sort with:
 * base sensitivity, so Põhja Konn files under P and Šašlõkk under S.
 *
 * The panel sorts in whatever language it is being read in and this file has
 * to pick one, so it picks `en` — the language the lines under the places are
 * already in. The ten alphabets agree about the seventy-five names here
 * anyway; it is a choice that would only show if somebody added a place whose
 * name starts with a letter two of them file differently.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { q } from './googlevenues.mjs';
/* The lengths a list row has to fit, from the route that enforces them on a
   typed list. These rows are loaded past that route, by hand, so the build is
   the only thing standing between a long sentence and a column that would
   have refused it. */
import { MAX_TITLE, MAX_INTRO, MAX_SAY } from '../functions/api/lists.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'db', 'type-lists.sql');

/* The account the lists hang off. Everything but the name is for the
   stand-in a database without it gets — see the header. */
const USER = {
  username: 'tallinntastebuds',
  id: 'tallinntastebuds',
  pw_hash: '0'.repeat(64),
  pw_salt: '7468652063686970732c2061732061',
  pw_iter: 10000
};

/* Milliseconds, evaluated by SQLite when the file runs, so the file carries
   no clock and --check can compare it byte for byte. */
const NOW = "CAST(strftime('%s','now') AS INTEGER) * 1000";

/* The thirteen, by the type each answers. In no order of its own:
   taxonomy.json holds the order the chips are in, and this is the table it is
   read against.

   The id is written out whole rather than cut from the title, which is what
   keeps a title a name rather than a key. A list's id is its address — it is
   what a link somebody sent points at — so renaming **All the bakeries** has
   to leave /list/all-the-bakeries-vncgvm exactly where it is. The readable
   half is what the list was called on the day the id was minted, and the six
   characters after it were minted once, the way functions/api/lists.js mints
   them.

   The titles are written out for the same reason: a title is a name somebody
   chose, and deriving one from the chip's label gives "All the Coffee/tea",
   which is not a name. Each ends "in Tallinn" because the title is also the
   <title> and the og:title of the page at /list/<id>, and "pubs and beer bars
   in Tallinn" is the question somebody types where "pubs and beer bars" is
   not — see **Getting found** in README.md. The ids were minted before the
   city was in the names, and stay. */
export const LISTS = [
  { type: 'casual', id: 'all-the-casual-and-solo-places-5xjdth', title: 'All the casual and solo places in Tallinn' },
  { type: 'bakery', id: 'all-the-bakeries-vncgvm', title: 'All the bakeries in Tallinn' },
  { type: 'coffee', id: 'all-the-coffee-and-tea-places-gq9nms', title: 'All the coffee and tea places in Tallinn' },
  { type: 'pub', id: 'all-the-pubs-and-beer-bars-3q29c9', title: 'All the pubs and beer bars in Tallinn' },
  { type: 'hidden-gem', id: 'all-the-hidden-gems-htp2gd', title: 'All the hidden gems in Tallinn' },
  { type: 'cheap-eats', id: 'all-the-cheap-eats-t7yn32', title: 'All the cheap eats in Tallinn' },
  { type: 'laptop', id: 'all-the-laptop-friendly-places-qbf3nf', title: 'All the laptop friendly places in Tallinn' },
  { type: 'date', id: 'all-the-date-night-places-3n445f', title: 'All the date night places in Tallinn' },
  { type: 'asian', id: 'all-the-asian-places-jzhqqq', title: 'All the Asian places in Tallinn' },
  { type: 'vegan', id: 'all-the-vegan-places-svmsrw', title: 'All the vegan places in Tallinn' },
  { type: 'fine-dining', id: 'all-the-fine-dining-places-nvrz5g', title: 'All the fine dining places in Tallinn' },
  { type: 'caucasian', id: 'all-the-caucasus-places-r8xn4m', title: 'All the Caucasus places in Tallinn' },
  { type: 'restaurant', id: 'all-the-restaurants-rxz3tt', title: 'All the restaurants in Tallinn' }
];

/* The chip's own English label, so the line under the title names the thing
   the reader pressed rather than a word this file invented for it. The city
   is in it because this line is also the page's description in a search
   result, where "every place on the map" says nothing about which map. */
function intro(label) {
  return `Every place on the map of Tallinn that carries the ${label} chip — ` +
    'visited and approved, in the alphabet. Rebuilt whenever the map is, and ' +
    'anywhere that has closed since is left off.';
}

/* Up to the first full stop, question mark or exclamation with whitespace or
   the end of the string behind it. See the header. */
function say(place) {
  const blurb = (place.blurb && place.blurb.en) || '';
  const match = blurb.match(/^.*?[.!?](?=\s|$)/);
  return match ? match[0] : blurb;
}

function read(name) {
  return JSON.parse(readFileSync(join(ROOT, 'data', name), 'utf8'));
}

/* The thirteen, each with the places that answer it. */
export function build() {
  const places = read('restaurants.json');
  const types = read('taxonomy.json').types;

  /* Both ways round, before anything else, because both go wrong silently. A
     chip with no list is a chip nobody can send; a list whose chip is gone is
     a page still standing on /lists that this file has stopped writing, and
     taking that one down is a hand job on both databases that nothing here
     can do. */
  const listed = new Set(LISTS.map((list) => list.type));
  for (const type of types) {
    if (!listed.has(type.id)) {
      throw new Error(
        `data/taxonomy.json has a chip with no list: "${type.id}". Add it to ` +
        'LISTS with a title and an id — six characters off CODE_ALPHABET in ' +
        'functions/api/lists.js, minted once.'
      );
    }
  }
  const chips = new Set(types.map((type) => type.id));
  for (const list of LISTS) {
    if (!chips.has(list.type)) {
      throw new Error(
        `LISTS names a chip data/taxonomy.json no longer has: "${list.type}". ` +
        `Take the entry out, and delete /list/${list.id} from both databases ` +
        'by hand — dropping it here only stops it being rewritten.'
      );
    }
  }

  const collator = new Intl.Collator('en', { sensitivity: 'base' });
  const open = places
    .filter((place) => !place.closed)
    .sort((a, b) => collator.compare(a.name, b.name));

  const lists = types.map((type) => {
    const named = LISTS.find((list) => list.type === type.id);
    return {
      ...named,
      label: type.en,
      intro: intro(type.en),
      places: open
        .filter((place) => (place.types || []).indexOf(type.id) !== -1)
        .map((place, i) => ({ ...place, pos: i, say: say(place) }))
    };
  });

  /* Three lengths the route would have enforced on a typed list. */
  for (const list of lists) {
    if (list.title.length > MAX_TITLE) {
      throw new Error(`"${list.title}" is ${list.title.length} characters, over MAX_TITLE`);
    }
    if (list.intro.length > MAX_INTRO) {
      throw new Error(`"${list.title}" has an intro of ${list.intro.length} characters, over MAX_INTRO`);
    }
    for (const place of list.places) {
      if (place.say.length > MAX_SAY) {
        throw new Error(`"${place.name}" has a first sentence of ${place.say.length} characters, over MAX_SAY`);
      }
    }
  }

  const out = [];

  /* OR IGNORE, never an upsert: on production this row is an account with a
     password, a profile line and a history, and none of it is this file's to
     write. See the header. */
  out.push(
    'INSERT OR IGNORE INTO users (id, username, pw_hash, pw_salt, pw_iter, created_at, last_seen_at, about)\n' +
    `VALUES (${q(USER.id)}, ${q(USER.username)}, ${q(USER.pw_hash)}, ${q(USER.pw_salt)}, ${USER.pw_iter}, ${NOW}, ${NOW}, '');`
  );

  const owner = `(SELECT id FROM users WHERE username = ${q(USER.username)})`;

  out.push(
    'INSERT INTO lists (id, owner, title, intro, public, created_at, updated_at)\nVALUES\n' +
    lists.map((list) =>
      `  (${q(list.id)}, ${owner}, ${q(list.title)}, ${q(list.intro)}, 1, ${NOW}, ${NOW})`
    ).join(',\n') + '\n' +
    'ON CONFLICT(id) DO UPDATE SET\n' +
    /* owner among them, so a database that holds these under the stand-in
       moves them onto the real account the day somebody signs up as that
       name and this is run again. */
    '    owner = excluded.owner,\n' +
    '    title = excluded.title,\n' +
    '    intro = excluded.intro,\n' +
    '    public = excluded.public,\n' +
    '    updated_at = excluded.updated_at;'
  );

  /* Replaced whole rather than upserted row by row: a place that closed has
     to leave the list, and a delete that names its lists is the one statement
     that can say so. */
  out.push(
    'DELETE FROM list_items WHERE list_id IN (\n' +
    lists.map((list) => '  ' + q(list.id)).join(',\n') + '\n);'
  );

  for (const list of lists) {
    out.push(
      'INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)\nVALUES\n' +
      list.places.map((place) =>
        `  (${q(list.id)}, ${q(place.id)}, ${q(place.name)}, ${q(place.say)}, ${place.pos}, ${NOW})`
      ).join(',\n') + ';'
    );
  }

  return { sql: out.join('\n\n') + '\n', lists: lists };
}

export function stale() {
  try {
    const want = build().sql;
    const got = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    return want !== got;
  } catch (e) {
    return true;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    if (!stale()) {
      console.log('OK — db/type-lists.sql matches the map beside it.');
      process.exit(0);
    }
    console.log('  FAIL  db/type-lists.sql is not what tools/typelists.mjs would write.');
    console.log('\nRun `node tools/typelists.mjs` and commit the result.');
    process.exit(1);
  }

  const result = build();

  if (process.argv.includes('--show')) {
    for (const list of result.lists) {
      console.log(`\n${list.title}  /list/${list.id}  (${list.label}, ${list.places.length} places)`);
      for (const place of list.places) {
        console.log(`${String(place.pos + 1).padStart(3)}  ${place.name}  —  ${place.say}`);
      }
    }
    process.exit(0);
  }

  writeFileSync(OUT, result.sql);
  console.log(
    `db/type-lists.sql — ${result.lists.length} lists, ` +
    `${result.lists.reduce((n, list) => n + list.places.length, 0)} places.`
  );
  console.log('\nPaste it into the D1 console, preview first.');
}
