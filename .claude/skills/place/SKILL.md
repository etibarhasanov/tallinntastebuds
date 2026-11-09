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

`tools/validate.mjs` (the `restaurants.json` block, the `places.forEach`
in it) knows seventeen keys — `id, name, address, lat, lng, price, types,
blurb, mustOrder, reel, reelSummary, photos, website, phone, added, visited,
closed` —
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
| `reelSummary` | optional: one plain sentence, under 200 characters, about what the reel shows, written by somebody who watched it, and only beside a `reel`. `/mcp` hands it to an assistant as `reel_summary` and it is the only thing an assistant may say about the video. **Never written from the name or the write-up** — left out is the honest answer | error |
| `photos` | array of bare filenames matching `\.(webp\|jpg\|jpeg\|png\|avif)$`, each present at `photos/<id>/` | error |
| `website` | absent, `""`, or `https?://…` | error |
| `phone` | absent, `""`, or `^\+[1-9][0-9]{0,3}( [0-9]{2,4}){1,4}$` — `+372 661 0180`. Absent on an open place warns | error / warning |
| `added` | `YYYY-MM-DD` when present, and nothing reads it since **Just added** was taken out — absent is fine and warns about nothing. `/admin.html` still stamps one | error |
| `visited` | `YYYY-MM`; absent warns only when there is a reel to date it from | error / warning |
| `closed` | `false`, `true`, or `"temporary"` — a door that should open again, Google's word, raised from the admin page's Google tab | error |

The taxonomy is checked too: every type needs a label in all eleven languages,
and no type may claim `discount` or `saved`. A `photos/` folder no place
points at warns.

`data/schema.json` gives editors autocomplete and is otherwise not enforced;
it does not know `added`, so an editor will flag a key every entry carries.

## The admin road

`/admin.html` → **Add a place** or **Edit a place**, signed in on the site as
the owner — no token on the device; the site writes with its `GITHUB_TOKEN`
secret through `/api/admin/github/`. Nothing about it is a pull request. What
it does, in order:

1. **Find it**: a search over Google's directory (`/api/admin/venues`). A
   pick fills the name, address, pin, phone (into `+372 …` form), website and
   price; a row already tied to a place opens its edit instead; **Not in the
   list** opens the form blank. Edit starts from the place picker.
2. **Your take**: types, price, the **English** write-up only, must-orders
   one per line, photographs; the id (made from the name, `Põhja Pagar` →
   `pohja-pagar`, read-only when editing) and the reel under **More**. Editing
   adds **Open or closed** — Open, Temporarily closed, Closed for good. There
   is no `visited` field. Every rule in the table above that the validator
   would fail on is checked before anything is written, in the same words.
3. Photographs are shrunk on the device down the ladder 1600/0.72, 1400/0.68,
   1200/0.62, 1100/0.58 until under 200 KB, as WebP if the browser can really
   write one and JPEG if not, rotation baked in and EXIF gone. New files are
   numbered **past the highest that has ever been in the folder**, never into
   a gap, because `/photos/*` is cached for a week and a reused name would
   serve last month's picture.
4. **One commit** through the Git Data API, `savePlace()`: the photographs as
   blobs, `restaurants.json` with the entry slotted in **name order under
   Estonian collation**, photos un-ticked removed from the tree, one commit
   `Add <name>` or `Update <name>` on the default branch's tip, and the branch
   `admin/add-<id>` or `admin/edit-<id>` pointed at it last. An edit starts
   from the existing object, so the other ten write-ups, `visited`, `added`
   and any key the form does not know ride along untouched; blank `website`
   and `phone` are deleted from the object; `types` come out in checkbox
   order. A new place gets `added` = today in Tallinn.
5. **The `land` job in `.github/workflows/generated.yml`** replays that
   commit onto the default branch, runs `node tools/generate.mjs`, folds what
   it wrote into the commit, runs every check CI runs, pushes to the default
   branch if they pass, deletes the admin branch, and starts `validate.yml`
   and `indexnow.yml`. The page watches the run and then `data/map.json` and
   says **Live** when the place is there.
6. **What it does not do:** the other ten languages of the write-up (they
   show the English until translated, and the validator warns); the README
   counts below; and the `map_id` line in `db/google-venues.sql` is written
   but not loaded — that one is a D1 write and asks.

## The hand road

1. **Write the entry** by copying a live one of the same kind — the live
   ones carry the blurb in eleven languages, the README example three. `added`
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
5. `node tools/places.mjs` and `node tools/languages.mjs` — the second
   writes `data/map.json` and the write-ups into `data/lang/`, which is what
   the map actually reads, so any change to `restaurants.json` wants it. If the place
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
   `restaurant` and `laptop` — "31 of the 78", "8 of the 78" — and names the
   closed places by name in **Close a place instead of deleting it**. `grep
   -n 'of the 7' README.md` and move each one. The total is also spelled out
   in words — "seventy-eight" today; a "seventy-four" or "seventy-five" is a
   file written before the last sweep — across the README, the scripts, the
   Functions and the header of `tools/places.mjs`. A comment in an `assets/`
   file that is not one of the lean pair costs every page a new `?v=` stamp,
   so those move only with a change that was going there anyway. This finds
   every copy:

   ```
   grep -rn 'seventy-' --include=*.md --include=*.js --include=*.mjs --include=*.html .
   ```

   Moving them all is a sweep of its own, so fix the ones in any file you
   are already in and leave the rest; `node tools/validate.mjs` prints the
   true total on its last line, closed places included.
8. **Open the map** on a local server (`python3 -m http.server 8000`;
   `file://` shows an empty map) and look at the pin, the panel, the photos
   in the lightbox, and the chips the new types light up.

## Changing one

- **The id never changes.** If the place renamed itself, change `name`.
- **A renamed place with a discount** is a name in two files: `deals.json`
  copies it, and the validator fails with both spellings if they disagree.
- **A blurb is eleven languages.** Changing the English and not the other ten
  leaves eleven languages saying the old thing, and nothing catches that.
  Change all eleven, or say in the commit why not.
- **A type change is a filter change.** "A ramen shop with a drinks licence
  is not a beer pub" was a whole commit, and the README's definition of each
  type is what to argue from.
- **The name, address or coordinates** change the catalogue row too, so
  `node tools/places.mjs` again.
- `db/google-venues.sql` never moves for a change to a place that is already
  on the map: the export rows matched to it carry `map_id` — `grep -c 'SET
  map_id' db/google-venues.sql` says how many — and that column survives
  every refresh. **Adding** a place the export already lists
  does move it — step 5 of **The hand road** says how.

## Closing one

Set `"closed": true` and change nothing else — or `"closed": "temporary"`
for a door that should open again, which is normally not typed at all: the
**Google** tab on `/admin.html` lists every place where Google's status and
the map disagree and saves the edit that moves it, both ways, landed like
any other admin edit. **The map
against Google** under **The admin page** in `README.md`. Either way, every `?spot=` link keeps
working, the pin greys and gains a dashed ring, the row and the panel say so
in every language, and **Surprise me** and the locate framing skip it on their
own. It still sorts into the list by distance like everything else, greyed —
being shut is a fact about the row, not a reason to hide it. Do not write the
closure into the blurb. Move the
README's list of closed places, which is written by name.

**A blog post that links the place breaks the build.** `tools/validate.mjs`
refuses a `?spot=` link in `data/blog.json` to a place that is not open, so
closing one a post recommends is red until the post says so: `grep -n
'spot=<id>' data/blog.json`, take the link off the name and say in a clause
that it has closed. The admin page cannot do that edit, so an admin branch
that closes such a place goes red and lands nothing. Faeton was
the first.

## The commit

The subject is a sentence about the place, not about the file:

> Fotografiska is two places, and the ground floor is the laptop one
> A ramen shop with a drinks licence is not a beer pub
> The rest of the Fotografiska photos, including the ones with a laptop in them

The body says why the place is on the map, what it was tagged and why, what
the counts did, and that `data/places.json` was regenerated. Photos and the
entry land in one commit, so no commit lists a photo that is not there.

## The pull request

**The pull request** in `CLAUDE.md` is the sequence, and this process adds:

- The generators here are `node tools/places.mjs` and `node
  tools/languages.mjs` — and `node tools/googlevenues.mjs` for a place the
  export already lists. The catalogue is the check this process fails most.
- The map on a local server: the pin where the door is, the panel, the
  photos, the chips.
- One commit with the photos and the entry together, subject a sentence
  about the place.
- The body says why the place is on the map, what it was tagged and why, what
  the counts did, that the catalogue was regenerated, which blurb languages
  are still to come, and, for a place the export already listed, the one
  `map_id` line in `db/google-venues.sql` that has still to be loaded.
- Landed, the place is on the live map within the minute.

**A red admin branch** (`admin/add-<id>` or `admin/edit-<id>` still there,
its `generated` run red) put nothing live. The run's log names the check
that failed; the usual two are a blog post linking a place the edit closed
(**Closing one**), and the same lines of `restaurants.json` changed on the
default branch since the page read them, which makes the replay refuse. Fix
it on a branch of your own and land that through a pull request like any
other:

```
git fetch origin admin/add-<id>
git checkout -b claude/<name> origin/claude/tallinn-tastebuds-map-nzoqx0
git cherry-pick origin/admin/add-<id>      # resolve, if it was the replay
node tools/generate.mjs && node tools/validate.mjs
```

Then the other ten blurb languages on the same branch, if you have them.

## Where it goes wrong

- `data/places.json` not regenerated by hand. The generated workflow now
  catches it with a commit of its own, but running `node tools/generate.mjs`
  before the push saves the round trip.
- A photo straight off a phone, 6 MB, committed, and in the history forever.
- `lat` and `lng` the wrong way round.
- A place the directory already listed, added without `node
  tools/googlevenues.mjs`, so CI fails on `db/google-venues.sql` and the
  message blames an export nobody touched.
- A count or a name list in the README written from memory. "Count the split
  shifts instead of guessing at them" fixed two; the closed-places list has
  been wrong before.
