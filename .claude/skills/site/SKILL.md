---
name: site
description: Change what a page does or looks like: anything in assets/, an HTML file, data/ui.json, a style, a post on the blog, or adding a language.
---

# Change a page

Anything a visitor sees or presses: the scripts and stylesheets in `assets/`,
the HTML pages, `data/ui.json`, the labels in the taxonomy and the cuisines, a
post in `data/blog.json` and the clip on it, a language. It is the process with the most rules
because a mistake here reaches every phone that opens the map, and a browser
holding yesterday's script against today's data has already taken the site
down once — that story is in the header of `tools/stamp.mjs`.

`.claude/rules/leave-it-better.md` loads itself the moment you open a file
here. It is the main rule and it applies to every line you touch.

## Read first

- The README section for the feature you are standing in. Every one has one —
  **Saves**, **Accounts**, **The account page**, **Lists**, **Public lists**,
  **Profiles**, **Stories**, **The blog**, **The directory**, **Statistics**,
  **Ask for somewhere**, **Restaurant discounts**, **The radio**, **Surprise
  me**, **Languages**, **The mark**, **The pins**, **The four styles** — and it
  carries the reasoning the code only hints at.
  `grep -n '^## ' README.md` is the table of contents with line numbers;
  read the section, not the file.
- `README.md` → **The design rules**: twelve rules a new sheet, page or
  button is held to. Two of them the validator enforces; the other ten are
  read by a person, and that person is you.
- The header block of the file you are about to change. `assets/app.js`,
  `assets/lists.js`, `assets/venues.js`, `assets/account.js` and both big
  stylesheets are over the ~600-line mark (`wc -l assets/*` is the current
  answer), so the reach there is the functions you touch plus what they call
  and what calls them. Say which ones you read. Line numbers written into
  this file rot within a week; find things by name — `grep -n 'function
  applyStyle' assets/*.js` — never by the number a document remembers.

## Is it new?

If a visitor could not see or press this thing yesterday and could tomorrow,
it does not get built from the prompt. It gets described first, the owner
answers, and the code comes after —
**Something new is described before it is built** in `CLAUDE.md` is the rule
and this is the page-shaped half of it. A new page, panel, sheet, button,
field or filter chip is this. Restyling, rewording or fixing one that is
already there is not, and neither is a place, a story, a discount or a blog
post.

What the description has to settle before a stylesheet is worth opening:

- **Which page it lives on**, and whether it is a new one. A new page joins
  `PAGES` at the top of `tools/stamp.mjs` or it never gets stamped, needs its
  own README section, and is the case that most wants a mockup.
- **Every state**, drawn in words: empty, loading, error, signed out, and the
  place with no photo. A panel described only in its happy state is a panel
  that gets built only in its happy state.
- **The copy**, in English, and the note that every string needs all ten
  languages in `data/ui.json` before the validator will pass it. Translating
  the wrong wording ten times is the expensive way to find out it was wrong.
- **What it does at 390 px**, which is the phone the README measures its
  layouts against, and which of **The four styles** it has to work in. All,
  always — but say what changes between them.
- **What it deliberately does not do yet.**

Hold the description to **The design rules** in `README.md` — the twelve are
cheaper to fail in a paragraph than in `assets/`. Then post it and stop.
Scaffolding written while the answer is outstanding is scaffolding somebody
has to argue with later.

## How the browser code is written

**ES5, and nothing else.** `var`, `function`, no arrow functions, no `const`
or `let`, no template literals — `grep -nE '\bconst |\blet |=>' assets/*.js`
hits only prose in comments. Every file is one IIFE with `'use strict'`. It
is served raw to whatever browser opens it, written for the browser as it is,
not for a transpiler. A patch in the other dialect is the fastest way to look
foreign.

**Nothing names a colour**, and a pin's tone is a name for the same reason.
The tokens are the first block of `assets/styles.css` — `:root` holds Red's palette so a cold load never
flashes a third one — and `[data-style="red"]` and `[data-style="green"]`
each restate every one of them. A component that hardcodes a hex is the one
thing that fails to change when somebody presses a swatch. There is no
`prefers-color-scheme` switch; the style is a choice, kept in `localStorage`
under `ttb.style`.

**Every page applies the style and the language itself, on boot, first.**
`applyStyle()` in `assets/lists.js` is the fullest copy: `?style=`, else
`ttb.style`, else `red`; set `data-style` on `<html>`; set `colorScheme` to
`dark` for green, or a native control is "a white box on a dark card"; write
the computed `--wash` into `<meta name="theme-color">`. Then
`pickLanguage()` — `?lang=`, else `ttb.lang`, else the browser's languages,
else `en` — and `applyStaticStrings()` over the `data-i18n`,
`data-i18n-aria-label`, `data-i18n-placeholder` and `data-i18n-title`
attributes. `app.js`, `lists.js`, `venues.js` and `account.js` each carry
that block; `pass.js` carries it without the `theme-color` line, so the
three pass pages keep light browser chrome under the dark style.
`flashcard.js` carries the style half and a language half of its own shape: it
does not fetch `data/ui.json` at all, but sends its candidates to
`/api/flashcard` and prints from the one block that comes back — **One request
on the way in** under **Flashcards** in `README.md` says why; the other
pages shed the same weight the other way, one language to a file. It is
also the one page besides the map with a **language switch** on it, because on
its own subdomain `ttb.lang` belongs to another origin: it is drawn from the
`langs` that same answer carries, and picking one asks the route again for the
one block rather than reloading — **A language of your own to learn it in**
under **Flashcards**. That switch has **three** rows and not ten: the
flashcards are the one page on the site that speaks fewer languages than the
site does, because the back of a card is written in three — `DECK_LANGS` in
`functions/api/_lib.js` is the list, it narrows the switch and the language
the page is read in together, and **Three languages, not ten** under
**Flashcards** is the argument. A new page
copies the block whole, and its head carries `<meta name="color-scheme">`
and `<meta name="theme-color">` like `lists.html`'s.

**Three things pages used to copy are globals now.** `assets/device.js`
is `TTBDevice.id()` — the v4 UUID under `ttb.cid`, minted on the first ask —
and `TTBDevice.known()`, the same id read without minting one; the map and the
feedback page load it before their own script, and a page that files
something under a device does the same rather than growing a third
`clientId()`. `assets/language.js` is `TTBLanguage.mount(node, langs, current,
onPick, label)`, the switch the flashcards and the chess page draw on a
`.lists-brand` header, its surface `.lang-surface` in `assets/lists.css`;
picking stays the page's own. The map's switch in `assets/app.js` is not on
it and is not to be moved without a change of its own. `assets/country.js` is
`TTBCountry.name(code, lang, unknown)`, a country's name in the reading
language out of `Intl.DisplayNames`, and `TTBCountry.line(rows, lang, words)`,
the *Estonia 7 · Finland 2 · Other 1* line under a list; `/insights`,
`/admin/stats` and `/admin/visitors` load it before their own script, and a
page that names a country does the same rather than growing a copy.

**Every UI string lives in `data/ui.json`, in all ten languages** — az, hy,
en, et, fi, pt, ru, es, tr, uk. Never print a raw key or an English fallback
to a visitor. A key nothing prints any more goes, in all ten, in the commit
that orphaned it.

**The map does not read that file.** It reads `data/lang/<code>.json` — one
language's block of `ui.json` and every place's write-up in that language —
and `data/map.json`, the places without their write-ups, all written by
`node tools/languages.mjs`. So every edit to `ui.json` or
`data/restaurants.json` is followed by that tool, and the validator fails the
build until it has been. `t()` in `assets/app.js` holds one language and
falls back to nothing but the key, which is safe only because the validator
holds every language to the same set of keys. A language switch on the map
is a request, and `setLanguage()` keeps the old language on screen until the
new file has arrived. **One language at a time** under **Languages** in
`README.md`. Every other page reads the same files for its strings — the
pass pages through `TTBPass.load()` in `assets/pass.js`, the rest through a
`loadWords()` of their own — each picking the language with its own
`pickLanguage()` out of `data/lang/index.json` and then fetching that one.
**No page fetches `ui.json` whole any more**, and a new page copies
`loadWords()` rather than reaching for the file: it is 220 KB on the wire
against the 25 to 30 of one language. Two things to know when copying it:
`t()` holds one pack and falls back to nothing but the key, and a page that
needs the list of languages — the editor does, for the line on a profile —
takes it off the `names` the same call returns, not off the pack's keys.

One exception, and it is a deliberate one: the splitwise page's strings are in
`data/split.json`, same shape and same ten languages, so that removing that
feature is removing files — see **Taking it out** under **Splitwise** in
`README.md`. The validator holds it to everything `ui.json` is held to, plus
the same ten languages and no key in both files. Nothing else may do this; a
second exception is two files to keep in step.

**That rule has been tested once and held.** The flashcards page arrived on a
subdomain of its own, built to be removable the way splitwise is, and wanted a
file of its own by exactly the same argument. It did not get one: its
hundred and one `flash*` keys are in `data/ui.json` with everything else, and taking
the feature out means `grep -n '"flash' data/ui.json` and a hundred and one deletions
from ten blocks. What it *does* keep to itself is `data/decks.json` — the words
on the cards, the nine grammar lessons and the songs, which are content rather
than interface and are written in three languages rather than the site's ten. A
card's `back`, a deck's `name` and its `why`, every paragraph, heading and
gloss of a lesson, and every line and word of a song are each an object keyed by language, English required and
Azerbaijani and Russian written; `means()` in `assets/flashcard.js` picks the
one the page is being read in and falls back to the English. A key there is not
a `ui.json` key and the parity rule does not reach it. See **Flashcards** in
`README.md`.

**Every touch of `localStorage` is inside `try/catch`.** It throws outright
in some private-browsing modes, and the site is meant to work with it absent.

**A change to the counting itself is the `/stats` process** — `assets/track.js`,
the owner's five pages under `admin/` and their scripts — and that skill
holds the invariants a count keeps and how one is driven and read back. The
two paragraphs below are the part of it every page shares.

**A press on a place or a chip is also counted on this site.** `/admin/stats` ranks
what gets opened, out of `press_counts`, and two call sites feed it:
`selectPlace()` and `applyFilters()` in `assets/app.js`, each once per thing
per page load — and the rail every press, through `countRailPress()` and the
rows of the More sheet in `renderMore()`, which count as the pills they stand
for. `select()` in `assets/venues.js` posts too, as a `venue` that is counted
nowhere, because only the owner can open the directory. A new way for a
visitor to open a place is a third, and it belongs there in the same commit — see
**Statistics** in `README.md`, which is also where the reasoning for what is
deliberately *not* counted lives.

**Every button reports.** A press that matters is reported — to the
site's own count and to Clarity — through the global `assets/track.js` sets,
on every page:
`TTBTrack.event(name, params)` in a handler, `TTBTrack.click(node, name,
params)` around a link or button built inline, and `data-track="name"` on
one written straight into the markup. The name says what the person meant
(`list_keep`, `place_close`), the parameters are what the handler already
holds, and the event gets a row in the table under **Analytics** in
`README.md` in the same commit — that table is the list, and a name that is
not in it is a name nobody will find in the console. `grep -n TTBTrack
assets/<file>.js` shows what the page beside yours reports, and the same
press on two pages reports the same name. The name also lands in
`/admin/visitors` under **What was pressed**, because `track.js` tallies every
event it sends and reports the tally with the time on screen — so a name is a
lowercase word with underscores, which is the shape `functions/api/_visitors.js`
accepts, and a new page that loads `track.js` is counted there with nothing
more to do, once its path is named in `PAGES` in that file. Name it in the
same commit: an address `PAGES` does not claim is counted as not found, and
`node tools/validate.mjs` fails a page that loads `track.js` without it. The site's count keeps a press's name and never
its parameters, so a page that shows one of the owner's things — a story, a
post, a deck, a discount — also says which through `TTBTrack.about(what,
id)`, once a load, and `ABOUT` in `functions/api/_visitors.js` holds the id
to the file it ships in: **What was opened** under **Visitors** in
`README.md`.

**And every page a visitor walks back from carries `assets/back.js`**, after
`track.js` and before the page's own script: a swipe to the right from
anywhere on the screen is Back. It reads `touch-action: none` and `pan-x`,
and the `is-lifted`, `is-carrying` and `is-dragging` classes, to know where
a sideways finger already means something — so a new thing that takes one
says so in CSS the way the chips and the grips do, and needs nothing here.
The map hears it only on the panel with a place open. **A swipe to the right
is Back** in `README.md`.

**And every page is watched, once somebody agrees to it.** That is the other
half of analytics and it costs nothing per press: Microsoft Clarity records the
page itself — heatmaps, and a replay of the DOM as it changed. Nothing calls
into it, so a new button needs nothing here. Two things do:

- **A new page carries `assets/analytics.js`**, in its head, deferred, before
  every other script on the page. That one file is the whole of analytics: Clarity's
  snippet and the consentv2 signal it needs. Copy the tag from the page
  whose asset spelling yours shares — `lists.html` writes `/assets/...` from
  the root, `index.html` writes `assets/...` relative, and the head of
  `tools/stamp.mjs` says why they disagree. A page that ships without it is
  invisible to Clarity, and fails nothing while nobody notices.
  `admin.html` is the one page that deliberately does without; the head of
  `analytics.js` says why, and it is not an oversight to correct.
- **Anything a replay should not hold gets `data-clarity-mask="true"`.**
  Clarity masks every input box and dropdown in all three of its masking
  modes and that one cannot be switched off, so a password or a typed-in
  name needs nothing from you. Rendered text is the case to think about: the
  pass card on `deal.html`, `verify.html` and `staff.html` carries the
  attribute, so the hourly code and its QR stay out of a replay. Masking is
  inherited, so it goes on the container and never on each child.

The masking **mode** is a dashboard setting rather than a line of code, so it
is not in this repo and will never be in a diff: **Settings → Masking** at
clarity.microsoft.com, Balanced by default, which masks numbers and email
addresses on top of the input boxes. A change that leans on it says so in the
PR, because nobody reviewing the diff can see it.

**Nothing asks first.** Clarity loads on sight, and the banner that stood in
front of it for a day was taken out on purpose — **No consent banner** in
`README.md` is the reasoning, and it is not an oversight to correct. Driving
any page in a browser therefore records into the live Clarity project, including a preview; there is no longer a button to press to
stay out of the numbers.

**A clip on a blog post is a scene, and a scene is a function of time.**
`clips/scenes/<post-id>.html` is the site's own components arranged into one
interaction, and `at(t)` puts them where they are at millisecond `t` —
nothing in a scene may animate itself, because `tools/blogclips.mjs` draws it
one frame at a time and compares each frame to the last. A CSS animation left
running, or anything standing still inside an `opacity`, a `filter` or a
`backdrop-filter`, makes every frame count as changed and the clip comes out
ten times heavier. `clips/README.md` is the whole of how to write one, and the
four files a scene draws into are generated: run
`node tools/blogclips.mjs --only <post-id>` and commit the result, the same
way the stamps are committed.

**Two files are held to something stricter than the validator.**
`assets/qr.js` is fingerprinted by `node tools/qrperf.mjs --check`, which CI
runs: nine payloads, each with the expected version and a SHA-256 of the
matrix, so a change to what it draws is a bug however much faster it is. A
deliberate change means `--record`, pasting the new fixtures in, and scanning
one of the codes with a real camera before it lands. And the story clock in
`assets/app.js` — `STORY_HOURS`, `tallinnOffset`, `tallinnTime`,
`storyStart`/`storyEnd` — is a copy of `tools/clock.mjs`, because the
browser cannot import from `tools/`; change one, change the other.

## What the validator holds a page change to

`tools/validate.mjs`, and CI runs exactly it plus `functions-check.mjs`,
`qrperf --check`, `chessperf --check` and the write gate's `--check`:

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
- **The pins**: `assets/pins.js` and `functions/api/_pins.js` hold the same
  forty marker ids, written out twice because neither dialect can import the
  other, and the build fails when they drift. Every tone a kind of place is
  filed under needs a `--pin-<tone>` token and a `.pin-tone-<tone>` rule;
  every marker needs a `pinX` label in all ten languages, which the scanner
  for `t()` calls cannot see because the picker builds those keys out of the
  ids. `mark` in either table fails outright, and so does a kind of place a
  list could pick — the mouth goes on a place I have eaten at, and what a
  Google row IS is not somebody's to choose. **The pins** in `README.md`.
- **The six Google lists' words**: `assets/googlewords.js` translates the
  titles, intros and per-place lines `db/google-lists.sql` stores in English.
  Every list id in `tools/googlelists.mjs` needs a title key there and in
  `data/ui.json`, and every Google category the lists carry needs a
  `gcat<Category>` key in all ten languages — built out of the category, so
  the scanner for `t()` calls cannot see them. The script is loaded by
  `index.html`, `lists.html` and `account.html`, before their own. **In ten
  languages, in the browser** under **The six lists Google wrote** in
  `README.md`.
- **The links a profile carries**: `assets/links.js` and `functions/api/_profile.js`
  hold the same three networks, written out twice for the same reason the
  pins are, and the build fails when their ids, the addresses they build or
  the handle lengths they cap drift. **Where else you are** under
  **Profiles** in `README.md`. The page of links under them is the other
  way round on purpose — addresses, not handles — and `assets/rows.js` is
  the one place that turns one into a player: **Your page** under
  **Profiles**.
- **Labels**: every taxonomy type and every cuisine needs a label in every
  language; a blurb missing a language only warns. The **English** label of a
  type is the chip's name on every rail; the other nine sit beside it.
- **Stamps**: every `src`/`href` to `assets/*.js|css` in the twenty-one pages
  named in `PAGES` at the top of `tools/stamp.mjs` — `index.html`,
  `lists.html`, `account.html`, `blog.html`, `feedback.html`,
  `deal.html`, `verify.html`, `staff.html`, `split.html`,
  `flashcard.html`, `edit.html`, `write.html`, `insights.html`, `chess.html`, `404.html`, `privacy.html`, and the owner's five under
  `admin/` — `admin/google.html`, `admin/stats.html`, `admin/visitors.html`, `admin/found.html`, `admin/flows.html` — must carry `?v=` equal to the first
  eight hex of the file's SHA-256. A new page that loads anything out of
  `assets/` is added to that list, or it never gets stamped. `admin.html` is
  deliberately unstamped; it is served `no-store`.

## The steps

If the change is something new, **Is it new?** above comes first and there is
no step 1 until the owner has answered it.

1. Make the change, in the dialect above, with the README section open.
2. `node tools/stamp.mjs`. It rewrites only the pages whose stamps changed,
   and CI refuses a stale one. Never type a hash by hand.
3. `node tools/ogcard.mjs`, **if the change moved a colour token or anything
   in `assets/flashcard.css`**, and commit the redrawn
   `assets/logo/og-flashcard.png`. That card is the flashcards' share picture
   and it is drawn from those two stylesheets — `assets/logo/og-flashcard.html`
   links them and wears the page's own class names — so a token that moved
   leaves a picture of last month's site on every link anybody sends. It needs
   a Chromium, it takes a second, and nothing in CI can see that it went
   stale. **When somebody sends the link** under **Flashcards** in `README.md`.
4. `node tools/languages.mjs`, if `data/ui.json` moved, then
   `node tools/validate.mjs`.
5. **Drive it in a browser.** There is no test suite and no Playwright
   harness in the repo; reading the diff is not the same as watching it.
   `python3 -m http.server 8000` over the repo root is enough for the map,
   because `fetch()` refuses `file://` and the page comes up empty. For a
   page that needs a live-looking API, Playwright with `/api/*` stubbed —
   Chromium is at `/opt/pw-browsers/chromium` in this environment — or
   `npx wrangler pages dev .` for the real bindings against the preview
   database. The chat (`assets/ask.js` and the panel in `app.js`) only
   answers with the model under `pages dev`, and each question spends from
   the daily Workers AI allowance the live site shares — a few questions,
   not an afternoon. Look at a light and a dark style, and at a 390 px width, which is
   the phone the README measures its layouts against.
6. **Rewrite the README paragraph** the change made wrong, and the comment
   above the function. A paragraph that now describes the version that lost
   the argument is a bug. And if the change gives somebody a thing to do
   they could not do before — or takes one away, or moves where it lives —
   their diagram in `data/flows.json` moves with it, then
   `node tools/flows.mjs`. A new step the site can see somebody take says
   what it is counted by in `when` — the event name the press reports, a
   `page:` or a `view:` — or `/admin/flows` draws it with no number; a
   press renamed is a `when` renamed, and the validator holds the two to
   the README's **Analytics** table. **Who uses the site, drawn** in
   `README.md`.
7. The pass in `leave-it-better.md`, over every file in the diff, whole.

## Adding a language

What the code actually reads per language, in the order the validator will
complain about them:

1. `data/ui.json`: a top-level block with every key the others have, plus
   `langName`, `styleRed`, `styleGreen`, `months` (twelve names joined by `|`,
   or `formatMonth()` falls back to `Intl`, which draws April as `M04` in
   Chromium for some locales), `monthYear`, and the chat's synonym lists
   `askWordsCheap`, `askWordsFancy`, `askWordsOpen`, `askWordsNear` and
   `askWordsMe`, joined by `|` the same way — that is how *cheap* and *near
   me* in the new language reach the model's brief without a word of code.
   `documentTitle` and `metaDescription` are the two a search engine reads:
   `functions/index.js` writes them into the head at that language's
   address, so both are written for a search result — the question people
   type first, then the kinds of place, then the site's name — rather than
   for the page. **The words** under **Getting found** in `README.md` says
   which words, and why "best" is not among them.
2. `data/taxonomy.json`: a label on every type. Fails without.
3. `data/cuisines.json`: a label on every cuisine. Fails without.
4. `data/restaurants.json`: `blurb` on every place. Warns without, so you can
   ship as you translate.
5. `data/schema.json`: the code in `$defs.translated`, the one literal list;
   the validator does not check it, your editor will.
6. `data/radio.json` `byLanguage`, optionally; `stationFor()` falls back to
   `default`, and `et` has no entry today.
7. `data/blog.json`, optionally and rarely. A post is somebody's writing
   rather than an interface string: a new language is owed none of them, and
   a post it does not have falls back to English with a line in the new
   language saying so. See **The blog** in `README.md`.
8. `node tools/languages.mjs`, and commit `data/lang/`: the map reads the
   new language out of a file of its own there, and lists it in the switch
   out of `data/lang/index.json`.
9. `node tools/sitemap.mjs`, and commit `sitemap.xml`. The language is a new
   address for the map — `/?lang=<code>` — and every other language's entry
   links to it; the validator fails on a sitemap that was not re-run.

The switcher, `functions/index.js`, the sitemap tool and the validator all
read the language list out of `ui.json`, and the switcher sorts by the
two-letter code, so nothing else changes. Estonian is `et`, not `ee`, and the
README says why.

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
3. The page in a browser, a light and a dark style, 390 px, and the README paragraph
   rewritten. The `leave-it-better.md` pass over every file in the diff.
4. Commits that stand alone, subjects about what a visitor can now do.
5. `git push -u origin <branch>`, or `--force-with-lease` after a rebase.
6. Open the PR against the default branch. The body says what was wrong,
   what it is now, the trade-off, which README section moved, and exactly
   what was driven in a browser and how — and that account matters more than
   it used to, because the push deploys no preview and there is no URL for a
   reviewer to open instead. `npx wrangler pages dev .` is where a visible
   change gets driven, on the same bindings against the same database.
   `CLAUDE.md` says why previews are off and what to do on the rare change
   that truly needs one.
7. CI green, then **Rebase and merge**; the branch stays, `CLAUDE.md` says
   why. The stamps mean every visitor gets the new files on their next
   load, no cache to wait out.

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
- A new page shipped without `assets/analytics.js` in its head, so nothing it
  does reaches Clarity. It fails nothing and nobody notices for months; that
  is how `blog.html` arrived carrying a script tag for a file that no longer
  existed — the validator caught that one, because it checks every `assets/`
  reference against the repo.
- A rewritten card that loses its `data-clarity-mask`, putting whatever it
  draws back into the replays. The comment above the `<section>` on each pass
  page is there to be read before the line under it is replaced.
- A `t()` key that the scanner cannot see, so the validator passes and a
  visitor reads the key off the page.
- **A third-party player that behaves differently on a phone, debugged from
  the code.** The Instagram reel is the worked example, and the lesson is not
  the one it looked like for five weeks.

  A reel plays in the panel on a desktop and does not play on a phone: there
  Instagram serves a card offering **View profile** and **View on Instagram**
  instead of a player. Because the code was the only thing visible from here,
  four arrangements were tried — `embed.js`, a plain iframe keeping the kind
  the permalink was written with, the same iframe with every link forced to
  `/p/`, and the same iframe with the query `embed.js` sends. Three of them
  shipped in one afternoon. All four behave identically. The address was never
  what decided it: Instagram's embed needs its own cookies to hand over an
  inline player and iOS blocks them for a frame on somebody else's site, so
  what reaches the phone is a card no URL of ours can change.

  What to take from it:

  - **Ask which device before touching the code.** "It is broken" and "it is
    broken on my phone but not my laptop" are different bugs, and the second
    one is usually not in the repository. One question would have saved three
    deploys.
  - **"It renders" is not evidence that it plays.** The broken state was a
    cover frame with a play triangle on it — a picture of a working player —
    and it sat there for five weeks looking fine.
  - **One broken place is a data problem.** A single permalink that will not
    frame gets rewritten in `data/restaurants.json`; rewriting everybody's URL
    in the code to suit the exception is what took thirty-three working reels
    down.
  - **Nothing here can check any of it.** The validator sees that our links are
    well formed, never what the other end serves, and no session working here
    has ever had a network route to `instagram.com`. So say in the PR that it
    could not be driven, say exactly what somebody has to press and on what, and
    ask — rather than writing the reasoning up as though it were a result.
- **A `.lists-seg` whose `is-on` class does not move.** The radio inside
  `.lists-seg-opt` is one transparent pixel — deliberately, so the keyboard
  and the screen reader get a real radio — which means the browser checking it
  changes nothing anybody can see. `is-on` is the filled half and the handler
  has to move it: `opts[i].classList.toggle('is-on', opts[i] === label)` over
  the group, the way the list's visibility segment and the feedback composer's
  **Post as** both do. Without it the control looks dead. The choice really
  does change and the write really does go out under it, so nothing fails and
  nothing is logged; the only clue on screen is the focus ring landing on a
  pill that stays empty. It shipped that way once.
- **One place, two ids.** A list row stores the id it was added under, and
  for the six lists Google wrote that is Google's key even when the place is
  on the map; `mapId` on the row is the map's own id for it. Everything on
  the map — `byId()`, `isOnList()`, `listSay()`, the order, `?at=` — reads
  one id, so a row has to be moved under the map's id once, in `seatList()`,
  before any of them see it. Checked by `byId(item.place)` alone, seven of
  Google's ten bakeries drew as Google's card over places with a reel and
  photographs, and nothing failed: a stand-in is a valid row.
