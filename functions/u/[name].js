/**
 * Tallinn Tastebuds — /u/<name>, the page a byline leads to.
 *
 * Every list on this site says who put it together. Until now that was the
 * end of the sentence: a name with nothing behind it, on a page you had
 * arrived at from somewhere else. This is what it leads to — the rest of what
 * that person has published, and the one number this site keeps about them.
 *
 * It is the same document lists.html serves, the same way /list/<id> and
 * /lists/public are: this Function fetches the page out of the deployment, swaps
 * the block between the head markers for this person's own tags, and seeds the
 * profile into it. See functions/_shell.js, which all three share.
 *
 * WHAT IS ON IT
 *
 * Their public lists, and how many times those have been kept in total. Not
 * their saves, not their private lists, not the lists they kept — see
 * functions/api/_profile.js for why each of those is left off. A profile adds
 * no fact about anybody that a list of theirs was not already printing.
 *
 * INDEXED, AND WHY
 *
 * The same reasoning that made a public list indexable. It is a page of
 * somebody's writing about restaurants in this city, under the name they
 * chose, and a page nobody can arrive at is most of the way to not being
 * published at all. A profile with no public lists on it is a page with
 * nothing to find, so that one is served and not indexed.
 *
 * WHAT HAPPENS WHEN IT CANNOT
 *
 * Every failure ends the same way as it does for a list: the untouched page,
 * and the script asks /api/profile like it would have anyway. This route is
 * an improvement on the load, never a requirement for it.
 */

import { sessionUser, wrongDatabase } from '../api/_lib.js';
import { readProfile, USERNAME } from '../api/_profile.js';
import { canonical, head, shell, sow, rehead, page } from '../_shell.js';

/* The line under the name in a preview card.
 *
 * English, on a site that is read in ten languages, for the reason
 * functions/list/[id].js gives: a crawler's Accept-Language is whatever its
 * operator set, and the card it builds is shown to everybody the link is
 * forwarded to rather than to the person who fetched it. The page underneath
 * follows the reader's own language as usual. */
function describe(profile) {
  const n = profile.lists.length;
  if (!n) return profile.name + ' has not published a list yet.';
  const lists = n === 1 ? '1 list' : n + ' lists';
  const kept = profile.kept === 1 ? 'kept once' : 'kept ' + profile.kept + ' times';
  return lists + ' of places in Tallinn, put together by ' + profile.name +
    (profile.kept ? ', ' + kept + '.' : '.');
}

export async function onRequest(context) {
  const { request, env, params } = context;

  let html;
  try {
    html = await shell(context);
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
    profile = await readProfile(context, name, user);
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

  html = sow(html, '__TTB_PROFILE', {
    user: user ? user.username : null,
    profile: profile
  });

  return page(html, 200, profile.lists.length > 0);
}
