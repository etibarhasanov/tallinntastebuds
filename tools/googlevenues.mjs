#!/usr/bin/env node
/**
 * Tallinn Tastebuds — the Google Places export, into D1.
 *
 * Reads exports/tallinn_restaurants.csv — 1,110 places, 18 columns, the
 * cleaned form of the raw Google export; see exports/README.md — and writes
 * db/google-venues.sql, which is what actually loads them.
 *
 *   node tools/googlevenues.mjs           rewrite db/google-venues.sql
 *   node tools/googlevenues.mjs --check   report that it is stale, exit 1
 *   node tools/googlevenues.mjs --parts   also cut it into pieces to paste
 *
 * Then it goes into each database through the D1 console in the Cloudflare
 * dashboard — Storage & Databases, D1, the database, Console — pasted and
 * executed, preview first and then production. That is how it is done here,
 * because it needs nothing installed and no token anywhere; wrangler does the
 * same from a terminal that is signed in:
 *
 *   wrangler d1 execute tallinntastebuds         --remote --file=db/google-venues.sql
 *   wrangler d1 execute tallinntastebuds-preview --remote --file=db/google-venues.sql
 *
 * WRITTEN TO BE PASTED, WHICH IS WHY THERE IS NOT ONE COMMENT IN IT
 *
 * The console's box folds a paste onto one line. A "--" comment runs to the
 * end of its line, so the first one in the file swallowed everything after
 * it and D1 was handed no query at all — a whole load, lost to a heading. So
 * the file carries statements and nothing else; what they are and why is
 * here, where a reader is, and not in a file that a machine reads.
 *
 * The console also has a ceiling on one paste that the whole file is over.
 * --parts cuts it at statement boundaries into pieces under eighty kilobytes,
 * the size that has been pasted and worked, and writes them outside the
 * repository: they are the same statements in the same order, and two copies
 * of the export in git would be two copies to keep in step.
 *
 * Zero dependencies, like every other tool in here, and it carries its own CSV
 * reader — exported, so anything else that needs one imports it from here
 * rather than growing a second.
 *
 * WHY A FILE OF SQL RATHER THAN A SCRIPT THAT TALKS TO D1
 *
 * Because the thing that touches the production database should be readable
 * before it runs. A generated .sql file can be diffed, reviewed and replayed;
 * a script holding an API token cannot be any of those, and it would need a
 * credential in CI that nothing else here needs.
 *
 * RE-RUNNABLE, AND THAT IS THE WHOLE DESIGN
 *
 * Every row is an upsert keyed on Google's own place_id. Running the file
 * twice changes nothing; running a refreshed export updates Google's columns
 * and leaves mine alone. Specifically:
 *
 *   overwritten   name, category, cuisine, rating, reviews, price, status,
 *                 address, postal_code, city, phone, website, opening_hours,
 *                 tags, latitude, longitude, maps_url
 *   never touched map_id, hidden, note, first_seen_at
 *
 * That split is the point. Hand-curation that a sync can erase is curation
 * you will do twice.
 *
 * HOW A PLACE THAT LEFT THE EXPORT IS NOTICED
 *
 * The file closes by marking as missing every row whose key is not in the
 * list of keys it has just written — one statement, and the list is in it,
 * so what it touches can be read off the file. Nothing is ever deleted: a
 * list may be pointing at it, and somebody wrote a sentence about it. A row
 * that comes back is cleared by its own upsert.
 *
 * It used to open by marking every row missing and let the upserts clear
 * the marks, which reads as neat and is not: a file that stops after that
 * first statement has flagged the whole table, and nothing in it names a
 * row. Every statement here now touches only rows it names.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CSV = join(ROOT, 'exports', 'tallinn_restaurants.csv');
const OUT = join(ROOT, 'db', 'google-venues.sql');
const MAP = join(ROOT, 'data', 'restaurants.json');

/* ------------------------------------------------------------------- CSV
 * Written out rather than depended on, and it is RFC 4180 rather than
 * `split(',')`: an address is "Viru 24, 10140 Tallinn" more often than not,
 * so the quoting is the whole point. A doubled quote inside a quoted field is
 * one quote, and a newline inside one is part of the value — which the raw
 * Google export relies on heavily.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let started = false;

  /* A byte-order mark is what a spreadsheet puts at the front of a UTF-8
     file, and it would otherwise become part of the first column's name. */
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const endField = () => { row.push(field); field = ''; started = false; };
  const endRow = () => {
    endField();
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }

    if (c === '"' && !started) { quoted = true; started = true; continue; }
    if (c === ',') { endField(); continue; }
    if (c === '\r') continue;
    if (c === '\n') { endRow(); continue; }
    field += c;
    started = true;
  }

  if (field !== '' || row.length) endRow();
  return rows;
}

/* Google puts the coordinates in its own URLs in two shapes: the `@lat,lng`
   in the address bar, and the `!3dlat!4dlng` in a share link. Takeout hands
   back the second and no lat/lng columns at all, so this is what makes that
   export usable without a round trip to an API. */
export function coordsFromUrl(url) {
  const s = String(url || '');
  let m = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(s);
  if (!m) m = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(s);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}

export function fold(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0131\u0130]/g, 'i')
    .replace(/\s+/g, ' ')
    .trim();
}

/* The export's own column names, in the export's own order. The table mirrors
   them exactly — no renaming, not even latitude/longitude to the lat/lng the
   rest of the site uses — because the contract of that table is "the export,
   in SQL", and a contract with exceptions is one you have to look up. */
const GOOGLE_COLUMNS = [
  'name', 'category', 'cuisine', 'rating', 'reviews', 'price', 'status',
  'address', 'postal_code', 'city', 'phone', 'website', 'opening_hours',
  'tags', 'latitude', 'longitude', 'maps_url'
];

/* The two that are numbers in SQL and text in a CSV. Everything else is text,
   including price ("$$") and postal_code, which has leading zeroes to lose. */
const NUMERIC = new Set(['rating', 'reviews', 'latitude', 'longitude']);

/* Google's key: "ChIJUdUjCV2TkkYRcg8TxVp1XUI". Checked rather than trusted,
   because it becomes a primary key and it is what a list item will hold. */
const PLACE_ID = /^[A-Za-z0-9_-]{20,255}$/;

/* SQLite string literal: double the quotes, and nothing else is special. The
   values here are names and addresses, not code, but this is the one function
   in the repository that turns somebody else's data into SQL text, so it is
   written to be right rather than to be short. */
function q(value) {
  return "'" + String(value == null ? '' : value).replace(/'/g, "''") + "'";
}

function num(value) {
  const n = Number(String(value == null ? '' : value).trim());
  return Number.isFinite(n) ? String(n) : 'NULL';
}

/* Milliseconds, evaluated by SQLite when the file runs rather than baked in
   here. Two reasons: the generated file then has no clock in it, so --check
   can compare it byte for byte; and the timestamp is when the sync actually
   happened rather than when somebody last ran this tool. */
const NOW = "CAST(strftime('%s','now') AS INTEGER) * 1000";

export function read() {
  if (!existsSync(CSV)) throw new Error('exports/tallinn_restaurants.csv is not here');
  const rows = parseCsv(readFileSync(CSV, 'utf8'));
  if (rows.length < 2) throw new Error('exports/tallinn_restaurants.csv has no rows');

  /* The header is read rather than assumed, and then checked: a refreshed
     export that quietly drops a column should fail here, loudly, rather than
     write NULLs over eleven hundred rows of real data. */
  const header = rows[0].map((h) => h.trim());
  const at = {};
  header.forEach((name, i) => { at[name] = i; });

  const missing = ['place_id', ...GOOGLE_COLUMNS].filter((c) => at[c] === undefined);
  if (missing.length) {
    throw new Error(
      'the export is missing column(s) this expects: ' + missing.join(', ') +
      '\nIt carries: ' + header.join(', ')
    );
  }

  const places = [];
  const seen = new Set();

  for (let i = 1; i < rows.length; i++) {
    const cell = (c) => String(rows[i][at[c]] || '').trim();
    const id = cell('place_id');
    if (!id) continue;
    if (!PLACE_ID.test(id)) throw new Error(`row ${i + 1}: "${id}" is not a Google place id`);
    /* Google's key is unique in this export — all 1,110 of them — and the table
       makes it a primary key, so a duplicate would silently become one row
       with the later one's values. Better to stop. */
    if (seen.has(id)) throw new Error(`row ${i + 1}: place_id ${id} appears twice`);
    seen.add(id);

    const place = { place_id: id };
    for (const c of GOOGLE_COLUMNS) place[c] = cell(c);
    places.push(place);
  }

  return places;
}

/* The 60 places that are on my map as well as in the export.
 *
 * Matched on the coordinates rather than the name, because the names disagree
 * — "Põhjala Tap Room" against "Põhjala Brewery & Tap Room" — while a
 * restaurant's front door does not move. The name is then a sanity check
 * rather than the test: two different restaurants inside sixty metres of each
 * other is a shopping centre, and the name is what tells them apart.
 */
const SAME_PLACE_M = 60;

function metresApart(a, b) {
  const lat = ((a.lat + b.lat) / 2) * Math.PI / 180;
  const dy = (a.lat - b.lat) * 111320;
  const dx = (a.lng - b.lng) * 111320 * Math.cos(lat);
  return Math.sqrt(dx * dx + dy * dy);
}

/* Does either name contain the other, once folded down to letters and digits?
   "Pudel" against "Pudel Baar" passes; "Pudel" against "Kompressor" does not.
   Punctuation and spacing go, because they are exactly what the two sources
   disagree about and never what makes two restaurants different — Google's
   "Elmans Bite's" and the map's "Elmans Bites" are the same doorway, and the
   apostrophe was the only thing that said otherwise.

   Or does every word of the shorter name appear in the longer? Google writes
   "Fotografiska Tallinn Café & Bakery" for the map's "Fotografiska Café &
   Bakery", and with the city dropped into the middle neither string contains
   the other — while the bare "Fotografiska" upstairs is contained by both, so
   without this the café's row was handed the restaurant's write-up. The two
   tests are kept separate rather than replaced by the word one alone: split
   into words, "Bite's" is "bite" and "s", and Elmans would stop matching.

   Safe to be this loose only because the caller has already required the two
   pins to be within sixty metres of each other. */
function namesAgree(a, b) {
  const bare = (s) => fold(s).replace(/[^a-z0-9]/g, '');
  const x = bare(a);
  const y = bare(b);
  if (!x || !y) return false;
  if (x.includes(y) || y.includes(x)) return true;

  const words = (s) => fold(s).split(/[^a-z0-9]+/).filter(Boolean);
  const [shorter, longer] = [words(a), words(b)].sort((p, q) => p.length - q.length);
  return shorter.every((w) => longer.includes(w));
}

export function overlaps(places) {
  const curated = JSON.parse(readFileSync(MAP, 'utf8'));
  const found = [];

  for (const place of places) {
    const lat = Number(place.latitude);
    const lng = Number(place.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    let best = null;
    for (const mine of curated) {
      const m = metresApart({ lat: lat, lng: lng }, { lat: mine.lat, lng: mine.lng });
      if (m > SAME_PLACE_M) continue;
      if (!namesAgree(place.name, mine.name)) continue;
      if (!best || m < best.m) best = { id: mine.id, name: mine.name, m: m };
    }
    if (best) found.push({ place_id: place.place_id, map_id: best.id, name: place.name, mine: best.name });
  }
  return found;
}

/* -------------------------------------------------------------------- write */

export function build() {
  const places = read();
  const matched = overlaps(places);

  const cols = ['place_id', ...GOOGLE_COLUMNS];
  const setters = GOOGLE_COLUMNS.map((c) => `    ${c} = excluded.${c}`).join(',\n');

  /* One entry per statement, and no comments between them — see the header
     for why. The file is these joined with a blank line. */
  const out = [];

  /* Rows per INSERT. The console and wrangler both send one request per
     statement, so a row-at-a-time file is 1,110 round trips to Cloudflare
     and several minutes of watching a progress bar; batched, it is
     twenty-three and a few seconds. Fifty keeps each statement around 26KB,
     which is comfortably inside every limit involved and still small enough
     to read one of if something ever goes wrong. */
  const BATCH = 50;

  for (let i = 0; i < places.length; i += BATCH) {
    const chunk = places.slice(i, i + BATCH);
    const rows = chunk.map((place) => {
      const values = cols.map((c) =>
        c === 'place_id' ? q(place[c]) : (NUMERIC.has(c) ? num(place[c]) : q(place[c]))
      );
      return `  (${values.join(', ')}, ${NOW}, ${NOW})`;
    });

    out.push(
      `INSERT INTO google_venues (${cols.join(', ')}, first_seen_at, synced_at)\nVALUES\n` +
      rows.join(',\n') + '\n' +
      `ON CONFLICT(place_id) DO UPDATE SET\n${setters},\n` +
      `    synced_at = ${NOW},\n` +
      `    missing_since = NULL;`
    );
  }

  /* Whatever is in the table and not in the list above has left the export.
     Marked rather than deleted: a list may be pointing at it. A place that
     comes back is cleared by its own upsert. */
  out.push(
    `UPDATE google_venues SET missing_since = ${NOW}\n` +
    'WHERE missing_since IS NULL AND place_id NOT IN (\n' +
    places.map((place) => '  ' + q(place.place_id)).join(',\n') + '\n);'
  );

  /* The places that are also on my map, so a list row pointing at one can
     link through to its write-up. Only ever set when it is empty, so a
     correction made by hand survives every future run of this file. */
  for (const m of matched) {
    out.push(
      `UPDATE google_venues SET map_id = ${q(m.map_id)} ` +
      `WHERE place_id = ${q(m.place_id)} AND map_id IS NULL;`
    );
  }

  return { sql: out.join('\n\n') + '\n', statements: out, places: places, matched: matched };
}

/* The file, cut at statement boundaries into pieces the console will take in
   one paste. Written next to nothing in the repository: the pieces are the
   file, and the file is what is committed. */
const PART_BYTES = 80 * 1024;

export function parts(statements) {
  const pieces = [];
  let piece = [];
  let size = 0;
  for (const statement of statements) {
    const bytes = Buffer.byteLength(statement, 'utf8') + 2;
    if (piece.length && size + bytes > PART_BYTES) {
      pieces.push(piece);
      piece = [];
      size = 0;
    }
    piece.push(statement);
    size += bytes;
  }
  if (piece.length) pieces.push(piece);
  return pieces.map((p) => p.join('\n\n') + '\n');
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
  const check = process.argv.includes('--check');

  if (check) {
    if (!stale()) {
      console.log('OK — db/google-venues.sql matches the export beside it.');
      process.exit(0);
    }
    console.log('  FAIL  db/google-venues.sql is not what tools/googlevenues.mjs would write.');
    console.log('\nRun `node tools/googlevenues.mjs` and commit the result.');
    process.exit(1);
  }

  const result = build();
  writeFileSync(OUT, result.sql);

  console.log(
    `db/google-venues.sql — ${result.places.length} places, ` +
    `${result.matched.length} matched to the map.`
  );

  if (process.argv.includes('--parts')) {
    const dir = join(tmpdir(), 'google-venues');
    mkdirSync(dir, { recursive: true });
    const pieces = parts(result.statements);
    pieces.forEach((piece, i) => {
      writeFileSync(join(dir, `part-${String(i + 1).padStart(2, '0')}.txt`), piece);
    });
    console.log(`\n${pieces.length} pieces to paste into the D1 console, in order, in ${dir}`);
  } else {
    console.log('\nPaste it into the D1 console, preview first; --parts cuts it to size.');
  }
}
