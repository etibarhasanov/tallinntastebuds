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
