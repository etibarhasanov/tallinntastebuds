/**
 * Tallinn Tastebuds — turning a typed address into a point.
 *
 * GET /api/geocode?q=Telliskivi%2060a
 *   → { "lat": 59.4389, "lng": 24.7291, "label": "Telliskivi 60a, Tallinn" }
 *
 * The "add a place" form on the lists page is the only thing that asks. It
 * has a map with a draggable pin, and dragging is still the thing that
 * decides where a place is — see the note above addForm() in
 * assets/lists.js. This only moves the pin to the right street first, because
 * dragging from the city centre to Lasnamäe on a phone is a minute of work
 * for something the address already said.
 *
 * WHY IT IS A ROUTE HERE AND NOT A FETCH FROM THE BROWSER
 *
 * Nominatim is free and asks for three things in return, and two of them a
 * browser cannot give:
 *
 *   - A User-Agent naming the application. `fetch` refuses to set that header
 *     at all, so a call from the page identifies itself as the browser and
 *     nothing else, which is the shape of request their policy asks people
 *     not to send.
 *   - Caching, rather than asking twice for the same string. A worker can put
 *     an answer in Cloudflare's cache for a day; a page cannot.
 *
 * The third is one request at a time, no autocomplete — which is why the form
 * geocodes on Enter and on a press, and never on a keystroke.
 *
 * Being a route also means the answer is bounded before it is handed over: a
 * point outside the box /api/lists will accept is refused here, so the pin
 * can never land somewhere the save would then reject.
 *
 * A SESSION IS REQUIRED
 *
 * Not because the address is private — it is a street name — but because an
 * open geocoding proxy on somebody else's Nominatim quota is a thing that
 * gets found and used. Everybody who can see this form is signed in already.
 */

import { json, sessionUser, TALLINN, nearTallinn } from './_lib.js';

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

/* Nominatim's policy asks for an application name and a way to be contacted
   about it. This is that. */
const AGENT = 'TallinnTastebuds/1.0 (+https://tallinntastebuds.ee)';

const MIN_Q = 3;
const MAX_Q = 120;

/* A day. An address does not move, and the same street typed twice — by one
   person correcting a spelling, or by two people adding the same café — costs
   nothing the second time. */
const CACHE_SECONDS = 86400;

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

  /* left,top,right,bottom in lon,lat — Nominatim's order, not Leaflet's.
     bounded=1 makes it a filter rather than a preference, so a query that
     matches a street in Riga better than one in Tallinn comes back empty
     instead of coming back wrong. */
  const box = [
    TALLINN.lng - TALLINN.degLng,
    TALLINN.lat + TALLINN.degLat,
    TALLINN.lng + TALLINN.degLng,
    TALLINN.lat - TALLINN.degLat
  ].map((n) => n.toFixed(6)).join(',');

  const url = new URL(ENDPOINT);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '0');
  url.searchParams.set('countrycodes', 'ee');
  url.searchParams.set('viewbox', box);
  url.searchParams.set('bounded', '1');

  let found;
  try {
    const res = await fetch(url.toString(), {
      headers: { 'user-agent': AGENT, accept: 'application/json' },
      /* Cloudflare's own cache, keyed on the URL above, so a repeated query
         never reaches Nominatim twice. */
      cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true }
    });
    /* Their rate limiter answers 429, and being told to slow down is not the
       same as an address that does not exist: the form says different things
       for the two. */
    if (res.status === 429) return json({ error: 'busy' }, 429);
    if (!res.ok) return json({ error: 'upstream' }, 502);
    found = await res.json();
  } catch (e) {
    return json({ error: 'upstream' }, 502);
  }

  const hit = Array.isArray(found) ? found[0] : null;
  if (!hit) return json({ error: 'not-found' }, 404);

  const lat = parseFloat(hit.lat);
  const lng = parseFloat(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return json({ error: 'not-found' }, 404);

  /* bounded=1 should have made this impossible. It is checked anyway, because
     the one thing this must never do is hand back a point that /api/lists
     will refuse after the form has been filled in. */
  if (!nearTallinn(lat, lng)) return json({ error: 'not-found' }, 404);

  /* No cache header on the way out, deliberately. The answer is behind a
     session, and json()'s cache directive is a public one — a shared cache
     holding this would be handing a signed-in answer to somebody who is not.
     The saving that matters already happened above, in Cloudflare's cache of
     the Nominatim call, which is keyed on the query and not on who asked. */
  return json({
    lat: lat,
    lng: lng,
    label: String(hit.display_name || '').slice(0, 200)
  });
}
