/* Tallinn Tastebuds — /admin/found, how people found the site.
 *
 * The question the owner asked was which words people typed to find the
 * site, and the first thing this page has to say is that no code on this
 * site can see them: Google, Bing and the rest keep the words to themselves,
 * and a browser cuts a link from another site down to that site's name
 * unless the site says otherwise. So the page is drawn out of what does
 * arrive, in the order it is asked about. Four figures for the range —
 * visitors from a search engine, from a link on another site, pages opened
 * by a tagged link — one of the owner's own, or a Share button's — and
 * searches typed into the site's own fields — then which search engine, the
 * address each search visitor landed on (the nearest honest stand-in for the
 * words: `/?lang=ru` is a search in Russian), the pages elsewhere that linked
 * here, the tagged links, and last the words typed into the site's own
 * search fields, with the ones that found nothing marked.
 *
 * WHERE THE NUMBERS COME FROM
 *
 * assets/track.js sends them with the two reports every page already makes,
 * and functions/api/_visitors.js counts them — HOW THEY FOUND IT there is
 * what each one is, and what is deliberately not kept. This page only reads,
 * from /api/admin/found, which only the owner can. It is /admin/visitors'
 * shape and borrows its classes out of assets/stats.css: one request on the
 * way in with the words beside the numbers, and a press on a range asks
 * again and redraws, the range kept in the address so a reload lands on it.
 *
 * Plain browser JavaScript, one IIFE, ES5, the same as every file in assets/.
 */
(function () {
  'use strict';

  var API = '/api/admin/found';

  var STYLES = ['red', 'green'];
  var DEFAULT_STYLE = 'red';
  var STYLE_KEY = 'ttb.style';
  var LANG_KEY = 'ttb.lang';
  var DEFAULT_LANG = 'en';

  /* The ranges, as the route answers them — SPANS in
     functions/api/_visitors.js is the other copy. 1 is today so far. */
  var SPANS = [1, 7, 28, 90];
  var DEFAULT_SPAN = 7;

  /* How many rows a list names before the rest are one line of Other. More
     than /admin/visitors' eight, because the words and the addresses are the
     point of this page and the long tail is where the surprises are. */
  var TOP = 15;

  /* The search engines by the id ENGINES in functions/api/_visitors.js files
     them under. Names rather than words, so they are not in data/ui.json. */
  var ENGINES = {
    google: 'Google', bing: 'Bing', duckduckgo: 'DuckDuckGo',
    yandex: 'Yandex', ecosia: 'Ecosia', yahoo: 'Yahoo'
  };

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

  function num(n) {
    try {
      return new Intl.NumberFormat(state.lang, { maximumFractionDigits: 0 }).format(n);
    } catch (e) {
      return String(Math.round(n));
    }
  }

  function dateLabel(day) {
    try {
      return new Intl.DateTimeFormat(state.lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
        .format(new Date(day + 'T00:00:00Z'));
    } catch (e) {
      return day;
    }
  }

  function engineName(id) {
    return ENGINES[id] || t('foundEngineOther');
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

  /* The change on the range before, in words, or nothing for today —
     against() in assets/visitors.js. */
  function against(key) {
    var d = state.data;
    if (!d.before) return null;
    var diff = d.now[key] - d.before[key];
    return diff > 0 ? t('insightsMore', { n: num(diff), days: d.span })
         : diff < 0 ? t('insightsFewer', { n: num(-diff), days: d.span })
         : t('insightsSame', { days: d.span });
  }

  function figure(label, key) {
    return el('div', { className: 'ins-kpi' }, [
      el('dt', { className: 'eyebrow', textContent: label }),
      el('dd', null, [
        el('div', { className: 'ins-kpi-n', textContent: num(state.data.now[key]) }),
        against(key) ? el('div', { className: 'ins-kpi-was', textContent: against(key) }) : null
      ])
    ]);
  }

  function figures() {
    return el('dl', { className: 'ins-kpis vis-kpis vis-kpis-4' }, [
      figure(t('foundFromSearch'), 'search'),
      figure(t('foundFromSites'), 'sites'),
      figure(t('foundTagged'), 'tags'),
      figure(t('foundSearches'), 'searches')
    ]);
  }

  /* A ranking of one number, as /admin/visitors draws them, with a line
     under a name where `under` gives one. `mono` for names that are
     addresses or words somebody typed rather than the site's own words. */
  function ranked(rows, name, under, mono) {
    var shown = rows;
    if (rows.length > TOP + 1) {
      var other = { other: true, n: 0 };
      rows.slice(TOP).forEach(function (r) { other.n += r.n; });
      shown = rows.slice(0, TOP).concat([other]);
    }
    var ol = el('ol', { className: 'stats-list ins-list' });
    shown.forEach(function (r, i) {
      var below = r.other || !under ? '' : under(r);
      ol.appendChild(el('li', { className: 'stats-row' }, [
        el('span', { className: 'stats-rank', textContent: r.other ? '' : String(i + 1) }),
        el('span', { className: 'stats-who' }, [
          el('span', { className: r.other || !mono ? 'stats-name' : 'stats-name vis-id',
            textContent: r.other ? t('insightsOther') : name(r) }),
          below ? el('span', { className: 'stats-where', textContent: below }) : null
        ]),
        el('span', { className: 'stats-n', textContent: num(r.n) })
      ]));
    });
    return ol;
  }

  /* A card: a title, a sentence under it where the numbers need one, and the
     ranking, or `empty` in its place when there are no rows. */
  function section(title, lead, rows, draw, empty) {
    return card([
      el('h2', { className: 'lists-title', textContent: title }),
      lead ? el('p', { className: 'ins-note', textContent: lead }) : null,
      rows.length ? draw(rows) : el('p', { className: 'lists-none', textContent: empty })
    ]);
  }

  function engines(rows) {
    return ranked(rows, function (r) { return engineName(r.id); });
  }

  function lands(rows) {
    return ranked(rows, function (r) { return r.at; }, function (r) { return engineName(r.engine); }, true);
  }

  function refs(rows) {
    return ranked(rows, function (r) { return r.id; }, null, true);
  }

  /* The tags as they were counted. `share` is the site's own rather than the
     owner's — the Share buttons put it on every link they hand out — and
     says so on a line under it. */
  function tags(rows) {
    return ranked(rows, function (r) { return r.id; },
      function (r) { return r.id === 'share' ? t('foundTagShare') : ''; }, true);
  }

  function words(rows) {
    return ranked(rows, function (r) { return r.id; },
      function (r) { return r.nothing ? t('foundNothing', { n: num(r.nothing) }) : ''; }, true);
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

    var stack = el('div', { className: 'lists-stack' });
    stack.appendChild(card([
      ranges(),
      figures(),
      d.span === 1 ? el('p', { className: 'ins-note', textContent: t('visitorsSoFar') }) : null
    ]));

    if (!d.since) {
      stack.appendChild(card([el('p', { className: 'lists-none', textContent: t('foundNone') })]));
    } else {
      var quiet = t('foundQuiet');
      stack.appendChild(section(t('foundEngines'), null, d.engines, engines, quiet));
      stack.appendChild(section(t('foundLands'), t('foundLandsNote'), d.lands, lands, quiet));
      stack.appendChild(section(t('foundWords'), t('foundWordsNote'), d.searches, words, quiet));
      stack.appendChild(section(t('foundRefs'), t('foundRefsNote'), d.refs, refs, quiet));
    }
    /* The tagged links keep their card with nothing in it, because the
       sentence saying how to make one is the part worth reading first. */
    stack.appendChild(section(t('foundTags'), t('foundTagsHow'), d.tags || [], tags, t('foundQuiet')));

    stack.appendChild(el('div', { className: 'stats-totals' }, [
      d.since ? note('foundSince', { date: dateLabel(d.since) }) : null,
      note('foundFoot'),
      note('visitorsOwnerFoot')
    ]));
    main.appendChild(stack);
  }

  /* ------------------------------------------------------------------ start */

  function wantedSpan() {
    var n = Number(new URLSearchParams(window.location.search).get('days'));
    return SPANS.indexOf(n) !== -1 ? n : DEFAULT_SPAN;
  }

  /* One range asked for and drawn — load() in assets/visitors.js: what was
     on screen stays until the answer is in, and an answer with no words
     leaves the markup's English standing rather than printing keys. */
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
        document.title = t('foundDocumentTitle');
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
