/**
 * Tallinn Tastebuds — one recorded ride, to the person who rode it, at its
 * v1 address.
 *
 * GET /api/v1/rides/<id>
 *
 * The handler in ../../rides/[id].js, which says what is in the answer and
 * why only its rider may ask. Its old address, /api/rides/<id>, answers a
 * 410 since 2026-11-21 — the MOVED block in functions/_middleware.js.
 *
 * WHY A FILE OF ITS OWN
 *
 * The apps' routes under /api/v1 are aliases in ../[[path]].js, one name
 * each: /api/v1/rides is ../rides.js. A ride's own page is a second segment,
 * which that table has no room for and whose handler reads `params.id`,
 * which the catch-all's `params.path` is not. So it is a file, and Pages
 * finds it before the catch-all. For its first day the map app's ride page
 * asked this address while nothing answered it, and every ride it opened
 * read "not one of yours".
 */

export { onRequestGet } from '../../rides/[id].js';
