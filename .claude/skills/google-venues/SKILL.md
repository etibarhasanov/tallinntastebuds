---
name: google-venues
description: Refresh the Google Places export: a new exports/tallinn_restaurants.csv, the generated db/google-venues.sql, and loading it into both databases.
---

# Refresh the Google Places export

1,110 places in Tallinn out of the Google Places API, mirrored into the
`google_venues` table so a list can hold a place that is not on the map and
`/google` can be a directory of the city. The number moves with every
refresh — the first pull found 750 restaurants, the second sweep, over
seventeen Google types, found the rest — so read it off the first line of
`db/google-venues.sql` rather than off this page. It is somebody else's data
about the city, kept apart from mine about the food, and the whole design of
the refresh is that running it again is safe. The pipeline is three files:

```
exports/tallinn_restaurants.csv   the cleaned export, 18 columns, one line per row
tools/googlevenues.mjs            turns it into SQL
db/google-venues.sql              GENERATED — what actually loads them
tools/googlelists.mjs             reads the same export and ranks it
db/google-lists.sql               GENERATED — the six top tens under `google-statistics`
```

The second pair is the same export read again: six public lists — top ten
restaurants, bakeries, cafés, bars, pizzerias, and the map's own
laptop-friendly places — under an account called `google-statistics` that
nobody can sign in as, ordered by Google's rating weighed by its review count.
The laptop pool is the `laptop` type in `data/restaurants.json`, joined to the
export through the same match that sets `map_id`. **The six lists Google
wrote** under **Google venues** in `README.md` is the argument and the
arithmetic. They refresh with the export, and the validator holds them to it
the same way.

## Read first

- `README.md` → **Google venues**, all of it — **The six lists Google
  wrote** included — and **The directory**.
- `exports/README.md` — how the raw export was cleaned, column by column, and
  where the upstream sweep lives. `exports/REVIEW.md` is the shortlisting
  worksheet built from the same file by `build_review_sheet.py`; it is for
  deciding which places join the map, and nothing reads it.
- The header of `tools/googlevenues.mjs`.

## The CSV

The tool reads columns **by name**, so order does not matter and extras are
tolerated, but a missing one fails loudly rather than write NULLs over a
thousand rows. It needs `place_id` plus `name, category, cuisine, rating,
reviews, price, status, address, postal_code, city, phone, website,
opening_hours, tags, latitude, longitude, maps_url`. Every cell is trimmed; a blank
`place_id` skips the row; an id must match `^[A-Za-z0-9_-]{20,255}$`; a
duplicate id stops the run rather than let one row silently win. `rating`,
`reviews`, `latitude`, `longitude` become numbers or `NULL`; everything else
is quoted text.

The raw export is 44 columns and several times the physical lines of the
records in it, because `opening_hours` embeds newlines.
`exports/clean_restaurants_csv.py` is what turns it into the file above —
drops the empty and constant columns, collapses hours to one line in 24-hour
form (`Mon 11:00-22:00; Sat closed`), derives `cuisine` and `tags`, rounds
coordinates to six places, sorts by rating. Its default output is
`tallinn_restaurants_clean.csv`, **not** the file the tool reads, so pass the
output name as `exports/README.md` shows, or rename it. It reads the raw
columns by name too, so a renamed upstream column stops it before anything
else runs.

## The steps

1. **Replace `exports/tallinn_restaurants.csv`** with the cleaned export. Read
   **Hand-corrections** in `exports/README.md` first: it lists the rows whose
   Google columns were edited by hand, and this step is what erases every one
   of them. That is the correct outcome and not a loss to undo — the fresher
   figure is upstream's to carry now — but say in the PR which corrections
   went, because somebody asked for each of them.
2. `node tools/googlevenues.mjs`. It writes `db/google-venues.sql`: a
   comment line with the count, one `UPDATE … SET missing_since = now WHERE
   missing_since IS NULL`, then upserts fifty rows to a statement, then one
   `UPDATE … SET map_id = … WHERE place_id = … AND map_id IS NULL` per row
   matched to the map. The count is in the diff.
   Then `node tools/googlelists.mjs`, which rewrites `db/google-lists.sql`
   from the new export; `--show` first prints the six top tens with the
   score, rating and count beside each name, which is the diff worth reading
   before the SQL's.
3. `node tools/validate.mjs`. Beyond both SQL files being what their tool
   would write, it holds the directory's vocabulary to the new export:
   - **every `KITCHENS` pattern in `functions/api/venues.js` must still match
     at least one row.** Seven patterns hang on exactly one venue today —
     `vietnamese`, `indonesian`, `malaysian`, `filipino`, `greek`, `german`,
     `peruvian` — so one place leaving the export fails CI until its pattern
     goes from `venues.js` **and** its label from `data/cuisines.json`,
     together, because every cuisine id must be producible by a pattern and
     every pattern's id must have ten labels. The validator's message names
     the pattern.
   - A malformed CSV surfaces here as "the SQL is stale", because the check
     swallows the parser's error. Run the tool by hand to see the real cause.
4. **Read the diff of the SQL** before it goes anywhere. Being readable
   before it runs is the reason it is a file rather than a script holding a
   token.
5. **Apply it to both databases**, schema first if the table is new:

   ```
   wrangler d1 execute tallinntastebuds         --remote --file=db/google-venues.sql
   wrangler d1 execute tallinntastebuds-preview --remote --file=db/google-venues.sql
   wrangler d1 execute tallinntastebuds         --remote --file=db/google-lists.sql
   wrangler d1 execute tallinntastebuds-preview --remote --file=db/google-lists.sql
   ```

   The lists file after the venues file, always: its rows point at
   `google_venues` keys, and a top ten loaded before the venue it names is a
   row that draws by its stored name and links nowhere. Its one `DELETE`
   names the six lists in its `WHERE`, so the denials let it through.
   Nothing in CI applies it. A preview that cannot see these places shows an
   empty picker and looks broken for no reason. The mark-missing `UPDATE`
   carries a `WHERE`, so the D1 denials in `.claude/settings.json` let it
   through; a half-applied file leaves the rows after the break marked
   missing until the next complete run.
6. **The counts.** The total is written in digits ("1,110") and in words
   ("eleven hundred") across the README, `exports/README.md`,
   `exports/REVIEW.md`, `functions/api/ask.js`, `functions/api/venues.js`
   and the comment above the check in `tools/validate.mjs`, along with the
   numbers that hang off it — how many are matched to the map (the `SET
   map_id` lines at the end of the SQL, 61 today), how many have no cuisine,
   how many rows the raw export ran to. This finds the copies:

   ```
   grep -rn '1,110\|eleven hundred\|1110' --include=*.md --include=*.js --include=*.mjs --include=*.sql . | grep -v google-venues.sql
   ```

   One of those numbers is load-bearing rather than descriptive:
   `isAdded()` in `functions/api/_lib.js` tells a hand-added place from a
   Google one by the key being **all lowercase with an underscore in it**,
   which no Google `place_id` is — they are mixed case. After a refresh,
   `grep -o "('Ch[A-Za-z0-9_-]*'" db/google-venues.sql | grep -c '^([a-z0-9_-]*$'`
   must print `0`, or a Google row will be read as somebody's addition.

## The rules of the table

- `place_id`, Google's key, is the primary key and what a list item holds. A
  catalogue slug is lowercase letters, digits and hyphens, so the two can
  never be mistaken for each other.
- **Google's seventeen columns are overwritten by every refresh, without
  asking.** Do not hand-edit them: "hand-curation that a sync can erase is
  curation you will do twice". If a name is wrong and it matters, promote the
  place onto the map, where `data/restaurants.json` is hand-written.
- **`map_id`, `hidden`, `note` and `first_seen_at` are never touched.**
  `map_id` is set only when empty, from a match within 60 metres whose folded
  names contain one another, closest wins; a correction made by hand
  survives every run.
- **Nothing is ever deleted.** A row that left the export gets
  `missing_since`, because a list may point at it and somebody wrote a
  sentence about it. Every upsert clears the mark again.
- `rating` and `reviews` are Google's, shown attributed on Google's places
  and sorted by in two places only, both under Google's name: `/google`, and
  the six lists `db/google-lists.sql` writes. Nothing on the map carries a
  score.

## The commit

> Say seven hundred and fifty-one where the count is spelled out
> A place off the Google export says everything Google knows about it

The body says what changed in the export — rows added, rows now missing,
categories renamed, patterns dropped — and that both databases were loaded.

## The pull request

1. `git fetch origin claude/tallinn-tastebuds-map-nzoqx0 && git rebase origin/claude/tallinn-tastebuds-map-nzoqx0`
2. `node tools/googlevenues.mjs`, `node tools/googlelists.mjs`, then
   `node tools/validate.mjs`, and read both SQL diffs before going on.
3. Load the SQL into **preview** from the branch —
   `wrangler d1 execute tallinntastebuds-preview --remote --file=db/google-venues.sql`,
   then the same with `db/google-lists.sql` — then push the branch, which
   deploys a preview of it, and open that preview's `/google`, the list
   picker and `/u/google-statistics` to see the rows arrive.
4. One commit for the export and its SQL; a second for any `KITCHENS`
   pattern and cuisine label that had to go with it, and a third for the
   counts, if they moved.
5. `git push -u origin <branch>`, or `--force-with-lease` after a rebase.
6. Open the PR against the default branch. The body says how many rows came
   and went, which categories renamed, which patterns were dropped, that
   preview was loaded, and that **production needs the same load on
   landing**.
7. CI green, then **Rebase and merge**, delete the branch, and
   `wrangler d1 execute tallinntastebuds --remote --file=db/google-venues.sql`
   then the same with `db/google-lists.sql`, at once, so the live directory,
   the six lists and the files say the same thing.

## Where it goes wrong

- The SQL regenerated and applied to production only.
- The cleaner's output left under its default name, so the tool reads the
  old file and reports nothing stale.
- A row typed into the CSV by hand — RØST Bakery was, once — and dropped by
  the next pull, quietly marked missing. The export is upstream's; a place
  the sweep does not find goes on the map instead. A *column* edited by hand
  goes the same way and more quietly still, since the row survives and only
  the number moves back: **Hand-corrections** in `exports/README.md` is the
  list of those, and step 1 is where it is read.
- A hand-edit to a Google column, gone at the next refresh.
- A count that moved in one place and not the others — this file said 751
  for a refresh that brought 1,110.
- The venues file regenerated and the lists file not, so CI fails on a top
  ten that names last month's order; or the lists file loaded and the
  venues file not, so a top ten names a place the table has not got yet.
