---
name: conversation
description: Add a conversation to the flashcards from a sheet of a language course — a PDF or pasted text, Estonian with its English — or change one. Use for anything under "talks" in data/decks.json.
---

# Add a conversation

A conversation is a sheet from a language course, written out turn by turn
under the **Conversations** part of the flashcards: who said it, the Estonian,
and what it means in the three languages the cards are written in. It is one
entry under `talks` in `data/decks.json`, written out into `data/decks/` by
`node tools/decks.mjs` like everything else in that file — no deck, no table,
no route, no page. The page, the routes, the generator and the validator
already know the shape, so adding one is reading a sheet carefully, writing
two translations, and a pull request. It is content in the flashcards, so the
`/flashcards` skill is the frame this sits in: its rules for the file, its
generators and its pull request apply here too. The first ten came from **Keeletee**, the free B1 course,
as PDFs; the owner has more coming, and this file is so that the second batch
costs less than the first.

## Read first

- The `/flashcards` skill, **The file** and **What else moves when the file
  moves**.
- `README.md` → **Conversations, which are read**, under **Flashcards**: why
  the name is on its own line, why no word is a press, and what was done to
  the sheets' text. Then **The back of the card is in three languages** and
  **Three languages, not ten**, which are why a turn carries `en`, `az` and
  `ru` and no more.
- The `talks` block of `tools/validate.mjs` — every rule below is a line in it
  — and `talkCard()` in `assets/flashcard.js`, which is what the entry is
  drawn as.
- The last conversation in `data/decks.json`, as the worked example of the
  shape.

## Reading the sheet

A course's PDF usually has the text as real glyphs and no way to get them
out: the Keeletee sheets embed Calibri with no Unicode map, so `pdftotext`
returns nothing. Do not OCR it. Render the pages and read them:

```
pdftoppm -r 110 -png <sheet>.pdf <dir>/<name>
```

then open each PNG with the Read tool, which shows it as an image, and type
the Estonian out. Read it twice: õ, ä, ö and ü are the letters a quick reading
drops, and *„…“* quotes and an ellipsis are part of the text. Keep the
sheet's own paragraphing of a turn; a turn is one string, sentences and all,
because the speaker beside it says the whole turn.

Four things were done to the first ten and are done again:

- **Speaker labels are checked against the sense.** One sheet marked a line
  of the waiter's *Klient*; a sheet of four names spelt one of them two ways.
  Fix it and say so in the README section.
- **The English is tidied, not rewritten.** Typos go; a literalism that is
  not English becomes English (*Do you see dreams?* → *Do you dream?*); the
  sense and the register stay the sheet's.
- **A greeting with no English stays Estonian**, with a gloss beside it:
  *Jätku leiba* and *Jätku tarvis* are the worked example, because *Enjoy your
  meal* has no reply in English and the reply is what is worth learning.
- **Names and role words are never translated.** `who` is *Krista* or
  *Ettekandja* in every language, and so is a name inside a `why`.

## The entry

Under `talks`, in the order of the course — the order the file is in is the
order the shelf draws:

```json
{
  "id": "talk-booking",
  "added": "2026-10-06",
  "name": { "en": "Booking a table and paying the bill", "az": "…", "ru": "…" },
  "why":  { "en": "A customer settles up, then books a table by the window for Tuesday at seven", "az": "…", "ru": "…" },
  "taste": "Vabandust! Hei! Halloo!",
  "source": "Keeletee",
  "scenes": [
    {
      "ask": { "et": "Kas sa näed unenägusid?", "en": "Do you dream?", "az": "…", "ru": "…" },
      "turns": [
        { "who": "Krista", "et": "Jaa, vahel näen unenägusid. …", "en": "Yes, sometimes I dream. …", "az": "…", "ru": "…" }
      ]
    }
  ]
}
```

What `tools/validate.mjs` holds it to:

| Field | Rule | If wrong |
|---|---|---|
| `id` | lowercase slug, `talk-` in front by convention, not a deck's, a lesson's or a song's, and not `talks`, `grammar`, `songs`, `missed`, `review`, `index` or `spoken` | error |
| `added` | a day, `YYYY-MM-DD`; the Start card calls the newest *New* for two weeks after it | missing warns, malformed fails |
| `name`, `why` | objects keyed by language: `en` required, `az` and `ru` warned about, never `et` | error / warning |
| `taste` | the opening of one of the turns, exactly, and at most 36 characters — the line the Start card shows | error |
| `source` | a name, optional; drawn as *From {who}, a B1 course* | error if not a string |
| `scenes` | a non-empty list. Each has `turns`, a non-empty list, and an optional `ask` with `et` and the three meanings | error |
| a turn | `who` and `et` non-empty; `en` required, `az` and `ru` warned about; never `et` among the meanings | error / warning |

An interview sheet is one scene per question. A dialogue sheet is one scene
with no `ask`. Nothing in a conversation is a card and nothing is a press, so
there is no `words` to write and no deck to make: that is the decision
**Conversations, which are read** records, and it is not this skill's to
reverse.

## The translations

The English is the sheet's. The Azerbaijani and the Russian are written here,
turn by turn, in the register of the Estonian — *sina* is *сен* and *ты*, the
waiter's *teie* is *siz* and *вы* — and they want a native reader the way the
songs' did; say so in the PR. Write the `why` so it reads as a line under a
tile at 390 px: what happens, not what the sheet is called.

## The steps

1. Render and read the sheet, as above. Write the entry.
2. `node tools/decks.mjs`, which writes the conversation's own file into
   `data/decks/`, its row into the index and its turns into the voice's list.
   The routes read that folder and not the source, so a conversation not
   written out is one the page cannot open and the voice will not say.
3. `node tools/sitemap.mjs`, because every conversation is an address.
4. `node tools/validate.mjs`. The errors it prints name the scene and the
   turn; it also fails a `data/decks/` or a `sitemap.xml` that was not
   rewritten. Commit the folder and the sitemap with the source.
5. **Drive it.** `npx wrangler pages dev .` where it runs; where it cannot
   reach Cloudflare — this sandbox cannot — a stub of `GET /api/flashcard`
   that answers the file's `talks` and one `?deck=` whole, under
   `python3 -m http.server` or a Node server, is enough, since the page asks
   that route for everything. Open Start — the Conversations card and its
   *New* tag — the Conversations part, and the new tile, at 390 px and in a
   light and a dark style. Press a speaker: the button should go quiet with
   the voice's own line when the route is stubbed, and the page go on.
6. The README section's count — *there are ten* — and the line in **Files**
   move with it, and so does this file if the sheet taught a step nobody had
   written down.

## The commit

> Four more conversations from Keeletee's second module are on the shelf
> The booking conversation says kahekümne viies, as the sheet does

The body says which sheets, what was done to their text, and that the two
translations are the session's.

## The pull request

1. `git fetch origin claude/tallinn-tastebuds-map-nzoqx0 && git rebase origin/claude/tallinn-tastebuds-map-nzoqx0`
2. `node tools/decks.mjs`, `node tools/sitemap.mjs` and `node tools/validate.mjs`.
3. The tile and the page in a browser, as in step 4 above.
4. One commit per batch of sheets, subject about what is now on the shelf.
5. `git push -u origin <branch>`, or `--force-with-lease` after a rebase.
6. Open the PR against the default branch. The body names the sheets and the
   course, what was corrected in them, which languages are the session's, and
   what was driven.
7. CI green, then **Rebase and merge**; the branch stays, `CLAUDE.md` says
   why. Nothing to load: a conversation is a file.

## Where it goes wrong

- A `taste` that is not exactly the opening of a turn, or that runs past 36
  characters — the first ten tripped on the second with a greeting of 38.
- The source edited and `node tools/decks.mjs` not run: CI fails on the file
  it would write, and under a local server the new tile is simply not there.
- An `et` among the meanings of a turn: the validator fails it, since Estonian
  is what the turn is, never what it means.
- Text read off a rendered page with an õ read as an o. Read the Estonian
  twice, and where the page is blurry, render it at a higher `-r`.
- A new press name — a new `TTBTrack.event` — without its row in the README's
  **Analytics** table and in `data/flows.json`; the validator fails the flow.
  A conversation needs none: `flash_talk_open` and `flash_talk_read` are the
  two, and they are there.
- A sheet whose licence nobody has asked about. The text is the course's;
  credit it in `source` and say in the PR that printing it is the owner's
  call.
