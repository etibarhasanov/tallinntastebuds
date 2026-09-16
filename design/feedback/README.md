# The feedback page — a description and a mockup, not the change

**Waiting on the owner's answer.** Nothing under `assets/`, `functions/` or
`db/` has been written. Nothing in this folder is served by the site, stamped,
validated or translated, and it should come out in the pull request that
builds the page — Pages serves every file in the repository, so a mockup left
here after the real page lands is a second, wrong copy of it at a public
address.

This is the written shape **Something new is described before it is built**
in `CLAUDE.md` asks for, with the pictures a new page is owed. Three
arrangements of the same page are beside this file; the owner picks one, or
a mix, answers the three questions at the end, and the building starts.

## What it is

One page, `/feedback`, where anybody says what they would change about this
site — what they want to see, how they want to see it, which part is wrong —
with their name on it or without, and likes what other people said. Same
frame as the blog and the lists page: the brand header, the 640px column,
the cards, the four controls. It is reached by its address alone until the
owner adds the door from the map, which they have said comes later.

The owner has said the sentence under the title is theirs to write and will
come later. The mockup carries a stand-in.

## Three arrangements

The three files are the same page three ways, drawn on the site's own
stylesheets. Open any of them over the repo root — `python3 -m http.server
8000`, then `/design/feedback/a-directory.html` — with `?style=green` for the
dark style and `?state=` for one of the states below. `render.mjs` draws
every combination to PNG.

- **A — the directory's shape** (`a-directory.html`). A head with no card
  under it, the fields as the first card, the order chips, then one card per
  piece of feedback with the like in its corner. It is `/lists` rearranged,
  so a visitor who has seen the directory has seen this. **Recommended:** the
  ask is open on arrival, the accent is spent once per surface, and nothing
  on it is a shape the site does not already draw.
- **B — the guestbook** (`b-guestbook.html`). One card carries the title, the
  sentence and the fields, in the order the sixth design rule puts a sheet
  in; a second carries every row, hairline-ruled the way `.menu` rules the
  account sheet. Denser — a phone shows a row more per screen — and the page
  reads as one thing rather than a stack. The one to pick if the feedback is
  expected to run long.
- **C — the sheet** (`c-sheet.html`). The page opens on what people said, and
  *Say something* opens the fields in a sheet: the account sheet's own card
  on the scrim, eyebrow, title, the line that says why, the fields, the one
  action, the close as the way out. It keeps the composer out of the way, at
  the cost of a step in front of the one thing the page is for, a sheet to
  build and wire (keyboard, scrim, focus, close), and a row on which the
  filled button and the pressed *Newest* chip both wear the accent.

Mixing is fine — B's rows under A's head, say.

## Every state

All of them are in the mockup, chosen by `?state=`:

| `state=` | What is drawn |
| --- | --- |
| `in` | Signed in. The field; *Post as*, with the username and *Anonymous* as a two-way choice — the lists page's own public/private control, the filled half being the answer; and the one filled button. |
| `out` | Signed out. No choice to make: a line under the field says it is posted anonymously, and *Sign in* in it links to the map's account sheet (`/?account=in`), where the lists page sends people too. Nothing is a wall. |
| `posted` | Just posted. *Posted. It is at the top of the page.* above the fields — nobody looks under the button they have already pressed — the field emptied, and the new row first, carrying *Remove* where the others carry a like. |
| `err` | Did not go through. The same line in the accent above the fields, and what was typed stays in the field. The same place says *Write something first*, *That is over 500 characters* and, for the fourth post from one fingerprint in an hour, that three is plenty for now. |
| `empty` | Nothing yet. The composer, then one mono line: *Nothing here yet. The first thing somebody says turns up on this page.* No order chips over nothing. |
| `fail` | `/api/feedback` did not answer. The composer still draws — nothing on this site waits on `/api/*` — and the same mono line says the feedback could not be loaded. |
| loading | Not drawn. The head and the composer are in the markup and show at once; the rows arrive with the data and nothing spins meanwhile, which is how every other page here does it. |

On a row: a like is the site's keep button with a heart in place of the
bookmark — outline and *Like*, then filled, in the accent, and *Liked*, so
the colour is never the only thing saying so. The count stands beside it and
is hidden at nought, for the reason a save count is. A named row's name is a
link to `/u/<name>`, the way a list's byline is; an anonymous row says
*Anonymous*. Your own rows carry *Remove* instead of a like, and keep their
count. Twenty rows a page and *Show more* under them; *Newest* first, or
*Most liked* with newest breaking the tie.

## The copy

English below. Every one goes into `data/ui.json` in all ten languages before
it ships, and the validator refuses it otherwise. Dates reuse `blogDate` and
each language's `months`; *Order*, *Newest*, *Show more* and the generic
error reuse `listsOrder`, `listsOrderNew`, `listsAllMore` and
`listsErrGeneric`.

| Key | English |
| --- | --- |
| `feedbackDocumentTitle` | Feedback \| Tallinn Tastebuds |
| `feedbackSkip` | Skip to the feedback |
| `feedbackTitle` | Feedback |
| `feedbackLead` | **The owner's sentence.** Stand-in: *What would you change about this site? Say it here, and like what others said if you agree.* |
| `feedbackYours` | Your feedback |
| `feedbackHint` | What do you want to see, and what is wrong? |
| `feedbackCount` | {n} / 500 |
| `feedbackAs` | Post as |
| `feedbackAnon` | Anonymous |
| `feedbackAnonOut` | Posted anonymously. |
| `feedbackSignIn` | Sign in to put your name on it. |
| `feedbackPost` | Post feedback |
| `feedbackPosted` | Posted. It is at the top of the page. |
| `feedbackErrEmpty` | Write something first. |
| `feedbackErrLong` | That is over 500 characters. |
| `feedbackErrOften` | That is three in an hour. Give it a little while. |
| `feedbackOrderLiked` | Most liked |
| `feedbackLike` | Like |
| `feedbackLiked` | Liked |
| `feedbackLikedOne` | liked by 1 person *(the count's label for a screen reader; the number alone is drawn)* |
| `feedbackLikedN` | liked by {n} people |
| `feedbackRemove` | Remove |
| `feedbackRemoveSure` | Remove your feedback? It cannot be put back. |
| `feedbackNone` | Nothing here yet. The first thing somebody says turns up on this page. |
| `feedbackFail` | The feedback could not be loaded. Try again in a moment. |

Only if C is chosen: `feedbackSay` *Say something* and `feedbackSayWhy` *What
you would change, what is missing, what is wrong. It goes on the page for
everybody to read.* Only if likes need an account (question 1):
`feedbackLikeIn` *Sign in to like this*.

## At 390 px

One column, the cards the width of the screen less the 16px gutters, the
title down to 25px the way the blog's is. The field is 16px, which is not a
taste decision: anything smaller makes iOS zoom the page when it takes focus.
*Order* loses its word on a phone — `lists.css` already does that under
560px — and the chips stand alone. In a row's foot the byline and the like
share a line, and the like drops under the byline when they do not fit rather
than pushing the date off the card. Nothing scrolls sideways. Both styles
come out of the tokens; the dark one is in the pictures, and nothing in
`mockup.css` names a colour.

## What it deliberately does not do yet

- **No door from the map.** The owner adds it later; until then the page
  answers at its address alone.
- **No reply from the owner** under a piece of feedback. The page is one way.
  A reply is a second kind of row by a second author, and worth its own
  description when it is wanted.
- **No editing.** Remove it and say it again.
- **No kind or category** — bug, idea, the map, the chat. The sentence
  carries it. A chip row to pick from is the obvious next thing and cheap to
  add; it is not in the first version so the first version is a page and not
  a form.
- **No moderation queue.** A post is on the page the moment it is made.
  Taking one down is by hand — question 2.
- **No search**, and no indexing: `noindex, follow` like `/lists.html`, so a
  search for the site does not land on its complaints. Flippable later.
- **No notification.** The owner reads the page.

## What it costs

- **`feedback.html`** — a new page. It joins `PAGES` in `tools/stamp.mjs`,
  carries `assets/analytics.js` in its head, gets two rules in `_headers`
  (`/feedback.html` and `/feedback`, revalidating, noindex), a `Disallow` in
  `robots.txt` like the account page's, and no line in `sitemap.xml`.
- **`assets/feedback.js`** — ES5, one IIFE, the boot block copied whole
  (`applyStyle`, `pickLanguage`, `applyStaticStrings`), and three `TTBTrack`
  events — `feedback_post`, `feedback_like`, `feedback_remove` — with rows in
  the README's Analytics table. Nothing in it waits on `/api/`.
- **`assets/feedback.css`** — the first half of `mockup.css`, about forty
  lines, the way `blog.css` is only what a page of prose needs.
- **`functions/api/feedback.js`** — one route.
  `GET /api/feedback?order=new|liked&before=<cursor>` answers
  `{ ready, rows: [{ id, text, name, at, likes, liked, mine }], more }`,
  twenty at a time, `name` null on an anonymous row, `liked` and `mine` for
  the caller. `POST` takes `{ action: 'say', text, anon, client }`,
  `{ action: 'like' | 'unlike', id, client }` and
  `{ action: 'remove', id, client }`; a session is optional and the device id
  stands in for it, as on `/api/saves`; `remove` needs the row's owner.
  `MAX_FEEDBACK 500` binds in the Function and is restated as `maxlength` in
  the script, per **Caps live in two places**. The fingerprint under
  `SAVE_SALT` caps posting at three an hour. `no-store`. Without `DB` or
  `SAVE_SALT`: `ready: false` and `503`, like the others.
- **`db/schema.sql`** — two tables, applied by hand to preview first and to
  production on landing, and the readers survive their absence:
  - `feedback` — `id TEXT PRIMARY KEY, owner TEXT, owner_kind TEXT,
    named INTEGER, text TEXT, ip_hash TEXT, created_at INTEGER,
    hidden INTEGER NOT NULL DEFAULT 0`, indexed on `(hidden, created_at
    DESC)`. `named` is whether the row shows its author; `owner` is kept
    either way, so an anonymous row is still yours to remove and still
    counts against your cap.
  - `feedback_likes` — `feedback_id, owner, created_at, PRIMARY KEY
    (feedback_id, owner)`, counted with a `GROUP BY` at read time the way
    keeps are — the note on `list_keeps` in `db/schema.sql` is the argument
    against a counts table — and *Most liked* orders on that count.
- **`data/ui.json`** — the keys above, ten languages each.
- **`README.md`** — a **Feedback** section; a row in the `/api` skill's route
  table; `feedback.html` in the `/site` skill's stamper list.

## The questions

1. **Who can like: anyone, or accounts only?** Like a save — filed under the
   device's own id when nobody is signed in, so anyone can press it in the
   first ten seconds, one row per (feedback, owner), as honest as a save
   count — or like a keep, an account or nothing? **Recommended: like a
   save.** The page should cost nothing to use. The other answer turns the
   signed-out like into a link to the sign-in sheet.
2. **Who takes one down, and how?** By hand — `UPDATE feedback SET hidden =
   1 WHERE id = '…'`, through the write gate, no route and no button — or
   the owner's own account gets *Take down* on every row from day one, which
   is an `OWNER_USERNAME` var and one more `POST` action. **Recommended: by
   hand to start**, with the column there from the first day so nothing has
   to change when a button is wanted.
3. **The word.** *Like / Liked* with a heart, as drawn — or *Agree / Agreed*,
   which on a page of requests tells the owner what the number means. Ten
   languages either way.

## How the pictures were made

```
NODE_PATH=/opt/node22/lib/node_modules node design/feedback/render.mjs
```

from the repo root, in an environment with Playwright's Chromium — the
`/site` skill says where it is. It serves the repo over HTTP, draws every
template in both styles at 390px and on a desk, every state, the sheet, and
three composed sheets, into `design/feedback/shots/`, which git ignores. Set
`TTB_FONTS` to a folder holding the three faces as `local.css` plus `.woff2`
files when Google Fonts cannot be reached from the browser.
