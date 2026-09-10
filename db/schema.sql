-- Tallinn Tastebuds — every table the site has.
--
-- Eight things live here: the saves and their counts, the accounts a save can
-- follow a person on, the lists somebody builds and shares, the keeps that are
-- a bookmark on somebody else's list, 1,110 Tallinn venues mirrored out of
-- Google Places, the places somebody adds by hand when the catalogue does not
-- have them, the groups splitting a bill on the splitwise subdomain, and one
-- meta row saying which database this is. Everything the map itself draws —
-- the places, the write-ups, the discounts, the stories — is a JSON file in
-- the repository and never a row.
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

-- "Everything this person saved", which is what the account sheet lists and
-- what signing in has to move across from the device. The primary key cannot
-- serve that either: it leads with place_id, and this asks only about owner.
--
-- This index was live before it was written down. It existed in the production
-- database and in neither this file nor the preview database, which is the
-- shape schema drift takes here — nothing applies this file automatically, so
-- what is deployed and what is described can part company and stay parted
-- until something notices. Both databases have it now.
CREATE INDEX IF NOT EXISTS idx_saves_owner ON saves (owner);

-- The counts, one row per place, maintained by the write that changes them.
--
-- This is not a cache of the table above; it is the answer the map reads, and
-- it exists because the obvious query does not scale. "How many saves has
-- each place got" as COUNT(*) GROUP BY over `saves` costs one row read per
-- save, forever: ten thousand saves is ten thousand rows read to produce
-- seventy-five numbers, on a table that only ever grows. Reading it from here
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
-- There is no address on an account and no reset: nothing proves an account
-- is yours but knowing its password, and a forgotten one is gone for good.
--
-- It had `email` and `email_verified` for a while, with an `email_codes`
-- table beside it, for a password reset that was never switched on. Both
-- databases have been through the ALTERs since, so the seven columns below
-- are the seven columns there are — this file describes what is deployed
-- rather than what is deployed plus three dead things.
--
-- That took a hand-run migration, and it is the reason to notice what this
-- file cannot do: it is applied with IF NOT EXISTS throughout, so it can add
-- a table or an index and can never take a column away. Anything that
-- removes one is an ALTER somebody runs against both databases, and the file
-- is only true again once they have.
CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  username       TEXT NOT NULL,
  pw_hash        TEXT NOT NULL,
  pw_salt        TEXT NOT NULL,
  pw_iter        INTEGER NOT NULL,
  created_at     INTEGER NOT NULL,
  last_seen_at   INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username COLLATE NOCASE);

-- The name an account used to go by, kept for thirty days after it changed.
--
-- A username is a public address: it is the byline on every list somebody
-- wrote and the whole of /u/<name>. So the moment a rename put a name back in
-- the pool, the next person to sign up could take it and inherit every link,
-- screenshot and message pointing at the person who left it. That is the one
-- thing a rename must not be a way to do, and this table is what stops it:
-- for thirty days the name answers to nobody but whoever released it, who may
-- take it back.
--
-- ONE ROW PER ACCOUNT, AND THAT IS THE WHOLE OF THE DESIGN
--
-- The row is replaced on each rename rather than added to, so the name held
-- is the one you were last known by and never a chain of them. A history
-- would let somebody rename their way down a list of names they fancied and
-- hold every one of them for a month, which is squatting with extra steps;
-- one row means a rename releases as many names as it holds. It also means
-- this table can never grow past the users table, so nothing has to prune it
-- by size.
--
-- Rows outside the window are deleted on the way past, the way login_fails is
-- swept: they can never affect an answer, so keeping them would be storing a
-- record of what somebody used to be called for nothing at all.
CREATE TABLE IF NOT EXISTS username_holds (
  -- users.id, and the primary key: one hold per account, replaced each time.
  user_id     TEXT PRIMARY KEY,
  -- The name that was released. Lowercase, like every username here.
  username    TEXT NOT NULL,
  released_at INTEGER NOT NULL
);
-- "Is this name still spoken for", which is the only question asked of it.
CREATE INDEX IF NOT EXISTS idx_username_holds_name ON username_holds (username COLLATE NOCASE);

-- Only the SHA-256 of a session token is kept. A leaked copy of this table is
-- a list of hashes rather than a drawer full of working keys.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

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
-- The map is mine — seventy-five places I have been to, in
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
-- /lists/public, which reads every public list and puts the most kept first.
-- This index is what narrows that to the public ones. The order itself is a
-- count over list_keeps, which no index on this table can reach, so the
-- tie-break between two lists kept by the same number of people is the only
-- part of the sort this half serves.
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
  -- A data/places.json id or a google_venues.place_id — the two rolls the
  -- picker offers, and they cannot be confused: a catalogue id is a lowercase
  -- slug and a Google key always carries capitals. Checked against both before
  -- it is written, so a row here pointed at somewhere real on the day it was
  -- made.
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


-- One row is one person keeping one list: a bookmark on somebody else's top
-- ten, the way a save is a bookmark on a place.
--
-- WHY THIS ONE NEEDS AN ACCOUNT WHEN A SAVE DOES NOT
--
-- A save is filed under whatever the browser calls itself, because it has to
-- work in the first ten seconds, before anybody has decided anything. What it
-- buys is one bookmark on one restaurant, and losing it to a cleared browser
-- costs the view of your own marks and not the marks themselves.
--
-- A kept list is the other shape of thing. It is somebody else's page, held
-- because you mean to go back to it — often weeks later, usually on the phone
-- you were not holding when you found it. A device-owned keep would be one
-- Safari sweep away from a collection nobody can get back to, and there is no
-- link in a browser's history for a list read once on a laptop. So the owner
-- is always a users.id, never a device, and the one thing you must have before
-- you can keep a list is the same account that lets you make one.
--
-- Enforced here as well as in the Function: owner_kind does not exist on this
-- table, and there is no statement in functions/api/lists.js that can write a
-- row without a session behind it.
CREATE TABLE IF NOT EXISTS list_keeps (
  -- lists.id. Only ever a public list: a private one is not served to anybody
  -- but its owner, so there is nothing to keep.
  list_id    TEXT    NOT NULL,
  -- users.id. Never a device. See above.
  owner      TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  -- One person keeps one list once. Pressing the mark twice is the conflict
  -- clause and not a second row, exactly as a save is — which is what makes
  -- the count below a count of people rather than a count of presses.
  PRIMARY KEY (list_id, owner)
);

-- "Every list this account kept, newest first", which is the whole of the
-- second section on /lists.html. The primary key cannot serve it: it leads
-- with list_id, and this asks only about owner.
CREATE INDEX IF NOT EXISTS idx_list_keeps_owner ON list_keeps (owner, created_at DESC);

-- HOW MANY PEOPLE KEPT ONE LIST is counted off this table every time it is
-- asked, and there is deliberately no counts table here of the kind
-- save_counts is.
--
-- /lists/public asks it of every public list at once, which is the bulk
-- question an earlier version of this note said would call for one. It was
-- built with a counts table and the table was taken out again, because the
-- comparison the note was making does not hold. save_counts exists because the
-- map asks for seventy-five numbers on every load, over a table that grows
-- with every anonymous save from every visitor. A keep needs an account, one
-- account can hold two hundred of them, and one page asks. Counting is one row
-- read per keep in the database, and the page reads twenty rows.
--
-- What a counts table costs, against that, is a migration and a backfill run
-- by hand on a live database with no backup in this repository, plus a second
-- place for the same number to live and a way for the two to disagree. That is
-- a real cost today against a hypothetical one later.
--
-- The day it stops being cheap — enough keeps that the GROUP BY in
-- functions/api/_mostkept.js shows up in a query time — is the day to write
-- one, and it should be written the way save_counts is: recomputed from this
-- table inside the batch that changes it, never nudged by one.
--
-- One more thing reads these, and it is the same question narrowed rather than
-- a new one: a profile at /u/<name> sums the keeps of one person's public
-- lists, at most twenty-four of them and one indexed prefix of this key each.
-- See functions/api/_profile.js. What it deliberately does not print is a
-- position — "third of everybody" is the GROUP BY above with nothing to narrow
-- it — so it moves the day above no nearer.




-- ------------------------------------------------------------ added places
-- A place somebody added by hand, because the catalogue does not have it.
--
-- data/places.json is my map plus a Google Maps export, and between them they
-- miss things: somewhere that opened last month, somewhere Google files as not
-- a restaurant, somewhere nobody has exported since. A list can only hold what
-- is in that file, so "the place I want is not in the picker" used to have no
-- answer. This table is the answer.
--
-- It is deliberately NOT the map. data/restaurants.json is hand-written and
-- mine, and being on it is the verdict. A row here is somebody saying "this
-- exists and I want it on my list", which is a much smaller claim — the same
-- separation google_venues keeps, for the same reason.
--
-- WHO SEES ONE
--
-- Its author, in their own picker, so they can put it on a second list without
-- adding it twice. Nobody else's picker changes: a name a stranger typed does
-- not turn up in other people's search results, which is the moderation
-- surface this does not open.
--
-- But it is not private either, and that is the point of it. It goes on a
-- list, the list gets shared, and anybody who opens that list sees the place
-- and its pin exactly like every other place on it — see readList() in
-- functions/api/_lists.js, which fills a list row from here when the catalogue
-- does not have it, and seatList() in assets/app.js, which draws it.
--
-- WHY THE ID LOOKS LIKE THAT
--
-- list_items.place_id holds three kinds of id now, and they have to be
-- tellable apart by looking, because that column is the only thing that says
-- which roll to go and read:
--
--   catalogue   180-degrees                   lowercase, digits and hyphens
--   Google      ChIJUdUjCV2TkkYRcg8TxVp1XUI   always carries a capital
--   added here  new_k3fmqw8x2p                lowercase, and has an underscore
--
-- Both halves are needed, and the numbers say so rather than the intent:
-- all 75 catalogue ids are lowercase with no underscore, 215 of the 1,110
-- Google keys DO contain an underscore, and none of the 1,110 is all-lowercase.
-- So the underscore alone would misread 215 real places, and lowercase alone
-- would not separate one from a catalogue slug; together they match nothing on
-- either roll. The prefix is what a person reads; isAdded() in
-- functions/api/_lib.js is what the code checks, and it carries the query to
-- re-run that count if google_venues is ever re-synced.
CREATE TABLE IF NOT EXISTS added_places (
  -- What list_items.place_id holds for this place. "new_" and ten random
  -- characters — see above for why that shape and not another.
  id         TEXT PRIMARY KEY,
  -- users.id — who added it. An account, by the same argument a list needs
  -- one: this is somebody putting a name into the world, not a bookmark.
  owner      TEXT    NOT NULL,
  name       TEXT    NOT NULL,
  -- Required, both, and that is the one thing the shape decides for you: a
  -- place with no point cannot be drawn, and being drawn on the map with the
  -- rest of the list is most of why anybody adds one. The form asks for the
  -- pin by making somebody drag it, so there is no such thing as a row here
  -- that does not know where it is.
  lat        REAL    NOT NULL,
  lng        REAL    NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  -- Added after the table was: every other place on a list carries an address
  -- that the panel draws and the map's stand-in card shows, and a place added
  -- by hand should not be the one row that reads as half a place. Optional,
  -- because a pin is the part that cannot be missing and a street name is not.
  --
  -- Applied to the live databases with ALTER TABLE ADD COLUMN rather than by
  -- rebuilding the table. Both are listed here in the order the columns
  -- actually sit in, so this file describes what is deployed rather than what
  -- would be tidiest.
  address    TEXT    NOT NULL DEFAULT ''
);
-- "Everything this person added", which is what the picker asks for.
CREATE INDEX IF NOT EXISTS idx_added_places_owner ON added_places (owner, created_at DESC);


-- ----------------------------------------------------------- google venues
-- Every place in Tallinn you can eat or drink in, out of the Google Places
-- API. 1,110 of them.
--
-- "venues" rather than "places" because the site already has two files with
-- "places" in the name and this is a third thing; "google_" because the rows
-- are Google's and the name should say so before anybody edits one.
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
-- Loaded and refreshed by tools/googlevenues.mjs, which writes
-- db/google-venues.sql out of exports/tallinn_restaurants.csv:
--
--   node tools/googlevenues.mjs
--   wrangler d1 execute tallinntastebuds         --remote --file=db/google-venues.sql
--   wrangler d1 execute tallinntastebuds-preview --remote --file=db/google-venues.sql
CREATE TABLE IF NOT EXISTS google_venues (
  -- Google's own key — "ChIJUdUjCV2TkkYRcg8TxVp1XUI". Unique across all
  -- 1,110, stable across refreshes, and what the raw 44-column export joins
  -- on. It is the primary key because it is the only identifier here that
  -- Google guarantees; anything this file invented would drift the first time
  -- a name changed.
  --
  -- Anything that later points at one of these venues stores this string. A
  -- slug from data/restaurants.json is lowercase letters, digits and hyphens
  -- and a Google key always carries capitals, so a single column can hold
  -- either kind without a prefix and without ever being ambiguous.  --
  -- It is also what a list item holds when it points at one of these; see
  -- list_items.place_id.
  place_id      TEXT PRIMARY KEY,

  -- --------------------------------------------------- Google's, overwritten
  name          TEXT    NOT NULL,
  -- Google's venue label: "Restaurant", "Sushi Restaurant", "Bistro".
  category      TEXT    NOT NULL DEFAULT '',
  -- Derived and grouped by the export so it is filterable — sushi, ramen and
  -- izakaya all become "Japanese". Empty on 692 of the 1,110.
  cuisine       TEXT    NOT NULL DEFAULT '',
  -- 2.2 to 5.0, and the review count it rests on. Shown only where the place is
  -- Google's and the number is said to be Google's — the card the map draws for
  -- a place off this export, and the rows that lead to it, print both behind
  -- "According to Google". No place on my map has a score; the only things that
  -- sort by one are /google, which says it is Google's order, and the five
  -- lists under the `google` account, which db/google-lists.sql writes from
  -- the same export. They are also what decides which of these are worth
  -- promoting onto the map.
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
  -- "Tallinn" on 1,086 rows; the other twenty-four are Haabneeme, Peetri,
  -- Viimsi and Miiduranna, just over the city line.
  city          TEXT    NOT NULL DEFAULT '',
  phone         TEXT    NOT NULL DEFAULT '',
  website       TEXT    NOT NULL DEFAULT '',
  -- One line, 24-hour, semicolons between days: "Mon 11:00-22:00; Sat closed".
  -- The raw export had real newlines in this field, which is why it was 7,309
  -- physical lines for 1,110 records. See exports/README.md.
  opening_hours TEXT    NOT NULL DEFAULT '',
  -- The remaining Google type tags, semicolon separated.
  tags          TEXT    NOT NULL DEFAULT '',
  latitude      REAL,
  longitude     REAL,
  maps_url      TEXT    NOT NULL DEFAULT '',

  -- ------------------------------------------------- mine, never overwritten
  -- The data/restaurants.json id, when this is also a place on my map. 60 of
  -- the 1,110 are. It is what lets a list row pointing at a Google place link
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
CREATE INDEX IF NOT EXISTS idx_google_venues_rating ON google_venues (rating DESC, reviews DESC);
-- The 60 that are already on the map, and the ones still to be looked at.
CREATE INDEX IF NOT EXISTS idx_google_venues_map ON google_venues (map_id) WHERE map_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_google_venues_open ON google_venues (hidden, status);


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


-- -------------------------------------------------------------- splitwise
-- Five people, one card at the table, and the argument afterwards.
--
-- These five tables are the whole of splitwise.tallinntastebuds.ee: a group
-- somebody named, the people who joined it by the link, what each of them
-- paid for, how that was divided, and the money handed back afterwards. It is
-- the only feature on this site that is not about restaurants, and it is here
-- because it is the thing that happens immediately after one — see
-- **Splitwise** in README.md, and functions/api/split.js, which is the only
-- thing that writes any of these.
--
-- IT IS THE SAME ACCOUNT AS THE MAP, AND THAT IS THE POINT
--
-- There is no second users table and no second sign-in. A member is a
-- users.id, minted by functions/api/account.js from the same two fields the
-- map's sheet asks for, and somebody who saves places is already somebody who
-- can be owed eleven euros. The subdomain is a room in the same house, not a
-- second house; what makes it work across the two hostnames is one line in
-- sessionCookie() in functions/api/_lib.js, which scopes the session cookie
-- to the domain rather than to the host.
--
-- EVERY AMOUNT IS AN INTEGER NUMBER OF CENTS
--
-- Never a REAL. Money in a float is the bug that takes a year to show up: a
-- 33.33 that is really 33.329999999999998, three of them summed against a
-- 100.00 that is exact, and a group that is one cent from even forever with
-- nobody able to say which cent. SQLite would happily store either; this
-- stores 3333, and the division below is integer division with the remainder
-- handed out rather than dropped.
--
-- Euros, and only euros. The city has one currency and a column that could
-- hold another would be a column every sum here would have to start caring
-- about.
CREATE TABLE IF NOT EXISTS split_groups (
  -- The invitation, and the whole of the URL: /split?join=<id>. Minted from
  -- the name plus six random characters exactly as a list's id is, so a link
  -- says what it is before anybody opens it and still cannot be guessed at
  -- from a neighbouring one. Guessing it is the only way in — there is no
  -- request-to-join and no approval — so it has to be unguessable.
  id         TEXT    PRIMARY KEY,
  name       TEXT    NOT NULL,
  -- users.id. Who made it, and the only person who can rename or delete it.
  -- They are also a row in split_members: being the owner is a fact about
  -- the group, being a member is what puts you in the arithmetic.
  owner      TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  -- Touched by every expense and every settlement, so "your groups, the one
  -- you were last splitting first" is one indexed read.
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_split_groups_owner ON split_groups (owner, updated_at DESC);

-- One row is one person in one group.
--
-- There is no username column here, and that is a deliberate difference from
-- list_items, which does copy the name it was added under. A list item points
-- at a place in a generated file that a refresh can renumber, so the name is
-- copied or the sentence somebody wrote ends up attached to nothing. A member
-- points at a users row, so the join is exact and stays exact: an account can
-- be renamed — see username_holds above — and everybody in every group it is
-- in reads the new name on their next load, because there is no second copy
-- of it to go stale. A username column here would be that copy.
CREATE TABLE IF NOT EXISTS split_members (
  group_id  TEXT    NOT NULL,
  user_id   TEXT    NOT NULL,
  joined_at INTEGER NOT NULL,
  -- Opening the link twice is the conflict clause and not a second seat.
  PRIMARY KEY (group_id, user_id)
);
-- "The groups this person is in", which is the whole of the front page.
CREATE INDEX IF NOT EXISTS idx_split_members_user ON split_members (user_id, joined_at DESC);

-- One row is one thing somebody paid for: the bill, the taxi, the wine.
CREATE TABLE IF NOT EXISTS split_expenses (
  id         TEXT    PRIMARY KEY,
  group_id   TEXT    NOT NULL,
  -- users.id — whose card it was. Not necessarily whoever typed it in: the
  -- person holding the phone puts in what the person across the table paid,
  -- which is most of how this gets filled in at all.
  payer      TEXT    NOT NULL,
  -- "Dinner", "the taxi back". Capped at MAX_WHAT in the Function.
  what       TEXT    NOT NULL,
  -- Euro cents, always positive. See the note above about floats.
  cents      INTEGER NOT NULL,
  -- users.id — who put the row in. Kept because they are the one person
  -- besides the payer allowed to take it out again.
  added_by   TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_split_expenses_group ON split_expenses (group_id, created_at DESC);

-- How one expense was divided, one row per person it was divided between.
--
-- WHY THE SHARES ARE STORED AND NOT COMPUTED
--
-- The obvious version divides the total by the number of members at read
-- time. It is wrong twice. A group's membership changes — somebody joins on
-- Sunday and would retroactively owe a third of Friday's dinner — and an
-- equal division of 10.00 between three people is 3.33 three times, which is
-- 9.99, so the arithmetic quietly loses a cent every time it runs.
--
-- So the division is done once, when the expense is entered, against the
-- members as they stand at that moment; the remainder cents are handed to
-- the first few members in id order so the shares always sum to exactly the
-- total; and the answer is written down. What a group owes is then a sum of
-- integers over rows that cannot change, rather than an opinion recalculated
-- against today's membership.
CREATE TABLE IF NOT EXISTS split_shares (
  expense_id TEXT    NOT NULL,
  user_id    TEXT    NOT NULL,
  cents      INTEGER NOT NULL,
  PRIMARY KEY (expense_id, user_id)
);

-- One row is money actually handed over: "I sent you the eleven euros."
--
-- Deliberately not an expense with a negative amount, which is how this is
-- often done and which makes every sum in the file have to know the
-- difference. A settlement moves a debt and buys nothing, so it is its own
-- table and its own line in the balance.
CREATE TABLE IF NOT EXISTS split_settlements (
  id         TEXT    PRIMARY KEY,
  group_id   TEXT    NOT NULL,
  -- users.id, both: who handed it over and who took it.
  payer      TEXT    NOT NULL,
  payee      TEXT    NOT NULL,
  cents      INTEGER NOT NULL,
  -- users.id — who recorded it. Either end of the payment may, and either
  -- end may take it back off again.
  added_by   TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_split_settlements_group ON split_settlements (group_id, created_at DESC);
