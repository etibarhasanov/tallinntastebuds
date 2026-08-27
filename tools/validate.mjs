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
 *   - a reel value that is not a real Instagram or TikTok permalink shape
 *   - a phone number that is not in international form, such as +372 661 0180
 *   - a deal in deals.json for a place that does not exist, sharing a key with
 *     another deal, or switched live with nothing written in it
 *
 * Warns on:
 *   - placeholder blurbs, missing reels, missing phone numbers, missing blurb translations
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

      /* added — the day this place first appeared in this file, which is what
         puts it in the "Just added" section. Optional, so an older file still
         validates, but a real date when it is there. */
      if ('added' in place) {
        if (!isNonEmptyString(place.added) || !/^\d{4}-\d{2}-\d{2}$/.test(place.added)) {
          fail(where, `"added" must look like 2026-08-25, got ${JSON.stringify(place.added)}`);
        }
      } else {
        warn(where, 'has no "added" date, so it can never show as newly added');
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
   README before treating one as though it were private. */

const DEAL_KEYS = new Set(['id', 'live', 'key', 'offer', 'terms', 'from', 'until']);
const DEAL_KEY_CHARS = /^[0-9A-HJKMNP-TV-Z]{16,64}$/;
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

const liveDeals = Array.isArray(deals) ? deals.filter((d) => d && d.live === true).length : 0;

console.log('');
console.log(`OK — ${count} place${count === 1 ? '' : 's'}, ${typeIds.size} types, ${languages.length} languages (${languages.join(', ')}), ${liveDeals} live deal${liveDeals === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`);
