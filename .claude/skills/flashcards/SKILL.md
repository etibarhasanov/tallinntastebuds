---
name: flashcards
description: Add or change a deck, a card, a grammar lesson or a song in data/decks.json, or change the Estonian flashcards page and the routes behind it. Use for anything in data/decks.json, data/decks/, tools/decks.mjs, flashcard.html, assets/flashcard.js, assets/flashcard-first.js, assets/flashcard.css, functions/flashcard.js, functions/api/flashcard.js, functions/api/_decks.js, functions/api/say.js, or flashcard.tallinntastebuds.ee.
---

# Add to the flashcards, or change them

Decks of Estonian, the Estonian on the front of each card and what it means
on the back, in English, Azerbaijani or Russian; grammar lessons that are
read rather than turned over, five of them about the cases and each followed
by a deck of its own; and songs, every word of them explained. All of that is
one file, `data/decks.json`, which is what anybody edits and is shipped as
content. `node tools/decks.mjs` writes it out into `data/decks/` — an index
for the shelf, one file per deck, lesson and song, and the voice's list — and
that folder is what the Functions read. Around it: one page (`flashcard.html`
and its script), one route that answers it (`functions/api/flashcard.js`,
reading the folder through `functions/api/_decks.js`), one route that writes
its head (`functions/flashcard.js`), and one that speaks it
(`functions/api/say.js`).
The page answers at `/flashcard` on the map's host, framed over the map, and
at the root of `flashcard.tallinntastebuds.ee`, where it is a site of its own.

Two kinds of change come here, and they weigh differently:

- **Content** — a deck, a card, a lesson, a song — is like a place on the
  map: it goes straight to code, and the validator does most of the checking.
  Most of this file is for it.
- **The page or the routes** are the `/site` and `/api` processes, and those
  skills apply in full. This file adds what is particular to this feature.

## Read first

- `README.md` → **Flashcards**, by its `###`s and never whole: the section is
  two thousand lines and more. `grep -n '^##' README.md` and read between
  `## Flashcards` and the heading after it. Which ones:
  - content: **Where the second thousand came from**, **The back of the card
    is in three languages**, **Four headings**, **Which decks are open**,
    **Three forms, where a word has three**, **And the word in a sentence**;
    a lesson adds **Grammar, which is read rather than turned over** and
    **The cases, one at a time**, a song **Songs, which are listened to**;
  - the page: **One request on the way in**, **Opening a deck does not load
    the page**, **The menu, and Start**, **Hearing it**, **When somebody
    sends the link**;
  - the route: **Who may do what**, **The caps**, **The spacing, which is
    off**, **This card is wrong**, **Turning it on**.
- The `FLASHCARDS` block in `tools/validate.mjs`, from its banner to `end
  FLASHCARDS`. It is the whole of what the build holds the file to, and it
  says why at every check. **The file** below is that block as a table.
- The header of `tools/decks.mjs`, which says what each generated file holds
  and who reads it.
- The header of the file you are changing. Most of the files here are over
  six hundred lines — `wc -l` says which, and a list written here would be
  wrong within the week — so the reach in those is the functions you touch:
  `.claude/rules/leave-it-better.md`.

## Is it new?

A deck, a card, a lesson or a song is content, and the gate in `CLAUDE.md`
does not catch it — any more than it catches a place. One exception: a song
prints its words whole, and **printing a living author's verses is the
owner's call**. Ask before adding one, and say whose they are.

A new *kind* of thing is new: a block a lesson has never had, a view, an
action on a deck, a way to answer a card. That is described first, as
**Something new is described before it is built** says. **What it does not
do** under **Flashcards** is the list of what was considered and refused —
shuffling, typing the answer, streaks, spacing, a voice on somebody's own
deck — and a proposal that brings one back says why the reason given there
no longer holds.

## The file

`{ decks, lessons, songs, talks, talkWords }` — the last the glossary the
conversations' words share. Three rules hold across all of it:

- **One namespace.** A deck, a lesson, a song and a conversation all open at
  `/flashcard?d=<id>`, so an id is unique across the four; a lowercase slug;
  never sixteen hex characters, which is the shape of a deck somebody wrote
  (`MINTED`); never `missed`, `review`, `grammar`, `songs` or `talks`, which the route
  keeps for decks it assembles and rows it files (`RESERVED`); and never
  `index` or `spoken`, the generated folder's own two files
  (`RESERVED_FILES` in `tools/decks.mjs`).
- **A pack is what a reader reads in their language**: an object keyed by
  language. `en` is required and is what every other language falls back to;
  `az` and `ru` only warn until they are written; an `et` key fails, because
  Estonian is what the card asks, never what it answers; any code `data/ui.json`
  does not have fails, and so does an empty string. The three are `DECK_LANGS`
  in `functions/api/_lib.js`, and `means()` in `assets/flashcard.js` is what
  picks one.
- **`added`**, on every deck, lesson and song, is the day it went in,
  `YYYY-MM-DD`. Missing only warns, and costs the thing its two weeks with a
  New tag on the page's Start view.

### A deck

| Field | Rule |
|---|---|
| `id`, `added` | as above |
| `name`, `why` | packs |
| `level` | `start`, `eat`, `more` or `deep` — the four headings, *First words*, *At a restaurant*, *Getting by* and *Going deeper*; `case` only on a deck a lesson names, `song` only on a deck a song names |
| `taste` | optional; at most 36 characters, and exactly some card's `front` |
| `cards` | at least one |

**Where a deck goes is a judgement.** Within a stage the file runs from easy
to hard, and that is the order a visitor meets the decks in. A subject with
thirty words of its own is a deck rather than thirty more cards in a
catch-all, because a deck is where a word is found.

### A card

| Field | Rule |
|---|---|
| `id` | a slug, unique in its deck |
| `front` | the Estonian, at most 60 characters — `MAX_SIDE`, the same cap a card somebody types is held to |
| `back` | a pack, each language at most 60 |
| `forms` | optional, exactly two: a noun's genitive and partitive; a verb's *da*-infinitive and first person — *minema, minna, lähen* — and the third person only for the few verbs no person does, *sadama* among them; each at most 60 |
| `sentence` | optional: `et` and a pack, both halves or neither |
| `build` | only on a `case` deck: `forms` (the three), `on`, `from` and `end` with `makes` their sum, `short`, and `case` (`et` and a pack). The arithmetic is checked, and what it ends at has to be on the front |

### A lesson

`id`, `name`, `why`, `added`; `taste`, its own since a lesson has no cards;
`deck`, optional, which must be a `case` deck in the file; and `body`, blocks
of exactly one of:

- `say` — a pack. `*…*` marks Estonian and is drawn as `<i lang="et">`; an
  unmatched asterisk fails.
- `head` — a pack.
- `table` — three `heads`, each a pack, and rows of `{ et: [three forms],
  means: pack }`. Fitted to 390 px: four or five rows, one tense to a table.
- `examples` — `[{ et, …pack }]`, a card's sentence in shape.

**The three languages each argue from their own grammar.** A Russian
paragraph says where its prepositions went; an English one turns small words
into endings. A translation of the English is the wrong paragraph. A lesson
has no report line: a wrong sentence in one is a pull request.

### A song

`id`, `name`, `why`, `added`; `taste`, which must start a sung line; `video`,
the eleven characters of a YouTube id; `credit`, optional, `{ words, music }`
as names and never translated; `deck`, a `song` deck holding only the words
the shelf does not already teach, each with its line as its sentence;
`verses`, `[[{ et, …pack }]]`, following the recording; and `words`, keyed by
each word as it is sung, lowercased — every word a line sings must be there
and nothing no line sings may be, each `{ base, means, note?, deck? }`, its
`deck` holding a card whose `front` is the `base`. `WORD` is the split, written
in `tools/validate.mjs` and `assets/flashcard.js`, so a clipped form like
*sidun'd* is written whole.

### A conversation

`talks`: a sheet from a language course, turn by turn — who said it, the
Estonian, and what it means. Nothing in one is a card, and every word in one
is a press out of `talkWords`, the glossary they share.
It has a process of its own, because it starts from a PDF that will not
extract and ends in two translations: **the `/conversation` skill**, which
this file's generators, driving and pull request apply to as well.

## What the content is held to besides the validator

Each of these was decided once, and most of them in a commit body rather
than a check:

- **The gates.** `GATES` in `functions/api/flashcard.js` is the one copy:
  `more` opens at a hundred words known and `deep` at four hundred, and four
  hundred is all 397 cards of `start` and `eat` and three more. **A card added
  to a `start` or `eat` deck moves what the gate means**, so new words go into
  `more` and `deep` decks unless the owner says otherwise.
- **No names.** No first names, no place names, no lesson numbers: a course
  glossary is half of them, and a card asking somebody to turn over a first
  name teaches nothing.
- **A card without an example beats a card with a bad one.** No sentence on
  the shelf has been written or checked by a native speaker, so sentences
  arrive a deck at a time, read twice, and the PR names the one most worth a
  native's look. Nine hundred written in one sitting would be nine hundred
  nobody checked. A deck whose every card has one — the two-word verbs —
  takes no card without one.
- **The Azerbaijani is written card by card** and is the part to check: no
  glossary brings it, and it is read beside the deck around it. Three backs
  were once rewritten for that alone — a folk song's word for a water jug,
  a waitress given the waiter's word, a run of capitals in a deck written in
  lower case.
- **English is British** — *car park* — and **the Russian is the word people
  say**, not a textbook's abbreviation.
- **A card fixed because somebody reported it** also wants its rows cleared
  from `flashcard_reports`. That is a production write: the owner's yes, and
  a terminal, since the gate refuses a `WHERE` that does not pin the whole
  key. The query to find them and the line that clears them are under **This
  card is wrong**; the README prints a preview line beside it, which
  **Production only, for now** in `CLAUDE.md` overrides.

## What else moves when the file moves

- **`node tools/decks.mjs`.** The Functions read `data/decks/`, not the
  source, so a deck that is not written out is a deck the page cannot find.
  The validator fails a file there that is not what the tool would write, and
  one left behind for a deck the source no longer has. Commit the folder with
  the source, and never edit a file in it.
- **`node tools/sitemap.mjs`.** Every deck, lesson and song is an address in
  `sitemap.xml`, and the validator fails a sitemap that was not re-run.
- **The counts.** The number of decks and of cards is written into
  `README.md`, the headers of `assets/flashcard.js`, `functions/api/flashcard.js`,
  `functions/flashcard.js`, `functions/api/_lib.js` and
  `functions/_middleware.js`, the schema's comment, the validator's banner —
  and into two sentences a visitor sees:
  `DESCRIPTION` in `functions/flashcard.js` and the meta description in
  `flashcard.html`, which must stay the same sentence. Those two move with the
  change; the rest move in the files you are standing in, and the PR says
  which were left. Some older numbers in the prose are history on purpose —
  "it used to send all forty-two" — so read before changing one.

  ```
  grep -rn 'fifty-three\|Fifty-three\|two thousand five hundred' --include=*.md --include=*.js --include=*.mjs --include=*.html --include=*.sql .
  ```

  with the words for the numbers the file had before your change — those are
  the counts of 6 October 2026.
- **The weight.** The shelf reads the index and a deck reads its own file,
  so a deck added costs the routes almost nothing. The source is still read
  whole at run time in one place: `shippedDecks()` in
  `functions/api/_decks.js`, for a gathered deck that spans more than
  `FEW_DECKS` decks. **Where the words are, and it is mostly not the
  database** has the arithmetic.
- **What `/api/say` will speak** is `data/decks/spoken.json`, which the tool
  writes out of the file: a front, a card's sentence, a lesson's sentence or
  form, a song's line. A new *kind* of text is a line in `spoken()` in
  `tools/decks.mjs` and a run of the tool, or its speaker answers
  `not-a-card`.

Those two tools are all that is generated from `data/decks.json`, and nothing
needs stamping for a content change.

## The page

- **It fetches one thing**: `/api/flashcard`. The words ride in the answer,
  in one of `DECK_LANGS`' three; the `flash*` keys are in `data/ui.json` in
  all ten like every page's, and the page can be read in three of them.
  **Three languages, not ten** under **Flashcards** is why.
- **`assets/flashcard-first.js` asks before the page's scripts arrive.**
  `boot()` takes its answer only when the address it would have asked is the
  same, character for character, so a change to what `boot()` asks is a
  change there too. A drift costs one wasted request, never the wrong deck.
- **It walks in its own document.** `go()` and `settle()` move between the
  shelf, a deck, a lesson and a song without a page load, so the title, the
  scroll, the focus and `TTBTrack.view()` are done by hand, and each of the
  four was a bug until it was.
- **Two addresses, one page.** At `/flashcard` it is framed over the map,
  with the map's radio and `ttb.lang`. At the subdomain it is another origin:
  no `ttb.lang`, the radio starts from silence, the brand links to the map,
  and `at()` carries `?lang=` and `?style=` onto every link. The subdomain's
  half cannot be reached on a local server; drive `/flashcard` and reason
  about the rest from `ON_SUBDOMAIN` in the script.
- **Kept the same by hand**, because neither dialect imports the other:
  `MAX_NAME` and `MAX_SIDE` in the route and the page, and `MAX_SIDE` a third
  time in the validator; `GRAMMAR` and `SONGS` in the page against
  `GRAMMAR_DECK` and `SONG_DECK` in the route; `WORD` in the page and the
  validator; `asForm()` in the page and in `tools/decks.mjs`; `WRITTEN` in
  `functions/api/_decks.js` and `tools/decks.mjs`; and `SAY_TAKE` in the
  page, bumped whenever `VOICE` or `SPEED` in `say.js` changes.
- **The share card** is `assets/logo/og-flashcard.png`, drawn by `node
  tools/ogcard.mjs` from `assets/flashcard.css`, the colour tokens, and the
  `flashEyebrow`, `flashTitle`, `flashWhat` and `flashTurn` words. Change any
  of them and redraw it in the same commit. It needs a Chromium, and nothing
  in CI can see that it went stale.

## The routes

- **`functions/api/flashcard.js`** answers everything the page draws, out of
  the folder through `shelf()`, `shippedOne()` and `shippedDecks()` in
  `functions/api/_decks.js`. `GATES`
  and `shutAt()` decide what a stage sends; `wordsKnown()` is the one count of
  words known, which the gates and the line on the shelf both read — never a
  second. `deckOf()` is every read of somebody's own deck; `report` is the one
  write with no session, and the one that wants `SAVE_SALT`; spacing is off,
  in one line of `knownOf()`. Its tables are applied by hand, to production.
- **`functions/flashcard.js`** writes the head in the language the link
  carried, out of `DECK_LANGS`, and the deck's words into `<main>` — each
  word with its meaning in all three, the rest in English — with a
  `DefinedTermSet` beside them. `where()` makes the live domain the canonical
  even on the subdomain. A deck out of the database is `noindex`.
- **`functions/api/say.js`** is Tartu's voice for exactly what is in
  `data/decks/spoken.json`, and reads nothing else. **Hearing it** says the
  sandbox a session works in cannot reach
  `api.tartunlp.ai`, so a 502 driven locally is expected and is not the route
  failing.

## Driving it

- **A content change**: `node tools/decks.mjs` first, since the routes read
  what it writes, and then the validator is most of the check — read its
  warnings on what you added. Then open what you added. The page asks its
  route for everything, so `python3 -m http.server` shows an empty page: use
  `npx wrangler pages dev .` and open `/flashcard?d=<id>` — in a cloud session
  with no Cloudflare token, **The house, and driving without a token** in the
  `/chess` skill is how it starts — or Playwright with `/api/flashcard` stubbed
  from the file.
- **Look at**: the deck's tile on the shelf under its heading, a card turned
  over with its forms and its sentence, a lesson's tables, a song's word
  boxes — at 390 px, in a light and a dark style. Signed out, five answers in a
  tab are free and then the gate stands (`FREE_WORDS`). A deck in a stage that
  has not opened is shown to somebody signed out who has its address, and to
  an account that knows enough words; anybody else signed in gets the card
  saying what opens it.
- **The speaker** answers 502 here. Say so in the PR; after landing, the curl
  under **Hearing it** checks a new line against the live site.

## The pull request

**The pull request** in `CLAUDE.md` is the sequence, the `/site` and `/api`
particulars apply where the page or a route moved, and this process adds:

- The generators: `node tools/decks.mjs` for any change to `data/decks.json`,
  and the folder committed with it; `node tools/sitemap.mjs` for a deck,
  lesson or song added, removed or renamed; `node tools/stamp.mjs` if
  anything in `assets/` moved;
  `node tools/languages.mjs` if `data/ui.json` did; `node tools/ogcard.mjs` if
  the share card's styles or words did.
- The body says what was added and where it sits in its stage, which counts
  moved and which copies were left, which languages are written and which
  only warn, which sentences no native speaker has read, and what was driven.
  For a reported card that was fixed, it carries the line that clears its
  reports, for the owner to run.
- After landing, nothing, for content. A schema change is the `/api`
  skill's, applied by hand to production; a reported card's line is the
  owner's to run.

## Where it goes wrong

- **A deck added and the folder or the sitemap not rewritten.** CI fails on
  the file `tools/decks.mjs` would write, or on `sitemap.xml`, whose message
  names `data/decks.json` among what it is written from. Under `pages dev`
  the first of those is quieter: the deck is simply not there.
- **A card added to *First words* or *At a restaurant*.** Valid, and it
  quietly changes what the four-hundred gate asks of everybody.
- **The counts.** "Fifty-two decks, wherever the count is written" was a
  sweep of its own after the decks outran their prose, the deck added after
  it missed the middleware's copy that same evening, and the same README section
  still carries numbers from shelves of forty-two. One copy is the sentence a
  search result prints under the page.
- **Words written in bulk and never read.** The import that brought the
  second thousand left its sentences out on purpose rather than write nine
  hundred unread ones, and a back that reads unlike its neighbours is found by
  reading the deck, not by the validator.
- **The page's copy of a rule drifting from the route's**: a cap, a reserved
  id, `WORD`, `asForm()`. The validator holds the file to its own `MAX_SIDE`
  and `WORD`; nothing holds the page's copies to the route's but the next
  session.
- **The share card a month behind** the stylesheet, on every link anybody
  sends.
- **`flashcard-first.js` asking a different address than `boot()`.** Not
  broken — one request wasted on every load, and nothing says so.
