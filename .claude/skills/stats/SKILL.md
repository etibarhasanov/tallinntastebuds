---
name: stats
description: Change what the site counts about its visitors or how the owner reads it — a press, a page, a kind, a table, or one of the five pages under /admin/. Use for anything in assets/track.js, functions/api/stats.js, _visitors.js, _visits.js, _flows.js, functions/api/admin/, admin/*.html or their scripts, and for reading the numbers to decide what to build next.
---

# Count something, or read what is counted

The site keeps its own count of who comes and what they do, and the owner
reads it on five pages under `/admin/`. Nothing on the site links to them,
nothing a visitor sees changes when they do, and every number on them is a
row that is `n + 1`'d rather than a log that is replayed. That is the whole
design, and it is why the two halves are so different to change: the
**write** half is one open route every page knocks on, hardened against
whatever a request says; the **read** half is the owner's alone, cached
five minutes at the edge, and drawn in the reading language with the words
fetched in the same request as the numbers.

This skill is the checklist for changing either half. It is not the
explanation of what the numbers mean — that is the README, and **Read
first** says which sections — and it is not a licence to add a count. A
count is a cost: a kind nobody chose from a list is capped, a table is
applied by hand to production, and a page that gains a card gains ten
languages. **What is deliberately not counted** below is as much of the
design as what is.

The files this process touches are the `/site` process's (`assets/`, the
pages, `data/ui.json`) and the `/api` process's (`functions/`, the schema),
so **load both as well** and follow their pull-request sections. This file
adds what neither says: how the count is shaped, the invariants a change
must keep, and where this area has gone wrong.

## Read first

- `README.md` → the section for the page you are changing, and only that
  one. `grep -n '^## ' README.md` finds them:
  - **Statistics** — `/admin/stats`: which places, chips, pills and lists
    get opened, and the nine counts of what the site holds. **It counts
    opens, and an open is a gesture** and **A count and not a log** are the
    two arguments every change here is held to.
  - **Visitors** — `/admin/visitors`: who came, from where, on what, for
    how long, what they pressed, the sign-up funnel, the two rails, the
    chat, the products, Right now. **A visitor is a browser on a day** is
    what a visitor is; **What it does not do** is the boundary.
  - **How they found it** — `/admin/found`. **The words typed into Google
    are not to be had** is the one question this page cannot answer, and
    why no code can.
  - **Who uses the site, drawn** — `/admin/flows`. **The numbers on it**
    is how a press becomes a step on a diagram.
  - **Analytics** (a `###` under the site's own sections) — the table of
    every press name the pages report. It is the list: a name not in it
    is a name nobody will find in the console or on `/admin/visitors`.
  - **The short rail** — why the map deals strangers one of two rails and
    what `layout` counts about it.
  - **The lists' two looks** — the directory's own A/B test, apart from
    the rails, and what `look` counts about it.
  - **The four styles, dealt** — the colour each newcomer is given, and
    what `style` counts about it.
- The header of the file you are standing in. The four behind the count
  are written as essays, section by section, and each section is the
  reasoning for one kind: `functions/api/_visitors.js` (the whole site),
  `_visits.js` (one person's profile and lists, read on `/insights`),
  `_flows.js` (the diagrams) and `stats.js` (the press route). The header
  of `assets/track.js` is the browser's half. A change that makes a section
  wrong rewrites the section.
- The `/api` skill's route table: the rows for `POST /api/stats`,
  `GET /api/admin/stats`, `/visitors`, `/found`, `/live` and `/flows` say
  what each reads and writes and how each is cached.

## The map of the thing

One write route, five read routes, five pages, nine tables.

| The owner reads | at | from | written by | into |
|---|---|---|---|---|
| which places, chips, pills and lists get opened; what the site holds | `admin/stats.html` + `assets/stats.js` | `GET /api/admin/stats` (`functions/api/admin/stats.js`) | `POST /api/stats` (`functions/api/stats.js`), one upsert per press | `press_counts` (kind, id, n) — no day in it; `list_counts` by day and country through `countListOpen()` in `_visits.js`; `save_counts` for the saves column; nine `COUNT(*)`s in `HELD` |
| who came and what they did | `admin/visitors.html` + `assets/visitors.js` | `GET /api/admin/visitors` (`readVisitors()` in `_visitors.js`) and `GET /api/admin/live` (`readLive()`) | `countArrive()` and `countLeave()` in `_visitors.js`, handed `arrive` and `leave` by `stats.js`; `countAsk()` from `ask.js`; `countSignup()` from `google.js`; `countUse()` from the write routes of saves, lists, flashcards, splitwise and chess | `visitor_counts` (day, kind, id, n); `visitor_live` (a ring of sixty minutes); `usage_people` (week, product, key) |
| how they found it | `admin/found.html` + `assets/found.js` | `GET /api/admin/found` (`readFound()`) | the same `countArrive()` and `countLeave()`, the kinds `FOUND` lists | `visitor_counts`, the kinds `from`, `found`, `ref`, `tag`, `search`, `nothing` |
| who uses the site, drawn | `admin/flows.html` + `assets/flows.js` | `GET /api/admin/flows` (`readFlows()` in `_flows.js`) | `countFlows()` in `_flows.js`, called beside `countLeave()` for every `leave` | `flow_counts` (flow, day, who, id, n) |
| a profile's own numbers — not the owner's page, but the same machinery | `insights.html` | `GET /api/insights` (`readInsights()` in `_visits.js`) | `countView()` and `countPress()` in `_visits.js`, handed `profile` and `profile-press` by `stats.js` | `profile_counts`; `view_seen` for the once-a-day rule |

The browser's half is `assets/track.js`, loaded on every page but
`/admin/`: `TTBTrack.event(name, params)` tallies a press and sends it to
Google and Clarity; `TTBTrack.view(title)` reports a place, post or deck
opened; `TTBTrack.about(what, id)` says which story, post, deck or deal the
page showed; `arrive()` sends one report as the page opens and `putAway()`
one each time it is hidden, carrying the seconds on screen, the tally, the
trail with the on-screen second each name happened at, the languages, the
searches and the abouts. Two reports a page and
no more — a visit of twelve presses is not twelve requests.

`stats.js` is the door for all of it. Twelve kinds, and each is handed on or
counted in one place:

| `kind` | checked against | counted by | into |
|---|---|---|---|
| `place` | the map's roll, or `google_venues` with `hidden = 0` | `stats.js` | `press_counts` |
| `filter` | `data/taxonomy.json` plus `DEAL_FILTER` | `stats.js` | `press_counts` |
| `rail` | `RAIL_PILLS` | `stats.js`, every press | `press_counts` |
| `layout` | `LAYOUT_IDS` | `stats.js` | `press_counts` |
| `look` | `LOOK_IDS` | `stats.js` | `press_counts` |
| `style` | `STYLE_IDS` | `stats.js` | `press_counts` |
| `list` | a public list not the caller's own, then `firstToday()` | `stats.js`, then `countListOpen()` | `press_counts`, `list_counts` |
| `profile`, `profile-press` | the owner's own page | `countView()`, `countPress()` in `_visits.js` | `profile_counts` |
| `arrive`, `leave` | every field, in `_visitors.js` | `countArrive()`, `countLeave()` + `countFlows()` | `visitor_counts`, `visitor_live`, `flow_counts` |
| `venue` | nothing | nobody — it only asks `refreshOnOpen()`; sent by the directory, and by the map for a place the owner's browser opens | — |

Every ending is `200 {ok:false}` unless the body itself would not parse. A
press that did not count is not the visitor's problem, and the page is not
listening.

## The rules of a count

These are the invariants. A change that breaks one is wrong even when the
validator passes and the page draws.

1. **The owner is not a visitor.** `adminUser()` in `stats.js` answers
   `{ok:false}` to any report but `venue` that carries the owner's session
   before anything is counted — `press_counts` and `profile_counts`
   included, since 2026-10-04 — and the browser it signs in on carries
   `ttb_owner`, which keeps Google, Clarity and every beacon out of the
   count even signed out (`ownerCookie()` in `_admin.js`); `countUse()` checks `adminIds()` itself;
   `ask.js` leaves the owner out the same way; `realList()` and `_visits.js`
   refuse the owner of a list or a profile. A new counter leaves the owner
   out the same way, by the session and never by a header the browser
   could send. The first days of the count were most of the returning
   visitors' minutes, the owner's among them, which is why.
2. **Nothing is filed under a person.** No id is made, no address stored,
   no row per visit. Where telling two visits apart is unavoidable —
   `view_seen`, `usage_people`, the feedback cap — it is an HMAC under
   `SAVE_SALT` of the address or account, the thing and the day or week,
   cut short, so the key is different for every thing and every day and
   the table cannot be joined into a trail. Without the salt those parts
   count nothing rather than filing under something readable.
3. **A row per fact per day, never a log.** `press_counts` has no day;
   `profile_counts`, `list_counts`, `visitor_counts` and `flow_counts`
   have one and are keyed on it. The size is bounded by the day and the
   kinds, not the traffic — the time at a step on `/admin/flows` is a
   count per bucket, `t:<step>:<i>`, for that reason and not a list of
   durations. Do not add a timestamp column, a session id or
   a "raw events" table: **A count and not a log** under **Statistics** is
   the argument, and the day it stops holding the answer is a monthly
   roll-up, not a log.
4. **A kind is a closed list or it is capped.** Pages are `PAGES`; the
   rails `RAILS`; the facts `FACTS`; the sign-up steps `SIGNUP`; the
   endings `ENDINGS`; the products `PRODUCTS`; the abouts held to the file
   `ABOUT` names; the languages to `data/ui.json`. The kinds whose ids the
   request chooses — `OPEN` — take at most `MAX_IDS` new ids a day, the
   presses `MAX_PRESS_IDS`, and past that only ids already seen that day
   go up. A new kind is one or the other, written down in the file beside
   the others, and the comment at `OPEN` says why the press cap sits where
   it does: it was a hundred, and the busiest day reached it in a
   fortnight, dropping exactly the rare late names worth keeping.
5. **Once per page load, except the rail.** A place, a chip, a step in a
   diagram and an `about` are counted once per load however often they are
   re-pressed, because they are a question asked once and must agree with
   the one `TTBTrack.view()` beside them. A pill is counted every press,
   because the question is which buttons people push. A profile or list
   open is once a UTC day per browser and network through `firstToday()`.
   Pick the rule a new thing follows and say which in its comment.
6. **Each table on its own, outside the batch.** `file()` batches a day's
   facts into one transaction; `countLive()`, `countPerson()`,
   `countListOpen()` and `countFlows()` each run as a statement of their
   own, because a batch is one transaction and a missing table would take
   the day's facts down with it. A new table is written the same way,
   never inside `file()`'s batch.
7. **A missing table is `ready: false`, not an error.** Every read route
   answers 200 with the words and `ready: false` where its table is not
   applied, and the page says the numbers are not in yet. Every write
   swallows the failure. The tables arrive by hand, and the code must work
   before they have.
8. **The owner's routes are locked by where they live.** Anything under
   `/admin/` is a 404 and under `/api/admin/` a 403 to anybody but the
   owner, from `_middleware.js`, before the route is reached. A new page
   or route for the owner goes under those prefixes and nowhere else, and
   `admin.html` is not one of them.
9. **The words ride with the numbers.** Every admin route answers through
   `wordsFor()` so the page makes one request on the way in; the edge
   cache is keyed on the route, the language and the range alone —
   `statsKey()`, `visitorsKey()`, `foundKey()`, `flowsKey()` — never the
   rest of the address; the browser is told `private, no-store` whatever
   the colo holds; and `/api/admin/live` is `no-store` outright. When an
   answer gains a field the page cannot draw without, move `SHAPE` on in
   that route, so a colo's five-minute-old copy is not handed to the page
   that came with the deploy.
10. **The browser never waits on it.** `sendBeacon`, `keepalive`, nothing
    drawn from the answer, and everything after the answer on the server
    goes through `context.waitUntil()`.

## What is deliberately not counted

Read these before adding a count, because each was decided and most were
decided against once:

- the words typed into a search engine — they are not in the referrer and
  no code can have them; Search Console is where they are;
- the words put to the chat — a sentence somebody might put anything in;
- a row on somebody's list, a pin hovered, a search that narrows to one
  name — none is somebody asking for a place;
- a place added by hand to a list — nothing to rank it against;
- `All` on the chip row — it is the way out, not a filter;
- the radio — it left the rail;
- turning a chip off;
- the owner's look through `/admin/google` — `venue`, carried and counted
  nowhere, after it sat in the city's ranking for a while;
- a browser breakdown, a path for one visitor, anything finer than a day
  but **Right now**;
- any number on the map, a pill, or a public page: the count is on the
  owner's pages or it is nowhere, because a number under a name is a
  score and **Public lists** says why there are none.

## The copies to keep in step

Each of these exists twice, and `grep -n` finds both:

| In | and in | which is |
|---|---|---|
| `RAIL_PILLS` in `functions/api/stats.js` | `RAIL_PRESS` in `assets/app.js` | the nine pill ids across the rail's two shapes |
| `PAGES` in `functions/api/_visitors.js` | every page that loads `assets/track.js`; `page:` and `view:` signals in `data/flows.json` | the validator fails a page or a signal `PAGES` does not name |
| `SPANS` in `functions/api/_visitors.js` | `SPANS` in `assets/visitors.js` and `assets/found.js` | the ranges 1, 7, 28, 90 |
| `ABOUT` in `functions/api/_visitors.js` | `TTBTrack.about()` calls in `assets/app.js`, `blog.js`, `flashcard.js`, `deal.js`, `verify.js` | what a page may say it was about |
| `SIGNUP` in `functions/api/_visitors.js` | the `account_*` names the sheet and forms report; the error words `account.js` answers | the funnel |
| `LAYOUT_IDS` in `functions/api/stats.js` | `pickLayout()` in `assets/app.js` | the two rails and their opens |
| `LOOK_IDS` in `functions/api/stats.js` | `pickLook()` and `lookTold()` in `assets/lists.js`; `LOOKS` in `assets/visitors.js` | the directory's two looks, their opens and their keeps |
| `STYLE_ARMS` / `STYLE_IDS` in `functions/api/stats.js` | `STYLE_DEALS` in `assets/track.js`; `COLOURS` in `assets/visitors.js`; the `STYLES` every page keeps | the four colours dealt, and what came after |
| every press name | the table under **Analytics** in `README.md`; `when` in `data/flows.json` | the list |
| the kinds list | the comment above `visitor_counts` in `db/schema.sql` — twenty-six today | what the table holds |
| `admin/*.html` | `PAGES` in `tools/stamp.mjs` | the five stamped pages |

## Adding a press

The common change, and nearly all of it is the `/site` skill's. What this
file adds:

1. The name is lowercase, letters, digits and underscores, under forty
   characters — `PRESS` in `_visitors.js` — and says what the person meant.
   The same gesture on two pages reports the same name.
2. `TTBTrack.event(name, params)` in the handler, `TTBTrack.click()` round an
   inline node, or `data-track` in the markup. `layout` is added to the
   params for you.
3. A row in the **Analytics** table in `README.md`, in the same commit.
4. If it is a step somebody takes in a diagram, `when` in `data/flows.json`
   names it, then `node tools/flows.mjs`.
5. If it is a step of signing up, `SIGNUP` in `_visitors.js` lists it, or the
   funnel will not see it — the press cap is exactly what drops a rare late
   name.
6. Nothing in the database. A press is a row in `visitor_counts` under
   `press` by its name the first time it arrives.

## Adding a page

1. Its path in `PAGES` in `_visitors.js`, with the `ui.json` key it is
   already named by. An address `PAGES` does not claim is counted as the
   map, and `node tools/validate.mjs` fails a page that loads `track.js`
   without it.
2. `<script src="/assets/track.js">` before the page's own script, after
   `analytics.js`; `back.js` after it where the page is walked back from.
3. Nothing else: its views, time, presses, entries and moves count with no
   more to do.

## Adding a kind, or a fact

A new question the owner wants answered that the kinds above cannot. The
cost is the whole chain, and all of it lands in one PR:

1. **Say it in a sentence first**, with what it will show on which page and
   what it costs — this is the **Something new is described before it is
   built** gate in `CLAUDE.md`, and a card on an admin page is a new thing
   a person can see. Two things make it cheaper than most: the owner is the
   only reader, and the words are still ten languages.
2. `assets/track.js`: the field on the `arrive` or `leave` body, or a new
   `TTBTrack.*` the page calls. Keep the two-reports rule; a third request
   per page is a design change.
3. `_visitors.js`: a section in the header for it; the constant that closes
   or caps it; the fact pushed in `countArrive()` or `countLeave()`, or a
   `count*()` of its own if it comes from a route; the read side in
   `readVisitors()` or `readFound()`, and `SHAPE` moved on in the admin
   route.
4. `db/schema.sql`: the kind added to the comment above `visitor_counts`
   and the count of kinds there. A **new table** also means the `CREATE`
   with the reasoning above it, the write as its own statement, `ready:
   false` on every read that touches it, and in the PR body the exact
   `wrangler d1 execute tallinntastebuds --remote --command "..."` the owner
   runs after landing — **The schema** in the `/api` skill.
5. The admin route: `ready`, the field, the words.
6. The page: the card, the `ui.json` keys in all ten languages — the
   `visitors*`, `found*`, `stats*` and `flows*` prefixes are the
   convention — `node tools/stamp.mjs`.
7. `README.md`: a `###` under the page's section saying what it counts,
   what it cannot, and from when.
8. The `/api` skill's route-table row for the route.

## Driving it

`npx wrangler pages dev .` at `127.0.0.1:8788`, as the `/api` skill says.
Two things are this area's own:

- **To be the owner locally**, `ADMINS` must name an account in the local
  database, and it is empty at the top of `wrangler.toml` on purpose —
  **The house, and driving without a token** in the chess skill is the
  recipe: sign up an account under `pages dev`, read its id with `wrangler
  d1 execute tallinntastebuds-preview --local --command "SELECT id,
  username FROM users"`, and restart with `--binding ADMINS=<id> --binding
  SAVE_SALT=dev`. Without it every page under `/admin/` is a 404 and
  nothing can be looked at.
- **To be a visitor**, be signed out, or signed in as anybody but that id,
  in another browser profile. Then open the map, press things, hide the tab
  — a `leave` is sent on `visibilitychange`, so switching tabs is enough —
  and read the rows: `SELECT day, kind, id, n FROM visitor_counts WHERE
  day = date('now') ORDER BY kind, n DESC`, through `wrangler d1 execute
  … --local` or the Cloudflare MCP `d1_database_query` for the remote
  preview. Then open `/admin/visitors` as the owner and find the same rows
  drawn. The edge cache is five minutes, so a figure that does not move is
  usually the colo, not the count: `?days=1` and a different language are
  different keys.
- **Clear `ttb.seen` and `ttb.since`** from `localStorage` to be a new
  visitor again, and `ttb.step` from `sessionStorage` to arrive with no
  step before.
- **The tables must exist locally**: apply `db/schema.sql` with `wrangler
  d1 execute tallinntastebuds-preview --local --file=db/schema.sql` first,
  or every count answers false and every page says the numbers are not in
  yet — which is itself worth seeing once.
- **The chat is the one thing not to drive here**: `countAsk()` is reached
  only through `/api/ask`, which spends the shared daily allowance.

**Reading production** to check a count landed or to decide what to build
is free and needs no yes: `d1_database_query` on `tallinntastebuds`, reads
only. A write to any counts table — a correction, a backfill, a test row —
is a write like any other and **The rules of a write** in the `/api` skill
is the procedure. There is almost never a reason: the numbers are rough by
design and a wrong day is left wrong and said so in the README.

## Reading the numbers to decide what to build

The five pages exist so that what gets built next is decided by what
people do rather than by what a session pictured, and a session asked to
improve the site reads them before it proposes anything. The reads are
free; the questions, in the order the pages answer them:

- **Where do people land, and where do they go?** `entry` and `nav` on
  `/admin/visitors`. A page nobody enters on is a page the search engines
  have not found; a move nobody makes is a link nobody sees.
- **Where do they leave without pressing anything?** `idle` against
  `left`, per page. A high idle share is a page that did not say what it
  was for in the first second.
- **What do they press, and what do they never press?** `press`, against
  the **Analytics** table. A name that is reported and never counted is a
  button nobody finds.
- **Where does signing up lose them?** The funnel: `account_sheet_*`
  against `account_try_*` against `account_done_*`, and the `account_err_*`
  word they were refused with. The `username` pattern bug was found here
  and nowhere else.
- **Which rail works?** `layout`: strangers dealt each, and how many
  opened a place with it.
- **What did they come for?** `found` and `search` on `/admin/found` —
  the words people type into the site's own fields are the nearest thing
  to what they typed into Google.
- **What is actually used?** `use` by product, week by week, and
  `usage_people` for how many different people.
- **Did the chat answer?** `ask`: `asked` against `places`, `words`,
  `none` and `resting`.

A proposal that comes out of this names the rows it read, the number, and
the day range — the way a write names its rows — and then goes through
**Something new is described before it is built** like anything else. The
numbers say where to look; they do not say what the thing should be.

## The commit

> The visitors page says which stories, posts, decks and discounts were opened
> The owner's look through Google's directory is no longer ranked as the city's
> The visitor count stops losing people and names it should have kept

The body says what was counted before and what is counted now, which kind
and which table, what it costs per page view and per day, what it cannot
say, and what the owner applies by hand on landing.

## The pull request

The `/site` and `/api` sequences, which agree, with this area's particulars:

1. `git fetch origin claude/tallinn-tastebuds-map-nzoqx0 && git rebase origin/claude/tallinn-tastebuds-map-nzoqx0`
2. `node tools/stamp.mjs` if anything in `assets/` moved; `node
   tools/flows.mjs` if `data/flows.json` did.
3. `node tools/validate.mjs` — it holds every `track.js` page to `PAGES`
   and every flow signal to a page or a press — and `node
   tools/functions-check.mjs`, because the admin routes import constants
   from `stats.js` and `_visitors.js` and a renamed export takes every
   route down.
4. Driven as above: a count made as a visitor, the row read back, the
   figure found on the owner's page, at 390 px as well.
5. The README `###`, the file header, the schema comment, the **Analytics**
   row, the `/api` route-table row: whichever the change made wrong.
6. One commit; `git push -u origin <branch>`.
7. The PR body says what is counted now, what was driven and how, and
   **the exact statement the owner runs against production** if a table
   or column arrived — and says that until it is run the page shows
   `ready: false`, which is the designed state and not a failure.
8. CI green, **Rebase and merge**, leave the branch. Then the message
   opens with where it stands, and a schema to apply is the second state
   in **Say where it stands** in `CLAUDE.md`, not the first.

## Where it goes wrong

- **A press capped away.** The press kind was capped at a hundred names a
  day and twenty a report; the busiest day reached the first within
  fourteen of the count's start, a long visit to the map passes the
  second on its own, and the sign-up steps, rare and late, were exactly
  the names dropped. `MAX_PRESS_IDS` and `MAX_NAMES` sit higher now and
  `SIGNUP` is read off the whole report, but a new rare name wants the
  same thought.
- **The owner counted.** On the count's first days the owner's own
  afternoons were most of the returning visitors' minutes. Every counter
  leaves them out by the session; a new one that forgets reads the site
  through whoever built it.
- **A page not in `PAGES`.** Its views were the map's. The validator fails
  it now; it did not then.
- **A table inside the batch.** `visitor_live` arrived after
  `visitor_counts`, and had it been batched with the day's facts a database
  without it would have lost the day.
- **A colo's old answer.** A route that gains a field the page cannot draw
  without is still answered for five minutes from the colo's copy of the
  old shape, by the page that came with the deploy. `SHAPE` in each admin
  route is what keeps the two apart; move it when the shape moves.
- **The owner's directory presses ranked as the city's.** `venue` was a
  `place` for a while, and every look the owner took through Google's list
  sat in the ranking beside real opens. Now carried, counted nowhere.
- **A link somebody shared counted as typed.** The in-app browsers of
  Instagram and TikTok send no referrer, so `sourceOf()` reads the user
  agent first; and a Share button's link carries `?from=share` so it is a
  `tag` rather than Direct. A new way of handing out a link puts the tag on
  it.
- **A number that moved on the page and not in the table**, or the other
  way round: the edge cache. Five minutes, keyed on language and range.
  Read the row before reading the code.
- **Driving the count under `http.server`.** There is no Function there;
  every beacon 404s silently and nothing is wrong. `wrangler pages dev`.
- **A count added before it was described.** A card the owner had not
  asked for, in ten languages, with a kind in the schema comment and a
  README section, and then not the card they wanted. The gate in
  `CLAUDE.md` is cheaper than the second version.
