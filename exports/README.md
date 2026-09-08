# Tallinn restaurants — cleaned export

`tallinn_restaurants.csv` — **1,110 places, 18 columns**, reshaped from the raw
Google Places export in
[`etibarhasanov/allRestaurants`](https://github.com/etibarhasanov/allRestaurants/blob/claude/google-maps-restaurants-salesforce-iz2bj5/exports/tallinn_restaurants.csv)
(44 columns). Regenerate with `clean_restaurants_csv.py` when the upstream export refreshes:

```
python3 clean_restaurants_csv.py ../../allRestaurants/exports/tallinn_restaurants.csv tallinn_restaurants.csv
python3 build_review_sheet.py          # from the repo root
node tools/googlevenues.mjs            # from the repo root
```

The upstream sweep keeps everything with 25 reviews or more. Its first pass asked
Google for `restaurant` only and found 750; Google does not type a café, a pub or a
bakery as a restaurant, so a second pass with seventeen types found the other 360 —
cafés, bars, coffee shops, bakeries, and a few dozen restaurants whose streets the
first pass had not covered. Its `COVERAGE.md` has the account.

Rows are sorted best-first: rating descending, then review count, then name.

## Columns

| column | notes |
|---|---|
| `name` | whitespace-normalized |
| `category` | Google's venue label — `Restaurant`, `Cafe`, `Bar`, `Sushi Restaurant`, … 100 distinct |
| `cuisine` | derived; grouped so it is filterable (`sushi`/`ramen`/`izakaya` → `Japanese`). One word per row, off the first Google type that names a kitchen, an exact one anywhere on the row before a family name like `asian` at the front of it. Blank for 692 rows — see gaps below |
| `rating` | 2.2 – 5.0 |
| `reviews` | Google review count, 25 – 12,239 |
| `price` | `$` – `$$$$` |
| `status` | `Open` or `Temporarily closed` |
| `address` | street address; city suffix moved to its own column |
| `postal_code`, `city` | `city` is `Tallinn` (1,086), or `Haabneeme` (11), `Peetri` (6), `Viimsi` (5) and `Miiduranna` (2) just over the city line |
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
  `Harju maakond` / `Harju County` — plus one row Google files under `Läänemaa`
  while placing it on Müürivahe, which is Google's mistake and not a third county).
- **Duplicates**: `price_level` (kept `price_label`), `primary_type`
  (kept the human label), `phone` local format (kept international),
  `formatted_address` and `street_number`/`street` (kept `address` + `postal_code`),
  `plus_code` (redundant with lat/lon).
- **`open_now`** — a snapshot of whether the place happened to be open at scrape
  time. Meaningless in a static file; `opening_hours` is the durable version.

## Fixes applied

- The raw file is **7,309 physical lines but only 1,110 records** — `opening_hours`
  embeds real newlines. Anything that splits on `\n` instead of parsing CSV will
  mis-read it by 6.6×. Hours are now single-line.
- Google's narrow no-break (U+202F) and thin (U+2009) spaces and en-dashes,
  present in 1,021 of 1,033 hour strings, normalized to ASCII.
- 12-hour times converted to 24-hour, including Google's compact form where the
  start time's meridiem is implied by the end (`12:00 – 3:00 PM` → `12:00-15:00`).
- Coordinate float noise rounded (`59.42788669999999` → `59.427887`).
- `Shawarma restaurant` case-normalized to match the other 100 labels.
- Google's `Parking lot,` / `Parkla,` address prefix stripped from 64 rows — it
  says where the map pin sits, not where the door is, and the schema wants the
  address "as Estonian post would write it". Venue prefixes that genuinely locate
  a place (`Port Noblessner`, `Balti Jaama Turg`) are kept.

No records were dropped or merged: `place_id` and name+address are already unique,
and every rating and review count round-trips against the source.

## Findings

**Ratings run high and compressed.** Median 4.5, mean 4.40; 88% of the list sits at
4.0 or above and only 42 places fall below 3.5. Rating alone barely separates
anything — pair it with `reviews`. The floor is real, though: ChopSticks Järve keskus
holds 2.2 across 101 reviews.

| rating | count | share |
|---|---|---|
| 4.5 – 5.0 | 610 | 55.0% |
| 4.0 – 4.4 | 365 | 32.9% |
| 3.5 – 3.9 | 93 | 8.4% |
| 3.0 – 3.4 | 34 | 3.1% |
| below 3.0 | 8 | 0.7% |

**Price barely predicts satisfaction.** `$` averages 4.43 and `$$` 4.38 — the cheap
end is, if anything, slightly ahead, now that the cafés and bakeries are in. Only the
thin top end pulls clear: `$$$` 4.53 (30 places), `$$$$` 4.68 (13). Cheap eating in
Tallinn is not a compromise.

**Cuisine leaders by volume, and who over-delivers.** Japanese is the largest
identifiable cuisine (58), then Pizza (53), Burgers (49), Italian (37), Asian
(27) and Turkish and Middle Eastern level at 23 each. But the standouts are
small categories: **Vegan/Vegetarian averages 4.74 across 8 places** — the
highest of any group — followed by Ukrainian (4.62, 5), Thai (4.58, 15) and
Seafood (4.58, 6).

**Burgers' weak 4.06 average is entirely a chain artifact.** 25 of the 49
Burgers rows are Hesburger (19 locations, avg 3.66) or McDonald's (6, avg 4.05).
Strip those two brands and the remaining 24 average 4.37 — in line with
everything else. Hesburger is the single biggest downward force in the dataset;
its locations span 3.0 to 4.1 and occupy most of the bottom of the table.

**Review volume tracks footfall, not quality.** McDonald's Viru is the
second-most-reviewed place in Tallinn (10,389) at 3.8, while Olde Hansa tops the
list outright (12,239) at a respectable 4.5, and Pub Kompressor is third (8,628).
Sort by `reviews` and you get the busiest places; sort by `rating` and you get 610
near-ties. Neither column alone is a recommendation.

**Best-rated with real sample size** (4.9, 200+ reviews): PullaBakery (1,656),
Saffron Restoran (733), Ramen Taro Laulupeo (530), Crustum Bakery (477),
Pizzeria Santa Lucia (455), Toro veinikohvik (435), Osteria Moderna (415),
KebabRA (400), Kiosk NO 1 (384), Precious café (293), Botaanik (283),
Restaurant Purèe (245), HalaLish Telliskivi (243), Salt'sUp soolakohvik (235),
Akadeemia Kohv (214), Veino (210), KIOSK NO3 (209). Every one of the seventeen is
`$` or `$$` — nothing in the top tier is expensive. Three places hold a straight
5.0 on a hundred or more reviews: Morii Tea House (148), Ruk Thai Tai Köök Kadriorg
(117) and Kartul (101).

**Geography.** The two densest postal areas are 10111 — Rotermanni, Sadama and
Mere pst, the port and new-development strip — with 102 places averaging 4.34, and
10412 — Kopli and Telliskivi, i.e. Kalamaja — with 88 averaging 4.54. Old Town
proper (10123: Rataskaevu, Dunkri, Niguliste, Vene) is smaller at 43 places but
rates highest of the dense areas at 4.57. Density and quality are not the same
map: the port strip has the most restaurants and the weakest average.

**Availability.** 13 places are open 24/7 and 264 have at least one shift running
past midnight. 66 places are flagged temporarily closed — filter on
`status` before publishing any of this.

## Remaining gaps

| field | missing | why |
|---|---|---|
| `cuisine` | 692 (62.3%) | 255 rows are typed only as generic `Restaurant` upstream, with no cuisine token anywhere in their tags, and the cafés, bars and bakeries the wider sweep added mostly carry no cuisine by nature. Not recoverable from this export — it needs menu or name inspection |
| `tags` | 201 (18.1%) | only boilerplate tags upstream |
| `website` | 143 (12.9%) | |
| `price` | 118 (10.6%) | |
| `phone` | 84 (7.6%) | |
| `opening_hours` | 77 (6.9%) | |

The service flags are the biggest real loss. Vegetarian options, outdoor seating and
wheelchair access are exactly the filters a diner wants, and all three came back
empty — worth re-pulling upstream with those fields explicitly requested.

The wider sweep also drags in a handful of places that serve coffee but are not
somewhere to eat — a barber, a toy shop, two bookshops, a ceramics maker, an
axe-throwing club. They are left in, because the export is a mirror; the review
sheet flags them and `google_venues.hidden` is where they go.
