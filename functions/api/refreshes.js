/**
 * Tallinn Tastebuds — what the Google refresh has been doing.
 *
 * GET /api/refreshes
 *
 * The report behind the Google tab on /admin.html: whether the key is set,
 * how much of the free allowance is spent today and this month, how much of
 * google_venues has been refreshed and how much is due, and the last fifty
 * calls with what each one changed. functions/api/_refresh.js is what does the
 * refreshing and says why it works the way it does; this only reads what it
 * wrote.
 *
 *   {
 *     ready: true,
 *     key: true,                               a usable GOOGLE_MAPS_API_KEY is set
 *     refreshAfterDays: 30,
 *     calls: { today: 4, month: 118, day: 32, monthCap: 950 },
 *     table: { total: 1045, refreshed: 212, due: 833 },
 *     recent: [
 *       { at: 1790000000000, id: "ChIJ…", name: "Morii Tea House",
 *         outcome: "changed", changes: { reviews: [165, 171] }, note: "" },
 *       …
 *     ]
 *   }
 *
 * `table` counts the rows the directory shows — not hidden, not missing — so
 * its total is the number on /google rather than the number in the table.
 * `due` is the ones an open would refresh right now.
 *
 * WHO MAY READ IT
 *
 * Anybody, and that is said out loud because /admin.html is behind a
 * passphrase and this is not. Nothing here is anybody's: the numbers are
 * Google's own public ones, which /api/venues already hands to every visitor,
 * the call counts say how busy the directory has been and nothing about who,
 * and `key` says whether a secret is set without saying a character of it.
 * The admin page is a static file with no session to check, so gating this
 * would mean a second secret to keep for no row that needs one.
 *
 * `ready: false` is a database that has not had the tables or the
 * refreshed_at column applied yet; the admin tab says so and prints the line
 * that would do it. no-store, because the only person who reads it has just
 * pressed a button to see it now.
 */

import { json, wrongDatabase } from './_lib.js';
import { BUDGET, REFRESH_AFTER, googleKey, spent } from './_refresh.js';

/* Fifty lines of the log: a few days of opens on an ordinary week, and a
   screen and a half on a phone. */
const RECENT = 50;

function parsed(text) {
  if (!text) return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' ? value : null;
  } catch (e) {
    return null;
  }
}

export async function onRequestGet(context) {
  const { env } = context;
  const key = !!googleKey(env);
  const now = Date.now();

  if (!env.DB || (await wrongDatabase(env))) return json({ ready: false, key });

  try {
    const [counts, calls, log] = await Promise.all([
      env.DB
        .prepare(
          'SELECT COUNT(*) AS total, ' +
          'SUM(CASE WHEN refreshed_at IS NOT NULL THEN 1 ELSE 0 END) AS refreshed, ' +
          'SUM(CASE WHEN COALESCE(refreshed_at, 0) <= ? THEN 1 ELSE 0 END) AS due ' +
          'FROM google_venues WHERE hidden = 0 AND missing_since IS NULL'
        )
        .bind(now - REFRESH_AFTER)
        .first(),
      spent(env, 'details', now),
      env.DB
        .prepare(
          'SELECT r.at, r.place_id, r.outcome, r.changes, r.note, v.name ' +
          'FROM google_refreshes r LEFT JOIN google_venues v ON v.place_id = r.place_id ' +
          'ORDER BY r.at DESC LIMIT ?'
        )
        .bind(RECENT)
        .all()
    ]);

    return json({
      ready: true,
      key,
      refreshAfterDays: Math.round(REFRESH_AFTER / 86400000),
      calls: {
        today: calls.today,
        month: calls.month,
        day: BUDGET.details.day,
        monthCap: BUDGET.details.month
      },
      table: {
        total: Number(counts && counts.total) || 0,
        refreshed: Number(counts && counts.refreshed) || 0,
        due: Number(counts && counts.due) || 0
      },
      recent: (log.results || []).map((row) => ({
        at: row.at,
        id: row.place_id,
        name: row.name || '',
        outcome: row.outcome,
        changes: parsed(row.changes),
        note: row.note || ''
      }))
    });
  } catch (e) {
    /* A table or the column not applied yet. */
    return json({ ready: false, key });
  }
}
