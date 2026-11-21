#!/usr/bin/env node
/**
 * Tallinn Tastebuds — the doors: where a saved ride is shorter than the map.
 *
 * Reads the saved rides off the live site, measures them with the site's
 * own bike route run here, finds every stretch somebody cycled between two
 * points the router can only join the long way round, and writes
 * data/doors.json, and the rides it has looked at into
 * data/doors-checked.json. functions/api/route.js reads the first and sends
 * a bike route through a door where it is clearly shorter. **Doors** in
 * docs/handbook.md is the reasoning.
 *
 *   node tools/doors.mjs           look at the rides not looked at yet, and
 *                                  write both files
 *   node tools/doors.mjs --dry     the same, printing and writing nothing
 *   node tools/doors.mjs --all     look at every ride again
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
 * And it has to be the long way round in BOTH directions. The first run
 * over real rides found eleven doors and seven of them were one street: a
 * one-way ridden against the arrows, or along the pavement beside it, which
 * the router answers by going on to the next corner and coming back. That
 * is a way the map has, the other way round, and a door there would send a
 * stranger into the traffic. A real door is one the router cannot get
 * through from either side.
 *
 * And it has to leave the router's way. Two of the six the next run kept
 * lay along a street the router's own line ran down: the two ends had been
 * put on the pavements either side of it, and the router went to a corner
 * and back to change sides. A stretch with SHARE of its points within ON
 * metres of a way the router offers, there or back, is that way.
 *
 * A stretch that passes is then tightened, a point at a time from each end,
 * for as long as the saving holds: what is kept is the door itself and not
 * the hundred metres of ordinary street either side, which the router
 * already has and which would only make a door harder to reach. And both of
 * its ends have to lie within SNAP metres of where the router starts and
 * stops, or the way in and the way on would not meet it.
 *
 * A PATH THE ROUTER PUSHES A BIKE ALONG
 *
 * The router's way is measured by its time as well as its length. A park
 * path OpenStreetMap has as a footpath is a way the router knows and has a
 * bike pushed along, at walking pace: across Kalamaja kalmistupark it
 * answered the very line the owner rode, 266 m in 171 seconds, and so sent
 * every route round by Tööstuse instead. Somebody rode it, so it is a door.
 * A way therefore counts as the metres a ride covers in the time the
 * router gives it, at PACE, where that is more than its length — an
 * ordinary street comes out at its own length and a pushed path at more
 * than twice it — and a way it pushes is not one a stretch can be
 * dismissed for lying along.
 *
 * Two rides through one door are one door: ends within SAME metres of each
 * other, either way round, or most of the shorter line lying along the
 * longer, and the shorter line is kept.
 *
 * AND THE DOORS IT ALREADY HAD
 *
 * /api/rides answers the newest forty rides of a box, and a ride can be
 * deleted by its rider. A door found last month is no less a door for its
 * ride having gone, so the doors already in data/doors.json are kept and
 * the new ones joined to them, one door for two that are the same. A door
 * that should not be one is a line taken out of the file by hand, and it
 * stays out for as long as the ride that made it is not found again.
 *
 * And a ride is not all ridden. The owner rode to Ülemiste on 2026-11-17,
 * took the train two stops with the bike and rode on, and saved it as one
 * ride: its line runs straight from one station to the other, 3.2 km in one
 * segment across the rail yard, which the router can only go round. A ride
 * paused in one street and resumed in another is the same straight line.
 * The rides answer has no times to tell a train from a fast descent, but it
 * does not need them: a recorder writes a point every few metres, so two
 * points GAP apart were not joined by riding, and a ride is cut there and
 * each piece looked at on its own. Since 2026-11-18 a save is cut the same
 * way before it is stored — pieces() in functions/api/_sections.js, which
 * this borrows — so the cut here is for the rides saved before that.
 *
 * WHAT IT ASKS, AND HOW OFTEN
 *
 * The rides come from GET /api/rides?bbox=, the same public answer the
 * iPhone app reads: the lines with their first and last 200 m already off,
 * and nobody's name. That route answers its newest forty for a box, so the
 * city is asked for in TILES by TILES boxes rather than one: nine requests,
 * and all a run asks of the live site.
 *
 * Each stretch is measured by functions/api/route.js itself — answerRoute(),
 * imported and run here with no database — and not by asking /api/route.
 * Until 2026-11-21 it asked the live site, and every stretch was a whole
 * bike route there: the router, the doors, the streets kept off, and a
 * lookup in ride_sections to weigh the ways, which a stretch of 200 m has
 * no use for. Over the twenty-eight kept rides, a hundred kilometres, that
 * was about a thousand routes in forty-six minutes and 1,074 lookups on
 * production, and the owner saw them and it was stopped. Run here, a
 * stretch is measured by the same code through the same doors — this
 * checkout's data/doors.json — and reads nothing, since a route with no
 * database weighs nothing. The router is asked from this machine, a
 * stretch every PAUSE milliseconds and BUSY after it says it is busy: it is
 * free public infrastructure, with no edge cache in front of it here, which
 * is the other reason a ride is looked at once.
 *
 * A RIDE IS LOOKED AT ONCE
 *
 * The doors a ride opens are kept whether or not it is answered again — AND
 * THE DOORS IT ALREADY HAD — so looking at a ride twice finds nothing new,
 * and a run that looked at every ride cost more with every ride saved. So
 * the ids of the rides looked at are kept in data/doors-checked.json —
 * ids the rides answer already gives anybody — and a run looks at the
 * rest. A ride goes in only once every stretch of it was answered, so one
 * the router failed on is looked at again next time. --all looks at every
 * ride, for the day what makes a door changes.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pieces } from '../functions/api/_sections.js';
import { answerRoute } from '../functions/api/route.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'doors.json');
const CHECKED = join(ROOT, 'data', 'doors-checked.json');
const SITE = 'https://tallinntastebuds.ee';
const DRY = process.argv.includes('--dry');
const ALL = process.argv.includes('--all');

/* The city, a little inside nearTallinn()'s box in functions/api/_lib.js,
   and how many boxes a side it is asked for in. */
const CITY = { south: 59.35, west: 24.55, north: 59.52, east: 24.95 };
const TILES = 3;

const CHUNK = 200;
const GAIN = 100;
const RATIO = 1.5;
const SNAP = 20;
const SAME = 30;

/* What the router makes of a plain street by bike, in metres a second:
   twelve kilometres an hour once its corners are counted. A way slower
   than PUSHED of that is one it has a bike pushed along for most of. The
   same PACE is in functions/api/route.js, which measures a way the same
   way. */
const PACE = 3.3;
const PUSHED = 2 / 3;
const PAUSE = 1100;
const BUSY = 20000;

/* A stretch with this share of its points within ON metres of the router's
   own ways is the router's way, not a door. */
const ON = 10;
const SHARE = 0.8;

const rad = Math.PI / 180;
function metres(a, b) {
  const x = (b[1] - a[1]) * rad * Math.cos((a[0] + b[0]) / 2 * rad);
  const y = (b[0] - a[0]) * rad;
  return Math.sqrt(x * x + y * y) * 6371000;
}

/* How far a point is from a line, in flat metres around the point, which
   across one city is exact enough. */
function offLine(p, line) {
  const kx = Math.cos(p[0] * rad) * rad * 6371000;
  const ky = rad * 6371000;
  let least = Infinity;
  for (let i = 1; i < line.length; i++) {
    const ax = (line[i - 1][1] - p[1]) * kx;
    const ay = (line[i - 1][0] - p[0]) * ky;
    const dx = (line[i][1] - p[1]) * kx - ax;
    const dy = (line[i][0] - p[0]) * ky - ay;
    const len = dx * dx + dy * dy;
    const k = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
    least = Math.min(least, Math.hypot(ax + k * dx, ay + k * dy));
  }
  return least;
}

/* The share of a line's points that lie within ON metres of any of some
   other lines. */
function onLines(line, others) {
  return line.filter((p) => others.some((other) => offLine(p, other) <= ON)).length / line.length;
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
  return [...seen].filter(([, line]) => Array.isArray(line) && line.length >= 2).map(([id, line]) => ({ id, line }));
}

/* The site's own files out of this checkout, for the route run here: its
   doors are data/doors.json as it stands. */
const ASSETS = {
  fetch: async (request) => {
    try {
      return new Response(readFileSync(join(ROOT, new URL(request.url).pathname)));
    } catch (e) {
      return new Response('', { status: 404 });
    }
  }
};

/* The router's way between two points by bike: how short it can make it,
   counted as A PATH THE ROUTER PUSHES A BIKE ALONG says, how far its two
   ends are from the points asked about, and the lines of the ways it
   rides. Kept by the pair, since the tightening asks about the same ends
   more than once. A refusal that is an answer — no way there — is null;
   a router that stayed busy or broken through three tries is null too,
   and counted in `failed`, so the ride is looked at again next run. */
const asked = new Map();
let failed = 0;
async function routed(a, b) {
  const key = a.join(',') + ';' + b.join(',');
  if (asked.has(key)) return asked.get(key);
  const url = new URL(SITE + '/api/route?mode=bike&from=' + a[0].toFixed(4) + ',' + a[1].toFixed(4) +
    '&to=' + b[0] + ',' + b[1]);
  let found = null;
  let answered = false;
  let wait = PAUSE;
  for (let attempt = 0; attempt < 3 && !found && !answered; attempt++) {
    await sleep(wait);
    try {
      const res = await answerRoute({ request: new Request(url), env: { ASSETS } }, url.searchParams, false);
      if (!res.ok) {
        answered = res.status < 429;
        wait = res.status === 429 ? BUSY : PAUSE;
        continue;
      }
      const way = await res.json();
      const ways = [way].concat(way.others || []);
      found = {
        meters: Math.round(Math.min(...ways.map((w) => Math.max(w.meters, w.seconds * PACE)))),
        snap: Math.max(metres(a, way.line[0]), metres(b, way.line[way.line.length - 1])),
        lines: ways.filter((w) => w.meters >= w.seconds * PACE * PUSHED).map((w) => w.line)
      };
    } catch (e) { /* asked again */ }
  }
  if (!found && !answered) failed++;
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

  /* Whether the router needs GAIN metres and RATIO more than was ridden to
     get from one point of the ride to another, in that order. */
  const longWay = async (from, to) => {
    const way = await routed(line[from], line[to]);
    const rode = Math.abs(ridden(from, to));
    return Boolean(way) && way.meters - rode >= GAIN && way.meters >= rode * RATIO;
  };

  const found = [];
  for (const start of [0, CHUNK / 2]) {
    let i = 0;
    while (i < line.length - 1 && along[i] < start) i++;
    while (i < line.length - 1) {
      let j = i + 1;
      while (j < line.length - 1 && ridden(i, j) < CHUNK) j++;
      if (await longWay(i, j) && await longWay(j, i)) found.push([Math.min(i, j), Math.max(i, j)]);
      i = j;
    }
  }

  const doors = [];
  for (let [i, j] of found) {
    const whole = await saving(i, j);
    while (j - i > 2 && await saving(i + 1, j) >= whole * 0.9) i++;
    while (j - i > 2 && await saving(i, j - 1) >= whole * 0.9) j--;
    const way = await routed(line[i], line[j]);
    const back = await routed(line[j], line[i]);
    if (!way || !back || Math.max(way.snap, back.snap) > SNAP || !await longWay(j, i)) continue;
    const stretch = line.slice(i, j + 1);
    const ways = way.lines.concat(back.lines);
    if (onLines(stretch, ways) >= SHARE) continue;
    doors.push({ meters: Math.round(ridden(i, j)), around: Math.min(way.meters, back.meters), line: line.slice(i, j + 1) });
  }
  return doors;
}

/* A ride as the pieces that were ridden, a piece of one point dropped. */
function piecesOf(line) {
  return pieces(line).filter((piece) => piece.length >= 2);
}

let checked = [];
try { checked = JSON.parse(readFileSync(CHECKED, 'utf8')); } catch (e) { /* none looked at yet */ }
const looked = new Set(checked);
const all = await rides();
const todo = ALL ? all : all.filter((ride) => !looked.has(ride.id));
console.log(all.length + ' rides, ' + todo.length + ' to look at');

/* The doors the file already has first — AND THE DOORS IT ALREADY HAD —
   then each one found, joined to its twin where it has one. */
let doors = [];
try { doors = JSON.parse(readFileSync(OUT, 'utf8')); } catch (e) { /* no file yet */ }
const had = doors.length;

function keep(door) {
  const a = door.line[0];
  const b = door.line[door.line.length - 1];
  const twin = doors.findIndex((other) => {
    const c = other.line[0];
    const d = other.line[other.line.length - 1];
    const [short, long] = door.meters < other.meters ? [door, other] : [other, door];
    return (metres(a, c) <= SAME && metres(b, d) <= SAME) || (metres(a, d) <= SAME && metres(b, c) <= SAME) ||
      onLines(short.line, [long.line]) >= SHARE;
  });
  if (twin === -1) doors.push(door);
  else if (door.meters < doors[twin].meters) doors[twin] = door;
}

for (const ride of todo) {
  const before = failed;
  for (const line of piecesOf(ride.line)) {
    for (const door of await doorsIn(line)) keep(door);
  }
  if (failed === before) looked.add(ride.id);
  else console.log(ride.id + '  the router did not answer ' + (failed - before) + ' of its stretches; looked at again next run');
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
console.log(out.length + ' doors, ' + had + ' of them in the file already');

if (!DRY) {
  writeFileSync(OUT, '[\n' + out.map((door) => '  ' + JSON.stringify(door)).join(',\n') + (out.length ? '\n' : '') + ']\n');
  const ids = [...looked].sort();
  writeFileSync(CHECKED, '[\n' + ids.map((id) => '  ' + JSON.stringify(id)).join(',\n') + (ids.length ? '\n' : '') + ']\n');
  console.log('wrote data/doors.json and data/doors-checked.json');
}
