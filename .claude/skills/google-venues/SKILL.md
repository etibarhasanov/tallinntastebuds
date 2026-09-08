---
name: google-venues
description: Refresh the Google Places export: a new exports/tallinn_restaurants.csv, the generated db/google-venues.sql, and loading it into both databases.
---

# Refresh the Google Places export

751 places in Tallinn out of the Google Places API, mirrored into the
`google_venues` table so a list can hold a place that is not on the map and
`/google` can be a directory of the city. It is somebody else's data about the
city, kept apart from mine about the food, and the whole design of the refresh
is that running it again is safe. The pipeline is three files:

```
exports/tallinn_restaurants.csv   the cleaned export, 18 columns, one line per row
tools/googlevenues.mjs            turns it into SQL
db/google-venues.sql              GENERATED — what actually loads them
```

## Read first

- `README.md` → **Google venues**, all of it, and **The directory**.
- `exports/README.md` — how the raw export was cleaned, and the one row
  typed in by hand.
- The header of `tools/googlevenues.mjs`.

## The CSV

The tool reads columns **by name**, so order does not matter and extras are
tolerated, but a missing one fails loudly "rather than write NULLs over 751
rows". It needs `place_id` plus `name, category, cuisine, rating, reviews,
price, status, address, postal_code, city, phone, website, opening_hours,
tags, latitude, longitude, maps_url`. Every cell is trimmed; a blank
`place_id` skips the row; an id must match `^[A-Za-z0-9_-]{20,255}$`; a
duplicate id stops the run rather than let one row silently win. `rating`,
`reviews`, `latitude`, `longitude` become numbers or `NULL`; everything else
is quoted text.

The raw export is 44 columns and 4,945 physical lines for 750 records,
because `opening_hours` embeds newlines. `exports/clean_restaurants_csv.py`
is what turns it into the file above — drops the empty and constant columns,
collapses hours to one line in 24-hour form (`Mon 11:00-22:00; Sat closed`),
derives `cuisine` and `tags`, rounds coordinates to six places, sorts by
rating. Its default output is `tallinn_restaurants_clean.csv`, **not** the
file the tool reads, so pass the output name or rename it. It reads the raw
columns by name too, so a renamed upstream column stops it before anything
else runs.

**RØST Bakery** was typed into the export by hand. A fresh pull from
upstream does not have it: the refresh marks it `missing_since`, and
`/api/venues` and `/api/places` stop serving it. Either get it into the
upstream pull or add the row back to the CSV after cleaning.

## The steps

1. **Replace `exports/tallinn_restaurants.csv`** with the cleaned export.
2. `node tools/googlevenues.mjs`. It writes `db/google-venues.sql`: a
   comment line with the count, one `UPDATE … SET missing_since = now WHERE
   missing_since IS NULL`, then upserts fifty rows to a statement, then one
   `UPDATE … SET map_id = … WHERE place_id = … AND map_id IS NULL` per row
   matched to the map. The count is in the diff.
3. `node tools/validate.mjs`. Beyond the SQL being what the tool would write,
   it holds the directory's vocabulary to the new export:
   - **every `KITCHENS` pattern in `functions/api/venues.js` must still match
     at least one row.** Eight patterns hang on exactly one venue today —
     `vietnamese`, `indonesian`, `malaysian`, `filipino`, `taiwanese`,
     `greek`, `german`, `peruvian` — so one place leaving the export fails CI
     until its pattern goes from `venues.js` **and** its label from
     `data/cuisines.json`, together, because every cuisine id must be
     producible by a pattern and every pattern's id must have ten labels.
   - A malformed CSV surfaces here as "the SQL is stale", because the check
     swallows the parser's error. Run the tool by hand to see the real cause.
4. **Read the diff of the SQL** before it goes anywhere. Being readable
   before it runs is the reason it is a file rather than a script holding a
   token.
5. **Apply it to both databases**, schema first if the table is new:

   ```
   wrangler d1 execute tallinntastebuds         --remote --file=db/google-venues.sql
   wrangler d1 execute tallinntastebuds-preview --remote --file=db/google-venues.sql
   ```

   Nothing in CI applies it. A preview that cannot see these places shows an
   empty picker and looks broken for no reason. The mark-missing `UPDATE`
   carries a `WHERE`, so the D1 denials in `.claude/settings.json` let it
   through; a half-applied file leaves the rows after the break marked
   missing until the next complete run.
6. **The counts.** 751 is written in digits and in words across the README,
   `exports/README.md`, `db/schema.sql`'s comments (which still say 750 in
   seven places, from before RØST), `functions/api/venues.js`,
   `functions/api/_lib.js` and `tools/validate.mjs`, along with the numbers
   that hang off it: 32 on the map, 45 temporarily closed, 368 with no
   cuisine, 225 with no kitchen, 740 with at least one kind, 161 ids with an
   underscore and none all-lowercase — that last one is what `isAdded()`
   relies on to tell a Google key from a hand-added place, so re-run the
   count SQL in `db/schema.sql` after a refresh. The validator prints the
   live total, and this finds the copies:

   ```
   grep -rn '751\|seven hundred and fifty' --include=*.md --include=*.js --include=*.mjs --include=*.sql .
   ```

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
  and sorted by on `/google` alone. Nothing on the map carries a score.

## The commit

> Say seven hundred and fifty-one where the count is spelled out
> A place off the Google export says everything Google knows about it

The body says what changed in the export — rows added, rows now missing,
categories renamed, patterns dropped — and that both databases were loaded.

## The pull request

1. `git fetch origin claude/tallinn-tastebuds-map-nzoqx0 && git rebase origin/claude/tallinn-tastebuds-map-nzoqx0`
2. `node tools/googlevenues.mjs`, then `node tools/validate.mjs`, and read
   the SQL diff before going on.
3. Load the SQL into **preview** from the branch —
   `wrangler d1 execute tallinntastebuds-preview --remote --file=db/google-venues.sql`
   — and open the PR's preview deployment at `/google` and the list picker
   to see the rows arrive, and RØST still there.
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
   at once, so the live directory and the file say the same thing.

## Where it goes wrong

- The SQL regenerated and applied to production only.
- The cleaner's output left under its default name, so the tool reads the
  old file and reports nothing stale.
- RØST dropped by a fresh pull, and quietly marked missing.
- A hand-edit to a Google column, gone at the next refresh.
- A count that moved in one place and not the others.
