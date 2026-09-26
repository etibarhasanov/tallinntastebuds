/**
 * Tallinn Tastebuds — /insights, how the page under your name is doing.
 *
 * WHAT IT IS
 *
 * One person's numbers about /u/<them>, for them and nobody else: how often
 * the page was opened over a range, the same over the range before it, a
 * line of it over time, where the views and the clicks came from, which
 * country, and what on the page was pressed. The shape is the one every
 * page-of-links host already has for this — a range, three figures, a line,
 * a table of sources — because the people with a page here have met it
 * there, and a new arrangement of the same four things would be something
 * to learn for nothing.
 *
 * functions/api/_visits.js is what is counted and how, and it is worth
 * reading before changing anything here: it says why a view is not a person,
 * why Instagram shows up far more often than it does in GA, and why a range
 * reaching back far enough has clicks with no source.
 *
 * WHAT IS DIFFERENT FROM THE PAGES IT LOOKS LIKE
 *
 * Every range is there for everybody. There is no 90 days behind an upgrade;
 * this site sells nothing.
 *
 * One line, not a line per source. Three coloured lines are told apart by
 * colour and nothing else — design rule 10 — and on a phone they halve the
 * height each one has to say anything in. Clicks are the second figure
 * above the line, and the sources are the table under it.
 *
 * WHAT IT READS
 *
 *   /data/ui.json              the strings
 *   /api/insights?days=        who is signed in, and the range asked for
 *
 * A press on a range asks the route again for that range alone and redraws
 * the page from the answer; the range is kept in the address, so a reload or
 * a link lands on the one that was being read.
 */
(function () {
  'use strict';

  var UI_URL = '/data/ui.json';
  var API = '/api/insights';

  var STYLE_KEY = 'ttb.style';
  var LANG_KEY = 'ttb.lang';

  var STYLES = ['red', 'green'];
  var DEFAULT_STYLE = 'red';
  var DEFAULT_LANG = 'en';

  /* The ranges, as the route answers them — SPANS in functions/api/_visits.js
     is the other copy — with 0 for all of it. */
  var SPANS = [7, 28, 90, 0];

  /* How many sources and countries are named before the rest are one line of
     Other: the long tail of a page's sources is one visit each, and a column
     of ones says nothing the Other line does not. */
  var TOP = 5;

  /* The way back here from the map's sign-in sheet. */
  var SHEET = '/?account=';
  var BACK = '&then=%2Finsights';

  var state = {
    ui: {},
    lang: DEFAULT_LANG,
    reached: true,
    ready: false,
    user: null,
    span: 7,
    data: null   // the answer's `insights`, null where the table is not there
  };

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

  /* The chart is SVG, which createElement cannot make. */
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

  function getJSON(url) {
    return fetch(url, { headers: { accept: 'application/json' } }).then(function (res) {
      if (!res.ok) throw new Error(url + ': ' + res.status);
      return res.json();
    });
  }

  /* "The site did not answer" and "the site answered no" kept apart, the way
     assets/account.js asks. */
  function ask(url) {
    return fetch(url, { headers: { accept: 'application/json' } })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (out) {
          return { status: res.status, out: out || {} };
        });
      })
      .catch(function () { return { status: 0, out: {} }; });
  }

  /* A number as the reading language writes it — 1,024 or 1 024. */
  function num(n) {
    try { return new Intl.NumberFormat(state.lang).format(n); } catch (e) { return String(n); }
  }

  function rate(clicks, views) {
    return views ? num(Math.round(clicks / views * 100)) + '%' : '—';
  }

  /* --------------------------------------------------------------- dressing
   * Copied whole from assets/edit.js, which copied it from the account page:
   * see "The two styles" in README.md. */
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
    each('data-i18n-title', function (n, k) { n.setAttribute('title', t(k)); });
  }

  /* ------------------------------------------------------------ the names */

  /* Where a view came from, in words. The three networks arrive named — a
     brand is the same word in every language — the three buckets are named
     here, and a host that is none of them is printed as itself, which is the
     most anybody could say about it. */
  var SOURCES = {
    search: 'insightsSearch',
    here: 'insightsHere',
    direct: 'insightsDirect'
  };

  function sourceName(r) {
    if (r.name) return r.name;
    return SOURCES[r.id] ? t(SOURCES[r.id]) : r.id;
  }

  /* The browser's own name for a country, in the language the page is being
     read in — Intl carries every one of them in all ten, which is two
     hundred names nobody has to write into data/ui.json. XX is Cloudflare
     not knowing, T1 is Tor. */
  function countryName(code) {
    if (code === 'XX' || code === 'T1') return t('insightsUnknown');
    try {
      return new Intl.DisplayNames([state.lang], { type: 'region' }).of(code) || code;
    } catch (e) {
      return code;
    }
  }

  /* A point on the line's own label: a weekday and a date for a day, a date
     for a week, which is the day it starts, and a month for a month. UTC,
     because that is the clock the table files days by. */
  function dateLabel(day, unit) {
    var opts = unit === 'month' ? { month: 'short', timeZone: 'UTC' }
             : { day: 'numeric', month: 'short', timeZone: 'UTC' };
    try {
      return new Intl.DateTimeFormat(state.lang, opts).format(new Date(day + 'T00:00:00Z'));
    } catch (e) {
      return day;
    }
  }

  /* --------------------------------------------------------------- pieces */

  function card(kids) {
    return el('section', { className: 'card lists-card' }, kids);
  }

  /* The four ranges. Chips because they are the map's own way of choosing
     one of a few, pressed rather than a dropdown because four fit. */
  function ranges() {
    var row = el('div', { className: 'ins-range', role: 'group', 'aria-label': t('insightsRange') });
    SPANS.forEach(function (span) {
      var chip = el('button', {
        type: 'button',
        className: 'chip',
        'aria-pressed': span === state.span ? 'true' : 'false',
        textContent: span ? t('insightsDays', { n: span }) : t('insightsAll')
      });
      chip.addEventListener('click', function () {
        if (span === state.span) return;
        TTBTrack.event('insights_range', { days: span });
        load(span);
      });
      row.appendChild(chip);
    });
    return row;
  }

  /* The change on the range before this one, said as a sentence, or nothing
     for all time, which has no range before it. */
  function against(now, was) {
    var d = state.data;
    if (!d.before) return null;
    var diff = now - was;
    var days = d.span;
    return diff > 0 ? t('insightsMore', { n: num(diff), days: days })
         : diff < 0 ? t('insightsFewer', { n: num(-diff), days: days })
         : t('insightsSame', { days: days });
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
    return el('dl', { className: 'ins-kpis' }, [
      figure(t('insightsViews'), num(d.views), against(d.views, d.before && d.before.views)),
      figure(t('insightsClicks'), num(d.clicks), against(d.clicks, d.before && d.before.clicks)),
      figure(t('insightsRate'), rate(d.clicks, d.views), t('insightsRateWhy'))
    ]);
  }

  /* The top of a scale that the line fits under and that divides into two
     round halves: 1, 2, 4, 6, 10, 20, 40, 60, 100 and on. Never under two,
     so a week of ones is not a line pinned to the ceiling. */
  function ceiling(max) {
    var top = 2;
    var steps = [2, 4, 6, 10];
    for (var mag = 1; ; mag *= 10) {
      for (var i = 0; i < steps.length; i++) {
        top = steps[i] * mag;
        if (top >= max) return top;
      }
    }
  }

  /* The line, drawn by hand: a polyline, three rules, and at most seven
     labels along the foot however many points there are. A dot on every
     point where there are few enough to tell apart, and none past that. The
     label a screen reader gets is every point, in words. */
  function chart() {
    var d = state.data;
    var pts = d.series;
    var W = 340, H = 160, L = 30, R = 8, T = 10, B = 128;
    var max = 0;
    pts.forEach(function (p) { if (p.n > max) max = p.n; });
    var top = ceiling(max);
    var x = function (i) { return pts.length === 1 ? (L + W - R) / 2 : L + (W - R - L) * i / (pts.length - 1); };
    var y = function (n) { return B - (B - T) * n / top; };

    var kids = [];
    [0, top / 2, top].forEach(function (v) {
      kids.push(svg('line', { 'class': 'ins-grid', x1: L, x2: W - R, y1: y(v), y2: y(v) }));
      kids.push(svg('text', { x: L - 6, y: y(v) + 3.5, 'text-anchor': 'end' }, [num(v)]));
    });
    kids.push(svg('polyline', {
      'class': 'ins-line',
      points: pts.map(function (p, i) { return x(i).toFixed(1) + ',' + y(p.n).toFixed(1); }).join(' ')
    }));
    if (pts.length <= 31) {
      pts.forEach(function (p, i) {
        kids.push(svg('circle', { 'class': 'ins-dot', cx: x(i).toFixed(1), cy: y(p.n).toFixed(1), r: pts.length <= 8 ? 3 : 2 }));
      });
    }
    var every = Math.max(1, Math.ceil(pts.length / 7));
    for (var i = pts.length - 1; i >= 0; i -= every) {
      kids.push(svg('text', { x: x(i).toFixed(1), y: B + 18, 'text-anchor': 'middle' }, [dateLabel(pts[i].day, d.unit)]));
    }

    var said = pts.map(function (p) { return dateLabel(p.day, d.unit) + ': ' + num(p.n); }).join(', ');
    return svg('svg', {
      'class': 'ins-chart',
      viewBox: '0 0 ' + W + ' ' + H,
      role: 'img',
      'aria-label': t('insightsViews') + ' — ' + said
    }, kids);
  }

  /* The first TOP rows, and the rest summed into one Other where there are
     at least two of them to sum — one row called Other would hide a name to
     save no room. `sum` is how a row is added into Other. */
  function topOf(rows, sum) {
    if (rows.length <= TOP + 1) return rows;
    var other = { other: true };
    rows.slice(TOP).forEach(function (r) { sum(other, r); });
    return rows.slice(0, TOP).concat([other]);
  }

  function sources() {
    var d = state.data;
    var rows = topOf(d.from, function (o, r) {
      o.views = (o.views || 0) + r.views;
      o.clicks = (o.clicks || 0) + r.clicks;
    });
    var list = el('div', { className: 'ins-table', role: 'table', 'aria-label': t('insightsFrom') }, [
      el('div', { className: 'ins-row ins-head', role: 'row' }, [
        el('span', { role: 'columnheader' }),
        el('span', { role: 'columnheader' }),
        el('span', { role: 'columnheader', textContent: t('insightsViews') }),
        el('span', { role: 'columnheader', textContent: t('insightsClicks') }),
        el('span', { role: 'columnheader', textContent: t('insightsRateShort') })
      ])
    ]);
    rows.forEach(function (r, i) {
      list.appendChild(el('div', { className: 'ins-row', role: 'row' }, [
        el('span', { className: 'stats-rank', role: 'cell', textContent: r.other ? '' : String(i + 1) }),
        el('span', { className: 'stats-name', role: 'cell', textContent: r.other ? t('insightsOther') : sourceName(r) }),
        el('span', { className: 'stats-n', role: 'cell', textContent: num(r.views) }),
        el('span', { className: 'stats-n', role: 'cell', textContent: num(r.clicks) }),
        el('span', { className: 'stats-n', role: 'cell', textContent: rate(r.clicks, r.views) })
      ]));
    });
    return card([
      el('h2', { className: 'lists-title', textContent: t('insightsFrom') }),
      list,
      /* The clicks that have no source, said rather than left as rows that
         quietly add up to less than the figure at the top. */
      d.untold ? el('p', { className: 'ins-note', textContent: t('insightsUntold') }) : null
    ]);
  }

  /* A ranking of one number, as /admin/stats draws them. */
  function ranking(title, rows, name) {
    var ol = el('ol', { className: 'stats-list ins-list' });
    rows.forEach(function (r, i) {
      ol.appendChild(el('li', { className: 'stats-row' }, [
        el('span', { className: 'stats-rank', textContent: r.other ? '' : String(i + 1) }),
        el('span', { className: 'stats-who' }, [
          el('span', { className: 'stats-name', textContent: r.other ? t('insightsOther') : name(r) })
        ]),
        el('span', { className: 'stats-n', textContent: num(r.n) })
      ]));
    });
    return card([el('h2', { className: 'lists-title', textContent: title }), ol]);
  }

  /* ----------------------------------------------------------- the states */

  function page() {
    var d = state.data;
    var address = '/u/' + encodeURIComponent(state.user);
    var stack = el('div', { className: 'lists-stack' });

    var head = [
      el('p', { className: 'eyebrow', textContent: t('insightsEyebrow') }),
      el('h1', { className: 'lists-title', textContent: t('insightsTitle') }),
      el('p', { className: 'lists-say', textContent: t('insightsWhat', { page: window.location.host + address }) })
    ];

    /* Before profile_counts is applied there is nothing to show and nothing
       to choose between. */
    if (!d) {
      head.push(el('p', { className: 'lists-none', textContent: t('insightsOff') }));
      stack.appendChild(card(head));
      return stack;
    }

    /* Never opened: no ranges to choose between and no noughts compared
       with noughts — the one thing that changes it, and nothing else. */
    if (!d.ever) {
      head.push(el('p', { className: 'lists-none', textContent: t('insightsNone') }));
      stack.appendChild(card(head));
      return stack;
    }

    head.push(ranges());
    head.push(figures());
    head.push(chart());
    stack.appendChild(card(head));

    /* Opened, but not in this range: the line says so on its own — flat —
       and a sentence stands where the tables would. */
    if (!d.views) {
      stack.appendChild(card([el('p', { className: 'lists-none', textContent: t('insightsQuiet', { days: d.span }) })]));
      return stack;
    }

    stack.appendChild(sources());
    /* Nothing pressed is no table rather than a heading over nothing. */
    if (d.press.length) {
      stack.appendChild(ranking(t('insightsPressed'), d.press, function (r) { return r.name; }));
    }
    stack.appendChild(ranking(t('insightsCountry'), topOf(d.country, function (o, r) { o.n = (o.n || 0) + r.n; }),
      function (r) { return countryName(r.id); }));
    return stack;
  }

  function signedOut() {
    return card([
      el('p', { className: 'eyebrow', textContent: t('accountOpen') }),
      el('h1', { className: 'lists-title', textContent: t('insightsTitle') }),
      el('p', { className: 'lists-say', textContent: t('insightsSignedOut') }),
      el('p', { className: 'lists-row lists-foot' }, [
        TTBTrack.click(el('a', { className: 'go', href: SHEET + 'up' + BACK, textContent: t('accountCreate') }), 'account_open', { view: 'up' }),
        TTBTrack.click(el('a', { className: 'alt', href: SHEET + 'in' + BACK, textContent: t('accountSignIn') }), 'account_open', { view: 'in' })
      ])
    ]);
  }

  function switchedOff() {
    return card([
      el('p', { className: 'eyebrow', textContent: t('accountOpen') }),
      el('h1', { className: 'lists-title', textContent: t('insightsTitle') }),
      el('p', { className: 'lists-say', textContent: t(state.reached ? 'accountErrOff' : 'accountErrReach') }),
      el('p', { className: 'lists-row lists-foot' }, [
        TTBTrack.click(el('a', { className: 'alt', href: '/', textContent: t('backToMap') }), 'home')
      ])
    ]);
  }

  function render() {
    clear(main);
    if (!state.ready || !state.user) {
      main.appendChild(el('div', { className: 'lists-stack' }, [state.ready ? signedOut() : switchedOff()]));
      return;
    }

    var view = document.getElementById('insights-view');
    view.href = '/u/' + encodeURIComponent(state.user);
    view.hidden = false;

    main.appendChild(page());
  }

  /* ------------------------------------------------------------------- boot */

  /* The range in the address, kept there so a reload lands on it. Seven days
     where there is none, which is the route's own default. */
  function wantedSpan() {
    var raw = new URLSearchParams(window.location.search).get('days');
    var n = raw === null || raw === '' ? NaN : Number(raw);
    return SPANS.indexOf(n) !== -1 ? n : SPANS[0];
  }

  /* One range asked for and drawn. The page that was there stays until the
     answer is in, so a press on a chip does not flash an empty card. */
  function load(span) {
    return ask(API + '?days=' + span).then(function (answer) { show(answer, span); });
  }

  function show(answer, span) {
    state.reached = answer.status !== 0;
    state.ready = !!answer.out.ready;
    state.user = answer.out.user || null;
    state.data = answer.out.insights || null;
    state.span = state.data ? state.data.span : span;

    var url = new URL(window.location.href);
    if (state.span === SPANS[0]) url.searchParams.delete('days');
    else url.searchParams.set('days', String(state.span));
    if (url.href !== window.location.href) history.replaceState(null, '', url.href);

    render();
  }

  function boot() {
    main = document.getElementById('main');
    applyStyle();

    /* The strings and the numbers at once; nothing is drawn until both are
       in, so the page paints once. */
    var span = wantedSpan();
    Promise.all([getJSON(UI_URL), ask(API + '?days=' + span)]).then(function (loaded) {
      state.ui = loaded[0] || {};
      state.lang = pickLanguage(Object.keys(state.ui).sort());
      applyStaticStrings();
      document.title = t('insightsDocumentTitle');
      show(loaded[1], span);
    }).catch(function () {
      state.ui = {};
      state.reached = false;
      render();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
