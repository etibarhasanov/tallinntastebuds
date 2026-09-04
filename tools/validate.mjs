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
 *   - a catalogue in data/places.json that is not what tools/places.mjs would
 *     write, holds a duplicate id, or has lost a place that is on the map
 *   - a db/google-venues.sql that is out of step with the Google Places export
 *     it is generated from
 *   - a taxonomy type missing a label in any language
 *   - a UI string present in one language but missing in another
 *   - a string the site asks for — a data-i18n key in the markup, a t('key')
 *     in a script — that is in no language of data/ui.json at all
 *   - a colour token one style declares and another leaves out, which is a
 *     style quietly wearing the other one's value out of :root
 *   - a photo listed in the data that does not exist in the repo
 *   - a reel value that is not a real Instagram or TikTok permalink shape
 *   - a phone number that is not in international form, such as +372 661 0180
 *   - a deal in deals.json for a place that does not exist, sharing a key with
 *     another deal, switched live with nothing written in it, or carrying a
 *     name that restaurants.json disagrees with
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
import { stale as staleGoogleVenues } from './googlevenues.mjs';
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

const DEAL_KEYS = new Set(['id', 'name', 'live', 'key', 'offer', 'terms', 'from', 'until']);
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
   db/google-venues.sql is what loads the 751-venue Google Places export into
   D1, and it is generated from exports/tallinn_restaurants.csv. A deploy where
   the export moved and the SQL did not would be a database holding last
   month's Tallinn, so the two are checked against each other here the same way
   the asset stamps are. */

if (staleGoogleVenues()) {
  fail('db/google-venues.sql', 'is not what tools/googlevenues.mjs would write from exports/tallinn_restaurants.csv — run `node tools/googlevenues.mjs` and commit the result');
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

  const pages = readdirSync(ROOT).filter((f) => f.endsWith('.html'));
  for (const page of pages) {
    const text = readFileSync(join(ROOT, page), 'utf8');
    for (const attr of I18N_ATTRS) {
      const re = new RegExp(attr + '="([^"]+)"', 'g');
      let hit;
      while ((hit = re.exec(text)) !== null) {
        if (!known.has(hit[1])) fail(page, `asks for the string "${hit[1]}", which is in no language of data/ui.json`);
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
        fail(`assets/${script}`, `calls t('${key}'), which is in no language of data/ui.json`);
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
