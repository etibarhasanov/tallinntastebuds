# Working on Tallinn Tastebuds

A full-screen map of places in Tallinn, plus discounts, stories, saves,
lists, profiles, a directory of the city, a chat that answers with places, a
blog about what all of it does and where to eat that members write in too, a page of which places get opened, a page of
who comes to the site and what they do, a page of how they found it, a page of links on every profile, a door at `/mcp`
through which an AI assistant reads the places and the public lists, a public API at `/api/v1` with the map to put
on another site at `/embed`, and — on a subdomain of its own — a deck of Estonian
flashcards, with a door of its own at its `/mcp` for the words and the grammar.
Static files, fifty-six Cloudflare Functions, two D1 databases (preview and
production, never one), and a Workers AI binding for the chat.

**No build step and no `npm install`, ever.** There is no `package.json` and
nothing in `node_modules`. The files in this repo are the files that get
served, and every tool in `tools/` is zero-dependency on purpose so it still
runs in five years. If a change seems to want a bundler, it is the wrong
change.

`README.md` is a short front door. `docs/handbook.md` is over twenty thousand
lines and is the real documentation — what
counts as a Restaurant, how discounts work at the table, why Estonian is `et`.
Read the section you need before touching that area, and only that section:
`grep -n '^## ' docs/handbook.md` is its table of contents with line numbers, and
every skill names the sections it needs by heading. This file is the part
every session needs *before* it starts — where things go, what to run, and
what has bitten people already — and an index to the rest.

## Orient in two minutes, not twenty

What a session tends to spend its first quarter-hour rediscovering, so it
does not have to:

- **Something new is described before it is built, and anything a visitor
  will see differently is drawn first.** A new page, panel, button, field,
  chip or route, and a restyle or new layout of one already there, gets a
  written shape, a small mockup — a picture of it at 390 px — and the
  owner's yes before any code is written. **Something new is described
  before it is built** below is the whole of it. Content (a place, a story,
  a discount, a deck), a fix that puts something back the way it was meant
  to look, and anything with no visible effect go straight to code.
- **There is no test suite.** `node tools/validate.mjs`, `node
  tools/functions-check.mjs`, `node tools/sqlcheck.mjs`, `node tools/qrperf.mjs --check`, `node
  tools/chessperf.mjs --check`, `node tools/mcpcheck.mjs --check`, `node
  tools/apicheck.mjs --check` and `node .claude/hooks/d1-write-gate.mjs
  --check` are the whole of CI. Anything with a visible effect is driven in a
  browser; the `/site` and `/api` skills say how. Do not go looking for a
  test runner, and do not write one into a PR that was about something else.
- **Line numbers in the docs are not to be trusted; names are.** The skills
  and the README name functions and constants — `applyStyle()`,
  `STORY_HOURS`, `DEAL_KEYS`, `KITCHENS` — and `grep -n` finds them. A line
  number that appears anywhere in prose was true on the day it was written.
- **The big files are found, not remembered.** `.claude/rules/leave-it-better.md`
  carries the one-line `wc -l` that lists every file over ~600 lines; the
  answer changes month to month and the rule says how to read a file on
  either side of that line.
- **The counts are written into the prose** — eighty places, 1,112
  Google venues, eleven languages, fourteen types — in the README, the code
  comments and the skills, and each skill says where its own copies live and
  gives the `grep` that finds them. Change a count, move the copies you are
  standing in, and say which you left.
- **A read is paid for by the row, and the day has five million.** D1 bills
  the rows a statement walks, not the rows it answers, and past five million
  in a UTC day every read on the account fails until midnight — lists, saves,
  sign-in. On 2026-11-18 one counter that re-read its whole table every five
  minutes did that before noon. **Every read has a price, set before it is
  written** below is the rule, and `node tools/sqlcheck.mjs` the backstop.
  `/admin/stats` opens on the day's reads so far, by table, out of
  `read_meter` (`functions/api/_meter.js`), and past seven in ten of the five
  million the flag counter stops reading first.
- **The chat costs nothing and is easy to exhaust.** `/api/v1/ask` runs on
  Workers AI's free daily allowance, and `pages dev` spends from the same
  pot as the live site, since that one binding runs remotely even there.
  Driving the chat for an afternoon puts the live site out of model until
  midnight UTC. Ask it a few questions, not fifty.
- **Driving a page reaches none of the owner's statistics.** Microsoft
  Clarity loads only on tallinntastebuds.ee and its subdomains, and never in
  a browser that sets `navigator.webdriver`, which Playwright does — so a
  localhost under `pages dev` or `http.server` records nothing. On the live
  hosts the site's own count leaves the same browsers out, and `/api/stats`
  refuses a `HeadlessChrome` user agent besides; under `pages dev` it counts
  them, into the local copy of the database, so a change to the count can
  still be driven. The owner asked for sessions out of every statistic on
  2026-11-19, after two in three desktop visits from the United States
  turned out to be three-second programs. Do not switch the flag off or
  change the user agent to look like a visitor on the live site.
- **`pages dev` keeps the database on your machine and the chat on
  Cloudflare's.** `npx wrangler pages dev .` is where every visible change is
  driven, and two things about it have each cost a session an hour. Its D1
  is a local copy under `.wrangler/state`, named after the preview binding
  and empty until `wrangler d1 execute tallinntastebuds-preview --local
  --file=db/schema.sql` has run — Pages' dev server cannot be pointed at a
  remote database, so nothing it does reaches `tallinntastebuds-preview`,
  and the owner's pages under it need an account made there and named with
  `--binding ADMINS=<id>`; **Driving it** in the `/stats` skill is the
  recipe. And the `[ai]` binding runs remotely whatever else does, so in a
  cloud session with no Cloudflare token the server does not start at all;
  **The house, and driving without a token** in the `/chess` skill is the
  way round it, a copy of the tree with the two `[ai]` blocks taken out.
- **Production is the only database that is kept.** Every write goes to
  production `tallinntastebuds` and nowhere else; preview
  `tallinntastebuds-preview` is set aside until the owner replicates it
  from production, so it is not loaded, not kept in step, and a difference
  between the two is not worth reporting. **Production only, for now**
  below is the whole of it. The Cloudflare MCP `d1_database_query` tool
  reads either database without a prompt while the read is small: the same
  hook prices it first, and one that would walk more than 2,000 rows asks —
  rule 6 of **Every read has a price** below. It writes to neither without
  a prompt: `.claude/hooks/d1-write-gate.mjs`
  stops every write, refuses one past a hundred rows or one whose size is not
  in the statement, and never runs `DROP` at all. That and the two hard
  denials in `.claude/settings.json` are the owner's standing instruction and
  are not to be argued with — **What needs a yes** below is the whole of it.
- **An installed app reads this backend, and it cannot be updated in a day.**
  The iOS app in `etibarhasanov/TallinnTasteBudsApp` has no server of its
  own. **What the app reads** below lists the routes and files it asks for; a
  change to any of them may add a field and may never rename or remove one.
- **Nothing is missing from the environment.** No `package.json`, no
  `node_modules`, no Cloudflare token in GitHub's secret store, no test
  runner, no `main` branch. Each of those is a decision, and the sections
  below say which.

## Which process is this?

Work here arrives in a few recurring shapes, and each has a **skill** of its
own under `.claude/skills/<name>/SKILL.md`. Claude Code reads every skill's
one-line description at the start of a session and loads the whole file the
moment a task matches it — so "add a place" or "queue a story" brings the
right checklist in on its own, before anything is opened. Typing the slash
command does the same by hand, and is the way to be sure.

| The task | Skill |
|---|---|
| Add a place, change one, add its photos, mark it closed | `/place` |
| Post a story, schedule one, take one down | `/story` |
| Switch a discount on or off, or change what it offers | `/discount` |
| Change what a page does or looks like — anything in `assets/`, an HTML file, `data/ui.json`, a language, a post on the blog | `/site` |
| Change a Function, the schema, `wrangler.toml`, the chat's model or prompt, or anything that reads or writes D1 | `/api` |
| Change the flashcards — a deck, a lesson or a song in `data/decks.json`, the page, what a deck can do, or the subdomain itself | `/flashcards`, with `/site` **and** `/api` |
| Add a conversation to the flashcards from a sheet of a language course, or change one | `/conversation` |
| Refresh the Google Places export | `/google-venues` |
| Build the chess page — the next unticked task in `.claude/skills/chess/TASKS.md`, one per session | `/chess` |
| Change what the site counts about its visitors, or one of the owner's five pages under `/admin/` that read it — `assets/track.js`, `functions/api/stats.js`, `_visitors.js`, `_visits.js`, `_flows.js`, `functions/api/admin/` — or read the numbers to decide what to build next | `/stats`, with `/site` **and** `/api` |
| Change how the pages fit together — the shell the map opens every page on (`assets/shell.js`), the radio one page lends another, the security headers, a subdomain, a shared global — or propose a new page, route or host | `/architecture`, with `/site` or `/api` for the files it touches |

Each skill is written from the code, not from memory: which files a change
touches, in what order, the exact commands and flags, every check the
validator will apply, the path through `/admin.html` where one exists, how
the pull request for that kind of change is opened and landed, and where
that kind of change has gone wrong before. A task that spans two rows loads
both. A task that matches none — a README correction, a workflow change —
follows the sections below.

**The files find their skill too.** A task does not always announce itself in
the prompt — "fix the thing in deals.json" names no process — so each skill
has a small **rule** beside it under `.claude/rules/<name>.md`, path-scoped to
the files that process touches. Claude Code loads a path-scoped rule the
moment a session reads or edits a matching file, and the rule says which
skill to load. Two roads, then: the prompt loads the skill by its
description, and failing that, the first file opened does. Either way the
checklist arrives before the change is made.

One rule points at no skill of its own:
`.claude/rules/leave-it-better.md`, which loads by itself the moment a session
reads or edits anything under `assets/`, `functions/`, `tools/`, `db/` or an
HTML page; it outranks "keep the diff small", and its last section is the
process for a session with nothing else to do.

The files are templates as much as instructions: when a process turns out to
have a step nobody wrote down, or a way of going wrong that is not in its
file yet, add it to the file in the same PR. That is how they get richer than
this one ever was. **And they go stale the same way the code comments do**:
a route added to `functions/api/` without a row in the `/api` skill's table,
a page added without joining the stamper's list in the `/site` skill, a
refresh that changed a count the `/google-venues` skill had written down.
A change to a feature reads the skill for that feature before the PR, the
way it reads the README section, and fixes what the change made wrong.

**And the diagrams go stale the same way.** `/admin/flows` draws what each kind of
person can do, from `data/flows.json`, and every step there names the files
that do it. A change that gives somebody something new to do, takes something
away, or moves where a step lives updates their flow in the same PR and runs
`node tools/flows.mjs`. It is also the quickest answer to "what can a member
actually do here" — read it before grepping for it. **Who uses the site,
drawn** in `docs/handbook.md`.

## Something new is described before it is built

A change to something that already exists arrives with its own brief: the
thing is there, it is wrong in a way somebody can point at, make it right.
Something **new** does not. Nobody has seen it yet, so what gets built is
whatever the session pictured while it read the sentence — and the first time
the owner sees that picture is when it is merged and live — there are no
preview deployments any more — after the code, the stamps, the README
section, the eleven languages and the browser pass have all been spent on it. Changing it then is not an edit. It is the whole change
again, written by a session that has already talked itself into the first
version.

So the shape comes first, in words, and it comes from the owner.

**What this catches: anything new a visitor can see or press, and anything
they will see differently.** A new page, a new panel or sheet, a new button, a
new field, a new filter chip, a new route under `functions/api/`, a new thing
a deck can do on the flashcards — and a restyle, a new layout, a new colour, size,
spacing or arrangement of something already there. Two tests, and either is
enough: a visitor could not do something yesterday and could tomorrow, or a
visitor would look at the page tomorrow and see it differently. The owner's
words for it: every task like that gets a small mockup and a confirmation,
especially when it is about design.

**What it does not catch.** Fixing what is broken back to how it was meant to
look — the button that lost its colour gets it back without a picture. A
place, a story, a discount, a deck, a language, a refresh of the export, a
README correction, anything in `tools/`, a cleanup under `leave-it-better.md`
that changes nothing on screen, a Function that answers faster or tighter.
Those go straight to code the way they always have. Rewording a string is
caught, but its mockup is the old line and the new one in the message, with
no picture. When it is honestly unclear which side a task falls on, it is
the caught side: a mockup nobody needed costs ten minutes, and a design
nobody agreed to costs the change twice.

**What to send.** Prose in the same voice as everything else here, short
enough to read on a phone, saying:

- what the thing is, in a sentence, and which page it lives on;
- every state it has — empty, loading, error, signed out, the place with no
  photo — because the states are where a description and an implementation
  turn out to have disagreed;
- the copy, in English, and the note that it needs all eleven languages in
  `data/ui.json` before it ships;
- what it does at 390 px, which is the phone the README measures against;
- what it deliberately does not do yet, so the boundary is a decision rather
  than an oversight;
- what it costs — a table, a route, a page joining `PAGES` in
  `tools/stamp.mjs`, a `.sql` file somebody has to load by hand — and, for
  anything that reads the database, its rows read a day at its worst,
  worked out the way **Every read has a price** below says;
- and the questions the session genuinely cannot answer for itself. Two real
  ones are worth more than twelve that include the obvious.

Hold it to **The design rules** in `docs/handbook.md` while writing it. They are
twelve rules a new sheet, page or button is held to, and it is cheaper to
fail them in a paragraph than in a stylesheet.

For a restyle of something that already exists, the list shrinks to what
changes, what stays, and the states it touches — the thing is there, so only
the difference needs words.

**A small mockup, every time.** Words alone are not the confirmation: the
owner sees what is going to be built before it is built, every time a task
falls on the caught side above, a new button on an existing panel included.
Small means small — not a prototype, and not the change written early:

- **One static HTML file in the session's scratchpad**, not in the repo. It
  links the site's real stylesheet (`/assets/styles.css`, or the page's own)
  so the colours, type and spacing are the site's and not a guess, and draws
  only the part that changes, with a line of the page around it for context.
  No data from D1, no Function, no script beyond what switches between
  states.
- **Every state the description named**, side by side or one per picture —
  empty, loading, error, signed out, the place with no photo.
- **Before and after** when it changes something that exists: a screenshot
  of the page as it is now beside the mockup of what it would be.
- **At 390 px**, the phone the README measures against, and at desktop width
  as well when the change is about the wide layout.
- **Served and photographed**: `python3 -m http.server 8000` from the repo
  root, Playwright's Chromium at `deviceScaleFactor: 2`, and the PNGs sent to
  the owner as files in the message — a picture rather than a link, because
  **There are no preview deployments** below: a URL spends one of the five
  hundred builds a month, and making one is the owner's to run rather than a
  session's to spend.
- **Labelled as a mockup** in the first line, so nobody mistakes it for the
  change.

Where there are two honest ways to draw it, draw both and ask which, rather
than picking one and defending it. A mockup stays out of the repository
unless the owner asks for it to be kept as the reference a long feature
builds against, the way `.claude/skills/chess/mockup.html` was.

**Then stop.** Post the shape and the mockup, say in the first line that the
session is waiting on an answer — **Say where it stands** below is how — and write no
code. Not the schema, not the Function, not the scaffolding that will "be
needed either way". A session that guesses and builds while it waits has
spent the afternoon the asking was meant to save, and a guess is much harder
to throw away once it compiles.

This is the owner's instruction in as many words: first clear functionality,
later code. The half-hour a description takes is the cheapest half-hour in
the process, and it is bought against writing the whole change twice.

## Every read has a price, set before it is written

D1 bills every row a statement walks — not the rows it answers with — and
the free plan gives the whole account five million a day. Past that, every
read fails until midnight UTC: the lists come back empty, saves and sign-in
stop, and nothing on the page says why. On 2026-11-18 the flag counter on
Discover took the site there before noon. It asked `visitor_counts` by kind
and by a span of days, which the table's key — (day, kind, id) — cannot
answer, so each refresh walked all 18,439 rows three times, every five
minutes in every colo with a visitor. Its comment said "four reads per five
minutes", which was true by statement count. Nobody had asked what each one
cost, or what it would cost when the table was a year old.

So the cost is part of the design and is settled before the code, by the
session that writes it. Seven rules, and a change that breaks one is wrong
however small it is:

1. **A read costs the same on day one and day one thousand.** A statement on
   any route a visitor can reach reads a number of rows fixed by what it was
   asked — one day, one list, one account — never by how old or big the
   table is. If the cost grows with the table, the design is wrong, and a
   cache in front of it only slows down how fast it goes wrong.
2. **The key is chosen from the questions.** Before a table is created,
   write down every question that will be asked of it, and pick the primary
   key and indexes so each question names the front of one. A new question
   for an old table the key cannot answer gets a new index, a new table, or a
   different question — not a walk.
3. **A total is kept when it is written, not added up when it is read.**
   Anything a page shows as "all time", "this week" or "how many" is a row
   that the write which changes it also updates, the way `save_counts` is.
   Reading a history to sum it is for the owner's pages, and even there the
   statement names its days.
4. **Say the day's worst in numbers.** Rows per run, times runs a day — per
   colo for anything cached at the edge, per isolate for anything kept in
   memory — against the five million, in the description the owner reads
   and again in the comment above the statement. Measure it rather than
   guessing: the Cloudflare MCP tool `d1_database_query` answers every read
   with `rows_read`, and a read of 2,000 rows or fewer runs against
   production without a prompt.
5. **Read the plan, and believe the meter over it.** `node tools/sqlcheck.mjs`
   asks SQLite how every statement under `functions/` would run and fails the
   build on a walk that is not listed in its `KNOWN` with what bounds it. It
   cannot see how often a statement runs, nor a search that uses the front
   of a key and then filters every row behind it; `rows_read` sees both.
6. **A read run by hand brings 2,000 rows at the most.** The owner's line,
   drawn on 2026-11-18, the day a session answering a question about fifteen
   rides joined each ride's points to themselves and read 6,602,979 rows in
   one statement — more than the day's allowance, from a table of fifteen.
   The same answer, each ride walked once with `LAG()`, read 29,228. So
   `.claude/hooks/d1-write-gate.mjs` prices every read before it runs, from
   SQLite's own plan and the table sizes written in it, and asks the owner
   about one past 2,000 or one it cannot price. After each query the same
   file, as `--after`, adds what it really read to the day's total: past
   20,000 every read asks, and one that came back dearer than its price
   makes every read ask until midnight UTC. Ask `EXPLAIN QUERY PLAN` first
   — it reads nothing — and where an answer needs every row of something,
   say so and let the owner decide, rather than finding a shape the gate
   does not recognise.
7. **No statement answers more than a hundred rows, and most far fewer.**
   The owner's line, drawn on 2026-11-19: storing is not capped — a person
   may save as many places as they like — but reading is, and pagination is
   the way to limit it. A list that can grow is read a page of `PAGE` (fifty)
   at a time on its key, each page after the last one's key, with
   `inPages()` in `functions/api/_lib.js`; `savedBy()` beside it is the
   worked example. Where an app reads the answer whole —
   `saved` on every sign-in — the route still answers it whole, put
   together from the pages, because an app cut at the first page would
   lose the rest without a word.
   `node tools/sqlcheck.mjs` holds the line: a SELECT under `functions/`
   carries a `LIMIT` of a hundred or less, or is read by its key — every
   column of a unique key pinned with `=` or a short `IN` list — or is one
   aggregate row, and any other fails the build unless it is in the tool's
   `ROWS` with what bounds it in numbers. The reads there marked `fix` are
   owed, and `--all` lists them.

The same goes for anything else that is free up to a number a day: Workers
AI's Neurons, Google's thousand calls a month, Pages' five hundred builds.
The apps that read this backend are part of the sum too — **What the app
reads** below — so a phone that asks a route every minute is a route asked
a million times a day by a thousand phones.

## What needs a yes, and what does not

The repository is yours to work in: branch, edit, generate, validate, drive a
browser, commit, push, open a pull request. None of that needs asking, and
asking about it wastes an afternoon. What needs asking is *what to build*,
when the thing is new or will look different and nobody has seen it — the
section above, mockup and all — and once that is answered the building is
yours.

**Two live things are not yours, and one of them is a database.** The rows in
D1 — production `tallinntastebuds` and preview `tallinntastebuds-preview` —
belong to the person whose site this is and to the people who saved a place or
made a list. Reading them is how everything gets verified, and is unprompted
up to 2,000 rows a read — rule 6 above. Writing to them is a decision, and it
is theirs:

- **Every write asks.** `INSERT`, `UPDATE`, `DELETE`, any DDL, and loading
  `db/google-venues.sql`, `db/google-lists.sql` or `db/schema.sql`.
  `.claude/hooks/d1-write-gate.mjs` — a `PreToolUse` hook wired in
  `.claude/settings.json` — classifies the SQL of every `d1_database_query`
  call and lets a small read through, so the prompt is not something to
  remember.
  Do not route around it: not with a shell `wrangler` command, not with a
  Function written to do the write when it is called. Since 2026-11-19 the
  hook sits on those doors too — `wrangler d1` in the shell, curl to D1's
  API, and any MCP tool that names D1 or Cloudflare — and refuses a
  restore or a deleted database outright. Rattatee's sessions run the same
  file, from a checkout of this one beside it.
- **The ask carries the change.** Which database, which table, which columns,
  how many rows, and the values from and to — worked out by diffing the
  database against the repository, not assumed. "This loads the export" is
  not a description; "74 rows, `cuisine` only, 49 of them American → Burgers,
  Siga la Vaca Korean → Argentinian" is. The `/api` skill's **The rules of a
  write** is the full procedure.
- **A write names its rows, and there are at most a hundred of them.** Twenty
  is the size an ordinary correction should be; a hundred is the ceiling and
  the gate refuses anything past it outright, along with any write whose size
  is not in the statement — `WHERE cuisine = 'American'`, a `LIKE`, a
  subquery. Name the rows by primary key, or split it, or run the file from a
  terminal with `wrangler d1 execute`, which is where a load of a thousand
  rows has always belonged.
- **Approval to land is not approval to load.** "Merge it", "ship it" and
  "fix it" are about the pull request. The database is a separate sentence,
  and a merged PR whose `.sql` file is not loaded yet is a perfectly good
  place to stop — say so, and say which two lines would do it.

**Production only, for now.** Since 2026-09-29 the owner keeps one database,
production, and every write this file and the skills describe goes there and
nowhere else. Preview is not loaded with a `.sql` file, not given a schema
change, not corrected to match, and its drift from production is not a finding
— it is expected, and it is not mentioned. Where a skill, a tool's header or
the README still says "preview first", "both databases" or prints a
`tallinntastebuds-preview` line beside the production one, read it as
production alone. Preview stays bound in `wrangler.toml`, and `npx wrangler
pages dev .` does not reach it either: Pages' dev server runs D1 as a local
copy under `.wrangler/state` and cannot be pointed at a remote database, so a
change is driven against rows on your own machine, put there with `wrangler d1
execute tallinntastebuds-preview --local`. Nothing writes the remote preview
now. When it is needed again, the owner replicates it from production and this
paragraph comes out.

This is written down because it went wrong: a session that had been told to
merge a fix loaded the corrected column into both databases on its own
reasoning, production included, having asked nobody. The rows were right and
that was not the point.

The other live thing is **a push to the default branch**, which is a deploy —
see below. That one the pull request is the yes for.

**And before running any of it, re-read the process file.** The skill for the
change at hand, top to bottom, at the start of the session and again before
anything irreversible: they are checklists rather than background reading, and
the step that gets skipped is always the one nobody re-read.

## What the app reads

**Every route below answers under `/api/v1/` and nowhere else**, but
`/api/google`, where Google's sign-in comes back to. The three apps' builds
moved there on 2026-11-18, and the old addresses under `/api/` came out on
2026-11-21 and answer a 410 naming the new one — `/api/places` is
`/api/v1/find` and `/api/lists` is `/api/v1/me/lists`, every other the same
name; **The apps' routes, at their v1 addresses** in `docs/handbook.md`. A
route the apps start reading joins `APPS` in `functions/api/v1/[[path]].js`
and `apps` in `data/api-v1.json` the same day. The public half of `/api/v1` —
places, lists and types for anybody's code — is a promise of its own,
frozen in `data/api-v1.json` and held by `node tools/apicheck.mjs --check`.

The iOS app (`etibarhasanov/TallinnTasteBudsApp`, SwiftUI) signs in with the
site's own `ttb_s` cookie and reads the same backend the pages do, through
`TallinnTasteBuds/Core/API.swift`. A phone keeps the version it has for
months, so everything here is a promise: **add a field, never rename or
remove one**, and before changing any of these read how the app decodes it —
its models are in `TallinnTasteBuds/Models/`.

- Files: `data/map.json`, `data/taxonomy.json`, `data/lang/index.json`,
  `data/lang/<code>.json`, `data/deals.json`, and `photos/<place>/<file>`.
- Routes: `GET/POST /api/v1/account`, `GET/POST /api/v1/me/lists`, `/api/v1/saves`,
  `GET /api/v1/profile?name=`, `GET /api/v1/pass?r=`, `GET /api/v1/route`, and
  `GET /api/v1/find?q=`, whose rows keep `id`, `name`, `address` and `map`,
  and `GET /api/v1/lookup` with `POST /api/v1/lookup`, from the list picker's
  **Look for it on Google Maps**: `ready`, then `{ q }` answered by `ok`,
  `why` and `places` in those same rows. The app hides the button on
  `why: 'no-key'` and says it is resting on any other refusal. The map's
  search offers the same door from five letters.
- Added on 2026-11-17, with Discover, the walk game, rides, the chat and
  account saves:
  - `data/map.json`'s `links` (`href`, `text` as a string or by language),
    `added` and `updated`, which New on the map orders by.
  - `GET /api/v1/discover`: `fresh` and `popular` in the directory's list rows,
    `quiet` as place ids, and `routes` with `id`, `title`, `pin`, `places`,
    `finished`, `best` and `mode`.
  - `GET /api/v1/walk?list=` and `?mine=1`, and `POST /api/v1/walk` with `start`
    (`order`), `check` (`lat`, `lng`), `note` (`place`, `note`), `mode`,
    `order` and `again`: the answer's `ready`, `user`, `radius`, `walk`
    (`started`, `finished`, `mode`, `note`, `order`), `checks`, `board`,
    `notes` and `checked`; `mine`'s `walks` with `id`, `title`, `pin`,
    `checked` and `total`; and the error `far` with `place` and `meters`.
  - `GET /api/v1/rides?bbox=` (`rides`, each a `line`) and `POST /api/v1/rides`
    with `save`, `name`, `seconds` and `line`, and the errors `signed-out`,
    `often`, `fast` and `short`.
  - `GET /api/v1/route` with `mode=bike`.
  - `POST /api/v1/ask` with `q`, `lang`, `wish`, `here` and `history`, reading
    `ok`, `source` (`resting` included), `say`, `picks` (`id`, `why`, `far`),
    `venues` and `at` (`here`, `label`, `where`).
  - `POST /api/v1/saves` with `place` and `on`, signed in. The app cannot show a
    Turnstile challenge: switching Turnstile on refuses its saves with
    `challenge`, and they then stay on the phone. A place on the phone the
    account lacks is offered to it on sign-in, and since 2026-11-18 at most
    once a day per place — before, on every foreground, for ever.
  - `POST /api/v1/account` with `password-change`, `username-change` (answered
    with `user`), `display`, `about` and `links`, and the errors `current`,
    `same`, `same-name`, `taken` and `bad-link` with `network`.
- Added on 2026-11-18, with Your rides: `GET /api/v1/rides` with no query,
  the same answer as `?mine=1` — `rides` with `id`, `name`, `meters`,
  `seconds`, `at` and `timed`; `GET /api/v1/rides/<id>`, reading `ride` with
  `id`, `name`, `meters`, `seconds`, `at`, `line` and `insight` (`average`,
  `timed`, `top`, `stopped`, `fastest` with `km` and `seconds`, `splits`
  with `km`, `meters` and `seconds`, and `speed` with `at` and `kmh`), and
  the errors `signed-out` and `not-found`; and `POST /api/v1/rides` with
  `rename` (`id`, `name`, answered `ride`) and `drop` (`id`, answered
  `ok`), refused with `not-found`. Its recorder sends `[lat, lng, t, acc]`
  points from then on, as the website's does.
- Added on 2026-11-18, with Where you rode: `GET /api/v1/rides?mine=1&lines=1`,
  the same answer with `line` on each ride, `[lat, lng]` pairs thinned by
  the site, which the app draws together on one map.
- `data/map.json`'s `closed`, written down on 2026-11-21 after it went
  wrong: `false`, `true` for good, or `"temporary"`, which the app shows as
  **Temporarily closed** with `closedTempNote`. The app read `closed` as true
  or false only, and every build before the one that learnt `"temporary"`
  shows such a place as open — found, suggested and picked at random. A new
  value in a field the app reads is as much a change to the promise as a
  renamed field: the builds that learnt `"temporary"` read any other word as
  shut for good, and the app's weekly snapshot stops on one it does not
  know, so the app learns a new word before the site writes it.
- Added on 2026-11-18, with the train by bike: `GET /api/v1/route`,
  answering the same fields beside `version`, and by bike `trains`, each
  `seconds`, `meters`, `leave` and `legs` — `kind` (`bike` or `train`) and
  `line`, and the train's `name`, `from`, `to` and `at`. The app asks it
  first and asks the old `/api/route` again on an answer without `version`,
  so `version` is on every answer, refusals included.
- From 2026-11-23, `GET /api/v1/route` by bike, but for a ride between
  cities, answers BRouter's ways, the quietest first — **Nice ways by bike** in
  `docs/handbook.md` — in the fields it always had. The first way is the
  quietest, so one of `others` can be shorter or quicker.
- Signing in, which is three promises of its own. `GET /api/v1/account` answers
  `appGoogle` and `appApple`, and the app draws a button only where its flag
  is true — so taking one away hides a button, and renaming one hides it for
  good on every phone that has the app. `GET /api/google?app=<challenge>`
  ends at `tallinntastebuds://signin` with `google=` and `ticket=`, and
  `POST /api/v1/account` with `action: "ticket"`, `ticket` and `verifier`
  answers `{ user, saved }`. `POST /api/v1/apple` takes `{ token, nonce }` and
  answers the same. The address, the parameter names and the two error
  words the app has sentences for — `ticket` and `apple` — are all part of
  it. **The iPhone app signs in through these too** in `docs/handbook.md`.
- Strings: the app asks `data/lang/<code>.json` for its words by the site's
  own keys — the account sheet's, the lists', `styleLabel` and the four
  style names among them — so a key renamed in `data/ui.json` is a sentence
  that falls back to English in the app. Its own build checks the keys it
  borrows against a snapshot; nothing here does.

The list was read out of the app on 2026-11-10 and brought up to date on
2026-11-17. When the app starts asking for something else, add it here in
the same week.

**And a second app reads the flashcards.** Kohuke (`etibarhasanov/kohuke`,
SwiftUI, bundle id `ee.tallinntastebuds.kohuke`) is `/flashcard` as an app of
its own, for people who read English, Azerbaijani or Russian. It has no
backend either: the same accounts, the same cookie, the same rule — **add a
field, never rename or remove one** — and its models are in
`Kohuke/Models/Flash.swift`.

- `GET /api/v1/flashcard?lang=` and `?lang=&deck=<id>`, each with `ui=` —
  the key prefixes of the strings the app prints on the shelf, and nothing
  after the `=` for a deck, which carries none. Then, whole: `ready`, `user`,
  `words`, `gates`, `level`, `days`, `langs`, `ui`, and `decks`, `lessons`, `songs`,
  `talks`, or one `deck`, `lesson`, `song` or `talk` — every field
  `deckAnswer()`, `lessonAnswer()`, `songAnswer()` and `talkAnswer()` send,
  the kinds of block a lesson's `body` is made of, and `error: "not-found"`.
- `POST /api/v1/flashcard`, every action by name with the fields it reads:
  `knew` and `again` (`deck`, `card`, `day`), `reset`, `report` (`lang`),
  and `deck`, `rename`, `drop`, `card`, `editcard`, `uncard`, each answering
  `{ deck }`. `placed` (`answers`, [{ id, said }]) answers `{ placed }` and
  is the site's alone so far. `gates` is what each stage opens at *for that
  person* — nought where Find your level opened it — so the app's rule,
  gate past the count, holds unchanged. The ids a lesson, a song and a conversation are filed under —
  `grammar`, `songs`, `talks` — and the two gathered decks' — `missed`,
  `review` — are written into the app. So are the error words it has
  sentences for: `name`, `front`, `back`, `too-many`, `full`, `often`,
  `not-found`, `signed-out`.
- Files, since 2026-11-19: `data/decks/<id>.json` — a deck, a lesson, a song
  or a conversation as `tools/decks.mjs` writes it — and
  `data/decks/index.json`, of which it reads `decks`, each one's `id` and
  `name`. Kohuke fetches the file rather than the route wherever the shelf
  already says what somebody knows of it — a lesson, a song or a
  conversation always, a deck where none of its cards are known, all are,
  or as many as the phone's last copy has — because a file runs no Function
  and reads no row. So the shape of those files is the same promise the
  route's answer is: a field added, never renamed or removed, and the
  folder stays out of `_routes.json`'s Functions.
- **And it does to a file what the route does.** `Store.fromFiles()` in
  `Kohuke/Core/Store.swift` repeats `deckAnswer()`, `lessonAnswer()`,
  `songAnswer()` and `talkAnswer()`: `own`, each card's `deck`, `known` and
  `due`, an empty `forms` and a `sentence` without its `et` and `en` left
  out, `read` and `heard`, and a deck a song, a conversation or one of
  their words points at turned into its `id` and `name`. A change to what
  one of the four does to a file is a change there too, and a phone keeps
  the old one for months — so the new thing goes in the file, where both
  read it, rather than in the Function alone.
- `GET /api/v1/say?take=&text=`, answering a WAV.
- Signing in, as above, with two things of its own: `/api/v1/apple` has to
  accept its bundle id — `APP_IDS` in `functions/api/_apple.js` — and the
  Google trip still ends at `tallinntastebuds://signin`, which Kohuke
  listens for under that name.
- Strings: the `flash*` keys, the `account*` keys the sign-in and delete
  sheets print, `styleLabel`, `language`, `privacyLink` and `close`, out of
  the `ui` block the route's answer carries.
- Numbers it restates, to be changed in both places: `FREE_WORDS`, `GATES`'
  two levels by name (`more`, `deep`), the four levels a deck is filed under
  and the two that are not stages (`case`, `song`), `MAX_NAME`, `MAX_SIDE`
  and `SAY_TAKE`.

Read out of Kohuke on 2026-11-11, the day it was written, and the files on
2026-11-19, the day it began reading them.

**And a third records rides.** Rattatee (`etibarhasanov/rattatee`, SwiftUI,
bundle id `ee.tallinntastebuds.rattatee.app`) records a bike ride with the screen
locked and the phone in a pocket, which a web page cannot, and saves it
through `/api/v1/rides`. It is the recorder: the website has none. No backend, the same
accounts, the same cookie, the same rule — **add a field, never rename or
remove one** — and its door is `Rattatee/Core/API.swift`.

- `POST /api/v1/rides` with `action: "save"`, `anon: true`, `name`, `seconds`
  and `line`, signed in or not — it asks nobody to sign in, and `anon` is
  what lets a save with no session through — whose points it sends as
  `[lat, lng, t, acc]` — whole seconds since the ride began and whole
  metres, kept in `rides.track` — and, from 2026-11-18, `[lat, lng, t, acc,
  alt]` where the fix had a height, whole metres above the sea, kept there
  as a third number; a point without one is sent as four — reading `ride` with `id` and `meters`
  where the save carried a session. **With none, since 2026-11-20, the
  ride is counted and not kept**: the answer is `{ "counted": true }` and
  has no `ride`, which is the one place here a field an app was promised is
  not sent — there is no ride to name, and the app marks a ride saved on
  any 2xx and asks for the kept ride only where it was given an id. Nothing
  is remembered of such a save and nothing caps it: a ride whose answer was
  lost is counted again when it is sent again, and `often` is an account's
  word alone now. From the same day the app sends a ride saved while signed
  out without the session, so that ride is counted and not kept even if
  the rider signed in before it went. A
  ride waits on the phone until that answer comes, so the error words decide
  what becomes of it: `short`, `fast` and `malformed` are final and the ride
  is listed as not kept; `often` waits for
  the next UTC midnight; any other word, and no answer at all, is tried
  again — after a wait that doubles from a minute to six hours with each
  failure, since 2026-11-18, where before it was every foreground and every
  network change. A new refusal that sending again cannot change has to be
  one of the three final words, or an installed app will send that ride for
  ever, if slowly.
- Its search for somewhere to ride to, Where to?: `GET /api/v1/find?q=` with
  `near` and `limit`, reading `id`, `name`, `address`, `category`, `lat`,
  `lng` and `map`; `GET /api/v1/geocode?q=` — which since 2026-11-20 takes
  `near=lat,lng` too and searches all of Estonia, nearest that point
  first, and Tallinn without it — reading `results` with `label`,
  `where`, `lat` and `lng`; `GET /api/v1/lookup` and `POST /api/v1/lookup` as the
  map app does, the button offered from five letters, hidden on `why:
  'no-key'` and resting on any other refusal; and `GET /api/v1/route` with
  `from`, `to` and `mode=bike`, reading `meters`, `seconds` and `line`,
  and `others` — up to two more ways, each in those same three fields —
  for the choice on its card. And, for the turn it shows and says while
  riding, `steps` of the way and of each of the others: `at`, `meters`,
  `turn` and `name`, and `exit` on a roundabout. The words of `turn` —
  `left`, `right`, `keep-left`, `keep-right`, `straight`, `around`,
  `roundabout`, `arrive`, and `tunnel` where the way goes into one — are a
  recording each in the app, so a new word
  is one an installed app stays silent at.
  And, from 2026-11-22, `ridden: true` on the way riders made the most of,
  which the card names on its button, *Ridden*. The builds before it read
  only `style`, which the site sent for a day from 2026-11-19 and took
  back, and show that way unnamed.
  And `GET /api/v1/find` with no query, the whole roll, kept on the phone a
  week at a time so Where to? opens on the nearest places: `id`, `name`,
  `lat`, `lng` and `map` of each row.
- Its way by train, from 2026-11-18: `GET /api/v1/route` asked first with
  `from`, `to` and `mode=bike`, an answer without `version` asked again of
  the old `/api/route`, so `version` stays on every answer; and of `trains`, `seconds`, `meters`, `leave` and `legs`, a
  ride's `kind: "bike"`, `line` and `steps` in the words above, and the
  train's `kind: "train"`, `line`, `name`, `from`, `to` and `at`. A train's
  first ride ends in `arrive` at the station, which the app turns into the
  train's own corner, so that word there is a promise too.
- Its new way mid-ride, from 2026-11-18: the same two questions with
  `heading` beside them, whole degrees from north, the way the rider is
  going — answered in the same fields, the way setting off that way. An
  answer that ignored it would be read just the same.
- Its ways by bike, from 2026-11-23: with no `heading`, and but for a ride
  between cities, the ways are BRouter's, in the same fields and the same
  words of `turn`
  — **Nice ways by bike** in `docs/handbook.md`. Three things an installed
  app meets. The first way is the quietest and not the quickest, so
  `others` can hold a shorter one. `ridden: true` is on the way riders made
  the most of wherever it comes, first or among `others`, where it was only
  ever on the first. And a step's `name` is empty, BRouter's map having no
  street names, as it always was through a door: the row while riding is
  the turn alone. With a `heading`, and between cities, the answer is the
  router's as it was.
- Its lists, signed in: `GET /api/v1/me/lists`, reading `lists` with `id`, `title`
  and `n`; and `POST /api/v1/me/lists` with `create` (`title`, answered `id` and
  `title`), `place` (`name`, `address`, `lat`, `lng`, answered `place.id`)
  for a place tapped on the map that the roll does not have, and `add` (`id`,
  `place`). The error words it has sentences for are `signed-out`, `full`,
  `too-many` and `title`. An add it was keeping for later is tried again on
  a 5xx, after the same doubling wait a ride has, and dropped on any 4xx, so
  a new refusal that sending again could change must not be a 4xx.
- Its numbers, from 2026-11-22: `POST /api/v1/rides`'s save carries
  `summary` — `meters`, `seconds`, `total`, `stopped`, and `top`,
  `fastest`, `start` and `end` where the ride has them — which a session's
  save keeps and adds to the account's totals and a save with none does
  not read. A ride ridden wholly outside the four cities, saved signed in,
  is sent with `line: []` and without `anon`, answered `{ "counted": true }`;
  its `short`, `malformed` and — the session gone — `signed-out` are final,
  and the ride is listed as outside the cities. And `GET /api/v1/rides?totals=1`,
  signed in, for its My rides: `ready`, `user` and `totals` — `rides`,
  `meters`, `seconds`, `stopped`, `top`, `fastest`, `longest` and `since`,
  or null — asked when My rides opens, at most once a minute.
- Its ride page, from 2026-11-18: `GET /api/v1/rides/<id>`, signed in,
  for a ride it saved — reading `ride` with `meters` and `line`, the stored
  `[lat, lng]` pairs, which it draws over the phone's own line. It reads
  nothing of `insight`, working the same sums out of the phone's points, and
  `signed-out` and `not-found` just draw nothing.
- `GET /api/v1/account` for `user`, `appGoogle` and `appApple`, and `POST
  /api/v1/account` with `create` and `login` (`username`, `password`, answered
  `user`, refused with `taken`, `username`, `password`, `no-match` and
  `slow-down`), `ticket`, `logout` and `delete` (`current`, `username`).
- Signing in, as above: `/api/v1/apple` has to accept its bundle id — `APP_IDS`
  in `functions/api/_apple.js` — and the Google trip ends at
  `tallinntastebuds://signin`, which it listens for under that name.
- Numbers it restates, to be changed in both places: its 700 m, which is
  `MIN_METERS` and twice `ENDS` in `functions/api/rides.js`; `MAX_NAME`,
  `MAX_POINTS` and the four cities' boxes, `CITIES` in `functions/api/_lib.js` —
  `nearTallinn()`'s alone until 2026-11-20; and the 200 m in the sentence on
  its save card. How far apart its points are, how sure a fix has to be and
  how fast a jump may be are its own now: the website's recorder, which
  they were copied from, was taken out on 2026-11-18.
- Strings: none asked for. Its words are compiled in, in English, Estonian,
  Russian and Azerbaijani, the `ride*`, `account*`, `list*` and `lists*` ones copied out
  of `data/ui.json` under the same keys, so a sentence fixed here is fixed
  there by hand.

Written with Rattatee on 2026-11-17, its search, its username sign-in
and its lists added the same day, and its counted saves on 2026-11-20.

## Branches and deploys

- **There is no `main`.** The default branch is
  `claude/tallinn-tastebuds-map-nzoqx0`. Branch from it, rebase onto it, land
  back on it.
- That branch is also the live site. Cloudflare Pages is connected to this
  repository through its own Git integration, with that branch set as the
  production branch, and every push to it deploys tallinntastebuds.ee within
  the minute. **No other branch deploys anything** — Pages is set to watch the
  production branch and nothing else, so pushing the branch you are working on
  costs no deploy and gets no URL. **That connection is the only deploy
  path.** No workflow in this
  repository publishes, and there is no Cloudflare token or account id in
  GitHub's secret store — nothing is missing, so do not ask for one to be
  added.
- `.github/workflows/deploy.yml` (GitHub Pages) is manual-only and is **not**
  the live host. Do not reach for it.
- Work lands through a PR into the default branch — that is how all 100+ of
  them have. **The pull request** below is the exact sequence.
- **Always rebase.** A PR lands with GitHub's **Rebase and merge**, and a
  branch catches up with `git rebase`, never `git merge`. The history of the
  default branch is the list of changes that were made, in the order they were
  made, each one a commit that stands on its own — not a braid of merge
  commits recording who happened to be working at the same time. A rebase also
  puts the conflict where the change that caused it is, rather than in one
  merge commit that owns every line either side touched.
- Rebasing a branch that is already pushed rewrites it, so the push afterwards
  is `git push --force-with-lease`. That is fine on a branch you own — which
  every branch here is — and `--force-with-lease` is what refuses to do it if
  somebody else has pushed to it since.
- **There are no preview deployments.** Cloudflare counts a deployment against
  the free plan's five hundred a month whether it rebuilt anything or not —
  this site has no build command and one still spends a build — and running
  out is not a bill, it is a stop, which takes the live site down with the
  previews. The first three weeks ran 773 of them across 191 pull requests and
  next to none of those URLs was opened, so they were switched off rather than
  rationed. **Drive everything under `npx wrangler pages dev .`**: same
  bindings, a local copy of the database, your own machine, no deploy.
- **Two things `pages dev` cannot show you**, and both are rare: a
  `wrangler.toml` change to the `[env.preview]` block, which takes effect only
  once a preview carries it and which `pages dev` cannot reach because it reads
  the top level instead; and anything whose point is how it behaves on a real
  phone, which a localhost is not. Everything else it does show, the database
  included — `pages dev` runs D1 locally, under `.wrangler/state`, so a `db/`
  file loaded there with `wrangler d1 execute tallinntastebuds-preview --local
  --file=<file>` is visible without deploying anything or touching a remote
  row. On the two that are left, do not work around it and do
  not assume: say in the pull request that the change wants a preview and what
  you would look at on it. One `npx wrangler pages deploy . --branch=<name>`
  from a terminal makes one, and that is the owner's to run. If it starts
  coming up often, that is the signal to put previews back on some branches,
  and **The build budget** in `docs/handbook.md` says what that would cost.
- **Push once anyway.** The reason is no longer the budget: a branch that goes
  up five times runs the validator five times and tells whoever is reading
  that it was not ready. Everything under **Before you push** is written to
  run before the first push rather than around it, and a second push is for
  something that could only have been learnt after the first.

## Before you push

**Bring the default branch in first** — before the generators run, before the
validator, and before anything is driven in a browser:

```
git fetch origin claude/tallinn-tastebuds-map-nzoqx0
git rebase origin/claude/tallinn-tastebuds-map-nzoqx0
```

A branch cut yesterday is a branch testing a site that no longer exists. The
stamps are the loud half of that and the pull request will at least say so; the
quiet half is worse — the validator passed, the page was driven in a browser,
and both were looking at a tree the deploy will not be made from. It also puts
the conflict in front of you while you still hold the reason for every line you
changed, instead of at the end, when it is somebody else's afternoon.

Do it again if a review runs long enough for the branch to actually fall
behind — `git fetch` and look, rather than rebasing on a feeling, since the
push afterwards is another deploy — and re-run everything below afterwards
each time: replaying your commits over somebody else's `assets/` change is
exactly what makes the stamps stale.

Thirteen things in this repo are **generated**. `node tools/generate.mjs`
runs every one of them below except the two that need a Chromium, in the order
they depend on each other, and `.github/workflows/generated.yml` runs it on
every push to every branch but the live one and commits what changed — so a
forgotten generator is a bot commit on your branch now, not a red pull
request. Run it yourself before the push anyway: it saves that second commit,
the validator needs the tree caught up to say anything useful, and **if your
next push is refused because the bot got there first, `git pull --rebase`**
and push again. **The scripts that run themselves** in `docs/handbook.md`.

| After changing | Run | It rewrites |
|---|---|---|
| `assets/app.js`, `assets/styles.css`, `assets/lists.js` or `assets/lists.css` | `node tools/lean.mjs` | `assets/<name>.lean.js` or `.lean.css` beside each — the same file without the comments, which is what the pages load; `LEAN` at the top of the tool is the list. Run it before the stamper, since the stamper hashes the copies |
| anything in `assets/` | `node tools/stamp.mjs` | the `?v=` hashes in every page named in `PAGES` at the top of the tool |
| `data/restaurants.json` | `node tools/places.mjs` | `data/places.json` |
| `data/ui.json` or `data/restaurants.json` | `node tools/languages.mjs` | `data/lang/<code>.json` and `data/lang/index.json`, one language's strings and write-ups to a file, and `data/map.json`, the places without their write-ups — what the map reads instead of the two whole files |
| `data/decks.json` | `node tools/decks.mjs` | `data/decks/index.json`, one file per deck, lesson and song, `data/decks/spoken.json` and `data/decks/words.json` — what the flashcards' Functions, the voice and the door an assistant looks a word up through read instead of the whole file |
| `exports/tallinn_restaurants.csv` | `node tools/city.mjs` | `data/city.json` |
| `exports/tallinn_restaurants.csv`, or a place added to `data/restaurants.json` that the export already lists | `node tools/googlevenues.mjs` | `db/google-venues.sql` |
| `exports/tallinn_restaurants.csv` | `node tools/googlelists.mjs` | `db/google-lists.sql` |
| `exports/<city>_restaurants.csv` for Tartu, Narva or Pärnu, or a city added to `AREAS` in the tool | `node tools/cityvenues.mjs` | `db/city-venues.sql`, the other cities, which nothing on the site reads |
| a scene in `clips/scenes/` | `node tools/blogclips.mjs` | the four files in `clips/` that scene is drawn into — it needs a Chromium, and `--check` says which are missing |
| `assets/logo/og-flashcard.html`, or a token or rule it draws itself with | `node tools/ogcard.mjs` | `assets/logo/og-flashcard.png`, the card a link to the flashcards unfurls as — it needs a Chromium, and nothing in CI can see that it went stale |
| `data/flows.json` | `node tools/flows.mjs` | `flows/<id>.bpmn`, the diagrams on `/admin/flows` of who uses the site and what each can do |
| a language in `data/ui.json`, a place in `data/restaurants.json`, a deck, lesson or song in `data/decks.json`, a post in `data/blog.json`, a Google list in `tools/googlelists.mjs` or a face in `assets/faces/` | `node tools/sitemap.mjs` | `sitemap.xml` |

(The catalogue is the map plus an optional `data/places.csv` import. That CSV
is not in the repo — without one, `places.mjs` builds the catalogue from
`restaurants.json` alone, which is the current state.)

Then always:

```
node tools/validate.mjs
```

It checks all three for staleness and everything else besides — coordinates
outside Tallinn's bounding box, a photo listed in the data that is not in the
repo, a UI string present in one language and missing in another, a deal whose
place does not exist, `wrangler.toml` pointing preview and production at the
same database. CI runs exactly this on every push and every PR, with no
install step in front of it. Warnings never fail the build; errors do. CI runs
six more checks alongside it: `node tools/functions-check.mjs`, which imports
every module under `functions/` so that a name imported from a module that no
longer exports it, or a syntax error, fails the build here — Pages bundles
them into one Worker, and on a deploy that takes every route down rather than
its own; `node tools/sqlcheck.mjs`, which asks SQLite's planner how every
statement under `functions/` would read and fails on one that walks a whole
table, or can answer more than a hundred rows, without being listed with what
bounds it; `node tools/qrperf.mjs --check`, which holds `assets/qr.js` to the
exact matrix it drew when it was last scanned with a real camera; `node
tools/chessperf.mjs --check`, which holds the rules of chess in
`functions/api/_chess.js` to published move counts and to positions worked out
by hand; `node tools/mcpcheck.mjs --check`, which calls `/mcp` and the flashcards'
`/flashcard/mcp` over the real
data files the way an assistant would and holds the answers to what it was
promised; `node tools/apicheck.mjs --check`, which calls every address of the
public API at `/api/v1` and fails when an answer has lost a field or changed a
type that `data/api-v1.json` froze; and `node .claude/hooks/d1-write-gate.mjs --check`, which runs the
gate's own cases so that the thing standing between a session and the database
cannot be loosened without the build saying so.

And before the PR, the pass in `.claude/rules/leave-it-better.md`: read
every file in the diff end to end and clean up what reading it as a whole
turns up. The generators and the validator only check that the change is
consistent — they have nothing to say about whether it is any good.

**The stamps are why `lists.html` and `index.html` conflict on nearly every
rebase.** Two branches that both touched `assets/` both rewrote the same `?v=`
lines. Resolve by taking the *structure* from both sides (a new `<script>` tag,
say), then `node tools/stamp.mjs`, `git add`, `git rebase --continue`, and let
the stamper write the hashes. Never hand-merge a hash — a hash you typed is a
hash of nothing.

## The pull request

Every change lands the same way, and the sequence is written here and nowhere
else: each skill's **The pull request** adds only its own particulars — the
generators it runs, what it drives and how, what its body has to say, what
happens by hand after landing — and points back here for the rest. Do it in
this order, and do not skip a step because the change is small — the small
ones are the ones that ship broken.

1. **Rebase** onto the default branch (above), then the generators, then
   `node tools/validate.mjs`, then the `leave-it-better.md` pass over every
   file in the diff, then a browser for anything with a visible effect.
2. **Commit** in the voice below: a sentence about behaviour for the subject,
   prose for the body. Each commit stands alone: a branch that grew three
   commits saying "fix" squashes them into the one they were fixing before
   it is pushed.
3. **Push** the branch, once: `git push -u origin <branch>` the first time,
   `git push --force-with-lease` after a rebase. Step 1 happens before this,
   not around it — a push to find out what `node tools/validate.mjs` would
   have said in a second is a deploy spent on nothing. Push again for a
   review that asked for a change, a CI failure that only CI could have
   found, or a rebase a long review made necessary; not for a fix you could
   have folded into the commit before it went up. Three of those a PR is
   what spent the budget above.
4. **Open the pull request** against `claude/tallinn-tastebuds-map-nzoqx0`.
   The title is the commit subject when there is one commit, and a sentence
   about the whole when there are several. The body is prose, the same voice
   as the commit: what was wrong, what it is now, the trade-off, what was
   run and what was driven in a browser, and anything a person has to do by
   hand after it lands — a schema to apply, a database to load, a staff link
   to send. There is no template.
5. **CI** runs `node tools/validate.mjs`, `node tools/functions-check.mjs`,
   `node tools/sqlcheck.mjs`, `node tools/qrperf.mjs --check`, `node tools/chessperf.mjs --check`,
   `node tools/mcpcheck.mjs --check`, `node tools/apicheck.mjs --check` and
   `node .claude/hooks/d1-write-gate.mjs --check` on the push and on the PR.
   Red CI is yours to fix before anything else happens. **There is no preview
   URL** — pushing the branch deploys nothing, and the PR's checks carry no
   Cloudflare link. Anything with a visible effect gets driven under `npx
   wrangler pages dev .`, and the body says what was driven and how, since
   that is now the only account of it a reviewer gets.
6. **Merge with Rebase and merge**, never a merge commit, never a squash of
   commits that were written to stand alone. **Leave the branch.** A session
   cannot delete one — the git proxy takes a push and silently drops a ref
   deletion — and the owner is not to be asked to do it either: the pull
   request is the record, a merged branch costs nothing, and "delete the
   branch after" was a step every session tried, failed at, and then handed
   to the owner as a chore. Do not try, do not ask, do not mention it.
7. A push to the default branch is the deploy. A story goes live when its
   `from` comes round; everything else is live within the minute.
8. **Say where it stands** in the first line of the message that follows, so
   the owner knows whether the tab can be closed. The next section is the
   whole of it.

The one exception is a branch the admin page made — `admin/add-<id>` or
`admin/edit-<id>`. It has no pull request: the owner pressing **Put it on the
map** is the yes, given once for all of them, and the `land` job in
`.github/workflows/generated.yml` replays its one commit onto the default
branch, runs the generators, runs every check CI runs, and pushes if they
pass. A red one stays where it is, with its branch, for somebody to look at;
the `/place` skill says what to do with it. Merge on green is for the admin
page's branches and no others.

## Say where it stands, in the first line

The last message a session writes is where the owner finds out whether there
is anything left for them to do, and they should find out in the first line of
it — not four paragraphs into a summary of what changed. Open with the state,
then explain at whatever length the change deserves.

Three states, and they are not interchangeable:

- **Landed, nothing left.** Say that, and say the session can be closed:
  *"#187 is merged — the site is live with it within the minute, and this
  session can be closed."* Merged is a fact to check rather than an inference
  from having pushed: look at the pull request and at CI on the commit that
  landed. Red CI, an open PR, and a review still going are none of them this
  state.
- **Landed, but something is waiting on a person.** The same line, and then
  the thing itself, because this is the one that gets lost — a `.sql` file to
  load, a schema to apply, a staff pass link to send, a story that goes live
  when its `from` comes round. Name the command or the two lines that would do
  it. A merged pull request whose database write has not been asked for yet is
  this state and not the one above: **What needs a yes** is why.
- **Not landed.** Say what it is waiting on — red CI, a review, an answer to a
  question, a write only the owner can approve — and what the next step is,
  whose it is, and whether the session is worth keeping open for it.

Say it in the same voice as everything else here; it is a sentence about where
the work is, not a status field. The rest of the message carries on as usual.
This only settles where the verdict goes, so that closing a tab does not mean
reading a transcript first.

## How the code is written

There are two dialects and they do not mix: browser JavaScript in `assets/` is
ES5, served raw, and the Functions in `functions/` are modern ESM on the
Workers runtime. The `/site` and `/api` skills each say what theirs looks like.

**Comments carry the reasoning, not the mechanics.** Every file here opens
with a block explaining what the thing is and why it is that way, and the
prose inside says what was tried, what broke, and what the trade-off was. Read
one before you write one — `assets/lists.js` and `functions/api/lists.js` are
representative. A patch that matches the code but not the commentary reads as
foreign. Do not strip or shorten existing comments to make a diff smaller.

**Every feature has a README section, and the section is part of the
feature.** A change that makes a paragraph wrong rewrites the paragraph in
the same commit; a new thing gets its own. The README is long because it is
where the reasoning lives, and it is only worth something while it is true.

## How a commit reads

Commit subjects are sentences about behaviour, in the imperative, with no
`feat:`/`fix:` prefix and no scope tag:

> Carry a row to where it belongs instead of clicking it there
> A save is free again, and the account is the offer
> Counts come from a counts table, not a `COUNT(*)` on every read

Bodies are prose and are usually several paragraphs: what was wrong, what it is
now, and the trade-off taken. Same voice as the code comments. PR descriptions
follow suit — there is no template in this repo.
