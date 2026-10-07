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
 * The house's posts are data/blog.json — no endpoint, no database, no build
 * step. Everybody else's are the posts members write on /write, read from
 * /api/posts a page at a time (functions/api/posts.js); the index draws both
 * kinds in one list by date, each with its byline and Show more under them,
 * ?post= opens one of either kind, and
 * ?by=<name> is one person's. A route that does not answer is a blog of the
 * house's notes. functions/blog.js serves the page, but only to write its
 * head and its text for a crawler; nothing here waits on it.
 *
 * A member's post is blocks rather than paragraphs — headings, quotes,
 * lists, a divider, links off the site, places on the map as cards and
 * somebody's public list as a row of them — and blocks() below draws them as
 * text, never as HTML: what a post may hold is functions/api/_posts.js, and
 * **Everybody's posts** under **The blog** in README.md.
 *
 * A LIST IN A POST
 *
 * A public list goes into a post as its places, side by side, to swipe
 * through: a member's post carries it as a block of its own, and one of the
 * house's as a paragraph that is nothing but a link to it. Each is read from
 * /api/lists when the post is, and drawn by listBlock() — **A list inside a
 * post** under **The blog** in README.md.
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
 * the index would ask a crawler to treat every post as the same page. The
 * head the page arrives with is already the right one: functions/blog.js
 * writes it for the address that was opened, with the post as text in <main>
 * for the readers that run no script, and render() empties that before it
 * draws. The rewriting here is for the walks after that.
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
 * clips are drawn in Red and Green and this picks the one with the page's
 * light — Blue wears Red's, Plum wears Green's: a light card in a dark page is
 * the one thing on this site that cannot be true. tools/blogclips.mjs makes
 * all four files.
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
  var STYLES = ['red', 'green', 'blue', 'plum'];
  var DEFAULT_STYLE = 'red';
  var STYLE_KEY = 'ttb.style';

  /* The words, one language at a time: the list of languages, then the one
     this reader is in — written by tools/languages.mjs out of data/ui.json,
     which is ten languages of every string the site has, 190 KB on the wire
     against this script's 8. **One language at a time** under **Languages**
     in README.md. */
  var LANGS_URL = '/data/lang/index.json';
  var LANG_URL = '/data/lang/';
  var POSTS_URL = '/data/blog.json';

  /* Everybody else's: the posts members write on /write, out of the
     database a page at a time — functions/api/posts.js. Nothing here waits
     on it: an answer that does not come is a blog of the house's notes, which
     is what it always was. The places a post's cards name are read out of
     the map's own file the first time a post has one, and the Google venues
     the map does not have out of /api/places by id, only those. */
  var MEMBERS_API = '/api/posts';
  var MAP_URL = '/data/map.json';
  var CITY_URL = '/api/places';
  var LISTS_API = '/api/lists?id=';

  /* Where the clips are, and what the four files for one post are called.
     The id is the whole of the name: a post and its pictures cannot drift
     apart if there is nothing to keep in step. */
  var CLIPS = '/clips/';

  /* The address this page is served at. Cloudflare Pages serves blog.html
     here as well, the way it serves feedback.html at /feedback, and this is the
     spelling every link written by this file uses: one address per post, and
     not two spellings of it in anybody's history. */
  var PAGE = '/blog';

  var state = {
    ui: {},
    lang: DEFAULT_LANG,
    posts: [],      // newest first
    open: null,     // the house's post being read, or null
    missing: false, // ?post= named one that is not here any more
    members: { posts: [], next: null },  // everybody's, newest first, paged
    member: null,   // a member's post being read, whole, or null
    readIn: null,   // which of its languages it is being read in
    names: {},      // every language the site has, code → its own name
    author: null,   // ?by=: { name, posts, next }
    places: null,   // the map's places by id, once a post has needed them
    lists: {}       // a list a post carries, by id: the answer, false for one
                    // that is gone or private, null for one that did not
                    // answer — and a promise while it is being asked
  };

  var toastTimer = null;
  var main = null;   // the one element both states are built into

  /* Whose the house's posts are. They are written by whoever keeps the map,
     and the site's own account is the name they go under, so a row and a
     post say who wrote them the way a member's do. HOUSE in
     functions/blog.js is the same name. */
  var HOUSE = 'tallinntastebuds';

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

  /* state.ui is the one language this page was read in; see LANGS_URL. */
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
     every style restates, so this one attribute is the whole of it. */
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
   * Estonian and Finnish, "de" either side in Portuguese and Spanish.
   *
   * It is also for an engine that HAS Intl and has no data for the locale,
   * which is not the theoretical case it was written as: Chromium answers
   * "2026 M09 21" in Azerbaijani, which is the same artefact the README warns
   * formatMonth() in assets/app.js about, and it was invisible here for as
   * long as every post was in English alone. An M and two digits is not a
   * month in any of the ten, so NOT_A_MONTH is the one wrong answer this can
   * catch by looking at it, and "21 sentyabr 2026" out of ui.json is better
   * than a machine's month number.
   *
   * What it cannot catch is the other way the same gap shows: Intl answering
   * in English for a locale it half knows, which is what Armenian gets here.
   * That comes back as a well-formed date in the wrong language and there is
   * nothing in the string to tell it from a right one.
   */
  var NOT_A_MONTH = /M\d\d/;

  function formatDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return iso || '';
    var year = Number(m[1]);
    var index = Number(m[2]) - 1;
    var day = Number(m[3]);
    var said = '';

    try {
      said = new Intl.DateTimeFormat(LOCALES[state.lang] || state.lang, {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
      }).format(new Date(Date.UTC(year, index, day)));
    } catch (e) {
      said = '';
    }

    if (said && !NOT_A_MONTH.test(said)) return said;

    var names = (t('months') || '').split('|');
    return t('blogDate', { day: day, month: names[index] || m[2], year: year });
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

    /* The clips are drawn in two styles, Red and Green, and each of the other
       two wears the one with its light: Blue the light clip, Plum the dark.
       Read off the computed color-scheme each style block declares in
       assets/styles.css, so a style is never named here. */
    var dark = getComputedStyle(document.documentElement).colorScheme === 'dark';
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

  /* The one piece of markup a post carries: [words](/path), a link to
     somewhere on this site and nowhere else — the path starts with one slash,
     never two. functions/blog.js draws the same pattern into the text it
     serves, and tools/validate.mjs holds every one to a real address. Each
     link reports blog_link with the post it was pressed in and where it went,
     which is how the owner finds out whether a post about bakeries sends
     anybody to a bakery. */
  var LINK = /\[([^\]]+)\]\((\/(?!\/)[^)\s]*)\)/g;

  /* A paragraph of the house's that is a link to a list and nothing else is
     the list itself, drawn as its places — the way a member's post carries
     one as a block. A link to a list inside a sentence stays a link. The id
     is LIST_ID in functions/api/_lists.js. */
  var LIST_ALONE = /^\[([^\]]+)\]\(\/list\/([a-z0-9][a-z0-9-]{2,47})\)$/;

  function prose(text, post) {
    var kids = [];
    var at = 0;
    var m;
    LINK.lastIndex = 0;
    while ((m = LINK.exec(text)) !== null) {
      if (m.index > at) kids.push(text.slice(at, m.index));
      kids.push(TTBTrack.click(el('a', { href: m[2], textContent: m[1] }),
        'blog_link', { post: post.id, to: m[2] }));
      at = m.index + m[0].length;
    }
    if (at < text.length) kids.push(text.slice(at));
    return kids;
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

  /* One post as a row: the date, the title, the line saying what it is about,
     who wrote it, and the chevron. It is .menu-row out of assets/styles.css —
     the shape the account sheet draws a way-on in — because that is what this
     is, and because the eighth design rule says a list of places to go is rows
     with a target the width of the card rather than a column of links. */
  function row(post) {
    return el('li', { className: 'menu-item' }, [
      walks(el('a', { className: 'menu-row blog-row', href: postHref(post) }, [
        el('span', { className: 'menu-say' }, [
          when(post),
          el('span', { className: 'menu-name', textContent: say(post.title) }),
          el('span', { className: 'blog-say', textContent: say(post.standfirst) }),
          el('span', { className: 'menu-why', textContent: t('blogBy', { name: HOUSE }) })
        ]),
        chevron()
      ]), post)
    ]);
  }

  /* The index: every post, the house's and everybody else's, in one list,
     newest first, each row saying who wrote it. It used to be two cards under
     two headings, members' over the house's, and the line between them did
     not hold: the site's own account writes on /write like anybody, so a post
     by tallinntastebuds stood under "Written by members" over a card of
     posts by tallinntastebuds under another name. A post is a post; the
     byline says the rest.

     Members' posts come a page at a time and the house's are all here, so a
     house post is shown only once the members' pages have reached its day —
     otherwise Show more would bring in a member's post from August above one
     of the house's from September. With every page in, every house post is. */
  function renderIndex() {
    var page = state.members;
    var oldest = page.next && page.posts.length ? memberDay(page.posts[page.posts.length - 1]) : '';
    var rows = page.posts.map(function (post) {
      return { day: memberDay(post), node: memberRow(post) };
    }).concat(state.posts.filter(function (post) {
      return !oldest || post.date >= oldest;
    }).map(function (post) {
      return { day: post.date, node: row(post) };
    }));
    rows.sort(function (a, b) { return a.day < b.day ? 1 : a.day > b.day ? -1 : 0; });

    return [
      el('header', { className: 'blog-head' }, [
        el('p', { className: 'eyebrow', textContent: t('eyebrow') }),
        el('h1', { className: 'blog-title', textContent: t('blogTitle') }),
        el('p', { className: 'blog-lead', textContent: t('blogLead') })
      ]),
      state.missing ? el('p', { className: 'blog-note', textContent: t('blogMissing') }) : null,
      el('div', { className: 'card lists-card blog-index' }, [
        el('ul', { className: 'menu blog-posts' }, rows.map(function (r) { return r.node; })),
        moreButton(page, function () {
          return loadMembers(page, '').then(render);
        }),
        el('p', { className: 'lists-row lists-foot' }, [writeLink('alt')])
      ])
    ];
  }

  /* A card of one person's posts, ?by=, with Show more under it and the way
     to write one. */
  function memberCard(page, more) {
    return el('div', { className: 'card lists-card blog-index' }, [
      el('ul', { className: 'menu blog-posts' }, page.posts.map(memberRow)),
      moreButton(page, more),
      el('p', { className: 'lists-row lists-foot' }, [writeLink('alt')])
    ]);
  }

  /* Show more, under a list that has another page, and nothing under one
     that has not. */
  function moreButton(page, more) {
    if (!page.next) return null;
    var button = el('button', { type: 'button', className: 'alt', textContent: t('blogMore') });
    button.addEventListener('click', function () {
      button.disabled = true;
      TTBTrack.event('blog_more');
      more();
    });
    return el('p', { className: 'blog-more' }, [button]);
  }

  /* The way to /write, from the index and from under a post. */
  function writeLink(className) {
    return TTBTrack.click(el('a', { className: className, href: '/write', textContent: t('blogWriteYours') }), 'blog_write');
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
        byline({ author: HOUSE }),
        el('h1', { className: 'blog-title', textContent: say(post.title) }),
        el('p', { className: 'blog-lead', textContent: say(post.standfirst) }),
        translated(post) ? null
          : el('p', { className: 'blog-note', textContent: t('blogEnglishOnly') }),
        clip(post),
        el('div', { className: 'blog-body' }, body.map(function (para) {
          var alone = LIST_ALONE.exec(para.trim());
          if (alone) return listBlock(alone[2], post, alone[1]);
          return el('p', {}, prose(para, post));
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
    var member = state.member;
    var author = state.author;

    clear(main);
    /* A list of posts is laid out for a desk as well as a phone — two columns
       of rows once the screen has the room, see assets/blog.css — and a post
       is a column of prose, which reads at a measure whatever the screen. */
    main.classList.toggle('blog-wide', !member && !post);
    main.appendChild(el('div', { className: 'lists-stack' },
      member ? renderMember(member)
        : post ? renderPost(post)
        : author ? renderAuthor(author)
        : renderIndex()));

    document.title = member ? memberText(member).title + ' | Tallinn Tastebuds'
      : post ? say(post.title) + ' | Tallinn Tastebuds'
      : author ? t('blogByTitle', { name: author.name }) + ' | Tallinn Tastebuds'
      : t('blogDocumentTitle');

    /* The address this page currently is, said to a crawler as well as shown
       in the bar. Written on every draw rather than only on a post, or coming
       back to the index would leave the last post's canonical standing. */
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      canonical.setAttribute('href', window.location.origin +
        (member ? memberHref(member) : post ? postHref(post) : author ? byHref(author.name) : PAGE));
    }

    /* And which post is being read, for the site's own count — on arrival,
       on a walk and on Back alike, which are the three ways here, and once a
       load whichever of them it was. blog_post, below, is sent on a walk
       alone, and the site's count keeps no parameters: WHAT IT WAS ABOUT in
       functions/api/_visitors.js. */
    if (post) TTBTrack.about('post', post.id);
    if (member && !member.mine) countRead(member.id);
  }

  /* A member's post read, for its author: one row in press_counts under
     `post`, drawn back to them under Your posts on /insights and to the
     site's owner on /admin/stats, and to nobody else —
     functions/api/stats.js holds the kind and postViews() in
     functions/api/_visits.js reads it. Once a day per reader, the rule a
     list keeps, and under the same key in localStorage as assets/lists.js
     keeps its own, `post:<id>` beside `list:<id>`; view_seen on the server
     is the other half. Not when the author reads their own, which `mine`
     says and the server checks again by the session, and nothing from the
     owner's browser. The answer is not read: a post that drew is the
     feature, and a count that did not go up is not worth a word. */
  var OPENED_KEY = 'ttb.opened';

  function countRead(id) {
    if (window.TTBTrack && window.TTBTrack.owner) return;
    var day = new Date().toISOString().slice(0, 10);
    try {
      var kept = JSON.parse(localStorage.getItem(OPENED_KEY) || 'null');
      var seen = kept && kept.day === day && kept.seen instanceof Array ? kept.seen : [];
      if (seen.indexOf('post:' + id) !== -1) return;
      seen.push('post:' + id);
      localStorage.setItem(OPENED_KEY, JSON.stringify({ day: day, seen: seen }));
    } catch (e) { /* no storage: the server decides alone */ }
    var payload = { kind: 'post', id: id };
    if (window.TTBTrack && window.TTBTrack.device) payload.device = window.TTBTrack.device();
    fetch('/api/stats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(function () { /* a count missed, and nothing the reader needs to hear */ });
  }

  /* Walking between the index and a post. The row is a real link and this is
     what happens instead of following it: the words change, the address
     changes with them, and the radio goes on playing because the document
     was never torn down. */
  function go(post) {
    walk(post ? postHref(post) : PAGE).then(function () {
      if (post) TTBTrack.event('blog_post', { post: post.id });
    });
  }

  /* Walking to an address on this page: the address first, then whatever it
     names read — out of memory for the house's, from the route for a
     member's — then drawn. */
  function walk(href) {
    window.history.pushState({}, '', href);
    return readUrl().then(function () {
      render();
      window.scrollTo(0, 0);
      main.focus();
      TTBTrack.view(document.title);
    });
  }

  /* What the address names, read into state. A promise, because a member's
     post and a member's page of posts are a request away. */
  function readUrl() {
    var q = new URLSearchParams(window.location.search);
    var id = q.get('post');
    var by = q.get('by');
    state.open = null;
    state.member = null;
    state.author = null;
    state.missing = false;

    if (by) {
      var author = { name: by, posts: [], next: null };
      return loadMembers(author, '&by=' + encodeURIComponent(by)).then(function () {
        state.author = author;
      });
    }
    if (!id) return Promise.resolve();

    state.open = findPost(id);
    if (state.open) return Promise.resolve();

    /* Not the house's: perhaps a member's. A post that is neither is the
       index, with the sentence saying so over it, rather than an empty page
       or a 404 from a static host that would never have been asked for this
       address in the first place. */
    return Promise.all([fetchJSON(MEMBERS_API + '?id=' + encodeURIComponent(id)), loadPlaces()])
      .then(function (got) {
        var post = got[0] && got[0].post;
        if (!post) { state.missing = true; return; }
        state.member = post;
        state.readIn = post.texts[state.lang] ? state.lang : post.lang;
        return loadCity(post);
      });
  }

  /* ------------------------------------------------------- members' posts */

  /* JSON or null: every answer from the route is optional. */
  function fetchJSON(url) {
    return fetch(url, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .catch(function () { return null; });
  }

  /* The next page of a list of members' posts — everybody's, or one
     person's with `query` — appended to `page`. */
  function loadMembers(page, query) {
    var url = MEMBERS_API + '?' + (query ? query.slice(1) : '') +
      (page.next ? (query ? '&' : '') + 'before=' + encodeURIComponent(page.next) : '');
    return fetchJSON(url).then(function (out) {
      if (!out) return;
      page.posts = page.posts.concat(out.posts || []);
      page.next = out.next || null;
    });
  }

  function loadPlaces() {
    if (state.places) return Promise.resolve(state.places);
    return fetchJSON(MAP_URL).then(function (list) {
      state.places = {};
      (list || []).forEach(function (p) { if (p && p.id) state.places[p.id] = p; });
      return state.places;
    });
  }

  /* The cards a post names that the map does not have — Google's venues,
     which a member may pin as freely as one of mine — asked for by id, in
     every language the post is written in so a switch of pills needs nothing
     more. Never the whole roll: that is a hundred kilobytes for ten names. */
  function loadCity(post) {
    var ids = [];
    Object.keys(post.texts || {}).forEach(function (code) {
      (post.texts[code].body || []).forEach(function (b) {
        if (b && b.k === 'place' && !state.places[b.id] && ids.indexOf(b.id) === -1) ids.push(b.id);
      });
    });
    if (!ids.length) return Promise.resolve();
    return fetchJSON(CITY_URL + '?ids=' + ids.slice(0, 50).map(encodeURIComponent).join(',')).then(function (list) {
      (Array.isArray(list) ? list : []).forEach(function (p) {
        if (p && p.id && !state.places[p.id]) state.places[p.id] = p;
      });
    });
  }

  function memberHref(post) { return PAGE + '?post=' + encodeURIComponent(post.id); }
  function byHref(name) { return PAGE + '?by=' + encodeURIComponent(name); }

  /* The language of a member's post being read: the one picked on its
     pills, else the reader's own where it was written in it, else the one it
     was first written in. A row on the index has no pills and takes the
     second. */
  function memberText(post) {
    return post.texts[state.member === post && state.readIn] ||
      post.texts[state.lang] || post.texts[post.lang] || { title: '', standfirst: '' };
  }

  /* "by etibar", with the name a link to their profile — wherever the
     language puts the name in the sentence. */
  function byline(post) {
    var around = t('blogBy', { name: '\u0000' }).split('\u0000');
    return el('p', { className: 'blog-by' }, [
      around[0],
      TTBTrack.click(el('a', { href: '/u/' + encodeURIComponent(post.author), textContent: post.author }),
        'blog_author', { name: post.author }),
      around[1] || ''
    ]);
  }

  function minutes(post) {
    var words = (memberText(post).words) || 0;
    return t('blogMinutes', { n: Math.max(1, Math.round(words / 220)) });
  }

  /* The day a member's post was published, the shape a house post's date
     is written in, so the two sort together on the index. */
  function memberDay(post) {
    return new Date(post.at).toISOString().slice(0, 10);
  }

  function memberWhen(post) {
    return el('time', { className: 'eyebrow blog-when', datetime: memberDay(post) },
      [formatDate(memberDay(post)) + ' · ' + minutes(post)]);
  }

  /* A member's post as a row: the house's row, with who wrote it under the
     title. */
  function memberRow(post) {
    var text = memberText(post);
    var link = el('a', { className: 'menu-row blog-row', href: memberHref(post) }, [
      el('span', { className: 'menu-say' }, [
        memberWhen(post),
        el('span', { className: 'menu-name', textContent: text.title }),
        text.standfirst ? el('span', { className: 'blog-say', textContent: text.standfirst }) : null,
        el('span', { className: 'menu-why', textContent: t('blogBy', { name: post.author }) })
      ]),
      chevron()
    ]);
    link.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      walk(memberHref(post)).then(function () {
        TTBTrack.event('blog_member', { post: post.id });
      });
    });
    return el('li', { className: 'menu-item' }, [link]);
  }

  /* A run of a member's words, bold, italic and linked as they wrote it. A
     link off the site opens beside this one and carries no weight from it:
     the writer chose it, the site did not. */
  function runs(list, post) {
    return list.map(function (r) {
      var parts = String(r.t).split('\n');
      var node = document.createDocumentFragment();
      parts.forEach(function (part, i) {
        if (i) node.appendChild(el('br'));
        if (part) node.appendChild(document.createTextNode(part));
      });
      if (r.b) node = el('strong', {}, [node]);
      if (r.i) node = el('em', {}, [node]);
      if (r.a) {
        var away = r.a.charAt(0) !== '/';
        node = TTBTrack.click(el('a', away
          ? { href: r.a, target: '_blank', rel: 'nofollow ugc noopener' }
          : { href: r.a }, [node]), 'blog_link', { post: post.id, to: r.a });
      }
      return node;
    });
  }

  function placeBlock(id) {
    var p = state.places && state.places[id];
    if (!p) return null;
    return el('div', { className: 'blog-place' }, [
      TTBTrack.click(el('a', { className: 'menu-row', href: '/?spot=' + encodeURIComponent(id) }, [
        el('span', { className: 'menu-say' }, [
          el('span', { className: 'menu-name', textContent: p.name }),
          el('span', { className: 'menu-why', textContent: p.address || t('blogOnMap') })
        ]),
        chevron()
      ]), 'blog_place', { place: id })
    ]);
  }

  /* ----------------------------------------------------------- a list */

  /* A list a post carries, asked once a page load however often the post is
     drawn: an answer, false for a list that is gone or private — it leaves
     the post, the way a card for a place that is gone does — and null for a
     list that did not answer, which draws as a row going to it. The map's
     places come with it, since a card wears a place's first photograph. */
  function loadList(id) {
    if (state.lists[id] !== undefined) return Promise.resolve(state.lists[id]);
    var asked = fetch(LISTS_API + encodeURIComponent(id), { headers: { accept: 'application/json' }, credentials: 'same-origin' })
      .then(function (res) {
        if (res.status === 404) return false;
        return res.ok ? res.json().then(function (out) { return (out && out.list) || null; }) : null;
      })
      .catch(function () { return null; });
    state.lists[id] = Promise.all([asked, loadPlaces()]).then(function (got) {
      state.lists[id] = got[0];
      return got[0];
    });
    return state.lists[id];
  }

  /* The list as it stands: drawn now when it has been read, and otherwise a
     row of empty cards the height of the real ones, swapped for the list
     when it arrives — so the words under it do not jump — as long as the
     post is still the one on screen. */
  function listBlock(id, post, title) {
    var got = state.lists[id];
    if (got === false) return null;
    if (got === null) return listRow(id, title);
    if (got && typeof got.then !== 'function') return listStrip(got, post);

    var waiting = el('section', { className: 'blog-list is-waiting', 'aria-busy': 'true' }, [
      el('div', { className: 'blog-list-head' }, [
        el('span', { className: 'blog-list-title', textContent: title || '\u00a0' })
      ]),
      el('ol', { className: 'blog-list-strip' }, [0, 1, 2].map(function () {
        return el('li', { className: 'blog-list-card' }, [el('span', { className: 'blog-list-box' })]);
      }))
    ]);
    loadList(id).then(function () {
      if (!waiting.parentNode) return;
      var now = listBlock(id, post, title);
      if (now) waiting.parentNode.replaceChild(now, waiting);
      else waiting.parentNode.removeChild(waiting);
    });
    return waiting;
  }

  /* A list that would not answer: the way to it, in the shape a place card
     is, rather than nothing — the post said there was a list here. */
  function listRow(id, title) {
    return el('div', { className: 'blog-place' }, [
      el('a', { className: 'menu-row', href: '/list/' + encodeURIComponent(id) }, [
        el('span', { className: 'menu-say' }, [
          el('span', { className: 'menu-name', textContent: title || t('blogListAll') })
        ]),
        chevron()
      ])
    ]);
  }

  /* Where a card goes: the list on the map with that place open on it, which
     is where a row on the list's own page goes — placeHref() in
     assets/lists.js, whose rule this restates, including that a place with
     nowhere to draw goes nowhere. */
  function listPlaceHref(list, item) {
    if (!item.map && (typeof item.lat !== 'number' || typeof item.lng !== 'number')) return '';
    return '/?list=' + encodeURIComponent(list.id) + '&at=' + encodeURIComponent(item.mapId || item.place);
  }

  /* The list's places side by side, to swipe through: its title and whose it
     is over them, a card a place — the first photograph where the place is
     one of mine and has one, its name set large where not, then where it
     stands on the list, its name and the line the list's owner wrote — and a
     last card going to the whole list. The row scrolls sideways and snaps,
     which is also what keeps assets/back.js from reading a swipe across it
     as Back. On a screen with a pointer, two .alt arrows over the row do
     what a thumb does; nothing moves unless one of them is pressed. */
  function listStrip(list, post) {
    var items = list.items || [];
    var listHref = '/list/' + encodeURIComponent(list.id);

    var cards = items.map(function (item, i) {
      var mine = state.places && state.places[item.mapId || item.place];
      var photo = mine && mine.photos && mine.photos.length
        ? '/photos/' + encodeURIComponent(mine.id) + '/' + encodeURIComponent(mine.photos[0]) : '';
      var href = listPlaceHref(list, item);
      var inside = [
        photo
          ? el('img', { className: 'blog-list-box', src: photo, alt: '', loading: 'lazy', decoding: 'async' })
          : el('span', { className: 'blog-list-box blog-list-blank', 'aria-hidden': 'true', textContent: item.name }),
        el('span', { className: 'blog-list-say' }, [
          el('span', { className: 'eyebrow', textContent: t('blogListOf', { n: i + 1, total: items.length }) }),
          el('span', { className: 'blog-list-name', textContent: item.name }),
          item.say || item.address
            ? el('span', { className: 'blog-list-line', textContent: item.say || item.address }) : null
        ])
      ];
      var card = href
        ? TTBTrack.click(el('a', { className: 'blog-list-go', href: href }, inside),
            'blog_list_place', { post: post.id, list: list.id, place: item.mapId || item.place })
        : el('div', { className: 'blog-list-go' }, inside);
      return el('li', { className: 'blog-list-card' }, [card]);
    });
    cards.push(el('li', { className: 'blog-list-card blog-list-end' }, [
      TTBTrack.click(el('a', { className: 'blog-list-go', href: listHref }, [
        el('span', { className: 'menu-name', textContent: t('blogListAll') }),
        chevron()
      ]), 'blog_list_open', { post: post.id, list: list.id })
    ]));

    var strip = el('ol', { className: 'blog-list-strip', 'aria-label': list.title }, cards);
    var back = el('button', { type: 'button', className: 'alt', 'aria-label': t('blogListPrev'), textContent: '\u2039' });
    var on = el('button', { type: 'button', className: 'alt', 'aria-label': t('blogListNext'), textContent: '\u203a' });

    /* One card's width and the gap after it, either way; smoothly unless
       the reader's machine asked for less motion. */
    var step = function (way) {
      var first = strip.firstChild;
      var width = first ? first.getBoundingClientRect().width + 12 : strip.clientWidth;
      var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      strip.scrollBy({ left: way * width, behavior: still ? 'auto' : 'smooth' });
    };
    var ends = function () {
      back.disabled = strip.scrollLeft <= 1;
      on.disabled = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1;
    };
    back.addEventListener('click', function () { step(-1); });
    on.addEventListener('click', function () { step(1); });
    strip.addEventListener('scroll', ends, { passive: true });
    window.setTimeout(ends, 0);

    return el('section', { className: 'blog-list' }, [
      el('div', { className: 'blog-list-head' }, [
        el('span', { className: 'blog-list-about' }, [
          TTBTrack.click(el('a', { className: 'blog-list-title', href: listHref, textContent: list.title }),
            'blog_list_open', { post: post.id, list: list.id }),
          list.by ? el('span', { className: 'blog-list-by', textContent: t('blogBy', { name: list.by }) }) : null
        ]),
        el('span', { className: 'blog-list-step' }, [back, on])
      ]),
      strip
    ]);
  }

  function blocks(list, post) {
    return (list || []).map(function (b) {
      if (b.k === 'p') return el('p', {}, runs(b.r, post));
      if (b.k === 'h2') return el('h2', {}, runs(b.r, post));
      if (b.k === 'h3') return el('h3', {}, runs(b.r, post));
      if (b.k === 'quote') return el('blockquote', {}, [el('p', {}, runs(b.r, post))]);
      if (b.k === 'ul' || b.k === 'ol') {
        return el(b.k, {}, b.li.map(function (item) { return el('li', {}, runs(item, post)); }));
      }
      if (b.k === 'hr') return el('hr');
      if (b.k === 'place') return placeBlock(b.id);
      if (b.k === 'list') return listBlock(b.id, post, '');
      return null;
    });
  }

  /* The languages it is written in, as a segment, when it is more than one. */
  function readPills(post) {
    var codes = Object.keys(post.texts);
    if (codes.length < 2) return null;
    var seg = el('div', { className: 'lists-seg blog-langs', role: 'group', 'aria-label': t('blogReadIn') });
    codes.forEach(function (code) {
      var on = code === state.readIn;
      var b = el('button', { type: 'button', className: 'lists-seg-opt' + (on ? ' is-on' : ''),
        'aria-pressed': on ? 'true' : 'false', lang: code, textContent: state.names[code] || code });
      b.addEventListener('click', function () {
        state.readIn = code;
        TTBTrack.event('blog_read_in', { lang: code });
        render();
      });
      seg.appendChild(b);
    });
    return seg;
  }

  function renderMember(post) {
    var text = memberText(post);
    var own = !!post.texts[state.lang];
    return [
      el('p', { className: 'blog-crumb' }, [TTBTrack.click(
        walks(el('a', { className: 'alt', href: PAGE, textContent: t('blogAll') }), null),
        'blog_all'
      )]),
      el('article', { className: 'card lists-card blog-post', lang: state.readIn }, [
        memberWhen(post),
        byline(post),
        el('h1', { className: 'blog-title', textContent: text.title }),
        text.standfirst ? el('p', { className: 'blog-lead', textContent: text.standfirst }) : null,
        post.status !== 'published' ? el('p', { className: 'blog-note', textContent: t('blogDraft') }) : null,
        own ? null : el('p', { className: 'blog-note', textContent: t('blogNotYours') }),
        readPills(post),
        el('div', { className: 'blog-body' }, blocks(text.body, post)),
        el('p', { className: 'lists-row blog-after' }, [
          TTBTrack.click(el('a', { className: 'go', href: byHref(post.author),
            textContent: t('blogMoreBy', { name: post.author }) }), 'blog_more_by', { name: post.author }),
          post.mine ? TTBTrack.click(el('a', { className: 'alt', href: '/write?post=' + encodeURIComponent(post.id),
            textContent: t('blogEdit') }), 'blog_edit') : null
        ])
      ])
    ];
  }

  /* ?by=<name>: one person's posts, a page at a time, under their name. */
  function renderAuthor(author) {
    return [
      el('p', { className: 'blog-crumb' }, [TTBTrack.click(
        walks(el('a', { className: 'alt', href: PAGE, textContent: t('blogAll') }), null),
        'blog_all'
      )]),
      el('header', { className: 'blog-head' }, [
        el('p', { className: 'eyebrow', textContent: t('blogTitle') }),
        el('h1', { className: 'blog-title', textContent: t('blogByTitle', { name: author.name }) }),
        el('p', { className: 'blog-lead' }, [
          TTBTrack.click(el('a', { className: 'alt', href: '/u/' + encodeURIComponent(author.name),
            textContent: t('profileEyebrow') }), 'blog_author', { name: author.name })
        ])
      ]),
      author.posts.length
        ? memberCard(author, function () {
            return loadMembers(author, '&by=' + encodeURIComponent(author.name)).then(render);
          })
        : el('p', { className: 'lists-none', textContent: t('blogByNone', { name: author.name }) })
    ];
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

    var words = getJSON(LANGS_URL).then(function (names) {
      var lang = pickLanguage(Object.keys(names));
      return getJSON(LANG_URL + lang + '.json').then(function (pack) {
        return { lang: lang, ui: pack.ui, names: names };
      });
    });

    Promise.all([words, getJSON(POSTS_URL), loadMembers(state.members, '')]).then(function (answers) {
      state.ui = answers[0].ui;
      state.lang = answers[0].lang;
      state.names = answers[0].names;
      applyStaticStrings();

      /* Newest first, and sorted here rather than trusted from the file: the
         dates are written by hand, and a post added to the end of the array
         is the ordinary way one arrives. */
      state.posts = answers[1].slice().sort(function (a, b) {
        return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
      });

      return readUrl().then(function () {
        render();
        /* The tag counted this address as the document loaded, post and all, so
           only the walks from here are ours to report. */
        TTBTrack.seen();
        mountRadio();
      });
    }).catch(function (err) {
      /* Whatever went wrong, the reader gets a sentence rather than an empty
         page. In English and written out rather than through t(), because the
         thing that failed may well be the words — and t() with no strings in
         it returns the key, which is a visitor reading "loadError" off the
         page. Same last resort the lists and the directory fall back on. */
      clear(main);
      main.appendChild(el('div', { className: 'lists-stack' }, [
        el('div', { className: 'card lists-card' }, [
          el('p', { className: 'blog-lead',
            textContent: 'Something went wrong loading the data. Try refreshing the page.' })
        ])
      ]));
      if (window.console && window.console.error) window.console.error(err);
    });

    window.addEventListener('popstate', function () {
      readUrl().then(function () {
        render();
        TTBTrack.view(document.title);
      });
    });
  }

  boot();
})();
