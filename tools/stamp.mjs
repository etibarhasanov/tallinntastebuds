#!/usr/bin/env node
/**
 * Tallinn Tastebuds — asset stamper.
 *
 * Every script and stylesheet is referenced from the HTML with a short hash of
 * its own contents on the end:
 *
 *     <script src="assets/app.js?v=9f2c41a8" defer></script>
 *
 * Change the file, the hash changes, and the URL the browser is asked for is
 * one it has never seen — so it cannot serve an old copy out of its cache, no
 * matter what it decided to do with the Cache-Control header.
 *
 * That matters because the pages are not independent. `assets/app.js` reads
 * `data/restaurants.json`, and a browser holding yesterday's script against
 * today's data runs code that was written for a shape the data no longer has.
 * That is not hypothetical: half-step prices landed in the data and the script
 * on the same deploy, and every visitor whose browser kept the previous script
 * hit `new Array(2.5 + 1)` — `RangeError: Invalid array length` — which took
 * the boot chain down and put the "something went wrong loading the data" card
 * in front of a map that had already drawn itself. A fresh window worked; the
 * one they had been using did not, and reloading it changed nothing, because
 * reloading asked for the same URL again.
 *
 * Usage, after editing anything in assets/:
 *
 *     node tools/stamp.mjs          rewrite the stamps in the HTML
 *     node tools/stamp.mjs --check  report stale ones and exit 1
 *
 * `tools/validate.mjs` runs the check, so CI refuses a deploy that would ship
 * a changed asset under an unchanged URL. Zero dependencies, like the
 * validator: this has to still run in five years with no `npm install`.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* Every page that loads something out of assets/. */
export const PAGES = ['index.html', 'deal.html', 'verify.html', 'staff.html'];

/* Scripts and stylesheets only. Images are addressed by name and replaced
   rather than edited, and no code reads them, so a stale one is a stale
   picture and not a broken page. */
const REF = /\b(src|href)="(assets\/[A-Za-z0-9._/-]+\.(?:js|css))(?:\?v=([0-9a-f]+))?"/g;

/* Eight hex characters: 32 bits, which is plenty to tell apart the handful of
   versions of one file that are ever in flight at once, and short enough to
   read in a network panel. */
export function stampOf(relPath) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) return null;
  return createHash('sha256').update(readFileSync(abs)).digest('hex').slice(0, 8);
}

/* Every reference in every page, with the stamp it carries and the one it
   should carry. */
export function references() {
  const out = [];
  for (const page of PAGES) {
    const abs = join(ROOT, page);
    if (!existsSync(abs)) continue;
    const html = readFileSync(abs, 'utf8');
    for (const m of html.matchAll(REF)) {
      out.push({ page, asset: m[2], got: m[3] || null, want: stampOf(m[2]) });
    }
  }
  return out;
}

/* The references that would send a browser to the wrong URL: no stamp at all,
   a stamp that no longer matches the file, or a file that is not there. */
export function stale() {
  return references().filter((r) => r.want === null || r.got !== r.want);
}

export function restamp() {
  const touched = [];
  for (const page of PAGES) {
    const abs = join(ROOT, page);
    if (!existsSync(abs)) continue;
    const html = readFileSync(abs, 'utf8');
    const next = html.replace(REF, (whole, attr, asset) => {
      const want = stampOf(asset);
      return want === null ? whole : `${attr}="${asset}?v=${want}"`;
    });
    if (next !== html) {
      writeFileSync(abs, next);
      touched.push(page);
    }
  }
  return touched;
}

/* Only when run directly — validate.mjs imports the functions above. */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const bad = stale();

  if (check) {
    if (!bad.length) {
      console.log('OK — every asset reference carries the hash of the file it points at.');
      process.exit(0);
    }
    for (const r of bad) {
      console.log(r.want === null
        ? `  FAIL  ${r.page}: "${r.asset}" is referenced but not in the repo`
        : `  FAIL  ${r.page}: "${r.asset}" is stamped ${r.got || '(nothing)'}, should be ${r.want}`);
    }
    console.log('\nRun `node tools/stamp.mjs` and commit the result.');
    process.exit(1);
  }

  const touched = restamp();
  console.log(touched.length
    ? `Restamped ${touched.join(', ')}.`
    : 'Nothing to do — every stamp already matches its file.');
}
