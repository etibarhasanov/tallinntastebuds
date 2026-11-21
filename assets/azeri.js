/* Tallinn Tastebuds — /azeri, a corner about Azerbaijan, open to anybody.
 *
 * WHAT IT IS. A page for anybody, account or not, and seven tabs on it,
 * straight under the corner's name. Home says who the corner is for, what
 * is in each of the other six, and answers the questions people ask.
 * Azerbaijani films is the country's cinema: the 2,615 of the Azerbaijani
 * Wikipedia's list, which tools/azfilms.mjs collects and /api/azeri hands
 * out twenty at a time. Community, whose tab says Posts — Paylaşımlar — is
 * the corner's people writing to each other: posts, comments and upvotes,
 * out of /api/azeri/community. Estonia, Studying and Estonian are a guide
 * for somebody arriving here from there — what to sort out and in what
 * order, how to get into a university, and where to learn the language.
 * Azerbaijani places is where to eat it here, on a map. Nothing on it asks
 * anybody to sign in, Watch included, but to write a post: an account on
 * this site is for writing something.
 * **The Azerbaijani corner** in docs/handbook.md.
 *
 * FOUR LANGUAGES, NOT ELEVEN. The page's words are in data/ui.json in all
 * eleven, like every other page's, because the validator holds every key to
 * every language; the page reads four of them, Azerbaijani, English, Russian
 * and Estonian, which are the four the guide is written in. Which of the
 * four is kept under its own key, LANG_KEY, rather than in ttb.lang, so
 * choosing Azerbaijani here does not turn the map into Azerbaijani for
 * somebody who reads it in Russian.
 *
 * NO ENGLISH FIRST. The markup is written in English and this file turns it
 * into the reader's language once data/lang/<code>.json has come, and for a
 * moment on every load that was an English page turning Azerbaijani in
 * front of somebody. So the name beside the mark and the tabs are kept
 * unseen by assets/azeri.css until the boot at the bottom marks the body
 * ready, the shelf is not drawn before then either, and the first ask to
 * the route goes out beside the words, not after them.
 *
 * A TAB IS AN ADDRESS, AND NOT A LOAD. /azeri is the home, /azeri?tab=films
 * the films and /azeri?tab=estonia a tab of the guide, and the tabs are
 * links to those addresses. They were followed, once: every press loaded the
 * page again, so the name, the tabs and the switch went blank and came back
 * on each, since they wait for the words. Now a press on any link to the
 * corner — a tab, a line of the home, the link an answer ends in — is
 * caught, the address moves with pushState, and only what is under the tabs
 * is drawn again; Back and Forward walk the tabs through popstate, and a
 * press with a key held still opens the link in a new tab. Each is reported
 * to the site's count as a page view, as the load was. A topic that is
 * opened is written into the address beside its tab, &topic=housing, so the
 * address somebody copies opens what they were reading.
 *
 * THE HOME. The guide's shape, so it is drawn by the guide's code: the
 * route answers it as a tab, home.json beside the guide's three, with a
 * sentence saying who the corner is for and a line for each of the other
 * tabs besides. The lines are sentences under "Where to start", each with
 * its tab's name in it as the link, pressed as its tab is; the questions
 * are topics with no line under the name, and an answer is a sentence or
 * two and the one link into the tab that says the rest. functions/azeri.js writes the same words into
 * the page as text for the reader that runs no script — a search engine
 * among them — and this file empties #shelf before it draws, as it always
 * did.
 *
 * THE GUIDE. A tab is asked for whole, once, in the language the page is
 * read in — and again when that changes, since the answer carries one
 * language. Its topics are the films' rows with a chevron where Watch is,
 * and each opens under its row, one topic at a time. A topic is blocks —
 * paragraphs, lists, a table, facts, a ladder of levels, rows that lead to
 * the flashcards — drawn by BLOCKS, one function a kind. On the Estonian
 * tab, under the site's own flashcards, a topic that is somewhere to learn
 * says its levels on its row and ends in the one button that goes there.
 * From 900px the topics stand down the left and the opened one beside
 * them, so the first is open on arrival there — an empty half would be the
 * first thing seen. The layout is all in assets/azeri.css.
 *
 * A PAGE AT A TIME. The shelf is never fetched whole. It opens on the
 * feature films that can be watched, the most watched first, twenty to a page, and
 * Previous and Next under the list turn the pages; a chip, the switch or the
 * search starts again from the first. The switch is on to begin with, since
 * a film somebody can play is the reason to be here, and off is a press
 * away. Each page is one request to the route, which reads files and no
 * row of the database — the header of functions/api/azeri.js has the sums —
 * and the pages are buttons rather than a scroll that asks on its own.
 *
 * WHAT IS SHOWN, AND IN WHICH LANGUAGE. A title is the film's own, in
 * Azerbaijani, with the English one beside it where the studio gave one. The
 * summary is the wiki's opening, in Azerbaijani; in English it is the
 * English written for the feature films and the cartoons, said to be a
 * translation, and where there is none yet the Azerbaijani stands with a
 * line saying so. A link to watch is the list's or the studio's; a link the
 * article merely mentions is offered as "Maybe", because an article links an
 * interview or a premiere as readily as the film.
 *
 * THE ORDER. The most watched on the studio's YouTube channel first — the
 * tool that writes the films orders them, tools/azfilms.mjs — and after the
 * ones with a count, the newest. So there are no decades over the rows any
 * more: each row says its year, and a heading would repeat down the page.
 *
 * IT PLAYS HERE. Watch opens the film and plays it in the page, in YouTube's
 * own player from its no-cookie address, with a link under it to the same
 * video on YouTube for the film a studio does not let other sites play. One
 * film plays at a time, and closing its row stops it — the player is in the
 * row, so taking the row away is taking the sound away. A link that is not
 * YouTube's opens where it lives.
 *
 * THE PLACES. The tab is Azerbaijani places, at ?tab=food, the address it
 * had on the day it was made. A list of the site's, "Azerbaijani food in
 * Tallinn", drawn on a map by /embed in a frame — the map any other site
 * can put on its page, in the reader's language, with its own loading,
 * error and empty states, and a card with the list's sentence when a pin is
 * pressed. Which list is FOOD_LIST below, and the tab asks the route for
 * nothing: the list is edited on its own page and the map follows. Under
 * the frame, whose list it is and the way to the whole of it.
 *
 * COMMUNITY. Read by anybody and written by an account: signed out, the
 * posts and the comments are all there, and where a member would post,
 * comment or upvote there is the way to sign in instead. Posts newest
 * first, or this week's most upvoted first, twenty to a page with Previous
 * and Next under them, each page continued from the last one's cursor,
 * which the address carries; a post opens with its comments under it,
 * oldest first, fifty at a time with Show more, and the box to add one at
 * the foot. A comment may answer another, and says which; the author of
 * either may change it or delete it, and the site's owner may take down
 * anybody's. Everything anybody typed is drawn as text, its addresses made
 * links that are nofollow ugc. For a member, what came since the visit
 * before is marked — a dot on a post, the number of new comments on its
 * row, a wash on a comment — and while another tab is read, a dot on
 * Community's and the number before the browser's title say there is
 * something: askNews() asks the route once each time a tab is shown.
 * Nothing asks again while the page sits open; that would be reads all day
 * for a dot. **Community** under **The Azerbaijani corner**.
 *
 * WIDE, IT IS A WALL OF FILMS. Every film carries the picture YouTube
 * keeps for its video, or its year where there is no video. On a phone the
 * shelf is a list, a line or two a film with the picture a strip at its
 * left. From 900px it is a grid of cards, each under its picture, and the
 * film that is opened takes the whole row, its screen on the left at a
 * size worth watching and what the film is on the right. Opened, on either,
 * the picture stands where the player will and turns into it when pressed,
 * so opening a film never loses its picture. The pictures are lazy, so a
 * phone fetches the rows it scrolls to and no more. The layout is all in
 * assets/azeri.css; this file draws one set of nodes.
 */
(function () {
  'use strict';

  var API = '/api/azeri';
  var COMMUNITY = '/api/azeri/community';
  /* Community's caps, restated from functions/api/_community.js for the
     fields' maxlength and the counters under them. Change one, change the
     other. */
  var MAX_TITLE = 120;
  var MAX_BODY = 5000;
  var MAX_COMMENT = 2000;
  var LANGS_URL = '/data/lang/index.json';
  var LANG_URL = '/data/lang/';
  var LANGS = ['az', 'en', 'ru', 'et'];
  var TABS = ['home', 'films', 'community', 'estonia', 'study', 'estonian', 'food'];
  var SAY_KEYS = { estonia: 'azeriEstoniaSay', study: 'azeriStudySay' };
  /* The flashcards, at the address the map's own door to them has: this
     host's /flashcard, which answers wherever the site does. The button
     went to their subdomain for a day, the one link on the site that did,
     and did not open for the owner. They speak three languages: DECK_LANGS
     in functions/api/_lib.js. */
  var FLASHCARDS = '/flashcard';
  var FLASH_LANGS = ['az', 'en', 'ru'];
  /* "Azerbaijani food in Tallinn", by tallinntastebuds: the restaurants, the
     market and the two chains, each with a sentence. A list rather than a
     file here, so it is changed on the list's own page, signed in as its
     owner, and the tab follows without a deploy. */
  var FOOD_LIST = 'azerbaijani-food-in-tallinn-9srkxf';
  var WIDE = '(min-width: 900px)';
  var CHEVRON = '<svg viewBox="0 0 24 24" focusable="false"><path d="M9 5l7 7-7 7"/></svg>';
  var LANG_KEY = 'ttb.azeri.lang';
  var STYLE_KEY = 'ttb.style';
  var STYLES = ['red', 'green', 'blue', 'plum'];
  var DEFAULT_STYLE = 'red';
  var SHELVES = ['feature', 'animation', 'documentary', 'series', 'all'];
  var SHELF_KEYS = {
    feature: 'azeriShelfFeature', animation: 'azeriShelfAnimation',
    documentary: 'azeriShelfDocumentary', series: 'azeriShelfSeries', all: 'azeriShelfAll'
  };
  var KIND_KEYS = {
    feature: 'azeriKindFeature', animation: 'azeriKindAnimation', documentary: 'azeriKindDocumentary',
    series: 'azeriKindSeries', play: 'azeriKindPlay', anthology: 'azeriKindAnthology',
    newsreel: 'azeriKindNewsreel', docudrama: 'azeriKindDocudrama', musical: 'azeriKindMusical',
    concert: 'azeriKindConcert', other: 'azeriKindOther'
  };
  var WIKI = 'https://az.wikipedia.org/wiki/';
  var SEARCH_WAIT = 300;

  var state = {
    lang: 'az',
    ui: {},
    names: {},
    tab: 'home',     // which of TABS the address names
    guide: null,     // the home or a tab of the guide, as the route answered it
    topic: null,     // the id of the topic opened, if one is
    kind: 'feature',
    q: '',
    watch: true,
    ru: false,       // only the films with a version in Russian, and play that one
    films: [],
    page: 1,
    pages: 1,
    counts: null,
    open: null,      // the id of the film opened, if one is
    playing: null,   // the address of the video playing in the open film
    asking: 0,       // which ask is the latest, so an older answer is dropped
    loading: false,  // the first page of a new ask is on its way
    failed: false,   // the last ask did not come back
    news: 0,         // posts and comments new in Community, for the dot on its tab
    ready: false     // the words are in, or are not coming: nothing is drawn before
  };
  /* Community, under its tab: which view the address names, what the route
     answered for it, and what is being typed, which draw() puts back. */
  var cm = {
    view: 'feed',    // feed, post or write
    data: null,      // the route's answer: a page of posts, or a post and its comments
    user: null,      // who is signed in, as the route last said: nobody may read, a member may write
    sort: 'new',
    page: 1,         // which page of posts, for the pager to say
    draft: { id: null, title: '', body: '' },
    text: '',        // the comment being written
    reply: null,     // { n, author } of the comment it answers
    editing: null,   // the n of the comment of one's own being changed
    editText: '',
    error: null,     // the word the route last refused with
    busy: false,
    fromFeed: false  // the view was opened from the posts, which Back returns to
  };
  var searchTimer = null;

  /* ------------------------------------------------------------ plumbing */

  function storeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function storeSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* private mode */ }
  }

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

  function getJSON(url) {
    return fetch(url, { headers: { accept: 'application/json' } }).then(function (res) {
      if (!res.ok) throw new Error(url + ': ' + res.status);
      return res.json();
    });
  }

  function el(tag, props, kids) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === 'className') n.className = props[k];
      else if (k === 'text') n.textContent = props[k];
      else n.setAttribute(k, props[k]);
    });
    (kids || []).forEach(function (kid) {
      if (kid) n.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    });
    return n;
  }

  function track(name, params) {
    if (window.TTBTrack) window.TTBTrack.event(name, params);
  }

  /* ------------------------------------------------------- look and feel */

  /* The style the site is wearing, as every page reads it. */
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

  /* One of the page's four: the address, then this page's own choice, then
     Azerbaijani. Not the site's choice nor the browser's, as it was: the
     page is a corner about Azerbaijan and opens in its language, the
     owner's word on 2026-11-21, and the switch is one press from the
     other three for anybody who reads one of them instead. */
  function pickLanguage() {
    var fromUrl = new URLSearchParams(window.location.search).get('lang');
    if (LANGS.indexOf(fromUrl) !== -1) return fromUrl;
    var own = storeGet(LANG_KEY);
    if (LANGS.indexOf(own) !== -1) return own;
    return 'az';
  }

  /* The tab an address names — the page's own where none is given — and
     the home where it names none. */
  function pickTab(search) {
    var asked = new URLSearchParams(search === undefined ? window.location.search : search).get('tab');
    return TABS.indexOf(asked) !== -1 ? asked : 'home';
  }

  /* The tabs are links in the markup, which cannot know which of them it
     was served for: this says so on the one that is on. The row wraps on a
     phone rather than scrolling, so every tab is in sight and none needs
     bringing into view. */
  function markTab() {
    var tabs = document.querySelectorAll('.azeri-tab');
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute('data-tab') === state.tab;
      tabs[i].className = 'azeri-tab' + (on ? ' is-on' : '');
      if (on) tabs[i].setAttribute('aria-current', 'page');
      else tabs[i].removeAttribute('aria-current');
    }
  }

  /* A press on a link to the corner — a tab, a line of the home, the link
     an answer ends in — draws that tab under the tabs, and the address moves
     with it, rather than the link loading the page again: A TAB IS AN
     ADDRESS, AND NOT A LOAD, at the top. One listener on the document, since
     the rows and the answers are drawn after it is set. A press with a key
     held, or with another button, is the browser's — a new tab, a new
     window — and so is a link to anywhere else, the skip link's #main
     included. A tab pressed while it is on, with no topic in its address,
     is nothing to draw again; from further down the page the reader is
     taken back up to the tabs, where the new one starts. Community's own
     links — a post, a page, the form — are its own to draw, through
     cmGo(), and have been by the time the press reaches the document; its
     tab, pressed from a post or the form, is its posts. */
  function wireLinks() {
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest ? e.target.closest('a[href]') : null;
      if (!a || a.target || a.getAttribute('href').charAt(0) !== '/') return;
      if (a.origin !== window.location.origin || a.pathname.replace(/\.html$/, '') !== '/azeri') return;
      e.preventDefault();
      var tab = pickTab(a.search);
      if (tab === state.tab && !new URLSearchParams(a.search).get('topic')) {
        if (tab === 'community' && cm.view !== 'feed') cmGo(cmHref());
        return;
      }
      window.history.pushState(null, '', a.getAttribute('href'));
      showTab(tab);
      if (!a.classList.contains('azeri-tab')) window.scrollTo(0, 0);
    });
    /* Back to the same tab is the skip link's #main being walked off, and
       there is nothing to draw again. */
    window.addEventListener('popstate', function () {
      var tab = pickTab();
      if (tab !== state.tab) showTab(tab);
      else if (tab === 'community') askCommunity();
    });
  }

  /* The tab the address now names, drawn and asked for as the boot does,
     and counted as the page view the load used to be. The words of the
     page are said again for the skip link, which says where it leads. */
  function showTab(tab) {
    state.tab = tab;
    state.topic = null;
    cm.fromFeed = false;
    markTab();
    if (Object.keys(state.ui).length) applyStaticStrings();
    askShown();
    if (window.TTBTrack) window.TTBTrack.view(document.title);
  }

  function loadWords(lang) {
    return getJSON(LANG_URL + lang + '.json').then(function (pack) {
      state.lang = lang;
      state.ui = pack.ui;
    });
  }

  function applyStaticStrings() {
    document.documentElement.lang = state.lang;
    var each = function (attr, apply) {
      var nodes = document.querySelectorAll('[' + attr + ']');
      for (var i = 0; i < nodes.length; i++) apply(nodes[i], nodes[i].getAttribute(attr));
    };
    each('data-i18n', function (n, k) { n.textContent = t(k); });
    each('data-i18n-aria-label', function (n, k) { n.setAttribute('aria-label', t(k)); });
    /* The skip link is written for the topics, of the home and the guide;
       under the films it leads to the films, under the places to the map
       and under Community to the posts. */
    var skip = state.tab === 'films' ? 'azeriSkip' : state.tab === 'food' ? 'azeriSkipMap'
      : state.tab === 'community' ? 'azeriSkipPosts' : 'azeriSkipTopics';
    document.querySelector('.skip-link').textContent = t(skip);
    sayNews();
  }

  /* What is new in Community, on its tab and in the browser's: the dot, and
     the number before the title. */
  function sayNews() {
    markNews();
    if (Object.keys(state.ui).length) document.title = newsTitle() + t('azeriTitle') + ' | Tallinn Tastebuds';
  }

  function drawSwitch() {
    if (!window.TTBLanguage) return;
    var langs = LANGS.filter(function (code) { return state.names[code]; })
      .map(function (code) { return { code: code, name: state.names[code] }; });
    window.TTBLanguage.mount(document.getElementById('lang-switch'),
      langs, state.lang, switchLanguage, t('language'));
  }

  function switchLanguage(code) {
    if (code === state.lang) return;
    track('language_select', { language: code });
    storeSet(LANG_KEY, code);
    loadWords(code).then(function () {
      applyStaticStrings();
      drawSwitch();
      /* The films carry both of their languages, the places' map is asked
         for in the new one when it is drawn again, and Community is what
         people wrote, in whatever they wrote it in; the home and a tab of
         the guide were answered in one, so they are asked for again. */
      if (state.tab === 'films' || state.tab === 'food' || state.tab === 'community') draw();
      else askGuide();
    }).catch(function () { /* the page stays in the language it has */ });
  }

  /* ------------------------------------------------------------- asking */

  function query(page) {
    var p = new URLSearchParams();
    p.set('kind', state.kind);
    if (state.q) p.set('q', state.q);
    if (state.watch) p.set('watch', '1');
    if (state.ru) p.set('ru', '1');
    if (page > 1) p.set('page', String(page));
    return API + '?' + p.toString();
  }

  /* Ask the route, and hand what it answers to `took`, or set the failed
     state for anything that is not an answer — but a 404 where `missing`
     says the answer to one is a page of its own, a post that is not there.
     An answer to an older ask that arrives after a newer one is dropped,
     so typing fast never leaves the shelf showing what the last-but-one
     word found. */
  function send(url, took, missing) {
    var mine = ++state.asking;
    state.loading = true;
    draw();
    fetch(url, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
      .then(function (res) {
        return res.json().then(function (out) { return { status: res.status, out: out }; });
      })
      .then(function (answer) {
        if (mine !== state.asking) return;
        state.loading = false;
        if (answer.status !== 200 && !(missing && answer.status === 404)) throw new Error(String(answer.status));
        state.failed = false;
        took(answer.out);
        draw();
      })
      .catch(function () {
        if (mine !== state.asking) return;
        state.loading = false;
        state.failed = true;
        draw();
      });
  }

  /* A page of the shelf: the first, from a chip, the switch or the search,
     or another, from the pager. */
  function ask(page) {
    state.films = [];
    state.open = null;
    state.playing = null;
    send(query(page), function (out) {
      state.films = out.films;
      state.page = out.page;
      state.pages = out.pages;
      state.counts = out.counts;
    });
  }

  /* The home or a tab of the guide, whole, in the language the page is
     read in. */
  function askGuide() {
    state.guide = null;
    send(API + '?tab=' + state.tab + '&lang=' + state.lang, function (out) {
      state.guide = out;
      state.topic = firstTopic(out.topics);
    });
  }

  /* What is under the tabs, asked for: a page of the films, Community, or
     the home or a tab of the guide, and on every tab but Community what is
     new there. The places ask the route for nothing and are drawn at once,
     and an answer to the tab before that is still on its way is let go, as
     a newer ask would let it go — or it would draw the map a second time. */
  function askShown() {
    if (state.tab !== 'community') askNews();
    if (state.tab === 'films') ask(1);
    else if (state.tab === 'community') askCommunity();
    else if (state.tab !== 'food') askGuide();
    else {
      state.asking++;
      state.loading = false;
      draw();
    }
  }

  /* The topic open on arrival: the one the address names, and on a wide
     screen the first where it names none, since there the opened topic
     stands beside the list and an empty half would be the first thing
     seen. */
  function firstTopic(topics) {
    var asked = new URLSearchParams(window.location.search).get('topic');
    for (var i = 0; i < topics.length; i++) {
      if (topics[i].id === asked) return asked;
    }
    return topics.length && isWide() ? topics[0].id : null;
  }

  function isWide() {
    return !!window.matchMedia && window.matchMedia(WIDE).matches;
  }

  /* Previous, where the page is, and Next. A turn takes the reader back to
     the top of the list, where the new page starts. */
  function pager() {
    var bar = el('nav', { className: 'azeri-pager', 'aria-label': t('azeriPageOf', { n: state.page, total: state.pages }) });
    var turn = function (to) {
      track('azeri_page', { page: to });
      ask(to);
      var head = document.querySelector('.azeri-tools');
      if (head) head.scrollIntoView({ block: 'start' });
    };
    var prev = el('button', { type: 'button', className: 'link-btn', text: '‹ ' + t('azeriPrev') });
    prev.disabled = state.page <= 1;
    prev.addEventListener('click', function () { turn(state.page - 1); });
    var next = el('button', { type: 'button', className: 'link-btn', text: t('azeriNext') + ' ›' });
    next.disabled = state.page >= state.pages;
    next.addEventListener('click', function () { turn(state.page + 1); });
    bar.appendChild(prev);
    bar.appendChild(el('span', { className: 'azeri-where', text: t('azeriPageOf', { n: state.page, total: state.pages }) }));
    bar.appendChild(next);
    return bar;
  }

  /* ------------------------------------------------------------- drawing */

  /* Everything under the tabs, drawn again from the state — but on the
     films the box of search, chips and switches is kept, and tools()
     redraws what is in it. */
  function draw() {
    if (!state.ready) return;
    var host = document.getElementById('shelf');
    var kept = state.tab === 'films' ? host.querySelector('.azeri-tools') : null;
    while (host.lastChild && host.lastChild !== kept) host.removeChild(host.lastChild);
    if (state.tab === 'community') { drawCommunity(host); return; }
    if (state.tab === 'food') { drawFood(host); return; }
    if (state.tab !== 'films') { drawGuide(host); return; }
    if (kept) tools(kept);
    else host.appendChild(tools(null));
    var list = el('div', { className: 'azeri-list card' });
    if (state.loading) {
      list.appendChild(skeleton());
    } else if (state.failed && !state.films.length) {
      list.appendChild(el('p', { className: 'azeri-note', role: 'status', text: t('azeriError') }));
    } else if (!state.films.length) {
      list.appendChild(el('p', { className: 'azeri-note', role: 'status', text: t('azeriEmpty') }));
    } else {
      rows(list);
    }
    host.appendChild(list);
    if (state.pages > 1 && !state.loading) host.appendChild(pager());
    host.appendChild(el('p', { className: 'azeri-credit' }, [
      el('a', { href: WIKI + encodeURIComponent('Azərbaycan_filmlərinin_siyahısı'), rel: 'noopener', target: '_blank', text: t('azeriCredit') })
    ]));
  }

  /* The search, the chips and the switches over the films. The box and the
     search in it are made once a visit to the tab and kept by draw(), and
     only the chips and the switches after the search are drawn again, for
     their counts. The search was drawn again too, until 2026-11-21, with
     the caret put back after: the field under somebody's fingers was a new
     one twice a search, so the answer coming took the focus to the page —
     the next letters went nowhere and a phone's keyboard closed after the
     first — and a letter typed while it was on its way was wiped. */
  function tools(box) {
    var search;
    if (box) {
      search = box.querySelector('.azeri-search');
      while (box.lastChild !== search) box.removeChild(box.lastChild);
    } else {
      box = el('div', { className: 'azeri-tools' });
      search = el('input', {
        type: 'search',
        className: 'lists-input azeri-search',
        maxlength: '80',
        autocomplete: 'off',
        spellcheck: 'false'
      });
      search.value = state.q;
      search.addEventListener('input', function () {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          var q = search.value.trim();
          if (q === state.q) return;
          state.q = q;
          /* Left for another tab inside the wait: kept for coming back,
             and not asked, or its answer would take that tab's place. */
          if (state.tab === 'films') ask(1);
        }, SEARCH_WAIT);
      });
      box.appendChild(search);
    }
    /* The words again on every draw, for a language switched under it. */
    search.placeholder = t('azeriSearch');
    search.setAttribute('aria-label', t('azeriSearch'));

    var chips = el('div', { className: 'azeri-chips', role: 'group', 'aria-label': t('azeriFilms') });
    SHELVES.forEach(function (kind) {
      var n = state.counts ? state.counts[kind] : null;
      var chip = el('button', {
        type: 'button',
        className: 'azeri-chip' + (kind === state.kind ? ' is-on' : ''),
        'aria-pressed': String(kind === state.kind)
      }, [t(SHELF_KEYS[kind]), n != null ? el('small', { text: String(n) }) : null]);
      chip.addEventListener('click', function () {
        if (kind === state.kind) return;
        state.kind = kind;
        track('azeri_shelf', { shelf: kind });
        ask(1);
      });
      chips.appendChild(chip);
    });
    box.appendChild(chips);

    /* Two switches: the films that can be watched, on to begin with, and
       the ones with a version in Russian, which is also which version Watch
       then plays. */
    var toggles = el('div', { className: 'azeri-toggles' });
    [['watch', 'azeriWatchable', 'azeri_watchable'], ['ru', 'azeriRussianOnly', 'azeri_russian']].forEach(function (sw) {
      var toggle = el('label', { className: 'azeri-toggle' });
      var check = el('input', { type: 'checkbox', className: 'azeri-switch' });
      check.checked = state[sw[0]];
      check.addEventListener('change', function () {
        state[sw[0]] = check.checked;
        track(sw[2], { on: check.checked ? 1 : 0 });
        ask(1);
      });
      toggle.appendChild(el('span', { text: t(sw[1]) }));
      toggle.appendChild(check);
      toggles.appendChild(toggle);
    });
    box.appendChild(toggles);
    return box;
  }

  function skeleton() {
    var box = el('div', { className: 'azeri-skeleton', 'aria-hidden': 'true' });
    for (var i = 0; i < 4; i++) {
      box.appendChild(el('div', { className: 'azeri-bone' }));
      box.appendChild(el('div', { className: 'azeri-bone is-short' }));
    }
    return box;
  }

  function rows(list) {
    state.films.forEach(function (film) { list.appendChild(row(film)); });
  }

  function years(film) {
    if (!film.year) return '';
    return film.yearTo && film.yearTo !== film.year ? film.year + '–' + film.yearTo : String(film.year);
  }

  function kindLine(film) {
    var kind = t(KIND_KEYS[film.kind] || 'azeriKindOther');
    return film.length === 'short' ? kind + ', ' + t('azeriShort') : kind;
  }

  /* What the button on a row plays, and what it is called: the film where
     there is one — the list's link, else the studio's, the Azerbaijani
     version first, which is the order the tool leaves them in, and the
     Russian one while the films in Russian are what was asked for — else
     its trailer, else a link the article only mentions. */
  function mainLink(film) {
    var trailer = null;
    var i;
    if (state.ru) {
      for (i = 0; i < film.watch.length; i++) {
        if (film.watch[i].kind === 'film' && film.watch[i].lang === 'ru') {
          return { link: film.watch[i], key: 'azeriWatch', lead: false };
        }
      }
    }
    for (i = 0; i < film.watch.length; i++) {
      if (film.watch[i].kind === 'film') return { link: film.watch[i], key: 'azeriWatch', lead: false };
      if (film.watch[i].kind === 'trailer' && !trailer) trailer = film.watch[i];
    }
    if (trailer) return { link: trailer, key: 'azeriTrailer', lead: true };
    if (film.video.length) return { link: film.video[0], key: 'azeriMaybe', lead: true };
    return null;
  }

  /* The eleven characters YouTube knows a video by, or nothing for a link
     that lives somewhere else. */
  function youtubeId(url) {
    var m = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/.exec(url);
    return m ? m[1] : '';
  }

  /* Open the film and play this link in it. */
  function play(film, link, lead) {
    track('azeri_watch', { film: film.id, lead: lead ? 1 : 0 });
    state.open = film.id;
    state.playing = link.url;
    draw();
    var again = document.getElementById('film-' + film.id);
    if (again) again.scrollIntoView({ block: 'nearest' });
  }

  /* A film's picture: YouTube's own for the video the button plays,
     pressed to play it, or the film's year where there is nothing to play.
     Over a card on a wide screen, a strip at the row's left on a phone, and
     in an opened film the screen its player will be — assets/azeri.css.
     Lazy, so a phone fetches only the rows scrolled to. */
  function thumb(film, main) {
    var id = main ? youtubeId(main.link.url) : '';
    if (!id) return el('span', { className: 'azeri-thumb is-empty', 'aria-hidden': 'true', text: years(film) || '·' });
    var b = el('button', { type: 'button', className: 'azeri-thumb', 'aria-label': t(main.key) + ': ' + film.title }, [
      el('img', { src: 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg', alt: '', loading: 'lazy', width: '320', height: '180' })
    ]);
    b.addEventListener('click', function () { play(film, main.link, main.lead); });
    return b;
  }

  function row(film) {
    var isOpen = state.open === film.id;
    var meta = [years(film), film.director.length ? film.director[0] : kindLine(film)]
      .filter(Boolean).join(' · ');
    var head = el('button', {
      type: 'button',
      className: 'azeri-row',
      'aria-expanded': String(isOpen)
    }, [
      el('span', { className: 'azeri-name' }, [
        film.title,
        (state.ru || state.lang === 'ru') && film.titleRu ? el('span', { className: 'azeri-en', lang: 'ru', text: film.titleRu })
          : state.lang !== 'az' && film.titleEn ? el('span', { className: 'azeri-en', lang: 'en', text: film.titleEn }) : null
      ]),
      el('span', { className: 'azeri-meta', text: meta })
    ]);
    head.addEventListener('click', function () {
      state.open = isOpen ? null : film.id;
      state.playing = null;
      if (!isOpen) track('azeri_film', { film: film.id });
      draw();
      var again = document.getElementById('film-' + film.id);
      if (again) again.querySelector('.azeri-row').focus();
    });

    var main = mainLink(film);
    var wrap = el('div', { className: 'azeri-film' + (isOpen ? ' is-open' : ''), id: 'film-' + film.id },
      [thumb(film, main), head]);
    if (main) wrap.appendChild(watchButton(film, main.link, main.key, main.lead));
    if (isOpen) wrap.appendChild(detail(film, main));
    return wrap;
  }

  /* Watch, Trailer or Maybe: a button that plays it here where the link is
     YouTube's, and a link out where it is anybody else's. */
  function watchButton(film, link, key, lead) {
    var cls = 'azeri-play' + (lead ? ' is-lead' : '');
    if (!youtubeId(link.url)) {
      var a = el('a', { className: cls, href: link.url, target: '_blank', rel: 'noopener', text: '▶ ' + t(key) });
      a.addEventListener('click', function () { track('azeri_watch', { film: film.id, lead: lead ? 1 : 0 }); });
      return a;
    }
    var b = el('button', { type: 'button', className: cls, text: '▶ ' + t(key) });
    b.addEventListener('click', function () { play(film, link, lead); });
    return b;
  }

  function linkLabel(w) {
    var label = w.kind === 'trailer' ? t('azeriTrailer') : w.kind === 'fragment' ? t('azeriFragment') : t('azeriWatch');
    if (w.part) label += ' — ' + w.part;
    if (w.lang === 'ru') label += ' (' + t('azeriRussian') + ')';
    if (w.lang === 'en') label += ' (' + t('azeriEnglish') + ')';
    return label;
  }

  /* YouTube's player on the video that is playing, and under it the way to
     the same video on YouTube. Autoplay, because the press that drew this
     was a press on Watch. */
  function player(film) {
    var id = youtubeId(state.playing);
    var frame = el('iframe', {
      className: 'azeri-frame',
      src: 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0',
      title: film.title,
      allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
      allowfullscreen: '',
      referrerpolicy: 'strict-origin-when-cross-origin'
    });
    var out = el('a', {
      className: 'azeri-out',
      href: 'https://www.youtube.com/watch?v=' + id,
      target: '_blank',
      rel: 'noopener',
      text: t('azeriOnYoutube')
    });
    out.addEventListener('click', function () { track('azeri_youtube', { film: film.id }); });
    return el('div', { className: 'azeri-player' }, [el('div', { className: 'azeri-screen' }, [frame]), out]);
  }

  /* One of a film's links, in the row of them: a button that plays it here
     where it is YouTube's, lit while it is the one playing. */
  function linkButton(film, link, label, lead) {
    if (!youtubeId(link.url)) {
      return el('a', { href: link.url, target: '_blank', rel: 'noopener', text: '▶ ' + label });
    }
    var b = el('button', {
      type: 'button',
      className: 'azeri-link' + (state.playing === link.url ? ' is-on' : ''),
      text: '▶ ' + label
    });
    b.addEventListener('click', function () { play(film, link, lead); });
    return b;
  }

  /* An opened film opens on its screen: the player while something plays,
     and before that the picture, which turns into the player where it
     stands when pressed — above the words on a phone, beside them wide. A
     film with nothing on YouTube has no picture to show, and is its words. */
  function detail(film, main) {
    var screen = state.playing && youtubeId(state.playing) ? player(film)
      : main && youtubeId(main.link.url) ? thumb(film, main)
      : null;
    var box = el('div', { className: 'azeri-detail' + (screen ? ' has-screen' : '') });
    if (screen) box.appendChild(screen);

    /* The row says the year and the director where there is one, and the kind
       where there is not; open, the kind is said if the row did not. */
    if (film.director.length) box.appendChild(el('p', { className: 'azeri-kind', text: kindLine(film) }));

    /* A summary is written in two languages, the wiki's Azerbaijani and the
       English made from it. Somebody reading the page in Russian or Estonian
       gets the English, as nearer to them than the Azerbaijani, under the
       same line saying which it is. */
    var foreign = state.lang !== 'az';
    var english = foreign && film.aboutEn;
    var about = english ? film.aboutEn : film.about;
    if (about) {
      box.appendChild(el('p', { lang: english ? 'en' : 'az', text: about }));
      if (foreign) {
        box.appendChild(el('p', { className: 'azeri-aside', text: t(english ? 'azeriTranslated' : 'azeriInAzerbaijani') }));
      }
    }

    var people = [['azeriDirector', film.director], ['azeriWriter', film.writer], ['azeriCast', film.cast]]
      .filter(function (p) { return p[1].length; });
    if (people.length) {
      var dl = el('dl', { className: 'azeri-people' });
      people.forEach(function (p) {
        dl.appendChild(el('dt', { text: t(p[0]) }));
        dl.appendChild(el('dd', { text: p[1].join(', ') }));
      });
      box.appendChild(dl);
    }

    var links = el('p', { className: 'azeri-links' });
    film.watch.forEach(function (w) { links.appendChild(linkButton(film, w, linkLabel(w), false)); });
    if (!film.watch.length) {
      film.video.forEach(function (v) { links.appendChild(linkButton(film, v, t('azeriMaybe'), true)); });
    }
    if (film.wiki) links.appendChild(el('a', { href: WIKI + encodeURIComponent(film.wiki.replace(/ /g, '_')), target: '_blank', rel: 'noopener', text: 'Wikipedia' }));
    if (film.imdb) links.appendChild(el('a', { href: 'https://www.imdb.com/title/' + film.imdb + '/', target: '_blank', rel: 'noopener', text: 'IMDb' }));
    if (links.firstChild) box.appendChild(links);
    return box;
  }

  /* ----------------------------------------------------------- the guide */

  /* A tab of the guide: the line saying what it is, the flashcards where
     the tab is Estonian, the topics — a list beside an article on a wide
     screen — and under them the line saying whose word is final. The home
     is drawn here too, once it has answered: a sentence leading to each of
     the other tabs, and the questions as its topics. Its sentence saying who
     the corner is for is the page's description in a search and not drawn:
     the owner took it off the page on 2026-11-21. */
  function drawGuide(host) {
    if (SAY_KEYS[state.tab]) host.appendChild(el('p', { className: 'lists-say', text: t(SAY_KEYS[state.tab]) }));
    if (state.tab === 'estonian') {
      host.appendChild(flashcards());
      host.appendChild(el('p', { className: 'eyebrow azeri-ways', text: t('azeriWays') }));
    }
    if (state.tab === 'home' && state.guide) {
      host.appendChild(el('p', { className: 'eyebrow azeri-ways', text: t('azeriStart') }));
      host.appendChild(sections(state.guide.sections));
      host.appendChild(el('p', { className: 'eyebrow azeri-ways', text: t('azeriQuestions') }));
    }
    var list = el('div', { className: 'azeri-list card is-guide' });
    if (state.loading) {
      list.appendChild(skeleton());
    } else if (!state.guide) {
      list.appendChild(el('p', { className: 'azeri-note', role: 'status', text: t('azeriGuideError') }));
    } else {
      state.guide.topics.forEach(function (topic) { list.appendChild(topicRow(topic)); });
    }
    host.appendChild(list);
    if (state.guide) host.appendChild(el('p', { className: 'azeri-credit', text: t('azeriGuideCredit') }));
  }

  /* Where to start: a sentence for each of the other tabs, saying who it is
     for, with the tab's name in it as the link — {tab} in the file's line.
     It was a card of rows with a chevron each, until 2026-11-21: straight
     under the tabs it read as the same menu twice, and the owner asked for
     sentences instead. The name is read off the tab itself, so the two
     cannot say different things; a press on it is drawn by wireLinks() as a
     press on the tab is, and counted under the tab's own name. */
  function sections(list) {
    var lines = el('ul', { className: 'azeri-start' });
    list.forEach(function (section) {
      var tab = document.querySelector('.azeri-tab[data-tab="' + section.tab + '"]');
      if (!tab) return;
      var a = el('a', { href: tab.getAttribute('href'), text: tab.textContent });
      a.addEventListener('click', function () { track(tab.getAttribute('data-track')); });
      var parts = section.line.split('{tab}');
      lines.appendChild(el('li', null, [parts[0], a, parts[1]]));
    });
    return lines;
  }

  /* ---------------------------------------------------------- the places */

  /* The places tab, food at its address: what it is, the list on /embed's
     map in the language the page is read in, and under it whose list it is
     and the way to the whole of it. The frame has its own loading, error
     and empty states, so the tab has none. Which style the map wears it
     reads for itself, from the same storage on the same host. */
  function drawFood(host) {
    host.appendChild(el('p', { className: 'lists-say', text: t('azeriFoodSay') }));
    host.appendChild(el('div', { className: 'card azeri-map' }, [
      el('iframe', { src: '/embed?list=' + FOOD_LIST + '&lang=' + state.lang, title: t('azeriFoodMap') })
    ]));
    var all = el('a', { className: 'go', href: '/list/' + FOOD_LIST, text: t('azeriFoodOpen') });
    all.addEventListener('click', function () { track('azeri_list'); });
    host.appendChild(el('div', { className: 'azeri-map-foot' }, [
      el('span', { className: 'azeri-meta', text: t('azeriFoodBy') }),
      all
    ]));
  }

  /* An address in the flashcards, in the reader's language where it is one
     of the three they speak; any other address as it is. */
  function inFlashcards(url) {
    if (url.indexOf(FLASHCARDS) !== 0 || FLASH_LANGS.indexOf(state.lang) === -1) return url;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'lang=' + state.lang;
  }

  /* The site's own way to learn the language, and the card's one filled
     action. */
  function flashcards() {
    var go = el('a', { className: 'go', href: inFlashcards(FLASHCARDS), text: t('azeriFlashOpen') });
    go.addEventListener('click', function () { track('azeri_flashcards'); });
    return el('div', { className: 'card azeri-flash' }, [
      el('p', { className: 'eyebrow', text: t('azeriFlashEyebrow') }),
      el('h2', { text: t('azeriFlashTitle') }),
      el('p', { className: 'lists-say', text: t('azeriFlashSay') }),
      go
    ]);
  }

  /* A topic: a film's row with a chevron where Watch is, and the levels it
     covers before the chevron, where a menu row keeps its count. A question
     of the home is the name alone, with no line under it. */
  function topicRow(topic) {
    var go = el('span', { className: 'menu-go', 'aria-hidden': 'true' });
    go.innerHTML = CHEVRON;
    var isOpen = state.topic === topic.id;
    var head = el('button', { type: 'button', className: 'azeri-row has-go', 'aria-expanded': String(isOpen) }, [
      el('span', { className: 'azeri-words' }, [
        el('span', { className: 'azeri-name', text: topic.name }),
        topic.covers ? el('span', { className: 'azeri-meta', text: topic.covers }) : null
      ]),
      topic.level ? el('span', { className: 'azeri-level', text: topic.level }) : null,
      go
    ]);
    head.addEventListener('click', function () { openTopic(topic.id); });
    var wrap = el('div', { className: 'azeri-film azeri-topic' + (isOpen ? ' is-open' : ''), id: 'topic-' + topic.id }, [head]);
    if (isOpen) wrap.appendChild(article(topic));
    return wrap;
  }

  /* Open a topic, or close the one that is open — except on a wide screen,
     where the opened one is the other half of the page and closing it would
     leave that half empty. The address follows, so it can be copied. */
  function openTopic(id) {
    if (state.topic === id && isWide()) return;
    state.topic = state.topic === id ? null : id;
    if (state.topic) track('azeri_topic', { tab: state.tab, topic: id });
    var p = new URLSearchParams(window.location.search);
    if (state.topic) p.set('topic', state.topic);
    else p.delete('topic');
    window.history.replaceState(null, '', window.location.pathname + '?' + p.toString());
    draw();
    var again = document.getElementById('topic-' + id);
    if (again) again.querySelector('.azeri-row').focus();
  }

  /* The month a tab was last read against its sources, 2026-11, as the
     reader's language says it. */
  function checkedMonth() {
    var parts = String(state.guide.checked).split('-');
    return t('monthYear', { month: t('months').split('|')[Number(parts[1]) - 1] || parts[1], year: parts[0] });
  }

  /* A link out of the guide, counted under the topic it was pressed in: to
     an office in a tab of its own, or — the link an answer of the home ends
     in — to an address on this site, where it is. */
  function outLink(text, url, topic) {
    var a = el('a', url.charAt(0) === '/' ? { href: url, text: text } : { href: url, target: '_blank', rel: 'noopener', text: text });
    a.addEventListener('click', function () { track('azeri_source', { topic: topic.id }); });
    return a;
  }

  /* A list of the guide's, numbered or not: each item a lead in bold, or a
     link where it has an address, and its sentence. */
  function items(tag, list, topic) {
    var node = el(tag);
    list.forEach(function (it) {
      var lead = !it.b ? null : it.url ? outLink(it.b, it.url, topic) : el('b', { text: it.b });
      node.appendChild(el('li', {}, [lead, lead ? ' ' : null, it.t]));
    });
    return node;
  }

  /* One way to draw each kind of block a topic is made of — the kinds
     guideIn() in functions/api/azeri.js answers, and tools/validate.mjs
     holds the files to. */
  var BLOCKS = {
    p: function (text) { return el('p', { text: text }); },
    head: function (text) { return el('h3', { className: 'azeri-sub', text: text }); },
    steps: function (list, topic) { return items('ol', list, topic); },
    list: function (list, topic) { return items('ul', list, topic); },
    /* The flashcards' lesson table: Estonian first, what it means last. */
    table: function (tbl) {
      var row = function (cells, tag) {
        return el('tr', {}, cells.map(function (cell) { return el(tag, { text: cell }); }));
      };
      return el('table', { className: 'azeri-table' }, [
        el('thead', {}, [row(tbl.heads, 'th')]),
        el('tbody', {}, tbl.rows.map(function (cells) { return row(cells, 'td'); }))
      ]);
    },
    /* A label beside its fact, the way an opened film lists its people. */
    facts: function (list) {
      var dl = el('dl', { className: 'azeri-facts' });
      list.forEach(function (f) {
        dl.appendChild(el('dt', { text: f.k }));
        dl.appendChild(el('dd', { text: f.v }));
      });
      return dl;
    },
    /* The ladder: which course covers which level. A row is a name and a
       track of the levels, with a bar across the ones a course covers or a
       dot at each one an exam is held at; the level the state asks for is
       one column washed down the whole ladder, and its note stands under it.
       The number of levels is the file's, handed to the stylesheet. */
    ladder: function (l) {
      var at = function (level) { return l.levels.indexOf(level) + 1; };
      var track = function (kids) {
        return el('span', { className: 'azeri-track' },
          [el('span', { className: 'azeri-wash', style: 'grid-column: ' + at(l.mark) })].concat(kids));
      };
      var head = el('div', { className: 'azeri-rung is-head' }, [
        el('span'),
        track(l.levels.map(function (level) {
          return el('span', { className: 'azeri-step' + (level === l.mark ? ' is-mark' : ''), style: 'grid-column: ' + at(level), text: level });
        }))
      ]);
      var rungs = l.rows.map(function (r) {
        var marks = r.span
          ? [el('span', { className: 'azeri-bar', style: 'grid-column: ' + at(r.span[0]) + ' / ' + (at(r.span[1]) + 1) })]
          : r.dots.map(function (level) { return el('span', { className: 'azeri-dot', style: 'grid-column: ' + at(level) }); });
        return el('div', { className: 'azeri-rung' }, [el('span', { className: 'azeri-rung-name', text: r.name }), track(marks)]);
      });
      var from = Math.max(1, at(l.mark) - 1);
      var to = Math.min(l.levels.length, at(l.mark) + 1) + 1;
      var note = el('div', { className: 'azeri-rung is-note' }, [
        el('span'),
        el('span', { className: 'azeri-track' }, [el('span', { style: 'grid-column: ' + from + ' / ' + to, text: l.note })])
      ]);
      return el('div', { className: 'azeri-ladder', style: '--levels: ' + l.levels.length }, [head].concat(rungs, [note]));
    },
    /* Rows that lead to the flashcards, the account menu's own: a name, the
       line under it, a chevron, and the width of the card to press. */
    rows: function (list, topic) {
      var menu = el('div', { className: 'menu azeri-menu' });
      list.forEach(function (r) {
        var go = el('span', { className: 'menu-go', 'aria-hidden': 'true' });
        go.innerHTML = CHEVRON;
        var a = el('a', { className: 'menu-row', href: inFlashcards(r.url) }, [
          el('span', { className: 'menu-say' }, [
            el('span', { className: 'menu-name', text: r.name }),
            el('span', { className: 'menu-why', text: r.why })
          ]),
          go
        ]);
        a.addEventListener('click', function () { track('azeri_source', { topic: topic.id }); });
        menu.appendChild(el('div', { className: 'menu-item' }, [a]));
      });
      return menu;
    }
  };

  /* An opened topic: when it was checked, its blocks, the one button to the
     place it is about where it is somewhere to learn, and the links to where
     the rule itself is written. Its name is drawn again as a heading for the
     wide screen, where the article stands beside the list rather than under
     its own row; a phone does not show it. A kind of block this script does
     not know is left out rather than drawn wrong. A question of the home is
     an answer instead: no month, and its one link straight under it, into
     the tab that says the rest, rather than under a heading of links out. */
  function article(topic) {
    var home = state.tab === 'home';
    var box = el('div', { className: 'azeri-detail azeri-article' }, [
      el('h2', { className: 'azeri-heading', text: topic.name }),
      home ? null : el('p', { className: 'azeri-kind', text: t('azeriChecked', { when: checkedMonth() }) })
    ]);
    topic.body.forEach(function (block) {
      var kind = Object.keys(block)[0];
      if (BLOCKS[kind]) box.appendChild(BLOCKS[kind](block[kind], topic));
    });
    if (topic.url) {
      var site = topic.url.replace(/^https:\/\/(www\.)?/, '').split('/')[0];
      var go = el('a', { className: 'go', href: topic.url, target: '_blank', rel: 'noopener', text: t('azeriGoTo', { site: site }) + ' ↗' });
      go.addEventListener('click', function () { track('azeri_way', { way: topic.id }); });
      box.appendChild(go);
    }
    if (topic.links.length) {
      var links = el('p', { className: 'azeri-links' });
      topic.links.forEach(function (l) { links.appendChild(outLink(home ? l.name + ' \u203a' : l.name, l.url, topic)); });
      box.appendChild(home ? links : el('div', { className: 'azeri-sources' }, [
        el('span', { className: 'azeri-kind', text: t('azeriSources') }),
        links
      ]));
    }
    return box;
  }

  /* ----------------------------------------------------------- community */

  /* Community is a tab like the others and three views under it, each an
     address: the posts, ?tab=community with &sort=top and a page's cursor;
     one post, &post=<id>; and the form, &write=1, or &post=<id>&edit=1 for
     one's own. A press on anything that leads between them moves the address
     with pushState, as the tabs do, and Back walks them — popstate in
     wireLinks() asks for the view the address names. What is being typed is
     kept in `cm` rather than in the field, since draw() builds the field
     again whenever anything else on the page changes. */

  /* An address under Community. */
  function cmHref(params) {
    var p = new URLSearchParams();
    p.set('tab', 'community');
    Object.keys(params || {}).forEach(function (k) {
      if (params[k] != null && params[k] !== '') p.set(k, String(params[k]));
    });
    return '/azeri?' + p.toString();
  }

  /* Go to an address under Community without loading the page. `replace`
     is for where the view left should not be come back to — the form a post
     was just sent from, a post just deleted. */
  function cmGo(href, replace) {
    cm.fromFeed = !replace && cm.view === 'feed';
    window.history[replace ? 'replaceState' : 'pushState'](null, '', href);
    askCommunity();
    window.scrollTo(0, 0);
  }

  /* A link that goes in the page, and opens a new tab when a key is held,
     as a tab does. */
  function inPage(a, before) {
    a.addEventListener('click', function (e) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      if (before) before();
      cmGo(a.getAttribute('href'));
    });
    return a;
  }

  /* Back to the posts: the very page they were on where they came from it,
     which the browser has, and the newest where they arrived from a link. */
  function cmBack() {
    var a = el('a', { className: 'azeri-cm-back', href: cmHref(), text: '‹ ' + t('azeriCommunity') });
    a.addEventListener('click', function (e) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      if (cm.fromFeed) window.history.back();
      else cmGo(cmHref());
    });
    return a;
  }

  /* What the address under Community names, asked for: the posts, a post,
     or the form — which asks only who is in for a new post, since somebody
     signed out is shown the way in rather than a form, and its own post for
     an edit. */
  function askCommunity() {
    var p = new URLSearchParams(window.location.search);
    cm.error = null;
    cm.reply = null;
    cm.editing = null;
    cm.busy = false;
    state.news = 0;
    if (p.get('write') === '1') {
      cm.view = 'write';
      cm.draft = { id: null, title: '', body: '' };
      cm.data = null;
      send(COMMUNITY + '?news=1', function (out) { cm.user = out.user; });
      return;
    }
    var id = p.get('post');
    cm.view = id && p.get('edit') !== '1' ? 'post' : id ? 'write' : 'feed';
    cm.data = null;
    if (id) {
      send(COMMUNITY + '?post=' + encodeURIComponent(id), function (out) {
        cm.data = out;
        cm.user = out.user;
        if (cm.view === 'write') {
          var post = out.post;
          if (!post || !post.mine || post.gone) { cm.view = 'post'; return; }
          cm.draft = { id: post.id, title: post.title, body: post.body };
        }
      }, true);
      return;
    }
    cm.sort = p.get('sort') === 'top' ? 'top' : 'new';
    cm.page = Math.max(1, parseInt(p.get('page'), 10) || 1);
    var q = new URLSearchParams();
    if (cm.sort === 'top') q.set('sort', 'top');
    if (p.get('after')) q.set('after', p.get('after'));
    if (p.get('before')) q.set('before', p.get('before'));
    send(COMMUNITY + (q.toString() ? '?' + q.toString() : ''), function (out) {
      cm.data = out;
      cm.user = out.user;
      if (!out.prev) cm.page = 1;
    });
  }

  /* A POST to the route, its answer to `took` and a refusal's word to
     `refused`. A session that has gone since the page was drawn is the page
     drawn again signed out, with the way to sign in where the press was. */
  function cmSend(body, took, refused) {
    fetch(COMMUNITY, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().then(function (out) { return { status: res.status, out: out }; });
    }).then(function (answer) {
      if (answer.status === 401) { cm.user = null; cm.busy = false; draw(); return; }
      if (answer.status !== 200) { refused(answer.out.error || 'failed'); return; }
      took(answer.out);
    }).catch(function () { refused('failed'); });
  }

  /* What a refusal says, above the field it was about. */
  var CM_ERRORS = {
    title: 'azeriComErrTitle', empty: 'azeriComErrEmpty', 'too-long': 'azeriComErrLong',
    often: 'azeriComErrOften', gone: 'azeriComErrGone'
  };

  function cmError(word) {
    return el('p', { className: 'azeri-cm-error', role: 'alert', text: t(CM_ERRORS[word] || 'azeriComErrFailed') });
  }

  /* Reading is anybody's and writing a member's. The way in is the map's own
     sign-in sheet, which brings somebody back to this very address — the
     post, or the form — once they are in. */
  function signInHref() {
    return '/?account=in&then=' + encodeURIComponent(window.location.pathname + window.location.search);
  }

  function signInButton(key) {
    return el('a', { className: 'go', href: signInHref(), 'data-track': 'account_open', text: t(key) });
  }

  /* Where a member would comment, or the form would be: a line saying who
     may write, and the way in. */
  function signInCard() {
    return el('div', { className: 'card azeri-cm-box' }, [
      el('p', { className: 'lists-say', text: t('azeriComSignInSay') }),
      signInButton('azeriComSignInGo')
    ]);
  }

  /* How long ago, in the reader's language: now, minutes, hours, days, and
     past a week the date. The words are the page's own rather than
     Intl.RelativeTimeFormat's, which in Chromium has no Azerbaijani and
     wrote "-1 min" under every post read in it. */
  function ago(ms) {
    var s = Math.max(0, (Date.now() - ms) / 1000);
    if (s < 60) return t('azeriComNow');
    if (s < 3600) return t('azeriComMinutes', { n: Math.floor(s / 60) });
    if (s < 86400) return t('azeriComHours', { n: Math.floor(s / 3600) });
    if (s < 7 * 86400) return t('azeriComDays', { n: Math.floor(s / 86400) });
    var when = new Date(ms);
    var opts = { day: 'numeric', month: 'short' };
    if (when.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    return when.toLocaleDateString(state.lang, opts);
  }

  /* Who wrote it: their profile where it is a link, and a deleted account
     where nobody holds the name any more. */
  function byline(name, linked) {
    if (!name) return el('span', { text: t('azeriComNobody') });
    if (!linked) return el('span', { text: name });
    return el('a', { href: '/u/' + encodeURIComponent(name), text: name });
  }

  function meta(kids) {
    var out = [];
    kids.filter(Boolean).forEach(function (kid, i) {
      if (i) out.push(' · ');
      out.push(kid);
    });
    return el('span', { className: 'azeri-cm-meta' }, out);
  }

  function newDot() {
    return el('span', { className: 'azeri-cm-dot', role: 'img', 'aria-label': t('azeriComNewMark') });
  }

  /* A text as it was typed: a paragraph to each run between empty lines,
     its line breaks kept, and an address in it a link off the site that the
     writer chose and the site did not — nofollow ugc. Built as text, so
     nothing anybody typed is ever markup. */
  var URL_IN = /(https?:\/\/[^\s<>"]+)/;
  function paragraphs(text) {
    return String(text).split(/\n{2,}/).map(function (para) {
      var p = el('p');
      para.split('\n').forEach(function (line, i) {
        if (i) p.appendChild(el('br'));
        line.split(URL_IN).forEach(function (bit, j) {
          if (!bit) return;
          if (j % 2 === 0) { p.appendChild(document.createTextNode(bit)); return; }
          var tail = /[.,;:!?)]+$/.exec(bit);
          var href = tail ? bit.slice(0, -tail[0].length) : bit;
          p.appendChild(el('a', { href: href, rel: 'nofollow ugc noopener', target: '_blank', text: href }));
          if (tail) p.appendChild(document.createTextNode(tail[0]));
        });
      });
      return p;
    });
  }

  var ARROW = '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M12 5l7 8h-4.5v6h-5v-6H5z"/></svg>';

  /* The upvote: the feedback page's heart with an arrow in its place, a
     number inside it once there is one. One's own, and every one to somebody
     signed out, is the number alone, not a press, and is not drawn at
     nought; a deleted thing has none. `n` is 0
     for the post. Pressed, it changes at once and is put back if the route
     refuses. */
  function upvote(item, postId, n) {
    if (item.gone) return null;
    var count = item.score ? el('span', { text: String(item.score) }) : null;
    if (item.mine || !cm.user) {
      if (!item.score) return null;
      var own = el('span', { className: 'azeri-up is-mine', title: t('azeriComUpvotes', { n: item.score }) }, [count]);
      own.insertAdjacentHTML('afterbegin', ARROW);
      return own;
    }
    var b = el('button', {
      type: 'button',
      className: 'azeri-up' + (item.voted ? ' is-on' : '') + (item.score ? ' has-n' : ''),
      'aria-pressed': String(!!item.voted),
      'aria-label': t('azeriComUpvote')
    }, [count]);
    b.insertAdjacentHTML('afterbegin', ARROW);
    b.addEventListener('click', function () {
      var was = { voted: item.voted, score: item.score };
      var swap = function () {
        var again = upvote(item, postId, n);
        if (b.parentNode) b.parentNode.replaceChild(again, b);
        b = again;
      };
      item.voted = !item.voted;
      item.score += item.voted ? 1 : -1;
      track('azeri_upvote', { on: item.voted ? 1 : 0 });
      swap();
      cmSend({ action: 'vote', post: postId, n: n, on: item.voted }, function (out) {
        item.score = out.score;
        swap();
      }, function () {
        item.voted = was.voted;
        item.score = was.score;
        swap();
      });
    });
    return b;
  }

  function commentsLine(post) {
    var said = post.comments === 0 ? t('azeriComNoComments')
      : post.comments === 1 ? t('azeriComOneComment') : t('azeriComComments', { n: post.comments });
    if (!post.freshComments) return el('span', { text: said });
    var n = post.freshComments >= 10 ? '9+' : String(post.freshComments);
    return el('span', {}, [said + ' · ', el('b', { className: 'azeri-cm-new', text: t('azeriComFresh', { n: n }) })]);
  }

  function drawCommunity(host) {
    var box = el('div', { className: 'azeri-cm' });
    host.appendChild(box);
    if (cm.view === 'write') drawWrite(box);
    else if (cm.view === 'post') drawPost(box);
    else drawFeed(box);
  }

  /* The posts: the order and the one filled action over them, a page of
     rows, and Previous and Next under them. */
  function drawFeed(box) {
    var data = cm.data;
    var order = el('nav', { className: 'azeri-cm-order', 'aria-label': t('azeriCommunity') });
    [['new', 'azeriComNew'], ['top', 'azeriComTop']].forEach(function (o) {
      var a = el('a', {
        className: o[0] === cm.sort ? 'is-on' : '',
        href: cmHref({ sort: o[0] === 'top' ? 'top' : null }),
        text: t(o[1])
      });
      if (o[0] === cm.sort) a.setAttribute('aria-current', 'page');
      order.appendChild(inPage(a, function () { track('azeri_sort', { sort: o[0] }); }));
    });
    var write = cm.user
      ? inPage(el('a', { className: 'go', href: cmHref({ write: 1 }), text: t('azeriComWrite') }),
        function () { track('azeri_write'); })
      : signInButton('azeriComSignIn');
    box.appendChild(el('div', { className: 'azeri-cm-bar' }, [order, write]));

    var list = el('div', { className: 'card azeri-cm-list' });
    if (state.loading) list.appendChild(skeleton());
    else if (state.failed || !data || !data.ready) list.appendChild(el('p', { className: 'azeri-note', role: 'status', text: t('azeriComError') }));
    else if (!data.posts.length) list.appendChild(el('p', { className: 'azeri-note', role: 'status', text: t(cm.sort === 'top' ? 'azeriComEmptyTop' : 'azeriComEmpty') }));
    else data.posts.forEach(function (post) { list.appendChild(postRow(post)); });
    box.appendChild(list);
    if (!state.loading && data && data.ready && (data.prev || data.next)) box.appendChild(cmPager(data));
  }

  /* A post's row: the whole of it but the upvote is the press that opens it. */
  function postRow(post) {
    var title = post.gone ? t('azeriComDeleted') : post.title;
    var a = inPage(el('a', { className: 'azeri-cm-row', href: cmHref({ post: post.id }) }, [
      meta([byline(post.author, false), ago(post.at)]),
      el('span', { className: 'azeri-cm-title' + (post.gone ? ' is-gone' : '') }, [post.fresh ? newDot() : null, title]),
      post.lead ? el('span', { className: 'azeri-cm-lead', text: post.lead }) : null
    ]), function () { track('azeri_post', { post: post.id }); });
    return el('div', { className: 'azeri-cm-post' }, [
      a,
      el('div', { className: 'azeri-cm-foot' }, [commentsLine(post), upvote(post, post.id, 0)])
    ]);
  }

  function cmPager(data) {
    var bar = el('nav', { className: 'azeri-pager', 'aria-label': t('azeriComPage', { n: cm.page }) });
    var turn = function (params, to) {
      return function () {
        track('azeri_page', { page: to });
        cmGo(cmHref(params));
      };
    };
    var sort = cm.sort === 'top' ? 'top' : null;
    var prev = el('button', { type: 'button', className: 'link-btn', text: '‹ ' + t('azeriPrev') });
    prev.disabled = !data.prev;
    prev.addEventListener('click', turn({ sort: sort, before: data.first, page: cm.page - 1 }, cm.page - 1));
    var next = el('button', { type: 'button', className: 'link-btn', text: t('azeriNext') + ' ›' });
    next.disabled = !data.next;
    next.addEventListener('click', turn({ sort: sort, after: data.next, page: cm.page + 1 }, cm.page + 1));
    bar.appendChild(prev);
    bar.appendChild(el('span', { className: 'azeri-where', text: t('azeriComPage', { n: cm.page }) }));
    bar.appendChild(next);
    return bar;
  }

  /* One post whole, its comments under it, and the box to add one. */
  function drawPost(box) {
    box.appendChild(cmBack());
    var data = cm.data;
    if (state.loading) { box.appendChild(el('div', { className: 'card azeri-cm-list' }, [skeleton()])); return; }
    if (data && data.error === 'not-found') {
      box.appendChild(el('div', { className: 'card azeri-cm-list' }, [el('p', { className: 'azeri-note', role: 'status', text: t('azeriComNotFound') })]));
      return;
    }
    if (state.failed || !data || !data.ready || !data.post) {
      box.appendChild(el('div', { className: 'card azeri-cm-list' }, [el('p', { className: 'azeri-note', role: 'status', text: t('azeriComError') })]));
      return;
    }
    var post = data.post;
    var article = el('article', { className: 'card azeri-cm-open' }, [
      meta([byline(post.author, true), ago(post.at), post.edited ? t('azeriComEdited') : null]),
      el('h2', { className: post.gone ? 'is-gone' : '', text: post.gone ? t('azeriComDeleted') : post.title })
    ]);
    if (post.body) paragraphs(post.body).forEach(function (p) { article.appendChild(p); });
    article.appendChild(el('div', { className: 'azeri-cm-foot' }, [postActions(post), upvote(post, post.id, 0)]));
    box.appendChild(article);

    if (post.comments) {
      box.appendChild(el('h3', { className: 'azeri-cm-count', text: post.comments === 1 ? t('azeriComOneComment') : t('azeriComComments', { n: post.comments }) }));
      var list = el('div', { className: 'card azeri-cm-list' });
      data.comments.forEach(function (c) { list.appendChild(commentRow(c, post)); });
      if (data.more) list.appendChild(moreButton(post));
      box.appendChild(list);
    }
    if (!post.gone) box.appendChild(cm.user ? composer(post) : signInCard());
  }

  /* Under the post: Edit and Delete for its author, Take down for the site's
     owner on anybody else's. */
  function postActions(post) {
    var row = el('span', { className: 'azeri-cm-acts' });
    if (post.gone) return row;
    if (post.mine) {
      row.appendChild(inPage(el('a', { className: 'alt', href: cmHref({ post: post.id, edit: 1 }), text: t('azeriComEdit') })));
    }
    if (post.mine || cm.data.mod) {
      var del = el('button', { type: 'button', className: 'alt is-danger', text: t(post.mine ? 'azeriComDelete' : 'azeriComTakeDown') });
      del.addEventListener('click', function () {
        if (!window.confirm(t(post.mine ? 'azeriComDeleteAsk' : 'azeriComTakeDownAsk'))) return;
        track(post.mine ? 'azeri_delete' : 'azeri_take_down', { what: 'post' });
        cmSend({ action: 'delete', id: post.id }, function () {
          cmGo(cmHref(), true);
        }, function (word) {
          window.alert(t(CM_ERRORS[word] || 'azeriComErrFailed'));
        });
      });
      row.appendChild(del);
    }
    return row;
  }

  /* A comment: who and when, what it answers, what it says — or the line
     where it was — and Reply, its author's Edit and Delete, the owner's Take
     down and the upvote under it. The ones written since the visit before
     are washed. */
  function commentRow(c, post) {
    var wrap = el('div', { className: 'azeri-cm-comment' + (c.fresh ? ' is-new' : ''), id: 'c' + c.n });
    if (c.gone) {
      wrap.className += ' is-gone';
      wrap.appendChild(el('p', { text: t(c.gone === 2 ? 'azeriComCommentDown' : 'azeriComCommentGone') }));
      return wrap;
    }
    wrap.appendChild(meta([byline(c.author, true), ago(c.at), c.edited ? t('azeriComEdited') : null,
      c.fresh ? el('b', { className: 'azeri-cm-new', text: t('azeriComNewMark') }) : null]));
    if (c.replyTo) wrap.appendChild(replyLine(c));
    if (cm.editing === c.n) {
      wrap.appendChild(editBox(c, post));
      return wrap;
    }
    paragraphs(c.body).forEach(function (p) { wrap.appendChild(p); });

    var acts = el('span', { className: 'azeri-cm-acts' });
    if (!post.gone && cm.user) {
      var reply = el('button', { type: 'button', className: 'alt', text: t('azeriComReply') });
      reply.addEventListener('click', function () {
        cm.reply = { n: c.n, author: c.author };
        track('azeri_reply');
        draw();
        var field = document.querySelector('.azeri-cm-box textarea');
        if (field) { field.focus(); field.scrollIntoView({ block: 'center' }); }
      });
      acts.appendChild(reply);
    }
    if (c.mine) {
      var edit = el('button', { type: 'button', className: 'alt', text: t('azeriComEdit') });
      edit.addEventListener('click', function () {
        cm.editing = c.n;
        cm.editText = c.body;
        cm.error = null;
        draw();
      });
      acts.appendChild(edit);
    }
    if (c.mine || cm.data.mod) {
      var del = el('button', { type: 'button', className: 'alt is-danger', text: t(c.mine ? 'azeriComDelete' : 'azeriComTakeDown') });
      del.addEventListener('click', function () {
        if (!window.confirm(t(c.mine ? 'azeriComDeleteCommentAsk' : 'azeriComTakeDownAsk'))) return;
        track(c.mine ? 'azeri_delete' : 'azeri_take_down', { what: 'comment' });
        cmSend({ action: 'uncomment', post: post.id, n: c.n }, function () {
          c.gone = c.mine ? 1 : 2;
          c.body = '';
          draw();
        }, function (word) {
          window.alert(t(CM_ERRORS[word] || 'azeriComErrFailed'));
        });
      });
      acts.appendChild(del);
    }
    wrap.appendChild(el('div', { className: 'azeri-cm-foot' }, [acts, upvote(c, post.id, c.n)]));
    return wrap;
  }

  /* "replying to aysel", the name a press that brings that comment into
     view; or a line saying it answered one that is gone. */
  function replyLine(c) {
    if (!c.replyAuthor) return el('p', { className: 'azeri-cm-to', text: '↳ ' + t('azeriComReplyingGone') });
    var parts = t('azeriComReplyingTo').split('{name}');
    var name = el('a', { href: '#c' + c.replyTo, text: c.replyAuthor });
    name.addEventListener('click', function (e) {
      e.preventDefault();
      var to = document.getElementById('c' + c.replyTo);
      if (to) to.scrollIntoView({ block: 'center' });
    });
    return el('p', { className: 'azeri-cm-to' }, ['↳ ' + parts[0], name, parts[1] || '']);
  }

  /* A comment of one's own, being changed where it stands. */
  function editBox(c, post) {
    var box = el('div', { className: 'azeri-cm-edit' });
    if (cm.error) box.appendChild(cmError(cm.error));
    var field = el('textarea', { className: 'lists-input', maxlength: String(MAX_COMMENT), rows: '4', 'aria-label': t('azeriComEdit') });
    field.value = cm.editText;
    field.addEventListener('input', function () { cm.editText = field.value; });
    var save = el('button', { type: 'button', className: 'go', text: t('azeriComSave') });
    var cancel = el('button', { type: 'button', className: 'alt', text: t('azeriComCancel') });
    save.addEventListener('click', function () {
      if (cm.busy) return;
      cm.busy = true;
      save.disabled = true;
      cmSend({ action: 'editcomment', post: post.id, n: c.n, body: cm.editText }, function () {
        track('azeri_edit', { what: 'comment' });
        c.body = cm.editText.trim();
        c.edited = true;
        cm.editing = null;
        cm.busy = false;
        cm.error = null;
        draw();
      }, function (word) {
        cm.busy = false;
        cm.error = word;
        draw();
      });
    });
    cancel.addEventListener('click', function () {
      cm.editing = null;
      cm.error = null;
      draw();
    });
    box.appendChild(field);
    box.appendChild(el('div', { className: 'azeri-cm-actions' }, [save, cancel]));
    return box;
  }

  /* The comments after the last one drawn, put under it. */
  function moreButton(post) {
    var b = el('button', { type: 'button', className: 'azeri-cm-more', text: t('azeriComMore', { n: cm.data.more }) });
    b.addEventListener('click', function () {
      var shown = cm.data.comments;
      var last = shown.length ? shown[shown.length - 1].n : 0;
      b.disabled = true;
      track('azeri_more');
      getJSON(COMMUNITY + '?post=' + encodeURIComponent(post.id) + '&after=' + last).then(function (out) {
        cm.data.comments = shown.concat(out.comments);
        cm.data.more = out.more;
        draw();
      }).catch(function () { b.disabled = false; });
    });
    return b;
  }

  /* The box to add a comment, with the comment it answers over it while
     Reply has been pressed, and what went wrong above the field. */
  function composer(post) {
    var box = el('div', { className: 'card azeri-cm-box' });
    if (cm.error && cm.editing === null) box.appendChild(cmError(cm.error));
    if (cm.reply) {
      var not = el('button', { type: 'button', className: 'alt', text: t('azeriComNotReply') });
      not.addEventListener('click', function () { cm.reply = null; draw(); });
      box.appendChild(el('div', { className: 'azeri-cm-replying' }, [
        el('span', { text: '↳ ' + (cm.reply.author ? t('azeriComReplyingTo', { name: cm.reply.author }) : t('azeriComReplyingGone')) }),
        not
      ]));
    }
    var field = el('textarea', {
      className: 'lists-input',
      maxlength: String(MAX_COMMENT),
      rows: '3',
      placeholder: t('azeriComSaySomething'),
      'aria-label': t('azeriComSaySomething')
    });
    field.value = cm.text;
    var counter = el('span', { className: 'azeri-cm-counter', text: t('feedbackCount', { n: cm.text.length, max: MAX_COMMENT }) });
    field.addEventListener('input', function () {
      cm.text = field.value;
      counter.textContent = t('feedbackCount', { n: cm.text.length, max: MAX_COMMENT });
    });
    var send = el('button', { type: 'button', className: 'go', text: t('azeriComComment') });
    send.addEventListener('click', function () {
      if (cm.busy) return;
      if (!cm.text.trim()) { cm.error = 'empty'; draw(); return; }
      cm.busy = true;
      send.disabled = true;
      cmSend({ action: 'comment', post: post.id, body: cm.text, replyTo: cm.reply ? cm.reply.n : null }, function (out) {
        var c = out.comment;
        if (c.replyTo && cm.reply) c.replyAuthor = cm.reply.author;
        track('azeri_comment', { reply: c.replyTo ? 1 : 0 });
        post.comments = c.n;
        if (cm.data.more) cm.data.more += 1;
        else cm.data.comments.push(c);
        cm.text = '';
        cm.reply = null;
        cm.error = null;
        cm.busy = false;
        draw();
        var made = document.getElementById('c' + c.n);
        if (made) made.scrollIntoView({ block: 'center' });
      }, function (word) {
        cm.busy = false;
        cm.error = word;
        draw();
      });
    });
    box.appendChild(field);
    box.appendChild(el('div', { className: 'azeri-cm-actions' }, [counter, send]));
    return box;
  }

  /* The form: a new post, or one's own being changed — the sheet's order,
     eyebrow, title, the line that says why, what went wrong, the fields and
     the one action, and the way out beside it. */
  function drawWrite(box) {
    box.appendChild(cmBack());
    if (state.loading) { box.appendChild(el('div', { className: 'card azeri-cm-list' }, [skeleton()])); return; }
    if (state.failed) {
      box.appendChild(el('div', { className: 'card azeri-cm-list' }, [el('p', { className: 'azeri-note', role: 'status', text: t('azeriComError') })]));
      return;
    }
    if (!cm.user) { box.appendChild(signInCard()); return; }
    var editing = !!cm.draft.id;
    var card = el('div', { className: 'card azeri-cm-write' }, [
      el('p', { className: 'eyebrow', text: t(editing ? 'azeriComEditEyebrow' : 'azeriComWriteEyebrow') }),
      el('h2', { text: t(editing ? 'azeriComEditTitle' : 'azeriComWriteTitle') }),
      el('p', { className: 'lists-say', text: t('azeriComWriteSay') })
    ]);
    if (cm.error) card.appendChild(cmError(cm.error));

    var title = el('input', { type: 'text', id: 'cm-title', className: 'lists-input', maxlength: String(MAX_TITLE), autocomplete: 'off' });
    title.value = cm.draft.title;
    title.addEventListener('input', function () { cm.draft.title = title.value; });
    var text = el('textarea', { id: 'cm-text', className: 'lists-input', maxlength: String(MAX_BODY), rows: '8' });
    text.value = cm.draft.body;
    var counter = el('span', { className: 'azeri-cm-counter', text: t('feedbackCount', { n: cm.draft.body.length, max: MAX_BODY }) });
    text.addEventListener('input', function () {
      cm.draft.body = text.value;
      counter.textContent = t('feedbackCount', { n: cm.draft.body.length, max: MAX_BODY });
    });
    card.appendChild(el('div', { className: 'azeri-cm-field' }, [el('label', { 'for': 'cm-title', text: t('azeriComTitleLabel') }), title]));
    card.appendChild(el('div', { className: 'azeri-cm-field' }, [el('label', { 'for': 'cm-text', text: t('azeriComTextLabel') }), text]));

    var go = el('button', { type: 'button', className: 'go', text: t(editing ? 'azeriComSave' : 'azeriComPost') });
    var cancel = el('button', { type: 'button', className: 'alt', text: t('azeriComCancel') });
    go.addEventListener('click', function () {
      if (cm.busy) return;
      if (!cm.draft.title.trim()) { cm.error = 'title'; draw(); return; }
      cm.busy = true;
      go.disabled = true;
      var body = editing
        ? { action: 'edit', id: cm.draft.id, title: cm.draft.title, body: cm.draft.body }
        : { action: 'post', title: cm.draft.title, body: cm.draft.body };
      cmSend(body, function (out) {
        track(editing ? 'azeri_edit' : 'azeri_posted', { what: 'post' });
        cmGo(cmHref({ post: out.id }), true);
      }, function (word) {
        cm.busy = false;
        cm.error = word;
        draw();
      });
    });
    cancel.addEventListener('click', function () {
      if (cm.fromFeed || editing) window.history.back();
      else cmGo(cmHref());
    });
    card.appendChild(el('div', { className: 'azeri-cm-actions' }, [go, cancel, counter]));
    box.appendChild(card);
  }

  /* What is new in Community for a member, asked once each time another tab
     is shown: the route's ?news=1, about a dozen rows for a member and none
     for anybody else, who gets no dot. */
  function askNews() {
    getJSON(COMMUNITY + '?news=1').then(function (out) {
      state.news = out.news ? out.news.posts + out.news.mine : 0;
      sayNews();
    }).catch(function () { /* no dot */ });
  }

  /* The dot on the Community tab while another is read, with the number in
     the browser's tab — said after the words, since applyStaticStrings()
     writes the tab's text over anything inside it. */
  function markNews() {
    var tab = document.querySelector('.azeri-tab[data-tab="community"]');
    if (!tab) return;
    var dot = tab.querySelector('.azeri-cm-dot');
    var lit = state.news > 0 && state.tab !== 'community';
    if (lit && !dot) tab.appendChild(newDot());
    if (!lit && dot) tab.removeChild(dot);
  }

  function newsTitle() {
    if (!state.news || state.tab === 'community') return '';
    return '(' + (state.news > 9 ? '9+' : state.news) + ') ';
  }

  /* ---------------------------------------------------------------- boot */

  applyStyle();
  state.tab = pickTab();
  markTab();
  /* The language is known before anything has come back, so the first ask
     goes out beside the words rather than after them, and the page waits
     for the slower of the two instead of both end to end. Nothing is drawn
     until the words are in — draw() stands back while state.ready is
     false — so an answer that beats them waits to be drawn with them. */
  state.lang = pickLanguage();
  wireLinks();
  askShown();
  Promise.all([
    getJSON(LANGS_URL).then(function (names) { state.names = names; }).catch(function () {}),
    loadWords(state.lang).catch(function () {})
  ]).then(function () {
    /* With no words at all the markup's English stands, rather than t()
       writing every key over it. */
    if (Object.keys(state.ui).length) applyStaticStrings();
    drawSwitch();
    state.ready = true;
    document.body.classList.add('is-ready');
    draw();
  });
})();
