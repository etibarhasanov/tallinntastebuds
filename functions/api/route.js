/**
 * Tallinn Tastebuds — the way from here to a place: on foot, by bike, by bus
 * or by car.
 *
 * GET /api/v1/route?from=59.4370,24.7536&to=59.4389,24.7291[&mode=foot|bike|car|bus][&heading=250]
 *
 *   mode is foot when it is left out. heading is the way the asker is
 *   already moving, in degrees from north — SETTING OFF THE WAY THEY ARE
 *   GOING below.
 *
 *   Every answer, refusals included, says `"version": 1` and carries an
 *   `API-Version: 1` header — A VERSION ON EVERY ANSWER below.
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
 *   bus  → { "trips": [ { "seconds": 1320, "leave": "14:01",
 *                   "legs": [ { "line": [...] },
 *                             { "name": "17", "color": "0064B0",
 *                               "from": "Vabaduse väljak", "at": "14:09",
 *                               "line": [...] }, … ] }, … ] }
 *
 *             A leg that is a ride carries the line's name; a walk does not.
 *             `leave` is when to set off from the point asked from: the
 *             planner starts the walk so that it reaches the stop as the
 *             ride does, so `seconds` is counted from then and has no wait
 *             in it. A journey that starts on board leaves at its first
 *             ride's `at`.
 *
 * What draws the line on the map when the arrow in a place's top strip is
 * pressed — see paintDirections() and showRoute() in assets/app.js. The bar
 * that stands on the map has four modes, Walk · Bike · Bus · Car, and each asks this
 * route once; the page shows our own answer first and keeps Google's
 * directions as a quiet link under it.
 *
 * WHERE EACH ANSWER COMES FROM
 *
 * Walking and driving are the OpenStreetMap Germany routing service, its foot
 * and car profiles: the same request shape, a different path. Cycling is
 * BRouter first, under the owner's rules — NICE WAYS BY BIKE below — and
 * that service's bike profile where BRouter has no answer. The bike
 * profile prefers cycle paths and lanes and, where there is none, takes a
 * pedestrian street or a footpath at walking pace — so one line can cross
 * the Old Town, which is the thing a bike route from Google cannot do.
 * The bus is
 * peatus.ee, the national journey planner the Transport Administration
 * (Transpordiamet) runs — an OpenTripPlanner over the consolidated timetable
 * of every operator in Estonia, Tallinn's buses, trams and trolleybuses
 * among them, open to anybody without a key. It is asked "from here to there,
 * leaving now" and answers up to TRIPS journeys, each a run of legs: a walk
 * to a stop, a ride, maybe a change, a walk to the door. A journey that is
 * all walking is dropped, because Walk already says that better.
 *
 * NICE WAYS BY BIKE
 *
 * Since 2026-11-23 a bike way is asked of BRouter first, which takes
 * rules with a request where the router takes none. The owner's: a
 * park is ridden, at ten kilometres an hour; a main road, its lane and the
 * path beside it are dearer for their traffic; no way is a big round trip;
 * and of the ways found the quietest is the first. ./_brouter.js asks, and
 * NICE WAYS below is what is made of the answer: up to three ways, kept off
 * the streets every bike way keeps off, through a door where one is still
 * a shortcut, in the same fields and the same words as ever.
 *
 * And a stretch riders take that the map prices wrong — a street it has
 * as one-way where bikes ride both ways — is ridden by a way of its own,
 * offered beside the others to a ride that runs along it.
 * data/bike-taken.json, and TAKEN below.
 *
 * The doors, the ridden way first, keeping off, the spurs, the settling
 * and the ways either side, as the sections after this one have them, are
 * the bike way the router makes. It is the answer where BRouter has none,
 * where the asker gave a heading, and at the two ends of a ride between
 * cities.
 *
 * A BIKE ROUTE AND THE DOORS
 *
 * By bike the router's way is not always the answer. Where a saved ride
 * crossed between two points the router can only join the long way round,
 * or by a path it has a bike pushed along — a door, data/doors.json — and
 * going through it is better, the way through the door, or through as
 * many as three, is the first one and the router's own is the first of
 * `others`. Same fields, same words; DOORS below.
 *
 * And where people have ridden one of the ways between the two points,
 * that way and held their pace on it, it is the first one, with `ridden:
 * true` beside it — RIDDEN below.
 *
 * And by bike some streets are not offered at all. A way that rides Tartu
 * maantee, Liivalaia, Pärnu maantee from Vabaduse väljak to Liivalaia, or
 * Laagna tee for more than a crossing is asked for again round it, and only
 * the ways that keep off are answered — KEEPING OFF below.
 *
 * And by bike and on foot no way rides out and straight back the way it
 * came — SPURS below. Nor, by bike, does a way keep the bend it made to
 * reach a point it was asked through — SETTLING below.
 *
 * And by bike a way can be a train: ride to a station, an Elron train with
 * the bike on it, ride on. Those are `trains`, answered beside the ways —
 * TRAINS below.
 *
 * And by bike from one city to another, only the ends are refined: the
 * long road between them is the router's, cut at the junctions where it
 * leaves the one city and enters the other, and kept in `route_middles` so
 * the next rider is not asked for it again — LONG RIDES below.
 *
 * And every one of those rules is held to the trips it must not move.
 * data/bike-trips.json pins trips across town, two points each and the
 * ways answered between them, confirmed where the owner has looked at them
 * on the map and said they are right, and carrying their words where they
 * said they are wrong. `node tools/routecheck.mjs` runs this file for each
 * over what the two routers were recorded answering, and a change here is
 * run against it before it is pushed: a way that moved is the owner's to
 * judge from a picture, not a pin to rewrite. The owner tries a trip
 * against this route on /admin/ways. The bike ways, pinned in
 * docs/handbook.md.
 *
 * SETTING OFF THE WAY THEY ARE GOING
 *
 * A way asked for in the middle of a ride is not the same question as one
 * asked for standing still. Rattatee asks again when its rider has plainly
 * left the way, and the router, told only where they are, answers the
 * shortest way from that spot — which for somebody riding away from the old
 * way is "turn around", the advice they have just ridden a hundred and
 * fifty metres past. So it sends `heading` with that question, and the
 * router is told to leave the first point within HEADING_RANGE degrees of
 * it: the new way goes on the way the rider is going and turns where it
 * next can. It is rounded to HEADING_STEP degrees so riders on one street
 * share a cached answer, and a heading that is not a number is no heading
 * rather than a refusal, as is one the router has no street for.
 *
 * With a heading the answer is the router's own ways, kept off the streets
 * every bike way keeps off, and nothing put together from doors, which are
 * stitched from the spot outward in whichever direction they run: one that
 * started backwards would be the same "turn around" under another name.
 * Nor is any way put first as ridden, which costs a read of the database
 * that a new way every few hundred metres should not. Nothing else about the answer changes, and a page or
 * an app that sends none is answered exactly as before.
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
 * does this — though by bike the order says it: BRouter's ways come the
 * quietest first.
 *
 * And by bike, where that leaves fewer than three, the router is asked for
 * a way round on either side of the straight line — EITHER SIDE below.
 *
 * ONE ROUND AT A TIME
 *
 * By bike every refinement below asks the router again, and each used to
 * wait for the one before it: the router, the doors, the streets kept off,
 * the ways either side, the rides, the settling. A round is half a second
 * or more to the router in Germany and back, so a bike way took two to four
 * seconds where a walk takes one request, and on 2026-11-23 the owner found
 * it very slow — six, from Tõnismägi to Viimsi. So whatever needs nothing
 * from the round before it is asked beside it. The two ways round either
 * side need only the ends, and are asked with the router's first request.
 * The router's ways are kept off the streets to keep off while the doors
 * are asked about, and kept off again with the door's way only where a
 * door wins. The first three ways are settled while the rides are read.
 * Every answer is the one it was; what it costs is the requests whose
 * answers go unused — the two ways round on a ride the router already gave
 * three ways for, the streets kept off a second time where a door wins, and
 * one settling where the ridden way was further down than third.
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
 * street that changes its name under a rider going straight on. Corners
 * closer together than KNOT are one step, said as the turn they make
 * between them, since a phone says a corner forty metres out and would
 * otherwise be saying the next while the rider is in this one. It is a
 * field added beside `line` in each way and nothing else moves, so the map
 * and an app installed before it read what they always did.
 *
 * A way of BRouter's has the same steps in the same words, out of its own
 * turn hints, and no street's name in any of them: its map carries none.
 * Rattatee's row is then the turn alone.
 *
 * One step is not a corner: `tunnel`, where the way goes into one, with the
 * tunnel's name where the router has it, so Rattatee can say "enter the
 * tunnel" on the Veerenni path under the railway. The router marks the
 * stretch after a junction as a tunnel rather than the tunnel itself, so a
 * path under four tracks is four short tunnels to it; tunnel stretches less
 * than TUNNEL_GAP apart are one tunnel and said once. A word an app does not
 * know is one it leaves out, so a phone with Rattatee from before it hears
 * the turns it always did.
 *
 * WHY A ROUTE HERE AND NOT A FETCH FROM THE BROWSER
 *
 * The same reasons /api/v1/geocode is one. The upstreams are free public
 * infrastructure and a worker can keep an answer in Cloudflare's cache where a
 * page cannot. Both ends are held to Estonia's box and rounded before they go
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
 * `inEstonia()` in ./_lib.js draws round the country, a walk of at most MAX_WALK, and
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
 *
 * A VERSION ON EVERY ANSWER
 *
 * The map page and both apps once asked /api/v1/route first and /api/route
 * where it did not answer, and told the two apart by `version`: the old
 * address answered the same ways with no trains, because an installed app
 * that read `others` alone could not have drawn or spoken one. The old
 * address went on 2026-11-21 — functions/_middleware.js answers it with a
 * 410 — so every answer is this one, called by the v1 catch-all,
 * ./v1/[[path]].js. An installed build still takes an answer without
 * `version` to mean an older deployment and asks the old address, so the
 * field stays on every answer, refusals included.
 */

import { json, inEstonia, cityOf, km, dataFile, wrongDatabase } from './_lib.js';
import { riddenShare } from './_sections.js';
import { brouterWays } from './_brouter.js';
import { VERSION } from '../_public.js';

const OSRM = {
  foot: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/',
  bike: 'https://routing.openstreetmap.de/routed-bike/route/v1/bike/',
  car: 'https://routing.openstreetmap.de/routed-car/route/v1/driving/'
};

const PEATUS = 'https://api.peatus.ee/routing/v1/routers/estonia/index/graphql';

/* Sent so the service can see who is asking, the way /api/v1/geocode does. */
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

/* A heading is rounded to this many degrees, and the way must set off
   within this many either side of it. */
const HEADING_STEP = 15;
const HEADING_RANGE = 45;

const CLOCK = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Tallinn', hour: '2-digit', minute: '2-digit', hour12: false
});

function point(raw, places) {
  const [a, b] = String(raw || '').split(',');
  const lat = Number(a);
  const lng = Number(b);
  if (!a || !b || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!inEstonia(lat, lng)) return null;
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

/* `heading`, where the asker gave one, as the router takes it: for the
   first of `points` points, and none for the rest. */
function bearings(heading, points) {
  return heading === null ? '' : '&bearings=' + heading + ',' + HEADING_RANGE + ';'.repeat(points - 1);
}

async function street(context, mode, from, to, heading) {
  /* Asked at once, beside the router, so the train costs no time of its
     own; read only once the bike ways are known, since a train is offered
     only where it beats them. TRAINS below. */
  const asked = mode === 'bike' ? departures(from, to) : null;

  /* By bike from one city to another, the ends are refined and the middle
     is kept — LONG RIDES below. Anything it cannot do is the ride as
     below. */
  const long = mode === 'bike' && heading === null ? await longRide(context, from, to) : null;
  if (long) return answered(from, to, long, asked);

  /* By bike the ways are BRouter's, found by the owner's rules — NICE WAYS
     below. Where it has none the ride is the router's, as below; with a
     heading it is not asked, and a ride between cities has gone above. */
  const nice = mode === 'bike' && heading === null ? await niceWays(context, from, to) : null;
  if (nice) return answered(from, to, nice, asked, (a, b) => niceRide(context, a, b));

  /* By bike the ways round either side need nothing but the two ends, so
     they are asked now, beside the router — ONE ROUND AT A TIME in the
     header. */
  const sides = mode === 'bike' && heading === null ? sideWays(from, to) : null;

  const url = OSRM[mode] + from.lng + ',' + from.lat + ';' + to.lng + ',' + to.lat +
    '?overview=full&geometries=geojson&steps=true&alternatives=';

  /* Asked for the others, and asked again for the one way if the router
     will not answer that: a router that stops taking a count of
     alternatives costs the buttons and never the line. Before either, with
     a heading, asked to set off that way — and without it where the router
     has no street there running that way. */
  const tries = (heading === null ? [] : [OTHERS + bearings(heading, 2)]).concat([OTHERS, 'false']);
  let res;
  try {
    for (const tail of tries) {
      res = await ask(url + tail, mode);
      if (res.ok || res.status === 429) break;
    }
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

  /* By bike a way through a door goes first, and the router's own best
     becomes the next of the others — still offered, a button down. Not
     where it is the door's line pushed, though: that is one way twice, the
     slower time under a button of its own. And not with a heading, which
     only the router's ways set off by.

     The router's own ways are kept off the streets to keep off while the
     doors are asked about, and that is the answer wherever no door wins,
     which is nearly everywhere; where one does, its way is kept off with
     them, as it always was. */
  const shortest = Math.min(first.meters, ...others.map((other) => other.meters));
  const found = [first].concat(others);
  const [through, kept] = await Promise.all([
    mode === 'bike' && heading === null
      ? doors(context).then((all) => viaDoor(all, [from.lat, from.lng], [to.lat, to.lng], Math.min(...found.map(reach)), DOORS_DEEP))
      : null,
    mode === 'bike' ? keepOff(found, from, to, shortest, heading) : found
  ]);
  let ways = through
    ? await keepOff([through].concat(found.filter((other) =>
      Math.abs(other.meters - through.meters) > SAME_WAY || other.seconds < through.seconds)), from, to, shortest, heading)
    : kept;
  if (mode === 'bike' || mode === 'foot') {
    ways = ways.map(unspur).filter((way, i, all) => !all.slice(0, i).some((before) => alike(way, before)));
  }
  if (sides && ways.length <= OTHERS) ways = await eitherSide(ways, from, to, sides);
  /* A way that keeps off goes before one that does not, wherever it was
     found — KEEPING OFF below. */
  if (mode === 'bike') {
    ways = ways.map((way) => ({ way, rides: ridden(way).meters > KEEP_OFF_MIN }))
      .sort((a, b) => a.rides - b.rides).map((one) => one.way);
  }
  /* And of all of those, the one riders made the most of goes in front —
     RIDDEN below — and a way asked through a made-up point is asked again
     through its own streets, which can make two ways one — SETTLING below.
     The first three are settled while the rides are read, and the ridden
     way too where it was further down. */
  const [best, settled] = await Promise.all([
    mode === 'bike' && heading === null ? riddenBest(context, ways, shortest) : -1,
    Promise.all(ways.slice(0, 1 + OTHERS).map((one) => settle(one, heading)))
  ]);
  if (best >= 0) {
    const front = best < settled.length ? settled[best] : await settle(ways[best], heading);
    ways = [Object.assign(front, { ridden: true })].concat(settled.filter((way, i) => i !== best)).slice(0, 1 + OTHERS);
  } else {
    ways = settled;
  }
  ways = ways.filter((way, i, all) => !all.slice(0, i).some((before) => alike(way, before)));
  return answered(from, to, ways, asked);
}

/* A way as it is answered: the fields the pages and the apps read, and
   nothing it carries for the work here — how much of it is beside traffic.
   `ridden` is on the way riders made the most of, wherever it comes. */
const shown = (way) => Object.assign({ meters: way.meters, seconds: way.seconds, line: way.line, steps: way.steps },
  way.ridden ? { ridden: true } : {});

/* The ways as the answer: the first at the top level, the rest as
   `others`, and by bike the trains that beat them — their rides to and
   from the station by `leg`, the router the ways came from. */
async function answered(from, to, ways, asked, leg = ride) {
  const best = ways[0];
  const answer = { meters: best.meters, seconds: best.seconds, line: best.line, steps: best.steps, others: ways.slice(1).map(shown) };
  if (best.ridden) answer.ridden = true;
  if (!asked) return json(answer, 200, 3600);
  /* A train leaves at a time and the time goes, so an answer with one in it
     is kept a minute, as a bus journey is; one without, the hour the ways
     alone would be. */
  answer.trains = await byTrain(from, to, await asked, Math.min(...ways.map((w) => w.seconds)), leg);
  return json(answer, 200, answer.trains.length ? CACHE_SECONDS.bus : 3600);
}

/* ------------------------------------------------------------------ doors
 * A door is a stretch somebody really cycled between two points the router
 * can only join the long way round, or only by having the bike pushed: a
 * gap in a fence, a crossing, a path OpenStreetMap does not have, a path
 * across a park it has as a footpath. tools/doors.mjs finds them in the
 * saved rides and writes data/doors.json — { id, meters, around, brouter,
 * line } each — and a bike route is the router's way or, where it is better, the
 * router to one end of a door, the door, and the router on from the other.
 * Doors in docs/handbook.md is the reasoning.
 *
 * Better is measured by reach(): a way's metres, or the metres a ride
 * covers at PACE in the time the router gives it where that is more. An
 * ordinary street comes out at its own length; a path the router pushes a
 * bike along comes out at more than twice it, which is what it costs a
 * rider. A door is ridden, so it reaches exactly as far as it is long, and
 * a way through one goes first wherever it reaches DOOR_GAIN metres and a
 * tenth less than the best the router offered. Less than that is noise:
 * GPS error and a corner cut are worth a few metres each and neither is a
 * door. The bar was eighty metres and a seventh, by length alone, until
 * the owner asked for a door to be offered more readily.
 *
 * A door is ridden either way. The ones worth asking about are picked as
 * the crow flies first, since that costs nothing: a door whose ends are
 * further from the two points than the saving it could make is not asked
 * about. At most DOORS are, nearest-looking first, two requests each, and
 * the first that wins is taken.
 *
 * And a way can go through more than one. The way in to a door and the way
 * on from it are ways between two points like any other, so each is put to
 * the doors again, DOORS_DEEP times over: three doors a route at the most,
 * and twelve requests where every one of them was worth asking about.
 *
 * Nothing waits on any of it: no file, a door that does not parse, a leg the
 * router will not answer — each is the router's own way, exactly as before.
 */
const DOORS = 2;
const DOORS_DEEP = 1;
const DOOR_GAIN = 50;
const DOOR_RATIO = 0.9;

/* What a door is ridden at, in metres a second: fifteen kilometres an hour,
   which is what the router's bike profile makes of a plain street. */
const DOOR_SPEED = 4.2;

/* And what the router makes of a street once its corners are counted,
   twelve: the pace a way's time is turned back into metres at. A whole
   ride has its corners on every way compared, so they are counted here;
   tools/doors.mjs, which measures stretches of two hundred metres, leaves
   them out and counts at DOOR_SPEED — A CORNER IS NOT A DOOR there. */
const PACE = 3.3;
const reach = (way) => Math.max(way.meters, way.seconds * PACE);

/* Two ways within this many metres of each other in length are taken for
   one line. */
const SAME_WAY = 25;

/* Nearer than this to a door's end, the way starts or stops at the door and
   there is no leg to ask the router for. */
const AT_DOOR = 15;

const metres = (a, b) => km({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] }) * 1000;

/* The doors as { meters, around, brouter, line }, each both ways round, or
   none: how long the door is, and how far the router and BRouter go
   instead. */
async function doors(context) {
  let file;
  try { file = await dataFile(context, '/data/doors.json'); } catch (e) { return []; }
  const both = [];
  for (const door of Array.isArray(file) ? file : []) {
    const line = door && Array.isArray(door.line) ? door.line : [];
    if (line.length < 2 || !Number.isFinite(door.meters)) continue;
    const round = { meters: door.meters, around: Number(door.around) || 0, brouter: Number(door.brouter) || 0 };
    both.push(Object.assign({ line: line }, round), Object.assign({ line: line.slice().reverse() }, round));
  }
  return both;
}

/* How a way to a door is asked for and what it is counted as: the router's
   one way and its reach. NICE WAYS has BRouter's, counted by its metres. */
const BY_ROUTER = { leg: leg, cost: reach };

/* The way from one [lat, lng] to another through a door, where that
   reaches less than `best` — the least reach of the ways the router has
   between them — by enough, or null. `deep` is how many more times its
   two legs may be put through a door of their own, and `by` which router
   the legs are asked of. */
async function viaDoor(all, start, end, best, deep, by = BY_ROUTER) {
  const worth = (meters) => best - meters >= DOOR_GAIN && meters <= best * DOOR_RATIO;
  const tries = all
    .map((door) => ({ door: door, least: metres(start, door.line[0]) + door.meters + metres(door.line[door.line.length - 1], end) }))
    .filter((t) => worth(t.least))
    .sort((a, b) => a.least - b.least);

  for (const { door } of tries.slice(0, DOORS)) {
    const [head, tail] = await Promise.all([
      by.leg(start, door.line[0]),
      by.leg(door.line[door.line.length - 1], end)
    ]);
    if (!head || !tail || !worth(by.cost(head) + door.meters + by.cost(tail))) continue;
    if (!deep) return stitch(head, door, tail);
    const [in2, on2] = await Promise.all([
      viaDoor(all, start, door.line[0], by.cost(head), deep - 1, by),
      viaDoor(all, door.line[door.line.length - 1], end, by.cost(tail), deep - 1, by)
    ]);
    return stitch(in2 || head, door, on2 || tail);
  }
  return null;
}

/* The router's one way between two points by bike, or a way of no length
   where they are the same place, or null where it has none. */
async function leg(a, b) {
  if (metres(a, b) < AT_DOOR) return { meters: 0, seconds: 0, line: [], steps: [] };
  return oneWay([a, b]);
}

/* The router's one way by bike through [lat, lng] points in order, setting
   off by `heading` where there is one, or null where it has none. The
   points in the middle ride along as `through`, for settle() to ask the
   way again around before it is answered — SETTLING below. A way through
   points of its own that boards a ferry is none: AT SEA below. */
async function oneWay(points, heading = null) {
  try {
    const res = await ask(OSRM.bike + points.map((p) => p[1] + ',' + p[0]).join(';') +
      '?overview=full&geometries=geojson&steps=true&alternatives=false' + bearings(heading, points.length), 'bike');
    if (!res.ok) return null;
    const body = await res.json();
    const route = body && body.code === 'Ok' && Array.isArray(body.routes) ? body.routes[0] : null;
    if (points.length > 2 && afloat(route)) return null;
    const found = way(route);
    if (!found || !Number.isFinite(found.meters) || !Number.isFinite(found.seconds)) return null;
    return points.length > 2 ? Object.assign(found, { through: points.slice(1, -1) }) : found;
  } catch (e) {
    return null;
  }
}

/* The way in, the door and the way on as one way. The turn into the door
   and the turn out of it are steps like any other — the router knows
   neither, and a rider told nothing would ride past — worked out from how
   the line bends there, CORNER metres either side, in the router's own
   words and with no street to name. So are the corners inside it, which a
   door of a few dozen metres seldom has and a longer one does. The leg in
   loses its `arrive`, since it has not. What BRouter's legs have beside
   traffic is added up, for NICE WAYS to order by; a door has none. */
function stitch(head, door, tail) {
  const into = head.meters;
  const out = head.meters + door.meters;
  const steps = head.steps.filter((s) => s.turn !== 'arrive');
  const enter = bend(head.line, door.line);
  if (enter) steps.push({ at: door.line[0], meters: into, turn: enter, name: '' });
  for (const c of corners(door.line)) steps.push({ at: c.at, meters: into + c.meters, turn: c.turn, name: '' });
  const leave = bend(door.line, tail.line);
  if (leave) steps.push({ at: door.line[door.line.length - 1], meters: out, turn: leave, name: '' });
  for (const s of tail.steps) steps.push(Object.assign({}, s, { meters: s.meters + out }));
  if (!tail.steps.length) steps.push({ at: door.line[door.line.length - 1], meters: out, turn: 'arrive', name: '' });
  const line = head.line.concat(door.line, tail.line);
  return {
    meters: out + tail.meters,
    seconds: head.seconds + Math.round(door.meters / DOOR_SPEED) + tail.seconds,
    line: thin(line, MAX_POINTS),
    steps: untie(steps, line),
    loud: (head.loud || 0) + (tail.loud || 0)
  };
}

/* Where a line somebody rode turns a corner, with how far along it each
   corner is. The heading is read CORNER metres either side of a point
   rather than from one step to the next, which a phone's few metres of
   error would make a turn every time; a bend under a left or a right is not
   one, and neither is turning round, which on a ridden line is a phone
   wandering while its rider stood. One corner a CORNER, the sharpest. */
const CORNER = 20;

function corners(line) {
  const along = [0];
  for (let i = 1; i < line.length; i++) along.push(along[i - 1] + metres(line[i - 1], line[i]));
  const out = [];
  let a = 0;
  let b = 0;
  for (let i = 1; i < line.length - 1; i++) {
    while (along[i] - along[a + 1] >= CORNER) a++;
    while (b < line.length - 1 && along[b] - along[i] < CORNER) b++;
    if (along[i] - along[a] < CORNER || along[b] - along[i] < CORNER) continue;
    const turn = bend([line[a], line[i]], [line[i], line[b]]);
    if (turn !== 'left' && turn !== 'right') continue;
    const size = Math.abs(sharpness([line[a], line[i]], [line[i], line[b]]));
    const last = out[out.length - 1];
    if (last && along[i] - last.meters < CORNER) {
      if (size > last.size) Object.assign(last, { at: line[i], meters: Math.round(along[i]), turn: turn, size: size });
    } else {
      out.push({ at: line[i], meters: Math.round(along[i]), turn: turn, size: size });
    }
  }
  return out;
}

/* How far, in degrees either way, one line turns into the next. */
function sharpness(before, after) {
  const heading = (a, b) => Math.atan2(
    (b[1] - a[1]) * Math.cos(a[0] * Math.PI / 180), b[0] - a[0]) * 180 / Math.PI;
  return (heading(after[0], after[1]) -
    heading(before[before.length - 2], before[before.length - 1]) + 540) % 360 - 180;
}

/* The word for how the way bends where one line ends and the next begins,
   or '' where it goes straight on or one of them has no length to bend.

   Read CORNER metres either side of the joint, as corners() reads a ridden
   line, and not from the one step each side. Where a door begins and ends
   that step is a phone's, a dozen metres long, and on a straight path along
   Järvevana tee it swung by a third of a right angle from one point to the
   next — enough to make a keep right a turn right, which is what Rattatee
   said there. */
function bend(before, after) {
  if (before.length < 2 || after.length < 2) return '';
  const joint = before[before.length - 1];
  let back = before.length - 2;
  while (back > 0 && metres(before[back], joint) < CORNER) back--;
  let on = 1;
  while (on < after.length - 1 && metres(after[0], after[on]) < CORNER) on++;
  const turn = sharpness([before[back], joint], [after[0], after[on]]);
  const size = Math.abs(turn);
  if (size < 25) return '';
  if (size > 155) return 'around';
  return (size < 55 ? 'keep-' : '') + (turn < 0 ? 'left' : 'right');
}

/* ----------------------------------------------------------------- ridden
 * The way riders made the most of. Until 2026-11-19 a ridden way was put
 * together from the saved rides themselves, the newest forty lines near the
 * trip joined into a network and the cheapest way across it stitched to
 * the router's. It followed whoever had ridden last, in whichever direction
 * they had — a ride home downhill was offered as the way back up — and it
 * read lines where the city's rides had already been counted.
 *
 * So no way is made here now. The ways are the ones the router and the
 * doors offer and the ways round either side, kept off the streets in
 * KEEP_OFF and with their spurs off like any other, and each is weighed by
 * the squares under it: riddenShare() in ./_sections.js, which says how
 * much of a way people have ridden in the direction it runs, and how much
 * of that they rode at their own pace. The best of them by that score is
 * the ridden way, where at least RIDDEN_MIN metres and RIDDEN_SHARE of it
 * were ridden and it is no more than RIDDEN_LONGER times the shortest. It
 * goes first, the answer says `ridden: true` beside it, and the bar says
 * somebody rode it; the others follow in the order they had.
 *
 * What that gives up is the way no router knows: a ride across a yard is
 * offered only once it is a door. What it costs is a lookup in
 * `ride_sections` by its key for each square under the ways, billed only
 * for the squares somebody rode and SCORE_ROWS rows at the most however
 * many rides there are — WHAT A READ COSTS in ./_sections.js. Nothing waits on
 * it: no database, no table, no square ridden — each is the ways exactly
 * as they were.
 */
const RIDDEN_MIN = 200;
const RIDDEN_SHARE = 0.5;
const RIDDEN_LONGER = 1.4;

/* Which of the ways is the ridden one, or -1 where none is. */
async function riddenBest(context, ways, shortest) {
  const env = context.env || {};
  if (!env.DB) return -1;
  let weighed;
  try {
    if (await wrongDatabase(env)) return -1;
    weighed = await riddenShare(env, ways.map((way) => way.line));
  } catch (e) {
    return -1;
  }
  let best = -1;
  ways.forEach((way, i) => {
    const { share, score } = weighed[i];
    if (share < RIDDEN_SHARE || share * way.meters < RIDDEN_MIN || way.meters > shortest * RIDDEN_LONGER) return;
    if (best < 0 || score > weighed[best].score) best = i;
  });
  return best;
}

/* A way with this share of its points within ALIKE_NEAR metres of another
   is that way: two ways that were one once their spurs came off, or a
   way round that turned out to be a way already offered. */
const ALIKE_NEAR = 25;
const ALIKE_SHARE = 0.8;

function alike(a, b) {
  return a.line.filter((p) => apart(p, b.line) <= ALIKE_NEAR).length >= a.line.length * ALIKE_SHARE;
}

/* ------------------------------------------------------------------ spurs
 * Nobody rides up a street and straight back down it to go on, and the
 * router's answers sometimes do. Asked through a point — KEEPING OFF — it
 * reaches the point wherever that snapped, up a side street or into a
 * square, and comes out the way it went in: on 2026-11-19 a way from the
 * south to Toompea rode 90 m up into Vabaduse väljak and back, a stub on
 * the line with a turn round said at its tip, and another from the same
 * start a stub at Vana-Lõuna. A start on the wrong side of a one-way street
 * does the same at the first metres. So by bike and on foot a way loses
 * every stretch where it goes out and comes back over its own line: from a
 * point to where the line returns within SPUR_NEAR of it, SPUR_MIN or more
 * further along, where every point going out is within SPUR_WIDE of the
 * way back and every point coming back is within it of the way out — so a
 * loop round a block, which comes back by other streets, is not one. The
 * turns inside it go, one is said where it was cut if the way bends there,
 * and its metres come off the way's, and its seconds by the same share.
 * Two ways that differed only by a spur are then one, and the second goes.
 * A drive keeps its turns round, which a one-way street can make real.
 */
const SPUR_NEAR = 12;
const SPUR_MIN = 30;
const SPUR_WIDE = 20;

function unspur(found) {
  let way = found;
  for (let cut = spur(way.line); cut; cut = spur(way.line)) {
    way = shorten(way, cut.i, cut.j + 1, cut.at, cut.gone);
  }
  return way;
}

/* A way with the stretch after point `i` and before point `j` taken out,
   `at` metres along and `gone` long. */
function shorten(way, i, j, at, gone) {
  const line = way.line.slice(0, i + 1).concat(way.line.slice(j));
  const steps = way.steps.filter((s) => s.turn === 'arrive' || s.meters < at - 1 || s.meters > at + gone + 1)
    .map((s) => (s.meters > at ? Object.assign({}, s, { meters: Math.max(0, Math.round(s.meters - gone)) }) : s));
  const turn = bend(line.slice(0, i + 1), line.slice(i));
  if (turn) {
    const after = steps.findIndex((s) => s.meters > at);
    steps.splice(after < 0 ? steps.length : after, 0, { at: line[i], meters: Math.round(at), turn: turn, name: '' });
  }
  return Object.assign({}, way, {
    meters: Math.max(0, Math.round(way.meters - gone)),
    seconds: Math.round(way.seconds * Math.max(0, 1 - gone / (way.meters || 1))),
    line: line,
    steps: untie(steps, line)
  });
}

/* The first spur on a line, from its root at `i` to its return at `j`, `at`
   metres along and `gone` long, or null. Measured flat, and each point is
   held only against the points in the squares SPUR_NEAR a side around it:
   every pair of a line of MAX_POINTS by metres() was seven milliseconds of
   a Function's ten. */
function spur(line) {
  const xy = line.map(flat);
  const gap = (a, b) => Math.hypot(xy[a][0] - xy[b][0], xy[a][1] - xy[b][1]);
  const along = [0];
  for (let k = 1; k < line.length; k++) along.push(along[k - 1] + gap(k - 1, k));
  const square = (k) => [Math.floor(xy[k][0] / SPUR_NEAR), Math.floor(xy[k][1] / SPUR_NEAR)];
  const cells = new Map();
  xy.forEach((p, k) => {
    const key = square(k).join(':');
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(k);
  });
  for (let i = 0; i < line.length - 2; i++) {
    const [cx, cy] = square(i);
    const back = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of cells.get((cx + dx) + ':' + (cy + dy)) || []) {
          if (along[j] - along[i] >= SPUR_MIN && gap(i, j) <= SPUR_NEAR) back.push(j);
        }
      }
    }
    /* The furthest return first, so a spur is cut from its root. */
    for (const j of back.sort((x, y) => y - x)) {
      let tip = i;
      for (let k = i + 1; k < j; k++) if (gap(i, k) > gap(i, tip)) tip = k;
      if (tip === i) continue;
      const out = line.slice(i, tip + 1);
      const home = line.slice(tip, j + 1);
      if (out.every((p) => apart(p, home) <= SPUR_WIDE) && home.every((p) => apart(p, out) <= SPUR_WIDE)) {
        return { i: i, j: j, at: along[i], gone: along[j] - along[i] };
      }
    }
  }
  return null;
}

/* --------------------------------------------------------------- settling
 * A point the router is asked through — KEEPING OFF and EITHER SIDE — is
 * made up: square to a street or to the straight line, so far out. It says
 * which side a way goes round and nothing about which street, and the
 * router has to touch it wherever it snapped — a dead end, a car park, a
 * path across a park — and bends the way to get there. Each bend came back
 * as a shape of its own and was given a rule of its own: a stub up into
 * Vabaduse väljak and back, which SPURS cut; on 2026-11-19 a loop down one
 * lane of the car park by the athletics hall and up another, which was cut
 * as a pocket; and on 2026-11-21, in a picture from Rattatee, a way from
 * Herne to Vana Villem that turned off Võistluse down a path to a dead end
 * in the sports grounds the point had snapped beside. Its stub came off as
 * a spur, and the path down to it and the turn back onto Toonela tee were
 * left — a hook neither rule knew — and it said 18 minutes for a way that
 * is 12, since the forty metres of dead end the router had priced at two
 * and a half minutes came off by their share of the metres.
 *
 * So no way is answered with the line it was asked for through a made-up
 * point, whatever shape the bend took. Once it is found it is asked for
 * again through two points of its own line, SETTLE before and SETTLE after
 * where it came nearest the made-up point, or its ends where those are
 * nearer. They are on streets the way really rides, so the way in and the
 * way on are the ones it had and the side it went round is the side it goes
 * round; between them the router rides what it likes best, which is at
 * least as good by its own measure as what the line did to touch the point;
 * and the metres, seconds and turns are all the router's. A way asked
 * through two made-up points, as one kept off a street on its side is,
 * settles round each, and round both at once where the stretches meet.
 *
 * A way that settles onto a street in KEEP_OFF for further than it rode one
 * keeps the line it had, and one that settles into a way already offered is
 * offered once. It is done last, to the ways that are answered and not to
 * every way tried: one router request for each answered way that was asked
 * through a point, three at the most, and no row. Nothing waits on it: a way
 * the router will not answer again is the way as it was.
 */
const SETTLE = 300;

async function settle(found, heading = null) {
  const { through = [], ...way } = found;
  if (!through.length) return way;
  const xy = way.line.map(flat);
  const along = [0];
  for (let k = 1; k < xy.length; k++) along.push(along[k - 1] + Math.hypot(xy[k][0] - xy[k - 1][0], xy[k][1] - xy[k - 1][1]));
  const last = xy.length - 1;
  const stretches = [];
  for (const [vx, vy] of through.map(flat)) {
    const off = (k) => Math.hypot(xy[k][0] - vx, xy[k][1] - vy);
    let tip = 0;
    for (let k = 1; k <= last; k++) if (off(k) < off(tip)) tip = k;
    let a = tip;
    while (a > 0 && along[tip] - along[a] < SETTLE) a--;
    let b = tip;
    while (b < last && along[b] - along[tip] < SETTLE) b++;
    stretches.push([a, b]);
  }
  const joined = [];
  for (const [a, b] of stretches.sort((x, y) => x[0] - y[0])) {
    const before = joined[joined.length - 1];
    if (before && a <= before[1]) before[1] = Math.max(before[1], b);
    else joined.push([a, b]);
  }
  const points = [0].concat(...joined, last).filter((k, i, all) => k !== all[i - 1]);
  const again = await oneWay(points.map((k) => way.line[k]), heading);
  if (!again) return way;
  const settled = unspur(again);
  if (ridden(settled).meters > Math.max(KEEP_OFF_MIN, ridden(way).meters)) return way;
  return Object.assign(way, { meters: settled.meters, seconds: settled.seconds, line: settled.line, steps: settled.steps });
}

/* ------------------------------------------------------------ keeping off
 * Some streets the router likes and a rider does not. Tartu maantee is the
 * first: a cycleway beside six lanes of traffic, from Viru väljak to the
 * Ülemiste junction, which the router's bike profile reads as the best way
 * into the centre from the south-east. The owner asked for it not to be
 * offered. Liivalaia, and Pärnu maantee from the lights at Vabaduse väljak
 * down to the Liivalaia crossing, followed on 2026-11-18: the same six
 * lanes and buses, and the owner rides neither. Laagna tee followed on
 * 2026-11-22, and it is worse than any of them: the router put a ride from
 * Herne to Tondiraba on the carriageway itself, four kilometres of dual
 * carriageway, as the quickest way. OSRM's public server cannot
 * be told to avoid a street, so where a way rides one the router is asked
 * again, through a point either side of the stretch ridden, KEEP_OFF_AWAY
 * metres out and square to it, which it snaps to the nearest street it can
 * ride — a parallel one. A way down Pärnu maantee and on along Liivalaia
 * rides two, and the stretch the points are set beside is the street it
 * rides most: a stretch from the first street's start to the second's end
 * is a diagonal through neither, and the points either side of it land on
 * the streets themselves.
 *
 * One point beside the middle of a long stretch can leave both its ends
 * ridden: from Lasnamäe to Vabaduse väljak the router rode five kilometres
 * of Laagna tee, and every way round its middle came back to the street for
 * its last kilometre and a half. So where no way keeps off and the one
 * riding least is a way round, it is asked about once more, through its own
 * point and a point either side of what it still rides, and where that
 * rides less, those ways are the ones offered.
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
 * least of it are, and a way down its whole length beside them is not;
 * and a way round either side that does keep off goes before them —
 * EITHER SIDE below.
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
  },
  {
    /* Its whole length, from the Pärnu maantee crossing to Juhkentali; the
       line is the router's own, read off its car profile on 2026-11-18.
       Forty metres rather than sixty, since Kaupmehe and Tatari run close
       beside it and riding those is the point. */
    name: 'Liivalaia',
    width: 40,
    line: [[59.42719, 24.74268], [59.42719, 24.74318], [59.42726, 24.74376], [59.4274, 24.74466],
      [59.42762, 24.74605], [59.42791, 24.74777], [59.42813, 24.7492], [59.42833, 24.75051],
      [59.42841, 24.75103], [59.42889, 24.75404], [59.42911, 24.75536], [59.42925, 24.75611]]
  },
  {
    /* From the lights at Vabaduse väljak down to the Liivalaia crossing,
       and no further: the owner's stretch, the router's line. */
    name: 'Pärnu maantee',
    width: 40,
    line: [[59.43248, 24.74567], [59.43194, 24.74558], [59.43159, 24.74548], [59.43098, 24.74528],
      [59.4305, 24.74508], [59.43009, 24.74443], [59.42969, 24.7438], [59.4293, 24.74337],
      [59.42877, 24.74281], [59.42837, 24.74247], [59.42729, 24.74254]]
  },
  {
    /* The carriageway itself, not a path beside it: the router's bike line
       lay on its car line to the metre for four kilometres on 2026-11-22,
       from Herne to Tondiraba. From the Konstantin Türnpu end to where it
       comes out at the Väo junction; the line is the middle of the router's
       two carriageways, each at most 21 m from it, so forty metres takes
       both. */
    name: 'Laagna tee',
    width: 40,
    line: [[59.43025, 24.77945], [59.43055, 24.78095], [59.43074, 24.78156], [59.43175, 24.78434],
      [59.43214, 24.78576], [59.43254, 24.7869], [59.43437, 24.79196], [59.43477, 24.79344],
      [59.43496, 24.79468], [59.43509, 24.79627], [59.43508, 24.79742], [59.43485, 24.80212],
      [59.4349, 24.80341], [59.43508, 24.8049], [59.43537, 24.80615], [59.43868, 24.8181],
      [59.43911, 24.81996], [59.43929, 24.822], [59.44032, 24.84649], [59.44041, 24.849],
      [59.44042, 24.8528], [59.44056, 24.85501], [59.44282, 24.87082], [59.44296, 24.87277],
      [59.44313, 24.879], [59.44343, 24.88169], [59.44693, 24.89943]]
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

/* How far a way rides the streets to keep off, all of them together, and
   from where to where on the one it rides most. */
function ridden(way) {
  const on = KEEP_OFF.map(() => ({ meters: 0, start: null, end: null }));
  let gone = 0;
  for (let i = 1; i < way.line.length; i++) {
    const a = way.line[i - 1];
    const b = way.line[i];
    const step = metres(a, b);
    if (gone >= KEEP_OFF_ENDS && gone + step <= way.meters - KEEP_OFF_ENDS) {
      const k = KEEP_OFF.findIndex((street) => apart(a, street.line) < street.width && apart(b, street.line) < street.width);
      if (k >= 0) {
        on[k].meters += step;
        on[k].start = on[k].start || a;
        on[k].end = b;
      }
    }
    gone += step;
  }
  const most = on.reduce((x, y) => (y.meters > x.meters ? y : x));
  return { meters: on.reduce((sum, street) => sum + street.meters, 0), start: most.start, end: most.end };
}

/* `past` is a point the ways were asked through already — EITHER SIDE — and
   the ways round are asked through it too, in the order the two points come
   between the ends. */
async function keepOff(ways, from, to, shortest, heading = null, past = null) {
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
  const [fx, fy] = flat([from.lat, from.lng]);
  const [tx, ty] = flat([to.lat, to.lng]);
  const along = (p) => (flat(p)[0] - fx) * (tx - fx) + (flat(p)[1] - fy) * (ty - fy);
  const through = (via) => (past ? [past, via].sort((a, b) => along(a) - along(b)) : [via]);
  const round = (await Promise.all(vias.map((via) =>
    oneWay([[from.lat, from.lng]].concat(through(via), [[to.lat, to.lng]]), heading))))
    .filter((way) => way && way.meters <= shortest * KEEP_OFF_LONGER)
    .sort((a, b) => a.seconds - b.seconds);

  const all = ways.concat(round);
  const on = rides.concat(round.map(ridden)).map((r) => r.meters);
  const least = Math.min(...on);

  /* Nothing kept off: the way round riding least goes round what it still
     rides, once — the points either side of a long stretch above. */
  const nearest = all[on.indexOf(least)];
  if (least > KEEP_OFF_MIN && !past && nearest.through) {
    const again = await keepOff([nearest], from, to, shortest, heading, nearest.through[0]);
    if (Math.min(...again.map((way) => ridden(way).meters)) < least) return again;
  }

  const room = least <= KEEP_OFF_MIN ? KEEP_OFF_MIN : least + KEEP_OFF_MIN;

  /* Two points either side can snap to one street: one button each. */
  const kept = [];
  all.forEach((way, i) => {
    if (on[i] <= room && !kept.some((k) => Math.abs(k.meters - way.meters) < 20 && Math.abs(k.seconds - way.seconds) < 20)) kept.push(way);
  });
  return kept;
}

/* ------------------------------------------------------------ either side
 * The router offers other ways only where it finds some it thinks worth a
 * look, and those are streets beside its first; and a way that rides a
 * street in KEEP_OFF is taken out. So a ride can come back with one way
 * where a rider knows three: from Juhkentali to Kalamaja on 2026-11-19 the
 * one offered ran through the Old Town, the router's way west of Toompea
 * rode Liivalaia and Pärnu maantee and was dropped, and nothing went round
 * to the east. The owner asked for a way on the other side.
 *
 * So where a bike ride has fewer ways than it has buttons for, the router
 * is asked twice more, through a point either side of the straight line
 * between the two ends: square to its middle, SIDE_SHARE of its length
 * out, no nearer than SIDE_LEAST and no further than SIDE_MOST. Each is a
 * way that goes round on that side, where there is a street to — a point
 * out in the bay is none, AT SEA below. One is
 * offered where it is no more than SIDE_LONGER times the shortest way
 * offered, keeps off the streets every way keeps off, and is not a way
 * already there — in either direction, since a way round that only leaves
 * the first for a block is that way. The quicker first, after the ways
 * that were there — and before them where they ride a street to keep off,
 * which street() sees to. A trip under SIDE_FROM has no sides to speak of.
 *
 * SIDE_LONGER is as much as it is because the shortest way was then often
 * one put together from a ride straight through the Old Town — RIDDEN
 * above says what became of those — and a way round it, before its spurs
 * come off, is over half as far again: held to half, which a way round a
 * street to keep off is, that ride was offered no way west on the day this
 * shipped. The router's own way through is as short, so it stays.
 *
 * It costs two router requests for every bike ride SIDE_FROM or longer
 * that nobody asked for between those two points that day — asked beside
 * the router's own, by sideWays(), and used only where the ride has fewer
 * than three ways — and up to eight more a side where that side has to be
 * taken off a street SIDE_TURNS times; and no row. Nothing waits on it: a
 * side the router will not answer is one way fewer, as it was. Not with a
 * heading, where a way round is a way back.
 */
const SIDE_FROM = 1000;
const SIDE_SHARE = 0.3;
const SIDE_LEAST = 300;
const SIDE_MOST = 1200;
const SIDE_LONGER = 1.75;
const SIDE_TURNS = 2;

/* The point either side and the router's way through it, asked before
   anything needs them — ONE ROUND AT A TIME in the header — or null for a
   ride with no sides. */
function sideWays(from, to) {
  const ends = [[from.lat, from.lng], [to.lat, to.lng]];
  const [sx, sy] = flat(ends[0]);
  const [ex, ey] = flat(ends[1]);
  const length = Math.hypot(ex - sx, ey - sy);
  if (length < SIDE_FROM) return null;
  const away = Math.min(SIDE_MOST, Math.max(SIDE_LEAST, length * SIDE_SHARE));
  return [1, -1].map((side) => {
    const via = [
      Number(((from.lat + to.lat) / 2 + (ex - sx) / length * away * side / NORTH).toFixed(5)),
      Number(((from.lng + to.lng) / 2 - (ey - sy) / length * away * side / EAST).toFixed(5))
    ];
    return { via: via, asked: oneWay([ends[0], via, ends[1]]) };
  });
}

async function eitherSide(ways, from, to, sides) {
  const shortest = Math.min(...ways.map((way) => way.meters));
  /* A way round that rides a street to keep off is asked for again round
     that, still through its side's point, SIDE_TURNS times at the most:
     west of Toompea the router's way is Liivalaia and Pärnu maantee, the
     first turn leaves a block of Liivalaia in it, and the second is
     Kentmanni and Tatari. Four router requests a turn. keepOff() holds
     its ways round to KEEP_OFF_LONGER times the length it is given, so it
     is given one that makes that SIDE_LONGER times the shortest. */
  const round = (await Promise.all(sides.map(async ({ via, asked }) => {
    let found = [await asked].filter(Boolean);
    for (let turn = 0; turn < SIDE_TURNS && found.length; turn++) {
      const least = found.reduce((a, b) => (ridden(b).meters < ridden(a).meters ? b : a));
      if (ridden(least).meters <= KEEP_OFF_MIN) break;
      found = await keepOff([least], from, to, shortest * SIDE_LONGER / KEEP_OFF_LONGER, null, via);
    }
    return found;
  })))
    .flat()
    .map(unspur)
    .filter((way) => way.meters <= shortest * SIDE_LONGER && ridden(way).meters <= KEEP_OFF_MIN)
    .sort((a, b) => a.seconds - b.seconds);
  const all = ways.slice();
  for (const way of round) {
    if (!all.some((before) => alike(way, before) || alike(before, way))) all.push(way);
  }
  return all;
}

/* ----------------------------------------------------------------- at sea
 * A point made up beside the straight line can land in the water, and the
 * router snaps it to the nearest thing out there it can travel: a ferry's
 * line. On 2026-11-23, in a picture from the map app, a ride from Tõnismägi
 * to a kebab shop in Viimsi ran beside Tallinna laht, the point on its west
 * side was out in the bay, and the router took it to the Aegna ferry's line
 * forty metres off — a crossing it reports as pushing a bike. The way rode
 * to the pier by Linnahall, out along the ferry and back; SPURS took the
 * ferry off, the hook down to the pier stayed, and since the router's own
 * ways rode a street kept off it went first: 66 minutes and 14.8 km ahead
 * of 54 and 12.5. A way round is a way round on that side where there is a street,
 * and a ferry is not one.
 *
 * So a way asked through points of its own — either side, round a street
 * kept off, and settling — that boards a ferry anywhere is no way, and
 * oneWay() answers none: the router classes every crossing it boards one
 * at, and that is read rather than its mode or its name. A ride that wants
 * a ferry, to Aegna or an island, keeps the router's own ways and is
 * offered no way round them. A side that lands in the bay now costs one
 * router request, where it was up to nine.
 */
function afloat(route) {
  return (route && Array.isArray(route.legs) ? route.legs : []).some((leg) =>
    (Array.isArray(leg.steps) ? leg.steps : []).some((s) =>
      (s && Array.isArray(s.intersections) ? s.intersections : []).some((i) =>
        Array.isArray(i.classes) && i.classes.includes('ferry'))));
}

/* -------------------------------------------------------------- nice ways
 * A bike way is BRouter's, found by the owner's rules in data/bike.brf —
 * ./_brouter.js says why a second router, and what a way of its carries.
 * This is what is made of its ways. Nothing here is asked through a
 * made-up point, so nothing here needs its bend taken out.
 *
 * ASKED FOR at once: the way it likes best and the OTHERS after it, with
 * the streets in KEEP_OFF sent as areas to stay out of. An area is a band
 * along a stretch of the street, AREA_EXTRA metres wider than half the
 * street's `width` either side of its line, and has a weight rather than
 * being closed: riding a street's length is dear and crossing it is not.
 * On 2026-11-23, at AREA_WEIGHT, a ride that took 1.7 km of Tartu maantee
 * took 72 m of it, and crossing Liivalaia in its middle cost what some
 * 250 m of quiet street do. BRouter ignores an area that one end of the
 * way stands in, so a street is cut at its corners into stretches of
 * AREA_PIECE metres or more and a place on Liivalaia puts out only the
 * stretch it is on; and only the stretches within AREA_NEAR of the trip
 * are sent, since the address has to carry them.
 *
 * OFFERED, of what comes back:
 *
 *   Two ways that are one are offered once, and a way more than
 *   NICE_LONGER times the shortest is not offered at all — no big round
 *   trips, in the owner's words. One is one whichever way round it is
 *   measured: a way most of which lies along one before it, and a way one
 *   before it lies along most of, which is that way with a detour in it.
 *   Until 2026-11-24 only the first was looked for, and from Herne to Vana
 *   Villem the second way offered was the first with 150 m more round a
 *   corner of Tiigiveski park: an extra trip, the owner called it.
 *
 *   A way along a stretch riders take goes in where the ride runs along
 *   one — TAKEN below — and is one of the three.
 *
 *   A way through a door — DOORS above — goes in where it is DOOR_GAIN
 *   metres and a tenth shorter than the shortest of them, its two legs
 *   BRouter's and counted by their metres, and the way of BRouter's it
 *   shortens goes out as the same way. The doors left in data/doors.json
 *   are the ones BRouter cannot get through either: tools/doors.mjs holds
 *   each to both routers and writes how far BRouter goes round it, and a
 *   door that could not save a tenth of the trip is not asked about — on
 *   a ride across town, none is. A door that could is a round of requests
 *   more.
 *
 *   Quiet first, always, and beside traffic next: the owner's order, given
 *   on seeing ten trips drawn. The ways are put by how much of each is
 *   beside traffic, to the QUIET_STEP — less than that apart they are as
 *   quiet as each other — and then the shorter first. Three at the most,
 *   and a way through a door is one of the three, and so is a way along
 *   a stretch riders take.
 *
 *   KEEPING OFF's other rule, that where any way keeps off only those are
 *   offered, is the router's and not held here. The areas keep BRouter's
 *   first way off those streets — 94 m at the most on the ten trips — and
 *   a way that rides one is as far beside traffic as a way gets, so it
 *   comes last and is still there to choose: beside traffic next.
 *
 *   The way riders made the most of — RIDDEN above — says `ridden: true`
 *   where it comes in that order and is not moved to the front.
 *
 * NOT ASKED with a heading, nor between cities. BRouter's own heading
 * does nothing on brouter.de, and a closed circle behind the rider turned
 * one start of three round when it was tried; a ride between cities is cut
 * at junctions that are the router's. Both are the router's ways as they
 * were, and so is any ride BRouter has no answer for.
 *
 * It costs three requests to BRouter a ride, two more for each door that
 * could win and one for each ride to or from a station, where the router's
 * refinements took eight to thirty; and the one read of `ride_sections` a
 * bike ride always made.
 */
const NICE_LONGER = 1.25;
const QUIET_STEP = 100;
const AREA_PIECE = 300;
const AREA_EXTRA = 5;
const AREA_WEIGHT = 50;
const AREA_NEAR = 1500;

/* A line as the corners of a band `half` metres either side of it, the way
   BRouter takes a polygon: lon,lat after lon,lat round the outside. */
function band(line, half) {
  const left = [];
  const right = [];
  line.forEach((p, i) => {
    const [ax, ay] = flat(line[Math.max(0, i - 1)]);
    const [bx, by] = flat(line[Math.min(line.length - 1, i + 1)]);
    const length = Math.hypot(bx - ax, by - ay) || 1;
    const east = -(by - ay) / length * half / EAST;
    const north = (bx - ax) / length * half / NORTH;
    left.push([p[1] + east, p[0] + north]);
    right.push([p[1] - east, p[0] - north]);
  });
  return left.concat(right.reverse()).map((q) => q[0].toFixed(5) + ',' + q[1].toFixed(5)).join(',');
}

/* The streets to keep off as the areas BRouter is sent for a trip between
   two [lat, lng] points — ASKED FOR above. The stretches are cut once an
   isolate. */
let stretches = null;

function keptOffAreas(a, b) {
  if (!stretches) {
    stretches = [];
    for (const street of KEEP_OFF) {
      let piece = [street.line[0]];
      let run = 0;
      for (let i = 1; i < street.line.length; i++) {
        piece.push(street.line[i]);
        run += metres(street.line[i - 1], street.line[i]);
        if (run >= AREA_PIECE || i === street.line.length - 1) {
          stretches.push({ line: piece, area: band(piece, street.width / 2 + AREA_EXTRA) + ',' + AREA_WEIGHT });
          piece = [street.line[i]];
          run = 0;
        }
      }
    }
  }
  const [ax, ay] = flat(a);
  const [bx, by] = flat(b);
  const near = (p) => {
    const [x, y] = flat(p);
    return x > Math.min(ax, bx) - AREA_NEAR && x < Math.max(ax, bx) + AREA_NEAR &&
      y > Math.min(ay, by) - AREA_NEAR && y < Math.max(ay, by) + AREA_NEAR;
  };
  return stretches.filter((stretch) => stretch.line.some(near)).map((stretch) => stretch.area).join('|');
}

/* ------------------------------------------------------------------ taken
 * A stretch riders take that the map prices wrong. Every router here rides
 * a map, and the map is wrong in places only a rider knows. On 2026-11-24
 * the owner asked why the way riders take from Herne to Vana Villem —
 * along Herne, on to Võistluse, up Püssirohu — was not offered at all, and
 * said where to look: the rides. `ride_sections` had five rides, at their
 * own pace, on every square of Herne heading east, and that way ridden for
 * 84% of its length against 45% of the way offered first. The map has 318 m
 * of Herne as a one-way street, running west; BRouter charges riding it
 * east at three and a half times a street's price, the router will not
 * ride it at all, and of five sets of rules tried none offered it. Bikes
 * are allowed both ways there, the owner said; it is the only way. Asked
 * for along it, BRouter answers a way as long as the one it likes best and
 * nearly a minute quicker.
 *
 * So such a stretch is kept — data/bike-taken.json, { id, name, said, why,
 * line } each, `line` the stretch as [lat, lng] points in the direction it
 * is ridden — and a ride that runs along one is asked of BRouter along it,
 * and offered that way beside the others. It is kept as far as riders take
 * it, and not only the metres the map has wrong: given Herne alone, BRouter
 * rode it and then turned back into the park, a way that was the first
 * with a corner changed.
 *
 * It is the rides that say a stretch is taken and the owner who says it
 * may be offered. tools/doors.mjs throws a one-way ridden against its
 * arrows out of the doors, since a door nobody approved must not send a
 * stranger into the traffic, and that stays so: a stretch is written here
 * by hand, on the owner's word that a bike may ride it.
 *
 * RUNS ALONG is settled before anything is asked. The start and the end of
 * the ride are each put on the stretch at its nearest point, and what lies
 * between is what the ride would take of it: at least TAKEN_MIN, in the
 * stretch's own direction — the other way is the map's to answer, and for
 * a one-way is the way it already has — and with both its ends within
 * TAKEN_NEAR of a way already found, so a ride across town is not bent to
 * a street somebody rides. Then the way through it, as the crow flies, is
 * to be no more than TAKEN_LONGER times the shortest way found.
 *
 * It is asked through the middle of each street of it the ride takes, a
 * piece of TAKEN_PIECE or more between two corners, and not through the
 * corners themselves: a point on a corner snaps to whichever street is
 * nearest, and from Herne to Vana Villem one did and turned the way round
 * on itself, 1,288 m where the middles give 1,178. And a stretch it then
 * rides out and back on is cut, as the router's are — SPURS below.
 *
 * OFFERED where BRouter's way along it is itself no more than TAKEN_LONGER
 * times the shortest, and is not a way already there. A door wins a tenth
 * shorter; a stretch that is taken is offered up to a tenth longer, being
 * a way of the same length the map made dear. It is one of the three, in
 * the place its quiet and its length give it: taken, not first.
 *
 * It costs one request to BRouter more, for a ride that runs along such a
 * stretch, and no row. Nothing waits on it: no file, a line that will not
 * parse, a stretch BRouter cannot ride — each is the answer without it.
 * Like everything of BRouter's it is not asked with a heading, nor between
 * cities.
 */
const TAKEN_MIN = 100;
const TAKEN_NEAR = 300;
const TAKEN_LONGER = 1.1;
const TAKEN_PIECE = 40;

/* The stretches riders take, as their lines, or none. */
async function taken(context) {
  let file;
  try { file = await dataFile(context, '/data/bike-taken.json'); } catch (e) { return []; }
  return (Array.isArray(file) ? file : [])
    .map((one) => (one && Array.isArray(one.line) ? one.line : []))
    .filter((line) => line.length >= 2 &&
      line.every((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])));
}

/* Where on a line a point is nearest: how far along it, in metres, and
   the point there. */
function onto(line, p) {
  const [x, y] = flat(p);
  let best = { off: Infinity, along: 0, at: line[0] };
  let gone = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = flat(line[i - 1]);
    const [bx, by] = flat(line[i]);
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy);
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (length * length || 1)));
    const off = Math.hypot(x - ax - t * dx, y - ay - t * dy);
    if (off < best.off) {
      best = {
        off: off,
        along: gone + t * length,
        at: [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t]
      };
    }
    gone += length;
  }
  return best;
}

/* BRouter's way from `start` to `end` along a stretch riders take, where
   the ride runs along one, or null — TAKEN above. `ways` are the ways found
   already and `shortest` the metres of the shortest of them. */
async function viaTaken(context, start, end, ways, shortest) {
  const found = (p) => ways.some((way) => apart(p, way.line) <= TAKEN_NEAR);
  let best = null;
  for (const line of await taken(context)) {
    const on = onto(line, start);
    const off = onto(line, end);
    if (off.along - on.along < TAKEN_MIN || !found(on.at) || !found(off.at)) continue;
    const least = metres(start, on.at) + (off.along - on.along) + metres(off.at, end);
    if (least > shortest * TAKEN_LONGER || (best && least >= best.least)) continue;
    /* The middle of each piece the ride takes — TAKEN_PIECE or longer, cut
       to where the ride gets on and off — none of them at either end. */
    const through = [];
    let gone = 0;
    for (let i = 1; i < line.length; i++) {
      const length = metres(line[i - 1], line[i]);
      const a = Math.max(gone, on.along);
      const b = Math.min(gone + length, off.along);
      gone += length;
      if (b - a < TAKEN_PIECE) continue;
      const f = ((a + b) / 2 - (gone - length)) / (length || 1);
      const middle = [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * f, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * f]
        .map((n) => Number(n.toFixed(5)));
      if (metres(middle, start) >= AT_DOOR && metres(middle, end) >= AT_DOOR) through.push(middle);
    }
    if (through.length) best = { through: through, least: least };
  }
  if (!best) return null;
  const answered = await brouterWays(context, [start].concat(best.through, [end]), 1, keptOffAreas(start, end));
  if (!answered || !answered[0]) return null;
  const way = unspur(Object.assign({}, answered[0], { line: thin(answered[0].line, MAX_POINTS), steps: untie(answered[0].steps, answered[0].line) }));
  return way.meters <= shortest * TAKEN_LONGER ? way : null;
}

/* BRouter's one way between two points, as it answers it, or a way of no
   length where they are the same place, or null where it has none. */
async function niceLeg(context, a, b) {
  if (metres(a, b) < AT_DOOR) return { meters: 0, seconds: 0, line: [], steps: [], loud: 0 };
  const found = await brouterWays(context, [a, b], 1, keptOffAreas(a, b));
  return found && found[0] ? found[0] : null;
}

/* The ways by bike from one point to another, quietest first, or null
   where BRouter has none — OFFERED above. */
async function niceWays(context, from, to) {
  const start = [from.lat, from.lng];
  const end = [to.lat, to.lng];
  const found = await brouterWays(context, [start, end], 1 + OTHERS, keptOffAreas(start, end));
  if (!found || !found.length) return null;

  const once = (way, i, all) => !all.slice(0, i).some((before) => alike(way, before) || alike(before, way));
  let ways = found
    .map((way) => Object.assign({}, way, { line: thin(way.line, MAX_POINTS), steps: untie(way.steps, way.line) }))
    .filter(once);
  const shortest = Math.min(...ways.map((way) => way.meters));
  ways = ways.filter((way) => way.meters <= shortest * NICE_LONGER);

  /* Only the doors that could win are asked about: one saves at most what
     BRouter goes round it, `brouter` less `meters`, and has to save a
     tenth of the way. */
  const could = (await doors(context)).filter((door) =>
    door.brouter - door.meters >= Math.max(DOOR_GAIN, shortest * (1 - DOOR_RATIO)));
  const through = await viaDoor(could, start, end, shortest, DOORS_DEEP,
    { leg: (a, b) => niceLeg(context, a, b), cost: (way) => way.meters });
  if (through) ways = [through].concat(ways).filter(once);

  /* And a way along a stretch riders take, where the ride runs along
     one: after the others, so it goes where one of them is that way
     already. */
  const along = await viaTaken(context, start, end, ways, shortest);
  if (along) ways = ways.concat([along]).filter(once);

  ways.sort((a, b) => Math.round(a.loud / QUIET_STEP) - Math.round(b.loud / QUIET_STEP) || a.meters - b.meters);
  const offered = ways.slice(0, 1 + OTHERS);
  /* A way through a door and a way along a stretch riders take are each
     one of the three, whatever their quiet: the last place that is not the
     other's. */
  for (const way of [through, along]) {
    if (!way || !ways.includes(way) || offered.includes(way)) continue;
    offered[offered[OTHERS] === through ? OTHERS - 1 : OTHERS] = way;
  }

  const best = await riddenBest(context, offered, Math.min(...offered.map((way) => way.meters)));
  if (best >= 0) offered[best] = Object.assign({}, offered[best], { ridden: true });
  return offered;
}

/* ------------------------------------------------------------- long rides
 * A bike way from one city to another is a short ride, a long road and a
 * short ride, and everything above — the doors, the streets kept off, the
 * ways round either side, the settling — was written for the short ones.
 * Each asks the router for the whole way again: on 2026-11-22 a way from
 * Tallinn to Tartu, 192 km, was 23 router requests and about five
 * megabytes, nearly all of it the same road re-asked to keep a few
 * kilometres of it off Tartu maantee, and the next rider from another
 * street paid all of it again. The owner asked for the refinements to be
 * done on the ends alone and for the long middle to be kept.
 *
 * So between the cities in CITIES (./_lib.js) a way is cut in three where
 * it crosses their boxes: the start to the EXIT, the first of the router's
 * junctions outside the start's city; the exit to the ENTRY, the last
 * junction before the end's city; and the entry to the end. A junction is
 * one of the router's manoeuvres, a node of the map, so everybody who
 * leaves by the same road leaves by the same junction and the middle
 * between two junctions is the same road whoever rides it. The ends are
 * refined as a ride in the city is — a door, the streets kept off, the
 * bend settled — and the three joined, the turn at each junction read off
 * how the line bends there, since a rider can come to one from any side.
 * A long ride is offered no ways round either side, which beside a hundred
 * kilometres of line are nothing, and is not weighed by the rides, which
 * are counted in the cities.
 *
 * THE MIDDLES ARE KEPT
 *
 * Each middle is a row of `route_middles` (db/schema.sql), at most MIDDLES
 * for a pair of cities. A ride between two cities reads them, one statement
 * on the key's front, and where there are some it does not ask the long way
 * at all: it asks the router from the start to each middle's exit and from
 * its entry to the end — the way on from the entry setting off the way the
 * middle arrives, so it does not turn back on itself — refines those,
 * joins them, and offers the quickest first and the rest as `others`.
 * Middles that share an exit share its ride.
 *
 * It asks the long way where the pair has no middle yet; for one ride in
 * LEARN_ONE_IN when it has, at random, so a new road or a better exit from
 * another part of town is found; and for the first ride after any of the
 * pair's middles is MIDDLE_AGE old. Asked so, it asks for the steps and
 * not the whole line beside them, which is the same line twice. The ways
 * it answers are cut, their middles written with the time, and the pair
 * held to MIDDLES: those just answered first, then the rest newest first,
 * and a middle no long ask has answered with for MIDDLE_AGE goes. The ways
 * it answered are the answer, their ends refined.
 *
 * Between a city and somewhere that is not one — Tallinn and Haapsalu —
 * the long way is asked every time, there being no second junction to keep
 * a middle between, and only the city's end is refined. A ride between two
 * places in no city, or between two points nearer than LONG_FROM, is a ride
 * as above. So is one with a heading: Rattatee asking mid-ride wants the
 * way it is going on, which a kept middle may not be.
 *
 * WHAT IT COSTS
 *
 * With middles kept: one read of MIDDLES rows at the most, and for each
 * exit and each entry the router asked once for a few kilometres, and
 * again round a street kept off where the ride rides one. Learning: the
 * long ask, a write of MIDDLES rows at the most and the deletes beside
 * them, for the first ride of a pair and one in LEARN_ONE_IN after. Nothing
 * waits on the table: without it, or without a database, every long ride
 * asks the long way and refines its ends, which is still most of the
 * saving; and anything that cannot be put together is the ride as above.
 */
const LONG_FROM = 20000;
const MIDDLES = 3;
const LEARN_ONE_IN = 20;
const MIDDLE_AGE = 30 * 24 * 3600 * 1000;

const junctionKey = (p) => p[0].toFixed(6) + ',' + p[1].toFixed(6);
const middleKey = (m) => junctionKey(m.exit) + '>' + junctionKey(m.entry);

/* The ways of a long ride, best first, or null where it is not one or
   could not be put together. */
async function longRide(context, from, to) {
  const a = cityOf(from.lat, from.lng);
  const b = cityOf(to.lat, to.lng);
  if ((!a && !b) || (a && b && a.id === b.id)) return null;
  const start = [from.lat, from.lng];
  const end = [to.lat, to.lng];
  if (metres(start, end) < LONG_FROM) return null;

  const env = context.env || {};
  const now = Date.now();
  const known = a && b ? await knownMiddles(env, a.id, b.id) : [];
  const learn = !known.length || Math.random() * LEARN_ONE_IN < 1 || known.some((m) => now - m.askedAt > MIDDLE_AGE);

  let pieces;
  if (learn) {
    pieces = (await longWays(start, end)).map((route) => cutWay(route, a, b)).filter(Boolean)
      .filter((p, i, all) => !a || !b || all.findIndex((q) => middleKey(q.middle) === middleKey(p.middle)) === i);
    if (!pieces.length) return null;
    if (a && b) await keepMiddles(env, a.id, b.id, pieces.map((p) => p.middle), known, now);
  } else {
    pieces = known.map((middle) => ({ head: null, middle: middle, tail: null }));
  }

  const heads = new Map();
  const tails = new Map();
  const once = (all, key, make) => {
    if (!all.has(key)) all.set(key, make());
    return all.get(key);
  };
  const ways = (await Promise.all(pieces.map(async (p) => {
    const [head, tail] = await Promise.all([
      a ? once(heads, junctionKey(p.middle.exit), () => refineEnd(context, p.head, start, p.middle.exit)) : null,
      b ? once(tails, junctionKey(p.middle.entry), () => refineEnd(context, p.tail, p.middle.entry, end, arriving(p.middle.line))) : null
    ]);
    if ((a && !head) || (b && !tail)) return null;
    return joinLong([head, p.middle, tail]);
  }))).filter(Boolean).sort((x, y) => x.seconds - y.seconds);
  return ways.length ? ways.slice(0, 1 + OTHERS) : null;
}

/* The router's ways from one end to the other, up to 1 + OTHERS of them,
   with their steps and no line besides — each step carries its own piece
   of it. None where it will not answer. */
async function longWays(start, end) {
  const url = OSRM.bike + start[1] + ',' + start[0] + ';' + end[1] + ',' + end[0] +
    '?overview=false&geometries=geojson&steps=true&alternatives=';
  for (const tail of [OTHERS, 'false']) {
    try {
      const res = await ask(url + tail, 'bike');
      if (res.status === 429) return [];
      if (!res.ok) continue;
      const body = await res.json();
      return body && body.code === 'Ok' && Array.isArray(body.routes) ? body.routes.slice(0, 1 + OTHERS) : [];
    } catch (e) {
      return [];
    }
  }
  return [];
}

/* One of the router's long ways cut where it leaves `a`'s box and where it
   enters `b`'s, either of which may be null for an end in no city:
   { head, middle, tail }, the middle carrying its `exit` and `entry` as
   [lat, lng], or null where the way has no junction to cut at. */
function cutWay(route, a, b) {
  const legs = route && Array.isArray(route.legs) ? route.legs : [];
  const steps = legs.length === 1 && Array.isArray(legs[0].steps) ? legs[0].steps : [];
  const last = steps.length - 1;
  if (last < 2) return null;
  const at = (s) => {
    const p = s && s.maneuver && Array.isArray(s.maneuver.location) ? s.maneuver.location.map(Number) : [];
    return p.length === 2 && p.every(Number.isFinite) ? [p[1], p[0]] : null;
  };
  const outside = (city, s) => {
    const p = at(s);
    return !!p && !(p[0] >= city.south && p[0] <= city.north && p[1] >= city.west && p[1] <= city.east);
  };
  let i = 0;
  if (a) {
    i = steps.findIndex((s, k) => k > 0 && k < last && outside(a, s));
    if (i < 0) return null;
  }
  let j = last + 1;
  if (b) {
    j = -1;
    for (let k = last - 1; k > i; k--) {
      if (outside(b, steps[k])) { j = k; break; }
    }
    if (j < 0) return null;
  }
  const middle = piece(steps.slice(i, j));
  const head = a ? piece(steps.slice(0, i)) : null;
  const tail = b ? piece(steps.slice(j)) : null;
  if (!middle || (a && !head) || (b && !tail)) return null;
  middle.exit = a ? at(steps[i]) : null;
  middle.entry = b ? at(steps[j]) : null;
  return { head: head, middle: middle, tail: tail };
}

/* A run of the router's steps as a way of its own, with `name` the street
   its first step is on — the one a rider turns onto where it is joined. */
function piece(steps) {
  const coords = [];
  for (const s of steps) {
    for (const c of s && s.geometry && Array.isArray(s.geometry.coordinates) ? s.geometry.coordinates : []) {
      const before = coords[coords.length - 1];
      if (!before || before[0] !== c[0] || before[1] !== c[1]) coords.push(c);
    }
  }
  const found = way({
    distance: steps.reduce((n, s) => n + (Number(s && s.distance) || 0), 0),
    duration: steps.reduce((n, s) => n + (Number(s && s.duration) || 0), 0),
    geometry: { coordinates: coords },
    legs: [{ steps: steps }]
  });
  return found && Object.assign(found, { name: steps[0] && typeof steps[0].name === 'string' ? steps[0].name : '' });
}

/* An end of a long ride, refined as a ride in the city is: `given`, the
   router's own piece of the long way, or the router asked for it — setting
   off by `heading` where there is one, and without it where the router has
   no street running that way. Null where it has no way at all.

   The doors are asked about only where one could win. A door saves at most
   what the router's way round it is longer than it — `around` less
   `meters`, 691 m for the best of them on 2026-11-22 — and wins only where
   it saves a tenth of the way, DOOR_RATIO; an end from the middle of
   Tallinn out to its box is twenty-odd kilometres, which no door can be a
   tenth of, and asking cost four router requests an end for nothing. */
async function refineEnd(context, given, start, end, heading = null) {
  const found = given || (heading !== null && await oneWay([start, end], heading)) || await oneWay([start, end]);
  if (!found) return null;
  let ways = [found];
  const all = await doors(context);
  const most = Math.max(0, ...all.map((door) => door.around - door.meters));
  const through = reach(found) * (1 - DOOR_RATIO) <= most
    ? await viaDoor(all, start, end, reach(found), DOORS_DEEP)
    : null;
  if (through) {
    ways = [through].concat(ways.filter((other) =>
      Math.abs(other.meters - through.meters) > SAME_WAY || other.seconds < through.seconds));
  }
  ways = (await keepOff(ways, { lat: start[0], lng: start[1] }, { lat: end[0], lng: end[1] }, found.meters)).map(unspur);
  return settle(ways[0]);
}

/* The way a line is going at its end, in whole degrees from north, rounded
   the way a heading is — SETTING OFF THE WAY THEY ARE GOING. */
function arriving(line) {
  const b = line[line.length - 1];
  let k = line.length - 2;
  while (k > 0 && metres(line[k], b) < CORNER) k--;
  const a = line[k];
  if (!a || metres(a, b) < 1) return null;
  const degrees = Math.atan2((b[1] - a[1]) * Math.cos(a[0] * Math.PI / 180), b[0] - a[0]) * 180 / Math.PI;
  return (Math.round(degrees / HEADING_STEP) * HEADING_STEP % 360 + 360) % 360;
}

/* The pieces of a long ride as one way. Each piece's own turns go in after
   the metres before it; the turn where two meet is read off how the line
   bends there, under the street the second piece starts on, and the turn
   the router said there for whichever way it came from goes. */
function joinLong(parts) {
  const all = parts.filter(Boolean);
  let line = [];
  let meters = 0;
  let seconds = 0;
  const steps = [];
  all.forEach((p, n) => {
    if (n) {
      const turn = bend(line, p.line);
      if (turn) steps.push({ at: p.line[0], meters: Math.round(meters), turn: turn, name: p.name || '' });
    }
    for (const s of p.steps) {
      if ((n && s.meters === 0) || (s.turn === 'arrive' && n < all.length - 1)) continue;
      steps.push(Object.assign({}, s, { meters: s.meters + Math.round(meters) }));
    }
    line = line.concat(p.line);
    meters += p.meters;
    seconds += p.seconds;
  });
  return { meters: Math.round(meters), seconds: Math.round(seconds), line: thin(line, MAX_POINTS), steps: untie(steps, line) };
}

/* The middles kept from city `a` to city `b`, or none — no database, no
   table, a row that will not read. MIDDLES rows at the most, on the key's
   front: (from_city, to_city). */
async function knownMiddles(env, a, b) {
  if (!env.DB) return [];
  try {
    if (await wrongDatabase(env)) return [];
    const { results } = await env.DB
      .prepare('SELECT exit, entry, meters, seconds, line, steps, name, asked_at FROM route_middles ' +
        'WHERE from_city = ? AND to_city = ? LIMIT ?')
      .bind(a, b, MIDDLES)
      .all();
    return (results || []).map(middleOf).filter(Boolean);
  } catch (e) {
    return [];
  }
}

function middleOf(row) {
  try {
    const exit = String(row.exit).split(',').map(Number);
    const entry = String(row.entry).split(',').map(Number);
    const line = JSON.parse(row.line);
    const steps = JSON.parse(row.steps);
    if (exit.length !== 2 || entry.length !== 2 || !exit.concat(entry).every(Number.isFinite)) return null;
    if (!Array.isArray(line) || line.length < 2 || !Array.isArray(steps)) return null;
    return {
      exit: exit, entry: entry, line: line, steps: steps,
      meters: Number(row.meters) || 0, seconds: Number(row.seconds) || 0,
      name: typeof row.name === 'string' ? row.name : '', askedAt: Number(row.asked_at) || 0
    };
  } catch (e) {
    return null;
  }
}

/* The middles a long ask answered with, written with the time, and the
   pair held to MIDDLES — THE MIDDLES ARE KEPT. Each row by its whole key,
   and never throws: a middle that could not be kept is asked for again. */
async function keepMiddles(env, a, b, found, known, now) {
  if (!env.DB) return;
  const fresh = found.filter((m, i) => found.findIndex((other) => middleKey(other) === middleKey(m)) === i);
  const stay = known
    .filter((m) => now - m.askedAt <= MIDDLE_AGE && !fresh.some((f) => middleKey(f) === middleKey(m)))
    .sort((x, y) => y.askedAt - x.askedAt);
  const kept = fresh.concat(stay).slice(0, MIDDLES);
  const gone = known.filter((m) => !kept.some((k) => middleKey(k) === middleKey(m)));
  const writes = fresh.filter((m) => kept.includes(m)).map((m) => env.DB
    .prepare(
      'INSERT INTO route_middles (from_city, to_city, exit, entry, meters, seconds, line, steps, name, asked_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (from_city, to_city, exit, entry) DO UPDATE SET ' +
      'meters = excluded.meters, seconds = excluded.seconds, line = excluded.line, steps = excluded.steps, ' +
      'name = excluded.name, asked_at = excluded.asked_at'
    )
    .bind(a, b, junctionKey(m.exit), junctionKey(m.entry), m.meters, m.seconds,
      JSON.stringify(m.line), JSON.stringify(m.steps), m.name || '', now))
    .concat(gone.map((m) => env.DB
      .prepare('DELETE FROM route_middles WHERE from_city = ? AND to_city = ? AND exit = ? AND entry = ?')
      .bind(a, b, junctionKey(m.exit), junctionKey(m.entry))));
  if (!writes.length) return;
  try {
    if (await wrongDatabase(env)) return;
    await env.DB.batch(writes);
  } catch (e) {
    /* No table yet: the next ride between the two asks the long way again. */
  }
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

/* How far past the last stretch of tunnel the next one is a tunnel of its
   own rather than more of the same one: THE TURNS in the header. */
const TUNNEL_GAP = 100;

/* How far into one of the router's steps a point on its line is: along the
   line, vertex by vertex, to the vertex nearest the point. A junction is
   one of the line's vertices, so nearest is the one. */
function into(s, location) {
  const line = s.geometry && Array.isArray(s.geometry.coordinates) ? s.geometry.coordinates : [];
  let best = 0;
  let near = Infinity;
  let along = 0;
  for (let i = 0; i < line.length; i++) {
    if (i) along += km({ lat: line[i - 1][1], lng: line[i - 1][0] }, { lat: line[i][1], lng: line[i][0] }) * 1000;
    const off = Math.abs(line[i][0] - location[0]) + Math.abs(line[i][1] - location[1]);
    if (off < near) { near = off; best = along; }
  }
  return best;
}

/* Where one of the router's routes turns: THE TURNS in the header. A way
   whose steps did not come, or came in a shape this does not know, has none
   and is still a way. */
function turns(route) {
  const out = [];
  let meters = 0;
  let tunnel = -Infinity;
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
      for (const i of s && Array.isArray(s.intersections) ? s.intersections : []) {
        if (!Array.isArray(i.classes) || !i.classes.includes('tunnel') || !Array.isArray(i.location)) continue;
        const along = meters + into(s, i.location);
        if (along - tunnel > TUNNEL_GAP) {
          out.push({
            at: [Number(Number(i.location[1]).toFixed(5)), Number(Number(i.location[0]).toFixed(5))],
            meters: Math.round(along),
            turn: 'tunnel',
            name: typeof s.name === 'string' ? s.name : ''
          });
        }
        tunnel = along;
      }
      meters += Number(s && s.distance) || 0;
    }
  }
  return out;
}

/* Corners nearer each other than this are one corner to a rider. The router
   names every one it passes, and on a bike way through town they come in
   knots: a crossing taken on the pavements is a right, a left ten metres on
   and a right again, each true where it stands. Rattatee says a corner once
   it is within forty metres, so the second of a knot was being said while
   the rider was still in the first — "left" in the middle of a right turn,
   which is how this was found. A knot is said as the one turn it makes
   overall, measured CORNER metres before its first corner and after its
   last, under the last corner's street, at the first corner; one that comes
   out straight, a jog across a road, is not said at all. A knot is held to
   twice KNOT end to end, so a pavement zigzagging for a block is a few
   knots in turn rather than one that swallows the real corner after it.

   Tried on eighteen bike ways across town and their alternatives: 974
   turns, a third of them within forty metres of the one before, became 643
   with 37; and a turn whose side disagreed with how the line bends 25 m
   either side of it went from 34 to 10. Forty metres instead of thirty
   left two crowded but strung corners into knots long enough to say the
   wrong side 20 times, so thirty it is. */
const KNOT = 30;

/* The words a knot is made of: a roundabout keeps its exit and the arrival
   is the arrival, so neither is folded into anything. */
const KNOTTED = new Set(['left', 'right', 'keep-left', 'keep-right', 'straight', 'around']);

function untie(steps, line) {
  if (steps.length < 2 || line.length < 2) return steps;
  const along = [0];
  for (let i = 1; i < line.length; i++) along.push(along[i - 1] + metres(line[i - 1], line[i]));
  const vertex = (at) => {
    let best = 0;
    let near = Infinity;
    line.forEach((p, i) => {
      const d = metres(p, at);
      if (d < near) { near = d; best = i; }
    });
    return best;
  };
  const out = [];
  for (let i = 0; i < steps.length;) {
    let j = i;
    while (j + 1 < steps.length && KNOTTED.has(steps[i].turn) && KNOTTED.has(steps[j + 1].turn) &&
      steps[j + 1].meters - steps[j].meters < KNOT && steps[j + 1].meters - steps[i].meters < KNOT * 2) j++;
    if (j === i) {
      out.push(steps[i++]);
      continue;
    }
    const first = vertex(steps[i].at);
    const last = Math.max(first, vertex(steps[j].at));
    let back = first;
    while (back > 0 && along[first] - along[back] < CORNER) back--;
    let ahead = last;
    while (ahead < line.length - 1 && along[ahead] - along[last] < CORNER) ahead++;
    /* At either end of the line there may be nothing to read a heading off:
       the knot is said as the router said it. */
    if (back === first || ahead === last) {
      out.push(...steps.slice(i, j + 1));
    } else {
      const turn = bend([line[back], line[first]], [line[last], line[ahead]]);
      if (turn) out.push(Object.assign({}, steps[i], { turn: turn, name: steps[j].name }));
    }
    i = j + 1;
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
     /api/v1/geocode's shape() is the first. */
  const line = coords.map((c) => [c[1], c[0]]);
  return {
    meters: Math.round(Number(route.distance)),
    seconds: Math.round(Number(route.duration)),
    line: thin(line, MAX_POINTS),
    steps: untie(turns(route), line)
  };
}

async function transit(from, to) {
  const query = '{ plan(from: {lat: ' + from.lat + ', lon: ' + from.lng + '}, ' +
    'to: {lat: ' + to.lat + ', lon: ' + to.lng + '}, numItineraries: ' + (TRIPS + 2) + ') { itineraries { startTime duration ' +
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
    leave: CLOCK.format(new Date(Number(it.startTime))),
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
 * owner did exactly that on 2026-11-17 and saved the ride. So by bike the
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
 * Where it comes from: peatus.ee is asked once for bike and rail together —
 * the planner carries the bike on board — and says which station, which
 * train and when. It says nothing about which way to turn, so the two rides
 * either side are asked of the same bike router every way here comes from,
 * kept off the same streets, and they are what the turns are spoken from.
 * One train and no change: two trains with a bike is not a way anybody
 * takes across a city.
 *
 * Offered only where it is quicker than the quickest bike way, and then
 * the next one that can still be caught and leaves within TRAIN_WAIT. Up to
 * TRAIN_PAIRS pairs of stations are worked out and the quickest of them is
 * offered, TRAINS in all: two trains beside the bike ways read as two
 * nearly-the-same ways on the bar, and the owner asked on 2026-11-19 for one
 * train and the rest bike. Nothing waits on it: the planner down, slow
 * or with nothing to say, a ride to a station the router will not answer —
 * each is `trains: []` and the ways exactly as they were.
 */
const TRAINS = 1;

/* Pairs of stations a train is worked out for before the quickest is kept:
   two router requests each, so the cost is what it was when two were
   offered. */
const TRAIN_PAIRS = 2;

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
   for each pair of stations, by `leg` — ride() or niceRide() — and the
   first departure of each pair that can
   be caught within TRAIN_WAIT, kept where it beats `quickest`, the best
   bike way's seconds — and of those, the quickest TRAINS. */
async function byTrain(from, to, found, quickest, leg) {
  const pairs = new Map();
  for (const d of found) {
    const key = d.from.name + '>' + d.to.name;
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key).push(d);
  }
  const now = Date.now();
  const out = [];
  for (const list of Array.from(pairs.values()).slice(0, TRAIN_PAIRS)) {
    const first = list[0];
    const [head, tail] = await Promise.all([
      leg(from, first.from),
      leg(first.to, to)
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
  return out.sort((a, b) => a.seconds - b.seconds).slice(0, TRAINS);
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
  const way = await settle(kept || one);
  return { meters: way.meters, seconds: way.seconds, line: thin(way.line, MAX_POINTS / 3), steps: way.steps };
}

/* The same ride by BRouter, for a train offered beside its ways, and the
   router's where it has none. */
async function niceRide(context, a, b) {
  const start = [a.lat, a.lng];
  const end = [b.lat, b.lng];
  if (!start.concat(end).every(Number.isFinite)) return null;
  const one = await niceLeg(context, start, end);
  if (!one) return ride(a, b);
  return { meters: one.meters, seconds: one.seconds, line: thin(one.line, MAX_POINTS / 3), steps: untie(one.steps, one.line) };
}

/* The answer before `version` goes on it: every refusal here is a return of
   its own, and onRequestGet() below puts the version on whichever came. */
function unversioned(context, q) {
  const from = point(q.get('from'), 4);
  const to = point(q.get('to'), 5);
  if (!from || !to) return json({ error: 'bad-points' }, 400);
  const mode = q.get('mode') || 'foot';
  if (mode === 'bus') return transit(from, to);
  if (!OSRM[mode]) return json({ error: 'bad-mode' }, 400);
  /* Whole degrees from north, rounded and wrapped: 359 is north too. */
  const raw = q.get('heading');
  const degrees = raw === null || raw.trim() === '' ? NaN : Number(raw);
  const heading = Number.isFinite(degrees)
    ? (Math.round(degrees / HEADING_STEP) * HEADING_STEP % 360 + 360) % 360
    : null;
  return street(context, mode, from, to, heading);
}

/* The answer with `version` first in it — A VERSION ON EVERY ANSWER. */
export async function onRequestGet(context) {
  const res = await unversioned(context, new URL(context.request.url).searchParams);
  let body;
  try { body = await res.json(); } catch (e) { body = { error: 'upstream' }; }
  const out = new Response(JSON.stringify(Object.assign({ version: VERSION }, body)), res);
  out.headers.set('API-Version', String(VERSION));
  return out;
}
