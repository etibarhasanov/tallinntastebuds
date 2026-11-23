#!/usr/bin/env node
/**
 * Tallinn Tastebuds — the bike ways between pinned points, held to what was
 * said to be right.
 *
 *     node tools/routecheck.mjs                  every pinned trip, answered
 *                                                out of its recording; a
 *                                                question the recording has
 *                                                no answer to is put to the
 *                                                router and the answer kept
 *     node tools/routecheck.mjs --check          the same with no network: a
 *                                                question with no recorded
 *                                                answer fails the trip (this
 *                                                is what CI runs)
 *     node tools/routecheck.mjs <id> …           those trips only, in any mode
 *     node tools/routecheck.mjs --fresh [<id> …] the recordings thrown away
 *                                                and the router asked again,
 *                                                to see whether its map moved
 *     node tools/routecheck.mjs --pin <id> …     the ways the code answers now
 *                                                become the pin — once the
 *                                                owner has said they are right
 *     node tools/routecheck.mjs --confirm <id> … the owner has looked at the
 *                                                pinned ways and said yes
 *     node tools/routecheck.mjs --page <file>    a page that draws every trip
 *                                                on the map, the pinned ways
 *                                                and what is answered now
 *
 * WHY
 *
 * functions/api/route.js is two routers with rules laid over them: BRouter
 * under the owner's own rules, the streets a bike route keeps off, a way
 * through a door, and under those the older router with its spurs cut, its
 * bends settled, a way round either side and a long ride cut in three.
 * Nearly every rule was written for one ride the owner sent a picture of,
 * and every one runs on every other ride too. Nothing held those still. A
 * rule that took Laagna tee out of the way from Herne to Tondiraba could
 * bend the way from Juhkentali to Kalamaja, and the first anybody knew of
 * it was a rider at a corner. The files were checked for consistency and
 * the answers for nothing.
 *
 * So trips are pinned: two points and the ways the route offers between
 * them, looked at by the owner and said to be right. This runs the route for
 * each and fails when the ways are no longer those. Then somebody says which
 * is right — the pin or the new answer — and whichever it is, is what the
 * next change is held to.
 *
 * A PIN
 *
 * data/bike-trips.json, one object a trip. It is in data/ because the
 * owner's page, /admin/ways, reads it there and writes it — assets/ways.js
 * — and a session writes it through this tool:
 *
 *   id         a few words with hyphens, the name of its recording too
 *   name       what the owner calls the trip
 *   from, to   [lat, lng]. The repository is public: pin a corner, not a door
 *   heading    degrees from north, where the trip is Rattatee asking for a
 *              new way mid-ride — SETTING OFF THE WAY THEY ARE GOING in
 *              route.js. Left out otherwise
 *   why        what the trip is there to hold, in a sentence: the picture it
 *              came from, the street it must keep off
 *   confirmed  the day the owner looked at the pinned ways drawn and said
 *              they are right. A pin without it is only what the code
 *              answered on the day it was pinned, and the tool says so
 *   wrong      the owner's own words for what is wrong with the ways, and
 *   said       the day they said it. It is the work to do: this lists every
 *              one each time it runs, and it stays until the ways are
 *              confirmed
 *   fixed      the day the ways changed after that was said. The owner has
 *              not looked yet: the page asks them to
 *   ways       the pin: each way the route answered, first to last, as its
 *              `meters` and `seconds`, its `steps` — [meters, turn, name,
 *              lat, lng] and the exit of a roundabout — and its `line`, as
 *              Google's encoded polyline at five decimals, which is the line
 *              the answer carries to the digit
 *
 * A trip is added by writing its `id`, `name`, `from`, `to` and `why` into
 * the file and running this without --check: it asks the routers, keeps
 * the recording, and pins what was answered, unconfirmed. One is taken out
 * by deleting its object and its recording.
 *
 * A way is the pin or it is not: every metre, second, turn and point is
 * compared, and nothing is near enough. That is affordable because nothing
 * here moves by itself — see THE RECORDINGS — and it is what makes a
 * quiet change loud. What is said about a way that differs is rounder: how
 * far and how long it was and is, how much of it runs elsewhere and how far
 * off, and the first turn that is not the turn it was.
 *
 * WHAT THE PAGE ASKS FOR
 *
 * The owner pins a trip, or says the live site's answer is the right one,
 * on a phone, where nothing can be recorded. So the page writes what it
 * wants and this does it, run without --check by the `land` job of
 * .github/workflows/generated.yml before the checks:
 *
 *   saw        [meters, seconds] of each way the owner was looking at when
 *              they pressed. A trip with `saw` is recorded and pinned as
 *              this answers it, and its `confirmed` is kept only where the
 *              ways pinned are the ways they saw: a yes is to a picture,
 *              and to no other
 *   fresh      true where the pin is to be made again from the routers as
 *              they answer today, its recording thrown away first
 *
 * Both are gone from the file once it is done, and under --check a trip
 * still carrying one fails: it has not been recorded.
 *
 * THE RECORDINGS
 *
 * Neither router is in this repository. Their map is OpenStreetMap's and
 * changes under them daily, each is somebody else's free server, and CI
 * should neither lean on them nor fail because a path in Kopli was redrawn.
 * So each trip has a recording, tools/routecheck/<id>.json.gz: every
 * question route.js put to a router for that trip, and what the router
 * said, byte for byte. A trip is run through the real Function —
 * onRequestGet(), called the way the deploy calls it, over the real
 * data/doors.json and data/bike.brf — with `fetch` answered out of the
 * recording. What is held, then, is this repository's half: given what the
 * routers said, these are the ways.
 *
 * They are gzipped because they are large and nobody reads them: a ride
 * across town is three to thirty questions and up to half a megabyte of
 * answers, a tenth of that packed. The whole answer is kept and not the
 * fields route.js reads today, because a recording cut to today's reads
 * would quietly answer tomorrow's wrong.
 *
 * A change can make the route ask something it did not ask before — a rule
 * in data/bike.brf, a street to keep off, a new door near the way. Under
 * --check that fails the trip, as it must: there is no telling what the
 * answer would be. Without --check the question is put to the router, a
 * pause apart and under the site's own name, and kept. Answers nothing asks
 * for any more are dropped once the trip is as pinned again or is pinned
 * anew; while it differs they stay, in case the change is the thing taken
 * back.
 *
 * WHEN A TRIP FAILS
 *
 *   the ways are not the pin   A change here changed the answer. `--page`
 *       draws the pinned ways and the new ones on the map; the owner says
 *       which is right. The new: `--pin <id>`, which clears `confirmed`,
 *       and `--confirm <id>` when they have looked. The pin: the change is
 *       wrong for this trip, and is what gets fixed.
 *   a question with no answer   Run it without --check, and it is one of
 *       the two above or it passes.
 *
 * Both files are committed with the change that moved them, so the pull
 * request says which ways moved and the body says who said they should.
 *
 * WHAT IS NOT HELD
 *
 *   - Which way is said to be ridden. That is read off `ride_sections`,
 *     there is no database here, and it moves with every ride saved. The
 *     ways are the ones the live site offers, in its order; where riders
 *     made the most of one the site says `ridden: true` beside it, and
 *     where the older router answered, puts it first.
 *   - A train. It leaves at a time, and the planner is answered here as
 *     down: `trains` is empty and the ways are as they would be.
 *   - The kept middle of a long ride, which is a row. A ride between two
 *     cities asks the long way here every time, as a pair with no middle
 *     kept does.
 *   - What the routers would say today. `--fresh` asks, and says how many
 *     of their answers are not the ones recorded; a trip that then differs
 *     from its pin moved with the map and not with the code, and is the
 *     owner's to look at the same way. On the page, Ask the route now is
 *     the same question put to the live site.
 *
 * Zero dependencies, like everything in tools/. Node's fetch, Request and
 * Response are the Workers runtime's for every purpose here, and node:zlib
 * is Node's own.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HOME = join(ROOT, 'tools', 'routecheck');
const TRIPS = join(ROOT, 'data', 'bike-trips.json');
const SITE = 'https://tallinntastebuds.ee';

/* The two routers a recording holds answers from, and how each is asked:
   `pause` between two questions, and `wait` before one it would not answer
   is put again, TRIES times, each wait a `wait` longer. Both are somebody's
   free server. BRouter is one person's and refuses an address that asks too
   fast — about thirty questions at once and four a minute after, WHEN IT
   HAS NO ANSWER in functions/api/_brouter.js — so it is asked slowly and
   waited for longer. Anything else route.js asks — the journey planner, for
   a train — is answered as down. */
const OSRM = { at: 'https://routing.openstreetmap.de/', pause: 250, wait: 5000 };
const BROUTER = { at: 'https://brouter.de/brouter?', pause: 2000, wait: 20000 };
const RULES_AT = 'https://brouter.de/brouter/profile';
const AGENT = 'TallinnTastebuds/1.0 (+https://tallinntastebuds.ee)';
const TRIES = 6;

/* Nearer than this to the pinned line, a point of a way that differs is
   said to be on the same street: ALIKE_NEAR in route.js, for the same
   reason. Only the words about a difference use it. */
const NEAR = 25;

const args = process.argv.slice(2);
const pageAt = args.indexOf('--page');
const PAGE = pageAt < 0 ? null : args[pageAt + 1];
const CHECK = args.includes('--check');
const FRESH = args.includes('--fresh');
const PIN = args.includes('--pin');
const CONFIRM = args.includes('--confirm');
const named = args.filter((a, i) => !a.startsWith('--') && (pageAt < 0 || i !== pageAt + 1));

function stop(message) {
  console.error(message);
  process.exit(2);
}

const unknown = args.filter((a) => a.startsWith('--') && !['--check', '--fresh', '--pin', '--confirm', '--page'].includes(a));
if (unknown.length) stop('routecheck: no such option: ' + unknown.join(' '));
if (pageAt >= 0 && (!PAGE || PAGE.startsWith('--'))) stop('routecheck: --page takes the file to write');
if (CHECK && (FRESH || PIN || CONFIRM)) stop('routecheck: --check changes no pin and no recording, so it goes with none of --fresh, --pin and --confirm');
if ((PIN || CONFIRM) && !named.length) stop('routecheck: --pin and --confirm take the trips by id, so nothing is pinned or confirmed by accident');

/* -------------------------------------------------------------- the pins */

const KEYS = ['id', 'name', 'from', 'to', 'heading', 'why', 'confirmed', 'wrong', 'said', 'fixed', 'saw', 'fresh', 'ways'];
const isDay = (d) => typeof d === 'string' && /^\d{4}-\d\d-\d\d$/.test(d);
const isPoint = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);

function readTrips() {
  let trips;
  try { trips = JSON.parse(readFileSync(TRIPS, 'utf8')); } catch (e) { stop('routecheck: data/bike-trips.json: ' + e.message); }
  if (!Array.isArray(trips)) stop('routecheck: data/bike-trips.json is not a list of trips');
  const seen = new Set();
  for (const trip of trips) {
    const where = 'routecheck: trip ' + JSON.stringify(trip && trip.id);
    if (!trip || typeof trip.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(trip.id)) stop(where + ': an id is lower-case words joined by hyphens');
    if (seen.has(trip.id)) stop(where + ' is there twice');
    seen.add(trip.id);
    if (typeof trip.name !== 'string' || !trip.name) stop(where + ' has no name');
    if (!isPoint(trip.from) || !isPoint(trip.to)) stop(where + ': from and to are [lat, lng]');
    if (trip.heading !== undefined && !Number.isFinite(trip.heading)) stop(where + ': heading is degrees from north');
    for (const day of ['confirmed', 'said', 'fixed']) {
      if (trip[day] !== undefined && !isDay(trip[day])) stop(where + ': ' + day + ' is a day, 2026-11-23');
    }
    if (trip.wrong !== undefined && (typeof trip.wrong !== 'string' || !trip.wrong || !trip.said)) stop(where + ': wrong is the owner\'s words, with the day they were said');
    if (trip.saw !== undefined && !(Array.isArray(trip.saw) && trip.saw.every(isPoint))) stop(where + ': saw is [meters, seconds] of each way');
    if (trip.fresh !== undefined && trip.fresh !== true) stop(where + ': fresh is true or left out');
    const extra = Object.keys(trip).filter((k) => !KEYS.includes(k));
    if (extra.length) stop(where + ' has a field this does not know: ' + extra.join(', '));
  }
  return trips;
}

/* The file as it is kept: one trip a block and one way a line, so a diff
   says which way of which trip moved and a person can still find the trip
   they are after. format() in assets/ways.js writes the same, since the
   page writes the file too and neither can load the other. */
function format(trips) {
  const text = trips.map((trip) => {
    const rows = KEYS.filter((k) => k !== 'ways' && trip[k] !== undefined)
      .map((k) => '    ' + JSON.stringify(k) + ': ' + JSON.stringify(trip[k]));
    if (trip.ways) rows.push('    "ways": [\n' + trip.ways.map((w) => '      ' + JSON.stringify(w)).join(',\n') + '\n    ]');
    return '  {\n' + rows.join(',\n') + '\n  }';
  }).join(',\n');
  return '[\n' + text + '\n]\n';
}

/* Google's encoded polyline at five decimals: what a way's line is to the
   digit, in a fifth of the room. decode() in route.js is the same thing for
   the planner's legs, and is not exported. */
function encode(line) {
  let out = '';
  let before = [0, 0];
  for (const p of line) {
    const now = [Math.round(p[0] * 1e5), Math.round(p[1] * 1e5)];
    for (const axis of [0, 1]) {
      let v = (now[axis] - before[axis]) << 1;
      if (v < 0) v = ~v;
      while (v >= 32) {
        out += String.fromCharCode((32 | (v & 31)) + 63);
        v >>= 5;
      }
      out += String.fromCharCode(v + 63);
    }
    before = now;
  }
  return out;
}

function decode(text) {
  const out = [];
  const at = [0, 0];
  for (let i = 0; i < text.length;) {
    for (const axis of [0, 1]) {
      let shift = 0;
      let value = 0;
      let byte;
      do {
        byte = text.charCodeAt(i++) - 63;
        value |= (byte & 31) << shift;
        shift += 5;
      } while (byte >= 32);
      at[axis] += value & 1 ? ~(value >> 1) : value >> 1;
    }
    out.push([at[0] / 1e5, at[1] / 1e5]);
  }
  return out;
}

/* One way of an answer as it is pinned. */
function pinOf(way) {
  const pin = { meters: way.meters, seconds: way.seconds };
  if (way.ridden) pin.ridden = true;
  pin.steps = (way.steps || []).map((s) => [s.meters, s.turn, s.name, s.at[0], s.at[1]].concat(s.exit ? [s.exit] : []));
  pin.line = encode(way.line);
  return pin;
}

const same = (a, b) => a.meters === b.meters && a.seconds === b.seconds && !a.ridden === !b.ridden &&
  a.line === b.line && JSON.stringify(a.steps) === JSON.stringify(b.steps);

/* -------------------------------------------------------- the recordings */

const tapeFile = (id) => join(HOME, id + '.json.gz');

/* A trip's recording: the answers kept, the ones the last recording held
   where this run threw it away, and what this run asked, lacked and added. */
function openTape(id, fresh) {
  const kept = new Map();
  if (existsSync(tapeFile(id))) {
    for (const [url, status, body] of JSON.parse(gunzipSync(readFileSync(tapeFile(id))).toString('utf8')).answers) {
      kept.set(url, { status: status, body: body });
    }
  }
  return {
    id: id,
    answers: fresh ? new Map() : kept,
    before: fresh ? kept : null,
    asked: new Set(),
    lacked: 0,
    added: 0,
    failed: ''
  };
}

/* The recording as it should now be kept, written where this run changed
   it: the answers this run asked for, and the rest beside them unless
   `tidy`. Sorted, so the same answers are the same file. */
function closeTape(tape, tidy) {
  const unused = Array.from(tape.answers.keys()).filter((url) => !tape.asked.has(url));
  if (!tape.added && !(tidy && unused.length)) return;
  if (tidy) unused.forEach((url) => tape.answers.delete(url));
  const answers = Array.from(tape.answers.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([url, a]) => [url, a.status, a.body]);
  writeFileSync(tapeFile(tape.id), gzipSync(JSON.stringify({ answers: answers }), { level: 9 }));
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const live = globalThis.fetch;
let queue = Promise.resolve();
const asking = new Map();

/* One thing asked of a router itself, after everything asked before it:
   `ask` makes the request, and is called again after a wait for as long as
   the answer is one to wait out. A 200 is an answer and so is a 400, which
   is a router saying it has no way or no street there; anything else — busy,
   refusing, down — is the router having a bad minute, and is never kept as
   what it said. */
function put(key, host, ask) {
  if (!asking.has(key)) {
    const answer = queue.then(async () => {
      for (let attempt = 0; ; attempt++) {
        await sleep(attempt ? host.wait * attempt : host.pause);
        let res = null;
        try { res = await ask(); } catch (e) { /* asked again below */ }
        if (res && (res.ok || res.status === 400)) return { status: res.status, body: await res.text() };
        if (attempt === TRIES) throw new Error(res ? 'it answered ' + res.status : 'it could not be reached');
      }
    });
    queue = answer.catch(() => {});
    asking.set(key, answer);
    answer.finally(() => asking.delete(key)).catch(() => {});
  }
  return asking.get(key);
}

/* BRouter routes by rules it is sent first, data/bike.brf, and answers the
   file with an id every question after names — THE RULES ARE KEPT AT
   BROUTER in functions/api/_brouter.js. The id is a different one each time
   the file is sent, so a recording cannot be filed under it. Here the file
   is answered with an id of this tool's own, a mark of its text, and the
   questions are recorded under that: the same rules are the same questions
   on any day, and a rule changed is every question asked anew, which is
   what it should be. Only when a question has to be put to BRouter itself
   is the file really sent, once a run, and the question asked under the id
   that came back — askBrouter() below. */
const rules = new Map();
let sent = null;

function rulesId(text) {
  let mark = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) mark = Math.imul(mark ^ text.charCodeAt(i), 0x01000193);
  const id = 'pinned_' + (mark >>> 0).toString(16);
  rules.set(id, text);
  return id;
}

async function askBrouter(url) {
  const id = new URL(url).searchParams.get('profile');
  for (const again of [false, true]) {
    if (!sent || sent.id !== id || again) {
      const res = await live(RULES_AT, { method: 'POST', headers: { 'user-agent': AGENT, 'content-type': 'text/plain' }, body: rules.get(id) });
      const body = res.ok ? await res.json() : null;
      if (!body || typeof body.profileid !== 'string') return res;
      sent = { id: id, theirs: body.profileid };
      await sleep(BROUTER.pause);
    }
    const res = await live(url.replace('profile=' + id, 'profile=' + sent.theirs), { headers: { 'user-agent': AGENT, accept: 'application/json' } });
    /* A 500 and nothing else is BRouter having forgotten the rules: sent
       again, once. Its answer is named after the number in the id it was
       asked under — brouter_1795448222455_0 under custom_1795448222455 —
       which is kept as this tool's own mark, so the same answer is the
       same recording whichever day it was asked. */
    if (res.status !== 500) {
      return new Response((await res.text()).split(sent.theirs.replace(/^custom_/, '')).join(id.replace(/^pinned_/, '')), { status: res.status });
    }
  }
  return new Response('', { status: 500 });
}

/* What route.js gets when it calls fetch(): a router out of the trip's
   recording, or asked where the recording has nothing and this run may
   ask, and everything else down. A question of BRouter's that cannot be
   answered is answered 400, its word for no way between two points, which
   is that trip's alone: any other failure rests BRouter for a minute in
   _brouter.js, and every trip after it in this run would be the other
   router's. */
let tape = null;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url === RULES_AT) return Response.json({ profileid: rulesId(String(init.body)) });
  const host = [OSRM, BROUTER].find((h) => url.startsWith(h.at));
  if (!host) return new Response('', { status: 503 });
  const none = () => new Response('', { status: host === BROUTER ? 400 : 503 });
  tape.asked.add(url);
  let answer = tape.answers.get(url);
  if (!answer) {
    if (CHECK) {
      tape.lacked++;
      return none();
    }
    try {
      answer = await put(url, host, host === BROUTER
        ? () => askBrouter(url)
        : () => live(url, { headers: { 'user-agent': AGENT, accept: 'application/json' } }));
    } catch (e) {
      tape.failed = e.message;
      return none();
    }
    if (!tape.answers.has(url)) tape.added++;
    tape.answers.set(url, answer);
  }
  return new Response(answer.body, { status: answer.status, headers: { 'content-type': 'application/json' } });
};

/* The deployment's files, read off the disk: data/doors.json and
   data/bike.brf are the two route.js asks for. */
const ASSETS = {
  fetch: async (request) => {
    const file = join(ROOT, decodeURIComponent(new URL(request.url).pathname));
    return existsSync(file) ? new Response(readFileSync(file)) : new Response('', { status: 404 });
  }
};

const { onRequestGet } = await import(pathToFileURL(join(ROOT, 'functions', 'api', 'route.js')).href);

/* A trip put to the route the way an app puts it: the ways answered, as
   pins, or the word it was refused with. */
async function ride(trip) {
  const q = new URLSearchParams({ from: trip.from.join(','), to: trip.to.join(','), mode: 'bike' });
  if (trip.heading !== undefined) q.set('heading', String(trip.heading));
  const res = await onRequestGet({ request: new Request(SITE + '/api/v1/route?' + q), env: { ASSETS: ASSETS } });
  const body = await res.json();
  if (body.error) return { error: String(body.error) };
  return { ways: [body].concat(Array.isArray(body.others) ? body.others : []).map(pinOf) };
}

/* ------------------------------------------------- the words about a way */

const size = (way) => (way.meters / 1000).toFixed(1) + ' km ' + Math.round(way.seconds / 60) + ' min';
const spot = (p) => p[0].toFixed(5) + ',' + p[1].toFixed(5);

/* Metres east and north of `origin`, near enough flat for the reach of one
   way's line. */
function flat(p, origin) {
  return [(p[1] - origin[1]) * 111320 * Math.cos(origin[0] * Math.PI / 180), (p[0] - origin[0]) * 110540];
}

/* How far a point is from a line, in metres. */
function apart(p, line) {
  let least = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = flat(line[i - 1], p);
    const [bx, by] = flat(line[i], p);
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, (-ax * dx - ay * dy) / (dx * dx + dy * dy || 1)));
    least = Math.min(least, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return least;
}

/* How much of one line's length lies more than NEAR from another, as a
   share, and its furthest point from it. */
function strays(line, other) {
  let all = 0;
  let off = 0;
  let most = 0;
  let where = line[0];
  for (let i = 0; i < line.length; i++) {
    const d = apart(line[i], other);
    if (d > most) { most = d; where = line[i]; }
    if (!i) continue;
    const step = Math.hypot(...flat(line[i], line[i - 1]));
    all += step;
    if (d > NEAR) off += step;
  }
  return { share: all ? off / all : 0, most: most, where: where };
}

/* What became of a pinned way, in a line a person can act on. */
function difference(was, now) {
  const said = [];
  if (was.meters !== now.meters || was.seconds !== now.seconds) said.push(size(was) + ' → ' + size(now));
  if (was.line !== now.line) {
    const a = decode(was.line);
    const b = decode(now.line);
    const out = strays(b, a);
    const back = strays(a, b);
    const far = out.most >= back.most ? out : back;
    said.push(far.most <= NEAR
      ? 'the same streets, the line ' + Math.ceil(far.most) + ' m off the pinned one at the most'
      : Math.round(Math.max(out.share, back.share) * 100) + '% of it runs elsewhere, ' +
        Math.round(far.most) + ' m from the other at ' + spot(far.where));
  }
  if (JSON.stringify(was.steps) !== JSON.stringify(now.steps)) {
    let k = 0;
    while (k < was.steps.length && k < now.steps.length && JSON.stringify(was.steps[k]) === JSON.stringify(now.steps[k])) k++;
    const word = (s) => (s ? s[1] + (s[2] ? ' onto ' + s[2] : '') + ' at ' + s[0] + ' m' : 'nothing');
    said.push((was.steps.length === now.steps.length ? '' : was.steps.length + ' turns → ' + now.steps.length + ', ') +
      'turn ' + (k + 1) + ' was ' + word(was.steps[k]) + ' and is ' + word(now.steps[k]));
  }
  if (!was.ridden !== !now.ridden) said.push(now.ridden ? 'now said to be ridden' : 'no longer said to be ridden');
  return said.join('; ');
}

/* The ways answered now against the pinned ones, a line a way: nothing
   where they are the pin. */
function differences(pinned, found) {
  const lines = [];
  found.forEach((now, i) => {
    const was = pinned.findIndex((p) => same(p, now));
    if (was === i) return;
    if (was >= 0) lines.push('way ' + (i + 1) + ': was way ' + (was + 1) + ', and is otherwise the same');
    else if (pinned[i]) lines.push('way ' + (i + 1) + ': ' + difference(pinned[i], now));
    else lines.push('way ' + (i + 1) + ': new, ' + size(now));
  });
  pinned.forEach((was, i) => {
    if (i >= found.length && !found.some((now) => same(was, now))) lines.push('way ' + (i + 1) + ': gone, it was ' + size(was));
  });
  return lines;
}

/* ---------------------------------------------------------------- the run */

const trips = readTrips();
const missing = named.filter((id) => !trips.some((t) => t.id === id));
if (missing.length) stop('routecheck: no trip called ' + missing.join(', ') + ' in data/bike-trips.json');
const chosen = named.length ? trips.filter((t) => named.includes(t.id)) : trips;
/* Today in Tallinn, as the page writes a day. */
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn' }).format(new Date());

const drawn = [];

/* The ways the owner was looking at when they pressed, against the ways
   pinned: every one of them, whatever the order. */
const sawThese = (saw, ways) => saw.length === ways.length &&
  saw.every((one) => ways.some((way) => way.meters === one[0] && way.seconds === one[1]));

/* Where a trip stands with the owner, in a few words. */
function standing(trip) {
  if (trip.confirmed) return 'confirmed ' + trip.confirmed;
  if (trip.wrong) return trip.fixed ? 'changed since the owner said it is wrong, and not looked at' : 'WRONG, the owner says';
  return 'not looked at yet';
}

for (const trip of chosen) {
  /* What the page asked for — WHAT THE PAGE ASKS FOR — and a trip nobody
     has run yet are the same job: record it and pin what is answered. */
  const asked = !trip.ways || trip.saw !== undefined || trip.fresh === true;
  tape = openTape(trip.id, !CHECK && (FRESH || trip.fresh === true));
  const found = await ride(trip);
  const lines = [];
  let state = 'ok';

  if (tape.failed) {
    state = 'FAILED';
    lines.push('a router was asked and would not answer — ' + tape.failed + ' — so nothing was kept. Try again in a while.');
  } else if (tape.lacked) {
    state = 'FAILED';
    lines.push('the route asks ' + tape.lacked + ' thing' + (tape.lacked > 1 ? 's' : '') + ' its recording has no answer to: ' +
      'run `node tools/routecheck.mjs ' + trip.id + '` to ask them, and see what the ways are then.');
  } else if (found.error) {
    state = 'FAILED';
    lines.push('the route refused it with `' + found.error + '`' + (trip.ways ? ', where ' + trip.ways.length + ' ways are pinned.' : ', so there is nothing to pin.'));
  } else if (CHECK && asked) {
    state = 'FAILED';
    lines.push('not recorded yet: run `node tools/routecheck.mjs ' + trip.id + '`.');
  } else if (asked || PIN) {
    const moved = !trip.ways || differences(trip.ways, found.ways).length > 0;
    if (asked || moved) {
      state = 'pinned';
      if (trip.confirmed && !(trip.saw && sawThese(trip.saw, found.ways))) {
        if (trip.saw) lines.push('the ways pinned are not the ways the owner was looking at, so it is not confirmed.');
        delete trip.confirmed;
      }
      if (trip.wrong && trip.ways && moved) trip.fixed = today;
      trip.ways = found.ways;
      delete trip.saw;
      delete trip.fresh;
    }
  } else {
    const diff = differences(trip.ways, found.ways);
    if (diff.length) {
      state = 'CHANGED';
      lines.push(...diff);
    }
  }

  if (tape.before && !tape.failed) {
    const moved = Array.from(tape.asked).filter((url) => tape.before.has(url) && tape.before.get(url).body !== tape.answers.get(url).body).length;
    lines.push(moved
      ? 'the routers answer ' + moved + ' of ' + tape.asked.size + ' questions differently from the recording thrown away.'
      : 'the routers answer all ' + tape.asked.size + ' questions as they were recorded answering them.');
  } else if (tape.added && !tape.failed) {
    lines.push('asked the routers ' + tape.added + ' thing' + (tape.added > 1 ? 's' : '') + ' the recording did not have, and kept the answers.');
  }

  if (CONFIRM && state === 'ok') {
    trip.confirmed = today;
    delete trip.wrong;
    delete trip.said;
    delete trip.fixed;
  } else if (CONFIRM) {
    lines.push('not confirmed: only a trip whose ways are the pin can be.');
  }

  if (!CHECK && !tape.failed && !tape.lacked) closeTape(tape, state === 'ok' || state === 'pinned');

  const ways = state === 'CHANGED' ? found.ways : trip.ways;
  console.log((state + '        ').slice(0, 8) + ' ' + trip.id + ' — ' + trip.name +
    (ways ? ': ' + ways.map(size).join(' · ') : '') +
    (state === 'ok' ? '   ' + standing(trip) : ''));
  for (const line of lines) console.log('           ' + line);
  drawn.push({ trip: trip, state: state, now: state === 'CHANGED' ? found.ways : null, said: lines });
}

/* Whatever this run changed, and a file somebody left in another layout. */
if (!CHECK && format(trips) !== readFileSync(TRIPS, 'utf8')) writeFileSync(TRIPS, format(trips));

const orphans = readdirSync(HOME).filter((name) => name.endsWith('.json.gz') && !trips.some((t) => t.id + '.json.gz' === name));
for (const name of orphans) console.log('FAILED   tools/routecheck/' + name + ' is the recording of a trip that is not in data/bike-trips.json: delete it.');

const wrong = drawn.filter((d) => d.state === 'FAILED' || d.state === 'CHANGED').length;
const count = (test) => chosen.filter(test).length;
const said = chosen.filter((t) => t.wrong && !t.confirmed);
console.log('\n' + chosen.length + ' trip' + (chosen.length === 1 ? '' : 's') + ', ' + (chosen.length - wrong) + ' as pinned' +
  (wrong ? ', ' + wrong + ' not' : '') + '. ' +
  count((t) => t.confirmed) + ' confirmed by the owner, ' + said.length + ' they say ' + (said.length === 1 ? 'is' : 'are') + ' wrong, ' +
  count((t) => t.ways && !t.confirmed && !t.wrong) + ' pinned as the code answered and not looked at yet.');
/* The work to do, in the owner's words, every time this runs. */
for (const trip of said) {
  console.log('  ' + trip.id + ' — said ' + trip.said + ': "' + trip.wrong + '"' +
    (trip.fixed ? ' — its ways changed on ' + trip.fixed + ', and the owner has not looked since.' : ''));
}
if (drawn.some((d) => d.state === 'CHANGED')) {
  console.log('Which is right is the owner\'s to say. `node tools/routecheck.mjs --page <file>` draws the pinned ways and the new ones;\n' +
    '`--pin <id>` keeps the new ones, and a change that should not have moved a way is the thing to fix.');
}

/* --------------------------------------------------------------- the page
 * One file with everything in it but Leaflet and the tiles, so it opens off
 * a disk, and a session can photograph each trip and send the picture. The
 * basemap is assets/basemap.js itself, read into the page as it is written:
 * the tile address and its key are said once in this repository and that is
 * where.
 */
if (PAGE) {
  const streets = (way) => way.steps.map((s) => s[2]).filter((name, i, all) => name && name !== all[i - 1]);
  const drawnWay = (way) => ({ size: size(way), turns: way.steps.length, ridden: !!way.ridden, streets: streets(way), line: decode(way.line) });
  const data = drawn.map((d) => ({
    id: d.trip.id,
    name: d.trip.name,
    why: d.trip.why || '',
    from: d.trip.from,
    to: d.trip.to,
    heading: d.trip.heading === undefined ? null : d.trip.heading,
    standing: d.trip.confirmed ? ['yes', 'Confirmed ' + d.trip.confirmed]
      : d.trip.wrong ? ['no', (d.trip.fixed ? 'Changed on ' + d.trip.fixed + ' since the owner said: ' : 'Wrong, the owner said on ' + d.trip.said + ': ') + d.trip.wrong]
        : ['wait', 'Pinned as answered — not looked at yet'],
    state: d.state,
    said: d.said,
    pinned: (d.trip.ways || []).map(drawnWay),
    now: d.now ? d.now.map(drawnWay) : null
  }));
  writeFileSync(resolve(PAGE), page(data, readFileSync(join(ROOT, 'assets', 'basemap.js'), 'utf8')));
  console.log('\nDrawn: ' + resolve(PAGE));
}

process.exit(wrong || orphans.length ? 1 : 0);

/* The page: a trip a section — what it is there to hold, where it stands,
   a map and a row a way. Where the ways are not the pin, the pinned ones
   are drawn dashed and dark under the new ones, and listed under them. */
function page(data, basemap) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bike ways, pinned</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  body { margin: 0; padding: 16px; font: 15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1c1917; background: #fafaf9; }
  main, header { max-width: 760px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  header p { margin: 0 0 20px; color: #57534e; }
  section { background: #fff; border: 1px solid #e7e5e4; border-radius: 12px; padding: 14px; margin: 0 0 18px; }
  h2 { font-size: 17px; margin: 0; }
  .id { color: #78716c; font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; }
  .state { display: inline-block; margin: 6px 0 0; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 600; }
  .state.yes { background: #dcfce7; color: #166534; }
  .state.wait { background: #fef3c7; color: #92400e; }
  .state.no { background: #fee2e2; color: #991b1b; }
  .why { margin: 8px 0 10px; color: #44403c; }
  .map { height: 360px; border-radius: 8px; background: #e7e5e4; }
  h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #78716c; margin: 12px 0 2px; }
  ol { list-style: none; margin: 0; padding: 0; }
  li { display: flex; gap: 8px; padding: 6px 0; border-top: 1px solid #f5f5f4; }
  li:first-child { border-top: 0; }
  .key { flex: 0 0 22px; height: 6px; margin-top: 8px; border-radius: 3px; }
  .key.was { height: 0; border-top: 3px dashed #1c1917; border-radius: 0; opacity: .6; }
  .streets { color: #57534e; font-size: 13px; }
  .said { margin: 8px 0 0; padding: 0 0 0 16px; color: #991b1b; font-size: 13px; }
</style>
</head>
<body>
<header>
  <h1>Bike ways, pinned</h1>
  <p>What <code>/api/v1/route</code> offers by bike between the pinned points, drawn by <code>tools/routecheck.mjs</code> on ${today}. The first way is the one a rider is given; the others are the buttons beside it.</p>
</header>
<main id="trips"></main>
<script id="data" type="application/json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>${basemap.replace(/<\/script/gi, '<\\/script')}</script>
<script>
(function () {
  var COLOURS = ['#c2410c', '#1d4ed8', '#15803d', '#7e22ce'];
  var trips = JSON.parse(document.getElementById('data').textContent);
  var main = document.getElementById('trips');

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }

  function rows(ways, was) {
    var list = el('ol');
    ways.forEach(function (way, i) {
      var row = el('li');
      var key = el('span', 'key' + (was ? ' was' : ''));
      if (!was) key.style.background = COLOURS[i % COLOURS.length];
      var words = el('div');
      words.appendChild(el('strong', '', (i + 1) + ' · ' + way.size + ' · ' + way.turns + ' turns' + (way.ridden ? ' · ridden' : '')));
      words.appendChild(el('div', 'streets', way.streets.join(' · ')));
      row.appendChild(key);
      row.appendChild(words);
      list.appendChild(row);
    });
    return list;
  }

  trips.forEach(function (trip) {
    var box = el('section');
    box.id = trip.id;
    box.appendChild(el('h2', '', trip.name));
    box.appendChild(el('div', 'id', trip.id + (trip.heading === null ? '' : ' · setting off heading ' + trip.heading + '°')));
    var changed = trip.state === 'CHANGED';
    var state = trip.state === 'FAILED' ? ['no', 'Could not be checked']
      : changed ? ['no', 'Not the pinned ways any more']
        : trip.standing;
    box.appendChild(el('div', 'state ' + state[0], state[1]));
    if (trip.why) box.appendChild(el('p', 'why', trip.why));
    var mapBox = el('div', 'map');
    box.appendChild(mapBox);
    var shown = changed ? trip.now : trip.pinned;
    if (changed) box.appendChild(el('h3', '', 'Answered now'));
    box.appendChild(rows(shown, false));
    if (changed) {
      box.appendChild(el('h3', '', 'Pinned'));
      box.appendChild(rows(trip.pinned, true));
    }
    if (trip.state !== 'ok' && trip.state !== 'pinned' && trip.said.length) {
      var said = el('ul', 'said');
      trip.said.forEach(function (line) { said.appendChild(el('li', '', line)); });
      box.appendChild(said);
    }
    main.appendChild(box);

    if (!window.L || !window.TTBBasemap) return;
    var map = L.map(mapBox, { scrollWheelZoom: false });
    window.TTBBasemap.layer(L, { dark: false }).addTo(map);
    var bounds = [trip.from, trip.to];
    if (changed) {
      trip.pinned.forEach(function (way) {
        L.polyline(way.line, { color: '#1c1917', weight: 3, opacity: 0.6, dashArray: '6 7' }).addTo(map);
        bounds = bounds.concat(way.line);
      });
    }
    /* The last way first, so the first is drawn on top where they share a street. */
    shown.slice().reverse().forEach(function (way, k) {
      var i = shown.length - 1 - k;
      L.polyline(way.line, { color: COLOURS[i % COLOURS.length], weight: i ? 4 : 6, opacity: i ? 0.75 : 0.9 }).addTo(map);
      bounds = bounds.concat(way.line);
    });
    L.circleMarker(trip.from, { radius: 7, color: '#1c1917', weight: 3, fillColor: '#fff', fillOpacity: 1 }).addTo(map).bindTooltip('From');
    L.circleMarker(trip.to, { radius: 7, color: '#1c1917', weight: 3, fillColor: '#1c1917', fillOpacity: 1 }).addTo(map).bindTooltip('To');
    map.fitBounds(bounds, { padding: [22, 22] });
  });
})();
</script>
</body>
</html>
`;
}
