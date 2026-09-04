/**
 * Tallinn Tastebuds — turning a typed address into a point.
 *
 * GET /api/geocode?q=Tellisk
 *   → { "results": [ { "lat": 59.4389, "lng": 24.7291,
 *                      "label": "Telliskivi 60a", "where": "Tallinn" }, … ] }
 *
 * The "add a place" form on the lists page is the only thing that asks. It
 * has a map with a draggable pin, and dragging is still the thing that
 * decides where a place is — see the note above addForm() in
 * assets/lists.js. This is the shortcut: type the street, pick it off the
 * list, and the pin is already on the right building before anybody drags
 * anything.
 *
 * WHY PHOTON AND NOT NOMINATIM
 *
 * This route used to call Nominatim, which answered one finished address at a
 * time. It could not be the thing behind a suggestion list: Nominatim's usage
 * policy asks in as many words for no autocomplete, because a search engine
 * built for whole queries gets one request per keystroke and falls over.
 *
 * Photon is the same OpenStreetMap data indexed for exactly the opposite —
 * it is built to answer a prefix, it is what Komoot's own search box uses,
 * and it wants no key. So the suggestions are honest rather than a policy
 * being quietly ignored, and there is one upstream instead of two.
 *
 * It is still asked politely. The form does not send a request per keystroke
 * — it waits for a pause in the typing and for three characters — and every
 * query that does go out is cached here for a day, keyed on the query itself,
 * so the prefixes of "Telliskivi" that every person in Tallinn types are
 * fetched once between all of them.
 *
 * WHY IT IS A ROUTE HERE AND NOT A FETCH FROM THE BROWSER
 *
 * Caching, mostly: a worker can put an answer in Cloudflare's cache and a
 * page cannot, and prefix queries are the case where that matters most. It
 * also means the answers are bounded and reshaped before they are handed
 * over — a point outside the box /api/lists will accept is dropped here, so a
 * suggestion can never put the pin somewhere the save would then reject, and
 * the page is handed four fields rather than a GeoJSON document.
 *
 * A SESSION IS REQUIRED
 *
 * Not because a street name is private, but because an open geocoding proxy
 * on somebody else's quota is a thing that gets found and used. Everybody who
 * can see this form is signed in already.
 *
 * IF THIS EVER NEEDS TO BE BETTER
 *
 * Estonia has an official address service — Maa-amet's In-ADS — which knows
 * every building in the country and is the right answer for an Estonian-only
 * site. It is not here because OpenStreetMap covers Tallinn's restaurants
 * well, and because this file's whole upstream is four lines: swapping it is
 * a change to ask() below and nothing else.
 */

import { json, sessionUser, TALLINN, nearTallinn } from './_lib.js';

const ENDPOINT = 'https://photon.komoot.io/api';

/* Sent so Komoot can see who is asking, the same courtesy Nominatim asks for
   in writing. Free public infrastructure is easier to keep free when the
   traffic on it has a name. */
const AGENT = 'TallinnTastebuds/1.0 (+https://tallinntastebuds.ee)';

const MIN_Q = 3;
const MAX_Q = 120;

/* Five is what fits under the field without covering the map underneath it,
   and more than five suggestions is a list somebody reads rather than picks
   from. */
const LIMIT = 5;

/* A day. Streets do not move, and the prefixes of a street name are typed by
   everybody who types that street. */
const CACHE_SECONDS = 86400;

/* The upstream call and the shape it comes back in — the only part of this
   file that knows what Photon is. */
async function ask(q) {
  const url = new URL(ENDPOINT);
  url.searchParams.set('q', q);
  url.searchParams.set('limit', String(LIMIT * 2));
  url.searchParams.set('lang', 'en');
  /* Bias towards the city, then bound to it. The bias is what puts a Tallinn
     Pärnu maantee above the one in Pärnu; the box is what stops a query that
     matches nothing here from answering with somewhere it does match. */
  url.searchParams.set('lat', String(TALLINN.lat));
  url.searchParams.set('lon', String(TALLINN.lng));
  url.searchParams.set('bbox', [
    TALLINN.lng - TALLINN.degLng,
    TALLINN.lat - TALLINN.degLat,
    TALLINN.lng + TALLINN.degLng,
    TALLINN.lat + TALLINN.degLat
  ].map((n) => n.toFixed(6)).join(','));

  const res = await fetch(url.toString(), {
    headers: { 'user-agent': AGENT, accept: 'application/json' },
    cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true }
  });
  if (res.status === 429) return { busy: true };
  if (!res.ok) return { failed: true };

  const body = await res.json();
  const features = body && Array.isArray(body.features) ? body.features : [];
  return { features: features };
}

/* Photon answers GeoJSON with an OSM tag soup attached. This is the whole of
   what the form needs out of it: a line to show, a line of context under it,
   and a point. */
function shape(feature) {
  const geo = feature && feature.geometry;
  const at = geo && Array.isArray(geo.coordinates) ? geo.coordinates : null;
  if (!at) return null;

  /* GeoJSON is [lon, lat] and every other line in this codebase is the other
     way round. This is the one place that flips it. */
  const lng = Number(at[0]);
  const lat = Number(at[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!nearTallinn(lat, lng)) return null;

  const p = feature.properties || {};

  /* A street with a number is an address; a street without one is a street,
     which is still a useful thing to pick. */
  const street = [p.street, p.housenumber].filter(Boolean).join(' ').trim();

  /* A named building or café comes back with `name` set, and it leads —
     somebody adding a place has very often typed the name into this field
     rather than the street, and finding it anyway is better than telling them
     they were in the wrong box. */
  const label = p.name || street;
  if (!label) return null;

  /* What tells two identical names apart, and nothing more: the street under
     a named venue, then the district, which is more use than "Estonia" to
     somebody who lives here. */
  const where = [street === label ? '' : street, p.district, p.city || p.town || p.village]
    .filter(Boolean)
    .join(', ');

  return {
    lat: lat,
    lng: lng,
    label: String(label).slice(0, 120),
    where: String(where).slice(0, 120),
    /* What the field is filled with when this is picked, which is not always
       what the row says: the field asks for the street a place is on, so
       picking "Fotografiska" has to write "Telliskivi 60a/8" into it. */
    fill: String(street || label).slice(0, 120)
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const q = String(new URL(request.url).searchParams.get('q') || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_Q);
  if (q.length < MIN_Q) return json({ error: 'short' }, 400);

  if (!env.DB) return json({ error: 'no-database' }, 503);
  const user = await sessionUser(request, env);
  if (!user) return json({ error: 'signed-out' }, 401);

  let answer;
  try {
    answer = await ask(q);
  } catch (e) {
    return json({ error: 'upstream' }, 502);
  }
  /* Being told to slow down is not the same as a street that does not exist,
     and the form says something different for each. */
  if (answer.busy) return json({ error: 'busy' }, 429);
  if (answer.failed) return json({ error: 'upstream' }, 502);

  /* Photon will happily return the same street four times over, once per
     building on it, when what was typed was the street. Two suggestions
     reading identically is a list that looks broken, so the first of each
     wins and the rest are dropped. */
  const seen = new Set();
  const results = [];
  for (const feature of answer.features) {
    const made = shape(feature);
    if (!made) continue;
    const key = made.label + '|' + made.where;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(made);
    if (results.length >= LIMIT) break;
  }

  /* No cache header on the way out, deliberately. The answer is behind a
     session and json()'s cache directive is a public one — a shared cache
     holding this would hand a signed-in answer to somebody who is not. The
     saving that matters already happened in ask(), in Cloudflare's cache of
     the upstream call, which is keyed on the query and not on who asked. */
  return json({ results: results });
}
