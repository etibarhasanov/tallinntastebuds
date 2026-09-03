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
 * NOINDEX, AND WHY
 *
 * A list is somebody else's writing on my domain, and nothing moderates it.
 * Unfurling and indexing are different things — the scrapers that build a
 * preview card do not consult this header — so a shared link still arrives
 * looking like itself, while Google is not asked to carry whatever anybody
 * types. If that stops being the right trade, it is the one header below.
 */

import { sessionUser, wrongDatabase } from '../api/_lib.js';
import { readList, LIST_ID } from '../api/_lists.js';

const SITE = 'https://tallinntastebuds.ee';
const HEAD_OPEN = '<!--LIST-HEAD-->';
const HEAD_CLOSE = '<!--/LIST-HEAD-->';

/* Text on its way into an attribute or an element. The quotes matter most —
   every use below is inside a content="…" — and the ampersand has to go first
   or it would double-escape the entities the others introduce. */
function esc(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* JSON on its way into a <script> element. JSON.stringify is not enough on its
   own: a title containing the characters "</script>" would close the element
   from inside the string, and U+2028 and U+2029 are line terminators to a
   JavaScript parser but ordinary characters to a JSON one. */
function seed(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

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

function headTags(list, url) {
  const title = esc(list.title) + ' | Tallinn Tastebuds';
  const description = esc(describe(list));

  return [
    /* The <title> in lists.html sits above the marker and is left alone, so
       this one is second and wins: the last <title> in a head is the one a
       browser uses, and every unfurler reads og:title anyway. */
    '<title>' + esc(list.title) + ' | Tallinn Tastebuds</title>',
    '<meta name="description" content="' + description + '">',
    '<meta property="og:type" content="article">',
    '<meta property="og:site_name" content="Tallinn Tastebuds">',
    '<meta property="og:url" content="' + esc(url) + '">',
    '<meta property="og:title" content="' + title + '">',
    '<meta property="og:description" content="' + description + '">',
    '<meta property="og:image" content="' + SITE + '/assets/logo/og.jpg">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta name="twitter:card" content="summary_large_image">'
  ].join('\n');
}

/* The page itself, out of the deployment. ASSETS is the binding Pages gives a
   Function for its own static files; the plain fetch is what makes this work
   under `wrangler pages dev`, where the binding is not always there. */
async function shell(context) {
  const url = new URL('/lists.html', context.request.url);
  const res = context.env.ASSETS
    ? await context.env.ASSETS.fetch(new Request(url.toString()))
    : await fetch(url.toString());
  if (!res.ok) throw new Error('lists.html unreadable: ' + res.status);
  return res.text();
}

function page(html, status) {
  return new Response(html, {
    status: status || 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      /* Never cached. A list is edited by its owner while they are looking at
         it, and — because a private list is served only to the session that
         owns it — a shared copy of this response would be a copy of somebody's
         private page handed to the next person to ask for it. */
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, follow'
    }
  });
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

  const url = new URL(request.url);
  const shared = SITE + '/list/' + list.id;

  const open = html.indexOf(HEAD_OPEN);
  const close = html.indexOf(HEAD_CLOSE);
  if (open !== -1 && close > open) {
    html = html.slice(0, open) +
      headTags(list, url.hostname === 'tallinntastebuds.ee' ? shared : url.toString()) +
      html.slice(close + HEAD_CLOSE.length);
  }

  /* The list, into the document, so the page draws on the first paint instead
     of after a round trip it has all the answers for. assets/lists.js reads
     window.__TTB_LIST and falls back to fetching when it is not there. */
  const payload = seed({
    id: list.id,
    user: user ? user.username : null,
    list: list
  });
  /* Matched without the closing quote, because tools/stamp.mjs writes a
     content hash into that attribute — `assets/lists.js?v=1a2b3c4d` — and a
     pattern that ended at the quote would stop matching the moment the script
     was next edited. */
  const TAG = '<script src="/assets/lists.js';
  /* The replacement is a function and not a string, and that is the whole
     point of it. String.replace reads $&, $`, $' and $$ out of a replacement
     *string* and substitutes around the match — so a list titled `$'` would
     have spliced the entire rest of the document into the middle of this
     inline script, straight through JSON.stringify and everything seed() does,
     because the substitution happens after all of that. A function's return
     value is used literally, and there is nothing left to escape. */
  html = html.replace(TAG, () =>
    '<script>window.__TTB_LIST=' + payload + ';</script>\n' + TAG);

  return page(html, 200);
}
