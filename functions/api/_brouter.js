/**
 * Tallinn Tastebuds — bike ways from BRouter, found by the owner's rules.
 *
 * ./route.js asks here first for a bike way, and the bike router it always
 * asked, OSRM, only where this has no answer. tools/doors.mjs asks through
 * the same three functions — brouterUrl(), brouterWay() and sendRules() —
 * so a door is held to the ways a rider would be given.
 *
 * WHY A SECOND ROUTER
 *
 * OSRM's public server answers the fastest way under one fixed bike profile
 * and takes no preference. Everything the owner wanted of a bike way had to
 * be worked round it: a street to keep off was a point made up beside it and
 * the way asked for again through the point, a way on the other side another
 * made-up point, and each point bent the way wherever it snapped — a stub up
 * into a square, a loop round a car park, on 2026-11-23 a trip to the Aegna
 * ferry's pier. A park path it has a bike pushed along at walking pace, so
 * every park was a door somebody had to ride first. And each workaround was
 * another round of requests: a bike way took two to four seconds where a
 * walk takes one request.
 *
 * BRouter takes its rules with the request. The owner's, said that day: a
 * park is ridden, at ten kilometres an hour; it is not about going fast; it
 * is about nice roads and no big round trips; and the shoulder of a main
 * road is usually the fastest way and not the nice one, like Pärnu maantee.
 * They are data/bike.brf, a BRouter profile, and a way found under them
 * needs no made-up point. **Nice ways by bike** in docs/handbook.md.
 *
 * THE RULES ARE KEPT AT BROUTER
 *
 * brouter.de routes by a profile of its own or by one sent to it: the file
 * is posted once and answered with an id, and every request after names the
 * id. The id is kept by this isolate, and by the colo for the next isolate
 * that wakes there, under a mark made of the file's text — so a deployment
 * that changes the rules sends them again and one that does not asks with
 * the id it has. brouter.de does not say how long it keeps a profile. One
 * it has forgotten is answered with a 500 and nothing else, so on a 500 the
 * file is sent again, once, and the ways asked for under the new id.
 *
 * WHAT A WAY IS
 *
 * { meters, seconds, line, steps, loud, totals }. `line` is every point
 * BRouter answered, as [lat, lng]. `steps` is where it turns, in the words
 * ./route.js answers — THE TURNS in its header — out of BRouter's own turn
 * hints: a sharp turn and a turn are a turn, a slight one and a fork are
 * keeping left or right, a roundabout has its exit, and going straight on is
 * not said. A tunnel is a step where the way goes into one, and the arrival
 * is the last. No step has a street's name: BRouter's map carries none.
 * `loud` is the metres of the way beside traffic, the stretches BRouter's
 * map marks at LOUD_FROM or louder, which is what ./route.js orders the
 * ways by and never answers. `totals` is, for each point of the line, the
 * metres, seconds, cost under the rules and metres beside traffic up to
 * it, which ./route.js prices one way's stretch against another's by and
 * never answers either; null where BRouter's rows did not fit the line.
 *
 * WHEN IT HAS NO ANSWER
 *
 * brouterWays() answers null and ./route.js asks OSRM as it always did. A
 * request is given WAIT milliseconds. One that runs out, or a server that
 * is busy or down, rests the whole of BRouter for REST milliseconds in this
 * isolate, so an outage costs one rider the wait and not every rider. So
 * does one it refuses: brouter.de answers a 403 to an address that asks too
 * fast. On 2026-11-23 it took twenty-nine requests sent two a second and
 * refused the thirtieth, and a run of tools/doors.mjs paced a second apart
 * got about four a minute out of it once those were spent. A ride asks
 * three at once, or a handful more with a door or a train, so some ten
 * rides in a burst and about one a minute after are what one address of
 * Cloudflare's can ask; an answer kept at the edge asks nothing. Past that
 * a rider gets the router's way for a minute. A way BRouter cannot find
 * between two points — one of them on a path it cannot reach — is that
 * trip's alone and rests nothing.
 *
 * WHAT IT COSTS
 *
 * No row of the database. One request for each way asked for, three for a
 * ride across town where OSRM's refinements took eight to thirty, each kept
 * a day at the edge by its address; the rules file read out of the
 * deployment once an isolate, twenty kilobytes; and the file posted when
 * the colo has no id for it or brouter.de has forgotten the one it had.
 * brouter.de is one person's free server, asked under the site's name.
 */

import { deployed, km } from './_lib.js';

const BROUTER = 'https://brouter.de/brouter';

/* Sent so the service can see who is asking, as ./route.js does. */
const AGENT = 'TallinnTastebuds/1.0 (+https://tallinntastebuds.ee)';

const RULES = '/data/bike.brf';

/* How long a request is given, and how long BRouter is left alone after
   one that failed. */
const WAIT = 4000;
const REST = 60000;

/* How long the colo keeps the id the rules were answered with: a week. One
   brouter.de forgets sooner is sent again when it is missed. */
const KEPT = 7 * 86400;

/* The noise class, of BRouter's six, from which a stretch is beside
   traffic: a main road, its pavement and the path along it. */
const LOUD_FROM = 4;

/* Stretches of tunnel nearer than this are one tunnel, said once: the same
   hundred metres as TUNNEL_GAP in ./route.js, and for its reason. */
const TUNNEL_GAP = 100;

/* BRouter's turn hints as the words a step is answered in. The number is
   the command its GeoJSON carries: 2 to 4 are a left turn, a slight one and
   a sharp one, 5 to 7 the same to the right, 8 and 9 keeping left and
   right, 10, 11 and 15 turning round, 13 and 14 a roundabout, 17 and 18 an
   exit left and right. 1 is going straight on, 12 being off the way and 16
   a straight line where it has no map, and none of the three is a step. */
const WORDS = {
  2: 'left', 3: 'keep-left', 4: 'left',
  5: 'right', 6: 'keep-right', 7: 'right',
  8: 'keep-left', 9: 'keep-right',
  10: 'around', 11: 'around', 15: 'around',
  13: 'roundabout', 14: 'roundabout',
  17: 'keep-left', 18: 'keep-right'
};

const metres = (a, b) => km({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] }) * 1000;

/* The address of one of BRouter's ways through [lat, lng] points under a
   profile: `which` is 0 for the way it likes best and 1 to 3 for the ones
   after it, and `out` what to stay out of, as it takes them — `areas`, its
   polygons, each with the weight that makes riding through it dear, and
   `bars`, lines with none, which no way crosses. */
export function brouterUrl(profile, points, which = 0, out = {}) {
  return BROUTER + '?lonlats=' + points.map((p) => p[1] + ',' + p[0]).join('|') +
    '&profile=' + profile + '&alternativeidx=' + which + '&format=geojson&timode=2' +
    (out.areas ? '&polygons=' + out.areas : '') + (out.bars ? '&polylines=' + out.bars : '');
}

/* One of BRouter's answers as a way — WHAT A WAY IS — or null for one with
   no line or no length. */
export function brouterWay(body) {
  const feature = body && Array.isArray(body.features) ? body.features[0] : null;
  const coords = feature && feature.geometry && Array.isArray(feature.geometry.coordinates)
    ? feature.geometry.coordinates : [];
  const about = (feature && feature.properties) || {};
  const meters = Number(about['track-length']);
  const seconds = Number(about['total-time']);
  if (coords.length < 2 || !Number.isFinite(meters) || !Number.isFinite(seconds)) return null;

  /* GeoJSON is [lon, lat, height]; the third place that flips it. */
  const line = coords.map((c) => [Number(c[1]), Number(c[0])]);
  const along = [0];
  for (let i = 1; i < line.length; i++) along.push(along[i - 1] + metres(line[i - 1], line[i]));
  const at = (p) => [Number(p[0].toFixed(5)), Number(p[1].toFixed(5))];

  /* A hint is [point of the line, command, exit, metres to the next,
     degrees]. */
  const steps = [];
  for (const hint of Array.isArray(about.voicehints) ? about.voicehints : []) {
    const turn = WORDS[hint[1]];
    if (!turn || !line[hint[0]]) continue;
    const step = { at: at(line[hint[0]]), meters: Math.round(along[hint[0]]), turn: turn, name: '' };
    if (turn === 'roundabout' && Number.isInteger(hint[2]) && hint[2] > 0) step.exit = hint[2];
    steps.push(step);
  }

  /* The way stretch by stretch, under a row of headings: where each ends,
     how long it is, what it costs under the rules, its tags and the seconds
     so far. A stretch is loud by its noise class, and a tunnel begins where
     the stretch before it ended.

     Each stretch ends on a point of the line, and `totals` carries the
     running sums to every point — metres, seconds, cost and metres beside
     traffic, the points inside a stretch sharing it out by their metres —
     so that ./route.js can price any stretch of a way against another's:
     DETOURS there. A stretch that ends on no point of the line leaves the
     way with no totals, and it is then priced by nobody. */
  let loud = 0;
  let cost = 0;
  let gone = 0;
  let tunnel = -Infinity;
  let before = line[0];
  let totals = [[0, 0, 0, 0]];
  for (const row of Array.isArray(about.messages) ? about.messages.slice(1) : []) {
    const far = Number(row[3]) || 0;
    const tags = String(row[9] || '');
    const noise = /estimated_noise_class=(\d)/.exec(tags);
    if (noise && Number(noise[1]) >= LOUD_FROM) loud += far;
    cost += (Number(row[4]) * far / 1000 + Number(row[5]) + Number(row[6]) + Number(row[7]) + Number(row[8])) || 0;
    if (/(^| )tunnel=yes( |$)/.test(tags)) {
      if (gone - tunnel > TUNNEL_GAP) steps.push({ at: at(before), meters: Math.round(gone), turn: 'tunnel', name: '' });
      tunnel = gone + far;
    }
    gone += far;
    before = [Number(row[1]) / 1e6, Number(row[0]) / 1e6];
    if (totals) totals = totalled(totals, line, along, Number(row[0]), Number(row[1]), [Number(row[11]), cost, loud]);
  }

  steps.sort((a, b) => a.meters - b.meters);
  steps.push({ at: at(line[line.length - 1]), meters: Math.round(meters), turn: 'arrive', name: '' });
  return {
    meters: Math.round(meters), seconds: Math.round(seconds), line: line, steps: steps, loud: Math.round(loud),
    totals: totals && totals.length === line.length ? totals : null
  };
}

/* `totals` carried on to the point of `line` at BRouter's lon and lat in
   millionths of a degree, which is where a stretch ended, with `sums` —
   seconds, cost and metres beside traffic — there; or null where the
   stretch ends on no point after the last. */
function totalled(totals, line, along, lon, lat, sums) {
  const from = totals.length - 1;
  let end = from + 1;
  while (end < line.length && !(Math.round(line[end][1] * 1e6) === lon && Math.round(line[end][0] * 1e6) === lat)) end++;
  if (end >= line.length) return null;
  const was = totals[from];
  for (let p = from + 1; p <= end; p++) {
    const share = (along[p] - along[from]) / (along[end] - along[from] || 1);
    totals.push([along[p], ...sums.map((sum, n) => was[n + 1] + (sum - was[n + 1]) * share)]);
  }
  return totals;
}

/* The rules posted to BRouter: the id it files them under, or null where
   it would not take them — a server that is down, or a file it cannot
   read, which it says beside an id that is no use. */
export async function sendRules(text) {
  const res = await fetch(BROUTER + '/profile', {
    method: 'POST',
    headers: { 'user-agent': AGENT, 'content-type': 'text/plain' },
    body: text,
    signal: AbortSignal.timeout(WAIT)
  });
  if (!res.ok) return null;
  const body = await res.json();
  return body && !body.error && typeof body.profileid === 'string' ? body.profileid : null;
}

/* The colo's copy of the id is filed under the site's own address, under
   /api/admin/, which functions/_middleware.js answers 403 to anybody but
   the owner before any route runs — as the Google rows are in ./_lib.js —
   and under a mark of the rules' text: FNV-1a, which is enough to tell one
   deployment's file from the next. */
const COLO_AT = 'https://tallinntastebuds.ee/api/admin/kept/bike-rules';

function coloKey(text) {
  let mark = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) mark = Math.imul(mark ^ text.charCodeAt(i), 0x01000193);
  return new Request(COLO_AT + '?rules=' + (mark >>> 0).toString(16));
}

/* The id BRouter has the rules under — THE RULES ARE KEPT AT BROUTER — or
   null where they cannot be sent. `again` sends them whatever is kept. The
   tools in tools/ load this module in Node, where there is no Cache API. */
let kept = null;

async function rulesId(context, again) {
  if (kept && !again) return kept;
  const text = await (await deployed(context, RULES)).text();
  const colo = typeof caches === 'undefined' ? null : caches.default;
  const key = coloKey(text);
  if (colo && !again) {
    const hit = await colo.match(key);
    if (hit) return (kept = await hit.text());
  }
  const id = await sendRules(text);
  if (!id) return null;
  kept = id;
  if (colo) await colo.put(key, new Response(id, { headers: { 'cache-control': 'max-age=' + KEPT } }));
  return id;
}

/* One of BRouter's ways, or the status it answered instead: 0 for a
   request that ran out or never arrived. */
async function one(id, points, which, out) {
  try {
    const res = await fetch(brouterUrl(id, points, which, out), {
      headers: { 'user-agent': AGENT, accept: 'application/json' },
      cf: { cacheTtl: 86400, cacheEverything: true },
      signal: AbortSignal.timeout(WAIT)
    });
    return res.ok ? { way: brouterWay(await res.json()) } : { status: res.status };
  } catch (e) {
    return { status: 0 };
  }
}

/* BRouter's ways by bike through [lat, lng] points, the one it likes best
   first and `count` in all where it has that many, staying out of `out` as
   brouterUrl() has it, or null — WHEN IT HAS NO ANSWER. */
let resting = 0;

export async function brouterWays(context, points, count = 1, out = {}) {
  if (Date.now() < resting) return null;
  let status = 0;
  try {
    for (const again of [false, true]) {
      const id = await rulesId(context, again);
      if (!id) break;
      const got = await Promise.all(Array.from({ length: count }, (_, which) => one(id, points, which, out)));
      if (got[0].way) return got.map((g) => g.way).filter(Boolean);
      status = got[0].status || 0;
      if (status !== 500) break;
    }
  } catch (e) {
    /* The rules file unreadable, or the Cache API refusing: no answer. */
  }
  /* 400 is this trip's alone: no way between the two points. */
  if (status !== 400) resting = Date.now() + REST;
  return null;
}
