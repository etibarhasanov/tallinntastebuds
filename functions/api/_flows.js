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
import { pageOf } from './_visitors.js';

/* The most names one report may carry — the visitor's diagram counts eleven
   steps, so forty is every button on a page and then some — and the shape a
   name has to have, which is every name TTBTrack sends. */
const MAX_TRAIL = 40;
const NAME = /^[a-z][a-z0-9_]*$/;
const MAX_PATH = 200;

const WHO = ['out', 'in'];

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
   the page it was on can be told here. Nothing, where it cannot be. */
function earlierOf(request, sent) {
  const text = typeof sent === 'string' && sent.length <= MAX_PATH ? sent : '';
  const m = /^(page|view):(.+)$/.exec(text) || /^([a-z][a-z0-9_]*)@(.+)$/.exec(text);
  if (!m) return [];
  const page = pageOf(request, m[2]);
  return page ? candidates(m[1], page) : [];
}

/* A page put away: `trail` the names in order, `opened` whether this is the
   page's first report, `earlier` the step before — see WHAT ARRIVES. True
   when something was counted. */
export async function countFlows(context, body) {
  const { request, env } = context;
  const page = pageOf(request, body.id);
  if (!page) return false;

  const trail = (Array.isArray(body.trail) ? body.trail : [])
    .slice(0, MAX_TRAIL)
    .filter((name) => typeof name === 'string' && NAME.test(name) && name !== 'page');
  const opened = body.opened === true;
  if (!trail.length && !opened) return false;

  /* The signals in the order they happened. The step before is not counted
     again — the report that carried it did that — and on a later stretch of
     the same page it is a step this page has already taken, so a second
     name meaning the same step is not a second count. */
  const seq = [];
  const earlier = earlierOf(request, body.earlier);
  if (earlier.length) seq.push({ any: earlier, before: true, taken: !opened });
  if (opened) seq.push({ any: candidates('page', page) });
  for (const name of trail) seq.push({ any: candidates(name, page) });

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
    }
  }
  if (!facts.length) return false;

  const day = today();
  try {
    await env.DB.batch(facts.map(([flow, w, id]) => env.DB.prepare(ADD).bind(flow, day, w, id, 1)));
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
 *   who        { all, out, in }, each walked — see THE WALK:
 *     views    how many page views the diagram's start counted
 *     steps    { id: n } every step with a number: the counted ones with
 *              their zeros, and the ones the walk could reach
 *     arrows   { 'from>to': n } every arrow walked, by its two ends
 *     pairs    { 'from>to': n } every pair of counted steps taken one after
 *              the other, joined by an arrow or not
 *     moves    [{ from, to, n }] the pairs no path joins, most first
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

  const sums = { all: { steps: new Map(), pairs: new Map() } };
  for (const w of WHO) sums[w] = { steps: new Map(), pairs: new Map() };
  for (const r of rows.results || []) {
    if (!sums[r.who]) continue;
    for (const into of [sums[r.who], sums.all]) {
      const map = r.id.indexOf('>') === -1 ? into.steps : into.pairs;
      map.set(r.id, (map.get(r.id) || 0) + r.n);
    }
  }

  const out = {};
  for (const w of Object.keys(sums)) out[w] = walk(flow, sums[w]);
  return {
    flow: flow.id,
    span: span,
    from: cut,
    since: (since && since.day) || null,
    counted: (flow.nodes || []).filter((n) => n.when && n.when.length).map((n) => n.id),
    handover: (flow.nodes || []).filter((n) => n.handover).map((n) => n.id),
    who: out
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
   `add` is called with every arrow and step they pass. */
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
    if (!next) return;
    add(next.key, next.to);
    at = next.to;
  }
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
  for (const [key, n] of sums.pairs) {
    const [a, b] = key.split('>');
    if (!g.counted.has(a) || !g.counted.has(b)) continue;
    pairs[key] = n;
    const path = route(g, a, b);
    if (!path) { moves.push({ from: a, to: b, n }); continue; }
    bump(wentOn, a, n);
    for (const e of path) { bump(arrows, e.key, n); if (e.to !== b) bump(steps, e.to, n); }
  }

  for (const a of g.counted) {
    const rest = (steps.get(a) || 0) - (wentOn.get(a) || 0);
    if (rest > 0) advance(g, a, (key, to) => { bump(arrows, key, rest); bump(steps, to, rest); });
  }

  const drawn = {};
  for (const [key, n] of arrows) if (n > 0) drawn[key] = n;
  return {
    views: (g.start && steps.get(g.start)) || 0,
    steps: Object.fromEntries(steps),
    arrows: drawn,
    pairs,
    moves: moves.sort((x, y) => y.n - x.n || (x.from + x.to).localeCompare(y.from + y.to))
  };
}
