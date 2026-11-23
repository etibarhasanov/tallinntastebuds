#!/usr/bin/env node
/**
 * Tallinn Tastebuds — the doors: where a saved ride is shorter than the map.
 *
 * Reads the rides saved since it last ran off the live site, asks the bike
 * router about them, finds every stretch somebody cycled between two points
 * the router can only join the long way round, and writes data/doors.json. functions/api/route.js reads
 * that file and sends a bike route through a door where it is clearly
 * shorter. **Doors** in docs/handbook.md is the reasoning.
 *
 *   node tools/doors.mjs           look at the rides saved since the last
 *                                  run, and rewrite data/doors.json and
 *                                  data/doors-checked.json
 *   node tools/doors.mjs --dry     the same, printed, and nothing written
 *   node tools/doors.mjs --all     look at every ride again, as after a
 *                                  change to how a door is found
 *   node tools/doors.mjs --recheck hold the doors already in the file to
 *                                  the test again, keep those that pass,
 *                                  and look at no ride
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
 * the bike router. Where the router's way is longer than the ridden one
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
 * router gives it, at SPEED, where that is more than its length — an
 * ordinary street comes out at its own length and a pushed path at more
 * than twice it — and a way it pushes is not one a stretch can be
 * dismissed for lying along.
 *
 * A CORNER IS NOT A DOOR
 *
 * The time is the router's time on its streets and paths, stretch by
 * stretch, and not the time of the whole way, which has a few seconds more
 * for every corner turned and every light. Until 2026-11-23 it was the
 * whole way's, at twelve kilometres an hour, and on a stretch of two
 * hundred metres the corners were half of it: from Narva maantee round
 * into Weizenbergi the router rides 171 m in 56 seconds on its streets and
 * took 103 in all, which counted as 340 m against the 197 ridden — a door
 * along two streets it rides. A park path is as slow on its own as in all —
 * 138 m in 83 seconds of path and 89 in all — so the paths are doors still,
 * and they were 131 of the 240 the file had when the owner asked that day
 * why most doors were parks. --recheck kept 201; the 39 that went were
 * corners, or lay along a way the router rides once it is timed by its
 * streets.
 *
 * Two rides through one door are one door: ends within SAME metres of each
 * other, either way round, or most of the shorter line lying along the
 * longer, and the shorter line is kept.
 *
 * AND THE DOORS IT ALREADY HAD
 *
 * A run looks only at the rides saved since the last one, and a ride can be
 * deleted by its rider. A door found last month is no less a door for its
 * ride not being looked at again, so the doors already in data/doors.json are kept and
 * the new ones joined to them, one door for two that are the same. A door
 * that should not be one is a line taken out of the file by hand, and it
 * stays out for as long as the ride that made it is not found again. And
 * when the way a door is found changes, --recheck holds every door in the
 * file to the test again, the router asked both ways, and keeps only those
 * that pass; it reads no ride.
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
 * A RIDE IS LOOKED AT ONCE
 *
 * Until 2026-11-22 every run looked at every ride the site answered, the
 * ones the last run had looked at included: 37 rides, 136 km, some 1,400
 * questions and the best part of an hour, to find what a run a week before
 * had found already. Nothing came of the second look — a door is never
 * taken out by a run, so the most it could do was find a door again — and
 * so a ride is looked at once. data/doors-checked.json keeps where the last
 * run stopped — the moment the newest ride it looked at was saved, and that
 * ride's id for a tie — and a run asks GET /api/v1/rides?since= for the
 * rides saved after it, oldest first, a page at a time. The site answers
 * that off an index on when a ride was saved, so a run with nothing new
 * reads one row and a run with five new rides six. --all starts from
 * nothing again, which is for the day the way a door is found changes.
 *
 * WHAT IT ASKS, AND HOW OFTEN
 *
 * The rides come from GET /api/v1/rides?since=, the same public lines
 * ?bbox= gives anybody: their first and last 200 m already off, and
 * nobody's name. Until 2026-11-22 they came from ?bbox=, Tallinn in three
 * by three boxes, and so only the newest forty of a box and none of the
 * other three cities a ride can be saved in; asked by when, it is every
 * ride saved since, wherever it was ridden.
 *
 * The router is asked directly, a request every PAUSE milliseconds, and
 * not through the site's /api/v1/route, which it was until 2026-11-22. That
 * route is a bike route somebody would be given: through the doors already
 * in the file, off the streets in KEEP_OFF, with ways round either side, and
 * with a lookup in ride_sections — rows read for every one of the hundreds
 * of stretches a run asks about. A door is where the ridden line beats the
 * map, so the map is what it is held against: the router's own ways, its
 * alternatives among them, and nothing the site makes of them. It is free
 * public infrastructure, so it is asked with the site's name and slowly.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pieces } from '../functions/api/_sections.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'doors.json');
const CHECKED = join(ROOT, 'data', 'doors-checked.json');
const SITE = 'https://tallinntastebuds.ee';

/* The router functions/api/route.js asks by bike, and the name the site
   asks it under. */
const ROUTER = 'https://routing.openstreetmap.de/routed-bike/route/v1/bike/';
const AGENT = 'TallinnTastebuds/1.0 (+https://tallinntastebuds.ee)';

const CHUNK = 200;
const GAIN = 100;
const RATIO = 1.5;
const SNAP = 20;
const SAME = 30;

/* What the router rides a plain street at by bike, in metres a second:
   fifteen kilometres an hour, DOOR_SPEED in functions/api/route.js. A way
   is counted by the time the router gives its streets and paths, and not
   what it adds at a corner — A CORNER IS NOT A DOOR — and a way slower than
   PUSHED of this is one it has a bike pushed along for most of. */
const SPEED = 4.2;
const PUSHED = 2 / 3;
const PAUSE = 1100;

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

/* The rides saved after `from` — { at, id } — oldest first, every page of
   them. */
async function rides(from) {
  const found = [];
  let at = from;
  for (;;) {
    const res = await fetch(SITE + '/api/v1/rides?since=' + at.at + (at.id ? '&after=' + at.id : ''));
    if (!res.ok) throw new Error('/api/v1/rides?since= answered ' + res.status);
    const body = await res.json();
    if (!body.ready) throw new Error('/api/v1/rides?since= is not ready');
    for (const ride of body.rides) found.push(ride);
    if (!body.next) return found;
    at = body.next;
  }
}

/* The router's way between two points by bike: how short it can make it,
   counted as A PATH THE ROUTER PUSHES A BIKE ALONG says, how far its two
   ends are from the points asked about, and the lines of the ways it
   rides. Kept by the pair, since the tightening asks about the same ends
   more than once. */
const asked = new Map();
let calls = 0;
async function routed(a, b) {
  const key = a.join(',') + ';' + b.join(',');
  if (asked.has(key)) return asked.get(key);
  let found = null;
  for (let attempt = 0; attempt < 3 && !found; attempt++) {
    await sleep(PAUSE);
    calls++;
    try {
      const res = await fetch(ROUTER + a[1] + ',' + a[0] + ';' + b[1] + ',' + b[0] +
        '?overview=full&geometries=geojson&alternatives=true&annotations=duration', { headers: { 'User-Agent': AGENT } });
      if (!res.ok) continue;
      const body = await res.json();
      if (body.code === 'NoRoute') break;
      if (body.code !== 'Ok' || !Array.isArray(body.routes) || !body.routes.length) continue;
      const ways = body.routes.map((r) => ({
        meters: r.distance,
        seconds: r.legs.every((leg) => leg.annotation && Array.isArray(leg.annotation.duration))
          ? r.legs.reduce((sum, leg) => sum + leg.annotation.duration.reduce((x, y) => x + y, 0), 0)
          : r.duration,
        line: r.geometry.coordinates.map(([lng, lat]) => [lat, lng])
      }));
      const line = ways[0].line;
      found = {
        meters: Math.round(Math.min(...ways.map((w) => Math.max(w.meters, w.seconds * SPEED)))),
        snap: Math.max(metres(a, line[0]), metres(b, line[line.length - 1])),
        lines: ways.filter((w) => w.meters >= w.seconds * SPEED * PUSHED).map((w) => w.line)
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

/* The doors as the file has them: an id out of the line, sorted by it. */
function written() {
  return doors.map((door) => ({
    id: createHash('sha256').update(JSON.stringify(door.line)).digest('hex').slice(0, 8),
    meters: door.meters,
    around: door.around,
    line: door.line
  })).sort((a, b) => a.id.localeCompare(b.id));
}

/* Both files are written after every ride, the bookmark moved to it. The
   rides come oldest first, so a run that is stopped part-way — the first
   one, over every ride, ran past ninety minutes and was stopped having
   written nothing — leaves what it found and starts again after the last
   ride it finished. */
function save(at) {
  if (process.argv.includes('--dry')) return;
  const out = written();
  writeFileSync(OUT, '[\n' + out.map((door) => '  ' + JSON.stringify(door)).join(',\n') + (out.length ? '\n' : '') + ']\n');
  if (at) writeFileSync(CHECKED, JSON.stringify(at) + '\n');
}

/* --recheck — AND THE DOORS IT ALREADY HAD: each door put to the router
   both ways and kept where it is still the long way round in both, its
   ends still on the router's network and its line off the router's ways.
   One the router does not answer about is kept: no answer is not a way.
   The bookmark does not move, since no ride is looked at. */
if (process.argv.includes('--recheck')) {
  const kept = [];
  for (const door of doors) {
    const a = door.line[0];
    const b = door.line[door.line.length - 1];
    const way = await routed(a, b);
    const back = await routed(b, a);
    const long = (w) => w.meters - door.meters >= GAIN && w.meters >= door.meters * RATIO;
    if (!way || !back || (long(way) && long(back) && Math.max(way.snap, back.snap) <= SNAP &&
      onLines(door.line, way.lines.concat(back.lines)) < SHARE)) {
      kept.push(way && back ? Object.assign(door, { around: Math.min(way.meters, back.meters) }) : door);
    } else {
      console.log('not a door: ' + door.id + '  ' + door.meters + ' m ridden, ' +
        Math.min(way.meters, back.meters) + ' m by the router  ' + a.join(','));
    }
  }
  doors = kept;
  save(null);
  console.log(kept.length + ' of ' + had + ' doors kept; ' + calls + ' router calls' +
    (process.argv.includes('--dry') ? ', nothing written' : ''));
  process.exit(0);
}

/* Where the last run stopped — A RIDE IS LOOKED AT ONCE — and the rides
   saved since. */
let from = { at: 0, id: '' };
if (!process.argv.includes('--all')) {
  try { from = JSON.parse(readFileSync(CHECKED, 'utf8')); } catch (e) { /* no file yet: every ride */ }
}
const fresh = await rides(from);
const piecesOfRide = (ride) => Array.isArray(ride.line) ? piecesOf(ride.line) : [];
console.log(fresh.length + ' rides saved since ' + (from.at ? new Date(from.at).toISOString() : 'the start') +
  ': ' + fresh.reduce((n, ride) => n + piecesOfRide(ride).length, 0) + ' ridden pieces');


const began = Date.now();
for (const [n, ride] of fresh.entries()) {
  for (const piece of piecesOfRide(ride)) {
    for (const door of await doorsIn(piece)) keep(door);
  }
  save({ at: ride.at, id: ride.id });
  console.log('ride ' + (n + 1) + ' of ' + fresh.length + ': ' + calls + ' router calls, ' + doors.length + ' doors, ' +
    Math.round((Date.now() - began) / 60000) + ' min');
}

for (const door of written()) {
  console.log(door.id + '  ' + door.meters + ' m ridden, ' + door.around + ' m by the router  ' + door.line[0].join(','));
}
console.log(doors.length + ' doors, ' + had + ' of them in the file already; ' + calls + ' router calls in ' +
  Math.round((Date.now() - began) / 60000) + ' min' + (process.argv.includes('--dry') ? ', nothing written' : ''));
