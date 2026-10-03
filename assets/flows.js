/* Tallinn Tastebuds — /admin/flows, who uses the site, drawn.
 *
 * One BPMN diagram for each kind of person this site answers — a visitor, a
 * member, the waiter and the counter a discount is shown to, a splitwise
 * group, a learner on the flashcards, the owner — with a chip for each, and
 * under the diagram whatever step was last pressed: its note and the files
 * and routes that do it. See **Who uses the site, drawn** in README.md.
 *
 * AND THE NUMBERS ON IT
 *
 * Over the diagram, a range and a who — everybody, signed out, signed in —
 * and on it how many page views reached each step, how many walked each
 * arrow, and under it where a pressed step's people went next, every
 * counted step in a table, and the moves the diagram does not draw. The
 * numbers are GET /api/admin/flows, and functions/api/_flows.js is what
 * they mean; this file only draws them by id, on the shapes it has already
 * drawn. See **The numbers on it** under **Who uses the site, drawn**.
 *
 * And on every counted step two things an arrow cannot say: how many of
 * the people who reached it stopped there — a dashed pill, because they
 * are the ones no arrow carries away — and the typical time spent at it,
 * the median of the route's buckets, under it. The pressed step's card
 * spells both out, with the spread of the times as a bar.
 *
 * WHAT IT DRAWS FROM
 *
 * data/flows.json is the source and flows/<id>.bpmn is what tools/flows.mjs
 * lays out from it. This page reads the source for the chips — a name and a
 * sentence per diagram — and for which steps are counted, and the .bpmn for
 * the drawing, so what is on the screen is exactly the file the download
 * link hands over and a modeler would open. A .bpmn that does not draw here
 * does not open there either, and this is where somebody finds out.
 *
 * WHY NOT bpmn-js
 *
 * bpmn.io's viewer is the obvious way to draw a .bpmn, and it is about a
 * megabyte of somebody else's script loaded from a CDN for a page that draws
 * five kinds of shape. The diagram interchange in the file already says where
 * every box and every corner of every arrow goes; what is left is turning
 * rectangles, circles and diamonds into SVG in the site's own colours, which
 * is this file. It draws only what tools/flows.mjs writes — a task, an event,
 * a gateway, a pool and its lanes, an arrow and its label — and a .bpmn from
 * elsewhere with a data object or a sub-process in it would draw without
 * those. That is the trade: no dependency, both styles for free, and the
 * page still works in five years, against a viewer that is only as general
 * as the generator in front of it.
 *
 * Plain browser JavaScript, one IIFE, ES5, no modules and no build step, the
 * same as every other file in assets/. The tokens, the card, the chips and
 * the eyebrow come from assets/styles.css, the brand header and the column
 * from assets/lists.css, and the diagram's own look is assets/flows.css.
 */
(function () {
  'use strict';

  var SOURCE = '/data/flows.json';
  var UI_URL = '/data/ui.json';
  var NUMBERS = '/api/admin/flows';

  /* The ranges, as the route answers them — SPANS in
     functions/api/_visitors.js — and the three whos an answer carries. A
     diagram opens on the who it is about: the visitor's on the signed out,
     the member's on the signed in, the rest on everybody. */
  var SPANS = [1, 7, 28, 90];
  var WHO = ['all', 'out', 'in'];
  var WHO_LABEL = { all: 'flowsEverybody', out: 'flowsSignedOut', 'in': 'flowsSignedIn' };
  var DEFAULT_WHO = { visitor: 'out', member: 'in' };

  /* An arrow's width says what its number says — rule 10 of the design
     rules — between these two, by the square root of its share of the
     busiest arrow, so the quiet ones still read as lines. And how many of
     the steps people went on to a row names before it stops. */
  var ARROW_MIN = 1.3;
  var ARROW_MAX = 4.5;
  var NEXT_SHOWN = 4;
  var MOVES_SHOWN = 10;

  /* The spread of a step's times, in the pressed step's card, is the
     route's buckets gathered into four — under 10 s, to a minute, to five,
     and past it — since nine bars on a phone read as noise. Upper edges in
     seconds; the last group is everything past the last. */
  var TIME_GROUPS = [10, 60, 300];

  var NS = {
    bpmn: 'http://www.omg.org/spec/BPMN/20100524/MODEL',
    bpmndi: 'http://www.omg.org/spec/BPMN/20100524/DI',
    dc: 'http://www.omg.org/spec/DD/20100524/DC',
    di: 'http://www.omg.org/spec/DD/20100524/DI',
    svg: 'http://www.w3.org/2000/svg'
  };

  var STYLES = ['red', 'green'];
  var DEFAULT_STYLE = 'red';
  var STYLE_KEY = 'ttb.style';
  var LANG_KEY = 'ttb.lang';
  var DEFAULT_LANG = 'en';

  /* How far the zoom buttons move, and the floor under the first fit. A
     diagram fitted to a 390 px phone is a picture of its shape and nothing
     can be read on it, so it opens no smaller than this and scrolls. */
  var ZOOM_STEP = 1.25;
  var ZOOM_MIN = 0.2;
  var ZOOM_MAX = 2.5;
  var FIRST_ZOOM_FLOOR = 0.6;

  var state = {
    lang: DEFAULT_LANG,
    ui: {},
    flows: [],
    current: null,   // the flow on screen
    width: 0,        // its drawing's natural width, in diagram units
    zoom: 1,
    steps: {},       // id -> { name, kind, lane, doc } for the flow on screen
    picked: null,    // the <g> of the step last pressed
    drawn: null,     // the shapes and arrows on screen, by id — see draw()
    span: 7,         // the range, in days
    who: 'all',      // which of the answer's three whos is on screen
    numbers: null,   // the answer for the flow on screen, or null
    asked: 0         // how many times the numbers were asked for, so a late answer is dropped
  };

  /* --------------------------------------------------------------- helpers */

  function el(tag, props, kids) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'className') node.className = v;
        else if (k === 'textContent') node.textContent = v;
        else node.setAttribute(k, v === true ? '' : String(v));
      });
    }
    (kids || []).forEach(function (kid) {
      if (kid === null || kid === undefined || kid === false) return;
      node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    });
    return node;
  }

  function svg(tag, attrs) {
    var node = document.createElementNS(NS.svg, tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, String(attrs[k])); });
    return node;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function storeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function t(key, vars) {
    var pack = state.ui[state.lang] || {};
    var s = pack[key];
    if (s === undefined) s = (state.ui[DEFAULT_LANG] || {})[key];
    if (s === undefined) return key;
    if (vars) {
      Object.keys(vars).forEach(function (v) {
        s = s.split('{' + v + '}').join(String(vars[v]));
      });
    }
    return s;
  }

  function num(n) {
    try { return Number(n || 0).toLocaleString(state.lang); } catch (e) { return String(n || 0); }
  }

  /* A day as the table files it, YYYY-MM-DD, as a date in the reading
     language: the month's name out of ui.json rather than Intl, which draws
     April as M04 in Chromium for some locales. */
  function dateLabel(day) {
    var parts = String(day || '').split('-');
    var name = String(t('months') || '').split('|')[Number(parts[1]) - 1];
    return name ? Number(parts[2]) + ' ' + name + ' ' + parts[0] : String(day || '');
  }

  function get(url, as) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error(url + ': ' + res.status);
      return as === 'text' ? res.text() : res.json();
    });
  }

  /* ------------------------------------------------------------------- boot
   * The style and the language, applied by the page itself before anything
   * is drawn. Every page on this site carries this block; see applyStyle() in
   * assets/lists.js, which is the fullest copy.
   */
  function applyStyle() {
    var fromUrl = new URLSearchParams(window.location.search).get('style');
    var stored = storeGet(STYLE_KEY);
    var style = STYLES.indexOf(fromUrl) !== -1 ? fromUrl
              : STYLES.indexOf(stored) !== -1 ? stored
              : DEFAULT_STYLE;

    document.documentElement.setAttribute('data-style', style);
    document.documentElement.style.colorScheme = style === 'green' ? 'dark' : 'light';

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      var wash = getComputedStyle(document.documentElement).getPropertyValue('--wash').trim();
      if (wash) meta.setAttribute('content', wash);
    }
  }

  function pickLanguage(langs) {
    var fromUrl = new URLSearchParams(window.location.search).get('lang');
    if (fromUrl && langs.indexOf(fromUrl) !== -1) return fromUrl;
    var stored = storeGet(LANG_KEY);
    if (stored && langs.indexOf(stored) !== -1) return stored;
    var prefs = navigator.languages || [navigator.language || ''];
    for (var i = 0; i < prefs.length; i++) {
      var base = String(prefs[i]).toLowerCase().split('-')[0];
      if (langs.indexOf(base) !== -1) return base;
    }
    return langs.indexOf(DEFAULT_LANG) !== -1 ? DEFAULT_LANG : langs[0];
  }

  function applyStaticStrings() {
    document.documentElement.lang = state.lang;
    var each = function (attr, apply) {
      var nodes = document.querySelectorAll('[' + attr + ']');
      for (var i = 0; i < nodes.length; i++) apply(nodes[i], nodes[i].getAttribute(attr));
    };
    each('data-i18n', function (n, k) { n.textContent = t(k); });
    each('data-i18n-aria-label', function (n, k) { n.setAttribute('aria-label', t(k)); });
  }

  /* --------------------------------------------------------- reading a file */

  function box(b) {
    return {
      x: +b.getAttribute('x'), y: +b.getAttribute('y'),
      w: +b.getAttribute('width'), h: +b.getAttribute('height')
    };
  }

  /* A shape's own Bounds is a child of it, and its label's is a child of the
     BPMNLabel inside it; getElementsByTagNameNS would reach both, so each is
     looked for one level down only. */
  function childBounds(node) {
    var kids = node ? node.childNodes : [];
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].namespaceURI === NS.dc && kids[i].localName === 'Bounds') return box(kids[i]);
    }
    return null;
  }

  function labelBounds(node) {
    return childBounds(node.getElementsByTagNameNS(NS.bpmndi, 'BPMNLabel')[0]);
  }

  function parse(text) {
    var doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('not XML');

    var model = {};
    var all = doc.getElementsByTagNameNS(NS.bpmn, '*');
    for (var i = 0; i < all.length; i++) {
      var node = all[i];
      var id = node.getAttribute('id');
      if (!id) continue;
      var docNode = null;
      for (var k = 0; k < node.childNodes.length; k++) {
        var kid = node.childNodes[k];
        if (kid.namespaceURI === NS.bpmn && kid.localName === 'documentation') docNode = kid;
      }
      model[id] = {
        kind: node.localName,
        name: node.getAttribute('name') || '',
        doc: docNode ? docNode.textContent : '',
        lane: ''
      };
    }

    var lanes = doc.getElementsByTagNameNS(NS.bpmn, 'lane');
    for (var l = 0; l < lanes.length; l++) {
      var refs = lanes[l].getElementsByTagNameNS(NS.bpmn, 'flowNodeRef');
      for (var r = 0; r < refs.length; r++) {
        var step = model[refs[r].textContent.trim()];
        if (step) step.lane = lanes[l].getAttribute('name') || '';
      }
    }

    var shapes = [];
    var ss = doc.getElementsByTagNameNS(NS.bpmndi, 'BPMNShape');
    for (var s = 0; s < ss.length; s++) {
      var ref = ss[s].getAttribute('bpmnElement');
      if (!model[ref]) continue;
      shapes.push({ id: ref, el: model[ref], box: childBounds(ss[s]), label: labelBounds(ss[s]) });
    }

    /* An arrow's two ends, so the numbers — which the route keys by
       'from>to' — can find the line they belong on. */
    var ends = {};
    var sf = doc.getElementsByTagNameNS(NS.bpmn, 'sequenceFlow');
    for (var f = 0; f < sf.length; f++) {
      ends[sf[f].getAttribute('id')] = { from: sf[f].getAttribute('sourceRef'), to: sf[f].getAttribute('targetRef') };
    }

    var edges = [];
    var es = doc.getElementsByTagNameNS(NS.bpmndi, 'BPMNEdge');
    for (var e = 0; e < es.length; e++) {
      var pts = [];
      var wps = es[e].getElementsByTagNameNS(NS.di, 'waypoint');
      for (var w = 0; w < wps.length; w++) pts.push([+wps[w].getAttribute('x'), +wps[w].getAttribute('y')]);
      var id = es[e].getAttribute('bpmnElement');
      var flow = model[id] || { name: '' };
      var link = ends[id] || {};
      edges.push({ points: pts, name: flow.name, label: labelBounds(es[e]), from: link.from, to: link.to });
    }

    return { model: model, shapes: shapes, edges: edges };
  }

  /* --------------------------------------------------------------- drawing */

  /* SVG does not wrap text, so this does, by a width in characters. The
     diagram's font is set in assets/flows.css and this is its average
     advance; a word longer than the line is left long rather than broken. */
  function wrap(text, chars) {
    var words = String(text).split(/\s+/);
    var lines = [];
    var line = '';
    for (var i = 0; i < words.length; i++) {
      var next = line ? line + ' ' + words[i] : words[i];
      if (next.length > chars && line) { lines.push(line); line = words[i]; }
      else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }

  function textBlock(parent, text, cx, cy, width, cls, size) {
    var lines = wrap(text, Math.max(6, Math.floor(width / (size * 0.56))));
    var lead = size * 1.25;
    var node = svg('text', { 'class': cls, 'text-anchor': 'middle' });
    for (var i = 0; i < lines.length; i++) {
      var span = svg('tspan', { x: cx, y: cy + (i - (lines.length - 1) / 2) * lead + size * 0.35 });
      span.textContent = lines[i];
      node.appendChild(span);
    }
    parent.appendChild(node);
  }

  function sideways(parent, text, b, cls) {
    var cx = b.x + 15;
    var cy = b.y + b.h / 2;
    var node = svg('text', { 'class': cls, 'text-anchor': 'middle', transform: 'rotate(-90 ' + cx + ' ' + cy + ')', x: cx, y: cy + 4 });
    node.textContent = text;
    parent.appendChild(node);
  }

  /* The small mark in a task's corner that says who does it: a head and
     shoulders for a person, a cog for the site, a hand's flat palm for
     something done by hand with no screen in it. */
  function taskMark(g, kind, b) {
    var x = b.x + 12;
    var y = b.y + 12;
    if (kind === 'userTask') {
      g.appendChild(svg('circle', { 'class': 'flow-mark', cx: x, cy: y - 2, r: 3 }));
      g.appendChild(svg('path', { 'class': 'flow-mark', d: 'M' + (x - 6) + ' ' + (y + 7) + 'q6 -9 12 0' }));
    } else if (kind === 'serviceTask') {
      g.appendChild(svg('circle', { 'class': 'flow-mark', cx: x, cy: y, r: 5, 'stroke-dasharray': '2.2 1.6', 'stroke-width': 3 }));
      g.appendChild(svg('circle', { 'class': 'flow-mark', cx: x, cy: y, r: 1.6 }));
    } else if (kind === 'manualTask') {
      g.appendChild(svg('path', { 'class': 'flow-mark', d: 'M' + (x - 6) + ' ' + (y + 5) + 'h9a2 2 0 0 0 0 -4h-3l3 -5' }));
    }
  }

  function drawShape(layer, s) {
    var b = s.box;
    var kind = s.el.kind;
    if (!b) return;

    if (kind === 'participant') {
      layer.appendChild(svg('rect', { 'class': 'flow-pool', x: b.x, y: b.y, width: b.w, height: b.h }));
      layer.appendChild(svg('line', { 'class': 'flow-rule', x1: b.x + 30, y1: b.y, x2: b.x + 30, y2: b.y + b.h }));
      sideways(layer, s.el.name, b, 'flow-pool-name');
      return;
    }
    if (kind === 'lane') {
      layer.appendChild(svg('rect', { 'class': 'flow-lane', x: b.x, y: b.y, width: b.w, height: b.h }));
      layer.appendChild(svg('line', { 'class': 'flow-rule', x1: b.x + 30, y1: b.y, x2: b.x + 30, y2: b.y + b.h }));
      sideways(layer, s.el.name, b, 'flow-lane-name');
      return;
    }

    var g = svg('g', { 'class': 'flow-step flow-' + kind, tabindex: 0, role: 'button', 'data-step': s.id, 'aria-label': s.el.name });
    var cx = b.x + b.w / 2;
    var cy = b.y + b.h / 2;

    if (/Task$|^task$/.test(kind)) {
      g.appendChild(svg('rect', { 'class': 'flow-box', x: b.x, y: b.y, width: b.w, height: b.h, rx: 10 }));
      taskMark(g, kind, b);
      textBlock(g, s.el.name, cx, cy + 2, b.w - 14, 'flow-name', 12);
    } else if (/Gateway$/.test(kind)) {
      g.appendChild(svg('path', { 'class': 'flow-box', d: 'M' + cx + ' ' + b.y + 'L' + (b.x + b.w) + ' ' + cy + 'L' + cx + ' ' + (b.y + b.h) + 'L' + b.x + ' ' + cy + 'Z' }));
      var d = kind === 'parallelGateway'
        ? 'M' + cx + ' ' + (cy - 10) + 'v20M' + (cx - 10) + ' ' + cy + 'h20'
        : 'M' + (cx - 7) + ' ' + (cy - 7) + 'l14 14M' + (cx + 7) + ' ' + (cy - 7) + 'l-14 14';
      g.appendChild(svg('path', { 'class': 'flow-glyph', d: d }));
    } else {
      g.appendChild(svg('circle', { 'class': 'flow-box', cx: cx, cy: cy, r: b.w / 2 }));
      if (kind === 'intermediateCatchEvent') {
        g.appendChild(svg('circle', { 'class': 'flow-box', cx: cx, cy: cy, r: b.w / 2 - 4 }));
        g.appendChild(svg('path', { 'class': 'flow-glyph', d: 'M' + cx + ' ' + (cy - 8) + 'v8h6' }));
      }
    }
    if (s.label) {
      textBlock(g, s.el.name, s.label.x + s.label.w / 2, s.label.y + s.label.h / 2, s.label.w, 'flow-name flow-under', 11);
    }
    layer.appendChild(g);
    state.drawn.steps[s.id] = { box: b, label: s.label, task: /Task$|^task$/.test(kind) };
  }

  function drawEdge(layer, e) {
    var d = '';
    for (var i = 0; i < e.points.length; i++) d += (i ? 'L' : 'M') + e.points[i][0] + ' ' + e.points[i][1];
    var line = svg('path', { 'class': 'flow-arrow', d: d, 'marker-end': 'url(#flow-head)' });
    layer.appendChild(line);
    var name = null;
    if (e.name && e.label) {
      name = svg('text', { 'class': 'flow-edge-name', x: e.label.x + 2, y: e.label.y + e.label.h - 6 });
      name.textContent = e.name;
      layer.appendChild(name);
    }
    if (e.from && e.to) state.drawn.arrows[e.from + '>' + e.to] = { line: line, points: e.points, name: name };
  }

  function draw(parsed) {
    var pool = null;
    for (var i = 0; i < parsed.shapes.length; i++) {
      if (parsed.shapes[i].el.kind === 'participant') pool = parsed.shapes[i].box;
    }
    if (!pool) throw new Error('no pool');

    var pad = 4;
    var root = svg('svg', {
      'class': 'flow-svg',
      viewBox: (pool.x - pad) + ' ' + (pool.y - pad) + ' ' + (pool.w + pad * 2) + ' ' + (pool.h + pad * 2),
      role: 'img',
      'aria-label': state.current.name
    });
    var defs = svg('defs');
    var marker = svg('marker', { id: 'flow-head', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 8, markerHeight: 8, orient: 'auto-start-reverse' });
    marker.appendChild(svg('path', { 'class': 'flow-head', d: 'M0 0L10 5L0 10Z' }));
    defs.appendChild(marker);
    root.appendChild(defs);

    var back = svg('g');
    var lines = svg('g');
    var steps = svg('g');
    /* The numbers go on last, over everything, and are cleared and drawn
       again whenever the range or the who changes — see paint(). */
    var counts = svg('g', { 'class': 'flow-counts' });
    root.appendChild(back);
    root.appendChild(lines);
    root.appendChild(steps);
    root.appendChild(counts);

    state.drawn = { steps: {}, arrows: {}, counts: counts };
    parsed.shapes.forEach(function (s) {
      var k = s.el.kind;
      drawShape(k === 'participant' || k === 'lane' ? back : steps, s);
    });
    parsed.edges.forEach(function (e) { drawEdge(lines, e); });

    state.width = pool.w + pad * 2;
    state.steps = parsed.model;
    return root;
  }

  /* ----------------------------------------------------------------- the page */

  var nodes = {};

  function setZoom(z) {
    state.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    var s = nodes.stage.querySelector('svg');
    if (s) s.style.width = Math.round(state.width * state.zoom) + 'px';
  }

  function fitZoom() {
    return state.width ? (nodes.stage.clientWidth - 2) / state.width : 1;
  }

  function stageMessage(key, cls) {
    clear(nodes.stage);
    nodes.stage.appendChild(el('p', { className: 'flows-state' + (cls ? ' ' + cls : ''), textContent: t(key) }));
  }

  /* What a pressed step says: its name, whose lane it is in, the note, what
     it is counted by, every reference as a line of code — those are what
     somebody opening this page to find where a thing lives came for — and,
     once the numbers are in, its own. */
  function showStep(id, again) {
    var step = state.steps[id];
    if (state.picked) state.picked.classList.remove('is-picked');
    state.picked = nodes.stage.querySelector('[data-step="' + id + '"]');
    if (state.picked) state.picked.classList.add('is-picked');

    clear(nodes.detail);
    if (!step) {
      nodes.detail.appendChild(el('p', { className: 'flows-hint', textContent: t('flowsPick') }));
      return;
    }
    var note = [];
    var refs = [];
    var whens = [];
    var handover = false;
    String(step.doc || '').split('\n').forEach(function (line) {
      if (/^ref: /.test(line)) refs.push(line.slice(5));
      else if (/^when: /.test(line)) whens.push(line.slice(6));
      else if (/^handover: /.test(line)) handover = true;
      else if (line) note.push(line);
    });

    nodes.detail.appendChild(el('p', { className: 'eyebrow', textContent: step.lane }));
    nodes.detail.appendChild(el('h3', { className: 'flows-step-name', textContent: step.name }));
    if (note.length) nodes.detail.appendChild(el('p', { className: 'flows-note', textContent: note.join(' ') }));
    var codes = function (title, lines) {
      nodes.detail.appendChild(el('p', { className: 'flows-where', textContent: t(title) }));
      nodes.detail.appendChild(el('ul', { className: 'flows-refs' }, lines.map(function (r) {
        return el('li', null, [el('code', { textContent: r })]);
      })));
    };
    if (whens.length) codes('flowsWhen', whens);
    if (refs.length) codes('flowsWhere', refs);
    var numbers = detailNumbers(id, handover);
    if (numbers) nodes.detail.appendChild(numbers);
    if (!again && window.TTBTrack) window.TTBTrack.event('flow_step', { flow: state.current.id, step: id });
  }

  /* ------------------------------------------------------------ the numbers
   * See AND THE NUMBERS ON IT at the top. Everything here draws from
   * state.numbers, the route's answer for the flow on screen, by id on to
   * what draw() recorded in state.drawn; nothing walks the diagram, the
   * route has already done that.
   */

  /* The steps a diagram counts, out of the source. None on the owner's. */
  function countedSteps(flow) {
    return (flow.nodes || []).filter(function (n) { return n.when && n.when.length; });
  }

  function stepName(id) {
    return (state.steps[id] || {}).name || id;
  }

  /* A number of seconds as the page says a time: seconds under a minute,
     to the nearest five past ten, and minutes past it, to the half under
     ten. */
  function duration(secs) {
    if (secs < 10) return t('flowsSecs', { n: num(Math.max(1, Math.round(secs))) });
    if (secs < 60) return t('flowsSecs', { n: num(Math.min(55, Math.round(secs / 5) * 5)) });
    var mins = secs / 60;
    mins = mins < 10 ? Math.round(mins * 2) / 2 : Math.round(mins);
    try { return t('flowsMins', { n: mins.toLocaleString(state.lang) }); } catch (e) { return t('flowsMins', { n: String(mins) }); }
  }

  /* The typical time at a step: the median of its bucket counts, read
     along the bucket it falls in as though its times were spread evenly
     there. Past the last edge there is nothing to read along, so it says
     "over" the edge. Null where no time was counted. */
  function typical(counts, edges) {
    var total = 0;
    (counts || []).forEach(function (n) { total += n; });
    if (!total) return null;
    var half = total / 2;
    var below = 0;
    for (var i = 0; i < counts.length; i++) {
      if (below + counts[i] >= half && counts[i] > 0) {
        if (i >= edges.length) return t('flowsOver', { d: duration(edges[edges.length - 1]) });
        var lo = i ? edges[i - 1] : 0;
        return '~' + duration(lo + (edges[i] - lo) * (half - below) / counts[i]);
      }
      below += counts[i];
    }
    return null;
  }

  /* The bucket counts gathered into TIME_GROUPS, each with what it spans. */
  function spread(counts, edges) {
    var groups = TIME_GROUPS.map(function (hi, i) {
      return { n: 0, label: i ? duration(TIME_GROUPS[i - 1]) + '–' + duration(hi) : t('flowsUnder', { d: duration(hi) }) };
    });
    groups.push({ n: 0, label: t('flowsOver', { d: duration(TIME_GROUPS[TIME_GROUPS.length - 1]) }) });
    (counts || []).forEach(function (n, i) {
      var hi = i < edges.length ? edges[i] : Infinity;
      var g = 0;
      while (g < TIME_GROUPS.length && hi > TIME_GROUPS[g]) g++;
      groups[g].n += n;
    });
    return groups;
  }

  function timeOf(id) {
    var d = state.numbers;
    var who = d && d.who && d.who[state.who];
    return who && who.times && d.buckets ? typical(who.times[id], d.buckets) : null;
  }

  function rangeLabel() {
    return state.span === 1 ? t('visitorsToday') : t('insightsDays', { n: state.span });
  }

  /* The line under the controls: what is being counted, or why nothing is. */
  function say(key, error) {
    clear(nodes.counted);
    nodes.counted.classList.toggle('is-error', !!error);
    nodes.counted.appendChild(document.createTextNode(t(key)));
  }

  function ranges() {
    var row = el('div', { className: 'ins-range', role: 'group', 'aria-label': t('insightsRange') });
    SPANS.forEach(function (span) {
      var chip = el('button', { type: 'button', className: 'chip', 'data-span': span, 'aria-pressed': 'false',
        textContent: span === 1 ? t('visitorsToday') : t('insightsDays', { n: span }) });
      chip.addEventListener('click', function () {
        if (span === state.span) return;
        state.span = span;
        syncControls();
        if (window.TTBTrack) window.TTBTrack.event('flow_range', { flow: state.current.id, days: span });
        ask();
      });
      row.appendChild(chip);
    });
    return row;
  }

  /* The lists page's segmented control: a real radio for the keyboard and
     the screen reader, and is-on moved by hand, since the radio itself is
     one transparent pixel. */
  function whoSwitch() {
    return el('div', { className: 'lists-seg', role: 'radiogroup', 'aria-label': t('flowsWho') }, WHO.map(function (who) {
      var input = el('input', { type: 'radio', name: 'flows-who', value: who });
      input.addEventListener('change', function () {
        if (!input.checked || who === state.who) return;
        state.who = who;
        syncControls();
        if (window.TTBTrack) window.TTBTrack.event('flow_who', { flow: state.current.id, who: who });
        paint();
      });
      return el('label', { className: 'lists-seg-opt', 'data-who': who }, [input, t(WHO_LABEL[who])]);
    }));
  }

  function syncControls() {
    var chips = nodes.controls.querySelectorAll('.chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].setAttribute('aria-pressed', Number(chips[i].getAttribute('data-span')) === state.span ? 'true' : 'false');
    }
    var opts = nodes.controls.querySelectorAll('.lists-seg-opt');
    for (var o = 0; o < opts.length; o++) {
      var on = opts[o].getAttribute('data-who') === state.who;
      opts[o].classList.toggle('is-on', on);
      opts[o].querySelector('input').checked = on;
    }
  }

  /* The numbers for the flow on screen, over the range. A late answer for a
     flow or a range no longer on screen is dropped. */
  function ask() {
    var flow = state.current;
    if (!flow || !countedSteps(flow).length) return;
    var turn = ++state.asked;
    say('flowsCounting');
    get(NUMBERS + '?flow=' + encodeURIComponent(flow.id) + '&days=' + state.span).then(function (out) {
      if (turn !== state.asked || state.current !== flow) return;
      state.numbers = out;
      paint();
    }).catch(function () {
      if (turn !== state.asked || state.current !== flow) return;
      state.numbers = null;
      paint();
      say('flowsNumbersFailed', true);
    });
  }

  /* Everything the numbers put on the page, taken off again: the badges and
     the arrow numbers, the widths, the two cards. */
  function clearNumbers() {
    if (state.drawn) {
      clear(state.drawn.counts);
      Object.keys(state.drawn.arrows).forEach(function (key) {
        var arrow = state.drawn.arrows[key];
        arrow.line.style.strokeWidth = '';
        var rode = arrow.name && arrow.name.querySelector('.flow-arrow-n');
        if (rode) arrow.name.removeChild(rode);
      });
    }
    nodes.stepsCard.hidden = true;
    nodes.movesCard.hidden = true;
  }

  /* The answer, for the who on screen, drawn. */
  function paint() {
    clearNumbers();
    var d = state.numbers;
    if (!d) return;
    if (!d.ready || !d.who || !d.who[state.who]) { say('flowsNotYet'); return; }
    var who = d.who[state.who];
    var any = Object.keys(who.steps).some(function (id) { return who.steps[id] > 0; });
    if (any) countedLine(who, d.since); else say('flowsNothing');
    badges(who);
    arrowNumbers(who);
    stepsCard(who, d.counted);
    movesCard(who);
    if (state.picked) showStep(state.picked.getAttribute('data-step'), true);
  }

  function countedLine(who, since) {
    clear(nodes.counted);
    nodes.counted.classList.remove('is-error');
    nodes.counted.appendChild(el('b', { textContent: t('flowsViews', { n: num(who.views) }) }));
    nodes.counted.appendChild(document.createTextNode(' · ' + t(WHO_LABEL[state.who]) + ' · ' + rangeLabel()));
    nodes.counted.appendChild(el('br'));
    nodes.counted.appendChild(document.createTextNode(t('flowsOnce') + (since ? ' ' + t('visitorsSince', { date: dateLabel(since) }) : '')));
    nodes.counted.appendChild(el('br'));
    nodes.counted.appendChild(document.createTextNode(t('flowsMarks')));
  }

  /* A count on every step the answer has one for, on the shape's top-right
     corner. A nought is drawn, muted: what is not being used is the answer
     the page is opened for most. */
  function badges(who) {
    Object.keys(who.steps).forEach(function (id) {
      var shape = state.drawn.steps[id];
      if (!shape) return;
      var n = who.steps[id];
      var text = num(n);
      var b = shape.box;
      var w = 10 + text.length * 6.6;
      var right = b.x + b.w + 8;
      var top = b.y + 2;
      var g = svg('g', { 'class': 'flow-count' + (n ? '' : ' is-zero') });
      g.appendChild(svg('rect', { x: right - w, y: top - 8, width: w, height: 16, rx: 8 }));
      var label = svg('text', { x: right - w / 2, y: top + 3.8, 'text-anchor': 'middle' });
      label.textContent = text;
      g.appendChild(label);
      state.drawn.counts.appendChild(g);
      marks(id, shape, who);
    });
  }

  /* The two marks on a counted step, on a line of their own under it: how
     many stopped there, as a dashed pill, and the typical time spent at it.
     Under a task the pill ends where the count above it does and the time
     stands just left of it, so the two read as one line however narrow the
     box; an event's label is already under it, so both go under the label,
     the time and then the pill. Neither is drawn where it would say nought
     or nothing: a quiet diagram stays as it was. */
  function marks(id, shape, who) {
    var b = shape.box;
    var stopped = (who.stopped || {})[id] || 0;
    var time = timeOf(id);
    if (!time && !(stopped > 0)) return;
    var task = shape.task || !shape.label;
    var under = task ? b.y + b.h : shape.label.y + shape.label.h;
    var cx = b.x + b.w / 2;
    var text = stopped > 0 ? t('flowsStopped', { n: num(stopped) }) : '';
    var w = text ? 12 + text.length * 6.3 : 0;
    var pillX = task ? b.x + b.w + 8 - w : cx - w / 2;
    var pillY = task || !time ? under + 13 : under + 30;
    if (time) {
      var tl = task && text
        ? svg('text', { 'class': 'flow-time', x: pillX - 6, y: under + 17, 'text-anchor': 'end' })
        : svg('text', { 'class': 'flow-time', x: cx, y: under + 17, 'text-anchor': 'middle' });
      tl.textContent = time;
      state.drawn.counts.appendChild(tl);
    }
    if (text) {
      var g = svg('g', { 'class': 'flow-stopped' });
      g.appendChild(svg('rect', { x: pillX, y: pillY - 8, width: w, height: 16, rx: 8 }));
      var label = svg('text', { x: pillX + w / 2, y: pillY + 3.8, 'text-anchor': 'middle' });
      label.textContent = text;
      g.appendChild(label);
      state.drawn.counts.appendChild(g);
    }
  }

  /* A number and a width on every arrow walked. Where the number goes is
     about not landing on another arrow's, or on a step's badge: a labelled
     arrow carries it after its label, which tools/flows.mjs has already
     placed where no other label is, or over the label where the two
     together would run into the box the arrow points at — the label is
     measured as drawn, so this is decided by the pixels rather than by a
     guess at them; an unlabelled arrow that bends carries it under its
     first run, beside the step it leaves, since arrows that meet at one
     step leave from different rows; and a straight one carries it under
     its run, short of the head. A run coming in from above or below, which
     the layout does not draw today, would carry it beside the line. */
  function arrowNumbers(who) {
    var max = 1;
    Object.keys(who.arrows).forEach(function (key) { if (who.arrows[key] > max) max = who.arrows[key]; });
    Object.keys(who.arrows).forEach(function (key) {
      var arrow = state.drawn.arrows[key];
      var n = who.arrows[key];
      if (!arrow || !(n > 0)) return;
      arrow.line.style.strokeWidth = (ARROW_MIN + (ARROW_MAX - ARROW_MIN) * Math.sqrt(n / max)).toFixed(2);
      if (arrow.name) {
        var rode = svg('tspan', { 'class': 'flow-arrow-n' });
        rode.textContent = num(n);
        var fits = false;
        try {
          var into = state.drawn.steps[key.split('>')[1]].box;
          var from = Number(arrow.name.getAttribute('x'));
          fits = from + arrow.name.getComputedTextLength() + 8 + rode.textContent.length * 6.6 < into.x - 4;
        } catch (e) { fits = false; }
        if (fits) rode.setAttribute('dx', 5);
        else { rode.setAttribute('x', arrow.name.getAttribute('x')); rode.setAttribute('dy', -12); }
        arrow.name.appendChild(rode);
        return;
      }
      var pts = arrow.points;
      var p = pts[pts.length - 2];
      var q = pts[pts.length - 1];
      var at;
      if (pts.length > 2 && pts[0][1] === pts[1][1]) at = { x: pts[1][0] - 4, y: pts[0][1] + 14, anchor: 'end' };
      else if (p[1] === q[1]) at = { x: q[0] - 12, y: q[1] + 14, anchor: 'end' };
      else at = { x: q[0] + 8, y: (p[1] + q[1]) / 2 + 4, anchor: 'start' };
      var label = svg('text', { 'class': 'flow-arrow-n', 'text-anchor': at.anchor, x: at.x, y: at.y });
      label.textContent = num(n);
      state.drawn.counts.appendChild(label);
    });
  }

  /* Where the people who reached a step went next, most first: every pair
     out of it, joined by an arrow or not. */
  function nextOf(who, id) {
    return Object.keys(who.pairs).filter(function (key) { return key.indexOf(id + '>') === 0; })
      .map(function (key) { return { id: key.slice(id.length + 1), n: who.pairs[key] }; })
      .sort(function (a, b) { return b.n - a.n || stepName(a.id).localeCompare(stepName(b.id)); });
  }

  /* The line under a step's name in the table: its typical time, then
     where its people went. */
  function nextLine(who, id) {
    var next = nextOf(who, id).slice(0, NEXT_SHOWN);
    var parts = [];
    var time = timeOf(id);
    if (time) parts.push(time);
    if (next.length) parts.push('→ ' + next.map(function (x) { return stepName(x.id) + ' ' + num(x.n); }).join(' · '));
    return parts.join(' · ');
  }

  function table(label, heads, rows, wide) {
    return el('div', { className: 'ins-table ' + (wide ? 'vis-table vis-table-3' : 'flows-moves'), role: 'table', 'aria-label': label },
      (heads ? [el('div', { className: 'ins-row ins-head', role: 'row' },
        [el('span', { role: 'columnheader' })].concat(heads.map(function (h) {
          return el('span', { role: 'columnheader', textContent: h });
        })))] : []).concat(rows.map(function (r) {
        return el('div', { className: 'ins-row', role: 'row' },
          [r[0]].concat(r.slice(1).map(function (c) { return el('span', { className: 'stats-n', role: 'cell', textContent: c }); })));
      })));
  }

  /* Every counted step, in the order the diagram draws them — by where its
     shape stands, the top row first and left to right along it, so the
     main journey comes before the branches under it — with its number, its
     share of the diagram's page views, and where its people went next. */
  function stepsCard(who, counted) {
    clear(nodes.stepsTable);
    var rows = counted.filter(function (id) { return state.drawn.steps[id]; }).sort(function (a, b) {
      var p = state.drawn.steps[a].box;
      var q = state.drawn.steps[b].box;
      return p.y - q.y || p.x - q.x;
    }).map(function (id) {
      var n = who.steps[id] || 0;
      var next = nextLine(who, id);
      return [
        el('span', { className: 'stats-name', role: 'cell' }, [stepName(id), next ? el('span', { className: 'flows-next', textContent: next }) : null]),
        num(n),
        who.views ? Math.round(100 * n / who.views) + '%' : '–',
        n ? num((who.stopped || {})[id] || 0) : '–'
      ];
    });
    var steps = table(t('flowsSteps'), [t('flowsReached'), t('flowsOfViews'), t('flowsStoppedHead')], rows, true);
    steps.classList.add('flows-steps');
    nodes.stepsTable.appendChild(steps);
    nodes.stepsCard.hidden = false;
  }

  /* The pairs no arrow joins, most first. */
  function movesCard(who) {
    clear(nodes.movesTable);
    var moves = (who.moves || []).slice(0, MOVES_SHOWN);
    if (!moves.length) {
      nodes.movesTable.appendChild(el('p', { className: 'flows-hint', textContent: t('flowsNoMoves') }));
    } else {
      nodes.movesTable.appendChild(table(t('flowsMoves'), null, moves.map(function (m) {
        return [
          el('span', { className: 'stats-name flows-move', role: 'cell' }, [stepName(m.from), el('span', { className: 'flows-next', textContent: '→' }), stepName(m.to)]),
          num(m.n)
        ];
      }), false));
    }
    nodes.movesCard.hidden = false;
  }

  /* A pressed step's own number, in a sentence: reached in so many page
     views and where they went next for a counted step, walked through so
     many times for one the route filled in, or why it has none. */
  function detailNumbers(id, handover) {
    var d = state.numbers;
    if (!d || !d.ready || !d.who || !d.who[state.who]) return null;
    var who = d.who[state.who];
    var parts = [];
    var bar = null;
    if (d.counted.indexOf(id) !== -1) {
      var n = who.steps[id] || 0;
      var next = nextOf(who, id);
      var stopped = (who.stopped || {})[id] || 0;
      parts.push(t('flowsDetailReached', { n: num(n), views: num(who.views) }));
      if (next.length) {
        parts.push(t('flowsDetailWentOn') + ': ' + next.slice(0, NEXT_SHOWN).map(function (x) {
          return stepName(x.id) + ' ' + num(x.n);
        }).join(' · ') + '.');
      }
      if (stopped > 0) parts.push(t('flowsDetailStopped', { n: num(stopped) }));
      if (n > 0) {
        var time = timeOf(id);
        parts.push(time ? t('flowsDetailTime', { d: time }) : t('flowsDetailNoTime'));
        if (time) bar = timeBar(who.times[id], d.buckets);
      }
      if (handover) parts.push(t('flowsDetailHandover'));
    } else if (handover) {
      parts.push(t('flowsDetailHandover'));
    } else if (id in who.steps) {
      parts.push(t('flowsDetailWalked', { n: num(who.steps[id]) }));
    } else {
      parts.push(t('flowsDetailNoNumber'));
    }
    return el('div', { className: 'flows-detail-n' }, [el('p', { textContent: parts.join(' ') }), bar]);
  }

  /* The spread of a step's times as one bar of four parts, each as wide as
     its share, and the same four written out under it, so the bar is never
     the only place a number is. */
  function timeBar(counts, edges) {
    var groups = spread(counts, edges);
    var total = 0;
    groups.forEach(function (g) { total += g.n; });
    if (!total) return null;
    var shown = groups.filter(function (g) { return g.n > 0; });
    return el('div', { className: 'flows-times' }, [
      el('p', { className: 'flows-where', textContent: t('flowsTimeSpread') }),
      el('div', { className: 'flows-time-bar', 'aria-hidden': 'true' }, groups.map(function (g, i) {
        return g.n ? el('span', { className: 'is-' + i, style: 'flex-grow:' + g.n }) : null;
      })),
      el('p', { className: 'flows-time-key' }, shown.map(function (g) {
        var i = groups.indexOf(g);
        return el('span', null, [el('i', { className: 'is-' + i, 'aria-hidden': 'true' }), g.label + ' ' + Math.round(100 * g.n / total) + '%']);
      }))
    ]);
  }

  function open(flow, first) {
    state.current = flow;
    state.picked = null;
    state.numbers = null;
    state.asked += 1;
    state.who = DEFAULT_WHO[flow.id] || 'all';

    var chips = nodes.chips.querySelectorAll('.chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].setAttribute('aria-pressed', chips[i].getAttribute('data-flow') === flow.id ? 'true' : 'false');
    }
    nodes.name.textContent = flow.name;
    nodes.who.textContent = flow.who || '';
    nodes.download.setAttribute('href', '/flows/' + flow.id + '.bpmn');
    nodes.download.setAttribute('download', flow.id + '.bpmn');
    showStep(null);

    /* The owner's diagram counts nothing — nothing under /admin/ does — so
       it gets the sentence and no controls; every other gets the numbers
       once its drawing is up. */
    var counted = countedSteps(flow).length > 0;
    nodes.controls.hidden = !counted;
    syncControls();
    clearNumbers();
    if (!counted) say('flowsUncounted'); else say('flowsCounting');

    if (!first) {
      var url = new URL(window.location.href);
      url.searchParams.set('f', flow.id);
      try { window.history.replaceState(null, '', url.pathname + url.search); } catch (e) { /* a sandboxed frame */ }
      if (window.TTBTrack) window.TTBTrack.event('flow_open', { flow: flow.id });
    }

    stageMessage('flowsLoading');
    get('/flows/' + flow.id + '.bpmn', 'text').then(function (text) {
      if (state.current !== flow) return;
      var drawn = draw(parse(text));
      clear(nodes.stage);
      nodes.stage.appendChild(drawn);
      setZoom(Math.min(1, Math.max(FIRST_ZOOM_FLOOR, fitZoom())));
      ask();
    }).catch(function () {
      if (state.current === flow) stageMessage('flowsFailed', 'is-error');
    });
  }

  function build() {
    var main = document.getElementById('main');

    nodes.chips = el('div', { className: 'flows-chips', role: 'group', 'aria-label': t('flowsPickFlow') },
      state.flows.map(function (f) {
        var b = el('button', { type: 'button', className: 'chip', 'data-flow': f.id, 'aria-pressed': 'false', textContent: f.name });
        b.addEventListener('click', function () { open(f, false); });
        return b;
      }));

    nodes.name = el('h2', { className: 'flows-name' });
    nodes.who = el('p', { className: 'flows-who' });
    nodes.download = el('a', { className: 'flows-download', textContent: t('flowsDownload') });

    var zoom = function (label, key, fn) {
      var b = el('button', { type: 'button', className: 'btn', 'aria-label': t(key), title: t(key), textContent: label });
      b.addEventListener('click', fn);
      return b;
    };
    var tools = el('div', { className: 'flows-tools' }, [
      el('div', { className: 'flows-zoom' }, [
        zoom('−', 'flowsZoomOut', function () { setZoom(state.zoom / ZOOM_STEP); }),
        zoom('⤢', 'flowsFit', function () { setZoom(fitZoom()); }),
        zoom('+', 'flowsZoomIn', function () { setZoom(state.zoom * ZOOM_STEP); })
      ]),
      nodes.download
    ]);

    nodes.stage = el('div', { className: 'flows-stage' });
    nodes.detail = el('div', { className: 'card flows-detail', 'aria-live': 'polite' });

    /* The numbers' furniture: the range and the who over the diagram with
       the line that says what was counted, and the two cards under the
       detail, hidden until an answer fills them. */
    nodes.controls = el('div', { className: 'flows-controls' }, [ranges(), whoSwitch()]);
    nodes.counted = el('p', { className: 'flows-counted', 'aria-live': 'polite' });
    nodes.stepsTable = el('div');
    nodes.stepsCard = el('section', { className: 'card flows-detail', hidden: true }, [
      el('h2', { className: 'lists-title', textContent: t('flowsSteps') }),
      el('p', { className: 'stats-lead', textContent: t('flowsStepsLead') }),
      nodes.stepsTable
    ]);
    nodes.movesTable = el('div');
    nodes.movesCard = el('section', { className: 'card flows-detail', hidden: true }, [
      el('h2', { className: 'lists-title', textContent: t('flowsMoves') }),
      el('p', { className: 'stats-lead', textContent: t('flowsMovesLead') }),
      nodes.movesTable
    ]);

    /* One listener for every step, rather than one on each: a diagram is
       redrawn whole on every chip, and the steps are found by the attribute
       drawShape() puts on them. */
    var pick = function (ev) {
      var g = ev.target.closest ? ev.target.closest('[data-step]') : null;
      if (g) showStep(g.getAttribute('data-step'));
    };
    nodes.stage.addEventListener('click', pick);
    nodes.stage.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(ev); }
    });

    clear(main);
    main.appendChild(nodes.chips);
    main.appendChild(el('section', { className: 'card flows-card' }, [nodes.name, nodes.who, nodes.controls, nodes.counted, tools, nodes.stage]));
    main.appendChild(nodes.detail);
    main.appendChild(nodes.stepsCard);
    main.appendChild(nodes.movesCard);

    var wanted = new URLSearchParams(window.location.search).get('f');
    var first = state.flows[0];
    for (var i = 0; i < state.flows.length; i++) if (state.flows[i].id === wanted) first = state.flows[i];
    open(first, true);
  }

  function boot() {
    applyStyle();
    var main = document.getElementById('main');
    Promise.all([get(UI_URL), get(SOURCE)]).then(function (both) {
      state.ui = both[0];
      state.lang = pickLanguage(Object.keys(state.ui));
      state.flows = (both[1] && both[1].flows) || [];
      applyStaticStrings();
      if (!state.flows.length) {
        clear(main);
        main.appendChild(el('p', { className: 'flows-state', textContent: t('flowsEmpty') }));
        return;
      }
      build();
    }).catch(function () {
      /* Without ui.json there are no words to say it in, so this is the line
         the markup carries in English, shown rather than written. */
      var failed = document.getElementById('flows-failed');
      if (failed) failed.hidden = false;
      var loading = document.getElementById('flows-loading');
      if (loading) loading.hidden = true;
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
