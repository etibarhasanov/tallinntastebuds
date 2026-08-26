/* Tallinn Tastebuds — the rules a place has to satisfy.
 *
 * The same file is imported twice: by the editor in the browser, so it can
 * grey out Save and say why, and by functions/api/[[path]].js on the server,
 * so a hand-rolled request cannot put a broken array into the repo. Client
 * side validation is a courtesy; this being the *same* code is what makes the
 * server side trustworthy.
 *
 * It deliberately mirrors tools/validate.mjs, which stays the last word in CI.
 * That one reads the filesystem and cannot run in a Worker, so the shapes are
 * restated here rather than shared. Change a rule in one, change it in both.
 */

/* Tallinn's bounding box, generously drawn. Anything outside it is a typo:
   a swapped lat/lng lands near 24.7N 59.4E, in the Arabian Sea. */
export const BBOX = { latMin: 59.32, latMax: 59.52, lngMin: 24.50, lngMax: 25.00 };

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const DAY = /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
export const MONTH = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
export const PHOTO_FILE = /^[A-Za-z0-9._-]+\.(webp|jpg|jpeg|png|avif)$/i;
export const HTTP_URL = /^https?:\/\/[^\s]+$/;

const REEL_INSTAGRAM = /^https:\/\/www\.instagram\.com\/(?:[A-Za-z0-9._]{1,30}\/)?(reel|reels|p|tv)\/[A-Za-z0-9_-]{5,}\/?(\?.*)?$/;
const REEL_TIKTOK = /^https:\/\/www\.tiktok\.com\/@[A-Za-z0-9._]{1,30}\/video\/[0-9]{6,}\/?(\?.*)?$/;
export const isReel = (u) => REEL_INSTAGRAM.test(u) || REEL_TIKTOK.test(u);

export const KNOWN_KEYS = [
  'id', 'name', 'address', 'lat', 'lng', 'price', 'types', 'blurb',
  'mustOrder', 'reel', 'photos', 'website', 'added', 'visited', 'closed'
];

/* visited is deliberately absent: a place you have been to but not filmed has
   no post to date it from, so the key may be left out entirely. */
export const REQUIRED_KEYS = [
  'id', 'name', 'address', 'lat', 'lng', 'price', 'types', 'blurb',
  'mustOrder', 'reel', 'photos', 'closed'
];

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isFilled = (v) => typeof v === 'string' && v.trim().length > 0;

/* data/restaurants.json is roughly alphabetical by id, and the site sorts by
   name at render time anyway, so file order is cosmetic. The editor therefore
   never re-sorts an existing array — that would turn one added place into a
   whole-file diff — and only drops a new one into its alphabetical slot. */
export function insertPlace(places, place) {
  const out = places.slice();
  let at = out.findIndex((other) => String(other.id) > String(place.id));
  if (at < 0) at = out.length;
  out.splice(at, 0, place);
  return out;
}

/**
 * Check one place.
 *
 * @param {object} place
 * @param {object} ctx
 * @param {string[]} ctx.typeIds    every id in data/taxonomy.json
 * @param {string[]} ctx.languages  every language data/ui.json speaks
 * @param {string[]} ctx.photoFiles filenames that exist (or are being uploaded)
 *                                  in photos/<this place's id>/
 * @param {string[]} ctx.otherIds   the ids of every *other* place
 * @returns {{errors: string[], warnings: string[]}}
 */
export function validatePlace(place, ctx) {
  const errors = [];
  const warnings = [];
  const typeIds = ctx.typeIds || [];
  const languages = ctx.languages || [];
  const photoFiles = ctx.photoFiles || [];
  const otherIds = ctx.otherIds || [];

  if (!isObject(place)) return { errors: ['is not an object'], warnings };

  for (const key of REQUIRED_KEYS) {
    if (!(key in place)) errors.push(`"${key}" is missing`);
  }
  for (const key of Object.keys(place)) {
    if (!KNOWN_KEYS.includes(key)) warnings.push(`unknown key "${key}"`);
  }

  if (!isFilled(place.id)) errors.push('id is empty');
  else if (!SLUG.test(place.id)) errors.push('id must be a lowercase slug, like "paper-mill-coffee"');
  else if (otherIds.includes(place.id)) errors.push(`id "${place.id}" is already taken`);

  if (!isFilled(place.name)) errors.push('name is empty');
  if (!isFilled(place.address)) errors.push('address is empty');

  for (const [key, min, max] of [['lat', BBOX.latMin, BBOX.latMax], ['lng', BBOX.lngMin, BBOX.lngMax]]) {
    const v = place[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) errors.push(`${key} is not a number`);
    else if (v < min || v > max) errors.push(`${key} ${v} is outside Tallinn — are lat and lng the right way round?`);
  }

  if (!Number.isInteger(place.price) || place.price < 1 || place.price > 4) {
    errors.push('price must be a whole number from 1 to 4');
  }

  if (!Array.isArray(place.types)) {
    errors.push('types must be a list');
  } else {
    if (place.types.length === 0) warnings.push('has no types, so no chip will ever show it');
    for (const t of place.types) {
      if (!typeIds.includes(t)) errors.push(`type "${t}" is not in taxonomy.json`);
    }
    if (new Set(place.types).size !== place.types.length) errors.push('the same type is listed twice');
  }

  if (!isObject(place.blurb)) {
    errors.push('blurb must be an object keyed by language');
  } else {
    for (const key of Object.keys(place.blurb)) {
      if (languages.length && !languages.includes(key)) errors.push(`blurb has a language "${key}" the site does not speak`);
      else if (!isFilled(place.blurb[key])) errors.push(`blurb (${key}) is empty — remove the key rather than leaving it blank`);
    }
    for (const lang of languages) {
      if (!isFilled(place.blurb[lang])) warnings.push(`no blurb in ${lang} yet`);
      else if (/[—–]/.test(place.blurb[lang])) warnings.push(`blurb (${lang}) contains an em or en dash`);
    }
  }

  if (!Array.isArray(place.mustOrder)) errors.push('mustOrder must be a list');
  else for (const dish of place.mustOrder) {
    if (!isFilled(dish)) errors.push('mustOrder has an empty line in it');
  }

  if (typeof place.reel !== 'string') errors.push('reel must be text (use "" for none)');
  else if (place.reel !== '' && !isReel(place.reel)) errors.push('reel is not an Instagram or TikTok permalink');
  else if (place.reel === '') warnings.push('has no reel yet');

  if (typeof place.website !== 'undefined' && place.website !== '' && !HTTP_URL.test(String(place.website))) {
    errors.push('website must start with http:// or https://');
  }

  if (!Array.isArray(place.photos)) {
    errors.push('photos must be a list of filenames');
  } else {
    for (const file of place.photos) {
      if (!isFilled(file)) errors.push('photos has an empty line in it');
      else if (!PHOTO_FILE.test(file)) errors.push(`photo "${file}" is not a plain filename ending .webp/.jpg/.png/.avif`);
      else if (!photoFiles.includes(file)) errors.push(`photo "${file}" is not in photos/${place.id}/`);
    }
    if (new Set(place.photos).size !== place.photos.length) errors.push('the same photo is listed twice');
  }

  if (typeof place.added !== 'undefined' && place.added !== '' && !DAY.test(String(place.added))) {
    errors.push('added must look like 2026-08-26');
  }
  if (typeof place.visited !== 'undefined' && place.visited !== '' && !MONTH.test(String(place.visited))) {
    errors.push('visited must look like 2026-08');
  }
  if (typeof place.closed !== 'boolean') errors.push('closed must be true or false');

  return { errors, warnings };
}

/**
 * Check the whole array, the way the file will land in the repo.
 *
 * @param {object[]} places
 * @param {object} ctx  as above, minus the per-place bits, plus
 * @param {Record<string,string[]>} ctx.photosById  filenames per place id
 * @returns {{errors: string[], warnings: string[]}}
 */
export function validateAll(places, ctx) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(places)) return { errors: ['the data is not an array'], warnings };
  if (places.length === 0) return { errors: ['the data is empty'], warnings };

  const ids = places.map((p) => (isObject(p) ? p.id : undefined));
  for (const place of places) {
    const id = isObject(place) ? place.id : undefined;
    const label = id || '(no id)';
    const result = validatePlace(place, {
      typeIds: ctx.typeIds,
      languages: ctx.languages,
      photoFiles: (ctx.photosById && ctx.photosById[id]) || [],
      otherIds: []   /* duplicates are reported once, below, not per place */
    });
    for (const message of result.errors) errors.push(`${label}: ${message}`);
    for (const message of result.warnings) warnings.push(`${label}: ${message}`);
  }

  const seen = new Set();
  for (const id of ids) {
    if (id === undefined) continue;
    if (seen.has(id)) errors.push(`${id}: two places share this id`);
    seen.add(id);
  }

  return { errors, warnings };
}

/** Turn a name into an id nobody has taken yet. */
export function slugify(name, taken = []) {
  const base = String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  /* é → e; õ/ä/ö/ü are spelt out below */
    .replace(/ő|ö|ø/gi, 'o')
    .replace(/ä|å/gi, 'a')
    .replace(/ü/gi, 'u')
    .replace(/õ/gi, 'o')
    .replace(/ž/gi, 'z')
    .replace(/š/gi, 's')
    .replace(/&/g, ' and ')
    .replace(/°/g, ' degrees ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');

  if (!base) return '';
  if (!taken.includes(base)) return base;
  for (let n = 2; n < 100; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.includes(candidate)) return candidate;
  }
  return base;
}

/**
 * Pull coordinates out of whatever the Maps app put on the clipboard.
 *
 * Google hands you several shapes depending on which button you pressed:
 * a long /place/… URL with @lat,lng in the middle, the same URL with the more
 * precise !3dlat!4dlng pair at the end, a ?q=lat,lng link, or — from the phone
 * share sheet — a bare "59.4499521, 24.7235408". All four land here.
 * A goo.gl/maps short link cannot be resolved without following it, which the
 * browser will not do cross-origin, so that one is refused by name.
 */
export function parseCoordinates(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  if (/^https?:\/\/(maps\.app\.goo\.gl|goo\.gl)\//i.test(raw)) {
    return { error: 'short link' };
  }

  const patterns = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,          /* the precise pin */
    /[?&](?:q|ll|center|daddr)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,              /* the map's viewport centre */
    /^(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)$/         /* pasted straight from the share sheet */
  ];

  for (const pattern of patterns) {
    const found = raw.match(pattern);
    if (found) {
      const lat = Number(found[1]);
      const lng = Number(found[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  }
  return null;
}

/** The key order every place in data/restaurants.json is written in. */
export function orderKeys(place) {
  const out = {};
  for (const key of KNOWN_KEYS) {
    if (key in place && place[key] !== undefined) out[key] = place[key];
  }
  /* Anything unexpected is kept rather than silently dropped — the validator
     warns about it and a human can then decide. */
  for (const key of Object.keys(place)) {
    if (!(key in out) && place[key] !== undefined) out[key] = place[key];
  }
  return out;
}

/** data/restaurants.json, byte for byte as the repo holds it. */
export function serialise(places) {
  const blurbSorted = places.map((place) => {
    const copy = orderKeys(place);
    if (isObject(copy.blurb)) {
      const blurb = {};
      for (const lang of Object.keys(copy.blurb).sort()) blurb[lang] = copy.blurb[lang];
      copy.blurb = blurb;
    }
    return copy;
  });
  return JSON.stringify(blurbSorted, null, 2) + '\n';
}
