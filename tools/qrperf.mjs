#!/usr/bin/env node
/**
 * Tallinn Tastebuds — QR encoder check and stopwatch.
 *
 * `assets/qr.js` is the one piece of real algorithm in the repo, and it runs
 * on the one page where a guest is standing at a till waiting for it. Both
 * halves of that sentence need a tool: something that says the encoder still
 * draws exactly the code it drew yesterday, and something that says how long
 * it takes to draw it.
 *
 * Usage:
 *
 *     node tools/qrperf.mjs           check the fingerprints, then time it
 *     node tools/qrperf.mjs --check   fingerprints only (this is what CI runs)
 *     node tools/qrperf.mjs --record  print a fresh FIXTURES block
 *
 * WHY A FINGERPRINT AND NOT A TEST
 *
 * There is no way to assert that a QR code is "correct" without writing a
 * decoder, and a decoder would be a second implementation of the same
 * specification with its own bugs. What can be asserted cheaply is that the
 * matrix has not changed: a code that scanned on a phone last week and hashes
 * the same today still scans. So each payload below carries the SHA-256 of
 * the finished matrix, recorded from an encoder whose output was scanned with
 * a real camera. An optimisation that changes any of them is a bug, however
 * much faster it is; a deliberate change to the encoder means re-recording
 * with --record and scanning one of them again by hand before you do.
 *
 * The payloads are the shapes this site actually produces — verify.html URLs
 * for the shortest and longest place ids — plus one with accented characters
 * in it, because byte mode encodes UTF-8 and a Sõõr is the sort of thing that
 * would break it quietly. Between them they cover versions 1 to 10, which is
 * everything the encoder can draw.
 *
 * Zero dependencies, like every other tool here: `node tools/qrperf.mjs` runs
 * with nothing installed in front of it.
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* [ payload, expected version, first 16 hex of the matrix hash ] */
const FIXTURES = [
  ['TTB', 1, 'af2e62ca7e878834'],
  ['https://ttb.ee/v?r=pudel', 2, '8ea4fb6e39df66d1'],
  ['https://x.ee/v?r=a&h=1&c=00000', 3, 'f441de1c87c845e0'],
  ['Kohvik "Sõõr" — 15% soodustust, ülemiste keskus', 4, 'bc2ff498fc3f7a0a'],
  ['https://tallinntastebuds.ee/verify.html?r=pudel&h=490123&c=7KQ3M', 5, '5ddb3f2be616f250'],
  ['https://tallinntastebuds.ee/verify.html?r=telliskivi-saslokk&h=490123&c=0ABZ9', 5, '08809c91145dcbec'],
  ['https://tallinntastebuds.pages.dev/verify.html?r=faehlmanni-kohvik&h=999999&c=ZZZZZ', 5, 'd11897bd4cd275b2'],
  ['https://tallinntastebuds.ee/verify.html?r=' + 'a'.repeat(60) + '&h=490123&c=7KQ3M', 7, '899ead0c92281b4b'],
  ['https://tallinntastebuds.ee/verify.html?r=' + 'b'.repeat(130) + '&h=490123&c=7KQ3M', 10, 'eb257ef69343306f']
];

/* The payload the site really draws, over and over: a verify.html URL for a
   place with a middling id. Everything reported as "the pass code" is this. */
const TYPICAL = FIXTURES[4][0];

/* ------------------------------------------------------------ loading qr.js
 * The encoder is a browser file — it hangs itself off `window` and reaches for
 * `document` to build the SVG — so it is run in a context with just enough of
 * a browser in it to be believed. Nothing here touches the file on disk, so
 * what is measured is what ships.
 */
function loadEncoder() {
  const node = () => ({ setAttribute() {}, appendChild() {} });
  const context = {
    window: {},
    document: { createElementNS: node },
    console
  };
  context.globalThis = context;
  createContext(context);
  runInContext(readFileSync(join(ROOT, 'assets', 'qr.js'), 'utf8'), context, { filename: 'assets/qr.js' });
  return context.window.TTBQR;
}

function fingerprint(matrix) {
  const hash = createHash('sha256');
  for (const row of matrix) hash.update(Buffer.from(row));
  return hash.digest('hex').slice(0, 16);
}

/* ------------------------------------------------------------------ running */

const QR = loadEncoder();
const argv = new Set(process.argv.slice(2));

if (argv.has('--record')) {
  /* Prints one line per fixture, in the order they are written above, so the
     third element of each row can be pasted straight in. The payloads stay
     where they are: they are the interesting half, and a tool that rewrites
     them is a tool that can quietly record a hash of the wrong string. */
  FIXTURES.forEach(([text], i) => {
    const m = QR.encode(text);
    console.log(`  fixture ${i}  version ${(m.length - 17) / 4}  '${fingerprint(m)}'`);
  });
  process.exit(0);
}

let failed = 0;

for (const [text, version, expected] of FIXTURES) {
  const label = (text.length > 46 ? text.slice(0, 43) + '…' : text).padEnd(47);
  const matrix = QR.encode(text);
  const got = fingerprint(matrix);
  const drawn = (matrix.length - 17) / 4;

  if (drawn !== version) {
    console.log(`FAIL ${label} version ${drawn}, expected ${version}`);
    failed++;
  } else if (got !== expected) {
    console.log(`FAIL ${label} ${got}, expected ${expected}`);
    failed++;
  } else {
    console.log(`ok   ${label} version ${drawn}  ${got}`);
  }
}

/* The encoder refuses what it cannot draw rather than returning something a
   camera would read as a different URL. */
try {
  QR.encode('x'.repeat(300));
  console.log('FAIL 300 bytes was encoded — it should have thrown');
  failed++;
} catch (e) {
  console.log('ok   ' + 'too long to draw throws'.padEnd(47) + ' ' + String(e.message));
}

if (failed) {
  console.error(`\n${failed} fingerprint${failed === 1 ? '' : 's'} changed. See the note at the top of this file.`);
  process.exit(1);
}

if (argv.has('--check')) process.exit(0);

/* ------------------------------------------------------------------ timing
 * Wall clock on whatever machine this is, which is not the machine that
 * matters — the phone in the restaurant is somewhere between four and eight
 * times slower than a laptop. The number to watch is not the absolute one but
 * whether it moved: this runs on the main thread between the card being
 * cleared and the QR being painted, so every millisecond here is a
 * millisecond of nothing on screen.
 */
function time(label, fn) {
  for (let i = 0; i < 50; i++) fn();          /* let the JIT settle */
  const runs = 300;
  const started = process.hrtime.bigint();
  for (let i = 0; i < runs; i++) fn();
  const each = Number(process.hrtime.bigint() - started) / 1e6 / runs;
  console.log(`  ${label.padEnd(34)} ${each.toFixed(2)} ms   (about ${(each * 6).toFixed(0)} ms on a phone)`);
}

console.log('\ntiming');
time('encode(), the pass code', () => QR.encode(TYPICAL));
time('encode(), the longest code', () => QR.encode(FIXTURES[8][0]));
