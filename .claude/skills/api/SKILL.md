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
`functions/api/lists.js` and `functions/api/ask.js` are over the ~600-line
mark (`wc -l functions/api/*.js` is the current answer), so the reach there
is the functions you touch plus what they call and what calls them.

## Read first

- The README section for the feature: **Saves**, **Accounts**, **The
  account page**, **Lists**, **Profiles**, **Google venues**, **The
  directory**, **The pins**, **Ask for somewhere**. Each says what is cached, what is
  deliberately not, and where a count comes from. `grep -n '^## ' README.md`
  is the table of contents with line numbers.
- **Two databases, and never one** and **Setting it up**, before anything
  that touches a binding, a secret or the schema.
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
  and a load into two databases that only the owner approves — **The rules of
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

| Route | File | Writes | Cache |
|---|---|---|---|
| `/` | `index.js` | none; `index.html` with its head — `<html lang>`, title, description, canonical, the ten `hreflang` alternates, the card — its JSON-LD, and every open place written into `#list-body` as text, all in the language `?lang=` names, so a search engine indexes the map once per language and an AI assistant's fetcher reads the places without running a script. With `?spot=<id>` naming a place, the head, the card, the JSON-LD and the text are that place's, so a shared link unfurls as the restaurant and each open place is a page of its own. Falls through to the static file when it cannot read the data | `REVALIDATE`, the rule `_headers` gives the static page, with a weak ETag of the answer so the revalidation ends in a 304, plus the edge cache under `mapKey()` — the address with the language, the place and the deployment on it and nothing else, the deployment being `deployStamp()`, the asset server's ETags of the page and the three data files folded into one and read once per isolate, so a deploy that changed any of the four misses and the old copies are never asked for again; `MAP_TTL`, a day, only lets those go |
| `/*` | `_middleware.js` | none; locks everything under `/admin/` (a 404) and `/api/admin/` (a 403) to anybody but the owner — `adminUser()` in `api/_admin.js`, an account whose `users.id` `ADMINS` in `wrangler.toml` names — and 404s the retired `/stats` and `/google` to everybody; 301s `pages.dev` to `tallinntastebuds.ee`, and — **splitwise** and **flashcards**, each in a fenced block — serves `split.html` at the root of `splitwise.tallinntastebuds.ee` and `flashcard.html` at the root of `flashcard.tallinntastebuds.ee`, while 301ing every other path on either host back to the site. Both roots *call* their route rather than rewriting to the static file: splitwise's because that page's head is written per group, the flashcards' because a deck's head and its words are what a search finds. The flashcards' root was a rewrite for a day, when the page carried a `noindex` and had no route to call. **And every answer leaves with the security headers** in `_security.js` on it, whichever branch gave it — **The security headers** in `README.md` | as `_headers` |
| `GET /api/saves` | `saves.js` | none | `public, max-age=60`, weak ETag, plus the edge cache under `countsKey()` |
| `POST /api/saves` | `saves.js` | `saves`, then `RECOUNT_SQL`, in one `batch()`; purges the counts cache; every write that went through is counted through `countUse()` in `_visitors.js`, into `visitor_counts` and `usage_people` (**Usage, week by week** in `README.md`) | `no-store` |
| `GET/POST /api/account` | `account.js` | the GET carries `views`, how often `/u/<you>` was opened in the last seven days, out of `profile_counts` through `recentViews()` in `_visits.js` and left out where that table is not applied; `users`, `sessions`, `login_fails`, `username_holds`, `identities`; `claimDeviceSaves()` moves device saves onto the user and recounts, `username-change` releases the old name into a thirty-day hold, `about` writes the profile line, `lines` the same line in the site's other languages, `display` the name you go by over it, `links` the three handles under it, `speaks` the languages under those — the last three inside the one `users.links` JSON, each write carrying the others across through `mergeLinks()` in `_profile.js` — and `rows` the page of links under those, replacing `profile_rows` for the owner whole — their public lists among the rows as `{ list: <id> }`, stored as a row whose `url` is `/list/<id>`, and one that is not theirs and public dropped rather than refused; the GET and this write both answer the rows with every public list put in, the unplaced ones last — the changes here that ask for a session and not the password — and `google-name` makes the account a Google sign-in landed on — the last two are `enterAccount()` and `nameGoogleAccount()` in `_account.js`, which `feedback.js` reads too | `no-store`, `Set-Cookie ttb_s` |
| `GET /api/google` | `google.js` | `users`, `sessions`, `identities`, and the saves `claimDeviceSaves()` moves — and `visitor_counts`, one `signup` row a trip out and one a trip back, through `countSignup()` in `_visitors.js` after the redirect has gone, so `/admin/visitors` can say how many never came back from Google's screen (**Signing up** under **Visitors** in `README.md`). **One route asked twice**: with nothing it redirects to Google, with Google's `?code=` it is the way back — so there is one redirect URI to register per hostname rather than a pair to keep in step. Never answers JSON; every ending is a 302 to the `?then=` it was given, carrying one word in `?google=`. Off entirely without a usable `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` — see `googleReady()` — and then every sheet draws the username and password alone | `no-store`, `Set-Cookie ttb_s`, `ttb_g`, `ttb_gp` |
| `GET/POST /api/lists` | `lists.js` | `lists`, `list_items`, `list_keeps`, `added_places`; every write that went through is counted through `countUse()` in `_visitors.js`, into `visitor_counts` and `usage_people` (**Usage, week by week** in `README.md`) | `no-store`, on purpose: the owner reads it mid-edit |
| `GET /api/places` | `places.js` | none; `data/places.json` merged with open `google_venues`. With `?q=`, three letters or more, at most twenty of that roll by folded name, then by street — the blog editor's picker, which never downloads the whole roll. With `?ids=`, comma separated, fifty at most, just those places' id, name and street — the map's out of the catalogue, the rest out of `google_venues` hidden or shut included — for the cards in a post | `public, max-age=300` |
| `GET /api/venues` | `venues.js` | none; with neither parameter a 404, since the whole roll is `GET /api/admin/venues`. With `?ids=` naming Google keys, comma separated, fifty at most — only those, in the same row shape. That parameter is the map's find bar asking for the one venue it has just been used to look up: the phone, the website and the week, which `/api/places` does not carry. It is not a search endpoint and cannot become one, because SQLite cannot fold `Põhjala` down to `pohjala` and the bar does that in the browser — **Finding anywhere in Tallinn** in `README.md`. With `?map=` naming one of the map's own ids instead, the one row `map_id` joins to it, plus `of` — how many rows the last sync carried — which is what the panel for a place of mine closes with: **Google, on a place of mine**. Those two stay open to anybody, because the map asks them | `public, max-age=300` |
| `GET /api/admin/venues` | `api/admin/venues.js` | none; **the owner's** — the lock in `_middleware.js` answers anybody else 403 first. The whole `google_venues` table the directory shows, in the row shape `venueRows()` in `venues.js` builds for both routes. What `/admin/google` draws | `no-store` |
| `GET /api/admin/stats` | `api/admin/stats.js` | none — **the owner's**, the lock in `_middleware.js` answering anybody else 403 before the route or its cache is reached; `press_counts` ranked — the map's places in full with their zeros, the Google venues somebody has opened on the map (capped at `VENUES`), all fourteen filter chips named in the reading language, and the nine rail pills of `RAIL_PILLS` named by the label each already wears on the map — plus `lists`, every public list anybody has opened, most opened first and capped at fifty, each with its owner's username, whether it is still public, its running count and `country` — `[{ id, n }]` out of `list_counts` through `listCountries()` in `_visits.js`, null where that table is not applied — and `posts`, every member's post anybody has read, most read first and capped at fifty, each with its title in the reading language, its author's username, whether it has gone back to draft and its running count — and `held`, nine plain `COUNT(*)`s — accounts, saves and the places they are on, lists and the public ones, lists saved, feedback still up, decks made and places added by hand — about the site rather than about a press, each answering 0 on its own where its table is not applied; and on every place, `saves`, out of `save_counts`. Carries the page's words the way `/api/flashcard` does, through `wordsFor()` in `_lib.js`, so `/admin/stats` fetches nothing else. `ready: false` and empty arrays where the table is not applied yet, a figure of `held` 0 where its own table cannot be read | `private, no-store` to the browser, plus the edge cache under `statsKey()`, keyed on the route, the chosen language and `?device=` alone. `?device=` — `phone`, `tablet` or `desktop` — ranks the presses made on that device alone, the `<device>.<kind>` rows **By device** under **Visitors** in `README.md` describes; the saves and `held` are the same under any device |
| `POST /api/stats` | `stats.js` | open to anybody, every page sends it; `GET` here is a 404, the ranking being `/api/admin/stats`, which imports `PLACE`, `FILTER`, `RAIL`, `RAIL_PILLS` and `DEAL_FILTER` from this file. Writes `press_counts` — one upsert, `n + 1`, and a second under `<device>.<kind>` in the same batch where the body says `device` (**By device** under **Visitors** in `README.md`). `{ kind, id, device }`, `kind` being `place`, `filter`, `rail`, `layout`, `look` or `style`; a place is checked against the map's roll or `google_venues` (`hidden = 0`), and is only ever the map's — a card on the owner's `/admin/google` sends `venue` instead, which is counted nowhere and only asks the refresh below; a filter against `data/taxonomy.json` plus `discount`, a pill against `RAIL_PILLS` — the nine ids in `#rail` across its two shapes, `RAIL_PRESS` in `assets/app.js` being the copy to keep it in step with — and a layout against `LAYOUT_IDS`, the two rows that say how many strangers were dealt the short rail and how many of them opened a place with it (**The short rail** in `README.md`), and a look against `LOOK_IDS`, the six rows that say how many people new to the site were dealt each of the directory's two looks and how many of them opened and kept a list from it that day (**The lists' two looks** in `README.md`), and a style against `STYLE_IDS`, the sixteen rows that say how many people new to the site were dealt each of the four colours and how many of them opened something that day, came back on a later day and chose another colour (**The four styles, dealt** in `README.md`), so the table only ever holds things this site draws. Two more kinds are handed on rather than counted here: `profile` (`{ id: name, from: referrer }`) and `profile-press` (`{ id: name, what, from }`) write `profile_counts` through `countView()` and `countPress()` in `_visits.js` — a press filed under where its visitor came from as well as under what was pressed — the owner's own numbers, read back only on `/insights`, and never counted for the owner themselves. A `list` open — `press_counts` too, what orders `/lists` — is refused for the list's own owner by the session as well, and so is a `post` read — `press_counts` again, a member's published post drawn on `/blog`, read back to its author alone on `/insights` through `postViews()` in `_visits.js` — and a profile, list or post open is counted once a UTC day per visitor through `firstToday()` in `_visits.js`, which writes `view_seen`: an HMAC under `SAVE_SALT` of the address, the user agent and the thing, never the address itself, and counts everything where that table or the salt is missing. A list open that counted is also filed under its country into `list_counts` — one row per list, per day, per country — through `countListOpen()` in `_visits.js`, after the answer and in a statement of its own, so a database without that table still orders `/lists`. And two more for the whole site: `arrive` (`{ id: path, first, back, who, from, layout, style, asks, device, at, tag }`, a page opened — `asks` the two letters the browser asks for, `device` phone, tablet or desktop, `phone` the `<rail>:<colour>` a phone newcomer was pinned to that day, `at` the query it was opened with and `tag` its `?from=` — the owner's own, or `share`, which every Share button puts on the link it hands out) and `leave` (`{ id: path, secs, presses, places, langs, moved, who, layout, style, phone, searches, about }`, a stretch of one on screen with the presses and the places opened meanwhile — places on the map only — the same seconds by language, the language switches pressed, the words typed into a search field, and the stories, posts, decks and discounts the page said it was about, each id held to the file the site ships it in — plus `first` and `lang`, the language a browser's first page today arrived in — each language checked against `data/ui.json`), both sent by `assets/track.js` from every page but `/admin/`, and counted into `visitor_counts` by `countArrive()` and `countLeave()` in `_visitors.js` — **Visitors** in `README.md` — unless the request carries the owner's own session (`adminUser()` in `_admin.js`), which is answered `{ok:false}` and counted nowhere, `flow_counts` included. A `leave` also carries `trail`, `at`, `opened` and `earlier` — the presses in the order they first happened, the on-screen second into the stretch each happened at, whether this is the page's first report, and the step before them — which `countFlows()` in `_flows.js` counts into `flow_counts` for the diagrams on `/admin/flows`, beside the visitors' batch and never inside it, see `GET /api/admin/flows` below; and which `countLeave()` reads a second way, a page's first report being a view that reported at all (`left`), one that pressed nothing (`idle`) and, where the step before was on another page, a move between the two (`nav`) — **The views that reported, and where a visit goes** under **Visitors** in `README.md`. A place and a chip are counted once per page load and a pill every press, which **Statistics** in `README.md` says why. **A place Google lists also refreshes its row** — a Google key directly, a map slug through `map_id` — after the answer has gone and through `waitUntil`, when that row is over thirty days old — `refreshOnOpen()` in `_refresh.js`, which writes the seven moving columns of `google_venues`, `google_calls`, `google_refreshes` and `google_scores` — the last kept for good, every rating and review count Google has given — inside a budget of 32 calls a day and 950 a month, and does nothing without `GOOGLE_MAPS_API_KEY`. **Keeping it current** under **Google venues** in `README.md`. Every ending is 200 — `{ok:false}` for anything that did not count — because a press nobody counted is not a visitor's problem. | `no-store` |
| `GET /api/admin/visitors` | `api/admin/visitors.js` | none — **the owner's**, behind the same lock as `/api/admin/stats`; one range of `visitor_counts` through `readVisitors()` in `_visitors.js` over `?days=` — `1`, `7`, `28` or `90`, `SPANS` there, anything else answered as 7 — with the page's words beside it through `wordsFor()`: `now` and `before` (visitors, returning, views, seconds, presses), the bars, the pages named in the reading language, each with its views, seconds, the views that reported how they ended and the ones that pressed nothing, `entries` — the page a visitor's day began on — and `moves` — pages opened one after the other in one tab, both named — countries, sources, presses, `languages` — visitors and time per language, new and returning — `switches`, the pairs somebody changed between, `asked` — visitors by the language their browser asks for, marked spoken or not — `hours`, page views by the hour of the day in Tallinn, `devices`, visitors by phone, tablet or desktop, `signup`, every step of the sign-up funnel by name over every page, `made`, the pages people got in on, and `about`, which stories came up and were watched to the end, which posts were read and decks opened, and which discounts were shown and verified, `today` — today's visitors, sign-ins and accounts made, per rail and for no rail yet — `cohorts`, new against returning, `phones`, the twelve `<rail>:<colour>` cells of phone newcomers' visitors and seconds (**Time on phones** under **Visitors**), and `layouts`, the two rails over the same days, with `dealt` beside them: the four `layout` rows of `press_counts`, how many strangers each rail was dealt and how many opened a place, all-time — and `looks`, the six `look` rows the same way for the directory's two looks, and `styles`, the sixteen `style` rows for the four colours, all read in the same query — and `colours`, the four colours over the same days as `layouts`, the same shape, out of `visitor_counts`' `style` kind. `ready: false` where the table is not applied. What `/admin/visitors` draws; **Visitors** in `README.md` | `private, no-store` to the browser, plus the edge cache under `visitorsKey()`, keyed on the language, the range and the device. `?device=` reads one device's half of the table, `forDevice()` in `_visitors.js`, and the answer says which in `device` |
| `GET /api/admin/found` | `api/admin/found.js` | none — **the owner's**, behind the same lock as `/api/admin/visitors`; one range of what `countArrive()` and `countLeave()` in `_visitors.js` count under **HOW THEY FOUND IT** there, through `readFound()`, over `?days=` — `1`, `7`, `28` or `90`, anything else answered as 7 — with the page's words beside it: `now` and `before` (visitors from search, from other sites, pages opened by tagged `?from=` links — the owner's own and the Share buttons' `share` — searches typed here), `engines`, `lands` — the address each search visitor landed on, with its engine — `refs`, the pages elsewhere that linked here, `tags`, and `searches`, each with `nothing`, how often those words found nothing, and `since`, the first day any of it was counted. The words typed into a search engine are not in it and cannot be: **How they found it** in `README.md`. `ready: false` where the table is not applied | `private, no-store` to the browser, plus the edge cache under `foundKey()`, keyed on the language, the range and the device, `?device=` as for `/api/admin/visitors` |
| `GET /api/admin/live` | `api/admin/live.js` | none — **the owner's**, behind the same lock as `/api/admin/visitors`; `minutes`, pages opened in each of the last thirty minutes, oldest first and the minute still going last, out of `visitor_live` through `readLive()` in `_visitors.js`. That table is a ring of sixty rows keyed on `minute % 60` that `countArrive()` writes one upsert into per page opened, as a statement of its own so a missing table never fails the day's batch. The Right now card on `/admin/visitors` asks again every minute while it is on screen. `ready: false` where the table is not applied; **Right now** under **Visitors** in `README.md` | `no-store`, deliberately: an answer five minutes old is not right now |
| `GET /api/admin/flows` | `api/admin/flows.js` | none — **the owner's**, behind the same lock; one diagram out of `data/flows.json`, named by `?flow=`, over `?days=` — `1`, `7`, `28` or `90`, anything else answered as 7 — out of `flow_counts` through `readFlows()` in `_flows.js`, walked: for each of `all`, `out` and `in` (whether the page view's request carried a session), `views`, `steps` by id with the counted steps' zeros and every step the walk could reach, `arrows` by `from>to`, `pairs` by the same whether an arrow joins them or not, and `moves`, the pairs none does, `stopped` — a counted step's people who took no counted step after it and were not walked into an end — and `times`, each counted step's time at it as a count per bucket of `buckets`, the edges `BUCKETS` in `_flows.js` that also ride in the answer; with `counted` and `handover`, the ids of the steps that carry `when` and the ones that begin on somebody else's device. And `via`, `[{ id, views }]`, the segments the range has of how a tab arrived — `src:<source>` or `tag:<?from=>` — the twelve busiest, each walked under `who` by its id the way `out` is; **Arrived via** in `README.md`. A diagram that does not exist is a 404, `ready: false` where the table is not applied. What lays the numbers on `/admin/flows`; **The numbers on it** under **Who uses the site, drawn** in `README.md`. The counting is `countFlows()` in the same module, called beside `countLeave()` by `POST /api/stats` for every `leave`: the trail — `trail`, the presses in the order they first happened, `at`, the second each happened at, which files a time at each step under `t:<step>:<bucket>`, `opened`, whether the report is the page's first, and `earlier`, the step before the trail's first, carried across a tab's pages in `sessionStorage` — matched against each diagram's `when` and counted once per page opened as a step and as a pair, under `in` or `out` by `sessionUser()` — and again under the tab's segment off `via`, the `{ tag, from }` the tab's first page kept, a tag capped at twenty a day — in a batch of its own so neither table's absence fails the other | `private, no-store` to the browser, plus the edge cache under `flowsKey()`, keyed on the diagram, the range and the device. Every fact is filed again under the flow `<device>.<flow>` where the report says `device`, and `?device=` reads that half |
| `GET /api/insights` | `insights.js` | none; one person's own numbers about `/u/<them>` over `?days=` — `7`, `28`, `90` or `0` for all time, `SPANS` in `_visits.js`, anything else answered as 7 — out of `profile_counts` through `readInsights()`: the figures, the range before, the line, the sources with their clicks, the countries and what was pressed — plus `lists`, every list of theirs with its all-time opens out of `press_counts` through `listViews()` and, under `country`, where each was opened from out of `list_counts` (null where that table is not applied), read on its own so it survives `profile_counts` being absent — and `posts`, every post of theirs ever published with `titles` by language, `status` and its all-time reads out of `press_counts` through `postViews()`, read on its own the same way. **The session is the only way to ask**: no name is taken, so nobody can read anybody else's. `user: null` signed out, `insights: null` where the table is not applied | `no-store` |
| `GET /api/admin/refreshes` | `api/admin/refreshes.js` | none; the report behind the **Google** tab on `/admin.html` — whether `GOOGLE_MAPS_API_KEY` is set (a boolean, never the value), the day's and month's calls against `BUDGET` in `_refresh.js`, how much of the directory is refreshed and due, the last fifty lines of `google_refreshes`, and `map` — Google's `status` and whether it is `missing` on every `google_venues` row with a `map_id`, which the tab lays against `data/restaurants.json` to offer the pull request that marks a place temporarily closed or reopens it. **The owner's**, like everything under `/api/admin/`: the lock in `_middleware.js` answers anybody else 403 first, so the tab fills when the owner is signed in on the site. `ready: false` where the tables or `refreshed_at` are not applied | `no-store` |
| `GET /api/admin/top100` | `api/admin/top100.js` | **the owner's**, behind the same lock; **the asking is the making**: `rerankIfDue()` in `_rank.js` renumbers `google_venues.rank` for every rated row in one statement the first time this is asked in a new UTC week — the claim is a row in `google_reranks`, `INSERT OR IGNORE` on the week's Monday — and keeps the week's positions in `google_ranks`; then answers the week's top hundred out of `topOfWeek()`, each with `rank` and `was`, its position in the ranking before, plus `week`, `at`, `next`, `previous`, `ranked`, `moved` and `entered`. After the answer, through `waitUntil`, `refreshTop()` in `_refresh.js` asks Google about the top hundred's rows older than thirty days, twenty-four at a time inside `BUDGET`, logged under source `top`. What the Top 100 tab on `/admin/google` draws; **The week's ranking, and the top hundred** under **Google venues** in `README.md`. `ready: false` where the two tables are not applied | `no-store` |
| `GET /api/geocode` | `geocode.js` | none; proxies Photon for the add-a-place form and for the Where sheet behind the map's locate button, where a typed street becomes the dot. **Open to anybody** since that sheet: bounded by three letters in, `MAX_Q`, five rows out and the cache, not by who asks; its `suggest()` is also what `/api/ask` measures "near" from | `public, max-age=86400`, plus the upstream call cached a day |
| `GET /api/route` | `route.js` | none; the way between two points, `?from=<lat>,<lng>&to=<lat>,<lng>&mode=foot|car|bus`, both inside `nearTallinn()`, the end points rounded so a street is one upstream request. `foot` (the default) and `car` answer `{ meters, seconds, line }` out of the OpenStreetMap Germany foot and car routers, `line` thinned to 600 points; `bus` answers `{ trips: [{ seconds, legs }] }` out of peatus.ee's journey planner, the Transport Administration's OpenTripPlanner, leaving now — up to three journeys with a ride in them, each leg its `line` and, for a ride, `name`, `color`, `from` and `at`. `400 bad-points` or `bad-mode`, `404 no-route`, `422 too-far` past ten kilometres on foot, `429 busy`, `502 upstream`. **Open to anybody**: both ends are the caller's own and a place's, nothing is stored or counted, and the bound is the box. What `showRoute()` in `assets/app.js` draws when the arrow in a place's top strip is pressed — **The way there** under **Sharing a place** in `README.md` | `public, max-age=3600` for a walk or a drive, plus the upstream cached a day; `max-age=60` for the bus |
| `GET /api/profile` | `profile.js` | none; one person's public lists — in the order they put them, each with `at`, the row of their page it stands before, out of `placeLists()` in `_profile.js` — their keep total, their line's versions in other languages keyed by code, the languages they speak as codes, their page of links out of `profile_rows`, and whether `assets/faces/<name>.jpg` exists in the deployment | `no-store` |
| `GET /api/pass` | `pass.js` | none; the door in front of every discount — `401` where there is no session, so `deal.html` offers the sign-in sheet instead of a code — carrying one number for the account, the place named by `?r=` and this hour, an HMAC under `SAVE_SALT`, which `assets/pass.js` counts up the run of a deal with a roll | `no-store` |
| `/split` | `split.js` | **splitwise** — none; `split.html` with the group named by `?g=` written into its head, so a pasted link unfurls as the group. `functions/_middleware.js` calls it for the subdomain's root too | `no-store`, `noindex` |
| `/flashcard` | `flashcard.js` | **flashcards** — none; `flashcard.html` with the deck — or the grammar lesson, or the song — named by `?d=` written into its head **and into its `<main>` as text**, so a search for what an Estonian word means finds the deck — the head in English, the text in all three languages the cards carry, one `<dt>` and up to three `<dd>`s — **and the same deck again as JSON-LD**, a `DefinedTermSet` of `DefinedTerm`s with the three glosses language-tagged, which is what an assistant's crawler reads instead of inferring a description list. `_middleware.js` calls it for that subdomain's root too. Indexable for a deck out of `data/decks.json`, `noindex` for one out of the database, which needs a session no crawler has | `no-store` |
| `GET/POST /api/split` | `api/split.js` | **splitwise** — `split_groups`, `split_members`, `split_expenses`, `split_shares`, `split_settlements`. Every write that went through is also counted through `countUse()` in `_visitors.js`, into `visitor_counts` and `usage_people` — **Usage, week by week** in `README.md`. **Reading one group needs only its code**, no session — holding the link is the permission, see `groupById()`. **Every write needs a session and a membership**: each action but `create` and `join` reads the caller's own membership first, and a non-member is told the group does not exist | `no-store`, for the reason `lists.js` is |
| `GET/POST /api/feedback` | `feedback.js` | `feedback`, `feedback_hearts` — and `users`/`sessions` through `enterAccount()` in `_account.js`, which is the one route besides `account.js` and `google.js` that can mint an account: `say` with `as: 'name'` and no session makes one or signs into it in the same request, or — where the browser holds `/api/google`'s sealed note — names the Google account that has just proved itself, so nothing on that page sends anybody to the map and back. **Saying something and hearting need no account**, filed under the device id the way a save is; `remove` needs the row's owner. Both tables arrive by hand and every read here survives their absence | `no-store` |
| `/privacy` | `privacy.js` | none; `privacy.html` with the whole policy out of `data/privacy.json` written into its `<main>` as text, in the language `?lang=` names — English, the version that counts, at the bare address and for a language the file does not have — with that language's title, description and canonical in its head and its `<html lang>`. Links in a paragraph are `[words](/path)` or `[words](https://…)`. `tools/validate.mjs` holds every piece to every language. Falls through to the static file when it cannot read either. **Privacy** in `README.md` | `no-store` |
| `GET/POST /api/posts` | `api/posts.js` | `posts`, `post_texts` — the blog members write. **GET**: `?id=` one post whole, every language with its body, a draft only to its owner and to anybody else 404; `?by=<name>` one person's published posts; `?mine=1` the session's own, drafts included; nothing, everybody's published — each list `PAGE_SIZE` rows with every language's title and standfirst and never a body, `next` the cursor for `?before=`. **POST**, session required: `save` (`id?`, `lang`, `texts`, `publish`) makes or replaces a post whole, `delete` removes one — both read `posts.owner` first and answer 404 to anybody else. What a body may hold is blocks, never HTML, kept by `cleanBody()` in `_posts.js` — a place card naming the map's id or a `google_venues` key, which `save` looks up by the ids the post carries through `venuesByIds()` — which holds the caps `MAX_TITLE 120`, `MAX_LEAD 280`, `MAX_BODY 20000`, `MAX_POSTS 200`, `MAX_NEW_A_DAY 10`, restated in `assets/write.js`. `ready: false` and every POST 503 where the tables are not applied — `postsReady()`. **Everybody's posts** under **The blog** in `README.md` | `no-store` |
| `/blog/sitemap` | `blog/sitemap.js` | none; every published member's post as a sitemap, `<lastmod>` its last save, named in `robots.txt` beside `sitemap.xml`; empty where the database cannot be read | `public, max-age=3600` |
| `/blog` | `blog.js` | none; `blog.html` with the post named by `?post=` written into its head — title, description, canonical, card and a `BlogPosting` in JSON-LD, or a `Blog` listing every post on the index — **and into its `<main>` as text**, every paragraph with its `[words](/path)` links made links and every other post linked under it, so a search for where to eat finds the post that answers it. English whatever `?lang=` says; `noindex` for a `?post=` that names nothing. A `?post=` that is a member's published post gets its own head, a `BlogPosting` with a `Person` author, and its text in the language it was first written in; `?by=<name>` is one person's posts; the index carries the newest page of members' posts as text after the house's. **Found as text** and **Everybody's posts** under **The blog** in `README.md` | `private, max-age=0, must-revalidate` with a weak ETag, plus the edge cache under `blogKey()` — the address with `?post=` or `?by=` on it — for `PAGE_TTL`, a minute, stamped with the deployment and kept for everybody, since the route reads no session |
| `GET/POST /api/flashcard` | `api/flashcard.js` | **flashcards** — `flashcard_decks`, `flashcard_cards`, `flashcard_known`, `flashcard_reports`. Every write that went through is also counted through `countUse()` in `_visitors.js`, into `visitor_counts` and `usage_people` — **Usage, week by week** in `README.md`. The decks the site ships are `data/decks.json` read through `dataFile()`, and they are answered to anybody, signed in or not. **Every GET answer also carries the page's words**: `?lang=` is the page's candidates in order, `wordsFor()` in `_lib.js` picks the first `data/ui.json` speaks, and `lang`, `ui` — that one language's block — and `langs` — three codes with each language's own name, for the switch in that page's header — come back beside the decks, as do `words` — how many shipped cards this person knows, across every deck — and `gates`, what *Getting by* and *Going deeper* open at, which the page prints and never decides: `GATES` in the route is the one copy, **Which decks are open** under **Flashcards** in `README.md` is why a hundred and four hundred. **A stage that has not opened sends no decks**: `shutAt()` filters them out of the list, signed out included — a stranger is nought words and gets *First words* and *At a restaurant*, which has no `GATES` entry and so is never shut — and the page draws the heading and the line saying what opens it out of `gates` and `words`. A deck asked for by `?deck=` is never filtered, whatever stage it is in, because the page has to draw the card that says so and a search result is the one way in from outside. **That page speaks three languages where the site speaks ten**: every `wordsFor()` call in it passes `DECK_LANGS` from `_lib.js`, the three `data/decks.json` writes a card's back in, which narrows the switch and the language the page is read in together — **Three languages, not ten** under **Flashcards** in `README.md`, so the page fetches nothing else on the way in and asks again only when somebody picks a language. **Everything in the database needs a session but one**, the two actions that only say a card was known included — the exception is `report`, which says a shipped card is wrong, is filed under a hashed network fingerprint rather than a person and is the only thing here that wants `SAVE_SALT` — and **a deck somebody wrote has one reader**: every read of one goes through `deckOf()`, which takes the session's own id, and somebody else's answers as not found. The boxes live in `box` and `due_at` on `flashcard_known` — a card is due only in box nought, since a card known stays known (**The spacing, which is off** under **Flashcards** in `README.md`) — added to that table after it was deployed — `readingBoxes()` is `readingPins()`'s pattern and is what makes the route work on a database the `ALTER` has not reached. **A shelf deck, lesson or song carries `taste`** where `data/decks.json` gives it one, the line of Estonian its card on the page's Start view shows, **and `added`**, the day it went in, which is what that view calls new for two weeks — **The menu, and Start** under **Flashcards** in `README.md`. **The grammar lessons ride in the same file and the same answers**: the list carries `lessons`, each with a `read` flag, `?deck=<lesson id>` answers one with its body, and Got it is the `knew` action under the reserved deck id `grammar` — `GRAMMAR_DECK` — which is one row in `flashcard_known` that nothing counting cards can see; **Grammar, which is read rather than turned over** under **Flashcards** in `README.md`. **The songs ride the same way**: the list carries `songs` with a `heard` flag, `?deck=<song id>` answers one whole — the video, the verses and `words`, each word's `deck` named as well as pointed at — and Heard it is `knew` under `songs`, `SONG_DECK`; **Songs, which are listened to** | `no-store`, for the reason `lists.js` is |
| `GET/POST /api/chess` | `api/chess.js` | **chess** — `chess_games` (its `opponent` column for duels), `chess_moves`, `chess_notes`, `chess_asks`. Every write that went through is also counted through `countUse()` in `_visitors.js`, into `visitor_counts` and `usage_people` — **Usage, week by week** in `README.md`. Nothing links to the page yet: the door on the rail is the last task in `.claude/skills/chess/TASKS.md`. The GET answers the whole page at once — `you` (`house`, `member` or `visitor`; the house is a session whose id `adminIds()` in `_admin.js` names), the house's `record`, the public games' `score`, the `public` game, `mine`, the `queue` (each waiting game's id beside it, for the house alone) — each game with its moves, `legal` only when it is the reader's turn, and `abandon` only for the house while it may end a private game without a result, worked out by `_chess.js` so the browser runs none of the rules; `?lang=` adds the words through `wordsFor()`, all ten languages. The public game carries `notes`, the lines left for whoever moves next, `mine` worked out from the session or from `?client=`, the device id the page adds to a read without ever minting one; `null` where `chess_notes` is not applied, read on its own so the board never waits on it. The answer also carries `duels`, the reader's games and challenges against other members, and `duel`, the one open on the page off `duel=` — `null` both where `chess_games` has no `opponent` column yet, asked after on its own the way `chess_notes` is — and `?find=` answers a member the first ten usernames starting with what they typed. Every game being played also carries `asks`, `declined` and `mayAsk` — the asks to give it up or draw it that stand on it and what this reader may press, worked out by `standing()` from `chess_asks` and the moves on every read, never kept; absent where that table is not applied. The POST takes `move`, `undo`, `new`, `join`, `leave`, `start`, `ask`, `unask`, `refuse`, `abandon`, `note`, `unnote`, `hide`, `challenge`, `accept`, `decline`, `cancel` and `claim`, each answered with the same shape — `undo` only from whoever the last move was filed under, within ten seconds, and never for a move that ended the game; `ask` is one person's resignation on the spot, or one of the two names Everybody's give-up or draw needs, and a public game ended by an ask starts the next one itself; the table in the chess skill's `SKILL.md` says who may do which. **A move replays the game from `START` through `play()` before it is filed**, and the primary key `(game, ply)` is the lock: of two moves at one ply the second is `409 moved`, carrying the board. **Anybody may move for Everybody**, a visitor under the device id, which must be a v4 UUID and is refused `400 client` as `saves.js` refuses it. **Anybody may leave a note on the public game too**, capped five an hour by the hashed fingerprint feedback is capped by, so `note` fails closed `503 no-salt` without `SAVE_SALT`; `unnote` only by whoever it is filed under, `hide` only by the house. `ready: false` and every POST `503 no-database` where the tables are not applied. **Chess** in `README.md` | `no-store`: `you` and `legal` are per person |
| `GET /api/say` | `api/say.js` | **flashcards** — none; `?text=` said aloud as `audio/wav` in Mari's voice, by the University of Tartu's Estonian text-to-speech. Speaks only the front of a card, the Estonian of a card's sentence or a line of a song in `data/decks.json`, exactly, and answers anything else `404 not-a-card`, so it is not an open proxy on somebody else's goodwill; `502 no-voice` when Tartu does not answer within fifteen seconds, and the page goes quiet with one line. Honours a `Range` header, answering `206` with the slice: Safari's first request for any media is two bytes of it, and an iPhone may not play a file from a server that answers that with all of it. Nothing is stored anywhere but Cloudflare's cache, keyed on the voice, the pace and the words; the `take=` the page adds is its own cache-buster for the browser and is not read here — change `VOICE` or `SPEED` and bump `SAY_TAKE` in `assets/flashcard.js` with it. **Hearing it** under **Flashcards** in `README.md` | `public, max-age=2592000`, plus the edge cache keyed on the voice, the pace and the words |
| `POST /api/ask` | `ask.js` | `visitor_counts`, the kind `ask` — how each question ended and what its answer was made of, through `countAsk()` in `_visitors.js` after the answer has gone, never for the owner and never the words (**What the chat was asked** under **Visitors** in `README.md`); narrows the two rolls to what a question could be about and puts it to Workers AI; measures "near" from the place named through `geocode.js`, or from the visitor's own dot sent as `here` | `no-store` |
| `/list/<id>` | `list/[id].js` | none; `lists.html` with the list unfurled, and written into its `<main>` as text | `no-store` to anybody signed in; to everybody else `private, max-age=0, must-revalidate` with a weak ETag, plus the edge cache under the list's address for `PAGE_TTL`, a minute, stamped with the deployment — **Kept in the colo** in `_shell.js` |
| `/lists` | `lists/index.js` | none; `lists.html` with the first page of everybody's lists seeded in — with the five Google lists as `start`, and each row's places as `dots` — searched when the address carries `?q=`, ordered by `?sort=` (`kept`, `new`) | `no-store` to anybody signed in; to everybody else the same minute in the edge cache as `/list/<id>`, under `directoryKey()` — the address with `?q=` and `?sort=` on it |
| `/lists/public` | `lists/public.js` | none; 301 to `/lists`, the address this page had before it was shortened | — |
| `/lists/kept` | `lists/kept.js` | none; 301 to `/lists`, the address it had before that | — |
| `/u/<name>` | `u/[name].js` | none; `lists.html` with the profile seeded in, written into its `<main>` as text, its head built from the line under the name — the title, the description and a `ProfilePage` in JSON-LD — so a search for the person finds it | `no-store` to anybody signed in; to everybody else the same minute in the edge cache as `/list/<id>`, under the address with the name lowercased |

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
`tallinntastebuds-preview` at the top level (what `wrangler pages dev` reads)
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
| `GOOGLE_MAPS_API_KEY` | optional, and **Production only**. Without it no Google place is refreshed and the directory keeps the export's numbers; `/api/refreshes` answers `key: false` and the admin tab says so. In Preview as well it would be a second counter in a second database spending from the same free thousand a month, which is why it goes in one. `googleKey()` in `_refresh.js` trims it and holds it to the shape of a Google key, so a stray word in the box reads as absent |
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
3. **Drive it under `npx wrangler pages dev .`**, at `127.0.0.1:8788`, which
   reads the top of `wrangler.toml` and so hits the preview database. Never
   production, and never by pointing a binding at it. `.wrangler/` is the
   dev server's scratch and is ignored. The `AI` binding runs remotely even
   there and spends from the shared daily allowance, so drive the chat a
   few questions at a time. To look at rows without a dev server, the
   Cloudflare MCP tool `d1_database_query` reads either database without a
   prompt and writes to neither without one — see **The rules of a write**.
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

1. `git fetch origin claude/tallinn-tastebuds-map-nzoqx0 && git rebase origin/claude/tallinn-tastebuds-map-nzoqx0`
2. `node tools/validate.mjs` and `node tools/functions-check.mjs`. If
   `db/schema.sql` changed, apply it to **preview** now — `wrangler d1
   execute tallinntastebuds-preview --remote --file=db/schema.sql` — so the
   preview deployment has the table the code expects.
3. `npx wrangler pages dev .` against the preview database, and the page
   half driven in a browser through it.
4. Commits that stand alone, subjects about what the rows or the answer now
   are.
5. `git push -u origin <branch>`, or `--force-with-lease` after a rebase.
6. Open the PR against the default branch. The body says what the rows
   looked like before and after, what it costs per request, and **what has
   to be applied by hand on landing and to which database** — the schema
   statement, the meta stamp, a load. A `wrangler.toml` change to the
   preview block only takes effect once a preview has deployed with it, and
   `wrangler pages dev` reads the top level rather than `[env.preview]`, so
   this is the one case nothing local can check. Pushing the branch deploys
   nothing — there are no preview deployments, and `CLAUDE.md` says why — so
   say plainly in the body that the binding wants a preview and what you would
   look at on it. `npx wrangler pages deploy . --branch=<name>` from a terminal
   is the one command that makes one.
7. CI green, then **Rebase and merge** — the branch stays, `CLAUDE.md` says
   why — and **apply to production** whatever the body said, immediately:
   the code is live the moment the push lands, and a route that expects a
   column production does not have fails quietly, which is the worst way.

## Where it goes wrong

- One D1 binding declared at the top level of `wrangler.toml` and handed to
  both environments, so a bookmark pressed on a preview was a save on the
  live map. Nobody noticed for weeks.
- A schema change pushed and never applied, so `pages dev` worked and the
  deployment did not.
- A preview binding changed in `wrangler.toml` and not picked up, because
  each environment's configuration is written by a deployment *of that
  environment*: open a PR, or run the workflow from a non-production branch.
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
  comment above `uiStrings()` is the record. `node tools/functions-check.mjs`
  loads every module now, in CI and in step 2 of **The steps**.
