-- Tallinn Tastebuds — ride_blocks filled once from ride_sections.
--
-- ride_blocks (db/schema.sql) is what the rides say about each block of the
-- city, eight squares by eight, one way across it. From the day it is
-- applied every save counts a ride into it, just after its squares. The
-- rides before that are in ride_sections and nowhere else — a ride saved
-- with no account was counted and not kept — so the blocks are made out of
-- the squares rather than out of `rides`, and this runs once, after the
-- table is created and BEFORE the code that fills it is deployed:
--
--   wrangler d1 execute tallinntastebuds --remote --file=db/schema.sql
--   wrangler d1 execute tallinntastebuds --remote --file=db/ride-blocks.sql
--
-- It is a plain INSERT, so a second run, or a run after saves have started
-- counting blocks, stops on the first block already there and changes
-- nothing. It reads ride_sections once, about 6,300 rows on 2026-11-27, and
-- writes a row a block and way — a few hundred.
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
-- ONE IN TEN, AND FORGETS in functions/api/_sections.js.
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
GROUP BY block;
