/**
 * Tallinn Tastebuds — /api/admin/visitors, who came and what they did.
 *
 *   GET ?days=&lang=   one range of visitor_counts, the page's words beside
 *                      it, and five minutes of edge cache on the pair. What
 *                      /admin/visitors draws.
 *
 * And `dealt`, the four rows of press_counts ./stats.js counts the two rails'
 * strangers in: for each of `a` and `b`, `given`, how many browsers that had
 * never been here were dealt it, and `opened`, how many of them opened a
 * place on that first visit. They are since the split began rather than in
 * the range, because they are one row each and have no day; the page says
 * so. They used to be a footnote on /admin/stats, and moved here to sit with
 * everything else about the two rails.
 *
 * And `looks`, the same for the directory's two looks — the six `look` rows
 * ./stats.js counts: for each of `a` and `b`, `given`, how many people new to
 * the site were dealt it on their first open of /lists, and `opened` and
 * `kept`, how many of them opened a list from it and kept one on that day.
 * A test apart from the rails, read in the same query because it is the
 * same table. "The lists' two looks" in README.md.
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

import { json, wrongDatabase, wordsFor, privately } from '../_lib.js';
import { SPANS, readVisitors } from '../_visitors.js';
import { LAYOUT, LOOK } from '../stats.js';

/* Five minutes in the colo, for the reason ./stats.js holds its ranking that
   long: it is what the page may be stale by, and the only thing between the
   page and D1. */
const TTL = 300;

export async function onRequestGet(context) {
  const { request, env } = context;
  const params = new URL(request.url).searchParams;

  /* The words first, because every answer carries them — see ./stats.js. */
  const { lang, langs, ui } = await wordsFor(context, params.get('lang'));
  const asked = Number(params.get('days'));
  const span = SPANS.includes(asked) ? asked : 7;

  const cache = caches.default;
  const key = visitorsKey(request, lang, span);
  const hit = await cache.match(key);
  if (hit) return privately(hit);

  const empty = { ready: false, span: span, lang: lang, ui: ui };
  if (!env.DB) return json(empty, 200);
  if (await wrongDatabase(env)) return json(empty, 200);

  const spoken = langs.map((l) => l.code);
  const [visitors, deals] = await Promise.all([readVisitors(env, span, ui, spoken), readDeals(env)]);
  if (!visitors) return json(empty, 200);

  const res = json({ ready: true, ...visitors, ...deals, lang: lang, ui: ui }, 200, TTL);
  context.waitUntil(cache.put(key, res.clone()));
  return privately(res);
}

/* Both tests' rows — `dealt` the rails', `looks` the directory's — see the
   header. An id is the arm, then the fact after a dash where there is one:
   `b` is how many were given B, `b-opened` how many of them opened
   something. Nought all round where press_counts is not there. */
async function readDeals(env) {
  const arms = () => ({ a: { given: 0, opened: 0, kept: 0 }, b: { given: 0, opened: 0, kept: 0 } });
  const deals = { dealt: arms(), looks: arms() };
  try {
    const got = await env.DB
      .prepare('SELECT kind, id, n FROM press_counts WHERE kind IN (?, ?)')
      .bind(LAYOUT, LOOK)
      .all();
    for (const r of got.results || []) {
      const [arm, fact] = r.id.split('-');
      const test = r.kind === LAYOUT ? deals.dealt : deals.looks;
      if (test[arm]) test[arm][fact || 'given'] = r.n;
    }
  } catch (e) {
    /* No table yet. */
  }
  return deals;
}

/* The route, the language and the range, and never the rest of the address
   — see statsKey() in ./stats.js. Forty keys per colo at most. `shape` is
   the answer's own version: moved on when the answer gains a field the page
   cannot draw without, so a colo's copy from before the deploy is not handed
   to the page that came with it. */
const SHAPE = '5';

function visitorsKey(request, lang, span) {
  const url = new URL('/api/admin/visitors', request.url);
  url.searchParams.set('lang', lang);
  url.searchParams.set('days', String(span));
  url.searchParams.set('shape', SHAPE);
  return new Request(url.toString());
}
