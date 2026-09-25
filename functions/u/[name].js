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
 * into the head — the title is the username and the line, the description is
 * the line and then the first three rows, and the JSON-LD below is a
 * ProfilePage whose Person carries the line as its description and every
 * address on the page as sameAs. The line used to be kept out of the
 * description on the argument that "i like cats" is useless under a search
 * result; a page of links made a profile a page about a person, and the
 * person's own sentence is what a search for them matches. assets/lists.js
 * writes the same title once the script runs, so a crawler that renders
 * sees the one it was served.
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

/* What the tab and the search result call the page: the username, and the
   line the person wrote under it where there is one, which is where their
   own name and what they do are. assets/lists.js writes the same. */
function title(profile) {
  return profile.about ? profile.name + ' · ' + profile.about : profile.name;
}

/* The line under the name in a preview card, and under a search result.
 *
 * English, on a site that is read in ten languages, for the reason
 * functions/list/[id].js gives: a crawler's Accept-Language is whatever its
 * operator set, and the card it builds is shown to everybody the link is
 * forwarded to rather than to the person who fetched it. The page underneath
 * follows the reader's own language as usual.
 *
 * Their own line first, then the first three things on their page, then the
 * lists as the footnote — in the order the page draws them, and each only
 * where there is one. */
function describe(profile) {
  const parts = [];
  if (profile.about) parts.push(/[.!?…]$/.test(profile.about) ? profile.about : profile.about + '.');

  const heads = profile.rows.slice(0, 3).map((row) => row.title).join(' · ');
  if (heads) parts.push(heads + '.');

  const n = profile.lists.length;
  if (n) {
    const lists = n === 1 ? '1 list' : n + ' lists';
    const kept = profile.kept === 1 ? ', kept once' : profile.kept ? ', kept ' + profile.kept + ' times' : '';
    parts.push(lists + ' of places in Tallinn' + (parts.length ? '' : ', created by ' + profile.name) + kept + '.');
  }

  return parts.length ? parts.join(' ') : profile.name + ' has not published a list yet.';
}

/* The page as a search engine reads it: a ProfilePage whose main entity is
   the Person, with the line as their description, the face as their picture
   where there is one, and every address on the page — the three handles and
   the rows that are links — as sameAs, which is the property a search engine
   uses to tie a person's pages together. Written only where the page is
   indexed at all. */
function structuredData(request, profile) {
  const self = canonical(request, '/u/' + profile.name);
  const links = profile.links || {};
  const sameAs = NETWORKS
    .filter((net) => links[net.id])
    .map((net) => linkUrl(net.id, links[net.id]))
    .concat(profile.rows.filter((row) => row.url).map((row) => row.url));

  const person = { '@type': 'Person', '@id': self + '#person', name: profile.name, url: self };
  if (profile.about) person.description = profile.about;
  if (profile.face) person.image = canonical(request, profile.face);
  if (sameAs.length) person.sameAs = sameAs;

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
   title over its text. Every link out is nofollow, as the script writes it. */
function rowsAsText(rows) {
  if (!rows.length) return '';
  return '<ul>' + rows.map((row) => {
    if (row.url) return '<li><a rel="nofollow noopener" href="' + esc(row.url) + '">' + esc(row.title) + '</a></li>';
    if (row.note) return '<li>' + esc(row.title) + '<p>' + esc(row.note) + '</p></li>';
    return '<li><strong>' + esc(row.title) + '</strong></li>';
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
    type: 'profile'
  });
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

  /* The page as text, for the reader that runs no script — see fill() in
     functions/_shell.js: the name, the line they wrote, where else they are,
     their page of links, and their lists, each a link. */
  html = fill(html, EMPTY['lists.html'],
    '<h1>' + esc(profile.name) + '</h1>' +
    (profile.about ? '<p>' + esc(profile.about) + '</p>' : '') +
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
