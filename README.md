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

The type labels go in **in all nine languages at once**, not the one the
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

When somewhere shuts down, set `"closed": true`. Nothing else about the entry
changes — the point of the whole exercise is that every `?spot=` link you ever
put in a Story keeps working. Deleting the entry breaks those links silently.

A shut place is two facts, not one, and the second is the reason it is still
here: **the door is closed, and the reel is not.** So it is marked in two
places rather than dimmed in one.

- **On the map** the pin keeps the shape that says what there is to watch —
  solid disc, hollow ring, small speck — in grey, and gains a **dashed ring**
  drawn just outside it. A closed place you can still watch a reel of is a
  solid dot inside a broken circle, which is both facts at once. Grey alone
  could not do that: it is also what a write-up-only place looks like from
  three streets away. The ring stays when the place is selected, and a
  selected closed pin no longer lights up the accent — the halo and the size
  say which one the panel belongs to.
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

Azerbaijani, English, Estonian, Finnish, Portuguese, Russian, Spanish, Turkish
and Ukrainian — the switcher shows them in that order, Azerbaijani first and the
rest alphabetical. The order of the blocks in `ui.json` is the order of the
buttons; the language a visitor *lands* in is a separate thing, still English by
default, and set by `DEFAULT_LANG` in `assets/app.js`.

The switch has two shapes, from the same markup. Wide enough, it is a row of
codes. On a phone it folds into the current code with a menu under it, listing
each language's own name for itself: nine codes side by side are around 350px,
which on a 390px screen runs straight into the handle in the opposite corner.
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
data/schema.json           JSON Schema, for editor autocomplete
photos/<restaurant-id>/    photos, one folder per place
tools/validate.mjs         dependency-free data validator
.github/workflows/validate.yml
```

Deep links: `?spot=f-hoone` opens that place directly — that is the link to put
in a Story. `?lang=ru` opens it in Russian, `?style=green` in the dark
palette. They all combine.

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

There are two crops of it and six files, all of them a resize of one crop or
the other: a wide one for the brand card, the three pass pages and the share
card, and a square one for the favicon, the home-screen icon and the map. The
boxes are written down in `assets/logo/README.md`, so a new size is a
re-render rather than a redraw.

On the map it goes on exactly one pin: the one whose panel is open. Not on all
seventy — the pins already say three things by shape, and a picture inside a
14px dot is mud. But there is only ever one chosen place, so it can afford to
be 34px and wear the painting.

It is drawn as a layer of its own sitting on the circle rather than replacing
it, which is what keeps this from costing anything. The circle underneath is
still the button — the click, the label, the tab stop, the focus ring. The
mouth is set inside it at 26px, which leaves a ring of the pin's own fill
showing all the way round: accent inside a paper stroke where the place is
filmed, paper inside an accent one where it is photographed, paper inside a
thin half-mixed one where there is only the write-up. So the pin goes on
saying how much there is to see in the place while it is wearing the mouth,
and it still changes with the swatches.

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

Prefer the station's own address over a rebroadcast of it. YleX, Radio Paradise
and Radio ROKS are all on their broadcaster's own host, which is why those three
lines are the shortest in the file. A mirror on an aggregator's
CDN is a lower bitrate, one remove from the station, and free to drop it
whenever it likes.

Ukrainian is on a channel rather than a main feed. Radio ROKS runs several
alongside the broadcast one, and `RadioROKS_Ukr` is the Ukrainian rock stream:
Okean Elzy, Skryabin, Druha Rika, Bumboks, Vopli Vidopliassova and the rest of
it, all day, which is a better answer to somebody reading the map in Ukrainian
than the main feed's Western rock. The other channels on the same host are
`RadioROKS_ClassicRock`, `RadioROKS_NewRock`, `RadioROKS_HardnHeavy` and
`RadioROKS_Ballads`, if the taste of the map ever changes.

Azerbaijani wants retro **in Azerbaijani**, which is two conditions and not one.
A station being licensed in Baku says nothing about the language coming out of
it: Vintage Radio Azerbaijan sat in this slot for an afternoon and plays golden
oldies — fifties to nineties pop, rock and roll, disco — on a host it shares
with a Russian trucker station. Correct country, wrong music. `Sən Günəşsən`,
99.9 in Baku, is retro Azerbaijani pop, and is named after one of the songs it
plays. Read a directory's country tag as an address, never as a format.

Baku Retro FM, 93.3 in Baku, is the obvious name for the slot and cannot have
it. Its only feed is `http://5.191.241.101:8000/bakuretrofm` — plain HTTP on a
bare address, no certificate to serve it over TLS — so the browser blocks it as
mixed content before a note is heard, and Android blocks cleartext for the same
station in the app. The aggregators that appear to play it are proxying that
same HTTP mount over their own HTTPS, which is a rebroadcast on somebody else's
uptime and the thing the paragraph above says not to reach for. If the station
ever publishes an HTTPS address of its own, it is one line in this file.

The Azerbaijani line is the one exception to the paragraph about broadcasters'
own hosts, and not by choice: no Azerbaijani retro station publishes an HTTPS
address of its own, so `Sən Günəşsən` is on rented Asura hosting, one station
per port. `Ağdam radio` is the other one worth having — Azerbaijani popular,
folk and retro, on `https://a2.asurahosting.com:6650/radio.mp3` — if this line
ever goes quiet or the taste of the map changes.

The `name` is what the button says, and the button holds 18ch before it starts
eating the end of it, so the station's full name for the channel is shortened
to `ROKS Ukr Rock` rather than shown as `RADIO ROKS UK…`, which reads like a
language code rather than a station. `Sən Günəşsən` is written the way the
station writes it, diacritics and all, which fits the button with room to spare
and is the right spelling for the only readers who will ever see it.

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
| [Instagram embed.js](https://developers.facebook.com/docs/instagram/oembed/) | — | Meta Platforms terms | Only loaded after a visitor presses play. |
| [TikTok embed](https://developers.tiktok.com/doc/embed-videos/) (iframe player) | — | TikTok terms | Only loaded after a visitor presses play. No script involved. |
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
the page stand on the map instead, in the left rail: the two colours, the
radio, Surprise me, and locate at its foot. There are no zoom buttons; the wheel, a double-click, a pinch and
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

A closed place takes whichever of the three it is, drawn in grey, plus a
dashed ring at r11 outside it — a fourth mark rather than a fourth reading of
the same one. See **Close a place instead of deleting it**.

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
