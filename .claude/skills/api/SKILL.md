---
name: api
description: Change a Cloudflare Function, db/schema.sql, wrangler.toml, or anything that reads or writes the D1 database.
---

# Change a Function or the database

Everything under `functions/`, `db/schema.sql` and `wrangler.toml`. The
Functions run on the Workers runtime against a D1 database whose rows are
other people's, so this is the one process with steps that cannot be undone,
and the one where a mistake is quiet: the map still draws, and nobody notices
for weeks.

`.claude/rules/leave-it-better.md` loads itself when you open a file here.
Most of the routes and the modules behind them are over the ~600-line mark
(`wc -l functions/api/*.js functions/api/admin/*.js` is the current answer,
and a list written here was wrong within the week), so the reach in those is
the functions you touch plus what they call and what calls them.

## Read first

- The README section for the feature: **Saves**, **Accounts**, **The
  account page**, **Lists**, **Profiles**, **Google venues**, **The
  directory**, **The pins**, **Ask for somewhere**. Each says what is cached, what is
  deliberately not, and where a count comes from. `grep -n '^## ' README.md`
  is the table of contents with line numbers.
- **Two databases, and never one** and **Setting it up**, before anything
  that touches a binding, a secret or the schema — read with **Production
  only, for now** in `CLAUDE.md`, which is newer than both and wins.
- The header of the file, and of `functions/api/_lib.js`. The header of
  `lists.js` states the ownership rule every write in it follows.
- A route that counts something — `stats.js`, `_visitors.js`, `_visits.js`,
  `_flows.js`, anything under `api/admin/` — is also the `/stats` process:
  **The rules of a count** there are the invariants the route table below
  only hints at.

## Is it new?

A route that does not exist yet is not built from the prompt. It is described
first, the owner answers, and the code comes after —
**Something new is described before it is built** in `CLAUDE.md` is the rule
and this is the server-shaped half of it. A new route, a new table, a new
column somebody can fill in, a new thing a group can do on splitwise: all of
this. Fixing, tightening or speeding up a route that already answers is not.

What the description has to settle before a Function is worth opening:

- **The route, its method, and what it answers with** — the JSON a page will
  read, field by field. A shape agreed in a paragraph is a shape that does not
  get renamed across two files and a stylesheet later.
- **What it does when it fails**, given that nothing in `assets/` waits on
  `/api/*` and a new route keeps that promise. Say which part of the page
  simply does not appear.
- **Who may call it**: signed out, signed in, the owner of the row only. The
  ownership rule in the header of `lists.js` is the pattern, and an answer of
  "anyone" is an answer that has to be said out loud.
- **Whether it needs the schema.** A new table or column is `db/schema.sql`
  and a load into production that only the owner approves — **The rules of
  a write** below — so it belongs in the description rather than in the PR
  that discovers it.
- **What it caps**, if it takes anything a person typed, and the second home
  that cap needs under **Caps live in two places** below.

Then post it and stop. A schema written while the answer is outstanding is
the most expensive kind of guess: it is the one that has already been loaded
somewhere by the time the shape turns out to be wrong.

## The routes

`_routes.json` sends everything except `/assets/*`, `/photos/*`,
`/stories/*`, `/data/*` and the favicon through the Functions. Files with a
leading underscore are modules, not routes.

One line a route: what it writes, how it is cached, and the thing about it a
change is likeliest to break. The rest is in the file's own header, written for
whoever changes it, and in the README section the line names — read both
before changing a route, and when a route changes, move its line and its
header in the same commit. Two routes are documented whole elsewhere: the
kinds `POST /api/stats` takes are the `/stats` skill's table, and the chess
route's shape is the `/chess` skill's. A **Writes** cell that says
`countUse()` means `visitor_counts` and `usage_people`, every write that went
through counted by `countUse()` in `_visitors.js` — **Usage, week by week** in
`README.md`.

| Route | File | Writes | Cache | What to know |
|---|---|---|---|---|
| `/` | `index.js` | none | `REVALIDATE` with a weak ETag; the rendered page in the colo under `mapKey()` — language, place, deployment — for `MAP_TTL` | `index.html` with its head and its places as text, per `?lang=` and `?spot=`; the static file when the data cannot be read — **Getting found**, **Sharing a place** |
| `/*` | `_middleware.js` | none | as `_headers` | the owner's lock — `/admin/` a 404, `/api/admin/` a 403, through `adminUser()` in `api/_admin.js`; `pages.dev` 301ed home; both subdomain roots *call* their routes; the security headers on every answer — **The security headers** |
| `GET /api/saves` | `saves.js` | none | `public, max-age=60`, a weak ETag, and the colo copy under `countsKey()` | the counts out of `save_counts`, never a `COUNT(*)` — **Saves** |
| `POST /api/saves` | `saves.js` | `saves` and `RECOUNT_SQL` in one `batch()`; `countUse()` | `no-store`; purges `countsKey()` | the purge reaches one colo, and the minute's TTL is the backstop — **Saves** |
| `GET/POST /api/account` | `account.js` | `users`, `sessions`, `login_fails`, `username_holds`, `identities`, `profile_rows`; device saves through `claimDeviceSaves()` | `no-store`; `Set-Cookie ttb_s` | the profile's writes take a session and not the password; an account is made only by `enterAccount()` and `nameGoogleAccount()` in `_account.js` — **Accounts**, **Your page** |
| `GET /api/google` | `google.js` | `sessions`, `identities`, `users.last_seen_at`; device saves through `claimDeviceSaves()`; `visitor_counts` (`signup`) through `countSignup()` | `no-store`; `Set-Cookie ttb_s`, `ttb_g`, `ttb_gp` | one route asked twice, out and back; never JSON, every ending a 302 to `?then=` with one word in `?google=`; makes no account — **Signing in with Google** |
| `GET/POST /api/lists` | `lists.js` | `lists`, `list_items`, `list_keeps`, `added_places`; `countUse()` | `no-store`: the owner reads it mid-edit | every write but `keep()` reads `lists.owner` first — the header's ownership rule — **Lists** |
| `GET /api/places` | `places.js` | none | `public, max-age=300` | the map's roll merged with open `google_venues`; `?q=` for the post editor's picker, `?ids=` for a post's cards |
| `GET /api/venues` | `venues.js` | none | `public, max-age=300` | `?ids=` or `?map=` and nothing else: the whole roll is `/api/admin/venues`, and this cannot become a search — **Finding anywhere in Tallinn**, **Google, on a place of mine** |
| `GET /api/admin/venues` | `api/admin/venues.js` | none | `no-store` | the owner's; the whole `google_venues` roll in `venueRows()`'s shape, for `/admin/google` |
| `GET /api/admin/stats` | `api/admin/stats.js` | none | `private, no-store`; the colo copy under `statsKey()` — language and `?device=` — for five minutes | the owner's; the ranking, the lists and posts read, `held`, `saves` and the page's words in one answer — **Statistics**, **By device** |
| `POST /api/stats` | `stats.js` | `press_counts`; through `_visits.js` `profile_counts`, `view_seen` and `list_counts`; through `_visitors.js` `visitor_counts` and `visitor_live`; through `_flows.js` `flow_counts`; after the answer, a Google refresh through `refreshOnOpen()` | `no-store` | open to anybody and sent by every page; every ending a 200, `{ok:false}` when nothing counted; the owner's session counts nowhere — **Statistics**, **Visitors** |
| `GET /api/admin/visitors` | `api/admin/visitors.js` | none | `private, no-store`; the colo copy under `visitorsKey()` — language, range, device — for five minutes | the owner's; one range of `visitor_counts` and the three tests' `press_counts` rows; `SHAPE` moves when the answer does — **Visitors** |
| `GET /api/admin/found` | `api/admin/found.js` | none | as `/api/admin/visitors`, under `foundKey()` | the owner's; the words typed into a search engine are not in it and cannot be — **How they found it** |
| `GET /api/admin/live` | `api/admin/live.js` | none | `no-store`: five minutes old is not right now | the owner's; the last thirty minutes of `visitor_live`, a ring of sixty rows — **Right now** |
| `GET /api/admin/flows` | `api/admin/flows.js` | none | `private, no-store`; the colo copy under `flowsKey()` — diagram, range, device | the owner's; one diagram of `data/flows.json` walked over `flow_counts`; a diagram it lacks is a 404 — **The numbers on it**, **Arrived via** |
| `GET /api/insights` | `insights.js` | none | `no-store` | the session is the only way to ask, so nobody reads anybody else's numbers — **Insights** |
| `GET /api/admin/refreshes` | `api/admin/refreshes.js` | none | `no-store` | the owner's; the Google tab's report — whether the key is set, never its value, and the calls against `BUDGET` — **Keeping it current**, **The map against Google** |
| `GET /api/admin/top100` | `api/admin/top100.js` | `google_reranks`, `google_ranks` and `google_venues.rank` through `rerankIfDue()`; a refresh after the answer through `refreshTop()` | `no-store` | the owner's; the asking is the making — a UTC week's first ask renumbers the city — **The week's ranking, and the top hundred** |
| `GET /api/geocode` | `geocode.js` | none | `public, max-age=86400`, and Photon's answer a day | open to anybody, held by `MAX_Q`, five rows and the cache; `/api/ask` measures "near" through its `suggest()` — **Near somewhere** |
| `GET /api/route` | `route.js` | none | `public`: an hour for a walk or a drive, a minute for a bus | open to anybody, both ends inside `nearTallinn()` and rounded, nothing stored or counted — **Sharing a place** |
| `GET /api/profile` | `profile.js` | none | `no-store` | `readProfile()` in `_profile.js`, the one `/u/<name>` seeds from; public lists only — **Profiles** |
| `GET /api/pass` | `pass.js` | none | `no-store` | `401` signed out, so `deal.html` offers the sheet; one draw per account, place and hour, an HMAC under `SAVE_SALT` and nothing stored — **It is for members**, **A rate that is drawn** |
| `/split` | `split.js` | none | `no-store`, `noindex` | **splitwise** — `split.html` with the `?g=` group's head; `_middleware.js` calls it for the subdomain's root — **What the link looks like in a message** |
| `/flashcard` | `flashcard.js` | none | `no-store` | **flashcards** — `flashcard.html` with the `?d=` deck, lesson, song or conversation in its head, its `<main>` and its JSON-LD; `noindex` for a deck out of the database — the `/flashcards` skill |
| `GET/POST /api/split` | `api/split.js` | `split_groups`, `split_members`, `split_expenses`, `split_shares`, `split_settlements`; `countUse()` | `no-store` | **splitwise** — the code alone reads a group; every write but `create` and `join` needs a session and a membership — **Splitwise** |
| `GET/POST /api/feedback` | `feedback.js` | `feedback`, `feedback_hearts`; `users` and `sessions` through `_account.js` | `no-store` | saying something and hearting need no account; `say` with `as: 'name'` makes or enters one in the same request — **Feedback** |
| `/privacy` | `privacy.js` | none | `no-store` | `privacy.html` with `data/privacy.json` written in as text, in the `?lang=` language and English at the bare address — **Privacy** |
| `GET/POST /api/posts` | `api/posts.js` | `posts`, `post_texts` | `no-store` | a session for every POST, and a draft is a 404 to anybody but its owner; a body is blocks, never HTML, kept by `cleanBody()` in `_posts.js` — **Everybody's posts** |
| `/blog/sitemap` | `blog/sitemap.js` | none | `public, max-age=3600` | every published member's post, `<lastmod>` its last save; empty where the database cannot be read |
| `/blog` | `blog.js` | none | `private, max-age=0, must-revalidate` with a weak ETag; the colo copy under `blogKey()` for `PAGE_TTL`, for everybody, since it reads no session | `blog.html` with the post's head, JSON-LD and text, in English whatever `?lang=` says — **Found as text** |
| `GET/POST /api/flashcard` | `api/flashcard.js` | `flashcard_decks`, `flashcard_cards`, `flashcard_known`, `flashcard_reports`; `countUse()` | `no-store` | **flashcards** — the decks are what `tools/decks.mjs` writes into `data/decks/`, read through `_decks.js`, and the source only for a gathered deck past `FEW_DECKS`; the page's words ride in every GET, in `DECK_LANGS`' three languages; a stage that has not opened sends no decks — the `/flashcards` skill |
| `GET/POST /api/chess` | `api/chess.js` | `chess_games`, `chess_moves`, `chess_notes`, `chess_asks`; `countUse()` | `no-store`: `you` and `legal` are per person | **chess** — the whole page in one GET, and `(game, ply)` the move's lock — the `/chess` skill |
| `GET /api/say` | `api/say.js` | none | `public, max-age=2592000`; the edge copy keyed on the voice, the pace and the words | **flashcards** — Tartu's Estonian voice for a text `data/decks/spoken.json` lists, which `tools/decks.mjs` writes, and `404 not-a-card` for any other; honours `Range` — **Hearing it** |
| `POST /api/ask` | `ask.js` | `visitor_counts` (`ask`) through `countAsk()`, after the answer and never for the owner | `no-store` | the one route that asks Workers AI, out of the allowance the live site shares; the model picks ids out of the slice it is given, and an id it invents is dropped — **Ask for somewhere** |
| `/list/<id>` | `list/[id].js` | none | `no-store` signed in; to anybody else `private, max-age=0, must-revalidate` with a weak ETag and the colo copy for `PAGE_TTL` — KEPT IN THE COLO in `_shell.js` | `lists.html` with the list in its head, its seed and its `<main>` |
| `/lists` | `lists/index.js` | none | as `/list/<id>`, under `directoryKey()` | everybody's lists, the first page seeded out of `_mostkept.js`, searched by `?q=` and ordered by `?sort=` |
| `/lists/public`, `/lists/kept` | `lists/public.js`, `lists/kept.js` | none | — | 301s to `/lists`, the addresses it had before |
| `/u/<name>` | `u/[name].js` | none | as `/list/<id>`, under the address with the name lowercased | `lists.html` with the profile seeded and as text, its head and `ProfilePage` built from the line under the name |

Seven routes serve a static page with a head of their own — `index.js` the
map, `split.js` a group, `flashcard.js` a deck, `blog.js` a post, and the
three list routes the same `lists.html` —
and the page out of the deployment, the escaping, the head swap, the seeding
and the filling of an element the page ships empty are in
`functions/_shell.js`. `index.js` and `split.js` write their own tags rather
than taking `head()`, because a place has a photograph and a language for
its card and a group's name wants no site suffix after it. The query each
list route seeds is in a module beside the route that also answers it —
`_lists.js` for one list, `_mostkept.js` for everybody's, `_profile.js` for
one person — so the page and the API cannot drift apart. Underscore-prefixed
files are modules, never routes. A page served this way carries a pair of
`PAGE-HEAD` markers for the head to go between, and an element it ships
empty for `fill()` to write the page's text into — `EMPTY` in `_shell.js`
names it per page — and the validator fails on a page that has lost either.

`json(body, status, maxAge)` in `_lib.js` is how every answer is built: with
`maxAge` it is `public, max-age=N`, without it `no-store`. **Never put a
session-gated answer behind a `maxAge`**; the directive is public.

## How the Functions are written

**Modern ESM.** `const`, arrows, `async`/`await`, top-level `import`. The
opposite dialect to `assets/`; do not carry either into the other.

**Two databases, and the split is load-bearing.** `wrangler.toml` declares
`tallinntastebuds-preview` at the top level (the binding `wrangler pages dev`
names its local copy after)
and again under `[env.preview]`, and `tallinntastebuds` under
`[env.production]`, each with an `ENVIRONMENT` var equal to its block's
name. Both blocks must list every binding: Pages does not inherit from the
top level once an environment overrides anything. `wrongDatabase()` in
`_lib.js` reads `meta.environment` once per isolate and blocks only a
**disagreement** — `stamp !== '' && stamp !== expected` — so an unstamped
database or an unset var passes unguarded. The validator fails on a missing
env block, a block with no database or no `ENVIRONMENT`, or preview and
production sharing an id or a name.

**What each route needs, and what happens without it:**

| Missing | Effect |
|---|---|
| `DB` binding | counts `{}` 200; account and lists GET report `ready: false`; every POST `503 no-database`; venues 503; places serves the map's roll alone |
| `ENVIRONMENT` mismatch | the same answers as no database, `wrong-database` |
| `SAVE_SALT` | saves, account and lists POST **fail closed**, `503 no-salt`, rather than store a weaker hash, and so do the one `/api/flashcard` action that is filed under a fingerprint rather than a person and `/api/pass`, whose answer is a hash under it — which takes every discount down with it, deliberately. Changing it later resets every cap, leaves the counts alone, and redraws every rolled discount from that hour on |
| `TURNSTILE_SECRET` | optional; set, a save without a token is 403 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional, and both or neither. Without a *usable* pair `/api/account` answers `google: false`, every sheet draws the username and password alone, and `/api/google` sends a hand-typed request home. Nothing else changes. Usable is more than present: `googleReady()` trims both, requires every character of the id to be a letter, digit, dot, hyphen or underscore, requires it to end in `.apps.googleusercontent.com`, and requires it to be **longer** than that suffix — a value truncated to the bare suffix passes `endsWith()`, which is what broke the sign-in on the day it shipped. So a pasted newline, a zero-width character trimming cannot reach, a truncated id, or the secret in the id's box all read as absent rather than as a button that ends on Google's `invalid_client` page. Past those four, an `invalid_client` is the console and not the binding |
| `GOOGLE_MAPS_API_KEY` | optional, and **Production only**. Without it no Google place is refreshed and the directory keeps the export's numbers; `/api/admin/refreshes` answers `key: false` and the admin tab says so. In Preview as well it would be a second counter in a second database spending from the same free thousand a month, which is why it goes in one. `googleKey()` in `_refresh.js` trims it and holds it to the shape of a Google key, so a stray word in the box reads as absent |
| `ADMINS` var | nobody is the owner: everything under `/admin/` is 404 and everything under `/api/admin/` is 403, to everybody. A list of `users.id`, never usernames, one per environment block because the two databases hold different accounts; `_admin.js` says why it fails closed |
| `AI` binding | `/api/ask` answers `source: "none"`, `note: "no-ai"`, and the chat says nothing on the map answers. Everything else is untouched |

Secrets live in the Pages dashboard, per environment, and never in the repo.

**The chat is Workers AI and only that.** `[ai]` in `wrangler.toml` is a
binding like `DB`, not a key: nothing to create, nothing to buy, the model
is the one `MODEL` constant at the top of `ask.js`. Three things about it
bite. The free allowance is **ten thousand Neurons a day per account, shared
by preview and production**, so an afternoon of driving the chat on a
preview empties the live site's day; past it every request is a 429 until
midnight UTC and the chat says it is resting. The model answers as a chat
completion, words at `choices[0].message.content`, and an older model
answers `{ response }` — the route reads both, because reading one cost a
year of the model never being heard. And `/api/ask` says which half
answered in `note` — `workers-ai`, `workers-ai-none`, `workers-ai-spent`,
`no-ai` — and which model in `model`, so when the chat goes quiet, one
request tells you why, and a swap of the constant is checked the same way;
the comment above `MODEL` has the curl and the per-question arithmetic. The
model never writes about a place: it picks ids out of the slice it was
given and writes a clause each, and an id it invented is dropped. Keep
that shape; it is what makes a hallucinated restaurant unreachable. Three
rules are enforced on top with one retry — the kind, the dish and the
distance, under `askModel()` — and a new rule joins them there rather than
as a sentence in the brief alone, since a small model reads past a
sentence.

**The Google round trip is `functions/api/_google.js` and
`functions/api/google.js`, and nothing else.** The module holds the two sealed
cookies, the code swap and the three queries against `identities`; the route
holds the trip. `account.js` imports from it and never talks to Google itself.
The scope asked for is `openid` alone — no address, no name, no picture — and
the only thing stored is Google's `sub`. An account made this way has an
**empty `pw_hash`**, and `matches()` in `account.js` is the one place that
knows what that means: it refuses a sign-in against one rather than deriving
PBKDF2 at nought iterations, which WebCrypto throws on. Read **Signing in with
Google** in `README.md` before changing any of it.

**Every write is a prepared statement, and every write to a list is
preceded by a read of `lists.owner`**: `onRequestPost` in `lists.js` loads
`owner, public` for the id and returns 404 unless it matches the session,
before `edit`, `delete`, `add`, `say`, `drop` or `order` run. The one
deliberate exception is `keep()`, routed above that check, which requires
the list to exist and be public and writes only a `list_keeps` row keyed on
the session's own id. Keep the header true when you change this.

**A count is recomputed, never nudged.** Anything that changes `saves` runs
`RECOUNT_SQL` in the same `batch()` and purges
`caches.default.delete(countsKey(request))`; the purge reaches one colo and
the 60-second TTL is the backstop.

**Every failure is quiet on the page.** Nothing in `assets/` waits on
`/api/*`, and a new route keeps that promise.

**A write to either database is the owner's decision, and there is a gate
that enforces it.** `.claude/hooks/d1-write-gate.mjs` runs before every
`d1_database_query` call: a read runs, and anything that writes — `INSERT`,
`UPDATE`, `DELETE`, any DDL, a generated `.sql` file pasted in — stops and
asks. Do not go around it, and do not read "merge it" as covering the load
that follows. **The rules of a write** below is the procedure.

`.claude/settings.json` also carries two hard denials: never `DROP` a table,
never `DELETE` or `UPDATE` without a `WHERE`. There is no backup of either
database in this repository; D1 Time Travel's 30 days is the only recovery.

**Caps live in two places** and the server is the one that binds. `MAX_TITLE
60`, `MAX_INTRO 200`, `MAX_SAY 280`, `MAX_MUST_ORDER 280`, `MAX_ITEMS 50` in
`lists.js` are restated in `assets/lists.js`, and `MAX_TITLE` a third time in
`assets/account.js`,
which carries the box that names a new list; `MAX_ABOUT 200` in `_profile.js` — the line and every version of it in
another language — and `MAX_DISPLAY 60` in `account.js` are restated in
`assets/edit.js`, which carries the only boxes that write them;
the three handle patterns in `NETWORKS` in `_profile.js` are restated in the
same table in `assets/links.js` and `node tools/validate.mjs` holds the two to
each other — those three fields are the one place here where the cap is *not*
also a `maxlength`, because they take a pasted profile address as well as a
handle and a `maxlength` truncates it into a different account's;
`MAX_NOTE 280` in `chess.js` is restated in `assets/chess.js`, whose
note field is the only one that writes it;
`MAX_NAME 60` and `MAX_SIDE 60` in `flashcard.js` are restated in
`assets/flashcard.js`, which carries the two forms that write them;
`MAX_FEEDBACK 500` in `feedback.js` is restated once, as `MAX_TEXT` in
`assets/feedback.js`, which carries the only field that writes it — and the
counter under that field reads `{n} / {max}` out of `data/ui.json` rather than
spelling the number, so the cap is two edits and not twelve; `MAX_NAME 80` and
`MAX_ADDRESS 120` as literal `maxlength: '80'` and `'120'` in the add-a-place
form in `assets/lists.js`; the username's 3–24 in `_account.js` —
`USERNAME_RE`, read by `asUsername()` alone, which every route that takes a
name calls rather than keeping a copy, `_profile.js` and `_visits.js` included
— as a `maxlength: '24'` on all three of `app.js`'s username fields — the
sign-up sheet's, the rename step's and the one behind Continue with Google —
on `split.js`'s and `flashcard.js`'s, each one field worn by three views, and
in words as `accountUsernameHint`, `accountErrUsername` and `feedbackNameHint`
in `data/ui.json`. `grep -n maxlength assets/*.js` finds every copy. Change
one, change the other, and the README's table under **The caps**.


**And so does the pin table.** `PIN_GLYPHS` and `PIN_TONES` in
`functions/api/_pins.js` are the ids a list may store; `GLYPHS` and `TONES` in
`assets/pins.js` are the same ids plus the emoji each draws. Neither file can
import the other, so they are written out twice — the same arrangement the
story clock has. `node tools/validate.mjs` fails the build when they drift, so
this one is enforced rather than remembered. `mark` is in neither, on purpose:
the mouth goes on a place I have eaten at and a picker must not be able to
hand it out. **The pins** in `README.md`.

## The rules of a write

Reading is free: `d1_database_query` answers a `SELECT` straight away, and
checking the state of a table is how everything here gets verified. Writing is
not, and the split is machinery rather than good intentions —
`.claude/hooks/d1-write-gate.mjs`, wired as a `PreToolUse` hook in
`.claude/settings.json`, classifies the SQL and hands back `allow` or `ask`.
Its cases live in the file it guards and CI runs them (`--check`).

The procedure around it, which no hook can enforce and you have to:

1. **Work out the delta first, from the databases themselves.** Compare what
   is in them against what the repository says should be — row counts, a
   `GROUP BY`, per-column aggregates — rather than assuming the last load
   landed. Something else may have been applied since, and a column you are
   not touching may have moved.
2. **Say what will change before asking to change it**: which database, which
   table, which columns, how many rows, and what the values go from and to.
   A count on its own is not a description. Group them where there are many —
   "49 rows, American → Burgers" — and name the ones a person would want to
   check by eye.
3. **Keep it inside the cap.** A write names its rows — an `INSERT` with its
   tuples written out, or a `WHERE` that pins every primary-key column with
   `=` or `IN (…)` — and names at most **a hundred** of them across the whole
   call, with **twenty** the size an ordinary correction should be. The gate
   refuses the rest rather than prompting: over a hundred, and anything whose
   size is not in the statement (`WHERE cuisine = 'American'`, a `LIKE`, a
   range, a subquery, a table not in `db/schema.sql`). That is not a wall to
   climb. A load bigger than the cap is a terminal job — the two
   `wrangler d1 execute` lines in this file and in `/google-venues` — and a
   sweep whose size nobody can state is a sweep nobody should run.
4. **Then let the prompt happen**, and take a no for an answer. One ask per
   write; asking again in the same turn hoping for a different answer is not
   how consent works.
5. **Production only.** Preview is set aside until the owner replicates it,
   so a write goes to `tallinntastebuds` and nowhere else, and preview's
   drift from it is not reported — **Production only, for now** in
   `CLAUDE.md`.
6. **Verify after**, as in step 1, and say what the numbers are now.

"Merge it", "land it", "ship it" and "fix it" are about the pull request. The
database is a second yes and it is worth asking for plainly: the change is in
the repository either way, and an unloaded `.sql` file is something anybody
can apply in a minute. A load that happened without being asked for cannot be
unhappened.

## The schema

`db/schema.sql` is the schema, not a migration: every statement is `IF NOT
EXISTS`, and **nothing in CI applies it**. It is applied by hand, to
production only while preview is set aside:

```
wrangler d1 execute tallinntastebuds --remote --file=db/schema.sql
```

So a push does not apply it, and what is deployed and what is described can
part company: `idx_saves_owner` existed in production before it was in the
file, and `added_places.address` was added by a hand-run `ALTER TABLE`. A
change that adds a table or an index is driven under `pages dev`, and the PR
says in so many words that production needs it applied on landing. A change
to an existing column has no runner: write the `ALTER` out, say what it does
to the rows, and list the columns
in the file in the order the deployed table has them. **And make the readers
survive its absence**, because there is always an afternoon between the deploy
and somebody running it: `users.about` does that with a try and a second
statement, and `lists.pin` with `readingPins()` in
`functions/api/_pins.js`, which asks once per isolate and then knows.
A foreign key on a live table is a rebuild; do not reach for one.

## The steps

If the change is something new, **Is it new?** above comes first and there is
no step 1 until the owner has answered it.

1. Make the change with the README section open and the file's header
   re-read against what the code now does.
2. `node tools/validate.mjs`. It checks `wrangler.toml`, the `KITCHENS`
   patterns in `venues.js` against the export, and the generated SQL. Then
   `node tools/functions-check.mjs`, which imports every module under
   `functions/` the way the deploy bundles them: a name imported from a
   module that no longer exports it, or a syntax error, fails here rather
   than taking every route down with the one that was wrong. It takes a
   second, and the outage it answers is the last bullet of **Where it goes
   wrong**.
3. **Drive it under `npx wrangler pages dev .`**, at `127.0.0.1:8788`. Its
   D1 is a local copy, under `.wrangler/state` and named after the preview
   binding at the top of `wrangler.toml` — Pages' dev server cannot be
   pointed at a remote database, so nothing it does reaches
   `tallinntastebuds-preview`, let alone production — and it is empty until
   `wrangler d1 execute tallinntastebuds-preview --local --file=db/schema.sql`
   has run, after which every route that answered `ready: false` answers.
   Rows to look at go in the same way, `--local`, and the owner's routes
   want an account made under it and named with `--binding ADMINS=<id>`:
   **Driving it** in the `/stats` skill. `.wrangler/` is the dev server's
   scratch and is ignored. The `AI` binding is the exception and runs
   remotely even there, spending from the shared daily allowance, so drive
   the chat a few questions at a time — and in a cloud session with no
   Cloudflare token it stops the server starting at all; **The house, and
   driving without a token** in the `/chess` skill is the way round it. To
   look at rows in a real database without a dev server, the Cloudflare MCP
   tool `d1_database_query` reads either without a prompt and writes to
   neither without one — see **The rules of a write**.
4. Rewrite the README paragraph the change made wrong, and the header. A
   route added, removed or gated differently is a step in somebody's
   diagram: the `ref` in `data/flows.json` that names it moves too, then
   `node tools/flows.mjs` — the validator fails on a `ref` to a file that is
   gone. A step the site can see somebody take also says what it is counted
   by, in `when` — a page out of `PAGES` in `_visitors.js` or a press name
   the README's **Analytics** table lists — or it draws with no number on
   `/admin/flows`. **Who uses the site, drawn** in `README.md`.
5. The pass in `leave-it-better.md`.

## The commit

> Counts come from a counts table, not a `COUNT(*)` on every read
> A save is free again, and the account is the offer
> Merge the map into the directory, and read the week through one parser

The body says what the rows looked like before, what they look like after,
what it costs per request, and what has to be applied by hand and where.

## The pull request

**The pull request** in `CLAUDE.md` is the sequence, and this process adds:

- `node tools/functions-check.mjs` beside the validator, every time.
- If `db/schema.sql` changed, apply it to the **local** database before
  driving — `wrangler d1 execute tallinntastebuds-preview --local
  --file=db/schema.sql` — so `pages dev` has the table the code expects. The
  remote preview gets nothing: **Production only, for now** in `CLAUDE.md`.
- The page half driven in a browser through `npx wrangler pages dev .`.
- The body says what the rows looked like before and after, what it costs per
  request, and **what has to be applied by hand on landing and to which
  database** — the schema statement, the meta stamp, a load. A
  `wrangler.toml` change to the preview block is the one case nothing local
  can check: `pages dev` reads the top level rather than `[env.preview]`, and
  there are no preview deployments. Say plainly that the binding wants a
  preview and what you would look at on it; `CLAUDE.md` says what the owner
  runs to make one.
- After **Rebase and merge**, **apply to production** whatever the body said,
  immediately: the code is live the moment the push lands, and a route that
  expects a column production does not have fails quietly, which is the
  worst way.

## Where it goes wrong

- One D1 binding declared at the top level of `wrangler.toml` and handed to
  both environments, so a bookmark pressed on a preview was a save on the
  live map. Nobody noticed for weeks.
- A schema change pushed and never applied, so `pages dev` worked and the
  deployment did not.
- A preview binding changed in `wrangler.toml` and not picked up, because
  each environment's configuration is written by a deployment *of that
  environment* — and there are no preview deployments now, so nothing local
  or in CI can show it. Say so in the PR; `CLAUDE.md` says what the owner
  runs to make the one that would.
- Comments that fell behind the routes: the README's "the attack surface of
  the database is that one file" was true when `saves.js` was alone, and the
  header of `_lib.js` named three routes of eight for a month. Fix the one
  you are standing in, and count the routes in this file's table when you
  add one.
- The chat driven hard on a preview, and the live site out of model until
  midnight UTC. Same allowance, one account.
- A pattern and the sentence that restated it meaning different things.
  `USERNAME_RE` was `[a-z0-9-]` for a month while `accountUsernameHint`
  promised "letters" in ten languages — which in Tallinn includes ü and õ, and
  in Kyiv a whole alphabet — so `jüri` was refused with the sentence it had
  just followed. Nothing in the code could show it; the sign-up funnel on
  `/admin/visitors` did, where `account_err_username` was the only refusal
  counted in its first three days. When a sentence under a field restates a
  pattern, read the sentence in a language that is not English before
  deciding the two agree, and when people give up on a form, read the funnel
  before the code: it says which word the route refused them with.
- An export taken out of `_lib.js` by the commit that wrote its replacement,
  while a route still imported the old name. An ES module resolves its
  imports before any of it runs and Pages bundles everything under
  `functions/` into one Worker, so the deployment went down whole rather
  than the one route, and nothing in CI had opened either file — the
  comment above `languageIndex()` is the record. `node tools/functions-check.mjs`
  loads every module now, in CI and in step 2 of **The steps**.
