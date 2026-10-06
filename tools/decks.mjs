#!/usr/bin/env node
/**
 * Tallinn Tastebuds — the decks, one file each.
 *
 * data/decks.json is the Estonian the flashcards ship — the decks of cards,
 * the grammar lessons and the songs — in one file, because one file is what
 * a person edits: a word is found with grep, a deck is read top to bottom,
 * and a change is one diff. It is also over a megabyte, and a Function that
 * wanted one deck out of it had to parse all of it: on a fresh isolate about
 * four milliseconds of the ten the Workers free plan gives a request, paid
 * before the database was asked anything, and growing with every deck.
 * **Where the words are, and it is mostly not the database** under
 * **Flashcards** in README.md has the arithmetic.
 *
 * So the source stays exactly as it is, and this writes what the Functions
 * actually read out of it:
 *
 *   data/decks/index.json    the shelf: every deck with its name, its line,
 *                            its level, the day it went in and the ids of its
 *                            cards — ids rather than cards, because the shelf
 *                            counts what somebody knows and what is due and
 *                            never shows a card — and every lesson and song
 *                            the same, without its body or its verses. The
 *                            three lists under the three keys the source has,
 *                            in the source's order.
 *
 *   data/decks/<id>.json     one deck, lesson or song, whole, exactly as it is
 *                            in the source. The three share one folder because
 *                            they share one address — ?d=<id> — and
 *                            tools/validate.mjs keeps their ids apart.
 *
 *   data/decks/spoken.json   every string the voice may say, sorted: the front
 *                            of every card and the Estonian of its sentence,
 *                            every sentence and every form in a grammar
 *                            lesson, and every line of a song. What /api/say
 *                            holds a request to, so that it never needs the
 *                            cards to answer whether a text is on one.
 *
 * WHO READS WHAT
 *
 * functions/api/_decks.js is the ways of reading the folder, for
 * functions/api/flashcard.js and functions/flashcard.js — the shelf out of
 * the index, a deck, a lesson or a song out of its file, and the two decks
 * gathered out of somebody's rows out of the files those rows name, or out of
 * the source once when they name more than a few: the header of that module
 * says why. functions/api/say.js reads spoken.json and nothing else. functions/api/_visitors.js reads the index for the ids a
 * visitor's report may say it was about. Nothing in a browser reads any of
 * them: the page asks /api/flashcard, which answers with what it read.
 * tools/validate.mjs and tools/sitemap.mjs read the source, as they always
 * did, and the validator fails the build on a file here that is not what
 * this would write.
 *
 * Two names are the folder's own and no deck, lesson or song may take them:
 * RESERVED_FILES below, which the validator holds every id against.
 *
 *   node tools/decks.mjs           rewrite the files above
 *   node tools/decks.mjs --check   report that they are out of date, exit 1
 *
 * Zero dependencies, like every other tool in here.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, unlinkSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'data', 'decks.json');
const DIR = join(ROOT, 'data', 'decks');

/* The two files in the folder that are not a deck, a lesson or a song, and so
   the two ids none of them may have. tools/validate.mjs reserves them. */
export const RESERVED_FILES = ['index', 'spoken'];

/* A shipped id as data/decks.json spells one, and the only shape that gets a
   file: the same test functions/api/_decks.js applies before it builds a path
   out of one, so nothing this writes and nothing a route asks for can be
   anywhere but in the folder. The validator fails an id that is not a slug;
   this just declines to write it a file. */
const WRITTEN = /^[a-z0-9][a-z0-9-]{0,31}$/;

/* One space of indent, for the reason tools/languages.mjs gives: these are
   read by a Function and not a person, and one line would make every change
   to a card a diff of the whole file. */
function serialise(value) {
  return JSON.stringify(value, null, 1) + '\n';
}

/* A paradigm cell that holds two forms writes them either side of a middle dot
   — `köögisse · kööki` — which is a mark for the eye and not a word for the
   voice, so it is spoken as a short pause. The page sends a form through the
   same line, asForm() in assets/flashcard.js, and the two are kept the same
   by hand the way the pin tables are: neither can import the other. It lived
   in functions/api/say.js while that route built the list itself. */
function asForm(form) {
  return form.replace(/ · /g, ', ');
}

/* Every string the voice may say, out of all three lists — the rule /api/say
   applied to the whole file before this tool existed, and exact: nothing a
   person typed is ever in it. Sorted, so that the file changes only when the
   words do. */
function spoken(file) {
  const set = new Set();
  for (const deck of file.decks || []) {
    for (const card of deck.cards || []) {
      if (card.front) set.add(card.front);
      if (card.sentence && card.sentence.et) set.add(card.sentence.et);
    }
  }
  for (const song of file.songs || []) {
    for (const verse of song.verses || []) {
      for (const line of verse || []) if (line && line.et) set.add(line.et);
    }
  }
  for (const lesson of file.lessons || []) {
    for (const block of lesson.body || []) {
      for (const one of block.examples || []) if (one && one.et) set.add(one.et);
      for (const row of (block.table && block.table.rows) || []) {
        for (const form of row.et || []) if (form) set.add(asForm(form));
      }
    }
  }
  return [...set].sort();
}

/* A deck, lesson or song as the index carries it: the source's row without
   the one part of it the shelf never draws — a deck's cards become their
   ids, a lesson loses its body, a song its verses and its words. */
function onShelf(one, kind) {
  const row = { ...one };
  if (kind === 'decks') row.cards = (Array.isArray(one.cards) ? one.cards : []).map((card) => card && card.id);
  if (kind === 'lessons') delete row.body;
  if (kind === 'songs') {
    delete row.verses;
    delete row.words;
  }
  return row;
}

/* Every file this writes, as { path: contents }. */
export function build() {
  const file = JSON.parse(readFileSync(SOURCE, 'utf8'));
  const out = {};
  const index = {};
  for (const kind of ['decks', 'lessons', 'songs']) {
    const list = Array.isArray(file[kind]) ? file[kind].filter((one) => one && typeof one === 'object') : [];
    index[kind] = list.map((one) => onShelf(one, kind));
    for (const one of list) {
      const id = String(one.id || '');
      if (!WRITTEN.test(id) || RESERVED_FILES.includes(id)) continue;
      out[join(DIR, id + '.json')] = serialise(one);
    }
  }
  out[join(DIR, 'index.json')] = serialise(index);
  out[join(DIR, 'spoken.json')] = serialise(spoken(file));
  return out;
}

/* A file in data/decks/ that build() would not write: a deck taken out of the
   source leaves one behind otherwise, which nothing would ask for and the
   deploy would carry for ever. */
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
    return ['data/decks.json (unreadable: ' + e.message + ')'];
  }
  const wrong = Object.keys(files).filter((path) =>
    !existsSync(path) || readFileSync(path, 'utf8') !== files[path]);
  return wrong.concat(leftovers(files)).map((path) => path.slice(ROOT.length + 1));
}

/* Write every file build() names that is not already what it would be, and
   take out what leftovers() names. */
export function write() {
  const files = build();
  mkdirSync(DIR, { recursive: true });
  for (const path of leftovers(files)) unlinkSync(path);
  let changed = 0;
  for (const path of Object.keys(files)) {
    if (existsSync(path) && readFileSync(path, 'utf8') === files[path]) continue;
    writeFileSync(path, files[path]);
    changed++;
  }
  return { changed, files: Object.keys(files).length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const wrong = stale();
    if (!wrong.length) {
      console.log('OK — data/decks/ matches data/decks.json.');
      process.exit(0);
    }
    for (const path of wrong) console.log(`  FAIL  ${path} is not what tools/decks.mjs would write.`);
    console.log('\nRun `node tools/decks.mjs` and commit the result.');
    process.exit(1);
  }

  const { changed, files } = write();
  console.log(`data/decks/ — ${files - 2} decks, lessons and songs, the index and the voice's list; ${changed} file(s) rewritten.`);
}
