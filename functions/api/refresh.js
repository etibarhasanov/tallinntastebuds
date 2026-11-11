/**
 * Tallinn Tastebuds — the day's leftover Google calls, spent on purpose.
 *
 * POST /api/refresh
 *
 *   { ok: true, asked: 23, today: 24, day: 32, kept: 8 }   the fill ran
 *   { ok: false, why: 'early', from: 12 }                 before FILL_FROM_HOUR UTC
 *   { ok: false, why: 'no-key' }                        no GOOGLE_MAPS_API_KEY
 *   { ok: false, why: 'no-database' }                   no D1, or the wrong one
 *
 * The refresh in ./_refresh.js asks Google about a place when somebody opens
 * it, and for two months that was the only reason it ever asked, which left
 * most of the free thousand unspent and most of the directory never asked
 * about. This is the other reason: through the second half of each UTC day,
 * whatever the opens left of the thirty-two goes to the
 * oldest rows — refreshFill() there says which rows and in what order.
 *
 * This route is the fill's second door, and no longer its clock. The clock is
 * the site's own visitors: fillOnVisit() in ./_refresh.js rides on the report
 * every opened page sends to ./stats.js and spends the day a few rows at a
 * time, and WHY A VISIT IS THE CLOCK there says what GitHub's scheduler did
 * in the five days it was trusted with the job. .github/workflows/
 * google-refresh.yml still POSTs here three times an afternoon and evening,
 * for the day nobody comes: when it arrives on time it finds little or
 * nothing left, and when it arrives late or not at all nothing depended on
 * it. Before SPEND_ALL_FROM_HOUR a knock keeps KEEP_FOR_OPENS of the day back
 * for the evening's opens and answers how many it kept; from then on it takes
 * everything left.
 *
 * WHO MAY CALL IT
 *
 * Anybody, and it carries no secret, because there is nothing to protect: the
 * budget is claimed in the database before any call leaves, so no caller can
 * make the site spend past the thirty-two the fill stops at, and the hour gates mean a stranger
 * who calls it can only do, on the same rows, what the workflow's next knock
 * would have done. Before FILL_FROM_HOUR it answers 'early' and asks nothing,
 * so a call at breakfast cannot take the day away from the opens.
 * Once the day is spent, every further call is one read and the same answer.
 *
 * The fill runs inside the request rather than through waitUntil, so the
 * number it answers with is the number of places it asked about — which is
 * what the workflow's log is for. Thirty-two calls to Google one after another
 * is a quarter of a minute, and the only thing waiting is a runner. no-store,
 * since every answer is about this minute.
 */

import { json, wrongDatabase } from './_lib.js';
import {
  BUDGET, FILL_FROM_HOUR, KEEP_FOR_OPENS, SPEND_ALL_FROM_HOUR, googleKey, refreshFill, spent
} from './_refresh.js';

export async function onRequestPost(context) {
  const { env } = context;
  const now = Date.now();

  if (!env.DB || (await wrongDatabase(env))) return json({ ok: false, why: 'no-database' });
  if (!googleKey(env)) return json({ ok: false, why: 'no-key' });
  const hour = new Date(now).getUTCHours();
  if (hour < FILL_FROM_HOUR) {
    return json({ ok: false, why: 'early', from: FILL_FROM_HOUR });
  }

  const kept = hour < SPEND_ALL_FROM_HOUR ? KEEP_FOR_OPENS : 0;
  const asked = await refreshFill(env, now, kept);
  const calls = await spent(env, 'details', now);
  return json({ ok: true, asked, today: calls.today, day: BUDGET.details.day, kept });
}
