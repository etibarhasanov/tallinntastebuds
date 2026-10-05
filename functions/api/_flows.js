/**
 * Tallinn Tastebuds — how people move through the diagrams on /admin/flows.
 *
 * data/flows.json draws what each kind of person can do, one BPMN diagram
 * each, and this file is what lays the numbers on them: how many page views
 * reached each step, how many walked each arrow, and which steps people took
 * one after the other that no arrow joins. It is read by the owner alone, on
 * /admin/flows, and it is the third reading of the same report — a page put
 * away, with what was pressed on it — that ./_visitors.js counts into
 * visitor_counts and ./_visits.js counts for one profile.
 *
 *   countFlows()   a page put away, with its trail — called beside
 *                  countLeave() from POST /api/stats
 *   flowById()     one diagram out of data/flows.json, or null
 *   readFlows()    one diagram over a range, walked — GET /api/admin/flows
 *
 * A PRESS BECOMES A STEP BY THE DIAGRAM'S OWN SAY-SO
 *
 * Each step in data/flows.json that the site can see somebody take carries
 * `when`: the signals that mean it. `page:map` is a page opened, by the ids
 * PAGES in ./_visitors.js already tells apart; `view:map` is what that page
 * counts as a view — a place on the map, a post on the blog, a deck on the
 * flashcards — the moment TTBTrack.view() reports one; and `save_place` is a
 * press by the name assets/track.js already reports it under. A name that
 * means something else on another page says which page it is on,
 * `account_login@split`. A gateway never carries one: it is a question, not
 * a thing that happens. A step the site cannot see — a gateway, the site's
 * own work, an end — is filled in from the diagram at read time, below.
 *
 * WHAT ARRIVES, AND WHAT IS FILED
 *
 * assets/track.js sends the trail: the names of the presses in the order
 * they first happened on the page, each once however often it was pressed,
 * with `view` standing for a view. The first report of a page says the page
 * opened, and the report also names the step before the trail's first —
 * the last name the previous stretch of the same page reported, or the last
 * name the previous page in the same tab did, which is what lets a journey
 * from the map to a list count as one journey. THE ORDER THEY CAME IN in
 * assets/track.js is the browser's half.
 *
 * Every signal is looked up in every diagram. A diagram that recognises it
 * gets the step counted once per page opened, the rule a place and a chip
 * already follow, and the pair of steps taken one after the other counted
 * once as `from>to` — whether or not an arrow joins them, because which
 * arrows there are is a fact about today's diagram, and an arrow drawn next
 * month should carry the numbers from before it existed. One press can be a
 * step in two diagrams, since the diagrams are lenses on the same gestures
 * rather than a partition of them: a sign-in on the map is the visitor's
 * last step and the discount's second.
 *
 * Each page view is filed under whether its request carried a session —
 * `in` or `out` — which the server knows and the page does not need to, so
 * the page can put a member's map against a stranger's. Nothing else about
 * the person is kept, and nothing here could tell two of them apart.
 *
 * ARRIVED VIA
 *
 * And each is filed a second time under how its tab arrived, so a diagram
 * can be drawn for the people one link brought: a weekend's campaign
 * landed on one place, and the question was what they did after it, which
 * `in` and `out` pool with everybody else. assets/track.js keeps the tab's
 * first `?from=` tag and the origin of the site that sent it, and every
 * report from that tab carries them, on whichever page — the referrer of
 * a later page is this site, so without it only the landing page could be
 * told apart. The tag wins where there is one, `tag:fb-kartul`, since it
 * is the owner's own label for a link; otherwise the source, read by
 * sourceOf() the way a visitor's is, `src:facebook` — the in-app browsers
 * by their user agent, which every page of the tab still sends. A tab
 * opened from a link on this site arrived from here and is filed under
 * nothing more, and so is a report from a page holding yesterday's script.
 *
 * Bounded the way the rest is. The sources are VIA_SOURCES, every other
 * host being `src:other`; a tag is TAG's shape and a day takes at most
 * MAX_VIA_TAGS of them across the diagrams, past which only the ones
 * already counted that day go up — one lookup per tagged report, before
 * its batch. The rows a segment adds are the same diagram-bounded rows
 * `in` and `out` hold, so a day is that many again per segment that came.
 * A read walks the MAX_VIAS segments with the most steps over the range.
 * It began on 5 October 2026: the days before have `in` and `out` alone,
 * and the weekend's Facebook campaign it was written for is not in it.
 *
 * THE WALK, WHICH IS WHERE THE ARROWS COME FROM
 *
 * A read sums the range's rows into steps and pairs and walks each pair
 * along the diagram. Two counted steps taken one after the other, with a
 * path between them through steps the site cannot see, put their number on
 * every arrow and every step of that path: somebody who opened a place and
 * then shared it walked open-place, place-card and share, so all three
 * arrows count them. A pair with no such path is a move the diagram does
 * not draw, listed for the owner to read as an arrow the diagram is
 * missing or a thing people do that it never expected.
 *
 * What a counted step's people did next is then known, and the rest of
 * them — the ones who took no counted step after it — are walked forward
 * as far as the diagram lets them be walked without guessing: along an
 * arrow that is the only way on, through the site's own steps, into an end.
 * At a gateway the walk goes on only when exactly one branch leads to an
 * end through steps the site cannot see and every other branch leads to a
 * counted step, because then not having taken those is the answer: a card
 * turned by somebody who never met the sign-in card is a member's answer
 * being kept. Where two ends sit behind one gateway, or the answer is a
 * parameter this file never sees, the walk stops and those ends carry no
 * number rather than a guess. A step that begins on somebody else's device
 * — `handover` in flows.json, the pass shown to a waiter's camera — is
 * never walked into: no one browser makes that journey.
 *
 * WHERE PEOPLE STOPPED
 *
 * A counted step's people either took another counted step after it — the
 * pairs out of it, joined by an arrow or not — or they did not, and the
 * second number is the one an arrow cannot show: they closed the tab, or
 * went quiet, or did something no diagram counts. Where the walk carries
 * them on into an end without guessing, that end is where they finished,
 * and it is not a stop; where it cannot, they are `stopped` at the step
 * they last took. Nothing is stored for it — it is the step's number less
 * its pairs out, worked out at read time — so it reaches back over every
 * day already counted. It cannot tell a tab closed from a page left open
 * with nothing more pressed, and it does not try.
 *
 * TIME AT A STEP
 *
 * The report carries `at` beside the trail, the on-screen second into the
 * stretch each name happened at, and `secs`, the stretch's length; the page
 * itself is at nought on its first report. A counted step's time is from
 * it to the next counted step of the same diagram in the same stretch, or
 * to the end of the stretch where none followed: how long somebody looked
 * at a place before sharing it, or before putting the phone down. A stretch
 * is a page on screen until it was hidden, so a tab brought back from
 * behind another app starts its clock again and its first step pairs with
 * the last one before with no time on it — the hour it sat hidden was not
 * time spent at anything. Capped at MAX_SECS, the cap ./_visitors.js puts
 * on a stretch.
 *
 * A time is filed as one of BUCKETS, `t:<step>:<i>`, in the same table: a
 * median wants the spread, and a sum would be one tab left on a desk for
 * half an hour outweighing a hundred glances. Nine rows a step at most, a
 * day and a who, bounded by the diagram rather than the traffic. A report
 * from a page holding yesterday's script carries no `at` and is counted
 * without times.
 *
 * WHAT IS BOUNDED, AND HOW
 *
 * One row per flow, day, who and id, and the ids are the diagram's own:
 * a busy day and a quiet one with the same journeys in them are the same
 * number of rows, and a day is at most the counted steps of a diagram plus
 * the pairs anybody took, under each of `in` and `out`. A trail is at most
 * MAX_TRAIL names, and a name has to be shaped like one. Per page put away
 * that is one session lookup and a handful of upserts in a batch of their
 * own, so a missing flow_counts never fails the day's visitor facts.
 *
 * WHAT A FAILURE LOOKS LIKE
 *
 * Nothing, on either side. The table arrives by hand; until it has, a count
 * answers false and /admin/flows says the numbers are not in yet.
 */

import { sessionUser, dataFile } from './_lib.js';
import { today, dayBack } from './_visits.js';
import { pageOf, stepBefore, MAX_SECS, TAG } from './_visitors.js';
import { sourceOf, siteOf } from './_visits.js';

/* The most names one report may carry — the visitor's diagram counts eleven
   steps, so forty is every button on a page and then some — and the shape a
   name has to have, which is every name TTBTrack sends. */
const MAX_TRAIL = 40;
const NAME = /^[a-z][a-z0-9_]*$/;

const WHO = ['out', 'in'];

/* How a tab arrived — ARRIVED VIA. The sources sourceOf() names that a
   segment keeps by name, every other host being `other`; the tags a day may
   take; and how many segments a read walks. */
const VIA_SOURCES = ['facebook', 'instagram', 'tiktok', 'search', 'direct'];
const MAX_VIA_TAGS = 20;
const MAX_VIAS = 12;
const VIA = /^(src|tag):/;

/* The upper edges, in seconds, of the buckets a time at a step is filed
   under — TIME AT A STEP — the last bucket being everything past the last
   edge. They ride in the answer as `buckets`, and assets/flows.js reads
   them from there to say what each count spans, so this is the one copy. */
export const BUCKETS = [5, 10, 20, 30, 60, 120, 300, 600];
const TIME = 't:';

function bucketOf(secs) {
  let i = 0;
  while (i < BUCKETS.length && secs >= BUCKETS[i]) i++;
  return i;
}

/* A second off the report, or null where it is not one. */
function second(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(MAX_SECS, Math.round(n)) : null;
}

const ADD =
  'INSERT INTO flow_counts (flow, day, who, id, n) VALUES (?1, ?2, ?3, ?4, ?5) ' +
  'ON CONFLICT(flow, day, who, id) DO UPDATE SET n = flow_counts.n + excluded.n';

/* The diagrams, through the five-minute cache every data file is read
   through. Throws the way dataFile() throws. */
async function diagrams(context) {
  const doc = await dataFile(context, '/data/flows.json');
  return (doc && Array.isArray(doc.flows)) ? doc.flows : [];
}

export async function flowById(context, id) {
  return (await diagrams(context)).find((f) => f && f.id === id) || null;
}

/* Signal → step, for one diagram. Built per call: a diagram is a few dozen
   steps and the answer is cached at the level that matters, the file. */
function signalIndex(flow) {
  const index = new Map();
  for (const n of flow.nodes || []) for (const w of n.when || []) index.set(w, n.id);
  return index;
}

/* The signals one name from a trail may be: a view is the view of the page
   it was on, and a press is its name, or its name on that page. */
function candidates(name, page) {
  if (name === 'view') return ['view:' + page];
  if (name === 'page') return ['page:' + page];
  return [name, name + '@' + page];
}

/* The step before the trail's first, as the browser sent it — see WHAT
   ARRIVES: `page:/lists`, `view:/`, or `save_place@/`, the path carried so
   the page it was on can be told. stepBefore() in ./_visitors.js reads it,
   since that file counts the same step as a move between pages. Nothing,
   where it cannot be read. */
function earlierOf(request, sent) {
  const before = stepBefore(request, sent);
  return before ? candidates(before.kind, before.page) : [];
}

/* The segment a report is filed under as well as `in` or `out` — ARRIVED
   VIA — or null: no `via` on it, or a tab that arrived from this site. */
function viaOf(request, via) {
  if (!via || typeof via !== 'object') return null;
  const tag = typeof via.tag === 'string' ? via.tag.toLowerCase() : '';
  if (tag && TAG.test(tag)) return 'tag:' + tag;
  const from = typeof via.from === 'string' ? via.from : '';
  const source = sourceOf(from, request.headers.get('user-agent'), siteOf(request));
  if (source === 'here') return null;
  return 'src:' + (VIA_SOURCES.includes(source) ? source : 'other');
}

/* Whether a tag may be filed today: it already was, or the day has room
   for one more — MAX_VIA_TAGS. A failed read files nothing under it. */
async function tagRoom(env, day, via) {
  try {
    const row = await env.DB.prepare(
      'SELECT EXISTS (SELECT 1 FROM flow_counts WHERE day = ?1 AND who = ?2) AS had, ' +
      "(SELECT COUNT(DISTINCT who) FROM flow_counts WHERE day = ?1 AND who LIKE 'tag:%') AS tags"
    ).bind(day, via).first();
    return !!row && (row.had === 1 || row.tags < MAX_VIA_TAGS);
  } catch (e) {
    return false;
  }
}

/* A page put away: `trail` the names in order, `opened` whether this is the
   page's first report, `earlier` the step before — see WHAT ARRIVES. True
   when something was counted. */
export async function countFlows(context, body) {
  const { request, env } = context;
  const page = pageOf(request, body.id);

  /* The names, each with its second where the report carried one that
     lines up with the trail — TIME AT A STEP. */
  const sent = Array.isArray(body.trail) ? body.trail.slice(0, MAX_TRAIL) : [];
  const ats = Array.isArray(body.at) && body.at.length === (Array.isArray(body.trail) ? body.trail.length : -1) ? body.at : null;
  const trail = [];
  sent.forEach((name, i) => {
    if (typeof name === 'string' && NAME.test(name) && name !== 'page') trail.push({ name, at: ats ? second(ats[i]) : null });
  });
  const opened = body.opened === true;
  if (!trail.length && !opened) return false;
  const until = ats ? second(body.secs) : null;

  /* The signals in the order they happened. The step before is not counted
     again — the report that carried it did that — and on a later stretch of
     the same page it is a step this page has already taken, so a second
     name meaning the same step is not a second count. */
  const seq = [];
  const earlier = earlierOf(request, body.earlier);
  if (earlier.length) seq.push({ any: earlier, before: true, taken: !opened });
  if (opened) seq.push({ any: candidates('page', page), at: ats ? 0 : null });
  for (const item of trail) seq.push({ any: candidates(item.name, page), at: item.at });

  let flows;
  try {
    flows = await diagrams(context);
  } catch (e) {
    return false;
  }
  const who = (await sessionUser(request, env)) ? 'in' : 'out';

  const facts = [];
  for (const flow of flows) {
    const index = signalIndex(flow);
    if (!index.size) continue;
    const seen = new Set();
    const timed = [];
    let prev = null;
    for (const item of seq) {
      const step = item.any.map((s) => index.get(s)).find(Boolean);
      if (!step) continue;
      if (item.before) {
        prev = step;
        if (item.taken) seen.add(step);
        continue;
      }
      if (seen.has(step)) continue;
      seen.add(step);
      facts.push([flow.id, who, step]);
      if (prev && prev !== step) facts.push([flow.id, who, prev + '>' + step]);
      prev = step;
      timed.push({ step, at: item.at });
    }
    /* Each step's time, to the next one or to the end of the stretch. */
    timed.forEach((x, i) => {
      const next = i + 1 < timed.length ? timed[i + 1].at : until;
      if (x.at === null || next === null || next < x.at) return;
      facts.push([flow.id, who, TIME + x.step + ':' + bucketOf(next - x.at)]);
    });
  }
  if (!facts.length) return false;

  const day = today();
  /* The same facts again under how the tab arrived — ARRIVED VIA. */
  let via = viaOf(request, body.via);
  if (via && via.indexOf('tag:') === 0 && !(await tagRoom(env, day, via))) via = null;
  const all = via ? facts.concat(facts.map(([flow, , id]) => [flow, via, id])) : facts;
  try {
    await env.DB.batch(all.map(([flow, w, id]) => env.DB.prepare(ADD).bind(flow, day, w, id, 1)));
    return true;
  } catch (e) {
    /* No table yet, or the write failed. Nobody is waiting to hear it. */
    return false;
  }
}

/* ------------------------------------------------------------- reading */

/* One diagram over `span` days, or null where there is no table yet.
 *
 *   flow       the diagram's id
 *   span       1, 7, 28 or 90
 *   from       the first day of the range
 *   since      the first day anything was counted, or null for never
 *   counted    the ids of the steps that carry `when`, in the file's order
 *   handover   the ids of the steps that begin on somebody else's device
 *   who        { all, out, in }, each walked — see THE WALK — and one more
 *              for each segment in `via`, keyed by its id:
 *     views    how many page views the diagram's start counted
 *     steps    { id: n } every step with a number: the counted ones with
 *              their zeros, and the ones the walk could reach
 *     arrows   { 'from>to': n } every arrow walked, by its two ends
 *     pairs    { 'from>to': n } every pair of counted steps taken one after
 *              the other, joined by an arrow or not
 *     moves    [{ from, to, n }] the pairs no path joins, most first
 *     stopped  { id: n } the counted steps' people who took no counted
 *              step after it and were not walked into an end — WHERE
 *              PEOPLE STOPPED
 *     times    { id: [n, …] } a counted step's times, one count per bucket
 *              of BUCKETS and one past it — TIME AT A STEP
 *   buckets    BUCKETS, so the page can say what each count spans
 *   via        [{ id, views }] the segments the range has — `src:facebook`,
 *              `tag:fb-kartul` — most views first, MAX_VIAS of them at most:
 *              ARRIVED VIA
 *
 * One read of the range's rows for this diagram; the rest is arithmetic on
 * a few dozen rows a day. */
export async function readFlows(env, flow, span) {
  const cut = dayBack(span - 1);
  let rows;
  let since;
  try {
    [rows, since] = await Promise.all([
      env.DB.prepare('SELECT who, id, n FROM flow_counts WHERE flow = ? AND day >= ?').bind(flow.id, cut).all(),
      env.DB.prepare('SELECT MIN(day) AS day FROM flow_counts').first()
    ]);
  } catch (e) {
    return null;
  }

  const fresh = () => ({ steps: new Map(), pairs: new Map(), times: new Map() });
  const sums = { all: fresh() };
  for (const w of WHO) sums[w] = fresh();
  for (const r of rows.results || []) {
    /* A segment is a second filing of facts `in` and `out` already hold,
       so it sums into itself alone — never into everybody. */
    const segment = VIA.test(r.who);
    if (segment && !sums[r.who]) sums[r.who] = fresh();
    if (!sums[r.who]) continue;
    for (const into of segment ? [sums[r.who]] : [sums[r.who], sums.all]) {
      if (r.id.indexOf(TIME) === 0) {
        const cut = r.id.lastIndexOf(':');
        const id = r.id.slice(TIME.length, cut);
        const i = Number(r.id.slice(cut + 1));
        if (!(i >= 0 && i <= BUCKETS.length)) continue;
        if (!into.times.has(id)) into.times.set(id, new Array(BUCKETS.length + 1).fill(0));
        into.times.get(id)[i] += r.n;
        continue;
      }
      const map = r.id.indexOf('>') === -1 ? into.steps : into.pairs;
      map.set(r.id, (map.get(r.id) || 0) + r.n);
    }
  }

  const out = {};
  for (const w of Object.keys(sums)) if (!VIA.test(w)) out[w] = walk(flow, sums[w]);

  /* The segments with the most steps taken, each walked like a who, and
     then put busiest first by the views their walk says they had. */
  const stepsOf = (id) => Array.from(sums[id].steps.values()).reduce((a, n) => a + n, 0);
  const via = Object.keys(sums).filter((w) => VIA.test(w))
    .sort((x, y) => stepsOf(y) - stepsOf(x) || x.localeCompare(y))
    .slice(0, MAX_VIAS)
    .map((id) => { out[id] = walk(flow, sums[id]); return { id, views: out[id].views }; })
    .sort((x, y) => y.views - x.views || x.id.localeCompare(y.id));
  return {
    flow: flow.id,
    span: span,
    from: cut,
    since: (since && since.day) || null,
    counted: (flow.nodes || []).filter((n) => n.when && n.when.length).map((n) => n.id),
    handover: (flow.nodes || []).filter((n) => n.handover).map((n) => n.id),
    buckets: BUCKETS,
    who: out,
    via
  };
}

/* The diagram as a graph: what each step is, and the arrows out of each. */
function graph(flow) {
  const nodes = new Map((flow.nodes || []).map((n) => [n.id, n]));
  const outs = new Map((flow.nodes || []).map((n) => [n.id, []]));
  for (const [a, b] of flow.edges || []) if (outs.has(a) && nodes.has(b)) outs.get(a).push({ to: b, key: a + '>' + b });
  const counted = new Set((flow.nodes || []).filter((n) => n.when && n.when.length).map((n) => n.id));
  const handover = new Set((flow.nodes || []).filter((n) => n.handover).map((n) => n.id));
  const start = ((flow.nodes || []).find((n) => n.type === 'start') || {}).id || null;
  return { nodes, outs, counted, handover, start };
}

/* The shortest path from one counted step to another through steps the
   site cannot see, as the arrows along it, or null. A hand-over is never
   entered — see THE WALK. */
function route(g, a, b) {
  const from = new Map([[a, null]]);
  const queue = [a];
  while (queue.length) {
    const at = queue.shift();
    for (const e of g.outs.get(at) || []) {
      if (from.has(e.to)) continue;
      if (g.handover.has(e.to)) continue;
      from.set(e.to, { at, e });
      if (e.to === b) {
        const path = [];
        for (let step = from.get(b); step; step = from.get(step.at)) path.unshift(step.e);
        return path;
      }
      if (!g.counted.has(e.to)) queue.push(e.to);
    }
  }
  return null;
}

/* Whether a step leads to an end with nothing to decide on the way: it is
   an end, or one arrow leads out of it to a step the site cannot see that
   does. */
function reachesEnd(g, id, depth) {
  const n = g.nodes.get(id);
  if (!n || g.counted.has(id) || g.handover.has(id)) return false;
  if (n.type === 'end') return true;
  const outs = g.outs.get(id) || [];
  return outs.length === 1 && depth < 50 && reachesEnd(g, outs[0].to, depth + 1);
}

/* The people who reached `id` and took no counted step after it, walked
   forward as far as the diagram lets them be without guessing — THE WALK.
   `add` is called with every arrow and step they pass, and the step they
   were walked to is the answer: an end where they finished. */
function advance(g, id, add) {
  let at = id;
  for (let hops = 0; hops < 50; hops++) {
    const outs = g.outs.get(at) || [];
    let next = null;
    if (outs.length === 1) {
      const e = outs[0];
      if (!g.counted.has(e.to) && !g.handover.has(e.to)) next = e;
    } else if (outs.length > 1) {
      const ends = outs.filter((e) => reachesEnd(g, e.to, 0));
      const rest = outs.filter((e) => !reachesEnd(g, e.to, 0));
      if (ends.length === 1 && rest.every((e) => g.counted.has(e.to) || g.handover.has(e.to))) next = ends[0];
    }
    if (!next) return at;
    add(next.key, next.to);
    at = next.to;
  }
  return at;
}

/* One who's steps and pairs, walked — THE WALK, and readFlows() for the
   shape. The zeros are the point: a counted step nobody reached, and every
   step and end the walk could have reached from one, come back as 0, so
   the page can say what is not being used rather than leave it blank. */
function walk(flow, sums) {
  const g = graph(flow);
  const steps = new Map();
  const arrows = new Map();
  const bump = (map, key, n) => map.set(key, (map.get(key) || 0) + n);

  /* What the walk could reach from anywhere, at nought, so that every
     reachable step has a number even on a quiet day. */
  for (const a of g.counted) {
    steps.set(a, 0);
    for (const b of g.counted) {
      if (a === b) continue;
      const path = route(g, a, b);
      if (path) for (const e of path) { arrows.set(e.key, 0); if (e.to !== b) steps.set(e.to, 0); }
    }
    advance(g, a, (key, to) => { arrows.set(key, 0); steps.set(to, 0); });
  }

  for (const [id, n] of sums.steps) if (g.counted.has(id)) steps.set(id, n);

  const pairs = {};
  const moves = [];
  const wentOn = new Map();
  const tookAny = new Map();
  for (const [key, n] of sums.pairs) {
    const [a, b] = key.split('>');
    if (!g.counted.has(a) || !g.counted.has(b)) continue;
    pairs[key] = n;
    bump(tookAny, a, n);
    const path = route(g, a, b);
    if (!path) { moves.push({ from: a, to: b, n }); continue; }
    bump(wentOn, a, n);
    for (const e of path) { bump(arrows, e.key, n); if (e.to !== b) bump(steps, e.to, n); }
  }

  /* The rest walked on, and the ones the walk could not carry into an end
     are where they stopped — WHERE PEOPLE STOPPED. A move the diagram does
     not draw is still a step taken, so it is not a stop. */
  const stopped = {};
  for (const a of g.counted) {
    const reached = steps.get(a) || 0;
    const rest = reached - (wentOn.get(a) || 0);
    let finished = false;
    if (rest > 0) {
      const last = advance(g, a, (key, to) => { bump(arrows, key, rest); bump(steps, to, rest); });
      finished = (g.nodes.get(last) || {}).type === 'end';
    }
    if (reached > 0) stopped[a] = finished ? 0 : Math.max(0, reached - (tookAny.get(a) || 0));
  }

  const times = {};
  for (const [id, counts] of sums.times) if (g.counted.has(id)) times[id] = counts;

  const drawn = {};
  for (const [key, n] of arrows) if (n > 0) drawn[key] = n;
  return {
    views: (g.start && steps.get(g.start)) || 0,
    steps: Object.fromEntries(steps),
    arrows: drawn,
    pairs,
    moves: moves.sort((x, y) => y.n - x.n || (x.from + x.to).localeCompare(y.from + y.to)),
    stopped,
    times
  };
}
