/* Tallinn Tastebuds — /azeri, the members' corner about Azerbaijan.
 *
 * WHAT IT IS. A page for people with an account, linked from nowhere on the
 * site, and four tabs on it. Films is the country's cinema: the 2,615 of the
 * Azerbaijani Wikipedia's list, which tools/azfilms.mjs collects and
 * /api/azeri hands out twenty at a time. Estonia, Studying and Estonian are
 * a guide for somebody arriving here from there — what to sort out and in
 * what order, how to get into a university, and where to learn the
 * language. **Azerbaijan, for members** in docs/handbook.md.
 *
 * FOUR LANGUAGES, NOT ELEVEN. The page's words are in data/ui.json in all
 * eleven, like every other page's, because the validator holds every key to
 * every language; the page reads four of them, Azerbaijani, English, Russian
 * and Estonian, which are the four the guide is written in. Which of the
 * four is kept under its own key, LANG_KEY, rather than in ttb.lang, so
 * choosing Azerbaijani here does not turn the map into Azerbaijani for
 * somebody who reads it in Russian.
 *
 * A TAB IS AN ADDRESS. /azeri is the films and /azeri?tab=estonia a tab of
 * the guide: the tabs are links, the page loads again under the one that
 * was pressed, and Back goes where it should with nothing here keeping
 * count. A topic that is opened is written into the address beside it,
 * &topic=housing, so the address somebody copies opens what they were
 * reading.
 *
 * THE GUIDE. A tab is asked for whole, once, in the language the page is
 * read in — and again when that changes, since the answer carries one
 * language. Its topics are the films' rows with a chevron where Watch is:
 * one with a body opens under its row, one topic at a time, and one with an
 * address is a way out. Estonian opens on the site's own flashcards, which
 * is the tab's one filled action. From 900px the topics stand down the left
 * and the opened one beside them, so the first is open on arrival there —
 * an empty half would be the first thing seen. The layout is all in
 * assets/azeri.css.
 *
 * A PAGE AT A TIME. The shelf is never fetched whole. It opens on the
 * feature films that can be watched, the most watched first, twenty to a page, and
 * Previous and Next under the list turn the pages; a chip, the switch or the
 * search starts again from the first. The switch is on to begin with, since
 * a film somebody can play is the reason to be here, and off is a press
 * away. Each page costs the route one read of the database, the session,
 * and nothing more — the header of functions/api/azeri.js has the sums — so
 * the pages are buttons rather than a scroll that asks on its own.
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
 * WIDE, IT IS A WALL OF FILMS. On a phone the shelf is a list, a line or
 * two a film. From 900px it is a grid of cards, each under the picture
 * YouTube keeps for its video — or under its year, where there is no video
 * — and the film that is opened takes the whole row, the player on the left
 * at a size worth watching and what the film is on the right. The pictures
 * are asked for only there: on a phone the frame they would sit in is not
 * drawn, and an image that is not drawn and is marked lazy is not fetched.
 * The layout is all in assets/azeri.css; this file draws one set of nodes.
 */
(function () {
  'use strict';

  var API = '/api/azeri';
  var LANGS_URL = '/data/lang/index.json';
  var LANG_URL = '/data/lang/';
  var LANGS = ['az', 'en', 'ru', 'et'];
  var TABS = ['films', 'estonia', 'study', 'estonian'];
  var SAY_KEYS = { estonia: 'azeriEstoniaSay', study: 'azeriStudySay' };
  /* The flashcards live on a host of their own and speak three languages:
     DECK_LANGS in functions/api/_lib.js. */
  var FLASHCARDS = 'https://flashcard.tallinntastebuds.ee/';
  var FLASH_LANGS = ['az', 'en', 'ru'];
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
    lang: 'en',
    ui: {},
    names: {},
    tab: 'films',    // which of TABS the address names
    guide: null,     // a tab of the guide, as the route answered it
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
    door: false      // nobody is signed in
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
     the site's, then the browser's, then English. */
  function pickLanguage() {
    var fromUrl = new URLSearchParams(window.location.search).get('lang');
    if (LANGS.indexOf(fromUrl) !== -1) return fromUrl;
    var own = storeGet(LANG_KEY);
    if (LANGS.indexOf(own) !== -1) return own;
    var site = storeGet('ttb.lang');
    if (LANGS.indexOf(site) !== -1) return site;
    var prefs = navigator.languages || [navigator.language || ''];
    for (var i = 0; i < prefs.length; i++) {
      var base = String(prefs[i]).toLowerCase().split('-')[0];
      if (LANGS.indexOf(base) !== -1) return base;
    }
    return 'en';
  }

  /* The tab the address names, and the films where it names none. */
  function pickTab() {
    var asked = new URLSearchParams(window.location.search).get('tab');
    return TABS.indexOf(asked) !== -1 ? asked : 'films';
  }

  /* The tabs are links in the markup, which cannot know which of them it
     was served for: this says so on the one that is on. */
  function markTab() {
    var tabs = document.querySelectorAll('.azeri-tab');
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute('data-tab') === state.tab;
      tabs[i].className = 'azeri-tab' + (on ? ' is-on' : '');
      if (on) tabs[i].setAttribute('aria-current', 'page');
      else tabs[i].removeAttribute('aria-current');
    }
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
    /* The skip link is written for the films; under a tab of the guide it
       leads to topics. */
    if (state.tab !== 'films') document.querySelector('.skip-link').textContent = t('azeriSkipTopics');
    document.title = t('azeriTitle') + ' | Tallinn Tastebuds';
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
      /* The films carry both of their languages; a tab of the guide was
         answered in one, so it is asked for again. */
      if (state.tab === 'films') draw();
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

  /* Ask the route, and hand what it answers to `took`: the door where
     nobody is signed in, the failed state for anything else that is not an
     answer. An answer to an older ask that arrives after a newer one is
     dropped, so typing fast never leaves the shelf showing what the
     last-but-one word found. */
  function send(url, took) {
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
        if (answer.status === 401) { state.door = true; draw(); return; }
        if (answer.status !== 200) throw new Error(String(answer.status));
        state.door = false;
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

  /* A tab of the guide, whole, in the language the page is read in. */
  function askGuide() {
    state.guide = null;
    send(API + '?tab=' + state.tab + '&lang=' + state.lang, function (out) {
      state.guide = out;
      state.topic = firstTopic(out.topics);
    });
  }

  /* The topic open on arrival: the one the address names, and on a wide
     screen the first where it names none, since there the opened topic
     stands beside the list and an empty half would be the first thing
     seen. */
  function firstTopic(topics) {
    var asked = new URLSearchParams(window.location.search).get('topic');
    var readable = topics.filter(function (topic) { return topic.body; });
    for (var i = 0; i < readable.length; i++) {
      if (readable[i].id === asked) return asked;
    }
    return readable.length && isWide() ? readable[0].id : null;
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

  function draw() {
    var host = document.getElementById('shelf');
    while (host.firstChild) host.removeChild(host.firstChild);
    if (state.door) { host.appendChild(door()); return; }
    if (state.tab !== 'films') { drawGuide(host); return; }
    host.appendChild(tools());
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

  /* The door, for somebody with no session: the map's own sign-in sheet,
     which brings them back here when they are in. */
  function door() {
    var here = window.location.pathname + window.location.search;
    return el('div', { className: 'card azeri-door' }, [
      el('p', { text: t('azeriDoorText') }),
      el('a', {
        className: 'link-btn is-primary azeri-signin',
        href: '/?account=in&then=' + encodeURIComponent(here),
        'data-track': 'account_open',
        text: t('azeriSignIn')
      })
    ]);
  }

  function tools() {
    var box = el('div', { className: 'azeri-tools' });

    var search = el('input', {
      type: 'search',
      className: 'lists-input azeri-search',
      placeholder: t('azeriSearch'),
      'aria-label': t('azeriSearch'),
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
        ask(1);
        /* draw() replaced the box; the caret goes back where it was. */
        var again = document.querySelector('.azeri-search');
        if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
      }, SEARCH_WAIT);
    });
    box.appendChild(search);

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

  /* The picture over a card on a wide screen: YouTube's own for the video
     the button plays, pressed to play it, or the film's year where there is
     nothing to play. Not drawn on a phone — assets/azeri.css — and lazy, so
     not fetched there either. */
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
    if (isOpen) wrap.appendChild(detail(film));
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

  function detail(film) {
    var playing = !!(state.playing && youtubeId(state.playing));
    var box = el('div', { className: 'azeri-detail' + (playing ? ' has-player' : '') });
    if (playing) box.appendChild(player(film));

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
     the tab is Estonian, the topics, and under them the line saying whose
     word is final. */
  function drawGuide(host) {
    if (SAY_KEYS[state.tab]) host.appendChild(el('p', { className: 'lists-say', text: t(SAY_KEYS[state.tab]) }));
    if (state.tab === 'estonian') {
      host.appendChild(flashcards());
      host.appendChild(el('p', { className: 'eyebrow azeri-ways', text: t('azeriWays') }));
    }
    /* Topics that open are a list beside an article on a wide screen; ways
       out are the wall the films are. */
    var list = el('div', { className: 'azeri-list card' + (state.tab === 'estonian' ? '' : ' is-guide') });
    if (state.loading) {
      list.appendChild(skeleton());
    } else if (!state.guide) {
      list.appendChild(el('p', { className: 'azeri-note', role: 'status', text: t('azeriGuideError') }));
    } else {
      state.guide.topics.forEach(function (topic) { list.appendChild(topicRow(topic)); });
    }
    host.appendChild(list);
    if (state.guide && state.tab !== 'estonian') {
      host.appendChild(el('p', { className: 'azeri-credit', text: t('azeriGuideCredit') }));
    }
  }

  /* The site's own way to learn the language, and the tab's one filled
     action. The flashcards speak three languages, so their address names
     the reader's only where it is one of the three. */
  function flashcards() {
    var go = el('a', {
      className: 'go',
      href: FLASHCARDS + (FLASH_LANGS.indexOf(state.lang) !== -1 ? '?lang=' + state.lang : ''),
      text: t('azeriFlashOpen')
    });
    go.addEventListener('click', function () { track('azeri_flashcards'); });
    return el('div', { className: 'card azeri-flash' }, [
      el('p', { className: 'eyebrow', text: t('azeriFlashEyebrow') }),
      el('h2', { text: t('azeriFlashTitle') }),
      el('p', { className: 'lists-say', text: t('azeriFlashSay') }),
      go
    ]);
  }

  /* A topic: a film's row with a chevron where Watch is. One with a body
     opens in the page; one with an address is a way out, and the whole row
     is the link. */
  function topicRow(topic) {
    var go = el('span', { className: 'menu-go', 'aria-hidden': 'true' });
    go.innerHTML = CHEVRON;
    var kids = [
      el('span', { className: 'azeri-words' }, [
        el('span', { className: 'azeri-name', text: topic.name }),
        el('span', { className: 'azeri-meta', text: topic.covers })
      ]),
      go
    ];
    if (topic.url) {
      var out = el('a', { className: 'azeri-row has-go', href: topic.url, target: '_blank', rel: 'noopener' }, kids);
      out.addEventListener('click', function () { track('azeri_way', { way: topic.id }); });
      return el('div', { className: 'azeri-film azeri-topic' }, [out]);
    }
    var isOpen = state.topic === topic.id;
    var head = el('button', { type: 'button', className: 'azeri-row has-go', 'aria-expanded': String(isOpen) }, kids);
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

  /* A link out of the guide, counted under the topic it was pressed in. */
  function outLink(text, url, topic) {
    var a = el('a', { href: url, target: '_blank', rel: 'noopener', text: text });
    a.addEventListener('click', function () { track('azeri_source', { topic: topic.id }); });
    return a;
  }

  /* An opened topic: when it was checked, its paragraphs and lists, and the
     links to where the rule itself is written. Its name is drawn again as a
     heading for the wide screen, where the article stands beside the list
     rather than under its own row; a phone does not show it. */
  function article(topic) {
    var box = el('div', { className: 'azeri-detail azeri-article' }, [
      el('h2', { className: 'azeri-heading', text: topic.name }),
      el('p', { className: 'azeri-kind', text: t('azeriChecked', { when: checkedMonth() }) })
    ]);
    topic.body.forEach(function (block) {
      if (block.p) { box.appendChild(el('p', { text: block.p })); return; }
      var list = el(block.steps ? 'ol' : 'ul');
      (block.steps || block.list).forEach(function (it) {
        var lead = !it.b ? null : it.url ? outLink(it.b, it.url, topic) : el('b', { text: it.b });
        list.appendChild(el('li', {}, [lead, lead ? ' ' : null, it.t]));
      });
      box.appendChild(list);
    });
    if (topic.links.length) {
      var links = el('p', { className: 'azeri-links' });
      topic.links.forEach(function (l) { links.appendChild(outLink(l.name, l.url, topic)); });
      box.appendChild(el('div', { className: 'azeri-sources' }, [
        el('span', { className: 'azeri-kind', text: t('azeriSources') }),
        links
      ]));
    }
    return box;
  }

  /* ---------------------------------------------------------------- boot */

  applyStyle();
  state.tab = pickTab();
  markTab();
  var lang = pickLanguage();
  Promise.all([
    getJSON(LANGS_URL).then(function (names) { state.names = names; }).catch(function () {}),
    loadWords(lang).catch(function () {})
  ]).then(function () {
    applyStaticStrings();
    drawSwitch();
    if (state.tab === 'films') ask(1);
    else askGuide();
  });
})();
