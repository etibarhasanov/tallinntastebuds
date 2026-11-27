-- Tallinn Tastebuds — ride_blocks filled from ride_sections.
--
-- ride_blocks (db/schema.sql) is what the rides say about each block of the
-- city, eight squares by eight, one way across it. From the day it is
-- applied every save counts a ride into it, just after its squares. The
-- rides before that are in ride_sections and nowhere else — a ride saved
-- with no account was counted and not kept — so the blocks are made out of
-- the squares rather than out of `rides`:
--
--   wrangler d1 execute tallinntastebuds --remote --file=db/schema.sql
--   wrangler d1 execute tallinntastebuds --remote --file=db/ride-blocks.sql
--
-- It can run at any time and more than once. The squares hold every ride
-- there is, the ones counted since the blocks began too, so a block made
-- out of them today is whole, and where a block is already there its row
-- is written over with the one made here. On 2026-11-27 the blocks two
-- rides or more had crossed, 381 of 1,390, were put in by hand from a
-- session, a hundred rows a write; this file is what brings the rest. It
-- reads ride_sections twice over, about 12,600 rows that day, and writes a
-- row a block and way.
--
-- A block made of squares is near what counting its rides would have made,
-- and not the same. A ride is one in `rides` however many of a block's
-- squares it crossed, and the squares do not say which rides they share, so
-- a block's `rides` and `timed` are its busiest square's: right where one
-- street runs through the block, short where two streets nobody rides both
-- of do. The sums of metres, seconds and stops are exact. `steady` and
-- `slow` are the block's timed rides times the share of the squares' timed
-- crossings that were steady or slow. As rides are counted into the blocks
-- themselves these fade like any other — A SQUARE TAKES FIFTY RIDES, THEN
-- ONE IN TEN, AND FORGETS in functions/api/_sections.js. Writing a block
-- over is right while no block has counted fifty rides; past that a block
-- remembers less than its squares add up to, and this would undo it.
--
-- A square's key is `row:column:way`. A key with no way is from before
-- 2026-11-19, is read by nothing, and is left out. Rows and columns are
-- positive across Estonia, so SQLite's integer division rounds them down.

INSERT INTO ride_blocks (block, rides, meters, timed, paced, seconds, steady, slow, stops, updated_at)
SELECT
  block,
  MAX(rides),
  SUM(meters),
  MAX(timed),
  SUM(paced),
  SUM(seconds),
  CASE WHEN SUM(timed) > 0 THEN MAX(timed) * SUM(steady) / SUM(timed) ELSE 0 END,
  CASE WHEN SUM(timed) > 0 THEN MAX(timed) * SUM(slow) / SUM(timed) ELSE 0 END,
  SUM(stops),
  MAX(updated_at)
FROM (
  SELECT
    (CAST(substr(cell, 1, instr(cell, ':') - 1) AS INTEGER) / 8) || ':' ||
    (CAST(substr(rest, 1, instr(rest, ':') - 1) AS INTEGER) / 8) || ':' ||
    substr(rest, instr(rest, ':') + 1) AS block,
    rides, meters, timed, paced, seconds, steady, slow, stops, updated_at
  FROM (SELECT ride_sections.*, substr(cell, instr(cell, ':') + 1) AS rest FROM ride_sections)
  WHERE instr(rest, ':') > 0
)
WHERE true
GROUP BY block
ON CONFLICT (block) DO UPDATE SET
  rides = excluded.rides, meters = excluded.meters, timed = excluded.timed, paced = excluded.paced,
  seconds = excluded.seconds, steady = excluded.steady, slow = excluded.slow, stops = excluded.stops,
  updated_at = excluded.updated_at;
