/**
 * Tallinn Tastebuds — /api/admin/visitors, who came and what they did.
 *
 *   GET ?days=&lang=&device=
 *                      one range of visitor_counts, the page's words beside
 *                      it, and the UTC day of edge cache on the three. What
 *                      /admin/visitors draws. `device` is `phone` for the
 *                      phones' half of the counts and `other` for every
 *                      device less the phones — BY DEVICE in ../_visitors.js
 *                      — and every device without; the answer says which in
 *                      `device`.
 *
 * And `looks`, the directory's two looks — the six `look` rows of
 * press_counts ./stats.js counts: for each of `a` and `b`, `given`, how many
 * people new to the site were dealt it on their first open of /lists, and
 * `opened` and `kept`, how many of them opened a list from it and kept one
 * on that day. They are since the test began rather than in the range,
 * because they are one row each and have no day; the page says so. "The
 * lists' two looks" in docs/handbook.md.
 *
 * Two more tests were here and are over: the map's two rails, under the
 * `layout` kind, until every visitor was given the short rail — "The short
 * rail" in docs/handbook.md — and the four colours a newcomer was dealt,
 * under `style`, until 2026-11-19 — "The four styles, dealt". Their rows are
 * still in press_counts and nothing reads them.
 *
 * The visits themselves are counted by POST /api/stats, which hands them to
 * ../_visitors.js; that file says what is counted, what is not, and why.
 * This is the other end of the same table, and it is the owner's alone: the
 * lock in functions/_middleware.js answers anybody else 403 before this file
 * is reached, the way it does for ./stats.js.
 *
 * It is ./stats.js's shape on purpose — the words come back with the numbers,
 * so the page makes one request on the way in; the colo holds each answer
 * for five minutes, keyed on the range, the language and the device alone;
 * and the browser is told `private, no-store` whatever the colo's copy says.
 *
 * WHAT A FAILURE LOOKS LIKE
 *
 * `ready: false` and no numbers, 200, with the words still in the answer —
 * no database, the other environment's, or visitor_counts not applied yet.
 * The page says the numbers are not in yet.
 */

import { json, wrongDatabase, wordsFor, privately, OWNERS_TTL, ownersDay } from '../_lib.js';
import { SPANS, readVisitors, askedDevice, lessPhone } from '../_visitors.js';
import { LOOK } from '../stats.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const params = new URL(request.url).searchParams;

  /* The words first, because every answer carries them — see ./stats.js. */
  const { lang, langs, ui } = await wordsFor(context, params.get('lang'));
  const asked = Number(params.get('days'));
  const span = SPANS.includes(asked) ? asked : 7;
  const device = askedDevice(params);

  const cache = caches.default;
  const key = visitorsKey(request, lang, span, device);
  const hit = await cache.match(key);
  if (hit) return privately(hit);

  const empty = { ready: false, span: span, device: device, lang: lang, ui: ui };
  if (!env.DB) return json(empty, 200);
  if (await wrongDatabase(env)) return json(empty, 200);

  const spoken = langs.map((l) => l.code);
  const [visitors, deals] = await Promise.all([readVisitors(env, span, ui, spoken, device, request.url), readDeals(env, device)]);
  if (!visitors) return json(empty, 200);

  /* The day in the colo — ownersDay() in ../_lib.js: what the page may be
     stale by, and the only thing between the page and D1. Right now is the
     one part that is not, and is ./live.js. */
  const res = json({ ready: true, asOf: new Date().toISOString(), ...visitors, ...deals, device: device, lang: lang, ui: ui }, 200, OWNERS_TTL);
  context.waitUntil(cache.put(key, res.clone()));
  return privately(res);
}

/* The directory's two looks — see the header. An id is the arm, then the
   fact after a dash where there is one: `b` is how many were given B,
   `b-opened` how many of them opened something. Nought all round where
   press_counts is not there. ../stats.js files a phone's press a second
   time under `phone.look`, so the phones read those and the others every
   device's less them — BY DEVICE in ../_visitors.js. Twelve rows. */
async function readDeals(env, device) {
  const looks = { a: { given: 0, opened: 0, kept: 0 }, b: { given: 0, opened: 0, kept: 0 } };
  try {
    const got = await env.DB
      .prepare('SELECT kind, id, n FROM press_counts WHERE kind IN (?, ?)')
      .bind(LOOK, 'phone.' + LOOK)
      .all();
    const rows = got.results || [];
    const all = rows.filter((r) => r.kind === LOOK);
    const phone = rows.filter((r) => r.kind !== LOOK);
    const read = device === 'phone' ? phone : device ? lessPhone(all, phone, (r) => r.id) : all;
    for (const r of read) {
      const [arm, fact] = r.id.split('-');
      if (looks[arm]) looks[arm][fact || 'given'] = r.n;
    }
  } catch (e) {
    /* No table yet. */
  }
  return { looks: looks };
}

/* The route, the language, the range and the device, and never the rest of
   the address — see statsKey() in ./stats.js — and the day, ownersDay().
   Thirty-two keys per colo a day for one language. `shape` is
   the answer's own version: moved on when the answer gains a field the page
   cannot draw without, so a colo's copy from before the deploy is not handed
   to the page that came with it. */
const SHAPE = '11';

function visitorsKey(request, lang, span, device) {
  const url = new URL('/api/admin/visitors', request.url);
  url.searchParams.set('lang', lang);
  url.searchParams.set('days', String(span));
  url.searchParams.set('device', device || 'all');
  url.searchParams.set('shape', SHAPE);
  return ownersDay(url);
}
