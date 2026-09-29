#!/usr/bin/env node
/**
 * Tallinn Tastebuds — who uses the site, drawn as BPMN.
 *
 * One diagram for each kind of person this site answers: a visitor who has
 * not signed in, a member who has, the waiter and the counter a discount is
 * shown to, the friends in a splitwise group, and the owner. Each is a pool
 * with three lanes — the person, the page in their browser, the Function and
 * the database behind it — and every step names the file or the route that
 * does it, so the picture is also an index into the code.
 *
 *   data/flows.json    the source, written by hand. A person, a lane per
 *                      actor, a step per thing they can do, an arrow per
 *                      "and then". Short on purpose: it is the file a session
 *                      reads to learn what a kind of user can do, and the file
 *                      it edits when that changes. A step may also say `when`
 *                      it is counted — the signals functions/api/_flows.js
 *                      matches a page's presses against — and `handover`,
 *                      that it begins on somebody else's device; problems()
 *                      below holds both to their shape, and the validator
 *                      holds the signals to the pages and presses that exist.
 *
 *   flows/<id>.bpmn    GENERATED — by this file. Standard BPMN 2.0 XML with the
 *                      diagram interchange (the coordinates) laid out here, so
 *                      it opens as it is in bpmn.io, Camunda Modeler or any
 *                      other BPMN tool, and /admin/flows draws it.
 *
 *   node tools/flows.mjs           rewrite flows/
 *   node tools/flows.mjs --check   report that it is out of date, exit 1
 *
 * Zero dependencies, like every other tool in here.
 *
 * WHY A SOURCE AND A GENERATED FILE, AND NOT THE .bpmn BY HAND
 *
 * A .bpmn file is two documents in one: the process — what follows what — and
 * the drawing, every box's x and y and every arrow's corners. The first is
 * the part anybody wants to change and the second is the part that makes a
 * change expensive: one step added in the middle of a journey moves every box
 * after it. Written by hand, the drawing is either never updated or updated
 * badly. So the drawing is computed here from the process and nobody edits
 * it, the same way the stamps are computed and nobody types a hash.
 *
 * The cost is that an edit made in a BPMN modeler and saved back over
 * flows/<id>.bpmn is overwritten the next time this runs. A change goes in
 * data/flows.json; the modeler is for looking and for showing people.
 *
 * THE LAYOUT
 *
 * Columns are steps along the journey, lanes are who does the step. A step's
 * column is the longest way to it from a start event, not counting arrows
 * that go back — "try again" is an arrow to an earlier column, not a reason
 * to push the whole journey right. Rows come from tracks, which layout()
 * explains: a straight run of steps stays on one line, and a branch off a
 * gateway gets a line of its own directly under the one it left. Arrows are
 * drawn square: out of the right side, turn once just past the source, into
 * the left side of the target — and one going back passes under both ends.
 *
 * It is not a layout engine and does not try to be. Nothing here minimises
 * crossings, and a journey with a dozen branches out of one gateway draws a
 * dozen rows. If a diagram reads badly, the fix is almost always to split the
 * journey, which is also what makes it easier to read as a process.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = 'data/flows.json';
const OUT = 'flows';

/* What a step's `type` becomes in BPMN, and the size it is drawn at. The
   names in data/flows.json are the short ones on purpose: "user" rather than
   "userTask" is what somebody writing a journey reaches for. */
const TYPES = {
  start:   { tag: 'startEvent',   w: 36,  h: 36 },
  end:     { tag: 'endEvent',     w: 36,  h: 36 },
  timer:   { tag: 'intermediateCatchEvent', w: 36, h: 36, def: 'timerEventDefinition' },
  user:    { tag: 'userTask',     w: 120, h: 70 },
  manual:  { tag: 'manualTask',   w: 120, h: 70 },
  service: { tag: 'serviceTask',  w: 120, h: 70 },
  task:    { tag: 'task',         w: 120, h: 70 },
  gateway: { tag: 'exclusiveGateway', w: 50, h: 50 },
  parallel:{ tag: 'parallelGateway',  w: 50, h: 50 }
};

const ID = /^[a-z][a-z0-9-]*$/;

/* A signal a step is counted by: a page opened, what a page counts as a view,
   or a press by the name assets/track.js reports it under, on one page only
   where it carries @<page>. Which pages and which names exist is the
   validator's question — the same file cannot be read from here without
   importing a Function — so this is the shape alone. */
export const SIGNAL = /^(?:(?:page|view):[a-z]+|[a-z][a-z0-9_]*(?:@[a-z]+)?)$/;

/* The grid. A column is wide enough that the gap after a task still holds a
   two-word label on the arrow out of a gateway, and a row is a task plus
   room for that label above the arrow into it. */
const POOL_HEAD = 30;
const LANE_HEAD = 30;
const COL = 190;
const ROW = 110;
const PAD = 20;

/* ----------------------------------------------------------------- reading */

export function load() {
  return JSON.parse(readFileSync(join(ROOT, SRC), 'utf8'));
}

/* Everything that would make a diagram wrong rather than ugly, as a list of
   sentences. The validator prints them; build() refuses to lay out a journey
   that has any. A `ref` is checked against the repository, because the whole
   use of one is to be followed: a step pointing at a file that was renamed
   is an index entry to nowhere. */
export function problems(doc) {
  const out = [];
  if (!doc || !Array.isArray(doc.flows)) return [`${SRC}: needs a "flows" array`];
  const seen = new Set();
  for (const f of doc.flows) {
    const at = `${SRC} → ${f && f.id}`;
    if (!f || !ID.test(f.id || '')) { out.push(`${SRC}: a flow id must be a lowercase slug, got ${JSON.stringify(f && f.id)}`); continue; }
    if (seen.has(f.id)) out.push(`${at}: duplicate flow id`);
    seen.add(f.id);
    if (!f.name) out.push(`${at}: no name`);
    const lanes = new Set();
    for (const l of f.lanes || []) {
      if (!ID.test(l.id || '')) out.push(`${at}: lane id ${JSON.stringify(l.id)} is not a slug`);
      if (lanes.has(l.id)) out.push(`${at}: duplicate lane ${l.id}`);
      lanes.add(l.id);
    }
    if (!lanes.size) out.push(`${at}: no lanes`);
    const nodes = new Map();
    /* A signal names one step per flow: two steps counted by the same press
       would each take every one of them, and the arrows between the two
       would count nothing. */
    const signals = new Map();
    for (const n of f.nodes || []) {
      if (!ID.test(n.id || '')) { out.push(`${at}: step id ${JSON.stringify(n.id)} is not a slug`); continue; }
      if (nodes.has(n.id)) out.push(`${at}: duplicate step ${n.id}`);
      nodes.set(n.id, n);
      if (!TYPES[n.type]) out.push(`${at} → ${n.id}: type ${JSON.stringify(n.type)} is not one of ${Object.keys(TYPES).join(', ')}`);
      if (!lanes.has(n.lane)) out.push(`${at} → ${n.id}: lane ${JSON.stringify(n.lane)} is not one of this flow's lanes`);
      if (!n.name) out.push(`${at} → ${n.id}: no name`);
      for (const r of n.ref || []) {
        const path = String(r).split(' ')[0];
        if (!existsSync(join(ROOT, path))) out.push(`${at} → ${n.id}: ref ${path} is not in the repository`);
      }
      if (n.when !== undefined) {
        if (!Array.isArray(n.when) || !n.when.length || !n.when.every((w) => typeof w === 'string')) {
          out.push(`${at} → ${n.id}: when must be a list of signals`);
        } else {
          if (/gateway|parallel/.test(n.type)) out.push(`${at} → ${n.id}: a gateway is a question, not a thing that happens — it cannot carry when`);
          for (const w of n.when) {
            if (!SIGNAL.test(w)) out.push(`${at} → ${n.id}: signal ${JSON.stringify(w)} is not page:<id>, view:<id> or a press name, optionally @<page>`);
            else if (signals.has(w)) out.push(`${at} → ${n.id}: signal ${w} already counts ${signals.get(w)}`);
            signals.set(w, n.id);
          }
        }
      }
      if (n.handover !== undefined && n.handover !== true) out.push(`${at} → ${n.id}: handover is true or absent`);
    }
    if (![...nodes.values()].some((n) => n.type === 'start')) out.push(`${at}: no start event`);
    const into = new Set();
    const outOf = new Set();
    for (const e of f.edges || []) {
      if (!Array.isArray(e) || e.length < 2) { out.push(`${at}: an edge is [from, to] or [from, to, label], got ${JSON.stringify(e)}`); continue; }
      for (const end of [e[0], e[1]]) if (!nodes.has(end)) out.push(`${at}: edge ${e[0]} → ${e[1]} names a step that does not exist: ${end}`);
      outOf.add(e[0]);
      into.add(e[1]);
    }
    for (const n of nodes.values()) {
      if (n.type !== 'start' && !into.has(n.id)) out.push(`${at} → ${n.id}: nothing leads to it`);
      if (n.type !== 'end' && !outOf.has(n.id)) out.push(`${at} → ${n.id}: leads nowhere — end it with an end event`);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ layout */

/* The column of every step: the longest path to it from a start, with the
   arrows that go back left out. Back arrows are found the usual way, as the
   ones that reach a step still on the depth-first stack. */
function columns(f) {
  const next = new Map(f.nodes.map((n) => [n.id, []]));
  for (const [a, b] of f.edges) next.get(a).push(b);

  const back = new Set();
  const state = new Map();
  const visit = (id) => {
    state.set(id, 1);
    for (const to of next.get(id)) {
      if (state.get(to) === 1) back.add(`${id}>${to}`);
      else if (!state.has(to)) visit(to);
    }
    state.set(id, 2);
  };
  for (const n of f.nodes) if (n.type === 'start') visit(n.id);
  for (const n of f.nodes) if (!state.has(n.id)) visit(n.id);

  const col = new Map(f.nodes.map((n) => [n.id, 0]));
  /* Relax until nothing moves. A diagram is a few dozen steps, so the plain
     way is quick enough and cannot get the order wrong. */
  for (let pass = 0, moved = true; moved && pass <= f.nodes.length; pass++) {
    moved = false;
    for (const [a, b] of f.edges) {
      if (back.has(`${a}>${b}`)) continue;
      if (col.get(b) < col.get(a) + 1) { col.set(b, col.get(a) + 1); moved = true; }
    }
  }
  return { col, back };
}

function layout(f) {
  const { col, back } = columns(f);
  const order = new Map(f.nodes.map((n, i) => [n.id, i]));
  const prev = new Map(f.nodes.map((n) => [n.id, null]));
  for (const [a, b] of f.edges) if (!back.has(`${a}>${b}`) && prev.get(b) === null) prev.set(b, a);

  /* Rows come from tracks. A track is one line of a journey: a start opens
     one, the first arrow out of a step carries it on, and every other arrow
     out of a gateway opens a new one. A step keeps its track in whichever
     lane it lands, and each lane gives a row to every track that passes
     through it, in track order — so a branch that goes from the person down
     to the site and back is the same height in both lanes every time, rather
     than taking whatever row happened to be free in each. */
  const firstOut = new Map();
  for (const [a, b] of f.edges) if (!back.has(`${a}>${b}`) && !firstOut.has(a)) firstOut.set(a, b);
  const track = new Map();
  const taken = new Set();
  let tracks = 0;
  let opened = 0;
  const sorted = [...f.nodes].sort((a, b) => col.get(a.id) - col.get(b.id) || order.get(a.id) - order.get(b.id));
  for (const n of sorted) {
    const p = prev.get(n.id);
    let tr = p !== null && firstOut.get(p) === n.id ? track.get(p) : undefined;
    if (tr === undefined || taken.has(`${n.lane}|${col.get(n.id)}|${tr}`)) {
      /* A new track opens under the one it branched from, not at the bottom
         of the drawing: the branches out of a gateway sit together. */
      tr = p !== null && track.has(p) ? track.get(p) + 0.001 * ++opened : tracks++;
    }
    taken.add(`${n.lane}|${col.get(n.id)}|${tr}`);
    track.set(n.id, tr);
  }
  const cols = Math.max(...f.nodes.map((n) => col.get(n.id))) + 1;
  const width = POOL_HEAD + LANE_HEAD + cols * COL + PAD;

  const row = new Map();
  const lanes = [];
  let y = 0;
  for (const l of f.lanes) {
    const mine = [...new Set(f.nodes.filter((n) => n.lane === l.id).map((n) => track.get(n.id)))].sort((a, b) => a - b);
    for (const n of f.nodes) if (n.lane === l.id) row.set(n.id, mine.indexOf(track.get(n.id)));
    const h = Math.max(1, mine.length) * ROW;
    lanes.push({ id: l.id, name: l.name, x: POOL_HEAD, y, w: width - POOL_HEAD, h });
    y += h;
  }
  const laneAt = new Map(lanes.map((l) => [l.id, l]));

  const box = new Map();
  for (const n of f.nodes) {
    const t = TYPES[n.type];
    const cx = POOL_HEAD + LANE_HEAD + col.get(n.id) * COL + COL / 2;
    const cy = laneAt.get(n.lane).y + row.get(n.id) * ROW + ROW / 2 + 8;
    box.set(n.id, { x: cx - t.w / 2, y: cy - t.h / 2, w: t.w, h: t.h, cx, cy });
  }

  const joins = new Map();
  for (const [, b, label] of f.edges) if (label) joins.set(b, (joins.get(b) || 0) + 1);

  const edges = f.edges.map(([a, b, label], i) => {
    const s = box.get(a);
    const t = box.get(b);
    let points;
    let turn = null;
    if (back.has(`${a}>${b}`) || col.get(b) <= col.get(a)) {
      const low = Math.max(s.y + s.h, t.y + t.h) + 16;
      points = [[s.cx, s.y + s.h], [s.cx, low], [t.cx, low], [t.cx, t.y + t.h]];
    } else if (s.cy === t.cy) {
      points = [[s.x + s.w, s.cy], [t.x, t.cy]];
    } else {
      turn = s.x + s.w + 16;
      points = [[s.x + s.w, s.cy], [turn, s.cy], [turn, t.cy], [t.x, t.cy]];
    }
    /* The label sits over the last straight run into the target, which is
       the one run a gateway's branches do not share. Where two labelled
       arrows join into the same step that run is shared instead, so the
       label goes beside the turn, just under its own source. */
    let lab = null;
    if (label) {
      const [p, q] = points.slice(-2);
      if (joins.get(b) > 1 && turn !== null) {
        lab = { x: turn + 4, y: s.cy + 4, w: 70, h: 28 };
      } else {
        const x1 = Math.min(p[0], q[0]);
        const w = Math.max(60, Math.abs(q[0] - p[0]) - 8);
        lab = { x: x1 + 4, y: Math.min(p[1], q[1]) - 30, w, h: 28 };
      }
    }
    return { id: `${f.id}-e${i + 1}`, a, b, label: label || '', points, lab };
  });

  return { width, height: y, lanes, box, edges };
}

/* ------------------------------------------------------------------ writing */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n0 = (v) => Math.round(v);
const bounds = (b) => `<dc:Bounds x="${n0(b.x)}" y="${n0(b.y)}" width="${n0(b.w)}" height="${n0(b.h)}" />`;

/* A step's documentation is its note, then what it is counted by, then its
   references one to a line, each marked "when:" or "ref:" so a reader — a
   person in a modeler or a session with the file open — can tell the signal
   and the pointer into the code from the prose. A hand-over says so in the
   same way, so a modeler shows why the arrow into it carries no number. */
function documentation(n) {
  const lines = [];
  if (n.note) lines.push(n.note);
  if (n.handover) lines.push('handover: begins on somebody else\'s device');
  for (const w of n.when || []) lines.push(`when: ${w}`);
  for (const r of n.ref || []) lines.push(`ref: ${r}`);
  return lines.length ? `\n      <bpmn:documentation>${esc(lines.join('\n'))}</bpmn:documentation>` : '';
}

function render(f) {
  const L = layout(f);
  const proc = `${f.id}-process`;
  const pool = `${f.id}-pool`;
  const lines = [];
  const p = (s) => lines.push(s);

  p('<?xml version="1.0" encoding="UTF-8"?>');
  p(`<!-- GENERATED by tools/flows.mjs from data/flows.json. Edit that file and run
     \`node tools/flows.mjs\`; anything changed here is overwritten. -->`);
  p('<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI"');
  p(`  id="${f.id}-definitions" targetNamespace="https://tallinntastebuds.ee/flows" exporter="tools/flows.mjs" exporterVersion="1">`);
  p(`  <bpmn:collaboration id="${f.id}-collaboration">`);
  p(`    <bpmn:participant id="${pool}" name="${esc(f.name)}" processRef="${proc}" />`);
  p('  </bpmn:collaboration>');
  p(`  <bpmn:process id="${proc}" name="${esc(f.name)}" isExecutable="false">`);
  if (f.who) p(`    <bpmn:documentation>${esc(f.who)}</bpmn:documentation>`);
  p(`    <bpmn:laneSet id="${f.id}-lanes">`);
  for (const l of f.lanes) {
    p(`      <bpmn:lane id="${f.id}-lane-${l.id}" name="${esc(l.name)}">`);
    for (const n of f.nodes) if (n.lane === l.id) p(`        <bpmn:flowNodeRef>${n.id}</bpmn:flowNodeRef>`);
    p('      </bpmn:lane>');
  }
  p('    </bpmn:laneSet>');
  for (const n of f.nodes) {
    const t = TYPES[n.type];
    const ins = L.edges.filter((e) => e.b === n.id).map((e) => `\n      <bpmn:incoming>${e.id}</bpmn:incoming>`).join('');
    const outs = L.edges.filter((e) => e.a === n.id).map((e) => `\n      <bpmn:outgoing>${e.id}</bpmn:outgoing>`).join('');
    const def = t.def ? `\n      <bpmn:${t.def} id="${n.id}-def" />` : '';
    p(`    <bpmn:${t.tag} id="${n.id}" name="${esc(n.name)}">${documentation(n)}${ins}${outs}${def}\n    </bpmn:${t.tag}>`);
  }
  for (const e of L.edges) {
    p(`    <bpmn:sequenceFlow id="${e.id}"${e.label ? ` name="${esc(e.label)}"` : ''} sourceRef="${e.a}" targetRef="${e.b}" />`);
  }
  p('  </bpmn:process>');

  p(`  <bpmndi:BPMNDiagram id="${f.id}-diagram">`);
  p(`    <bpmndi:BPMNPlane id="${f.id}-plane" bpmnElement="${f.id}-collaboration">`);
  p(`      <bpmndi:BPMNShape id="${pool}-di" bpmnElement="${pool}" isHorizontal="true">`);
  p(`        ${bounds({ x: 0, y: 0, w: L.width, h: L.height })}`);
  p('      </bpmndi:BPMNShape>');
  for (const l of L.lanes) {
    p(`      <bpmndi:BPMNShape id="${f.id}-lane-${l.id}-di" bpmnElement="${f.id}-lane-${l.id}" isHorizontal="true">`);
    p(`        ${bounds(l)}`);
    p('      </bpmndi:BPMNShape>');
  }
  for (const n of f.nodes) {
    const b = L.box.get(n.id);
    p(`      <bpmndi:BPMNShape id="${n.id}-di" bpmnElement="${n.id}">`);
    p(`        ${bounds(b)}`);
    /* An event or a gateway carries its name under it rather than inside. */
    if (TYPES[n.type].w < 100) {
      p(`        <bpmndi:BPMNLabel>${bounds({ x: b.cx - 55, y: b.y + b.h + 4, w: 110, h: 28 })}</bpmndi:BPMNLabel>`);
    }
    p('      </bpmndi:BPMNShape>');
  }
  for (const e of L.edges) {
    p(`      <bpmndi:BPMNEdge id="${e.id}-di" bpmnElement="${e.id}">`);
    for (const [x, y] of e.points) p(`        <di:waypoint x="${n0(x)}" y="${n0(y)}" />`);
    if (e.lab) p(`        <bpmndi:BPMNLabel>${bounds(e.lab)}</bpmndi:BPMNLabel>`);
    p('      </bpmndi:BPMNEdge>');
  }
  p('    </bpmndi:BPMNPlane>');
  p('  </bpmndi:BPMNDiagram>');
  p('</bpmn:definitions>');
  return lines.join('\n') + '\n';
}

/* Every file flows/ should hold, by name. */
export function build(doc = load()) {
  const found = problems(doc);
  if (found.length) throw new Error(found[0]);
  const files = new Map();
  for (const f of doc.flows) files.set(`${f.id}.bpmn`, render(f));
  return files;
}

/* For tools/validate.mjs: the files that are missing, differ, or should not
   be there. A source that does not build counts as stale, and the validator
   prints problems() separately so the line it fails on says why. */
export function stale() {
  let want;
  try { want = build(); } catch (e) { return [SRC]; }
  const dir = join(ROOT, OUT);
  const have = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.bpmn')) : [];
  const out = [];
  for (const [name, text] of want) {
    const path = join(dir, name);
    if (!existsSync(path) || readFileSync(path, 'utf8') !== text) out.push(`${OUT}/${name}`);
  }
  for (const name of have) if (!want.has(name)) out.push(`${OUT}/${name}`);
  return out;
}

function main() {
  const doc = load();
  const found = problems(doc);
  if (found.length) {
    for (const line of found) console.error(line);
    process.exit(1);
  }
  if (process.argv.includes('--check')) {
    const off = stale();
    if (!off.length) { console.log(`${OUT}/ is up to date — ${doc.flows.length} diagrams.`); return; }
    console.error(`${off.join(', ')} out of date. Run: node tools/flows.mjs`);
    process.exit(1);
  }
  const files = build(doc);
  const dir = join(ROOT, OUT);
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir)) if (name.endsWith('.bpmn') && !files.has(name)) unlinkSync(join(dir, name));
  for (const [name, text] of files) writeFileSync(join(dir, name), text);
  for (const f of doc.flows) console.log(`${OUT}/${f.id}.bpmn — ${f.nodes.length} steps, ${f.edges.length} arrows.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
