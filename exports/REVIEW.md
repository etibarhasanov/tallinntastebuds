# Shortlisting worksheet

`tallinn_restaurants_review.csv` — all **1,110 candidates**, one row each, for deciding
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
| `already_on_site` | the `id` in `data/restaurants.json` when this is already published. **63 candidates match** — skip those |
| `rating`, `reviews` | remember 88% of the list is 4.0+; `reviews` is the separator |
| `price`, `cuisine`, `category` | |
| `flag` | anything needing a second look — see below |
| `maps_url` | click through to check the place |
| `opening_hours`, `phone`, `website`, `address` | |

## Columns ready to paste into `data/restaurants.json`

Pre-validated against `data/schema.json` — every value in these columns passes its
patterns and bounds.

| column | schema field |
|---|---|
| `suggested_id` | `id` — slug, unique, and guaranteed not to collide with the 75 published ids |
| `suggested_types` | `types` — mapped to real `data/taxonomy.json` ids. **A starting point, not a verdict:** `casual`, `hidden-gem`, `date` and `laptop` are judgement calls and are never guessed, so add them yourself |
| `price_band` | `price` — `$`→1 … `$$$$`→4. Blank for the 118 with no price data. The half steps are yours to set |
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
| *(none)* | 742 | ready to judge |
| thin review count | 152 | under 60 reviews — rating is not yet reliable |
| no hours | 77 | missing opening hours upstream |
| temporarily closed | 66 | `business_status` was `CLOSED_TEMPORARILY` |
| already published | 63 | in `data/restaurants.json` already |
| outside Tallinn | 24 | Haabneeme, Peetri, Viimsi or Miiduranna, not Tallinn — still inside the schema's coordinate bounds |
| may not be a restaurant | 18 | typed as theatre, grocery, caterer or delivery-only — or, since the sweep was widened to cafés and bars, a barber, a bookshop, a toy shop, a ceramics maker or a sports club that Google also files under coffee |
| possible second location | 20 | name matches a published place but sits 0.5–14.3 km away, so it is a **different branch, not a duplicate**. `HAN's Restoran` has four, `Shaurma Kebab` three, `Pirosmani` two. Verify before accepting |
| same address as published | 70 | shares a street address with a published place. Mostly innocent — Balti Jaama Turg, Depoo and the mall food courts put many unrelated kitchens at one address — but this is the only signal that catches a duplicate the name cannot, so check these |

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

## Note on the 75 published places

63 of them appear in this export. The other twelve, and why:

- **Not in Google's answer at all.** `Cafe Cape Town`, `Lendav Maaler` and
  `Maison François` are closed, and Google's nearby search never returns a closed
  place. `Nullijook`, `Balta Chill` and `Pilsneri baar` are under the sweep's
  25-review bar. `Kokomo Coffee Roasters` is typed `coffee_roastery`, which no type
  filter Google offers has returned.
- **In the export under a name the sheet cannot connect.** `180° by Matthias
  Diether`, `KotKot`, `Laboratooriumi 23` (Google: `Lb23`), `Q Pizza Jaam` and
  `Telliskivi Šašlõkk` — the address-only cases above. They are in the file; the
  sheet flags their rows as sharing an address rather than claiming the match.

The export is not a superset of the site, so it cannot be used to audit what is
already there.
