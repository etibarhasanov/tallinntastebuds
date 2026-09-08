---
name: discount
description: Switch a restaurant discount on or off, or change what it offers. Use for anything in data/deals.json and the deal, verify and staff pass pages.
---

# Switch a discount on or off

A few places give readers of the map something off the bill. Which ones, and
whether the offer is on, is `data/deals.json` and nothing else: a place with no
entry there is exactly the place it was before discounts existed. There is no
server behind it. The code a guest shows is an hourly HMAC computed in the
browser from a key that ships in that public file, and `assets/pass.js:22-27`
says why that trade is the right one: what an hourly code defends against is a
screenshot going round a group chat, and it does that completely.

Switching a deal touches one file, `data/deals.json`, and no generator: the
stamper only rewrites references to `assets/*.js|css`, and `data/*` is served
`must-revalidate`, so the change is live on the next load after the deploy.

## Read first

- `README.md` → **Restaurant discounts**, end to end. Two lines in it are
  behind the code: the button on the panel says **Show QR** (`passGet` in
  `data/ui.json`), not "Get the discount", and the preview band is drawn on
  all three pass pages, `staff.html` included.
- The header of `assets/pass.js`, which is the whole mechanism in one file.

## The entry

```json
{
  "id": "morii-tea-house",
  "name": "Morii Tea House",
  "live": false,
  "key": "…32 characters…",
  "offer": { "en": "15% off your order", "et": "…", … all ten … },
  "terms": { "en": "One per table.", … },
  "from": "2026-09-01",
  "until": "2026-12-31"
}
```

What `tools/validate.mjs` holds each field to (`DEAL_KEYS` at line 502 and
the checks that follow it):

| Field | Rule | If wrong |
|---|---|---|
| `id` | a slug, `^[a-z0-9]+(-[a-z0-9]+)*$`, unique among deals, and **a place in `restaurants.json`** | error |
| `name` | non-empty, and **exactly that place's `name`** — the pass pages load `deals.json` and `ui.json` only, never the map, so the name is copied here and the validator is what keeps the copy honest | error, with both spellings in the message |
| `live` | `true` or `false`. "Leave it false until the restaurant has agreed" (line 546) | error |
| `key` | `^[0-9A-HJKMNP-TV-Z]{16,64}$` — digits and capitals without `I L O U` — and **shared with no other deal**: two places on one key verify each other's codes | error |
| `offer`, `terms` | objects keyed by language code; only codes `ui.json` knows; no empty strings | error |
| `from`, `until` | `YYYY-MM-DD`, `from` not after `until`; both optional and inclusive | error |
| a live deal | must carry `offer.en` | error |
| a live deal | should carry `offer` in all ten languages | warning |
| a live deal | `until` in the past | warning |
| anything else | an unknown key, which is how a typo in a field name is caught | warning |

The validator's summary line ends with the live-deal count, so CI says how
many are switched on.

## Switching one on

1. **Copy a live entry**, not the README's example: the live ones carry
   `offer` and `terms` in all ten languages. A rate another deal already
   offers has its ten lines written there; reuse them rather than retranslate.
2. **Generate the key**, once, and paste it once:

   ```
   node -e "const A='0123456789ABCDEFGHJKMNPQRSTVWXYZ';console.log([...require('crypto').randomBytes(32)].map(x=>A[x%32]).join('').slice(0,32))"
   ```

   The validator checks the alphabet, the length and uniqueness, and nothing
   about how the key was made, so a key typed by hand passes and is weak.
3. **Leave `live: false`** and `node tools/validate.mjs`.
4. **Test it dormant, on a local server.** `python3 -m http.server 8000`, then:
   - `http://localhost:8000/deal.html?r=<id>` — the offer, the QR, the
     five-character code, the countdown with its beating dot, and a dashed
     **Preview — this discount is not published yet** band. On `file://` the
     page shows `passInsecure` instead, because `crypto.subtle` only exists in
     a secure context; `localhost` counts.
   - `http://localhost:8000/staff.html?r=<id>` — this hour's code and the
     previous hour's, and "Changes at" the next hour.
   - The verify page by scanning the QR with a phone on the same network, or
     by opening the URL inside it: `verify.html?r=<id>&h=<hour>&c=<code>`. It
     answers **Valid** in green, and the same band saying it is a test.
     `verify()` in `pass.js` never reads `live`, so a dormant deal verifies
     exactly like a real one; the band is the only difference, which is why
     it is there.
   The code is `HMAC-SHA256(key, "<id>:<hour>")`, first 25 bits, five
   Crockford characters, where `hour` is `floor(now / 3600000)` in UTC. The
   verifier accepts the hour before and the hour after (`SKEW = 1`), so a
   screenshot is worth two or three hours, not forever.
5. **`live: true`**, validate again — the live count goes up by one — and
   drive `index.html` on the same server: `liveDealFor()` in `assets/app.js`
   wants `live` **and** today inside `from`..`until` **and** the place not
   closed, so a deal whose `from` is next week shows nothing on the map yet.
   When it is on, the place's list row and panel head carry a pill with the
   percentage parsed out of the offer text — **−15%**, or the word
   **Discount** for an offer with no number in it — and the **Discount** chip
   appears first among the filters. `?type=discount` works as a link only
   while some deal is live.
6. **The staff link** is `https://tallinntastebuds.ee/staff.html?r=<id>`. It
   is handed to the restaurant once and they bookmark it; put it in the
   commit body so it is on record. Nothing links to any of the three pages,
   they are `no-store` and `noindex` in `_headers`, in the markup and in
   `robots.txt`, and the QR points at whichever origin drew it, so a preview
   deployment verifies against itself rather than sending a waiter to the
   live site.

## Switching one off

`live: false` keeps the pages working by URL, behind the preview band, and
takes the pill, the chip and the button off the map. That is the state for a
deal that might come back. Removing the entry is for one that will not. An
`until` in the past does the same on the map and the pages — the button
disappears, the pass page says the offer has ended — but the validator warns
about it until the entry goes.

The date window is read in the **visitor's own timezone** in the browser and
in the **CI runner's** in the validator, so at the edges of a day the two can
disagree with Tallinn by a day. Give a campaign a day either side rather than
ending it at midnight.

## The commit

> Morii Tea House takes 15% off the order

The body says who the place is, what rate it joins and which deals already
carry that line, that the key is fresh and shared with nothing, what was
driven in a browser, and the staff link.

## The pull request

1. `git fetch origin claude/tallinn-tastebuds-map-nzoqx0 && git rebase origin/claude/tallinn-tastebuds-map-nzoqx0`
2. `node tools/validate.mjs` — no generator, one file. The summary line's
   live-deal count is the number to read.
3. `deal.html`, `staff.html` and the verify page on a local server, dormant
   and then live, and the pill and chip on the map.
4. One commit, subject "<Place> takes <rate> off <what>".
5. `git push -u origin <branch>`, or `--force-with-lease` after a rebase.
6. Open the PR against the default branch. The body says the rate, which
   deals share its line, that the key is fresh, what was driven, and the
   staff link in full — `https://tallinntastebuds.ee/staff.html?r=<id>`.
7. CI green, then **Rebase and merge**, delete the branch, and **send the
   staff link** to the restaurant. That is the one thing that happens by
   hand after landing, and the PR body is where it was written down.

## Where it goes wrong

- Testing on `file://` and concluding the pass pages are broken.
- A key generated once and pasted twice: both deals fail validation, but
  only after the second one is written.
- The place renamed on the map and not here. The validator catches it, with
  both spellings in the message.
- Switching `live` on for a place that is closed, or whose `from` has not
  come: valid JSON, nothing on the map, and nobody can see why.
