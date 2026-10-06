/**
 * Tallinn Tastebuds — /api/admin/top100, the week's top hundred and how it
 * moved.
 *
 *   GET   {
 *           ready: true,
 *           week: '2026-10-05',            the Monday of the week it was made in
 *           at: 1790000000000,             when, ms
 *           next: '2026-10-12',            the Monday the next one is due
 *           previous: '2026-09-28' | null, the ranking it is compared against
 *           ranked: 1111, moved: 14, entered: 2,
 *           top: [{ id, rank, was, name, rating, reviews, mapId?, closed? }, …]
 *         }
 *
 * What the Top 100 tab on /admin/google draws. The asking is also the making:
 * the first time this is asked for in a new week, rerankIfDue() in
 * ../_rank.js renumbers `google_venues.rank` from the numbers the table holds
 * and keeps the week's positions, before the answer is read — so the tab is
 * never a week behind the table it describes, and a week's ranking exists
 * because the owner looked, which is the one scheduler Pages Functions have.
 * Its header is the argument for a week and for the arithmetic.
 *
 * Then, after the answer has gone and through waitUntil, refreshTop() in
 * ../_refresh.js asks Google about the top hundred's rows whose numbers are a
 * month old, a couple of dozen at a time inside the same budget every open
 * spends from. A position in the top hundred is a claim about this month's
 * numbers, and this is what makes it one whether or not anybody opened the
 * place. It does nothing without GOOGLE_MAPS_API_KEY, like every refresh.
 *
 * The owner's alone: every /api/admin/ address is answered by the lock in
 * functions/_middleware.js first — adminUser() in ../_admin.js, a 403 to
 * anybody else — so nothing reaches this file that is not the owner's, and it
 * does not check again.
 *
 * `ready: false` is a database without google_reranks and google_ranks yet,
 * and `top: null` with `ready: true` a database that has them and no ranking
 * in them — which the making above means only happens when the making failed.
 * The tab says the ranking is not available yet either way, and the rest of
 * the directory is exactly what it was. `no-store`, because the one person
 * allowed to read it has just asked, and a copy of the week's ranking kept
 * between here and their browser would outlive the Monday.
 */

import { json, wrongDatabase } from '../_lib.js';
import { rerankIfDue, topOfWeek, weekAfter } from '../_rank.js';
import { refreshTop } from '../_refresh.js';

export async function onRequestGet(context) {
  const { env } = context;
  const now = Date.now();

  if (!env.DB || (await wrongDatabase(env))) return json({ ready: false });

  const made = await rerankIfDue(env, now);
  if (made === 'not-ready') return json({ ready: false });

  let week;
  try {
    week = await topOfWeek(env);
  } catch (e) {
    return json({ ready: false });
  }
  if (!week) return json({ ready: true, top: null });

  context.waitUntil(refreshTop(env, now));

  return json({
    ready: true,
    week: week.week,
    at: week.at,
    next: weekAfter(week.week),
    previous: week.previous,
    ranked: week.ranked,
    moved: week.moved,
    entered: week.entered,
    top: week.top
  });
}
