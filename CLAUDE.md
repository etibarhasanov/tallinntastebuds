# Working on Tallinn Tastebuds

A full-screen map of places in Tallinn, plus discounts, stories, saves and
lists. Static files, a handful of Cloudflare Functions, one D1 database.

**No build step and no `npm install`, ever.** There is no `package.json` and
nothing in `node_modules`. The files in this repo are the files that get
served, and every tool in `tools/` is zero-dependency on purpose so it still
runs in five years. If a change seems to want a bundler, it is the wrong
change.

`README.md` is 3,600 lines and is the real documentation — what counts as a
Restaurant, how discounts work at the table, why Estonian is `et`. Read the
section you need before touching that area. This file is only the part a
session needs *before* it starts: where things go, what to run, and what has
bitten people already.

## Leave the code better than you found it

This is the main rule, and it outranks "keep the diff small".

Rubbish nobody's change happens to land on top of never gets cleaned, because
nothing ever quite touches it. So the rule reaches past the lines you edited —
but it reaches a measured distance, not an unbounded one:

| What you touched | What you read and fix |
|---|---|
| a function | **that whole function**, always, however you got there |
| the file it is in | **the whole file, if it is under ~600 lines** |
| a file over ~600 lines | the functions you touched, plus what they call and what calls them — not the rest |

Four files in this repo are over that line and it is deliberate that they are
exempt: `assets/app.js` (6,250), `assets/lists.js` (2,358), `tools/validate.mjs`
(926) and `functions/api/lists.js` (794). Everything else is small enough to
read in full while you are in it. Do not "skim" a big file and report it as
read — say which functions you read.

Do not step around a mess to get to your line and leave it exactly as you found
it. "It was already like that" is not a reason — it is the reason it is still
like that.

In practice:

- **Duplication that already exists, three copies or more, is a function.** If
  a change would add another copy, write the function first and change one
  place instead of five. `toggleChip()` and `clearChips()` in `assets/app.js`
  are the worked example: four listeners were each doing the same toggle by
  hand, so it is written once. Note what made it right — the four copies were
  already there and the change was about to add a fifth. One caller, or a
  guess about future callers, is not this.
- **A comment that has stopped being true is a bug.** This codebase explains
  itself at length and that is only worth something while the explanations are
  accurate. If a change makes a paragraph wrong, rewrite the paragraph —
  README included. This is the other half of "do not strip or shorten existing
  comments": do not leave a stale one standing either.
- **A name that describes what something used to be is worth changing.** When a
  list stopped being a filter, `LIST_FILTER` went with it rather than staying
  as a constant that misled every reader after.
- **Dead things go** in the commit that orphaned them: an unused `ui.json` key
  in all ten languages, a CSS rule for an element nothing renders any more, a
  helper with no callers.
- **Refactoring and behaviour change belong in the same commit**, because the
  point is the state the file is left in. Do not open a follow-up for tidying
  the thing you were already standing in.

**The file is the boundary, and it is a limit as well as a licence.** Work that
would spread past it — a rename reaching forty files, a rewrite of a module you
only imported from, a schema this file happens to read — is a piece of work in
its own right and not something to slip into an unrelated PR. Name it and leave
it. What you may not do is notice it and say nothing, because then nobody
knows, and the next person to open the file starts the same discovery again.

### Cleaning means removing, not adding

This is the failure mode this rule creates if it is left unqualified, and it
has already happened here: told to improve things, a session starts inventing
helpers and scattering new methods through a file that did not ask for them.
That is not cleaning. It is the same mess with more names in it, and the next
person has to read every one of them before they can change anything.

So the bar for **adding** anything is higher than the bar for removing it:

- **A helper with one caller is not a helper.** Do not extract something used
  once. Do not extract because a function "feels long".
- **Extract from duplication that is already there**, counted — three or more
  real copies you can point at. Never from duplication you expect to arrive.
- **A cleanup that makes the file longer needs a reason you can say out loud.**
  The usual honest outcome of this pass is fewer lines, not more.
- **Do not reorganise for taste.** Moving functions around, renaming things
  that are already accurate, or restyling code to a preference is churn: it
  costs every reviewer a diff and buys nothing.

Deleting, on the other hand, needs no justification beyond the thing being
unused. If you can remove it and nothing breaks, remove it.

### Do not let this become the task

The pass is minutes of reading, not a project. If cleaning what you found is
turning into a bigger job than the change you came to make, stop: say what you
found and leave it. A session should be able to orient, do the thing it was
asked, tidy what it stood on, and finish — not disappear into the repo.

### Before the PR, read it again as a whole

Work arrives in pieces, and a change that was clean at each step is often not
clean as a whole: the third edit to a function makes the first one redundant,
a helper written for two callers ends up with one, a comment written before a
rethink now describes the version that lost the argument. None of that is
visible from inside the edit that caused it. It is only visible by going back.

So before opening a pull request, list the files it changes and read each one
again — at the reach the table above gives, so the whole file under ~600 lines
and the touched functions above it. **Read the files, not the hunks.** A diff
shows the lines that moved and hides the code they landed among, which is
exactly the wrong half for this. Then fix what that reading finds, in the same
PR: what your change made worse, and what was already wrong in what you read.

Coming back with "it can stay as it is" is a finding too, but it has to be the
result of having looked, and it should be said rather than left silent.

**Every line has to earn its place.** If you cannot say why a line, a helper,
a parameter, a class or a comment is there, it does not stay. Something added
"in case", a flag with one caller that is always the same value, a wrapper that
only forwards, a comment restating the line under it — each is a thing the next
person has to read and account for before they can change anything nearby.
Being able to delete something is a reason to delete it.

Ask it of each file as it now stands, rather than of the edits that got it
there. Whether a problem arrived with this change or was already sitting in the
file is a question about history, and the file does not care:

- Is anything duplicated — inside the file, or against something that already
  existed elsewhere?
- Is anything dead? Unreachable, uncalled, unread, unrendered. A `ui.json` key
  no page prints, a CSS rule for an element nothing draws, a helper whose last
  caller went years ago.
- Does every name describe what the thing is, rather than what it used to be or
  what it was partway through this change?
- Is every comment still true, and every README paragraph about anything in
  this file?
- Would a smaller version do the same job?

This pass is part of the work, not a review step somebody else performs. A PR
is the first time the change gets read as a whole, and it should not be the
first time for the person who wrote it.

### With nothing else to do, clean one file

A session that has finished what it was asked and has no next task should pick
one file and leave it better than it was. Not a sweep across the repo and not a
rename touching forty files — one file, read properly, improved, with a commit
message saying what changed and why it was worth changing.

The same standard applies as anywhere else, and **Cleaning means removing, not
adding** applies hardest here: a session with no task and an instruction to
improve something is exactly the situation that produces invented helpers
nobody asked for. If the file does not get shorter, be able to say why.

Behaviour stays identical, the validator passes, and anything with a visible
effect is driven in a browser before it is pushed. A cleanup that breaks
something is worse than the mess it tidied, and worse in a way nobody is
watching for, because the PR said it changed nothing.

Say plainly in the PR that this is what it is. A behaviour change carries its
own justification; a cleanup has to state one.

## Branches and deploys

- **There is no `main`.** The default branch is
  `claude/tallinn-tastebuds-map-nzoqx0`. Branch from it, merge back into it.
- That branch is also the live site.
  `.github/workflows/cloudflare.yml` names it as `PROD_BRANCH` and deploys it
  to Cloudflare Pages at tallinntastebuds.ee. Everything else deploys as a
  preview under `*.tallinntastebuds.pages.dev`, against a separate database.
- `.github/workflows/deploy.yml` (GitHub Pages) is manual-only and is **not**
  the live host. Do not reach for it.
- Work lands through a PR merged into the default branch — that is how all 80+
  of them have.

## Before you push

Three files in this repo are **generated**. Editing their source without
re-running the generator is the single most common way to fail CI:

| After changing | Run | It rewrites |
|---|---|---|
| anything in `assets/` | `node tools/stamp.mjs` | the `?v=` hashes in every HTML file |
| `data/restaurants.json` | `node tools/places.mjs` | `data/places.json` |
| `exports/tallinn_restaurants.csv` | `node tools/googlevenues.mjs` | `db/google-venues.sql` |

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
exact matrix it drew when it was last scanned with a real camera.

And before the PR, the pass in **Leave the code better than you found it**:
read every file in the diff end to end and clean up what reading it as a whole
turns up. The generators and the validator only check that the change is
consistent — they have nothing to say about whether it is any good.

**The stamps are why `lists.html` and `index.html` conflict on nearly every
merge.** Two branches that both touched `assets/` both rewrote the same `?v=`
lines. Resolve by taking the *structure* from whichever side has it (a new
`<script>` tag, say), then run `node tools/stamp.mjs` and let it rewrite the
hashes. Never hand-merge a hash.

## How the code is written

**Browser JavaScript (`assets/*.js`) is ES5.** `var`, `function`, no arrow
functions, no `const`/`let`, no template literals — grep the files, there are
zero. Each is wrapped in an IIFE with `'use strict'`. It is served raw to the
browser, so it is written for the browser as it is, not for a transpiler.

**Functions (`functions/**/*.js`) are modern ESM** on the Workers runtime —
`const`, arrows, `async`/`await`, top-level `import`. Different file, different
rules; don't carry one dialect into the other.

**Comments carry the reasoning, not the mechanics.** Every file here opens
with a block explaining what the thing is and why it is that way, and the
prose inside says what was tried, what broke, and what the trade-off was. Read
one before you write one — `assets/lists.js` and `functions/api/lists.js` are
representative. A patch that matches the code but not the commentary reads as
foreign. Do not strip or shorten existing comments to make a diff smaller.

**Nothing names a colour.** `assets/styles.css` defines tokens — `--ink`,
`--muted`, `--paper`, `--wash`, `--hairline`, `--accent`, `--accent-lit` — and
the two styles restate every one of them: `[data-style="red"]` (light, brick)
and `[data-style="green"]` (dark, forest). A component that hardcodes a hex is
the one thing that fails to change when somebody presses a swatch. There is no
`prefers-color-scheme` switch; the style is a choice, stored in `localStorage`
under `ttb.style`.

**Secondary pages apply the style themselves.** `assets/app.js` owns the
swatches on the map; `lists.js` and `pass.js` read `ttb.style` (and `ttb.lang`)
out of `localStorage` on boot and set `data-style` on `<html>` — plus
`colorScheme` and the `theme-color` meta. A new page that skips this silently
renders in the light palette whatever the visitor chose. Both keys also accept
a `?style=` / `?lang=` override, so a shared link can carry them.

**Every UI string lives in `data/ui.json`, in all ten languages** (az, hy, en,
et, fi, pt, ru, es, tr, uk). A key present in one and missing in another fails
validation. Never print a raw key or an English fallback to a visitor.

## The database

Two D1 databases, and the split is load-bearing: `tallinntastebuds` for
production, `tallinntastebuds-preview` for every preview deployment. Each
carries an `ENVIRONMENT` var that `functions/api/_lib.js` compares against the
database's own meta row, so a binding pointed at the wrong one shuts the API
off rather than writing to it. `wrangler.toml` explains the whole arrangement
and `tools/validate.mjs` refuses to let the two ids drift back together.

Secrets (`SAVE_SALT`, `TURNSTILE_SECRET`, the mail tokens) live in the Pages
dashboard, per environment, and never in the repo.

`.claude/settings.json` carries hard denials for D1: never `DROP` a table,
never run `DELETE`/`UPDATE` without a `WHERE`. The rows are other people's and
there is no backup in this repository.

Every write in `functions/api/lists.js` is a prepared statement, and every
write to a list is preceded by a read of `lists.owner`. The one deliberate
exception — keeping somebody else's list — does its own narrower check. The
file's header block explains the rule; keep it true.

## Data files

`data/restaurants.json` is the map: 74 places, hand-written, nothing generated.
`data/places.json` is the much longer catalogue a list picks from, and it *is*
generated. `taxonomy.json` holds the types, `deals.json` the discounts,
`stories.json` the queue, `ui.json` the strings, `schema.json` the shapes.

Everything under `data/` is served `must-revalidate` (see `_headers`), which is
what lets a story scheduled last week go up on the hour with no deploy in
between. Photos and story videos are cached for a week, because they are
replaced rather than edited.

## Commits and pull requests

Commit subjects are sentences about behaviour, in the imperative, with no
`feat:`/`fix:` prefix and no scope tag:

> Carry a row to where it belongs instead of clicking it there
> A save is free again, and the account is the offer
> Counts come from a counts table, not a `COUNT(*)` on every read

Bodies are prose and are usually several paragraphs: what was wrong, what it is
now, and the trade-off taken. Same voice as the code comments. PR descriptions
follow suit — there is no template in this repo.

## Checking a change in a browser

There is no test suite. `wrangler pages dev` runs the real bindings locally
against the preview database. For anything that needs a live-looking API, a
static server over the repo root plus a stubbed `/api/*` route in Playwright is
enough to drive the page — Chromium is already installed in this environment at
`/opt/pw-browsers/chromium`. Prefer that over asserting a change works from
reading the diff.
