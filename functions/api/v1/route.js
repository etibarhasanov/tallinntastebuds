/**
 * Tallinn Tastebuds — the way from here to a place, version 1.
 *
 * GET /api/v1/route?from=59.4370,24.7536&to=59.4389,24.7291[&mode=foot|bike|car|bus]
 *
 * Everything /api/route answers, field for field and refusal for refusal,
 * with two things added: `"version": 1` in the body and an `API-Version: 1`
 * header on every answer, and by bike `trains` — bike to a station, the
 * train with the bike on it, bike on — which is TRAINS in ../route.js.
 *
 * WHY A VERSION
 *
 * The map app and Rattatee are installed on phones that keep the build they
 * have for months, and both read a bike route's ways and nothing else. A
 * train is not a way they can draw or say aloud, so it cannot be slipped
 * into `others` for them to offer as a ride; and the answer they read is a
 * promise in CLAUDE.md's **What the app reads**. So /api/route stays
 * exactly what they read, and what is new is asked for here, by a page or a
 * build that knows what a train is. A build that asks here and is refused —
 * an older deployment, a 404 — asks /api/route instead and offers no train,
 * which is how the map page and both apps fall back.
 *
 * Version 1 only ever gains fields. Renaming or removing one, or changing
 * what one means, is /api/v2, with this answering beside it.
 */

import { answerRoute } from '../route.js';
import { VERSION } from '../../_public.js';

export async function onRequestGet(context) {
  const res = await answerRoute(context, new URL(context.request.url).searchParams, true);
  let body;
  try { body = await res.json(); } catch (e) { body = { error: 'upstream' }; }
  const out = new Response(JSON.stringify(Object.assign({ version: VERSION }, body)), res);
  out.headers.set('API-Version', String(VERSION));
  return out;
}
