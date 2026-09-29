/**
 * Tallinn Tastebuds — /api/admin/flows, the numbers on one diagram.
 *
 *   GET ?flow=&days=   one diagram out of data/flows.json over a range of
 *                      flow_counts, walked, and five minutes of edge cache
 *                      on the pair. What /admin/flows lays on the drawing.
 *
 * The counting, the table and the walk are ../_flows.js's; its header says
 * what a step is counted by, what an arrow's number means, and where the
 * moves the diagram does not draw come from. This is the other end of the
 * same table, and it is the owner's alone: the lock in
 * functions/_middleware.js answers anybody else 403 before this file is
 * reached, as for everything under /api/admin/.
 *
 * It is ./visitors.js's shape: the colo holds each answer for five minutes,
 * keyed on the diagram and the range alone, and the browser is told
 * `private, no-store` whatever the colo's copy says. It carries no words —
 * the page already has data/ui.json and data/flows.json open to draw the
 * diagram — so the language is not in the key.
 *
 * WHAT A FAILURE LOOKS LIKE
 *
 * A diagram that does not exist is a 404. Everything else is `ready: false`
 * and no numbers, 200 — no database, the other environment's, or
 * flow_counts not applied yet — and the page says the numbers are not in
 * yet under the diagram it has already drawn.
 */

import { json, wrongDatabase, privately } from '../_lib.js';
import { SPANS } from '../_visitors.js';
import { flowById, readFlows } from '../_flows.js';

/* Five minutes in the colo, for the reason ./visitors.js holds its answer
   that long: it is what the page may be stale by, and the only thing between
   the page and D1. */
const TTL = 300;

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

  const cache = caches.default;
  const key = flowsKey(request, flow.id, span);
  const hit = await cache.match(key);
  if (hit) return privately(hit);

  const empty = { ready: false, flow: flow.id, span: span };
  if (!env.DB) return json(empty, 200);
  if (await wrongDatabase(env)) return json(empty, 200);

  const numbers = await readFlows(env, flow, span);
  if (!numbers) return json(empty, 200);

  const res = json({ ready: true, ...numbers }, 200, TTL);
  context.waitUntil(cache.put(key, res.clone()));
  return privately(res);
}

/* The route, the diagram and the range, and never the rest of the address
   — see statsKey() in ./stats.js. Twenty-four keys per colo at most. `shape`
   is the answer's own version: moved on when the answer gains a field the
   page cannot draw without, so a colo's copy from before a deploy is not
   handed to the page that came with it. */
const SHAPE = '1';

function flowsKey(request, flow, span) {
  const url = new URL('/api/admin/flows', request.url);
  url.searchParams.set('flow', flow);
  url.searchParams.set('days', String(span));
  url.searchParams.set('shape', SHAPE);
  return new Request(url.toString());
}
