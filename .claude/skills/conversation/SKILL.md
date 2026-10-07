---
name: conversation
description: Add a conversation to the flashcards from a sheet of a language course — a PDF or pasted text, Estonian with its English — or change one. Use for anything under "talks" in data/decks.json.
---

# Add a conversation

A conversation is a sheet from a language course, written out turn by turn
and sentence by sentence
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
  the name is on its own line, why every word is a press and the glossary
  they share, and what was done to
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
sheet's own paragraphing into turns, and then split each turn into its
sentences — **A turn is its sentences** below.

Four things were done to the first ten and are done again:

- **Speaker labels are checked against the sense.** One sheet marked a line
  of the waiter's *Klient*; a sheet of four names spelt one of them two ways;
  another left a paragraph with no speaker at all, which is a further turn
  of whoever spoke above it. Fix it and say so in the README section.
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
        {
          "who": "Krista",
          "lines": [
            { "et": "Jaa, vahel näen unenägusid.", "en": "Yes, sometimes I dream.", "az": "…", "ru": "…" },
            { "et": "…", "en": "…", "az": "…", "ru": "…" }
          ]
        }
      ]
    }
  ]
}
```

**A turn is its sentences.** Split it at the sheet's own full stops,
question and exclamation marks — never at an ellipsis — and give every
sentence its own English, Azerbaijani and Russian, so the reader never has to
find which half of a paragraph is which; the speaker beside each says that
one sentence. Where the sheet's English joins two Estonian sentences with a
semicolon or splits one in two, follow the Estonian.

What `tools/validate.mjs` holds it to:

| Field | Rule | If wrong |
|---|---|---|
| `id` | lowercase slug, `talk-` in front by convention, not a deck's, a lesson's or a song's, and not `talks`, `grammar`, `songs`, `missed`, `review`, `index` or `spoken` | error |
| `added` | a day, `YYYY-MM-DD`; the Start card calls the newest *New* for two weeks after it | missing warns, malformed fails |
| `name`, `why` | objects keyed by language: `en` required, `az` and `ru` warned about, never `et` | error / warning |
| `taste` | the opening of one of the sentences, or of a turn read straight through, exactly, and at most 36 characters — the line the Start card shows | error |
| `source` | a name, optional; drawn as *From {who}, a B1 course* | error if not a string |
| `scenes` | a non-empty list. Each has `turns`, a non-empty list, and an optional `ask` with `et` and the three meanings | error |
| a turn | `who` non-empty and `lines` a non-empty list | error |
| a line | `et` non-empty; `en` required, `az` and `ru` warned about; never `et` among the meanings | error / warning |
| every word | each word of every `ask` and sentence, lowercased, has an entry in `talkWords` or in the conversation's own `words` | error |
| `talkWords` | the glossary every conversation shares: per word, `base` and `means` (`en` required), an optional `note`, never a `deck`; an entry no conversation says fails | error |
| `words` | optional, on the conversation: the same shape, for a word that means something else in this sheet; an entry nobody in it says fails | error |

An interview sheet is one scene per question, in the sheet's order, a
question asked twice included. A dialogue sheet is one scene with no `ask`;
its heading — *Ostmine, kauba uurimine, allahindlus* — is the
conversation's `name`, not a question. Nothing in a conversation is a card, so there is no deck to
make; but every word is a press, so every word needs a gloss.

## The words

After the entry, `node tools/validate.mjs` names every word in the new sheet
that `talkWords` does not know yet — on a sheet from the same course that is
a quarter to a half of them, since the thirty so far share most of their
words. Write each one into `talkWords`, keyed by the word as written and
lowercased (`Järvelt` is `järvelt`; a hyphen splits a word, so
*Kohtla-Järve* is two and *39-aastane* is `aastane`): its `base`, the form a
dictionary files it under, and what it `means` in English, Azerbaijani and
Russian **as it is used** — *pesen* is *I wash*, not *to wash*. Where it is
used two ways across sheets, say both with the phrase each is in (*kui*:
*if; when; than; how*), and where one sheet uses it a way the entry does not
cover, give that sheet its own `words` entry rather than bending the
glossary. Glosses written by hand in a scratch file, `form|base|en|az|ru` a
line, and a short script that merges them sorted is how the first eleven
hundred went in. Never write a `deck`: `tools/decks.mjs` finds where a word
is taught from its `base`, so the base has to be the bare dictionary form a
card's front would be.

## The translations

The English is the sheet's. The Azerbaijani and the Russian are written here,
sentence by sentence, in the register of the Estonian — *sina* is *сен* and *ты*, the
waiter's *teie* is *siz* and *вы* — and they want a native reader the way the
songs' did; say so in the PR. Write the `why` so it reads as a line under a
tile at 390 px: what happens, not what the sheet is called.

## The steps

1. Render and read the sheet, as above. Write the entry.
2. `node tools/decks.mjs`, which writes the conversation's own file into
   `data/decks/`, its row into the index and its sentences into the voice's
   list.
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
6. Press a few words of the new tile — one in a question, one at the foot of
   a long turn — and see the box open under its sentence and shut on a second
   press.
7. The README section's count — *there are thirty* — and the line in **Files**
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

- A `taste` that is not exactly the opening of a sentence or a turn, or that runs past 36
  characters — the first ten tripped on the second with a greeting of 38.
- The source edited and `node tools/decks.mjs` not run: CI fails on the file
  it would write, and under a local server the new tile is simply not there.
- An `et` among the meanings of a line: the validator fails it, since Estonian
  is what the line is, never what it means.
- A turn whose languages split into different numbers of sentences — the
  sheet's English with two joined by a semicolon. Follow the Estonian.
- An id another batch already took. The second and third batches were
  written at once, and both reached for `talk-home`; the third's is
  `talk-like-home`. `git fetch` and look at `talks` before naming one.
  The fourth was written as whole turns while the third was making every
  turn its sentences, and had to be split again after the rebase: fetch
  before writing the entry, not only before the pull request. A script that
  splits at a full stop before a capital misses a sentence that opens with a
  number — *2010-cu ildə…* — so count the sentences per language after it.
- Text read off a rendered page with an õ read as an o. Read the Estonian
  twice, and where the page is blurry, render it at a higher `-r`.
- A new press name — a new `TTBTrack.event` — without its row in the README's
  **Analytics** table and in `data/flows.json`; the validator fails the flow.
  A conversation needs none: `flash_talk_open`, `flash_talk_read` and
  `flash_talk_word` are the three, and they are there.
- A sheet's English that says more than its Estonian: the sheet on the wider
  family has two sentences of English Ingrid never says. The English is
  there to say what the Estonian means, so the extra goes, and the README
  section says so.
- A sheet whose licence nobody has asked about. The text is the course's;
  credit it in `source` and say in the PR that printing it is the owner's
  call.
