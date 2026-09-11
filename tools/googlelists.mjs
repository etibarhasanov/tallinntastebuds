#!/usr/bin/env node
/**
 * Tallinn Tastebuds — the five lists Google wrote.
 *
 * Reads exports/tallinn_restaurants.csv — the same 1,110 places
 * tools/googlevenues.mjs loads into google_venues — and writes
 * db/google-lists.sql: one account called `google-statistics`, five public
 * lists under its name, ten places on each, in Google's order. Top ten restaurants,
 * bakeries, cafés, bars and pizzerias, as the numbers Google holds about the
 * city have them, and said to be Google's in the title, the byline and every
 * row.
 *
 *   node tools/googlelists.mjs           rewrite db/google-lists.sql
 *   node tools/googlelists.mjs --check   report that it is stale, exit 1
 *   node tools/googlelists.mjs --show    print the five lists with the numbers
 *
 * The file loads the way db/google-venues.sql does — pasted into the D1
 * console, or from a signed-in terminal:
 *
 *   wrangler d1 execute tallinntastebuds-preview --remote --file=db/google-lists.sql
 *   wrangler d1 execute tallinntastebuds         --remote --file=db/google-lists.sql
 *
 * Preview first, and both, always. It is re-runnable: the account is inserted
 * once and never touched again, each list is upserted on its fixed id, and
 * the ten rows under it are replaced whole, so a refresh of the export moves
 * a list without moving its address. Statements and no comments, for the
 * reason googlevenues.mjs gives — the console folds a paste onto one line.
 *
 * WHY THESE LISTS EXIST, ON A SITE THAT DOES NOT RANK
 *
 * The map carries no score and never sorts by one; that rule stands. A list
 * is the other kind of thing this site has — somebody's opinion, under their
 * name, with a sentence under each place — and these five are Google's
 * opinion, under Google's name. The account is called `google-statistics`,
 * the title of every list ends "by Google", the line under each place is
 * Google's rating and how many people gave it, and the account's own profile
 * line says where the order comes from. Nothing on them is the map's verdict,
 * and the intro says so.
 *
 * The name is hyphenated because a username here is lowercase letters, digits
 * and hyphens — USERNAME_RE in functions/api/account.js — so `google_statistics`
 * is not a name this site can hold. Widening that rule for one account would
 * change what every future sign-up may be called, and the two read the same.
 *
 * HOW THE ORDER IS DECIDED, AND WHY IT IS NOT THE RATING
 *
 * Sorted by Google's rating alone, a top ten is a list of places rated 5.0
 * by thirty people, above a restaurant six thousand people rated 4.8. Thirty
 * people all giving five stars and six thousand averaging 4.8 are not the
 * same claim, and a top ten that puts the first above the second is
 * reporting a small number as a big one.
 *
 * So the order is the Bayesian average — the same arithmetic /google's "Best
 * overall" uses, in weigh() in assets/venues.js:
 *
 *     (n / (n + PRIOR)) * rating  +  (PRIOR / (n + PRIOR)) * mean
 *
 * n is the place's review count and mean is the review-weighted mean of the
 * pool the list is drawn from — what a bakery you know nothing about is likely
 * to score, which is higher than what a burger bar you know nothing about is.
 * PRIOR is how many reviews a place needs before its own rating counts for
 * half, and it is 300 here against the directory's 100. The directory orders
 * eleven hundred rows and a place slipping from ninth to fourteenth costs
 * nobody anything; a top ten is ten names singled out, and a name that is
 * there on the strength of sixty reviews is there on a rumour. At 300, 4.5
 * from five thousand reviews comes out ahead of 4.7 from sixty, which is the
 * order a person arrives at when they see both numbers side by side.
 *
 * And under FLOOR reviews a place is not weighed at all. The prior already
 * pulls a small count towards the mean, but it pulls it to the middle rather
 * than out, and "the middle of a top ten" is still a top ten. A hundred is
 * where a Google rating stops being the opinion of one big table.
 *
 * Ties go to the bigger count, one place per name so a chain's five branches
 * are one row, and a place Google calls temporarily closed is not on any of
 * them: a top ten is a list somebody walks to.
 *
 * WHICH PLACES ARE IN EACH POOL
 *
 * Google's category, and only that. Google gives every place one category —
 * what it IS — and a list of tags — what it also HAS — and the first draft
 * of these lists read both through the directory's KITCHENS table, the way
 * the Bakery chip does. The top ten bakeries that came out of it had a
 * wine-and-pastry kiosk fourth, a coffee shop sixth and two chocolate shops
 * eighth and tenth, because the chip's pattern takes in dessert and
 * confectionery and a tag is a thing a place has on the side. A chip that
 * says "also sells pastry" is a fair filter over eleven hundred rows; a top
 * ten that says "this is a bakery" is a claim about each name on it, and
 * only the category makes that claim. So a bakery is what Google calls a
 * Bakery, and a restaurant is any category ending in Restaurant except the
 * fast-food, takeout and delivery ones, which answer a different question.
 *
 * Two pools let a tag add a place, in one direction each, because a place
 * can honestly be two of these things. A pizzeria is a Pizza Restaurant —
 * or an Italian or plain Restaurant that Google also tags Pizza Restaurant:
 * a pizzeria is a restaurant, so a place can be on both lists, and when
 * Google reaches for the broader word for one — "Como restoran & pizzeria"
 * is an Italian Restaurant to it — the tag is where the pizza went. Only
 * those two categories, because the same tag hangs on a kebab house and an
 * Indian restaurant that happen to have a pizza on the menu. And a café is
 * a Cafe, Coffee Shop, Coffee roastery or Tea House — or a Bakery that
 * Google also tags Coffee Shop or Cafe, which is RØST with its tables and
 * its espresso machine. Only a Bakery, because the same tag hangs on a
 * buffet, a bookshop and seven sushi restaurants.
 *
 * Bars are the one pool where a tag can only take a place off, and it is a
 * veto. The
 * category alone put a hookah lounge that is also a sushi restaurant first,
 * a jazz club ninth and a gastropub with a Belgian kitchen tenth, each of
 * them "Bar" to Google and none of them the thing somebody asking for a bar
 * means. So a bar is a Bar, Cocktail Bar or Wine Bar that Google does not
 * also call a restaurant, a pub, a hookah place, a venue or a shop: any one
 * of those takes a place off this list.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { read, fold, q } from './googlevenues.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'db', 'google-lists.sql');

const PRIOR = 300;
const FLOOR = 100;
const TOP = 10;

/* The account every list hangs off. A fixed id rather than a UUID, so a row
   in the database says whose it is. The hash is sixty-four zeros, which is
   not the PBKDF2 of anything: a sign-in as this name derives a real hash from
   whatever was typed, compares it against this, and is told "wrong username
   or password" like any other miss. Nobody can sign in as it, and that is
   the point — the lists are written by this file and by nothing else.

   `about` is the line its profile draws under the name, and it is the one
   place a reader standing on /u/google-statistics is told where the order
   came from. Generated like everything else here, so it tracks PRIOR and
   FLOOR rather than being a sentence somebody typed once. */
const USER = {
  id: 'google-statistics',
  username: 'google-statistics',
  pw_hash: '0'.repeat(64),
  pw_salt: '6f6f676c65206c69737473206e6f2070',
  pw_iter: 10000,
  about:
    'Five top tens out of Google\u2019s own ratings for Tallinn, weighed by how ' +
    'many people gave them. Rebuilt whenever the export refreshes. Google\u2019s ' +
    'numbers, not this map\u2019s verdict.'
};

/* Milliseconds, evaluated by SQLite when the file runs, so the file carries no
   clock and --check can compare it byte for byte. */
const NOW = "CAST(strftime('%s','now') AS INTEGER) * 1000";

const INTRO =
  'Google’s rating, weighed by how many people gave it: 4.5 from five ' +
  'thousand reviews outranks 4.7 from sixty, and under a hundred reviews is ' +
  'not counted. Google’s numbers, not this map’s verdict.';

/* A tag that says a "Bar" is really something else: a kitchen, a beer hall,
   a hookah lounge, a stage, a bottle shop, a canteen with a licence. See the
   header on bars. */
const NOT_A_BAR = /Restaurant|Pub|Hookah|Venue|Concert|Auditorium|Club|Store|Cafeteria/;

/* The six random characters on each id were minted once, the way
   functions/api/lists.js mints them, and are fixed here so a refresh of the
   export changes what is on a list and never where it is. The title is what
   the id was cut from; changing a title does not change its id. */
const LISTS = [
  {
    id: 'top-ten-restaurants-by-google-pt7mwk',
    title: 'Top ten restaurants, by Google',
    pick: (place) => /Restaurant$/.test(place.category) &&
      !/^(Fast Food|Takeout|Delivery) Restaurant$/.test(place.category)
  },
  {
    id: 'top-ten-bakeries-by-google-65nfrf',
    title: 'Top ten bakeries, by Google',
    pick: (place) => place.category === 'Bakery'
  },
  {
    id: 'top-ten-cafes-by-google-jz7c2b',
    title: 'Top ten cafés, by Google',
    pick: (place) => /^(Cafe|Coffee Shop|Coffee roastery|Tea House)$/.test(place.category) ||
      (place.category === 'Bakery' && /Coffee Shop|\bCafe\b/.test(place.tags))
  },
  {
    id: 'top-ten-bars-by-google-8y6grz',
    title: 'Top ten bars, by Google',
    pick: (place) => /^(Bar|Cocktail Bar|Wine Bar)$/.test(place.category) &&
      !NOT_A_BAR.test(place.tags)
  },
  {
    id: 'top-ten-pizzerias-by-google-k83p93',
    title: 'Top ten pizzerias, by Google',
    pick: (place) => place.category === 'Pizza Restaurant' ||
      (/^(Italian )?Restaurant$/.test(place.category) && /Pizza Restaurant/.test(place.tags))
  }
];

/* The export, as numbers, without the places nobody should be sent to. */
export function places() {
  return read()
    .map((place) => ({
      ...place,
      rating: Number(place.rating),
      reviews: Number(place.reviews)
    }))
    .filter((place) => Number.isFinite(place.rating) && Number.isFinite(place.reviews))
    .filter((place) => place.status !== 'Temporarily closed');
}

/* One list's ten, in order, each row carrying the score it was placed by,
   and the mean of the pool they were weighed against. */
export function rank(list, roll) {
  const pool = roll.filter(list.pick);
  let stars = 0;
  let votes = 0;
  for (const place of pool) {
    stars += place.rating * place.reviews;
    votes += place.reviews;
  }
  const mean = votes ? stars / votes : 0;

  const seen = new Set();
  const places = pool
    .filter((place) => place.reviews >= FLOOR)
    .map((place) => ({
      ...place,
      score: (place.reviews * place.rating + PRIOR * mean) / (place.reviews + PRIOR)
    }))
    .sort((a, b) => b.score - a.score || b.reviews - a.reviews)
    .filter((place) => {
      const name = fold(place.name);
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    })
    .slice(0, TOP)
    .map((place, i) => ({ ...place, pos: i }));
  return { mean: mean, places: places };
}

/* The line under each place: Google's word for it and Google's two numbers.
   The page already draws both beside a Google row, so this is the same fact
   said in the list's own voice — and the one copy that survives if the row
   ever loses its venue, because a list renders from list_items alone. */
function say(place) {
  const count = place.reviews.toLocaleString('en-GB');
  return `${place.category} · ${place.rating.toFixed(1)} from ${count} reviews on Google`;
}

export function build() {
  const roll = places();
  const out = [];

  /* The name and the line are this file's to keep current; the credentials
     are written once and never again. A rename here should move the account
     on a database that already holds it rather than leave it answering to
     what it used to be called, and the profile line tracks the constants
     above it. Nothing touches created_at: the account turned up when it
     turned up. */
  out.push(
    'INSERT INTO users (id, username, pw_hash, pw_salt, pw_iter, created_at, last_seen_at, about)\n' +
    `VALUES (${q(USER.id)}, ${q(USER.username)}, ${q(USER.pw_hash)}, ${q(USER.pw_salt)}, ${USER.pw_iter}, ${NOW}, ${NOW}, ${q(USER.about)})\n` +
    'ON CONFLICT(id) DO UPDATE SET\n' +
    '    username = excluded.username,\n' +
    '    about = excluded.about;'
  );

  const ranked = LISTS.map((list) => ({ ...list, ...rank(list, roll) }));

  out.push(
    'INSERT INTO lists (id, owner, title, intro, public, created_at, updated_at)\nVALUES\n' +
    ranked.map((list) => `  (${q(list.id)}, ${q(USER.id)}, ${q(list.title)}, ${q(INTRO)}, 1, ${NOW}, ${NOW})`).join(',\n') + '\n' +
    'ON CONFLICT(id) DO UPDATE SET\n' +
    /* owner among them, so renaming the account in this file actually moves
       its lists on a database that already holds them. Without it a rename
       writes a new user row and leaves all five lists filed under the name
       before it, which is an account with no lists beside an orphan with
       five and nothing to say which is current. */
    '    owner = excluded.owner,\n' +
    '    title = excluded.title,\n' +
    '    intro = excluded.intro,\n' +
    '    updated_at = excluded.updated_at;'
  );

  /* Replaced whole rather than upserted row by row: a place that fell out of
     a top ten has to leave it, and a delete that names its lists is the one
     statement that can say so. */
  out.push(
    'DELETE FROM list_items WHERE list_id IN (\n' +
    ranked.map((list) => '  ' + q(list.id)).join(',\n') + '\n);'
  );

  for (const list of ranked) {
    out.push(
      'INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)\nVALUES\n' +
      list.places.map((place) =>
        `  (${q(list.id)}, ${q(place.place_id)}, ${q(place.name)}, ${q(say(place))}, ${place.pos}, ${NOW})`
      ).join(',\n') + ';'
    );
  }

  return { sql: out.join('\n\n') + '\n', lists: ranked };
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
      console.log('OK — db/google-lists.sql matches the export beside it.');
      process.exit(0);
    }
    console.log('  FAIL  db/google-lists.sql is not what tools/googlelists.mjs would write.');
    console.log('\nRun `node tools/googlelists.mjs` and commit the result.');
    process.exit(1);
  }

  const result = build();

  if (process.argv.includes('--show')) {
    for (const list of result.lists) {
      console.log(`\n${list.title}  /list/${list.id}  (pool mean ${list.mean.toFixed(2)})`);
      for (const place of list.places) {
        console.log(
          `${String(place.pos + 1).padStart(3)}  ${place.score.toFixed(3)}  ` +
          `${place.rating.toFixed(1)}  ${String(place.reviews).padStart(6)}  ` +
          `${place.name}  [${place.category}]`
        );
      }
    }
    process.exit(0);
  }

  writeFileSync(OUT, result.sql);
  console.log(
    `db/google-lists.sql — ${result.lists.length} lists, ` +
    `${result.lists.reduce((n, list) => n + list.places.length, 0)} places.`
  );
  console.log('\nPaste it into the D1 console, preview first.');
}
