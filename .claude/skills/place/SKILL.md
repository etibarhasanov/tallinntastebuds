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

`db/type-lists.sql` is the second thing generated from the map: the thirteen
filter chips published as lists, by `node tools/typelists.mjs`, and the
validator refuses it stale the same way. Both tools run on every change here,
because a place with `types` on it belongs on a list the moment it is on the
map. The difference is that the catalogue ships with the push and the lists do
not — the SQL is **loaded into D1 by hand, and that is the owner's yes**, not
something a merge carries. See **The rules of a write** in `/api`, and
**The chips, as lists** in `README.md`.

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

`tools/validate.mjs` (the `restaurants.json` block, the `places.forEach`
in it) knows sixteen keys — `id, name, address, lat, lng, price, types,
blurb, mustOrder, reel, photos, website, phone, added, visited, closed` —
and requires the first twelve. An unknown key is a warning ("typo?"), which is how `blrub` is caught.

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
| `added` | `YYYY-MM-DD` when present, and nothing reads it since **Just added** was taken out — absent is fine and warns about nothing. `/admin.html` still stamps one | error |
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
   - **Run `node tools/typelists.mjs` and commit `db/type-lists.sql`** on the
     same branch. The page does not touch that either, and CI fails on it for
     an **Add** carrying any type, or an **Edit** that changed `types`, the
     name or the English write-up.
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
   `photos` in the order they should show — and note that the **first one is
   also the place's social card**, the picture that comes up when somebody
   pastes its `?spot=` link into a chat. A place with no photos gets the mark
   instead. `functions/index.js` and **Sharing a place** in `README.md`.
4. **Is it one place?** A room that is a bakery in the morning and a
   restaurant at night is two entries, and the laptop tag goes on the one it
   is true of. Fotografiska is the precedent.
5. `node tools/places.mjs`, then `node tools/typelists.mjs`. If the place
   was a row in the directory already — `grep -i '<name>'
   exports/tallinn_restaurants.csv` says — then `node tools/googlevenues.mjs`
   too: `overlaps()` in that tool matches the new entry to its Google row by
   distance and name and adds one `UPDATE … SET map_id` line to
   `db/google-venues.sql`, and the validator fails on the file without it,
   with a message about the export nobody touched. That one line is a D1
   write of its own, loaded the way the lists are; Varkizana was the first
   place to arrive this way.
6. `node tools/validate.mjs`. Read the warnings on the new place; most are
   honest, and `TODO` in a blurb reaches visitors.
7. **The counts.** The README says in prose how many places carry
   `restaurant` and `laptop` — "29 of the 75", "8 of the 75" — and names the
   closed places by name in **Close a place instead of deleting it**. `grep
   -n 'of the 7' README.md` and move each one. The total is also spelled out
   in words — "seventy-four" in the files written before the last place,
   "seventy-five" in the ones written since — across the README, the
   scripts, the Functions and the header of `tools/places.mjs`. This finds
   every copy:

   ```
   grep -rn 'seventy-f' --include=*.md --include=*.js --include=*.mjs .
   ```

   Moving them all is a sweep of its own, so fix the ones in any file you
   are already in and leave the rest; `node tools/validate.mjs` prints the
   true total on its last line.
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
- **`types`, the name, or the English write-up** change the published lists,
  so `node tools/typelists.mjs` again. The English first sentence is what a
  list prints under a place; the other nine languages never reach one.
- `db/google-venues.sql` never moves for a change to a place that is already
  on the map: the 61 export rows matched to it carry `map_id`, and that
  column survives every refresh. **Adding** a place the export already lists
  does move it — step 5 of **The hand road** says how.

## Closing one

Set `"closed": true` and change nothing else. Every `?spot=` link keeps
working, the pin greys and gains a dashed ring, the row and the panel say so
in every language, and **Surprise me** and the locate framing skip it on their
own. It still sorts into the list by distance like everything else, greyed —
being shut is a fact about the row, not a reason to hide it. Do not write the
closure into the blurb. Move the
README's list of closed places, which is written by name.

The published lists do not skip it on their own: `node tools/typelists.mjs`
takes it off every list it was on, and the rows only actually go when the SQL
is loaded. A closed place left on a list is the loudest way this can be
wrong — a page sending somebody to a restaurant that shut — so say in the PR
which lists lost it.

## The commit

The subject is a sentence about the place, not about the file:

> Fotografiska is two places, and the ground floor is the laptop one
> A ramen shop with a drinks licence is not a beer pub
> The rest of the Fotografiska photos, including the ones with a laptop in them

The body says why the place is on the map, what it was tagged and why, what
the counts did, and that `data/places.json` was regenerated. Photos and the
entry land in one commit, so no commit lists a photo that is not there.

## The pull request

1. `git fetch origin claude/tallinn-tastebuds-map-nzoqx0 && git rebase origin/claude/tallinn-tastebuds-map-nzoqx0`
2. `node tools/places.mjs` and `node tools/typelists.mjs` — and `node
   tools/googlevenues.mjs` for a place the export already lists — then
   `node tools/validate.mjs`. The catalogue is the check this process fails
   most.
3. The map on a local server: the pin where the door is, the panel, the
   photos, the chips.
4. One commit with the photos and the entry together, subject a sentence
   about the place.
5. `git push -u origin <branch>`, or `--force-with-lease` after a rebase.
6. Open the PR against the default branch. The body says why the place is on
   the map, what it was tagged and why, what the counts did, that the
   catalogue was regenerated, which blurb languages are still to come, and
   **which lists in `db/type-lists.sql` moved and that it has still to be
   loaded** — with the two `wrangler d1 execute` lines, so the owner can run
   them in a minute. A place the export already listed adds a third file to
   that paragraph: the one `map_id` line in `db/google-venues.sql`.
7. CI green — the validator, the QR check, the preview deploy — then **Rebase
   and merge**; the branch stays, `CLAUDE.md` says why. The place is on the
   live map within the minute.

**A PR the admin page opened** (`admin/add-<id>` or `admin/edit-<id>`) is
red until the catalogue is regenerated, so it is landed like this:

```
git fetch origin admin/add-<id> && git checkout admin/add-<id>
node tools/places.mjs && node tools/typelists.mjs && node tools/validate.mjs
git commit -am "The catalogue knows <name>" && git push
```

Then the other nine blurb languages on the same branch, if you have them,
and the same merge. The map is live with the push; the lists are not, until
`db/type-lists.sql` is loaded into both databases, which is the owner's
call.

## Where it goes wrong

- `data/places.json` not regenerated — by hand, or by every **Add** PR the
  admin page opens. It is the most common way to fail CI.
- `db/type-lists.sql` regenerated, committed, merged, and never loaded, so
  the live lists are the map as it was a fortnight ago. CI cannot see this
  one; only the PR body saying it is outstanding can.
- A photo straight off a phone, 6 MB, committed, and in the history forever.
- `lat` and `lng` the wrong way round.
- A place the directory already listed, added without `node
  tools/googlevenues.mjs`, so CI fails on `db/google-venues.sql` and the
  message blames an export nobody touched.
- A count or a name list in the README written from memory. "Count the split
  shifts instead of guessing at them" fixed two; the closed-places list has
  been wrong before.
