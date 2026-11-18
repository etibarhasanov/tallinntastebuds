/**
 * Tallinn Tastebuds — what one ride says about itself, for its rider.
 *
 * ./rides.js keeps the rides and ./rides/[id].js answers one of them to the
 * person who rode it; this is the arithmetic the second does on the way out,
 * kept apart so neither route file is the other's import. Nothing here reads
 * the database or the request: a stored line, its stored track and the
 * seconds the page sent go in, and numbers come out.
 *
 * WHAT IS WORKED OUT, AND FROM WHAT
 *
 * The distance and the riding time are the ride's own columns, and the
 * average is the one divided by the other, so every ride has those three —
 * where there is a track, the average is the line over its moving time
 * instead, so it is the same speed the splits and the line are made of.
 * The rest — the fastest kilometre, the top speed, how long was spent
 * standing, the speed along the way and each kilometre's time — need to
 * know when each point was passed, which is `track`, and a ride saved
 * before 2026-11-17 or by a recorder that sent no times has none. Such a
 * ride answers `timed: false`, empty `splits` and `speed`, and nulls, and
 * the app says why rather than drawing a flat line.
 *
 * A track's times are by the clock from the ride's first point, so a pause
 * is a long gap between two points that are close together. Every leg
 * slower than STILL is counted as standing — a red light as much as a
 * pause — and left out of the moving time the speeds are worked from. The
 * time on a split is that moving time, which is what a rider means by how
 * long a kilometre took.
 *
 * The first and last ENDS metres of a ride are not stored (NOBODY'S NAME IS
 * ON A RIDE in ./rides.js), so the line is that much shorter than the ride
 * was, and `meters` is the line's. The splits are the line's kilometres.
 */

import { km } from './_lib.js';

/* Slower than this, in metres a second, a leg is standing rather than
   riding: 1 m/s is 3.6 km/h, slower than walking a bike. The recorder keeps
   a point every dozen metres, so a minute at a light is one leg of twelve
   metres and sixty seconds, well under it. */
const STILL = 1;

/* The shortest stretch a top speed is measured over. A single twelve-metre
   leg between two fixes is mostly the fixes' error; two hundred metres is
   long enough that it is the rider. */
const TOP_OVER = 200;

/* The speed line has a point for every this many metres — every half
   kilometre, or every quarter on a ride under SHORT_RIDE, so a three-
   kilometre ride is not a line of six points. */
const SPEED_STEP = 500;
const SPEED_STEP_SHORT = 250;
const SHORT_RIDE = 5000;

function leg(a, b) {
  return km({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] }) * 1000;
}

/* A JSON array out of a column, or [] for anything else. */
export function arrayOf(text) {
  try {
    const value = JSON.parse(text || '');
    return Array.isArray(value) ? value : [];
  } catch (e) {
    return [];
  }
}

const round1 = (n) => Math.round(n * 10) / 10;

/* Everything the ride page shows besides the line, from the line, its track
   — [[t, acc], …] pair for pair with the line, or [] — and the seconds. */
export function rideInsight(line, track, meters, seconds) {
  const average = seconds > 0 ? round1(meters / seconds * 3.6) : null;
  const none = { average, timed: false, top: null, stopped: null, fastest: null, splits: [], speed: [] };
  if (!Array.isArray(track) || track.length !== line.length || line.length < 2) return none;

  /* How far along and how long riding by each point. */
  const along = [0];
  const moving = [0];
  let stopped = 0;
  for (let i = 1; i < line.length; i++) {
    const d = leg(line[i - 1], line[i]);
    const dt = Math.max(0, Number(track[i][0]) - Number(track[i - 1][0]));
    const still = dt > 0 && d / dt < STILL;
    if (still) stopped += dt;
    along.push(along[i - 1] + d);
    moving.push(moving[i - 1] + (still ? 0 : dt));
  }
  const total = along[along.length - 1];
  if (!(total > 0) || !(moving[moving.length - 1] > 0)) return none;

  /* The moving time at a distance along the line, between the two points
     either side of it. */
  let k = 1;
  const timeAt = (m) => {
    while (k < along.length - 1 && along[k] < m) k++;
    const a = along[k - 1], b = along[k];
    const f = b > a ? (m - a) / (b - a) : 1;
    return moving[k - 1] + (moving[k] - moving[k - 1]) * Math.min(1, Math.max(0, f));
  };

  /* Each kilometre's time, the last one however long it is. */
  const splits = [];
  k = 1;
  let was = 0;
  for (let mark = 1000; was < total; mark += 1000) {
    const to = Math.min(mark, total);
    const t = timeAt(to);
    const prev = splits.length ? splits[splits.length - 1].end : 0;
    splits.push({ km: splits.length + 1, meters: Math.round(to - was), seconds: Math.round(t - prev), end: t });
    was = to;
  }
  const full = splits.filter((s) => s.meters >= 1000 && s.seconds > 0);
  const best = full.reduce((b, s) => (!b || s.seconds < b.seconds ? s : b), null);

  /* The speed along the way, a point a step. */
  const step = total < SHORT_RIDE ? SPEED_STEP_SHORT : SPEED_STEP;
  const speed = [];
  k = 1;
  let from = 0, fromT = 0;
  for (let mark = step; from < total; mark += step) {
    const to = Math.min(mark, total);
    const t = timeAt(to);
    /* A last stretch under half a step is too short to say a speed. */
    if (to - from >= step / 2 && t > fromT) speed.push({ at: Math.round(to), kmh: round1((to - from) / (t - fromT) * 3.6) });
    from = to;
    fromT = t;
  }

  /* The top speed over at least TOP_OVER metres: for every point, the first
     one far enough on, two hands walking the line together. */
  let top = 0;
  for (let i = 0, j = 0; i < along.length; i++) {
    if (j < i) j = i;
    while (j < along.length - 1 && along[j] - along[i] < TOP_OVER) j++;
    if (along[j] - along[i] < TOP_OVER) break;
    const dt = moving[j] - moving[i];
    if (dt > 0) top = Math.max(top, (along[j] - along[i]) / dt * 3.6);
  }

  return {
    /* The line's metres over the line's moving time, rather than the
       stored seconds, which are the whole ride's, ends and stops included —
       so it agrees with the splits under it. */
    average: round1(total / moving[moving.length - 1] * 3.6),
    timed: true,
    top: top > 0 ? round1(top) : null,
    stopped: Math.round(stopped),
    fastest: best ? { km: best.km, seconds: best.seconds } : null,
    splits: splits.map(({ km: n, meters: m, seconds: s }) => ({ km: n, meters: m, seconds: s })),
    speed
  };
}
