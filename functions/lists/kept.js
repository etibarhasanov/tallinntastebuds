/**
 * Tallinn Tastebuds — /lists/kept, forwarded.
 *
 * The directory lives at /lists now. This address said what the page was
 * ordered by rather than what was on it, and the page holds everything anybody
 * made public, the most kept first because an order has to be something.
 *
 * It went to /lists/public first and this line went with it, rather than to
 * /lists/public and on again from there: a chain of 301s is a hop a crawler is
 * allowed to stop following, and the address at the end of it is the one worth
 * arriving at. public.js is the same file for that second address.
 *
 * This stays because the old address was indexed. It is in sitemap.xml's
 * history, in search results, at the foot of every list read before today, and
 * in whatever anybody pasted into a message. A 301 is what tells a crawler to
 * move the page rather than to find two of it, and what keeps a link somebody
 * sent last month landing somewhere.
 *
 * The query string comes with it, so /lists/kept?q=coffee is still a search.
 */

export function onRequest(context) {
  const url = new URL(context.request.url);
  url.pathname = '/lists';
  return Response.redirect(url.toString(), 301);
}
