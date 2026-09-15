/* Tallinn Tastebuds — the blog.
 *
 * /blog, and one post per thing this site does: the bookmark, the lists, the
 * discounts, the stories, the chat, the radio, the two styles. The map says
 * where to eat; this says what the site around it is doing and why, which is
 * the half that was only ever written down in README.md, where nobody who
 * opens the map is going to find it.
 *
 * WHAT IT IS MADE OF
 *
 * data/blog.json and nothing else — no endpoint, no database, no build step.
 * Two states, the index and one post, decided by ?post=<id> and built into
 * the one <main> in blog.html, which is how lists.html and account.html are
 * put together too. Walking between them is pushState rather than a fresh
 * document: a post is a few paragraphs out of a file that is already in
 * memory, and re-fetching the page to show them would also cut the radio off
 * mid-song for as long as the new document takes to boot.
 *
 * The page keeps the address honest as it goes. document.title and the
 * canonical tag are rewritten for the post being read, because ?post= is a
 * different page with different words on it, and one canonical pointing at
 * the index would ask a crawler to treat every post as the same page.
 *
 * THE CLIP
 *
 * Most posts carry one: a few seconds of the thing the post is about, drawn
 * out of the site's own components and left looping. It is an animated PNG
 * rather than a video, which is the format people mean when they say a GIF
 * and is the one that needs nothing from this file but an <img> — no
 * autoplay policy to satisfy, no poster, no controls to hide. Somebody who
 * has asked their machine for less motion gets the still instead, through the
 * <picture> below, because nothing can pause an APNG once it is playing. The
 * clips are drawn in both styles and this picks the one the page is wearing:
 * a light card in a dark page is the one thing on this site that cannot be
 * true. tools/blogclips.mjs makes all four files.
 *
 * A POST IS NOT HELD TO THE TEN LANGUAGES
 *
 * Every string this page draws around a post — the title, the lead, the way
 * back, the button at the foot — is in data/ui.json in all ten, like every
 * other word on this site. The posts themselves are not: they are several
 * hundred words each of somebody's own writing, which is the same thing a
 * story's caption and a place's blurb are, and those have always been
 * written in the languages they have been written in. A post with nothing in
 * the reading language falls back to English and says so, in the reader's
 * own language, above the first paragraph. See "The blog" in README.md.
 *
 * Plain browser JavaScript, ES5, one IIFE, no modules and no framework, the
 * same as every other file in assets/.
 */
(function () {
  'use strict';

  var DEFAULT_LANG = 'en';
  var LANG_KEY = 'ttb.lang';

  /* The two styles the site has, the key they are kept under and the one it
     opens on — the same names and the same default as assets/app.js, which is
     where they are actually chosen. There is no swatch on this page. */
  var STYLES = ['red', 'green'];
  var DEFAULT_STYLE = 'red';
  var STYLE_KEY = 'ttb.style';

  var UI_URL = '/data/ui.json';
  var POSTS_URL = '/data/blog.json';

  /* Where the clips are, and what the four files for one post are called.
     The id is the whole of the name: a post and its pictures cannot drift
     apart if there is nothing to keep in step. */
  var CLIPS = '/clips/';

  /* The address this page is served at. Cloudflare Pages serves blog.html
     here as well, the way it serves google.html at /google, and this is the
     spelling every link written by this file uses: one address per post, and
     not two spellings of it in anybody's history. */
  var PAGE = '/blog';

  var state = {
    ui: {},
    lang: DEFAULT_LANG,
    posts: [],      // newest first
    open: null,     // the post being read, or null on the index
    missing: false  // ?post= named one that is not here any more
  };

  var toastTimer = null;
  var main = null;   // the one element both states are built into

  /* ---------------------------------------------------------- the small bits */

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

  function toast(message) {
    var node = document.getElementById('toast');
    node.textContent = message;
    node.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.hidden = true; }, 3800);
  }

  /* ------------------------------------------------------- look and feel */

  /* The style the site is wearing. The map has the swatch and writes the
     choice to localStorage; this page reads it, exactly as the lists, account
     and directory pages do — walking from the map to something to read should
     not feel like leaving. Everything drawn here is built out of the tokens
     both styles restate, so this one attribute is the whole of it. */
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

  /* ------------------------------------------------------------ the posts */

  /* One field of a post in the reading language, falling back to English.
     Returns '' for a field that is not there at all, and every caller draws
     nothing rather than a gap: a post with no link has no button under it. */
  function say(field) {
    if (!field) return '';
    var s = field[state.lang];
    if (s === undefined) s = field[DEFAULT_LANG];
    return s === undefined ? '' : s;
  }

  /* Whether the reader is getting this post in their own language or in
     English because that is all there is. The title is the thing asked: a
     post is written whole or not at all, and the validator holds the three
     fields to the same languages. */
  function translated(post) {
    return state.lang === DEFAULT_LANG || post.title[state.lang] !== undefined;
  }

  /* Where a language code is not enough to say which of its dates is meant.
     "en" resolves to en-US in every engine that has both, which draws
     "August 9, 2026" — and this site's English is the English the README and
     every write-up on the map are written in, where that date is the ninth of
     August. Nothing else in the ten needs a region: Portuguese and Spanish
     write the same date either side of their oceans. */
  var LOCALES = { en: 'en-GB' };

  /* "9 August 2026", in the reading language.
   *
   * Intl first, which is the other way round from formatMonth() in
   * assets/app.js, and the reason is grammar. A date with a day in it puts
   * the month in a case the twelve names in ui.json are not written in:
   * Russian wants "7 апреля" where the list says "апрель", Finnish wants
   * "7. huhtikuuta" where it says "huhtikuu". Intl knows that for all ten and
   * a pattern of our own cannot, short of a second list of twelve names per
   * language for this one line.
   *
   * The fallback underneath is for an engine with no Intl at all, and it is
   * the ui.json names in each language's own order — day first, "{day}." in
   * Estonian and Finnish, "de" either side in Portuguese and Spanish. An
   * engine that has Intl but was built without a locale's data answers in
   * English instead of falling through to here, which is worse and is not
   * something any browser this site is opened in does today.
   */
  function formatDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return iso || '';
    var year = Number(m[1]);
    var index = Number(m[2]) - 1;
    var day = Number(m[3]);

    try {
      return new Intl.DateTimeFormat(LOCALES[state.lang] || state.lang, {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
      }).format(new Date(Date.UTC(year, index, day)));
    } catch (e) {
      var names = (t('months') || '').split('|');
      return t('blogDate', { day: day, month: names[index] || m[2], year: year });
    }
  }

  function postHref(post) { return PAGE + '?post=' + encodeURIComponent(post.id); }

  /* The clip for a post, or nothing when it has none: a <picture> holding the
     looping version and, for anybody who asked for less motion, the first
     frame of it standing still. The dark style has its own pair — see the
     head of this file — and the alt is the post's own sentence about what the
     clip shows, which is the only part of it a reader who cannot see it
     gets. */
  function clip(post) {
    if (!post.clip) return null;

    var dark = document.documentElement.getAttribute('data-style') === 'green';
    var stem = CLIPS + post.id + (dark ? '-green' : '');

    return el('figure', { className: 'blog-clip' }, [
      el('picture', {}, [
        el('source', { media: '(prefers-reduced-motion: reduce)', srcset: stem + '-still.png' }),
        el('img', {
          src: stem + '.png',
          alt: say(post.clip),
          width: '960',
          height: '540',
          decoding: 'async'
        })
      ])
    ]);
  }

  function findPost(id) {
    for (var i = 0; i < state.posts.length; i++) {
      if (state.posts[i].id === id) return state.posts[i];
    }
    return null;
  }

  /* ----------------------------------------------------------- the drawing */

  /* The same mark, drawn the same way, as the rows on the account page: one
     shape for "there is more this way" across the site. */
  var ICON_GO = '<path d="M9 5l7 7-7 7"/>';

  function chevron() {
    return el('span', {
      className: 'menu-go',
      'aria-hidden': 'true',
      html: '<svg viewBox="0 0 24 24" focusable="false">' + ICON_GO + '</svg>'
    });
  }

  /* The date, wearing the site's eyebrow — see assets/blog.css. The same
     element over a row and over the post it opens. */
  function when(post) {
    return el('time', { className: 'eyebrow blog-when', datetime: post.date },
      [formatDate(post.date)]);
  }

  /* One post as a row: the date, the title, the line saying what it is about,
     and the chevron. It is .menu-row out of assets/styles.css — the shape the
     account sheet draws a way-on in — because that is what this is, and
     because the eighth design rule says a list of places to go is rows with a
     target the width of the card rather than a column of links. */
  /* The two links that stay on this page: a row on the index, and the way
     back from a post. Both are real <a href>s — the address they would go to
     is the address this page is about to become — and this is what happens
     instead of following them. A modified click is somebody asking for a
     second tab, and the browser is better at that than this is. */
  function walks(link, post) {
    link.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      go(post);
    });
    return link;
  }

  function row(post) {
    return el('li', { className: 'menu-item' }, [
      walks(el('a', { className: 'menu-row blog-row', href: postHref(post) }, [
        el('span', { className: 'menu-say' }, [
          when(post),
          el('span', { className: 'menu-name', textContent: say(post.title) }),
          el('span', { className: 'blog-say', textContent: say(post.standfirst) })
        ]),
        chevron()
      ]), post)
    ]);
  }

  function renderIndex() {
    return [
      el('header', { className: 'blog-head' }, [
        el('p', { className: 'eyebrow', textContent: t('eyebrow') }),
        el('h1', { className: 'blog-title', textContent: t('blogTitle') }),
        el('p', { className: 'blog-lead', textContent: t('blogLead') })
      ]),
      state.missing ? el('p', { className: 'blog-note', textContent: t('blogMissing') }) : null,
      el('div', { className: 'card lists-card' }, [
        el('ul', { className: 'menu blog-posts' }, state.posts.map(row))
      ])
    ];
  }

  function renderPost(post) {
    var body = say(post.body) || [];

    return [
      el('p', { className: 'blog-crumb' }, [TTBTrack.click(
        walks(el('a', { className: 'alt', href: PAGE, textContent: t('blogAll') }), null),
        'blog_all'
      )]),
      el('article', { className: 'card lists-card blog-post' }, [
        when(post),
        el('h1', { className: 'blog-title', textContent: say(post.title) }),
        el('p', { className: 'blog-lead', textContent: say(post.standfirst) }),
        translated(post) ? null
          : el('p', { className: 'blog-note', textContent: t('blogEnglishOnly') }),
        clip(post),
        el('div', { className: 'blog-body' }, body.map(function (para) {
          return el('p', { textContent: para });
        })),
        post.link ? el('p', { className: 'blog-foot' }, [
          TTBTrack.click(
            el('a', { className: 'go', href: post.link, textContent: t('blogVisit') }),
            'blog_visit', { post: post.id }
          )
        ]) : null
      ])
    ];
  }

  /* Both states are drawn from here, so there is one place that decides which
     of them the page is showing and nothing can be left standing from the one
     before. */
  function render() {
    var post = state.open;

    clear(main);
    main.appendChild(el('div', { className: 'lists-stack' },
      post ? renderPost(post) : renderIndex()));

    document.title = post ? say(post.title) + ' | Tallinn Tastebuds' : t('blogDocumentTitle');

    /* The address this page currently is, said to a crawler as well as shown
       in the bar. Written on every draw rather than only on a post, or coming
       back to the index would leave the last post's canonical standing. */
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', window.location.origin + (post ? postHref(post) : PAGE));
  }

  /* Walking between the index and a post. The row is a real link and this is
     what happens instead of following it: the words change, the address
     changes with them, and the radio goes on playing because the document
     was never torn down. */
  function go(post) {
    state.open = post;
    state.missing = false;
    window.history.pushState({ post: post ? post.id : '' }, '', post ? postHref(post) : PAGE);
    render();
    window.scrollTo(0, 0);
    main.focus();
    TTBTrack.view(document.title);
    if (post) TTBTrack.event('blog_post', { post: post.id });
  }

  function readUrl() {
    var id = new URLSearchParams(window.location.search).get('post');
    if (!id) {
      state.open = null;
      state.missing = false;
      return;
    }
    /* A post that is not here any more: the index, with the sentence saying
       so over it, rather than an empty page or a 404 from a static host that
       would never have been asked for this address in the first place. */
    state.open = findPost(id);
    state.missing = !state.open;
  }

  /* ------------------------------------------------------------------ radio
   * The map's button, in this page's header, playing the map's station:
   * assets/radio.js holds the station and the on/off across the walk from the
   * map to here. It draws the button and wires the press itself; all this
   * page owns is the one thing it cannot say — a stream that would not start,
   * in the visitor's language. */
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
    applyStyle();
    main = document.getElementById('main');

    Promise.all([getJSON(UI_URL), getJSON(POSTS_URL)]).then(function (answers) {
      state.ui = answers[0];
      state.lang = pickLanguage(Object.keys(state.ui));
      applyStaticStrings();

      /* Newest first, and sorted here rather than trusted from the file: the
         dates are written by hand, and a post added to the end of the array
         is the ordinary way one arrives. */
      state.posts = answers[1].slice().sort(function (a, b) {
        return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
      });

      readUrl();
      render();
      /* The tag counted this address as the document loaded, post and all, so
         only the walks from here are ours to report. */
      TTBTrack.seen();
      mountRadio();
    }).catch(function (err) {
      /* Whatever went wrong, the reader gets a sentence rather than an empty
         page. Reached through state.ui rather than t(), and with the English
         written out behind it, because the thing that failed may well be
         ui.json — and t() with no strings in it returns the key, which is a
         visitor reading "loadError" off the page. Same last resort the map,
         the lists and the directory all fall back on. */
      clear(main);
      main.appendChild(el('div', { className: 'lists-stack' }, [
        el('div', { className: 'card lists-card' }, [
          el('p', { className: 'blog-lead', textContent: (state.ui.en && state.ui.en.loadError) ||
            'Something went wrong loading the data. Try refreshing the page.' })
        ])
      ]));
      if (window.console && window.console.error) window.console.error(err);
    });

    window.addEventListener('popstate', function () {
      readUrl();
      render();
      TTBTrack.view(document.title);
    });
  }

  boot();
})();
