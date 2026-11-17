#!/usr/bin/env node
/**
 * Tallinn Tastebuds — the doors: where a saved ride is shorter than the map.
 *
 * Reads the saved rides and the bike router off the live site, finds every
 * stretch somebody cycled between two points the router can only join the
 * long way round, and writes data/doors.json. functions/api/route.js reads
 * that file and sends a bike route through a door where it is clearly
 * shorter. **Doors** in docs/handbook.md is the reasoning.
 *
 *   node tools/doors.mjs           find the doors and rewrite data/doors.json
 *   node tools/doors.mjs --dry     find them and print them, write nothing
 *
 * It is not one of the generators tools/generate.mjs runs, and the validator
 * does not hold the file to it: what it writes depends on the rides people
 * saved since it last ran and on a router that is not in this repository, so
 * there is nothing in the tree to regenerate it from. It is run when there
 * are new rides, and what it writes is committed.
 *
 * HOW A DOOR IS FOUND
 *
 * A ride is cut into stretches of CHUNK metres, twice, the second time
 * starting half a stretch along so a door that straddles a cut in one pass
 * sits inside a stretch of the other. Each stretch's two ends are put to
 * /api/route by bike. Where the router's way is longer than the ridden one
 * by GAIN metres and by RATIO, the rider went a way the router does not
 * know: a gap in a fence, a level crossing, a path nobody has drawn.
 *
 * How far the ridden line strays from the router's is NOT the test, and was
 * the first one tried: it flags a lap of a courtyard and the far end of an
 * out-and-back, which are ways the map has, and misses a crossing ridden
 * beside a road the router follows to a bridge and back.
 *
 * A stretch that passes is then tightened, a point at a time from each end,
 * for as long as the saving holds: what is kept is the door itself and not
 * the hundred metres of ordinary street either side, which the router
 * already has and which would only make a door harder to reach. And both of
 * its ends have to lie within SNAP metres of where the router starts and
 * stops, or the way in and the way on would not meet it.
 *
 * Two rides through one door are one door: ends within SAME metres of each
 * other, either way round, and the shorter line is kept.
 *
 * WHAT IT ASKS, AND HOW OFTEN
 *
 * The rides come from GET /api/rides?bbox=, the same public answer the
 * iPhone app reads: the lines with their first and last 200 m already off,
 * and nobody's name. That route answers its newest forty for a box, so the
 * city is asked for in TILES by TILES boxes rather than one. The router is
 * asked through /api/route, a request every PAUSE milliseconds — it is free
 * public infrastructure behind that route, and a day's cache in front of it
 * means running this twice costs the second run next to nothing.
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'doors.json');
const SITE = 'https://tallinntastebuds.ee';

/* The city, a little inside nearTallinn()'s box in functions/api/_lib.js,
   and how many boxes a side it is asked for in. */
const CITY = { south: 59.35, west: 24.55, north: 59.52, east: 24.95 };
const TILES = 3;

const CHUNK = 200;
const GAIN = 100;
const RATIO = 1.5;
const SNAP = 20;
const SAME = 30;
const PAUSE = 1100;

const rad = Math.PI / 180;
function metres(a, b) {
  const x = (b[1] - a[1]) * rad * Math.cos((a[0] + b[0]) / 2 * rad);
  const y = (b[0] - a[0]) * rad;
  return Math.sqrt(x * x + y * y) * 6371000;
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function rides() {
  const seen = new Map();
  const dLat = (CITY.north - CITY.south) / TILES;
  const dLng = (CITY.east - CITY.west) / TILES;
  for (let i = 0; i < TILES; i++) {
    for (let j = 0; j < TILES; j++) {
      const box = [CITY.south + i * dLat, CITY.west + j * dLng, CITY.south + (i + 1) * dLat, CITY.west + (j + 1) * dLng];
      const res = await fetch(SITE + '/api/rides?bbox=' + box.map((v) => v.toFixed(2)).join(','));
      if (!res.ok) throw new Error('/api/rides answered ' + res.status);
      for (const ride of (await res.json()).rides || []) seen.set(ride.id, ride.line);
    }
  }
  return [...seen.values()].filter((line) => Array.isArray(line) && line.length >= 2);
}

/* The router's way between two points by bike: its length and how far its
   two ends are from the points asked about. Kept by the pair, since the
   tightening asks about the same ends more than once. */
const asked = new Map();
async function routed(a, b) {
  const key = a.join(',') + ';' + b.join(',');
  if (asked.has(key)) return asked.get(key);
  let found = null;
  for (let attempt = 0; attempt < 3 && !found; attempt++) {
    await sleep(PAUSE);
    try {
      const res = await fetch(SITE + '/api/route?mode=bike&from=' + a[0].toFixed(4) + ',' + a[1].toFixed(4) +
        '&to=' + b[0] + ',' + b[1]);
      if (res.status === 404) break;
      if (!res.ok) continue;
      const way = await res.json();
      found = {
        meters: way.meters,
        snap: Math.max(metres(a, way.line[0]), metres(b, way.line[way.line.length - 1]))
      };
    } catch (e) { /* asked again */ }
  }
  asked.set(key, found);
  return found;
}

/* The doors in one ride: [first, last] index pairs, tightened. */
async function doorsIn(line) {
  const along = [0];
  for (let i = 1; i < line.length; i++) along.push(along[i - 1] + metres(line[i - 1], line[i]));
  const ridden = (i, j) => along[j] - along[i];
  const saving = async (i, j) => {
    const way = await routed(line[i], line[j]);
    return way ? way.meters - ridden(i, j) : 0;
  };

  const found = [];
  for (const start of [0, CHUNK / 2]) {
    let i = 0;
    while (i < line.length - 1 && along[i] < start) i++;
    while (i < line.length - 1) {
      let j = i + 1;
      while (j < line.length - 1 && ridden(i, j) < CHUNK) j++;
      const way = await routed(line[i], line[j]);
      if (way && way.meters - ridden(i, j) >= GAIN && way.meters >= ridden(i, j) * RATIO) found.push([i, j]);
      i = j;
    }
  }

  const doors = [];
  for (let [i, j] of found) {
    const whole = await saving(i, j);
    while (j - i > 2 && await saving(i + 1, j) >= whole * 0.9) i++;
    while (j - i > 2 && await saving(i, j - 1) >= whole * 0.9) j--;
    const way = await routed(line[i], line[j]);
    if (!way || way.snap > SNAP) continue;
    doors.push({ meters: Math.round(ridden(i, j)), around: way.meters, line: line.slice(i, j + 1) });
  }
  return doors;
}

const lines = await rides();
console.log(lines.length + ' rides');

const doors = [];
for (const line of lines) {
  for (const door of await doorsIn(line)) {
    const a = door.line[0];
    const b = door.line[door.line.length - 1];
    const twin = doors.findIndex((other) => {
      const c = other.line[0];
      const d = other.line[other.line.length - 1];
      return (metres(a, c) <= SAME && metres(b, d) <= SAME) || (metres(a, d) <= SAME && metres(b, c) <= SAME);
    });
    if (twin === -1) doors.push(door);
    else if (door.meters < doors[twin].meters) doors[twin] = door;
  }
}

const out = doors.map((door) => ({
  id: createHash('sha256').update(JSON.stringify(door.line)).digest('hex').slice(0, 8),
  meters: door.meters,
  around: door.around,
  line: door.line
})).sort((a, b) => a.id.localeCompare(b.id));

for (const door of out) {
  console.log(door.id + '  ' + door.meters + ' m ridden, ' + door.around + ' m by the router  ' + door.line[0].join(','));
}
console.log(out.length + ' doors');

if (!process.argv.includes('--dry')) {
  writeFileSync(OUT, '[\n' + out.map((door) => '  ' + JSON.stringify(door)).join(',\n') + (out.length ? '\n' : '') + ']\n');
  console.log('wrote data/doors.json');
}
