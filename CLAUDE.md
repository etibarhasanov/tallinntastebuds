# Working on Tallinn Tastebuds

A full-screen map of places in Tallinn, plus discounts, stories, saves and
lists. Static files, a handful of Cloudflare Functions, one D1 database.

**No build step and no `npm install`, ever.** There is no `package.json` and
nothing in `node_modules`. The files in this repo are the files that get
served, and every tool in `tools/` is zero-dependency on purpose so it still
runs in five years. If a change seems to want a bundler, it is the wrong
change.

`README.md` is over four thousand lines and is the real documentation — what
counts as a Restaurant, how discounts work at the table, why Estonian is `et`.
Read the section you need before touching that area. This file is the part
every session needs *before* it starts — where things go, what to run, and
what has bitten people already — and an index to the rest.

## Which process is this?

Work here arrives in a few recurring shapes, and each has a file of its own
under `.claude/processes/`. Find the row that matches the task and read that
file end to end before touching anything: it says which README sections to
read, what to run, what to check in a browser, how the commit reads, and what
has gone wrong before. A task that spans two rows reads both. A task that
matches none — a README correction, a workflow change — still reads
`leave-it-better.md` and follows the sections below.

| The task | Read |
|---|---|
| Add a place, change one, add its photos, mark it closed | `.claude/processes/place.md` |
| Post a story, schedule one, take one down | `.claude/processes/story.md` |
| Switch a discount on or off, or change what it offers | `.claude/processes/discount.md` |
| Change what a page does or looks like — anything in `assets/`, an HTML file, `data/ui.json`, a language | `.claude/processes/site.md` |
| Change a Function, the schema, `wrangler.toml`, or anything that reads or writes D1 | `.claude/processes/api.md` |
| Refresh the Google Places export | `.claude/processes/google-venues.md` |
| Nothing asked, or asked to tidy: clean one file | `.claude/processes/leave-it-better.md` |

`leave-it-better.md` is the main rule of this repo, and it outranks "keep the
diff small". `site.md` and `api.md` both send you there; the data processes
only do when the change reaches into a tool or a script.

The files are templates as much as instructions: when a process turns out to
have a step nobody wrote down, or a way of going wrong that is not in its
file yet, add it to the file in the same PR. That is how they get richer than
this one ever was.

## Branches and deploys

- **There is no `main`.** The default branch is
  `claude/tallinn-tastebuds-map-nzoqx0`. Branch from it, rebase onto it, land
  back on it.
- That branch is also the live site.
  `.github/workflows/cloudflare.yml` names it as `PROD_BRANCH` and deploys it
  to Cloudflare Pages at tallinntastebuds.ee. Everything else deploys as a
  preview under `*.tallinntastebuds.pages.dev`, against a separate database.
- `.github/workflows/deploy.yml` (GitHub Pages) is manual-only and is **not**
  the live host. Do not reach for it.
- Work lands through a PR into the default branch — that is how all 100+ of
  them have.
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

Do it again if a review runs long enough for the branch to fall behind again,
and re-run everything below afterwards each time: replaying your commits over
somebody else's `assets/` change is exactly what makes the stamps stale.

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

And before the PR, the pass in `.claude/processes/leave-it-better.md`: read
every file in the diff end to end and clean up what reading it as a whole
turns up. The generators and the validator only check that the change is
consistent — they have nothing to say about whether it is any good.

**The stamps are why `lists.html` and `index.html` conflict on nearly every
rebase.** Two branches that both touched `assets/` both rewrote the same `?v=`
lines. Resolve by taking the *structure* from both sides (a new `<script>` tag,
say), then `node tools/stamp.mjs`, `git add`, `git rebase --continue`, and let
the stamper write the hashes. Never hand-merge a hash — a hash you typed is a
hash of nothing.

## How the code is written

There are two dialects and they do not mix: browser JavaScript in `assets/` is
ES5, served raw, and the Functions in `functions/` are modern ESM on the
Workers runtime. `site.md` and `api.md` each say what theirs looks like.

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

## Commits and pull requests

Commit subjects are sentences about behaviour, in the imperative, with no
`feat:`/`fix:` prefix and no scope tag:

> Carry a row to where it belongs instead of clicking it there
> A save is free again, and the account is the offer
> Counts come from a counts table, not a `COUNT(*)` on every read

Bodies are prose and are usually several paragraphs: what was wrong, what it is
now, and the trade-off taken. Same voice as the code comments. PR descriptions
follow suit — there is no template in this repo.
