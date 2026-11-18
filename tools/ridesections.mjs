#!/usr/bin/env node
/**
 * Tallinn Tastebuds — `ride_sections` rebuilt from the rides themselves.
 *
 * `ride_sections` is what the recorded rides say about each square of the
 * city — functions/api/_sections.js — and it holds nothing the `rides`
 * table does not. A save adds its own ride to it. This writes the whole of
 * it again from every ride there is, which is what it takes when:
 *
 *   - the table was applied after rides had been saved, so they are not in
 *     it — the first eleven were;
 *   - a save's nudge was lost, or a ride was taken down;
 *   - the size of a square, or what is counted in one, changed.
 *
 * It cannot read D1 and does not try: it turns one file into another, and
 * the two ends are a terminal's. Three lines, the rides out, the SQL made,
 * the SQL in:
 *
 *   wrangler d1 execute tallinntastebuds --remote --json \
 *     --command "SELECT id, line, track FROM rides" > rides.json
 *   node tools/ridesections.mjs rides.json > ride-sections.sql
 *   wrangler d1 execute tallinntastebuds --remote --file=ride-sections.sql
 *
 * Neither file belongs in the repository: one is people's rides and the
 * other is a moment of them. The SQL empties the table and fills it, a
 * few hundred rows a statement, so it is a load for a terminal and not for
 * a session — it is past the hundred rows .claude/hooks/d1-write-gate.mjs
 * lets one through at, on purpose.
 *
 * The counting is sectionsOf(), imported from the Function rather than
 * written again, so the rebuild and the nudge cannot come to disagree.
 */

import { readFileSync } from 'node:fs';
import { sectionsOf } from '../functions/api/_sections.js';

/* Rows to an INSERT. SQLite takes thousands; this keeps a statement short
   enough to read when one of them is refused. */
const BATCH = 400;

const path = process.argv[2];
if (!path) {
  console.error('usage: node tools/ridesections.mjs rides.json > ride-sections.sql');
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

/* cell -> [rides, meters, timed, paced, seconds, slow, stops] */
const cells = new Map();
for (const ride of rides) {
  const line = parsed(ride.line);
  if (!line) continue;
  for (const [cell, ...counts] of sectionsOf(line, parsed(ride.track))) {
    const sum = cells.get(cell) || [0, 0, 0, 0, 0, 0, 0];
    sum[0] += 1;
    counts.forEach((n, i) => { sum[i + 1] += n; });
    cells.set(cell, sum);
  }
}

const now = Date.now();
const rows = [...cells].sort().map(([cell, sum]) => `('${cell}', ${sum.join(', ')}, ${now})`);
const out = ['DELETE FROM ride_sections;'];
for (let i = 0; i < rows.length; i += BATCH) {
  out.push(
    'INSERT INTO ride_sections (cell, rides, meters, timed, paced, seconds, slow, stops, updated_at) VALUES\n' +
    rows.slice(i, i + BATCH).join(',\n') + ';'
  );
}
console.log(out.join('\n'));
console.error(`${rides.length} rides, ${cells.size} squares`);
