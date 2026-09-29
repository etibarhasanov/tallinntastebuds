#!/usr/bin/env node
/**
 * Tallinn Tastebuds — the rules of chess, held to answers somebody else wrote
 * down, and timed.
 *
 * functions/api/_chess.js is what decides a legal move on the chess page, and
 * a mistake in it is the quiet kind: a castle through check allowed, an en
 * passant capture missing, a game called drawn a move early. The page draws
 * whatever it is told, so nobody would notice until somebody who plays chess
 * did — and then only in the one game where it came up. This is what notices
 * first.
 *
 * Usage:
 *
 *     node tools/chessperf.mjs           every check, and how long each position took
 *     node tools/chessperf.mjs --check   the checks alone (this is what CI runs)
 *
 * Four kinds of check, because each catches what the others cannot.
 *
 * PERFT. The number of positions a move generator reaches from a position in
 * so many moves, every one of them counted and none of them judged. Chess
 * programmers publish the true numbers for positions built to catch the usual
 * mistakes — a castling right that outlives the rook it was about, en passant
 * uncovering a king, a pawn taking and promoting at once, checks down every
 * kind of line — and a generator that matches them to depth three or four has
 * no mistake left in which moves it allows that anybody has found a way to
 * hide. The six below are the Chess Programming Wiki's "Perft Results". Each
 * was run once more, a depth deeper, when this file was written — sixteen
 * million positions in two and a half seconds, every count right — and the
 * check stops a depth short of that, so CI is not kept waiting for what a
 * shallower run already says. Positions 3 and 4 keep their deeper row, because
 * en passant and promotion are where those two go looking, and the extra depth
 * costs a quarter of a second.
 *
 * THE CASES. A count says nothing about how a move is written or when a game
 * ends. So the rules the page shows a person — SAN with its disambiguation and
 * its + and #, the FEN the tables keep, checkmate, stalemate, a dead position,
 * the fifty-move rule — are held to positions worked out by hand, and every
 * answer below was checked against python-chess before it was written in, so
 * the file is not marking its own homework.
 *
 * THE GAMES. Two short ones from the start: a mate, and a repetition, which
 * needs a game's whole list of positions and so cannot be a single case.
 *
 * THE REFUSALS. In each perft position, every square holding a piece of the
 * side to move, to every other square, with and without a promotion letter,
 * and a handful of strings that are not moves at all: play() must answer
 * exactly the ones legalMoves() lists and refuse the rest, and every position
 * it answers with must read back in. That is the page's side of the rules —
 * whatever a visitor sends is one of these. And a FEN that cannot be read must
 * be thrown, not played.
 *
 * It imports what it checks rather than restating any of it, the way
 * tools/validate.mjs imports MAX_ITEMS from functions/api/lists.js: it is the
 * third tool that reaches into functions/, after that one and
 * tools/typelists.mjs. Zero dependencies, like every other tool here.
 */

import { START, legalMoves, play, repetition, perft } from '../functions/api/_chess.js';

const CHECK = process.argv.includes('--check');
const DRAW = '1/2-1/2';

/* [ name, FEN, the count at depth 1, 2, … ] */
const POSITIONS = [
  ['start', START, [20, 400, 8902, 197281]],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
  ['position 3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238, 674624]],
  ['position 4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467, 422333]],
  ['position 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
  ['position 6', 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890]]
];

/* What play() answers, spelled the way it spells it. */
const answer = (fen, san, check = false, over = null) => ({ fen, san, check, over });
const ends = (result, reason) => ({ result, reason });

/* [ what it shows, FEN, move, what play() answers — null for a refusal ] */
const CASES = [
  ['castling through an attacked square is refused',
    '4kr2/8/8/8/8/8/8/4K2R w K - 0 1', 'e1g1', null],
  ['castling out of check is refused',
    '4k3/8/8/8/8/8/8/r3K2R w K - 0 1', 'e1g1', null],
  ['castling into check is refused',
    '4k1r1/8/8/8/8/8/8/4K2R w K - 0 1', 'e1g1', null],
  ['castling long past an attacked b1 is allowed',
    '1r2k3/8/8/8/8/8/8/R3K3 w Q - 0 1', 'e1c1',
    answer('1r2k3/8/8/8/8/8/8/2KR4 b - - 1 1', 'O-O-O')],
  /* The counts above cannot see this one: castling also asks for the rook
     on its square, so a right that outlived its rook is only ever wrong in
     the FEN — until a rook walks back home. */
  ['a rook that leaves home, and a rook taken at home, lose their castles',
    'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'h1h8',
    answer('r3k2R/8/8/8/8/8/8/R3K3 b Qq - 0 1', 'Rxh8+', true)],
  ['no en passant square where nothing can take',
    START, 'e2e4',
    answer('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', 'e4')],
  ['the en passant square where a capture is legal',
    'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2', 'f7f5',
    answer('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3', 'f5')],
  ['en passant taken',
    'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3', 'e5f6',
    answer('rnbqkbnr/ppp1p1pp/5P2/3p4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 3', 'exf6')],
  ['no en passant square where the capture would uncover the king',
    '8/3p4/8/K3P2r/8/8/8/7k b - - 0 1', 'd7d5',
    answer('8/8/8/K2pP2r/8/8/8/7k w - - 0 2', 'd5')],
  ['and that capture refused',
    '8/8/8/K2pP2r/8/8/8/7k w - d6 0 1', 'e5d6', null],
  ['a pawn takes and becomes a queen, with check',
    'r3k3/1P6/8/8/8/8/8/4K3 w - - 0 1', 'b7a8q',
    answer('Q3k3/8/8/8/8/8/8/4K3 b - - 0 1', 'bxa8=Q+', true)],
  ['a pawn takes and becomes a knight, and a knight alone is a draw',
    'r3k3/1P6/8/8/8/8/8/4K3 w - - 0 1', 'b7a8n',
    answer('N3k3/8/8/8/8/8/8/4K3 b - - 0 1', 'bxa8=N', false, ends(DRAW, 'material'))],
  ['a promotion without its letter is refused',
    'r3k3/1P6/8/8/8/8/8/4K3 w - - 0 1', 'b7a8', null],
  ['the queen move that stalemates',
    '7k/8/6K1/8/8/8/8/5Q2 w - - 0 1', 'f1f7',
    answer('7k/5Q2/6K1/8/8/8/8/8 b - - 1 1', 'Qf7', false, ends(DRAW, 'stalemate'))],
  ['the hundredth half-move without a capture or a pawn move',
    '8/8/8/4k3/8/8/8/R3K3 w - - 99 80', 'a1a2',
    answer('8/8/8/4k3/8/8/R7/4K3 b - - 100 80', 'Ra2', false, ends(DRAW, 'fifty'))],
  ['a mate on the hundredth half-move is still a win',
    '6k1/5ppp/8/8/8/8/8/R5K1 w - - 99 80', 'a1a8',
    answer('R5k1/5ppp/8/8/8/8/8/6K1 b - - 100 80', 'Ra8#', true, ends('1-0', 'mate'))],
  ['a bare bishop left after a capture',
    'k7/8/8/8/8/8/1r6/KB6 w - - 0 1', 'a1b2',
    answer('k7/8/8/8/8/8/1K6/1B6 b - - 0 1', 'Kxb2', false, ends(DRAW, 'material'))],
  ['bishops on one colour of square',
    'k4b2/8/8/8/8/8/1n6/K1B5 w - - 0 1', 'a1b2',
    answer('k4b2/8/8/8/8/8/1K6/2B5 b - - 0 1', 'Kxb2', false, ends(DRAW, 'material'))],
  ['bishops on both colours play on',
    'k3b3/8/8/8/8/8/1n6/K1B5 w - - 0 1', 'a1b2',
    answer('k3b3/8/8/8/8/8/1K6/2B5 b - - 0 1', 'Kxb2')],
  ['two knights to one square: the file says which',
    'k7/8/8/8/8/8/8/KN3N2 w - - 0 1', 'b1d2',
    answer('k7/8/8/8/8/8/3N4/K4N2 b - - 1 1', 'Nbd2')],
  ['and the other',
    'k7/8/8/8/8/8/8/KN3N2 w - - 0 1', 'f1d2',
    answer('k7/8/8/8/8/8/3N4/KN6 b - - 1 1', 'Nfd2')],
  ['two rooks on one file: the rank says which',
    '7k/8/8/R7/8/8/8/R3K3 w - - 0 1', 'a1a3',
    answer('7k/8/8/R7/8/R7/8/4K3 b - - 1 1', 'R1a3')],
  ['and the other',
    '7k/8/8/R7/8/8/8/R3K3 w - - 0 1', 'a5a3',
    answer('7k/8/8/8/8/R7/8/R3K3 b - - 1 1', 'R5a3')],
  ['three queens to one square: the file and the rank',
    '8/7k/8/8/8/Q7/8/Q1Q1K3 w - - 0 1', 'a1b2',
    answer('8/7k/8/8/8/Q7/1Q6/2Q1K3 b - - 1 1', 'Qa1b2')],
  ['the rank alone',
    '8/7k/8/8/8/Q7/8/Q1Q1K3 w - - 0 1', 'a3b2',
    answer('8/7k/8/8/8/8/1Q6/Q1Q1K3 b - - 1 1', 'Q3b2')],
  ['the file alone',
    '8/7k/8/8/8/Q7/8/Q1Q1K3 w - - 0 1', 'c1b2',
    answer('8/7k/8/8/8/Q7/1Q6/Q3K3 b - - 1 1', 'Qcb2')],
  ['a pinned knight does not make the other say where it came from',
    '7k/8/2b5/8/8/5N2/8/1N5K w - - 0 1', 'b1d2',
    answer('7k/8/2b5/8/8/5N2/3N4/7K b - - 1 1', 'Nd2')]
];

/* [ what it shows, the moves from START, what the last play() answers,
   whether repetition() calls it a third time ] */
const KNIGHTS = ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8'];
const GAMES = [
  ["fool's mate", ['f2f3', 'e7e5', 'g2g4', 'd8h4'],
    answer('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3', 'Qh4#', true, ends('0-1', 'mate')), false],
  ['the knights out and back, the start on the board twice', KNIGHTS.slice(0, 4),
    answer('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 4 3', 'Ng8'), false],
  ['and again, the third time', KNIGHTS,
    answer('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 8 5', 'Ng8'), true]
];

/* What a request could carry where a move should be, and is a move in no
   position: near misses in spelling, and things that are not strings at all. */
const NOT_MOVES = ['', 'e2', 'e2e4 ', ' e2e4', 'E2E4', 'e2e9', 'i2i4', 'e2e4qq', 'e2-e4', null, undefined, 42, {}];

/* [ what is wrong with it, a position play() must throw on rather than play ]
   — one for each thing parse() refuses, and each wrong in that one way only,
   so that no refusal can go missing behind another. */
const NOT_FENS = [
  ['nothing at all', ''],
  ['a word', 'START'],
  ['seven ranks', '4k3/8/8/8/8/8/4K3 w - - 0 1'],
  ['nine ranks', '4k3/8/8/8/8/8/8/4K3/8 w - - 0 1'],
  ['a rank of seven squares', '4k3/8/8/8/8/8/8/4K2 w - - 0 1'],
  ['a rank of nine', '4k3/8/8/8/8/8/8/4K4 w - - 0 1'],
  ['a letter that is no piece', '4k3/8/8/8/8/8/8/4K2X w - - 0 1'],
  ['a pawn on the last rank', 'P3k3/8/8/8/8/8/8/4K3 w - - 0 1'],
  ['no black king', '8/8/8/8/8/8/8/4K3 w - - 0 1'],
  ['two white kings', '4k3/8/8/8/8/8/8/K3K3 w - - 0 1'],
  ['nobody to move', '4k3/8/8/8/8/8/8/4K3 x - - 0 1'],
  ['a castle that is no castle', '4k3/8/8/8/8/8/8/4K3 w X - 0 1'],
  ['one castle twice', 'r3k3/8/8/8/8/8/8/4K3 b qq - 0 1'],
  ['en passant on the wrong side', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e3 0 1'],
  ['a move count that is not a number', '4k3/8/8/8/8/8/8/4K3 w - - x 1'],
  ['the side not to move in check', '4k3/8/8/8/8/8/8/4R1K1 w - - 0 1']
];

let failed = 0;
const ok = (label, rest = '') => console.log(`ok   ${label}${rest ? '  ' + rest : ''}`);
const fail = (label, rest) => {
  failed++;
  console.log(`FAIL ${label}  ${rest}`);
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const seconds = (since) => ((performance.now() - since) / 1000).toFixed(2) + ' s';

console.log('perft');
for (const [label, fen, counts] of POSITIONS) {
  const began = performance.now();
  const got = counts.map((_, i) => perft(fen, i + 1));
  const shown = got.map((n) => n.toLocaleString('en')).join(' · ');
  if (same(got, counts)) ok(label.padEnd(12), shown + (CHECK ? '' : `   ${seconds(began)}`));
  else fail(label.padEnd(12), `${shown}, expected ${counts.map((n) => n.toLocaleString('en')).join(' · ')}`);
}

console.log('\ncases');
for (const [label, fen, move, want] of CASES) {
  const got = play(fen, move);
  if (same(got, want)) ok(label);
  else fail(label, `${move} from ${fen}\n       gave     ${JSON.stringify(got)}\n       expected ${JSON.stringify(want)}`);
}

console.log('\ngames');
for (const [label, moves, want, third] of GAMES) {
  const fens = [START];
  let got = null;
  for (const move of moves) {
    got = play(fens[fens.length - 1], move);
    if (!got) break;
    fens.push(got.fen);
  }
  const repeated = repetition(fens);
  if (same(got, want) && repeated === third) ok(label);
  else fail(label, `gave ${JSON.stringify(got)}, repetition ${repeated}; expected ${JSON.stringify(want)}, repetition ${third}`);
}

console.log('\nrefusals');
for (const [label, fen] of POSITIONS) {
  const legal = new Set(legalMoves(fen));
  const tried = candidates(fen);
  const wrong = [];
  for (const move of tried) {
    const got = play(fen, move);
    if ((got !== null) !== legal.has(move)) wrong.push(move);
    else if (got) legalMoves(got.fen);
  }
  const unseen = [...legal].filter((move) => !tried.includes(move));
  if (!wrong.length && !unseen.length) ok(label.padEnd(12), `${tried.length.toLocaleString('en')} tried, ${legal.size} played`);
  else fail(label.padEnd(12), `answered wrongly: ${wrong.join(' ') || 'none'}; never tried: ${unseen.join(' ') || 'none'}`);
}
const answered = NOT_MOVES.filter((move) => play(START, move) !== null);
if (!answered.length) ok(`${NOT_MOVES.length} things that are not moves`);
else fail('things that are not moves', `answered: ${answered.map((m) => JSON.stringify(m)).join(' ')}`);
const played = NOT_FENS.filter(([, fen]) => {
  try {
    play(fen, 'e1e2');
    return true;
  } catch (e) {
    return false;
  }
});
if (!played.length) ok(`${NOT_FENS.length} positions that cannot be read, thrown`);
else fail('positions that cannot be read', `played: ${played.map(([why]) => why).join(', ')}`);

if (failed) {
  console.error(`\n${failed} check${failed === 1 ? '' : 's'} failed. functions/api/_chess.js says what each one is for.`);
  process.exit(1);
}

/* Every move a visitor could send from `fen` with a piece of the side to
   move: to every other square, and with a promotion letter as well — all four
   onto the last rank for a pawn, and a queen onto anything else, which must be
   refused. */
function candidates(fen) {
  const [placement, side] = fen.split(' ');
  const last = side === 'w' ? '8' : '1';
  const squares = [];
  for (let rank = 1; rank <= 8; rank++) for (const file of 'abcdefgh') squares.push(file + rank);
  const out = [];
  placement.split('/').forEach((row, i) => {
    let file = 0;
    for (const ch of row) {
      if (ch >= '1' && ch <= '8') {
        file += Number(ch);
        continue;
      }
      const from = 'abcdefgh'[file++] + (8 - i);
      if ((ch === ch.toUpperCase()) !== (side === 'w')) continue;
      for (const to of squares) {
        if (to === from) continue;
        out.push(from + to);
        if (ch.toLowerCase() === 'p' && to[1] === last) for (const p of 'qrbn') out.push(from + to + p);
        else out.push(from + to + 'q');
      }
    }
  });
  return out;
}
