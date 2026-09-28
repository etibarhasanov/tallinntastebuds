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
 *
 * A VISITOR IS A BROWSER'S FIRST PAGE OF THE DAY
 *
 * assets/track.js keeps one date in the browser, `ttb.seen`: the last day
 * this browser opened a page here. A page opened on a day that is not that
 * one is the browser's first today, and it says so with `first`; `back` is
 * whether there was an earlier day at all. That is the whole of it. No id is
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
 * THE TWO RAILS
 *
 * The map deals a stranger one of two rails, and **The short rail** in
 * README.md is why. /admin/stats says how many were dealt each and how many
 * opened a place; this says how each did afterwards, under the `layout`
 * kind: visitors, returning ones, views, seconds and presses, per rail. Only
 * a browser that has been dealt one is counted there — one that has never
 * opened the map has not, and filing it under the full rail by default would
 * be comparing the short rail against everybody.
 *
 * WHAT IS BOUNDED, AND HOW
 *
 * One row per fact per day, like profile_counts: a busy day and a quiet one
 * with the same pages in them are the same number of rows. The pages, the
 * visitor kinds and the rails are lists written here. The countries, the
 * sources and the presses are not — a host or a press name is whatever the
 * request says — so those three kinds take at most MAX_IDS ids a day each,
 * and past that only ids already counted that day go up. A press name must
 * also be shaped like one, which every name TTBTrack sends is.
 *
 * WHAT A FAILURE LOOKS LIKE
 *
 * Nothing, on either side. The table arrives by hand; until it has, a count
 * answers false and /admin/visitors says the numbers are not in yet.
 */

import { sourceOf, siteOf, countryOf, networkName, today, dayBack } from './_visits.js';

/* The ranges the page offers, in days. 1 is today so far. */
export const SPANS = [1, 7, 28, 90];

/* The pages worth telling apart, each with the string data/ui.json already
   names it by where there is one. A page is known by its address, and the
   two subdomains by their host, since both answer at the root. Anything not
   here — /admin/ above all, where the only visitor is the owner — is not
   counted. */
const PAGES = [
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
   sent to the origin the page is on — and the path the page sends. */
function pageOf(request, path) {
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
   `from` the referrer it was opened with, `layout` the rail if any. */
export async function countArrive(context, body) {
  const { request, env } = context;
  const page = pageOf(request, body.id);
  if (!page) return false;
  const rail = railOf(body);

  const facts = [['view', page, 1]];
  if (rail) facts.push(['layout', rail + ':views', 1]);
  if (body.first === true) {
    const who = body.back === true ? 'back' : 'new';
    facts.push(
      ['visitor', who, 1],
      ['country', countryOf(request), 1],
      ['from', sourceOf(body.from, request.headers.get('user-agent'), siteOf(request)), 1]
    );
    if (rail) facts.push(['layout', rail + ':' + who, 1]);
  }
  return file(env, facts);
}

/* A stretch on screen ended: `secs` of it on the page at `id`, and `presses`,
   { name: times }, what TTBTrack reported meanwhile. */
export async function countLeave(context, body) {
  const { request, env } = context;
  const page = pageOf(request, body.id);
  if (!page) return false;
  const rail = railOf(body);

  const facts = [];
  const secs = Math.min(MAX_SECS, Math.round(Number(body.secs) || 0));
  if (secs > 0) {
    facts.push(['time', page, secs]);
    if (rail) facts.push(['layout', rail + ':secs', secs]);
  }

  let pressed = 0;
  const presses = body.presses && typeof body.presses === 'object' ? body.presses : {};
  for (const name of Object.keys(presses).slice(0, MAX_NAMES)) {
    const n = Math.min(MAX_PRESS, Math.round(Number(presses[name]) || 0));
    if (!PRESS.test(name) || n < 1) continue;
    facts.push(['press', name, n]);
    pressed += n;
  }
  if (rail && pressed) facts.push(['layout', rail + ':presses', pressed]);

  return facts.length ? file(env, facts) : false;
}

/* ------------------------------------------------------------- reading */

/* The five figures a range adds up to. */
function blank() {
  return { visitors: 0, back: 0, views: 0, secs: 0, presses: 0 };
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
 *   since      the first day anything was counted, or null for never
 *   now        { visitors, back, views, secs, presses } in the range
 *   before     the same over the range just before it; null for today,
 *              since a day half over set against a whole one says nothing
 *   unit       'day' or 'week' — what one bar is — or null for today
 *   series     [{ day, fresh, back }] visitors per bar, oldest first, zeros
 *              included; `day` is the first day the bar covers
 *   pages      [{ id, name, views, secs }] most viewed first
 *   countries  [{ id, n }] visitors, most first
 *   sources    [{ id, name?, n }] visitors, most first
 *   presses    [{ id, n }] most first
 *   layouts    [{ id, visitors, back, views, secs, presses }] the two rails
 *
 * One read of the range and the one before it; the rest is arithmetic on at
 * most 180 days of a few dozen rows each. */
export async function readVisitors(env, span, ui) {
  const first = dayBack(2 * span - 1);
  const cut = dayBack(span - 1);
  let rows;
  let since;
  try {
    [rows, since] = await Promise.all([
      env.DB.prepare('SELECT day, kind, id, n FROM visitor_counts WHERE day >= ?').bind(first).all(),
      env.DB.prepare('SELECT MIN(day) AS day FROM visitor_counts').first()
    ]);
  } catch (e) {
    return null;
  }

  const now = blank();
  const was = blank();
  const byDay = new Map();
  const pages = new Map();
  const countries = new Map();
  const sources = new Map();
  const presses = new Map();
  const rails = new Map(RAILS.map((id) => [id, { id: id, ...blank() }]));

  for (const r of rows.results || []) {
    const inside = r.day >= cut;
    tally(inside ? now : was, r.kind, r.id, r.n);
    if (!inside) continue;
    if (r.kind === 'visitor') {
      const d = byDay.get(r.day) || { fresh: 0, back: 0 };
      d[r.id === 'back' ? 'back' : 'fresh'] += r.n;
      byDay.set(r.day, d);
    } else if (r.kind === 'view' || r.kind === 'time') {
      const p = pages.get(r.id) || { views: 0, secs: 0 };
      p[r.kind === 'view' ? 'views' : 'secs'] += r.n;
      pages.set(r.id, p);
    } else if (r.kind === 'country') bump(countries, r.id, r.n);
    else if (r.kind === 'from') bump(sources, r.id, r.n);
    else if (r.kind === 'press') bump(presses, r.id, r.n);
    else if (r.kind === 'layout') {
      const [rail, fact] = r.id.split(':');
      const into = rails.get(rail);
      if (!into) continue;
      if (fact === 'new' || fact === 'back') {
        into.visitors += r.n;
        if (fact === 'back') into.back += r.n;
      } else if (fact === 'views' || fact === 'secs' || fact === 'presses') into[fact] += r.n;
    }
  }

  return {
    span: span,
    since: (since && since.day) || null,
    now: now,
    before: span > 1 ? was : null,
    ...bars(span, byDay),
    pages: PAGES
      .filter((p) => pages.has(p.id))
      .map((p) => ({ id: p.id, name: ui[p.label] || p.id, ...pages.get(p.id) }))
      .sort((a, b) => b.views - a.views),
    countries: most(countries),
    sources: most(sources).map((s) => ({ ...s, name: networkName(s.id) })),
    presses: most(presses),
    layouts: [...rails.values()]
  };
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
