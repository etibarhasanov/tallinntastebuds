/**
 * Tallinn Tastebuds — the chess route: everything /chess draws, and every
 * move made on it.
 *
 * Two kinds of game against the house, which is the owner's account — the one
 * ADMINS in wrangler.toml names, the same test functions/api/_admin.js puts in
 * front of /admin/. A public game is Everybody against Tallinn Tastebuds: one
 * board for whoever opens the page, signed in or not. A private game is one
 * member against the house, and it starts as a place in a public waiting
 * list. A third kind has no house in it: a duel is one member against another,
 * by challenge — **Member against member** under **Chess** in README.md.
 * **Chess** in README.md is the whole of it, and
 * .claude/skills/chess/SKILL.md is the shape that was agreed before any of it
 * was written.
 *
 * MEMBER AGAINST MEMBER
 *
 * A member finds another by username — GET ?find=, members only, a prefix of
 * the name and nothing else about anybody, since a username is already a
 * public address — and challenges them. The challenge is a duel row in state
 * `waiting` with the challenger on white and the one challenged on black, in
 * `opponent`; accepting starts it, declining or cancelling deletes it, and a
 * challenge nobody answered in QUIET_DAYS is read as gone. One challenge or
 * game between two people at a time, and MAX_DUELS going for one member. The
 * game itself is the same board with the same lock, undo and resignation; in
 * place of the house's abandon, either player may claim a game the other has
 * left their move in for QUIET_DAYS, and it is a win. The reader's duels come
 * in the answer as a list, and the one they have open — `duel=` on a read,
 * `duel` in a POST's body — as a whole game with its moves. `opponent`
 * arrives on a deployed table by hand, so it is asked after the way
 * chess_notes is, and without it the answer says `duels: null` and the page
 * draws no card.
 *
 * ONE ANSWER FOR THE WHOLE PAGE
 *
 * GET answers everything the page draws, once: who is reading, the house's
 * record, the public game, the reader's own private game — or, for the house,
 * the one being played — and the queue. Each game comes with its moves, and
 * with `legal`, every move the reader may make now, only when it is their
 * turn: the browser runs none of the rules, it draws the moves it was handed.
 * The public game also carries its notes, below.
 * With `?lang=` the page's words come beside it through wordsFor(), all ten
 * languages, the way /api/flashcard carries its own; the twenty-second poll
 * leaves that off and gets the board alone. Every POST answers the same shape
 * without the words, so the page redraws from what the server now believes
 * rather than from what it sent.
 *
 * `no-store`, all of it: `you` and `legal` are per person, and the board is
 * only worth anything while it is the board now.
 *
 * WHO MAY MOVE
 *
 * The side to move is in the FEN; which side the house plays is
 * house_colour. On the house's turn only the house. On the other side's turn,
 * in a public game anybody but the house — a member filed under their id, a
 * visitor under the device id the browser files its saves under, which has to
 * be a v4 UUID and is refused `400 client` exactly as /api/saves refuses it;
 * in a private game the challenger alone; in a duel the member whose colour
 * it is, the house included when it is one of the two. The house is found by
 * reading the session once and asking adminIds() whether that id is one of
 * the owner's, rather than calling adminUser() and then sessionUser() again
 * for everybody who is not: the same test with one query instead of two.
 *
 * THE MOVE IS THE LOCK
 *
 * A move replays the game's moves from START through play() in ./_chess.js,
 * then plays the new one on the end: null is `400 illegal`, and the end of the
 * game is play()'s `over` or, failing that, repetition() over every position
 * the replay passed through. Then one batch(): the move row, inserted only
 * while the game is still playing at the ply the page read, and the game moved
 * on WHERE ply is still that ply. chess_moves (game, ply) is the primary key,
 * so of two people pressing a move at the same moment one insert lands and the
 * other is refused by the key — and that refusal, or an insert that found the
 * game already moved on, is the `409 moved` the slower of them sees, carrying
 * the board as it now is. Nothing here decides who was first but the table.
 *
 * TAKING A MOVE BACK
 *
 * Whoever made a move may take it back for ten seconds, while it is still the
 * last move and the game is still playing — so a move that ended the game is
 * final, and one the other side has answered is too late. "Whoever" is
 * exactly what the move was filed under: the house, the member's id, or on
 * Everybody's board the one device that played it, never the rest of the
 * city. undo() below; the page shows the button only in the tab that moved.
 *
 * NOTES FOR THE NEXT PLAYER
 *
 * Beside the public game, a card where anybody on the page may leave a line
 * for whoever plays Everybody's next move. A note is filed the way a move is —
 * the house, a member's id, or a visitor's device id — so the one who wrote it
 * is the one who may delete it, and `named` says whether the author wanted
 * their name on it: signed out it never is, signed in it is their choice. The
 * owner itself is never sent to anybody; `mine` is what the page is told.
 * The house may hide any note, which keeps the row, so a hidden note still
 * counts against its author's cap. The cap is feedback's: a hashed network
 * fingerprint under SAVE_SALT, NOTES_PER_HOUR an hour, and without the salt a
 * note fails closed `503 no-salt` the way every capped write here does. Notes
 * belong to one game and are written only while it is playing; the answer
 * carries the latest NOTES_SHOWN, and a new game starts with none. The table
 * arrives by hand after the other two, so its absence answers `notes: null`
 * and the page draws no card, and never takes the board down with it.
 *
 * GIVING UP, AND AGREEING A DRAW
 *
 * Two ways a game ends short of mate, and both are asks filed in chess_asks.
 * A side that is one person — the house, the member, either player in a
 * duel — resigns with one press, which needs no row at all: askFor() ends the
 * game on the spot. A side that is the whole city needs NEED_CITY of it to
 * agree, so Everybody's "give up" and Everybody's draw are rows, one a person,
 * filed under what a move is filed under, and the side has spoken when the
 * second row lands. A draw offer is a draw ask that is complete: one row from
 * a single player, NEED_CITY from Everybody. It stands until the other side
 * answers — with a draw ask of its own, which is the agreement, or with
 * refuseDraw(), which leaves a 'declined' marker so the side refused cannot
 * ask again until the refuser has moved — or until a move declines it the
 * way one does over the board: the other side's move, or, where the other
 * side is Everybody and no one person's move should speak for the city, the
 * game moving two plies on. An ask short of its count lapses the same two
 * plies after it was raised. None of that is kept as state: standing() works
 * it out from the rows and the moves on every read, and the writes delete
 * what it says is dead before they add to the table. A public game that ends
 * this way starts the next one at once, on the owner's instruction — the
 * asking was for a fresh start, and nobody should wait on the house for it.
 * The table arrives by hand after the others, so without it the answer
 * carries no asks and the page draws no offer; a one-person resignation
 * needs no table and keeps working.
 *
 * Both rule functions throw on a FEN they cannot read. The route only ever
 * hands them START and what play() gave back, so a throw is a bug and is left
 * to be a 500 rather than dressed up as a refusal.
 *
 * WITHOUT THE TABLES
 *
 * chess_games and chess_moves arrive by hand, so there is an afternoon when
 * the code is live and they are not. A read then answers `ready: false` with
 * no games and an empty queue, which the page draws as the board not
 * answering; every POST answers `503 no-database`. The same for no database
 * at all and for the wrong one.
 */

import {
  json, sessionUser, wrongDatabase, randomHex, wordsFor, fingerprint, clientIp
} from './_lib.js';
import { adminIds } from './_admin.js';
/* Every write that went through is counted — countUse() in ./_visitors.js. */
import { countUse } from './_visitors.js';
import { START, legalMoves, play, repetition } from './_chess.js';

/* How long a member may leave their move before the house may end the game
   with no result, and how long the queue may be. The page says the first in
   words — chessAbandonWhy — out of the game's lastAt, never out of a copy of
   this number. */
const QUIET_DAYS = 7;
const MAX_QUEUE = 50;

/* How many duels one member may have going — playing, or challenges they
   sent that are still waiting — and how many players a search answers with.
   A challenge somebody else sent does not count against you, so nobody can
   fill another member's five by challenging them. Restated in words as
   chessDuelsFull, which names the number. Finished duels stay in the list for
   QUIET_DAYS, long enough to see how one ended and press Rematch. */
const MAX_DUELS = 5;
const FOUND = 10;

/* How long whoever made a move may take it back. The page counts UNDO_MS
   from the moment its move came back; the route allows a little more, so a
   press in the last second on a slow phone is not refused for the time the
   request spent on the way. */
const UNDO_MS = 10000;
const UNDO_GRACE_MS = 3000;

/* A note is a line or two, not a letter: the length of a list's say, and
   restated as MAX_NOTE in assets/chess.js, which carries the only field that
   writes it — **Notes for the next player** in README.md. Five an hour from one network is
   room for a table of friends arguing about a move and stops a loop; fifty
   is as many as the card shows, the newest. */
const MAX_NOTE = 280;
const NOTES_PER_HOUR = 5;
const NOTES_SHOWN = 50;
const HOUR = 3600000;

/* How many of Everybody have to agree before the city has given a game up or
   asked for a draw — the owner's number, two in total, the one who raised it
   counted. The page prints it out of each ask's `need`, never out of a copy. */
const NEED_CITY = 2;

const DAY = 86400000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
/* A game's id and a note's: sixteen hex characters, minted by randomHex(8). */
const ID = /^[0-9a-f]{16}$/;

/* ------------------------------------------------------------- the tables */

/* Whether the two tables are there. Asked once per request that needs to
   know, and remembered only once the answer is yes: a table applied by hand
   is picked up on the next request instead of five minutes later, and a yes
   cannot turn into a no under a running isolate. */
let tablesSeen = false;

async function ready(env) {
  if (!env.DB || (await wrongDatabase(env))) return false;
  if (tablesSeen) return true;
  try {
    await env.DB.prepare('SELECT 1 FROM chess_games LIMIT 1').all();
    await env.DB.prepare('SELECT 1 FROM chess_moves LIMIT 1').all();
    tablesSeen = true;
  } catch (e) {
    return false;
  }
  return true;
}

/* Whether chess_notes is there, the same way and for the same reason as the
   two tables above — it is applied on its own, after them. */
let notesSeen = false;

async function notesReady(env) {
  if (notesSeen) return true;
  try {
    await env.DB.prepare('SELECT 1 FROM chess_notes LIMIT 1').all();
    notesSeen = true;
  } catch (e) {
    return false;
  }
  return true;
}

/* Whether chess_games has `opponent`, which duels need and which reaches a
   deployed table by an ALTER somebody runs — the same way again. */
let duelsSeen = false;

async function duelsReady(env) {
  if (duelsSeen) return true;
  try {
    await env.DB.prepare('SELECT opponent FROM chess_games LIMIT 1').all();
    duelsSeen = true;
  } catch (e) {
    return false;
  }
  return true;
}

/* Whether chess_asks is there — the fourth table, applied after the other
   three, and asked after the same way. */
let asksSeen = false;

async function asksReady(env) {
  if (asksSeen) return true;
  try {
    await env.DB.prepare('SELECT 1 FROM chess_asks LIMIT 1').all();
    asksSeen = true;
  } catch (e) {
    return false;
  }
  return true;
}

/* Who is reading: the house, a member or a visitor, and their row. `client`
   is the device id the page sent, a visitor's only name here, and `duel` the
   duel they have open — both read off the query on the GET and the body on a
   POST, and '' when they are not the shape they must be. */
async function whoIs(request, env, client, duel) {
  const user = await sessionUser(request, env);
  const device = typeof client === 'string' && UUID.test(client) ? client : '';
  const open = typeof duel === 'string' && ID.test(duel) ? duel : '';
  if (!user) return { role: 'visitor', user: null, client: device, duel: '' };
  const house = adminIds(env).has(String(user.id).toLowerCase());
  return { role: house ? 'house' : 'member', user: user, client: device, duel: open };
}

/* ------------------------------------------------------------ one game */

/* One game and the names of the people in it. Where `opponent` is not on the
   table yet there are no duels to read it for, and asking for it would take
   every game down with it. */
const GAME_SQL =
  'SELECT g.*, u.username AS challenger_name FROM chess_games g ' +
  'LEFT JOIN users u ON u.id = g.challenger ';
const DUEL_SQL =
  'SELECT g.*, u.username AS challenger_name, o.username AS opponent_name FROM chess_games g ' +
  'LEFT JOIN users u ON u.id = g.challenger LEFT JOIN users o ON o.id = g.opponent ';

async function gameSql(env) {
  return (await duelsReady(env)) ? DUEL_SQL : GAME_SQL;
}

function turnOf(fen) {
  return String(fen).split(' ')[1] === 'b' ? 'b' : 'w';
}

/* The two sides' names as the page prints them: 'everybody', 'house', or a
   username — null for an account that has since been deleted, which the page
   reads as a visitor. A duel has no house in it: the challenger plays white
   and the one challenged black, by name, whoever they are. */
function sides(row) {
  if (row.kind === 'duel') return { white: row.challenger_name || null, black: row.opponent_name || null };
  const other = row.kind === 'public' ? 'everybody' : row.challenger_name || null;
  return row.house_colour === 'w'
    ? { white: 'house', black: other }
    : { white: other, black: 'house' };
}

/* The users.id playing the side to move in a duel. */
function duelMover(row) {
  return turnOf(row.fen) === 'w' ? row.challenger : row.opponent;
}

function inDuel(row, who) {
  return row.kind === 'duel' && !!who.user && (who.user.id === row.challenger || who.user.id === row.opponent);
}

/* Whether this reader may play the side to move in this game now. */
function mayMove(row, who) {
  if (row.state !== 'playing') return false;
  if (row.kind === 'duel') return !!who.user && who.user.id === duelMover(row);
  const houseTurn = turnOf(row.fen) === row.house_colour;
  if (who.role === 'house') return houseTurn;
  if (houseTurn) return false;
  if (row.kind === 'public') return true;
  return !!who.user && who.user.id === row.challenger;
}

/* Whether the house may end this game without a result: a private game on
   the member's move, which they have left for QUIET_DAYS. Asked by the answer,
   so the page offers the button only when the route would take it, and by
   abandon() itself. */
function mayAbandon(row) {
  return row.kind === 'private' && row.state === 'playing' &&
    turnOf(row.fen) !== row.house_colour && Date.now() - row.last_at >= QUIET_DAYS * DAY;
}

/* Whether this reader may claim a duel: they are in it, it is the other
   player's move, and the other player has left it for QUIET_DAYS. */
function mayClaim(row, who) {
  return inDuel(row, who) && row.state === 'playing' && duelMover(row) !== who.user.id &&
    Date.now() - row.last_at >= QUIET_DAYS * DAY;
}

/* ------------------------------------------------------------------- asks */

/* Which side this reader plays in this game, or null for somebody who is
   not in it. The house is its colour in its own games and a member in a
   duel; anybody at all is Everybody's side on the public game, a visitor
   included — whether they sent a device id is actorOf()'s question, asked
   when something is about to be filed. */
function sideOf(row, who) {
  if (row.kind === 'duel') {
    if (!who.user) return null;
    return who.user.id === row.challenger ? 'w' : who.user.id === row.opponent ? 'b' : null;
  }
  if (who.role === 'house') return row.house_colour;
  const theirs = other(row.house_colour);
  if (row.kind === 'public') return theirs;
  return who.user && who.user.id === row.challenger ? theirs : null;
}

function other(side) {
  return side === 'w' ? 'b' : 'w';
}

/* How many people a side's ask needs: NEED_CITY for Everybody, one for
   anybody who is one person. */
function need(row, side) {
  return row.kind === 'public' && side !== row.house_colour ? NEED_CITY : 1;
}

/* Whether `side` has moved since the game was at `ply`. The side that
   played a half-move is in its number: white's are the odd ones. */
function movedSince(moves, ply, side) {
  return moves.some((m) => m.ply > ply && (m.ply % 2 ? 'w' : 'b') === side);
}

/* What the rows say is standing on a game now, worked out rather than
   kept: for each side its ask — the kind, the rows on it in the order they
   came, and whether it has the count it needs — and the 'declined' marker
   while the side that refused has not moved since. Everything else in the
   rows is dead and is listed apart, for a write to delete. An ask short of
   its count lapses once the game has moved two plies past its raising; a
   complete one dies with the other side's move, or — where the other side is
   Everybody — two plies on, so that no one person's move declines a draw for
   the whole city. */
function standing(row, rows, moves) {
  const asks = {};
  const live = [];
  for (const side of ['w', 'b']) {
    const own = rows.filter((r) => r.kind !== 'declined' && r.side === side);
    if (!own.length) continue;
    const n = need(row, side);
    const done = own.length >= n;
    if (!done) {
      if (row.ply >= own[0].ply + 2) continue;
    } else {
      const at = own[n - 1].ply;
      const dead = need(row, other(side)) > 1 ? row.ply >= at + 2 : movedSince(moves, at, other(side));
      if (dead) continue;
    }
    asks[side] = { kind: own[0].kind, need: n, done: done, names: own };
    live.push(...own);
  }
  const marker = rows.find((r) => r.kind === 'declined');
  let declined = null;
  if (marker && !movedSince(moves, marker.ply, other(marker.side))) {
    declined = marker;
    live.push(marker);
  }
  return { asks, declined, dead: rows.filter((r) => !live.includes(r)) };
}

async function askRows(env, id) {
  const { results } = await env.DB
    .prepare(
      'SELECT a.*, u.username FROM chess_asks a ' +
      "LEFT JOIN users u ON a.by_kind = 'user' AND u.id = a.by_id " +
      'WHERE a.game = ? ORDER BY a.at'
    )
    .bind(id)
    .all();
  return results || [];
}

/* The asks on a game as the page draws them, for a game being played where
   the table is applied, and nothing at all otherwise: each side's ask with
   who is on it, `declined` while a refusal still stands, and `mayAsk`, what
   this reader may press now — each kind with what the press would be, since
   the page labels Offer a draw, Agree and Accept differently and only the
   route knows which this is — and `mayRefuse` for a single player the other
   side has offered a draw to. Everybody never refuses: the city answers an
   offer by agreeing to it or by playing on. */
async function asksOf(env, row, who, moves) {
  if (row.state !== 'playing' || !(await asksReady(env))) return {};
  const { asks, declined } = standing(row, await askRows(env, row.id), moves);
  const me = actorOf(who, row);
  const isMe = (r) => !!me && r.by_kind === me.kind && r.by_id === me.id;
  const side = sideOf(row, who);
  const own = side ? asks[side] : null;
  const theirs = side ? asks[other(side)] : null;
  const offered = !!theirs && theirs.kind === 'draw' && theirs.done;

  /* One person may always resign, their own draw offer standing or not,
     since that needs no row; the city gives up or asks for a draw, one at a
     time, and whoever is on the ask has only Take it back. */
  const mayAsk = [];
  if (side) {
    const n = need(row, side);
    if (n === 1) mayAsk.push({ kind: 'resign', as: 'resign' });
    if (own && !own.names.some(isMe)) {
      mayAsk.push({ kind: own.kind, as: 'agree' });
    } else if (!own) {
      if (n > 1) mayAsk.push({ kind: 'resign', as: 'giveup' });
      if (!(declined && declined.side === side)) {
        mayAsk.push({ kind: 'draw', as: !offered ? 'offer' : n > 1 ? 'agree' : 'accept' });
      }
    }
  }
  return {
    asks: ['w', 'b'].filter((s) => asks[s]).map((s) => ({
      kind: asks[s].kind,
      side: s,
      need: asks[s].need,
      done: asks[s].done,
      names: asks[s].names.map((r) => ({
        name: r.by_kind === 'house' ? 'house' : r.by_kind === 'user' && r.username ? r.username : 'visitor',
        you: isMe(r)
      }))
    })),
    declined: declined ? { side: declined.side } : null,
    mayAsk: mayAsk,
    ...(offered && side && need(row, side) === 1 ? { mayRefuse: true } : {})
  };
}

async function movesOf(env, id) {
  const { results } = await env.DB
    .prepare(
      'SELECT m.ply, m.san, m.uci, m.by_kind, m.at, u.username FROM chess_moves m ' +
      "LEFT JOIN users u ON m.by_kind = 'user' AND u.id = m.by_id " +
      'WHERE m.game = ? ORDER BY m.ply'
    )
    .bind(id)
    .all();
  return results || [];
}

/* One game as the page reads it: the row, its moves, and the reader's legal
   moves when it is their turn. `check` is the last move's, which its SAN
   already says with + or #. `abandon` is there only for the house, only when
   it may end the game; `claim` only for a player in a duel, only when they
   may claim it; the asks — asksOf() above — only while it is being played. */
async function gameAnswer(env, row, who) {
  if (!row) return null;
  const moves = await movesOf(env, row.id);
  const last = moves.length ? moves[moves.length - 1].san : '';
  return {
    game: {
      id: row.id,
      kind: row.kind,
      state: row.state,
      n: row.n,
      ...sides(row),
      turn: turnOf(row.fen),
      fen: row.fen,
      ply: row.ply,
      check: /[+#]$/.test(last),
      result: row.result || null,
      reason: row.reason || null,
      createdAt: row.created_at,
      startedAt: row.started_at || null,
      finishedAt: row.finished_at || null,
      lastAt: row.last_at
    },
    moves: moves.map((m) => ({
      ply: m.ply,
      san: m.san,
      uci: m.uci,
      by: m.by_kind === 'house' ? 'house' : m.by_kind === 'user' && m.username ? m.username : 'visitor',
      at: m.at
    })),
    ...(mayMove(row, who) ? { legal: legalMoves(row.fen) } : {}),
    ...(who.role === 'house' && mayAbandon(row) ? { abandon: true } : {}),
    ...(mayClaim(row, who) ? { claim: true } : {}),
    ...(await asksOf(env, row, who, moves))
  };
}

/* ------------------------------------------------------- the whole answer */

async function state(env, who) {
  const db = env.DB;
  const publicRow = await db
    .prepare(GAME_SQL + "WHERE g.kind = 'public' ORDER BY g.n DESC LIMIT 1")
    .first();

  /* A member's latest private game, in whatever state — waiting is what makes
     their card say they are in line, over what makes it say how it ended. The
     house's is the one being played, and there is at most one. A visitor has
     none. */
  let mineRow = null;
  if (who.role === 'house') {
    mineRow = await db
      .prepare(GAME_SQL + "WHERE g.kind = 'private' AND g.state = 'playing' LIMIT 1")
      .first();
  } else if (who.role === 'member') {
    mineRow = await db
      .prepare(GAME_SQL + "WHERE g.kind = 'private' AND g.challenger = ? ORDER BY g.created_at DESC LIMIT 1")
      .bind(who.user.id)
      .first();
  }

  const pub = await gameAnswer(env, publicRow, who);
  if (pub) pub.notes = await notesOf(env, publicRow.id, who);

  const { results: queue } = await db
    .prepare(
      'SELECT g.id, u.username AS name, g.created_at AS since FROM chess_games g ' +
      'LEFT JOIN users u ON u.id = g.challenger ' +
      "WHERE g.kind = 'private' AND g.state = 'waiting' ORDER BY g.created_at"
    )
    .all();

  /* The house's own record, over both kinds it plays as the house — a duel
     it played as a member is not the house's game. A game ended without a
     result counts for nobody, so it is not a game here either. */
  const rec = await db
    .prepare(
      'SELECT COUNT(*) AS games, ' +
      "SUM(CASE WHEN (result = '1-0' AND house_colour = 'w') OR (result = '0-1' AND house_colour = 'b') THEN 1 ELSE 0 END) AS won, " +
      "SUM(CASE WHEN (result = '0-1' AND house_colour = 'w') OR (result = '1-0' AND house_colour = 'b') THEN 1 ELSE 0 END) AS lost, " +
      "SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) AS drawn " +
      "FROM chess_games WHERE kind IN ('public', 'private') AND state = 'over' AND result != 'abandoned'"
    )
    .first();

  /* The public game's own tally, for the line under its moves: how the
     city's games against the house have gone, private games left out. Everybody
     is the side that is not the house, so a public game the house won is a win
     for the house and one it lost is a win for Everybody. */
  const score = await db
    .prepare(
      'SELECT ' +
      "SUM(CASE WHEN (result = '1-0' AND house_colour = 'w') OR (result = '0-1' AND house_colour = 'b') THEN 1 ELSE 0 END) AS house, " +
      "SUM(CASE WHEN (result = '0-1' AND house_colour = 'w') OR (result = '1-0' AND house_colour = 'b') THEN 1 ELSE 0 END) AS everybody, " +
      "SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) AS drawn " +
      "FROM chess_games WHERE kind = 'public' AND state = 'over'"
    )
    .first();

  return {
    ready: true,
    you: { role: who.role, name: who.user ? who.user.username : null },
    score: {
      everybody: (score && score.everybody) || 0,
      house: (score && score.house) || 0,
      drawn: (score && score.drawn) || 0
    },
    record: {
      games: (rec && rec.games) || 0,
      won: (rec && rec.won) || 0,
      lost: (rec && rec.lost) || 0,
      drawn: (rec && rec.drawn) || 0
    },
    public: pub,
    mine: await gameAnswer(env, mineRow, who),
    /* The house is handed each waiting game's id, which is what its Start
       button sends; nobody else has anything to send one for. */
    queue: (queue || []).map((q) => ({
      name: q.name || null,
      since: q.since,
      ...(who.role === 'house' ? { game: q.id } : {})
    })),
    ...(await duelsOf(env, who))
  };
}

/* The reader's duels: every challenge still standing either way, every game
   being played, and the ones that ended in the last QUIET_DAYS — as a list of
   rows, which is all the card draws — and the one they have open as a whole
   game, if they are in it — `who.duel`, off the read's `duel=` or the
   write's body. `duels` is null where `opponent` is not on the
   table, which the page reads as no card at all, and empty for a visitor,
   who is shown the card's way in. */
async function duelsOf(env, who) {
  if (!(await duelsReady(env))) return { duels: null, duel: null };
  if (!who.user) return { duels: [], duel: null };

  const now = Date.now();
  const me = who.user.id;
  const { results } = await env.DB
    .prepare(
      DUEL_SQL +
      "WHERE g.kind = 'duel' AND (g.challenger = ? OR g.opponent = ?) AND (g.state = 'playing' " +
      "OR (g.state = 'waiting' AND g.created_at > ?) OR (g.state = 'over' AND g.finished_at > ?)) " +
      'ORDER BY g.last_at DESC LIMIT 50'
    )
    .bind(me, me, now - QUIET_DAYS * DAY, now - QUIET_DAYS * DAY)
    .all();

  const open = (results || []).find((r) => r.id === who.duel && r.state !== 'waiting') || null;
  return {
    duels: (results || []).map((r) => ({
      id: r.id,
      kind: 'duel',
      state: r.state,
      ...sides(r),
      turn: turnOf(r.fen),
      /* Whose the next press is: a challenge the reader was sent, or a game
         where the move is theirs. */
      yours: r.state === 'waiting' ? r.opponent === me : r.state === 'playing' && duelMover(r) === me,
      result: r.result || null,
      reason: r.reason || null,
      createdAt: r.created_at,
      lastAt: r.last_at
    })),
    duel: open ? await gameAnswer(env, open, who) : null
  };
}

/* The public game's notes that are still showing, the newest NOTES_SHOWN of
   them in the order they were written, or null where the table is not
   applied. An anonymous note carries no name and a named one its author's —
   the house's as 'house', which the page prints as the wordmark the way it
   prints the house's moves. */
async function notesOf(env, game, who) {
  if (!(await notesReady(env))) return null;
  const me = actorOf(who);
  const { results } = await env.DB
    .prepare(
      'SELECT * FROM (SELECT n.id, n.ply, n.owner_kind, n.owner, n.named, n.text, n.at, u.username ' +
      'FROM chess_notes n ' +
      "LEFT JOIN users u ON n.owner_kind = 'user' AND u.id = n.owner " +
      'WHERE n.game = ? AND n.hidden = 0 ORDER BY n.at DESC LIMIT ?) ORDER BY at'
    )
    .bind(game, NOTES_SHOWN)
    .all();
  return (results || []).map((n) => ({
    id: n.id,
    ply: n.ply,
    name: !n.named ? null : n.owner_kind === 'house' ? 'house' : n.username || null,
    text: n.text,
    at: n.at,
    mine: !!me && n.owner_kind === me.kind && n.owner === me.id
  }));
}

const EMPTY = {
  ready: false,
  score: { everybody: 0, house: 0, drawn: 0 },
  record: { games: 0, won: 0, lost: 0, drawn: 0 },
  public: null,
  mine: null,
  queue: [],
  duels: null,
  duel: null
};

/* ---------------------------------------------------------------- reading */

export async function onRequestGet(context) {
  const { request, env } = context;
  const params = new URL(request.url).searchParams;
  const words = params.has('lang') ? await wordsFor(context, params.get('lang')) : {};

  if (!(await ready(env))) {
    if (params.has('find')) return json({ error: 'no-database' }, 503);
    return json({ ...EMPTY, ...words, you: { role: 'visitor', name: null } });
  }
  const who = await whoIs(request, env, params.get('client'), params.get('duel'));
  if (params.has('find')) return find(env, who, params.get('find'));
  return json({ ...(await state(env, who)), ...words });
}

/* GET ?find=<the start of a username> — members only, the reader left out,
   FOUND at most, alphabetical. Usernames and nothing else: they are already
   the public address of everybody's page under /u/, and what the reader has
   going with each of them the page reads off its own `duels`. Two characters
   at least, so a search is a search rather than the member list a page at a
   time. */
async function find(env, who, typed) {
  if (!who.user) return json({ error: 'signed-out' }, 401);
  if (!(await duelsReady(env))) return json({ error: 'no-database' }, 503);
  const start = String(typed || '').trim().toLowerCase().slice(0, 40);
  if (start.length < 2) return json({ players: [] });
  const { results } = await env.DB
    .prepare("SELECT username FROM users WHERE username LIKE ? ESCAPE '\\' AND id != ? ORDER BY username LIMIT ?")
    .bind(start.replace(/[\\%_]/g, '\\$&') + '%', who.user.id, FOUND)
    .all();
  return json({ players: (results || []).map((r) => r.username) });
}

/* ---------------------------------------------------------------- writing */

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: 'no-database' }, 503);
  if (await wrongDatabase(env)) return json({ error: 'wrong-database' }, 503);
  if (!(await ready(env))) return json({ error: 'no-database' }, 503);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'malformed' }, 400);
  }
  if (!body || typeof body !== 'object') return json({ error: 'malformed' }, 400);

  const who = await whoIs(request, env, body.client, body.duel);
  const act = Object.hasOwn(ACTIONS, body.action) ? ACTIONS[body.action] : null;
  if (!act) return json({ error: 'action' }, 400);
  return countUse(context, 'chess', body.action, act(env, who, body, request), who.user, who.client);
}

/* A refusal that says what the board is now, for the ones the page redraws
   from: somebody moved first, a game already playing. */
async function refuse(env, who, error, status) {
  return json({ error: error, ...(await state(env, who)) }, status);
}

async function done(env, who) {
  return json(await state(env, who));
}

async function gameById(env, id) {
  if (typeof id !== 'string' || !ID.test(id)) return null;
  return env.DB.prepare((await gameSql(env)) + 'WHERE g.id = ?').bind(id).first();
}

const ACTIONS = {
  move, undo, new: newGame, join, leave, start, ask: askFor, unask, refuse: refuseDraw, abandon,
  note, unnote, hide, challenge, accept, decline: drop, cancel: drop, claim
};

/* move { game, ply, move, client } — `ply` is the game's ply as the page read
   it, the number of half-moves already played; the move is filed at one past
   it. */
async function move(env, who, body) {
  const row = await gameById(env, body.game);
  if (!row) return json({ error: 'no-game' }, 404);
  if (!Number.isInteger(body.ply)) return json({ error: 'malformed' }, 400);
  if (row.state !== 'playing' || body.ply !== row.ply) return refuse(env, who, 'moved', 409);
  if (!mayMove(row, who)) return json({ error: 'not-yours' }, 403);

  const by = actorOf(who, row);
  if (!by) return json({ error: 'client' }, 400);

  const uci = typeof body.move === 'string' ? body.move : '';
  if (!UCI.test(uci)) return json({ error: 'illegal' }, 400);

  const fens = await replay(env, row.id);
  if (fens.length - 1 !== row.ply) return refuse(env, who, 'moved', 409);

  const played = play(fens[fens.length - 1], uci);
  if (!played) return json({ error: 'illegal' }, 400);
  fens.push(played.fen);
  const over = played.over ||
    (repetition(fens) ? { result: '1/2-1/2', reason: 'repetition' } : null);

  const now = Date.now();
  let results;
  try {
    results = await env.DB.batch([
      env.DB
        .prepare(
          'INSERT INTO chess_moves (game, ply, san, uci, by_kind, by_id, at) ' +
          'SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS ' +
          "(SELECT 1 FROM chess_games WHERE id = ? AND ply = ? AND state = 'playing')"
        )
        .bind(row.id, row.ply + 1, played.san, uci, by.kind, by.id, now, row.id, row.ply),
      env.DB
        .prepare(
          'UPDATE chess_games SET fen = ?, ply = ?, last_at = ?, state = ?, result = ?, reason = ?, finished_at = ? ' +
          "WHERE id = ? AND ply = ? AND state = 'playing'"
        )
        .bind(
          played.fen, row.ply + 1, now,
          over ? 'over' : 'playing', over ? over.result : null, over ? over.reason : null, over ? now : null,
          row.id, row.ply
        )
    ]);
  } catch (e) {
    /* The primary key refusing the second of two moves at one ply. */
    if (/UNIQUE|PRIMARY KEY|constraint/i.test(String(e && e.message))) return refuse(env, who, 'moved', 409);
    throw e;
  }
  if (!results[0].meta.changes) return refuse(env, who, 'moved', 409);
  if (over) await clearAsks(env, row.id);
  return done(env, who);
}

/* Who a move or a note is filed under: the house, a member by their id, or a
   visitor by the device id the page sends as `client` — null when a visitor
   sent none that is a v4 UUID. A move and its undo both ask, and a note and
   its deletion, so the one who may take either back is exactly the one it was
   filed under. In a duel the house is one member among two, and its moves
   there are filed as a member's, under its name. */
function actorOf(who, row) {
  if (who.role === 'house' && !(row && row.kind === 'duel')) return { kind: 'house', id: who.user.id };
  if (who.user) return { kind: 'user', id: who.user.id };
  return who.client ? { kind: 'device', id: who.client } : null;
}

/* The game as the rules say it is: every position from START through the
   moves filed, kept for the repetition count. The stored FEN is a cache of
   this and is not trusted over it. */
async function replay(env, id) {
  const history = await env.DB
    .prepare('SELECT uci FROM chess_moves WHERE game = ? ORDER BY ply')
    .bind(id)
    .all();
  const fens = [START];
  for (const m of history.results || []) {
    const step = play(fens[fens.length - 1], m.uci);
    if (!step) throw new Error('chess: game ' + id + ' does not replay at ' + m.uci);
    fens.push(step.fen);
  }
  return fens;
}

/* undo { game, ply, client } — whoever made the last move takes it back,
   within UNDO_MS of it being filed. `ply` is the move's own, the game's ply
   as the page read it. A move that ended the game is not taken back: the
   game is over and the result stands. Nor is one the other side has already
   answered — it is no longer the last move, and the game's ply has moved on.

   The move row goes and the game steps back to the position before it, in
   one batch, both only while the game is still playing at that ply: of an
   undo and the other side's reply arriving together, whichever the table
   takes first stands, and the other is the 409 the page redraws from. */
async function undo(env, who, body) {
  const row = await gameById(env, body.game);
  if (!row) return json({ error: 'no-game' }, 404);
  if (!Number.isInteger(body.ply)) return json({ error: 'malformed' }, 400);
  if (row.state !== 'playing' || body.ply !== row.ply || row.ply < 1) return refuse(env, who, 'too-late', 409);

  const by = actorOf(who, row);
  if (!by) return json({ error: 'client' }, 400);
  const last = await env.DB
    .prepare('SELECT by_kind, by_id, at FROM chess_moves WHERE game = ? AND ply = ?')
    .bind(row.id, row.ply)
    .first();
  if (!last) return refuse(env, who, 'too-late', 409);
  if (last.by_kind !== by.kind || last.by_id !== by.id) return json({ error: 'not-yours' }, 403);
  if (Date.now() - last.at > UNDO_MS + UNDO_GRACE_MS) return refuse(env, who, 'too-late', 409);

  const fens = await replay(env, row.id);
  if (fens.length - 1 !== row.ply) return refuse(env, who, 'too-late', 409);
  const before = fens[fens.length - 2];

  const now = Date.now();
  const results = await env.DB.batch([
    env.DB
      .prepare(
        'DELETE FROM chess_moves WHERE game = ? AND ply = ? AND EXISTS ' +
        "(SELECT 1 FROM chess_games WHERE id = ? AND ply = ? AND state = 'playing')"
      )
      .bind(row.id, row.ply, row.id, row.ply),
    env.DB
      .prepare("UPDATE chess_games SET fen = ?, ply = ?, last_at = ? WHERE id = ? AND ply = ? AND state = 'playing'")
      .bind(before, row.ply - 1, now, row.id, row.ply)
  ]);
  if (!results[0].meta.changes) return refuse(env, who, 'too-late', 409);
  return done(env, who);
}

/* new — the house starts the next public game, once the last is over. */
async function newGame(env, who) {
  if (who.role !== 'house') return json({ error: 'not-yours' }, 403);
  if (!(await startPublic(env))) return refuse(env, who, 'playing', 409);
  return done(env, who);
}

/* The next public game, while none is being played. Game n has the house on
   black when n is odd, so Everybody opens the first game as white and the
   colours swap every game after. The house presses for it after a mate; a
   game given up or drawn by agreement starts the next one itself. */
async function startPublic(env) {
  const now = Date.now();
  const res = await env.DB
    .prepare(
      'INSERT INTO chess_games (id, kind, state, n, challenger, house_colour, fen, ply, created_at, started_at, last_at) ' +
      "SELECT ?, 'public', 'playing', n, NULL, CASE WHEN n % 2 = 1 THEN 'b' ELSE 'w' END, ?, 0, ?, ?, ? " +
      "FROM (SELECT COALESCE(MAX(n), 0) + 1 AS n FROM chess_games WHERE kind = 'public') " +
      "WHERE NOT EXISTS (SELECT 1 FROM chess_games WHERE kind = 'public' AND state = 'playing')"
    )
    .bind(randomHex(8), START, now, now, now)
    .run();
  return !!res.meta.changes;
}

/* join — a member takes a place in line: a private game, waiting. One per
   account while it waits or plays, and the check and the insert are one
   statement so two presses at once cannot make two. */
async function join(env, who) {
  if (who.role === 'visitor') return json({ error: 'signed-out' }, 401);
  if (who.role === 'house') return json({ error: 'not-yours' }, 403);

  const mine = await env.DB
    .prepare("SELECT 1 FROM chess_games WHERE kind = 'private' AND challenger = ? AND state IN ('waiting', 'playing') LIMIT 1")
    .bind(who.user.id)
    .first();
  if (mine) return refuse(env, who, 'already', 409);

  const waiting = await env.DB
    .prepare("SELECT COUNT(*) AS n FROM chess_games WHERE kind = 'private' AND state = 'waiting'")
    .first();
  if (waiting && waiting.n >= MAX_QUEUE) return json({ error: 'full' }, 429);

  /* The challenger opens as white, so the house is black in every private
     game. */
  const now = Date.now();
  const res = await env.DB
    .prepare(
      'INSERT INTO chess_games (id, kind, state, n, challenger, house_colour, fen, ply, created_at, last_at) ' +
      "SELECT ?, 'private', 'waiting', n, ?, 'b', ?, 0, ?, ? " +
      "FROM (SELECT COALESCE(MAX(n), 0) + 1 AS n FROM chess_games WHERE kind = 'private') " +
      "WHERE NOT EXISTS (SELECT 1 FROM chess_games WHERE kind = 'private' AND challenger = ? AND state IN ('waiting', 'playing'))"
    )
    .bind(randomHex(8), who.user.id, START, now, now, who.user.id)
    .run();
  if (!res.meta.changes) return refuse(env, who, 'already', 409);
  return done(env, who);
}

/* leave — out of the line, any time before the game starts. */
async function leave(env, who) {
  if (who.role !== 'member') return json({ error: 'not-in-line' }, 404);
  const res = await env.DB
    .prepare("DELETE FROM chess_games WHERE kind = 'private' AND state = 'waiting' AND challenger = ?")
    .bind(who.user.id)
    .run();
  if (!res.meta.changes) return json({ error: 'not-in-line' }, 404);
  return done(env, who);
}

/* start { game } — the house starts the first in line, one private game at a
   time. The update checks both again, so a second press cannot start two. */
async function start(env, who, body) {
  if (who.role !== 'house') return json({ error: 'not-yours' }, 403);
  const row = await gameById(env, body.game);
  if (!row || row.kind !== 'private' || row.state !== 'waiting') return json({ error: 'no-game' }, 404);

  const busy = await env.DB
    .prepare("SELECT 1 FROM chess_games WHERE kind = 'private' AND state = 'playing' LIMIT 1")
    .first();
  if (busy) return refuse(env, who, 'busy', 409);
  const first = await env.DB
    .prepare("SELECT id FROM chess_games WHERE kind = 'private' AND state = 'waiting' ORDER BY created_at LIMIT 1")
    .first();
  if (!first || first.id !== row.id) return refuse(env, who, 'not-first', 409);

  const now = Date.now();
  const res = await env.DB
    .prepare(
      "UPDATE chess_games SET state = 'playing', started_at = ?, last_at = ? " +
      "WHERE id = ? AND state = 'waiting' " +
      "AND NOT EXISTS (SELECT 1 FROM chess_games WHERE kind = 'private' AND state = 'playing')"
    )
    .bind(now, now, row.id)
    .run();
  if (!res.meta.changes) return refuse(env, who, 'busy', 409);
  return done(env, who);
}

/* Ends a playing game, and answers whether this call was the one that did.
   A game that is over has nothing standing on it, so its asks go with it. */
async function finish(env, id, result, reason) {
  const now = Date.now();
  const res = await env.DB
    .prepare(
      "UPDATE chess_games SET state = 'over', result = ?, reason = ?, finished_at = ?, last_at = ? " +
      "WHERE id = ? AND state = 'playing'"
    )
    .bind(result, reason, now, now, id)
    .run();
  if (res.meta.changes) await clearAsks(env, id);
  return !!res.meta.changes;
}

async function clearAsks(env, id) {
  if (!(await asksReady(env))) return;
  await env.DB.prepare('DELETE FROM chess_asks WHERE game = ?').bind(id).run();
}

/* ------------------------------------------------------------------- asks */

/* ask { game, kind, client } — kind 'resign' or 'draw': this reader's side
   gives the game up, or asks for a draw. From one person a resignation is
   the end of the game there and then, and a draw ask is an offer. From
   Everybody — the house's side of the public game is one person, the other
   is the city — it is one row of the NEED_CITY the side needs, raising the
   ask when it is the first or agreeing to it when it is not; the side has
   given up when the count is reached, and offered a draw. A draw ask from
   the side the other has offered a draw to is the acceptance, and the game
   is drawn the moment both sides' asks are complete. One kind at a time a
   side — the insert refuses a draw while a give-up stands, and the other
   way round — and one row a person, which the primary key refuses a second
   of. A side whose draw was refused asks again only once the refuser has
   moved. */
async function askFor(env, who, body) {
  const kind = body.kind === 'draw' || body.kind === 'resign' ? body.kind : '';
  if (!kind) return json({ error: 'malformed' }, 400);
  const row = await gameById(env, body.game);
  if (!row || row.state !== 'playing') return json({ error: 'no-game' }, 404);
  const side = sideOf(row, who);
  if (!side) return json({ error: 'not-yours' }, 403);
  const by = actorOf(who, row);
  if (!by) return json({ error: 'client' }, 400);

  const n = need(row, side);
  if (kind === 'resign' && n === 1) return endBy(env, who, row, side === 'w' ? '0-1' : '1-0', 'resign');
  if (!(await asksReady(env))) return json({ error: 'no-database' }, 503);

  const moves = await movesOf(env, row.id);
  const was = await tidyAsks(env, row, moves);
  if (kind === 'draw' && was.declined && was.declined.side === side) return refuse(env, who, 'declined', 409);

  try {
    const res = await env.DB
      .prepare(
        'INSERT INTO chess_asks (game, kind, side, ply, by_kind, by_id, at) SELECT ?, ?, ?, ?, ?, ?, ? ' +
        "WHERE NOT EXISTS (SELECT 1 FROM chess_asks WHERE game = ? AND side = ? AND kind NOT IN (?, 'declined'))"
      )
      .bind(row.id, kind, side, row.ply, by.kind, by.id, Date.now(), row.id, side, kind)
      .run();
    if (!res.meta.changes) return refuse(env, who, 'standing', 409);
  } catch (e) {
    /* The primary key: this person is on the ask already. */
    if (/UNIQUE|PRIMARY KEY|constraint/i.test(String(e && e.message))) return refuse(env, who, 'already', 409);
    throw e;
  }

  const now = standing(row, await askRows(env, row.id), moves);
  const own = now.asks[side];
  const theirs = now.asks[other(side)];
  if (own && own.done) {
    if (kind === 'resign') return endBy(env, who, row, side === 'w' ? '0-1' : '1-0', 'resign');
    if (theirs && theirs.kind === 'draw' && theirs.done) return endBy(env, who, row, '1/2-1/2', 'agreed');
  }
  return done(env, who);
}

/* Deletes what standing() says is dead on a game, and answers what is
   standing. Every write to the table starts here, so a person whose ask
   lapsed last week is not refused by the key when they raise another. */
async function tidyAsks(env, row, moves) {
  const was = standing(row, await askRows(env, row.id), moves);
  if (was.dead.length) {
    await env.DB.batch(was.dead.map((r) => env.DB
      .prepare('DELETE FROM chess_asks WHERE game = ? AND kind = ? AND by_kind = ? AND by_id = ?')
      .bind(row.id, r.kind, r.by_kind, r.by_id)));
  }
  return was;
}

/* The end of a game somebody asked for. A public game that ends this way
   starts the next one at once — the asking was for a fresh start. */
async function endBy(env, who, row, result, reason) {
  if (!(await finish(env, row.id, result, reason))) return refuse(env, who, 'no-game', 404);
  if (row.kind === 'public') await startPublic(env);
  return done(env, who);
}

/* unask { game, client } — a person takes their own name off their side's
   ask, whichever kind it is. A single player's offer goes with it; one of
   Everybody's two leaves the ask one short. */
async function unask(env, who, body) {
  if (!(await asksReady(env))) return json({ error: 'no-database' }, 503);
  const row = await gameById(env, body.game);
  if (!row) return json({ error: 'no-game' }, 404);
  const by = actorOf(who, row);
  if (!by) return json({ error: 'client' }, 400);
  const res = await env.DB
    .prepare("DELETE FROM chess_asks WHERE game = ? AND kind != 'declined' AND by_kind = ? AND by_id = ?")
    .bind(row.id, by.kind, by.id)
    .run();
  if (!res.meta.changes) return refuse(env, who, 'no-ask', 404);
  return done(env, who);
}

/* refuse { game, client } — a single player turns down the draw the other
   side has offered: the offer goes, and a 'declined' marker stands until
   the refuser has moved, which is how long the other side waits before it
   may ask again. Everybody has no refuse: two of the city agreeing is the
   yes, and playing on is the no. */
async function refuseDraw(env, who, body) {
  if (!(await asksReady(env))) return json({ error: 'no-database' }, 503);
  const row = await gameById(env, body.game);
  if (!row || row.state !== 'playing') return json({ error: 'no-game' }, 404);
  const side = sideOf(row, who);
  if (!side || need(row, side) > 1) return json({ error: 'not-yours' }, 403);
  const by = actorOf(who, row);
  if (!by) return json({ error: 'client' }, 400);

  const moves = await movesOf(env, row.id);
  const theirs = (await tidyAsks(env, row, moves)).asks[other(side)];
  if (!theirs || theirs.kind !== 'draw' || !theirs.done) return refuse(env, who, 'no-ask', 409);

  await env.DB.batch([
    env.DB.prepare('DELETE FROM chess_asks WHERE game = ?').bind(row.id),
    env.DB
      .prepare("INSERT INTO chess_asks (game, kind, side, ply, by_kind, by_id, at) VALUES (?, 'declined', ?, ?, ?, ?, ?)")
      .bind(row.id, other(side), row.ply, by.kind, by.id, Date.now())
  ]);
  return done(env, who);
}

/* abandon { game } — the house ends a private game with no result, only when
   it is the member's move and they have not made it for seven days. */
async function abandon(env, who, body) {
  if (who.role !== 'house') return json({ error: 'not-yours' }, 403);
  const row = await gameById(env, body.game);
  if (!row || row.kind !== 'private' || row.state !== 'playing') return json({ error: 'no-game' }, 404);
  if (!mayAbandon(row)) return refuse(env, who, 'not-yet', 409);
  if (!(await finish(env, row.id, 'abandoned', 'abandoned'))) return json({ error: 'no-game' }, 404);
  return done(env, who);
}

/* ------------------------------------------------------------------ duels */

/* challenge { name } — a member challenges another by username, and plays
   white. Refused for oneself, for somebody with whom a challenge or a game is
   already standing — either way round, so two people challenging each other
   at once make one challenge and a 409 — and past MAX_DUELS of the
   challenger's own. The check and the insert are one statement, as join's
   are, so a second press cannot make a second challenge. A challenge nobody
   answered in QUIET_DAYS is not standing any more, and is deleted on the way
   past by the next one between the two. */
async function challenge(env, who, body) {
  if (!who.user) return json({ error: 'signed-out' }, 401);
  if (!(await duelsReady(env))) return json({ error: 'no-database' }, 503);

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const them = name
    ? await env.DB.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').bind(name).first()
    : null;
  if (!them) return json({ error: 'no-player' }, 404);
  if (them.id === who.user.id) return json({ error: 'self' }, 400);

  const me = who.user.id;
  const now = Date.now();
  const stale = now - QUIET_DAYS * DAY;
  const PAIR = "kind = 'duel' AND ((challenger = ? AND opponent = ?) OR (challenger = ? AND opponent = ?))";
  await env.DB
    .prepare("DELETE FROM chess_games WHERE " + PAIR + " AND state = 'waiting' AND created_at <= ?")
    .bind(me, them.id, them.id, me, stale)
    .run();

  const going = await env.DB
    .prepare(
      "SELECT COUNT(*) AS n FROM chess_games WHERE kind = 'duel' AND " +
      "((state = 'playing' AND (challenger = ? OR opponent = ?)) OR (state = 'waiting' AND challenger = ? AND created_at > ?))"
    )
    .bind(me, me, me, stale)
    .first();
  if (going && going.n >= MAX_DUELS) return json({ error: 'full' }, 429);

  const res = await env.DB
    .prepare(
      'INSERT INTO chess_games (id, kind, state, n, challenger, opponent, house_colour, fen, ply, created_at, last_at) ' +
      "SELECT ?, 'duel', 'waiting', n, ?, ?, '', ?, 0, ?, ? " +
      "FROM (SELECT COALESCE(MAX(n), 0) + 1 AS n FROM chess_games WHERE kind = 'duel') " +
      "WHERE NOT EXISTS (SELECT 1 FROM chess_games WHERE " + PAIR + " AND state IN ('waiting', 'playing'))"
    )
    .bind(randomHex(8), me, them.id, START, now, now, me, them.id, them.id, me)
    .run();
  if (!res.meta.changes) return refuse(env, who, 'already', 409);
  return done(env, who);
}

/* accept { game } — the one challenged starts the game, while the challenge
   is still standing and they have fewer than MAX_DUELS being played. */
async function accept(env, who, body) {
  const row = await gameById(env, body.game);
  const now = Date.now();
  if (!row || row.kind !== 'duel' || row.state !== 'waiting' || !who.user || row.opponent !== who.user.id ||
      row.created_at <= now - QUIET_DAYS * DAY) {
    return refuse(env, who, 'no-game', 404);
  }
  const playing = await env.DB
    .prepare("SELECT COUNT(*) AS n FROM chess_games WHERE kind = 'duel' AND state = 'playing' AND (challenger = ? OR opponent = ?)")
    .bind(who.user.id, who.user.id)
    .first();
  if (playing && playing.n >= MAX_DUELS) return json({ error: 'full' }, 429);

  const res = await env.DB
    .prepare("UPDATE chess_games SET state = 'playing', started_at = ?, last_at = ? WHERE id = ? AND state = 'waiting'")
    .bind(now, now, row.id)
    .run();
  if (!res.meta.changes) return refuse(env, who, 'no-game', 404);
  /* The game is open on the page that accepted it. */
  who.duel = row.id;
  return done(env, who);
}

/* decline and cancel { game } — a challenge comes off the page, deleted:
   declined by the one it was sent to, cancelled by the one who sent it. One
   statement for both, since which of the two you are is in the WHERE. */
async function drop(env, who, body) {
  if (!who.user || typeof body.game !== 'string' || !ID.test(body.game)) return refuse(env, who, 'no-game', 404);
  const res = await env.DB
    .prepare("DELETE FROM chess_games WHERE id = ? AND kind = 'duel' AND state = 'waiting' AND (challenger = ? OR opponent = ?)")
    .bind(body.game, who.user.id, who.user.id)
    .run();
  if (!res.meta.changes) return refuse(env, who, 'no-game', 404);
  return done(env, who);
}

/* claim { game } — a player in a duel takes the win from one the other has
   left their move in for QUIET_DAYS. The duel's answer to the house's
   abandon: between two members nobody is the house, so a game left standing
   goes to the one still there rather than to nobody. */
async function claim(env, who, body) {
  const row = await gameById(env, body.game);
  if (!row || !inDuel(row, who) || row.state !== 'playing') return json({ error: 'no-game' }, 404);
  if (!mayClaim(row, who)) return refuse(env, who, 'not-yet', 409);
  const winner = who.user.id === row.challenger ? 'w' : 'b';
  if (!(await finish(env, row.id, winner === 'w' ? '1-0' : '0-1', 'claimed'))) return json({ error: 'no-game' }, 404);
  return done(env, who);
}

/* ------------------------------------------------------------------ notes */

/* The text as it is kept: one paragraph, its runs of white space closed up,
   counted after the tidying so nobody is refused for spaces they cannot see.
   It reaches the page as textContent, so there is nothing to escape. */
function noteText(text) {
  return String(typeof text === 'string' ? text : '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE);
}

/* note { game, text, as, client } — a line beside the public game while it is
   being played. `as: 'name'` puts the author's name on it, and only a signed-in
   author has one to put; anything else is anonymous. */
async function note(env, who, body, request) {
  if (!(await notesReady(env))) return json({ error: 'no-database' }, 503);
  if (!env.SAVE_SALT) return json({ error: 'no-salt' }, 503);

  const row = await gameById(env, body.game);
  if (!row || row.kind !== 'public') return json({ error: 'no-game' }, 404);
  if (row.state !== 'playing') return refuse(env, who, 'over', 409);

  const by = actorOf(who);
  if (!by) return json({ error: 'client' }, 400);
  const text = noteText(body.text);
  if (!text) return json({ error: 'empty' }, 400);

  const hash = await fingerprint(env.SAVE_SALT, clientIp(request), request.headers.get('User-Agent') || '');
  const now = Date.now();
  const seen = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM chess_notes WHERE ip_hash = ? AND at > ?')
    .bind(hash, now - HOUR)
    .first();
  if (seen && seen.n >= NOTES_PER_HOUR) return json({ error: 'often' }, 429);

  await env.DB
    .prepare(
      'INSERT INTO chess_notes (id, game, ply, owner_kind, owner, named, text, ip_hash, at, hidden) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)'
    )
    .bind(randomHex(8), row.id, row.ply, by.kind, by.id, who.user && body.as === 'name' ? 1 : 0, text, hash, now)
    .run();
  return done(env, who);
}

/* unnote { id, client } — the author deletes their own note. The owner is in
   the WHERE, so the statement cannot take anybody else's whatever is edited
   above it; a note that was not theirs, or is gone, is the same 404. */
async function unnote(env, who, body) {
  if (!(await notesReady(env))) return json({ error: 'no-database' }, 503);
  const by = actorOf(who);
  if (!by) return json({ error: 'client' }, 400);
  const id = typeof body.id === 'string' && ID.test(body.id) ? body.id : '';
  const res = await env.DB
    .prepare('DELETE FROM chess_notes WHERE id = ? AND owner_kind = ? AND owner = ?')
    .bind(id, by.kind, by.id)
    .run();
  if (!res.meta.changes) return json({ error: 'no-note' }, 404);
  return done(env, who);
}

/* hide { id } — the house takes any note off the page. */
async function hide(env, who, body) {
  if (who.role !== 'house') return json({ error: 'not-yours' }, 403);
  if (!(await notesReady(env))) return json({ error: 'no-database' }, 503);
  const id = typeof body.id === 'string' && ID.test(body.id) ? body.id : '';
  const res = await env.DB
    .prepare('UPDATE chess_notes SET hidden = 1 WHERE id = ? AND hidden = 0')
    .bind(id)
    .run();
  if (!res.meta.changes) return json({ error: 'no-note' }, 404);
  return done(env, who);
}
