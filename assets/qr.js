/* Tallinn Tastebuds — QR encoder.
 *
 * Byte mode, error correction level M, versions 1 to 10. That is enough for
 * a 200-character URL, and the pass URLs are around eighty, so nothing here
 * ever climbs past version 7.
 *
 * Written out rather than pulled from a CDN for the same reason the rest of
 * this site has no build step: a phone in a restaurant cellar with one bar of
 * signal should not have to reach a third party to draw a square. It is the
 * one piece of real algorithm in the repo — ISO/IEC 18004, the parts of it
 * that byte mode needs — so it is commented as such.
 *
 * Exposes one function:
 *   TTBQR.svg(text, { quiet: 4 })  ->  an <svg> element, sized in modules
 */
window.TTBQR = (function () {
  'use strict';

  /* ------------------------------------------------------------ the tables
   * Everything below is level M only. Each row is
   *   [ error correction codewords per block, blocks in group 1,
   *     data codewords per group-1 block, blocks in group 2,
   *     data codewords per group-2 block ]
   * indexed by version - 1. Group 2 is empty for most versions; where it is
   * not, its blocks hold exactly one codeword more than group 1's.
   */
  var ECC_M = [
    [10, 1, 16, 0, 0],
    [16, 1, 28, 0, 0],
    [26, 1, 44, 0, 0],
    [18, 2, 32, 0, 0],
    [24, 2, 43, 0, 0],
    [16, 4, 27, 0, 0],
    [18, 4, 31, 0, 0],
    [22, 2, 38, 2, 39],
    [22, 3, 36, 2, 37],
    [26, 4, 43, 1, 44]
  ];

  /* Row and column centres of the alignment patterns, per version. Version 1
     has none: the three finders are enough to fix a 21x21 grid. */
  var ALIGN = [
    [], [6, 18], [6, 22], [6, 26], [6, 30],
    [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]
  ];

  /* ------------------------------------------------------------- GF(256)
   * Reed-Solomon works over the field defined by the primitive polynomial
   * 0x11D. Two lookup tables turn multiplication into an addition of
   * logarithms, which is the whole trick.
   */
  var EXP = new Uint8Array(512);
  var LOG = new Uint8Array(256);
  (function buildTables() {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;   /* stay inside the field */
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  }());

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  /* The generator polynomial for n check codewords is the product of
     (x - 2^i) for i below n. Coefficients come back highest power first. */
  function generatorPoly(n) {
    var poly = [1];
    for (var i = 0; i < n; i++) {
      var next = new Array(poly.length + 1);
      for (var k = 0; k < next.length; k++) next[k] = 0;
      for (var j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  /* Polynomial long division: the remainder is the error correction block. */
  function eccBlock(data, ecLen) {
    var gen = generatorPoly(ecLen);
    var rem = new Array(ecLen);
    for (var i = 0; i < ecLen; i++) rem[i] = 0;

    for (var d = 0; d < data.length; d++) {
      var factor = data[d] ^ rem[0];
      rem.shift();
      rem.push(0);
      for (var j = 0; j < ecLen; j++) rem[j] ^= gfMul(gen[j + 1], factor);
    }
    return rem;
  }

  /* ---------------------------------------------------------- the bitstream
   * Mode indicator, length, the bytes themselves, a terminator, then the two
   * pad codewords alternating until the version's data capacity is full.
   */
  function utf8Bytes(text) {
    var out = [];
    var encoded = unescape(encodeURIComponent(String(text)));
    for (var i = 0; i < encoded.length; i++) out.push(encoded.charCodeAt(i) & 0xff);
    return out;
  }

  function dataCapacity(version) {
    var spec = ECC_M[version - 1];
    return spec[1] * spec[2] + spec[3] * spec[4];
  }

  function pickVersion(byteLen) {
    for (var v = 1; v <= 10; v++) {
      /* 4 bits of mode + the character count field + the payload itself */
      var countBits = v < 10 ? 8 : 16;
      var needed = Math.ceil((4 + countBits + byteLen * 8) / 8);
      if (needed <= dataCapacity(v)) return v;
    }
    return 0;   /* longer than this encoder goes */
  }

  function buildData(bytes, version) {
    var bits = [];
    function push(value, length) {
      for (var i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
    }

    push(0x4, 4);                                  /* byte mode */
    push(bytes.length, version < 10 ? 8 : 16);
    for (var i = 0; i < bytes.length; i++) push(bytes[i], 8);

    var capacityBits = dataCapacity(version) * 8;
    /* Terminator: up to four zeroes, fewer if the stream is nearly full. */
    var terminator = Math.min(4, capacityBits - bits.length);
    for (var t = 0; t < terminator; t++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    var codewords = [];
    for (var b = 0; b < bits.length; b += 8) {
      var byteVal = 0;
      for (var k = 0; k < 8; k++) byteVal = (byteVal << 1) | bits[b + k];
      codewords.push(byteVal);
    }
    var pads = [0xec, 0x11];
    for (var p = 0; codewords.length < dataCapacity(version); p++) {
      codewords.push(pads[p % 2]);
    }
    return codewords;
  }

  /* Data blocks are interleaved codeword by codeword, then every error
     correction block follows in the same order. A scanner that loses a whole
     corner therefore loses a little of each block rather than all of one. */
  function interleave(codewords, version) {
    var spec = ECC_M[version - 1];
    var ecLen = spec[0];
    var blocks = [];
    var at = 0;
    var g;

    for (g = 0; g < spec[1]; g++) blocks.push(codewords.slice(at, at += spec[2]));
    for (g = 0; g < spec[3]; g++) blocks.push(codewords.slice(at, at += spec[4]));

    var eccs = blocks.map(function (block) { return eccBlock(block, ecLen); });

    var longest = 0;
    blocks.forEach(function (b) { if (b.length > longest) longest = b.length; });

    var out = [];
    var i, j;
    for (i = 0; i < longest; i++) {
      for (j = 0; j < blocks.length; j++) if (i < blocks[j].length) out.push(blocks[j][i]);
    }
    for (i = 0; i < ecLen; i++) {
      for (j = 0; j < eccs.length; j++) out.push(eccs[j][i]);
    }
    return out;
  }

  /* ------------------------------------------------------------ the matrix */

  /* Every cell starts light. Some versions leave a handful of remainder
     modules that no codeword ever reaches, and light is what the
     specification says they stay; `reserved` is what tracks function
     patterns, so the matrix itself needs no third state. */
  function makeMatrix(size) {
    var m = [];
    for (var r = 0; r < size; r++) m.push(new Int8Array(size));
    return m;
  }

  function drawFunctionPatterns(m, reserved, version) {
    var size = m.length;
    var i, j;

    function set(r, c, dark) {
      if (r < 0 || c < 0 || r >= size || c >= size) return;
      m[r][c] = dark ? 1 : 0;
      reserved[r][c] = 1;
    }

    /* Three finders, each with its one-module separator. */
    function finder(top, left) {
      for (var r = -1; r <= 7; r++) {
        for (var c = -1; c <= 7; c++) {
          var edge = Math.max(Math.abs(r - 3), Math.abs(c - 3));
          set(top + r, left + c, edge !== 2 && edge <= 3);
        }
      }
    }
    finder(0, 0);
    finder(0, size - 7);
    finder(size - 7, 0);

    /* Timing: the alternating row and column that tells a scanner the pitch. */
    for (i = 8; i < size - 8; i++) {
      set(6, i, i % 2 === 0);
      set(i, 6, i % 2 === 0);
    }

    /* Alignment patterns, at every pairing of the version's centres except
       the three that would sit on top of a finder. */
    var centres = ALIGN[version - 1];
    for (i = 0; i < centres.length; i++) {
      for (j = 0; j < centres.length; j++) {
        var corner = (i === 0 && j === 0) ||
                     (i === 0 && j === centres.length - 1) ||
                     (i === centres.length - 1 && j === 0);
        if (corner) continue;
        for (var dr = -2; dr <= 2; dr++) {
          for (var dc = -2; dc <= 2; dc++) {
            set(centres[i] + dr, centres[j] + dc,
                Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
          }
        }
      }
    }

    /* The format areas are reserved now and written once the mask is chosen. */
    for (i = 0; i <= 8; i++) {
      if (i !== 6) { reserved[8][i] = 1; reserved[i][8] = 1; }
    }
    for (i = 0; i < 8; i++) {
      reserved[8][size - 1 - i] = 1;
      reserved[size - 1 - i][8] = 1;
    }
    reserved[8][6] = 1;
    reserved[6][8] = 1;
    set(size - 8, 8, true);        /* the dark module, always set */

    /* Version information, two 3x6 blocks, from version 7 up. */
    if (version >= 7) {
      var rem = version;
      for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      var bits = (version << 12) | rem;
      for (i = 0; i < 18; i++) {
        var bit = ((bits >>> i) & 1) === 1;
        var a = Math.floor(i / 3);
        var b = size - 11 + (i % 3);
        set(b, a, bit);
        set(a, b, bit);
      }
    }
  }

  /* The fifteen format bits — two bits of error correction level, three of
     mask, ten of BCH check — are written twice, so a code with one corner
     torn off still says how to read itself. The two copies do not run in the
     same direction, and neither is simply "along row 8", which is why the
     positions are spelled out here as the specification tabulates them:
     most significant bit first, in (row, column) pairs. */
  function formatCells(size) {
    return [
      /* Around the top-left finder: left to right along row 8, then bottom
         to top up column 8, stepping over the timing module at (8, 6). */
      [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
       [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]],
      /* And the split copy: seven modules climbing the column above the
         bottom-left finder, then eight running right along row 8 beside the
         top-right one. The column stops one short of the dark module. */
      [[size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8],
       [size - 5, 8], [size - 6, 8], [size - 7, 8],
       [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5],
       [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1]]
    ];
  }

  function drawFormat(m, reserved, mask) {
    var size = m.length;
    /* Level M is 0b00, so the five data bits are just the mask number. */
    var data = mask;
    var rem = data;
    for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    var bits = ((data << 10) | rem) ^ 0x5412;

    formatCells(size).forEach(function (copy) {
      copy.forEach(function (cell, index) {
        /* index 0 is the most significant of the fifteen. */
        m[cell[0]][cell[1]] = (bits >>> (14 - index)) & 1;
      });
    });
  }

  function maskAt(mask, r, c) {
    switch (mask) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return (r * c) % 2 + (r * c) % 3 === 0;
      case 6: return ((r * c) % 2 + (r * c) % 3) % 2 === 0;
      default: return ((r + c) % 2 + (r * c) % 3) % 2 === 0;
    }
  }

  function placeData(m, reserved, codewords) {
    var size = m.length;
    var bit = 0;
    var total = codewords.length * 8;

    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;          /* step over the timing column */
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var c = right - j;
          var upward = ((right + 1) & 2) === 0;
          var r = upward ? size - 1 - vert : vert;
          if (!reserved[r][c] && bit < total) {
            m[r][c] = (codewords[bit >>> 3] >>> (7 - (bit & 7))) & 1;
            bit++;
          }
        }
      }
    }
  }

  /* ---------------------------------------------------------- mask scoring
   * Four penalty rules from the specification. The mask with the lowest total
   * is the one that gets written, because it is the one least likely to be
   * confused with a finder pattern or to leave a scanner without contrast.
   */
  function penalty(m) {
    var size = m.length;
    var score = 0;
    var r, c, i, j, v;

    /* Rule 1 — runs of five or more in a row or a column. Rows and columns are
       counted in the same pass: the work is identical either way round, and
       one walk of the matrix is cheaper than two. */
    for (i = 0; i < size; i++) {
      var row = m[i];
      var rowRun = 1, rowColour = row[0];
      var colRun = 1, colColour = m[0][i];
      for (j = 1; j < size; j++) {
        v = row[j];
        if (v === rowColour) {
          rowRun++;
          if (rowRun === 5) score += 3; else if (rowRun > 5) score += 1;
        } else { rowColour = v; rowRun = 1; }

        v = m[j][i];
        if (v === colColour) {
          colRun++;
          if (colRun === 5) score += 3; else if (colRun > 5) score += 1;
        } else { colColour = v; colRun = 1; }
      }
    }

    /* Rule 2 — every 2x2 block of one colour. */
    for (r = 0; r < size - 1; r++) {
      var top = m[r], below = m[r + 1];
      for (c = 0; c < size - 1; c++) {
        var v0 = top[c];
        if (v0 === top[c + 1] && v0 === below[c] && v0 === below[c + 1]) score += 3;
      }
    }

    /* Rule 3 — the 1:1:3:1:1 finder signature appearing in the data, either
       way round, with four light modules on one side. Rather than compare
       eleven modules at every position, the last eleven are carried along as
       the low bits of an integer: shift one in, mask to eleven bits, and the
       comparison is against two constants. Reading it as a number puts the
       earliest module in the highest bit, which is the order the pattern is
       written in below. */
    var A = 0x5D0;   /* 10111010000 */
    var B = 0x05D;   /* 00001011101 */
    var WINDOW = 0x7FF;
    for (i = 0; i < size; i++) {
      var across = 0, down = 0;
      var scanned = m[i];
      for (j = 0; j < size; j++) {
        across = ((across << 1) | scanned[j]) & WINDOW;
        down = ((down << 1) | m[j][i]) & WINDOW;
        if (j >= 10) {
          if (across === A || across === B) score += 40;
          if (down === A || down === B) score += 40;
        }
      }
    }

    /* Rule 4 — how far the proportion of dark modules strays from half. */
    var dark = 0;
    for (r = 0; r < size; r++) {
      var counted = m[r];
      for (c = 0; c < size; c++) if (counted[c]) dark++;
    }
    var percent = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(percent - 50) / 5) * 10;

    return score;
  }

  /* ------------------------------------------------------------------ API */

  function encode(text) {
    var bytes = utf8Bytes(text);
    var version = pickVersion(bytes.length);
    if (!version) throw new Error('TTBQR: ' + bytes.length + ' bytes is too long');

    var codewords = interleave(buildData(bytes, version), version);
    var size = version * 4 + 17;

    /* The finders, the timing lines, the alignment patterns and the data sit
       in the same places whichever mask wins, so they are drawn once and each
       candidate is a copy of that board with a mask laid over it. Drawing
       them eight times over — once per mask, only to throw seven away — was
       most of what this function used to spend its time on, and this is the
       page where that time is a guest holding a phone up at a till. */
    var base = makeMatrix(size);
    var reserved = makeMatrix(size);
    drawFunctionPatterns(base, reserved, version);
    placeData(base, reserved, codewords);

    var candidate = makeMatrix(size);
    var best = null;
    var bestScore = Infinity;
    var r, c;

    for (var mask = 0; mask < 8; mask++) {
      for (r = 0; r < size; r++) {
        var row = candidate[r];
        var keep = reserved[r];
        row.set(base[r]);
        for (c = 0; c < size; c++) if (!keep[c] && maskAt(mask, r, c)) row[c] ^= 1;
      }
      drawFormat(candidate, reserved, mask);

      var score = penalty(candidate);
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
        /* The winner is kept as it stands, so the next mask needs somewhere
           else to be drawn. Nothing is allocated for a mask that loses. */
        candidate = makeMatrix(size);
      }
    }
    return best;
  }

  /* One <path> for every dark module rather than one <rect> each: a version 7
     code is nearly a thousand squares, and a thousand elements is a scroll
     that stutters on the phone this is meant to be held up on. */
  function svg(text, opts) {
    var options = opts || {};
    var quiet = options.quiet === undefined ? 4 : options.quiet;
    var m = encode(text);
    var size = m.length;
    var span = size + quiet * 2;

    var d = [];
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        if (m[r][c]) d.push('M' + (c + quiet) + ' ' + (r + quiet) + 'h1v1h-1z');
      }
    }

    var ns = 'http://www.w3.org/2000/svg';
    var node = document.createElementNS(ns, 'svg');
    node.setAttribute('viewBox', '0 0 ' + span + ' ' + span);
    node.setAttribute('shape-rendering', 'crispEdges');
    node.setAttribute('aria-hidden', 'true');
    node.setAttribute('focusable', 'false');

    var bg = document.createElementNS(ns, 'rect');
    bg.setAttribute('width', String(span));
    bg.setAttribute('height', String(span));
    bg.setAttribute('fill', options.light || '#ffffff');
    node.appendChild(bg);

    var path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d.join(''));
    path.setAttribute('fill', options.dark || '#000000');
    node.appendChild(path);

    return node;
  }

  return { svg: svg, encode: encode };
}());
