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
 * One thing reads it: /api/v1/route, which by bike weighs the ways its routers
 * offer by the squares under them and marks the one riders made the most of
 * — riddenShare() below, RIDDEN in ./route.js — and, since 2026-11-27, asks
 * its router for one more way through where people ride and the ways
 * offered do not — riddenPlace() at the foot of this file. Nothing answers
 * a square to anybody.
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
 * statement back rather than running it, so a save can put a ride's runs
 * in one batch and have the ride counted whole or not at all.
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
 *
 * BLOCKS
 *
 * The squares answer "how does this way ride", for the ways a router has
 * drawn. They cannot cheaply answer "where do people ride between here and
 * there": a band two kilometres long and half a kilometre wide is some
 * fifteen hundred squares, three thousand rows with the two ways a trip
 * goes, five times what a route may read. So the same rides are counted a
 * second time into `ride_blocks`, BLOCK squares by BLOCK — about 225 m a
 * side — each way across, in the same columns and by the same sectionsOf()
 * with blockAt() for where a step belongs: a ride is one in a block's
 * `rides` however many of its squares it crossed, and `steady` is the ride
 * having held its own pace over its steps in the block. The same band is
 * then a few dozen blocks.
 *
 * And a block says how its part of town rides. Everybody is slower in the
 * Old Town, so a square there held against the rider's whole ride looks
 * poor next to any square on a main road; held against its block it is
 * judged against the streets around it.
 *
 * A save counts the blocks after the squares, in a batch of their own that
 * never throws — countRuns() in ./rides.js — so a block table that is
 * missing or failing costs a ride its blocks and nothing else. Under
 * `pages dev` on 2026-11-27 a ride of two and a half kilometres from Herne
 * up Kentmanni to Balti jaam was 14 blocks and ways across them against 64
 * squares: the blocks add about a fifth to what a save reads and writes.
 * They were filled once from the squares already counted, by
 * db/ride-blocks.sql, which says how near a block made of squares is to
 * one made of rides, and tools/ridesections.mjs counts them again from the
 * kept rides with the squares.
 */

/* A square's height and width in degrees: 0.00025 of latitude is 27.8 m
   anywhere, and 0.0005 of longitude is 28.3 m at 59.44°. About a street and
   its pavements wide, so two parallel streets a block apart are never one
   square, and a phone's five to ten metres of error mostly stays inside. */
export const CELL_LAT = 0.00025;
export const CELL_LNG = 0.0005;

/* A block's side, in squares — BLOCKS. Eight is about 225 m: a few city
   blocks, wide enough that a band across town is a few dozen of them and
   narrow enough that one is a single part of town. db/ride-blocks.sql
   restates it. */
export const BLOCK = 8;

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

/* The block a point is in — BLOCKS below: its square's row and column,
   each divided by BLOCK and rounded down. */
export function blockAt(point) {
  return Math.floor(Math.round(point[0] / CELL_LAT) / BLOCK) + ':' + Math.floor(Math.round(point[1] / CELL_LNG) / BLOCK);
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
   straight line into the table. With blockAt as `place` the same ride is
   counted into blocks instead, for `ride_blocks` — BLOCKS below. */
export function sectionsOf(line, track, place = cellOf) {
  const timed = Array.isArray(track) && track.length === line.length;
  const steps = [];
  for (let i = 1; i < line.length; i++) {
    const d = metresBetween(line[i - 1], line[i]);
    if (d > GAP) continue;
    const dt = timed ? track[i][0] - track[i - 1][0] : -1;
    steps.push({
      key: place(line[i]) + ':' + Math.round(headingOf(line[i - 1], line[i])) % DIRS,
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
      /* A pause is a straight line nobody was seen riding, as a step over
         GAP is, so it counts nowhere: on a timed ride its kind is '' — two
         minutes or more between two points, or a clock that ran backwards.
         Until 2026-11-22 its metres went into the square it ended in. */
      if (timed && !step.kind) continue;
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

/* The statement that adds a ride's rows to one of the two tables — NUDGED —
   for `table`, keyed by `key`. One statement whatever the ride's length:
   the rows go in as one JSON parameter and json_each() deals them out.
   `WHERE true` is what SQLite needs to tell an upsert's ON from a join's.
   A row nobody has ridden goes in whatever the ride; one with no room for
   this ride — roomFor() — is left as it was, and costs no row written.
   What is left of a sum when a ride is counted in is all of it under FULL
   (?4), and FADE (?5) of it from there on. */
function upsert(table, key) {
  const faded = '(CASE WHEN ' + table + '.rides >= ?4 THEN ?5 ELSE 1 END)';
  return 'INSERT INTO ' + table + ' (' + key + ', rides, meters, timed, paced, seconds, steady, slow, stops, updated_at) ' +
    'SELECT value ->> 0, 1, value ->> 1, value ->> 2, value ->> 3, value ->> 4, value ->> 5, value ->> 6, ' +
    'value ->> 7, ?2 FROM json_each(?1) WHERE true ' +
    'ON CONFLICT (' + key + ') DO UPDATE SET ' +
    'rides = rides * ' + faded + ' + 1, ' +
    'meters = meters * ' + faded + ' + excluded.meters, ' +
    'timed = timed * ' + faded + ' + excluded.timed, ' +
    'paced = paced * ' + faded + ' + excluded.paced, ' +
    'seconds = seconds * ' + faded + ' + excluded.seconds, ' +
    'steady = steady * ' + faded + ' + excluded.steady, ' +
    'slow = slow * ' + faded + ' + excluded.slow, ' +
    'stops = stops * ' + faded + ' + excluded.stops, ' +
    'updated_at = excluded.updated_at ' +
    'WHERE ' + table + '.rides < ?3';
}

/* Where a ride is counted: into its squares, and into its blocks. */
const INTO = {
  squares: { sql: upsert('ride_sections', 'cell'), place: cellOf },
  blocks: { sql: upsert('ride_blocks', 'block'), place: blockAt }
};

/* The statement that adds the ride with this id, its `line` and `track`,
   to the squares or to the blocks — or null for a ride with no row there.
   It throws, when it is run, where the table is not applied or has no
   `steady` yet; the caller decides what that costs.

   What it reads is two rows for every row that is there and one for every
   row that is not, whether or not it then writes: 322 for a ride of four
   kilometres down a street already ridden, into the squares, under
   `wrangler dev` on 2026-11-20. A hundred rides an hour is 770,000 rows a
   day of the five million. The same ride's blocks are about a fifth of
   that — BLOCKS below. */
export function tally(env, line, track, id, into = 'squares') {
  const { sql, place } = INTO[into];
  const rows = sectionsOf(line, track, place);
  if (!rows.length) return null;
  return env.DB.prepare(sql).bind(JSON.stringify(rows), Date.now(), roomFor(id), FULL, FADE);
}

/* ------------------------------------------------------------ a way, weighed
 * How much of each of some ways people have ridden, that way, and how well
 * it rode: for every line handed in, { share, score }, both from 0 to 1.
 *
 * A way is walked STRIDE metres at a time and each stride asks its square
 * for the two compass points its heading lies between. A square counts as
 * ridden once MIN_RIDES rides crossed it that way: two, since 2026-11-27,
 * so one stray ride does not make a street ridden — on that day a street
 * one rider had used twice was marked Ridden over a parallel one ridden
 * seven times. `share` is the part of the way's length on ridden squares.
 *
 * `score` is that length again, each square weighed by two things. How sure
 * the riding is: TRUSTED rides or more is full weight, fewer a share of it,
 * so seven riders through a square count for more than one. And how well it
 * rode against its part of town — HELD AGAINST ITS BLOCK below. A way half
 * of which is ridden steadily, by plenty, scores about a half.
 *
 * HELD AGAINST ITS BLOCK
 *
 * Until 2026-11-27 a square's quality was its own share of timed rides that
 * held their pace, `steady` over `timed`, and everybody is slower in the Old
 * Town: every square there looked poorer than any on a main road, so a way
 * through the Old Town lost to a way round it however good its streets.
 * Now a square is held against its block — BLOCKS above — the same way:
 * a half where it rides as the streets around it do, more where riders keep
 * their pace better there, less where they keep it worse. A square no timed
 * ride crossed is UNTIMED, a half. Where a trip's blocks are more than
 * AREA_KEYS — a trip of many kilometres — or the block table is not there,
 * every square is held against nothing but itself, as it was before: the
 * ways of one trip are always weighed the same way as each other.
 *
 * WHAT A READ COSTS
 *
 * A lookup on the key for every square and direction asked about, and
 * never more than SCORE_ROWS of them: a longer trip is walked in longer
 * strides until its squares fit, so a way across the city is sampled where
 * a way round the corner is read whole. Then the blocks under the strides
 * kept, AREA_KEYS of them at most. D1 bills the rows a statement walks, and
 * how the keys are handed to it decides what that is.
 *
 * Until 2026-11-19 they went in as one JSON parameter, `cell IN (SELECT
 * value FROM json_each(?))`, and this comment said a lookup that finds
 * nothing reads nothing. It was billed two rows a square asked, found or
 * not — one for json_each's row and one for the list SQLite makes of an
 * IN — and a third for each found: measured on production that day, 860
 * rows for a ride from Herne to Narva maantee that asked 412 squares and
 * found 36, and 1,800 at the worst where 600 was written.
 *
 * So the keys go in as LOOKUP's VALUES, bound one by one, and the table is
 * joined to them. Rows written out in a statement are not rows read, and a
 * seek that finds nothing is not one either: the same twelve squares, one
 * of them there, read 25 rows the old way and 1 this way, and that ride
 * reads 36. D1 binds a hundred values a statement at the most, so a
 * statement asks ASKED keys, the last one filled up with NULLs, which match
 * nothing and read nothing, and the statements go as one batch. None
 * answers more than ASKED rows.
 *
 * A route reads the table twice at most — WHERE PEOPLE RIDE below, then
 * this — and the two together never ask more than 600 keys: BAND_KEYS and
 * PLACE_KEYS for the first, SCORE_ROWS and AREA_KEYS for this. 600 is the
 * worst there is, on the day every key asked about has been ridden that
 * way, and on any other day what has been: 5,000,000 rows a day is 8,300
 * routes at the very worst. It is asked for every bike route the site works
 * out with no heading — ./route.js lets the phone that asked keep the answer
 * an hour, and nobody else.
 */
const STRIDE = 14;
const MIN_RIDES = 2;
const TRUSTED = 5;
const UNTIMED = 0.5;
const SCORE_ROWS = 300;
const AREA_KEYS = 72;

/* Fifty keys a statement, written once for both tables, and how many that
   is read off the statement itself, so the two cannot disagree. */
const FIFTY =
  '(?), (?), (?), (?), (?), (?), (?), (?), (?), (?), ' +
  '(?), (?), (?), (?), (?), (?), (?), (?), (?), (?), ' +
  '(?), (?), (?), (?), (?), (?), (?), (?), (?), (?), ' +
  '(?), (?), (?), (?), (?), (?), (?), (?), (?), (?), ' +
  '(?), (?), (?), (?), (?), (?), (?), (?), (?), (?)';
const LOOKUP = 'SELECT s.cell AS key, s.rides, s.meters, s.timed, s.steady FROM (VALUES ' + FIFTY +
  ') v CROSS JOIN ride_sections s ON s.cell = v.column1';
const LOOKUP_BLOCKS = 'SELECT s.block AS key, s.rides, s.meters, s.timed, s.steady FROM (VALUES ' + FIFTY +
  ') v CROSS JOIN ride_blocks s ON s.block = v.column1';
const ASKED = FIFTY.split('(?)').length - 1;

/* The rows of these keys, out of the squares or the blocks, as a Map from
   key to row: one batch of ASKED keys a statement — WHAT A READ COSTS. */
async function lookUp(env, keys, blocks = false) {
  const all = [...keys];
  const asks = [];
  for (let i = 0; i < all.length; i += ASKED) {
    const some = all.slice(i, i + ASKED);
    asks.push(env.DB.prepare(blocks ? LOOKUP_BLOCKS : LOOKUP).bind(...some, ...Array(ASKED - some.length).fill(null)));
  }
  const answers = asks.length ? await env.DB.batch(asks) : [];
  return new Map(answers.flatMap((answer) => answer.results || []).map((row) => [row.key, row]));
}

/* The share of a row's timed rides that held their pace, or null for a row
   with none. */
const steadyOf = (row) => (row && row.timed > 0 ? row.steady / row.timed : null);

/* A line as strides: [cell, block, lower point, metres], the upper point
   being the next one round. Every `every`th stride is kept and stands for
   the ones between. */
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
      const at = [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * f, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * f];
      out.push([cellOf(at), blockAt(at), lower, d / parts]);
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
      for (const [cell, , lower] of strides) keys.add(cell + ':' + lower).add(cell + ':' + (lower + 1) % DIRS);
    }
    if (keys.size <= SCORE_ROWS) break;
  }
  const areas = new Set();
  for (const strides of ways) {
    for (const [, block, lower] of strides) areas.add(block + ':' + lower).add(block + ':' + (lower + 1) % DIRS);
  }
  /* The blocks are asked beside the squares and are worth nothing without
     them, so a block table that is missing costs the comparison and not
     the weighing — HELD AGAINST ITS BLOCK. */
  const [rows, blocks] = await Promise.all([
    lookUp(env, keys),
    areas.size <= AREA_KEYS ? lookUp(env, areas, true).catch(() => null) : null
  ]);
  return ways.map((strides) => {
    let all = 0;
    let ridden = 0;
    let score = 0;
    for (const [cell, block, lower, d] of strides) {
      all += d;
      const pair = (from, key) => [from.get(key + ':' + lower), from.get(key + ':' + (lower + 1) % DIRS)].filter(Boolean);
      const found = pair(rows, cell);
      const sum = (of, name) => of.reduce((n, row) => n + row[name], 0);
      if (sum(found, 'rides') < MIN_RIDES) continue;
      ridden += d;
      const own = steadyOf({ timed: sum(found, 'timed'), steady: sum(found, 'steady') });
      const area = blocks ? pair(blocks, block) : [];
      const around = steadyOf({ timed: sum(area, 'timed'), steady: sum(area, 'steady') });
      const quality = own === null ? UNTIMED
        : !blocks ? own
          : Math.min(1, Math.max(0, 0.5 + (own - (around === null ? own : around)) / 2));
      score += d * quality * Math.min(1, sum(found, 'rides') / TRUSTED);
    }
    return all ? { share: ridden / all, score: score / all } : { share: 0, score: 0 };
  });
}

/* ------------------------------------------------------- where people ride
 * Where, between two points, people ride a street the ways offered do not:
 * the middles of a square or two, in the order the trip passes them, for
 * ./route.js to ask its router for a way through, or none. The squares can weigh a way once a router has drawn it
 * and cannot draw one, so a street riders use that no router proposes was
 * never suggested however often it was ridden: on 2026-11-27, from Herne
 * to Balti jaam, all three ways went some 250 m east of Kentmanni, whose
 * squares heading north-west held five to seven rides each.
 *
 * So the blocks between the two points are read first, in a band BAND
 * blocks either side of the straight line between them and only in the two
 * compass points the trip's own heading lies between: a ride the other
 * way, home, never draws a way out. Of the blocks PLACE_RIDES rides or more
 * crossed, between the two ends, the ones the offered ways do not
 * themselves ride along that way for OFFERED metres are ranked by the
 * metres ridden in them, and the
 * squares of the first PLACES are read, in the way each was ridden. In
 * each block the square chosen has PLACE_RIDES rides or more, held its
 * riders' pace no worse than its block did, is MISSED metres from every
 * offered way — `near` says which points are not — and FAR metres from
 * both ends; the most ridden of those, then the one with most metres. One
 * point was tried first and was not enough: from Herne to Balti jaam
 * BRouter rode through a square of Kentmanni and left the street either
 * side of it, a way 48% ridden where the street riders use was 81%.
 *
 * What it reads: BAND_KEYS blocks at most, and PLACE_KEYS squares — two
 * blocks' sixty-four, one way each — billed only where somebody rode. A
 * trip whose band is past BAND_KEYS even on the line alone, eight
 * kilometres or so, is not looked at. It throws where a table is not there,
 * and its caller offers what it would have offered.
 */
const BAND = 1;
const BAND_KEYS = 100;
const PLACES = 2;
const PLACE_KEYS = PLACES * BLOCK * BLOCK;
const PLACE_RIDES = 3;
const OFFERED = 100;
const MISSED = 30;
const FAR = 150;

export async function riddenPlace(env, from, to, lines, near) {
  const lower = Math.floor(headingOf(from, to)) % DIRS;
  const ways = [lower, (lower + 1) % DIRS];
  /* The blocks the straight line crosses, sampled every half a block, and
     those BAND either side of each — or the line's alone, where the band is
     past BAND_KEYS. */
  const length = metresBetween(from, to);
  const steps = Math.max(1, Math.ceil(length / (BLOCK * 14)));
  const crossed = [];
  for (let k = 0; k <= steps; k++) {
    const at = [from[0] + (to[0] - from[0]) * k / steps, from[1] + (to[1] - from[1]) * k / steps];
    crossed.push(blockAt(at).split(':').map(Number));
  }
  let keys = null;
  for (const wide of [BAND, 0]) {
    const blocks = new Set();
    for (const [row, col] of crossed) {
      for (let r = -wide; r <= wide; r++) for (let c = -wide; c <= wide; c++) blocks.add((row + r) + ':' + (col + c));
    }
    if (blocks.size * ways.length <= BAND_KEYS) {
      keys = [...blocks].flatMap((block) => ways.map((way) => block + ':' + way));
      break;
    }
  }
  if (!keys) return [];
  const found = await lookUp(env, keys, true);

  /* The metres each block is ridden, that way, by the ways offered. */
  const offered = new Map();
  for (const line of lines) {
    for (const [, block, low, d] of stridesOf(line, 1)) {
      for (const way of [low, (low + 1) % DIRS]) {
        const key = block + ':' + way;
        offered.set(key, (offered.get(key) || 0) + d);
      }
    }
  }
  /* How far along the trip a point is, from nought at `from` to one at
     `to`, on the straight line between them — a degree of longitude is
     about half a degree of latitude's metres here, so its share of the dot
     product is a quarter. A point behind the start or past the end would
     have the way ride out and back, so neither a block nor a square there
     is one: on 2026-11-27 a square 150 m behind the start sent the way
     back down the street it started on, and it lost. */
  const reach = (to[0] - from[0]) ** 2 + (to[1] - from[1]) ** 2 * 0.26;
  const along = (p) => ((p[0] - from[0]) * (to[0] - from[0]) + (p[1] - from[1]) * (to[1] - from[1]) * 0.26) / reach;
  const between = (p) => along(p) > 0 && along(p) < 1;
  const middle = (key) => {
    const [row, col] = key.split(':').map(Number);
    return [(row + 0.5) * BLOCK * CELL_LAT, (col + 0.5) * BLOCK * CELL_LNG];
  };
  const ranked = [...found.values()]
    .filter((row) => row.rides >= PLACE_RIDES && (offered.get(row.key) || 0) < OFFERED && between(middle(row.key)))
    .sort((a, b) => b.meters - a.meters)
    .slice(0, PLACES);
  if (!ranked.length) return [];

  /* Each chosen block's squares, the way it was ridden, and the best of
     each block's: a point in each of the PLACES blocks, in the order the
     trip passes them, so the router is held to the street riders use and
     not only touched to it. Two that are within FAR of each other are one. */
  const squares = [];
  for (const block of ranked) {
    const [row, col, way] = block.key.split(':').map(Number);
    for (let r = 0; r < BLOCK; r++) {
      for (let c = 0; c < BLOCK; c++) squares.push({ key: (row * BLOCK + r) + ':' + (col * BLOCK + c) + ':' + way, block });
    }
  }
  const rows = await lookUp(env, squares.map((s) => s.key));
  const best = new Map();
  for (const { key, block } of squares) {
    const row = rows.get(key);
    if (!row || row.rides < PLACE_RIDES) continue;
    const own = steadyOf(row);
    const around = steadyOf(block);
    if (own !== null && around !== null && own < around) continue;
    const [r, c] = key.split(':').map(Number);
    const at = [Number((r * CELL_LAT).toFixed(6)), Number((c * CELL_LNG).toFixed(6))];
    if (metresBetween(at, from) < FAR || metresBetween(at, to) < FAR || near(at, MISSED)) continue;
    const was = best.get(block.key);
    if (!was || row.rides > was.row.rides || (row.rides === was.row.rides && row.meters > was.row.meters)) best.set(block.key, { at, row });
  }
  const points = [...best.values()].map((b) => b.at).filter(between).sort((a, b) => along(a) - along(b));
  return points.filter((p, i) => !i || metresBetween(p, points[i - 1]) >= FAR);
}
