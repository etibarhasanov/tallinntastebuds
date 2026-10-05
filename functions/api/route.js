/**
 * Tallinn Tastebuds — the way on foot from here to a place.
 *
 * GET /api/route?from=59.4370,24.7536&to=59.4389,24.7291
 *   → { "meters": 1830, "seconds": 1320,
 *       "line": [ [59.4370, 24.7536], … ] }
 *
 * What draws the line on the map when the arrow in a place's top strip is
 * pressed — see paintDirections() and showRoute() in assets/app.js. The page
 * shows the walk first and offers Google's own directions as a button inside
 * it, so this answers one thing: how long, how far and which way, on foot.
 *
 * WHY A ROUTE HERE AND NOT A FETCH FROM THE BROWSER
 *
 * The same reasons /api/geocode is one. The upstream is free public
 * infrastructure — the OpenStreetMap Germany routing service, whose foot
 * profile is what walks are asked of — and a worker can keep an answer in
 * Cloudflare's cache where a page cannot. Both ends are held to Tallinn's box
 * and rounded before they go upstream: the start to four decimals, about
 * eleven metres, and the end to five, so the hundred people who press the
 * arrow on one restaurant from one street are one upstream request and a
 * route that starts on the wrong side of the road by a metre is not a
 * different one.
 *
 * NO SESSION, AND WHY THAT IS FINE
 *
 * Nothing here is private: both ends are the caller's own and a place's own.
 * The route is bounded the other way instead — two points inside the box
 * `nearTallinn()` holds everything else to, a walk of at most
 * MAX_METERS, and an answer cached a day — so it is no use as an open
 * routing proxy for anywhere else. The location the browser sends is read,
 * answered and forgotten; it is never stored and never counted.
 *
 * WHEN IT FAILS
 *
 * Nothing waits on it. The page keeps the panel it had, says there is no
 * route, and the Google button in the same bar still goes to the real thing.
 */

import { json, nearTallinn } from './_lib.js';

const ENDPOINT = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/';

/* Sent so the service can see who is asking, the way /api/geocode does. */
const AGENT = 'TallinnTastebuds/1.0 (+https://tallinntastebuds.ee)';

/* A day: streets do not move, and the same two rounded points are the same
   walk for everybody. */
const CACHE_SECONDS = 86400;

/* Past this the answer is "you would take a bus", which is not a walk and
   not what the line is for. Ten kilometres is two hours on foot. */
const MAX_METERS = 10000;

/* Tallinn is ~25 km across; a line of a few hundred vertices is plenty and
   keeps the answer small enough to send on a phone. */
const MAX_POINTS = 600;

function point(raw, places) {
  const [a, b] = String(raw || '').split(',');
  const lat = Number(a);
  const lng = Number(b);
  if (!a || !b || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!nearTallinn(lat, lng)) return null;
  return { lat: Number(lat.toFixed(places)), lng: Number(lng.toFixed(places)) };
}

export async function onRequestGet(context) {
  const q = new URL(context.request.url).searchParams;
  const from = point(q.get('from'), 4);
  const to = point(q.get('to'), 5);
  if (!from || !to) return json({ error: 'bad-points' }, 400);

  const url = ENDPOINT + from.lng + ',' + from.lat + ';' + to.lng + ',' + to.lat +
    '?overview=full&geometries=geojson&alternatives=false&steps=false';

  let res;
  try {
    res = await fetch(url, {
      headers: { 'user-agent': AGENT, accept: 'application/json' },
      cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true }
    });
  } catch (e) {
    return json({ error: 'upstream' }, 502);
  }
  if (res.status === 429) return json({ error: 'busy' }, 429);
  if (!res.ok) return json({ error: 'upstream' }, 502);

  let body;
  try { body = await res.json(); } catch (e) { return json({ error: 'upstream' }, 502); }
  const route = body && body.code === 'Ok' && Array.isArray(body.routes) ? body.routes[0] : null;
  const coords = route && route.geometry && Array.isArray(route.geometry.coordinates)
    ? route.geometry.coordinates : null;
  if (!coords || coords.length < 2) return json({ error: 'no-route' }, 404);

  const meters = Math.round(Number(route.distance));
  const seconds = Math.round(Number(route.duration));
  if (!Number.isFinite(meters) || !Number.isFinite(seconds)) return json({ error: 'upstream' }, 502);
  if (meters > MAX_METERS) return json({ error: 'too-far', meters: meters }, 422);

  /* GeoJSON is [lon, lat]; this is the second place that flips it, as
     /api/geocode's shape() is the first. Thinned evenly if it is long. */
  const step = Math.max(1, Math.ceil(coords.length / MAX_POINTS));
  const line = [];
  for (let i = 0; i < coords.length; i += step) {
    line.push([Number(coords[i][1].toFixed(5)), Number(coords[i][0].toFixed(5))]);
  }
  const last = coords[coords.length - 1];
  line.push([Number(last[1].toFixed(5)), Number(last[0].toFixed(5))]);

  return json({ meters: meters, seconds: seconds, line: line }, 200, 3600);
}
