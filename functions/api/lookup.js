/**
 * Tallinn Tastebuds — /api/lookup, asking Google Maps for what nothing here
 * knows, and keeping the answer.
 *
 *   GET   { ready: true }       whether the button can be offered at all
 *   POST  { q: "Kumu" }
 *
 *     { ok: true, places: [ … ] }       up to LOOKUP_MAX of Google's answers,
 *                                       in Google's order, in the roll's shape
 *     { ok: true, places: [] }          Google has nothing in Tallinn for it
 *     { ok: false, why: 'short' }       nothing worth asking about
 *     { ok: false, why: 'spent' }       the day's or the month's budget is gone
 *     { ok: false, why: 'failed' }      Google refused, or did not answer
 *     { ok: false, why: 'no-key' }      no GOOGLE_MAPS_API_KEY
 *     { ok: false, why: 'no-database' } no D1, the wrong one, or no column
 *
 * WHY IT EXISTS
 *
 * The find bar across the top of the map searches my places and the 1,112 of
 * the export, and that is a city of places to eat and drink. Somebody typing a
 * museum, a shop or a café that opened after the sweep reached the end of it:
 * "Nothing matches", and nowhere to go. So when nothing answers, the bar
 * offers to look on Google Maps, and this is what it asks. **Look for it on
 * Google Maps** under **Finding anywhere in Tallinn** in README.md.
 *
 * WHY THE ANSWER IS KEPT
 *
 * Every place Google answers with is written into google_venues, so the next
 * person to type the same word finds it in the roll /api/places already sends
 * and never sees the button — one call to Google per place, not per visitor.
 * A row that is already there, from the export or an earlier lookup, keeps
 * everything but one column, hidden ones included, so this cannot undo a
 * curation or write over a refresh's numbers. The one column is `status`,
 * because Google has just said it and the mask carries it for nothing: the
 * roll leaves out a place Google calls temporarily closed, so a closed row
 * that has reopened is exactly the one somebody types, finds nothing for, and
 * looks up here — Alanya Grill, in November 2026, open again and still shut
 * in the table since September, because nobody can open what the bar does
 * not offer. Without this the button asked Google, heard "open", and kept
 * the row closed. A row whose status changes here gets `refreshed_at` 0:
 * due, so the first open fetches the hours and numbers it was closed through,
 * and not NULL, which is what tells the export's next load
 * (tools/googlevenues.mjs) it may write September's status back over it.
 *
 * A looked-up row says two things the export's rows do not. `found_at` is
 * when it was looked up, which is what tells the export's load to leave it
 * alone rather than mark it missing for not being in the file. `kind` says
 * what sort of place it is — `eat`, `see`, `shop` or `other`, kindOf() below
 * — where every row of the export is `eat`. eatOnly() in ./_lib.js keeps the
 * other three out of the directory, the weekly ranking and the chat, which
 * are the city's restaurants, while the find bar offers all four. Nothing on
 * a museum's card calls it a restaurant: VENUE_TYPES in ./_lib.js finds no
 * kind of place in "Art museum", and the card draws none. The column is a
 * word rather than a yes or no on purpose, so that ranking museums among
 * museums one day is a PARTITION BY and not another column.
 *
 * WHAT IS ASKED FOR, AND WHAT IT COSTS
 *
 * Text Search (New), held to Tallinn's box with `locationRestriction`, five
 * places, and a mask of Pro fields only — the name, the street, the point, the
 * kinds and the listing. Not the rating, the hours or the phone, which are
 * Enterprise fields and would bill every search at the dearer SKU; the first
 * open of the place asks for those through refreshOnOpen() in ./_refresh.js,
 * the way it does for any row whose numbers are blank. BUDGET.search there is
 * the cap, claimed in the database before anything leaves, and it is the
 * whole of what a stranger pressing the button in a loop can spend — the
 * route is open to anybody, because the owner asked for it to be.
 *
 * The same words asked twice in a day are answered out of the colo's cache
 * rather than from Google: a second press of the button, or a second person
 * the five-minute cache on /api/places has not caught up with yet.
 */

import { json, wrongDatabase, venueEntry } from './_lib.js';
import { googleKey, spend } from './_refresh.js';
import { kitchensOf } from './venues.js';

const SEARCH = 'https://places.googleapis.com/v1/places:searchText';

const FIELDS = [
  'id', 'displayName', 'primaryType', 'primaryTypeDisplayName', 'types',
  'addressComponents', 'shortFormattedAddress', 'location', 'googleMapsUri',
  'businessStatus'
].map((field) => 'places.' + field).join(',');

/* Tallinn and the edge of Harju the export also reaches — the box
   tools/validate.mjs holds every place on the map to. */
const BOX = {
  low: { latitude: 59.32, longitude: 24.50 },
  high: { latitude: 59.52, longitude: 25.00 }
};

/* Five, because the dropdown is a way to one place and Google's sixth answer
   to a name is never the one somebody meant. */
const LOOKUP_MAX = 5;

/* Two letters at least, and a letter among them; eighty at most, which is the
   longest name a place on this site can have. */
const MIN_Q = 2;
const MAX_Q = 80;

const DAY_SECONDS = 24 * 60 * 60;

/* Google's types that mean somewhere to eat or drink: its Food and Drink
   table, less the shops that sell food to take home. Anything Google files as
   one of these, or as any kind of restaurant, is `eat`. */
const FOOD = new Set([
  'restaurant', 'food', 'cafe', 'coffee_shop', 'bar', 'pub', 'wine_bar',
  'bakery', 'cafeteria', 'meal_takeaway', 'meal_delivery', 'food_court',
  'ice_cream_shop', 'dessert_shop', 'tea_house', 'juice_shop', 'bar_and_grill',
  'brewery', 'brewpub', 'sandwich_shop', 'bagel_shop', 'donut_shop',
  'confectionery', 'chocolate_shop', 'acai_shop', 'night_club', 'diner',
  'bistro', 'buffet_restaurant', 'steak_house', 'pizzeria', 'cocktail_bar',
  'hookah_bar', 'beer_garden', 'snack_bar'
]);

/* Google's types for the other three kinds the table knows. Somewhere to
   look at — a museum, a gallery, a sight, a park — and somewhere to buy
   things; anything else is `other`. Google's own type is kept whole in
   `tags`, so a finer split later is a reading of what is already stored. */
const SEE = /museum|gallery|tourist_attraction|historical|monument|landmark|church|cathedral|place_of_worship|(^|_)park$|garden|zoo|aquarium|castle|theater|theatre|cultural|art_studio|observation_deck|library/;
const SHOP = /store|shop|market|mall|boutique|pharmacy|florist|supermarket/;

/* Which of the four kinds a place is, from all of Google's types for it: eat
   first, because a museum café is a café; then see; then shop, since a gift
   shop inside a museum is still the museum. */
function kindOf(types) {
  if (types.some((type) => FOOD.has(type) || /_restaurant$/.test(type))) return 'eat';
  if (types.some((type) => SEE.test(type))) return 'see';
  if (types.some((type) => SHOP.test(type))) return 'shop';
  return 'other';
}

/* One part of Google's address by its type, in its long form. */
function part(components, type) {
  const found = components.find((c) => Array.isArray(c.types) && c.types.includes(type));
  return found && typeof found.longText === 'string' ? found.longText.trim() : '';
}

/* One of Google's places as a row of the table, in the export's spelling —
   "Weizenbergi 34", "10127", "Tallinn" — so venueEntry() draws it the way it
   draws the other eleven hundred. Null for a place with no id, no name or no
   point, and for one Google says has closed for good. */
function asRow(place, now) {
  const name = place && place.displayName && place.displayName.text;
  const at = place && place.location;
  if (!place || typeof place.id !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(place.id)) return null;
  if (typeof name !== 'string' || !name.trim()) return null;
  if (!at || !Number.isFinite(at.latitude) || !Number.isFinite(at.longitude)) return null;
  if (place.businessStatus === 'CLOSED_PERMANENTLY') return null;

  const components = Array.isArray(place.addressComponents) ? place.addressComponents : [];
  const types = Array.isArray(place.types) ? place.types.filter((t) => typeof t === 'string') : [];
  const street = [part(components, 'route'), part(components, 'street_number')].filter(Boolean).join(' ');
  const short = typeof place.shortFormattedAddress === 'string' ? place.shortFormattedAddress : '';

  return {
    place_id: place.id,
    name: name.trim().slice(0, MAX_Q),
    category: (place.primaryTypeDisplayName && place.primaryTypeDisplayName.text) || '',
    status: place.businessStatus === 'OPERATIONAL' ? 'Open'
      : place.businessStatus ? 'Temporarily closed' : '',
    address: street || short.split(',')[0].trim(),
    postal_code: part(components, 'postal_code'),
    city: part(components, 'locality') || part(components, 'administrative_area_level_2'),
    /* The kinds, the primary one first, the way the export's leftover tags
       are a semicolon list — less the two Google puts on everything. Matched
       by the find bar and never printed. */
    tags: [...new Set([place.primaryType, ...types])]
      .filter((type) => type && type !== 'point_of_interest' && type !== 'establishment')
      .join('; ').replace(/_/g, ' '),
    latitude: at.latitude,
    longitude: at.longitude,
    maps_url: typeof place.googleMapsUri === 'string' ? place.googleMapsUri : '',
    kind: kindOf(types.concat(place.primaryType || [])),
    found_at: now
  };
}

/* What the words are cached under: folded the way the find bar folds, so
   "Kumu" and "kumu " are one question. A made-up host, because the colo's
   cache keys on a URL and nothing ever fetches it. */
function cacheKey(q) {
  const folded = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  return new Request('https://lookup.cache/' + encodeURIComponent(folded));
}

/* The rows Google named, as the roll draws them, in Google's order. Read back
   rather than built from the answer, so a row that was already there — and
   perhaps hidden — answers as the table has it. */
async function rollRows(env, ids) {
  if (!ids.length) return [];
  const { results } = await env.DB
    .prepare(
      'SELECT place_id, name, category, cuisine, tags, price, rating, reviews, ' +
      'address, postal_code, city, latitude, longitude, map_id, kind FROM google_venues ' +
      'WHERE place_id IN (' + ids.map(() => '?').join(', ') + ') ' +
      "AND hidden = 0 AND missing_since IS NULL AND status <> 'Temporarily closed'"
    )
    .bind(...ids)
    .all();
  const byId = new Map((results || []).map((row) => [row.place_id, row]));
  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((row) => ({ ...venueEntry(row), kitchens: kitchensOf(row), category: row.category || '' }));
}

export async function onRequestGet(context) {
  const { env } = context;
  return json({ ready: !!(env.DB && googleKey(env) && !(await wrongDatabase(env))) }, 200, 300);
}

export async function onRequestPost(context) {
  const { env, request } = context;

  let body = {};
  try { body = await request.json(); } catch (e) { /* an empty body is a short one */ }
  const q = String((body && body.q) || '').replace(/\s+/g, ' ').trim();
  if (q.length < MIN_Q || q.length > MAX_Q || !/\p{L}/u.test(q)) return json({ ok: false, why: 'short' });

  if (!env.DB || (await wrongDatabase(env))) return json({ ok: false, why: 'no-database' });
  const key = googleKey(env);
  if (!key) return json({ ok: false, why: 'no-key' });

  const cache = caches.default;
  const kept = await cache.match(cacheKey(q)).catch(() => null);
  if (kept) {
    const ids = await kept.json().catch(() => null);
    if (Array.isArray(ids)) return json({ ok: true, places: await rollRows(env, ids) });
  }

  const now = Date.now();
  if (!(await spend(env, 'search', now).catch(() => false))) return json({ ok: false, why: 'spent' });

  let places;
  try {
    const res = await fetch(SEARCH, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
      body: JSON.stringify({
        textQuery: q,
        locationRestriction: { rectangle: BOX },
        pageSize: LOOKUP_MAX,
        languageCode: 'en'
      })
    });
    if (!res.ok) return json({ ok: false, why: 'failed' });
    places = ((await res.json()) || {}).places || [];
  } catch (e) {
    return json({ ok: false, why: 'failed' });
  }

  const rows = places.map((place) => asRow(place, now)).filter(Boolean).slice(0, LOOKUP_MAX);

  /* Inserted, or for a row already there its status alone, and only when
     Google said one — asRow() answers '' when it did not. Throws on a
     database without the two columns, which is the one failure this route
     answers as no database at all. */
  try {
    if (rows.length) {
      await env.DB.batch(rows.map((row) => env.DB
        .prepare(
          'INSERT INTO google_venues (place_id, name, category, status, address, postal_code, city, ' +
          'tags, latitude, longitude, maps_url, first_seen_at, synced_at, kind, found_at) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
          'ON CONFLICT(place_id) DO UPDATE SET status = excluded.status, refreshed_at = 0 ' +
          "WHERE excluded.status <> '' AND COALESCE(google_venues.status, '') <> excluded.status"
        )
        .bind(row.place_id, row.name, row.category, row.status, row.address, row.postal_code,
          row.city, row.tags, row.latitude, row.longitude, row.maps_url, now, now, row.kind, row.found_at)));
    }
  } catch (e) {
    return json({ ok: false, why: 'no-database' });
  }

  const ids = rows.map((row) => row.place_id);
  context.waitUntil(cache.put(cacheKey(q), new Response(JSON.stringify(ids), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + DAY_SECONDS }
  })).catch(() => {}));

  return json({ ok: true, places: await rollRows(env, ids) });
}
