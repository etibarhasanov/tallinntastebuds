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
