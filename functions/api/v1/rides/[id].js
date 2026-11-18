/**
 * Tallinn Tastebuds — one recorded ride, to the person who rode it, at its
 * v1 address.
 *
 * GET /api/v1/rides/<id>
 *
 * Exactly what GET /api/rides/<id> answers — ../../rides/[id].js, which says
 * what is in it and why only its rider may ask — at the address the apps ask
 * since they moved to /api/v1.
 *
 * WHY A FILE OF ITS OWN
 *
 * The apps' routes under /api/v1 are aliases in ../[[path]].js, one name
 * each: /api/v1/rides is ../rides.js. A ride's own page is a second segment,
 * which that table has no room for and whose handler reads `params.id`,
 * which the catch-all's `params.path` is not. So it is a file, the way
 * ./route.js is one, and Pages finds it before the catch-all. For its first
 * day the map app's ride page asked this address while nothing answered it,
 * and every ride it opened read "not one of yours".
 */

export { onRequestGet } from '../../rides/[id].js';
