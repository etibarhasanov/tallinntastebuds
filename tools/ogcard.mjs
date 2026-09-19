#!/usr/bin/env node
/**
 * Tallinn Tastebuds — the share card for the flashcards.
 *
 * assets/logo/og-flashcard.html into assets/logo/og-flashcard.png, at the
 * 1200x630 every unfurler crops from. The head of that file says what is on
 * the card and why it is that card rather than the mouth; this only draws it.
 *
 * WHY A TOOL AND NOT A SENTENCE IN A README
 *
 * og.jpg has no tool and wants none: it is a crop of a photograph, and
 * assets/logo/README.md says which pixels. This card is different in the one
 * way that matters — it is drawn from the site's own stylesheets, so it goes
 * stale on its own. A token moves, .flash-card gets a corner it did not have,
 * the display face is swapped: none of that touches this file and all of it
 * changes the picture. Redrawing has to be one command, and it has to be the
 * same command every time, because four of the flags below are load-bearing
 * and a person retyping them from memory would drop one.
 *
 *     node tools/ogcard.mjs
 *     CHROME=/path/to/chrome node tools/ogcard.mjs
 *
 * Zero dependencies, like every other tool here. What it needs from outside is
 * a Chromium to take the shot, found the way tools/blogclips.mjs finds one —
 * CHROME, then CHROMIUM, then the usual names, then whatever Playwright
 * unpacked under PLAYWRIGHT_BROWSERS_PATH.
 *
 * THE FLAGS
 *
 * --window-size is the card and --force-device-scale-factor is 1, so the shot
 * is 1200x630 to the pixel and nothing downstream has to resample it.
 * --hide-scrollbars keeps the browser's own furniture off a picture that is
 * exactly the size of its content. And --virtual-time-budget is the one that
 * decides whether this works at all: the three faces come from Google Fonts
 * over the network, the stylesheet asks for them with display=block so that
 * nothing paints in a fallback, and a screenshot taken before they arrive is a
 * card in Helvetica. Twelve seconds is what a scene is given for the same
 * reason.
 *
 * A PNG and not a JPEG, which is what Chromium writes and is right anyway:
 * the card is flat fill and type, which is the case PNG is good at and the
 * case a JPEG puts a haze of artefacts around. og.jpg is a photograph and
 * stays a JPEG.
 */

import { execFile } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'assets/logo/og-flashcard.html');
const SHOT = join(ROOT, 'assets/logo/og-flashcard.png');
const W = 1200;
const H = 630;

/* Where a Chromium is, in the order tools/blogclips.mjs looks. Said twice
   rather than imported, because that file is a clip encoder with a browser
   in it and this is four lines that need a browser: importing it would pull a
   PNG decoder, an APNG writer and a frame differ into a tool that screenshots
   one page. */
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

function shoot(chrome) {
  return new Promise((done, fail) => {
    execFile(chrome, [
      '--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${W},${H}`,
      '--virtual-time-budget=12000',
      `--screenshot=${SHOT}`,
      `file://${SOURCE}`
    ], { stdio: ['ignore', 'ignore', 'ignore'] }, (err) => (err ? fail(err) : done()));
  });
}

if (!existsSync(SOURCE)) {
  console.error('assets/logo/og-flashcard.html is missing');
  process.exit(1);
}

await shoot(findChrome());
console.log(`assets/logo/og-flashcard.png — ${W}x${H}`);
