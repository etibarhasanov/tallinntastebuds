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
  -- Who the save belongs to: a users.id when the request carried a signed-in
  -- session, otherwise the v4 UUID the browser generated for itself. One
  -- column rather than two, so the primary key below is the whole of the
  -- uniqueness rule and there is no second index that could disagree with it.
  owner      TEXT    NOT NULL,
  -- 'user' or 'device'. Only claim() in account.js reads it, to find the rows
  -- a signing-in browser is bringing with it.
  owner_kind TEXT    NOT NULL DEFAULT 'device',
  -- HMAC(SAVE_SALT, ip + '|' + user agent). The raw address is never stored
  -- and cannot be recovered from this without the salt, which lives only in
  -- the Pages environment.
  ip_hash    TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (place_id, owner)
);

-- The cap's lookup: how many saves this network fingerprint already has on
-- this one place. The primary key cannot serve it — it leads with owner after
-- place_id, and this asks about ip_hash.
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


-- ---------------------------------------------------------------- accounts
-- An account is optional. Saving works without one, filed under the device's
-- own id; signing in moves those rows onto the account so a list can follow a
-- person to another phone. See functions/api/account.js.
--
-- The password is never stored, only a PBKDF2-HMAC-SHA256 derivation of it
-- with its own salt. The iteration count lives on the row rather than in the
-- code so it can be raised later and old rows re-derived on their next
-- successful sign-in, without a migration.
--
-- email is optional and buys exactly one thing: the ability to reset a
-- forgotten password. Nothing else ever sends to it. Without one there is no
-- reset at all — nothing proves an account is yours but knowing its password.
CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  username       TEXT NOT NULL,
  pw_hash        TEXT NOT NULL,
  pw_salt        TEXT NOT NULL,
  pw_iter        INTEGER NOT NULL,
  created_at     INTEGER NOT NULL,
  last_seen_at   INTEGER NOT NULL,
  email          TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username COLLATE NOCASE);
-- Partial, so the many accounts with no address at all do not collide on NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email COLLATE NOCASE) WHERE email IS NOT NULL;

-- Only the SHA-256 of a session token is kept. A leaked copy of this table is
-- a list of hashes rather than a drawer full of working keys.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

-- Six-digit codes, again stored only as hashes, single use and short lived.
-- purpose is 'verify' (confirming an address) or 'recover' (resetting a
-- password). Rows are swept whenever a new code is issued.
CREATE TABLE IF NOT EXISTS email_codes (
  code_hash  TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  email      TEXT NOT NULL,
  purpose    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_codes_user ON email_codes (user_id, purpose);

-- Failed sign-ins, so guessing can be slowed down. Guessing is the only way
-- into an account here — there is no reset link to phish — so this is the
-- thing worth making slow. Rows outside the window are deleted on the way
-- past rather than kept: they can never affect an answer, so holding a record
-- of somebody's failures would be storing it for nothing.
CREATE TABLE IF NOT EXISTS login_fails (
  ip_hash TEXT NOT NULL,
  at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_fails ON login_fails (ip_hash, at);
