/**
 * Tallinn Tastebuds — /u/<name>, the page a byline leads to.
 *
 * Every list on this site says who put it together. Until now that was the
 * end of the sentence: a name with nothing behind it, on a page you had
 * arrived at from somewhere else. This is what it leads to — the rest of what
 * that person has published, and the one number this site keeps about them.
 *
 * It is the same document lists.html serves, the same way /list/<id> and
 * /lists are: this Function fetches the page out of the deployment, swaps the
 * block between the head markers for this person's own tags, and seeds the
 * profile into it. See functions/_shell.js, which all three share.
 *
 * WHAT IS ON IT
 *
 * Their public lists, how many times those have been kept in total, the line
 * they wrote about themselves if they wrote one, the handles they gave for
 * the three sites in NETWORKS — see functions/api/_profile.js, which is also
 * why those are handles here and addresses only where one is built — and the
 * page of links they put together, which is addresses and is meant to be.
 * Not their saves, not their private lists, not the lists they kept — see
 * functions/api/_profile.js for why each of those is left off. A profile
 * discloses no fact about anybody that a list of theirs was not already
 * printing; the line, the handles and the rows are the exceptions and they
 * are not ones, because somebody typed each and pressed Save.
 *
 * FOUND BY THE NAME SOMEBODY GOES BY, WHICH IS IN THE LINE
 *
 * A username is lowercase letters and a search is for a person: "etibar
 * adalat", "etibar actor". The one place on a profile the person writes
 * their own name and what they do is the line under it, so the line goes
 * into the head — the title is the name they go by and the line, the
 * description is the line and then the first three rows, and the JSON-LD
 * below is a ProfilePage whose Person carries the line as its description
 * and the addresses on the page that name them as sameAs. The line used to
 * be kept out of the description on the argument that "i like cats" is
 * useless under a search result; a page of links made a profile a page
 * about a person, and the person's own sentence is what a search for them
 * matches. assets/lists.js writes the same title once the script runs, so a
 * crawler that renders sees the one it was served.
 *
 * WRITTEN FOR A SEARCH RESULT, NOT COPIED INTO ONE
 *
 * The line and the rows are written for the page, where a clapperboard in
 * front of "Actor" and a star in front of a heading are the person's own
 * typography, and the page keeps them. The head does not. A title that
 * opens with an emoji is one a search engine rewrites — Google says as much
 * — and a flag in a description is a box on the half of the machines that
 * open a preview card, so plain() below takes every pictograph out of what
 * the head says and leaves the words. The title is also cut to the length
 * a result shows, which is about seventy characters with the site name
 * after it: the name they go by and the first sentence of their line, and
 * no more, because the two profiles this was written against had a line of
 * two hundred characters and a title that was all of it. The description
 * is not cut — a search engine picks the part of it that matches the query,
 * and a longer one gives it more to pick from — but it skips a row that is
 * only a heading: "About me · Work" says nothing about anybody, where the
 * link under the heading does.
 *
 * sameAs is the property a search engine uses to tie a person's pages
 * together, so it wants the pages that *are* them — a LinkedIn, a GitHub,
 * an ORCID — and not every address they linked to: a showreel on YouTube, a
 * reel, an employer's home page, a file on a drive. Given those, a search
 * engine learns nothing and may learn the wrong thing. IDENTITY below is
 * the list of hosts, and the shape a path has to have on each, for an
 * address to count. It is short on purpose and it is a whitelist: a
 * personal site is a perfectly good sameAs and is left off, because
 * nothing here can tell it from the site of the company they work for.
 * Every address is still on the page as a link; this is only about which
 * are claimed as the person.
 *
 * INDEXED, AND WHY
 *
 * The same reasoning that made a public list indexable. It is a page of
 * somebody's writing, under the name they chose, and a page nobody can arrive
 * at is most of the way to not being published at all. A profile with no
 * public lists and no rows on it is a page with nothing to find, so that one
 * is served and not indexed. A profile with a face in the repository is also
 * in sitemap.xml — tools/sitemap.mjs says why that is the one kind of profile
 * the repository can know about.
 *
 * WHAT HAPPENS WHEN IT CANNOT
 *
 * Every failure ends the same way as it does for a list: the untouched page,
 * and the script asks /api/profile like it would have anyway. This route is
 * an improvement on the load, never a requirement for it.
 */

import { sessionUser, wrongDatabase } from '../api/_lib.js';
import { readProfile, USERNAME, NETWORKS, linkUrl } from '../api/_profile.js';
import { canonical, esc, seed, head, shell, sow, rehead, fill, EMPTY, page } from '../_shell.js';

/* The words of a line, without the pictures. Surrogate pairs are every
   character above the basic plane, which is where the emoji, the flags and
   the skin tones live and where none of the site's ten languages does; the
   ranges are the symbol and dingbat blocks that sit inside it (☕ ⭐ ✉ ⌚
   ✨), and the three singles are the joiner, the presentation selector and
   the keycap that dress one. The same expression, in ES5, is plainOf() in
   assets/lists.js, which writes the same title once the script runs — keep
   the two the same. Whitespace an emoji stood in is closed up afterwards. */
const PICTURES = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2300-\u23FF\u2600-\u27BF\u2B00-\u2BFF\u200D\uFE0F\u20E3]/g;

function plain(text) {
  return String(text || '').replace(PICTURES, '').replace(/\s+/g, ' ').trim();
}

/* The first sentence of a line: up to the first full stop, question mark,
   exclamation mark or ellipsis that has a space after it, so "Ph.D." and
   "memona.app" stay whole, and without a full stop at its end, which a
   title does not carry. A line with no sentence end is one sentence. */
function firstSentence(text) {
  const m = /^(.*?[.!?…])\s/.exec(text);
  return (m ? m[1] : text).replace(/\.$/, '');
}

/* About what a search result shows of a title, before " | Tallinn
   Tastebuds" goes after it. assets/lists.js carries the same number. */
const TITLE_MAX = 70;

/* What the tab and the search result call the page: the name they go by,
   or the username where they gave none, and the first sentence of the line
   under it where there is one — which is where what they do is — cut at a
   word to the length a result shows. assets/lists.js writes the same, with
   the reader's own version of the line where there is one. */
function title(profile) {
  const who = plain(profile.display || profile.name);
  const line = profile.about ? firstSentence(plain(profile.about)) : '';
  if (!line) return who;
  const whole = who + ' · ' + line;
  if (whole.length <= TITLE_MAX) return whole;
  const cut = whole.lastIndexOf(' ', TITLE_MAX - 1);
  return (cut > who.length + 3 ? whole.slice(0, cut) : whole.slice(0, TITLE_MAX - 1)).replace(/[\s,;:·-]+$/, '') + '…';
}

/* The line under the name in a preview card, and under a search result.
 *
 * English, on a site that is read in ten languages, for the reason
 * functions/list/[id].js gives: a crawler's Accept-Language is whatever its
 * operator set, and the card it builds is shown to everybody the link is
 * forwarded to rather than to the person who fetched it. The page underneath
 * follows the reader's own language as usual.
 *
 * Their own line first, then the first three things on their page that are
 * things — a link or a note, not a heading over them — then the lists as
 * the footnote: in the order the page draws them, each only where there is
 * one, and each with its pictures taken out. */
function describe(profile) {
  const parts = [];
  const about = plain(profile.about);
  if (about) parts.push(/[.!?…]$/.test(about) ? about : about + '.');

  const heads = profile.rows
    .filter((row) => row.url || row.note)
    .slice(0, 3)
    .map((row) => plain(row.title))
    .filter(Boolean)
    .join(' · ');
  if (heads) parts.push(heads + '.');

  const n = profile.lists.length;
  if (n) {
    const lists = n === 1 ? '1 list' : n + ' lists';
    const kept = profile.kept === 1 ? ', kept once' : profile.kept ? ', kept ' + profile.kept + ' times' : '';
    parts.push(lists + ' of places in Tallinn' + (parts.length ? '' : ', created by ' + profile.name) + kept + '.');
  }

  return parts.length ? parts.join(' ') : profile.name + ' has not published a list yet.';
}

/* The hosts on which an address is a person, and the shape of the path that
   makes it one — a handle, and not a post, a video or a search. A host is
   matched without its www. The three in NETWORKS are here too, because a
   row may carry the same address in full. */
const HANDLE = /^\/@?[^/@][^/]*\/?$/;
const IDENTITY = [
  { host: 'instagram.com', path: HANDLE },
  { host: 'facebook.com', path: HANDLE },
  { host: 'tiktok.com', path: HANDLE },
  { host: 'x.com', path: HANDLE },
  { host: 'twitter.com', path: HANDLE },
  { host: 'github.com', path: HANDLE },
  { host: 'threads.net', path: HANDLE },
  { host: 'linkedin.com', path: /^\/in\/[^/]+\/?$/ },
  { host: 'youtube.com', path: /^\/(@[^/]+|(channel|c|user)\/[^/]+)\/?$/ },
  { host: 'scholar.google.com', path: /^\/citations\/?$/ },
  { host: 'orcid.org', path: /^\/\d{4}-\d{4}-\d{4}-\d{3}[\dX]\/?$/ },
  { host: 'researchgate.net', path: /^\/profile\/[^/]+\/?$/ },
  { host: 'imdb.com', path: /^\/name\/nm\d+\/?$/ }
];

/* Whether an address is one of the person's own pages elsewhere, by the
   table above. Never throws: a row's address passed httpsOnly() to be
   stored, but this is the head and a surprise here costs the page. */
function isIdentity(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    return IDENTITY.some((id) => id.host === host && id.path.test(u.pathname));
  } catch (e) {
    return false;
  }
}

/* The page as a search engine reads it: a ProfilePage whose main entity is
   the Person, with the line as their description, the face as their picture
   where there is one, and the addresses on the page that are them — the
   three handles, and the rows whose link isIdentity() takes — as sameAs,
   which is the property a search engine uses to tie a person's pages
   together. The name and the description are the head's, pictures out.
   Written only where the page is indexed at all. */
function structuredData(request, profile) {
  const self = canonical(request, '/u/' + profile.name);
  const links = profile.links || {};
  const sameAs = NETWORKS
    .filter((net) => links[net.id])
    .map((net) => linkUrl(net.id, links[net.id]))
    .concat(profile.rows.filter((row) => row.url && isIdentity(row.url)).map((row) => row.url))
    .filter((url, i, all) => all.indexOf(url) === i);

  const person = { '@type': 'Person', '@id': self + '#person', name: plain(profile.display || profile.name), url: self };
  if (profile.display) person.alternateName = profile.name;
  if (profile.about) person.description = plain(profile.about);
  if (profile.face) person.image = canonical(request, profile.face);
  if (sameAs.length) person.sameAs = sameAs;
  /* The languages they said they speak, as the codes schema.org takes. */
  if (profile.speaks) person.knowsLanguage = profile.speaks;

  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: self,
    name: title(profile),
    description: describe(profile),
    dateCreated: new Date(profile.since).toISOString(),
    mainEntity: person
  };
}

/* Their page, as text: a link is a link, a heading is bold, a note is its
   title over its text. Every link out is nofollow, as the script writes it.
   A row written in other languages too — `lines`, keyed by code, each a
   title and for a note its text — follows in each of them, tagged with its
   language, for the same reason the line under the name does below: the
   page that runs a script prints the reader's version, and a search in
   Estonian should find the Estonian one. */
function rowsAsText(rows) {
  if (!rows.length) return '';
  return '<ul>' + rows.map((row) => {
    const versions = Object.keys(row.lines || {}).map((code) => {
      const v = row.lines[code];
      return (v.title ? '<span lang="' + esc(code) + '">' + esc(v.title) + '</span>' : '') +
        (v.note ? '<p lang="' + esc(code) + '">' + esc(v.note) + '</p>' : '');
    }).join('');
    if (row.url) return '<li><a rel="nofollow noopener" href="' + esc(row.url) + '">' + esc(row.title) + '</a>' + versions + '</li>';
    if (row.note) return '<li>' + esc(row.title) + '<p>' + esc(row.note) + '</p>' + versions + '</li>';
    return '<li><strong>' + esc(row.title) + '</strong>' + versions + '</li>';
  }).join('') + '</ul>';
}

export async function onRequest(context) {
  const { request, env, params } = context;

  let html;
  try {
    html = await shell(context, '/lists.html');
  } catch (e) {
    /* The page itself is missing from the deployment, which is a broken build
       rather than a missing person. Nothing here can improve on Pages' own
       answer for it. */
    return new Response('Not found', { status: 404 });
  }

  const name = String(params.name || '');

  if (!USERNAME.test(name.toLowerCase())) return page(html, 404);
  if (!env.DB || (await wrongDatabase(env))) return page(html, 200);

  let profile;
  let user;
  try {
    user = await sessionUser(request, env);
    profile = await readProfile(context, name);
  } catch (e) {
    /* The database being unreachable is not this page's failure to report:
       the script will ask /api/profile in a moment and say whatever is true
       then. */
    return page(html, 200);
  }

  /* Nobody of that name. A 404 with the page on it rather than a bare status,
     the same as a list that has been deleted: somebody following a link that
     goes nowhere should land somewhere that says so and offers the map. */
  if (!profile) return page(html, 404);

  const indexable = profile.lists.length > 0 || profile.rows.length > 0;

  const tags = head({
    title: title(profile),
    description: describe(profile),
    /* The stored spelling, not the one in the URL. Usernames are minted
       lowercase and matched without case, so /u/KATE and /u/kate are one page
       and only one of them is the address it should be indexed at. */
    url: canonical(request, '/u/' + profile.name),
    type: 'profile',
    /* Their photograph, where the repository has one, so a link to them
       unfurls as them rather than as the map — and under their name alone.
       head() says what else a face changes about the card. */
    face: profile.face
  }) +
    /* The one property Open Graph's profile type has that a person here
       has: the username. The first and last names are the display name's to
       split, which nothing here can do, so neither is claimed. */
    '\n<meta property="profile:username" content="' + esc(profile.name) + '">';
  html = rehead(html, indexable
    ? tags + '\n<script type="application/ld+json">' + seed(structuredData(request, profile)) + '</script>'
    : tags);

  /* Where else they said they are, for the same reader. The same `nofollow`
     the script writes, because this page is indexed and these are links
     somebody added to a page under their own name. */
  const links = profile.links || {};
  const elsewhere = NETWORKS
    .filter((net) => links[net.id])
    .map((net) =>
      '<li><a rel="me nofollow noopener" href="' + esc(linkUrl(net.id, links[net.id])) + '">' +
      esc(net.label) + '</a></li>')
    .join('');

  /* The line again in each language they wrote it in, each tagged with its
     language, so a search in Estonian finds the Estonian one. The page that
     runs a script prints the one its reader's language chooses; the text
     underneath is for a reader that reads them all. */
  const lines = profile.lines || {};
  const versions = Object.keys(lines)
    .map((code) => '<p lang="' + esc(code) + '">' + esc(lines[code]) + '</p>')
    .join('');

  /* The page as text, for the reader that runs no script — see fill() in
     functions/_shell.js: the name, the line they wrote and its versions,
     where else they are, their page of links, and their lists, each a link. */
  html = fill(html, EMPTY['lists.html'],
    '<h1>' + esc(profile.display || profile.name) + '</h1>' +
    (profile.about ? '<p>' + esc(profile.about) + '</p>' : '') +
    versions +
    (elsewhere ? '<ul>' + elsewhere + '</ul>' : '') +
    rowsAsText(profile.rows) +
    '<ol>' + profile.lists.map((list) =>
      '<li><a href="/list/' + esc(list.id) + '">' + esc(list.title) + '</a></li>').join('') + '</ol>');

  html = sow(html, '__TTB_PROFILE', {
    user: user ? user.username : null,
    profile: profile
  });

  return page(html, 200, indexable);
}
