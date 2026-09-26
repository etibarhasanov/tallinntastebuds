/**
 * Tallinn Tastebuds — /api/stats, what gets pressed and how often.
 *
 * One route asked two ways, the way /api/saves is: the POST says a thing was
 * pressed and the GET is the ranking that comes out of it. They are one file
 * because they are one number seen from either end, and splitting them would
 * be two places to change when what counts as a press changes.
 *
 *   POST { kind, id }   adds one — or, for a profile, hands it to
 *                       ./_visits.js with `from` or `what` beside it. Answers {ok} and nothing else; the page
 *                       never waits on it and never draws anything from it.
 *                       For a place Google lists — one of its own, or one of
 *                       mine joined to it — it may also, after that answer,
 *                       refresh the numbers from Google:
 *                       functions/api/_refresh.js.
 *   GET  ?lang=         the whole ranking, the page's words beside it, and
 *                       five minutes of edge cache on the pair. The owner's
 *                       only — see WHO MAY READ IT below.
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
 * THE MAP IS THE RANKING AND THE OTHER THREE ARE FOOTNOTES
 *
 * The answer carries the map's own places in full, zeros included, because
 * those are the places this site is about and the bottom of that list is as
 * much of an answer as the top: a ranking that printed only what has been
 * opened would quietly drop the places nobody has, which is the half the page
 * was asked for. The 1,110 Google venues are an array of their own and only
 * the ones somebody has actually pressed, capped at VENUES — a thousand rows
 * tied at nought is not a ranking, and the directory is not the map. The
 * filters are the third array, in full, because there are fourteen of them,
 * and the rail is the fourth, in full, because there are nine.
 *
 * WHAT A FAILURE LOOKS LIKE
 *
 * `ready: false` and empty arrays, 200, with the words still in the answer —
 * no database, the other environment's database, or db/schema.sql not applied
 * yet, which is the one that will actually happen: the table arrives by hand
 * and there is always an afternoon between the deploy and somebody running it.
 * The page then says the numbers are not in yet and draws the rest of itself.
 * The POST is quieter still: every ending is 200 with {ok:false} unless the
 * request itself was malformed, because a press that did not get counted is
 * not something a visitor should ever be told about.
 *
 * WHO MAY READ IT
 *
 * Anybody may press, and only the owner may read. The POST stays open because
 * every page on the site sends it and a press is nobody's secret; the GET is
 * how the site is used — which places get opened, which buttons get pushed,
 * how many accounts there are — and it answers 403 to anybody adminUser() in
 * ./_admin.js does not recognise, before the cache is even asked. The page
 * itself is gated in functions/_middleware.js as well, so this is the second
 * lock and not the only one.
 *
 * The colo cache stays, because it is still the cost control, but it is only
 * ever read after the check — and what goes back to the browser is
 * `private, no-store` whatever the cached copy says, so no cache between here
 * and the owner's phone can hand the ranking to the next person to ask. See
 * privately() below.
 *
 * ONE NUMBER ABOUT THE SITE RATHER THAN ABOUT A PRESS
 *
 * `users` is how many accounts exist, `SELECT COUNT(*) FROM users` read fresh
 * on every cache miss — the table is small enough that a running counter
 * would be one more thing to keep in step for no reason. It answers 0 rather
 * than failing the rest of the page when `users` is not there yet, the same
 * way the ranking above answers empty rather than failing when `press_counts`
 * is not.
 */

import {
  json, wrongDatabase, knownPlaces, mapPlaces, venuesByIds, dataFile, wordsFor
} from './_lib.js';
/* The shape of a list id, so a request carrying something that could not be
   one is refused before it costs a query — the same way GOOGLE_KEY below
   guards the venue lookup. Imported rather than restated: _lists.js is a
   module and this is the fourth reader of that expression. */
import { LIST_ID } from './_lists.js';
import { countView, countPress } from './_visits.js';
/* Who may read the ranking. */
import { adminUser } from './_admin.js';
/* A Google place opened is also the moment its numbers are worth checking. */
import { refreshOnOpen } from './_refresh.js';

/* Five minutes in the colo, which is what the page is allowed to be stale by.
 *
 * Nothing purges this. A save purges the counts cache because the number it
 * changed is on the screen that changed it — press the mark, see the count go
 * up — and nothing here is like that: the ranking is read on a page of its
 * own, by somebody who is not the person whose press moved it. Five minutes is
 * also what /api/places and /api/venues hold, and this reads the same shape of
 * table they do.
 *
 * It is the only thing between this route and the database, so it is also the
 * cost control: however often /stats is opened, each colo asks D1 twelve
 * times an hour per language and no more. It is read only after the owner
 * check, so holding it never hands the answer to anybody else. */
const TTL = 300;

/* How many Google venues the second table prints. Twenty-five is a screen of
   them on a phone and about as far down a list of places nobody has been to as
   anybody reads. The cap is here rather than in the page because it also
   bounds the lookup below — venuesByIds() takes fifty ids at a time, so this
   is one query however many venues have been pressed. */
const VENUES = 25;

/* The four kinds of thing a press can be about. In one place because the POST
   checks what it was given against it and the GET splits the rows on it. */
const PLACE = 'place';
const FILTER = 'filter';
const LIST = 'list';
const RAIL = 'rail';
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
const RAIL_PILLS = [
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
const DEAL_FILTER = 'discount';

/* A Google place id, as google_venues.place_id holds one: Google's own key,
   "ChIJUdUjCV2TkkYRcg8TxVp1XUI". Shape only — whether the place exists is a
   question for the table, and the POST asks it. It is here so that a request
   carrying something that could not be a place id is refused before it costs
   a query. */
const GOOGLE_KEY = /^[A-Za-z0-9_-]{16,128}$/;

/* ------------------------------------------------------------ the ranking */

export async function onRequestGet(context) {
  const { request, env } = context;

  /* The owner, or nothing — before the words, before the cache. See WHO MAY
     READ IT in the header. */
  if (!(await adminUser(request, env))) return json({ error: 'owner-only' }, 403);

  /* The words first, and before anything that can fail, because every answer
     this route gives carries them — including the ones that carry no numbers.
     A page that cannot say "nothing has been opened yet" in the language it is
     being read in is a page printing its own keys at somebody.

     Two of the three things wordsFor() answers with. The third is `langs`, the
     ten codes with each language's own name, and it is dropped here: the
     flashcards page has a switch to draw out of it and this one does not, so
     sending it would be ten pairs in every answer that nothing reads. */
  const { lang, ui } = await wordsFor(context, new URL(request.url).searchParams.get('lang'));
  const words = { lang: lang, ui: ui };

  const cache = caches.default;
  const key = statsKey(request, words.lang);
  const hit = await cache.match(key);
  if (hit) return privately(hit);

  const empty = {
    ready: false, opens: 0, users: 0, map: [], venues: [], filters: [], rail: [], ...words
  };
  if (!env.DB) return json(empty, 200);
  /* A deployment holding the other environment's database answers as though it
     had no database at all — the same rule /api/saves follows, and for the
     same reason: a preview showing the live numbers is the same mistake as
     writing to them. */
  if (await wrongDatabase(env)) return json(empty, 200);

  let rows;
  try {
    const answer = await env.DB
      .prepare('SELECT kind, id, n FROM press_counts WHERE n > 0')
      .all();
    rows = answer.results || [];
  } catch (e) {
    /* No table yet — see the header. */
    return json(empty, 200);
  }

  const counted = new Map();
  for (const row of rows) counted.set(row.kind + '\u0000' + row.id, row.n);
  const countOf = (kind, id) => counted.get(kind + '\u0000' + id) || 0;

  let places;
  try {
    places = await mapPlaces(context);
  } catch (e) {
    /* The roll of places is unreadable, which is a broken deployment rather
       than an empty ranking. Say the same thing as no database: the page draws
       and has nothing to print. */
    return json(empty, 200);
  }

  /* The map, every one of them, most opened first.

     The tie-break is the name, and it has to be something: without it two
     places on nought come back in whatever order the roll happens to be in,
     which changes when a place is added and makes a stable-looking table
     shuffle for no reason anybody could explain. localeCompare rather than <,
     so Õ sorts where a reader expects rather than after Z. */
  const map = places
    .map((p) => ({
      id: p.id,
      name: p.name,
      n: countOf(PLACE, p.id),
      /* A shut place is still on the map, still has a card and can still be
         opened, so it is still in the ranking — but a row at the bottom of one
         needs to say why it is there, or the table reads as a verdict on a
         restaurant that closed in March. See **Close a place instead of
         deleting it** in README.md. */
      closed: !!p.closed
    }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));

  /* Everything counted as a place that is not on the map is one of Google's,
     most pressed first, capped. Sorted before the lookup, so the cap is what
     bounds the query. */
  const onMap = new Set(places.map((p) => p.id));
  const strangers = rows
    .filter((row) => row.kind === PLACE && !onMap.has(row.id))
    .sort((a, b) => b.n - a.n)
    .slice(0, VENUES);

  let venues = [];
  if (strangers.length) {
    try {
      const found = await venuesByIds(env, strangers.map((row) => row.id));
      /* A venue the export no longer carries is dropped rather than printed
         with its key for a name: a refresh takes rows out, and a row nobody
         can put a name to says nothing to anybody reading a ranking. Its count
         stays in the table and in `opens` below, because it happened. */
      venues = strangers
        .filter((row) => found.has(row.id))
        .map((row) => ({ id: row.id, name: found.get(row.id).name, n: row.n }));
    } catch (e) {
      /* The names did not come back. The map's own ranking is the page, and
         this half of it is not worth failing the other half for. */
      venues = [];
    }
  }

  /* Every open this site has counted — the venues past the cap and the ones
     with no name left included, and the filters and the lists not, because a
     chip pressed is not a place looked at, a list opened is somebody's page
     rather than a restaurant, and adding any of the three to the others would
     be a number about nothing.
     It is the one figure on the page that is about the site rather than about
     a restaurant. */
  let opens = 0;
  for (const row of rows) if (row.kind === PLACE) opens += row.n;

  const filters = await ranked(context, words, countOf);
  const rail = railed(words, countOf);

  /* How many accounts exist, about the site rather than about a press — see
     ONE NUMBER ABOUT THE SITE above. Failing this never fails the ranking: a table not
     yet applied answers 0, the same way press_counts answers empty. */
  let users = 0;
  try {
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
    users = (row && row.n) || 0;
  } catch (e) {
    users = 0;
  }

  const res = json(
    {
      ready: true, opens: opens, users: users,
      map: map, venues: venues, filters: filters, rail: rail,
      ...words
    },
    200, TTL
  );
  context.waitUntil(cache.put(key, res.clone()));
  return privately(res);
}

/* The colo's copy carries `public, max-age` because the Cache API will not
   store anything less; the browser's copy carries `private, no-store`,
   because the only person allowed to read it is the one who just asked. */
function privately(res) {
  const out = new Response(res.body, res);
  out.headers.set('cache-control', 'private, no-store');
  return out;
}

/* Every chip on the map, most pressed first, named in the reading language.
 *
 * In full rather than only the pressed ones, for the reason the map's own
 * places are in full: a chip nobody has pressed is the answer to the question
 * this table is for. **The order of the filter chips** in README.md is what
 * that question is — the row is in a hand-written order today, and this is the
 * measurement that would argue for a different one.
 *
 * The labels come from the same two files the chips themselves are drawn from:
 * the types out of data/taxonomy.json in the language the answer is in, and
 * the one chip that is not a type out of the ui block already in hand. A type
 * with no label in that language is dropped rather than printed as its id,
 * which is the rule everywhere else on this site — though the validator fails
 * the build on a missing one, so it should not be reachable.
 */
async function ranked(context, words, countOf) {
  let types;
  try {
    const taxonomy = await dataFile(context, '/data/taxonomy.json');
    types = (taxonomy && taxonomy.types) || [];
  } catch (e) {
    /* No taxonomy, no filter table. The page draws the places, which is what
       it is mostly for. */
    return [];
  }

  const rows = types
    .filter((type) => type && typeof type[words.lang] === 'string' && type[words.lang])
    .map((type) => ({ id: type.id, name: type[words.lang], n: countOf(FILTER, type.id) }));

  if (words.ui.filterDiscount) {
    rows.push({
      id: DEAL_FILTER,
      name: words.ui.filterDiscount,
      n: countOf(FILTER, DEAL_FILTER)
    });
  }

  return rows.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}

/* Every pill on the rail, most pressed first, named in the reading language.
 *
 * In full rather than only the pressed ones, for the reason the chips above
 * are in full: a button nobody presses is the answer to the question this
 * table is for. The rail is nine pills deep on a phone and the cascade that
 * introduces them is timed to the sentence under the mark — see
 * introduceRail() in assets/app.js — so which of them earns its slot is a
 * question with a real cost behind it.
 *
 * The tie-break is the rail's own order and not the name: nine buttons on
 * nought sorted alphabetically is a list nobody can read against the thing it
 * describes, and top-to-bottom is how they are stood. A pill whose label is
 * missing from the block is dropped rather than printed as its id, which is
 * the rule the chips follow — the validator fails the build on a missing
 * string, so it should not be reachable.
 */
function railed(words, countOf) {
  return RAIL_PILLS
    .map((pill, at) => ({
      id: pill.id,
      name: words.ui[pill.label],
      n: countOf(RAIL, pill.id),
      at: at
    }))
    .filter((row) => typeof row.name === 'string' && row.name)
    .sort((a, b) => b.n - a.n || a.at - b.at)
    .map((row) => ({ id: row.id, name: row.name, n: row.n }));
}

/* What the colo files the answer under: the route and the language, and never
   the rest of the address. The page sends its whole list of candidate
   languages — "et,en,ru" — and the answer only depends on which one of them
   won, so keying on the raw query would file the same ten answers under
   however many orders browsers happen to send. Ten keys per colo, one per
   language the site speaks. */
function statsKey(request, lang) {
  const url = new URL('/api/stats', request.url);
  url.searchParams.set('lang', lang);
  return new Request(url.toString());
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
