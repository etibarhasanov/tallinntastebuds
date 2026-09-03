-- Tallinn Tastebuds — every table the site has.
--
-- Five things live here: the saves and their counts, the accounts a save can
-- follow a person on, the lists somebody builds and shares, 750 Tallinn
-- restaurants mirrored out of Google Places, and one meta row saying which
-- database this is. Everything the map itself draws — the places, the
-- write-ups, the discounts, the stories — is a JSON file in the repository and
-- never a row.
--
-- Applied to both D1 databases — "tallinntastebuds" behind the live site and
-- "tallinntastebuds-preview" behind every preview deployment. They hold the
-- same tables and never the same rows; see the meta table at the bottom of
-- this file for what keeps them apart. Re-runnable: every statement is IF NOT
-- EXISTS, so this file is the schema rather than a migration you have to
-- remember whether you ran.
--
--   wrangler d1 execute tallinntastebuds         --remote --file=db/schema.sql
--   wrangler d1 execute tallinntastebuds-preview --remote --file=db/schema.sql
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


-- ------------------------------------------------------------------- lists
-- Somebody else's top ten.
--
-- The map is mine — seventy-four places I have been to, in
-- data/restaurants.json, and nothing a visitor does changes it. A list is the
-- other thing: a name somebody chose, a handful of places they picked out of
-- data/places.json, and a sentence about each. "Top ten burgers." "Where to
-- take your parents." It is theirs, it carries their username, and it has a
-- link they can send to somebody.
--
-- An account is required to make one, and that is a deliberate difference
-- from a save. A save is anonymous and belongs to a device because it has to
-- work before anybody has decided anything; a list is published under a name,
-- so there has to be a name. See functions/api/lists.js.
CREATE TABLE IF NOT EXISTS lists (
  -- The share code, and the whole of the URL: /list/<id>. Minted from the
  -- title plus random characters, so it reads as what it is when it is
  -- pasted somewhere and still cannot be guessed at from a neighbouring one.
  id         TEXT    PRIMARY KEY,
  -- users.id. Never a device: a list needs an account.
  owner      TEXT    NOT NULL,
  title      TEXT    NOT NULL,
  -- A line under the title, optional, saying what the list is for.
  intro      TEXT    NOT NULL DEFAULT '',
  -- 1 = anybody holding the link can read it, which is what sharing means
  -- here. 0 = only its owner. There is no third state and no per-person
  -- sharing: a link either opens or it does not.
  public     INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
-- "My lists, newest first", which is the whole of the index page.
CREATE INDEX IF NOT EXISTS idx_lists_owner ON lists (owner, updated_at DESC);
-- The directory of public lists, when there is one. Nothing reads it yet.
CREATE INDEX IF NOT EXISTS idx_lists_public ON lists (public, updated_at DESC);

-- One row is one place on one list, with what its owner said about it.
--
-- WHY THE NAME IS STORED HERE AS WELL AS IN THE CATALOGUE
--
-- place_id points into data/places.json, which is generated from a CSV export
-- and will be rebuilt — with corrections, with more places, with a row that
-- turns out to have closed. tools/places.mjs works hard to keep an id stable
-- across that, and warns when one goes anyway, but "works hard" is not
-- "cannot happen".
--
-- A save that loses its place is a filled bookmark that stops being drawn.
-- A list that loses one is a sentence somebody wrote about a restaurant,
-- attached to nothing. So the name the place was added under is copied onto
-- the row, and a list renders whole from this table alone: the catalogue is
-- consulted for today's address and for the link back to the map, and its
-- absence costs those two things rather than the entry.
CREATE TABLE IF NOT EXISTS list_items (
  list_id    TEXT    NOT NULL,
  -- data/places.json id. Checked against that file before it is written, so a
  -- row here pointed at somewhere real on the day it was made.
  place_id   TEXT    NOT NULL,
  -- The name at the moment it was added. See above.
  name       TEXT    NOT NULL,
  -- What its owner has to say about it. The point of the whole feature.
  say        TEXT    NOT NULL DEFAULT '',
  -- Position in the list, from 0. Not a rank anybody scores: it is the order
  -- they dragged it into, and a "top ten" is a list whose owner cared about
  -- the order.
  pos        INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  -- One place appears on one list once. Pressing add twice is the conflict
  -- clause and not a second row, the same way a save is.
  PRIMARY KEY (list_id, place_id)
);
-- Reading a list in its own order. The primary key leads with list_id but
-- then sorts by place, which is not an order anybody chose.
CREATE INDEX IF NOT EXISTS idx_list_items_pos ON list_items (list_id, pos);


-- ----------------------------------------------------------- google places
-- Every restaurant in Tallinn, out of Google Places. 750 of them.
--
-- THIS IS A MIRROR, AND THAT IS THE WHOLE RULE
--
-- The columns below the first divider are Google's. They carry the names the
-- export gave them, in the order the export gives them, and a refresh
-- overwrites every one of them without asking. Do not hand-edit them: your
-- correction would survive exactly until the next sync and then vanish, which
-- is the worst way to lose work.
--
-- The columns below the second divider are mine. A refresh never touches
-- them. That separation is the only thing standing between "we synced the
-- export" and "we lost an afternoon of curation".
--
-- If a name or an address is wrong and it matters, the answer is to promote
-- the place onto the map — data/restaurants.json is hand-written and mine —
-- rather than to correct a mirror that is not.
--
-- Loaded and refreshed by tools/googleplaces.mjs, which writes
-- db/google-places.sql out of exports/tallinn_restaurants.csv:
--
--   node tools/googleplaces.mjs
--   wrangler d1 execute tallinntastebuds         --remote --file=db/google-places.sql
--   wrangler d1 execute tallinntastebuds-preview --remote --file=db/google-places.sql
CREATE TABLE IF NOT EXISTS google_places (
  -- Google's own key — "ChIJUdUjCV2TkkYRcg8TxVp1XUI". Unique across all 750,
  -- stable across refreshes, and what the raw 44-column export joins on. It is
  -- the primary key because it is the only identifier here that Google
  -- guarantees; anything this file invented would drift the first time a name
  -- changed.
  --
  -- It is also what a list item holds when it points at one of these. A
  -- catalogue slug is lowercase letters, digits and hyphens, so the two can
  -- never be mistaken for each other — see list_items.place_id.
  place_id      TEXT PRIMARY KEY,

  -- --------------------------------------------------- Google's, overwritten
  name          TEXT    NOT NULL,
  -- Google's venue label: "Restaurant", "Sushi Restaurant", "Bistro".
  category      TEXT    NOT NULL DEFAULT '',
  -- Derived and grouped by the export so it is filterable — sushi, ramen and
  -- izakaya all become "Japanese". Empty on 367 of the 750.
  cuisine       TEXT    NOT NULL DEFAULT '',
  -- 2.2 to 5.0, and the review count it rests on. Neither is ever shown on the
  -- map: there are no scores on this site. They are here to help decide which
  -- places are worth promoting, and for nothing else.
  rating        REAL,
  reviews       INTEGER,
  -- Google's own scale, "$" to "$$$$", kept verbatim rather than converted to
  -- the map's 1-4. Converting on the way in would mean storing an opinion in a
  -- mirror; it is one line wherever it is actually needed.
  price         TEXT    NOT NULL DEFAULT '',
  -- "Open" or "Temporarily closed".
  status        TEXT    NOT NULL DEFAULT '',
  address       TEXT    NOT NULL DEFAULT '',
  postal_code   TEXT    NOT NULL DEFAULT '',
  -- "Tallinn" on 744 rows and "Peetri" on six.
  city          TEXT    NOT NULL DEFAULT '',
  phone         TEXT    NOT NULL DEFAULT '',
  website       TEXT    NOT NULL DEFAULT '',
  -- One line, 24-hour, semicolons between days: "Mon 11:00-22:00; Sat closed".
  -- The raw export had real newlines in this field, which is why it was 4,945
  -- physical lines for 750 records. See exports/README.md.
  opening_hours TEXT    NOT NULL DEFAULT '',
  -- The remaining Google type tags, semicolon separated.
  tags          TEXT    NOT NULL DEFAULT '',
  latitude      REAL,
  longitude     REAL,
  maps_url      TEXT    NOT NULL DEFAULT '',

  -- ------------------------------------------------- mine, never overwritten
  -- The data/restaurants.json id, when this is also a place on my map. 32 of
  -- the 750 are. It is what lets a list row pointing at a Google place link
  -- through to a write-up instead of out to Google.
  map_id        TEXT,
  -- Keep it out of the picker. For a duplicate, a car park that Google thinks
  -- is a restaurant, or anything else that should not be offered.
  hidden        INTEGER NOT NULL DEFAULT 0,
  -- A line to yourself while working through them.
  note          TEXT    NOT NULL DEFAULT '',

  -- ------------------------------------------------------------ bookkeeping
  first_seen_at INTEGER NOT NULL,
  synced_at     INTEGER NOT NULL,
  -- Set when a refresh no longer carries this place — it closed for good, or
  -- Google stopped returning it. Never deleted, because a list may be pointing
  -- at it and somebody wrote a sentence about it.
  missing_since INTEGER
);

-- Best-first, which is the order the export itself is sorted in and the order
-- worth reviewing them in.
CREATE INDEX IF NOT EXISTS idx_google_rating ON google_places (rating DESC, reviews DESC);
-- The 32 that are already on the map, and the ones still to be looked at.
CREATE INDEX IF NOT EXISTS idx_google_map ON google_places (map_id) WHERE map_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_google_open ON google_places (hidden, status);


-- ------------------------------------------------------------------- meta
-- Which database this is. One row, written once, and the only thing in here
-- that is not the same in every copy of this schema.
--
-- There are two of these databases — `tallinntastebuds` behind the live site
-- and `tallinntastebuds-preview` behind every preview deployment — and the
-- one thing that must never happen is a preview writing into the live one.
-- wrangler.toml is what keeps them apart, and this row is what notices when
-- it has not: every deployment carries an ENVIRONMENT variable, this row says
-- what the database it is holding was stamped as, and functions/api/_lib.js
-- compares the two and shuts the API down when they disagree. A test save
-- then fails loudly instead of landing quietly in production.
--
-- Not created with a value, because the value differs per database. Stamp
-- each one after applying this file:
--
--   wrangler d1 execute tallinntastebuds --remote --command \
--     "INSERT INTO meta (key, value) VALUES ('environment', 'production') \
--      ON CONFLICT(key) DO UPDATE SET value = excluded.value"
--
--   wrangler d1 execute tallinntastebuds-preview --remote --command \
--     "INSERT INTO meta (key, value) VALUES ('environment', 'preview') \
--      ON CONFLICT(key) DO UPDATE SET value = excluded.value"
--
-- An unstamped database is not blocked — the check cannot tell what it is
-- looking at, and refusing to run because a row is missing would be a worse
-- failure than the one it guards against. It only ever blocks a disagreement.
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
