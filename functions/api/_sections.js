/**
 * Tallinn Tastebuds — what the rides say about each piece of street.
 *
 * A ride is a line somebody cycled. This turns the lines into a value for
 * the ground under them: the city cut into squares a street wide, and for
 * each square how many rides crossed it, how far and how long they spent in
 * it, how many crossed it at walking pace and how many stood still in it.
 * It is the first half of valuing a street, the half that needs nobody to
 * say anything — a stretch people ride at twenty and a stretch they push
 * through at five are told apart by the clock alone. What people say about
 * a stretch, when there is somewhere to say it, is counted beside these
 * and not instead of them. **What the rides say about a street** in
 * docs/handbook.md.
 *
 * Nothing reads `ride_sections` yet, and nothing answers it to anybody. It
 * fills as rides are saved, so that the day a way is chosen by what riders
 * made of it there is something to choose by.
 *
 * A SQUARE, AND WHY NOT A STREET
 *
 * A square is CELL_LAT by CELL_LNG degrees, about twenty-eight metres a
 * side at Tallinn's latitude, and is named by its row and column:
 * `237748:49478`. Matching a ride to OpenStreetMap's streets would say
 * *this stretch of Pärnu mnt* where a square says *here*, and would tell a
 * cycle lane from the road beside it, which a square cannot. It also needs
 * a matching service asked on every save. The squares need arithmetic, and
 * because the table is rebuilt from `rides` whenever its shape changes —
 * tools/ridesections.mjs — starting with them gives nothing away: the day
 * streets are worth matching, the rides are all still there to be matched.
 *
 * WHAT IS COUNTED, FOR ONE RIDE THROUGH ONE SQUARE
 *
 * Each step of the line, from one point to the next, belongs to the square
 * its far end is in.
 *
 *   rides    one, however many times the ride crossed the square
 *   meters   the steps' lengths
 *   timed    one where the ride carried its times — `rides.track` — and
 *   paced    the metres of the steps that had a time, and
 *   seconds  what those steps took, by the clock
 *   slow     one where the ride's pace through the square, metres over
 *            seconds, was under WALKING: pushed, or ridden as if it were
 *   stops    the steps that took STOP seconds or more and went nowhere — a
 *            light, a crossing
 *
 * A step that took PAUSE seconds or more is somebody pausing the ride — the
 * clock in `track` runs through a pause — and is counted as distance and
 * not as time, a stop or a pace: a coffee is not a red light. A ride with
 * no track counts in `rides` and `meters` alone, which is why `timed` is
 * and `paced` are kept: the pace of a square is `paced` over `seconds`, and
 * `slow` is out of `timed`, not out of `rides`.
 *
 * NUDGED, AND REBUILT
 *
 * A save adds its ride's squares to the table in one statement, an upsert
 * over the rows it is handed as JSON. Every other count on the site is
 * recomputed rather than nudged, and this one is not, because recomputing
 * it is reading every ride there is; so the rebuild is a tool and a
 * terminal's job, and is what puts right a table a nudge was lost from. A
 * lost nudge costs one ride's weight in a few hundred squares, in a table
 * nothing reads to the metre.
 *
 * WHEN THE TABLE IS NOT THERE
 *
 * `ride_sections` is in db/schema.sql and loaded by hand. The save that
 * calls countSections() catches what it throws: the ride is kept either
 * way, and the rebuild counts it later.
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

/* A step this many seconds long that covered less than STILL metres is a
   stop; one PAUSE seconds long is the rider pausing the ride, not the
   street holding them up. */
const STOP = 20;
const STILL = 40;
const PAUSE = 120;

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

/* One ride's rows for `ride_sections`: [cell, meters, timed, paced,
   seconds, slow, stops] for every square its line crosses. `line` is [lat, lng]
   pairs and `track` the [t, acc] pairs beside it, or nothing. A step over
   GAP is skipped rather than counted, so a ride stored before lines were
   cut at one cannot put its straight line into the table. */
export function sectionsOf(line, track) {
  const timed = Array.isArray(track) && track.length === line.length;
  const cells = new Map();
  for (let i = 1; i < line.length; i++) {
    const d = metresBetween(line[i - 1], line[i]);
    if (d > GAP) continue;
    const key = cellOf(line[i]);
    const cell = cells.get(key) || { meters: 0, seconds: 0, paced: 0, stops: 0 };
    cell.meters += d;
    const dt = timed ? track[i][0] - track[i - 1][0] : -1;
    if (dt >= 0 && dt < PAUSE) {
      cell.seconds += dt;
      cell.paced += d;
      if (dt >= STOP && d < STILL) cell.stops += 1;
    }
    cells.set(key, cell);
  }
  return [...cells].map(([key, cell]) => [
    key,
    Math.round(cell.meters),
    timed ? 1 : 0,
    Math.round(cell.paced),
    cell.seconds,
    cell.seconds > 0 && cell.paced / cell.seconds * 3.6 < WALKING ? 1 : 0,
    cell.stops
  ]);
}

/* Add rows to the table — NUDGED, AND REBUILT. One statement whatever the
   ride's length: the rows go in as one JSON parameter and json_each() deals
   them out. `WHERE true` is what SQLite needs to tell an upsert's ON from a
   join's. Throws where the table is not applied; the caller decides what
   that costs. */
export async function countSections(env, rows) {
  if (!rows.length) return;
  await env.DB
    .prepare(
      'INSERT INTO ride_sections (cell, rides, meters, timed, paced, seconds, slow, stops, updated_at) ' +
      'SELECT value ->> 0, 1, value ->> 1, value ->> 2, value ->> 3, value ->> 4, value ->> 5, value ->> 6, ?2 ' +
      'FROM json_each(?1) WHERE true ' +
      'ON CONFLICT (cell) DO UPDATE SET ' +
      'rides = rides + 1, meters = meters + excluded.meters, timed = timed + excluded.timed, ' +
      'paced = paced + excluded.paced, seconds = seconds + excluded.seconds, slow = slow + excluded.slow, ' +
      'stops = stops + excluded.stops, updated_at = excluded.updated_at'
    )
    .bind(JSON.stringify(rows), Date.now())
    .run();
}
