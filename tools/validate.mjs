#!/usr/bin/env node
/**
 * Tallinn Tastebuds — data validator.
 *
 * Zero dependencies on purpose: CI runs `node tools/validate.mjs` with no
 * `npm install` in front of it, and it will still run in five years.
 *
 * Exit code 1 if anything in the "must fail" list below is wrong.
 * Warnings are printed but never fail the build.
 *
 * Fails on:
 *   - invalid JSON, wrong shapes, duplicate ids, ids that are not slugs
 *   - coordinates outside Tallinn's bounding box (catches swapped lat/lng)
 *   - a type used in restaurants.json that is not in taxonomy.json
 *   - a taxonomy type claiming a reserved id, such as "discount" or "saved"
 *   - a ground in data/city.json that is not what tools/city.mjs would write
 *     from the same export
 *   - a catalogue in data/places.json that is not what tools/places.mjs would
 *     write, holds a duplicate id, or has lost a place that is on the map
 *   - a db/google-venues.sql that is out of step with the Google Places export
 *     it is generated from, or a db/google-lists.sql — the five top tens and
 *     a top twenty under the `google-statistics` account — that is out of
 *     step with the same export
 *   - a db/type-lists.sql — the thirteen filter chips as lists — that is out
 *     of step with data/restaurants.json or data/taxonomy.json, that holds a
 *     list longer than MAX_ITEMS in functions/api/lists.js, or a chip and a
 *     list that have stopped answering to each other
 *   - a sitemap.xml that is not what tools/sitemap.mjs would write from the
 *     languages in data/ui.json and the thirteen lists
 *   - a page served through a Function with a head of its own — index.html,
 *     lists.html, split.html, flashcard.html — missing the pair of PAGE-HEAD markers that
 *     head goes between, which would leave it wearing its static head at
 *     every address without anything saying so; and an index.html or a
 *     lists.html whose empty element — #list-body, <main> — is not spelled
 *     the way fill() in functions/_shell.js matches it, which would leave a
 *     crawler with an empty page again
 *   - a taxonomy type missing a label in any language
 *   - a cuisine in data/cuisines.json missing a label in any language, or one
 *     the directory's KITCHENS table cannot produce
 *   - a KITCHENS pattern that no longer matches a single row of the Google
 *     Places export, or one whose id nothing can say in ten languages
 *   - an assets/pins.js whose eight markers have drifted from the ids
 *     functions/api/_pins.js will let a list store, a glyph called `mark` in
 *     either table, a kind of place a list could also pick, a tone with no
 *     colour token behind it, or a marker nobody has named in ten languages
 *     — the picker builds its keys, so nothing else would catch it
 *   - a UI string present in one language but missing in another
 *   - a string the site asks for — a data-i18n key in the markup, a t('key')
 *     in a script — that is in no language of data/ui.json at all
 *   - a colour token one style declares and another leaves out, which is a
 *     style quietly wearing the other one's value out of :root
 *   - a photo listed in the data that does not exist in the repo
 *   - a reel value that is not a real Instagram or TikTok permalink shape
 *   - a phone number that is not in international form, such as +372 661 0180
 *   - a deal in deals.json for a place that does not exist, sharing a key with
 *     another deal, switched live with nothing written in it, carrying a
 *     name that restaurants.json disagrees with, or rolling a run of rates
 *     that leaves 1–99 or has nowhere in the offer line to put the one drawn
 *   - a story in stories.json with neither a start nor an end time, an end
 *     before its start, no video or photo (or both), a file that is not in
 *     the repo, a video too big for Cloudflare Pages to serve, or a link to a
 *     place that does not exist
 *   - wrangler.toml pointing the preview deployments and the live site at the
 *     same D1 database, or at no database of their own
 *
 * Warns on:
 *   - placeholder blurbs, missing reels, missing phone numbers, missing blurb translations
 *   - unused taxonomy types, photo folders with no matching restaurant
 *   - a story that is still switched on after its time ran out, a story asked
 *     to stand for much longer than the 36 hours one gets by default, a video
 *     in stories/ that no story names, and a story video that is over the
 *     size budget or in a container story-media.yml has yet to convert
 *   - unknown keys in a restaurant object (catches typos)
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { stale as staleStamps } from './stamp.mjs';
import { stale as staleCatalogue } from './places.mjs';
import { stale as staleGoogleVenues, parseCsv } from './googlevenues.mjs';
import { stale as staleGoogleLists } from './googlelists.mjs';
import { stale as staleCity } from './city.mjs';
import { stale as staleTypeLists, build as buildTypeLists } from './typelists.mjs';
import { stale as staleSitemap } from './sitemap.mjs';
/* The directory's own vocabulary. It is a table in the endpoint rather than a
   file, the way VENUE_TYPES is, and the checks below are what keep it honest:
   every id has a label in ten languages, and every pattern still matches
   something in the export it was measured against. */
import { KITCHENS, said } from '../functions/api/venues.js';
/* The eight markers a list may wear. The server half of a table that is
   written out twice — assets/pins.js is the other — so the checks below are
   what make "change one, change the other" something other than a promise in
   a comment. */
import { PIN_GLYPHS, DEFAULT_PIN } from '../functions/api/_pins.js';
import { NETWORKS } from '../functions/api/_profile.js';

/* How many places a list may hold, from the route that enforces it, so the
   check below is the server's number and not a fourth copy of it. */
import { MAX_ITEMS } from '../functions/api/lists.js';
/* The languages the flashcards are in, from the file both Functions that
   serve that page read it out of — so the warning below about a card nobody
   has translated is about the same three the page will actually offer, rather
   than a third copy of the list drifting quietly away from them. */
import { DECK_LANGS } from '../functions/api/_lib.js';
/* The elements two pages ship empty for a Function to fill with text, from
   the module that fills them, so the spelling held here is the one matched. */
import { EMPTY } from '../functions/_shell.js';
import { STORY_HOURS, HOUR_MS, storyWindow, storyPhase } from './clock.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const PHOTOS = join(ROOT, 'photos');

/* Tallinn's bounding box, generously drawn. Anything outside it is a typo:
   a swapped lat/lng lands near 24.7N 59.4E, in the Arabian Sea. */
const BBOX = { latMin: 59.32, latMax: 59.52, lngMin: 24.50, lngMax: 25.00 };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MONTH = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
/* Instagram shows two shapes depending on where you copied from: the plain
   permalink, and the profile-prefixed one you get while browsing your own
   grid (…instagram.com/tallinntastebuds/reel/ABC123/). Both are real. */
const REEL_INSTAGRAM = /^https:\/\/www\.instagram\.com\/(?:[A-Za-z0-9._]{1,30}\/)?(reel|reels|p|tv)\/[A-Za-z0-9_-]{5,}\/?(\?.*)?$/;
/* TikTok posts live in the same "reel" field — renaming it would touch every
   place in the data for no gain. */
const REEL_TIKTOK = /^https:\/\/www\.tiktok\.com\/@[A-Za-z0-9._]{1,30}\/video\/[0-9]{6,}\/?(\?.*)?$/;
const isReel = (u) => REEL_INSTAGRAM.test(u) || REEL_TIKTOK.test(u);
const PHOTO_FILE = /^[A-Za-z0-9._-]+\.(webp|jpg|jpeg|png|avif)$/i;
const HTTP_URL = /^https?:\/\/[^\s]+$/;
/* International form with spaces for readability: "+372 661 0180". Estonian
   numbers are seven or eight digits, but the pattern stays country-agnostic so
   a place across the water can be listed the same way. */
const PHONE = /^\+[1-9][0-9]{0,3}(?: [0-9]{2,4}){1,4}$/;

const KNOWN_KEYS = new Set([
  'id', 'name', 'address', 'lat', 'lng', 'price', 'types', 'blurb',
  'mustOrder', 'reel', 'photos', 'website', 'phone', 'added', 'visited', 'closed'
]);

/* visited is deliberately absent: a place you have been to but not filmed has
   no post to date it from, so the key may be left out entirely. */
const REQUIRED_KEYS = [
  'id', 'name', 'address', 'lat', 'lng', 'price', 'types', 'blurb',
  'mustOrder', 'reel', 'photos', 'closed'
];

const errors = [];
const warnings = [];

const fail = (where, message) => errors.push(`${where}: ${message}`);
const warn = (where, message) => warnings.push(`${where}: ${message}`);

function readJSON(relPath) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) {
    fail(relPath, 'file is missing');
    return null;
  }
  let raw;
  try {
    raw = readFileSync(abs, 'utf8');
  } catch (err) {
    fail(relPath, `could not be read (${err.message})`);
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    fail(relPath, `is not valid JSON — ${err.message}`);
    return null;
  }
}

const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

/* ------------------------------------------------------------------ ui.json
   The set of languages the whole site speaks is defined here, and nowhere
   else. Everything downstream is checked against these keys. */

const ui = readJSON('data/ui.json');
let languages = [];

if (ui !== null) {
  if (!isPlainObject(ui)) {
    fail('data/ui.json', 'must be an object keyed by language code');
  } else {
    languages = Object.keys(ui);
    if (languages.length === 0) fail('data/ui.json', 'has no languages in it');

    for (const lang of languages) {
      if (!isPlainObject(ui[lang])) fail(`data/ui.json → ${lang}`, 'must be an object of string ids');
    }

    const usable = languages.filter((l) => isPlainObject(ui[l]));
    const everyKey = new Set();
    for (const lang of usable) for (const key of Object.keys(ui[lang])) everyKey.add(key);

    for (const key of [...everyKey].sort()) {
      const missing = usable.filter((lang) => !isNonEmptyString(ui[lang][key]));
      if (missing.length > 0 && missing.length < usable.length) {
        fail('data/ui.json', `string "${key}" is missing (or empty) in: ${missing.join(', ')}`);
      }
    }

    for (const lang of usable) {
      if (!isNonEmptyString(ui[lang].langName)) {
        fail(`data/ui.json → ${lang}`, 'needs a "langName" — it labels the language switch');
      }
    }
  }
}

if (languages.length === 0) languages = ['en'];

/* --------------------------------------------------------------- SPLITWISE
   data/split.json — the splitwise page's own strings, in a file of its own so
   that removing that feature is removing files rather than picking six hundred
   lines out of the middle of the one every other page reads. See **Taking it
   out** under **Splitwise** in README.md; this block and the one line in the
   key check further down are all this file knows about it.

   Held to exactly what ui.json is held to, and to one thing more: the same
   languages, no more and no fewer. A pack that speaks nine of the ten would
   print raw keys at whoever chose the tenth, and a language in here that is
   not a language of the site is a translation nothing will ever read. */

const splitUi = existsSync(join(DATA, 'split.json')) ? readJSON('data/split.json') : null;
const splitKeys = new Set();

if (splitUi !== null) {
  if (!isPlainObject(splitUi)) {
    fail('data/split.json', 'must be an object keyed by language code');
  } else {
    const said = Object.keys(splitUi);
    for (const lang of said) {
      if (!languages.includes(lang)) {
        fail('data/split.json', `speaks "${lang}", which is not a language of data/ui.json`);
      }
    }
    for (const lang of languages) {
      if (!said.includes(lang)) fail('data/split.json', `has no "${lang}" — data/ui.json has one`);
    }

    const usable = said.filter((l) => isPlainObject(splitUi[l]));
    const everyKey = new Set();
    for (const lang of usable) for (const key of Object.keys(splitUi[lang])) everyKey.add(key);

    for (const key of [...everyKey].sort()) {
      splitKeys.add(key);
      const missing = usable.filter((lang) => !isNonEmptyString(splitUi[lang][key]));
      if (missing.length > 0) {
        fail('data/split.json', `string "${key}" is missing (or empty) in: ${missing.join(', ')}`);
      }
      /* One string, one home. A key in both files is a string with two values
         and no way to tell which one a page drew. */
      if (ui !== null && isPlainObject(ui) && usable.some((lang) => ui[lang] && key in ui[lang])) {
        fail('data/split.json', `string "${key}" is also in data/ui.json — it belongs in one of them`);
      }
    }
  }
}
/* ----------------------------------------------------------- end SPLITWISE */

/* -------------------------------------------------------------- FLASHCARDS
   data/decks.json — the Estonian the flashcards page ships: forty-two decks
   and one thousand nine hundred and sixty cards, deployed as a file and read
   as one.
   It is content rather than interface, so the ten languages of data/ui.json
   do not apply to it wholesale the way they do to a button — what it carries
   instead is the three it has been written in, in the shape a place's blurb
   is in: an object keyed by language, English required and the rest as they
   arrive. See **Flashcards** in README.md; this block is all this file knows
   about that feature.

   The one check here that is not about the file being well formed is the last:
   a deck id shaped like a minted one. functions/api/flashcard.js tells a deck
   somebody wrote from a deck the site ships by exactly that — sixteen hex
   characters against a word — and two namespaces that can meet is a deck of
   yours that shadows one of ours, in a table keyed on the id of both. */

const decksFile = existsSync(join(DATA, 'decks.json')) ? readJSON('data/decks.json') : null;

if (decksFile !== null) {
  if (!isPlainObject(decksFile) || !Array.isArray(decksFile.decks)) {
    fail('data/decks.json', 'must be an object with a "decks" array');
  } else {
    /* The cap both sides of a card are held to in the Function. A shipped
       card longer than a typed one would be a card the page draws and nobody
       could have written. */
    const MAX_SIDE = 60;
    /* DECK_LANGS is imported above, and English is the one of the three that
       binds. It is not a preference: it is what assets/flashcard.js falls back
       to for anybody who asked for one of the site's other seven, so a card
       without it is a card that draws nothing for most of the site's readers.
       The other two only warn, which is the footing a place's blurb is on — a
       card added today and translated on Thursday is still a card, and a build
       that failed over it would mean nothing could be added without all three
       at once. */
    const MINTED = /^[0-9a-f]{16}$/;
    /* The four the page draws headings for, in the order LEVELS in
       assets/flashcard.js draws them. A deck with any other level would fall
       to the bottom under no heading, which is a deck nobody finds. */
    const LEVELS = new Set(['start', 'eat', 'more', 'deep']);
    /* The two ids a shipped deck may not have: functions/api/flashcard.js
       assembles a deck of each name out of somebody's own rows — the cards
       they got wrong, and the cards they know — and two decks answering to
       one id is a run that reads the wrong rows. */
    const RESERVED = new Set(['missed', 'review']);
    const deckIds = new Set();

    /* A deck's name, the line under it, the back of a card, or what a card's
       sentence means: one object keyed by language, held to the same four rules
       wherever it stands.

       An "et" fails outright and is the only one of the four worth explaining:
       Estonian is what the front of the card asks, so an Estonian answer on the
       back is a card answering itself, and the page deliberately never reads
       one — means() in assets/flashcard.js says why at more length. The
       sentence is the exception and is checked apart, because its "et" is the
       Estonian sentence rather than a translation of anything. */
    const said = (pack, at, what, cap) => {
      if (!isPlainObject(pack)) {
        fail(at, `${what} must be an object keyed by language, not a bare string`);
        return;
      }
      if (!isNonEmptyString(pack.en)) {
        fail(at, `${what} has no "en", which is what every other language falls back to`);
      }
      for (const [lang, one] of Object.entries(pack)) {
        if (lang === 'et') {
          fail(at, `${what} has an "et" — Estonian is what the card asks, never what it answers`);
        } else if (!languages.includes(lang)) {
          fail(at, `${what} speaks "${lang}", which is not a language of data/ui.json`);
        } else if (!isNonEmptyString(one)) {
          fail(at, `${what} has an empty "${lang}"`);
        } else if (cap && one.length > cap) {
          fail(at, `${what} has a "${lang}" of ${one.length} characters, past the ${cap} the page draws`);
        }
      }
      for (const lang of DECK_LANGS) {
        if (!(lang in pack)) warn(at, `${what} has no "${lang}" yet`);
      }
    };

    decksFile.decks.forEach((deck, i) => {
      const where = `data/decks.json → decks[${i}]`;
      if (!isPlainObject(deck)) { fail(where, 'must be an object'); return; }
      if (!isNonEmptyString(deck.id)) { fail(where, 'has no "id"'); return; }
      if (!SLUG.test(deck.id)) fail(where, `id "${deck.id}" is not a lowercase slug`);
      if (MINTED.test(deck.id)) {
        fail(where, `id "${deck.id}" is shaped like a deck somebody wrote — see functions/api/flashcard.js`);
      }
      if (deckIds.has(deck.id)) fail(where, `id "${deck.id}" is used twice`);
      if (RESERVED.has(deck.id)) {
        fail(where, `id "${deck.id}" is reserved for the deck of cards somebody got wrong — see functions/api/flashcard.js`);
      }
      deckIds.add(deck.id);

      said(deck.name, where, `deck "${deck.id}" name`);
      said(deck.why, where, `deck "${deck.id}" why`);
      if (!LEVELS.has(deck.level)) {
        fail(where, `deck "${deck.id}" has a level of "${deck.level}", which is not one of: ${[...LEVELS].join(', ')}`);
      }

      if (!Array.isArray(deck.cards) || deck.cards.length === 0) {
        fail(where, `deck "${deck.id}" has no cards`);
        return;
      }

      const cardIds = new Set();
      deck.cards.forEach((card, j) => {
        const at = `${where} → cards[${j}]`;
        if (!isPlainObject(card)) { fail(at, 'must be an object'); return; }
        if (!isNonEmptyString(card.id)) { fail(at, 'has no "id"'); return; }
        if (!SLUG.test(card.id)) fail(at, `id "${card.id}" is not a lowercase slug`);
        if (cardIds.has(card.id)) fail(at, `id "${card.id}" is used twice in "${deck.id}"`);
        cardIds.add(card.id);

        /* The front is one string and is the Estonian; the back is what it
           means, in each language the deck has been written in. */
        if (!isNonEmptyString(card.front)) {
          fail(at, `card "${card.id}" has no "front"`);
        } else if (card.front.length > MAX_SIDE) {
          fail(at, `card "${card.id}" has a "front" of ${card.front.length} characters, past the ${MAX_SIDE} the page draws`);
        }
        said(card.back, at, `card "${card.id}" back`, MAX_SIDE);

        /* The word in a sentence, where a card has one: the Estonian, and what
           it means in the same languages the back is in. Both halves or
           neither, because the page draws the Estonian and what it means as
           two lines and half of it would be a card with a stray clause on
           it. */
        if (card.sentence !== undefined) {
          if (!isPlainObject(card.sentence) || !isNonEmptyString(card.sentence.et)) {
            fail(at, `card "${card.id}" has a "sentence" with no Estonian in it`);
          } else {
            const { et, ...means } = card.sentence;
            said(means, at, `card "${card.id}" sentence`);
          }
        }

        /* The genitive and the partitive, where a word has them. Optional —
           a card that is a phrase has no principal parts and most of two
           decks are phrases — but exactly two where it is there at all, in
           that order, because the page draws them in a row of three with the
           nominative and a row of two would be silently wrong rather than
           visibly missing. */
        if (card.forms !== undefined) {
          if (!Array.isArray(card.forms) || card.forms.length !== 2) {
            fail(at, `card "${card.id}" has "forms" that are not exactly two — the genitive and the partitive, in that order`);
          } else {
            card.forms.forEach((form, k) => {
              if (!isNonEmptyString(form)) {
                fail(at, `card "${card.id}" has an empty form at ${k}`);
              } else if (form.length > MAX_SIDE) {
                fail(at, `card "${card.id}" has a form of ${form.length} characters, past the ${MAX_SIDE} the page draws`);
              }
            });
          }
        }
      });
    });
  }
}
/* ---------------------------------------------------------- end FLASHCARDS */

/* The filter row carries two chips that are not types: Discount, which reads
   data/deals.json instead of a place's types, and Saved, which reads the
   places this browser has kept. A taxonomy type claiming either id would
   give the row two chips answering to one name, each filtering the other's
   places out. */
const RESERVED_TYPE_IDS = new Set(['discount', 'saved']);

/* ------------------------------------------------------------ taxonomy.json */

const taxonomy = readJSON('data/taxonomy.json');
const typeIds = new Set();

if (taxonomy !== null) {
  if (!isPlainObject(taxonomy) || !Array.isArray(taxonomy.types)) {
    fail('data/taxonomy.json', 'must be an object with a "types" array');
  } else {
    taxonomy.types.forEach((type, i) => {
      const where = `data/taxonomy.json → types[${i}]`;
      if (!isPlainObject(type)) { fail(where, 'must be an object'); return; }
      if (!isNonEmptyString(type.id)) { fail(where, 'has no "id"'); return; }
      if (!SLUG.test(type.id)) fail(where, `id "${type.id}" is not a lowercase slug`);
      if (typeIds.has(type.id)) fail(where, `id "${type.id}" is used twice`);
      if (RESERVED_TYPE_IDS.has(type.id)) {
        fail(where, `id "${type.id}" is reserved for the filter chip of the same name`);
      }
      typeIds.add(type.id);

      for (const lang of languages) {
        if (!isNonEmptyString(type[lang])) {
          fail(where, `type "${type.id}" has no "${lang}" label`);
        }
      }
      for (const key of Object.keys(type)) {
        if (key !== 'id' && !languages.includes(key)) {
          warn(where, `type "${type.id}" has an extra key "${key}" that is not a language in ui.json`);
        }
      }
    });
  }
}

/* ---------------------------------------------------------- cuisines.json
 * The directory at /google files each of Google's 1,110 places under the
 * cuisines it looks like it cooks, and says those words in ten languages. Two
 * files hold the labels and they are meant to be disjoint: taxonomy.json above
 * already says asian, vegan, bakery, coffee, pub and fine-dining for the map's
 * own chips, and this one carries the thirty-seven the export needs on top of
 * them. Copying the six across would be six translations to keep in step with
 * another six, so the page reads both files instead — see label() in
 * assets/venues.js.
 *
 * Which ids exist at all is decided by KITCHENS in functions/api/venues.js, so
 * the three checks here are the three ways the two halves can part company: an
 * id nothing can say, a label nothing can reach, and a name in both files.
 */

const cuisines = readJSON('data/cuisines.json');
const cuisineIds = new Set();

if (cuisines !== null) {
  if (!isPlainObject(cuisines) || !Array.isArray(cuisines.cuisines)) {
    fail('data/cuisines.json', 'must be an object with a "cuisines" array');
  } else {
    cuisines.cuisines.forEach((cuisine, i) => {
      const where = `data/cuisines.json → cuisines[${i}]`;
      if (!isPlainObject(cuisine)) { fail(where, 'must be an object'); return; }
      if (!isNonEmptyString(cuisine.id)) { fail(where, 'has no "id"'); return; }
      if (!SLUG.test(cuisine.id)) fail(where, `id "${cuisine.id}" is not a lowercase slug`);
      if (cuisineIds.has(cuisine.id)) fail(where, `id "${cuisine.id}" is used twice`);
      if (typeIds.has(cuisine.id)) {
        fail(where, `id "${cuisine.id}" is already a type in data/taxonomy.json — the two files hold different ids, and the page reads whichever has one`);
      }
      cuisineIds.add(cuisine.id);

      for (const lang of languages) {
        if (!isNonEmptyString(cuisine[lang])) {
          fail(where, `cuisine "${cuisine.id}" has no "${lang}" label`);
        }
      }
      for (const key of Object.keys(cuisine)) {
        if (key !== 'id' && !languages.includes(key)) {
          warn(where, `cuisine "${cuisine.id}" has an extra key "${key}" that is not a language in ui.json`);
        }
      }
    });
  }
}

/* Every id the endpoint can hand the page has to be a word somebody can read,
   and every label has to be an id the endpoint can hand it. A cuisine only one
   side knows about is a chip that says nothing or a translation nobody sees. */
const kitchenIds = new Set(KITCHENS.map(([id]) => id));
for (const id of kitchenIds) {
  if (!cuisineIds.has(id) && !typeIds.has(id)) {
    fail('functions/api/venues.js', `KITCHENS has "${id}", which is in neither data/cuisines.json nor data/taxonomy.json — the directory would have nothing to call it`);
  }
}
for (const id of cuisineIds) {
  if (!kitchenIds.has(id)) {
    fail('data/cuisines.json', `cuisine "${id}" is in no KITCHENS pattern, so nothing can ever be filed under it`);
  }
}

/* And the patterns themselves, against the export they were measured on. A
   word that has stopped matching anything is a line the next person has to
   work out the intent of — the same standard VENUE_TYPES in
   functions/api/_lib.js is held to, and the reason "european" is not in the
   table at all. */
{
  const csv = join(ROOT, 'exports', 'tallinn_restaurants.csv');
  if (existsSync(csv)) {
    const rows = parseCsv(readFileSync(csv, 'utf8'));
    const head = rows[0] || [];
    const at = (name) => head.indexOf(name);
    /* Built by the endpoint's own said(), not by a second copy of it here. One
       pattern in that table asks which column a word came from, so a haystack
       assembled differently would answer this check on a string the site never
       builds. */
    const haystacks = rows.slice(1).map((row) => said({
      category: row[at('category')], cuisine: row[at('cuisine')], tags: row[at('tags')]
    }));

    for (const [id, pattern] of KITCHENS) {
      if (!haystacks.some((text) => pattern.test(text))) {
        fail('functions/api/venues.js', `the KITCHENS pattern for "${id}" matches nothing in the Google Places export any more`);
      }
    }
  }
}

/* --------------------------------------------------------- restaurants.json */

const places = readJSON('data/restaurants.json');
const seenIds = new Set();
/* Kept so deals.json can be checked against it: the pass pages carry the name
   in the deal rather than downloading the whole map to read one string. */
const placeNames = new Map();
const usedTypes = new Set();

if (places !== null) {
  if (!Array.isArray(places)) {
    fail('data/restaurants.json', 'must be an array of restaurant objects');
  } else {
    if (places.length === 0) warn('data/restaurants.json', 'is empty — the map will have no pins');

    places.forEach((place, i) => {
      const label = isNonEmptyString(place && place.id) ? place.id : `index ${i}`;
      const where = `${label}`;

      if (!isPlainObject(place)) { fail(`data/restaurants.json → index ${i}`, 'must be an object'); return; }

      for (const key of REQUIRED_KEYS) {
        if (!(key in place)) fail(where, `is missing "${key}"`);
      }
      for (const key of Object.keys(place)) {
        if (!KNOWN_KEYS.has(key)) warn(where, `has an unknown key "${key}" — typo?`);
      }

      /* id */
      if (!isNonEmptyString(place.id)) {
        fail(where, '"id" must be a non-empty string');
      } else {
        if (!SLUG.test(place.id)) {
          fail(where, `id "${place.id}" is not a lowercase slug (a-z, 0-9 and single hyphens)`);
        }
        if (seenIds.has(place.id)) fail(where, `id "${place.id}" is used more than once`);
        seenIds.add(place.id);
      }

      /* name, address */
      if (!isNonEmptyString(place.name)) fail(where, '"name" must be a non-empty string');
      else if (isNonEmptyString(place.id)) placeNames.set(place.id, place.name);
      if (!isNonEmptyString(place.address)) fail(where, '"address" must be a non-empty string');

      /* coordinates */
      const { lat, lng } = place;
      if (typeof lat !== 'number' || !Number.isFinite(lat)) {
        fail(where, '"lat" must be a number');
      } else if (lat < BBOX.latMin || lat > BBOX.latMax) {
        fail(where, `lat ${lat} is outside Tallinn (${BBOX.latMin}–${BBOX.latMax}) — lat and lng swapped?`);
      }
      if (typeof lng !== 'number' || !Number.isFinite(lng)) {
        fail(where, '"lng" must be a number');
      } else if (lng < BBOX.lngMin || lng > BBOX.lngMax) {
        fail(where, `lng ${lng} is outside Tallinn (${BBOX.lngMin}–${BBOX.lngMax}) — lat and lng swapped?`);
      }

      /* price — whole bands and the half steps between them: 1, 1.5, ... 4 */
      if (typeof place.price !== 'number' || !Number.isFinite(place.price) ||
          place.price < 1 || place.price > 4 || (place.price * 2) % 1 !== 0) {
        fail(where, `"price" must be 1 to 4 in steps of 0.5, got ${JSON.stringify(place.price)}`);
      }

      /* types */
      if (!Array.isArray(place.types)) {
        fail(where, '"types" must be an array of type ids');
      } else {
        const seenHere = new Set();
        place.types.forEach((id) => {
          if (!isNonEmptyString(id)) { fail(where, 'has an empty value in "types"'); return; }
          if (seenHere.has(id)) warn(where, `lists the type "${id}" twice`);
          seenHere.add(id);
          usedTypes.add(id);
          if (typeIds.size > 0 && !typeIds.has(id)) {
            fail(where, `uses the type "${id}", which is not in data/taxonomy.json`);
          }
        });
      }

      /* blurb */
      if (!isPlainObject(place.blurb)) {
        fail(where, '"blurb" must be an object keyed by language');
      } else {
        const written = languages.filter((lang) => isNonEmptyString(place.blurb[lang]));
        if (written.length === 0) {
          fail(where, '"blurb" has no text in any language');
        } else {
          for (const lang of languages) {
            if (!isNonEmptyString(place.blurb[lang])) warn(where, `blurb has no "${lang}" translation`);
          }
        }
        for (const key of Object.keys(place.blurb)) {
          if (!languages.includes(key)) warn(where, `blurb has an extra language "${key}" that is not in ui.json`);
        }
        for (const lang of written) {
          /* TODO and PLACEHOLDER are matched in caps only, the way anyone
             actually leaves them. Case-insensitive caught "o dia todo", which
             is ordinary Portuguese and not a note to self. */
          if (/\bTODO\b|\bPLACEHOLDER\b/.test(place.blurb[lang]) ||
              /lorem ipsum/i.test(place.blurb[lang])) {
            warn(where, `blurb (${lang}) is still a placeholder`);
          }
        }
        /* House style: no em or en dashes in the prose. They kept creeping in
           and had to be swept out by hand once already. */
        for (const lang of written) {
          if (/[\u2014\u2013]/.test(place.blurb[lang])) {
            warn(where, `blurb (${lang}) contains an em or en dash`);
          }
        }
      }

      /* mustOrder */
      if (!Array.isArray(place.mustOrder)) {
        fail(where, '"mustOrder" must be an array (use [] when there is nothing yet)');
      } else if (place.mustOrder.some((d) => !isNonEmptyString(d))) {
        fail(where, '"mustOrder" has an empty entry');
      }

      /* reel */
      if (typeof place.reel !== 'string') {
        fail(where, '"reel" must be a string ("" when there is no reel yet)');
      } else if (place.reel === '') {
        warn(where, 'has no reel yet');
      } else if (!isReel(place.reel)) {
        fail(where, `reel "${place.reel}" is not a video permalink — expected https://www.instagram.com/reel/SHORTCODE/ or https://www.tiktok.com/@user/video/ID`);
      }

      /* photos */
      if (!Array.isArray(place.photos)) {
        fail(where, '"photos" must be an array of filenames');
      } else if (isNonEmptyString(place.id)) {
        place.photos.forEach((file) => {
          if (!isNonEmptyString(file)) { fail(where, 'has an empty entry in "photos"'); return; }
          if (!PHOTO_FILE.test(file)) {
            fail(where, `photo "${file}" should be a bare filename such as 01.webp, with no folders in it`);
            return;
          }
          const abs = join(PHOTOS, place.id, file);
          if (!existsSync(abs)) fail(where, `photo "${file}" is listed but photos/${place.id}/${file} does not exist`);
        });
      }

      /* website — optional; "" and a missing key both mean "no website" */
      if ('website' in place && place.website !== '') {
        if (!isNonEmptyString(place.website) || !HTTP_URL.test(place.website)) {
          fail(where, '"website" must be a full http(s) URL, or "" / the key left out');
        }
      }

      /* phone — optional; "" and a missing key both mean "no number", and the
         panel drops the Call button rather than showing a dead one. */
      if ('phone' in place && place.phone !== '') {
        if (!isNonEmptyString(place.phone) || !PHONE.test(place.phone)) {
          fail(where, `"phone" must look like +372 661 0180, or be "" / the key left out, got ${JSON.stringify(place.phone)}`);
        }
      } else if (!place.closed) {
        warn(where, 'has no "phone", so there is nothing to call');
      }

      /* added — the day this place first appeared in this file. It used to
         drive a "Just added" section at the top of the list panel; that
         section is gone, so nothing on the site reads this any more and a
         place without one is not missing anything. It stays as a record of
         when each place went in — the dates were read out of this repo's own
         git history — and admin.html still stamps one on every place it
         creates, so it is still held to being a real date when it is there.
         What went with the section is the warning for a missing one: there is
         no longer anything for it to nag you towards. */
      if ('added' in place) {
        if (!isNonEmptyString(place.added) || !/^\d{4}-\d{2}-\d{2}$/.test(place.added)) {
          fail(where, `"added" must look like 2026-08-25, got ${JSON.stringify(place.added)}`);
        }
      }

      /* visited — optional, but must be a real month when present */
      if ('visited' in place) {
        if (!isNonEmptyString(place.visited) || !MONTH.test(place.visited)) {
          fail(where, `"visited" must look like 2026-02 or be left out entirely, got ${JSON.stringify(place.visited)}`);
        }
      } else if (place.reel) {
        warn(where, 'has a video but no "visited" month');
      }

      /* closed */
      if (typeof place.closed !== 'boolean') {
        fail(where, '"closed" must be true or false');
      }
    });
  }
}

/* ---------------------------------------------------------------- deals.json
   Optional. Missing, empty, or full of switched-off entries all mean the same
   thing to the site: no place shows a discount. What is checked here is that
   an entry which IS switched on cannot be half-finished — a deal pointing at
   a place that does not exist, or with no words to show a guest, would reach
   the till before anyone noticed.

   The keys are not secrets. They ship in a public file on a static site and
   anyone can read them; the hourly rotation is what does the work. See the
   README before treating one as though it were private.

   A deal may carry a roll — { base, spread, step } — instead of one rate,
   and then its offer line writes {rate} where the number goes: the pass
   pages fill in the rate that was drawn and the map the run it could be.
   The three numbers are held to a run that stays inside 1–99 and to a
   spread that is a whole number of steps, so the code that walks the run
   never has to think about either; the staff page lists one code per rate,
   which is why a long run is warned about. */

const DEAL_KEYS = new Set(['id', 'name', 'live', 'key', 'offer', 'terms', 'from', 'until', 'roll']);
const DEAL_KEY_CHARS = /^[0-9A-HJKMNP-TV-Z]{16,64}$/;
const ROLL_KEYS = ['base', 'spread', 'step'];
const ROLL_MAX_RATES = 12;
const RATE_SLOT = '{rate}';
const DAY = /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

const dealsPath = join(DATA, 'deals.json');
const deals = existsSync(dealsPath) ? readJSON('data/deals.json') : [];
const seenDeals = new Set();
const seenKeys = new Set();

if (deals !== null && !Array.isArray(deals)) {
  fail('data/deals.json', 'the top level must be an array');
} else if (Array.isArray(deals)) {
  deals.forEach((deal, i) => {
    const where = `data/deals.json[${i}]`;
    if (!isPlainObject(deal)) { fail(where, 'must be an object'); return; }

    for (const key of Object.keys(deal)) {
      if (!DEAL_KEYS.has(key)) warn(where, `unknown key "${key}"`);
    }

    if (!isNonEmptyString(deal.id) || !SLUG.test(deal.id)) {
      fail(where, '"id" must be a lowercase slug');
    } else {
      if (seenDeals.has(deal.id)) fail(where, `duplicate deal for "${deal.id}"`);
      seenDeals.add(deal.id);
      /* The id is the join to restaurants.json, and a deal for a place that
         is not on the map can never be opened from it. */
      if (seenIds.size && !seenIds.has(deal.id)) {
        fail(where, `"${deal.id}" is not a place in restaurants.json`);
      }
    }

    /* The restaurant's name, copied from restaurants.json so that deal.html,
       verify.html and staff.html never have to load it. Copied data goes
       stale, so this is the check that stops it: rename a place on the map
       and CI says so here rather than a guest finding the old name over the
       QR code. */
    if (!isNonEmptyString(deal.name)) {
      fail(where, '"name" must be the restaurant\'s name, copied from restaurants.json');
    } else if (placeNames.has(deal.id) && placeNames.get(deal.id) !== deal.name) {
      fail(where, `"name" is "${deal.name}" but restaurants.json calls this place "${placeNames.get(deal.id)}"`);
    }

    if (typeof deal.live !== 'boolean') {
      fail(where, '"live" must be true or false — leave it false until the restaurant has agreed');
    }

    if (!isNonEmptyString(deal.key) || !DEAL_KEY_CHARS.test(deal.key)) {
      fail(where, '"key" must be 16 to 64 characters from the code alphabet (0-9 A-Z, no I L O U)');
    } else if (seenKeys.has(deal.key)) {
      /* Two places sharing a key means either one verifies the other's
         codes, which is the one way this can go quietly wrong. */
      fail(where, 'two deals share a key — every place needs its own');
    } else {
      seenKeys.add(deal.key);
    }

    for (const field of ['offer', 'terms']) {
      if (deal[field] === undefined) continue;
      if (!isPlainObject(deal[field])) { fail(where, `"${field}" must be an object of translations`); continue; }
      for (const lang of Object.keys(deal[field])) {
        if (!languages.includes(lang)) fail(where, `"${field}" has unknown language "${lang}"`);
        else if (!isNonEmptyString(deal[field][lang])) fail(where, `"${field}.${lang}" is empty`);
      }
    }

    const rolled = deal.roll !== undefined;
    if (rolled) {
      const roll = deal.roll;
      if (!isPlainObject(roll)) {
        fail(where, '"roll" must be an object like { "base": 15, "spread": 10, "step": 5 }');
      } else {
        for (const key of Object.keys(roll)) {
          if (!ROLL_KEYS.includes(key)) warn(where, `unknown key "roll.${key}"`);
        }
        const whole = ROLL_KEYS.every((key) => Number.isInteger(roll[key]));
        if (!whole) {
          fail(where, '"roll" needs whole numbers for "base", "spread" and "step"');
        } else if (roll.step < 1 || roll.spread < roll.step || roll.spread % roll.step !== 0) {
          /* A spread smaller than the step is a fixed rate wearing a roll, and
             one that is not a whole number of steps would land the top and
             bottom of the run off the step everything else is on. */
          fail(where, '"roll.spread" must be a whole number of "roll.step"s, and at least one');
        } else if (roll.base - roll.spread < 1 || roll.base + roll.spread > 99) {
          fail(where, `"roll" runs from ${roll.base - roll.spread}% to ${roll.base + roll.spread}% — every rate has to be between 1 and 99`);
        } else if (roll.spread / roll.step * 2 + 1 > ROLL_MAX_RATES) {
          warn(where, `"roll" has ${roll.spread / roll.step * 2 + 1} rates, and the counter's screen lists a code for each of them`);
        }
      }
    }

    /* The number in the offer line is the rate, so a rolled deal's line has
       to leave room for whichever one is drawn, and a fixed deal's must not
       print a placeholder nothing will fill. */
    if (isPlainObject(deal.offer)) {
      for (const lang of Object.keys(deal.offer)) {
        const has = typeof deal.offer[lang] === 'string' && deal.offer[lang].includes(RATE_SLOT);
        if (rolled && !has) fail(where, `"offer.${lang}" needs ${RATE_SLOT} where the drawn rate goes, since this deal has a roll`);
        if (!rolled && has) fail(where, `"offer.${lang}" writes ${RATE_SLOT}, which only a deal with a "roll" fills in`);
      }
    }

    for (const field of ['from', 'until']) {
      if (deal[field] === undefined) continue;
      if (!isNonEmptyString(deal[field]) || !DAY.test(deal[field])) {
        fail(where, `"${field}" must be a date like 2026-09-01`);
      }
    }
    if (deal.from && deal.until && DAY.test(deal.from) && DAY.test(deal.until) && deal.from > deal.until) {
      fail(where, '"from" is after "until", so the deal can never run');
    }

    /* A live deal is about to be shown to a stranger, so it is held to more
       than a dormant one: it needs words, and it needs them in English at
       minimum, which is what every page falls back to. */
    if (deal.live === true) {
      if (!isPlainObject(deal.offer) || !isNonEmptyString(deal.offer.en)) {
        fail(where, 'a live deal needs "offer.en" — that is the line the guest and the waiter both read');
      }
      for (const lang of languages) {
        if (isPlainObject(deal.offer) && !isNonEmptyString(deal.offer[lang])) {
          warn(where, `live deal has no "offer" in ${lang}`);
        }
      }
      if (deal.until && DAY.test(deal.until) && deal.until < todayStamp()) {
        warn(where, `is live but finished on ${deal.until}`);
      }
    }
  });
}

function todayStamp() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/* -------------------------------------------------------------- stories.json
   Optional, and empty most of the time: a story is up for a day and then it
   is not. What is checked is that one which IS live can actually be watched —
   the video is in the repo, the clock reads forwards, and the link it carries
   goes somewhere that exists. A story is on screen for six seconds with no
   way back to it, so there is no version of "the reader will work it out".

   Times are Tallinn wall clock, "2026-09-14T21:00", because that is the clock
   the person writing the file and the person watching the video are both
   reading. assets/app.js turns them into instants, and tools/clock.mjs works
   out the window an entry stands for: "from" plus 36 hours unless "until"
   says otherwise. */

const STORY_KEYS = new Set(['id', 'live', 'video', 'photo', 'seconds', 'poster', 'from', 'until', 'caption', 'spot', 'link', 'linkLabel']);
const STAMP = /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]$/;
const VIDEO_FILE = /^[A-Za-z0-9._-]+\.(mp4|webm|mov|m4v)$/i;
/* Two ceilings on a story file, and only one of them is negotiable. Cloudflare
   Pages refuses to serve anything over 25 MB at all, so that is a failure;
   stories/README.md asks for eight, because a phone on a tram gives up long
   before a file that size arrives, and that is worth saying rather than
   stopping for. */
const PAGES_LIMIT = 25 * 1024 * 1024;
const STORY_BUDGET = 8 * 1024 * 1024;
const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;
const POSTER_FILE = /^[A-Za-z0-9._-]+\.(webp|jpg|jpeg|png|avif)$/i;
/* Where an explicitly written "until" stops being a story. Two days is what
   the README has always said is the most anyone will wait, and the default
   window is a day and a half, so this only ever fires on a deliberate one. */
const LONG_WINDOW_MS = 48 * HOUR_MS;

const STORIES = join(ROOT, 'stories');
const storiesPath = join(DATA, 'stories.json');
const stories = existsSync(storiesPath) ? readJSON('data/stories.json') : [];
const seenStories = new Set();
const usedStoryFiles = new Set();

if (stories !== null && !Array.isArray(stories)) {
  fail('data/stories.json', 'the top level must be an array');
} else if (Array.isArray(stories)) {
  stories.forEach((story, i) => {
    const where = `data/stories.json[${i}]`;
    if (!isPlainObject(story)) { fail(where, 'must be an object'); return; }

    for (const key of Object.keys(story)) {
      if (!STORY_KEYS.has(key)) warn(where, `unknown key "${key}"`);
    }

    if (!isNonEmptyString(story.id) || !SLUG.test(story.id)) {
      fail(where, '"id" must be a lowercase slug');
    } else if (seenStories.has(story.id)) {
      /* Watched is remembered per id, so two stories sharing one would each
         mark the other as seen and the ring would go grey a story early. */
      fail(where, `duplicate story id "${story.id}"`);
    } else {
      seenStories.add(story.id);
    }

    if (typeof story.live !== 'boolean') {
      fail(where, '"live" must be true or false');
    }

    /* A story is one thing or the other. Both would be two stories filed as
       one, and the viewer would have to pick — which is a decision nobody
       writing the file meant to hand it. */
    if (story.video !== undefined && story.photo !== undefined) {
      fail(where, 'a story is either a "video" or a "photo", not both');
    } else if (story.video === undefined && story.photo === undefined) {
      fail(where, 'a story needs a "video" or a "photo"');
    }

    if (story.video !== undefined) {
      if (!isNonEmptyString(story.video) || !VIDEO_FILE.test(story.video)) {
        fail(where, '"video" must be a filename inside stories/, such as "kokomo-brunch.mp4"');
      } else {
        usedStoryFiles.add(story.video);
        const file = join(STORIES, story.video);
        if (!existsSync(file)) {
          fail(where, `"stories/${story.video}" is not in the repo`);
        } else {
          /* A story posted from a phone lands in whatever that browser could
             write, and .github/workflows/story-media.yml converts it within a
             minute or two. So this says what is wrong rather than stopping:
             the story is watchable by most of the people looking at it in the
             meantime, and by all of them shortly after. */
          if (/\.(mov|m4v)$/i.test(story.video)) {
            warn(where, `"${story.video}" is a QuickTime file — story-media.yml re-wraps it as .mp4, or run the ffmpeg line in stories/README.md`);
          } else if (/\.webm$/i.test(story.video)) {
            warn(where, `"${story.video}" is a WebM, which Safari will not play — story-media.yml converts it to .mp4`);
          }
          const bytes = statSync(file).size;
          if (bytes > PAGES_LIMIT) {
            fail(where, `"stories/${story.video}" is ${mb(bytes)} — Cloudflare Pages refuses to serve a file over ${mb(PAGES_LIMIT)}`);
          } else if (bytes > STORY_BUDGET) {
            warn(where, `"stories/${story.video}" is ${mb(bytes)} — stories/README.md asks for under ${mb(STORY_BUDGET)}`);
          }
        }
      }
    }

    if (story.photo !== undefined) {
      if (!isNonEmptyString(story.photo) || !POSTER_FILE.test(story.photo)) {
        fail(where, '"photo" must be an image filename inside stories/, such as "kokomo-window.webp"');
      } else {
        usedStoryFiles.add(story.photo);
        if (!existsSync(join(STORIES, story.photo))) {
          fail(where, `"stories/${story.photo}" is not in the repo`);
        }
      }
    }

    /* Seconds are what a photograph has instead of a length, so they mean
       nothing next to a video, and a photograph nobody can read in the time
       given is worse than no photograph. */
    if (story.seconds !== undefined) {
      if (typeof story.seconds !== 'number' || !isFinite(story.seconds)
          || story.seconds < 2 || story.seconds > 20) {
        fail(where, '"seconds" must be a number between 2 and 20');
      } else if (story.video !== undefined) {
        warn(where, '"seconds" does nothing on a video — the file already has a length');
      }
    }

    if (story.poster !== undefined) {
      if (!isNonEmptyString(story.poster) || !POSTER_FILE.test(story.poster)) {
        fail(where, '"poster" must be an image filename inside stories/');
      } else {
        usedStoryFiles.add(story.poster);
        if (!existsSync(join(STORIES, story.poster))) {
          fail(where, `"stories/${story.poster}" is not in the repo`);
        }
        if (story.photo !== undefined) {
          warn(where, '"poster" does nothing on a photo story — the photo is already the picture');
        }
      }
    }

    for (const field of ['from', 'until']) {
      if (story[field] === undefined) continue;
      if (!isNonEmptyString(story[field]) || !STAMP.test(story[field])) {
        fail(where, `"${field}" must be a Tallinn date and time like 2026-09-14T21:00`);
      }
    }
    /* The countdown is the point: a story is a thing that goes away, so it has
       to be possible to say when. It rarely has to be written down, though —
       "from" and the 36 hours every story gets is the usual way to say it, and
       the only one that survives being scheduled a week out and forgotten. */
    const window = storyWindow(story);
    if (!window.until) {
      fail(where, '"from" or "until" is required — without one of them nothing knows when the story goes away');
    } else if (window.from && window.fromMs >= window.untilMs) {
      fail(where, '"from" is not before "until", so the story can never be up');
    } else if (window.explicit && window.from && window.untilMs - window.fromMs > LONG_WINDOW_MS) {
      const hours = Math.round((window.untilMs - window.fromMs) / HOUR_MS);
      warn(where, `stands for ${hours} hours — a story gets ${STORY_HOURS}, and past two days nobody is hurrying. Leave "until" out for the default, or make it a "reel" on the place.`);
    }

    for (const field of ['caption', 'linkLabel']) {
      if (story[field] === undefined) continue;
      if (!isPlainObject(story[field])) { fail(where, `"${field}" must be an object of translations`); continue; }
      for (const lang of Object.keys(story[field])) {
        if (!languages.includes(lang)) fail(where, `"${field}" has unknown language "${lang}"`);
        else if (!isNonEmptyString(story[field][lang])) fail(where, `"${field}.${lang}" is empty`);
      }
    }

    /* One link, and one only. Two would put two buttons' worth of intent
       behind one, and whichever the code picked would be a surprise. */
    if (story.spot !== undefined && story.link !== undefined) {
      fail(where, 'a story carries either "spot" or "link", not both');
    }
    if (story.spot !== undefined) {
      if (!isNonEmptyString(story.spot) || !SLUG.test(story.spot)) {
        fail(where, '"spot" must be a place id from restaurants.json');
      } else if (seenIds.size && !seenIds.has(story.spot)) {
        fail(where, `"${story.spot}" is not a place in restaurants.json`);
      }
    }
    if (story.link !== undefined && (!isNonEmptyString(story.link) || !HTTP_URL.test(story.link))) {
      fail(where, '"link" must be a full http(s) address');
    }

    /* A live story is on somebody's screen right now, so it is held to more
       than a draft: it needs to still be running, and to say something in
       English at minimum, which is what every language falls back to. */
    if (story.live === true) {
      if (window.until && window.untilMs <= Date.now()) {
        warn(where, `is live but ran out on ${window.until.replace('T', ' ')} — \`node tools/stories.mjs --tick\` files it away`);
      }
      if (isPlainObject(story.caption) && !isNonEmptyString(story.caption.en)) {
        warn(where, 'has a caption but none in English, which is the fallback every language uses');
      }
    }
  });
}

if (existsSync(STORIES)) {
  for (const entry of readdirSync(STORIES)) {
    if (entry === 'README.md') continue;
    if (statSync(join(STORIES, entry)).isDirectory()) {
      warn('stories/', `"${entry}/" is a folder — stories are single files named in data/stories.json`);
    } else if (!usedStoryFiles.has(entry)) {
      /* Not a failure: a video can sit in the repo for a day before its entry
         goes live. It is worth saying, because a story nobody wrote an entry
         for is a story nobody can watch. */
      warn('stories/', `"${entry}" is not named by any story in data/stories.json`);
    }
  }
}

/* ----------------------------------------------------------------- blog.json
   The posts at /blog — one per thing this site does, what it does and why it
   does it that way. A flat file the page reads whole; there is no endpoint
   and nothing here reaches a database.

   Two things are worth failing a build over. An id is in the address of a
   post, so a duplicate one is two posts answering to the same link and a
   malformed one is a link that cannot be typed. And a post is prose in a
   language block, so a block in a language data/ui.json does not speak is
   words nobody on this site can ever be shown — the language switch only
   offers the ten, and the page has no other way to reach an eleventh.

   What is deliberately NOT checked is the thing ui.json is held to: a post
   does not need all ten languages. It is several hundred words of somebody's
   writing, the same as a story's caption or a place's blurb, and those have
   always been written in the languages they have been written in. English is
   required because it is what the page falls back to, and a reader whose
   language a post is not in is told so in their own. See "The blog" in
   README.md. */

const BLOG_KEYS = new Set(['id', 'date', 'link', 'title', 'standfirst', 'clip', 'body']);
const BLOG_SAID = ['title', 'standfirst', 'body'];

/* The four files one clip is: the looping picture and its first frame, in
   each of the two styles. tools/blogclips.mjs draws all four from one scene
   in clips/scenes/, and a post that says it has a clip and does not is a
   broken image on a page nobody would think to check. */
const CLIP_FILES = (id) => [`${id}.png`, `${id}-still.png`, `${id}-green.png`, `${id}-green-still.png`];
/* What a clip should not weigh. They come in near two hundred kilobytes; a
   megabyte means a scene that moves something enormous on every frame, or the
   dirty-rectangle arithmetic in the tool quietly failing, and both are worth
   being told about. */
const CLIP_BUDGET = 600 * 1024;

const CLIPS_DIR = join(ROOT, 'clips');
const usedClipFiles = new Set();

const blogPath = join(DATA, 'blog.json');
const blog = existsSync(blogPath) ? readJSON('data/blog.json') : [];
const seenPosts = new Set();

if (blog !== null && !Array.isArray(blog)) {
  fail('data/blog.json', 'the top level must be an array');
} else if (Array.isArray(blog)) {
  const today = todayStamp();

  blog.forEach((post, i) => {
    const where = `data/blog.json[${i}]`;
    if (!isPlainObject(post)) { fail(where, 'must be an object'); return; }

    for (const key of Object.keys(post)) {
      if (!BLOG_KEYS.has(key)) warn(where, `unknown key "${key}"`);
    }

    if (!isNonEmptyString(post.id) || !SLUG.test(post.id)) {
      fail(where, '"id" must be a lowercase slug — it is what ?post= names');
    } else if (seenPosts.has(post.id)) {
      fail(where, `duplicate post id "${post.id}" — two posts cannot share one address`);
    } else {
      seenPosts.add(post.id);
    }

    if (!isNonEmptyString(post.date) || !DAY.test(post.date)) {
      fail(where, '"date" must be a day, such as "2026-03-07"');
    } else if (post.date > today) {
      /* Every post is drawn, so a date after today is a post claiming to have
         been written tomorrow. Scheduling one is a story's job, not a post's. */
      fail(where, `"date" is ${post.date}, which is after today — every post on the page is drawn`);
    }

    /* An address on this site. The button at the foot of a post is "go and
       try it", and what it is offering to try is here. */
    if (post.link !== undefined && (!isNonEmptyString(post.link) || post.link[0] !== '/')) {
      fail(where, '"link" must be a path on this site, such as "/lists"');
    }

    /* The clip, when there is one: the sentence that says what it shows, and
       the four files it is. The sentence is what a reader who cannot see the
       picture is left with, so it is held to the same English-at-minimum rule
       the rest of the post is. */
    if (post.clip !== undefined) {
      if (!isPlainObject(post.clip)) {
        fail(where, '"clip" must be an object keyed by language, saying what the clip shows');
      } else {
        for (const lang of Object.keys(post.clip)) {
          if (!languages.includes(lang)) {
            fail(where, `"clip" is written in "${lang}", which data/ui.json does not speak`);
          } else if (!isNonEmptyString(post.clip[lang])) {
            fail(where, `"clip" in ${lang} must be a sentence — it is the alt on the picture`);
          }
        }
        if (!isNonEmptyString(post.clip.en)) {
          fail(where, '"clip" has no English, which is what every language falls back to');
        }
      }

      if (isNonEmptyString(post.id)) {
        for (const file of CLIP_FILES(post.id)) {
          usedClipFiles.add(file);
          const path = join(CLIPS_DIR, file);
          if (!existsSync(path)) {
            fail(where, `says it has a clip but "clips/${file}" is not in the repo — run \`node tools/blogclips.mjs --only ${post.id}\``);
          } else if (statSync(path).size > CLIP_BUDGET) {
            warn(where, `"clips/${file}" is ${mb(statSync(path).size)}, which is heavier than a clip should be`);
          }
        }
      }
    }

    /* The three things a post says, and they agree on their languages: a
       title in Estonian over paragraphs in English is a post that looks
       translated and is not. */
    const spoken = new Map();

    for (const field of BLOG_SAID) {
      const said = post[field];
      if (!isPlainObject(said)) {
        fail(where, `"${field}" must be an object keyed by language`);
        continue;
      }

      const langs = Object.keys(said);
      if (langs.length === 0) fail(where, `"${field}" says nothing in any language`);

      for (const lang of langs) {
        if (!languages.includes(lang)) {
          fail(where, `"${field}" is written in "${lang}", which data/ui.json does not speak`);
        }

        const value = said[lang];
        if (field === 'body') {
          if (!Array.isArray(value) || value.length === 0) {
            fail(where, `"body" in ${lang} must be an array of paragraphs`);
          } else if (!value.every(isNonEmptyString)) {
            fail(where, `"body" in ${lang} has a paragraph that is not text`);
          }
        } else if (!isNonEmptyString(value)) {
          fail(where, `"${field}" in ${lang} must be a sentence`);
        }
      }

      spoken.set(field, new Set(langs));
    }

    if (spoken.size === BLOG_SAID.length) {
      for (const lang of spoken.get('title')) {
        const short = BLOG_SAID.filter((field) => !spoken.get(field).has(lang));
        if (short.length > 0) {
          fail(where, `is in ${lang} but its ${short.join(' and ')} ${short.length === 1 ? 'is' : 'are'} not`);
        }
      }

      for (const field of BLOG_SAID) {
        if (!spoken.get(field).has('en')) {
          fail(where, `"${field}" has no English, which is what every language falls back to`);
        }
      }
    }
  });
}

/* The other way round: a picture in clips/ that no post names, and a scene
   that no post is. Neither fails — a scene can be written before the post it
   illustrates — but both are worth saying, because a clip nobody draws is
   bytes being served to nobody. */
if (existsSync(CLIPS_DIR)) {
  for (const entry of readdirSync(CLIPS_DIR)) {
    if (entry === 'scenes' || entry === 'README.md') continue;
    if (!usedClipFiles.has(entry)) {
      warn('clips/', `"${entry}" is not named by any post in data/blog.json`);
    }
  }

  const scenes = join(CLIPS_DIR, 'scenes');
  if (existsSync(scenes)) {
    for (const entry of readdirSync(scenes)) {
      if (!entry.endsWith('.html')) continue;
      const id = entry.replace(/\.html$/, '');
      if (!seenPosts.has(id)) {
        warn('clips/scenes/', `"${entry}" is a scene for no post in data/blog.json`);
      }
    }
  }
}

/* --------------------------------------------------------------- places.json
   The catalogue a list draws from: the map, plus whatever came out of
   data/places.csv. Generated by tools/places.mjs and never edited by hand, so
   most of what is checked here is that it is still what that tool would write.

   The rest is the part that cannot be re-derived. A catalogue id gets written
   into somebody's list, in a database this script cannot see, so the two
   things worth failing a build over are an id that is not a usable id and two
   places answering to the same one — either of which would put a sentence
   somebody wrote against the wrong restaurant. */

const catalogue = readJSON('data/places.json');
const catalogueIds = new Set();

if (catalogue !== null) {
  if (!Array.isArray(catalogue)) {
    fail('data/places.json', 'must be an array of places');
  } else {
    catalogue.forEach((place, i) => {
      const where = `data/places.json → [${i}]`;
      if (!isPlainObject(place)) { fail(where, 'must be an object'); return; }
      if (!isNonEmptyString(place.id)) { fail(where, 'has no "id"'); return; }
      if (!SLUG.test(place.id)) fail(where, `id "${place.id}" is not a lowercase slug`);
      if (catalogueIds.has(place.id)) {
        fail(where, `id "${place.id}" is used twice — a list item pointing at it could not say which place it meant`);
      }
      catalogueIds.add(place.id);
      if (!isNonEmptyString(place.name)) fail(where, `"${place.id}" has no name`);

      /* Coordinates are optional here, unlike on the map: a place somebody
         exported from Google with no pin still belongs in the catalogue, it
         just cannot be put on one. Present, they have to be real. */
      const pinned = place.lat !== undefined || place.lng !== undefined;
      if (pinned) {
        if (typeof place.lat !== 'number' || typeof place.lng !== 'number') {
          fail(where, `"${place.id}" has one coordinate without the other, or a non-number`);
        }
      }
    });

    /* Every place on the map has to be in the catalogue, or a list could not
       hold one — which would be the odd result of a feature built on top of
       the map not being able to name anything on it. */
    for (const id of seenIds) {
      if (!catalogueIds.has(id)) {
        fail('data/places.json', `"${id}" is on the map but not in the catalogue — run \`node tools/places.mjs\``);
      }
    }
  }
}

/* ------------------------------------------------------- google-venues.sql
   db/google-venues.sql is what loads the 1,110-venue Google Places export into
   D1, and it is generated from exports/tallinn_restaurants.csv. A deploy where
   the export moved and the SQL did not would be a database holding last
   month's Tallinn, so the two are checked against each other here the same way
   the asset stamps are. */

if (staleGoogleVenues()) {
  fail('db/google-venues.sql', 'is not what tools/googlevenues.mjs would write from exports/tallinn_restaurants.csv — run `node tools/googlevenues.mjs` and commit the result');
}

/* And the six lists Google wrote, which are the same export ordered — so a
   refresh of the export moves them too, and a deploy where the lists say
   last month's top ten is the same fault as the table above saying last
   month's Tallinn. */
if (staleGoogleLists()) {
  fail('db/google-lists.sql', 'is not what tools/googlelists.mjs would write from exports/tallinn_restaurants.csv — run `node tools/googlelists.mjs` and commit the result');
}

/* And the ground every list on /lists is drawn on, which is the same export
   again — about eleven hundred coordinates and nothing else. A refresh that
   moved the export and not this leaves the directory drawing last month's
   city under this month's lists: quieter than a stale table, because the
   panel still looks like a panel, and so worth the same check. */
if (staleCity()) {
  fail('data/city.json', 'is not what tools/city.mjs would write from exports/tallinn_restaurants.csv — run `node tools/city.mjs` and commit the result');
}

/* ---------------------------------------------------------- type-lists.sql
   And the thirteen the map wrote: one list per filter chip, generated from
   data/restaurants.json and data/taxonomy.json. A place added to the map is a
   place missing from a list until this is re-run, the same way it is a place
   missing from the catalogue. */
if (staleTypeLists()) {
  fail('db/type-lists.sql', 'is not what tools/typelists.mjs would write from data/restaurants.json and data/taxonomy.json — run `node tools/typelists.mjs` and commit the result');
}

/* And that the API would accept what it holds. These lists are loaded by
   hand, past the route that enforces MAX_ITEMS, so nothing else would notice
   a chip that has grown past what a list can hold until somebody opened one
   and could not drag a row. Casual/Solo is the one that gets there first.

   The catch is the other half and the likelier one: build() throws by name
   when a chip has no list or a list has no chip, and without this that
   arrives as the staleness line above, which says to run a tool that throws. */
try {
  for (const list of buildTypeLists().lists) {
    if (list.places.length > MAX_ITEMS) {
      fail('db/type-lists.sql', `"${list.title}" holds ${list.places.length} places and a list holds ${MAX_ITEMS} — raise MAX_ITEMS in functions/api/lists.js, and in assets/lists.js with it`);
    }
  }
} catch (e) {
  fail('tools/typelists.mjs', `cannot build db/type-lists.sql: ${e.message}`);
}

/* And that it is current. data/places.csv is the file that actually changes,
   and a deploy where it has moved and this has not would show a picker that
   disagrees with what the API will accept. */
if (staleCatalogue()) {
  fail('data/places.json', 'is not what tools/places.mjs would write from data/restaurants.json and data/places.csv — run `node tools/places.mjs` and commit the result');
}

/* -------------------------------------------------- taxonomy / photo sweeps */

for (const id of typeIds) {
  if (!usedTypes.has(id)) warn('data/taxonomy.json', `type "${id}" is not used by any place`);
}

if (existsSync(PHOTOS)) {
  for (const entry of readdirSync(PHOTOS)) {
    const abs = join(PHOTOS, entry);
    if (!statSync(abs).isDirectory()) continue;
    if (!seenIds.has(entry)) {
      warn('photos/', `folder "${entry}/" has no matching restaurant id in restaurants.json`);
    }
  }
}

/* --------------------------------------------------------------- schema.json
   Only checked for being parseable — it is documentation for your editor,
   not something this script enforces at runtime. */

readJSON('data/schema.json');

/* --------------------------------------------------------- wrangler.toml
   The preview deployments and the live site must not share a database. What
   keeps them apart is four lines of wrangler.toml, and the failure mode if
   those four lines are ever wrong is silent: a save pressed on a preview URL
   while checking a change lands in the live counts and there is nothing in
   the row to say it was not real. Nobody notices for weeks.

   So it is checked here, on every push, with the same weight as bad data.
   Not a parse of the whole TOML — this file has no dependencies and is not
   going to grow a TOML parser for four keys — but the two environment blocks
   are found, and what matters about them is read out of each:

     - both exist, so neither environment is falling back to the top level;
     - they name different database ids, which is the whole point;
     - each says which environment it is, because functions/api/_lib.js
       compares that against the database's own stamp at runtime and a
       missing one turns that check off.

   The top level is not checked for a database id, because Pages only reads
   it for `wrangler pages dev`. */

const WRANGLER = 'wrangler.toml';
const wrangler = (() => {
  const abs = join(ROOT, WRANGLER);
  if (!existsSync(abs)) { fail(WRANGLER, 'file is missing'); return ''; }
  try {
    return readFileSync(abs, 'utf8');
  } catch (err) {
    fail(WRANGLER, `could not be read (${err.message})`);
    return '';
  }
})();

if (wrangler) {
  /* Everything from a [[env.<name>....]] or [env.<name>....] header up to the
     next header, so a value is only ever read out of the block it is in. */
  const sectionsFor = (env) => {
    const out = [];
    const header = new RegExp(`^\\[\\[?env\\.${env}\\.[^\\]]+\\]\\]?\\s*$`);
    let inside = false;
    for (const line of wrangler.split(/\r?\n/)) {
      if (/^\s*\[/.test(line)) inside = header.test(line.trim());
      if (inside) out.push(line);
    }
    return out.join('\n');
  };

  const valueIn = (text, key) => {
    const m = text.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, 'm'));
    return m ? m[1] : '';
  };

  const seen = {};
  for (const env of ['preview', 'production']) {
    const where = `${WRANGLER} → [env.${env}]`;
    const text = sectionsFor(env);
    if (!text) {
      fail(where, `has no configuration at all — Pages would hand ${env} deployments the top-level bindings, which is how the two environments end up sharing one database`);
      continue;
    }

    const id = valueIn(text, 'database_id');
    const name = valueIn(text, 'database_name');
    if (!id) fail(where, 'declares no D1 database_id');
    if (!name) fail(where, 'declares no D1 database_name');
    seen[env] = { id, name };

    /* Non-inheritable keys are all-or-nothing per environment in Pages: an
       environment that overrides the binding and forgets the vars gets no
       vars at all, not the top-level ones. */
    const declared = valueIn(text, 'ENVIRONMENT');
    if (!declared) {
      fail(where, 'sets no ENVIRONMENT var — functions/api/_lib.js compares it against the database\'s own stamp, and without it a database bound to the wrong environment goes unnoticed');
    } else if (declared !== env) {
      fail(where, `says ENVIRONMENT = "${declared}"`);
    }
  }

  if (seen.preview && seen.production) {
    if (seen.preview.id && seen.preview.id === seen.production.id) {
      fail(WRANGLER, `preview and production are bound to the same database (${seen.production.id}) — every save pressed on a preview URL would land in the live counts`);
    }
    if (seen.preview.name && seen.preview.name === seen.production.name) {
      fail(WRANGLER, `preview and production name the same database ("${seen.production.name}")`);
    }
  }
}

/* -------------------------------------------------------- the design rules
   Two of the rules in the README's "The design rules" are mechanical, so they
   are checked here rather than left to be noticed in review.

   Everything else on that list is about judgement — a second filled button on
   a card, a step that should have been its own view — and a linter that could
   tell those from the legitimate cases would be a larger program than this
   site. */

/* 1. A string the site asks for that is in no language at all.

   The cross-language check above catches a key that one language has and
   another has not. This catches the other half: markup carrying a data-i18n
   key, or a script calling t('key'), for a string nobody ever wrote. Both
   show a visitor the key itself, which is the one failure mode of this
   system that looks like a bug in the page rather than a missing word. */

const I18N_ATTRS = ['data-i18n', 'data-i18n-aria-label', 'data-i18n-placeholder', 'data-i18n-title'];
const KEY_SHAPE = /^[a-z][A-Za-z0-9]*$/;

if (ui !== null && isPlainObject(ui)) {
  const known = new Set();
  for (const lang of Object.keys(ui)) {
    if (isPlainObject(ui[lang])) for (const key of Object.keys(ui[lang])) known.add(key);
  }
  /* SPLITWISE: split.html and assets/split.js draw theirs from data/split.json.
     Delete this line with the block above. */
  for (const key of splitKeys) known.add(key);

  const pages = readdirSync(ROOT).filter((f) => f.endsWith('.html'));
  for (const page of pages) {
    const text = readFileSync(join(ROOT, page), 'utf8');
    for (const attr of I18N_ATTRS) {
      const re = new RegExp(attr + '="([^"]+)"', 'g');
      let hit;
      while ((hit = re.exec(text)) !== null) {
        if (!known.has(hit[1])) fail(page, `asks for the string "${hit[1]}", which is in no language of data/ui.json or data/split.json`);
      }
    }
  }

  const ASSETS = join(ROOT, 'assets');
  const scripts = existsSync(ASSETS) ? readdirSync(ASSETS).filter((f) => f.endsWith('.js')) : [];
  for (const script of scripts) {
    /* Comparisons first: `t(out.error === 'capped' ? 'saveCapped' : …)` holds
       a string that is a value being tested and not a string id. */
    const text = readFileSync(join(ASSETS, script), 'utf8').replace(/[!=]==?\s*'[^']*'/g, '');
    const calls = text.match(/\bt\([^)]*\)/g) || [];
    for (const call of calls) {
      for (const lit of call.match(/'[^']*'/g) || []) {
        const key = lit.slice(1, -1);
        /* Only things shaped like a key. A t() call can hold a fallback or a
           separator, and neither is a missing string. */
        if (!KEY_SHAPE.test(key) || known.has(key)) continue;
        fail(`assets/${script}`, `calls t('${key}'), which is in no language of data/ui.json or data/split.json`);
      }
    }
  }
}

/* 1b. The pin tables, which are written out twice.

   functions/api/_pins.js holds the ids because the server is what decides
   whether the two strings a list wants to store are real; assets/pins.js
   holds the same ids plus the emoji each one draws, because the browser is
   what draws them. Neither can import the other — one is ESM on the Workers
   runtime and the other is ES5 served raw — so this is what keeps them the
   same table.

   And the labels with them. The picker builds its keys — pinKey('flame') is
   'pinFlame' — so the scanner above cannot see a single one of the eight, and
   a marker nobody had translated would reach a visitor as the word "pinFlame"
   on a swatch. The list is here, so they are checked the way a literal would
   have been. The five kinds of place are deliberately not checked for labels:
   nothing prints their names. */

{
  const pins = join(ROOT, 'assets', 'pins.js');
  if (!existsSync(pins)) {
    fail('assets/pins.js', 'is missing — every page that draws a pin loads it');
  } else {
    const text = readFileSync(pins, 'utf8');

    /* The two tables as the browser has them: the id out of each row, in the
       order they are written, which for MARKERS is the order the picker
       draws. */
    /* Each table read from its own opening line to its own closing bracket,
       rather than to whatever comment happens to follow it — a slice that
       ends at a comment reads the next table too the first time somebody
       rewrites that comment, and says the two files have drifted when they
       have not. */
    const ids = (from) => {
      const at = text.indexOf(from);
      if (at < 0) return [];
      const body = text.slice(at, text.indexOf('];', at));
      return (body.match(/^\s*\['([a-z-]+)',/gm) || [])
        .map((line) => line.replace(/^\s*\['/, '').replace(/',$/, ''));
    };
    const drawn = ids('var MARKERS = [');
    const places = ids('var PLACES = [');
    const tones = (text.match(/var TONES = \[([^\]]*)\]/) || [, ''])[1]
      .split(',').map((part) => part.trim().replace(/^'|'$/g, '')).filter(Boolean);

    const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    if (!same(drawn, PIN_GLYPHS)) {
      fail('assets/pins.js', `draws the markers [${drawn.join(', ')}], and functions/api/_pins.js allows [${PIN_GLYPHS.join(', ')}] — one of the two has moved`);
    }
    if (!tones.length) {
      fail('assets/pins.js', 'has no TONES list, so nothing says which colours the stylesheet has to carry');
    }
    /* And every colour a kind of place is filed under is one of them.
       A PLACES row naming a tone TONES has never heard of draws as the
       fallback accent and says nothing — the quietest way for the
       directory's map to stop telling the drinking half from the eating
       half, and the one the checks below would not have caught. */
    const placeTones = (text.slice(text.indexOf('var PLACES = ['), text.indexOf('];', text.indexOf('var PLACES = ['))
      ).match(/,\s*'([a-z-]+)'\]/g) || []).map((m) => m.replace(/^,\s*'/, '').replace(/'\]$/, ''));
    for (const tone of placeTones) {
      if (tones.indexOf(tone) < 0) {
        fail('assets/pins.js', `files a kind of place under the tone "${tone}", which is not in TONES — it would draw as the accent and say nothing`);
      }
    }
    if (!places.length) {
      fail('assets/pins.js', 'has no PLACES table, so no row off the Google export can say what kind of place it is');
    }
    /* The mouth is the mark and is never a choice. If it ever turns up in
       either table, a list could ask for it and the server would store it. */
    for (const id of [...drawn, ...places, ...PIN_GLYPHS]) {
      if (id === 'mark') fail('assets/pins.js', 'has "mark" among the glyphs a list may choose — the mouth goes on a place I have eaten at and nothing else');
    }
    /* And the two tables stay disjoint. A marker is what somebody chose about
       their list; a place glyph is what this site says a Google row IS. An id
       in both would let a list wear a cup, which is the list making a claim
       about a place rather than about itself — see the header of
       functions/api/_pins.js. */
    for (const id of places) {
      if (PIN_GLYPHS.indexOf(id) >= 0) {
        fail('assets/pins.js', `has "${id}" in both PLACES and the markers a list may choose — a list would be able to say what a place is`);
      }
    }
    if (PIN_GLYPHS.indexOf(DEFAULT_PIN) < 0) {
      fail('functions/api/_pins.js', `DEFAULT_PIN is "${DEFAULT_PIN}", which is not one of the glyphs`);
    }

    /* Every tone a pin can wear is a token the stylesheet declares, and both
       styles have to restate it — the check below is what proves the second
       half, and this is the first: a tone with no token at all would draw as
       the fallback in every style, and the kind it stands for would go quiet
       on the directory's map. */
    if (existsSync(join(ROOT, 'assets', 'styles.css'))) {
      const css = readFileSync(join(ROOT, 'assets', 'styles.css'), 'utf8');
      for (const tone of tones) {
        if (!css.includes(`--pin-${tone}:`)) {
          fail('assets/styles.css', `declares no --pin-${tone}, which assets/pins.js files a kind of place under — it would draw as the accent in both styles`);
        }
        if (!css.includes(`.pin-tone-${tone}`)) {
          fail('assets/styles.css', `has no .pin-tone-${tone} rule, so nothing can wear that tone`);
        }
      }
    }

    /* And the words. Built keys, checked as literals. */
    if (ui !== null && isPlainObject(ui)) {
      const known = new Set();
      for (const lang of Object.keys(ui)) {
        if (isPlainObject(ui[lang])) for (const key of Object.keys(ui[lang])) known.add(key);
      }
      const label = (prefix, id) =>
        prefix + id.replace(/-/g, '').charAt(0).toUpperCase() + id.replace(/-/g, '').slice(1);
      for (const id of PIN_GLYPHS) {
        const key = label('pin', id);
        if (!known.has(key)) fail('data/ui.json', `has no "${key}", which the pin picker asks for to name the ${id} glyph`);
      }
    }
  }
}

/* 1c. The three networks a profile can link to, which are written out twice.

   functions/api/_profile.js holds them because the server decides whether a
   handle is one before it stores it; assets/links.js holds the same three
   because the browser is what draws them and builds the address. Neither can
   import the other, so this is what keeps the two tables the same table —
   and the address in particular: a base that moved on one side only would
   send every link on every profile somewhere the other half never agreed to.
   Same arrangement as the pins above. */

{
  const links = join(ROOT, 'assets', 'links.js');
  if (!existsSync(links)) {
    fail('assets/links.js', 'is missing — /u/<name> and the account page both load it');
  } else {
    const text = readFileSync(links, 'utf8');
    /* Each row on its own line in that file, which is what makes this
       readable: the id, the address it builds, and the pattern that says
       what a handle on that site looks like. */
    const rows = (text.match(/^\s*\{ id: '[a-z]+',.*$/gm) || []).map((line) => ({
      id: (line.match(/id: '([a-z]+)'/) || [, ''])[1],
      base: (line.match(/base: '([^']+)'/) || [, ''])[1],
      re: (line.match(/re: (\/[^/]+\/)/) || [, ''])[1]
    }));

    const ids = (list) => list.map((n) => n.id).join(', ');
    if (ids(rows) !== ids(NETWORKS)) {
      fail('assets/links.js', `draws the networks [${ids(rows)}], and functions/api/_profile.js allows [${ids(NETWORKS)}] — one of the two has moved`);
    } else {
      for (const net of NETWORKS) {
        const drawn = rows.find((r) => r.id === net.id);
        if (drawn.base !== net.base) {
          fail('assets/links.js', `points ${net.id} at ${drawn.base}, and functions/api/_profile.js builds ${net.base} — a link would go somewhere the server never agreed to`);
        }
        /* The pattern is the cap — see the header of assets/links.js for why
           these three fields carry no maxlength — so this is what keeps the
           length in one place as well as the shape. */
        if (drawn.re !== String(net.re)) {
          fail('assets/links.js', `reads a ${net.id} handle as ${drawn.re} and functions/api/_profile.js as ${String(net.re)} — the page would accept a handle the server refuses, or refuse one it takes`);
        }
      }
    }
  }
}

/* 2. A colour token one style has and the other has not.

   Both styles are meant to restate every token, so that pressing the swatch
   changes the whole colour world. One that declares a token the other leaves
   out is a style wearing a value out of :root — which is the other style's,
   and reads as the one thing on the page that did not follow the swatch. */

const STYLE_BLOCK = /\[data-style="([a-z-]+)"\]\s*\{([^}]*)\}/g;
const cssPath = join(ROOT, 'assets', 'styles.css');
if (existsSync(cssPath)) {
  const css = readFileSync(cssPath, 'utf8');
  const declared = new Map();
  let block;
  while ((block = STYLE_BLOCK.exec(css)) !== null) {
    const names = new Set((block[2].match(/--[a-z0-9-]+\s*:/g) || []).map((d) => d.replace(/\s*:$/, '')));
    const already = declared.get(block[1]) || new Set();
    for (const name of names) already.add(name);
    declared.set(block[1], already);
  }

  const styles = [...declared.keys()];
  const everyToken = new Set();
  for (const style of styles) for (const name of declared.get(style)) everyToken.add(name);

  for (const style of styles) {
    for (const name of [...everyToken].sort()) {
      if (!declared.get(style).has(name)) {
        fail('assets/styles.css', `[data-style="${style}"] does not restate ${name}, which the other styles declare — it would wear whatever :root has`);
      }
    }
  }
}

/* ------------------------------------------------------------ asset stamps
   Every script and stylesheet is referenced with a hash of its own contents on
   the end, so a changed file is always a changed URL and no browser can pair
   an old copy of assets/app.js with today's restaurants.json. That guarantee
   is only worth anything if the stamps are current, so a stale one fails the
   build rather than shipping. See tools/stamp.mjs. */

for (const ref of staleStamps()) {
  fail(ref.page, ref.want === null
    ? `"${ref.asset}" is referenced but is not in the repo`
    : `"${ref.asset}" is stamped ${ref.got || '(nothing)'} but its contents hash to ${ref.want} — run \`node tools/stamp.mjs\` and commit the result`);
}

/* --------------------------------------------------------------- the head
   Three pages are served through a Function that swaps the block between
   their PAGE-HEAD markers for a head of that address's own — the map in the
   language ?lang= names, a list, a person, the directory, a group. rehead()
   in functions/_shell.js leaves a page alone when it cannot find both
   markers, so a page that lost one would go on answering at every address
   with its static head and nothing would say so. Exactly one of each, the
   opening one first. */

for (const page of ['index.html', 'lists.html', 'split.html', 'flashcard.html']) {
  const html = readFileSync(join(ROOT, page), 'utf8');
  const open = html.indexOf('<!--PAGE-HEAD-->');
  const close = html.indexOf('<!--/PAGE-HEAD-->');
  if (open === -1 || close === -1 || close < open) {
    fail(page, 'needs one <!--PAGE-HEAD--> marker and then one <!--/PAGE-HEAD--> marker — the Function that serves this page writes its head between them');
  } else if (html.indexOf('<!--PAGE-HEAD-->', open + 1) !== -1 || html.indexOf('<!--/PAGE-HEAD-->', close + 1) !== -1) {
    fail(page, 'carries a PAGE-HEAD marker twice — rehead() in functions/_shell.js swaps the first pair and leaves the rest as text');
  }
}

/* Two of those pages have a second thing written into them, outside the
   head: what the page is about, as text, into an element the page ships
   empty — the map's places into #list-body, a list or the directory or a
   person into the list page's <main>. fill() in functions/_shell.js matches
   the element's exact markup and does nothing when it is not there, so the
   spelling is held here rather than trusted. */
for (const [page, empty] of Object.entries(EMPTY)) {
  if (readFileSync(join(ROOT, page), 'utf8').indexOf(empty) === -1) {
    fail(page, `needs ${empty}, spelled exactly so and empty — the Function serving this page writes its text into it for the readers that run no script`);
  }
}

/* And the sitemap, which names the map at each of its ten addresses with a
   link to all ten on every one: a language added to ui.json without it is a
   page a search engine is never told about. */
if (staleSitemap()) {
  fail('sitemap.xml', 'is not what tools/sitemap.mjs would write from data/ui.json and tools/typelists.mjs — run `node tools/sitemap.mjs` and commit the result');
}

/* ---------------------------------------------------------------- reporting */

const count = places && Array.isArray(places) ? places.length : 0;

if (warnings.length) {
  console.log('');
  for (const w of warnings) console.log(`  warn  ${w}`);
}

if (errors.length) {
  console.log('');
  for (const e of errors) console.log(`  FAIL  ${e}`);
  console.log('');
  console.log(`${errors.length} error${errors.length === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}. Nothing was deployed.`);
  process.exit(1);
}

const liveDeals = Array.isArray(deals) ? deals.filter((d) => d && d.live === true).length : 0;
const liveStories = Array.isArray(stories)
  ? stories.filter((s) => s && storyPhase(s) === 'up').length
  : 0;

console.log('');
console.log(`OK — ${count} place${count === 1 ? '' : 's'}, ${typeIds.size} types, ${languages.length} languages (${languages.join(', ')}), ${liveDeals} live deal${liveDeals === 1 ? '' : 's'}, ${liveStories} live stor${liveStories === 1 ? 'y' : 'ies'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`);
