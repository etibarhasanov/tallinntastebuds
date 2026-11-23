/**
 * Tallinn Tastebuds — which rides pass through a stretch of the city.
 *
 * ?bbox= in ./rides.js, which the iPhone app draws, asks `rides` for the
 * newest rides whose box meets another — and until 2026-11-19 so did the
 * ridden way in ./route.js, on every bike route, which reads
 * `ride_sections` now. That question cannot be answered by any key `rides`
 * has — a box is four ranges at once — so each asking read every ride
 * there was, with its line: fourteen on 18 November 2026, and one
 * more for every ride Rattatee saves, for ever. **Every read has a price, set
 * before it is written** in CLAUDE.md is why that had to go before the rides
 * did.
 *
 * So each ride is also filed under the squares of the city its line passes
 * through, in `ride_cells`, keyed (cell, created_at, ride). A square is
 * 1/PER_LAT by 1/PER_LNG degrees, about 2.2 km each way at Tallinn's latitude,
 * numbered latitude row × 10000 + longitude column — both positive here, so
 * truncating is flooring and the same number comes out of JavaScript and of
 * SQL, which the rebuild beside the table in db/schema.sql relies on.
 *
 * WHAT A READ COSTS
 *
 * The squares under the box asked about, and in each the newest entries
 * and no more, newest first by the key: a fixed number of rows per
 * square however many rides the city has, then a lookup by id for each ride
 * found. The squares are counted out by SQLite from the box's first and
 * last row and column, which are worked out here — NEWEST says why. Each
 * square is read twice by the key, once to find where its newest entries
 * begin and once to read them, so a square costs about twice its share.
 * Its share is CANDIDATES, or less once ROWS spread over the squares is
 * less, and past MAX_CELLS squares a box is not a way to anywhere and
 * answers no rides. So the worst read is about twice ROWS rows of
 * `ride_cells` and CANDIDATES lookups of `rides`, on day one and on day one
 * thousand: a box of a hundred squares or more. A box across town is
 * nearer twenty squares, forty entries a square, about 1,600 rows.
 *
 * A square is coarser than the box, so a ride whose line meets one of its
 * squares may still miss the box. The ids found are therefore asked of
 * `rides` with the box beside them, newest first, `near` of them: what the
 * routes answered before, less any ride whose box meets the box asked about
 * while its line never comes within a square of it — a ride from one corner
 * of the city to the other has a box over half of it — and less the old
 * rides of a square so busy that CANDIDATES newer ones fill it first.
 *
 * WHEN THE TABLE IS NOT THERE
 *
 * `ride_cells` is in db/schema.sql and loaded by hand, and the rides saved
 * before it are filed by the rebuild written beside it there. Until then a read
 * throws, which ./rides.js already answers as "no rides", and a save files
 * nothing and keeps the ride.
 */

/* The size of a square, in degrees, as the multipliers that make a row and
   a column out of a point: 1/50 of a degree of latitude, 1/25 of longitude. */
const PER_LAT = 50;
const PER_LNG = 25;
const ROW = 10000;

/* The most squares one read will look under, and the most entries of them
   it will read in all. A box the size of the whole city is about 400
   squares; SQLite joins at most 500 SELECTs in one statement. */
const MAX_CELLS = 400;
const ROWS = 4000;

/* How many rides the squares may offer before the box is asked of them,
   and the most entries read under any one square. Forty, because its one
   caller keeps forty — NEAR in ./rides.js, since the ridden way in
   ./route.js reads `ride_sections` instead. It was a hundred, to leave
   room for the rides a square offers that miss the box; that room cost two
   and a half times the rows under every square, for sixty rides nobody
   kept. Now a box whose newest forty include some that miss it answers
   fewer than forty, the price of the cheaper read. */
const CANDIDATES = 40;

export function cellOf(lat, lng) {
  return Math.trunc(lat * PER_LAT) * ROW + Math.trunc(lng * PER_LNG);
}

/* Every square a line's points fall in, once each. The points are a dozen
   metres apart and a square is two kilometres, so no square a line crosses
   is missed between two of them. */
export function cellsOfLine(line) {
  return [...new Set(line.map((p) => cellOf(p[0], p[1])))];
}

/* The rows and columns of squares under a box, or null when that is more
   than MAX_CELLS squares. */
function spanOf(box) {
  const rows = [Math.trunc(box.south * PER_LAT), Math.trunc(box.north * PER_LAT)];
  const cols = [Math.trunc(box.west * PER_LNG), Math.trunc(box.east * PER_LNG)];
  const count = (rows[1] - rows[0] + 1) * (cols[1] - cols[0] + 1);
  return count > 0 && count <= MAX_CELLS ? { rows, cols, count } : null;
}

/* The squares are counted out by SQLite rather than written in: D1 refuses
   a compound SELECT of a few hundred parts ("too many terms"), which is what
   a square a part came to for a big box. For each square, the created_at of
   its `each`-th newest entry is read off the end of the key, and then the
   entries from there on — both by the key, so a square costs about twice
   `each` rows however many rides it holds. The 10000 in it is ROW, written
   out so tools/sqlcheck.mjs can read the statement whole. */
const NEWEST =
  'WITH RECURSIVE r(n) AS (SELECT ?1 UNION ALL SELECT n + 1 FROM r WHERE n < ?2), ' +
  'c(n) AS (SELECT ?3 UNION ALL SELECT n + 1 FROM c WHERE n < ?4), ' +
  's(cell) AS (SELECT r.n * 10000 + c.n FROM r, c) ' +
  'SELECT x.ride AS ride, MAX(x.created_at) AS at FROM s JOIN ride_cells x ON x.cell = s.cell ' +
  'AND x.created_at >= COALESCE((SELECT y.created_at FROM ride_cells y WHERE y.cell = s.cell ' +
  'ORDER BY y.created_at DESC LIMIT 1 OFFSET ?5), 0) ' +
  'GROUP BY x.ride ORDER BY at DESC LIMIT ?6';

/* The newest rides, at most `near`, whose box meets `box` ({ south, west,
   north, east }), with `columns` of each. Throws where either table is not
   there. */
export async function ridesIn(env, box, columns, near) {
  const span = spanOf(box);
  if (!span) return [];
  const each = Math.max(1, Math.min(CANDIDATES, Math.floor(ROWS / span.count)));
  const found = await env.DB
    .prepare(NEWEST)
    .bind(span.rows[0], span.rows[1], span.cols[0], span.cols[1], each - 1, CANDIDATES)
    .all();
  /* Written in rather than bound, for the reason fileCells() gives, and
     held to the shape randomHex() draws before they are. */
  const ids = found.results.map((r) => r.ride).filter((id) => /^[0-9a-f]{12}$/.test(id));
  if (!ids.length) return [];
  const { results } = await env.DB
    .prepare(
      `SELECT ${columns} FROM rides WHERE id IN (${ids.map((id) => `'${id}'`).join(', ')}) ` +
      'AND south <= ? AND north >= ? AND west <= ? AND east >= ? ORDER BY created_at DESC LIMIT ?'
    )
    .bind(box.north, box.south, box.east, box.west, near)
    .all();
  return results;
}

/* A ride's squares, filed — one statement a run, after its row is in. The
   values are written into the statement rather than bound: a forty-
   kilometre ride crosses more squares than D1's hundred bound values hold
   three at a time, and every one of them was made here — a square is a
   number, `createdAt` the save's clock and `id` twelve hex characters from
   randomHex(), which is checked again on the way in. */
export function fileCells(env, id, createdAt, line) {
  if (!/^[0-9a-f]{12}$/.test(id) || !Number.isInteger(createdAt)) throw new Error('ride');
  const cells = cellsOfLine(line);
  return env.DB.prepare(
    'INSERT OR IGNORE INTO ride_cells (cell, created_at, ride) VALUES ' +
    cells.map((c) => `(${c}, ${createdAt}, '${id}')`).join(', ')
  );
}

/* WHAT DELETING AN ACCOUNT TAKES OF ITS RIDES

   Every ride it saved, and the squares each was filed under, by
   idx_rides_user and idx_ride_cells_ride — the statements for
   ./account.js to put in its one batch. A deleted account used to leave its
   rides behind under an id nobody had: their numbers went (forgetStatements
   in ./_ridestats.js) but the way each was ridden stayed, and Rattatee's
   privacy policy had to say so. What a ride added to `ride_sections` stays,
   as a ride saved with no account does: counts of a street, under nobody.

   The squares first, while the rides they name are still there to be found
   by the subquery. Either table may not be in a database yet, and the
   batch is all or nothing, so a statement is offered only for a table that
   answers — asked once per isolate, as postsReady() in ./_posts.js does —
   or a missing table would keep anybody from deleting their account. */
const there = new Map();
async function answers(env, sql) {
  if (there.get(sql)) return true;
  try {
    await env.DB.prepare(sql).first();
    there.set(sql, true);
  } catch (e) {
    there.set(sql, false);
  }
  return there.get(sql);
}

export async function forgetRides(env, userId) {
  if (!(await answers(env, 'SELECT 1 FROM rides LIMIT 1'))) return [];
  const statements = [];
  if (await answers(env, 'SELECT 1 FROM ride_cells LIMIT 1')) {
    statements.push(env.DB
      .prepare('DELETE FROM ride_cells WHERE ride IN (SELECT id FROM rides WHERE user_id = ?)')
      .bind(userId));
  }
  statements.push(env.DB.prepare('DELETE FROM rides WHERE user_id = ?').bind(userId));
  return statements;
}
