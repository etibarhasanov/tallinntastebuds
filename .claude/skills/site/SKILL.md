---
name: site
description: Change what a page does or looks like: anything in assets/, an HTML file, data/ui.json, a style, or adding a language.
---

# Change a page

Anything a visitor sees or presses: the scripts and stylesheets in `assets/`,
the HTML pages, `data/ui.json`, the labels in the taxonomy and the cuisines, a
language. It is the process with the most rules because a mistake here reaches
every phone that opens the map, and a browser holding yesterday's script
against today's data has already taken the site down once — that story is in
the header of `tools/stamp.mjs`.

`.claude/rules/leave-it-better.md` loads itself the moment you open a file
here. It is the main rule and it applies to every line you touch.

## Read first

- The README section for the feature you are standing in. Every one has one —
  **Saves**, **Lists**, **Stories**, **The directory**, **The radio**,
  **Surprise me**, **Languages**, **The two styles** — and it carries the
  reasoning the code only hints at.
- `README.md` → **The design rules**: twelve rules a new sheet, page or
  button is held to. Two of them the validator enforces; the other ten are
  read by a person, and that person is you.
- The header block of the file you are about to change. `assets/app.js` and
  `assets/lists.js` are far over the ~600-line mark, so the reach there is the
  functions you touch plus what they call and what calls them. Say which
  ones you read.

## How the browser code is written

**ES5, and nothing else.** `var`, `function`, no arrow functions, no `const`
or `let`, no template literals — `grep -nE '\bconst |\blet |=>' assets/*.js`
hits only prose in comments. Every file is one IIFE with `'use strict'`. It
is served raw to whatever browser opens it, written for the browser as it is,
not for a transpiler. A patch in the other dialect is the fastest way to look
foreign.

**Nothing names a colour.** The tokens are the first block of
`assets/styles.css` — `:root` holds Red's palette so a cold load never
flashes a third one — and `[data-style="red"]` and `[data-style="green"]`
each restate every one of them. A component that hardcodes a hex is the one
thing that fails to change when somebody presses a swatch. There is no
`prefers-color-scheme` switch; the style is a choice, kept in `localStorage`
under `ttb.style`.

**Every page applies the style and the language itself, on boot, first.**
`applyStyle()` at `assets/lists.js:179-197` is the fullest copy: `?style=`,
else `ttb.style`, else `red`; set `data-style` on `<html>`; set
`colorScheme` to `dark` for green, or a native control is "a white box on a
dark card"; write the computed `--wash` into `<meta name="theme-color">`.
Then `pickLanguage()` — `?lang=`, else `ttb.lang`, else the browser's
languages, else `en` — and `applyStaticStrings()` over the `data-i18n`,
`data-i18n-aria-label`, `data-i18n-placeholder` and `data-i18n-title`
attributes. `app.js`, `lists.js` and `venues.js` each carry that block;
`pass.js` carries it without the `theme-color` line, so the three pass pages
keep light browser chrome under the dark style. A new page copies the block
whole, and its head carries `<meta name="color-scheme">` and
`<meta name="theme-color">` like `lists.html`'s.

**Every UI string lives in `data/ui.json`, in all ten languages** — az, hy,
en, et, fi, pt, ru, es, tr, uk. Never print a raw key or an English fallback
to a visitor. A key nothing prints any more goes, in all ten, in the commit
that orphaned it.

**Every touch of `localStorage` is inside `try/catch`.** It throws outright
in some private-browsing modes, and the site is meant to work with it absent.

**Two files are held to something stricter than the validator.**
`assets/qr.js` is fingerprinted by `node tools/qrperf.mjs --check`, which CI
runs: nine payloads, each with the expected version and a SHA-256 of the
matrix, so a change to what it draws is a bug however much faster it is. A
deliberate change means `--record`, pasting the new fixtures in, and scanning
one of the codes with a real camera before it lands. And the story clock in
`assets/app.js` — `STORY_HOURS` at line 5059, `tallinnOffset`, `tallinnTime`,
`storyStart`/`storyEnd` — is a copy of `tools/clock.mjs`, because the
browser cannot import from `tools/`; change one, change the other.

## What the validator holds a page change to

`tools/validate.mjs`, and CI runs exactly it plus `qrperf --check`:

- **Parity in `ui.json`**: a key that is a non-empty string in some
  languages and not all fails; every language needs `langName`.
- **Keys the markup asks for**: every `data-i18n*="…"` in every `*.html` in
  the repo root, `admin.html` included, must exist in some language.
- **Keys the scripts ask for**: every `t('key')` in every `assets/*.js`,
  after stripping `=== '…'` comparisons, must exist; only literals shaped
  `^[a-z][A-Za-z0-9]*$` count, so a fallback string is ignored and a key
  passed through a variable is not seen.
- **Colour tokens**: every `[data-style="…"]` block must declare the union of
  the tokens any block declares. `:root` is not compared.
- **Labels**: every taxonomy type and every cuisine needs a label in every
  language; a blurb missing a language only warns.
- **Stamps**: every `src`/`href` to `assets/*.js|css` in `index.html`,
  `lists.html`, `google.html`, `deal.html`, `verify.html` and `staff.html`
  must carry `?v=` equal to the first eight hex of the file's SHA-256.
  `admin.html` is deliberately unstamped; it is served `no-store`.

## The steps

1. Make the change, in the dialect above, with the README section open.
2. `node tools/stamp.mjs`. It rewrites only the pages whose stamps changed,
   and CI refuses a stale one. Never type a hash by hand.
3. `node tools/validate.mjs`.
4. **Drive it in a browser.** There is no test suite and no Playwright
   harness in the repo; reading the diff is not the same as watching it.
   `python3 -m http.server 8000` over the repo root is enough for the map,
   because `fetch()` refuses `file://` and the page comes up empty. For a
   page that needs a live-looking API, Playwright with `/api/*` stubbed —
   Chromium is at `/opt/pw-browsers/chromium` in this environment — or
   `npx wrangler pages dev .` for the real bindings against the preview
   database. Look at both styles, and at a 390 px width, which is the phone
   the README measures its layouts against.
5. **Rewrite the README paragraph** the change made wrong, and the comment
   above the function. A paragraph that now describes the version that lost
   the argument is a bug.
6. The pass in `leave-it-better.md`, over every file in the diff, whole.

## Adding a language

What the code actually reads per language, in the order the validator will
complain about them:

1. `data/ui.json`: a top-level block with every key the others have, plus
   `langName`, `styleRed`, `styleGreen`, `months` (twelve names joined by `|`,
   or `formatMonth()` falls back to `Intl`, which draws April as `M04` in
   Chromium for some locales) and `monthYear`.
2. `data/taxonomy.json`: a label on every type. Fails without.
3. `data/cuisines.json`: a label on every cuisine. Fails without.
4. `data/restaurants.json`: `blurb` on every place. Warns without, so you can
   ship as you translate.
5. `data/schema.json`: the code in `$defs.translated`, the one literal list;
   the validator does not check it, your editor will.
6. `data/radio.json` `byLanguage`, optionally; `stationFor()` falls back to
   `default`, and `et` has no entry today.

The switcher and the validator read the language list out of `ui.json`, and
the switcher sorts by the two-letter code, so nothing else changes. Estonian
is `et`, not `ee`, and the README says why.

## The commit

The subject is what a visitor can now do, or what they no longer see:

> Your saved places live under your name, not among the food
> Surprise me answers with the map still under it
> The keyboard waits until the field is tapped

The body says what was wrong, what it is now, which README section moved with
it, and what was driven in a browser to check it.

## The pull request

1. `git fetch origin claude/tallinn-tastebuds-map-nzoqx0 && git rebase origin/claude/tallinn-tastebuds-map-nzoqx0`.
   When `index.html` or `lists.html` conflicts on a `?v=` line, take the
   structure from both sides, `node tools/stamp.mjs`, `git add`,
   `git rebase --continue`; never type a hash.
2. `node tools/stamp.mjs`, then `node tools/validate.mjs`, then
   `node tools/qrperf.mjs --check` if `assets/qr.js` moved.
3. The page in a browser, both styles, 390 px, and the README paragraph
   rewritten. The `leave-it-better.md` pass over every file in the diff.
4. Commits that stand alone, subjects about what a visitor can now do.
5. `git push -u origin <branch>`, or `--force-with-lease` after a rebase.
6. Open the PR against the default branch. The body says what was wrong,
   what it is now, the trade-off, which README section moved, and exactly
   what was driven in a browser and how. Open the preview URL the Cloudflare
   workflow posts and look at it on a phone.
7. CI green, then **Rebase and merge**, and delete the branch. The stamps
   mean every visitor gets the new files on their next load, no cache to
   wait out.

## Where it goes wrong

- The stamps: not run, or hand-merged after a rebase. `index.html` and
  `lists.html` conflict on the `?v=` lines whenever two branches touch
  `assets/`. Take the structure from both sides, run the stamper, let it
  write the hashes.
- A data shape shipped without the script that reads it: half-step prices
  landed with the script on one deploy, and every phone holding the old
  script threw `RangeError: Invalid array length` over a map that had
  already drawn. That is the incident the stamps exist for.
- A string added in one language, with a fallback in the code.
- A new page that renders light for somebody who chose the dark style,
  because the boot block was not copied.
- A `t()` key that the scanner cannot see, so the validator passes and a
  visitor reads the key off the page.
