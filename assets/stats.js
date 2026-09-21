/* Tallinn Tastebuds — /stats, what gets pressed on this site.
 *
 * Three tables, and the first one is the page. The map's own places, every one
 * of them, most opened at the top and least opened at the bottom — both ends
 * are the answer, which is why it is the whole ranking rather than a top ten.
 * Then Google's directory, only the venues somebody has actually pressed. Then
 * the filter chips, in full, which is the table that argues about the order of
 * the chip row: see **The order of the filter chips** in README.md. Under all
 * three, two footnotes about the site rather than about a press: how many
 * opens have been counted, and how many accounts exist.
 *
 * WHERE THE NUMBERS COME FROM
 *
 * Pressing something posts to /api/stats, from three places: selectPlace() in
 * assets/app.js opens a place on the map, applyFilters() in the same file
 * turns a chip on, and select() in assets/venues.js presses a card on the
 * directory. Each page counts each thing once per load, the way TTBTrack.view()
 * reports one page view per opened place and no more, so comparing three
 * places is three and pressing back and forth is not thirty. This page only
 * reads. See **Statistics** in README.md for what the numbers do and do not
 * mean.
 *
 * ONE REQUEST ON THE WAY IN
 *
 * The words arrive with the numbers. This page does not fetch data/ui.json at
 * all — it sends /api/stats the languages it would have picked from and the
 * route answers with the one block the site speaks, which is the arrangement
 * the flashcards page introduced and the reason it loads in one round trip
 * rather than two. So the boot block below is the style half only; the
 * language half is a list of candidates sent, and what comes back decides.
 *
 * Plain browser JavaScript, one IIFE, ES5, no modules and no build step, the
 * same as every other file in assets/. The tokens, the card and the eyebrow
 * come from assets/styles.css, the brand header and the stack from
 * assets/lists.css, and what is left — the rows of a ranking — is
 * assets/stats.css.
 */
(function () {
  'use strict';

  var API = '/api/stats';

  /* The two styles, their key and the one the page opens on: the same names
     and the same default as assets/app.js, which is where they are actually
     chosen. There is no swatch on this page, the way there is none on the
     directory. */
  var STYLES = ['red', 'green'];
  var DEFAULT_STYLE = 'red';
  var STYLE_KEY = 'ttb.style';
  var LANG_KEY = 'ttb.lang';
  var DEFAULT_LANG = 'en';

  var state = {
    lang: DEFAULT_LANG,
    ui: {},
    ready: false,   // whether the numbers came back at all
    opens: 0,
    users: 0,
    map: [],
    venues: [],
    filters: []
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

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function storeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  /* One string in the language this page came back in. The block is the
     language's own and not the whole file — see ONE REQUEST ON THE WAY IN —
     so there is one lookup and no fallback language to fall through to: a key
     the block does not have is a key the file does not have, which the
     validator fails the build on. */
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

  /* ------------------------------------------------------------------- boot
   * The style, applied by the page itself before anything is drawn. Every page
   * on this site carries this block; see applyStyle() in assets/lists.js,
   * which is the fullest copy.
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

  /* What this page would pick a language from, in the order every other page
     picks: ?lang=, then the choice the map stored, then the browser's own. The
     picking itself is wordsFor() in functions/api/_lib.js, because the list to
     pick against is the file that route reads and this page never fetches — so
     this is the candidates, sent as they are, and what comes back is the one
     the site speaks. Anything past ten is noise the route would not read
     anyway. */
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

  /* ---------------------------------------------------------------- drawing */

  function card(kids) {
    return el('section', { className: 'card lists-card' }, kids);
  }

  /* One row of a ranking: where it came in, what it is, and how many times it
     was pressed.
   *
   * The rank is printed rather than left to the eye counting rows, because the
   * number people actually want off this page is a position — "which one is
   * last" — and a column of seventy-odd names is not a thing anybody counts
   * down. Ties share a rank: two places on eleven opens are both seventh, and
   * the next one is ninth, which is how every other ranking anybody has read
   * behaves.
   *
   * The name is a link where the row is a place on the map, because the whole
   * reason to notice a place near the bottom is to go and read what it says.
   * A Google row is not a link: the directory has no address per place, and a
   * row that led out to Google would be this site handing its traffic to the
   * thing it exists instead of. */
  function row(place, rank, href) {
    var name = href
      ? el('a', { className: 'stats-name', href: href, textContent: place.name })
      : el('span', { className: 'stats-name', textContent: place.name });

    return el('li', { className: 'stats-row' }, [
      el('span', { className: 'stats-rank', textContent: rank }),
      el('span', { className: 'stats-who' }, [
        name,
        /* A shut place still has a card and can still be opened, so it is
           still ranked — and a row at the bottom of a ranking has to say why
           it is there rather than let the number read as a verdict. */
        place.closed ? el('span', { className: 'stats-shut', textContent: t('closed') }) : null
      ]),
      el('span', { className: 'stats-n', textContent: String(place.n) })
    ]);
  }

  /* A whole table, ranks worked out as it goes. `href` says what a name links
     to, or nothing. */
  function ranking(places, href) {
    var list = el('ol', { className: 'stats-list' });
    var rank = 0;
    var last = null;
    places.forEach(function (place, i) {
      if (last === null || place.n !== last) rank = i + 1;
      last = place.n;
      list.appendChild(row(place, rank, href ? href(place) : null));
    });
    return list;
  }

  /* The two facts the page is actually for, said in words above the table so
     that neither is something anybody has to scroll to find. Drawn only once
     something has been opened — render() decides — because "most opened,
     nothing" is not a fact, and the empty state under the table says the true
     thing instead.
   *
     Both ends can be a tie, and the bottom nearly always is — most of the map
     sits on nought for a while, and later there is a handful on one. Naming
     whichever of them the sort happened to put last would be the page making
     something up, so a tie says how many places it is and what they are all
     on. That is the honest version of the same fact and it is the more useful
     one: "eleven places, no opens" is the thing worth knowing. */
  function extreme(label, tied) {
    var alone = tied.length === 1;
    return el('div', { className: 'stats-head' }, [
      el('dt', { className: 'eyebrow', textContent: label }),
      el('dd', { className: 'stats-head-name' }, [
        alone ? tied[0].name : t('listCount', { n: tied.length }),
        /* The same marker the row carries, for the same reason: a shut place
           named as the least opened without that word beside it reads as a
           verdict on a restaurant rather than as a fact about a card nobody
           opens any more. */
        alone && tied[0].closed
          ? el('span', { className: 'stats-shut', textContent: t('closed') })
          : null
      ]),
      el('dd', { className: 'stats-head-n', textContent: t('statsOpens', { n: tied[0].n }) })
    ]);
  }

  function sharing(n) {
    return state.map.filter(function (p) { return p.n === n; });
  }

  function headline() {
    return el('dl', { className: 'stats-heads' }, [
      extreme(t('statsMost'), sharing(state.map[0].n)),
      extreme(t('statsLeast'), sharing(state.map[state.map.length - 1].n))
    ]);
  }

  /* A card with a heading, the sentence that says what it counts, and the
     ranking itself — or, where the map has been drawn before anybody has
     opened anything on it, the sentence that says so in place of seventy-six
     rows of nought. All three tables are this; they differ only in their two
     strings and in whether a name leads anywhere. */
  function table(head, lead, rows, href) {
    return card([
      el('h2', { className: 'lists-title', textContent: t(head) }),
      el('p', { className: 'stats-lead', textContent: t(lead) }),
      rows
        ? ranking(rows, href)
        : el('p', { className: 'lists-none', textContent: t('statsNone') })
    ]);
  }

  function spot(place) {
    return '/?spot=' + encodeURIComponent(place.id);
  }

  function render() {
    clear(main);

    if (!state.ready) {
      main.appendChild(card([
        el('h2', { className: 'lists-title', textContent: t('statsTitle') }),
        el('p', { className: 'lists-none', textContent: t('statsOff') })
      ]));
      return;
    }

    /* The map comes back most opened first, so the top row is the whole test:
       if that one is on nought then nothing has been opened at all, and there
       is no ranking to draw and no headline to write. */
    var opened = !!(state.map[0] && state.map[0].n);

    var stack = el('div', { className: 'lists-stack' });
    if (opened) stack.appendChild(card([headline()]));
    stack.appendChild(table('statsMapHead', 'statsMapLead', opened && state.map, spot));

    /* Google's venues and the chips are absent rather than empty when there is
       nothing in them: an explanation of a table that is not there is one more
       thing to read past on the way to the ranking that is. The map's table
       cannot do that — it is the page. */
    if (state.venues.length) {
      stack.appendChild(table('statsVenuesHead', 'statsVenuesLead', state.venues));
    }
    if (state.filters.length) {
      stack.appendChild(table('statsFiltersHead', 'statsFiltersLead', state.filters));
    }

    /* Every open counted, under the tables rather than over them: it is the
       page's footnote about itself, and nobody opens a ranking to read a total
       first. Places only — the chips are presses of a different thing, and
       adding the two would be a number about nothing. */
    stack.appendChild(el('p', {
      className: 'stats-total',
      textContent: t('statsTotal', { n: state.opens })
    }));

    /* How many accounts exist — a fact about the site rather than about a
       press, so it is not part of the ranking above it and draws whenever the
       numbers are in at all, opened or not. Same footnote style as the total
       above it, and it is the page's second line rather than a table of its
       own: one number needs no headline, no lead sentence and no rows. */
    stack.appendChild(el('p', {
      className: 'stats-total',
      textContent: t('statsUsersTotal', { n: state.users })
    }));

    main.appendChild(stack);
  }

  /* ------------------------------------------------------------------ start */

  function boot() {
    main = document.getElementById('main');
    applyStyle();

    fetch(API + '?lang=' + encodeURIComponent(wanted().join(',')), {
      headers: { accept: 'application/json' }
    })
      .then(function (res) { return res.json(); })
      .catch(function () { return null; })
      .then(function (out) {
        /* Nothing arrived, not even the words to say so — offline, or the
           route not deployed yet. What is left is the English written into
           the markup, which is why the title and the sentence under it are
           written there rather than built here: the page still says what it
           is, and the map is one press away in the header. Drawing anything
           at all from this point would mean printing this page's own keys at
           somebody, which is worse than printing nothing. */
        if (!out || !out.ui) return;

        state.lang = out.lang || DEFAULT_LANG;
        state.ui = out.ui;
        state.ready = !!out.ready;
        state.opens = out.opens || 0;
        state.users = out.users || 0;
        state.map = out.map || [];
        state.venues = out.venues || [];
        state.filters = out.filters || [];

        applyStaticStrings();
        render();
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
