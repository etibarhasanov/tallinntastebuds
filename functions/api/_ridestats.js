/**
 * Tallinn Tastebuds — a member's riding in numbers: each ride's, and all of
 * them added up.
 *
 * ./rides.js keeps a signed-in member's ride as its line, less ENDS metres
 * at each end and less anything outside the four cities, because the line
 * is evidence about streets. What a rider wants to know about their own
 * riding is something else — how far, how long, how fast, how long standing
 * — and the line cannot say it once its ends are off and a ride to Keila
 * has lost everything past Laagri. Rattatee has the whole ride, and works
 * all of it out for its save card and its ride page already. So since
 * 2026-11-22 a save may carry that `summary`, and a signed-in save keeps it
 * here as a row of `ride_stats` and adds it into the account's one row of
 * `ride_totals`, which the account page and the app's Account tab show to
 * that account and to nobody else.
 *
 * ONLY AN ACCOUNT'S RIDES ADD UP
 *
 * A ride saved with no account keeps nothing, as it always has — A RIDE
 * WITHOUT AN ACCOUNT IS COUNTED, NOT KEPT in ./rides.js — and its summary,
 * which Rattatee sends with every save, is not read. The owner's words, on
 * the day: riders without an account need to sign in and start riding, and
 * their rides add up from then on. Nothing is carried over from before an
 * account.
 *
 * The rides kept before this file were added by hand on 2026-11-22, the
 * owner's ask: 37 rides of two accounts, each worked out of its kept line by
 * summaryFromRuns() below, as a save with no summary is, and the two
 * accounts' totals out of those — 39 rows, written once. Their numbers are
 * their lines', 400 metres short of each ride and nothing outside the
 * cities, which none of them had left.
 *
 * WHAT A RIDE'S NUMBERS ARE
 *
 * - `meters`, the whole ride as ridden, its ends and the parts outside the
 *   cities included, the walks and the train left out;
 * - `seconds`, the riding time — the active time Rattatee sends as the
 *   save's own `seconds` — and `total`, Start to Finish with the pauses out;
 * - `stopped`, how long was spent slower than walking a bike, which
 *   rideInsight() in ./_rides.js calls standing;
 * - `top`, the fastest half a minute, in km/h, and `fastest`, the seconds
 *   the quickest whole kilometre took, each null where there was none;
 * - `start` and `end`, where the ride was 200 metres of riding in from each
 *   end — not where it began and finished, which is somebody's door. The
 *   same ENDS the line is cut by, so the one promise covers both: where you
 *   start and stop is not kept.
 *
 * A save with no summary — the map app's, or a Rattatee from before — is
 * worked out here from what it did send: the kept runs' metres and the
 * save's seconds, and, where the runs carry a track, the top speed, the
 * fastest kilometre and the time standing that rideInsight() finds in it.
 * Those are the line's numbers rather than the ride's, ends off, and they
 * are the best there is.
 *
 * WHAT IS CHECKED, AND WHAT CANNOT BE
 *
 * The parts of a ride outside the cities never reach the server, so their
 * numbers are the phone's word. summaryOf() holds them to sense — a day at
 * most, no faster on average than FASTEST in ./rides.js, a top speed no
 * bike reaches past TOP_KMH, a kilometre no quicker than FASTEST allows,
 * and no shorter than the line the server did get — and a summary that
 * fails any of it is dropped, never the ride: a ride refused for its
 * summary would be a new final word an installed app has no sentence for.
 * The totals are shown to their own account alone, so a made-up summary
 * fools only the person who made it up.
 *
 * WHAT IT COSTS
 *
 * A signed-in save writes one `ride_stats` row — five rows to D1, the row,
 * its key's index and its three others, measured on the 37 written by hand
 * — and upserts one `ride_totals` row by its key, one row read and one or
 * two written: about seven a save, beside the hundred or more a save
 * already writes into ride_sections. The
 * totals are read by the key, one row, on the account page's ?mine=1 and
 * on Rattatee's ?totals=1, which it asks when its Account tab opens and not
 * more than once a minute. At a thousand saves and five thousand opens a
 * day that is six thousand rows read of five million and seven thousand
 * written of a hundred thousand. A drop reads under ten rows, each by a
 * key; deleting an account, one row a ride it saved since this file.
 *
 * WHEN THE TABLES ARE NOT THERE
 *
 * Both reach production by hand from db/schema.sql. Until then a save keeps
 * its ride exactly as before and keeps no numbers, the totals read as null,
 * a drop drops the ride, and deleting an account does not name the two
 * tables — statsReady(), which asks once per isolate, as postsReady() in
 * ./_posts.js does.
 */

import { rideInsight } from './_rides.js';

/* The longest a ride's numbers may say it lasted: a day, as a point's time
   is held to MAX_SECONDS in ./rides.js. */
const DAY = 86400;

/* The fastest half a minute a bike's numbers may claim, in km/h. A strong
   rider downhill on a road bike passes sixty; eighty on a bike is not
   happening in Estonia. */
const TOP_KMH = 80;

/* Every ride's numbers, as the row keeps them, in the order the INSERT
   binds them. */
const COLUMNS = 'id, user_id, created_at, meters, seconds, total, stopped, top, fastest, ' +
  'start_lat, start_lng, end_lat, end_lng';

/* A whole number in [low, high], or null. */
function whole(value, low, high) {
  const n = Number(value);
  return Number.isFinite(n) && n >= low && n <= high ? Math.round(n) : null;
}

/* [lat, lng] at five decimals, or null. */
function spot(value) {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lat = Number(value[0]);
  const lng = Number(value[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5];
}

/* The summary a save carried, held to sense — WHAT IS CHECKED — or null.
   `atLeast` is the metres of line the server kept of it, which the whole
   ride cannot be shorter than; `fastest` the average no bike rides at. */
export function summaryOf(raw, atLeast, fastest) {
  if (!raw || typeof raw !== 'object') return null;
  const seconds = whole(raw.seconds, 1, DAY);
  const total = whole(raw.total, 1, DAY);
  const meters = whole(raw.meters, 0, DAY * fastest / 3.6);
  if (seconds === null || total === null || meters === null) return null;
  if (seconds > total || meters < atLeast) return null;
  if (meters / 1000 / (seconds / 3600) > fastest) return null;
  const stopped = whole(raw.stopped ?? 0, 0, total);
  if (stopped === null) return null;

  /* The two that a ride may not have, null where it has none and dropped
     with the summary where they are not sense. */
  let top = null;
  if (raw.top !== undefined && raw.top !== null) {
    const n = Number(raw.top);
    if (!(Number.isFinite(n) && n > 0 && n <= TOP_KMH)) return null;
    top = Math.round(n * 10) / 10;
  }
  let quickest = null;
  if (raw.fastest !== undefined && raw.fastest !== null) {
    quickest = whole(raw.fastest, Math.ceil(3600 / fastest), DAY);
    if (quickest === null || meters < 1000) return null;
  }
  return { meters, seconds, total, stopped, top, fastest: quickest, start: spot(raw.start), end: spot(raw.end) };
}

/* The numbers of a save that sent none, out of its kept runs — each { line,
   track, meters } as ./rides.js makes them — and the seconds it said, held
   to the same sense as a summary: a top speed past TOP_KMH or a kilometre
   quicker than `fastest` allows is a fix that jumped, not a bike, and is
   left out. The first rides worked out this way, on 2026-11-22, had one at
   253 km/h. */
export function summaryFromRuns(runs, seconds, fastest) {
  const meters = runs.reduce((sum, run) => sum + run.meters, 0);
  /* `span` is how long the timed runs lasted by their clocks, first point
     to last: Start to Finish less the ends, and with the pauses in it,
     which rideInsight() counts as standing — so the time standing can be
     more than the riding time the save said, and never more than this. */
  let top = null, quickest = null, stopped = 0, span = 0;
  for (const run of runs) {
    if (!run.track) continue;
    span += Number(run.track[run.track.length - 1][0]) - Number(run.track[0][0]);
    const said = rideInsight(run.line, run.track, run.meters, Math.max(1, Math.round(seconds * run.meters / meters)));
    if (!said.timed) continue;
    if (said.top !== null && said.top <= TOP_KMH) top = Math.max(top ?? 0, said.top);
    if (said.fastest && said.fastest.seconds >= 3600 / fastest) quickest = Math.min(quickest ?? Infinity, said.fastest.seconds);
    stopped += said.stopped;
  }
  const first = runs[0].line;
  const last = runs[runs.length - 1].line;
  const total = Math.max(seconds, Math.round(span));
  return {
    meters, seconds, total, stopped: Math.min(stopped, total), top, fastest: quickest,
    start: first[0], end: last[last.length - 1]
  };
}

/* The two statements that keep a ride's numbers under `id` and add them to
   the account's totals, for a batch beside whatever else the save writes.
   The totals row is made by the first ride and only ever moved after: a
   count, a sum, and the best of each, where a null is no ride's best — and
   `since` starts again where every ride before was dropped. */
export function statsStatements(env, userId, id, at, s) {
  return [
    env.DB
      .prepare('INSERT INTO ride_stats (' + COLUMNS + ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, userId, at, s.meters, s.seconds, s.total, s.stopped, s.top, s.fastest,
        s.start ? s.start[0] : null, s.start ? s.start[1] : null,
        s.end ? s.end[0] : null, s.end ? s.end[1] : null),
    env.DB
      .prepare(
        'INSERT INTO ride_totals (user_id, rides, meters, seconds, stopped, top, fastest, longest, since, updated_at) ' +
        'VALUES (?1, 1, ?2, ?3, ?4, ?5, ?6, ?2, ?7, ?7) ' +
        'ON CONFLICT (user_id) DO UPDATE SET ' +
        'since = CASE WHEN rides > 0 THEN since ELSE excluded.since END, ' +
        'rides = rides + 1, meters = meters + excluded.meters, seconds = seconds + excluded.seconds, ' +
        'stopped = stopped + excluded.stopped, ' +
        'top = COALESCE(MAX(top, excluded.top), top, excluded.top), ' +
        'fastest = COALESCE(MIN(fastest, excluded.fastest), fastest, excluded.fastest), ' +
        'longest = MAX(longest, excluded.longest), updated_at = excluded.updated_at'
      )
      .bind(userId, s.meters, s.seconds, s.stopped, s.top, s.fastest, at)
  ];
}

/* An account's totals as ?mine=1 and ?totals=1 answer them, or null: no
   ride counted yet, every one of them dropped, or no table. A lookup by
   ride_totals' key, one row. */
export async function totalsOf(env, userId) {
  try {
    const row = await env.DB
      .prepare('SELECT rides, meters, seconds, stopped, top, fastest, longest, since FROM ride_totals WHERE user_id = ?')
      .bind(userId)
      .first();
    return row && row.rides > 0 ? row : null;
  } catch (e) {
    return null;
  }
}

/* The statements that take a dropped ride's numbers off its account's
   totals: the sums by what its row says, the row itself, and the three
   bests found again among the rides left, each the front of one of the
   three indexes on ride_stats — a row read apiece. A ride with no row
   here, one saved before this file or the second run of a ride cut at a
   gap, moves nothing but the bests, which come out as they were. */
export function dropStatements(env, userId, id, at) {
  return [
    env.DB
      .prepare(
        'UPDATE ride_totals SET rides = ride_totals.rides - 1, meters = ride_totals.meters - s.meters, ' +
        'seconds = ride_totals.seconds - s.seconds, stopped = ride_totals.stopped - s.stopped, updated_at = ?3 ' +
        'FROM (SELECT meters, seconds, stopped FROM ride_stats WHERE id = ?2 AND user_id = ?1) AS s ' +
        'WHERE ride_totals.user_id = ?1'
      )
      .bind(userId, id, at),
    env.DB.prepare('DELETE FROM ride_stats WHERE id = ? AND user_id = ?').bind(id, userId),
    env.DB
      .prepare(
        'UPDATE ride_totals SET ' +
        'top = (SELECT top FROM ride_stats WHERE user_id = ?1 AND top IS NOT NULL ORDER BY top DESC LIMIT 1), ' +
        'fastest = (SELECT fastest FROM ride_stats WHERE user_id = ?1 AND fastest IS NOT NULL ORDER BY fastest LIMIT 1), ' +
        'longest = COALESCE((SELECT meters FROM ride_stats WHERE user_id = ?1 ORDER BY meters DESC LIMIT 1), 0) ' +
        'WHERE user_id = ?1'
      )
      .bind(userId)
  ];
}

/* What deleting an account takes of this: every row, by user_id. */
export function forgetStatements(env, userId) {
  return [
    env.DB.prepare('DELETE FROM ride_stats WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM ride_totals WHERE user_id = ?').bind(userId)
  ];
}

/* Whether both tables are there, asked once per isolate and then known —
   WHEN THE TABLES ARE NOT THERE. */
let ready = false;
export async function statsReady(env) {
  if (ready) return true;
  try {
    await env.DB.prepare('SELECT 1 FROM ride_stats LIMIT 1').first();
    await env.DB.prepare('SELECT 1 FROM ride_totals LIMIT 1').first();
    ready = true;
  } catch (e) { /* Not yet: asked again next time. */ }
  return ready;
}
