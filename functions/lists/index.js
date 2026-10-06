/**
 * Tallinn Tastebuds — /lists, the directory.
 *
 * Every public list on this site, the most opened first, with a field to
 * search them. It is the one page here that puts one person's writing above
 * another's, and the argument for it — and the cost of it — is set out in
 * README.md under **Public lists**. This file is only how the page is served.
 *
 * It is lists.html again, the way /list/<id> is, and for two of the same
 * reasons and one of its own:
 *
 *   the tab says      "Everybody's lists"   and not "Lists | Tallinn Tastebuds"
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
 * serves feedback.html at /feedback — so the bare address already answered, with
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
 * KEPT IN THE COLO, FOR WHOEVER IS NOT SIGNED IN
 *
 * The rows are seeded per session — whose you are, which of them you kept —
 * so a copy of this page is kept only where nobody was signed in, under the
 * address with the search and the order on it, stamped with the deployment,
 * for PAGE_TTL, a minute. A signed-in visit is rendered and answered
 * no-store, as it always was. KEPT IN THE COLO in functions/_shell.js is the
 * mechanism and the argument; what is this file's is the key and the one
 * file the copy is stamped with, which is the page.
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
import {
  canonical, esc, head, shell, sow, rehead, fill, EMPTY, page,
  PRIVATELY, PAGE_TTL, deployStamp, coloKey, fromColo, keepInColo, signedIn
} from '../_shell.js';
import { mostKept, query, sortOf } from '../api/_mostkept.js';

const PATH = '/lists';

/* English, on a site read in ten languages, for the reason the same decision
   is explained at length in functions/list/[id].js: a crawler's
   Accept-Language is whatever its operator set, and the card built from these
   tags is shown to everybody a link is forwarded to rather than to whoever
   fetched it. The page underneath follows the reader's own language. */
const TITLE = 'Everybody’s lists';
const DESCRIPTION =
  'Lists of places in Tallinn, written by the people whose names are on them, ' +
  'with the most opened first. Search them by name or by who wrote them.';

/* The page as text, for the reader that runs no script — see fill() in
   functions/_shell.js: the first page of everybody's lists, each a link to the
   list with whose it is and the first names off it, which is what the row
   prints too. */
function prose(first) {
  const row = (list) => '<li><h3><a href="/list/' + esc(list.id) + '">' + esc(list.title) + '</a></h3>' +
    (list.by ? '<p>' + esc(list.by) + '</p>' : '') +
    (list.taste && list.taste.length ? '<p>' + esc(list.taste.join(', ')) + '</p>' : '') +
    '</li>';
  return '<h1>' + esc(TITLE) + '</h1><p>' + esc(DESCRIPTION) + '</p>' +
    '<ol>' + first.all.map(row).join('') + '</ol>';
}

/* The copy's address: the directory, with the search and the order the
   render was made with — tidied, so that two spellings of one question are
   one copy — and nothing else off the query. */
function directoryKey(request, q, sort, stamp) {
  const url = new URL(canonical(request, PATH));
  if (q) url.searchParams.set('q', q);
  url.searchParams.set('sort', sort);
  return coloKey(url.toString(), stamp);
}

export async function onRequest(context) {
  const { request, env } = context;

  /* What somebody searched for, when they arrived on a link that carried one.
     Seeded rather than left to the script, so a search anybody sent is a page
     that draws its answer rather than a page that draws everything and then
     replaces it. The field is filled from the same value — see wantedQuery()
     in assets/lists.js — tidied the way the query tidies it, so the field and
     the rows under it are about the same question. */
  const q = query(new URL(request.url).searchParams.get('q'));
  /* And the order, the same way: a link to the newest lists draws the newest
     lists, with the chip for that order already pressed. An unknown order is
     the default, as it is for the API. */
  const sort = sortOf(new URL(request.url).searchParams.get('sort'));

  /* The copy this colo holds for whoever is not signed in — KEPT IN THE COLO
     in the header. A stamp that cannot be read is the page served the way it
     was before any copy was kept. */
  let key = null;
  if (!signedIn(request)) {
    try {
      key = directoryKey(request, q, sort, await deployStamp(context, ['/lists.html']));
      const hit = await fromColo(request, key, PRIVATELY);
      if (hit) return hit;
    } catch (e) {
      key = null;
    }
  }

  let html;
  try {
    html = await shell(context, '/lists.html');
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

  let first;
  let user;
  try {
    user = await sessionUser(request, env);
    first = await mostKept(context, { q: q, sort: sort, user: user });
  } catch (e) {
    return page(html, 200, true);
  }

  /* The first page of it, into the document. assets/lists.js reads
     window.__TTB_ALL and falls back to fetching when it is not there.

     The username goes in with it, as it does on a list's own page, and for the
     same small reason: the header wears whoever you are, and a page that drew
     without asking would be the one page on this site where your own name is
     missing from it. The rows carry a bookmark each, so what is seeded here is
     per-session twice over — which is why it is no-store to anybody signed
     in, and why the copy kept below is only ever of the page nobody was. */
  html = sow(html, '__TTB_ALL', {
    user: user ? user.username : null,
    q: q,
    sort: first.sort,
    all: first.all,
    next: first.next
  });
  html = fill(html, EMPTY['lists.html'], prose(first));

  const res = page(html, 200, true);
  return key ? keepInColo(context, key, res, PAGE_TTL, PRIVATELY) : res;
}
