/**
 * Tallinn Tastebuds — who came to the site, roughly, and what they did.
 *
 * /admin/visitors is drawn out of this file and nothing else. It answers the
 * questions Google Analytics is open in a tab to answer — how many people
 * came each day, how many had been before, from which country and from
 * where, which pages they read and for how long, and what they pressed — out
 * of the site's own database, so the day Google's tag comes out the numbers
 * do not go with it. Not to be confused with ./_visits.js, which is the same
 * idea for one person's /u/<name> and is read by that person on /insights;
 * this is the whole site, and it is the owner's.
 *
 *   countArrive()   a page opened — called from POST /api/stats
 *   countLeave()    a page put away, with how long it was on screen and what
 *                   was pressed on it — the same
 *   readVisitors()  a range of it, for /admin/visitors — GET /api/admin/visitors
 *   readLive()      the last half hour, a minute at a time — GET /api/admin/live
 *
 * A VISITOR IS A BROWSER'S FIRST PAGE OF THE DAY
 *
 * assets/track.js keeps one date in the browser, `ttb.seen`: the last day
 * this browser opened a page here. A page opened on a day that is not that
 * one is the browser's first today, and it says so with `first`; `back` is
 * whether there was an earlier day at all — by `ttb.since`, the first day it
 * came, which the page takes from Google's `_ga` cookie where that remembers
 * an earlier one, since this count is younger than the site (arrive() in
 * assets/track.js). That is the whole of it. No id is
 * sent, no address is read, no fingerprint is made, and nothing here could
 * tell one visitor from another if it tried: the table hears "a new visitor
 * today" or "a returning one" and adds one.
 *
 * What that costs in accuracy, said plainly. A browser with storage switched
 * off is never a visitor, only views — undercounted rather than counted on
 * every page. Two browsers are two visitors, a phone and a laptop of the same
 * person included, and clearing site data makes a returning visitor new
 * again. GA has every one of the same limits with a cookie in place of the
 * date, which is to say this and GA should agree to within a few percent,
 * and when they do not, bots are the usual reason: a crawler that runs no
 * script never reaches this at all, and GA filters only the ones it knows.
 *
 * The date is written on to the visitor's device, and whether that needs
 * asking first is a question about the law rather than about this file.
 * **No consent banner** and **Visitors** in README.md say where it stands.
 *
 * TIME IS TIME ON SCREEN
 *
 * The page counts the seconds it is visible — a tab in the background is not
 * somebody reading — and sends them when it is hidden or put away, together
 * with the presses it tallied meanwhile: one request per stretch on screen,
 * rather than one per press. A phone that kills a tab outright sometimes
 * takes its last stretch with it, so time and presses run slightly short and
 * never long. A stretch is capped at MAX_SECS, so a tab left open on a desk
 * all afternoon adds half an hour rather than five.
 *
 * WHERE THEY CAME FROM, AND THE COUNTRY
 *
 * Read the way ./_visits.js reads them — sourceOf() and countryOf() are that
 * file's — once per visitor per day, off the first page, so a visitor who
 * came from Instagram and then read six pages is one visitor from Instagram
 * rather than six.
 *
 * NEW AGAINST RETURNING
 *
 * A visitor is new on the first day its browser ever came and returning on
 * every day after, and assets/track.js says which on every page, as `who`,
 * out of the first day it keeps in `ttb.since`. Everything a visit does is
 * then counted a second time under the `cohort` kind, `<who>:<fact>`, so the
 * page can say what a new visitor does against a returning one — pages,
 * seconds, presses, places opened, sign-ins and accounts made (FACTS below).
 * The visitors themselves are the `visitor` kind's two ids, already there.
 *
 * These began after the visitors did, so the days before the first `cohort`
 * row have visitors and nothing to divide among them. The reader counts only
 * the days that have both — see readVisitors() — and says from when.
 *
 * THE LANGUAGE IT WAS READ IN
 *
 * Under the `lang` kind, each split by new and returning the way `cohort`
 * is: `<who>:<code>`, a visitor by the language their first page today
 * arrived in — the one on screen before any switch, which is the one the
 * site chose for them — and `<who>:secs:<code>`, the seconds on screen read
 * in it. And `<from>><to>`, a press of a language switch, so somebody who
 * arrived in English and read on in Russian is one visitor in English, their
 * minutes split between the two, and one `en>ru`. All of it rides on the
 * report a page sends when it is put away, and every code is checked against
 * the languages data/ui.json speaks, so the kind is a closed list: four rows
 * a language a day at the most, and a row per pair somebody pressed.
 *
 * THE TWO RAILS
 *
 * The map deals a stranger one of two rails, and **The short rail** in
 * README.md is why. The same facts are counted a third time per rail and
 * per kind of visitor, under the `layout` kind as `<rail>:<who>:<fact>`, and
 * the visitors on each rail as `<rail>:new` and `<rail>:back`. Only a
 * browser that has been dealt one is counted there — one that has never
 * opened the map has not, and filing it under the full rail by default would
 * be comparing the short rail against everybody. How many strangers were
 * dealt each and how many opened a place on that first visit is press_counts'
 * and ./stats.js's, and ./admin/visitors.js reads it beside this.
 *
 * WHAT IS BOUNDED, AND HOW
 *
 * One row per fact per day, like profile_counts: a busy day and a quiet one
 * with the same pages in them are the same number of rows. The pages, the
 * visitor kinds, the rails and the facts counted under them are lists
 * written here — forty ids a day at the most between the `cohort` and
 * `layout` kinds — and the languages are the ones data/ui.json speaks. The
 * countries, the
 * sources and the presses are not — a host or a press name is whatever the
 * request says — so those three kinds take at most MAX_IDS ids a day each,
 * and past that only ids already counted that day go up. A press name must
 * also be shaped like one, which every name TTBTrack sends is.
 *
 * THE LAST HALF HOUR
 *
 * visitor_counts has a day as its finest grain, and "who is on the site right
 * now" wants a minute. So every page opened is also counted once into
 * visitor_live, a row per minute — and only sixty rows ever: a minute's row
 * is slot minute % 60, and the first page of a new minute takes the slot over
 * from the one an hour before, resetting its count. Nothing is deleted and
 * nothing needs pruning, the table can never grow, and it costs one write a
 * page opened and nothing per minute a page stays open.
 *
 * What it counts is pages opened, not people: somebody opening three pages
 * in five minutes is three. Telling people apart would take an id, and none
 * is made — A VISITOR IS A BROWSER'S FIRST PAGE OF THE DAY. At this site's
 * size it is a fair reading of how busy it is right now, which is what the
 * card on /admin/visitors is for.
 *
 * WHAT A FAILURE LOOKS LIKE
 *
 * Nothing, on either side. The tables arrive by hand; until they have, a
 * count answers false and /admin/visitors says the numbers are not in yet —
 * or, for visitor_live alone, leaves the card for the last half hour out.
 * The live count is its own statement rather than part of the day's batch,
 * because a batch is one transaction and a missing visitor_live would take
 * the day's facts down with it.
 */

import { sourceOf, siteOf, countryOf, networkName, today, dayBack } from './_visits.js';
import { uiStrings } from './_lib.js';

/* The ranges the page offers, in days. 1 is today so far. */
export const SPANS = [1, 7, 28, 90];

/* The pages worth telling apart, each with the string data/ui.json already
   names it by where there is one. A page is known by its address, and the
   two subdomains by their host, since both answer at the root. Anything not
   here — /admin/ above all, where the only visitor is the owner — is not
   counted. Exported for tools/validate.mjs, which holds every `page:` and
   `view:` signal in data/flows.json to these ids. */
export const PAGES = [
  { id: 'map', label: 'visitorsPageMap', paths: ['/', '/index.html'] },
  { id: 'lists', label: 'listsAllTitle', paths: ['/lists'] },
  { id: 'mine', label: 'visitorsPageMine', paths: ['/lists.html'] },
  { id: 'list', label: 'visitorsPageList', prefix: '/list/' },
  { id: 'profile', label: 'visitorsPageProfile', prefix: '/u/' },
  { id: 'blog', label: 'blogTitle', paths: ['/blog', '/blog.html'] },
  { id: 'flashcard', label: 'flashDoor', paths: ['/flashcard', '/flashcard.html'], host: 'flashcard.' },
  { id: 'split', label: 'visitorsPageSplit', paths: ['/split', '/split.html'], host: 'splitwise.' },
  { id: 'account', label: 'accountOpen', paths: ['/account', '/account.html'] },
  { id: 'edit', label: 'visitorsPageEdit', paths: ['/edit', '/edit.html'] },
  { id: 'insights', label: 'insightsTitle', paths: ['/insights', '/insights.html'] },
  { id: 'feedback', label: 'feedbackTitle', paths: ['/feedback', '/feedback.html'] },
  { id: 'deal', label: 'passTitle', paths: ['/deal', '/deal.html'] },
  { id: 'verify', label: 'verifyTitle', paths: ['/verify', '/verify.html'] },
  { id: 'staff', label: 'visitorsPageStaff', paths: ['/staff', '/staff.html'] }
];

/* The two rails, as pickLayout() in assets/app.js deals them. */
const RAILS = ['a', 'b'];

/* New and returning — see NEW AGAINST RETURNING. */
const WHO = ['new', 'back'];

/* What is counted per kind of visitor and per rail: pages opened, seconds
   on screen, presses, places opened on the map, sign-ins and accounts made.
   The last two are presses already, picked out of a report by SIGNS. */
const FACTS = ['views', 'secs', 'presses', 'places', 'login', 'signup'];
const SIGNS = { account_login: 'login', account_create: 'signup' };

/* The kinds whose ids nobody chose from a list, and how many ids a day each
   may hold — see WHAT IS BOUNDED. A hundred countries in a day would be a
   good day; a hundred press names is every button on the site. */
const OPEN = new Set(['country', 'from', 'press']);
const MAX_IDS = 100;

/* The most one stretch on screen may add — see TIME IS TIME ON SCREEN — and
   the most presses one report may carry, by name and in all. */
const MAX_SECS = 1800;
const MAX_NAMES = 20;
const MAX_PRESS = 50;
const PRESS = /^[a-z][a-z0-9_]{1,39}$/;

/* The last half hour — see THE LAST HALF HOUR. LIVE_SLOTS is the ring's
   size, and LIVE_SPAN how much of it the page is sent. */
const LIVE_SLOTS = 60;
const LIVE_SPAN = 30;
const LIVE_ADD =
  'INSERT INTO visitor_live (slot, minute, n) VALUES (?1, ?2, 1) ' +
  'ON CONFLICT(slot) DO UPDATE SET ' +
  'n = CASE WHEN visitor_live.minute = excluded.minute THEN visitor_live.n + 1 ELSE 1 END, ' +
  'minute = excluded.minute';

function minuteNow() {
  return Math.floor(Date.now() / 60000);
}

const ADD =
  'INSERT INTO visitor_counts (day, kind, id, n) VALUES (?1, ?2, ?3, ?4) ' +
  'ON CONFLICT(day, kind, id) DO UPDATE SET n = visitor_counts.n + excluded.n';

/* The same, for an OPEN kind: a new id only while the day has room for one.
   The EXISTS is a lookup on the key and comes first, so an id already
   counted today goes up without the day's ids being counted. */
const ADD_CAPPED =
  'INSERT INTO visitor_counts (day, kind, id, n) SELECT ?1, ?2, ?3, ?4 ' +
  'WHERE EXISTS (SELECT 1 FROM visitor_counts WHERE day = ?1 AND kind = ?2 AND id = ?3) ' +
  'OR (SELECT COUNT(*) FROM visitor_counts WHERE day = ?1 AND kind = ?2) < ' + MAX_IDS + ' ' +
  'ON CONFLICT(day, kind, id) DO UPDATE SET n = visitor_counts.n + excluded.n';

function add(env, day, kind, id, n) {
  return env.DB.prepare(OPEN.has(kind) ? ADD_CAPPED : ADD).bind(day, kind, id, n);
}

/* Which page a report is about, off the request's own host — the beacon is
   sent to the origin the page is on — and the path the page sends. Exported
   for ./_flows.js, which reads the same report a third way. */
export function pageOf(request, path) {
  const host = new URL(request.url).hostname;
  const at = String(path || '');
  const page = PAGES.find((p) =>
    (p.host && host.startsWith(p.host)) ||
    (p.paths && p.paths.includes(at)) ||
    (p.prefix && at.startsWith(p.prefix) && at.length > p.prefix.length));
  return page ? page.id : null;
}

/* The rail the browser was dealt, or null where it has not been dealt one. */
function railOf(body) {
  return RAILS.includes(body.layout) ? body.layout : null;
}

/* New or returning, or null where the browser could not keep the date. */
function whoOf(body) {
  return WHO.includes(body.who) ? body.who : null;
}

/* One fact about a visit, filed under its kind of visitor and, where it has
   one, under its rail as well — NEW AGAINST RETURNING and THE TWO RAILS. */
function split(facts, rail, who, fact, n) {
  if (!who || !(n > 0)) return;
  facts.push(['cohort', who + ':' + fact, n]);
  if (rail) facts.push(['layout', rail + ':' + who + ':' + fact, n]);
}

/* One batch of [kind, id, n] facts, today. True when it was counted. */
async function file(env, facts) {
  const day = today();
  try {
    await env.DB.batch(facts.map(([kind, id, n]) => add(env, day, kind, id, n)));
    return true;
  } catch (e) {
    /* No table yet, or the write failed. Nobody is waiting to hear it. */
    return false;
  }
}

/* A page opened: `id` is its path, `first` and `back` what ttb.seen said,
   `who` what ttb.since said, `from` the referrer it was opened with,
   `layout` the rail if any. */
export async function countArrive(context, body) {
  const { request, env } = context;
  const page = pageOf(request, body.id);
  if (!page) return false;
  const rail = railOf(body);

  const facts = [['view', page, 1]];
  split(facts, rail, whoOf(body), 'views', 1);
  if (body.first === true) {
    const who = body.back === true ? 'back' : 'new';
    facts.push(
      ['visitor', who, 1],
      ['country', countryOf(request), 1],
      ['from', sourceOf(body.from, request.headers.get('user-agent'), siteOf(request)), 1]
    );
    if (rail) facts.push(['layout', rail + ':' + who, 1]);
  }
  const [counted] = await Promise.all([file(env, facts), countLive(env)]);
  return counted;
}

/* One page opened, into this minute's slot — THE LAST HALF HOUR. */
async function countLive(env) {
  const minute = minuteNow();
  try {
    await env.DB.prepare(LIVE_ADD).bind(minute % LIVE_SLOTS, minute).run();
  } catch (e) {
    /* No visitor_live yet. The day's facts do not wait on it. */
  }
}

/* The last LIVE_SPAN minutes, oldest first, this one last and still
   filling: pages opened in each. Null where there is no table yet. */
export async function readLive(env) {
  const minute = minuteNow();
  let rows;
  try {
    rows = await env.DB.prepare('SELECT minute, n FROM visitor_live WHERE minute > ?')
      .bind(minute - LIVE_SPAN).all();
  } catch (e) {
    return null;
  }
  const minutes = new Array(LIVE_SPAN).fill(0);
  for (const r of rows.results || []) {
    const at = LIVE_SPAN - 1 - (minute - r.minute);
    if (at >= 0 && at < LIVE_SPAN) minutes[at] = r.n;
  }
  return minutes;
}

/* A stretch on screen ended: `secs` of it on the page at `id`, `presses`,
   { name: times }, what TTBTrack reported meanwhile, and `places`, how many
   places were opened on the map in it. `langs` is the same seconds by
   language, { code: secs }, `moved` the switches pressed, { 'from>to': n },
   and on a browser's first page today `first` is true and `lang` the
   language it arrived in. */
export async function countLeave(context, body) {
  const { request, env } = context;
  const page = pageOf(request, body.id);
  if (!page) return false;
  const rail = railOf(body);
  const who = whoOf(body);

  const facts = [];
  const secs = Math.min(MAX_SECS, Math.round(Number(body.secs) || 0));
  if (secs > 0) facts.push(['time', page, secs]);
  split(facts, rail, who, 'secs', secs);

  let pressed = 0;
  const signs = { login: 0, signup: 0 };
  const presses = body.presses && typeof body.presses === 'object' ? body.presses : {};
  for (const name of Object.keys(presses).slice(0, MAX_NAMES)) {
    const n = Math.min(MAX_PRESS, Math.round(Number(presses[name]) || 0));
    if (!PRESS.test(name) || n < 1) continue;
    facts.push(['press', name, n]);
    pressed += n;
    if (SIGNS[name]) signs[SIGNS[name]] += n;
  }
  split(facts, rail, who, 'presses', pressed);
  split(facts, rail, who, 'login', signs.login);
  split(facts, rail, who, 'signup', signs.signup);
  split(facts, rail, who, 'places', Math.min(MAX_PRESS, Math.round(Number(body.places) || 0)));
  facts.push(...await languageFacts(context, body, who));

  return facts.length ? file(env, facts) : false;
}

/* The `lang` facts a report carries — THE LANGUAGE IT WAS READ IN — with
   every code one data/ui.json speaks. The file is read only when there is
   something to check, through the cache every data file is read through;
   where it cannot be read, nothing about language is counted. */
async function languageFacts(context, body, who) {
  const langs = body.langs && typeof body.langs === 'object' ? body.langs : {};
  const moved = body.moved && typeof body.moved === 'object' ? body.moved : {};
  const arrived = who && body.first === true;
  if (!arrived && !(who && Object.keys(langs).length) && !Object.keys(moved).length) return [];

  let spoken;
  try {
    spoken = new Set(Object.keys((await uiStrings(context)) || {}));
  } catch (e) {
    return [];
  }

  const facts = [];
  if (arrived && spoken.has(body.lang)) facts.push(['lang', who + ':' + body.lang, 1]);
  for (const code of who ? Object.keys(langs).slice(0, MAX_NAMES) : []) {
    const secs = Math.min(MAX_SECS, Math.round(Number(langs[code]) || 0));
    if (spoken.has(code) && secs > 0) facts.push(['lang', who + ':secs:' + code, secs]);
  }
  for (const pair of Object.keys(moved).slice(0, MAX_NAMES)) {
    const [from, to] = pair.split('>');
    const n = Math.min(MAX_PRESS, Math.round(Number(moved[pair]) || 0));
    if (spoken.has(from) && spoken.has(to) && from !== to && n > 0) facts.push(['lang', from + '>' + to, n]);
  }
  return facts;
}

/* ------------------------------------------------------------- reading */

/* The five figures a range adds up to. */
function blank() {
  return { visitors: 0, back: 0, views: 0, secs: 0, presses: 0 };
}

/* What one kind of visitor did — the visitors and every one of FACTS. */
function facts() {
  const out = { visitors: 0 };
  for (const f of FACTS) out[f] = 0;
  return out;
}

function tally(figures, kind, id, n) {
  if (kind === 'visitor') {
    figures.visitors += n;
    if (id === 'back') figures.back += n;
  } else if (kind === 'view') figures.views += n;
  else if (kind === 'time') figures.secs += n;
  else if (kind === 'press') figures.presses += n;
}

function bump(map, id, n) {
  map.set(id, (map.get(id) || 0) + n);
}

function most(map) {
  return [...map].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));
}

/* One range, or null where there is no table yet. `ui` is the reading
 * language's block, which names the pages and the three networks.
 *
 *   span       1, 7, 28 or 90
 *   from       the first day of the range
 *   since      the first day anything was counted, or null for never
 *   split      the first day new and returning were told apart, or null
 *   now        { visitors, back, views, secs, presses } in the range
 *   before     the same over the range just before it; null for today,
 *              since a day half over set against a whole one says nothing
 *   today      { fresh, back, login, signup, rails } today so far, whatever
 *              the range, `rails` holding the same four for `a`, `b` and
 *              `none` — the visitors no rail has been dealt to yet
 *   unit       'day' or 'week' — what one bar is — or null for today
 *   series     [{ day, fresh, back }] visitors per bar, oldest first, zeros
 *              included; `day` is the first day the bar covers
 *   cohorts    [{ id, visitors, ...FACTS }] new and returning, over the
 *              days of the range that tell them apart
 *   layouts    [{ id, visitors, back, ...FACTS, fresh }] the two rails over
 *              the same days, `fresh` being the rail's new visitors alone
 *   pages      [{ id, name, views, secs }] most viewed first
 *   countries  [{ id, n }] visitors, most first
 *   sources    [{ id, name?, n }] visitors, most first
 *   presses    [{ id, n }] most first
 *   languages  [{ id, visitors: { new, back }, secs: { new, back } }] by
 *              the language visitors arrived in, most first, then by time
 *   switches   [{ id: 'from>to', n }] language switches, most first
 *
 * One read of the range and the one before it; the rest is arithmetic on at
 * most 180 days of a hundred-odd rows each.
 *
 * Who did what is counted only over the days that have `cohort` rows, and
 * the visitors divided among it only over the same days, so a range reaching
 * back past the day it began is not a week of visitors over two days of what
 * they did. */
export async function readVisitors(env, span, ui) {
  const first = dayBack(2 * span - 1);
  const cut = dayBack(span - 1);
  const day = today();
  let rows;
  let since;
  let began;
  try {
    [rows, since, began] = await Promise.all([
      env.DB.prepare('SELECT day, kind, id, n FROM visitor_counts WHERE day >= ?').bind(first).all(),
      env.DB.prepare('SELECT MIN(day) AS day FROM visitor_counts').first(),
      env.DB.prepare("SELECT MIN(day) AS day FROM visitor_counts WHERE kind = 'cohort'").first()
    ]);
  } catch (e) {
    return null;
  }
  rows = rows.results || [];

  const now = blank();
  const was = blank();
  const byDay = new Map();
  const pages = new Map();
  const countries = new Map();
  const sources = new Map();
  const presses = new Map();
  const languages = new Map();
  const switches = new Map();
  const cohorts = new Map(WHO.map((id) => [id, { id: id, ...facts() }]));
  const rails = new Map(RAILS.map((id) => [id, { id: id, back: 0, ...facts(), fresh: facts() }]));
  const quad = () => ({ fresh: 0, back: 0, login: 0, signup: 0 });
  const sofar = { ...quad(), rails: { a: quad(), b: quad(), none: quad() } };

  /* The days that tell new from returning — see the note above. */
  const told = new Set(rows.filter((r) => r.kind === 'cohort').map((r) => r.day));

  for (const r of rows) {
    const inside = r.day >= cut;
    tally(inside ? now : was, r.kind, r.id, r.n);
    if (r.day === day) countToday(sofar, r);
    if (!inside) continue;
    if (r.kind === 'visitor') {
      const d = byDay.get(r.day) || { fresh: 0, back: 0 };
      d[r.id === 'back' ? 'back' : 'fresh'] += r.n;
      byDay.set(r.day, d);
      if (told.has(r.day) && cohorts.has(r.id)) cohorts.get(r.id).visitors += r.n;
    } else if (r.kind === 'view' || r.kind === 'time') {
      const p = pages.get(r.id) || { views: 0, secs: 0 };
      p[r.kind === 'view' ? 'views' : 'secs'] += r.n;
      pages.set(r.id, p);
    } else if (r.kind === 'country') bump(countries, r.id, r.n);
    else if (r.kind === 'from') bump(sources, r.id, r.n);
    else if (r.kind === 'press') bump(presses, r.id, r.n);
    else if (r.kind === 'lang') countLanguage(languages, switches, r);
    else if (r.kind === 'cohort') {
      const [who, fact] = r.id.split(':');
      if (cohorts.has(who) && FACTS.includes(fact)) cohorts.get(who)[fact] += r.n;
    } else if (r.kind === 'layout' && told.has(r.day)) {
      const [rail, who, fact] = r.id.split(':');
      const into = rails.get(rail);
      if (!into || !WHO.includes(who)) continue;
      if (!fact) {
        into.visitors += r.n;
        if (who === 'back') into.back += r.n;
        else into.fresh.visitors += r.n;
      } else if (FACTS.includes(fact)) {
        into[fact] += r.n;
        if (who === 'new') into.fresh[fact] += r.n;
      }
    }
  }

  /* The visitors no rail has been dealt to yet are everybody less the two. */
  for (const f of ['fresh', 'back', 'login', 'signup']) {
    sofar.rails.none[f] = Math.max(0, sofar[f] - sofar.rails.a[f] - sofar.rails.b[f]);
  }

  return {
    span: span,
    from: cut,
    since: (since && since.day) || null,
    split: (began && began.day) || null,
    now: now,
    before: span > 1 ? was : null,
    today: sofar,
    ...bars(span, byDay),
    cohorts: [...cohorts.values()],
    layouts: [...rails.values()],
    pages: PAGES
      .filter((p) => pages.has(p.id))
      .map((p) => ({ id: p.id, name: ui[p.label] || p.id, ...pages.get(p.id) }))
      .sort((a, b) => b.views - a.views),
    countries: most(countries),
    sources: most(sources).map((s) => ({ ...s, name: networkName(s.id) })),
    presses: most(presses),
    languages: [...languages.values()].sort((a, b) =>
      (b.visitors.new + b.visitors.back) - (a.visitors.new + a.visitors.back) ||
      (b.secs.new + b.secs.back) - (a.secs.new + a.secs.back) || a.id.localeCompare(b.id)),
    switches: most(switches)
  };
}

/* One `lang` row into the languages or the switches — see THE LANGUAGE IT
 * WAS READ IN for the three shapes of id. */
function countLanguage(languages, switches, r) {
  const parts = r.id.split(':');
  if (parts.length === 1) return bump(switches, r.id, r.n);
  const [who, fact, code] = parts.length === 2 ? [parts[0], 'visitors', parts[1]] : parts;
  if (!WHO.includes(who) || (fact !== 'visitors' && fact !== 'secs')) return;
  const l = languages.get(code) || { id: code, visitors: { new: 0, back: 0 }, secs: { new: 0, back: 0 } };
  l[fact][who] += r.n;
  languages.set(code, l);
}

/* One of today's rows into the Today card: visitors new and returning,
 * sign-ins and accounts made, in all and per rail. */
function countToday(into, r) {
  if (r.kind === 'visitor') {
    into[r.id === 'back' ? 'back' : 'fresh'] += r.n;
  } else if (r.kind === 'cohort') {
    const fact = r.id.split(':')[1];
    if (fact === 'login' || fact === 'signup') into[fact] += r.n;
  } else if (r.kind === 'layout') {
    const [rail, who, fact] = r.id.split(':');
    const arm = into.rails[rail];
    if (!arm || !WHO.includes(who)) return;
    if (!fact) arm[who === 'back' ? 'back' : 'fresh'] += r.n;
    else if (fact === 'login' || fact === 'signup') arm[fact] += r.n;
  }
}

/* The bars under the figures: a day each for seven and twenty-eight days, a
 * week each for ninety — ninety bars on a phone is a smear — and none for
 * today, which is one bar and says nothing the figures do not. A week is
 * counted back from today, so the newest is always whole, the way the line
 * on /insights counts them. */
function bars(span, byDay) {
  if (span === 1) return { unit: null, series: null };
  const per = span === 90 ? 7 : 1;
  const series = [];
  for (let end = Math.ceil(span / per) * per - 1; end >= 0; end -= per) {
    const bar = { day: dayBack(Math.min(end, span - 1)), fresh: 0, back: 0 };
    for (let back = end; back > end - per; back--) {
      if (back > span - 1) continue;
      const d = byDay.get(dayBack(back));
      if (d) { bar.fresh += d.fresh; bar.back += d.back; }
    }
    series.push(bar);
  }
  return { unit: per === 7 ? 'week' : 'day', series: series };
}
