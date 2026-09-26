/**
 * Tallinn Tastebuds — /api/insights, one person's numbers about their own page.
 *
 * GET ?days=7|28|90|0 answers what /insights draws: how often /u/<you> was
 * opened over that range and the one before it, a line of it over time,
 * where the views and the clicks came from, which country, and what on the
 * page was pressed. ./_visits.js holds all of it — what is counted, what is
 * not, and why — and this file is only the door: who may ask, and which
 * ranges may be asked for.
 *
 * WHO MAY ASK
 *
 * The owner of the page, and nobody else, by the session. There is no
 * ?name= and no way to ask about anybody but yourself: the numbers are about
 * a page, but they are its owner's, and a route that took a name would be a
 * way of reading how popular somebody else is. Signed out is an answer
 * rather than an error — `user: null`, 200 — so the page can offer the
 * sign-in rather than print a failure, the way GET /api/account does.
 *
 * WHAT A FAILURE LOOKS LIKE
 *
 * `ready: false` with no database, the other environment's, or no salt —
 * the three things /api/account reports the same way, since no account can
 * exist without them. `insights: null` where profile_counts has not been
 * applied yet, and the page says the numbers are not switched on here.
 *
 * Never cached: the answer is one session's own, and `json()` without a
 * maxAge is `no-store`.
 */

import { json, sessionUser, wrongDatabase } from './_lib.js';
import { SPANS, readInsights } from './_visits.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  const ready = !!(env.DB && env.SAVE_SALT) && !(await wrongDatabase(env));
  if (!ready) return json({ ready: false, user: null }, 200);

  const user = await sessionUser(request, env);
  if (!user) return json({ ready: true, user: null }, 200);

  /* Seven days unless one of the others was asked for by name. */
  const raw = new URL(request.url).searchParams.get('days');
  const asked = raw === null || raw === '' ? NaN : Number(raw);
  const span = SPANS.indexOf(asked) !== -1 ? asked : SPANS[0];

  return json({
    ready: true,
    user: user.username,
    insights: await readInsights(env, user.id, span)
  }, 200);
}
