/**
 * Tallinn Tastebuds — the way from here to a place: on foot, by bike, by bus
 * or by car.
 *
 * GET /api/route?from=59.4370,24.7536&to=59.4389,24.7291[&mode=foot|bike|car|bus]
 *
 *   mode is foot when it is left out.
 *
 *   foot, bike, car → { "meters": 1830, "seconds": 1320,
 *                 "line": [ [59.4370, 24.7536], … ],
 *                 "steps": [ { "at": [59.4372, 24.7541], "meters": 140,
 *                              "turn": "right", "name": "Narva maantee" },
 *                            … ],
 *                 "others": [ { "meters": 2100, "seconds": 1440,
 *                               "line": [...], "steps": [...] }, … ] }
 *
 *             `meters`, `seconds` and `line` are the way the router likes
 *             best. `others` is up to OTHERS more it found between the same
 *             two points, each in the same three fields — and empty where
 *             it found the one, which on a short way is most of the time.
 *             `steps` is where that way turns — see THE TURNS below.
 *
 *   bus  → { "trips": [ { "seconds": 1320,
 *                   "legs": [ { "line": [...] },
 *                             { "name": "17", "color": "0064B0",
 *                               "from": "Vabaduse väljak", "at": "14:09",
 *                               "line": [...] }, … ] }, … ] }
 *
 *             A leg that is a ride carries the line's name; a walk does not.
 *
 * What draws the line on the map when the arrow in a place's top strip is
 * pressed — see paintDirections() and showRoute() in assets/app.js. The bar
 * that stands on the map has four modes, Walk · Bike · Bus · Car, and each asks this
 * route once; the page shows our own answer first and keeps Google's
 * directions as a quiet link under it.
 *
 * WHERE EACH ANSWER COMES FROM
 *
 * Walking, cycling and driving are the OpenStreetMap Germany routing service,
 * its foot, bike and car profiles: the same request shape, a different path.
 * The bike profile prefers cycle paths and lanes and, where there is none,
 * takes a pedestrian street or a footpath at walking pace — so one line can
 * cross the Old Town, which is the thing a bike route from Google cannot do.
 * The bus is
 * peatus.ee, the national journey planner the Transport Administration
 * (Transpordiamet) runs — an OpenTripPlanner over the consolidated timetable
 * of every operator in Estonia, Tallinn's buses, trams and trolleybuses
 * among them, open to anybody without a key. It is asked "from here to there,
 * leaving now" and answers up to TRIPS journeys, each a run of legs: a walk
 * to a stop, a ride, maybe a change, a walk to the door. A journey that is
 * all walking is dropped, because Walk already says that better.
 *
 * A BIKE ROUTE AND THE DOORS
 *
 * By bike the router's way is not always the answer. Where a saved ride
 * crossed between two points the router can only join the long way round —
 * a door, data/doors.json — and going through it is clearly shorter, the
 * way through the door is the first one and the router's own is the first
 * of `others`. Same fields, same words; DOORS below.
 *
 * MORE THAN ONE WAY
 *
 * The router is asked for alternatives and answers the ones it thinks are
 * worth a look: different streets, not much longer. They are what the bar on
 * the map and the card in Rattatee offer as a choice, a small button each.
 * The first way stays where it always was, at the top level, so a page or an
 * installed app that reads `meters`, `seconds` and `line` and nothing else
 * is answered exactly as before; `others` is the only thing added. The
 * router says how long and how far and never why one is nicer, so neither
 * does this.
 *
 * THE TURNS
 *
 * The router knows where a way turns as well as where it runs, and until
 * Rattatee wanted to say them aloud nobody asked it. `steps` is that, one
 * object a turn in the order they come: `at`, the corner; `meters`, how far
 * along the way from its start the corner is; `turn`, one of the words in
 * TURNS, or `roundabout` — with `exit`, counted from one, where the router
 * counted it — or `arrive`, which is always the last; and `name`, the street
 * the turn is onto, empty where the router has none. The words are few on
 * purpose: each is one recording in the app, so a sharp left is a left and a
 * slight one is keeping left. Setting off is not a step, and neither is a
 * street that changes its name under a rider going straight on. It is a
 * field added beside `line` in each way and nothing else moves, so the map
 * and an app installed before it read what they always did.
 *
 * WHY A ROUTE HERE AND NOT A FETCH FROM THE BROWSER
 *
 * The same reasons /api/geocode is one. The upstreams are free public
 * infrastructure and a worker can keep an answer in Cloudflare's cache where a
 * page cannot. Both ends are held to Tallinn's box and rounded before they go
 * upstream: the start to four decimals, about eleven metres, and the end to
 * five, so the hundred people who press the arrow on one restaurant from one
 * street are one upstream request and a route that starts on the wrong side of
 * the road by a metre is not a different one. A walk, a ride or a drive is cached a
 * day, since streets do not move; a bus journey a minute, since it leaves at
 * a time and the time goes. The browser is told to keep a walk, a ride or a drive for
 * an hour and a bus journey for the same minute.
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
 * Every refusal is one word: 400 `bad-points` for an end that is not two
 * numbers inside the box, 400 `bad-mode`, 404 `no-route` where the upstream
 * found none — for a bus, none with a ride in it — 422 `too-far` for a walk
 * past MAX_WALK, 429 `busy` when an upstream says it is, and 502 `upstream`
 * for anything else it answered, or failed to.
 *
 * Nothing waits on it. The page keeps the panel it had, says there is no
 * route for that mode, and the other three tabs and the Google link in the same
 * bar are still there.
 */

import { json, nearTallinn, km, dataFile } from './_lib.js';

const OSRM = {
  foot: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/',
  bike: 'https://routing.openstreetmap.de/routed-bike/route/v1/bike/',
  car: 'https://routing.openstreetmap.de/routed-car/route/v1/driving/'
};

const PEATUS = 'https://api.peatus.ee/routing/v1/routers/estonia/index/graphql';

/* Sent so the service can see who is asking, the way /api/geocode does. */
const AGENT = 'TallinnTastebuds/1.0 (+https://tallinntastebuds.ee)';

/* A day for a walk, a ride or a drive: streets do not move, and the same two rounded
   points are the same way for everybody. A minute for a bus, which is the
   next departure and stops being it. */
const CACHE_SECONDS = { foot: 86400, bike: 86400, car: 86400, bus: 60 };

/* Past this a walk is "you would take a bus", which is not a walk and not
   what the line is for. Ten kilometres is two hours on foot. A ride and a
   drive have no cap of their own: the box already holds both ends inside
   the city. */
const MAX_WALK = 10000;

/* How many journeys the bar offers: the next one and two after it. */
const TRIPS = 3;

/* And how many ways besides the first a walk, a ride or a drive is offered
   with: three in all, the same count as the journeys, when the router finds
   that many. */
const OTHERS = 2;

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

async function street(context, mode, from, to) {
  const url = OSRM[mode] + from.lng + ',' + from.lat + ';' + to.lng + ',' + to.lat +
    '?overview=full&geometries=geojson&steps=true&alternatives=';

  /* Asked for the others, and asked again for the one way if the router
     will not answer that: a router that stops taking a count of
     alternatives costs the buttons and never the line. */
  let res;
  try {
    res = await ask(url + OTHERS, mode);
    if (!res.ok && res.status !== 429) res = await ask(url + 'false', mode);
  } catch (e) {
    return json({ error: 'upstream' }, 502);
  }
  if (res.status === 429) return json({ error: 'busy' }, 429);
  if (!res.ok) return json({ error: 'upstream' }, 502);

  let body;
  try { body = await res.json(); } catch (e) { return json({ error: 'upstream' }, 502); }
  const routes = body && body.code === 'Ok' && Array.isArray(body.routes) ? body.routes : [];
  const first = way(routes[0]);
  if (!first) return json({ error: 'no-route' }, 404);
  if (!Number.isFinite(first.meters) || !Number.isFinite(first.seconds)) return json({ error: 'upstream' }, 502);
  if (mode === 'foot' && first.meters > MAX_WALK) return json({ error: 'too-far', meters: first.meters }, 422);

  /* An alternative that came back broken, or a walk past the cap, is one
     fewer button and not a refusal: the first way is the answer. */
  const others = routes.slice(1, 1 + OTHERS).map(way).filter((other) => other &&
    Number.isFinite(other.meters) && Number.isFinite(other.seconds) &&
    !(mode === 'foot' && other.meters > MAX_WALK));

  /* A bike way through a door goes first, and the router's own best becomes
     the first of the others — still offered, a button down. */
  const shortest = Math.min(first.meters, ...others.map((other) => other.meters));
  const through = mode === 'bike' ? await viaDoor(context, from, to, shortest) : null;
  const ways = through ? [through, first].concat(others).slice(0, 1 + OTHERS) : [first].concat(others);
  const best = ways[0];
  return json({ meters: best.meters, seconds: best.seconds, line: best.line, steps: best.steps, others: ways.slice(1) }, 200, 3600);
}

/* ------------------------------------------------------------------ doors
 * A door is a stretch somebody really cycled between two points the router
 * can only join the long way round: a gap in a fence, a crossing, a path
 * OpenStreetMap does not have. tools/doors.mjs finds them in the saved
 * rides and writes data/doors.json — { id, meters, around, line } each —
 * and a bike route is the router's way or, where it is clearly shorter, the
 * router to one end of a door, the door, and the router on from the other.
 * Doors in docs/handbook.md is the reasoning.
 *
 * A door is ridden either way. The ones worth asking about are picked as
 * the crow flies first, since that costs nothing: a door whose ends are
 * further from the two points than the saving it could make is not asked
 * about. At most DOORS are, nearest-looking first, two requests each, and
 * the first that wins is taken. A way with a door in it has to beat the
 * shortest way the router offered — its first is its quickest, not always
 * that — by DOOR_GAIN metres and by a seventh, or it is noise: GPS error
 * and a corner cut are worth a few metres each and neither is a door.
 *
 * Nothing waits on any of it: no file, a door that does not parse, a leg the
 * router will not answer — each is the router's own way, exactly as before.
 */
const DOORS = 2;
const DOOR_GAIN = 80;
const DOOR_RATIO = 6 / 7;

/* What a door is ridden at, in metres a second: fifteen kilometres an hour,
   which is what the router's bike profile makes of a plain street. */
const DOOR_SPEED = 4.2;

/* Nearer than this to a door's end, the way starts or stops at the door and
   there is no leg to ask the router for. */
const AT_DOOR = 15;

const metres = (a, b) => km({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] }) * 1000;

async function viaDoor(context, from, to, shortest) {
  let doors;
  try { doors = await dataFile(context, '/data/doors.json'); } catch (e) { return null; }
  if (!Array.isArray(doors)) return null;

  const start = [from.lat, from.lng];
  const end = [to.lat, to.lng];
  const worth = (meters) => shortest - meters >= DOOR_GAIN && meters <= shortest * DOOR_RATIO;
  const tries = [];
  for (const door of doors) {
    const line = door && Array.isArray(door.line) ? door.line : [];
    if (line.length < 2 || !Number.isFinite(door.meters)) continue;
    for (const way of [line, line.slice().reverse()]) {
      const least = metres(start, way[0]) + door.meters + metres(way[way.length - 1], end);
      if (worth(least)) tries.push({ line: way, meters: door.meters, least: least });
    }
  }
  tries.sort((a, b) => a.least - b.least);

  for (const door of tries.slice(0, DOORS)) {
    const [head, tail] = await Promise.all([
      leg(start, door.line[0]),
      leg(door.line[door.line.length - 1], end)
    ]);
    if (!head || !tail || !worth(head.meters + door.meters + tail.meters)) continue;
    return stitch(head, door, tail);
  }
  return null;
}

/* The router's one way between two points by bike, or a way of no length
   where they are the same place, or null where it has none. */
async function leg(a, b) {
  if (metres(a, b) < AT_DOOR) return { meters: 0, seconds: 0, line: [], steps: [] };
  try {
    const res = await ask(OSRM.bike + a[1] + ',' + a[0] + ';' + b[1] + ',' + b[0] +
      '?overview=full&geometries=geojson&steps=true&alternatives=false', 'bike');
    if (!res.ok) return null;
    const body = await res.json();
    const found = body && body.code === 'Ok' && Array.isArray(body.routes) ? way(body.routes[0]) : null;
    return found && Number.isFinite(found.meters) && Number.isFinite(found.seconds) ? found : null;
  } catch (e) {
    return null;
  }
}

/* The way in, the door and the way on as one way. The turn into the door
   and the turn out of it are steps like any other — the router knows
   neither, and a rider told nothing would ride past — worked out from how
   the line bends there, in the router's own words and with no street to
   name. The leg in loses its `arrive`, since it has not. */
function stitch(head, door, tail) {
  const into = head.meters;
  const out = head.meters + door.meters;
  const steps = head.steps.filter((s) => s.turn !== 'arrive');
  const enter = bend(head.line, door.line);
  if (enter) steps.push({ at: door.line[0], meters: into, turn: enter, name: '' });
  const leave = bend(door.line, tail.line);
  if (leave) steps.push({ at: door.line[door.line.length - 1], meters: out, turn: leave, name: '' });
  for (const s of tail.steps) steps.push(Object.assign({}, s, { meters: s.meters + out }));
  if (!tail.steps.length) steps.push({ at: door.line[door.line.length - 1], meters: out, turn: 'arrive', name: '' });
  return {
    meters: out + tail.meters,
    seconds: head.seconds + Math.round(door.meters / DOOR_SPEED) + tail.seconds,
    line: thin(head.line.concat(door.line, tail.line), MAX_POINTS),
    steps: steps
  };
}

/* The word for how the way bends where one line ends and the next begins,
   or '' where it goes straight on or one of them has no length to bend. */
function bend(before, after) {
  if (before.length < 2 || after.length < 2) return '';
  const heading = (a, b) => Math.atan2(
    (b[1] - a[1]) * Math.cos(a[0] * Math.PI / 180), b[0] - a[0]) * 180 / Math.PI;
  const turn = (heading(after[0], after[1]) -
    heading(before[before.length - 2], before[before.length - 1]) + 540) % 360 - 180;
  const size = Math.abs(turn);
  if (size < 25) return '';
  if (size > 155) return 'around';
  return (size < 55 ? 'keep-' : '') + (turn < 0 ? 'left' : 'right');
}

function ask(url, mode) {
  return fetch(url, {
    headers: { 'user-agent': AGENT, accept: 'application/json' },
    cf: { cacheTtl: CACHE_SECONDS[mode], cacheEverything: true }
  });
}

/* What the router calls the way a turn bends, and the word it is answered
   with: its eight in six of ours, a recording each in Rattatee. */
const TURNS = {
  uturn: 'around',
  'sharp left': 'left',
  left: 'left',
  'slight left': 'keep-left',
  straight: 'straight',
  'slight right': 'keep-right',
  right: 'right',
  'sharp right': 'right'
};

/* The word for one of the router's manoeuvres, or '' for one nobody needs
   telling: setting off, leaving a roundabout the exit was already counted
   for, and a street that is renamed or joined while going straight on. */
function turnOf(maneuver) {
  const type = String(maneuver.type || '');
  if (type === 'arrive') return 'arrive';
  if (type === 'roundabout' || type === 'rotary') return 'roundabout';
  if (type === 'depart' || type === 'notification' || type.startsWith('exit ')) return '';
  const turn = TURNS[maneuver.modifier] || '';
  if (turn === 'straight' && (type === 'new name' || type === 'continue' || type === 'merge')) return '';
  return turn;
}

/* Where one of the router's routes turns: THE TURNS in the header. A way
   whose steps did not come, or came in a shape this does not know, has none
   and is still a way. */
function turns(route) {
  const out = [];
  let meters = 0;
  for (const leg of Array.isArray(route.legs) ? route.legs : []) {
    for (const s of Array.isArray(leg.steps) ? leg.steps : []) {
      const m = (s && s.maneuver) || {};
      const turn = turnOf(m);
      const at = Array.isArray(m.location) ? [Number(m.location[1]), Number(m.location[0])] : [];
      if (turn && Number.isFinite(at[0]) && Number.isFinite(at[1])) {
        const step = {
          at: [Number(at[0].toFixed(5)), Number(at[1].toFixed(5))],
          meters: Math.round(meters),
          turn: turn,
          name: typeof s.name === 'string' ? s.name : ''
        };
        if (turn === 'roundabout' && Number.isInteger(m.exit) && m.exit > 0) step.exit = m.exit;
        out.push(step);
      }
      meters += Number(s && s.distance) || 0;
    }
  }
  return out;
}

/* One of the router's routes as the four fields the answer carries, or null
   for one with no line to draw. */
function way(route) {
  const coords = route && route.geometry && Array.isArray(route.geometry.coordinates)
    ? route.geometry.coordinates : null;
  if (!coords || coords.length < 2) return null;
  /* GeoJSON is [lon, lat]; this is the second place that flips it, as
     /api/geocode's shape() is the first. */
  return {
    meters: Math.round(Number(route.distance)),
    seconds: Math.round(Number(route.duration)),
    line: thin(coords.map((c) => [c[1], c[0]]), MAX_POINTS),
    steps: turns(route)
  };
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
  return street(context, mode, from, to);
}
