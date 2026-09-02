-- Tallinn Tastebuds — the saves table.
--
-- Applied to the D1 database named "tallinntastebuds". Re-runnable: every
-- statement is IF NOT EXISTS, so this file is the schema rather than a
-- migration you have to remember whether you ran.
--
--   wrangler d1 execute tallinntastebuds --remote --file=db/schema.sql
--
-- One row is one save. The primary key is what makes a save unique rather
-- than any code in the Function: a browser that sends the same (place,
-- client) twice hits the conflict and the second write is a no-op, whatever
-- the caller intended.
CREATE TABLE IF NOT EXISTS saves (
  -- The place's id from data/restaurants.json. Checked against that file by
  -- the Function before anything reaches this table, so a row here always
  -- points at somewhere real.
  place_id   TEXT    NOT NULL,
  -- A v4 UUID the browser generated for itself and keeps in localStorage.
  -- Not proof of a person: it is what stops an honest double-tap and what
  -- lets somebody withdraw their own save.
  client_id  TEXT    NOT NULL,
  -- HMAC(SAVE_SALT, ip + '|' + user agent). The raw address is never stored
  -- and cannot be recovered from this without the salt, which lives only in
  -- the Pages environment.
  ip_hash    TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (place_id, client_id)
);

-- The cap's lookup: how many saves this network fingerprint already has on
-- this one place. The primary key cannot serve it — it leads with client_id
-- after place_id, and this asks about ip_hash.
CREATE INDEX IF NOT EXISTS idx_saves_ip ON saves (place_id, ip_hash);

-- The counts, one row per place, maintained by the write that changes them.
--
-- This is not a cache of the table above; it is the answer the map reads, and
-- it exists because the obvious query does not scale. "How many saves has
-- each place got" as COUNT(*) GROUP BY over `saves` costs one row read per
-- save, forever: ten thousand saves is ten thousand rows read to produce
-- seventy-four numbers, on a table that only ever grows. Reading it from here
-- costs one row per place on the map and never more, however popular the map
-- gets.
--
-- functions/api/saves.js recomputes the row from `saves` inside the same
-- batch — one transaction — as every insert and delete, so the two can never
-- disagree. It is deliberately not a +1/-1: an increment that ran when the
-- insert had quietly hit the conflict clause would drift, and nothing would
-- ever notice.
CREATE TABLE IF NOT EXISTS save_counts (
  place_id TEXT    PRIMARY KEY,
  n        INTEGER NOT NULL DEFAULT 0
);

-- Rebuild every count from the saves table. Not needed in normal running —
-- the writes keep it true — but this is what to run if the two are ever
-- suspected of having come apart, and it is safe at any time.
--
--   INSERT INTO save_counts (place_id, n)
--     SELECT place_id, COUNT(*) FROM saves GROUP BY place_id
--     ON CONFLICT(place_id) DO UPDATE SET n = excluded.n;
