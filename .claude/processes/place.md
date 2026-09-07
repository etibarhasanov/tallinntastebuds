# Add, change or close a place

The map is `data/restaurants.json`: one object per place, hand-written, nothing
in it generated. This is the process for putting a place on it, changing what
an entry says, adding photographs, or marking somewhere shut. It is the one
file that gets edited every week, so most of what can go wrong here has gone
wrong already and is written down.

## Read first

In `README.md`:

- **Add a place** — the entry, field by field. `id` is the `?spot=` link and
  the photo folder, and never changes once shared. `types` are ids out of
  `data/taxonomy.json`, never free text. `phone` is international form with
  spaces. There is deliberately no neighbourhood and no opening hours.
- **What counts as a Restaurant** and **What counts as Laptop friendly** — the
  two types that describe the room rather than the menu, and where the line is
  drawn for each. Read both before tagging anything with either; a tag that is
  wrong here dilutes a filter for everybody.
- **Get the coordinates**, **Copy a video permalink**, **Add photos**.
- **Close a place instead of deleting it**, when somewhere shuts.
- `photos/README.md` — the size a photo should be, the recipe that gets a phone
  photo there, and why the EXIF block has to go: it carries the GPS position
  of wherever the shutter was pressed, into a public repo.

## Adding one

1. **Write the entry.** Copy a live entry of the same kind rather than the
   README's example: the live ones carry the blurb in all ten languages and
   the example shows three. `added` is today, `visited` the month you ate
   there. `reel` stays `""` until you hold the real link — **never invent a
   shortcode**; a made-up one resolves to a stranger's post.
2. **Coordinates.** Right-click the pin in Google Maps and paste. `lat` is
   about 59.4 and `lng` about 24.7; swapped, the validator says so. The map is
   the proof of the position, not the numbers: open it and check the dot is on
   the right side of the street, because the panel never prints them back.
3. **Photos** go in `photos/<id>/`: WebP, about 1600px on the long edge, under
   about 300 KB, EXIF stripped. They sit in git history for good, so shrink
   them before committing, never after. List the filenames in `photos` in the
   order they should appear.
4. **Is it one place?** A room that is a bakery in the morning and a
   restaurant at night is two entries, and the laptop tag goes on the one it
   is true of. Fotografiska is the precedent: the fine dining upstairs and the
   cafe on the ground floor are separate entries with separate pins.
5. `node tools/places.mjs`. The catalogue in `data/places.json` is generated
   from the map and CI refuses a stale one.
6. **The counts.** The README says how many places there are and how many
   carry `restaurant` and `laptop` — "29 of the 75", "8 of the 75" — in prose,
   and a commit that adds a place moves those numbers. `grep -n 'of the 7'
   README.md` and fix each one. A number that is wrong is a comment that is
   wrong. Be warned that the total is also spelled out in words — "my
   seventy-four" — across the README, `assets/app.js`, `assets/lists.js` and
   the header of `tools/places.mjs`, and most of those still say seventy-four
   on a map of seventy-five. Fixing them all is a sweep of its own, not part
   of adding a place; fix the ones in any file you are already in.
7. `node tools/validate.mjs`. Warnings on a new place are often honest — no
   reel yet, no phone — but read them: `blrub` is caught as an unknown key,
   and a `TODO` left in a blurb is a warning that reaches visitors.
8. **Open the map** on a local server (`site.md` says how; `file://` shows an
   empty map) and look at the pin, the panel, the photos in the lightbox, and
   the filter chips the new types light up.

## Changing one

- **The id never changes.** Every `?spot=` link ever posted in a story points
  at it. If the place renamed itself, change `name` and leave `id` alone.
- **A renamed place with a discount** is a name in two files: `deals.json`
  copies it so the pass pages never load the map. The validator fails with
  both spellings in the message if they disagree.
- **A blurb is ten languages.** Changing the English and not the other nine
  leaves nine languages saying the old thing, and the validator cannot see
  that. Change all ten, or say in the commit why not.
- **A type change is a filter change.** Moving a place off `beer` and onto
  `restaurant` changes what two chips answer with, and the README's line about
  what each type means is the test — "A ramen shop with a drinks licence is
  not a beer pub" was a whole commit, and a correct one.
- A place that is also one of the 32 the Google export matches to the map
  carries `map_id` in `google_venues`; nothing here changes that, and
  `db/google-venues.sql` does not move for a change to the map.

## Closing one

Set `"closed": true` and change nothing else. Do not delete the entry — every
link to it keeps working, which is the whole point — and do not write the
closure into the blurb: the panel says it in every language already. The
README names the closed places in **Close a place instead of deleting it**, so
add it there and move the count. A closed place drops out of **Surprise me**,
out of **Just added**, and out of the locate framing on its own.

## The commit

The subject is a sentence about the place, not about the file:

> Fotografiska is two places, and the ground floor is the laptop one
> A ramen shop with a drinks licence is not a beer pub
> The rest of the Fotografiska photos, including the ones with a laptop in them

The body says why the place is on the map, what it was tagged and why — the
README's definitions are what to argue from — what the counts did, that
`data/places.json` was regenerated, and whether `db/google-venues.sql` moved
(for a map change, it does not). Photos and the entry land in one commit, so
no commit lists a photo that is not there.

## Where it goes wrong

- `data/places.json` not regenerated. It is the most common way to fail CI.
- A photo straight off a phone, 6 MB, committed, and in the history forever.
- `lat` and `lng` the wrong way round — the validator catches it, with 24.7° N
  59.4° E being in the Arabian Sea.
- A count in the README written from a glance rather than counted. "Count the
  split shifts instead of guessing at them" is the commit that fixed two.
