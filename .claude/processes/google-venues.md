# Refresh the Google Places export

751 places in Tallinn out of the Google Places API, mirrored into the
`google_venues` table so a list can hold a place that is not on the map and
`/google` can be a directory of the city. It is somebody else's data about the
city, kept apart from mine about the food, and the whole design of the refresh
is that running it again is safe.

## Read first

- `README.md` → **Google venues**, all of it, and **The directory** for what
  reads the table.
- `exports/README.md` — how the raw export was cleaned into
  `exports/tallinn_restaurants.csv`, and the one hand-typed row and what it
  costs the next refresh.
- The header of `tools/googlevenues.mjs`: why it writes a file of SQL rather
  than talking to D1, which columns a refresh overwrites and which it never
  touches, and how a place that left the export is noticed.

## The steps

1. **Replace the CSV**, cleaned the way `exports/README.md` describes: the
   empty columns dropped, times in 24-hour form, and the hours that embed real
   newlines handled — the raw file is thousands of physical lines for 751
   records, so a naive parser gets it wrong.
2. `node tools/googlevenues.mjs` rewrites `db/google-venues.sql`. It is
   generated and CI refuses a stale one, via `--check` inside the validator.
3. `node tools/validate.mjs`. It also checks that every `KITCHENS` pattern in
   `functions/api/venues.js` still matches at least one row of the new export,
   and that every cuisine the patterns can produce has a label in all ten
   languages in `data/cuisines.json`. A refresh that renames a category makes
   a pattern match nothing, and that is an error, not a warning.
4. **Read the diff of the SQL** before it goes anywhere: it is the thing that
   touches the production database, and being readable before it runs is the
   reason it is a file.
5. Apply it to **both** databases, always — a preview that cannot see these
   places shows an empty picker and looks broken for no reason:

   ```
   wrangler d1 execute tallinntastebuds         --remote --file=db/google-venues.sql
   wrangler d1 execute tallinntastebuds-preview --remote --file=db/google-venues.sql
   ```

   `db/schema.sql` has to have been applied first.
6. **The counts.** 751 is written in digits and in words into the README and
   the headers of `db/schema.sql`, `functions/api/venues.js` and
   `assets/venues.js` — "seven hundred and fifty-one" was a commit of its own.
   If the row count moved, `grep -rn '751\|seven hundred'` finds every copy;
   move each one.

## The rules of the table

- `place_id`, Google's `ChIJ…` key, is the primary key and what a list item
  holds. A catalogue slug is lowercase letters, digits and hyphens, so the two
  can never be mistaken for each other.
- **Google's columns are overwritten by every refresh, without asking.** Do
  not hand-edit them: the correction lasts until the next sync. If a name is
  wrong and it matters, promote the place onto the map, where
  `data/restaurants.json` is hand-written and mine.
- **`map_id`, `hidden` and `note` are never touched by a refresh.** `map_id`
  is set only when empty — the 32 matched on coordinates rather than names —
  so a correction made by hand survives every future run.
- **Nothing is ever deleted.** A row that left the export gets
  `missing_since`, because a list may point at it and somebody wrote a
  sentence about it.
- `rating` and `reviews` are Google's, shown attributed on Google's places and
  nowhere else, and never sorted by outside `/google`. Nothing on the map
  carries a score.

## The commit

> Say seven hundred and fifty-one where the count is spelled out
> A place off the Google export says everything Google knows about it

The body says what changed in the export — rows added, rows now missing,
categories renamed — and that both databases were loaded.

## Where it goes wrong

- The SQL regenerated and applied to production only.
- A hand-edit to a Google column, gone at the next refresh.
- A count that moved in one place and not the others.
