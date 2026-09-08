/**
 * Tallinn Tastebuds — /account.html, the page behind your name.
 *
 * WHY THIS IS A PAGE AND NOT THE SHEET IT WAS
 *
 * Everything here used to be a menu inside the sheet the map opens: a title,
 * your name, and four rows that were each a door to somewhere else. It worked,
 * and it was the wrong shape for what it had become. A sheet over the map is
 * for something you do and dismiss — sign in, change a password, read one
 * sentence — and it is drawn small on purpose, because the map is the thing
 * behind it and the map is the site. What is on this page is not that: it is
 * your saved places and your lists, which are things to look at, scroll, and
 * come back to, and a menu of four rows was a table of contents standing in
 * for all of them.
 *
 * So the doors became the things themselves. The page names the places you
 * saved rather than offering to filter the map by them, and names the lists
 * you wrote rather than linking to the page that names them. What is left on
 * the map's sheet is exactly what a sheet is good at — signing in, creating an
 * account, changing a password — and nothing that wants a page.
 *
 * WHAT IT DOES NOT DO
 *
 * There is one password form on this site and it is not here. The map's sheet
 * carries it, and this page sends you there with ?then=/account.html so the
 * step lands you back where you pressed it — the same road /lists.html has
 * always taken to the sign-in form, and for the same reason: two copies of a
 * password form is one copy that quietly stops matching the API.
 *
 * SIGNED OUT IS A REAL STATE HERE
 *
 * A save needs no account — the device keeps a random id and the marks are
 * filed under it — so the page has something to show before anybody has signed
 * up, and shows it: the places kept on this browser, out of localStorage, with
 * the offer of an account above them rather than a wall in front of them.
 *
 * WHAT IT READS
 *
 *   /data/ui.json      the strings, in the language the map wrote down
 *   /data/places.json  id -> name and address, for the saves
 *   /api/account       who is signed in, and what they have saved
 *   /api/lists         the lists they have written
 *
 * All four at once and one paint at the end. Nothing here waits on anything
 * else, and a page that drew twice would draw a card and then move it.
 */
(function () {
  'use strict';

  var UI_URL = '/data/ui.json';
  var PLACES_URL = '/data/places.json';
  var ACCOUNT_API = '/api/account';
  var LISTS_API = '/api/lists';

  /* The same two keys the map writes and the lists page reads. Walking from
     the map to here should not feel like leaving. */
  var STYLE_KEY = 'ttb.style';
  var LANG_KEY = 'ttb.lang';
  var SAVED_KEY = 'ttb.saved';

  var STYLES = ['red', 'green'];
  var DEFAULT_STYLE = 'red';
  var DEFAULT_LANG = 'en';

  /* Where the sheet is, and where it should come back to. Written once here
     rather than at each of the three links that use it. */
  var SHEET = '/?account=';
  var BACK = '&then=%2Faccount.html';

  var state = {
    ui: {},
    lang: DEFAULT_LANG,
    reached: true,   // whether /api/account answered at all
    ready: false,    // whether accounts work on this deployment
    user: null,
    saved: [],       // place ids, newest first
    places: {},      // id -> { name, address }
    lists: []
  };

  /* The one element on the page that is not furniture. Everything below
     builds into it. */
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
        else if (k === 'html') node.innerHTML = v;
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

  /* The two API calls, asked so that "the site did not answer" and "the site
     answered no" stay apart: the first is a network the page cannot fix and
     the second is a fact about the deployment. A helper that threw on both
     would collapse them into one apology. */
  function ask(url) {
    return fetch(url, { headers: { accept: 'application/json' } })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (out) {
          return { status: res.status, out: out || {} };
        });
      })
      .catch(function () { return { status: 0, out: {} }; });
  }

  /* --------------------------------------------------------------- dressing
   * Copied whole from assets/lists.js, which copied it from the pass pages:
   * the style and the language are chosen on the map, written to localStorage,
   * and read by every other page. A page that skipped this block renders in
   * red for somebody who chose green — see "The two styles" in README.md.
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
    each('data-i18n-title', function (n, k) { n.setAttribute('title', t(k)); });
  }

  /* ----------------------------------------------------------------- pieces */

  function card(kids) {
    return el('section', { className: 'card lists-card' }, kids);
  }

  function heading(words, level) {
    return el(level || 'h1', { className: 'lists-title', textContent: words });
  }

  /* The row of ways on from a card, along its foot. They are `.alt`s wherever
     there is more than one of them, because the accent is spent once per
     surface — the single place this page spends it is the offer of an account
     to somebody who has none. See "The design rules" in README.md. */
  function foot(kids) {
    return el('p', { className: 'lists-row lists-foot' }, kids);
  }

  function link(labelKey, href, className) {
    return el('a', { className: className || 'alt', href: href, textContent: t(labelKey) });
  }

  /* ------------------------------------------------------------------ saves
   * The one thing on this page that works with no account at all, so it is
   * drawn the same way in both states and reads the same two sources the map
   * does: whatever /api/account said for a signed-in person, and localStorage
   * for a browser that has not signed in.
   *
   * Each row opens that place on the map rather than describing it here. A
   * write-up, its photographs and its hours are the map's job and are already
   * built there; a second, thinner copy of a place on this page would be a
   * page to keep in step with the map for no gain. What the row carries is
   * what tells one saved place from another in a column of them: the name and
   * the street.
   */
  function savedIds() {
    if (state.user) return state.saved;
    var raw = storeGet(SAVED_KEY);
    if (!raw) return [];
    try {
      var list = JSON.parse(raw);
      return Object.prototype.toString.call(list) === '[object Array]' ? list : [];
    } catch (e) {
      return [];
    }
  }

  /* An id nothing on the map answers to is dropped rather than drawn as a row
     that opens an empty map: a place that has since been taken down leaves its
     save behind, and the map's own list does the same thing for the same
     reason. */
  function savedPlaces() {
    var out = [];
    savedIds().forEach(function (id) {
      var place = state.places[id];
      if (place) out.push(place);
    });
    return out;
  }

  /* The row on /lists/public, borrowed whole: a title with one line of quiet
     facts under it. Not the row /lists.html draws for a list, which leaves
     54px along its bottom edge for a second destination laid over it — these
     rows have one destination, and that padding is a hole in a card nothing
     is standing in. The directory's own rows take that room back with
     .has-keep when they carry a bookmark; without the class the row is the
     bare card, which is what this page wants. */
  function row(href, title, meta) {
    var line = el('p', { className: 'lists-all-meta mono' });
    meta.filter(Boolean).forEach(function (part, i) {
      if (i) line.appendChild(document.createTextNode(' \u00b7 '));
      line.appendChild(part);
    });
    return el('li', { className: 'lists-index-row' }, [
      el('a', { className: 'lists-all-link', href: href }, [
        el('span', { className: 'lists-index-title', textContent: title }),
        meta.length ? line : null
      ])
    ]);
  }

  function placeRow(place) {
    return row('/?spot=' + encodeURIComponent(place.id), place.name, [
      place.address ? el('span', { textContent: place.address }) : null
    ]);
  }

  function savedCard() {
    var places = savedPlaces();

    var kids = [
      heading(t('listSaved'), 'h2'),
      el('p', { className: 'lists-say', textContent: t('accountSavedWhy') })
    ];

    if (!places.length) {
      kids.push(el('p', { className: 'lists-none', textContent: t('accountSavedNone') }));
      kids.push(foot([link('listsBack', '/')]));
      return card(kids);
    }

    var ul = el('ul', { className: 'lists-index' });
    places.forEach(function (place) { ul.appendChild(placeRow(place)); });
    kids.push(ul);
    /* The map narrowed to these, which is what the row in the sheet used to
       do and the one thing a column of names cannot: seeing where they are in
       the city next to each other. ?saved=1 is a door the map opens once and
       takes back off — see readDoors() in assets/app.js. */
    kids.push(foot([link('accountSavedMap', '/?saved=1')]));
    return card(kids);
  }

  /* ------------------------------------------------------------------ lists
   * The same facts the lists page prints about a list, deliberately: a list is
   * one object with one appearance, and a second set of words for it here
   * would be two things to change every time it grew a field. What this card
   * adds is the way in — /lists.html, where a list is actually written.
   */

  /* Singular and all: "1 place" and "kept by 1 person" are sentences somebody
     reads, and "1 places" is the tell that nobody did. */
  function countLabel(n) {
    return n === 1 ? t('listCountOne') : t('listCount', { n: n });
  }

  function keepCount(n) {
    if (!n) return null;
    return el('span', {
      className: 'lists-all-keeps',
      textContent: n === 1 ? t('listsKeptOne') : t('listsKeptN', { n: n })
    });
  }

  function listRow(l) {
    return row('/list/' + l.id, l.title, [
      el('span', { textContent: countLabel(l.n) }),
      keepCount(l.keeps),
      /* `=== false` and not `!l.public`: a list is public unless the answer
         says otherwise, and a missing value must not read as a private one. */
      l.public === false ? el('span', { className: 'lists-private', textContent: t('listsPrivate') }) : null
    ]);
  }

  function listsCard() {
    var kids = [
      heading(t('listsYours'), 'h2'),
      el('p', { className: 'lists-say', textContent: t('accountListsWhy') })
    ];

    if (!state.lists.length) {
      kids.push(el('p', { className: 'lists-none', textContent: t('accountListsNone') }));
    } else {
      var ul = el('ul', { className: 'lists-index' });
      state.lists.forEach(function (l) { ul.appendChild(listRow(l)); });
      kids.push(ul);
    }

    /* The three ways on, in the order they are about you: where a list gets
       written, what yours look like from outside, and then everybody's. The
       lists you kept are not here at all — they are somebody else's pages, and
       /lists.html is where they are read and where they can be dropped
       again. */
    kids.push(foot([
      link('accountMake', '/lists.html'),
      link('profileYours', '/u/' + encodeURIComponent(state.user)),
      link('listsAllEverything', '/lists/public')
    ]));
    return card(kids);
  }

  /* ------------------------------------------------------------------- you */

  /* The counts, in one mono line under the name. They are the only numbers
     this page keeps about anybody and they are both about things you did:
     what you kept, and what you wrote. A count at nought is left out rather
     than printed — a "0 lists" under somebody's name reads as a verdict on
     them, the same reason a save count hides at zero on the map. */
  function tally() {
    var parts = [];
    var saves = savedPlaces().length;
    var lists = state.lists.length;
    if (saves) parts.push(saves === 1 ? t('accountStatSavedOne') : t('accountStatSaved', { n: saves }));
    if (lists) parts.push(lists === 1 ? t('accountStatListsOne') : t('accountStatLists', { n: lists }));
    if (!parts.length) return null;
    return el('p', { className: 'lists-standing mono', textContent: parts.join(' · ') });
  }

  function youCard() {
    return card([
      el('p', { className: 'eyebrow', textContent: t('accountOpen') }),
      heading(state.user),
      tally(),
      el('p', { className: 'lists-say', textContent: t('accountWhat') }),
      foot([
        /* Into the map's sheet and back again. The ?then= is what makes the
           password step land here rather than on the map, which is not where
           it was pressed. */
        link('accountChange', SHEET + 'password' + BACK),
        signOut()
      ])
    ]);
  }

  /* Sign out is the one write this page makes, and it is a button rather than
     a link because it changes something. The map's sheet is where it used to
     live; it is here because this is the page that says who you are, and the
     way out belongs beside the name it is a way out of.

     It ends on the map rather than on this page. A signed-out account page is
     an invitation to sign in, which is a fine page and not what somebody who
     just pressed Sign out was asking for. */
  function signOut() {
    var btn = el('button', { type: 'button', className: 'alt is-danger', textContent: t('accountSignOut') });
    btn.addEventListener('click', function () {
      btn.disabled = true;
      btn.textContent = t('accountWorking');
      fetch(ACCOUNT_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'logout' })
      }).then(function () {
        /* The account's saves were the account's. What this browser kept
           before signing in was claimed on the way in and is on the account
           now, so leaving a copy here would be a list of places this browser
           never chose. */
        try { window.localStorage.setItem(SAVED_KEY, '[]'); } catch (e) { /* fine */ }
        window.location.href = '/';
      }).catch(function () {
        btn.disabled = false;
        btn.textContent = t('accountSignOut');
      });
    });
    return btn;
  }

  /* ------------------------------------------------------------- signed out
   * Not a wall. The map needs no account and this page has something of its
   * own to show without one — the marks on this browser — so the offer sits
   * above them and says what an account is for, which is exactly the sentence
   * the map's sheet leads with.
   */
  function invitation() {
    return card([
      el('p', { className: 'eyebrow', textContent: t('accountOpen') }),
      heading(t('accountTitle')),
      el('p', { className: 'lists-say', textContent: t('accountWhy') }),
      foot([
        link('accountCreate', SHEET + 'up' + BACK, 'go'),
        link('accountSignIn', SHEET + 'in' + BACK)
      ])
    ]);
  }

  /* Accounts are off here — no database bound, or this deployment holding the
     other environment's. The saves still work, because they are local until
     somebody signs in, so the page says the one true thing and then draws
     them anyway rather than showing a sign-in that could only fail. */
  function switchedOff() {
    return card([
      el('p', { className: 'eyebrow', textContent: t('accountOpen') }),
      heading(t('accountTitle')),
      el('p', { className: 'lists-say', textContent: t(state.reached ? 'accountErrOff' : 'accountErrReach') }),
      foot([link('listsBack', '/')])
    ]);
  }

  /* ---------------------------------------------------------------- the page
   * One place decides what is on screen, and it decides it once, after every
   * answer is in. Three states, and each is the whole page rather than a
   * variation on the one before it.
   */
  function render() {
    clear(main);
    var wrap = el('div', { className: 'lists-stack' });

    if (!state.ready) {
      wrap.appendChild(switchedOff());
      wrap.appendChild(savedCard());
    } else if (!state.user) {
      wrap.appendChild(invitation());
      wrap.appendChild(savedCard());
    } else {
      wrap.appendChild(youCard());
      wrap.appendChild(savedCard());
      wrap.appendChild(listsCard());
    }

    main.appendChild(wrap);
  }

  /* ------------------------------------------------------------------- boot */

  function boot() {
    main = document.getElementById('main');

    applyStyle();

    Promise.all([
      getJSON(UI_URL),
      getJSON(PLACES_URL).catch(function () { return []; }),
      ask(ACCOUNT_API),
      ask(LISTS_API)
    ]).then(function (loaded) {
      state.ui = loaded[0] || {};
      state.lang = pickLanguage(Object.keys(state.ui).sort());
      applyStaticStrings();
      document.title = t('accountDocumentTitle');

      (loaded[1] || []).forEach(function (place) {
        if (place && place.id) state.places[place.id] = place;
      });

      var account = loaded[2];
      state.reached = account.status !== 0;
      state.ready = !!account.out.ready;
      state.user = account.out.user || null;
      state.saved = Object.prototype.toString.call(account.out.saved) === '[object Array]'
        ? account.out.saved
        : [];

      /* Asked in the same breath as the one that says whether there is
         anybody to ask about. Signed out it holds nothing and costs one
         request; waiting for the account's answer before making it would be a
         second round trip, and a page that draws itself twice. */
      state.lists = loaded[3].out.lists || [];

      render();
    }).catch(function () {
      /* The strings themselves did not arrive, so there is nothing to say in
         any language. The markup's own English is what is left, and the map
         is one press away in it. */
      state.ui = {};
      render();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
