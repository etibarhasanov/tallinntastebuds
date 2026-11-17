/**
 * Tallinn Tastebuds — recorded rides, the confirmed bike routes.
 *
 * A member presses the bike button on the map, cycles, presses
 * Finish and Save, and the way they really went is kept here. Later, when
 * anybody asks the Bike tab for the way to a place, the rides under that way
 * are drawn faintly beneath the suggested line, and the bar says how much of
 * the suggestion somebody has actually ridden. The recorder is
 * assets/ride.js; **Recorded rides** in docs/handbook.md is the reasoning.
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
 * GET  /api/rides?mine=1
 *
 *   { ready, user, rides: [ { id, name, meters, seconds, at } ] }
 *
 *   The session's own rides, newest first and at most MINE of them, for the
 *   Your rides card on /account.html. The one answer here that carries a
 *   name, because it goes only to whoever gave it, and it carries no line:
 *   the card is a list. Never cached. Signed out it is empty.
 *
 * POST /api/rides   { action: 'save', name, seconds, line }    a session
 *
 *   { ride: { id, meters, seconds } }
 *
 *   A point of `line` is [lat, lng], or [lat, lng, t, acc] — the seconds
 *   since the ride began and the fix's accuracy in metres — WHEN EACH POINT
 *   WAS PASSED.
 *
 *   Errors: 401 signed-out, 400 malformed, 400 short (under MIN_METERS once
 *   the ends are off), 400 fast (an average no bike rides at), 429 often
 *   (DAY_RIDES today already), 503 not-ready.
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
 * answered. When somebody passed a point is theirs in a way the point is
 * not.
 *
 * `track` was added by hand after the table was, so a save tries the
 * insert with it and, where the column is not there yet, again without.
 *
 * WHEN THE TABLE IS NOT THERE
 *
 * `rides` is in db/schema.sql and loaded by hand. Until it is, GET answers
 * `ready: false` and the Bike tab draws its way exactly as it did; a save
 * answers 503 `not-ready` and the page keeps the ride on the phone to try
 * again.
 */

import { json, sessionUser, wrongDatabase, nearTallinn, km, randomHex } from './_lib.js';
import { countUse } from './_visitors.js';

/* Metres taken off each end of a ride before it is stored — NOBODY'S NAME
   IS ON A RIDE. Two hundred is a block or two: enough that a line stopping
   short of a door does not point at it, short enough that a ride across
   town keeps nearly all of itself. Restated in the sentence the save card
   prints (rideSaveWhy in data/ui.json), in words. */
const ENDS = 200;

/* The shortest ride worth keeping once the ends are off: a ride round the
   block is not a route. Restated as MIN_METERS in assets/ride.js, which
   says so before the save rather than after it. */
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

/* The longest name, the same sixty a list's title gets. Restated as
   MAX_NAME in assets/ride.js, whose field is the only one that writes it. */
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

export async function onRequestGet(context) {
  const { env, request } = context;
  const query = new URL(request.url).searchParams;
  if (query.get('mine') === '1') return json(await mine(context), 200);
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
      line: lineOf(row.line)
    })).filter((ride) => ride.line.length > 1);
    return json({ ready: true, rides }, 200, 300);
  } catch (e) {
    return json({ ready: false, rides: [] }, 200);
  }
}

/* The session's own rides — GET ?mine=1. */
async function mine(context) {
  const { env, request } = context;
  const none = { ready: false, user: null, rides: [] };
  if (!env.DB || await wrongDatabase(env)) return none;
  const user = await sessionUser(request, env);
  if (!user) return { ...none, ready: true };
  try {
    const { results } = await env.DB
      .prepare(
        'SELECT id, name, meters, seconds, created_at AS at FROM rides ' +
        'WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
      )
      .bind(user.id, MINE)
      .all();
    return { ready: true, user: user.username, rides: results };
  } catch (e) {
    /* WHEN THE TABLE IS NOT THERE. */
    return none;
  }
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
  if (!user) return json({ error: 'signed-out' }, 401);
  if (!body || body.action !== 'save') return json({ error: 'malformed' }, 400);

  try {
    return await countUse(context, 'map', 'ride_save', save(env, user, body), user);
  } catch (e) {
    return json({ error: 'not-ready' }, 503);
  }
}

async function save(env, user, body) {
  const points = cleanLine(body.line);
  const seconds = Math.round(Number(body.seconds));
  if (!points || !Number.isFinite(seconds) || seconds < 1) return json({ error: 'malformed' }, 400);

  const kept = trimEnds(points);
  const line = kept.map((p) => [p[0], p[1]]);
  /* WHEN EACH POINT WAS PASSED: every point carried the pair, or none is
     kept. */
  const track = kept.every((p) => p.length === 4) ? JSON.stringify(kept.map((p) => [p[2], p[3]])) : '';
  const meters = Math.round(lengthOf(line));
  if (meters < MIN_METERS) return json({ error: 'short' }, 400);
  /* The speed is judged on the whole of what was ridden, ends included,
     since the seconds are the whole ride's. */
  if (lengthOf(points) / 1000 / (seconds / 3600) > FASTEST) return json({ error: 'fast' }, 400);

  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  const today = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM rides WHERE user_id = ? AND created_at >= ?')
    .bind(user.id, day.getTime())
    .first();
  if (today && today.n >= DAY_RIDES) return json({ error: 'often' }, 429);

  const id = randomHex(6);
  const lats = line.map((p) => p[0]);
  const lngs = line.map((p) => p[1]);
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, MAX_NAME) : '';
  const row = [
    id, user.id, name, meters, seconds, JSON.stringify(line),
    Math.min(...lats), Math.min(...lngs), Math.max(...lats), Math.max(...lngs), Date.now()
  ];
  const columns = 'id, user_id, name, meters, seconds, line, south, west, north, east, created_at';
  try {
    await env.DB
      .prepare('INSERT INTO rides (' + columns + ', track) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(...row, track)
      .run();
  } catch (e) {
    /* No `track` column here yet. The ride is worth keeping without it. */
    await env.DB
      .prepare('INSERT INTO rides (' + columns + ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(...row)
      .run();
  }
  return json({ ride: { id, meters, seconds } }, 200);
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

function lineOf(text) {
  try {
    const line = JSON.parse(text);
    return Array.isArray(line) ? line : [];
  } catch (e) {
    return [];
  }
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
