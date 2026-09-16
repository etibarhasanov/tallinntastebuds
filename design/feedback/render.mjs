#!/usr/bin/env node
/**
 * Draws the feedback mockups to PNG — see README.md beside this file.
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node design/feedback/render.mjs
 *
 * from the repo root. Serves the repository over HTTP (the pages link the
 * site's real stylesheets by relative path, and fetch() refuses file://),
 * opens each template in Playwright's Chromium at 390px and on a desk, in
 * both styles and in every state, and writes the pictures plus three composed
 * sheets into design/feedback/shots/, which .gitignore keeps out of git.
 *
 * Playwright is not a dependency of this repository — there is no
 * package.json and never will be — so it is taken from wherever NODE_PATH
 * says, which in the web environment is the global install beside Chromium.
 *
 * TTB_FONTS, optional: a folder holding Google Fonts' stylesheet for the three
 * faces as local.css with its font URLs rewritten to f<N>.woff2 files beside
 * it. With it set, every request to Google Fonts is answered from that
 * folder, for a browser that cannot reach fonts.googleapis.com; without it
 * the page loads the faces from Google as the site does.
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const OUT = join(HERE, 'shots');
const FONTS = process.env.TTB_FONTS ? resolve(process.env.TTB_FONTS) : null;
const PORT = 8123;
mkdirSync(OUT, { recursive: true });

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));

const PHONE = { width: 390, height: 844 };
const DESK = { width: 1280, height: 860 };

const url = (t, state, style) =>
  `http://127.0.0.1:${PORT}/design/feedback/${t}.html?state=${state}&style=${style}`;

/* template, state, style, viewport, whole page or the first screen, name */
const SHOTS = [
  ['a-directory', 'in', 'red', PHONE, false, 'a-phone-fold'],
  ['a-directory', 'in', 'red', PHONE, true, 'a-phone'],
  ['a-directory', 'in', 'green', PHONE, true, 'a-phone-green'],
  ['a-directory', 'in', 'red', DESK, true, 'a-desk'],
  ['a-directory', 'in', 'green', DESK, true, 'a-desk-green'],
  ['b-guestbook', 'in', 'red', PHONE, false, 'b-phone-fold'],
  ['b-guestbook', 'in', 'red', PHONE, true, 'b-phone'],
  ['b-guestbook', 'in', 'green', PHONE, true, 'b-phone-green'],
  ['b-guestbook', 'in', 'red', DESK, true, 'b-desk'],
  ['c-sheet', 'in', 'red', PHONE, false, 'c-phone-fold'],
  ['c-sheet', 'in', 'red', PHONE, true, 'c-phone'],
  ['c-sheet', 'in', 'green', PHONE, true, 'c-phone-green'],
  ['c-sheet', 'in', 'red', DESK, true, 'c-desk'],
  ['c-sheet', 'sheet', 'red', PHONE, false, 'c-sheet-phone'],
  ['c-sheet', 'sheet', 'green', PHONE, false, 'c-sheet-phone-green'],
  ['c-sheet', 'sheet', 'red', DESK, false, 'c-sheet-desk'],
  ['a-directory', 'out', 'red', PHONE, false, 's-out'],
  ['a-directory', 'posted', 'red', PHONE, false, 's-posted'],
  ['a-directory', 'err', 'red', PHONE, false, 's-err'],
  ['a-directory', 'empty', 'red', PHONE, false, 's-empty'],
  ['a-directory', 'fail', 'red', PHONE, false, 's-fail'],
];

const browser = await chromium.launch();

async function fonts(page) {
  if (!FONTS) return;
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => {
    const m = route.request().url().match(/\/(f\d+\.woff2)/);
    if (m) return route.fulfill({ body: readFileSync(join(FONTS, m[1])), contentType: 'font/woff2' });
    return route.fulfill({ body: readFileSync(join(FONTS, 'local.css'), 'utf8'), contentType: 'text/css' });
  });
}

for (const [t, state, style, vp, full, name] of SHOTS) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await fonts(page);
  await page.goto(url(t, state, style), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(OUT, name + '.png'), fullPage: full });
  await ctx.close();
  console.log('shot', name);
}

/* Several shots on one canvas with a label over each, read back over the
   same server, so the states and the sheet can be looked at as one picture.
   Each is laid at the width it was drawn at; the canvas is captured at 2x. */
async function compose(name, frames, scale = 2) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  await fonts(page);
  const html = `<!doctype html><html><head>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap">
    <style>
      body { margin: 0; padding: 28px; background: #d9d6d2; font-family: "IBM Plex Mono", monospace; display: inline-flex; gap: 28px; align-items: flex-start; }
      figure { margin: 0; display: flex; flex-direction: column; gap: 10px; }
      figcaption { font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: #2b2622; }
      img { display: block; border: 1px solid #a9a39c; box-shadow: 0 8px 28px rgba(0,0,0,.14); }
    </style></head><body>
    ${frames.map((f) => `<figure><figcaption>${f.label}</figcaption><img src="http://127.0.0.1:${PORT}/design/feedback/shots/${f.shot}.png" width="${f.width}"></figure>`).join('')}
  </body></html>`;
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  const body = await page.$('body');
  await body.screenshot({ path: join(OUT, name + '.png') });
  await ctx.close();
  console.log('composed', name);
}

await compose('folds', [
  { label: 'A — directory, on arrival', shot: 'a-phone-fold', width: 390 },
  { label: 'B — guestbook, on arrival', shot: 'b-phone-fold', width: 390 },
  { label: 'C — sheet, on arrival', shot: 'c-phone-fold', width: 390 },
]);

await compose('states', [
  { label: 'Signed out', shot: 's-out', width: 390 },
  { label: 'Just posted', shot: 's-posted', width: 390 },
  { label: 'Did not go through', shot: 's-err', width: 390 },
  { label: 'Nothing yet', shot: 's-empty', width: 390 },
  { label: 'Could not load', shot: 's-fail', width: 390 },
]);

await compose('c-sheet', [
  { label: 'C — the sheet, phone', shot: 'c-sheet-phone', width: 390 },
  { label: 'C — the sheet, dark style', shot: 'c-sheet-phone-green', width: 390 },
  { label: 'C — the sheet, desk', shot: 'c-sheet-desk', width: 1280 },
], 1.5);

await browser.close();
server.kill();
if (!existsSync(join(OUT, 'folds.png'))) process.exit(1);
console.log('done');
