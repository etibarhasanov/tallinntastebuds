# Shortlisting worksheet

`tallinn_restaurants_review.csv` — all **750 candidates**, one row each, for deciding
which ones join `data/restaurants.json`. Regenerate with `build_review_sheet.py`.
Built from `tallinn_restaurants.csv`; nothing is filtered out.

Saved UTF-8 **with a BOM** so Excel renders `Taiköök` and `Klorofüll` correctly, and
CRLF line endings. No cell can be read as a formula.

## Columns you fill in

| column | |
|---|---|
| `decision` | yours — `yes` / `no` / `maybe`, or whatever you prefer |
| `notes` | yours — why |

## Columns that help you decide

| column | |
|---|---|
| `already_on_site` | the `id` in `data/restaurants.json` when this is already published. **32 candidates match** — skip those |
| `rating`, `reviews` | remember 87% of the list is 4.0+; `reviews` is the separator |
| `price`, `cuisine`, `category` | |
| `flag` | anything needing a second look — see below |
| `maps_url` | click through to check the place |
| `opening_hours`, `phone`, `website`, `address` | |

## Columns ready to paste into `data/restaurants.json`

Pre-validated against `data/schema.json` — every value in these columns passes its
patterns and bounds.

| column | schema field |
|---|---|
| `suggested_id` | `id` — slug, unique, and guaranteed not to collide with the 74 published ids |
| `suggested_types` | `types` — mapped to real `data/taxonomy.json` ids. **A starting point, not a verdict:** `casual`, `hidden-gem`, `date` and `laptop` are judgement calls and are never guessed, so add them yourself |
| `price_band` | `price` — `$`→1 … `$$$$`→4. Blank for the 57 with no price data. The half steps are yours to set |
| `lat`, `lng` | `lat`, `lng` |
| `phone`, `website`, `address` | `phone`, `website`, `address` |

Still to write by hand for anything you accept: `blurb` (per language), `mustOrder`,
`reel`, `photos`, `closed`. The schema notes there are deliberately no rating or
ranking fields on the site — inclusion is the verdict — so `rating` and `reviews`
are triage aids here and are not meant to be carried across.

## Sort order and flags

Unflagged candidates come first, best-rated first; everything flagged follows. So the
top of the file is the live shortlist and you can work straight down it.

| flag | count | |
|---|---|---|
| *(none)* | 539 | ready to judge |
| thin review count | 79 | under 60 reviews — rating is not yet reliable |
| no hours | 51 | missing opening hours upstream |
| temporarily closed | 45 | `business_status` was `CLOSED_TEMPORARILY` |
| already published | 32 | in `data/restaurants.json` already |
| may not be a restaurant | 7 | typed as theatre, grocery, caterer or delivery-only |
| outside Tallinn (Peetri) | 6 | Peetri, not Tallinn — still inside the schema's coordinate bounds |
| possible second location | 13 | name matches a published place but sits 0.5–10.9 km away, so it is a **different branch, not a duplicate**. `Pirosmani` has two, `HAN's Restoran` four, `Shaurma Kebab` two. Verify before accepting |
| same address as published | 52 | shares a street address with a published place. Mostly innocent — Balti Jaama Turg, Depoo and the mall food courts put many unrelated kitchens at one address — but this is the only signal that catches a duplicate the name cannot, so check these |

A row can carry several flags. Duplicate detection needs the name *and* the location
to agree, within 250 m — name alone would have wrongly merged those branches, and
matching on the name prefix alone wrongly merged `Telliskivi KoHo` with
`Telliskivi Šašlõkk`.

Names alone also **miss** duplicates, which is why the address is checked separately.
`180 Degrees Restaurant` and the published `180° by Matthias Diether` share no
comparable name — the degree sign normalizes away to `180` — yet both are Staapli 4.
So do `kot.NOBLESSNER` / `KotKot` (Peetri 12) and `Q Pizza&Pan` / `Q Pizza Jaam`
(Telliskivi 62). All three would have been published twice. A shared address is not
proof, so these are flagged to verify rather than merged.

## Note on the 74 published places

Only 32 of them appear in this export. The other 42 are mostly bakeries, coffee
roasters, tea houses and taprooms — `Bekker Pagariäri`, `Kokomo Coffee Roasters`,
`Morii Tea House`, `Pudel` — which a *restaurant* search does not return. The export
is not a superset of the site, so it cannot be used to audit what is already there.
