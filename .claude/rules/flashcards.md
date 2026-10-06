---
paths:
  - "data/decks.json"
  - "flashcard.html"
  - "assets/flashcard.js"
  - "assets/flashcard-first.js"
  - "assets/flashcard.css"
  - "assets/logo/og-flashcard.html"
  - "assets/logo/og-flashcard.png"
  - "functions/flashcard.js"
  - "functions/api/flashcard.js"
  - "functions/api/say.js"
  - "tools/ogcard.mjs"
---

You are in the **flashcards**: the deck of Estonian on its own subdomain,
which has no skill of its own. Load `/site` for the page and `/api` for the
route if they are not loaded already, and read **Flashcards** in `README.md`
by its `###`s rather than whole — it is two thousand lines. The ones most
changes want: **Where the words are, and it is mostly not the database**,
**The back of the card is in three languages**, **One request on the way in**,
**The menu, and Start**, **Grammar, which is read rather than turned over**,
**The cases, one at a time**, **Songs, which are listened to**, **Hearing
it**, **When somebody sends the link**.

What sessions here kept rediscovering:

- `data/decks.json` is content, not interface. A card's back, a deck's `name`
  and `why`, every paragraph and gloss of a lesson and every line and word of
  a song are objects keyed by language — English required, Azerbaijani and
  Russian written, three languages and not the site's ten (`DECK_LANGS` in
  `functions/api/_lib.js`) — and `node tools/validate.mjs` holds the file to
  its shape. The page's own strings are the `flash*` keys in `data/ui.json`,
  in all ten, like every other page's.
- The page fetches nothing but `/api/flashcard`: its words ride in the
  answer, and the first ask leaves from `assets/flashcard-first.js` in the
  head before the page's own scripts arrive, so a change to what `boot()`
  asks is a change there too.
- `/api/say` speaks only what is in `data/decks.json`, exactly — a card's
  front, a card's sentence, a lesson's sentences and forms, a song's lines —
  and `sayable()` in that route is the list. A new kind of thing to hear is a
  line there, or the speaker answers `404 not-a-card`.
- `assets/logo/og-flashcard.png` is drawn from `assets/flashcard.css` and the
  colour tokens: `node tools/ogcard.mjs` after either moves, and nothing in
  CI sees it stale.
- The same page answers at `/flashcard` on the map's host, framed over the
  map, and at the root of `flashcard.tallinntastebuds.ee` as a site of its
  own, with no `ttb.lang` and no radio carried over. Drive it both ways.
