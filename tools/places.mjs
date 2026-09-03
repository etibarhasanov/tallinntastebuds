#!/usr/bin/env node
/**
 * Tallinn Tastebuds — the catalogue behind the lists.
 *
 * The map is seventy-four places I have been to. A list is somebody else's
 * top ten, and it needs a much longer roll to choose from than that — every
 * burger place in the city, not the four of them I have filmed. So there are
 * two files, and they are different things:
 *
 *   data/restaurants.json   the map. Mine, hand-written, every entry a place
 *                           I have eaten at. Nothing in here is generated.
 *
 *   data/places.json        the catalogue. Names and addresses, nothing more,
 *                           and no opinion at all. It exists so that somebody
 *                           building "top ten bars" can find the bar. It is
 *                           GENERATED — by this file — and not edited by hand.
 *
 * The catalogue is the map plus an import, in that order. Every place on the
 * map is in the catalogue, so a list can hold one; everything else comes out
 * of data/places.csv, which is an export from Google Maps and the one file
 * you actually put there.
 *
 *   node tools/places.mjs           rebuild data/places.json
 *   node tools/places.mjs --check   report that it is out of date, exit 1
 *
 * Zero dependencies, like every other tool in here: CI runs it with no
 * `npm install` in front of it.
 *
 * THE CSV
 *
 * There is no single Google Maps export format — Takeout's saved places, a
 * My Maps sheet and anything the Places API was asked for all come out
 * differently — so the header row is read rather than assumed. Any file with
 * a header naming a place and, ideally, where it is will import:
 *
 *     Name,Address,Latitude,Longitude
 *     Burger House,"Viru 24, 10140 Tallinn",59.4372,24.7530
 *
 * The aliases each column answers to are in COLUMNS below. Only a name is
 * required. An address is worth having and coordinates are a bonus: with them
 * a list can put a pin on a map, without them it still reads perfectly and
 * the directions link is a search for the name. Coordinates also get pulled
 * out of a Google Maps URL when there is one and no lat/lng columns, which is
 * exactly the shape Takeout hands back.
 *
 * WHY THE IDS ARE KEPT RATHER THAN COMPUTED
 *
 * A catalogue id is written into somebody's list, in a database this file
 * cannot see. So an id that changed when the CSV was re-exported would not be
 * a cosmetic churn: it would be a place quietly falling out of a list that a
 * person wrote a sentence about.
 *
 * The ids are therefore taken from the previous data/places.json wherever a
 * row can be matched to one — on the folded name and address, which is what
 * survives a re-export — and only a genuinely new row is given a new id. A
 * row that has gone is reported, loudly, because that id may be on a list.
 *
 * Lists survive it either way: list_items carries the name it was added
 * under, so a list renders whole even for a place the catalogue has lost.
 * See db/schema.sql. The warning is so you know it happened.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CSV = join(ROOT, 'data', 'places.csv');
const OUT = join(ROOT, 'data', 'places.json');
const MAP = join(ROOT, 'data', 'restaurants.json');

/* Which spellings of a column this reads. Lowercased and stripped of
   everything but letters before it is looked up here, so "Formatted Address",
   "formatted_address" and "FORMATTED-ADDRESS" are all one key. */
const COLUMNS = {
  name:    ['name', 'title', 'place', 'placename', 'restaurant', 'business'],
  address: ['address', 'formattedaddress', 'vicinity', 'street', 'location', 'fulladdress'],
  lat:     ['lat', 'latitude', 'y'],
  lng:     ['lng', 'lon', 'long', 'longitude', 'x'],
  url:     ['url', 'link', 'googlemapsurl', 'mapsurl', 'maps', 'website']
};

/* Generously drawn round Tallinn and the ring of suburbs somebody would
   reasonably put on a list — Viimsi, Peetri, Laagri. Anything outside it is
   dropped rather than kept: a swapped lat/lng lands in the Arabian Sea, and a
   pin in the Arabian Sea on a list of Tallinn bars is worse than no pin. */
const BBOX = { latMin: 59.25, latMax: 59.60, lngMin: 24.35, lngMax: 25.15 };

/* ------------------------------------------------------------------- CSV
 * Written out rather than depended on, and it is RFC 4180 rather than
 * `split(',')`: an address is "Viru 24, 10140 Tallinn" more often than not,
 * so the quoting is the whole point. A doubled quote inside a quoted field is
 * one quote, and a newline inside one is part of the value.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let started = false;

  /* A byte-order mark is what a spreadsheet puts at the front of a UTF-8
     file, and it would otherwise become part of the first column's name. */
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const endField = () => { row.push(field); field = ''; started = false; };
  const endRow = () => {
    endField();
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }

    if (c === '"' && !started) { quoted = true; started = true; continue; }
    if (c === ',') { endField(); continue; }
    if (c === '\r') continue;
    if (c === '\n') { endRow(); continue; }
    field += c;
    started = true;
  }

  if (field !== '' || row.length) endRow();
  return rows;
}

const key = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

/* Header row to column indexes. First spelling wins, so a file carrying both
   "address" and "vicinity" uses the one named first in COLUMNS. */
export function headerMap(header) {
  const seen = {};
  header.forEach((cell, i) => {
    const k = key(cell);
    if (k && seen[k] === undefined) seen[k] = i;
  });

  const at = {};
  for (const field of Object.keys(COLUMNS)) {
    for (const alias of COLUMNS[field]) {
      if (seen[alias] !== undefined) { at[field] = seen[alias]; break; }
    }
  }
  return at;
}

/* Google puts the coordinates in its own URLs in two shapes: the `@lat,lng`
   in the address bar, and the `!3dlat!4dlng` in a share link. Takeout hands
   back the second and no lat/lng columns at all, so this is what makes that
   export usable without a round trip to an API. */
export function coordsFromUrl(url) {
  const s = String(url || '');
  let m = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(s);
  if (!m) m = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(s);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}

export function fold(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0131\u0130]/g, 'i')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slug(name) {
  const s = fold(name)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return s || 'place';
}

/* What matches a CSV row to an entry that is already in the catalogue. The
   name and the address, folded: capitalisation, accents and spacing all
   change between exports and none of them mean a different restaurant. */
export function matchKey(name, address) {
  return fold(name) + '|' + fold(address);
}

function num(value) {
  const n = Number(String(value == null ? '' : value).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function inBox(lat, lng) {
  return lat !== null && lng !== null &&
    lat >= BBOX.latMin && lat <= BBOX.latMax &&
    lng >= BBOX.lngMin && lng <= BBOX.lngMax;
}

/* Metres between two coordinates, flat-earth. Over the width of one city the
   error is centimetres, and this is only ever asked "are these two rows the
   same restaurant", where the answer is a hundred metres or a kilometre and
   never anything in between. */
function metresApart(a, b) {
  const lat = ((a.lat + b.lat) / 2) * Math.PI / 180;
  const dy = (a.lat - b.lat) * 111320;
  const dx = (a.lng - b.lng) * 111320 * Math.cos(lat);
  return Math.sqrt(dx * dx + dy * dy);
}

/* Close enough that two rows with this name are one restaurant. Generous,
   because a Google pin and a hand-typed one disagree by a building's width
   routinely; short enough that the two branches of a bakery chain on opposite
   sides of the old town stay two places. */
const SAME_PLACE_M = 200;

/* Whether a CSV row is a place the catalogue already holds.
 *
 * The name and the address together are the strict test, and it is the one
 * that matters for keeping ids stable. This is the loose one, and it exists
 * because of the shape the exports actually arrive in: Takeout's saved places
 * carry a title and a URL and no address column at all, so every place on the
 * map would otherwise come back a second time as a twin with a blank address.
 *
 * So: same name, and then anything that is not a positive disagreement about
 * where it is. Two addresses that are both filled in and different are two
 * places; a blank on either side is not evidence of anything, and neither is
 * a pin two doors down.
 */
function alreadyHave(entries, name, address, lat, lng) {
  const folded = fold(name);
  for (const p of entries) {
    if (fold(p.name) !== folded) continue;

    const bothAddressed = !!fold(p.address) && !!fold(address);
    if (bothAddressed && fold(p.address) !== fold(address)) {
      /* Different addresses, but the pins are on top of each other: one of
         them is written "Viru 24" and the other "Viru 24, 10140 Tallinn". */
      const bothPinned = typeof p.lat === 'number' && lat !== null;
      if (!bothPinned || metresApart(p, { lat: lat, lng: lng }) > SAME_PLACE_M) continue;
    }
    return p;
  }
  return null;
}

/* ------------------------------------------------------------------ build */

export function build() {
  const notes = [];

  const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
  const heldId = new Map();     /* match key -> the id it already had */
  for (const p of previous) {
    if (p && p.id && p.name) heldId.set(matchKey(p.name, p.address), p.id);
  }

  const out = [];
  const taken = new Set();

  /* The map first, and with its own ids: a place on the map is the same place
     in a list, so putting one in a list links back to its write-up rather
     than to a Google search. `map: true` is what the list page reads to know
     that link exists. */
  const curated = JSON.parse(readFileSync(MAP, 'utf8'));
  for (const p of curated) {
    out.push({
      id: p.id,
      name: p.name,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      map: true
    });
    taken.add(p.id);
  }

  /* Then the import, if there is one. There is no CSV in the repository —
     it is somebody's export and it is theirs to drop in — so its absence is
     a normal state and the catalogue is simply the map until it lands. */
  let imported = 0;
  let skipped = 0;

  if (existsSync(CSV)) {
    const rows = parseCsv(readFileSync(CSV, 'utf8'));
    if (!rows.length) {
      notes.push('data/places.csv is empty');
    } else {
      const at = headerMap(rows[0]);
      if (at.name === undefined) {
        throw new Error(
          'data/places.csv has no column this recognises as a name. ' +
          'The header row should carry one of: ' + COLUMNS.name.join(', ')
        );
      }

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const cell = (field) => (at[field] === undefined ? '' : String(row[at[field]] || '').trim());

        const name = cell('name');
        if (!name) { skipped++; continue; }
        const address = cell('address');

        let lat = num(cell('lat'));
        let lng = num(cell('lng'));
        if (!inBox(lat, lng)) {
          const fromUrl = coordsFromUrl(cell('url'));
          lat = fromUrl ? fromUrl.lat : null;
          lng = fromUrl ? fromUrl.lng : null;
        }
        const pinned = inBox(lat, lng);
        if (!pinned) { lat = null; lng = null; }

        /* The same place twice in one export, or one that is already on the
           map. Either way it belongs in the catalogue once — a twin would be
           two rows in the picker with the same name and no way to tell them
           apart. The map's copy wins: it has the address I checked. */
        const twin = alreadyHave(out, name, address, lat, lng);
        if (twin) {
          /* The one thing worth taking from the export: coordinates for a
             place the map has and the CSV pinned. */
          if (twin.lat === undefined && pinned) { twin.lat = lat; twin.lng = lng; }
          skipped++;
          continue;
        }
        /* The id it had last time, if this catalogue has seen it before.
           Somebody's list is pointing at that string. */
        let id = heldId.get(matchKey(name, address));
        if (!id || taken.has(id)) {
          id = slug(name);
          if (taken.has(id)) {
            let n = 2;
            while (taken.has(id + '-' + n)) n++;
            id = id + '-' + n;
          }
        }
        taken.add(id);

        const entry = { id: id, name: name, address: address };
        if (pinned) { entry.lat = lat; entry.lng = lng; }
        out.push(entry);
        imported++;
      }
    }
  }

  /* An id that was in the catalogue and is not any more. It may be sitting in
     a list, so this is said out loud rather than passed over. The list still
     draws — list_items keeps the name the place was added under — but the row
     stops linking anywhere and cannot be found by search. */
  const now = new Set(out.map((p) => p.id));
  const lost = previous.filter((p) => p && p.id && !now.has(p.id)).map((p) => p.id);

  /* Sorted by folded name, so a diff of this file reads as "these places
     changed" rather than as the CSV's row order moving about. */
  out.sort((a, b) => {
    const an = fold(a.name);
    const bn = fold(b.name);
    if (an !== bn) return an < bn ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });

  return { places: out, imported, skipped, lost, notes, curated: curated.length };
}

export function serialise(places) {
  return JSON.stringify(places, null, 2) + '\n';
}

/* True when data/places.json on disk is not what build() would write. The
   validator asks this, so CI refuses a deploy where the CSV has been changed
   and the catalogue has not been rebuilt. */
export function stale() {
  try {
    const want = serialise(build().places);
    const got = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    return want !== got;
  } catch (e) {
    return true;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');

  if (check) {
    if (!stale()) {
      console.log('OK — data/places.json matches the map and the CSV beside it.');
      process.exit(0);
    }
    console.log('  FAIL  data/places.json is not what tools/places.mjs would write.');
    console.log('\nRun `node tools/places.mjs` and commit the result.');
    process.exit(1);
  }

  const result = build();
  writeFileSync(OUT, serialise(result.places));

  for (const note of result.notes) console.log(`  note  ${note}`);
  console.log(
    `data/places.json — ${result.places.length} places: ` +
    `${result.curated} from the map, ${result.imported} from the CSV` +
    (result.skipped ? `, ${result.skipped} rows skipped as blank or duplicate` : '') + '.'
  );
  if (!existsSync(CSV)) {
    console.log('  note  no data/places.csv yet, so the catalogue is the map on its own.');
  }
  if (result.lost.length) {
    console.log(
      `\n  WARN  ${result.lost.length} place(s) left the catalogue. Anybody's list ` +
      'that holds one keeps the name it was added under, but the row will no ' +
      'longer link anywhere:'
    );
    for (const id of result.lost.slice(0, 20)) console.log(`          ${id}`);
    if (result.lost.length > 20) console.log(`          … and ${result.lost.length - 20} more`);
  }
}
