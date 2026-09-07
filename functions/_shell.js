/**
 * Tallinn Tastebuds — serving lists.html with a head of its own.
 *
 * Underscore-prefixed, so this is a module and never a route. Two Functions
 * hand back that one page with different tags written into it:
 *
 *   functions/list/[id].js   one list, so a shared link unfurls as what it is
 *   functions/lists/kept.js  the directory, so it is a page a search can find
 *
 * What is in here is the part they cannot each have their own copy of. Two of
 * the four are escaping — the rules below are the difference between a title
 * somebody typed and a title somebody typed being executed — and two copies of
 * an escaping rule is two places for one of them to fall behind. That is the
 * same argument assets/lists.js makes about the sign-in form living in exactly
 * one place, and it matters more here.
 *
 * What each route decides for itself: which tags go in, what is seeded, what
 * status it answers with, and whether the page is worth indexing.
 */

/* Text on its way into an attribute or an element. The quotes matter most —
   every use is inside a content="…" — and the ampersand has to go first or it
   would double-escape the entities the others introduce. */
export function esc(text) {
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
export function seed(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/* The page itself, out of the deployment. ASSETS is the binding Pages gives a
   Function for its own static files; the plain fetch is what makes this work
   under `wrangler pages dev`, where the binding is not always there. */
export async function shell(context) {
  const url = new URL('/lists.html', context.request.url);
  const res = context.env.ASSETS
    ? await context.env.ASSETS.fetch(new Request(url.toString()))
    : await fetch(url.toString());
  if (!res.ok) throw new Error('lists.html unreadable: ' + res.status);
  return res.text();
}

/* Writing a payload into the document, above the script that reads it, so the
   page draws on the first paint instead of after a round trip it has all the
   answers for.
 *
 * The tag is matched without its closing quote, because tools/stamp.mjs writes
 * a content hash into that attribute — `assets/lists.js?v=1a2b3c4d` — and a
 * pattern that ended at the quote would stop matching the moment the script
 * was next edited.
 *
 * The replacement is a function and not a string, and that is the whole point
 * of it. String.replace reads $&, $`, $' and $$ out of a replacement *string*
 * and substitutes around the match — so a list titled `$'` would have spliced
 * the entire rest of the document into the middle of this inline script,
 * straight through JSON.stringify and everything seed() does, because the
 * substitution happens after all of that. A function's return value is used
 * literally, and there is nothing left to escape. */
const TAG = '<script src="/assets/lists.js';

export function sow(html, global, value) {
  return html.replace(TAG, () =>
    '<script>window.' + global + '=' + seed(value) + ';</script>\n' + TAG);
}

/* The block between the two markers in lists.html, swapped for tags of this
   page's own. Left alone when the markers are not both there, which is a
   broken build rather than anything this can improve on. */
const HEAD_OPEN = '<!--LIST-HEAD-->';
const HEAD_CLOSE = '<!--/LIST-HEAD-->';

export function rehead(html, tags) {
  const open = html.indexOf(HEAD_OPEN);
  const close = html.indexOf(HEAD_CLOSE);
  if (open === -1 || close <= open) return html;
  return html.slice(0, open) + tags + html.slice(close + HEAD_CLOSE.length);
}

/* Never cached, whether or not it is indexed. A list is edited by its owner
   while they are looking at it, and — because a private list is served only to
   the session that owns it — a shared copy of one of these responses would be
   a copy of somebody's page handed to the next person to ask for it. The
   directory is under the same rule for the smaller version of the same reason:
   it is seeded with rows that change as people keep things.
 *
 * A crawler is not harmed by this: it fetches a page once and keeps what it
 * finds. no-store is about the caches in between. */
export function page(html, status, indexable) {
  return new Response(html, {
    status: status || 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': indexable ? 'index, follow' : 'noindex, follow'
    }
  });
}
