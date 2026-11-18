/**
 * Tallinn Tastebuds — one recorded ride, to the person who rode it.
 *
 * GET /api/rides/<id>
 *
 *   { ready, user, ride: { id, name, meters, seconds, at, line, insight } }
 *
 *   The ride whole: what its rider called it, how far and how long, the day
 *   it was saved, its line as [lat, lng] pairs — the ends already off, as
 *   they were when it was stored — and `insight`, what ../_rides.js works out
 *   of it: `average`, `timed`, `top`, `stopped`, `fastest` ({ km, seconds }),
 *   `splits` ([{ km, meters, seconds }]) and `speed` ([{ at, kmh }]). The
 *   iPhone app's ride page draws it; the list it is opened from is GET
 *   /api/rides in ../rides.js.
 *
 *   Errors: 401 signed-out, 404 not-found, 503 not-ready.
 *
 * ONLY ITS RIDER
 *
 * A ride's line is everybody's under the Bike tab, with nobody's name on it
 * — NOBODY'S NAME IS ON A RIDE in ../rides.js. What this answers is the
 * other half: that this line is yours, what you called it, and when each
 * point was passed, which is worked into the speeds here and is nobody's
 * but its rider's. So the session is the only way to ask, and a ride that
 * is somebody else's is the same 404 as one that does not exist: the
 * answer must not tell a stranger that an id is a real ride. A ride saved
 * with no account is nobody's and so nobody's to open.
 *
 * Never cached: `json()` without a maxAge is `no-store`.
 */

import { json, sessionUser, wrongDatabase } from '../_lib.js';
import { arrayOf, rideInsight } from '../_rides.js';

export async function onRequestGet(context) {
  const { env, request, params } = context;
  if (!env.DB || await wrongDatabase(env)) return json({ error: 'not-ready' }, 503);
  const user = await sessionUser(request, env);
  if (!user) return json({ error: 'signed-out' }, 401);

  const id = String(params.id || '');
  if (!/^[0-9a-f]{12}$/.test(id)) return json({ error: 'not-found' }, 404);

  let row;
  try {
    row = await env.DB
      .prepare('SELECT id, name, meters, seconds, created_at AS at, line, track FROM rides WHERE id = ? AND user_id = ?')
      .bind(id, user.id)
      .first();
  } catch (e) {
    /* No `track` column here yet — WHEN EACH POINT WAS PASSED in ../rides.js.
       The ride is still worth answering, with no speeds. */
    try {
      row = await env.DB
        .prepare('SELECT id, name, meters, seconds, created_at AS at, line FROM rides WHERE id = ? AND user_id = ?')
        .bind(id, user.id)
        .first();
    } catch (e2) {
      return json({ error: 'not-ready' }, 503);
    }
  }
  if (!row) return json({ error: 'not-found' }, 404);

  const line = arrayOf(row.line);
  return json({
    ready: true,
    user: user.username,
    ride: {
      id: row.id,
      name: row.name,
      meters: row.meters,
      seconds: row.seconds,
      at: row.at,
      line,
      insight: rideInsight(line, arrayOf(row.track), row.meters, row.seconds)
    }
  }, 200);
}
