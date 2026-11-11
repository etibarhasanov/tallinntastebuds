/**
 * Tallinn Tastebuds — send the pages.dev address to the real one.
 *
 * Cloudflare hands every Pages project a free `<project>.pages.dev` hostname
 * and keeps serving it after a custom domain is attached. Two hostnames
 * serving byte-identical pages is a split: Google has to decide which of them
 * is the site, links people copy out of the address bar carry whichever one
 * they happened to land on, and the QR codes are built from
 * `window.location.origin`, so a code generated on the pages.dev copy points
 * back at the pages.dev copy for as long as the sticker is on the table.
 *
 * The canonical tag in index.html tells a crawler which host to prefer. It
 * does not move a person, and it does not touch the other pages at all. A 301
 * does both.
 *
 * Why this is a Function and not a line in `_redirects`:
 *
 *   Pages' `_redirects` file matches on path only — domain-level redirects are
 *   explicitly unsupported. A `/* https://tallinntastebuds.ee/:splat 301` rule
 *   there would match on tallinntastebuds.ee too and redirect the live site to
 *   itself, forever. And the dashboard's Redirect Rules and Bulk Redirects
 *   only apply to zones in your account; `pages.dev` is Cloudflare's zone, not
 *   yours, so there is no rule to write there either. Reading the hostname in
 *   code is what is left.
 *
 * Only the bare production hostname is redirected. Preview deployments get
 * `<branch>.tallinntastebuds.pages.dev` and `<hash>.tallinntastebuds.pages.dev`
 * on the same suffix, and those are the addresses you open to check a change
 * before it is live — bouncing them to the live site would make previews
 * useless and hide the very thing you went there to look at. They carry
 * Cloudflare's own `x-robots-tag: noindex`, so they are not an SEO problem.
 *
 * `_routes.json` keeps this off the asset paths, so photos and story videos
 * are served straight from the edge and never spend a Function invocation.
 *
 * ---------------------------------------------------------------------------
 * AND ONE MORE HOSTNAME, WHICH IS THE FLASHCARDS'
 *
 * flashcard.tallinntastebuds.ee is one more custom domain on this same Pages
 * project. There is no second project, no second database and no second build;
 * what makes it a different site is the FLASHCARDS block below, which serves
 * the flashcards page at its root, the flashcards' door for an AI assistant
 * at /mcp, and 301s every other address on it back to
 * tallinntastebuds.ee, so there is one copy of the map and one link to it.
 * Estonian on cards is not the map, and a person learning the language should
 * not have to walk through a restaurant to reach it. Everything below the
 * FLASHCARDS line is that feature's and only that feature's — see **Taking it
 * out** under **Flashcards** in README.md.
 *
 * The subdomain is where a person types the address and not where the page
 * lives. `/flashcard` answers on every host, so the page can be driven under
 * `pages dev` on a localhost where a subdomain of the live domain cannot exist
 * at all. The block below is convenience over that route, not the route
 * itself.
 *
 * A link to a deck is sent to somebody, and carries the picture of a card and
 * the language it was sent in rather than the map's — and the fifty-three
 * decks the site ships are also indexed, so a deck's head and its words are
 * what a search finds. That head is written by a route, so the root is called
 * rather than rewritten to — see the block inside onRequest() for what a
 * rewrite does instead.
 *
 * This was a rewrite for a day, when the page carried a noindex and had no
 * route to call.
 *
 * ---------------------------------------------------------------------------
 * AND ONE HOSTNAME THAT IS GONE
 *
 * splitwise.tallinntastebuds.ee was the bill-splitting page, on the same
 * terms, until it was taken out on 2026-11-09. For as long as the custom
 * domain is still attached to the Pages project, every address on it is a 301
 * to the map's root — an old group link lands somewhere rather than on a copy
 * of the map at the wrong hostname. Once the domain is removed in the
 * dashboard, the GONE block below can go with it.
 *
 * ---------------------------------------------------------------------------
 * AND EVERYTHING UNDER /admin/ AND /api/admin/, WHICH IS THE OWNER'S
 *
 * The statistics and the Google directory live at /admin/stats and
 * /admin/google, and everything they and the admin page read lives under
 * /api/admin/. Both prefixes answer only the owner — see the OWNER ONLY
 * block, and functions/api/_admin.js for who the owner is. One lock on two
 * prefixes rather than a check in every file, so a page or a route added
 * under either is locked by where it is put rather than by somebody
 * remembering to lock it. The addresses those two pages had before, /stats
 * and /google, are a 404 to everybody.
 *
 * ---------------------------------------------------------------------------
 * AND THE REPOSITORY'S OWN FILES, WHICH ARE NOT THE SITE
 *
 * There is no build, so the deployment is the repository: README.md, the
 * .claude and .github directories, db/, exports/ and tools/ are files of it.
 * The NOT THE SITE block answers them the way it answers an address that was
 * never there, and says why.
 *
 * ---------------------------------------------------------------------------
 * AND EVERY ANSWER LEAVES WITH THE SECURITY HEADERS ON IT
 *
 * Whichever branch below gave it — a page, a JSON answer, a 404, a redirect,
 * or the asset server's file passed through — onRequest() puts the headers in
 * functions/_security.js on it on the way out. This is the one place every
 * Function-routed answer passes, so it is the one place they are written;
 * `_headers` carries the same list for the files that never come here, and
 * that file says why there are two.
 */

const CANONICAL_HOST = 'tallinntastebuds.ee';
const PAGES_HOST = 'tallinntastebuds.pages.dev';

/* ----------------------------------------------------------- OWNER ONLY */
/* The two prefixes that are the owner's and nobody else's. A page under
   /admin/ is a 404 to anybody else — rather than a 403, so the address does
   not advertise that anything is behind it — and a route under /api/admin/
   is a 403 in JSON, the shape every other route here answers in. Who the
   owner is, and why it fails closed, is the header of
   functions/api/_admin.js. /admin.html itself is not under the prefix: it is
   a door with its own lock and has to open for a device that is not signed in
   yet. */
import { adminUser, ownerCookie } from './api/_admin.js';

const OWNER_PAGES = '/admin/';
const OWNER_API = '/api/admin/';

/* Where the statistics and the directory were before they moved under
   /admin/. Nothing is served there now, and a bookmark to /stats should say
   so rather than be handed whatever a static file of that name might one day
   be. */
const RETIRED = new Set(['/stats', '/stats.html', '/google', '/google.html']);

/* ---------------------------------------------------------- NOT THE SITE */
/* The build output directory is the repository root, because there is no
   build — so every file in the repository is a file of the deployment, and
   until this block every one of them was served at the live address:
   README.md, CLAUDE.md, wrangler.toml, .claude/settings.json, the workflows,
   db/schema.sql, the Google export as a CSV and as SQL, the tools. The
   repository is public on GitHub as well, so none of that told anybody
   anything new on the day it was closed. What it did mean is that a file
   committed by mistake — a `.dev.vars` with the salt in it, which went
   unignored for a day once — would have been a download on the live domain
   within the minute of the push, and that the Google export, which the
   Places terms do not let us redistribute, was one.

   So the files the repository keeps for its own sake answer what an address
   that was never there answers, the same 404.html with the same 404. Three
   kinds:

     - a path with a segment starting with a dot — .claude, .github, .git,
       .gitignore, .dev.vars — except /.well-known/, which is the one dot
       directory the web means something by;
     - the directories that are inputs to the generators and nothing a page
       reads: db/, exports/, tools/;
     - Markdown, which is documentation, and wrangler.toml, which is
       configuration.

   This is a list of what is not the site, rather than a list of what is,
   because a new page or a new data file should work the moment it is
   committed without anybody remembering to let it out. The cost is the
   other way round: a new directory of the repository's own is public until
   it joins DOCS_ONLY.

   It only reaches what `_routes.json` sends here. /assets/, /photos/,
   /stories/, /clips/ and /data/ never come through a Function, so the small
   README in each of those is still served; they are notes about the folder
   and nothing more. And a Function reading a file through env.ASSETS goes
   around this block entirely, which is why none of them needed changing.
   flows/ is not on the list: /admin/flows draws its diagrams from there. */
const DOCS_ONLY = ['/db/', '/exports/', '/tools/'];
const CONFIG_ONLY = new Set(['/wrangler.toml']);

function notTheSite(lower) {
  if (/(^|\/)\.(?!well-known(\/|$))/.test(lower)) return true;
  if (lower.endsWith('.md') || CONFIG_ONLY.has(lower)) return true;
  const dir = lower + '/';
  return DOCS_ONLY.some(function (prefix) { return dir.startsWith(prefix); });
}
/* ------------------------------------------------------ end NOT THE SITE */

/* The answer any other unknown address gets — 404.html with a 404 — so an
   address under /admin/ looks exactly like one that was never there and says
   nothing about what is behind it: the same bytes and the same headers,
   because they are the asset server's own answer for an address that is not
   there, handed back unchanged. NOWHERE is that address, and nothing in the
   deployment is to be called it. Plain text only if the deployment cannot
   be read at all, which is a broken deploy rather than a state anybody
   visits. */
const NOWHERE = '/__not-found__';

async function notFound(context) {
  try {
    const url = new URL(NOWHERE, context.request.url);
    return context.env.ASSETS
      ? await context.env.ASSETS.fetch(new Request(url.toString()))
      : await fetch(url.toString());
  } catch (e) {
    return new Response('Not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }
}
/* ------------------------------------------------------- end OWNER ONLY */

/* ------------------------------------------------------------------ GONE */
const GONE_HOSTS = ['splitwise.' + CANONICAL_HOST];
/* -------------------------------------------------------------- end GONE */

/* ------------------------------------------------------------ FLASHCARDS */
/* The page at that hostname's root is not the static file, it is the route
   that writes the deck's own words into it. Called rather than rewritten to —
   see the block inside onRequest(). */
import { onRequest as flashPage } from './flashcard.js';
/* And /mcp there is the flashcards' door for an assistant rather than the
   map's, called for the same reason. */
import { onRequest as flashDoor } from './flashcard/mcp.js';

const FLASH_HOST = 'flashcard.' + CANONICAL_HOST;

/* The two paths that mean anything on that hostname, plus /api, which is one
   prefix rather than a list because the page reads the account route as well
   as its own, and the map's other routes answering there costs nothing — none
   of them is a page anybody links to. Everything else it is asked for is a
   page of the map's and goes back to the map's own address. */
const FLASH_PAGE = '/flashcard';
const FLASH_FILE = '/flashcard.html';
const API_PREFIX = '/api/';
/* ------------------------------------------------------- end FLASHCARDS */

/* The security headers, onto whatever route() below answers. */
import { secured } from './_security.js';

export async function onRequest(context) {
  return secured(await route(context), new URL(context.request.url));
}

async function route(context) {
  const url = new URL(context.request.url);

  if (url.hostname === PAGES_HOST) {
    url.protocol = 'https:';
    url.hostname = CANONICAL_HOST;
    url.port = '';
    // 301, not 302: this is permanent, and only a permanent redirect moves
    // the indexing and the accumulated link equity across to the new host.
    // The path and query ride along, so a shared ?spot= link keeps working.
    return Response.redirect(url.toString(), 301);
  }

  /* /about was one person's page of links for a day, before every profile
     could carry one — the owner's, and it was handed out as an address — so
     it goes where that page went. 301, because the address was given to
     people; the path is the one thing here that names a username, and it
     names the one account the old page was. */
  if (url.pathname === '/about' || url.pathname === '/about.html') {
    return Response.redirect(new URL('/u/etibar', url).toString(), 301);
  }

  /* ---------------------------------------------------------- OWNER ONLY */
  /* A trailing slash is the same page to Pages, so it is the same page here.
     Decoded and lowercased for the test only, so that neither /%61dmin/stats
     nor /ADMIN/stats walks around the lock on the chance the asset server
     reads it the friendlier way; an address that will not decode is tested
     as it came. */
  let path = url.pathname;
  try { path = decodeURIComponent(path); } catch (e) { /* as it came */ }
  const bare = path.length > 1 ? path.replace(/\/+$/, '') : path;
  const lower = bare.toLowerCase();
  if (RETIRED.has(lower)) return notFound(context);
  if (notTheSite(lower)) return notFound(context);

  if (lower.startsWith(OWNER_API)) {
    if (!(await adminUser(context.request, context.env))) {
      return new Response(JSON.stringify({ error: 'owner-only' }), {
        status: 403,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store'
        }
      });
    }
    return context.next();
  }

  if (lower.startsWith(OWNER_PAGES)) {
    if (!(await adminUser(context.request, context.env))) return notFound(context);
    /* The owner's copy is nobody else's either: no-store, so no cache between
       here and the browser can hand it to the next person to ask. */
    const res = await context.next();
    const out = new Response(res.body, res);
    out.headers.set('Cache-Control', 'private, no-store');
    /* And the browser is told it is the owner's, so the analytics tags this
       page loads count nothing — THE OWNER'S BROWSER in ./api/_admin.js. */
    out.headers.append('Set-Cookie', ownerCookie(context.request));
    return out;
  }
  /* ------------------------------------------------------ end OWNER ONLY */

  /* ---------------------------------------------------------------- GONE */
  if (GONE_HOSTS.indexOf(url.hostname) !== -1) {
    return Response.redirect('https://' + CANONICAL_HOST + '/', 301);
  }
  /* ------------------------------------------------------------ end GONE */

  /* ---------------------------------------------------------- FLASHCARDS */
  if (url.hostname === FLASH_HOST) {
    /* The front door, answered where it was asked rather than redirected to,
       so the short address people were given is the address they keep — and
       called rather than rewritten to, which is what this was and what did not
       work: `context.next(new Request('/flashcard…'))` hands the rewritten
       request to the asset server and never to the route that serves
       /flashcard, so the head would arrive unswapped. Calling the route is
       what actually routes.

       It is handed this request untouched rather than one pointed at
       /flashcard. The route does not build og:url out of the address it was
       asked at — deliberately. See where() in functions/flashcard.js — a
       deck names the live domain's spelling whichever of the two hostnames
       asked for it, because both answer and only one of them should be the
       address a search engine keeps. What the request carries that this route
       does need is ?d=. */
    if (url.pathname === '/') return flashPage(context);

    /* An assistant handed this hostname as a connector means the flashcards.
       Redirected like everything else below, /mcp would land on the map's
       door — and a client that follows a 301 follows it with a GET, which
       that door answers 405. So the flashcards' own door, which lives at
       /flashcard/mcp on every host, answers here under the short name. */
    if (url.pathname === '/mcp') return flashDoor(context);

    /* Everything that is not that feature belongs to the site, at the site's
       own address. Same argument and the same 301 as the pages.dev redirect
       above: one copy of the map, one link to it. */
    if (url.pathname !== FLASH_PAGE && url.pathname !== FLASH_FILE &&
        !url.pathname.startsWith(API_PREFIX)) {
      url.protocol = 'https:';
      url.hostname = CANONICAL_HOST;
      url.port = '';
      return Response.redirect(url.toString(), 301);
    }
  }
  /* ------------------------------------------------------ end FLASHCARDS */

  return context.next();
}
