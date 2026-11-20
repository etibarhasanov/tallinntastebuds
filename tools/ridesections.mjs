#!/usr/bin/env node
/**
 * Tallinn Tastebuds — `ride_sections` made again from the rides that were
 * kept. A last resort.
 *
 * `ride_sections` is what the recorded rides say about each square of the
 * city — functions/api/_sections.js. Until 2026-11-20 it held nothing the
 * `rides` table did not, and this was how it was put right whenever what a
 * square counts changed: the table emptied and every ride counted again.
 *
 * It holds more than `rides` now. A ride saved without an account is
 * counted into it and kept nowhere — A RIDE WITHOUT AN ACCOUNT IS COUNTED,
 * NOT KEPT in functions/api/rides.js — so the SQL this writes, which
 * empties the table first, **throws away every one of those rides for
 * good**, and with Rattatee asking nobody to sign in that is most of them.
 * A change to the counting is no longer a reason to run it: the change
 * holds from the day it lands, and the squares counted the old way fade as
 * new rides come in. What is left is a table that is lost, or wrong past
 * mending, where the kept rides are better than nothing. It will not run
 * without being told it may lose the rest:
 *
 *   wrangler d1 execute tallinntastebuds --remote --json \
 *     --command "SELECT id, created_at, line, track FROM rides" > rides.json
 *   node tools/ridesections.mjs rides.json --lose-unkept > ride-sections.sql
 *   wrangler d1 execute tallinntastebuds --remote --file=ride-sections.sql
 *
 * It cannot read D1 and does not try: it turns one file into another, and
 * the two ends are a terminal's. Neither file belongs in the repository:
 * one is people's rides and the other is a moment of them. The SQL empties
 * the table and fills it, a few hundred rows a statement, so it is a load
 * for a terminal and not for a session — it is past the hundred rows
 * .claude/hooks/d1-write-gate.mjs lets one through at, on purpose.
 *
 * The counting is sectionsOf(), which rides a square still has room for is
 * roomFor(), and what a full square forgets with each is FULL and FADE,
 * all imported from the Function rather than written again, so what this
 * makes of a kept ride is what its save made of it. A square takes the
 * rides in the order they came, which is why `created_at` is asked for:
 * the rides are gone through oldest first, as the saves were.
 */

import { readFileSync } from 'node:fs';
import { sectionsOf, roomFor, FULL, FADE } from '../functions/api/_sections.js';

/* Rows to an INSERT. SQLite takes thousands; this keeps a statement short
   enough to read when one of them is refused. */
const BATCH = 400;

const path = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
if (!path || !process.argv.includes('--lose-unkept')) {
  console.error('usage: node tools/ridesections.mjs rides.json --lose-unkept > ride-sections.sql');
  console.error('The SQL empties ride_sections and fills it from the rides in the file. Every ride that was');
  console.error('counted without being kept — every ride saved with no account — is lost by loading it.');
  process.exit(1);
}

/* `wrangler d1 execute --json` answers [ { results: [ … ] } ]; a bare array
   of rows is taken too, for a file made some other way. */
const read = JSON.parse(readFileSync(path, 'utf8'));
const rides = Array.isArray(read) && read[0] && Array.isArray(read[0].results) ? read[0].results : read;

const parsed = (text) => {
  try {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value : null;
  } catch (e) {
    return null;
  }
};

/* cell -> [rides, meters, timed, paced, seconds, steady, slow, stops] */
const cells = new Map();
for (const ride of rides.sort((a, b) => (a.created_at || 0) - (b.created_at || 0))) {
  const line = parsed(ride.line);
  if (!line) continue;
  const room = roomFor(ride.id);
  for (const [cell, ...counts] of sectionsOf(line, parsed(ride.track))) {
    const sum = cells.get(cell) || [0, 0, 0, 0, 0, 0, 0, 0];
    if (sum[0] >= room) continue;
    /* What tally() does in SQL: a full square forgets a little, then the
       ride is added. */
    const left = sum[0] >= FULL ? FADE : 1;
    cells.set(cell, [1, ...counts].map((n, i) => sum[i] * left + n));
  }
}

const now = Date.now();
const rows = [...cells].sort().map(([cell, sum]) => `('${cell}', ${sum.join(', ')}, ${now})`);
const out = ['DELETE FROM ride_sections;'];
for (let i = 0; i < rows.length; i += BATCH) {
  out.push(
    'INSERT INTO ride_sections (cell, rides, meters, timed, paced, seconds, steady, slow, stops, updated_at) VALUES\n' +
    rows.slice(i, i + BATCH).join(',\n') + ';'
  );
}
console.log(out.join('\n'));
console.error(`${rides.length} kept rides, ${cells.size} squares and ways across them — and nothing of any ride that was not kept`);
