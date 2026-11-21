/**
 * Tallinn Tastebuds — /api/admin/flows, the numbers on one diagram.
 *
 *   GET ?flow=&days=&device=
 *                      one diagram out of data/flows.json over a range of
 *                      flow_counts, walked, and the UTC day of edge cache
 *                      on the three. What /admin/flows lays on the drawing.
 *                      `device` is `phone` for the phones' half and `other`
 *                      for every device's less it — BY DEVICE in
 *                      ../_flows.js.
 *
 * The counting, the table and the walk are ../_flows.js's; its header says
 * what a step is counted by, what an arrow's number means, and where the
 * moves the diagram does not draw come from. This is the other end of the
 * same table, and it is the owner's alone: the lock in
 * functions/_middleware.js answers anybody else 403 before this file is
 * reached, as for everything under /api/admin/.
 *
 * It is ./visitors.js's shape: the colo holds each answer for the UTC day,
 * keyed on the diagram, the range, the device and the day alone, and the browser is told
 * `private, no-store` whatever the colo's copy says. It carries no words —
 * the page already has its language's file out of data/lang/ and
 * data/flows.json open to draw the diagram — so the language is not in the
 * key.
 *
 * WHAT A FAILURE LOOKS LIKE
 *
 * A diagram that does not exist is a 404, and a data/flows.json that cannot
 * be read at all is a 503, `no-diagrams`. Everything else is `ready: false`
 * and no numbers, 200 — no database, the other environment's, or
 * flow_counts not applied yet — and the page says the numbers are not in
 * yet under the diagram it has already drawn.
 */

import { json, wrongDatabase, privately, OWNERS_TTL, ownersDay } from '../_lib.js';
import { SPANS, askedDevice } from '../_visitors.js';
import { flowById, readFlows } from '../_flows.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const params = new URL(request.url).searchParams;

  let flow;
  try {
    flow = await flowById(context, String(params.get('flow') || ''));
  } catch (e) {
    return json({ error: 'no-diagrams' }, 503);
  }
  if (!flow) return json({ error: 'not-found' }, 404);
  const asked = Number(params.get('days'));
  const span = SPANS.includes(asked) ? asked : 7;
  const device = askedDevice(params);

  const cache = caches.default;
  const key = flowsKey(request, flow.id, span, device);
  const hit = await cache.match(key);
  if (hit) return privately(hit);

  const empty = { ready: false, flow: flow.id, span: span, device: device };
  if (!env.DB) return json(empty, 200);
  if (await wrongDatabase(env)) return json(empty, 200);

  const numbers = await readFlows(env, flow, span, device);
  if (!numbers) return json(empty, 200);

  /* The day in the colo — ownersDay() in ../_lib.js: what the page may be
     stale by, and the only thing between the page and D1. */
  const res = json({ ready: true, asOf: new Date().toISOString(), ...numbers, device: device }, 200, OWNERS_TTL);
  context.waitUntil(cache.put(key, res.clone()));
  return privately(res);
}

/* The route, the diagram, the range and the device, and never the rest of
   the address — see statsKey() in ./stats.js — and the day, ownersDay().
   A few hundred keys per colo a day at most. `shape`
   is the answer's own version: moved on when the answer gains a field the
   page cannot draw without, so a colo's copy from before a deploy is not
   handed to the page that came with it. */
const SHAPE = '5';

function flowsKey(request, flow, span, device) {
  const url = new URL('/api/admin/flows', request.url);
  url.searchParams.set('flow', flow);
  url.searchParams.set('days', String(span));
  url.searchParams.set('device', device || 'all');
  url.searchParams.set('shape', SHAPE);
  return ownersDay(url);
}
