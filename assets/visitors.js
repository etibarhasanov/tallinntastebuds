/* Tallinn Tastebuds — /admin/visitors, who came to the site and what they did.
 *
 * The page Google Analytics is open in a tab for, drawn from the site's own
 * count instead: a range, five figures, a bar a day of new and returning
 * visitors, the map's two rails side by side, and four tables — pages,
 * countries, where people came from, and what they pressed. The shape is the
 * one /insights already has, because it is the same kind of question and the
 * owner has met that page; the rows, the figures and the chart borrow its
 * classes and /admin/stats' out of assets/stats.css.
 *
 * WHERE THE NUMBERS COME FROM
 *
 * assets/track.js, on every page but the owner's, says when a page opens and
 * how long it was on screen, and functions/api/_visitors.js counts it — that
 * file is what a visitor is, what time is, and what the numbers cannot say,
 * and it is worth reading before trusting any figure here. This page only
 * reads, from /api/admin/visitors, which only the owner can.
 *
 * ONE REQUEST ON THE WAY IN
 *
 * The words arrive with the numbers, as on /admin/stats: the page sends the
 * languages it would pick from and the route answers with the one block the
 * site speaks. A press on a range asks again for that range and redraws; the
 * range is kept in the address so a reload lands on it.
 *
 * Plain browser JavaScript, one IIFE, ES5, the same as every file in assets/.
 */
(function () {
  'use strict';

  var API = '/api/admin/visitors';

  var STYLES = ['red', 'green'];
  var DEFAULT_STYLE = 'red';
  var STYLE_KEY = 'ttb.style';
  var LANG_KEY = 'ttb.lang';
  var DEFAULT_LANG = 'en';

  /* The ranges, as the route answers them — SPANS in
     functions/api/_visitors.js is the other copy. 1 is today so far. */
  var SPANS = [1, 7, 28, 90];
  var DEFAULT_SPAN = 7;

  /* How many rows a table names before the rest are one line of Other. */
  var TOP = 8;

  /* The two rails by the id pickLayout() in assets/app.js deals them. */
  var RAILS = { a: 'visitorsLayoutFull', b: 'visitorsLayoutShort' };

  var SOURCES = { search: 'insightsSearch', here: 'insightsHere', direct: 'insightsDirect' };

  var state = { lang: DEFAULT_LANG, ui: {}, data: null };

  var main = null;

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

  function svg(tag, attrs, kids) {
    var node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, String(attrs[k])); });
    (kids || []).forEach(function (kid) {
      node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    });
    return node;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function storeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  /* One string in the one block the route sent — see assets/stats.js. */
  function t(key, vars) {
    var s = state.ui[key];
    if (s === undefined) return key;
    if (vars) {
      Object.keys(vars).forEach(function (v) {
        s = s.split('{' + v + '}').join(String(vars[v]));
      });
    }
    return s;
  }

  function num(n, digits) {
    try {
      return new Intl.NumberFormat(state.lang, { maximumFractionDigits: digits || 0 }).format(n);
    } catch (e) {
      return String(digits ? Math.round(n * 10) / 10 : Math.round(n));
    }
  }

  function share(part, whole) {
    return whole ? num(part / whole * 100) + '%' : '—';
  }

  /* A length of time as the reading language writes it — "2 min 14 s",
     "2m 14s" — out of Intl's units, which is every language's word for a
     minute and a second without writing one into data/ui.json. */
  function duration(secs) {
    secs = Math.round(secs);
    var unit = function (n, which) {
      try {
        return new Intl.NumberFormat(state.lang, { style: 'unit', unit: which, unitDisplay: 'narrow' }).format(n);
      } catch (e) {
        return n + (which === 'minute' ? 'm' : 's');
      }
    };
    var m = Math.floor(secs / 60);
    return m ? unit(m, 'minute') + ' ' + unit(secs % 60, 'second') : unit(secs, 'second');
  }

  function per(total, visitors) {
    return visitors ? total / visitors : 0;
  }

  function countryName(code) {
    if (code === 'XX' || code === 'T1') return t('insightsUnknown');
    try {
      return new Intl.DisplayNames([state.lang], { type: 'region' }).of(code) || code;
    } catch (e) {
      return code;
    }
  }

  function sourceName(r) {
    if (r.name) return r.name;
    return SOURCES[r.id] ? t(SOURCES[r.id]) : r.id;
  }

  function dateLabel(day, long) {
    var opts = long ? { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
             : { day: 'numeric', month: 'short', timeZone: 'UTC' };
    try {
      return new Intl.DateTimeFormat(state.lang, opts).format(new Date(day + 'T00:00:00Z'));
    } catch (e) {
      return day;
    }
  }

  /* ----------------------------------------------------------------- boot */

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

  /* The languages this page would pick from, for the route to choose among —
     wanted() in assets/stats.js. */
  function wanted() {
    var list = [new URLSearchParams(window.location.search).get('lang'), storeGet(LANG_KEY)]
      .concat(navigator.languages || [navigator.language || '']);
    var out = [];
    for (var i = 0; i < list.length && out.length < 10; i++) {
      var tag = String(list[i] || '').trim();
      if (tag && out.indexOf(tag) === -1) out.push(tag);
    }
    return out;
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

  /* --------------------------------------------------------------- pieces */

  function card(kids) {
    return el('section', { className: 'card lists-card' }, kids);
  }

  function ranges() {
    var row = el('div', { className: 'ins-range', role: 'group', 'aria-label': t('insightsRange') });
    SPANS.forEach(function (span) {
      var chip = el('button', {
        type: 'button',
        className: 'chip',
        'aria-pressed': span === state.data.span ? 'true' : 'false',
        textContent: span === 1 ? t('visitorsToday') : t('insightsDays', { n: span })
      });
      chip.addEventListener('click', function () {
        if (span !== state.data.span) load(span);
      });
      row.appendChild(chip);
    });
    return row;
  }

  /* The change on the range before, in words, or nothing for today. `show`
     writes the difference the way the figure itself is written. */
  function against(now, was, show) {
    var d = state.data;
    if (!d.before) return null;
    var diff = now - was;
    return diff > 0 ? t('insightsMore', { n: show(diff), days: d.span })
         : diff < 0 ? t('insightsFewer', { n: show(-diff), days: d.span })
         : t('insightsSame', { days: d.span });
  }

  function figure(label, value, under) {
    return el('div', { className: 'ins-kpi' }, [
      el('dt', { className: 'eyebrow', textContent: label }),
      el('dd', null, [
        el('div', { className: 'ins-kpi-n', textContent: value }),
        under ? el('div', { className: 'ins-kpi-was', textContent: under }) : null
      ])
    ]);
  }

  function figures() {
    var d = state.data;
    var now = d.now;
    var was = d.before || now;
    var tenths = function (n) { return num(n, 1); };
    return el('dl', { className: 'ins-kpis vis-kpis' }, [
      figure(t('visitorsVisitors'), num(now.visitors), against(now.visitors, was.visitors, num)),
      figure(t('visitorsReturning'), share(now.back, now.visitors), null),
      figure(t('visitorsViews'), num(now.views), against(now.views, was.views, num)),
      figure(t('visitorsTime'), duration(per(now.secs, now.visitors)),
        against(Math.round(per(now.secs, now.visitors)), Math.round(per(was.secs, was.visitors)), duration)),
      figure(t('visitorsPresses'), num(per(now.presses, now.visitors), 1),
        against(Math.round(per(now.presses, now.visitors) * 10) / 10,
          Math.round(per(was.presses, was.visitors) * 10) / 10, tenths))
    ]);
  }

  /* The top of a scale the tallest bar fits under — ceiling() in
     assets/insights.js. */
  function ceiling(max) {
    var steps = [2, 4, 6, 10];
    for (var mag = 1; ; mag *= 10) {
      for (var i = 0; i < steps.length; i++) {
        if (steps[i] * mag >= max) return steps[i] * mag;
      }
    }
  }

  /* A bar per day, or per week for ninety days: new visitors at the foot,
     returning ones stacked on them. Told apart by the key above the chart as
     well as by colour, and read out in full to a screen reader. */
  function chart() {
    var d = state.data;
    var bars = d.series;
    var W = 340, H = 160, L = 30, R = 4, T = 10, B = 128;
    var max = 0;
    bars.forEach(function (b) { if (b.fresh + b.back > max) max = b.fresh + b.back; });
    var top = ceiling(max);
    var slot = (W - R - L) / bars.length;
    var wide = Math.max(2, slot * 0.7);
    var y = function (n) { return B - (B - T) * n / top; };

    var kids = [];
    [0, top / 2, top].forEach(function (v) {
      kids.push(svg('line', { 'class': 'ins-grid', x1: L, x2: W - R, y1: y(v), y2: y(v) }));
      kids.push(svg('text', { x: L - 6, y: y(v) + 3.5, 'text-anchor': 'end' }, [num(v)]));
    });
    bars.forEach(function (b, i) {
      var x = (L + slot * i + (slot - wide) / 2).toFixed(1);
      if (b.fresh) {
        kids.push(svg('rect', { 'class': 'vis-new', x: x, width: wide.toFixed(1),
          y: y(b.fresh).toFixed(1), height: (B - y(b.fresh)).toFixed(1) }));
      }
      if (b.back) {
        kids.push(svg('rect', { 'class': 'vis-back', x: x, width: wide.toFixed(1),
          y: y(b.fresh + b.back).toFixed(1), height: (y(b.fresh) - y(b.fresh + b.back)).toFixed(1) }));
      }
    });
    /* Five dates along the foot at most: "4 сент." is twice "Sep 4", and
       seven of those run into each other at 390px. */
    var every = Math.max(1, Math.ceil(bars.length / 5));
    for (var i = bars.length - 1; i >= 0; i -= every) {
      kids.push(svg('text', { x: (L + slot * (i + 0.5)).toFixed(1), y: B + 18, 'text-anchor': 'middle' },
        [dateLabel(bars[i].day)]));
    }

    var said = bars.map(function (b) {
      return dateLabel(b.day) + ': ' + num(b.fresh) + ' ' + t('visitorsNew') + ', ' + num(b.back) + ' ' + t('visitorsReturning');
    }).join('; ');
    return [
      el('h2', { className: 'lists-title', textContent: t(d.unit === 'week' ? 'visitorsPerWeek' : 'visitorsPerDay') }),
      el('p', { className: 'vis-key' }, [
        el('span', { className: 'vis-swatch vis-swatch-new' }), t('visitorsNew'),
        el('span', { className: 'vis-swatch vis-swatch-back' }), t('visitorsReturning')
      ]),
      svg('svg', { 'class': 'ins-chart', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': said }, kids)
    ];
  }

  /* The first TOP rows and the rest as one Other — topOf() in
     assets/insights.js, over rows of one number. */
  function topOf(rows) {
    if (rows.length <= TOP + 1) return rows;
    var other = { other: true, n: 0 };
    rows.slice(TOP).forEach(function (r) { other.n += r.n; });
    return rows.slice(0, TOP).concat([other]);
  }

  /* A ranking of one number, as /admin/stats draws them. `mono` for names
     that are ids rather than words. */
  function ranking(title, rows, name, mono) {
    var ol = el('ol', { className: 'stats-list ins-list' });
    topOf(rows).forEach(function (r, i) {
      ol.appendChild(el('li', { className: 'stats-row' }, [
        el('span', { className: 'stats-rank', textContent: r.other ? '' : String(i + 1) }),
        el('span', { className: 'stats-who' }, [
          el('span', { className: r.other || !mono ? 'stats-name' : 'stats-name vis-id',
            textContent: r.other ? t('insightsOther') : name(r) })
        ]),
        el('span', { className: 'stats-n', textContent: num(r.n) })
      ]));
    });
    return card([el('h2', { className: 'lists-title', textContent: title }), ol]);
  }

  /* A table of a name and two numbers — the grid /insights draws its
     sources in. `heads` names the two columns, `cells` gives a row's. */
  function grid(label, heads, rows, name, cells) {
    var table = el('div', { className: 'ins-table vis-table', role: 'table', 'aria-label': label }, [
      el('div', { className: 'ins-row ins-head', role: 'row' },
        [el('span', { role: 'columnheader' })].concat(heads.map(function (h) {
          return el('span', { role: 'columnheader', textContent: h });
        })))
    ]);
    rows.forEach(function (r) {
      table.appendChild(el('div', { className: 'ins-row', role: 'row' },
        [el('span', { className: 'stats-name', role: 'cell', textContent: name(r) })].concat(
          cells(r).map(function (c) { return el('span', { className: 'stats-n', role: 'cell', textContent: c }); }))));
    });
    return table;
  }

  function pages() {
    return card([
      el('h2', { className: 'lists-title', textContent: t('visitorsPages') }),
      grid(t('visitorsPages'), [t('insightsViews'), t('visitorsTimeShort')], state.data.pages,
        function (p) { return p.name; },
        function (p) { return [num(p.views), duration(per(p.secs, p.views))]; })
    ]);
  }

  /* The map's two rails side by side, once either has had a visitor: a row
     per figure and a column per rail, which is the comparison the split is
     for and the one arrangement of eight numbers that fits across a phone. */
  function layouts() {
    var rails = state.data.layouts.filter(function (r) { return RAILS[r.id]; });
    if (!rails.some(function (r) { return r.visitors; })) return null;
    var rows = [
      [t('visitorsVisitors'), function (r) { return num(r.visitors); }],
      [t('visitorsReturning'), function (r) { return share(r.back, r.visitors); }],
      [t('visitorsTime'), function (r) { return duration(per(r.secs, r.visitors)); }],
      [t('visitorsPresses'), function (r) { return num(per(r.presses, r.visitors), 1); }]
    ];
    return card([
      el('h2', { className: 'lists-title', textContent: t('visitorsLayouts') }),
      el('p', { className: 'stats-lead', textContent: t('visitorsLayoutsLead') }),
      grid(t('visitorsLayouts'), rails.map(function (r) { return t(RAILS[r.id]); }), rows,
        function (f) { return f[0]; },
        function (f) { return rails.map(f[1]); })
    ]);
  }

  /* ----------------------------------------------------------- the states */

  function note(key, vars) {
    return el('p', { className: 'stats-total', textContent: t(key, vars) });
  }

  function render() {
    clear(main);
    var d = state.data;

    if (!d || !d.ready) {
      main.appendChild(card([el('p', { className: 'lists-none', textContent: t('statsOff') })]));
      return;
    }
    if (!d.since) {
      main.appendChild(card([el('p', { className: 'lists-none', textContent: t('visitorsNone') })]));
      return;
    }

    var stack = el('div', { className: 'lists-stack' });
    stack.appendChild(card([
      ranges(),
      figures(),
      d.span === 1 ? el('p', { className: 'ins-note', textContent: t('visitorsSoFar') }) : null
    ]));

    if (!d.now.visitors && !d.now.views) {
      stack.appendChild(card([el('p', { className: 'lists-none', textContent: t('visitorsQuiet') })]));
    } else {
      if (d.series) stack.appendChild(card(chart()));
      stack.appendChild(layouts());
      if (d.pages.length) stack.appendChild(pages());
      if (d.countries.length) {
        stack.appendChild(ranking(t('insightsCountry'), d.countries, function (r) { return countryName(r.id); }));
      }
      if (d.sources.length) stack.appendChild(ranking(t('insightsFrom'), d.sources, sourceName));
      if (d.presses.length) {
        stack.appendChild(ranking(t('insightsPressed'), d.presses, function (r) { return r.id; }, true));
      }
    }

    stack.appendChild(el('div', { className: 'stats-totals' }, [
      note('visitorsSince', { date: dateLabel(d.since, true) }),
      note('visitorsFoot')
    ]));
    main.appendChild(stack);
  }

  /* ------------------------------------------------------------------ start */

  function wantedSpan() {
    var n = Number(new URLSearchParams(window.location.search).get('days'));
    return SPANS.indexOf(n) !== -1 ? n : DEFAULT_SPAN;
  }

  /* One range asked for and drawn. What was on screen stays until the answer
     is in, so a press on a range does not flash an empty page; an answer
     with no words — offline, the route not deployed — leaves the markup's
     English title standing and draws nothing rather than printing keys. */
  function load(span) {
    return fetch(API + '?days=' + span + '&lang=' + encodeURIComponent(wanted().join(',')), {
      headers: { accept: 'application/json' }
    })
      .then(function (res) { return res.json(); })
      .catch(function () { return null; })
      .then(function (out) {
        if (!out || !out.ui) return;
        state.lang = out.lang || DEFAULT_LANG;
        state.ui = out.ui;
        state.data = out;

        var url = new URL(window.location.href);
        if (out.span === DEFAULT_SPAN) url.searchParams.delete('days');
        else url.searchParams.set('days', String(out.span));
        if (url.href !== window.location.href) history.replaceState(null, '', url.href);

        applyStaticStrings();
        document.title = t('visitorsDocumentTitle');
        render();
      });
  }

  function boot() {
    main = document.getElementById('main');
    applyStyle();
    load(wantedSpan());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
