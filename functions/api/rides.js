/**
 * Tallinn Tastebuds — recorded rides, the confirmed bike routes.
 *
 * Somebody presses Record in Rattatee or the map app, on an iPhone, cycles,
 * presses Finish and Save, and the way they really went is kept here where
 * they were signed in, and counted and let go where they were not. The
 * website records nothing: its own recorder, assets/ride.js, was taken out
 * on 2026-11-18, since the site gives directions and takes nobody's
 * movements. Nothing draws a ride or lists one any more, here or in an app:
 * what a ride is for is steering a bike route — **Doors** and **Ways people
 * have ridden** in docs/handbook.md — and adding up its rider's riding, which
 * Rattatee shows. **Recorded rides** there is the reasoning.
 *
 * GET  /api/v1/rides?since=<ms>[&after=<id>]
 *
 *   { ready, rides: [ { id, meters, seconds, at, line } ], next }
 *
 *   The rides saved after a moment, oldest first, SINCE_PAGE at a time,
 *   `next` the { at, id } to ask the page after with, or null. The lines
 *   with no name on them, for tools/doors.mjs, which asks only for the rides
 *   it has not looked at — since() below.
 *
 * GET  /api/v1/rides?totals=1
 *
 *   { ready, user, totals: { rides, meters, seconds, stopped, top, fastest,
 *     longest, since } }
 *
 *   The account's riding added up, for Rattatee's My rides: one row read,
 *   by ride_totals' key — A RIDE IN NUMBERS. `top` in km/h and
 *   `fastest` in seconds, each null until a ride has one; `since` when the
 *   first was counted. `totals` is null signed out and before a ride has
 *   been counted. Never cached.
 *
 * GET  /api/v1/rides?bbox=…, ?mine=1, ?mine=1&lines=1, or nothing asked
 *
 *   { ready: false, user: null, rides: [] }
 *
 *   What the map app's rides near a way, its Your rides and its Where you
 *   rode, and the account page's Your rides card, asked for. Since
 *   2026-11-23 the answer a deployment without the table gives, reading
 *   nothing — NO LIST AND NO MAP OF RIDES.
 *
 *   One ride whole, to its rider, is GET /api/v1/rides/<id> in
 *   ./rides/[id].js, which Rattatee's ride page asks.
 *
 * POST /api/v1/rides  { action: 'save', name, seconds, line, summary }  a session
 * POST /api/v1/rides  { action: 'save', anon: true, … }                  nobody
 * POST /api/v1/rides  { action: 'rename', id, name }           its rider
 * POST /api/v1/rides  { action: 'drop', id }                   its rider
 *
 *   { ride: { id, meters, seconds } }     kept, with a session
 *   { counted: true }                     counted and not kept, with none;
 *                                         and a session's ride with no line
 *                                         to keep, whose numbers are kept
 *
 *   With a session the ride is filed under the account, its rider's to
 *   open, rename and drop, and `summary`, where the save carried one, is kept
 *   as its numbers and added to the account's totals — A RIDE IN NUMBERS.
 *   With `anon: true` and no session nothing of it is kept: its squares are
 *   counted and the answer has no `ride` — A RIDE WITHOUT AN ACCOUNT IS
 *   COUNTED, NOT KEPT — and `summary` is not read. That answer goes as soon
 *   as the ride has passed its checks, before the squares are written —
 *   ANSWERED BEFORE IT IS COUNTED.
 *
 *   `summary` is { meters, seconds, total, stopped, top, fastest, start,
 *   end } of the whole ride, worked out on the phone — ./_ridestats.js says
 *   what each is. With a session and a summary, `line` may be empty, or
 *   too short to keep once its ends are off, where the ride was ridden
 *   outside the four cities: no line is kept or counted, the numbers are,
 *   and the answer is `{ counted: true }`, there being no ride to name.
 *
 *   A point of `line` is [lat, lng], or [lat, lng, t, acc] — the seconds
 *   since the ride began and the fix's accuracy in metres — WHEN EACH POINT
 *   WAS PASSED, or [lat, lng, t, acc, alt] with its height above the sea in
 *   metres — HOW HIGH EACH POINT WAS.
 *
 *   `rename` answers { ride: { id, name } } and `drop` { ok: true }; both
 *   take a session and touch only a ride filed under it, and anything else
 *   is 404 not-found, the answer GET /api/v1/rides/<id> gives. A dropped ride
 *   is gone from under the Bike tab too, and from its account's totals.
 *
 *   A ride that was paused and went on somewhere else is kept as the runs
 *   that were ridden, a row each — A RIDE WITH A GAP IN IT — and the answer
 *   is the first run's id with the metres of them all.
 *
 *   Errors: 401 signed-out (no session and no `anon`), 400 malformed, 400
 *   short (under MIN_METERS once the ends are off), 400 fast (an average no
 *   bike rides at), 429 often (an account's DAY_RIDES today already), 503
 *   not-ready, which a save with no session is never told. No word is new:
 *   an installed app has a sentence, or a rule, for each.
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
 * row in `rides`, and the answer is `counted: true` with no `ride` in it,
 * since there is none to name: Rattatee marks a ride saved on any 2xx, and
 * asks for the kept ride only where it was given an id. tools/doors.mjs
 * never reads such a ride.
 *
 * It has to say `anon`. A recorder that asks for a sign-in first — the map
 * app's — is making a ride one of Your rides, and one whose session ran
 * out mid-ride should be told `signed-out` and offer the sheet rather than
 * have the ride counted and gone. A session, where there is one, wins over
 * the flag, and that ride is kept exactly as it always was.
 *
 * ANSWERED BEFORE IT IS COUNTED
 *
 * Until 2026-11-23 such a save was answered once its squares were written,
 * and one whose write failed was told `not-ready`, so the phone kept the
 * ride and sent it again later. The owner's point, that day: the ride is
 * saved on the rider's phone either way, so nothing of theirs hangs on the
 * count, and the phone need not wait for it. So the ride is checked as it
 * always was — malformed, short and fast are still told, since the app
 * lists such a ride as not kept — and the moment it passes it is answered
 * `counted: true`, and its squares are written after the answer has gone,
 * through waitUntil.
 *
 * What that buys is an answer that does not wait on the database, which
 * narrows the moment in which an answer can be lost and the ride sent, and
 * counted, twice. What it gives up is the second try: a count that fails —
 * the database busy or past its day's writes, `ride_sections` not there,
 * the thirty seconds waitUntil is given run out — is a ride the squares
 * never hear of, and the phone, told yes, does not send it again. One ride
 * among a street's fifty is not a ride anybody misses. It is no saving of
 * work: the squares are worked out before the answer, as they were, and
 * only the write waits. A session's save is not answered this way: its row
 * in `rides` is the copy the account was made for, and it is written first.
 *
 * NOTHING IS REMEMBERED ABOUT IT, AND NOTHING CAPS IT
 *
 * For an hour on 2026-11-20 two small tables stood behind such a save, and
 * neither was ever loaded into production. `ride_nets` kept a fingerprint
 * of the network a ride came from with how many it had sent that day, and
 * refused the forty-first: what stood where an account's cap stands. And
 * `ride_seen` kept the id the phone gave the ride for a week, so that a
 * ride sent twice — the answer lost on the way back, and the phone trying
 * again — was counted once. The owner took both out the same day. Somebody
 * who rides a great deal with no account takes nothing from anybody: no
 * ride of theirs is kept and nothing is known of them, so there is nothing
 * a cap would be protecting them from, and forty a day was never a number
 * a person reaches. And a ride sent twice is a small chance and a small
 * harm, since a square forgets a little with every ride it counts — A
 * SQUARE TAKES FIFTY RIDES, THEN ONE IN TEN, AND FORGETS in ./_sections.js.
 * A site that says it keeps nothing of a ride should not be keeping a
 * fingerprint and an id to make sure of it.
 *
 * What that leaves open, said plainly. A program can send made-up rides
 * with no account for as long as it likes, each one checked — inside the
 * box, no faster than a bike, long enough, moving like one — and each one
 * counted. Enough of them along a street would make it look well ridden
 * until real rides outweighed them. Nothing here stops that. What would,
 * with no table and no code, is Cloudflare's own rate limiting: the free
 * plan has one rule, by address, over ten seconds, and it is the owner's
 * to switch on in the dashboard the day it is wanted. An account's cap,
 * DAY_RIDES, is unchanged, since an account's rides are kept and a loop
 * that kept twenty thousand of them would fill the table.
 *
 * And a ride whose answer was lost is done again: counted twice with no
 * account, kept as a second row with one. That was the known gap in
 * Rattatee's README before, and is again.
 *
 * So the save needs no SAVE_SALT now, and nothing of the request but its
 * body.
 *
 * WHAT IS CHECKED, AND WHAT CANNOT BE
 *
 * The length is worked out here from the points, never taken from the page.
 * Every point has to be inside one of the four cities' boxes — nearCity()
 * in ./_lib.js, Tallinn, Tartu, Pärnu and Narva — a line has at most
 * MAX_POINTS of them, and an average faster than FASTEST is a car or a
 * train, not a bike, and is refused. Past that a browser's location is
 * whatever the browser says it is, the same as a walk's check-in — see IT
 * CAN BE FAKED in ./walk.js. A ride is drawn nowhere; a faked one weighs
 * a little on the squares it crosses — WHAT THE RIDE SAYS ABOUT THE STREETS.
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
 * NO LIST AND NO MAP OF RIDES
 *
 * Until 2026-11-23 a kept ride was also filed under the squares of the city
 * its line passed through, in `ride_cells`, so ?bbox= could answer the
 * rides near a way by a key; and ?mine=1 answered somebody's own, up to
 * two hundred rows a look, for the account page's Your rides card and the
 * map app's. That day the owner took the bike stats off the website, for
 * what they read — the rides near a way alone came to about fifteen hundred
 * rows a day — and kept what Rattatee asks for: a save, ?totals=1, a ride's
 * own page and the bike route the rides steer. Rattatee lists the rides on
 * its own phone and asks the site for neither.
 *
 * So ?bbox=, ?mine=1 and the bare address answer `ready: false` and no
 * rides, which every installed map app already reads as a deployment
 * without the table, and read nothing — not even the session. Nothing
 * files a ride under `ride_cells` now, and the owner dropped the table the
 * same day. `rename` and `drop` stay: each reads a row or two by a key, only
 * when somebody asks, and a drop is the one way to take a single ride off
 * the site.
 *
 * WHAT THE RIDE SAYS ABOUT THE STREETS
 *
 * Each run's squares are added to `ride_sections` — ./_sections.js, which
 * says what is counted and why, and which a bike route in ./route.js is
 * weighed by. Not every square takes every ride: one that has counted
 * fifty takes one ride in ten, and from there forgets a little of what it
 * held with each. For a ride that is kept this comes after its rows are
 * in, and the ride is kept whether or not it works. For a ride that is
 * only counted it is all there is, and it comes after the answer: where
 * it does not work the ride goes uncounted, and nobody is told —
 * ANSWERED BEFORE IT IS COUNTED.
 *
 * A RIDE IN NUMBERS
 *
 * The line kept here is not the ride: its ends are off and so is anything
 * ridden outside the four cities. What a rider wants to know of their own
 * riding — how far, how long, how fast, how long standing — is the whole
 * ride's, so since 2026-11-22 Rattatee sends it worked out, as `summary`,
 * and a signed-in save keeps it as a row of `ride_stats` under the ride's
 * first run and adds it to the account's row of `ride_totals`, which
 * ?totals=1 answers. A save with no summary has its numbers worked out of
 * the line it kept. Each kept run's `seconds` is its share of the whole
 * ride's distance where there is a summary — of the kept line's where there
 * is none — so a ride to Keila does not leave its in-town runs with the
 * whole day's time on them and an average of four kilometres an hour.
 * ./_ridestats.js is the whole of it: what each number is, what is checked,
 * and what it costs.
 *
 * WHEN THE TABLE IS NOT THERE
 *
 * `rides` is in db/schema.sql and loaded by hand. Until it is, ?since=
 * answers `ready: false` and the Bike tab draws its way exactly as it did;
 * a session's save answers 503 `not-ready` and the phone keeps the ride to
 * try again. `ride_sections` is loaded the same way. A kept ride's save
 * catches it: the ride is kept, uncounted. A counted ride needs
 * `ride_sections` and goes uncounted without it, answered yes all the same.
 * Without `ride_stats` and `ride_totals` a ride is kept and its numbers are
 * not, `totals` is null, and a save that had only numbers to keep is
 * `not-ready`.
 */

import { json, sessionUser, wrongDatabase, nearCity, km, randomHex } from './_lib.js';
import { countUse } from './_visitors.js';
import { pieces, sectionsOf, tally } from './_sections.js';
import { arrayOf } from './_rides.js';
import { summaryOf, summaryFromRuns, statsStatements, totalsOf, dropStatements, statsReady } from './_ridestats.js';

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

/* The longest name, the same sixty a list's title gets. Restated as
   `longestName` in Rattatee/Core/Store.swift, whose field stops there. */
const MAX_NAME = 60;

/* How many rides a page of ?since= answers. Fewer than PAGE in ./_lib.js
   because each carries its whole line, which is a few hundred points. */
const SINCE_PAGE = 20;

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

export async function onRequestGet(context) {
  const query = new URL(context.request.url).searchParams;
  if (query.has('since')) return json(...await since(context.env, query.get('since'), query.get('after')));
  if (query.get('totals') === '1') return json(await totals(context), 200);
  /* NO LIST AND NO MAP OF RIDES: whatever else is asked. */
  return json({ ready: false, user: null, rides: [] }, 200);
}

/* The rides saved after a moment — GET ?since=<ms>[&after=<id>] — oldest
   first, a page of SINCE_PAGE, answered as [body, status, maxAge] for
   json(). Each ride's line, metres and seconds, with `at` beside them and
   no name, and `next` the cursor of the page after this one, or null on
   the last: ask again with since=next.at and after=next.id. It is for
   tools/doors.mjs, which keeps when it last looked
   and asks for nothing older — A RIDE IS LOOKED AT ONCE there.

   WHAT IT COSTS: a range on idx_rides_created (created_at, id) in
   db/schema.sql, so a page reads the rides it answers and one more row,
   however many rides the table holds; one asked with nothing newer reads
   one row. Asked by hand now and then — a run of the tool — and never by a
   page or an app, so the day's worst is a run or two: a few dozen rows. */
async function since(env, rawSince, rawAfter) {
  const at = Number(rawSince);
  const after = typeof rawAfter === 'string' && /^[0-9a-f]{12}$/.test(rawAfter) ? rawAfter : '';
  if (!Number.isInteger(at) || at < 0) return [{ error: 'malformed' }, 400];
  if (!env.DB || await wrongDatabase(env)) return [{ ready: false, rides: [], next: null }, 200];
  try {
    const { results } = await env.DB
      .prepare(
        'SELECT id, meters, seconds, line, created_at AS at FROM rides ' +
        'WHERE (created_at, id) > (?, ?) ORDER BY created_at, id LIMIT ?'
      )
      .bind(at, after, SINCE_PAGE + 1)
      .all();
    const page = results.slice(0, SINCE_PAGE);
    const rides = page.map((row) => ({
      id: row.id,
      meters: row.meters,
      seconds: row.seconds,
      at: row.at,
      line: arrayOf(row.line)
    }));
    const last = page[page.length - 1];
    const next = results.length > SINCE_PAGE ? { at: last.at, id: last.id } : null;
    return [{ ready: true, rides, next }, 200, 60];
  } catch (e) {
    return [{ ready: false, rides: [], next: null }, 200];
  }
}

/* The session's totals — GET ?totals=1. One row, by ride_totals' key. */
async function totals(context) {
  const { env, request } = context;
  if (!env.DB || await wrongDatabase(env)) return { ready: false, user: null, totals: null };
  const user = await sessionUser(request, env);
  if (!user) return { ready: true, user: null, totals: null };
  return { ready: true, user: user.username, totals: await totalsOf(env, user.id) };
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
  /* With its numbers, in one batch, so the totals never count a ride that
     is gone or lose one that is not — A RIDE IN NUMBERS. */
  const gone = env.DB.prepare('DELETE FROM rides WHERE id = ? AND user_id = ?').bind(id, user.id);
  const counted = await statsReady(env);
  const done = counted
    ? (await env.DB.batch([gone, ...dropStatements(env, user.id, id, Date.now())]))[0]
    : await gone.run();
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

  /* A session keeps the ride. `anon` and no session counts it and keeps
     nothing — A RIDE WITHOUT AN ACCOUNT IS COUNTED, NOT KEPT. Neither is a
     page whose session ran out. */
  if (!user && body.anon !== true) return json({ error: 'signed-out' }, 401);

  const ride = riddenOf(body, user);
  if (ride.error) return json({ error: ride.error }, 400);

  /* ANSWERED BEFORE IT IS COUNTED: a ride with no account has passed every
     check there is, so it is answered now and counted after the answer, and
     a count that fails is that ride uncounted and nothing more. It is
     counted as a use where it was answered, not where the squares took it. */
  if (!user) {
    context.waitUntil(count(env, ride).catch(() => {}));
    return countUse(context, 'map', 'ride_save', json({ counted: true }, 200), user);
  }

  try {
    return await countUse(context, 'map', 'ride_save', keep(env, user, body, ride), user);
  } catch (e) {
    return json({ error: 'not-ready' }, 503);
  }
}

/* What of a save was ridden: the runs, each without its ends and with its
   track where every point carried one, the metres of them all, the seconds
   the rider said and, with a session, the ride's numbers — or the word it
   is refused with. Nothing here reads the database.

   A session's save with numbers may bring an empty line, or one too short
   to keep: a ride ridden outside the four cities, whose numbers are kept
   and nothing else — A RIDE IN NUMBERS. It is still held to the shortest
   ride the recorders save, MIN_METERS and ENDS twice. */
function riddenOf(body, user) {
  const nowhere = user && Array.isArray(body.line) && body.line.length === 0;
  const points = nowhere ? [] : cleanLine(body.line);
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
  /* The speed is judged on the whole of what was ridden, ends included,
     since the seconds are the whole ride's — and on nothing that was not:
     the step across a gap is not in it. */
  const rode = ridden.reduce((sum, run) => sum + lengthOf(run), 0);
  if (rode / 1000 / (seconds / 3600) > FASTEST) return { error: 'fast' };
  const meters = runs.reduce((sum, run) => sum + run.meters, 0);
  const summary = user ? summaryOf(body.summary, meters, FASTEST) : null;
  if (!runs.length && !(summary && summary.meters >= MIN_METERS + 2 * ENDS)) {
    return { error: nowhere && !summary ? 'malformed' : 'short' };
  }
  return { runs, seconds, meters, summary };
}

/* A ride with no account behind it: counted, and not kept, after its answer
   has gone — ANSWERED BEFORE IT IS COUNTED. Its runs go in one batch, so the
   ride is counted whole or not at all, and it throws where the batch does,
   which its caller lets go. Which rides a full square takes is drawn here,
   a ride having no row to read it off.
   Under `wrangler dev` on 2026-11-20 a ride of four kilometres read 161
   rows and wrote 323 down a street nobody had ridden, read 320 and wrote
   162 down one ridden a few times, and down one whose squares were full
   read 320 and wrote about ten, nine saves in ten, and 162 the tenth. */
async function count(env, ride) {
  const counts = ride.runs.map((run) => tally(env, sectionsOf(run.line, run.track), randomHex(6))).filter(Boolean);
  if (counts.length) await env.DB.batch(counts);
}

/* A ride with an account behind it: kept and counted, and its
   numbers added to the account's — or, with no line long enough to keep,
   its numbers alone. */
async function keep(env, user, body, ride) {
  const { runs, meters, seconds, summary } = ride;
  if (!runs.length) {
    await env.DB.batch(statsStatements(env, user.id, randomHex(6), Date.now(), summary));
    return json({ counted: true }, 200);
  }
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  const sent = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM rides WHERE user_id = ? AND created_at >= ?')
    .bind(user.id, day.getTime())
    .first();
  if (sent && sent.n >= DAY_RIDES) return json({ error: 'often' }, 429);

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, MAX_NAME) : '';
  const now = Date.now();
  /* Each run's share of the time is its share of the whole ride's length,
     which the summary knows and the kept line does not. */
  const whole = summary ? summary.meters : meters;
  const rows = runs.map((run, i) => {
    const lats = run.line.map((p) => p[0]);
    const lngs = run.line.map((p) => p[1]);
    return [
      randomHex(6), user.id, name, run.meters,
      Math.max(1, Math.round(seconds * run.meters / whole)), JSON.stringify(run.line),
      Math.min(...lats), Math.min(...lngs), Math.max(...lats), Math.max(...lngs),
      /* A millisecond apart, so ?since= answers the runs in the order they
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
  /* WHAT THE RIDE SAYS ABOUT THE STREETS, each run under its own row's id.
     Not there yet, or failed: the ride is kept, uncounted. */
  try {
    const counts = runs.map((run, i) => tally(env, sectionsOf(run.line, run.track), rows[i][0])).filter(Boolean);
    if (counts.length) await env.DB.batch(counts);
  } catch (e) { /* No ride_sections yet, or none with `steady`. */ }
  /* A RIDE IN NUMBERS, under the first run's id, which a drop of that run
     takes off again. Not there yet, or failed: the ride is kept, and the
     totals go without it. */
  try {
    await env.DB.batch(statsStatements(env, user.id, rows[0][0], now, summary || summaryFromRuns(runs, seconds, FASTEST)));
  } catch (e) { /* No ride_stats or ride_totals yet. */ }
  return json({ ride: { id: rows[0][0], meters, seconds } }, 200);
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
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !nearCity(lat, lng)) return null;
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
