/**
 * Tallinn Tastebuds — recorded rides, the confirmed bike routes.
 *
 * Somebody presses Record in Rattatee or the map app, on an iPhone, cycles,
 * presses Finish and Save, and the way they really went is kept here. The
 * website records nothing: its own recorder, assets/ride.js, was taken out
 * on 2026-11-18, since the site gives directions and takes nobody's
 * movements. The website's
 * map no longer draws them under a bike route — a suggested way joins one
 * place to another, and somebody's own rides beside it read as nonsense and
 * gave away where they ride from — but ?bbox= stays, because the iPhone app
 * asks it and an installed app is a promise. **Recorded rides** in
 * docs/handbook.md is the reasoning.
 *
 * GET  /api/rides?bbox=<south>,<west>,<north>,<east>
 *
 *   { ready, rides: [ { id, meters, seconds, line: [ [lat, lng], … ] } ] }
 *
 *   The rides whose box meets the one asked about, newest first and at most
 *   NEAR of them. Open to anybody and the same answer for everybody, so it is
 *   cached: the box is rounded outward to two decimals first, about a
 *   kilometre, so a hundred people asking about one street are one read.
 *   `ready: false` and no rides where the table is not applied — WHEN THE
 *   TABLE IS NOT THERE.
 *
 * GET  /api/rides?mine=1, or /api/rides with nothing asked
 *
 *   { ready, user, rides: [ { id, name, meters, seconds, at, timed } ] }
 *
 *   The session's own rides, newest first and at most MINE of them, for the
 *   Your rides card on /account.html and the iPhone app's Your rides. The
 *   one answer here that carries a name, because it goes only to whoever
 *   gave it, and it carries no line: the card is a list. `timed` says
 *   whether the ride has a track, so the list can tell which rides will
 *   have speeds when opened. Never cached. Signed out it is empty. One ride
 *   whole, with what it says about itself, is GET /api/rides/<id> in
 *   ./rides/[id].js.
 *
 * GET  /api/rides?mine=1&lines=1
 *
 *   The same answer with a `line` on every ride, [lat, lng] pairs thinned to
 *   a point every THIN metres or so, for Where you rode on the iPhone app's
 *   Your rides: every ride of a range drawn on one map. Thinned because the
 *   map is the size of a card and two hundred whole lines are megabytes; a
 *   ride whole is still GET /api/rides/<id>. Only with `lines=1`, so the
 *   list an installed app and the account page ask for is the size it was.
 *
 * POST /api/rides   { action: 'save', name, seconds, line }    a session
 * POST /api/rides   { action: 'save', anon: true, … }           nobody
 * POST /api/rides   { action: 'rename', id, name }             its rider
 * POST /api/rides   { action: 'drop', id }                     its rider
 *
 *   { ride: { id, meters, seconds } }
 *
 *   With a session the ride is filed under the account and is one of its
 *   owner's on ?mine=1. With `anon: true` and no session it is filed under
 *   nobody — A RIDE NEEDS NO ACCOUNT.
 *
 *   A point of `line` is [lat, lng], or [lat, lng, t, acc] — the seconds
 *   since the ride began and the fix's accuracy in metres — WHEN EACH POINT
 *   WAS PASSED.
 *
 *   `rename` answers { ride: { id, name } } and `drop` { ok: true }; both
 *   take a session and touch only a ride filed under it, and anything else
 *   is 404 not-found, the answer GET /api/rides/<id> gives. A dropped ride
 *   is gone from under the Bike tab too.
 *
 *   A ride that was paused and went on somewhere else is kept as the runs
 *   that were ridden, a row each — A RIDE WITH A GAP IN IT — and the answer
 *   is the first run's id with the metres of them all.
 *
 *   Errors: 401 signed-out (no session and no `anon`), 400 malformed, 400
 *   short (under MIN_METERS once the ends are off), 400 fast (an average no
 *   bike rides at), 429 often (DAY_RIDES today already, or NET_RIDES from
 *   one network with no account), 503 not-ready, 503 no-salt (an `anon` save
 *   where SAVE_SALT is not set).
 *
 * NOBODY'S NAME IS ON A RIDE
 *
 * A ride is evidence that a way can be cycled, and that is all the map shows
 * of it. Who rode it, and what they called it, are stored and never answered:
 * a GPS trace with a username on it says where somebody goes, which is not
 * the site's to publish. And the ends come off before anything is stored —
 * ENDS metres from the start and from the finish, which is where a home or a
 * workplace would be. The middle of a ride says which streets are rideable;
 * its ends would say who.
 *
 * A RIDE NEEDS NO ACCOUNT
 *
 * What is wanted of a ride is its points: which streets, which way, how
 * fast. Who rode it adds nothing to that, so Rattatee does not ask — people
 * ride, press Save, and that is it — and a save that says `anon: true` and
 * carries no session is kept with no account on it at all.
 *
 * It has to say so. The website's recorder asks for a sign-in before it
 * records, so that the ride is one of Your rides afterwards, and a page whose
 * session ran out mid-ride should still be told `signed-out` and offer the
 * sheet rather than have the ride quietly filed under nobody. A session,
 * where there is one, wins over the flag.
 *
 * Something still has to stand where the account's cap stood, or one script
 * could fill the table. That is the network: the fingerprint ./saves.js
 * uses, an HMAC of the address and the user agent under SAVE_SALT, written
 * into `user_id` as `net:<hmac>` and capped at NET_RIDES a UTC day. It is
 * coarser than an account on purpose — every copy of the app on one iOS
 * version says the same user agent, so riders behind one carrier address
 * share a day's cap, which is why it is twice an account's; a rider who hits
 * it keeps the ride on the phone and it goes tomorrow, or today from an
 * account. And it is needed only for the day it caps, so each such save
 * first empties the `net:` of every ride from before today: what is left of
 * an anonymous ride after midnight UTC is its points and nothing about who
 * sent it. Without SAVE_SALT there is no fingerprint worth storing and the
 * save is refused, `no-salt`, as ./saves.js refuses one.
 *
 * WHAT IS CHECKED, AND WHAT CANNOT BE
 *
 * The length is worked out here from the points, never taken from the page.
 * Every point has to be inside nearTallinn()'s box, a line has at most
 * MAX_POINTS of them, and an average faster than FASTEST is a car or a
 * train, not a bike, and is refused. Past that a browser's location is
 * whatever the browser says it is, the same as a walk's check-in — see IT
 * CAN BE FAKED in ./walk.js. A ride is drawn faintly and suggested nothing;
 * a faked one costs a faint line.
 *
 * WHEN EACH POINT WAS PASSED
 *
 * The rides are kept to be matched to streets one day, and a line alone
 * cannot say whether a stretch was ridden or pushed: forty metres of
 * pavement at walking pace looks exactly like forty metres of cycle lane.
 * So a page may send two more numbers with each point, how many seconds
 * into the ride it was and how sure the phone was of it, and they are kept
 * beside the line in `track`, pair for pair, after the same ends come off.
 * They are optional — the iPhone app and an old page send what they have —
 * and all or nothing: one point without them and the ride is kept with no
 * track rather than with a track that does not line up. They are never
 * answered as they are: when somebody passed a point is theirs in a way the
 * point is not, so the one thing made of them that leaves the server is the
 * speeds ./rides/[id].js works out for the ride's own rider.
 *
 * `track` was added by hand after the table was, so a save tries the
 * insert with it and, where the column is not there yet, again without.
 *
 * A RIDE WITH A GAP IN IT
 *
 * A ride paused at one place and resumed at another — on the far side of a
 * train, or after the phone was locked in a pocket, which pauses the page's
 * recorder outright — arrives as one line with a step in it that nobody
 * rode. The recorder refuses a step faster than a bike, but a pause makes
 * any step slow: three kilometres of railway in eight minutes is 22 km/h.
 * For a day those were stored as they came, and two of the first eleven
 * rides were kept with a straight line across the city in them, 1.3 km and
 * 3.2 km, answered by ?bbox= as somewhere that had been ridden and by the
 * ride's own page as a kilometre it never rode.
 *
 * So the line is cut wherever two points are more than GAP apart — pieces()
 * in ./_sections.js — and each run is kept as a ride of its own: its own
 * row, the ride's name on each, the seconds shared out by length. ENDS
 * comes off both ends of every run, not only the ride's, because where
 * somebody stopped recording is as likely to be a door as where they began.
 * A run under MIN_METERS after that is dropped, and a ride with no run left
 * is `short`. One row a run and not one row with several lines, because
 * `line` is one line to every page and installed app that reads it.
 *
 * WHAT THE RIDE SAYS ABOUT THE STREETS
 *
 * After the rows are in, each run's squares are added to `ride_sections` —
 * ./_sections.js, which says what is counted and why. The ride is kept
 * whether or not that works.
 *
 * WHEN THE TABLE IS NOT THERE
 *
 * `rides` is in db/schema.sql and loaded by hand. Until it is, GET answers
 * `ready: false` and the Bike tab draws its way exactly as it did; a save
 * answers 503 `not-ready` and the page keeps the ride on the phone to try
 * again. `ride_sections` is loaded the same way and costs nothing while it
 * is not: the save catches it.
 */

import {
  json, sessionUser, wrongDatabase, nearTallinn, km, randomHex, clientIp, fingerprint
} from './_lib.js';
import { countUse } from './_visitors.js';
import { pieces, sectionsOf, countSections } from './_sections.js';
import { arrayOf } from './_rides.js';

/* Metres taken off each end of a ride before it is stored — NOBODY'S NAME
   IS ON A RIDE. Two hundred is a block or two: enough that a line stopping
   short of a door does not point at it, short enough that a ride across
   town keeps nearly all of itself. Restated in the sentence the save card
   prints (rideSaveWhy in data/ui.json), in words. */
const ENDS = 200;

/* The shortest ride worth keeping once the ends are off: a ride round the
   block is not a route. Restated by each recorder as the 700 it has to
   record — this and ENDS twice — so it can say so before the save rather
   than after it: Rattatee's `shortest` in Rattatee/Core/Store.swift. */
const MIN_METERS = 300;

/* The most points one line may carry. The page keeps one every twelve
   metres or so, so this is a ride of about forty kilometres, which is
   Tallinn end to end and back. */
const MAX_POINTS = 3500;

/* The fastest average, in km/h, a ride may have. A strong cyclist on the
   flat averages thirty; past forty-five is a vehicle. */
const FASTEST = 45;

/* Rides one account may save in a UTC day. Nobody rides twenty times a day;
   a loop that tried is stopped at twenty rows. */
const DAY_RIDES = 20;

/* Rides one network may save in a UTC day with no account — A RIDE NEEDS NO
   ACCOUNT. Twice an account's, since a carrier's address is shared, and
   NET is what its rows carry in `user_id` in front of the fingerprint: no
   users.id begins with it, so ?mine=1 can never answer one. */
const NET_RIDES = 40;
const NET = 'net:';

/* The longest name, the same sixty a list's title gets. Restated as
   `longestName` in Rattatee/Core/Store.swift, whose field stops there. */
const MAX_NAME = 60;

/* How many rides one read answers, and how large a box it may ask about —
   a way across the city is about 0.1 by 0.25 degrees, and anything bigger
   than this is not a way to a place. */
const NEAR = 40;
const MAX_BOX = 0.4;

/* The latest a point may say it was passed, a day into the ride, and the
   worst accuracy it may claim, a kilometre. Bounds on what is stored, not
   judgements: the page keeps only fixes within thirty metres. */
const MAX_SECONDS = 86400;
const MAX_ACC = 1000;

/* How many of somebody's own rides ?mine=1 answers. A year of commuting is
   more than this, and the card that reads it shows six until asked. */
const MINE = 200;

/* How far apart, in metres, the points of a line ?lines=1 answers are. The
   page keeps one every dozen metres; at fifty a corner is still a corner on
   a map of the whole city, and a ten-kilometre ride is two hundred points. */
const THIN = 50;

export async function onRequestGet(context) {
  const { env, request } = context;
  const query = new URL(request.url).searchParams;
  if (query.get('mine') === '1' || !query.has('bbox')) {
    return json(await mine(context, query.get('lines') === '1'), 200);
  }
  const box = roundedBox(query.get('bbox'));
  if (!box) return json({ error: 'malformed' }, 400);
  if (!env.DB || await wrongDatabase(env)) return json({ ready: false, rides: [] }, 200);

  try {
    const { results } = await env.DB
      .prepare(
        'SELECT id, meters, seconds, line FROM rides ' +
        'WHERE south <= ? AND north >= ? AND west <= ? AND east >= ? ' +
        'ORDER BY created_at DESC LIMIT ?'
      )
      .bind(box.north, box.south, box.east, box.west, NEAR)
      .all();
    const rides = results.map((row) => ({
      id: row.id,
      meters: row.meters,
      seconds: row.seconds,
      line: arrayOf(row.line)
    })).filter((ride) => ride.line.length > 1);
    return json({ ready: true, rides }, 200, 300);
  } catch (e) {
    return json({ ready: false, rides: [] }, 200);
  }
}

/* The session's own rides — GET ?mine=1. */
async function mine(context, lines) {
  const { env, request } = context;
  const none = { ready: false, user: null, rides: [] };
  if (!env.DB || await wrongDatabase(env)) return none;
  const user = await sessionUser(request, env);
  if (!user) return { ...none, ready: true };
  const read = (timed) => env.DB
    .prepare(
      'SELECT id, name, meters, seconds, created_at AS at, ' + timed + ' AS timed' +
      (lines ? ', line' : '') + ' FROM rides ' +
      'WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
    )
    .bind(user.id, MINE)
    .all();
  let got;
  try {
    got = await read("track <> ''");
  } catch (e) {
    /* No `track` column yet, so no ride has one; or WHEN THE TABLE IS NOT
       THERE, which the second read finds out. */
    try {
      got = await read('0');
    } catch (e2) {
      return none;
    }
  }
  const rides = got.results.map((r) => lines
    ? { ...r, timed: !!r.timed, line: thinned(arrayOf(r.line)) }
    : { ...r, timed: !!r.timed });
  return { ready: true, user: user.username, rides };
}

/* A line with a point every THIN metres of riding or so, its first and last
   kept — what ?lines=1 answers. */
function thinned(line) {
  if (line.length < 3) return line;
  const out = [line[0]];
  let run = 0;
  for (let i = 1; i < line.length - 1; i++) {
    run += leg(line[i - 1], line[i]);
    if (run >= THIN) {
      out.push(line[i]);
      run = 0;
    }
  }
  out.push(line[line.length - 1]);
  return out;
}

/* Renaming or deleting one of the session's own rides. The WHERE carries the
   account, so a ride that is somebody else's changes nothing and is
   not-found, the same as one that is not there. */
async function own(env, user, body) {
  const id = typeof body.id === 'string' ? body.id : '';
  if (!/^[0-9a-f]{12}$/.test(id)) return json({ error: 'not-found' }, 404);
  if (body.action === 'rename') {
    if (typeof body.name !== 'string') return json({ error: 'malformed' }, 400);
    const name = body.name.trim().slice(0, MAX_NAME);
    const done = await env.DB
      .prepare('UPDATE rides SET name = ? WHERE id = ? AND user_id = ?')
      .bind(name, id, user.id)
      .run();
    if (!done.meta.changes) return json({ error: 'not-found' }, 404);
    return json({ ride: { id, name } }, 200);
  }
  const done = await env.DB
    .prepare('DELETE FROM rides WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .run();
  if (!done.meta.changes) return json({ error: 'not-found' }, 404);
  return json({ ok: true }, 200);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: 'no-database' }, 503);
  if (await wrongDatabase(env)) return json({ error: 'wrong-database' }, 503);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'malformed' }, 400);
  }

  const user = await sessionUser(request, env);
  if (body && (body.action === 'rename' || body.action === 'drop')) {
    if (!user) return json({ error: 'signed-out' }, 401);
    try {
      return await own(env, user, body);
    } catch (e) {
      return json({ error: 'not-ready' }, 503);
    }
  }
  if (!body || body.action !== 'save') return json({ error: 'malformed' }, 400);

  /* Whose cap the ride counts against: the account's, or with `anon` and no
     session the network's — A RIDE NEEDS NO ACCOUNT. */
  let rider;
  if (user) {
    rider = { id: user.id, most: DAY_RIDES };
  } else if (body.anon === true) {
    if (!env.SAVE_SALT) return json({ error: 'no-salt' }, 503);
    const net = await fingerprint(env.SAVE_SALT, clientIp(request), request.headers.get('User-Agent') || '');
    rider = { id: NET + net, most: NET_RIDES, anon: true };
  } else {
    return json({ error: 'signed-out' }, 401);
  }

  try {
    return await countUse(context, 'map', 'ride_save', save(env, rider, body), user);
  } catch (e) {
    return json({ error: 'not-ready' }, 503);
  }
}

async function save(env, rider, body) {
  const points = cleanLine(body.line);
  const seconds = Math.round(Number(body.seconds));
  if (!points || !Number.isFinite(seconds) || seconds < 1) return json({ error: 'malformed' }, 400);

  /* A RIDE WITH A GAP IN IT: the runs that were ridden, each without its
     ends, and only those still long enough to be a route. */
  const ridden = pieces(points);
  const runs = ridden
    .map((run) => {
      const kept = trimEnds(run);
      const line = kept.map((p) => [p[0], p[1]]);
      /* WHEN EACH POINT WAS PASSED: every point carried the pair, or none
         is kept. */
      const track = kept.every((p) => p.length === 4) ? kept.map((p) => [p[2], p[3]]) : null;
      return { line, track, meters: Math.round(lengthOf(line)) };
    })
    .filter((run) => run.meters >= MIN_METERS);
  const meters = runs.reduce((sum, run) => sum + run.meters, 0);
  if (!runs.length) return json({ error: 'short' }, 400);
  /* The speed is judged on the whole of what was ridden, ends included,
     since the seconds are the whole ride's — and on nothing that was not:
     the step across a gap is not in it. */
  const rode = ridden.reduce((sum, run) => sum + lengthOf(run), 0);
  if (rode / 1000 / (seconds / 3600) > FASTEST) return json({ error: 'fast' }, 400);

  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  /* A network's fingerprint is kept for the day it caps and no longer: every
     ride filed under one before today has it emptied here, on the way past.
     The range is `net:` and everything after it up to `net;`, which is how
     the (user_id, created_at) index is asked for a prefix. */
  if (rider.anon) {
    await env.DB
      .prepare("UPDATE rides SET user_id = '' WHERE user_id >= ? AND user_id < ? AND created_at < ?")
      .bind(NET, NET.slice(0, -1) + ';', day.getTime())
      .run();
  }
  const today = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM rides WHERE user_id = ? AND created_at >= ?')
    .bind(rider.id, day.getTime())
    .first();
  if (today && today.n >= rider.most) return json({ error: 'often' }, 429);

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, MAX_NAME) : '';
  const now = Date.now();
  const rows = runs.map((run, i) => {
    const lats = run.line.map((p) => p[0]);
    const lngs = run.line.map((p) => p[1]);
    return [
      randomHex(6), rider.id, name, run.meters,
      Math.max(1, Math.round(seconds * run.meters / meters)), JSON.stringify(run.line),
      Math.min(...lats), Math.min(...lngs), Math.max(...lats), Math.max(...lngs),
      /* A millisecond apart, so Your rides lists the runs in the order they
         were ridden. */
      now + i
    ];
  });
  const columns = 'id, user_id, name, meters, seconds, line, south, west, north, east, created_at';
  try {
    await env.DB.batch(rows.map((row, i) => env.DB
      .prepare('INSERT INTO rides (' + columns + ', track) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(...row, runs[i].track ? JSON.stringify(runs[i].track) : '')));
  } catch (e) {
    /* No `track` column here yet. The ride is worth keeping without it. */
    await env.DB.batch(rows.map((row) => env.DB
      .prepare('INSERT INTO rides (' + columns + ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(...row)));
  }
  /* WHAT THE RIDE SAYS ABOUT THE STREETS. Not there yet, or failed: the
     ride is kept, and the rebuild counts it. */
  try {
    for (const run of runs) await countSections(env, sectionsOf(run.line, run.track));
  } catch (e) { /* tools/ridesections.mjs */ }
  return json({ ride: { id: rows[0][0], meters, seconds } }, 200);
}

/* The line a page sent, as [lat, lng] pairs at five decimals, or null when
   any of it is not a point inside the box the site covers. Refused whole
   rather than filtered: a ride with a point in another country is a ride
   that went wrong somewhere, and its middle is no better evidence.

   A point that also carries a sane time and accuracy keeps them, as whole
   numbers: [lat, lng, t, acc]. One that does not is the bare pair, and
   save() then keeps no track at all. */
function cleanLine(raw) {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > MAX_POINTS) return null;
  const out = [];
  for (const p of raw) {
    if (!Array.isArray(p)) return null;
    const lat = Math.round(Number(p[0]) * 1e5) / 1e5;
    const lng = Math.round(Number(p[1]) * 1e5) / 1e5;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !nearTallinn(lat, lng)) return null;
    const t = Math.round(Number(p[2]));
    const acc = Math.round(Number(p[3]));
    const timed = p.length >= 4 && t >= 0 && t <= MAX_SECONDS && acc >= 0 && acc <= MAX_ACC;
    out.push(timed ? [lat, lng, t, acc] : [lat, lng]);
  }
  return out;
}

/* The line with ENDS metres taken off the start and the finish. */
function trimEnds(line) {
  const from = cut(line);
  const to = line.length - cut(line.slice().reverse());
  return from < to ? line.slice(from, to) : [];
}

/* How many points from the front lie within ENDS metres of riding. */
function cut(line) {
  let run = 0;
  for (let i = 1; i < line.length; i++) {
    run += leg(line[i - 1], line[i]);
    if (run >= ENDS) return i;
  }
  return line.length;
}

function leg(a, b) {
  return km({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] }) * 1000;
}

function lengthOf(line) {
  let m = 0;
  for (let i = 1; i < line.length; i++) m += leg(line[i - 1], line[i]);
  return m;
}

/* `south,west,north,east`, rounded outward to two decimals, inside the
   site's box and no bigger than MAX_BOX a side; null otherwise. */
function roundedBox(raw) {
  const n = String(raw || '').split(',').map(Number);
  if (n.length !== 4 || !n.every(Number.isFinite)) return null;
  const box = {
    south: Math.floor(n[0] * 100) / 100,
    west: Math.floor(n[1] * 100) / 100,
    north: Math.ceil(n[2] * 100) / 100,
    east: Math.ceil(n[3] * 100) / 100
  };
  if (box.north < box.south || box.east < box.west) return null;
  if (box.north - box.south > MAX_BOX || box.east - box.west > MAX_BOX) return null;
  if (!nearTallinn(box.south, box.west) || !nearTallinn(box.north, box.east)) return null;
  return box;
}
