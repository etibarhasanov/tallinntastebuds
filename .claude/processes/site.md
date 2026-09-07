# Change a page

Anything a visitor sees or presses: the scripts and stylesheets in `assets/`,
the HTML pages, `data/ui.json`, the taxonomy's labels, a language. This is the
process with the most rules because it is the one where a mistake reaches
every phone that opens the map, and where a browser holding yesterday's script
against today's data has already taken the site down once.

Read `leave-it-better.md` as well. It is the main rule and it applies to
every line you touch here.

## Read first

- The README section for the feature you are standing in. Every one of them
  has one — **Saves**, **Lists**, **Stories**, **The directory**, **The
  radio**, **Surprise me**, **Languages**, **The two styles** — and the
  section carries the reasoning the code only hints at.
- `README.md` → **The design rules**: twelve rules a new sheet, page or button
  is held to, so building one is a decision about words rather than pixels.
  Two of them the validator enforces; the other ten are read by a person, and
  that person is you.
- The header block of the file you are about to change. `assets/lists.js` and
  `assets/app.js` are over the ~600-line mark, so the reach is the functions
  you touch plus what they call and what calls them — say which ones you read.

## How the browser code is written

**ES5, and nothing else.** `var`, `function`, no arrow functions, no `const`
or `let`, no template literals, no spread — grep the files, there are zero.
Each is wrapped in an IIFE with `'use strict'`. It is served raw to whatever
browser opens it, so it is written for the browser as it is, not for a
transpiler. A patch in the other dialect is the fastest way to look foreign.

**Nothing names a colour.** `assets/styles.css` defines tokens — `--ink`,
`--muted`, `--paper`, `--wash`, `--hairline`, `--accent`, `--accent-lit` — and
the two styles restate every one of them: `[data-style="red"]` (light, brick)
and `[data-style="green"]` (dark, forest). A component that hardcodes a hex is
the one thing that fails to change when somebody presses a swatch. There is no
`prefers-color-scheme` switch; the style is a choice, stored in `localStorage`
under `ttb.style`. A token one style declares and the other leaves out fails
validation.

**Secondary pages apply the style themselves.** `assets/app.js` owns the
swatches on the map; `lists.js` and `pass.js` read `ttb.style` (and `ttb.lang`)
out of `localStorage` on boot and set `data-style` on `<html>` — plus
`colorScheme` and the `theme-color` meta. A new page that skips this silently
renders in the light palette whatever the visitor chose. Both keys also accept
a `?style=` / `?lang=` override, so a shared link can carry them.

**Every UI string lives in `data/ui.json`, in all ten languages** (az, hy, en,
et, fi, pt, ru, es, tr, uk). A key present in one and missing in another fails
validation; so does a `data-i18n` key in the markup or a `t('key')` in a
script that is in no language at all. Never print a raw key or an English
fallback to a visitor. A key nothing prints any more goes, in all ten, in the
commit that orphaned it.

**Every touch of `localStorage` is in a `try/catch`.** It throws outright in
some private-browsing modes, and the site is meant to work with it absent.

**Two files are held to something stricter than the validator.**
`assets/qr.js` is fingerprinted by `node tools/qrperf.mjs --check`: a change
to the matrix it draws is a bug however much faster it is, and a deliberate
change means `--record` and scanning one of the codes with a real camera
before it lands. And the story-clock arithmetic in `assets/app.js` is a copy
of `tools/clock.mjs`, because the browser cannot import from `tools/`; change
one, change the other.

## The steps

1. Make the change, in the dialect above, with the README section open.
2. `node tools/stamp.mjs`. The `?v=` hash on every asset URL in every HTML
   page is what stops a browser answering for a changed file out of its own
   cache, and CI refuses a stale one. Never type a hash by hand.
3. `node tools/validate.mjs`.
4. **Drive it in a browser.** There is no test suite, and reading the diff is
   not the same as watching it. A static server over the repo root is enough
   for the map — `python3 -m http.server 8000`, then `localhost:8000`, because
   `fetch()` refuses `file://` and the map comes up empty. For a page that
   needs a live-looking API, Playwright with a stubbed `/api/*` route is
   enough; Chromium is installed at `/opt/pw-browsers/chromium`. Look at both
   styles and at a 390px width, which is the phone the README measures its
   layouts against. A change that reaches the Functions for real is `api.md`'s
   business and runs under `wrangler pages dev`.
5. **Rewrite the README paragraph** the change made wrong, and the comment
   above the function. A paragraph that now describes the version that lost
   the argument is a bug.
6. The pass in `leave-it-better.md`, over every file in the diff, as a whole.

## Adding a language

`README.md` → **Adding a language** is the checklist: a block in `ui.json`
with every string id and a `langName`, `months` and `monthYear`, the label on
every type in `taxonomy.json` and every cuisine in `cuisines.json`, the blurb
on every place, and the code in `translated` in `data/schema.json`, which is
the one literal list that has to be told. The switcher and the validator read
the language list out of `ui.json`, so nothing else changes. Estonian is
`et`, not `ee`, and the README says why.

## The commit

The subject is what a visitor can now do, or what they no longer see:

> Your saved places live under your name, not among the food
> Surprise me answers with the map still under it
> The keyboard waits until the field is tapped

The body says what was wrong, what it is now, which README section moved with
it, and what was driven in a browser to check it.

## Where it goes wrong

- The stamps: not run, or hand-merged after a rebase. `index.html` and
  `lists.html` conflict on the `?v=` lines whenever two branches touch
  `assets/`. Take the structure from both sides, run the stamper, let it write
  the hashes.
- A string added in English, in one language, with a fallback in the code.
- A new page that renders light for somebody who chose the dark style.
- A change to the map's data shape shipped without the script that reads it,
  so a browser holding the old script threw on the new data. That is the
  incident the stamps exist for; it is in `tools/stamp.mjs`'s header.
