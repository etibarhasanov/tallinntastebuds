# Switch a discount on or off

A few places give readers of the map something off the bill. Which ones, and
whether the offer is on, is `data/deals.json`, and nothing else: a place with
no entry there is exactly the place it was before discounts existed. There is
no server behind it — the code a guest shows is an hourly HMAC computed in the
browser from a key that ships in that public file, and the README says why
that trade is the right one.

## Read first

`README.md` → **Restaurant discounts**, end to end: **How it works at the
table**, **The three addresses**, **Switching one on**, **Why the name is
written twice**, **Testing before anything is public**, **What this is not**.

## Switching one on

1. **The entry.** Copy a live one: `id` is the place's id in
   `restaurants.json`; `name` is that place's name copied exactly, because the
   pass pages load `deals.json` and `ui.json` only and never the map; `offer`
   and `terms` in all ten languages, the way every live entry carries them —
   a rate another deal already offers has its line written in ten languages
   there, so reuse it rather than retranslate it.
2. **The key.** Fresh from the generator in **Switching one on**, 16 to 64
   characters of `0-9 A-Z` without `I L O U`, and **different for every
   place**: a shared key means one restaurant's codes verify at another's
   till.
3. **Test it dormant.** Leave `live: false` and open
   `/deal.html?r=<id>`, `/staff.html?r=<id>` and the verify page by scanning
   the QR or copying its link. They work in full, with a dashed **preview**
   band that says they are not real. `crypto.subtle` needs a secure context,
   so this is on a local server, never `file://`; `localhost` counts.
4. `node tools/validate.mjs`. It refuses a deal pointing at a place that does
   not exist, two deals sharing a key, a name the map disagrees with, and
   anything `live` with no words in it. The summary line ends with the
   live-deal count, so read that it went up by one.
5. **Then `live: true`**, and drive `deal.html` once more in Chromium: the
   name, the offer, the QR, a code that changes on the hour. On the map the
   place gains a **−15%** pill in its row and its panel, and the **Discount**
   chip appears first among the filters if it was not there already.
6. **Hand over the staff link** —
   `https://tallinntastebuds.ee/staff.html?r=<id>` — once, to the restaurant.
   Put it in the commit body so it is on record.

`from` and `until` are optional and inclusive; outside them the button simply
disappears, so a deal for one month is written once and forgotten.

## Switching one off

`live: false` keeps it testable by URL and invisible on the map, which is the
state to leave a deal in that might come back. Removing the entry is for one
that will not. Either is live for everybody the moment it is pushed.

## The commit

> Morii Tea House takes 15% off the order

The body says who the place is, what rate it joins and which other deals
share that line, that the key is fresh and shared with nothing, what was
driven in a browser, and the staff link.

## Where it goes wrong

- Testing on `file://` and concluding the pass pages are broken.
- A key generated once and pasted twice.
- The place renamed on the map and not here — the validator catches it, with
  both spellings in the message.
