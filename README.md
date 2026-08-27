# Tallinn Tastebuds — the map

A full-screen map of the places in Tallinn I have eaten at and approved for
[@tallinntastebuds](https://www.instagram.com/tallinntastebuds/). Tap a pin,
read the write-up, watch the reel.

There are no scores, stars or rankings anywhere, and there never will be.
Being on the map is the verdict.

Static files only — no backend, no database, no build step, no npm install, no
API keys. Adding a place means editing one JSON file and pushing.

---

## Contents

- [Run it locally](#run-it-locally)
- [Add a place](#add-a-place)
- [Get the coordinates](#get-the-coordinates)
- [Copy a video permalink](#copy-a-video-permalink)
- [Add photos](#add-photos)
- [The Just added section](#the-just-added-section)
- [Searching the list](#searching-the-list)
- [Close a place instead of deleting it](#close-a-place-instead-of-deleting-it)
- [Languages](#languages)
- [Deploy to Cloudflare Pages](#deploy-to-cloudflare-pages)
- [What the validator checks](#what-the-validator-checks)
- [Files](#files)
- [Third-party pieces and their licences](#third-party-pieces-and-their-licences)
- [Design notes](#design-notes)

---

## Run it locally

The page loads its data with `fetch()`, and browsers refuse `fetch()` over
`file://`. **Opening `index.html` by double-clicking it will show an empty
map.** You need any static web server:

```bash
# Python — installed on macOS and most Linux boxes already
python3 -m http.server 8000

# or Node, if you have it
npx --yes serve .
```

Then open <http://localhost:8000>.

Before pushing, run the validator:

```bash
node tools/validate.mjs
```

It needs Node 18 or newer and has no dependencies.

---

## Add a place

Everything lives in `data/restaurants.json`. It is one big array; add an object
to it:

```json
{
  "id": "lee",
  "name": "Lee",
  "address": "Uus 31, 10111 Tallinn",
  "lat": 59.44150,
  "lng": 24.74975,
  "price": 3,
  "types": ["date", "fine-dining"],
  "blurb": {
    "en": "…",
    "et": "…",
    "ru": "…"
  },
  "mustOrder": ["Rye bread", "Smoked butter"],
  "reel": "https://www.instagram.com/reel/ABC123xyz/",
  "photos": ["01.webp", "02.webp"],
  "website": "https://leerestoran.ee",
  "phone": "+372 5555 5555",
  "added": "2026-08-26",
  "visited": "2026-08",
  "closed": false
}
```

Field by field:

| Field | What it is |
| --- | --- |
| `id` | Lowercase slug: letters, digits, single hyphens. It becomes the `?spot=` link and the `photos/<id>/` folder name. **Never change it once you have shared the link.** |
| `name` | Exactly as it is written on the door. Never translated. |
| `address` | Street address, the way Estonian post would write it. |
| `lat`, `lng` | Decimal degrees. See below. |
| `price` | A whole number, 1 to 4. Rendered as € to €€€€. It is a cost band, not a rating. |
| `types` | Ids that must already exist in `data/taxonomy.json`. Never free text — a typo would silently split a filter in two. |
| `blurb` | Your write-up, one per language. The only per-place field that is translated. |
| `mustOrder` | Dish names exactly as the menu prints them. Not translated. Use `[]` if you have not decided. |
| `reel` | The full Instagram permalink, or `""` if there is not a reel yet. |
| `photos` | Filenames inside `photos/<id>/`. Just the filenames. Use `[]` if there are none. |
| `website` | Optional. An empty string and a missing key both mean "no website". |
| `phone` | Optional. The number you would actually ring, international form with spaces: `+372 661 0180`. It becomes the **Call** button under the place name — a `tel:` link, so a phone hands it straight to the dialler — and a tappable row in the facts list. An empty string and a missing key both mean "no number", and the button and the row both disappear. |
| `added` | The day you added the place, `YYYY-MM-DD`. Drives the **Just added** section at the top of the list. |
| `visited` | The month you last ate there, `YYYY-MM`. |
| `closed` | `true` greys the pin out. See below. |

There is deliberately **no neighbourhood field** — the map is the location
index, and a district label would be a third thing to keep translated. There is
deliberately **no opening-hours field** — it goes stale within weeks and turns
the site into a chore. `phone` is the honest substitute: a number ages far more
slowly than a timetable, and the place can answer the question itself.

### Editor autocomplete

`data/schema.json` is a JSON Schema describing the file. VS Code will use it
for autocomplete and inline errors if you add this to `.vscode/settings.json`
or to your user settings:

```json
{
  "json.schemas": [
    {
      "fileMatch": ["/data/restaurants.json"],
      "url": "./data/schema.json"
    }
  ]
}
```

---

## What counts as a Restaurant

`restaurant` is the one type that is about the shape of a place rather than
what it cooks, so it needs a line drawn: **a sit-down place whose main
business is a cooked meal ordered at a table.**

Not a bakery, not a coffee roastery, not a pub or a taproom even when the
kitchen is good, and not a counter you order at and carry your food away from.
A place can be a restaurant *and* something else — KoHo is a restaurant and a
bakery, Gobi is a restaurant and fine dining — but if the tag went on
everything that serves food it would match the whole map and filter nothing.

27 of the 69 carry it today. If one of them looks wrong to you, it is one line
in `data/restaurants.json`.

---

## The order of the filter chips

The chips appear in the order the types are written in `data/taxonomy.json`,
left to right. That order is set by how many places carry each type, commonest
first, so the chips people are most likely to want are the ones they do not
have to scroll for. Today that is:

| # | Type | Places |
| --- | --- | --- |
| 1 | Casual/Solo | 33 |
| 2 | Bakery | 12 |
| 3 | Coffee/tea | 12 |
| 4 | Beer/pub | 12 |
| 5 | Hidden gem | 11 |
| 6 | Cheap eats | 10 |
| 7 | Date night | 10 |
| 8 | Asian | 9 |
| 9 | Vegan | 7 |
| 10 | Fine dining | 5 |
| 11 | Caucasus | 5 |

Ties are broken by hand: bakery before coffee before pub, cheap eats before
date night, and the two cuisines last, since somebody scanning the row is
usually after a kind of evening rather than a kind of kitchen.

Nothing re-sorts itself as you add places, and that is deliberate: a row of
chips that rearranges between visits is a row nobody learns. Re-check it when
a type has visibly grown, and move the line in `taxonomy.json`.

## Get the coordinates

In Google Maps: find the place, **right-click the pin**, and the first item in
the menu is the coordinates — click it and they are copied to your clipboard.
Paste them and split at the comma: the first number is `lat`, the second is
`lng`.

In Tallinn, `lat` is always about **59.4** and `lng` about **24.7**. If you get
them the wrong way round the validator will catch it, because 24.7° N 59.4° E
is in the Arabian Sea.

Once the pin is on the map, check where the dot actually sits — the panel does
not print the numbers back at you, so the map is the proof. Nudging the fifth
decimal place moves it about a metre.

> The coordinates in the seed data were placed by address, not surveyed. Spot
> check each one on the live map and correct it if the dot is on the wrong side
> of the street.

---

## Copy a video permalink

1. Open the reel on **instagram.com** in a browser (not the app).
2. Copy the address bar, or use the ⋯ menu → **Copy link**.
3. Strip everything after the `?`.

Either of these shapes is accepted — the second is what the address bar shows
while you are browsing your own grid:

```
https://www.instagram.com/reel/ABC123xyz/
https://www.instagram.com/tallinntastebuds/reel/ABC123xyz/
```

### TikTok

The same `reel` field takes a TikTok post. Copy the link from the post's share
menu and strip everything after the `?`:

```
https://www.tiktok.com/@tallinntastebuds/video/7568039651458436374
```

The field is still called `reel` whichever platform it points at — renaming it
would mean touching every place in the data for no gain. The site works out
which platform from the URL and follows suit: the section heading reads **The
reel** or **The video**, and the button names the right app in every language.

The two players work differently under the hood. Instagram needs its
`embed.js`, which only scans for blockquotes when it runs and gives you no hook
to re-process ones injected later. TikTok publishes a plain iframe player, so
there is no script at all — which makes it the simpler of the two. Both stay
click-to-load: nothing is fetched from either company until a visitor presses
play. Verified — zero requests to tiktok.com before the click, one after.

**Never invent a shortcode.** A made-up one resolves to a real stranger's post, on either platform.
Leave `reel` as `""` until you have the actual link; the panel simply says
there is no reel yet.

The embed is click-to-load: Instagram's `embed.js` is not fetched, and no
request is made to Instagram at all, until a visitor presses play. This is what
keeps the map quick on mobile data.

---

## Add photos

One folder per place, named exactly like the `id`:

```
photos/f-hoone/01.webp
photos/f-hoone/02.webp
```

Then list the filenames in that place's `photos` array. WebP at around 1600px
on the long edge and under ~300 KB each is plenty — see `photos/README.md`.
Photos live in Git forever, so resize before committing.

---

## The Just added section

The list panel opens with a short **Just added** section, then the full list
under **A–Z**:

- Always the **five** newest places by `added` date, so the section is the same
  size on every visit whatever you did that week. Change `NEW_COUNT` in
  `assets/app.js` if five is the wrong number.
- Ties inside one day break alphabetically. `added` has day resolution, so if
  six places share a date the five that show are the first five by name.
- Closed places never appear there.

They are **lifted, not moved**. The list below is still every place, in
alphabetical order, with those five sitting in their usual spots — open the
list and you see the whole thing, the way you always did. The section on top
is a shortcut, not a slice taken out.

Each group's heading carries its own count on the right, which is why there is
no count under the panel title any more: a single "68 places" above two
sections read as a claim about both of them. The headings stick to the top of
the panel as you scroll, so sixty rows in you can still see which group you
are looking at.

The five are picked from the **whole map**, not from what the filters have left
on screen — otherwise filtering to a type whose places are all old would
declare them new. Then anything the filter has hidden drops out of the section,
and if that leaves one or none, both headings disappear and the list renders
plain, exactly as it did before any of this existed.

So the field that matters is `added`. Write today's date when you add a place
and it sits at the top until five newer ones push it out. The validator warns
if you forget one.

The dates already in the file were read out of this repository's own git
history — the first commit in which each `id` appears — not guessed.

---

## Searching the list

The **List** button carries a magnifier, because opening the list is how you
get at the search field and with nothing on the button to say so nobody found
out the map could be searched at all. The button still does one thing: it opens
and closes the list. The glyph is the only part that is new, and it is there to
answer a question people were not asking.

There is a field at the top of the list panel. It narrows **the list**, not the
map: the pins are what the filter chips are for, and a search left behind in a
closed panel would otherwise sit there invisibly removing places from the map.

It looks in four places, all of them things somebody could reasonably remember:
the **name**, the **street**, the **type labels**, and the **dishes** in
`mustOrder`. Not the write-ups — a word like "good" would match half the map
and give no clue why.

The type labels go in **in all eight languages at once**, not the one the
switcher happens to be showing. Somebody reading the map in Turkish still types
"bakery" half the time, and somebody reading it in English may well know the
place as a *pagariäri*: `bakery`, `pagariäri`, `leipomo`, `padaria`, `пекарня`,
`çörəkxana`, `panadería` and `fırın` all return the same fourteen, whichever
language is on screen. The index is built once at load, since none of what goes
into it can change afterwards; folding sixty-nine of these on every keystroke
would be work for nothing.

Accents are folded away on both sides before anything is compared, so `sasl`
finds Telliskivi Šašlõkk, `pohja` finds Põhja Konn and `pagariari` finds the
bakeries. Nobody types the carons. It is done by splitting each letter from its
marks (`NFD`) and dropping the marks; the dotless Turkish `ı` has no
decomposition of its own and is mapped by hand, which is what makes `firin`
work as well as `fırın`.

Several words all have to land somewhere, so `telliskivi kohvik` narrows rather
than widening the way a match on the whole phrase would.

A search and the filter chips compose: chips first, then the words. While a
search is running the **Just added** section is suppressed and the results come
back as one flat A–Z list — somebody who typed a word is after a particular
place, and lifting two of the answers into a section of their own only makes
them read the same names twice.

The field sticks to the top of the panel, and the section headings park below
it rather than under it, so sixty rows down the search is still there.

Escape empties the field; a second Escape closes the panel, which is what a
browser's own search boxes do. On a phone the field is 16px, because anything
smaller makes iOS zoom the whole page on focus and never zoom back out — and
see **The sheet** in the design notes for what happens to a fixed bottom sheet
when the keyboard opens over it.

---

## Close a place instead of deleting it

When somewhere shuts down, set `"closed": true`. The pin turns grey, the detail
panel gets a **Closed** flag and a short note, and — the point of the whole
exercise — every `?spot=` link you ever put in a Story keeps working. Deleting
the entry breaks those links silently.

Nothing in `data/restaurants.json` is currently marked closed — the field is
there for the first place that shuts.

---

## Languages

Azerbaijani, English, Estonian, Finnish, Portuguese, Russian, Spanish and
Turkish — the switcher shows them in that order, Azerbaijani first and the rest
alphabetical. The order of the blocks in `ui.json` is the order of the buttons;
the language a visitor *lands* in is a separate thing, still English by
default, and set by `DEFAULT_LANG` in `assets/app.js`.

The switch has two shapes, from the same markup. Wide enough, it is a row of
codes. On a phone it folds into the current code with a menu under it, listing
each language's own name for itself: eight codes side by side are just over
310px, which on a 390px screen runs straight into the handle in the opposite
corner. The fold happens in CSS at 860px, and the folded menu grows downwards,
so the next language costs nothing in layout either. Every interface string is
in `data/ui.json`, keyed by language and then by string id, so a translator
never has to open the HTML.

The language is chosen in this order:

1. the `?lang=` URL parameter (`?lang=ru`)
2. a previous choice remembered in `localStorage`
3. the browser's own preference
4. English

Switching languages re-renders the page in place — no reload. Every touch of
`localStorage` is wrapped in `try/catch`, because it throws outright in some
private-browsing modes; if it is unavailable the site simply forgets the
preference between visits.

### Adding a language

1. Add a block to `data/ui.json` with the same string ids as the others, plus
   a `langName`.
2. Add the matching label to every type in `data/taxonomy.json`.
3. Add the language to each `blurb` in `data/restaurants.json`.

4. Add `months` — the twelve month names separated by `|` — and `monthYear`,
   the pattern that joins them, in case the language wants a different order.
5. Add the code to `translated` in `data/schema.json`. That one is a literal
   list rather than something read out of `ui.json`, so it is the only place
   that has to be told twice.

The language switch and the validator both read the language list from
`data/ui.json`, so there is nothing else to change. Step 2 is the only one the
validator fails on: a type with no label in some language is an error, while
missing blurb translations are warnings, so you can ship as you translate. The
order of the blocks in `ui.json` is the order of the buttons.

### Why month names are in the data

`visited` used to be formatted with `Intl.DateTimeFormat`, which is correct in
Node and in Firefox but not in Chromium for every locale. Chromium reports
Azerbaijani as supported — `supportedLocalesOf(['az'])` returns `['az']` and
`resolvedOptions().locale` says `az` — and then renders April as **M04**,
because the month names are not in its ICU build.

There is no honest feature test for that, and which locales are thin varies by
browser and version. So the names live in `ui.json` instead. The date now reads
the same in every browser, and one more moving part is gone. Intl is still the
fallback if a language has not filled `months` in.

### Estonian is `et`, not `ee`

`ee` is the country code and the domain suffix; the *language* code is `et`.
This matters beyond pedantry: `ee` is the ISO code for Ewe, spoken in Ghana and
Togo, so `<html lang="ee">` would mislead screen readers and any locale lookup
would resolve to the wrong language. If you want the button to *read* EE, that
is a one-line change to the label without touching the code underneath — say
the word.

---

## Deploy to Cloudflare Pages

Cloudflare Pages is the live host. There is nothing to build, so there is no
build command and no hosting bill — a static site of this size sits inside the
free tier permanently, HTTPS included.

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**, authorise GitHub and pick `tallinntastebuds`.
2. **Name the project `tallinntastebuds`.** The project name *is* the
   subdomain, so this is what gets you `tallinntastebuds.pages.dev` rather
   than something with a suffix bolted on. It cannot be changed later without
   recreating the project.
3. Set:
   - **Production branch**: `claude/tallinn-tastebuds-map-nzoqx0`
     (the repo's default branch)
   - **Framework preset**: `None`
   - **Build command**: *leave empty*
   - **Build output directory**: `/`
4. **Save and Deploy.** First build takes about a minute.

Every push to the production branch redeploys. Pull requests get their own
preview URL. Nothing needs enabling on the GitHub side — unlike GitHub Pages,
Cloudflare authorises itself through your own GitHub account.

### Or deploy without touching the dashboard

`.github/workflows/cloudflare.yml` publishes to Cloudflare Pages from GitHub's
runners instead, so the only thing you do in Cloudflare is create a token.

1. Cloudflare → **Manage Account → Account API Tokens → Create Token**, using
   the **Cloudflare Pages — Edit** template.
2. Copy your **Account ID** from the sidebar of any Cloudflare page.
3. GitHub → **Settings → Secrets and variables → Actions → New repository
   secret**, twice: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

Push, and it deploys. The first run creates the `tallinntastebuds` project;
later runs reuse it. The token is scoped to Pages, lives only in GitHub's
secret store, and is never printed. Until both secrets exist the workflow
passes and does nothing, so it will not sit red while you get round to it.

**Use this or the dashboard Git connection, not both.** Two deploy paths on one
project race each other and produce out-of-order deployments.

### Caching

`_headers` in the repo root tells Cloudflare how long to hold each kind of
file. Nothing here is content-hashed — `assets/app.js` keeps that name
forever — so every file revalidates instead of being cached hard. Browsers
still get a fast `304 Not Modified` when nothing changed, but an edit to
`restaurants.json` appears on the next load rather than whenever a cache feels
like expiring. Photos are the exception and are held for a week, since they
are replaced rather than edited.

There is deliberately **no Content-Security-Policy**. Getting one right here
means allowlisting unpkg, Google Fonts, CARTO, Instagram, TikTok and Google
Analytics, and a CSP that is subtly wrong fails silently and breaks embeds
years later. That trade is not worth it for a public map with no logins and no
user input.

### A custom domain, later

Free hosting stays free with your own domain attached; the only cost is the
name itself, around €10–15 a year. `.ee` is open to anyone through a registrar
accredited by the Estonian Internet Foundation, though the registry does
require an administrative contact in Estonia.

Add it under the project's **Custom domains** tab. Cloudflare issues the
certificate automatically. No code change is needed: every path in the site is
relative, so it behaves the same at a domain root as it does under
`/tallinntastebuds/`.

### Other hosts

The same repo works unchanged on GitHub Pages, Netlify or any static host —
the only requirement is that it serves the files over HTTP. The GitHub Pages
workflow in `.github/workflows/deploy.yml` is kept but set to manual-only, so
it no longer fails on every push; run it from the Actions tab if you ever want
to switch. It needs **Settings → Actions → General → Workflow permissions** set
to read and write first.

---

## What the validator checks

`node tools/validate.mjs` — zero dependencies, so CI never needs
`npm install`. It runs on every push and pull request via
`.github/workflows/validate.yml`.

**It fails the build on:**

- invalid JSON in any of the data files
- a missing or wrongly-typed field on any place
- duplicate ids, or ids that are not proper lowercase slugs
- coordinates outside Tallinn's bounding box — which is what catches a swapped
  `lat`/`lng`
- a `type` used in `restaurants.json` that is not in `taxonomy.json`
- a taxonomy type missing a label in any language
- a UI string present in one language but missing in another
- a photo listed in the data that does not exist in the repo
- a `reel` value that is not a real Instagram or TikTok permalink shape
- a `price` outside 1–4, a malformed `visited` month, a malformed `website`
- a `phone` that is not in international form — `+372 661 0180`, not `6610180`
- a malformed `added` date — it has to be `YYYY-MM-DD`

**It warns, without failing, on:**

- blurbs that still contain `TODO` or `PLACEHOLDER`
- places with no reel yet
- places with no `added` date
- open places with no `phone`, so there is nothing to call
- blurbs missing a translation
- taxonomy types nothing uses
- folders in `photos/` that no place points at
- unknown keys on a place object (this is how you catch `blrub`)

---

## Files

```
index.html                 the whole page
assets/styles.css          design tokens at the top, then everything else
assets/app.js              map, panel, filters, i18n, lightbox — no framework
data/restaurants.json      the only file you edit regularly
data/taxonomy.json         the controlled vocabulary of types
data/ui.json               every interface string, in every language
data/schema.json           JSON Schema, for editor autocomplete
photos/<restaurant-id>/    photos, one folder per place
tools/validate.mjs         dependency-free data validator
.github/workflows/validate.yml
```

Deep links: `?spot=f-hoone` opens that place directly — that is the link to put
in a Story. `?lang=ru` opens it in Russian, `?style=green` in the dark
palette. They all combine.

---

## The two styles

Two swatches sit on the left rail: brick and forest, day and night. Picking one
changes the **whole** colour world — not just an accent.

| Style | Accent | Card | Ground | Map |
| --- | --- | --- | --- | --- |
| Red | `#a81e28` | `#fff0ea` | `#f7ddd4` | Positron, tinted brick |
| Green (dark) | `#6fd39a` | `#1d2a23` | `#101a15` | CARTO Dark Matter |

There used to be seven, one per colour of the spectrum. Seven colours of chrome
is a settings screen, and the rail was asking a question nobody opens a
restaurant map to answer — the strip read as the loudest thing on the page and
was the only control on it that changes nothing about what you are looking at.
The two that survive are the two that are actually a choice: the light one and
the dark one.

**The card is what carries the colour.** An earlier version kept every light
style's paper within a point of white — `#fffaf9`, `#fffbf5`, `#fffdf3`,
`#ffffff`, `#fdfaff` — which measures out at 2-5 dE between any two of them.
Four styles that differ by less than a JPEG artefact are one style with four
pin colours, which is exactly what it looked like. Red's paper sits at L\* 96
with real chroma.

Green takes the same treatment on the basemap that the dark styles always did,
since Dark Matter is drawn almost black: a brightness lift on the tiles and a
screen pass in its own hue. The screen is the half doing the work, because a
multiplier cannot lift a black off zero. Measured on Dark Matter's own tones
the pair takes the land from `#1a1c1e` to around `#44474f`, and label contrast
reads 5.7-5.8 against the 5.0 the tiles have untouched.
Its swatch wears the card colour with a ring of the accent, so the rail says
which of the two is the dark one before you press it.

Both styles are **nothing but a block of custom properties** near the top of
`assets/styles.css`, keyed off `[data-style="…"]` on the root element. No
component rule anywhere names a colour, so adding a third style is one block
there plus one entry in `STYLES` in `assets/app.js`. Nothing else. The `:root`
block above them is Red's palette to the value, because Red is what the page
opens on and `:root` is what it wears for the instant before the script sets
`data-style`.

Two things to know before you retune them:

- **The map is tinted, not just the chrome.** `--map-tint` paints `#map::after`
  over the tile pane with `mix-blend-mode: color`. Without it the basemap stays
  grey and the style reads as "only the pins changed colour", which is exactly
  how the first attempt failed. Pins, tooltips and controls live in other
  panes, so they keep their exact token colours.
- **Tint with `color`, never with filters.** An early version used
  `sepia() + saturate() + hue-rotate()` and it made the map unreadable: sepia
  flattens Positron's light greys into a single tone, so road-against-land
  contrast fell from 1.30 to about 1.03 and labels lost 30-52% of theirs. The
  `color` blend takes hue from the tint and lightness from the tiles, so
  contrast is preserved by construction. Modelled on Positron's own tones
  through the compositing spec's `ClipColor`, every pair that matters —
  road/land, land/label, road/label, land/water — holds at 94-104% of untinted
  all the way to alpha `.45`. Red runs at `.36`. Positron's land is too light
  to hold much saturation either way; it is the bay the tint is for, and in a
  coastal city the bay is a third of the screen.

Both accents clear 4.5:1 against both their card and their ground, every
`--muted` clears 4.5:1 on its card, and every `--ink` clears 12:1.

`--here` paints the "you are here" dot and is deliberately a hue neither accent
uses: a blue dot next to brick pins, a warm one against green. Otherwise you
cannot tell yourself from a restaurant.

Green swaps to CARTO Dark Matter — a dark card over the pale Positron map would
be unreadable. It is the only style that changes basemap.

The choice is saved to `localStorage` (wrapped in `try/catch`, like the
language) and mirrors into `?style=`, so a shared link opens in the same look.
An unrecognised value falls back to red and is dropped from the URL — which is
also what an old `?style=violet` link, or a browser still holding one of the
five removed styles in `localStorage`, lands on.

One caveat on the dark styles: the Instagram embed draws its own white card
inside an iframe, which nothing outside can restyle. It stays light.

## The radio

`data/radio.json` holds a station for everyone and, optionally, one per
language:

```json
{
  "default": { "name": "Raadio Tallinn", "url": "https://icecast.err.ee/raadiotallinn.mp3" },
  "byLanguage": {
    "ru": { "name": "Наше Радио", "url": "https://nashe1.hostingradio.ru/nashe-256" },
    "tr": { "name": "Joy Türk Rock", "url": "https://playerservices.streamtheworld.com/api/livestream-redirect/JOYTURK_ROCK.mp3" }
  }
}
```

A language with no entry of its own falls back to `default`, so nobody gets
silence for want of a line. Switching language while the radio is playing
switches the station under it rather than leaving the old one running behind a
button naming the new one.

Delete the file, or empty it, and the button never appears at all.

Requirements for the URL, all three or it will not work:

- **HTTPS.** The page is served over HTTPS, so a plain `http://` stream is
  blocked as mixed content and fails silently in the console.
- **A direct audio stream**, MP3 or AAC, the address a media player would take.
  Not a station's web page, not a SoundCloud or YouTube link, and not an HLS
  playlist: a `.m3u8` plays in Safari and nowhere else, which is the trap most
  Turkish broadcasters set, TRT included. A `.pls` or `.m3u` is a playlist file
  rather than a stream and is no good either — open it and take the URL inside.
- **Somebody else's bandwidth**, which is normal for a public stream, but it is
  worth picking a station that publishes theirs openly.

It is a plain `<audio>` element built on first press, not an embed. A visitor
who never presses it downloads nothing and is handed no third-party cookie,
which is not true of a SoundCloud or YouTube iframe. Autoplay is blocked by
every browser and that is right: it plays because somebody asked it to.

If the stream fails, the button resets and says so in a toast. If the URL dies
for good, it is one line in this file, which is the same maintenance the rest
of the map asks for.

Where a station sits behind a load balancer, take the address that resolves to
a node rather than a node itself. Joy Türk Rock and Itapema FM are both served
from pools of hosts named `21633.live.streamtheworld.com` and up — scraped
playlists have Joy Türk Rock on fourteen different numbers and Itapema on five,
which is the rotation happening in public. A link to one of them rots within
months, so both entries point at
`playerservices.streamtheworld.com/api/livestream-redirect/`, which hands the
browser whichever node is up today. A `<audio>` element follows the 302 without
being asked; some stream checkers do not, so those two URLs will look dead to a
link checker and play fine in a browser.

Prefer the station's own address over a rebroadcast of it. Anti Radio, YleX and
Radio Paradise are all on their broadcaster's own host, which is why those
three lines are the shortest in the file. A mirror on an aggregator's CDN is a
lower bitrate, one remove from the station, and free to drop it whenever it
likes.

Reach for a mirror only once the official address has actually failed **in a
browser**. Scraped stream indexes disagree with each other about that address
and a link checker can call it dead from the wrong country or over the wrong
TLS; neither is the test that counts. Pressing the button is.

## Surprise me

The button under the swatches on the left rail picks a place at random and
opens it.

It picks from **whatever the chips currently allow**, so selecting "Korean" and
"Cheap eats" and then pressing it answers the question you were actually
asking. Closed places are never suggested, and the same place is never returned
twice in a row.

It lives on the left rail rather than in the bottom filter row because the
filter row scrolls sideways once the vocabulary is wide, and a button that
scrolls out of reach is no use. On a phone it collapses to just the die.

The rail is vertically centred, and `placeRail()` in `assets/app.js` nudges it
down on short windows so it can never ride up under the brand card.

## Third-party pieces and their licences

| Piece | Version | Licence | Notes |
| --- | --- | --- | --- |
| [Leaflet](https://leafletjs.com/) | 1.9.4, pinned | BSD-2-Clause | Loaded from unpkg with Subresource Integrity hashes, so a compromised CDN cannot swap the file. |
| [CARTO Positron](https://carto.com/basemaps/) basemap (`light_all`) | — | Free for use with attribution, no key or account | The tiles. |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) data | — | ODbL | The map data behind the tiles. |
| [Familjen Grotesk](https://fonts.google.com/specimen/Familjen+Grotesk), [Literata](https://fonts.google.com/specimen/Literata), [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) | — | SIL Open Font License 1.1 | Served by Google Fonts. |
| [Instagram embed.js](https://developers.facebook.com/docs/instagram/oembed/) | — | Meta Platforms terms | Only loaded after a visitor presses play. |
| [TikTok embed](https://developers.tiktok.com/doc/embed-videos/) (iframe player) | — | TikTok terms | Only loaded after a visitor presses play. No script involved. |
| [Google Analytics 4](https://developers.google.com/analytics) (gtag.js) | — | Google terms | Property `G-2XNTC15F28`. Loads on every page view and sets cookies. |

**The attribution control in the bottom-right corner is a licence condition of
both OpenStreetMap and CARTO. Do not remove it.**

No scripts or fonts beyond the table above. Apart from Google Analytics,
the only thing stored on a visitor's device is their language choice.

### Analytics

Google Analytics 4 is wired up, property `G-2XNTC15F28`. The tag lives in the
`<head>` of `index.html`, exactly as Google's console emits it.

Because this is a single page, GA on its own would record one view per visit
and tell you nothing about which places people actually open. So opening a
place also reports a page view of its own, titled with the place name and
pointing at its `?spot=` URL — `trackView()` near the bottom of
`assets/app.js`. Those land in GA's standard **Pages and screens** report with
no configuration in the console, which means the report doubles as a
popularity ranking of the map.

Everything else people do on the map happens without the address bar changing,
and GA only ever sees a URL, so those actions used to be invisible. They are
reported as events instead, from `trackEvent()` beside `trackView()`:

| event | parameters |
| --- | --- |
| `filter_select` | `filter_id`, `filter_state` (`on`/`off`), `filters`, `filter_count`, `places_shown` |
| `filter_clear` | `filters`, `filter_count`, `places_shown` |
| `language_select` | `language` |
| `style_select` | `style` |
| `random_pick` | `place`, `pool` |
| `reel_play` | `place`, `provider` |
| `call_place` | `place` |
| `cluster_open` | `cluster_size` |
| `list_open` | `places_shown` |
| `search` | `search_term` |
| `locate` | — |

They appear under **Reports → Engagement → Events** on their own. To break the
numbers down by a parameter — which chip, which language — register it once in
**Admin → Custom definitions** as a custom dimension; GA only collects
parameters from that point on, so it is worth doing early.

**Back.** Opening a place is a step you can come back from, so it gets a
history entry of its own; a filter, a language or a colour rewrites the entry
you are already on. Back therefore closes the place and leaves the map settled
on it — the panel had it parked off to one side to stay out of the way, and
with the panel gone it moves to the middle of the screen. Which is the point:
you came to find out where it is.

One entry per open place, not one per place. Opening a second place while a
first is showing replaces, so Back always means "close this", never "walk back
through everywhere I looked". Forward reopens it.

A link straight to a place — the kind that goes in a Story — gets the bare map
written into the entry it arrives on, so Back has somewhere to go: the map,
standing on the place that was shared. Whatever entry the browser lands on,
`popstate` matches it and writes nothing back.

The chips are also in the URL now, as `?type=bakery,vegan`. A filtered map is
a link worth sending, and the landing page view GA records for it names the
filters, so shared filtered links show up in **Pages and screens** too.

### Getting found

`robots.txt` and `sitemap.xml` sit at the root, and `index.html` carries a
canonical link and the `og:` tags. All three name the host, so **on a custom
domain, change the address in those three files** and nothing else.

Google finds a site through links and through Search Console, and a brand new
host has neither. In order of what actually moves the needle:

1. **Put the link in the Instagram bio.** It is both the crawl path and,
   realistically, most of the traffic.
2. **Google Search Console.** Verify the property, submit `sitemap.xml`, then
   use URL Inspection to request indexing. Verification by HTML tag needs a
   `<meta name="google-site-verification">` line in `index.html`.
3. **Bing Webmaster Tools.** Same job, and it feeds other answer engines.
4. **A custom domain.** `pages.dev` indexes fine, but it carries no brand and
   it is not yours: a domain you own is the one thing here that survives
   changing host.

Search Console is also where to check whether a page is being *refused*
rather than merely missed. Cloudflare Pages serves `x-robots-tag: noindex` on
preview deployments, which is correct for previews and fatal if the address
people share turns out to be one.

To remove tracking entirely, delete the gtag block from `index.html` and the
`trackView` and `trackEvent` functions from `assets/app.js`; their call sites
then do nothing. Deleting only the gtag block is also safe — both check for
the tag and return quietly when it is missing, which is also what happens for
visitors running an ad blocker.

**GA4 sets cookies.** Estonia applies the EU rules, so if you get meaningful
traffic from the EU you are expected to ask for consent before the tag loads.
There is no consent banner on this site.

If CARTO ever stops serving free tiles, the one line to change is `TILE_URL`
near the top of `assets/app.js`.

---

## Design notes

**Palette.** The ground is `--wash`, the cards are `--paper`, and links, pins
and the price gauge are `--accent`, with `--accent-lit` a brighter step up for
hover and the locate dot. Near-black ink cast towards the style's own hue, one
hairline weight, one soft shadow, nothing else. The tokens are the first thing
in `assets/styles.css` and each of the two styles restates every one of them;
change those values and the whole site follows.

**The chrome.** Everything floats on the map: nothing has a page around it.
One strip across the top — the brand card on the left, locate, **List** and the
language switch on the right — and the filter chips on the line directly
beneath it. There are no zoom buttons; the wheel, a double-click, a pinch and
the `+`/`-` keys all still zoom, and two more buttons standing on the map were
paying for a job the map already does. The chips used to sit at the bottom,
where the sheet covered them and they had to be hidden whenever the list was
open; at the top they clear even the fully dragged-up sheet, so the filters can
be changed while the list is showing.

**Nothing above the chips drags the map.** That strip is chrome, and the map
shows through the gaps in it: between the card and the buttons, around the
chips, along the edges. A thumb aimed at a chip lands a few pixels off often
enough that the whole city used to come with it. A press that starts anywhere
above the bottom of the chip row now turns Leaflet's drag handler off, and the
finger lifting turns it back on.

Only the drag, not the events. Everything in the strip still does its job: the
handle opens Instagram, the switcher changes language, the chips scroll, the
wheel still zooms, and a pin that happens to be up there still opens when you
tap it. Leaflet binds its own drag to `touchstart` and `mousedown` on the map
container, so disabling the handler from a capture listener on the document
unbinds them before the event ever gets that far.

The chip scroller claims an invisible strip around itself as well, because a
finger aiming at a 38px row lands a few pixels off often enough to drag Tallinn
sideways instead. Most of that cushion is below the chips now — the side a
thumb reaching up overshoots on — and the brand card and the controls sit above
the scroller in the stack, so a tap on a button is always a tap on that button.

Under about 380px the handle and the three controls stop fitting on one line,
so the controls take a line of their own and the chips drop below both.

**Pins.** One shape, three readings of it, for the three amounts of place
behind it:

| | pin | today |
| --- | --- | --- |
| a reel | solid disc, r7 | 43 |
| photos, no reel | hollow, r7, ring at full weight | 10 |
| the write-up alone | small faded ring, r4.5 | 17 |

The three used to be told apart by fill alone — solid, then the accent mixed
38% into the card colour, then empty — at radii of 7, 6.5 and 6. On paper that
is three states; on the map it was one dot and two dots that looked like it in
worse light, and the half-fill in particular read as a rendering artefact
rather than as a fact about the place. So the middle state gave up its fill
entirely and kept its size: solid versus hollow is a different silhouette, not
a paler version of the same one. The faintest state went the other way and gave
up size instead, down to r4.5 with a 1.75 stroke drawn in the accent mixed half
into the paper — small and quiet, which is what it is saying.

The mix is still drawn opaque rather than as the accent at half alpha, so the
map does not show through it and the three read the same on both palettes. Not
three icons, because at 14px a picture inside a dot is mud and the map is 70
dots. The chosen place grows, gains a breathing halo and keeps its name open,
but it keeps whichever of the three states it is, so selecting a place never
hides what there is to see in it.

**The mark.** A dot only says this if you can see two other dots to compare it
with, which rules out the list, and rules out the map on a phone that has
zoomed into one street. So every row in the list carries the same three-way in
words — **REEL** or **VIDEO**, **PHOTOS**, **NOT FILMED** — as a badge holding
the right edge of the row, and the badge is drawn at the pin's own three
weights: solid accent, accent outline, hairline. The glyph inside it is the pin
itself, small: a disc, a ring, a speck. Not a play triangle and a camera, which
would only repeat the word next to them; echoing the dot is the one thing the
badge can do that the word cannot, which is turn every row into a key to the
map. The row's `aria-label` spells the word out, because the label is all a
screen reader reads of a row and anything shown but not spelled is not there.

**The open place.** The list panel is the neutral card everything else on the
map is. Opening a place tints that card with six percent of the accent, so it
reads as picked rather than as the same panel with different words in it. Six
percent because it has to survive the measurement: on both palettes the body
text stays between 10.7 and 15.9 to one and the muted line never drops below
4.96. Anything stronger starts turning a write-up into a coloured
box.

**What the panel leads with.** Name, price, **Call** — then, immediately, the
thing there is to look at. The reel comes first, the photos after it, and a
place with neither says so in that same slot under its own heading rather than
leaving you to reach the bottom and work it out. The write-up, the tags and the
dishes all moved down a notch to make room.

They used to sit two sections down, under the write-up and the tags, which put
the one thing on the page that is not text below a screenful of text: on a
phone the reel had to be scrolled to, and the Call button had already been
moved up out of the same problem. Ordering by what is scarcest reads better
anyway — every place has a write-up, only 43 have a reel — and it makes the
three kinds of place read as three kinds in the panel too, rather than as one
kind and two omissions.

**Clustering.** Pins closer together than 44px are drawn as one counted dot,
recomputed on zoom — clustering follows the projection, and panning does not
change that.

Pressing one used to zoom to *fit* what was inside it, which turned out to be
the wrong question. Two places forty pixels apart already fit, so the answer
came back "you are close enough" and the cluster stood there however many
times it was pressed. What has to happen is that the pins come further apart
than the distance that grouped them, and that zoom can be asked of the group
directly: every member is within 44px of the seed by construction, so doubling
the gap enough times always splits it. The target is the deepest of that, the
zoom that fits the bounds, and one level in — so pressing a cluster always does
something, a wide one opens out to show what is in it, and a tight one goes
straight to where its pins come apart. A cluster of 19 steps 12 → 14 and
becomes thirteen clusters; a pair eleven metres apart goes 12 → 18 and becomes
two pins.

Nothing is grouped past **zoom 17**, whatever the spacing. Q Pizza Jaam and
Telliskivi Šašlõkk are eleven metres apart, which is 37px at zoom 18 — under
the 44 that groups them, so the cluster survived every zoom a click could
reach and there was no way to get at either place. Two dots 37px apart are two
perfectly clickable dots. Grouping is there to stop a city of pins turning
into a smear at low zoom, and by 18 you are looking at one doorway.

**The sheet.** On a phone the panel is a bottom sheet, and its height has a
floor under it: whatever else happens it leaves 110px of the screen showing,
which is the chrome strip and the chip row. That strip is the way back out.

It is sized against `--vph`, which is `window.innerHeight` written back to CSS
on every resize, falling back to `dvh` before the script runs and to plain `vh`
in a browser that has neither. `vh` on iOS means the *large* viewport — the one
with the browser chrome collapsed — so a sheet sized in `vh` and anchored to
the bottom of the screen could start above the top of what you can actually
see, taking its close button and its drag grip with it. Open a place, swipe the
sheet up, and there was no way out of it. Measuring the number in JS rather
than trusting a unit also means the drag stops and the stylesheet can never
disagree about how tall the sheet is allowed to be.

The headroom carries `env(safe-area-inset-top)` on top of its 110px, the same
way the chrome strip above it does, so a taller phone keeps the same clearance
rather than eating into it.

Which leaves four ways back from a sheet standing open, all of them on screen:
**swipe it down**, the close button, a tap on the grip, and **List** in the
chrome strip above.

The swipe arms only at the very top of the sheet's own scroll and only on a
downward move, so scrolling the list still scrolls the list: the first
touchmove decides which of the two the gesture is, and the browser is only told
to keep its hands off once the sheet is the answer — non-passive, because
`preventDefault` on that move is the whole mechanism. An embed keeps its own
gestures, and so does the search field, but only while it is the one being
typed in: a swipe that starts on the search box before you have touched it is a
swipe like any other.

**The close button** rides in the band at the top of the panel — on a phone
that band is the grip bar, with the pill to grab in the middle and the way out
on the right. It used to float over the words: fine while the panel was at the
top of its scroll, and a hole punched through a sentence as soon as it was not.
The band is opaque and the content scrolls under it, so the button always has
its own ground to stand on. 40px on a phone, which is a target rather than a
mark.

The soft keyboard is the same class of problem from the other end. iOS shrinks
the visual viewport when the keyboard comes up but leaves the layout viewport —
and with it anything `position: fixed` — where it was, so the sheet keeps its
full height and the search field ends up behind the keys; then Safari scrolls
the layout viewport to reveal the field and drags the whole sheet off the top.
`visualViewport` is measured, what the keyboard covers goes into `--kbd`, the
sheet lifts by it and loses the same off its height so the top edge does not
move, and the page scroll is put back. Android resizes the layout viewport
itself and the measurement comes out at zero, which is the right answer there.

**Labels.** Past zoom 14 the pins start carrying their names, because at that
point you are looking at a street rather than a city and the question changes
from where to which. Not all of them: a name is wide and a pin is 14px, so they
are placed greedily and any that would land on another name, on a pin or on a
cluster count is dropped, and one that would be sliced off by the window edge
is dropped too. The chosen place is placed first and always keeps its name.
Recomputed on pan as well as zoom, unlike the clustering, since which names fit
depends on what is on the screen. A name that is standing open opens its place
when you click it, the same as the dot — it is part of the pin, not a caption
beside it. Leaflet's `interactive` tooltip option does that on its own: it lets
pointer events reach the label and makes the marker the label's event parent,
so one click handler serves both and a drag that starts on a name still pans
the map. Hover tooltips stay inert, since the pointer is already on the dot.

**Type.** Three faces with three jobs, and they never trade places.
*Familjen Grotesk* — a contemporary Nordic grotesque — sets place names and
the wordmark only. *Literata* sets prose; it is a screen-reading serif with
proper Cyrillic, which matters when a third of the copy is Russian.
*IBM Plex Mono* is reserved for micro-labels, the price and the buttons, set
at 10px uppercase with wide letter-spacing. Reading a label in a monospace
face and a blurb in a serif is a quiet signal about which is data and which is
opinion.

**The signature: the price gauge.** Price always renders as four slots, never
fewer. The slots you are paying for are in the accent; the rest stay
ghosted in the hairline colour — `€€··` rather than `€€`. It is the only meter
anywhere on the site, and it measures money rather than merit. That is the
argument of the whole project in one piece of typography, sitting exactly where
a lesser guide would put its stars. Everything else is deliberately quiet so
that this reads.

**Behaviour.** The map fills the viewport and fits to the pins on load; there
is no landing page and nothing scrolls behind it. The detail panel is a side
panel above 860px and a bottom sheet below. Escape closes the lightbox first,
then the panel. Focus rings are visible everywhere, map pins are keyboard
reachable with Enter, and `prefers-reduced-motion` turns off every transition
and map animation.

**The List view is also the SEO surface.** It is the only part of the site a
crawler can read as text, so it stays in the markup even when the panel is
closed, hidden by transform rather than removed.
