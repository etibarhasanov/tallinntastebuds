# Working on Tallinn Tastebuds

A full-screen map of places in Tallinn, plus discounts, stories, saves,
lists, profiles, a directory of the city, a chat that answers with places, a
blog about what all of it does, and — on a subdomain of its own — a way to
split the bill afterwards.
Static files, eighteen Cloudflare Functions, two D1 databases (preview and
production, never one), and a Workers AI binding for the chat.

**No build step and no `npm install`, ever.** There is no `package.json` and
nothing in `node_modules`. The files in this repo are the files that get
served, and every tool in `tools/` is zero-dependency on purpose so it still
runs in five years. If a change seems to want a bundler, it is the wrong
change.

`README.md` is over five thousand lines and is the real documentation — what
counts as a Restaurant, how discounts work at the table, why Estonian is `et`.
Read the section you need before touching that area, and only that section:
`grep -n '^## ' README.md` is its table of contents with line numbers, and
every skill names the sections it needs by heading. This file is the part
every session needs *before* it starts — where things go, what to run, and
what has bitten people already — and an index to the rest.

## Orient in two minutes, not twenty

What a session tends to spend its first quarter-hour rediscovering, so it
does not have to:

- **Something new is described before it is built.** A new page, panel,
  button, field, chip or route gets a written shape and the owner's yes
  before any code is written — **Something new is described before it is
  built** below is the whole of it. Everything else, which is nearly all the
  work, goes straight to code the way it always has.
- **There is no test suite.** `node tools/validate.mjs`, `node
  tools/qrperf.mjs --check` and `node .claude/hooks/d1-write-gate.mjs --check`
  are the whole of CI. Anything with a visible effect is driven in a browser;
  the `/site` and `/api` skills say how. Do not go looking for a test runner,
  and do not write one into a PR that was about something else.
- **Line numbers in the docs are not to be trusted; names are.** The skills
  and the README name functions and constants — `applyStyle()`,
  `STORY_HOURS`, `DEAL_KEYS`, `KITCHENS` — and `grep -n` finds them. A line
  number that appears anywhere in prose was true on the day it was written.
- **The big files are found, not remembered.** `.claude/rules/leave-it-better.md`
  carries the one-line `wc -l` that lists every file over ~600 lines; the
  answer changes month to month and the rule says how to read a file on
  either side of that line.
- **The counts are written into the prose** — seventy-five places, 1,110
  Google venues, ten languages, thirteen types — in the README, the code
  comments and the skills, and each skill says where its own copies live and
  gives the `grep` that finds them. Change a count, move the copies you are
  standing in, and say which you left.
- **The chat costs nothing and is easy to exhaust.** `/api/ask` runs on
  Workers AI's free daily allowance, and preview and production spend from
  the same pot. Driving the chat on a preview for an afternoon puts the live
  site out of model until midnight UTC. Ask it a few questions, not fifty.
- **A preview deploy reports into the live analytics.** Both tags — Google's
  and Microsoft Clarity's — are written into the pages rather than set per
  environment, so every `*.pages.dev` branch counts into the same GA property
  and records into the same Clarity project as tallinntastebuds.ee. Nothing
  stands in front of them: the banner that did for a day was taken out on
  purpose, so an afternoon spent driving a preview lands in the owner's real
  heatmaps and there is no button to press to stay out. Not a reason to avoid
  driving one — it is the whole point of a preview — just a reason to say so in
  the PR if you leant on it.
- **The preview database is the only one to drive against**, and the
  Cloudflare MCP `d1_database_query` tool reads either database without a
  prompt. It writes to neither without one: `.claude/hooks/d1-write-gate.mjs`
  stops every write, refuses one past a hundred rows or one whose size is not
  in the statement, and never runs `DROP` at all. That and the two hard
  denials in `.claude/settings.json` are the owner's standing instruction and
  are not to be argued with — **What needs a yes** below is the whole of it.
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
| Change splitwise — the group page, what a group can do, or the subdomain itself | `/site` **and** `/api`, and **Splitwise** in `README.md` |
| Refresh the Google Places export | `/google-venues` |

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

The seventh rule is the main one: `.claude/rules/leave-it-better.md` loads by
itself the moment a session reads or edits anything under `assets/`,
`functions/`, `tools/`, `db/` or an HTML page. It outranks "keep the diff
small", and its last section is the process for a session with nothing else
to do.

The files are templates as much as instructions: when a process turns out to
have a step nobody wrote down, or a way of going wrong that is not in its
file yet, add it to the file in the same PR. That is how they get richer than
this one ever was. **And they go stale the same way the code comments do**:
a route added to `functions/api/` without a row in the `/api` skill's table,
a page added without joining the stamper's list in the `/site` skill, a
refresh that changed a count the `/google-venues` skill had written down.
A change to a feature reads the skill for that feature before the PR, the
way it reads the README section, and fixes what the change made wrong.

## Something new is described before it is built

A change to something that already exists arrives with its own brief: the
thing is there, it is wrong in a way somebody can point at, make it right.
Something **new** does not. Nobody has seen it yet, so what gets built is
whatever the session pictured while it read the sentence — and the first time
the owner sees that picture is when it is merged and live — there are no
preview deployments any more — after the code, the stamps, the README
section, the ten languages and the browser pass have all been spent on it. Changing it then is not an edit. It is the whole change
again, written by a session that has already talked itself into the first
version.

So the shape comes first, in words, and it comes from the owner.

**What this catches: anything new a visitor can see or press.** A new page, a
new panel or sheet, a new button, a new field, a new filter chip, a new route
under `functions/api/`, a new thing a group can do on splitwise. The test is
whether a visitor could not do something yesterday and could tomorrow.

**What it does not catch, which is nearly all the work.** Fixing what is
broken. Restyling or rewording what is already there. A place, a story, a
discount, a language, a refresh of the export, a README correction, anything
in `tools/`, a cleanup under `leave-it-better.md`. Those go straight to code
the way they always have. This gate is about things nobody has seen yet, not
about being careful in general, and an ordinary afternoon never reaches it.

**What to send.** Prose in the same voice as everything else here, short
enough to read on a phone, saying:

- what the thing is, in a sentence, and which page it lives on;
- every state it has — empty, loading, error, signed out, the place with no
  photo — because the states are where a description and an implementation
  turn out to have disagreed;
- the copy, in English, and the note that it needs all ten languages in
  `data/ui.json` before it ships;
- what it does at 390 px, which is the phone the README measures against;
- what it deliberately does not do yet, so the boundary is a decision rather
  than an oversight;
- what it costs — a table, a route, a page joining `PAGES` in
  `tools/stamp.mjs`, a `.sql` file somebody has to load by hand;
- and the questions the session genuinely cannot answer for itself. Two real
  ones are worth more than twelve that include the obvious.

Hold it to **The design rules** in `README.md` while writing it. They are
twelve rules a new sheet, page or button is held to, and it is cheaper to
fail them in a paragraph than in a stylesheet.

**A mockup when the words will not settle it.** A layout that does not exist
yet is hard to argue about in prose. When the shape is a new arrangement on
screen rather than another instance of one the site already has, follow the
words with something to look at, and say plainly that it is a mockup rather
than the change. It is drawn and driven the way everything else here is —
`npx wrangler pages dev .`, or `python3 -m http.server 8000` for something
static — and what the owner gets is a picture of it rather than a link.
**There are no preview deployments** below is why: a URL spends one of the
five hundred builds a month, and making one is the owner's to run rather than
a session's to spend. A new button on a panel that already exists does not
need a mockup. A new page does.

**Then stop.** Post the shape, say in the first line that the session is
waiting on an answer — **Say where it stands** below is how — and write no
code. Not the schema, not the Function, not the scaffolding that will "be
needed either way". A session that guesses and builds while it waits has
spent the afternoon the asking was meant to save, and a guess is much harder
to throw away once it compiles.

This is the owner's instruction in as many words: first clear functionality,
later code. The half-hour a description takes is the cheapest half-hour in
the process, and it is bought against writing the whole change twice.

## What needs a yes, and what does not

The repository is yours to work in: branch, edit, generate, validate, drive a
browser, commit, push, open a pull request. None of that needs asking, and
asking about it wastes an afternoon. What needs asking is *what to build*,
when the thing is new and nobody has seen it — the section above — and once
that is answered the building is yours.

**Two live things are not yours, and one of them is a database.** The rows in
D1 — production `tallinntastebuds` and preview `tallinntastebuds-preview` —
belong to the person whose site this is and to the people who saved a place or
made a list. Reading them is free and is how everything gets verified. Writing
to them is a decision, and it is theirs:

- **Every write asks.** `INSERT`, `UPDATE`, `DELETE`, any DDL, and loading
  `db/google-venues.sql`, `db/google-lists.sql` or `db/schema.sql`.
  `.claude/hooks/d1-write-gate.mjs` — a `PreToolUse` hook wired in
  `.claude/settings.json` — classifies the SQL of every `d1_database_query`
  call and lets reads through, so the prompt is not something to remember.
  Do not route around it: not with a shell `wrangler` command, not with a
  Function written to do the write when it is called.
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
  bindings, same preview database, your own machine, no deploy.
- **Two things `pages dev` cannot show you**, and both are rare: a
  `wrangler.toml` change to the `[env.preview]` block, which takes effect only
  once a preview carries it and which `pages dev` cannot reach because it reads
  the top level instead; and anything whose point is how it behaves on a real
  phone, which a localhost is not. Everything else it does show, the database
  included — `pages dev` talks to the same remote `tallinntastebuds-preview`
  that a preview deployment would, so a `db/` load is visible there without
  deploying anything. On the two that are left, do not work around it and do
  not assume: say in the pull request that the change wants a preview and what
  you would look at on it. One `npx wrangler pages deploy . --branch=<name>`
  from a terminal makes one, and that is the owner's to run. If it starts
  coming up often, that is the signal to put previews back on some branches,
  and **The build budget** in `README.md` says what that would cost.
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

Six things in this repo are **generated**. Editing a source without
re-running its generator is the single most common way to fail CI:

| After changing | Run | It rewrites |
|---|---|---|
| anything in `assets/` | `node tools/stamp.mjs` | the `?v=` hashes in the nine pages named in `PAGES` at the top of the tool |
| `data/restaurants.json` | `node tools/places.mjs` | `data/places.json` |
| `data/restaurants.json` or `data/taxonomy.json` | `node tools/typelists.mjs` | `db/type-lists.sql` |
| `exports/tallinn_restaurants.csv` | `node tools/googlevenues.mjs` | `db/google-venues.sql` |
| `exports/tallinn_restaurants.csv` | `node tools/googlelists.mjs` | `db/google-lists.sql` |
| a scene in `clips/scenes/` | `node tools/blogclips.mjs` | the four files in `clips/` that scene is drawn into — it needs a Chromium, and `--check` says which are missing |

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
`node tools/qrperf.mjs --check` alongside it, which holds `assets/qr.js` to the
exact matrix it drew when it was last scanned with a real camera, and `node
.claude/hooks/d1-write-gate.mjs --check`, which runs the gate's own cases so
that the thing standing between a session and the database cannot be loosened
without the build saying so.

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

Every change lands the same way, and each skill restates this with its own
particulars. Do it in this order, and do not skip a step because the change
is small — the small ones are the ones that ship broken.

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
5. **CI** runs `node tools/validate.mjs`, `node tools/qrperf.mjs --check` and
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

A pull request the admin page opened — a branch named `admin/add-<id>` or
`admin/edit-<id>` — is landed the same way, with one step in front: check it
out, `node tools/places.mjs`, commit `data/places.json`, push. The `/place`
skill says why.

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
