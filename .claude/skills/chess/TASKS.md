# The chess page, task by task

Six tasks, in the order they land. Each is one pull request that leaves the
site whole: nothing half-built is ever on the live branch, and nothing links to
the page until the last task. `SKILL.md` beside this file is the agreed shape
and the process; read it first, top to bottom.

**The next task is the first unticked box.** `grep -n '^- \[ \]'
.claude/skills/chess/TASKS.md | head -1` says which. Tick it in the same pull
request that lands it, and only then. A task found wrong while doing it is
corrected here, in that same PR, with the reason in the PR body.

Every task also does what every change here does — the rebase first, the
generators, `node tools/validate.mjs`, the browser under `npx wrangler pages
dev .`, the README paragraph, the `leave-it-better.md` pass, one push, the PR
in the repo's voice, **Rebase and merge** — and that is not repeated below.
What is below is what is particular to each.

---

- [x] **1. The rules of the game, and a check that holds them**

**Lands:** `functions/api/_chess.js`, `tools/chessperf.mjs`, one step in
`.github/workflows/validate.yml`, the three places in `CLAUDE.md` and the one
in the `/site` skill that list what CI runs, a paragraph under **What the
validator checks** in `README.md` and the two files under **Files**. Nothing a
visitor can see.

**Why first:** everything else stands on it, and it is the one piece that can
be wrong in ways nobody notices for a month. It gets a check of its own before
it gets a caller.

**Do:**

1. Write `functions/api/_chess.js` — modern ESM, no import but nothing, a
   header block in the repo's voice saying what it is and why the browser runs
   none of it. Export:
   - `START`, the opening position as a FEN string.
   - `legalMoves(fen)` → an array of UCI strings, `e2e4`, `e1g1` for castling,
     `e7e8q` for a promotion, for the side to move. Empty when there are none.
   - `play(fen, uci)` → `{ fen, san, check, over }` or `null` for a move that
     is not legal. `san` is standard algebraic with disambiguation, `x`, `=Q`,
     `O-O`, `O-O-O`, `+` and `#`. `over` is `null` or `{ result, reason }` with
     `result` `1-0`, `0-1` or `1/2-1/2` and `reason` `mate`, `stalemate`,
     `fifty` (the FEN's halfmove clock at 100) or `material` (K v K, K+B v K,
     K+N v K, K+B v K+B on one colour).
   - `repetition(fens)` → true when the last position in the list has occurred
     three times, positions compared on the first four FEN fields.
   - `perft(fen, depth)` → the node count.
2. Write `tools/chessperf.mjs`: with `--check`, run `perft` on the six
   published positions and fail on any count that differs; without it, print
   the counts and the time each took. It imports from the module it checks.
   The counts:

   | position | FEN | depth → nodes |
   |---|---|---|
   | start | `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1` | 1 → 20, 2 → 400, 3 → 8902, 4 → 197281 |
   | Kiwipete | `r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1` | 1 → 48, 2 → 2039, 3 → 97862 |
   | 3 | `8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1` | 1 → 14, 2 → 191, 3 → 2812, 4 → 43238, 5 → 674624 |
   | 4 | `r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1` | 1 → 6, 2 → 264, 3 → 9467, 4 → 422333 |
   | 5 | `rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8` | 1 → 44, 2 → 1486, 3 → 62379 |
   | 6 | `r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10` | 1 → 46, 2 → 2079, 3 → 89890 |

   Keep the whole check under about five seconds on the CI runner; drop the
   deepest row of a position if it is not. It came to half a second, so
   positions 3 and 4 kept one row deeper than this table first asked for.

   A count cannot see how a move is written or when a game ends, so the check
   landed with more than counts in it: the cases worked out by hand that the
   module's header lists, two games from the start, and the refusals — every
   square to every other from the six positions, and strings and FENs that are
   not moves or positions. The tool's header says what each is for.
3. Add the step to `.github/workflows/validate.yml` beside `qrperf --check`,
   and update every place in `CLAUDE.md` and the skills that lists what CI
   runs, and the paragraph in `README.md` under **What the validator checks**
   that says what is held to what.

**Done when:** `node tools/chessperf.mjs --check` passes and is run by CI;
`play()` refuses every illegal move the check's positions contain; a hand
check of castling through check, en passant, promotion with capture,
stalemate and the fifty-move rule is written into the header as the cases
tried.

**The PR says:** what the module exports, the counts and the seconds, and that
nothing visible changed.

**By hand after:** nothing.

---

- [x] **2. The tables and the route**

**Lands:** two tables in `db/schema.sql`, `functions/api/chess.js`, the route's
row in the `/api` skill's table, the tables under **The tables** in the README
section this task starts (a stub: the heading, a paragraph, the tables — task 4
writes the rest), the
count of Functions in the opening sentence of `CLAUDE.md`, which the route
takes to thirty-one — it said twenty-nine, and `api/admin/flows.js` had landed
without moving it — the way to drive the house under **Where it goes wrong** in
`SKILL.md`, and the first paragraph of the header of
`functions/api/_chess.js`, which says its caller does not exist yet. Nothing a
visitor can see: the page does not exist yet.

**Do:**

1. `db/schema.sql`: `chess_games` and `chess_moves` as `SKILL.md` gives them,
   every statement `IF NOT EXISTS`, an index on `(kind, state, created_at)` and
   one on `(challenger, created_at)`, and a comment block in the file's voice.
2. `functions/api/chess.js`: the `GET` and every `POST` action in the table in
   `SKILL.md`, with these particulars:
   - `you` comes from `adminUser()` then `sessionUser()`; `client` is required
     of a visitor's move and must be a v4 UUID, refused `400 client` exactly as
     `saves.js` refuses it.
   - a move: load the game, refuse unless `state = 'playing'` and the reader is
     the side to move, replay the game's moves from `START` through `play()` to
     rebuild the position list, then `play()` the move itself — it answers null
     for anything that is not exactly one of `legalMoves()`, and that null is
     the `400 illegal`. Take `over` from its answer or, failing that, from
     `repetition()` over the rebuilt list with the new position on the end, as
     reason `repetition`. Then one `batch()`: insert the move row, update the
     game `WHERE id = ? AND ply = ?`, and read `meta.changes` — the insert's
     primary key refusing is the 409. Both functions throw on a FEN they cannot
     read, and the route only ever hands them `START` and what `play()` gave
     back, so a throw there is a bug and is left to be a 500. The `check` a GET
     answers is the last move's, which its SAN already says with `+` or `#`.
   - a public game's `n` is one past the last; `house_colour` is `b` when `n`
     is odd. `new` refuses while a public game is playing.
   - `join`: one waiting-or-playing private game per `challenger`; 50 in line
     at most, `429 full` past it. `leave` deletes the member's own waiting row.
   - `start`: only the oldest waiting game, only while no private game is
     playing. `resign`: the loser is whoever resigned. `abandon`: the house, on
     the member's turn, `last_at` more than seven days ago; `result` is
     `abandoned` and counts for nobody.
   - `record`: over both kinds, `state = 'over'` and `result != 'abandoned'`.
   - the words: `?lang=` through `wordsFor()`, all ten languages, exactly as
     `functions/api/flashcard.js` does it, and `langs` beside them; neither
     when `lang=` is absent.
   - **every read survives the tables' absence**: `ready: false`, `public` and
     `mine` null, `queue` empty, and every POST `503 no-database`.
   - `json()` from `_lib.js` for every answer; `no-store` throughout.
3. The house, locally: under `npx wrangler pages dev .`, sign up an account
   through `POST /api/account` — `house-preview` — read its `users.id` out of
   the local database, and restart the server with `--binding ADMINS=<id>`.
   This step first said to write that id into `ADMINS` in `wrangler.toml`, and
   was wrong: `pages dev` binds D1 **locally** unless told otherwise, so an
   account made under it lives in `.wrangler/` on one machine, and its id means
   nothing in the preview database or in anybody else's checkout. The preview
   database holds no account a session can sign in as, and there are no
   preview deployments to sign in on. So `ADMINS` stays empty in both preview
   blocks, the house is named on the command line, and `SKILL.md` says how.
4. Apply the schema to preview: ask for the two `CREATE TABLE` statements
   through the write gate, or say in the PR that the owner runs `wrangler d1
   execute tallinntastebuds-preview --remote --file=db/schema.sql`. Drive every
   action with `curl` against `127.0.0.1:8788`, signed in as the house and as a
   member and as nobody, and write the sequence into the PR: a game started,
   two moves, a 409 from a repeated ply, a join, a start, a resign.

**Done when:** every row of the actions table answers as written, `node
tools/chessperf.mjs --check` still passes, the route answers `ready: false` on
a database without the tables, and the `/api` skill's table has the row.

**The PR says:** the shape of the answer, what each refusal is, what was driven
with `curl`, and — in so many words — that production needs the schema applied
on landing.

**By hand after:** `wrangler d1 execute tallinntastebuds --remote
--file=db/schema.sql`, immediately on landing.

---

- [x] **3. Share the language switch and the device id**

**Lands:** `assets/language.js` (the switch the flashcards draw, as a global
like `TTBRadio`), `assets/device.js` (the device id `app.js` and `feedback.js`
each mint on their own), both pages moved onto them, the `?v=` stamps, a line
in the `/site` skill under **How the browser code is written**. A refactor:
nothing a visitor can see changes.

**Why now:** the chess page would otherwise carry the third copy of each —
`renderLanguageSwitch()`, `markLangMenu()` and `pickLanguage()`'s document
listeners from `assets/flashcard.js`, and `clientId()` from `assets/app.js`
and `assets/feedback.js` — and **Duplication that already exists, three copies
or more, is a function** in `leave-it-better.md` says the function is written
first. Small on its own, and verified on pages that already exist.

**Do:**

1. `assets/device.js`: `window.TTBDevice = { id: function () {…} }` — the v4
   UUID under `ttb.cid`, minted on first ask, every `localStorage` touch in
   `try/catch`, the comment block from `app.js` carried over. `app.js` and
   `feedback.js` call it; their copies go. Loaded after `track.js` on every
   page that needs it, `index.html` and `feedback.html`.
2. `assets/language.js`: `window.TTBLanguage.mount(node, langs, current,
   onPick)` draws the trigger and the menu out of the flashcards'
   `renderLanguageSwitch()`, sorted by code, with `markLangMenu()`'s
   `is-open`/`lang-open` handling and the two document listeners — Escape and a
   press outside — owned once. `flashcard.js` mounts it and keeps
   `pickLanguage()`, which asks the route for the words. **The map's switch in
   `app.js` stays where it is**: it is bound into the map's state and its
   `.controls` z-index rules, and moving it is a change to the map on its own.
   Say so in the header.
3. Move `.flash-lang` — the surface the switch sits on in a `.lists-brand`
   header — from `assets/flashcard.css` into `assets/lists.css` under a name
   that is not the flashcards', since the chess header wears it next.
4. `node tools/stamp.mjs`, and drive the flashcards page and the map: the
   switch opens, picks, closes on Escape and outside; a save from a signed-out
   map still files under the same `ttb.cid`; feedback still posts under it.

**Done when:** `grep -n 'ttb.cid' assets/*.js` hits one file, the flashcards
switch draws and behaves as before in both styles, and the map's did not
change.

**The PR says:** it is a refactor, what moved, and exactly what was driven to
show nothing changed.

**By hand after:** nothing.

---

- [x] **4. The page, with the public game**

**Lands:** `chess.html`, `assets/chess.js`, `assets/chess.css`, about forty
`chess*` strings in all ten languages, `'chess.html'` in `PAGES` in
`tools/stamp.mjs`, a `chess` page in `PAGES` in `functions/api/_visitors.js`,
`/chess.html` and `/chess` in `_headers` as `/blog`'s are, `/chess` in
`tools/sitemap.mjs` and the re-run `sitemap.xml`, three rows in the README's
**Analytics** table, the README section **Chess** written in full for what
exists so far, its line in **Contents** and its files under **Files**, the
`chess.html` entry in the `/site` skill's stamped-pages list. Live, on the
default branch, and **linked from nowhere** — the blog's arrangement until task
6.

**Do:**

1. `chess.html`: the flashcards page's head and header — `analytics.js`
   first, `color-scheme` and `theme-color`, the three stylesheets plus
   `chess.css`, `.lists-brand` with the home link, the radio button and the
   switch's container — then `<main>` holding the head (eyebrow, title, lead
   in the markup with `data-i18n`) and an empty `lists-stack` the script fills.
   `track.js`, `back.js`, `radio.js`, `language.js`, `device.js`, `chess.js`,
   all deferred in that order.
2. `assets/chess.js`, ES5, one IIFE: the boot block (`applyStyle()`, the
   candidates for `lang=`, one `GET /api/chess`), `t()` over the `ui` block, the
   switch mounted through `TTBLanguage` with `pickLanguage()` asking the route
   again for the words, the radio through `TTBRadio.mount()` once the words are
   in, and the page drawn whole from the answer: the head, then for the public
   game one `.chess-grid` of the board card and the moves card, exactly as
   `mockup.html` draws them and with its class names. The three faces of the
   public game: reader when Everybody is to move (live board), reader when the
   house is (inert), the house (live, turned round) — plus no game yet, the
   route not answering, game over with the button for the house.
   - the board: eight columns of `<button>`s, each with an `aria-label` naming
     the piece and the square out of `chessWhite`/`chessBlack`, the six piece
     names and `chessEmpty`; the pressable ones are those `legal` starts from.
     A press picks, a second press on a dot moves, a press elsewhere unpicks.
     Promotion: the sentence swaps for the four-button `.seg`. No drag.
     **No `touch-action: none`.**
   - a move: `POST move` with `game`, `ply`, `move` and `TTBDevice.id()` for a
     visitor; redraw from the answer; on 409 redraw and toast
     `chessGotThereFirst`; on anything else toast `chessMoveFailed`.
   - the poll: every twenty seconds while `!document.hidden`, at once on
     `visibilitychange` to visible and after a move; `lang=` never on a poll.
   - the moves card: numbered rows, the SAN in mono, the mover under
     Everybody's move (`chessVisitor` for a device, the username otherwise),
     the score line at the foot, and signed out the sentence and the `.alt`
     link to the map.
   - times: `chessJustNow`, `chessMin`/`chessHours`/`chessDays` through
     `chessAgo`.
   - `TTBTrack.event()`: `chess_move` with `{ kind, ply }`, `chess_new_game`,
     `language_select` as the flashcards send it.
3. `assets/chess.css`: what `mockup.html` carries under `<style>`, minus
   `touch-action`, in the repo's comment voice, tokens only, both styles
   checked. The board's squares are `<button>`s now, so reset their chrome.
4. The strings, in all ten languages:

   | key | English |
   |---|---|
   | `chessDocumentTitle` | Chess: your move, Tallinn \| Tallinn Tastebuds |
   | `chessMetaDescription` | One chessboard for the whole city, against Tallinn Tastebuds. Whoever is here plays the next move; the house answers. |
   | `chessSkip` | Skip to the board |
   | `chessEyebrow` | Chess |
   | `chessTitle` | Your move, Tallinn |
   | `chessLead` | One board for everybody who opens this page. Whoever is here plays the next move for the city, and Tallinn Tastebuds answers. No account and no clock: a game takes as long as it takes. |
   | `chessEverybody` | Everybody |
   | `chessGameOf` | {a} against {b} |
   | `chessTurnOf` | {who} to move |
   | `chessTurnEverybodyWhy` | Anyone here can play it — you included. Tap a piece, then where it goes. |
   | `chessTurnHouseWhy` | Waiting for the house. This page looks again on its own — the radio is a good way to wait. |
   | `chessTurnYou` | That’s you. Tap a piece, then where it goes. |
   | `chessTurnCity` | Waiting for the city. |
   | `chessCheck` | Check |
   | `chessMate` | Checkmate |
   | `chessStalemate` | Stalemate |
   | `chessDraw` | Draw |
   | `chessWon` | {who} won. |
   | `chessWonIn` | {who} won, in {n} moves. |
   | `chessDrawRepetition` | The same position three times. |
   | `chessDrawFifty` | Fifty moves without a capture or a pawn move. |
   | `chessDrawMaterial` | Not enough pieces left to mate. |
   | `chessNextHouse` | Tallinn Tastebuds starts the next game. |
   | `chessNextYou` | The next game is yours to start, and the colours swap. |
   | `chessNewGame` | Start the next game |
   | `chessFirstGame` | Start the first game |
   | `chessNoGame` | No game yet |
   | `chessNoGameWhy` | Tallinn Tastebuds sets up the board. Come back in a while. |
   | `chessOffline` | The board is not answering right now. |
   | `chessPromote` | Promote to |
   | `chessKing` `chessQueen` `chessRook` `chessBishop` `chessKnight` `chessPawn` | King, Queen, Rook, Bishop, Knight, Pawn |
   | `chessWhite` `chessBlack` `chessEmpty` | White, Black, empty |
   | `chessSquare` | {colour} {piece} on {square} |
   | `chessLast` | Last move |
   | `chessVisitor` | a visitor |
   | `chessYou` | you |
   | `chessJustNow` | just now |
   | `chessMin` `chessHours` `chessDays` | {n} min, {n} h, {n} d |
   | `chessAgo` | {when} ago |
   | `chessMoves` | Moves |
   | `chessNoMoves` | Nobody has moved yet. The first move is yours. |
   | `chessScore` | Game {n} · Everybody {a} · Tallinn Tastebuds {b} · draws {d} |
   | `chessSignIn` | Your moves would carry your name if you were signed in. |
   | `chessSignInGo` | Sign in on the map |
   | `chessGotThereFirst` | Somebody got there first — here is the board now. |
   | `chessMoveFailed` | That move did not go through. Try again. |

5. The lists, the headers, the sitemap, the analytics rows, the README
   section — what it is, the three faces so far, the board, the route and the
   tables carried in from task 2's stub, what it deliberately does not do —
   and the skill's stamped-pages list.
6. Drive it: as nobody, as a member, as the house on preview; a full game to
   checkmate between two browsers, a promotion, two moves at once for the 409,
   the switch in three languages, the radio, both styles, 390px, a desktop.

**Done when:** every state in `SKILL.md`'s list for the public game draws and
reads in the ten languages; a game can be played to its end and the next one
started; nothing on the site links to the page yet.

**Cut wrong, and corrected while doing it:** the route's answer had neither
of two things the page needs, and this task added them rather than have the
browser run the rules. Each move now carries its `uci`, because the last move's
two squares — the quieter ring — cannot be read off its SAN without knowing the
position; and the answer carries `score`, the public games' own tally, because
`record` counts private games too and the line under the moves is the city's
game. The two are in `SKILL.md`'s shape and the README section. Two of the
strings the table gave read badly with Everybody as the subject in Russian,
Ukrainian, Spanish, Portuguese, Finnish, Estonian and Armenian — "Everybody
won" agrees with nothing there — so `chessWon` and `chessWonIn` say *Winner:
{who}* in those seven.

**The PR says:** what was driven and how, the name of the preview account the
house was driven as, and that an iPhone and an Android should look at the black
pawn.

**By hand after:** nothing.

---

- [x] **5. One on one**

**Lands:** the one-on-one card in `assets/chess.js` and `chess.css`, the
private game on the same board component, the house's record line, about
twenty-five more strings, the README section grown to cover it, the lead
rewritten.

**Do:**

1. The card, `.chess-play`, in the four shapes `mockup.html` draws — signed out
   (`?state=visitor`), a member not in line (`member`), in line (`waiting`),
   the house (`house` and `house-playing`) — eyebrow, title, sentence, the one
   `.go`, the `Waiting now` rows as `.menu` rows each linking to `/u/<name>`,
   the `.alt` where the shape has one. Its place on the page per the faces
   table in `SKILL.md`.
2. The private game: the same `gameGrid` as the public one with the names,
   `Resign` as the `.alt` at the foot of the moves for whoever may resign, the
   house's `End without a result` only when the route says it may, the result
   and `Join the waiting list` again for the member once it is over.
3. The house's line under the lead out of `record`.
4. `join`, `leave`, `start`, `resign`, `abandon` sent and redrawn from the
   answer, each with its `TTBTrack.event()`: `chess_join`, `chess_leave`,
   `chess_start`, `chess_resign`, `chess_abandon`, and the rows in the
   README's **Analytics** table.
5. The strings, in all ten languages, and `chessLead` rewritten:

   | key | English |
   |---|---|
   | `chessLead` | One board for everybody who opens this page, and a waiting list to play the house yourself. Whoever is here plays the next move for the city, and Tallinn Tastebuds answers. No clock: a game takes as long as it takes. |
   | `chessOneOnOne` | One on one |
   | `chessPlayTitle` | Play Tallinn Tastebuds yourself |
   | `chessPlayWhySignedOut` | Sign in on the map and join the waiting list. The house starts your game when your turn comes, and this page says so. |
   | `chessPlayWhy` | Join the waiting list and the house starts your game when your turn comes. This page will say when it has. |
   | `chessJoin` | Join the waiting list |
   | `chessInLine` | You’re in line |
   | `chessAhead` | {n} ahead of you: {names}. The house starts your game when your turn comes, and this page will say so. |
   | `chessAheadNone` | You’re next. The house starts your game when it gets to the board, and this page will say so. |
   | `chessLeave` | Leave the list |
   | `chessWaitingNow` | Waiting now |
   | `chessNobodyWaiting` | Nobody is waiting right now. |
   | `chessSince` | since {when} |
   | `chessPlayingYou` | playing you now |
   | `chessTurnYours` | Your move |
   | `chessTurnYoursWhy` | Tap a piece, then where it goes. |
   | `chessResign` | Resign |
   | `chessResignSure` | Resign this game? |
   | `chessAbandon` | End without a result |
   | `chessAbandonWhy` | {name} has not moved for {n} days. |
   | `chessResigned` | {who} resigned. |
   | `chessAbandoned` | Ended without a result. |
   | `chessAgain` | Join the list again whenever you like. |
   | `chessStarted` | Started {when} ago |
   | `chessStartWith` | Start a game with {name} |
   | `chessWaitingToPlayYou` | Waiting to play you |
   | `chessQueueFree` | One game at a time. Start the first in line, and the next one when that game ends. |
   | `chessQueueBusy` | {name} is playing you now. The next game starts when this one ends. |
   | `chessRecord` | You are the house · {games} played · {won} won · {lost} lost · {drawn} drawn |
   | `chessAlready` | You’re already in line. |
   | `chessFull` | The line is full right now. Try again tomorrow. |

6. Drive it with three browsers on preview — nobody, a member, the house: join,
   leave, join again, start, a game to a resignation, the record line moving,
   the 429 with the cap lowered locally and put back.

   **What doing it found**, corrected here and in `SKILL.md` in the same pull
   request. The house's *Start* button needs the first waiting game's id and
   the queue carried none, so the route hands the house each waiting game's
   `game`. *End without a result* "only when the route says it may" needed the
   route to say it, so a private game carries `abandon: true` for the house
   while it would be taken. The faces table gave a member whose game is on the
   one-on-one card as a third row and the mockup did not; the page follows the
   mockup. `chessRecord` read "1 games" on the first game and says `{games}
   played` in English now. And `assets/chess.css` had carried a stray piece of
   `mockup.html`'s head since task 4, which threw away the `:root` rule and
   with it `--pieces`; the pieces fell back to the body face until this.

**Done when:** every one-on-one state in `SKILL.md` draws in ten languages,
the queue moves, and a member's page says their game started without a reload.

**The PR says:** what was driven with which three accounts.

**By hand after:** nothing.

---

- [x] **5½. Taking a move back** — asked for by the owner after task 5 landed,
  and landed on its own between 5 and 6. Whoever made a move may take it back
  for ten seconds, while it is still the last move; a move that ended the game
  is final. `undo` in `functions/api/chess.js`, the countdown in
  `assets/chess.js`, `chessUndo` and `chessUndoLate` in ten languages,
  `chess_undo` in **Analytics**, **Taking a move back** in the README, the row
  and the state in `SKILL.md`. Task 6's flow gains the step.

- [x] **5¾. Notes for the next player** — asked for by the owner after 5½,
  described before it was built and agreed as written, and landed on its own
  before 6. A card under the public game's moves where anybody leaves a line
  for whoever moves next, with or without their name; the author deletes
  their own, the house hides any. `chess_notes` in `db/schema.sql`, applied by
  hand to production; `note`, `unnote` and `hide` in `functions/api/chess.js`
  and `notes` on the public game's answer; the card in `assets/chess.js` and
  `assets/chess.css`; thirteen `chessNote*` strings in ten languages;
  `chess_note`, `chess_note_delete` and `chess_note_hide` in **Analytics**;
  **Notes for the next player** in the README; the row, the state and the
  table in `SKILL.md`. Task 6's flow gains the step — leave a note — in the
  visitor's and the member's lanes.

- [x] **5⅞. Member against member** — asked for by the owner after 5¾,
  described before it was built; the owner dropped the first draft's rule
  that both players be in Tallinn, and the rest was built as described.
  A card at the foot of the page where a member finds another by username,
  challenges them, and plays the game they accept on the same board.
  `opponent` on `chess_games` in `db/schema.sql`, an `ALTER` applied by hand
  to production; `?find=`, `challenge`, `accept`, `decline`, `cancel` and
  `claim` in `functions/api/chess.js`, and `duels` and `duel` on the answer;
  `duelsCard()` in `assets/chess.js` and its rules in `assets/chess.css`;
  twenty-eight strings in ten languages and `chessLead` extended; six events
  in **Analytics**; **Member against member** in the README; the section,
  the rows and the faces in `SKILL.md`. Task 6's flow gains a lane's worth
  of steps in the member's — find, challenge, accept, play, claim.

- [x] **5¹⁵⁄₁₆. Giving up, and agreeing a draw** — asked for by the owner
  after 5⅞, described before it was built; the owner answered the three
  questions the shape asked — two of the city in total, the next public game
  starting on its own, visitors counting — and it was built as described.
  Under every game's moves, *Resign* and *Offer a draw* behind the browser's
  confirm box; on the public game Everybody's *Give up this game* and *Offer
  a draw* are asks that need two names, with *Agree* and *Take it back*, and
  the house answers a complete offer with *Accept* or *Decline*. `chess_asks`
  in `db/schema.sql`, applied by hand to production; `ask`, `unask` and
  `refuse` in `functions/api/chess.js` in place of `resign`, `standing()`
  working the rows out on every read, `asks`, `declined`, `mayAsk` and
  `mayRefuse` on a game's answer, and `startPublic()` after a public game
  ends this way; `asksNode()` in `assets/chess.js` and `.chess-ask` in
  `assets/chess.css`; thirteen strings in ten languages; `chess_ask`,
  `chess_unask` and `chess_refuse` in **Analytics** in place of
  `chess_resign`; **Giving up, and agreeing a draw** in the README; the
  shape, the state, the rows and the table in `SKILL.md`. Task 6's flow
  gains the steps — resign, offer a draw, agree, accept or decline — in all
  three lanes.

---

- [ ] **6. The door, and the diagram**

**Held, on the owner's instruction.** The door went up for a day — a knight
pill on the rail for anybody signed in and a *Play chess* row behind More on
the short rail, then the row alone — and the owner took it down: the page
stays at `/chess`, linked from nowhere, until they say otherwise. Nothing of
that door is left in the code. Since then the owner asked for a hidden way
in — *Surprise me* held for five seconds, `holdForChess()` in `assets/app.js`
— which is not this task and does not tick it. The brief below is still what a door would
be, and the diagram and the `CLAUDE.md` lines are still owed whenever it
comes back.

**Lands:** `#btn-chess` on the rail in `index.html` under `#btn-flash`, a row
behind More, `chess` in `RAIL_PRESS` in `assets/app.js` and in `RAIL_PILLS` in
`functions/api/stats.js`, the short rail's stylesheet rule hiding the new pill
with the others it hides, `chessDoor` and `chessDoorWhy`, the `chess_open_rail`
event and its row in **Analytics**, the chess flow in `data/flows.json` with
its `ref`s and the re-run `flows/chess.bpmn`, the seventh row in the README's
**Who uses the site, drawn** table, the door in the README's **Chess** and the
five-doors count under **The short rail**, the opening sentence of `CLAUDE.md`
and its process table, the `/api` skill's `/*` row if the page gained a route
(it did not), the stamps.

**Do:**

1. The pill: an `<a class="rail-btn" id="btn-chess" href="/chess"
   data-track="chess_open_rail">` in the rail's own line style — a knight, or a
   pawn, drawn in a `<svg>` like `#btn-flash`'s two cards — with the two
   strings, never hidden, for the reason the flashcards door is never hidden.
   The More sheet's row after Learn Estonian, counted under the pill's id.
2. The strings: `chessDoor` *Play chess*, `chessDoorWhy` *One board for the
   whole city, against Tallinn Tastebuds.*, all ten languages.
3. The flow: the `chess` flow drawn in the session that shaped this — four
   lanes, visitor, member, the house, the site; `mockup-flow.json` beside this
   file is the source to paste in, with a `ref` added to every step naming
   the files that now exist. `node tools/flows.mjs`, commit the `.bpmn`.
4. The README and `CLAUDE.md` lines above; then `node tools/stamp.mjs`.
5. Drive the map on both rails — `?layout=a` and `?layout=b` — and both styles:
   the pill, the row, the count arriving on `/admin/stats` under `chess`.

**Done when:** the page is reachable from the rail on both layouts, counted,
drawn on `/admin/flows`, and every document that lists the site's parts lists
it.

**The PR says:** that the feature is now live and linked, and what the first
week should be watched for on `/admin/stats` and `/admin/visitors`.

**By hand after:** nothing. Then open `/chess` as the house and press *Start
the first game*.

---

## Later, and not tasks yet

Each is a description away from being built, and none is in the six above on
purpose: a line on `/account.html` when your game has started; several private
games at once; a clock; captured pieces beside the board; a download of a
finished game as PGN; a drawn set of pieces, with its licence row; the map's
language switch moved onto `assets/language.js`.
