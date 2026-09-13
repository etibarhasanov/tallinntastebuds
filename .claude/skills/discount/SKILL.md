---
name: discount
description: Switch a restaurant discount on or off, or change what it offers. Use for anything in data/deals.json and the deal, verify and staff pass pages.
---

# Switch a discount on or off

A few places give readers of the map something off the bill. Which ones, and
whether the offer is on, is `data/deals.json` and nothing else: a place with no
entry there is exactly the place it was before discounts existed. There is no
server behind it. The code a guest shows is an hourly HMAC computed in the
browser from a key that ships in that public file, and **WHAT THIS IS NOT**
in the header of `assets/pass.js` says why that trade is the right one: what
an hourly code defends against is a screenshot going round a group chat, and
it does that completely.

**Every discount is for members.** `functions/api/pass.js` answers
`GET /api/pass?r=<id>` with `401` where there is no session, and
`assets/pass.js` turns that into a sign-in card instead of a code — for a
fixed deal as much as a drawn one. The map's button reads **Sign in to use
it** and opens the sheet with `?then=` back to the pass. The offer, the pill
and the chip stay visible to everybody: it is the code that needs the
account, not the advertisement. **A DISCOUNT IS FOR MEMBERS** in the header
of `assets/pass.js`, the header of `functions/api/pass.js`, and **It is for
members** in the README. A change to the Function is also the **api**
process.

A deal can also carry a **roll** — `{ "base", "spread", "step" }` — and then
it has a run of rates rather than one, and each account is dealt one for the
hour: the same request that opens the door carries the number, an HMAC under
`SAVE_SALT` over the account, the place and the hour, which `assets/pass.js`
counts up the run. The rate rides in the code's message and in the QR as
`p`, the staff page lists a code per rate, and the offer line writes
`{rate}` where the number goes. **HOW A RATE IS DRAWN** in the header of
`assets/pass.js` is the mechanism and **A rate that is drawn** in the README
is the reasoning.

**The admin page sets these too.** The **Discount** tab on `/admin.html`
switches a deal on or off, sets one rate or a roll, and commits
`data/deals.json` straight to the publishing branch — **Setting a discount**
under **The admin page** in the README. It writes the same file this skill
edits by hand, and checks the same things the validator does; what it cannot
do is write a new offer line (it borrows ten from an existing deal and
changes the number), give a deal small print or dates, or remove an entry.
Those stay this process.

Switching a deal touches one file, `data/deals.json`, and no generator: the
stamper only rewrites references to `assets/*.js|css`, and `data/*` is served
`must-revalidate`, so the change is live on the next load after the deploy.

## Read first

- `README.md` → **Restaurant discounts**, end to end. One line in it is
  behind the code: the preview band is drawn on all three pass pages,
  `staff.html` included, not two.
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

A rolled deal differs in two lines: `"roll": { "base": 15, "spread": 10,
"step": 5 }` — 5, 10, 15, 20 or 25 percent — and every `offer` line written
with the placeholder, `"{rate}% off your order"`, `"Siparişinizde %{rate}
indirim"`.

What `tools/validate.mjs` holds each field to (the `deals.json` block:
`DEAL_KEYS` and the checks that follow it):

| Field | Rule | If wrong |
|---|---|---|
| `id` | a slug, `^[a-z0-9]+(-[a-z0-9]+)*$`, unique among deals, and **a place in `restaurants.json`** | error |
| `name` | non-empty, and **exactly that place's `name`** — the pass pages load `deals.json` and `ui.json` only, never the map, so the name is copied here and the validator is what keeps the copy honest | error, with both spellings in the message |
| `live` | `true` or `false`. "Leave it false until the restaurant has agreed", in the validator's own message | error |
| `key` | `^[0-9A-HJKMNP-TV-Z]{16,64}$` — digits and capitals without `I L O U` — and **shared with no other deal**: two places on one key verify each other's codes | error |
| `offer`, `terms` | objects keyed by language code; only codes `ui.json` knows; no empty strings | error |
| `from`, `until` | `YYYY-MM-DD`, `from` not after `until`; both optional and inclusive | error |
| `roll` | optional; `base`, `spread` and `step` whole numbers, `spread` a whole number of `step`s and at least one, the run `base ± spread` inside 1–99 | error |
| `roll` | more than twelve rates — `staff.html` lists a code for each | warning |
| `offer` | every language carries `{rate}` when the deal has a `roll`, and none does when it has not | error |
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
4. **Test it dormant, on a local server.** The guest page needs `/api/pass`
   to answer before it draws anything, so it is `npx wrangler pages dev .`
   against the preview database — the **api** skill's steps — or Playwright
   with that route stubbed: `{ "draw": <number> }` for a member and `401` for
   somebody signed out. A plain `python3 -m http.server 8000` is enough for
   `staff.html`, the verify page and the map, and shows the guest page's
   "not available" card, which is itself worth seeing once. Then:
   - `.../deal.html?r=<id>` — signed in: the offer, the QR, the
     five-character code, the countdown with its beating dot, and a dashed
     **Preview — this discount is not published yet** band. Signed out: the
     offer, `passSignIn`, and **Sign in to use it** pointing at
     `/?account=in&then=…`. On `file://` the page shows `passInsecure`
     instead, because `crypto.subtle` only exists in a secure context;
     `localhost` counts.
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

   **A rolled deal, in addition:** signed out it says **Sign in to draw**
   and `passRollSignIn` rather than the fixed deal's pair; signed in it runs
   the number through the run for a second and lands on this account's rate,
   and the line under the countdown says a new draw follows the hour. Reload
   and it lands on the same number; another account draws its own. The QR
   ends `&p=<rate>` and the code is
   `HMAC-SHA256(key, "<id>:<hour>:<rate>")`; edit `p` to another rate in the
   run and the verify page answers **Not valid**, to one outside it and it
   answers that this is not a discount link. `staff.html` shows a row per
   rate for this hour and for the previous one, and the guest's code is on
   the row of their rate. Do all of that at 390 px and in both styles: the
   rolled offer line is set a size up in the display face and the staff
   list is the one thing on these pages that can run long.
5. **`live: true`**, validate again — the live count goes up by one — and
   drive `index.html` on the same server: `liveDealFor()` in `assets/app.js`
   wants `live` **and** today inside `from`..`until` **and** the place not
   closed, so a deal whose `from` is next week shows nothing on the map yet.
   When it is on, the place's list row and panel head carry a pill with the
   percentage parsed out of the offer text — **−15%**, or the word
   **Discount** for an offer with no number in it — and the **Discount** chip
   appears first among the filters. A rolled deal's pill is the run,
   **−5–25%**, its offer line in the panel reads **5–25% off your order**,
   and under that line signed in is `dealRollHint`, saying the rate is drawn
   on the way in and holds for the hour, and signed out `dealRollMembers`
   and a **Sign in to draw** button in place of **Show QR**, which opens the
   sheet and lands on the pass afterwards. `?type=discount` works as a link
   only while some deal is live.
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

## Changing a roll

The three numbers are the admin's dial, changed from the **Discount** tab on
`/admin.html` or in the file. Every draw is counted up the run when a page
opens, so new numbers take effect on the next load — and change what an
account drew earlier in the same hour, leaving a guest with a code the staff
page no longer lists. Land the change between services, not during one.
Keep `step` at 5 unless the restaurant wants finer: 1 turns five rates into
twenty-one rows on the counter's screen, and the validator warns past twelve.

## The commit

> Morii Tea House takes 15% off the order
> Pudel draws you 5 to 25% off, once an hour

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
- A `roll` added and the offer lines left saying "15%": the validator fails
  on every language until each writes `{rate}` — and the other way round, a
  `{rate}` left behind when a roll is taken off.
- Testing a rolled deal from one account and concluding the draw is not
  random: it is one rate per account per hour by design, and a private
  window is the same account or none. Sign in as somebody else to be
  somebody else.
- Driving any deal on a plain `http.server` and concluding the pass page is
  broken: there is no Function there to answer `/api/pass`, so every
  discount shows the "not available" card. `wrangler pages dev`, or a stub.
- Reading the account in front of a discount as what protects it. It is not
  — the key is still in a public file. It decides who the offer is *for*.
