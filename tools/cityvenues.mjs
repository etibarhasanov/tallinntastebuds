#!/usr/bin/env node
/**
 * Tallinn Tastebuds — the Google Places export of the other cities, into D1.
 *
 * Tallinn's export goes into google_venues, and seventeen things on the site
 * read that table: the directory, the list picker, the chat, the map's card
 * for a Google place, the six lists, the refresh that spends the Google budget.
 * Tartu, Narva and Pärnu go into a table of their own, city_venues, that
 * nothing on the site reads at all. That is the whole of how they are kept out
 * of search: not a filter on seventeen queries, any one of which could be
 * written without it next month, but a table no query names.
 *
 *   node tools/cityvenues.mjs           rewrite db/city-venues.sql
 *   node tools/cityvenues.mjs --check   report that it is stale, exit 1
 *
 * Then, once the owner has said yes, into production from a terminal:
 *
 *   wrangler d1 execute tallinntastebuds --remote --file=db/city-venues.sql
 *
 * A city joins by getting a line in AREAS below and a cleaned export at the
 * path that line names — exports/<id>_restaurants.csv, the same eighteen
 * columns as Tallinn's, cleaned by the same exports/clean_restaurants_csv.py
 * and read by the same read() in tools/googlevenues.mjs. A city whose export
 * is not here yet is skipped rather than an error, so the list can name a
 * city before its sweep has been run. With no export here at all there is no
 * file either, and --check expects none.
 *
 * WHAT THE FILE DOES, AND WHAT IT LEAVES ALONE
 *
 * The same shape as db/google-venues.sql, for the same reasons — upserts on
 * Google's place_id, fifty rows a statement, no comments inside because the D1
 * console folds a paste onto one line — with three differences:
 *
 *   - every row carries `area`, the id of the city it was swept for. Google's
 *     own `city` column says Tähtvere or Ülejõe as often as Tartu, and a
 *     village just over the line says the village; `area` is the sweep's
 *     answer, and it is what a city's page would one day select on.
 *   - the missing mark is per city: a row of Tartu's not in Tartu's export is
 *     marked, and Pärnu's rows are not in that statement at all. A refresh of
 *     one city can never mark another missing.
 *   - `rank` is the place's position within its own city, by the same
 *     ranked() Tallinn is ranked by, so "first in Pärnu" and "first in
 *     Tallinn" are the same arithmetic on different towns.
 *
 * No map_id, hidden, note or refreshed_at: there is no map of Tartu for a row
 * to match, nothing to hide it from, and nothing that refreshes it. Those
 * columns come when something needs them, and the table says so.
 */

import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { read, ranked, q, num, NOW, GOOGLE_COLUMNS, NUMERIC } from './googlevenues.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'db', 'city-venues.sql');

/* The cities beyond Tallinn, in the order they were added. The id is what
   `area` holds and what the export is named after, so it is lowercase ASCII:
   Pärnu is `parnu`, the way its own domain writes it. The centre and radius
   are what the sweep in etibarhasanov/allRestaurants was asked for — kept
   here so the next refresh asks for the same circle, and so the question of
   where Tartu stops has one answer written down. Narva's circle crosses the
   river into Ivangorod, which is Russia; clean_restaurants_csv.py drops
   anything Google does not file under Estonia. */
export const AREAS = [
  { id: 'tartu', name: 'Tartu', center: '58.3780,26.7290', radiusKm: 5 },
  { id: 'narva', name: 'Narva', center: '59.3772,28.1903', radiusKm: 4 },
  { id: 'parnu', name: 'Pärnu', center: '58.3859,24.4971', radiusKm: 5 }
];

const ID = /^[a-z]+$/;

export function csvOf(area) {
  return join(ROOT, 'exports', `${area.id}_restaurants.csv`);
}

/* Every city whose export is here, read and checked. A place_id in two
   cities' exports would be two circles that overlap, and the table's key
   would let the later one silently take the row — so it stops instead. */
export function load() {
  const cities = [];
  const owner = new Map();
  for (const area of AREAS) {
    if (!ID.test(area.id)) throw new Error(`"${area.id}" is not a city id — lowercase letters only`);
    if (!existsSync(csvOf(area))) continue;
    const places = read(csvOf(area));
    for (const place of places) {
      if (owner.has(place.place_id)) {
        throw new Error(`${place.place_id} (${place.name}) is in both ${owner.get(place.place_id)} and ${area.id}`);
      }
      owner.set(place.place_id, area.id);
    }
    cities.push({ area: area, places: places });
  }
  return cities;
}

const BATCH = 50;

export function build() {
  const cities = load();
  if (!cities.length) return { sql: null, cities: cities };

  const cols = ['place_id', 'area', ...GOOGLE_COLUMNS, 'rank'];
  const setters = ['area', ...GOOGLE_COLUMNS, 'rank'].map((c) => `    ${c} = excluded.${c}`).join(',\n');
  const out = [];

  for (const { area, places } of cities) {
    const ranks = ranked(places);

    for (let i = 0; i < places.length; i += BATCH) {
      const rows = places.slice(i, i + BATCH).map((place) => {
        const values = cols.map((c) => {
          if (c === 'place_id') return q(place.place_id);
          if (c === 'area') return q(area.id);
          if (c === 'rank') {
            const at = ranks.get(place.place_id);
            return Number.isFinite(at) ? String(at) : 'NULL';
          }
          return NUMERIC.has(c) ? num(place[c]) : q(place[c]);
        });
        return `  (${values.join(', ')}, ${NOW}, ${NOW})`;
      });
      out.push(
        `INSERT INTO city_venues (${cols.join(', ')}, first_seen_at, synced_at)\nVALUES\n` +
        rows.join(',\n') + '\n' +
        `ON CONFLICT(place_id) DO UPDATE SET\n${setters},\n` +
        `    synced_at = ${NOW},\n` +
        '    missing_since = NULL;'
      );
    }

    out.push(
      `UPDATE city_venues SET missing_since = ${NOW}\n` +
      `WHERE area = ${q(area.id)} AND missing_since IS NULL AND place_id NOT IN (\n` +
      places.map((place) => '  ' + q(place.place_id)).join(',\n') + '\n);'
    );
  }

  return { sql: out.join('\n\n') + '\n', cities: cities };
}

export function stale() {
  try {
    const want = build().sql;
    const got = existsSync(OUT) ? readFileSync(OUT, 'utf8') : null;
    return want !== got;
  } catch (e) {
    return true;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    if (!stale()) {
      console.log('OK — db/city-venues.sql matches the exports beside it.');
      process.exit(0);
    }
    console.log('  FAIL  db/city-venues.sql is not what tools/cityvenues.mjs would write.');
    console.log('\nRun `node tools/cityvenues.mjs` and commit the result.');
    process.exit(1);
  }

  const result = build();
  for (const area of AREAS) {
    const city = result.cities.find((c) => c.area.id === area.id);
    console.log(city
      ? `  ${area.name.padEnd(6)} ${city.places.length} places`
      : `  ${area.name.padEnd(6)} no export yet — exports/${area.id}_restaurants.csv`);
  }
  if (result.sql === null) {
    if (existsSync(OUT)) rmSync(OUT);
    console.log('\nNo city has an export yet, so there is no db/city-venues.sql to write.');
  } else {
    writeFileSync(OUT, result.sql);
    console.log('\ndb/city-venues.sql written. Load it into production only with the owner\'s yes.');
  }
}
