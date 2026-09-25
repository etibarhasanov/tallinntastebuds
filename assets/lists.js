/* Tallinn Tastebuds — the lists page.
 *
 * The map is mine. A list is somebody else's, and this is the whole of it:
 * making one, filling it, saying something about each place, and the page a
 * stranger lands on when the link is sent to them.
 *
 * Plain browser JavaScript, no modules, no build step, and — for everybody who
 * is reading a list rather than writing one — no Leaflet either. A list is
 * text and this page does not draw a map.
 *
 * The one exception is the square of map inside the "add a place" form, which
 * needs somewhere to drag a pin. Leaflet is fetched the moment that form is
 * opened and never before, so somebody who opened a link to read a top ten
 * downloads none of it. See ensureLeaflet(). It shares the tokens, the card, the
 * eyebrow and the toast with assets/styles.css and adds its own in
 * assets/lists.css.
 *
 * THREE ADDRESSES, ONE FILE, AND NONE OF THEM IS YOU
 *
 * This page had a fourth for as long as lists have existed — /lists.html
 * itself, the index of your own, with the box that made a new one. It has gone
 * to /account.html, where your saved places already were, because two pages
 * naming the same lists is a fork: your things were on your account, except
 * the half of them that was over here, and each page carried a row pointing at
 * the other. What is left in this file is the three addresses that are about
 * something which is not you, and /lists.html now replaces itself with the
 * account page before it draws — see boot().
 *
 *   /list/<id>       one list. Served by functions/list/[id].js, which hands
 *                    back this same document with the list's own title and
 *                    social card in the head and the list itself seeded into
 *                    the page — so a shared link unfurls as what it is, and
 *                    draws without a second round trip.
 *
 *   /lists           everybody's, the most opened first — or most saved, or
 *                    newest — with a field to search them: one column of
 *                    lists, nothing above it and nothing set apart, each row
 *                    a title and the first places on it. On a desk the row
 *                    also carries the list drawn as a shape on the city and
 *                    whose it is; a phone gets neither, because a phone gets
 *                    as many titles on the screen as will fit. Served the same
 *                    way by functions/lists/index.js.
 *                    It is the page that joins the lists to each other rather
 *                    than leaving each one an island reachable only by its own
 *                    link. It was /lists/kept, which said what the page was
 *                    ordered by rather than what was on it, and then
 *                    /lists/public, which said "public" where there is nothing
 *                    else a list at a shared address can be; both are 301s to
 *                    this one now.
 *
 *   /u/<name>        one person: their public lists, and how many times those
 *                    have been kept. Served the same way by
 *                    functions/u/[name].js. It is where a byline leads —
 *                    every list on this site says who put it together, and
 *                    this is the rest of that sentence.
 *
 * THE SIGN-IN FORM IS NOT IN HERE
 *
 * Deliberately. It exists once, in assets/app.js, and this page links to it:
 * `/?account=up` opens the map with the sign-up sheet already open, and it
 * comes back here afterwards. Two copies of a password form is two places for
 * one of them to fall behind, and the one thing worse than an ugly redirect
 * is a sign-in sheet that has quietly stopped matching the API.
 */
(function () {
  'use strict';

  var DEFAULT_LANG = 'en';
  var LANG_KEY = 'ttb.lang';

  /* The two styles the site has, and the one it opens on — the same names,
     the same key and the same default as assets/app.js, which is where they
     are chosen. */
  var STYLES = ['red', 'green'];
  var DEFAULT_STYLE = 'red';
  var STYLE_KEY = 'ttb.style';
  var API = '/api/lists';
  var WHO_API = '/api/profile';

  /* What the server accepts, said again here so a field can stop somebody at
     the keystroke rather than at the round trip. The server is the one that
     binds — these are the same numbers as functions/api/lists.js. */
  var MAX_TITLE = 60;
  var MAX_INTRO = 200;
  var MAX_SAY = 280;
  var MAX_MUST_ORDER = 280;
  var MAX_ITEMS = 50;

  /* The other end of the same judgement. Two places is a pair of opinions
     rather than a recommendation, so a list is three at the least: the page
     offers three empty places from the moment it is made, and the link is not
     worth sending until they are filled. Nothing is ever deleted for falling
     under it — an unfinished list is simply not sharable yet. */
  var MIN_ITEMS = 3;

  /* Where everybody's lists are: the directory, and the one way out of a
     list's own page. */
  var ALL_PATH = '/lists';

  /* The longest search the field will take, and how long a keystroke is held
     before it becomes a request. The cap is the server's — see MAX_QUERY in
     functions/api/_mostkept.js — said again here so the field stops somebody
     at the keystroke rather than at the round trip, the way the four caps
     above it do.

     The wait is a judgement rather than a limit: long enough that a word typed
     at speed is one request instead of six, short enough that nobody who has
     stopped typing is waiting on it. */
  var MAX_QUERY = 60;
  var SEARCH_WAIT = 220;

  /* And how long a search is held before it is *reported*, which is a longer
     pause and a different judgement: the report should say what somebody went
     looking for rather than watch them spell it, so it waits until the typing
     has stopped rather than until it has paused. The directory pays this out
     of its round trip — it reports the search it just ran — and one list's own
     field, which narrows rows already on the page, has no round trip to hide
     behind. trackSearch() in assets/app.js holds the same number. */
  var SEARCH_REPORT = 900;

  /* How far below the window the directory asks for its next page, in pixels.
     About a phone's screen: far enough that at reading speed the rows are
     drawn before the reader reaches the foot, and near enough that somebody
     who stops at row fifteen has not been sent three pages they never saw. */
  var MORE_AHEAD = 600;

  /* The one account nobody can sign in as: the five top tens and a top
     twenty that db/google-lists.sql writes out of Google's numbers — see
     tools/googlelists.mjs, which is the only thing that writes under the
     name. Its byline says where the lists came from rather than naming an
     account no reader would recognise; see byline(). */
  var GOOGLE_BY = 'google-statistics';

  /* The panel a row's sky is drawn into: its own proportions, so nothing is
     cropped, and a little padding so a dot on the edge of a list is a dot
     rather than half of one.

     It was one fixed box over the whole city for a while — the same square of
     Tallinn on every card, on the argument that a shared frame is what lets
     two cards be read against each other. What that missed is where the lists
     are. Nearly every one of them is inside the same square kilometre of the
     middle, so the shared frame drew the same picture twenty times over, with
     two thirds of each panel empty. A frame fitted to the list is the other
     trade: the cards stop sharing a scale, and the corner has to say what the
     scale is — which is what the label under across() is for, and is worth
     more than the comparison it replaces, because "can I walk this?" is a
     question somebody actually has. */
  var SKY = { w: 120, h: 52, pad: 7 };

  /* The floor under a fitted frame, in degrees of latitude — about a kilometre
     and a half. Without one, a list of three cafés on the same street zooms
     until the city under it is featureless and the panel is three dots on
     nothing again, at the other end of the same mistake. */
  var SKY_FLOOR = 0.014;

  /* The air left around a list's own places inside its frame, so the outermost
     dot is not against the padding. */
  var SKY_AIR = 1.35;

  /* Good enough for a label that prints one decimal place. */
  var KM_PER_DEGREE = 111.32;

  /* The three orders the directory can be read in, in the order the chips
     stand, the first being the default. Mirrors SORTS in
     functions/api/_mostkept.js, which is what binds: an order the API does not
     know is the default there, so a chip here that the API did not know would
     be a chip that did nothing. */
  var SORTS = ['views', 'kept', 'new'];

  /* Where a row stops being a phone's row and becomes a desk's: the same 900px
     assets/lists.css lays the rows out two across at.

     It is asked in the script as well as in the stylesheet because two of the
     things a wide row carries cost more than a `display: none` would save. The
     sky is a few hundred SVG circles a row — twenty rows of them — and the
     city they are drawn on is a nineteen-kilobyte fetch that exists only to
     fill them. A phone that draws neither has not hidden them; it has not
     built them. The byline is the cheap one and goes with them so that what a
     narrow row carries is decided in one place: the title, the count, and the
     names. */
  var WIDE = '(min-width: 900px)';

  function wide() {
    return !!(window.matchMedia && window.matchMedia(WIDE).matches);
  }

  var state = {
    ui: {},
    types: [],         // data/taxonomy.json, for the rows that carry Google's words
    lang: DEFAULT_LANG,
    /* 'one' | 'all' | 'who'. Which of the three addresses this is. */
    view: 'one',
    me: null,          // the signed-in username, or null
    ready: false,      // whether the API says lists work at all here
    reached: true,     // whether it answered at all
    all: null,         // the directory: everybody's, in the order below
    sort: 'views',     // 'views' | 'kept' | 'new' — which order the rows are in
    city: null,        // data/city.json as [lat, lng], the ground under every sky
    next: '',          // where the directory's next page starts, '' at the end
    q: '',             // what the directory is being searched for, '' for all
    find: '',          // and what one list is being searched for, '' for all
    asking: false,     // a page of the directory is in flight
    searching: false,  // a search is in flight, so the rows on screen are the old one's
    list: null,        // the one being shown
    profile: null,     // the person being shown
    places: null,      // /api/places, loaded the first time the picker opens
    hay: null          // id -> folded searchable text
  };

  var dom = {};
  var toastTimer = null;
  /* The keystroke waiting to become a search, and the number of the last search
     asked for. Both belong to the directory's field and neither is state the
     page draws, which is why they are here rather than in state. */
  var searchTimer = null;
  var searchSeq = 0;
  /* And the one on one list's own field, which holds the report rather than
     the search: the rows narrow on the keystroke — see findTyped(). */
  var findTimer = null;
  /* The watch on the directory's Show more button, which presses it as it
     comes into view. One at a time: the button is rebuilt with every page and
     every search, and the watch is rebuilt with it — see moreLine(). */
  var moreWatch = null;

  /* And the one that tells the bar over a list when the title it repeats has
     gone off the top — see nameWhenPast(). Same rule: one at a time, rebuilt
     with the view. */
  var barWatch = null;

  /* --------------------------------------------------------------- helpers */

  function $(id) { return document.getElementById(id); }

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

  function toast(message) {
    dom.toast.textContent = message;
    dom.toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { dom.toast.hidden = true; }, 3800);
  }

  function getJSON(url) {
    return fetch(url, { headers: { accept: 'application/json' } }).then(function (res) {
      if (!res.ok) throw new Error(url + ': ' + res.status);
      return res.json();
    });
  }

  /* The API, asked in a way that keeps the three answers apart, because the
     page says something different for each of them: 404 is a list that is not
     there, no status at all is a browser that could not reach the site, and
     anything else is an answer to read. A helper that threw on 404 would
     collapse the first two into "something went wrong". */
  function ask(url) {
    return fetch(url, { headers: { accept: 'application/json' } })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (out) {
          return { status: res.status, out: out || {} };
        });
      })
      .catch(function () { return { status: 0, out: {} }; });
  }

  /* Same folding as the map's search, and for the same reason: nobody types
     Põhjala with the tilde or Šašlõkk with the caron. */
  function fold(value) {
    var out = String(value == null ? '' : value).toLowerCase();
    try { out = out.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { /* older engine */ }
    return out.replace(/[\u0131\u0130]/g, 'i').replace(/\u00f8/g, 'o').replace(/\u00df/g, 'ss');
  }

  /* The style the site is wearing.
   *
   * The map has the swatches and writes the choice to localStorage; this page
   * has no switch of its own and reads it, the same way it reads the language
   * and for the same reason — walking from the map to your own list should
   * not feel like leaving. Same two keys and same fallback as the pass pages,
   * see applyStyle() in assets/pass.js.
   *
   * Everything drawn here is built out of the tokens the styles restate, so
   * this one attribute is the whole of it: the cards, the buttons and the
   * Save mark all follow whichever one is on, and nothing on the page names
   * a colour that could fail to change with it.
   */
  function applyStyle() {
    var fromUrl = new URLSearchParams(window.location.search).get('style');
    var stored = storeGet(STYLE_KEY);
    var style = STYLES.indexOf(fromUrl) !== -1 ? fromUrl
              : STYLES.indexOf(stored) !== -1 ? stored
              : DEFAULT_STYLE;

    document.documentElement.setAttribute('data-style', style);
    /* Which form controls and scrollbars the browser should draw — this page
       is mostly fields, so getting it wrong is a white box on a dark card. */
    document.documentElement.style.colorScheme = style === 'green' ? 'dark' : 'light';

    /* And the browser's own chrome, which the document had to name in the
       head before any of this ran. */
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

  /* There is no language switch on this page. The map has one, it writes the
     choice to localStorage, and this reads it — so the two pages agree without
     a second copy of the switch, and a shared link can still carry ?lang= for
     somebody who has never opened the map at all. */
  function applyStaticStrings() {
    document.documentElement.lang = state.lang;

    var each = function (attr, apply) {
      var nodes = document.querySelectorAll('[' + attr + ']');
      for (var i = 0; i < nodes.length; i++) apply(nodes[i], nodes[i].getAttribute(attr));
    };
    each('data-i18n', function (n, k) { n.textContent = t(k); });
    each('data-i18n-aria-label', function (n, k) { n.setAttribute('aria-label', t(k)); });
    each('data-i18n-placeholder', function (n, k) { n.setAttribute('placeholder', t(k)); });
    each('data-i18n-title', function (n, k) { n.setAttribute('title', t(k)); });
  }

  /* ------------------------------------------------------------------- api */

  /* Every write this page makes goes through here, and that is what lets the
     Save button be honest without each caller remembering to tell it: the
     count of writes in the air goes up here and comes back down when the
     answer does. See the mark, further down. */
  function post(payload) {
    mark.sending++;
    paintSave();

    var landed = function () { mark.sending--; settled(); };

    return fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (out) {
        return { ok: res.ok, out: out || {} };
      });
    }).then(function (answer) {
      landed();
      return answer;
    }, function (err) {
      landed();
      throw err;
    });
  }

  /* ----------------------------------------------- how often it is opened
   * A list opened is one row in press_counts, the way a place opened on the
   * map is and a card pressed on /google is: same route, same rule, same
   * silence around it — see functions/api/stats.js, which holds all three
   * kinds, and countPress() in assets/app.js, which is the same six lines.
   *
   * It is what orders /lists, and that is the whole of what the number does.
   * Nothing draws it, nothing is told about it, and the answer is not read:
   * the route replies 200 whatever happened, because a list that opened is
   * the feature and a count that did not go up is not worth a word.
   *
   * Once per load of a list's own page, whoever the reader came from — the
   * directory, a link somebody sent, a byline, a search result — because that
   * is the gesture the number is about. Not when the owner opens their own —
   * the check for that is in boot(), beside the call: a list its author
   * reloads while editing it would otherwise climb a page ranked on strangers.
   *
   * There is no `counted` map beside this one, unlike the two files named
   * above.
   * Those pages open a place, close it and open it again without reloading;
   * this one is a page per list, and the only way to open the same list twice
   * is to load the page twice — which is two opens, and is meant to be. */
  function countOpen(id) {
    fetch('/api/stats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'list', id: id })
    }).catch(function () { /* the order misses one, the list still opened */ });
  }

  /* One sentence per refusal the server can send, and the general one for
     anything unrecognised — a visitor should never be shown a word out of the
     source. */
  var ERRORS = {
    'too-many': 'listsErrTooMany',
    full: 'listsErrFull',
    title: 'listsErrTitle',
    'signed-out': 'listsErrSignedOut',
    'not-found': 'listsErrGone',
    place: 'listsErrPlace',
    /* Keeping your own list. The page never offers the button on one, so this
       is a request that did not come from the page — but a refusal a visitor
       could somehow reach still gets a sentence rather than a word out of the
       source. */
    own: 'listsErrOwn',
    /* Adding a place: no name, or a pin that is not near Tallinn. */
    name: 'listsErrName',
    where: 'listsErrWhere'
  };

  function failed(out) {
    toast(t(ERRORS[out && out.error] || 'listsErrGeneric'));
  }

  /* ------------------------------------------------------------- who you are
   * The header's one link, and the only place this page says anything about
   * accounts. Signed in it wears the username and goes to the account sheet;
   * signed out it is not drawn at all — the pages that need a sign-in say so
   * in the middle of the screen, where somebody is actually looking.
   */
  function paintWho() {
    if (!state.me) { dom.who.hidden = true; return; }
    dom.who.hidden = false;
    dom.who.textContent = state.me;
    dom.who.href = '/?account=me';
    dom.who.setAttribute('aria-label', t('accountSignedIn', { name: state.me }));
  }

  /* The map, with the account sheet already open on the right view and this
     page named as where to come back to. assets/app.js reads both. */
  function accountHref(view) {
    return '/?account=' + view + '&then=' + encodeURIComponent(here());
  }

  function here() {
    return window.location.pathname + window.location.search;
  }

  /* ------------------------------------------------------------------ pieces
   * Small shapes the three views share, so a heading, a button and a note
   * look the same wherever they turn up.
   */

  function card(kids) { return el('section', { className: 'card lists-card' }, kids); }

  /* A string, or the pieces of a line — a list's own pin in front of its
     title is the only caller that hands over nodes, and el() takes either. */
  function heading(text, small) {
    var tag = small ? 'h2' : 'h1';
    if (typeof text === 'string') return el(tag, { className: 'lists-title', textContent: text });
    return el(tag, { className: 'lists-title' }, text);
  }

  function button(label, className, onClick) {
    var b = el('button', { type: 'button', className: className, textContent: label });
    b.addEventListener('click', onClick);
    return b;
  }

  function countLabel(n) {
    return n === 1 ? t('listCountOne') : t('listCount', { n: n });
  }

  /* An icon button that says its own name to a screen reader and shows it on
     hover, because the row it sits in has no room to print three of them. */
  function iconButton(labelKey, path, onClick, className) {
    var b = el('button', {
      type: 'button',
      className: 'row-btn' + (className ? ' ' + className : ''),
      'aria-label': t(labelKey),
      title: t(labelKey),
      html: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + path + '</svg>'
    });
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }

  /* The grip: six dots, which is the mark a thing that can be picked up wears
     everywhere. It is a real button and not a decoration, because a drag is no
     gesture at all on a keyboard — the arrow keys on it make the same move. */
  var ICON_GRIP = '<circle cx="9" cy="6" r="1.35"/><circle cx="15" cy="6" r="1.35"/>' +
    '<circle cx="9" cy="12" r="1.35"/><circle cx="15" cy="12" r="1.35"/>' +
    '<circle cx="9" cy="18" r="1.35"/><circle cx="15" cy="18" r="1.35"/>';
  var ICON_X = '<path d="M6 6l12 12M18 6L6 18"/>';
  var ICON_PIN = '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>';
  /* The same bookmark the map draws on a place, because it is the same
     gesture said about the other kind of object this site has: keep this. A
     kept list fills; an unkept one is the outline. */
  var ICON_KEEP = '<path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z"/>';
  /* A list's own pin, drawn small, in front of its title.
   *
   * It is the same glyph in the same tone its places wear on the map, which
   * is the point: a drawer of twenty lists is twenty titles set in the same
   * face, and a reader looking for the bakeries one is reading them all. A
   * croissant in front of it is found without reading anything.
   *
   * aria-hidden, and deliberately. The title beside it already says what the
   * list is, in the list's own words and in the reader's own language, and a
   * screen reader announcing "croissant, the bakeries worth the walk" is a
   * decoration read aloud. The picker is where the glyphs have names.
   */
  function listPin(l) {
    return TTBPins.paint(
      el('span', { className: 'lists-pin', 'aria-hidden': 'true' }),
      TTBPins.ofList(l)
    );
  }

  /* Every list opens on the map, which is where places belong: the whole list
     as pins, in the order its owner put them in. One href, built in one
     place, so the two index sections and both list heads cannot drift.

     ?list= rather than a path of its own. The map is one page and the map's
     doors are query parameters — ?spot=, ?type=, ?story=, ?account= — and
     this is another door onto the same map rather than a second map. */
  function mapHref(id) {
    return '/?list=' + encodeURIComponent(id);
  }

  /* Where a byline goes. Every list on this site says who put it together,
     and this is what that name leads to: the rest of what they have published.

     A path and not a query, unlike the map's doors, because it is not another
     way of looking at the map — it is a page about a person, the way
     /list/<id> is a page about a list. */
  function profileHref(name) {
    return '/u/' + encodeURIComponent(name);
  }

  /* The byline, and the door it is. Every list somebody else wrote says who
     wrote it — under its own title, on the directory, under Lists you saved —
     and the name leads to the rest of what that person has published. A
     profile's own rows carry no byline: they are all that person's, and the
     name is the heading over them.

     The name is the link and the words around it are not. The whole phrase was
     underlined for a while, on the argument that the name is three or four
     characters on a phone and that splitting a translated sentence around it
     would mean assembling one out of pieces in ten languages. The first half
     of that was a small target bought with a misleading one: "created by"
     underlined reads as a caption about the list, and the thing a byline
     leads to is the person. The second half is not true of the strings as
     they are written — every language's phrase carries the name as a
     placeholder, so the sentence is still one string per language, cut at
     the placeholder rather than composed. The account page and the map's
     panel draw the same byline the same way, out of assets/account.js and
     assets/app.js.

     One name is not printed: the lists Google's numbers wrote are under an
     account called google-statistics, and "created by google-statistics" is
     a sentence about how the site is built, not about the list. Those read
     "generated from Google Maps", and the link is the product's name, still
     leading to the account's profile, whose line under the name says how the
     order was decided. */
  function byline(name) {
    var google = name === GOOGLE_BY;
    var words = t(google ? 'listsByGoogle' : 'listsBy').split('{name}');
    return el('span', { className: 'lists-index-by' }, [
      words[0],
      TTBTrack.click(el('a', {
        href: profileHref(name),
        textContent: google ? 'Google Maps' : name
      }), 'profile_open', { name: name }),
      words[1]
    ]);
  }

  /* Back to the map, at the foot of a profile and of every card that stands
     in for a list that could not be read. Reported as `home`, the same as the
     wordmark. A list that could be read has the bar and the foot instead. */
  function backLink() {
    return TTBTrack.click(el('a', { className: 'alt', href: '/', textContent: t('backToMap') }), 'home');
  }

  /* The door onto the map, wearing the same outlined pill wherever it turns
     up: on your own list, where Save has the accent, and in the corner of each
     row on a profile. Each caller used to name that pill for itself, because
     there was a third weight — filled, on somebody else's list, where it was
     the one thing that card asked for. That one is half of the switch in the
     bar now, so the look is stated once here and `extra` is only where a
     caller has something to add about where the pill sits. */
  function mapLink(id, extra) {
    return TTBTrack.click(el('a', {
      className: 'alt lists-map' + (extra ? ' ' + extra : ''),
      href: mapHref(id),
      textContent: t('listsOnMap')
    }), 'list_map', { list_id: id });
  }

  /* How many people have this list bookmarked, drawn only once somebody has.
     A "0 kept" under a list reads as a verdict on the list rather than as
     nobody having pressed it yet, which is the same argument that hides a
     save count at zero on the map. */
  function keepCount(n) {
    if (!n) return null;
    return el('span', {
      className: 'lists-keeps mono',
      textContent: n === 1 ? t('listsKeptOne') : t('listsKeptN', { n: n })
    });
  }

  /* ----------------------------------------------------------------- render
   * One function decides which of the page's states is on screen, so nothing
   * can be left over from the one before it. paintView() below is that
   * function; render() is it plus the one thing that can only be done once it
   * has finished.
   */
  function render() {
    paintView();
    /* After, and not inside: the band's height is not knowable until it is in
       the document, and every one of paintView()'s five ways out either draws
       one or leaves the page without one. */
    dockRoom();
  }

  /* How much air the last card needs under it so the band at the foot of the
     window is not standing on it.

     It was a number in the stylesheet while the band held one pill: 92px, which
     was that pill plus its padding plus a breath. Your own list's band holds
     two controls — see listDockMine() — and a row of two controls wraps. At
     390px, the width this site is measured against, the pair fits on one row in
     all ten languages; at 320px it fits in none of them and the band is two
     rows tall. A number written for one row is then wrong by the height of the
     other, and it is wrong in the direction that hides the last place on the
     list, which is the thing the band exists to stop happening to the buttons.

     A breakpoint would cover the width. What it would not cover is the reason
     the width is not the whole question: the band is as tall as its two labels
     wrap, and those are ten translations of two strings that anybody may reword
     and that an eleventh language will arrive beside. A number here would go
     stale on that day, silently, and in the same direction. A measurement
     cannot.

     An observer rather than a resize listener for the same reason — the band
     changes height without the window changing size, when a font finishes
     loading or the strings arrive a beat after the markup. Where there is no
     ResizeObserver the one measurement taken here still holds, and the fallback
     in the stylesheet holds before that. */
  var roomWatch = null;

  function dockRoom() {
    if (roomWatch) { roomWatch.disconnect(); roomWatch = null; }

    var dock = dom.main.querySelector('.lists-dock');
    if (!dock) {
      document.body.style.removeProperty('--dock-room');
      return;
    }

    function write() {
      document.body.style.setProperty('--dock-room', dock.offsetHeight + 'px');
    }
    write();

    if (window.ResizeObserver) {
      roomWatch = new ResizeObserver(write);
      roomWatch.observe(dock);
    }
  }

  /* The states themselves. Every way out of this leaves <main> holding exactly
     one of them. */
  function paintView() {
    clear(dom.main);
    /* The Save button is about to be rebuilt, or not drawn at all on a view
       that has none. A mark still pointing at the old node would be painting
       a button that is no longer in the document; whoever draws one claims it
       again on the way past. */
    mark.btn = null;
    paintWho();

    /* The directory is the one page here that is wider than a column of
       prose: rows three across on a desk, the strip five across. Every other
       view keeps the 640px a list reads at. Toggled here rather than set once
       at boot so a view that is not the directory never inherits it. */
    dom.main.classList.toggle('is-wide', state.view === 'all');

    /* A list read on its own page is the one view with a bar fixed to the foot
       of the window, and the page has to keep its last card out from under it.
       hasDock() is the same question renderOne() asks before drawing one, and
       it is asked in both places rather than remembered in a flag — the room
       and the bar have to agree, and two states cannot disagree if there is
       only one of them. Set here, beside the width, for the same reason: one
       place decides, so no view can inherit it from the one before. */
    document.body.classList.toggle('has-dock',
      state.view === 'one' && !!state.list && hasDock(state.list));

    if (!state.reached) { dom.main.appendChild(renderUnreachable()); return; }
    if (!state.ready) { dom.main.appendChild(renderNotReady()); return; }
    if (state.view === 'all') { dom.main.appendChild(renderAll()); return; }
    if (state.view === 'who') { dom.main.appendChild(renderProfile()); return; }

    dom.main.appendChild(renderOne());
  }

  /* The site answered nothing at all: offline, or a Function that is not
     deployed. Distinct from the card below, which is the site saying clearly
     that this feature is switched off here — telling somebody to check their
     connection when the answer was "no database bound" would send them looking
     in the wrong place, and the reverse is worse. */
  function renderUnreachable() {
    return card([
      el('p', { className: 'eyebrow', textContent: t('listsEyebrow') }),
      heading(t('listsTitle')),
      el('p', { className: 'lists-say', textContent: t('loadError') }),
      backLink()
    ]);
  }

  /* No database bound, no salt set, or a preview deployment holding the live
     database. The same three conditions that hide the account button on the
     map, and the same reason for saying so rather than drawing a page whose
     every button would fail. */
  function renderNotReady() {
    return card([
      el('p', { className: 'eyebrow', textContent: t('listsEyebrow') }),
      heading(t('listsTitle')),
      el('p', { className: 'lists-say', textContent: t('listsErrOff') }),
      backLink()
    ]);
  }

  /* One list, as a row in a column of them — a profile's, which is the one
     column of these left in this file. It drew three at its widest: your own
     lists, the ones you kept and a profile's, with a byline where the list was
     somebody else's and a private pill where it was yours and shut. The first
     two are on /account.html now, which draws the flatter .lists-all-card for
     them, and neither of those two parts survived the move: a profile is one
     person's public lists, so there is nobody to name over them and nothing on
     the page that a stranger may not read. The same row on /account.html
     carries both again, out of assets/account.js.

     The card is a box and the title is the link, which .lists-open stretches
     over the whole face of it. It was the card itself until the byline became
     a door of its own, and a link inside a link is not a thing HTML has; the
     map button in the corner was already a sibling laid over it for the same
     reason. What it buys is the name of the link: the title, rather than the
     title and every number beside it read out in one breath. */
  function listRow(l) {
    var box = el('div', { className: 'lists-index-card' }, [
      TTBTrack.click(el('a', {
        className: 'lists-index-title lists-open',
        href: '/list/' + l.id
      }, [listPin(l), el('span', { textContent: l.title })]), 'list_page', { list_id: l.id }),
      el('span', { className: 'lists-index-meta mono' }, [
        el('span', { textContent: countLabel(l.n) }),
        /* How many people kept it — the one fact about a list its own author
           cannot know by looking at it, which is why their own profile prints
           it back to them the same way a stranger reads it. */
        keepCount(l.keeps)
      ])
    ]);
    return el('li', { className: 'lists-index-row' }, [box, mapLink(l.id, 'lists-index-map')]);
  }

  /* ------------------------------------------------------------ one person
   * /u/<name>: what a byline leads to.
   *
   * Every list on this site has said who put it together since the day lists
   * were written, and the name was where the sentence stopped. This is the
   * rest of it — the other lists that person has published, and the one
   * number this site keeps about anybody.
   *
   * PUBLIC ONLY, INCLUDING FOR ITS OWNER
   *
   * The page shows the same thing to everybody, and that is deliberate rather
   * than a limitation nobody got round to: the value of a profile you can see
   * is knowing what other people see on it. Your own private lists are on
   * /account.html, where every list you wrote is named, and your name in the
   * header is the way there from any page — this card carried a second door
   * to the same place for a while, and it was one link too many.
   */
  function renderProfile() {
    var who = state.profile;

    if (!who) {
      return card([
        el('p', { className: 'eyebrow', textContent: t('profileEyebrow') }),
        heading(t('listsGoneTitle')),
        el('p', { className: 'lists-say', textContent: t('profileErrGone') }),
        backLink()
      ]);
    }

    var wrap = el('div', { className: 'lists-stack' });

    wrap.appendChild(card([
      el('p', { className: 'eyebrow', textContent: t('profileEyebrow') }),
      heading(who.name),
      /* Their own line, when they wrote one, above the one number this site
         keeps about anybody: what somebody says about themselves outranks a
         count of how often strangers bookmarked them, and it should not be
         read underneath it.

         Nothing at all when there is none, which is nearly every account —
         the same rule the standing and every save count on this site follow.
         A box saying "this person has not written anything" is a page telling
         a reader about an empty field rather than about a person. */
      who.about ? el('p', { className: 'lists-say', textContent: who.about }) : null,
      /* And the three places they said they are, under the line and above the
         number for the same reason the line is: what somebody chose to say
         about themselves comes before what strangers did with their lists. */
      profileLinks(who.links),
      standing(who.kept),
      /* The year and not the day. When somebody made an account is context
         for the number above it rather than a record of them — and a year is
         the one unit of time that needs no case, no ordinal and no month name
         to sit inside a sentence in all ten of these languages. */
      el('p', {
        className: 'lists-say',
        textContent: t('profileSince', { when: new Date(who.since).getFullYear() })
      })
    ]));

    if (!who.lists.length) {
      wrap.appendChild(el('p', { className: 'lists-none', textContent: t('profileNone') }));
    } else {
      var ul = el('ul', { className: 'lists-index' });
      who.lists.forEach(function (l) { ul.appendChild(listRow(l)); });
      wrap.appendChild(ul);
    }

    wrap.appendChild(backLink());
    return wrap;
  }

  /* Where else they are: the handles they wrote on /account.html, as links.
   *
   * ASSETS/LINKS.JS BUILDS THE ADDRESS, AND NOTHING HERE DOES
   *
   * What comes back from the server is a handle per network and never a URL —
   * see functions/api/_profile.js for why a profile, which is the one page
   * here that links off this site, must not be able to point anywhere
   * somebody typed. of() reads the answer against the same table the server
   * validated it with, so a network this site has stopped drawing, or a
   * handle that would no longer be accepted, is one that quietly stops being
   * printed rather than one that outlives the rule.
   *
   * Nothing at all where nobody wrote any, which is nearly every account —
   * the same rule the line, the standing and every count on this site follow.
   *
   * `nofollow` because a profile is indexed and these are links anybody can
   * add to a page under their own name; `me` because that is what a link from
   * a person's page to their account on another site is, and a reader's
   * browser and a search engine both have a use for knowing it.
   */
  function profileLinks(links) {
    var rows = TTBLinks.of(links);
    if (!rows.length) return null;

    var ul = el('ul', { className: 'lists-links' });
    rows.forEach(function (row) {
      ul.appendChild(el('li', null, [
        TTBTrack.click(el('a', {
          className: 'lists-link',
          href: row.href,
          target: '_blank',
          rel: 'me nofollow noopener'
        }, [
          /* The site's name in the mono, because it is a label; the handle in
             the body face beside it, because it is what somebody is called.
             Design rule 2, and it is what keeps three links from reading as
             three buttons. */
          el('span', { className: 'lists-link-net mono', textContent: row.label }),
          el('span', { className: 'lists-link-who', textContent: row.shown })
        ]), 'profile_link_open', { network: row.id })
      ]));
    });
    return ul;
  }

  /* The standing: how many times, in all, other people have kept the lists on
     this page. It is the sum of the numbers under them, which is why it is
     the number and not a position — see functions/api/_profile.js for what
     "third of everybody" would have cost.

     Nothing at all at nought, the same as a keep count under a list and a
     save count on the map. A "kept 0 times" line on somebody's page reads as
     a verdict on them rather than as a feature they have not been given yet,
     and the first keep is how anybody finds out the number is there. */
  function standing(n) {
    if (!n) return null;
    return el('p', {
      className: 'lists-standing mono',
      textContent: n === 1 ? t('profileKeptOne') : t('profileKept', { n: formatNumber(n) })
    });
  }

  /* ---------------------------------------------------------- public lists
   * Every public list on this site, the most opened first, and a field to find
   * one among them.
   *
   * It is the one page here that puts one person's writing above another's.
   * The argument for that, and what it costs, is in README.md under **Public
   * lists** — this is only how it is drawn.
   *
   * The row is the index row restacked. The title, then one line led by the
   * count the page is ordered on, then the first three places off the list,
   * and the bookmark in the corner. Those three names are the difference
   * between this page and a page of links: "Top ten burgers" tells somebody
   * who has never heard of its author nothing at all, and
   * "Ferment · Kaerajaan · Rataskaevu 16" tells them whether to open it.
   *
   * The count leads the line rather than sitting against the right edge, where
   * it started. Justified to the two ends of a flex row it strands itself on a
   * line of its own the moment a phone is narrow enough — right-aligned under
   * a title, belonging to nothing. Written as text it simply wraps.
   *
   * There is no "7 places" on this row, and there was. Knowing how many places
   * a list holds means reading every one of them, so twenty rows cost four
   * hundred to draw and the cost grew with how much people wrote — to print
   * the least informative thing on the row, beside three names that say the
   * same thing better. It is on your own lists and on a list's own page, where
   * the rows are already in hand. See functions/api/_mostkept.js.
   *
   * THE ONE VIEW HERE THAT IS NOT REDRAWN WHOLE
   *
   * Every other state of this page is built by render(), which empties <main>
   * first so nothing can be left over from the state before. This one cannot
   * be: the search field is in it, and a field rebuilt between two keystrokes
   * loses the caret, the selection and — on a phone — the keyboard. It is the
   * same reason the "add a place" picker is static markup in lists.html rather
   * than built each time it is opened.
   *
   * So render() builds the head of this page once, and everything under it
   * that changes — the rows, Show more, the note where there are none — is
   * painted into dom.allBody by paintAll(). A search and a Show more both end
   * there.
   */

  function renderAll() {
    var wrap = el('div', { className: 'lists-stack lists-all' });

    wrap.appendChild(card([
      el('p', { className: 'eyebrow', textContent: t('listsEyebrow') }),
      heading(t('listsAllTitle')),
      el('p', { className: 'lists-say', textContent: t('listsAllSay') })
    ]));
    wrap.appendChild(searchField());

    dom.allBody = el('div', { className: 'lists-all-body' });
    wrap.appendChild(dom.allBody);
    paintAll();
    cityDots();
    watchWidth();

    return wrap;
  }

  /* The address the directory is asked at, with whatever narrows it: the
     search, and the order when it is not the default. One builder because
     the first page, a search, a re-order and Show more all have to ask the
     same question with one more parameter, and four copies of the string
     is four ways for one of them to forget the sort. */
  function allUrl(extra) {
    return API + '?all=1' +
      (state.q ? '&q=' + encodeURIComponent(state.q) : '') +
      (state.sort !== 'views' ? '&sort=' + state.sort : '') +
      (extra || '');
  }

  /* And the page's own address, kept in step the same way — see search() for
     why replaceState. */
  function allAddress() {
    var parts = [];
    if (state.q) parts.push('q=' + encodeURIComponent(state.q));
    if (state.sort !== 'views') parts.push('sort=' + state.sort);
    return ALL_PATH + (parts.length ? '?' + parts.join('&') : '');
  }

  /* The order, as a row of chips beside the search field: the same .chip the
     map's filter row is made of, pressed the same way, because it is the same
     kind of control — a toggle over what the page shows — asked about a
     different kind of thing. Three: how often a list has been opened is the
     page's own order, and the keeps and Newest are the two ways past the top
     of it.

     Most opened is a chip that names a number the rows do not print, which is
     deliberate and is the only one of the three like that. The name of the
     order is what a reader needs — it says what they are looking at — and a
     figure on every row would turn twenty pieces of writing into a scoreboard
     with the author's name under each score. See allMeta().

     There was a fourth once, Changed lately, and it went. It ordered on
     `updated_at`, which is a fact about when somebody was last editing rather
     than about the list — a title fixed the same afternoon put a list above
     one finished a week ago and left alone since — and a reader looking for
     something to open was never asking that question. */
  function orderLabel(key) {
    return t(key === 'new' ? 'listsOrderNew' : key === 'kept' ? 'listsOrderKept' : 'listsOrderViews');
  }

  function orderRow() {
    var row = el('div', { className: 'lists-order', role: 'group', 'aria-label': t('listsOrder') }, [
      el('span', { className: 'eyebrow', textContent: t('listsOrder') })
    ]);
    SORTS.forEach(function (key) {
      var chip = el('button', {
        type: 'button',
        className: 'chip',
        'data-sort': key,
        'aria-pressed': String(key === state.sort),
        textContent: orderLabel(key)
      });
      chip.addEventListener('click', function () { reorderAll(key, row); });
      row.appendChild(chip);
    });
    return row;
  }

  /* A chip pressed. The rows are asked for again in the new order, from the
     top — a cursor minted under one order means nothing under another — and
     the search, if there is one, goes with them. The chips repaint at once
     and the rows arrive; between the two the body wears .is-searching the
     way it does for a search, because the rows on it are the answer to the
     order before. Not reorder(), which is a row being carried up its own
     list further down this file. */
  function reorderAll(key, row) {
    if (key === state.sort || state.searching) return;
    state.sort = key;
    TTBTrack.event('lists_sort', { sort: key });
    var chips = row.querySelectorAll('.chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].setAttribute('aria-pressed', String(chips[i].getAttribute('data-sort') === key));
    }
    try {
      window.history.replaceState(null, '', allAddress());
    } catch (e) { /* a browser that will not have it still re-orders */ }

    var seq = ++searchSeq;
    state.searching = true;
    dom.allBody.classList.add('is-searching');
    ask(allUrl()).then(function (a) {
      if (seq !== searchSeq) return;
      state.searching = false;
      dom.allBody.classList.remove('is-searching');
      if (a.status === 0 || !a.out || !a.out.all) return toast(t('loadError'));
      state.all = a.out.all;
      state.next = a.out.next || '';
      paintAll();
    });
  }

  /* The field, with the magnifier and the clear button laid over it. The same
     three elements the "add a place" picker searches with, wearing the same
     classes out of assets/styles.css, because it is the same tool asked about
     a different kind of thing — and a second design for one control is a
     second thing to keep in step. Only the box around them is this page's own:
     the picker's is sticky inside a panel, and this one is a row of the page
     under the head card that sticks to the top of the window once the card
     has scrolled away — see .lists-all-search in assets/lists.css. It was the
     last line of that card, which was fine while the page was twenty rows and
     a button; now that the page grows under the reader for as long as they
     scroll, a field at the top of it is a field a hundred rows away.

     It searches titles, the line under a title, usernames, and — since the
     rows print them — the places on the lists; functions/api/_mostkept.js
     says what that costs per keystroke and where the line is. */
  function searchField() {
    var input = el('input', {
      type: 'search',
      className: 'search-input',
      autocomplete: 'off',
      autocorrect: 'off',
      autocapitalize: 'none',
      spellcheck: 'false',
      maxlength: String(MAX_QUERY),
      'aria-label': t('listsAllSearch'),
      placeholder: t('listsAllSearchHint')
    });
    /* On the property and not through el(), which would set it as an
       attribute — and an input's value attribute is its *default* value, the
       one a form reset goes back to, rather than what is in the field. */
    input.value = state.q;

    var clearBtn = el('button', {
      type: 'button',
      className: 'search-clear',
      'aria-label': t('searchClear'),
      hidden: !state.q,
      html: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICON_X + '</svg>'
    });

    var field = el('div', {
      className: 'search-field',
      html: '<svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<circle cx="11" cy="11" r="6"/><path d="M15.5 15.5L20 20"/></svg>'
    });
    field.appendChild(input);
    field.appendChild(clearBtn);

    /* A form with nothing to submit. Every keystroke is already a search, so
       there is no button and no submit worth having — but a lone input is a
       Go key on a phone keyboard that reloads the page out from under the
       answer already on it, and role="search" is how the field says what it
       is to anybody not looking at the magnifier. */
    var form = el('form', { className: 'lists-all-search', role: 'search' }, [field, orderRow()]);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      input.blur();
    });

    input.addEventListener('input', function () {
      clearBtn.hidden = !input.value;
      typed(input.value);
    });

    clearBtn.addEventListener('click', function () {
      input.value = '';
      clearBtn.hidden = true;
      input.focus();
      typed('');
    });

    return form;
  }

  /* A keystroke, held for a moment before it becomes a request.
   *
   * Nobody types a word in one event, and a request per character is a dozen
   * of them for one search, all but the last answering half-typed words that
   * are thrown away. A short wait turns a word into one question: long enough
   * to hold a fast typist, short enough that nobody waiting on an answer
   * notices it.
   *
   * The timer is cleared and restarted rather than left to fire, so the wait
   * runs from the last keystroke and not from the first. */
  function typed(value) {
    if (searchTimer) window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(function () {
      searchTimer = null;
      search(value);
    }, SEARCH_WAIT);
  }

  /* The search itself, and the three things that make it behave.
   *
   * An answer is used only if it is the answer to the last thing asked. Two
   * searches can land in either order — a one-letter query is the slower of
   * the two to answer, because it matches more — and without the sequence
   * number a page could settle on the rows for "c" while the field says
   * "coffee". A counter and not the text, because a word typed, cleared and
   * typed again is two questions and the second one deserves its answer.
   *
   * The rows on the screen are left alone until the answer comes, and only
   * dimmed. Redrawing them at the keystroke would have nothing new to draw,
   * and a bookmark somebody pressed a moment ago would be rebuilt under its
   * own round trip; but rows that do not move at all while a word is typed
   * over them read as a field that is not wired to anything, so the body
   * wears .is-searching for as long as the question is out. The next page is
   * the one thing that must not arrive in the gap — it would page the old
   * question under the new one — and more() refuses while a search is out.
   *
   * And the address follows the field, so the page somebody is looking at is
   * the page they can send. replaceState rather than pushState: a search is
   * not somewhere you went, and a dozen history entries between a reader and
   * wherever they came from is a Back button that does not work.
   */
  function search(q) {
    /* The same tidying the server does before it looks, so "coffee " and
       "coffee" are one question here too and the address never carries the
       trailing space. */
    q = q.replace(/\s+/g, ' ').trim();
    if (q === state.q) return;
    var was = state.q;
    state.q = q;
    if (q) TTBTrack.event('search', { search_term: q.toLowerCase(), scope: 'lists' });

    var seq = ++searchSeq;
    try {
      window.history.replaceState(null, '', allAddress());
    } catch (e) { /* a browser that will not have it still searches */ }

    state.searching = true;
    dom.allBody.classList.add('is-searching');
    ask(allUrl()).then(function (a) {
      if (seq !== searchSeq) return;
      state.searching = false;
      dom.allBody.classList.remove('is-searching');
      if (a.status === 0 || !a.out || !a.out.all) {
        /* The rows on the screen are still the answer to the question before
           this one, so that is the question the page goes back to holding.
           The field keeps what was typed — the next keystroke is the retry,
           and the guard at the top of this function will not block it,
           because the question it repeats is no longer the one the page
           thinks it asked. */
        state.q = was;
        return toast(t('loadError'));
      }
      state.all = a.out.all;
      state.next = a.out.next || '';
      paintAll();

      /* Said to a screen reader, and nowhere else. On a screen the rows
         changing under the field is the answer; without one a search that
         found eleven lists and a search that found none are the same silence.
         Through the region lists.html already carries for the same reason —
         see announce() — rather than a live region built with the rows, which
         is the thing that is not announced. */
      if (q) {
        announce(!state.all.length ? t('listsAllNoMatch')
          : state.all.length === 1 ? t('listsAllFoundOne')
          : t('listsAllFound', { n: state.all.length }));
      }
    });
  }

  /* The rows, and whatever stands in for them. Everything below the field,
     painted into one element so the field itself is never touched.

     A search is named over its rows — "Lists matching “coffee”" — so they
     read as an answer rather than as the page having quietly changed its
     mind. Named and not counted: a number over rows that keep arriving as
     you scroll would be the size of the page and not of the answer. The
     count goes to the live region instead, where it is the whole answer for
     somebody who cannot see the rows change; see search(). */
  function paintAll() {
    var rows = state.all || [];
    clear(dom.allBody);

    if (!rows.length) {
      dom.allBody.appendChild(el('p', {
        className: 'lists-none',
        textContent: t(state.q ? 'listsAllNoMatch' : 'listsAllNone')
      }));
    } else {
      if (state.q) {
        dom.allBody.appendChild(el('p', {
          className: 'lists-all-for mono',
          textContent: t('listsAllFor', { q: state.q })
        }));
      }
      dom.allList = el('ul', { className: 'lists-index' });
      rows.forEach(function (l) { dom.allList.appendChild(allRow(l)); });
      dom.allBody.appendChild(dom.allList);
    }
    moreLine();
  }

  /* The frame a list is drawn in: its own places, squared up to the panel.
     Padded out by SKY_AIR, floored at SKY_FLOOR so a tight list stays a map,
     and then stretched on whichever axis is short until it matches the shape
     of the panel — in metres rather than in degrees, because a degree of
     longitude up here is only about half a degree of latitude, and fitting
     the two as though they were equal draws Tallinn half as wide as it is.

     `km` is how far the list itself reaches, not how wide the frame is: the
     frame carries air and a floor, and neither of those is a fact about the
     list. It is the longer of the two sides, so a list strung out along one
     street reports the length of the street. */
  function frameFor(dots) {
    var la0 = dots[0][0], la1 = la0, lo0 = dots[0][1], lo1 = lo0, i;
    for (i = 1; i < dots.length; i++) {
      la0 = Math.min(la0, dots[i][0]); la1 = Math.max(la1, dots[i][0]);
      lo0 = Math.min(lo0, dots[i][1]); lo1 = Math.max(lo1, dots[i][1]);
    }
    var midLa = (la0 + la1) / 2, midLo = (lo0 + lo1) / 2;
    /* How much shorter a degree of longitude is at this latitude. */
    var narrow = Math.cos(midLa * Math.PI / 180);
    var spanLa = Math.max((la1 - la0) * SKY_AIR, SKY_FLOOR);
    var spanLo = Math.max((lo1 - lo0) * SKY_AIR, SKY_FLOOR / narrow);
    var shape = (SKY.w - SKY.pad * 2) / (SKY.h - SKY.pad * 2);

    if (spanLo * narrow / spanLa < shape) spanLo = spanLa * shape / narrow;
    else spanLa = spanLo * narrow / shape;

    return {
      la0: midLa - spanLa / 2, la1: midLa + spanLa / 2,
      lo0: midLo - spanLo / 2, lo1: midLo + spanLo / 2,
      km: Math.max((la1 - la0), (lo1 - lo0) * narrow) * KM_PER_DEGREE
    };
  }

  /* How wide a ground dot is drawn, in the panel's own units. Wide when the
     frame is the whole city, so eleven hundred restaurants merge into land
     with a coast around it; tighter when the frame is a few streets, where
     the same radius would flood the panel with one blob. A map does the same
     thing: a coastline zoomed out, streets zoomed in. */
  function groundRadius(frame) {
    return Math.max(2, Math.min(2.9, 1.5 + (frame.la1 - frame.la0) * KM_PER_DEGREE / 9));
  }

  /* A list as a shape on the city: the city itself as pale ground, and the
     list's own places on it wearing the mark the list chose. It is the one
     picture only this site can draw of somebody's list, and it says before a
     single name is read whether this is a Kalamaja list or a Pirita one, a
     walk or an afternoon of driving. Decorative in the markup — the names
     under the title are the accessible version of the same fact, and so is
     the label, which sits inside the same aria-hidden box.

     The mark is the whole difference between a page of twenty pictures and a
     page of twenty red scatters. They were dots in the accent, which is the
     colour every list's places drew in, so the only thing telling two cards
     apart was the shape of the city under them — and two lists of the same
     ten streets drew the same picture twice. The glyph is the one its title
     is already wearing, so the picture and the name are one thing: a page of
     flames and a page of balloons, found without reading a word. It costs
     nothing to send, because the pin was already on the row for the title.

     The list's own dots are drawn now, out of what the row arrived with. The
     ground is drawn once data/city.json has answered — a fetch the rows never
     wait on — and a page that never gets it shows each list on plain paper,
     which is still the shape of the list. */
  function sky(l) {
    if (!l.dots || !l.dots.length) return null;
    var box = el('div', { className: 'lists-sky', 'aria-hidden': 'true' });
    box.ttbSky = {
      dots: l.dots,
      frame: frameFor(l.dots),
      pin: TTBPins.ofList(l)
    };
    paintSky(box);
    return box;
  }

  /* Built as one string and set once rather than a few hundred appendChild
     calls: a page of twenty rows draws several thousand ground dots, and the
     ground is redrawn on every sky already on screen the moment the city
     arrives. The label is appended as an element afterwards, because it is
     translated text and translated text is never written through innerHTML. */
  function paintSky(box) {
    var sk = box.ttbSky;
    /* Eight units across against the dot's six point eight: an emoji carries
       its own padding, so a glyph asked for at the dot's size reads smaller
       than the dot did. Eight is about twenty-two pixels on the phone the
       layouts are measured against, which is what a pin on the map is.

       There was a second size, sixteen, for the strip of Google's five: that
       panel was drawn into sixty-four fixed pixels rather than the card's
       width, where eight units land at four — a smudge. The strip has gone
       and the sky is drawn at one size again, on one kind of row. */
    var mark = TTBPins.glyph(sk.pin);
    box.innerHTML = '<svg viewBox="0 0 ' + SKY.w + ' ' + SKY.h + '" focusable="false">' +
      '<g class="lists-sky-city">' +
      (state.city ? spots(state.city, sk.frame, groundRadius(sk.frame), false, '') : '') +
      '</g><g class="lists-sky-own">' +
      spots(sk.dots, sk.frame, 4, true, mark) +
      '</g></svg>';
    /* No label on a list with no spread — three places in one building, or a
       list whose dots all rounded to the same block. "0.0 km across" is not a
       fact about it, it is the label failing to have anything to say. */
    if (sk.frame.km >= 0.05) {
      box.appendChild(el('span', {
        className: 'lists-sky-span mono',
        textContent: t('listsSkyAcross', { n: across(sk.frame.km) })
      }));
    }
  }

  /* Places as SVG source: a plain dot, or `glyph` if one is given, which is
     how a list's own places come to be wearing its mark. `r` is half of
     whichever is drawn, so the two are asked for in one measure and the edge
     of the panel can be kept off either without knowing which it got.

     A place of the list's own outside the frame cannot happen — the frame is
     built around them — but a ground dot outside it is the usual case, and it
     is dropped rather than clamped: most of the city is outside a fitted
     frame, and clamping a thousand of them smears the panel's edges into a
     solid bar. The list's own are clamped, because the one that would need it
     is a rounding error on the padding.

     An emoji hangs off its baseline rather than sitting on a centre, and
     about a third of its size is below the middle of it, so the baseline goes
     that far under the point the place is actually at — the same .35em the
     rest of the web centres a line of SVG text with. The width is the CSS
     rule's, which sets text-anchor rather than this writing an x offset it
     would have to guess the glyph's width for. */
  function spots(dots, frame, r, clamp, glyph) {
    var out = '', size = r * 2, i, x, y;
    /* Where a thing this size may sit without hanging over the edge: the
       padding, until the thing is bigger than the padding. A row's glyph is
       not — its half is four against a pad of seven — but the strip's was,
       at eight, and the panel clips what it cannot hold, so the outermost
       mark on one of those came out with its top cut off. The strip has gone
       and the bound is kept, because it is the rule rather than the case: a
       mark asked for at a size the padding cannot hold is a mark that gets
       cropped. Only the bound moves; the projection below is on SKY.pad
       either way, because the ground and the list's own places have to be
       laid on one map. A ground dot passes glyph '' and keeps the padding it
       had. */
    var inset = Math.max(SKY.pad, glyph ? r : 0);
    for (i = 0; i < dots.length; i++) {
      x = SKY.pad + (dots[i][1] - frame.lo0) / (frame.lo1 - frame.lo0) * (SKY.w - SKY.pad * 2);
      y = SKY.pad + (frame.la1 - dots[i][0]) / (frame.la1 - frame.la0) * (SKY.h - SKY.pad * 2);
      if (x < inset || x > SKY.w - inset || y < inset || y > SKY.h - inset) {
        if (!clamp) continue;
        x = Math.max(inset, Math.min(SKY.w - inset, x));
        y = Math.max(inset, Math.min(SKY.h - inset, y));
      }
      out += glyph
        ? '<text x="' + x.toFixed(1) + '" y="' + (y + size * 0.35).toFixed(1) +
          '" font-size="' + size + '">' + glyph + '</text>'
        : '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r + '"/>';
    }
    return out;
  }

  /* One decimal under ten kilometres, none over: "0.5" is the difference
     between one street and four, and "13" against "12.6" is not a difference
     anybody is making a decision on. */
  function across(km) {
    return km < 10 ? km.toFixed(1) : String(Math.round(km));
  }

  /* The city, once, as the ground under every sky on the page.
     data/city.json is generated by tools/city.mjs out of the Google export:
     about eleven hundred coordinates and nothing else, nineteen kilobytes,
     cached by the browser like any asset. Fetched after the rows are on the
     screen and painted into every sky already drawn; a sky drawn later — a
     page of Show more — draws its own, because state.city is set by then. */
  function cityDots() {
    /* Nothing narrow draws a sky, so nothing narrow fetches the city: this is
       the larger half of what a phone saves by not building one — nineteen
       kilobytes it would have had no use for. A window widened afterwards
       asks for it then; see watchWidth(). */
    if (state.city || !wide()) return;
    getJSON('/data/city.json').then(function (dots) {
      if (!dots || !dots.length) return;
      state.city = dots;
      var boxes = dom.main.querySelectorAll('.lists-sky');
      for (var i = 0; i < boxes.length; i++) {
        if (boxes[i].ttbSky) paintSky(boxes[i]);
      }
    }).catch(function () { /* plain paper, then */ });
  }

  /* A window can cross the line the rows are built either side of: a browser
     dragged narrower, a tablet turned over. What has to change is the rows
     and only the rows, and state.all already holds everything they are drawn
     from, so this paints them again rather than asking for them again — no
     request, no cursor, and the page stays where the reader left it.

     One watch, set the first time the directory is drawn and never removed:
     the other two views do not read it, and it costs a boolean either way.
     addListener is what Safari before 14 has instead of addEventListener, and
     this file is served raw to whatever opens it. */
  var widthWatch = null;

  function watchWidth() {
    if (widthWatch || !window.matchMedia) return;
    widthWatch = window.matchMedia(WIDE);
    var again = function () {
      if (state.view !== 'all' || !dom.allBody) return;
      paintAll();
      cityDots();
    };
    if (widthWatch.addEventListener) widthWatch.addEventListener('change', again);
    else if (widthWatch.addListener) widthWatch.addListener(again);
  }

  /* The foot of the rows, while there is a page after this one: a Show more
     button, and a watch on it that presses it as it comes into view. The line
     is the only thing that says how far the page goes, so its absence is the
     end of it; and it is rebuilt after every page rather than kept, because
     the watch only reports a change — a button still in view after the rows
     under it grew, on a tall window over short lists, would never be reported
     again, and a fresh watch on a fresh button reports where it is.

     The button stays, and stays pressable, under the watch. It is what a
     browser without IntersectionObserver gets, what a keyboard reaches, and
     what a page that failed to arrive is retried with — and while the next
     page is on its way it is the one thing on the screen that says so. The
     watch reaches most of a screen below the window, so the rows are usually
     there before the reader is. */
  function moreLine() {
    if (moreWatch) { moreWatch.disconnect(); moreWatch = null; }
    if (!state.next) return;
    var go = button(t('listsAllMore'), 'alt', function () { more(go, 'press'); });
    dom.allBody.appendChild(el('p', { className: 'lists-more' }, [go]));
    if (!window.IntersectionObserver) return;
    moreWatch = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) return more(go, 'scroll');
      }
    }, { rootMargin: '0px 0px ' + MORE_AHEAD + 'px 0px' });
    moreWatch.observe(go);
  }

  /* One list on /lists: the title, the keep count, the first three places,
     the bookmark in the corner — and, on a desk, the sky above the title and
     whose list it is beside the count.

     WHY A PHONE GETS LESS AND NOT A SMALLER VERSION OF THE SAME

     The page is a page of lists, and on a phone it had stopped looking like
     one: a panel of city, a title, a line of facts, three names and a
     bookmark is most of a screen per row, so three rows was a whole scroll
     and the shape of the page — twenty of them — was something a reader had
     to take on trust. What the row is for is picking one list out of twenty,
     and the title and the three places are what does that. So the narrow row
     carries those and the keep count between them, and the sky and the byline
     are what a desk has the width to add — see WIDE above, which is also why
     neither is built at all rather than drawn and hidden. */
  function allRow(l) {
    var line = el('p', { className: 'lists-all-meta mono' });
    allMeta(l, line);

    /* The card is a box and the title is the link that fills it — see
       listRow() above, and .lists-open in assets/lists.css — so the byline in
       the line of facts can be a door to the person who wrote the list.

       The bookmark, in the corner of the row rather than at the end of the
       line, and a sibling of the card rather than something inside it: it sits
       above the title's reach the way the map pill does on an index row.

       It was on a list's own page and nowhere else, so keeping one meant
       opening it first — on a page whose whole job is to hand somebody twenty
       lists, that is nineteen journeys back. What it repaints is the count in
       the line above it, and nothing else: the order is left alone, because a
       row that climbed the page under the finger that pressed it would take
       the rows somebody was reading with it. The page is a ranking again on
       the next load.

       Nothing at all is drawn on your own list. Keeping it is refused by the
       API — it is already under Your lists, and a second copy of it under
       Lists you saved would be the same list twice on one page — so the honest
       thing is not to offer the gesture, and the card keeps no room for it.
       The class says what is in the corner rather than whose list it is,
       because /account.html borrows this row too and has nothing in the
       corner either. */
    return el('li', { className: 'lists-index-row' }, [
      el('div', { className: 'lists-all-card' + (l.mine ? '' : ' has-keep') }, [
        /* The sky first, above the title, where a picture goes on a card. */
        wide() ? sky(l) : null,
        TTBTrack.click(el('a', {
          className: 'lists-index-title lists-open',
          href: '/list/' + l.id
        }, [listPin(l), el('span', { textContent: l.title })]), 'list_page', { list_id: l.id }),
        line,
        l.taste && l.taste.length
          ? el('p', { className: 'lists-all-taste', textContent: l.taste.join(' \u00b7 ') })
          : null
      ]),
      l.mine ? null : keepControl(l, function (n) {
        l.keeps = n;
        allMeta(l, line);
      })
    ]);
  }

  /* The one line of facts under a title: how many people kept it, and — on a
     desk — whose it is. Painted into a line that already exists rather than
     returned, because the bookmark on the row rewrites it every time it is
     pressed and a fresh node would have to be swapped into a list somebody is
     looking at.

     How often the list has been opened is not on this line, and it is what the
     page is ordered by. The number is the server's business: printing it would
     put a score under every title and a name under every score, and this page
     is twenty people's writing rather than a league table. The chip says which
     order the rows are in, which is the part a reader needs. See SORTS in
     functions/api/_mostkept.js, which is why the count is not even sent. */
  function allMeta(l, line) {
    clear(line);
    var meta = [
      /* Hidden at zero, the way every other count on this site is. A "0 kept"
         under somebody's top ten reads as a verdict on the list rather than as
         nobody having pressed it yet. */
      l.keeps
        ? el('span', { className: 'lists-all-keeps' }, [
            el('span', {
              className: 'lists-all-mark',
              html: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
                ICON_KEEP + '</svg>'
            }),
            document.createTextNode(
              l.keeps === 1 ? t('listsKeptOne') : t('listsKeptN', { n: l.keeps })
            )
          ])
        : null,
      /* The byline is a door to the person, and on a phone it is a door this
         row has no room for: the title and the three places are what pick a
         list out of twenty, and the name is one line further from them. It is
         on the list's own page either way, one press from here. */
      l.by && wide() ? byline(l.by) : null
    ].filter(Boolean);

    meta.forEach(function (part, i) {
      if (i) line.appendChild(document.createTextNode(' \u00b7 '));
      line.appendChild(part);
    });
  }

  /* The next page, onto the end of the one on screen. Pressed, or reached:
   * `how` is which, and goes out with the event so the console can say how
   * much of the page is read by scrolling and how much is anybody still
   * pressing the button.
   *
   * The new rows are appended to the list on screen and the foot line under
   * them is rebuilt — see moreLine() for why rebuilt. It was every row
   * repainted for a while, which was harmless when a page arrived only on a
   * press and is not now that one arrives under a moving thumb: a hundred rows
   * replaced with a hundred identical rows is a hundred rows of work for
   * nothing, and it would take with it the focus of whoever had reached the
   * button by keyboard.
   *
   * The search goes with the cursor. A page of results is paged the same way a
   * page of everything is, and asking for "everything after this row" without
   * saying what was being asked for would hand back the next twenty of the
   * wrong question. Which is also why this does nothing while a search is out
   * — the cursor on the screen belongs to the question before it — and why a
   * page that comes back after a search has replaced the rows is dropped
   * rather than joined onto them.
   */
  function more(btn, how) {
    if (state.asking || state.searching || !state.next) return;
    state.asking = true;
    TTBTrack.event('lists_more', { rows_shown: state.all.length, how: how });
    btn.disabled = true;
    btn.textContent = t('accountWorking');

    var seq = searchSeq;
    ask(allUrl('&from=' + encodeURIComponent(state.next))).then(function (a) {
      state.asking = false;
      if (seq !== searchSeq) return;
      if (a.status === 0 || !a.out || !a.out.all) {
        btn.disabled = false;
        btn.textContent = t('listsAllMore');
        return toast(t('loadError'));
      }
      state.all = state.all.concat(a.out.all);
      state.next = a.out.next || '';
      a.out.all.forEach(function (l) { dom.allList.appendChild(allRow(l)); });
      dom.allBody.removeChild(btn.parentNode);
      moreLine();
    });
  }

  /* -------------------------------------------------------------- one list */

  function renderOne() {
    var list = state.list;

    if (!list) {
      return card([
        el('p', { className: 'eyebrow', textContent: t('listsEyebrow') }),
        heading(t('listsGoneTitle')),
        el('p', { className: 'lists-say', textContent: t('listsErrGone') }),
        backLink()
      ]);
    }

    var wrap = el('div', { className: 'lists-stack' });
    /* The bar first, and it stays there: a list runs to twenty places and
       everything saying what you were reading used to scroll away with the
       head card. Only on somebody else's — see listBar(). */
    var bar = list.mine ? null : listBar(list);
    if (bar) wrap.appendChild(bar);
    wrap.appendChild(list.mine ? listHeadMine(list) : listHead(list));
    if (bar) nameWhenPast(bar, wrap.querySelector('.lists-title'));

    /* Three shapes under the head, and they are three different pages: your
       own list is an editor, somebody else's with nothing on it is one
       sentence, and somebody else's with places on it is a field over its
       rows. */
    if (list.mine) {
      var ol = el('ol', { className: 'list-items' });
      list.items.forEach(function (item, i) { ol.appendChild(itemRowMine(item, i)); });
      /* Your own list, and not yet three places long: the rest of the three
         are drawn as empty rows you can press. An empty list used to be a
         sentence saying it was empty and a button somewhere below it; three
         numbered gaps say the same thing and also say how many, which is the
         part a first list needs to be told. */
      for (var slot = list.items.length; slot < MIN_ITEMS; slot++) {
        ol.appendChild(slotRow(slot));
      }
      wrap.appendChild(ol);
      /* Under three, the empty rows above are the invitation and a second one
         here would only ask the same question twice — so the two controls are
         a row at the end of a page that is three rows long, which is a page
         you can see the end of. Past three they move into the dock: see
         hasDock(). */
      if (!hasDock(list)) {
        wrap.appendChild(el('div', { className: 'lists-row lists-foot' }, [
          button(t('listsDelete'), 'alt is-danger', deleteList)
        ]));
      }
    } else if (!list.items.length) {
      wrap.appendChild(el('p', { className: 'lists-none', textContent: t('listsEmpty') }));
    } else {
      wrap.appendChild(listFind());
      /* A plain box, with nothing of its own to say or to draw. It is here so
         that a keystroke repaints the rows without rebuilding the field above
         them — see paintFound(). */
      dom.found = el('div');
      wrap.appendChild(dom.found);
      paintFound();
    }
    /* And the band at the foot of the window, which both kinds of list end
       with and which carries a different thing on each — see listDock() and
       listDockMine().

       Somebody else's used to end with a way back to the map and then three
       more lists and a way to all of them, this site's directory redrawn small
       at the foot of one page and reachable only by somebody who had scrolled
       the whole list to find it. Your own ended with the two controls that are
       in the band now. Both were the same mistake: a thing you want partway
       through a list, put where you arrive after the list is finished with
       you. */
    if (hasDock(list)) wrap.appendChild(list.mine ? listDockMine() : listDock());

    return wrap;
  }

  /* ------------------------------------------------------- searching a list
   * The same field the map's panel puts over the same list — see the search
   * block in assets/app.js — so both halves of the switch in the bar answer a
   * word the same way. A list is one thing with two views, and a view you
   * cannot search is not the same thing as one you can: somebody sent a list
   * of forty could narrow it on the map and then scroll for the same name
   * here.
   *
   * It looks at the name and the street, which is what the placeholder
   * promises and what every row here has. The map's copy also reads the type
   * labels and the dishes, because the map holds the whole catalogue in the
   * browser; this page is sent its rows already filled out and never sees the
   * catalogue at all — readList() in functions/api/_lists.js is what an item
   * carries, and the dishes are not in it. The types are, on the rows out of
   * google_venues and on no others, which would be worse than absent: typing
   * "bakery" would find somebody else's places and silently skip mine.
   *
   * There is no index, unlike the map's. That one folds eleven hundred places
   * once because folding them on every keystroke would be work for nothing;
   * fifty rows is not that, and an index for them would be a second copy of
   * the list to keep in step with the first.
   *
   * Only on somebody else's. Your own list is an editor: its rows are
   * numbered and carry a grip, and they are dragged into the order that is
   * the whole point of a top ten — an order there is no sense in rearranging
   * four rows of.
   */
  function listFind() {
    var input = el('input', {
      type: 'search',
      className: 'search-input',
      autocomplete: 'off',
      autocorrect: 'off',
      autocapitalize: 'none',
      spellcheck: 'false',
      maxlength: String(MAX_QUERY),
      'aria-label': t('search'),
      placeholder: t('listsSearchHint')
    });
    /* On the property rather than through el(), for the reason searchField()
       says: an input's value attribute is its default, not its value. */
    input.value = state.find;

    var clearBtn = el('button', {
      type: 'button',
      className: 'search-clear',
      'aria-label': t('searchClear'),
      hidden: !state.find,
      html: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICON_X + '</svg>'
    });

    var field = el('div', {
      className: 'search-field',
      html: '<svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<circle cx="11" cy="11" r="6"/><path d="M15.5 15.5L20 20"/></svg>'
    });
    field.appendChild(input);
    field.appendChild(clearBtn);

    /* A form with nothing to submit, for the reason the directory's field has
       one: a lone input is a Go key on a phone keyboard that reloads the page
       out from under the rows already on it, and role="search" is how the
       field says what it is to anybody not looking at the magnifier. */
    var form = el('form', { className: 'lists-find', role: 'search' }, [field]);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      input.blur();
    });

    input.addEventListener('input', function () {
      clearBtn.hidden = !input.value;
      findTyped(input.value);
    });

    clearBtn.addEventListener('click', function () {
      input.value = '';
      clearBtn.hidden = true;
      input.focus();
      findTyped('');
    });

    return form;
  }

  /* Narrowing is instant, because the rows are already here; only the report
     waits. One event per search rather than one per keystroke — it should say
     what somebody went looking for, not watch them spell it — and two letters
     at the least, since one is not a word anybody looked for. */
  function findTyped(value) {
    state.find = value;
    paintFound();

    if (findTimer) window.clearTimeout(findTimer);
    var term = value.trim();
    if (term.length < 2) return;
    findTimer = window.setTimeout(function () {
      findTimer = null;
      TTBTrack.event('search', { search_term: term.toLowerCase(), scope: 'list' });
    }, SEARCH_REPORT);
  }

  /* The rows, and what a word has left of them. Repainted on its own rather
     than with the page, because the field above it has to survive a keystroke
     — the same split the directory makes at .lists-all-body.

     Every word has to land somewhere, so "telliskivi kohvik" narrows rather
     than widening the way a match on the whole phrase would; the map's
     matches() splits a query the same way. Nothing typed is no words, and
     every row matches all nought of them. */
  function paintFound() {
    clear(dom.found);
    var q = fold(state.find).replace(/\s+/g, ' ').replace(/^ | $/g, '');
    var words = q ? q.split(' ') : [];

    var ol = el('ol', { className: 'list-items' });
    state.list.items.forEach(function (item, i) {
      var hay = fold(item.name + ' ' + (item.address || ''));
      var hit = words.every(function (word) { return hay.indexOf(word) !== -1; });
      /* Its number on the list rather than its number in the answer: the
         order is what a top ten is, and a place that is third stays third
         however few of them a word has left standing. */
      if (hit) ol.appendChild(itemRow(item, i));
    });

    if (ol.firstChild) { dom.found.appendChild(ol); return; }
    dom.found.appendChild(el('p', {
      className: 'lists-none',
      textContent: t('searchNone', { q: state.find.trim() })
    }));
  }

  /* The bar over somebody else's list, and the same bar the map's panel draws
     over the same list — see listCredit() in assets/app.js, which builds it
     out of the map's own pieces because the two pages share no module.
     It says two things and sticks to the top of the window saying them: which
     list this is, and which of its two views you are looking at. Where you
     can go instead is the other bar, at the foot — see listDock().

     A LIST IS ONE THING WITH TWO VIEWS, AND THE BAR IS WHAT SAYS SO

     The map and this page had a button each pointing at the other, and each
     was at the top of a page that scrolls: ten places in, a phone showed
     neither. So the two of them are one control now, drawn the same in both
     places, with the view you are in filled the way a pressed chip is filled.
     Reading it takes no learning — it is the map's own filter row, saying
     which of two things is on — and it is the whole of the transition
     between them.

     The chips are links and not buttons, so the other view is an address
     somebody can open in a tab, send, or be sent; `aria-current` rather than
     `aria-pressed` for the same reason, because what the filled one is
     saying is "this page", not "this is switched on". The map half reports
     `list_map` and the list half `list_page`, which are the names the two
     buttons it replaces reported.

     Your own list has no bar and no foot. That page is an editor — its title
     is a field you type in rather than a heading, and the accent on it
     belongs to Save — and the way onto the map is in its row of controls
     where the other things you do to a list are. Somebody reading a list they
     were sent is the journey this is about. */
  function listBar(list) {
    return el('div', { className: 'lists-bar' }, [
      el('span', { className: 'lists-bar-name', textContent: list.title }),
      el('span', { className: 'lists-bar-views' }, [
        TTBTrack.click(el('a', {
          className: 'chip',
          href: mapHref(list.id),
          textContent: t('listsViewMap')
        }), 'list_map', { list_id: list.id }),
        el('span', { className: 'chip', 'aria-current': 'page', textContent: t('listsViewList') })
      ])
    ]);
  }

  /* The bar's name is the card's title, so at the top of the page the two
     would be the same words twice, sixty pixels apart. It is drawn with no
     opacity until the title it repeats has gone off the top — which is the
     moment it stops being a repeat and starts being the only thing on screen
     saying what you are reading.

     Opacity and not display, so the switch keeps its place either way instead
     of stepping sideways as the name arrives. And a browser with no observer
     gets the name from the start: the same words twice is a smaller loss than
     a bar that never says which list this is. */
  function nameWhenPast(bar, title) {
    if (barWatch) { barWatch.disconnect(); barWatch = null; }
    if (!title || !window.IntersectionObserver) { bar.classList.add('is-past'); return; }
    barWatch = new IntersectionObserver(function (entries) {
      bar.classList.toggle('is-past', !entries[entries.length - 1].isIntersecting);
    });
    barWatch.observe(title);
  }

  /* And the foot, fixed to the bottom of the window: the way out to everybody
     else's lists.

     It is down here rather than in the bar because the two are not the same
     kind of thing and a bar holding both said so badly — which list you are
     reading and which view of it you are looking at is where you are, and
     /lists is where you go instead. Splitting them also gives the bar its
     room back: a phone had to choose between the list's name and the door,
     and dropped the name.

     IT IS THE PAGE'S ONE FILLED ACTION

     It was an .alt for a while — twelve mono pixels in --muted, underlined,
     centred on a band the colour of the page behind it — and then a
     .menu-row, a name in the display face with a chevron on the end. Neither
     looked like a thing you press, which is what somebody reading a list on a
     phone said about both of them in turn. A row is the right shape for a
     door standing among other rows on a page of cards, which is what
     /account.html drew this same destination as for a while; it is the wrong
     shape for the one thing in a bar, where there is nothing beside it to be
     a row of. That page has no door to here at all now, which leaves this one
     and the map's rail.

     So it is .go: the filled pill in the accent, which is what "press this"
     looks like everywhere else on this site. Rule 5 allows exactly one of
     them per surface and somebody else's list has always spent none — the
     keep is an .alt in a hairline pill, Share is an .alt, and the head card
     spends no accent at all, see listHead(). The one thing you can do next
     from a list you are reading is go and read the others, so that is what
     the accent buys.

     Sized to the words and centred, the way every other .go on the site is,
     rather than stretched across the bar: a full-width fill is a shape
     nothing else here wears, and a 44px pill is a target a thumb cannot miss
     either way. The band under it carries the safe inset, so the pill sits
     above a home indicator rather than under one.

     Without the line that says why: t('listsAllWhy') stood under the name on
     /account.html while that page had a door of its own, where it was a card
     among cards and the line was what said which page was behind it. Two
     lines of mono in a bar that never leaves the screen took the dock past a
     tenth of a phone, off a list it is meant to sit under rather than compete
     with, and a filled button does not need a footnote. The map's rail says
     no more than this one does either. */
  function listDock() {
    return el('div', { className: 'lists-dock' }, [
      TTBTrack.click(el('a', {
        className: 'go lists-dock-out',
        href: ALL_PATH,
        textContent: t('listsAllTitle')
      }), 'lists_all')
    ]);
  }

  /* WHICH LISTS GET A BAND AT THE FOOT OF THE WINDOW
   *
   * Both kinds, and for the same reason, which is that a list is as long as
   * somebody made it: twenty rows each carrying an address and a note is four
   * or five screens on a phone and two on a desk, and anything drawn after the
   * last of them is a thing you only meet by scrolling to the end of a page
   * you had no other reason to reach the end of.
   *
   * Somebody else's has had one since it was written — the way out onto the
   * rest of the directory, see listDock() above. Your own did not, and the two
   * controls that end it were exactly the case the argument was made about:
   * "Add another place" is the one thing you do next on a list you are
   * building, and it sat below the twentieth row, off the bottom of every
   * screen the list was long enough to need.
   *
   * THE THRESHOLD IS THE SAME THREE THE SLOT ROWS ARE
   * A list under three places is drawn with the rest of the three as empty
   * rows you can press, which is a page of four or five rows — you can see the
   * end of it without moving, so a band fixed over it would be furniture
   * covering the thing it is meant to reach. It would also be a band whose one
   * filled action is not drawn yet (the slot rows are the invitation at that
   * length, see renderOne()), leaving "Delete the list" alone in a bar that
   * never leaves the screen, which is the opposite of what either control
   * wants. So under three the two stay a row at the foot of the page, and past
   * three they move into the band.
   */
  function hasDock(list) {
    return !list.mine || list.items.length >= MIN_ITEMS;
  }

  /* Your own list's band: the same paper, the same hairline, the same safe
     insets — and two things on it rather than one, because the pair is what
     was at the foot of the page and splitting them would leave the quiet half
     exactly where it was hard to find.

     Centred as a pair rather than pushed to the two ends. A bar with something
     in each corner reads as a toolbar the page is held inside; these are the
     end of a list that happens to be pinned, and keeping them together under
     the column the page reads at says that.

     The accent goes on adding, which is the press this page exists for, and
     "Delete the list" stays the .alt is-danger it has always been: mono,
     underlined, --muted until it is hovered. It is the one control here that
     cannot be undone and it is now permanently on screen, which is a fair
     thing to worry about and is why deleteList() asks first — it has always
     asked, and a confirm naming the list is what stands between a thumb and a
     list of twenty places, not the button being far away. */
  function listDockMine() {
    return el('div', { className: 'lists-dock lists-dock-mine' }, [
      button(t('listsAddMore'), 'go', openPicker),
      button(t('listsDelete'), 'alt is-danger', deleteList)
    ]);
  }

  /* Somebody else's list: their title, their name, their sentences, and
     nothing that looks like a control — except the two things that are about
     you rather than about them. Keeping it, and passing it on.

     The way onto the map was the third, and the filled one leading the row:
     a list is a set of places and the question about a set of places is where
     they are, so it was what the card asked for. It is in the bar above now,
     where it is also on screen after ten places have gone past — and so this
     card spends no accent at all, which is the arrangement the map's own
     credit block has always had. */
  function listHead(list) {
    return card([
      el('p', { className: 'eyebrow', textContent: t('listsEyebrow') }),
      /* The pin in front of the title, the same one its places wear on the
         map — so somebody who opens the map from here recognises the pins as
         this list's rather than as the map having changed colour. */
      heading([listPin(list), el('span', { textContent: list.title })]),
      /* The byline, and the door out of this page onto the rest of what its
         owner has published — the same one every row of the directory
         carries, see byline(). */
      list.by ? el('p', { className: 'lists-by mono' }, [byline(list.by)]) : null,
      list.intro ? el('p', { className: 'lists-say', textContent: list.intro }) : null,
      el('div', { className: 'lists-row' }, [
        keepControl(list),
        button(t('listsShare'), 'alt', shareList),
        el('span', { className: 'lists-count mono', textContent: countLabel(list.items.length) })
      ])
    ]);
  }

  /* ------------------------------------------------------------ keeping one
   * The bookmark on somebody else's list. The same mark the map draws on a
   * place, because it is the same sentence about the other kind of object
   * here: keep this, I am coming back to it.
   *
   * SIGNED OUT IT IS A DOOR, NOT A DEAD BUTTON
   *
   * A keep needs an account — see functions/api/lists.js for why, and it is
   * the same reason making a list does. So signed out this is drawn as a link
   * to the sign-in sheet on the map, named as what it is for, with this page
   * as where to come back to. A button that could only fail, or one that
   * silently did nothing, would both be worse than the honest ask: somebody
   * pressing this has just decided they want the list, which is exactly the
   * moment worth asking at.
   *
   * The count beside it is drawn whether or not anybody is signed in, and
   * hidden at zero for the reason the map hides a save count at zero.
   *
   * WHERE THAT COUNT GOES
   *
   * On a list's own page it is the span this draws beside the button. On a row
   * of the directory the number is already in the line under the title, where
   * it is also what the page is ordered by, and a second copy of it an inch
   * away would be the same fact said twice. So a caller with somewhere of its
   * own to put the number passes `onCount` and gets no span; everybody else
   * gets the span.
   */
  function keepControl(list, onCount) {
    var count = onCount ? null : el('span', { className: 'lists-keeps mono' });

    function paintCount(n) {
      if (onCount) return onCount(n);
      count.textContent = !n ? '' : n === 1 ? t('listsKeptOne') : t('listsKeptN', { n: n });
      count.hidden = !n;
    }
    /* Only the span this made needs filling: it was created empty. A caller
       that passed onCount has already drawn the number wherever it keeps it,
       and painting it again here would be the same line built twice. */
    if (count) paintCount(list.keeps || 0);

    if (!state.me) {
      return el('span', { className: 'lists-keep-wrap' }, [
        TTBTrack.click(el('a', {
          className: 'alt lists-keep',
          href: accountHref('up'),
          html: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICON_KEEP + '</svg>',
          'aria-label': t('listsKeepIn')
        }, [el('span', { textContent: t('listsKeep') })]), 'list_keep', { list_id: list.id, list_state: 'signed_out' }),
        count
      ]);
    }

    var b = el('button', {
      type: 'button',
      className: 'alt lists-keep' + (list.kept ? ' is-kept' : ''),
      'aria-pressed': String(!!list.kept),
      html: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICON_KEEP + '</svg>'
    }, [el('span', { textContent: t(list.kept ? 'listsKeptThis' : 'listsKeep') })]);

    b.addEventListener('click', function () {
      /* The mark flips first and the request follows it. A bookmark that
         waits for a round trip before it looks pressed feels broken on a
         phone, and there is nothing here that a failure cannot put back. */
      var want = !list.kept;
      TTBTrack.event('list_keep', { list_id: list.id, list_state: want ? 'on' : 'off' });
      list.kept = want;
      list.keeps = Math.max(0, (list.keeps || 0) + (want ? 1 : -1));
      b.classList.toggle('is-kept', want);
      b.setAttribute('aria-pressed', String(want));
      b.querySelector('span').textContent = t(want ? 'listsKeptThis' : 'listsKeep');
      paintCount(list.keeps);

      post({ action: want ? 'keep' : 'unkeep', id: list.id }).then(function (a) {
        if (!a.ok) {
          /* Back to what it was, and say why. The server is the one that
             decides; this only ever guessed. */
          list.kept = !want;
          list.keeps = Math.max(0, (list.keeps || 0) + (want ? -1 : 1));
          b.classList.toggle('is-kept', !want);
          b.setAttribute('aria-pressed', String(!want));
          b.querySelector('span').textContent = t(!want ? 'listsKeptThis' : 'listsKeep');
          paintCount(list.keeps);
          return failed(a.out);
        }
        /* The count the database actually holds, which is not necessarily the
           one this page guessed: somebody else may have kept it in the
           meantime, and a re-press that hit the conflict clause added
           nothing at all. */
        list.kept = !!a.out.kept;
        list.keeps = a.out.keeps || 0;
        paintCount(list.keeps);
      }).catch(function () {
        list.kept = !want;
        list.keeps = Math.max(0, (list.keeps || 0) + (want ? -1 : 1));
        b.classList.toggle('is-kept', !want);
        b.setAttribute('aria-pressed', String(!want));
        b.querySelector('span').textContent = t(!want ? 'listsKeptThis' : 'listsKeep');
        paintCount(list.keeps);
        failed({});
      });
    });

    return el('span', { className: 'lists-keep-wrap' }, [b, count]);
  }

  /* Your own: the same card, with the title and the line under it as fields
     you can type into. No edit mode: a list is small enough that the page can
     simply be the thing. What you type is on the card the moment you type it
     and on the server when you press Save. */
  function listHeadMine(list) {
    var title = el('input', {
      type: 'text',
      className: 'lists-input lists-input-title',
      value: list.title,
      maxlength: String(MAX_TITLE),
      'aria-label': t('listsRename')
    });
    firstSeen('title', list.title);
    typedField('title', title, function (value) {
      var next = value.trim();
      /* A list has to be called something, so an empty field is a field on
         its way to being retyped rather than an edit: nothing is recorded and
         nothing is queued. Leaving it empty puts the old name back. */
      if (!next) return null;
      list.title = next;
      if (next === sent.title) return null;
      return function (leaving) {
        sent.title = next;
        return deliver({ action: 'edit', id: list.id, title: next }, leaving);
      };
    });
    title.addEventListener('blur', function () {
      if (!title.value.trim()) title.value = list.title;
    });

    var intro = el('input', {
      type: 'text',
      className: 'lists-input',
      value: list.intro,
      maxlength: String(MAX_INTRO),
      'aria-label': t('listsIntro'),
      placeholder: t('listsIntroHint')
    });
    firstSeen('intro', list.intro);
    typedField('intro', intro, function (value) {
      var next = value.trim();
      list.intro = next;
      if (next === sent.intro) return null;
      return function (leaving) {
        sent.intro = next;
        return deliver({ action: 'edit', id: list.id, intro: next }, leaving);
      };
    });

    var ready = list.items.length >= MIN_ITEMS;

    /* Sharing is the last thing you do to a list, so it is the last button on
       the card, and it waits until there is a list to send. Saving sits after
       it because it is the one press that is always available — and because
       it is also the card's state light, and the end of the row is where the
       eye lands last. */
    var share = button(t('listsShare'), 'alt', shareList);
    if (!ready) {
      share.disabled = true;
      share.title = t('listsShareNeeds');
    }

    /* The one button on the page that reports rather than only acts, so it is
       handed to the mark the moment it exists and painted into whichever
       state is true right now — which on a list just opened is Saved. */
    var save = button(t('listsSave'), 'go lists-save', saveList);
    mark.btn = save;
    paintSave();

    return card([
      el('p', { className: 'eyebrow', textContent: t('listsYours') }),
      title,
      intro,
      /* A field, so it sits with the fields rather than down among the
         buttons — see design rule 6. Its own row because the eight draw as
         two rows of four and nothing should be wrapping beside them. */
      pinPicker(list),
      el('div', { className: 'lists-row' }, [
        visibility(list),
        el('span', { className: 'lists-count mono', textContent: countLabel(list.items.length) }),
        /* Your own list has no keep button — it is already under Your lists,
           and the same list twice on one page is not a feature. The count is
           here though: it is the one fact about a list you wrote that you
           cannot learn by reading it. */
        keepCount(list.keeps)
      ]),
      el('div', { className: 'lists-row lists-acts' }, [
        /* Outlined rather than filled: Save is this card's one press that
           wears the accent. Not a line of underlined mono either — beside two
           pills that reads as a caption on them rather than as the door onto
           the map. */
        mapLink(list.id),
        share,
        save
      ]),
      ready ? null : el('p', { className: 'lists-hint mono', textContent: t('listsShareNeeds') })
    ]);
  }

  /* ---------------------------------------------------------- the pin
   * What this list's places wear on the map.
   *
   * The map's own places are not among them. A place I have eaten at draws
   * the mark — the mouth, see "The mark" in README.md — whatever list it is
   * on and whatever that list chose, because the mouth is this site saying
   * it has been there and a list is somebody else saying they liked it.
   * Those are two different sentences and only one of them is mine to hand
   * out. So `mark` is not in TTBPins.GLYPHS, there is no swatch for it here,
   * and functions/api/_pins.js refuses it on the way in as well — a picker
   * that can be worked around by a hand-written request is a decoration.
   *
   * The line under the legend says so in words rather than leaving somebody
   * to discover it on the map: a top ten with three of my places in it draws
   * three mouths among seven croissants, and that should read as the list
   * being partly approved rather than as the picker being broken.
   *
   * Real radios for the reason visibility() below uses them: arrow keys,
   * screen readers, and the word "selected" all come with them.
   *
   * One choice and not two. There were six colour swatches under this grid
   * for an afternoon, and they were a second decision to make before you
   * could name a list — for a difference the marker was already making.
   * Every marker draws in the style's accent now.
   */
  function pinPicker(list) {
    var worn = TTBPins.ofList(list);
    firstSeen('pin', worn);

    /* One swatch. `group` is the radio name, `on` says whether this is the
       one currently worn, and `choose` is what pressing it means. */
    function swatch(group, value, label, kids, on, choose) {
      var input = el('input', {
        type: 'radio',
        name: group + '-' + list.id,
        value: value,
        checked: on ? true : null
      });
      var box = el('label', {
        className: 'lists-swatch' + (on ? ' is-on' : ''),
        title: label,
        'aria-label': label
      }, [input].concat(kids));

      input.addEventListener('change', function () {
        if (!input.checked) return;
        /* Filled in at once, for the reason the visibility radios are: a
           control that waited for a round trip to move is a control arguing
           with the finger. What waits is the write. */
        var all = box.parentNode.querySelectorAll('.lists-swatch');
        for (var i = 0; i < all.length; i++) all[i].classList.toggle('is-on', all[i] === box);
        choose();
      });
      return box;
    }

    /* The eight. Each one draws itself, so the grid is the answer to "what
       will my list look like" rather than a list of words for it. */
    var glyphs = el('div', {
      className: 'lists-pin-grid',
      role: 'radiogroup',
      'aria-label': t('listsPin')
    }, TTBPins.GLYPHS.map(function (id) {
      var face = TTBPins.paint(el('span', { className: 'lists-swatch-face' }), id);
      return swatch('pin', id, t(pinKey(id)), [face], id === worn, function () {
        list.pin = id;
        TTBTrack.event('list_pin', { list_id: list.id, pin: id });
        /* Back where it started: there is nothing to send, and the Save
           button has to be able to say so. Same rule as the fields and the
           two visibility radios — a list is saved when it matches what the
           server has, not when nothing has been pressed. */
        if (id === sent.pin) { unqueue('pin'); return; }
        queue('pin', function (leaving) {
          sent.pin = id;
          return deliver({ action: 'edit', id: list.id, pin: id }, leaving);
        });
      });
    }));

    return el('fieldset', { className: 'lists-vis lists-pins' }, [
      el('legend', { className: 'lists-vis-legend mono', textContent: t('listsPin') }),
      glyphs,
      el('p', { className: 'lists-hint mono', textContent: t('listsPinMark') })
    ]);
  }

  /* The ui.json key for one marker: pinKey('flame') is 'pinFlame'. Built
     rather than written out eight times — which means the validator's
     scanner for t() calls cannot see a single one of them, because it only
     reads literals. So tools/validate.mjs walks PIN_GLYPHS itself and asks
     ui.json for the same eight keys; see the check under "1b. The pin
     tables" there. A key nobody has translated reaches a visitor as the word
     "pinFlame" on a swatch, and this is what stops that.

     The five kinds of place have no keys and want none: they are aria-hidden
     wherever they are drawn, because the words beside them already say the
     kind. */
  function pinKey(id) {
    return 'pin' + id.charAt(0).toUpperCase() + id.slice(1);
  }

  /* Who can open it.
   *
   * It was one pill that printed the state it was in — "Anyone with the link
   * can read it" — and that is the sentence somebody reads twice: it is
   * either what is true now or what pressing it would make true, and a pill
   * on its own cannot say which. Both states are drawn instead, as two radio
   * buttons under a question, and the one that is filled in is the answer.
   * There is nothing left to guess at.
   *
   * Public and Private, in one word each. They were "Anyone with the link"
   * and "Only me", which said more and fitted worse: two clauses in a
   * segmented control that a narrow phone broke over four lines, to describe
   * the two states everything else on the web already calls by these names.
   * The legend above them is the sentence — who can open it — so the options
   * under it do not each have to be one.
   *
   * Real radios rather than buttons wearing the part, because arrow keys,
   * screen readers and the word "selected" all come with them.
   */
  function visibility(list) {
    var name = 'who-' + list.id;
    firstSeen('public', list.public);

    var option = function (isPublic) {
      var input = el('input', {
        type: 'radio',
        name: name,
        value: isPublic ? 'link' : 'me',
        checked: list.public === isPublic ? true : null
      });
      var label = el('label', {
        className: 'lists-seg-opt' +
          (list.public === isPublic ? ' is-on' : '') +
          (isPublic ? '' : ' is-private')
      }, [input, el('span', { textContent: t(isPublic ? 'listsWhoPublic' : 'listsWhoPrivate') })]);

      input.addEventListener('change', function () {
        if (!input.checked || list.public === isPublic) return;
        list.public = isPublic;
        TTBTrack.event('list_visibility', { list_id: list.id, visibility: isPublic ? 'public' : 'private' });
        var opts = label.parentNode.querySelectorAll('.lists-seg-opt');
        for (var i = 0; i < opts.length; i++) opts[i].classList.toggle('is-on', opts[i] === label);
        /* The answer is filled in at once — the radio is the state, and a
           radio that waited for a round trip to move would be the one control
           on the page that argues with the finger. What waits is the write. */
        if (isPublic === sent.public) { unqueue('public'); return; }
        queue('public', function (leaving) {
          sent.public = isPublic;
          return deliver({ action: 'edit', id: list.id, public: isPublic }, leaving);
        });
      });

      return label;
    };

    return el('fieldset', { className: 'lists-vis' }, [
      el('legend', { className: 'lists-vis-legend mono', textContent: t('listsWho') }),
      el('div', { className: 'lists-seg' }, [option(true), option(false)])
    ]);
  }

  /* The press that sends everything.
     Whatever is in the field under the cursor counts, so the cursor is taken
     out of it first — a blur is what finishes a half typed word — and then
     the queue goes in one go. */
  function saveList() {
    /* Pressed rather than typed, so this one owes a word — and settled() says
       it when the last write has actually landed rather than here, where the
       only true thing yet is that it has been sent. */
    mark.asked = true;
    TTBTrack.event('list_save', { list_id: state.list.id, writes: pending.length });
    var focused = document.activeElement;
    if (focused && focused.blur && focused !== document.body) focused.blur();
    flushAll();
  }

  /* --------------------------------------------------------- Google's words
   * A place off the Google export has no write-up to link to, so its row
   * carries what Google says about it instead: what kind of place it is, and
   * what it charges. Both arrive already turned into the map's own vocabulary
   * — see venueEntry() in functions/api/_lib.js — so what is drawn here is the
   * gauge and the type names the map itself draws, in the reader's language
   * rather than in Google's English.
   *
   * And it says whose description it is, every time. That is the whole reason
   * the line is allowed to exist: being on my map is the verdict on this site,
   * and a row showing a price band in my accent with nothing to say where the
   * band came from would be quietly borrowing that verdict for a place I have
   * never eaten at.
   */

  /* The map's typeLabel(), restated here for the same reason fold() is: two
     pages, no module between them. Unknown ids come back empty rather than as
     themselves — data/taxonomy.json is optional at boot, and a row that has
     lost it should lose its types, not print "fine-dining" at somebody. */
  function typeLabel(id) {
    for (var i = 0; i < state.types.length; i++) {
      if (state.types[i].id === id) {
        return state.types[i][state.lang] || state.types[i][DEFAULT_LANG] || '';
      }
    }
    return '';
  }

  /* The map's gauge: four slots, the filled ones in the accent and the rest
     ghosted in the hairline. Google's scale is whole "$" signs, so a slot here
     is lit or it is not — none of the half-step arithmetic assets/app.js needs
     for a band of 2.5 has anything to do on this page. */
  function priceGauge(n) {
    var wrap = el('span', {
      className: 'price',
      role: 'img',
      'aria-label': t('priceOf', { n: String(n) })
    });
    for (var i = 1; i <= 4; i++) {
      wrap.appendChild(el('i', { className: i <= n ? 'on' : null, textContent: '\u20ac' }));
    }
    return wrap;
  }

  /* A span rather than a paragraph because one of the three rows it goes in is
     a button, and a button holds phrasing content only. */
  function sourceLine(item) {
    if (!item.google) return null;
    var kinds = (item.types || []).map(typeLabel).filter(Boolean).join(' \u00b7 ');
    if (!kinds && !item.price && !item.rating) return null;
    return el('span', { className: 'place-source mono' }, [
      el('span', { textContent: t('googleSays') }),
      item.rating ? scoreMark(item) : null,
      item.price ? priceGauge(item.price) : null,
      kinds ? el('span', { textContent: kinds }) : null
    ]);
  }

  /* Google's score and the number of people behind it: "4.8 from 3,041". The
     count never comes off, because a 5.0 out of six visits and a 4.6 out of
     three thousand are not the same claim and the score alone cannot tell them
     apart. Both numbers in the reading language's own digits and separators —
     "3 041" in Estonian — and neither is ever drawn for a place on my map,
     which is not scored by anybody. */
  function scoreMark(item) {
    var out = formatNumber(item.rating, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    if (item.reviews) {
      out += ' ' + t(item.reviews === 1 ? 'googleReviewsOne' : 'googleReviews', {
        n: formatNumber(item.reviews)
      });
    }
    return el('span', { className: 'score', textContent: out });
  }

  /* Wrapped because toLocaleString throws on a language tag the browser will
     not take, and a row that has lost its score to an exception has lost the
     rest of the page with it. */
  function formatNumber(n, opts) {
    try {
      return n.toLocaleString(state.lang, opts);
    } catch (e) {
      return String(n);
    }
  }

  /* ------------------------------------------------------------- one place */

  /* Where a row points, and it is the other half of this page: this same list
     on the map, standing on the place that was pressed — the pins above,
     these same rows under them, and the one you asked for lit between the
     two. `?at=` is the door; standOn() in assets/app.js is what it opens.

     It used to leave the site. A place on my map went to its write-up and
     everything else opened a new tab on Google Maps, which is most of a top
     ten — so the ordinary press on the ordinary row was the one that left,
     from a page whose own switch offers a map with the whole list on it. The
     switch is in the bar at the top and people read downwards. Google Maps is
     still a press away, behind Directions and See on Google on the card the
     map draws. **Pressing a row is the third way across** in README.md is
     the argument in full.

     The id is the one the list stores, never `mapId` — that is the exception
     ?spot= has to make, because a write-up is filed under the map's own id.
     The pin and the row on the map both stand under the id the list was
     written with, which is what isOnList() in assets/app.js reads.

     A place with nowhere to draw points nowhere at all and says so, which is
     seatList()'s rule restated: it drops a place it cannot put a pin for, so
     a link to the map for one would arrive on a map that does not have it. */
  function placeHref(item) {
    if (!item.map && (typeof item.lat !== 'number' || typeof item.lng !== 'number')) return '';
    return '/?list=' + encodeURIComponent(state.list.id) +
      '&at=' + encodeURIComponent(item.place);
  }

  /* The name, as the link it is — and, when `whole` says so, as the row's link
     too: .lists-open stretches the press over the box behind everything in it,
     so the street, Google's line and the sentence its owner wrote all lead
     where the name does. See .item.is-door in assets/lists.css.

     Off on the editor's rows, and that is the only place it is off. A row
     there is a textarea, a grip and a delete button, and a sheet of link over
     the three of them is a row nobody can type in or carry. It has to be a
     flag rather than a class the stylesheet narrows, because .lists-open fills
     the nearest positioned ancestor and an editor row is not one: the sheet
     would go looking outwards and find the page. */
  function placeName(item, whole) {
    var href = placeHref(item);
    if (!href) {
      return el('span', { className: 'item-name is-lost', textContent: item.name });
    }
    /* No target and no rel: a new tab is what a link that leaves the site is
       owed, and none of these leave it any more. `map` says which roll the
       place came off, which is all it can say now that every row goes to the
       same place — it used to name one of two destinations. */
    return TTBTrack.click(el('a', {
      className: 'item-name' + (whole ? ' lists-open' : ''),
      href: href
    }, [
      el('span', { textContent: item.name }),
      el('span', {
        className: 'item-where mono',
        html: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICON_PIN + '</svg>'
      })
    ]), 'place_link', {
      place: item.name,
      map: item.map ? 'mine' : item.google ? 'google' : 'added'
    });
  }

  /* One of the empty places a new list starts with. It is numbered like a
     real row, so the three of them read as the shape the list is going to
     have, and pressing it opens the same picker the button does. */
  function slotRow(i) {
    return el('li', { className: 'item is-slot' }, [
      el('span', { className: 'item-n mono', 'aria-hidden': 'true', textContent: String(i + 1) }),
      button(t('listsSlot'), 'lists-slot', openPicker)
    ]);
  }

  /* One place on a list somebody is reading, and the whole row is the door
     onto the map rather than the name across the top of it — design rule 8, a
     target the width of the card and not the width of however that place
     happens to be spelt. **Pressing a row is the third way across** in
     README.md is the argument in full.

     A place the catalogue has lost is not dressed as a door, because it has
     nowhere to go: placeHref() gives it no address, placeName() draws the
     muted span it always did, and the row keeps its plain edge. */
  function itemRow(item, i) {
    var door = !!placeHref(item);
    return el('li', { className: 'item' + (door ? ' is-door' : '') }, [
      el('span', { className: 'item-n mono', 'aria-hidden': 'true', textContent: String(i + 1) }),
      el('div', { className: 'item-body' }, [
        placeName(item, door),
        item.address ? el('p', { className: 'item-address mono', textContent: item.address }) : null,
        sourceLine(item),
        item.say ? el('p', { className: 'item-say', textContent: item.say }) : null,
        mustOrderLine(item)
      ])
    ]);
  }

  /* What its owner says is worth ordering, drawn under the note and only
     when there is one — no label over an empty line, the same rule item-say
     follows. Its own element rather than folded into item-say's paragraph,
     because a list read by a stranger should be able to style "the one
     dish" differently from "what is good about it" without the two being
     glued into one string on the server. */
  function mustOrderLine(item) {
    if (!item.mustOrder) return null;
    return el('p', { className: 'item-must-order' }, [
      el('span', { className: 'item-must-order-label', textContent: t('listsMustOrder') }),
      el('span', { textContent: item.mustOrder })
    ]);
  }

  function itemRowMine(item, i) {
    var say = el('textarea', {
      className: 'item-input',
      rows: '2',
      maxlength: String(MAX_SAY),
      'aria-label': t('listsSay'),
      placeholder: t('listsSayHint')
    });
    say.value = item.say || '';
    sayField(say, item);

    var mustOrder = el('input', {
      type: 'text',
      className: 'item-input',
      maxlength: String(MAX_MUST_ORDER),
      'aria-label': t('listsMustOrder'),
      placeholder: t('listsMustOrderHint')
    });
    mustOrder.value = item.mustOrder || '';
    mustOrderField(mustOrder, item);

    /* Two controls where there used to be three: the row is carried to where
       it belongs rather than clicked up to it one place at a time. The grip is
       what the hand goes for and what the keyboard lands on — see carry(). */
    var grip = iconButton('listsDrag', ICON_GRIP, null, 'row-grip');
    grip.setAttribute('draggable', 'false');

    var moves = el('div', { className: 'item-moves' }, [
      grip,
      iconButton('listsRemove', ICON_X, function () { drop(item.place); }, 'is-danger')
    ]);

    var row = el('li', { className: 'item is-mine' }, [
      el('span', { className: 'item-n mono', 'aria-hidden': 'true', textContent: String(i + 1) }),
      el('div', { className: 'item-body' }, [
        placeName(item),
        item.address ? el('p', { className: 'item-address mono', textContent: item.address }) : null,
        sourceLine(item),
        say,
        mustOrder
      ]),
      moves
    ]);
    carry(row, item, grip);
    return row;
  }

  /* --------------------------------------------------- what Save is holding
   * The page used to write itself. A note went out when the typing paused, a
   * title when you left the field, the order the moment a row was let go of —
   * and the button underneath said "Save" over a list that was already saved.
   * Pressing it changed nothing, which is the worst thing a button can do.
   *
   * So the writes wait here instead, and the button sends them. Everything
   * that edits a list you are looking at — the title, the line under it, each
   * note, who can open it, and the order — is held until Save is pressed.
   * Adding and removing a place are not: see addPlace() and drop().
   *
   * KEYED BY WHAT IS BEING WRITTEN, NOT BY THE FIELD IT WAS TYPED INTO
   *
   * A row is rebuilt whenever the list is redrawn, so a queue keyed by the
   * textarea would hold an entry against a node that is no longer in the
   * document, and the next keystroke would file a second entry for the same
   * note — two writes of one sentence, landing in whichever order the flush
   * happened to take them. The key is "say:<place>" instead, so a second
   * thought replaces the first however many times the page has been redrawn
   * in between.
   *
   * For the same reason a queued write carries the value it was queued with
   * rather than reading it back off a node when it finally goes. What is
   * typed is also written straight into `state.list`, so a redraw shows what
   * you typed rather than what the server last heard.
   */
  var pending = [];   /* [{ key, run }] — edits made but not yet sent */

  function queue(key, run) {
    for (var i = 0; i < pending.length; i++) {
      if (pending[i].key === key) { pending[i].run = run; return; }
    }
    pending.push({ key: key, run: run });
    paintSave();
  }

  /* Take one back out without sending it — an emptied title, which is not an
     edit but a field on its way to being retyped. */
  function unqueue(key) {
    for (var i = pending.length - 1; i >= 0; i--) {
      if (pending[i].key === key) pending.splice(i, 1);
    }
    paintSave();
  }

  /* `leaving` says the page is going away, and it changes how the write is
     sent — see beacon() below. It is passed down rather than read off a
     variable so that an ordinary press of Save cannot be caught by it. */
  function flush(key, leaving) {
    for (var i = pending.length - 1; i >= 0; i--) {
      if (key && pending[i].key !== key) continue;
      var job = pending[i].run;
      pending.splice(i, 1);
      var out = job(leaving);
      if (out && out.then) out.then(function (a) { if (a && !a.ok) failed(a.out); }).catch(function () {});
    }
    settled();
  }

  function flushAll(leaving) { flush(null, leaving); }

  /* The same write, for the moment the page is being taken away.
   *
   * A plain fetch is the wrong tool there and fails in the worst possible
   * place: the browser cancels requests in flight as the document goes, so the
   * sentence somebody has just finished typing — the one they are surest they
   * saved — is the likeliest of all to be lost. sendBeacon is built for this.
   * The request is handed over and the browser sends it once the page is gone.
   *
   * Nothing comes back, and there is nowhere to put an answer anyway: the page
   * that would have shown the error no longer exists. A refusal — the queue is
   * full, the body too large — falls back to the fetch, which at least has a
   * chance while the document is still here.
   */
  function beacon(payload) {
    if (!navigator.sendBeacon) return post(payload);
    /* A Blob rather than a string, because its type becomes the request's
       Content-Type, and the API only reads JSON bodies. */
    var body = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    try {
      if (navigator.sendBeacon(API, body)) return null;
    } catch (e) { /* fall through */ }
    return post(payload);
  }

  /* The same write, addressed rather than typed: `leaving` picks the way it
     goes out, and every caller that has a payload and knows whether the page
     is going away uses this rather than choosing for itself. */
  function deliver(payload, leaving) {
    return leaving ? beacon(payload) : post(payload);
  }

  /* ------------------------------------------------------------ the mark
   * What the Save button is saying.
   *
   * The button is both halves of the same sentence: it is what sends the
   * edits, and it is what says whether there are any. Two states, and it is
   * always in whichever one is true:
   *
   *   Save    filled, in the style's accent: something has been typed, moved
   *           or switched that the server has not got.
   *   Saved   quiet, in the page's own wash: there is nothing left to send.
   *
   * Both are tokens, so the mark is brick on the light style and forest on
   * the dark one and names no colour of its own — see the note at the top of
   * assets/styles.css.
   *
   * "Has not got" is two things and either one is enough: an edit sitting in
   * `pending`, and a write handed to the network and not yet answered. The
   * second is what keeps the button filled for the moment after the press,
   * and it is also the whole of what the two immediate writes — a place added,
   * a place removed — ever put there.
   *
   * A write that fails is toasted where it fails and does not hold the mark
   * open: the page's other optimism works the same way — a place that will
   * not go on comes straight back off the list — and a button stuck on Save
   * with nothing left to press would be the one state you cannot get out of.
   */
  var mark = {
    btn: null,     /* the Save button, while one is on screen */
    sending: 0,    /* writes handed to the network and not yet answered */
    asked: false   /* the button was pressed, so it owes a word when it lands */
  };

  function allSent() { return !pending.length && !mark.sending; }

  function paintSave() {
    if (!mark.btn) return;
    var done = allSent();
    mark.btn.classList.toggle('is-saved', done);
    mark.btn.textContent = t(done ? 'listsSaveDone' : 'listsSave');
  }

  /* Called wherever either count changes. It paints — and if somebody pressed
     the button rather than simply typing, it says the word, once, at the
     moment the last write actually lands, which is the only moment it is
     true. */
  function settled() {
    paintSave();
    if (mark.asked && allSent()) {
      mark.asked = false;
      toast(t('listsSaved'));
    }
  }

  /* What the server last heard, under the same keys the queue uses. It is
     kept here rather than in each field's own closure because the fields are
     rebuilt whenever the list is redrawn and this must not be: typing a word,
     dragging a row, and then deleting the word again should leave nothing to
     save, and after the redraw the field itself no longer remembers what the
     word replaced. */
  var sent = {};

  function firstSeen(key, value) { if (!(key in sent)) sent[key] = value; }

  /* A field that edits the list in front of you and hands Save the write.
     `edit` is given what was typed; it returns the request to make, or
     nothing at all when there is no longer anything to send — which is what
     typing something and then typing it back amounts to. */
  function typedField(key, node, edit) {
    node.addEventListener('input', function () {
      var run = edit(node.value);
      if (run) queue(key, run); else unqueue(key);
    });
    /* Enter is the end of a one-line field, so it does what leaving does:
       nothing goes anywhere, but the field is finished with. */
    node.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); node.blur(); }
    });
  }

  /* The note under a place: the one field somebody spends real time in. What
     is typed goes onto the item at once, so a redraw keeps it. */
  function sayField(node, item) {
    var key = 'say:' + item.place;
    firstSeen(key, item.say || '');
    typedField(key, node, function (value) {
      var next = value.trim().slice(0, MAX_SAY);
      item.say = next;
      if (next === sent[key]) return null;
      return function (leaving) {
        sent[key] = next;
        return deliver({ action: 'say', id: state.list.id, place: item.place, say: next }, leaving);
      };
    });
  }

  /* The one dish worth ordering, on your own list: the same shape sayField()
     is, its own queue key so typing in one box never sends the other box's
     stale value along with it. */
  function mustOrderField(node, item) {
    var key = 'mustOrder:' + item.place;
    firstSeen(key, item.mustOrder || '');
    typedField(key, node, function (value) {
      var next = value.trim().slice(0, MAX_MUST_ORDER);
      item.mustOrder = next;
      if (next === sent[key]) return null;
      return function (leaving) {
        sent[key] = next;
        return deliver({ action: 'mustOrder', id: state.list.id, place: item.place, mustOrder: next }, leaving);
      };
    });
  }

  /* --------------------------------------------------------------- moving
   *
   * The order is most of the point of a top ten, so changing it is the one
   * gesture on this page worth spending real code on. A row is carried to
   * where it belongs: pressed and dragged with a mouse, held for a moment and
   * then carried with a thumb.
   *
   * This used to be an up button and a down button, and the argument for them
   * was that a drag fights the page's own scrolling on a phone and is no
   * gesture at all on a keyboard. Both of those are still true, and both are
   * answered here rather than avoided:
   *
   *   the phone     a touch does not lift a row until the finger has rested on
   *                 it for a moment without travelling. Anything that moves
   *                 sooner is somebody scrolling, and the page scrolls. Once a
   *                 row is lifted the scrolling is held off — see block() —
   *                 and the window follows the finger by itself near the top
   *                 and bottom edges, which is how a row reaches the far end of
   *                 a list taller than the screen. The grip is the exception:
   *                 it answers a finger straight away, because CSS has already
   *                 taken it out of the scroll (`touch-action: none`) and there
   *                 is no other gesture there to be confused with.
   *
   *   the keyboard  the grip is a real button. Focus it and the arrow keys walk
   *                 the row up and down the list, one place a press — exactly
   *                 the move the two buttons made. It keeps the focus across
   *                 the redraw, so the same key can be pressed again, and the
   *                 new position is said out loud, which the old buttons never
   *                 did.
   *
   * NOTHING IS REORDERED WHILE A FINGER IS DOWN
   *
   * The rows stay where the browser laid them out and a drag only writes
   * `transform` on them: the carried row follows the pointer, and the rows it
   * has passed slide out of its way by exactly the height of the hole it left
   * behind. The array is spliced once, on release, and the page is redrawn from
   * it — so what is on the screen and what is in `state.list.items` cannot
   * disagree halfway through a gesture, and a drag abandoned by a phone call
   * leaves nothing behind but some transforms to clear.
   *
   * The whole order goes to the server — see order() in the API for why a move
   * is not sent as a move.
   */

  /* How long a thumb has to rest on a row before it lifts, and how far a
     pointer may travel before a press counts as a carry. The hold is what
     keeps a list scrollable; the slop is what keeps a mouse from lifting a row
     somebody only clicked. */
  var HOLD = 220;
  var SLOP = 6;
  /* How near the top or bottom of the window a carried row has to come before
     the page starts moving under it, and how fast it moves at the very edge. */
  var EDGE = 76;
  var EDGE_STEP = 16;
  /* The slide a row makes as it is set down. The same number is in the CSS
     transition, and the redraw waits for it. */
  var SETTLE = 170;

  /* Whether a row is up, and until the one being set down has landed. One at a
     time: a second finger on another row would be two answers to one
     question. */
  var carrying = null;

  function indexOfPlace(place) {
    var items = state.list.items;
    for (var i = 0; i < items.length; i++) if (items[i].place === place) return i;
    return -1;
  }

  /* One place up or down: the arrow keys, and nothing else now. */
  function move(place, delta) {
    var at = indexOfPlace(place);
    if (at === -1) return;
    var to = at + delta;
    if (to < 0 || to >= state.list.items.length) return;
    reorder(at, to, true);
  }

  /* The one place the order actually changes, whichever gesture asked for it.
     Everything above it decides `to`; this splices, redraws and hands the new
     order to Save. */
  function reorder(from, to, focus) {
    if (from === to) return;
    var items = state.list.items;
    TTBTrack.event('list_reorder', { list_id: state.list.id, from: from + 1, to: to + 1 });

    items.splice(to, 0, items.splice(from, 1)[0]);
    render();

    var row = dom.main.querySelectorAll('.item.is-mine')[to];
    if (row) {
      /* The row that moved keeps the focus, so a keyboard can press the same
         key again and walk a place the length of the list. */
      if (focus) {
        var grip = row.querySelector('.row-grip');
        if (grip) grip.focus();
      }
      /* And it says where it landed, for a second, to whichever eye was
         following the finger rather than the numbers. */
      row.classList.add('is-landed');
    }
    announce(t('listsMoved', { n: to + 1 }));

    /* One entry however many times a row is carried about: the order is a
       single fact, and Save sends whatever it is by then. It reads the list
       at the moment it goes rather than a copy taken here, so a place removed
       in between is not sent back to the server as part of an order. */
    queue('order', function (leaving) {
      return deliver({
        action: 'order',
        id: state.list.id,
        places: state.list.items.map(function (it) { return it.place; })
      }, leaving);
    });
  }

  /* Said to a screen reader and to nobody else. A move is obvious on a screen
     — the row is under the finger and the numbers redraw — and completely
     silent without one, which is what the two buttons were also guilty of.
     The region is in the page rather than built here, because a live region
     inserted and filled in the same breath is not announced. */
  function announce(message) {
    if (!dom.live) return;
    dom.live.textContent = '';
    setTimeout(function () { dom.live.textContent = message; }, 40);
  }

  function block(ev) { ev.preventDefault(); }

  function within(node, selector) {
    return node && node.closest ? node.closest(selector) : null;
  }

  /* Everything a row needs to be picked up, given to it as it is built. */
  function carry(row, item, grip) {
    grip.addEventListener('keydown', function (ev) {
      if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') return;
      /* Otherwise the page scrolls under the row that is being moved. */
      ev.preventDefault();
      move(item.place, ev.key === 'ArrowUp' ? -1 : 1);
    });

    row.addEventListener('pointerdown', function (ev) {
      if (carrying || ev.button > 0) return;
      if (!state.list || state.list.items.length < 2) return;
      var onGrip = !!within(ev.target, '.row-grip');
      /* Everything that is already something to press or to type in keeps its
         own gesture: a drag begun in the note box would take the caret out of
         the sentence somebody is in the middle of writing. */
      if (!onGrip && within(ev.target, 'a, button, textarea, input, select')) return;
      lift(ev, row, onGrip);
    });
  }

  /* One drag, from the press that might become one to the row being set down.
     Everything it needs lives in here: nothing about a gesture outlives it. */
  function lift(ev, row, onGrip) {
    var list = row.parentNode;
    var rows = [];
    var all = list.querySelectorAll('.item.is-mine');
    for (var i = 0; i < all.length; i++) rows.push(all[i]);

    var from = rows.indexOf(row);
    if (from === -1 || rows.length < 2) return;

    var id = ev.pointerId;
    var finger = ev.pointerType === 'touch' || ev.pointerType === 'pen';
    var startX = ev.clientX;
    var startY = ev.clientY;
    var startTop = window.pageYOffset;
    var lastY = ev.clientY;

    var live = false;     /* whether the row is actually up */
    var hold = null;      /* the thumb's rest, still to be waited out */
    var frame = 0;        /* the edge-scrolling loop */
    var geom = null;      /* every row's place on the page, measured once */
    var span = 0;         /* the height of the hole the carried row leaves */
    var to = from;
    var shown = from;     /* the last position the numbers were drawn for */

    document.addEventListener('pointermove', moved);
    document.addEventListener('pointerup', dropped);
    document.addEventListener('pointercancel', lost);

    if (finger && onGrip) begin();
    else if (finger) hold = setTimeout(function () { hold = null; begin(); }, HOLD);

    /* Where every row stands, in page coordinates, taken at the moment of the
       lift and not again: the page scrolls under a carried row and nothing
       else about the layout moves, so measuring once is measuring right. */
    function measure() {
      var top = window.pageYOffset;
      geom = rows.map(function (node) {
        var box = node.getBoundingClientRect();
        return { top: box.top + top, height: box.height };
      });
      var gap = geom.length > 1 ? geom[1].top - (geom[0].top + geom[0].height) : 0;
      span = geom[from].height + gap;
    }

    function begin() {
      live = true;
      carrying = true;
      measure();

      /* A long press on a phone is also how text is selected and how the
         callout menu is asked for. Neither is what this gesture means. */
      try {
        var selection = window.getSelection();
        if (selection && selection.removeAllRanges) selection.removeAllRanges();
      } catch (e) { /* nothing worth failing over */ }

      list.classList.add('is-sorting');
      row.classList.add('is-lifted');
      document.body.classList.add('is-carrying');
      /* So the row keeps the pointer even when it slides out from under it. */
      try { row.setPointerCapture(id); } catch (e) { /* older engine */ }
      /* The page does not scroll while a row is up. touch-action cannot say
         this — it is read when the finger lands, and by then the browser does
         not yet know this is a carry rather than a swipe — so the scroll is
         refused one touchmove at a time instead. */
      document.addEventListener('touchmove', block, { passive: false });
      document.addEventListener('contextmenu', block);
      frame = window.requestAnimationFrame(chase);
      paint();
    }

    /* Where the carried row is, and where every other row has to be to leave
       it a hole. Called on every move, and on every step of an edge scroll. */
    function paint() {
      var y = lastY + window.pageYOffset;
      var dy = y - (startY + startTop);

      /* A row cannot be carried out of its own list. */
      var last = geom[geom.length - 1];
      var lowest = last.top + last.height - (geom[from].top + geom[from].height);
      dy = Math.max(geom[0].top - geom[from].top, Math.min(lowest, dy));

      var middle = geom[from].top + geom[from].height / 2 + dy;

      /* Where it would be dropped: the number of rows whose middle is above
         it — each of them measured where it is standing now, which for the
         ones below the hole is a whole row's height further up. */
      to = 0;
      for (var j = 0; j < geom.length; j++) {
        if (j === from) continue;
        var at = geom[j].top + geom[j].height / 2 - (j > from ? span : 0);
        if (at < middle) to++;
      }

      row.style.transform = 'translateY(' + Math.round(dy) + 'px)';
      for (var k = 0; k < rows.length; k++) {
        if (k === from) continue;
        var shift = (k > from && k <= to) ? -span : (k < from && k >= to) ? span : 0;
        rows[k].style.transform = shift ? 'translateY(' + shift + 'px)' : '';
      }

      /* The numbers are the whole argument for the gesture, so they are told
         the truth while it is happening rather than after it: a row sitting
         first and still printing 3 is the list disagreeing with itself under
         somebody's finger. Only when the answer changes — this is inside a
         pointermove. */
      if (to !== shown) {
        shown = to;
        for (var n = 0; n < rows.length; n++) {
          var lands = n === from ? to
            : (n > from && n <= to) ? n - 1
            : (n < from && n >= to) ? n + 1
            : n;
          var digit = rows[n].querySelector('.item-n');
          if (digit) digit.textContent = String(lands + 1);
        }
      }
    }

    /* The page moving under a finger that has run out of screen. Without it a
       list of twenty is only reorderable within one screenful. */
    function chase() {
      if (!live) return;
      var below = lastY - (window.innerHeight - EDGE);
      var above = EDGE - lastY;
      var by = below > 0 ? Math.min(below, EDGE) : above > 0 ? -Math.min(above, EDGE) : 0;
      if (by) {
        var was = window.pageYOffset;
        window.scrollBy(0, by / EDGE * EDGE_STEP);
        if (window.pageYOffset !== was) paint();
      }
      frame = window.requestAnimationFrame(chase);
    }

    function moved(ev2) {
      if (ev2.pointerId !== id) return;
      lastY = ev2.clientY;
      if (live) { paint(); return; }
      if (Math.abs(ev2.clientY - startY) <= SLOP && Math.abs(ev2.clientX - startX) <= SLOP) return;
      /* Travel before the rest is over is somebody scrolling the page, and the
         row stays where it is. */
      if (hold) { clearTimeout(hold); hold = null; stop(false); return; }
      if (finger) return;
      begin();
    }

    function dropped(ev2) { if (ev2.pointerId === id) stop(true); }
    function lost(ev2) { if (ev2.pointerId === id) stop(false); }

    /* Setting the row down. `keep` is false when the gesture was taken away
       rather than finished — a phone call, the browser deciding it was a
       scroll after all — and then the row goes back where it came from. */
    function stop(keep) {
      document.removeEventListener('pointermove', moved);
      document.removeEventListener('pointerup', dropped);
      document.removeEventListener('pointercancel', lost);
      if (hold) { clearTimeout(hold); hold = null; }
      if (!live) return;

      live = false;
      if (frame) { window.cancelAnimationFrame(frame); frame = 0; }
      document.removeEventListener('touchmove', block);
      document.removeEventListener('contextmenu', block);
      document.body.classList.remove('is-carrying');
      try { row.releasePointerCapture(id); } catch (e) { /* never had it */ }

      /* The press that ends a drag must not also be a click on whatever the
         row happens to have been let go over. */
      document.addEventListener('click', swallow, true);
      setTimeout(function () { document.removeEventListener('click', swallow, true); }, 0);

      var target = keep ? to : from;

      /* It lands rather than snapping: the lift comes off it and it is sent to
         the hole, and the redraw waits for that slide to finish. */
      row.classList.remove('is-lifted');
      row.style.transform = 'translateY(' + Math.round(rest(target)) + 'px)';

      setTimeout(function () {
        carrying = null;
        if (target === from) {
          list.classList.remove('is-sorting');
          for (var k = 0; k < rows.length; k++) {
            rows[k].style.transform = '';
            var digit = rows[k].querySelector('.item-n');
            if (digit) digit.textContent = String(k + 1);
          }
          return;
        }
        /* The redraw builds every row again from the array, transforms and
           all, so there is nothing here to clean up after it. */
        reorder(from, target, false);
      }, SETTLE);
    }

    function swallow(ev2) { ev2.preventDefault(); ev2.stopPropagation(); }

    /* How far the carried row has to travel from where it started to sit in
       the hole. Going down it ends flush with the bottom of the row it passed,
       because everything in between has come up by a row's height; going up it
       simply takes that row's place. */
    function rest(target) {
      if (target === from) return 0;
      if (target > from) {
        return geom[target].top + geom[target].height - geom[from].height - geom[from].top;
      }
      return geom[target].top - geom[from].top;
    }
  }

  /* Taking a place off, which goes to the server as it happens rather than
     waiting for Save — see addPlace() for why membership is not held. What is
     typed under the row goes with it: the note belongs to a place that is no
     longer on the list, and sending it after the removal would be a write
     about nothing. */
  function drop(place) {
    TTBTrack.event('list_remove', { list_id: state.list.id, place: place });
    unqueue('say:' + place);
    var items = state.list.items;
    for (var i = 0; i < items.length; i++) {
      if (items[i].place === place) { items.splice(i, 1); break; }
    }
    render();
    post({ action: 'drop', id: state.list.id, place: place })
      .then(function (a) { if (!a.ok) failed(a.out); })
      .catch(function () { failed({}); });
  }

  function deleteList() {
    var list = state.list;
    if (!window.confirm(t('listsDeleteSure', { title: list.title }))) return;
    TTBTrack.event('list_delete', { list_id: list.id });
    post({ action: 'delete', id: list.id }).then(function (a) {
      if (!a.ok) return failed(a.out);
      window.location.href = '/account.html';
    }).catch(function () { failed({}); });
  }

  /* --------------------------------------------------------------- sharing
   * The share sheet on a phone and the clipboard on a laptop. Both end in the
   * same place: a URL in somebody's hand.
   *
   * WHICH ONE IS DECIDED BY THE POINTER, NOT BY navigator.share
   * Every desktop browser has navigator.share now, and asking for it there
   * opens an OS sheet listing applications to send the link to — with no
   * "copy link" in it, which is the one thing somebody sharing from a laptop
   * wants. It is not the sheet that is wrong, it is the question: a coarse
   * pointer is a phone or a tablet, where the sheet is the whole point, and
   * everything else has a clipboard and a place to paste into.
   */
  function shareList() {
    /* The button is drawn disabled under three places; this is the click that
       got in before the last render caught up. */
    if (state.list.mine && state.list.items.length < MIN_ITEMS) {
      toast(t('listsShareNeeds'));
      return;
    }

    var url = window.location.origin + '/list/' + state.list.id;
    var payload = { title: state.list.title, url: url };

    if (navigator.share && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
      TTBTrack.event('list_share', { list_id: state.list.id, method: 'sheet' });
      navigator.share(payload).catch(function () { /* dismissed, which is fine */ });
      return;
    }
    TTBTrack.event('list_share', { list_id: state.list.id, method: 'copy' });
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(function () { toast(t('listsCopied')); })
        .catch(function () { window.prompt(t('listsShare'), url); });
      return;
    }
    window.prompt(t('listsShare'), url);
  }

  /* ---------------------------------------------------------------- picker
   * Every place in Tallinn, narrowed to the one being added.
   *
   * /api/places is fetched the first time this opens and never again. It is
   * the map's own places and the Google export behind them — see
   * functions/api/places.js — and it is the one big answer on this page, so it
   * is not part of the load: somebody reading a list never asks for it, and
   * somebody building one waits for it once, behind a sheet they have just
   * opened.
   */
  function openPicker() {
    TTBTrack.event('picker_open', { list_id: state.list.id, places_on: state.list.items.length });
    dom.pickerScrim.hidden = false;
    document.body.classList.add('has-scrim');
    dom.pickerSearch.value = '';
    dom.pickerClear.hidden = true;
    /* Focus lands on the sheet and not on the field inside it. Focusing the
       field summoned the on-screen keyboard the moment the picker opened —
       half the screen gone before anybody had decided to search, and on iOS
       the sheet dragged up behind the keys with it, so the first thing a
       phone showed of "Add a place" was everything except the title. The
       keyboard belongs to the field and comes up when the field is tapped. */
    dom.picker.focus({ preventScroll: true });

    if (state.places) { paintPicker(); return; }

    clear(dom.pickerBody);
    dom.pickerBody.appendChild(el('p', { className: 'picker-note', textContent: t('accountWorking') }));

    /* Both rolls the picker searches: the eight hundred behind /api/places,
       and whatever this account has added by hand — so a place typed in for
       one list can go on the next one without being typed again.

       The added ones are asked for alongside and are allowed to fail on their
       own: they are the smaller half, and a picker showing eight hundred
       places is a working picker even if the four somebody added did not
       arrive. */
    Promise.all([
      getJSON('/api/places'),
      ask(API + '?added=1').then(function (a) {
        return (a.out && a.out.added) || [];
      }).catch(function () { return []; })
    ]).then(function (loaded) {
      var answer = loaded[0];
      var places = Array.isArray(answer) ? answer : (answer && answer.places) || [];
      /* Yours first. They are few, they are the ones you went to the trouble
         of typing, and the picker stops at forty rows. */
      state.places = loaded[1].concat(places);
      state.hay = {};
      state.places.forEach(function (p) {
        state.hay[p.id] = fold(p.name + ' ' + (p.address || ''));
      });
      paintPicker();
    }).catch(function () {
      clear(dom.pickerBody);
      dom.pickerBody.appendChild(el('p', { className: 'picker-note', textContent: t('loadError') }));
    });
  }

  function closePicker() {
    if (dom.pickerScrim.hidden) return;
    TTBTrack.event('picker_close', { list_id: state.list.id });
    dom.pickerScrim.hidden = true;
    document.body.classList.remove('has-scrim');
  }

  /* How many rows the sheet draws before it stops and asks for a narrower
     search. Five hundred rows is a scroll nobody finishes and a second of
     layout on a phone; forty is more than anybody reads before they type
     another letter. */
  var PICKER_ROWS = 40;

  function paintPicker() {
    clear(dom.pickerBody);
    /* Back from the add form, or never gone. */
    dom.pickerSearch.closest('.search').hidden = false;
    if (!state.places) return;

    var words = fold(dom.pickerSearch.value).replace(/\s+/g, ' ').replace(/^ | $/g, '');
    var terms = words ? words.split(' ') : [];

    var on = {};
    state.list.items.forEach(function (it) { on[it.place] = true; });

    /* Full: every row goes grey and says why, once, at the top. The server
       refuses the fifty-first place anyway, but finding that out by watching
       a row appear and then vanish is a worse way to be told. */
    var full = state.list.items.length >= MAX_ITEMS;
    if (full) {
      dom.pickerBody.appendChild(el('p', {
        className: 'picker-note',
        textContent: t('listsErrFull')
      }));
    }

    var found = [];
    for (var i = 0; i < state.places.length && found.length <= PICKER_ROWS; i++) {
      var place = state.places[i];
      var hay = state.hay[place.id] || '';
      var hit = true;
      for (var w = 0; w < terms.length; w++) {
        if (hay.indexOf(terms[w]) === -1) { hit = false; break; }
      }
      if (hit) found.push(place);
    }

    /* The place is not on either roll. This is the moment the feature exists
       for, so the door is the answer to the empty state rather than a line
       under it — there is nothing else on screen to read. */
    if (!found.length) {
      dom.pickerBody.appendChild(el('p', {
        className: 'picker-note',
        textContent: terms.length ? t('searchNone', { q: dom.pickerSearch.value.trim() }) : t('listsSearchHint')
      }));
      if (terms.length && !full) dom.pickerBody.appendChild(addDoor(dom.pickerSearch.value.trim()));
      return;
    }

    var more = found.length > PICKER_ROWS;
    var ul = el('ul', { className: 'picker-list' });
    found.slice(0, PICKER_ROWS).forEach(function (place) {
      ul.appendChild(pickerRow(place, !!on[place.id], full));
    });
    dom.pickerBody.appendChild(ul);

    if (more) {
      dom.pickerBody.appendChild(el('p', { className: 'picker-note', textContent: t('listsNarrow') }));
    }

    /* And under the results, because "not found" is not always an empty
       screen: searching "burger" can return nine places and still not the one
       being looked for. Only once something has been typed — the door under
       eight hundred unfiltered rows is an invitation to add a duplicate. */
    if (terms.length && !full) {
      dom.pickerBody.appendChild(addDoor(dom.pickerSearch.value.trim()));
    }
  }

  /* ------------------------------------------------- adding a place
   * The place neither roll has.
   *
   * The picker searches about eleven hundred places — my seventy-five and the
   * Google export behind /api/places — and between them they still miss
   * things: somewhere that opened last month, somewhere Google files as not a
   * restaurant. Before this, the answer to "it is not in the list" was nothing
   * at all, and the list simply could not be finished.
   *
   * WHY THERE IS A MAP IN HERE
   *
   * Because a place without a point is a row that goes on the list and then
   * quietly is not on the map — assets/app.js drops a list row it cannot put a
   * pin for, so the one thing somebody adding a place actually wants would be
   * the thing that silently did not happen. Dragging a pin is also the only
   * way to say where somewhere is that needs no address to exist, no
   * geocoder, and no second service to be up.
   *
   * Leaflet is fetched here and nowhere else on this page. Somebody who opened
   * a link to read a top ten never asks for it.
   */

  var LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  var LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  var LEAFLET_JS_HASH = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
  var LEAFLET_CSS_HASH = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';

  /* The same version, the same integrity hashes and the same CDN index.html
     uses, so a browser that has been to the map already has both files and
     this costs nothing. Kept in step by hand: two files naming one version is
     the price of the map page not loading a second copy of its own script. */
  var leafletPromise = null;

  function ensureLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;

    leafletPromise = new Promise(function (resolve, reject) {
      var css = el('link', {
        rel: 'stylesheet',
        href: LEAFLET_CSS,
        integrity: LEAFLET_CSS_HASH,
        crossorigin: ''
      });
      document.head.appendChild(css);

      var js = el('script', {
        src: LEAFLET_JS,
        integrity: LEAFLET_JS_HASH,
        crossorigin: ''
      });
      js.addEventListener('load', function () {
        window.L ? resolve(window.L) : reject(new Error('leaflet loaded without L'));
      });
      js.addEventListener('error', function () { reject(new Error('leaflet unreachable')); });
      document.head.appendChild(js);
    }).catch(function (err) {
      /* Let the next press try again rather than remembering the failure
         forever: this is one flaky request on a CDN, not a broken page. */
      leafletPromise = null;
      throw err;
    });

    return leafletPromise;
  }

  /* Where the pin starts, and what the form means by "near Tallinn". The
     server checks this again and is the one that binds — see TALLINN in
     functions/api/lists.js — but a pin that cannot be dragged out of the
     allowed box is better than a refusal after the fact. */
  var CITY = [59.437, 24.7536];

  /* The door, at the foot of the picker. It carries whatever was typed into
     the search box, because that is almost always the name: somebody looking
     for Uus Burgerikoht has already typed "uus burger" by the time they
     conclude it is not there. */
  function addDoor(typed) {
    var b = el('button', {
      type: 'button',
      className: 'picker-add',
      textContent: t('listsAddMissing')
    });
    b.addEventListener('click', function () {
      TTBTrack.event('place_missing', { search_term: typed.toLowerCase() });
      addForm(typed);
    });
    return b;
  }

  function addForm(typed) {
    clear(dom.pickerBody);
    /* The search field is static markup above this, so it would otherwise sit
       there live over a form that is not searching anything — type into it and
       nothing happens, which is the worst kind of control. It comes back with
       paintPicker(). */
    dom.pickerSearch.closest('.search').hidden = true;

    var back = el('button', {
      type: 'button',
      className: 'alt picker-back',
      textContent: t('listsBackToSearch')
    });
    back.addEventListener('click', paintPicker);

    var name = el('input', {
      type: 'text',
      className: 'lists-input',
      value: typed || '',
      maxlength: '80',
      autocomplete: 'off',
      'aria-label': t('listsAddName'),
      placeholder: t('listsAddNameHint')
    });

    var address = el('input', {
      type: 'text',
      className: 'lists-input',
      maxlength: '120',
      autocomplete: 'off',
      'aria-label': t('listsAddAddress'),
      placeholder: t('listsAddAddressHint')
    });

    /* The suggestions, and the button that takes the first one. Typing an
       address and pressing enter is what people do, and before this it did
       nothing at all: the pin sat on the city centre until it was dragged
       there by hand.

       The field is a combobox in the ARIA sense — an input that owns a list
       somebody arrows through — so it is wired as one: the input announces
       which option is active, the list is a listbox, and every option has an
       id for the input to point at. Screen readers get told a list appeared;
       a keyboard gets up, down, enter and escape.

       The button stays even though the list does most of the work, because
       the enter key is invisible and a phone keyboard shows "done" rather
       than anything that suggests searching. */
    var suggestId = 'picker-suggest';
    address.setAttribute('role', 'combobox');
    address.setAttribute('aria-expanded', 'false');
    address.setAttribute('aria-controls', suggestId);
    address.setAttribute('aria-autocomplete', 'list');

    var suggest = el('ul', {
      className: 'picker-suggest',
      id: suggestId,
      role: 'listbox',
      hidden: true
    });

    var find = el('button', {
      type: 'button',
      className: 'alt picker-find',
      textContent: t('listsAddFind')
    });
    var addressRow = el('div', { className: 'picker-find-row' }, [
      el('div', { className: 'picker-find-field' }, [address, suggest]),
      find
    ]);

    var canvas = el('div', { className: 'picker-map', id: 'picker-map' });
    var hint = el('p', { className: 'picker-note', textContent: t('listsAddPin') });
    var go = el('button', { type: 'button', className: 'go', textContent: t('listsAddIt') });

    var form = el('div', { className: 'picker-add-form' }, [
      back,
      el('h3', { className: 'picker-title', textContent: t('listsAddMissing') }),
      name, addressRow, hint, canvas,
      el('div', { className: 'lists-row lists-acts' }, [go])
    ]);
    dom.pickerBody.appendChild(form);
    name.focus();

    /* The pin's position, kept here rather than read off the marker, so the
       submit below works the same whether or not the map ever loaded. */
    var at = { lat: CITY[0], lng: CITY[1] };
    var ready = false;
    /* Set once the map exists, and left null when it does not: the address
       lookup still moves `at`, it just has no pin to move with it. */
    var movePin = null;

    ensureLeaflet().then(function (L) {
      var map = L.map(canvas, {
        center: CITY,
        zoom: 13,
        zoomControl: true,
        attributionControl: true
      });
      /* The tiles, the key and the attribution come from assets/basemap.js,
         which the map page and the admin picker draw from too. This square
         used to hold its own copy of that URL, which is how it ended up as
         the one map on the site still wearing "API KEY REQUIRED". */
      TTBBasemap.layer(L, { maxZoom: 19 }).addTo(map);

      /* A divIcon rather than Leaflet's default marker, for the reason the map
         page uses one too: the default is a PNG fetched from the CDN's images
         directory, at a path Leaflet works out from where its stylesheet came
         from. That is one more request, the only asset here with no integrity
         hash, and a pin that does not look like anything else on this site.
         A styled span costs none of that. */
      var pin = L.marker(CITY, {
        draggable: true,
        autoPan: true,
        icon: L.divIcon({
          className: 'picker-pin',
          html: '<span></span>',
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        })
      }).addTo(map);
      pin.on('dragend', function () {
        var p = pin.getLatLng();
        at = { lat: p.lat, lng: p.lng };
      });
      /* Pressing the map moves the pin too. Dragging a 20px marker is the
         fiddly half of this on a phone, and a tap is the gesture people try
         first. */
      map.on('click', function (ev) {
        pin.setLatLng(ev.latlng);
        at = { lat: ev.latlng.lat, lng: ev.latlng.lng };
      });
      movePin = function (lat, lng) {
        pin.setLatLng([lat, lng]);
        /* Close enough to read the street names, because the whole point of
           having typed an address is to see that the pin landed on the right
           building — and to drag it the last few metres to the door. */
        map.setView([lat, lng], 17);
      };
      ready = true;
    }).catch(function () {
      /* No map. The form still works — the pin stays where the city centre
         is — but somebody has to be told that is what they are submitting,
         rather than discovering it on the list afterwards. */
      canvas.remove();
      hint.textContent = t('listsAddNoMap');
      hint.classList.add('is-warn');
      ready = true;
    });

    /* The lookup.
     *
     * Debounced rather than sent per keystroke: /api/geocode goes out to
     * Photon, which is built to answer a prefix but is still somebody else's
     * machine, and a request per keystroke on "Telliskivi" is ten requests
     * for one address. A pause in the typing is the signal that a prefix is
     * worth asking about.
     *
     * Every answer carries the point with it, so picking a suggestion moves
     * the pin without a second round trip — the list is not a list of things
     * to then look up, it is the lookup.
     */
    var PAUSE = 300;
    var MIN_Q = 3;

    var timer = null;
    var inflight = 0;
    var hits = [];
    var active = -1;
    var chosen = '';

    function say(key, warn) {
      hint.textContent = t(key);
      hint.classList.toggle('is-warn', !!warn);
    }

    function shut() {
      suggest.hidden = true;
      clear(suggest);
      address.setAttribute('aria-expanded', 'false');
      address.removeAttribute('aria-activedescendant');
      hits = [];
      active = -1;
    }

    function highlight(i) {
      var rows = suggest.children;
      if (!rows.length) return;
      /* Wraps, because a list of five that stops dead at either end is a list
         somebody presses down against wondering if the key is broken. */
      active = (i + rows.length) % rows.length;
      for (var n = 0; n < rows.length; n++) {
        rows[n].classList.toggle('is-active', n === active);
        rows[n].setAttribute('aria-selected', n === active ? 'true' : 'false');
      }
      address.setAttribute('aria-activedescendant', rows[active].id);
      if (rows[active].scrollIntoView) rows[active].scrollIntoView({ block: 'nearest' });
    }

    /* Taking a suggestion: the pin moves, the field is filled in with the
       address as the geocoder spells it, and the list goes away. `chosen`
       stops the input handler that fires next from immediately asking about
       the text it just wrote. */
    function take(hit) {
      if (!hit) return;
      at = { lat: hit.lat, lng: hit.lng };
      /* What the row said is not always what the field wants: a named venue
         shows under its name and fills in the street it is on. */
      chosen = hit.fill || hit.label;
      address.value = chosen;
      shut();
      if (movePin) {
        movePin(hit.lat, hit.lng);
        /* The pin is on the building, not on the door, and this form is
           asking for the door. */
        say('listsAddFound');
      } else {
        say('listsAddNoMap', true);
      }
    }

    function draw(list) {
      clear(suggest);
      hits = list;
      active = -1;

      if (!list.length) { shut(); return; }

      for (var i = 0; i < list.length; i++) {
        (function (hit, n) {
          var row = el('li', {
            className: 'picker-suggest-row',
            id: suggestId + '-' + n,
            role: 'option',
            'aria-selected': 'false'
          }, [
            el('span', { className: 'picker-suggest-name', textContent: hit.label })
          ]);
          if (hit.where) {
            row.appendChild(el('span', { className: 'picker-suggest-where', textContent: hit.where }));
          }
          /* mousedown and not click: the field is about to lose focus to this
             press, and the blur handler below closes the list. mousedown gets
             there first. */
          row.addEventListener('mousedown', function (ev) {
            ev.preventDefault();
            take(hit);
          });
          row.addEventListener('mouseenter', function () { highlight(n); });
          suggest.appendChild(row);
        })(list[i], i);
      }

      suggest.hidden = false;
      address.setAttribute('aria-expanded', 'true');
    }

    function lookUp(q, andTakeFirst) {
      /* Same gate the Add button uses. Leaflet is still on its way down for
         the first moment this form is open, and a suggestion taken before it
         arrived would have a point and nowhere to draw it. */
      if (!ready) return;

      var mine = ++inflight;
      if (andTakeFirst) { find.disabled = true; say('listsAddFinding'); }

      ask('/api/geocode?q=' + encodeURIComponent(q)).then(function (a) {
        /* An answer to a prefix somebody has already typed past is not an
           answer to the question on screen any more. */
        if (mine !== inflight) return;
        if (andTakeFirst) find.disabled = false;

        var list = a.status === 200 && Array.isArray(a.out.results) ? a.out.results : [];

        if (!list.length) {
          shut();
          /* Silent while typing — a prefix matching nothing yet is the normal
             state of a half-typed street, not a failure worth a line of red.
             Only a deliberate press gets told. */
          if (andTakeFirst) say(a.status === 429 ? 'listsAddFindBusy' : 'listsAddFindNone', true);
          return;
        }

        if (andTakeFirst) { take(list[0]); return; }
        draw(list);
      });
    }

    /* Not `typed`. That is addForm's own argument, and a function declaration
       sharing a name with a parameter is not a second binding — it is the same
       one, and the declaration wins from the first line of the body. So the
       name field above was being filled with the source of this handler
       instead of with what somebody had searched for. */
    function addressTyped() {
      var q = address.value.trim();
      if (timer) clearTimeout(timer);

      /* The text this field was just filled with by take(). Asking about it
         would reopen the list under a suggestion somebody has already made. */
      if (q === chosen) return;
      chosen = '';

      if (q.length < MIN_Q) { shut(); return; }
      timer = setTimeout(function () { lookUp(q, false); }, PAUSE);
    }

    address.addEventListener('input', addressTyped);
    address.addEventListener('focus', addressTyped);

    /* Closing the list on the way out, but not before a press on it has been
       heard — the rows listen on mousedown, which lands first. */
    address.addEventListener('blur', function () { setTimeout(shut, 120); });

    address.addEventListener('keydown', function (ev) {
      var open = !suggest.hidden && hits.length;

      if (ev.key === 'ArrowDown' && open) { ev.preventDefault(); highlight(active + 1); return; }
      if (ev.key === 'ArrowUp' && open) { ev.preventDefault(); highlight(active - 1); return; }
      /* Escape closes the suggestions and nothing else. The document listens
         for it too and closes the whole sheet, which — with a name and an
         address typed into a form that is about to be submitted — is the
         worst thing this key could do. So the press is stopped here while
         there is a list to close, and falls through to the sheet once there
         is not. */
      if (ev.key === 'Escape' && open) {
        ev.preventDefault();
        ev.stopPropagation();
        shut();
        return;
      }

      if (ev.key !== 'Enter') return;

      /* There is no <form> around this, so enter submits nothing by itself.
         It is still the key people press, and this is what they mean by it —
         take the suggestion under the cursor, or the first one, or go and
         find one. Never "add the place", which is a button they have not
         reached yet. */
      ev.preventDefault();
      if (open) { take(hits[active === -1 ? 0 : active]); return; }

      var q = address.value.trim();
      if (q.length < MIN_Q) { address.focus(); return; }
      if (timer) clearTimeout(timer);
      lookUp(q, true);
    });

    find.addEventListener('click', function () {
      if (!suggest.hidden && hits.length) { take(hits[active === -1 ? 0 : active]); return; }
      var q = address.value.trim();
      if (q.length < MIN_Q) { address.focus(); return; }
      if (timer) clearTimeout(timer);
      lookUp(q, true);
    });

    go.addEventListener('click', function () {
      var typedName = name.value.trim();
      if (!typedName) { name.focus(); return; }
      if (!ready) return;

      go.disabled = true;
      go.textContent = t('accountWorking');

      post({
        action: 'place',
        name: typedName,
        address: address.value.trim(),
        lat: at.lat,
        lng: at.lng
      }).then(function (a) {
        if (!a.ok || !a.out.place) {
          go.disabled = false;
          go.textContent = t('listsAddIt');
          return failed(a.out);
        }
        /* Straight onto the list, because putting it there is the only reason
           anybody filled this in. It also joins the picker's own roll, so a
           second list can have it without it being typed again. */
        var made = a.out.place;
        TTBTrack.event('place_add', { place: made.name });
        if (state.places) {
          state.places.push(made);
          state.hay[made.id] = fold(made.name + ' ' + (made.address || ''));
        }
        addPlace(made);
      }).catch(function () {
        go.disabled = false;
        go.textContent = t('listsAddIt');
        failed({});
      });
    });
  }

  function pickerRow(place, already, full) {
    var row = el('button', {
      type: 'button',
      className: 'picker-row' + (already ? ' is-on' : ''),
      disabled: already || full || null
    }, [
      el('span', { className: 'picker-name', textContent: place.name }),
      el('span', { className: 'picker-address mono', textContent: place.address || '' }),
      sourceLine(place),
      already ? el('span', { className: 'picker-on mono', textContent: t('listsAdded') }) : null
    ]);
    if (!already && !full) row.addEventListener('click', function () { addPlace(place); });
    return row;
  }

  function addPlace(place) {
    var list = state.list;
    if (!list) return;
    /* The picker already greys these out; this is the second door, for a
       click that got in before the last render caught up. */
    if (list.items.length >= MAX_ITEMS) { toast(t('listsErrFull')); return; }
    TTBTrack.event('list_add', { list_id: list.id, place: place.name, places_on: list.items.length + 1 });

    /* Going on the list is sent now rather than held for Save, and it is one
       of only two writes on this page that are. The server decides whether a
       place may go on at all — it has to be on one of the three rolls, and
       the list has to have room — so the answer has to come back while the
       picker is still open and the gesture is still the thing being done. Held
       until Save, a refusal would arrive minutes later, about a row that had
       been sitting there looking accepted.

       Optimistic, the way the save mark on the map is: the row appears at once
       and the server's answer only ever corrects it. A place that fails to go
       on comes straight back off. */
    list.items.push({
      place: place.id,
      name: place.name,
      address: place.address || '',
      lat: typeof place.lat === 'number' ? place.lat : null,
      lng: typeof place.lng === 'number' ? place.lng : null,
      map: !!place.map,
      mapId: place.mapId || null,
      /* Carried across so the row the picker just drew and the row the list
         draws are the same row. Without these the line under the name would
         appear in the picker and then vanish the moment the place went on. */
      types: place.types || [],
      price: typeof place.price === 'number' ? place.price : null,
      google: !!place.google,
      say: ''
    });
    render();
    paintPicker();

    var undo = function (out) {
      for (var i = list.items.length - 1; i >= 0; i--) {
        if (list.items[i].place === place.id) { list.items.splice(i, 1); break; }
      }
      render();
      paintPicker();
      failed(out);
    };

    post({ action: 'add', id: list.id, place: place.id })
      .then(function (a) { if (!a.ok) undo(a.out); })
      .catch(function () { undo({}); });
  }

  /* --------------------------------------------------------- soft keyboard
   * What the keyboard covers, handed to the stylesheet as --kbd.
   *
   * The picker is the one thing on this page that takes typing, and both it
   * and the scrim behind it are already written against that number: the
   * scrim pads its bottom by it, the sheet takes it off its own ceiling. But
   * nothing here was ever setting it, so on a phone it stayed at zero and
   * both of them sized themselves against a screen half of which was behind
   * the keys. Safari then scrolled the difference to keep the field in view,
   * which is the same scroll that took the title off the top: what came back
   * from clearing a search was eight hundred rows and no "Add a place".
   *
   * iOS shrinks the visual viewport and leaves the layout viewport — and the
   * fixed scrim with it — at full height, which is what makes the measurement
   * possible. Android resizes the layout viewport itself and comes out at
   * zero, which is the right answer there. assets/app.js measures the same
   * number for the map's bottom sheet, and also keeps a --vph the drag stops
   * read; there is nothing to drag here, so this is the measurement alone.
   */
  function wireKeyboard() {
    var vv = window.visualViewport;
    if (!vv) return;

    function sync() {
      /* A pinch shrinks the visual viewport in exactly the way a keyboard
         does and the subtraction cannot tell them apart. The fields on this
         page are 16px precisely so that focusing one never zooms, so a scale
         that is not 1 is a pinch and not a keyboard. */
      if (vv.scale && Math.abs(vv.scale - 1) > .01) {
        document.documentElement.style.setProperty('--kbd', '0px');
        return;
      }
      var covered = window.innerHeight - vv.height - vv.offsetTop;
      /* Only a keyboard, not a URL bar sliding away. */
      var kbd = covered > 90 ? Math.round(covered) : 0;
      document.documentElement.style.setProperty('--kbd', kbd + 'px');
    }

    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    sync();
  }

  /* ----------------------------------------------------------------- radio
   * The map's button, playing the map's station, because it is the same
   * radio: assets/radio.js holds the station and the on/off across the walk
   * from the map to a list, so the music does not stop halfway. It draws the
   * button and wires the press itself; all this page owns is the one thing it
   * cannot say — a stream that would not start, in the visitor's language.
   *
   * There is no language switch on this page, so unlike the map there is
   * nothing to tell it about afterwards.
   */
  function mountRadio() {
    window.TTBRadio.mount({
      button: dom.btnRadio,
      name: dom.radioName,
      lang: state.lang,
      t: t,
      onchange: function (what) {
        if (what === 'fail') toast(t('radioFail'));
      }
    });
  }

  /* ------------------------------------------------------------------ wire */

  function wire() {
    wireKeyboard();
    dom.pickerClose.addEventListener('click', closePicker);
    dom.pickerScrim.addEventListener('click', function (ev) {
      if (ev.target === dom.pickerScrim) closePicker();
    });
    dom.pickerSearch.addEventListener('input', function () {
      dom.pickerClear.hidden = !dom.pickerSearch.value;
      paintPicker();
    });
    dom.pickerClear.addEventListener('click', function () {
      dom.pickerSearch.value = '';
      dom.pickerClear.hidden = true;
      dom.pickerSearch.focus();
      paintPicker();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !dom.pickerScrim.hidden) closePicker();
    });

    /* The last moment a script is promised on a phone: the tab is switched
       away, the screen is locked, the browser is put in the background.
       Saving is the button's job and this is not a second Save button — it is
       the one case where not sending loses the work outright, so the queue
       goes out over sendBeacon rather than down with the page. Somebody who
       meant to abandon an edit closes the tab and finds it kept; somebody who
       meant to keep it and forgot to press Save finds it kept too, and only
       one of those two is a story anybody minds. */
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flushAll(true);
    });
    window.addEventListener('pagehide', function () { flushAll(true); });
  }

  /* ------------------------------------------------------------------ boot */

  /* Which list this is. /list/<id> is the address people share, and the
     Function that serves it also seeds the list into the page — so the common
     case draws with no request at all. ?list= is the same thing without the
     pretty path, kept so the page still works if the Function is not
     deployed. */
  /* Whether this is the directory. /lists is the address it is linked and
     indexed at, served by functions/lists/index.js — which is also what seeds
     it, so a page carrying the seed is the directory whatever the path says.
     ?all= is the spelling that works on a deployment with no Functions at all,
     where lists.html is the only address there is.

     /lists/kept and /lists/public were this page's addresses before it, and
     both are 301s to /lists now. They are matched here anyway: the redirects
     are Functions, and on a static deployment — where ?all= is what this
     clause exists for — there is nothing to answer them.

     /lists.html is deliberately not one of these. Pages serves lists.html at
     both spellings, but only the bare one is the directory: the one with the
     extension is the old index of your own lists and goes to /account.html,
     which is the branch at the foot of boot(). */
  function wantedAll() {
    if (window.__TTB_ALL) return true;
    if (/^\/lists(\/(public|kept))?\/?$/.test(window.location.pathname)) return true;
    return new URLSearchParams(window.location.search).has('all');
  }

  /* And what it is being searched for. Seeded by the Function when the address
     carried one, so a search anybody sent draws its own answer rather than
     drawing everything and replacing it a moment later; read off the address
     otherwise, which is what a static deployment and a reload of a search both
     come down. */
  function wantedQuery() {
    var seeded = window.__TTB_ALL;
    if (seeded && typeof seeded.q === 'string') return seeded.q;
    return new URLSearchParams(window.location.search).get('q') || '';
  }

  /* And in which order. Seeded the same way, read off the address otherwise,
     and anything that is not one of the three is the default — the same rule
     sortOf() applies on the server, so the chips and the rows agree. */
  function wantedSort() {
    var seeded = window.__TTB_ALL;
    var s = seeded && typeof seeded.sort === 'string'
      ? seeded.sort
      : new URLSearchParams(window.location.search).get('sort') || '';
    return SORTS.indexOf(s) === -1 ? 'views' : s;
  }

  function wantedList() {
    var seeded = window.__TTB_LIST;
    if (seeded && seeded.id) return seeded.id;
    var m = /^\/list\/([a-z0-9][a-z0-9-]{2,47})\/?$/.exec(window.location.pathname);
    if (m) return m[1];
    return new URLSearchParams(window.location.search).get('list') || '';
  }

  /* And whose profile, the same way. There is no query-string spelling of
     this one: /u/<name> is served by a Function, and a page that reached this
     script at that address is a page that Function answered. */
  function wantedWho() {
    var seeded = window.__TTB_PROFILE;
    if (seeded && seeded.profile && seeded.profile.name) return seeded.profile.name;
    var m = /^\/u\/([a-zA-Z0-9][a-zA-Z0-9-]{2,23})\/?$/.exec(window.location.pathname);
    return m ? m[1].toLowerCase() : '';
  }

  function boot() {
    dom = {
      main: $('main'),
      /* Everything on the directory below its head: the rows, Show more, and
         the note where there are none. Claimed by renderAll() rather than
         found by id, because it is built with the view and not in
         lists.html. */
      allBody: null,
      /* The list of rows inside it, which the next page is appended to. */
      allList: null,
      /* And the rows of one list, under its own field. Claimed by renderOne()
         for the same reason, and null on every other view. */
      found: null,
      who: $('lists-who'),
      btnRadio: $('btn-radio'),
      radioName: $('radio-name'),
      toast: $('toast'),
      live: $('lists-live'),
      pickerScrim: $('picker-scrim'),
      picker: $('picker'),
      pickerClose: $('picker-close'),
      pickerSearch: $('picker-search'),
      pickerClear: $('picker-clear'),
      pickerBody: $('picker-body')
    };

    /* First, before anything is drawn: the style the map was left on. */
    applyStyle();

    /* Three addresses, asked in the order they are specific: the directory is
       one fixed path, a person is another, and a list is what is left. No two
       of them can be the address at once.

       And if it is none of them, this is /lists.html itself — the index of
       your own lists, which is on /account.html now, along with the box that
       makes one and the places you saved. Replaced rather than pushed, so the
       back button goes wherever somebody came from instead of to a page that
       would only send them here again; and before a single fetch is made, so
       there is nothing to flash. The query string goes with it because ?lang=
       and ?style= are read the same way on the page it lands on. */
    var all = wantedAll();
    var who = all ? '' : wantedWho();
    var id = all || who ? '' : wantedList();
    if (!all && !who && !id) {
      window.location.replace('/account.html' + window.location.search);
      return;
    }
    state.view = all ? 'all' : who ? 'who' : 'one';
    if (all) { state.q = wantedQuery(); state.sort = wantedSort(); }

    /* The strings and the data at once. The strings are a static file behind a
       revalidating cache and usually free; the data is the one request this
       page cannot start without. */
    var strings = getJSON('/data/ui.json');
    /* And the type names, which are four kilobytes next to the strings' hundred
       and fifty and come from the same cache. Only the rows carrying Google's
       description of a place use them — see sourceLine() — so a list that
       cannot fetch them draws those rows without their types rather than not
       at all. */
    var types = getJSON('/data/taxonomy.json').catch(function () { return null; });
    /* The answer the Function that served this page wrote into it, when there
       was one — a list at /list/<id>, the directory at /lists, a person at
       /u/<name> — and otherwise the request that asks for the same thing.
       Every address draws from the same shapes either way, so a deployment
       without the Functions is a page that loads a beat later and never a page
       that cannot load. */
    var seeded = window.__TTB_LIST && window.__TTB_LIST.list;
    var seededAll = window.__TTB_ALL && window.__TTB_ALL.all;
    var seededWho = window.__TTB_PROFILE && window.__TTB_PROFILE.profile;
    var data;
    if (state.view === 'all' && seededAll) {
      data = Promise.resolve({
        status: 200,
        out: {
          ready: true,
          user: window.__TTB_ALL.user || null,
          all: seededAll,
          next: window.__TTB_ALL.next || ''
        }
      });
    } else if (state.view === 'all') {
      data = ask(allUrl());
    } else if (seededWho) {
      data = Promise.resolve({
        status: 200,
        out: { ready: true, user: window.__TTB_PROFILE.user || null, profile: seededWho }
      });
    } else if (who) {
      data = ask(WHO_API + '?name=' + encodeURIComponent(who));
    } else if (seeded) {
      data = Promise.resolve({
        status: 200,
        out: { ready: true, user: window.__TTB_LIST.user || null, list: seeded }
      });
    } else {
      data = ask(API + '?id=' + encodeURIComponent(id));
    }

    Promise.all([strings, data, types]).then(function (loaded) {
      state.ui = loaded[0] || {};
      state.types = (loaded[2] && loaded[2].types) || [];
      state.lang = pickLanguage(Object.keys(state.ui).sort());
      applyStaticStrings();
      document.title = t('listsDocumentTitle');

      var answer = loaded[1];
      var out = answer.out;

      /* Nothing came back at all. Everything below would be a guess. */
      state.reached = answer.status !== 0;
      /* A 404 is an answer, and a specific one: the API is working and that
         list — or that name — is not there. Deleted, mistyped, or private and
         not yours. It leaves `ready` true so the page says that rather than
         something about the site being switched off. */
      state.ready = answer.status === 404 ? true : !!out.ready;
      state.me = out.user || null;
      state.list = out.list || null;
      state.all = out.all || null;
      state.next = out.next || '';
      state.profile = out.profile || null;

      /* A seeded page already carries its own title in the head; only a page
         that fetched what it is showing has to set one. */
      if (state.list) document.title = state.list.title + ' | Tallinn Tastebuds';
      if (state.profile) document.title = state.profile.name + ' | Tallinn Tastebuds';
      if (state.view === 'all') document.title = t('listsAllDocumentTitle');

      wire();
      mountRadio();
      render();

      /* And the open is counted, once the page is on the screen and out of the
         way of anything it could slow down. Somebody else's list only: see
         countOpen(). */
      if (state.view === 'one' && state.list && !state.list.mine) countOpen(state.list.id);
    }).catch(function (err) {
      if (window.console && console.error) console.error(err);
      dom.main.appendChild(el('div', { className: 'noscript card' }, [
        el('p', { className: 'eyebrow', textContent: 'Tallinn' }),
        el('h2', { textContent: 'Tallinn Tastebuds' }),
        el('p', {
          textContent: (state.ui.en && state.ui.en.loadError) ||
            'Something went wrong loading the data. Try refreshing the page.'
        })
      ]));
    });
  }

  boot();
}());
