/**
 * Tallinn Tastebuds — who opened your page, roughly, and what they pressed.
 *
 * /insights is drawn out of this file and nothing else, and so are the one
 * number on the Insights row of /account.html and the countries under each
 * list on /admin/stats. It answers three questions
 * about /u/<you>, for its owner and nobody else: how often it was opened,
 * where the people opening it came from, and what on it they pressed.
 * Google Analytics already knows all three for the whole site; what it
 * cannot do is hand one person the slice that is about their own page.
 *
 *   countView()     one open of a profile — called from POST /api/stats
 *   countPress()    one press of something on one — the same
 *   readInsights()  a range of it, for /insights — GET /api/insights
 *   recentViews()   the last seven days' views, for the account page's row
 *   firstToday()    whether this visitor has already opened this thing today
 *                   — asked before a profile or a list open is counted
 *   countListOpen() one open of a list, filed under the country it was
 *                   opened from — called from POST /api/stats beside the
 *                   running count that orders /lists
 *   listViews()     how often each of the owner's lists has been opened, and
 *                   from which countries, for the Your lists card on
 *                   /insights
 *   listCountries() the countries under a handful of lists, by id — what
 *                   listViews() and /api/admin/stats both draw the line
 *                   under a list out of
 *
 * VIEWS, NOT PEOPLE
 *
 * The bargain press_counts makes, one floor down: nothing here is filed
 * under the person who opened the page. There is no IP, no device id and no
 * row per visit in the counts — a row is (whose page, which day, what kind
 * of fact, which one) and a number. One visitor coming back on five
 * evenings is five. The owner's own opens are not counted, so somebody
 * checking how their page looks does not climb their own number — the
 * session on the request is what says so.
 *
 * ONCE A DAY, WHOEVER IS REFRESHING
 *
 * A reload used to be another view, the way it is another page view in GA.
 * It is not any more, because the number is one somebody reads as "how many
 * people looked", and a page refreshed twenty times by one visitor — or by a
 * script, to make a list look popular — answered that wrongly. So an open of
 * a profile or of a list is counted the first time it happens in a UTC day
 * from one browser on one network, and not again until tomorrow.
 *
 * Two halves. The page remembers what it has already sent today in
 * localStorage and does not send it again, which stops the ordinary reload
 * for free and costs the server nothing. And the server keeps view_seen: one
 * row per (day, visitor, thing), where the visitor is an HMAC under
 * SAVE_SALT of the address, the user agent and the thing, the same one-way
 * fingerprint() the save cap files under. The address never reaches the
 * table, the key means nothing without the secret, and it is a different key
 * for every thing and every day, so the table cannot be joined into a trail
 * of what one visitor opened. Yesterday's rows are useless by construction
 * and deleted in passing. That half is what a script that clears storage
 * runs into; one that also changes its address every request gets through,
 * and that is the bargain — nobody is paid for the number.
 *
 * Where view_seen is not applied yet, or there is no salt, every open the
 * page sends is counted, which is the page's own once-a-day and nothing
 * more: the table arrives by hand, like every table here.
 *
 * WHERE THEY CAME FROM
 *
 * Two readings, and the second is the one that makes this worth having.
 *
 * The first is the referrer the page was opened with, which the browser
 * sends as `from` and which is almost always an origin and not an address —
 * every site that matters sends strict-origin-when-cross-origin, so a link
 * pressed on instagram.com arrives as "https://l.instagram.com/" and never
 * as the post it was under. That is enough to put it in a bucket.
 *
 * The second is the user agent, and it is there because the first so often
 * says nothing. Instagram, TikTok and Facebook open a link from a bio in a
 * browser of their own, and those browsers frequently send no referrer at
 * all — which is why a view from Instagram usually reads as "direct" in any
 * counter that only reads the referrer, and why GA only "sometimes" says
 * Instagram. Each of those in-app browsers names itself in its user agent,
 * though: "Instagram 312.0…", "BytedanceWebview" or "musical_ly", "FBAN" or
 * "FBAV". That is read first, because it is the more certain of the two,
 * and it is read on the server off the request the beacon arrives on, so the
 * page sends nothing it was not already sending.
 *
 * What neither can see is a link pasted into a chat, a QR code, or a typed
 * address. Those are Direct, and the page says so rather than guessing.
 *
 * A host that is none of the named buckets is kept as the host itself —
 * linktr.ee, t.co, a friend's blog — without its www. and cut to
 * SOURCE_MAX characters. That is the one id here nobody chose from a
 * list, and it is bounded by the day: a page opened from a hundred sites on
 * one day is a hundred rows on that day, which is a problem this site would
 * be glad to have.
 *
 * AND THE COUNTRY
 *
 * Cloudflare's own two letters, request.cf.country, which Cloudflare works
 * out from the address and hands every request whatever this code does. The
 * address itself is never read here. "XX" is Cloudflare not knowing and "T1"
 * is Tor, and both are kept as they come — the page prints them as "Unknown".
 *
 * WHAT A PRESS IS
 *
 * The things on a profile that lead somewhere, and nothing else:
 *
 *   row:<title>    a row on the page of links — a link followed, a player
 *                  opened, a note opened. Filed under its title, because a
 *                  row has no id of its own (profile_rows is keyed on its
 *                  position, which moves every time the owner reorders the
 *                  page) and the title is what the owner will recognise. A
 *                  row renamed keeps its old presses under the old title,
 *                  which /insights drops once the title is no longer on the
 *                  page — see named().
 *   net:<id>       one of the three handles, by network — NETWORKS in
 *                  ./_profile.js.
 *   list:<id>      one of their public lists, from the card a profile
 *                  without rows is.
 *
 * A row and a list are checked against the owner's own page before they
 * are counted, and a handle against the three networks there are, so the
 * table only ever holds things a profile can draw.
 *
 * A press is also filed under where the person pressing it came from, the
 * same bucket their view was — the page sends the referrer with the press
 * as it did with the view, and the user agent is on the request either way.
 * That is what "clicks" and "click rate" per source on /insights are made
 * of. It started a while after the views did, so a range reaching back past
 * that day has presses with no source; readInsights() says so rather than
 * letting the rows quietly add up to less than the total.
 *
 * ONE ROW PER THING PER DAY, AND WHY THE DAY
 *
 * press_counts has no time in it, and its header says the day it is wanted
 * the change is a `day` column and one row per thing per day. This is that
 * table, for profiles, because /insights is read over a range — seven days,
 * twenty-eight, ninety or all of it — and drawn as a line over time: a page
 * somebody put in their Instagram bio in March is a different page from the
 * one they are looking at now, and an all-time number alone would never say
 * which.
 *
 * Nothing is ever deleted, so all-time is all of it. The size is bounded by
 * the days × the handful of sources, countries and rows on one page, which
 * for a page opened a few dozen times a day is a few thousand rows a year.
 * The day that stops being small the answer is a monthly roll-up, and it is
 * not worth writing before then.
 *
 * WHAT A FAILURE LOOKS LIKE
 *
 * Nothing, on either side. The table arrives by hand, like every table here;
 * until it has, a count answers false, the account page's row carries no
 * number, and /insights says the numbers are not switched on here yet.
 */

import { sessionUser, clientIp, hmacHex } from './_lib.js';
import { NETWORKS, USERNAME, readRows } from './_profile.js';
import { LIST_ID } from './_lists.js';

/* How long a host kept as a source may be. A real one is a dozen characters;
   this is only so a hand-written request cannot file a paragraph. */
const SOURCE_MAX = 64;

/* The named buckets, most certain first. `ua` is the in-app browser naming
   itself; `hosts` is the referrer's host or anything under it. Instagram
   before Facebook, because Instagram's in-app browser has at times carried
   Facebook's markers as well as its own. */
const SOURCES = [
  { id: 'instagram', ua: /\bInstagram\b/, hosts: ['instagram.com'] },
  { id: 'tiktok', ua: /BytedanceWebview|musical_ly|\bTikTok\b/i, hosts: ['tiktok.com'] },
  { id: 'facebook', ua: /\bFBA[NV]\b|FB_IAB|\bFB4A\b/, hosts: ['facebook.com', 'fb.com', 'fb.me', 'messenger.com'] },
  { id: 'search', ua: null, hosts: ['bing.com', 'duckduckgo.com', 'yandex.ru', 'yandex.com', 'ecosia.org', 'search.yahoo.com'] }
];

/* One of the buckets above, `here` for this site itself, `direct` for
   nothing at all — the page names those out of data/ui.json — or a host. */
export function sourceOf(from, ua, siteHost) {
  const agent = String(ua || '');
  for (const s of SOURCES) if (s.ua && s.ua.test(agent)) return s.id;

  let host = '';
  try {
    host = from ? new URL(String(from)).hostname.toLowerCase() : '';
  } catch (e) {
    host = '';
  }
  host = host.replace(/^www\./, '');
  if (!host) return 'direct';
  if (host === siteHost || host.endsWith('.' + siteHost)) return 'here';

  for (const s of SOURCES) {
    /* google.com, google.ee, google.co.uk and the rest: a search engine
       answers on a domain per country, and a bucket per domain would split
       one source into ten. */
    if (s.id === 'search' && /(^|\.)google\.[a-z.]{2,6}$/.test(host)) return 'search';
    if (s.hosts.some((h) => host === h || host.endsWith('.' + h))) return s.id;
  }
  return /^[a-z0-9.-]+$/.test(host) ? host.slice(-SOURCE_MAX) : 'direct';
}

/* This site's own host, which is what a referrer from a byline or the
   directory carries — and on a preview or pages dev, that host instead. */
export function siteOf(request) {
  return new URL(request.url).hostname.replace(/^www\./, '');
}

/* Today in UTC, as the table files it. UTC rather than Tallinn's clock
   because the Workers runtime has no time zones worth trusting and a day's
   boundary landing at two or three in the morning here costs nothing.
   Exported with dayBack() and the three readings above and below, because
   ./_visitors.js files the whole site's days by the same clock. */
export function today() {
  return new Date().toISOString().slice(0, 10);
}

/* The day `back` days before today, as the table files it. */
export function dayBack(back) {
  return new Date(Date.now() - back * 86400000).toISOString().slice(0, 10);
}

/* The owner of /u/<name>, or null — and null as well when it is the person
   asking, so their own opens and presses are never counted. */
async function ownerOf(request, env, name) {
  const who = String(name || '').trim().toLowerCase();
  if (!USERNAME.test(who)) return null;
  const row = await env.DB
    .prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE')
    .bind(who)
    .first();
  if (!row) return null;
  const me = await sessionUser(request, env);
  if (me && me.id === row.id) return null;
  return row.id;
}

/* One upsert statement, made ready for a batch. */
function bump(env, owner, day, kind, id) {
  return env.DB
    .prepare(
      'INSERT INTO profile_counts (owner, day, kind, id, n) VALUES (?, ?, ?, ?, 1) ' +
      'ON CONFLICT(owner, day, kind, id) DO UPDATE SET n = profile_counts.n + 1'
    )
    .bind(owner, day, kind, id);
}

/* One open of /u/<name>. Two rows move, in one batch: where it came from and
   which country. The number of views is the sum of the first, so there is no
   third row to disagree with it. True when it was counted. */
export async function countView(context, name, from) {
  const { request, env } = context;
  try {
    const owner = await ownerOf(request, env, name);
    if (!owner) return false;
    if (!(await firstToday(context, 'profile', owner))) return false;
    const source = sourceOf(from, request.headers.get('user-agent'), siteOf(request));
    const day = today();
    await env.DB.batch([
      bump(env, owner, day, 'from', source),
      bump(env, owner, day, 'country', countryOf(request))
    ]);
    return true;
  } catch (e) {
    /* No table yet, or the write failed. Nobody is waiting to hear it. */
    return false;
  }
}

/* Whether this is the first time today that this visitor has opened this
 * thing — ONCE A DAY, WHOEVER IS REFRESHING above. `kind` and `id` name the
 * thing ('profile' and the owner's id, 'list' and the list's), and they go
 * into the key rather than beside it, so no two rows share anything a
 * reader could line up.
 *
 * One INSERT OR IGNORE, and the answer is whether it inserted: two opens in
 * the same instant cannot both be first. True — count it — wherever the
 * question cannot be asked: no salt, no table, a write that failed. Missing
 * a repeat costs one extra view; refusing a real one because a table was
 * not applied yet would stop the counting altogether.
 *
 * Yesterday's rows go one time in twenty, after the answer, so the table
 * holds about a day and the delete is not a second write on every open. */
export async function firstToday(context, kind, id) {
  const { request, env } = context;
  if (!env.SAVE_SALT) return true;
  const day = today();
  try {
    const key = (await hmacHex(env.SAVE_SALT,
      'seen|' + day + '|' + kind + '|' + id + '|' + clientIp(request) + '|' + (request.headers.get('user-agent') || '')
    )).slice(0, 32);
    const out = await env.DB
      .prepare('INSERT OR IGNORE INTO view_seen (day, key) VALUES (?, ?)')
      .bind(day, key)
      .run();
    if (Math.random() < 0.05) {
      context.waitUntil(env.DB.prepare('DELETE FROM view_seen WHERE day < ?').bind(day).run().catch(() => {}));
    }
    return !(out && out.meta && out.meta.changes === 0);
  } catch (e) {
    return true;
  }
}

/* The country a request came from, as Cloudflare's two letters — see AND
   THE COUNTRY above. */
export function countryOf(request) {
  const code = String((request.cf && request.cf.country) || '');
  return /^[A-Z][A-Z0-9]$/.test(code) ? code : 'XX';
}

/* One open of a list, filed under the country it was opened from — the same
 * two letters a profile's view is filed under, into list_counts: one row per
 * list, per day, per country. POST /api/stats calls it after the running
 * count in press_counts has moved and after the same three questions have
 * been answered — a public list, not its owner, the first time today from
 * this visitor — so the two tables count the same opens, and this one is the
 * half with a day and a place in it. Its own statement rather than a batch
 * with the running count, so a database this table has not reached yet still
 * orders /lists; a write that fails is nothing anybody is waiting to hear. */
export async function countListOpen(context, list) {
  const { request, env } = context;
  try {
    await env.DB
      .prepare(
        'INSERT INTO list_counts (list, day, kind, id, n) VALUES (?, ?, ?, ?, 1) ' +
        'ON CONFLICT(list, day, kind, id) DO UPDATE SET n = list_counts.n + 1'
      )
      .bind(list, today(), 'country', countryOf(request))
      .run();
  } catch (e) {
    /* No table yet, or the write failed. */
  }
}

/* One press of something on /u/<name>, checked against that page, and
   filed twice in one batch: what was pressed, and where the person pressing
   it came from. */
export async function countPress(context, name, what, from) {
  const { request, env } = context;
  const id = String(what || '');
  if (!id || id.length > 80) return false;
  try {
    const owner = await ownerOf(request, env, name);
    if (!owner) return false;
    if (!(await onTheirPage(env, owner, id))) return false;
    const day = today();
    await env.DB.batch([
      bump(env, owner, day, 'press', id),
      bump(env, owner, day, 'clicks', sourceOf(from, request.headers.get('user-agent'), siteOf(request)))
    ]);
    return true;
  } catch (e) {
    return false;
  }
}

/* Whether that press names something actually on the owner's page. */
async function onTheirPage(env, owner, id) {
  if (id.startsWith('net:')) {
    return NETWORKS.some((n) => 'net:' + n.id === id);
  }
  if (id.startsWith('row:')) {
    const title = id.slice(4);
    return (await readRows(env, owner)).some((r) => r.title === title);
  }
  if (id.startsWith('list:')) {
    const list = id.slice(5);
    if (!LIST_ID.test(list)) return false;
    const row = await env.DB
      .prepare('SELECT 1 AS ok FROM lists WHERE id = ? AND owner = ? AND public = 1')
      .bind(list, owner)
      .first();
    return !!row;
  }
  return false;
}

/* The ranges /insights offers, in days, and 0 for all of it. Nothing else
   is answered: a range is a question somebody pressed a chip to ask, and a
   hand-written ?days=4000 is a scan of the table nobody asked for. */
export const SPANS = [7, 28, 90, 0];

/* The last seven days' views, for the number on the account page's Insights
   row, or null where there is no table yet. One indexed read. */
export async function recentViews(env, owner) {
  try {
    const row = await env.DB
      .prepare("SELECT SUM(n) AS n FROM profile_counts WHERE owner = ? AND kind = 'from' AND day >= ?")
      .bind(owner, dayBack(6))
      .first();
    return (row && row.n) || 0;
  } catch (e) {
    return null;
  }
}

/* Every list the owner has, with how often each has been opened, most first,
 * and from which countries — or null where the lists cannot be read.
 *
 *   [{ id, title, public, n, country }]
 *
 * `n` is all time and not the range the page is on: a list's opens are one
 * running number in press_counts under kind 'list' — what orders /lists —
 * and have no day in them to cut by. The page says so under the card rather
 * than letting the range chips above it seem to apply. `country` is [{ id,
 * n }], most first, out of list_counts through listCountries() below, and
 * all time as well; it is null where that table is not applied, so the page
 * draws no line rather than a line of nothing, and its rows add up to less
 * than `n` for a list opened before the table existed. Private lists are
 * there too, with the number they had when they were last public, since
 * functions/api/stats.js stops counting a list the moment it is not; a list
 * never public reads 0.
 *
 * One read, the owner's lists joined to their counts on the primary key, and
 * one more for the countries. A database without press_counts answers the
 * lists with noughts rather than nothing, the way readingOpens() in
 * ./_mostkept.js survives the same. */
export async function listViews(env, owner) {
  const read = (opens) => env.DB
    .prepare(
      'SELECT l.id, l.title, l.public, ' + (opens ? 'COALESCE(p.n, 0)' : '0') + ' AS n FROM lists l ' +
      (opens ? "LEFT JOIN press_counts p ON p.kind = 'list' AND p.id = l.id " : '') +
      'WHERE l.owner = ? ORDER BY n DESC, l.updated_at DESC, l.id ASC'
    )
    .bind(owner)
    .all();
  let results;
  try {
    ({ results } = await read(true));
  } catch (e) {
    try {
      ({ results } = await read(false));
    } catch (e2) {
      return null;
    }
  }
  const lists = (results || []).map((r) => ({ id: r.id, title: r.title, public: r.public === 1, n: r.n || 0 }));
  const where = await listCountries(env, lists.map((l) => l.id));
  return lists.map((l) => ({ ...l, country: where ? where.get(l.id) || [] : null }));
}

/* How many lists one statement asks about. D1 binds a hundred parameters at
   most, and fifty leaves room for the rest of any statement that joins in. */
const LIST_BATCH = 50;

/* The countries each of those lists has been opened from, all time —
 * Map(list → [{ id, n }], most first) — or null where list_counts is not
 * applied yet, so a reader can tell "nowhere" from "not counted". A list
 * with no rows is simply absent from the map, and the callers read that as
 * an empty line.
 *
 * Grouped over the days in the statement, LIST_BATCH ids at a time, which
 * is one read for anybody's own lists and one or two for the site's. */
export async function listCountries(env, ids) {
  const out = new Map();
  for (let at = 0; at < ids.length; at += LIST_BATCH) {
    const batch = ids.slice(at, at + LIST_BATCH);
    let rows;
    try {
      rows = (await env.DB
        .prepare(
          'SELECT list, id, SUM(n) AS n FROM list_counts ' +
          "WHERE kind = 'country' AND list IN (" + batch.map(() => '?').join(',') + ') ' +
          'GROUP BY list, id ORDER BY n DESC, id ASC'
        )
        .bind(...batch)
        .all()).results || [];
    } catch (e) {
      return null;
    }
    for (const r of rows) {
      if (!out.has(r.list)) out.set(r.list, []);
      out.get(r.list).push({ id: r.id, n: r.n || 0 });
    }
  }
  return out;
}

/* One range of the owner's numbers, or null where there is no table yet.
 *
 *   span      7, 28, 90, or 0 for all of it
 *   ever      views since counting began — 0 is a page never opened
 *   views     in the range
 *   clicks    in the range: every press of anything on the page
 *   before    { views, clicks } over the same length just before it, or null
 *             for all time, which has nothing before it
 *   unit      'day', 'week' or 'month' — what one point on the line is
 *   series    [{ day, n }] views per point, oldest first, zeros included;
 *             `day` is the first day the point covers
 *   from      [{ id, name?, views, clicks }] where they came from, most
 *             views first; `name` is the network's own for the three that
 *             are one, and the page names the rest
 *   untold    presses in the range with no source filed against them —
 *             the ones from before sources were counted for clicks
 *   country   [{ id, n }] two letters, most first
 *   press     [{ id, name, n }] what was pressed, most first
 *
 * One read covers the range and the one before it, grouped by day, and the
 * rest is arithmetic here: at most 180 days of a handful of facts each,
 * and for all of it a page's whole history, which is the size the header
 * says it is. A press on something no longer on the page — a row renamed or
 * taken down, a list made private or deleted — is dropped from `press` but
 * still counted in `clicks`, because it happened.
 */
export async function readInsights(env, owner, span) {
  const first = span ? dayBack(2 * span - 1) : '';
  const cut = span ? dayBack(span - 1) : '';
  let rows;
  try {
    rows = (await env.DB
      .prepare(
        'SELECT day, kind, id, SUM(n) AS n FROM profile_counts ' +
        'WHERE owner = ? AND day >= ? GROUP BY day, kind, id'
      )
      .bind(owner, first)
      .all()).results || [];
  } catch (e) {
    return null;
  }

  /* Views since counting began, which only all time already has in hand. */
  let ever = 0;
  let born = '';
  if (span) {
    const row = await env.DB
      .prepare("SELECT SUM(n) AS n, MIN(day) AS born FROM profile_counts WHERE owner = ? AND kind = 'from'")
      .bind(owner)
      .first();
    ever = (row && row.n) || 0;
    born = (row && row.born) || '';
  }

  const now = { views: 0, clicks: 0 };
  const was = { views: 0, clicks: 0 };
  const byDay = new Map();
  const from = new Map();
  const country = new Map();
  const pressed = new Map();
  let told = 0;

  for (const r of rows) {
    const inside = r.day >= cut;
    const side = inside ? now : was;
    if (r.kind === 'from') side.views += r.n;
    if (r.kind === 'press') side.clicks += r.n;
    if (!span && r.kind === 'from' && (!born || r.day < born)) born = r.day;
    if (!inside) continue;
    if (r.kind === 'from') {
      add(byDay, r.day, r.n);
      const f = from.get(r.id) || { id: r.id, name: networkName(r.id), views: 0, clicks: 0 };
      f.views += r.n;
      from.set(r.id, f);
    } else if (r.kind === 'clicks') {
      const f = from.get(r.id) || { id: r.id, name: networkName(r.id), views: 0, clicks: 0 };
      f.clicks += r.n;
      from.set(r.id, f);
      told += r.n;
    } else if (r.kind === 'country') {
      add(country, r.id, r.n);
    } else if (r.kind === 'press') {
      add(pressed, r.id, r.n);
    }
  }
  if (!span) ever = now.views;

  const most = (a, b) => b.n - a.n || String(a.id).localeCompare(String(b.id));
  let press;
  try {
    press = await named(env, owner, [...pressed].map(([id, n]) => ({ id, n })));
  } catch (e) {
    /* The names are the one part of this that reads other tables, and the
       page must not go down because one of them did. */
    press = [];
  }

  const line = series(span, born, byDay);
  return {
    span: span,
    ever: ever,
    views: now.views,
    clicks: now.clicks,
    before: span ? was : null,
    unit: line.unit,
    series: line.points,
    from: [...from.values()].sort((a, b) => b.views - a.views || b.clicks - a.clicks || a.id.localeCompare(b.id)),
    untold: Math.max(0, now.clicks - told),
    country: [...country].map(([id, n]) => ({ id, n })).sort(most),
    press: press.sort(most)
  };
}

/* The line: a point a day for seven and twenty-eight, a week for ninety —
 * ninety points on a phone is a smear — and a month for all of it, from the
 * month the page was first opened. Every point is there, zeros included,
 * because a day nobody came is part of the shape. A week is counted back
 * from today, so the newest point is always a whole week and the oldest may
 * be a few days short; the page says which day each one starts. */
function series(span, born, byDay) {
  if (span === 7 || span === 28) {
    const points = [];
    for (let back = span - 1; back >= 0; back--) {
      const day = dayBack(back);
      points.push({ day: day, n: byDay.get(day) || 0 });
    }
    return { unit: 'day', points: points };
  }
  if (span === 90) {
    const points = [];
    for (let week = Math.ceil(span / 7) - 1; week >= 0; week--) {
      const last = week * 7;
      const oldest = Math.min(last + 6, span - 1);
      let n = 0;
      for (let back = last; back <= oldest; back++) n += byDay.get(dayBack(back)) || 0;
      points.push({ day: dayBack(oldest), n: n });
    }
    return { unit: 'week', points: points };
  }
  const months = new Map();
  for (const [day, n] of byDay) add(months, day.slice(0, 7), n);
  const points = [];
  const end = today().slice(0, 7);
  let at = (born || today()).slice(0, 7);
  while (at <= end) {
    points.push({ day: at + '-01', n: months.get(at) || 0 });
    const [y, m] = at.split('-').map(Number);
    at = m === 12 ? (y + 1) + '-01' : y + '-' + String(m + 1).padStart(2, '0');
  }
  return { unit: 'month', points: points };
}

function add(map, id, n) {
  map.set(id, (map.get(id) || 0) + n);
}

/* Instagram, TikTok, Facebook — the brand's own name, which is the same in
   every language and is already written in NETWORKS, so the account page
   does not have to load assets/links.js to say it. Undefined for anything
   else, and dropped from the answer with it. */
export function networkName(id) {
  const net = NETWORKS.find((n) => n.id === id);
  return net ? net.label : undefined;
}

/* The presses that are still on the page, each with the name the card
   prints. One read of the rows and one of the lists, whatever was pressed. */
async function named(env, owner, pressed) {
  if (!pressed.length) return [];
  const titles = new Set((await readRows(env, owner)).map((r) => r.title));
  const lists = new Map();
  if (pressed.some((p) => p.id.startsWith('list:'))) {
    try {
      const { results } = await env.DB
        .prepare('SELECT id, title FROM lists WHERE owner = ? AND public = 1')
        .bind(owner)
        .all();
      for (const l of results || []) lists.set(l.id, l.title);
    } catch (e) { /* no lists to name, so none are printed */ }
  }

  const out = [];
  for (const p of pressed) {
    if (p.id.startsWith('row:') && titles.has(p.id.slice(4))) {
      out.push({ id: p.id, name: p.id.slice(4), n: p.n });
    } else if (p.id.startsWith('list:') && lists.has(p.id.slice(5))) {
      out.push({ id: p.id, name: lists.get(p.id.slice(5)), n: p.n });
    } else if (p.id.startsWith('net:') && NETWORKS.some((n) => 'net:' + n.id === p.id)) {
      out.push({ id: p.id, name: networkName(p.id.slice(4)), n: p.n });
    }
  }
  return out;
}
