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
| `visited` | The month you last ate there, `YYYY-MM`. |
| `closed` | `true` greys the pin out. See below. |

There is deliberately **no neighbourhood field** — the map is the location
index, and a district label would be a third thing to keep translated. There is
deliberately **no opening-hours field** — it goes stale within weeks and turns
the site into a chore.

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

Once the pin is on the map, open it and check the coordinates line in the
detail panel against where the dot actually sits. Nudging the fifth decimal
place moves it about a metre.

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
reel** or **The video**, and the button names the right app in all three
languages.

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

## Close a place instead of deleting it

When somewhere shuts down, set `"closed": true`. The pin turns grey, the detail
panel gets a **Closed** flag and a short note, and — the point of the whole
exercise — every `?spot=` link you ever put in a Story keeps working. Deleting
the entry breaks those links silently.

Nothing in `data/restaurants.json` is currently marked closed — the field is
there for the first place that shuts.

---

## Languages

Azerbaijani, English, Estonian, Finnish, Portuguese, Russian — the switcher
shows them in that order, Azerbaijani first and the rest alphabetical. The
order of the blocks in `ui.json` is the order of the buttons; the language a
visitor *lands* in is a separate thing, still English by default, and set by
`DEFAULT_LANG` in `assets/app.js`.

The switch has two shapes, from the same markup. Wide enough, it is a row of
codes. On a phone it folds into the current code with a menu under it, listing
each language's own name for itself: six codes side by side are 232px, which
on a 390px screen runs straight into the handle in the opposite corner. The
fold happens in CSS at 860px, so adding a seventh language costs nothing in
layout. Every interface string is in
`data/ui.json`, keyed by language and then by string id, so a translator never
has to open the HTML.

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

The language switch, the validator and the schema all read the language list
from `data/ui.json`, so there is nothing else to change. Missing blurb
translations only produce warnings, so you can ship as you translate. The
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

**It warns, without failing, on:**

- blurbs that still contain `TODO` or `PLACEHOLDER`
- places with no reel yet
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
in a Story. `?lang=ru` opens it in Russian, `?style=violet` in the violet
palette. They all combine.

---

## The seven styles

A strip of seven swatches sits on the left rail. Each is a colour of the
spectrum, and picking one changes the **whole** colour world — not just an
accent.

| Style | Accent | Card | Map |
| --- | --- | --- | --- |
| Red | `#a81e28` | `#fffaf9` | tinted pink |
| Orange | `#96490a` | `#fffbf5` | tinted warm |
| Amber | `#6e5a07` | `#fffdf3` | tinted gold |
| Green (dark) | `#6fd39a` | `#1d2a23` | CARTO Dark Matter |
| Blue | `#00539c` | `#ffffff` | untinted — the default |
| Indigo (dark) | `#a7adf5` | `#262a42` | CARTO Dark Matter |
| Violet | `#6b3494` | `#fdfaff` | tinted violet |

Two of them are dark, because one dark option is a switch and two is a choice.
Both take the same treatment on the basemap, since Dark Matter is drawn almost
black: a brightness lift on the tiles and a screen pass in their own hue. The
screen is the half doing the work, because a multiplier cannot lift a black off
zero. Measured on Dark Matter's own tones the pair takes the land from `#1a1c1e`
to `#44474f`, and label contrast still reads 5.9 against the 5.1 the tiles have
untouched.
Their swatches wear the card colour with a ring of the accent, so the rail
shows at a glance which two they are.

Every style is **nothing but a block of custom properties** near the top of
`assets/styles.css`, keyed off `[data-style="…"]` on the root element. No
component rule anywhere names a colour, so adding an eighth style is one block
there plus one entry in `STYLES` in `assets/app.js`. Nothing else.

Three things to know before you retune them:

- **The map is tinted, not just the chrome.** `--map-filter` is applied to
  `.leaflet-tile-pane`. Without it the basemap stays grey and the styles read
  as "only the pins changed colour", which is exactly how the first attempt
  failed. Pins, tooltips and controls live in other panes, so they keep their
  exact token colours.
- **Do not retune `--map-filter` by eye.** CSS `hue-rotate` is a matrix
  approximation, not a true HSL rotation, so plausible-looking numbers land
  badly wrong — the first pass missed by up to 55°. The values in the file were
  found by sampling filtered output against a real Positron land tone. Every
  hue now lands within 9° of its target and land luminance stays above 224, so
  streets and labels remain readable. Re-measure rather than guess.
- **There is no true yellow.** Yellow on white is about 1.3:1 contrast, far
  under the 4.5:1 that body text and links need, so that slot is the deepest
  yellow still recognisable as yellow. Every accent clears 4.5:1 against both
  its card and its ground; the worst is 5.12:1.

Indigo is the dark style and swaps to CARTO Dark Matter unfiltered — dark cards
over the pale Positron map would be unreadable. It is the only style that
changes basemap, because keyless CARTO offers three looks and seven unique
basemaps without an API key does not exist.

The choice is saved to `localStorage` (wrapped in `try/catch`, like the
language) and mirrors into `?style=`, so a shared link opens in the same look.
An unrecognised value falls back to blue and is dropped from the URL.

One caveat on the dark style: the Instagram embed draws its own white card
inside an iframe, which nothing outside can restyle. It stays light.

## The radio

`data/radio.json` holds a station for everyone and, optionally, one per
language:

```json
{
  "default": { "name": "Raadio Tallinn", "url": "https://icecast.err.ee/raadiotallinn.mp3" },
  "byLanguage": {
    "ru": { "name": "Raadio 4", "url": "https://icecast.err.ee/raadio4.mp3" }
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
  Not a station's web page, not a SoundCloud or YouTube link.
- **Somebody else's bandwidth**, which is normal for a public stream, but it is
  worth picking a station that publishes theirs openly.

It is a plain `<audio>` element built on first press, not an embed. A visitor
who never presses it downloads nothing and is handed no third-party cookie,
which is not true of a SoundCloud or YouTube iframe. Autoplay is blocked by
every browser and that is right: it plays because somebody asked it to.

If the stream fails, the button resets and says so in a toast. If the URL dies
for good, it is one line in this file, which is the same maintenance the rest
of the map asks for.

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
| `cluster_open` | `cluster_size` |
| `list_open` | `places_shown` |
| `locate` | — |

They appear under **Reports → Engagement → Events** on their own. To break the
numbers down by a parameter — which chip, which language — register it once in
**Admin → Custom definitions** as a custom dimension; GA only collects
parameters from that point on, so it is worth doing early.

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

**Palette.** The ground is `--wash`, a pale limestone grey — *paekivi* is
Estonia's national stone and the Old Town is built out of it. The accent is
`--accent`, the blue of the Estonian flag, with `--accent-lit` a brighter step
up for hover and the locate dot. Cool near-black ink, one hairline weight, one
soft shadow, nothing else. The tokens are the first thing in
`assets/styles.css`; change those six values and the whole site follows.

**Pins.** One shape, three amounts of ink, for the three amounts of place
behind it:

| | pin | today |
| --- | --- | --- |
| a reel | solid, r7 | 43 |
| photos, no reel | half filled, r6.5 | 8 |
| the write-up alone | empty ring, r6 | 17 |

The middle fill is the accent mixed 38% into the card colour and drawn opaque,
rather than the accent at 38% alpha, so the map does not show through it and
the three read the same on every palette. Not three icons, because at 14px a
picture inside a dot is mud and the map is 68 dots. The chosen place grows,
gains a breathing halo and keeps its name open, but it keeps whichever of the
three states it is, so selecting a place never hides what there is to see in
it.

**The open place.** The list panel is the neutral card everything else on the
map is. Opening a place tints that card with six percent of the accent, so it
reads as picked rather than as the same panel with different words in it. Six
percent because it has to survive the measurement: across all seven palettes
the body text stays between 10.7 and 15.9 to one and the muted line never
drops below 4.96. Anything stronger starts turning a write-up into a coloured
box.

**Labels.** Past zoom 14 the pins start carrying their names, because at that
point you are looking at a street rather than a city and the question changes
from where to which. Not all of them: a name is wide and a pin is 14px, so they
are placed greedily and any that would land on another name, on a pin or on a
cluster count is dropped, and one that would be sliced off by the window edge
is dropped too. The chosen place is placed first and always keeps its name.
Recomputed on pan as well as zoom, unlike the clustering, since which names fit
depends on what is on the screen.

**Type.** Three faces with three jobs, and they never trade places.
*Familjen Grotesk* — a contemporary Nordic grotesque — sets place names and
the wordmark only. *Literata* sets prose; it is a screen-reading serif with
proper Cyrillic, which matters when a third of the copy is Russian.
*IBM Plex Mono* is reserved for micro-labels, coordinates and the price, set
at 10px uppercase with wide letter-spacing. Reading a coordinate in a
monospace face and a blurb in a serif is a quiet signal about which is data
and which is opinion.

**The signature: the price gauge.** Price always renders as four slots, never
fewer. The slots you are paying for are in the accent blue; the rest stay
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
