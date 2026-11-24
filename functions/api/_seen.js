/**
 * Tallinn Tastebuds — where Tallinn Tastebuds was last seen on a bike, and
 * how the spot gets there.
 *
 * One spot, the `seen` row of `meta`: GET /api/v1/seen (./seen.js) answers it
 * and the pin on the map draws it — **Last seen, on a bike** in
 * docs/handbook.md. Nothing posts it and no app was changed for it: the
 * owner's word on 2026-11-24 was that an app update was not on the table.
 * It is written as a side effect of two things Rattatee already does.
 *
 *  - It saves the ride. A ride saved from an account is kept with 200 m
 *    taken off each end (ENDS in ./rides.js), and rideSeen() puts the pin on
 *    the last point that is left: where the rider was 200 m of riding before
 *    they stopped. That spot is always safe, and the pin stays there until
 *    the next ride.
 *  - It asks for a new way in the middle of a ride: GET /api/v1/route with
 *    `from`, where the rider is, and `heading`, with its cookie. wayAsked()
 *    reads that `from` as a spot. Only a ride with somewhere to go that
 *    leaves its way asks; any other says nothing until Save.
 *
 * ONE ACCOUNT
 *
 * Only the account RIDER names in wrangler.toml moves the pin: a `users.id`,
 * for the reason ADMINS is one — ./_admin.js — and a name of its own because
 * the owner has two accounts in ADMINS, and being let into the statistics
 * must never be what puts somebody on the map. Unset, nothing is read or
 * written here at all.
 *
 * NOT THE FIRST OR THE LAST 200 M, AS FAR AS A SERVER CAN TELL
 *
 * A saved ride's end is 200 m short by construction. A new way asked
 * mid-ride is where the rider is now, so it is shown only when it is ENDS_KM
 * from both ends the server knows of: where the way to this place was first
 * asked standing still — no `heading`, which Rattatee leaves off before a
 * ride, and usually the door the ride set off from; that spot is kept as
 * `seen_ask` and never shown — and the place the way leads to, usually where
 * the ride stops. A way first asked mid-ride has no start to measure from
 * and shows nothing.
 *
 * What that cannot cover, and the owner was told so before it was built: a
 * ride that stops somewhere other than where its way led can have shown a
 * spot closer than 200 m to where it stopped, until Save moves the pin.
 *
 * WHAT IT READS
 *
 * A way asked by bike with a session cookie on it reads the session after
 * the answer has gone: two rows, by key. That is every signed-in member's
 * bike way, so a thousand of them a day is two thousand rows of the five
 * million. Only the rider's goes further: one row of `meta` read by its key
 * on a new way mid-ride, and one row written. A save by the rider writes one
 * row and reads none. Nothing here walks a table or grows with one.
 */

import { sessionUser, sessionTokens, wrongDatabase, nearTallinn, km } from './_lib.js';

/* The spot the map draws, and where the rider last asked a way standing
   still. */
export const SEEN = 'seen';
const ASKED = 'seen_ask';

/* How far from each end a new way's spot has to be to be shown: the 200 m
   the site takes off each end of a kept ride, ENDS in ./rides.js. */
const ENDS_KM = 0.2;
/* Two asks lead to the same place when they end this close: the app sends
   the place to the metre, and a pin can be a few out. */
const SAME_KM = 0.05;
/* A way asked standing still is the start of a ride for this long. Past it
   the ride very likely set off from somewhere else, and nothing is shown. */
const ASKED_SECONDS = 6 * 3600;

const PUT = 'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value';

function isRider(env, user) {
  return !!user && user.id === String(env.RIDER || '').trim().toLowerCase();
}

/* The colo's copy of GET /api/v1/seen. One key: nothing in the address and
   nothing about who is asking changes the answer. */
export function seenKey(url) {
  return new Request(new URL('/api/v1/seen', url).toString());
}

/* A stored spot, or null where the row is not one. */
export function readSpot(value) {
  let spot;
  try {
    spot = JSON.parse(value);
  } catch (e) {
    return null;
  }
  return spot && Number.isFinite(spot.lat) && Number.isFinite(spot.lng) && Number.isFinite(spot.at) ? spot : null;
}

function put(env, key, value) {
  return env.DB.prepare(PUT).bind(key, JSON.stringify({ ...value, at: Math.floor(Date.now() / 1000) })).run();
}

/* The pin moved, and this colo's copy of the answer dropped, so a visitor
   served from where the rider is — Tallinn, usually both — sees it on their
   next ask rather than up to thirty seconds later. */
async function show(context, lat, lng) {
  if (!nearTallinn(lat, lng)) return;
  await put(context.env, SEEN, { lat, lng });
  await caches.default.delete(seenKey(context.request.url));
}

/* A way asked by bike: looked at after the answer has gone, and only where
   the request carries a session cookie. Called by unversioned() in
   ./route.js with the points as it read them; nothing about the way changes. */
export function watchWay(context, mode, from, to, heading) {
  const { env, request } = context;
  if (mode !== 'bike' || !env.DB || !env.RIDER || !context.waitUntil || !sessionTokens(request).length) return;
  context.waitUntil(wayAsked(context, from, to, heading).catch(() => {}));
}

async function wayAsked(context, from, to, heading) {
  const { env, request } = context;
  if (await wrongDatabase(env) || !isRider(env, await sessionUser(request, env))) return;

  /* Asked standing still: the start of a ride, kept and never shown. */
  if (heading === null) {
    await put(env, ASKED, { lat: from.lat, lng: from.lng, to: { lat: to.lat, lng: to.lng } });
    return;
  }

  /* Asked mid-ride. One row, by meta's primary key. */
  const row = await env.DB.prepare('SELECT value FROM meta WHERE key = ?').bind(ASKED).first();
  const asked = row && readSpot(row.value);
  if (!asked || !asked.to || Date.now() / 1000 - asked.at > ASKED_SECONDS || km(asked.to, to) > SAME_KM) return;
  if (km(asked, from) < ENDS_KM || km(to, from) < ENDS_KM) return;
  await show(context, from.lat, from.lng);
}

/* A ride the rider saved and the site kept: the pin goes on the last point
   of the last run kept, 200 m of riding short of where the ride stopped.
   Its time is the save's — the phone sends no clock — which is a minute or
   two after the rider was there, the save card coming up at Finish. Called
   by keep() in ./rides.js once the ride is written. */
export async function rideSeen(context, user, runs) {
  if (!isRider(context.env, user) || !runs.length) return;
  const line = runs[runs.length - 1].line;
  await show(context, line[line.length - 1][0], line[line.length - 1][1]);
}
