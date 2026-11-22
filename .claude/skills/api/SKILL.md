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
  deliberately not, and where a count comes from. `grep -n '^## ' docs/handbook.md`
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
column somebody can fill in, a new thing a deck can do on the flashcards: all of
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
- **What it reads, and how often** — each statement's key, its rows read
  measured against production, and the day's worst in rows. **The rules of a
  read** below; a description without the number is not finished.

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
`docs/handbook.md`.

| Route | File | Writes | Cache | What to know |
|---|---|---|---|---|
| `/` | `index.js` | none; one `google_venues` read for a `?spot=` Google key, on a colo miss | `REVALIDATE` with a weak ETag; the rendered page in the colo under `mapKey()` — language, place, deployment — for `MAP_TTL` | `index.html` with its head and its places as text, per `?lang=` and `?spot=`; the static file when the data cannot be read — **Getting found**, **Sharing a place** |
| `/*` | `_middleware.js` | none | as `_headers` | the owner's lock — `/admin/` a 404, `/api/admin/` a 403, through `adminUser()` in `api/_admin.js`; the repository's own files — dot directories, `db/`, `exports/`, `tools/`, Markdown, `wrangler.toml` — a 404 through `notTheSite()`; the apps' routes at their old `/api/<name>` a `410` naming `/api/v1/<name>` through `movedTo()`, but `/api/google`; `pages.dev` 301ed home; the flashcards' subdomain root *calls* its route and splitwise's old one 301s to the map; the security headers on every answer — **The security headers** |
| `GET /api/v1/saves` | `saves.js` | none | `public, max-age=60`, a weak ETag, and the colo copy under `countsKey()` | the counts out of `save_counts`, never a `COUNT(*)` — **Saves** |
| `POST /api/v1/saves` | `saves.js` | `saves` and `RECOUNT_SQL` in one `batch()`; `countUse()` | `no-store`; purges `countsKey()` | the purge reaches one colo, and the minute's TTL is the backstop — **Saves** |
| `GET/POST /api/v1/account` | `account.js` | `users`, `sessions`, `login_fails`, `username_holds`, `identities`, `profile_rows`; device saves through `claimDeviceSaves()`; `meta` `lists_at` through `listsChanged()` on a new username and a deleted account, which change a list's byline or take lists away | `no-store`; `Set-Cookie ttb_s` | the profile's writes take a session and not the password; an account is made only by `enterAccount()` and `makeIdentityAccount()` in `_account.js`, which `makeGoogleAccount()` is the Google name for; `GET` answers `appGoogle` and `appApple`, which the iPhone app draws its two buttons by, `POST` with `action: student` writes the date a member asks to be a student until into `student_asked`, never `student_until`, and `GET` answers `student: { until, asked }` where both columns are there; and `POST` with `action: ticket` is the app trading the ticket its Google trip ended in, and the verifier it kept, for a session — **Accounts**, **Your page**, **The iPhone app signs in through these too** |
| `GET /api/google` | `google.js` | `users`, `sessions`, `identities`, `users.last_seen_at`; device saves through `claimDeviceSaves()`; `visitor_counts` (`signup`) through `countSignup()` | `no-store`; `Set-Cookie ttb_s`, `ttb_g` | one route asked twice, out and back; never JSON, every ending a 302 to `?then=` with one word in `?google=`; a Google account new here is made into an account on the way back, under a name `makeGoogleAccount()` draws; `google_out_inapp` beside `google_out` through `inAppOf()` in `_visits.js`; the one trip that does not end on a page is the iPhone app's, started with `?app=<challenge>`: it only ever signs in, sets no `ttb_s`, and every ending is a 302 to `tallinntastebuds://signin` with the same word in `google=` and a sealed two-minute `ticket` where somebody signed in — **Signing in with Google**, **The iPhone app signs in through these too** |
| `POST /api/v1/apple` | `apple.js` | `users`, `sessions`, `identities` (provider `apple`), `users.last_seen_at` | `no-store`; `Set-Cookie ttb_s` | Sign in with Apple from the iPhone app, and from nowhere else: the body is the token Apple's sheet gave the app and the nonce it was asked for under, and `appleSubject()` in `_apple.js` checks the signature against Apple's published keys, the issuer, the bundle id, the expiry and the nonce; answers `{ user, saved }` as a password sign-in does, or `401 apple`; an Apple id new here is made into an account under a drawn name; no secret, no slow-down, and not counted in the sign-up funnel — **The iPhone app signs in through these too** |
| `GET/POST /api/v1/me/lists` | `lists.js` | `lists`, `list_items`, `list_keeps`, `added_places`; `meta` `lists_at` through `listsChanged()` in `_lists.js`, in the batch of every write but `keep()` and `place`; `countUse()` | `no-store`: the owner reads it mid-edit — but `?all=1` asked with no session at all, kept in the colo under the lists mark and told `private, max-age=0, must-revalidate` | every write but `keep()` reads `lists.owner` first — the header's ownership rule; `keep()` touches no column of the list and answers `keeps` counted live, since `lists.keeps` and `lists.opens` are made weekly by `listsMark()` in `_lists.js` — **Lists**, **What is cached, and until when** |
| `GET/POST /api/v1/walk` | `walk.js` | `walks`, `walk_checks`; `countUse()` under `lists`, as `walk_<action>` | `no-store`: `walk` and `checks` are per person | a list read as a walk — GET is open to anybody who can read the list and carries the board and everybody's comments, and with `&who=<name>` answers that one finisher's checks in order instead, the board's times opened into their parts; `?mine=1` is the session's own walks still going, the one last moved first, as `walks` and the first as `mine`, for Discover's Play card, and empty signed out;  every POST takes a session and reads the list through `readList()`, so a private list is somebody else's 404; `check` compares the coordinates it is sent with the places left, stores the place and the time and **never the coordinates**, and answers `409 far` past `RADIUS`; `mode` is `foot` or `bike` and is fixed once the walk is finished; `again` deletes the session's walk of that list and its checks, so Start begins another; a comment can only land on a row the session made by checking in, or on its own finished walk, and `unnote` is the owner's through `adminIds()`; `ready: false` and `503 not-ready` where the two tables have not been applied — **Walking a list** |
| `GET /api/v1/find` | `places.js` | none | `public, max-age=300`, and the merged roll built out of the isolate's one copy of `google_venues` — `googleTable()` in `_lib.js`, which a new isolate takes from the colo's Cache API, filed under `venues_all_at`, and which reads only the rows `changed_at` names since its last look — and a `?q=` that finds nothing makes it look at once, at most once a minute | the map's roll merged with open `google_venues`; `?q=` the one search of the city, matched and ordered by `_find.js` the way the find bar matches its own copy, with `near`, `bbox` and `limit` — the iOS app reads it, so a row keeps `id`, `name`, `address` and `map`; a Google row also carries `kitchens`, `category` and `tags` — `tagsFor()`, the hidden tags the search matches and the find bar offers as words — and a row of either half `serves`, out of `data/serves.json`; `?ids=` for a post's cards; building the roll needs every row of `google_venues`, so a change that drops the isolate's copy, or searches the table on a miss, puts the day's D1 reads back in reach of anybody with a loop |
| `GET /api/v1/discover` | `discover.js` | `meta` `discover_week`, the week's numbers, on the week's first build | `public, max-age=0, must-revalidate`, a weak ETag, and the colo copy under `discoverKey()` — the deployment's `restaurants.json` and the lists mark — for up to `MARKED_TTL`, a week | open to anybody and the same answer for all of them; the three shelves of the page a phone opens on — the newest and the most opened public lists through `mostKept()`, the second last Monday's order, and `quiet`, the ids of the five open places opened least, worked out once a week out of `press_counts` beside the map's roll through `mapPlaces()` and kept two deep in `discover_week`, in order and never with a count; `routes`, the lists the Play card is swiped through — the public lists most people had finished by the week's making, with how many and the fastest, then the most opened ones, at most `ROUTES`, through `readList()` and `doors()` out of `walk.js`, and `route` the first of them for an older page; three empty shelves without a database, and a shelf that throws is empty alone — **Discover** |
| `GET /api/venues` | `venues.js` | none | `public, max-age=300` | `?ids=` or `?map=` and nothing else: the whole roll is `/api/admin/venues`, and this cannot become a search — **Finding anywhere in Tallinn**, **Google, on a place of mine** |
| `GET/POST /api/v1/lookup` | `lookup.js` | `google_venues` (insert only, `found_at` and `kind`, and `changed_at` and `venues_at` in `meta` through `venuesChanged()`) and `google_calls` through `spend()` | `no-store` on the POST, the GET five minutes; the same words a day in the colo | open to anybody; one Text Search per press under `BUDGET.search`, Pro fields only; a row already there is never written over — **Look for it on Google Maps** |
| `GET /api/admin/venues` | `api/admin/venues.js` | none | `no-store` | the owner's; the whole `google_venues` roll in `venueRows()`'s shape, for `/admin/google` |
| `POST /api/admin/tie` | `api/admin/tie.js` | `google_venues.map_id` and `changed_at`, one row, and `venues_at` in `meta` | `no-store` | the owner's, and the write must carry the site's own `Origin`; `/admin.html` ties the Google row a new place was picked from to its id, onto an empty column only, so the map has its hours before any export is loaded — `taken` with the `mapId` it already has — **The admin page** |
| `GET /api/admin/stats` | `api/admin/stats.js` | none | `private, no-store`; the colo copy under `statsKey()` — language, `?device=`, the UTC day and `SHAPE` — until midnight; `reads` fresh on every open | the owner's; no statement answers more than a hundred rows; the ranking, the lists and posts read, `held`, `saves` and the page's words in one answer — **Statistics**, **By device** |
| `POST /api/stats` | `stats.js` | `press_counts`; through `_visits.js` `profile_counts`, `view_seen` and `list_counts`; through `_visitors.js` `visitor_counts` and `visitor_live`; through `_flows.js` `flow_counts`; after the answer, a Google refresh through `refreshOnOpen()`, and from noon UTC the day's fill through `fillOnVisit()` | `no-store` | open to anybody and sent by every page; every ending a 200, `{ok:false}` when nothing counted; the owner's session counts nowhere — **Statistics**, **Visitors** |
| `GET /api/counter` | `counter.js` | none | `public, max-age=300`; the colo copy under `counterKey()`, keyed on today's date, for five minutes | open to anybody; the flag counter at the top of Discover on a desktop, out of `readCounter()` in `_visitors.js` — people today, in seven days and all time, the average visit, the top countries — and the one count a visitor sees; `ready: false` and no card without the table — **The flag counter, and the desktops in America** |
| `GET /api/admin/visitors` | `api/admin/visitors.js` | none | `private, no-store`; the colo copy under `visitorsKey()` — language, range, device, and the UTC day through `ownersDay()` in `_lib.js` — until midnight, `asOf` saying when | the owner's; one range of `visitor_counts` and the range before it, the days two or more behind out of the colo where `rowsSince()` in `_visitors.js` keeps one entry a day, yesterday too from a quarter past midnight UTC, and today's rows from the table kept there two minutes for both pages and every chip, and the lists' looks' `press_counts` rows; `?device=` is `phone` or `other`, every device less the phones; `SHAPE` moves when the answer does — **Visitors** |
| `GET /api/admin/found` | `api/admin/found.js` | none | as `/api/admin/visitors`, under `foundKey()` | the owner's; the same days as `/api/admin/visitors`, out of the same colo entries, its kinds kept out of them in memory; the words typed into a search engine are not in it and cannot be — **How they found it** |
| `GET /api/admin/live` | `api/admin/live.js` | none | `no-store`: five minutes old is not right now | the owner's; the last thirty minutes of `visitor_live`, a ring of sixty rows — **Right now** |
| `GET /api/admin/flows` | `api/admin/flows.js` | none | `private, no-store`; the colo copy under `flowsKey()` — diagram, range, device, and the UTC day through `ownersDay()` | the owner's; one diagram of `data/flows.json` walked over `flow_counts`; a diagram it lacks is a 404 — **The numbers on it** |
| `GET /api/insights` | `insights.js` | none | `no-store` | the session is the only way to ask, so nobody reads anybody else's numbers — **Insights** |
| `GET /api/admin/refreshes` | `api/admin/refreshes.js` | none | `no-store` | the owner's; the Google tab's report — whether the key is set, never its value, and the calls against `BUDGET` — **Keeping it current**, **The map against Google** |
| `POST /api/admin/refreshes` | `api/admin/refreshes.js` | `google_venues`, `google_calls`, `google_refreshes` and `google_scores` through `refreshFill()` | `no-store` | the owner's, and the write must carry the site's own `Origin`; the Google tab's **Refresh from Google now** — the day's fill on a press, with none of `POST /api/refresh`'s hours and nothing past `BUDGET.details.day`, inside the request so the answer counts it — **Keeping it current** |
| `ANY /api/admin/github/…` | `api/admin/github/[[path]].js` | none | `no-store` | the owner's; forwards to GitHub's API for this one repository with `GITHUB_TOKEN` — the repo, `contents/`, `git/`, `actions/runs` to read — and a write must carry the site's own `Origin`. How `/admin.html` writes stories, deals and places — **The token the site writes with** |
| `POST /api/refresh` | `refresh.js` | `google_venues`, `google_calls`, `google_refreshes` and `google_scores` through `refreshFill()` | `no-store` | open to anybody and sent by `.github/workflows/google-refresh.yml` three times from the afternoon, as the backstop — the fill's clock is `fillOnVisit()` off `POST /api/stats`, since GitHub's cron runs hours late or not at all; nothing before `FILL_FROM_HOUR` UTC, `KEEP_FOR_OPENS` kept back before `SPEND_ALL_FROM_HOUR`, nothing past `BUDGET`, and the fill runs inside the request so the answer counts it — **Keeping it current** |
| `GET /api/admin/top100` | `api/admin/top100.js` | `google_reranks`, `google_ranks` and `google_venues.rank` through `rerankIfDue()`; it calls Google for nothing | `no-store` | the owner's; the asking is the making — a UTC week's first ask renumbers the city — **The week's ranking, and the top hundred** |
| `GET /api/admin/youtube` | `api/admin/youtube.js` | none | `no-store` | the owner's; with `YOUTUBE_API_KEY`, every video of nine of the Azərbaycanfilm studio's playlists, and with `?check=1` the films' YouTube links that no longer play and the exact views of the rest, asked of the ids in `linked` in the films' index — saved by the owner into `azeri/data/youtube.json` and `youtube-check.json` for `tools/azfilms.mjs`, which orders the shelf by those views; calls YouTube only when opened, about thirty calls of a free ten thousand a day; `503 no-key` without the key — **The Azerbaijani corner** |
| `GET /api/admin/growth` | `api/admin/growth.js` | none | `no-store` | the owner's; `google_scores` read whole and joined to `google_venues` here — a row per place with two points, its pace over the last interval, what its size usually gathers fitted on each request, and a verdict; a jump is `check` and has no forecast — **How a place's count has grown** |
| `GET /api/v1/geocode` | `geocode.js` | none | `public, max-age=86400`, and Photon's answer a day | open to anybody, held by `MAX_Q`, five rows and the cache; searches Tallinn, or with a `near=lat,lng` inside Estonia the whole country, nearest that point first, the point rounded to a tenth of a degree for Photon so a town shares its cache; `/api/v1/ask` measures "near" through its `suggest()` — **Near somewhere** |
| `GET /api/v1/route` | `route.js` | `route_middles`, a long bike ride's middles | `public`: an hour for a walk, a ride or a drive, a minute for a bus or for a bike answer that carries a train | open to anybody, both ends inside Estonia — `inEstonia()` in `_lib.js`, one rectangle round the country — and rounded, nothing stored or counted; a walk, a ride or a drive is the router's first way in `meters`, `seconds` and `line` and up to `OTHERS` more in `others`, each in the same three fields — the map app and Rattatee read the first three, so they stay where they are — and each way's `steps`, where it turns, in the six words of `TURNS`, `roundabout` and `arrive`, which Rattatee has a recording for each of; by bike a way through a door out of `data/doors.json`, or as many as three, is offered where `reach()` makes it fifty metres and a tenth better than the router's best, up to twelve more router requests; by bike the way riders made the most of goes first where one qualifies, `ridden: true` beside it, through `riddenFirst()` — the ways already offered weighed by `riddenShare()` in `_sections.js`, a lookup in `ride_sections` by its key, fifty squares a statement in one batch, billed a row for each square somebody rode and at most 600, and the only time this route opens the database; by bike a way riding a street in `KEEP_OFF` — Tartu maantee, Liivalaia, Pärnu maantee from Vabaduse väljak to Liivalaia, Laagna tee — is asked for again round it and dropped where one keeps off, and where none does the way round riding least is gone round once more, up to eight more router requests, and a way that keeps off goes before one that does not, wherever it was found; by bike and on foot a stretch ridden out and straight back the same way is cut out of every way through `unspur()`, and two ways that are then one are offered once; by bike a way asked through a made-up point is asked for again through two points of its own line either side of it, through `settle()`, so whatever bend the router made to touch the point goes and the metres, seconds and turns are the router's, one more router request a way and three at the most; by bike a ride left with fewer than three ways is asked for one round each side of the straight line through `eitherSide()`, two more router requests and up to eight more a side where it has to be taken off a `KEEP_OFF` street, and a way round only fills a button that was empty; with `heading`, degrees from north rounded to `HEADING_STEP`, the router's ways are asked to set off within `HEADING_RANGE` of it, no door is offered and nothing is weighed, and one that is no number or that the router has no street for is no heading — Rattatee sends it when it finds a new way mid-ride; by bike `trains` — one peatus.ee request for bike and rail together and two router requests for the rides either side, through `departures()` and `byTrain()`; one train at most, the quickest of `TRAIN_PAIRS` pairs of stations, and only where it beats the quickest bike way counted from setting off, catchable and leaving within `TRAIN_WAIT`; by bike between two of the cities in `CITIES`, or a city and a town 20 km or more away, only the ends are refined and the long road between the junctions where the way leaves and enters the cities is kept in `route_middles` — read three rows by its key, the long way asked only for a pair with none, one ride in twenty and a middle thirty days old, through `longRide()`; and `"version": 1` with an `API-Version: 1` header on every answer, refusals included, which an installed build reads as this route rather than its old address — **Sharing a place**, **By bike, a train too**, **Why a version**, **Doors**, **Ways people have ridden**, **Roads a bike route keeps off**, **A way on either side**, **A long ride between cities**, **A new way sets off the way the rider is going** |
| `GET/POST /api/v1/rides` | `rides.js` | `rides`, found by `ridesIn()` in `_ridecells.js` through `ride_cells`, which a kept save fills and a drop empties; `ride_sections` through `tally()` in `_sections.js`, which is all a save with no session writes; `countUse()` under `map`, as `ride_save` | GET `public, max-age=300`, the box rounded outward to two decimals so one street is one read; POST `no-store` | the bike rides members recorded on the map, the confirmed bike routes — GET `?bbox=` answers the lines whose box meets it, newest first, with **no name and no user**, ever; GET `?since=<ms>` answers the same public lines saved after that moment, oldest first, twenty a page with a `next` cursor, off `idx_rides_created`, for `tools/doors.mjs` alone; GET `?mine=1`, or with no query at all, is the session's own rides for the account page's Your rides card and the app's, names, `timed` and no lines, `no-store`, empty signed out — and with `&lines=1` a `line` on each, thinned to a point every `THIN` metres, for the app's Where you rode; POST `rename` and `drop` take a session and touch only a ride filed under it, `404 not-found` otherwise; POST `save` takes a session and keeps the ride, or `anon: true` and none and **keeps nothing**: that ride is checked the same way, counted into `ride_sections` and let go, answered `{ counted: true }` with no `ride`, and `503 not-ready` without `ride_sections` — no row in `rides` or `ride_cells`, ever, nothing remembered of it and nothing capping it, so a ride whose answer was lost is counted again when it is sent again and only Cloudflare's own rate limiting would stop a program sending made-up ones; a save works the length out itself, takes `ENDS` metres off both ends before anything is stored or counted, keeps each point's time and accuracy in `track` where the page sent them — a column added by hand, so the insert is tried with it and again without — and refuses a point outside the four cities' boxes, `nearCity()` in `_lib.js`, an average past `FASTEST` and a ride past `DAY_RIDES` today; a line with a step past `GAP` in it — a pause, a train — is cut there and kept as a row a run, `ENDS` off each, and the answer is still one `ride`; each run's squares — each way it crossed them, and only the stretches of it that were a bike's — are nudged into `ride_sections`, which `/api/v1/route` weighs its bike ways by, after the rows are in for a kept ride, whose save does not wait on it, and in one batch of its runs for a counted one, whose save it is — a square that has counted `FULL` rides takes one in `TENTH`, and from `FULL` on each ride counted first takes a `MOST`-th off what the square holds, through `roomFor()` and `tally()` in `_sections.js`; the table holds what `rides` does not, so `tools/ridesections.mjs` is a last resort that needs `--lose-unkept`; `ready: false` and `503 not-ready` where the table is not applied — **Recorded rides** |
| `GET /api/v1/rides/<id>` | `rides/[id].js` | none | `no-store` | one ride whole to its rider only — the line, and `insight` out of `rideInsight()` in `_rides.js`: average, and from `track` the splits, the speed along the way, the top speed, the time standing; the track itself is never answered; signed out `401`, anybody else's ride the same `404 not-found` as none; answered through `api/v1/rides/[id].js`, which re-exports it, since the v1 table has one name an entry — **Recorded rides** |
| `GET /api/v1/profile` | `profile.js` | none | `no-store` | `readProfile()` in `_profile.js`, the one `/u/<name>` seeds from; public lists only — **Profiles** |
| `GET /api/v1/pass` | `pass.js` | none | `no-store` | `401` signed out, so `deal.html` offers the sheet; one draw per account, place and hour, an HMAC under `SAVE_SALT` and nothing stored, and `student`, true while `users.student_until` has not passed in Tallinn and false where the column is missing — **It is for members**, **A rate that is drawn**, **A rate for students** |
| `/flashcard` | `flashcard.js` | none | `no-store` | **flashcards** — `flashcard.html` with the `?d=` deck, lesson, song or conversation in its head, its `<main>` and its JSON-LD; `noindex` for a deck out of the database — the `/flashcards` skill |
| `GET/POST /api/feedback` | `feedback.js` | `feedback`, `feedback_hearts`; `users` and `sessions` through `_account.js` | `no-store` | saying something and hearting need no account; `say` with `as: 'name'` makes or enters one in the same request — **Feedback** |
| `GET /api/azeri` | `azeri.js` | none | `public, max-age=300`, the five minutes the files are kept per isolate | anybody, no session asked for and no row read — it was the members' door, a session or `401`, until 2026-11-21; the films are `azeri/data/index.json` and `films/<n>.json`, which `tools/azfilms.mjs` writes sorted and folded so a cold isolate stays inside its CPU, read through `env.ASSETS` and kept five minutes per isolate, searched and paged twenty at a time in memory, `page` by its number; with `tab=home`, `estonia`, `study` or `estonian` it is the home or a tab of the guide instead, `azeri/data/guide/<tab>.json`, whole and in the one of `az`, `en`, `ru` and `et` that `lang` names — the home with `sections` besides; the Azerbaijani places tab asks nothing here, since `FOOD_LIST` is in `assets/azeri.js`; the files' own addresses are a 404 through `DOCS_ONLY` in `_middleware.js` — **The Azerbaijani corner** |
| `/azeri` | `azeri.js` | none | `no-store` | `azeri.html` with a head of the address's own — the `?lang=` of the corner's four and Azerbaijani at the bare address, the tab, alternates naming all four — and, at the home, the home written into `#shelf` as text and its questions as an `FAQPage`; the other tabs get the head alone; the untouched page through `context.next()` where a file cannot be read — **Home** under **The Azerbaijani corner** |
| `GET/POST /api/azeri/community` | `azeri/community.js` | `azeri_posts`, `azeri_comments`, `azeri_votes`, `azeri_seen` | `no-store` for a member; signed out, the answer kept `ANON_TTL` in the colo and `private, no-store` to the browser through `privately()` | the corner's Community, read by anybody and written by an account: GET a page of twenty posts newest first or `sort=top`, this Tallinn week's by upvotes, continued on the key from the cursor in `after` or `before`, or `post=<id>` and its comments fifty at a time after `after`; a member's GET moves their `azeri_seen` row, which is what puts out the dot, and `news=1` is the dot itself, `communityNews()` in `_community.js`, null signed out; POST, signed in or `401 signed-out`, `post`, `edit`, `delete`, `comment`, `editcomment`, `uncomment` and `vote`, each reading the row's owner first and a 404 unless it is the session's — but the site's owner in `ADMINS`, `mod` in every answer, may take anybody's down; a deleted post with comments and every deleted comment are emptied and kept; caps `MAX_TITLE`, `MAX_BODY`, `MAX_COMMENT`, `POSTS_A_DAY` and `COMMENTS_A_DAY` in `_community.js`, restated in `assets/azeri.js`; `ready: false` and `503 not-ready` without the tables, which reach production by hand — **Community** |
| `/privacy` | `privacy.js` | none | `no-store` | `privacy.html` with `data/privacy.json` written in as text, in the `?lang=` language and English at the bare address — **Privacy** |
| `GET/POST /api/posts` | `api/posts.js` | `posts`, `post_texts` | `no-store` | a session for every POST, and a draft is a 404 to anybody but its owner; a body is blocks, never HTML, kept by `cleanBody()` in `_posts.js` — **Everybody's posts** |
| `/blog/sitemap` | `blog/sitemap.js` | none | `public, max-age=3600` | every published member's post, `<lastmod>` its last save; empty where the database cannot be read |
| `/blog` | `blog.js` | none | `private, max-age=0, must-revalidate` with a weak ETag; the colo copy under `blogKey()` for `PAGE_TTL`, for everybody, since it reads no session | `blog.html` with the post's head, JSON-LD and text, in English whatever `?lang=` says — **Found as text** |
| `GET/POST /api/v1/flashcard` | `api/flashcard.js` | `flashcard_decks`, `flashcard_cards`, `flashcard_known`, `flashcard_progress`, `flashcard_reports`; `countUse()` | `no-store` | **flashcards** — the decks are what `tools/decks.mjs` writes into `data/decks/`, read through `_decks.js`, and the source only for a gathered deck past `FEW_DECKS`; the page's words ride in every GET, in `DECK_LANGS`' three languages, all of them unless `?ui=` names the key prefixes wanted (empty for none), which is how Kohuke asks; a stage that has not opened sends no decks — the `/flashcards` skill |
| `GET/POST /api/chess` | `api/chess.js` | `chess_games`, `chess_moves`, `chess_notes`, `chess_asks`; `countUse()` | `no-store`: `you` and `legal` are per person | **chess** — the whole page in one GET, and `(game, ply)` the move's lock — the `/chess` skill |
| `GET /api/v1/say` | `api/say.js` | none | `public, max-age=2592000`; the edge copy keyed on the voice, the pace and the words | **flashcards** — Tartu's Estonian voice for a text `data/decks/spoken.json` lists, which `tools/decks.mjs` writes, and `404 not-a-card` for any other; honours `Range` — **Hearing it** |
| `POST /api/v1/ask` | `ask.js` | `visitor_counts` (`ask`) through `countAsk()`, after the answer and never for the owner | `no-store` | the one route that asks Workers AI, out of the allowance the live site shares; the model picks ids out of the slice it is given, and an id it invents is dropped — **Ask for somewhere** |
| `/list/<id>` | `list/[id].js` | none | `no-store` signed in; to anybody else `private, max-age=0, must-revalidate` with a weak ETag and the colo copy under the deployment, the lists mark and Google's two marks — `listsMark(env, true)` — for up to `MARKED_TTL` — KEPT IN THE COLO in `_shell.js` | `lists.html` with the list in its head, its seed and its `<main>`; a rename is a stranger's at the next visit, in every colo |
| `/lists` | `lists/index.js` | none | as `/list/<id>`, under `directoryKey()` and the lists mark, without Google's | everybody's lists, the first page seeded out of `_mostkept.js`, searched by `?q=` and ordered by `?sort=` — Most opened and Most saved last Monday's order; asks the mark signed in too, which makes the week's counts where they are due |
| `/lists/public`, `/lists/kept` | `lists/public.js`, `lists/kept.js` | none | — | 301s to `/lists`, the addresses it had before |
| `/u/<name>` | `u/[name].js` | none | `no-store` signed in; to anybody else `private, max-age=0, must-revalidate` with a weak ETag and the colo copy for `PAGE_TTL`, a minute, under the address with the name lowercased | `lists.html` with the profile seeded and as text, its head and `ProfilePage` built from the line under the name |
| `GET /api/v1/…` | `api/v1/[[path]].js`, and `api/v1/index.js` for the bare address | none | `public, max-age=300` and the colo copy keyed on the address for the public reads; a 404 a minute; the apps' addresses as their own routes | the public API — `places`, `places/<id>`, `lists`, `lists/<id>`, `types` — for anybody's code: `Access-Control-Allow-Origin: *`, `API-Version: 1`, errors `{ error: { code, message } }` in five codes; the map's own rows and none of Google's; the lists through `publicLists()` kept per isolate until a list changes, through `keptLists()`, and a lists answer's colo key carrying the lists mark; reads shared with `/mcp` through `functions/_public.js`; v1 only ever gains, and `node tools/apicheck.mjs --check` holds every answer to `data/api-v1.json`; a break is `/api/v2` and `SUNSET`. And every route the pages and the apps read, at `/api/v1/<name>` through `APPS` — the route itself, called, `functions/api/<name>.js` — with `places.js` at `find` and `lists.js` at `me/lists`, and `/api/v1/rides/<id>` a file of its own, `api/v1/rides/[id].js`; their old addresses under `/api/` a `410` through the middleware, but `/api/google`; nothing under `/api/admin/` — **The public API**, **The apps' routes, at their v1 addresses** |
| `/embed` | `embed.html`, static | none | as `_headers` | the map in another site's `<iframe>`, reading `/api/v1` alone; the one page `frame-ancestors *`, through `EMBEDS` in `_security.js` and `_headers` — **The map on your site** |
| `POST /mcp` | `mcp.js` | none | `no-store`; the roll, the taxonomy and the language index five minutes per isolate through `_lib.js`, and the Google rows out of `googleTable()` in `_lib.js` | the map and the public lists as an AI assistant reads them, over the Model Context Protocol: one JSON-RPC message in, one out, two read-only tools — `places` over `data/restaurants.json`, with Google's key, hours and category read off `google_venues` by `map_id` and trusted only at the same door, and `lists` over public lists through `readList()` and one read of `lists` and `list_items`, kept per isolate under the lists mark through `keptLists()` in `_public.js`, each searching unless handed an `id`, and the four names from before still answered — so Claude's permission card comes up twice and not four times — and ChatGPT's `search` and `fetch` over the map beside them, in the shape it needs outside Developer mode; `serverInfo` carries the title and icon; every answer `Access-Control-Allow-Origin: *`, `OPTIONS` a 204; no write, no `AI`; stateless and JSON only, `GET` a 405; a closed place is never answered, a private list is the same sentence as a missing one, a list read is not an open, and a database that is down costs the list tools and Google's hours and not the places; `node tools/mcpcheck.mjs --check` holds it to what an assistant is promised — **Read by an assistant** |

| `POST /flashcard/mcp` | `flashcard/mcp.js` | none | `no-store`; the index, `data/decks/words.json` and a deck's or a lesson's own file five minutes per isolate through `_lib.js` | **flashcards** — the decks and the grammar lessons as an AI assistant reads them, and the same door at `/mcp` on the flashcards' hostname, which `_middleware.js` answers by calling it; three read-only tools — `words`, a word looked up from Estonian, English, Russian or Azerbaijani in the folded list `tools/decks.mjs` writes; `decks`, the shelf or one deck whole; `grammar`, the lessons or one as Markdown — in `DECK_LANGS`' three languages, and ChatGPT's `search` and `fetch` beside them; no database, no session and so no gates and no progress; no song, song's deck or conversation is answered; the protocol is `functions/_mcp.js`, shared with `/mcp`, so a change to the handshake is a change to both; `node tools/mcpcheck.mjs --check` holds it too — **Read by an assistant, the flashcards** |

Eight routes serve a static page with a head of their own — `index.js` the
map, `flashcard.js` a deck, `blog.js` a post, `privacy.js` the policy,
`azeri.js` the Azerbaijani corner, and the three list routes the same
`lists.html` —
and the page out of the deployment, the escaping, the head swap, the seeding
and the filling of an element the page ships empty are in
`functions/_shell.js`. `index.js` writes its own tags rather than taking
`head()`, because a place has a photograph and a language for its card. The query each
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
| `SAVE_SALT` | saves, account and lists POST **fail closed**, `503 no-salt`, rather than store a weaker hash, and so do the one `/api/v1/flashcard` action that is filed under a fingerprint rather than a person and `/api/v1/pass`, whose answer is a hash under it — which takes every discount down with it, deliberately. Changing it later resets every cap, leaves the counts alone, and redraws every rolled discount from that hour on |
| `TURNSTILE_SECRET` | optional; set, a save without a token is 403 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional, and both or neither. Without a *usable* pair `/api/v1/account` answers `google: false`, every sheet draws the username and password alone, and `/api/google` sends a hand-typed request home. Nothing else changes. Usable is more than present: `googleReady()` trims both, requires every character of the id to be a letter, digit, dot, hyphen or underscore, requires it to end in `.apps.googleusercontent.com`, and requires it to be **longer** than that suffix — a value truncated to the bare suffix passes `endsWith()`, which is what broke the sign-in on the day it shipped. So a pasted newline, a zero-width character trimming cannot reach, a truncated id, or the secret in the id's box all read as absent rather than as a button that ends on Google's `invalid_client` page. Past those four, an `invalid_client` is the console and not the binding |
| `APPLE_APP_ID` | optional. The bundle ids `/api/v1/apple` accepts a token for, comma-separated; unset, it is the three in `APP_IDS` — `ee.tallinntastebuds.app`, the map's app, `ee.tallinntastebuds.kohuke`, the flashcards', and `ee.tallinntastebuds.rattatee`, the ride recorder's — and set, it replaces all three. Not a secret, and needed only for an app build signed under another id — `_apple.js` |
| `GOOGLE_MAPS_API_KEY` | optional, and **Production only**. Without it no Google place is refreshed and the directory keeps the export's numbers; `/api/admin/refreshes` answers `key: false` and the admin tab says so. In Preview as well it would be a second counter in a second database spending from the same free thousand a month, which is why it goes in one. `googleKey()` in `_refresh.js` trims it and holds it to the shape of a Google key, so a stray word in the box reads as absent |
| `YOUTUBE_API_KEY` | optional, and **Production only**. A Google key restricted to the YouTube Data API v3, read by `/api/admin/youtube` alone; without it that route answers `503 no-key` and nothing else changes. It is a key of its own rather than `GOOGLE_MAPS_API_KEY` with YouTube ticked, so neither key opens the other's API |
| `GITHUB_TOKEN` | optional, and **Production only**. A fine-grained token for this repository, Contents read and write and Actions read. Without it `/api/admin/github/` answers 503 `no-token` and `/admin.html` reads but cannot change anything — **The token the site writes with** in `docs/handbook.md` |
| `ADMINS` var | nobody is the owner: everything under `/admin/` is 404 and everything under `/api/admin/` is 403, to everybody. A list of `users.id`, never usernames, one per environment block because the two databases hold different accounts; `_admin.js` says why it fails closed |
| `AI` binding | `/api/v1/ask` answers `source: "none"`, `note: "no-ai"`, and the chat says nothing on the map answers. Everything else is untouched |

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
year of the model never being heard. And `/api/v1/ask` says which half
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
Google** in `docs/handbook.md` before changing any of it.

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
`MAX_NOTE 280` in `walk.js` is restated in `assets/walk.js`, whose comment
field is the only one that writes it;
`MAX_NAME 60` and `MAX_SIDE 60` in `flashcard.js` are restated in
`assets/flashcard.js`, which carries the two forms that write them;
`MAX_TITLE 120`, `MAX_BODY 5000` and `MAX_COMMENT 2000` in `_community.js` are
restated in `assets/azeri.js`, which carries the three fields that write them;
`MAX_FEEDBACK 500` in `feedback.js` is restated once, as `MAX_TEXT` in
`assets/feedback.js`, which carries the only field that writes it — and the
counter under that field reads `{n} / {max}` out of `data/ui.json` rather than
spelling the number, so the cap is two edits and not twelve; `MAX_NAME 80` and
`MAX_ADDRESS 120` as literal `maxlength: '80'` and `'120'` in the add-a-place
form in `assets/lists.js`; the username's 3–24 in `_account.js` —
`USERNAME_RE`, read by `asUsername()` alone, which every route that takes a
name calls rather than keeping a copy, `_profile.js` and `_visits.js` included
— as a `maxlength: '24'` on all three of `app.js`'s username fields — the
sign-up sheet's, the rename step's and the delete step's, where an account
with no password types its name to confirm —
on `flashcard.js`'s, one field worn by three views, and
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
hand it out. **The pins** in `docs/handbook.md`.

## The rules of a read

**Every read has a price, set before it is written** in `CLAUDE.md` is the
rule; this is how it is done.

**A read run by hand** — a question put to production through the Cloudflare
MCP tool rather than by a Function — brings 2,000 rows at the most, rule 6
there. `.claude/hooks/d1-write-gate.mjs` prices it from SQLite's plan before
it runs and asks the owner about a dearer one; its header says how a plan
becomes a number. Three things keep a question under the line: ask `EXPLAIN
QUERY PLAN` first, which reads nothing; never join a table's unpacked JSON
to itself — walk it once, with `LAG()` for the row before; and when a table
is priced as having no size, measure it and add its line to `SIZES` in the
gate, with the case that needed it in `CASES`.

- **Name the key the statement uses**, out loud, in the comment above it:
  "a lookup on (user_id, deck_id)", "today's rows by (day, kind)". A
  statement whose `WHERE` does not start where the key starts — `kind = ?`
  on a table keyed (day, kind, id), `day = ?` on one keyed (flow, day, …),
  `deck_id = ?` on one keyed (user_id, deck_id, …) — walks the table, however
  small its answer.
- **Measure it.** Run the statement through the Cloudflare MCP
  `d1_database_query` against production with real values; the answer's
  `meta.rows_read` is what D1 bills. Write the number and the date into the
  comment, the way `tagRoom()` in `_flows.js` and `AUTHOR` in `_posts.js`
  carry theirs.
- **Multiply it.** Rows per run times runs a day, the worst day: per page
  view, per colo every TTL, per isolate every TTL, per cron. Against five
  million. A route the apps call is called by every installed phone.
- **A list of keys goes in as `VALUES`, not as JSON under an `IN`.**
  `WHERE cell IN (SELECT value FROM json_each(?))` is billed two rows for
  every key asked, found or not — json_each's row, and the list SQLite
  makes of an `IN` — and a third for each found. A route's lookup of 412
  squares, 36 of them there, read 860 rows on 2026-11-19 under a comment
  that said 600 at the worst. `FROM (VALUES (?), (?), …) v CROSS JOIN
  table s ON s.key = v.column1` reads the rows that are found and nothing
  else: 36. D1 binds a hundred values a statement, so it is a batch of
  them, the last filled up with NULLs — `LOOKUP` in `_sections.js`.
- **Watch the column types on a join.** `posts.owner` was declared INTEGER
  and holds `users.id`, which is TEXT; SQLite compares the two by the
  INTEGER side, so `u.id = p.owner` could not use users' key and walked every
  account for every post read. A join on a column whose declared type is not
  the other side's is a walk until it is cast.
- **A total the page shows is a row, kept by the write.** Never a `SUM` or
  `COUNT(*)` over a history on a public route — `save_counts` beside
  `saves` is the pattern, and `RECOUNT_SQL` in `saves.js` the way it stays
  true.
- **A page of fifty, never a hundred rows a statement.** Rule 7 in
  `CLAUDE.md`. A `WHERE` that can match more than `PAGE` rows goes through
  `inPages()` in `_lib.js`, ordered by a key and continued after the last
  row's — `savedBy()` pages on `(owner, rowid)`, the save counts on
  `place_id`, a game's moves on `(game, ply)`, a person's added places on
  `(owner, created_at, rowid)` with a row-value cursor so a tie is neither
  skipped nor read twice. A cap on what can be stored does not stand in for
  the page. Never `OFFSET`: it walks every row it skips.
- **`MIN` and `MAX` are one row only on the key's first column.**
  `MIN(day)` on a table keyed by day reads one row; `MIN(day) WHERE kind = ?`
  reads every row until it finds that kind; `MIN(day)` on a table keyed by
  flow first reads all of it. `FIRST_DAY` in `_flows.js` is the way round
  the last: step from one flow to the next by the key.
- **After it ships, watch the meter.** `functions/_middleware.js` hands every
  route's `env.DB` through `meter()` in `_meter.js`, which adds up every
  statement's `rows_read` by the first table it names and writes it into
  `read_meter` every quarter of an hour; `/admin/stats` opens on today's, by
  table. A table climbing there that nothing new should have made dearer is
  the first sign. `braking()` is the brake a nice-to-have reader checks before
  it reads — the flag counter does — and it is true past `BRAKE` of the day.
- **A hundred rows an answer, at most.** A SELECT carries a `LIMIT` of a
  hundred or less — a number, or a constant bound to its `?` — or names its
  rows by a unique key, or is one aggregate row, or is asked for `.first()`.
  More than that is a page and a cursor, the way `inPages()` in `_lib.js`,
  `readPage()` in `_posts.js` and `mostKept()` do it. Rule 7 in `CLAUDE.md`.
- **Then `node tools/sqlcheck.mjs`.** A walk it reports is fixed, or added to
  `KNOWN` in the tool with what bounds it in numbers — the size of the table
  and why it stays that size, or how rarely it runs. "It is small" is not a
  bound; "a ring of sixty slots" is. A read it reports past a hundred rows is
  paged, or added to `ROWS` the same way — "one list's places, `MAX_ITEMS`,
  fifty" — and a statement it cannot read is made readable, or priced by hand
  in `UNREAD`.

## The rules of a write

Reading is free: `d1_database_query` answers a `SELECT` straight away, and
checking the state of a table is how everything here gets verified. Writing is
not, and the split is machinery rather than good intentions —
`.claude/hooks/d1-write-gate.mjs`, wired as a `PreToolUse` hook in
`.claude/settings.json`, classifies the SQL and hands back `allow`, `ask` or
`deny` — for `d1_database_query`, and since 2026-11-19 for every other door
into D1 a session has: `wrangler d1` in the shell, curl to D1's API, and any
MCP tool that names D1 or Cloudflare.
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
   `node tools/sqlcheck.mjs`, which asks SQLite how every statement reads —
   **The rules of a read** above. Then
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
   tool `d1_database_query` reads either without a prompt, 2,000 rows a
   read at the most — **A read run by hand** under **The rules of a read**
   — and writes to neither without one — see **The rules of a write**.
4. Rewrite the README paragraph the change made wrong, and the header. A
   route added, removed or gated differently is a step in somebody's
   diagram: the `ref` in `data/flows.json` that names it moves too, then
   `node tools/flows.mjs` — the validator fails on a `ref` to a file that is
   gone. A step the site can see somebody take also says what it is counted
   by, in `when` — a page out of `PAGES` in `_visitors.js` or a press name
   the README's **Analytics** table lists — or it draws with no number on
   `/admin/flows`. **Who uses the site, drawn** in `docs/handbook.md`.
5. The pass in `leave-it-better.md`.

## The commit

> Counts come from a counts table, not a `COUNT(*)` on every read
> A save is free again, and the account is the offer
> Merge the map into the directory, and read the week through one parser

The body says what the rows looked like before, what they look like after,
what it costs per request, and what has to be applied by hand and where.

## The pull request

**The pull request** in `CLAUDE.md` is the sequence, and this process adds:

- `node tools/functions-check.mjs` and `node tools/sqlcheck.mjs` beside the
  validator, every time.
- The body says what each statement it adds or changes reads, in rows,
  measured against production, and the day's worst.
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
  promised "letters" in eleven languages — which in Tallinn includes ü and õ, and
  in Kyiv a whole alphabet — so `jüri` was refused with the sentence it had
  just followed. Nothing in the code could show it; the sign-up funnel on
  `/admin/visitors` did, where `account_err_username` was the only refusal
  counted in its first three days. When a sentence under a field restates a
  pattern, read the sentence in a language that is not English before
  deciding the two agree, and when people give up on a form, read the funnel
  before the code: it says which word the route refused them with.
- A counter that re-read its whole history on every refresh. The flag
  counter on Discover asked `visitor_counts` by kind and by a span of days,
  which its key (day, kind, id) cannot answer, so every five minutes in every
  colo it walked all 18,439 rows three times: 46,258 rows a refresh. On
  2026-11-18 that spent the account's five million reads before noon, and
  every route that reads the database answered empty until midnight UTC. Its
  comment counted statements, not rows. **The rules of a read**, and `node
  tools/sqlcheck.mjs` behind them.
- An export taken out of `_lib.js` by the commit that wrote its replacement,
  while a route still imported the old name. An ES module resolves its
  imports before any of it runs and Pages bundles everything under
  `functions/` into one Worker, so the deployment went down whole rather
  than the one route, and nothing in CI had opened either file — the
  comment above `languageIndex()` is the record. `node tools/functions-check.mjs`
  loads every module now, in CI and in step 2 of **The steps**.
