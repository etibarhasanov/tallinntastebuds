/**
 * Tallinn Tastebuds — /lists/kept, the directory.
 *
 * Every public list on this site, the most kept first. It is the one page here
 * that puts one person's writing above another's, and the argument for it —
 * and the cost of it — is set out in README.md under **Lists people kept**.
 * This file is only how the page is served.
 *
 * It is lists.html again, the way /list/<id> is, and for two of the same
 * reasons and one of its own:
 *
 *   the tab says      "Lists people kept"   and not "Lists | Tallinn Tastebuds"
 *   the page draws    with the first twenty rows already in it, no round trip
 *   a search finds it at an address that is about the directory
 *
 * The third is the new one. A public list has been indexable for a while, but
 * nothing linked one list to another, so every one of them was an island a
 * crawler could only reach if somebody had posted the link somewhere. This
 * page is what joins them up, which makes it worth indexing rather more than
 * it is worth reading cold.
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
import { esc, shell, sow, rehead, page } from '../_shell.js';
import { mostKept } from '../api/_mostkept.js';

const SITE = 'https://tallinntastebuds.ee';
const PATH = '/lists/kept';

/* English, on a site read in ten languages, for the reason the same decision
   is explained at length in functions/list/[id].js: a crawler's
   Accept-Language is whatever its operator set, and the card built from these
   tags is shown to everybody a link is forwarded to rather than to whoever
   fetched it. The page underneath follows the reader's own language. */
const TITLE = 'Lists people kept | Tallinn Tastebuds';
const DESCRIPTION =
  'Lists of places in Tallinn, written by the people whose names are on them, ' +
  'with the most kept first.';

function headTags(url) {
  return [
    /* The <title> in lists.html sits above the marker and is left alone, so
       this one is second and wins: the last <title> in a head is the one a
       browser uses, and every unfurler reads og:title anyway. */
    '<title>' + TITLE + '</title>',
    '<meta name="description" content="' + DESCRIPTION + '">',
    /* The same page answers at the live domain and at every preview
       deployment. This says which of them is the one to index. */
    '<link rel="canonical" href="' + esc(url) + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Tallinn Tastebuds">',
    '<meta property="og:url" content="' + esc(url) + '">',
    '<meta property="og:title" content="' + TITLE + '">',
    '<meta property="og:description" content="' + DESCRIPTION + '">',
    '<meta property="og:image" content="' + SITE + '/assets/logo/og.jpg">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta name="twitter:card" content="summary_large_image">'
  ].join('\n');
}

export async function onRequest(context) {
  const { request, env } = context;

  let html;
  try {
    html = await shell(context);
  } catch (e) {
    return new Response('Not found', { status: 404 });
  }

  const url = new URL(request.url);
  html = rehead(html, headTags(
    url.hostname === 'tallinntastebuds.ee' ? SITE + PATH : url.toString()));

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
    first = await mostKept(context, '');
  } catch (e) {
    return page(html, 200, true);
  }

  /* The first page of it, into the document. assets/lists.js reads
     window.__TTB_ALL and falls back to fetching when it is not there.

     The username goes in with it, as it does on a list's own page, and for the
     same small reason: the header wears whoever you are, and a page that drew
     without asking would be the one page on this site where your own name is
     missing from it. The rows themselves are the same twenty for everybody —
     it is the response that is per-session, which is why it is no-store, which
     it was going to be anyway. */
  html = sow(html, '__TTB_ALL', {
    user: user ? user.username : null,
    all: first.all,
    next: first.next
  });

  return page(html, 200, true);
}
