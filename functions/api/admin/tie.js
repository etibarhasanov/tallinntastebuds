/**
 * Tallinn Tastebuds — /api/admin/tie, a place on the map tied to its Google row.
 *
 *   POST { place: <Google key>, map: <restaurants.json id> }
 *
 *   { ok: true }                                  tied, or already tied to it
 *   { ok: false, why: 'taken', mapId }            tied to another place already
 *   { ok: false, why: 'missing' }                 no such Google row
 *   { ok: false, why: 'bad' | 'no-database' }
 *
 * Google's week, rating and phone reach a place of mine through one column,
 * google_venues.map_id: the panel on the map asks /api/venues?map=<id>, the
 * chat and /mcp read the hours by it, a refresh on open finds its row by it.
 * Until this route, the only thing that ever set it was the UPDATE lines
 * tools/googlevenues.mjs writes out of the CSV export, loaded by hand. So a
 * place added from /admin.html — picked out of Google's directory, its name,
 * address and pin copied from that very row — went live with no hours, and
 * stayed that way until the next export was loaded; and one whose row came
 * in through the find bar's Look for it on Google Maps, which no export
 * carries, stayed that way for good. Keset Linna, in November 2026, was the
 * second kind.
 *
 * So the admin page sends the row it picked here once the place's branch is
 * made, and this sets the column. Before the place has landed, deliberately:
 * a tie to an id the map does not have yet is read by nothing — every reader
 * starts from a place of mine and looks for its row, never the other way — so
 * there is nothing to show early, and waiting for the deploy would mean the
 * owner keeping the tab open for it.
 *
 * Only ever onto an empty column or the same id, the rule the generated
 * UPDATEs keep, so a tie corrected by hand is never written over: a row
 * already tied to another place answers `taken` and says which.
 *
 * The owner's alone: every /api/admin/ address is answered by the lock in
 * functions/_middleware.js first — adminUser() in ../_admin.js. A write must
 * also carry the site's own Origin, the second lock ./refreshes.js and
 * ./github/ keep, since the session cookie is SameSite=Lax.
 */

import { json, wrongDatabase } from '../_lib.js';

/* A Google place id and a restaurants.json id, by shape. Anything else is
   not looked up at all. */
const GOOGLE_KEY = /^[A-Za-z0-9_-]{10,200}$/;
const MAP_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function onRequestPost(context) {
  const { env, request } = context;

  if (request.headers.get('Origin') !== new URL(request.url).origin) return json({ error: 'origin' }, 403);
  if (!env.DB || (await wrongDatabase(env))) return json({ ok: false, why: 'no-database' }, 503);

  let body;
  try { body = await request.json(); } catch (e) { body = null; }
  const place = body && typeof body.place === 'string' ? body.place.trim() : '';
  const map = body && typeof body.map === 'string' ? body.map.trim() : '';
  if (!GOOGLE_KEY.test(place) || !MAP_ID.test(map) || map.length > 80) {
    return json({ ok: false, why: 'bad' }, 400);
  }

  const done = await env.DB
    .prepare('UPDATE google_venues SET map_id = ? WHERE place_id = ? AND (map_id IS NULL OR map_id = ?)')
    .bind(map, place, map)
    .run();
  if (done.meta && done.meta.changes) return json({ ok: true });

  const row = await env.DB
    .prepare('SELECT map_id FROM google_venues WHERE place_id = ?')
    .bind(place)
    .first();
  if (!row) return json({ ok: false, why: 'missing' }, 404);
  return json({ ok: false, why: 'taken', mapId: row.map_id }, 409);
}
