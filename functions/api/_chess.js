/**
 * Tallinn Tastebuds — the rules of chess, for the page where the city plays
 * the house.
 *
 * Everything that page needs to know about the game, and nothing about the
 * page. Hand it a position and it says which moves are legal there; hand it a
 * position and a move and it says what the board is afterwards, how the move
 * is written, and whether that was the end of the game. Its caller is the
 * chess route, functions/api/chess.js, which replays a game from START through
 * play() before it files a move, so that nothing about a game is believed that
 * these rules did not produce, and hands the page legalMoves() for the one
 * position on its board. The other reader is tools/chessperf.mjs, which holds
 * all of it to answers somebody else wrote down, on every push.
 *
 * WHY THE BROWSER RUNS NONE OF IT
 *
 * The page could work out its own legal moves, and it would gain nothing it
 * wants. The answer it draws from already carries them for the one position on
 * the board, and a move is not a move until the server has checked it anyway.
 * What a second copy would cost is the pins' problem with a harder table: the
 * same rules written twice, once in ES5 for assets/ and once here, and a
 * validator that can hold two lists of eight ids to each other but not two
 * move generators. So there is one copy of the rules, and it is this one.
 *
 * A POSITION IS A LINE OF TEXT, AND A MOVE IS FOUR OR FIVE LETTERS
 *
 * A position goes in and comes out as FEN, the one line every chess program
 * reads: the board rank by rank from the eighth, whose move it is, who may
 * still castle, the square a pawn may be taken on en passant, the half-moves
 * since the last capture or pawn move, and the move number. It is what the
 * tables keep, so any game in the database can be pasted into any chess
 * program and looked at. A move goes in as UCI — e2e4, e1g1 to castle short,
 * e7e8q for a pawn that becomes a queen — which is what the page sends, and
 * comes out as SAN as well — Nf3, exd6, O-O-O — which is what the list of
 * moves shows.
 *
 * Inside, a position is an 0x88 board: 128 squares of which half are off the
 * edge, so that whether a step has left the board is one AND rather than four
 * comparisons. A move is made on it, the mover's king is looked at for
 * attackers, and the move is taken back. That is the slow way to know which
 * moves are legal and the easy way to get right, and it is quick enough by
 * orders of magnitude for a page that asks about one position at a time:
 * tools/chessperf.mjs has it count a million and a half positions in under
 * half a second.
 *
 * THE EN PASSANT SQUARE IS WRITTEN ONLY WHEN SOMEBODY CAN TAKE ON IT
 *
 * Most programs write the square behind every pawn that has just moved two,
 * whether anything can capture there or not. That makes one position two: the
 * board after 1.e4 reads differently from the same board reached another way,
 * and a threefold repetition would be counted short. fenOf() writes the square
 * only while an en passant capture is actually legal, which is how the rules
 * decide whether two positions are the same, so repetition() can compare four
 * fields of text and be right. parse() reads either kind.
 *
 * WHEN A GAME IS OVER
 *
 * play() says so after checkmate, stalemate, a position neither side can mate
 * from, and a hundred half-moves without a capture or a pawn move.
 * repetition() says so for the same position a third time, and is separate
 * because only the route has the whole game to count through. Over the board
 * the fifty moves and the third repetition are claims — a player may ask for
 * the draw, and only seventy-five moves or a fifth repetition end the game on
 * their own. Nobody is sitting at this board to ask, so the claim is made for
 * both players at the first moment it could be. Checkmate outranks all of
 * them, and a mate on the hundredth half-move is a win, which is FIDE's rule
 * too. A stalemate that also leaves too little to mate with is called a
 * stalemate, because that is what the board shows.
 *
 * A position nobody can mate from is the kind nobody argues about: king
 * against king; a king and one bishop or one knight against a bare king; and
 * kings with bishops, however many, all standing on one colour of square —
 * the king and bishop against king and bishop on one colour, and every other
 * arrangement that follows by the same argument. A knight each, or a knight
 * against a bishop, can still end in mate if the loser helps, and plays on.
 *
 * WHAT WAS TRIED
 *
 * Perft is the count of every position a move generator reaches from a given
 * one, to a given depth, and chess programmers have published the true counts
 * for positions built to catch the usual mistakes — castling rights lost to a
 * rook being taken, en passant uncovering a king, promotion with capture,
 * checks down every kind of line. tools/chessperf.mjs holds this file to six
 * of them. A count says nothing about how a move is written or when a game
 * ends, so these were tried by hand as well, and the tool runs every one of
 * them on every push:
 *
 *   - castling through an attacked square, into one and out of check, all
 *     refused; castling long past an attacked b1, allowed, since the king
 *     never crosses b1; a rook that leaves home and a rook taken at home, each
 *     losing its castle — which no count can see, because castling also asks
 *     for the rook on its square;
 *   - en passant taken and written exf6, with the square in the FEN only while
 *     the capture is legal — and refused, the square left out, where the two
 *     pawns leaving the rank together would uncover their king to a rook;
 *   - a pawn taking into the corner as a queen with check, bxa8=Q+, and as a
 *     knight, bxa8=N, which leaves a knight against a bare king and a draw;
 *   - the queen move that stalemates;
 *   - the hundredth half-move drawn, and a mate on the same half-move won;
 *   - a bare bishop left after a capture, bishops on one colour drawn, and
 *     bishops on both colours playing on;
 *   - fool's mate from the start, and the knights out and back twice to a
 *     third repetition;
 *   - two knights, two rooks and three queens that could reach one square,
 *     written Nbd2, R1a3, Q3b2, Qcb2 and Qa1b2, and a pinned knight that could
 *     not, which leaves Nd2 as it is;
 *   - in each of the six perft positions, every square to every other with
 *     and without a promotion letter, refused by play() unless legalMoves()
 *     has it, and strings that are not moves at all refused too;
 *   - a FEN wrong in each of the ways parse() refuses, thrown.
 *
 * And once, by hand rather than on every push, because it needs a Python
 * library this repository will never carry: two thousand games of random moves,
 * from the start and from the five other perft positions, replayed through
 * python-chess with every list of legal moves, every SAN, every FEN, every
 * check and every ending compared at every one of their 646,036 moves. Among
 * them were 5,421 promotions, 190 castles, 39 en passant captures and games
 * ending in all five of the ways above; there was not one difference.
 *
 * A FEN this cannot read is thrown rather than guessed at: every one here
 * comes from START or from play(), so one that does not parse is a bug to hear
 * about. A move it cannot find among the legal ones is null instead, because
 * that is a visitor's mistake rather than the site's.
 */

/* The position every game here begins from. */
export const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/* ------------------------------------------------------------ the board */

/* A square is its rank times sixteen plus its file, so a1 is 0 and h8 is 119,
   and anything with a bit of 0x88 set is off the edge. A piece is its kind
   with the colour's bit on top — a white knight is 2, a black one 10 — and an
   empty square is 0. */
const PAWN = 1;
const KNIGHT = 2;
const BISHOP = 3;
const ROOK = 4;
const QUEEN = 5;
const KING = 6;
const WHITE = 0;
const BLACK = 8;

/* How FEN, UCI and SAN spell each kind; a white piece in FEN and every piece
   in SAN takes it upper case. */
const LETTER = ' pnbrqk';
const FILES = 'abcdefgh';

const KNIGHT_STEPS = [-33, -31, -18, -14, 14, 18, 31, 33];
const BISHOP_STEPS = [-17, -15, 15, 17];
const ROOK_STEPS = [-16, -1, 1, 16];
const KING_STEPS = [-17, -16, -15, -1, 1, 15, 16, 17];
/* Which slider besides the queen attacks along each of KING_STEPS. */
const ALONG = [BISHOP, ROOK, BISHOP, ROOK, ROOK, BISHOP, ROOK, BISHOP];
/* How each kind moves, by its number, and whether it keeps going. Pawns are
   their own case below. */
const STEPS = [null, null, KNIGHT_STEPS, BISHOP_STEPS, ROOK_STEPS, KING_STEPS, KING_STEPS];
const SLIDES = [false, false, false, true, true, true, false];

const at = (square) => (square.charCodeAt(1) - 49) * 16 + square.charCodeAt(0) - 97;
const name = (s) => FILES[s & 7] + ((s >> 4) + 1);

/* A move is one number: the square it leaves in the lowest seven bits, the
   square it lands on in the next seven, the kind a pawn becomes in the three
   above those, and a flag for each of the three moves that do more than move
   one piece. */
const EP = 1 << 17;
const CASTLE = 1 << 18;
const DOUBLE = 1 << 19;
const PROMOTIONS = [QUEEN, ROOK, BISHOP, KNIGHT];
const NO_PROMOTION = [0];

/* The four castles, in FEN's KQkq order, each its right as a bit: where the
   king and the rook stand and land, the squares that must be empty, and the
   squares the king must not be attacked on as it goes. The square it lands on
   is left to the check every move gets. */
const CASTLES = [
  [WHITE, 'e1', 'g1', 'h1', 'f1', ['f1', 'g1'], ['e1', 'f1']],
  [WHITE, 'e1', 'c1', 'a1', 'd1', ['d1', 'c1', 'b1'], ['e1', 'd1']],
  [BLACK, 'e8', 'g8', 'h8', 'f8', ['f8', 'g8'], ['e8', 'f8']],
  [BLACK, 'e8', 'c8', 'a8', 'd8', ['d8', 'c8', 'b8'], ['e8', 'd8']]
].map(([colour, king, to, rook, rookTo, empty, safe], i) => ({
  right: 1 << i, colour, king: at(king), to: at(to), rook: at(rook), rookTo: at(rookTo),
  empty: empty.map(at), safe: safe.map(at)
}));

/* The rights that survive a move touching each square: a king or a rook
   leaving home, or a rook taken where it stands, loses its castle for good. */
const KEEP = new Array(128).fill(15);
for (const c of CASTLES) {
  KEEP[c.king] &= ~c.right;
  KEEP[c.rook] &= ~c.right;
}

/* ------------------------------------------------------------- FEN */

function parse(fen) {
  const bad = (why) => new Error(`chess: ${why}: ${fen}`);
  const fields = typeof fen === 'string' ? fen.trim().split(/\s+/) : [];
  if (fields.length < 4 || fields.length > 6) throw bad('not a FEN');
  const [placement, side, rights, passant, half = '0', full = '1'] = fields;

  const board = new Array(128).fill(0);
  const kings = [-1, -1];
  const rows = placement.split('/');
  if (rows.length !== 8) throw bad('not eight ranks');
  rows.forEach((row, i) => {
    const rank = 7 - i;
    let file = 0;
    for (const ch of row) {
      if (ch >= '1' && ch <= '8') {
        file += Number(ch);
        continue;
      }
      const kind = LETTER.indexOf(ch.toLowerCase());
      if (kind < 1 || file > 7) throw bad(`cannot read rank ${rank + 1}`);
      if (kind === PAWN && (rank === 0 || rank === 7)) throw bad('a pawn on the first or last rank');
      const colour = ch === ch.toLowerCase() ? BLACK : WHITE;
      const s = rank * 16 + file;
      if (kind === KING) {
        if (kings[colour >> 3] >= 0) throw bad('two kings of one colour');
        kings[colour >> 3] = s;
      }
      board[s] = kind | colour;
      file++;
    }
    if (file !== 8) throw bad(`rank ${rank + 1} is not eight squares`);
  });
  if (kings[0] < 0 || kings[1] < 0) throw bad('a side without its king');

  if (side !== 'w' && side !== 'b') throw bad('nobody to move');
  const turn = side === 'w' ? WHITE : BLACK;
  let castle = 0;
  if (rights !== '-') {
    for (const ch of rights) {
      const i = 'KQkq'.indexOf(ch);
      if (i < 0 || castle & (1 << i)) throw bad('cannot read who may castle');
      castle |= 1 << i;
    }
  }
  let ep = -1;
  if (passant !== '-') {
    if (!/^[a-h][36]$/.test(passant) || passant[1] !== (turn === WHITE ? '6' : '3')) {
      throw bad('cannot read the en passant square');
    }
    ep = at(passant);
  }
  if (!/^\d+$/.test(half) || !/^\d+$/.test(full)) throw bad('cannot read the move counts');

  const pos = { board, turn, castle, ep, half: Number(half), full: Number(full), kings, undo: [] };
  if (attacked(pos, kings[(turn ^ BLACK) >> 3], turn)) throw bad('the side not to move is in check');
  return pos;
}

/* The position as FEN, with the en passant square only when `moves` — the
   legal moves of the side to move — can take on it. */
function fenOf(pos, moves) {
  const rows = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = '';
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const piece = pos.board[rank * 16 + file];
      if (!piece) {
        empty++;
        continue;
      }
      if (empty) {
        row += empty;
        empty = 0;
      }
      const letter = LETTER[piece & 7];
      row += piece & BLACK ? letter : letter.toUpperCase();
    }
    rows.push(empty ? row + empty : row);
  }
  let rights = '';
  for (let i = 0; i < 4; i++) if (pos.castle & (1 << i)) rights += 'KQkq'[i];
  const passant = pos.ep >= 0 && moves.some((m) => m & EP) ? name(pos.ep) : '-';
  return `${rows.join('/')} ${pos.turn === WHITE ? 'w' : 'b'} ${rights || '-'} ${passant} ${pos.half} ${pos.full}`;
}

/* ------------------------------------------------------------- moves */

/* Whether any piece of `by` attacks square `s`. Every line is walked outward
   from the square, so a king in check is found by looking from the king. */
function attacked(pos, s, by) {
  const board = pos.board;
  const pawn = PAWN | by;
  const behind = by === WHITE ? s - 16 : s + 16;
  if (!((behind - 1) & 0x88) && board[behind - 1] === pawn) return true;
  if (!((behind + 1) & 0x88) && board[behind + 1] === pawn) return true;
  for (const d of KNIGHT_STEPS) {
    const t = s + d;
    if (!(t & 0x88) && board[t] === (KNIGHT | by)) return true;
  }
  for (let i = 0; i < 8; i++) {
    const d = KING_STEPS[i];
    if ((s + d) & 0x88) continue;
    if (board[s + d] === (KING | by)) return true;
    for (let t = s + d; !(t & 0x88); t += d) {
      const piece = board[t];
      if (!piece) continue;
      if (piece === (ALONG[i] | by) || piece === (QUEEN | by)) return true;
      break;
    }
  }
  return false;
}

/* Every move the side to move could make if its own king did not matter.
   legal() is what makes it matter. */
function pseudo(pos) {
  const { board, turn, ep, castle } = pos;
  const them = turn ^ BLACK;
  const up = turn === WHITE ? 16 : -16;
  const home = turn === WHITE ? 1 : 6;
  const last = turn === WHITE ? 7 : 0;
  const moves = [];
  for (let from = 0; from < 120; from++) {
    if (from & 0x88) {
      from += 7;
      continue;
    }
    const piece = board[from];
    if (!piece || (piece & BLACK) !== turn) continue;
    const kind = piece & 7;

    if (kind === PAWN) {
      /* Always on the board: no pawn stands on its last rank, since parse()
         refuses one and a pawn that reaches it becomes something else. */
      const one = from + up;
      if (!board[one]) {
        for (const p of one >> 4 === last ? PROMOTIONS : NO_PROMOTION) moves.push(from | one << 7 | p << 14);
        if (from >> 4 === home && !board[one + up]) moves.push(from | (one + up) << 7 | DOUBLE);
      }
      for (const to of [one - 1, one + 1]) {
        if (to & 0x88) continue;
        const victim = board[to];
        if (victim && (victim & BLACK) === them) {
          for (const p of to >> 4 === last ? PROMOTIONS : NO_PROMOTION) moves.push(from | to << 7 | p << 14);
        } else if (!victim && to === ep && board[to - up] === (PAWN | them)) {
          moves.push(from | to << 7 | EP);
        }
      }
      continue;
    }

    for (const d of STEPS[kind]) {
      for (let to = from + d; !(to & 0x88); to += d) {
        const there = board[to];
        if (there && (there & BLACK) === turn) break;
        moves.push(from | to << 7);
        if (there || !SLIDES[kind]) break;
      }
    }
    if (kind === KING && castle) {
      for (const c of CASTLES) {
        if (c.colour !== turn || !(castle & c.right) || c.king !== from || board[c.rook] !== (ROOK | turn)) continue;
        if (c.empty.some((s) => board[s]) || c.safe.some((s) => attacked(pos, s, them))) continue;
        moves.push(from | c.to << 7 | CASTLE);
      }
    }
  }
  return moves;
}

/* A move played on the board in place. What it cannot work out again on the
   way back — what it took, the rights, the en passant square, the clock —
   goes onto pos.undo, two numbers a move, for unmake() to take off. */
function make(pos, m) {
  const board = pos.board;
  const from = m & 127;
  const to = (m >> 7) & 127;
  const promo = (m >> 14) & 7;
  const piece = board[from];
  const us = piece & BLACK;
  let taken = board[to];
  pos.undo.push(taken | pos.castle << 4 | (pos.ep + 1) << 8, pos.half);

  board[to] = promo ? promo | us : piece;
  board[from] = 0;
  if (m & EP) {
    const behind = us === WHITE ? to - 16 : to + 16;
    taken = board[behind];
    board[behind] = 0;
  } else if (m & CASTLE) {
    const c = CASTLES.find((x) => x.to === to);
    board[c.rookTo] = board[c.rook];
    board[c.rook] = 0;
  }
  if ((piece & 7) === KING) pos.kings[us >> 3] = to;
  pos.castle &= KEEP[from] & KEEP[to];
  pos.ep = m & DOUBLE ? (from + to) >> 1 : -1;
  pos.half = (piece & 7) === PAWN || taken ? 0 : pos.half + 1;
  if (us === BLACK) pos.full++;
  pos.turn = us ^ BLACK;
}

function unmake(pos, m) {
  const board = pos.board;
  const from = m & 127;
  const to = (m >> 7) & 127;
  const us = pos.turn ^ BLACK;
  pos.half = pos.undo.pop();
  const u = pos.undo.pop();

  const piece = (m >> 14) & 7 ? PAWN | us : board[to];
  board[from] = piece;
  board[to] = u & 15;
  if (m & EP) {
    board[us === WHITE ? to - 16 : to + 16] = PAWN | (us ^ BLACK);
  } else if (m & CASTLE) {
    const c = CASTLES.find((x) => x.to === to);
    board[c.rook] = board[c.rookTo];
    board[c.rookTo] = 0;
  }
  if ((piece & 7) === KING) pos.kings[us >> 3] = from;
  pos.castle = (u >> 4) & 15;
  pos.ep = (u >> 8) - 1;
  if (us === BLACK) pos.full--;
  pos.turn = us;
}

/* The moves that do not leave the mover's own king attacked. */
function legal(pos) {
  const us = pos.turn;
  const moves = [];
  for (const m of pseudo(pos)) {
    make(pos, m);
    if (!attacked(pos, pos.kings[us >> 3], us ^ BLACK)) moves.push(m);
    unmake(pos, m);
  }
  return moves;
}

function count(pos, depth) {
  const moves = legal(pos);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) {
    make(pos, m);
    n += count(pos, depth - 1);
    unmake(pos, m);
  }
  return n;
}

const uciOf = (m) => name(m & 127) + name((m >> 7) & 127) + ((m >> 14) & 7 ? LETTER[(m >> 14) & 7] : '');

/* The move as SAN, before it is made, without the + or # that only the
   position after it can say. `moves` are the legal ones, so a piece that is
   pinned and cannot go there does not make the one that can say where it came
   from. */
function san(pos, m, moves) {
  const board = pos.board;
  const from = m & 127;
  const to = (m >> 7) & 127;
  const promo = (m >> 14) & 7;
  if (m & CASTLE) return to > from ? 'O-O' : 'O-O-O';
  const kind = board[from] & 7;
  const takes = board[to] || m & EP;
  if (kind === PAWN) {
    return (takes ? FILES[from & 7] + 'x' : '') + name(to) + (promo ? '=' + LETTER[promo].toUpperCase() : '');
  }
  let which = '';
  const rivals = moves.filter((o) => ((o >> 7) & 127) === to && (o & 127) !== from && (board[o & 127] & 7) === kind);
  if (rivals.length) {
    if (!rivals.some((o) => (o & 7) === (from & 7))) which = FILES[from & 7];
    else if (!rivals.some((o) => (o & 127) >> 4 === from >> 4)) which = String((from >> 4) + 1);
    else which = name(from);
  }
  return LETTER[kind].toUpperCase() + which + (takes ? 'x' : '') + name(to);
}

/* Whether neither side has anything left to mate with — see WHEN A GAME IS
   OVER above. */
function dead(pos) {
  let minors = 0;
  let knights = 0;
  let colours = 0;
  for (let s = 0; s < 120; s++) {
    if (s & 0x88) {
      s += 7;
      continue;
    }
    const kind = pos.board[s] & 7;
    if (!kind || kind === KING) continue;
    if (kind !== KNIGHT && kind !== BISHOP) return false;
    minors++;
    if (kind === KNIGHT) knights++;
    else colours |= 1 << ((s + (s >> 4)) & 1);
  }
  return minors <= 1 || (knights === 0 && colours !== 3);
}

/* ---------------------------------------------------- what it exports */

const DRAW = '1/2-1/2';

/* Every legal move in the position, in UCI. Empty when the game is over by
   mate or stalemate. */
export function legalMoves(fen) {
  return legal(parse(fen)).map(uciOf);
}

/* One move, as UCI, played from the position. `{ fen, san, check, over }`,
   or null for anything that is not one of legalMoves(fen) exactly — a
   promotion needs its letter, and a letter on anything else is not a move.
   `over` is null, or `{ result, reason }`: the result as '1-0', '0-1' or
   '1/2-1/2', and the reason one of mate, stalemate, material or fifty. */
export function play(fen, uci) {
  const pos = parse(fen);
  const moves = legal(pos);
  const m = typeof uci === 'string' ? moves.find((x) => uciOf(x) === uci) : undefined;
  if (m === undefined) return null;

  const written = san(pos, m, moves);
  make(pos, m);
  const replies = legal(pos);
  const check = attacked(pos, pos.kings[pos.turn >> 3], pos.turn ^ BLACK);
  let over = null;
  if (!replies.length) {
    over = check ? { result: pos.turn === WHITE ? '0-1' : '1-0', reason: 'mate' } : { result: DRAW, reason: 'stalemate' };
  } else if (dead(pos)) {
    over = { result: DRAW, reason: 'material' };
  } else if (pos.half >= 100) {
    over = { result: DRAW, reason: 'fifty' };
  }
  return {
    fen: fenOf(pos, replies),
    san: written + (check ? (replies.length ? '+' : '#') : ''),
    check,
    over
  };
}

/* Whether the last of a game's positions, oldest first, is on the board for
   the third time. Compared on the first four fields of FEN — the board, whose
   move, who may castle, the en passant square — which is the rules' own test
   because fenOf() writes that square only when it can be used. */
export function repetition(fens) {
  if (!Array.isArray(fens)) throw new Error('chess: repetition() takes a list of positions');
  const same = (fen) => String(fen).trim().split(/\s+/).slice(0, 4).join(' ');
  const last = fens.length ? same(fens[fens.length - 1]) : null;
  return fens.filter((fen) => same(fen) === last).length >= 3;
}

/* The number of positions `depth` moves from this one — see WHAT WAS TRIED
   above, and tools/chessperf.mjs, which is what calls it. */
export function perft(fen, depth) {
  if (!Number.isInteger(depth) || depth < 0) throw new Error(`chess: perft() needs a depth of 0 or more, got ${depth}`);
  return depth === 0 ? 1 : count(parse(fen), depth);
}
