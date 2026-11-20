/**
 * Tallinn Tastebuds — what the rides say about each piece of street.
 *
 * A ride is a line somebody cycled. This turns the lines into a value for
 * the ground under them: the city cut into squares a street wide, and for
 * each square, and each way across it, how many rides crossed it, how far
 * and how long they spent in it, how many held their own pace through it,
 * how many crossed it at walking pace and how many stood still in it. It
 * needs nobody to say anything — a stretch people ride at their pace and a
 * stretch they push through are told apart by the clock alone. **What the
 * rides say about a street** in docs/handbook.md.
 *
 * One thing reads it: /api/route, which by bike weighs the ways its routers
 * offer by the squares under them and puts the one riders made the most of
 * first — riddenShare() at the foot of this file, RIDDEN in ./route.js.
 * Nothing answers a square to anybody.
 *
 * A SQUARE, AND WHY NOT A STREET
 *
 * A square is CELL_LAT by CELL_LNG degrees, about twenty-eight metres a
 * side at Tallinn's latitude, and is named by its row and column:
 * `237748:49478`. Matching a ride to OpenStreetMap's streets would say
 * *this stretch of Pärnu mnt* where a square says *here*, and would tell a
 * cycle lane from the road beside it, which a square cannot. It also needs
 * a matching service asked on every save. The squares need arithmetic.
 * What starting with them gives away, since 2026-11-20, is the rides that
 * were counted without being kept — COUNTED, NOT KEPT below: the day
 * streets are worth matching, only the kept rides are there to be matched.
 *
 * AND WHICH WAY ACROSS IT
 *
 * Up a street is not down it. On 2026-11-19 the owner rode home downhill,
 * asked the way back the next day and was offered the way they had come:
 * ridden, and not that way. So a row is a square and a direction, one of
 * DIRS compass points, written after the square: `237748:49478:3` is that
 * square crossed heading south-east. Each step of a ride is filed under the
 * point its own heading is nearest, and a way being weighed reads the two
 * points its heading lies between, so a ride counts for a way that sets off
 * within about a quarter turn of it and never for the way back.
 *
 * WHAT IS COUNTED, FOR ONE RIDE THROUGH ONE SQUARE ONE WAY
 *
 * Each step of the line, from one point to the next, belongs to the square
 * its far end is in and the direction it went.
 *
 *   rides    one, however many times the ride crossed the square that way
 *   meters   the steps' lengths
 *   timed    one where the ride carried its times — `rides.track` — and
 *   paced    the metres of the steps that were ridden by the clock, and
 *   seconds  what those steps took
 *   steady   one where the ride's pace here, `paced` over `seconds`, was
 *            at least STEADY of its own pace over that stretch of it
 *   slow     one where that pace was under WALKING: pushed, or ridden as
 *            if it were
 *   stops    the steps that took STOP seconds or more and went nowhere — a
 *            light, a crossing
 *
 * HELD AGAINST THE RIDER, NOT AGAINST A NUMBER
 *
 * A fast stretch is not a good one: an electric bike does thirty down a
 * road nobody would choose, and a city bike fifteen along the path beside
 * it. What says a stretch rides well is that people keep the pace they
 * keep everywhere else, so `steady` holds each ride against its own
 * average — its ridden metres over its ridden seconds, a stretch at a
 * time, as below — and the two bikes
 * above count the same. A hill shows by itself: riders fall under their
 * pace going up and hold it coming down, in two different rows.
 *
 * A WAIT IS NOT A PACE
 *
 * A step that took STOP seconds or more and covered under STILL metres is
 * a stop, and is counted in `stops` and in nothing else: its seconds are
 * not in the square's pace. Until 2026-11-19 they were, so thirty seconds
 * at a red light made a square somebody rode at twenty look pushed. A step
 * that took PAUSE seconds or more is somebody pausing the ride — the clock
 * in `track` runs through a pause — and is counted as distance alone: a
 * coffee is not a red light. A ride with no track counts in `rides` and
 * `meters` alone, which is why `timed` is kept: `steady` and `slow` are out
 * of `timed`, not out of `rides`.
 *
 * NOT EVERY RECORDING IS A RIDE, NOR ALL OF ONE
 *
 * The recorder is in a pocket, and it has been taken for a run and for a
 * walk: of the first twenty recordings one was named "running" and two
 * went at five kilometres an hour. And one recording can be both — twenty
 * minutes walked and then twenty ridden — where an average over the whole
 * describes neither half: the walk would count as a bike pushed and the
 * ride as held far above its pace. A street somebody jogged along says
 * nothing about cycling it, and a walker holds their own pace everywhere,
 * so counted they would make every pavement look steady.
 *
 * So a timed recording is cut into stretches before anything is counted.
 * Its pace is read a WINDOW of ridden seconds at a time, and wherever that
 * stays under AFOOT km/h for ON_FOOT seconds or more it was on foot there:
 * that part counts in no square, and what lies either side of it is a
 * stretch of its own. Less than ON_FOOT of it stays in — a bike pushed up
 * a bank or through a crowd is part of the ride, and is what `slow` is
 * for. Each stretch is then held to looking like a bike by itself: its
 * pace is BIKE km/h or more, and at least CRUISED of it went at CRUISE
 * km/h or more, which a runner at twelve never does and a slow cyclist
 * with one clear street does. And each is held against its own pace, not
 * the recording's. Speed is all there is to tell by, so a jogger and a
 * very slow cyclist are not always told apart, and the doubt is settled
 * against counting: a ride missed is one fewer, a run counted is wrong.
 * A recording with no times cannot be told either way, and counts as it
 * always did, in `rides` and `meters`.
 *
 * A SQUARE TAKES FIFTY RIDES, THEN ONE IN TEN, AND FORGETS
 *
 * D1 bills a row that is written, and a row updated is a row written. A
 * ride crosses some fifty squares a kilometre, so counted whole a ride of
 * five is 250 rows written every time it is saved, whether or not one of
 * them is new — under `wrangler dev` on 2026-11-19 a square updated was one
 * row written, a new one two, and one the upsert's WHERE left alone none.
 * The free plan has a hundred thousand a day for the whole account, which
 * is four hundred such rides and nothing else. And past a point a ride
 * says nothing new: fifty through a square put the share that held their
 * pace within fourteen points or so, and the five-hundredth moves it by
 * nothing a way is chosen by.
 *
 * So a square takes every ride until it has counted FULL of them, and one
 * ride in TENTH after that. A square nobody has ridden is written whatever
 * else is full, since a new street is the news worth paying for.
 *
 * For a day it also stopped: at MOST a square took no ride at all, so a
 * row was written a hundred times in its life and no more. That held only
 * while the table could be emptied and counted again from `rides`, and
 * since 2026-11-20 it cannot — COUNTED, NOT KEPT below. A square that
 * stops taking rides and can never be counted again keeps what its first
 * hundred said for ever: the street before its lane was painted, the week
 * it was dug up, fifty rides somebody made up. So from FULL on, a ride
 * that is counted first takes a MOST-th off everything the square holds
 * and then adds itself. What was there halves with every sixty-nine rides
 * counted, which is six hundred and ninety passed, and fifty made-up rides
 * are outweighed once forty-one honest ones have been counted after them.
 * `rides` climbs from FULL towards MOST and never reaches it, so MOST is
 * how many rides a square remembers and no longer where it stops; and the
 * sums past FULL are fractions, which SQLite keeps as they are in a column
 * declared INTEGER. The price is that the writing never ends: on a street
 * that is full, one save in TENTH writes a row for each of its squares,
 * where the stop would have brought that to none.
 *
 * Which rides are the one in ten is read off an id — roomFor() — and not
 * drawn again inside the statement. For a ride that is kept it is the
 * row's own id, so the rebuild gives it the answer its save did. For a
 * ride that is only counted the site draws one for the purpose: an id the
 * phone sent would be the phone choosing to be counted every time.
 *
 * What it changes: past FULL, `rides` is the weight of the rides counted
 * and not the rides that passed.
 *
 * COUNTED, NOT KEPT
 *
 * Until 2026-11-20 this table held nothing `rides` did not, and
 * tools/ridesections.mjs emptied it and filled it again whenever what a
 * square counts changed, as it did on 2026-11-19. Since then a ride saved
 * without an account is counted here and kept nowhere — A RIDE WITHOUT AN
 * ACCOUNT IS COUNTED, NOT KEPT in ./rides.js — so the table holds what no
 * other does, and emptying it loses that for good. A change to the
 * counting therefore holds from the day it lands: the squares counted the
 * old way stay, and fade at the pace above as rides counted the new way
 * come in. The tool is still there for a table that is lost or wrong past
 * mending. It has to be told it may lose them, and it shrinks a square as
 * tally() does, with the same FULL and FADE.
 *
 * NUDGED
 *
 * A save adds its ride's squares to the table, those with room for it, in
 * one statement: an upsert over the rows it is handed as JSON. Every other
 * count on the site is recomputed rather than nudged, and this one cannot
 * be: recomputing it is reading every ride there is, and the rides that
 * were counted without being kept are not there to read. tally() hands the
 * statement back rather than running it, so a save can put it in one batch
 * with what has to happen, or not happen, together with it.
 *
 * WHEN THE TABLE IS NOT THERE, OR IS THE OLD ONE
 *
 * `ride_sections` is in db/schema.sql and loaded by hand, and `steady` was
 * added to it by hand after it. A statement from tally() throws where
 * either is missing. The save of a kept ride catches that and keeps the
 * ride; a ride that is only counted has nothing else to be, so its save
 * answers `not-ready` and the phone sends it again later. A read throws
 * the same way and its caller offers no ridden way. A row from before the
 * directions is keyed by its square alone, which no read asks for.
 */

/* A square's height and width in degrees: 0.00025 of latitude is 27.8 m
   anywhere, and 0.0005 of longitude is 28.3 m at 59.44°. About a street and
   its pavements wide, so two parallel streets a block apart are never one
   square, and a phone's five to ten metres of error mostly stays inside. */
export const CELL_LAT = 0.00025;
export const CELL_LNG = 0.0005;

/* Two points further apart than this were not ridden between: the ride was
   paused, or the page was hidden, and it went on somewhere else. The
   recorder keeps a point every dozen metres, so forty seconds at thirty
   kilometres an hour with a fix a few seconds apart, and a minute of GPS
   lost under a bridge, are both well under it: the longest honest step in
   the first eleven rides was 150 m, and the two that were not honest were
   1.3 km and 3.2 km, the second of them a train. tools/doors.mjs cuts the
   rides it reads by the same pieces(). */
export const GAP = 250;

/* Under this, in km/h, a bike is being pushed. */
const WALKING = 7;

/* What makes a stretch of a timed recording a bike ride — NOT EVERY
   RECORDING IS A RIDE, NOR ALL OF ONE: the pace, in km/h, under which a
   WINDOW of ridden seconds was on foot, and how many seconds of that it
   takes to be a walk rather than a bike pushed; then the stretch's own
   pace in km/h, and the share of its metres that went at CRUISE km/h or
   more. */
const WINDOW = 60;
const AFOOT = 11;
const ON_FOOT = 300;
const BIKE = 10;
const CRUISE = 15;
const CRUISED = 0.1;

/* The share of its own pace a ride has to keep through a square to have
   held it there — HELD AGAINST THE RIDER. Four fifths: a rider's pace
   wanders a tenth either way on a flat street with nothing in it. */
const STEADY = 0.8;

/* A step this many seconds long that covered less than STILL metres is a
   stop; one PAUSE seconds long is the rider pausing the ride, not the
   street holding them up. */
const STOP = 20;
const STILL = 40;
const PAUSE = 120;

/* How many compass points a way across a square is one of — AND WHICH WAY
   ACROSS IT. Eight, forty-five degrees each: a street's two directions are
   four apart, and a bend has to be a real one to change the point. */
const DIRS = 8;

/* How many rides a square counts whole, how many of the rides after those
   it takes one of, and how many it remembers — A SQUARE TAKES FIFTY RIDES,
   THEN ONE IN TEN, AND FORGETS. FADE is what is left of a full square's
   sums when a ride is counted into it. FULL and FADE are the rebuild's too. */
export const FULL = 50;
const TENTH = 10;
const MOST = 100;
export const FADE = 1 - 1 / MOST;

/* Metres between two [lat, lng] points. Flat-earth arithmetic, which over
   a step of a dozen metres is right to the centimetre. */
export function metresBetween(a, b) {
  const rad = Math.PI / 180;
  const x = (b[1] - a[1]) * rad * Math.cos((a[0] + b[0]) / 2 * rad);
  const y = (b[0] - a[0]) * rad;
  return Math.sqrt(x * x + y * y) * 6371000;
}

/* The square a point is in. */
export function cellOf(point) {
  return Math.round(point[0] / CELL_LAT) + ':' + Math.round(point[1] / CELL_LNG);
}

/* Where a step from `a` to `b` is heading, in compass points from north
   round by east: 0 to DIRS, not yet whole. */
function headingOf(a, b) {
  const east = (b[1] - a[1]) * Math.cos((a[0] + b[0]) / 2 * Math.PI / 180);
  return ((Math.atan2(east, b[0] - a[0]) / (2 * Math.PI) * DIRS) + DIRS) % DIRS;
}

/* A line cut wherever two points are more than GAP apart: the runs that
   were ridden, without the straight lines between them that were not. A
   line with no such step comes back as itself, alone. */
export function pieces(points) {
  const out = [];
  let from = 0;
  for (let i = 1; i < points.length; i++) {
    if (metresBetween(points[i - 1], points[i]) > GAP) {
      out.push(points.slice(from, i));
      from = i;
    }
  }
  out.push(points.slice(from));
  return out;
}

/* What a step of `d` metres in `dt` seconds was: 'ridden', a 'stop', or
   nothing the clock can say anything about — no time, or a pause. */
function stepKind(d, dt) {
  if (dt < 0 || dt >= PAUSE) return '';
  return dt >= STOP && d < STILL ? 'stop' : 'ridden';
}

/* A timed recording's steps as the stretches that were not walked: the
   steps either side of every run of ON_FOOT ridden seconds or more whose
   pace, a WINDOW at a time, stayed under AFOOT. A stop is neither ridden
   nor walked and stays with whatever it stands in. */
function stretchesOf(steps) {
  const moving = steps.map((step, i) => i).filter((i) => steps[i].kind === 'ridden');
  /* When each ridden step was half done, by a clock that only runs while
     riding, and whether the WINDOW round it was on foot. */
  let clock = 0;
  const at = moving.map((i) => (clock += steps[i].dt) - steps[i].dt / 2);
  const afoot = moving.map((i, k) => {
    let d = 0;
    let dt = 0;
    for (let j = k; j >= 0 && at[k] - at[j] <= WINDOW / 2; j--) { d += steps[moving[j]].d; dt += steps[moving[j]].dt; }
    for (let j = k + 1; j < moving.length && at[j] - at[k] <= WINDOW / 2; j++) { d += steps[moving[j]].d; dt += steps[moving[j]].dt; }
    return dt > 0 && d / dt * 3.6 < AFOOT;
  });
  const out = [];
  let from = 0;
  for (let k = 0; k < moving.length; k++) {
    if (!afoot[k]) continue;
    let end = k;
    let walked = 0;
    while (end < moving.length && afoot[end]) walked += steps[moving[end++]].dt;
    if (walked >= ON_FOOT) {
      out.push(steps.slice(from, moving[k]));
      from = moving[end - 1] + 1;
    }
    k = end - 1;
  }
  out.push(steps.slice(from));
  return out;
}

/* One ride's rows for `ride_sections`: [cell, meters, timed, paced,
   seconds, steady, slow, stops] for every square its line crosses, each way
   it crosses it, less whatever of it was not a bike's. `line` is [lat, lng]
   pairs and `track` the [t, acc] pairs beside it — or [t, acc, alt], which
   reads the same here — or nothing. A step over GAP is skipped rather than
   counted, so a ride stored before lines were cut at one cannot put its
   straight line into the table. */
export function sectionsOf(line, track) {
  const timed = Array.isArray(track) && track.length === line.length;
  const steps = [];
  for (let i = 1; i < line.length; i++) {
    const d = metresBetween(line[i - 1], line[i]);
    if (d > GAP) continue;
    const dt = timed ? track[i][0] - track[i - 1][0] : -1;
    steps.push({
      key: cellOf(line[i]) + ':' + Math.round(headingOf(line[i - 1], line[i])) % DIRS,
      d: d,
      dt: dt,
      kind: stepKind(d, dt)
    });
  }
  const cells = new Map();
  for (const stretch of timed ? stretchesOf(steps) : [steps]) {
    /* The stretch's own pace, metres a second over everything it rode by
       the clock, which each square's is then held against. */
    let rode = 0;
    let took = 0;
    let cruised = 0;
    for (const step of stretch) {
      if (step.kind !== 'ridden') continue;
      rode += step.d;
      took += step.dt;
      if (step.dt > 0 && step.d / step.dt * 3.6 >= CRUISE) cruised += step.d;
    }
    const own = took > 0 ? rode / took : 0;
    if (timed && (own * 3.6 < BIKE || cruised < rode * CRUISED)) continue;
    for (const step of stretch) {
      const cell = cells.get(step.key) || { meters: 0, seconds: 0, paced: 0, par: 0, stops: 0 };
      cell.meters += step.d;
      if (step.kind === 'stop') cell.stops += 1;
      if (step.kind === 'ridden') {
        cell.seconds += step.dt;
        cell.paced += step.d;
        /* What these metres would have taken at the stretch's own pace, so
           a square two stretches crossed is held against each of them. */
        cell.par += step.d / own;
      }
      cells.set(step.key, cell);
    }
  }
  return [...cells].map(([key, cell]) => [
    key,
    Math.round(cell.meters),
    timed ? 1 : 0,
    Math.round(cell.paced),
    cell.seconds,
    cell.seconds > 0 && cell.seconds * STEADY <= cell.par ? 1 : 0,
    cell.seconds > 0 && cell.paced / cell.seconds * 3.6 < WALKING ? 1 : 0,
    cell.stops
  ]);
}

/* How many rides a square has to be under to take the ride with this id:
   MOST, which no square reaches, for one ride in TENTH, and FULL for the
   rest. Read off the id rather than drawn here, so a ride that is kept is
   the same answer at its save and in the rebuild; an id that is not hex is
   not one of the tenth. */
export function roomFor(id) {
  const drawn = /^[0-9a-f]{8}/.test(String(id)) ? parseInt(String(id).slice(0, 8), 16) : 1;
  return drawn % TENTH === 0 ? MOST : FULL;
}

/* What is left of a sum when a ride is counted into its square: all of it
   under FULL (?4), and FADE (?5) of it from there on. */
const FADED = '(CASE WHEN ride_sections.rides >= ?4 THEN ?5 ELSE 1 END)';

/* The statement that adds the rows of the ride with this id to the table —
   NUDGED — or null for a ride with none. One statement whatever the ride's
   length: the rows go in as one JSON parameter and json_each() deals them
   out. `WHERE true` is what SQLite needs to tell an upsert's ON from a
   join's. A square nobody has ridden goes in whatever the ride; one with
   no room for this ride — roomFor() — is left as it was, and costs no row
   written. It throws, when it is run, where the table is not applied or
   has no `steady` yet; the caller decides what that costs.

   What it reads is two rows for every square that is there and one for
   every square that is not, whether or not it then writes: 322 for a ride
   of four kilometres down a street already ridden, under `wrangler dev` on
   2026-11-20. A hundred rides an hour is 770,000 rows a day of the five
   million. */
export function tally(env, rows, id) {
  if (!rows.length) return null;
  return env.DB
    .prepare(
      'INSERT INTO ride_sections (cell, rides, meters, timed, paced, seconds, steady, slow, stops, updated_at) ' +
      'SELECT value ->> 0, 1, value ->> 1, value ->> 2, value ->> 3, value ->> 4, value ->> 5, value ->> 6, ' +
      'value ->> 7, ?2 FROM json_each(?1) WHERE true ' +
      'ON CONFLICT (cell) DO UPDATE SET ' +
      'rides = rides * ' + FADED + ' + 1, ' +
      'meters = meters * ' + FADED + ' + excluded.meters, ' +
      'timed = timed * ' + FADED + ' + excluded.timed, ' +
      'paced = paced * ' + FADED + ' + excluded.paced, ' +
      'seconds = seconds * ' + FADED + ' + excluded.seconds, ' +
      'steady = steady * ' + FADED + ' + excluded.steady, ' +
      'slow = slow * ' + FADED + ' + excluded.slow, ' +
      'stops = stops * ' + FADED + ' + excluded.stops, ' +
      'updated_at = excluded.updated_at ' +
      'WHERE ride_sections.rides < ?3'
    )
    .bind(JSON.stringify(rows), Date.now(), roomFor(id), FULL, FADE);
}

/* ------------------------------------------------------------ a way, weighed
 * How much of each of some ways people have ridden, that way, and how well
 * it rode: for every line handed in, { share, score }, both from 0 to 1.
 *
 * A way is walked STRIDE metres at a time and each stride asks its square
 * for the two compass points its heading lies between. A square counts as
 * ridden once MIN_RIDES rides crossed it that way, and that is all the
 * number of rides decides: that everybody goes one way does not make it
 * the better one, only the surer one. `share` is the part of the way's
 * length on ridden squares. `score` is that length again with each square
 * weighed by how many of its timed rides held their own pace there —
 * `steady` over `timed`, or UNTIMED where no ride through it had a clock —
 * so a way half of which is ridden steadily scores a half, and one ridden
 * all the way at a crawl scores nothing.
 *
 * WHAT A READ COSTS
 *
 * A lookup on the key for every square and direction asked about, and
 * never more than SCORE_ROWS of them: a longer trip is walked in longer
 * strides until its squares fit, so a way across the city is sampled where
 * a way round the corner is read whole. D1 bills the rows a statement
 * walks, and how the squares are handed to it decides what that is.
 *
 * Until 2026-11-19 they went in as one JSON parameter, `cell IN (SELECT
 * value FROM json_each(?))`, and this comment said a lookup that finds
 * nothing reads nothing. It was billed two rows a square asked, found or
 * not — one for json_each's row and one for the list SQLite makes of an
 * IN — and a third for each found: measured on production that day, 860
 * rows for a ride from Herne to Narva maantee that asked 412 squares and
 * found 36, and 1,800 at the worst where 600 was written.
 *
 * So the squares go in as LOOKUP's VALUES, bound one by one, and the table
 * is joined to them. Rows written out in a statement are not rows read, and
 * a seek that finds nothing is not one either: the same twelve squares, one
 * of them there, read 25 rows the old way and 1 this way, and that ride
 * reads 36. D1 binds a hundred values a statement at the most, so a
 * statement asks ASKED squares, the last one filled up with NULLs, which
 * match nothing and read nothing, and the statements go as one batch. None
 * answers more than ASKED rows.
 *
 * SCORE_ROWS rows is then the worst there is, on the day every square
 * asked about has been ridden that way, and on any other day what has been:
 * 5,000,000 rows a day is 8,300 routes at the very worst. It is asked for
 * every bike route the site works out — ./route.js lets the phone that
 * asked keep the answer an hour, and nobody else.
 */
const STRIDE = 14;
const MIN_RIDES = 1;
const UNTIMED = 0.5;
const SCORE_ROWS = 600;

/* Fifty squares a statement, and how many that is read off the statement
   itself, so the two cannot disagree. */
const LOOKUP =
  'SELECT s.cell, s.rides, s.timed, s.steady FROM (VALUES ' +
  '(?), (?), (?), (?), (?), (?), (?), (?), (?), (?), ' +
  '(?), (?), (?), (?), (?), (?), (?), (?), (?), (?), ' +
  '(?), (?), (?), (?), (?), (?), (?), (?), (?), (?), ' +
  '(?), (?), (?), (?), (?), (?), (?), (?), (?), (?), ' +
  '(?), (?), (?), (?), (?), (?), (?), (?), (?), (?)' +
  ') v CROSS JOIN ride_sections s ON s.cell = v.column1';
const ASKED = LOOKUP.split('(?)').length - 1;

/* A line as strides: [cell, lower point, metres], the upper point being
   the next one round. Every `every`th stride is kept and stands for the
   ones between. */
function stridesOf(line, every) {
  const out = [];
  let n = 0;
  for (let i = 1; i < line.length; i++) {
    const d = metresBetween(line[i - 1], line[i]);
    if (!(d > 0)) continue;
    const lower = Math.floor(headingOf(line[i - 1], line[i])) % DIRS;
    const parts = Math.ceil(d / STRIDE);
    for (let k = 1; k <= parts; k++) {
      if (n++ % every) continue;
      const f = k / parts;
      out.push([
        cellOf([line[i - 1][0] + (line[i][0] - line[i - 1][0]) * f, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * f]),
        lower,
        d / parts
      ]);
    }
  }
  return out;
}

export async function riddenShare(env, lines) {
  let ways;
  let keys;
  for (let every = 1; ; every++) {
    ways = lines.map((line) => stridesOf(line, every));
    keys = new Set();
    for (const strides of ways) {
      for (const [cell, lower] of strides) keys.add(cell + ':' + lower).add(cell + ':' + (lower + 1) % DIRS);
    }
    if (keys.size <= SCORE_ROWS) break;
  }
  /* A lookup on the key, `cell`, for each of at most SCORE_ROWS values,
     ASKED a statement — WHAT A READ COSTS above. */
  const all = [...keys];
  const asks = [];
  for (let i = 0; i < all.length; i += ASKED) {
    const some = all.slice(i, i + ASKED);
    asks.push(env.DB.prepare(LOOKUP).bind(...some, ...Array(ASKED - some.length).fill(null)));
  }
  const answers = asks.length ? await env.DB.batch(asks) : [];
  const rows = new Map(answers.flatMap((answer) => answer.results || []).map((row) => [row.cell, row]));
  return ways.map((strides) => {
    let all = 0;
    let ridden = 0;
    let score = 0;
    for (const [cell, lower, d] of strides) {
      all += d;
      const found = [rows.get(cell + ':' + lower), rows.get(cell + ':' + (lower + 1) % DIRS)].filter(Boolean);
      const sum = (name) => found.reduce((n, row) => n + row[name], 0);
      if (sum('rides') < MIN_RIDES) continue;
      ridden += d;
      score += d * (sum('timed') ? sum('steady') / sum('timed') : UNTIMED);
    }
    return all ? { share: ridden / all, score: score / all } : { share: 0, score: 0 };
  });
}
