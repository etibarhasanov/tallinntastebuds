# Tallinn restaurants — cleaned export

`tallinn_restaurants.csv` — **750 restaurants, 18 columns**, reshaped from the raw
Google Places export in
[`etibarhasanov/allRestaurants`](https://github.com/etibarhasanov/allRestaurants/blob/claude/google-maps-restaurants-salesforce-iz2bj5/exports/tallinn_restaurants.csv)
(44 columns). Regenerate with `clean_restaurants_csv.py` when the upstream export refreshes.

Rows are sorted best-first: rating descending, then review count, then name.

## Columns

| column | notes |
|---|---|
| `name` | whitespace-normalized |
| `category` | Google's venue label — `Restaurant`, `Sushi Restaurant`, `Bistro`, … |
| `cuisine` | derived; grouped so it is filterable (`sushi`/`ramen`/`izakaya` → `Japanese`). Blank for 367 rows — see gaps below |
| `rating` | 2.2 – 5.0 |
| `reviews` | Google review count, 25 – 12,238 |
| `price` | `$` – `$$$$` |
| `status` | `Open` or `Temporarily closed` |
| `address` | street address; city suffix moved to its own column |
| `postal_code`, `city` | `city` is `Tallinn` (744) or `Peetri` (6) |
| `phone` | international format only, `+372 …` |
| `website` | |
| `opening_hours` | one line, 24-hour: `Mon 11:00-22:00; Sat closed`. Multiple sittings comma-separated; `00:00-24:00` = open 24h. A close time earlier than the open time means it closes after midnight |
| `tags` | remaining Google type tags, boilerplate stripped |
| `latitude`, `longitude` | 6 decimals |
| `maps_url` | Google Maps link, telemetry parameter stripped |
| `place_id` | stable Google key — use this to join against the raw export |

## What was dropped

- **15 columns that were 100% empty** in the source: `district`, `editorial_summary`,
  and every service flag (`takeout`, `delivery`, `dine_in`, `reservable`,
  `serves_breakfast`/`lunch`/`dinner`/`beer`/`wine`/`vegetarian_food`,
  `outdoor_seating`, `good_for_children`, `wheelchair_accessible_entrance`).
  The export requested them but the API returned nothing, so they carried no data.
- **Constant columns**: `country` (Estonia), `country_code` (EE),
  `utc_offset_minutes` (180), `region` (one county, spelled two ways —
  `Harju maakond` / `Harju County`).
- **Duplicates**: `price_level` (kept `price_label`), `primary_type`
  (kept the human label), `phone` local format (kept international),
  `formatted_address` and `street_number`/`street` (kept `address` + `postal_code`),
  `plus_code` (redundant with lat/lon).
- **`open_now`** — a snapshot of whether the place happened to be open at scrape
  time. Meaningless in a static file; `opening_hours` is the durable version.

## Fixes applied

- The raw file is **4,945 physical lines but only 750 records** — `opening_hours`
  embeds real newlines. Anything that splits on `\n` instead of parsing CSV will
  mis-read it by 6.6×. Hours are now single-line.
- Google's narrow no-break (U+202F) and thin (U+2009) spaces and en-dashes,
  present in 690 of 699 hour strings, normalized to ASCII.
- 12-hour times converted to 24-hour, including Google's compact form where the
  start time's meridiem is implied by the end (`12:00 – 3:00 PM` → `12:00-15:00`).
- Coordinate float noise rounded (`59.42788669999999` → `59.427887`).
- `Shawarma restaurant` case-normalized to match the other 82 labels.

No records were dropped or merged: `place_id` and name+address are already unique,
and every rating and review count round-trips against the source.

## Findings

**Ratings run high and compressed.** Median 4.5, mean 4.38; 87% of the list sits at
4.0 or above and only 26 places fall below 3.5. Rating alone barely separates
anything — pair it with `reviews`. The floor is real, though: ChopSticks Järve keskus
holds 2.2 across 101 reviews.

| rating | count | share |
|---|---|---|
| 4.5 – 5.0 | 398 | 53.1% |
| 4.0 – 4.4 | 254 | 33.9% |
| 3.5 – 3.9 | 72 | 9.6% |
| 3.0 – 3.4 | 22 | 2.9% |
| below 3.0 | 4 | 0.5% |

**Price barely predicts satisfaction.** `$` averages 4.38 and `$$` 4.37 — identical.
Only the thin top end pulls ahead: `$$$` 4.53 (30 places), `$$$$` 4.67 (12).
Cheap eating in Tallinn is not a compromise.

**Cuisine leaders by volume, and who over-delivers.** Japanese is the largest
identifiable cuisine (53), then Pizza (46), American (45), Italian (35),
Middle Eastern (33). But the standouts are small categories: **Vegan/Vegetarian
averages 4.86 across 7 places** — the highest of any group by a wide margin —
followed by Thai (4.56, 16) and Eastern European (4.51, 16).

**American's weak 4.06 average is entirely a chain artifact.** 22 of the 45
American-cuisine rows are Hesburger (17 locations, avg 3.69) or McDonald's
(6, avg 4.00). Strip those two brands and the remaining 23 average 4.34 — in line
with everything else. Hesburger is the single biggest downward force in the
dataset; its locations span 3.0 to 4.1 and occupy most of the bottom of the table.

**Review volume tracks footfall, not quality.** McDonald's Viru is the
second-most-reviewed place in Tallinn (10,388) at 3.8, while Olde Hansa tops the
list outright (12,238) at a respectable 4.5. Sort by `reviews` and you get the
busiest places; sort by `rating` and you get 398 near-ties. Neither column alone
is a recommendation.

**Best-rated with real sample size** (4.9, 200+ reviews): Saffron Restoran (733),
Ramen Taro Laulupeo (530), Pizzeria Santa Lucia (455), Osteria Moderna (415),
KebabRA (400), Restaurant Purèe (245), HalaLish Telliskivi (241),
Akadeemia Kohv (214). Every one of the eight is `$` or `$$` — nothing in the
top tier is expensive.

**Geography.** The two densest postal areas are 10111 — Rotermanni, Sadama and
Mere pst, the port and new-development strip — with 79 places averaging 4.31, and
10412 — Kopli and Telliskivi, i.e. Kalamaja — with 64 averaging 4.51. Old Town
proper (10123: Rataskaevu, Dunkri, Niguliste, Vene) is smaller at 27 places but
rates highest of the dense areas at 4.60. Density and quality are not the same
map: the port strip has the most restaurants and the weakest average.

**Availability.** 9 places are open 24/7 and 167 have at least one shift running
past midnight. 45 restaurants are flagged temporarily closed — filter on
`status` before publishing any of this.

## Remaining gaps

| field | missing | why |
|---|---|---|
| `cuisine` | 367 (48.9%) | 267 rows are typed only as generic `Restaurant` upstream, with no cuisine token anywhere in their tags. Not recoverable from this export — it needs menu or name inspection |
| `tags` | 189 (25.2%) | only boilerplate tags upstream |
| `website` | 81 (10.8%) | |
| `price` | 57 (7.6%) | |
| `opening_hours` | 51 (6.8%) | |
| `phone` | 31 (4.1%) | |

The service flags are the biggest real loss. Vegetarian options, outdoor seating and
wheelchair access are exactly the filters a diner wants, and all three came back
empty — worth re-pulling upstream with those fields explicitly requested.
