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
 */

const CANONICAL_HOST = 'tallinntastebuds.ee';
const PAGES_HOST = 'tallinntastebuds.pages.dev';

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

  return context.next();
}
