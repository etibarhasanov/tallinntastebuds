/**
 * Tallinn Tastebuds — the way from here to a place: on foot, by bus or by car.
 *
 * GET /api/route?from=59.4370,24.7536&to=59.4389,24.7291[&mode=foot|car|bus]
 *
 *   foot, car → { "meters": 1830, "seconds": 1320,
 *                 "line": [ [59.4370, 24.7536], … ] }
 *
 *   bus       → { "trips": [ { "seconds": 1320,
 *                   "legs": [ { "line": [...] },
 *                             { "name": "17", "color": "0064B0",
 *                               "from": "Vabaduse väljak", "at": "14:09",
 *                               "line": [...] }, … ] }, … ] }
 *
 *             A leg that is a ride carries the line's name; a walk does not.
 *
 * What draws the line on the map when the arrow in a place's top strip is
 * pressed — see paintDirections() and showRoute() in assets/app.js. The bar
 * that stands on the map has three modes, Walk · Bus · Car, and each asks this
 * route once; the page shows our own answer first and keeps Google's
 * directions as a quiet link under it.
 *
 * WHERE EACH ANSWER COMES FROM
 *
 * Walking and driving are the OpenStreetMap Germany routing service, its foot
 * and car profiles: the same request shape, a different path. The bus is
 * peatus.ee, the national journey planner the Transport Administration
 * (Transpordiamet) runs — an OpenTripPlanner over the consolidated timetable
 * of every operator in Estonia, Tallinn's buses, trams and trolleybuses
 * among them, open to anybody without a key. It is asked "from here to there,
 * leaving now" and answers up to TRIPS journeys, each a run of legs: a walk
 * to a stop, a ride, maybe a change, a walk to the door. A journey that is
 * all walking is dropped, because Walk already says that better.
 *
 * WHY A ROUTE HERE AND NOT A FETCH FROM THE BROWSER
 *
 * The same reasons /api/geocode is one. The upstreams are free public
 * infrastructure and a worker can keep an answer in Cloudflare's cache where a
 * page cannot. Both ends are held to Tallinn's box and rounded before they go
 * upstream: the start to four decimals, about eleven metres, and the end to
 * five, so the hundred people who press the arrow on one restaurant from one
 * street are one upstream request and a route that starts on the wrong side of
 * the road by a metre is not a different one. A walk or a drive is cached a
 * day, since streets do not move; a bus journey a minute, since it leaves at
 * a time and the time goes.
 *
 * NO SESSION, AND WHY THAT IS FINE
 *
 * Nothing here is private: both ends are the caller's own and a place's own.
 * The route is bounded the other way instead — two points inside the box
 * `nearTallinn()` holds everything else to, a walk of at most MAX_WALK, and
 * an answer cached — so it is no use as an open routing proxy for anywhere
 * else. The location the browser sends is read, answered and forgotten; it is
 * never stored and never counted.
 *
 * WHEN IT FAILS
 *
 * Nothing waits on it. The page keeps the panel it had, says there is no
 * route for that mode, and the other two tabs and the Google link in the same
 * bar are still there.
 */

import { json, nearTallinn } from './_lib.js';

const OSRM = {
  foot: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/',
  car: 'https://routing.openstreetmap.de/routed-car/route/v1/driving/'
};

const PEATUS = 'https://api.peatus.ee/routing/v1/routers/estonia/index/graphql';

/* Sent so the service can see who is asking, the way /api/geocode does. */
const AGENT = 'TallinnTastebuds/1.0 (+https://tallinntastebuds.ee)';

/* A day for a walk or a drive: streets do not move, and the same two rounded
   points are the same way for everybody. A minute for a bus, which is the
   next departure and stops being it. */
const CACHE_SECONDS = { foot: 86400, car: 86400, bus: 60 };

/* Past this a walk is "you would take a bus", which is not a walk and not
   what the line is for. Ten kilometres is two hours on foot. A drive has no
   cap of its own: the box already holds both ends inside the city. */
const MAX_WALK = 10000;

/* How many journeys the bar offers: the next one and two after it. */
const TRIPS = 3;

/* Tallinn is ~25 km across; a line of a few hundred vertices is plenty and
   keeps the answer small enough to send on a phone. A bus journey shares it
   out between its legs. */
const MAX_POINTS = 600;

const CLOCK = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Tallinn', hour: '2-digit', minute: '2-digit', hour12: false
});

function point(raw, places) {
  const [a, b] = String(raw || '').split(',');
  const lat = Number(a);
  const lng = Number(b);
  if (!a || !b || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!nearTallinn(lat, lng)) return null;
  return { lat: Number(lat.toFixed(places)), lng: Number(lng.toFixed(places)) };
}

/* [lat, lng] pairs at five decimals, about a metre, thinned evenly to `max`
   and always keeping the last point so the line reaches the door. */
function thin(points, max) {
  const step = Math.max(1, Math.ceil(points.length / Math.max(2, max)));
  const line = [];
  for (let i = 0; i < points.length; i += step) line.push(points[i]);
  if (line[line.length - 1] !== points[points.length - 1]) line.push(points[points.length - 1]);
  return line.map((p) => [Number(p[0].toFixed(5)), Number(p[1].toFixed(5))]);
}

/* Google's encoded polyline, which is what OpenTripPlanner hands a leg's
   shape back as: precision five, zig-zag signed, five bits a character. */
function decode(text) {
  const out = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  while (i < text.length) {
    for (const axis of [0, 1]) {
      let shift = 0;
      let value = 0;
      let byte;
      do {
        byte = text.charCodeAt(i++) - 63;
        value |= (byte & 31) << shift;
        shift += 5;
      } while (byte >= 32 && i < text.length);
      const delta = value & 1 ? ~(value >> 1) : value >> 1;
      if (axis === 0) lat += delta; else lng += delta;
    }
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

async function street(mode, from, to) {
  const url = OSRM[mode] + from.lng + ',' + from.lat + ';' + to.lng + ',' + to.lat +
    '?overview=full&geometries=geojson&alternatives=false&steps=false';

  let res;
  try {
    res = await fetch(url, {
      headers: { 'user-agent': AGENT, accept: 'application/json' },
      cf: { cacheTtl: CACHE_SECONDS[mode], cacheEverything: true }
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
  if (mode === 'foot' && meters > MAX_WALK) return json({ error: 'too-far', meters: meters }, 422);

  /* GeoJSON is [lon, lat]; this is the second place that flips it, as
     /api/geocode's shape() is the first. */
  const line = thin(coords.map((c) => [c[1], c[0]]), MAX_POINTS);
  return json({ meters: meters, seconds: seconds, line: line }, 200, 3600);
}

async function transit(from, to) {
  const query = '{ plan(from: {lat: ' + from.lat + ', lon: ' + from.lng + '}, ' +
    'to: {lat: ' + to.lat + ', lon: ' + to.lng + '}, numItineraries: ' + (TRIPS + 2) + ') { itineraries { duration ' +
    'legs { startTime transitLeg ' +
    'route { shortName color } from { name } legGeometry { points } } } } }';

  let res;
  try {
    res = await fetch(PEATUS, {
      method: 'POST',
      headers: { 'user-agent': AGENT, accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ query: query })
    });
  } catch (e) {
    return json({ error: 'upstream' }, 502);
  }
  if (res.status === 429) return json({ error: 'busy' }, 429);
  if (!res.ok) return json({ error: 'upstream' }, 502);

  let body;
  try { body = await res.json(); } catch (e) { return json({ error: 'upstream' }, 502); }
  /* No transportModes in the question: the planner's own default is every
     kind of transit plus walking, which is what is wanted, and an enum one
     deployment spells differently would fail the whole query rather than
     one mode. Two more journeys are asked for than offered, because a walk
     with no ride in it comes back among them and is dropped below. A query
     the planner refuses answers 200 with `errors` and no plan; its first
     message goes to the log so the next person can see why. */
  const plan = body && body.data && body.data.plan;
  if (body && Array.isArray(body.errors) && body.errors.length) console.error('peatus', body.errors[0].message);
  if (!plan || !Array.isArray(plan.itineraries)) return json({ error: 'upstream' }, 502);

  const rides = plan.itineraries
    .filter((it) => Array.isArray(it.legs) && it.legs.some((l) => l.transitLeg))
    .slice(0, TRIPS);
  if (!rides.length) return json({ error: 'no-route' }, 404);

  const trips = rides.map((it) => ({
    seconds: Math.round(Number(it.duration)),
    legs: it.legs.map((l) => {
      const path = l.legGeometry && l.legGeometry.points ? decode(l.legGeometry.points) : [];
      const leg = { line: path.length >= 2 ? thin(path, MAX_POINTS / it.legs.length) : [] };
      if (l.transitLeg) {
        leg.name = (l.route && l.route.shortName) || '';
        leg.color = l.route && /^[0-9A-Fa-f]{6}$/.test(l.route.color || '') ? l.route.color : '';
        leg.from = (l.from && l.from.name) || '';
        leg.at = CLOCK.format(new Date(Number(l.startTime)));
      }
      return leg;
    })
  }));

  return json({ trips: trips }, 200, CACHE_SECONDS.bus);
}

export async function onRequestGet(context) {
  const q = new URL(context.request.url).searchParams;
  const from = point(q.get('from'), 4);
  const to = point(q.get('to'), 5);
  if (!from || !to) return json({ error: 'bad-points' }, 400);
  const mode = q.get('mode') || 'foot';
  if (mode === 'bus') return transit(from, to);
  if (!OSRM[mode]) return json({ error: 'bad-mode' }, 400);
  return street(mode, from, to);
}
