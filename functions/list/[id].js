/**
 * Tallinn Tastebuds — /list/<id>, the address a list is shared at.
 *
 * The whole point of a list is that somebody sends it to somebody else. So
 * this route exists to make the thing that arrives in a message worth opening:
 *
 *   the tab says      "Top ten burgers"          and not "Lists | Tallinn Tastebuds"
 *   the unfurl says   the title, the byline, the line under it
 *   the page draws    with the list already in it, no second request
 *
 * None of that is possible from a static file. A static page has one title in
 * its head, and the crawler that builds the little card in WhatsApp or
 * Instagram does not run the script that would change it. So this Function
 * serves the page instead: it fetches lists.html out of the deployment, swaps
 * the block between the <!--LIST-HEAD--> markers for that list's own tags, and
 * seeds the list into the document.
 *
 * It is still lists.html. There is one page and one stylesheet and one script,
 * and this hands back the same file with a different head — rather than a
 * second copy of the markup that would go stale the first time the other one
 * changed.
 *
 * WHAT HAPPENS WHEN IT CANNOT
 *
 * Every failure ends the same way: the untouched page, and the script fetches
 * the list over /api/lists like it would have anyway. No database bound, the
 * wrong database, an id that is not a list, somebody else's private list — all
 * of them are the plain shell, and the page says the honest thing once the
 * script has asked. This route is an improvement on the load, never a
 * requirement for it.
 *
 * INDEXED, AND WHY
 *
 * A public list is indexable. It was not, for a while, and the reasoning for
 * the change is worth keeping.
 *
 * The case against was that a list is somebody else's writing on my domain
 * and nothing moderates it. That is still true. What changed is the reading
 * of what a list is *for*: it is a page somebody wrote about restaurants in
 * this city, under their own name, and the whole point of it is that other
 * people find it. A list that travels only by the link its author remembers
 * to send is a page nobody arrives at. Somebody searching for the bakeries
 * worth the walk in Tallinn should be able to land on the list of them.
 *
 * A private list is a different object entirely and is still noindex — with
 * or without the header, since it is served only to the session that owns it
 * and a crawler is never that session. The header goes on anyway, because a
 * page's own answer should not depend on nobody having made a mistake
 * somewhere else.
 *
 * TWO THINGS THIS DOES NOT CHANGE
 *
 * `/lists.html` stays noindex — it is your own lists, and signed out there is
 * nothing on it. That header is in `_headers`.
 *
 * And nothing here is cached, indexable or not. See page() in
 * functions/_shell.js, which is where the response itself is built.
 */

import { sessionUser, wrongDatabase } from '../api/_lib.js';
import { readList, LIST_ID } from '../api/_lists.js';
/* The page out of the deployment, the head, the head swap and the seeding are
   shared with the two other routes that serve this same document —
   functions/lists/kept.js with everybody's lists in it, functions/u/[name].js
   with one person's. See functions/_shell.js for why they are not written out
   three times. */
import { canonical, head, shell, sow, rehead, page } from '../_shell.js';

/* The line under the title in a preview card. Their own if they wrote one,
   and otherwise a plain statement of what the link holds.
 *
 * English, on a site that is read in ten languages, because this is the one
 * string here that has no reader to ask: a crawler's Accept-Language is
 * whatever its operator set, and the card it builds is shown to everybody the
 * link is forwarded to rather than to the person who fetched it. The page
 * underneath follows the reader's own language as usual. */
function describe(list) {
  if (list.intro) return list.intro;
  const n = list.items.length;
  const places = n === 1 ? '1 place' : n + ' places';
  return list.by
    ? places + ' in Tallinn, picked by ' + list.by + '.'
    : places + ' in Tallinn.';
}

export async function onRequest(context) {
  const { request, env, params } = context;

  let html;
  try {
    html = await shell(context);
  } catch (e) {
    /* The page itself is missing from the deployment, which is a broken build
       rather than a missing list. Nothing here can improve on Pages' own
       answer for it. */
    return new Response('Not found', { status: 404 });
  }

  const id = String(params.id || '');

  if (!LIST_ID.test(id)) return page(html, 404);
  if (!env.DB || (await wrongDatabase(env))) return page(html, 200);

  let list;
  let user;
  try {
    user = await sessionUser(request, env);
    list = await readList(context, id, user);
  } catch (e) {
    /* The database being unreachable is not this page's failure to report:
       the script will ask /api/lists in a moment and say whatever is true
       then. */
    return page(html, 200);
  }

  /* No such list, or a private one that is not the caller's. The same answer
     for both, and a 404 with a page on it rather than a bare status: somebody
     following a link that has been deleted should land somewhere that says so
     and offers the map. */
  if (!list) return page(html, 404);

  html = rehead(html, head({
    title: list.title,
    description: describe(list),
    /* A public list is indexed, so it has to say which address it is: the
       same page answers at the live domain and at every preview deployment,
       and a crawler that found two copies would have to pick one. */
    url: canonical(request, '/list/' + list.id),
    type: 'article'
  }));

  /* The list, into the document, so the page draws on the first paint instead
     of after a round trip it has all the answers for. assets/lists.js reads
     window.__TTB_LIST and falls back to fetching when it is not there. */
  html = sow(html, '__TTB_LIST', {
    id: list.id,
    user: user ? user.username : null,
    list: list
  });

  /* Indexable only if it is public. A private list reaches this line only
     when its own owner asked for it, and their session is not a crawler —
     but the header says the true thing rather than relying on that. */
  return page(html, 200, list.public);
}
