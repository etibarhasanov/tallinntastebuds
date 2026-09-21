# Tallinn Tastebuds — the map

A full-screen map of the places in Tallinn I have eaten at and approved for
[@tallinntastebuds](https://www.instagram.com/tallinntastebuds/). Tap a pin,
read the write-up, watch the reel.

There are no scores, stars or rankings on my places, and there never will be.
Being on the map is the verdict.

A number does appear on Google's places — the ones off the Places export that
are not on my map — and every time it does it says whose it is: "According to
Google 4.8 from 3,041 reviews". The one page where those numbers can be sorted
by is `/google`, which is Google's directory of the city rather than mine,
which nothing links to. See **On "no scores, stars or rankings"** and **The
directory**.

Static files, one small Function, no build step and no npm install. Adding a
place means editing one JSON file and pushing.

Two things are not static. The save count — a bookmark keeps a place and says
how many other people kept it too — and the lists, which are somebody else's
top ten rather than mine: a name they chose, places they picked out of a much
longer catalogue, and a sentence about each one, with a link they can send to
a friend. A list can be kept the same way a place can, and opened on the map
as pins. Both live in a Cloudflare D1 database, behind `/api/saves` and
`/api/lists`. Saving a place takes no account; making a list needs one,
because it goes out under a name, and keeping one needs the same account for a
different reason. See **Saves** and **Lists**.

Everything the map itself draws — the places, the write-ups, the discounts,
the stories — is still a JSON file in this repository, and the map renders
completely with the database switched off.

---

## Contents

- [Run it locally](#run-it-locally)
- [Add a place](#add-a-place)
- [Get the coordinates](#get-the-coordinates)
- [Copy a video permalink](#copy-a-video-permalink)
- [Add photos](#add-photos)
- [The list is ordered by distance](#the-list-is-ordered-by-distance)
- [Searching the list](#searching-the-list)
- [The places column, and what opens beside it](#the-places-column-and-what-opens-beside-it)
- [Ask for somewhere](#ask-for-somewhere)
- [A filter never answers with an empty screen](#a-filter-never-answers-with-an-empty-screen)
- [Close a place instead of deleting it](#close-a-place-instead-of-deleting-it)
- [Sharing a place](#sharing-a-place)
- [Languages](#languages)
- [Restaurant discounts](#restaurant-discounts)
- [Saves](#saves)
- [Accounts](#accounts)
  - [Signing in with Google](#signing-in-with-google)
- [The account page](#the-account-page)
- [Google venues](#google-venues)
- [The directory](#the-directory)
- [Lists](#lists)
- [Public lists](#public-lists)
- [Profiles](#profiles)
- [Splitwise](#splitwise)
- [Flashcards](#flashcards)
- [Stories](#stories)
- [The blog](#the-blog)
- [Feedback](#feedback)
- [Statistics](#statistics)
- [The admin page](#the-admin-page)
- [Deploy to Cloudflare Pages](#deploy-to-cloudflare-pages)
- [The map tiles need a key](#the-map-tiles-need-a-key)
- [What the validator checks](#what-the-validator-checks)
- [Files](#files)
- [The mark](#the-mark)
- [The pins](#the-pins)
- [Third-party pieces and their licences](#third-party-pieces-and-their-licences)
- [The design rules](#the-design-rules)
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

It rewrites the `?v=` hash on every script and stylesheet reference in the
pages that load something out of `assets/` — the ten named in `PAGES` at
the top of `tools/stamp.mjs`. The validator fails on a stale one, so CI will
catch it if you forget — but it is one command and it saves a round trip. See
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
| `added` | The day you added the place, `YYYY-MM-DD`. Optional, and nothing on the site reads it: it drove a **Just added** section at the top of the list until that section was taken out. It stays as a record of when each place went in, `/admin.html` still stamps one on every place it creates, and the validator still holds it to being a real date when it is there. |
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

30 of the 76 carry it today — nearly two places in five, which is why the
chip sits at the end of the row rather than near the front. If one of them
looks wrong to you, it is one line in `data/restaurants.json`.

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
are split into their own entries. Fotografiska is that split: the fine dining
upstairs and the bakery on the ground floor are two entries, and only the
ground floor carries the tag.

8 of the 76 carry it today, and all eight are coffee or tea.

---

## The order of the filter chips

The chips appear in the order the types are written in `data/taxonomy.json`,
left to right. That order starts from how many places carry each type,
commonest first, so the chips people are most likely to want are the ones they
do not have to scroll for. Today that is:

| # | Type | Places |
| --- | --- | --- |
| 1 | Casual/Solo | 46 |
| 2 | Bakery | 17 |
| 3 | Coffee/tea | 17 |
| 4 | Beer/pub | 13 |
| 5 | Hidden gem | 14 |
| 6 | Cheap eats | 11 |
| 7 | Laptop friendly | 8 |
| 8 | Date night | 11 |
| 9 | Asian | 11 |
| 10 | Vegan | 7 |
| 11 | Fine dining | 5 |
| 12 | Caucasus | 7 |
| 13 | Restaurant | 30 |

Two places in that table are hand-set against the counts, and both are about
what a chip is *for* rather than how big it is.

**Restaurant is last, on 30 places.** By frequency it would be second, ahead of
everything but Casual/Solo, and that is exactly the problem: a chip that keeps
two places in five has barely answered the question it was pressed to answer.
It earns its place in the row — the shape of a place is a real thing to ask
about, and the line is drawn above — but it is the one people reach for last,
so it is the one they scroll to.

**Laptop friendly sits with Date night**, above the cuisines, on fewer places
than either. Somebody scanning the row is usually after a kind of afternoon or
a kind of evening rather than a kind of kitchen, and the row reads better with
the use cases together and the kitchens at the end. Ties are broken by hand for
the same reason: bakery before coffee before pub, cheap eats before the two
occasions.

The rest of the counts have drifted from the order without the chips moving —
Date night and Asian have both grown past Cheap eats, Hidden gem past Beer/pub,
and Caucasus past Fine dining. Nothing re-sorts itself as you add places, and
that is deliberate: a row of chips that rearranges between visits is a row
nobody learns. Re-check it when a type has visibly grown, and move the line in
`taxonomy.json`.

Every chip in that table is also published as a list, under the map's own
account, and a fourteenth row here is a fourteenth list that needs a name.
See **[The chips, as lists](#the-chips-as-lists)** under **Lists**.

The counts above are how many places carry each type, which is a fact about
the map rather than about anybody reading it. `/stats` is the other half and
the one this order is really trying to guess: how often each chip is actually
pressed. It is not wired to anything and the row is still ordered by hand, on
purpose — a chip row that rearranged itself under people's thumbs would move
the thing they were reaching for — but it is the measurement to read before
moving a line in `taxonomy.json`. See **[Statistics](#statistics)**.

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

This is mostly felt after **Show my location**. That used to drop you at a
fixed zoom wherever you were standing, which on the edge of town is a screen of
streets with no pin on it, and from there every chip you pressed answered with
the same empty view: the filter had worked, the list behind it had changed,
and the map said nothing. Now the locate button frames you together with the
nearest place the chips allow, so you land looking at somewhere you could walk
to, and the chips keep the map on their own places from then on.

How close that frame goes is `HERE_ZOOM` in `assets/app.js`, and because the
pair is usually you and a place across the road, the cap is what decides it
nearly every time rather than the fit. It was 15 until somebody pressed the
button standing on Telliskivi and got a thumbnail of half of Kalamaja with
forty other things on it — the dot was on the screen and small enough to lose
among them. 17 is the street you are standing in, near enough to see which side
of it a place is on, and the fit still pulls back on its own as the nearest
place gets further away. The frame allows for the panel as well, so an open
sheet no longer lands the dot behind itself.

The dot is also drawn in a pane of its own above the marks, which is not where
Leaflet puts a plain circle: markers sit above the pane circles are drawn in,
so a dot on the same pixel as a mark went under it — and standing outside
somewhere is exactly when this button gets pressed. It takes no taps either
way. A pin the dot covers is still what a finger landing on it opens, and the
accuracy ring stays behind everything, because a wash the size of a city block
drawn over the marks would tint every one of them.

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

Both are plain iframes, and both are built with the panel, so neither platform
needs a script here.

Instagram's player lives at `/p/<shortcode>/embed/`, and the shortcode is the
only part of the permalink that reaches it. **The kind of post is not carried
over.** Instagram serves a reel at `/reel/<shortcode>/` and at
`/p/<shortcode>/` alike, but only the second one has a player behind it that
another site may frame; ask for `/reel/<shortcode>/embed/` and the answer is
"the link to this photo or video may be broken, or the post may have been
removed", which looks exactly like a reel somebody deleted. `embed.js`
normalised every permalink to `/p/` before it built its frame; when the frame
stopped being built by `embed.js`, that normalisation did not come with it,
and every place whose link was written `/reel/` showed that page instead of
its video until it did. So paste whichever of the two shapes above the address
bar gives you; they reach the same player.

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

## The list is ordered by distance

The list panel is ordered **nearest first**. It was the alphabet for a long
time, and the alphabet is an order nobody chose: it opened the panel with 180°
by Matthias Diether on every visit, out on Staapli and a good walk from most of
the map, because a digit sorts above a letter. The one thing somebody deciding
where to eat actually has is where they are standing, and the list starts from
that now.

It measures from two points, and only two:

- **From you**, once the locate button has been pressed and there is a dot on
  the map. The heading reads **Nearest you**, and every row carries how far it
  is — "450 m", "1,2 km", in the same words and the same rounding the chat's
  answers use.
- **From Raekoja plats** otherwise. The heading reads **Nearest the Old Town**,
  and the rows carry no distances at all.

**Nothing asks the device.** Opening the map puts up no permission prompt, and
neither does opening the panel. The dot is the only claim this site holds about
where anybody is, and only the locate button puts it there — the rule **Ask for
somewhere** already follows, where the site's own prompt over a question nobody
asked would itself be a question nobody asked. So the Old Town order is not a
degraded version of the feature waiting on a prompt. It is what the list does
until you press the button that has always been on the map.

**Why the rows go quiet from the square.** "1,4 km" under a place reads as 1,4
km *from you*, wherever it was actually measured from, and no wording in a row
three words wide undoes that. The order is still the useful half — the nearest
thing to the middle of town is a better opening row than the first name in the
alphabet — but a number about a point nobody chose is a small lie told on
seventy-five rows at once. So there is no number until there is a dot, which is
the same moment it starts being true of the person reading it.

**The point is Raekoja plats — `59.4372, 24.7453`**, the middle of the Old
Town, and deliberately not the point `assets/venues.js`, `assets/lists.js` and
`functions/api/_lib.js` each call the city. That one is `59.437, 24.7536`, 470
metres east and nearer the Viru gate: a good place to open a map and a good
middle for "near Tallinn" on a dragged pin, neither of which is a claim about
where somebody in town is standing. The difference is not academic — **67 of
the 75 places change rank between the two points**, and the nearest five are a
different five. `OLD_TOWN` in `assets/app.js` is the constant, and it is the
list's alone.

**A dot too far out falls back to the square.** Past `HERE_MAX_M` — 25 km, the
same number `frameHere()` uses to decide whether framing you against the
nearest place is worth doing — every row would read twenty-odd kilometres and
the order would tell you only which edge of town you are nearest. So the list
goes back to the Old Town, the numbers and the heading with it.

**This has been tried once before and taken out**, and the two shapes are worth
comparing. The directory offered a nearest-first order and dropped it — see
**The filters** under **The directory** — for three reasons: the permission
prompt it needed, the revert it did when that prompt was refused, and the
distance it wrote under every address. None of the three is here. There is no
prompt, because only the locate button asks. There is nothing to revert to,
because the Old Town order is the resting state rather than a fallback after a
refusal — a visitor who never presses the button never finds out there was a
question. And the distances appear only once they are the reader's own. That is
not a coincidence of design; it is the same list of failures, read as a
specification.

**Two lists keep their own order**, because in both the order is information
that distance would throw away: a public list is in the order its owner dragged
it into, and your own saves are in the order you pressed them. Neither carries
distances.

**And there is only one group now.** The panel used to open with a short **Just
added** section — the five newest places by `added` date, lifted above the
list — and it was taken out. The heading that is left carries its own count on
the right and sticks to the top of the panel as you scroll, so sixty rows in
you can still see what you are reading and how much of it there is.

The headings are `listNearYou` and `listNearOldTown` in `data/ui.json`. They
replaced `listTitle` ("All places") and `listAlphabet` ("A–Z"): the count
beside the heading already says how big the group is, and a distance order —
unlike the alphabet, which you can see by reading down the rows — cannot be
read off the list at all. So the heading spends itself on what the order is and
what it is measured from, which is the one thing nothing else on screen says.

---

## Searching the list

**On a phone** the button that opens the panel says **Places** and carries a
pin. It used to say List and carry a magnifier: List named the shape of the
thing — a panel with rows in it — rather than what was inside, and people read
it as a second menu rather than as the seventy-odd restaurants they were
already looking at pins for. The word is the content now, and the glyph is the
same pin the map is covered in, so the button and what it opens are drawn with
one mark. It does one thing: it opens and closes the sheet.

**Above 860px there is no button, because the places are already there.** See
[The places column, and what opens beside it](#the-places-column-and-what-opens-beside-it)
below — the column is open from the moment the map draws and it does not shut,
so a control that opens it would be a control that is always already pressed.

The search field is the first thing inside the panel, above the list, where it
can actually be typed into.

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

A search and the filter chips compose: chips first, then the words. The results
come back as one flat list, nearest first like every other slice.

The field sticks to the top of the panel, and the group heading parks below
it rather than under it, so sixty rows down the search is still there. With a
list open it sticks under the band naming that list, which is the one thing on
this panel that sits above the field rather than below it — see **A list is a
mode, not a filter** under **Lists**.

Escape empties the field; a second Escape closes the panel, which is what a
browser's own search boxes do. On a phone the field is 16px, because anything
smaller makes iOS zoom the whole page on focus and never zoom back out — and
see **The sheet** in the design notes for what happens to a fixed bottom sheet
when the keyboard opens over it. Tapping it while the sheet is at its half stop
takes the sheet back up to the full one first, because the keyboard comes off
the sheet's own height and there is not enough of a half stop left to type
into.

**With a list open, "the list" is the list.** Chips first and then the words
means a top ten has already cut the pool to seven places, and a word typed over
them is a question about those seven: `borsch` on a list with no Borsch &
Varenyk on it answers with nothing rather than reaching back out to the map for
one.

And the same field is on the list's own page — see **Both views of a list can
be searched**. Two of the four columns are missing there: it looks at the name
and the street and not at the type labels or the dishes, because that page is
sent its rows already filled out and never downloads the catalogue those two
come from.

---

## The places column, and what opens beside it

Above 860px the map arrives with the places already on it: a column down the
right-hand side, open from the moment the map draws, and it does not shut. Press
a name and that place opens in a second column beside it — to its left, over the
map — rather than turning the column you were reading into the thing you pressed.
A phone gets none of this; there the panel is a bottom sheet with stops and the
**Places** button that raises it, exactly as it was.

Three things follow from the column being permanent, and each of them is a
control that has gone.

**The Places button.** It opened and closed the panel, and above 860px the panel
no longer closes, so the button was always already pressed. `#list-seg` is the
group it stood in and the stylesheet takes the group out. The walk's step about
it points at the column's own search field instead — the top of the thing the
button used to be about.

**The cross on the list.** Nothing closes the column, so nothing on it is a
close. The cross comes back the moment a place or the chat is up, where it means
*give me the list back*: `closePanel()` lands on `restOnList()` on a desktop, the
way it lands on `restOnBand()` on a phone sitting on a list's name. A close that
has somewhere to land is not a dismissal.

**The row of language codes.** Not a consequence of the column so much as the
same argument about the same edge — see **Languages**.

### The map travels, and it travels slowly

Opening a place carries the map to it. `focusOn()` measures whatever the panel
is covering — the bottom of a phone, the right of a desktop, one column or two
— and puts the pin in the middle of what is left, so the place you opened is
never underneath the thing that opened.

It held still up here for a version, on the reasoning that the second column
covers city the arrival fit had already given up. It does, and the pin you
pressed is not part of it: with a place open the panel is more than half the
window, and the answer to *where is this* was as often as not behind it.

**Slowly, though.** Leaflet's own pan animation is a quarter of a second, which
reads as the city being cut to a new position rather than travelling to one —
and this map moves under somebody who is in the middle of reading it, and under
a pointer resting on a row. `PAN_MS` in `travelTo()` is 1.1s, slow enough that
the eye follows the streets across rather than losing one city and finding
another. A move too far to pan is a `flyTo` at `FLY_MS`, 1.2s, which arcs out
and back and so has further to cover and may take a little longer over it.
Under `prefers-reduced-motion` there is no animation at all, the way the rest
of the site answers that question.

### And a row you rest on takes the map there before you press it

Reading seventy-six names is asking where they are, and the answer used to be a
press away for every one of them: press, read, close, press the next. Rest the
pointer on a row now and the city comes to the name under it. The write-up is
then for the one you actually want.

**It waits, and that is most of what makes it bearable.** A pointer crossing
the column on its way somewhere else sweeps a dozen rows in a tenth of a
second, and a map that set off after each of them would be a map nobody could
read. `PEEK_MS` is the pause that tells a sweep from somebody looking at a
name: 260ms, started on the row and thrown away the moment the pointer is on
another one, so only a row that is rested on is ever asked for. Driven with six
rows at 45ms each, the map never sets off at all.

**It pans and never zooms** — `focusOn()` with `zoomIn` false — because a hover
is a question about where, not a decision to go there, and a scale that changed
under the cursor would be the map arguing with the list. The place already open
is skipped: it is centred in the strip already, and running back over its own
row on the way out of the column should not set the map going again. A press
cancels a waiting peek, since a press is the better answer to the same
question.

**Nothing is put back when the pointer leaves.** A map that sprang home after
every name would be twice the movement for none of the answer, and where it has
come to rest is where the last name you looked at is — which is the one thing
you might still want to see.

The listener is on `#list-body` rather than on each row, because `renderList()`
throws every row away and builds seventy-six more whenever a chip or the
language moves. And it is behind the same `(min-width: 861px) and (hover:
hover) and (pointer: fine)` query the corner is: a tap synthesises a `mouseover`
before it synthesises a click, and on a phone the list is a sheet over the map
in any case.

### The list keeps its place

The column is not redrawn when something opens beside it. `renderList()` builds
seventy-six rows and puts the scroller back at the top, which is right when the
language or a chip has changed and exactly wrong when all that happened is that
a place opened — you would lose the row you had your eye on and the scroll that
got you to it. So the two transitions that must not disturb it, opening a place
and closing one, ask `renderPanel()` for `keepList`, and they get it only when
the list was already standing. Everything else redraws as it always did.

That is also why the column is its own scroller at **every** desktop width
rather than only when there are two. The scroll lives on the column, not on the
panel, so it cannot be lost by the panel changing shape underneath it — and it
is why `.panel` stops being a card up there and each column is one instead. A
container that were still a card would paint the gap between the two columns
paper instead of leaving a strip of Tallinn in it.

And the row you have open is marked in the list: a bar down its inside edge and
the name in the accent, so the eye can get from the write-up back to where it
was without reading seventy-six names again. `markOpenRow()` puts the class on
rows that are already drawn; `renderList()` drawing fresh ones clears it, so
nothing has to unmark on the way out.

### A column is 360px, and the pair wants 1200

Each column is 360px above 860px rather than the 420 the panel has always been
on a desktop. Two at the old width were 856px of chrome, which on a 1400px
window left the map a third of itself — and the map is the thing somebody came
for. At 360 the pair is 736px, the write-up still gets a 308px measure, which
is about forty-five characters and a comfortable column of prose, and the list
rows wrap their kinds a line sooner and lose nothing else.

The pair itself is a `min-width: 1200px` question, which leaves 416px of map at
its own floor and 688 on a 1440px window. Under 1200 a place covers the list
the way it always did, and the cross hands the list straight back. The number
is written in the stylesheet and `pairFits()` in `assets/app.js` reads it off
the same media query, because a layout that disagrees with itself about how
wide it is draws one column and reserves room for two.

### The chip row starts after the corner, and the corner is one block

The row of filter chips is the map's vocabulary — thirteen types and the
discount — and above 860px it starts at 282px, where the corner's column ends,
and runs to the right edge. It does not move when anything opens.

**At the right end, the columns give way.** They used to start at the top of
the window, so the row had to be cut short to clear them — and with a place
open as well it was cut to three: All, Discount, and half of a third. A row of
thirteen filters that is three filters wide is not a row of filters; a visitor
on a wide screen could not see that the map narrows at all. Shifting it by a
column's width every time somebody pressed a name moved the one control on the
page that is a vocabulary rather than a button. So the columns start **under**
the strip instead: 98px down, which is the strip as it is drawn — 40px of
chrome, the 12px under it that `.filter-bar`'s own top adds, the 34px the row
measures, and 12px of air under that. The cost is 98px off the top of both
cards, and the two rules that used to push the row and the corner sideways
under `body.panel-open` are gone.

**At the left end, it took three goes, and the two that failed are worth
keeping.**

The row used to start after the corner's whole 250px column, which is where it
starts again. The complaint against that was a strip of empty map between the
rail and the first chip — empty, because the corner collapsed to the mark and
every word in it waited on a hover.

So it moved to 98px, just after the **mark**, and the name was pushed under the
row with the sentence and the handle. That puts the site's title fourth down
the left edge, underneath a row of filters, where nobody reads it as a title;
they read it as another line of chrome.

Then the strip became two rows — the mark and the name in the first, the chips
in the second, the sentence and the handle under the chips. Which is the same
mistake one line further down: the corner reads as a name, an interruption, and
two lines of orphaned prose running into the top of the rail.

**So the corner is one block.** The mark and the name, the sentence under them
and the handle under that, contiguous in the top left where they have always
been, and the row of chips beside the column rather than through it. The strip
of empty map the first arrangement was blamed for is not empty any more,
because the name beside the mark is drawn the whole visit now rather than
waiting on a hover: what stands in that 184px is the thing the site is called.

**What it costs is the right-hand end of the row**, 184px of it, which is one
chip. Measured: twelve of the fourteen show on a 1440px window against thirteen
before, and ten against twelve at 1280. The row has always been a scroller and
is one on every window narrower than these — a vocabulary whose tail runs off
the edge is a smaller wrong than a title in the middle of the left-hand
column.

`--brand-w` is the sentence's measure and the number the row starts after, and
those two have to agree, so they read the same custom property. The corner's
box does not change size between its two states, so `placeRail()` still reads
one number and nothing under it moves.

### The band, when a list is the mode

A list's name and the switch to its own page sit above the scroller, so with two
columns they push both cards down rather than only the one they are about. They
still do — what moves with them is the close and the mark, which are placed
against the panel rather than against the card they belong to and would
otherwise float over the map above it. `renderBand()` measures the band into
`--band-h` after it is filled, because a long title wraps, and the stylesheet
offsets the pair by it. The band itself is pushed across to stand over the
places column, which is what it is about.

`bandIsUp()` grew a clause for the same reason: it used to mean *a list is the
mode and the panel is showing the list rather than a place*, which was one
sentence while there was one column. Now the list stands beside whatever opened,
and the band is the only thing on the page saying which list the map is narrowed
to — a place opening is not leaving it.

---

## Ask for somewhere

The speech bubble on the left rail, next to the die, opens the panel on a
chat, and the site speaks first: *What do you feel like?*, with the field
ready at the bottom of the panel. Type a sentence into it — *cheap asian
food*, *somewhere for a date*, *khachapuri, still open* — and it sits on the
right, the way your own words do in any chat, with the answer under it: a
sentence or two, then one to three places as the panel's own rows, best
first, each with a line saying why it is there and, when the map knows where
you are, how far it is. The places are mine first, and Google's where the
map has nothing that fits — **One Ask, two rolls** below. The map narrows to
the newest answer's pins. The thread reads down from the top and the field
is held to the bottom, so the newest exchange is always by the place you ask
the next one, and earlier questions scroll up behind it.

On a phone the field is 16px, the same floor the search box takes and for the
same reason: anything smaller and iOS zooms the whole page the moment the
field takes focus, and never zooms back out. What that looked like was the
first answer arriving into a panel a seventh too wide — the send arrow and the
badge on the right of every row off the side of the screen, and the map
pannable sideways for the rest of the visit.

It is a conversation, and the model is told the whole of it: every question
goes to `/api/ask` with the exchanges before it — what was asked and what was
answered, ids and clauses, the last ten — so *somewhere cheaper* or *is the
second one open late* mean what they would to a person, and the reply reads
like one. One place is a whole answer when one is what fits, and the model is
told so; a model asked for "at most three" pads to three. A reply with no
places at all is also a turn — the model asking which of two you meant, or
saying in its own words that nothing fits — and it is drawn as one.

The reading carries too. `assets/ask.js` reads each sentence into the wish
the Function narrows on — see **Eleven hundred rows do not go into a
prompt** below — and a follow-up rarely repeats the question: *coffee near
the bus station*, then *something cheaper*, where the second sentence names
no kind and no place. Read on its own it was a wish for nothing, narrowed to
the floor, with the cafés mostly gone from what the model was shown, the
station forgotten and the distances back to the visitor's own dot — the
model had been reminded of the thread, and the narrowing had not. So the
wish is the conversation's — `carry()` in `assets/ask.js` — a topic and
three constraints, each the newest sentence that said anything about it.
The topic is what to eat: the kind of place read off the labels and the
words left over, where a dish or a name lands. A sentence that names any of
it is a new question about that — *thai* replaces *coffee*, and so does
*khachapuri*, because the Function holds picks to the kind asked for and a
carried *coffee* would hold the khachapuri answer to cafés — and a sentence
that names nothing to eat keeps it: *something cheaper*, *the second one*,
*near me instead*. Which is why the glue of a follow-up — *the second one*,
*instead*, *actually* — is noise to the reader, the same as *more* and
*options* above: read as a word, *instead* would replace the topic with a
search for a place called Instead. The constraints are the price, open now
and near, each kept until restated — *fancy* replaces *cheap*, *near
Kalamaja* replaces *near me* — and *open* only accumulates, since nothing in
the reader can hear *not necessarily open*. The price lists know the
comparatives, *cheaper* and *more expensive* in all ten languages, because
they are what a follow-up says. The device is asked for a location only by
a sentence that itself said *near me*, never by one that inherited it. And
it all goes when the chat is closed, with the thread.

Closing the panel ends the conversation. The thread is emptied, the map goes
back to the whole city, and the next press of the bubble starts again from
the site's first question. Nothing is written anywhere: what was asked is a
moment, not a record. A place opened out of an answer is not a way out of
the conversation, though: closing its card lands back on the thread, with
the answer's pins still on the map, the way closing a place under a list
lands on the list's band — see [Lists](#lists). It used to close to the map
with the panel shut, and from a phone that read as the chat having gone,
when the thread was there behind the bubble all along.

It is Surprise me with the question put back in. The die answers "anywhere,
you choose"; this answers "somewhere like this". Both hand back a place with
the map still under it, and neither is a filter.

It had a first life as a second field in the list panel, stacked above the
search with a switch under it and a heading over the rows, and it read as a
filter that was oddly slow. A question for an evening you cannot name is not a
search, so it has a panel of its own.

### It loads, then answers once

Type a question and *Looking…* sits under it while the arrow pulses; then
the model's answer lands, once, and stays. The field is never disabled: a
second question can follow the first without waiting for it, and each reply
lands under its own question.

It did not always work that way. For its first year the panel ran a keyword
reader over my places the instant a question was sent and drew its rows at
once, then swapped them for the model's a moment later — and for most of that
year the model's reply was being thrown away, so the swap never came and the
reader was the whole chat. What that looked like from a phone was a chat that
brought three places for *not sure*, with nothing under any of them saying
why, and then changed its mind. The reader is gone. `assets/ask.js` still
reads a sentence into the wish the Function narrows on, but nothing in the
browser ranks places any more, and no row is ever drawn in this panel that
the model did not name with a reason.

The model's side was slow on its first day, and most of it was one line. The
first model was a reasoning one, left to reason: it thought through several
hundred tokens before writing three ids, inside an output budget the thinking
sometimes used up. Thinking is switched off now, the model is a smaller one
built for latency that reads all ten languages, the blurbs it is shown are a
clause each, and the output budget is what three picks and a sentence need.
And a question the map cannot answer no longer costs a second whole request
to find out — see the next section.

**An answer is a mode, not a filter**, in exactly the way a list is one — see
[Lists](#lists) for the argument in full. No chip stands for it, none of them
goes down while it is on, and the places on screen are the ones it named rather
than the ones left over after a narrowing. So pressing a chip or typing in the
search field puts the answer away, the same as either puts a list away.

The answer is deliberately **not in the address bar**, which is the one thing
it does differently from a filter or a list. Those are places on this site you
can send somebody to. An answer is a moment: it was true at nine on a Friday
partly because of what was open, and the same link opened on Sunday afternoon
would draw three shut restaurants under a sentence saying they are open.

### The places are always mine

Whatever answers, what gets drawn is the ordinary row this panel draws for
every other place, built out of `data/restaurants.json`. The model contributes
an **ordering and a clause** and nothing else — it never writes a name, a
price, a dish or a description, and an id it invented is dropped by
`functions/api/ask.js` before the browser ever sees it.

That is the whole design rather than a precaution. A hallucinated sentence
about a real restaurant is a bad recommendation; a hallucinated restaurant is
the site lying in its own voice, and this shape makes the second one
unreachable.

### One Ask, two rolls

Every question is asked of both lists at once: my seventy-five, and Google's
eleven hundred — see [Google venues](#google-venues) — with the model told
how the two stand to each other. Mine first, because I have been there and
can vouch for it: when a place of mine fits what was asked, it comes before a
Google place that fits the same. A Google place is an answer when its own
line carries what was asked for — a cuisine, a dish, a part of town — and
the map has nothing that does as well, and never as filler. A Google place
in an answer is not a recommendation, and says so. It is the stand-in a list
draws for one, in the same row shape as a place of mine — the gauge and the
types in the same slots, so the two rolls read as one list — with a
**Google 4.8** mark in the slot where a row of mine says how much there is
to look at. The score never travels without Google's name in front of it.
Opening it gives the card a list's stand-in gets: the full "According to
Google" line, the hours, the phone, the listing, and a note at the top saying
I have never been. It wears Google's name and none of my words, because the
alternative is the site borrowing a verdict it has not earned.

It used to be a choice, and the site's first question was about it:
**Tallinn Tastebuds map**, or **All Tallinn**, as two buttons, with nothing
typeable until one was pressed. The map meant the map — the model was shown
no Google row, and a question the map could not answer got a shrug and a
nudge towards the other button — and the city meant both, under a rule that
every answer name at least one place from each roll. The owner took the
choice out: nobody opening a chat wants to be asked which of two maps they
mean before they can say what they want, and the map without the city is a
smaller answer to the same question. The one-of-each rule went with it, and
not only because nothing asks for the city any more. A rule that demands a
Google place in every answer produces one whether or not any fits, and a
small model that must give a reason for it writes the question's word under
whatever row it settled on — which is how *kebab* was once answered with an
Indian kitchen and *kebab place* under it. What holds a pick to the question
now runs the other way; see **Every row says why**.

**Eleven hundred rows do not go into a prompt.** That is thirty thousand
tokens a question against a free allowance that would then last an afternoon.
So the browser sends what it read the question as — the wish `assets/ask.js`
produces: types, cheap or fancy, open now, where to be near, and the words
left over — and `/api/ask` narrows the export with the same scoring it
narrows my places with, hands the model the forty likeliest, and hands the
browser those same forty so it can draw and pin whichever the model names.
The cut is generous on purpose: its one job is "plausibly what was asked
for", and the choosing happens once, in the model, over my places and these
together — with Google's own score breaking ties among Google's rows, which
on Google's rows is the only honest tie-break there is. A question that
scores no Google row at all — a mood, a greeting — gets the fifteen
best-rated instead of forty: that list is on every question now, and thirty
well-rated lines nothing in the question points at were the part of the
prompt mostly never chosen from. A Google row an earlier answer in the
thread named rides along whatever the new question scored, so that a
follow-up about it can still name it.

What a Google row can answer with is less than one of mine: a category, a
cuisine, a price band, a rating and the week. No write-up, no must-order dish.
The cuisine is the part that earns its keep. Nothing on my map says what a
place cooks beyond its name and its dishes, but the export files a place as
*Thai Restaurant* or *Georgian*, and `data/cuisines.json` already carries
those ids in ten languages for [the directory](#the-directory) — so the reader
takes them the way it takes the taxonomy, and *thai*, *tai* and *тайская* all
score a Thai row as a type would. The file is fetched the first time a
question is asked, not on load. And the sixty-one of my places that have a Google
row inherit its cuisine through the same join that gives them their hours —
see **Where the opening hours come from** — so the one word scores both rolls,
and the line the model reads for Ramen Taro says *asian japanese* where it
used to say *asian*. So "cheap thai" answers Thai places Google rates well,
and mine among them when I have been; "khachapuri" still answers Gobi and
Pirosmani first, off their dishes, with a Georgian place from the export
after them; and "somewhere I can hear myself think" finds nothing in the
export it can score, and the answer is whatever my places make of it. The
sixty-one Google rows that are already places of mine are left out of the
export's half — offering the Google copy beside the write-up would be the
same door twice.

### It is free, and what that buys

The model is **Workers AI**, and only that. Cloudflare gives every account
**ten thousand Neurons a day at no charge** and there is nothing to
configure — no key, no npm, no account to open, no card; the binding is three
lines of `wrangler.toml` and the model is one constant in the Function. A
paid model was wired in ahead of it for an afternoon and taken out again the
same day: this site is meant to cost nothing to run, and a key that has to be
bought, capped and rotated is not nothing.

What that allowance actually buys is the thing worth knowing. A question
used to carry the whole catalogue, about 4,750 tokens, which was
**something like a hundred and thirty questions a day** — and then every
request is a 429 until midnight UTC and the chat says it is resting. Preview
and production spend from the same pot.

Most of that was the catalogue, and none of it was chosen: all seventy places
went to the model on every question, including the ones that were not about
food. They are now narrowed the way Google's eleven hundred already were, by
the same scoring, down to the thirty a question could plausibly be about with
a floor of twenty so a question that names nothing still has a map to choose
from — and the blurbs are cut to a clause, and the city's forty are fifteen
when nothing in the question scored one. On the model named in
`functions/api/ask.js` — 5,500 Neurons a million tokens in and 36,400 out,
by Cloudflare's pricing page in September 2026 — that is **around 3,500
tokens a question, forty-odd Neurons, and something like two hundred and
fifty a day**, a retry under one of the rules counting as a second question;
the street on every line is a few hundred of those tokens, and worth it,
because where a place is turned out to be the thing the model most needed
and least had.

**Changing the model is one line, and checking it is one request.** The
model is the `MODEL` constant at the top of `functions/api/ask.js` and
nothing else — no key, no binding, no dashboard — and the comment above it
carries the arithmetic and the alternatives on the free list:
`@cf/meta/llama-3.1-8b-instruct-fp8-fast` saves a quarter of the cost and is
weaker in Estonian and Armenian, and everything else Cloudflare left on the
free plan costs two to eight times as much a token, so the allowance is
stretched by sending fewer tokens rather than by changing the name. Every
reply carries the model's name as `model` beside `note`, so after a swap one
`curl` to `/api/ask` says which model answered and whether it was heard —
the comment has the line — and the Workers AI page of the Cloudflare
dashboard shows the day's Neurons when it is worth knowing where an
afternoon went.

The floor is what makes the narrowing safe rather than clever. Every place on
this map is one I have been to and would send somebody to, so any twenty of
them is a legitimate pool for a question about a mood; what the scoring has
to guarantee is only that when a question *does* name something — khinkali,
ramen, a date — the places that answer it are in the slice, and first. There
is no test in the repository for that; it was checked by hand, question by
question, and the way to check it again is the same — `/api/ask` answers
with `picks` in the order the model chose, and a named dish that is not in
the first three is the scoring having missed.

**For its whole first year, nobody ever saw this model answer.** Not because
of the allowance: because of the shape of the reply. The older models on
Workers AI answer `{ response: "..." }`, and this one, like every model with
an OpenAI-style parameter list, answers as a chat completion with the words
at `choices[0].message.content`. The Function read `response`, got
`undefined`, and handed the whole object to `unwrap()`, which stringified it
to `[object Object]`, found no brace and returned null — so every answer the
model gave was thrown away, quietly, and the keyword reader answered in its
place. Nobody could tell, because the reader is right about most questions
people type; it took *how does it work* coming back with three restaurants,
and *All Tallinn* giving the same answer as the map, to notice. Both shapes
are read now, and `/api/ask` reports which of the two answered in **`note`**
— `workers-ai`, `workers-ai-none`, `workers-ai-spent`, `no-ai` — so the next
time this goes quiet it is one request to find rather than a year. There is
no test in the repository that feeds the route the chat-completion shape;
the `note` is the check, and it is worth reading after any change to the
model or to `unwrap()`.

Which leaves the other half: what happens when the model is not there. That
happens — the allowance runs out, a model gets moved behind the paid plan
(`kimi-k2.6` and `glm-5.2` both did in July 2026), the network is gone, or it
answers with something unparseable. `/api/ask` answers `source: "none"`, and
the chat says *Nothing on the map answers that* and draws no rows. It does
not guess. There used to be a keyword reader in the browser for exactly this
moment, and it is what made the chat look broken: it matched substrings and
drew three places for a question it had no clue about, with nothing under
them, in the model's voice. A shrug is honest; that was not.

What `assets/ask.js` still does is read. It turns a sentence into the wish
the Function narrows on — which of the thirteen types, cheap or fancy, open
now, what to be near, and the words left over that might be a dish or a
street — in all ten languages at once, because its vocabulary is the taxonomy
labels this page already holds, so *pagariäri*, *bakery* and *пекарня* all
reach the bakeries without a word of it being written down twice. The five
things people ask for that have no words in the data — cheap, fancy, open
now, near, and themselves — live in `data/ui.json` under `askWordsCheap`,
`askWordsFancy`, `askWordsOpen`, `askWordsNear` and `askWordsMe`, as
synonyms joined by `|`, the same shape `days` and `months` already use.
Which means the validator holds them to all ten languages like every other
string, and adding a language stays one file.

**Except when it is the allowance, in which case the chat says so.** Workers
AI answers a spent day with error 3036, which is a 429 like the transient
"out of capacity" 3040 but means the opposite thing: nothing clears it before
midnight UTC. So the Function answers `source: "resting"` for that one, and
the browser draws the sentence *We have overworked today. We are on a break
until the new day — come back tomorrow* and stops there. It does **not** fall
through to the keyword reader: three places matched on letters under a
sentence about an evening is the reader impersonating the model, which is the
thing this panel is for stopping. Every other failure — a blip, a moved
model, a dead network — is still the quiet fallback above, because those may
be gone by the next question and a visitor told to come back tomorrow would
have been lied to.

The reader is a substring matcher, and the honest limit of it is that it
cannot hold a thread at all — it reads each sentence on its own. It also
used to answer questions that were not questions about food, because *it* is
a substring of Piti and of Vesta: a leftover word now has to be three
letters and has to start a word, so *khinkal* still finds khinkali and *how
does it work* finds nothing.

### Where the opening hours come from

The map's own places carry no hours — there is no such field in
`data/restaurants.json` — but sixty-one of the seventy-six are also rows in
[Google venues](#google-venues), joined on `google_venues.map_id`, and those
rows carry the week, and Google's word for what the place cooks. So
`/api/ask` reads both — the cuisine goes onto the line the model reads and
into the scoring, see **One Ask, two rolls** — and answers with which places
are open **right now and until when**, whether or not it has an opinion about
the question. "Open until 23:00" under a row is the one thing the panel
cannot say for itself.

The clock is Tallinn's and never the reader's, for the reason
[The directory](#the-directory) gives at length: the hours are a fact about a
door in this city, and somebody planning tonight from Lisbon is asking about
that door. Split days — a kitchen that shuts between three and five — and
spans past midnight both read correctly; a bar open until one in the morning is
open at half past midnight, off the previous day's row.

The fifteen places with no Google row, and the seventy-seven Google rows with
no hours in the export, simply say nothing about hours. An answer that is
silent about them is honest; one that guesses is not.

### Every row says why

The line under a row is the model's, and every row has one. It is at most
twelve words on why *that* place answers *this* question — the dish they
asked for, what suits the occasion, what makes it the cheap one — and never
the type or the price read back, because the row above already prints the
types and draws the gauge, and *Cheap eats · Asian · On the cheaper side*
directly underneath *Restaurant · Asian · Cheap eats · Hidden gem* is the row
explaining itself with itself. Nor the distance, which the row prints from
its own measurement — see **The distance is the site's** below.

It is required rather than requested. The prompt asks for a reason on every
place, and a small model still sometimes leaves one blank, so
`functions/api/ask.js` drops any pick that arrives without one: a place with
no reason is not a pick, and if every place goes the sentence still stands.
A row appearing with nothing under it was the answer refusing to say why it
was an answer, and for a year it was what this panel mostly drew.

**And it has to be true.** Requiring a reason on every pick makes a model
invent one when the line gives it none: asked for *kesklinn*, it once put
*cool bakery in the city center* under a place whose line says it is out on
the way to Viimsi — the question's word stamped onto a place to satisfy the
rule, in the site's own voice, under a row. Two things stop that. The model
now sees **where** every place is — the street and district, on my lines and
on Google's, which for a year it did not; a model that can read *Ranna tee,
Miiduranna, Viimsi* has no business calling it central. And the prompt says
in so many words that a reason must be true to the line, that the question's
words are not a reason unless the line supports them, and that when the line
gives no true reason for *this* question the place is to be left out: a
shorter honest answer beats an invented reason. The address also joins the
haystack the narrowing scores on, so *kopli* reaches Bekker and *viimsi*
reaches Buxhöwden, and the floor a question falls to when it names nothing is
one place per type in turn rather than the top of the alphabet — which is how
*kesklinn* got three bakeries beginning with B.

**And it is held to the dish.** Asked for *kebab*, the chat once answered
with Saffron, an Indian kitchen on Gonsiori, and *kebab place* under it: the
place had reached the model through the floor, the rule then in force wanted
a Google place in every answer, and a model that must give a reason gave the
question's word. Telling it not to was not enough, so the dish is now held to
the way the kind is — see **Near somewhere** — in the one retry the rules
share. When a leftover word names a dish or a cuisine — the directory's own
vocabulary, `KITCHENS` in `functions/api/venues.js`, which knows kebab,
ramen, sushi, taco, curry and the cuisines by name; or a word of a dish
somebody wrote under a place of mine; or a cuisine the reader matched off a
label — every pick's line has to carry it: the word itself, in the name, the
street, the dishes, the types or the write-up, or a cuisine the word names,
so that a row Google files as Middle Eastern carries *kebab* whether or not
the word is in its name. A pick whose line does not is shown back to the
model with the lines that do, and the second answer stands. It is
deliberately not every leftover word: a mood, a street, a name, *food* —
words that land on lines too, and would hold an answer to them for no reason
a person would recognise — and never the words that named where to be near.

### Near somewhere

Asked for *something close to my place, Laulupeo street*, the chat once
answered *I don't have a place on Telliskivi 35 in my map* over Ariran, *2
minutes from your place* — Telliskivi 35 being Ariran's address, not the
visitor's. Every place on both rolls has a point, and the model was shown
none of them; the street the visitor typed was text. It had nothing to
measure with, so it took a street off one of its own lines for the one it
had been given and invented a walk between the two.

So *near* is now the fourth thing the reader in `assets/ask.js` looks for,
beside cheap, fancy and open now, with its words in `data/ui.json` under
`askWordsNear` in all ten languages — *close to*, *nearest*, *lähedal*,
*рядом с*, *perto de*. What follows the phrase is what they want to be near, and
`/api/ask` turns it into a point with the same lookup the add-a-place form
uses — `/api/geocode`'s Photon call, biased to Tallinn and bounded to it,
cached upstream for a day — taking the first suggestion: the street for a
street, the district for a district, the door for a name Photon knows. With a
point, the *where* on every line the model reads ends with the straight-line
distance from it — *Telliskivi 35 · 3.1 km* — the nearest score four when the
places are narrowed, the same as naming a type, one less for each kilometre
after, and ties go to the nearer; the prompt says where the visitor is and
that the distances on the lines are the only distances there are; and each
pick comes back with its distance for the row to print — see **The distance
is the site's** below. One lookup a question, only for a question that said
*near*, so *khachapuri* never reaches Photon.

What it measured from is printed under the reply — *Distances are from
Tallinna bussijaam, Kesklinn, as the crow flies* — in the small type the
rows use for their own notes. That line is the visitor's check on the whole
chain. A street Photon placed in the wrong town, or a landmark it read as
some other landmark, shows up there as the wrong words; without it the only
symptom is three good places that are somehow not the ones round the corner,
and nobody can tell whether the street was misread or the model chose badly.

The model is also told that the lines are in order, best first, and that a
kind of place asked for is not negotiable: *coffee next to the bus station*
once came back as the three nearest doors to the station — a Caucasian
restaurant, a ramen bar and a pub, each with a "why" claiming coffee — with
Paper Mill Coffee at 400 m left on the list. A small model shown a column
of distances sorts by it and nothing else unless told what the order it was
given already means. Telling it was not always enough, so the kind is now
held to, in the one retry the rules share: when the question was read as a
type — the ids `assets/ask.js` found, which are the ids in every line's
types column — and a pick's line does not carry one of them, the model is
shown its own answer, told which picks are not of the kind and asked once
more, and the second answer stands. It is held to only when the lists
actually hold a place of that kind; when they do not, an empty answer
saying so is the right one.

### Near me

*Coffee close to me*, asked by somebody who had pressed the locate button a
minute before and was looking at their own dot on the map, used to be
answered by asking which part of town they were in — and *ramen near me*
was worse: the reader took *me* for noise, found nothing after the phrase,
fell through to the leftover words and handed *ramen* to Photon, which found
a place called Ramen somewhere and measured every distance from it. Two
readings were wrong at once: that a kind of place or a dish could be
somewhere to be near, and that the site did not know where the visitor was
when it was drawing them.

The reader now knows the visitor as a word. `askWordsMe` in `data/ui.json`
holds *me*, *my hotel*, *here*, *minu*, *siin*, *здесь* in all ten
languages, and a near question with any of them in it is about the visitor
themself: nothing is looked up, and the point is the dot. Type labels the
reader matched — *coffee*, *fine dining*, *thai* — never name a place to be
near either, so *coffee nearby* is about the visitor too. What is left over
after both is a street, a district or a name, and is looked up as before;
a dish left over, *ramen nearby*, still goes to Photon, because nothing in
the reader can tell a dish from a street, and the line under the reply says
what it was taken for.

*Nearest* and *closest* are near words too, with their forms in the other
nine languages beside them — *lähim*, *lähin*, *ближайший*, *найближчий*,
*más cercano*, *mais próximo*, *ամենամոտ*; Azerbaijani and Turkish put *ən*
and *en* in front of the word the list already had, and only the *ən
yaxını* and *en yakını* that stand on their own needed adding. For a while
they were not in the list at all, and *nearest pizza* from somebody who had
just pressed the locate button was read as a question about the city, with
*nearest* left over as if it were a dish or a name: nothing asked the device
when there was no dot, and when there was one it only broke ties, so the
answer was pizza across town from a visitor who had asked for the corner
they were standing on. A superlative is a request to measure from where
they are, and it is read as one now — the device is asked the way it is for
*near me*, and a kind of place asked for is held to its nearest.

The dot is the point when there is one, and it goes with every question
once the map has it — the next section says what it is for. When there is
none, the chat asks the device once, and only for a question about *near
me*, through the same events the locate button's press goes through, so the
dot appears and the map frames it exactly as if the button had been pressed
— *near me* is a request for that, and the browser's own permission prompt
is the right thing to see, where over *best khachapuri* it would be a
question nobody asked. Refused, unavailable or slow, and the visitor's
whereabouts are unknown, answered as below. The point travels beside the
wish as `here`, is checked in the Function to be two numbers inside the
Tallinn box — a visitor asking from Helsinki is told the same as one with no
dot, rather than shown eighty kilometres on every line — and is measured
from when the question named nowhere, or named somewhere Photon could not
place. The line under the reply then reads *Distances are from your location
on the map, as the crow flies* — `askFromHere` — which is checkable against
the dot.

Without a point — a spelling Photon cannot place, somewhere outside the box,
Photon busy, *something nearby* from a device that would not say where it
is — the prompt says the
visitor's whereabouts are unknown: a street or district in the question is
theirs and is never swapped for a place's address, no distance or walking
time is stated, a place is near them only if its own *where* names the same
street or district, and when none does the reply names the street as they
spelled it, says it cannot judge the distance, and asks which part of town it
is in. *Laulepeo* with an *e* is the case that started this, and whether it
resolves is Photon's fuzziness to decide; the honest reply is what it gets
when it does not.

What is left over from a sentence is looked up as before, and the filler a
chat sentence carries is now noise the reader drops — *more*, *options*,
*else*, *recommend*, *veel*, *ещё* — because *more vegan options nearby*
says *near* with nothing after it, so the whole sentence was taken for the
place to be near, and *more options* went to Photon, which placed it
somewhere and measured every distance from there. With the filler out
nothing is left, and the question is about the visitor, which is what it
was. A dish left over still goes to Photon, as above; the line under the
reply is what catches it.

### The distance is the site's, and the dot counts for what was asked

Every row of an answer says how far — *450 m*, *1,2 km* — when there was a
point to measure from, in the row's own mono, with the badges. For a while
that number was the model's: the brief told it to quote the distance off its
line and never to invent one, and a small model quotes a distance the way it
quotes anything. One answer had *1.2 km away* under a place in Lasnamäe and
*1.3 km away* under one on Endla, six kilometres apart, and the next answer
had nothing under any row. So `/api/ask` now sends each pick back with
`far`, the kilometres it measured for the line the model read; the browser
prints it — `askMetres` and `askKm` in `data/ui.json`, to the nearest fifty
metres under a kilometre and to one decimal past it, in the visitor's own
decimal mark — and the brief tells the model the visitor can see it and not
to write one. The line under the reply still says what it was measured from,
and it is drawn only under a reply with distances in it or one that asked
for somewhere near: the dot goes with every question now, and *distances are
from your location* under *hello* would be a note on nothing.

Which is what let the dot go with every question. It used to go only with
one that said *near*, on the argument that *best khachapuri* is a question
about the city and a point would bias it towards the nearest one; what that
looked like from a phone that had just drawn the dot was *coffee* answered
with three cafés across town and nothing to say how far any of them was. The
bias is a matter of what the point is for, and the Function decides that by
whether *near* was asked. Asked, the nearest score four when the places are
narrowed, as above, and the brief says *close* means the smallest distance.
Not asked, the distance goes on every line and only breaks ties when the
lists are sorted, and the brief says what was asked for comes first and the
nearer is preferred among places that fit it equally — so *coffee* from a
dot on Ankru is Kokomo, Chamber Tea and Nullijook, and *best khachapuri* is
still Gobi and Pirosmani, with how far each is.

And a *near* question that named a kind of place is held to the nearest of
that kind, the way it is held to the kind. *Coffee close to me* from a dot
on Ankru was answered with Kalve Kadriorg, six kilometres off, with Kokomo
Coffee Roasters on the same street as the dot and on the first line of the
list — the brief already said *close* means the smallest
distance, and as with the kind, telling was not enough. So when a pick of
the kind is more than a kilometre farther than the nearest place of that
kind on its roll, the model is shown which picks strayed and how far, which
places of the kind are within reach and their distances, and asked once
more, in the one retry the rules share. Per roll, so that the nearest place
of mine stays an answer beside a Google row on the corner rather than being
ruled out by it.

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
than sending you to a closed door. And the locate framing walks you to the
nearest *open* place. They stay on the map, and in the list, and at their own
`?spot=` link — that is the whole point — but nothing ever *suggests* them.

Six places in `data/restaurants.json` are marked closed today — Bueno Gourmet
Kadriorg, Cafe Cape Town, Ferment, Lendav Maaler, Lokaal Tilk and Maison
François. All six have a reel, so all six get `closedReelNote`.

Do not write the closure into the `blurb` as well. The panel says it in every
language already, and Laboratooriumi 23 used to end with "Sadly closed now,
but the video stays up" directly under a note that said the same thing.

---

## Sharing a place

The map is one page, and `?spot=<id>` was a deep link into it rather than a
document of its own: the canonical tag pointed every one of them back at the
bare address. That meant two things. Every link anybody has ever sent about
one restaurant was index.html with a query on it, and a query is the one part
of a URL a link-preview crawler does nothing with — pasted into WhatsApp,
Telegram or a Slack channel, `?spot=varkizana` arrived as the site:

> **Tallinn Tastebuds | Where to eat in Tallinn**
> All the places in this map I have personally been and approved.
> *the watercolour mouth*

The same card for all seventy-six places. Somebody sending a friend a Greek
tavern in Lasnamäe got a card about a map, and the one thing the message was
about — which place — was in the part of the link nobody reads. And a search
for the place by name found the whole map or nothing, since the map was the
only page there was.

`functions/index.js` is the fix for both. Asked for `/` with a `?spot=` that
names a place, it serves the map with that place's own head: the card an
unfurler reads, and the title, description, canonical and structured data a
search engine reads, and the page's text led by that place — see **A place is
an address** under **Getting found** for the search half. The card:

> **Varkizana Kreeka tavern**
> A Greek tavern in Lasnamäe, and everything we tried was really good.
> Moussaka, tzatziki, souvlaki and dolma, and the moussaka is the one…
> *the first photograph in `photos/varkizana/`*

It is the same arrangement `/list/<id>` and `/split` already had — a Function
in front of a static page, swapping the block between the `<!--PAGE-HEAD-->`
markers — and the head of that file carries the reasoning. Four things about
it are worth knowing from out here.

**The card speaks the language the link carries.** `?lang=et` makes an
Estonian card, because the person who shared that link chose Estonian for the
person they were sending it to. That is the opposite of what a shared list
does, and the difference is real: a list's card has no reader to ask, so it is
written in English, while this link says which language it is in. A language
the place has not been written up in falls back to English, the way the panel
does. The blurb's own keys are the list of what counts, so nothing in this
route needs touching on the day an eleventh language arrives.

**The picture is the place's first photograph**, and the mark for a place that
has none, which today is fifty-three of the seventy-six. They are photographs
off a phone and not cards drawn at 1200×630, so no `og:image:width` is claimed
for one: nothing in this repository knows a photo's dimensions without opening
the file, and a size claimed wrongly is worse than one an unfurler measures
for itself. Most are portrait. Telegram and Slack show those whole, WhatsApp
crops them to a band, and both beat a logo. Adding photos to a place is
therefore also what gives it a card — see **Add photos**.

**A closed place says so first.** The description opens with `closedFlag` —
"Closed for good", in the card's language — before the write-up, because a
shut place keeps its pin and its link on purpose and the card would otherwise
sell a kitchen that is not cooking. This is composed when the page is served
and is not written into the `blurb`, which the section above forbids for the
same reason it is fine here: there is exactly one copy of the sentence.

**`og:url` and the canonical tag agree now, and used not to.** For a day the
canonical stayed at the bare address so that the search signals pooled at one
page, while `og:url` was the spot's own link so that Facebook — which treats
`og:url` as the identity of the thing shared — cached one card per place
rather than one for all of them. The owner's decision that each place is a
page of its own for search settled the other half: the canonical is the
spot's own address too, in the language of the link, and the only thing that
still pools at the bare address is a closed place, which keeps its card and
its link and is not a page — see **Getting found**.

### And there is a button that hands you the link

All of the above was true for months while the only way to *get* one of these
links was to read it out of the address bar — which on a laptop is a select
and a copy, and on a phone, inside the browser Facebook or Instagram opens a
link in, is not a thing anybody does. So an open place has a share button in
the panel's chrome, between the close and the save mark: the sheet on a phone,
the clipboard on a laptop with *Link copied.* under it, and a `window.prompt`
holding the link for anything with neither. Three steps, the same three
`shareList()` in `assets/lists.js` has always used and the same three the
list's own button on this page uses; `pressShare()` in `assets/app.js` is the
third copy and they are kept in step by hand.

**The link is built, not copied.** It is `/?spot=<id>` and nothing else — no
`?type=` for the chips that happen to be pressed, no `?list=`, no `?lang=`,
no `?style=`. Those are all true of the person sharing rather than of the
restaurant, and a link to a place should arrive in the reader's own language
and the reader's own colours, the way it would if they had found it
themselves. The card an unfurler draws for it is then in whatever language the
link is opened in, which is the same answer the section above gives for a link
that carries no `?lang=`.

**A stand-in gets no button.** A place that arrived on somebody's list and is
not on this map resolves under `?spot=` only while that list's `?list=` is
still in the address — `byId()` looks down the list's own places after the
map's — so the link would open a bare map for whoever it was sent to. A closed
place keeps its button, for the same reason it keeps its pin and its link.

Nothing else changes. `?type=` and `?story=` are deep links and still get the
site's card — a filter has no name and a story is gone within the day. And
`robots.txt` must go on allowing `/`, which it does and always has: a
`Disallow` stops the fetch, and a stopped fetch is a bare blue URL. That is
the note beside `/list/<id>` in that file, and it applies here word for word.

---

## Languages

Azerbaijani, Armenian, English, Estonian, Finnish, Portuguese, Russian,
Spanish, Turkish and Ukrainian — the switcher shows them sorted by their
two-letter code, so `az` first and `uk` last, whatever order the blocks in
`ui.json` are written in. The language a visitor *lands* in is a separate
thing, still English by default, and set by `DEFAULT_LANG` in
`assets/app.js`.

The switch is the code you are in with a menu under it, listing each
language's own name for itself. It had two shapes for a while — this menu on a
phone, and a row of all ten codes wide enough — and the row has gone. Ten codes
side by side are around 390px, which is the whole of a 390px screen, handle in
the opposite corner and all; on a desktop they fitted, and what they were was a
list of things nobody was looking for. A visitor wants their own language or
none of them, so nine of the ten were permanently wrong for whoever was
reading, and they spent 360px of the top edge on the answer to a question asked
once a visit — the same edge the places column now starts from. The markup
never changed: `renderLanguageSwitch()` has always built the trigger and the
list both and the stylesheet picked between them, and now there is nothing to
pick. The menu grows downwards, so the next language costs nothing in layout
either.

**And it grows downwards over the places column**, which took a rule to say.
Above 860px that column is open from the moment the map draws and starts 98px
down the right of the window — under the button the menu drops from, and
straight through the ten languages under it. The panel is 1200 in the stack
and the corner these buttons stand in is 1001, so what a press on the switch
drew for a few days was the menu *behind* the list: the language somebody was
reaching for, painted over by seventy-six restaurants. The menu cannot climb
over it on its own, either, because it hangs inside `.controls` and that has a
`z-index` of its own; so the corner is raised instead, to 1250, and only while
there is a menu to raise it for — `body.lang-open`, put on by
`markLangMenu()` and taken off by the same. 1250 is over the panel and under
the lightbox, the walk, the toast and the stories, and under the account
sheet's scrim at 1200, which is a modal over a dimmed map and must not have a
language button floating on top of it. Every interface string is in `data/ui.json`, keyed by language and then
by string id, so a translator never has to open the HTML.

The language is chosen in this order:

1. the `?lang=` URL parameter (`?lang=ru`)
2. a previous choice remembered in `localStorage`
3. the browser's own preference
4. English

Switching languages re-renders the page in place — no reload. Every touch of
`localStorage` is wrapped in `try/catch`, because it throws outright in some
private-browsing modes; if it is unavailable the site simply forgets the
preference between visits.

**The map is not the only page with a switch on it any more.** It was, for as
long as every other page was a view of the map and read `ttb.lang` off it.
The flashcards are on a hostname of their own, where that store belongs to
another origin and is always empty, so that page carries the same switch in
its own header — see **A language of your own to learn it in** under
**Flashcards**. The lists, the account page and splitwise still read the map's
choice and have none of their own; on `splitwise.` the same gap is open and
the same switch would close it, and nobody has asked for it yet.

### Each language is an address

`/?lang=ru` is the map in Russian, and it is also the address the Russian
map is indexed at. The file itself is English — one title, one description,
`<html lang="en">` — and the other nine languages only exist once
`assets/app.js` has run, which a person's browser always does and a search
engine's crawler often does not. So `functions/index.js` serves the same
file with the head written for the language the address names: the title and
`metaDescription` from `data/ui.json`, `<html lang>`, a canonical tag naming
that address, an `hreflang` link to each of the ten so a search engine reads
them as one page in ten languages rather than ten copies of one, and the
JSON-LD block describing every open place with its write-up in that language.
The bare address is English and the `x-default`, and `sitemap.xml` lists all
ten — and every open place at its own address, `?spot=`, which the same
route serves with the place's own head. **Getting found** under **Deploy to
Cloudflare Pages** has the whole of it, including what it costs.

### Adding a language

1. Add a block to `data/ui.json` with the same string ids as the others, plus
   a `langName`, and a `metaDescription` written for a search result rather
   than for the page — `documentTitle` and it are what a crawler reads at
   that language's address. The title's shape is the question first, then
   the kinds of place, then the site's name: *Where to eat in Tallinn:
   restaurants, cafés, bakeries and beer bars | Tallinn Tastebuds*, in that
   language's own words for the question people type. **The words** under
   **Getting found** says which words and why "best" is not among them.
2. Add the matching label to every type in `data/taxonomy.json` and every
   cuisine in `data/cuisines.json`.
3. Add the language to each `blurb` in `data/restaurants.json`.
4. Add `months` — the twelve month names separated by `|` — and `monthYear`,
   the pattern that joins them, in case the language wants a different order.
5. Add the code to `translated` in `data/schema.json`. That one is a literal
   list rather than something read out of `ui.json`, so it is the only place
   that has to be told twice.
6. `node tools/sitemap.mjs`, and commit `sitemap.xml`: the new language is a
   new address for the map, and every other language's entry has to link to
   it. The validator fails on a sitemap that has not been re-run.

The language switch, `functions/index.js`, the sitemap tool and the validator
all read the language list from `data/ui.json`, so there is nothing else to
change. Steps 2 and 6 are the ones the validator fails on: a type with no
label in some language is an error, and so is a stale sitemap, while missing
blurb translations are warnings, so you can ship as you translate. The order
of the blocks in `ui.json` does not matter: the switch sorts the languages
alphabetically by code, so a new one lands in its place on its own.

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

### It is for members

**Every discount needs an account now**, the fixed ones as well as the drawn
ones. It was open to anybody who opened the map, and the offer was worth
exactly as much to somebody passing through as to somebody who comes back.
This is the one thing on this site an account is actually for: saving works
signed out, lists work signed out, a discount does not. What it buys the
restaurant is a person they can count rather than a browser, and what it buys
the site is a reason to sign up that is not a wall in front of a bookmark.

The gate is one request. `functions/api/pass.js` answers
`GET /api/pass?r=<place-id>` with `401` where there is no session, and
`assets/pass.js` turns that into the sign-in card rather than a code. The map
does not have to ask — it already knows who is signed in — so the panel's
button reads **Sign in to use it**, or **Sign in to draw** on a deal with a
roll, and opens the sheet with the pass page as the place to come back to.
Signing in lands on the pass, not back on the map.

**The offer itself is not behind anything.** The pill on the row, the number
in the panel head, the words under the write-up and the **Discount** chip are
all drawn for everybody, because they are what somebody is deciding on and
they are the advertisement. What takes an account is the code you hold up.

**And it is a door, not a lock.** The keys still ship in `data/deals.json`,
which is public, so a person who reads that file can mint a code without ever
signing in — see [What this is not](#what-this-is-not), which has been true
all along and is no less true now. The account is what the page asks for, and
a human at the counter is what the offer has always ultimately rested on.

### How it works at the table

1. A guest opens a place on the map and presses **Show QR**, or **Sign in to
   use it** where they are not signed in yet, which is the same door with a
   sign-in in front of it.
2. `deal.html` shows them a QR, the same code in large type, and a countdown.
   The countdown is in the accent colour with a dot beating beside it, twice
   the size of the small print around it — a picture of the page has frozen
   digits and a frozen dot, so a waiter can tell a live pass from a
   screenshot without checking anything.
3. A waiter points their ordinary camera app at it — no app to install, no
   account, no training. The account is the guest's end of this and only the
   guest's: nobody behind a counter ever signs in to anything.
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

A deal with a **roll** signs `"<place-id>:<hour>:<rate>"` instead, the rate
being the one this account drew for the hour — see
[A rate that is drawn](#a-rate-that-is-drawn).

### The three addresses

Replace `<place-id>` with the `id` from `restaurants.json` — the same slug
`?spot=` uses.

| Who | Address | How they get there |
| --- | --- | --- |
| Guest | `/deal.html?r=<place-id>` | The **Show QR** button on the place's panel. Signed in, or it offers the sheet |
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
3. **In the panel**, under the write-up, the reel and the tags, and directly
   above **Must order**: the offer in words — "15% off your order" — and the
   **Show QR** button that leaves for `deal.html`. A discount is part of
   deciding where to eat, so it reads with the rest of the deciding rather
   than after the dish list you skim on the way out. It stays below the reel
   and the photos all the same — a pass you hold up at a till has no business
   in front of somebody who has not seen the place yet.

The number is not written a second time in the data. It is taken from the
`offer` line the deal already carries in the language being read, which is why
Turkish shows **−%15** — the whole match travels, sign and all, rather than
the digits. A deal with a roll has a run in that line rather than a number,
**5–25%**, and the run travels the same way: **−5–25%**, and **−%5–25** in
Turkish. An offer with no percentage in it, a free coffee or a second
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

### A rate that is drawn

A deal can offer a rate it does not name. Give it a `roll` —

```json
"roll": { "base": 15, "spread": 10, "step": 5 }
```

— and instead of one rate it has a run of them, `base − spread` up to
`base + spread` a `step` at a time: 5, 10, 15, 20 and 25 percent here. Each
member who opens `deal.html` is dealt one of them for the hour. The guest
watches the number run through the whole run for a second and land on theirs;
reloading the page, or closing it and coming back, lands on the same number;
and when the hour turns, the page draws again in front of them, and the same
account may do better or worse. That is the whole game — one draw an hour,
and the next hour is another go — and the line under the countdown says so:
**Good until 15:00, then a new draw**.

**The draw rides in on the same request as the door.** `/api/pass` hands back
one number for the account the session names, and nothing else:

```
draw = HMAC-SHA256(SAVE_SALT, "draw|<user id>|<place-id>|<hour>")   first 32 bits
rate = the run, counted up from the bottom, at draw modulo its length
```

`assets/pass.js` does the counting; the Function never learns the run and
the page never learns the secret. The hour is the Function's own clock, so
nobody can ask what the next hour holds, and nothing is stored: the same
three inputs give the same answer all hour, which is the whole of "it holds
for the hour", and no row was written to make it so.

**Why it is not made in the browser.** A draw made there is either random,
and re-made by a reload, or a hash of something the browser holds, and
re-made by a private window — either way the game becomes "try again until
you like it", which is not what the restaurant is offering. Against an
account the only way round it is a second account, which costs what
[How unique a save actually is](#how-unique-a-save-actually-is) says a save
costs: enough. And where the Function cannot answer at all, the page says the
discount is not available rather than showing a code — for a fixed deal as
much as a drawn one, because one that appeared whenever that request was
blocked would be for whoever worked out that blocking it was enough.

**The rate travels in the code.** A rolled deal's code is
`HMAC(key, "<place-id>:<hour>:<rate>")`, and the QR carries the rate beside
it as `p`. So a code drawn for 10% does not verify as 25%: `verify.html`
rebuilds the code around the rate the link names, treats a rate the run does
not contain as not a discount link at all, and prints the one it checked.
`staff.html` lists a code per rate — this hour's set and the previous hour's
— so the counter reads the guest's five characters down the list and finds
the rate beside them. The by-eye path knows the rate as surely as the scan
does, which is the reason the rate is in the code rather than beside it.

**The offer line writes `{rate}` where the number goes** —
`"{rate}% off your order"`, in every language — and the validator refuses a
rolled deal without it and a fixed deal with it. The pass pages fill in the
rate that was drawn. The map, where nothing has been drawn yet, fills in the
run: the panel reads **5–25% off your order** with a line under it saying the
rate is drawn when you open it and holds for the hour, and the pill beside
the price reads **−5–25%**.

**What the admin sets** is the three numbers, and whether the deal is on,
from the **Discount** tab on `/admin.html` — see
[Setting a discount](#setting-a-discount) — or in `data/deals.json` by hand,
which is the same file the tab writes. Either way the change is live within
the minute, and the next draws are made from the new run. Do it between
services rather than during one: the draw is counted up the run every time
a page opens, so new numbers change what an account drew an hour ago, and a
guest holding a code from the old run holds a code the staff page no longer
lists. `step` is what keeps the run something a counter can read down: 5
gives the five rates above, 1 would give twenty-one, and the validator warns
past twelve.

**What it is not.** The draw is honest and it is the site's; the code is
still the browser's, made from a key that ships in a public file, and
[What this is not](#what-this-is-not) applies to it unchanged. Anybody who
reads the key out of `deals.json` can mint a code for 25% without drawing
anything or signing in to anything, and a human at the counter is the control
against that, as it always was.

### Switching one on

Add an entry to `data/deals.json`:

```json
{
  "id": "bekker-pagariari",
  "name": "Bekker Pagariäri",
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
| `name` | The same name that place has in `restaurants.json`, copied here so the three pass pages never have to load it — see [Why the name is written twice](#why-the-name-is-written-twice) |
| `live` | `false` keeps it invisible on the map while remaining testable by URL |
| `key` | 16–64 characters of `0-9 A-Z`, no `I L O U`. **Different for every place** |
| `offer` | Translations, like `blurb`. A live deal must have `en` at minimum |
| `terms` | Optional small print |
| `from`, `until` | Optional, inclusive. Outside them the button disappears |
| `roll` | Optional. `{ "base", "spread", "step" }`, a run of rates drawn per member per hour instead of one rate, with `{rate}` in every `offer` line — see [A rate that is drawn](#a-rate-that-is-drawn) |

Generate a key with:

```bash
node -e "const A='0123456789ABCDEFGHJKMNPQRSTVWXYZ';console.log([...require('crypto').randomBytes(32)].map(x=>A[x%32]).join('').slice(0,32))"
```

Then `node tools/validate.mjs`. It refuses a deal pointing at a place that does
not exist, two deals sharing a key, a name that `restaurants.json` disagrees
with, anything switched `live` with no words in it, and a `roll` whose run
leaves 1–99 or whose `offer` has nowhere to put the rate. The summary line
ends with a live-deal count, so CI tells you what is switched on.

### Why the name is written twice

`restaurants.json` is around two hundred kilobytes — every pin on the map, with
its photos, blurbs and translations. The three pass pages want exactly one
string out of it, the restaurant's name for the heading, and they were waiting
for the whole file before the QR could be drawn: on a phone on a slow
connection that was a second and a half of blank card, in front of a guest
standing at a till.

So the name is copied into the deal, and the pass pages load `deals.json` and
`ui.json` only. Copied data goes stale, which is what `tools/validate.mjs`
exists for: rename a place on the map without renaming it here and CI fails
with both spellings in the message. Nothing else about a place is duplicated —
if a fourth field is ever wanted on these pages, the answer is a small
generated file, not more copying by hand.

### Testing before anything is public

Leave `live` at `false` and open the pages by hand. They work in full; the
guest and verify pages both show a dashed **preview** band so a dormant deal
can never be mistaken for a real one. Nothing on the map changes, and nobody
who has not been given the URL can find them.

`crypto.subtle` only exists in a secure context, so `file://` will not do —
use the local server from [Run it locally](#run-it-locally). `localhost`
counts as secure.

### What this is not

There is no server behind the code. **The deal keys ship inside
`data/deals.json`, which is a public file on a public site, and anyone who
opens it can mint codes all day.** That is a deliberate trade rather than an
oversight: the thing an hourly code defends against is a screenshot going
round a group chat, and it does that completely. What it cannot do is stop
someone determined, or stop the same guest redeeming twice at two tables — a
human seeing them is the only control there.

**The account in front of it does not change that**, and is not claimed to.
[It is for members](#it-is-for-members) is a decision about who the offer is
for, enforced on the page that shows it; somebody reading the key out of the
file skips the page. The two answer different questions and neither is a
substitute for the other.

If a discount ever starts costing real money, the upgrade is small and this
repo is already set up for it: `functions/api/pass.js`, the first Function
these pages have needed, is already the shape it takes. Add
`functions/api/verify.js` beside it. The key moves server-side, a KV write
makes each code single-use, and only `assets/verify.js` changes — swap the
local HMAC for a `fetch`. Roughly fifty lines, and the guest-facing half
stays exactly as it is.

---

## Saves

The bookmark in the corner of an open place, and the number beside it: how many
people have pressed it. It is the only thing on this site that is not a static
file, because it is the only thing that is about other people.

**It takes no account.** Press it and the place is kept — on this device, in
this browser, which is where the list lives until somebody says otherwise. The
card that comes up afterwards says exactly that and offers an account for the
rest: sign in and the list follows you to any phone, and what this device
already saved goes with you. Press the bookmark again to take it back. The
count hides at zero — a "0" under a bookmark reads as a verdict on the
restaurant rather than as nobody having pressed it yet.

### Where your own saves live, and why one bookmark does both jobs

The count is on the list rows too, not only inside an open place: a small
bookmark and a number beside the price, so a scroll down seventy-four rows shows
which ones other people have kept without opening any of them. Rows at zero
show nothing — a "0" against a restaurant reads as a verdict rather than as
nobody having got there yet.

Press one bookmark and the places are yours to find again in two places, and
both are behind your name: **/account.html** names them, one row each with its
street, behind a fold that says how many, and the map narrows to them. Signed
out the row is on the map's sheet; signed in the page is what the button opens,
and the page's **See them on the map** is the same narrowing under a different
roof — see **The account page**.

Narrowed, the panel names the group **Places I saved** and shows them newest
first: the order you pressed them in is information, and neither the alphabet
that used to order the list nor the distance that orders it now would keep it.
Pressing **All** on the filter row hands the whole map back, the way it does
out of somebody's list.

It used to be a chip on the filter row, second in it, between All and
Discount, and it was in the wrong place. That row answers one question — what
kind of food — and a bookmark is not a kind of food; sitting among the types
it read as a category of the map rather than as something of yours, which is
exactly backwards. The marks are the one thing on this page that somebody put
there themselves, so they live under whoever you are, next to the lists, which
are the other thing.

That door is the reason this site has no separate "save" button. A map you can
narrow to your own places is a saved list by another name, and one bookmark is a
better thing to ask of somebody than a bookmark and a bookmark that mean almost
the same thing.

Signed out, the list is per browser: it is kept on **this device**, so the
phone's list and the laptop's list are different lists and clearing the browser
clears it. The sheet shows the row all the same — signed out is where most of
the saves on this site are, and it sits directly under the sentence offering to
keep them somewhere better. What clearing the browser does *not*
lose is the save itself — that is a row in the database, and it keeps counting
whatever happens here. Losing the local list costs you the view of your own
saves, not the marks.

Signing in is what makes the list follow a person instead of a device: the
account's list replaces the browser's, it is the same list on the next phone,
and whatever this device saved before signing in is claimed on the way in
rather than left behind. That is the whole of what an account buys, and it is
offered rather than required — see **Where the account lives, and when it is
offered**.

The row is drawn only when there is at least one bookmark, and it goes again
with the last unsave. If the filter is on when the list empties, the filter
comes off with the row — a map narrowed by something nothing on the screen
names any more is a map with no way back. `?type=saved` is deliberately never
written to the address bar: a link filtered by one person's saves is an empty
map for everybody else.

### Where the account lives, and when it is offered

The account button is the **top button on the left rail** — above Surprise
me, the colour swatch and the locate button, because it is the only one
whose answer outlasts the visit, and because once somebody is signed in it
wears their name and so tells them whose list the map is holding. It is
**hidden until `/api/account` says the database behind it is bound**, so on a
deployment without the bindings there is no sign-up sheet to find — with one
exception, which is a browser that has saved something. Saving needs no
Function and no database, and since the marks moved off the filter row this
button is the only way back to them, so it is drawn for them regardless. What
is behind it in that state is the one row and no form: a sign-in that could
only fail is worse than no sign-in at all.

**What it does depends on whether it knows you.** Signed out it opens the
sheet, which is the sign-in form and is a step you take with the map still
behind it. Signed in it leaves for `/account.html`, because what used to be
behind it — your saved places, your lists — are things to read rather than a
step to take. See **The account page**.

Nobody is expected to find it on their own, though. A save made while signed
out brings up a card offering an account, once per visit and never again for a
fortnight after it is turned down. That is the moment worth asking at: there
is now something to lose, and the person has just shown what it is. Asking
before that would be a sign-up wall on a map nobody has decided about yet,
which is the thing this site does not do.

### Why there is no separate "like"

An earlier version of this had a like and planned a bookmark beside it. They
collapsed into one bookmark, and the reason is worth keeping.

Products split the two when a like is **publicly attributable to you**.
Instagram, X, TikTok, YouTube and Reddit all pair a public like with a private
save, and X added Bookmarks precisely because people were using Likes to keep
things and disliked that it broadcast their interest. Where the bookmark is not
public — Airbnb, Spotify, Zillow, Pinterest — one action covers both, and the
bookmark simply means "keep this".

Nothing here is attributable. There are accounts, but no profiles and no
public anything: no visitor can see who saved what, and a username never
appears beside a place. So the social problem that forces the split does not
exist, and asking somebody for a bookmark *and* a bookmark that mean almost
the same thing would be asking twice for one answer.

Calling it a save rather than a like also makes the number honest. "Like" is a
verdict, so a like count mixes *this was excellent* with *I want to try this*.
A save is neither: both of those genuinely are saves, so the count means one
clean thing — this many people kept this place.

The closest analogue to this site, Google Maps, does split them: Save for your
own lists, ratings for the public signal. But its ratings carry your name, and
this site rules out ratings on the first page. One unattributed bookmark is the
version of that which fits.

### On "no scores, stars or rankings"

The top of this file says there are none and there never will be, and a number
next to a bookmark is close enough to that line to be worth naming where the line
actually is.

A save count is a count of people, not a verdict on a kitchen. Nobody rates
anything out of five, and — this is the part that matters — **nothing on this
site sorts, ranks or orders by saves.** The list is ordered by distance and by
nothing else; your own saves are in the order you pressed them; the map draws
every pin the same size whatever its count. There is deliberately no "Most saved" chip, because
that would be a ranking, and the line above is not a slogan.

A list carries two counts of its own — how many people kept it, and how many
times it has been opened — and **one page does sort by them**: `/lists`, every
public list with the most opened first, and the keeps as a chip beside that.
That is a ranking, it is the only one on this site, and it was decided rather
than inherited. The reasoning is under **Public lists**; the short of it is that
ranking lists is a different claim from ranking kitchens, because a
list is a thing somebody made and "the ones most people kept" says nothing
about any restaurant on them.

The line has not moved anywhere else, and the paragraph above still holds
whole: no place is scored, the list of places is ordered by distance and by
nothing else, every pin is the same size whatever its count, and there is still
no "Most saved" chip on the map. The one on `/lists` orders lists, which is
the distinction this whole section turns on.
Your own lists are in the order you last edited them and the ones you kept
are in the order you kept them.

A place off the Google export is the one thing on this site with a number out
of five next to it, and it is the exception that says what the rule is. It is
not on my map; it has no write-up, because nobody here has eaten there; and the
number is printed with "According to Google" in front of it, in the same line
and the same breath. The rule is that **this site does not rate anything** —
not that a card may never repeat what somebody else's rating is, on somebody
else's place, with their name attached. Nothing sorts by it, no place of mine
has one, and the day a score of Google's appears without the attribution is the
day the rule has actually been broken. See **A Google row says whose
description it is**.

If a future change wants to sort *places* by saves, it is changing the
argument of the site rather than adding a feature. That is a decision for a
person, not a patch — which is how the page above was arrived at, and it took
the argument in **Public lists** to arrive at it.

**And on sorting by one, which `/google` does.** Google's numbers already
appear on Google's places, attributed every time — that is settled above and in
**A Google row says whose description it is**. The directory goes one step
further: it offers "Highest rated", "Most reviewed" and "Best overall" — the
rating weighted by the review count, see **Best overall is not the rating**
under **The directory** — as orders, which is a ranking, and the rule says
there are none.

It holds because of what is being ranked. A ranking is a claim by whoever
publishes it, and the only claim this site makes is the map — seventy-five
places somebody ate at, in no order but how far away they are. The directory
publishes
no claim at all: it is a mirror of what Google says about eleven hundred places
nobody here has been to, it says so in its first paragraph before anything else
is drawn, and sorting a mirror by the number written on it is a way of reading
Google's opinion rather than a way of stating one. Refusing to sort it would
not be principled either; it would just make Google's directory harder to use
without making it any less Google's.

**And on ordering by distance, which the map's own list does.** The list used
to be alphabetical and is nearest first now — see **The list is ordered by
distance** — and it belongs in this section, because "ordered by" is the phrase
the whole section is about.

It holds because of what distance is. A ranking is a claim by whoever publishes
it: *best*, *highest rated*, *most saved* each say that one place stands above
another and that I am the one saying so. Distance says where things are. It is
the same kind of fact as the address already printed on the card; it is
measured from the reader rather than asserted about the kitchen; and it
rearranges itself the moment they walk down the street, which is the one thing
a ranking never does. Nobody reads "Pulla Bakery, 91 m" as praise, and the
place that happens to be nearest you is not thereby the best of anything.

The order is also useless as a back door to a ranking, which is the test that
matters: there is no arrangement of where somebody stands that makes the list
say a kitchen is good. So the list has an order it did not have before, and the
rule is untouched.

So the line is not "no number is ever ordered by". It is this: **nothing on the
map may ever be ordered by a score, and no place of mine may ever carry one.**
The list on the front page is ordered by where you are and never by what
anybody thinks, the pins stay the same size, and `data/restaurants.json` has no
field for a rating and is not getting one. If a
future change wants to rank my own places — by saves, by Google, by anything —
it is changing the argument of the site, and that is the paragraph above.

### How unique a save actually is

Be clear-eyed about this: **no save here is proof of a person.** There is no
honest way to tell two people apart on a public web page. What can be done is
make faking one cost more than it is worth, and that is what this does, in
three layers — none of which asks the visitor to do anything.

Requiring an account was tried, and undone. It does make a save mean more: an
account costs something to make and is the same one on the next phone, where a
device id is one per browser and a cleared storage away from being a fresh
one. But it is not proof of a person either — a second account is two fields
away — and the sheet standing in front of the first press cost real saves from
people who would have pressed once and never signed up for anything. So the
press is free again, the account is offered afterwards, and the number under a
place is honestly described as *how many browsers and accounts kept this*
rather than dressed up as a headcount.

**1. Who the save belongs to.** Signed in, that is the `users.id` off the
session cookie — never anything in the request body, so a save cannot be made
as somebody else. Signed out, it is a random v4 UUID the browser made for
itself the first time it saved anything, kept under `ttb.cid`. Either way it
is the `UNIQUE` half of a save, so the same owner cannot save a place twice,
and it is what lets somebody take a save back. The device half is
client-supplied and therefore *not* a defence — anybody can send a fresh one.
It is there to stop honest double-taps and to keep the bookmark filled when
you come back.

**2. A hashed network fingerprint, as a cap.** The Function computes
`HMAC(SAVE_SALT, ip + '|' + user agent)` and allows at most **five** saves for
one place from one fingerprint. The raw IP is never stored and cannot be
recovered from the hash without the salt.

A cap and not "one save per IP", deliberately. Estonian mobile carriers put
thousands of phones behind one public address, and this map is opened from an
Instagram link on a phone more than anywhere else — so a hard per-IP rule would
let the first Elisa customer like a bakery and then silently refuse every other
Elisa customer in the country. Folding the user agent in separates most of them
again; a cap of five leaves room for a household, a table of friends and the
handful of identical phones that will still collide, while the sixth attempt
from one fingerprint on one place is the clear-your-storage-and-try-again loop
this exists to stop.

**3. Turnstile, optional.** Cloudflare's CAPTCHA replacement, in invisible
mode: no puzzle, no traffic lights, usually nothing the visitor ever sees. It
is the only layer that stops a *script* rather than a person — the two above
only handle humans being cheeky. It is off until you set both halves of the
key, and the feature works without it.

What this stops: honest duplicates, a curious visitor pressing twenty times,
and casual gaming. What it does not stop: somebody determined, with a script
and a VPN, if Turnstile is off. If a discount ever depends on these numbers,
turn Turnstile on — and require an account for the press while it does, since
a number that is worth money is worth the wall this one is not.

### Is the database exposed?

No. **D1 has no public endpoint** — there is no host, no port and no connection
string anybody can point a tool at. It is reachable from a Worker holding a
binding to it and from the Cloudflare API with your account credentials, and
from nowhere else. A visitor can only ever reach the two handlers in
`functions/api/saves.js`, which means the attack surface of the database is
that one file. So:

- **Every query is a prepared statement with bound parameters.** No value out
  of a request is ever concatenated into SQL.
- **The only `DELETE` takes an owner as well as a place**, so it can only
  remove the caller's own row. Signed in, the owner is the account id off the
  session cookie and there is nothing in the body to point at somebody else's;
  signed out, removing another browser's row would mean guessing a v4 UUID.
- **A place id not in `data/restaurants.json` is refused**, so the table cannot
  be filled with rows for places that do not exist.
- **Nothing personal is stored.** No IP, no user agent, no name — one salted
  one-way hash, useless to anybody without the secret.
- **The realistic worst case is an inflated number, not a breach.** There is
  nothing in this table worth stealing.

D1 also has Time Travel, so a bad write is recoverable for 30 days.

### Two databases, and never one

There are two, and the difference matters more than it looks:

| | database | who writes to it |
|---|---|---|
| **production** | `tallinntastebuds` | tallinntastebuds.ee |
| **preview** | `tallinntastebuds-preview` | every preview deployment, and `wrangler pages dev` |

Cloudflare Pages gives a project two environments. Production is whatever is
deployed from the production branch; **preview is everything else** — a pull
request, a branch pushed to look at, a deploy from a laptop — each on its own
`*.tallinntastebuds.pages.dev` URL, running the same Functions against the
same bindings.

For a while those bindings were the same binding. `wrangler.toml` declared the
D1 database once, at the top level, and Pages hands the top level to both
environments — so a bookmark pressed on a preview URL while checking a change
was a save on the live map, a test account was a real account, and the live
database's rows were part test data with nothing in them to say which was
which. Nobody notices that for weeks; that is the whole problem with it.

So the two environments are now declared separately, and the split is held in
three places:

1. **`wrangler.toml`** names a different `database_id` under
   `[[env.production.d1_databases]]` and `[[env.preview.d1_databases]]`. Pages
   allows exactly these two environment names — there is no staging — and
   picks between them by whether the deployment's branch is the production
   branch. The preview block is written once and covers every preview
   deployment; Pages has no per-branch configuration.
2. **`tools/validate.mjs`** fails the build if those two ever name the same
   database again, or if either environment stops declaring one. It runs on
   every push and in front of every deploy.
3. **The database says which one it is.** Each carries a row in `meta`
   — `environment` = `production` or `preview` — and every deployment carries
   a matching `ENVIRONMENT` variable out of `wrangler.toml`. `wrongDatabase()`
   in `functions/api/_lib.js` compares them once per isolate and switches the
   whole API off when they disagree: no counts, no accounts, no writes. A
   binding pointed at the wrong database is then a preview with no saves on
   it, which is obvious, rather than a test row in the live counts, which is
   not. A database with no stamp is not blocked — the check cannot tell what
   it is looking at, and failing on a missing row would be worse than the
   thing it guards against.

**The two are not kept in step and are not meant to be.** The preview database
starts empty and stays whatever testing leaves in it; nothing copies rows
either way. If preview data ever gets in the way, empty it — it is not
anybody's data.

Because `wrangler.toml` is the [source of
truth](https://developers.cloudflare.com/pages/functions/wrangler-configuration/#source-of-truth)
once it exists, the D1 bindings can no longer be edited in the dashboard: the
file wins. Each environment's configuration is written by a deployment *of
that environment*, so the preview side only picks up a change to this file
once a preview deployment has run with it — push a branch that is not the
production branch, and Cloudflare's Git connection deploys it as one.
Previews deployed before that still hold the old binding, and the stamp check
is what stops them writing anywhere they should not.

### Setting it up

Both databases exist, in the `EEUR` region, with the schema applied and their
`meta` row stamped:

```
tallinntastebuds          3eb14127-0ef6-4935-954b-e0a593d465ba
tallinntastebuds-preview  3dd762d3-1d31-4e54-9f12-a3c0ad93dbca
```

What remains is in the Cloudflare dashboard, and **secrets are per-environment
too** — the Production / Preview switch at the top of Settings → Variables and
Secrets is not decoration, and a secret added to one is simply absent in the
other:

1. **Set `SAVE_SALT`, twice.** A *secret*, any long random string, once for
   Production and once for Preview — different values, since there is nothing
   to gain from fingerprints being comparable across the two. **The save
   endpoint refuses to write without it**: it fails closed rather than storing
   a weaker hash than it claims to. Changing it later makes every existing
   fingerprint unmatchable, which resets the caps and leaves the counts alone.
2. **Turnstile, when you want it.** Create a widget in the Cloudflare
   dashboard, paste the site key into the `<meta name="turnstile-key">` in
   `index.html`, and add the secret half as `TURNSTILE_SECRET`. Test a save
   after enabling — a misconfigured widget refuses every save.
3. **Continue with Google, when you want it.** Create an OAuth client in the
   Google Cloud console, register the redirect URIs — one per hostname, matched
   exactly, no wildcards — and set `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET`. Both or neither; without the pair the sheets draw
   the username and password they always did. **Turning it on** under
   **Signing in with Google** has the whole of it.
4. **Nothing to bind by hand.** The D1 bindings come from `wrangler.toml`, and
   the dashboard cannot override them.

Re-applying the schema, or setting up a database from scratch:

```
wrangler d1 execute tallinntastebuds         --remote --file=db/schema.sql
wrangler d1 execute tallinntastebuds-preview --remote --file=db/schema.sql

wrangler d1 execute tallinntastebuds --remote --command \
  "INSERT INTO meta (key, value) VALUES ('environment', 'production') \
   ON CONFLICT(key) DO UPDATE SET value = excluded.value"

wrangler d1 execute tallinntastebuds-preview --remote --command \
  "INSERT INTO meta (key, value) VALUES ('environment', 'preview') \
   ON CONFLICT(key) DO UPDATE SET value = excluded.value"
```

The stamp is the one thing `db/schema.sql` cannot carry, because it is the one
value that differs between the two copies. A database that is missing it works
normally and is simply unguarded, so run it.

### How it behaves when it is not there

Every failure is quiet and none of them costs anybody the map. If `/api/saves`
is not deployed, the binding is missing or points at the other environment's
database, the salt is unset or the visitor is offline, the counts simply do not
appear — the bookmark is still a button, the map
still draws, and nothing throws. The counts are fetched last in `boot()` and
nothing waits on them.

A press is optimistic: the bookmark fills and the number moves at once, because
waiting for a round trip on mobile data feels broken. The server's answer
replaces the number a moment later, and anything that goes wrong puts both back
exactly as they were and says so in a toast.

### Where the counts come from, and why not from a `COUNT(*)`

`GET /api/saves` returns every place's count in one request — the map asks once
on the way in rather than seventy-four times — and it reads them from
`save_counts`, one row per place, rather than aggregating the `saves` table.

That is the important part. The obvious query is
`SELECT place_id, COUNT(*) FROM saves GROUP BY place_id`, and it was the first
version of this, but its cost grows with the data and never stops: ten thousand
saves means reading ten thousand rows to produce seventy-four numbers, on a
table that only ever gets bigger. Reading `save_counts` costs one row per place
on the map and never more, however popular the map gets.

`save_counts` is not a cache of `saves`. It is recomputed **from** `saves`, in
the same `batch()` — one transaction — as every insert and delete, so the two
can never disagree. It is deliberately not a `+1`/`-1`: an increment that ran
when the insert had quietly hit its conflict clause would drift, and nothing
would ever notice. `db/schema.sql` carries the statement to rebuild it from
scratch if it is ever suspected of having come apart.

**Nothing runs on a timer.** The count is brought up to date by the write that
changed it. On top of that sit two layers of not-fetching:

- **An ETag**, hashed from the answer itself, so it changes when and only when
  the numbers do. A browser that already has the counts revalidates and gets
  `304` and no body back. This is the part that is genuinely driven by changes
  rather than by a clock.
- **An edge cache copy**, which any save landing in the same Cloudflare
  location deletes on its way out — so a visitor there sees the new number at
  once rather than waiting for anything to expire.

There is still a 60-second TTL, and it is a backstop rather than the
mechanism. The Cache API is per-location: a purge in Frankfurt cannot reach
into Warsaw, so a location that never sees a write would otherwise hold its
copy indefinitely. Anyone who has just saved something never sees a stale
number regardless — the POST hands the new one straight back.

---

## Accounts

Optional, and deliberately the smallest thing that does the job: **a username,
and either a password or a Google account**. No email, no phone, no real name.

That list used to end "no profile, no OAuth". The first stopped being true when
`/u/<name>` was built and the second when Google was added, and the second is
worth a word here because it looks like a reversal and is not: what was
refused was collecting an address and a name and a picture from a third party
in exchange for a sign-in. **Signing in with Google** below is the version
that does not — the scope asked for is `openid` alone, the only thing stored
is Google's own opaque id for that person, and an account is still a username
and nothing else. What an account still holds of its own is a username, a password
hash and, if somebody writes one, two hundred characters about themselves —
see **The line about yourself** under **Profiles**. Everything else a profile
draws is the lists that account published, which were already public.

Saving works with no account at all — the device keeps a random id and the
save is filed under that. An account is the upgrade that makes a list follow a
person to another phone or browser, and signing in **claims** whatever this
device already saved rather than starting anybody over. Nobody meets a wall
before they have a reason to sign up.

For a stretch it *was* a wall: the mark opened this sheet instead of saving,
so that the number under a place would count accounts rather than browsers.
That is undone — the press is free again and the offer comes after it. **How
unique a save actually is** carries the reasoning both ways. The device-owned
rows written before the wall went up are still in the table, and `claim` can
reach them again: signing in on the browser that made them still brings them
onto the account, which it could not do while the wall stood.

### The name is chosen, not handed out

The sign-up sheet opens on an empty box, and for a while it did not.
`/api/account` had a `?suggest=1` answer that put two words and a number
together — `smoky-walnut-418` — checked it against the table so the one
offered would be free, and the field filled itself in a moment after the sheet
opened. It was meant as a kindness to somebody who did not want to think of a
name. It was the wrong kindness: a username here is not an internal handle but
the byline on every list its owner shares and the whole of `/u/<name>`, so the
one thing this site asks anybody to decide about themselves was being decided
for them — and a field that fills itself in under the cursor a moment late is
its own small rudeness on a slow connection.

So the box is empty and the rule is printed under it instead: **3 to 24
letters, numbers or dashes**, plus the part that is actually worth knowing
before you choose — that the name goes on any list you share. It is
`accountUsernameHint` in `data/ui.json`, in all ten languages, and it sits
inside the field's own `<label>` so a screen reader reads it when the field
takes focus rather than never. The rule itself is not new; before, the only
way to meet it was to get it wrong, because the name already in the box had
been built to satisfy it. `USERNAME_RE` in `functions/api/account.js` is the
one that binds — lowercase, opening on a letter or a digit so that a name
cannot begin with the character that separates its words — and the field
restates it as a `maxlength` of 24 and that sentence.

The splitwise page carries the same sheet and lost the same thing, and with it
the `/api/account` request it made on every boot: `/api/split` already says who
is signed in, so a name for the empty field was the only reason that second
request existed.

### What signing in actually does to the rows

`saves.owner` holds a `users.id` when the request carries a session and the
device's own UUID when it does not. The primary key is `(place_id, owner)`, so
the same account saving the same place from two devices is one row and not two.

Claiming is `UPDATE OR IGNORE` then `DELETE`, in that order. A row that cannot
move — because the account already holds that place from another device — is
left alone by the update rather than failing it, and the delete then clears it
away. The result is a **merge**: the union of what the device had and what the
account had, nothing counted twice. Every affected count is recomputed from
the rows afterwards, so a place one person had saved from two devices correctly
drops from two to one.

### There is no reset, and the sheet says so

Nothing proves a password account is yours except knowing its password, so **a
forgotten password cannot be recovered by anyone, including whoever runs this
site**. An account made through Google is the exception and the only one:
Google can prove who you are, and so that account has a way back in that a
password account has not. It is the one practical argument for making an
account that way, and it is why the button is not buried — and it is an
argument about *signing up*, which is the only moment it is on offer now.
The sign-up sheet says that above the button rather than letting
somebody find out later, and the fields carry the autocomplete hints that make
a browser's password manager offer to keep the details — which is what
actually rescues people in practice.

**There was a reset, and it never ran.** An optional address on the account, a
six-digit code to confirm it, another to reset with, all of it through
Cloudflare's own Email Service — written, documented, and switched off on
every deployment this site has ever had, because Email Sending is not on the
free plan. What that bought in practice was a paragraph in this file promising
something the site did not do, three variables nobody set, two columns and a
table nobody wrote to, and a few hundred lines across the Function and the map
that only ever answered "not available".

So it is gone: no address field on the sign-up sheet, no *forgotten your
password*, no `email-add`, `email-confirm`, `recover-start` or `recover-finish`
on `/api/account`, and no `CF_ACCOUNT_ID`, `CF_EMAIL_TOKEN` or `MAIL_FROM`. The
sentence about a lost password was already the truth in this configuration and
is now the truth in every configuration.

**What it left in the database, and what happened to it.** `users.email`,
`users.email_verified` and the `email_codes` table outlived the code by a
few hours. `db/schema.sql` could not take them: it is applied with `IF NOT
EXISTS` throughout, so it can add a table and never remove a column. They
went by hand — `DROP INDEX` first, because SQLite refuses to drop an indexed
column, then the two `ALTER TABLE ... DROP COLUMN`s and the `DROP TABLE` —
against **both** databases, which is the only way a schema change of that
shape happens here. `users` now has the seven columns the file declares and
nothing else.

**If it is ever wanted back**, the shape it had is worth knowing: an address
stored unverified until a code came back, used for nothing but codes somebody
had just asked for. The git history has the whole of it.

### Changing the password

On **/account.html**, along the foot of the card that carries your name:
**Change password**, which opens the map's sheet on that step and comes back
here afterwards. The form itself is on
the map because there is one password form on this site — see **The account
page**. It asks for the one in use and the new one on the same card.

The old password is asked for even though the browser is already signed in.
A session is a browser, not a person — a sheet left open on a shared laptop
would otherwise be a way to take somebody's account off them — so the current
password is checked exactly the way a sign-in checks it, and a wrong one is
counted against the same fingerprint that slows guessing down everywhere else.

**It drops every session on the account and hands this browser a fresh one.**
A password gets changed either because it was dull or because somebody else
may have it, and in the second case leaving the other devices signed in is
changing the lock and posting the old key back through the door. The sheet
says so before the button, because being signed out of your own phone by a
change made on a laptop is otherwise a mystery rather than a consequence. The
new cookie is what keeps the person doing it signed in where they are.

The new password is subject to the same eight-character minimum as a new
account's, and re-derived at the *current* `PW_ITERATIONS` with a fresh salt —
so changing a password on an old account is also the one moment its hash
catches up with the setting, the same way a sign-in does.

### Changing the username

**The name is chosen, and it can be chosen again.** The section above is why
the sign-up sheet asks rather than handing one out; this is the other half of
the same argument. The asking happens at the worst possible moment — somebody
is three seconds into wanting to save a bakery and has never seen a list, let
alone a byline on one — so whatever they type is a first guess, and a site
that lets nobody past a first guess about their own name is a site that
handed them one after all.

It is on **/account.html**, along the foot of the card that carries your name
and first among the three words there: **Change username**, which opens the
map's sheet on that step and comes back here afterwards. It is on the map for
the same reason the password step is — it asks for a password, and there is
one form on this site that does. The step draws the same field as the sign-up
sheet, with the same `maxlength` and the same hint under it, because it is the
same decision being made with more to go on.

**Nothing moves but the name.** The saves, the lists, the keeps, the places
somebody added and every splitwise group they are in are filed under
`users.id`, and no page or table anywhere carries a second copy of the
username: every byline on the site is a join against `users` at the moment it
is drawn. So a rename is one `UPDATE` and everybody reading a list of yours
sees the new name on their next load. `list_items` copies the *place* name
onto the row and that is a different problem — see the comment above it in
`db/schema.sql`.

**It asks for the password in use**, the way a password change does. The
username is what you sign in with, so changing it changes a credential, and a
sheet left open on a shared laptop must not be a way to take somebody's
sign-in off them or to republish their lists under a name they would not have
chosen. A wrong one is counted against the same fingerprint that slows
guessing down everywhere else.

**It does not sign anything out.** A password is changed because somebody else
may have it, so every other session goes with it; a name is changed because a
better one came along, and the account and the secret behind it are exactly
what they were. Being thrown off your own phone for tidying up your name would
be a punishment for nothing.

**What it costs is the old address.** `/u/<the old name>` stops answering the
moment it lands, and so does every link, screenshot and message pointing at
it. The sheet says so before the button, because that is the half nobody
thinks of.

#### The old name is held for thirty days

A name put straight back in the pool is every link to the person who left it
handed to whoever signs up next — and that person can then be them, in the
one place the site says who somebody is. So a rename writes the old name to
`username_holds` with the time it was released, and for thirty days after
that neither a sign-up nor anybody else's rename may take it. What is behind
those links is nothing rather than a stranger.

Whoever released it may take it back, which is how a rename regretted the same
afternoon is undone: rename back, and the hold is your own so it does not
stand in your way.

**One row per account, replaced each time**, and that is the whole of the
design. A history would let somebody rename their way down a list of names
they liked the look of and hold every one for a month, which is squatting with
extra steps. One row means a rename releases exactly as many names as it
holds, the table can never grow past `users`, and there is no rate limit to
write: rows outside the window are swept on the way past, the way
`login_fails` is.

Thirty days is a guess, and it is `HOLD_DAYS` at the top of
`functions/api/account.js`. Long enough for a rename to be regretted and
undone, short enough that a name somebody has genuinely finished with comes
back to the pool.

### Signing in with Google

**Continue with Google**, above the username and password on the map's sheet
and on the splitwise page, with a rule and the word *or* between the two. It
is the other way in, and it exists for the reason the password reset does not:
**a reset has to send an email and this sends nothing.** The browser goes to
Google, the person signs in there, and what comes back is a statement this
site checks. There is no address to confirm, no code to deliver, nothing
queued, and none of it needs Email Sending — which is the Cloudflare feature
that is not on the free plan and that took the reset out.

`functions/api/google.js` is the whole of the round trip and
`functions/api/_google.js` everything under it. The account it ends at is an
ordinary account: a row in `users` with a username, and a row in `identities`
saying which Google account reaches it.

#### What is asked of Google, and what is kept

**The scope is `openid` and nothing else.** Not `email`, not `profile`. What
comes back is the `sub` claim — Google's own permanent, opaque id for that
person — and that is the only thing stored. No address, no display name, no
picture, none of which this site has ever had a use for.

Asking for them and throwing them away would be worse than not asking: the
consent screen would name them, and somebody would reasonably conclude this
site now holds them. The one thing an account here is, is a name its owner
chose. That does not change because of the door they came in by.

**It is the id and not the address, which matters more than it looks.** An
address can be given up and reassigned; `sub` cannot. Matching accounts on the
address would mean whoever holds it next inherits the account.

#### The flow, and why this one

The authorization code flow, with PKCE, redeemed server-side. Google Identity
Services — the button-and-a-script version — would have been less code and
was not taken, because it puts a script of Google's on the one surface where
it matters least that it is convenient and most that it is not there. This
way **no third-party script runs on any page of this site**, which is the same
rule the rest of the repo keeps, and the flow is plain `fetch` and WebCrypto
with nothing to install.

PKCE is not strictly needed here — the code is redeemed by a server holding a
client secret, which is what PKCE stands in for — and is sent anyway. It costs
one hash and closes the case where a code leaks out of a redirect and is
redeemed by somebody who also has the secret.

**The ID token's signature is not verified, and that is deliberate.** The
token does not come through the browser: it arrives on the TLS connection this
Worker opened to Google's token endpoint, in the answer to the request
carrying the code, authenticated with the client secret. OpenID Connect says
in as many words (Core 3.1.3.7, item 6) that a client receiving the token
straight from the token endpoint may treat the TLS as the validation. Fetching
Google's signing keys instead would be a JWKS cache, a key rotation to get
wrong and two more ways for a sign-in to fail, to learn nothing the connection
has not already said. What *is* checked is everything TLS does not cover: the
issuer, that the audience is this client, that it has not expired, and that it
carries the nonce this browser was sent with.

#### One route, asked twice

`/api/google` is both halves. A browser asks it once with nothing, and is sent
to Google; Google sends the browser back to the same address with a `code`,
and that is the second ask. One file, and — the part that actually matters —
**one redirect URI to register per hostname** rather than a pair that has to
be kept in step with two route names.

Every ending is a redirect back to where the trip started, carrying one word:

| `?google=` | What happened |
| --- | --- |
| `in` | signed in; the page says who, and claims this device's saves |
| `name` | this Google account has never been here, so the sheet asks for a username |
| `linked` | connected to the account that was already signed in |
| `taken` | that Google account already belongs to another account here |
| `failed` | the swap did not complete |

and **nothing at all** where somebody pressed Cancel on Google's own screen.
Changing your mind is not an error and should not come back as one.

#### Two sealed cookies, and no table of half-finished sign-ups

`ttb_g` carries the trip — the state to compare, the PKCE verifier, the nonce,
where to return to, and whether this is a sign-in or a connect — for ten
minutes. `ttb_gp` carries a Google account that has proved itself and has no
account here yet, for fifteen.

Both are **sealed rather than stored**: the value carries its own HMAC under
`SAVE_SALT`, so a forged one is refused with no table to check it against. A
row per half-finished sign-up would be a table that fills with people who
changed their mind, and a sweep to write for it.

Both are `SameSite=Lax` and not `Strict`, which is the one attribute here that
is not simply the safest available. `Strict` withholds a cookie from a
navigation that started on another site, and the navigation that matters is
the one Google sends back. `Lax` allows exactly that — a top-level GET — and
nothing else.

#### The name is still chosen

A Google account arriving for the first time does not become an account. It
gets the sheet, on a step of its own, asking for a username — and **nothing
is written until it answers**, so a tab closed on that step leaves no row.

The name Google would have offered is a real person's real name out of a
profile this site deliberately never read. The sheet used to hand out
`smoky-walnut-418` and that was taken away for the smaller version of the same
reason: **the one thing this site asks anybody to decide about themselves is
what they are called here**, because it is the byline on every list they share
and the whole of `/u/<name>`. See **The name is chosen, not handed out**.

#### The duplicate nobody wants, and the step that no longer answers it

Without an address there is nothing to match on, so **pressing Continue with
Google while signed out always makes a new account** — including for somebody
who already has one with a password. That is the trap.

There used to be an answer to it: connecting was a thing you did on purpose
while signed in, *Connect Google* along the foot of `/account.html`, and the
two accounts became one. **That step is gone**, and the trap is left standing
— said here rather than left to be discovered. Somebody with a password
account who presses Continue with Google now gets a second account and there
is nothing on the site that joins them; the two would have to be merged by
hand in the database, and the only real protection is that Continue with
Google is on the sheet the first time, before there is a password account to
duplicate.

It went because of what it was on the page it stood on: an offer, to somebody
who had made their account with a username and a password, to start using
Google — every time they opened the one card that is meant to say who they
are. Nobody had taken it up; `identities` was empty on the day it went. See
**The account page**.

**The route still links, and that is not left-over.** The intent is decided on
the way **out**, from whether the request carried a session, and sealed into
the cookie: a signed-in request to `/api/google` connects, a signed-out one
signs in. Deciding it on the way back — "is there a session now?" — would mean
a browser that signed in on another tab mid-trip silently attaches somebody's
Google account to whatever account happened to be open. Nothing on the site
sends a signed-in browser there any more, so `connect()` answers a request
that no page makes; it is the honest reading of a session on the way out, and
taking it out would mean the route lying about what it found.

One Google account is one account here: connecting one that already belongs to
somebody else answers `taken` and changes nothing.

#### An account with one way in, and the two steps that notice

An account made through Google **has no password**. `users.pw_hash` is the
empty string, `pw_salt` empty and `pw_iter` nought, because those columns are
`NOT NULL` and this file cannot take a `NOT NULL` off a live table — see the
note above `users` in `db/schema.sql`. `matches()` in `functions/api/account.js`
is the one place that knows what an empty hash means, and it refuses a
sign-in against one rather than deriving a hash at nought iterations, which
WebCrypto refuses outright. Without that guard a password sign-in against a
Google account would answer 500 where every other failure answers *wrong
username or password* — which would be a way of asking, from outside, which
accounts were made through Google.

Two steps ask for the password in use, and both change shape:

- **Change password** becomes **Set a password**: one field instead of two,
  and it does not sign the other devices out. A password is changed because
  somebody else may have it; a *first* password is a lock nobody has ever had
  a key to, and turning somebody's phone out for adding one would be a
  punishment for tidying up.
- **Change username** stops asking. The session is the only credential such an
  account has got. **That is a real difference and worth saying out loud**: on
  a password account a sheet left open on a shared laptop is not enough to
  rename somebody, and on a Google-only account it is. Setting a password
  closes it, which is the other half of why that step is there.

**Disconnecting needs a password on the account.** Google taken off an account
that has no other way in is an account nobody can ever sign into again, and
there is no reset here to rescue it with. So `google-unlink` refuses, and the
page says what to do instead — which is the step directly above the button.

#### Turning it on

`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the Pages project, per
environment, and the pair or neither: `/api/account` reports Google as
unavailable without both, and every sheet draws no button. Nothing else
changes, and a deployment without them is the site exactly as it was.

**Both as secrets, and the id being public is not a reason to make it a
plain variable here.** It would be on most projects — a client id travels in
the redirect URL and anybody who presses the button can read it. But a Pages
project with a wrangler file makes that file the source of truth for
everything it can declare, and `[vars]` is one of those things, so a plaintext
variable typed into the dashboard is not editable there and never reaches a
deployment. Secrets are the exception, because a secret is the one binding
that must never be in the repository, and the dashboard still owns those. The
only cost is that the id cannot be read back off the page once saved, so keep
your own copy of it.

The other arrangement works too, and is a code change rather than a dashboard
one: put `GOOGLE_CLIENT_ID` in the `[env.production.vars]` and
`[env.preview.vars]` blocks of `wrangler.toml`, where it would be committed,
and leave only the secret in the dashboard. Nothing in the Functions can tell
the difference — both arrive on `env`, and `googleReady()` reads them the same
way.

**And a variable added in the dashboard does nothing until the next
deployment.** Pages binds them when a deployment is built, so the one already
serving the site carries on without them. Retry the latest deployment, or push
a commit.

**Whitespace on either value is trimmed, and the id has to look like an
id.** Both are pasted by hand into boxes that cannot be read back afterwards,
which makes a trailing newline invisible from every side — and a newline in a
client id is not harmless, because the id travels as a query parameter and a
newline is percent-encoded rather than ignored. Google is then asked about a
client called `…googleusercontent.com%0A`, finds none, and answers **Access
blocked: Authorization Error — the OAuth client was not found, Error 401:
invalid_client**: an error page about an application that does not exist, for
a value one character wrong. So `clientId()` and `clientSecret()` in
`functions/api/_google.js` trim once and every reader goes through them — the
authorize URL, the code swap and the `aud` check all have to agree on the
same string, and trimming for the first two alone would leave the third
refusing a token they had just earned.

**Trimming is the two ends, though, and the same paste can carry the same
damage in the middle.** A space between the project number and the suffix, a
zero-width space, a soft hyphen, a Cyrillic `а` in a copy out of a rendered
page: each still ends in `.apps.googleusercontent.com`, so a suffix check
waves it through, and each arrives at Google as `%20`, `%E2%80%8B`, `%C2%AD`
or `%D0%B0` — the same *OAuth client was not found* as the newline, with none
of its one visible cause. So `googleReady()` also requires every character of
the id to be a letter, a digit, a dot, a hyphen or an underscore. That is a
rule about the characters and not about their arrangement, which is why it is
safe to be strict about: every format Google has ever issued draws on that set
and no other.

The shape check is the rest of it. `googleReady()` requires the id to end in
`.apps.googleusercontent.com`, which every Google client id does and a client
*secret* does not — and the secret in the id's box is the mistake the two
dashboards invite, adjacent field to adjacent field, with nothing able to
notice it afterwards. It is the suffix and not the whole shape on purpose:
the part in front has been a bare project number and is now a number and a
hash, and a rule strict enough to refuse a format nobody here has seen would
turn a working sign-in off, which looks like a decision rather than a fault.

**And the part in front has to be there at all**, which is a separate check
because `'.apps.googleusercontent.com'.endsWith('.apps.googleusercontent.com')`
is true: a value that is the suffix and nothing else passes a suffix test.
That is what was in the dashboard on the day Continue with Google shipped. The
id had been truncated to its own tail somewhere between the two consoles, a
saved secret cannot be read back to notice it, and every check here said yes —
so the site spent the day sending Google `client_id=.apps.googleusercontent.com`
and getting *the OAuth client was not found* back, which reads as a deleted
client rather than as an empty box. `googleReady()` now wants the value longer
than the suffix as well as ending in it. A body of any length satisfies that,
so the looseness about what the body may *look* like is untouched.

**Which means a malformed pair now reads from outside exactly like an
unconfigured one** — `google: false`, and every sheet draws the username and
password alone. That is the better failure for a visitor, who can no longer
press a button nobody can use, and the worse one for whoever is setting it
up, so here is how to tell the two apart from outside:

```bash
curl -s -o /dev/null -D - 'https://tallinntastebuds.ee/api/google' | tr '&' '\n' | grep -i client_id
```

`/api/google` asked with nothing is the way out, so its `Location` is the
authorize URL and the `client_id` in it is the exact bytes Google is being
given. A `location:` of the site's own root with no `client_id` at all is the
guard at the top of `onRequestGet` in `functions/api/google.js` sending a
hand-typed request home, which is `googleReady()` saying no *or* a missing
`DB` binding *or* a database disagreeing with its `ENVIRONMENT` — the three
share one landing, and `/api/account` tells them apart (`google: false` with
`ready: true` is the first of them).

**From a phone, Google's own error page carries the same bytes**, which
matters because that page is usually where this is first seen and a terminal
usually is not. The **Request details** line on it expands, and the
`client_id` among what it then lists is exactly what this site sent. Same
answer as the curl, on the screen already in front of you.

**Read the whole `client_id`, and read what is in front of the suffix.** The
tell that cost a day was visible in that parameter the entire time and got
skipped, because `…googleusercontent.com` at the end of it looks like an id at
a glance and the eye stops there. `client_id=.apps.googleusercontent.com` — a
dot where the project number belongs — is an empty box in the dashboard, not a
missing client in the console, and the two have the same error page. It cannot
reach Google any more, but the habit is the point: read the value, not its
tail.

An id that gets past all four checks is one Google will at least look up, so
an `invalid_client` past this point is not about the value in the Cloudflare
dashboard at all: that client is not in the Google console. Deleted,
recreated with a fresh id at some point after this one was pasted, or sitting
in a project that has itself been deleted or suspended — Google also removes
an OAuth client that has gone unused for six months. The fix is in the
console rather than here: use the id of the client that actually exists, or
make a new one and register its redirect URIs, then paste that id into both
environments. And a `redirect_uri` Google refuses is a different error —
`Error 400: redirect_uri_mismatch` — reached only once the client itself has
been found. So `invalid_client` is never a reason to go adding redirect URIs.

**Driving it locally needs a `.dev.vars`,** which is the file
`wrangler pages dev` reads secrets from — the dashboard is for deployments
and `pages dev` never sees it. `http://127.0.0.1:8788/api/google` is a
registered redirect URI for exactly this reason:

```
SAVE_SALT="any long random string"
GOOGLE_CLIENT_ID="…apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-…"
```

It is gitignored, along with `.dev.vars.*`, and it is the one file in this
repository that must never be committed. It went un-ignored for the first day
Google sign-in existed, which is the only reason the line is worth writing
down.

The rest is in the Google Cloud console — an OAuth client, a consent screen,
and the **redirect URIs, which are per hostname and matched exactly**:
`https://tallinntastebuds.ee/api/google`,
`https://splitwise.tallinntastebuds.ee/api/google`, and the preview host you
actually open. Google accepts no wildcard, so a new preview branch is a new
URI to add — the one part of this that cannot be made to look after itself.
`http://127.0.0.1:8788/api/google` is allowed too, which is what makes
`wrangler pages dev` able to run the whole thing.

And `db/schema.sql` applied to both databases, for the `identities` table.

**The deploy is safe before that happens, and it is written that way on
purpose.** Nothing in this repository applies the schema — a person runs it,
and a push is live within the minute — so there is always a window where the
code is deployed and the table is not. The one read that would fall into it is
`hasGoogle()` on every signed-in request to `/api/account`, and it is wrapped:
no table means nothing is connected, which is the truth about a database with
no identities in it. Unguarded it would have taken that whole answer down for
the length of the window — no name on the rail, no saves, no lists, an account
page saying accounts are switched off — which is exactly the shape of failure
the `about` column is guarded against a few lines above it.

### How it is kept safe

- **Passwords** are PBKDF2-HMAC-SHA256 through WebCrypto — there is no bcrypt
  or argon2 in a Worker without shipping WASM. The salt and the iteration
  count live on the row, so the count can be raised later and old rows
  re-derived on their next sign-in without a migration.
- **The iteration count is capped by CPU, not by taste, and the default is
  low.** Measured on a comparable machine: 10,000 iterations costs ~5ms,
  100,000 ~49ms, and OWASP's 210,000 ~112ms. The Workers **free plan allows
  10ms of CPU per request**, so the default is **10,000** — the most that
  reliably fits, and well below what anybody would recommend in the abstract.

  What it protects is a username and a list of restaurants. No email, no
  address, no payment. It is the difference between a leaked table being
  readable and being work, and it is not a claim to be proof against a
  determined attacker. That is a real trade and it is written down here rather
  than left to be discovered.

  **To raise it**, set `PW_ITERATIONS` in the Pages project — on the paid plan,
  where the budget is 30 seconds rather than 10 milliseconds, use `210000`.
  Nobody is stranded by that: every row carries the count its own hash was made
  with, so old passwords keep verifying, and a row behind the current setting
  is re-derived the next time its owner signs in successfully. Only upwards —
  lowering the setting never weakens a hash that is already stronger.
- **Session tokens** are random, and only their SHA-256 is stored. A leaked
  sessions table is a list of hashes, not a drawer of working keys.
- **The session cookie** is server-set, HttpOnly, Secure and SameSite=Lax.
  Page scripts cannot read it, and — this is the practical part — Safari's
  seven-day cap on script-written storage does not apply to a cookie the
  server set, which is the difference between a sign-in lasting a week and
  lasting a year on an iPhone.
- **It is scoped to the domain, not to the host**, so that one account covers
  `tallinntastebuds.ee` and the splitwise subdomain under it — see
  **[Splitwise](#splitwise)** for the whole of that argument. Only where the
  domain is actually ours: a preview at `*.tallinntastebuds.pages.dev` gets the
  host-only cookie it always had, because a `Set-Cookie` naming another
  registrable domain is dropped by the browser and the sign-in would silently
  not take. The cost is that every subdomain of `tallinntastebuds.ee` now
  receives the cookie, so nothing may be hosted under one that should not hold
  a session token.
- **Guessing is the attack**, since there is no reset link to phish and no
  address to intercept. Ten wrong passwords from one network fingerprint in
  fifteen minutes and that fingerprint waits.
- **"No such account", "wrong password" and "that account has no password"
  give the same answer**, so the endpoint cannot be used to find out which
  usernames exist, nor which of the ones that do are reached through Google.
- **A password change drops every session** on that account, not just the
  current one — see **Changing the password** above. Setting a *first*
  password does not, and **Signing in with Google** says why.
- **Changing a username needs the password too**, because the username is
  half of what signs you in — see **Changing the username** above. An account
  with no password is the exception, and the trade is written out under
  **Signing in with Google**.
- **The Google cookies are sealed, not stored**, under the same `SAVE_SALT`,
  and neither of them ever holds anything but an opaque id and the mechanics
  of one round trip.

### Turning it on

Nothing to do. The account tables are already applied, and accounts work as
soon as `DB` is bound and `SAVE_SALT` is set — both of which the save feature
needs anyway. There is no third variable and no second service.

**Continue with Google is the one optional extra**, and it is off until
`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both set — see **Turning it
on** under **Signing in with Google**. Without them every sheet draws the
username and password it always did.

---

## The account page

`/account.html`. Your name, the line you wrote about yourself and the door to
your public profile, with everything you can do to an account along the foot
of the same card; then the places you saved, the lists you wrote, the box that
makes another and the ones you kept. Nothing after that: the page ends where
it stops being about you.

It was a menu in the sheet the map opens, and the menu is what went wrong with
it. A sheet over the map is for something you do and dismiss — sign in, change
a password, read one sentence — and it is drawn small on purpose, because the
map is behind it and the map is the site. What had collected in there was not
that: saved places and lists are things to look at and come back to, and four
rows that each said "somewhere else" was a table of contents standing in for
all of them.

So the doors became the things. The page names the places rather than offering
to filter the map by them, and names the lists rather than linking to the page
that names them:

```
etibar                          the name, one line saying what the page is,
  Eating my way through …       the line you wrote about yourself, with the
  Change your line              word that opens the field again under it,
  Your public profile >         the door to how it looks to everybody else,
  Learn Estonian >              the account page's own door to the decks,
  Change username ·             and everything you can do to the account
  Change password · Sign out
Places I saved        8 places  a fold: six rows a place, newest first
  Show more                     inside it, once there are more than six
  See them on the map           outside it, so a long fold cannot bury it
Your lists             3 lists  a fold: six rows a list
  [ Name a list ] [ Make it ]   outside the fold, one line high
Lists you saved         1 list  a fold: six rows somebody else's
```

Four cards, one thing each, in the order of how much each is yours: who you
are, what you kept, what you wrote, and what you kept of other people's. There
was a fifth under them — **Everybody's lists**, the way on to the directory —
and **Everybody's lists is not on this page** below is where it went. The last
three were a group with a heading over them for a while, **Yours**, and
another over that fifth card, **Everybody else's**, the quiet heading `/lists`
puts over a run of rows, `.lists-section`. They went again: on a phone they
were two more lines between your name and your things, and each said what the
titles under it already say — *Places I saved*, *Your lists* and *Lists you
saved* are yours by their names. The order carries the argument on its own.
The lists you wrote and the lists you kept had one card between them for a
while, two folds with the box that makes a list standing between — and that
card was the one on the page nobody could read at a glance: two titles, a
form, and the second title reading as a footnote to the form rather than as
the column it was. One card, one column, is what every other card here is.

### The second door on that card

**Learn Estonian**, under the profile: forty-two decks of Estonian and
the ones you write yourself — see **[Flashcards](#flashcards)**. It is a row rather than
a word along the foot for the reason the profile is: a door is a place to go
and a word is a thing you do to the account.

**It used to be the only link to that feature anywhere on this site**, and a
pill on the map's own rail has since joined it — **How it is found, which is
two doors now** under **[Flashcards](#flashcards)** is that half of the
story. What has not changed is why this one is here rather than in the map's
chrome: here because the decks you write are your own things in the way a
saved place is, not a kind of list, and — unlike the rail's — because the
account page is where your own things already live.

That makes this card two doors and three words, which is one more door than it
had. The ceiling is the design rule about a list of choices being rows rather
than a stack of links — two rows are a list, four would be the menu this page
was built to stop being. A third door wants an argument, not a line.

### Two pages open with your name, and this one says which it is

`/u/<you>` and this page start the same way — an eyebrow, the name, a
sentence — and for a while nothing on either said how they differed. The
first card here carries the one door that is about *you* rather than about
any of your things: **Your public profile**, with the line *How your lists
look to everybody else* under it. That line is what tells this page from
that one. The door was filed under **Your lists** once, which was the wrong
drawer twice over: it is about you rather than about any one list, and down
there it sat under the very column it is the outside view of. Then it shared
a card at the foot of the page with the password and the way out, which were
the wrong company: those two change the account, and this opens a page.

The door goes one way. For a while the profile's own card carried a matching
one back — **Your lists, private ones included** — and it was a second link
to a page every visitor already has a link to: your name, in the header of
every page, is the account. A door that duplicates the header is a line on
the one card that is meant to read the same to everybody, so it went.

The name, the password and the way out are on the same card, along its foot,
as the quiet words under the row. They have been everywhere else. Under the name as a
menu of three, which made the page read as a settings screen with your saves
filed underneath. In a card of their own at the end, headed **Your account**,
a second heading about the account under a page that had opened with one. As
a bare row after the last card, which looked lost — two words standing in the
wash under somebody else's lists. The card that says who you are is the one
they belong to, and a door is a row while a thing you do is a word, which is
what tells the profile from the password at a glance. One row and three words
under the name are not the menu that made it a settings screen: that was
three *rows*, each the width of the card, standing between somebody's name
and their things. **Change username** came last and stands first, because a
name is reached for far oftener than a password and the way out belongs at
the end.

### There is one page about you, and this is it

For a while there were two. This page named your lists under your account;
`/lists.html` named them again, with the box that made a new one and **Lists
you saved** beside it. Neither page was wrong on its own, and together they were
a fork: your things were on your account, except the half of them that was
somewhere else, and each of the two carried a row pointing at the other —
**Make a list** led from here to a page that led back.

The box is here now, and so are the lists you kept. `/lists.html` no longer has
an index at all: opened with no list, no person and no directory to draw, it
replaces itself with this page before it fetches anything, carrying the query
string so `?lang=` and `?style=` survive the hop. `location.replace` rather
than an assignment, so the back button goes wherever somebody came from instead
of to a page that would only send them here again — and it happens in `boot()`
before the first request, so there is nothing to flash.

What is left in `lists.html` is the three addresses that are about something
which is not you: one list, one person, and everybody's. See **The three
addresses** under **Lists**.

Deleting a list ends here too, for the same reason: it used to end on the index
of your own, and that is this page.

### Everybody's lists is not on this page

There is no way on to the directory from this page, and there was one in every
shape anybody could think of first. Four of them, in this order:

**It was a row at the foot of the lists card.** Under a fold that could be
forty rows deep, the only way from your own things to anybody else's, reading
like a footnote to your own.

**Then it was a card that named three real lists**: the title, how many people
kept each one, whose it is, and the first three places on it. The argument for
that was a good one — the row's name, which was "Public lists" then, told
somebody who had never opened one nothing they did not already know, where
*The bakeries worth the walk · saved by 5 people · created by kringel ·
Ferment · Kaerajaan · Rataskaevu 16* tells them whether to press it. Half of
that argument was answered by renaming the page rather than by drawing three of
it. What the card also was, was three strangers' top tens standing among
somebody's own things on the one page that is about them, off a third request
made on every load — `/api/lists?all=1`, twenty of everybody's so that three
could be drawn — whose entire yield was three rows nobody had asked for.

**Then it was a `door()`**, the same `.menu-row` the map's account sheet draws
its ways-on in and the shape **Your public profile** still wears at the top of
the page. What it looked like was the argument against it: a `.menu-name` is
15.5px, and under four cards carrying their titles at 26px the last one read
as a footnote set in a smaller type. The stylesheet was already apologising
for it too — a card whose only content is a row had to have the hairlines that
separate a row from its neighbours taken off again, because the card's own
edge was drawing that line a few pixels further out.

**Then it was a card whose whole face was the press**: an `<h2>` in the page's
own title size, the chevron at the end of it where a fold puts one, the
sentence under, and `.lists-open` stretching the title's link over the card —
rule 8 obeyed rather than dodged. What told it from the folds over it was that
its chevron never turned: a fold opens where it stands and that one left.

**And now it is none of them.** Every one of those shapes was an answer to the
same question — how does somebody get from their own things to everybody
else's — and the answer this page kept giving was one more card under the four
that are about them. Two other surfaces answer it already and neither is on
this page: the pill on the map's rail, and the dock at the foot of every
list, both of which report `lists_all` the same way this card did. A page
named for somebody's account does not also have to be the way to a stranger's,
and four rebuilds of one card is the page saying so itself.

**What it costs, said plainly.** Signed out, that card was the one thing here a
stranger could open without an account — the shop window, and the answer to
"make an account" being a poor thing to say to somebody who has not been shown
yet what a list looks like. It is a real loss and it is taken knowingly: the
directory is one press away on the map's rail, and the map is where nearly
everybody arrives.

It also means `/lists.html`, which sends anybody with the old index address
here before it draws anything, now sends them to a page with no way back to
the three addresses it kept. The way back is the mark in this page's own
header, which is the map, and the pill on the map's rail under it — two
presses where there was one.

### The columns fold, and the ways on do not

A column of names is what this page is for, and it is also what buried the rest
of it. Forty saved places and a dozen lists put the box that makes a list and
every way out a scroll and a half down the page, under the very things they
were the way out of.

So each column is a `<details>` behind its own title, with the count of what is
inside it on the line you press, and the ways on sit outside the fold. Signed
in with all three closed, the whole account is one phone screen: your name,
the door to your profile and the way out, how many places you kept, how many
lists you wrote, the field that names the next one, and how many you kept of
other people's — with every door out in sight without scrolling.

**An open one is six rows and a Show more, not the whole column.** A fold that
opened onto forty names was the same burial one press further in: the box that
makes a list, the way to the map and every card under the one you opened went
back below the scroll, which is the thing the folds were written to stop. Six
is what leaves the next card's title on the screen at the 390px the layouts are
measured against, so an open column still reads as one card among several. The
rest is one more press and no request — every row arrived with the page — and
what keeps six from reading as all of them is the count on the line you
pressed, which says how many there are. The word is `.lists-more` and
*Show more*, the same control the directory ends its own rows with, because it
is the same job one page along.

A closed fold is not the menu this page was made out of. A menu row said the
name of another page; this one says how many of your things are behind it and
opens them where you are standing. The last card on the page is a door and not
a fold, and that is the distinction drawn rather than broken: there is
nothing of yours behind it, only somewhere to go. Which of the three folds are
open is remembered on the
browser under `ttb.account.open`, so somebody who wants their saves in front of
them every time opens them once. Which of them have been opened all the way is
not: a press that only asked to read to the end of a column is not a setting,
and a page that opened already scrolled past would be remembering the wrong
half of the gesture. A card with nothing in it — no saves yet, no
lists yet — is not a fold at all, because a chevron promises something behind
it.

`<details>`, rather than a button and a list with `hidden` on it. The open
state, the keyboard, the word a screen reader says before the title, and
find-in-page reaching into a closed one are all things the browser already
does; what is left for the script is remembering the choice.

**The box that makes a list is the thing that rule was written for.** It stands
between the two folds, one line high, and neither of them can push it off the
screen however long they get. It carries the page's one filled button, because
it is what the page is asking for — see **The design rules**, rule 5. Its
refusals are drawn above the field and not under the button: nobody looks under
a button they have already pressed, and `.ac-err` is the same line the account
sheet uses for the same job.

**Your public profile**, the password and the way out went the other way, to a
card of their own at the foot. They were three controls under your name, which
is where a menu puts them and not where anybody wants them: nobody opens this
page to change a password, and standing them between your name and your things
made the page read as a settings screen with the saves filed underneath. The
name is the top of the page; what you can do to the account is the end of it.
The profile is a `.menu-row` down there rather than a word along the foot,
because it is a place to go — everything you have published, read the way a
stranger reads it — and the ones beside it are things to do.

**Google is a fourth word along that foot on exactly one kind of account**:
the kind that was made through Google. There it reads *Disconnect Google*, a
button rather than a link because it is one row and a redraw — the
distinction this site draws everywhere — and the password word beside it
reads **Set a password** rather than *Change password*, because such an
account has never had one.

On every other account there is no Google word at all. There was: *Connect
Google*, a link to the round trip, offered to anybody signed in. An account
made with a username and a password is an account somebody chose not to use
Google for, and a page that offers it to them anyway is a page arguing with
that decision on the one card meant to say who they are. So the foot is a
word shorter for nearly everybody, and disconnecting is one-way — which is
the same rule read backwards: once Google is off, the account is one made
without it, and it is not offered. See **Signing in with Google** for what
that costs.

### What is left on the map

The sheet, and only what a sheet is good at: **signing in**, **creating an
account**, **Continue with Google**, the **naming step** behind it, the
**password** step and the **username** step. Every one of them is a thing you
do and dismiss with the map still behind you, which is the test.

Two of those are no longer the sheet's alone, and neither is on the map: the
feedback composer makes an account, enters one, and names a Google account
that arrives without one, because the moment to ask is the moment somebody has
written something they want their name on — see **Feedback**. What the sheet
still has by itself is the password step, the username step and signing out. The button on the rail is
what tells the two apart — signed out it opens the sheet, signed in it leaves
for this page — and `?account=me`, the old link to the menu, redirects here.

There is still exactly one password form on this site and it is still the map's
— and the username step is on the map because it is one of them: renaming an
account asks for the password in use, for the reason **Changing the username**
gives. This page links into both with `?then=/account.html`, the same road
`/lists.html` took to the sign-in form for as long as it had an index, and for
the same reason: a second copy of a password form is a copy that quietly stops
matching the API. The step comes back here when it is done, because here is
where it was pressed.

### Signed out is a real state on it

A save needs no account, so the page has something of its own to show before
anybody has signed up, and shows it: the places kept on **this browser**, out
of `localStorage`, with the offer of an account above them rather than a wall
in front of them. The one filled button on the page is that offer, and it is
the only place the accent is spent — see **The design rules**.

The offer makes two sentences and not one, because this is where `/lists.html`
sends a stranger now: a save needs no account and a list does, and somebody who
arrived asking about lists should not have to work out which of the two this
page is about. Under it stood the public lists for a while — the one thing here
anybody could open without signing in, and the answer to "make an account"
being a poor thing to say to somebody who has not been shown yet what a list
looks like. That card has gone; see **Everybody's lists is not on this page**,
which is also where what it was worth is written down.

Accounts switched off on a deployment is the third state, and it is not an
empty page either: it says so in one line and draws the saved places anyway,
because those never needed the database. Nothing else is drawn — the lists are
the database, and there is none.

### It has no stylesheet of its own

`styles.css` for the tokens, the card, the eyebrow, the four controls and the
error line; `lists.css` for the brand header, the stack, the field, the box
that makes a list and the row a column of things is built from. The rows are
`.lists-all-card` — the row `/lists` draws — and not `.lists-index-card`, which
leaves 54px along its bottom edge for the map pill laid over it. These rows
have one destination, so that padding would be a hole in a card with nothing
standing in it. Its own comment in `lists.css` says as much, which is
how this page came to use it.

The card is a box and the title inside it is the link, stretched over the whole
face by `.lists-open`. That arrangement is here for the same reason it is on
the directory: a byline in the line of facts is a door to whoever wrote the
list, and a link inside a link is not a thing HTML has.

Two things are all this page has cost either sheet, and they are both in
`lists.css`. The fold: a dozen lines of `.lists-fold` that take the browser's
own marker off a `<summary>`, lay the title, the count and the chevron along
one line, and turn the chevron a quarter when it opens. The chevron is
`.menu-go`, the same mark the rows under it wear, so a row that opens another
page and a title that opens where it stands point the same way at what they do.
There was a third, `.lists-door` — a `position: relative` and a hover, which is
what made a whole card a press — and it went with the card it was written for.
And `.lists-about`, which is the room the line about yourself stands in: the
same room whether what is in it is the line or the field, so the card does not
shift under your hand when the field arrives. `.lists-new` grew a margin
of its own when the box arrived here, for the reason its comment gives: what is
over it is a `<summary>` when the fold is closed and a column of lists when it
is open, and neither of those can carry a margin that only means something
under a form.

That is the whole reason a third stylesheet was not written. A page that needed
new furniture would be a page that had drifted from the two that were already
here.

### What it costs to open

Four requests, all at once, and one paint when the last of them lands:
`data/ui.json` and `data/places.json` off the static side, `/api/account` and
`/api/lists` off the Functions. There was a fifth, `/api/lists?all=1`, for the
three of everybody's lists the foot of the page used to name; those became a
door and the door has gone too. The list answer is asked in the same breath as
the one that says whether there is anybody to ask about — waiting would be a
second round trip, and a page that drew twice would draw a card and then move
it.

One answer carries both halves of what is yours — the lists you wrote and the
ones you kept — and that is one request rather than two because they are the
same question asked of the same person. Everybody else's are a question about
somebody who is not you, and they stay a separate module all the way down;
`functions/api/_lists.js` and `functions/api/_mostkept.js` have never been one
for exactly that reason. This page simply no longer asks the second one, and
has nothing on it that would.

Nothing is cached: both API answers are `no-store` and both are about a
session. `data/places.json` is 13KB and revalidates like everything else.

### The one thing it costs a visitor

Places I saved used to be one press from the map. It is now the account page
and then **See them on the map**, which is two — `?saved=1`, documented with
the map's other doors in **Lists**. That is the honest price of
the swap, and it is why that link sits outside the fold rather than in with the
names: folded, the press is still there to be made. The map itself is
unchanged: the filter, the panel, the way **All** hands the whole map back are
all what they were.

---

## Google venues

1,110 places in Tallinn you can eat or drink in, out of the Google Places API,
in the database as a table of their own — `google_venues`. Separate from everything else here on purpose — this is somebody
else's data about the city, not mine about the food.

They come out of `etibarhasanov/allRestaurants`, which sweeps the city with
Google's nearby search and keeps everything with twenty-five reviews or more.
The first pull asked Google for restaurants only and found 750; Google does not
call a café, a pub or a bakery a restaurant, so the sweep was widened to
seventeen types and found the other 360. Refreshing from there is one script,
and `exports/README.md` says which.

```
exports/tallinn_restaurants.csv   the export: 1,110 rows, 18 columns
tools/googlevenues.mjs            turns it into SQL
db/google-venues.sql              GENERATED — what actually loads them
google_venues                     the table, in db/schema.sql
```

`exports/README.md` has the full account of how the export was cleaned: fifteen
columns that were empty in every row dropped, times converted to 24-hour, and —
the one that matters if you ever parse the raw file yourself — hours that
embedded real newlines, so the raw export is 7,309 physical lines for 1,110
records.

### Loading it

```
node tools/googlevenues.mjs --parts
```

That rewrites `db/google-venues.sql` and cuts a copy of it into pieces of
under eighty kilobytes, which is what one paste into the D1 console will take.
Commit the file; the pieces are what you load, and they live outside the
repository because they are the file again.

Then, in the Cloudflare dashboard — Storage & Databases, D1 SQL Database, the
database, its **Console** tab — paste each piece in order and press Execute.
Preview first, then production; both, always, because a preview deployment
that cannot see these places would show an empty picker and look broken for
no reason. Afterwards, in the same console:

```sql
select count(*), sum(map_id is not null), sum(missing_since is not null) from google_venues;
```

The first number is the export's row count, the second how many are also on
the map, and the third should be zero unless a place has genuinely left the
export. A piece that failed halfway can simply be pasted again: every row is
an upsert on its own key.

The file carries no comments, and that is deliberate. The console folds a paste
onto one line, and a `--` comment runs to the end of its line, so the first
heading in the file once swallowed every statement after it. What the
statements are and why is explained in `tools/googlevenues.mjs`, where a
reader is.

Nothing needs installing and no token exists anywhere for this, which is the
whole reason it is done by hand. From a terminal with wrangler signed in, the
same load is:

```
wrangler d1 execute tallinntastebuds         --remote --file=db/google-venues.sql
wrangler d1 execute tallinntastebuds-preview --remote --file=db/google-venues.sql
```

`db/schema.sql` has to have been applied first — it is what creates the table.

### The table is a mirror, and that is the whole rule

`place_id` — Google's own `ChIJ…` key — is the primary key. It is unique across
all 1,110, stable across refreshes, and it is what a list item holds when it
points at one of these. A catalogue slug is lowercase letters, digits and
hyphens, so the two can never be mistaken for each other.

The columns split in two, and the split is the point:

| | |
|---|---|
| **Google's** — `name`, `category`, `cuisine`, `rating`, `reviews`, `price`, `status`, `address`, `postal_code`, `city`, `phone`, `website`, `opening_hours`, `tags`, `latitude`, `longitude`, `maps_url` | overwritten by every refresh, without asking |
| **Mine** — `map_id`, `hidden`, `note` | never touched by a refresh |

So do not hand-edit Google's columns: the correction would survive exactly
until the next sync and then vanish, which is the worst way to lose an
afternoon. If a name is wrong and it matters, promote the place onto the map —
`data/restaurants.json` is hand-written and mine.

They keep Google's own names, `latitude` and `longitude` included, even though
the rest of the site says `lat` and `lng`. The contract of that table is "the
export, in SQL", and a contract with exceptions is one you have to look up.

`rating` and `reviews` are Google's, and they are shown on Google's places and
nowhere else: the card the map draws for a place off this export, and the rows
that lead to it, print "According to Google 4.8 from 3,041 reviews" — attributed,
every time, in the same line as the kinds and the band. Not one of the
seventy-five places on my map carries a score, nothing sorts or ranks by one
except under Google's own name, and that is the rule these numbers do not
touch — see **On "no scores, stars or rankings"** and **A Google row says
whose description it is**. They are also still what decides which of these
places are worth promoting onto the map.

Two things sort by them, and neither is a ranking of anything this site
vouches for. `/google` is a directory of Google's rows, in Google's order, and
it says so — see **The directory**. And five lists, under an account called
`google-statistics`, are Google's top tens, with Google's name in the title
and Google's numbers under every row — see **The five lists Google wrote**,
below.

### Re-running it is safe

Every row is an upsert. Running the file twice changes nothing; running a
refreshed export updates Google's columns and leaves yours alone. The file
closes by marking as missing every row whose key is not in the list it has just
written — the list is in the statement, so what it touches can be read off the
file — and `missing_since` gets a timestamp. **Nothing is ever deleted**,
because a list may be pointing at it and somebody wrote a sentence about it. A
place that comes back is cleared by its own upsert. No statement in the file
touches a row it does not name, so a load that stops halfway has done exactly
the rows above the point it stopped and nothing else.

The upserts are batched fifty to a statement. `wrangler d1 execute --remote`
sends one HTTP request per statement, so this is the difference between
twenty-four round trips and eleven hundred and ten.

`tools/validate.mjs` runs `--check`, so CI refuses a deploy where the export
moved and the SQL did not.

### The 61 that are already on the map

Matched on coordinates rather than names — the names disagree ("Põhjala Tap
Room" against "Põhjala Brewery & Tap Room") while a front door does not move —
with the name as a sanity check, folded down to letters and digits so an
apostrophe cannot break it, and one name allowed to be the other with a word
dropped into it, which is what Google's "Fotografiska Tallinn Café & Bakery"
is to the map's. `map_id` carries the `data/restaurants.json` id,
and it is only ever set when empty, so a correction made by hand survives every
future run.

### Where they are read

The picker in the lists page. It asks `/api/places`, and that route hands back
one roll made of two: the map's own places out of `data/places.json`, and
these, out of the table. About 1,125 in all — see **The roll a list is built
from**.

A row out of this table brings `category`, `cuisine`, `tags`, `price`, `rating`
and `reviews` with it, turned into the map's own vocabulary on the way out and
drawn under the name with Google's name on it — see **A Google row says whose
description it is**.

And the map, for a place on somebody's list that is not on mine. That card asks
for four more columns nothing else needs — `phone`, `website`, `opening_hours`
and `maps_url` — so `venuesByIds()` in `functions/api/_lib.js` selects them and
`/api/places` does not: the picker fetches all 1,110 rows at once, and the
difference is ninety kilobytes of numbers no row on that page prints.

And `/google`, which is the whole table rather than the part either of
those needs: all 1,110 rows in one answer, so a filter can run over them. See
**The directory**.

### The five lists Google wrote

```
tools/googlelists.mjs    reads the export, ranks it, writes the SQL
db/google-lists.sql      GENERATED — one account, five lists, fifty rows
```

Five public lists under an account called `google-statistics`: **Top ten
restaurants in Tallinn, by Google**, and the same for bakeries, cafés, bars
and pizzerias. They are lists in every way the rest of this section means: a row
each in `lists` and `list_items`, a byline that leads to
`/u/google-statistics`, a bookmark, a way onto the map, and a row on `/lists`
ranked by how often it is opened like everybody else's. They had a strip of
their own above those rows for a while — **Start here**, five across on a desk
— and see **One column, and nothing above it** under **Public lists** for what
that cost and why they are ordinary rows again.
The byline is the one thing on them that is not drawn the way every other
list's is: it reads "generated from
Google Maps" rather than "created by google-statistics", because the account
name is an implementation detail and the sentence a reader needs is where the
list came from. `byline()` in `assets/lists.js` — and its copies on the
account page and in the map's panel — swaps the phrase on that one username,
`GOOGLE_BY`, and the link still leads to the account's profile, where the
line under the name says how the order was decided. Its profile is the ordinary one every
account here has, and the line under its name says where the order came
from — see **Profiles**. What is different is who wrote them. The account has
a password hash that is not the hash of anything, so nobody can sign in as
it; `db/google-lists.sql` is the only thing that writes under its name, and
it is generated from the export the way `db/google-venues.sql` is.

The name is hyphenated rather than `google_statistics` because a username
here is lowercase letters, digits and hyphens — `USERNAME_RE` in
`functions/api/account.js`, restated in `functions/api/_profile.js` — and an
underscore is not one of them. Widening that rule for one account would
change what every sign-up after it may be called, which is a larger change
than this account is worth; the two names read the same.

**Why a site that does not rank has five rankings on it.** The map carries no
score and never sorts by one, and that stands. A list is the other kind of
thing here — somebody else's opinion, under their name, with a sentence under
each place — and these five are Google's opinion, under Google's name. The
title says "by Google", the intro says whose numbers they are and that they
are not this map's verdict, and the line under each place is Google's word
for it and Google's two numbers: *Bakery · 4.9 from 1,656 reviews on
Google*. The page already draws both beside a Google row; the line is the
same fact in the list's own voice, and the one copy that survives if a row
ever loses its venue, since a list renders from `list_items` alone.

**The order is not the rating.** Sorted by Google's rating alone, a top ten
is a list of places thirty people rated 5.0, above a restaurant six thousand
people rated 4.8, and that is reporting a small number as a big one. So the
order is the Bayesian average the directory's **Best overall** uses — see
**Best overall is not the rating** — with two settings of its own, both
constants at the top of `tools/googlelists.mjs`:

- `PRIOR` is 300 against the directory's 100. The directory orders eleven
  hundred rows and a place slipping from ninth to fourteenth costs nobody
  anything; a top ten is ten names singled out, and a name that is there on
  sixty reviews is there on a rumour. At 300, 4.5 from five thousand reviews
  comes out ahead of 4.7 from sixty, which is the order a person arrives at
  when they see both numbers side by side.
- `FLOOR` is 100: under a hundred reviews a place is not weighed at all. The
  prior pulls a small count towards the middle, and the middle of a top ten
  is still a top ten.

The mean each place is pulled towards is its own pool's, review-weighted —
what a bakery you know nothing about is likely to score, which is higher
than what a burger bar you know nothing about is. Ties go to the bigger
count, a chain's branches are one row, and a place Google calls temporarily
closed is on none of them.

**The pools are Google's category, and not its tags.** Google gives every
place one category — what it *is* — and a list of tags — what it also
*has* — and the first draft read both, through the directory's `KITCHENS`
table. The top ten bakeries that came out of it had a wine-and-pastry kiosk
fourth, a coffee shop sixth and two chocolate shops eighth and tenth: the
Bakery chip's pattern takes in dessert and confectionery, and a tag is a
thing a place does on the side. A chip that means "also sells pastry" is a
fair filter over eleven hundred rows; a top ten that says "this is a bakery"
is a claim about each name on it, and only the category makes that claim.
So a bakery is what Google calls a Bakery, and a restaurant any category
ending in Restaurant bar the fast-food, takeout and delivery ones.

Two pools let a tag add a place, in one direction each, because a place
can honestly be two of these things. A pizzeria is a Pizza Restaurant, or
an Italian or plain Restaurant that Google also tags Pizza Restaurant: a
pizzeria is a restaurant, so a place can be on both lists, and when Google
reaches for the broader word for one — Como restoran & pizzeria is an
Italian Restaurant to it — the tag is where the pizza went. Only those two
categories, because the same tag hangs on a kebab house and an Indian
restaurant with a pizza on the menu. And a café is a Cafe, Coffee Shop,
Coffee roastery or Tea House, or a Bakery that Google also tags Coffee
Shop or Cafe — RØST, with its tables and its espresso machine. Only a
Bakery, because the same tag hangs on a buffet, a bookshop and seven sushi
restaurants.

Bars are the one pool where a tag can only take a place off, and it is a
veto. The
category alone put a hookah lounge that is also a sushi restaurant first, a
jazz club ninth and a gastropub with a Belgian kitchen tenth — each "Bar"
to Google, none of them what somebody asking for a bar means. So a bar is a
Bar, Cocktail Bar or Wine Bar that Google does not *also* call a
restaurant, a pub, a hookah place, a venue or a shop: `NOT_A_BAR` in the
tool is that list, and any one of those takes a place off. The lists are narrower than the chips on purpose, and
a place on the wrong list is a category to argue with Google about, not a
pattern to widen.

**Each list's address is fixed.** The six random characters on an id were
minted once and are written into the tool, so a refresh of the export
changes what is on a list and never where it is: a link to
`/list/top-ten-bakeries-by-google-65nfrf` sent today still opens next year.
The file inserts the account once and never touches it again, upserts each
list on its id, and replaces its ten rows whole — a place that fell out of a
top ten has to leave it — so running it twice changes nothing and running it
after a refresh moves the lists.

**Loading it** is the venues file's process, one file later:

```
node tools/googlelists.mjs --show     the five lists, with the score, rating and count beside each name
node tools/googlelists.mjs            rewrite db/google-lists.sql
wrangler d1 execute tallinntastebuds-preview --remote --file=db/google-lists.sql
wrangler d1 execute tallinntastebuds         --remote --file=db/google-lists.sql
```

After `db/google-venues.sql`, always, because the rows point at its keys.
`tools/validate.mjs` holds the file to the export the same way, so a refresh
that forgot the lists fails CI.

---

## The directory

`/google` — every place in this city you can eat or drink in, searchable,
filterable, with a map of the matches beside the list. Eleven hundred and ten
of them, out of `google_venues`.

**Nothing links to it.** Not the map, not the lists page, not the sitemap. It
carries `noindex, nofollow` and `robots.txt` disallows it. That is deliberate
and it is the price of the page existing at all: it is Google's description of
Tallinn and this site is one person's, and the two must not be mistaken for
each other by a reader or by a search engine. The first paragraph on the page
says which one it is, in ten languages, before anything else is drawn.

```
google.html            the page, served at /google
assets/venues.js       ES5, one IIFE, like every other file in assets/
assets/venues.css      only what a directory has and the map does not
functions/api/venues.js  GET /api/venues
data/cuisines.json     37 cuisine labels in ten languages
```

### What it shows

A card per place: the name, Google's rating and review count, the price band as
the map's own four-euro gauge, what it cooks, whether it is open right now, the
street, and a row of links — Call, Website, Directions, Open in Google Maps.
Sixty of them carry one more, **On the map**, which is the door to a
write-up: those are the places that are on `data/restaurants.json` as well, and
on this page that is the rarest and most interesting thing a row can say.

The sixty-five places Google calls temporarily closed are in the list and
marked, never dropped and never first. A directory that quietly omitted them
would have somebody walking to one to find out.

### The filters

Search, and five controls: **Open now**, **Cuisine**, **Rating**, **Price** and
the order — best overall, highest rated or most reviewed. There used to be an
A–Z and a nearest-first as well. A–Z went because nobody scans eleven hundred
places by name; somebody who knows the name types it into the search.
Nearest-first went with the permission prompt it needed, the revert it did
when the prompt was refused, and the distance it wrote under every address.
The three left are all readings of the two numbers on the card.

### Best overall is not the rating

The page opens on **Best overall**, and it is a different order from
**Highest rated**, which is also offered. Sorted by Google's rating alone,
the first screen is the nineteen places rated a flat 5.0, none of which has
more than a hundred and fifty reviews — a tea shop with thirty-four sits above
a restaurant four thousand people rated 4.8, and the tie-break on review
count never gets a say because the ratings are not tied. Thirty people all
giving five stars and four thousand averaging 4.8 are not the same claim,
and a directory whose first page is the small one is not telling the reader
what they came to find out.

Best overall is the Bayesian average — the arithmetic IMDb's top list has
used for years — in `weigh()` in `assets/venues.js`:

```
(n / (n + 100)) * rating  +  (100 / (n + 100)) * mean
```

`n` is the place's review count, `mean` is the review-weighted mean of the
whole roll (4.39 on the export as it stands), and the constant is how many
reviews a place needs before its own rating counts for half. A hundred is
under the export's median of 237, so most of the roll is judged on its own
number; thirty reviews at 5.0 comes out at 4.53, in the top half rather than
the top, and 4.8 from six thousand stays 4.79. The mean is computed from the
roll every load rather than typed in, so a refresh of the export moves it
without anybody remembering to.

Both orders are offered because they answer different questions. Highest
rated is Google's number, plainly, and somebody who wants exactly that should
get exactly that. Best overall is that number read with the count beside it,
which is what a person does in their head when they see "5.0 from 34
reviews" — and the score itself is never printed. Every card still shows
Google's rating and Google's count; the weighting only decides who stands
above whom, so the page publishes nothing Google did not say. The
**Rating** filter is on the raw rating, not the weighted one, because "4.5 and
up" is a statement about the number on the card.

All of it is in the address bar, so a narrowed directory is a link somebody
can send.

### Open now is asked of Tallinn's clock

Not the reader's. Somebody looking this up from Lisbon at nine in the evening
is asking what is open in Tallinn, where it is eleven, and answering in their
own timezone would be wrong in the one way they could not spot. Same
`Europe/Tallinn` reading `assets/app.js` takes for story windows. The fallback,
for a browser built without tzdata, is the reader's own clock rather than
Estonia's rule written out a second time: the two disagree by an hour for
somebody abroad and not at all for anybody standing in the city.

The week itself comes through `venueHours()` in `functions/api/_lib.js` — the
same parser the map's own card for one of these places already used, which is
why there is one reader of that column and not two. It turns
`Mon 11:00-22:00; Tue closed; …` into seven days, Monday first, each either the
times as Google wrote them or `null` for a day it does not open, and an empty
array when Google gave no hours at all. Fifty-two rows have none, and "we do
not know" and "shut all week" are different sentences.

The day names come off there, which is the half that matters: `Mon` is English
and the times are digits and a hyphen, so what travels carries no language.
`spansOf()` in `assets/venues.js` turns one day into minutes to answer "open
now" — four lines, at the one place that asks the question, rather than a
second shape sent down the wire. It reads all 4,704 spans across the 4,642 open
days in the export, including the 62 days on which one of twelve kitchens shuts
for the afternoon and reopens, and the 685 spans that close after midnight.

### Cuisines, in ten languages

Google files these places as "Sushi Restaurant" and "Middle Eastern", in
English. None of that reaches the page. `KITCHENS` in `functions/api/venues.js`
matches the category, cuisine and leftover tags as one string and answers with
ids; `data/cuisines.json` and `data/taxonomy.json` say those ids in ten
languages between them.

The two label files are deliberately disjoint. `taxonomy.json` already carries
`asian`, `vegan`, `bakery`, `coffee`, `pub` and `fine-dining` for the map's own
chips, so `cuisines.json` holds only the thirty-seven the export needs on top
of them — copying the six across would be six translations to keep in step with
another six. It is a file of its own rather than a second array in
`taxonomy.json` because the map downloads that one and would be carrying nine
kilobytes it never reads.

Forty-four ids, and every one of them matches at least one row of the export as
it stands. `tools/validate.mjs` fails the build if a pattern stops matching
anything, if an id has no label, or if a label has no pattern. That standard is
why **european** is not in the table: Google hangs it on a hundred and four
rows as the parent of Italian, French and Greek, so a chip for it would return
mostly pizzerias while saying nothing a more exact chip does not.

Two hundred and forty-nine places get no cuisine at all, because Google says
only "Restaurant" about them. No chip is the truthful answer there rather than
a gap.

#### Which two words a card says, and in which order

A card has room for two, and `kitchensOf()` in `functions/api/venues.js` is
what picks them: first everything Google's own `category` and `cuisine` say
about the place, in the table's order, and then everything its tag list adds,
in the table's order. The table runs from the most exact word to the broadest,
which is the right order between two words Google is equally sure about and the
wrong one between what a place *is* and what it also happens to have. Siga la
Vaca is an Argentinian steakhouse that Google types `argentinian_restaurant`
first and `korean_restaurant` fifth, and a directory whose card opened with
**Korean** — because `korean` sits thirty rows higher up the table — was saying
something plainly untrue about it in the two words it had. The one thing that
outranks both groups is the filter: whatever is being narrowed by is hoisted to
the front in `assets/venues.js`, so a card always says why it is in the list.

The `cuisine` column those chips lean on is derived in
`exports/clean_restaurants_csv.py` rather than handed over by Google, and the
same reasoning decides it: the first of a row's types that names a kitchen
wins, an exact kitchen anywhere on the row beats a family name like `asian` at
the front of it, and a `*_delivery` type is skipped because it says how food
travels rather than what it is. That is what turns six Indian restaurants
Google also tagged Chinese or Thai into **Indian**, and every Hesburger into
**Burgers** rather than **American**. Seventy-four of the eleven hundred rows
changed word when that landed, and the count with no cuisine at all did not
move: this is the same evidence read in the row's own order, not more of it.

#### Which column a word came from, for one pattern only

`said()` in `functions/api/venues.js` joins the three columns with a pipe, and
`bar` is the single pattern that cares. **Bar** in Google's `category` is what
the place *is* — "Bar", "Oyster Bar Restaurant", "Hookah Bar" — and `^[^|]*` is
what pins the match there. **Bar** in the `tags` is what it also *has*, which
for a ramen shop and a burger place called Hungry Papa is a drinks licence and
nothing anybody chooses them for.

That distinction exists because the first version did not make it. `pub` carried
a bare `\bbar\b`, which filed **92** places under the map's word for a beer
hall — of which 23 had a beer word in them and the rest were wine bars, cocktail
bars, hookah bars, and restaurants Google had merely tagged. So the two are
separate now:

| id | label | matches | what it catches |
|---|---|---|---|
| `pub` | Beer/pub | 23 | `pub`, `brewpub`, `brewery`, `beer`, `gastropub` |
| `bar` | Bar | 44 | `cocktail`, `wine bar`, `hookah`, or **Bar** as the category |

Three places are both, which is right: BWB Gastro Bar is a bar with a gastropub
tag. Thirty are neither any more, which is also right — Google said nothing
about them but that they serve drinks.

The same over-broad pattern is still in `VENUE_TYPES` in
`functions/api/_lib.js`, which feeds the lists picker and the map's card for an
export place, so the map calls that ramen shop a beer pub too. Different file,
different callers, its own change.

### One answer, cached, and the page does the narrowing

`/api/venues` takes no query parameters. The whole roll goes out in one response
with five minutes on it, exactly as `/api/places` does, and the browser filters
it. That is not laziness about SQL: the page draws a map of every match beside
the list, so it needs every matching pin whatever the filter says, and "open
now" is a question about a week of opening hours rather than something a `WHERE`
clause can answer. A filtered endpoint would mean a round trip per keystroke to
hand back most of the same rows.

The answer is about 270 kB, which is 60 kB on the wire. One rule keeps it
there: **a field with nothing in it is left out** rather than sent as `""`,
`null` or `false`. `maps_url` is not sent at all — the page builds Google's own
URL for a place out of the key it already has, which is forty kilobytes saved
and the same link.

### The dots are not the map's pins

Eleven hundred of the map's markers would be eleven hundred elements and a page
that stops scrolling. These are `L.circleMarker` on the canvas renderer, one
path each, and the whole export draws in a frame. They read their colour out of
the computed style rather than carrying a hex, so pressing a swatch on the map
changes this page too.

Which is also why the kind is said in the fill and not in a glyph. Everywhere
else a Google row is drawn it draws its pin — a cup for a café, a croissant for
a bakery, see **The pins** — and eleven hundred of those would be eleven
hundred elements again, which is the one thing this page was written to avoid.
So the dot takes the tone of the glyph it would have had: `accent` for the
eating half, `sea` for the drinking half, `amber` for the baked and sweet one,
`olive` for the green one. Four colours is as much as a five-pixel circle can
carry, and it is enough to see where the bars are before a word has been read.
The card beside it draws the glyph itself, at a size where a glyph works, in
front of the name.

Pressing a card lights its dot and moves the map to it; pressing a dot lights
its card and scrolls the list to it — growing the list first if the card has
not been built yet, because the list arrives a screenful at a time and the map
has always shown the whole match.

### On a phone

The list and the map cannot share a phone screen and both be useful, so one is
shown at a time and a switch in the pinned bar swaps them. The filter controls
stop wrapping and scroll sideways instead, which is what Google's own chips do
and for the same reason: a bar four rows tall eats half the screen the results
are supposed to be in.

How tall that bar ends up is a question for the browser — five controls, ten
languages, a switch that is only drawn under the breakpoint — so nothing
guesses at it. `assets/venues.js` measures it into `--venues-bar` and the
stylesheet reads that.

---

## Lists

The map is mine. A list is somebody else's.

Everything else on this site is one person's opinion — seventy-four places I
have eaten at, in `data/restaurants.json`, and being on the map is the verdict.
A list is the other thing: a name somebody chose, places they picked, and a
sentence about each one. *Top ten burgers. Where to take your parents. The
bakeries worth the walk.* It carries their username and it has a link they can
send to a friend.

Nothing about it touches the map. The pins, the write-ups and the filters are
exactly what they were; lists live on their own pages,
and the map's door to them is your own account page, filed under whoever you
are.

### The three addresses

```
/list/<id>       one list — the address that gets shared
/lists           everybody's, the most opened first, and a field to search
/u/<name>        who made it, and everything else they published
/?list=<id>      the same list on the map, as pins
```

There were five. `/lists.html` was the first of them — the index of your own
lists, with the box that made a new one — and it is `/account.html` now, beside
the places you saved; the address is still there and replaces itself with that
page before it draws. See **There is one page about you, and this is it** under
**The account page** for why the two were one page's worth of thing all along.

One HTML file serves the first three. `/list/<id>`, `/lists` and `/u/<name>`
each go through a Function of their own — `functions/list/[id].js`,
`functions/lists/index.js`, `functions/u/[name].js` — and each hands back that
same file with the page's own title and social card written into the head and
its answer seeded into the document. That is what makes a shared link arrive
looking like something: a static page has one `<title>`, and the crawler that
builds the preview card in WhatsApp or Telegram does not run the script that
would change it. What the three of them share — the escaping, the head, the
head swap, the seeding and the headers — is in `functions/_shell.js`, written
once because two of those five are the difference between a title somebody
typed and a title somebody typed being executed.

The last two of the three have sections of their own: see [Public
lists](#public-lists) and [Profiles](#profiles).

`/lists` was `/lists/public`, and that was `/lists/kept`. Both of the old
addresses are 301s to it — `functions/lists/public.js` and
`functions/lists/kept.js` are those redirects and nothing else. Why it moved
twice, and why the old ones stay, is at the end of [Public
lists](#public-lists).

That is also why the Function is `functions/lists/index.js` rather than
anything named after the page: `index.js` in a directory is that directory's
own path, which leaves `public.js` beside it free to go on answering the
address it used to be.

The id is the title plus six random characters — `/list/top-ten-burgers-k3fmqw`
— so the link says what it is before anybody opens it, and cannot be guessed
at from a neighbouring one. The random half is what makes a private list
private.

### One door to the lists

Your lists are named on `/account.html`, one row each, behind a fold with the
count on it — and under that fold the box that makes another one, and under
that the ones you kept. Everybody else's are not on that page at all any more;
**Everybody's lists is not on this page** under **The account page** is where
the door that used to be under all of it went, and why.

The map is what carries the door now: the second pill on the left rail, under
the account, wearing a clipboard and leading straight to `/lists`.

It wore the map pin for a day — 📍, the marker an undressed list carries, on
the reasoning that a door should look like the thing behind it. Over a map of
pins that reads as "a pin", which is the one thing the rail does not need to
say, so it is 📋 now: the picture says lists, and the paper disc and accent
collar under it are the map's, which is what keeps it from looking like an
emoji dropped into a pill.

**That pill reverses the decision the rest of this section argues for**, and
it is worth saying why rather than quietly rewriting the argument. What was
taken off the map's corner was a *menu* of lists — three rows promising one
page — at a time when the lists were new, mostly empty, and mostly somebody's
own. Everybody's lists is a page with something on it now, so the promise is
worth making: one pill, one page, no submenu, and nothing about it is a
table of contents. The cost of getting it wrong the other way had become the
larger one — the map is where nearly everybody lands, and a visitor who never
signs in never learnt from it that lists existed at all.

It works signed out, which is now the whole of why it matters rather than one
argument among several: `/lists` needs no account to read, so a stranger meets
the lists on the way in rather than behind a sign-in form, and since the
account page stopped carrying a door of its own this is where a stranger meets
them at all. It is hidden only where
`/api/account` says the database behind the lists is not bound, because a door
onto "Lists are switched off on this copy of the site" is a button that can
only disappoint — the same rule the account button beside it keeps.

There used to be more, and every step of the argument below has been the same
one getting shorter. The map's sheet had three rows for lists once — **Your
lists**, **Your public profile**, **Lists people kept** — and then one, and
then none, because a row in a menu is a promise about a page and three promises
about the same page is a table of contents. The account page then carried two
rows of its own, **Make a list** and **Public lists**, which were the same
mistake one floor down: **Make a list** promised a page that existed to name
the lists this card had just named, and **Public lists** was a footnote at the
bottom of a fold. The first is a text field on that page now. The second went
on getting rebuilt — a card naming three real lists, a row again, then a card
whose whole face was the press — until it came off the page altogether, which
is the same argument arriving at nothing rather than at a better shape. See
**Everybody's lists is not on this page** under **The account page**.

The signed-out cost of having moved everybody's lists off the map's corner was
never about which row — a stranger saw the sign-in form and no menu at all —
and the pill above is what finally answers it: a way to every public list from
the page a stranger actually lands on, with no account in front of it. What
changed before that was only where the old address lands. `/lists.html` sent
them to an invitation with a single row on it; it sends them to `/account.html`
now, where the same invitation stands over the door to every public list,
which they can open without an account — and which is what [Public
lists](#public-lists) is about at more length.

### Making one

Sign in and open your account. The box is on it, between your lists and the
ones you kept: name a list and you land in it, with three empty places in it, numbered, each of them a row you press to
open the search. Three is where a list starts: two places is a pair of
opinions rather than a recommendation. Once the three are filled, **Add
another place** puts more on, up to fifty.

Each row has a box to say what is good about it, which is the point of the
whole feature — a list of names is a search result, and a list of names with a
line each is somebody telling you where to go.

The order is the point of a top ten, so a row is carried to where it belongs.
Press the grip — or anywhere on the row that is not the note box or a link —
and drag it with a mouse; on a phone, hold a row for a moment and then carry it
with your thumb. The rows it passes slide out of the way, the numbers keep up
while the finger is still down, and the page scrolls by itself when a row is
carried to the top or bottom of the screen.

The two objections to a drag are real and both are answered rather than
avoided. On a phone a drag fights the page's own scrolling, so a touch does not
lift a row until the finger has rested on it without travelling: anything that
moves sooner is somebody scrolling, and the page scrolls. The grip is the
exception — CSS has already taken it out of the scroll, so a finger landing
there is carrying a row and cannot be doing anything else. And a drag is no
gesture at all on a keyboard, so the grip is a real button: focus it and the
arrow keys walk the row up and down the list, one place a press, which is what
the up and down buttons used to do. It keeps the focus across the redraw, and
the new position is announced, which those buttons never did.

Nothing is reordered while a finger is down. The rows stay where they were laid
out and the drag only moves them with `transform`; the array is spliced once,
on release, and the page is redrawn from it — so a drag interrupted by a phone
call leaves nothing behind.

**Save** is the last button on the card and it is what writes the list. The
title, the line under it, each note, who can open it and the order are all
edits to a list you are looking at, and they are held until it is pressed —
the page changes under your hands and the server hears about it once, when you
say so. The button is the other half of that sentence too: filled, in the
style's accent, while something is waiting; quiet, in the page's own wash, and
reading **Saved**, when there is nothing left to send. Type a word and delete
it again and it goes back to Saved, because there is nothing left to send.

Two things do not wait, and both are membership rather than content. **Adding
a place** is sent as it happens because the server is the one that decides
whether a place may go on — it has to be on one of the three rolls and the
list has to have room — and a refusal has to arrive while the picker is still
open, not minutes later about a row that had been sitting there looking
accepted. **Removing one** goes the same way, and takes any note typed under
it with it.

The page being hidden — which is what a phone does when the tab is switched
away, and the last moment a script is promised — sends whatever is waiting
over `sendBeacon`. That is not a second Save button; it is the one case where
not sending loses the work outright. Somebody who meant to abandon an edit
closes the tab and finds it kept, and somebody who meant to keep it and forgot
to press Save finds it kept too, and only one of those is a story anybody
minds.

**The pin** is above that, and it is the one field on the card that is a grid
of pictures rather than a box to type in: eight markers in two rows and six
tones under them, and what you press is what this list's places wear on the
map. It is a field, so it sits with the fields. The mouth is not on the
grid and cannot be asked for — a place on the map draws it whatever list it is
on, and the line under the picker says so. **The pins** is the whole of it.

**Who can open it** is two options and not one pill. A single pill printing
the state it was in — "Anyone with the link can read it" — is the sentence
somebody reads twice, because it is either what is true now or what pressing
it would do and a pill cannot say which. Both answers are drawn instead, as
radio buttons under the question, and the filled one is the answer. A list is
shared by default; the accent is spent on **Private**, because that is the
exception and the one worth noticing before you go looking for a link that
will not work.

The two say **Public** and **Private**, one word each. They said "Anyone with
the link" and "Only me", which fitted badly — two clauses in a segmented
control that a narrow phone breaks over four lines, for the two states the
rest of the web already has names for — and which has since stopped being
accurate besides. **Public** now means public: the list is indexed, and it is
on `/lists` with everybody else's. There is still no third state and no
per-person sharing: a link either opens or it does not. The legend above them
carries the sentence.

**Share** sits next to Save and waits for the third place: a link to two
places is not worth sending, and the button says so rather than going quiet.
It hands the URL to the phone's share sheet and to the laptop's clipboard, and
which of those it does is decided by the pointer rather than by whether
`navigator.share` exists. Every desktop browser has that function now, and
there it opens a sheet listing applications with no "copy link" in it — which
is the one thing somebody sharing from a laptop is trying to do. A coarse
pointer is a phone, where the sheet is the whole point; everything else
copies, and says so.

The same button is on the map, in the block under the bar that names the list
— see **Map and List are one switch, drawn twice** above. A list opened from a
link opens the map, and sharing it on from there used to mean a hop through
its own page first, which is a hop a link meant to be forwarded does not
always survive.

### Saving somebody else's

A list has a bookmark on it, and it is the same mark the map draws on a place,
saying the same thing: keep this, I am coming back to it. Press it and the list
lands under **Lists you saved** on `/account.html`, a card of its own under
the one that makes your own. Press it again to let it go.

The count beside it says how many other people kept it. It is hidden at zero,
for the reason a save count is hidden at zero: a "saved by 0 people" under
somebody's top ten reads as a verdict on the list rather than as nobody having
pressed it yet.

Your own lists have no bookmark on them. They are already under **Your lists**,
and the same list twice on one page is not a feature. They do carry the count,
which is the one fact about a list you wrote that you cannot learn by reading
it.

**Saving a list needs an account; saving a place does not.** On screen the two
are the same word and the same mark, which is the honest thing to show — it is
one gesture aimed at two kinds of thing. Underneath they are different objects
and the rules on them differ, and that is worth writing down.

Saving a place is anonymous because it has to work in the first ten seconds,
before anybody has decided anything about this site — so it is filed under a
random id the browser made for itself, and losing it to a cleared browser costs
you the view of your own marks, not the marks themselves.

A saved list is a different object. It is somebody else's page, kept because
you mean to go back to it — usually weeks later, and usually not on the device
you were holding when you found it. A device-owned one would be one Safari
sweep away from a collection with no way back to it, and there is no entry in a
browser's history for a list read once on a laptop. So the owner of a saved
list is always an account.

**The screen says "save"; the code and this document say "keep".** English was
alone in drawing a second verb across the two: every other language on the site
has always used its own word for *save* on both, and a button reading Keep
beside a card called Places I saved read as two features rather than as one
gesture. So the label is Save everywhere a visitor can see it.

Prose still wants the two apart, though — "the lists you saved" next to "the
lists you wrote" is a sentence with a hesitation in it, and the schema has to
name the thing in one word. So the API action is still `keep`, the column is
still `keeps`, `functions/api/_mostkept.js` keeps its name, the `ui.json` keys
are still `listsKeep*`, and anything written down here about holding on to
somebody else's list still calls it a keep. The keys were never tied to the
English string anyway: nine of the ten languages have said *save* under
`listsKeptThis` since the day it was written.

The one thing this costs is that **Save** now names two different presses on
two different pages: the bookmark on somebody else's list, and the button that
commits your edits to your own. They never share a surface — your own lists
carry no bookmark, and the editor card is only ever drawn on a list you own —
and each is the ordinary word for what it does where it stands.

Signed out, the bookmark is not a dead button and not a button that quietly
does nothing: it is a link to the sign-in sheet on the map, named as what it is
for, with the list as where to come back to. Somebody pressing it has just
decided they want the list, which is the moment worth asking at.

The count is as honest as an account is, and the same caveat applies to it as
to a save count: one row per (list, account), so nobody inflates it by pressing
twice, and anybody willing to make ten accounts can add ten. Since nothing on
this site sorts or ranks by it, what that buys is a bigger number and not a
better position anywhere.

### Public lists

`/lists` is every public list on this site, the most opened first, with a
field to search them and a bookmark on every row. It is the only page here that puts
one person's writing above another's, and it is the one thing in this
repository that had a standing note against it. That note is worth quoting,
because it is the argument this section has to answer:

> Note what that would actually be, before building it: a page that ranks.
> The **Saves** section rules out ranking *places*, and that stands. Ranking
> lists is a different claim — a list is a thing somebody made, not a kitchen,
> and "the ones most people kept" says nothing about any restaurant on them.
> It is still a leaderboard, and a leaderboard changes what people write for.
> Worth deciding on its own terms rather than inheriting from this.

It was decided on its own terms, and the decision was yes. Both halves of the
note are true and they do not weigh the same. A list is authorship, not a
kitchen: putting one above another says nothing about anybody's cooking, and
the number that decides the order counts people who opened a piece of
writing. Against
that, a leaderboard does change what people write for, and this page will
have made somebody's list worth gaming to somebody. That cost is real and it
is accepted rather than argued away.

What tipped it is that the alternative was not neutrality. A list travelled by
a link its author remembered to send, and by a search result nothing linked
to. Every list was an island. "No page ranks them" was, in practice, "no page
shows them", and the honest name for that is not restraint.

**It is called Everybody's lists**, in all ten languages and in the `<title>`
a crawler reads — `listsAllTitle` and `listsAllDocumentTitle` in
`data/ui.json`, and `TITLE` in `functions/lists/index.js`, which is English on
purpose for the reason that file gives. It was called *Public lists* until
somebody read that on a phone and said the name told them nothing, which is
what the comments in `assets/account.js` had been saying about it for as long
as that page had a door to it: public is the setting on somebody's own list,
not a promise about a page, and a stranger who has never opened one has no
idea what is behind a word that names a permission. *Everybody's* is whose the
lists are, which is the one thing about this page worth two words — and it is
true in a way *everybody else's* would not be, because your own public lists
are on it too — and now that the five Google wrote are ranked with everything
else rather than set above it, there is nothing on the page the name has to
make an exception for. See **One column, and nothing above it** below.

**What is on it.** Every public list with at least three places — the same
three `assets/lists.js` has always wanted before it will offer to share one,
because two places is a pair of opinions rather than a recommendation, and a
page whose first impression is somebody's half-filled draft recommends
nothing. Nothing is deleted for falling under it; a short list simply is not
listed yet.

**The order** is how many times the list has been opened, then the last edit,
then the id. The last of those three is doing real work: two lists opened the
same number of times and edited in the same millisecond still have exactly one
order, and without it a page boundary falling between them could show one of
them twice. Twenty
rows at a time, and the next twenty arrive on their own as the reader nears
the foot of the ones on screen: a **Show more** button stands under the last
row while there is a page after it, and an `IntersectionObserver` presses it
when it comes within about a screen of the window. The button stays, and
stays pressable, because it is three other things besides the thing the watch
presses — what a browser without the observer gets, what a keyboard reaches,
and the retry after a page that failed to arrive — and while a page is on its
way it is the one thing on the screen that says so. Each page is appended to
the rows rather than the rows repainted, so nothing under a moving thumb is
rebuilt; and the button and its watch are rebuilt after every page, because
the observer reports a change and not a state, and a button still in view
after the rows under it grew — a tall window over short lists — would
otherwise never be reported again. The `lists_more` event says which of the
two it was, `scroll` or `press`, which is how the console will tell whether
anybody still presses the button.

**Lists nobody has opened are not filtered out.** They sort to the bottom,
where they look exactly like the top of the page, because no row draws a count
of anything the order is decided by. A keep count is drawn when there is one
and hidden at zero, the same reason a save count is hidden at zero on the map:
"saved by 0 people" reads as a verdict rather than as nobody having pressed
anything. It is also what makes the page work at all on the day it ships,
before anybody has opened anything.

**The page is laid out for a desk as well as a phone, and they are not the
same row.** It was one 640px column on every screen — the phone page in the
middle of a monitor, with a card per row and eight hundred pixels either side
doing nothing. Above 900px the rows go two across, above 1180px three, and the
main column widens to 1180px for this view alone (`.lists-main.is-wide`, set
by `render()` in `assets/lists.js` on the directory and on nothing else):
every other view keeps the measure a list of sentences reads at. The order
chips share the sticky row with the search field, so what narrows the page and
what orders it are in one place and both stay under the thumb while the page
grows.

**A phone gets the title, the keep count and the three places, and that is
all.** Under that same 900px the row carries no panel of city and no byline,
and the bookmark loses its word and moves to the top corner as a mark — so a
row is a title and two short lines rather than most of a screen, and a reader
scrolling a ranking sees five or six lists at a time instead of one and a
half. What the row is for is picking one list out of twenty; the title and the
three names are what does that, and the rest is what a desk has the width to
add.

It is not a `display: none`. `wide()` in `assets/lists.js` is the same 900px
asked in the script, and a narrow page never builds the panel — twenty rows of
a few hundred SVG circles each — nor fetches the nineteen kilobytes of
`data/city.json` that exist only to fill it. A window dragged across the line
repaints the rows it already has, out of `state.all`, with no request and no
cursor: `watchWidth()`, one `matchMedia` listener set the first time the
directory draws.

**Every row draws the list as a shape on the city.** A small panel at the top
of each card carries the city as pale ground and the list's own places on it,
so a coffee list reads as a cluster in Kalamaja and a Caucasus list as a
scatter east before anybody has read a name. It is the one picture only this
site can draw of somebody's list, and the coordinates already existed. The
list's own dots arrive with the row: the API sends up to ten `[lat, lng]`
pairs per list (`DOTS` in `functions/api/_mostkept.js`), resolved on the
server from the three rolls a list draws from — the catalogue, `google_venues`
in chunks of fifty, and `added_places` — in one batched read that also yields
the three names under the title, so the names cost nothing extra. The panel is
`aria-hidden`: the names under the title are the accessible version of the
same fact, and so is the label in its corner.

**And each place on it wears the list's own mark.** Its ten flames, or its ten
balloons — the same glyph standing in front of the title under the panel,
drawn at about the size of a pin on the map. They were plain dots in the accent for as long as
the panel existed, which is the colour every list's places drew in, so the
only thing telling two panels apart was the shape of the city under them: two
lists of the same ten streets drew the same picture twice, and a page of
twenty was twenty red scatters somebody had to read the titles of. The mark
makes the picture and the name one thing rather than two things that happen to
be on the same card, and it costs nothing to send, because the pin was already
on the row for the title. A list nobody has dressed wears the default pin,
like its title does — see **The pins**.

There was a second size of it, sixteen units, for the five Google lists in
the strip that used to stand above the rows: that panel was drawn into a fixed
sixty-four pixels rather than the card's width, where the row's eight units
land at four — a smudge. The strip has gone and `paintSky()` holds one size
again. One thing it taught is worth keeping: those five were nearly left with
no mark at all, on the reasoning that Google's lists would all be wearing the
same default pin — and they are not. They wear `pin`, `balloon`, `flame`,
`pin` and `blossom`; somebody dressed them. Check `lists.pin` before reasoning
about what a list is wearing, because `db/google-lists.sql` writes no pin
column, which is what made the guess look safe.

**The ground is the city, and it took two goes to get there.** It was
`data/places.json` — the seventy-five places on the map — drawn as faint
dots under each list's own. At panel size seventy-five dots is not a city.
It is seventy-five specks on blank paper, which is exactly how it read, and
the complaint that started this was that the panel looked empty rather than
that it looked wrong.

So the ground is `data/city.json` now: about eleven hundred coordinates
generated by `tools/city.mjs` from `exports/tallinn_restaurants.csv`, the
same export `db/google-venues.sql` comes from. Drawn at a radius wide enough
for neighbours to touch — `groundRadius()` in `assets/lists.js` — a thousand
eating places stop being dots and become land: the Old Town solid, Kalamaja
and Kadriorg as arms off it, the harbour and the parks as holes. And the bay
draws itself, because the bay is the part of the frame with no restaurants
in it, so the panel gets a coastline without this repository carrying a line
of coastline data. Nineteen kilobytes, fetched once after the rows are on
the screen and painted into every sky already drawn; a page that never gets
it shows each list's own marks on plain paper, which is still the shape of
the list.

It is `--hairline` on `--paper` and not on `--wash`, which is the other half
of why it used to read as empty: hairline against wash is seven values of
difference, and seven values is a texture rather than a map.

**And the frame is fitted to the list, not to the city.** It was one fixed
box — the same square of Tallinn on every card — on the argument that a
shared frame is what lets two cards be read against each other. What that
missed is where the lists are: nearly every one of them is inside the same
square kilometre of the middle, so the shared frame drew the same picture
twenty times over with two thirds of each panel empty. `frameFor()` in
`assets/lists.js` squares the list's own bounding box up to the panel, in
metres rather than degrees — a degree of longitude up here is about half a
degree of latitude, and fitting the two as equals draws Tallinn half as wide
as it is — with `SKY_AIR` of air around it and a floor of `SKY_FLOOR`, about
a kilometre and a half, so a list of three cafés on one street does not zoom
until the city under it is featureless.

The trade is that the cards no longer share a scale, so the corner says what
the scale is: **1.6 km across**, `listsSkyAcross` in `data/ui.json`, the
longer side of the list's own bounding box rather than of the padded frame.
That is worth more than the comparison it replaced, because *can I walk
this?* is a question somebody actually has. A list whose places all fall in
one spot draws no label at all — "0.0 km across" is the label failing to have
anything to say rather than a fact about the list.

The frame is built from the ten dots the row arrived with, not from every
place on the list, so a list of twenty is framed on the ten that are drawn.
The picture and its frame agree, which is the property that matters; the
alternative is the API sending every coordinate on every list to make a panel
the size of a postage stamp slightly more honest.

**Three orders, and how often a list is opened is the default.** Beside the
search field are three chips — Most opened, Most saved, Newest — pressed the
way the map's filter chips are. The first is the page's own order; the other
two are the ways past the top of a ranking somebody has already seen, to what
other people bookmarked and to what arrived lately. Each is two columns
descending and then the id — `SORTS` in `functions/api/_mostkept.js` names
the three — which is what lets the one cursor shape page all of them; a cursor
is only ever handed back under the order it was minted in, because the page
sends both together. The order rides in the address as `?sort=kept` or
`?sort=new` (never the default), is seeded by `functions/lists/index.js` the
way a search is, and reports itself as `lists_sort`.

**Why the opens and not the keeps.** Keeping a list needs an account; opening
one needs nothing. The page opened on the keep count for as long as that was
the only number there was, which meant the order every stranger read was
decided by the few people signed in — about lists the rest had been reading
without any way to vote on them. An open is the gesture everybody makes, and
it is the one the row is asking about: *did people who saw this title go and
read it.* The keeps are still a chip, because who bookmarked a list is a
different and narrower question and it is worth being able to ask it.

**And the number is never printed.** No row says how many times it has been
opened. The chip says which order the rows are in, which is what a reader
needs; a figure under every title would make twenty pieces of writing into a
scoreboard with somebody's name under each score, and the ranking already
says everything the number would. It is not even sent to the browser — see
`shape()` in `functions/api/_mostkept.js`, which leaves it out of the row.

**There was a fourth, Changed lately, and it went.** It ordered on
`updated_at`, which is a fact about when somebody was last editing and not
about the list: a title fixed this afternoon outranked a list finished last
week and left alone since, so it ranked activity rather than lists, and a
reader looking for something to open was never asking that question. An
address still carrying `?sort=changed` lands on the default rather than on an
error, because `sortOf()` answers `views` for every key it does not know — so
the links that are out there keep working and simply arrive at the page's own
order. The same is true of `?sort=kept` links from the days that was the
default, except that one is still a real order and arrives at itself.

**Where the number comes from.** `press_counts`, the same table the map's
places are ranked out of on `/stats`, under a third `kind` of its own:
`list`, with the list's id. `countOpen()` in `assets/lists.js` posts one to
`/api/stats` when a list's own page has drawn, once per load, however the
reader got there — the directory, a link somebody sent, a byline, a search
result. Not when the owner opens their own, which is checked in `boot()`: a
list its author reloads while editing it would otherwise climb a page ranked
on strangers. The row is one upsert bounded by the number of lists there are
rather than by the traffic, and the directory reads it as one indexed seek per
candidate row. `db/schema.sql` over `press_counts` is the whole of the table's
reasoning, and it needed no change to the schema to grow this third kind.

**One column, and nothing above it.** The five lists Google's numbers wrote
were a strip of their own at the top — **Start here**, a compact card each,
five across on a desk — on the argument that they are the lists a stranger
can trust without knowing anybody on this site. They are ordinary rows now,
ranked by how often they are opened like everything else. What the strip cost
was what it was: a second kind of row and a second heading, a second layout to
keep in step, and on a phone — where most of this page is read — a screen and
a half of Google before the first thing a person had written. The ranking
answers the question the strip was asserting, and if those five really are
what a stranger opens, they are at the top on their own account. It also took
`start` out of the answer, the `listsStart`, `listsStartWhy` and
`listsEverybody` strings out of all ten languages, and one query out of
`_mostkept.js`. See **The five lists Google wrote**.

**The row carries the first three places.** A page of titles is a search
result: "Top ten burgers" tells somebody who has never heard of its author
nothing whatever. `Ferment · Kaerajaan · Rataskaevu 16` under it tells them
whether to open it, and that is the whole difference between this page and a
list of links. There are no rank numerals down the side, and no count either:
the position is the whole of what the ranking says out loud, and numbering the
rows would make it the identity — a list slipping from third to fourth would
read as a demotion nobody did anything to deserve.

**The byline is a door, and the name is the handle.** The line of facts under
a title says whose list it is, and the name in it leads to `/u/<name>` — the
rest of what that person has published. It is the same door the byline under
a list's own title has been since profiles were built, and it stands on every
row that draws somebody else's list: the directory, the three rows at the foot
of a list, and **Lists you saved** on `/account.html`.

Only the name is underlined. The whole phrase was the link for a while, on
the argument that a name is three or four characters on a phone and that
underlining only the name would mean splitting a translated sentence around
it — assembling a sentence out of pieces, in ten languages. The first half of
that bought a bigger target with a misleading one: "created by" underlined
reads as a caption about the list, when the thing it opens is the person. The
second half was not true of the strings as written: every language's phrase
carries the name as a `{name}` placeholder, so `byline()` in
`assets/lists.js` cuts the one translated string at the placeholder and puts
the link in the cut. The sentence is still one string per language, and the
translations did not change. The target is kept thumb-sized by padding the
link out of its own margins, so the line does not grow to fit it.

The card is what makes that possible, and it changed shape for it. Every one
of these rows was a single `<a>` around the title, the facts and the places; a
link inside a link is not a thing HTML has, so the card is a plain box now,
the title is the link, and `.lists-open` stretches that link over the whole
face of the card. A press anywhere still opens the list. What it buys besides
the byline is what a screen reader announces: the title, rather than the title
and every number beside it read out as one link name.

**And a bookmark in its corner.** Keeping a list was on the list's own page
and nowhere else, so on a page built to hand somebody twenty of them, keeping
three meant three journeys out and back. The mark on a row is the same
control, in the same two states, wearing the same filled-or-outlined mark the
map draws on a place — signed out it is the same honest door to the sign-in
sheet rather than a button that could only fail.

Pressing it repaints the count in the line above it and moves nothing else.
The page is ordered on that count, so a row could climb under the finger that
pressed it and take the rows somebody was reading with it; the order is
settled on load and stays settled until the next one. Your own lists draw no
mark at all — the API refuses to keep one, because it is already under **Your
lists** — and keep no room for one either, so a row without a corner is how
you pick your own out of the page.

**The search field** is a row of its own under the head card, and it sticks
to the top of the window once that card has scrolled away. It was the last
line of the card, which was fine while the page was twenty rows and a button;
a page that grows under the reader for as long as they scroll puts a field at
the top of it a hundred rows away by the time somebody thinks of a name to
look for. It wears the page's own ground rather than the paper the field sits
on, so the rows passing under it are covered and it still reads as part of
the page rather than as a bar laid over it, and it holds under the safe inset
so a notch does not cover the field.

It asks the database rather than filtering what is on the screen: a page
holds twenty rows and the list you are looking for is usually not among
them. It matches a list's title,
the line under the title, the username of whoever wrote it, and the name of
any place on it — a substring, case-blind for ASCII and no further, which is
what SQLite's `LIKE` gives and is stated plainly in
`functions/api/_mostkept.js` rather than papered over.

The places were deliberately left out for a while, on cost: matching a place
name means looking at the items of every public list on the site for one
keystroke, which is the join taken out of the query when the row stopped
printing a place count. What changed the decision is the row itself. It
prints the first three places under every title, so a reader who types one
of the names they can see on the screen and is told nothing matches has been
told something false about the page — and "a place is found on the map" is
no answer to somebody looking for the list that mentions it. The cost is
paid, and it is bounded: the match is an `EXISTS` over each candidate list's
own items, on the index that reads a list in its order, so it stops at the
first hit and never reads past one list's twenty rows. Today that is under
sixty rows a search. It grows with lists times items, and the day it shows
in a query time is the day the search text gets a column of its own on
`lists`, kept by the writes — the same note `db/schema.sql` keeps over
`list_keeps`.

A search is in the address — `/lists?q=coffee` — written there by
`replaceState` as the field is typed into, and read back by the Function that
serves the page, so a search somebody sends draws its answer rather than
drawing everything and replacing it. Keystrokes are held for a fifth of a
second before they become a request, and an answer is drawn only if it is the
answer to the last thing asked: a one-letter query matches more and so answers
slower, and without that check the page could settle on the rows for `c` while
the field says `coffee`. The rows on the screen are left alone until the
answer comes, and only dimmed while it is out — rows that do not move at all
under a word being typed read as a field wired to nothing. The next page
carries the search with it — and refuses while one is out, whether pressed
for or scrolled to, because the cursor it holds belongs to the question
before. What a
search found is said to a screen reader through the page's live region and
drawn nowhere; what is drawn is the question, in a line over the rows —
"Lists matching “coffee”" — so the rows read as an answer rather than as the
page having quietly changed its mind. Not the number: a count over rows that
keep arriving as you scroll would be the size of the page, not of the answer.

**It does not say how many places are on the list**, and it did. That number
cannot be known without reading every item of every list on the page: twenty
rows cost four hundred, and the cost grows with how much people write. Four
hundred rows to print the least informative thing on the row, next to three
names that say the same thing better. The names cost sixty rows for the page
however long the lists are — one small indexed read each, sent as one batch —
and the count is still on your own lists and on a list's own page, where the
rows are in hand anyway.

**Reading it costs about three hundred rows a page**, and that is the number
to watch. Roughly two hundred and forty to pick and order twenty lists, sixty
for their names. The first of those two grows with how many public lists
exist, because ordering by a count means knowing the count for every candidate
— which is what the note over `list_keeps` in `db/schema.sql` is about.

None of the three things the page has grown moves that number much. A search
adds three `LIKE`s to a `WHERE` that was already visiting every candidate row,
over columns on `lists` and `users`, and one `EXISTS` into each candidate's
own items that stops at the first hit — under sixty rows a search today, and
watched, as above. The bookmarks add one `LEFT JOIN` on `list_keeps`, keyed
on the reader's own account, over the index that table is already unique on,
and only for somebody signed in: the statement is written without it for
everybody else, which is most of the traffic this page gets. The opens add
one `LEFT JOIN` on `press_counts`, on that table's own primary key — one
indexed seek per candidate row, and only under the order that reads it; the
other two chips are the statement without it. What the page *stopped* paying
is a whole second query: the Google strip was its own statement and its own
twenty item reads, and it has gone.

And the phone pays less than any of it on the way back down: no panel means
no `data/city.json`, which is nineteen kilobytes of the page's weight that
only a desk fetches now.

**How anybody gets there.** Three ways, and the first two matter most:

- **The map**, from the pill on the left rail under the button that wears your
  name: one press, straight to `/lists`, signed in or out. It has been most
  other things first. A **Lists** control beside **Places** in the top-right
  corner, which moved because the corner is where the map's own controls live
  and every one of them opens something over the map — a door that leaves for
  another page was the odd one among them. A row in the map's sheet, with one
  for a profile beside it. And the last card on `/account.html`, which the
  account button opened, in four shapes over as many rebuilds.

  What all of those shared is the cost worth stating rather than glossing:
  signed out, the sheet is the sign-in form and has no menu at all, and the
  account page's own door has gone, so none of them is a route a stranger on
  the map could take. They arrived from a list somebody sent them or from a
  search result — two of the three ways below, and the reason the page is
  indexed. The pill is the answer to that and is why it is on the rail rather
  than in the sheet: the rail is drawn for everybody. A byline is another
  route to lists, though not to this page: it leads to one person's, and
  [Profiles](#profiles) is where that goes. See [One door to the
  lists](#one-door-to-the-lists) and **Everybody's lists is not on this page**
  under **The account page**.
- **The foot of every public list**, which is a bar fixed to the bottom of the
  window carrying one thing: the way here. This is the surface that should get
  the most use, and the reason is where it is: somebody reading a top ten is
  exactly the person who wants another one. It was three more lists and a link
  under them, drawn at the end of the page — this site's directory redrawn
  small at the foot of one list, and reachable only by whoever had scrolled a
  whole top ten to find it. One door that is always on screen is worth more
  than three that are at the bottom of twenty places, and the three were the
  rows of this page anyway. See **The bar and the foot** under **Lists**.
- **Search.** The page is indexed and is in `sitemap.xml`, and it is the only
  thing that links the lists to each other. Public lists have been indexable
  for a while; each one was an island until this.

**It was `/lists/kept`, and then `/lists/public`.** The first address named
the order rather than the page, which stopped fitting the moment the page grew
a way to look for one list among them: somebody searching is asking what is on
it, not how it is sorted.

The second lasted longer and went for a quieter reason. **Public** is a word
this feature needs on a list's own card, where it is one of two answers to who
can open this; in a path it is the only kind of list there can be. A private
list is served to the session that owns it and to nobody else, so it could
never have been in a directory to be ruled out of one — the word was spending a
path segment saying *not the ones you cannot see anyway*. What is left is the
plural of the thing. `/lists` is everybody's lists, it is one segment, and it
is the address that fits in a sentence somebody says out loud.

The cost is that `/lists` was not free. Pages serves `lists.html` at both
`/lists` and `/lists.html`, the way it serves `google.html` at `/google`, so
the bare address already answered — with the page that has nothing of its own
on it any more and replaces itself with `/account.html`. A Function outranks a
static asset at the same path, which is what makes `functions/lists/index.js`
the answer at `/lists` now; `/lists.html` is untouched, still `noindex`, still
disallowed in `robots.txt`, and still the door to the account page. It is the
one address on this site whose two spellings are two different pages, and the
line in `robots.txt` says so, because a `Disallow` is a path prefix and losing
the extension off that line would hide the directory from every crawler.

`functions/lists/public.js` and `functions/lists/kept.js` are both 301s to
`/lists` now and nothing else, because both of those addresses are in
`sitemap.xml`'s history, in search results, at the foot of every list read
before the rename, and in whatever anybody pasted into a message. An indexed
address is not a name you take back, only one you forward. `kept.js` points at
`/lists` directly rather than at `public.js`: a chain of 301s is a hop a
crawler is allowed to stop following, and there is no reason to spend it.
`assets/lists.js` still recognises all three paths, for the deployment with
no Functions in it where there is nothing to answer the redirect.

**Where the number comes from.** `list_keeps`, counted, every time it is
asked. There is no counts table, and there was one for about an hour.

The note over `list_keeps` in `db/schema.sql` had been standing for a while
saying that the day something asked for these counts in bulk was the day to
give them the `save_counts` treatment. This page is that day, so the table
was written — and then taken out again, because the comparison the note was
making does not hold. `save_counts` exists because the map asks for
seventy-four numbers on every load, over a table that grows with every
anonymous save from every visitor. A keep needs an account, one account can
hold two hundred of them, and one page asks. It is one row read per keep in
the database, to draw twenty rows.

What the table cost, against that, was a migration and a backfill to be run
by hand on a live database that has no backup in this repository — plus a
second home for a number that already had one, and a way for the two to
disagree. That is a real cost today bought against a hypothetical one later,
which is the wrong way round. The note is still in `db/schema.sql`, now
naming the day more precisely: when the `GROUP BY` in
`functions/api/_mostkept.js` shows up in a query time.

**Nothing about a list itself changed.** No new button on it, no new state,
no third option under **Who can open it**. A keep already existed and was a
private bookmark that nothing consumed; this is the page that consumes it.

### The chips, as lists

Thirteen of the public lists are the map's own, one per filter chip:
**All the bakeries in Tallinn**, **All the hidden gems in Tallinn**, **All
the casual and solo places in Tallinn**, and ten more — the city on the end
of each because the title is also the page's `<title>`, and "in Tallinn" is
how the question ends. They are published under `tallinntastebuds` — the
account whose map this is, not a generated name of its own — and each holds
every open place on the map that carries that type, in the alphabet, with the
first sentence of its write-up under it.

They are generated. `tools/typelists.mjs` reads `data/restaurants.json` and
`data/taxonomy.json` and writes `db/type-lists.sql`, which is loaded by hand
into both databases the way `db/google-lists.sql` is. So they are one file's
output rather than thirteen pages of typing, they cannot drift into a second
opinion — the picks are `types` and nothing else, exactly what
`matchesFilters()` in `assets/app.js` reads — and a place added to the map is
a place missing from a list until the tool is re-run and the file loaded.
`tools/validate.mjs` fails on the first half of that and cannot see the
second.

**Why a chip is worth a list when the chip already answers.** Pressing Bakery
narrows the map to seventeen pins and the panel to seventeen rows, and that is
a better way to look at them than any page is. What it is not is a thing you
can send somebody: a filtered map is `?type=bakery` on the end of a URL that
opens a map, with one `<title>` for the whole site, no line under any place,
and nothing to keep. A list is the shape this site already has for *here are
the ones, and here is what each is* — it unfurls in a chat with its own card,
it has a bookmark, and it sits on `/lists` with everybody else's. The same
thirteen questions, asked in the other shape.

**Closed places are left off**, which is the one way these are not what the
chip shows: a chip still draws a closed place, grey and dashed, because the
links pointing at it still work. A list is somewhere to go, though — a page
somebody opens on a phone in town — and **All the date night places** naming
a restaurant that shut is the list being wrong in the way a reader notices
first. The Google top tens skip closed places for the same reason. The line
under each title says so.

**The line under each place is the first sentence of the English write-up.**
`list_items.say` is one string and there is no per-language version of it, the
way a blurb in `restaurants.json` has ten, so whatever goes there is English
on a site read in ten languages and had better earn the asymmetry. The first
sentence is the one that says what the place is, in the map's own voice, and
it is already written. The whole write-up is the wrong length — a list of
forty-five paragraphs is not a list — and the must-order dish, which reads
best of the three, is missing on twenty-five of the seventy-five places.

**Whose they are is looked up, not written down.** `tallinntastebuds` is a
real account with a real password and a UUID for an id, and neither belongs in
a tracked file. So every list in the generated SQL takes its owner from a
subquery on the username, and the account row above it is an `INSERT OR
IGNORE`: on a database that already holds the name it does nothing at all, and
the password, the profile line and the join date are the ones that were there.
On one that does not — a fresh preview — it mints a stand-in with sixty-four
zeros for a password hash, which is not the PBKDF2 of anything, so the lists
have an owner and nobody can sign in as it. The cost is that claiming that
name on a preview database means deleting the row first.

**They are ordinary rows on `/lists`**, the way every list is now — Google's
five included, since the strip that lifted those came off. Nothing keeps them
apart and nothing lifts them, and with nobody having opened them yet they sort
to the bottom, where the section above says a list nobody has opened belongs. `/u/tallinntastebuds` is where all thirteen are
together.

Adding a fourteenth chip to `data/taxonomy.json` makes `tools/typelists.mjs`
throw, by name, until it is given a title and an id for it. A title is a name
somebody chose — "All the Coffee/tea" is not one — so the thirteen are written
out in the tool rather than built from the chip's label, and so is each id:
a list's id is its address, and renaming one must not move the link somebody
sent. Taking a chip away throws too, and says the part no tool can do — the
list it wrote is still standing on `/lists`, in both databases, and only a
hand takes it down.

### The bar and the foot

Somebody else's list is a page with two fixed edges and a scroll between them.
At the top, a bar saying which list this is and which of its two views you are
looking at. At the bottom, a bar carrying the one way out of it. Everything
else moves.

Neither is decoration. A top ten is twenty places at its longest, and
everything that said what you were reading used to sit at the top of that
scroll: five places in, a phone showed a column of restaurants and nothing
saying whose list they were, that a map of them existed, or that there were
other lists. The way to the map was at the top of the head card and the way to
`/lists` was under the last place, which are the two ends of exactly the
distance somebody reading is in the middle of.

**The two bars carry different things, and that is the rule.** The head says
where you are — the list's name, and the switch. The foot says where you can
go instead — everybody's lists. Nothing is on both, because a door drawn twice
on one screen is a door somebody has to think about twice.

**The foot carries the page's one filled action**, and it took three goes to
get there. It was an `.alt` — twelve mono pixels in `--muted`, underlined,
centred on a band the colour of the page behind it — on the reasoning that a
bar which is the edge of the page should not float on it. Then it was a
`.menu-row`, the name in the display face with a chevron on the end, which is
rule 8's shape for a door and the shape the account page offers this same
destination in. Neither looked like a thing you press, which is what somebody
reading a list on a phone said about both of them in turn. A row is right for a
door standing among other rows on a page of cards; it is wrong for the one
thing in a bar, where there is nothing beside it to be a row of.

So it is `.go`, the filled pill in the accent — what "press this" looks like
everywhere else on this site. Rule 5 allows one per surface and this page has
always spent none: the keep is an `.alt` in a hairline pill, **Share** is an
`.alt`, and the head card spends no accent at all. The one thing you can do
next from a list you are reading is go and read the others, so that is what
the accent buys. It is sized to its words and centred, the way every other
`.go` is, rather than stretched across the bar — a full-width fill is a shape
nothing else here wears — and it is 44px tall, because it is the one control
on the site that has to be hit while somebody is scrolling past it. The band
under it is `--paper` inside the same hairline, a surface holding a button,
and it carries the safe inset so the pill sits above a home indicator rather
than under one. Still no shadow, and still nothing about it moves.

**And no line under the name**, which is what it drops from the row it was.
The account page put `listsAllWhy` under the title while it had a door of its
own, where it was a card among cards and the line was what said which page was
behind it. Here it was two lines of mono in a bar that never leaves the screen,
and it took the dock past a tenth of a phone — off a list it is meant to sit
under rather than compete with. A filled button does not need a footnote, and
the pill on the map's rail carries none either.

Your own list has neither. That page is an editor — its title is a field you
type into rather than a heading, and the accent on it belongs to Save — and
the way onto the map is in its row of controls, beside the other things you do
to a list. Somebody reading a list they were sent is the journey these are
for.

### Map and List are one switch, drawn twice

A list is one thing with two views, and each of them used to hold a button
pointing at the other: **Open on the map** on the list's own page, **Open the
list itself** in the map's panel. Both were at the top of something that
scrolls, so ten places down neither was on screen, and the two names described
a journey between two pages rather than a change of view.

They are one control now — two chips, **Map** and **List**, with the view you
are in filled the way a pressed chip is filled — and it is drawn in both
places out of each page's own pieces: `listBar()` in `assets/lists.js` and
`listBand()` in `assets/app.js`, which share no module and so restate it,
the way everything these two pages both draw is restated. On the map it rides
the band across the top of the panel; on the list's page it is the head bar.
Reading it takes no learning: it is the map's own filter row saying which of
two things is on.

The chips are links and not buttons, so the other view is an address somebody
can open in a tab, send, or be sent — and `aria-current` rather than
`aria-pressed`, because what the filled half says is "this page", not "this is
switched on". `.chip[aria-current="page"]` fills alongside
`.chip[aria-pressed="true"]` in `assets/styles.css`; no fifth control was
added. They report `list_map` and `list_page`, which are the names the two
buttons they replace reported.

The accent on the half you are already looking at is the one thing worth
arguing with, because on this site the accent usually marks the thing a
surface is asking for, and here it marks the thing you already have. It is the
chip's own meaning and the map's filter row has taught it on every visit: the
filled one is the one that is on. The half you can press is the quiet one, and
it is always on screen, which the filled button it replaces was not.

**Open on the map** still sits on your own list and in the corner of every
index row, going to `/?list=<id>`: the map, showing that list's places as
pins, with the panel open on the list itself. It is an outlined pill in both
places — on your own list the card's one filled press is Save, and the accent
is spent once — so the door onto the map looks the same wherever it is still
drawn as a door rather than as half of a switch.

That is the map this site already has, not a second smaller one drawn on the
lists page. The question anybody has about ten restaurants in one city is where
they are relative to each other and to wherever they are standing, and the map
answers it with the pins, the clustering, the names, the locate button and the
write-ups for the places that have them. A copy of all that on another page
would be a worse copy, and a place on it that is also on my map would lose its
write-up on the way across.

**What is drawn, and what is invented.** A list draws from `data/places.json`,
which is my map plus the Google import, so most of a top ten is somewhere I
have never eaten. Two kinds of row come out of that, and they are drawn
differently on purpose:

- A place **on my map** is not invented at all. It is matched by id to the real
  entry and keeps everything it has — its pin, its write-up, its reel, its
  price, its types, its save mark. The list's sentence is added under it.
- A place **not on my map** gets a stand-in: a pin, a name, and what the
  list's owner said. The pin is the list's own — the glyph its owner picked
  out of the eight, so ten of them read as one
  person's ten. A place of mine on the same list keeps the mouth, because
  being on the map is the verdict and nobody else hands it out; see **The
  pins**. When it came off the Google export the row takes the
  same shape as a row of mine — Google's band and kinds in the slots the gauge
  and the types use, and a **Google 4.8** mark where a row of mine says how
  much there is to look at — so a list that mixes the two rolls reads as one
  list; a place added by hand, off nobody's export, shows its address and
  nothing else. Opening either gives a card that says plainly that it is not
  on my map and whose list it came off — no write-up, no reel and no
  photographs, because being on the map is the verdict and a list is not a way
  around it. What the card does carry, when the place came off the export, is
  everything Google holds about it, under Google's name: the score, the band,
  the kinds, the phone, the week of opening hours and the way to its listing.
  See **The card for a place I have never eaten at**.

A row the catalogue has no coordinates for is not on this page at all. There is
nowhere to put a pin, and a row in the panel that no pin answers to is worse
than its absence. It is still on the list's own page, with its sentence, which
is where it can be read.

**A list is a mode, not a filter.** It used to be a chip at the front of the
filter row wearing its own title, and it was the wrong shape twice over. On the
row it read as a kind of food — "shaurma bros" sitting between All and Bakery
announces a category the map does not have. Underneath, it made the chips lie:
the thing narrowing the map was a filter in `state.active` that no chip on the
row stood for, so All could be drawn unpressed with nothing else pressed either
over a map showing four places.

So the filter row is types and nothing else. `state.list` holds a list or it
does not, and while it does, that is what the map is showing — `visiblePlaces()`
answers the list before it consults a chip. The list says who it is in the
panel instead, in a band across the top of it: its pin, its title, and the
switch — the pin being the glyph its places are wearing out on the map, so the
name and the pins read as one thing. See **Where a list wears its own** under
**The pins**, which is the other four places that emblem is drawn. Then
the search, and under that its owner's name, how many places are on it, their
sentence, the two things you can do about it — keep it, or send it on — and,
under those, the way out. The two wear the same pill and neither is filled: on
that block the accent behind a pill already means "saved", and spending it
twice would take that reading away. The one filled thing in the panel is the
half of the switch you are standing on, which says where you are rather than
asking for a press.

**The band is the panel's own header, not the first thing in its scroll.** It
began as the latter — a group heading like **Nearest you**, sticking to the top
of the panel on the way past — and sticky was close enough while
reading the list was the only thing you could be doing. It was not the panel's
header; it was a heading behaving like one, and it stopped behaving like one
the moment a word was typed into the search, because a list plus a search is a
slice of the map rather than the list, and the heading went with the state.
Above the scroll it is true of the panel rather than of anything in it: which
list this map is showing, which does not stop being the answer while you narrow
it. The eyebrow that used to sit at the top of the panel — TALLINN, whose map
this is — steps aside for it, because two labels stacked over one search field
is one too many, and the band answers the narrower and more useful question.
The search moved under it, which is the arrangement every phone already knows:
what you are looking at on top, the field for narrowing it beneath.

That is also what the sheet's third stop is standing on. A band that does not
depend on the scroll being anywhere in particular is a band the sheet can be
pulled down onto — and once there is somewhere for it to land, there is no
reason for it ever to leave. On a phone a list cannot be closed: the pull, the
cross, Escape and **Places** all put the sheet on the band instead, and the
cross is not drawn there. What closes a panel is the list no longer being the
mode, which is the next paragraph and the one under it: pressing a chip, or
**Back to all places**. See **The sheet** in the design notes.

**Pressing any chip forgets it.** All, Bakery, Discount — each is somebody
asking the map a question their list cannot be part of the answer to, so the
list goes: pins, panel, keep button, `?list=` and all. There is no control that
puts it back, because it is not a thing you toggle.

**Back to all places** is that same press, printed where the person reading a
list can find it. It sits under the three pills as an `.alt`, not as a fourth
one, because it is the one thing in that block that is not about the list —
and because it is the same shape and nearly the same words the list's own page
uses for its way out. Pressing All had always been the exit and always will
be; what it was not, was visible. The chip row says nothing about the list, on
a phone it is behind a button, and somebody who arrived on a link had to
already know that a chip they had no reason to press was the way back.

**Opening and shutting the Filters drawer is not pressing one.** Under 860px
the chip row lives behind a button, and shutting it is the same answer as All
— a shut drawer can never be a filtered map. That rule is about chips, and it
used to be applied by calling the same function All does, list-dropping and
all: opening the drawer to see what was on it and shutting it again lost
somebody's list, with nothing pressed and nothing said. Shutting a row with no
chip pressed is now nothing happening.

**Back is the undo.** The page is driven by its address bar, so dropping a list
is a `pushState` — the only history entry on the map besides an opened place,
and it earns one for the same reason: a step somebody may not have meant to
take. Going back restores the entry whole, the chips it was standing on
included, and the list itself is handed back out of a variable rather than
re-fetched. Filters still rewrite the entry they are on.

**Keeping one.** The bookmark is in the panel, under the byline — the same mark
the map draws on a place, said about the other kind of object this site has.
It is offered at the one moment it means anything: this list open, these pins,
this person's name above it. Press a chip and the moment has passed. Nothing
nags and nothing follows anybody around the map afterwards.

Signed out it is a door rather than a dead button: it opens the sign-up sheet,
which is on this page already. A keep needs an account for the reason
**Why a list needs an account when saving a place does not** gives.

The count beside it, and whether you have kept it, come out of `readList()` in
`functions/api/_lists.js` with the list itself, and neither is cached — see
**Lists** for why a keep is the one thing here that may not be a minute behind.

**Failing is quiet.** A list that is private, deleted, mistyped, or behind a
database that is not bound leaves the map exactly as it is. No card and no
toast: somebody who followed a dead link gets the thing this site is, which is
better than an error about a list they have never seen. `/list/<id>` is the
page that is about one list, so that is the page that reports a missing one.

### Pressing a row is the third way across

The switch sits at the top of a page people read down. Somebody eight places
into a top ten presses the eighth place, not a chip they scrolled past twenty
rows ago — which is why the map kept being the half of a list nobody had
noticed was there.

So a row is a door too, and it goes to `/?list=<id>&at=<place>`: this same
list on the map, the sheet at its half stop on a phone rather than open full,
and the place that was pressed lit, named and haloed between the two. The pins
above, the list's own rows under them scrolled to that row and marking it, and
both questions a row raises answered at once — where is this, and where is it
next to the other nine.

Three details, and the two that can differ from what `?spot=` does both do,
because the press means something else:

- **The half stop.** Every other way the list opens was asked for by somebody
  who wanted the names, so it opens full. This one was asked for by somebody
  who had the names in front of them, so what it hands back is the map. `?spot=`
  lands there too, by a different road: a place opens at the half stop however
  you got to it — see **The sheet** in the design notes.
- **The list's frame, not the place's.** `?spot=` comes in to `FOCUS_ZOOM`,
  because opening a place is a street question. This does not zoom at all: it
  keeps the fit that holds every pin on the list and only centres on this one.
  A single pin on a street is exactly what somebody who has not yet noticed
  the map does not need to be shown. The write-up is one more press away, on
  the row or on the pin, and that press is what zooms.
- **`?at=` is a door, not a state.** Read once on the way in and taken straight
  back off, the way `?story=` and `?account=` are. What the address bar says
  afterwards is `?list=<id>`, which is what the page is showing — a link copied
  out of it is a link to the list on the map, not to somebody's eighth choice.

**The door is the row and not the name across the top of it.** It was the name
alone for as long as the door had existed, which made the target the width of
however that particular place happens to be spelt — four letters on one row and
three lines on the next — with the street under it, Google's line and the
sentence that is the reason the list is worth reading all sitting there dead
beside one live word. Design rule 8 is a target the width of the card rather
than the width of the word, and the directory's cards have obeyed it since they
were written; these rows, which are what a shared list is actually made of, had
not.

It is built the way those cards are, out of the same rule: the row is a plain
box, the name is still the `<a>`, and `.lists-open` stretches the press over
the face of it — so the accessible name of that link stays the place's name
rather than the street and Google's score and somebody's two sentences read out
in one breath, and the focus ring goes round the row, which is what opens. The
row's edge takes the accent on hover the way a directory card's does. What it
costs is dragging over a note to copy it, since a sheet across the row is a
sheet across the words on it; that is the same trade every row on the directory
already takes. **Your own list keeps the word-width target.** Those rows are a
textarea, a grip and a delete button, and a sheet of link over the three of them
is a row nobody can type in or carry.

**It used to be Google Maps, and a name is what this page is mostly made of.**
A place on my map went to its write-up and everything else opened a new tab on
Google Maps, by coordinates when the catalogue had them and by name when it
did not. Everything else is most of a top ten, because most of a top ten is
somewhere I have never eaten. So the ordinary press on the ordinary row left
the site for a map with one place on it and none of the rest of the list — sent
from a page whose other half is a map that has all of them.

Google Maps is still a press away and now it is an asked-for one: Directions
and **See on Google** are on the card the map draws, see **The card for a place
I have never eaten at**. Nothing on this site opens Google Maps because
somebody pressed a name.

**A place with nowhere to draw points nowhere at all** and says so in the muted
colour it always did — and its row is not dressed as a door either, because a
box that looks pressable with nothing behind it is worse than a line of muted
text. `seatList()` in `assets/app.js` drops a place it cannot put a pin for, so
a link to the map for one would arrive on a map that does not have it. The id in
the link is the one the list stores and never `mapId`: the pin and the row on
the map both stand under the id the list was written with, and `mapId` names the
write-up's own address, which is what `?spot=` wants and this does not.

### Both views of a list can be searched

The switch says a list is one thing with two views, and for a while only one
of them could be searched. The map's panel has carried a field since long
before lists existed, and with a list open it narrows the list rather than the
map — see **Searching the list**. The list's own page had nothing: somebody
sent a list of forty could type a name on the map and then scroll for the same
name on the page the link actually goes to.

So `/list/<id>` has the field too, under the head card, built out of the same
three elements in `assets/styles.css` that the map's panel and the "add a
place" picker use — `listFind()` in `assets/lists.js`. Same folding, so `sasl`
still finds Šašlõkk and `pagari` still finds the bakeries, and the same rule
about several words: `telliskivi kohvik` narrows rather than widening.

**A row keeps its number.** A place that is third on the list is still drawn
`3` when a word has left four of the seven standing. The order is what a top
ten is, and renumbering the survivors 1, 2, 3 would be the page quietly
claiming a different list.

**It looks at the name and the street, and the placeholder says so.** The
map's copy also reads the type labels in all ten languages and the dishes in
`mustOrder`; neither is on this page to read. `readList()` in
`functions/api/_lists.js` fills each row out from the catalogue and sends what
a row draws — the name, the street, Google's description where there is one —
rather than the catalogue itself, because a shared list is opened by people
who have never been to this site and making them download a hundred kilobytes
to render ten rows is not a trade worth making for one more column to search.
Types would be worse than absent: only the rows out of `google_venues` carry
any, so typing `bakery` would find somebody else's places and silently skip
mine.

**And there is no index behind it.** The map folds its eleven hundred places
once at load because folding them on every keystroke would be work for
nothing. Fifty rows is not eleven hundred, and an index of them would be a
second copy of the list to keep in step with the first.

**Your own list has no field.** That page is an editor: the rows carry a grip
and a number and are dragged into the order that is the entire point of the
thing, and there is no sense in rearranging four rows out of fifty when the
other forty-six are the ones that move. The same reason it has no bar and no
foot — see **The bar and the foot**.

### Why a list needs an account when saving a place does not

A save is anonymous on purpose. It has to work in the first ten seconds,
before anybody has decided anything about this site, so it is filed under a
random id the browser made for itself and no name is ever asked for. See
**Saves**.

A list is the opposite kind of object. It is published: it has a title
somebody wrote, it says things about restaurants in their words, and the whole
point is a URL they hand to somebody else. That needs a byline. It also needs
to survive a cleared browser — a device-owned list would be one Safari sweep
away from a stranger's link going nowhere.

So the one thing you must have before you can make a list is an account, and
making one is still two fields and no email.

There is exactly one sign-in form on this site and it is the one on the map.
Neither the account page nor the lists page carries a second copy; each links
to that one and names where to come back to:

```
/?account=up&then=/account.html
```

`?account=` opens the account sheet on a view — `in`, `up` or `password` — and
`?then=` is where to go once somebody is signed in. Both are read during boot
and taken straight back off the address bar. `?then=` only ever accepts a path
on this site; anything else and the map would be an open redirector.

`?account=me` is still accepted and no longer opens anything: it is the old
name for what is now `/account.html`, so it redirects there. Asking to sign in
while already signed in does the same, because the honest answer to that is
somebody's account and their account is a page.

`?saved=1` is the door beside it: the map, narrowed to your own marks, which
is what **See them on the map** on the account page asks for. It is a door and
not a chip — `?type=saved` is deliberately never written to the address bar,
because a link narrowed to one person's saves is an empty map for everybody it
is sent to — so this one is read once, applied only where there is something
to narrow to, and taken off.

### The roll a list is built from

The picker asks `/api/places`, which is the one place the two rolls are put
together — `functions/api/places.js`:

```
data/places.json    the map. Seventy-four places I have been to, and the only
                    rows that link through to a write-up.
google_venues       the Google Places export, in D1. Every place in the city
                    you can eat or drink in — see The Google export above.
```

The map's entry always wins. A Google row is dropped when the table ties it to
a place on the map (`map_id`), and dropped again when the name is a name the
catalogue already carries, so the sheet never shows one restaurant twice.
Rows Google says are shut, and rows marked `hidden`, are not offered at all.
The answer is cached five minutes: it changes when a deploy or a sync changes
it, and it is the same for everybody — unlike a list, which is read by its
owner in the middle of writing it and is never cached.

A list item stores whichever id it was added under, and the two cannot be
confused: a catalogue id is a lowercase slug, a Google key always carries
capitals. Reading a list looks in the catalogue first and in `google_venues`
for whatever is left over.

If the database is unreachable, or a preview has the schema but no sync run
against it, the picker opens on the map's places rather than on an error.

### A Google row says whose description it is

A place off the export has no write-up to link to. Being on my map is the
verdict on this site and 1,050 of these are not on it, so a row for one carries
what Google says about the place instead — and says that it was Google saying
it, every time:

```
According to Google   4.8 from 3,041 reviews   €€€€   Restaurant · Asian
```

That is the line on the list's own page and on the map's card. A row on the
map compresses it into the map row's own shape — the band and the kinds where
a row of mine has them, and a `Google 4.8` mark on the right, in the pill a
row of mine uses to say how much there is to look at — so the two kinds of
row read as one list; the attribution is the mark, and the full line is one
tap away.

The kinds and the band are turned into the map's own words on the way out, in
`venueEntry()` in `functions/api/_lib.js`, and neither is stored that way:

**The kinds.** `category`, `cuisine` and `tags` are matched as one string
against seven taxonomy ids, so "Sushi Restaurant" and "Japanese" come out as
`restaurant` and `asian` — and the row prints the names `data/taxonomy.json`
already carries in ten languages instead of Google's English, which is the
same rule every other visible string on this site follows. Matching all three
columns at once is what makes "Bar & Grill" both a pub and a restaurant. Over
the export as it stands, 1,098 of the 1,110 rows come out with at least one
kind, exactly one comes out with four, and the twelve with none — kebab shops,
sandwich shops, a juice bar, a theatre, a caterer — draw no kinds rather than a
wrong one.

Only the descriptive half of the taxonomy is reachable from there. `casual`,
`date`, `laptop`, `hidden-gem` and `cheap-eats` are verdicts about a place I
have eaten at, and no amount of Google's category text is evidence for one.
`caucasian` is descriptive and still not in the table: nothing in the 1,110 rows
says Georgian or Armenian, so a rule for it would be a line that has never run.

**The band.** Google's `"$"` to `"$$$$"` as the map's gauge of four. The table
keeps the string verbatim, because a mirror that converts on the way in has
stored an opinion — `db/schema.sql` says the conversion is one line wherever it
is actually needed, and that line is here. A hundred and eighteen rows carry no
price and get no gauge.

**The score.** `rating` and `reviews`, printed together and never apart: a 5.0
out of six visits and a 4.6 out of three thousand are not the same claim, and
the score on its own cannot tell them apart. Both are set in the reading
language's own digits, so Estonian gets "4,8" where English gets "4.8". This is
the one number out of five anywhere on this site, and **On "no scores, stars or
rankings"** says why it does not break that rule: it is Google's number, on
Google's place, with Google's name in front of it. Nothing sorts by it.

**Why it is attributed.** The gauge is drawn in the site's accent, in the
vocabulary the map uses for the seventy-four places I have eaten at. Without a
word saying where it came from it would be borrowing that verdict for a place
nobody here has been to. So the line leads with the attribution rather than
trailing it: whose description this is, and then the description.

**Where it shows.** Rows in the picker, where it is the difference between two
namesakes; rows on a list, in both the editing and the reading view; the rows
in the map's own panel while somebody's list is open; and the card the map
draws when one of those rows is pressed — see **The card for a place I have
never eaten at**. The map's own places carry no such line — they have a
write-up, which is the fuller version of the same thing — and a hand-typed
place carries none either, because a name somebody typed is not a description
of anything.

### The card for a place I have never eaten at

Pressing one of those rows on the map opens a card, and for a long time that
card was a name, a line saying whose list it came off, an address and a
Directions button — while the row behind it held the number to ring, the site
to read and the hours to turn up in. It was the honest shape for a place with
no write-up and the wrong one for a place somebody is deciding whether to walk
to.

So the card carries the whole of Google's half now, in one block under the
sentence the list's owner wrote, led by the attribution:

- the source line above — the score, the band and the kinds
- the address and the phone number, in the same two columns a place of mine
  sets its facts in
- **the week**, seven rows, Monday first, with today in ink and the other six
  quiet. `opening_hours` is one line of English in the table — `"Mon 11:00-22:00;
  Sun closed"` — so `venueHours()` in `functions/api/_lib.js` turns it into
  seven days on the way out and the browser draws the day names out of
  `data/ui.json`. The times are digits and belong to no language, so they
  travel verbatim; the only word in that column is "Closed", in the reader's
  own. Fifty-odd rows carry no hours at all and get no section.
- Directions, Call, Website, and last, **See on Google** — `maps_url`, for the
  half the export does not carry: the photographs, the reviews, and what
  somebody said about the queue on a Saturday.

A place somebody added by hand draws none of it and keeps the short card: a
name typed into a form is not a description, a phone number or a week.

### The place nobody has

The picker searches about eleven hundred places — my seventy-five and the Google
export behind `/api/places` — and between them they still miss things:
somewhere that opened last month, somewhere Google files as not a restaurant.
Search for it, find nothing, and the picker offers **Can't find it? Add it
yourself**.

The form is a name, a street if you know it, and a pin you drag to the door.
The pin is the part that cannot be skipped, and that is a consequence rather
than a rule: `assets/app.js` drops a list row it cannot put a pin for, so a
place with no coordinates would go on the list and then quietly not be on the
map — which is the one thing somebody adding a place actually wanted.

The door only appears once something has been typed. Under eight hundred
unfiltered rows it would be an invitation to add a duplicate.

**It is not a way onto the map.** `data/restaurants.json` is hand-written and
mine, and being on it is the verdict. A row in `added_places` is somebody
saying "this exists and I want it on my list", which is a much smaller claim
and lives in its own table — the same separation `google_venues` keeps.

**Who sees it.** Its author, in their own picker, so a place typed once can go
on a second list without being typed again. Nobody else's picker changes: a
name a stranger typed does not turn up in other people's search results, which
is the moderation surface this deliberately does not open. But it is not
private either — that is the point of it. It goes on a list, the list gets
shared, and anybody who opens that list sees the place and its pin exactly like
every other place on it.

**The three kinds of id.** `list_items.place_id` now holds three, and the
column is the only thing that says which roll to read:

```
catalogue    180-degrees                   lowercase, digits and hyphens
Google       ChIJUdUjCV2TkkYRcg8TxVp1XUI   always carries a capital
added here   new_k3fmqw8x2p                lowercase, and has an underscore
```

Both halves of that last test are needed, and the numbers say so rather than
the intent: all 75 catalogue ids are lowercase with no underscore, **215 of the
1,110 Google keys do contain an underscore**, and none of the 1,110 is
all-lowercase. The underscore alone would misread 215 real places; lowercase
alone would not separate one from a catalogue slug. `isAdded()` in
`functions/api/_lib.js` carries the query to re-run that count if
`google_venues` is ever re-synced.

**Leaflet, on a page that does not have it.** `assets/lists.js` says at the top
that this page draws no map, and for everybody reading a list that is still
true: Leaflet is fetched the moment the add form opens and never before, from
the same CDN and with the same integrity hashes `index.html` uses, so a browser
that has been to the map already has it. The pin is a `divIcon` rather than
Leaflet's default marker — the default is a PNG from the CDN's images
directory, which would be one more request and the only asset here with no
hash. If the script never arrives the form still works and says plainly that
the place is going in at the city centre.

**What is checked, and where.** A session, a name, and a point that is a real
number inside a box around Tallinn — a pin dragged off the map, or a scripted
call with a longitude of 900, is refused rather than stored and drawn in the
Atlantic. A hundred added places per account. The caps and the box are in
`functions/api/lists.js` and the server is the one that binds; the form
restates them so a field stops you at the keystroke rather than at the round
trip.

### The catalogue

A top ten of burgers needs every burger place in the city to choose from, not
the four of them I have filmed. So there are two files and they are different
things:

```
data/restaurants.json   the map. Mine, hand-written, every entry a place I
                        have eaten at. Nothing in it is generated.
data/places.json        the catalogue. Names and addresses, no opinion at all.
                        GENERATED, and not edited by hand.
```

The catalogue is the map plus an import. Every place on the map is in it — so
a list can hold one, and that row keeps its write-up, a press away on the map
— and everything else comes out of `data/places.csv`, which is an export from
Google Maps and the one file you actually put there.

```
node tools/places.mjs           rebuild data/places.json
node tools/places.mjs --check   report that it is out of date, exit 1
```

There is no single Google Maps export format, so the header row is read rather
than assumed. Any file with a column this recognises as a name will import:

```
Name,Address,Latitude,Longitude
Burger House,"Viru 24, 10140 Tallinn",59.4372,24.7530
```

Only a name is required. An address is worth having and coordinates are a
bonus: with them a row can point at a pin, without them the directions link is
a search for the name. Coordinates are also pulled out of a Google Maps URL
when there are no lat/lng columns, which is exactly the shape Takeout hands
back. The column aliases are in `COLUMNS` at the top of `tools/places.mjs`.

A CSV row that names a place already on the map is folded into it rather than
added again — same name, and no positive disagreement about where it is —
so the picker never shows one restaurant twice.

Commit the CSV. `tools/validate.mjs` runs `--check`, which rebuilds the
catalogue from whatever is in the repository and fails if the result differs —
so a CSV left on your laptop reads as a catalogue full of places that came
from nowhere, and CI refuses the deploy. It is public data either way: the
same names and addresses the picker downloads.

### Ids are kept, not recomputed

A catalogue id is written into somebody's list, in a database `tools/places.mjs`
cannot see. An id that changed when the CSV was re-exported would not be a
cosmetic churn — it would be a place quietly falling out of a list that
somebody wrote a sentence about.

So ids are taken from the previous `data/places.json` wherever a row can be
matched to one, on the folded name and address, and only a genuinely new row
gets a new id. A row that has gone is reported loudly on the way past, because
that id may be on a list.

And lists survive it either way: `list_items` stores the name a place was
added under alongside its id, so a list renders whole from the database alone.
A place the catalogue has lost keeps its name and its sentence and stops
linking anywhere, which is the smallest loss available.

### The tables

`lists`, `list_items` and `list_keeps` in `db/schema.sql`, applied the same way
as everything else there. `list_items` carries `pos` — the order somebody
dragged their top ten into — and the name snapshot above. `list_keeps` is one
row per person per list, keyed on the pair, which is what makes the count a
count of people rather than a count of presses. And `lists` carries `pin` and
`tone`, the two columns that arrived by `ALTER TABLE` and the two every read
survives the absence of — see **The two columns, and the afternoon they do
not exist** under **The pins**.

There is deliberately no counts table behind the keeps, the way `save_counts`
sits behind the saves. That one exists because the map asks for seventy-four
numbers at once and a `GROUP BY` over every save would cost one row read per
save to answer. Nothing asks that question of lists: a keep count is wanted one
list at a time, and the primary key answers it on an indexed prefix. The day
something does ask it in bulk — a directory ordered by how many people kept
each list — is the day this wants the same treatment, written the same way:
recomputed inside the batch that changes it, never nudged by one.

Deleting a list deletes the keeps on it, in the same batch. Left behind they
would be invisible — the index joins them to a list that is gone — and still
counted against their owners' cap, which is the worst combination available: a
drawer somebody can neither see nor empty.

Reordering sends the whole order rather than one move. A one-move message
("this one, up two") can arrive after another one and leave the list in an
order nobody asked for; the array is the truth and the rows are made to match
it. Anything the array does not name — a place added on another phone between
the drag and the save — is appended rather than left to collide.

### The caps

| | |
|---|---|
| lists per account | 24 |
| lists you can keep | 200 |
| places per list | 50 |
| title | 60 characters |
| the line under it | 200 |
| the line about yourself | 200 |
| what you say about a place | 280 |
| places before a list is listed on `/lists` | 3 |

Most of them are about somebody with a script rather than somebody with
opinions. They are in `functions/api/lists.js`, and the pages restate the
lengths so a field stops you at the keystroke rather than at the round trip.
The title's 60 is restated twice, because a list is named in two places now:
`assets/lists.js` where it is renamed, and `assets/account.js` where it is
first given a name. Change one, change all three.

The last one is the only floor among them, and it is in
`functions/api/_mostkept.js` beside the page it governs, restated from the
same three `assets/lists.js` has always wanted before it offers **Share**.
Nothing is deleted for falling under it.

Fifty places is the exception: a judgement about the feature, not a defence
of the database. It was twenty for a long time, and twenty was twice a top
ten — room to overshoot and cut back, and short enough that a list still reads
as a recommendation somebody stands behind rather than everywhere they have
ever been.

What moved it is **The chips, as lists** above. **All the casual and solo
places** is forty-five and **All the restaurants** twenty-seven, and a chip's
list that stops at twenty is not that chip: it is the first twenty of it in
the alphabet, which is a slice nobody chose. So the number is what the longest
of the thirteen needs with a little room over, and the argument the twenty was
making — a list nobody finishes reading recommends nothing — is the feature's
to make rather than the constant's. Casual/Solo is the one to watch: it is on
three places in five, the cap is five above it, and the validator fails on a
generated list that has outgrown it.

Two hundred keeps is higher than twenty-four lists because keeping is the cheap
half of this. A list is published under your name and twenty-four of them is
more than anybody maintains; a keep is a bookmark, nothing goes out under
anybody's name, and a bookmark drawer is allowed to be a drawer.

### What is not cached

Nothing on `/api/lists`, and nothing `/list/<id>` serves. It is the one place
in this codebase that does not reach for the edge, deliberately: a public list
is read by strangers, which argues for a cache, and it is also read by its
owner in the middle of writing it, which argues against one. Losing an edit
behind a thirty-second TTL would be the feature feeling broken at the exact
moment somebody is using it. A list read is a handful of rows on an indexed
key. It can afford to be true.

A private list is served only to the session that owns it, which is the other
half of the reason: a shared copy of that response would be somebody's private
page handed to the next person who asked for it.

### Indexed, and unfurled

A public list carries `X-Robots-Tag: index, follow` and a `<link rel=canonical>`
pointing at its address on the live domain. A private one carries `noindex`.

It was `noindex` for everything, once, on the reasoning that a list is somebody
else's writing on this domain and nothing moderates it. That is still true. What
changed is the reading of what a list is *for*: it is a page somebody wrote
about restaurants in this city, under their own name, and being findable is most
of the point. A list that travels only by the link its author remembers to send
is a page nobody arrives at. Somebody searching for the bakeries worth the walk
in Tallinn should be able to land on the list of them.

A private list cannot be indexed with or without the header — it is served only
to the session that owns it, and a crawler is never that session. The header
goes on it anyway, because a page's own answer should not depend on nobody
having made a mistake somewhere else.

`/list/<id>` is deliberately **not** disallowed in `robots.txt`, and never was:
the crawler that builds the preview card has to fetch the page to read its
`og:` tags, and a `Disallow` line would stop it fetching at all — every shared
list would arrive as a bare blue link.

`/lists.html` stays `noindex` — it draws nothing of its own any more and
replaces itself with `/account.html`, which is `noindex, nofollow` and
disallowed in `robots.txt` besides. That page is one session's own, and what a
stranger who lands on it sees is an invitation rather than anything worth
indexing.

If the trade stops being the right one it is one line in
`functions/list/[id].js`, where the header is chosen per list.

### Turning it on

Nothing beyond what **Saves** and **Accounts** already need — the same D1
binding and the same `SAVE_SALT`. Apply `db/schema.sql` again to pick up the
three tables this feature uses — `lists`, `list_items` and `list_keeps` (every
statement in it is `IF NOT EXISTS`, so it is safe to re-run at any time, and
re-running it is how `list_keeps` reaches a database that predates it):

```
wrangler d1 execute tallinntastebuds         --remote --file=db/schema.sql
wrangler d1 execute tallinntastebuds-preview --remote --file=db/schema.sql
```

And the pin column, which `CREATE TABLE IF NOT EXISTS` cannot add to a table
that already exists:

```
ALTER TABLE lists ADD COLUMN pin TEXT NOT NULL DEFAULT '';
```

Nothing breaks before it is run — every list draws the default marker and the
picker's presses are dropped — so this is a thing to do on landing rather than
a thing to do first. See **The pins**.

Without the binding the page says so and offers the map, the same way the
account button simply does not appear.

### What is not built yet

- **Anything social beyond a name.** A profile is a page about a person, and
  that is as far as it goes: no following, no hearts, no comments on somebody
  else's list. A keep is the one thing you can do to a list somebody else made,
  and it is silent: its owner sees a number and never who — including on
  `/lists`, where that number orders the page and still names nobody.
- **Any way to say a list is bad.** Nothing is reported, hidden or taken down
  by anybody but its owner, and the page that now ranks them gives a reader no
  way to push one down. The only lever on that order is keeping a list, which
  is the lever the feature already had.
- **A ranking of people.** `/lists` orders lists; a profile prints one person's
  total and no position in anything. See the end of **Profiles** for why the
  number was built and the table of people was not.

---

## Profiles

Every list on this site has said who put it together since the day lists were
written. The name was where the sentence stopped. `/u/<name>` is the rest of
it.

```
/u/kate          kate's public lists, and how often they have been kept
```

It is the same page `lists.html` has always been, served at another address by
`functions/u/[name].js` — the head swapped for that person's own tags, the
profile seeded into the document, exactly the way `/list/<id>` and `/lists`
work. There is no second HTML file, no second stylesheet and no second boot.

### What is on one

The public lists somebody has made, newest edit first, each with how many
places are on it and how many people kept it — the same row `/account.html`
draws for your own, which is what `listRow()` in `assets/lists.js` is for. The
year they turned up. And one number over the lot: **how many times, in all,
other people have kept these lists.**

And the line they wrote about themselves, when they wrote one. That is the
whole of it.

Nothing else. Not their saves — those are anonymous by design and filed under
a device as often as under an account, and a page that turned them into a
public record of where somebody eats would be a different site. Not when they
were last here. Not the lists they *kept*, which are a drawer of other
people's pages rather than anything they published. There is no email on an
account to leave off — see **Accounts**.

A profile discloses no fact about anybody that a list of theirs was not
already printing. That is the test it was built to pass, and the line below
is the one thing on the page that is not a consequence of it: it is there
because somebody typed it and pressed Save, which is the opposite of a page
revealing something.

### The line about yourself

Two hundred characters under your name on `/u/<name>`, and the only thing
anybody writes on this site about themselves rather than about a restaurant.
It is written on `/account.html`, on the card that carries your name, directly
over the door to the profile it appears on — write the line, then go and read
it where everybody else does.

It is the same box a list's intro is, at the same length and in the same
class, because it does the same job one floor up: a line under a title, not
a page about a person. A profile that opened with six paragraphs of
autobiography would have stopped being a page about somebody's lists.

**On the account page it is a line until you ask for the field.** What stands
there is what you wrote, drawn as `.lists-say` — the same class it is read in
on your profile, so the card shows you the thing rather than a box with the
thing in it — with one quiet word under it to change it, and nothing but that
word where nobody has written a line yet. The field arrives when the word is
pressed and goes again when the line is saved.

It was a field and a filled Save standing open on every visit, and two things
were wrong with that and they were the same thing twice. A page that had
already spent its accent on the box that makes a list was spending it a second
time here, which is **The design rules**, rule 5. And that is what it looked
like: the loudest thing on somebody's account was a two-hundred-character
field nearly nobody has ever typed in, which, once they had, stayed open and
stayed loud, saying *Saved* at a line that was already saved. The Save inside
the field is an `.alt` now for the same rule — the accent on that page belongs
to the box that makes a list, and it is still spent exactly once while this is
open.

There is no way out of the field that is not Save, and it needs none: nothing
has gone anywhere until it is pressed, and the field opens holding the line
that is already there, so pressing Save on a field opened by accident writes
back what was written before.

**Nothing is drawn on the profile for an account that has not written one**,
which is nearly all of them. That is the rule the standing and every save count
on this site already follow: a line reading "this person has not written
anything yet" is a page telling a reader about an empty field rather than about
a person. Emptying the field and pressing Save is how a line comes down, and
the server takes empty as an answer rather than as a mistake — on the account
page the word goes back to offering one.

**It does not ask for your password, and the other two changes do.** A
password change and a rename are each a way to take an account off somebody
— one locks them out, the other moves every link pointing at them — so both
are guarded by the password in use. A line on a page is neither. It is
something its author wrote and can rewrite, the way a list's title and intro
are, and those ask for a session and nothing more. Asking for a password to
edit a sentence teaches people to type it into a box that did not need it.

The column is `users.about`, and it reaches a database by hand like every
other schema change here:

```
ALTER TABLE users ADD COLUMN about TEXT NOT NULL DEFAULT '';
```

`db/schema.sql` lists it last because that is where SQLite puts an added
column, which is what keeps that file readable against the real table. It is
read on `/api/profile` and once more on `GET /api/account`, on the id already
in hand, so the box on the account page opens with what is in it —
`sessionUser()` does not carry it, because every signed-in request on this
site goes through that function and not one of the others prints this.

**Both of those reads are guarded, and that is the one thing about this
feature worth copying.** A schema change applied by a person and code deployed
by a push cannot be made simultaneous, so there is always a window where the
site asks for a column that is not there yet. Everywhere else that window is
survived by the feature simply not being reachable; here it would have been
survived by nothing, because the account page and every profile would answer
500 and take somebody's saves, lists and byline down with a line of
autobiography nearly nobody has written. So the account page catches it and
draws no box, and `readProfile()` falls back to the same query without the one
optional field. Run the `ALTER` and the line starts saving; until then
`/api/account` sends no line and the account page offers to take one, which is
the one thing in that window that is not quite honest — pressing Save there
fails and says so. The rest of both pages is exactly what it was before this
existed, which is the point.

### Private lists are not on it, including for its owner

The page shows the same thing to everybody. Your own profile is not your own
lists with the private ones added back — it is what a stranger sees, which is
the only thing a profile is useful for knowing. The private half is on
`/account.html`, where every list you wrote is named, and your name in the
header is the way there — the profile's card no longer draws a link of its
own, and `/api/profile` no longer says whether the person reading is the
person on it; there was nothing left for the page to do with the answer.

### The number, and what it is not

The standing is a sum: the keeps of every public list on the page, added up.
It is the only thing this site counts about a person, and it counts the one
gesture anybody can make towards somebody else's list — *keep this, I am
coming back to it.*

It is drawn only once it is more than nought, the same way a keep count under
a list and a save count on the map are. A "saved 0 times" line on somebody's
page reads as a verdict on them rather than as a number that has not started
yet, and the first keep is how anybody finds out the number is there at all.

It is honest exactly as far as an account is, which is the same thing
`/api/saves` says about its own numbers: one row per (list, account), so
nobody inflates it by pressing twice, and anybody willing to make ten accounts
can add ten. That is worth being plainer about here than it was when only a
list carried the number, because **Public lists** now orders a page on
the same counts — and it is the same answer: ten accounts buy ten keeps and
nobody has found that worth doing.

**A profile is deliberately not a position, and that is what separates it from
the directory.** `/lists` ranks *lists*, one page of them at a time, and the
argument for doing that is in its own section. Ranking *people* is a further
claim, and it costs more: "third of everybody" means grouping every
row of `list_keeps` by owner on every profile view, where a profile's own
total is twenty-four indexed prefixes and the sum of numbers already printed
under the lists on the page. So a profile says what happened to somebody's
lists and never where that puts them, and there is no table of people
anywhere. That decision is in **What is not built yet**, and it is still to be
made.

### Where they are linked from

- **The byline under a shared list**, which is the whole point — the phrase is
  the link, on the list's own page and in the panel the map draws for a list.
- **The byline on a row**, wherever a list somebody else wrote is drawn as one:
  `/lists`, the three rows at the foot of a list, and **Lists you saved** on
  `/account.html`. See **The row carries the first three places** under [Public
  lists](#public-lists) for the shape that made room for it.
- **Your own account page**, as the one row on the card that carries your
  name: *Your public profile — how your lists look to everybody else*. See
  **Two pages open with your name** under [The account
  page](#the-account-page).

### The address is a name, and a name can change

`/u/<name>` is the only address on this site made out of something somebody
can alter: a rename moves a profile to a new address and leaves the old one
answering 404. That is the honest cost of letting anybody pick a better name,
and it is said on the sheet that does the renaming rather than discovered from
a dead link.

What it is not is a way to become somebody else. The name a rename releases is
held for thirty days before anybody may sign up as it — see **The old name is
held for thirty days** under [Accounts](#accounts) — so a link to a profile
somebody has left leads to nothing for a month rather than to a stranger
standing where they were, and whoever left it can take it back in that time.

### Indexed, like a public list

Same reasoning: it is a page of somebody's writing about restaurants in this
city, under the name they chose, and a page nobody can arrive at is most of
the way to not being published. A profile with no public lists on it is a page
with nothing to find, so that one is served and not indexed; so is a name
nobody has, which answers 404 with the page on it and a line saying so.

Nothing is cached, for the reason a list is not: the number changes when
somebody presses Save, and a profile is most often opened by the person who
has just been told about it. `GET /api/profile` is the same answer for a page
the Function did not get to seed.

### Turning it on

Nothing to do. There is no new table and no new column — a profile is a query
over `users`, `lists` and `list_keeps`, all of which **Lists** already needs.

---

## Splitwise

Five people eat somewhere on this map, one card pays, and the rest of the
evening is arithmetic done badly in a group chat. **splitwise.tallinntastebuds.ee**
is that arithmetic done once: a group somebody names, a link they send to the
other four, a line for each thing anybody paid for, and one sentence at the
bottom saying who hands what to whom.

It is the only thing on this site that is not about restaurants, and it is
here because it is what happens immediately after one.

### Why a subdomain

Everything else on this site is a view of the map — a list is places off it, a
profile is the person who wrote the lists, the account page is your things.
This is not. Nothing in it points at a restaurant, nothing in it can, and a
fifth card on the account page reading "Groups" would have been a second
product filed under somebody's saved places.

So it has an address of its own, and the address is the only thing that is its
own. There is no second Pages project, no second database, no second build and
no second account system: `functions/_middleware.js` reads the hostname, serves
`split.html` at the root of the subdomain, and 301s every other address on it
back to `tallinntastebuds.ee`, so there is one copy of the map and one link to
it.

The page also answers at **`/split`** on every host, and that is not a
fallback — it is where the page actually lives. A preview deployment is
`<branch>.tallinntastebuds.pages.dev`, and no subdomain of the live domain can
exist under it, so a feature that only answered on the subdomain could never be
looked at on a pull request. The rewrite on the subdomain's root is one line of
convenience over the real route.

### The name

"Splitwise" is the name of an existing company's app, and this is a subdomain
and a page title using it. Nothing here is passing itself off as theirs —
there is no borrowed branding and nothing is sold — but the word is somebody
else's mark, and a site that keeps its reasoning in a file should say so rather
than leave the next person to discover it. Changing it is two constants and a
handful of strings: `SPLIT_HOST` in `functions/_middleware.js`, `ON_SUBDOMAIN`
in `assets/split.js`, and the `split*` keys in `data/ui.json`. Everything else
— the tables, the routes, the file names — is spelled `split`.

### It is the same account as the map

A member of a group is a `users.id` out of `functions/api/account.js`, made
from the same two fields the map's sheet asks for. Somebody who has been saving
places for a year is already somebody who can be owed eleven euros, and
somebody who signs up here to split a dinner can go and save places under the
same name.

**One line makes that work across two hostnames.** A cookie set with no
`Domain` is a cookie for the host that set it, so a session made on
`tallinntastebuds.ee` would not be sent to `splitwise.tallinntastebuds.ee` at
all — signing in on the map and arriving here signed out. `sessionCookie()` in
`functions/api/_lib.js` now scopes it to `tallinntastebuds.ee` when the request
came in on that domain or a subdomain of it, and leaves it host-only anywhere
else, because a `Set-Cookie` naming a domain that is not the request's is
dropped by the browser outright and every preview under `*.pages.dev` would
have lost its sign-in.

The cost is worth writing down: **every subdomain of `tallinntastebuds.ee` now
receives the session cookie.** There are two of them — this and
**[Flashcards](#flashcards)**, which signs people in by the same line — and
`_lib.js` is where to come back to before there is a third.

Signing out clears the cookie twice, host-only as well as domain-scoped, so a
browser still holding the one this site set for years before any of this is not
left signed in by a Sign out that appeared to work.

### The invitation

A group's id is its invitation: `dinner-at-rataskaevu-k3fmqw`, minted exactly
the way a list's id is — a readable stem from the name, and six characters out
of an alphabet with no vowels and no `0/o/1/l` in it. The link is
`/split?g=<id>`, and that one address is the whole of the routing:

| You are holding | and you are | so the page is |
|---|---|---|
| nothing | signed in | your groups, and the box that makes one |
| nothing | signed out | the offer of an account |
| a code | anybody at all | **the group** — and what changes is only what you may press |

The link people send each other is the same link they use afterwards, which is
the only shape of share link nobody has to be told twice about.

**Holding the link is the whole of the permission to read, and it buys the
whole group.** Its members, every line anybody put in, where everybody stands
and who pays whom — with no account, no membership and nothing to press first.
A stranger sees the group and a sign-in form where the controls would be; a
signed-in non-member sees the group and a Join.

That is a deliberate widening and it was not always so. For a day the code
bought the name and the headcount, and everything else was behind an account —
which put a wall in front of the one thing that would make somebody want to
climb it. Nobody should be asked to make an account to find out what they are
being asked to join. It is the rule a shared list has always been under, said
about a ledger.

**What it costs, said here rather than discovered.** The link *is* the
permission, so a link that gets away — forwarded past the table, pasted in a
channel that later gains a member, read off somebody's screen — is the group's
whole ledger and not just its name. Four things hold that in:

- the code is six characters from an alphabet of twenty-eight on the end of a
  stem, which is not something anybody guesses or walks;
- what is in there is usernames, what somebody called a bill and what it came
  to. No address, no card, no telephone number — this site holds none of those
  about anybody;
- **reading is all it buys.** Every write goes through a session *and* a
  membership, so a stranger with the link can read every row and change none.
  That is enforced in `functions/api/split.js` and driven as a test each time
  this changes;
- and the preview card a link-preview service builds carries the name and the
  headcount only, because the ledger is fetched by the page's own script and a
  crawler does not run it.

If a link does get away, the answer is the owner's: delete the group and make
another. There is no rotating the code, and adding one would be a second
address for the same thing.

### What the link looks like in a message

A group's link is not an address anybody browses to. It is a thing one person
pastes into a chat and four other people tap, so **the little preview card is
most of what the link is**. Pasted as a static page it arrived as *Splitwise |
Tallinn Tastebuds*, or as a bare blue URL — which tells the four people nothing
they did not know and reads like a link to the map.

`functions/split.js` serves the page instead of the file: it fetches
`split.html` out of the deployment and swaps the block between the
`<!--PAGE-HEAD-->` markers for that group's own tags, so the card carries

> **Split in Berlin**
> 4 people splitting what they paid for. Open the link to join.

with the site's mark beside it, and the tab says *Split in Berlin* rather than
the site's name. It is the same move `functions/list/[id].js` makes for a
shared list and it borrows that route's `esc()`, `rehead()`, `page()` and
`canonical()` — importing them, changing nothing there.

**The title is the group's name and nothing else.** `head()` in
`functions/_shell.js` spells one as *"<name> | Tallinn Tastebuds"*, hardcoded
so no caller can differ, and that is right for a page of the site and wrong for
this one: a card already carries the domain under it and `og:site_name` beside
it, so the suffix says the site's name a third time and pushes the only words
that matter further from the front. So this route writes its twelve tags out
rather than calling `head()`. `esc()` is the one thing it does **not** copy —
group names are typed by people and go straight into `content="…"`, and that
escaping lives in exactly one place on purpose.

**Fetched but never indexed**, which is not a contradiction: the card is built
by a fetch, and the page has nothing on it for a stranger and no business in a
search result. Every answer the route gives carries `noindex`.

That is also why **`robots.txt` deliberately does not disallow `/split`** — it
did for a day. A `Disallow` stops the fetch, and a stopped fetch is a bare blue
URL. The note beside `/list/<id>` in that file has made the same argument since
lists became shareable, and it applies harder here: a list at least has its
title in its address, and `/split?g=dinner-at-rataskaevu-k3fmqw` does not.

**It gives away nothing new.** The card carries the group's name and how many
people are in it — exactly what `inviteOf()` already answers to anybody holding
the code, signed in or not. It never carries an expense, a balance or a
member's name; those need a session and a membership, and a crawler has
neither.

### Money is cents, everywhere

Never a float. Money in a float is the bug that takes a year to surface —
three shares of 33.33 against a total of 100.00 that never quite balances, and
no way to say which cent went missing. The browser's fields take `24.60` and
`24,60` (one of the ten keyboards this site is read on writes the comma) and
send `2460`; `split_expenses.cents` is an integer; every sum in
`functions/api/split.js` is integer arithmetic. Euros only: the city has one
currency, and a column that could hold another is a column every sum would have
to start caring about.

### How a bill is divided, and the cent that does not divide

The obvious version divides the total by the number of members when the page is
read. It is wrong twice over. A group's membership changes — somebody joins on
Sunday and would retroactively owe a third of Friday's dinner — and an equal
split of 10.00 between three people is 3.33 three times, which is 9.99.

So the division happens once, when the expense is entered, against the members
as they stand at that moment, and the answer is written down in
`split_shares`: 3.34, 3.33, 3.33. The remainder cents go to the first few
members in join order, so the same bill divides the same way every time it is
read rather than moving a cent about between refreshes. Somebody has to have
the extra cent, and it is better that it is written down than that it is lost.

What a group owes is then a sum of integers over rows that cannot change.

### Where everybody stands, and who pays whom

Each member's balance is what they paid for, plus what they have handed over
since, less what they owe and what has been handed to them. The column sums to
zero — every cent that leaves one balance arrives in another, which is what the
remainder above is protecting.

Under it, the shortest list of payments that clears the column: biggest debt
against biggest credit, repeat. That greedy pairing is not guaranteed to be the
theoretical minimum number of transfers — that is an NP-hard problem and nobody
at a dinner table has one — but it always clears the balances, needs at most one
payment fewer than there are people, and gives the same answer every time it is
asked, which is what a page five people are reading together needs.

Pressing **Mark as paid** on one of those lines writes a `split_settlements`
row. A payment is deliberately not an expense with a negative amount: an
expense buys something and a payment only moves a debt, and folding the two
together would make every sum in the file have to know which it was looking at.

### Who may do what

A group is a room of friends rather than a wiki, and the rules are the smallest
set that keeps it honest:

| | who |
|---|---|
| add an expense | any member — the payer need not be the person typing, which is how this ever gets filled in at all |
| remove one | whoever entered it, and whoever paid it |
| record a payment | any member, since the button sits on a line about two other people |
| remove a payment | either end of it, and whoever wrote it down |
| rename the group | its owner |
| delete the group | its owner, and it takes everything in it |
| see the group | anybody holding the link — see **The invitation** |
| leave | any member who is not yet in the arithmetic |
| remove somebody | its owner, on a member who is not yet in the arithmetic |

**Leaving is for the person who opened the wrong link**, and that is all it is
for. The moment somebody appears as a payer, as a share of somebody else's
bill, or at either end of a payment, leaving would take their name out of a
column that still counts their cents and the group would stop adding up. So it
is refused, and the way out of a group you have spent in is for its owner to
take the whole thing down.

**Removing somebody is the same rule, held by the owner.** A group's code gets
handed around a table and lands in the wrong chat sometimes, and the only
answer used to be asking whoever arrived to leave and hoping. The owner can
take the whole group down; being able to take one name out of it is the smaller
version of a power they already have. It is refused on anybody the sums
mention, for the reason leaving is, and it is refused rather than cascaded —
deleting their expenses would be the owner quietly rewriting what other people
paid. The page only draws the control where it would work, reading that off
what the group already answered with rather than asking again.

The owner cannot remove themselves. The group's row names them, and what they
are reaching for there is **delete the group**.

There is no archive and no undo on that. What it deletes is who owed whom what
three weeks ago, which is exactly the thing nobody wants kept.

**A username, never a `users.id`, crosses the wire.** The id is the site's
internal handle — it is the owner column on a save, a list and a place somebody
added — and there is no reason for four friends to learn each other's. A
username is already public: it is the byline on every list here.

### The caps

| | | why |
|---|---|---|
| `MAX_MEMBERS` | 12 | the table you are sitting at. Past this the suggested payments stop being something anybody reads, and the thing being asked for is a different feature |
| `MAX_GROUPS` | 20 | per account, counted over membership: a group you were added to costs the same as one you made |
| `MAX_ENTRIES` | 200 | expenses per group, and payments per group |
| `MAX_NAME` | 60 | the group's name |
| `MAX_WHAT` | 60 | what an expense was for |
| `MAX_CENTS` | 1000000 | €10,000. Nobody splitting a dinner meets it, and a typo of six extra digits is refused at the door rather than left sitting in somebody's balance |

They are in `functions/api/split.js`, which is the copy that binds. The first
three of the lengths are restated in `assets/split.js` as `MAX_NAME`,
`MAX_WHAT` and `MAX_CENTS`, so a field stops somebody at the keystroke rather
than at the round trip — change one, change the other.

### Turning it on

Two things, and neither is automatic:

1. **Apply the schema to both databases.** `db/schema.sql` is re-runnable and
   nothing in CI applies it:

   ```
   wrangler d1 execute tallinntastebuds-preview --remote --file=db/schema.sql
   wrangler d1 execute tallinntastebuds         --remote --file=db/schema.sql
   ```

   Until it is run, `/api/split` answers `no such table` and the page shows
   nothing but its own error line. Preview first; production the moment the
   change lands, because the code is live within the minute of the push.

2. **Add the subdomain to the Pages project.** Cloudflare dashboard → the
   `tallinntastebuds` project → **Custom domains** → add
   `splitwise.tallinntastebuds.ee`. The DNS is already Cloudflare's, so this is
   one form and a certificate that issues itself. Until it is added, everything
   works at `/split` and the subdomain does not resolve.

There is no third variable and no second service. `DB` and `SAVE_SALT` are the
same two the saves and the accounts already need.

### Taking it out

This feature is meant to be removable, and it was built that way on purpose:
it is not sure yet whether it stays. So it is **six files of its own, eight
small additions to code that already existed and four to the documentation** —
no shared helper was extracted for it, no existing function was rewritten
around it, and nothing anywhere else on this site reads a row, a string or a
line of it. What it borrows, it borrows by importing: `functions/split.js`
reads four functions out of `functions/_shell.js` and that file is
byte-identical to what it was before any of this.

Delete these outright:

```
split.html                 the page
functions/split.js         the route that serves it, and the head that makes
                           a pasted link say the group's name
assets/split.js            the browser half
assets/split.css           its eighteen rules
functions/api/split.js     the route, and the five tables' only writer
data/split.json            its strings, all ten languages
```

Then take these back out. Each is an addition to a file that stood before it,
and each is fenced or prefixed so it can be found by looking:

| File | What is splitwise's |
|---|---|
| `functions/_middleware.js` | the `SPLITWISE` block of constants (including the `import` of the route above) and the `SPLITWISE` block inside `onRequest()` — both marked, both additions, nothing above them was touched |
| `functions/api/_lib.js` | **Nothing, any more.** `SESSION_DOMAIN`, the two lines in `sessionCookie()` that read it and its third parameter were the only thing splitwise changed rather than added, and taking splitwise out used to mean putting them back. It does not now: **[Flashcards](#flashcards)** is on a subdomain too and signs people in by the same cookie. Leave this alone until the last subdomain goes |
| `functions/api/account.js` | the third argument at the two `sessionCookie(token, SESSION_DAYS, request)` calls, and the second `set-cookie` in the `logout` branch, which exists only to clear the domain-scoped one |
| `tools/validate.mjs` | the `SPLITWISE` block after the `ui.json` check, and the one line adding `splitKeys` to `known` |
| `tools/stamp.mjs` | `'split.html'` in `PAGES` |
| `_headers` | the `/split.html` and `/split` rules |
| `robots.txt` | the paragraph about splitwise. There is no `Disallow` to put back — see **What the link looks like in a message** — so removing it is removing a comment |
| `README.md` | this section, its line in **Contents**, its four lines in **Files**, the two `split.json` lines under **What the validator checks**, the domain-scoped-cookie bullet under **Accounts**, and the subdomain paragraph under **The custom domain** |
| `CLAUDE.md` | the row in the process table, and the clause in the opening sentence |
| `.claude/skills/api/SKILL.md` | the `/split` and `/api/split` rows, and the splitwise clause in the `/*` row |
| `.claude/skills/site/SKILL.md` | the `split.html` in the stamped-pages list, and the paragraph about `data/split.json` |

And in Cloudflare: remove `splitwise.tallinntastebuds.ee` from the Pages
project's **Custom domains**, and drop the five tables —
`split_shares` first, then `split_expenses`, `split_settlements`,
`split_members`, `split_groups` — from both databases, along with their block
in `db/schema.sql`.

**What has no removal step, and that is the point.** `data/ui.json` is
untouched by this feature — not one of its strings moved, which is why the
splitwise ones are in a file of their own. `functions/_shell.js` is not edited
by it either, though `functions/split.js` reads four functions out of it: it is
imported from and never changed, which is what makes deleting the importer the
whole of the job. `functions/api/lists.js`, `functions/list/[id].js`,
`assets/app.js`, `assets/lists.js`, `assets/account.js`, `index.html`,
`account.html`, `lists.html`, every other stylesheet and every file under
`data/` except the new one carry no line of splitwise's.

Three of those files have since been edited by something else —
**[Flashcards](#flashcards)** put a line in `EMPTY` in `functions/_shell.js`, a
row in `youCard()` in `assets/account.js`, and its own keys in `data/ui.json`.
None of it is splitwise's and none of it moves when splitwise goes. The claim
above is about this feature's reach, not about the files standing still.

**The one real cost of keeping it separate**, said out loud because this repo
does not hide trades: `functions/api/split.js` carries its own `shareCode()`,
`slugOf()` and `words()`, which are a second copy of what
`functions/api/lists.js` has. They were shared in `_lib.js` for a while, which
is what this codebase normally does with anything two routes need —
`nearTallinn()` says so in its own note. That is the right answer for a
permanent feature and the wrong one for a provisional one: a shared helper is
the thread that turns a deletion into an unpicking. **If splitwise is kept,
that is the first thing to revisit**, because two copies of how an unguessable
invitation is minted is two copies that can drift.

### What it does not do

No receipts, no photographs, no categories, no reminders, no currency but the
euro, no unequal shares — a bill is split evenly between the people you tick,
and the way to handle "I only had the soup" is to enter the soup as its own
line. No notifications of any kind: this site has no address for anybody, which
is the whole shape of its account, and that has not changed for this.

It is also not on the map, and must not become so. Nothing in `data/` knows
this feature exists.

---

## Flashcards

A site about eating in Tallinn is read mostly by people who cannot read the
menu. **flashcard.tallinntastebuds.ee** is the other half of that: forty-two
decks of Estonian, one thousand nine hundred and sixty cards, the
Estonian on the front and what it means on the back — in English, Azerbaijani
or Russian, whichever the page is being read in — and one card at a time with
two words under it — *Knew it*, and *Show me again*. Over the card, how the
sitting is going; under it, while the front is up, the first letters of the
answer for anybody who wants them; and on the decks page, how many words you
know in all.

It is the second thing on this site that is not about restaurants, and it is
here for the same reason the first one is: it is what the people this map is
written for are short of.

### Why a subdomain, again

The argument is **Splitwise**'s, word for word, and it is worth not repeating
at length: everything else here is a view of the map, this is not, and a sixth
card on the account page reading "Flashcards" would be a second product filed
under somebody's saved places.

So it has an address of its own and nothing else of its own. No second Pages
project, no second database, no second build, no second account system:
`functions/_middleware.js` reads the hostname, serves `flashcard.html` at the
root of the subdomain, and 301s every other address on it back to
`tallinntastebuds.ee`.

The page also answers at **`/flashcard`** on every host, and that is where it
actually lives. A preview deployment is `<branch>.tallinntastebuds.pages.dev`
and no subdomain of the live domain can exist under one, so a feature that
answered only on the subdomain could never be looked at on a pull request.

**The page has a route of its own, and it is for both of the reasons
splitwise's is one.** `functions/split.js` writes a group's name into the head
because a group's link is pasted into a chat and the little preview card is
most of what the link is — and a link to this page is sent to somebody too,
which is the half of it written up under **When somebody sends the link**
below. What splitwise has no version of is the other half:
`functions/flashcard.js` writes the deck's own title and description **and the
deck's words into the page as text**, so that somebody searching for what an
Estonian word means finds the deck that answers it — in all three languages the
cards are written in, one `<dt>` and up to three `<dd>`s, because *что значит
leib* is the same question as *what does leib mean* and until the decks had a
Russian side the answer here was in a language that asker may not read either.
See **How it is found** below.

### When somebody sends the link

For months a link to the flashcards pasted into a chat arrived as the site's
own card: the watercolour mouth over **All the places in this map I have
personally been and approved**. The title beside it said *Estonian flashcards*
and nobody read it, because the picture is nine tenths of what a preview card
is and that picture was about somewhere to eat.

So this page has a card of its own — `assets/logo/og-flashcard.png`, the only
one on the site besides `og.jpg` — and it is a picture of what the page is: a
flashcard with **Leib** on it and *tap to turn it over* under that, beside the
page's own eyebrow, title and the line that says how it works. It is drawn by
`node tools/ogcard.mjs` out of `assets/logo/og-flashcard.html`, which links
`assets/styles.css` and `assets/flashcard.css` and uses the page's own class
names, so the paper, the hairline, the shadow, the corner and all three faces
are the ones the page is actually wearing rather than a second set drawn to
match. Change a token or a rule in `flashcard.css` and the card is redrawn in
the same commit, the same way a scene in `clips/` is.

**The words follow the link's `?lang=`, out of the three.** `?lang=az` unfurls
in Azerbaijani, because whoever sent that link chose Azerbaijani for the person
they were sending it to — the same argument
**[Sharing a place](#sharing-a-place)** makes for `?spot=`, and the opposite of
the one a shared list is under, which has no reader to ask. The door's two
strings are `flashDoor` and `flashWhat` out of `data/ui.json`, which speaks all
ten; this page reads three of them, so `?lang=fi` gets an English card in front
of an English page rather than a Finnish door over an English deck name.
**Three languages, not ten** below is why.

Two things it deliberately does not do. **The picture stays in English**,
whatever language the words beside it are in: it is a rendered file rather than
a template, and three of them would be three pictures to redraw every time a
token moves — which is exactly what `og.jpg` does on a map shared with
`?lang=et`. And **`?lang=` reaches neither the canonical nor `og:url`**, so
this is one page in three languages rather than three pages. What that costs is
Facebook, which treats `og:url` as the identity of the thing shared and will
therefore keep one card for all three; WhatsApp, Telegram, Slack, Signal and X
read the tags of the address they were handed and show the language the link
was sent in. The other way round is three entries in `tools/sitemap.mjs`, an
`hreflang` set and three pages for a page nothing links to — the bargain the
map struck for a reason this page has not got.

### How it is found, which is two doors now

**The map's own chrome points here, since the door count went from one to
two.** A pill on the rail — `#btn-flash` in `index.html`, third down, under
Everybody's lists — links to `/flashcard` in plain markup, no script needed
to find it. The other door is older and stays: **one row on
`/account.html`**, behind a sign-in, on the card that carries somebody's own
name, beside their public profile, because the decks you write are one of
your own things and that page is where those live. Both wear the same words
— `flashDoor` and `flashDoorWhy`, already in all ten languages — so a deck of
Estonian reads the same wherever the door was pressed; they report apart,
`flash_open_rail` against `flash_open_account`, which is the one place they
differ, because the question the rail door exists to answer is whether it
gets pressed at all.

This reverses "no pill on the rail" as a decision rather than dropping it by
accident: a stranger on the map used to have no way to learn the decks
existed short of signing in first, and that is a stronger silence than
"the map's own chrome is for finding dinner" was arguing for. The map's own
chrome is still for finding dinner — nothing else about it changed, no row
in the sheet, nothing in a footer — but a deck of Estonian is something you
go to, and now there is a way to go to it from the thing everybody opens
first.

**Unlinked is not the same as hidden**, and this is the one place the feature
changed its mind after it was built. It shipped `noindex` for a day, on the
reasoning that a deck somebody wrote is theirs alone. That reasoning is right
and it is about the wrong half: what a deck of your own needs is your session,
which no crawler has, and the route answers that address `noindex` on its own
account. The **decks the site ships are a file anybody may read**, and
somebody searching for what *Arve, palun* means should find this site
answering.

**`/flashcard.html` is the exception and keeps its noindex**, in `_headers`.
It is the same page at the address nobody is given, the route never answers
there, and two indexable addresses for one page is a search engine picking one
and half the links pointing at the other. That is the same split `/lists.html`
and `/lists` have been under since the directory was written.

So the arrangement is **the blog's** — see **[The blog](#the-blog)** — rather
than the split page's: unlinked-to-a-deck and indexed. `robots.txt`
deliberately does not disallow `/flashcard`, `sitemap.xml` carries one address
for the decks page and one per deck, and `functions/flashcard.js` writes each
deck into the `<main>` the page ships empty, so a crawler that runs no script
still gets the Estonian. The rail pill is a real link to `/flashcard` now, so
that page is found the way any page with a link on the homepage is; what
`sitemap.xml` is still very nearly the only way in for is **a deck**, since
the rail and the account row both stop at the list of decks rather than
naming one.

**One address per deck, and the subdomain is not it.** The page answers at
`/flashcard` on the live domain, at the root of the subdomain, and at
`/flashcard` on every preview — three addresses for one page, which is exactly
the split the `pages.dev` redirect exists to stop. So `where()` in
`functions/flashcard.js` makes the subdomain name the live domain's spelling as
its canonical, and a preview goes on naming itself. The short address is still
the one people are given; this only settles which of them a crawler keeps.

### Where the words are, and it is mostly not the database

`data/decks.json` is the Estonian the site ships: forty-two decks, one
thousand nine hundred and sixty cards, deployed as a file and read as one. It
is **content** — somebody edits the repository, the deploy carries it, every
reader gets the same cards — and content that changes when the repository
changes belongs in the repository. A row per card would be a copy of a file
that only a deploy changes, and the first thing anybody would then have to
write is the tool that keeps the two in step.

The four tables hold the three things a file cannot: the decks people write for
themselves, how far each person has got, and which of the shipped cards a
reader has said is wrong. `functions/api/flashcard.js` is the only thing that
writes any of them.

### Where the second thousand came from

The first thousand cards were written from this site outwards: what is on a
menu, what the person behind the counter says, how to ask the price and
understand the answer. That is the half of Estonian a visitor needs and it is
nowhere near the half a resident needs, which is why the next nine hundred and
forty-six came from the other direction — **the glossary of the beginners'
course**, the Estonian–English and Estonian–Russian word list a language school
hands out, read straight down and filed deck by deck.

Three things came with it and are worth saying out loud. **The principal parts
came free**, because a glossary prints them — *aadress, aadressi, aadressi* is
a `forms` pair already written, which is why the share of cards carrying one
went up rather than down. **The Russian came free** and the **Azerbaijani did
not**: the list has two columns and the third language of this file is written
here, card by card, which is the slow part of an import like this and the part
worth checking. And **nothing that is a name came in at all** — a glossary of a
course is half *Jaanus, Jaanuse, Jaanust* and half Estonian place names, and a
flashcard that asks you to turn over somebody's first name teaches nothing.
Lesson numbers went the same way.

**Eight decks are new**, because a deck is where a word is found and dropping
two hundred words into *The words in between* is a way of losing them:
**Colours and patterns**, **Head to toe**, **What is in the kitchen**,
**Cooking it yourself**, **Who does what**, **What somebody looks like**,
**What somebody is like** and **Holidays and celebrations**. Each is a subject
the glossary carries thirty words of and this file carried none. The other
seven hundred went into the decks that were already the right place for them.

### The back of the card is in three languages

The front is Estonian, because that is the thing being learnt and it is never
translated. The back is what the word means, and it carries three — an object
keyed by language, which is the shape a place's `blurb` has had since the map
was written:

```json
"back": { "en": "Black bread", "az": "Qara çörək", "ru": "Чёрный хлеб" }
```

A deck's `name`, the line under it in `why`, and the translated half of a
card's `sentence` are the same shape. `forms` is not: those are Estonian.

**This section used to say the opposite, and the argument it made was a good
one.** A deck is somebody's writing rather than an interface string — the same
footing a post on **[the blog](#the-blog)** is on — and the ten languages are
for the words *around* it. What that missed is what a flashcard is. A blog post
in English is a paragraph somebody skips; the back of a flashcard in English
*is* the lesson, and an Azerbaijani or Russian speaker learning Estonian off one
was being asked to do two languages' work to do one — and to do the second of
them in the language they were least sure of, on the card that was meant to be
the help. The people this site is written for are exactly the ones that fell
hardest on.

**Three rather than ten**, and that is a decision rather than a first pass at
all of them. Azerbaijani and Russian were asked for and are written; the other
seven fall back to the English, and the page around the cards is in three for
the same reason — **[Three languages, not ten](#three-languages-not-ten)**
below. `means()` in `assets/flashcard.js` is the whole of the picking and the
only thing it does. Adding a fourth is a key per card in `data/decks.json` and
a code in `DECK_LANGS`, which is one list in `functions/api/_lib.js` that both
Functions and `tools/validate.mjs` import, with no page code to change — and
until somebody finishes writing it the cards go on working in English.
`tools/validate.mjs` fails a card with no `en`, because that is what everything
else falls back to, and only *warns* about a card missing one of the other two:
that is the footing a blurb is on, and a card added today and translated on
Thursday is still a card.

**Estonian is never an answer.** `means()` refuses to read an `et` even where
there is one, and the validator fails a `back` that has one. On this page
Estonian is what the front asks, so an Estonian back would be a card answering
itself; the `et` inside a `sentence` is the Estonian sentence rather than a
translation of it, which is why that one field is checked apart. Somebody
reading the site in Estonian gets the English back.

**Which language that is, this page now asks.** It did not for a while, and
the paragraph here said so: the back followed `?lang=`, then `ttb.lang`, then
the browser's own languages, the same order every word around it follows, and
there was nothing on the page to say otherwise. At `/flashcard` on the live
domain that works — the language chosen on the map comes along with it. On
**flashcard.**tallinntastebuds.ee it does not: `localStorage` there belongs to
another origin and is always empty, so the middle of the three is missing and
what is left is the browser's languages or an address somebody would have to
type. Which left the reader this page exists for — somebody learning Estonian
through an English they are shaky in — as the one person with no way to ask
for Russian. So there is a switch, and the next section is it.

**And the interface is still in `ui.json` with everything else.** That half of
the old argument stands: it is deliberately *not* the arrangement splitwise has,
where the strings live in a file of their own. The `/site` skill says in so many
words that there is one such exception and a second would be two files to keep
in step. So the seventy-four `flash*` keys are in `ui.json`, and taking this
feature out means taking seventy-four keys out of ten blocks rather than deleting
a file. That is the price of the rule, and it is the right way round — a stale
string is worse than a tedious deletion.

### A language of your own to learn it in

The map's switch, in this page's header: the code you are reading in, a menu
of three under it, each with the name that language has for itself. It is
the same control, drawn with the same rules out of `assets/styles.css` — there
was nothing to invent, only a surface to put under it, because the map's comes
from `.controls` and this page has no `.controls`.

**The codes ride in with the words.** The route already sends the one language
block this page prints from; it sends `langs` beside it now — sorted by code
the way the map sorts its own menu, each with its `langName`. Three short
pairs, well under a hundred bytes against the eight to ten KB already in the
answer, and the page draws the menu out of the same one request it draws the
cards from. A file that could not be read is an empty list and no switch at
all, which is right: a page that cannot name the languages should not offer
them.

#### Three languages, not ten

This is the one page on the site that speaks fewer languages than the site
does. The map, the lists, the directory and the blog are all in ten; the
flashcards are in **English, Azerbaijani and Russian**, which is the three
`data/decks.json` writes the back of a card in.

The reason is what a flashcard is, and it is the argument
**[The back of the card is in three languages](#the-back-of-the-card-is-in-three-languages)**
makes about the card, carried out to the page around it. A blog post in
English is a paragraph somebody skips. The back of a flashcard *is* the
lesson — so a Finnish switch, a Finnish door and a Finnish count wrapped
around one thousand nine hundred and sixty English answers is the page
promising something the cards cannot deliver, and it was the Finnish reader
who found that out one card in. Better to say three and mean them: `?lang=fi` here is
English throughout, and Finnish everywhere else on the site.

`DECK_LANGS` in `functions/api/_lib.js` is the list, and it is one list rather
than two on purpose: `functions/flashcard.js` writes the head and the words a
crawler reads, `functions/api/flashcard.js` answers the page's one request,
and a second copy is how the card a link unfurls as comes to be in a language
the page behind it is not. Both the language this is read in and the `langs`
the switch is drawn from are narrowed by it, because a page that offered three
and then honoured a fourth in `?lang=` would be reading in a language it does
not admit to having.

Adding a fourth is therefore two steps and no code: write that language into
every card's `back`, every deck's `name` and `why` in `data/decks.json`, and
add its code to `DECK_LANGS`. `data/ui.json` already speaks all ten, so the
words around the cards are waiting.

**Picking one does not reload the page.** That is the whole reason this is
thirty lines rather than one. A reload would throw away the run, which signed
out is kept in this tab and nowhere else — press Russian halfway through a
deck and the deck would start again. The cards, the deck names and the
sentences are objects keyed by language and are already in the browser, so the
only thing missing is the block of words around them: `pickLanguage()` asks
the route for that one block, and the page redraws in place the way the map
does. The card you had turned over stays turned over, in the new language.

Three things hear the choice and only one of them is this tab. `ttb.lang` on
this origin is what the next visit reads — the first thing the subdomain has
ever had to put there. `?lang=` goes into the address, so `at()` carries it on
to every link the page draws and a deck opened from here opens in the language
it was opened from. And the route is where the words are. If it does not
answer, nothing changes and the page says so in the language it is still in:
the one thing it must not do is start printing its own keys because somebody
pressed a language.

The menu shuts on Escape, with the focus handed back to the button it dropped
from, and on a press anywhere outside it — the map's own two rules, and the
only listeners this page puts on the document.

### Opening a deck does not load the page

Both of this page's addresses — the decks, and `?d=<id>` — draw out of the same
`<main>`. The decks, a deck being turned over, the editor, the end of a run and
the gate are five things `render()` decides between rather than five pages, and
for a long time the only reason opening a deck was a page load at all was that
`asked` was read off the address once, on the way in.

It cost the radio. A document that goes takes its `<audio>` with it, and the
button on this page is pressed by somebody settling in to learn Estonian for
twenty minutes: open a deck, back to the decks, open the next one. The music
stopped on every one of those, and the tap that would have started it again —
see **The radio** — was itself the next navigation, so six decks in the radio
had spent the whole sitting reconnecting, or been refused outright and left
waiting behind a button that said it was on.

So the two addresses are taken in the page, which is what `assets/blog.js`
already does between its index and a post, for the same reason. `go()` asks
`/api/flashcard` for the decks or for one deck, puts the answer exactly where
the first load puts it, and pushes the address the link was carrying; the back
button arrives as `popstate` and takes the same road without pushing anything.

The links keep their real `href`s, so a middle click and **Open in new tab**
still open a deck in a new tab, and the page a crawler or a chat window is
served is untouched — `functions/flashcard.js` writes the deck into the markup
and that is always a fresh load. The four things a page load used to do for
free are done by hand and are worth naming, because each of them was a bug
first: the tab's title goes back to the page's own name when a deck is closed;
the scroll goes to the top of a deck and back to where the decks were left,
since forty-two of them is several screens on a phone; the focus lands on the
card in hand or on `<main>` under it; and the page view is reported through
`TTBTrack.view()`, because the tag counted every one of those documents and now
counts only the first.

What does **not** change is the gate. One word signed out is one word, and the
tab's own store is read back on every one of these walks exactly as it was read
on every reload — see **Signed out, one word of a deck**. Walking out of a deck
and into another one was never a way past it and is not one now.

### And a radio while you learn it

The map's button, in the same header, to the left of the language: a station
plays while the cards are turned over. It is the control the map, the lists,
the account page, the blog and the feedback page all wear, mounted on this page
the way they mount it, and **The radio** is the whole of how it works.

Three things are this page's own. The station follows the switch beside it —
pick Russian half way through a deck and Наше Радио comes on under it, the way
it does on the map, rather than the page changing language behind a button still
naming the last station. The button waits for the words: what it says is
`radioPlay` or `radioStop`, and those arrive in the same answer as the cards,
so mounting it any earlier would hand a screen reader a key instead of a
sentence. A load the route cannot answer at all leaves it hidden along with
everything else here. And it plays across a whole sitting rather than across one
deck, which is **Opening a deck does not load the page** above and is the one
place on this site where the radio has no seam in it at all.

What it does not do is arrive playing. The radio walks from the map to a list
because both are one origin, and on flashcard.tallinntastebuds.ee it is not —
the same line that empties `ttb.lang` and gives this page a language switch at
all. At `/flashcard` on the map's own hostname it carries across as it does
everywhere else. So there is one press to make here, at the start, and after
that the decks go by underneath it.

### It is the same account as the map

An owner is a `users.id` out of `functions/api/account.js`, and the session
cookie has been scoped to the domain rather than the host since splitwise — see
`sessionCookie()` in `functions/api/_lib.js`. Signing in on the map is being
signed in here. **That line now has two readers**, which is worth knowing
before either feature is removed: taking splitwise out does not take the line
out any more.

### One request on the way in

Every other page on this site fetches `data/ui.json` whole before it draws:
ten languages of every string the site has, 307 KB, 85 KB gzipped, to print
its few dozen keys in one of them. On this page that was the largest thing
between opening it and seeing a card, and the least of it was used — the map's
stylesheet is the only heavier file, and that one is at least mostly drawn.

So the flashcards fetch it no more. The words ride in the same answer as the
decks: `assets/flashcard.js` sends `/api/flashcard` what it would have picked
a language from, in the order every page picks — `?lang=`, then `ttb.lang`,
then the browser's own — and `wordsFor()` in `functions/api/_lib.js`
takes the first the site speaks and answers with that language's block, eight
to ten KB gzipped, beside the decks. One request before a card can be drawn
rather than two, a tenth of the bytes, and the same rule `pickLanguage()`
applies everywhere else, moved to where the list of languages is.

The whole block goes rather than the eighty keys the page uses, on purpose: a
list of keys in the route would be a second copy of what the page asks for, and
the validator, which checks every `t('key')` against `ui.json`, could not see
the two drift.

The three codes come with it — `langs`, each with that language's own name for
itself — because the page has a switch on it now and the switch has to be able
to name them. Well under a hundred bytes, and still one request before a card
can be drawn. **A language of your own to learn it in** above is the switch,
and **Three languages, not ten** under it is why there are three of them and
not ten.

And when the site does not answer at all, the page draws nothing: it has no
words to say so in, and what it would print instead are its keys. What is
left is the markup's own English and whatever `functions/flashcard.js` wrote
into the page as text — the decks as a list of links, or a deck's words — which
reads and works, and the map is one press away in the header.

**The other pages still fetch the file.** This is the pattern for them, not a
change to them: the map, the lists, the account page and splitwise each boot
the same way this page did, and each would drop 75 KB from its first load the
same way. That is a change to `assets/app.js` and three others, and it was
deliberately not made in the change that made this page fast.

### Signed out, one word of a deck

Open any deck signed out and the first card comes up, turns over and is
answered the way every card is. Then, where the second card would have been,
one card stands and says the rest of the deck needs an account. There is no way
past it.

**The gate is not about the account, it is about what a flashcard is.** A deck
here is not a list of words to read — it is the asking again tomorrow, then in
three days, then in a week, and **The spacing** below is most of the feature.
That takes a row per card per person, and there is nowhere to put one for
somebody the site has never met. A page that went on handing out cards with
nothing recording the answers would not be a lighter version of this; it would
be this page pretending, and the person doing it would find that out at the end
of the deck rather than at the start of it. Better to say so at the second
card.

**One word rather than none.** Somebody who has been shown nothing is being
asked to sign up for a description, which is both rude and dull, and the only
route into this page from outside is a search result — see **How it is found**
— so the first thing a visitor sees has to be the thing they came for. So the
word is a real card, answered the real way, and `keep()` writes that answer
into the tab as it is given, which is what lets the card say that the one
already done comes with them.

**And one word rather than one a deck.** A free word in each of forty-two
decks is forty-two words, which is a product rather than a sample: the tab
holding any answer at all is what raises the gate, on that deck and on every
other. That is also what stops the reload button being the way past — the run
rebuilds itself from what the route answered, and the route has no idea who is
asking, so without this line a refresh would hand over the next card for
nothing.

It is **the tab's** word, in `sessionStorage`, so somebody who comes back
tomorrow gets another one. That is not a hole to close. Closing it means
following people who have not signed in, which this site does not do anywhere
else and is not going to start doing here; and the person it would catch — the
one who opens a new tab each day to read one Estonian word — is not the person
the gate is for.

**What is not behind it.** The decks page, whole: forty-two decks, their
names, what each is for and how many cards it holds, all readable signed out
and for as long as anybody likes. The way out of a gated deck is *All the
decks* in the head above it, where it stands on every view of a deck. The deck
stops; the site does not.

**What an account buys**, then, is the page: **Knew it is remembered** — on the
account rather than on the device, so a deck you got half through on a phone is
half through on a laptop. That is the deliberate difference from **Saves**,
where a bookmark with no account is kept in the browser and works perfectly
well as a device's. A save is a fact about a place. A card you know is a fact
about you, and it is also the whole of the machinery.

**This is the fourth arrangement and the three before it are worth keeping.**
The offer stood only at the end of a run, on the reasoning that nobody should
be asked to make an account to find out whether a thing is worth one — a good
sentence, answering a question nobody was asking. Then it stood in front of the
deck, which put a form between somebody and a thing they had not seen: dull,
and the sensible thing to do with a form like that is to go round it. Then it
stood one word in with *Go through it without saving* under it, which read well
and left the page doing the one thing it cannot do. Each of those was a
reasonable answer and each was answering the wrong question; the question is
what a deck of flashcards is for.

**It is drawn only where an account would work.** With the database off there
is nothing behind the form but a 503, nothing to sign in to and nothing being
kept from anybody, so the deck runs the way it always did — the same rule the
card at the foot of the decks is drawn under.

**What this costs the search route, measured rather than assumed.** The worry
was the obvious one: `functions/flashcard.js` writes each deck's words into the
page as text, `sitemap.xml` points at forty-two of them, and a gate that a
crawler never meets is the soft-paywall shape Google is entitled to take a dim
view of — on the one route into this page from outside.

It turns out the gate does not change what a crawler sees at all, and the two
halves are worth keeping apart. Loaded with scripts off, `<main>` holds every
word of the deck and its meanings. Loaded with scripts on, `<main>` holds
`Tere`, *tap to turn it over*, and `1 / 15` — because `render()` empties what
the route wrote before it draws, which the header of `functions/flashcard.js`
has said since the day it was written. Googlebot runs scripts, and it does not
answer a card, so what it indexed before the gate and what it indexes after are
the same thing: one Estonian word, no meanings. The gate stands where no
crawler ever reaches.

So there is no new mismatch here. There is an **old** one, and it is worth
somebody's afternoon on its own: the words the route writes for search are
words the rendered page throws away, so whether a deck is indexed for *what
does leib mean* depends entirely on which crawler arrived. That was true before
any of this and is not a thing to fix inside a change about accounts — but it
is why a deck page ranks less well than its `<main>` suggests it should, and
nobody should rediscover it from scratch.

**And making one keeps the run that argued for it.** That took a mechanism
rather than good intentions: the card says "Remember where you got to", and
the way of taking it up used to leave the page — the password form reloaded,
Continue with Google goes to Google and comes back — so the twenty cards that
were the whole of the evidence had gone by the time somebody acted on them.
Signing in at the end of a deck put you back at the start of it, which is the
opposite of what the sentence you pressed had said.

The password form no longer reloads: it asks the route the same question the
way in asks and becomes the answer, which is **Opening a deck does not load
the page** again, and takes the radio with it — on a phone that reload was the
deck-switching bug wearing a different hat, and somebody who signed in at the
gate spent the rest of the sitting in silence behind a button that said the
radio was on. The Google trip still leaves the origin, because that is what
signing in with Google is, and it is the reason the mechanism below is storage
rather than anything held in the page.

So an answer given with nobody to tell is written into the tab's own storage as
it is given, and the first answer from the route that arrives with a session
posts the lot and clears it — the load on the way back from Google, or the one
the password form asks for itself. `sessionStorage` rather than `localStorage`, because the run is the
tab's — closing the tab on a deck rather than signing in is an answer too — and
keyed by card, so a word got wrong and then right in one run arrives as the
answer it ended on rather than as two writes racing. Past two hundred cards it
stops keeping them, and those are asked again next time, which is the same
harmless direction a failed write already errs in.

**And every load reads it back, which for a while no load did.** The store was
written to from the first day it existed and only ever read on the way into an
account, so signed out it was a drawer nothing was ever taken out of. The run
was rebuilt from what the route answered, and the route knows nothing about
somebody who has no account, so every card came back due: turn ten of them,
reload, and there were fifteen again with the ten sitting in storage. A reload
is not the rare event that makes that sound survivable, either — every deck was
an `<a href>` the browser followed and *All the decks* was another, so walking
out of a deck and back into it was enough to lose the lot, and what a visitor
saw was a page that plainly was not keeping anything. It reads the store on the
way in now, the same line that posts it when there is a session, so the answers
stand for as long as the tab does — and those two walks no longer load the page
at all, which is **Opening a deck does not load the page** above, and which
makes the reading back a rule about reloads rather than about every press.

**Closing the tab is still the end of it**, and that is the decision rather
than the next bug. `localStorage` would make a run survive a browser restart
and a row on a device id would make it survive the browser, and both are the
thing the account is for — the whole of what an account buys on this page is
that Knew it is remembered, and remembering it for people who have not made one
would leave the card above with nothing true to say. The tab is the compromise:
long enough that an evening's work is not thrown away by a stray navigation,
short enough that it is still the account that keeps things.

### How a run works, and when a card comes back

Opening a deck builds a run of what is **due**: everything you have never got
right, and everything whose wait has come round again. The ones you have never
got right come first, so a deck opened after a fortnight away starts with what
is new rather than with a revision.

Turn a card over and the two words appear. **Knew it** writes the row and moves
on. **Show me again** drops the row into box nought — **The deck of what you
got wrong** below — and puts the card on the end of the run, so it comes round
once more before the deck ends.

**Once more, and not again after that.** A card put back every time it was
missed made a run that could not be finished: each wrong answer lengthened the
queue the progress bar was measuring against, so the bar crept towards a total
that kept moving, and a deck somebody was struggling with had no end but the
way back to the decks. The second look is worth having and a third in the same
sitting is not — by then the card is in box nought, which means it opens the
next run of its own deck and is sitting in **Words you missed** meanwhile.

**Or throw the card, from either face.** Right for *Knew it*, left for *Show me
again* — the same two answers, given with the thumb that is already on the
card. The card follows the finger, tilts as it goes, and says in words which
answer it is heading for, because a tint on its own says nothing to somebody
who cannot see this one (design rule 10). A quarter of the card's width is far
enough to mean it; anything shorter springs back and means nothing.

**The front answers too, and that is the one way a throw differs from the
buttons.** A word you know on sight is answered before the card is turned over,
and one you do not know is a *Show me again* before the back could add
anything: throw it left, it goes to the end of the run, and it is turned over
when it comes round. It did not use to. A throw on the front did nothing, on
the reasoning that the front has nothing to answer, and what that cost was a
tap on every card before it could be got wrong.

**The buttons stay, and they stay behind the turn.** A gesture nobody discovers
would otherwise be the only way to use the page, and there is no way to hint
at one without a tutorial — so the swipe is a second way to say the same thing
rather than a replacement, and the two words under the card are what a
first-time reader presses. They are drawn only once the card is turned, because
a *Knew it* under a word whose meaning nobody has seen invites a press that
cannot mean anything; a throw is a decision already made, and it takes a
quarter of the card to mean it. Both report the same event with one parameter
saying which was used and another saying which face the card was answered
from, which is how anybody will ever find out whether either was worth
building.

Two rules keep it out of the way of everything else. A gesture that starts
**down the page** belongs to the page, and `touch-action: pan-y` hands the
browser the vertical half so a phone still scrolls. And **any drag suppresses
the tap that would otherwise follow it**, so a scroll that began on the card
does not turn it over on the way past — the rule the map's sheet has had since
it could be dragged.

**Or the arrow keys, which are the throw on a machine with no thumb on it.**
Right for *Knew it*, left for *Show me again* — the same two answers in the
same two directions the card would have gone under a finger, so somebody who
has turned these over on a phone already knows which way is which on a laptop.
They answer on either face, because the swipe does. Turning the card over
needs nothing of its own: the focus is already on the card after every answer
— the paragraph below is why — and a `<button>` with the focus on it is turned
over by Enter or by the space bar without a line of script.

The listener is on the document rather than on the card, so a run answers
wherever the focus is actually sitting: on *All the decks*, on *Show me
again*, or on nothing at all after a press somewhere idle. An arrow carrying
Alt, Control, Command or Shift is left alone — Alt and the left arrow is the
browser's Back, and Command and the left arrow is Back on a Mac — and so is
one pressed in a field, where it is the caret moving rather than an answer,
and one pressed behind an open language menu. And it answers only where a card
is really on screen: the run outlives the editor and the gate, so a word is
still in hand on both, and answering it from a page that is showing a form
would spend a card of a deck on a view that is not the deck.

**And the keyboard keeps the card.** Every press in a run rebuilds the page's
one element, so whatever had the focus is gone and the browser drops it on the
body: turning a card by keyboard meant tabbing in from the top of the document
again, once per card, for the length of the deck. The focus goes to the new
card instead, which is a `<button>` and so announces itself and its word to a
screen reader on the way in. The card carried an `aria-live` for that job and
it was on a node being replaced wholesale rather than updated, which is the one
arrangement a live region does not reliably announce — and where it does work
it says what taking the focus is about to say, twice. At the end of a run there
is no card and the focus lands on `<main>`, which is where the skip link lands.
A thumb and a mouse see none of it: focus moved by a script after a pointer
press draws no ring.

### How the run is going, which is not how far through it is

Over the card, two tallies: **Still learning** on the left and **Know** on the
right, of the cards this run has answered. Under the card, unchanged, the bar
and **4 / 18**.

They are two different questions and the page had only ever answered one of
them. *How far through am I* is a fact about the queue, and it is the one the
bar was already drawing; *how is this going* is the one somebody is actually
keeping score of halfway down a deck, and it is the one that makes them finish
it. A deck of twenty words with seventeen in the right-hand tally is a reason
to turn the eighteenth over. The same deck saying "18 / 20" is a chore with two
left in it.

**They count cards, not answers.** A card got wrong goes into the left tally,
comes round once more at the end of the run — **How a run works** above — and
on a *Knew it* the second time it moves across rather than standing in both.
`said` on the run is what remembers which side each card is on; the two of them
always add up to the cards answered, which is what makes them worth putting at
the two ends of one row.

Both start at nought and neither is written down anywhere. A run is a sitting,
the tallies are about that sitting, and what is kept afterwards is the box each
card moved to — **The spacing** above, and the count in the next section, which
is the number that survives the tab being closed.

**Their own row, above the card.** The bar's own row was the obvious place and
it does not fit: three numbers on one line at 390 px is two too many, and the
one that would have had to go is the one saying how much is left. Neither side
is pressable and neither is drawn to look it — no pill, no border, no fill:
the figure is in the display face the score at the end of a run is in, and the
word beside it is the mono every label on this site wears. Which side is which
is said in words rather than in colour, the way the throw's own verdict is —
design rule 10 — and the two differ by weight: what is known is in the ink and
what is still being learnt is in the muted tone, which is the direction the
count is meant to travel in.

### The hint

**Give me a hint** stands under the card while the front is up, and pressing it
puts the first letters of the meaning on the card, under the Estonian. It is
for the word on the tip of your tongue: without it the only way to find out is
to turn the card over, and turning it over is the thing you were trying not to
do.

**Two letters, or three where the word is long enough that two say nothing** —
*Goodbye* hints `Goo…`, *Hello* hints `He…`. In whichever of the three
languages the page is being read in, so the hint is in the alphabet the answer
is in: *Здравствуйте* hints `Здр…`.

Two rules past that, and both are about the backs that are a phrase rather
than a word, which is a good third of the cards:

- **Half of a word and no more**, so a short one is not given away by the thing
  that was meant to help it — *Ice* hints `I…`, and the two one-letter backs in
  the decks (both Russian prepositions) hint nothing and draw no button at all.
  It applies to a word standing on its own and not to a phrase, because the
  rest of a phrase is still covered: *How are you?* hints `Ho…`, where halving
  the first word would have hinted `H…` and said nothing anybody could use.
- **A phrase that opens with a very short word carries it along whole**: *to
  bring* hints `to br…` rather than `to…`. The little word is not the lesson,
  and spending the hint on it is the same as not offering one.

`hintOf()` in `assets/flashcard.js` is the whole of it, and it reads the card
that is already in the browser — a hint costs no request and there is nothing
about it on the server.

**One hint, and then the button is gone.** A second press would be a way of
turning the card over without admitting to it. It belongs to the turn rather
than to the card: answering clears it, and a card that comes round again at the
end of a run arrives unhinted.

**Under the card and not on it**, which is where the picture this came from put
it. The card is itself a `<button>` — that is how the thumb, the keyboard and
the screen reader all get one target, and it is why the whole card turns over
rather than a word on it — so nothing pressable can stand inside it. It goes in
the row that the two answers take over the moment the card is turned, which
leaves that row asking one thing at a time whichever face is up. The letters
themselves go on the card, in the muted body face the sentence under an answer
is in, because what changed when the button was pressed is the card: a hint
standing under it would leave the card looking untouched.

**And the answer afterwards is still both answers.** A *Knew it* that needed a
hint is not quite a *Knew it*, and the strict-looking thing would be to take
that press away. The spacing here is built on one boolean — did you know it —
and a page that decides that on somebody's behalf is a page arguing with them
about their own memory, so nothing about the boxes changes. What does happen is
that the event carries `hint`, beside the `how` and `face` it already carried,
which is how anybody will find out in a month whether people hint and then
know. If they do not, greying the *Knew it* is a two-line change made on
evidence rather than on a guess.

### The deck of what you got wrong

**Words you missed** sits at the top of the decks page whenever it is not
empty: every card you have pressed *Show me again* on, from every deck, in one
place. It is the thing people actually want after a run, and until it existed
the answer to "show me the ones I got wrong" was to go back through the deck
they came from and hope. **The deck of what you know**, below, is its
opposite number and stands under it.

**It is a query, not a table.** There is no row in `flashcard_decks` for it and
there never will be. A card you get wrong goes into **box nought** — a rung
below the first, which is exactly what a missed card is — and the deck is every
row of yours sitting there. A second table holding the same cards under another
name would be two places for one card to be, and two places to keep in step.

That is also why *Show me again* no longer deletes the row. It used to, back
when a row existing was the whole of what the table said; deleting threw away
the one fact somebody wanted afterwards.

**A card in it knows which deck it is really from**, and answering it writes to
that row. Nothing is ever stored under the id `missed` — `tools/validate.mjs`
refuses a shipped deck that claims the name, so the two namespaces cannot meet.

Getting it right takes it out, because it is in box one now. **Forget what I
know** on that deck takes the nought off every card in it at once, which is the
only write on this site that reaches rows across several decks — it is bounded
by being one person's own, and it is the same sentence *Forget what I know*
means everywhere else.

A missed card is also still due in the deck it came from. Getting a word wrong
should not quietly take it out of the deck it belongs to — **and the deck's own
row says so**, which it did not for a while. A card in box nought was being
left out of both numbers on that row, so a deck with three cards you had got
wrong read "9 / 22" and claimed nothing was waiting, and then opening it ran
those three. The run was the half that was right. Box nought is exactly "not
known, and due", and the row prints both halves of that now.

### The deck of what you know

**Words you know** stands under *Words you missed*, whenever there is
anything in it: every card you have got right at least once, from every deck,
in one place — with the ones whose wait has come round in front. It is the
spacing's own queue. A deck's row says "6 due" and opening the deck runs those
six; this row says how many are due across *all* of them, and opening it runs
the lot in one sitting, the card that has waited longest first. That is what
a spaced repetition system is for, and until this deck existed the only way to
do a day's revision was to open forty-two decks one after another and read
the number on each.

**It is the same query as the missed deck with the other half of the rows.**
Box nought is what you got wrong; box one and up is what you know; both decks
are assembled per request out of `flashcard_known` by `gathered()` in
`functions/api/flashcard.js`, and neither has a row in `flashcard_decks` or
ever will. Nothing is stored under the id `review` — `tools/validate.mjs`
reserves it beside `missed` — and every card in it carries the deck it is
really from, so answering it here writes to that row, moves that card up a
box or down to nought, and takes it out of this run and back into its own
deck's exactly as if it had been answered there.

**The run is what is due, and the deck is everything.** Opening it builds a
run of the cards whose wait has come round, which is the same rule every deck
is opened under; the rest are in the deck so that *Go through it anyway* has
the whole of what you know to go through. That is the on-demand half of what
was asked for — sit and check every word you have learnt — and it is
deliberately the same *anyway* every other deck offers rather than a mode of
its own. **The spacing** below says what the page does when you do not ask,
and this deck is that sentence applied across the decks rather than a way
round it: nothing is bumped up a box a day after it was learnt unless you
asked for the whole deck and pressed *Knew it* on it, and that has been true of
every deck since the boxes existed.

**The row reads the way every other row reads.** Its size is every card you
know, its due count is the ones waiting, so it says "6 due" while there is
something to do and "40 / 40" when there is not — and it is left out entirely
until you know a card at all, for the reason the missed row is left out at
nought. The two lifted rows keep the route's order, missed first, rather than
going through `standing()`: a list of two that swapped itself over on any
morning something was due would not be worth reading.

**No *Forget what I know* on it.** The button forgets a deck's rows, and this
deck's rows are every row you have. Forgetting the whole of a language's
progress from under the run you just finished is not a thing to offer, so the
page does not draw it here and the route answers the id with a 404 rather
than deleting nothing under a name and reporting that it did. A card is
forgotten in the deck it came from. The missed deck's *Forget* is still the
only write that reaches rows across several decks.

**Capped at two hundred, and the due ones are never the part cut off.**
`MAX_CARDS` bounds this the way it bounds the missed deck, and eight hundred
known cards is a reader who has been through everything the site ships. The
due ones are put in front before the cut, so what the cap costs a reader that
far along is the tail of their *anyway*, never their morning's revision.

### The spacing

A card answered right goes up a box and waits: **a day, then three, then a
week, then a fortnight, then five weeks, then eleven.** Six rungs, and a card
that reaches the last stays there — a little over four months between askings,
past which the thing being remembered is not the word, it is the site.

A card answered wrong does not go down a box. It goes to box nought, due now,
so it is back in the next run from the beginning and in **The deck of what you
got wrong** above.

**Leitner's scheme rather than SM-2**, and the reason is what this page asks. A
scheduler cannot be cleverer than what it is told, and it is told one thing:
did you know it. SM-2 wants a grade out of five to move an ease factor, and
five grades from a page with two buttons would be four of them invented.

The intervals are `BOXES` in `functions/api/flashcard.js`, which is the copy
that binds, and the columns are `box` and `due_at` on `flashcard_known`.
Nothing on the page computes a date: it is told per card whether that card is
due, which is one boolean rather than a clock in a browser that may be in
another country.

**Days rather than a time of day**, measured from when you answered. A card
learnt at eleven at night comes back at eleven the next night, not at midnight
in Tallinn — nobody revising in the evening should find the deck empty because
the day turned over in a city they are not in.

**And the spacing is what the page does when you do not ask.** A deck with
nothing due says so and offers *Go through it anyway*; the end of a run offers
*Go through it again*. Both build a run of the whole deck. Somebody who wants
to sit and read a deck they wrote is not to be told to come back on Thursday.

On the decks page, a deck with anything waiting says **"6 due"** where it would
otherwise say "9 / 22" — one is a reason to open a deck and the other is a fact
about one. It is also what decides where that row sits: see **And a finished
deck sinks** below.

**Both presses change the card before the write goes out, and neither waits for
it.** This is pressed a hundred times in a sitting and a card that hung on the
network each time would be unusable. A write that fails is silent: what it
costs is that the card comes round again next time, which is the harmless
direction, and what a toast would cost is an interruption in the middle of the
one thing the page is for.

### How many words you know, over the whole shelf

One line on the decks page, under the sentence saying what the page is for:
**You know 134 Estonian words.** Every deck the site ships, one number, with
the figure set apart from the words around it because the figure is the thing
the eye is meant to land on.

It is the only thing on that page that is about the person rather than about
the decks. Forty-two rows each saying "9 / 22" is forty-two facts and no
score, and a score is what somebody who came back on a Tuesday wants: the
number that was 128 last week. It is deliberately not a badge, a streak or a
level — there is nothing to be out of, and a box drawn round it would make it a
mark rather than a count.

**It is the stages' own number, said out loud.** `wordsKnown()` in
`functions/api/flashcard.js` is the one that counts it and `words` on every
answer is how it arrives — see **Which decks are open** below, which is what
the count was written for and what holds it against a hundred and four
hundred. There is no second count of the same thing on this page and there
must not be: the line and the gates would disagree the first time one of them
was changed, and the disagreement would be about the sentence that says what
somebody has done. So the same rules apply to it without being restated —
shipped decks only, a card in box nought is not known, and `mark()` keeps it
in step as a run goes, so the line is right the moment you walk back out of a
deck rather than a load later.

What that leaves is a decks page that was already deciding something quietly
on this number and saying nothing about it. Somebody one word off **Getting
by** was told how far off they were; somebody who had passed it long ago was
told nothing at all, on a page whose whole promise is that answering these
cards adds up to something.

**Signed out there is no line at all**, and none while the count is nought: a
nought there would be the page telling a stranger they have failed at something
they have not started. It appears on the load after the first card is known.
With the database off it is not drawn either — a count of what is remembered is
a promise a deployment that is remembering nothing should not make, and the
line above it has already said so.

### A deck's row

Forty-two decks and the two that are not decks, as rows, is most of what
this page is. A row is four things: the deck's name in the display face, the
line under it saying what is in the deck, what is waiting in it, and the
chevron that says it opens.

**The line under the name is a sentence, so it is set like one.** *The words a
day in Tallinn opens and closes with.* That is prose, and prose on this site is
Literata — the second of the design rules. It arrived mono at eleven points,
because the row was copied from the account page's doors, where the same line
reads *everybody's lists, most opened first* and is a label rather than a
sentence. Forty-two of them in a column, a clause each, is where the
difference tells: mono says *this is a fact or a control*, and a page that says
that forty-two times reads as a table of settings rather than as a shelf of
decks. `assets/blog.css` had already made this argument for a post's standfirst
and given it a class of its own, so this is that class again — `.flash-why` —
and a deck nobody wrote a line for still prints its size in the mono, because a
size is a label.

**The count stands in a column against the chevron**, in the mono every other
count on this site is in, with tabular figures. It had been standing wherever
the row left it: nothing in the row took the free space, so the count and the
chevron shared it between their two auto margins, and the number landed further
left the longer the line under the name happened to be — a different place on
every row. It is the one thing here anybody scans, *which deck has something
waiting for me*, and forty-two numbers that do not line up cannot be scanned
at all. What fixed it is one line in `assets/styles.css`: `.menu-say` takes the
room, so everything after it stands at the end of the row. The account page's
folds had already hit the same bug and answered it where they stand, and this
is the same answer one level up, where the row is defined.

### Three levels

Forty-two decks is far too many for one column, and they are not all for the
same person on the same day. So the decks page groups them under three quiet
headings — **First words**, **Getting by**, **Going deeper** — and a deck
carries which one it is in as `level` in `data/decks.json`: `start`, `more` or
`deep`.

*First words* is the first words, the pronouns with *olema*, the question
words, the numbers, the table and the food: what somebody needs in their first
week. *Getting by* is the colours a shop word is half made of, the parts of you
the doctor asks about, the word over a shop door, the shop and its prices, what
you wear, what is in a kitchen, who is who in a family, the weather, the verbs
the rest of the language hangs off, where somebody is from, the language course
they are sitting in, the flat, what day it is, who does what for a living, the
street, how you are feeling, long and short and a size down, the coffee shop,
the small talk, how often you do a thing, and deciding what to do with a free
day. *Going deeper* is the thirteen that are not about a good day out — what
somebody looks like and what they are like, the holidays a year in Estonia is
cut into, a recipe, the words on a page of writing, the country past the old
town, the doctor, the paperwork, the cleaner's with your jacket in it, the
other side of the counter, for somebody whose shift it is — the customer's
half of a café and a restaurant is in the two decks above, and this is what the
person serving them says, in a café, a restaurant, a bar or a shop, so that one
deck covers a job — what *pean* and *tahan* do to the verb after them, the
second handful of verbs, and the adverbs that belong to no lesson.

**Inside a stage the file's order is easy to hard**, and that order is a
judgement about Estonian rather than about code: a deck of eighteen colours
before a deck of sixty sentences of small talk, concrete nouns before the
function words that hold a sentence together, one word a card before a phrase
a card, and the two big decks of verbs and adverbs — a hundred and forty cards
that belong to no lesson — last of all. It is the order a signed-out visitor
meets the decks in and the order a signed-in one meets the ones they have not
started in, so it is worth getting roughly right and not worth arguing about
to the last row. Somebody who knows the language better than the person who
sorted them is welcome to move a deck; nothing but the file's order changes.

The headings are `.lists-section`, the same quiet heading `/lists` puts over a
run of rows, and a level with nothing in it draws no heading: the headings are
for the decks rather than the other way round. `tools/validate.mjs` fails a
deck whose level is not one of the three, because a deck under no heading is a
deck nobody scrolls to.

The room around them is `assets/flashcard.css`'s rather than that heading's
own, and what decides it is what stands under it. On `/lists` a heading of this
kind sits over a strip of cards, which brings its own air; here it sits over
hairline-ruled rows, and with the six pixels the directory gives it the heading
had the rule closing the run above and the rule opening the run below the same
short distance away on either side. A title with equal air above and below two
hairlines does not read as a title. It reads as an empty row. So the room goes
above it, which is what says which side of the rule the heading is on.

### And a finished deck sinks

Under each of those three headings the rows used to go in the file's order, and
the file's order is the order somebody meets the decks in rather than the order
they are any use in. Forty-two of them is a great many to leave fixed for
ever: a deck you had been all the way through sat exactly where it always had,
above every deck still waiting, for as long as the account lasted. What the
page is for is picking up where you left off, and the top of the list was the
last place to look for it.

So the rows go in the order of what each deck is asking for. Three rungs, and
`standing()` in `assets/flashcard.js` is the whole of it:

| | |
|---|---|
| **waiting, and started** | cards are due and some have been got right — this is picking up where you left off |
| **not started** | nothing answered in it yet, so it is the new thing rather than the unfinished one |
| **resting** | everything known, and none of it come round again yet |

**Nothing is pressed and nothing is stored.** The two numbers this turns on are
already on every row the route answers — `due` and `known`, which are what draw
"6 due" against "22 / 22" on the end of it — so this is a sort over what the
page is already holding, and it costs no column, no write, no string in ten
languages and nothing to run by hand against either database.

**And a press would have been the wrong thing anyway**, which is worth saying
because it is what was asked for first. A deck is never finished here, only
resting: **The spacing** above brings its cards back after a day, then three,
then a week, then a fortnight, then five weeks, then eleven. A deck put at the
bottom by hand would still be at the bottom on the morning it came round again
— which is the one morning this page exists for. Sinking by what is due rises
again on its own, on the day it should.

**Sorted and not filtered.** Nothing is hidden, nothing is collapsed, and no
row goes away: a resting deck is still a row, still opens, and still offers *Go
through it anyway*, because somebody who wants to sit and read a deck is not to
be told the spacing has nothing for them today. There is no fourth heading
either — the three say where you are, and a *Finished* group at the foot would
put a beginner's deck next to an advanced one. The one row that does not open
is a deck in a stage not reached yet — **Which decks are open** below — and it
is still a row, with its name, its line and its size on it.

The sort is **stable**, so inside a rung the order is the one it arrived in:
the file's for the decks the site ships, most-recently-edited-first for the
ones somebody wrote — which is `ORDER BY updated_at DESC` in
`functions/api/flashcard.js` and is still what decides between two decks of
yours in the same state.

**An empty deck of your own is *not started* rather than *resting*.** It has
nothing to rest, and it is the deck somebody made a minute ago and has not put
a word in yet; reading it as finished would file the one deck they are about to
open under everything else.

**Signed out, and with the database off, nothing moves.** The sort is skipped
outright, under the same condition `deckRow()` draws its count under: with
nobody to have progress, every row says how many cards it holds rather than
what is waiting, and a list reordered by a number the rows are not printing is
a list somebody would read as shuffled. It would be a no-op in any case —
`knownOf()` answers an empty map for a visitor, so every card comes back due
and every deck is *not started* — which is exactly what the first visit of a
new account looks like too. Nothing has rearranged itself before anybody has
answered a card.

### Which decks are open

Forty-two decks is too many to be handed at once, and they are not all for the
same person on the same day: the section above groups them so that a
beginner can find the seven that are theirs, and this one holds the other
thirty-five back until they are. The three levels are **stages** now. *First
words* is always open. *Getting by* opens when you know **a hundred words**,
and *Going deeper* when you know **four hundred**, and what is counted is the
number the rows already print — every shipped card you have said *Knew it* to
and not since got wrong, added up across every deck.

**What the others do, and which of it this takes.** The flashcard systems
that pace somebody do it one of three ways. Duolingo's is a path: each unit
is locked until the one before it is finished, and a test lets you jump. Drops
is the same shape per topic. Memrise's is levels: a course is cut into them
and every level is open, so the path is a suggestion. WaniKani's is the one
this page borrows — the next level opens when enough of the last one has
reached a stage of the spacing, its *Guru*, which is a count of what you
**know** rather than of what you have seen — and it borrows Memrise's shape
around it: a stage, once open, is a shelf you pick from rather than a line
you walk. Anki, Quizlet, Clozemaster and LingQ lock nothing, and that was the
arrangement here until now; what it cost was a page of forty-two rows with
nothing on it to say where to start.

A stage rather than a deck, because a deck is already paced from inside — the
spacing brings it back, the sort under **And a finished deck sinks** puts the
one you are in the middle of at the top — and a lock on each deck would have
been Duolingo's path laid over that, with the two fighting over which deck is
next. Three numbers rather than forty-two, and the level a deck already
carries in `data/decks.json` is which of the three it is held to.

**A hundred and four hundred**, and why. A hundred is a third of *First
words*, reachable in three or four sittings, so the second stage opens the
same week rather than as a promise about next month; it is also more than the
first two decks hold, so it cannot be had off greetings alone. Four hundred is
all of *First words* and a hundred and twenty of *Getting by* — a third of
what stands below *Going deeper* — which is where somebody has stopped being a
visitor to the language. Both are lenient beside WaniKani's ninety per cent
and Duolingo's every unit, on purpose: this is a hobby site and not a course,
and a gate that is felt as a wall is a gate people leave by. `GATES` in
`functions/api/flashcard.js` is the pair, and it is the only copy — the route
answers `words` and `gates` with every request and the page prints them,
so there is nothing to keep in step.

**What it looks like.** A stage not reached keeps its heading and its rows:
every deck's name, the line under it and how many cards it holds, readable and
in their order, so that what is ahead is visible and the count has something
to be counted towards. Under the heading, once and in the mono, *Opens at 100
words — 62 to go.* What a row loses is the link and the chevron, since nothing
about it opens. A deck in that stage reached by its address — a link somebody
sent, a search result, the back button — draws its head, with *All the decks*
on it as every deck's head has, and a card in place of the first word saying
what the stage opens at and how far off it is. And the end of a run that
crossed a gate says so in one line under the score, *Getting by is open now*,
because the run is where it happened; the decks page is the way in, as it
always was, and there is no button.

**What is never held.** Signed out, nothing: there is no count for somebody
the site has never met, and the one-word gate under **Signed out, one word of
a deck** already stands in front of every deck, so a visitor's first sight of
the page is what it was. With the database off, nothing, under the same
condition the rows draw their counts under. A deck you wrote, and the deck of
what you got wrong, which are in no stage. And **a deck with a card already
known in it**, whatever its stage says: the stages arrived after the decks
did, and somebody halfway through *Going deeper* on the day this landed is not
to find it shut behind them. That last rule is also what makes the lock a
door rather than a wall — anybody who was in before stays in — and it is the
reason a stage can be told apart from a deck at all, since a stage is held
and a started deck in it is not.

**And a deck of your own does not count**, whichever box its cards are in.
Twenty decks of ten typed words each, every one pressed *Knew it*, would be
two hundred words and *Getting by* open; the count is of the Estonian the
site ships, which is the thing the stages are about. `wordsKnown()` in the
route sums over `data/decks.json` rather than over the table for exactly this.

**What it does not do.** No test to jump a stage, which is the half of
Duolingo's arrangement deliberately left out: four hundred words known is the
test. No lock on the route — a request for a deck in a stage not reached is
answered, since the page has to draw the card that says so, and the words are
written into the markup for a crawler in any case; the lock is a page rule
about what opens, not a rule about who may read a file anybody may read. And
no per-deck numbers, for the reason two paragraphs up.

### Three forms, where a word has three

A dictionary gives an Estonian noun as three: *leib, leiva, leiba* — the
nominative, the genitive and the partitive. The last two are where the stem
actually shows itself, and somebody who has learnt only the first cannot say
*two coffees* or *without bread*. So the back of a card carries all three,
quietly, in mono under what the word means.

The front stays one word. What is being asked is still what it means, and a
card that opened with three forms would be asking somebody to read a paradigm
before they had read a word.

`forms` is an optional pair on a card in `data/decks.json` — the two forms a
dictionary prints after the first, with `front` being the first. For a noun
that is the genitive and the partitive; for a verb it is the *da*-infinitive
and the first person singular, so **minema, minna, lähen**, which is the same
three a dictionary gives and the same job they do. It is optional
because most of two decks are phrases: *Kas see laud on vaba?* has no principal
parts, and a row of three under it would be nonsense. **1,290 of the 1,960
cards carry them** today; the ones that do not are the phrases, the adverbs, the
garments that are plural in Estonian — *teksad* has no singular anybody wears —
and a handful of words left alone rather than guessed at. `tools/validate.mjs`
fails on a `forms` that is not exactly two non-empty strings, because a row of
two drawn where three belong would be silently wrong rather than visibly
missing.

They are in the indexed text too, and worth more there than on the card:
somebody typing *leiba* into a search engine is looking at a menu, and the
nominative they would need to find this page is the one thing they have not
got.

**These are mine and not a native speaker's**, like the rest of the Estonian
here. They are the forms of common words and I am confident in them; they have
not been checked by anybody who grew up with the language.

**One batch of words is a course book's, and that is worth saying.** Three
hundred and sixty-seven of the cards — the pronouns and *olema*, the question
words, the countries and what you call somebody from one, the language course,
and the everyday adverbs and nouns the first lessons of a beginner's course
teach alongside them, and then the next four lessons' worth: the clock and the
timetable, the seasons and the garden, the colours, a family down to its
in-laws, and forty more verbs — came off the word lists printed at the back of
one, headword, principal parts and gloss together. So for those the Estonian
and the Russian are a published book's rather than mine, which is the one part
of this deck that has been through an editor. The sentences under them and the
Azerbaijani beside them are still mine, and those are where the mistakes will
be.

**The verbs are written the way this deck already wrote them**, though, and not
the way that book prints them. Its list gives every verb as *seisma, seista,
seisab* — the third person — and the twenty-two in **Verbs you will need** were
written as *olema, olla, olen* long before it arrived. A learner meeting
*seisan* on one card and *seisab* on the next is reading two patterns where
there is one, so the book's third person became a first. The five that no
person does — *algama*, *lõppema*, *paistma*, *sadama*, *sulama* — keep it,
because *ma sajan* is not a thing anybody says.

### And the word in a sentence

Under the forms, where a card has one: the Estonian and what it means, as two
lines. A word on its own is a thing to recognise and a word in a sentence is a
thing to say — and the case it is standing in there is half of what the three
forms above it are for. *Leib, leiva, leiba* is a paradigm; **Ma tahan musta
leiba** is why the third one matters.

It is the last thing on the card and the quietest, because somebody who has
already remembered the word is done before they reach it.

`sentence` is an optional `{ et, en, az, ru }` on a card — the Estonian, and
what it means in each of the three the decks are written in — and the validator
wants the Estonian and the English or neither, since half of one drawn on a card
would be a stray clause with no translation. **772 of the 1,960 cards** carry
one: every card in the twenty-three newer decks and in **Family and relatives**
bar the ones that are a whole sentence already, and the ones in the older decks
where an example says something the gloss does not. The words the course
glossary brought in have none, and that is the one thing left undone about
them — a glossary gives a word its principal parts and not a sentence to stand
in, and nine hundred sentences guessed at in one sitting would be nine hundred
sentences nobody checked. They are cards without an example rather than cards
with a bad one, and the next pass over a deck is where the examples go in.

They are in the indexed text too, and they are the most searchable thing on the
page: a whole Estonian sentence with its English under it is what somebody is
actually holding when they look a word up. That copy is the English one and only
the English one — what a word is looked up *with* is the word, and the Estonian
of the sentence is already on the page beside it, so writing all three would put
the same sentence into the page three times.

### This card is wrong

Under the two answers, on a turned-over card in a deck the site ships, one
quiet press: **Something is wrong here**. It reports the card and says
*Reported. Thank you* where it stood. Nothing else happens, the run carries on,
and the next card is up.

It is here because of the two paragraphs above it. The Estonian on this site is
mine, the one thousand three hundred and thirteen headwords out of a course
book aside: the forms are the forms of common words and I am confident in
them, the sentences are sentences I would say, and none of it has been read by
anybody who grew up with the language. One thousand nine hundred and sixty
cards written that way have mistakes in them, and the people turning them over
are the only proofreaders this deck has ever had.

**One press, and nothing to type.** No box for a reason, no three buttons
asking whether it is the meaning, the forms or the sentence. What a reader can
tell me reliably is that something on this card is wrong; which part of it is
wrong is mine to look at, and the row already carries the thing that halves the
search — **which language the back was being read in**, since a card's back is
written in three and a wrong Russian one is a different fix from a wrong
English one.

**It needs no account**, which makes it the one write on this page that does
not — every other one, the two that only say a card was known included, takes a
session. A mistake you have to make an account to report is a mistake nobody
reports, and the line sits under the two answers on a turned card, so the one
word somebody gets signed out is enough to reach it. That is deliberate rather
than incidental: the Estonian here is mine and the people turning the cards
over are the only proofreaders it has, so the report is on the free side of the
gate and always will be. It is filed under the same hashed network fingerprint the saves and
the feedback are capped by, in the primary key rather than beside it, so one
person pressing one card twice is one row and the count is how many *people*
said so. Two readers behind one network with the same phone count as one, which
is the safe direction to be wrong in.

**And it is never a number on the card.** No route answers with the count, no
page draws it, and there will not be a "reported by 4" under a word: that would
tell somebody learning Estonian to distrust a card that is very often perfectly
right. The only reader of the table is me, and the query is one:

```sql
SELECT deck_id, card_id, lang, COUNT(*) AS n FROM flashcard_reports
GROUP BY deck_id, card_id, lang ORDER BY n DESC;
```

More than a couple against one card is a card to go and look at. One is usually
somebody who pressed the wrong thing, which is exactly why there is nothing to
take back: a misclick costs me a glance, and an undo would be a second control
under the two answers for the sake of it.

**A card that has been fixed has its rows cleared**, in the deploy that fixes
it or soon after — otherwise the next look sees a card that has already been
dealt with, and the people who reported it cannot report it again, since the
fingerprint is in the primary key and a second press is a no-op whether the
card has changed or not. Clearing them is part of fixing the card rather than
tidying up after it.

It is a **terminal** line and not a session's, and that is the write gate
working rather than an inconvenience: the rows are picked out by two thirds of
a primary key, which is a `WHERE` whose size is not in the statement, and
`.claude/hooks/d1-write-gate.mjs` refuses those outright rather than prompting.
So it goes where every write whose count nobody can state goes:

```
wrangler d1 execute tallinntastebuds-preview --remote \
  --command "DELETE FROM flashcard_reports WHERE deck_id = 'table' AND card_id = 'arve'"
wrangler d1 execute tallinntastebuds         --remote \
  --command "DELETE FROM flashcard_reports WHERE deck_id = 'table' AND card_id = 'arve'"
```

**Only the decks the site ships.** A deck you wrote has an editor with a
**Remove** on every row, so reporting your own words to me would be a loop, and
the route refuses a minted deck id outright. The missed deck draws no line
either — its cards are all reportable in the decks they came from.

Three states and that is all of them: the press, *Reported. Thank you*, and —
where the write did not land, because the table is not there yet or because
twenty cards have been reported from this network in the last hour — the line
comes back and a toast says why. It is the one press on this page that waits
for its write: *Knew it* and *Show me again* are pressed a hundred times in a
sitting and are silent when they fail, and this is pressed once, deliberately,
by somebody who should not be told it landed when it did not.

**Nothing on the page remembers across a reload.** *Reported. Thank you* lasts
as long as the tab does, and the next visit offers the line again. Keeping it
in `localStorage` was the obvious other answer and it is the wrong one twice
over: it would go on saying *Reported* about a card long after the card had
been fixed, and it would be a third thing this page stores to say something the
table already knows. The second press is a no-op, which costs nobody anything.

### The decks people write

Signed in, **Words you collected**: name a deck, and it opens on the form that
adds the first card, because a deck with nothing in it has nothing to turn
over. Estonian on the front, what it means on the back — in whatever language
that is; a deck you write has one side in one language and nothing to pick — and
a row per card with **Edit** and **Remove** beside it. Edit opens the same two
fields the form at the foot adds a card with, filled in, so a typo is fixed the
way it was made rather than by removing the card and typing it again at the
bottom of the list — the card keeps its place in the editor and whatever has
already been learnt off it, because only the two fields change, not
`created_at` and not a box in `flashcard_known`.

**A run of your own deck is shuffled once, not typed-in order.** The editor
above always lists a deck's cards in the order they were added — that is
`cardsOf()`'s own `ORDER BY created_at` in `functions/api/flashcard.js`, and it
is what makes the list something you can find your way around a minute after
writing it. Turning the cards over is a different question: the newest word
always landing last would mean the word you had just added was always the one
tested least, for as long as the deck lasted. So `startRun()` in
`assets/flashcard.js` sorts a deck of your own by card id before building the
run — ids are minted at random and never change, editing a card's words
included, so this shuffles the order exactly once, the first time there is
more than one card to shuffle, and the same order comes back on every run
after. A deck the site ships keeps the order the file gives it instead: that
order is a progression somebody wrote on purpose, easy words before hard
ones, and shuffling it would undo the one thing about it worth keeping.

**A deck somebody wrote has exactly one reader, and it is its owner.** There is
no sharing here, no public deck, and no link that buys anything — which is the
one place this feature deliberately differs from lists and from splitwise,
where holding the code *is* the permission. Every read of a deck out of the
database goes through `deckOf()`, which takes the session's own id, and a deck
belonging to somebody else answers exactly the way a deck that does not exist
answers.

Deleting a deck takes its cards and everything anybody had learnt off it. There
is no archive and no undo: what it deletes is a list of words somebody typed,
and keeping a copy of it against their wishes would be the site deciding it
knew better.

### Who may do what

| | who |
|---|---|
| read the decks page, whole | anybody at all, signed in or not |
| turn over the first card of a deck the site ships | anybody at all, signed in or not — one word to a tab, and then **Signed out, one word of a deck** above |
| turn over the rest of it | any account |
| say one of its cards is wrong | anybody at all, signed in or not — once per card per network, and the one word is enough to reach the line that does it |
| have any of it remembered | any account, and it is the only thing an account is for here |
| write a deck | any account |
| read one, add to it, edit a card in it, rename it, delete it | its owner, and nobody else |
| start a deck again | any account, on any deck — its own rows and nobody else's |

### The caps

| | | why |
|---|---|---|
| `MAX_DECKS` | 20 | decks of your own, per account |
| `MAX_CARDS` | 200 | per deck — more than three times the longest deck the site ships, which is the coffee shop at sixty-one. Past it the thing being asked for is a vocabulary manager |
| `MAX_NAME` | 60 | a deck's name |
| `MAX_SIDE` | 60 | either side of a card. "Kas ma saan maksta kaardiga?" is thirty-one; a paragraph on a flashcard is a note, and notes want a different feature |
| `REPORTS_PER_HOUR` | 20 | cards one network fingerprint may report wrong in an hour. Far more than anybody turning cards over finds wrong in a sitting, and far less than a script would want |

They are in `functions/api/flashcard.js`, which is the copy that binds.
`MAX_NAME` and `MAX_SIDE` are restated in `assets/flashcard.js` so a field
stops somebody at the keystroke rather than at the round trip — change one,
change the other.

### Turning it on

Two things, and neither is automatic:

1. **Apply the schema to both databases.** `db/schema.sql` is re-runnable and
   nothing in CI applies it:

   ```
   wrangler d1 execute tallinntastebuds-preview --remote --file=db/schema.sql
   wrangler d1 execute tallinntastebuds         --remote --file=db/schema.sql
   ```

   Until it is run, the decks still turn over — they are a file — and every
   write answers `no such table`, which the page shows as the quiet line under
   the title saying nothing is being remembered. That is a better failure than
   splitwise's, which has nothing at all to show without its tables, and it is
   still a failure: preview first, production the moment the change lands.

   **A database that already had `flashcard_known` needs the two spacing
   columns put on by hand.** `IF NOT EXISTS` cannot add a column to a table
   that already exists, so re-running the file above does not do it:

   ```
   ALTER TABLE flashcard_known ADD COLUMN box    INTEGER NOT NULL DEFAULT 1;
   ALTER TABLE flashcard_known ADD COLUMN due_at INTEGER NOT NULL DEFAULT 0;
   CREATE INDEX IF NOT EXISTS idx_flashcard_known_due
     ON flashcard_known (user_id, deck_id, due_at);
   ```

   Every row already in it becomes a card in box one that is due, which is
   exactly right: it was known, and it has waited long enough to be asked
   again. The route survives their absence — `readingBoxes()` asks once per
   isolate and falls back to answering everything as due — so the gap between a
   deploy and the `ALTER` is a page without spacing rather than a page that
   does not work.

2. **Add the subdomain to the Pages project.** Cloudflare dashboard → the
   `tallinntastebuds` project → **Custom domains** → add
   `flashcard.tallinntastebuds.ee`. The DNS is already Cloudflare's, so this is
   one form and a certificate that issues itself. Until it is added, everything
   works at `/flashcard` and the subdomain does not resolve.

There is no third variable and no second service. `DB` is the binding, and
`SAVE_SALT` is wanted by exactly one press: **Something is wrong here**, which
is filed under a hashed network fingerprint because it is filed under nobody
else. Without the salt that one press answers 503 and says so, the way a save
does, rather than writing a row anybody could add to for ever; everything else
here — the decks, the runs, the spacing, the decks you write — never touches
it. This section used to say the feature needed it not at all, and that was
true until there was something here to count.

**A database that already had the other three tables needs the fourth
added.** `IF NOT EXISTS` means re-running the file above is the whole of it,
and until it is run the button is there and every press answers *That did not
work* — the route catches the missing table rather than throwing a 500, which
is the same bargain `readingBoxes()` takes above.

### Taking it out

Built to be removable, the way splitwise was, because it is not yet known
whether it stays. Delete these outright:

```
flashcard.html                 the page
functions/flashcard.js         the route that serves it, with the deck's head
                               and its words written in
assets/flashcard.js            the browser half, and the third sign-in form
assets/flashcard.css           its rules
functions/api/flashcard.js     the API route, and the three tables' only writer
data/decks.json                the decks the site ships
```

Then take these back out. Each is an addition to a file that stood before it,
and each is fenced or prefixed so it can be found by looking:

| File | What is the flashcards' |
|---|---|
| `functions/_middleware.js` | the `FLASHCARDS` block of constants and the `FLASHCARDS` block inside `onRequest()` — both marked, both additions |
| `tools/validate.mjs` | the `FLASHCARDS` block after the splitwise one, and `'flashcard.html'` in the PAGE-HEAD marker list |
| `functions/_shell.js` | the `flashcard.html` line in `EMPTY`, and the route's line in the header's list. **This is the only file the flashcards changed rather than added to**, and it is one key |
| `tools/sitemap.mjs` | `DECKS`, `deckIds()`, the two `entries.push` lines and the third argument the three callers pass |
| `robots.txt` | the paragraph about the flashcards. There is no `Disallow` to put back — see **How it is found** — so removing it is removing a comment |
| `assets/account.js` | the second `door()` in `youCard()`, one of the two links to the feature on this site |
| `index.html` | `#btn-flash` on the rail, the other of the two — plain markup, so nothing in `assets/` goes with it |
| `data/ui.json` | `flashDoor` and `flashDoorWhy` with the rest |
| `tools/stamp.mjs` | `'flashcard.html'` in `PAGES` |
| `_headers` | the `/flashcard.html` and `/flashcard` rules |
| `sitemap.xml` | re-run `node tools/sitemap.mjs` once the tool is back to what it was |
| `data/ui.json` | the seventy-four `flash*` keys, in all ten languages — `grep -n '"flash' data/ui.json` is the list, and the two above are in it |
| `README.md` | this section, its line in **Contents**, its five lines in **Files**, the `data/decks.json` line under **What the validator checks**, the analytics block, and the subdomain paragraph under **The custom domain** |
| `CLAUDE.md` | the row in the process table, and the clause in the opening sentence |
| `.claude/skills/api/SKILL.md` | the `/api/flashcard` row, and the flashcards clause in the `/*` row |
| `.claude/skills/site/SKILL.md` | the `flashcard.html` in the stamped-pages list |

And in Cloudflare: remove `flashcard.tallinntastebuds.ee` from the Pages
project's **Custom domains**, and drop the four tables — `flashcard_reports`
and `flashcard_known` first, then `flashcard_cards`, `flashcard_decks` — from
both databases, along with their block in `db/schema.sql`.

**What it borrows and does not touch.** `functions/api/_lib.js` is imported
from and not edited — `json()`, `sessionUser()`, `wrongDatabase()`,
`randomHex()` and `dataFile()`, all of them things that were already there.
`assets/styles.css` and `assets/lists.css` are read by the page and unchanged.
`data/ui.json` is the one file this feature is genuinely mixed into, and the
paragraph above says why that was the right trade.

**The cost of keeping it separate, said out loud.** `assets/flashcard.js`
carries the **third** copy of the sign-in form on this site: the map's sheet,
the split page's, and this. The reason is the hostname and it is
`assets/split.js`'s reason — `?then=` is deliberately same-host, so sending
somebody from a subdomain to the map to sign in and back is either an open
redirect or a dead end. It is a copy of the *form* and not of the *API*: same
fields, same actions, same errors, same strings. But three is where that
argument stops being free, and **if a fourth ever wants one the answer is not a
fourth copy** — it is a shared global beside `assets/track.js`, `TTBAuth`,
owning the form and the three actions, with all three existing copies moved
onto it. That is a change to the sign-in on every page of this site and it was
deliberately not made in the change that brought this page.

### What it does not do

No audio, no pronunciation, no typing the answer in, no matching game, no test
mode — not even one to jump a stage with — no streaks, no decks anybody can
share, and no notifications — this site has no address for anybody, and that
has not changed for this. The spacing has
six fixed rungs and no per-card ease: see **The spacing** above for why that is
a decision rather than a first version.

**And no shuffle, and no undo**, both of which were asked for in the same
sentence the tallies and the hint arrived in. A shuffle undoes the two orders a
run is built in — what you have never got right first, and, inside that, the
progression somebody wrote the deck in — so what it would fix is a deck whose
order has been memorised, which is a rarer complaint than it sounds and one the
spacing already answers by changing what is due. An undo is the expensive one:
the answer has already gone to the database by the time anybody wants it back,
so undoing means a second write and a fourth action on `/api/flashcard`, and
the card is in box nought meanwhile, which is the harmless direction. Both are
a description away from being built if they are wanted.

**And no forms on a deck you wrote.** The three principal parts below are a
field in `data/decks.json`, which is content the repository carries; a deck
somebody types is two sides, because a third box asking for a genitive is a
grammar lesson in a form that was meant to take a word and its meaning.

**Nothing comes back from a report**, either. No reply under it, no page
listing what has been reported, no row on `/admin.html` — that page reaches
GitHub rather than the database, and a tab for this would be an authenticated
route for a query that is one line. No undo, no reason to pick from, and no
count anywhere a reader can see: **This card is wrong** above says why each of
those is a decision rather than a first pass.

It is also not on the map, and must not become so. Nothing in `data/` knows
this feature exists except the file of words it reads.

---

## Stories

The one thing on this map that is not permanent. Everything else here is a
place that will still be there next year; a story is a video — or a
photograph — that is up for **a day and a half** and then is gone, which is
the whole reason anybody opens one now rather than later.

It can be written today and go up on Saturday, and the picture in it does not
disappear when the story does — the photograph a photo story is, or the still a
video was watched from. It moves onto the place it was shot at and joins that
place's photos. So the story is the moment, and the picture stays.

When something is up, the mark in the top left grows a turning ring — the same
ring, in the site's own brick and ember, that every profile picture wears when
there is something new behind it. Press it and the video — or the photograph;
a story is either — fills the screen: a bar along the top per story, who it is
from, **how long it has left**, the caption, and a link. The left third of the screen goes back, the rest goes on,
holding stops it, swiping down leaves. The screen it fills is the one you can
see and not the one the browser says it has: Safari's toolbar stands over the
foot of an iPhone, and the caption and the link are exactly what ends up under
it. [Design notes](#design-notes) has the measurement. All of it is
[`data/stories.json`](data/stories.json) plus a file in
[`stories/`](stories/README.md), and with nothing live there is no ring, no
viewer and nothing else on the page changes.

### Post one

From a phone, [the admin page](#the-admin-page) does the whole of this: pick
the clip, pick the place, press the button. By hand it is two steps — drop the
video in `stories/`, see [stories/README.md](stories/README.md) for the size
and the one `ffmpeg` line that gets it there, and add an entry:

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
| `poster` | optional | An image filename inside `stories/`, shown for the moment before the **video** has enough of itself to play — and, with a `spot`, the picture that joins that place once the story is over. |
| `from` | one of the two | When it goes up. Leave it out and it is up the moment `live` is `true`. |
| `until` | one of the two | When it goes. Leave it out and it is **36 hours after `from`**, which is the usual way to write one. |
| `caption` | optional | A line under the video, per language, exactly like a `blurb`. |
| `spot` | optional | A place id from `restaurants.json`. The button under the video opens that place on this map. Leave it out and the story has no button and leaves no picture behind. |
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

### Whatever the browser could write

A video posted from [the admin page](#the-admin-page) arrives in whichever
container that browser could write — MP4 from Safari, WebM from Chrome and
Firefox, and untouched off the camera where there was nothing to re-encode
with. [`.github/workflows/story-media.yml`](.github/workflows/story-media.yml)
runs on every push that touches `stories/` and makes it ordinary:

```bash
node tools/storymedia.mjs         # what each story video is, and what is wrong with it
node tools/storymedia.mjs --fix   # convert the ones that are not web-ready, in place
```

It converts anything that is not already **H.264 in an MP4, inside 1080×1920,
`yuv420p`, with its index at the front and under 8 MB** — tone mapping HDR on
the way, which is the part not to skip, because without it an iPhone's colours
decode grey. Then it renames the file, moves the story entry onto the new name,
takes a poster frame if there is none, commits and asks for a deploy.

A file that is already all of those things is not touched. That is also the
loop guard: the commit this makes finds nothing to do on a second pass, and a
push made with the built-in `GITHUB_TOKEN` does not start a workflow anyway.

The same script is worth running before a hand-made file is committed — it says
what is wrong with a video in the words a person would use, and changes nothing
until it is asked to.

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
- A **video with a `spot`** sends its **poster frame** the same way. The still
  is a photograph of that place too — the frame the story opened on — and it
  is the part of a video a lightbox can keep. The entry is then switched to
  `live: false` and stops naming a poster, and the video is left exactly where
  it is: deleting somebody's film is somebody's decision, not a cron job's.
- **Anything else** — a story of nothing in particular, or a video nobody took
  a poster for — is switched off and left alone in the same way.

A picture that cannot be filed — the `spot` is not a place any more, the place
has no `photos` array — leaves the story switched on and says why. It stays in
the `OVER` list where `node tools/stories.mjs` keeps mentioning it, and the
next tick tries again once it is fixed, which is the point: a story quietly
switched off is a picture quietly not filed.

Then it commits and pushes, and the push is the deploy: Cloudflare's Git
connection sees a push from `github-actions[bot]` like any other, so the site
catches up within the minute. (The rule that a push made with the built-in
token starts nothing is about Actions workflows, not about apps listening to
the repository.) On an hour with nothing due it touches nothing and writes no
commit, which is almost every hour.

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
clock: the picture of a place ends up on that place — the photograph, or the
video's poster frame — and the video itself is switched off and left for you.
Once it has been gone for a while, delete its entry and the file together —
the repo does not need to carry every video ever posted, and the validator
says so, gently, about a file in `stories/` that no entry names.

To pull something down early, set `live` to `false`, or take the entry out
altogether. Both are immediate for anybody who loads the map after it, which
is everybody: nothing about a story is cached beyond the page it is on.

---

## The blog

`/blog` — one post per thing this site does. Why there are no scores on the
map, what a save costs, why a story is gone in a day and a half, what an
account is and is not, why Google's directory is kept apart from mine. The
reasoning already existed; it was in this file, which is written for whoever
maintains the site and is five thousand lines long, and a visitor who wondered
why the map has no ratings had nowhere to read the answer.

```
blog.html              the page, served at /blog as well
assets/blog.js         ES5, one IIFE, like every other file in assets/
assets/blog.css        only what a page of prose has and the other pages do not
data/blog.json         the posts
clips/<id>.png         the clip on a post — GENERATED, four files per post
clips/scenes/<id>.html what it is drawn from
tools/blogclips.mjs    draws every clip out of every scene
```

Nothing else. There is no endpoint, no database and no build step: the page
fetches `data/ui.json` and `data/blog.json` and draws from them, the same way
the map draws from `data/restaurants.json`.

### The two states

The index is every post, newest first, as rows — the date in mono, the title,
the line under it saying what it is about, and the chevron. It is `.menu`, the
same shape the account sheet draws a way-on in, because a list of posts is a
list of places to go and [the design rules](#the-design-rules) say those are
rows rather than a column of links.

A post is `?post=<id>` on the same address: the date, the title, the line, the
paragraphs, and one button at the foot going to whatever the post is about —
the map, `/lists`, `/split`. The way back is at the top, where a back belongs.

Walking between them is `pushState` rather than a fresh document. The posts
are already in memory, so re-fetching the page to show four paragraphs would
be a boot to draw something the browser is holding — and it would cut the
radio off mid-song for as long as that boot took. The Back button works, the
address is real, and a row is a real `<a href>`, so a middle click or a long
press opens a post in a tab of its own.

**The canonical tag moves with it.** `?post=` is a different page with
different words on it, so `assets/blog.js` rewrites `<link rel="canonical">`
on every draw — the index's own address on the index, the post's on a post. A
single canonical pointing at `/blog` would ask a crawler to treat every post
as the same page, which is the opposite of what a blog is for. Only the index
is in `sitemap.xml`; the posts are linked from it, which is how a crawler
reaches them, and it is the same argument that keeps people's own lists out
of that file.

**The head is not swapped per post**, and that is a decision rather than an
oversight. `functions/_shell.js` does exactly that for the map, a list, a
profile, the directory and a group — a Function in front of the page, writing
that page's own title and social card into the head — and it buys one thing
here: a post pasted into a chat unfurling as itself rather than as the blog. Nothing on this page is
written by a stranger and nothing on it is private, so the cost is a whole
route to maintain for a nicer preview card. If that is ever wanted,
`_shell.js` is where it starts, and the comment in the head of `blog.html`
says so.

### The clip

Every post carries one: three or four seconds of the thing it is about,
looping under the standfirst. The bookmark being pressed and the count going
up. The Bakery chip narrowing the map and the two places it left coming in
from the edge. A sentence typed into the chat and the answer arriving under
it. The swatch pressed, and a card, a pin, a price gauge and the ground all
changing at once.

**They are not recordings of the site, and they are not drawings of it
either.** A clip is rendered from a *scene* — an HTML file under
`clips/scenes/` that loads `assets/styles.css` and arranges the site's own
components into the one interaction the post is about. The card is `.card`,
the pin is `.pin-mark` wearing the collar `dressPin()` gives it, the chip is
`.chip`, the price is the same four-euro gauge, the pointer is the map's own
tour cursor, and the QR on the discount clip is drawn by `assets/qr.js` from
a real address, because a square that could not be scanned would be the one
dishonest thing in a clip about a code. What a clip cannot have is the map
itself: there are no tiles in it, and rather than pretend otherwise the scenes
stand on a few streets' worth of the hairline, which is what
`Clip.ground()` draws.

**A scene is a pure function of time**, which is the whole reason this works.
Nothing in one animates itself: `at(t)` puts everything where it is at
millisecond `t`. `tools/blogclips.mjs` then asks Chromium for one frame at a
time — twelve a second, a second a frame — diffs each against the one before,
writes only the rectangle that changed, and gives a beat that holds a single
frame with a long delay instead of twelve identical ones. Four seconds comes
out near 200 KB.

**The format is an animated PNG**, which is what people mean when they say a
GIF and is better at being one — truecolour instead of 256, and played from a
plain `<img>` with no autoplay policy to satisfy and no poster to ship. Its one
cost is that nothing can pause it, so `assets/blog.js` draws a `<picture>` that
hands `-still.png` to anybody whose machine asks for less motion. That is the
twelfth design rule and it is the only answer the format allows.

**Each scene is drawn twice, once per style.** A light card looping in the
middle of a dark page is the one thing this site will not do, so there is a
`-green` pair beside every clip and the page picks by the style it is wearing.
Four files a post, all named after its id, all generated:
[`clips/README.md`](clips/README.md) is how a scene is written and what will
bite you when you write one.

### A post

```json
{
  "id": "a-save-is-free-and-the-number-is-other-people",
  "date": "2025-12-19",
  "link": "/",
  "title": { "en": "A save is free, and the number beside it is other people" },
  "standfirst": { "en": "The bookmark takes no account at all." },
  "clip": { "en": "The bookmark pressed: the outline fills and the count goes from 23 to 24." },
  "body": { "en": ["First paragraph.", "Second paragraph."] }
}
```

`id` is what `?post=` names, so it is a lowercase slug and it never changes
once a link to it has gone out. `date` is the day it was written, `YYYY-MM-DD`
— every post on the page is drawn, so a date after today is a post claiming to
have been written tomorrow and the validator refuses it. Scheduling something
is a story's job. `link` is optional and is a path on this site: it is what
the button at the foot offers to go and try, and a post with nothing to try
has no button. `clip` is the sentence saying what the clip shows — it is the
`alt` on the picture, so it is written for somebody who cannot see it rather
than as a caption — and a post that carries one has to have the four files in
`clips/` to go with it, which the validator checks.

### A post is not held to the ten languages

Every string the page draws **around** a post — the title over the index, the
lead, the way back, the button, the date's fallback — is in `data/ui.json` in
all ten, like every other word on this site, and the validator holds it to
that the way it holds everything else. See
[Languages](#languages) and rule 11 of [the design rules](#the-design-rules).

The posts themselves are not. A post is several hundred words of somebody's
own writing, which is what a story's caption and a place's blurb are, and
those have always been written in the languages they have been written in —
`data/stories.json` has captions that are English alone and nobody has ever
thought that a bug. Holding a blog to ten languages means either ten
translations before a post can go up, or nine machine translations of an
argument about why there are no ratings on a map.

So: **English is required**, because it is what every language falls back to,
and anything else is welcome. A reader whose language a post has not been
written in gets the English **and a line above the first paragraph, in their
own language, saying so** — which is the one place on this site that admits to
a fallback, and it admits to it in the reader's words rather than in silence.

The three fields have to agree on their languages. A title in Estonian over
paragraphs in English is a post that looks translated and is not, so the
validator fails it.

### The date

Written by hand in the file and drawn with `Intl.DateTimeFormat`, which is the
other way round from `formatMonth()` in `assets/app.js`, and the reason is
grammar. A date with a day in it puts the month in a case the twelve names in
`ui.json` are not written in — Russian wants *9 января* where the list says
*январь*, Finnish wants *9. huhtikuuta* where it says *huhtikuu*. `Intl` knows
that for all ten and a pattern of our own cannot, short of a second list of
twelve names per language for this one line. `blogDate` in `ui.json` is the
fallback underneath, in each language's own order, for an engine with no
`Intl` at all.

English asks for `en-GB` and not `en`. This site's English is the English the
write-ups are in, where `2026-08-09` is *9 August 2026*; `en` on its own
resolves to `en-US` in every engine that has both and draws *August 9, 2026*.

### Nothing on the site links to it

Not the map, not the lists, not the account page. The map is a map: what it
has to say in its own chrome is where to eat, and a pill on the rail offering
an essay about the rail would be the site clearing its throat at somebody who
came here to find dinner. **How this works** is already the short answer, in
eight sentences, at the moment somebody wants it.

**It is not hidden from search, though, and that is the difference between
this page and `/google`.** The directory is unlinked *and* `noindex` *and*
disallowed in `robots.txt`, because it is Google's description of Tallinn and
must never turn up beside the pages that are the verdict. The blog is this
site's own writing about itself: being read by somebody who searched for why
a restaurant map has no ratings is most of what it is for. So it is indexed,
it is in `sitemap.xml`, and `robots.txt` says out loud that the omission of a
`Disallow` line is deliberate.

Which makes the sitemap load-bearing here in a way it is nowhere else: with
no link into the page anywhere on the site, that file is how a crawler learns
the address exists at all. A post is reachable from the index, and the index
is reachable from the sitemap, and there is no third road in.

### Writing one

1. Add an object to `data/blog.json`. Anywhere in the array — the page sorts
   by date, newest first, rather than trusting the order in the file.
2. Write `clips/scenes/<id>.html` if it is getting a clip, and
   `node tools/blogclips.mjs --only <id>` to draw it. Open the scene in a
   browser first: with no query string it plays on a loop, which is the only
   way to see whether the timing reads.
3. `node tools/validate.mjs`.
4. Open `/blog` and read it. There is nothing else to run: no database, no
   deploy step beyond the push.

Counts are deliberately kept out of the posts. This file, the code comments
and the skills already carry "seventy-five places" and "eleven hundred and
ten" in enough places that changing one is a `grep` and a careful afternoon,
and a blog is the last place that should quietly become one more copy of a
number that drifts. A post says *the map* and *the whole export of the city*
and stays true.

Opening a post is reported as a page view of its own, titled with the post and
pointing at its `?post=` URL, the way the map reports an opened place — so the
standard **Pages and screens** report says which of these anybody read. That
and the three presses are in the table under [Analytics](#analytics), which is
where every event on this site is listed.

---

## Feedback

`/feedback` — what people would change about this site, and who agreed with
them. The map says where to eat and the blog says why the site around it works
the way it does; this is the half that listens.

One page, the frame every page that is not the map wears — the brand header,
the 640px column, the cards — with a field at the top and everything anybody
has written under it. The door is the last pill on the map's rail, beside
**How this works**: that button is the site explaining itself and this one is
the site asking.

### Saying something needs no account, and putting your name on it is one press

Anonymous is the default and costs nothing: no sign-in, no wall, no step in
front of the one thing the page exists for. The row is filed under the
browser's own random id, exactly as a save is — `feedback.owner` holds a
`users.id` when there is a session and the device's UUID when there is not.
**Saves** carries the reasoning for that arrangement and it applies harder
here: a complaint about this site has to be writable in the first ten seconds,
before anybody has decided anything, and a form that asks who you are first is
a form that never hears the thing worth hearing.

Under the field is **Post as**, the same two-sided control a list uses to
choose who can open it. Signed in it is your name or *Anonymous*. Signed out
it is *Anonymous* or **With a name** — and choosing the second opens the
account sheet's own two fields inside the same card, with *or* and **Continue
with Google** under them. Pressing **Post feedback** then does both things in
one request: makes the account or signs into it, and posts.

**Somebody already signed in is asked for nothing**, and the fields are not
hidden from them, they are not built. A hidden password box is still a
password box: a manager can see one, offer to fill it, and put a person in
front of a prompt for a password on a page they are already signed in to. It
is also a `<label for>` pointing at a field nobody can reach, and dead markup
on every draw of the commonest state this page has. Signed out is the
different case, and there the block is built and hidden while *Anonymous* is
the choice — the fields are one press away, and keeping them in the document
is what lets that press cost nothing.

**And being signed in never takes *Anonymous* away.** It is the other half of
that row whoever you are, and the row is the only thing the choice lives in.
The account still owns what it posted that way — `named` is its own column, so
the row is still yours to remove and still counts against your cap — and the
page simply draws *Anonymous* where the byline goes. Somebody with an account
has more to say about this site than somebody without one, and some of it is
the half they would rather not sign.

**There is no separate Sign up and Sign in, and the name is what decides.** A
name nobody has makes an account; one that exists signs you into it and wants
its password. The line under the field says so before the button rather than
after it. That is a door the map's sheet deliberately does not have — there,
the form exists to ask "have you been here before", so a name that is already
somebody's has to answer *That username is taken* and never quietly sign
anybody in. Here there is no sheet and no second step, and the moment worth
asking at is the moment after somebody has written something they want their
name on. Sending them to another page to sign in is asking them to write it
twice.

It gives nothing away that the site does not already tell anybody: the sign-up
sheet answers "is this name free" to a stranger with no session at all, which
is the same question asked more politely.

`enterAccount()` in `functions/api/_account.js` is the step itself, and `mode`
is the one thing the three callers disagree about — `create`, `login`,
`either`. That module is new and it is a move rather than a rewrite: the
username rule, the password floor, the thirty-day hold on a released name, the
slow-down on a fingerprint that keeps guessing, the PBKDF2 compare and the
quiet upgrade of a hash made at fewer iterations were all in
`functions/api/account.js` and are now read by both routes. Two copies of a
sign-in is the kind of duplication that goes wrong quietly: the day one of them
stops counting a failed attempt, the other is still the door everybody is
looking at.

**Continue with Google** is the site's ordinary round trip with
`?then=/feedback`. What was in the field is written to `localStorage` on the
way out and put back on the way in, so a trip through Google does not cost
somebody the sentence they had written. The button is drawn only where
`googleReady()` says the trip would lead somewhere, which is the same call the
map's sheet makes — without a Google client set on a deployment it is not a
button that can do anything but come back saying it failed.

**And the awkward half of it ends here too.** A Google account this site has
never seen still has to be given a name, and that step used to be the map's
sheet's: the browser was sent there, named, and returned. It is asked for in
this composer now, above the sentence still sitting in the field. `/api/feedback`
sees the sealed note `/api/google` left in a cookie, answers `naming: true`,
and the composer draws a name and nothing else — no password, because a Google
account has none, and no second way in to offer to somebody halfway through
using one. Posting names the account and posts the sentence under it, in the
one press.

Nothing on this page sends the browser to the map and back, which is the whole
point of the composer and was not true of this corner of it for a day. The
sheet keeps its own copy of the step for its own visitors; the step itself is
`nameGoogleAccount()` in `functions/api/_account.js`, read by both.

### The heart, and there is no other number

A heart and nothing else: no word on the button, and small. It is the map
panel's own save mark with a heart in place of the bookmark — a disc while it
is only a mark, a pill once it carries a number, the number inside it rather
than beside it. The outline filling in is the state, said in shape as well as
in colour, which is the tenth design rule.

Anyone can press it, signed in or not, filed the way a save is. One row per
(feedback, owner), so nobody runs a number up by pressing twice, and the same
caveat `/api/saves` carries about its own counts applies: anybody willing to
clear their storage ten times can add ten. Nothing here is ranked against
anything outside this page, so what that buys is a bigger number and not a
better position anywhere.

Never drawn at nought — a "0" under somebody's sentence reads as a verdict on
it rather than as nobody having pressed yet, which is why a save count and a
keep count are both hidden there.

**Nobody hearts their own.** Your own rows carry **Remove** instead, and the
heart on them is a number rather than a press. `/api/feedback` refuses the
request as well as the page not making it: the page is not what decides.

### One order, and the page decides it

The most hearted first, with anything posted in the last ten minutes standing
above them all, newest of those first.

There are deliberately no chips to choose it with. Two orders on a page like
this would make the reader responsible for a decision they have no way to have
an opinion about — and the directory's own **Order** row exists because ranking
lists by keeps genuinely buries the new ones, which is the problem the ten
minutes solves here instead.

That window is what stops the loop the heart order would otherwise be: a
sentence posted this afternoon starts at nought hearts, sits below everything
that has ever been agreed with, and is therefore never read by anybody who
might agree with it. Ten minutes at the top is long enough for the people who
happen to be on the page to see it and short enough that the page is not a
chronological feed with extra steps. `FRESH_MS` in
`functions/api/feedback.js` is the whole of it, and on a page few people open
in any given minute an hour would be the better number.

The person who has just posted sees theirs at the top whatever the order says.
That is the one time the page puts a row somewhere the order did not.

### Twenty a page, and what it costs to count

Twenty rows and **Show more** under them, `OFFSET` rather than a cursor — a
cursor has to be a value the order can be resumed from, and this order is
partly a count that changes while somebody is reading. A row moving between
pages because somebody hearted it mid-scroll is the truth arriving rather than
a bug.

The hearts come off a `LEFT JOIN` and a `GROUP BY` and there is deliberately
no counts table of the kind `save_counts` is. The note over `list_keeps` in
`db/schema.sql` is the argument in full: a counts table is a migration and a
backfill run by hand on a live database with no backup in this repository,
plus a second place for the same number to live and a way for the two to
disagree. The day the `GROUP BY` shows up in a query time is the day to write
one, and it should be written the way `save_counts` is — recomputed inside the
batch that changes it, never nudged by one.

### Taking one down

Your own goes with **Remove**, which asks first because there is no way back:
the row and its hearts go in the same batch.

Somebody else's is by hand and there is no route and no button for it:

```
UPDATE feedback SET hidden = 1 WHERE id = '<the id>';
```

through the write gate, against both databases. The column is there from the
first day precisely so that a **Take down** for the site's owner can be added
later without a migration against a live table — see **What needs a yes** in
`CLAUDE.md`, which is why a write is a separate sentence from a merge.

### Two tables, and every read survives their absence

`feedback` and `feedback_hearts` in `db/schema.sql`, applied by hand like
every other schema change here. `named` is its own column rather than being
read off `owner_kind`, and that is the one thing about this table worth
copying: somebody signed in may post anonymously, the row is still theirs —
still theirs to remove, still counted against their cap — and the page simply
does not draw the username. Inferring "show the name" from "an account owns
it" would have made every anonymous post by a signed-in person a signed one.

Both reads are wrapped, because a schema change applied by a person and code
deployed by a push cannot be made simultaneous. Inside that window the page
draws its title, its sentence and its field out of `data/ui.json` and says the
feedback could not be loaded, which is a state it has on a healthy deployment
any time a request does not come back. What it must never do is answer 500.
`users.about` and `lists.pin` take the same bargain.

### The caps

Five hundred characters, and three pieces of feedback an hour from one network
fingerprint — the same hashed address and user agent the saves are capped by,
so the address itself never reaches the table. Three is a cap rather than a
queue: everybody with something to say has said it by the third, and the
fourth in an hour is somebody leaning on the form. `MAX_FEEDBACK` and
`PER_HOUR_CAP` are in `functions/api/feedback.js`, and the five hundred is
restated as a `maxlength` on the field so somebody is stopped at the keystroke
rather than at the round trip.

### Not indexed, and not disallowed either

`noindex, follow`, in `_headers` and in the page's own markup, and **no
`Disallow` in `robots.txt`** — the two depend on each other. A crawler
forbidden to fetch the page can read neither half of the tag, which would
leave the address itself eligible to be listed on the strength of any link
pointing at it, with nothing to say otherwise. Not indexed because everything
here is written about this site rather than about the city, and a search for
Tallinn Tastebuds answered with its own snag list would put the map's worst
page in front of its best. Followed because the bylines lead to real profiles.

### What it does not do yet

No reply from the owner under a piece of feedback — the page is one way, and a
reply is a second kind of row by a second author. No editing: remove it and say
it again. No categories, which the sentence carries. No moderation queue: a
post is on the page the moment it is made. No search. No notification; the
owner reads the page.

---

## Statistics

`/stats` — which places get opened, and which chips and buttons get pressed.
The map says where to eat, the blog says why the site works the way it does,
the feedback page listens; this is the one that counts.

One page, the frame every page that is not the map wears — the brand header,
the 640px column, the cards — and four tables. Two facts at the top, **Most
opened** and **Least opened**, then every place on the map ranked with the
zeros in it, then the Google venues somebody has pressed, then all fourteen
filter chips, then the nine pills down the rail, then two footnotes under all
four: every open counted, and how many accounts exist — see **How many
accounts exist** below for the second. Nothing on the site links to it. That is the blog's arrangement rather than
the directory's, with one difference: the blog is indexed and this is not,
and **Not indexed, and not disallowed either** below says why.

### It counts opens, and an open is a gesture

Five gestures, and no others:

| What | Where | Counted as |
| --- | --- | --- |
| a place opened on the map | `selectPlace()` in `assets/app.js` | `place`, the slug |
| a card pressed on the directory | `select()` in `assets/venues.js` | `place`, the Google key |
| a chip turned on | `applyFilters()` in `assets/app.js` | `filter`, the type id or `discount` |
| a public list's page drawn | `boot()` in `assets/lists.js` | `list`, the list id |
| a pill on the rail pressed | `countRailPress()` in `assets/app.js` | `rail`, one of the nine ids |

**The list is not on this page**, and it is the only one of the five that is
not. A list opened is counted into the same table under `kind = 'list'`, and
what reads it is `/lists`, which puts the most opened list at the top — see
**Public lists**. It is not in the ranking here because this page is about
restaurants: a table of lists under a table of places would be two different
questions sharing a heading, and the number is deliberately not drawn on the
directory's rows either. It is also left out of the total at the foot of this
page, the way the filters are.

A row on somebody's list, a search that narrows to one name, a pin passed
over: none of those is somebody asking for a restaurant, and counting them
would make the number mean less rather than more. A chip turned **off** is not
counted either — it was already counted when it went on, and counting both
ends would make every filter worth exactly twice itself. **All** is not a
filter and counts nothing: it is the way out of the chips.

Each page counts each place, each chip and each list **once per load**, held
in memory and never in storage — and a list's page counts the one list it is,
which needs nothing held at all: the only way to open the same list twice is
to load the page twice, and that is two opens. A list its own owner opens is
not counted, so an author reloading their draft cannot climb a ranking of
strangers. That is the rule `TTBTrack.view()` already applies to the page view
it reports to Google Analytics beside an opened place, and the two agree on
purpose: two numbers about the same gesture that counted it differently would
be two numbers somebody eventually puts side by side. So comparing three
places is three, walking back through history is not thirty, and a chip
flicked on and off while somebody makes their mind up is one press.

A reload counts again, exactly as a reload is a fresh page view in GA.

### The rail is the one that counts every press

The other four gestures are one question asked once. A pill is not: the
question **Buttons on the map** exists to answer is the plain one — which of
the nine buttons down the left of the map do people actually push, and how
often — and counting a press once a load would answer "how many visits pressed
it at all", which is a different question and a quieter one. So the die
pressed four times is four, and the colour swatch flicked back and forth is
every flick.

It agrees with Google Analytics here for the same reason the others do:
`TTBTrack` is sent an event per press of these buttons rather than one per
load, so both numbers count the same gesture the same way. That is the rule —
agree with the report beside it — and once per load is how it comes out for a
place, every press for a pill.

The nine are the nine inside `#rail`, named in `RAIL_PILLS` in
`functions/api/stats.js` and again in `RAIL_PRESS` in `assets/app.js`, which
is the pair that has to be kept in step: a button counted on the map and not
named in the route is a press answered `{ok:false}`. Neither file can import
the other — the arrangement **The pins** has — so a pill added to the rail is
counted once it is written into both. The colour swatch is one of them and has
no id in the markup, because `renderStyleSwitch()` draws it; it is known by
standing inside `#styles`, the same way `hintPill()` finds it. One listener on
the rail rather than nine on the buttons, since two of them are links that
leave the page and a third does not exist at boot.

**The radio is not on this table.** It wears the rail's pill and reports to GA
like everything else, but it stands next to the language switch in the corner
rather than in the rail — see **The radio** — and the question this table asks
is about the column down the left. The name in `data/ui.json` each row is
printed by is the button's own label — `accountOpen`, `randomPick`,
`styleLabel` and the rest — so the table reads as the rail does and nothing
was translated twice.

### Presses, not people

Nothing in `press_counts` is filed under a person — there is no owner column,
no device id, no fingerprint, and the route stores nothing about who pressed
anything. The number is how many times a thing was pressed, by anybody, and
one visitor opening the same place on five evenings is five.

Which also means nothing stops somebody posting to `/api/stats` in a loop, and
this does not pretend otherwise. The counts are not money and nobody is paid
for a position in them. The day it matters, the answer is the one `saves`
already uses: a hashed network fingerprint in a table beside this one, and a
count of people rather than of presses.

### A count and not a log

`press_counts` is one row per thing, `(kind, id, n)`, and the write is an
upsert that adds one. There is no row per press and no timestamp anywhere,
for the reason `save_counts` exists under **Saves**: ranking the map out of a
log would mean reading every row ever written, forever, on a page anybody can
open. This way a ranking costs one row per thing that has ever been pressed —
the places on the map, however many Google venues anybody has looked at, and
fourteen chips — and never more, however popular the site gets. A table
bounded by the number of things there are rather than by the traffic is also
why it carries no index on `n`: at that size an `ORDER BY` reads the whole
thing, and an index would be a second copy to keep.

What that costs is time. There is no "this month": a place that was busy in
March outranks one that is busy now until the arithmetic changes. It was taken
knowingly, and the change if it is ever wanted is a `day` column in the
primary key and one row per thing per day — still bounded, still an upsert,
and a new table rather than an `ALTER`. It is not worth writing before
somebody asks the question.

One table and not four, for places, filters, lists and pills alike. They are
different things and a table apiece would say so — but everything around them
is one thing: one route, one upsert, one read that draws the page, and one
place to look when a number is wrong. `kind` is in the primary key, so a
filter called `bakery` and a place called `bakery` can never collide — which
is also why the rail cost no schema change at all, exactly as `list` did not:
a fourth kind is four letters in a column that was always going to hold more
than two.

### One request on the way in, and five minutes of cache

`GET /api/stats?lang=` answers with the ranking **and** the page's words in one
block, so `assets/stats.js` never fetches `data/ui.json` at all — the
arrangement the flashcards page introduced, and `wordsFor()` in
`functions/api/_lib.js` is now shared by both.

The answer is held in the colo for five minutes. Nothing purges it: a save
purges the counts cache because the number it changed is on the screen that
changed it, and this is the opposite — the ranking is read on a page of its
own by somebody who is not the person whose press moved it. So the page is at
most five minutes stale, which is the honest reading of "lately", and each
colo asks D1 twelve times an hour per language however many people open it.
The cache is keyed on the route and the chosen language alone, so the ten
candidate lists a browser might send collapse to at most ten keys.

### The bottom of the ranking is not a verdict

The map's table prints every place, including the ones on nought, because the
bottom is as much of an answer as the top — and that is exactly where it could
start saying something it has no business saying. Three things keep it honest.

Most of the map sits on nought for a while and a handful sit on one, so both
ends of the ranking are usually a tie. Naming whichever of them the sort
happened to put last would be the page making something up, so a tie says how
many places it is and what they are all on: *Least opened — 65 places, 0
opens*. That is the more useful fact anyway.

A **shut** place is still on the map, still has a card and can still be
opened, so it is still ranked — with the word `CLOSED` beside its name, in
both tables and in the headline, or a restaurant that closed in March reads as
one nobody wants.

And the page says in its own first sentence what the number is: which places
get read about, not which are best. Nothing on this map is ranked by anything
else, and this is not the exception — see **The mark**, and the rating column
on `google_venues` that exists only because it is Google's and says so.

### What it argues about

Two tables have something to change, and the rail's is the newer of them. It
is nine pills deep on a phone and the cascade that introduces them is timed
against the sentence under the mark — nine collapse at 7.75s against 7.86s of
sentence, and a tenth would talk over it, which is written out at the foot of
the rail in `index.html`. So "what earns a slot" is a question with a real
cost behind it, and this is the measurement of it. Nothing is wired to it: the
rail is in a hand-written order and stays that way.

The filter table is the other one. **The order of the
filter chips** is a hand-written order with a paragraph of reasoning behind
it; this is the measurement that would argue for a different one. It is not
wired to anything — the row is still ordered by hand — and that is deliberate:
a chip row that reordered itself under people's thumbs would move the thing
they were reaching for.

### Not indexed, and not disallowed either

`noindex, follow`, in `_headers` and in the markup, and **no** `Disallow` line
in `robots.txt`. The two depend on each other, which is the trap `/feedback`
documents and this page is under the same one: a crawler forbidden to fetch
the page can read neither half of the tag, and the address would stay eligible
to be listed on the strength of any link pointing at it.

Not indexed because it ranks real restaurants by how often somebody pressed
them — a fact about this site's traffic and not a verdict on anybody — and a
search for a restaurant's name answered with its position in that ranking
would read as exactly the verdict it is not. Followed, because every name on
the map's table links to a place on the map, which is indexed and meant to be.

### How many accounts exist

One more number, under the total of opens and in the same style: `SELECT
COUNT(*) FROM users`, read fresh on every cache miss rather than kept as a
running total — the table this counts is small enough, unlike `press_counts`,
that there is nothing to save by not asking it directly. `users` in the
answer `/api/stats` gives, `statsUsersTotal` in `data/ui.json` the sentence
around it, drawn in `assets/stats.js` right under **A count and not a log**'s
own footnote.

It is a count of accounts, not of people who visited: `users.last_seen_at`
only moves on a sign-in (`enterAccount()` in `functions/api/_account.js`, and
the Google round trip in `functions/api/google.js`), never on an ordinary page
load with an already-valid session, so a figure about who came back *today*
would answer "signed in today" and not "visited today" — a gap worth knowing
about before building one. This number sidesteps it entirely by asking
something that does not depend on when anybody was last seen: how many rows
the table holds, full stop. It draws whenever the ranking above it is in at
all, `opened` or not — an account is not a press, so it is not gated behind
one.

### What it does not do yet

No time window, which **A count and not a log** above is the whole of. No
chart: a ranking is a list and a bar chart of seventy-six rows is a list with
decoration on it. No languages, no referrers, no countries — Google Analytics
has all of that and this page is the half GA cannot do, which is the site
owning its own numbers. No per-place badge anywhere else on the site: the
count is on this page or it is nowhere, because a number under a name on the
map is a score, and there are none of those here — and no number on a pill
either, for that reason and because there is no room on one. No returning-users figure
either, for the reason **How many accounts exist** above gives — the data
this site keeps cannot honestly answer "who came back today" without a
schema change that writes on every request from a signed-in visitor, which is
a cost this page has not asked anybody to pay. Nothing links to it, and if
that ever changes it is a decision about whether a visitor should see it at
all rather than a missing link.

---

## The admin page

`/admin.html` — a door, and behind it the tools for posting without opening a
terminal. It is not linked from anywhere, carries `noindex` in the markup, in
`robots.txt` and in `_headers`, and is served `no-store`.

Behind it, four tabs, and they reach the repository by two different roads.

**Post a story** commits straight to the branch the site publishes from. A
story is a thing happening now, and one that waits for a review has missed the
morning it was about. It is also the cheap kind of mistake: four lines of JSON
that take themselves down after 36 hours.

**Add a place** and **Edit a place** open a **pull request**. A place is
permanent, it is the file the whole map is drawn from, and it has coordinates
that can land on the wrong side of the street. So it waits to be read — and
waits for the validator, which is the difference between seeing the verdict
before it is live and after.

**Discount** commits straight, the way a story does — see
[Setting a discount](#setting-a-discount) for why.

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

Four fields and a button, and the first field takes **a photograph or a
video**. What happens when you press it:

1. The file is **squeezed on the device** — see
   [What it does to a photograph](#what-it-does-to-a-photograph) and
   [What it does to a video](#what-it-does-to-a-video) below.
2. The picture, or the video and its poster frame, is committed to `stories/`,
   **then** the entry to `data/stories.json` — that order, so a story naming a
   file that is not there is never in the repository even for one commit.
3. Cloudflare redeploys. The ring appears by itself when `from` comes round;
   nothing has to be deployed at nine in the morning, because the file was
   already there.

The id is the place and the day — `kokomo-2026-09-14` — and a second story for
the same place on the same day gets a `-2`. No `until` is written: the 36 hours
do it.

**The place is a choice and one of the choices is no place.** Above the
seventy-five names in the list is *Nowhere in particular*, for a story that is
not about a place on this map — something in another city, a notice, a picture
that is only a picture. The entry it writes has no `spot`, so the story has
nothing to press under it and the id is the day alone, `story-2026-09-14`. The
picture stays in `stories/` when the 36 hours are over rather than moving onto a
place, because there is no place to move it onto — the hint under the list says
so before you post rather than after. Neither the list nor the button will take
silence for an answer: choosing nothing is not the same as choosing nowhere, and
the button waits for one of the two.

**The time is Tallinn's**, not the phone's, so the current Tallinn clock is
printed under the field to check against. Only English is asked for; it is the
fallback every other language uses, and the rest can be filled in from a laptop
later without the story coming down.

**A video is posted the same way**, and it used to be the one thing this page
could not do. It takes as long as the clip lasts, because re-encoding one in a
browser means playing it through once — the form says so on the button before
you press it, and nothing comes out of the speaker while it runs.

### Adding a place

The same form the data needs: name, address, coordinates, price, types, the
English write-up, must-orders one to a line, and as many photographs as you
like. The id is made from the name — `Põhja Pagar` becomes `pohja-pagar`.

**The coordinates are a map.** Press where the door is, or drag the pin.
**I am here** fills it from the phone's own position, which is the one thing
easier standing in the doorway than sitting at a laptop, and then you drag the
pin the last few metres onto the actual door. The field and the pin are two
views of one number: type into one and the other follows.

That map is the same map — Leaflet 1.9.4 and the CARTO tiles the site already
draws, same version, same integrity hashes, same key — fetched only when a
place form is open, so the story tab and the door stay as light as they were.
If it will not load, the form says so and the numbers can still be typed,
which is how every place already in the file got there.

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

### Changing one

The same form, filled in from the place as it stands. Everything is editable
except the **id**, which is the folder the photographs live in and what every
`?spot=` link ever shared points at.

**What the form does not ask about is not touched.** The entry written back is
the object as it is in the file with only the fields above replaced, so the
other nine write-ups, `visited`, `added` and any key added to the data since
this page was written all ride along untouched. That is the whole reason an
edit is not a blank form you fill in and save.

Two things it will tell you rather than decide for you:

- **Change the English write-up and the other nine no longer say the same
  thing.** They are left exactly as they are — blanking nine languages is not
  a thing a phone should do on its own — and the form and the pull request
  both say so, by name.
- **Closed is a change, not a deletion.** Closed places are in the picker too,
  so reopening one is an edit like any other. See
  [Close a place instead of deleting it](#close-a-place-instead-of-deleting-it).

Editing opens the map on that place at street zoom, which is the point: **check
the pin lands on the right side of the street** — the note this README has been
ending every place with — is finally a thing you can do before merging rather
than after.

Photographs already there are shown with a tick to drop one, which deletes the
file from the repository as well, since nothing else points at it. New ones are
numbered **past the highest that has ever been there**, never into a gap a
removal just made: `/photos/*` is cached for a week, so a reused filename would
serve last month's picture to anybody who had already seen the old one.

### Setting a discount

The **Discount** tab is where the three numbers of a drawn rate are chosen,
and where a discount is switched on, off, or changed. Pick a place — the ones
with a discount come first, saying whether each is on and what it pays, then
every other open place — and the form is the whole of what a deal can be
asked about here:

- **Switched on.** Off keeps the pass pages working by their address, behind
  the preview band, and takes the pill, the chip and the button off the map.
  Leave it off until the restaurant has agreed.
- **One rate**, and the number; or **a rate drawn each hour**, and the base,
  the spread and the step. The run those make is printed under the fields as
  you type — *5 rates: 5, 10, 15, 20, 25* — and so is the sentence the map
  will read. Either kind is for members, which is not a choice on this form
  and not a property of a deal: see [It is for members](#it-is-for-members).

**Publish** commits `data/deals.json` straight to the publishing branch, the
road a story takes rather than the one a place takes, because a discount is
changed at a counter's request on the afternoon it is asked for, and a pull
request nobody is at a laptop to merge would leave the old rate running
through the evening. Undoing a change is making the next one; git keeps every
version, and the commit subject says what the place now does — *Pudel draws
you 5 to 25% off, once an hour*.

Everything `tools/validate.mjs` would fail the build over is checked before
the commit exists, in the same words: whole numbers, a spread that is a whole
number of steps, a run that stays inside 1–99, a rate between 1 and 99.

**What it changes in the offer lines is the number, and nothing else.** Every
deal says its rate once per language — *15% off your order*, *Siparişinizde
%15 indirim* — and the form replaces that number, or the `{rate}` a rolled
deal leaves in its place, in all ten. A new deal borrows its ten lines from a
deal already in the file, with the number changed, gets a fresh key made the
way the README's one-liner makes one, and takes its name from the map. What
the form does not ask about — the key, the small print, the dates — is left
exactly as it is.

Two things stay a file edit: an offer with no number in it, a free coffee or
a second pizza, which the form refuses rather than guess where a rate goes in
Armenian; and removing an entry altogether, which is for a deal that will
not come back. The first deal in an empty file is a file edit too, since
there is nothing yet to borrow the lines from.

After publishing, the form prints the guest page's address and the staff
link. For a new deal the staff link is the one thing that happens by hand:
send it to the restaurant once, and they bookmark it.

### What it does to a photograph

Every photograph either tab uploads goes through the same squeeze, on the
device, before a byte of it leaves:

- **1600px on the long edge**, at quality 72, dropping to 1400, 1200 and then
  1100 as the quality steps down to 58 — until it comes in **under 200 KB**.
  Edge first and quality second, the order
  [photos/README.md](photos/README.md) argues for, because a frame full of
  leaves is the expensive one and dropping the edge hides better.
- **WebP where the browser can write one, JPEG where it cannot.** The encoder
  is asked once, up front, what it is willing to produce, and the file is named
  after the answer. `canvas.toBlob` does not fail when it cannot encode what it
  was asked for — it quietly returns a PNG — so what comes back is checked
  against what was requested, and a browser that can only manage PNG is told to
  use a laptop rather than humoured. The first photograph ever posted from a
  phone here went up as a 1596 KB PNG named `.webp` for exactly that reason.
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

### What it does to a video

There is no ffmpeg in a browser. There is the next best thing, and it has been
in every one of them for years: play the clip through once, draw each frame
onto a canvas that is already the right size, take that canvas as a video track
and the file's own sound as an audio track, and hand the pair to
`MediaRecorder`. What comes back has been re-encoded by the same hardware
encoder the camera recorded with.

- **Fitted inside 1080×1920**, never stretched past its own size, and forced
  even on both sides because H.264 has no other option. Fitted rather than
  filled: the viewer letterboxes what it is given and has never cropped a
  picture nobody asked it to.
- **The first 15 seconds.** A longer clip is trimmed to that and the form says
  so, under the preview, before anything is posted.
- **A bitrate worked out from the running time** — six megabytes divided by
  however many seconds it runs, floored at 700 kbps and capped at 5 Mbps. One
  pass, and the file lands under budget rather than near it.
- **The sound goes through Web Audio into the recorder and nowhere else.** The
  graph never reaches the speakers, so squeezing a video is silent on the
  device doing it. Where there is no `AudioContext` to build that graph with,
  the element is muted instead: a silent story beats a phone that suddenly
  starts playing one out loud in a café.
- **A poster frame** is taken from the same playback, a third of a second in,
  at 540px — far enough that a fade from black is over, near enough that it is
  still the opening shot. It is also the picture the place is left with when
  the story is over, which is the other reason it wants to be a frame worth
  looking at.

**What container comes out is not up to the page.** Safari writes MP4/H.264 —
so an iPhone, which is where a story is shot, posts a finished file every
browser can play. Chrome and Firefox write WebM, which Safari will not touch.
A browser with no `MediaRecorder` at all uploads the file exactly as it came
off the camera, up to the 25 MB Cloudflare Pages will serve.

Teaching the form to refuse three of those four would mean a phone that can
post a story on one browser. So it posts whatever it has, and
[`.github/workflows/story-media.yml`](.github/workflows/story-media.yml) makes
it ordinary on the other side — see
[Whatever the browser could write](#whatever-the-browser-could-write). The
worst case is a story that is a WebM in the repository for a minute, never a
story an iPhone cannot watch.

`STORY_SECONDS`, `VIDEO_BUDGET` and `RECORDER_TYPES` at the top of the script
in `admin.html` are the whole of it, and nothing else depends on them.

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
free tier permanently, HTTPS included. Deploying it is the part with a ceiling
on it; see **The build budget** below.

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

Every push to the production branch redeploys. No other branch deploys
anything — see **The build budget**. A deployment made by hand with
`wrangler pages deploy --branch=<name>` still gets a preview URL, and that URL
talks to its own database — see **Two databases, and never one** — so anything
pressed while checking a change stays out of the live counts. Nothing needs
enabling on the GitHub side — unlike GitHub Pages, Cloudflare authorises
itself through your own GitHub account.

**This connection is the only deploy path, on purpose.** There used to be a
second one, a workflow that published from GitHub's runners with a Cloudflare
API token and account id held as repository secrets. The secrets were never
created, so on every one of its two-hundred-odd runs it validated, printed a
notice that the secrets were missing, skipped its publish steps, and went
green — and its header, its notice and its README section each told the next
person to go and create them. Two deploy paths on one project would have raced
each other and produced out-of-order deployments, which the workflow's own
header warned about, so the workflow went rather than the secrets arriving.
There is no Cloudflare token anywhere in GitHub, and nothing needs one: a
push is a deploy, whoever makes it, the hourly story cron's included.

### The build budget

Serving this site is free and stays free: static asset requests are unmetered
on every Cloudflare plan, so deployments pile up at no cost and none of them is
ever deleted. What is metered is *making* them. The free plan allows **500
builds a month**, and Cloudflare counts a deployment as a build whether or not
there was anything to build — an empty build command spends one exactly as a
bundler would. Preview and production draw on the same five hundred.

That is easy to walk into here, because the deploy path is a push rather than a
release. The first three weeks of this repository made 773 deployments across
191 pull requests: four to a PR, of which one was the merge and the other three
were the same branch going up again after a validator failure, a review note or
a rebase. That is thirty-four deploys a day, so the five hundred is gone by
the middle of the month — and what runs out is not previews, it is deploys.
The live site stops updating too.

Running out should not produce a bill: the free plan has no overage to charge
for, so Cloudflare stops building until the month turns over. That is the
documented behaviour rather than an observed one — this repository has not hit
the ceiling yet, and the dashboard is the place to confirm it. Either way the
failure is worse than a bill in one specific way: nothing announces it. The
site simply stops changing when you push, and the reason is on a screen nobody
was looking at.

So previews were switched off. Under [branch build controls][cf-branches],
Pages watches the production branch and nothing else, which takes the
automatic 580-odd a month to nil. What is left against the ceiling is the
merges — around 250 a month at this rate, and that number was never avoidable,
since a merge is the deploy.

The reason that is not a loss is that the previews were not being looked at.
Of 773 deployments, next to none of those URLs was opened: the review they
were built for happened in the diff instead, and what checking there was ran
under `npx wrangler pages dev .` — the same bindings against the same preview
database, on your own machine, for nothing. Switching them off costs the thing
that was not happening.

Two things `pages dev` genuinely cannot show, and `CLAUDE.md` lists them: a
`[env.preview]` change in `wrangler.toml`, which takes effect only once a
preview carries it and which `pages dev` cannot reach because it reads the top
level instead; and anything whose point is how it feels on a real phone, which
a localhost is not. The database is not one of them — `pages dev` talks to the
same remote `tallinntastebuds-preview` a preview deployment would, so a `db/`
load can be watched arriving without deploying anything. For the two that are
left there is no automation: one `npx wrangler pages deploy . --branch=<name>`
from a terminal makes a preview when one is wanted, and a change that wants one
says so in its pull request rather than working around it.

**This is meant to be revisited.** If that last paragraph starts coming up
every other week, the answer is to put previews back on some branches rather
than to keep running the command by hand: branch build controls take an
include pattern, so `preview/*` would deploy only branches asking for it. The
other direction is Pro, at $20 a month for 5,000 builds, which buys room for a
habit rather than fixing it.

[cf-branches]: https://developers.cloudflare.com/pages/configuration/branch-build-controls/

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
build on a stale one, and CI runs the validator on every push and every pull
request — so a changed file always reaches visitors under a URL no browser has
ever seen, and no browser can answer for it out of its own cache.

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

**`splitwise.tallinntastebuds.ee` is a third entry on that same tab**, on the
same project, pointing at the same deployment — see
**[Splitwise](#splitwise)**. `functions/_middleware.js` is what makes it a
different site rather than a second copy of this one, and until the entry
exists that feature answers at `/split` and the subdomain does not resolve.

**`flashcard.tallinntastebuds.ee` is a fourth entry on it**, on the same terms
— see **[Flashcards](#flashcards)**. Same file makes it a different site, and
until the entry exists that feature answers at `/flashcard` and the subdomain
does not resolve.

Five lines in the repo name the host — see [Getting found](#getting-found).
Nothing else needs touching: every path in the site is relative, and the
scripts build absolute URLs from `window.location.origin`, so the QR codes and
share links follow whatever host serves them.

`tallinntastebuds.pages.dev` keeps serving the same site after the custom
domain is attached, which splits the site between two hosts: Google has to
guess which one is real, and a link copied out of the address bar carries
whichever one that person happened to land on. Worse for this site than for
most, because the QR codes are built from `window.location.origin` — a code
generated on the pages.dev copy points at the pages.dev copy for as long as
the sticker is on the table.

`functions/_middleware.js` settles it with a 301 to `tallinntastebuds.ee`,
path and query intact. It is a Function rather than a line of configuration
because nothing else can do the job:

- **`_redirects` cannot.** It matches on path only — [domain-level redirects
  are explicitly unsupported][cf-redirects]. A `/* https://tallinntastebuds.ee/:splat 301`
  rule there would match on `tallinntastebuds.ee` too and redirect the live
  site to itself, forever.
- **Redirect Rules and Bulk Redirects cannot.** Both only apply to zones in
  your own account, and `pages.dev` is Cloudflare's zone, not yours. There is
  no dashboard page on which to write this rule. (An earlier version of this
  section said there was. There is not.)

Only the bare `tallinntastebuds.pages.dev` is redirected. Preview deployments
live on `<branch>.tallinntastebuds.pages.dev` and `<hash>.tallinntastebuds.pages.dev`,
and those are the addresses you open to check a change *before* it is live —
bouncing them to the live site would hide the very thing you went there to
look at. They carry Cloudflare's own `x-robots-tag: noindex`, so they are not
a search problem.

`_routes.json` keeps the Function off `/assets`, `/photos`, `/stories`,
`/data` and `/favicon.ico`. Those are served straight from the edge, so the
story videos and the photos — much the highest-volume requests here — never
spend a Functions invocation against the free plan's daily quota.

Two things worth knowing about this arrangement:

- `_headers` still applies — to what the asset server answers. The [docs'
  caution][cf-headers] is about responses a Function *generates*; a response
  handed back by `context.next()` comes from the asset server and keeps its
  header rules. Verified against `wrangler pages dev`: `deal.html` is still
  `no-store` with and without the middleware. The map is the one page that
  no longer comes back that way: `functions/index.js` answers `/` with its
  own Response, so it restates the revalidating rule `_headers` gives the
  static file, and `PAGE_HEADERS` in `functions/_shell.js` restates the two
  security headers every Function-served page would otherwise lose.
- A 301 is cached hard by browsers, which is the point of using one — it is
  also what makes it awkward to undo. Anyone who has hit the redirect once
  will keep skipping to `tallinntastebuds.ee` without asking. That is the
  right trade for a permanent move and the wrong one for an experiment.

To watch it work without deploying, run the site the way Cloudflare does and
ask it as each host in turn:

```
npx wrangler pages dev .
curl -sI -H 'Host: tallinntastebuds.pages.dev' http://127.0.0.1:8788/   # 301
curl -sI -H 'Host: tallinntastebuds.ee'        http://127.0.0.1:8788/   # 200
```

`npx` is the one place a dependency is downloaded, and nothing it fetches is
committed or deployed — `wrangler` is a local tool, not a dependency of the
site, which still has none.

`wrangler pages dev` reads the top of `wrangler.toml`, which is pointed at
`tallinntastebuds-preview` rather than the live database on purpose: a local
session that reaches for the remote database should reach for the one it is
allowed to break.

[cf-redirects]: https://developers.cloudflare.com/pages/configuration/redirects/
[cf-headers]: https://developers.cloudflare.com/pages/configuration/headers/

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
- a cuisine in `data/cuisines.json` missing a label in any language, or one
  claiming an id `taxonomy.json` already uses
- a `KITCHENS` pattern in `functions/api/venues.js` that no longer matches a
  single row of the Google Places export, an id nothing can say in ten
  languages, or a label no pattern can ever produce — see **The directory**
- a UI string present in one language but missing in another
- a string the site asks for — a `data-i18n` key in the markup, a `t('key')`
  in a script — that is in no language of `data/ui.json` or `data/split.json`
  at all, which is how a visitor ends up reading the key itself off the page
- a `data/split.json` that speaks a language `data/ui.json` does not, or is
  missing one it does, or is missing a string in one of them, or carries a key
  `data/ui.json` also carries — one string, one home. See
  **[Splitwise](#splitwise)**
- a `data/decks.json` whose decks or cards are malformed: a duplicate id, a
  missing side, a side longer than the sixty characters the card draws, a name,
  a line or a back that is a bare string rather than an object keyed by
  language, one of those with no `en` for everything else to fall back to or
  with an `et` — Estonian is what the front asks, never what the back answers —
  or a deck id shaped like one somebody wrote, since the two namespaces must not
  meet. A back missing its Azerbaijani or its Russian only warns.
  See **[Flashcards](#flashcards)**
- a colour token one style declares and another leaves out, which is a style
  quietly wearing the other one's value out of `:root`. See **The design
  rules**
- an `assets/pins.js` whose eight markers have drifted from the ids
  `functions/api/_pins.js` will let a list store, a glyph called `mark` in
  either table, a kind of place a list could also pick, a kind filed under a
  tone that does not exist, a tone with no colour token or no `.pin-tone-`
  rule behind it, or a marker nobody has named in ten languages — the picker
  builds its keys out of the ids, so the scanner for `t()` calls cannot see
  one of the eight and nothing else would catch it. See
  **[The pins](#the-pins)**
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
- a post in `data/blog.json` with an id that is not a slug or that another
  post already answers to, a `date` that is not a day or is after today, a
  `link` that is not a path on this site, a language `data/ui.json` does not
  speak, a `body` that is not paragraphs, no English in any of the three
  things a post says, or a language one of them has and another does not —
  see **[The blog](#the-blog)**
- a post that says it has a `clip` and is missing any of the four files in
  `clips/` that make one, or whose `clip` sentence — the `alt` on that picture
  — is missing in English. A file in `clips/` that no post names only warns,
  and so does a clip heavier than 600 KB
- a deal in `data/deals.json` for a place that is not on the map, whose
  `name` is not what `restaurants.json` calls the place, whose key is shared
  with another deal or off the code alphabet, or a live one with no
  `offer.en` — see **Restaurant discounts**
- a deal whose `roll` is not three whole numbers, whose run leaves 1–99 or
  whose `spread` is not a whole number of `step`s, whose `offer` lacks
  `{rate}` in some language — or a deal with no `roll` whose `offer` writes
  `{rate}` for nothing to fill in. See **A rate that is drawn**
- `wrangler.toml` pointing the preview deployments and the live site at the
  same database, or an environment block with no database or no
  `ENVIRONMENT` of its own — see **Two databases, and never one**
- a `db/google-venues.sql` that is not what `tools/googlevenues.mjs` would
  write from `exports/tallinn_restaurants.csv` (run the tool and commit the
  result), or a `db/google-lists.sql` that is not what `tools/googlelists.mjs`
  would write from the same export — see **The five lists Google wrote**
- a `db/type-lists.sql` that is not what `tools/typelists.mjs` would write from
  `data/restaurants.json` and `data/taxonomy.json` (run the tool and commit the
  result), or that holds a list longer than `MAX_ITEMS` in
  `functions/api/lists.js`, which is imported rather than restated — see
  **The chips, as lists**
- a `?v=` cache stamp in the HTML that no longer matches the file it points at
  (run `node tools/stamp.mjs` and commit the result)
- a `sitemap.xml` that is not what `tools/sitemap.mjs` would write from the
  languages in `data/ui.json` and the thirteen lists in `tools/typelists.mjs`
  (run the tool and commit the result) — a language added without it is a
  page no search engine is told about
- `index.html`, `lists.html`, `split.html` or `flashcard.html` without exactly
  one pair of `PAGE-HEAD` markers, which is where the Function serving that
  page writes its head; `rehead()` in `functions/_shell.js` leaves a page
  without them alone, so this is the only thing that would say so
- a `data/places.json` that is not what `tools/places.mjs` would write from the
  map and the CSV beside it (run `node tools/places.mjs` and commit the
  result), holds an id twice, or has lost a place that is on the map — any of
  which would put somebody's sentence against the wrong restaurant
- a `data/city.json` that is not what `tools/city.mjs` would write from
  `exports/tallinn_restaurants.csv` (run `node tools/city.mjs` and commit the
  result), which would leave every list on `/lists` drawn on last month's
  city — quieter than a stale table, because the panel still looks like a
  panel

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
- a live deal with no `offer` in some language, or one whose `until` has
  passed
- a `roll` with more than twelve rates, since the counter's screen lists a
  code for each of them
- an unknown key on a deal or a story, the same way as on a place

---

## Files

```
CLAUDE.md                  what a session reads before it starts, and which
                           skill to load next
.claude/settings.json      what a session may run without asking, the two
                           things it may never do to a database, and the hook
                           below
.claude/hooks/             d1-write-gate.mjs: reads of D1 run, a write that
                           names its rows and at most a hundred of them stops
                           and asks, and anything bigger or vaguer is refused,
                           because the rows are not the session's to decide
                           about. `--check` runs its own cases, and CI runs
                           that
.claude/skills/            one checklist per kind of change — a place, a story,
                           a discount, a page, a Function, the export — loaded
                           when the task matches, or by /name
.claude/rules/             the cleanup rule, loaded whenever code is opened,
                           and one pointer per checklist, loaded by the
                           files that process touches
index.html                 the whole page
assets/styles.css          design tokens at the top, then everything else
assets/app.js              map, panel, filters, i18n, lightbox — no framework
functions/_middleware.js   which hostname is this: the pages.dev copy goes to
                           the real one, and the splitwise subdomain serves the
                           page below and nothing else
functions/index.js         / — the map, with its head and its JSON-LD written
                           in the language ?lang= names, so a search engine
                           can index it ten times
functions/api/saves.js     the save count
functions/api/account.js   sign up, sign in, change a password, name an
                           account that arrived through Google
functions/api/google.js    the round trip to Google and back: one route, asked
                           once on the way out and once on the way in
functions/api/_google.js   what that round trip is made of — the two sealed
                           cookies, the code swap, the identities table (not a
                           route: leading _)
functions/api/lists.js     somebody else's top ten: make one, fill it, share
                           it, keep somebody else's, add a place nobody has
functions/api/places.js    the roll the picker searches: the map plus the export
functions/api/venues.js    the Google Places directory, whole and unmerged
functions/api/geocode.js   a typed street to a point, for the add-a-place form
                           and for "near Laulupeo" in the chat; Photon behind it,
                           a session in front of the route
functions/api/profile.js   one person's public lists, and their standing
functions/api/split.js     splitwise: a group, who is in it, what everybody
                           paid, and who hands what to whom
functions/api/flashcard.js flashcards: the decks somebody wrote, which cards
                           each account knows, and which of the shipped ones
                           a reader has said is wrong
functions/flashcard.js     the page, with a deck's head and a deck's words
                           written into it so a search finds the Estonian
functions/api/_lib.js      what those routes share (not a route: leading _)
functions/api/_lists.js    reading one list, shared with the page below
functions/api/_mostkept.js reading a page of everybody's, most opened first
functions/api/_profile.js  reading one person, shared the same way
functions/_shell.js        a static page with a head and an answer written
                           in, shared by the five Functions that serve one
functions/list/[id].js     /list/<id> — the page a shared link opens
functions/lists/index.js   /lists — everybody's, most opened first
functions/lists/public.js  /lists/public — a 301 to the address above, which
                           this page had before it was shortened
functions/lists/kept.js    /lists/kept — a 301 to the same, which it had
                           before that
functions/u/[name].js      /u/<name> — the page a byline leads to
lists.html                 the one a stranger reads, everybody's, and whoever
                           wrote one; the address itself sends you to the page
                           below
assets/lists.js            all three of those; no map, no Leaflet
assets/lists.css           what a list page has and the map does not, and the
                           furniture the account page is built from too
account.html               your name, your saved places, your lists, the
                           ones you kept, and everybody else's
assets/account.js          all three of its states; no stylesheet of its own
split.html                 splitwise, at /split and at the root of
                           splitwise.tallinntastebuds.ee
assets/split.js            all four of its states, the second sign-in form on
                           the site, and the reason there is one
assets/split.css           what a column of money needs and the other pages
                           do not
data/split.json            that page's strings, in the same ten languages —
                           its own file so that deleting the feature is
                           deleting files
flashcard.html             flashcards, at /flashcard and at the root of
                           flashcard.tallinntastebuds.ee; served by the route
                           above, which writes a deck's words into it
assets/flashcard.js        its five states, and the third sign-in form on the
                           site — the header says what would end that
assets/flashcard.css       the card that turns over, and nothing else the
                           other pages already have
data/decks.json            forty-two decks of Estonian, 1,960 cards at three
                           levels; content rather than interface, and written
                           in three languages rather than the site's ten
blog.html                  a post per thing this site does   } unlinked, and
assets/blog.js             the index, one post, and the walk  } indexed on
assets/blog.css            only what a page of prose has      } purpose
data/blog.json             the posts
feedback.html              what people would change about this site, at
                           /feedback and behind the last pill on the rail
assets/feedback.js         every state of it, and the one sign-in form that is
                           not a sheet
assets/feedback.css        the sentence, the line under it, and the heart
functions/api/feedback.js  reading a page of it, saying one, hearting one,
                           taking your own down
functions/api/_account.js  the account rules that route and account.js both
                           read — the name, the password, the hold, the
                           slow-down, the step that makes or enters an
                           account, and the one that names a Google account
                           arriving without one (not a route: leading _)
clips/                     GENERATED — the looping clip on each post, and the
clips/scenes/              scenes, made of the site's own components, that
                           tools/blogclips.mjs draws them from
tools/blogclips.mjs        one frame a launch, diffed, written as one APNG
google.html                Google's directory of the city   } unlinked and
assets/venues.js           search, five filters, four orders } noindex
assets/venues.css          only what a directory has and the map does not
stats.html                 which places get opened and which  } unlinked and
assets/stats.js            chips get pressed: three rankings  } noindex
assets/stats.css           the rows of a ranking, and nothing else
functions/api/stats.js     /api/stats — one press in, the whole ranking out,
                           with the page's words and five minutes of cache
assets/pins.js             the eight markers, the five kinds of place, the six
                           tones, and which of them a place draws — said once
                           for every page that draws a pin
functions/api/_pins.js     the same ids, on the side that decides whether a
                           list may store them (not a route: leading _)
assets/basemap.js          the CARTO tiles, said once for every map that draws them
assets/track.js            what a press reports to Google Analytics, said once
                           for every page that has a button
assets/radio.js            the station, and the on/off that survives a navigation
assets/ask.js              a typed sentence read as a wish, for when the model
                           cannot: no DOM, no state, one global
functions/api/ask.js       the chat box answered — a model on the free
                           allowance, and Google's opening hours
db/schema.sql              the tables those Functions talk to
wrangler.toml              the D1 bindings, one per environment (secrets are NOT in here)
deal.html                  the guest's discount pass          } all three are
verify.html                what a waiter sees after scanning  } unlinked and
staff.html                 the current code, for the counter  } noindex
assets/pass.js             hourly code and the drawn rate, shared by those three and the map
functions/api/pass.js      who may hold a pass, and what it drew — the one
                           Function the pass pages need
assets/pass.css            styles for those three
assets/qr.js              QR encoder, written out, no dependency
assets/logo/               the mark, the painting it came out of, and the two
                           share cards — og.jpg for the site, og-flashcard.png
                           for the page that is not about the map
assets/deal.js             ) one small script
assets/verify.js           ) per page
assets/staff.js            )
data/restaurants.json      the only file you edit regularly
data/places.csv            the Google Maps export a list picks from (yours to drop in)
data/places.json           the catalogue: the map plus that CSV — GENERATED
data/city.json             the ground under every list's panel on /lists, out of
                           the export below — GENERATED
exports/tallinn_restaurants.csv    1,110 Tallinn venues out of Google Places
exports/README.md          what was cleaned out of the raw export, and why
exports/clean_restaurants_csv.py   the cleaning, from the upstream export
exports/REVIEW.md          the shortlisting worksheet those rows are read
exports/build_review_sheet.py      through, and the script that builds it
db/google-venues.sql       GENERATED — loads that export into D1
db/google-lists.sql        GENERATED — the five top tens under `google-statistics`
db/type-lists.sql          GENERATED — the thirteen filter chips as lists, under
                           `tallinntastebuds`
data/taxonomy.json         the controlled vocabulary of types
data/cuisines.json         the 37 cuisines only the directory needs, in ten
                           languages — taxonomy.json holds the other six
data/ui.json               every interface string, in every language
data/radio.json            the stations, by language and a default
data/deals.json            the discounts, and which of them are live
data/stories.json          the stories, when each goes up and when it goes away
data/schema.json           JSON Schema, for editor autocomplete
admin.html                 the admin door, self-contained and unlinked
_headers                   caching and the noindex on the unlinked pages
_routes.json               which paths reach the Functions, and which never do
robots.txt                 what a crawler is told not to
sitemap.xml                GENERATED — every address a crawler is told about:
                           the map in ten languages, every open place, /lists,
                           /blog, the thirteen chip lists and Google's five
indexnow.txt               the IndexNow key, public on purpose — see
                           tools/indexnow.mjs
photos/<restaurant-id>/    photos, one folder per place
stories/                   the story videos and photos, one file each
tools/validate.mjs         dependency-free data validator
tools/places.mjs           builds data/places.json from the CSV and the map
tools/city.mjs             turns the same export into data/city.json, the city
                           under every list's panel
tools/googlevenues.mjs     turns the Google Places export into db/google-venues.sql
tools/googlelists.mjs      ranks the same export into db/google-lists.sql
tools/typelists.mjs        turns the map's filter chips into db/type-lists.sql
tools/sitemap.mjs          writes sitemap.xml from the languages, the places
                           and the eighteen lists the site wrote
tools/indexnow.mjs         submits every address in it to Bing once each deploy
                           is live
tools/stamp.mjs            writes the ?v= content hash on every asset URL
tools/clock.mjs            Tallinn wall clock, and the 36 hours a story stands
tools/stories.mjs          the story queue: what is up, schedule one, tick
tools/storymedia.mjs       makes every story video an H.264 MP4 a browser will play
tools/qrperf.mjs           checks the QR encoder still draws the same code, and times it
tools/ogcard.mjs           draws assets/logo/og-flashcard.png, the card a link to
                           the flashcards unfurls as, out of the page's own CSS
.github/workflows/validate.yml     the validator, the QR check and the write gate, on every push
.github/workflows/indexnow.yml     the IndexNow ping, on every push to the production branch
.github/workflows/stories.yml      the hourly tick, and the tidying up after it
.github/workflows/story-media.yml  converts a video posted from a phone
.github/workflows/deploy.yml       GitHub Pages, manual only — NOT the live host
```

Deep links: `?spot=f-hoone` opens that place directly — that is the link to put
in a Story, and it is also that place's own address in a search, served with
its own head; see **A place is an address** under **Getting found**.
`?lang=ru` opens it in Russian — and is the address the Russian map is
indexed at, see **Each language is an address** — `?style=green` in the dark
palette. `?list=top-ten-burgers-k3fmqw` opens the map on somebody's list, as
pins with the list in the panel. They all combine, and all four stay in the
address bar, because each of them says what the page currently is.

The ones that do not stay are doors rather than states, and they take
themselves back off on the way in. `?story=kokomo-brunch` opens a story rather
than a place — a link copied later should not reopen a video that has since
gone. `?account=up&then=/account.html` opens the account sheet on a view and
says where to put somebody once they are signed in; it is how the account page
borrows the map's sign-in form, and leaving it on would reopen the sign-up sheet for
whoever the link was sent to. `?at=` rides with `?list=` and names the place a
row on that list's own page was pressed on: the map arrives standing on it,
and the address bar is left saying `?list=` — which is what is on the screen.
See **Lists**.

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

On the map it *is* the pin — for the seventy-five places on it. Every one of
them is the mouth, cropped round, drawn at 22px — 34px for the one whose panel
is open, and 17px for the quietest of them. It used to go on the chosen pin
alone, over a circle, on the reasoning that a picture inside a 14px dot is mud.
That was true of a 14px dot. At 22px the crop reads, and the map stops being
seventy anonymous circles with one photograph parked among them.

Everything else the map can draw — a place off Google's export, a place
somebody put on a list — wears a glyph instead, and that boundary is the
point rather than a detail of it. The mouth is this site saying it has eaten
somewhere; nothing a stranger types can hand it out. See **The pins**.

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

## The pins

The mark goes on a place I have eaten at. Everything else on the map wears a
picture of what it is, or a picture the person whose list it is chose.

Three rules, in this order, and the order is the whole feature:

| The place | The pin |
| --- | --- |
| on my map | **the mark** — the mouth, always, whatever list it is on |
| on a list | that list's chosen **marker**, in the style's accent |
| anything else off Google's export | the glyph for **what kind of place it is** |

`pinOf()` in `assets/app.js` is those three lines, and `assets/pins.js` holds
the two tables behind them.

### The mouth is not a choice

The picker has eight markers on it and the mark is not one of them. It is
not in `TTBPins.GLYPHS`, `cleanPin()` in `functions/api/_pins.js` refuses it
on the way in, and `node tools/validate.mjs` fails the build if `mark` ever
turns up in either table — three answers to the same question, because this
is the one thing on the site that has to survive somebody hand-writing a
request.

That is not fussiness about a decoration. The map is seventy-five places I
have been to, and being on it is the verdict; a list is somebody saying they
liked somewhere, which is a much smaller claim and a claim about themselves.
If a list could put the mouth on a restaurant, those two sentences would be
the same sentence. So a top ten with three of my places on it draws three
mouths among seven of whatever its owner chose, and that reads as what it is:
partly approved, mostly recommended.

The picker says so in words under it — `listsPinMark`, in ten languages —
rather than leaving somebody to work it out from a map where two of their
pins came out wrong.

### Two tables, and they do not overlap

A list wears a **marker**. A Google row wears a **kind of place**. They are
separate lists in `assets/pins.js` — `MARKERS` and `PLACES` — and no id is in
both, which `node tools/validate.mjs` enforces.

That split is the second version of this. The first had one table of eighteen
food glyphs and let a list pick any of them, which meant a list wearing a
croissant put a croissant on a sushi place. That reads as the map being wrong
about the sushi place rather than as the list being somebody's, and it is the
wrong thing for a list to be able to say: a list is a choice of places, not a
claim about what any one of them cooks.

So the markers say nothing about food at all. They mark a spot — which is the
one thing that is true of all ten places on a top ten.

| 📍 pin | 🚩 flag | 🔥 flame | ☀️ sun | ❤️ heart | 🌸 blossom | 💎 gem | 🎈 balloon |
| --- | --- | --- | --- | --- | --- | --- | --- |

Eight, and it was eighteen for an afternoon. A grid of eighteen is a decision
to make before you can name your list, and the ones that went were the ones
nobody would miss: a trophy and a crown say the same thing, a butterfly and a
clover say nothing at all. What is left is one of each — a place, a claim, a
warning, a brightness, a love, a prettiness, a treasure, a party. 📍 is what
an undressed list draws.

**And no colour beside them.** There were six tone swatches under the grid,
also for an afternoon, and they were a second decision to make before you
could name a list — for a difference the marker was already making. Every
marker draws in the style's accent now, which is the colour of everything
else on this site that is a link or a pin, and a list is one column and one
press.

All eight on one line at every width. The columns are fractions rather than a
fixed 38px, because eight fixed ones come to 332px — eight more than a 390px
phone leaves inside that card, and enough to make a 360px one scroll
sideways. As fractions they are 38px on a desk and about 33px on the
narrowest phone, which is still a picture and still a finger-sized target.

### The five kinds of place

What a Google row is read as, and never something anybody picks:

| | | of the 1,110 |
| --- | --- | --- |
| 🍴 | somewhere you sit and eat | 547 · 49% |
| ☕ | coffee or tea | 202 · 18% |
| 🍺 | a bar or a pub | 160 · 14% |
| 🍔 | a counter you queue at | 135 · 12% |
| 🥐 | something baked | 66 · 6% |

Five and not thirty-eight, because the question a pin on a map answers is
*what is this door*, and a Thai restaurant, a pizzeria and a steakhouse are
three cuisines and one kind of door. The thirty-eight kitchens still exist and
the directory still filters on every one of them — they are words under a
card, which is where a word that exact belongs. It is also the split Google
Maps itself draws, in this site's two palettes rather than in Google's one.

The eighteen ice cream, chocolate and dessert shops land in 🥐, which is where
a sweet thing you take away belongs. No cuisine id names them, and inventing
one would mean putting a chip on the directory in order to serve a pin.
Fifteen rows in the export are not eating places at all — two bookshops, a
barber, a toy shop, an axe-throwing club — and they draw 🍴 like anything else
Google has nothing more exact to say about. `hidden` in `google_venues` is the
lever for those, and it is a curation decision rather than a pin one.

`KINDS` in `assets/pins.js` is the whole mapping, and it is six lines: the
kitchens that name a kind of door — `coffee`, `bar`, `pub`, `fast-food`,
`burgers`, `bakery` — and everything else is somewhere you sit and eat.

### Why emoji

They cost nothing — no file, no sprite, no request, no thirteenth thing to
re-render when a size changes — and everybody already knows what they mean, in
ten languages, with no legend. The price is real: the picture is the reader's
own platform's, so a croissant is Apple's on an iPhone and Google's on a Pixel
and neither of them is ours. That trade is the wrong one for the mark, which
is why the mark is a photograph and is in neither table. It is the right one
for a marker somebody picks out of a grid.

The eight markers have names in all ten languages, because a swatch needs a
label and a tooltip: `pinFlame`, `pinBlossom` and the rest. The picker builds
those keys out of the id — `pinKey('flame')` — which means the validator's
scanner for `t()` calls cannot see a single one of them, so it walks the same
list and checks them itself. See **What the validator checks**. The five kinds
of place have no names, and want none: they are `aria-hidden` everywhere they
are drawn, because the card beside them already says the kind in words.

### Two colour worlds, and three tones inside each

The site has two colour worlds, Red and Forest, and pressing the swatch moves
the whole of one to the other. A pin has to belong to whichever it is standing
in, so a tone is a **name** and never a value: `--pin-sea` is one thing in
`[data-style="red"]` and another in `[data-style="green"]`, and a pin gets the
right one on both without knowing either.

| Tone | What it is for |
| --- | --- |
| `accent` | somewhere you sit and eat, and every marker a list wears — the style's own accent, so it leans on `--accent` rather than restating it |
| `sea` | somewhere you drink |
| `amber` | something baked |

Three, and three is not a shortage: it is exactly what a five-pixel dot on the
directory's map can carry, which is the only place a tone is doing work a
glyph cannot. A Google row takes the tone of the kind it was read into, so the
drinking half of the city is visibly a different colour from the eating half
before a word has been read. A list's marker is the accent, always — the
picture is the difference, and a colour behind it was a second decision for no
second meaning.

Three states outrank a choice, and all three are about the map rather than
about the place: **shut for good** is muted, **open** and **the one you last
had open** are `--accent-lit`. `dressPin()` sets `--pin-tone` inline for those
and removes it otherwise, and an inline custom property beats a class — which
is the whole of how they win, without either half knowing about the other.

### What a glyph pin is not

It is not one of the three readings. Filmed, photographed and write-up-only
are three amounts of *my* writing about a place — see **The mark** — and a
place off Google's export has none of them. It used to draw as the quietest
of the three, at 17px and four-fifths opacity, which was the map calling
somebody's whole top ten the thing it had least to say about. A glyph pin
keeps the full 22px and a plain collar in its own tone, at full strength, and
the three readings go on meaning what they have always meant about the places
they are about.

`pinDepth()` still labels every pin, glyph ones included, because a stand-in
becomes a place of mine the day I eat there.

### Where a list wears its own

Everywhere a list is named, which is four pages and the map: its own at
`/list/<id>`, everybody's at `/lists`, its author's at `/u/<name>`, yours on
`/account.html`, and the band across the top of the map's panel for as long as
`/?list=<id>` is what the map is showing. The glyph sits in front of the title,
and on `/lists` — on a desk, where there is room for the panel — it is also
what each of the list's places is drawn as in the panel above it, so a page of
twenty is twenty constellations rather than twenty identical red ones, and the
bakeries one is found without reading a word. See **Public lists** for where
that panel comes from and why a phone draws none.

On the map it says something the four pages cannot: the pins under the band
are already wearing that glyph, so the name and what is drawn under it are one
picture rather than two things that happen to be on screen at the same time.
Which is also why the emblem is a rule in `assets/styles.css` rather than in
`assets/lists.css`, where it began — the four pages load both files and the
map loads only the first, and a pin written out twice is how two pages come to
draw the same list differently.

It is `aria-hidden` in every one of those places. The title beside it already
says what the list is, in its author's own words; a screen reader announcing
"croissant, the bakeries worth the walk" is a decoration read aloud. The
picker is where the eight have names.

On your own list's card there is no emblem, because the picker is on it and a
picker showing the chosen pin is the emblem.

### The two columns, and the afternoon they do not exist

`lists.pin`, `TEXT NOT NULL DEFAULT ''`, and nothing beside it — a marker is
the whole of what a list chooses. Empty is a list nobody has dressed and is
deliberately **not** the same as having chosen the default: the default lives
in `assets/pins.js` and is applied when the page draws, so changing it one day
is a change to that file rather than a write to everybody's lists.

Every statement in `db/schema.sql` is `CREATE TABLE IF NOT EXISTS`, which adds
no column to a table that already exists, so it reaches the deployed databases
by hand, exactly as `users.about` did:

```
ALTER TABLE lists ADD COLUMN pin TEXT NOT NULL DEFAULT '';
```

Which means there is an afternoon — between the deploy and somebody running
that line — when the code wants a column the database has not got. Five reads
and one write would 500 through it. `readingPins()` in
`functions/api/_pins.js` is the answer: the first read of an isolate asks for
them, "no such column" decides it for every read after, and the statement is
built without them meanwhile. One failed statement per isolate where they are
missing, none where they are not. Any other failure is rethrown, because a
database that is down should look like a database that is down rather than
like a list with a plain pin.

The write goes through the same reader and drops the same two assignments:
somebody renaming a list on that afternoon should not lose the rename over a
pin. Driven under `wrangler pages dev` against a database built without the
two columns: reading a list, the index, a profile and `/lists` all answered
200 with an empty pin, a pressed swatch came back `ok` and stored nothing, and
a rename sent in the same request as a pin still landed.

The one cost is that an isolate which has answered "no" holds that for its
life, so running the ALTER does not light every pin up at once — isolates that
had already decided go on drawing plain ones until they are recycled, which a
deploy does and idling does anyway. Minutes rather than an afternoon, and
nothing is lost: the swatch is sent again the next time it is pressed. **Run
the two lines with the deploy rather than after it**, and there is no window
at all.

### The table is written out twice

`functions/api/_pins.js` holds the ids, because the server is what decides
whether the two strings a list wants to store are real. `assets/pins.js`
holds the same ids plus the emoji each draws and the table that reads a
Google row's kinds into one of them, because the browser is what draws them.
Neither can import the other — one is ESM on the Workers runtime and the other
is ES5 served raw — so they are written out separately, the way the story
clock in `assets/app.js` restates `tools/clock.mjs`.

Change one, change the other. `node tools/validate.mjs` fails the build when
the two sets of ids drift, when a kind of place is also something a list could
pick, when a tone has no `--pin-<tone>` token or no `.pin-tone-<tone>` rule
behind it, or when a marker has no name in ten languages — so the promise is
kept by something other than a comment asking nicely.

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
button naming the new one. Switching a moment after pressing play, while a
live stream is still connecting, is the same switch: the `play()` the new
station interrupts rejects with an `AbortError`, and that rejection is the
script's own doing rather than the stream's, so it is ignored. For a while it
was read as the stream failing, and the switch turned the radio off with a
toast saying it would not start, over a station that had.

Delete the file, or empty it, and the button never appears at all.

The button wears the station's name for the first few seconds and again
whenever you press play — on a phone always, and on a desktop whenever the
pointer is anywhere but the left of the window, where the rail keeps its words
out. See
[The rail introduces itself on a phone](#the-rail-introduces-itself-on-a-phone).
A station with no `name` gets no label and stays a play triangle.

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
every browser and that is right: it plays because somebody asked it to — see
**It keeps playing when you walk to a list** for what that means once there is
more than one page to ask it on.

If the stream fails — it would not start, or it ended, which for a live
stream means its server hung up — the button resets and says so in a toast. If
the URL dies for good, it is one line in this file, which is the same
maintenance the rest of the map asks for.

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

### It keeps playing when you walk to a list

The map and the lists are two documents, and a navigation between them tears
the first one down — audio element, stream and all. So the radio used to stop
dead the moment somebody opened a list, which is not what a radio is: it plays
until you turn it off.

It cannot be the same element on both pages, so it is the same station and the
same on or off. `assets/radio.js` holds all three — the station list, the
`<audio>` and the switch — and writes on or off to `sessionStorage` under
`ttb.radio`, and the station that was playing under `ttb.radio.station`. The
next page rejoins that stream where it now is. A live stream has no position
to resume from, so there is nothing else to carry across.

It rejoins the moment `radio.js` runs, before the page has fetched anything
of its own. Every page mounts the button only once its data is in — the
account page after `ui.json`, the catalogue and two answers from the
database, the map after the whole catalogue — and for a while the radio
waited on all of that too, so the silence between two pages was the second
page's whole boot, a second or more on a phone, rather than the reconnect it
was meant to be. The station is the only thing the rejoin needs and the last
page wrote it down. The button catches up when the page mounts it, and if
the page turns out to be reading in a language with a station of its own —
somebody who changed language on the way, by `?lang=` — the station changes
under it then, as a language switch does. What is left of the seam is the
navigation and the stream connecting, and neither is the script's to
shorten: a page is a document, and a document that goes takes its `<audio>`
with it. A radio with no seam at all would mean one document for the whole
site, which is not the shape this site is.

`sessionStorage` and not `localStorage`, deliberately. The tab that was playing
keeps playing, and a visit tomorrow opens silent — the same judgement as the
autoplay rule above, and the same reason.

The browser holds that rule harder than we do. A fresh document has no gesture
behind it, so `play()` on arrival is refused unless the browser has decided
this is a site the visitor plays sound on: Chrome usually has by then, Safari
and Firefox usually have not. A refusal here is not a failure — somebody did
press play, one page ago — so nothing is reset and nothing is said. The button
stays on and the stream starts on the first tap or keypress anywhere on the
new page, which in practice is the tap that opens the list they came for.

**The first tap, and not the first one that arrives late enough.** For the
opening moments of a page there is a wait with nothing to end it:
`data/radio.json` is still in the air, and the page has not yet said which
language it reads in. Asking which station to play in that window gets either
no answer at all, or the wrong one — `stationFor('')` does not mean "no
station", it falls through to the default, because falling through is what the
default is for. So a tap that landed there started Raadio Tallinn for somebody
reading in Russian, and had the station swapped out from under them a second
later when the page finally said `ru`; and a tap that landed a moment earlier
still started nothing at all and spent the wait, leaving the music to arrive
only once the page had finished booting — on the map, its whole catalogue.
It did arrive: a spent tap still leaves a gesture behind it, so the page's own
start() is allowed when it finally runs. It arrived late. Measured in Chromium
against a station answering in 200ms, touching the page 150ms in with the
button mounting at two seconds: 2.06s from the touch to the music, against
0.26s now that the touch is what starts it.

Both halves are answered the same way. The station to play is the page's once
the page has said which language it reads in, and until then it is the one the
last page wrote down — which is the one that was actually playing, and is what
the rejoin itself starts from, so neither depends on a fetch having landed. A
tap that still has nothing to start on leaves the listeners where they are for
the next one rather than ending a wait it could not have ended.

**A scroll is not that tap, and nothing can make it one.** When a finger
turns out to be scrolling, the browser takes the pointer for itself and the
sequence ends in `pointercancel`; there is no `pointerup` to listen for, and
a `play()` hung off the `touchend` it does send is refused too — measured in
Chromium, which is the browser that grants a walk between pages the most. So
somebody who lands on a page of lists and only reads it hears nothing. That
is the browser's rule about sound rather than something to route around, and
what the radio owes them instead is the paragraph below.

It is the end of that tap that does it. A finger going down is not a gesture
to a browser — the events that count are a key going down, a mouse button
going down, and a pointer or a touch coming *up* — and for a while the script
listened for the finger going down. Chrome counts that as well, so the radio
came back on Android and on every desktop; a browser that holds to the list,
Safari on an iPhone among them, refused that `play()` as it had refused the
one on arrival, and the radio stayed silent behind a button that said it was
on until it was pressed off and on again. It listens for the pointer coming
up now.

**And the one press that listener does not answer is the press on the
button.** A pointerup is delivered before the click it becomes, so a visitor
pressing a switch that said on over silence had the stream started by the
listener and turned straight off again by the click — one press for a frame
of sound and an off switch, two to actually hear anything. That is the same
two-press trap one paragraph up, reached by the obvious road rather than an
iPhone's, and every walk from the map to a list ran into it whenever the
browser refused the rejoin. So a press that lands on the button is left to
`toggle()`, which knows the radio is on and silent and starts the stream
instead of stopping it; the switch does not move, because it was already on
and nothing about it changed. A second press turns it off, as it always did.

**And "on and silent" has to really be silent, which nothing was checking.**
The wait is armed when a `play()` is refused, and until this change nothing
took it down again except a tap. So when the refused rejoin was followed a
second later by a `play()` the browser *did* allow — Chrome makes its mind up
about a site somewhere between one call and the next — the stream came up with
the wait still standing, and the next press of the switch went to the branch
above and was read as the gesture it had been waiting for. The radio was
already playing, so the press did nothing at all, and it took two to stop a
radio: the same trap as two presses to start one, met coming the other way.
Measured on the blog page in Chromium. A `play()` that succeeds now ends the
wait, so that branch only ever sees a radio that is genuinely silent.

Five other pages wear the same button in their headers: the lists, the account
page, the blog, the feedback page and the flashcards. The map's pill and the
same press to stop — the map's control on a page that has no rail, rather than
a second design for one switch — and `/list/<id>` gets it too, so somebody
reading a list a friend sent them can put the radio on from there. What is on
screen there is the icon alone: the station's name is in the button, but the
label it sits in is opened by the rail, and a page with no rail never opens it.
That is the disc the rail collapses to on a phone, and the same disc on a
desktop with a mouse.

The flashcards are the first of them on a hostname of its own, and what that
costs is the walk. `sessionStorage` belongs to an origin, so a radio playing on
the map is still playing at `/flashcard` and does not arrive at
flashcard.tallinntastebuds.ee at all: the switch there opens off, and the press
that starts a station is made on the page. It is the same line that leaves
`ttb.lang` empty there and is why that page has a language switch of its own —
see **A language of your own to learn it in** under **Flashcards**. Nothing is
done about it, because a subdomain is a different site to a browser and the
alternative is a page asking the map what it was playing.

**And once that press is made, that page has no seam at all.** It is the one
place on the site where the paragraph above does not apply, because opening a
deck and coming back out of it stopped being a page load: both of its addresses
draw out of the same `<main>`, and the script pushes the address rather than
following the link — see **Opening a deck does not load the page** under
**Flashcards**. That matters more there than anywhere else, because a sitting
with the flashcards is a dozen of those walks in twenty minutes, each of them
the reconnect this section spends its length trying to shorten, and the tap
that would have answered a refusal was itself the next walk. The blog does the
same between its index and a post, and for the same reason. The map and the
lists do not and will not: a page is a document, and those two are genuinely
different documents.

The three pass pages do not carry it. `deal.html`, `verify.html` and
`staff.html` are scanned at a table rather than browsed, and a discount that
started playing music would be a surprise nobody asked for. The radio goes
quiet while one of them is open and comes back on the next page that has the
button, because the switch is still on.

Opening a story stops it outright rather than pausing it: two things playing
at once is one too many. The switch is left off, so it stays off when the
visitor walks on — turning the radio down for a story is a decision about the
radio rather than about the page it was made on.

### The button follows the phone

A phone call pauses whatever is playing, and so does the pause button on the
lock screen, and so does pulling the headphones out. None of that goes through
the button, and for a while the button did not know: it went on showing the
radio on over a stream the phone had stopped, and getting it back took two
presses — one to turn off a radio that was already silent, one to turn it on.

Whether the stream comes back on its own after a call depends on the phone.
Chrome on Android picks it up again once the call ends; Safari on an iPhone
leaves it paused. So the button does not guess. The `<audio>` element says
when it has been paused and when it is playing again, and the switch follows
it both ways: off on the pause, on again if the browser or the lock screen
brings the stream back, and otherwise one press, which rejoins the stream
live rather than un-pausing a buffer from before the call. The switch in
`sessionStorage` follows too, so a radio a call silenced stays silent on the
next page, which is what its button was showing.

The pauses `assets/radio.js` causes itself — a press to stop, a story opening,
the source being swapped under a language switch — are told apart from the
phone's by the state of the element when the event arrives, not by a flag:
the switch is already off for the first two, and for the third the element is
already playing again. Only a pause from outside leaves it paused.

## Surprise me

The die on the left rail — under the account and the lists, at the top of the
six that are about tonight rather than about you or about anybody else's
writing — picks a place at random and opens it.

It picks from **whatever the chips currently allow**, so selecting "Korean" and
"Cheap eats" and then pressing it answers the question you were actually
asking. Closed places are never suggested, and the same place is never returned
twice in a row.

It lives on the left rail rather than in the bottom filter row because the
filter row scrolls sideways once the vocabulary is wide, and a button that
scrolls out of reach is no use.

**On a phone it opens the place at the low stop, and this is the button that
argued for it.** The name means nothing to you yet, and the first thing you
want back is not the write-up but whether the place is round the corner or out
in Lasnamäe — and the sheet at its full height was standing on the only thing
that could tell you, leaving the pin it had just flown to crushed into the
110px strip along the top of the screen, under the brand card. The low stop
keeps the map's half, with the pin in the middle of it wearing its name and its
halo.

It also keeps the rail on screen, which matters more here than anywhere else:
the rail is hidden behind a full sheet, and the one button a surprise you do
not fancy wants is the die that rolls it again. So it can be pressed
repeatedly, and it goes on answering in the same place with the map still under
it.

None of that turned out to be special to a roll — *where is it* is half of what
tapping a pin asks too — so it is where every place opens now, and this button
picks a name and calls `selectPlace()` like anything else. **The sheet** in the
design notes has that argument.

### The rail introduces itself on a phone

The rail runs the account, everybody's lists, Surprise me, Ask, the colour
swatch, the locate button and, last, How this works — who you are and what
everybody else has written, then the ones that change your evening, then the
one that changes the map, then the one that is about the rest, because a
rail that opens with a colour picker reads as a settings strip rather than as
the shortcut it is. The radio left it for the corner beside the language
switch, in the same pill the lists, account, blog and feedback pages already
stand it in — see **The radio** below. The lists pill is the one that is a
link rather than a press, and the only one wearing an emoji rather than a
drawing: see **Two
doors to the lists** under **Lists**.

On a phone it used to arrive as a column of bare discs: a head and shoulders,
a die, a speech bubble, a play triangle, a coloured dot, a crosshair and a
question mark over a map, saying nothing. A phone has no hover, so the `title`
that carries the meaning on a desktop is never read out loud, and people did
not press them.

So they say what they are on arrival and then stop saying it. Each opens
wearing its label — your username or "Account", "Everybody's lists", Surprise
me, Ask, the style you are about to switch to, "Show my location", "How this
works" —
300ms apart in the order they are stacked, so the eye tracks down the rail
rather than being asked to read the whole column at once. Each holds for
`HINT_MS` (4.2 seconds) and collapses back to its icon, the same disc as
before.

The account button is the one the rail has to wait for, and the lists pill
under it waits on the same answer. They lead the cascade and they are the two
buttons not in the markup until the network says so: both are drawn by an
answer from `/api/account`. So the introduction holds for that answer, up to
`RAIL_WAIT_MS` (1.4 seconds), and then runs with the account at its head. A
pill that opens after the ones below it and closes before they do reads as
the last thing on the rail rather than the first, and on a fast answer it was
up and gone again before the eye had got down the rail.

The wait is capped because it has to be: a slow endpoint, an unbound database
or no Function at all must not cost the other six their labels. So an answer
slower than the hold gets the old behaviour — `paintAccountButton()` and
`paintListsButton()` open the label the moment their button appears, rather
than leaving a silent disc above a column of pills that have all had their
say — and an answer that never comes leaves a rail of six that introduced
itself on time.

**The chip row says itself too, and it is the one that cannot do it with a
label.** On a phone every filter this map has is folded behind the single word
Filters — thirteen types and the discount, a whole feature behind a button
that names none of it — and a visitor who never presses that button never
finds out the map narrows at all. The rail pills at least draw their own icon;
Filters draws three lines and a word. So the drawer rolls out with the
cascade and holds for `HINT_MS`, the same 4.2 seconds a pill holds its label,
and rolls back.

It rolls out with the *first* pill rather than after the last. The row sits
above the rail on the screen, so the introduction still reads top to bottom,
and the rail's own arithmetic — eight pills 300ms apart against the sentence's
7.6 seconds, the last of them collapsing at 7.45 — is left exactly where it
was.

**And the whole of it is a phone's.** `introduceRail()` asks `isNarrow()`
before anything else and returns above 860px. Up there the chip row is already
flat on the map, so there is no drawer to roll; the labels are either up all
visit, on a desktop with no hover, or a hand's width of mouse away on one with
— and a corner that opens itself on arrival and shuts again seven seconds
later is then twice the movement for an answer that was already there. It ran
at every width for a few days and this is the correction. See
**And on a desktop the corner steps back until you go for it** below.

Rolling it back is the part that needs care, because shutting the drawer on a
phone is `clearChips()` — that is the rule the drawer rests on, that a shut row
can never be a filtered map. So `showChipRow()` and `hideChipRow()` roll back
only a row they rolled out, and only while nothing is pressed in it: a visitor
who arrived on `?type=bakery` has the row open already with their chip in it,
and one who presses a chip during the four seconds keeps both the chip and the
row it is in. The same pair does the same job for the walk, below.

One of them says something again when pressed: pressing the swatch opens the
name of the style it has just become the way back to. Surprise me and Ask do
the opposite and shut their own label early — the question each of them
answers is the question its label was there to ask, and each shuts its own:
pressing one of the two is not an answer to the other. How this works shuts
all of them, the arrival sentence included, because the walk it starts opens
the labels it wants itself and two introductions talking at once is neither.
The radio does the same trick from outside this cascade now — starting it
still opens the station's name, so a triangle in a circle is not the only
thing saying what is playing — because `openHint()` and `closeHint()` answer
to the button by its key whichever corner it stands in. See **The radio**
below.

**It repeats in the new language when you switch languages.** Every other
label on the page changes in front of you; the ones on the rail are the only
ones not on screen to change with them, and somebody switching to Ukrainian is
telling you they did not read the English one. So `setLanguage()` runs the
introduction again. It repaints the account button first: the language sweep
puts the word "Account" back on it through `data-i18n`, which is the right
word for a stranger and the wrong one for somebody whose name was on it a
moment ago.

**And it runs once.** The introduction is for a stranger, and the second
visit is not a stranger's: a map that explains the die every morning to
somebody who opens it every morning reads as a page that does not remember
them, and for a while that is what it did, the sentence, the nine pills and
the chip row on every arrival. So the cascade runs the first time this
browser opens the map, and `ttb.introduced` in `localStorage` records that
it did; a return visit gets the discs, the way the desktop always has. The
flag is written the moment the cascade actually runs rather than when it is
owed, so a visitor who arrived on a place link and left with the sheet still
up is introduced the next time, when they are looking at the map. And it is
read only on the way in: a language switch introduces the rail again
whatever the flag says, for the reason above. Storage that throws or was
cleared makes it a first visit again, which is the right failure — one
introduction too many rather than none.

Nothing opens while the sheet is up: the rail lies along the top of it as a
row there, and a pill at full width would push the buttons after it off the
side of the screen, and it is pointless behind the stories, where the rail is
not on screen at all. It is owed rather than dropped — `introPending` holds it,
`closePanel()` or `closeStories()` pays it — so a visitor who arrived on a
`?spot=` or `?story=` link, or who switched language while reading a place,
still gets the rail explained the first time they are actually looking at the
map. Pressing Surprise me is not owed anything: closing the place it opened
leaves the rail as it was.

`openHint()` / `closeHint()` in `assets/app.js` do the timing; the pill itself
is CSS. Every one of them is the same shape — an icon, then a track for the words that
grows from `0fr` to `1fr`, which an auto-width grid resolves against the
label's own max-content. A fixed ceiling in `ch` cannot do both halves of that
job: one wide enough for Ukrainian's `Показати моє місцезнаходження` makes
`Red` snap open in a tenth of the time, and one tuned to `Red` puts an
ellipsis through the label explaining the button. This way every language gets
the same slide and none of them gets cut — the widest of the sixty labels
reaches 276px on a 320px screen.

One rule covers all seven, because all seven are the same button: `.rail-btn`,
with an icon at the left and the label beside it — a coloured dot standing in
for the icon on the colour switch, which is what lets the switch wear the pill
instead of sitting in a case of its own.

**Every pill carries a label, at every width.** Three of them used to have one
and the two under them did not: a coloured dot in a round case of its own and a
crosshair in a second one, both mute, under three buttons that say what they
are. The argument for that was that a pointer can hover and read a `title`, and
that two more words down the left edge are two more than the map can spare —
but what it actually put on the screen was two things that looked unfinished,
and the eye counts labels before it counts jobs. So the swatch says which style
it is about to give you and the crosshair says *Show my location*, in the words
they were already carrying for the phone's sake, and the rail is one column of
one shape. The longest pill on the rail is Ukrainian's
`ПОКАЗАТИ МОЄ МІСЦЕЗНАХОДЖЕННЯ` at 267px, which is the width of the brand's
own column above it and a fifth of a 1280px window.

### And on a desktop the corner steps back until you go for it

That 267px is a fifth of the window, and until recently it stood there for as
long as the tab was open. So did the rest of the corner: the mark, the name,
the sentence and the handle above the rail, and every label down it — the
better part of 300px of ink over Tallinn, saying nothing new after the first
few seconds of being read. The map is what somebody came for and the column is
how they steer it, and a control wanted now and then should be quiet the rest
of the time.

So above 860px, **with a mouse**, a pointer gets the same bargain a phone
does, and hover does the asking. What stands in the corner is the mark, the
name beside it and the nine discs — the wordmark, and the pictures that say
this is a place and that one is a die — and the prose comes back the moment
the mouse comes into the left of the window.

**The name is not one of the things that go away.** It stood in the corner the
whole visit while the corner was a card, it stands there on a phone, and it
stands there now: a painting of a mouth in the top left says whose map this is
to somebody who has been here before and nothing at all to anybody else, and a
page whose title only appears when you wave at it does not have a title. What
steps back is the sentence under the name and the handle under that, which are
prose — read once, and then furniture. `wireRailReveal()` in `assets/app.js` draws the line and sets
`rail-open` on the body; the two states are the stylesheet's, under **the
corner steps back until you go for it**.

**Two things open it, and they are doing different jobs.**

The strip down the side of the window is the courtesy. A shut pill is 39.6px
across and the widest opens to 267px, so a column that waited to be hovered
would slide its labels out from under the pointer at the moment it arrived and
move every pill below it sideways as it landed. The strip opens at 300px,
which is drawn wider than the column ever gets — the widest pill reaches 283px
from the edge of the window and the brand's own measure 266px — so the words
are already there by the time the mouse is over them. It shuts again past
360px. Two numbers and not one, because a single line flickers: a pointer
resting on it jitters a pixel either way and the whole column opens and shuts
under the hand for as long as it sits there.

Being **over** the column is the guarantee, and it is not the same statement.
The strip is a number that has to stay wider than the labels, and the labels
are translations: seventeen pixels between the widest pill and the line is not
a margin to rest a rule on, and a longer word for *Show my location* in a
language nobody has added yet would put a pill out past 360px — where the
column would collapse out from under a pointer that was on one of its own
buttons. So the rail and the mark answer a hover in their own right, whatever
the arithmetic says. Reach any of the nine discs, or the mark above them, and
the whole column opens and stays open for as long as the pointer is on it.
Measured with a label stretched to 530px, which is a third of the window: the
pointer holds it open at 400px and at 480px, and it shuts at 560px, where the
pill actually ends.

**Nothing moves.** The words in the corner go out by opacity alone and their
boxes stay where they were, so the mark does not walk up the screen, the chip
row beside it does not shift, and `placeRail()` reads the same number whichever
state the corner is in and never has to run again. A corner that reflowed every
time a mouse crossed it would be worse than one that never closed. The pills
are the one exception and have to be — an empty pill is not a shut one, it is a
button somebody forgot to write on — so they collapse to the disc the phone
wears, at this side's size: a 21.6px icon with 8px of air each side is 39.6px
across, which is exactly the height the pill already stood at. The open pill
gives that pixel back on the right, so it is the same width it always was and
the icon holds still through the slide.

**And it does not happen without a mouse.** `(hover: hover) and (pointer:
fine)` is the whole of the condition, because a tablet in landscape and a
touchscreen laptop are both above 860px with no way to hover, and a label only
a hover can reach is a label they could never read. There the column keeps its
words the way it always has. A keyboard gets it too, from `:focus-visible`:
tab into the corner and it opens, because a focus ring round a disc with no
name beside it is the same mystery the introduction above was written to clear
up. A *mouse* press does not hold it open — clicking a pill focuses it as well,
and a corner pinned by the last thing pressed would be open for the rest of
the visit.

**And the arrival cascade does not run up here at all.** It drew nothing above
860px for as long as every label was already up; for a few days after the
corner learnt to keep to itself it drew the whole introduction, the corner
opening on arrival and emptying seven and a half seconds later; and it is off
again on purpose. On a machine where moving the mouse an inch to the left
opens the corner and holds it open, a corner that opens and shuts by itself is
twice the movement for a question nobody asked — and on a desktop with no
hover the labels never left, so there was nothing to introduce there either.
`introduceRail()` asks `isNarrow()` and returns, which puts the section above
back to being exactly what its title says: the rail introduces itself **on a
phone**. Nothing above 860px is ever `.hint-open` now except a pill the walk
is pointing at.

Next to last on the rail is the locate button, which frames you
together with the nearest place rather than dropping you at a fixed zoom on
whatever street you are standing in —
[A filter never answers with an empty screen](#a-filter-never-answers-with-an-empty-screen)
has the rest of it. It used to sit in the
far bottom-left corner — the free one, but also as far from every other map
control as the screen allows, so a thumb that had just pressed Surprise me had
the length of the page to travel. It wears the rail's own pill, so it reads as
one of its buttons rather than as a stray card parked beneath them.

The rail is vertically centred, and `placeRail()` in `assets/app.js` nudges it
down on short windows so it can never ride up under the brand — never so far
down that its own foot leaves the screen, which is the floor the locate button
used to provide by standing in the corner.

**It is asked again when a pill arrives.** The account and the lists door are
the only two that come and go, and `/api/account` draws them after the map has
settled — so the rail was being placed while it was seven pills tall and then
growing to nine under the answer, which re-centred it over the corner it had
just been measured clear of. On a window with room to spare nobody saw it; on
one without, the first pill landed on the handle. `paintAccountButton()` and
`paintListsButton()` now call `placeRail()` when the pill actually moved, which
is the only thing either of them does that changes the rail's height.

### How this works, for the asking

Everything above is an introduction that runs once, for a few seconds, and
only for somebody who happened to be looking at the rail when it ran. A
visitor who landed on a place, or on a story, or who spent the first ten
seconds looking at the pins, gets a map that never said whose pins they are
or what the buttons down the side do. The tagline under the mark says the
first half, briefly, and at every width since the corner started stepping
back; nothing on the page said the second half twice.

So the last pill on the rail is a question mark labelled **How this works**,
and pressing it walks the page rather than describing it. A cursor the size
of a thumb sets off from the button that was pressed and glides to each
thing in turn; a ring settles round it and breathes; and the mouth — the
mark, sitting on the top edge of a bubble like a face over a fence, rocking
gently while it talks — says what the thing is. **Next** sends the cursor
on, and so does a tap anywhere that is not the bubble; **Skip** ends it,
and so does Escape. The first version of this was a card of prose over the
map, which was the introduction as a document. This is it as a person,
which is what a first visitor is short of.

The walk, in order, and what each step is anchored to:

1. A pin — whichever is nearest the middle of the screen, or the bubble
   sits in the middle with no ring when none is on it.
2. The **Places** button on a phone, and above 860px the places column's own
   search field, since there is no button up there to point at: the whole map
   as a list, with the field at the top of it.
3. The language switcher.
4. The radio, next to it — left out when `data/radio.json` gave the
   language no station and the button never appeared.
5. The chip row, which on a phone the walk rolls out of the **Filters**
   button first, so that there is a row to point at.
6. **Surprise me**, with its label held open for as long as the step is up —
   which is every width where the pill is a disc: a phone always, and a
   desktop whenever the pointer is somewhere other than the corner.
7. **Ask**, the same way.
8. The account button, left out when `/api/account` never said accounts
   work — there is no button to point at.
9. **Everybody's lists**, straight after it, the way the two stand on the
   rail: what you keep, then what everybody else kept. Left out on the same
   answer, for the same reason.
10. The discount chip, second in the row after All — the row rolled out
    again for it on a phone; left out when no deal is on.

One step is about one thing. Surprise me and Ask used to share a step — the
ring round the die, both labels held open, one sentence saying what each
did — and a sentence introducing two buttons while pointing at one of them
read as one button with two names. Each has its own step now. The Places
button, the language switcher and the radio had no step at all, and a
visitor who had just been told what some of the buttons do was left to
guess at the rest; the walk now takes in everything on the page that a
first visitor might press, in the order it sits on the page: the pin, the
buttons top right, the filters, the rail from the top down, and last the
chip. The colour swatch and the locate button are the two it still passes
over: both are settings, both are plain on sight, and a walk that stops to
explain a crosshair is a walk that gets skipped.

Every step is about something that can be pressed. The walk used to open
on the mark, with the one sentence the site rests on set large in the
display face: every pin a place I have eaten at myself and approved,
nothing here because it paid to be. That sentence is the tagline, which
the page has already said under the mark, and a first step that points at
nothing to do and repeats what was just read is a step that gets skipped —
with the useful ones behind it. It went, and the walk opens on a pin.

**The two steps about the chips press their button first.** On a phone the
row is folded away, and a ring round a shut button under a sentence about
bakeries and bars explained the filters without ever showing one: the walk
named a feature and left it named, which is the one thing a walk ought to
be better than a paragraph at. So those two steps carry `drawer: true` —
the row rolls out under the cursor, the ring leaves the button and settles
on what came out of it, and it rolls shut again on the way to the next
step. That is also what lets the discount step ring the actual Discount
chip on a phone, the same target it has always had on a desktop, instead of
pointing at a button and asking you to imagine the chip behind it. It is
the same `showChipRow()` / `hideChipRow()` the arrival introduction uses, so
the same rule holds: a row with a chip pressed in it is never rolled back,
and a visitor who came in filtered still has their filter at **Got it**.

Every step points at something real on the page as it stands, which is why
the steps are functions and not co-ordinates, and why the pieces are put
back on every resize — and why the two steps above ask the row how wide it
is rather than asking the window: out, it is the row and the chip in it;
still folded, it is the button that is about to open it. Placing the step
twice is what makes that read as a press — once on the shut button, and
again once the drawer has finished its `CHIP_ROLL_MS`.

**A step about a rail pill is placed twice for the same reason.** Everything
in `showStep()` happens in one breath, so a ring drawn the instant the label
was told to open is a ring the size of the disc the pill still was — and it
stayed that size while the words slid out from under it, which on a phone hung
the label out of the side of the ring and on a desktop, where the bubble sits
beside the rail rather than under it, put the label behind the bubble
altogether. So `litPills()` waits out `PILL_SLIDE_MS` and places the step
again, and the ring, the bubble and the cursor land against the pill at the
width it has actually opened to.

Nothing under the walk can be pressed while it is up: the layer swallows the
taps, so the thing being pointed at is not opened mid-sentence — and the same
layer is why a tap anywhere outside the bubble is Next: on a phone, it is
there rather than a button the size of a word.

On a phone it introduces itself with the rest of the rail, last in the
cascade, and a question mark is the icon on the rail that says the least on
its own: a die at least looks like chance and a crosshair like a location,
where a question mark over a map could be help, an about page or a search.

The button is last because it is about the rest: a rail that opened with the
help button would be a rail saying it needs one. It is not opened by itself
on a first visit. The page already introduces itself once without being
asked, and a second unasked-for overlay on top of that is the kind of thing
that gets closed unread; a button pressed when it is wanted is the better
version of the same words.

The strings are `explainOpen` — the button — the ten `explainPin` …
`explainDiscount` lines, `explainNext`, `explainSkip` and `explainClose`,
in all ten languages. The pieces are `#tour` in
`index.html`; the steps are `TOUR_STEPS` in `assets/app.js`, run by
`openExplain()`, `showStep()` and `placeTourStep()`; and under
`prefers-reduced-motion` nothing slides, breathes or rocks.

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
| [Instagram embed](https://developers.facebook.com/docs/instagram/oembed/) (iframe player) | — | Meta Platforms terms | `/p/<shortcode>/embed/`, whatever kind of post the permalink calls itself. Loaded with the panel of a place that has a reel. No script involved. |
| [TikTok embed](https://developers.tiktok.com/doc/embed-videos/) (iframe player) | — | TikTok terms | Loaded with the panel of a place that has a video. No script involved. |
| [Google Analytics 4](https://developers.google.com/analytics) (gtag.js) | — | Google terms | Property `G-2XNTC15F28`. Counts, and takes the events `assets/track.js` sends. Loads on every page but `admin.html`, and sets cookies. |
| [Microsoft Clarity](https://clarity.microsoft.com/) | — | Microsoft terms | Project `yay3pxtg4w`. Heatmaps and session replay. Loads on every page but `admin.html`, and sets cookies. Not `MUID` — `ad_Storage` is denied, because there is no advertising here for it to do anything for. |
| [Sign in with Google](https://developers.google.com/identity/branding-guidelines) (the mark) | — | Google brand guidelines | Four `<path>`s inlined in `assets/app.js` and `assets/split.js`, on the Continue with Google button and nowhere else. **No script and no request of Google's runs on any page** — the sign-in is a redirect, and their branding permits the mark on the button that starts it. |

**The attribution control in the bottom-right corner is a licence condition of
both OpenStreetMap and CARTO. Do not remove it.**

No scripts or fonts beyond the table above — the row below the last two is a
drawing rather than a request, and nothing about it reaches Google until
somebody presses it. Those two set cookies of their own the moment a page
opens — `_ga` and `_ga_*` for Google, `_clck` and `_clsk` for Clarity — and
see [No consent banner](#no-consent-banner) for why nothing is asked first.
Everything else stored on a visitor's device is seven `localStorage` keys and
one cookie, all of them the
visitor's own choices played back: `ttb.lang` and `ttb.style`, `ttb.stories.seen` and
`ttb.stories.sound`, `ttb.cid` (the random id this browser saves under, made
on the first save and never before it), `ttb.saved`
(which places it has saved), `ttb.nudged` (the date an offer of an account was
turned down), and the `ttb_s` session cookie, which is set by the server and
only exists once somebody has signed in. A sign-in through Google passes two
more cookies through the browser — `ttb_g` for the ten minutes of the round
trip and `ttb_gp` for the fifteen a half-finished sign-up is held — and both
are this site's own, server-set, and gone the moment the trip ends. See
**Signing in with Google**.

`assets/qr.js` is deliberately **not** in that table. Every QR library worth
using is a dependency this repo would otherwise not have, and the discount
pages are the ones most likely to be opened on a bad connection in a cellar,
so the encoder is written out in the repo instead — ISO/IEC 18004 byte mode,
error correction level M. It is checked against a reference encoder and a
scanner, module for module, rather than trusted because it looks like a QR.

`node tools/qrperf.mjs` is what holds it to that. Nine payloads covering
versions 1 to 10, each recorded as the hash of the finished matrix: a code that
scanned last week and hashes the same today still scans, so any change to the
encoder that moves a single module says so immediately. It then times the
encoder, because this runs on the main thread between the card being cleared
and the QR appearing — every millisecond there is a millisecond of blank card
in front of somebody at a till.

### Analytics

Google Analytics 4 is wired up, property `G-2XNTC15F28`. The tag lives in the
`<head>` of every page — the twelve in `PAGES` at the top of
`tools/stamp.mjs` — exactly as Google's console emits it. It used to be on
the map alone, which made the map the only page GA had heard of; the lists,
the account page, the directory, the three pass pages and splitwise were
invisible, and so was every press on any of them.

The tag on its own records one view per address, and that is where its
usefulness ends. The map is one address on which everything happens, and
even the pages that do change address are mostly buttons that change nothing
in the address bar. GA only ever sees a URL. So every deliberate press on
every page is reported as an event, through the one global
`assets/track.js` sets — `TTBTrack.event(name, params)`, and
`TTBTrack.click(node, name, params)` for a link or button built inline —
and opening a place on the map is reported as a page view of its own,
titled with the place and pointing at its `?spot=` URL, through
`TTBTrack.view()`. Those views land in GA's standard **Pages and screens**
report with no configuration in the console, which means the report doubles
as a popularity ranking of the map. The links written straight into the
markup — the wordmark, the Instagram link, the mark on a pass — carry the
event's name as a `data-track` attribute, and `track.js` wires them itself.

**The rule is that a button reports.** A new press that matters gets an
event in the same commit, named for what the person meant by it (`list_keep`,
not `button_7`), with the parameters the handler already has to hand, and a
row in the table below. What every page sends:

The map, `assets/app.js`:

| event | parameters |
| --- | --- |
| `page_view` | one per opened place: `page_title` is the place, `page_location` its `?spot=` URL |
| `filter_select` | `filter_id`, `filter_state` (`on`/`off`), `filters`, `filter_count`, `places_shown` |
| `filter_clear` | `filters`, `filter_count`, `places_shown` |
| `filters_open`, `filters_close` | — |
| `search` | `search_term`, `scope` (`map`) |
| `search_clear` | `scope` |
| `list_open` | `places_shown` |
| `list_close`, `ask_close` | — the cross on the panel, by what it shut; on a list it puts it on the band rather than shutting it, and reports the press all the same |
| `place_close` | `place` |
| `cluster_open` | `cluster_size` |
| `random_pick` | `place`, `pool` |
| `locate` | — |
| `language_open` | — |
| `language_select` | `language` |
| `style_select` | `style` |
| `directions`, `website`, `google_listing` | `place` |
| `call_place` | `place` — the button and the number in the facts alike |
| `deal_open` | `place` |
| `deal_signin` | `place` — the button a discount shows instead, signed out; it opens the sign-in sheet |
| `photo_open`, `photo_step`, `photo_close` | `place`, `photo_index` |
| `reel_load` | `place`, `provider` |
| `reel_open` | `place` — the way out to Instagram or TikTok when the frame is blank |
| `save_place`, `unsave_place` | `place`, `place_id`, `saves_total` |
| `place_share` | `place`, `method` (`sheet`/`copy`) — the link out of the panel's chrome; `sheet` is the phone's own share sheet, `copy` the clipboard or the prompt behind it |
| `list_keep` | `list_id`, `list_state` (`on`/`off`, or `signed_out` when the press opened the sign-up sheet instead) |
| `list_share` | `list_id`, `method` (`sheet`/`copy`) |
| `list_page`, `profile_open` | `list_id` / `name` — the List half of the switch on the band, and the byline under it |
| `lists_all` | — the pill on the rail, which is this page's door to the directory; the same name the other two doors report |
| `flash_open_rail` | — the flashcards door on the rail; apart from `flash_open_account` on purpose, so the two report which one gets pressed |
| `ask_open` | — |
| `ask` | `search_term` |
| `ask_answer`, `ask_none`, `ask_resting` | `search_term`, and on the first two `source`, `places_shown`, `from_google` — what came back; see **Ask for somewhere** |
| `account_open` | `view` (`sheet` signed out, `page` signed in) |
| `account_switch` | `view` (`in`/`up`) |
| `account_close`, `account_page` | — |
| `account_create`, `account_login` | — |
| `account_password_change`, `account_rename` | — on success |
| `account_nudge` | `taken` |
| `saved_open` | — the row in the sheet |
| `explain_open` | — |
| `explain_step`, `explain_close` | `step`, one-based, the one being left |
| `story_open`, `story_view`, `story_watch`, `story_sound`, `story_link` | see **Stories** |
| `radio_play`, `radio_stop` | `station` — reported from `assets/radio.js`, so every page with the button counts it |
| `home`, `instagram` | — the wordmark and the Instagram link |

The lists, `assets/lists.js` — a list, a profile, and `/lists`:

| event | parameters |
| --- | --- |
| `list_page` | `list_id` — any row that opens a list |
| `list_map` | `list_id` — the "on the map" pill, and the Map half of the switch on a list's bar |
| `profile_open` | `name` — any byline |
| `place_link` | `place`, `map` (`mine`/`google`/`added`) — a name on a list, which opens that list on the map. The parameter says which roll the place came off, which is all it can say now that every row goes to the same place |
| `list_keep` | `list_id`, `list_state` |
| `list_share` | `list_id`, `method` |
| `list_save` | `list_id`, `writes` |
| `list_visibility` | `list_id`, `visibility` |
| `list_pin` | `list_id`, `pin` — a marker pressed in the picker |
| `list_reorder` | `list_id`, `from`, `to` |
| `list_add`, `list_remove` | `list_id`, `place` |
| `list_delete` | `list_id` |
| `picker_open`, `picker_close` | `list_id` |
| `place_missing` | `search_term` — the "add the place that is missing" door |
| `place_add` | `place` — a place typed in by hand, on success |
| `search` | `search_term`, `scope` — `lists` for the directory's field, `list` for the one over a single list's places |
| `lists_sort` | `sort` (`kept`, `new` or `changed`) — a chip beside the search field |
| `lists_more` | `rows_shown`, `how` (`scroll` or `press`) |
| `lists_all` | — the way to the directory: the bar at the foot of a list, and the pill on the map's rail. `/account.html` reported it too, until the card that did went |
| `radio_play`, `radio_stop`, `home`, `account_open` | as on the map |

The account page, `assets/account.js`:

| event | parameters |
| --- | --- |
| `fold_toggle` | `fold`, `fold_state` |
| `fold_more` | `fold`, `rows_total` — the rest of a column, past the first six |
| `place_link` | `place`, `map` |
| `saved_map` | `places_saved` |
| `list_page`, `profile_open` | as on the lists |
| `flash_open_account` | — the flashcards door, and the only link to them on this site |
| `list_create` | `list_id` |
| `account_open` | `view` — the two doors when signed out |
| `account_rename_open`, `account_password_open` | — into the map's sheet |
| `account_about_open` | `about_state` (`set`/`empty`) — the field for the line about yourself, on opening it |
| `account_about` | `about_state` (`set`/`cleared`) — the line about yourself, on save |
| `account_google_unlink` | — Google taken off the one kind of account that has it |
| `account_logout` | — |
| `radio_play`, `radio_stop`, `home` | as on the map |

The directory, `assets/venues.js`:

| event | parameters |
| --- | --- |
| `search` | `search_term`, `scope` (`google`) |
| `search_clear` | `scope` |
| `venues_filter` | `filter` (`open`/`cuisine`/`rating`/`price`/`sort`), `value`, `places_shown` |
| `venues_clear` | — |
| `venues_more` | `page` |
| `venues_view` | `view` (`map`/`list`) |
| `venue_select` | `venue`, `from` (`list`/`map`) |
| `venue_call`, `venue_website`, `venue_directions`, `venue_google` | `venue` |
| `place_link` | `place`, `map` — the door to the write-up for the ones on the map |
| `home` | — |

The statistics, `assets/stats.js`: nothing but `home`, the wordmark, which
`track.js` wires from its `data-track`. There is nothing else on the page to
press — it is three tables of numbers and a link per place — and the presses
it is *about* are reported by the pages they happen on, not by this one. Its
own counts do not go to GA at all and are not meant to: **Statistics** is what
they are for, and that is the site keeping a number GA cannot be asked for.

The blog, `assets/blog.js`:

| event | parameters |
| --- | --- |
| `page_view` | one per post opened in the page: `page_title` is the post, `page_location` its `?post=` URL |
| `blog_post` | `post` — a row on the index |
| `blog_all` | — the way back to the index |
| `blog_visit` | `post` — the button at the foot of a post, to whatever it is about |
| `radio_play`, `radio_stop`, `home` | as on the map |

Feedback, `assets/feedback.js`:

| event | parameters |
| --- | --- |
| `feedback_post` | `feedback_as` (`anon`/`name`) — every press of the button, before the answer, so a refused one is counted too |
| `feedback_heart` | `feedback_state` (`on`/`off`) |
| `feedback_remove` | — your own, taken down |
| `feedback_more` | `feedback_page` — the page being asked for |
| `feedback_google` | — Continue with Google, from inside the composer |
| `feedback_open` | — the door on the map's rail, reported through `data-track` |
| `radio_play`, `radio_stop`, `home`, `account_open` | as on the map |

No id travels with any of these. The page is a handful of sentences and the
interesting question is how many people say something rather than which
sentence they agreed with — and unlike a list or a place, a piece of feedback
has no name in the reports for an id to be looked up against, so sending one
would put an opaque string in a console that nothing could resolve it from.

Splitwise, `assets/split.js`:

| event | parameters |
| --- | --- |
| `account_create`, `account_login`, `account_switch` | `via` (`split`) — its own sign-in form |
| `split_open` | `group_id` — a row under Your groups |
| `split_create`, `split_join`, `split_leave`, `split_remove` | `group_id` |
| `split_share` | `group_id` — the copied invite link |
| `split_spend`, `split_unspend`, `split_settle`, `split_unsettle`, `split_drop` | `group_id` — one per kind of write, named after the API's action |
| `split_home`, `home` | — |

Flashcards, `assets/flashcard.js`:

| event | parameters |
| --- | --- |
| `account_create`, `account_login`, `account_switch` | `via` (`flashcard`) — its own sign-in form |
| `page_view` | one per deck opened or closed in the page: `page_title` is the deck, `page_location` its `?d=` URL. The tag counts the load and `TTBTrack.view()` counts the walks, because opening a deck stopped being a load — see **Opening a deck does not load the page** |
| `flash_open` | `deck_id`, `own` — a row on the decks page |
| `flash_knew`, `flash_again` | `deck_id`, `how` (`press`/`swipe`/`key`), `face` (`front`/`back`), `hint` (`1`/`0`) — one per card answered, which of the three ways it was answered, whether the card had been turned over first (`front` is a throw or an arrow on a card nobody opened), and whether the first letters had been asked for before the answer was given |
| `flash_hint` | `deck_id` — the first letters of a meaning asked for, once per card at most. Against `flash_knew` with `hint: 1`, this is what says whether a hint leads to knowing the word — see **The hint** under **Flashcards** |
| `flash_again_deck`, `flash_anyway`, `flash_reset` | `deck_id` — going through a finished deck again, going through one with nothing due, and forgetting one. `deck_id` is `missed` for the deck of what you got wrong |
| `flash_deck`, `flash_card`, `flash_editcard`, `flash_uncard`, `flash_drop` | `deck_id` — writing a deck of your own |
| `flash_wrong` | `deck_id`, `lang` — a card reported wrong, and which of the three backs was on screen when it was. The row it writes is in `flashcard_reports`; this is the same press counted where every other press on this site is counted |
| `flash_keep_ask` | `deck_id` — the gate going up, one word into a deck signed out. Against `account_create` with `via: flashcard` it is how many of the people who meet it make an account, which is the only number that says whether the gate was right |
| `language_open`, `language_select` | — and `language` on the second: the switch in this page's header, reported under the names the map's switch reports under, because it is the same press |
| `flash_back`, `home` | `deck_id` on the first |
| `radio_play`, `radio_stop` | as on the map |

The pass pages, `assets/deal.js` and `assets/verify.js` — nothing on them is
a button except the way back, so what they report is the moment each exists
for:

| event | parameters |
| --- | --- |
| `pass_shown` | `place`, `live`, and `rate` on a deal with a roll — a code was put in front of somebody; once an hour on a page left open |
| `pass_back` | `place` |
| `pass_signin` | `place` — the way in, on a pass page opened signed out |
| `pass_verify` | `place`, `status` — the verdict a scan got |
| `home` | — |

They appear under **Reports → Engagement → Events** on their own. To break the
numbers down by a parameter — which chip, which language, which list — register
it once in **Admin → Custom definitions** as a custom dimension; GA only
collects parameters from that point on, so it is worth doing early.

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

#### What Clarity adds

Counting has a floor. GA and the events beside it can say that eleven people
opened the filters and two pressed a chip. They cannot say that the other nine
scrolled the row to its end and found nothing they wanted, or that the chip
they were after was the one cut off at the edge at 390px. A count says a thing
did not happen and then has nothing further to offer about why.

[Microsoft Clarity](https://clarity.microsoft.com/), project `yay3pxtg4w`,
records the page rather than counting it: heatmaps of where presses and scrolls
actually land, and a replay of the DOM as it changed through a visit. On a site
that is one address with everything happening on it, the replay is the part
that earns its place — it follows a single visit through the filters, the
panel and the chat, none of which GA can see as anything but events in a list.

It loads from `assets/analytics.js`, which is also where the Google tag lives
— one file rather than two snippets pasted into every head. The twelve pages
in `PAGES` at the top of `tools/stamp.mjs` carry it. `admin.html` deliberately
carries neither tag: the only visits it could record are the owner's own, and
it is the page holding a GitHub token.

**What it does not record.** Clarity masks the contents of every input box and
dropdown in all three of its masking modes, and that one cannot be switched
off. It is what keeps `admin.html`'s GitHub token out of a replay: the token is
only ever typed into an `<input type="password">` and held in a variable, and
nothing on the page renders it as text. The mode itself is a dashboard setting
rather than a line of code — **Settings → Masking** — and its default,
Balanced, masks numbers and email addresses on top of the input boxes.

Per-element overrides are attributes, and masking is inherited by everything
below the element that carries it. The pass card on `deal.html`, `verify.html`
and `staff.html` carries `data-clarity-mask="true"`, so the hourly code and the
QR drawn under it stay out. That is tidiness rather than a lock — an hourly
code is already not a secret, since `data/deals.json` ships the keys in public
and "And it is a door, not a lock" under [It is for
members](#it-is-for-members) says so outright — but a code has no business
travelling to a third party to make a heatmap of a page whose only button is
the way back.

Data takes up to two hours to appear after the tag first goes out, and the
dashboard will say the project is uninstalled until it does. A Cloudflare
preview deploy carries the same tag as production and reports into the same
project, so a branch driven hard enough shows up in the live numbers.

### Getting found

**What a crawler is given.** The map is one static file with an English
head, and for a long time that was all any search engine saw of it: a
crawler that does not run scripts — Bing on many of its visits, Yandex on
most — read an English page with no places in it, since the rows are drawn
from `data/restaurants.json` after the fact; and Google, which does run them,
saw the page in English too, because that is what the script picks for a
visitor with no history, and was then told by the canonical tag that
`/?lang=ru` was the same document as `/`. Ten languages, one of them indexed.

`functions/index.js` is what changed that. It serves the same file with the
head written for the language the address names — `<html lang>`, the
`documentTitle` and `metaDescription` from `data/ui.json`, a canonical tag
naming that address, an `hreflang` link to each of the ten and an
`x-default` pointing at the bare English page, the `og:` tags in that
language, and the JSON-LD block. That block used to be built by
`assets/app.js` after the map had drawn, where only a crawler that runs
scripts could read it; now it is in the page as served: the site, and every
open place as a `Restaurant`, `Bakery`, `CafeOrCoffeeShop` or `BarOrPub`
with its address, its coordinates, its phone, its first photo, its price
band and its write-up in that language. The ten addresses are the ones the
site already had — `?lang=` is what the switcher writes into the address bar
— so nothing new was invented for a crawler's sake; see **Each language is
an address** under **Languages** for the visitor's half.

The same route writes the places into the page as text. A reader that runs
no script got four hundred characters out of the map and not one place
name, because the rows are drawn by `assets/app.js` into an empty
`#list-body`; now that element is served full — every open place in the
alphabet as an ordinary list, the name linked to its own address, its
kinds, its street, its write-up and the dishes to order, all in the
language of the address. Nobody sees it: `renderList()` empties the element
before it draws the first row and the panel is closed until the script
opens it. It is there for the readers below.

**A place is an address.** `?spot=badam` always opened the map standing on
Badam, and it was a deep link the canonical folded back into the bare page,
so a search for a place by name found the whole map or nothing. It is a
page now: the same file and the same map, served by the same route with the
place's name for a title, its write-up for a description, a canonical naming
`/?spot=badam` itself, the hreflang set for the same place in the other nine
languages, a JSON-LD block for that one place, and the page's text led by
the place with the other sixty-nine as links to their own addresses — which
is what makes seventy addresses seventy pages rather than one page under
seventy names. The same head is the card a chat app unfurls, and **Sharing a
place** has that half: the photograph, the language of the link, the closed
flag. `renderPanel()` in `assets/app.js` writes the same title into the tab
while a place is open, so a crawler that runs the script finds the title it
was served. A closed place keeps its card and its link and is not a page: its
canonical goes back to the map, and it is not in the sitemap. `?type=`,
`?style=` and `?list=` stay deep links.

**The words.** What each page is written to be found for, in the language of
its address — the head term first, then the kinds of place people type
after the city's name, all of it in the title and the description, and the
list page titles ending "in Tallinn" because that is where the question
ends:

| Address | Written for |
|---|---|
| `/` | where to eat in Tallinn · restaurants, cafés, bakeries, pubs and beer bars in Tallinn · food in Tallinn |
| `/?lang=et` | kus Tallinnas süüa · Tallinna restoranid, kohvikud, söögikohad, õllebaarid |
| `/?lang=fi` | missä syödä Tallinnassa · Tallinnan ravintolat, kahvilat, leipomot, olutbaarit |
| `/?lang=ru` | где поесть в Таллинне · рестораны, кафе, пекарни, пабы и пивные бары Таллинна |
| `/?spot=<id>` | the place's name · what it is · the street · every dish in its `mustOrder` |
| `/list/all-the-…-in-tallinn-…` | the thirteen kinds — pubs and beer bars, bakeries, hidden gems, cheap eats, laptop friendly, date night, vegan, Asian, Caucasus, fine dining — "in Tallinn" |
| `/list/top-ten-…-by-google-…` | top ten restaurants, bakeries, cafés, bars, pizzerias in Tallinn |

Two words are deliberately not there. "Best" — *parimad*, *parhaat*,
*лучшие* — is the head of every one of those queries, and the map does not
claim it: no scores, being on the map is the verdict, and a title that said
otherwise would be the one sentence on the site that lied. Google's five
lists are the exception, since a Google rating is exactly a claim about
best, and their titles say so in Google's name. And Tallinn is spelled
Таллинн, the way the city's own Russian-language press spells it, rather
than the Таллин a searcher in Russia types; a search engine reads the two
as one word, and the readers here are the third of the city that speaks
Russian.

The other six languages carry the same title and description translated,
the same text, the same addresses. Nobody is searching for Tallinn in
Armenian in numbers worth a sentence here; they cost nothing because the
strings were already written.

**The lists, as text.** A list page had the same blind spot the map had: the
list arrives seeded as JSON in a `<script>`, `assets/lists.js` draws it, and
a reader that runs no script got the shell. Each of the three routes that
serve `lists.html` now writes what the page is about into its empty
`<main>` — a list's title, its line, whose it is and every place with its
street and its sentence, each linked to its own address on the map; the
directory's first page of lists; a person's name, line and
lists — and `render()` empties it before drawing, so nobody sees the plain
version. `fill()` in `functions/_shell.js` is the one mechanism for the map
and the lists both, and the validator holds both pages to the exact spelling
of the element it fills.

It costs no extra Functions invocation, since `_routes.json` was already
sending every request for `/` through `functions/_middleware.js`. It costs
the JSON-LD and the list on the wire — some eighty-five kilobytes together,
twenty or so compressed, on a page that was ten — and a page fetched again
on every visit rather than a 304, since the asset server put an ETag on the
static file and the route puts none. When the route cannot
read the page or the data it hands the request back to the asset server,
and the map is served exactly as it was before the route existed.

**AI assistants.** ChatGPT and Claude do not run scripts either, and they
find a site two ways. One is an index: OpenAI's `OAI-SearchBot` and
Anthropic's `Claude-SearchBot` crawl for the search behind each assistant,
ChatGPT also leans on Bing's index and Claude on Brave's, and Perplexity
runs `PerplexityBot` over its own. The other is a fetch: `ChatGPT-User` and
`Claude-User` open a page the moment somebody asks about it, read it as
text, and cite what they found. Both read the page as served — the head,
the list above, and nothing the script would have drawn — which is what the
list is for. `robots.txt` names all of them and allows all of them under
its one `*` rule, the training crawlers `GPTBot` and `ClaudeBot` included;
that last is a decision the file says out loud rather than one made by
omission. What `robots.txt` cannot do is reach a bot that never gets as far
as reading it: Cloudflare sorts AI bots into **Search**, **Agent** and
**Training** and applies a policy per category at the edge, under the
zone's **Security → Settings → AI bot policies** — Search has to stay on
allow for the two search bots, Agent for the two fetchers, and Training is
the owner's call. That switch is not in this repository and will never be
in a diff, so a site that has quietly vanished from an assistant is checked
there first. There is no submission form at either company; being in
Bing's and Brave's indexes, and being readable as text, is the whole of it.
`llms.txt` — a proposed file describing a site to language models — is not
here, because nobody has shown that any assistant reads one.

**The sitemap is generated.** `tools/sitemap.mjs` writes `sitemap.xml` from
the languages in `data/ui.json`, the places in `data/restaurants.json`, the
thirteen chip lists in `tools/typelists.mjs` and Google's five in
`tools/googlelists.mjs`: the map at each of its ten addresses, each carrying
the full set of alternates; every open place at its English address, carrying
the same; then `/lists`, `/blog` and the eighteen lists. The eighteen are
listed by name because they are the pages that answer what people actually
type — the pubs and beer bars in Tallinn, the bakeries, the top ten
restaurants by Google's rating — and their ids never move; people's own
lists stay out, since the directory is where a crawler finds them. Nothing
in the file carries a date: Google trusts a `lastmod` only when it is
consistently right, and nothing in this repository knows when a page last
changed. The header of the tool has the whole argument, and the validator
fails on a stale file.

**Bing is told, not waited for.** `.github/workflows/indexnow.yml` runs
`tools/indexnow.mjs` on every push to the production branch — every deploy —
which submits every address in `sitemap.xml` to IndexNow, the protocol Bing,
Yandex, Seznam and Naver share for being told what changed rather than
finding it weeks later. The key in `indexnow.txt` at the root is public by
design: the protocol's whole proof is that only somebody who can put a file
on this host could have written it, so it is committed, and there is nothing
in the repository's secret store for it. Google takes no part in IndexNow;
Search Console and the sitemap are its road.

**But the deploy is waited for.** The push fires the workflow before
Cloudflare has put the commit live, and on the day the key was born that sent
Bing to fetch a key file that was not on the site yet: IndexNow says 202 to
any submission, checks the key on its own time, found nothing, and answered
403 to every run after — five red runs on commits that had touched nothing
near it. So the tool now asks the live site for `/indexnow.txt` and submits
only once what comes back is the key the tree holds, up to six minutes. On
an ordinary push that is one request and no wait; on the push that mints a
new key it is the wait for the deploy, which is the point. A key Bing has
already refused stays refused, so minting a fresh one — `node -e` and
thirty-two hex characters into `indexnow.txt` — is how a run like those three
is put right, and the workflow can be run by hand from the Actions tab to
check that it was. A 403 *after* the tool has seen the key served is the one
thing left that the repository cannot fix: Bing being answered differently
from a GitHub runner by whatever stands in front of the zone.

**And the key in the tree is the third one.** The waiting tool landed once,
went green on its own push and the next, and was then reverted along with
everything else that session had done — which put the refused key and the
unwaiting tool back, and made every deploy after it red again for the same
reason, four of them before anybody went looking. It is back now, with a key
minted afresh rather than the second one: that one was correct while it was
served, but the revert took it off the site for most of a day while Bing went
on being told to look for it, which is exactly how the first one died. A key
costs `node -e` and thirty-two hex characters and being wrong about one costs
a day, so a key that has ever been submitted while the site was not serving it
does not get a second chance.

**Where the host is named.** `robots.txt`, `tools/sitemap.mjs`,
`tools/indexnow.mjs`, `index.html`, `lists.html`, `blog.html`,
`functions/_shell.js` and `functions/_middleware.js` — the last as the host
it redirects *to*.
`grep -rl tallinntastebuds.ee` is the list to walk when the domain changes,
and it is longer than that, because the comments and the chat's brief name
the host too.

Google finds a site through links and through Search Console, and a brand new
host has neither. In order of what actually moves the needle:

1. **Put the link in the Instagram bio.** It is both the crawl path and,
   realistically, most of the traffic.
2. **Google Search Console.** Verify the property, submit `sitemap.xml`, then
   use URL Inspection to request indexing. Verification by HTML tag needs a
   `<meta name="google-site-verification">` line in `index.html`.
3. **Bing Webmaster Tools.** Same job — verify, submit `sitemap.xml` — and it
   feeds DuckDuckGo, Copilot and ChatGPT's search as well, whose indexes lean
   on Bing's. Bing is also the one that reads the page as served rather than
   after the script has run, which is what the Function above is for.
4. **A custom domain.** Done — `tallinntastebuds.ee`. `pages.dev` indexes
   fine, but it carries no brand and it is not yours: a domain you own is the
   one thing here that survives changing host. Search Console treats it as a
   new property, so verify and submit the sitemap there too.

Search Console is also where to check whether a page is being *refused*
rather than merely missed. Cloudflare Pages serves `x-robots-tag: noindex` on
preview deployments, which is correct for previews and fatal if the address
people share turns out to be one.

To remove tracking entirely, delete the `assets/analytics.js` script tag from
the twelve pages that carry it, or the file. Everything in `track.js` checks for
`window.gtag` and returns quietly when it is missing — which is what already
happens for a visitor running an ad blocker — so every call site becomes a
harmless no-op and none of them has to change. To remove one tag and keep the
other, delete its half of the file.

### No consent banner

**Both tags load on sight, and nothing is asked first.** There was a banner
here for a day — first a bar with one sentence and two buttons, then a dialog
listing what was used regardless and what agreeing added on top — and it was
taken out on purpose. The reasoning is kept because the decision is easier to
re-make than to re-derive.

The rule it was built for has not changed. Estonia applies the EU ones, and
ePrivacy asks about *writing to somebody's device*, not about whether what you
write is personal data — which is why "we do not collect anything" was never
the answer it sounded like. `_ga`, `_ga_*`, `_clck` and `_clsk` are written
with nobody asked, and a session replay is a recording of somebody's visit.
Putting the question back is a revert rather than a project: `git log` has
both versions of it.

**Clarity is still handed a consent signal**, with nothing in front of it.
Since 31 October 2025 Clarity gives a visitor in the EEA, the UK or
Switzerland full recording only against one, falling back to a limited mode
where every page load is a fresh session and a returning visitor is nobody it
has seen before. This is a map of Tallinn; practically all its traffic is the
EEA, so without the signal the replays arrive as a heap of one-page fragments,
which is the opposite of the thing Clarity was added for.

It is `clarity('consentv2', …)` rather than the older `clarity('consent')`,
which is deprecated. The object carries **both spellings** of its two keys —
`ad_Storage`/`analytics_Storage` as Microsoft documents them, and the
lowercase pair as Google's consent mode spells the same ideas — because
getting it wrong fails silently, with empty cookies and a new "user" on every
page load ([microsoft/clarity#924](https://github.com/microsoft/clarity/issues/924),
still open). A key Clarity does not read costs nothing; a guess that went the
wrong way would cost the recordings.

**`ad_Storage` is denied.** It is what lets Clarity set `MUID`, a
Microsoft-wide identifier shared with their advertising side, and this site
carries no advertising for it to do anything for. The recordings and the
heatmaps ride on `analytics_Storage` and arrive either way; what is lost is
Clarity's surest way of telling a returning visitor from a new one. One word
changes it.

CARTO has already made one move here — tiles now want a key, free but
required, which is what `TILE_KEY` is for. If they ever go further and stop
serving free tiles altogether, the lines to change are `TILE_URL`,
`TILE_URL_DARK` and `TILE_ATTRIBUTION` near the top of `assets/app.js`.
There is no CSP to update alongside them — see above for why.

---

## The design rules

**Design notes** below says what this site looks like. This says what anything
new has to do to belong to it — the short list a new sheet, page or button is
held to, so that building one is a decision about words rather than about
pixels.

It is written down because two things had already drifted without anybody
deciding to. The account sheet, the one surface behind a sign-in, had become a
title and three underlined links in a column: nothing on it said which of them
was where you go next, and the one that signs you out looked exactly like the
one that opens your lists. And the lists page's primary button had drifted a
whole typeface away from the map's — same job, same colour, one set in mono
and one in the display face — because each page had been given its own copy of
it. Neither was a bad decision. Neither was a decision at all.

### 1. Colour comes out of the tokens

No component rule anywhere names a colour. The tokens are the first block in
`assets/styles.css` and each style restates every one of them, so pressing the
swatch changes the whole colour world and nothing is left behind wearing the
style you came from. A component that named its own colour would be exactly
the thing that failed to change.

The exception, and it is the only one: the three surfaces that sit **over a
photograph** — the lightbox, the stories, and the scrim behind a sheet. Those
are black-and-white by construction, belong to no style, and say so where they
are defined.

### 2. Three faces, and a thing picks one

| Face | Token | What wears it |
| --- | --- | --- |
| Familjen Grotesk | `--display` | names and titles: the wordmark, a place, a list, a sheet's heading, a row's name |
| Literata | `--body` | sentences — the tagline, a blurb, the line under a title that says why |
| IBM Plex Mono | `--mono` | anything that is a label rather than a sentence: eyebrows, field labels, buttons, counts, badges, addresses, the price gauge |

The mono is the site's tell. It is what says "this is a control or a fact",
and it is why a button in the display face read as somebody else's button.

There is a fourth and nothing picks it: `--emoji`, the platform's own colour
emoji face, for the five things on this site that draw one — a pin on the
map, a list's emblem, the swatch in the picker, a card on the directory and
the lists door on the rail. It is a token for the reason the three above are,
and it ends in `sans-serif` rather than in `--display` on purpose: a text
face in front of the colour one turns the star and the heart into black
glyphs on half the phones out there.

### 3. One hairline, and a short list of corners

`--hairline` is the only border weight on the site. `--shadow` lifts a card,
`--lift` lifts something logo-sized standing on the map, and there is no third
one. Text standing on the map has no shadow at all: `--glow` is paper packed
tight around the glyphs and hazing out past them, so a word carries its own
ground instead of a box with an edge.

Corners come from the same short list: `--radius` (4px) for anything holding a
picture or a page of words, `--radius-soft` (12px) for chrome floating on the
map and for a field, `100px` for a pill — which is only ever a button or a
chip — and `50%` for a dot. A new value is a fourth thing to remember; use one
of these.

### 4. Four controls, defined once

Everything pressable is one of four shapes, and all four live in
`assets/styles.css` where both pages read them:

| | What it is | Where |
| --- | --- | --- |
| `.go` | the filled action, a mono pill in the accent | any card or sheet |
| `.alt` | the quiet one beside it: a way out, a switch, a second thought | under a `.go`, or at the top of a step |
| `.chip` | a toggle that filters | the filter row |
| `.menu` / `.menu-row` | a list of places to go, hairline-ruled, full width | the account sheet |
| `.ac-google` | Continue with Google: a pill like `.go`, on paper inside a hairline, carrying Google's mark | the sign-in sheets, and only those |

A page does not get its own copy of one of these. If a fifth is genuinely
needed it goes in the same block, with the sentence saying what the other four
could not do.

**There is a fifth, and that sentence is this one.** `.ac-google` is the only
control on this site wearing somebody else's design, and it has to: a sign-in
button people do not recognise at a glance is a sign-in button that has
stopped doing its job. None of the four could be it. `.go` would spend the
accent a second time on a card that has already spent it — see rule 5 — and
`.alt` would make the other way in look like a footnote under the form. So it
is a pill of the same height and the same mono as `.go`, on `--paper` inside a
`--hairline`, with the mark in Google's four colours inside an `<svg>`. That
mark is the one exception to rule 1 below, and it is not really an exception:
the colours are Google's and naming them anywhere else would be wrong.

One pressable thing on the site is none of the four, and it is not a fifth: a
card's own title, on the three that fold — the saved places, your lists and
the ones you kept, all on `/account.html`. It is a `<summary>`, and what it is
made of was all here already: the title, the count and the `.menu-go`
chevron. A control takes you
somewhere or changes something; this one opens the card it is the title of. It
lives with the card in `lists.css` rather than in this block — see **The
account page**.

The last card on that page was the same thing with the other answer for a
while: the title an `<a>`, the chevron not turning, and `.lists-open`
stretching the press over the whole card — rule 8 obeyed rather than dodged, a
target the width of the card. That card has gone, see **Everybody's lists is
not on this page**, and the shape has not: the directory has drawn every one
of its lists that way since it was written, and a card with one thing on it
may do it too.

### 5. One filled action per surface, and never two

The accent is spent once. Two filled buttons side by side is a surface that
cannot say which of them it wants, and on this site the accent is also the
colour of every pin, so spending it twice on one card spends it against the
map as well. The second thing to do is an `.alt`.

### 6. A sheet is built in one order

Eyebrow, title, the line that says why, anything that just happened, the
fields, the one action, the ways out. Every view of the account sheet is drawn
in that order, so moving between them is the words changing rather than the
furniture. Errors and confirmations sit **above** the fields, not under the
button: nobody looks under the button they have already pressed.

### 7. One surface asks one thing

If a step needs its own fields, it gets its own view with a way back at the
top of it, rather than another block stacked onto the sheet you started on.
The account is a name and a menu; changing a password, adding an address and
entering a code are steps behind it. A back is at the top, where a back is
looked for — under the button it reads as a second action.

### 8. A list of choices is rows, not a stack of links

Three links in a column is a paragraph that has lost its sentences. A row has
an edge, a line under the name saying what it does, a mark on the right saying
it opens something, and **a target the width of the card rather than the width
of the word**. That last part is the one that matters on a phone.

### 9. A field is a mono label over a 16px input

The label is uppercase mono in `--muted`; the input is `--paper` inside a
hairline. **16px is not a taste decision**: anything smaller makes iOS zoom
the page when the field takes focus, and it never zooms back out. A field that
is smaller on a wide screen has to be bumped at the phone breakpoint, which is
what the map's search box does and what the lists page's fields and the
chat's had been missing. Every field carries the `autocomplete` hint that lets
a password manager do its job — which is what actually rescues people who
forget things.

### 10. Colour is never the only thing saying it

The pins say filmed, photographed or written-up by silhouette as well as by
tone, every row repeats it as a word, and the line saying whether an account
can recover a password has a dot **and** the sentence. Anything that says
something in colour alone says it twice.

### 11. Every word is in `data/ui.json`

Ten languages, and a string that exists in one and not another fails the
build. Nothing user-facing is written into a script at all, and the words in
the markup are only the English the page is served with — every one of them
sits under a `data-i18n` key that replaces it as soon as the strings load.
Both the keys in the markup and the `t('key')` calls in the scripts are
checked against the file. See **Languages**.

### 12. Nothing animates unless it was asked to

Pins settle, panels slide, a hover moves a chevron two pixels. The one thing
on the site that moves on its own is the ring round the mark when a story is
up, because a clock is running on it. Everything with a transition has an
answer under `prefers-reduced-motion`.

### What the validator checks

Rules are worth what is enforced. `node tools/validate.mjs` fails the build on:

- a string the code asks for — a `data-i18n` key in the markup, a `t('key')`
  in a script — that is in no language of `data/ui.json`, and a string that is
  in one language and missing from another
- a colour token declared by one style and not by the other, which is the
  half-finished palette that leaves one style wearing the other's shadow

The rest is read by a person. Rules 5 through 8 are about judgement, and a
linter that could tell a second filled button from a legitimate one would be a
larger program than this site.

---

## Design notes

**Palette.** The ground is `--wash`, the cards are `--paper`, and links, pins
and the price gauge are `--accent`, with `--accent-lit` a brighter step up for
hover and the locate dot. Near-black ink cast towards the style's own hue, one
hairline weight, one soft shadow, nothing else. The tokens are the first thing
in `assets/styles.css` and each of the two styles restates every one of them;
change those values and the whole site follows.

**The chrome.** Everything floats on the map: nothing has a page around it,
and the brand does not even have that. One strip across the top — the mark,
the name and the one sentence on the left, the radio, **Places** and the
language switch on the right — and the filter chips on the line directly
beneath it. The two things in that corner are two doors: the name goes home,
which from a place, a list, a type or a story is the way back to the whole
map, and the mark opens the stories when there are any. Neither does the
other's job. The controls that are questions about the *map* rather than
about the page stand on the map instead, in the left rail: the account at
its head, then Surprise me and Ask, then the colour switch, with locate at
its foot. There
are no zoom buttons; the wheel, a double-click, a pinch and the `+`/`-` keys
all still zoom, and two more buttons standing on the map were paying for a job
the map already does. The chips used to sit at the bottom,
where the sheet covered them and they had to be hidden whenever the list was
open; at the top they clear even the fully dragged-up sheet, so the filters can
be changed while the list is showing.

**There is no card under the name.** There was one, for the tagline's sake: a
line of serif prose over a map full of street names looked like the one thing
a glow behind the letters could not rescue, so the corner of the map carried a
filled panel with a border round it — on a site whose whole subject is the map
underneath. The phone layout had been proving the other case for as long as it
has existed, where the handle stands on the map in nothing but `--glow` and
reads perfectly well over Positron's pale land. The desktop takes the same
deal now: the mark, the name, the sentence and the handle lie straight on the
city, the sentence in the ink rather than the muted grey it wore inside the
card, and the underline under the handle goes with the panel — a hairline
under text lying on a map is a stray line, and it comes back on hover and on
focus where it is answering a question rather than decorating.

What the card leaves behind is its measure. `--brand-w` is the 288px box less
the padding it used to hold, which is what still sets the sentence into two
lines — and it is the number the chip row starts after, so the column and the
row cannot disagree about where one ends and the other begins. See
[The chip row starts after the corner, and the corner is one block](#the-chip-row-starts-after-the-corner-and-the-corner-is-one-block),
which is where that went wrong twice. And with nothing drawn
there, nothing there takes a press: the block hands its pointer events to the
map and the mark, the name and the handle take theirs back one at a time,
because a transparent rectangle that swallows a drag is a piece of dead map.
The handle gives them up again while the corner is shut — see
**And on a desktop the corner steps back until you go for it** — since a link
nobody can see is a link nobody meant to press. The mark and the name never
do: they are what is always drawn up there.

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
shows through the gaps in it: between the brand and the buttons, around the
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
thumb reaching up overshoots on — and the brand and the controls sit above the
scroller in the stack, so a tap on a button is always a tap on that button.

Under about 380px the corner and the two controls stop fitting beside each
other at full size, so the mark, the name and the handle all come down a step
— which is measured against **Places**, the thing the last letter of each line
has to stay clear of.

**Pins.** Every pin is the mark — see **The mark**. One picture, three collars
round it, for the three amounts of place behind it (on a phone, under 480px,
each draws at four-fifths of these — `--pin-scale` in `assets/styles.css` —
because seventy places at city zoom on a hand-wide map were the whole
screen):

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

**The dot is not the mark.** It was, for a while — the places it stands for
are places, went the argument, so the picture belonged on the dot too — and
on a phone at city zoom that was a dozen mouths across the screen, each
nearly twice the size of a pin, with the numbers cased in a ring of paper so
they could survive the photograph under them. A cluster is a count, and a
count reads best as a numeral on a flat disc: the accent, with the numeral in
paper, which is the contrast every button on the site reads at and needs no
casing. The pair — two places under one dot — is the quiet one, paper with
the numeral and the rim in the accent. The mark stays on every pin, where it
is the whole identity of the map; a cluster is its arithmetic. On a phone the
disc draws at four-fifths of its box, `--cluster-scale`, the way the pins
draw at four-fifths.

There was a wash of the accent over the mark for a version, to give the count
something flat to sit on, and then the casing, and then the picture went and
took both with it. What is left is what a map label has always been: a number
on a ground that holds it — paper on the accent, 6.56 to one on Red and 8.14
on Green, the same pair every filled button on the site is set in.

**The open place.** The list panel is the neutral card everything else on the
map is. Opening a place tints that card with six percent of the accent, so it
reads as picked rather than as the same panel with different words in it. Six
percent because it has to survive the measurement: on both palettes the body
text stays between 10.7 and 15.9 to one and the muted line never drops below
4.96. Anything stronger starts turning a write-up into a coloured
box.

**What the panel leads with.** Name, price, and the discount badge where there
is one — then the write-up, and then the thing there is to look at. The reel
comes first of those, the photos after it, and a place with neither says so in
that same slot under its own heading rather than leaving you to reach the
bottom and work it out. The tags, the offer and the dishes follow, as they did.

The reel led for a while, and the write-up sat below it. That fixed a real
problem — the one part of the page which is not text had been two sections
down, under a screenful of words, so on a phone it had to be scrolled to — by
creating another: a player opened directly under the name, before a word had
been said about the restaurant, and the paragraph underneath read as its
caption. A few lines of prose is not a screenful, so putting them back on top
costs the reel nothing. The write-up says what the place is and the reel shows
it, which is the order the two were written in.

The reel and the photos keep the slot they took, immediately under the
write-up, and a place with neither still gets its own heading there: the three
kinds of place read as three kinds in the panel rather than as one kind and two
omissions.

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

**Every sheet has two stops.** A half stop at 50% of the screen, shared by all
three, and a full stop above it: 88% for a place, 82% for the list and the
chat. Drag the grip, swipe the sheet, or tap the grip to swap, and
`sheetStops()` in `assets/app.js` holds the same numbers the `--sheet-h` block
in `assets/styles.css` draws, because a drag settles on a height the stylesheet
then has to agree with.

**The sheets made of words open at the taller one, and a place opens at the
half.** The list and the chat were asked for by somebody who wanted the words,
so the words are what they arrive showing. Opening a place asks two things at
once — what is this, and where is it — and a sheet over the whole screen
answers only the first: the pin it is about ends up crushed into the 110px
strip along the top, under the brand card, which is not a map anybody can read.
At the half stop the map keeps its half, the pin sits in the middle of it
wearing its name and its halo, and the rail lies along the strip above the
sheet instead of hiding behind it.

A place did open full for a version, on the reasoning that a name you tapped is
a request for the page belonging to it. It is, and the name, the price and the
opening of the write-up are what the half stop already shows; what the full one
bought over that was the reel, and it bought it by taking the map away. So the
grip is the bargain instead — drag it up for the reel and the rest of the
write-up, down to put the place away.

**The list used to have one stop, and dragging it down was the only thing that
gesture could mean.** It meant close, at a quarter of the way down, which is
how somebody pulling a list they had been sent aside to see where the places
were lost the list: the sheet followed the finger all the way off the bottom of
the screen, the map settled back on the whole city, and the whole thing read as
the page having reloaded. The half stop is what the gesture was asking for and
is now what it gets — half the map back, with the search field, the list's name
and the first rows still on screen.

Closing by hand is still the first thing a hand tries, and it is now two
things. Below the half stop the sheet stops following the finger one for one:
it gives a third of what it is pulled and no more than 90px, so a drag meets a
floor rather than throwing the sheet away, and letting go 60px into that floor
— 180px of real travel past the stop — is what closes it. From the half stop
that is an ordinary dismissing swipe. From the full stop it is half the height
of a phone, which is a thing you have to mean.

**Somebody else's list has a third stop there, and no exit under it.** That
dismissing pull is right for a place, for the chat and for the map's own list
of places: pull any of those away and what is left is the map you asked for.
It is wrong for a list, because a list is a mode — the map is narrowed to that
list's pins, and the sheet is the only thing on screen saying so — so the same
pull lands on the band naming the list and stops dead instead. About a hundred
pixels of name and the switch to the list's own page, the map with the rest,
and the drag back up or a tap on the grip brings the list with it.

**And neither does anything else close it.** The cross, Escape and **Places**
all land on the band too, and the cross is not drawn there at all, because a
press that does nothing is worse than no button. It is the one sheet on this
site that cannot be dismissed, and that is the point: what a drag or a press
would be dismissing is the only thing on screen saying why the map is showing
seven pins. Being rid of it is leaving the list rather than closing a sheet —
**Back to all places** under the byline, any chip, or the name in the corner,
each of which hands back a map nothing is narrowing and a panel that closes
like any other. A desktop has no cross to keep on the list: the places column
does not shut at all up there — the cross belongs to whatever opened in front
of it, and what pressing it hands back is the list. **A list is a mode, not a
filter** under **Lists** has the reasoning, and
[The places column, and what opens beside it](#the-places-column-and-what-opens-beside-it)
has the arrangement.

The walk is the one thing that closes it outright, through `closePanel({ band:
false })`: it is about to point at the pins and the rail and it asks for the
map with nothing over it.

The stop is the band as measured rather than a number written down, because a
long title wraps and a wrapped title is a taller band. `peekStop()` in
`assets/app.js` measures it and hands it to the stylesheet as `--peek-h`, so
the height a drag settles on and the height it is then drawn at cannot come
apart — the same bargain `sheetStops()` and the `--sheet-h` block already have.

**A field takes the sheet back up with it.** The keyboard comes off the
sheet's own height, so at the half stop the search box and the chat's would
both end up as a strip of paper above the keys with the thing being typed into
somewhere underneath. Focus is the moment a field says it is about to be typed
in, so it is the moment the room goes back.

It is sized against `--vph`, which is `window.innerHeight` written back to CSS
on every resize and every time the visual viewport moves under it, falling back
to `dvh` before the script runs and to plain `vh` in a browser that has
neither. `vh` on iOS means the *large* viewport — the one
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
**swipe it down**, the close button, a tap on the grip, and **Places** in the
chrome strip above. The middle two are the ones that only do one thing — a tap
on the grip swaps the two stops, and the button closes it — and the swipe does
whichever of them the pull asks for. On somebody else's list all four move it
between its three stops and none of them closes it, which is why the cross is
not drawn at the band.

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

**The browser's own bar** is the same subtraction with the threshold the other
way round. Safari's toolbar stands over the foot of the screen the whole time
and `window.innerHeight` counts the strip behind it as room, so anything fixed
that fills the window and anchors something to its own bottom edge puts that
thing under the bar, with nothing on the page saying it is there — a fixed
element is exactly as tall as it asked to be. What it cost was the story
viewer: on an iPhone the caption and the button to the place a story was shot
at sat under the toolbar, and a story looked like a picture with nothing to
press. `visualViewport` is the only thing that knows the bar is there, so the
difference goes into `--browser-b` — anything over the keyboard's 90px is the
keyboard and not a bar — and the viewer takes it off the height of its stage
and pads the scrim by it. The scrim still covers the whole window, because the
strip behind a translucent bar is part of what you can see. It is 0 on Android,
0 on a desktop, and 0 on an iPhone the moment the bar slides away.

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
It sits beside the name rather than above it: stacked above, it was a picture
parked in the corner with half a line of nothing next to it, and beside the
name it has a job, because the wordmark breaks after *Tallinn* and two lines
of it stand exactly as tall as the circle does. On a phone the name comes down
to the size a name is given at the top of a profile and the handle sits under
it, and the circle stands against both lines rather than one. On the map itself it goes
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

**A pinch on a photograph zooms the photograph.** Up to four times, about the
fingers, and a finger then carries it about; the next photograph, or closing,
puts it back at its own size. It is the lightbox's gesture rather than the
browser's because the browser's answer to a pinch is to zoom the *page*,
which looks the same while the photograph is up and is still there once it
has closed — the map twice its size, the chips off the edge of the screen, and
no obvious way back, since Leaflet takes the pinches that land on the map.
Somebody reading a menu found one, which was to open the photograph again and
pinch the other way; `wireLightboxZoom()` in `assets/app.js` is why nobody
has to again.

**The List view is also the SEO surface.** It is the only part of the site a
crawler can read as text, so it stays in the markup even when the panel is
closed, hidden by transform rather than removed — and `functions/index.js`
serves it already full, every place as plain text in the language of the
address, for the readers that never run the script. See **Getting found**.
