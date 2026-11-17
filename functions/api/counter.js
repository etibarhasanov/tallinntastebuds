/**
 * Tallinn Tastebuds — GET /api/counter
 *
 * The card that says how many people come here and from where — the old
 * flag counter, asked for by the owner on 2026-11-17 and drawn by
 * drawCounter() in assets/app.js at the top of Discover on a desktop, beside
 * the map's card.
 *
 *   { ready: true, yesterday, week, all, secs, countries: [{ id, n }],
 *     more, since }
 *
 * The numbers are readCounter()'s in ./_visitors.js, and that file's THE
 * FLAG COUNTER, AND THE DESKTOPS IN AMERICA is why they are not simply
 * the rows /admin/visitors reads: a desktop in the United States is counted
 * only once it has done something a person does, because most of them never
 * have.
 *
 * WHY IT IS THE ONE PUBLIC NUMBER OUT OF visitor_counts
 *
 * Every other count on this site is on the owner's pages or nowhere, because
 * a number under a name is a score — **Public lists** in README.md is the
 * argument. This card puts no number under a place, a list or a person. It
 * says how many people came and from which countries, which scores nobody,
 * and the owner wanted the site to say it.
 *
 * ONCE A DAY
 *
 * Every figure stops at yesterday, UTC, so the answer only changes at
 * midnight. The colo holds it under a key with yesterday's date in it, so
 * the first request of a new day reads D1 and every other request that day
 * in that colo does not; the browser may keep it an hour.
 *
 * WHAT A FAILURE LOOKS LIKE
 *
 * `{ ready: false }`, 200: no database, the other environment's, or
 * visitor_counts not there. The page draws no card at all.
 */

import { json, wrongDatabase } from './_lib.js';
import { readCounter } from './_visitors.js';
import { dayBack } from './_visits.js';

const TTL = 3600;
const EMPTY = { ready: false };

/* The answer's own version, moved on when it gains a field the card cannot
   draw without — the way SHAPE is in each of the owner's routes. */
const SHAPE = '1';

export async function onRequestGet(context) {
  const { env, request } = context;
  if (!env.DB || await wrongDatabase(env)) return json(EMPTY, 200, TTL);

  const cache = caches.default;
  const key = counterKey(request);
  const hit = await cache.match(key);
  if (hit) return hit;

  const counted = await readCounter(env);
  if (!counted) return json(EMPTY, 200, TTL);

  const res = json({ ready: true, ...counted }, 200, TTL);
  context.waitUntil(cache.put(key, res.clone()));
  return res;
}

/* The route and the last day it counts, and nothing a request could add to
   the address — one key per colo per day. */
function counterKey(request) {
  const url = new URL('/api/counter', request.url);
  url.searchParams.set('day', dayBack(1));
  url.searchParams.set('shape', SHAPE);
  return new Request(url.toString());
}
