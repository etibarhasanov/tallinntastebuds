/**
 * Tallinn Tastebuds — the lists.
 *
 * The map is mine. A list is somebody else's: a name they chose, places they
 * picked off the roll behind /api/places — my map and the Google export in
 * google_venues — and a sentence about each one. "Top ten burgers." "Where to
 * take your parents." It carries their username and it has a link they can
 * send to a friend.
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
 *   - Every write to a list is preceded by a read of `lists.owner` and
 *     refused unless it matches the session. There is no statement here that
 *     can touch somebody's list without having proved whose it is.
 *   - The one write that is deliberately not that is keeping one: a bookmark
 *     on somebody else's list is the whole point of the gesture, so it is
 *     routed above the ownership check and does its own narrower one — the
 *     list must exist and be public, the row it writes is keyed by the
 *     session's own user id, and it touches no column of the list itself.
 *     See keep().
 *   - A place id that is on none of the three rolls — data/places.json,
 *     google_venues, or the added_places somebody typed in — is refused, so
 *     nobody can fill the table with rows for places that do not exist. That
 *     check has been widened twice now and relaxed neither time.
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
 *
 * The keep and its count are in the same answer and under the same rule. The
 * count is the weaker case for freshness — nobody is harmed by a bookmark
 * total a minute behind — but whether *you* kept this list is not: a mark
 * that draws itself empty on a list you kept last week, because a cached
 * response was made for somebody else, is the feature lying about your own
 * collection. A private list is served only to the session that owns it for
 * exactly the same reason.
 */

import { json, sessionUser, catalogue, venuesByIds, addedByIds, isAdded, wrongDatabase } from './_lib.js';
/* Reading one list is shared with functions/list/[id].js, which serves the
   page a link opens with the list already in it. */
import { readList, LIST_ID } from './_lists.js';

/* Caps. Most of them are about somebody with a script rather than somebody
   with opinions — twenty-four lists is more than anybody keeps, and the
   lengths below are what fits in the space the page draws for them.

   The places cap is the one exception, and it is a judgement about the
   feature rather than a defence of the database. Twenty is twice a top ten:
   room to overshoot and cut back, and short enough that the list still reads
   as a recommendation somebody stands behind rather than everywhere they have
   ever been. A list nobody finishes reading recommends nothing. */
const MAX_LISTS = 24;
const MAX_ITEMS = 20;
/* How many of other people's lists one account can keep. Higher than the
   twenty-four you can make, because keeping is the cheap half of this feature
   — it is a bookmark, and a bookmark drawer is allowed to be a drawer — and
   because nothing here is published under your name, so there is nobody for a
   long collection to be noise to. Like every other number in this block it is
   a cap on somebody with a script rather than on somebody with opinions. */
const MAX_KEPT = 200;
/* How many places one account can add by hand. Generous, because the whole
   point is that the catalogue is missing things and nobody should hit a wall
   while building one list — and finite, because this is the one table on the
   site where a stranger types a name that other people then read. */
const MAX_ADDED = 100;
const MAX_NAME = 80;
const MAX_ADDRESS = 120;
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

/* An id for a place somebody added by hand: "new_" and ten random characters.
   The prefix is what a person reads in a database row; isAdded() in _lib.js is
   the test the code trusts, and the note there says why it is a shape rather
   than a prefix. */
const ADDED_LENGTH = 10;

function addedId() {
  const bytes = new Uint8Array(ADDED_LENGTH);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < ADDED_LENGTH; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return 'new_' + out;
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

  const params = new URL(request.url).searchParams;
  const id = params.get('id') || '';
  const user = await sessionUser(request, env);

  /* The picker asking for the places this account added by hand, so they can
     go on a second list without being typed again. Only ever your own: a name
     a stranger typed does not turn up in anybody else's search results. */
  if (params.get('added')) {
    if (!user) return json({ ready: true, user: null, added: [] }, 200);
    const mine = await env.DB
      .prepare(
        'SELECT id, name, address, lat, lng FROM added_places ' +
        'WHERE owner = ? ORDER BY created_at DESC'
      )
      .bind(user.id)
      .all();
    return json({ ready: true, user: user.username, added: mine.results }, 200);
  }

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
     queries, one per list.

     The keeps are a scalar subquery rather than a second join: two aggregates
     over two different tables in one GROUP BY multiply each other, and a list
     of ten places kept by three people would report thirty of each. At
     twenty-four lists it is twenty-four counts on an indexed prefix. */
  const { results } = await env.DB
    .prepare(
      'SELECT l.id AS id, l.title AS title, l.intro AS intro, l.public AS public, ' +
      'l.updated_at AS updated_at, COUNT(i.place_id) AS n, ' +
      '(SELECT COUNT(*) FROM list_keeps k WHERE k.list_id = l.id) AS keeps ' +
      'FROM lists l LEFT JOIN list_items i ON i.list_id = l.id ' +
      'WHERE l.owner = ? GROUP BY l.id ORDER BY l.updated_at DESC'
    )
    .bind(user.id)
    .all();

  /* And the other half of the page: the lists this account has kept, which
     are somebody else's. Newest keep first — the order you pressed them in is
     information, the same argument the map's own saved list is sorted on, and
     an alphabet would throw it away.
     
     `l.public = 1` is what makes a keep follow the list rather than outlive
     it. A list whose owner has since made it private stops being served to
     anybody but them, so it stops appearing here too; the row is left in
     place rather than deleted, because privacy is a switch its owner can flip
     back and a keep is not something to throw away on their behalf. A list
     that was deleted has no row to join to and drops out for good — see
     remove(), which takes the keeps with it. */
  const kept = await env.DB
    .prepare(
      'SELECT l.id AS id, l.title AS title, l.intro AS intro, ' +
      'l.updated_at AS updated_at, u.username AS by, k.created_at AS kept_at, ' +
      'COUNT(i.place_id) AS n, ' +
      '(SELECT COUNT(*) FROM list_keeps k2 WHERE k2.list_id = l.id) AS keeps ' +
      'FROM list_keeps k ' +
      'JOIN lists l ON l.id = k.list_id ' +
      'LEFT JOIN users u ON u.id = l.owner ' +
      'LEFT JOIN list_items i ON i.list_id = l.id ' +
      'WHERE k.owner = ? AND l.public = 1 ' +
      'GROUP BY l.id ORDER BY k.created_at DESC'
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
      n: r.n,
      keeps: r.keeps
    })),
    kept: kept.results.map((r) => ({
      id: r.id,
      title: r.title,
      intro: r.intro,
      by: r.by || null,
      updated: r.updated_at,
      keptAt: r.kept_at,
      n: r.n,
      keeps: r.keeps
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
  /* Adding a place to the catalogue-that-is-not-the-catalogue. It names no
     list, so it is routed here with create() rather than below, where every
     action has a list to prove ownership of. */
  if (action === 'place') return addPlace(context, body, user);

  /* Everything else acts on a list that already exists, so it is the same
     two lines every time: is that a list id at all, and is it yours. */
  const id = typeof body.id === 'string' ? body.id : '';
  if (!LIST_ID.test(id)) return json({ error: 'not-found' }, 404);

  const row = await env.DB
    .prepare('SELECT owner, public FROM lists WHERE id = ?')
    .bind(id)
    .first();

  /* Keeping is the one thing in this file you do to a list that is not yours
     — that is the whole of what it is for — so it is routed above the
     ownership check rather than through it, and does its own narrower one.
     Everything below this line still cannot touch a row without having proved
     whose it is. */
  if (action === 'keep' || action === 'unkeep') {
    return keep(context, id, row, user, action === 'keep');
  }

  /* Somebody else's list and a list that does not exist get the same answer.
     Anything else would make this a way of asking which codes are taken. */
  if (!row || row.owner !== user.id) return json({ error: 'not-found' }, 404);

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

/* ---------------------------------------------------- adding a place
 * The place the catalogue does not have.
 *
 * data/places.json is my map plus a Google export, and between them they miss
 * things — somewhere that opened last month, somewhere Google files as not a
 * restaurant. Before this, the picker's answer to "it is not in the list" was
 * nothing at all, and the list simply could not be finished.
 *
 * WHAT IT IS NOT
 *
 * It is not a way onto the map. data/restaurants.json is hand-written and
 * being on it is the verdict; this is somebody saying "this exists and I want
 * it on my list", which is a much smaller claim and stays in its own table.
 *
 * WHY THE POINT IS REQUIRED AND THE ADDRESS IS NOT
 *
 * A place with no coordinates cannot be drawn, and being drawn on the map with
 * the rest of the list is most of the reason anybody adds one — seatList() in
 * assets/app.js drops a list row that has no point, so a place without one
 * would go on the list and then quietly not be on the map. The form asks for
 * the pin by making somebody drag it, so there is no such thing as a row here
 * that does not know where it is. A street name is worth having and is not
 * that.
 *
 * WHAT IS CHECKED
 *
 * A session, the same as everything else that writes here. A name. A point
 * that is actually a number and actually near Tallinn — a pin dragged off the
 * map, or a scripted call with a longitude of 900, is refused rather than
 * stored and drawn somewhere in the Atlantic. And a cap, because this is the
 * one table on the site where a stranger types a name that other people then
 * read on a shared page.
 */

/* Roughly 60km around the city, which is generous — it reaches Paldiski and
   past Kehra — and still refuses a point in another country. The map itself
   opens on Tallinn and this feature is for places on it. */
const TALLINN = { lat: 59.437, lng: 24.7536, degLat: 0.55, degLng: 1.1 };

function point(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

async function addPlace(context, body, user) {
  const { env } = context;

  const name = words(body.name, MAX_NAME);
  if (!name) return json({ error: 'name' }, 400);

  const lat = point(body.lat);
  const lng = point(body.lng);
  if (lat === null || lng === null) return json({ error: 'where' }, 400);
  if (Math.abs(lat - TALLINN.lat) > TALLINN.degLat ||
      Math.abs(lng - TALLINN.lng) > TALLINN.degLng) {
    return json({ error: 'where' }, 400);
  }

  const held = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM added_places WHERE owner = ?')
    .bind(user.id)
    .first();
  if (held && held.n >= MAX_ADDED) return json({ error: 'too-many' }, 429);

  const now = Date.now();
  /* The same loop create() uses, and for the same reason: the primary key is
     the only thing in this codebase allowed to decide what is unique. Ten
     characters out of an alphabet of twenty-eight is not going to collide;
     the loop is so that nothing depends on that being true. */
  for (let tries = 0; tries < 5; tries++) {
    const id = addedId();
    try {
      await env.DB
        .prepare(
          'INSERT INTO added_places (id, owner, name, address, lat, lng, created_at, updated_at) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(id, user.id, name, words(body.address, MAX_ADDRESS), lat, lng, now, now)
        .run();
      return json({
        place: { id: id, name: name, address: words(body.address, MAX_ADDRESS), lat: lat, lng: lng }
      }, 200);
    } catch (e) {
      /* Taken. Round again. */
    }
  }
  return json({ error: 'busy' }, 503);
}

/* --------------------------------------------------------------- keeping
 * A bookmark on somebody else's list. The same gesture as the mark on a place
 * and the same meaning — keep this, I am coming back to it — pointed at the
 * other kind of object this site has.
 *
 * WHY THIS ONE NEEDS AN ACCOUNT WHEN A SAVE DOES NOT
 *
 * A save is anonymous and filed under whatever the browser calls itself,
 * because it has to work in the first ten seconds. Losing it to a cleared
 * browser costs the view of your own marks and not the marks themselves.
 *
 * A kept list is a page you mean to come back to, usually weeks later and
 * usually not on the device you found it on. A device-owned keep would be one
 * Safari sweep away from a collection with no way back to it — there is no
 * link in a browser's history for a list read once on a laptop — so the owner
 * is always a users.id, which the session above has already established.
 *
 * WHAT IT REFUSES, AND WHY EACH ONE
 *
 *   no such list          not-found
 *   somebody's private    not-found, deliberately the same answer: telling
 *                         the two apart would make this a way of asking
 *                         which codes are real
 *   your own list         'own'. It is already under Your lists, and a second
 *                         copy of it under Lists you kept would be the same
 *                         list twice on one page
 *   two hundred kept      'too-many', and only when this would be a new row
 *
 * HOW HONEST THE COUNT IS
 *
 * As honest as an account is, which is the same answer /api/saves gives about
 * its own numbers and worth being plain about. One row per (list, account),
 * so nobody inflates a count by pressing twice; anybody willing to make ten
 * accounts can add ten. Nothing on this site sorts or ranks by it, so what
 * that buys is a bigger number next to a list and not a better position
 * anywhere — which is most of the reason it is not worth doing.
 */
async function keep(context, id, row, user, on) {
  const { env } = context;

  /* A private list is not served to anybody but its owner, so there is
     nothing here to keep — and it answers as a missing list rather than as a
     refused one, for the reason in the block above. */
  if (!row || (!row.public && row.owner !== user.id)) return json({ error: 'not-found' }, 404);
  if (row.owner === user.id) return json({ error: 'own' }, 400);

  const now = Date.now();

  if (on) {
    const held = await env.DB
      .prepare('SELECT COUNT(*) AS n FROM list_keeps WHERE owner = ?')
      .bind(user.id)
      .first();
    /* Checked against a row that may already exist, the way add() does: the
       insert's conflict clause is silent by design, so a re-press on a list
       already kept must not be turned into a refusal by a cap it is not
       adding to. */
    if (held && held.n >= MAX_KEPT) {
      const already = await env.DB
        .prepare('SELECT 1 AS x FROM list_keeps WHERE list_id = ? AND owner = ?')
        .bind(id, user.id)
        .first();
      if (!already) return json({ error: 'too-many' }, 429);
    }

    /* DO NOTHING rather than an update: a keep carries nothing but the fact
       and the moment, and a second press is not a new moment. Keeping the
       first created_at is what holds a collection in the order it was
       actually built. */
    await env.DB
      .prepare(
        'INSERT INTO list_keeps (list_id, owner, created_at) VALUES (?, ?, ?) ' +
        'ON CONFLICT (list_id, owner) DO NOTHING'
      )
      .bind(id, user.id, now)
      .run();
  } else {
    await env.DB
      .prepare('DELETE FROM list_keeps WHERE list_id = ? AND owner = ?')
      .bind(id, user.id)
      .run();
  }

  /* Read back rather than worked out from what was sent. A press that hit the
     conflict clause changed nothing, and a page told "+1" for it would drift
     from the database and never be corrected — the same reasoning that makes
     save_counts a recount and not an increment. */
  const keeps = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM list_keeps WHERE list_id = ?')
    .bind(id)
    .first();

  return json({ id: id, kept: on, keeps: keeps ? keeps.n : 0 }, 200);
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
    /* Other people's bookmarks on it, which have nothing left to point at.
       Left behind they would be invisible — the index joins them to a list
       that is gone and they drop out of every answer — and still counted
       against their owners' cap, which is the worst combination: a drawer
       somebody cannot see and cannot empty. Deleting a list is the owner's
       to do, and this is the honest cost of it.

       Not a foreign key, because there is no ON DELETE CASCADE on that table
       and adding one to a live database is a rebuild. One statement in the
       same batch does the same job where it can be read. */
    env.DB.prepare('DELETE FROM list_keeps WHERE list_id = ?').bind(id),
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

  /* Three rolls, asked in the order they cost: the catalogue is a file this
     isolate probably already holds, google_venues is a query, and the places
     somebody added by hand are a query the id itself tells us to skip. The
     first two are what the picker offered — see functions/api/places.js — and
     the third is what it offered when they had nothing.

     This is the check that stops list_items filling with places that do not
     exist, so each new roll widens it and none of them relaxes it: an id on
     none of the three is refused exactly as it always was.

     Any account's added place is accepted here, not only the session's own.
     Only its author sees one in a picker, but a place already on somebody's
     shared list is a place that exists, and refusing it would be refusing a
     row this same API already serves to everybody who opens that list. */
  let known = null;
  let asked = false;

  /* An added id cannot be in either of the other two — that is what the shape
     of it guarantees — so it is one query instead of three. */
  if (isAdded(place)) {
    try {
      known = (await addedByIds(env, [place])).get(place) || null;
      asked = true;
    } catch (e) { /* answered below */ }
  } else {
    try {
      const roll = await catalogue(context);
      known = roll.get(place) || null;
      asked = true;
    } catch (e) { /* the export below may still know it */ }

    if (!known) {
      try {
        known = (await venuesByIds(env, [place])).get(place) || null;
        asked = true;
      } catch (e) { /* answered below */ }
    }
  }

  /* No roll could be read at all. That is this site being unwell rather than
     the place being wrong, and the two must not be reported as one: "there is
     no such place" would send somebody looking for a typo. */
  if (!known && !asked) return json({ error: 'places' }, 503);

  /* Nowhere real. The same refusal /api/saves gives, and for the same reason:
     nothing gets to put a row in here for a place that does not exist. */
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
        /* Already on the list: keep the row where it is — the position, the
           name it was added under and when — and take the note if one came
           with this call. DO NOTHING would have thrown the note away, which
           is the one thing in the request somebody actually wrote.

           The WHERE is what makes a bare re-add harmless. Adding a place that
           is already there, with nothing to say about it, is a no-op rather
           than a way to wipe the sentence underneath it. */
        'ON CONFLICT (list_id, place_id) DO UPDATE SET say = excluded.say ' +
        "WHERE excluded.say <> ''"
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
