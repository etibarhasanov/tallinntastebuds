/**
 * Tallinn Tastebuds — /api/admin/growth, how each place's Google review count
 * has moved.
 *
 *   GET   {
 *           ready: true,
 *           at: 1794300000000,             when this was worked out, ms
 *           last: 1794233735739,           the newest answer in it, ms
 *           forecastAt: 1798675200000,     the day `forecast` is for, ms
 *           counts: { all: 138, ahead: 40, pace: 53, behind: 43, check: 2 },
 *           places: [{
 *             id, name, rank, mapId?,
 *             first: { n: 243, at } | null,   where the series starts
 *             prev:  { n: 332, at } | null,   the answer before the latest
 *             last:  { n: 412, at },          the latest answer
 *             gained: 169,                    last less the start of the series
 *             month: 70.6,                    the last interval, as thirty days' worth
 *             usual: 6.8,                     what a place that size gathers
 *             ratio: 9.15,                    month against usual
 *             verdict: 'ahead' | 'pace' | 'behind' | 'check',
 *             forecast: 534 | null,           the count on forecastAt at this pace
 *             series: [[at, n], …]            every point, oldest first
 *           }, …]
 *         }
 *
 * What the Growth tab on /admin/google draws. It is google_scores read as a
 * table: every answer Google has given about a place is a line there and
 * nothing prunes it — keepScores() in ../_refresh.js — so nothing here is
 * kept or cached, and a place's row moves the next time the page is opened
 * after Google has answered about it again.
 *
 * WHAT A ROW IS MADE OF
 *
 * A place is in the answer once it has two points: two dated answers, or one
 * and the export's pair before it. The export's pair has no time on its line
 * — the export was one sweep, loaded as a file — so it is dated by the row's
 * first_seen_at, the day the place was first loaded, which is the day after
 * the sweep at the latest. That is a day or two out and it is the only date
 * the database has; an interval measured from it is thirty days long or
 * more, so the pace it gives is out by a twentieth at worst.
 *
 * `month` is the gain over the last interval scaled to thirty days — between
 * the last two dated answers where there are two, from the export's pair to
 * the one answer where there are not. It is one interval and not an average
 * of all of them on purpose: the tab is for what a place is doing now.
 *
 * WHAT USUAL IS
 *
 * A place with six thousand reviews gathers more in a month than one with two
 * hundred, so a pace means nothing until it is held against the size. `usual`
 * is that: a straight line through log(month + 1) against log(reviews) over
 * every place in the answer, fitted here on each request, so it is what
 * places that size are gathering this month and not what they gathered when
 * somebody last wrote a constant down. `ratio` is (month + 1) / (usual + 1) —
 * the ones keep a place that gained nothing from dividing by nought and a
 * place expected to gain nothing from being infinitely ahead — and AHEAD and
 * BEHIND are the two lines drawn through it. With fewer than FIT_FROM places
 * a line through them is a line through noise, so FALLBACK stands in: the
 * fit over the 136 places the table held on 2026-11-10.
 *
 * `check` is not a pace at all. A count that leaps in one answer is two
 * listings Google merged or an id handed to another branch — jumped() in
 * ../_refresh.js, the same test that marks the refresh log — and a place
 * like that is named, kept out of the fit, and given no forecast until its
 * next answer.
 *
 * The owner's alone: every /api/admin/ address is answered by the lock in
 * functions/_middleware.js first — adminUser() in ../_admin.js, a 403 to
 * anybody else — so nothing reaches this file that is not the owner's, and it
 * does not check again. Two reads, of google_venues and of google_scores
 * whole: eleven hundred rows and a few thousand, joined here rather than in
 * SQL because the last two lines per place is a window the browser's table
 * would then have to be handed anyway. `ready: false` is a database without
 * google_scores; the tab says growth is not available yet and the rest of
 * the directory is what it was. `no-store`, since the one person allowed to
 * read it has just asked.
 */

import { json, wrongDatabase } from '../_lib.js';
import { jumped } from '../_refresh.js';

const DAY = 24 * 60 * 60 * 1000;

/* The two lines through `ratio`. Half as fast again is ahead; two thirds is
   behind, which is the same distance the other way. */
export const AHEAD = 1.5;
export const BEHIND = 1 / AHEAD;

/* How many places a fit needs before it is believed, and the line that
   stands in below that: log(month + 1) = a + b · log(reviews). */
const FIT_FROM = 30;
const FALLBACK = { a: -0.28, b: 0.4 };

/* An interval shorter than this is two answers on the same day — an open and
   the fill, a retry — and a pace over it is a division by nearly nothing. */
const SHORTEST = DAY;

const round = (n, places) => Math.round(n * 10 ** places) / 10 ** places;

/* The day a forecast is for: the last of the year, or the last of the next
   one when this one has less than a month left to forecast across. */
export function forecastDay(now) {
  const year = new Date(now + 30 * DAY).getUTCFullYear();
  return Date.UTC(year, 11, 31);
}

/* One place's row, or null when it has too little to say. `lines` are its
   google_scores rows, the export's undated pair first and then by time. */
function rowOf(venue, lines) {
  const points = [];
  for (const line of lines) {
    if (line.reviews === null || line.reviews === undefined) continue;
    const at = line.at === null || line.at === undefined ? Number(venue.first_seen_at) || 0 : Number(line.at);
    if (!at) continue;
    points.push({ n: Number(line.reviews), at, dated: line.at !== null && line.at !== undefined });
  }
  points.sort((a, b) => a.at - b.at);
  const dated = points.filter((p) => p.dated);
  if (points.length < 2 || !dated.length) return null;

  const last = dated[dated.length - 1];
  const from = points[points.indexOf(last) - 1];
  if (!from || last.at - from.at < SHORTEST) return null;

  const pair = (p) => ({ n: p.n, at: p.at });
  const row = {
    id: venue.place_id,
    name: venue.name,
    rank: venue.rank === undefined ? null : venue.rank,
    first: points.length >= 3 || !points[0].dated ? pair(points[0]) : null,
    prev: from.dated ? pair(from) : null,
    last: pair(last),
    gained: last.n - points[0].n,
    size: from.n,
    monthRaw: (last.n - from.n) / ((last.at - from.at) / DAY) * 30,
    check: jumped(from.n, last.n, last.at - from.at),
    series: points.map((p) => [p.at, p.n])
  };
  if (venue.map_id) row.mapId = venue.map_id;
  return row;
}

/* Least squares of log(month + 1) on log(size), over the rows that are a
   pace: not a jump, not a count that fell, and a place with a size at all. */
function fit(rows) {
  const xs = [];
  const ys = [];
  for (const row of rows) {
    if (row.check || row.monthRaw < 0 || !(row.size > 0)) continue;
    xs.push(Math.log(row.size));
    ys.push(Math.log(row.monthRaw + 1));
  }
  if (xs.length < FIT_FROM) return FALLBACK;
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxy = 0;
  let sxx = 0;
  xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
  if (!(sxx > 0)) return FALLBACK;
  const b = sxy / sxx;
  return { a: my - b * mx, b };
}

/* The whole answer, from the two tables' rows. Apart from the request so
   that it can be run over rows that did not come out of a database. */
export function growth(venues, scores, now) {
  const byPlace = new Map();
  for (const line of scores) {
    if (!byPlace.has(line.place_id)) byPlace.set(line.place_id, []);
    byPlace.get(line.place_id).push(line);
  }

  const rows = [];
  for (const venue of venues) {
    const lines = byPlace.get(venue.place_id);
    const row = lines && rowOf(venue, lines);
    if (row) rows.push(row);
  }

  const line = fit(rows);
  const forecastAt = forecastDay(now);
  const counts = { all: rows.length, ahead: 0, pace: 0, behind: 0, check: 0 };
  let newest = 0;

  const places = rows.map((row) => {
    const usual = Math.max(0, Math.exp(line.a + line.b * Math.log(Math.max(1, row.size))) - 1);
    const ratio = (row.monthRaw + 1) / (usual + 1);
    const verdict = row.check ? 'check' : ratio >= AHEAD ? 'ahead' : ratio <= BEHIND ? 'behind' : 'pace';
    counts[verdict]++;
    if (row.last.at > newest) newest = row.last.at;
    const { size, monthRaw, check, ...kept } = row;
    return {
      ...kept,
      month: round(monthRaw, 1),
      usual: round(usual, 1),
      ratio: round(ratio, 2),
      verdict,
      forecast: check ? null
        : Math.round(row.last.n + Math.max(0, monthRaw) / 30 * Math.max(0, forecastAt - row.last.at) / DAY)
    };
  });

  return { ready: true, at: now, last: newest || null, forecastAt, counts, places };
}

export async function onRequestGet(context) {
  const { env } = context;
  if (!env.DB || (await wrongDatabase(env))) return json({ ready: false });

  try {
    const [venues, scores] = await Promise.all([
      env.DB
        .prepare(
          'SELECT place_id, name, rank, map_id, first_seen_at FROM google_venues ' +
          'WHERE hidden = 0 AND missing_since IS NULL'
        )
        .all(),
      env.DB
        .prepare('SELECT place_id, at, reviews FROM google_scores ORDER BY place_id, at')
        .all()
    ]);
    return json(growth(venues.results || [], scores.results || [], Date.now()));
  } catch (e) {
    /* google_scores not applied to this database yet. */
    return json({ ready: false });
  }
}
