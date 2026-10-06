---
name: chess
description: Build the chess page, one task at a time — the next unchecked task in TASKS.md beside this file. Use when asked to do the next chess task, to continue or finish the chess feature, or for anything about /chess, chess_games, chess_moves, assets/chess.js or functions/api/chess.js.
---

# Chess, against the house

A page at `/chess` where the whole city plays one game of chess against the
owner's account, and where a member can also queue up to play the owner one on
one. It was described, drawn and agreed before a line of it was written —
**Something new is described before it is built** in `CLAUDE.md` — and this
file is the agreed shape. `TASKS.md` beside it is the build, cut into tasks
that land one at a time, each a pull request that leaves the site whole.
`mockup.html` beside it is the picture: the page in every state, drawn with the
site's own stylesheets, and it is what the code is held to.

**A session that was asked to "do the next chess task" does this:** read this
file top to bottom, then `TASKS.md`, take the first task whose box is not
ticked, do only that one, tick its box in the same pull request, land it, and
say where it stands. One task per pull request. The next task is the next
session's.

## What it is, decided

Two kinds of game, three kinds of person, one page. The house is the owner's
account — `ADMINS` in `wrangler.toml`, `adminUser()` in `functions/api/_admin.js`
— and it plays from the same page as everybody else, which shows it a different
face.

**The public game: Everybody against Tallinn Tastebuds.** One board, always on
the page. Whoever is there when it is Everybody's turn may play the next move —
signed in or not; a stranger's move is filed under the device id the way a save
is and reads *a visitor* in the move list, a member's carries their username.
The house answers when it gets to the board. The same person may play two of
Everybody's moves in a row; the list shows who played what, so a hog is visible,
and a rule against it would stall a quiet evening. No clock. Everybody opens the
first game as white and the colours swap every game. When a game ends, the house
starts the next one with the page's one filled button; until then the result
stays on the board.

**One on one.** A member presses *Join the waiting list* and takes a place in a
public queue — the names are the usernames, which already have pages under
`/u/` — one place per account, oldest first, and they may leave it any time
before their game starts. The house starts a game with the first in line, one
private game at a time; the next starts when that one ends. The challenger opens
as white. Either side may resign; the house may also end a game without a result
once the member has not moved for seven days. The member's page says when their
game has started, on its next ask. Nothing else does: the site has no address
for anybody.

**The three faces**, top to bottom on the page:

| | Visitor | Member | The house |
|---|---|---|---|
| under the title | — | — | a mono line: games, won, lost, drawn |
| first card | the public game | their own game, if one is on; else the one-on-one card | the queue: *Waiting to play you*, the *Start a game with …* button while no private game is on |
| then | *Play Tallinn Tastebuds yourself*: sign in on the map and join; who is waiting | the public game | the private game, if one is on |
| then | — | — | the public game |
| last | *Member against member*: sign in on the map | *Member against member*, or the duel they have open | the same as a member |

A member whose game is on, or over, sees their board, then the line alone —
*Waiting now*, nothing about the house in it, and no card at all with nobody
waiting — then the public game: the *Join the waiting list* a finished game
needs is under that game's result. The mockup drew them no card; the owner
asked afterwards that everybody see who is waiting, so the line came back.

**The line is where members find each other.** On every face but the house's,
a member reading the line has *Challenge* at the end of every other member's
row — the duels' own challenge, `challengeEnd()` in `assets/chess.js`, shared
with the search — under `chessQueueDuel`, so people waiting can play each
other rather than only wait for the house. Asked for by the owner, with the
way in below, after the six tasks were cut.

**The way in, for whoever knows it**: *Surprise me* on the map held for five
seconds goes to `/chess` — `holdForChess()` in `assets/app.js`, the
`chess_open_hold` event, with a ring that fills round the die while it is
held. It is not the door task 6 describes, which stays held; nothing on
screen says it is there until somebody holds it.

**Member against member**, added at the owner's asking after the notes and
never in the mockup: a card at the foot of every face. A member finds another
by the start of their username (`?find=`), challenges them and plays white;
the one challenged accepts or declines, the one who sent it may cancel, and a
challenge nobody answers lapses after seven days. Every duel being played and
every one that ended in the last seven days is a row that opens it on the same
board component in the card's place, *Back to your games* above it. Either
player resigns; either may claim a duel the other has left for seven days, a
win, where the house would abandon a private game; Rematch is a new challenge.
One between two people at a time, five going for one member. No notice
anywhere but this page. The first draft asked for both players to be in
Tallinn with location on; the owner dropped it. **Member against member** in
`README.md`.

Every board is the same component: an eyebrow naming the two sides, a mono line
saying whose move it is, a sentence saying what that means for whoever is
reading, the board, and under it the last move, who played it and when. Beside
it — under it on a phone — the moves card: numbered pairs, the mover's name
under Everybody's moves, the score line at the foot, the list scrolling
inside the card and open at the newest move — the card is the board's height
on a desktop, and shows about six pairs on a phone. The board is turned round
so the reader's side is at the bottom. A pressable board rings the picked
piece's square in the accent and dots the squares it may go to, a ring round a
piece it would take; the two squares of the last move wear a quieter ring; a
king in check wears the accent. A pawn reaching the last rank swaps the sentence
for four choices in the segmented control the language switch is.

**Every state**, in words, so none is built only in its happy state:

- Everybody to move, read by a visitor or member: *Everybody to move* and *Anyone
  here can play it — you included. Tap a piece, then where it goes.* Read by the
  house: the board inert, *Waiting for the city.*
- Tallinn Tastebuds to move, read by a visitor or member: inert, *Waiting for
  the house. This page looks again on its own — the radio is a good way to
  wait.* Read by the house: the board live and turned round, *That’s you.*
- Somebody moved first: the server answers 409, the page redraws from the
  answer and toasts *Somebody got there first — here is the board now.*
- Your own move, for ten seconds: *Undo (9)* under the last move, counting
  down, in the tab that moved and nowhere else; pressed, the move goes and it is
  your turn again; too late, *Too late to undo — here is the board now.* A move
  that ended the game never offers it. Added after the six tasks were cut, at
  the owner's asking, between tasks 5 and 6.
- A move arriving, anybody's: the piece glides from its square to the new one
  in 700 ms, a castling rook with it, and an undone move glides home. Not on
  the first draw, a language switch or a poll several moves on, and not with
  reduced motion. Added at the owner's asking after 5¾ — **A move is seen to
  happen** in `README.md`.
- Check on the line; Checkmate, Stalemate or Draw with its reason when it ends,
  then *Tallinn Tastebuds starts the next game.* for readers and the button for
  the house.
- No game yet: *No game yet* and *Tallinn Tastebuds sets up the board.* The
  house sees *Start the first game*.
- The route not answering: the head and the cards draw with *The board is not
  answering right now.* where a board would be. Nothing on the page waits on
  the route.
- Signed out: the same page, and under the public game the one-on-one card
  reads *Sign in on the map and join the waiting list*; under the moves, the
  line that says a name would go on your moves.
- In line: *You’re in line*, how many are ahead and who, the row marked *you*,
  *Leave the list*. Your game started: your board first. Over: the result, the
  reason, *Join the waiting list* again.
- Loading: the head from the markup, the cards empty until the one answer is in
  — no spinner, like every page here.
- Notes for the next player, under the public game's moves — under its board
  on a desktop: *No notes yet —
  leave one for whoever moves next.*, or the notes oldest first, each with
  who, when and *after 14. Nf3*; under them the field, *Post as* your name or
  *Anonymously* for a member and the line saying a visitor posts as *a
  visitor*; *Delete* under your own, *Hide* under anybody's for the house;
  once the game is over, the notes and *This game is over.* where the field
  was; past five in an hour, *That's a lot of notes*. Added at the owner's
  asking between 5½ and 6 — **Notes for the next player** in `README.md`.
- The language switch and the radio are the flashcards page's, in the same
  header, and the station follows the language. This is the map's origin, so
  the radio walks over from the map already playing.

**The words.** All of them in `data/ui.json`, all ten languages, keyed
`chess*`; `TASKS.md` lists every string with its English under the task that
adds it. The house is named by `wordmark`, which already exists. The page
fetches nothing but its one route: the words ride in the answer through
`wordsFor()` in `functions/api/_lib.js`, the way the flashcards' do, and
`langs` carries all ten codes for the switch.

**The pieces** are the platform's own chess glyphs, U+2654 to U+265F, each
followed by U+FE0E so the black pawn stays a piece rather than an emoji, in a
`--pieces` face of their own for the reason `--emoji` is one. Nothing to
licence, and both styles colour them out of `--ink`. On the dark style the
filled glyph reads as the light side; the words always say who is who. A drawn
set is a later change and a licence row.

## The route

`GET /api/chess?lang=<candidates>` answers everything the page draws, once,
`no-store` because `you` is per person:

```
{ ready, lang, ui, langs,             ui and langs only when asked with lang=,
                                      never on the twenty-second poll
  you: { role: 'house'|'member'|'visitor', name },
  score: { everybody, house, drawn },           the public games' own tally,
                                                for the line under the moves
  record: { games, won, lost, drawn },          the house's, over both kinds
  public: { game, moves, legal, notes } | null, null before the first game;
                                                notes null where chess_notes
                                                is not applied
  mine:   { game, moves, legal, abandon } | null,   the member's latest
                                                private game; for the house,
                                                the one being played
  queue:  [ { name, since, game } ],             waiting, oldest first; `game`,
                                                the waiting game's id, for the
                                                house alone — its Start button
                                                sends it
  duels:  [ { id, kind, state, white, black, turn, yours, result, reason,
              createdAt, lastAt } ] | null,     the reader's challenges either
                                                way, games playing and games
                                                over in the last seven days;
                                                [] for a visitor, null where
                                                chess_games has no `opponent`
  duel:   { game, moves, legal, claim } | null }  the duel open on the page,
                                                asked for as `duel=` on a read
                                                and `duel` in a write's body

`GET /api/chess?find=<start of a username>` answers `{ players: [ name … ] }`,
ten at most, the reader left out, nothing under two letters; `401 signed-out`
for a visitor.

game:  { id, kind: 'public'|'private'|'duel', state: 'waiting'|'playing'|'over',
         n, white, black, turn: 'w'|'b', fen, ply, check, result, reason,
         createdAt, startedAt, finishedAt, lastAt }
         white and black are 'everybody', 'house' or a username
moves: [ { ply, san, uci, by, at } ]  by is 'house', 'visitor' or a username;
                                     uci is what draws the last move's ring
legal: [ 'e2e4', 'e7e8q', … ]        only when the reader may move now
notes: [ { id, ply, name, text, at, mine } ]   the newest fifty, oldest
                                     first; name null when anonymous, 'house'
                                     for the house's; mine off the session, or
                                     off `client=` on the query for a visitor
abandon: true                        only for the house, only while it may end
                                     the game without a result — the page
                                     offers the button off this, so the seven
                                     days live in the route alone
claim: true                          only for a player in a duel, only while
                                     the other has left their move seven days
```

`POST /api/chess` takes `{ action, … , client }` and answers the same shape
without the words, or an error:

| action | who | what | refusals |
|---|---|---|---|
| `move` `{ game, ply, move }` — `ply` the game's `ply` as the page read it, the move filed at one past it | whoever's turn it is: anyone but the house on Everybody's, the challenger or the house on theirs, the player whose colour it is in a duel | checks the move against the rules, files it, ends the game if it is over | `409 moved` (that ply is played), `403 not-yours`, `400 illegal`, `404 no-game`, `400 client` (a visitor with no uuid) |
| `new` | the house | the next public game, colours swapped, once the current one is over | `409 playing`, `403 not-yours` |
| `join` | a member | a place in line | `409 already` (in line or playing), `429 full` past 50, `401 signed-out`, `403 not-yours` for the house |
| `leave` | a member | out of the line | `404 not-in-line` |
| `start` `{ game }` | the house | the first waiting game becomes live | `409 busy` (one at a time), `409 not-first`, `404 no-game`, `403 not-yours` |
| `resign` `{ game }` | the challenger, or the house on the private game; either player in a duel | the other side wins | `404 no-game` |
| `abandon` `{ game }` | the house | over with no result, only on the member's turn after seven quiet days | `409 not-yet`, `404 no-game`, `403 not-yours` |
| `undo` `{ game, ply }` — `ply` the move's own, the game's ply as the page read it | whoever the last move was filed under: the house, the member, or the one device that played it for Everybody | deletes the move and steps the game back to the position before it, within ten seconds of it being filed (three more of grace), while the game is still playing — a move that ended it is final | `409 too-late` (answered, over, or past the time), `403 not-yours`, `400 client`, `404 no-game` |

| `note` `{ game, text, as }` — `as: 'name'` puts a member's name on it | anybody, on the public game while it is playing | files the note, at the game's ply | `409 over`, `429 often` past five an hour from one network, `400 empty`, `400 client`, `503 no-salt` |
| `unnote` `{ id }` | whoever the note is filed under | deletes it | `404 no-note` (not yours, or gone), `400 client` |
| `hide` `{ id }` | the house | takes any note off the page, keeping the row | `404 no-note`, `403 not-yours` |
| `challenge` `{ name }` | a member, the house included | a duel waiting to be accepted, the challenger on white | `404 no-player`, `400 self`, `409 already` (a challenge or game standing between the two, either way), `429 full` past five of the challenger's own, `401 signed-out` |
| `accept` `{ game }` | the one challenged | the duel starts, and is open in the answer | `404 no-game` (not theirs, gone, or lapsed), `429 full` past five being played |
| `decline`, `cancel` `{ game }` | the one challenged, the one who challenged | the challenge is deleted | `404 no-game` |
| `claim` `{ game }` | a player in a duel | a win, on the other's move after seven quiet days | `409 not-yet`, `404 no-game` |

The move's primary key is the lock: `chess_moves (game, ply)` — the batch
inserts the move row first and updates the game `WHERE ply = ?` second, so two
people moving at once produce one move and one 409. Every refusal is a JSON
`{ error }` — a 409 carries the whole answer beside it, so the page redraws
from it — in the shape every route here answers in; `503 no-database` and
`ready: false` where the tables are not applied, and the page then draws the
not-answering line rather than a key.

## The tables

Two, in `db/schema.sql`, applied by hand to production on landing (preview is
set aside, **Production only, for now** in `CLAUDE.md`) — **The rules of a write** in the `/api` skill:

```sql
chess_games  id TEXT PRIMARY KEY, kind, state, n INTEGER, challenger TEXT,
             house_colour TEXT, fen TEXT, ply INTEGER, result TEXT, reason TEXT,
             created_at, started_at, finished_at, last_at INTEGER
chess_moves  game TEXT, ply INTEGER, san TEXT, uci TEXT, by_kind TEXT,
             by_id TEXT, at INTEGER, PRIMARY KEY (game, ply)
```

And a third, added with the notes, applied after the other two and read on its
own — without it the public game answers `notes: null` and the page draws no
card:

```sql
chess_notes  id TEXT PRIMARY KEY, game TEXT, ply INTEGER, owner_kind TEXT,
             owner TEXT, named INTEGER, text TEXT, ip_hash TEXT, at INTEGER,
             hidden INTEGER
```

And a column, added with the duels by an `ALTER` and asked after on its own —
without it the answer carries `duels: null` and the page draws no card:

```sql
chess_games  … opponent TEXT       the one a duel challenged, on black
```

The queue is `chess_games WHERE kind = 'private' AND state = 'waiting' ORDER BY
created_at` — no third table, and the challenges are the duels waiting the
same way. A mover's name is joined from `users` at read
time, so a rename carries. Nothing on `users` changes.

## The rules of the game

`functions/api/_chess.js`, modern ESM, no dependency: FEN in and out, every
legal move for the side to move, castling, en passant, promotion, SAN with
disambiguation and `+`/`#`, and the ends — checkmate, stalemate, insufficient
material, the fifty-move rule off the FEN's halfmove clock, and threefold
repetition off the list of positions the route replays from the start of the
game. `perft()` beside them, and `node tools/chessperf.mjs --check` holds the
generator to the published node counts of six positions on every push, the
way `qrperf --check` holds the QR encoder — and the rest of the rules, SAN and
the FEN the tables keep and the ends of a game, to positions worked out by hand
and checked against python-chess, and `play()` to refusing whatever is not
legal. The module's header says what was tried. The browser runs none of it:
the page draws the legal moves the answer carries.

## How a task is done

1. `git fetch origin claude/tallinn-tastebuds-map-nzoqx0 && git rebase
   origin/claude/tallinn-tastebuds-map-nzoqx0`, and read `CLAUDE.md`, the
   `/site` skill and the `/api` skill — every task here touches both.
2. Read `TASKS.md` and take the first task whose box is `- [ ]`. Read its
   whole entry, then the README sections and the files it names. Look at
   `mockup.html` for the states it builds: `python3 -m http.server 8000` from
   the repo root and open `/.claude/skills/chess/mockup.html?state=…&style=…`,
   or draw it with `shoot.mjs` beside it, which drives headless Chromium over
   its own protocol with nothing to install.
3. Do that task and only that task. If doing it shows the task was cut wrong —
   a step missing, a decision this file got wrong — change `TASKS.md` and this
   file in the same pull request and say so in its body. Do not start the next
   task in the same PR, even when it is small.
4. Every string in all ten languages before the validator will pass it. The
   generators the task names, then `node tools/validate.mjs`, `node
   tools/functions-check.mjs`, `node tools/qrperf.mjs --check`, `node
   tools/chessperf.mjs --check`, `node .claude/hooks/d1-write-gate.mjs
   --check`.
5. Drive it under `npx wrangler pages dev .` against the preview database, in
   both styles, at 390px and on a desktop, in the states the task lists. The
   house's side needs a signed-in account `ADMINS` names, and locally that is
   one made under `pages dev` and named with `--binding` — **The house, and
   driving without a token** below. Say in the PR exactly what was driven.
6. The README section the task names, the flow where the task says, the
   `leave-it-better.md` pass over every file in the diff, and **tick the task's
   box in `TASKS.md`** — that tick is how the next session knows where to start.
7. Commit in the repo's voice, push once, open the PR against the default
   branch, CI green, **Rebase and merge**, and do by hand whatever the task's
   *By hand after* says, immediately — a route expecting a table production
   does not have fails quietly.
8. Say where it stands in the first line of the closing message, and name the
   next task.

## Where it goes wrong

- **`touch-action: none` on the board.** The mockup carried it; the page must
  not. A phone that cannot scroll over the board is a page that cannot be
  read. Taps only, and the page scrolls as it always did.
- **A key built out of a variable**, `t('chess' + piece)`: the validator's
  scanner cannot see it, so a missing language fails on a phone rather than in
  CI. Name the six piece keys in a table the scanner can read, the way
  `assets/pins.js` does the `pinX` labels.
- **Polling that never stops.** Clear the interval on `visibilitychange` when
  the page is hidden, ask at once when it comes back, and never poll for the
  words — `lang=` is for the first ask and the switch only.
- **A move sent without the ply**, or a page that trusts its own board after
  the answer said 409. The answer is the board; redraw from it every time.
- **A visitor's `client` that is not a v4 UUID** is a 400, the same shape as
  `saves.js` refuses. Reuse the device id every other page files under, and
  mint one only when a move is about to be sent.
- **The house, and driving without a token.** `ADMINS` is empty at the top of
  `wrangler.toml` and in the preview block, and stays so: `pages dev` binds D1
  locally, into `.wrangler/`, so an account made under it has an id that
  exists on one machine and nowhere else, and naming it in a file everybody
  shares would name nobody. Make the house per session instead — sign up
  `house-preview` with `POST /api/account`, read its id out of the local
  database with `wrangler d1 execute tallinntastebuds-preview --local
  --command "SELECT id, username FROM users"`, and start the server again
  with `--binding ADMINS=<id> --binding SAVE_SALT=dev`, the salt because
  account writes fail closed without one. Without that, nobody is the house
  and the page shows the visitor's face to everyone. In a cloud session with
  no `CLOUDFLARE_API_TOKEN`, `pages dev` will not start at all, because the
  `[ai]` binding always runs remotely: copy the tree into the scratchpad,
  delete the two `[ai]` blocks from the copy's `wrangler.toml`, and run it
  there with `--persist-to` pointing at a scratch directory and the schema
  applied with `--local`. Chess never touches the model; the copy is only a
  way past the one binding it does not need. And stop the server by its pid,
  never `pkill -f wrangler`, which matches the shell running it.
- **A list that grows with the game.** The moves card listed every move at
  full height for its first weeks, and a sixty-move game put the next card
  two screens under the board, beside an empty column. Anything that grows
  with play — the moves, the notes — scrolls inside its card, opens at its
  foot, and is put back where it was scrolled to on a redraw:
  `keepScroll()` in `assets/chess.js`, since every poll and every press on a
  square redraws the page.
- **A colour named anywhere.** The board is `--paper` and `--hairline`, the
  rings `--accent` and `--muted`, the pieces `--ink`. Press the swatch and look.
- **The pieces on a real phone.** The glyphs render out of whatever symbol face
  the platform has and the mockup could only be drawn on Linux. Say in the PR
  that an iPhone and an Android should be looked at, and which glyph to check:
  the black pawn.
- **Cutting a task in half and calling it done.** A task's *Done when* is the
  whole of it. A box ticked over a half-built state is the next session
  building on sand.
- **A rule changed in `_chess.js` without a case in `tools/chessperf.mjs`.**
  The perft counts only see which moves are allowed. How a move is written,
  what the FEN says and when a game ends are held by the cases worked out by
  hand, so a change to any of them adds its case in the same pull request —
  with the expected answer checked against another implementation, python-chess
  in a scratch virtualenv and never in the repository, rather than against the
  file it is testing.
