#!/usr/bin/env node
/**
 * Tallinn Tastebuds — the map's words, one language to a file.
 *
 * The map used to open by fetching data/ui.json whole: ten languages of every
 * string on the site, 650 KB raw and 185 KB over the wire, to print one of
 * them. And data/restaurants.json carried every place's write-up in all ten
 * too — 170 of its 200 KB were blurbs — so a visitor reading in Estonian was
 * downloading nine translations of every paragraph they would never see. On a
 * phone, which is what this site is measured on, that was most of the first
 * load that was not the script.
 *
 * So the two sources stay exactly as they are — one file of strings, one of
 * places, each edited in one place and held to parity by tools/validate.mjs —
 * and this writes what the map actually reads out of them:
 *
 *   data/lang/index.json    every language's code and its own name for
 *                           itself. What the switch lists, and what the boot
 *                           picks a language out of before it knows which
 *                           file to ask for. A few hundred bytes.
 *
 *   data/lang/<code>.json   one language: `ui`, that language's block of
 *                           data/ui.json as it stands, and `blurbs`, every
 *                           place's write-up in it by place id.
 *
 *   data/map.json           data/restaurants.json with the blurbs taken out,
 *                           which is everything else the map needs.
 *
 * A blurb falls back here rather than in the browser. The map used to read a
 * place's write-up as its language, else English, else Estonian, else
 * Russian; that order is BLURB_FALLBACK below, applied once at build time, so
 * a language still owed a translation ships the English one in its own file
 * and the browser does no falling back at all. Strings need no fallback: the
 * validator fails a key one language has and another does not.
 *
 * WHO READS WHAT
 *
 * Only the map, assets/app.js. Every other page still fetches data/ui.json
 * whole, and functions/index.js, functions/api/ask.js and the rest read
 * data/restaurants.json with its blurbs, so both sources stay deployed and
 * nothing that reads them changes. A browser still holding yesterday's
 * app.js asks for those two and is answered as it always was, which is the
 * incident in the header of tools/stamp.mjs not happening again.
 *
 *   node tools/languages.mjs           rewrite the files above
 *   node tools/languages.mjs --check   report that they are out of date, exit 1
 *
 * Zero dependencies, like every other tool in here.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, unlinkSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UI = join(ROOT, 'data', 'ui.json');
const PLACES = join(ROOT, 'data', 'restaurants.json');
const DIR = join(ROOT, 'data', 'lang');
const MAP = join(ROOT, 'data', 'map.json');

/* The order a place's write-up is looked for in when its own language has
   none: the reading language first, then these. It is the order blurbFor()
   in assets/app.js used before this file existed. */
const BLURB_FALLBACK = ['en', 'et', 'ru'];

/* One space of indent rather than the two the hand-written files use: these
   are read by a browser, not a person, and the indent is the one part of the
   file a compressor cannot fold away entirely. One line would be smaller
   still and would make every change to a string a diff of the whole file. */
function serialise(value) {
  return JSON.stringify(value, null, 1) + '\n';
}

function blurbIn(place, lang) {
  const b = place.blurb || {};
  for (const code of [lang].concat(BLURB_FALLBACK)) {
    if (typeof b[code] === 'string' && b[code].trim()) return b[code];
  }
  return '';
}

/* Every file this writes, as { path: contents }. */
export function build() {
  const ui = JSON.parse(readFileSync(UI, 'utf8'));
  const places = JSON.parse(readFileSync(PLACES, 'utf8'));
  const out = {};

  const names = {};
  for (const code of Object.keys(ui)) names[code] = ui[code].langName || code;
  out[join(DIR, 'index.json')] = serialise(names);

  for (const code of Object.keys(ui)) {
    const blurbs = {};
    for (const place of places) {
      const said = blurbIn(place, code);
      if (said) blurbs[place.id] = said;
    }
    out[join(DIR, code + '.json')] = serialise({ ui: ui[code], blurbs });
  }

  out[MAP] = serialise(places.map((place) => {
    const rest = Object.assign({}, place);
    delete rest.blurb;
    return rest;
  }));

  return out;
}

/* A file in data/lang/ that build() would not write: a language taken out of
   data/ui.json leaves one behind otherwise, and the map would never ask for
   it but the deploy would carry it forever. */
function leftovers(files) {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR)
    .map((name) => join(DIR, name))
    .filter((path) => !(path in files));
}

/* The paths, relative to the repo, of every file that is not what build()
   would write, or is there and should not be. The validator asks this. */
export function stale() {
  let files;
  try {
    files = build();
  } catch (e) {
    return ['data/ui.json or data/restaurants.json (unreadable: ' + e.message + ')'];
  }
  const wrong = Object.keys(files).filter((path) =>
    !existsSync(path) || readFileSync(path, 'utf8') !== files[path]);
  return wrong.concat(leftovers(files)).map((path) => path.slice(ROOT.length + 1));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const wrong = stale();
    if (!wrong.length) {
      console.log('OK — data/lang/ and data/map.json match data/ui.json and data/restaurants.json.');
      process.exit(0);
    }
    for (const path of wrong) console.log(`  FAIL  ${path} is not what tools/languages.mjs would write.`);
    console.log('\nRun `node tools/languages.mjs` and commit the result.');
    process.exit(1);
  }

  const files = build();
  mkdirSync(DIR, { recursive: true });
  for (const path of leftovers(files)) unlinkSync(path);
  let changed = 0;
  for (const path of Object.keys(files)) {
    if (existsSync(path) && readFileSync(path, 'utf8') === files[path]) continue;
    writeFileSync(path, files[path]);
    changed++;
  }
  const langs = Object.keys(files).length - 2;
  console.log(`data/lang/ — ${langs} languages and the index; data/map.json — ${changed} file(s) rewritten.`);
}
