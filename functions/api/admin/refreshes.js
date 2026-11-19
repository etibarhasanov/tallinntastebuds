/**
 * Tallinn Tastebuds — what the Google refresh has been doing.
 *
 * GET /api/admin/refreshes
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
 *     calls: { today: 4, month: 118, day: 32, opens: 64, monthCap: 950 },
 *     table: { total: 1045, refreshed: 212, due: 833 },
 *     recent: [
 *       { at: 1790000000000, id: "ChIJ…", name: "Morii Tea House",
 *         outcome: "changed", changes: { reviews: [165, 171] }, note: "" },
 *       …
 *     ],
 *     map: [
 *       { id: "borsch-ja-varenyk", status: "Temporarily closed", missing: false },
 *       …
 *     ]
 *   }
 * `map` is Google's word on every row tied to a place on my map — status as
 * the refresh last wrote it, and whether Google has stopped knowing it at all.
 * The Google tab lays it against data/restaurants.json and lists the places
 * where the two disagree, with a button that opens the pull request to move
 * the map: a place Google calls temporarily closed that the map still sends
 * people to, or one the map holds shut for the moment that Google says is
 * open again. Sixty-odd rows, and the list is the whole reason a status flip
 * in the log below is something the owner finds rather than remembers. See
 * **Close a place instead of deleting it** in docs/handbook.md.
 *
 * `table` counts the rows the directory shows — not hidden, not missing, and
 * somewhere to eat, which is all the fill asks about — so
 * its total is the number on /admin/google rather than the number in the table.
 * `due` is the ones the fill would ask about right now: older than their tier
 * allows — TIERS in ../_refresh.js. `refreshAfterDays` is an open's thirty.
 *
 * WHAT IT READS
 *
 * `table` and `map` are counted here, out of the copy of google_venues the
 * isolate keeps — googleTable() in ../_lib.js — and not by a statement. As
 * one, with DUE_SQL inside a SUM, the count walked every row the directory
 * shows, 1,117 of them through an index and then the table, each time the
 * tab was opened. The copy is asked to look now rather than on its clock, so
 * a report read just after a refresh has that refresh in it: two rows of
 * meta and the rows changed since the last look, thirty-odd on a day the
 * whole allowance is spent, and the table once, 1,179 rows on 2026-11-19,
 * in an isolate that had no copy. Whether a place is busy is asked of
 * google_scores only for the rows it could make due — below the top four
 * hundred, refreshed more than a month ago and not yet past their tier's
 * wait, a few hundred at the most — at half a dozen rows each, busyAmong().
 * Beside them the log's fifty rows and
 * a name each, and the day's and month's calls. A dozen opens a day is some
 * thousands of rows against the five million, and none of it grows with
 * google_scores.
 *
 * WHO MAY READ IT
 *
 * The owner, like everything under /api/admin/: the lock in
 * functions/_middleware.js answers anybody else with a 403 before this file
 * is reached — adminUser() in ../_admin.js — so it does not check again. It
 * was open to anybody for a while, on the argument that every number in it is
 * Google's own or a count; it moved here with the directory and the
 * statistics, so that everything the admin page reads sits behind one door
 * and "under /api/admin/" is the whole of the rule. The owner signs in on the
 * site as usual for the Google tab to fill.
 *
 * `ready: false` is a database that has not had the tables or the
 * refreshed_at column applied yet; the admin tab says so and prints the line
 * that would do it. no-store, because the only person who reads it has just
 * pressed a button to see it now.
 *
 * POST /api/admin/refreshes
 *
 *   { ok: true, asked: 23, today: 32, day: 32 }    the fill ran
 *   { ok: false, why: 'no-key' | 'no-database' }   it could not
 *
 * The tab's **Refresh from Google now**: the day's fill, when the owner
 * says so rather than when the afternoon comes round. It is refreshFill()
 * in ../_refresh.js and nothing else — the same rows in the same order, the
 * top hundred's due ones first, and the same thirty-two a day, claimed in
 * the database before any call leaves — so a press can spend what is left
 * of the day and not one call more, and a second press finds nothing to
 * do. What it does not have is POST /api/refresh's hours: that door is open
 * to anybody and keeps the morning and eight of the afternoon's calls back
 * from a stranger, and this one is the owner's, pressed on purpose. `asked`
 * counts the places that were written, inside the request, a quarter of a
 * minute at the most; what moved on each is in the report the tab reads
 * again afterwards. A write must carry the site's own Origin, the way one
 * through ./github/ must: the cookie is SameSite=Lax, and this is the
 * second lock on a route that spends.
 */

import { json, wrongDatabase, googleTable } from '../_lib.js';
import { BUDGET, REFRESH_AFTER, busyAmong, googleKey, refreshAfter, refreshFill, spent } from '../_refresh.js';

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
    const [table, calls, log] = await Promise.all([
      googleTable(env, 'now'),
      spent(env, 'details', now),
      /* The newest fifty by google_refreshes' index on `at`, and a name each
         by google_venues' key. */
      env.DB
        .prepare(
          'SELECT r.at, r.place_id, r.outcome, r.changes, r.note, v.name ' +
          'FROM google_refreshes r LEFT JOIN google_venues v ON v.place_id = r.place_id ' +
          'ORDER BY r.at DESC LIMIT ?'
        )
        .bind(RECENT)
        .all()
    ]);
    const rows = table ? [...table.rows.values()] : [];
    /* No copy, or a table without the column the refresh stamps. */
    if (!table || (rows.length && rows[0].refreshed_at === undefined)) return json({ ready: false, key });

    /* A row from before `kind` was applied has none, and is somewhere to eat. */
    const shown = rows.filter((row) => !row.hidden && row.missing_since == null && (row.kind == null || row.kind === 'eat'));
    const last = (row) => Number(row.refreshed_at) || 0;
    const wait = (row, busy) => refreshAfter(row.rank, row.status, busy);
    /* Busy only shortens a wait, so it is asked for the rows it would make
       due and no others. */
    const busy = await busyAmong(env, shown
      .filter((row) => last(row) > now - wait(row, false) && last(row) <= now - wait(row, true))
      .map((row) => row.place_id));

    return json({
      ready: true,
      key,
      refreshAfterDays: Math.round(REFRESH_AFTER / 86400000),
      calls: {
        today: calls.today,
        month: calls.month,
        day: BUDGET.details.day,
        opens: BUDGET.details.opens,
        monthCap: BUDGET.details.month
      },
      table: {
        total: shown.length,
        refreshed: shown.filter((row) => row.refreshed_at != null).length,
        due: shown.filter((row) => last(row) <= now - wait(row, busy.has(row.place_id))).length
      },
      recent: (log.results || []).map((row) => ({
        at: row.at,
        id: row.place_id,
        name: row.name || '',
        outcome: row.outcome,
        changes: parsed(row.changes),
        note: row.note || ''
      })),
      map: rows.filter((row) => row.map_id != null).map((row) => ({
        id: row.map_id,
        status: row.status || '',
        missing: row.missing_since != null
      }))
    });
  } catch (e) {
    /* A table or the column not applied yet. */
    return json({ ready: false, key });
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const now = Date.now();

  if (request.headers.get('Origin') !== new URL(request.url).origin) return json({ error: 'origin' }, 403);
  if (!env.DB || (await wrongDatabase(env))) return json({ ok: false, why: 'no-database' });
  if (!googleKey(env)) return json({ ok: false, why: 'no-key' });

  const asked = await refreshFill(env, now);
  const calls = await spent(env, 'details', now);
  return json({ ok: true, asked, today: calls.today, day: BUDGET.details.day });
}
