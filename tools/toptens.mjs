#!/usr/bin/env node
/**
 * Tallinn Tastebuds — five lists off Google's numbers, into D1.
 *
 * Reads exports/tallinn_restaurants.csv — the same export tools/googlevenues.mjs
 * loads, see exports/README.md — and writes db/top-tens.sql, which puts five
 * public lists in the `lists` table under the account named `google-statistics`:
 *
 *   Ten highest-rated bars
 *   Ten highest-rated burger places
 *   Ten highest-rated kebab shops
 *   Ten highest-rated coffee places
 *   Ten highest-rated wine bars
 *
 *   node tools/toptens.mjs           rewrite db/top-tens.sql
 *   node tools/toptens.mjs --check   report that it is stale, exit 1
 *   node tools/toptens.mjs --print   also print the five lists to read
 *   node tools/toptens.mjs --from <url>   ask a live /api/venues whether
 *                                         anything on them is hidden or gone
 *
 * Then into each database through the D1 console in the Cloudflare dashboard,
 * preview first and then production, exactly as db/google-venues.sql goes —
 * or, from a terminal with wrangler signed in:
 *
 *   wrangler d1 execute tallinntastebuds-preview --remote --file=db/top-tens.sql
 *   wrangler d1 execute tallinntastebuds         --remote --file=db/top-tens.sql
 *
 * THE ACCOUNT HAS TO EXIST FIRST, AND IT IS MADE THROUGH THE SIGN-UP FORM
 *
 * Every statement here reaches its owner as `(SELECT id FROM users WHERE
 * username = 'google-statistics')`, so the file has to be run against a
 * database that already has that account in it. Make it the way anybody makes
 * one — the sign-up form on /account.html, username `google-statistics`, a
 * password kept wherever the rest of this site's passwords are kept — once per
 * database, because the two share nothing.
 *
 * That is the whole reason the file looks the account up rather than carrying
 * an id: `users.id` is a UUID minted at sign-up, so preview and production
 * have different ones for the same person, and a file with either baked into
 * it would be wrong on one of the two databases. Looking it up also keeps the
 * one thing that must never be in this repository out of it — the account's
 * password hash and salt, which is what seeding a `users` row from SQL would
 * have meant committing.
 *
 * If the account is missing, `owner` comes out NULL against a NOT NULL column
 * and the load stops on the first statement with nothing written. That is the
 * intended failure: loud, at the top, and before any list exists.
 *
 * WHY THE LISTS ARE PUBLISHED BY SOMEBODY CALLED google-statistics
 *
 * Because this site does not rank restaurants and is not about to start. The
 * map is one person's, seventy-five places in no order but the alphabet, and
 * the top of README.md promises there are no scores on them. These five are
 * Google's opinion of Tallinn read back — the same numbers /google already
 * sorts by, and the same arithmetic — so they go out under a name that says
 * whose opinion it is, next to a byline that links to a profile of nothing
 * else. A list of the same ten under the site's own name would be the site
 * making the claim, which is the thing the rule forbids.
 *
 * The name is `google-statistics` and not `google`, which is a difference
 * worth the eleven characters. A profile at /u/google publishing "Ten
 * highest-rated bars" reads as Google having published it, and this site is
 * careful enough about attribution everywhere else that it cannot be careless
 * here: these are statistics *out of* Google's data, gathered by somebody who
 * is not Google. The username says which.
 *
 * Each intro says it again in words, because a username is not an attribution
 * and somebody arriving on a shared link has not read this file.
 *
 * WHAT DECIDES THE TEN
 *
 * A floor and then an order, and they do different jobs:
 *
 *   the floor   fifty reviews, and Google still calling the place open. It is
 *               what keeps "5.0 from eleven reviews" out of a top ten
 *               altogether rather than merely low in one.
 *
 *   the order   the Bayesian average weigh() computes in assets/venues.js for
 *               the directory's "Best overall" — each rating pulled towards
 *               the whole export's review-weighted mean by a weight that fades
 *               as the count grows. Same PRIOR of 100, same mean over all
 *               1,110 rows rather than over the handful a list draws from, so
 *               a place sits in the same order here as it does on /google.
 *
 * Sorted on Google's rating alone the coffee list would open on Kohvik Mäeke,
 * 5.0 from fifty-seven, which the weighting leaves out of the ten altogether;
 * ten of that pool are a 4.9 or better on under three hundred reviews, so the
 * raw number cannot separate them and the tie-break never gets a say. The
 * floor without the weighting is not enough; the weighting without the floor
 * lets a thin row in at the bottom. Both.
 *
 * THE EXPORT BUILDS THE FILE; /api/venues IS WHAT CHECKS IT
 *
 * There are two places these ten could be read from and they are not the same
 * thing. `exports/tallinn_restaurants.csv` is the export — a file, in the
 * repository, that answers the same way on any machine with no network and no
 * account. `/api/venues` is the mirror of it in D1, which is what the
 * directory actually draws, and it answers with two things the export cannot:
 * `hidden = 0` and `missing_since IS NULL`. Those are curation columns a
 * refresh never touches — a duplicate, a car park Google files as a
 * restaurant, a row the last sync stopped carrying — so the endpoint's roll is
 * the export's roll minus whatever has been struck off it by hand.
 *
 * The file is built from the export, because `--check` runs in CI and a
 * generated file whose contents depend on a live site is a build that fails
 * when somebody else's deployment is slow. Determinism is worth more here than
 * currency: the export is what the mirror was loaded from, so the two agree
 * unless a column of mine says otherwise.
 *
 * `--from <url>` is where the endpoint earns its place. It fetches a live
 * `/api/venues` and asks the one question the export cannot ask about itself:
 * *is anything these lists name no longer something the site will show.* A
 * place struck off by hand or dropped by the last sync is simply not in that
 * answer, and a list row pointing at one still renders — quietly, out of the
 * row's own stored name — which is exactly the kind of wrong nobody notices.
 *
 * It does not recompute the ten, and cannot: that route sends `kitchens`
 * already worked out and leaves the category and the cuisine behind, and every
 * rule below is asked of those two columns and the name. Putting them into
 * that answer would cost every reader of the directory bytes in order to serve
 * a generator, which is the wrong way round.
 *
 * WHAT A PLACE IS, NEVER WHAT IT ALSO HAS
 *
 * This is the correction that matters most in this file, and it is one line of
 * difference. kitchensOf() in functions/api/venues.js reads three columns —
 * category, cuisine and the tag list — and a directory is right to read all
 * three: it has to file every place somewhere and say two words about it. A
 * top ten is a different question. The tags are everything a place also
 * happens to have, and trusting them put a café in the ten best bars (Kiosk NO
 * 1, typed "Cafe", tagged Wine Bar), a kebab shop in the ten best burgers (Ala
 * Turca, tagged Hamburger Restaurant), and a wine bar in the ten best coffee
 * places (Veino, typed "Wine Bar", tagged Cafeteria).
 *
 * So the kitchens here are asked of the category and the cuisine only, by
 * handing kitchensOf() the row with its tags emptied — the table is still that
 * one table, imported rather than restated, and no pattern of it is copied.
 * `words` and `not` are tested against those same two columns plus the place's
 * own name, and never the tags either.
 *
 * The name is in there for the kebab list, which needs it. Google types almost
 * every shawarma counter in this city as "Turkish Restaurant" or "Fast Food
 * Restaurant" and stops: seven of the ten this draws have no kebab word
 * anywhere in Google's three columns. It is in what the shop calls itself —
 * Shaurma Kebab Õismäe, Nõmme Kebab, Brööder Kebab — so that is where this
 * looks. Asking for the `middle-eastern` and `turkish` kitchens instead, which
 * is what it did first, put a Middle Eastern restaurant and a Turkish
 * restaurant in a list of kebab shops.
 *
 * Places do fall on two lists, and the wine bars are the honest case: every
 * one of them is a bar, so the best of them are on both. A wine bar is a bar.
 *
 * ONE ROW PER BUSINESS
 *
 * Fifteen names in the export belong to more than one row, because a chain has
 * more than one door, and a top ten showing Brööder Kebab eighth and Brööder
 * Kebab tenth reads as a bug rather than as two shops. one_each() keeps the
 * best-placed branch of an identical name and drops the rest. Branches a chain
 * names apart are left alone, which is right: Shaurma Kebab Õismäe and Shaurma
 * Kebab Punane are different addresses with different scores and a reader can
 * tell them apart.
 *
 * NINE OF THE FIFTY ROWS ARE ON MY MAP, AND THOSE CARRY MY ID INSTEAD
 *
 * The export overlaps data/restaurants.json in sixty places — overlaps() in
 * tools/googlevenues.mjs matches them on the front door, see the note there —
 * and eight of those sixty come out in a top ten, Vabrik on two of them. A list row holding Google's
 * key for one of them would render as a Google row: name, write-up link, and
 * "According to Google 4.6 from 960 reviews" printed under a place of mine.
 * That is the one sentence README.md's rule actually forbids — no place of
 * mine carries a score, ever — so those rows hold the map's own slug, which
 * draws them the way every other place of mine is drawn and links straight to
 * the write-up.
 *
 * They keep their position. Leaving a place out of a list of the ten Google
 * rates highest because I happen to have eaten there would make the list false
 * about the one thing it claims; not printing the number on my own row costs
 * nothing but the number.
 *
 * RE-RUNNABLE, AND IT NEVER OVERWRITES A SENTENCE SOMEBODY TYPED
 *
 * Every list and every row is an upsert. A refreshed export moves the ten:
 * new places are inserted, the ones still there have their name and position
 * updated, and the ones that fell out are deleted from that list by a
 * statement that names the ten replacing them.
 *
 * `list_items.say` is the exception and it is the same exception map_id is in
 * db/google-venues.sql: it is never written by an update. Signing in as
 * `google-statistics` and typing a line under a row is the way these lists get
 * sentences
 * — the generator has nothing to say about a restaurant nobody here has eaten
 * at, so it writes none — and curation a sync can erase is curation you will
 * do twice.
 *
 * NOT ONE COMMENT IN THE FILE IT WRITES
 *
 * Same reason db/google-venues.sql carries none: the D1 console folds a paste
 * onto one line, and a `--` comment then runs to the end of the file and takes
 * every statement after it with it. What the statements are is here, where a
 * reader is.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { read, overlaps } from './googlevenues.mjs';
import { kitchensOf } from '../functions/api/venues.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'db', 'top-tens.sql');

/* The account the five lists are published under. It is looked up by name on
   every statement — see the header for why there is no id in this file. */
const OWNER = 'google-statistics';

/* The caps functions/api/lists.js binds a write to, restated here because this
   file writes rows that route never sees: a title longer than the site would
   accept is a row the list editor could not save afterwards. Asserted rather
   than truncated — a title over the cap is a title to rewrite, not to cut in
   half.

   These are the fourth copy of MAX_TITLE and the third of MAX_INTRO;
   assets/lists.js and assets/account.js hold the others, README's **The caps**
   is the table, and `grep -rn 'MAX_TITLE' functions assets tools` finds the
   lot. Change one, change all of them. */
const MAX_TITLE = 60;
const MAX_INTRO = 200;

/* Google still calling the place open, and this many people behind the score.
   Fifty is the reader's own instinct written down — it is roughly where a
   rating stops being a handful of friends — and it is under the export's
   median of 237, so it excludes the thin rows rather than most of the roll. */
const FLOOR = 50;
const TOP = 10;

/* weigh() in assets/venues.js, and the constant has to be this one: the whole
   point of reusing the directory's arithmetic is that a place stands in the
   same order on both. See the header. */
const PRIOR = 100;

/* The five. `kitchens` are ids out of KITCHENS in functions/api/venues.js;
   `noun` is how the intro names the pool it drew from, which is a count this
   file computes rather than a number typed into prose that a refresh makes
   wrong.

   The ids are fixed, and that is the difference between this and a list made
   on the site. functions/api/lists.js mints one as the title's slug plus six
   characters out of an alphabet with no vowels in it, so it cannot spell
   anything and cannot be guessed at from a neighbour; these were minted the
   same way, once, and written down — because a generated id would be five new
   lists every time this ran, and the address is the thing somebody sends to a
   friend. */
const LISTS = [
  {
    id: 'ten-highest-rated-bars-kw37r7',
    title: 'Ten highest-rated bars',
    kitchens: ['bar'],
    /* A shisha lounge is not a night out at a bar, whatever Google files it
       under — "Hookah Bar" is its category on MyShisha, which is what put a
       hookah lounge fourth in this list the first time it was drawn. The
       `bar` pattern in KITCHENS names hookah outright and is right to, because
       the directory has to file the place somewhere; a top ten does not. */
    not: /hookah/,
    noun: 'bars'
  },
  {
    id: 'ten-highest-rated-burger-places-tbjbjk',
    title: 'Ten highest-rated burger places',
    kitchens: ['burgers'],
    noun: 'burger places'
  },
  {
    /* The one list with no kitchen test, because the name is the only place
       the word reliably appears. See the header. */
    id: 'ten-highest-rated-kebab-shops-ytt6qf',
    title: 'Ten highest-rated kebab shops',
    words: /kebab|kebap|shawarma|shaurma|shawerma|doner|döner/,
    noun: 'kebab and shawarma shops'
  },
  {
    id: 'ten-highest-rated-coffee-places-x3tkvk',
    title: 'Ten highest-rated coffee places',
    kitchens: ['coffee'],
    noun: 'coffee places'
  },
  {
    /* Both halves are load-bearing. The kitchen keeps it to places that are a
       bar — without it, every bakery and sushi counter Google hangs a "Wine
       Bar" tag on arrives — and the word keeps it to the wine ones. Toro
       veinikohvik is why the word is looked for in the name too: Google says
       only "Bar" about it, twice, and the wine is in what it calls itself. */
    id: 'ten-highest-rated-wine-bars-qfcpcf',
    title: 'Ten highest-rated wine bars',
    kitchens: ['bar'],
    words: /wine|vein|vinoteek/,
    noun: 'wine bars'
  }
];

/* The sentence under every one of the five titles. One shape, because they are
   one claim made five times, and the only things that move are what was
   counted and how many of it there were. */
function introFor(list, pool) {
  return (
    "Google's numbers, not mine: the ten it rates highest of the " + pool + ' ' +
    list.noun + ' in its Tallinn export carrying fifty reviews or more, each ' +
    'rating weighted by how many people left one.'
  );
}

/* Single quotes doubled, which is the whole of SQL string escaping, and the
   same q() db/google-venues.sql is written with. Names in this export carry
   apostrophes — Salt'sUp soolakohvik is on one of these lists — so this is
   load-bearing rather than defensive. */
function q(value) {
  return "'" + String(value == null ? '' : value).replace(/'/g, "''") + "'";
}

/* Written as an expression rather than a number for the reason googlevenues.mjs
   gives: the generated file then has no clock in it, so --check can compare it
   byte for byte, and the timestamp is when the load happened. */
const NOW = "CAST(strftime('%s','now') AS INTEGER) * 1000";

const OWNER_ID = '(SELECT id FROM users WHERE username = ' + q(OWNER) + ' COLLATE NOCASE)';

/* The export, which is what the committed file is built from.
 *
 * `overlaps()` is how a row learns it is also on my map — matched on the front
 * door rather than the name, see the note in tools/googlevenues.mjs.
 *
 * `best` is weigh() in assets/venues.js: each rating pulled towards the roll's
 * own review-weighted mean by a weight that fades as the count grows. The mean
 * is taken over every row in the export rather than over the pool one list
 * draws from, and that is deliberate — a bar weighed against other bars would
 * be scored against a mean of the bars, and the directory would then put it
 * somewhere else than this does.
 */
function rollFromCsv() {
  const rows = read();
  const onMap = new Map(overlaps(rows).map((o) => [o.place_id, o.map_id]));

  let stars = 0;
  let votes = 0;
  for (const row of rows) {
    const rating = Number(row.rating);
    const reviews = Number(row.reviews);
    if (rating && reviews) {
      stars += rating * reviews;
      votes += reviews;
    }
  }
  const mean = votes ? stars / votes : 0;

  return rows.map((row) => {
    const rating = Number(row.rating) || 0;
    const reviews = Number(row.reviews) || 0;
    return {
      place_id: row.place_id,
      map_id: onMap.get(row.place_id) || null,
      name: row.name,
      open: row.status === 'Open',
      rating: rating,
      reviews: reviews,
      /* What the place IS, never what it also has. kitchensOf() reads the
         category, the cuisine and the tags; handing it the row with its tags
         emptied is how you ask it only the first two, without restating one
         pattern of that table here. See the header. */
      kitchens: kitchensOf({ ...row, tags: '' }),
      /* The same two columns, plus the name, as one lowercased string for
         `words` and `not` to be tested against. */
      identity: [row.name, row.category, row.cuisine].join(' | ').toLowerCase(),
      best: (reviews * rating + PRIOR * mean) / (reviews + PRIOR)
    };
  });
}

/* Every place_id a live /api/venues is still willing to show, for --from.
 *
 * That route answers with `hidden = 0 AND missing_since IS NULL` — the two
 * curation columns a refresh never touches — so what comes back is the
 * export's roll minus whatever has been struck off by hand. The ids are all
 * this needs; see the header for why --from asks about presence rather than
 * recomputing the ten.
 */
async function liveIds(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} answered ${res.status} ${res.statusText}`);

  const entries = await res.json();
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(`${url} answered no venues — is it /api/venues, and is the database bound?`);
  }

  return new Set(entries.map((e) => e && e.id).filter(Boolean));
}

/* One list's pool and its ten.
 *
 * Three tests, and a list uses whichever of them it needs:
 *
 *   kitchens  any one of these ids, out of KITCHENS in functions/api/venues.js
 *             and asked of what the place IS — see the header.
 *   words     Google's category and cuisine, and the place's own name, have to
 *             say this as well.
 *   not       and must not say this.
 *
 * All three read the same two columns and the name, and never the tag list.
 * That is the whole correction this shape exists for: a tag is everything a
 * place also happens to have, and a top ten of bars that trusted the tags put
 * a café in it, a top ten of burgers put a kebab shop in it, and a top ten of
 * coffee put a wine bar in it — because Google had hung "Bar", "Hamburger
 * Restaurant" and "Cafeteria" on the three of them respectively.
 *
 * The pool is what the intro counts; the ten is the pool in the weighted
 * order, cut. The tie-break is the review count, the same one ORDERS.best uses
 * in assets/venues.js — two places the weighting cannot separate are separated
 * by how many people are behind them.
 */
function pick(venues, list) {
  /* Every row in the export as it stands carries a rating, so `rating > 0`
     never fires on that roll. It is here because weigh() in assets/venues.js
     scores an unrated place at the roll's mean, which is right for a directory
     that still has to draw the row and wrong for a list of the highest-rated,
     where it would seat a place Google has said nothing about. */
  const eligible = venues.filter(
    (v) =>
      v.open &&
      v.reviews >= FLOOR &&
      v.rating > 0 &&
      (!list.kitchens || list.kitchens.some((k) => v.kitchens.includes(k))) &&
      (!list.words || list.words.test(v.identity)) &&
      !(list.not && list.not.test(v.identity))
  );

  const ten = one_each(
    eligible.slice().sort((a, b) => b.best - a.best || b.reviews - a.reviews)
  ).slice(0, TOP);

  return { pool: eligible.length, ten: ten };
}

/* One row per business, keeping the best-placed branch.
 *
 * Fifteen names in the export belong to more than one row, because a chain has
 * more than one door — and a top ten with Brööder Kebab at eighth and Brööder
 * Kebab at tenth reads as a bug in the list rather than as two shops. The
 * branches of a chain that names them apart are untouched, which is right:
 * Shaurma Kebab Õismäe and Shaurma Kebab Punane are different addresses with
 * different scores and the reader can tell which is which.
 *
 * Run after the sort, so the branch that survives is the one that ranked
 * highest rather than whichever the export happened to list first.
 */
function one_each(sorted) {
  const seen = new Set();
  return sorted.filter((v) => {
    const name = v.name.trim().toLowerCase();
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

function build(venues = rollFromCsv()) {
  const out = [];
  const picked = [];

  for (const list of LISTS) {
    const { pool, ten } = pick(venues, list);
    const intro = introFor(list, pool);

    if (list.title.length > MAX_TITLE) {
      throw new Error(`"${list.title}" is ${list.title.length} characters; lists.js caps a title at ${MAX_TITLE}`);
    }
    if (intro.length > MAX_INTRO) {
      throw new Error(`the intro for ${list.id} is ${intro.length} characters; lists.js caps one at ${MAX_INTRO}`);
    }
    if (ten.length < TOP) {
      throw new Error(`${list.id} found only ${ten.length} of ${TOP} places over the ${FLOOR}-review floor`);
    }

    picked.push({ list: list, pool: pool, ten: ten });

    /* The list itself. `owner` is updated as well as inserted, so a database
       whose google-statistics account was made again — a new UUID for the
       same name —
       is put right by re-running this rather than by hand. `created_at` is
       not: it is when the list first appeared, and a re-run is not that. */
    out.push(
      'INSERT INTO lists (id, owner, title, intro, public, created_at, updated_at)\n' +
      `VALUES (${q(list.id)}, ${OWNER_ID}, ${q(list.title)}, ${q(intro)}, 1, ${NOW}, ${NOW})\n` +
      'ON CONFLICT(id) DO UPDATE SET\n' +
      '    owner = excluded.owner,\n' +
      '    title = excluded.title,\n' +
      '    intro = excluded.intro,\n' +
      '    public = excluded.public,\n' +
      `    updated_at = ${NOW};`
    );

    /* The ten, in order, as one statement. `say` is written on the way in and
       never on the way past — see the header — so a sentence typed into the
       list editor survives every future run of this file. */
    const rows = ten.map((v, i) => {
      const id = v.map_id || v.place_id;
      return `  (${q(list.id)}, ${q(id)}, ${q(v.name)}, '', ${i}, ${NOW})`;
    });

    out.push(
      'INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)\nVALUES\n' +
      rows.join(',\n') + '\n' +
      'ON CONFLICT(list_id, place_id) DO UPDATE SET\n' +
      '    name = excluded.name,\n' +
      '    pos = excluded.pos;'
    );

    /* And whatever was on this list before and is not one of the ten above has
       fallen out of the top ten. Deleted rather than left, because a list is
       ten rows and an eleventh is somebody else's mistake — and the ten
       replacing it are named in the statement, so what it removes can be read
       off the file. */
    out.push(
      `DELETE FROM list_items WHERE list_id = ${q(list.id)} AND place_id NOT IN (\n` +
      ten.map((v) => '  ' + q(v.map_id || v.place_id)).join(',\n') + '\n);'
    );
  }

  return { sql: out.join('\n\n') + '\n', statements: out, picked: picked };
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

/* One list, printed the way somebody would want to read it. Two callers —
   --print after a build, and --from when a live roll disagrees. */
function show(list, pool, ten) {
  console.log(`\n${list.title}  —  ${pool} over the ${FLOOR}-review floor`);
  ten.forEach((v, i) => {
    console.log(
      `${String(i + 1).padStart(3)}. ${v.rating.toFixed(1)} from ${String(v.reviews).padStart(5)}   ` +
      v.name + (v.map_id ? `   (on the map as ${v.map_id})` : '')
    );
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (flag) => {
    const at = process.argv.indexOf(flag);
    return at === -1 ? null : process.argv[at + 1] || '';
  };

  const from = arg('--from');

  /* Is anything these lists name no longer something the site will show?
     
     /api/venues answers with hidden = 0 AND missing_since IS NULL, so a place
     that has been struck off by hand or dropped by the last sync is simply not
     in it. That is the one question the export cannot answer about itself, and
     it is the one worth asking: a list row pointing at a hidden place still
     renders, quietly, out of the row's own stored name.

     It does not recompute the ten. It cannot: the endpoint sends `kitchens`
     already worked out and leaves the category and cuisine behind, and the
     rules above are asked of those two columns and the name. Adding them to
     that answer would cost every reader of the directory bytes to serve a
     generator, which is the wrong way round. */
  if (from !== null) {
    if (!from || from.startsWith('--')) {
      console.log('  FAIL  --from wants a URL, e.g. --from https://tallinntastebuds.ee/api/venues');
      process.exit(1);
    }

    const shown = await liveIds(from);
    const gone = [];

    for (const { list, ten } of build().picked) {
      for (const v of ten) {
        /* The rows carrying a map slug are places of mine out of
           data/places.json, which this endpoint knows nothing about and the
           validator already holds to the catalogue. */
        if (v.map_id) continue;
        if (!shown.has(v.place_id)) gone.push(`${list.title}: ${v.name} (${v.place_id})`);
      }
    }

    if (gone.length === 0) {
      console.log(`OK — every place on the ${LISTS.length} lists is still shown by ${from}.`);
      process.exit(0);
    }

    console.log(`  FAIL  ${gone.length} place(s) on these lists are hidden or missing in google_venues:`);
    for (const line of gone) console.log('    ' + line);
    console.log('\nEither strike them out of the export and re-run this tool, or clear the');
    console.log('hidden/missing_since column on the rows that should be there.');
    process.exit(1);
  }

  if (process.argv.includes('--check')) {
    if (!stale()) {
      console.log('OK — db/top-tens.sql matches the export beside it.');
      process.exit(0);
    }
    console.log('  FAIL  db/top-tens.sql is not what tools/toptens.mjs would write.');
    console.log('\nRun `node tools/toptens.mjs` and commit the result.');
    process.exit(1);
  }

  const result = build();
  writeFileSync(OUT, result.sql);

  console.log(
    `db/top-tens.sql — ${result.picked.length} lists, ` +
    `${result.picked.reduce((n, p) => n + p.ten.length, 0)} places, ` +
    `published as ${OWNER}.`
  );

  if (process.argv.includes('--print')) {
    for (const { list, pool, ten } of result.picked) show(list, pool, ten);
  }

  console.log(`\nThe ${OWNER} account has to exist in the database first — see the top of this file.`);
  console.log('Paste it into the D1 console, preview first.');
}
