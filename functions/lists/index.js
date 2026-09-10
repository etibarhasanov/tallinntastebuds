/**
 * Tallinn Tastebuds — /lists, the directory.
 *
 * Every public list on this site, the most kept first, with a field to search
 * them. It is the one page here that puts one person's writing above
 * another's, and the argument for it — and the cost of it — is set out in
 * README.md under **Public lists**. This file is only how the page is served.
 *
 * It is lists.html again, the way /list/<id> is, and for two of the same
 * reasons and one of its own:
 *
 *   the tab says      "Public lists"        and not "Lists | Tallinn Tastebuds"
 *   the page draws    with the first twenty rows already in it, no round trip
 *   a search finds it at an address that is about the directory
 *
 * The third is the new one. A public list has been indexable for a while, but
 * nothing linked one list to another, so every one of them was an island a
 * crawler could only reach if somebody had posted the link somewhere. This
 * page is what joins them up, which makes it worth indexing rather more than
 * it is worth reading cold.
 *
 * IT WAS /lists/kept, AND THEN /lists/public
 *
 * The first address said what the page was ordered by; the second said
 * "public" in a path where a list can be nothing else, since a private one is
 * served to its owner's session and could never have been in a directory to be
 * ruled out of one. What is left is the plural of the thing. Both of the old
 * addresses answer 301 to here — public.js and kept.js are those redirects and
 * nothing else — because an address that has been indexed is not a name you
 * get to take back, only one you get to forward. README.md under **Public
 * lists** has the whole of it.
 *
 * This file is index.js and not something named after the page because
 * functions/lists/index.js is /lists and nothing else, which leaves public.js
 * beside it free to go on answering the address it used to be.
 *
 * AND /lists WAS NOT FREE
 *
 * Pages serves lists.html at /lists as well as at /lists.html, the way it
 * serves google.html at /google — so the bare address already answered, with
 * the page that has nothing of its own on it any more and replaces itself with
 * /account.html. A Function outranks a static asset at the same path, which is
 * what makes this file the answer there now. /lists.html is untouched and
 * still goes to the account page.
 *
 * That makes it the one address on this site whose two spellings are two
 * different pages, and two files say so where it matters: robots.txt keeps the
 * extension on its Disallow line, because a Disallow is a path prefix and
 * losing it would hide this page from every crawler, and _headers keeps its
 * noindex on that spelling alone.
 *
 * WHAT HAPPENS WHEN IT CANNOT
 *
 * The same as its neighbour: the untouched page, and assets/lists.js asks
 * /api/lists?all=1 as it would have anyway. No database bound, the wrong
 * database, a query that threw — all of them are the plain shell, and the page
 * says the honest thing once the script has asked. This route is an
 * improvement on the load, never a requirement for it.
 */

import { sessionUser, wrongDatabase } from '../api/_lib.js';
import { canonical, head, shell, sow, rehead, page } from '../_shell.js';
import { mostKept, query } from '../api/_mostkept.js';

const PATH = '/lists';

/* English, on a site read in ten languages, for the reason the same decision
   is explained at length in functions/list/[id].js: a crawler's
   Accept-Language is whatever its operator set, and the card built from these
   tags is shown to everybody a link is forwarded to rather than to whoever
   fetched it. The page underneath follows the reader's own language. */
const TITLE = 'Public lists';
const DESCRIPTION =
  'Lists of places in Tallinn, written by the people whose names are on them, ' +
  'with the most kept first. Search them by name or by who wrote them.';

export async function onRequest(context) {
  const { request, env } = context;

  let html;
  try {
    html = await shell(context);
  } catch (e) {
    return new Response('Not found', { status: 404 });
  }

  html = rehead(html, head({
    title: TITLE,
    description: DESCRIPTION,
    /* The same page answers at the live domain and at every preview
       deployment. This says which of them is the one to index. */
    url: canonical(request, PATH),
    type: 'website'
  }));

  /* Indexable whatever happens below. The two failures this can have are a
     database that is not bound and a query that threw, and neither is a
     reason to tell a crawler to forget an address that will be answering
     properly again in a minute — the page it gets is the real one, it simply
     fetches its rows a moment later. */
  if (!env.DB || (await wrongDatabase(env))) return page(html, 200, true);

  /* What somebody searched for, when they arrived on a link that carried one.
     Seeded rather than left to the script, so a search anybody sent is a page
     that draws its answer rather than a page that draws everything and then
     replaces it. The field is filled from the same value — see wantedQuery()
     in assets/lists.js — tidied the way the query tidies it, so the field and
     the rows under it are about the same question. */
  const q = query(new URL(request.url).searchParams.get('q'));

  let first;
  let user;
  try {
    user = await sessionUser(request, env);
    first = await mostKept(context, { q: q, user: user });
  } catch (e) {
    return page(html, 200, true);
  }

  /* The first page of it, into the document. assets/lists.js reads
     window.__TTB_ALL and falls back to fetching when it is not there.

     The username goes in with it, as it does on a list's own page, and for the
     same small reason: the header wears whoever you are, and a page that drew
     without asking would be the one page on this site where your own name is
     missing from it. The rows carry a bookmark each, so what is seeded here is
     per-session twice over — which is why it is no-store, which it was going
     to be anyway. */
  html = sow(html, '__TTB_ALL', {
    user: user ? user.username : null,
    q: q,
    all: first.all,
    next: first.next
  });

  return page(html, 200, true);
}
