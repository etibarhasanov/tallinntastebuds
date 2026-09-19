/**
 * Tallinn Tastebuds — serving a page of this site with a head of its own.
 *
 * Underscore-prefixed, so this is a module and never a route. Six Functions
 * hand back one of four static pages with different tags written into it:
 *
 *   functions/index.js        index.html, in the language its address names
 *                             and standing on the place it names, so a search
 *                             engine can index the map ten times and every
 *                             place once, and a shared link unfurls as the place
 *   functions/list/[id].js    lists.html: one list, so a shared link unfurls
 *                             as what it is
 *   functions/lists/index.js  lists.html: the directory, so a search can find
 *                             it
 *   functions/u/[name].js     lists.html: one person, which is where a byline
 *                             leads
 *   functions/split.js        split.html: one group, so a pasted link says
 *                             which
 *   functions/flashcard.js    flashcard.html: one deck of Estonian, written
 *                             into the page as text so a search for what a
 *                             word means finds this site answering
 *
 * The map and the split page write their own tags rather than taking head():
 * it spells one title for every caller and hands every caller the mark as its
 * picture, and neither is right for a restaurant, which has a photograph and
 * a language, or for a group, whose name wants no site suffix after it. Both
 * take esc(), rehead() and canonical(); the map also takes SITE, because a
 * place's card is a photograph at an address of its own.
 *
 * What is in here is the part they cannot each have their own copy of: the two
 * escaping rules, the page out of the deployment, the head, the head swap, the
 * seeding, the filling of an element the page ships empty, and the response.
 * The escaping is the reason this file exists — the
 * rules below are the difference between a title somebody typed and a title
 * somebody typed being executed, and two copies of one is two places for one
 * of them to fall behind. That is the same argument assets/lists.js makes
 * about the sign-in form living in exactly one place, and it matters more
 * here.
 *
 * The head came here when the third route arrived, and was written out per
 * route before that. Seven of a page's twelve tags are the same seven on all
 * of them — the site name, the size of the card image, the twitter card — and
 * the five that differ are the five arguments head() takes. The picture is the
 * one that only became an argument later: it was the mark for everybody until
 * the flashcards turned out to need a card of their own, so it is the one with
 * a default rather than a value.
 *
 * What each route decides for itself: what it calls itself and says about
 * itself, what is seeded, what status it answers with, whether the page is
 * worth indexing, and — for the map alone — how long a browser may keep it.
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

/* A static file out of the deployment, by its path — "/lists.html",
   "/split.html". ASSETS is the binding Pages gives a Function for its own
   static files; the plain fetch is what makes this work under `wrangler pages
   dev`, where the binding is not always there. The map is the one page not
   fetched this way: "/" is index.html, and functions/index.js says why it
   takes context.next() instead. */
export async function shell(context, file) {
  const url = new URL(file, context.request.url);
  const res = context.env.ASSETS
    ? await context.env.ASSETS.fetch(new Request(url.toString()))
    : await fetch(url.toString());
  if (!res.ok) throw new Error(file + ' unreadable: ' + res.status);
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

/* Writing text into an element the page ships empty — the map's #list-body,
   the list pages' <main> — for the reader that never runs the script and
   would otherwise get a page with nothing on it. `empty` is the element's
   exact markup, open tag and close tag together, so a page edit that changes
   its spelling stops this matching and tools/validate.mjs says so rather
   than a crawler quietly getting the empty page back. The script empties the
   element again before it draws, so nobody sees what went in here.

   A function for the replacement, for the reason sow() gives: a dollar sign
   in somebody's write-up must not be read as a substitution. */
export function fill(html, empty, inner) {
  const close = empty.lastIndexOf('</');
  return html.replace(empty, () => empty.slice(0, close) + inner + empty.slice(close));
}

/* The elements, by page. Said once: the routes fill them and tools/validate.mjs
   holds each page to the spelling. */
export const EMPTY = {
  'index.html': '<div id="list-body"></div>',
  'lists.html': '<main class="lists-main" id="main" tabindex="-1"></main>',
  /* The same spelling the lists page has, because the flashcards page is built
     out of the same furniture. Two keys with one value rather than one key
     for both: what this table is is a page's promise about its own markup, and
     two pages that happen to agree today are two pages that may not. */
  'flashcard.html': '<main class="lists-main" id="main" tabindex="-1"></main>'
};

export const SITE = 'https://tallinntastebuds.ee';
const HOST = new URL(SITE).hostname;

/* Which address a page should say it is. The same document answers at the live
   domain and at every preview deployment, and a crawler that found two copies
   would have to pick one — so on the live host it names the live URL, and
   anywhere else it names itself at the same path rather than pointing a
   preview at a page that may not be deployed yet. The path and not the whole
   request, on either host: the map answers ?type= and ?style= on top of the
   address it is indexed at, and those are deep links into the page rather
   than pages of their own. */
export function canonical(request, path) {
  const url = new URL(request.url);
  return (url.hostname === HOST ? SITE : url.origin) + path;
}

/* The head of one of these pages: what it is called, what it says about
   itself, where it lives, and the card an unfurler builds out of those.
 *
 * `title` is the bare name — the suffix is added here, so no caller can spell
 * it differently — and `type` is the og:type: "article" for a list somebody
 * wrote, "profile" for the person who wrote it, "website" for the directory.
 * Everything is escaped on the way in, including the values that are constants
 * today, because the next caller's may not be.
 *
 * `image` is the one with a default, and the default is what nearly every
 * caller wants: the mouth, over the site's name and the line about the map,
 * which is the right card for anything that is a view of the map. A page that
 * is about something else says so by naming its own — the flashcards are the
 * one that does, and functions/flashcard.js says why. Either way it is a path
 * under the site and either way the picture is drawn at 1200x630, which is
 * what lets the two tags under it be written once.
 *
 * The name is the site's rather than the page's because functions/index.js and
 * functions/split.js each hold a copy of this path — they write their twelve
 * tags out rather than calling this, so there is nowhere yet for the three to
 * agree. Two of the four are one edit apart from being one. */
const SITE_CARD = '/assets/logo/og.jpg';

export function head(meta) {
  const title = esc(meta.title) + ' | Tallinn Tastebuds';
  const description = esc(meta.description);
  const url = esc(meta.url);
  const image = esc(SITE + (meta.image || SITE_CARD));

  return [
    /* The only <title> the page has. It used to be the second one — lists.html
       kept its own above the markers and this was written under it, on the
       belief that the last <title> in a head is the one that binds. It is the
       first: the HTML spec says the document's title is the child text of the
       *first* title element, so for as long as that arrangement stood, a list
       shared into a chat showed "Lists | Tallinn Tastebuds" to every unfurler
       that falls back to the tag, and every tab opened one flashed it before
       assets/lists.js caught up. lists.html's own now sits inside the markers,
       where split.html has always kept its, so this replaces it rather than
       queueing behind it. */
    '<title>' + title + '</title>',
    '<meta name="description" content="' + description + '">',
    '<link rel="canonical" href="' + url + '">',
    '<meta property="og:type" content="' + esc(meta.type) + '">',
    '<meta property="og:site_name" content="Tallinn Tastebuds">',
    '<meta property="og:url" content="' + url + '">',
    '<meta property="og:title" content="' + title + '">',
    '<meta property="og:description" content="' + description + '">',
    '<meta property="og:image" content="' + image + '">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta name="twitter:card" content="summary_large_image">'
  ].join('\n');
}

/* The block between the two markers in a page, swapped for tags of this
   answer's own. Left alone when the markers are not both there — which
   tools/validate.mjs refuses to build, since a page served through here with
   no markers is a page quietly wearing its static head at every address. */
const HEAD_OPEN = '<!--PAGE-HEAD-->';
const HEAD_CLOSE = '<!--/PAGE-HEAD-->';

export function rehead(html, tags) {
  const open = html.indexOf(HEAD_OPEN);
  const close = html.indexOf(HEAD_CLOSE);
  if (open === -1 || close <= open) return html;
  return html.slice(0, open) + tags + html.slice(close + HEAD_CLOSE.length);
}

/* What every page served through here carries. The two security headers are
   the ones `_headers` gives every static file under `/*`, said again because
   that file binds only on an answer the asset server gave: a Function's own
   Response arrives with exactly the headers it was built with. The map is not
   under this — functions/index.js copies the static answer's headers instead,
   which carry the same two. */
const PAGE_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin'
};

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
      ...PAGE_HEADERS,
      'cache-control': 'no-store',
      'x-robots-tag': indexable ? 'index, follow' : 'noindex, follow'
    }
  });
}
