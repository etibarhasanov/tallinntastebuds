/**
 * Tallinn Tastebuds — who may hold a discount pass, and what it pays.
 *
 * GET /api/pass?r=<place id>, and it answers two questions in one request.
 * Whether the person asking is signed in, which every discount now requires:
 * a request with no session gets 401 and deal.html offers the sign-in sheet
 * instead of a code. And what this account drew for this place in this hour,
 * which only a deal carrying a roll in data/deals.json uses —
 * assets/pass.js counts that many steps up the run of rates the deal
 * declares. The number comes back either way, because this never reads
 * deals.json and so cannot know which kind of deal is being asked about;
 * a fixed deal ignores it. That split is deliberate: the three numbers an
 * admin sets stay in the file, where everything else about a discount
 * already is, and nothing about any deal is in here.
 *
 * WHY THE DISCOUNTS MOVED BEHIND AN ACCOUNT
 *
 * They were open to everybody who opened the map, and the offer was worth
 * exactly as much to somebody passing through as to somebody who comes back.
 * Now it is the one thing on this site an account is actually for: saving
 * works signed out, lists work signed out, and a discount does not. What
 * that buys the restaurant is a person they can count rather than a browser,
 * and what it buys the site is a reason to sign up that is not a wall in
 * front of a bookmark.
 *
 * WHY THE DRAW IS HERE AND NOT IN THE PAGE
 *
 * A draw made in the browser is either random, and re-made by a reload, or a
 * hash of something the browser holds, and re-made by a private window —
 * either way the game becomes "try again until you like it", which is not
 * what the restaurant is offering. So it is
 *
 *   draw = HMAC-SHA256(SAVE_SALT, "draw|<user id>|<place>|<hour>")  first 32 bits
 *
 * under the secret every other route already keeps, over the account the
 * session names. The hour is this Function's clock and never the request's,
 * so nobody can ask what the next hour holds. A second account is the way
 * round it, and that costs what the README says a save costs — which is
 * enough for a discount.
 *
 * Nothing is stored. The same three inputs give the same answer all hour,
 * which is the whole of "it holds for the hour", and no row was written to
 * make it so; a table of draws would be a table to clear out.
 *
 * WHAT THIS IS NOT
 *
 * It is not what stops a stranger minting a code. The deal keys ship in
 * data/deals.json, a public file, and always have — see WHAT THIS IS NOT in
 * assets/pass.js. This is the door on the page, not a lock on the maths, and
 * the README says so in the same words.
 */

import { json, fingerprint, sessionUser, wrongDatabase } from './_lib.js';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HOUR = 3600000;

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.DB) return json({ error: 'no-database' }, 503);
  /* The binding is there, but it is the wrong one — a preview pointed at the
     live database, or the reverse. See wrongDatabase(). */
  if (await wrongDatabase(env)) return json({ error: 'wrong-database' }, 503);
  /* Fail closed, the way a save does: without the salt the draw would be a
     plain hash of a user id and an hour, and anybody could work out the
     whole evening's rates in advance. */
  if (!env.SAVE_SALT) return json({ error: 'no-salt' }, 503);

  const place = new URL(request.url).searchParams.get('r') || '';
  if (!SLUG.test(place)) return json({ error: 'bad-place' }, 400);

  const user = await sessionUser(request, env);
  if (!user) return json({ error: 'sign-in' }, 401);

  /* The same HMAC the saves put a network address through, over a different
     message: the account, the place and the hour, joined the way that
     function joins its two halves. */
  const hour = Math.floor(Date.now() / HOUR);
  const mac = await fingerprint(env.SAVE_SALT, 'draw|' + user.id + '|' + place, String(hour));
  return json({ draw: parseInt(mac.slice(0, 8), 16) }, 200);
}
