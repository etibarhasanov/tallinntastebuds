/* Tallinn Tastebuds — /admin/flows, who uses the site, drawn.
 *
 * One BPMN diagram for each kind of person this site answers — a visitor, a
 * member, the waiter and the counter a discount is shown to, a splitwise
 * group, a learner on the flashcards, the owner — with a chip for each, and
 * under the diagram whatever step was last pressed: its note and the files
 * and routes that do it. See **Who uses the site, drawn** in README.md.
 *
 * WHAT IT DRAWS FROM
 *
 * data/flows.json is the source and flows/<id>.bpmn is what tools/flows.mjs
 * lays out from it. This page reads the source for the chips — a name and a
 * sentence per diagram — and the .bpmn for the drawing, so what is on the
 * screen is exactly the file the download link hands over and a modeler
 * would open. A .bpmn that does not draw here does not open there either,
 * and this is where somebody finds out.
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
    picked: null     // the <g> of the step last pressed
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

  function t(key) {
    var pack = state.ui[state.lang] || {};
    var s = pack[key];
    if (s === undefined) s = (state.ui[DEFAULT_LANG] || {})[key];
    return s === undefined ? key : s;
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

    var edges = [];
    var es = doc.getElementsByTagNameNS(NS.bpmndi, 'BPMNEdge');
    for (var e = 0; e < es.length; e++) {
      var pts = [];
      var wps = es[e].getElementsByTagNameNS(NS.di, 'waypoint');
      for (var w = 0; w < wps.length; w++) pts.push([+wps[w].getAttribute('x'), +wps[w].getAttribute('y')]);
      var flow = model[es[e].getAttribute('bpmnElement')] || { name: '' };
      edges.push({ points: pts, name: flow.name, label: labelBounds(es[e]) });
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
  }

  function drawEdge(layer, e) {
    var d = '';
    for (var i = 0; i < e.points.length; i++) d += (i ? 'L' : 'M') + e.points[i][0] + ' ' + e.points[i][1];
    layer.appendChild(svg('path', { 'class': 'flow-arrow', d: d, 'marker-end': 'url(#flow-head)' }));
    if (e.name && e.label) {
      var node = svg('text', { 'class': 'flow-edge-name', x: e.label.x + 2, y: e.label.y + e.label.h - 6 });
      node.textContent = e.name;
      layer.appendChild(node);
    }
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
    root.appendChild(back);
    root.appendChild(lines);
    root.appendChild(steps);

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

  /* What a pressed step says: its name, whose lane it is in, the note, and
     every reference as a line of code — those are what somebody opening this
     page to find where a thing lives came for. */
  function showStep(id) {
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
    String(step.doc || '').split('\n').forEach(function (line) {
      if (/^ref: /.test(line)) refs.push(line.slice(5));
      else if (line) note.push(line);
    });

    nodes.detail.appendChild(el('p', { className: 'eyebrow', textContent: step.lane }));
    nodes.detail.appendChild(el('h3', { className: 'flows-step-name', textContent: step.name }));
    if (note.length) nodes.detail.appendChild(el('p', { className: 'flows-note', textContent: note.join(' ') }));
    if (refs.length) {
      nodes.detail.appendChild(el('p', { className: 'flows-where', textContent: t('flowsWhere') }));
      nodes.detail.appendChild(el('ul', { className: 'flows-refs' }, refs.map(function (r) {
        return el('li', null, [el('code', { textContent: r })]);
      })));
    }
    if (window.TTBTrack) window.TTBTrack.event('flow_step', { flow: state.current.id, step: id });
  }

  function open(flow, first) {
    state.current = flow;
    state.picked = null;

    var chips = nodes.chips.querySelectorAll('.chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].setAttribute('aria-pressed', chips[i].getAttribute('data-flow') === flow.id ? 'true' : 'false');
    }
    nodes.name.textContent = flow.name;
    nodes.who.textContent = flow.who || '';
    nodes.download.setAttribute('href', '/flows/' + flow.id + '.bpmn');
    nodes.download.setAttribute('download', flow.id + '.bpmn');
    showStep(null);

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
    main.appendChild(el('section', { className: 'card flows-card' }, [nodes.name, nodes.who, tools, nodes.stage]));
    main.appendChild(nodes.detail);

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
