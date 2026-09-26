/**
 * Tallinn Tastebuds — /api/stats, what gets pressed and how often.
 *
 * The half of the statistics anybody may use: the POST that says a thing was
 * pressed. The ranking that comes out of it is the owner's, and lives at
 * GET /api/admin/stats in ./admin/stats.js, behind the lock in
 * functions/_middleware.js. They were one file while both were public; they
 * are two now because one of them is not, and the kinds, the pills and the
 * deal chip below are exported so the ranking reads the same table this
 * counts into rather than a copy of it.
 *
 *   POST { kind, id }   adds one — or, for a profile, hands it to
 *                       ./_visits.js with `from` or `what` beside it. Answers {ok} and nothing else; the page
 *                       never waits on it and never draws anything from it.
 *                       For a place Google lists — one of its own, or one of
 *                       mine joined to it — it may also, after that answer,
 *                       refresh the numbers from Google:
 *                       functions/api/_refresh.js.
 *   GET                 is gone from this address: a 404, said out loud
 *                       below, because a route with no GET would fall
 *                       through to the static files and answer with the
 *                       map. See ./admin/stats.js.
 *
 * WHAT IS COUNTED, AND WHAT IS NOT
 *
 * Four kinds, which is the whole of `kind` in db/schema.sql:
 *
 *   place    a place opened. selectPlace() in assets/app.js, which is the
 *            same moment TTBTrack.view() reports one to Google Analytics, and
 *            select() in assets/venues.js, which is a card pressed on the
 *            directory. Those are the two gestures on this site that mean
 *            "show me this place".
 *   filter   a chip on the map turned on — applyFilters() in assets/app.js,
 *            which is every chip on the row and nothing else. Turning one off
 *            is not a press of it, and All is not a filter: it is the way out
 *            of the chips, so pressing it counts nothing.
 *   list     a public list opened, once per load of its page — countOpen() in
 *            assets/lists.js, called from boot() however the reader arrived:
 *            the directory, a link somebody sent, a byline, a search result.
 *            Not when its own owner opens it. This is the one
 *            kind nothing on /stats prints: it is read by _mostkept.js, which
 *            is what orders /lists, and the number is never drawn on a row.
 *            **Public lists** in README.md says why a ranking without a
 *            scoreboard is the point rather than an omission.
 *   rail     a pill on the rail down the left of the map pressed — the nine
 *            in RAIL_PILLS below, which is every button inside #rail and
 *            nothing else. The radio is not one of them: it left the rail for
 *            the corner beside the language switch, and a table about the rail
 *            that carried it would be a table about something else.
 *
 * And two kinds that are counted somewhere else, which this route only
 * carries: `profile`, a public profile at /u/<name> opened, and
 * `profile-press`, a row, a handle or a list on one pressed. They are the
 * owner's own numbers, read on /insights and never ranked here, so
 * they live in profile_counts and ./_visits.js — this is the door because it
 * is already the one every page on this site knocks on to say something was
 * pressed, and a route of its own would be a second.
 *
 * Nothing else does. A row on somebody's list, a search that narrows to one
 * name, a pin hovered on the way past: none of them is somebody asking for a
 * restaurant, and counting them would make the number mean less rather than
 * more. A place added by hand to a list — see isAdded() in ./_lib.js — is not
 * counted either: it is one person's row on one list, not on the map or in
 * Google's export, so there is nothing for a ranking to compare it against.
 *
 * Every kind but the rail is counted once per page load, and the rail every
 * press, which is not an oversight. A place or a chip is a question about
 * where to eat, asked once however many times the card is reopened while
 * somebody makes their mind up — and it has to agree with the one page view
 * TTBTrack.view() reports beside it. A pill is a press, GA is sent an event
 * per press of one, and the question this table answers is the plain one:
 * which of the nine buttons do people actually push, and how often. Counting
 * that once a load would answer "how many visits pressed it at all", which is
 * a quieter question nobody asked.
 *
 * WHAT A FAILURE LOOKS LIKE
 *
 * Every ending is 200 with {ok:false} unless the request itself was
 * malformed, because a press that did not get counted is not something a
 * visitor should ever be told about.
 */

import {
  json, wrongDatabase, knownPlaces, dataFile
} from './_lib.js';
/* The shape of a list id, so a request carrying something that could not be
   one is refused before it costs a query — the same way GOOGLE_KEY below
   guards the venue lookup. Imported rather than restated: _lists.js is a
   module and this is the fourth reader of that expression. */
import { LIST_ID } from './_lists.js';
import { countView, countPress } from './_visits.js';
/* A Google place opened is also the moment its numbers are worth checking. */
import { refreshOnOpen } from './_refresh.js';

/* The four kinds of thing a press can be about. In one place because the POST
   checks what it was given against it and the ranking in ./admin/stats.js
   splits the rows on it. */
export const PLACE = 'place';
export const FILTER = 'filter';
const LIST = 'list';
export const RAIL = 'rail';
/* And two that are not counted here at all but handed on — see the POST. */
const PROFILE = 'profile';
const PROFILE_PRESS = 'profile-press';

/* The pills on the rail, top to bottom as index.html stands them, each with
   the string data/ui.json already names it by — the same string the button
   wears as its own label on the map, so the table reads as the rail does and
   nothing new was written into ten languages to name a button that is already
   named. The ids are the keys hintPill() in assets/app.js uses for the same
   nine buttons, which is where they came from.

   Written out here because a pill is not a row in any file this side can
   open: the chips come out of data/taxonomy.json and this is markup. So it is
   the arrangement DEAL_FILTER above has — a button added to the rail is
   counted once it is named here and not before, and RAIL_PRESS in
   assets/app.js is the other half of the pair. The radio is deliberately
   absent: it is not in #rail. */
export const RAIL_PILLS = [
  { id: 'account', label: 'accountOpen' },
  { id: 'lists', label: 'listsAllTitle' },
  { id: 'flash', label: 'flashDoor' },
  { id: 'random', label: 'randomPick' },
  { id: 'ask', label: 'askOpen' },
  { id: 'style', label: 'styleLabel' },
  { id: 'locate', label: 'locate' },
  { id: 'explain', label: 'explainOpen' },
  { id: 'feedback', label: 'feedbackTitle' }
];

/* The one chip on the map that is not a type out of data/taxonomy.json.
   DEAL_FILTER in assets/app.js is the same string, and it is written out twice
   because neither dialect can import the other — the arrangement the pins have
   in ./_pins.js. The taxonomy is read rather than restated: it is a file this
   side can open, and thirteen ids copied here would be thirteen ids to keep in
   step. Change one, change the other; there is no validator rule for this pair
   the way there is for the pins, so it is worth knowing that a chip added to
   the map with an id of its own has to be named here before it is counted. */
export const DEAL_FILTER = 'discount';

/* A Google place id, as google_venues.place_id holds one: Google's own key,
   "ChIJUdUjCV2TkkYRcg8TxVp1XUI". Shape only — whether the place exists is a
   question for the table, and the POST asks it. It is here so that a request
   carrying something that could not be a place id is refused before it costs
   a query. */
const GOOGLE_KEY = /^[A-Za-z0-9_-]{16,128}$/;

/* ------------------------------------------------------- the ranking moved */

/* The ranking is GET /api/admin/stats now. Without this, a GET here falls
   through to the static files — the project has no 404.html, so Pages answers
   an unknown address with the map — and a page still asking the old address
   would be handed HTML where it expected numbers. */
export function onRequestGet() {
  return json({ error: 'not-found' }, 404);
}

/* --------------------------------------------------------------- one press */

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'body' }, 400);
  }

  const kind = [PLACE, FILTER, LIST, RAIL, PROFILE, PROFILE_PRESS].indexOf(body.kind) !== -1 ? body.kind : '';
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!kind || !id || id.length > 128) return json({ error: 'press' }, 400);

  /* Everything below this line answers 200 whatever happens. A count that did
     not land is nothing the person who pressed the thing should hear about,
     and the page is not listening anyway. */
  if (!env.DB) return json({ ok: false }, 200);
  if (await wrongDatabase(env)) return json({ ok: false }, 200);

  /* A profile opened, or something on one pressed. Counted into a table of
     their own and not press_counts, because the number belongs to the person
     whose page it is and is read by them on /insights rather than ranked
     here — ./_visits.js is the whole of it. `id` is the username. */
  if (kind === PROFILE) return json({ ok: await countView(context, id, body.from) }, 200);
  if (kind === PROFILE_PRESS) return json({ ok: await countPress(context, id, body.what, body.from) }, 200);

  const real = kind === PLACE ? await realPlace(context, id)
             : kind === LIST ? await realList(context, id)
             : kind === RAIL ? realPill(id)
             : await realFilter(context, id);
  if (!real) return json({ ok: false }, 200);

  /* One statement, and the row is made by the same one that increments it. The
     count is a running total rather than something recomputed from a log —
     db/schema.sql says why there is no log to recompute from — so this is the
     one place on this site where a number is nudged rather than rebuilt, and
     it is safe here for the reason save_counts is not: there is no second
     table that could disagree with it. */
  try {
    await env.DB
      .prepare(
        'INSERT INTO press_counts (kind, id, n) VALUES (?, ?, 1) ' +
        'ON CONFLICT(kind, id) DO UPDATE SET n = press_counts.n + 1'
      )
      .bind(kind, id)
      .run();
  } catch (e) {
    /* No table yet, or the write failed. Either way nothing was counted and
       nobody is waiting to hear it. */
    return json({ ok: false }, 200);
  }

  /* A place opened: ask Google whether its numbers still hold, if they are
     old enough to be worth asking about. After the answer has gone, so nobody
     waits on Google. Either kind of place, because both now print Google's
     numbers — a Google row on its card, and one of mine under "According to
     Google" in its panel — and functions/api/_refresh.js finds the Google row
     behind a slug by map_id. That file is the rest, the budget included;
     without GOOGLE_MAPS_API_KEY it returns before asking anything. */
  if (kind === PLACE) context.waitUntil(refreshOnOpen(env, id));

  return json({ ok: true }, 200);
}

/* Whether that id is a place this site knows, which is what keeps the table to
   real rows: without it, it fills with whatever anybody posts and the ranking
   has to start explaining rows it cannot name. A slug is checked against the
   map for nothing — the roll is already in memory — and a Google key costs one
   lookup on the primary key of google_venues, which is the price of the
   directory's half being counted at all.

   `hidden` is honoured: a row kept out of the picker is a duplicate or a car
   park Google thinks is a restaurant, and it has no business in a ranking.
   Nothing can reach one on the directory in any case, so this is belt and
   braces on a hand-written request. */
async function realPlace(context, id) {
  const { env } = context;
  let known;
  try {
    known = await knownPlaces(context);
  } catch (e) {
    return false;
  }
  if (known.has(id)) return true;
  if (!GOOGLE_KEY.test(id)) return false;

  try {
    const row = await env.DB
      .prepare('SELECT 1 AS ok FROM google_venues WHERE place_id = ? AND hidden = 0')
      .bind(id)
      .first();
    return !!row;
  } catch (e) {
    return false;
  }
}

/* And whether that id is a public list, which is what a row on /lists is
   ordered by — see SORTS in functions/api/_mostkept.js, which reads these rows
   and never writes one. One lookup on the primary key of `lists`.

   Public, and not merely present: a private list is one person's page and
   counting opens of it would rank it on a directory it can never appear on.
   A list the owner later makes private keeps the number it had and stops
   growing, which is the honest thing — nothing here deletes a count, and the
   row costs one key in a table already bounded by the things there are.

   The table not being there yet answers false, the way every other read on
   this route does: nothing was counted and nobody is waiting to hear it. */
async function realList(context, id) {
  const { env } = context;
  if (!LIST_ID.test(id)) return false;
  try {
    const row = await env.DB
      .prepare('SELECT 1 AS ok FROM lists WHERE id = ? AND public = 1')
      .bind(id)
      .first();
    return !!row;
  } catch (e) {
    return false;
  }
}

/* And whether that id is a pill the rail actually draws. RAIL_PILLS is the
   whole of it: nine ids written into this file, checked against so that the
   table cannot fill with names of buttons that do not exist. The radio is not
   one of them and neither is anything in the header. */
function realPill(id) {
  return RAIL_PILLS.some((pill) => pill.id === id);
}

/* And whether that id is a chip the map actually draws: a type out of the
   taxonomy, or the discount chip. Nothing else is a filter, All included. */
async function realFilter(context, id) {
  if (id === DEAL_FILTER) return true;
  try {
    const taxonomy = await dataFile(context, '/data/taxonomy.json');
    return ((taxonomy && taxonomy.types) || []).some((type) => type && type.id === id);
  } catch (e) {
    return false;
  }
}
