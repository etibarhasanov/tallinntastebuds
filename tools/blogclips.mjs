#!/usr/bin/env node
/**
 * Tallinn Tastebuds — the blog's clips.
 *
 * Every post on /blog carries a short looping picture of the thing it is
 * about: the bookmark being pressed and the count going up, a chip narrowing
 * the list, a question typed into the chat and the answer arriving. This is
 * what makes them.
 *
 * Each scene is drawn twice, once in each style, because a clip is a picture
 * of the site and the site is two colour worlds — a light card looping in the
 * middle of a dark page is the one thing this site will not do. That is four
 * files a post: <id>.png and <id>-still.png, and the same two again with
 * -green in the middle.
 *
 * A clip is an **animated PNG**, which is the thing people mean when they say
 * "a GIF" and is better at being one: truecolour instead of 256, no dithering
 * on a photograph of a page that is mostly flat fill, and every browser since
 * 2017 plays it from a plain <img> with no script, no autoplay policy to fight
 * and no poster to ship. The still beside it — <id>-still.png — is the first
 * frame, and assets/blog.js serves it instead through a <picture> to anybody
 * who asked their machine for less motion. That is the twelfth design rule,
 * and it is the only answer available: nothing can pause an APNG.
 *
 * WHERE THE PIXELS COME FROM
 *
 * clips/scenes/<post-id>.html, opened in headless Chromium. A scene is not a
 * recording of the site — it is the site's own stylesheets, tokens and class
 * names, arranged into the one interaction the post is about and driven by a
 * pure function of time, so frame 31 is frame 31 whoever renders it and
 * however long their machine took. clips/README.md is the whole of how
 * to write one.
 *
 * One launch per frame, which is a second of Chromium each and the reason a
 * clip takes half a minute to draw. The obvious saving — lay eighteen moments
 * of the scene out as a grid and take one screenshot of the lot — was tried
 * and taken out again: a card's shadow and the pointer's are blurs, and a
 * blur is sampled against the page rather than against the element, so the
 * same still frame drawn at the top of a grid and again halfway down it comes
 * back different by as much as a tenth of a channel. Invisible to a reader,
 * and fatal here: every frame then counts as changed, nothing collapses, and
 * a four-second clip is two megabytes instead of a hundred kilobytes. At one
 * frame a launch the page is at the same coordinates every time, a still beat
 * is identical to the byte, and the arithmetic below can be exact rather than
 * a tolerance somebody has to tune.
 *
 * WHY THERE IS NO ENCODER IN HERE
 *
 * Because an APNG is a PNG with more chunks in it, and node:zlib is already
 * in the standard library. The frames are decoded, diffed, and the part that
 * actually changed between one and the next is written as an fdAT the size of
 * that rectangle — which on a clip where a cursor crosses a still panel is a
 * few kilobytes rather than the ninety a whole frame costs. Frames identical
 * to the one before do not get written at all; their time is added to the
 * delay of the frame they repeat, so a beat that holds for a second is one
 * frame with a one-second delay. Between the two, a four-second clip lands
 * near a hundred kilobytes.
 *
 * Zero dependencies, like every other tool here. What it needs from outside
 * is a Chromium to take the shots:
 *
 *     CHROME=/path/to/chrome node tools/blogclips.mjs
 *     node tools/blogclips.mjs --only a-save-is-free-and-the-number-is-other-people
 *     node tools/blogclips.mjs --check     what is stale, without writing
 *
 * It looks for a browser in CHROME, then CHROMIUM, then the usual names on
 * the PATH. tools/storymedia.mjs leans on ffmpeg the same way and says so in
 * the same place.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { deflateSync, inflateSync, crc32 } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCENES = join(ROOT, 'clips', 'scenes');
const OUT = join(ROOT, 'clips');

/* Twelve a second. A cursor crossing a card at twelve is smooth enough that
   nobody counts the steps, and every frame past that is bytes spent on
   something a reader is not looking for. */
const FPS = 12;

/* How many Chromium launches run at once. A launch is mostly waiting — for a
   process to start and for a webfont to arrive — so a handful in parallel is
   four times the work in the same minute, and more than this only makes a
   laptop's fans louder. */
const LANES = 4;

/* Two device pixels per CSS pixel, so the clip is still sharp on the phone it
   is mostly read on. */
const SCALE = 2;

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const check = args.includes('--check');

/* ------------------------------------------------------------------- PNG
   Enough of the format to read what Chromium writes and to write what a
   browser will play: eight bits a channel, no interlacing, RGB or RGBA. */

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(type, body) {
  const out = Buffer.alloc(body.length + 12);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, 'ascii');
  body.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), body])) >>> 0, body.length + 8);
  return out;
}

function readPng(buf) {
  if (!buf.subarray(0, 8).equals(PNG_MAGIC)) throw new Error('not a PNG');

  let width = 0, height = 0, depth = 0, colour = 0;
  const idat = [];

  for (let at = 8; at < buf.length;) {
    const len = buf.readUInt32BE(at);
    const type = buf.toString('ascii', at + 4, at + 8);
    const body = buf.subarray(at + 8, at + 8 + len);

    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      colour = body[9];
      if (depth !== 8 || (colour !== 2 && colour !== 6) || body[12] !== 0) {
        throw new Error(`unsupported PNG: depth ${depth}, colour ${colour}, interlace ${body[12]}`);
      }
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(body));
    } else if (type === 'IEND') {
      break;
    }
    at += len + 12;
  }

  const channels = colour === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rgba = Buffer.alloc(width * height * 4);
  const line = Buffer.alloc(stride);
  const prev = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    raw.copy(line, 0, y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    unfilter(filter, line, prev, channels);

    for (let x = 0; x < width; x++) {
      const from = x * channels;
      const to = (y * width + x) * 4;
      rgba[to] = line[from];
      rgba[to + 1] = line[from + 1];
      rgba[to + 2] = line[from + 2];
      rgba[to + 3] = channels === 4 ? line[from + 3] : 255;
    }
    line.copy(prev);
  }

  return { width, height, rgba };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function unfilter(type, line, prev, bpp) {
  if (type === 0) return;
  for (let i = 0; i < line.length; i++) {
    const a = i >= bpp ? line[i - bpp] : 0;
    const b = prev[i];
    const c = i >= bpp ? prev[i - bpp] : 0;
    if (type === 1) line[i] = (line[i] + a) & 255;
    else if (type === 2) line[i] = (line[i] + b) & 255;
    else if (type === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
    else if (type === 4) line[i] = (line[i] + paeth(a, b, c)) & 255;
    else throw new Error(`unknown PNG filter ${type}`);
  }
}

/* The five filters a row may be written with, scored the way libpng scores
   them — the sum of the bytes read as signed — and the cheapest one wins. It
   is the difference between a clip that is a hundred kilobytes and one that is
   three hundred, for twenty lines. */
function filterRow(row, prev, bpp) {
  const n = row.length;
  const out = [];

  for (let type = 0; type < 5; type++) {
    const line = Buffer.alloc(n + 1);
    line[0] = type;
    let score = 0;
    for (let i = 0; i < n; i++) {
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v;
      if (type === 0) v = row[i];
      else if (type === 1) v = row[i] - a;
      else if (type === 2) v = row[i] - b;
      else if (type === 3) v = row[i] - ((a + b) >> 1);
      else v = row[i] - paeth(a, b, c);
      v &= 255;
      line[i + 1] = v;
      score += v < 128 ? v : 256 - v;
    }
    out.push({ line, score });
  }

  out.sort((x, y) => x.score - y.score);
  return out[0].line;
}

/* A rectangle of RGBA out of a frame, deflated as PNG image data. This is the
   body of an IDAT and of every fdAT after it. */
function imageData(rgba, canvasW, x, y, w, h) {
  const rows = [];
  const prev = Buffer.alloc(w * 4);
  for (let row = 0; row < h; row++) {
    const line = Buffer.alloc(w * 4);
    for (let col = 0; col < w; col++) {
      rgba.copy(line, col * 4, ((y + row) * canvasW + (x + col)) * 4, ((y + row) * canvasW + (x + col)) * 4 + 4);
    }
    rows.push(filterRow(line, prev, 4));
    line.copy(prev);
  }
  return deflateSync(Buffer.concat(rows), { level: 9 });
}

function ihdr(w, h) {
  const body = Buffer.alloc(13);
  body.writeUInt32BE(w, 0);
  body.writeUInt32BE(h, 4);
  body[8] = 8;    // bit depth
  body[9] = 6;    // RGBA
  return chunk('IHDR', body);
}

function writePng(frame) {
  return Buffer.concat([
    PNG_MAGIC,
    ihdr(frame.width, frame.height),
    chunk('IDAT', imageData(frame.rgba, frame.width, 0, 0, frame.width, frame.height)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* What actually changed between two frames, as the smallest rectangle holding
   all of it — or null when nothing did, which is how a held beat becomes one
   frame with a long delay instead of twelve identical ones. */
function dirtyRect(before, after, w, h) {
  let top = h, left = w, right = -1, bottom = -1;

  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    if (before.compare(after, row, row + w * 4, row, row + w * 4) === 0) continue;
    for (let x = 0; x < w; x++) {
      const at = row + x * 4;
      if (before.readUInt32BE(at) === after.readUInt32BE(at)) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }

  if (bottom < 0) return null;
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

/* The frames, the rectangles and the delays, as a file a browser loops for
   ever. acTL says how many and how often; every frame gets an fcTL saying
   where it goes and how long it stands, and the ones after the first ride in
   an fdAT rather than an IDAT because the first frame is also the still
   picture anything that cannot play it will show. */
function assembleApng(frames, w, h) {
  const parts = [PNG_MAGIC, ihdr(w, h)];

  const actl = Buffer.alloc(8);
  actl.writeUInt32BE(frames.length, 0);
  actl.writeUInt32BE(0, 4);            // play for ever
  parts.push(chunk('acTL', actl));

  let seq = 0;

  frames.forEach((frame, i) => {
    const fctl = Buffer.alloc(26);
    fctl.writeUInt32BE(seq++, 0);
    fctl.writeUInt32BE(frame.w, 4);
    fctl.writeUInt32BE(frame.h, 8);
    fctl.writeUInt32BE(frame.x, 12);
    fctl.writeUInt32BE(frame.y, 16);
    fctl.writeUInt16BE(frame.delay, 20);
    fctl.writeUInt16BE(1000, 22);      // delays are milliseconds
    fctl[24] = 0;                      // leave the canvas as it is
    fctl[25] = 0;                      // and write straight over it
    parts.push(chunk('fcTL', fctl));

    if (i === 0) {
      parts.push(chunk('IDAT', frame.data));
    } else {
      const fdat = Buffer.alloc(frame.data.length + 4);
      fdat.writeUInt32BE(seq++, 0);
      frame.data.copy(fdat, 4);
      parts.push(chunk('fdAT', fdat));
    }
  });

  parts.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

/* ---------------------------------------------------------------- Chromium */

function findChrome() {
  const named = [process.env.CHROME, process.env.CHROMIUM].filter(Boolean);
  for (const path of named) if (existsSync(path)) return path;

  const guesses = [
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ];
  for (const path of guesses) if (existsSync(path)) return path;

  const browsers = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (browsers && existsSync(browsers)) {
    for (const entry of readdirSync(browsers)) {
      for (const tail of ['chrome-linux/headless_shell', 'chrome-linux/chrome']) {
        const path = join(browsers, entry, tail);
        if (existsSync(path)) return path;
      }
    }
  }

  throw new Error('no Chromium found — set CHROME=/path/to/chrome');
}

/* One frame: the scene frozen at a millisecond, at the top left of a window
   the size of the clip. */
function shoot(chrome, scene, ms, shot, style) {
  return new Promise((done, fail) => {
    execFile(chrome, [
      '--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
      `--force-device-scale-factor=${SCALE}`,
      `--window-size=${scene.w},${scene.h}`,
      /* Long enough for the webfonts to arrive and for the page to settle.
         Everything a scene draws is a pure function of time, so there is no
         animation still running that this could cut short. */
      '--virtual-time-budget=12000',
      `--screenshot=${shot}`,
      `file://${scene.file}?t=${ms}${style ? '&style=' + style : ''}`
    ], { stdio: ['ignore', 'ignore', 'ignore'] }, (err) => (err ? fail(err) : done()));
  });
}

/* Every frame of a scene, a few launches at a time. */
async function shootAll(chrome, scene, work, style) {
  const step = 1000 / FPS;
  const total = Math.round((scene.ms / 1000) * FPS);
  const shots = new Array(total);
  let next = 0;

  async function lane() {
    for (let i = next++; i < total; i = next++) {
      const path = join(work, `${scene.id}-${style || 'red'}-${i}.png`);
      await shoot(chrome, scene, Math.round(i * step), path, style);
      shots[i] = readPng(readFileSync(path));
      rmSync(path, { force: true });
    }
  }

  await Promise.all(Array.from({ length: Math.min(LANES, total) }, lane));
  return shots;
}

/* ------------------------------------------------------------------ scenes */

/* A scene says how long it runs and how big it is, in one meta tag, because
   the tool has to know both before it can ask for a single frame. */
function readScene(id) {
  const file = join(SCENES, `${id}.html`);
  const html = readFileSync(file, 'utf8');
  const meta = /<meta\s+name="clip"\s+content="([^"]+)"/.exec(html);
  if (!meta) throw new Error(`${id}.html has no <meta name="clip">`);

  const said = {};
  for (const pair of meta[1].split(';')) {
    const [key, value] = pair.split('=').map((s) => s.trim());
    if (key) said[key] = Number(value);
  }
  if (!said.ms || !said.w || !said.h) throw new Error(`${id}.html: clip needs ms, w and h`);
  return { id, file, ms: said.ms, w: said.w, h: said.h };
}

async function build(chrome, scene, work, style) {
  const shots = await shootAll(chrome, scene, work, style);
  const { width, height } = shots[0];
  const step = Math.round(1000 / FPS);
  const frames = [];

  shots.forEach((frame, i) => {
    if (i === 0) {
      frames.push({
        x: 0, y: 0, w: width, h: height, delay: step,
        data: imageData(frame.rgba, width, 0, 0, width, height)
      });
      return;
    }

    const rect = dirtyRect(shots[i - 1].rgba, frame.rgba, width, height);
    if (!rect) {
      /* Nothing moved: the beat is holding, so the frame before it stands for
         a step longer rather than this one being written at all. */
      frames[frames.length - 1].delay += step;
      return;
    }

    frames.push({
      x: rect.x, y: rect.y, w: rect.w, h: rect.h, delay: step,
      data: imageData(frame.rgba, width, rect.x, rect.y, rect.w, rect.h)
    });
  });

  return {
    clip: assembleApng(frames, width, height),
    still: writePng(shots[0]),
    frames: frames.length,
    sampled: shots.length
  };
}

/* --------------------------------------------------------------------- run */

const ids = readdirSync(SCENES)
  .filter((name) => name.endsWith('.html'))
  .map((name) => name.replace(/\.html$/, ''))
  .filter((id) => !only || id === only)
  .sort();

if (ids.length === 0) {
  console.log(only ? `No scene called ${only}.` : 'No scenes in clips/scenes/.');
  process.exit(only ? 1 : 0);
}

/* The four files one scene is drawn into: the clip and its first frame, in
   each of the two styles. */
function wanted(id) {
  return [`${id}.png`, `${id}-still.png`, `${id}-green.png`, `${id}-green-still.png`];
}

if (check) {
  let stale = 0;
  for (const id of ids) {
    for (const want of wanted(id)) {
      if (!existsSync(join(OUT, want))) {
        console.log(`  missing  clips/${want} — run \`node tools/blogclips.mjs --only ${id}\``);
        stale++;
      }
    }
  }
  console.log(stale ? `\n${stale} file${stale === 1 ? '' : 's'} missing.` : `${ids.length} scenes, every clip drawn.`);
  process.exit(stale ? 1 : 0);
}

const chrome = findChrome();
const work = join(tmpdir(), `ttb-clips-${process.pid}`);
mkdirSync(work, { recursive: true });
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

try {
  const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

  for (const id of ids) {
    const scene = readScene(id);
    console.log(id);

    for (const style of ['', 'green']) {
      const made = await build(chrome, scene, work, style);
      const stem = style ? `${id}-${style}` : id;
      writeFileSync(join(OUT, `${stem}.png`), made.clip);
      writeFileSync(join(OUT, `${stem}-still.png`), made.still);
      console.log(
        `  ${(style || 'red').padEnd(5)} ${made.sampled} frames sampled, ` +
        `${made.frames} written, ${kb(made.clip.length)} clip and ${kb(made.still.length)} still`
      );
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
