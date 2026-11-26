/**
 * Tallinn Tastebuds — the week's ranking of Google's directory, and the top
 * hundred of it.
 *
 * `google_venues.rank` is where each place stands among all of them once
 * Google's rating is weighed by Google's review count. It arrived as a column
 * the export wrote — ranked() in tools/googlevenues.mjs, loaded by
 * db/google-venues.sql — and for its first weeks that was the only thing that
 * ever wrote it, so a refresh that moved a place's review count moved the
 * card's order on /admin/google at once and its printed position not at all,
 * until somebody re-ran the export. This is what writes it now: once a week,
 * every rated row renumbered from the numbers the table holds today, in one
 * statement, with the week's ranks kept so the next week has something to be
 * compared against.
 *
 * WHY A WEEK, AND WHY ON A REQUEST
 *
 * A week because the numbers move slowly — a review count climbs by a few a
 * week at a busy place and by none at most — and because a position that
 * changed every time one row was refreshed would be a position that meant
 * nothing from one look to the next. On a request because Pages Functions
 * have no scheduler: nothing here can run on Monday morning by itself, and the
 * arrangement everything else on this site uses is to do the work on a
 * request that already happens — the refresh rides on a place being opened,
 * the sweeps ride on a write. This rides on the owner opening the Top 100 tab
 * of /admin/google, which is the one place the result is read: the first
 * time it is asked for in a new week, the week's ranking is made before the
 * answer goes out, and every later ask that week reads it. A week nobody
 * opens the page is a week with no ranking in it, and the one after compares
 * against the last that was made, however long ago; the answer says which.
 *
 * THE SAME ARITHMETIC, THREE TIMES OVER
 *
 * The ORDER BY in rerank() is overallOrder() in tools/googlevenues.mjs and
 * weigh() in assets/venues.js written in SQL: the Bayesian average with a
 * prior of a hundred reviews around the roll's own review-weighted mean,
 * places Google calls temporarily closed below every open one however they
 * score, ties to the bigger review count and then to the key. All three have
 * to agree or the cards on /admin/google count 1, 2, 4, 3 down the screen,
 * which is why RANK_PRIOR is restated rather than imported — the browser's
 * copy cannot import, and this one is written to match it rather than the
 * tool. Two things differ from the export's weighing and are meant to: a
 * row marked hidden (a duplicate, a car park Google thinks is a restaurant)
 * or missing (Google has stopped listing it) gets no rank, where the export
 * ranks every row the CSV carries, because the directory shows neither and
 * "of 1,111" on a card counts the rows it shows. The mean is taken over the
 * same rows, closed ones included, as the page's own is.
 *
 * A row Google gave no rating or no review count for is not ranked and its
 * column goes NULL, the way the export leaves it; the route sends no rank and
 * the card prints none.
 *
 * WHAT IS WRITTEN
 *
 *   google_reranks   one row per week the ranking was made: when, how many
 *                    rows got a rank, how many of the top hundred moved and
 *                    how many were not in it the week before. The row is also
 *                    the claim — inserted on the week, and only the request
 *                    whose insert landed does the work — so two tabs opened
 *                    in the same second make one ranking. A claim left with
 *                    no counts for STALE_CLAIM is taken over; see below.
 *   google_ranks     every ranked row's position that week, keyed on the
 *                    week and the place. What next week's movement is read
 *                    against, and what a chart of a place's position would
 *                    read later. About eleven hundred rows a week; nothing
 *                    prunes it, and at that rate it is a few years before it
 *                    is worth thinking about.
 *   google_venues    `rank`, on every row, in one statement.
 *
 * Both tables arrive by hand — db/schema.sql has them, nothing in CI applies
 * it — and until they do the route answers `ready: false`, the tab says the
 * ranking is not available yet, and the rest of the directory is exactly
 * what it was. The claim failing is what makes that safe: without the table
 * the INSERT throws before any UPDATE is reached.
 *
 * Nothing in here calls Google, and neither does the route. Keeping the top
 * hundred's numbers fresh is refreshFill() in _refresh.js, which takes their
 * due rows first, because the budget and the claim on a row live there.
 */

import { eatOnly, venuesChanged } from './_lib.js';

/* How many reviews a place needs before its own rating counts for half —
   the same hundred as PRIOR in assets/venues.js and RANK_PRIOR in
   tools/googlevenues.mjs, for the reason in the header. */
const RANK_PRIOR = 100;

/* How many of the ranking the tab shows and the movement is worked out
   over. A hundred because that is the page the owner asked for; the whole
   week's ranks are kept, so a wider view is a LIMIT and not a schema. */
export const TOP = 100;

const DAY = 24 * 60 * 60 * 1000;

/* The Monday of the UTC week `now` falls in, as 'YYYY-MM-DD'. The week's
   key, and the day the Top 100 tab prints as "ranked on": a ranking made on
   a Thursday still belongs to that Monday's week, so a page opened on the
   Tuesday after compares against it as last week's rather than as this
   week's. UTC rather than Tallinn time because the budget's days are, and a
   week that turned over at a different hour from the day it spends from
   would be one more thing to explain. */
export function weekOf(now) {
  const d = new Date(now);
  /* getUTCDay() is 0 on a Sunday; Monday is day 1 of the week here. */
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(now - back * DAY).toISOString().slice(0, 10);
}

/* The Monday after the week `week` names — when the next ranking is due. */
export function weekAfter(week) {
  return new Date(Date.parse(week + 'T00:00:00Z') + 7 * DAY).toISOString().slice(0, 10);
}

/* The one statement that renumbers every row, given the clause eatOnly() in
 * ./_lib.js hands back — so a museum the find bar looked up on Google is not
 * ranked among the city's restaurants. Ranking the other kinds too, each
 * among its own, would be PARTITION BY kind in the window below and the
 * clause dropped; nothing else about the table would have to change.
 *
 * Three CTEs: the rows with both numbers that the directory shows; the
 * review-weighted mean over them; each row's position in the order the
 * header describes. Then every row of the table — unrated, hidden and
 * missing ones included — is set to its position or to NULL where it has
 * none, from the materialised CTE, so a row that fell out of the ranking
 * does not keep last week's number. MATERIALIZED because the correlated
 * subquery would otherwise be free to re-run the window over the whole
 * table once per row, eleven hundred times. */
const rerankSql = (only) =>
  'WITH rated AS (' +
  '  SELECT place_id, rating, reviews, ' +
  "    CASE WHEN status = 'Temporarily closed' THEN 1 ELSE 0 END AS closed " +
  '  FROM google_venues ' +
  '  WHERE rating IS NOT NULL AND reviews IS NOT NULL AND hidden = 0 AND missing_since IS NULL' + only +
  '), m AS (' +
  '  SELECT SUM(rating * reviews) / SUM(reviews) AS mean FROM rated' +
  '), scored AS MATERIALIZED (' +
  '  SELECT place_id, ROW_NUMBER() OVER (' +
  '    ORDER BY closed, ' +
  '      (reviews * rating + ?1 * m.mean) / (reviews + ?1) DESC, ' +
  '      reviews DESC, place_id' +
  '  ) AS pos ' +
  '  FROM rated, m' +
  ') ' +
  'UPDATE google_venues SET rank = (SELECT pos FROM scored WHERE scored.place_id = google_venues.place_id)';

/* How long a claim may sit unfinished before another ask takes it over. A
 * ranking is three statements in one batch and takes well under a second;
 * D1 gives up on a statement at thirty. Two minutes is past both, so a claim
 * this old with no counts on it is one whose request died between the claim
 * and the batch — and on 2026-11-16 one did, leaving the week claimed, never
 * ranked, and the tab reading "the hundred highest of 0" until the Monday
 * after. Nothing in a Worker survives the isolate going away mid-request, so
 * the catch below cannot be what cleans this up; the next ask has to be. */
const STALE_CLAIM = 2 * 60 * 1000;

/* Makes this week's ranking if there is not one yet, and says whether it did:
 * 'made', 'had' when the week already has one, 'not-ready' when the tables
 * are not applied, 'error' for anything else. Never throws.
 *
 * The claim first, then the ranking, the week's snapshot and the counts
 * written onto the claim in one batch. A batch is one transaction, so the
 * rank column, google_ranks and the claim's counts cannot disagree about the
 * week, and a claim with `ranked` still NULL is one whose batch never
 * committed. Such a claim older than STALE_CLAIM is taken over by the next
 * ask — the upsert's WHERE — and one younger is somebody else's ranking in
 * progress, which this ask leaves alone and topOfWeek() reads past. A batch
 * that throws gives the claim back too, so the next ask tries again rather
 * than a week reading as ranked on the strength of nothing. Either failure
 * is logged with the week and D1's message, since the claim it gives back
 * leaves nothing behind in the tables: on 2026-11-25 query insights counted
 * the ranking eight times in a day and google_reranks held one, and
 * nothing could say why the other seven had not committed.
 *
 * The counts are read against the newest earlier week, whichever that is —
 * "moved" is a place whose position differs from the last time it had one,
 * and "entered" a place in the hundred that was not in the hundred then.
 * They are read inside the batch, after the snapshot, which a transaction
 * sees. */
export async function rerankIfDue(env, now) {
  if (!env || !env.DB) return 'not-ready';
  const week = weekOf(now);

  let claimed;
  try {
    claimed = await env.DB
      .prepare(
        'INSERT INTO google_reranks (week, at) VALUES (?1, ?2) ' +
        'ON CONFLICT (week) DO UPDATE SET at = excluded.at ' +
        'WHERE google_reranks.ranked IS NULL AND google_reranks.at < ?3 ' +
        'RETURNING week'
      )
      .bind(week, now, now - STALE_CLAIM)
      .first();
  } catch (e) {
    return 'not-ready';
  }
  if (!claimed) return 'had';

  let ranked = false;
  try {
    const only = await eatOnly(env);
    await env.DB.batch([
      env.DB.prepare(rerankSql(only)).bind(RANK_PRIOR),
      /* Nothing should be here — a batch that died rolled back whole — but a
         week taken over is a week whose snapshot is about to be written
         again, and the primary key would refuse a second copy of it. */
      env.DB.prepare('DELETE FROM google_ranks WHERE week = ?').bind(week),
      env.DB
        .prepare(
          'INSERT INTO google_ranks (week, place_id, rank) ' +
          'SELECT ?, place_id, rank FROM google_venues WHERE rank IS NOT NULL'
        )
        .bind(week),
      env.DB
        .prepare(
          'UPDATE google_reranks SET ' +
          '  ranked = (SELECT COUNT(*) FROM google_ranks WHERE week = ?1), ' +
          '  moved = (' +
          '    SELECT COUNT(*) FROM google_ranks now ' +
          '    JOIN google_ranks was ON was.place_id = now.place_id ' +
          '      AND was.week = (SELECT MAX(week) FROM google_ranks WHERE week < ?1) ' +
          '    WHERE now.week = ?1 AND now.rank <= ?2 AND now.rank <> was.rank' +
          '  ), ' +
          '  entered = (' +
          '    SELECT COUNT(*) FROM google_ranks now ' +
          '    WHERE now.week = ?1 AND now.rank <= ?2 ' +
          '      AND EXISTS (SELECT 1 FROM google_ranks WHERE week < ?1) ' +
          '      AND NOT EXISTS (' +
          '        SELECT 1 FROM google_ranks was WHERE was.place_id = now.place_id ' +
          '          AND was.week = (SELECT MAX(week) FROM google_ranks WHERE week < ?1) ' +
          '          AND was.rank <= ?2' +
          '      )' +
          '  ) ' +
          'WHERE week = ?1'
        )
        .bind(week, TOP)
    ]);
    ranked = true;
    /* Every row's `rank`, which the find bar orders by: the copies other
       isolates keep read the table again — googleTable() in ./_lib.js. */
    await venuesChanged(env, 'all');
    return 'made';
  } catch (e) {
    /* Which half failed matters: a batch that threw is a week still to be
       ranked, and the next ask tries again; a mark that threw after it is a
       ranking that stands, and only the isolates' copies of the table were
       not told — so the claim is kept. */
    console.error('rerank ' + week + (ranked ? ': ranked, venuesChanged failed: ' : ': batch failed: ') +
      ((e && e.message) || e));
    if (ranked) return 'error';
    try {
      await env.DB.prepare('DELETE FROM google_reranks WHERE week = ? AND ranked IS NULL').bind(week).run();
    } catch (ignored) { /* the database is the thing that failed */ }
    return 'error';
  }
}

/* The newest ranking and the top hundred of it, against the one before.
 *
 *   {
 *     week: '2026-10-05', at: 1790000000000, ranked: 1111,
 *     moved: 14, entered: 2,
 *     previous: '2026-09-28' | null,
 *     top: [{ id, rank, was: 7 | null, name, rating, reviews, mapId?, closed? }, …]
 *   }
 *
 * `was` is the place's position in the previous ranking, whichever week that
 * was, and null when it had none — Google had no numbers for it then, or the
 * ranking before this one is the first. The page draws the arrow from the
 * two; `previous` null is the first ranking and the page says so instead.
 * A claim whose batch has not committed — `ranked` still NULL, a ranking in
 * progress or one whose request died — is not a ranking, and the one before
 * it is answered instead, so the tab is a week behind rather than empty.
 * Null when no ranking has been made; throws when the tables are not there,
 * and the route turns that into `ready: false`. */
export async function topOfWeek(env) {
  const made = await env.DB
    .prepare(
      'SELECT week, at, ranked, moved, entered FROM google_reranks ' +
      'WHERE ranked IS NOT NULL ORDER BY week DESC LIMIT 1'
    )
    .first();
  if (!made) return null;

  const [before, top] = await Promise.all([
    env.DB
      .prepare('SELECT MAX(week) AS week FROM google_ranks WHERE week < ?')
      .bind(made.week)
      .first(),
    env.DB
      .prepare(
        'SELECT r.place_id, r.rank, was.rank AS was, v.name, v.rating, v.reviews, v.map_id, v.status ' +
        'FROM google_ranks r ' +
        'JOIN google_venues v ON v.place_id = r.place_id ' +
        'LEFT JOIN google_ranks was ON was.place_id = r.place_id ' +
        '  AND was.week = (SELECT MAX(week) FROM google_ranks WHERE week < ?1) ' +
        'WHERE r.week = ?1 AND r.rank <= ?2 ' +
        'ORDER BY r.rank'
      )
      .bind(made.week, TOP)
      .all()
  ]);

  return {
    week: made.week,
    at: made.at,
    ranked: Number(made.ranked) || 0,
    moved: Number(made.moved) || 0,
    entered: Number(made.entered) || 0,
    previous: (before && before.week) || null,
    top: (top.results || []).map((row) => {
      const out = {
        id: row.place_id,
        rank: row.rank,
        was: typeof row.was === 'number' ? row.was : null,
        name: row.name
      };
      if (typeof row.rating === 'number') out.rating = row.rating;
      if (typeof row.reviews === 'number') out.reviews = row.reviews;
      if (row.map_id) out.mapId = row.map_id;
      if (row.status === 'Temporarily closed') out.closed = true;
      return out;
    })
  };
}
