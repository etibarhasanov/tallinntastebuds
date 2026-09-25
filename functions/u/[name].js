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
 * The line is not the page's description. describe() below is the rows where
 * there are any and the lists otherwise, because a description tells a
 * searcher what is on the page — a bio that reads "i like cats" would be
 * true about its author and useless as the thing under a search result.
 *
 * INDEXED, AND WHY
 *
 * The same reasoning that made a public list indexable. It is a page of
 * somebody's writing, under the name they chose, and a page nobody can arrive
 * at is most of the way to not being published at all. A profile with no
 * public lists and no rows on it is a page with nothing to find, so that one
 * is served and not indexed.
 *
 * WHAT HAPPENS WHEN IT CANNOT
 *
 * Every failure ends the same way as it does for a list: the untouched page,
 * and the script asks /api/profile like it would have anyway. This route is
 * an improvement on the load, never a requirement for it.
 */

import { sessionUser, wrongDatabase } from '../api/_lib.js';
import { readProfile, USERNAME, NETWORKS, linkUrl } from '../api/_profile.js';
import { canonical, esc, head, shell, sow, rehead, fill, EMPTY, page } from '../_shell.js';

/* The line under the name in a preview card.
 *
 * English, on a site that is read in ten languages, for the reason
 * functions/list/[id].js gives: a crawler's Accept-Language is whatever its
 * operator set, and the card it builds is shown to everybody the link is
 * forwarded to rather than to the person who fetched it. The page underneath
 * follows the reader's own language as usual. */
function describe(profile) {
  const n = profile.lists.length;
  const lists = n === 1 ? '1 list' : n + ' lists';
  /* The first three things on their page, where there is one: that is what
     the page is about to whoever made it, and the lists are the footnote. */
  const heads = profile.rows.slice(0, 3).map((row) => row.title).join(' · ');
  if (heads) return heads + (n ? ' — and ' + lists + ' of places in Tallinn.' : '.');
  if (!n) return profile.name + ' has not published a list yet.';
  const kept = profile.kept === 1 ? 'kept once' : 'kept ' + profile.kept + ' times';
  return lists + ' of places in Tallinn, created by ' + profile.name +
    (profile.kept ? ', ' + kept + '.' : '.');
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

  html = rehead(html, head({
    title: profile.name,
    description: describe(profile),
    /* The stored spelling, not the one in the URL. Usernames are minted
       lowercase and matched without case, so /u/KATE and /u/kate are one page
       and only one of them is the address it should be indexed at. */
    url: canonical(request, '/u/' + profile.name),
    type: 'profile'
  }));

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

  return page(html, 200, profile.lists.length > 0 || profile.rows.length > 0);
}
