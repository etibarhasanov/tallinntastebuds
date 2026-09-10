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
 * AND ONE MORE HOSTNAME, WHICH IS SPLITWISE'S
 *
 * Everything below the SPLITWISE line is that feature's and only that
 * feature's: one constant, three path names and one block inside onRequest().
 * Delete the four of them and this file is exactly what it was — see **Taking
 * it out** under **Splitwise** in README.md.
 *
 * splitwise.tallinntastebuds.ee is one more custom domain on this same Pages
 * project. There is no second project, no second database and no second build;
 * what makes it a different site is the block below, which serves split.html
 * at its root and 301s every other address on it back to tallinntastebuds.ee,
 * so there is one copy of the map and one link to it.
 *
 * The subdomain is where a person types the address and not where the page
 * lives. `/split` answers on every host, including every preview under
 * *.tallinntastebuds.pages.dev where a subdomain of the live domain cannot
 * exist at all, so the feature can be looked at on a pull request the way
 * everything else here is. The rewrite below is convenience over that route,
 * not the route itself.
 */

const CANONICAL_HOST = 'tallinntastebuds.ee';
const PAGES_HOST = 'tallinntastebuds.pages.dev';

/* ------------------------------------------------------------- SPLITWISE */
const SPLIT_HOST = 'splitwise.' + CANONICAL_HOST;

/* The three paths that mean anything on that hostname. Everything else it is
   asked for is a page of the map's and goes back to the map's own address.
   /api is one prefix rather than a list because the splitwise page reads the
   account route as well as its own, and the map's other routes answering there
   costs nothing — none of them is a page anybody links to. */
const SPLIT_PAGE = '/split';
const SPLIT_FILE = '/split.html';
const API_PREFIX = '/api/';
/* --------------------------------------------------------- end SPLITWISE */

export async function onRequest(context) {
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

  /* ----------------------------------------------------------- SPLITWISE */
  if (url.hostname === SPLIT_HOST) {
    /* The front door. A rewrite rather than a redirect, so the address people
       were given — the bare subdomain — is the address they keep.

       It rewrites to /split and not to /split.html, which is the spelling the
       file actually has: Pages serves an extensionless copy of every page and
       308s the .html address to it, so rewriting to the file would hand back
       that redirect and put /split in the address bar after all, which is the
       one thing this line exists to avoid. */
    if (url.pathname === '/') {
      const to = new URL(url);
      to.pathname = SPLIT_PAGE;
      return context.next(new Request(to.toString(), context.request));
    }

    /* Everything that is not that feature belongs to the site, at the site's
       own address. Same argument as the pages.dev redirect above, and the same
       301: one copy of the map, one link to it. */
    if (url.pathname !== SPLIT_PAGE && url.pathname !== SPLIT_FILE &&
        !url.pathname.startsWith(API_PREFIX)) {
      url.protocol = 'https:';
      url.hostname = CANONICAL_HOST;
      url.port = '';
      return Response.redirect(url.toString(), 301);
    }
  }
  /* ------------------------------------------------------- end SPLITWISE */

  return context.next();
}
