/**
 * Tallinn Tastebuds — the day's leftover Google calls, spent on purpose.
 *
 * POST /api/refresh
 *
 *   { ok: true, asked: 23, today: 32, day: 32 }        the fill ran
 *   { ok: false, why: 'early', from: 20 }               before FILL_FROM_HOUR UTC
 *   { ok: false, why: 'no-key' }                        no GOOGLE_MAPS_API_KEY
 *   { ok: false, why: 'no-database' }                   no D1, or the wrong one
 *
 * The refresh in ./_refresh.js asks Google about a place when somebody opens
 * it, and for two months that was the only reason it ever asked, which left
 * most of the free thousand unspent and most of the directory never asked
 * about. This is the other reason: once a day, at the day's end, whatever the
 * opens and the top hundred left of the thirty-two goes to the oldest rows —
 * refreshFill() there says which rows and in what order. The route is only the
 * door; the clock is .github/workflows/google-refresh.yml, which POSTs here
 * every evening, since Pages Functions cannot run anything by themselves.
 *
 * WHO MAY CALL IT
 *
 * Anybody, and it carries no secret, because there is nothing to protect: the
 * budget is claimed in the database before any call leaves, so no caller can
 * make the site spend past its thirty-two, and the hour gate means a stranger
 * who calls it can only do, on the same rows, what the workflow would have
 * done two hours later. Before FILL_FROM_HOUR it answers 'early' and asks
 * nothing, so a call at breakfast cannot take the day away from the opens.
 * Once the day is spent, every further call is one read and the same answer.
 *
 * The fill runs inside the request rather than through waitUntil, so the
 * number it answers with is the number of places it asked about — which is
 * what the workflow's log is for. Thirty-two calls to Google one after another
 * is a quarter of a minute, and the only thing waiting is a runner. no-store,
 * since every answer is about this minute.
 */

import { json, wrongDatabase } from './_lib.js';
import { BUDGET, FILL_FROM_HOUR, googleKey, refreshFill, spent } from './_refresh.js';

export async function onRequestPost(context) {
  const { env } = context;
  const now = Date.now();

  if (!env.DB || (await wrongDatabase(env))) return json({ ok: false, why: 'no-database' });
  if (!googleKey(env)) return json({ ok: false, why: 'no-key' });
  if (new Date(now).getUTCHours() < FILL_FROM_HOUR) {
    return json({ ok: false, why: 'early', from: FILL_FROM_HOUR });
  }

  const asked = await refreshFill(env, now);
  const calls = await spent(env, 'details', now);
  return json({ ok: true, asked, today: calls.today, day: BUDGET.details.day });
}
