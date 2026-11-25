/**
 * Tallinn Tastebuds — GET /api/v1/seen
 *
 * Where Tallinn Tastebuds was last seen on a bike: one spot, and nothing
 * more. The owner asked for it on 2026-11-24 — a pin on the map that says
 * "last seen here, on a bike, at 14:32". seatSeen() in assets/app.js draws
 * it, and **Last seen, on a bike** in docs/handbook.md is the long version.
 *
 *   { ready: true, seen: { lat, lng, at } }   `at` in whole seconds
 *   { ready: true, seen: null }               no ride has been shown yet
 *   { ready: false, seen: null }              no database, or not this one's
 *
 * Nothing posts it. The spot is written by the two things Rattatee already
 * does on a ride — asking for a new way mid-ride, and saving the ride — and
 * ./_seen.js is how, which account, and what is never shown. Until
 * 2026-11-24's evening this route took a POST from an app that would have
 * sent the spot itself; the owner said no app was to be updated for it, the
 * app half never shipped, and the POST went.
 *
 * ONE ROW, WRITTEN OVER, AND KEPT UNTIL THE NEXT
 *
 * The spot is the `seen` row of `meta`, as JSON, replaced by each one after
 * it. No history, no line, no table of its own and nothing to apply by hand:
 * `meta` has been in every database since the split.
 *
 * It does not run out. The owner's word on the day was that last seen can
 * stay for ever: a saved ride's spot is already 200 m short of where the
 * ride ended, so it protects nobody further to take it away after an hour or
 * a week, and "last seen here" is true until the next ride says otherwise.
 * The map's card gives an old one its date — seenWhen() in assets/app.js.
 *
 * WHAT IT COSTS
 *
 * One row of `meta` by its key, and the colo keeps the answer TTL seconds,
 * so the day's worst is 86,400 / 30 = 2,880 rows a colo with a visitor in it
 * — thirty thousand across ten busy ones, well under a hundredth of the five
 * million. The map asks every thirty seconds only while the spot is fresh
 * and the tab is looked at, and every five minutes otherwise. A write drops
 * the colo's copy where it was written — show() in ./_seen.js.
 *
 * WHAT A FAILURE LOOKS LIKE
 *
 * `{ ready: false, seen: null }`, 200, and the map draws no pin, which is the
 * map as it was before any of this.
 */

import { json, wrongDatabase } from './_lib.js';
import { SEEN, seenKey, readSpot } from './_seen.js';

/* How long a colo, and a browser, keeps an answer. */
const TTL = 30;

const EMPTY = { ready: false, seen: null };

export async function onRequestGet(context) {
  const { env, request } = context;
  if (!env.DB || await wrongDatabase(env)) return json(EMPTY, 200, TTL);

  const cache = caches.default;
  const key = seenKey(request.url);
  const hit = await cache.match(key);
  if (hit) return hit;

  let row;
  try {
    /* A lookup on meta's primary key: `rows_read` 1 against production on
       2026-11-24, asked of a key that is there. */
    row = await env.DB.prepare('SELECT value FROM meta WHERE key = ?').bind(SEEN).first();
  } catch (e) {
    return json(EMPTY, 200, TTL);
  }

  const spot = row ? readSpot(row.value) : null;
  const res = json({ ready: true, seen: spot && { lat: spot.lat, lng: spot.lng, at: spot.at } }, 200, TTL);
  context.waitUntil(cache.put(key, res.clone()));
  return res;
}
