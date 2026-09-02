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
 *   - a taxonomy type missing a label in any language
 *   - a UI string present in one language but missing in another
 *   - a photo listed in the data that does not exist in the repo
 *   - a reel value that is not a real Instagram or TikTok permalink shape
 *   - a phone number that is not in international form, such as +372 661 0180
 *   - a deal in deals.json for a place that does not exist, sharing a key with
 *     another deal, or switched live with nothing written in it
 *   - a story in stories.json with neither a start nor an end time, an end
 *     before its start, no video or photo (or both), a file that is not in
 *     the repo, or a link to a place that does not exist
 *
 * Warns on:
 *   - placeholder blurbs, missing reels, missing phone numbers, missing blurb translations
 *   - unused taxonomy types, photo folders with no matching restaurant
 *   - a story that is still switched on after its time ran out, a story asked
 *     to stand for much longer than the 36 hours one gets by default, and a
 *     video in stories/ that no story names
 *   - unknown keys in a restaurant object (catches typos)
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { stale as staleStamps } from './stamp.mjs';
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
        if (!existsSync(join(STORIES, story.video))) {
          fail(where, `"stories/${story.video}" is not in the repo`);
        } else if (/\.(mov|m4v)$/i.test(story.video)) {
          warn(where, `"${story.video}" is a QuickTime file — re-wrap it as .mp4 so every browser plays it`);
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
