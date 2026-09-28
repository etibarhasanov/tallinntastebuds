/**
 * Tallinn Tastebuds — /api/admin/visitors, who came and what they did.
 *
 *   GET ?days=&lang=   one range of visitor_counts, the page's words beside
 *                      it, and five minutes of edge cache on the pair. What
 *                      /admin/visitors draws.
 *
 * The visits themselves are counted by POST /api/stats, which hands them to
 * ../_visitors.js; that file says what is counted, what is not, and why.
 * This is the other end of the same table, and it is the owner's alone: the
 * lock in functions/_middleware.js answers anybody else 403 before this file
 * is reached, the way it does for ./stats.js.
 *
 * It is ./stats.js's shape on purpose — the words come back with the numbers,
 * so the page makes one request on the way in; the colo holds each answer
 * for five minutes, keyed on the range and the language alone; and the
 * browser is told `private, no-store` whatever the colo's copy says.
 *
 * WHAT A FAILURE LOOKS LIKE
 *
 * `ready: false` and no numbers, 200, with the words still in the answer —
 * no database, the other environment's, or visitor_counts not applied yet.
 * The page says the numbers are not in yet.
 */

import { json, wrongDatabase, wordsFor } from '../_lib.js';
import { SPANS, readVisitors } from '../_visitors.js';

/* Five minutes in the colo, for the reason ./stats.js holds its ranking that
   long: it is what the page may be stale by, and the only thing between the
   page and D1. */
const TTL = 300;

export async function onRequestGet(context) {
  const { request, env } = context;
  const params = new URL(request.url).searchParams;

  /* The words first, because every answer carries them — see ./stats.js. */
  const { lang, ui } = await wordsFor(context, params.get('lang'));
  const asked = Number(params.get('days'));
  const span = SPANS.includes(asked) ? asked : 7;

  const cache = caches.default;
  const key = visitorsKey(request, lang, span);
  const hit = await cache.match(key);
  if (hit) return privately(hit);

  const empty = { ready: false, span: span, lang: lang, ui: ui };
  if (!env.DB) return json(empty, 200);
  if (await wrongDatabase(env)) return json(empty, 200);

  const visitors = await readVisitors(env, span, ui);
  if (!visitors) return json(empty, 200);

  const res = json({ ready: true, ...visitors, lang: lang, ui: ui }, 200, TTL);
  context.waitUntil(cache.put(key, res.clone()));
  return privately(res);
}

/* The colo's copy is public, because the Cache API stores nothing less; the
   browser's is private — the same pair ./stats.js makes. */
function privately(res) {
  const out = new Response(res.body, res);
  out.headers.set('cache-control', 'private, no-store');
  return out;
}

/* The route, the language and the range, and never the rest of the address
   — see statsKey() in ./stats.js. Forty keys per colo at most. */
function visitorsKey(request, lang, span) {
  const url = new URL('/api/admin/visitors', request.url);
  url.searchParams.set('lang', lang);
  url.searchParams.set('days', String(span));
  return new Request(url.toString());
}
