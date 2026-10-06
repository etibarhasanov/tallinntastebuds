/* Tallinn Tastebuds — /write, where a member writes for the blog.
 *
 * Two states in the one <main>, decided by ?post=: without it, your posts —
 * drafts and published, newest first, a page at a time — and the button that
 * starts another; with it, one post open in the editor (?post=new for one
 * that has never been saved). Signed out, the page says what it is and
 * offers the two ways in, the way /edit does.
 *
 * THE EDITOR IS A PAGE OF THE POST
 *
 * The box is a contenteditable set in the blog's own type — assets/blog.css
 * is loaded here for that — so what the writer looks at while they type is
 * what a reader will look at: the heading is the post's heading, a quote is
 * the post's quote. The toolbar over it is the handful of things a post may
 * hold and nothing else: text, two sizes of heading, bold, italic, a link,
 * two kinds of list, a quote, a divider, and a place on the map, which draws
 * as a card a reader can press. That last one is what this blog has that
 * another does not, and it is what "my ten places" is made of.
 *
 * WHAT IS SENT IS BLOCKS, NEVER THE BOX'S HTML
 *
 * A contenteditable holds whatever markup the browser chose, and whatever a
 * pasted document brought with it — Google Docs wraps a whole paste in a
 * <b> that is not bold. readBox() walks the box and keeps what it
 * recognises as one of the blocks functions/api/_posts.js describes; the
 * route keeps only those again. A paste goes through the same walk before it
 * lands, so pasting from a document keeps its headings, lists, bold and links
 * and loses its fonts, colours and pictures.
 *
 * LANGUAGES
 *
 * A post is written in one language first and may be written again in any
 * of the site's other nine, each a tab over the fields. The reader gets
 * their own where it exists and the first one where it does not; the blog
 * says so in their language. There is no machine translation here, on the
 * argument **A post is not held to the ten languages** under **The blog** in
 * README.md makes: a translation is somebody's writing, or it is not there.
 *
 * THE CAPS
 *
 * MAX_TITLE, MAX_LEAD and MAX_BODY are functions/api/_posts.js's, restated so
 * the counters can count; the server's are the ones that bind.
 *
 * Plain browser JavaScript, ES5, one IIFE, like every file in assets/.
 */
(function () {
  'use strict';

  var MAX_TITLE = 120;
  var MAX_LEAD = 280;
  var MAX_BODY = 20000;

  var API = '/api/posts';
  var ACCOUNT_API = '/api/account';
  var LANGS_URL = '/data/lang/index.json';
  var LANG_URL = '/data/lang/';
  var MAP_URL = '/data/map.json';
  var PAGE = '/write';

  var DEFAULT_LANG = 'en';
  var LANG_KEY = 'ttb.lang';
  var STYLES = ['red', 'green', 'blue', 'plum'];
  var DEFAULT_STYLE = 'red';
  var STYLE_KEY = 'ttb.style';

  /* Into the map's account sheet and back here, as /edit does it. */
  var SHEET = '/?account=';
  var BACK = '&then=%2Fwrite';

  var state = {
    ui: {},
    lang: DEFAULT_LANG,
    names: {},       // every language the site has, code → its own name
    reached: true,
    ready: true,
    user: null,
    mine: { posts: [], next: null, loading: false },
    post: null,      // the one open: { id, lang, status, texts, tab }
    missing: false,  // ?post= named nothing of yours
    dirty: false,
    busy: false,
    places: null     // the map's places, fetched the first time the picker opens
  };

  var main = null;
  var toastTimer = null;
  var box = null;        // the contenteditable of the open tab
  var fields = null;     // { title, lead, counts… } of the open tab
  var kept = null;       // the selection, held while a panel has the focus

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
        else if (k === 'value') node.value = v;
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

  /* An answer and its status, whatever the status: every failure on this page
     is a sentence, and the sentence depends on which. */
  function ask(url, body) {
    var init = { headers: { accept: 'application/json' }, credentials: 'same-origin' };
    if (body) {
      init.method = 'POST';
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    return fetch(url, init).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (out) {
        return { status: res.status, out: out || {} };
      });
    }).catch(function () { return { status: 0, out: {} }; });
  }

  function toast(message) {
    var node = document.getElementById('toast');
    node.textContent = message;
    node.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.hidden = true; }, 3800);
  }

  function applyStyle() {
    var fromUrl = new URLSearchParams(window.location.search).get('style');
    var stored = storeGet(STYLE_KEY);
    var style = STYLES.indexOf(fromUrl) !== -1 ? fromUrl
              : STYLES.indexOf(stored) !== -1 ? stored
              : DEFAULT_STYLE;
    document.documentElement.setAttribute('data-style', style);
    document.documentElement.style.colorScheme =
      getComputedStyle(document.documentElement).colorScheme === 'dark' ? 'dark' : 'light';
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
  }

  /* "9 August 2026" in the reading language, for the rows. The blog's
     formatDate() has the long argument for Intl and its one known lie; a
     row on your own desk can live with Intl's answer as it stands. */
  function formatDate(ms) {
    try {
      return new Intl.DateTimeFormat(state.lang === 'en' ? 'en-GB' : state.lang,
        { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ms));
    } catch (e) {
      return new Date(ms).toISOString().slice(0, 10);
    }
  }

  /* --------------------------------------------------------- box → blocks
   *
   * The walk that turns whatever is in the box into the blocks a post is
   * made of — see the head of this file and of functions/api/_posts.js. It
   * reads block-level elements as blocks and everything inline as runs, and
   * an inline element that turns out to hold blocks (Google Docs' <b>, a
   * <span> round a paste) as a container rather than as a paragraph.
   */
  var BLOCKS = /^(P|DIV|H1|H2|H3|H4|H5|H6|BLOCKQUOTE|UL|OL|LI|HR|TABLE|TBODY|THEAD|TR|SECTION|ARTICLE|HEADER|FOOTER|MAIN|ASIDE|FIGURE|PRE|DL|DT|DD)$/;
  var SKIP = /^(SCRIPT|STYLE|IMG|PICTURE|VIDEO|AUDIO|IFRAME|OBJECT|EMBED|SVG|CANVAS|BUTTON|INPUT|SELECT|TEXTAREA|META|LINK|TEMPLATE|NOSCRIPT)$/;

  function isBlock(node) { return node.nodeType === 1 && BLOCKS.test(node.nodeName); }

  function holdsBlocks(node) {
    for (var c = node.firstChild; c; c = c.nextSibling) {
      if (isBlock(c) || (c.nodeType === 1 && holdsBlocks(c))) return true;
    }
    return false;
  }

  /* Whether an element makes its words bold or italic. Google Docs writes
     both as inline styles on spans, and its outer <b> says
     font-weight:normal. */
  function boldOf(node) {
    var w = node.style && node.style.fontWeight;
    if (w) return w === 'bold' || w === 'bolder' || Number(w) >= 600;
    return node.nodeName === 'B' || node.nodeName === 'STRONG';
  }
  function italicOf(node) {
    var s = node.style && node.style.fontStyle;
    if (s) return s === 'italic' || s === 'oblique';
    return node.nodeName === 'I' || node.nodeName === 'EM';
  }

  /* The runs of everything inside `node`. */
  function runsIn(node, marks, out) {
    for (var c = node.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) {
        var text = c.nodeValue.replace(/[\r\n\t]+/g, ' ');
        if (text) out.push({ t: text, b: marks.b, i: marks.i, a: marks.a });
      } else if (c.nodeType === 1) {
        if (SKIP.test(c.nodeName)) continue;
        if (c.nodeName === 'BR') { out.push({ t: '\n', b: marks.b, i: marks.i, a: marks.a }); continue; }
        var href = c.nodeName === 'A' ? c.getAttribute('href') : null;
        runsIn(c, {
          b: boldOf(c) ? 1 : (c.style && c.style.fontWeight ? 0 : marks.b),
          i: italicOf(c) ? 1 : (c.style && c.style.fontStyle ? 0 : marks.i),
          a: href ? linkOf(href) : marks.a
        }, out);
      }
    }
    return out;
  }

  /* Runs as the route wants them: adjacent runs dressed alike as one, a
     trailing break (every browser leaves one in an empty paragraph) gone. */
  function tidy(runs) {
    var out = [];
    runs.forEach(function (r) {
      var last = out[out.length - 1];
      var kept = { t: r.t };
      if (r.b) kept.b = 1;
      if (r.i) kept.i = 1;
      if (r.a) kept.a = r.a;
      if (last && !!last.b === !!kept.b && !!last.i === !!kept.i && (last.a || '') === (kept.a || '')) last.t += kept.t;
      else out.push(kept);
    });
    if (out.length) {
      out[0].t = out[0].t.replace(/^\s+/, '');
      out[out.length - 1].t = out[out.length - 1].t.replace(/\s+$/, '');
    }
    return out.filter(function (r) { return r.t; });
  }

  /* A link as the route will keep it — a path on this site or an http(s)
     address — or nothing. The same rule as cleanHref() in
     functions/api/_posts.js; a link that would be dropped there is dropped
     here, so the writer sees it go. */
  function linkOf(raw) {
    var href = String(raw || '').trim();
    if (/^\/(?!\/)\S*$/.test(href)) return href;
    if (/^https?:\/\/[^\s/]+\S*$/i.test(href)) return href;
    /* An address on this site, pasted whole, is kept as its path. */
    try {
      var url = new URL(href, window.location.href);
      if (url.origin === window.location.origin) return url.pathname + url.search + url.hash;
    } catch (e) { /* not an address */ }
    return '';
  }

  function readBox(root) {
    var blocks = [];
    var loose = [];

    function flush() {
      if (!loose.length) return;
      var runs = [];
      loose.forEach(function (n) {
        if (n.nodeType === 3) runs.push({ t: n.nodeValue.replace(/[\r\n\t]+/g, ' ') });
        else {
          var wrap = document.createElement('span');
          wrap.appendChild(n.cloneNode(true));
          runsIn(wrap, { b: 0, i: 0, a: '' }, runs);
        }
      });
      loose = [];
      push('p', tidy(runs));
    }

    function push(k, runs) { if (runs.length) blocks.push({ k: k, r: runs }); }

    function list(node) {
      var items = [];
      for (var c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType !== 1) continue;
        if (c.nodeName === 'LI') {
          /* A list inside an item comes out as items after it: two levels
             are one more than a post needs, and losing the words would be
             worse than losing the indent. */
          var own = c.cloneNode(true);
          var nested = own.querySelectorAll('ul, ol');
          for (var i = 0; i < nested.length; i++) nested[i].parentNode.removeChild(nested[i]);
          var runs = tidy(runsIn(own, { b: 0, i: 0, a: '' }, []));
          if (runs.length) items.push(runs);
          var deeper = c.querySelectorAll('li');
          for (var j = 0; j < deeper.length; j++) {
            var r = tidy(runsIn(deeper[j], { b: 0, i: 0, a: '' }, []));
            if (r.length) items.push(r);
          }
        } else if (c.nodeName === 'UL' || c.nodeName === 'OL') {
          list(c).forEach(function (r) { items.push(r); });
        }
      }
      return items;
    }

    function walk(node) {
      for (var c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) { if (/\S/.test(c.nodeValue) || loose.length) loose.push(c); continue; }
        if (c.nodeType !== 1 || SKIP.test(c.nodeName)) continue;

        var place = c.getAttribute('data-place');
        if (place) { flush(); blocks.push({ k: 'place', id: place }); continue; }

        if (!isBlock(c)) {
          if (c.nodeName === 'BR') { flush(); continue; }
          if (holdsBlocks(c)) { flush(); walk(c); continue; }
          loose.push(c);
          continue;
        }

        flush();
        var name = c.nodeName;
        if (name === 'HR') { blocks.push({ k: 'hr' }); continue; }
        if (name === 'UL' || name === 'OL') {
          var items = list(c);
          if (items.length) blocks.push({ k: name.toLowerCase(), li: items });
          continue;
        }
        if (name === 'BLOCKQUOTE') {
          push('quote', tidy(runsIn(c, { b: 0, i: 0, a: '' }, [])));
          continue;
        }
        if (/^H[1-6]$/.test(name)) {
          push(name === 'H1' || name === 'H2' ? 'h2' : 'h3', tidy(runsIn(c, { b: 0, i: 0, a: '' }, [])));
          continue;
        }
        if (holdsBlocks(c)) { walk(c); continue; }
        push('p', tidy(runsIn(c, { b: 0, i: 0, a: '' }, [])));
      }
      flush();
    }

    walk(root);
    return blocks;
  }

  function charsOf(blocks) {
    var n = 0;
    blocks.forEach(function (b) {
      (b.r || []).forEach(function (r) { n += r.t.length; });
      (b.li || []).forEach(function (item) { item.forEach(function (r) { n += r.t.length; }); });
    });
    return n;
  }

  /* --------------------------------------------------------- blocks → box */

  function runNodes(runs) {
    return runs.map(function (r) {
      var parts = r.t.split('\n');
      var node = document.createDocumentFragment();
      parts.forEach(function (part, i) {
        if (i) node.appendChild(el('br'));
        if (part) node.appendChild(document.createTextNode(part));
      });
      if (r.b) node = el('strong', {}, [node]);
      if (r.i) node = el('em', {}, [node]);
      if (r.a) node = el('a', { href: r.a }, [node]);
      return node;
    });
  }

  function placeCard(id) {
    var p = placeById(id);
    return el('div', { className: 'write-place', contenteditable: 'false', 'data-place': id }, [
      el('span', { className: 'write-place-name', textContent: p ? p.name : id }),
      p && p.address ? el('span', { className: 'write-place-where', textContent: p.address }) : null
    ]);
  }

  function blockNode(b) {
    if (b.k === 'hr') return el('hr');
    if (b.k === 'place') return placeCard(b.id);
    if (b.k === 'ul' || b.k === 'ol') {
      return el(b.k, {}, b.li.map(function (item) { return el('li', {}, runNodes(item)); }));
    }
    var tag = b.k === 'quote' ? 'blockquote' : b.k;
    return el(tag, {}, runNodes(b.r));
  }

  function fillBox(node, blocks) {
    clear(node);
    blocks.forEach(function (b) { node.appendChild(blockNode(b)); });
    if (!blocks.length || blocks[blocks.length - 1].k === 'place' || blocks[blocks.length - 1].k === 'hr') {
      node.appendChild(el('p', {}, [el('br')]));
    }
  }

  /* ------------------------------------------------------------ the places */

  function placeById(id) {
    var list = state.places || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function loadPlaces() {
    if (state.places) return Promise.resolve(state.places);
    return getJSON(MAP_URL).then(function (list) {
      state.places = (list || []).filter(function (p) { return p && p.id && !p.closed; });
      return state.places;
    }).catch(function () { return []; });
  }

  /* Folded the way the map's find bar folds: Põhjala is found by pohjala. */
  function fold(s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  }

  /* -------------------------------------------------------------- the list */

  function loadMine(more) {
    state.mine.loading = true;
    var url = API + '?mine=1' + (more && state.mine.next ? '&before=' + encodeURIComponent(state.mine.next) : '');
    return ask(url).then(function (got) {
      state.mine.loading = false;
      if (got.status !== 200) return;
      var posts = got.out.posts || [];
      state.mine.posts = more ? state.mine.posts.concat(posts) : posts;
      state.mine.next = got.out.next || null;
    });
  }

  function titleOf(post) {
    var text = post.texts[state.lang] || post.texts[post.lang] || {};
    return text.title || '';
  }

  function renderList() {
    var rows = state.mine.posts.map(function (post) {
      var draft = post.status !== 'published';
      return el('li', { className: 'menu-item' }, [
        el('a', { className: 'menu-row', href: PAGE + '?post=' + encodeURIComponent(post.id) }, [
          el('span', { className: 'menu-say' }, [
            el('span', { className: 'eyebrow blog-when' }, [
              formatDate(post.at),
              el('span', { className: 'write-state' + (draft ? ' is-draft' : ''),
                textContent: t(draft ? 'writeDraft' : 'writePublished') })
            ]),
            el('span', { className: 'menu-name', textContent: titleOf(post) }),
            el('span', { className: 'menu-why', textContent: Object.keys(post.texts).map(function (c) {
              return state.names[c] || c;
            }).join(' · ') })
          ]),
          el('span', { className: 'menu-go', 'aria-hidden': 'true',
            html: '<svg viewBox="0 0 24 24" focusable="false"><path d="M9 5l7 7-7 7"/></svg>' })
        ])
      ]);
    });

    var more = null;
    if (state.mine.next) {
      more = el('button', { type: 'button', className: 'alt', textContent: t('blogMore') });
      more.addEventListener('click', function () {
        more.disabled = true;
        loadMine(true).then(render);
      });
    }

    var start = TTBTrack.click(el('a', { className: 'go', href: PAGE + '?post=new', textContent: t('writeNew') }), 'write_new');

    return [
      el('section', { className: 'card lists-card' }, [
        el('p', { className: 'eyebrow', textContent: t('accountOpen') }),
        el('h1', { className: 'lists-title', textContent: t('writeTitle') }),
        el('p', { className: 'lists-say', textContent: t('writeLead') }),
        el('p', { className: 'lists-row lists-foot' }, [
          start,
          /* Your blog as everybody reads it — every post you published, under
             your name, ten at a time — and your profile, where they are listed
             under your lists. */
          TTBTrack.click(el('a', { className: 'alt', href: '/blog?by=' + encodeURIComponent(state.user), textContent: t('writeYourBlog') }), 'write_blog_mine'),
          TTBTrack.click(el('a', { className: 'alt', href: '/u/' + encodeURIComponent(state.user), textContent: t('profileYours') }), 'profile_open', { name: state.user })
        ])
      ]),
      rows.length
        ? el('div', { className: 'card lists-card' }, [el('ul', { className: 'menu blog-posts' }, rows), more])
        : el('p', { className: 'lists-none', textContent: t('writeNone') })
    ];
  }

  /* ------------------------------------------------------------ the editor */

  function blankText() { return { title: '', standfirst: '', body: [] }; }

  /* What is in the fields of the open tab, back into state.post. Called
     before anything reads state.post: a tab switch, a save. */
  function keep() {
    if (!state.post || !fields) return;
    var text = state.post.texts[state.post.tab];
    text.title = fields.title.value;
    text.standfirst = fields.lead.value;
    text.body = readBox(box);
  }

  function counter(n, max) {
    return t('writeCount', { n: n.toLocaleString(), max: max.toLocaleString() });
  }

  function recount() {
    if (!fields) return;
    var chars = charsOf(readBox(box));
    fields.bodyCount.textContent = counter(chars, MAX_BODY);
    fields.bodyCount.classList.toggle('is-over', chars > MAX_BODY);
    fields.titleCount.textContent = counter(fields.title.value.length, MAX_TITLE);
    fields.leadCount.textContent = counter(fields.lead.value.length, MAX_LEAD);
  }

  function touched() {
    state.dirty = true;
    recount();
  }

  /* The tabs: one per language the post is written in, the first one first,
     and a menu of the rest to add another. */
  function tabs() {
    var post = state.post;
    var codes = Object.keys(post.texts).sort(function (a, b) {
      return a === post.lang ? -1 : b === post.lang ? 1 : 0;
    });

    var seg = el('div', { className: 'lists-seg write-tabs', role: 'tablist', 'aria-label': t('writeLanguages') });
    codes.forEach(function (code) {
      var on = code === post.tab;
      var b = el('button', { type: 'button', role: 'tab', 'aria-selected': on ? 'true' : 'false',
        className: 'lists-seg-opt' + (on ? ' is-on' : ''), textContent: state.names[code] || code });
      b.addEventListener('click', function () {
        if (code === post.tab) return;
        keep();
        post.tab = code;
        render();
      });
      seg.appendChild(b);
    });

    var rest = Object.keys(state.names).filter(function (c) { return !post.texts[c]; });
    var add = null;
    if (rest.length) {
      add = el('select', { className: 'lists-input write-add', 'aria-label': t('writeAddLang') }, [
        el('option', { value: '', textContent: t('writeAddLang') })
      ].concat(rest.map(function (c) { return el('option', { value: c, textContent: state.names[c] }); })));
      add.addEventListener('change', function () {
        if (!add.value) return;
        keep();
        post.texts[add.value] = blankText();
        post.tab = add.value;
        state.dirty = true;
        TTBTrack.event('write_language', { lang: add.value });
        render();
      });
    }

    return el('div', { className: 'write-langs' }, [
      el('span', { className: 'ed-label', textContent: t('writeLanguages') }),
      el('div', { className: 'write-langs-row' }, [seg, add])
    ]);
  }

  /* The toolbar: each button keeps the box's selection, does one thing to it,
     and gives the focus back. execCommand is deprecated and is still the one
     way every browser offers to edit a contenteditable with its own undo
     intact; what it writes is read back by readBox() either way. */
  var TOOLS = [
    { id: 'p', key: 'writeToolText', label: '¶', block: 'P' },
    { id: 'h2', key: 'writeToolH2', label: 'H2', block: 'H2' },
    { id: 'h3', key: 'writeToolH3', label: 'H3', block: 'H3' },
    { id: 'b', key: 'writeToolBold', label: 'B', cmd: 'bold' },
    { id: 'i', key: 'writeToolItalic', label: 'I', cmd: 'italic' },
    { id: 'a', key: 'writeToolLink', label: '', panel: 'link',
      svg: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>' },
    { id: 'ul', key: 'writeToolList', label: '', cmd: 'insertUnorderedList',
      svg: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="18" r="1.2"/>' },
    { id: 'ol', key: 'writeToolNumbered', label: '', cmd: 'insertOrderedList',
      svg: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 4.5h1.5V9M3.5 9h3M3.5 14.5c.4-.6 1-.9 1.6-.9.8 0 1.4.5 1.4 1.2 0 1.3-3 2.2-3 3.7h3"/>' },
    { id: 'quote', key: 'writeToolQuote', label: '', block: 'BLOCKQUOTE',
      svg: '<path d="M7 7h4v4c0 3-1.5 5-4 6M14 7h4v4c0 3-1.5 5-4 6"/>' },
    { id: 'hr', key: 'writeToolLine', label: '', cmd: 'insertHorizontalRule',
      svg: '<path d="M3 12h18"/>' },
    { id: 'place', key: 'writeToolPlace', label: '', panel: 'place',
      svg: '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>' }
  ];

  function holdSelection() {
    var sel = window.getSelection();
    if (sel && sel.rangeCount && box.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      kept = sel.getRangeAt(0).cloneRange();
    }
  }

  function restoreSelection() {
    box.focus();
    if (!kept) return;
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(kept);
  }

  function toolbar(panel) {
    var bar = el('div', { className: 'write-tools', role: 'toolbar', 'aria-label': t('writeTools') });
    TOOLS.forEach(function (tool) {
      var b = el('button', {
        type: 'button',
        className: 'write-tool write-tool-' + tool.id,
        title: t(tool.key),
        'aria-label': t(tool.key),
        html: tool.svg
          ? '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + tool.svg + '</svg>'
          : '<span aria-hidden="true">' + tool.label + '</span>'
      });
      /* mousedown, not click: by click time the button has the focus and the
         selection it was meant for is gone. */
      b.addEventListener('mousedown', function (e) { e.preventDefault(); });
      b.addEventListener('click', function () {
        if (tool.panel) { holdSelection(); openPanel(panel, tool.panel); return; }
        box.focus();
        if (tool.block) document.execCommand('formatBlock', false, '<' + tool.block + '>');
        else document.execCommand(tool.cmd, false, null);
        touched();
      });
      bar.appendChild(b);
    });
    return bar;
  }

  /* The one panel under the toolbar, holding either the link field or the
     place picker. A panel rather than window.prompt(): the prompt cannot be
     styled, cannot be translated past its message, and on a phone it is a
     second keyboard over the first. */
  function openPanel(panel, kind) {
    clear(panel);
    panel.hidden = false;

    var close = el('button', { type: 'button', className: 'alt', textContent: t('writeCancel') });
    close.addEventListener('click', function () { panel.hidden = true; restoreSelection(); });

    if (kind === 'link') {
      var current = '';
      var node = kept && kept.commonAncestorContainer;
      while (node && node !== box) {
        if (node.nodeName === 'A') { current = node.getAttribute('href') || ''; break; }
        node = node.parentNode;
      }
      var input = el('input', { type: 'url', className: 'lists-input', placeholder: 'https://', value: current,
        'aria-label': t('writeLinkAsk') });
      var add = el('button', { type: 'button', className: 'go', textContent: t('writeLinkAdd') });
      var off = el('button', { type: 'button', className: 'alt', textContent: t('writeLinkRemove') });
      var go = function () {
        var href = linkOf(input.value);
        if (!href) { input.focus(); return; }
        panel.hidden = true;
        restoreSelection();
        if (kept && kept.collapsed) {
          document.execCommand('insertHTML', false, '<a href="' + href.replace(/"/g, '&quot;') + '">' +
            href.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</a>');
        } else {
          document.execCommand('createLink', false, href);
        }
        touched();
      };
      add.addEventListener('click', go);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      off.addEventListener('click', function () {
        panel.hidden = true;
        restoreSelection();
        document.execCommand('unlink', false, null);
        touched();
      });
      panel.appendChild(el('label', { className: 'ed-field' }, [
        el('span', { className: 'ed-label', textContent: t('writeLinkAsk') }), input
      ]));
      panel.appendChild(el('p', { className: 'lists-row' }, [add, current ? off : null, close]));
      input.focus();
      return;
    }

    var find = el('input', { type: 'search', className: 'lists-input', placeholder: t('writePlaceSearch'),
      'aria-label': t('writePlaceSearch') });
    var list = el('ul', { className: 'menu write-found' });
    var draw = function () {
      clear(list);
      var q = fold(find.value.trim());
      var hits = (state.places || []).filter(function (p) {
        return !q || fold(p.name).indexOf(q) !== -1 || fold(p.address).indexOf(q) !== -1;
      }).slice(0, 8);
      if (!hits.length) {
        list.appendChild(el('li', { className: 'lists-none', textContent: t('writePlaceNone') }));
        return;
      }
      hits.forEach(function (p) {
        var b = el('button', { type: 'button', className: 'menu-row' }, [
          el('span', { className: 'menu-say' }, [
            el('span', { className: 'menu-name', textContent: p.name }),
            el('span', { className: 'menu-why', textContent: p.address || '' })
          ])
        ]);
        b.addEventListener('click', function () {
          panel.hidden = true;
          insertPlace(p.id);
        });
        list.appendChild(el('li', { className: 'menu-item' }, [b]));
      });
    };
    find.addEventListener('input', draw);
    panel.appendChild(find);
    panel.appendChild(list);
    panel.appendChild(el('p', { className: 'lists-row' }, [close]));
    loadPlaces().then(draw);
    find.focus();
  }

  /* A place goes in as a block of its own after the paragraph the caret is
     in, never inside it: a card in the middle of a sentence is not a thing a
     post can hold, and readBox() would split the sentence round it. */
  function insertPlace(id) {
    restoreSelection();
    var at = kept ? kept.startContainer : null;
    while (at && at.parentNode !== box) at = at.parentNode;
    var card = placeCard(id);
    var after = el('p', {}, [el('br')]);
    if (at && at.parentNode === box) {
      box.insertBefore(card, at.nextSibling);
    } else {
      box.appendChild(card);
    }
    box.insertBefore(after, card.nextSibling);
    var range = document.createRange();
    range.setStart(after, 0);
    range.collapse(true);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    TTBTrack.event('write_place', { place: id });
    touched();
  }

  /* A paste is read the way the box is read — through readBox() — and only
     what that keeps goes in. */
  function onPaste(e) {
    var data = e.clipboardData;
    if (!data) return;
    e.preventDefault();
    var html = data.getData('text/html');
    var blocks;
    if (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      blocks = readBox(doc.body);
    } else {
      blocks = String(data.getData('text/plain') || '').split(/\r?\n\s*\r?\n|\r?\n/).filter(function (line) {
        return /\S/.test(line);
      }).map(function (line) { return { k: 'p', r: [{ t: line }] }; });
    }
    if (!blocks.length) return;
    var holder = el('div');
    /* One paragraph of plain words goes in as words, so pasting a phrase into
       the middle of a sentence leaves one sentence. */
    if (blocks.length === 1 && blocks[0].k === 'p') {
      runNodes(blocks[0].r).forEach(function (n) { holder.appendChild(n); });
    } else {
      blocks.forEach(function (b) { holder.appendChild(blockNode(b)); });
    }
    document.execCommand('insertHTML', false, holder.innerHTML);
    touched();
  }

  function renderEditor() {
    var post = state.post;
    var text = post.texts[post.tab];
    var original = post.tab === post.lang;

    var title = el('input', { type: 'text', className: 'lists-input lists-input-title write-title',
      maxlength: String(MAX_TITLE), value: text.title, placeholder: t('writeFieldTitle'), 'aria-label': t('writeFieldTitle') });
    var lead = el('textarea', { className: 'lists-input write-lead', maxlength: String(MAX_LEAD), rows: '2',
      placeholder: t('writeFieldLead'), 'aria-label': t('writeFieldLead') });
    lead.value = text.standfirst;

    box = el('div', {
      className: 'blog-body write-box',
      contenteditable: 'true',
      role: 'textbox',
      'aria-multiline': 'true',
      'aria-label': t('writeBody'),
      'data-hint': t('writeBody'),
      'data-clarity-mask': 'true',
      spellcheck: 'true',
      lang: post.tab
    });
    fillBox(box, text.body);
    box.addEventListener('input', function () {
      box.classList.toggle('is-empty', !box.textContent.trim() && !box.querySelector('[data-place], hr'));
      touched();
    });
    box.addEventListener('paste', onPaste);
    box.addEventListener('keyup', holdSelection);
    box.addEventListener('mouseup', holdSelection);
    box.classList.toggle('is-empty', !text.body.length);

    fields = {
      title: title,
      lead: lead,
      titleCount: el('span', { className: 'write-count' }),
      leadCount: el('span', { className: 'write-count' }),
      bodyCount: el('span', { className: 'write-count' })
    };
    title.addEventListener('input', touched);
    lead.addEventListener('input', touched);

    var panel = el('div', { className: 'write-panel', hidden: true });
    var bar = toolbar(panel);

    var note = el('p', { className: 'ac-err write-err', role: 'alert', hidden: true });
    var published = post.status === 'published';

    var primary = el('button', { type: 'button', className: 'go',
      textContent: t(published ? 'writeUpdate' : 'writePublish') });
    primary.addEventListener('click', function () { save(true, note); });

    var second = el('button', { type: 'button', className: 'alt',
      textContent: t(published ? 'writeUnpublish' : 'writeSaveDraft') });
    second.addEventListener('click', function () { save(false, note); });

    var drop = null;
    if (!original) {
      drop = el('button', { type: 'button', className: 'alt is-danger', textContent: t('writeRemoveLang') });
      drop.addEventListener('click', function () {
        delete post.texts[post.tab];
        post.tab = post.lang;
        state.dirty = true;
        render();
      });
    }

    var del = null;
    if (post.id) {
      del = el('button', { type: 'button', className: 'alt is-danger', textContent: t('writeDelete') });
      del.addEventListener('click', function () { removePost(note); });
    }

    var view = post.id
      ? TTBTrack.click(el('a', { className: 'alt', href: '/blog?post=' + encodeURIComponent(post.id),
          target: '_blank', rel: 'noopener', textContent: t('writeView') }), 'write_view')
      : null;

    var out = [
      el('p', { className: 'blog-crumb' }, [
        el('a', { className: 'alt', href: PAGE, textContent: t('writeBack') })
      ]),
      el('article', { className: 'card lists-card write-card' }, [
        el('p', { className: 'eyebrow blog-when' }, [
          post.id ? formatDate(post.at) : t('writeNew'),
          el('span', { className: 'write-state' + (published ? '' : ' is-draft'),
            textContent: t(published ? 'writePublished' : 'writeDraft') })
        ]),
        tabs(),
        el('div', { className: 'write-field' }, [title, fields.titleCount]),
        el('div', { className: 'write-field' }, [lead, fields.leadCount]),
        el('div', { className: 'write-sticky' }, [bar, panel]),
        box,
        el('p', { className: 'write-under' }, [fields.bodyCount]),
        note,
        el('p', { className: 'lists-row lists-foot write-foot' }, [primary, second, view, drop, del])
      ])
    ];
    setTimeout(recount, 0);
    return out;
  }

  function errorFor(got) {
    var e = got.out && got.out.error;
    if (got.status === 401) return t('writeSignedOut');
    if (e === 'no-title') return t('writeErrTitle', { lang: state.names[got.out.lang] || got.out.lang });
    if (e === 'too-long') return t('writeErrLong', { lang: state.names[got.out.lang] || got.out.lang });
    if (e === 'too-many' || e === 'too-many-today') return t('writeErrMany');
    return t('writeErrGeneric');
  }

  function save(publish, note) {
    if (state.busy) return;
    keep();
    var post = state.post;
    note.hidden = true;

    /* The same refusals the route would answer, said before the round trip:
       a title missing, a language over the cap. */
    var codes = Object.keys(post.texts);
    for (var i = 0; i < codes.length; i++) {
      var text = post.texts[codes[i]];
      var name = state.names[codes[i]] || codes[i];
      if (!text.title.trim()) {
        post.tab = codes[i];
        render();
        showError(t('writeErrTitle', { lang: name }));
        return;
      }
      if (charsOf(text.body) > MAX_BODY) {
        post.tab = codes[i];
        render();
        showError(t('writeErrLong', { lang: name }));
        return;
      }
    }

    state.busy = true;
    var payload = { action: 'save', lang: post.lang, publish: publish, texts: {} };
    if (post.id) payload.id = post.id;
    codes.forEach(function (c) {
      var x = post.texts[c];
      payload.texts[c] = { title: x.title, standfirst: x.standfirst, body: x.body };
    });

    ask(API, payload).then(function (got) {
      state.busy = false;
      if (got.status !== 200 || !got.out.post) {
        showError(errorFor(got));
        return;
      }
      var was = post.status;
      state.post = fromServer(got.out.post, post.tab);
      state.dirty = false;
      window.history.replaceState({}, '', PAGE + '?post=' + encodeURIComponent(state.post.id));
      TTBTrack.event(publish ? 'write_publish' : 'write_save', { post: state.post.id });
      toast(t(publish && was !== 'published' ? 'writePublishedToast' : 'writeSaved'));
      render();
    });
  }

  function showError(message) {
    var note = main.querySelector('.write-err');
    if (!note) return;
    note.textContent = message;
    note.hidden = false;
  }

  function removePost(note) {
    if (!window.confirm(t('writeDeleteAsk'))) return;
    ask(API, { action: 'delete', id: state.post.id }).then(function (got) {
      if (got.status !== 200) {
        note.textContent = errorFor(got);
        note.hidden = false;
        return;
      }
      TTBTrack.event('write_delete');
      state.dirty = false;
      window.location.href = PAGE;
    });
  }

  /* A post as the route answers it, made into the editor's state. A title
     that came back from the route is what the route kept, which is what the
     fields should now hold. */
  function fromServer(post, tab) {
    var texts = {};
    Object.keys(post.texts || {}).forEach(function (c) {
      var x = post.texts[c];
      texts[c] = { title: x.title || '', standfirst: x.standfirst || '', body: x.body || [] };
    });
    return {
      id: post.id,
      lang: post.lang,
      status: post.status,
      at: post.at,
      texts: texts,
      tab: texts[tab] ? tab : post.lang
    };
  }

  /* ------------------------------------------------------- nobody to write */

  function signedOut() {
    return el('section', { className: 'card lists-card' }, [
      el('p', { className: 'eyebrow', textContent: t('accountOpen') }),
      el('h1', { className: 'lists-title', textContent: t('writeTitle') }),
      el('p', { className: 'lists-say', textContent: t('writeSignedOut') }),
      el('p', { className: 'lists-row lists-foot' }, [
        TTBTrack.click(el('a', { className: 'go', href: SHEET + 'up' + BACK, textContent: t('accountCreate') }), 'account_open', { view: 'up' }),
        TTBTrack.click(el('a', { className: 'alt', href: SHEET + 'in' + BACK, textContent: t('accountSignIn') }), 'account_open', { view: 'in' })
      ])
    ]);
  }

  function switchedOff(key) {
    return el('section', { className: 'card lists-card' }, [
      el('p', { className: 'eyebrow', textContent: t('accountOpen') }),
      el('h1', { className: 'lists-title', textContent: t('writeTitle') }),
      el('p', { className: 'lists-say', textContent: t(key) }),
      el('p', { className: 'lists-row lists-foot' }, [
        TTBTrack.click(el('a', { className: 'alt', href: '/', textContent: t('backToMap') }), 'home')
      ])
    ]);
  }

  /* ------------------------------------------------------------------ draw */

  function render() {
    clear(main);
    fields = null;
    box = null;
    var kids;
    if (!state.reached) kids = [switchedOff('accountErrReach')];
    else if (!state.ready) kids = [switchedOff('accountErrOff')];
    else if (!state.user) kids = [signedOut()];
    else if (state.missing) kids = [switchedOff('blogMissing')];
    else if (state.post) kids = renderEditor();
    else kids = renderList();
    main.appendChild(el('div', { className: 'lists-stack' + (state.post ? ' write-stack' : '') }, kids));
    document.title = (state.post ? (titleOfOpen() || t('writeNew')) + ' | Tallinn Tastebuds' : t('writeDocumentTitle'));
  }

  function titleOfOpen() {
    var text = state.post && state.post.texts[state.post.tab];
    return text ? text.title : '';
  }

  /* ------------------------------------------------------------------- boot */

  function boot() {
    main = document.getElementById('main');
    applyStyle();

    var words = getJSON(LANGS_URL).then(function (names) {
      state.names = names;
      var lang = pickLanguage(Object.keys(names));
      return getJSON(LANG_URL + lang + '.json').then(function (pack) {
        state.lang = lang;
        state.ui = pack.ui;
      });
    });

    Promise.all([words, ask(ACCOUNT_API)]).then(function (loaded) {
      applyStaticStrings();
      var account = loaded[1];
      state.reached = account.status !== 0;
      state.ready = !!account.out.ready;
      state.user = account.out.user || null;
      if (!state.user) { render(); return; }

      var id = new URLSearchParams(window.location.search).get('post');
      if (id === 'new') {
        var texts = {};
        texts[state.lang] = blankText();
        state.post = { id: null, lang: state.lang, status: 'draft', texts: texts, tab: state.lang };
        render();
        return;
      }
      if (id) {
        /* The places first, so a card in the body is drawn with its name
           rather than its id. */
        Promise.all([ask(API + '?id=' + encodeURIComponent(id)), loadPlaces()]).then(function (got) {
          var answer = got[0];
          if (answer.status !== 200 || !answer.out.post || !answer.out.post.mine) {
            state.missing = true;
          } else {
            state.post = fromServer(answer.out.post, state.lang);
          }
          render();
        });
        return;
      }
      loadMine(false).then(render);
    }).catch(function () {
      state.reached = false;
      render();
    });

    /* Leaving with something unsaved asks first. */
    window.addEventListener('beforeunload', function (ev) {
      if (!state.dirty) return;
      ev.preventDefault();
      ev.returnValue = '';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
