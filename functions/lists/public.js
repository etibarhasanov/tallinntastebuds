/**
 * Tallinn Tastebuds — /lists/public, forwarded.
 *
 * The directory lives at /lists now. This address said "public" in a path
 * where there is nothing else a list can be: a private list is served only to
 * the session that owns it and has no place in a directory at all, so the word
 * was spending a path segment to rule out something that could never have been
 * there. /lists is everybody's lists, which is what the page holds.
 *
 * This stays because the old address was indexed. It is in sitemap.xml's
 * history, in search results, at the foot of every list read before today, and
 * in whatever anybody pasted into a message. A 301 is what tells a crawler to
 * move the page rather than to find two of it, and what keeps a link somebody
 * sent last month landing somewhere.
 *
 * The query string comes with it, so /lists/public?q=coffee is still a search.
 *
 * Its neighbour kept.js is the same file for the address before this one, and
 * points at /lists directly rather than at here: two 301s in a row is a hop a
 * crawler is allowed to stop following.
 */

export function onRequest(context) {
  const url = new URL(context.request.url);
  url.pathname = '/lists';
  return Response.redirect(url.toString(), 301);
}
