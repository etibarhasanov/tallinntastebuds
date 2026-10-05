/* Tallinn Tastebuds — /admin/visitors, who came to the site and what they did.
 *
 * The page Google Analytics is open in a tab for, drawn from the site's own
 * count instead. Right now and today so far first, whatever the range: who
 * came, who signed in and made an account, and on which of the map's two
 * rails. Then a range and its five figures, and under them four groups, each
 * under a heading — see group():
 *
 *   Tests            the directory's two looks, the four colours, then
 *                    the map's two rails
 *   Who they are     a bar a day, new against returning, a bar an hour,
 *                    phone against desktop, countries, languages
 *   How they found it  where they came from, where search landed them
 *   What they did    signing up, pages, journeys, presses, and which
 *                    stories, posts, decks and discounts were opened
 *
 * It was one column of twenty cards in the order they were built, and the
 * tests sat twelfth; the owner went looking for one and could not find it.
 * The shape is the one /insights already has, because it is the same kind
 * of question and the owner has met that page; the rows, the figures and
 * the chart borrow its classes and /admin/stats' out of assets/stats.css.
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

  /* The last half hour, asked for on its own and again every LIVE_EVERY
     while the page is on screen — the one part of the page that is not the
     range's, and not cached. functions/api/admin/live.js. */
  var LIVE_API = '/api/admin/live';
  var LIVE_EVERY = 60 * 1000;

  var STYLES = ['red', 'green', 'blue', 'plum'];
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

  /* The directory's two looks by the id pickLook() in assets/lists.js deals
     them — a test apart from the rails. */
  var LOOKS = { a: 'visitorsLookA', b: 'visitorsLookB' };

  /* And the four colours by the id dealStyle() in assets/track.js deals them,
     named by the words the swatch itself uses. */
  var COLOURS = { red: 'styleRed', green: 'styleGreen', blue: 'styleBlue', plum: 'stylePlum' };

  /* How many strangers each rail needs before the two are set against each
     other at all. Thirty is where a share out of them stops swinging ten
     points on one visitor; below it the page says it is too early rather
     than print a verdict on four against five. */
  var FEWEST = 30;

  var SOURCES = { search: 'insightsSearch', here: 'insightsHere', direct: 'insightsDirect' };

  /* What a browser is driven with, by the ids assets/track.js decides. */
  var DEVICES = { phone: 'visitorsPhone', tablet: 'visitorsTablet', desktop: 'visitorsDesktop' };

  /* Signing up — SIGNING UP in functions/api/_visitors.js. The three views
     of the sheet, which are the table's columns; what put the sheet up, by
     the door in account_from_<door>; and the refusals by the word
     /api/account answered, the five that are the site's own fault sharing
     one line, since the owner's question about them is the same. A word
     not here is drawn as itself. */
  var SIGN_VIEWS = ['up', 'in', 'google'];
  var DOORS = {
    rail: 'visitorsFromRail', nudge: 'visitorsFromNudge', deal: 'visitorsFromDeal',
    keep: 'visitorsFromKeep', expired: 'visitorsFromExpired', link: 'visitorsFromLink',
    google: 'visitorsFromGoogle'
  };
  var REFUSALS = {
    taken: 'visitorsErrTaken', username: 'visitorsErrUsername', password: 'visitorsErrPassword',
    no_match: 'visitorsErrNoMatch', slow_down: 'visitorsErrSlow', no_pending: 'visitorsErrPending',
    linked: 'visitorsErrLinked', network: 'visitorsErrNetwork', generic: 'visitorsErrGeneric',
    malformed: 'visitorsErrSite', no_database: 'visitorsErrSite', no_salt: 'visitorsErrSite',
    wrong_database: 'visitorsErrSite'
  };

  var state = { lang: DEFAULT_LANG, ui: {}, data: null, live: null };

  var main = null;

  /* The Right now card: one node for the life of the page, so a redraw of
     the range puts the same card back and a refresh of the last half hour
     redraws only it. */
  var liveCard = null;

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

  /* A country by its two letters, named in the reading language —
     assets/country.js, loaded before this file. */
  function countryName(code) {
    return TTBCountry.name(code, state.lang, t('insightsUnknown'));
  }

  /* A language by its code, named the same way, so data/ui.json needs no
     word for each of the ten. */
  function languageName(code) {
    try {
      return new Intl.DisplayNames([state.lang], { type: 'language' }).of(code) || code;
    } catch (e) {
      return code;
    }
  }

  function switchName(r) {
    var pair = r.id.split('>');
    return languageName(pair[0]) + ' → ' + languageName(pair[1]);
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

  /* Page views by the hour of the day in Tallinn, over the range — WHEN THEY
     COME in functions/api/_visitors.js. One bar an hour, the foot marked
     every six, and no card at all while every hour is nought. */
  function hours() {
    var bars = state.data.hours;
    var W = 340, H = 150, L = 30, R = 4, T = 10, B = 118;
    var max = 0;
    bars.forEach(function (n) { if (n > max) max = n; });
    if (!max) return null;
    var top = ceiling(max);
    var slot = (W - R - L) / bars.length;
    var wide = Math.max(2, slot * 0.7);
    var y = function (n) { return B - (B - T) * n / top; };
    var label = function (h) { return (h < 10 ? '0' : '') + h + ':00'; };

    var kids = [];
    [0, top / 2, top].forEach(function (v) {
      kids.push(svg('line', { 'class': 'ins-grid', x1: L, x2: W - R, y1: y(v), y2: y(v) }));
      kids.push(svg('text', { x: L - 6, y: y(v) + 3.5, 'text-anchor': 'end' }, [num(v)]));
    });
    bars.forEach(function (n, i) {
      if (!n) return;
      kids.push(svg('rect', { 'class': 'vis-new', x: (L + slot * i + (slot - wide) / 2).toFixed(1),
        width: wide.toFixed(1), y: y(n).toFixed(1), height: (B - y(n)).toFixed(1) }));
    });
    for (var h = 0; h < bars.length; h += 6) {
      kids.push(svg('text', { x: (L + slot * (h + 0.5)).toFixed(1), y: B + 18, 'text-anchor': 'middle' }, [label(h)]));
    }
    var said = bars.map(function (n, i) { return label(i) + ': ' + num(n); }).join('; ');
    return card([
      el('h2', { className: 'lists-title', textContent: t('visitorsHours') }),
      el('p', { className: 'stats-lead', textContent: t('visitorsHoursLead') }),
      svg('svg', { 'class': 'ins-chart', viewBox: '0 0 ' + W + ' ' + H, role: 'img',
        'aria-label': t('visitorsHoursAria', { list: said }) }, kids)
    ]);
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
  function ranked(rows, name, mono) {
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
    return ol;
  }

  /* A few counts in an order that means something — the steps of a trip —
     rather than most first, so drawn without the rank beside each. */
  function listed(rows) {
    var ol = el('ol', { className: 'stats-list ins-list' });
    rows.forEach(function (r) {
      ol.appendChild(el('li', { className: 'stats-row' }, [
        el('span', { className: 'stats-rank' }),
        el('span', { className: 'stats-who' }, [el('span', { className: 'stats-name', textContent: r.name })]),
        el('span', { className: 'stats-n', textContent: num(r.n) })
      ]));
    });
    return ol;
  }

  /* The same, as a card of its own under a title. */
  function ranking(title, rows, name, mono) {
    return card([el('h2', { className: 'lists-title', textContent: title }), ranked(rows, name, mono)]);
  }

  /* A table of a name and two numbers — the grid /insights draws its
     sources in. `heads` names the two columns, `cells` gives a row's. */
  function grid(label, heads, rows, name, cells) {
    var table = el('div', { className: 'ins-table vis-table' +
      (heads.length > 3 ? ' vis-table-4' : heads.length > 2 ? ' vis-table-3' : ''),
      role: 'table', 'aria-label': label }, [
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

  /* Which stories, posts, decks and discounts — WHAT IT WAS ABOUT in
     functions/api/_visitors.js: the stories with how many came up and how
     many were watched to the end, the posts and the decks as rankings, and
     the discounts with the passes shown and the scans that said yes. Each
     under the name its page wears in the pages table, and by the id in the
     file it ships in, which reads as what it is. Left out until any of it
     has been counted, and on an answer from before it was. */
  function whatOpened() {
    var a = state.data.about;
    if (!a || !(a.stories.length || a.posts.length || a.decks.length || a.deals.length)) return null;
    var id = function (r) { return r.id; };
    var under = function (key) { return el('h3', { className: 'eyebrow vis-sub', textContent: t(key) }); };
    var kids = [
      el('h2', { className: 'lists-title', textContent: t('visitorsAbout') }),
      el('p', { className: 'stats-lead', textContent: t('visitorsAboutLead') })
    ];
    if (a.stories.length) {
      kids.push(under('storiesTitle'), grid(t('storiesTitle'), [t('visitorsCameUp'), t('visitorsWatched')], a.stories, id,
        function (r) { return [num(r.up), num(r.watched)]; }));
    }
    if (a.posts.length) kids.push(under('blogTitle'), ranked(a.posts, id));
    if (a.decks.length) kids.push(under('flashDoor'), ranked(a.decks, id));
    if (a.deals.length) {
      kids.push(under('passTitle'), grid(t('passTitle'), [t('visitorsOfferShown'), t('visitorsVerified')], a.deals, id,
        function (r) { return [num(r.shown), num(r.verified)]; }));
    }
    return card(kids);
  }

  /* The pages, each with its views, the time a view stayed and the share of
     views on which nothing was pressed. Time is over the views that reported
     how they ended where a page has any — THE VIEWS THAT REPORTED in
     functions/api/_visitors.js — and over every view before that count
     began, and the line under the table says how many reported at all. */
  function pages() {
    var rows = state.data.pages;
    var views = 0;
    var left = 0;
    rows.forEach(function (p) { views += p.views; left += p.left; });
    return card([
      el('h2', { className: 'lists-title', textContent: t('visitorsPages') }),
      grid(t('visitorsPages'), [t('insightsViews'), t('visitorsTimeShort'), t('visitorsIdle')], rows,
        function (p) { return p.name; },
        function (p) {
          return [
            num(p.views),
            duration(p.left ? per(p.secsLeft, p.left) : per(p.secs, p.views)),
            p.left ? share(p.idle, p.left) : '—'
          ];
        }),
      left ? el('p', { className: 'ins-note', textContent: t('visitorsReported', { share: share(left, views) }) }) : null
    ]);
  }

  /* Where a visit begins and which page follows which — WHERE A VISIT
     BEGINS, AND WHERE IT GOES in functions/api/_visitors.js. Left out until
     either has a row. */
  function journeys() {
    var d = state.data;
    if (!d.entries.length && !d.moves.length) return null;
    var kids = [
      el('h2', { className: 'lists-title', textContent: t('visitorsJourneys') }),
      el('p', { className: 'stats-lead', textContent: t('visitorsJourneysLead') })
    ];
    if (d.entries.length) {
      kids.push(el('h3', { className: 'eyebrow vis-sub', textContent: t('visitorsLanding') }),
        ranked(d.entries, function (r) { return r.name; }));
    }
    if (d.moves.length) {
      kids.push(el('h3', { className: 'eyebrow vis-sub', textContent: t('visitorsNext') }),
        ranked(d.moves, function (r) { return r.from + ' → ' + r.to; }));
    }
    return card(kids);
  }

  /* Today so far, whatever the range: four figures, and under them new and
     returning visitors, sign-ins and accounts made for each rail and for the
     visitors no rail has been dealt to yet — the one place the page answers
     "who came today, and on which rail". */
  function today() {
    var d = state.data.today;
    var cols = ['a', 'b', 'none'];
    var rows = [
      [t('visitorsNew'), 'fresh'],
      [t('visitorsReturning'), 'back'],
      [t('visitorsSignIns'), 'login'],
      [t('visitorsSignUps'), 'signup']
    ];
    return card([
      el('h2', { className: 'lists-title', textContent: t('visitorsTodayHead') }),
      el('dl', { className: 'ins-kpis vis-kpis vis-kpis-4' }, [
        figure(t('visitorsVisitors'), num(d.fresh + d.back), null),
        figure(t('visitorsNew'), num(d.fresh), null),
        figure(t('visitorsSignIns'), num(d.login), null),
        figure(t('visitorsSignUps'), num(d.signup), null)
      ]),
      grid(t('visitorsTodayHead'), [t(RAILS.a), t(RAILS.b), t('visitorsNoRail')], rows,
        function (r) { return r[0]; },
        function (r) { return cols.map(function (c) { return num(d.rails[c][r[1]]); }); })
    ]);
  }

  /* Signing up, over the range: how far people got with the sheet and the
     forms, and where they stopped — SIGNING UP in functions/api/_visitors.js.
     A table of the three views of the sheet by the four things that happen
     on one, then why the button was refused, what put the sheet up, the
     trip to Google and back, the offer over the map, and the pages people
     got in on. Each part is left out while it is all noughts, and the card
     while everything is, which is every range from before it began. */
  function signingUp() {
    var s = state.data.signup || {};
    var n = function (name) { return s[name] || 0; };
    if (!Object.keys(s).some(function (k) { return s[k] > 0; })) return null;

    var starting = function (prefix, labels) {
      var sum = {};
      Object.keys(s).forEach(function (k) {
        if (k.indexOf(prefix) !== 0 || !(s[k] > 0)) return;
        var word = k.slice(prefix.length);
        var name = labels[word] ? t(labels[word]) : word;
        sum[name] = (sum[name] || 0) + s[k];
      });
      return Object.keys(sum).map(function (name) { return { id: name, n: sum[name] }; })
        .sort(function (a, b) { return b.n - a.n || a.id.localeCompare(b.id); });
    };
    var byName = function (r) { return r.id; };

    var kids = [
      el('h2', { className: 'lists-title', textContent: t('visitorsSignup') }),
      el('p', { className: 'stats-lead', textContent: t('visitorsSignupLead') }),
      grid(t('visitorsSignup'), [t('accountCreate'), t('accountSignIn'), t('visitorsSignupNaming')], [
        [t('visitorsSignupOpened'), 'sheet'],
        [t('visitorsSignupTried'), 'try'],
        [t('visitorsSignupDone'), 'done'],
        [t('visitorsSignupLeft'), 'leave']
      ], function (r) { return r[0]; }, function (r) {
        return SIGN_VIEWS.map(function (v) { return num(n('account_' + r[1] + '_' + v)); });
      })
    ];
    if (n('account_left_err')) {
      kids.push(el('p', { className: 'ins-note', textContent: t('visitorsSignupLeftErr', { n: num(n('account_left_err')) }) }));
    }

    var refused = starting('account_err_', REFUSALS);
    if (refused.length) {
      kids.push(el('h3', { className: 'eyebrow vis-sub', textContent: t('visitorsSignupRefused') }),
        ranked(refused, byName));
    }
    var doors = starting('account_from_', DOORS);
    if (doors.length) {
      kids.push(el('h3', { className: 'eyebrow vis-sub', textContent: t('visitorsSignupFrom') }),
        ranked(doors, byName));
    }

    /* Everybody sent to Google less everybody who came back, however they
       came back, is the people who never did. */
    var out = n('google_out');
    var backs = ['in', 'name', 'cancel', 'failed'];
    var back = 0;
    backs.forEach(function (w) { back += n('google_back_' + w); });
    if (out || back) {
      kids.push(el('h3', { className: 'eyebrow vis-sub', textContent: t('accountGoogle') }), listed([
        { name: t('visitorsGoogleOut'), n: out },
        { name: t('visitorsGoogleIn'), n: n('google_back_in') },
        { name: t('visitorsGoogleName'), n: n('google_back_name') },
        { name: t('visitorsGoogleCancel'), n: n('google_back_cancel') },
        { name: t('visitorsGoogleFailed'), n: n('google_back_failed') },
        { name: t('visitorsGoogleLost'), n: Math.max(0, out - back) }
      ]));
    }

    /* Turned down is what is left of the offers shown once the taken and
       the faded are out of them: `account_nudge` reports it with a
       parameter the count does not keep. */
    var shown = n('account_nudge_shown');
    if (shown) {
      var taken = n('account_from_nudge');
      var faded = n('account_nudge_faded');
      kids.push(el('h3', { className: 'eyebrow vis-sub', textContent: t('visitorsFromNudge') }), listed([
        { name: t('visitorsOfferShown'), n: shown },
        { name: t('visitorsOfferTaken'), n: taken },
        { name: t('nudgeLater'), n: Math.max(0, shown - taken - faded) },
        { name: t('visitorsOfferFaded'), n: faded }
      ]));
    }

    if (state.data.made && state.data.made.length) {
      kids.push(el('h3', { className: 'eyebrow vis-sub', textContent: t('visitorsSignupMade') }),
        ranked(state.data.made, function (r) { return r.name; }));
    }
    kids.push(el('p', { className: 'ins-note', textContent: t('visitorsSignupFoot') }));
    return card(kids);
  }

  /* The per-visitor rows the two cards below share, as [label, of(row)]
     over a row carrying `visitors` and the facts _visitors.js counts. */
  function perVisitor() {
    return [
      [t('visitorsPagesPer'), function (r) { return num(per(r.views, r.visitors), 1); }],
      [t('visitorsTime'), function (r) { return duration(per(r.secs, r.visitors)); }],
      [t('visitorsPresses'), function (r) { return num(per(r.presses, r.visitors), 1); }],
      [t('visitorsPlaces'), function (r) { return num(per(r.places, r.visitors), 1); }],
      [t('visitorsSignIns'), function (r) { return num(r.login); }],
      [t('visitorsSignUps'), function (r) { return num(r.signup); }]
    ];
  }

  /* A line saying from when a card's numbers run, where that is inside the
     range — the range reaching back past the day they began. */
  function splitSince() {
    var d = state.data;
    if (!d.split || d.split <= d.from) return null;
    return el('p', { className: 'ins-note', textContent: t('visitorsSplitSince', { date: dateLabel(d.split, true) }) });
  }

  /* A figure per row, a column for each of a set of rows. */
  function sideBySide(label, cols, heads, rows) {
    return grid(label, heads, rows,
      function (f) { return f[0]; },
      function (f) { return cols.map(f[1]); });
  }

  /* What a new visitor does against a returning one, per visitor, over the
     days that tell them apart. Absent until either has been counted. */
  function cohorts() {
    var cols = state.data.cohorts;
    if (!cols.some(function (c) { return c.visitors; })) return null;
    var heads = cols.map(function (c) { return t(c.id === 'new' ? 'visitorsNew' : 'visitorsReturning'); });
    var rows = [[t('visitorsVisitors'), function (c) { return num(c.visitors); }]].concat(perVisitor());
    return card([
      el('h2', { className: 'lists-title', textContent: t('visitorsCohorts') }),
      el('p', { className: 'stats-lead', textContent: t('visitorsCohortsLead') }),
      sideBySide(t('visitorsCohorts'), cols, heads, rows),
      splitSince()
    ]);
  }

  /* The languages, new visitors against returning ones: how many arrived in
     each, and how long the site was read in each. Time follows a switch, so
     the minutes of somebody who arrived in English and changed to Russian
     are English's up to the switch and Russian's after it. Two tables of a
     language a row rather than one of four columns, which would not fit
     across a phone. Under them, the languages browsers asked for, spoken
     here or not — WHICH LANGUAGE THE BROWSER ASKED FOR in
     functions/api/_visitors.js — with the ones the site lacks marked, since
     that is what the list is for. The tables ride on the put-away report
     and the list on the page opening, so either can have rows while the
     other has none. */
  function languages() {
    var rows = state.data.languages;
    var asked = state.data.asked;
    var heads = [t('visitorsNew'), t('visitorsReturning')];
    var name = function (l) { return languageName(l.id); };
    var kids = [
      el('h2', { className: 'lists-title', textContent: t('visitorsLanguages') }),
      el('p', { className: 'stats-lead', textContent: t('visitorsLanguagesLead') })
    ];
    if (rows.length) {
      kids.push(
        el('h3', { className: 'eyebrow vis-sub', textContent: t('visitorsVisitors') }),
        grid(t('visitorsVisitors'), heads, rows, name,
          function (l) { return [num(l.visitors.new), num(l.visitors.back)]; }),
        el('h3', { className: 'eyebrow vis-sub', textContent: t('visitorsTimeShort') }),
        grid(t('visitorsTimeShort'), heads, rows, name,
          function (l) { return [duration(l.secs.new), duration(l.secs.back)]; }));
    }
    if (asked.length) {
      kids.push(
        el('h3', { className: 'eyebrow vis-sub', textContent: t('visitorsAsked') }),
        ranked(asked, function (a) {
          return languageName(a.id) + (a.spoken ? '' : ' · ' + t('visitorsNotSpoken'));
        }));
    }
    return card(kids);
  }

  /* Whether the two arms of a test — the rails, the directory's looks, or
     the best and worst of the four colours —
     opened something at rates that differ by more than chance: a
     two-proportion z-test on `opened` out of `given`, with 1.96 as the line,
     which is the ordinary 95%. Said in words, and only once each arm has
     FEWEST strangers — see there. `names` is the arms' keys, and `words`
     the test's own three sentences: early, none and ahead. */
  function verdict(dealt, names, words) {
    var a = dealt.a, b = dealt.b;
    var say = function (key, vars) { return el('p', { className: 'vis-verdict', textContent: t(key, vars) }); };
    if (Math.min(a.given, b.given) < FEWEST) {
      return say(words[0], { a: num(a.given), b: num(b.given), min: FEWEST });
    }
    var pool = (a.opened + b.opened) / (a.given + b.given);
    var spread = Math.sqrt(pool * (1 - pool) * (1 / a.given + 1 / b.given));
    var z = spread ? (a.opened / a.given - b.opened / b.given) / spread : 0;
    var pa = share(a.opened, a.given), pb = share(b.opened, b.given);
    if (Math.abs(z) < 1.96) return say(words[1], { a: pa, b: pb });
    return z > 0 ? say(words[2], { name: t(names.a), ahead: pa, behind: pb })
                 : say(words[2], { name: t(names.b), ahead: pb, behind: pa });
  }

  /* The map's two rails against each other, in three blocks under one
     verdict: the strangers each was dealt to since the split began and how
     many found a place, everyone on each rail in the range, and the rail's
     new visitors alone. A row per figure and a column per rail, which is the
     one arrangement of these numbers that fits across a phone. Absent until
     either rail has had anybody. */
  function layouts() {
    var d = state.data;
    var rails = d.layouts.filter(function (r) { return RAILS[r.id]; });
    var dealt = d.dealt;
    var lived = rails.some(function (r) { return r.visitors; });
    if (!lived && !dealt.a.given && !dealt.b.given) return null;
    var heads = rails.map(function (r) { return t(RAILS[r.id]); });
    var visitors = [t('visitorsVisitors'), function (r) { return num(r.visitors); }];
    var block = function (key, cols, rows) {
      return [el('h3', { className: 'eyebrow vis-sub', textContent: t(key) }), sideBySide(t(key), cols, heads, rows)];
    };
    var kids = [
      el('h2', { className: 'lists-title', textContent: t('visitorsLayouts') }),
      el('p', { className: 'stats-lead', textContent: t('visitorsLayoutsLead') }),
      verdict(dealt, RAILS, ['visitorsVerdictEarly', 'visitorsVerdictNone', 'visitorsVerdictAhead'])
    ].concat(block('visitorsStrangers', rails, [
      [t('visitorsDealt'), function (r) { return num(dealt[r.id].given); }],
      [t('visitorsOpened'), function (r) { return share(dealt[r.id].opened, dealt[r.id].given); }]
    ]));
    if (lived) {
      kids = kids
        .concat(block('visitorsEveryone', rails, [visitors,
          [t('visitorsReturning'), function (r) { return share(r.back, r.visitors); }]].concat(perVisitor())))
        .concat(block('visitorsNewOnly', rails.map(function (r) { return r.fresh; }), [visitors].concat(perVisitor())))
        .concat([splitSince()]);
    }
    return card(kids);
  }

  /* The directory's two looks against each other — "The lists' two looks" in
     README.md: how many people new to the site were dealt each on their first
     open of /lists, and the share of them that opened a list from it, and
     that kept one, on the day they were dealt it. Since the test began, like
     the rails' strangers, because press_counts has no day. Opened is what
     the verdict is on; kept is beside it, too rare to call a test on. Drawn
     from the day the test began, noughts and all: a card that waited for its
     first newcomer was a test the owner went looking for and could not find. */
  function looks() {
    var d = state.data.looks;
    if (!d) return null;
    var arms = ['a', 'b'];
    var heads = arms.map(function (id) { return t(LOOKS[id]); });
    return card([
      el('h2', { className: 'lists-title', textContent: t('visitorsLooks') }),
      el('p', { className: 'stats-lead', textContent: t('visitorsLooksLead') }),
      verdict(d, LOOKS, ['visitorsLookEarly', 'visitorsLookNone', 'visitorsLookAhead']),
      el('h3', { className: 'eyebrow vis-sub', textContent: t('visitorsLooksNew') }),
      sideBySide(t('visitorsLooksNew'), arms, heads, [
        [t('visitorsLookDealt'), function (id) { return num(d[id].given); }],
        [t('visitorsLookOpened'), function (id) { return share(d[id].opened, d[id].given); }],
        [t('visitorsLookKept'), function (id) { return share(d[id].kept, d[id].given); }]
      ])
    ]);
  }

  /* The four colours against each other — "The four styles, dealt" in
     README.md, in three blocks under one verdict, the shape of the rails'
     card: how many people new to the site were dealt each as their first
     page opened, and the share of them that opened a place, a post or a
     deck that day, came back on a later day, and chose a different colour;
     then everyone dealt each colour in the range, with the per-visitor
     figures; then the colour's new visitors alone. Four arms rather than
     two, so the verdict sets the best colour on `opened` against the worst
     one, with the same z-test the other two cards use, and only once every
     colour has FEWEST — the weakest arm is the one that decides whether
     there is anything to say yet. Drawn from the day the test began,
     noughts and all, the way the lists' looks are — see looks(). */
  function colours() {
    var d = state.data.styles;
    var arms = Object.keys(COLOURS);
    var lived = (state.data.colours || []).filter(function (c) { return COLOURS[c.id]; });
    var anyLived = lived.some(function (c) { return c.visitors; });
    if (!d) return null;
    var heads = arms.map(function (id) { return t(COLOURS[id]); });
    var rate = function (id) { return d[id].given ? d[id].opened / d[id].given : 0; };
    var fewest = Math.min.apply(null, arms.map(function (id) { return d[id].given; }));
    var said;
    if (fewest < FEWEST) {
      said = el('p', { className: 'vis-verdict', textContent: t('visitorsStyleEarly', { n: num(fewest), min: FEWEST }) });
    } else {
      var ranked = arms.slice().sort(function (x, y) { return rate(y) - rate(x); });
      var best = ranked[0], worst = ranked[ranked.length - 1];
      said = verdict({ a: d[best], b: d[worst] }, { a: COLOURS[best], b: COLOURS[worst] },
        ['visitorsStyleEarly', 'visitorsStyleNone', 'visitorsStyleAhead']);
    }
    var kids = [
      el('h2', { className: 'lists-title', textContent: t('visitorsStyles') }),
      el('p', { className: 'stats-lead', textContent: t('visitorsStylesLead') }),
      said,
      el('h3', { className: 'eyebrow vis-sub', textContent: t('visitorsStylesNew') }),
      sideBySide(t('visitorsStylesNew'), arms, heads, [
        [t('visitorsStyleDealt'), function (id) { return num(d[id].given); }],
        [t('visitorsStyleOpened'), function (id) { return share(d[id].opened, d[id].given); }],
        [t('visitorsStyleBack'), function (id) { return share(d[id].back, d[id].given); }],
        [t('visitorsStyleChanged'), function (id) { return share(d[id].changed, d[id].given); }]
      ])
    ];
    if (anyLived) {
      var visitors = [t('visitorsVisitors'), function (c) { return num(c.visitors); }];
      var block = function (key, cols, rows) {
        return [el('h3', { className: 'eyebrow vis-sub', textContent: t(key) }), sideBySide(t(key), cols, heads, rows)];
      };
      kids = kids
        .concat(block('visitorsColoursEveryone', lived, [visitors,
          [t('visitorsReturning'), function (c) { return share(c.back, c.visitors); }]].concat(perVisitor())))
        .concat(block('visitorsNewOnly', lived.map(function (c) { return c.fresh; }), [visitors].concat(perVisitor())))
        .concat([splitSince()]);
    }
    return card(kids);
  }

  /* A heading and the cards under it, or nothing at all where every card
     came back empty — a heading over nothing reads as a section that failed
     to load. The heading is the quiet one .lists-section draws, because it
     names a run of cards rather than opening a page. */
  function group(stack, key, cards) {
    var drawn = cards.filter(function (c) { return c; });
    if (!drawn.length) return;
    stack.appendChild(el('h2', { className: 'lists-section vis-group', textContent: t(key) }));
    drawn.forEach(function (c) { stack.appendChild(c); });
  }

  /* Where they came from, with the way to the page that takes it apart. */
  function sources() {
    var d = state.data;
    if (!d.sources.length) return null;
    var box = ranking(t('insightsFrom'), d.sources, sourceName);
    /* What people searched for here, the pages elsewhere that linked here
       and the owner's own links are the page next door. */
    box.appendChild(el('p', { className: 'ins-note' }, [
      el('a', { href: '/admin/found', textContent: t('foundLink') })
    ]));
    return box;
  }

  /* Which address a search engine sent each of them to — FOUND BY A SEARCH
     ENGINE in functions/api/_visitors.js. The engine and the address as they
     were counted, in mono like the press names: an address is an id, and
     translating it would only hide which page it is. Under the sources,
     because it is the search row of that card taken apart. */
  function found() {
    var d = state.data;
    if (!d.found || !d.found.length) return null;
    return ranking(t('visitorsFound'), d.found, function (r) { return r.id; }, true);
  }

  /* Right now: pages opened in the last five minutes and the last thirty,
     and a bar for each of those thirty minutes, the one still going at the
     right. Pages rather than people — THE LAST HALF HOUR in
     functions/api/_visitors.js says why — which the line under it says too.
     Hidden, rather than drawn empty, where the route has no table yet. */
  function drawLive() {
    clear(liveCard);
    var mins = state.live;
    liveCard.hidden = !mins;
    if (!mins) return;
    var sum = function (list) { return list.reduce(function (a, n) { return a + n; }, 0); };
    var all = sum(mins);

    var W = 340, H = 64, B = 44, T = 4;
    var top = Math.max(1, Math.max.apply(null, mins));
    var slot = W / mins.length;
    var bars = [];
    mins.forEach(function (n, i) {
      if (!n) return;
      var h = (B - T) * n / top;
      bars.push(svg('rect', { 'class': 'vis-new', x: (slot * i + slot * 0.15).toFixed(1),
        width: (slot * 0.7).toFixed(1), y: (B - h).toFixed(1), height: h.toFixed(1) }));
    });
    bars.push(svg('line', { 'class': 'ins-grid', x1: 0, x2: W, y1: B, y2: B }));
    bars.push(svg('text', { x: 0, y: B + 16, 'text-anchor': 'start' }, [t('visitorsLiveAgo', { n: mins.length })]));
    bars.push(svg('text', { x: W, y: B + 16, 'text-anchor': 'end' }, [t('visitorsLiveNow')]));

    [
      el('h2', { className: 'lists-title', textContent: t('visitorsLiveHead') }),
      el('dl', { className: 'ins-kpis vis-kpis vis-kpis-2' }, [
        figure(t('visitorsLive5'), num(sum(mins.slice(-5))), null),
        figure(t('visitorsLive30'), num(all), null)
      ]),
      all ? svg('svg', { 'class': 'ins-chart', viewBox: '0 0 ' + W + ' ' + H, role: 'img',
        'aria-label': t('visitorsLiveAria', { list: mins.join(', ') }) }, bars) : null,
      el('p', { className: 'ins-note', textContent: t(all ? 'visitorsLiveLead' : 'visitorsLiveNone') })
    ].forEach(function (kid) { if (kid) liveCard.appendChild(kid); });
  }

  /* The last half hour asked for again. Quiet on any failure: the card keeps
     what it had, or stays hidden. */
  function loadLive() {
    fetch(LIVE_API, { headers: { accept: 'application/json' } })
      .then(function (res) { return res.json(); })
      .then(function (out) {
        state.live = out && out.ready ? out.minutes : null;
        drawLive();
      })
      .catch(function () { /* the card keeps what it had */ });
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
    stack.appendChild(liveCard);
    stack.appendChild(today());
    stack.appendChild(card([
      ranges(),
      el('h2', { className: 'lists-title vis-range-title', textContent: t('visitorsWhoCame') }),
      figures(),
      d.span === 1 ? el('p', { className: 'ins-note', textContent: t('visitorsSoFar') }) : null
    ]));

    if (!d.now.visitors && !d.now.views) {
      stack.appendChild(card([el('p', { className: 'lists-none', textContent: t('visitorsQuiet') })]));
    } else {
      /* Four groups under the range, each under a heading of its own, so the
         page is four things to look for rather than twenty cards in the
         order they were built. The tests first, straight under the figures:
         they are what a look at this page is most often for, and at the
         twelfth card they were found by scrolling past everything else. The
         short cards before the long inside it — the lists' looks is a few
         rows, the colours and the rails are three tables each — so the
         short one is not a screen and a half under the heading. A group
         with nothing in it draws no heading. */
      group(stack, 'visitorsTests', [looks(), colours(), layouts()]);
      group(stack, 'visitorsWho', [
        d.series ? card(chart()) : null,
        cohorts(),
        hours(),
        d.devices.length ? ranking(t('visitorsDevices'), d.devices, function (r) { return DEVICES[r.id] ? t(DEVICES[r.id]) : r.id; }) : null,
        d.countries.length ? ranking(t('insightsCountry'), d.countries, function (r) { return countryName(r.id); }) : null,
        d.languages.length || d.asked.length ? languages() : null,
        d.switches.length ? ranking(t('visitorsSwitches'), d.switches, switchName) : null
      ]);
      group(stack, 'numbersFound', [sources(), found()]);
      group(stack, 'visitorsDid', [
        signingUp(),
        d.pages.length ? pages() : null,
        journeys(),
        d.presses.length ? ranking(t('insightsPressed'), d.presses, function (r) { return r.id; }, true) : null,
        whatOpened()
      ]);
    }

    stack.appendChild(el('div', { className: 'stats-totals' }, [
      note('visitorsSince', { date: dateLabel(d.since, true) }),
      note('visitorsFoot'),
      note('visitorsOwnerFoot')
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
        loadLive();
      });
  }

  function boot() {
    main = document.getElementById('main');
    liveCard = card([]);
    liveCard.hidden = true;
    applyStyle();
    load(wantedSpan());
    /* Right now asks again every minute, but only while somebody is looking:
       a tab in the background asks nothing, and coming back asks at once.
       Only once the words are in, which the first load() brings. */
    setInterval(function () {
      if (document.visibilityState === 'visible' && state.data) loadLive();
    }, LIVE_EVERY);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && state.data) loadLive();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
