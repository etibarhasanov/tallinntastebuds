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
 *   - a taxonomy type missing a label in any language
 *   - a UI string present in one language but missing in another
 *   - a photo listed in the data that does not exist in the repo
 *   - a reel value that is not a real Instagram permalink shape
 *
 * Warns on:
 *   - placeholder blurbs, missing reels, missing blurb translations
 *   - unused taxonomy types, photo folders with no matching restaurant
 *   - unknown keys in a restaurant object (catches typos)
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

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
const REEL = /^https:\/\/www\.instagram\.com\/(?:[A-Za-z0-9._]{1,30}\/)?(reel|reels|p|tv)\/[A-Za-z0-9_-]{5,}\/?(\?.*)?$/;
const PHOTO_FILE = /^[A-Za-z0-9._-]+\.(webp|jpg|jpeg|png|avif)$/i;
const HTTP_URL = /^https?:\/\/[^\s]+$/;

const KNOWN_KEYS = new Set([
  'id', 'name', 'address', 'lat', 'lng', 'price', 'types', 'blurb',
  'mustOrder', 'reel', 'photos', 'website', 'visited', 'closed'
]);

const REQUIRED_KEYS = [
  'id', 'name', 'address', 'lat', 'lng', 'price', 'types', 'blurb',
  'mustOrder', 'reel', 'photos', 'visited', 'closed'
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

/* --------------------------------------------------------- restaurants.json */

const places = readJSON('data/restaurants.json');
const seenIds = new Set();
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

      /* price */
      if (!Number.isInteger(place.price) || place.price < 1 || place.price > 4) {
        fail(where, `"price" must be a whole number from 1 to 4, got ${JSON.stringify(place.price)}`);
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
          if (/\bTODO\b|\bPLACEHOLDER\b|lorem ipsum/i.test(place.blurb[lang])) {
            warn(where, `blurb (${lang}) is still a placeholder`);
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
      } else if (!REEL.test(place.reel)) {
        fail(where, `reel "${place.reel}" is not an Instagram permalink (https://www.instagram.com/reel/SHORTCODE/)`);
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

      /* visited */
      if (!isNonEmptyString(place.visited) || !MONTH.test(place.visited)) {
        fail(where, `"visited" must look like 2026-02, got ${JSON.stringify(place.visited)}`);
      }

      /* closed */
      if (typeof place.closed !== 'boolean') {
        fail(where, '"closed" must be true or false');
      }
    });
  }
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

console.log('');
console.log(`OK — ${count} place${count === 1 ? '' : 's'}, ${typeIds.size} types, ${languages.length} languages (${languages.join(', ')}), ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`);
