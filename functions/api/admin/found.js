/**
 * Tallinn Tastebuds — /api/admin/found, how people found the site.
 *
 *   GET ?days=&lang=   one range of what ../_visitors.js counts under HOW
 *                      THEY FOUND IT, the page's words beside it, and five
 *                      minutes of edge cache on the pair. What /admin/found
 *                      draws.
 *
 * The counting is POST /api/stats handing a page's reports to
 * ../_visitors.js, and that file's HOW THEY FOUND IT says what is counted and
 * — the part worth reading first — what cannot be: the words somebody typed
 * into a search engine never reach this site, so what is here is the engine,
 * the address they landed on, the pages elsewhere that linked here, the
 * owner's own tagged links, and the words typed into the site's own search
 * fields.
 *
 * It is ./visitors.js's shape on purpose, and behind the same lock: the words
 * come back with the numbers, so the page makes one request on the way in; the
 * colo holds each answer for five minutes, keyed on the range and the
 * language alone; and the browser is told `private, no-store` whatever the
 * colo's copy says. functions/_middleware.js answers anybody but the owner
 * 403 before this file is reached.
 *
 * WHAT A FAILURE LOOKS LIKE
 *
 * `ready: false` and no numbers, 200, with the words still in the answer —
 * no database, the other environment's, or visitor_counts not applied yet.
 * The page says the numbers are not in yet.
 */

import { json, wrongDatabase, wordsFor, privately } from '../_lib.js';
import { SPANS, readFound } from '../_visitors.js';

/* Five minutes in the colo — TTL in ./visitors.js. */
const TTL = 300;

export async function onRequestGet(context) {
  const { request, env } = context;
  const params = new URL(request.url).searchParams;

  const { lang, ui } = await wordsFor(context, params.get('lang'));
  const asked = Number(params.get('days'));
  const span = SPANS.includes(asked) ? asked : 7;

  const cache = caches.default;
  const key = foundKey(request, lang, span);
  const hit = await cache.match(key);
  if (hit) return privately(hit);

  const empty = { ready: false, span: span, lang: lang, ui: ui };
  if (!env.DB) return json(empty, 200);
  if (await wrongDatabase(env)) return json(empty, 200);

  const found = await readFound(env, span);
  if (!found) return json(empty, 200);

  const res = json({ ready: true, ...found, lang: lang, ui: ui }, 200, TTL);
  context.waitUntil(cache.put(key, res.clone()));
  return privately(res);
}

/* The route, the language and the range, and never the rest of the address
   — visitorsKey() in ./visitors.js, and SHAPE the same answer's version. */
const SHAPE = '1';

function foundKey(request, lang, span) {
  const url = new URL('/api/admin/found', request.url);
  url.searchParams.set('lang', lang);
  url.searchParams.set('days', String(span));
  url.searchParams.set('shape', SHAPE);
  return new Request(url.toString());
}
