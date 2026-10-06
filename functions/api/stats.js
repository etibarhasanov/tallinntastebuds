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
 *                       ./_visits.js with `from` or `what` beside it, and
 *                       for a page opened or put away, to ./_visitors.js
 *                       with the rest of the body. Answers {ok} and nothing else; the page
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
 * Eight kinds, which is the whole of `kind` in db/schema.sql:
 *
 *   place    a place opened on the map — selectPlace() in assets/app.js,
 *            which is the same moment TTBTrack.view() reports one — whether one of the map's own, by its slug, or one of
 *            Google's the find bar put there, by Google's key. That is the
 *            gesture on this site that means "show me this place".
 *   filter   a chip on the map turned on — applyFilters() in assets/app.js,
 *            which is every chip on the row and nothing else. Turning one off
 *            is not a press of it, and All is not a filter: it is the way out
 *            of the chips, so pressing it counts nothing.
 *   list     a public list opened, once a day per visitor — countOpen() in
 *            assets/lists.js, called from boot() however the reader arrived:
 *            the directory, a link somebody sent, a byline, a search result.
 *            Never when its own owner opens it, which the page leaves out
 *            and realList() below refuses as well, and not again the same
 *            day from the same browser and network — firstToday() in
 *            ./_visits.js, the rule profile views keep. It is read by
 *            _mostkept.js, which is what orders /lists, by listViews() in
 *            ./_visits.js, which draws it back to the list's owner on
 *            /insights, and by ./admin/stats.js, which draws every opened
 *            list to the site's owner. It is never drawn on a row anybody
 *            else reads, and **Public lists** in README.md says why a
 *            ranking without a scoreboard is the point rather than an
 *            omission. The same open is also filed under the country it
 *            came from, into list_counts through countListOpen() in
 *            ./_visits.js — the half with a day and a place in it, which
 *            both of those pages draw as a line under the list.
 *   post     a member's post read on the blog, once a day per reader —
 *            countRead() in assets/blog.js, called whenever the page
 *            draws one, however the reader arrived at it. Published and not
 *            the reader's own, which realPost() below checks against the
 *            session, and once a day through firstToday() as a list is. It
 *            is read by postViews() in ./_visits.js and drawn back to the
 *            post's author on /insights and nowhere else. The house's own
 *            posts in data/blog.json are not this kind: they are the
 *            owner's, counted under `about` by ./_visitors.js and read on
 *            /admin/visitors.
 *   rail     a pill on the rail down the left of the map pressed — the nine
 *            in RAIL_PILLS below, which is every button inside #rail and
 *            nothing else. The radio is not one of them: it left the rail for
 *            the corner beside the language switch, and a table about the rail
 *            that carried it would be a table about something else. A row in
 *            the More sheet on the short rail is the pill it stands for and
 *            is counted under that pill's id — renderMore() in assets/app.js.
 *   layout   the rail a browser that had never been here was dealt — `a`
 *            the full one or `b` the short one, once per browser, from
 *            pickLayout() in assets/app.js — and `a-opened` / `b-opened`,
 *            the first place that browser opened on the visit it was dealt
 *            it. Four ids and no more, LAYOUT_IDS below, so the page can set
 *            the two rails' strangers side by side: how many got each, and
 *            how many of them found a place with it. "The short rail" in
 *            README.md.
 *   look     the directory's look somebody new to the site was dealt on
 *            their first open of /lists — `a` the page as it was or `b` at
 *            rest, from pickLook() in assets/lists.js — and, on the day it
 *            was dealt, `a-opened` / `b-opened` for the first list they
 *            opened from it and `a-kept` / `b-kept` for the first they kept.
 *            Six ids and no more, LOOK_IDS below. A test apart from the
 *            rails, with its own deal; "The lists' two looks" in README.md.
 *   style    the colour somebody new to the site was dealt as their first
 *            page opened — red, green, blue or plum, from dealStyle() in
 *            assets/track.js — and after it, once each, `-opened` for the
 *            first place, post or deck opened that day, `-back` for the
 *            first visit on a later day, and `-changed` for the first press
 *            of the swatch. Sixteen ids, STYLE_IDS below. "The four styles,
 *            dealt" in README.md.
 *
 * And four kinds that are counted somewhere else, which this route only
 * carries: `profile`, a public profile at /u/<name> opened, and
 * `profile-press`, a row, a handle or a list on one pressed. They are the
 * owner's own numbers, read on /insights and never ranked here, so
 * they live in profile_counts and ./_visits.js — this is the door because it
 * is already the one every page on this site knocks on to say something was
 * pressed, and a route of its own would be a second. `arrive` and `leave`
 * are the same arrangement for the whole site: a page opened, and a stretch
 * of one on screen with what was pressed meanwhile, sent by assets/track.js
 * from every page and counted into visitor_counts by ./_visitors.js, which
 * /admin/visitors reads — and the same `leave`, with its presses in the
 * order they came, into flow_counts by ./_flows.js, which is what puts the
 * numbers on the diagrams /admin/flows draws.
 *
 * And one kind counted nowhere: `venue`, a card pressed on /admin/google.
 * Only the owner can open the directory, so every one of those presses was
 * the owner's own look through Google's list, and while they were counted
 * as a `place` they sat in the ranking of Google's venues on /admin/stats
 * beside the city's opens on the map, and in the total under it. It is
 * carried only for the other thing an open does, which is to ask Google
 * whether the row's numbers still hold — refreshOnOpen() at the foot of the
 * POST.
 *
 * Nothing else does. A row on somebody's list, a search that narrows to one
 * name, a pin hovered on the way past: none of them is somebody asking for a
 * restaurant, and counting them would make the number mean less rather than
 * more. A place added by hand to a list — see isAdded() in ./_lib.js — is not
 * counted either: it is one person's row on one list, not on the map or in
 * Google's export, so there is nothing for a ranking to compare it against.
 *
 * Every kind but the rail is counted once per page load — a list and a post
 * once a day, above — and the rail every press, which is not an oversight. A
 * place or a chip is a question about where to eat, asked once however many
 * times the card is reopened while somebody makes their mind up — and it has
 * to agree with the one page view TTBTrack.view() reports beside it. A pill
 * is a press, Clarity is sent an event per press of one, and the question
 * this table answers is the plain one:
 * which of the nine buttons do people actually push, and how often. Counting
 * that once a load would answer "how many visits pressed it at all", which is
 * a quieter question nobody asked.
 *
 * BY DEVICE
 *
 * Every press counted into press_counts is counted a second time under the
 * device the page says it was pressed on, the kind written
 * `<device>.<kind>` — `desktop.rail`, `phone.layout` — so /admin/stats and
 * the tests on /admin/visitors can be read for phones, tablets or
 * computers alone. BY DEVICE in ./_visitors.js is the reasoning, and the
 * visits are split the same way there. A list's countries are not: they
 * are the list owner's numbers on /insights. Since 2026-10-06; a page
 * holding an older script sends no device and is counted once, as before.
 *
 * WHAT A FAILURE LOOKS LIKE
 *
 * Every ending is 200 with {ok:false} unless the request itself was
 * malformed, because a press that did not get counted is not something a
 * visitor should ever be told about.
 */

import {
  json, wrongDatabase, knownPlaces, dataFile, sessionUser
} from './_lib.js';
/* The shape of a list id, so a request carrying something that could not be
   one is refused before it costs a query — the same way GOOGLE_KEY below
   guards the venue lookup. Imported rather than restated: _lists.js is a
   module and this is the fourth reader of that expression. */
import { LIST_ID } from './_lists.js';
/* And of a post's, for the same reason. */
import { POST_ID } from './_posts.js';
import { countView, countPress, countListOpen, firstToday } from './_visits.js';
import { countArrive, countLeave, DEVICES } from './_visitors.js';
import { countFlows } from './_flows.js';
/* Whose reports are not counted at all — THE OWNER IS NOT ONE OF THEM in
   ./_visitors.js. */
import { adminUser } from './_admin.js';
/* A Google place opened is also the moment its numbers are worth checking. */
import { refreshOnOpen } from './_refresh.js';

/* The eight kinds of thing a press can be about. In one place because the POST
   checks what it was given against it and the ranking in ./admin/stats.js
   splits the rows on it. */
export const PLACE = 'place';
export const FILTER = 'filter';
export const LIST = 'list';
export const POST = 'post';
export const RAIL = 'rail';
export const LAYOUT = 'layout';
export const LOOK = 'look';
export const STYLE = 'style';
/* And four that are not counted here at all but handed on — see the POST —
   and one counted nowhere, which only asks Google — see the header. */
const PROFILE = 'profile';
const PROFILE_PRESS = 'profile-press';
const ARRIVE = 'arrive';
const LEAVE = 'leave';
const VENUE = 'venue';

/* The pills on the rail, top to bottom as index.html stands them, each with
   the string data/ui.json already names it by — the same string the button
   wears as its own label on the map, so the table reads as the rail does and
   nothing new was written into ten languages to name a button that is already
   named. The ids are the keys hintPill() in assets/app.js uses for the same
   nine buttons, which is where they came from. Nine across the two rails:
   the full one draws eight of them and the short one four — More is only
   the short rail's, and its rows count as the four pills it stands in for.

   Written out here because a pill is not a row in any file this side can
   open: the chips come out of data/taxonomy.json and this is markup. So it is
   the arrangement DEAL_FILTER above has — a button added to the rail is
   counted once it is named here and not before, and RAIL_PRESS in
   assets/app.js is the other half of the pair. The radio is deliberately
   absent: it is not in #rail. */
export const RAIL_PILLS = [
  { id: 'account', label: 'accountOpen' },
  { id: 'lists', label: 'listsAllTitle' },
  { id: 'more', label: 'moreOpen' },
  { id: 'flash', label: 'flashDoor' },
  { id: 'random', label: 'randomPick' },
  { id: 'ask', label: 'askOpen' },
  { id: 'style', label: 'styleLabel' },
  { id: 'locate', label: 'locate' },
  { id: 'feedback', label: 'feedbackTitle' }
];

/* The four things a stranger's deal can say — see the header. */
export const LAYOUT_IDS = ['a', 'b', 'a-opened', 'b-opened'];

/* And the six the directory's two looks can — see the header. */
export const LOOK_IDS = ['a', 'b', 'a-opened', 'b-opened', 'a-kept', 'b-kept'];

/* And the sixteen the four colours can: each colour dealt, and each with the
   three facts after it — STYLE_DEALS in assets/track.js is the four. */
export const STYLE_ARMS = ['red', 'green', 'blue', 'plum'];
export const STYLE_IDS = STYLE_ARMS.reduce((ids, arm) =>
  ids.concat([arm, arm + '-opened', arm + '-back', arm + '-changed']), []);

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
   through to the static files, which answer an unknown address with the
   not-found page, 404.html — and a page still asking the old address would
   be handed HTML where it expected numbers. */
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

  const kind = [PLACE, FILTER, LIST, POST, RAIL, LAYOUT, LOOK, STYLE, PROFILE, PROFILE_PRESS, ARRIVE, LEAVE, VENUE].indexOf(body.kind) !== -1 ? body.kind : '';
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!kind || !id || id.length > 128) return json({ error: 'press' }, 400);

  /* Everything below this line answers 200 whatever happens. A count that did
     not land is nothing the person who pressed the thing should hear about,
     and the page is not listening anyway. */
  if (!env.DB) return json({ ok: false }, 200);
  if (await wrongDatabase(env)) return json({ ok: false }, 200);

  /* The owner signed in is not a visitor, and nothing they do is counted —
     not a page, not a press, not a place, chip, pill or list opened, not a
     look at somebody's profile. Their own afternoon on the site was most of
     the returning visitors' minutes on the count's first days, and their
     own opens sat in the ranking on /admin/stats beside everybody else's
     until 2026-10-04: a page about how the site is used should not be read
     through whoever built it. ADMINS in wrangler.toml names the accounts —
     both the owner's, today. One session lookup per report, and none at
     all where ADMINS is empty; signed out, the owner counts like anybody.
     `venue` goes on past this, because it counts nothing and is the
     owner's by definition: what it is carried for is the refresh. */
  if (kind !== VENUE && (await adminUser(request, env))) return json({ ok: false }, 200);

  /* A profile opened, or something on one pressed. Counted into a table of
     their own and not press_counts, because the number belongs to the person
     whose page it is and is read by them on /insights rather than ranked
     here — ./_visits.js is the whole of it. `id` is the username. */
  if (kind === PROFILE) return json({ ok: await countView(context, id, body.from) }, 200);
  if (kind === PROFILE_PRESS) return json({ ok: await countPress(context, id, body.what, body.from) }, 200);

  /* A page of the site opened, or put away. Counted into visitor_counts, the
     whole site's by the day, and read on /admin/visitors — ./_visitors.js is
     the whole of it. `id` is the page's path. A page put away also carries
     the trail — the presses in the order they first happened — which
     ./_flows.js counts into flow_counts for the diagrams on /admin/flows, in
     a batch of its own so that neither table's absence fails the other.
     Neither hears from the owner's own session — see above. */
  if (kind === ARRIVE) return json({ ok: await countArrive(context, body) }, 200);
  if (kind === LEAVE) {
    const [counted] = await Promise.all([countLeave(context, body), countFlows(context, body)]);
    return json({ ok: counted }, 200);
  }

  /* A card pressed on the directory — the owner's, see the header. Counted
     nowhere, and still a Google place somebody is reading the numbers of, so
     worth asking about the way an open on the map is. refreshOnOpen() looks
     the id up itself and stops at one that is not a row, so a hand-written
     one costs the query realPlace() would have. */
  if (kind === VENUE) {
    context.waitUntil(refreshOnOpen(env, id));
    return json({ ok: false }, 200);
  }

  const real = kind === PLACE ? await realPlace(context, id)
             : kind === LIST ? await realList(context, id)
             : kind === POST ? await realPost(context, id)
             : kind === RAIL ? realPill(id)
             : kind === LAYOUT ? LAYOUT_IDS.indexOf(id) !== -1
             : kind === LOOK ? LOOK_IDS.indexOf(id) !== -1
             : kind === STYLE ? STYLE_IDS.indexOf(id) !== -1
             : await realFilter(context, id);
  if (!real) return json({ ok: false }, 200);

  /* A list opened a second time today by the same visitor is the same look,
     and one its owner opened is not a look at all — realList() has already
     said no to that. The profile's rule, from the same file, and a post
     read keeps it too. */
  if ((kind === LIST || kind === POST) && !(await firstToday(context, kind, id))) return json({ ok: false }, 200);

  /* One statement, and the row is made by the same one that increments it. The
     count is a running total rather than something recomputed from a log —
     db/schema.sql says why there is no log to recompute from — so this is the
     one place on this site where a number is nudged rather than rebuilt, and
     it is safe here for the reason save_counts is not: there is no second
     table that could disagree with it. */
  const device = DEVICES.includes(body.device) ? body.device : null;
  const bump = (k) => env.DB
    .prepare(
      'INSERT INTO press_counts (kind, id, n) VALUES (?, ?, 1) ' +
      'ON CONFLICT(kind, id) DO UPDATE SET n = press_counts.n + 1'
    )
    .bind(k, id);
  try {
    /* And again under the device — BY DEVICE. One batch, so the two never
       disagree about whether the press landed. */
    await env.DB.batch(device ? [bump(kind), bump(device + '.' + kind)] : [bump(kind)]);
  } catch (e) {
    /* No table yet, or the write failed. Either way nothing was counted and
       nobody is waiting to hear it. */
    return json({ ok: false }, 200);
  }

  /* A list opened: the same open again, under the country it came from,
     after the answer has gone — countListOpen() in ./_visits.js, which is
     what puts the line of countries under a list on /insights and on
     /admin/stats. After the running count and not inside its statement, so
     a database without list_counts still orders /lists. */
  if (kind === LIST) context.waitUntil(countListOpen(context, id));

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
   lookup on the primary key of google_venues, which is the price of Google's
   places opened on the map being counted at all.

   `hidden` is honoured: a row kept out of the picker is a duplicate or a car
   park Google thinks is a restaurant, and it has no business in a ranking.
   Nothing can reach one on the map in any case, so this is belt and braces
   on a hand-written request. */
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

   And not the owner's: the page never sends their own open, but a count the
   owner reads back on /insights is one the owner has a reason to climb, so
   the session on the request says no here too, the way ownerOf() in
   ./_visits.js does for a profile. The session is read only for a list that
   exists, so a hand-written id costs nothing more than it did.

   The table not being there yet answers false, the way every other read on
   this route does: nothing was counted and nobody is waiting to hear it. */
async function realList(context, id) {
  const { env } = context;
  if (!LIST_ID.test(id)) return false;
  try {
    const row = await env.DB
      .prepare('SELECT owner FROM lists WHERE id = ? AND public = 1')
      .bind(id)
      .first();
    if (!row) return false;
    const me = await sessionUser(context.request, env);
    return !(me && me.id === row.owner);
  } catch (e) {
    return false;
  }
}

/* And whether that id is a member's post the blog will show anybody, and
   not one the reader wrote: realList()'s rule above, for the same reason —
   the number is the author's, read back on /insights, and an author
   reading their own post is not a reader. Published, because a draft has
   one reader and a post taken back to draft keeps the number it had and
   stops growing. The shape is checked before the query, and the session
   is read only for a post that exists. */
async function realPost(context, id) {
  const { env } = context;
  if (!POST_ID.test(id)) return false;
  try {
    const row = await env.DB
      .prepare("SELECT owner FROM posts WHERE id = ? AND status = 'published'")
      .bind(id)
      .first();
    if (!row) return false;
    const me = await sessionUser(context.request, env);
    return !(me && me.id === row.owner);
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
