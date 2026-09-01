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
- [A filter never answers with an empty screen](#a-filter-never-answers-with-an-empty-screen)
- [Close a place instead of deleting it](#close-a-place-instead-of-deleting-it)
- [Languages](#languages)
- [Restaurant discounts](#restaurant-discounts)
- [Stories](#stories)
- [The admin page](#the-admin-page)
- [Deploy to Cloudflare Pages](#deploy-to-cloudflare-pages)
- [The map tiles need a key](#the-map-tiles-need-a-key)
- [What the validator checks](#what-the-validator-checks)
- [Files](#files)
- [The mark](#the-mark)
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

**If you edited anything in `assets/`, run the stamper first:**

```bash
node tools/stamp.mjs
```

It rewrites the `?v=` hash on every script and stylesheet reference in the four
HTML pages. The validator fails on a stale one, so CI will catch it if you
forget — but it is one command and it saves a round trip. See
[Cache stamps](#cache-stamps).

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
| `price` | A number from 1 to 4, in steps of 0.5. Rendered as € to €€€€, where a half step lights half a euro sign — `2.5` reads as €€ and a half. It is a cost band, not a rating. |
| `types` | Ids that must already exist in `data/taxonomy.json`. Never free text — a typo would silently split a filter in two. |
| `blurb` | Your write-up, one per language. The only per-place field that is translated. |
| `mustOrder` | Dish names exactly as the menu prints them. Not translated. Use `[]` if you have not decided. |
| `reel` | The full Instagram permalink, or `""` if there is not a reel yet. |
| `photos` | Filenames inside `photos/<id>/`. Just the filenames. Use `[]` if there are none. |
| `website` | Optional. An empty string and a missing key both mean "no website". |
| `phone` | Optional. The number you would actually ring, international form with spaces: `+372 661 0180`. It becomes the **Call** button at the foot of the panel, next to **Directions** — a `tel:` link, so a phone hands it straight to the dialler — and a tappable row in the facts list just above it. An empty string and a missing key both mean "no number", and the button and the row both disappear. |
| `added` | The day you added the place, `YYYY-MM-DD`. Drives the **Just added** section at the top of the list. |
| `visited` | The month you last ate there, `YYYY-MM`. |
| `closed` | `true` greys the pin out and draws a dashed ring round it. See below. |

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

## What counts as Laptop friendly

`laptop` is the other type that describes the room rather than the menu, so it
needs the same line drawn: **somewhere you can sit for two hours with a laptop
open and nobody minds.**

Three things have to be true at once — a table you can actually work at, a room
quiet enough to think in, and staff who are fine with one coffee stretching out.
Any one of them missing and the tag comes off. A cafe with power sockets but
queues out the door at lunch is not laptop friendly, and neither is a great
quiet room with nothing but bar stools.

Wi-Fi is deliberately not on that list. Every place on this map has it, and half
of them do not print the password anywhere, so it separates nothing.

It is also not a promise about the whole day. Every one of these fills up at
lunch. The tag says the place has a working shift in it, not that every hour is
one.

It goes on a place, never on a counter inside one. Somewhere that is a bakery
in the morning and a restaurant at night is two different rooms with two
different answers, and one chip cannot say both — so it stays off until the two
are split into their own entries.

6 of the 70 carry it today, and all six are coffee or tea.

---

## The order of the filter chips

The chips appear in the order the types are written in `data/taxonomy.json`,
left to right. That order is set by how many places carry each type, commonest
first, so the chips people are most likely to want are the ones they do not
have to scroll for. Today that is:

| # | Type | Places |
| --- | --- | --- |
| 1 | Casual/Solo | 40 |
| 2 | Bakery | 15 |
| 3 | Coffee/tea | 15 |
| 4 | Beer/pub | 12 |
| 5 | Hidden gem | 11 |
| 6 | Cheap eats | 10 |
| 7 | Date night | 11 |
| 8 | Laptop friendly | 6 |
| 9 | Asian | 9 |
| 10 | Vegan | 7 |
| 11 | Fine dining | 5 |
| 12 | Caucasus | 6 |

The counts above are the live ones, and the order no longer follows them
exactly: Date night has grown past Cheap eats, and Caucasus past Fine dining,
without the chips moving. That is the deliberate part — see below — but it is
worth a re-sort the next time somebody is in here.

Ties are broken by hand: bakery before coffee before pub, cheap eats before
date night, and the two cuisines last, since somebody scanning the row is
usually after a kind of evening rather than a kind of kitchen. Laptop friendly
sits above Asian and Vegan on six places for the same reason — it is a kind of
afternoon, and the row reads better with the use cases together and the
kitchens at the end. It is the newest chip and the smallest, so it is the one
to watch: if it stays this short it belongs further right.

Nothing re-sorts itself as you add places, and that is deliberate: a row of
chips that rearranges between visits is a row nobody learns. Re-check it when
a type has visibly grown, and move the line in `taxonomy.json`.

## A filter never answers with an empty screen

A chip is a question about places, so the map is never allowed to answer it
with a square of blank tiles. Whenever a chip is pressed and **none of the
places it leaves are on the screen**, the map pulls back until some of them
are — the filtered set framed at city level, or the whole map if the chips
match nothing anywhere.

The screen means the strip of map you can actually see, measured in
`anyInView()` rather than off the map's full bounds: the panel covers the
bottom of a phone and the right of a desktop, and a pin behind it is not on
screen in any sense a visitor would accept. With the sheet dragged to full
height there is no strip left to judge, and nothing moves — there is no point
re-framing a map nobody is looking at.

This is mostly felt after **Show my location**. That used to drop you at zoom
15 wherever you were standing, which on the edge of town is a screen of
streets with no pin on it, and from there every chip you pressed answered with
the same empty view: the filter had worked, the list behind it had changed,
and the map said nothing. Now the locate button frames you together with the
nearest place the chips allow, so you land looking at somewhere you could walk
to, and the chips keep the map on their own places from then on.

Two edges are handled by hand:

- **Further than 25km from everything** — Helsinki, a plane, a bad reading —
  and there is no zoom that holds you and Tallinn at once without both
  becoming dots. The map shows the city instead, and the toast says why
  (`locateAway`). Your dot is still plotted, a pan away.
- **Closed places** are never the nearest thing to walk to. They stay grey
  pins on the map for the links pointing at them, but the locate framing skips
  them unless nothing open is left.

One Leaflet trap sits under all of this, in `travelTo()`. An animated
`setView` only works over short hops: hand it a target across the city and it
starts a zoom animation whose CSS transition never runs, so the call returns
with the map exactly where it began — silently, no error. Every move that the
current view does not already contain goes through `flyTo` instead, which
crosses the distance properly and draws the zoom-out-and-back-in the move
actually is. Under `prefers-reduced-motion` both become a jump.

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
reel** or **The video**, and the link under the player names the right app in
every language.

Both are plain iframes, and both are built with the panel. Instagram's player
lives at the permalink with `/embed/` on the end — the same frame its
`embed.js` would have built for you — so neither platform needs a script here.

**Never invent a shortcode.** A made-up one resolves to a real stranger's post, on either platform.
Leave `reel` as `""` until you have the actual link; the panel simply says
there is no reel yet.

### The player starts loading with the panel

It used to sit behind a **Load the reel** button, and nothing was fetched from
Instagram or TikTok until that button was pressed. It saved a request on every
place nobody watched and charged a wait to every place somebody did: open the
place, find the button, press it, and only then watch a player start from
nothing. Opening a profile is a deliberate act and the video is the reason for
it, so the player is now built with the panel: by the time the write-up has
been read the reel is loaded and often buffered, and pressing play plays.

The frame it sits in is sized by CSS, never by the iframe. A cross-origin frame
cannot be asked how tall it is and collapses to 150px if left to itself, which
is how a reel used to open as a strip with the video cut off at the bottom.
Instead the frame opens at `9 / 19` — 9:16 of video plus Instagram's own chrome
above and below it — and Instagram's embed page then posts its real height out
to the page that framed it (`wireReelMeasure` in `app.js` listens for the same
message `embed.js` does). That number is stored as the frame's ratio rather
than as pixels, so a phone turned on its side still holds a whole reel. If the
message never arrives the opening shape stands, and a frame slightly too tall
shows a band of card under the video where slightly too short would cut it off.

The frame also bleeds out through the panel's padding to the card edges, the
way the search box and the group headings do: 52px more picture on a desktop,
the full width of the screen on a phone, and since the ratio is fixed, a wider
frame is a taller one too.

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

The type labels go in **in all ten languages at once**, not the one the
switcher happens to be showing. Somebody reading the map in Turkish still types
"bakery" half the time, and somebody reading it in English may well know the
place as a *pagariäri*: `bakery`, `pagariäri`, `leipomo`, `padaria`, `пекарня`,
`çörəkxana`, `panadería`, `fırın` and `հացատուն` all return the same fourteen,
whichever language is on screen. Russian and Ukrainian happen to share the
word, which is why nine of them cover ten languages. The index is built once at
load, since none of what goes into it can change afterwards; folding sixty-nine
of these on every keystroke would be work for nothing.

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

When somewhere shuts down, set `"closed": true`. Nothing else about the entry
changes — the point of the whole exercise is that every `?spot=` link you ever
put in a Story keeps working. Deleting the entry breaks those links silently.

A shut place is two facts, not one, and the second is the reason it is still
here: **the door is closed, and the reel is not.** So it is marked in two
places rather than dimmed in one.

- **On the map** the pin keeps the collar that says what there is to watch —
  solid, hollow, hairline — in grey, the mark itself drains of colour, and it
  gains a **dashed ring** drawn just outside it. A closed place you can still
  watch a reel of is a full-collared mark inside a broken circle, which is both
  facts at once. Grey alone could not do that: it is also what a write-up-only
  place looks like from three streets away. The ring stays when the place is
  selected, and a selected closed pin no longer lights up the accent — the halo
  and the size say which one the panel belongs to.
- **In the list** the row carries a **Closed** badge next to the price, beside
  where a discount would sit, because the two of them are what you decide on
  rather than what you read. The badge carries the same broken ring at 9px, so
  the list doubles as the key to the map. The depth badge on the right keeps
  its accent: the name greys, the price greys, the **Call** button greys —
  everything that was about *going* — and what is left to look at stays lit.
- **In the panel** the flag over the name carries the ring too, and says it in
  full: **Closed for good**, not **Closed**. On a map of restaurants the bare
  word reads as *closed today*, which is the one thing this site refuses to
  claim — there is no opening-hours field, on purpose. Under it the note says
  what is left rather than only what is gone: the reel, the video or the
  photos, in each one's own word, or the "nothing was filmed inside" line when
  there is neither.

**Two lengths, one fact.** `closed` is the one-word badge — scanned down a
list, never read — and `closedFlag` is the full phrase, which has a line of
its own in the panel. They are separate strings because the full phrase does
not fit the badge: at `Cerrado para siempre` the types beside it wrapped to
three lines on a 390px screen. The notes are four more strings per language —
`closedNote` for a place with nothing filmed, and `closedReelNote` /
`closedVideoNote` / `closedPhotosNote`, picked by `closedNoteKey()`. Six
strings per language in all, and the wording is meant to sound like the rest
of the write-ups rather than like a database field.

Closed places are left out of everything that goes looking for somewhere to
eat. **Surprise me** never picks one — `randomPick()` filters `!p.closed` off
the visible set before it draws, so a shut place cannot come up however many
times you press it, and with every place filtered out the toast says so rather
than sending you to a closed door. The **Just added** section never lists one,
and the locate framing walks you to the nearest *open* place. They stay on the
map, and in the list, and at their own `?spot=` link — that is the whole point
— but nothing ever *suggests* them.

Five places in `data/restaurants.json` are marked closed today — Bueno Gourmet
Kadriorg, Cafe Cape Town, Laboratooriumi 23, Lendav Maaler and Maison
François. All five have a reel, so all five get `closedReelNote`.

Do not write the closure into the `blurb` as well. The panel says it in every
language already, and Laboratooriumi 23 used to end with "Sadly closed now,
but the video stays up" directly under a note that said the same thing.

---

## Languages

Azerbaijani, Armenian, English, Estonian, Finnish, Portuguese, Russian,
Spanish, Turkish and Ukrainian — the switcher shows them in that order,
Azerbaijani first and the rest alphabetical. The order of the blocks in
`ui.json` is the order of the buttons; the language a visitor *lands* in is a
separate thing, still English by default, and set by `DEFAULT_LANG` in
`assets/app.js`.

The switch has two shapes, from the same markup. Wide enough, it is a row of
codes. On a phone it folds into the current code with a menu under it, listing
each language's own name for itself: ten codes side by side are around 390px,
which is the whole of a 390px screen, handle in the opposite corner and all.
The fold happens in CSS at 860px, and the folded menu grows downwards, so the
next language costs nothing in layout either. Every interface string is
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
order of the blocks in `ui.json` does not matter: the switch sorts the
languages alphabetically by code, so a new one lands in its place on its own.

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

## Restaurant discounts

A few places give readers of this map something off the bill. Which ones, and
whether the offer is switched on at all, lives in `data/deals.json` — a place
with nothing in that file is exactly the place it was before any of this
existed.

### How it works at the table

1. A guest opens a place on the map and presses **Get the discount**.
2. `deal.html` shows them a QR, the same code in large type, and a countdown.
   The countdown is in the accent colour with a dot beating beside it, twice
   the size of the small print around it — a picture of the page has frozen
   digits and a frozen dot, so a waiter can tell a live pass from a
   screenshot without checking anything.
3. A waiter points their ordinary camera app at it — no app to install, no
   account, no training.
4. `verify.html` opens on the waiter's phone and fills the screen green with
   **VALID**, or red with the reason it is not.

The code is rebuilt every hour:

```
hour = floor(now / one hour)
code = HMAC-SHA256(the deal's key, "<place-id>:<hour>")   first 25 bits, base 32
```

The hour travels inside the QR next to the code, so the verifier checks the
hour the guest actually claimed. It accepts the hour before and the hour after
as well as the current one — that is what makes it usable in a room where a
waiter takes six minutes to reach a table and neither phone has a perfect
clock. A screenshot is therefore worth two or three hours, not forever, which
is the whole point of the rotation.

### The three addresses

Replace `<place-id>` with the `id` from `restaurants.json` — the same slug
`?spot=` uses.

| Who | Address | How they get there |
| --- | --- | --- |
| Guest | `/deal.html?r=<place-id>` | The **Get the discount** button on the place's panel |
| Waiter | `/verify.html?r=…&h=…&c=…` | Scanning the guest's QR. Never typed by hand |
| Counter | `/staff.html?r=<place-id>` | **You send this link to the restaurant once.** They bookmark it |

So the staff URL to hand over is, in full:

```
https://tallinntastebuds.ee/staff.html?r=bekker-pagariari
```

`staff.html` shows the code the guest's screen is showing right now, plus the
previous hour's, which is also accepted. It is the fallback for the evenings
when the camera will not focus, the guest's screen is cracked, or the cellar
has no signal to load `verify.html` on. Comparing five characters by eye is
slower than scanning and quite a lot faster than turning a guest away.

None of the three pages is linked from anywhere except that one button, none
is in the sitemap, and all three carry `noindex` in the markup and in
`_headers`.

### Where a discount shows up

A place with a live deal says so in three places, in the order you meet them:

1. **In its list row**, next to the price — a small outlined pill reading
   **−15%**, so the offer is part of the choosing rather than something you
   only find by opening the place.
2. **In the panel head**, the same pill beside the same price, one size up.
   The number is what you decide on, so it sits where the deciding happens.
3. **In the panel**, under the reel, the write-up and the tags, and directly
   above **Must order**: the offer in words — "15% off your order" — and the
   **Show QR** button that leaves for `deal.html`. A discount is part of
   deciding where to eat, so it reads with the rest of the deciding rather
   than after the dish list you skim on the way out. It stays below the reel
   and the photos all the same — a pass you hold up at a till has no business
   in front of somebody who has not seen the place yet.

The number is not written a second time in the data. It is taken from the
`offer` line the deal already carries in the language being read, which is why
Turkish shows **−%15** — the whole match travels, sign and all, rather than
the digits. An offer with no percentage in it, a free coffee or a second
pizza, falls back to the word the filter chip uses: **Discount**.

The badge is drawn, so it is also spelled: the row's own `aria-label` ends
with the full offer — "Open Pudel, Not filmed, 10% off your order" — because
"−10%" read out on its own is a number and not what it comes off.

### The Discount chip

The filter row grows one chip when any place has a live deal, sitting first
among the filters, right after **All**. It reads `data/deals.json` rather than
a place's `types`, so it is the one chip that is not a taxonomy entry — `tools/validate.mjs`
refuses a taxonomy type that tries to claim the id `discount`, since two chips
answering to one name would filter each other's places out.

With no live deal anywhere the chip is not drawn at all, which is the state the
site sat in before Magussoolane.

Narrowing to a **single** place moves the map onto it, at zoom 15 or closer.
That is not special to discounts — any filter that leaves one place does it,
because leaving the map where it was makes you hunt for the one pin still
lit. The place is not opened: the filter said where, not read me. Leaving
several, none of which are on screen, moves the map too — see
[A filter never answers with an empty screen](#a-filter-never-answers-with-an-empty-screen).

`?type=discount` works as a link, and combines with the rest: `?type=discount,bakery`
is either.

### Switching one on

Add an entry to `data/deals.json`:

```json
{
  "id": "bekker-pagariari",
  "live": true,
  "key": "PR3S960YQP1RZ4HR74H5ABSBBZ3XNMCV",
  "offer": { "en": "10% off the bill", "et": "10% arvest" },
  "terms": { "en": "One per table.", "et": "Üks laua kohta." },
  "from": "2026-09-01",
  "until": "2026-12-31"
}
```

| Field | |
| --- | --- |
| `id` | Must be a place in `restaurants.json` |
| `live` | `false` keeps it invisible on the map while remaining testable by URL |
| `key` | 16–64 characters of `0-9 A-Z`, no `I L O U`. **Different for every place** |
| `offer` | Translations, like `blurb`. A live deal must have `en` at minimum |
| `terms` | Optional small print |
| `from`, `until` | Optional, inclusive. Outside them the button disappears |

Generate a key with:

```bash
node -e "const A='0123456789ABCDEFGHJKMNPQRSTVWXYZ';console.log([...require('crypto').randomBytes(32)].map(x=>A[x%32]).join('').slice(0,32))"
```

Then `node tools/validate.mjs`. It refuses a deal pointing at a place that does
not exist, two deals sharing a key, and anything switched `live` with no words
in it. The summary line ends with a live-deal count, so CI tells you what is
switched on.

### Testing before anything is public

Leave `live` at `false` and open the pages by hand. They work in full; the
guest and verify pages both show a dashed **preview** band so a dormant deal
can never be mistaken for a real one. Nothing on the map changes, and nobody
who has not been given the URL can find them.

`crypto.subtle` only exists in a secure context, so `file://` will not do —
use the local server from [Run it locally](#run-it-locally). `localhost`
counts as secure.

### What this is not

There is no server here. **The deal keys ship inside `data/deals.json`, which
is a public file on a public site, and anyone who opens it can mint codes all
day.** That is a deliberate trade rather than an oversight: the thing an
hourly code defends against is a screenshot going round a group chat, and it
does that completely. What it cannot do is stop someone determined, or stop
the same guest redeeming twice at two tables — a human seeing them is the only
control there.

If a discount ever starts costing real money, the upgrade is small and this
repo is already set up for it. Add `functions/api/verify.js`; Cloudflare Pages
picks up a `functions/` directory on the deploy you already have. The key
moves server-side, a KV write makes each code single-use, and only
`assets/verify.js` changes — swap the local HMAC for a `fetch`. Roughly fifty
lines, and the guest-facing half stays exactly as it is.

---

## Stories

The one thing on this map that is not permanent. Everything else here is a
place that will still be there next year; a story is a video — or a
photograph — that is up for **a day and a half** and then is gone, which is
the whole reason anybody opens one now rather than later.

It can be written today and go up on Saturday, and the photograph in it does
not disappear when the story does: it moves onto the place it was taken at and
joins that place's photos. So the story is the moment, and the picture stays.

When something is up, the mark in the top left grows a turning ring — the same
ring, in the site's own brick and ember, that every profile picture wears when
there is something new behind it. Press it and the video — or the photograph;
a story is either — fills the screen: a bar along the top per story, who it is
from, **how long it has left**, the caption, and a link. The left third of the screen goes back, the rest goes on,
holding stops it, swiping down leaves. All of it is
[`data/stories.json`](data/stories.json) plus a file in
[`stories/`](stories/README.md), and with nothing live there is no ring, no
viewer and nothing else on the page changes.

### Post one

Drop the video in `stories/` — see [stories/README.md](stories/README.md) for
the size and the one `ffmpeg` line that gets it there — and add an entry:

```json
[
  {
    "id": "kokomo-brunch",
    "live": true,
    "video": "kokomo-brunch.mp4",
    "poster": "kokomo-brunch.jpg",
    "until": "2026-09-15T21:00",
    "caption": {
      "en": "Sunday brunch at Kokomo. The last table goes at noon.",
      "et": "Pühapäevane brunch Kokomos. Viimane laud läheb keskpäeval."
    },
    "spot": "kokomo"
  }
]
```

| Field | | What it is |
| --- | --- | --- |
| `id` | required | Lowercase slug. It is what a browser remembers as watched, and what `?story=` points at. |
| `live` | required | `false` parks a draft in the file with nothing on screen. Nothing about it is shown until this is `true`. |
| `video` | one or the other | A filename inside `stories/`, never a path. `.mp4` unless you have a reason. |
| `photo` | one or the other | An image filename inside `stories/`, for a story that is a picture rather than a film. |
| `seconds` | optional | How long a **photo** stands there. 6 by default, 2 to 20 allowed. A video has a length of its own, so this does nothing to one. |
| `poster` | optional | An image filename inside `stories/`, shown for the moment before the **video** has enough of itself to play. |
| `from` | one of the two | When it goes up. Leave it out and it is up the moment `live` is `true`. |
| `until` | one of the two | When it goes. Leave it out and it is **36 hours after `from`**, which is the usual way to write one. |
| `caption` | optional | A line under the video, per language, exactly like a `blurb`. |
| `spot` | optional | A place id from `restaurants.json`. The button under the video opens that place on this map. |
| `link` | optional | A full `https://` address instead. Opens in a new tab. |
| `linkLabel` | optional | What the button says, per language. Without it a `spot` reads "See Kokomo" and a `link` reads "Open the link". |

An entry needs a `from` or an `until` between them, because a story that never
goes away is not a story. Almost always that is a `from`: say when it goes up
and the 36 hours take care of the rest.

A story is a `video` or a `photo` — one of them, never both and never neither.
A photograph runs on the viewer's own clock instead of the file's: the bar
along the top is the only thing saying how long is left, it holds still when
you hold the screen, and it steps on by itself at the end. Nothing else about
it differs, except that there is no sound button on something with no sound.

`spot` and `link` are one field's worth of intent between them, so an entry
carries one or the other, never both. An entry with neither is a video with no
button, which is a perfectly good story.

### Post it on Saturday

A story does not have to be written at the moment it goes up. Put the file in
`stories/`, say which day it is for, and walk away:

```bash
node tools/stories.mjs --schedule kokomo-brunch.webp \
                       --spot kokomo \
                       --at 2026-09-14T09:00 \
                       --caption "Sunday brunch at Kokomo. The last table goes at noon."
```

That writes the entry — `live: true`, `from: 2026-09-14T09:00`, no `until`,
because 36 hours is the answer — and nothing else happens. It is a normal
entry; write it by hand if you would rather. Open `data/stories.json`
afterwards to fill in the caption in the other languages.

**Nothing is deployed on Saturday morning.** The file went up the day you
committed it, and `assets/app.js` reads the same `from` you wrote and starts
the story on the minute, in whoever's browser is looking — `data/*` is served
`must-revalidate`, so a phone opening the map at 09:01 asks the origin and
gets a story that was sitting there all week. That is the whole reason the
time lives in the file rather than in a queue somewhere: there is nothing to
be awake for, and nothing to go wrong at nine in the morning.

To see where everything stands:

```bash
node tools/stories.mjs
```

```
UP NOW
  pulla-bakery-cinnamon-bun        video pulla-bakery-cinnamon-bun.mp4 -> pulla-bakery
                                   until 2026-09-02 21:00, 1d 4h left  (36h window)

QUEUED
  kokomo-brunch                    photo kokomo-brunch.webp -> kokomo
                                   goes up 2026-09-14 09:00, comes down 2026-09-15 21:00  (36h window)
```

### And the cron picks it up afterwards

[`.github/workflows/stories.yml`](.github/workflows/stories.yml) runs
`node tools/stories.mjs --tick` on the hour. It is not what makes a story
appear — the browser did that already, on the minute, with nobody awake. It is
what happens **once the 36 hours are over**, which is the part a person
forgets:

- A **photograph with a `spot`** moves into `photos/<spot>/`, numbered like
  every other photo there, and is listed on the place. The entry and the file
  in `stories/` go with it. The story expires; the picture becomes one of that
  restaurant's photos, and is in the lightbox from then on.
- **Anything else** — a video, or a photograph of nothing in particular — is
  switched to `live: false` and left exactly where it is. Deleting somebody's
  video is somebody's decision, not a cron job's.

Then it commits, and asks the Cloudflare workflow to publish, so the site
catches up within the hour. On an hour with nothing due it touches nothing and
writes no commit, which is almost every hour.

You can run the same thing yourself, and look before you leap:

```bash
node tools/stories.mjs --tick --dry-run    # say what would happen
node tools/stories.mjs --tick              # do it
```

> GitHub stops scheduled workflows in a repository that has had no activity for
> 60 days, and says so in the Actions tab. If stories ever stop clearing
> themselves, that is the first thing to check — one push starts it again.

### The clock

`from` and `until` are **Tallinn wall clock**, written `YYYY-MM-DDTHH:MM`:
`2026-09-15T21:00` is nine in the evening in Tallinn, in September, whatever
your own laptop's clock is set to. That is the only clock you and the person
watching are both reading. Summer time is worked out for you, so there is no
offset to write and no offset to get wrong.

The countdown under the name says `1d left`, then `18h left`, then `44m left`,
then `Going now` — the same ladder a phone uses, because past a point the
exact number stops being the point. The moment the end passes, the story stops
being shown: the ring goes, the viewer will not open it, and a `?story=` link
to it lands on the plain map instead. Nothing has to be edited for that to
happen, which is what makes this safe to post at midnight and forget.

**Every story gets 36 hours.** A day and a half is long enough that somebody
who only opens the map in the evening still catches a thing posted that
morning, and short enough that the countdown is a reason to look now rather
than later. It is 36 *real* hours, so a story that runs over the night the
clocks change is still 36 hours of somebody's life rather than 35 of them.

Write an `until` and you get exactly that instead — but if it comes out past
two days the validator will say so, gently, and it is usually right. If a
video is still worth watching next week, it is not a story: it is a `reel` on
the place itself.

### Watched, and posting again

A browser remembers which stories it has watched, and the ring stops turning
and goes grey once they all have been. It remembers the `id` **and** the times
written next to it, so reposting under the same id with a new `from` lights the
ring again for everybody — which is what reposting means. Nothing is sent
anywhere: it is one entry in that browser's own storage, and it is thrown away
as each story runs out.

### Linking to one

`?story=kokomo-brunch` opens the map with that story already playing — the
link to put in a post, in a bio, or in an actual Instagram story pointing back
here. It works while the video is up and lands on the plain map once it is
not, and the parameter is taken off the address bar on the way in, so nothing
copied out of it later reopens a video that has since gone.

The button inside a story is the other half of that trade: `"spot": "kokomo"`
lands on the place with its pin already open, without the page being loaded
twice, because the map was underneath the whole time.

### Sound, and not being annoying

**A story opens muted.** Pressing a ring on a map is not asking a laptop to
start talking, and that is exactly what a phone's browser would have refused to
do anyway — so the desktop behaves like the phone everybody already knows.
The speaker button in the corner turns it on, and that choice is remembered
from then on, on every story after it.

So **burn any words that matter into the video, or write them in `caption`**:
the first play is silent, and on a second visit it is silent again unless the
speaker has been pressed.

Nothing else about a story asks for attention either. It never opens itself,
it never plays behind the map, and nothing on the page moves except the ring —
which stops turning the moment the last story has been watched. On a desktop
the story is a card with the map showing around it, and clicking the map
around it closes it, the same as the photo lightbox; a mouse gets a chevron
under it on each side, since the tap halves a thumb knows about are invisible
to a pointer.

### Taking one down

Nothing needs taking down. The clock does it, and the cron tidies up after the
clock: a photograph of a place ends up on that place, and everything else is
switched off and left for you. Once a video has been gone for a while, delete
its entry and the file together — the repo does not need to carry every video
ever posted, and the validator says so, gently, about a file in `stories/`
that no entry names.

To pull something down early, set `live` to `false`, or take the entry out
altogether. Both are immediate for anybody who loads the map after it, which
is everybody: nothing about a story is cached beyond the page it is on.

---

## The admin page

`/admin.html` — a door, and behind it the tools for posting without opening a
terminal. It is not linked from anywhere, carries `noindex` in the markup, in
`robots.txt` and in `_headers`, and is served `no-store`.

Behind it, two tabs, and they reach the repository by different roads.

**Post a story** commits straight to the branch the site publishes from. A
story is a thing happening now, and one that waits for a review has missed the
morning it was about. It is also the cheap kind of mistake: four lines of JSON
that take themselves down after 36 hours.

**Add a place** opens a **pull request**. A place is permanent, it is the file
the whole map is drawn from, and it has coordinates that can land on the wrong
side of the street. So it waits to be read — and waits for the validator, which
is the difference between seeing the verdict before it is live and after.

### Setting up a device

Once per device, per browser. Do the laptop first — Chrome will sync the
passphrase to the phone, so the phone only needs the token pasted.

1. Make a **fine-grained** personal access token on
   [GitHub](https://github.com/settings/personal-access-tokens/new).
2. Repository access: **only select repositories** → `tallinntastebuds`.
3. Permissions: **Contents → Read and write**, and **Pull requests → Read and
   write** for when adding a place lands.
4. Expiry: **90 days.** A token you forget about then dies on its own.
5. Open `/admin.html`, paste the token, choose a passphrase.

On an **iPhone**, add the page to the Home Screen. Safari — and Chrome on
iOS, which is Safari underneath — clears a site's storage after seven days
without a visit, and an installed web app is exempt. On Android nothing needs
doing; the page asks for persistent storage itself.

### Posting a story

Four fields and a button. What happens when you press it:

1. The photograph is **shrunk on the device** — see
   [What it does to a photograph](#what-it-does-to-a-photograph) below.
2. The picture is committed to `stories/`, **then** the entry to
   `data/stories.json` — that order, so a story naming a file that is not
   there is never in the repository even for one commit.
3. Cloudflare redeploys. The ring appears by itself when `from` comes round;
   nothing has to be deployed at nine in the morning, because the file was
   already there.

The id is the place and the day — `kokomo-2026-09-14` — and a second story for
the same place on the same day gets a `-2`. No `until` is written: the 36 hours
do it.

**The time is Tallinn's**, not the phone's, so the current Tallinn clock is
printed under the field to check against. Only English is asked for; it is the
fallback every other language uses, and the rest can be filled in from a laptop
later without the story coming down.

**Videos are still a laptop job.** A browser cannot transcode one, and an
untouched phone video is 50 MB of HEVC that no browser but Safari will play —
see [stories/README.md](stories/README.md) for the `ffmpeg` line.

### Adding a place

The same form the data needs: name, address, coordinates, price, types, the
English write-up, must-orders one to a line, and as many photographs as you
like. The id is made from the name — `Põhja Pagar` becomes `pohja-pagar` — and
**I am here** fills the coordinates from the phone's own position, which is the
one thing easier standing in the door than sitting at a laptop.

Everything `tools/validate.mjs` would fail the build over is checked before the
branch exists, in the same words: the slug, the Tallinn bounding box that
catches a swapped `lat`/`lng`, the reel permalink shape, the phone's
international form. So a pull request this opens is a pull request that goes
green.

Then, in this order: a branch `admin/add-<id>`, the photographs, the entry,
and the pull request last — so a failure part-way leaves a branch nobody is
looking at rather than a half-written pull request. The entry is **slotted into
the file in name order under Estonian collation**, which is why Põhja Konn sits
after Pulla and not before it, and which keeps the diff to the lines that
actually changed.

What it cannot do is the other nine languages. The write-up goes in in English,
the validator warns rather than fails, and the pull request says so — merge it
and finish it from a laptop.

### What it does to a photograph

Every photograph either tab uploads goes through the same squeeze, on the
device, before a byte of it leaves:

- **1600px on the long edge**, WebP at quality 72, dropping to 1400, 1200 and
  then 1100 as the quality steps down to 58 — until it comes in **under
  200 KB**. Edge first and quality second, the order
  [photos/README.md](photos/README.md) argues for, because a frame full of
  leaves is the expensive one and dropping the edge hides better.
- **The EXIF block goes with the re-encode**, and the GPS fix inside it with
  that. Same as pasting onto a fresh canvas in the Pillow recipe — a side
  effect there and a side effect here, and the one that matters most, because
  these files are public and permanent.

The budget is 200 KB rather than the 300 that recipe allows by hand. A
photograph posted from a phone is one nobody sized deliberately, and those are
the ones that pile up; a file committed here is in the history for good. Both
numbers are `SHRINK_STEPS` and `PHOTO_BUDGET` at the top of the script in
`admin.html`, and nothing else depends on them.

A 4 MB phone photograph comes out somewhere near 150 KB. The form prints what
went in and what came out, so you can see it happen.

### Where the token lives

In that browser's `localStorage`, encrypted:

```
{ salt, iv, ct }     AES-GCM, key from PBKDF2-SHA256 over the passphrase
```

Nowhere else. Not in this repository, not on the server — there is no server.
The decrypted token exists only as a variable in the open tab, is never
written to disk, and is dropped when the tab closes or after fifteen idle
minutes.

**Nothing is published for a guess to be checked against.** The obvious design
puts a verifier — a hash of the passphrase — in the repo so the page can tell
a right passphrase from a wrong one. That is a free offline oracle: anybody
who clones a public site can grind guesses at it forever without ever touching
your phone. AES-GCM already answers the question. A wrong passphrase derives a
wrong key, the tag fails to authenticate, and the decrypt rejects — so an
attacker needs the device in their hand before they can begin.

### If a device goes missing

Revoke that device's token on GitHub. One click, and it does not touch the
other device, because each holds its own token sealed with its own salt.

What a thief has in the meantime is the encrypted blob, which is worth nothing
without the passphrase — so make the passphrase long. And the floor under all
of it: the token reaches one public repository, every change is in git
history, and a branch rule against force-pushes keeps the history you would
revert from.

**The gate is not what stops somebody editing the map — the token is.** Anyone
can read `admin.html` and skip the passphrase; they still have no token, and
the page can do nothing without one. The passphrase protects the token at rest
on the device. That is the whole of its job.

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
file. Everything revalidates instead of being cached hard: browsers still get a
fast `304 Not Modified` when nothing changed, but an edit to
`restaurants.json` appears on the next load rather than whenever a cache feels
like expiring. Photos and story videos are the exception and are held for a
week, since both are replaced rather than edited — and a story video is the
largest thing on the site and the one most likely to be watched twice.

### Cache stamps

Every script and stylesheet is referenced from the HTML with a short hash of
its own contents on the end:

```html
<script src="assets/app.js?v=91af6fb0" defer></script>
```

`node tools/stamp.mjs` writes those hashes, `node tools/validate.mjs` fails the
build on a stale one, and CI runs the validator before every deploy — so a
changed file always reaches visitors under a URL no browser has ever seen, and
no browser can answer for it out of its own cache.

That is not belt and braces. The pages are not independent: `assets/app.js`
reads `data/restaurants.json`, so a browser holding yesterday's script against
today's data runs code written for a shape the data no longer has. It happened.
Half-step prices landed in the data and in the script on the same deploy, and
every phone still holding the previous script hit `new Array(2.5 + 1)` —
`RangeError: Invalid array length` — which took down the boot chain and put the
"something went wrong loading the data" card over a map that had already drawn
itself. A fresh private window worked, the window they had been using did not,
and reloading changed nothing, because reloading asked for the same URL again.
The revalidation headers above are a request; the stamp is not.

Data files are deliberately **not** stamped. They are the files you edit every
week, and they have to go live the moment they are pushed without anybody
remembering to run a tool.

There is deliberately **no Content-Security-Policy**. Getting one right here
means allowlisting unpkg, Google Fonts, CARTO, Instagram, TikTok and Google
Analytics, and a CSP that is subtly wrong fails silently and breaks embeds
years later. That trade is not worth it for a public map with no logins and no
user input.

### The custom domain

The site lives at **`tallinntastebuds.ee`**. Free hosting stays free with your
own domain attached; the only cost is the name itself, around €10–15 a year.

`.ee` is open to anyone — there is no residency requirement — but it is sold
only through a registrar accredited by the Estonian Internet Foundation, and
registration needs a digitally signed application and an identified
administrative contact. Cloudflare Registrar does not carry `.ee`, so the name
is registered with an Estonian registrar while Cloudflare runs the DNS.

Two steps, in this order:

1. **Nameservers.** Point the domain at the two nameservers Cloudflare gives
   you when the site is added to the account. Cloudflare's CNAME flattening is
   what lets the bare apex resolve to Pages at all — a registrar's own DNS
   panel usually cannot put a CNAME on an apex.
2. **Custom domains.** Add the domain under the Pages project's **Custom
   domains** tab. Cloudflare issues the certificate automatically.

Four lines in the repo name the host — see [Getting found](#getting-found).
Nothing else needs touching: every path in the site is relative, and the
scripts build absolute URLs from `window.location.origin`, so the QR codes and
share links follow whatever host serves them.

`tallinntastebuds.pages.dev` keeps serving the same site after the custom
domain is attached, which splits the SEO between two hosts. A Cloudflare
redirect rule from `tallinntastebuds.pages.dev/*` to the custom domain, 301,
settles it.

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
- a `price` outside 1–4 or off the 0.5 step, a malformed `visited` month, a
  malformed `website`
- a `phone` that is not in international form — `+372 661 0180`, not `6610180`
- a malformed `added` date — it has to be `YYYY-MM-DD`
- a story with neither a `from` nor an `until`, an `until` before its `from`,
  neither a `video` nor a `photo` (or both), a file that is not in `stories/`,
  a `seconds` outside 2–20, a `spot` that is not a place, or both a `spot` and
  a `link`
- a `?v=` cache stamp in the HTML that no longer matches the file it points at
  (run `node tools/stamp.mjs` and commit the result)

**It warns, without failing, on:**

- blurbs that still contain `TODO` or `PLACEHOLDER`
- places with no reel yet
- places with no `added` date
- open places with no `phone`, so there is nothing to call
- blurbs missing a translation
- taxonomy types nothing uses
- folders in `photos/` that no place points at
- unknown keys on a place object (this is how you catch `blrub`)
- a story left `live` after its time ran out — `node tools/stories.mjs --tick`
  is what files it away
- a story given an `until` that has it standing for more than two days, when
  every story gets 36 hours by leaving `until` out
- a file in `stories/` that no story in `data/stories.json` names
- a `seconds` on a video or a `poster` on a photo, neither of which does
  anything

---

## Files

```
index.html                 the whole page
assets/styles.css          design tokens at the top, then everything else
assets/app.js              map, panel, filters, i18n, lightbox — no framework
deal.html                  the guest's discount pass          } all three are
verify.html                what a waiter sees after scanning  } unlinked and
staff.html                 the current code, for the counter  } noindex
assets/pass.js             hourly code, shared by those three and the map
assets/pass.css            styles for those three
assets/qr.js              QR encoder, written out, no dependency
assets/logo/               the mark, and the painting it came out of
assets/deal.js             ) one small script
assets/verify.js           ) per page
assets/staff.js            )
data/restaurants.json      the only file you edit regularly
data/taxonomy.json         the controlled vocabulary of types
data/ui.json               every interface string, in every language
data/deals.json            the discounts, and which of them are live
data/stories.json          the stories, when each goes up and when it goes away
data/schema.json           JSON Schema, for editor autocomplete
admin.html                 the admin door, self-contained and unlinked
photos/<restaurant-id>/    photos, one folder per place
stories/                   the story videos and photos, one file each
tools/validate.mjs         dependency-free data validator
tools/stamp.mjs            writes the ?v= content hash on every asset URL
tools/clock.mjs            Tallinn wall clock, and the 36 hours a story stands
tools/stories.mjs          the story queue: what is up, schedule one, tick
.github/workflows/validate.yml
.github/workflows/stories.yml   the hourly tick, and the tidying up after it
```

Deep links: `?spot=f-hoone` opens that place directly — that is the link to put
in a Story. `?lang=ru` opens it in Russian, `?style=green` in the dark
palette. They all combine. `?story=kokomo-brunch` is the odd one out: it opens
a story rather than a place, and takes itself back out of the address bar.

---

## The mark

The logo is a mouth: the one in the watercolour-and-ink portrait that sits in
the repository as `assets/logo/source-artwork.jpg`, cropped out of the
photograph of it and used exactly as painted. It is not a drawing *of* the
painting, and there is no drawing of it anywhere — nothing is masked out,
smoothed or traced. The olive teeth, the red in the gap, the place where the
pen went twice round the lower lip: those are the mark, and they are the whole
reason not to redraw it.

Of everything in that picture the mouth was the part worth keeping. It is the
only bit of it that is about tasting something, and it is the bit that survives
being small.

There are two crops of it and eight files, all of them a resize of one crop or
the other: a wide one for the three pass pages and the share card, and a square
one for the brand, the favicon, the home-screen icon and the map. The boxes are
written down in `assets/logo/README.md`, so a new size is a re-render rather
than a redraw.

The favicon sizes are the ones Google will accept — square, at a multiple of
48 — plus `/favicon.ico` at the root of the site, which is where Google looks
when it cannot read a page's link tags. The pages used to lead with a 32px
icon, which Google refuses, so a search for the site came back with the grey
globe instead of the mouth. Google re-crawls favicons on its own schedule;
there is no way to make it look sooner.

On the map it *is* the pin. Every place is the mouth, cropped round, drawn at
22px — 34px for the one whose panel is open, and 17px for the quietest of them.
It used to go on the chosen pin alone, over a circle, on the reasoning that a
picture inside a 14px dot is mud. That was true of a 14px dot. At 22px the
crop reads, and the map stops being seventy anonymous circles with one
photograph parked among them.

The circle is not gone, it is *reserved*: the only plain dot left on the map is
the one that says where you are. Nothing else can be mistaken for it now, which
is more than the old `--here` hue was doing on its own.

What the circle used to carry, the collar round the mark carries instead — the
picture is the same on every pin, so the three readings have to live somewhere
else:

| The place has | The pin |
| --- | --- |
| a reel or a video | full size, a solid collar in the accent |
| photos | full size, a paper gap and then an accent hairline — hollow |
| the write-up only | smaller and quieter, a hairline collar |

Filmed, photographed and write-up-only are still told apart at a glance, and
still by silhouette rather than by half a shade of fill. The chosen place keeps
whichever of the three it is and grows; a closed one keeps the muted tone, and
its mark goes grey inside the dashed ring that already says so.

The icon Leaflet anchors is a fixed 46px square, so a pin resizes without the
anchor moving under it, and the square takes no pointer at all — only the mark
inside it does. A tap lands on the picture you can see and never on the empty
corners around it.

---

## The two styles

One swatch sits on the left rail: brick and forest, day and night. Pressing it
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

**One button, not two.** There were two swatches, and with only two styles one
of them was always the one you were already looking at — a control that did
nothing, sitting next to the one that did. What is left is a single button
showing the side you are *not* on: the dark swatch to go dark, the light one to
come back. It is written against `STYLES` rather than against the two ids, so
it is still a switch if a third palette ever turns up.

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
    "tr": { "name": "Joy Türk Rock", "url": "https://playerservices.streamtheworld.com/api/livestream-redirect/JOYTURK_ROCK.mp3" },
    "uk": { "name": "ROKS Ukr Rock", "url": "https://online.radioroks.ua/RadioROKS_Ukr" }
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

Prefer the station's own address over a rebroadcast of it. Baku Retro FM, YleX,
Radio Paradise and Radio ROKS are all on their broadcaster's own host, which is
why those four lines are the shortest in the file. A mirror on an aggregator's
CDN is a lower bitrate, one remove from the station, and free to drop it
whenever it likes.

Ukrainian is on a channel rather than a main feed. Radio ROKS runs several
alongside the broadcast one, and `RadioROKS_Ukr` is the Ukrainian rock stream:
Okean Elzy, Skryabin, Druha Rika, Bumboks, Vopli Vidopliassova and the rest of
it, all day, which is a better answer to somebody reading the map in Ukrainian
than the main feed's Western rock. The other channels on the same host are
`RadioROKS_ClassicRock`, `RadioROKS_NewRock`, `RadioROKS_HardnHeavy` and
`RadioROKS_Ballads`, if the taste of the map ever changes.

Armenian is jazz, which is less of a stretch than it sounds: Yerevan has had a
jazz scene since Malkhas, and Jazz FM 95.3 is the station on the end of it.
The button reads the frequency rather than the city, which is the same trim
Radio ROKS took: 18ch, and "Jazz FM Yerevan" ran into the ellipsis.
`am.radioaurora.am` is Radio Aurora's own host and it carries several Yerevan
stations off the one Icecast, `/jz` among them, so this is the broadcaster's
address rather than an aggregator's copy of it. Kiss FM 88.3 is `/kiss.aac` on
the same host and Aurora itself is `/al.mp3`, if the taste of the map ever
changes.

101.ru's Armenia channel is the one to avoid. It is the easiest Armenian music
stream to find and it fails twice over: a Russian aggregator's rebroadcast
rather than a station, and one remove from the country whose slot it would be
sitting in.

This entry is the only one in the file nobody has listened to before committing
it. It came out of a mirror of the radio-browser database rather than a
browser, because the session that added Armenian could not reach a single radio
host to play one. If the button ever toasts instead of playing, that is why,
and the two mounts above are the first things to try.

Azerbaijani wants retro **in Azerbaijani**, which is two conditions and not one,
and the slot took several wrong stations before it took this one. A station
licensed in Baku says nothing about the language coming out of it: Vintage Radio
Azerbaijan is golden oldies — fifties to nineties pop, rock and roll, disco — on
a host it shares with a Russian trucker station. Correct country, wrong music.
Read a directory's country tag as an address, never as a format.

The rest went in on station names attached to URLs in scraped indexes, and those
names are annotations rather than facts: one Zeno mount in the lists carries six
different station names, and two Asura ports labelled with Azerbaijani stations
play English-language music. A name in an index is somebody's guess. A hostname
is evidence, and what comes out of the speaker is the only proof.

Which is how the slot ended up with the station it wanted from the start. Baku
Retro FM, 93.3 in Baku, publishes `https://stream.bakuradioalliance.az/retrofm`
— its own network's domain, TLS, and a mount named after the station. Every
aggregator points instead at `http://5.191.241.101:8000/bakuretrofm`, the same
box that serves the network's AVTOFM and Baku Hit FM; that address is plain
HTTP, so the browser blocks it as mixed content and Android blocks it as
cleartext, and the sites that appear to play it are proxying that mount over
their own HTTPS. The station's own address was one DNS name away from the one
every index copies from the last.

That host has been slow to answer at least once. If it stops for good,
`icecast.livetv.az` is Cloudflare-fronted and carries several Azerbaijani
broadcasters under mounts their own operators named — `antennfm` for local music
and Top 40, `mediafm` for pop, `yurdfm` for folk and ashug, `mediamugam` for
mugham — which is the rare place where the name on a stream URL was written by
somebody who owns the station.

The `name` is what the button says, and the button holds 18ch before it starts
eating the end of it, so the station's full name for the channel is shortened
to `ROKS Ukr Rock` rather than shown as `RADIO ROKS UK…`, which reads like a
language code rather than a station. `Baku Retro FM` is the station's own name
and fits with room to spare.

Reach for a mirror only once the official address has actually failed **in a
browser**. Scraped stream indexes disagree with each other about that address
and a link checker can call it dead from the wrong country or over the wrong
TLS; neither is the test that counts. Pressing the button is.

## Surprise me

The button under the colour switch on the left rail picks a place at random and
opens it.

It picks from **whatever the chips currently allow**, so selecting "Korean" and
"Cheap eats" and then pressing it answers the question you were actually
asking. Closed places are never suggested, and the same place is never returned
twice in a row.

It lives on the left rail rather than in the bottom filter row because the
filter row scrolls sideways once the vocabulary is wide, and a button that
scrolls out of reach is no use. On a phone it collapses to just the die.

Under it, at the foot of the rail, is the locate button, which frames you
together with the nearest place rather than dropping you at zoom 15 on
whatever street you are standing in —
[A filter never answers with an empty screen](#a-filter-never-answers-with-an-empty-screen)
has the rest of it. It used to sit in the
far bottom-left corner — the free one, but also as far from every other map
control as the screen allows, so a thumb that had just pressed Surprise me had
the length of the page to travel. It takes the rail's round shape so it reads
as one of its buttons rather than as a stray card parked beneath them.

The rail is vertically centred, and `placeRail()` in `assets/app.js` nudges it
down on short windows so it can never ride up under the brand card — never so
far down that its own foot leaves the screen, which is the floor the locate
button used to provide by standing in the corner.

## The map tiles need a key

The basemap comes from CARTO. It used to be free to anyone who attributed it,
which is what this file said for a long time, and it is still free — but since
2026 it wants a key, and it stamps **API KEY REQUIRED** diagonally across every
tile fetched without one. The map still draws. It just wears the nag.

Get one at **[carto.com/basemaps/apikey](https://carto.com/basemaps/apikey/)**.
No CARTO account, no approval queue, and no need to say in advance whether the
project is commercial. Free up to **5 million tile requests a calendar month**,
which a map of seventy restaurants will never come close to.

Then put it in one place, `TILE_KEY` at the top of `assets/app.js`:

```js
var TILE_KEY = 'your_key_here';
```

That is the whole change. Both styles read it, and the light and dark tiles
are the same key.

### Leaving it empty

An empty `TILE_KEY` is a working state, not a broken one: the tiles are
requested exactly the way they are today, watermark and all. Nothing throws,
nothing is blocked, and a fork of this repo with no key still gets a map.

### The key is public, and that is fine

This is a static site with no build step and no server, so anything the browser
needs is readable by anyone who opens the page or the repo. A basemap key is
the kind of key where that is acceptable: it is a meter reading rather than a
password, and it unlocks nothing except the tiles it is already drawing.

What it does need is a **domain lock**, set in the CARTO dashboard against the
site's hostname. That is what actually stops somebody spending your five
million tiles — not secrecy, which a public repo cannot offer anyway. Never
reach for this reasoning with a key that can write, spend or read private
data; those do not belong in a static site at all.

---

## Third-party pieces and their licences

| Piece | Version | Licence | Notes |
| --- | --- | --- | --- |
| [Leaflet](https://leafletjs.com/) | 1.9.4, pinned | BSD-2-Clause | Loaded from unpkg with Subresource Integrity hashes, so a compromised CDN cannot swap the file. |
| [CARTO Positron](https://carto.com/basemaps/) basemap (`light_all`, `dark_all`) | — | Free with attribution, up to 5M tiles a month, **key required** | The tiles. See [The map tiles need a key](#the-map-tiles-need-a-key). |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) data | — | ODbL | The map data behind the tiles. |
| [Familjen Grotesk](https://fonts.google.com/specimen/Familjen+Grotesk), [Literata](https://fonts.google.com/specimen/Literata), [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) | — | SIL Open Font License 1.1 | Served by Google Fonts. |
| [Instagram embed](https://developers.facebook.com/docs/instagram/oembed/) (iframe player) | — | Meta Platforms terms | The permalink with `/embed/` on the end. Loaded with the panel of a place that has a reel. No script involved. |
| [TikTok embed](https://developers.tiktok.com/doc/embed-videos/) (iframe player) | — | TikTok terms | Loaded with the panel of a place that has a video. No script involved. |
| [Google Analytics 4](https://developers.google.com/analytics) (gtag.js) | — | Google terms | Property `G-2XNTC15F28`. Loads on every page view and sets cookies. |

**The attribution control in the bottom-right corner is a licence condition of
both OpenStreetMap and CARTO. Do not remove it.**

No scripts or fonts beyond the table above. Apart from Google Analytics,
the only thing stored on a visitor's device is their language choice.

`assets/qr.js` is deliberately **not** in that table. Every QR library worth
using is a dependency this repo would otherwise not have, and the discount
pages are the ones most likely to be opened on a bad connection in a cellar,
so the encoder is written out in the repo instead — ISO/IEC 18004 byte mode,
error correction level M. It is checked against a reference encoder and a
scanner, module for module, rather than trusted because it looks like a QR.

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
| `reel_load` | `place`, `provider` |
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
canonical link and the `og:` tags. All three name the host — four lines in
total — so **changing domain means editing those three files** and nothing
else.

Google finds a site through links and through Search Console, and a brand new
host has neither. In order of what actually moves the needle:

1. **Put the link in the Instagram bio.** It is both the crawl path and,
   realistically, most of the traffic.
2. **Google Search Console.** Verify the property, submit `sitemap.xml`, then
   use URL Inspection to request indexing. Verification by HTML tag needs a
   `<meta name="google-site-verification">` line in `index.html`.
3. **Bing Webmaster Tools.** Same job, and it feeds other answer engines.
4. **A custom domain.** Done — `tallinntastebuds.ee`. `pages.dev` indexes
   fine, but it carries no brand and it is not yours: a domain you own is the
   one thing here that survives changing host. Search Console treats it as a
   new property, so verify and submit the sitemap there too.

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

CARTO has already made one move here — tiles now want a key, free but
required, which is what `TILE_KEY` is for. If they ever go further and stop
serving free tiles altogether, the lines to change are `TILE_URL`,
`TILE_URL_DARK` and `TILE_ATTRIBUTION` near the top of `assets/app.js`.
There is no CSP to update alongside them — see above for why.

---

## Design notes

**Palette.** The ground is `--wash`, the cards are `--paper`, and links, pins
and the price gauge are `--accent`, with `--accent-lit` a brighter step up for
hover and the locate dot. Near-black ink cast towards the style's own hue, one
hairline weight, one soft shadow, nothing else. The tokens are the first thing
in `assets/styles.css` and each of the two styles restates every one of them;
change those values and the whole site follows.

**The chrome.** Everything floats on the map: nothing has a page around it.
One strip across the top — the brand card on the left, **List** and the
language switch on the right — and the filter chips on the line directly
beneath it. The controls that are questions about the *map* rather than about
the page stand on the map instead, in the left rail: the colour switch, the
radio, Surprise me, and locate at its foot. There are no zoom buttons; the wheel, a double-click, a pinch and
the `+`/`-` keys all still zoom, and two more buttons standing on the map were
paying for a job the map already does. The chips used to sit at the bottom,
where the sheet covered them and they had to be hidden whenever the list was
open; at the top they clear even the fully dragged-up sheet, so the filters can
be changed while the list is showing.

**The ring is the only thing on the page that moves on its own.** Nothing else
here animates without being asked: pins settle, panels slide, and that is the
lot. A story is the one thing with a clock running on it, so the one moving
thing on the page is the ring that says so.

It moves twice over, for two different reasons. It **turns**, which says the
thing behind it is live — and a turning ring is only legible if there is
something on it to watch go past, so the gradient carries one bright arc
through the brick rather than being an even wheel of colour. And every few
seconds a second ring **leaves it and opens outwards**, twice, like a stone
dropped in water, then nothing for three seconds. That is the half that
catches somebody whose eye is on the middle of the map, so it goes wide:
half again the size of the mark, twenty-odd pixels of travel, passing over the
first letter of the wordmark on its way out — by which point it is nearly
transparent, and a quarter of a second later it is gone. What keeps it from
being a nuisance is the rest between blinks rather than a small reach: a thing
that pulses without pause has stopped asking and started nagging.

Both stop the moment the last story has been watched: the ring goes to the
hairline colour and just sits there until it goes altogether. Under
`prefers-reduced-motion` neither ever runs; the ring is still there, and it is
still the difference between something being up and not.

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

**Pins.** Every pin is the mark — see **The mark**. One picture, three collars
round it, for the three amounts of place behind it:

| | pin | today |
| --- | --- | --- |
| a reel | 22px, solid accent collar | 43 |
| photos, no reel | 22px, paper gap then an accent hairline | 10 |
| the write-up alone | 17px, hairline collar, quieter | 17 |

A closed place takes whichever of the three it is, greyed, plus a dashed ring
outside it — a fourth mark rather than a fourth reading of the same one. See
**Close a place instead of deleting it**.

The three used to be told apart by fill: a solid dot, a hollow one, and a small
faded one, drawn as circles at radii of 7, 7 and 4.5. That worked, and it was
still seventy circles that could have been anybody's map. Putting the mark on
all of them costs nothing the reading needed, because the reading was never in
the fill — it was in solid versus hollow versus small-and-quiet, and a collar
says that as well as a fill does while leaving the middle of the pin free to be
the painting. Bigger, too, which is what made it possible: 14px is mud, 22px is
a mouth.

The collar tones are the same accent, lit accent and muted the fills used, so
the pins still change with the swatch and the map still shows through nothing.
The chosen place grows to 34px, gains a breathing halo and keeps its name open,
but it keeps whichever of the three collars it is, so selecting a place never
hides what there is to see in it.

**The badge.** A pin only says this if you can see two other pins to compare it
with, which rules out the list, and rules out the map on a phone that has
zoomed into one street. So every row in the list carries the same three-way in
words — **REEL** or **VIDEO**, **PHOTOS**, **NOT FILMED** — as a badge holding
the right edge of the row, and the badge is drawn at the pin's own three
weights: solid accent, accent outline, hairline. The glyph inside it is the
pin's collar, small: solid, a ring, a speck. Not a play triangle and a camera,
which would only repeat the word next to them; echoing the pin is the one thing
the badge can do that the word cannot, which is turn every row into a key to
the map. The row's `aria-label` spells the word out, because the label is all a
screen reader reads of a row and anything shown but not spelled is not there.

**Clusters.** Pins closer together than a fingertip are drawn as one counted
dot until you zoom in far enough to tell them apart, and the count on it stops
in **tiers**: 10+, 20+, 30+, 50+. Past ten the exact figure is not information: 23
and 31 ask you to read a number and then tell you the same thing, and on the
opening view — where whole quarters fall into one dot — those were the only
numbers on the map. The
Four tiers and not one, because 10+ on its own was doing the same flattening
it exists to prevent. Both of these are real on this map: the opening view
carries a cluster of twenty, and zoomed out to the floor the whole city is a
single dot of sixty-six. Calling those the same thing — and drawing them the
same size — is the 23-and-31 problem again, one order of magnitude up.

The ladder stops at 50 rather than running 40, 60, 70 to the end of the data.
The top tier is the one that says "all of it, basically", and on a map of
seventy-odd places that is what fifty means.

Below eleven the dot grows **in proportion to the crowd**: ten places is twice
the radius of two, which is the whole of the rule. 24 and 4 are the only pair
of round numbers that give it. At and above eleven it is one width per tier,
because a dot that says 10+ and is drawn at three different widths is telling
you a number it has just refused to tell you.

| places | says | dot | count |
| --- | --- | --- | --- |
| 2 | 2 | 32px | 12px |
| 3 | 3 | 36px | 13px |
| 5 | 5 | 44px | 16px |
| 8 | 8 | 56px | 20px |
| 10 | 10 | 64px | 23px |
| 11–20 | 10+ | 64px | 23px |
| 21–30 | 20+ | 74px | 27px |
| 31–50 | 30+ | 84px | 30px |
| 51+ | 50+ | 94px | 34px |

32 doubled is 64, and the first tier picks up at exactly the width ten left off
at — 10 and 10+ are the same circle wearing different words, which is what they
are. The tiers step by ten and no more: 94px is a lot of circle, and the top
two are only reachable zoomed out to the floor, where there are three dots on
the whole screen and the room is there to spend. Against a 22px pin at the
small end and four times one at the big end, so a cluster is never mistaken for
a place at any count.

The count grows with the dot, a third of its width. A fixed 12px was why the
digits were hard to find at all: on a photograph a small number reads as a
caption rather than as the thing the picture is there to count.

**The rim says whether it is a crowd.** Two places under one dot is barely
one — it is the pair of doors you could not tell apart at this zoom — and it
keeps the quiet paper rim. Past two the rim takes the style's own colour, the
same brick or mint the number inside it is written in, so the dots worth
pressing are the ones the map is saying something with.

The distance that groups pins stays at 52px: wider than a fingertip, and wider
than most of the dots, but deliberately **not** as wide as the biggest of them.
Matching the widest dot would be a loop — a longer distance groups more places,
more places make bigger dots, bigger dots ask for a longer distance again, and
the opening view collapses into four huge circles. So two maximal clusters side
by side may touch. That is rare, and it is the cheaper of the two prices.

The dot is the mark too — the places it stands for are places — at the same
full strength a pin wears it, with the count written straight onto it in the
style's own accent. A pin and a cluster are still told apart at a glance, and
by more than the number: a pin wears the accent as a collar, a cluster is
ringed in paper instead and wears the accent as the number, and it is bigger
than any pin at every count.

There was a wash of the accent over the mark for a version, to give the count
something flat to sit on. It worked and it cost the thing it was there to
show — a mouth under 80% of a colour is a texture, not a picture. What carries
the digits instead is a **casing**: a ring of paper around the glyphs, the
way a map label has always cased itself. It leaves the picture untouched
everywhere the letters are not, and it holds the number at the same
accent-against-paper the rest of the site reads at — 6.56 to one on Red, 8.14
on Green. It is drawn in ems, so it thickens with the number rather than
thinning out under the big ones. Without it the accent alone drops to about 1.5 to one where the
digits cross the dark of the gap, which is the middle of the mouth, which is
where the number sits.

**The open place.** The list panel is the neutral card everything else on the
map is. Opening a place tints that card with six percent of the accent, so it
reads as picked rather than as the same panel with different words in it. Six
percent because it has to survive the measurement: on both palettes the body
text stays between 10.7 and 15.9 to one and the muted line never drops below
4.96. Anything stronger starts turning a write-up into a coloured
box.

**What the panel leads with.** Name, price, and the discount badge where there
is one — then, immediately, the thing there is to look at. The reel comes
first, the photos after it, and a place with neither says so in that same slot
under its own heading rather than leaving you to reach the bottom and work it
out. The write-up, the tags and the dishes all moved down a notch to make room.

They used to sit two sections down, under the write-up and the tags, which put
the one thing on the page that is not text below a screenful of text: on a
phone the reel had to be scrolled to. Ordering by what is scarcest reads better
anyway — every place has a write-up, only 43 have a reel — and it makes the
three kinds of place read as three kinds in the panel too, rather than as one
kind and two omissions.

**What the panel closes with.** The offer in full, then the address, then
**Directions**, **Call** and **Website** — the three things you do about a
place rather than read about it. Call rode with the name for a while, where it
was the loudest thing on a panel about a restaurant nobody had decided on yet;
it now sits with the directions, which is the other half of the same errand.
The head keeps only what tells you whether to keep reading.

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

A place opens the sheet at its full stop — 88% of the screen — because tapping
a place is a request for the place, not for the map: it is the restaurant's
page as far as a phone is concerned, and the name, the reel and the write-up
are on one screen. It used to open at a half stop, on the reasoning that the
point of opening a place is to see where it is, which put the player half on
the screen and half under the bottom edge and a scroll between you and the
thing you had tapped for. The half stop is still there — drag the grip down —
and the strip above the full sheet still holds the pin, the chips and the way
out.

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

**The mark.** A mouth, open, mid-laugh — the one in the painting at
`assets/logo/source-artwork.jpg`, cut out of it rather than redrawn from it.
It sits above the name in the brand card
rather than beside it, because beside it the wordmark has to break over two
lines to clear the mark and *Tallinn Tastebuds* reads as one line or not at
all. On a phone the card gives up its words and the mark is what is left
standing for the name, on one line with the handle. On the map itself it goes
on one pin only — whichever place is open — cut out of the dot in the dot's
own ring colour, so the pin keeps saying what it said before. The full account
of it is in [The mark](#the-mark).

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
ghosted in the hairline colour — `€€··` rather than `€€`. A band can sit on a
half step, and then one slot is lit down its left half only: the ghosted sign
with a second copy of the same glyph laid over it and clipped in two, so the
row keeps its width whether the place is a 2 or a 2.5. It is the only meter
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
