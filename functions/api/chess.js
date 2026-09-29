/**
 * Tallinn Tastebuds — the chess route: everything /chess draws, and every
 * move made on it.
 *
 * Two kinds of game against the house, which is the owner's account — the one
 * ADMINS in wrangler.toml names, the same test functions/api/_admin.js puts in
 * front of /admin/. A public game is Everybody against Tallinn Tastebuds: one
 * board for whoever opens the page, signed in or not. A private game is one
 * member against the house, and it starts as a place in a public waiting
 * list. **Chess** in README.md is the whole of it, and
 * .claude/skills/chess/SKILL.md is the shape that was agreed before any of it
 * was written.
 *
 * ONE ANSWER FOR THE WHOLE PAGE
 *
 * GET answers everything the page draws, once: who is reading, the house's
 * record, the public game, the reader's own private game — or, for the house,
 * the one being played — and the queue. Each game comes with its moves, and
 * with `legal`, every move the reader may make now, only when it is their
 * turn: the browser runs none of the rules, it draws the moves it was handed.
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
 * in a private game the challenger alone. The house is found by reading the
 * session once and asking adminIds() whether that id is one of the owner's,
 * rather than calling adminUser() and then sessionUser() again for everybody
 * who is not: the same test with one query instead of two.
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

import { json, sessionUser, wrongDatabase, randomHex, wordsFor } from './_lib.js';
import { adminIds } from './_admin.js';
import { START, legalMoves, play, repetition } from './_chess.js';

/* How long a member may leave their move before the house may end the game
   with no result, and how long the queue may be. The page says the first in
   words — chessAbandonWhy — out of the game's lastAt, never out of a copy of
   this number. */
const QUIET_DAYS = 7;
const MAX_QUEUE = 50;

/* How long whoever made a move may take it back. The page counts UNDO_MS
   from the moment its move came back; the route allows a little more, so a
   press in the last second on a slow phone is not refused for the time the
   request spent on the way. */
const UNDO_MS = 10000;
const UNDO_GRACE_MS = 3000;

const DAY = 86400000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

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

/* Who is reading: the house, a member or a visitor, and their row. */
async function whoIs(request, env) {
  const user = await sessionUser(request, env);
  if (!user) return { role: 'visitor', user: null };
  const house = adminIds(env).has(String(user.id).toLowerCase());
  return { role: house ? 'house' : 'member', user: user };
}

/* ------------------------------------------------------------ one game */

const GAME_SQL =
  'SELECT g.*, u.username AS challenger_name FROM chess_games g ' +
  'LEFT JOIN users u ON u.id = g.challenger ';

function turnOf(fen) {
  return String(fen).split(' ')[1] === 'b' ? 'b' : 'w';
}

/* The two sides' names as the page prints them: 'everybody', 'house', or the
   challenger's username — null for an account that has since been deleted,
   which the page reads as a visitor. */
function sides(row) {
  const other = row.kind === 'public' ? 'everybody' : row.challenger_name || null;
  return row.house_colour === 'w'
    ? { white: 'house', black: other }
    : { white: other, black: 'house' };
}

/* Whether this reader may play the side to move in this game now. */
function mayMove(row, who) {
  if (row.state !== 'playing') return false;
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
   it may end the game. */
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
    ...(who.role === 'house' && mayAbandon(row) ? { abandon: true } : {})
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

  const { results: queue } = await db
    .prepare(
      'SELECT g.id, u.username AS name, g.created_at AS since FROM chess_games g ' +
      'LEFT JOIN users u ON u.id = g.challenger ' +
      "WHERE g.kind = 'private' AND g.state = 'waiting' ORDER BY g.created_at"
    )
    .all();

  /* The house's own record, over both kinds. A game ended without a result
     counts for nobody, so it is not a game here either. */
  const rec = await db
    .prepare(
      'SELECT COUNT(*) AS games, ' +
      "SUM(CASE WHEN (result = '1-0' AND house_colour = 'w') OR (result = '0-1' AND house_colour = 'b') THEN 1 ELSE 0 END) AS won, " +
      "SUM(CASE WHEN (result = '0-1' AND house_colour = 'w') OR (result = '1-0' AND house_colour = 'b') THEN 1 ELSE 0 END) AS lost, " +
      "SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) AS drawn " +
      "FROM chess_games WHERE state = 'over' AND result != 'abandoned'"
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
    public: await gameAnswer(env, publicRow, who),
    mine: await gameAnswer(env, mineRow, who),
    /* The house is handed each waiting game's id, which is what its Start
       button sends; nobody else has anything to send one for. */
    queue: (queue || []).map((q) => ({
      name: q.name || null,
      since: q.since,
      ...(who.role === 'house' ? { game: q.id } : {})
    }))
  };
}

const EMPTY = {
  ready: false,
  score: { everybody: 0, house: 0, drawn: 0 },
  record: { games: 0, won: 0, lost: 0, drawn: 0 },
  public: null,
  mine: null,
  queue: []
};

/* ---------------------------------------------------------------- reading */

export async function onRequestGet(context) {
  const { request, env } = context;
  const params = new URL(request.url).searchParams;
  const words = params.has('lang') ? await wordsFor(context, params.get('lang')) : {};

  if (!(await ready(env))) {
    return json({ ...EMPTY, ...words, you: { role: 'visitor', name: null } });
  }
  const who = await whoIs(request, env);
  return json({ ...(await state(env, who)), ...words });
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

  const who = await whoIs(request, env);
  const act = ACTIONS[body.action];
  if (!act) return json({ error: 'action' }, 400);
  return act(env, who, body);
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
  if (typeof id !== 'string' || !/^[0-9a-f]{16}$/.test(id)) return null;
  return env.DB.prepare(GAME_SQL + 'WHERE g.id = ?').bind(id).first();
}

const ACTIONS = { move, undo, new: newGame, join, leave, start, resign, abandon };

/* move { game, ply, move, client } — `ply` is the game's ply as the page read
   it, the number of half-moves already played; the move is filed at one past
   it. */
async function move(env, who, body) {
  const row = await gameById(env, body.game);
  if (!row) return json({ error: 'no-game' }, 404);
  if (!Number.isInteger(body.ply)) return json({ error: 'malformed' }, 400);
  if (row.state !== 'playing' || body.ply !== row.ply) return refuse(env, who, 'moved', 409);
  if (!mayMove(row, who)) return json({ error: 'not-yours' }, 403);

  const by = moverOf(who, body);
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
  return done(env, who);
}

/* Who a move is filed under: the house, a member by their id, or a visitor by
   the device id the page sends as `client` — null when a visitor sent none
   that is a v4 UUID. A move and its undo both ask, so the one who may take a
   move back is exactly the one it was filed under. */
function moverOf(who, body) {
  if (who.role === 'house') return { kind: 'house', id: who.user.id };
  if (who.user) return { kind: 'user', id: who.user.id };
  const client = typeof body.client === 'string' ? body.client : '';
  return UUID.test(client) ? { kind: 'device', id: client } : null;
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

  const by = moverOf(who, body);
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

/* new — the house starts the next public game, once the last is over. Game n
   has the house on black when n is odd, so Everybody opens the first game as
   white and the colours swap every game after. */
async function newGame(env, who) {
  if (who.role !== 'house') return json({ error: 'not-yours' }, 403);
  const now = Date.now();
  const id = randomHex(8);
  const res = await env.DB
    .prepare(
      'INSERT INTO chess_games (id, kind, state, n, challenger, house_colour, fen, ply, created_at, started_at, last_at) ' +
      "SELECT ?, 'public', 'playing', n, NULL, CASE WHEN n % 2 = 1 THEN 'b' ELSE 'w' END, ?, 0, ?, ?, ? " +
      "FROM (SELECT COALESCE(MAX(n), 0) + 1 AS n FROM chess_games WHERE kind = 'public') " +
      "WHERE NOT EXISTS (SELECT 1 FROM chess_games WHERE kind = 'public' AND state = 'playing')"
    )
    .bind(id, START, now, now, now)
    .run();
  if (!res.meta.changes) return refuse(env, who, 'playing', 409);
  return done(env, who);
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

/* Ends a playing game, and answers whether this call was the one that did. */
async function finish(env, id, result, reason) {
  const now = Date.now();
  const res = await env.DB
    .prepare(
      "UPDATE chess_games SET state = 'over', result = ?, reason = ?, finished_at = ?, last_at = ? " +
      "WHERE id = ? AND state = 'playing'"
    )
    .bind(result, reason, now, now, id)
    .run();
  return !!res.meta.changes;
}

/* resign { game } — the challenger, or the house, on a private game being
   played. Whoever resigned lost. A public game has nobody who could resign for
   the city, so it cannot be. */
async function resign(env, who, body) {
  const row = await gameById(env, body.game);
  const mine = row && row.kind === 'private' && row.state === 'playing' &&
    (who.role === 'house' || (who.user && who.user.id === row.challenger));
  if (!mine) return json({ error: 'no-game' }, 404);

  const loser = who.role === 'house' ? row.house_colour : row.house_colour === 'w' ? 'b' : 'w';
  if (!(await finish(env, row.id, loser === 'w' ? '0-1' : '1-0', 'resign'))) {
    return json({ error: 'no-game' }, 404);
  }
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
