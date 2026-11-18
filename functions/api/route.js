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
 * And by bike some streets are not offered at all. A way that rides Tartu
 * maantee for more than a crossing is asked for again round it, and only
 * the ways that keep off are answered — KEEPING OFF below.
 *
 * And by bike a way can be a train: ride to a station, an Elron train with
 * the bike on it, ride on. Those are `trains`, answered beside the ways by
 * /api/v1/route only, never here — TRAINS below says why.
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

async function street(context, mode, from, to, withTrains) {
  /* Asked at once, beside the router, so the train costs no time of its
     own; read only once the bike ways are known, since a train is offered
     only where it beats them. TRAINS below. */
  const asked = withTrains && mode === 'bike' ? departures(from, to) : null;
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
  let ways = through ? [through, first].concat(others) : [first].concat(others);
  if (mode === 'bike') ways = await keepOff(ways, from, to, shortest);
  ways = ways.slice(0, 1 + OTHERS);
  const best = ways[0];
  const answer = { meters: best.meters, seconds: best.seconds, line: best.line, steps: best.steps, others: ways.slice(1) };
  if (!asked) return json(answer, 200, 3600);
  /* A train leaves at a time and the time goes, so an answer with one in it
     is kept a minute, as a bus journey is; one without, the hour the ways
     alone would be. */
  answer.trains = await byTrain(from, to, await asked, Math.min(...ways.map((w) => w.seconds)));
  return json(answer, 200, answer.trains.length ? CACHE_SECONDS.bus : 3600);
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
  return oneWay([a, b]);
}

/* The router's one way by bike through [lat, lng] points in order, or null
   where it has none. */
async function oneWay(points) {
  try {
    const res = await ask(OSRM.bike + points.map((p) => p[1] + ',' + p[0]).join(';') +
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

/* ------------------------------------------------------------ keeping off
 * Some streets the router likes and a rider does not. Tartu maantee is the
 * first: a cycleway beside six lanes of traffic, from Viru väljak to the
 * Ülemiste junction, which the router's bike profile reads as the best way
 * into the centre from the south-east. The owner asked for it not to be
 * offered. OSRM's public server cannot be told to avoid a street, so where
 * a way rides one the router is asked again, through a point either side
 * of the stretch ridden, KEEP_OFF_AWAY metres out and square to it, which
 * it snaps to the nearest street it can ride — a parallel one.
 *
 * A way rides a street for as many metres of it as lie within the street's
 * `width` of its line, not counting the first and last KEEP_OFF_ENDS: a
 * place on Tartu maantee is still reached, and crossing it is not riding
 * it. A way riding KEEP_OFF_MIN or less keeps off. A way round counts only
 * when it is at most KEEP_OFF_LONGER times the shortest way, so a detour
 * across the city is not offered as one.
 *
 * Where any way keeps off, only those are offered — the router's own in
 * the router's order first, then the ways round, quickest first. Where
 * none does, as from a door on Tartu maantee itself, the ones that ride
 * least of it are, and a way down its whole length beside them is not.
 * The answer's shape does not change, so the map and both apps simply get
 * a different line. Nothing waits on it: a way round the router will not
 * answer is one fewer to choose from, and no way round at all is the
 * router's answer as it was.
 */
const KEEP_OFF = [
  {
    name: 'Tartu maantee',
    width: 60,
    line: [[59.43575, 24.7552], [59.4349, 24.758], [59.43339, 24.76096], [59.43279, 24.76266],
      [59.43255, 24.76354], [59.43166, 24.76757], [59.43115, 24.76933], [59.42996, 24.77235],
      [59.42935, 24.77385], [59.42845, 24.77592], [59.42765, 24.77767], [59.427, 24.77903],
      [59.42569, 24.7816], [59.42475, 24.78383], [59.42405, 24.78543], [59.42292, 24.78737],
      [59.42258, 24.78784]]
  }
];
const KEEP_OFF_MIN = 150;
const KEEP_OFF_ENDS = 150;
const KEEP_OFF_AWAY = [350, 700];
const KEEP_OFF_LONGER = 1.5;

/* A point as metres east and north, near enough flat across a city. */
const EAST = 111320 * Math.cos(59.43 * Math.PI / 180);
const NORTH = 110540;
const flat = (p) => [p[1] * EAST, p[0] * NORTH];

/* How far a point is from a line, in metres. */
function apart(p, line) {
  const [x, y] = flat(p);
  let least = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = flat(line[i - 1]);
    const [bx, by] = flat(line[i]);
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    least = Math.min(least, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return least;
}

/* How far a way rides the streets to keep off, and from where to where. */
function ridden(way) {
  let gone = 0;
  let meters = 0;
  let start = null;
  let end = null;
  for (let i = 1; i < way.line.length; i++) {
    const a = way.line[i - 1];
    const b = way.line[i];
    const step = metres(a, b);
    if (gone >= KEEP_OFF_ENDS && gone + step <= way.meters - KEEP_OFF_ENDS &&
      KEEP_OFF.some((street) => apart(a, street.line) < street.width && apart(b, street.line) < street.width)) {
      meters += step;
      start = start || a;
      end = b;
    }
    gone += step;
  }
  return { meters: meters, start: start, end: end };
}

async function keepOff(ways, from, to, shortest) {
  const rides = ways.map(ridden);
  const worst = rides.reduce((a, b) => (b.meters > a.meters ? b : a));
  if (worst.meters <= KEEP_OFF_MIN) return ways;

  const [sx, sy] = flat(worst.start);
  const [ex, ey] = flat(worst.end);
  const length = Math.hypot(ex - sx, ey - sy) || 1;
  const middle = [(worst.start[0] + worst.end[0]) / 2, (worst.start[1] + worst.end[1]) / 2];
  const vias = [];
  for (const away of KEEP_OFF_AWAY) {
    for (const side of [1, -1]) {
      vias.push([
        Number((middle[0] + (ex - sx) / length * away * side / NORTH).toFixed(5)),
        Number((middle[1] - (ey - sy) / length * away * side / EAST).toFixed(5))
      ]);
    }
  }
  const round = (await Promise.all(vias.map((via) => oneWay([[from.lat, from.lng], via, [to.lat, to.lng]]))))
    .filter((way) => way && way.meters <= shortest * KEEP_OFF_LONGER)
    .sort((a, b) => a.seconds - b.seconds);

  const all = ways.concat(round);
  const on = rides.concat(round.map(ridden)).map((r) => r.meters);
  const least = Math.min(...on);
  const room = least <= KEEP_OFF_MIN ? KEEP_OFF_MIN : least + KEEP_OFF_MIN;

  /* Two points either side can snap to one street: one button each. */
  const kept = [];
  all.forEach((way, i) => {
    if (on[i] <= room && !kept.some((k) => Math.abs(k.meters - way.meters) < 20 && Math.abs(k.seconds - way.seconds) < 20)) kept.push(way);
  });
  return kept;
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
  const legs = Array.isArray(route.legs) ? route.legs : [];
  for (const leg of legs) {
    for (const s of Array.isArray(leg.steps) ? leg.steps : []) {
      const m = (s && s.maneuver) || {};
      /* A way asked through a point — KEEPING OFF — arrives there too, and
         rides on; only the last leg's arrival is one. */
      const turn = turnOf(m) === 'arrive' && leg !== legs[legs.length - 1] ? '' : turnOf(m);
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

/* ----------------------------------------------------------------- trains
 * A bike goes on an Elron train, and from the right corner of the city the
 * train is quicker: ride to Ülemiste, ride the RE33 two stops, ride on. The
 * owner did exactly that on 2026-11-17 and saved the ride. So by bike, and
 * only where it is asked for — /api/v1/route, through `withTrains` — the
 * answer carries `trains` beside the ways:
 *
 *   "trains": [ { "seconds": 960, "meters": 5120, "leave": "14:01",
 *                 "legs": [ { "kind": "bike", "meters": 1330, "seconds": 330,
 *                             "line": [...], "steps": [...] },
 *                           { "kind": "train", "name": "RE33",
 *                             "from": "Ülemiste", "to": "Kitseküla",
 *                             "at": "14:09", "until": "14:13",
 *                             "meters": 3366, "line": [...] },
 *                           { "kind": "bike", ... } ] } ]
 *
 * `seconds` is from setting off to the door: the ride to the station,
 * TRAIN_BOARD on the platform, the train and the ride on. `leave` is when
 * to set off. The wait before that is not counted, because it is spent at
 * home or at the table rather than on the way, and counting it hid the train
 * nearly always: on the first morning it was tried the next one from
 * Ülemiste was forty-one minutes off, and an Elron line runs every half hour
 * to hour. So a train is a way with a time on it, the way a bus journey is,
 * and the bar says when it goes. A bike leg is the
 * same four fields a way has, and its last step `arrive` — at the station
 * for the first, at the door for the last; a leg of no length, from a door
 * on the platform, is left out.
 *
 * Not in /api/route, and that is the reason for a version: both apps read
 * the bike ways out of that answer and nothing else, and a train is not a
 * way they can draw or speak. /api/route answers them exactly as before.
 *
 * Where it comes from: peatus.ee is asked once for bike and rail together —
 * the planner carries the bike on board — and says which station, which
 * train and when. It says nothing about which way to turn, so the two rides
 * either side are asked of the same bike router every way here comes from,
 * kept off the same streets, and they are what the turns are spoken from.
 * One train and no change: two trains with a bike is not a way anybody
 * takes across a city.
 *
 * Offered only where it is quicker than the quickest bike way, and then
 * the next one that can still be caught and leaves within TRAIN_WAIT, at
 * most TRAINS of them, each from a different pair of stations. Nothing waits on it: the planner down, slow
 * or with nothing to say, a ride to a station the router will not answer —
 * each is `trains: []` and the ways exactly as they were.
 */
const TRAINS = 2;

/* Departures asked for: the planner answers the next few, the first of
   which may already be out of reach once the ride to the station is known. */
const TRAIN_ASK = 4;

/* Seconds on the platform before the train: buying nothing, but lifting a
   bike up the step of an Elron car and finding the bike space. */
const TRAIN_BOARD = 120;

/* How long ahead a train is worth offering: an hour, which is the gap
   between Elron's trains through Tallinn at its emptiest. Past it the way
   is a plan for later, and the planner's next departures are not asked
   that far anyway. */
const TRAIN_WAIT = 3600;

/* Each departure the planner offers with one train in it: the stations, as
   names and points, when it leaves and arrives, and the rail between. */
async function departures(from, to) {
  const place = 'name lat lon';
  const query = '{ plan(from: {lat: ' + from.lat + ', lon: ' + from.lng + '}, ' +
    'to: {lat: ' + to.lat + ', lon: ' + to.lng + '}, numItineraries: ' + TRAIN_ASK + ', ' +
    'transportModes: [{mode: BICYCLE}, {mode: RAIL}]) { itineraries { legs { ' +
    'mode transitLeg startTime endTime distance route { shortName } ' +
    'from { ' + place + ' } to { ' + place + ' } legGeometry { points } } } } }';
  try {
    const res = await fetch(PEATUS, {
      method: 'POST',
      headers: { 'user-agent': AGENT, accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ query: query })
    });
    if (!res.ok) return [];
    const body = await res.json();
    if (body && Array.isArray(body.errors) && body.errors.length) console.error('peatus trains', body.errors[0].message);
    const plan = body && body.data && body.data.plan;
    return (plan && Array.isArray(plan.itineraries) ? plan.itineraries : []).map((it) => {
      const rides = (Array.isArray(it.legs) ? it.legs : []).filter((l) => l.transitLeg);
      const train = rides[0];
      if (rides.length !== 1 || train.mode !== 'RAIL' || !train.from || !train.to) return null;
      const at = Number(train.startTime);
      const until = Number(train.endTime);
      const line = train.legGeometry && train.legGeometry.points ? decode(train.legGeometry.points) : [];
      if (!Number.isFinite(at) || !Number.isFinite(until) || line.length < 2) return null;
      return {
        name: (train.route && train.route.shortName) || '',
        from: { name: train.from.name || '', lat: Number(train.from.lat), lng: Number(train.from.lon) },
        to: { name: train.to.name || '', lat: Number(train.to.lat), lng: Number(train.to.lon) },
        at: at,
        until: until,
        meters: Math.round(Number(train.distance)) || 0,
        line: line
      };
    }).filter(Boolean);
  } catch (e) {
    return [];
  }
}

/* The departures as ways to choose: a ride to the station and one from it
   for each pair of stations, and the first departure of each pair that can
   be caught within TRAIN_WAIT, kept where it beats `quickest`, the best
   bike way's seconds. */
async function byTrain(from, to, found, quickest) {
  const pairs = new Map();
  for (const d of found) {
    const key = d.from.name + '>' + d.to.name;
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key).push(d);
  }
  const now = Date.now();
  const out = [];
  for (const list of Array.from(pairs.values()).slice(0, TRAINS)) {
    const first = list[0];
    const [head, tail] = await Promise.all([
      ride(from, first.from),
      ride(first.to, to)
    ]);
    if (!head || !tail) continue;
    const setOff = (d) => d.at - (head.seconds + TRAIN_BOARD) * 1000;
    const go = list.slice().sort((a, b) => a.at - b.at)
      .find((d) => setOff(d) >= now && setOff(d) - now <= TRAIN_WAIT * 1000);
    if (!go) continue;
    const seconds = head.seconds + TRAIN_BOARD + Math.round((go.until - go.at) / 1000) + tail.seconds;
    if (seconds >= quickest) continue;
    const legs = [];
    if (head.meters) legs.push(Object.assign({ kind: 'bike' }, head));
    legs.push({
      kind: 'train',
      name: go.name,
      from: go.from.name,
      to: go.to.name,
      at: CLOCK.format(new Date(go.at)),
      until: CLOCK.format(new Date(go.until)),
      meters: go.meters,
      line: thin(go.line, MAX_POINTS / 3)
    });
    if (tail.meters) legs.push(Object.assign({ kind: 'bike' }, tail));
    out.push({
      seconds: seconds,
      meters: head.meters + go.meters + tail.meters,
      leave: CLOCK.format(new Date(setOff(go))),
      legs: legs
    });
  }
  return out.sort((a, b) => a.seconds - b.seconds);
}

/* A bike leg to or from a station: the router's way, kept off the streets
   every bike way keeps off, with its line thinned to a third of a way's. */
async function ride(a, b) {
  const start = [a.lat, a.lng];
  const end = [b.lat, b.lng];
  if (!start.concat(end).every(Number.isFinite)) return null;
  const one = await leg(start, end);
  if (!one || !one.meters) return one;
  const [kept] = await keepOff([one], { lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }, one.meters);
  const way = kept || one;
  return { meters: way.meters, seconds: way.seconds, line: thin(way.line, MAX_POINTS / 3), steps: way.steps };
}

/* The route, asked by /api/route and by /api/v1/route, which differ in
   one thing: whether a bike way comes with its trains. */
export function answerRoute(context, q, withTrains) {
  const from = point(q.get('from'), 4);
  const to = point(q.get('to'), 5);
  if (!from || !to) return json({ error: 'bad-points' }, 400);
  const mode = q.get('mode') || 'foot';
  if (mode === 'bus') return transit(from, to);
  if (!OSRM[mode]) return json({ error: 'bad-mode' }, 400);
  return street(context, mode, from, to, withTrains);
}

export function onRequestGet(context) {
  return answerRoute(context, new URL(context.request.url).searchParams, false);
}
