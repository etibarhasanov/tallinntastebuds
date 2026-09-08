---
name: place
description: Add a place to the map, change one, add its photos, or mark it closed. Use for anything in data/restaurants.json or photos/, by hand or through /admin.html.
---

# Add, change or close a place

The map is `data/restaurants.json`: one object per place, hand-written, nothing
in it generated. Three things write to it — a person with an editor, the
**Add a place** and **Edit a place** tabs of `/admin.html`, and the hourly
story cron, which files an expired story's picture onto its place. This is the
process for the first two.

`data/places.json` is the catalogue a list picks from, and it **is** generated
from the map by `node tools/places.mjs`. The validator refuses a catalogue that
is not what the tool would write, or that is missing a place the map has. That
one fact decides most of what follows.

## Read first

- `README.md` → **Add a place** (the field table), **What counts as a
  Restaurant**, **What counts as Laptop friendly**, **Get the coordinates**,
  **Copy a video permalink**, **Add photos**, **Close a place instead of
  deleting it**, and **The admin page** → **Adding a place** / **Changing
  one** / **What it does to a photograph**.
- `photos/README.md` — the size a photo should be and the recipe that gets a
  phone photo there.
- The header of `tools/places.mjs` — why ids are kept, never recomputed.

## The entry

`tools/validate.mjs` (the `places.forEach` at lines 319–490) knows sixteen
keys — `id, name, address, lat, lng, price, types, blurb, mustOrder, reel,
photos, website, phone, added, visited, closed` — and requires the first
twelve. An unknown key is a warning ("typo?"), which is how `blrub` is caught.

| Field | Rule | If wrong |
|---|---|---|
| `id` | `^[a-z0-9]+(-[a-z0-9]+)*$`, unique. It is the `?spot=` link and the `photos/<id>/` folder: **never change it once shared** | error |
| `name`, `address` | non-empty strings. The name exactly as on the door, never translated | error |
| `lat`, `lng` | finite numbers inside `59.32–59.52` / `24.50–25.00`. Swapped, they land in the Arabian Sea and the message says so | error |
| `price` | 1 to 4 in steps of 0.5 | error |
| `types` | array of ids that exist in `data/taxonomy.json`; an empty array is allowed; a repeat only warns | error |
| `blurb` | object by language code; text in at least one; each missing language warns; `TODO`, `PLACEHOLDER`, `lorem ipsum` and em or en dashes warn | error / warning |
| `mustOrder` | array, no empty strings; `[]` is fine | error |
| `reel` | `""` (warns "no reel yet") or an Instagram or TikTok permalink shape. **Never invent a shortcode** — a made-up one resolves to a stranger's post | error |
| `photos` | array of bare filenames matching `\.(webp\|jpg\|jpeg\|png\|avif)$`, each present at `photos/<id>/` | error |
| `website` | absent, `""`, or `https?://…` | error |
| `phone` | absent, `""`, or `^\+[1-9][0-9]{0,3}( [0-9]{2,4}){1,4}$` — `+372 661 0180`. Absent on an open place warns | error / warning |
| `added` | `YYYY-MM-DD`; absent warns, because the place can never show as **Just added** | error / warning |
| `visited` | `YYYY-MM`; absent warns only when there is a reel to date it from | error / warning |
| `closed` | boolean | error |

The taxonomy is checked too: every type needs a label in all ten languages,
and no type may claim `discount` or `saved`. A `photos/` folder no place
points at warns.

`data/schema.json` gives editors autocomplete and is otherwise not enforced;
it does not know `added`, so an editor will flag a key every entry carries.

## The admin road

`/admin.html` → **Add a place** or **Edit a place**. It opens a **pull
request**, not a commit to the live site, because a place is permanent and
its pin can land on the wrong side of the street. What it does, in order:

1. The form: name (the id is made from it, `Põhja Pagar` → `pohja-pagar`, and
   is read-only when editing), address, coordinates by tapping the map,
   dragging the pin or **I am here**, price, types as checkboxes, the
   **English** write-up only, must-orders one per line, reel, website, phone,
   and photographs. Editing adds **This place has closed down**. There is no
   `visited` field. Every rule in the table above that the validator would
   fail on is checked before anything is written, in the same words.
2. Photographs are shrunk on the device down the ladder 1600/0.72, 1400/0.68,
   1200/0.62, 1100/0.58 until under 200 KB, as WebP if the browser can really
   write one and JPEG if not, rotation baked in and EXIF gone. New files are
   numbered **past the highest that has ever been in the folder**, never into
   a gap, because `/photos/*` is cached for a week and a reused name would
   serve last month's picture.
3. Through the GitHub Contents API, one commit per call: a branch
   `admin/add-<id>` or `admin/edit-<id>` off the default branch; `Drop
   <file> from <name>` for each photo un-ticked; `Add <file> for <name>` per
   new photo; then `Add <name>` or `Update <name>` writing the whole of
   `restaurants.json` with the entry slotted in **name order under Estonian
   collation**, which is why Põhja Konn sits after Pulla; then the PR, last,
   so a failure part-way leaves a branch nobody is looking at. An edit starts
   from the existing object, so the other nine write-ups, `visited`, `added`
   and any key the form does not know ride along untouched; blank `website`
   and `phone` are deleted from the object; `types` come out in checkbox
   order. A new place gets `added` = today in Tallinn.
4. **What the page does not do, and a laptop must, before the PR merges:**
   - **Run `node tools/places.mjs` and commit `data/places.json`.** The page
     never touches the catalogue, so every **Add** PR it opens fails CI with
     "is on the map but not in the catalogue", whatever the PR body says
     about going green, and an **Edit** fails if it changed the name, the
     address or the coordinates. Check the branch out, run the tool, commit,
     push, and only then merge.
   - The other nine languages of the write-up. The validator warns about
     them, and the PR body says so.
   - The README counts below.

## The hand road

1. **Write the entry** by copying a live one of the same kind — the live
   ones carry the blurb in ten languages, the README example three. `added`
   is today, `visited` the month you ate there, `reel` is `""` until you hold
   the real link.
2. **Coordinates.** Right-click the pin in Google Maps and paste. The map is
   the proof of the position, not the numbers: open it and check the dot is
   on the right side of the street, because the panel never prints them.
3. **Photos** into `photos/<id>/`, WebP, about 1600 px on the long edge,
   under about 300 KB, EXIF stripped, `NN.webp`. They sit in git history for
   good, so shrink them before committing, never after. List them in
   `photos` in the order they should show.
4. **Is it one place?** A room that is a bakery in the morning and a
   restaurant at night is two entries, and the laptop tag goes on the one it
   is true of. Fotografiska is the precedent.
5. `node tools/places.mjs`.
6. `node tools/validate.mjs`. Read the warnings on the new place; most are
   honest, and `TODO` in a blurb reaches visitors.
7. **The counts.** The README says in prose how many places carry
   `restaurant` and `laptop` — "29 of the 75", "8 of the 75" — and names the
   closed places by name in **Close a place instead of deleting it**. `grep
   -n 'of the 7' README.md` and move each one. The total is also spelled out
   as "seventy-four" in some twenty places across the README, `assets/app.js`,
   `assets/lists.js`, `assets/venues.js`, the Functions and the header of
   `tools/places.mjs`, on a map of seventy-five: a sweep of its own, so fix
   the ones in any file you are already in and leave the rest.
8. **Open the map** on a local server (`python3 -m http.server 8000`;
   `file://` shows an empty map) and look at the pin, the panel, the photos
   in the lightbox, and the chips the new types light up.

## Changing one

- **The id never changes.** If the place renamed itself, change `name`.
- **A renamed place with a discount** is a name in two files: `deals.json`
  copies it, and the validator fails with both spellings if they disagree.
- **A blurb is ten languages.** Changing the English and not the other nine
  leaves nine languages saying the old thing, and nothing catches that.
  Change all ten, or say in the commit why not.
- **A type change is a filter change.** "A ramen shop with a drinks licence
  is not a beer pub" was a whole commit, and the README's definition of each
  type is what to argue from.
- **The name, address or coordinates** change the catalogue row too, so
  `node tools/places.mjs` again.
- `db/google-venues.sql` never moves for a change to the map: the 32 export
  rows matched to it carry `map_id`, and that column survives every refresh.

## Closing one

Set `"closed": true` and change nothing else. Every `?spot=` link keeps
working, the pin greys and gains a dashed ring, the row and the panel say so
in every language, and **Surprise me**, **Just added** and the locate framing
skip it on their own. Do not write the closure into the blurb. Move the
README's list of closed places, which is written by name.

## The commit

The subject is a sentence about the place, not about the file:

> Fotografiska is two places, and the ground floor is the laptop one
> A ramen shop with a drinks licence is not a beer pub
> The rest of the Fotografiska photos, including the ones with a laptop in them

The body says why the place is on the map, what it was tagged and why, what
the counts did, and that `data/places.json` was regenerated. Photos and the
entry land in one commit, so no commit lists a photo that is not there.

## Where it goes wrong

- `data/places.json` not regenerated — by hand, or by every **Add** PR the
  admin page opens. It is the most common way to fail CI.
- A photo straight off a phone, 6 MB, committed, and in the history forever.
- `lat` and `lng` the wrong way round.
- A count or a name list in the README written from memory. "Count the split
  shifts instead of guessing at them" fixed two; the closed-places list has
  been wrong before.
