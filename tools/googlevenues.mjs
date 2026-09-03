#!/usr/bin/env node
/**
 * Tallinn Tastebuds — the Google Places export, into D1.
 *
 * Reads exports/tallinn_restaurants.csv — 750 restaurants, 18 columns, the
 * cleaned form of the raw Google export; see exports/README.md — and writes
 * db/google-venues.sql, which is what actually loads them.
 *
 *   node tools/googlevenues.mjs           rewrite db/google-venues.sql
 *   node tools/googlevenues.mjs --check   report that it is stale, exit 1
 *
 * Then, against each database:
 *
 *   wrangler d1 execute tallinntastebuds         --remote --file=db/google-venues.sql
 *   wrangler d1 execute tallinntastebuds-preview --remote --file=db/google-venues.sql
 *
 * Zero dependencies, like every other tool in here, and it borrows the CSV
 * reader from tools/places.mjs rather than carrying a second one.
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
 * The file opens by marking every row as missing and each upsert clears the
 * mark, so whatever is still marked at the end is genuinely not in this
 * export any more. Nothing is ever deleted: a list may be pointing at it, and
 * somebody wrote a sentence about it.
 *
 * A half-applied file therefore leaves some rows wrongly marked missing. That
 * is advisory rather than destructive — nothing reads missing_since to decide
 * whether a place exists — and the next complete run clears it.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { parseCsv, fold } from './places.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CSV = join(ROOT, 'exports', 'tallinn_restaurants.csv');
const OUT = join(ROOT, 'db', 'google-venues.sql');
const MAP = join(ROOT, 'data', 'restaurants.json');

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
     write NULLs over 750 rows of real data. */
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
    /* Google's key is unique in this export — all 750 of them — and the table
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

/* The 32 places that are on my map as well as in the export.
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
   apostrophe was the only thing that said otherwise. Safe to be this loose
   only because the caller has already required the two pins to be within
   sixty metres of each other. */
function namesAgree(a, b) {
  const bare = (s) => fold(s).replace(/[^a-z0-9]/g, '');
  const x = bare(a);
  const y = bare(b);
  if (!x || !y) return false;
  return x.includes(y) || y.includes(x);
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

  const out = [];
  out.push('-- Tallinn Tastebuds — the Google Places export, as SQL.');
  out.push('--');
  out.push('-- GENERATED by tools/googlevenues.mjs from exports/tallinn_restaurants.csv.');
  out.push('-- Do not edit: the next run overwrites it. Re-runnable, and safe to run');
  out.push('-- against a database that already holds an older copy of the export.');
  out.push('--');
  out.push('--   wrangler d1 execute tallinntastebuds         --remote --file=db/google-venues.sql');
  out.push('--   wrangler d1 execute tallinntastebuds-preview --remote --file=db/google-venues.sql');
  out.push('--');
  out.push('-- db/schema.sql has to have been applied first — it is what creates the');
  out.push('-- table these rows go into.');
  out.push(`-- ${places.length} places, ${matched.length} of them also on the map.`);
  out.push('');
  out.push('-- Everything is marked missing, and every upsert below clears the mark.');
  out.push('-- Whatever is still marked when this file finishes is genuinely no longer');
  out.push('-- in the export. Nothing is deleted: a list may be pointing at it.');
  out.push(`UPDATE google_venues SET missing_since = ${NOW} WHERE missing_since IS NULL;`);
  out.push('');

  /* Rows per INSERT. `wrangler d1 execute --remote` sends one HTTP request per
     statement, so a row-at-a-time file is 750 round trips to Cloudflare and
     several minutes of watching a progress bar; batched, it is fifteen and a
     few seconds. Fifty keeps each statement around 17KB, which is comfortably
     inside every limit involved and still small enough to read one of if
     something ever goes wrong. */
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
      `-- ${i + 1}-${i + chunk.length} of ${places.length}\n` +
      `INSERT INTO google_venues (${cols.join(', ')}, first_seen_at, synced_at)\nVALUES\n` +
      rows.join(',\n') + '\n' +
      `ON CONFLICT(place_id) DO UPDATE SET\n${setters},\n` +
      `    synced_at = ${NOW},\n` +
      `    missing_since = NULL;`
    );
  }

  out.push('');
  out.push('-- The places that are also on my map, so a list row pointing at one can');
  out.push('-- link through to its write-up. Only ever set when it is empty, so a');
  out.push('-- correction made by hand survives every future run of this file.');
  for (const m of matched) {
    /* The name goes on the line above rather than after the semicolon: some
       SQL runners split a file on ";" and would carry a trailing comment into
       the next statement. Harmless to SQLite, but not worth relying on. */
    out.push(
      `-- ${m.name}\n` +
      `UPDATE google_venues SET map_id = ${q(m.map_id)} ` +
      `WHERE place_id = ${q(m.place_id)} AND map_id IS NULL;`
    );
  }
  out.push('');

  return { sql: out.join('\n'), places: places, matched: matched };
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
  console.log('\nApply it with:');
  console.log('  wrangler d1 execute tallinntastebuds         --remote --file=db/google-venues.sql');
  console.log('  wrangler d1 execute tallinntastebuds-preview --remote --file=db/google-venues.sql');
}
