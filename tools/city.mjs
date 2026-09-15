#!/usr/bin/env node
/**
 * Tallinn Tastebuds — the ground under every list's sky.
 *
 * Each row on /lists draws its list as a shape on the city: the places on it
 * in the accent, over a paler drawing of the city itself. That paler drawing
 * used to be data/places.json — the seventy-five places on the map — and at
 * panel size seventy-five dots is not a city. It is seventy-five dots on
 * blank paper, which is exactly what it looked like.
 *
 * This is the same picture drawn from the export instead. Eleven hundred
 * eating places, at a radius wide enough for neighbours to touch, trace
 * where Tallinn is: the Old Town solid, Kalamaja and Kadriorg as arms off
 * it, the harbour and the parks as holes in it. And the bay draws itself,
 * because the bay is the part of the frame with no restaurants in it — so
 * the panel gets a coastline without this repository carrying one line of
 * coastline data.
 *
 *   exports/tallinn_restaurants.csv   the export. The same file
 *                                     tools/googlevenues.mjs and
 *                                     tools/googlelists.mjs read, and the
 *                                     one file you actually put there.
 *
 *   data/city.json                    GENERATED — by this file. Coordinates
 *                                     and nothing else, because a ground is
 *                                     a shape and needs no names.
 *
 *   node tools/city.mjs           rebuild data/city.json
 *   node tools/city.mjs --check   report that it is out of date, exit 1
 *
 * Zero dependencies, like every other tool in here: CI runs it with no
 * `npm install` in front of it. The CSV reader is imported from
 * tools/googlevenues.mjs rather than written a third time — it is the same
 * file being read, and a second parser is a second thing to get wrong.
 *
 * WHY NOT THE DATABASE
 *
 * google_venues holds these rows too, and /api/venues already answers with
 * them. Two reasons it is a static file instead. A browser on /lists fetches
 * this once, cached like any asset, and never waits on it — the rows draw
 * with their own dots and the ground arrives afterwards, which is the
 * arrangement cityDots() in assets/lists.js already had. And the ground is
 * the same for every visitor and changes only when the export does, so
 * asking a Function for it on every load would be twelve hundred rows read
 * to redraw a picture that has not moved since the last refresh.
 *
 * WHY FOUR DECIMALS
 *
 * About eleven metres. The tightest frame a panel ever draws is floored at
 * roughly a kilometre and a half across a hundred and twenty units, so a
 * unit is around twelve metres and the rounding is already finer than the
 * drawing. Past four decimals the file grows and nothing moves. Rounding
 * also collapses neighbours onto the same point, and those are dropped: at
 * ground radius they were drawing the same circle twice.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './googlevenues.mjs';

const CSV = 'exports/tallinn_restaurants.csv';
const OUT = 'data/city.json';

/* The municipality, which is the box tools/validate.mjs holds every
   coordinate in the repository to. A row outside it is a bad row rather than
   a far-flung one — a swapped lat/lng, or a branch in another town — and a
   single stray dot in the corner of every panel on the page is a smudge
   nobody can explain. */
const BBOX = { latMin: 59.32, latMax: 59.52, lngMin: 24.50, lngMax: 25.00 };

const PLACES = 4;

function cityDots(csvText) {
  const rows = parseCsv(csvText);
  if (!rows.length) return [];

  const head = rows[0].map((h) => h.trim().toLowerCase());
  const latAt = head.indexOf('latitude');
  const lngAt = head.indexOf('longitude');
  if (latAt === -1 || lngAt === -1) {
    throw new Error(`${CSV}: no latitude/longitude columns — the export changed shape`);
  }

  /* Sorted, and deduplicated on the rounded point. Sorted because the file is
     committed: an export that comes back in a different order should not
     redraw the whole diff when the picture is identical. */
  const seen = new Set();
  for (const row of rows.slice(1)) {
    const lat = Number.parseFloat(row[latAt]);
    const lng = Number.parseFloat(row[lngAt]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < BBOX.latMin || lat > BBOX.latMax) continue;
    if (lng < BBOX.lngMin || lng > BBOX.lngMax) continue;
    seen.add(`${lat.toFixed(PLACES)},${lng.toFixed(PLACES)}`);
  }

  return [...seen].sort().map((k) => k.split(',').map(Number));
}

/* One pair per line. It is a generated file nobody edits, and a line each
   makes a refresh's diff readable — which of these moved, rather than one
   line of forty thousand characters that always differs. */
function render(dots) {
  return `[\n${dots.map((d) => `[${d[0]},${d[1]}]`).join(',\n')}\n]\n`;
}

/* For tools/validate.mjs, the same shape every other generated file offers:
   true when what is committed is not what this would write. A CSV that has
   lost its coordinate columns counts as stale rather than throwing here, so
   the build fails with the line that says which tool to run. */
export function stale() {
  try {
    const want = render(cityDots(readFileSync(CSV, 'utf8')));
    const got = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    return want !== got;
  } catch (e) {
    return true;
  }
}

function main() {
  const check = process.argv.includes('--check');

  if (!existsSync(CSV)) {
    console.error(`${CSV} is missing — nothing to build ${OUT} from.`);
    process.exit(1);
  }

  const dots = cityDots(readFileSync(CSV, 'utf8'));
  const next = render(dots);
  const now = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';

  if (check) {
    if (now === next) {
      console.log(`${OUT} is up to date — ${dots.length} points.`);
      return;
    }
    console.error(`${OUT} is out of date. Run: node tools/city.mjs`);
    process.exit(1);
  }

  writeFileSync(OUT, next);
  const kb = (Buffer.byteLength(next) / 1024).toFixed(1);
  console.log(`${OUT} — ${dots.length} points, ${kb} KB.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
