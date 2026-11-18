/**
 * Tallinn Tastebuds — the security headers every answer carries, said once.
 *
 * Two places hand out this site's answers, and each binds only on its own:
 * `_headers` on what the asset server gives — the files under /assets,
 * /photos, /stories and /data that _routes.json keeps away from the Functions
 * — and the Functions on everything else, whose Responses arrive with exactly
 * the headers they were built with. So the list below is applied by
 * functions/_middleware.js to every answer a Function gives, a page, a JSON
 * answer and a redirect alike, and the same lines stand under `/*` in
 * `_headers`. tools/validate.mjs imports SECURITY and fails the build when
 * `_headers` is missing one of them or says it differently, so the two
 * cannot drift.
 *
 * WHAT EACH ONE IS FOR — and they are the ones specification.website marks
 * required or recommended, audited against this site in September 2026.
 *
 *   nosniff            a JSON answer is JSON: no browser guesses it into a
 *                      script. The one the /api/ answers were missing.
 *   Referrer-Policy    another site is told which site sent somebody, not
 *                      which page — a list's or a profile's address stays here.
 *   HSTS               a year of HTTPS only, the two subdomains included.
 *                      Cloudflare already redirects http; this makes the
 *                      browser stop asking. Not preloaded: preloading is a
 *                      promise to a list the browsers ship, and taking it back
 *                      takes months, so it is a decision for later.
 *   frame-ancestors    no other site can put a page of this one in a frame —
 *   X-Frame-Options    the account, the editor, the staff code and the owner's
 *                      pages were all frameable. The CSP line is the standard,
 *                      the X-Frame-Options line the one older browsers read.
 *                      'self' and SAMEORIGIN rather than 'none' and DENY,
 *                      because this site does frame itself: the map opens
 *                      every page a visitor walks to in a frame over itself
 *                      — assets/shell.js, and "The map is the shell" in
 *                      docs/handbook.md — and under 'none' that frame was blank.
 *                      Same origin only, so the two subdomains cannot frame
 *                      the map and the map does not frame them; every walk
 *                      from the map is to an address on its own host. /embed
 *                      is the one page any site may frame; EMBEDS below says
 *                      why. This is a whole CSP header with one directive in
 *                      it and not a
 *                      content policy: the scripts, fonts, tiles and players
 *                      the pages load are untouched by it.
 *   COOP same-origin   a page opened from another site gets no handle on this
 *                      one's window. Nothing here opens a window it needs to
 *                      talk back to — Google's sign-in is a redirect, not a
 *                      popup — so it costs nothing.
 *   Permissions-Policy the features this site never uses are off for it and
 *                      for anything it frames. Location is the one it does use
 *                      — the locate pill — so it stays, for this site alone.
 *                      Fullscreen, autoplay, clipboard and share are left as
 *                      the browser has them, because the Instagram, TikTok
 *                      and YouTube players ask for the first three and the
 *                      share buttons use the last.
 */
export const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "frame-ancestors 'self'",
  'X-Frame-Options': 'SAMEORIGIN',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), payment=(), usb=(), serial=(), hid=(), browsing-topics=(), geolocation=(self)'
};

/* The one page another site may frame: /embed, the map made to be put on
   somebody else's page in an <iframe> — **The map on your site** in
   docs/handbook.md. It is a map and a card and nothing behind a session, so
   the clickjacking frame-ancestors guards against has nothing to press on it:
   it signs nobody in, saves nothing and writes nothing, and every link on it
   opens the site in a new tab. Set rather than added, because the asset
   server hands the file over already wearing `_headers`' `/*` lines — and
   `_headers` says the same for the static spelling, for the day a request
   reaches the file without passing through here. */
const EMBEDS = new Set(['/embed', '/embed.html']);
const EMBEDDABLE = "frame-ancestors *";

/* The routes' answers are this site's pages' to read and nobody else's: a
   page on another site cannot load one into itself as a script or an image.
   Same-site rather than same-origin, because the flashcards ask /api/ from
   their own subdomain. Not in `_headers`, which never serves an
   /api/ answer. */
const API = '/api/';
const API_ONLY = { 'Cross-Origin-Resource-Policy': 'same-site' };

/* The answer with the headers on it. A copy, because the Response a redirect
   or the asset server hands back has headers that cannot be changed; a
   header the answer already carries is left as the route wrote it. */
export function secured(res, url) {
  const out = new Response(res.body, res);
  const add = (headers) => {
    for (const [name, value] of Object.entries(headers)) {
      if (!out.headers.has(name)) out.headers.set(name, value);
    }
  };
  add(SECURITY);
  if (url.pathname.startsWith(API)) add(API_ONLY);
  if (EMBEDS.has(url.pathname)) {
    out.headers.set('Content-Security-Policy', EMBEDDABLE);
    out.headers.delete('X-Frame-Options');
  }
  return out;
}
