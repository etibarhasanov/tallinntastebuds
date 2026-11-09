#!/usr/bin/env node
/**
 * Tallinn Tastebuds — every generator, in the order they depend on each other.
 *
 * The site has no build step: Cloudflare Pages serves the files in this
 * repository as they are, so every file the pages read that is made out of
 * another one is committed already made. The table under **Before you push**
 * in CLAUDE.md lists them — the lean copies of the big scripts, the ?v= stamps,
 * the catalogue, one language to a file, the decks, the sitemap — and for a
 * long time each was a command somebody had to remember after changing its
 * source. The validator only ever checked; it failed the build on whichever
 * one was forgotten and fixed nothing.
 *
 * This runs all of them. `.github/workflows/generated.yml` runs it on every
 * push to every branch but the live one and commits what it changed, so a
 * forgotten generator is no longer a red pull request. Running it by hand
 * before a push still saves the round trip:
 *
 *     node tools/generate.mjs
 *
 * Every tool here is cheap and writes nothing when its output is already
 * right, so running the lot when one source moved costs a second or two.
 *
 * THE ORDER
 *
 *   lean before stamp, because the stamper hashes the lean copies the pages
 *   load. places before googlevenues, which reads the catalogue's ids to tie a
 *   Google row to a place of mine. The rest read only their own sources.
 *
 * WHAT IS LEFT OUT
 *
 * The two tools that draw with a Chromium — tools/blogclips.mjs and
 * tools/ogcard.mjs — because a runner without one cannot run them, and their
 * sources change a few times a year. Their own headers say how to run them.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const TOOLS = [
  'lean', 'stamp',
  'places', 'languages', 'decks',
  'city', 'googlevenues', 'googlelists', 'cityvenues',
  'flows', 'sitemap'
];

const here = dirname(fileURLToPath(import.meta.url));
let failed = 0;
for (const name of TOOLS) {
  const run = spawnSync(process.execPath, [join(here, name + '.mjs')], {
    cwd: join(here, '..'), encoding: 'utf8'
  });
  if (run.status === 0) {
    console.log('  ok    ' + name);
  } else {
    failed++;
    console.log('  FAIL  ' + name);
    process.stdout.write(run.stdout || '');
    process.stderr.write(run.stderr || '');
  }
}
if (failed) process.exit(1);
