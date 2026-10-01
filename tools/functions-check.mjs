#!/usr/bin/env node
/**
 * Tallinn Tastebuds — every Function loaded, before a deploy is the first to.
 *
 * Cloudflare Pages bundles everything under functions/ into one Worker, so
 * the Functions go up together or not at all. A route that imports a name its
 * module no longer exports does not fail on its own: it fails the bundle, and
 * every route on the site goes down with it. That happened. An export came
 * out of functions/api/_lib.js in the commit that wrote its replacement, a
 * route still imported the old name, nothing in CI opened either file, and
 * the whole deployment went down rather than that one route — the comment
 * above uiStrings() there is the record.
 *
 * This is what notices now. It walks functions/, imports every .js file under
 * it, and prints each one that does not load with the first line of the
 * error. An ES module resolves its imports before a line of it runs, so
 * `import { x } from './_lib.js'` where _lib.js has no x throws at import
 * time; so does a syntax error anywhere in the file or in anything it
 * imports, and so does anything that throws at the top level. It is the
 * question the deploy asks of the Functions, asked here first.
 *
 * WHY PLAIN NODE IS ENOUGH
 *
 * The Functions are written for the Workers runtime, but nothing in them runs
 * at import time except constant and function definitions: no top-level read
 * of `caches` or of a binding, no bare import of a package nobody installed,
 * and the globals they reach for inside a handler — crypto, fetch, Response,
 * TextEncoder — are ones Node has as well. So loading them under Node is
 * loading them. Should a module ever read something only a Worker has at the
 * top level, this fails with a ReferenceError naming it, and the answer is to
 * move that read into the handler, not to teach this file about Workers.
 *
 * Usage:
 *
 *     node tools/functions-check.mjs    every module; one line when they all load
 *
 * Exit 1 with a line per module that did not load, 0 otherwise. Zero
 * dependencies, like every other tool here, and it runs from any directory.
 */

import { readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* Every .js file under a directory, in code-point order within each one, so
   the report reads the same from one run to the next. Underscore files are
   modules rather than routes and load the same way — a bad one is what takes
   the routes down. */
function modules(dir) {
  const found = [];
  const entries = readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...modules(path));
    else if (entry.name.endsWith('.js')) found.push(path);
  }
  return found;
}

const files = modules(join(ROOT, 'functions'));
const failed = [];

for (const file of files) {
  try {
    await import(pathToFileURL(file).href);
  } catch (err) {
    /* The first line names what went wrong — the missing export, the bad
       token, the global Node does not have — and the lines after it are
       Node's own frames. A path in it is written the way the repo names the
       file. */
    const line = String(err).split('\n')[0].split(ROOT + sep).join('');
    failed.push(`${relative(ROOT, file)} — ${line}`);
  }
}

if (failed.length) {
  console.log('');
  for (const f of failed) console.log(`  FAIL  ${f}`);
  console.log('');
  console.log(`${failed.length} of ${files.length} modules under functions/ did not load, and Pages would have deployed none of them.`);
  process.exit(1);
}

console.log(`OK — ${files.length} modules under functions/ load: every import resolves, and nothing throws at the top level.`);
