/**
 * Tallinn Tastebuds — serving a page of this site with a head of its own.
 *
 * Underscore-prefixed, so this is a module and never a route. Seven Functions
 * hand back one of five static pages with different tags written into it:
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
 *   functions/blog.js         blog.html: one post, written into the page as
 *                             text, so a search for where to eat finds the
 *                             post that answers it
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
 * seeding, the filling of an element the page ships empty, the response, and
 * the copy of it a colo keeps — KEPT IN THE COLO at the bottom.
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
 * worth indexing, which files its copy in the colo is stamped with and how
 * long that copy lives, and — for the map alone — what the browser is told.
 */

import { hex, weakTag, withNotModified, sessionTokens } from './api/_lib.js';

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
  'flashcard.html': '<main class="lists-main" id="main" tabindex="-1"></main>',
  'blog.html': '<main class="lists-main" id="main" tabindex="-1"></main>',
  'privacy.html': '<main class="lists-main" id="main" tabindex="-1"></main>'
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
 * what lets the two tags under it be written once. A person's face is the
 * third kind, and is not drawn at any size of this file's choosing — see
 * below.
 *
 * The name is the site's rather than the page's because functions/index.js and
 * functions/split.js each hold a copy of this path — they write their twelve
 * tags out rather than calling this, so there is nowhere yet for the three to
 * agree. Two of the four are one edit apart from being one. */
const SITE_CARD = '/assets/logo/og.jpg';

/* A face is the other kind of picture, and it changes three things about the
   card. It is a person's photograph rather than the site's, so the card
   carries their name alone — the suffix stays on the <title>, where a tab and
   a search result want to say whose page this is, and comes off og:title,
   which is what a chat prints under the picture beside the host it already
   shows. It is square and small, so it is a "summary" card with the picture
   beside the words rather than a banner stretched across them. And its size
   is whatever the photograph in assets/faces/ is, so no size is claimed: the
   two tags are hints, and a wrong hint is worse than none. It is a picture
   of somebody, so it says who in og:image:alt — the name and line the card
   already carries — which is what a screen reader gets where the picture
   does not load. The profile is the one caller that has one — see
   functions/u/[name].js. */
export function head(meta) {
  const title = esc(meta.title) + ' | Tallinn Tastebuds';
  const description = esc(meta.description);
  const url = esc(meta.url);
  const image = esc(SITE + (meta.face || meta.image || SITE_CARD));
  const card = meta.face
    ? [
        '<meta property="og:title" content="' + esc(meta.title) + '">',
        '<meta property="og:image" content="' + image + '">',
        '<meta property="og:image:alt" content="' + esc(meta.title) + '">',
        '<meta name="twitter:card" content="summary">'
      ]
    : [
        '<meta property="og:title" content="' + title + '">',
        '<meta property="og:image" content="' + image + '">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta name="twitter:card" content="summary_large_image">'
      ];

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
    '<meta property="og:description" content="' + description + '">'
  ].concat(card).join('\n');
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

/* The answer as it leaves the route: no-store, whether or not it is indexed.
   A list is edited by its owner while they are looking at it, and — because a
   private list is served only to the session that owns it — a shared copy of
   one of these responses would be a copy of somebody's page handed to the
   next person to ask for it. The directory is under the same rule for the
   smaller version of the same reason: it is seeded with rows that change as
   people keep things. The routes that do keep a copy hand this answer to
   keepInColo() below, which keeps it only where nobody was signed in and
   tells the browser something gentler; what is written here is what a
   signed-in person's own page always says.
 *
 * A crawler is not harmed by this: it fetches a page once and keeps what it
 * finds. no-store is about the caches in between.
 *
 * The security headers are not written here: functions/_middleware.js puts
 * functions/_security.js on every answer a Function gives, this one included. */
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

/* ------------------------------------------------------ KEPT IN THE COLO
 *
 * A page rendered here is put in the Cache API — caches.default, the same
 * per-colo cache /api/saves keeps its counts in — so the next visit to the
 * same address in the same colo is a cache read rather than a fetch out of
 * the deployment, a database read and a render. The map did this first, and
 * the header of functions/index.js is the long version; this is the part the
 * five routes that keep a copy cannot each have their own of.
 *
 * THREE THINGS ARE ON EVERY KEY, AND A FOURTH IS NEVER
 *
 * The page's own address, with only what the render depends on left on it:
 * the map's language and place, a list's id, the directory's search and its
 * order, a post's id. ?from= and the rest of what a shared link carries are
 * not in the render and so not in the key, and one copy answers every tracked
 * link. Then the deployment, as ?v= — deployStamp() below — so a deploy that
 * changed the page or the files it is rendered from misses on its first visit
 * and the copies the old deployment left are never asked for again. And the
 * session is never on it: a page that varies by who is asking is kept only
 * where nobody is — signedIn() below is the test — because a copy of
 * somebody's own page handed to the next person to ask would be exactly the
 * thing page() above was written to prevent. A signed-in visit is answered
 * the way it always was, no-store, and never kept.
 *
 * HOW LONG, AND WHAT THE BROWSER IS TOLD
 *
 * The life of a copy is the route's to say, because it is the life of what
 * the page is rendered from. The map is rendered from files that change only
 * on a deploy, so its copy lives as long as the deployment and it says a day.
 * The lists pages and the blog are rendered from the database as well, which
 * changes without a deploy whenever somebody saves, so their copies live
 * PAGE_TTL, a minute: long enough that a crawler walking the directory and a
 * link opened by a hundred people in an hour cost one render each, short
 * enough that a list edited by its owner is what strangers see within the
 * minute. Nothing purges on a write — a purge reaches one colo, and the
 * minute is what the other colos would have had anyway — and that is a
 * boundary rather than an oversight.
 *
 * The browser is told REVALIDATE for the map, which _headers says too and
 * tools/validate.mjs holds the two to, and PRIVATELY for the pages: the same
 * revalidation, so a browser that holds the page sends If-None-Match and gets
 * a 304 off the weak ETag the copy carries, but private, so nothing between
 * the colo and the browser keeps a page that a signed-in visit gets a
 * different version of. The Cache API stores nothing told max-age=0, so the
 * copy in the colo is written `public, max-age=<ttl>` and the rule above is
 * set on the way out — the move privately() in ./api/_lib.js makes for the
 * owner's routes.
 */

/* What the browser is told about the map — the same words `_headers` gives
   the static file at / and /index.html, which tools/validate.mjs holds the two
   to — and about the pages, whose rule is in no `_headers` line because no
   static file answers at their addresses. */
export const REVALIDATE = 'public, max-age=0, must-revalidate';
export const PRIVATELY = 'private, max-age=0, must-revalidate';

/* How long a colo keeps a page rendered from the database, in seconds — see
   HOW LONG above. */
export const PAGE_TTL = 60;

/* One short string per list of files that changes when and only when a
   deployment changed one of them. Read once per isolate and held for its
   life: an isolate belongs to one deployment and the files cannot change
   under it. The promise rather than the value, so two visits arriving on a
   cold isolate together read the files once between them, and dropped on
   failure so the next visit asks again rather than inheriting a broken
   stamp. Throws the way dataFile() throws, and the routes catch it in the
   same place they catch that.

   Pages hands a Function no deployment id at runtime that the docs will
   stand behind — the CF_PAGES_* variables are documented for the build —
   but `wrangler pages dev` hands them to a Function as bindings, so the
   commit is folded in when it is there. Either way the asset server's own
   ETag on each file, a hash of its bytes, is what carries the stamp; a file
   served without one is hashed here instead, so the stamp does not depend
   on a header one host might not send. */
const stamps = new Map();

export function deployStamp(context, files) {
  const name = files.join(' ');
  if (!stamps.has(name)) {
    stamps.set(name, readStamp(context, files).catch((e) => { stamps.delete(name); throw e; }));
  }
  return stamps.get(name);
}

async function readStamp(context, files) {
  const marks = await Promise.all(files.map(async (path) => {
    const url = new URL(path, context.request.url);
    const res = context.env.ASSETS
      ? await context.env.ASSETS.fetch(new Request(url.toString()))
      : await fetch(url.toString());
    if (!res.ok) throw new Error(path + ' unreadable: ' + res.status);
    /* The body is read either way, so the subrequest is not left open. */
    const tag = res.headers.get('etag');
    const body = await res.arrayBuffer();
    return tag || hex(await crypto.subtle.digest('SHA-1', body));
  }));
  const commit = (context.env && context.env.CF_PAGES_COMMIT_SHA) || '';
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(commit + ' ' + marks.join(' ')));
  return hex(digest).slice(0, 16);
}

/* Whether this visit carries a session at all — the cookie, not whether it
   names a live one, which is a database read the routes make for themselves.
   A dead cookie counts as signed in here, which costs that visit the cache
   and nothing else. */
export function signedIn(request) {
  return sessionTokens(request).length > 0;
}

/* Where a page is kept: its own address with the deployment on it as ?v=,
   the same spelling tools/stamp.mjs gives a script. The query is only a key —
   nothing is ever served at it. */
export function coloKey(address, stamp) {
  const url = new URL(address);
  url.searchParams.set('v', stamp);
  return new Request(url.toString());
}

/* The copy this colo holds under the key, ready for the browser, or null. */
export async function fromColo(request, key, rule) {
  const hit = await caches.default.match(key);
  return hit ? toBrowser(request, hit, rule) : null;
}

/* The route's answer, kept in the colo for ttl seconds — a 200 only; a page
   the route could not make is not a page to keep — and handed to the browser.
   The ETag is a hash of the answer, made once here rather than once per
   visit, and a Last-Modified off a static file goes rather than being
   rewritten: nothing here knows when the data changed, and a date that is
   not known is not claimed. */
export async function keepInColo(context, key, res, ttl, rule) {
  const html = await res.text();
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  headers.delete('last-modified');
  headers.set('etag', await weakTag(html));
  headers.set('cache-control', 'public, max-age=' + ttl);
  const kept = new Response(html, { status: res.status, headers });
  if (res.ok) context.waitUntil(caches.default.put(key, kept.clone()));
  return toBrowser(context.request, kept, rule);
}

/* The copy, told the browser's rule rather than the colo's — or a 304 when
   the browser already holds it. */
function toBrowser(request, kept, rule) {
  const out = new Response(kept.body, kept);
  out.headers.set('cache-control', rule);
  return withNotModified(request, out);
}
