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
 * AND THEN THE LISTS PAGE'S INDEX CAME HERE TOO
 *
 * For a while there were two pages naming your lists. This one named them
 * under your account; /lists.html named them again, with the box that makes a
 * new one and the lists you had kept beside it. Neither was wrong on its own
 * and together they were a fork: your lists were on your account, except the
 * half of them that was somewhere else, and the way from one page to the other
 * was a row saying "Make a list" that led to a page you had just come from.
 *
 * The box is here now, and so are the lists you kept, and /lists.html sends
 * anybody who still has the address to this page before it draws anything.
 * What is left there is what only that page can be: one list, one person, and
 * everybody's — three addresses that are each about something that is not you.
 * There is one page about you and this is it.
 *
 * EVERYBODY'S LISTS IS NOT ON THIS PAGE
 *
 * There was a way on to the directory here for as long as there has been a
 * page, and it took four shapes: a row at the foot of the lists card, under a
 * fold that could be forty places long; a card that named three real lists,
 * off a third request made on every load; that card rebuilt as a .menu-row;
 * and last a card whose whole face was the press — the name of the page, the
 * line saying what is on it, and a chevron that did not turn.
 *
 * It is none of them now. Every one of those was an answer to the same
 * question — how does somebody get from their own things to everybody else's
 * — and the answer this page kept giving was one more card under the ones
 * that are about them. The question is already answered twice elsewhere and
 * was before this page existed: the pill on the map's rail is the door, and
 * so is the dock at the foot of every list. A page named for somebody's
 * account does not also have to be the way to a stranger's.
 *
 * So the page stops where it stops being about you. The order still runs from
 * what is most yours to what is least — who you are, what you saved, what you
 * wrote, what you kept of other people's — and there is nothing after it.
 *
 * THE COLUMNS FOLD, AND THE WAYS ON DO NOT
 *
 * A column of names is what this page is for, and it is also what buried the
 * rest of it. Forty saved places and a dozen lists put the box that makes a
 * list and every way out a scroll and a half down the page, under the very
 * things they were the way out of. So each column is a <details> behind its
 * own title, with the count of what is inside it on the line you press, and
 * the ways on sit outside the fold, where a card that is one line high keeps
 * them in sight.
 *
 * And an open one is six rows and a Show more, not the whole column: a fold
 * that opened onto forty names was the same burial one press further in. See
 * column().
 *
 * A closed fold is not the menu this page was made out of. A menu row said
 * the name of another page; this one says how many of your things are behind
 * it and opens them where you are standing. Which folds are open is
 * remembered on the browser, so somebody who wants their saves in front of
 * them every time opens them once.
 *
 * WHAT THE ACCOUNT ITSELF IS, AND WHERE IT SITS
 *
 * Two pages start with your name, and they looked the same: an eyebrow, the
 * name, a sentence. /u/<you> is what a stranger sees; this page is the rest.
 * So the first card here says so, with the one door on it: your public
 * profile, and a line saying it is how your lists look to everybody else.
 * That is the card's own subject rather than a control filed under it — the
 * public face of the name over it — and the profile's own card carries the
 * matching door back, to the private half.
 *
 * The password and the way out are on the same card, along its foot. They
 * have been everywhere else: under the name as a menu of three, which made
 * the page read as a settings screen with your saves filed underneath; in a
 * card of their own at the end, headed "Your account", a second heading about
 * the account under a page that had opened with one; and as a bare row after
 * the last card, which looked lost, two words standing in the wash under
 * somebody else's lists. The card that says who you are is the one card
 * those two belong to, and as two quiet `.alt`s along its foot they are not
 * the menu that made it a settings screen. Nobody opens this page to change
 * a password, and nobody has to look for the way out either.
 *
 * NO LABEL OVER ANY OF IT
 *
 * Under that card the page is your things: the places you saved, the lists you
 * wrote, the lists you kept, in that order. For a while a heading stood over
 * that run and another over the card that has since gone — "Yours" and
 * "Everybody else's", the quiet one /lists puts over a run of rows. On a
 * phone they were two more lines between your name and your things, and each
 * said what the card titles under it already say: "Places I saved", "Your
 * lists" and "Lists you saved" are yours by their names. The order carried
 * that argument on its own then; now there is no second half left for a
 * heading to name.
 *
 * WHAT IT DOES NOT DO
 *
 * There is one password form on this site and it is not here. The map's sheet
 * carries it, and this page sends you there with ?then=/account.html so the
 * step lands you back where you pressed it — the same road /lists.html took to
 * the sign-in form for as long as it had an index, and for the same reason:
 * two copies of a password form is one copy that quietly stops matching the
 * API.
 *
 * And it does not offer Google either. An account made with a username and a
 * password is an account somebody chose not to use Google for, and a page
 * that keeps offering it is a page arguing with them about it. What is left
 * is the other direction: an account that was made through Google can take
 * Google off, which is one row deleted and a word along the same foot as the
 * password and the way out — see googleRow().
 *
 * SIGNED OUT IS A REAL STATE HERE
 *
 * A save needs no account — the device keeps a random id and the marks are
 * filed under it — so the page has something to show before anybody has signed
 * up, and shows it: the places saved on this browser, out of localStorage, with
 * the offer of an account above them rather than a wall in front of them.
 *
 * The door to everybody's lists stood under that and was the one thing here a
 * stranger could open without signing up. What it was worth is not nothing,
 * and it is a press away on the map's rail — which is where somebody with no
 * account is standing anyway, since the rail is on the page they came from.
 *
 * WHAT IT READS
 *
 *   /data/ui.json       the strings, in the language the map wrote down
 *   /data/places.json   id -> name and address, for the saves
 *   /api/account        who is signed in, and what they have saved
 *   /api/lists          the lists they wrote, and the ones they kept
 *
 * All four at once and one paint at the end. Nothing here waits on anything
 * else, and a page that drew twice would draw a card and then move it.
 *
 * There was a fifth, /api/lists?all=1, for the three of everybody's lists the
 * foot of the page used to name. Those three became a door and the door has
 * gone too, so the one route this page reads twice is read once.
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

  /* Which of this page's three folds are open, comma-joined. Nothing
     else on the site reads it, and a browser that refuses storage simply gets
     the folded page every time — which is the page a first visit gets
     anyway. */
  var OPEN_KEY = 'ttb.account.open';

  var STYLES = ['red', 'green'];
  var DEFAULT_STYLE = 'red';
  var DEFAULT_LANG = 'en';

  /* The server binds this; the field only stops somebody at the keystroke
     instead of at the round trip. MAX_TITLE in functions/api/lists.js is the
     one that counts — change one, change the other. */
  var MAX_TITLE = 60;
  /* The line about yourself. MAX_ABOUT in functions/api/account.js is the one
     that binds; this is the copy that stops a keystroke rather than a round
     trip, the way every cap on this site is written twice. */
  var MAX_ABOUT = 200;
  /* The name you go by. MAX_DISPLAY in functions/api/account.js binds. */
  var MAX_DISPLAY = 60;
  /* The page of links. cleanRows() in functions/api/_profile.js binds; these
     stop a keystroke rather than a round trip, the same arrangement. The
     address's cap is a maxlength like the rest, because unlike a handle's
     field this one takes the address itself and a cut one is refused. */
  var MAX_ROWS = 20;
  var MAX_ROW_TITLE = 60;
  var MAX_ROW_URL = 2048;
  var MAX_ROW_NOTE = 3000;

  /* How many rows an opened fold draws before it offers the rest.
     A fold used to be all or nothing, and on an account with forty saves that
     made opening one the very burial the folds were written against: forty
     rows between the title you pressed and everything under it. Six is what
     leaves the next card's title on the screen at the 390px the layouts are
     measured against, so an open column still reads as one card among several.
     The rest is one more press and no request — the rows are already here. */
  var SHOW_ROWS = 6;

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
    linked: false,   // whether this account was reached through Google
    password: true,  // whether there is a password on it at all
    about: '',       // the line you wrote about yourself, '' for nearly everybody
    display: '',     // the name you go by, '' for nearly everybody
    links: {},       // network id -> handle, {} for nearly everybody
    rows: [],        // the page of links under them, [] for nearly everybody
    saved: [],       // place ids, newest first
    places: {},      // id -> { name, address }
    lists: [],       // the ones you wrote
    kept: []         // the ones you kept, which are somebody else's
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

  var toastTimer = null;
  function toast(message) {
    var node = document.getElementById('toast');
    node.textContent = message;
    node.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.hidden = true; }, 3800);
  }

  function storeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function storeSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* fine */ }
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

  /* The three API calls, asked so that "the site did not answer" and "the site
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

  /* The one write this page makes besides signing out: a new list. Same
     endpoint and same shape as every write assets/lists.js makes, because it
     is the same API — this page grew the box that makes a list when the lists
     page stopped having an index to put it on. */
  function post(payload) {
    return fetch(LISTS_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (out) {
        return { ok: res.ok, out: out || {} };
      });
    });
  }

  /* One sentence per refusal the server can send back from `create`, and the
     general one for anything else — a visitor should never be shown a word out
     of the source. The list is shorter than the one in assets/lists.js because
     the only write here is making a list; the rest of them name a list this
     page cannot address. */
  var ERRORS = {
    'too-many': 'listsErrTooMany',
    title: 'listsErrTitle',
    'signed-out': 'listsErrSignedOut'
  };

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

  /* Every block on this page is one of these: the map's card, padded by the
     lists page's. It took a second class for a while, for the one card that
     was itself a press — everybody else's lists, which needed a positioned
     box for the title's link to be stretched over. That card has gone and so
     has the argument. */
  function card(kids) {
    return el('section', { className: 'card lists-card' }, kids);
  }

  function heading(words, level) {
    return el(level || 'h1', { className: 'lists-title', textContent: words });
  }

  /* The row of ways on from a card, along its foot. They are `.alt`s wherever
     there is more than one of them, and they are `.alt`s where they are alone
     as well — the accent is spent once on this whole page, and it is spent on
     the one thing the page is asking for: the box that makes a list when
     somebody is signed in, and the offer of an account when nobody is. See
     "The design rules" in README.md. */
  function foot(kids) {
    return el('p', { className: 'lists-row lists-foot' }, kids);
  }

  /* Every link is reported under the event it names — a way off this page
     is the one kind of press it has, and which way people leave is the
     whole of what there is to learn from it. */
  function link(labelKey, href, event, params, className) {
    return TTBTrack.click(
      el('a', { className: className || 'alt', href: href, textContent: t(labelKey) }),
      event, params
    );
  }

  /* A way on from a card, as a row: the name, the line under it saying what
     is behind it, and the chevron. It is .menu-row out of assets/styles.css,
     the shape the map's account sheet draws its places-to-go in, because that
     is what this is.

     One caller now, on the card that carries your name: your public profile.
     It has had five in all — one became the thing it had been promising, a
     field that makes a list, another, everybody else's lists, became a card in
     its own right and then left the page altogether, and the Estonian
     flashcards went back to being found from the map's rail alone. It was
     written as a function when it had one caller and it is a function with one
     again, because .menu-row is one of the four controls the design rules name
     and a row of it written out by hand here would be the copy that quietly
     stops matching the sheet's. */
  var ICON_GO = '<path d="M9 5l7 7-7 7"/>';

  function door(nameKey, whyKey, href, event, params) {
    return el('li', { className: 'menu-item' }, [
      TTBTrack.click(el('a', { className: 'menu-row', href: href }, [
        el('span', { className: 'menu-say' }, [
          el('span', { className: 'menu-name', textContent: t(nameKey) }),
          el('span', { className: 'menu-why', textContent: t(whyKey) })
        ]),
        chevron()
      ]), event, params)
    ]);
  }

  /* The mark itself, drawn for a door and for the title of a fold alike: one
     says the page it opens, the other says it opens where it stands, and a
     visitor should not have to learn two shapes for "there is more this
     way". */
  function chevron() {
    return el('span', {
      className: 'menu-go',
      'aria-hidden': 'true',
      html: '<svg viewBox="0 0 24 24" focusable="false">' + ICON_GO + '</svg>'
    });
  }

  /* ---------------------------------------------------------------- folding
   * A column of things behind its own title. What is on the line you press is
   * the heading, how many are inside, and the chevron the rows below wear —
   * and the count is what keeps a closed fold from being a door again: it
   * names what it is holding rather than where it would take you.
   *
   * The heading is the summary's only child because that is all a <summary>
   * is allowed to hold besides words, so the count and the chevron ride
   * inside it.
   */
  function openFolds() {
    return (storeGet(OPEN_KEY) || '').split(',');
  }

  function fold(name, title, count, kids) {
    var box = el('details', {
      className: 'lists-fold',
      open: openFolds().indexOf(name) !== -1
    }, [
      el('summary', null, [
        el('h2', { className: 'lists-title' }, [
          title,
          el('span', { className: 'lists-count mono', textContent: count }),
          chevron()
        ])
      ])
    ].concat(kids));

    /* Written on the way out of the fold rather than read on the way in:
       whichever of the three moved is the only one that changed. */
    box.addEventListener('toggle', function () {
      var open = openFolds().filter(function (n) { return n && n !== name; });
      if (box.open) open.push(name);
      storeSet(OPEN_KEY, open.join(','));
      TTBTrack.event('fold_toggle', { fold: name, fold_state: box.open ? 'open' : 'closed' });
    });
    return box;
  }

  /* The rows inside a fold, and the word that draws the rest of them.
   *
   * Six, then a Show more — the directory's own control, .lists-more and the
   * same word, because it is the directory's own job one page along and a
   * second design for "there are more of these" is a second thing to learn.
   *
   * The rows are built as they are asked for rather than all at once and
   * hidden: an account with a hundred saves pays for six of them until
   * somebody wants the rest, and nothing is fetched either way — the whole
   * column arrived with the page. What keeps six from reading as all of them
   * is the count on the line you pressed, which says how many there are.
   *
   * It returns the pieces rather than a box around them, so that the <ul> is
   * still the fold's own child and the word under it is a sibling: a wrapper
   * would put a div between a <details> and the column it holds for no reason
   * a stylesheet could name. */
  function column(name, items, draw) {
    var ul = el('ul', { className: 'lists-index' });
    var at = 0;
    var fill = function (upto) {
      for (; at < upto && at < items.length; at++) ul.appendChild(draw(items[at]));
    };

    fill(SHOW_ROWS);
    if (items.length <= SHOW_ROWS) return [ul];

    var go = el('button', { type: 'button', className: 'alt', textContent: t('listsAllMore') });
    var line = el('p', { className: 'lists-more' }, [go]);
    go.addEventListener('click', function () {
      TTBTrack.event('fold_more', { fold: name, rows_total: items.length });
      var seventh = at;
      fill(items.length);
      line.parentNode.removeChild(line);
      /* The word that was under the finger has just gone, so focus goes to
         the first row it drew rather than back to the top of the document.
         It is the row the button was standing on, so nothing scrolls; asking
         for the rest of a column should leave you at the start of the rest. */
      var row = ul.children[seventh];
      var first = row && row.querySelector('a');
      if (first) first.focus();
    });
    return [ul, line];
  }

  /* Singular and all: "1 place" and "saved by 1 person" are sentences somebody
     reads, and "1 places" is the tell that nobody did. */
  function countLabel(n) {
    return n === 1 ? t('listCountOne') : t('listCount', { n: n });
  }

  function listsLabel(n) {
    return n === 1 ? t('accountStatListsOne') : t('accountStatLists', { n: n });
  }

  /* The row on /lists, borrowed: a title and one line of quiet facts under
     it. Not the .lists-index-card assets/lists.js draws on a profile, which
     leaves 54px along its bottom edge for the map pill laid over it. These
     rows have one destination, and that padding is a hole in a card nothing
     is standing in; the directory's own rows take that room back with
     .has-keep when they carry a bookmark, and without the class the row is
     the bare card, which is what this page wants.

     The first three places on the list came under the line as well, while
     this page drew three of everybody else's; it draws none of those now.
     The two callers left are your own lists and the ones you kept,
     and neither has ever wanted them: a column of lists you already know is
     a column of names, and the names of the places on them are what the
     list's own page is for.

     The card is a box and the title is the link, which .lists-open stretches
     over the whole face of it. That arrangement is here for the same reason it
     is on the directory: the byline in the line of facts is a door to whoever
     wrote the list, and a link inside a link is not a thing HTML has. */
  function row(href, title, meta, event, params, pin) {
    var parts = meta.filter(Boolean);
    var line = el('p', { className: 'lists-all-meta mono' });
    parts.forEach(function (part, i) {
      if (i) line.appendChild(document.createTextNode(' · '));
      line.appendChild(part);
    });
    /* The list's own pin in front of its title, drawn exactly as it is on
       the map and on every other page a list is named on. aria-hidden for
       the reason listPin() in assets/lists.js gives: the title already says
       what the list is, and a screen reader announcing "croissant" before it
       is a decoration read aloud.

       A row with no list behind it — the saved places, the way to everybody
       else's — passes nothing and gets the title alone. */
    var name = el('a', { className: 'lists-index-title lists-open', href: href });
    if (pin) {
      name.appendChild(TTBPins.paint(
        el('span', { className: 'lists-pin', 'aria-hidden': 'true' }), pin));
    }
    name.appendChild(el('span', { textContent: title }));
    return el('li', { className: 'lists-index-row' }, [
      el('div', { className: 'lists-all-card' }, [
        TTBTrack.click(name, event, params),
        parts.length ? line : null
      ])
    ]);
  }

  /* Whose list it is, and the door to the rest of what they published. The
     same phrase, the same class and the same target as every other byline on
     this site — see byline() in assets/lists.js for why the name is the link
     and the words around it are not, why cutting the translated phrase at its
     placeholder is not assembling a sentence out of pieces, and why the one
     account Google's numbers write under reads as the product instead. */
  var GOOGLE_BY = 'google-statistics';
  function byline(name) {
    var google = name === GOOGLE_BY;
    var words = t(google ? 'listsByGoogle' : 'listsBy').split('{name}');
    return el('span', { className: 'lists-index-by' }, [
      words[0],
      TTBTrack.click(el('a', {
        href: '/u/' + encodeURIComponent(name),
        textContent: google ? 'Google Maps' : name
      }), 'profile_open', { name: name }),
      words[1]
    ]);
  }

  function keepCount(n) {
    if (!n) return null;
    return el('span', {
      className: 'lists-all-keeps',
      textContent: n === 1 ? t('listsKeptOne') : t('listsKeptN', { n: n })
    });
  }

  /* ------------------------------------------------------------------ saves
   * The one thing on this page that works with no account at all, so it is
   * drawn the same way in all three states and reads the same two sources the
   * map does: whatever /api/account said for a signed-in person, and
   * localStorage for a browser that has not signed in.
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

  function placeRow(place) {
    return row('/?spot=' + encodeURIComponent(place.id), place.name, [
      place.address ? el('span', { textContent: place.address }) : null
    ], 'place_link', { place: place.name, map: 'mine' });
  }

  function savedCard() {
    var places = savedPlaces();

    /* Nothing kept is not a fold. A title with a chevron on it promises
       something behind it, and there is nothing behind this one — so the
       card says so plainly and leaves for the map, which is where a save is
       made. */
    if (!places.length) {
      return card([
        heading(t('listSaved'), 'h2'),
        el('p', { className: 'lists-say', textContent: t('accountSavedWhy') }),
        el('p', { className: 'lists-none', textContent: t('accountSavedNone') }),
        foot([link('backToMap', '/', 'home')])
      ]);
    }

    return card([
      fold('saved', t('listSaved'), countLabel(places.length), [
        el('p', { className: 'lists-say', textContent: t('accountSavedWhy') })
      ].concat(column('saved', places, placeRow))),
      /* The map narrowed to these, which is what the row in the sheet used to
         do and the one thing a column of names cannot: seeing where they are
         in the city next to each other. Outside the fold, like the box that
         makes a list, and for the same reason — it is still two presses from
         the map to the map, which is what this page cost when it took the
         saves off the sheet. ?saved=1 is a door the map opens once and takes
         back off; see readDoors() in assets/app.js. */
      foot([link('accountSavedMap', '/?saved=1', 'saved_map', { places_saved: places.length })])
    ]);
  }

  /* ------------------------------------------------------------------ lists
   * Your lists, the lists you kept, and the box that makes a new one. All
   * three were on /lists.html and two of them were also here, which is how a
   * visitor came to have two pages naming the same lists and a row on each of
   * them pointing at the other.
   *
   * The box stands outside the fold, one line high, under it. That is the rule
   * every way on this page follows, said about a form: a fold that is forty
   * rows long must not be able to push the thing the card is for off the
   * screen. Closed, this card is its title with its count and the field that
   * makes the next one.
   */

  function listRow(l) {
    return row('/list/' + l.id, l.title, [
      /* On your own lists there is nobody to name; on the ones you kept the
         byline is the whole reason the row is worth opening. */
      l.by ? byline(l.by) : null,
      el('span', { textContent: countLabel(l.n) }),
      keepCount(l.keeps),
      /* `=== false` and not `!l.public`: a list is public unless the answer
         says otherwise, and a missing value must not read as a private one.
         The answers that hold other people's lists do not send the column at
         all — every list in them is public by the query that found it. */
      l.public === false ? el('span', { className: 'lists-private', textContent: t('listsPrivate') }) : null
    ], 'list_page', { list_id: l.id }, TTBPins.ofList(l));
  }

  /* Name it and you land in it, because the next thing anybody wants after
     naming a list is to put something on it. The whole of the create step is
     one field and one button; everything else about a list happens on the
     list's own page. */
  function newListForm() {
    var form = el('form', { className: 'lists-new' });
    var field = el('input', {
      type: 'text',
      className: 'lists-input',
      maxlength: String(MAX_TITLE),
      autocomplete: 'off',
      'aria-label': t('listsNewName'),
      placeholder: t('listsNewHint')
    });
    var go = el('button', { type: 'submit', className: 'go', textContent: t('listsCreate') });

    form.appendChild(field);
    form.appendChild(go);

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var title = field.value.trim();
      if (!title) { field.focus(); return; }

      /* Whatever the last try said. It is cleared on the way into this one so
         a refusal that has been answered cannot stand under a form that is
         working — and it is put back above the field rather than under the
         button, because nobody looks under a button they have pressed. */
      var old = form.querySelector('.ac-err');
      if (old) form.removeChild(old);

      go.disabled = true;
      go.textContent = t('accountWorking');

      var refuse = function (out) {
        go.disabled = false;
        go.textContent = t('listsCreate');
        form.insertBefore(
          el('p', { className: 'ac-err', role: 'alert', textContent: t(ERRORS[out && out.error] || 'listsErrGeneric') }),
          field
        );
      };

      post({ action: 'create', title: title }).then(function (a) {
        if (!a.ok) return refuse(a.out);
        TTBTrack.event('list_create', { list_id: a.out.id });
        window.location.href = '/list/' + a.out.id;
      }).catch(function () { refuse({}); });
    });

    return form;
  }

  function listsCard() {
    var kids = [];

    /* The same shape the saved places have, and for the same reasons: the
       column folds behind its own title with the count on the line you press,
       and what is not a column stands under it where a closed fold keeps it in
       sight. A card with nothing in it is not a fold at all — a chevron
       promises something behind it. */
    if (state.lists.length) {
      kids.push(fold('lists', t('listsYours'), listsLabel(state.lists.length), [
        el('p', { className: 'lists-say', textContent: t('listsWhat') })
      ].concat(column('lists', state.lists, listRow))));
    } else {
      kids.push(heading(t('listsYours'), 'h2'));
      kids.push(el('p', { className: 'lists-say', textContent: t('listsWhat') }));
      kids.push(el('p', { className: 'lists-none', textContent: t('listsNone') }));
    }

    kids.push(newListForm());
    return card(kids);
  }

  /* The lists you saved: somebody else's writing, filed on your account. A card
     of its own, drawn only when there is something in it — an empty "Lists
     you saved" under an empty "Your lists" is a page explaining two features
     to somebody who has used neither, and the heading arriving with the first
     keep is how anybody learns the section is there, the same way the map's
     Saved chip arrives with the first mark.

     It shared a card with your own lists for a while, as a second fold under
     the box that makes one, and that card was the confusing one on the page:
     two titles, a form between them, and the second title reading as a
     footnote to the form rather than as the column it was. One card, one
     column, is what every other card here is. */
  function keptCard() {
    if (!state.kept.length) return null;
    return card([fold('kept', t('listsKept'), listsLabel(state.kept.length),
      column('kept', state.kept, listRow))]);
  }

  /* ------------------------------------------------------------------- you */

  /* Your name, what this page is, and the one door that is about you rather
     than about any of your things: your public profile.

     The profile is a row rather than a word along the foot, because it is a
     place to go and it is worth a line saying what — /u/<you> is everything
     you have published, read the way a stranger reads it, and that line is
     what tells this page from that one, since both open with your name. It
     was filed under Your lists once, which was the wrong drawer twice over:
     it is about you rather than about any one list, and down there it sat
     under the very column it is the outside view of. Then it was in a card
     at the foot of the page with the password and the way out.

     The things you can do to the account are along this card's foot, as the
     quiet words under the row: a door is a row and a thing you do is a word,
     which is what tells the profile from the password at a glance. There are
     three of them since a name became something you can change, and they
     are still not the menu that once stood here and made the page read as
     settings — that was three *rows*, each the width of the card, standing
     between somebody's name and their things. See the header.

     The two that change the account come first and in the order they are
     reached for — the name far oftener than the password — and the way out
     is last, where a way out belongs. */
  function youCard() {
    return card([
      el('p', { className: 'eyebrow', textContent: t('accountOpen') }),
      heading(state.user),
      el('p', { className: 'lists-say', textContent: t('accountWhat') }),
      lineBox(DISPLAY),
      lineBox(ABOUT),
      linksBox(),
      rowsBox(),
      el('ul', { className: 'menu' }, [
        door('profileYours', 'profileYoursWhy', '/u/' + encodeURIComponent(state.user), 'profile_open', { name: state.user })
      ]),
      foot([
        /* Into the map's sheet and back again. The ?then= is what makes the
           step land here rather than on the map, which is not where it was
           pressed. Both steps ask for the password in use where there is one,
           and there is one place on this site that asks for a password. */
        link('accountName', SHEET + 'username' + BACK, 'account_rename_open'),
        /* The same step under two names. An account made through Google has
           no password until this gives it one, and "Change password" on a
           card belonging to somebody who has never had one is an instruction
           to do a thing they cannot. */
        link(state.password ? 'accountChange' : 'accountSetPassword',
             SHEET + 'password' + BACK, 'account_password_open'),
        googleRow(),
        signOut()
      ])
    ]);
  }

  /* ------------------------------------------------------- the line about you
   * The one thing anybody writes here about themselves rather than about a
   * restaurant, and it stands on this card because this is the page that says
   * who you are. Sitting directly over the door to /u/<you>, it reads in the
   * order it is used: write the line, then go and see it where everybody else
   * does.
   *
   * IT IS A LINE UNTIL YOU ASK FOR THE FIELD
   *
   * It was a field and a filled Save, standing open on every visit. Two things
   * were wrong with that and they were the same thing twice. The first is that
   * a page which had already spent its accent on the box that makes a list was
   * spending it again here, which is design rule 5 — one filled action per
   * surface, and never two. The second is what that looked like: the loudest
   * thing on somebody's account was a two-hundred-character field nearly
   * nobody has ever written in, and once they had, it stayed open, still loud,
   * saying "Saved" at a line that was already saved.
   *
   * So what stands here is the line itself, quietly, with one word under it
   * to change it — and nothing but that word when there is no line yet. The
   * field arrives when the word is pressed and goes again when the line is
   * saved, which is the shape of a thing somebody does once a year rather than
   * the shape of a thing the page is asking for. The Save inside it is an .alt
   * for the same rule: the accent on this page belongs to the box that makes a
   * list, and it is still spent exactly once while this is open.
   *
   * There is no way out of the field that is not Save, and it does not need
   * one: nothing has gone anywhere until it is pressed, and the field opens
   * holding the line that is already there — so pressing Save on a field
   * opened by accident writes back what was written before.
   *
   * It saves on the press rather than as you type, which is the small version
   * of the promise the list editor makes: nothing about you reaches a server
   * because you stopped halfway through a sentence. Emptying it and pressing
   * Save is how a line comes down again, and the server treats empty as an
   * answer rather than as a mistake — the word goes back to offering one.
   *
   * What is drawn afterwards is what came back rather than what went out. A
   * line cut at two hundred characters would otherwise sit on screen in full,
   * looking saved, until the next time the page was opened.
   *
   * The field itself is the one a list's intro is — one line, two hundred
   * characters, the same class — because it does the same job one floor up: a
   * line under a name, not a page about a person.
   */
  /* The line and the name you go by are one box drawn twice — the same
     word, the same field, the same Save, one action each — so `spec` is
     which of the two it is: the field on the account, the action the server
     takes, the cap, and the four strings. */
  var ABOUT = {
    field: 'about', max: MAX_ABOUT, label: 'accountAbout', hint: 'accountAboutHint',
    add: 'accountAboutAdd', edit: 'accountAboutEdit', open: 'account_about_open', save: 'account_about', state: 'about_state'
  };
  var DISPLAY = {
    field: 'display', max: MAX_DISPLAY, label: 'accountDisplay', hint: 'accountDisplayHint',
    add: 'accountDisplayAdd', edit: 'accountDisplayEdit', open: 'account_display_open', save: 'account_display', state: 'display_state'
  };

  function lineBox(spec) {
    var box = el('div', { className: 'lists-about' });
    var read, write;

    /* The line, and the word that opens the field. The word is the whole of
       what somebody who has never written one sees, so it invites rather than
       labels: there is nothing above it to explain what it would be a change
       to. */
    read = function (focus) {
      clear(box);
      var has = !!state[spec.field];
      var open = el('button', {
        type: 'button',
        className: 'alt',
        textContent: t(has ? spec.edit : spec.add)
      });
      open.addEventListener('click', function () {
        var report = {};
        report[spec.state] = has ? 'set' : 'empty';
        TTBTrack.event(spec.open, report);
        write();
      });
      box.appendChild(el('div', { className: 'lists-row' }, [
        has ? el('p', { className: spec === DISPLAY ? 'lists-shown-as' : 'lists-say', textContent: state[spec.field] }) : null,
        open
      ]));
      /* Only where this word is replacing the field somebody was just typing
         in. On the page's first draw there is nothing to hand focus back to. */
      if (focus) open.focus();
    };

    write = function () {
      clear(box);
      var form = el('form', { className: 'lists-new' });
      var field = el('input', {
        type: 'text',
        className: 'lists-input',
        value: state[spec.field],
        maxlength: String(spec.max),
        autocomplete: 'off',
        'aria-label': t(spec.label),
        placeholder: t(spec.hint)
      });
      var go = el('button', { type: 'submit', className: 'alt', textContent: t('listsSave') });

      form.appendChild(field);
      form.appendChild(go);

      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        go.disabled = true;
        go.textContent = t('accountWorking');

        var failed = function () {
          go.disabled = false;
          go.textContent = t('listsSave');
          toast(t('accountErrGeneric'));
        };

        var body = { action: spec.field };
        body[spec.field] = field.value;
        fetch(ACCOUNT_API, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body)
        }).then(function (res) {
          return res.ok ? res.json() : null;
        }).then(function (out) {
          if (!out) { failed(); return; }
          state[spec.field] = out[spec.field] || '';
          var report = {};
          report[spec.state] = state[spec.field] ? 'set' : 'cleared';
          TTBTrack.event(spec.save, report);
          /* The field going is most of the confirmation, and a line taken down
             leaves nothing behind to read as one — so the page says it in a
             word as well. */
          read(true);
          toast(t('listsSaved'));
        }).catch(failed);
      });

      box.appendChild(form);
      field.focus();
    };

    read(false);
    return box;
  }

  /* ------------------------------------------------ where else you are
   * Instagram, TikTok and Facebook, under the line on /u/<you> and under the
   * line on this card, because the two are the same kind of thing: something
   * somebody typed about themselves rather than anything this site worked out
   * about them.
   *
   * IT OPENS THE WAY THE LINE ABOVE IT DOES
   *
   * What stands here is the links themselves, drawn as the profile draws
   * them, with one quiet word under them to change them — and nothing but
   * that word for the account that has none, which is nearly all of them.
   * The three fields arrive when the word is pressed and go again when they
   * are saved. Anything else would put a second filled Save on a page whose
   * accent is already spent on the box that makes a list, which is design
   * rule 5, and it would spend it on three boxes almost nobody types in.
   *
   * ONE SAVE FOR ALL THREE, AND AN EMPTY FIELD IS A LINK TAKEN DOWN
   *
   * The form is the three links rather than three settings: what is in the
   * boxes when Save is pressed is what is on the profile afterwards, so
   * clearing one is how it comes down. There is no way out that is not Save
   * and none is needed — the fields open holding what is already stored, so
   * pressing Save on a form opened by accident writes back what was there.
   *
   * WHAT IS DRAWN AFTERWARDS IS WHAT CAME BACK
   *
   * Same as the line: the server is what decides what a handle is, and a
   * pasted address comes back as the handle it contained. A field somebody
   * filled in that is not a handle stops the whole write and is said in a
   * word naming the site it was for — never dropped quietly, which would
   * leave somebody looking at a profile with a link missing and nothing
   * anywhere saying why.
   *
   * The table of three is assets/links.js, which the profile draws from too,
   * and functions/api/_profile.js is what binds.
   */
  function linksBox() {
    var box = el('div', { className: 'lists-about' });
    var read, write;
    var nets = TTBLinks.NETWORKS;

    read = function (focus) {
      clear(box);
      var rows = TTBLinks.of(state.links);
      var open = el('button', {
        type: 'button',
        className: 'alt',
        textContent: t(rows.length ? 'accountLinksEdit' : 'accountLinksAdd')
      });
      open.addEventListener('click', function () {
        TTBTrack.event('account_links_open', { links_state: rows.length ? 'set' : 'empty' });
        write();
      });

      var shown = null;
      if (rows.length) {
        shown = el('ul', { className: 'lists-links' });
        rows.forEach(function (row) {
          shown.appendChild(el('li', null, [
            el('a', {
              className: 'lists-link',
              href: row.href,
              target: '_blank',
              rel: 'me nofollow noopener'
            }, [
              el('span', { className: 'lists-link-net mono', textContent: row.label }),
              el('span', { className: 'lists-link-who', textContent: row.shown })
            ])
          ]));
        });
      }

      box.appendChild(el('div', { className: 'lists-row' }, [shown, open]));
      if (focus) open.focus();
    };

    write = function () {
      clear(box);
      var form = el('form', { className: 'lists-new lists-links-form' });
      var fields = {};

      nets.forEach(function (net) {
        var field = el('input', {
          type: 'text',
          className: 'lists-input',
          value: state.links[net.id] || '',
          autocomplete: 'off',
          autocapitalize: 'none',
          spellcheck: 'false',
          /* Named by the <label> below rather than by a placeholder. A
             placeholder is the label right up until somebody types, and these
             three boxes are unlabelled exactly when they are full — which is
             every visit after the first, and the moment it matters most that
             the handle in the second box is the TikTok one. */
          id: 'link-' + net.id
        });

        /* NO MAXLENGTH, AND IT IS THE ONE FIELD ON THIS SITE WITHOUT ONE
           The box takes a pasted address as well as a handle, and an
           Instagram profile URL is fifty characters before the handle starts.
           A maxlength cut one to `https://www.instagram.com/tall`, which
           parses, points at a stranger, and looks like it worked — see the
           header of assets/links.js. The length is in the pattern instead.

           So the handle is shown as soon as the field is left: what was
           pasted becomes what will be stored, in the box, before anybody
           presses Save. A value that is not a handle is left exactly as
           typed, because it is about to be named in a word and somebody has
           to be able to see what they wrote. */
        field.addEventListener('blur', function () {
          var handle = TTBLinks.clean(net.id, field.value);
          if (handle) field.value = handle;
        });

        fields[net.id] = field;
        /* The site's name, in the mono it wears on the profile — it is a
           label and it is the one string on this page that is not in
           data/ui.json, because Instagram is Instagram in all ten of them. */
        form.appendChild(el('label', { className: 'lists-link-field', for: 'link-' + net.id }, [
          el('span', { className: 'lists-link-net mono', textContent: net.label }),
          field
        ]));
      });

      var go = el('button', { type: 'submit', className: 'alt', textContent: t('listsSave') });
      form.appendChild(go);

      form.addEventListener('submit', function (ev) {
        ev.preventDefault();

        /* The same check the server runs, run here first so that a mistyped
           handle costs a keystroke rather than a round trip — the way every
           cap on this site is written twice. The server is still what
           decides; this only saves the trip. */
        var bad = null;
        var body = { action: 'links' };
        nets.forEach(function (net) {
          var typed = fields[net.id].value.replace(/^\s+|\s+$/g, '');
          body[net.id] = typed;
          if (typed && !bad && !TTBLinks.clean(net.id, typed)) bad = net;
        });
        if (bad) {
          toast(t('accountErrLink', { name: bad.label }));
          fields[bad.id].focus();
          return;
        }

        go.disabled = true;
        go.textContent = t('accountWorking');

        var failed = function (which) {
          go.disabled = false;
          go.textContent = t('listsSave');
          toast(which ? t('accountErrLink', { name: which }) : t('accountErrGeneric'));
        };

        fetch(ACCOUNT_API, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body)
        }).then(function (res) {
          return res.json().then(function (out) {
            return { ok: res.ok, out: out };
          });
        }).then(function (answer) {
          if (!answer.ok) {
            /* The one failure this form can explain: the server named the
               network it could not read. Anything else is the generic word,
               because a person cannot act on it. */
            var named = null;
            nets.forEach(function (net) {
              if (answer.out && answer.out.network === net.id) named = net.label;
            });
            failed(named);
            return;
          }
          state.links = answer.out.links || {};
          TTBTrack.event('account_links', {
            links_state: Object.keys(state.links).length ? 'set' : 'cleared'
          });
          read(true);
          toast(t('listsSaved'));
        }).catch(function () { failed(null); });
      });

      box.appendChild(form);
      if (nets.length) fields[nets[0].id].focus();
    };

    read(false);
    return box;
  }

  /* ------------------------------------------------ the page of links
   * The rows under the handles on /u/<you> — a showreel, an agency page, a
   * note, a heading over a group of them — and the form that writes them.
   * assets/rows.js says what a row is and draws them; db/schema.sql says why
   * this one, unlike the handles, stores addresses.
   *
   * IT OPENS THE WAY THE LINE AND THE LINKS DO
   *
   * What stands here is the rows themselves, drawn as the profile draws them
   * minus the players — a picture of the page rather than the page — with
   * one quiet word under them to change them, and nothing but that word for
   * the account that has none. The form arrives when the word is pressed and
   * goes again when the rows are saved, for design rule 5, the same as the
   * two boxes above it.
   *
   * ONE FORM, ONE SAVE, AND THE FORM IS THE PAGE
   *
   * A box per row: the title over the address, or over the note when the row
   * is one, and the quiet words along its foot — write a note instead, move
   * it, remove it. What is in the boxes when Save is pressed is what is on
   * the profile afterwards, in that order, and an empty form takes the page
   * down. The rows are held in `draft`, and the form is redrawn from it
   * whenever a row is added, moved, swapped or removed — after the boxes are
   * read back into it, so nothing typed is lost to a redraw. Arrows rather
   * than dragging, because a thumb cannot drag inside a scrolling card.
   *
   * THE SAME CHECKS THE SERVER RUNS, RUN HERE FIRST
   *
   * A row without a title and an address that is not https stop the save at
   * the keystroke rather than at the round trip, naming the row. The server
   * still decides and names the row the same way, so the cursor lands in the
   * box either way. cleanRows() in functions/api/_profile.js binds.
   */
  function rowsBox() {
    var box = el('div', { className: 'lists-about' });
    var read, write;

    read = function (focus) {
      clear(box);
      var open = el('button', {
        type: 'button',
        className: 'alt',
        textContent: t(state.rows.length ? 'accountRowsEdit' : 'accountRowsAdd')
      });
      open.addEventListener('click', function () {
        TTBTrack.event('account_rows_open', { rows_state: state.rows.length ? 'set' : 'empty' });
        write();
      });

      var shown = null;
      if (state.rows.length) {
        var sheet = TTBRows.sheet(t, false);
        shown = el('div', { className: 'lists-page-shown' }, [
          TTBRows.draw(state.rows, { t: t, play: false, onNote: sheet.open }),
          sheet.node
        ]);
      }

      box.appendChild(el('div', { className: 'lists-row' }, [shown, open]));
      if (focus) open.focus();
    };

    write = function () {
      clear(box);
      var draft = state.rows.map(function (row) {
        return { title: row.title, url: row.url || '', note: row.note || '', asNote: !!row.note };
      });
      /* Somewhere to type, for the account that has nothing yet. */
      if (!draft.length) draft.push({ title: '', url: '', note: '', asNote: false });

      var form = el('form', { className: 'lists-new lists-page-form' });
      var go = el('button', { type: 'submit', className: 'alt', textContent: t('listsSave') });
      var boxes = [];

      function word(label, onPress) {
        var b = el('button', { type: 'button', className: 'alt', textContent: label });
        b.addEventListener('click', onPress);
        return b;
      }

      function sync() {
        boxes.forEach(function (b, i) {
          draft[i].title = b.title.value;
          if (draft[i].asNote) draft[i].note = b.body.value;
          else draft[i].url = b.body.value;
        });
      }

      function redraw(focusAt) {
        clear(form);
        boxes = [];
        form.appendChild(el('p', { className: 'lists-page-help', textContent: t('rowsHelp') }));

        draft.forEach(function (row, i) {
          var title = el('input', {
            type: 'text',
            className: 'lists-input',
            value: row.title,
            maxlength: String(MAX_ROW_TITLE),
            autocomplete: 'off',
            'aria-label': t('rowsTitle'),
            placeholder: t('rowsTitleHint')
          });
          var body = row.asNote
            ? el('textarea', {
              className: 'lists-input',
              maxlength: String(MAX_ROW_NOTE),
              rows: '4',
              'aria-label': t('rowsNote'),
              placeholder: t('rowsNoteHint')
            })
            : el('input', {
              type: 'url',
              className: 'lists-input',
              value: row.url,
              maxlength: String(MAX_ROW_URL),
              autocomplete: 'off',
              autocapitalize: 'none',
              spellcheck: 'false',
              inputmode: 'url',
              'aria-label': t('rowsAddress'),
              placeholder: t('rowsAddressHint')
            });
          if (row.asNote) body.value = row.note;

          var swap = word(t(row.asNote ? 'rowsAsLink' : 'rowsAsNote'), function () {
            sync();
            row.asNote = !row.asNote;
            redraw(i);
          });
          var up = word(t('rowsUp'), function () {
            sync();
            draft.splice(i - 1, 0, draft.splice(i, 1)[0]);
            redraw(i - 1);
          });
          var down = word(t('rowsDown'), function () {
            sync();
            draft.splice(i + 1, 0, draft.splice(i, 1)[0]);
            redraw(i + 1);
          });
          var drop = word(t('rowsRemove'), function () {
            sync();
            draft.splice(i, 1);
            redraw(Math.min(i, draft.length - 1));
          });
          up.disabled = i === 0;
          down.disabled = i === draft.length - 1;

          boxes.push({ title: title, body: body });
          form.appendChild(el('fieldset', { className: 'lists-page-edit' }, [
            title,
            body,
            el('div', { className: 'lists-page-edit-foot' }, [swap, up, down, drop])
          ]));
        });

        var add = word(t('rowsAdd'), function () {
          sync();
          if (draft.length >= MAX_ROWS) { toast(t('rowsErrMany')); return; }
          draft.push({ title: '', url: '', note: '', asNote: false });
          redraw(draft.length - 1);
        });
        form.appendChild(el('div', { className: 'lists-page-form-foot' }, [add, go]));
        if (focusAt >= 0 && boxes[focusAt]) boxes[focusAt].title.focus();
      }

      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        sync();

        var rows = draft.map(function (row) {
          return {
            title: row.title.replace(/\s+/g, ' ').trim(),
            url: row.asNote ? '' : row.url.trim(),
            note: row.asNote ? row.note : ''
          };
        });
        for (var i = 0; i < rows.length; i++) {
          if (!rows[i].title) {
            toast(t('rowsErrTitle', { n: i + 1 }));
            boxes[i].title.focus();
            return;
          }
          if (rows[i].url && !/^https:\/\/[^/]/.test(rows[i].url)) {
            toast(t('rowsErrUrl', { n: i + 1 }));
            boxes[i].body.focus();
            return;
          }
        }

        go.disabled = true;
        go.textContent = t('accountWorking');

        var failed = function (message) {
          go.disabled = false;
          go.textContent = t('listsSave');
          toast(message || t('accountErrGeneric'));
        };

        fetch(ACCOUNT_API, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'rows', rows: rows })
        }).then(function (res) {
          return res.json().then(function (out) {
            return { ok: res.ok, out: out };
          });
        }).then(function (answer) {
          if (!answer.ok) {
            /* The server names the row it stopped at, the way this form
               does, so the cursor lands in the same box either way. The
               table not being there yet is the one failure a person cannot
               fix by trying again, and it is said in its own word. */
            var err = answer.out && answer.out.error;
            var at = answer.out && typeof answer.out.row === 'number' ? answer.out.row : -1;
            if (err === 'row-title' && boxes[at]) { failed(t('rowsErrTitle', { n: at + 1 })); boxes[at].title.focus(); return; }
            if (err === 'row-url' && boxes[at]) { failed(t('rowsErrUrl', { n: at + 1 })); boxes[at].body.focus(); return; }
            failed(err === 'rows-many' ? t('rowsErrMany') : err === 'no-rows-table' ? t('rowsErrOff') : null);
            return;
          }
          state.rows = answer.out.rows || [];
          TTBTrack.event('account_rows', {
            rows_state: state.rows.length ? 'set' : 'cleared',
            rows_count: state.rows.length
          });
          read(true);
          toast(t('listsSaved'));
        }).catch(function () { failed(null); });
      });

      redraw(0);
      box.appendChild(form);
    };

    read(false);
    return box;
  }

  /* --------------------------------------------------------------- Google
   * One word, and only on an account that actually has Google on it:
   * Disconnect, which is one row deleted and a redraw. A button rather than a
   * link, because it changes something — the distinction this site draws
   * everywhere else.
   *
   * THERE IS NO CONNECT
   *
   * There was, along this same foot: a link to /api/google that came back
   * having attached your Google account to the one you were signed in to. It
   * was the answer to a real trap — Continue with Google while signed out
   * always makes a *new* account, because there is no address to match on, so
   * somebody who already had a password account could end up with two — and
   * connecting on purpose while signed in was how the two became one.
   *
   * It is gone because of what it was: an offer, on the page belonging to
   * somebody who made their account with a username and a password, to start
   * using Google. That is a page arguing with a decision its owner has
   * already made, every time they open it, on a card that is meant to say who
   * they are. Nobody had taken it up — the identities table was empty on the
   * day it went — and the trap it answered is still answered for anybody who
   * has not signed up yet, which is by Continue with Google being right there
   * on the sheet the first time.
   *
   * What it costs is said plainly in "Signing in with Google" in README.md:
   * somebody with a password account who presses Continue with Google while
   * signed out still gets a second account, and there is no longer a step on
   * this site that joins the two.
   *
   * So the foot is a word shorter for nearly everybody, and the one account
   * that still sees something here is the one Google made. Disconnecting is
   * one-way now, which is the same rule read the other way round: once it is
   * off, the account is one made without Google, and Google is not offered.
   */
  function googleRow() {
    if (!state.linked) return null;

    var btn = el('button', {
      type: 'button',
      className: 'alt is-danger',
      textContent: t('accountGoogleDisconnect')
    });
    var back = function () {
      btn.disabled = false;
      btn.textContent = t('accountGoogleDisconnect');
    };
    btn.addEventListener('click', function () {
      btn.disabled = true;
      btn.textContent = t('accountWorking');
      post({ action: 'google-unlink' }).then(function (a) {
        if (!a.ok) {
          back();
          /* The one refusal worth a sentence rather than a shrug: an account
             reached only through Google, with Google taken off it, is an
             account nobody could ever sign into again — and there is no reset
             here to rescue it with. The server refuses it; this says what to
             do instead, which is the step directly above this button. */
          toast(t(a.out && a.out.error === 'needs-password'
            ? 'accountErrNeedsPassword' : 'accountErrGeneric'));
          return;
        }
        TTBTrack.event('account_google_unlink');
        state.linked = false;
        render();
        toast(t('accountGoogleGone'));
      }).catch(function () {
        back();
        toast(t('accountErrGeneric'));
      });
    });
    return btn;
  }

  /* Sign out is a button rather than a link because it changes something. The
     map's sheet is where it used to live; it is here because this is the page
     that says who you are, and the way out belongs on the card that does.

     It ends on the map rather than on this page. A signed-out account page is
     an invitation to sign in, which is a fine page and not what somebody who
     just pressed Sign out was asking for. */
  function signOut() {
    var btn = el('button', { type: 'button', className: 'alt is-danger', textContent: t('accountSignOut') });
    btn.addEventListener('click', function () {
      TTBTrack.event('account_logout');
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
        storeSet(SAVED_KEY, '[]');
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
   *
   * Two sentences and not one, because this is where /lists.html sends
   * somebody who has no account: a save needs none, a list does, and a
   * stranger who arrived asking about lists should not have to guess which of
   * the two this page is about.
   */
  function invitation() {
    return card([
      el('p', { className: 'eyebrow', textContent: t('accountOpen') }),
      heading(t('accountTitle')),
      el('p', { className: 'lists-say', textContent: t('accountWhy') }),
      el('p', { className: 'lists-say', textContent: t('listsNeedAccount') }),
      foot([
        link('accountCreate', SHEET + 'up' + BACK, 'account_open', { view: 'up' }, 'go'),
        link('accountSignIn', SHEET + 'in' + BACK, 'account_open', { view: 'in' })
      ])
    ]);
  }

  /* Accounts are off here — no database bound, or this deployment holding the
     other environment's. The saves still work, because they are local until
     somebody signs in, so the page says the one true thing and then draws
     them anyway rather than showing a sign-in that could only fail. Nothing
     else is drawn: the lists are the database, and there is none. */
  function switchedOff() {
    return card([
      el('p', { className: 'eyebrow', textContent: t('accountOpen') }),
      heading(t('accountTitle')),
      el('p', { className: 'lists-say', textContent: t(state.reached ? 'accountErrOff' : 'accountErrReach') }),
      foot([link('backToMap', '/', 'home')])
    ]);
  }

  /* ---------------------------------------------------------------- the page
   * One place decides what is on screen, and it decides it once, after every
   * answer is in. Three states, and each is the whole page rather than a
   * variation on the one before it.
   *
   * The order is the argument this page makes. Who you are, with everything
   * that can be done to the account on the same card; then what is yours —
   * what you kept, what you wrote, what you kept of other people's — and then
   * the page is over, because that is where it stops being about you. Signed
   * out it is the same run with the offer of an account where the name would
   * be, and the saves on this browser as the whole of it. Nothing labels any
   * of it — see the header — and a card with nothing in it is not drawn at
   * all: the lists you kept arrive with the first keep, see keptCard().
   */
  function render() {
    clear(main);
    var wrap = el('div', { className: 'lists-stack' });
    var add = function (node) { if (node) wrap.appendChild(node); };

    if (!state.ready) {
      add(switchedOff());
      add(savedCard());
    } else if (!state.user) {
      add(invitation());
      add(savedCard());
    } else {
      add(youCard());
      add(savedCard());
      add(listsCard());
      add(keptCard());
    }

    main.appendChild(wrap);
  }

  /* ------------------------------------------------------------------ radio
   * The map's button, in this page's header, playing the map's station:
   * assets/radio.js holds the station and the on/off across the walk from the
   * map to here, so the music does not stop at your own name. It draws the
   * button and wires the press itself; all this page owns is the one thing it
   * cannot say — a stream that would not start, in the visitor's language. */
  function mountRadio() {
    window.TTBRadio.mount({
      button: document.getElementById('btn-radio'),
      name: document.getElementById('radio-name'),
      lang: state.lang,
      t: t,
      onchange: function (what) {
        if (what === 'fail') toast(t('radioFail'));
      }
    });
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
      /* What the foot of the card says: Disconnect Google on the one account
         that has Google on it and nothing there on every other, and Set a
         password rather than change the one there is. An account made through
         Google is the one with both. Whether Google is configured on this
         deployment at all is not read here — this page has nothing to draw
         for an account that is not already using it. */
      state.linked = !!account.out.linked;
      state.password = state.user ? !!account.out.password : true;
      state.about = account.out.about || '';
      state.display = account.out.display || '';
      state.links = account.out.links || {};
      state.rows = Object.prototype.toString.call(account.out.rows) === '[object Array]'
        ? account.out.rows
        : [];
      state.saved = Object.prototype.toString.call(account.out.saved) === '[object Array]'
        ? account.out.saved
        : [];

      /* Both asked in the same breath as the one that says whether there is
         anybody to ask about. Signed out the first holds nothing and costs one
         request; waiting for the account's answer before making either would
         be a second round trip, and a page that draws itself twice. */
      state.lists = loaded[3].out.lists || [];
      state.kept = loaded[3].out.kept || [];

      mountRadio();
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
