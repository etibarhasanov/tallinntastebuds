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
 * the name they go by, the line they wrote about themselves — in each of the
 * site's languages they wrote it in — the three places
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
import { asUsername } from './_account.js';
import { LIST_ID, MAX_LISTS } from './_lists.js';

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

/* ------------------------------------------------- the languages spoken
 *
 * Which languages somebody speaks, printed on /u/<name> under their handles.
 * A thing they typed — picked, rather — and pressed Save on, which is the
 * same test the line and the handles pass, and it answers the one question a
 * reader in a city of Estonian, Russian and English speakers asks before
 * writing to anybody: can we talk.
 *
 * WHAT IS STORED IS A CODE, NEVER A NAME
 *
 * Two-letter ISO 639-1 codes out of the list below, and the page names each
 * one in the reader's language — "Estonian" in English, "эстонский" in
 * Russian — so a profile reads the same in all ten of this site's languages
 * without anybody having written a word of it twice. A list rather than a
 * free box because a name somebody typed is a name the page cannot translate,
 * and because a free box on a profile is a line nobody asked for.
 *
 * The site's own ten first, then the languages this city hears most often
 * after them. Adding one is a code here and the same code, with its own name
 * for itself, in SPEAKS in assets/links.js — node tools/validate.mjs fails the
 * build when the two lists drift, the way it does for the networks above.
 *
 * INSIDE users.links, AND WHY
 *
 * Under the key `speaks`, beside the handles, rather than in a column of its
 * own. That column is JSON precisely so that one more small thing about a
 * person is not one more ALTER run by hand against a live table, and this is
 * that thing: read on one page, about one person, by primary key, and never
 * queried. readLinks() reads only the networks, so a `speaks` key is invisible
 * to everything that was there before it; the two writes in
 * functions/api/account.js each keep the other's half — mergeLinks() below.
 */
export const SPEAKS = [
  'az', 'hy', 'en', 'et', 'fi', 'pt', 'ru', 'es', 'tr', 'uk',
  'ar', 'be', 'bg', 'ca', 'cs', 'da', 'de', 'el', 'fa', 'fr',
  'he', 'hi', 'hr', 'hu', 'id', 'it', 'ja', 'ka', 'kk', 'ko',
  'lt', 'lv', 'nl', 'no', 'pl', 'ro', 'sk', 'sl', 'sr', 'sv',
  'th', 'uz', 'vi', 'zh'
];

/* Eight is more than anybody who is not showing off speaks, and a line of
   eight names still fits a phone in two rows. */
export const MAX_SPEAKS = 8;

/* The list as stored: known codes only, each once, in the order they were
   picked, at most MAX_SPEAKS. Null when anything given is not a code in the
   list, so the write can refuse rather than quietly drop what was picked. */
export function cleanSpeaks(value) {
  if (!Array.isArray(value)) return null;
  const out = [];
  for (const code of value) {
    if (typeof code !== 'string' || !SPEAKS.includes(code)) return null;
    if (!out.includes(code)) out.push(code);
  }
  return out.length > MAX_SPEAKS ? null : out;
}

/* The same, read off a stored column: whatever no longer passes is dropped
   rather than refused, the way readLinks() drops a handle. */
export function readSpeaks(raw) {
  let parsed;
  try {
    parsed = JSON.parse(String(raw || '') || '{}');
  } catch (e) {
    return [];
  }
  const list = parsed && Array.isArray(parsed.speaks) ? parsed.speaks : [];
  return list.filter((code, i) => SPEAKS.includes(code) && list.indexOf(code) === i).slice(0, MAX_SPEAKS);
}

/* ------------------------------------------ the line, in other languages
 *
 * The line under somebody's name is written once, in whatever language they
 * wrote it in, and that is what everybody reads — `users.about`, written by
 * the `about` action in functions/api/account.js. This is
 * the same line again in any of the site's other languages, one box each on
 * /edit, and a reader whose page is in one of them gets that one instead.
 * A reader in a language nobody wrote it in gets the line as it was first
 * written, exactly as before this existed.
 *
 * WHY THE SITE'S TEN AND NOT THE FORTY-FOUR ABOVE
 *
 * A version is chosen by the language the page is being read in, and a page
 * on this site is only ever read in one of the ten data/ui.json speaks. A
 * line in German would be a box nobody's page could ever choose. So these are
 * exactly the languages of data/ui.json, and node tools/validate.mjs fails the
 * build when the two part company — a language added to the site is a code
 * added here in the same commit.
 *
 * KEYED BY LANGUAGE, THE WAY EVERYTHING TRANSLATED HERE IS
 *
 * `{"et":"…","ru":"…"}`, which is the shape a card's back and a deck's name
 * have in data/decks.json and a place's blurb has in data/restaurants.json:
 * an object keyed by code, and the page picks the one it is read in. Not a
 * column per language — ten ALTERs run by hand against a live table, and an
 * eleventh with the next language — and not a table of its own, for a thing
 * read on one page, about one person, by primary key. It rides in
 * users.links under `lines`, beside the handles and the languages, for the
 * reason the languages do: that column is JSON so that one more small thing
 * about a person costs no ALTER at all.
 *
 * Same cap as the line, same flatten-and-cut, and an empty box is a version
 * taken down rather than stored as ''.
 */
export const LINE_LANGS = ['az', 'hy', 'en', 'et', 'fi', 'pt', 'ru', 'es', 'tr', 'uk'];

/* The line's cap, and every version's. Two hundred because a line under a
   title is what this is — **The line about yourself** in README.md — and
   restated in assets/edit.js, which carries the only boxes that write it. */
export const MAX_ABOUT = 200;

/* The flatten-and-cut the line has always had, in one place now that there
   are two callers of it. */
export function cleanLine(value) {
  return String(typeof value === 'string' ? value : '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_ABOUT);
}

/* The versions as stored: known codes only, each cleaned, the empty ones
   left out. Null when what was sent is not an object of code → string at
   all, or names a language the site does not speak, so the write refuses
   rather than dropping a box somebody filled. */
export function cleanLines(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out = {};
  for (const code of Object.keys(value)) {
    if (!LINE_LANGS.includes(code) || typeof value[code] !== 'string') return null;
    const line = cleanLine(value[code]);
    if (line) out[code] = line;
  }
  return out;
}

/* The same, read off a stored column: whatever no longer passes is dropped
   rather than refused, the way readSpeaks() does, and they come back in the
   order of LINE_LANGS so the editor draws them the same way every time. */
export function readLines(raw) {
  let parsed;
  try {
    parsed = JSON.parse(String(raw || '') || '{}');
  } catch (e) {
    return {};
  }
  const lines = parsed && parsed.lines && typeof parsed.lines === 'object' && !Array.isArray(parsed.lines) ? parsed.lines : {};
  const out = {};
  for (const code of LINE_LANGS) {
    const line = typeof lines[code] === 'string' ? cleanLine(lines[code]) : '';
    if (line) out[code] = line;
  }
  return out;
}

/* The column rewritten with one part replaced and the rest kept: the handles,
   the languages and the lines each come from what was given, or where nothing
   was, from what is stored. '' when all three are empty, so "never filled
   anything in" and "took everything down" stay the same row. */
export function mergeLinks(raw, given) {
  const next = Object.assign({}, given.links || readLinks(raw));
  const list = given.speaks || readSpeaks(raw);
  if (list.length) next.speaks = list;
  const lines = given.lines || readLines(raw);
  if (Object.keys(lines).length) next.lines = lines;
  return Object.keys(next).length ? JSON.stringify(next) : '';
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
 * A LIST IS A ROW TOO, AND ITS PLACE IS ALL THAT IS STORED
 *
 * Every public list of theirs stands among the rows, where its owner dragged
 * it, and the ones never dragged stand at the bottom, newest edit first —
 * which is where a list made tomorrow lands. Stored as a row like any other,
 * with the list's own address on this site, /list/<id>, and no title: the
 * title, the count and whether it is still public are read off the list
 * every time, so a list renamed is renamed here too, and one made private or
 * deleted simply stops being drawn. Being a path rather than an https
 * address is also what keeps it from ever being taken for a link — by
 * rowOut() below, and by any copy of this file older than the rule.
 *
 * THE CAPS
 *
 * Twenty rows besides the lists, sixty characters of title — the same as a
 * list's — an address of two thousand and a note of three thousand. The
 * title and the note are cut, the way every line here is; an address is
 * refused rather than cut, because a cut address points somewhere else.
 * Restated as maxlengths in assets/edit.js, which carries the only form that
 * writes them.
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

const LIST_ROW = '/list/';

function httpsOnly(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !!parsed.hostname;
  } catch (e) {
    return false;
  }
}

/* A row's title and note again in the site's other languages, the way the
 * line has them — see **the line, in other languages** above. Keyed by code,
 * each version a title and, for a note, the note: `{"az":{"title":"…",
 * "note":"…"}}`. A reader whose page is in one of those languages gets that
 * version of the row; the address is the same in every language, so a link
 * row's version is only ever a title. A version with no title is not one.
 *
 * In profile_rows.lines, a column added to that table by hand — the rows
 * already have a table of their own, so this is where a row's words go, and
 * readRows() and the `rows` write both stand without it. */
function shapeNote(value) {
  /* Paragraphs are blank lines and nothing else: line ends made one kind,
     trailing spaces off each line, and never more than one blank line in a
     row, so what is stored is what the sheet will show. */
  return String(typeof value === 'string' ? value : '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_ROW_NOTE);
}

function shapeTitle(value) {
  return String(typeof value === 'string' ? value : '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_ROW_TITLE);
}

/* The versions of one row, shaped the way its first title and note are; the
   note only where the row is a note. Null when what was sent is not an object
   of code → version, or names a language the site does not speak. */
function rowLines(value, isNote) {
  if (value === undefined || value === null || value === '') return {};
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  const out = {};
  for (const code of Object.keys(value)) {
    const given = value[code];
    if (!LINE_LANGS.includes(code) || !given || typeof given !== 'object') return null;
    const title = shapeTitle(given.title);
    if (!title) continue;
    const version = { title: title };
    const note = isNote ? shapeNote(given.note) : '';
    if (note) version.note = note;
    out[code] = version;
  }
  return out;
}

/* One row as the page wants it, or null for one that has stopped being one:
   no title, or an address the rule above no longer takes. A field with
   nothing in it is left out rather than sent as '', the way `about` is. */
function rowOut(title, url, note, lines) {
  if (!title) return null;
  if (url && !httpsOnly(url)) return null;
  const out = { title: title };
  if (url) out.url = url;
  else if (note) out.note = note;

  /* Read against the rule the way the row is, and dropped rather than
     refused where it no longer passes: a language the site has stopped
     speaking costs its own version and not the others. */
  let parsed = null;
  try {
    parsed = lines ? JSON.parse(lines) : null;
  } catch (e) { /* a hand-written value costs its versions and nothing else */ }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return out;
  const known = {};
  for (const code of LINE_LANGS) {
    if (parsed[code] && typeof parsed[code] === 'object') known[code] = parsed[code];
  }
  const versions = rowLines(known, !!out.note);
  if (versions && Object.keys(versions).length) out.lines = versions;
  return out;
}

/* The rows as they should be stored, or a refusal naming the row it stopped
   at — never both. Refused rather than dropped, for the reason a handle is:
   a row somebody wrote that quietly went missing is a page with a gap in it
   and nothing anywhere saying why. */
export function cleanRows(raw) {
  if (!Array.isArray(raw)) return { error: 'rows' };
  if (raw.length > MAX_ROWS + MAX_LISTS) return { error: 'rows-many' };

  const rows = [];
  const lists = new Set();
  for (let i = 0; i < raw.length; i++) {
    const given = raw[i] && typeof raw[i] === 'object' ? raw[i] : {};

    /* A list, by its id and nothing else. Whether it is theirs and public is
       the caller's to settle, since that is a read and this is not one. */
    if (given.list !== undefined) {
      if (typeof given.list !== 'string' || !LIST_ID.test(given.list) || lists.has(given.list)) {
        return { error: 'row-list', row: i };
      }
      lists.add(given.list);
      rows.push({ list: given.list });
      continue;
    }
    if (rows.length - lists.size >= MAX_ROWS) return { error: 'rows-many' };

    const title = shapeTitle(given.title);
    if (!title) return { error: 'row-title', row: i };

    const url = String(typeof given.url === 'string' ? given.url : '').trim();
    if (url && (url.length > MAX_ROW_URL || !httpsOnly(url))) return { error: 'row-url', row: i };

    const note = url ? '' : shapeNote(given.note);

    const lines = rowLines(given.lines, !!note);
    if (!lines) return { error: 'row-lines', row: i };

    rows.push({ title: title, url: url, note: note, lines: Object.keys(lines).length ? JSON.stringify(lines) : '' });
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
  const ask = (columns) => env.DB
    .prepare('SELECT ' + columns + ' FROM profile_rows WHERE owner = ? ORDER BY position')
    .bind(ownerId)
    .all();

  let results;
  try {
    /* `lines` is a column added to this table by hand after it shipped, so
       a database without it yet is asked again without it — the same one
       failed statement per read, for the same reason as the table. */
    try {
      results = (await ask('title, url, note, lines')).results;
    } catch (e) {
      if (!/no such column/i.test(String((e && e.message) || e))) throw e;
      results = (await ask('title, url, note')).results;
    }
  } catch (e) {
    if (!/no such table/i.test(String((e && e.message) || e))) throw e;
    return [];
  }
  /* Read against the rule rather than trusted as stored, the way the handles
     are: a row this site would no longer accept stops being printed. A list
     comes back as its id alone, for placeLists() to put the list in. */
  return results.map((r) => {
    const list = r.url.startsWith(LIST_ROW) ? r.url.slice(LIST_ROW.length) : '';
    if (list) return LIST_ID.test(list) ? { list: list } : null;
    return rowOut(r.title, r.url, r.note, r.lines);
  }).filter(Boolean);
}

/* The rows as written to profile_rows: a list as its address and nothing
   else, see the header of this section. */
export function rowToStore(row) {
  return row.list
    ? { title: '', url: LIST_ROW + row.list, note: '', lines: '' }
    : row;
}

/* Somebody's public lists, newest edit first — the order the ones they never
   dragged stand in at the bottom of their page. `extra` is whatever else the
   reader wants of each list: the profile asks for its keeps. */
export async function publicLists(env, ownerId, extra) {
  const { results } = await readingPins(env, (pins) => env.DB
    .prepare(
      'SELECT l.id AS id, l.title AS title, ' + pinSelect(pins) +
      'COUNT(i.place_id) AS n' + (extra ? ', ' + extra : '') + ' ' +
      'FROM lists l LEFT JOIN list_items i ON i.list_id = l.id ' +
      'WHERE l.owner = ? AND l.public = 1 GROUP BY l.id ORDER BY l.updated_at DESC'
    )
    .bind(ownerId)
    .all());
  return results;
}

/* The rows readRows() gave back with each list put in where its row stands,
   as { list: <the list> } — left out where it is no longer one of `lists` —
   and every list no row names put after the lot, in the order `lists` has
   them. One array, in the order the page draws it. */
export function placeLists(rows, lists) {
  const byId = new Map(lists.map((l) => [l.id, l]));
  const out = [];
  for (const row of rows) {
    if (!row.list) out.push(row);
    else if (byId.has(row.list)) {
      out.push({ list: byId.get(row.list) });
      byId.delete(row.list);
    }
  }
  for (const list of byId.values()) out.push({ list: list });
  return out;
}

/* The face, where there is one: assets/faces/<name>.jpg in the deployment,
   asked for with a HEAD through the same binding _shell.js reads a page
   with. A username is letters, digits, dots, dashes and underscores — see
   asUsername() in ./_account.js — with no slash, percent sign, query or hash
   in it, so the path is never anything but a file under that folder, and the
   URL parser percent-encodes a letter outside ASCII on the way. Nothing is
   stored — the picture is in the repository or it is not — and nothing is
   drawn for the many who have none.

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

  /* The name as the table spells it, through the same function that minted
     it — asUsername() in ./_account.js — so nothing that is not a plausible
     name goes near a query, and the same name typed with its space or its
     capital finds the same person. */
  const who = asUsername(name);
  if (!who) return null;

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
  const speaks = readSpeaks(row.links);
  const lines = readLines(row.links);

  /* Their public lists — the same row the index draws for your own, minus
     the ones nobody else may read. The keeps are a scalar subquery rather
     than a second join for the reason the index gives: two aggregates over
     two tables in one GROUP BY multiply each other, and a list of ten places
     kept by three people would report thirty of each. */
  const results = await publicLists(env, row.id,
    '(SELECT COUNT(*) FROM list_keeps k WHERE k.list_id = l.id) AS keeps');

  let kept = 0;
  for (const r of results) kept += r.keeps;

  /* The page of links with the lists put in where their owner dragged them,
     and the rest after — see placeLists(). Sent apart again, the rows as
     every reader of them has always had them and each list carrying `at`,
     the row it stands in front of, so the card can draw the lists in this
     order without the rows and the page can draw both together. */
  const placed = placeLists(await readRows(env, row.id), results);
  const rows = [];
  const lists = [];
  for (const item of placed) {
    if (item.list) lists.push({ ...item.list, at: rows.length });
    else rows.push(item);
  }

  return {
    name: row.username,
    /* The name they go by, over a username that is lowercase. Left out when
       it is empty, and the page puts the username where it would have
       gone. */
    display: row.display_name || undefined,
    since: row.created_at,
    kept: kept,
    /* The photograph, for the few who have one in the repository. Left out
       for everybody else, and the page draws nothing in its place. */
    face: await faceOf(context, row.username),
    /* Their page of links, in their order, without the lists among them.
       Always an array, the way `lists` is: the page counts it, and the route
       decides whether the profile is worth indexing by it. */
    rows: rows,
    /* Left out when it is empty rather than sent as '', the way every other
       answer here drops a field with nothing in it. Nearly every account has
       no line, and the page draws nothing for one it was not given. */
    about: row.about || undefined,
    /* The same line in the site's other languages, keyed by code, for the
       page to choose from by the language it is read in — see readLines().
       Left out where there are none, and never without the line itself:
       a version is a translation of something, and a profile whose line was
       taken down reads as having none in every language. */
    lines: row.about && Object.keys(lines).length ? lines : undefined,
    /* The same, for the same reason, and handles rather than addresses: the
       page builds the URL out of the table above, so a link on a profile is
       never a string somebody typed in full. Left out when there are none,
       which is nearly every account. */
    links: Object.keys(links).length ? links : undefined,
    /* The languages they speak, as codes the page names in the reader's own
       language. Left out when there are none, like everything above. */
    speaks: speaks.length ? speaks : undefined,
    /* The four things a row on this page draws and no more — listRow() in
       assets/lists.js takes a title, a count and a number of keeps, and the
       id is what it links to — in the order their owner put them, and where
       among the rows: `at`. The line under a list and the date it was last
       edited are on the list's own page, one press away. */
    lists: lists.map((r) => ({
      id: r.id,
      title: r.title,
      n: r.n,
      keeps: r.keeps,
      at: r.at,
      /* Their pin, in front of their title, the same as on every other page
         a list is named on. A profile is the page that is most obviously a
         collection of somebody's, so it is the page where telling one of
         them from the next by eye is worth the most. */
      ...pinsOf(r)
    }))
  };
}
