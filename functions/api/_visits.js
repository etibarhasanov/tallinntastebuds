/**
 * Tallinn Tastebuds — who opened your page, roughly, and what they pressed.
 *
 * The card on /account.html headed "Your page, lately" is drawn out of this
 * file and nothing else. It answers three questions about /u/<you>, for its
 * owner and nobody else: how often it was opened, where the people opening
 * it came from, and what on it they pressed. Google Analytics already knows
 * all three for the whole site; what it cannot do is hand one person the
 * slice that is about their own page, on the page where they manage it.
 *
 *   countView()    one open of a profile — called from POST /api/stats
 *   countPress()   one press of something on one — the same
 *   readVisits()   the owner's summary — called from GET /api/account
 *
 * VIEWS, NOT PEOPLE
 *
 * The bargain press_counts makes, one floor down: nothing here is filed
 * under the person who opened the page. There is no IP, no device id, no
 * fingerprint, and no row per visit — a row is (whose page, which day, what
 * kind of fact, which one) and a number. A reload is another view, the way
 * it is another page view in GA, and one visitor coming back on five
 * evenings is five. The owner's own opens are not counted, so somebody
 * checking how their page looks does not climb their own number — the
 * session on the request is what says so, and that is the only use this
 * file makes of it.
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
 * address. Those are Direct, and the card says so rather than guessing.
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
 * is Tor, and both are kept as they come — the card prints them as "Unknown".
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
 *                  which the card drops once the title is no longer on the
 *                  page — see readVisits().
 *   net:<id>       one of the three handles, by network — NETWORKS in
 *                  ./_profile.js.
 *   list:<id>      one of their public lists, from the card a profile
 *                  without rows is.
 *
 * A row and a list are checked against the owner's own page before they
 * are counted, and a handle against the three networks there are, so the
 * table only ever holds things a profile can draw.
 *
 * ONE ROW PER THING PER DAY, AND WHY THE DAY
 *
 * press_counts has no time in it, and its header says the day it is wanted
 * the change is a `day` column and one row per thing per day. This is that
 * table, for profiles, because the card leads with the last thirty days: a
 * page somebody put in their Instagram bio in March is a different page from
 * the one they are looking at now, and an all-time number alone would never
 * say which. All-time is the SUM over every day, read beside it.
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
 * until it has, a count answers false and the account page is not sent a
 * `visits` field at all, so the card is simply not drawn.
 */

import { sessionUser } from './_lib.js';
import { NETWORKS, USERNAME, readRows } from './_profile.js';
import { LIST_ID } from './_lists.js';

/* The window the card leads with. Thirty days rather than "this month": on
   the second of the month a calendar month is two days of nothing. */
const RECENT_DAYS = 30;

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

/* Today in UTC, as the table files it. UTC rather than Tallinn's clock
   because the Workers runtime has no time zones worth trusting and a day's
   boundary landing at two or three in the morning here costs nothing. */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/* The first day inside the window, as a string that compares as one. */
function since(days) {
  return new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
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
    const site = new URL(request.url).hostname.replace(/^www\./, '');
    const source = sourceOf(from, request.headers.get('user-agent'), site);
    const country = /^[A-Z][A-Z0-9]$/.test(String((request.cf && request.cf.country) || ''))
      ? request.cf.country
      : 'XX';
    const day = today();
    await env.DB.batch([
      bump(env, owner, day, 'from', source),
      bump(env, owner, day, 'country', country)
    ]);
    return true;
  } catch (e) {
    /* No table yet, or the write failed. Nobody is waiting to hear it. */
    return false;
  }
}

/* One press of something on /u/<name>, checked against that page. */
export async function countPress(context, name, what) {
  const { request, env } = context;
  const id = String(what || '');
  if (!id || id.length > 80) return false;
  try {
    const owner = await ownerOf(request, env, name);
    if (!owner) return false;
    if (!(await onTheirPage(env, owner, id))) return false;
    await bump(env, owner, today(), 'press', id).run();
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

/* The owner's summary, or null where there is no table yet.
 *
 *   views    { recent, total }   opens in the last RECENT_DAYS, and ever
 *   from     [{ id, name?, n }]  where they came from, recent, most first;
 *                                `name` is the network's own for the three
 *                                that are one, and the page names the rest
 *   country  [{ id, n }]         two letters, recent, most first
 *   press    [{ id, name, n }]   what was pressed, recent, most first; `name`
 *                                is the row's title, the list's, or the
 *                                network's
 *
 * The three lists are the recent window only, because that is what the card
 * is about; all-time is one number beside it and not three more tables. A
 * press on something no longer on the page — a row renamed or taken down, a
 * list made private or deleted — is dropped: the card is about the page as
 * it stands, and a title nobody can find on it is a question with no answer.
 */
export async function readVisits(env, owner) {
  let rows;
  try {
    rows = (await env.DB
      .prepare(
        'SELECT kind, id, SUM(n) AS total, SUM(CASE WHEN day >= ? THEN n ELSE 0 END) AS recent ' +
        'FROM profile_counts WHERE owner = ? GROUP BY kind, id'
      )
      .bind(since(RECENT_DAYS), owner)
      .all()).results || [];
  } catch (e) {
    return null;
  }

  const views = { recent: 0, total: 0 };
  const from = [];
  const country = [];
  const pressed = [];
  for (const r of rows) {
    if (r.kind === 'from') {
      views.recent += r.recent;
      views.total += r.total;
      if (r.recent) from.push({ id: r.id, name: networkName(r.id), n: r.recent });
    } else if (r.kind === 'country') {
      if (r.recent) country.push({ id: r.id, n: r.recent });
    } else if (r.kind === 'press' && r.recent) {
      pressed.push({ id: r.id, n: r.recent });
    }
  }

  /* The names are the one part of this that reads other tables, and the
     account page must not go down because one of them did: without them the
     card is drawn with no pressed table, which is the state it has anyway
     before anything is pressed. */
  let press;
  try {
    press = await named(env, owner, pressed);
  } catch (e) {
    press = [];
  }
  const most = (a, b) => b.n - a.n || String(a.id).localeCompare(String(b.id));
  return {
    days: RECENT_DAYS,
    views: views,
    from: from.sort(most),
    country: country.sort(most),
    press: press.sort(most)
  };
}

/* Instagram, TikTok, Facebook — the brand's own name, which is the same in
   every language and is already written in NETWORKS, so the account page
   does not have to load assets/links.js to say it. Undefined for anything
   else, and dropped from the answer with it. */
function networkName(id) {
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
