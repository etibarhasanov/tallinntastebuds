# The feedback page — a description and a mockup, not the change

**Waiting on the owner's answer.** Nothing under `assets/`, `functions/` or
`db/` has been written. Nothing in this folder is served by the site, stamped,
validated or translated, and it should come out in the pull request that
builds the page — Pages serves every file in the repository, so a mockup left
here after the real page lands is a second, wrong copy of it at a public
address.

This is the written shape **Something new is described before it is built**
in `CLAUDE.md` asks for, with the pictures a new page is owed. It has been
through one round with the owner already: the decisions they made are folded
in below and marked **decided**; what is still theirs to answer is at the
end.

## What it is

One page, `/feedback`, where anybody says what they would change about this
site — what they want to see, how they want to see it, which part is wrong —
with their name on it or without, and puts a heart on what other people said.
Same frame as the blog and the lists page: the brand header, the 640px
column, the cards, the four controls. It is reached by its address alone
until the owner adds the door from the map, which they have said comes later.

The owner has said the sentence under the title is theirs to write and will
come later. The mockup carries a stand-in.

## Three arrangements

The three files are the same page three ways, drawn on the site's own
stylesheets. Open any of them over the repo root — `python3 -m http.server
8000`, then `/design/feedback/a-directory.html` — with `?style=green` for the
dark style and `?state=` for one of the states below. `render.mjs` draws
every combination to PNG.

- **A — the directory's shape** (`a-directory.html`). A head with no card
  under it, the fields as the first card, then one card per piece of feedback
  with the heart in its corner. It is `/lists` rearranged, so a visitor who
  has seen the directory has seen this. **Recommended:** the ask is open on
  arrival, the accent is spent once per surface, and nothing on it is a shape
  the site does not already draw.
- **B — the guestbook** (`b-guestbook.html`). One card carries the title, the
  sentence and the fields, in the order the sixth design rule puts a sheet
  in; a second, under the eyebrow *What people said*, carries every row,
  hairline-ruled the way `.menu` rules the account sheet. Denser — a phone
  shows a row more per screen — and the page reads as one thing rather than
  a stack. The one to pick if the feedback is expected to run long.
- **C — the sheet** (`c-sheet.html`). The page opens on what people said, and
  *Say something* opens the fields in a sheet: the account sheet's own card
  on the scrim, eyebrow, title, the line that says why, the fields, the one
  action, the close as the way out. It keeps the composer out of the way, at
  the cost of a step in front of the one thing the page is for, and a sheet
  to build and wire (keyboard, scrim, focus, close) — and signed out, the
  name and password make it a tall sheet on a phone.

Mixing is fine — B's rows under A's head, say.

## The heart — decided

A like is a heart and nothing else: no word, and small. It is the map panel's
own save mark (`.panel-save` in `assets/styles.css`) laid in the row's foot
with a heart in place of the bookmark — a disc while it is only a mark, a
pill once it carries a number, the number inside it rather than beside it.
Outline is "not yet"; pressed, the outline fills and takes the accent. The
count is hidden at nought, for the reason a save count is. The word is only
for a screen reader.

**Anyone can press it, signed in or not.** It is filed the way a save is —
under the account when there is a session and under the device's own id when
there is not — one row per (feedback, owner), as honest as a save count and
no more. Nobody hearts their own: your own rows carry *Remove*, and the heart
on them is a number and not a press.

## One order, and the page decides it — decided

No chips and nothing to choose. The most hearted come first, and whatever was
posted in the last ten minutes stands above them all, newest first, so a new
thing is seen before the hearts have had a chance to say anything about it.
After that it sits where its hearts put it, newest first among equals. Ten
minutes is one constant in the Function, `FRESH_MINUTES`, and easy to make an
hour.

The person who just posted sees theirs at the top regardless, on the page they
posted from — the *posted* state below — which is the only time the page
puts one row above the order.

## Posting, and putting your name on it — decided

Posting anonymously needs nothing: no account, no sign-in, no wall. The
choice under the field is *Post as*, the lists page's own two-way control
with the filled half being the answer:

- **Signed in:** your username, or *Anonymous*.
- **Signed out:** *Anonymous*, or *With a name*. Choosing the second reveals,
  under the choice and inside the same card, the account sheet's two fields —
  *Username* and *Password*, with the sheet's own hints — then *or* and
  *Continue with Google*. There is still one filled button, *Post feedback*.
  Pressing it does two things in one request: makes the account or signs
  into it, and posts. A name nobody has is a new account; a name that exists
  is a sign-in and needs its password, and the wrong one is refused with the
  sheet's own *Wrong username or password*. Afterwards the page says *Posted.
  You are signed in as {name}.*, the header carries the name, and the choice
  becomes the signed-in one.

*Continue with Google* is the site's own round trip, `/api/google?then=
/feedback`, and comes back here. What was typed is kept in the browser
(`localStorage`, `ttb.feedbackDraft`) before leaving and put back in the
field on return; somebody Google has never sent here before is asked to
choose a name the way the map asks, in the same card, and then posts.

This is the one place on the site where a sign-in form stands somewhere
other than the map's sheet and the splitwise page, and it reuses that
sheet's fields, hints, rules and errors rather than drawing its own — which
is what the fourth design rule asks. It is also the one form here that signs
up and signs in through the same two fields; the hint under the name says
which it will do.

## Every state

All of them are in the mockup, chosen by `?state=`:

| `state=` | What is drawn |
| --- | --- |
| `in` | Signed in. The field; *Post as* with the username and *Anonymous*; the one filled button. |
| `out` | Signed out, *Anonymous* chosen. Nothing else asked. |
| `name` | Signed out, *With a name* chosen: the two fields, *or*, *Continue with Google*, then the button. |
| `posted` | Just posted. *Posted. It is at the top of the page.* above the fields — nobody looks under the button they have already pressed — the field emptied, and the new row first, carrying *Remove* where the others carry a heart. |
| `err` | Did not go through. The same line in the accent above the fields, and what was typed stays in the field. The same place says *Write something first*, *That is over 500 characters*, the sheet's own username and password errors, and, for the fourth post from one fingerprint in an hour, that three is plenty for now. |
| `empty` | Nothing yet. The composer, then one mono line: *Nothing here yet. The first thing somebody says turns up on this page.* |
| `fail` | `/api/feedback` did not answer. The composer still draws — nothing on this site waits on `/api/*` — and the same mono line says the feedback could not be loaded. |
| `sheet` | Template C only: the sheet open over the page. |
| loading | Not drawn. The head and the composer are in the markup and show at once; the rows arrive with the data and nothing spins meanwhile, which is how every other page here does it. |

On a row: the text, then a byline — a named row's name is a link to
`/u/<name>`, the way a list's byline is; an anonymous row says *Anonymous* —
and the date in the blog's own format, then the heart. Twenty rows a page and
*Show more* under them.

## The copy

English below. Every one goes into `data/ui.json` in all ten languages before
it ships, and the validator refuses it otherwise. Dates reuse `blogDate` and
each language's `months`; *Show more* and the generic error reuse
`listsAllMore` and `listsErrGeneric`; the account half reuses
`accountUsername`, `accountPassword`, `accountNoReset`, `accountOr`,
`accountGoogle`, `accountGoogleName`, `accountErrUsername`,
`accountErrPassword`, `accountErrNoMatch` and `accountErrSlow` as they are.

| Key | English |
| --- | --- |
| `feedbackDocumentTitle` | Feedback \| Tallinn Tastebuds |
| `feedbackSkip` | Skip to the feedback |
| `feedbackTitle` | Feedback |
| `feedbackLead` | **The owner's sentence.** Stand-in: *What would you change about this site? Say it here, and put a heart on what others said if you agree.* |
| `feedbackYours` | Your feedback |
| `feedbackHint` | What do you want to see, and what is wrong? |
| `feedbackCount` | {n} / 500 |
| `feedbackAs` | Post as |
| `feedbackAnon` | Anonymous |
| `feedbackWithName` | With a name |
| `feedbackNameHint` | 3 to 24 letters, numbers or dashes. A new name makes an account; one you already have signs you in. |
| `feedbackPost` | Post feedback |
| `feedbackPosted` | Posted. It is at the top of the page. |
| `feedbackPostedNew` | Posted. You are signed in as {name}. |
| `feedbackErrEmpty` | Write something first. |
| `feedbackErrLong` | That is over 500 characters. |
| `feedbackErrOften` | That is three in an hour. Give it a little while. |
| `feedbackHeart` | Like this *(the heart's label for a screen reader)* |
| `feedbackHearted` | Liked |
| `feedbackHeartsOne` | liked by 1 person *(the count's label; the number alone is drawn)* |
| `feedbackHeartsN` | liked by {n} people |
| `feedbackRemove` | Remove |
| `feedbackRemoveSure` | Remove your feedback? It cannot be put back. |
| `feedbackNone` | Nothing here yet. The first thing somebody says turns up on this page. |
| `feedbackFail` | The feedback could not be loaded. Try again in a moment. |
| `feedbackSaid` | What people said *(template B's eyebrow over the rows)* |

Only if C is chosen: `feedbackSay` *Say something* and `feedbackSayWhy` *What
you would change, what is missing, what is wrong. It goes on the page for
everybody to read.*

## At 390 px

One column, the cards the width of the screen less the 16px gutters, the
title down to 25px the way the blog's is. Every field is 16px, which is not
a taste decision: anything smaller makes iOS zoom the page when it takes
focus. In a row's foot the byline and the heart share a line, and the heart
drops under the byline when they do not fit rather than pushing the date off
the card. With a name chosen, the card is long on a phone and it scrolls with
the page; on C it is the sheet that scrolls. Nothing scrolls sideways. Both
styles come out of the tokens; the dark one is in the pictures, and nothing
in `mockup.css` names a colour.

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
  Taking one down is by hand — `UPDATE feedback SET hidden = 1 WHERE id =
  '…'` through the write gate — with the column there from the first day so
  a button for the owner's account can come later without a migration.
- **No search**, and no indexing: `noindex, follow` like `/lists.html`, so a
  search for the site does not land on its complaints. Flippable later.
- **No notification.** The owner reads the page.

## What it costs

- **`feedback.html`** — a new page. It joins `PAGES` in `tools/stamp.mjs`,
  carries `assets/analytics.js` in its head, gets two rules in `_headers`
  (`/feedback.html` and `/feedback`, revalidating, noindex), a `Disallow` in
  `robots.txt` like the account page's, and no line in `sitemap.xml`.
- **`assets/feedback.js`** — ES5, one IIFE, the boot block copied whole
  (`applyStyle`, `pickLanguage`, `applyStaticStrings`), the draft kept across
  the Google trip, and three `TTBTrack` events — `feedback_post`,
  `feedback_heart`, `feedback_remove` — with rows in the README's Analytics
  table. Nothing in it waits on `/api/`.
- **`assets/feedback.css`** — the first half of `mockup.css`, about sixty
  lines, the way `blog.css` is only what a page of prose needs.
- **`functions/api/feedback.js`** — one route.
  `GET /api/feedback?before=<cursor>` answers
  `{ ready, me, rows: [{ id, text, name, at, hearts, hearted, mine }], more }`,
  twenty at a time in the one order above, `name` null on an anonymous row,
  `hearted` and `mine` for the caller. `POST` takes
  `{ action: 'say', text, as: 'anon' | 'name', username, password, client }`,
  `{ action: 'heart' | 'unheart', id, client }` and
  `{ action: 'remove', id, client }`; a session is optional and the device id
  stands in for it, as on `/api/saves`; `remove` needs the row's owner. With
  `as: 'name'` and no session it signs up or signs in first, through the
  same code `/api/account` runs — `USERNAME_RE`, the PBKDF2 derivation and
  `matches()`, the session and its cookie, `login_fails`, `username_holds`,
  `claimDeviceSaves()` — which means lifting those out of `account.js` into a
  module both routes import, the way `_google.js` already stands beside it.
  That is the largest single cost here and it is a refactor of a 793-line
  file. `MAX_FEEDBACK 500` binds in the Function and is restated as
  `maxlength` in the script, per **Caps live in two places**. The fingerprint
  under `SAVE_SALT` caps posting at three an hour. `no-store`. Without `DB` or
  `SAVE_SALT`: `ready: false` and `503`, like the others.
- **`db/schema.sql`** — two tables, applied by hand to preview first and to
  production on landing, and the readers survive their absence:
  - `feedback` — `id TEXT PRIMARY KEY, owner TEXT, owner_kind TEXT,
    named INTEGER, text TEXT, ip_hash TEXT, created_at INTEGER,
    hidden INTEGER NOT NULL DEFAULT 0`, indexed on `(hidden, created_at
    DESC)`. `named` is whether the row shows its author; `owner` is kept
    either way, so an anonymous row is still yours to remove and still
    counts against your cap.
  - `feedback_hearts` — `feedback_id, owner, created_at, PRIMARY KEY
    (feedback_id, owner)`, counted with a `GROUP BY` at read time the way
    keeps are — the note on `list_keeps` in `db/schema.sql` is the argument
    against a counts table — and the order is computed over that count.
- **`data/ui.json`** — the keys above, ten languages each.
- **`README.md`** — a **Feedback** section; a row in the `/api` skill's route
  table; `feedback.html` in the `/site` skill's stamper list; a line under
  **Accounts** saying the sign-in form now stands in three places.

## What is still the owner's to answer

1. **Which arrangement** — A, B, C, or a mix. A is recommended.
2. **The ten minutes.** The window a new post stands at the top for, before
   its hearts decide. Ten is what was said; an hour would suit a page few
   people open in any one minute. One constant either way.
3. **Taking one down by hand** for now, as above — or is a *Take down* for
   the owner's account wanted from the first day? By hand is assumed until
   told otherwise.

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
