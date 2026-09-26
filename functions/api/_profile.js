/**
 * Tallinn Tastebuds — reading one person.
 *
 * Underscore-prefixed, so this is a module and never a route. It holds the one
 * thing two files both need: the shape of a profile as the page wants it.
 *
 *   functions/api/profile.js   answers GET /api/profile?name=<name> with it
 *   functions/u/[name].js      seeds it into the page /u/<name> serves
 *
 * The same arrangement functions/api/_lists.js has, for the same reason, and
 * it lives beside it rather than inside it because a person is not a list.
 *
 * WHAT A PROFILE IS
 *
 * The public lists somebody has made, how many times anybody has kept them,
 * the name they go by, the line they wrote about themselves, the three places
 * they said they are — Instagram, TikTok, Facebook — and the page of links
 * they put under all of that: a showreel, an agency, a note, in the order they chose. Nothing
 * else. Not their saves, which are anonymous by design and filed under a
 * device as often as under an account; not when they were last seen; and not
 * the lists they have kept, which are a drawer of somebody else's pages rather
 * than anything they published. An account holds no address to leave off in
 * the first place; see functions/api/account.js.
 *
 * The last four of those are the ones this site was told rather than worked
 * out, and that is what makes them allowed: everything else here is a
 * consequence of somebody having published a list.
 *
 * And a face, for the few who have one: a photograph in the repository at
 * assets/faces/<name>.jpg, which is the road every photograph on this site
 * takes, and nothing is drawn for the rest. See faceOf() below.
 *
 * A private list is not on it. That is the whole of the privacy rule here and
 * it is the same one /list/<id> already enforces: a list is public or it is
 * its owner's, and this page reads only the first kind — including for the
 * owner looking at their own profile, so that what they see is what everybody
 * sees.
 *
 * THE NUMBER
 *
 * How many times, in total, other people have kept the lists on this page.
 * That is the whole of the standing this site has: it counts the one thing
 * anybody can do to somebody else's list, and it says the same thing the
 * numbers beside each list say — added up.
 *
 * It is summed here out of the per-list counts rather than asked for in a
 * query of its own, so the total on the page and the numbers under it cannot
 * disagree. Twenty-four lists at the most and one indexed prefix each.
 *
 * WHAT IT IS DELIBERATELY NOT
 *
 * A position. "Third of everybody" would mean counting the keeps of every
 * list on the site to find out where this one person stands, which is a
 * GROUP BY over the whole of list_keeps on every profile view — the exact
 * query db/schema.sql says wants a counts table before anything asks it. A
 * number that stands on its own needs none of that, so this is the number and
 * not the place in a table.
 */

import { readingPins, pinSelect, pinsOf } from './_pins.js';

/* ------------------------------------------------------------ the links
 *
 * Three places somebody can say they are, under their line on /u/<name>.
 * They are the second thing on this site anybody writes about themselves
 * rather than about a restaurant, and they pass the same test the line does:
 * nothing here is a fact this site knew and they did not publish — it is
 * three handles they typed and pressed Save on.
 *
 * WHY A HANDLE AND NOT AN ADDRESS
 *
 * A profile is the one page here that links off-site, and a field that takes
 * a URL is a field for pasting any URL at all — a page of somebody else's, a
 * redirector, something worse — under a name a reader has come to trust
 * because of the lists under it. So the field takes a handle, this file
 * decides whether it is one, and the address is built here and in
 * assets/links.js out of a base nobody typed. The worst thing anybody can
 * store is a handle on one of these three sites that is not theirs, which is
 * the same thing they could already do by writing it in their line.
 *
 * A pasted address still works, because it is what people reach for: an
 * instagram.com/... URL is read for its first path segment and the rest is
 * dropped, and a URL pointing anywhere else is not a handle and is refused.
 * The page of links further down this file is the deliberate other side of
 * that rule: addresses, held to https and printed under their host.
 *
 * THE TABLE IS WRITTEN OUT TWICE
 *
 * assets/links.js holds the same three rows, because the browser is what
 * draws them and cannot import this — ESM on the Workers runtime, ES5 served
 * raw. Same arrangement as the pins, for the same reason, and node
 * tools/validate.mjs fails the build when the two drift, so the promise is
 * kept by something other than memory.
 *
 * The cap is in the pattern rather than beside it, and each is that site's
 * own: Instagram 30, TikTok 24, Facebook 50 with a floor of 5, which is the
 * shortest username it will mint. It is the one cap on this site that is not
 * also a maxlength on the field that writes it — assets/links.js says what a
 * pasted address did to a field that had one.
 */
export const NETWORKS = [
  {
    id: 'instagram',
    label: 'Instagram',
    base: 'https://www.instagram.com/',
    hosts: ['instagram.com'],
    re: /^[A-Za-z0-9._]{1,30}$/
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    /* The @ is part of the address rather than part of the handle, which is
       why it is on this side of the join: what gets stored is the same shape
       for all three, and only one of the three wears it. */
    base: 'https://www.tiktok.com/@',
    hosts: ['tiktok.com'],
    re: /^[A-Za-z0-9._]{1,24}$/
  },
  {
    id: 'facebook',
    label: 'Facebook',
    base: 'https://www.facebook.com/',
    hosts: ['facebook.com', 'fb.com'],
    /* No underscore: Facebook's usernames are letters, digits and dots, and
       five characters at the shortest. `profile.php` fits that shape and is
       not a username — it is the numeric-id address with the id left behind,
       and it answers with a page that is nobody's. */
    re: /^[A-Za-z0-9.]{5,50}$/,
    deny: /^profile\.php$/i
  }
];

/* One handle, or '' — which is both "they left it empty" and "that is not a
   handle". The caller tells the two apart by what it was given: POST
   /api/account refuses a field somebody filled in that comes back empty, and
   reading a stored row drops it silently, because a value this site would no
   longer accept is a value it should stop printing.

   Never throws. A hand-written request, a handle on a site that is not one of
   the three, a URL with a path this file cannot read: all of them are ''. */
export function cleanHandle(id, value) {
  const net = NETWORKS.find((n) => n.id === id);
  if (!net) return '';

  let raw = String(typeof value === 'string' ? value : '').trim();
  if (!raw) return '';

  /* A pasted address. The host has to be the one this field is for — the
     point of the field is that a reader knows where the link goes before
     they press it — and what is taken is the first path segment and nothing
     else: no query, no second segment, so a link to one post on somebody's
     account becomes a link to the account. */
  if (raw.indexOf('/') >= 0) {
    let url;
    try {
      url = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
    } catch (e) {
      return '';
    }
    const host = url.hostname.toLowerCase().replace(/^(?:www|m|web)\./, '');
    if (!net.hosts.includes(host)) return '';
    const first = url.pathname.split('/').filter(Boolean)[0] || '';
    try {
      raw = decodeURIComponent(first);
    } catch (e) {
      raw = first;
    }
  }

  /* Typed the way people say it out loud. Instagram and TikTok both print
     the @ and neither stores it. */
  raw = raw.replace(/^@+/, '');

  if (!net.re.test(raw)) return '';
  /* A handle of nothing but dots passes every pattern above and is not a
     handle; it is what a stray paste of a domain leaves behind. */
  if (!/[A-Za-z0-9]/.test(raw)) return '';
  if (net.deny && net.deny.test(raw)) return '';
  return raw;
}

/* The column as the page wants it: an object of id → handle, holding only
   the networks that are in the table and only the handles that still clean.
   '' , null, a row written before this column existed and a JSON blob
   somebody hand-wrote all come back as {}.

   Stored as JSON in one column rather than as three, so that adding a fourth
   network is a line in the table above and not another ALTER against a live
   table nobody can lock. The cost is that it cannot be queried, and nothing
   ever queries it: it is read on one page, about one person, by primary key. */
export function readLinks(raw) {
  let parsed;
  try {
    parsed = JSON.parse(String(raw || '') || '{}');
  } catch (e) {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

  const out = {};
  for (const net of NETWORKS) {
    const handle = cleanHandle(net.id, parsed[net.id]);
    if (handle) out[net.id] = handle;
  }
  return out;
}

/* Where a handle points. Built here and never stored, so a base that changes
   changes every link on the site at once, and a row in the database is never
   a URL somebody chose. */
export function linkUrl(id, handle) {
  const net = NETWORKS.find((n) => n.id === id);
  return net && handle ? net.base + encodeURIComponent(handle) : '';
}

/* ----------------------------------------------------- the page of links
 *
 * The rows under somebody's name on /u/<name>, written on /account.html and
 * kept in profile_rows — see db/schema.sql for what a row is and why this
 * table stores addresses where users.links deliberately stores handles.
 *
 * WHAT A ROW IS IS DECIDED BY WHAT IS FILLED
 *
 * A title and an address is a link; a title and a note is a note, which the
 * page opens as a sheet; a title on its own is a heading. Nothing stores the
 * kind. An address wins over a note where both were sent, so a row is never
 * two things at once.
 *
 * THE CAPS
 *
 * Twenty rows, sixty characters of title — the same as a list's — an address
 * of two thousand and a note of three thousand. The title and the note are
 * cut, the way every line here is; an address is refused rather than cut,
 * because a cut address points somewhere else. Restated as maxlengths in
 * assets/account.js, which carries the only form that writes them.
 *
 * https AND NOTHING ELSE
 *
 * A row's address is the one thing on this site somebody types that a
 * stranger's browser will then be sent to, so it is held to a scheme and a
 * host and nothing more: not a list of sites, which would be this site
 * deciding what a person may put on their own page, and not less than that,
 * because javascript: and data: are addresses too. The page prints the host
 * under every link and sends every one out nofollow.
 */
export const MAX_ROWS = 20;
export const MAX_ROW_TITLE = 60;
export const MAX_ROW_URL = 2048;
export const MAX_ROW_NOTE = 3000;

function httpsOnly(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !!parsed.hostname;
  } catch (e) {
    return false;
  }
}

/* One row as the page wants it, or null for one that has stopped being one:
   no title, or an address the rule above no longer takes. A field with
   nothing in it is left out rather than sent as '', the way `about` is. */
function rowOut(title, url, note) {
  if (!title) return null;
  if (url && !httpsOnly(url)) return null;
  const out = { title: title };
  if (url) out.url = url;
  else if (note) out.note = note;
  return out;
}

/* The rows as they should be stored, or a refusal naming the row it stopped
   at — never both. Refused rather than dropped, for the reason a handle is:
   a row somebody wrote that quietly went missing is a page with a gap in it
   and nothing anywhere saying why. */
export function cleanRows(raw) {
  if (!Array.isArray(raw)) return { error: 'rows' };
  if (raw.length > MAX_ROWS) return { error: 'rows-many' };

  const rows = [];
  for (let i = 0; i < raw.length; i++) {
    const given = raw[i] && typeof raw[i] === 'object' ? raw[i] : {};
    const title = String(typeof given.title === 'string' ? given.title : '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_ROW_TITLE);
    if (!title) return { error: 'row-title', row: i };

    const url = String(typeof given.url === 'string' ? given.url : '').trim();
    if (url && (url.length > MAX_ROW_URL || !httpsOnly(url))) return { error: 'row-url', row: i };

    /* Paragraphs are blank lines and nothing else: line ends made one kind,
       trailing spaces off each line, and never more than one blank line in
       a row, so what is stored is what the sheet will show. */
    const note = url ? '' : String(typeof given.note === 'string' ? given.note : '')
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, MAX_ROW_NOTE);

    rows.push({ title: title, url: url, note: note });
  }
  return { rows: rows };
}

/* profile_rows arrives by hand, like every table here, and the two pages
   that read it must stand without it. Not memoised the way the columns above
   are: an isolate that remembered "no table" would go on drawing no rows
   after the table was applied — and would hand the form an empty page back
   from a save that had just succeeded. So the cost on a database without the
   table is one failed statement per read, for the afternoon between the
   deploy and the two commands. Only "no such table" is an answer; anything
   else is the request having failed and is rethrown. */
export async function readRows(env, ownerId) {
  let results;
  try {
    results = (await env.DB
      .prepare('SELECT title, url, note FROM profile_rows WHERE owner = ? ORDER BY position')
      .bind(ownerId)
      .all()).results;
  } catch (e) {
    if (!/no such table/i.test(String((e && e.message) || e))) throw e;
    return [];
  }
  /* Read against the rule rather than trusted as stored, the way the handles
     are: a row this site would no longer accept stops being printed. */
  return results.map((r) => rowOut(r.title, r.url, r.note)).filter(Boolean);
}

/* The face, where there is one: assets/faces/<name>.jpg in the deployment,
   asked for with a HEAD through the same binding _shell.js reads a page
   with. A username is [a-z0-9-], so the path is never anything but a file
   under that folder. Nothing is stored — the picture is in the repository or
   it is not — and nothing is drawn for the many who have none.

   A 200 alone does not say the picture is there. The site has no top-level
   404.html, so Pages serves it as a single-page app: a path that matches no
   file answers 200 with index.html. Asking only for res.ok gave every
   profile without a face the path to one, and the page drew a broken image
   in an empty circle. So the answer has to be an image as well. */
export async function faceOf(context, name) {
  const url = new URL('/assets/faces/' + name + '.jpg', context.request.url);
  try {
    const res = context.env.ASSETS
      ? await context.env.ASSETS.fetch(new Request(url.toString(), { method: 'HEAD' }))
      : await fetch(url.toString(), { method: 'HEAD' });
    const type = res.headers.get('content-type') || '';
    return res.ok && type.indexOf('image/') === 0 ? url.pathname : undefined;
  } catch (e) {
    return undefined;
  }
}

/* ------------------------------------------------- the optional columns
 *
 * `users.about`, `users.links` and `users.display_name` all reach a deployed
 * database by hand — every statement in db/schema.sql is CREATE TABLE IF NOT
 * EXISTS, which adds no column to a table that already exists — so there are
 * four states a live database can be in and every read of a person has to
 * survive all four. A line under somebody's name and three handles beside it are not
 * worth the page: without this, an account page or a profile on a database
 * that is one ALTER behind answers 500 and takes somebody's saves, lists and
 * byline down with it.
 *
 * So the same bargain readingPins() strikes, two tiers wider: the first read
 * of an isolate asks for everything, and what happens decides for every read
 * after it. At most three failed statements per isolate on the oldest database,
 * none on a current one, and no round trip of its own either way. Only "no
 * such column" is an answer; anything else is the request having failed and
 * is rethrown, because a database that is down should look like one.
 *
 * The answer outlives the ALTER, exactly as the pins' does: an isolate that
 * has decided "about only" holds that until it is recycled, which a deploy
 * does and idling does anyway. Run the ALTER with the deploy rather than
 * after it.
 */
const TIERS = ['about, links, display_name', 'about, links', 'about', ''];
let tier = null;

export async function readingExtras(env, make) {
  const from = tier === null ? 0 : TIERS.indexOf(tier);
  for (let at = from; at < TIERS.length - 1; at++) {
    try {
      const out = await make(TIERS[at]);
      tier = TIERS[at];
      return out;
    } catch (e) {
      if (!/no such column/i.test(String((e && e.message) || e))) throw e;
    }
  }

  /* The last tier is outside the loop because it is what makes this total: it
     asks for no optional column at all, so it cannot fail for the want of
     one, and there is nothing below it to fall through to. */
  tier = '';
  return make('');
}

/* The same shape functions/api/account.js mints a username in, said again
   here so nothing that is not a plausible name goes near a query. */
export const USERNAME = /^[a-z0-9][a-z0-9-]{2,23}$/;

/**
 * One profile, or null.
 *
 * Null covers a name that is not a name and a name nobody has, which are the
 * same answer on purpose: this must not become a way of asking which
 * usernames are taken. The sign-up sheet is where that question belongs, and
 * it is rate-limited.
 *
 * Who is asking does not come into it. The answer is the same for the owner
 * and for a stranger, and the page has nothing to draw differently for the
 * owner either — it once offered them a link back to /account.html, and the
 * name in the header was already that.
 */
export async function readProfile(context, name) {
  const { env } = context;

  const who = String(name || '').trim().toLowerCase();
  if (!USERNAME.test(who)) return null;

  /* `about` and `links` are columns applied by hand — see db/schema.sql — so
     a deployment can reach the site before somebody has run either ALTER.
     readingExtras() above is what makes that survivable: it asks for both,
     then for the one, then for neither, and remembers. A profile is a page
     about somebody's lists, and it must not 404 because the line under their
     name has nowhere to live yet. */
  const row = await readingExtras(env, (extras) => env.DB
    .prepare(
      'SELECT id, username, created_at' + (extras ? ', ' + extras : '') +
      ' FROM users WHERE username = ? COLLATE NOCASE'
    )
    .bind(who)
    .first());
  if (!row) return null;

  /* Read against the table above rather than trusted as stored: a network
     this site has stopped drawing, or a handle that would no longer be
     accepted, stops being printed rather than outliving the rule. */
  const links = readLinks(row.links);

  /* Their public lists, newest edit first — the same row the index draws for
     your own, minus the ones nobody else may read. The keeps are a scalar
     subquery rather than a second join for the reason the index gives: two
     aggregates over two tables in one GROUP BY multiply each other, and a
     list of ten places kept by three people would report thirty of each. */
  const { results } = await readingPins(env, (pins) => env.DB
    .prepare(
      'SELECT l.id AS id, l.title AS title, ' +
      'COUNT(i.place_id) AS n, ' +
      pinSelect(pins) +
      '(SELECT COUNT(*) FROM list_keeps k WHERE k.list_id = l.id) AS keeps ' +
      'FROM lists l LEFT JOIN list_items i ON i.list_id = l.id ' +
      'WHERE l.owner = ? AND l.public = 1 GROUP BY l.id ORDER BY l.updated_at DESC'
    )
    .bind(row.id)
    .all());

  let kept = 0;
  for (const r of results) kept += r.keeps;

  return {
    name: row.username,
    /* The name they go by, over a username that is lowercase letters. Left
       out when it is empty, and the page puts the username where it would
       have gone. */
    display: row.display_name || undefined,
    since: row.created_at,
    kept: kept,
    /* The photograph, for the few who have one in the repository. Left out
       for everybody else, and the page draws nothing in its place. */
    face: await faceOf(context, row.username),
    /* Their page of links, in their order. Always an array, the way `lists`
       is: the page counts it, and the route decides whether the profile is
       worth indexing by it. */
    rows: await readRows(env, row.id),
    /* Left out when it is empty rather than sent as '', the way every other
       answer here drops a field with nothing in it. Nearly every account has
       no line, and the page draws nothing for one it was not given. */
    about: row.about || undefined,
    /* The same, for the same reason, and handles rather than addresses: the
       page builds the URL out of the table above, so a link on a profile is
       never a string somebody typed in full. Left out when there are none,
       which is nearly every account. */
    links: Object.keys(links).length ? links : undefined,
    /* The four things a row on this page draws and no more — listRow() in
       assets/lists.js takes a title, a count and a number of keeps, and the
       id is what it links to. The line under a list and the date it was last
       edited are on the list's own page, one press away. */
    lists: results.map((r) => ({
      id: r.id,
      title: r.title,
      n: r.n,
      keeps: r.keeps,
      /* Their pin, in front of their title, the same as on every other page
         a list is named on. A profile is the page that is most obviously a
         collection of somebody's, so it is the page where telling one of
         them from the next by eye is worth the most. */
      ...pinsOf(r)
    }))
  };
}
