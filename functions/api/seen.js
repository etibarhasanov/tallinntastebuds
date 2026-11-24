/**
 * Tallinn Tastebuds — GET and POST /api/v1/seen
 *
 * Where Tallinn Tastebuds was last seen on a bike: one spot, and nothing
 * more. The owner asked for it on 2026-11-24 — a pin on the map that says
 * "last seen here, on a bike, at 14:32", moving while the site's own account
 * is out on a ride with Rattatee. drawSeen() in assets/app.js draws it, and
 * **Last seen, on a bike** in docs/handbook.md is the long version.
 *
 *   GET   { ready: true, seen: { lat, lng, at } }   `at` in whole seconds
 *         { ready: true, seen: null }               no ride has been shown yet
 *         { ready: false, seen: null }              no database, or not this one's
 *
 *   POST  { lat, lng, at }  →  { ok: true }
 *         401 signed-out    no session
 *         403 not-yours     a session, and not the rider's
 *         400 malformed     not three numbers, or a time that is not about now
 *         400 outside       not in Tallinn
 *
 * ONE ACCOUNT, NAMED BY ITS ID
 *
 * Only the account RIDER names in wrangler.toml may post, and RIDER is a
 * `users.id` for the reason ADMINS is — ./_admin.js: a username can be
 * changed and claimed by somebody else, an id cannot. It is a name of its own
 * rather than "whoever ADMINS lists" because the owner has two accounts
 * there, and a ride the other one records is nobody's business: being let
 * into the statistics must never be what puts somebody on the map. Unset,
 * nobody is the rider and every POST is refused.
 *
 * GET /api/v1/account says `shares: true` to that account and to no other,
 * which is how Rattatee knows to send anything at all — isRider() below is
 * the one test both routes use. An app that was never told sends nothing, so
 * a thousand riders cost this route nothing.
 *
 * WHAT IS NEVER SENT HERE, WHICH THIS ROUTE CANNOT CHECK
 *
 * The phone holds the ride and decides: a spot goes only once the rider is
 * 200 m of riding past it, never from the first 200 m after Start or a
 * Resume, never within 200 m of where the ride began or was paused, and at
 * most every twenty seconds — `Live` in Rattatee's Core/Live.swift. So the
 * pin trails the rider, and where a ride begins and ends is never here at
 * all: the last 200 m before Finish were still waiting when it was pressed.
 * A server cannot know where a ride will end, which is why the rule lives on
 * the phone; what is checked here is what can be — who is asking, that the
 * spot is in Tallinn, and that its time is about now.
 *
 * ONE ROW, WRITTEN OVER, AND KEPT UNTIL THE NEXT
 *
 * The spot is the `seen` row of `meta`, as JSON, replaced by each one after
 * it. No history, no line, no table of its own and nothing to apply by hand:
 * `meta` has been in every database since the split. Where the rider was a
 * minute before the last spot is not kept anywhere.
 *
 * It does not run out. The owner's word on the day was that last seen can
 * stay for ever: a ride's last spot is already 200 m short of where the ride
 * ended, so it protects nobody further to take it away after an hour or a
 * week, and "last seen here" is true until the next ride says otherwise. The
 * map draws an old one quieter and with its date — drawSeen().
 *
 * WHAT IT COSTS
 *
 * A read is one row of `meta` by its key, and the colo keeps the answer TTL
 * seconds, so the day's worst is 86,400 / 30 = 2,880 rows a colo with a
 * visitor in it — thirty thousand across ten busy ones, well under a
 * hundredth of the five million. The map asks every thirty seconds only
 * while the spot is fresh and the tab is looked at, and every five minutes
 * otherwise. A write is that one row, at most 180 an hour of riding, from
 * one phone, and each also reads the session: two rows. After a write this
 * colo's copy is dropped, so a visitor served from where the rider's phone
 * is — Tallinn, usually both — sees the new spot on their next ask rather
 * than up to TTL later.
 *
 * WHAT A FAILURE LOOKS LIKE
 *
 * `{ ready: false, seen: null }`, 200, and the map draws no pin, which is the
 * map as it was before any of this.
 */

import { json, sessionUser, wrongDatabase, nearTallinn } from './_lib.js';

const KEY = 'seen';

/* How long a colo, and a browser, keeps an answer. */
const TTL = 30;

/* How far from this clock a spot's time may be, in seconds. The phone sends
   where the rider was 200 m of riding ago, which is under a minute at any
   speed a bike keeps, and sends nothing it has held on to; fifteen minutes
   back is room for a slow hill and a bad signal, two ahead for a clock that
   runs fast. */
const LATE = 15 * 60;
const EARLY = 2 * 60;

const EMPTY = { ready: false, seen: null };

/* Whether this signed-in account is the one whose rides are shown. */
export function isRider(env, user) {
  const rider = String((env && env.RIDER) || '').trim().toLowerCase();
  return !!(rider && user && user.id === rider);
}

/* One key per colo: nothing a request could add to the address changes the
   answer, and nothing about who is asking does either. */
function seenKey(request) {
  return new Request(new URL('/api/v1/seen', request.url).toString());
}

/* The stored row as a spot, or null where it is not one. */
function spotOf(value) {
  let spot;
  try {
    spot = JSON.parse(value);
  } catch (e) {
    return null;
  }
  if (!spot || !Number.isFinite(spot.lat) || !Number.isFinite(spot.lng) || !Number.isFinite(spot.at)) return null;
  return { lat: spot.lat, lng: spot.lng, at: spot.at };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  if (!env.DB || await wrongDatabase(env)) return json(EMPTY, 200, TTL);

  const cache = caches.default;
  const key = seenKey(request);
  const hit = await cache.match(key);
  if (hit) return hit;

  let row;
  try {
    /* A lookup on meta's primary key: `rows_read` 1 against production on
       2026-11-24, asked of a key that is there. */
    row = await env.DB.prepare('SELECT value FROM meta WHERE key = ?').bind(KEY).first();
  } catch (e) {
    return json(EMPTY, 200, TTL);
  }

  const res = json({ ready: true, seen: row ? spotOf(row.value) : null }, 200, TTL);
  context.waitUntil(cache.put(key, res.clone()));
  return res;
}

export async function onRequestPost(context) {
  const { env, request } = context;
  if (!env.DB) return json({ error: 'no-database' }, 503);
  if (await wrongDatabase(env)) return json({ error: 'wrong-database' }, 503);

  const user = await sessionUser(request, env);
  if (!user) return json({ error: 'signed-out' }, 401);
  if (!isRider(env, user)) return json({ error: 'not-yours' }, 403);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'malformed' }, 400);
  }

  const lat = body && body.lat;
  const lng = body && body.lng;
  const at = body && body.at;
  const now = Date.now() / 1000;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isInteger(at)) return json({ error: 'malformed' }, 400);
  if (at < now - LATE || at > now + EARLY) return json({ error: 'malformed' }, 400);
  if (!nearTallinn(lat, lng)) return json({ error: 'outside' }, 400);

  /* Five decimals is about a metre, which is what the phone sends and more
     than a pin on a street needs. */
  const spot = { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5, at };
  try {
    await env.DB
      .prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .bind(KEY, JSON.stringify(spot))
      .run();
  } catch (e) {
    return json({ error: 'not-ready' }, 503);
  }

  context.waitUntil(caches.default.delete(seenKey(request)));
  return json({ ok: true }, 200);
}
