/**
 * Tallinn Tastebuds — /api/admin/live, the last half hour.
 *
 *   GET   { ready: true, minutes: [n, …] } — pages opened in each of the
 *         last thirty minutes, oldest first, the minute still going last.
 *         What the Right now card on /admin/visitors draws, and asks for
 *         again every minute while the page is on screen.
 *
 * The counting and the table are ../_visitors.js's — THE LAST HALF HOUR in
 * its header says what is counted and why it is pages rather than people.
 * The owner's alone: the lock in functions/_middleware.js answers anybody
 * else 403 before this file is reached, as for everything under /api/admin/.
 *
 * Not cached anywhere, which is the one way this differs from ./visitors.js
 * beside it: an answer five minutes old is not "right now". It is one read of
 * sixty rows at most, so a request a minute from one open tab costs nothing
 * worth caching.
 *
 * WHAT A FAILURE LOOKS LIKE
 *
 * `ready: false`, 200 — no database, the other environment's, or
 * visitor_live not applied yet. The page leaves the card out.
 */

import { json, wrongDatabase } from '../_lib.js';
import { readLive } from '../_visitors.js';

export async function onRequestGet(context) {
  const { env } = context;
  if (!env.DB || await wrongDatabase(env)) return json({ ready: false }, 200);
  const minutes = await readLive(env);
  return json(minutes ? { ready: true, minutes: minutes } : { ready: false }, 200);
}
