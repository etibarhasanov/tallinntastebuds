/**
 * Tallinn Tastebuds — walking a list.
 *
 * A list is a set of places, and the question about a set of places is
 * whether you have been to them. This is that, as a game: a member starts a
 * walk on any list they can read, goes to each place, presses Check in while
 * standing there, and is finished when every place on the list is checked.
 * It may take an afternoon or a month. Nothing is bought and nobody at the
 * place is asked anything.
 *
 * GET  /api/walk?list=<id>
 *
 *   { ready, user, admin, radius,
 *     walk:   null | { started, finished, mode, note, order: [place, …] },
 *     checks: [ { place, at, note } ],          the reader's own
 *     board:  [ { name, started, finished, mode, note } ]
 *                                               everybody who finished, fastest first
 *     notes:  [ { place, name, note, at } ] }   everybody's comments, newest first
 *
 *   Open to anybody who can read the list: the board and the comments are
 *   public, the way the list is. `walk` and `checks` are the session's own
 *   and empty without one. `ready: false` is a database that has not had
 *   the two tables applied yet, and the page then draws the route and no
 *   way to start — see WHEN THE TABLES ARE NOT THERE.
 *
 * POST /api/walk   { action, list, … }      a session, every one
 *
 *   start   { order?, mode? }    begins the walk; pressing it twice is one walk
 *   mode    { mode }             `foot` or `bike`, until it is finished
 *   check   { lat, lng }         checks the nearest unchecked place, if it is
 *                                within RADIUS metres; 409 `far` otherwise,
 *                                with the place and how far it is
 *   note    { place, note }      a comment on a place the session has checked,
 *                                or with place '' on the whole of a finished
 *                                walk; '' takes it away
 *   order   { order }            the member's own order; [] is the shortest again
 *   again   {}                   throws the walk away — its checks, their
 *                                comments, its time on the board — so that
 *                                Start begins a new one
 *   unnote  { place, name }      the owner of the site taking down somebody's
 *                                comment, and nobody else
 *
 *   Each answers what GET does, so the page redraws from one shape.
 *
 * WHERE YOU ARE IS READ AND FORGOTTEN
 *
 * A check sends the phone's coordinates, and this compares them with the
 * coordinates of the places left and stores which place and when. The
 * coordinates themselves are in no table, no log line and no count — the
 * same promise /api/route makes, kept the same way. What is stored is what
 * the board then shows: that this account stood at this door at this time.
 *
 * IT CAN BE FAKED, AND THAT IS ACCEPTED
 *
 * A browser's location is whatever the browser says it is. Nothing here can
 * tell a person on Telliskivi from a person with developer tools open, and
 * nothing here pretends to. The prize for finishing is the owner's to hand
 * out by hand and is not in this code, which is where a judgement about
 * whether somebody really walked it belongs.
 *
 * ON FOOT OR BY BIKE
 *
 * A walk is not only walked. The mode is the walker's to say, `foot` unless
 * they say `bike`, and it changes two things: the time the page estimates,
 * and the word beside their name on the board, since an hour by bike and an
 * hour on foot are not the same hour. It is taken on trust like everything
 * else here, and it can be changed until the walk is finished and not after.
 *
 * THE ORDER IS A SUGGESTION
 *
 * The page works out the shortest order in the browser and a member may
 * drag it into their own; that order is stored here so it follows them to
 * another phone. A check ignores it entirely: whichever unchecked place is
 * nearest is the one that is checked, so the places can be walked in any
 * order at all.
 *
 * FINISHED IS DECIDED AT THE CHECK
 *
 * A walk is finished at the moment a check leaves no place with a location
 * unchecked, and stays finished: a place its author adds to the list a week
 * later does not take anybody's name off the board. A place with no
 * location — a row the catalogue has lost — cannot be stood at and is not
 * counted either way.
 *
 * STARTING AGAIN THROWS THE FIRST ONE AWAY
 *
 * There is one walk per person per list, so starting again is not a second
 * row: it deletes the first, with every check and comment on it, and the
 * name comes off the board until the new one is finished. Keeping the old
 * time while a new clock runs would be two walks under one key, and a board
 * that showed the better of them would be a board anybody could improve by
 * trying until it came out right. The page asks before it sends this.
 *
 * WHEN THE TABLES ARE NOT THERE
 *
 * db/schema.sql is applied by hand and there is always an afternoon between
 * the deploy and somebody running it. Until then GET answers `ready: false`
 * with empty rows and every POST is 503 `not-ready`; the list page is
 * untouched, because nothing in assets/ waits on this route.
 *
 * NOTHING HERE IS CACHED, for the reason nothing in ./lists.js is: `walk`
 * and `checks` are per person.
 */

import { json, sessionUser, wrongDatabase, nearTallinn, km } from './_lib.js';
import { readList, LIST_ID } from './_lists.js';
import { adminIds } from './_admin.js';
import { asUsername } from './_account.js';
import { countUse } from './_visitors.js';

/* How near a door counts as being at it, in metres. Wide enough for a phone
   between the stone walls of the Old Town, where a fix is off by thirty or
   forty, and narrow enough that the next street is not the same place.
   Restated as the page's own sentence through `radius` in the answer, so
   there is one number. */
const RADIUS = 75;

/* The longest comment, the same 280 a sentence on a list gets. Restated as
   MAX_NOTE in assets/walk.js, whose field is the only one that writes it. */
const MAX_NOTE = 280;

/* The most places an order may name — MAX_ITEMS in ./lists.js, which is the
   most a list holds. */
const MAX_ORDER = 50;

/* How many names the board carries and how many comments a list does. A
   list walked by more than fifty people is a problem worth having, and is
   the day this becomes a page of its own. */
const BOARD = 50;
const NOTES = 100;

/* The ways to go round — ON FOOT OR BY BIKE. The first is what a walk is
   unless somebody says otherwise. Restated as MODES in assets/walk.js. */
const MODES = ['foot', 'bike'];
const modeOf = (raw) => (MODES.includes(raw) ? raw : MODES[0]);

/* Everything the page draws, in one answer. `list` has been read through
   readList() by the caller, so a private list has already been refused. */
async function answer(env, list, user, extra) {
  const out = {
    ready: true,
    user: user ? user.username : null,
    admin: !!user && adminIds(env).has(String(user.id).toLowerCase()),
    radius: RADIUS,
    walk: null,
    checks: [],
    board: [],
    notes: [],
    ...extra
  };

  try {
    const board = await env.DB
      .prepare(
        'SELECT u.username AS name, w.started_at AS started, w.finished_at AS finished, ' +
        'w.mode AS mode, w.note AS note ' +
        'FROM walks w JOIN users u ON u.id = w.user_id ' +
        'WHERE w.list_id = ? AND w.finished_at IS NOT NULL ' +
        'ORDER BY (w.finished_at - w.started_at), w.finished_at LIMIT ?'
      )
      .bind(list.id, BOARD)
      .all();
    out.board = board.results;

    const notes = await env.DB
      .prepare(
        'SELECT c.place AS place, u.username AS name, c.note AS note, c.checked_at AS at ' +
        'FROM walk_checks c JOIN users u ON u.id = c.user_id ' +
        "WHERE c.list_id = ? AND c.note != '' ORDER BY c.checked_at DESC LIMIT ?"
      )
      .bind(list.id, NOTES)
      .all();
    out.notes = notes.results;

    if (user) {
      const walk = await env.DB
        .prepare('SELECT started_at, finished_at, route, mode, note FROM walks WHERE user_id = ? AND list_id = ?')
        .bind(user.id, list.id)
        .first();
      if (walk) {
        out.walk = {
          started: walk.started_at,
          finished: walk.finished_at,
          mode: modeOf(walk.mode),
          note: walk.note,
          order: orderOf(walk.route)
        };
        const checks = await env.DB
          .prepare(
            'SELECT place, checked_at AS at, note FROM walk_checks ' +
            'WHERE user_id = ? AND list_id = ? ORDER BY checked_at'
          )
          .bind(user.id, list.id)
          .all();
        out.checks = checks.results;
      }
    }
  } catch (e) {
    /* The tables are not applied here yet. The page draws the route and
       nothing to press — WHEN THE TABLES ARE NOT THERE. */
    return { ...out, ready: false, walk: null, checks: [], board: [], notes: [] };
  }
  return out;
}

/* The stored order as the array it was, or [] for anything else. */
function orderOf(text) {
  try {
    const order = JSON.parse(text || '[]');
    return Array.isArray(order) ? order.filter((p) => typeof p === 'string') : [];
  } catch (e) {
    return [];
  }
}

/* An order somebody sent, held to the places this list has: an id it does
   not hold is dropped rather than refused, since the list may have changed
   under the page that sent it. */
function cleanOrder(raw, list) {
  if (!Array.isArray(raw)) return [];
  const on = new Set(list.items.map((item) => item.place));
  const seen = new Set();
  return raw
    .slice(0, MAX_ORDER)
    .filter((p) => typeof p === 'string' && on.has(p) && !seen.has(p) && seen.add(p));
}

/* The places somebody can stand at. */
function doors(list) {
  return list.items.filter((item) => typeof item.lat === 'number' && typeof item.lng === 'number');
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const id = new URL(request.url).searchParams.get('list') || '';
  const empty = { ready: false, user: null, admin: false, radius: RADIUS, walk: null, checks: [], board: [], notes: [] };

  if (!env.DB || await wrongDatabase(env)) return json(empty, 200);

  const user = await sessionUser(request, env);
  const list = await readList(context, id, user);
  if (!list) return json({ error: 'not-found' }, 404);

  return json(await answer(env, list, user), 200);
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

  /* Readable by this session, which is the whole of who may walk it: a
     public list, or the session's own. */
  const list = await readList(context, typeof body.list === 'string' ? body.list : '', user);
  if (!list || !LIST_ID.test(list.id)) return json({ error: 'not-found' }, 404);

  const action = body.action;
  const run = { start, mode, check, note, order, again, unnote }[action];
  if (!run) return json({ error: 'malformed' }, 400);

  try {
    return await countUse(context, 'lists', 'walk_' + action, run(env, list, user, body), user);
  } catch (e) {
    return json({ error: 'not-ready' }, 503);
  }
}

/* Pressing Start twice is one walk, and the first press is the one the
   clock runs from. */
async function start(env, list, user, body) {
  await env.DB
    .prepare('INSERT OR IGNORE INTO walks (user_id, list_id, started_at, route, mode) VALUES (?, ?, ?, ?, ?)')
    .bind(user.id, list.id, Date.now(), JSON.stringify(cleanOrder(body.order, list)), modeOf(body.mode))
    .run();
  return json(await answer(env, list, user), 200);
}

/* Until it is finished and not after: the word on the board is how the
   time beside it was made. */
async function mode(env, list, user, body) {
  const done = await env.DB
    .prepare('UPDATE walks SET mode = ? WHERE user_id = ? AND list_id = ? AND finished_at IS NULL')
    .bind(modeOf(body.mode), user.id, list.id)
    .run();
  if (!done.meta.changes) return json({ error: 'not-started' }, 409);
  return json(await answer(env, list, user), 200);
}

async function check(env, list, user, body) {
  const here = { lat: Number(body.lat), lng: Number(body.lng) };
  if (!Number.isFinite(here.lat) || !Number.isFinite(here.lng)) return json({ error: 'malformed' }, 400);

  const walk = await env.DB
    .prepare('SELECT finished_at FROM walks WHERE user_id = ? AND list_id = ?')
    .bind(user.id, list.id)
    .first();
  if (!walk) return json({ error: 'not-started' }, 409);

  const { results } = await env.DB
    .prepare('SELECT place FROM walk_checks WHERE user_id = ? AND list_id = ?')
    .bind(user.id, list.id)
    .all();
  const done = new Set(results.map((r) => r.place));
  const left = doors(list).filter((item) => !done.has(item.place));
  if (!left.length) return json(await answer(env, list, user), 200);

  /* Somewhere that is not Tallinn is far from all of them, and is said so
     without a distance: "you are 1,900 km from Pudel" is a sentence about a
     VPN or a desk in another country, not about a walk. */
  let nearest = null;
  let metres = Infinity;
  if (nearTallinn(here.lat, here.lng)) {
    for (const item of left) {
      const d = km(here, item) * 1000;
      if (d < metres) { metres = d; nearest = item; }
    }
  }
  if (!nearest || metres > RADIUS) {
    return json({
      error: 'far',
      place: nearest ? nearest.place : null,
      meters: nearest ? Math.round(metres) : null
    }, 409);
  }

  const now = Date.now();
  const statements = [
    env.DB
      .prepare('INSERT OR IGNORE INTO walk_checks (user_id, list_id, place, checked_at) VALUES (?, ?, ?, ?)')
      .bind(user.id, list.id, nearest.place, now)
  ];
  /* The last one — FINISHED IS DECIDED AT THE CHECK. Only where it is not
     finished already, so the time on the board is the first time. */
  if (left.length === 1) {
    statements.push(env.DB
      .prepare('UPDATE walks SET finished_at = ? WHERE user_id = ? AND list_id = ? AND finished_at IS NULL')
      .bind(now, user.id, list.id));
  }
  await env.DB.batch(statements);

  return json(await answer(env, list, user, { checked: nearest.place }), 200);
}

/* A comment goes on a check, or on a walk that is finished, and nowhere
   else: either statement can only touch a row this session made by standing
   somewhere, so nobody comments on a place they have not been to, nobody
   sums up a walk they have not done, and nobody writes on somebody else's
   row. */
async function note(env, list, user, body) {
  const place = typeof body.place === 'string' ? body.place : '';
  const text = String(body.note || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE);
  const done = await (place
    ? env.DB
      .prepare('UPDATE walk_checks SET note = ? WHERE user_id = ? AND list_id = ? AND place = ?')
      .bind(text, user.id, list.id, place)
    : env.DB
      .prepare('UPDATE walks SET note = ? WHERE user_id = ? AND list_id = ? AND finished_at IS NOT NULL')
      .bind(text, user.id, list.id)
  ).run();
  if (!done.meta.changes) return json({ error: 'not-checked' }, 409);
  return json(await answer(env, list, user), 200);
}

async function order(env, list, user, body) {
  const done = await env.DB
    .prepare('UPDATE walks SET route = ? WHERE user_id = ? AND list_id = ?')
    .bind(JSON.stringify(cleanOrder(body.order, list)), user.id, list.id)
    .run();
  if (!done.meta.changes) return json({ error: 'not-started' }, 409);
  return json(await answer(env, list, user), 200);
}

/* STARTING AGAIN THROWS THE FIRST ONE AWAY. Both tables in one batch, so a
   walk is never left without its checks or checks without their walk. */
async function again(env, list, user) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM walk_checks WHERE user_id = ? AND list_id = ?').bind(user.id, list.id),
    env.DB.prepare('DELETE FROM walks WHERE user_id = ? AND list_id = ?').bind(user.id, list.id)
  ]);
  return json(await answer(env, list, user), 200);
}

/* The comments are public and written by anybody with an account, so
   somebody has to be able to take one down, and it is the owner of the
   site: ADMINS, the same list the pages under /admin/ are locked to. The
   check stays; only the words go. */
async function unnote(env, list, user, body) {
  if (!adminIds(env).has(String(user.id).toLowerCase())) return json({ error: 'not-found' }, 404);
  const place = typeof body.place === 'string' ? body.place : '';
  const whose = 'user_id = (SELECT id FROM users WHERE username = ?)';
  await (place
    ? env.DB
      .prepare("UPDATE walk_checks SET note = '' WHERE list_id = ? AND place = ? AND " + whose)
      .bind(list.id, place, asUsername(body.name))
    : env.DB
      .prepare("UPDATE walks SET note = '' WHERE list_id = ? AND " + whose)
      .bind(list.id, asUsername(body.name))
  ).run();
  return json(await answer(env, list, user), 200);
}
