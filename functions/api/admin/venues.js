/**
 * Tallinn Tastebuds — /api/admin/venues, the whole Google directory at once.
 *
 *   GET   every row of google_venues the directory shows, in the shape
 *         ../venues.js answers its narrow asks in. What /admin/google draws.
 *
 * The owner's alone: every /api/admin/ address is answered by the lock in
 * functions/_middleware.js first — adminUser() in ../_admin.js, a 403 to
 * anybody else — so nothing reaches this file that is not the owner's, and it
 * does not check again. ../venues.js says why the roll is handed over whole
 * and filtered in the browser, and why it is not public any more.
 *
 * `no-store`, because the one person allowed to read it has just asked, and a
 * copy kept anywhere between here and their browser is a copy somebody else
 * could be handed. It is a few hundred kilobytes read once per open of a page
 * one person opens, which the database does not notice.
 */

import { json, wrongDatabase } from '../_lib.js';
import { venueRows } from '../venues.js';

export async function onRequestGet(context) {
  const { env } = context;

  /* Nothing to fall back on, and the page says so rather than drawing an
     empty directory that reads as a city with no restaurants in it. */
  if (!env.DB || (await wrongDatabase(env))) return json({ error: 'venues' }, 503);

  try {
    return json(await venueRows(env, null, null), 200);
  } catch (e) {
    return json({ error: 'venues' }, 503);
  }
}
