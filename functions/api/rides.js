/**
 * Tallinn Tastebuds — recorded rides, the confirmed bike routes.
 *
 * Somebody presses Record in Rattatee or the map app, on an iPhone, cycles,
 * presses Finish and Save, and the way they really went is kept here where
 * they were signed in, and counted and let go where they were not. The
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
 *   { ride: { id, meters, seconds } }     kept, with a session
 *   { counted: true }                     counted and not kept, with none
 *
 *   With a session the ride is filed under the account and is one of its
 *   owner's on ?mine=1. With `anon: true` and no session nothing of it is
 *   kept: its squares are counted and the answer has no `ride` — A RIDE
 *   WITHOUT AN ACCOUNT IS COUNTED, NOT KEPT.
 *
 *   Either may carry `request`, the id the phone gave the ride, and is then
 *   done once however often it is sent — A RIDE SENT TWICE.
 *
 *   A point of `line` is [lat, lng], or [lat, lng, t, acc] — the seconds
 *   since the ride began and the fix's accuracy in metres — WHEN EACH POINT
 *   WAS PASSED, or [lat, lng, t, acc, alt] with its height above the sea in
 *   metres — HOW HIGH EACH POINT WAS.
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
 *   where SAVE_SALT is not set). No word is new: an installed app has a
 *   sentence, or a rule, for each.
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
 * A RIDE WITHOUT AN ACCOUNT IS COUNTED, NOT KEPT
 *
 * Rattatee asks nobody to sign in: people ride, press Save, and that is it.
 * For three days such a ride was kept like any other, in `rides` with a
 * fingerprint of its network where the account would be. On 2026-11-20 the
 * owner drew the line the other way: a ride somebody recorded without
 * making an account is theirs, on their phone, and the site has no
 * business holding the way a stranger went. What is wanted of that ride is
 * what it says about the streets — which were ridden, which way, how
 * steadily — and that is a count.
 *
 * So a save that says `anon: true` and carries no session is checked as
 * any ride is, cut into its runs with the ends off each, counted into
 * `ride_sections` — WHAT THE RIDE SAYS ABOUT THE STREETS — and let go. No
 * row in `rides`, none in `ride_cells`, and the answer is `counted: true`
 * with no `ride` in it, since there is none to name: Rattatee marks a ride
 * saved on any 2xx, and asks for the kept ride only where it was given an
 * id. Such a ride is never under ?bbox=, and tools/doors.mjs never reads
 * it.
 *
 * It has to say `anon`. A recorder that asks for a sign-in first — the map
 * app's — is making a ride one of Your rides, and one whose session ran
 * out mid-ride should be told `signed-out` and offer the sheet rather than
 * have the ride counted and gone. A session, where there is one, wins over
 * the flag, and that ride is kept exactly as it always was.
 *
 * Something still has to stand where the account's cap stands, or one
 * script could count itself down every street in the city. That is the
 * network: the fingerprint ./saves.js uses, an HMAC of the address and the
 * user agent under SAVE_SALT, with how many rides it has sent today beside
 * it in `ride_nets`, NET_RIDES at the most. It is coarser than an account
 * on purpose — every copy of the app on one iOS version says the same user
 * agent, so riders behind one carrier address share a day's cap, which is
 * why it is twice an account's; a rider who hits it keeps the ride on the
 * phone and it goes tomorrow, or today from an account. The row is needed
 * only for the day it caps, so every such save erases the days before
 * today's. Without SAVE_SALT there is no fingerprint worth storing and the
 * save is refused, `no-salt`, as ./saves.js refuses one.
 *
 * Until that day the fingerprint was on the ride itself, `net:<hmac>` in
 * `user_id`, and each save emptied it from the rides of earlier days with
 * an UPDATE that read every anonymous ride of today to find them: a
 * thousand rows read where a thousand had been saved, measured, and three
 * million a day at a hundred rides an hour. No ride in production ever
 * carried one, so nothing was left to move.
 *
 * A RIDE SENT TWICE
 *
 * A phone that never hears the answer cannot tell a save that was lost on
 * the way there from one whose answer was lost on the way back, and sends
 * the ride again. For a ride that is kept that was a second row; for one
 * that is only counted it would be the same streets counted twice, with
 * no row to find it by afterwards.
 *
 * So a save may carry `request`: the id the phone itself gave the ride, a
 * UUID, which Rattatee has had on every ride since its first build. The
 * site remembers it in `ride_seen` for SEEN_DAYS, with the id of the row
 * it became where the ride was kept, and a save whose `request` is there
 * does nothing again: a kept ride is answered with the row it already is,
 * a counted one with `counted: true`. It is a random number that names one
 * ride on one phone and nothing else — no place, no network, no account —
 * and a week covers a phone that waits its longest between tries many
 * times over. A ride sent again after that is done again, which with what
 * a square forgets is one ride's weight for a while. A `request` that is
 * not a UUID is no `request`, not a refusal, and neither is none: the map
 * app sends none.
 *
 * The id is remembered in the same batch that counts the ride, so the two
 * happen together or not at all.
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
 * HOW HIGH EACH POINT WAS
 *
 * Since 2026-11-18 Rattatee sends a fifth number, the fix's altitude above
 * sea level in whole metres, so a ride can one day say where it climbed
 * and why a stretch was slow — which a line on a flat map cannot. It rides
 * in `track` as a third number, [t, acc, alt], under the same all-or-
 * nothing rule one level down: a ride whose every kept point has a sane
 * height keeps them, and one with a single point without keeps [t, acc]
 * alone. So a track is pairs or triples, never a mix, and everything that
 * reads it reads [0] and [1] and nothing past them — no new column, and no
 * reader has to change. It is the phone's GPS height, good to ten or twenty
 * metres a point; a climb is a trend across many of them, not a step
 * between two. Never answered either, for the same reason as the times.
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
 * WHERE IT IS FILED
 *
 * A ride is also filed under the squares of the city its line passes
 * through, in `ride_cells`, so ?bbox= finds the rides near a way by a key
 * rather than by reading every ride there is. ./_ridecells.js is the whole
 * of it; a drop takes the squares with it. A kept ride's, that is: one
 * that is only counted is filed nowhere.
 *
 * WHAT THE RIDE SAYS ABOUT THE STREETS
 *
 * Each run's squares are added to `ride_sections` — ./_sections.js, which
 * says what is counted and why, and which a bike route in ./route.js is
 * weighed by. Not every square takes every ride: one that has counted
 * fifty takes one ride in ten, and from there forgets a little of what it
 * held with each. For a ride that is kept this comes after its rows are
 * in, and the ride is kept whether or not it works. For a ride that is
 * only counted it is all there is, so where it does not work the save has
 * not happened: `not-ready`, and the phone sends the ride again later.
 *
 * WHEN THE TABLE IS NOT THERE
 *
 * `rides` is in db/schema.sql and loaded by hand. Until it is, GET answers
 * `ready: false` and the Bike tab draws its way exactly as it did; a save
 * answers 503 `not-ready` and the phone keeps the ride to try again.
 * `ride_sections`, `ride_cells`, `ride_seen` and `ride_nets` are loaded the
 * same way. A kept ride's save catches the first three: the ride is kept,
 * uncounted, unfiled or unremembered as may be. A counted ride needs
 * `ride_sections`, `ride_seen` where it carries a `request`, and
 * `ride_nets`, and is `not-ready` without one. Without `ride_cells` ?bbox=
 * answers `ready: false`, the same as without `rides`.
 */

import {
  json, sessionUser, wrongDatabase, nearTallinn, km, randomHex, clientIp, fingerprint
} from './_lib.js';
import { countUse } from './_visitors.js';
import { today, dayBack } from './_visits.js';
import { pieces, sectionsOf, tally } from './_sections.js';
import { arrayOf } from './_rides.js';
import { ridesIn, fileCells } from './_ridecells.js';

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

/* Rides one network may have counted in a UTC day with no account — A RIDE
   WITHOUT AN ACCOUNT IS COUNTED, NOT KEPT. Twice an account's, since a
   carrier's address is shared. */
const NET_RIDES = 40;

/* Whether a save's `request` has been here in the last SEEN_DAYS, and what
   it became — A RIDE SENT TWICE. The days go in as VALUES and the table is
   joined to them, so the read is the row that is found and nothing for a
   day it is not in: a list under an IN is billed a row a value — **The
   rules of a read** in .claude/skills/api/SKILL.md. One row at the most,
   by the key, (day, id). How many days is read off the statement, so the
   two cannot disagree. */
const SEEN =
  'SELECT s.ride AS ride FROM (VALUES (?), (?), (?), (?), (?), (?), (?)) v ' +
  'CROSS JOIN ride_seen s ON s.day = v.column1 AND s.id = ? LIMIT 1';
const SEEN_DAYS = SEEN.split('(?)').length - 1;

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

/* The heights a point may claim: the sea's edge less a margin for a bad fix,
   to well over Suur Munamägi's 318 m, the highest ground in the Baltics.
   HOW HIGH EACH POINT WAS. */
const MIN_ALT = -100;
const MAX_ALT = 1000;

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
    /* By the squares of the city each ride passes through, not by reading
       every ride's box — WHAT A READ COSTS in ./_ridecells.js. */
    const results = await ridesIn(env, box, 'id, meters, seconds, line', NEAR);
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
  /* And its squares, by idx_ride_cells_ride. Left behind they would name a
     ride that is not there, which a read drops at the lookup by id. */
  try {
    await env.DB.prepare('DELETE FROM ride_cells WHERE ride = ?').bind(id).run();
  } catch (e) { /* No ride_cells yet. */ }
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

  /* A session keeps the ride. `anon` and no session counts it and keeps
     nothing — A RIDE WITHOUT AN ACCOUNT IS COUNTED, NOT KEPT. Neither is a
     page whose session ran out. */
  if (!user && body.anon !== true) return json({ error: 'signed-out' }, 401);
  if (!user && !env.SAVE_SALT) return json({ error: 'no-salt' }, 503);

  const ride = riddenOf(body);
  if (ride.error) return json({ error: ride.error }, 400);

  /* A RIDE SENT TWICE: the answer it had, again, with nothing done and no
     use counted a second time — one row read, by the key, and none
     written. Where `ride_seen` is not applied a kept
     ride is kept as it was before there was a `request`; a counted one
     cannot be told from its own repeat afterwards, and waits. */
  const once = requestOf(body.request);
  let before = null;
  if (once) {
    try {
      before = await env.DB.prepare(SEEN).bind(...days(), once).first();
    } catch (e) {
      if (!user) return json({ error: 'not-ready' }, 503);
    }
  }
  if (before && !user) return json({ counted: true }, 200);
  if (before && before.ride) {
    return json({ ride: { id: before.ride, meters: ride.meters, seconds: ride.seconds } }, 200);
  }

  try {
    const saved = user ? keep(env, user, body, ride, once) : count(context, ride, once);
    return await countUse(context, 'map', 'ride_save', saved, user);
  } catch (e) {
    return json({ error: 'not-ready' }, 503);
  }
}

/* What of a save was ridden: the runs, each without its ends and with its
   track where every point carried one, the metres of them all and the
   seconds the rider said — or the word it is refused with. Nothing here
   reads the database. */
function riddenOf(body) {
  const points = cleanLine(body.line);
  const seconds = Math.round(Number(body.seconds));
  if (!points || !Number.isFinite(seconds) || seconds < 1) return { error: 'malformed' };

  /* A RIDE WITH A GAP IN IT: the runs that were ridden, each without its
     ends, and only those still long enough to be a route. */
  const ridden = pieces(points);
  const runs = ridden
    .map((run) => {
      const kept = trimEnds(run);
      const line = kept.map((p) => [p[0], p[1]]);
      /* WHEN EACH POINT WAS PASSED: every point carried the pair, or none
         is kept; and HOW HIGH EACH POINT WAS, every height or none. */
      const timed = kept.every((p) => p.length >= 4);
      const high = timed && kept.every((p) => p.length === 5);
      const track = timed ? kept.map((p) => (high ? [p[2], p[3], p[4]] : [p[2], p[3]])) : null;
      return { line, track, meters: Math.round(lengthOf(line)) };
    })
    .filter((run) => run.meters >= MIN_METERS);
  if (!runs.length) return { error: 'short' };
  /* The speed is judged on the whole of what was ridden, ends included,
     since the seconds are the whole ride's — and on nothing that was not:
     the step across a gap is not in it. */
  const rode = ridden.reduce((sum, run) => sum + lengthOf(run), 0);
  if (rode / 1000 / (seconds / 3600) > FASTEST) return { error: 'fast' };
  return { runs, seconds, meters: runs.reduce((sum, run) => sum + run.meters, 0) };
}

/* The id the phone gave the ride, as thirty-two hex digits, or '' where it
   sent none or something else — A RIDE SENT TWICE. */
function requestOf(raw) {
  const id = typeof raw === 'string' ? raw.replace(/-/g, '').toLowerCase() : '';
  return /^[0-9a-f]{32}$/.test(id) ? id : '';
}

/* The ids remembered too long ago to be asked about, erased, and the one
   in hand written down with the row it became, '' where it became none.
   For a batch: the first reads the row or two it erases and one more, by
   the front of the key. */
function remember(env, once, ride) {
  return [
    env.DB.prepare('DELETE FROM ride_seen WHERE day < ?').bind(dayBack(SEEN_DAYS - 1)),
    env.DB.prepare('INSERT OR REPLACE INTO ride_seen (day, id, ride) VALUES (?, ?, ?)').bind(today(), once, ride)
  ];
}

/* A ride with no account behind it: counted, and not kept. Under `wrangler
   dev` on 2026-11-20 a ride of four kilometres read 320 rows and wrote 165
   down a street ridden a few times, 318 written down one nobody had
   ridden, and 10 down one whose squares were full, nine saves in ten. */
async function count(context, ride, once) {
  const { env, request } = context;

  /* The network's rides today, this one among them: a row by its key, read
     and written once. A save turned away here has still been added, which
     past the cap changes nothing. */
  const net = await fingerprint(env.SAVE_SALT, clientIp(request), request.headers.get('User-Agent') || '');
  const sent = await env.DB
    .prepare(
      'INSERT INTO ride_nets (day, net, n) VALUES (?, ?, 1) ' +
      'ON CONFLICT (day, net) DO UPDATE SET n = n + 1 RETURNING n'
    )
    .bind(today(), net)
    .first();
  if (sent && sent.n > NET_RIDES) return json({ error: 'often' }, 429);

  /* Counted and remembered together or not at all, and the fingerprints of
     the days before today's erased on the way past. Which rides a full
     square takes is drawn here, not read off anything the phone sent. */
  await env.DB.batch([
    env.DB.prepare('DELETE FROM ride_nets WHERE day < ?').bind(today()),
    ...ride.runs.map((run) => tally(env, sectionsOf(run.line, run.track), randomHex(6))).filter(Boolean),
    ...(once ? remember(env, once, '') : [])
  ]);
  return json({ counted: true }, 200);
}

/* A ride with an account behind it: kept, filed and counted. */
async function keep(env, user, body, ride, once) {
  const { runs, meters, seconds } = ride;
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  const sent = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM rides WHERE user_id = ? AND created_at >= ?')
    .bind(user.id, day.getTime())
    .first();
  if (sent && sent.n >= DAY_RIDES) return json({ error: 'often' }, 429);

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, MAX_NAME) : '';
  const now = Date.now();
  const rows = runs.map((run, i) => {
    const lats = run.line.map((p) => p[0]);
    const lngs = run.line.map((p) => p[1]);
    return [
      randomHex(6), user.id, name, run.meters,
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
  /* The squares it passes through, so a read of the rides near a way can
     find it by the key — ./_ridecells.js. Not there yet, or failed: the
     ride is kept, and the rebuild beside ride_cells in db/schema.sql
     files it. */
  try {
    await env.DB.batch(rows.map((row, i) => fileCells(env, row[0], row[10], runs[i].line)));
  } catch (e) { /* No ride_cells yet. */ }
  /* WHAT THE RIDE SAYS ABOUT THE STREETS, each run under its own row's id.
     Not there yet, or failed: the ride is kept, uncounted. */
  try {
    const counts = runs.map((run, i) => tally(env, sectionsOf(run.line, run.track), rows[i][0])).filter(Boolean);
    if (counts.length) await env.DB.batch(counts);
  } catch (e) { /* No ride_sections yet, or none with `steady`. */ }
  if (once) {
    try {
      await env.DB.batch(remember(env, once, rows[0][0]));
    } catch (e) { /* No ride_seen yet. */ }
  }
  return json({ ride: { id: rows[0][0], meters, seconds } }, 200);
}

/* Today and the days before it that SEEN asks about, newest first. */
function days() {
  return Array.from({ length: SEEN_DAYS }, (_, i) => dayBack(i));
}

/* The line a page sent, as [lat, lng] pairs at five decimals, or null when
   any of it is not a point inside the box the site covers. Refused whole
   rather than filtered: a ride with a point in another country is a ride
   that went wrong somewhere, and its middle is no better evidence.

   A point that also carries a sane time and accuracy keeps them, as whole
   numbers: [lat, lng, t, acc]. One that does not is the bare pair, and
   save() then keeps no track at all. A timed point that carries a sane
   height as well keeps it too, [lat, lng, t, acc, alt] — HOW HIGH EACH
   POINT WAS. */
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
    const alt = Math.round(Number(p[4]));
    const high = timed && p.length >= 5 && p[4] !== null && alt >= MIN_ALT && alt <= MAX_ALT;
    out.push(high ? [lat, lng, t, acc, alt] : timed ? [lat, lng, t, acc] : [lat, lng]);
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
