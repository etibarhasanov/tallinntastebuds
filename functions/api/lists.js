/**
 * Tallinn Tastebuds — the lists.
 *
 * The map is mine. A list is somebody else's: a name they chose, places they
 * picked out of data/places.json, and a sentence about each one. "Top ten
 * burgers." "Where to take your parents." It carries their username and it
 * has a link they can send to a friend.
 *
 * WHY THIS ONE NEEDS AN ACCOUNT WHEN A SAVE DOES NOT
 *
 * A save is anonymous on purpose. It has to work in the first ten seconds,
 * before anybody has decided anything about this site, so it is filed under a
 * random id the browser made for itself and no name is ever asked for.
 *
 * A list is the opposite kind of object. It is published: it has a title
 * somebody wrote, it says things about restaurants in their words, and the
 * whole point is a URL they hand to somebody else. That needs a byline, and
 * it needs to survive a cleared browser — a device-owned list would be one
 * Safari sweep away from a stranger's link going nowhere. So the one thing
 * you must have before you can make a list is an account, and making one is
 * two fields and no email. See functions/api/account.js.
 *
 * WHAT THIS FILE IS ALLOWED TO DO
 *
 * The same rules the other two routes are written to, for the same reason:
 * D1 has no public endpoint, so the attack surface of the database is exactly
 * these three files.
 *
 *   - Every query is a prepared statement with bound parameters. No value
 *     from a request is ever concatenated into SQL.
 *   - Every write is preceded by a read of `lists.owner` and refused unless
 *     it matches the session. There is no statement here that can touch a
 *     row without having proved whose it is.
 *   - A place id that is not in data/places.json is refused, so nobody can
 *     fill the table with rows for places that do not exist.
 *   - Everything a person types is capped in length before it is stored, so
 *     one list cannot become a megabyte of somebody's prose.
 *
 * NOTHING HERE IS CACHED
 *
 * Deliberately, and it is the one place this codebase does not reach for the
 * edge. A public list is read by strangers, which argues for a cache; it is
 * also read by its owner in the middle of writing it, which argues against
 * one, and losing an edit behind a thirty-second TTL would be the feature
 * feeling broken at the exact moment somebody is using it. A list read is a
 * handful of rows on an indexed key. It can afford to be true.
 */

import { json, sessionUser, catalogue, wrongDatabase } from './_lib.js';
/* Reading one list is shared with functions/list/[id].js, which serves the
   page a link opens with the list already in it. */
import { readList, LIST_ID } from './_lists.js';

/* Caps. Every one of them is about somebody with a script rather than
   somebody with opinions: twenty-four lists is more than anybody keeps, a
   hundred places is ten times a top ten, and the lengths below are what fits
   in the space the page draws for them. */
const MAX_LISTS = 24;
const MAX_ITEMS = 100;
const MAX_TITLE = 60;
const MAX_INTRO = 200;
const MAX_SAY = 280;

/* The share code's random half. No vowels, so it cannot spell anything; no
   0/o/1/l, so it survives being read off a phone screen and typed. */
const CODE_ALPHABET = '23456789bcdfghjkmnpqrstvwxyz';
const CODE_LENGTH = 6;

function code() {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/* The readable half. A list called "Top ten burgers" gets
   /list/top-ten-burgers-k3fmqw, so a link says what it is before anybody
   opens it — which is most of what makes one worth sending.

   The random half is what makes it unguessable. A slug on its own would let
   anybody walk the private lists by trying titles. */
function slugOf(title) {
  const s = String(title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/g, '');
  /* A title with no Latin letters in it at all — and there will be some, the
     site is read in ten languages — leaves the code standing on its own. */
  return s || 'list';
}

/* Trim, cap, and flatten the newlines somebody's phone keyboard put in. One
   place does this so no field can be stored longer than the page can draw. */
function words(value, max) {
  return String(typeof value === 'string' ? value : '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/* ------------------------------------------------------------------- read
 * GET /api/lists            the signed-in person's own lists
 * GET /api/lists?id=<id>    one list, for anybody holding the link
 */
export async function onRequestGet(context) {
  const { request, env } = context;

  /* Same three conditions the account route reports, and reported for the
     same reason: the page hides the whole feature until this says yes, rather
     than offering a "new list" button that could only fail. */
  const ready = !!(env.DB && env.SAVE_SALT) && !(await wrongDatabase(env));
  if (!ready) return json({ ready: false, user: null, lists: [] }, 200);

  const id = new URL(request.url).searchParams.get('id') || '';
  const user = await sessionUser(request, env);

  if (id) {
    if (!LIST_ID.test(id)) return json({ error: 'not-found' }, 404);
    const list = await readList(context, id, user);
    if (!list) return json({ error: 'not-found' }, 404);
    return json({ ready: true, user: user ? user.username : null, list: list }, 200);
  }

  if (!user) return json({ ready: true, user: null, lists: [] }, 200);

  /* The index: every list this account holds, newest edit first, each with
     how many places are on it. One row per list however long the lists are —
     the count comes out of the join rather than out of a second round of
     queries, one per list. */
  const { results } = await env.DB
    .prepare(
      'SELECT l.id AS id, l.title AS title, l.intro AS intro, l.public AS public, ' +
      'l.updated_at AS updated_at, COUNT(i.place_id) AS n ' +
      'FROM lists l LEFT JOIN list_items i ON i.list_id = l.id ' +
      'WHERE l.owner = ? GROUP BY l.id ORDER BY l.updated_at DESC'
    )
    .bind(user.id)
    .all();

  return json({
    ready: true,
    user: user.username,
    lists: results.map((r) => ({
      id: r.id,
      title: r.title,
      intro: r.intro,
      public: !!r.public,
      updated: r.updated_at,
      n: r.n
    }))
  }, 200);
}

/* ------------------------------------------------------------------ write
 * Everything below needs a session, and everything that names a list proves
 * that list is the session's before it writes.
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DB) return json({ error: 'no-database' }, 503);
  /* A preview deployment holding the live database, or the reverse. A list
     made while checking a change must not be a list on the live site. */
  if (await wrongDatabase(env)) return json({ error: 'wrong-database' }, 503);
  if (!env.SAVE_SALT) return json({ error: 'no-salt' }, 503);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'malformed' }, 400);
  }

  const user = await sessionUser(request, env);
  if (!user) return json({ error: 'signed-out' }, 401);

  const action = body.action;
  if (action === 'create') return create(context, body, user);

  /* Everything else acts on a list that already exists, so it is the same
     two lines every time: is that a list id at all, and is it yours. */
  const id = typeof body.id === 'string' ? body.id : '';
  if (!LIST_ID.test(id)) return json({ error: 'not-found' }, 404);

  const owner = await env.DB.prepare('SELECT owner FROM lists WHERE id = ?').bind(id).first();
  /* Somebody else's list and a list that does not exist get the same answer.
     Anything else would make this a way of asking which codes are taken. */
  if (!owner || owner.owner !== user.id) return json({ error: 'not-found' }, 404);

  if (action === 'edit')   return edit(context, body, id);
  if (action === 'delete') return remove(context, id);
  if (action === 'add')    return add(context, body, id);
  if (action === 'say')    return say(context, body, id);
  if (action === 'drop')   return drop(context, body, id);
  if (action === 'order')  return order(context, body, id);

  return json({ error: 'action' }, 400);
}

/* A list starts with a name and nothing else. Places are added afterwards,
   one at a time, because that is the order somebody actually does it in —
   they know it is "top ten burgers" before they know which ten. */
async function create(context, body, user) {
  const { env } = context;

  const title = words(body.title, MAX_TITLE);
  if (!title) return json({ error: 'title' }, 400);

  const held = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM lists WHERE owner = ?')
    .bind(user.id)
    .first();
  if (held && held.n >= MAX_LISTS) return json({ error: 'too-many' }, 429);

  /* The code is six characters out of an alphabet of twenty-eight, which is
     a collision every few hundred million lists on the same slug. The loop is
     not for that: it is for the primary key being the only thing in this
     codebase allowed to decide what is unique. */
  const now = Date.now();
  const stem = slugOf(title);
  for (let tries = 0; tries < 5; tries++) {
    const id = stem + '-' + code();
    try {
      await env.DB
        .prepare(
          'INSERT INTO lists (id, owner, title, intro, public, created_at, updated_at) ' +
          'VALUES (?, ?, ?, ?, 1, ?, ?)'
        )
        .bind(id, user.id, title, words(body.intro, MAX_INTRO), now, now)
        .run();
      return json({ id: id, title: title }, 200);
    } catch (e) {
      /* Taken. Round again with a different code. */
    }
  }
  return json({ error: 'busy' }, 503);
}

/* The title, the line under it, and whether the link works for anybody but
   its owner. Each is only changed when it was actually sent, so the page can
   flip one switch without having to resend the other two. */
async function edit(context, body, id) {
  const { env } = context;

  const sets = [];
  const binds = [];

  if (typeof body.title === 'string') {
    const title = words(body.title, MAX_TITLE);
    if (!title) return json({ error: 'title' }, 400);
    sets.push('title = ?');
    binds.push(title);
  }
  if (typeof body.intro === 'string') {
    sets.push('intro = ?');
    binds.push(words(body.intro, MAX_INTRO));
  }
  if (typeof body.public === 'boolean') {
    sets.push('public = ?');
    binds.push(body.public ? 1 : 0);
  }
  if (!sets.length) return json({ error: 'action' }, 400);

  /* The column names are literals from the three branches above and never a
     value out of the request; only the bindings carry anything anybody typed. */
  sets.push('updated_at = ?');
  binds.push(Date.now(), id);

  await env.DB.prepare('UPDATE lists SET ' + sets.join(', ') + ' WHERE id = ?').bind(...binds).run();
  return json({ ok: true }, 200);
}

async function remove(context, id) {
  const { env } = context;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM list_items WHERE list_id = ?').bind(id),
    env.DB.prepare('DELETE FROM lists WHERE id = ?').bind(id)
  ]);
  return json({ deleted: id }, 200);
}

/* A place goes on the end, which is where somebody adding one expects it.
   Ordering it into a top ten is a separate move — see order() — because those
   are two different jobs and doing them at once would mean choosing a
   position for a place before you have seen it in the list. */
async function add(context, body, id) {
  const { env } = context;

  const place = typeof body.place === 'string' ? body.place : '';

  let roll;
  try {
    roll = await catalogue(context);
  } catch (e) {
    return json({ error: 'places' }, 503);
  }
  /* Nowhere real. The same refusal /api/saves gives, and for the same reason:
     nothing gets to put a row in here for a place that does not exist. */
  const known = roll.get(place);
  if (!known) return json({ error: 'place' }, 400);

  const held = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM list_items WHERE list_id = ?')
    .bind(id)
    .first();
  /* The place may already be on the list, in which case this is not a new row
     at all and the cap should not stop the note being written. Checked here
     rather than after the insert, because the insert's conflict clause is
     silent by design. */
  if (held && held.n >= MAX_ITEMS) {
    const already = await env.DB
      .prepare('SELECT 1 AS x FROM list_items WHERE list_id = ? AND place_id = ?')
      .bind(id, place)
      .first();
    if (!already) return json({ error: 'full' }, 429);
  }

  const now = Date.now();
  await env.DB.batch([
    env.DB
      .prepare(
        'INSERT INTO list_items (list_id, place_id, name, say, pos, created_at) ' +
        'VALUES (?, ?, ?, ?, ' +
        '(SELECT COALESCE(MAX(pos), -1) + 1 FROM list_items WHERE list_id = ?), ?) ' +
        'ON CONFLICT DO NOTHING'
      )
      .bind(id, place, known.name, words(body.say, MAX_SAY), id, now),
    env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ?').bind(now, id)
  ]);

  return json({ place: place, name: known.name }, 200);
}

/* What they have to say about one place. The point of the whole feature: a
   list of names is a search result, and a list of names with a line each is
   somebody telling you where to go. */
async function say(context, body, id) {
  const { env } = context;
  const place = typeof body.place === 'string' ? body.place : '';
  if (!place) return json({ error: 'place' }, 400);

  const now = Date.now();
  await env.DB.batch([
    env.DB
      .prepare('UPDATE list_items SET say = ? WHERE list_id = ? AND place_id = ?')
      .bind(words(body.say, MAX_SAY), id, place),
    env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ?').bind(now, id)
  ]);
  return json({ place: place }, 200);
}

async function drop(context, body, id) {
  const { env } = context;
  const place = typeof body.place === 'string' ? body.place : '';
  if (!place) return json({ error: 'place' }, 400);

  const now = Date.now();
  await env.DB.batch([
    env.DB
      .prepare('DELETE FROM list_items WHERE list_id = ? AND place_id = ?')
      .bind(id, place),
    env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ?').bind(now, id)
  ]);
  return json({ dropped: place }, 200);
}

/* The order the list is read in, sent whole rather than as a move.
 *
 * Whole, because the page already knows the order it is showing and a
 * one-move message ("this one, up two") is a message that can arrive after
 * another one and leave the list in an order nobody asked for. The array is
 * the truth and the rows are made to match it.
 *
 * The rows are read back first rather than trusted from the array, for two
 * reasons. A place added on another phone between the drag and the save is
 * not in the array, and must not be silently pushed to a position some named
 * row also holds — so what the array does not name is appended, in the order
 * it already had, rather than left where it was. And every row is then given
 * an explicit position from zero, so `pos` cannot drift upwards over a
 * hundred reorders of the same list.
 *
 * A list is capped at a hundred places, so this is one small read and at most
 * a hundred and one statements in one batch.
 */
async function order(context, body, id) {
  const { env } = context;

  const asked = Array.isArray(body.places) ? body.places : null;
  if (!asked || asked.length > MAX_ITEMS) return json({ error: 'order' }, 400);

  const { results } = await env.DB
    .prepare('SELECT place_id FROM list_items WHERE list_id = ? ORDER BY pos')
    .bind(id)
    .all();

  const held = new Set(results.map((r) => r.place_id));
  const final = [];
  const placed = new Set();

  /* What the page asked for, minus anything it named that is not on the list
     — a row dropped elsewhere since the page loaded. */
  for (const place of asked) {
    if (typeof place !== 'string' || placed.has(place) || !held.has(place)) continue;
    placed.add(place);
    final.push(place);
  }
  /* Then whatever the page had not heard about, in the order it already had. */
  for (const row of results) {
    if (placed.has(row.place_id)) continue;
    placed.add(row.place_id);
    final.push(row.place_id);
  }

  const now = Date.now();
  const statements = final.map((place, i) =>
    env.DB
      .prepare('UPDATE list_items SET pos = ? WHERE list_id = ? AND place_id = ?')
      .bind(i, id, place)
  );
  statements.push(env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ?').bind(now, id));

  await env.DB.batch(statements);
  return json({ places: final }, 200);
}
