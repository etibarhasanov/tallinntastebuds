/**
 * Tallinn Tastebuds — /edit, where somebody builds the page under their name.
 *
 * WHY THIS IS A PAGE OF ITS OWN
 *
 * The page of links on /u/<name> — the rows, the name somebody goes by, the
 * line under it and the three handles — was written for its first year in
 * four boxes on the card at the top of /account.html: a quiet word under
 * each, a form where the word had been once it was pressed, and one Save per
 * box. That was the right shape for a line nearly nobody writes, and the
 * wrong one for what the rows became, which is somebody's whole page. A
 * showreel, an agency, a CV, a heading over five credits: nobody could see
 * any of it until they had saved it and opened the profile in another tab,
 * and the four boxes saved separately, so the page was never looked at as a
 * whole until it was already live.
 *
 * So it moved here, onto a page shaped the way every page-of-links editor
 * people already know is shaped: the editor on the left, and on the right the
 * page itself, drawn as everybody will see it and redrawn on every keystroke,
 * before anything is saved. On a phone there is no right-hand side, so the
 * page is one press away instead — Preview, in the bar at the foot, opens it
 * over the editor and a cross closes it again.
 *
 * THE PREVIEW IS THE PROFILE'S OWN DRAWING
 *
 * Not a picture of it. The rows are TTBRows.draw() out of assets/rows.js and
 * the handles are TTBLinks out of assets/links.js — the same two files
 * renderPage() in assets/lists.js draws /u/<name> with — inside the same
 * classes, so what is on the right cannot drift from what a stranger gets.
 * Two things differ, both on purpose. Nothing in it leaves the page: a press
 * on a link is swallowed, because a preview that navigated away would take
 * the unsaved page with it. And the players are off, because a frame from
 * YouTube reloading on every keystroke is a page that stutters; a video row
 * is drawn as the link it becomes on a phone. A note does open, since that is
 * a sheet over the page rather than somewhere else.
 *
 * ONE SAVE FOR ALL OF IT
 *
 * EVERYTHING ON ONE PAGE
 *
 * It was two tabs for a while — Links, and About you with the name, the line
 * and the three handles under it — and the tab was one more thing to find
 * before anything could be typed. The name and the line are two boxes and
 * the handles are three short ones; together they are shorter than one open
 * row, so they go at the top, in the order the profile draws them, and the
 * rows follow under a heading of their own. A handle is written after the
 * address it becomes — instagram.com/ in front of the box — so the box needs
 * no label over it and the five fields read as one short block.
 *
 * ONE SAVE FOR ALL OF IT
 *
 * Everything on the page is one draft, and Save sends what changed and
 * nothing else — up to six writes to /api/account, the four actions the
 * account page's boxes made, the languages and the line's versions in other
 * languages, one after the other. Each of
 * those writes is whole on its own, so a Save that fails halfway leaves the
 * parts before it saved and says which part stopped it; the bar goes on saying there are
 * unsaved changes for as long as there are. What is drawn afterwards is what
 * came back, for the reason every form on this site does that: the server is
 * what decides what a handle is, and a pasted address comes back as one.
 *
 * Save is the one filled action on the page — design rule 5 — because on a
 * page whose whole job is editing, saving is the thing it is asking for. The
 * three ways to add a row are .alts beside each other at the top.
 *
 * A ROW MOVES BY BEING DRAGGED, AND ONLY THAT
 *
 * By its handle, with a mouse or a thumb alike — drag() — or, with the
 * handle focused, by the up and down arrow keys. The account page's boxes
 * had Move up and Move down words instead, because the browser's own drag
 * never starts under a finger; pointer events do, so the words went, and a
 * row of six moves in one gesture rather than five presses.
 *
 * WHAT IT READS
 *
 *   /data/ui.json    the strings
 *   /api/account     who is signed in, and everything on their page
 *
 * And, once the name is known, whether assets/faces/<name>.jpg exists — the
 * face on a profile is a photograph committed to the repository rather than
 * anything stored, see faceOf() in functions/api/_profile.js, so the page
 * asks the file itself rather than making /api/profile answer for it.
 */
(function () {
  'use strict';

  var UI_URL = '/data/ui.json';
  var ACCOUNT_API = '/api/account';

  var STYLE_KEY = 'ttb.style';
  var LANG_KEY = 'ttb.lang';

  var STYLES = ['red', 'green'];
  var DEFAULT_STYLE = 'red';
  var DEFAULT_LANG = 'en';

  /* The caps, written a second time so a keystroke stops rather than a round
     trip. MAX_DISPLAY in functions/api/account.js, and MAX_ABOUT, cleanRows()
     and MAX_SPEAKS in functions/api/_profile.js, are what bind. MAX_ABOUT
     holds the line and every version of it alike. */
  var MAX_ABOUT = 200;
  var MAX_DISPLAY = 60;
  var MAX_ROWS = 20;
  var MAX_ROW_TITLE = 60;
  var MAX_ROW_URL = 2048;
  var MAX_ROW_NOTE = 3000;
  var MAX_SPEAKS = 8;

  /* The same line the map, the lists page and assets/rows.js draw between a
     phone and everything else. Under it there is no room beside the editor,
     and the preview is a press away rather than beside it. */
  var PHONE = '(max-width: 860px)';

  /* The way back here from the map's sign-in sheet. */
  var SHEET = '/?account=';
  var BACK = '&then=%2Fedit';

  var state = {
    ui: {},
    lang: DEFAULT_LANG,
    reached: true,
    ready: false,
    user: null,
    face: '',
    /* What the server holds, and what the form holds. Save sends the
       difference; Discard copies the first over the second. */
    saved: { display: '', about: '', lines: {}, links: {}, speaks: [], rows: [] },
    draft: null,
    open: -1,     // the row whose fields are showing, -1 for none
    err: '',      // the sentence over the fields after a refusal
    busy: false
  };

  var main = null;
  var dom = {};
  var sheet = null;

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

  /* "The site did not answer" and "the site answered no" kept apart, the way
     assets/account.js asks. */
  function ask(url) {
    return fetch(url, { headers: { accept: 'application/json' } })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (out) {
          return { status: res.status, out: out || {} };
        });
      })
      .catch(function () { return { status: 0, out: {} }; });
  }

  function isArray(v) { return Object.prototype.toString.call(v) === '[object Array]'; }

  /* --------------------------------------------------------------- dressing
   * Copied whole from assets/account.js, which copied it from the lists page:
   * see "The two styles" in README.md. */
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

  /* ------------------------------------------------------------- the draft
   * A stored row is a title and one other thing, and which of the two is
   * filled is what it is — see "Your page" in README.md. The form needs to
   * know what a row is *meant* to be while it is still empty, so the draft
   * carries a kind, and the kind is read back off the row on the way out. */

  function kindOf(row) {
    if (row.note) return 'note';
    if (row.url) return 'link';
    return 'heading';
  }

  function draftOf(saved) {
    var links = {};
    TTBLinks.NETWORKS.forEach(function (net) { links[net.id] = saved.links[net.id] || ''; });
    return {
      display: saved.display,
      about: saved.about,
      lines: linesOut(saved.lines),
      links: links,
      speaks: saved.speaks.slice(),
      rows: saved.rows.map(function (row) {
        return { title: row.title, url: row.url || '', note: row.note || '', kind: kindOf(row) };
      })
    };
  }

  /* The rows as the server takes them: the kind decides which of the two
     boxes is sent, so a link that was a note once does not carry the note it
     was along with it. */
  function rowsOut(rows) {
    return rows.map(function (row) {
      return {
        title: row.title.replace(/\s+/g, ' ').trim(),
        url: row.kind === 'link' ? row.url.trim() : '',
        note: row.kind === 'note' ? row.note : ''
      };
    });
  }

  function flat(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

  /* The languages the line can be written again in: the site's own ten, in
     the order LINE_LANGS in functions/api/_profile.js has them, which is the
     order SPEAKS in assets/links.js starts with. Read off the strings this
     page loaded rather than written a third time, since a page is only ever
     read in a language data/ui.json speaks — and that is the whole reason a
     version is in one of these and not in any of the forty-four. */
  function lineLangs() {
    return Object.keys(TTBLinks.SPEAKS).filter(function (code) {
      return Object.prototype.hasOwnProperty.call(state.ui, code);
    });
  }

  /* The versions as the server stores them: each flattened, the empty ones
     left out — so a box added and never filled is not a change, and a box
     emptied is that version taken down. */
  function linesOut(lines) {
    var out = {};
    lineLangs().forEach(function (code) {
      var line = flat(lines[code]);
      if (line) out[code] = line;
    });
    return out;
  }

  function linksOut(links) {
    var out = {};
    TTBLinks.NETWORKS.forEach(function (net) { out[net.id] = (links[net.id] || '').replace(/^\s+|\s+$/g, ''); });
    return out;
  }

  /* Which of the six parts differ from what is stored. Compared the way the
     server would store them, so a trailing space is not a change. */
  function changed() {
    var d = state.draft;
    var s = state.saved;
    var parts = [];
    if (flat(d.display) !== s.display) parts.push('display');
    if (flat(d.about) !== s.about) parts.push('about');
    if (JSON.stringify(linesOut(d.lines)) !== JSON.stringify(linesOut(s.lines))) parts.push('lines');
    var links = linksOut(d.links);
    var sameLinks = TTBLinks.NETWORKS.every(function (net) {
      return (TTBLinks.clean(net.id, links[net.id]) || links[net.id]) === (s.links[net.id] || '');
    });
    if (!sameLinks) parts.push('links');
    if (d.speaks.join(',') !== s.speaks.join(',')) parts.push('speaks');
    var stored = s.rows.map(function (r) { return { title: r.title, url: r.url || '', note: r.note || '' }; });
    if (JSON.stringify(rowsOut(d.rows)) !== JSON.stringify(stored)) parts.push('rows');
    return parts;
  }

  /* --------------------------------------------------------------- the page */

  function render() {
    clear(main);

    if (!state.ready || !state.user) {
      main.classList.remove('is-wide');
      main.appendChild(el('div', { className: 'lists-stack' }, [state.ready ? signedOut() : switchedOff()]));
      return;
    }

    var view = document.getElementById('edit-view');
    view.href = '/u/' + encodeURIComponent(state.user);
    view.hidden = false;

    sheet = TTBRows.sheet(t, false);

    dom.pane = el('div', { className: 'ed-pane' });
    dom.err = el('p', { className: 'ac-err', role: 'alert', hidden: true });
    dom.status = el('p', { className: 'ed-status mono', 'aria-live': 'polite' });
    dom.discard = el('button', { type: 'button', className: 'alt', textContent: t('editDiscard') });
    dom.save = el('button', { type: 'button', className: 'go', textContent: t('listsSave') });
    var preview = el('button', { type: 'button', className: 'alt ed-only-phone', textContent: t('editPreview') });

    dom.discard.addEventListener('click', discard);
    dom.save.addEventListener('click', save);
    preview.addEventListener('click', function () { showPreview(true); });

    dom.screen = el('div', { className: 'ed-screen' });
    /* Nothing in the preview goes anywhere: see the header. Caught on the way
       down, before the row's own listener reports a press that was not one. */
    dom.screen.addEventListener('click', function (ev) {
      var a = ev.target.closest && ev.target.closest('a');
      if (a) ev.preventDefault();
    }, true);

    var shut = el('button', {
      type: 'button',
      className: 'panel-close ed-shut ed-only-phone',
      'aria-label': t('close'),
      html: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>'
    });
    shut.addEventListener('click', function () { showPreview(false); });

    dom.side = el('aside', { className: 'ed-side', 'aria-label': t('editPreview') }, [
      shut,
      el('div', { className: 'ed-phone' }, [dom.screen]),
      el('p', { className: 'ed-note mono', textContent: t('editPreviewNote') }),
      sheet.node
    ]);

    main.appendChild(el('div', { className: 'ed' }, [
      el('section', { className: 'card lists-card ed-panel' }, [
        dom.pane,
        el('div', { className: 'ed-bar' }, [dom.status, preview, dom.discard, dom.save])
      ]),
      dom.side
    ]));

    drawPane();
    drawPreview();
    drawBar();
  }

  function drawPane() {
    clear(dom.pane);
    dom.pane.appendChild(el('h1', { className: 'lists-title', textContent: t('editTitle') }));
    dom.err.textContent = state.err;
    dom.err.hidden = !state.err;
    dom.pane.appendChild(dom.err);
    dom.pane.appendChild(aboutFields());
    dom.pane.appendChild(el('h2', { className: 'ed-head', textContent: t('editTabLinks') }));
    dom.pane.appendChild(el('p', { className: 'lists-say', textContent: t('editLinksWhy') }));
    dom.pane.appendChild(rowsList());
  }

  /* Anything typed: the preview and the bar follow, and nothing is sent. The
     preview waits for the next frame so a fast typist redraws it once a
     frame rather than once a key. */
  var queued = false;
  function touched() {
    drawBar();
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(function () {
      queued = false;
      drawPreview();
    });
  }

  /* ------------------------------------------------------------ about you */

  /* A mono label over a 16px field, design rule 9, for the name, the line
     and every box in a row. */
  function field(labelKey, input) {
    return el('label', { className: 'ed-field' }, [
      el('span', { className: 'ed-label mono', textContent: labelKey }),
      input
    ]);
  }

  function aboutFields() {
    var d = state.draft;
    var box = el('div', { className: 'ed-fields' });

    var display = el('input', {
      type: 'text', className: 'lists-input', maxlength: String(MAX_DISPLAY),
      autocomplete: 'off', placeholder: t('accountDisplayHint')
    });
    display.value = d.display;
    display.addEventListener('input', function () { d.display = display.value; touched(); });

    var about = el('textarea', {
      className: 'lists-input', maxlength: String(MAX_ABOUT), rows: '2',
      placeholder: t('accountAboutHint')
    });
    about.value = d.about;
    about.addEventListener('input', function () { d.about = about.value; touched(); });

    box.appendChild(field(t('accountDisplay'), display));
    box.appendChild(field(t('editLine'), about));
    box.appendChild(linesField());

    /* The handles take a pasted address and show what they made of it once
       the field is left — **Where else you are** in README.md, and the
       header of assets/links.js for why these three carry no maxlength.
       Each is one line: the site's glyph and the address with the handle
       missing off the end of it, then the box for the handle. The address
       is the label, so it says what goes in the box better than the site's
       name over it did, and the name is still what a screen reader hears. */
    var social = el('div', { className: 'ed-social' });
    TTBLinks.NETWORKS.forEach(function (net) {
      var input = el('input', {
        type: 'text', className: 'ed-handle', autocomplete: 'off',
        autocapitalize: 'none', spellcheck: 'false', 'data-net': net.id,
        'aria-label': net.label
      });
      input.value = d.links[net.id] || '';
      input.addEventListener('input', function () { d.links[net.id] = input.value; touched(); });
      input.addEventListener('blur', function () {
        var handle = TTBLinks.clean(net.id, input.value);
        if (handle && handle !== input.value) { input.value = handle; d.links[net.id] = handle; touched(); }
      });
      social.appendChild(el('label', { className: 'ed-net' }, [
        el('span', {
          className: 'ed-glyph',
          html: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + TTBLinks.GLYPHS[net.id] + '</svg>'
        }),
        el('span', { className: 'ed-base mono', 'aria-hidden': 'true', textContent: net.base.replace(/^https:\/\/(?:www\.)?/, '') }),
        input
      ]));
    });
    box.appendChild(social);
    box.appendChild(speaksField());

    return box;
  }

  /* The languages somebody speaks: the ones picked, in the order they were
     picked, each a word that takes it off again, and a menu of the rest
     under them — a native select, because a list of forty-four is what a
     phone's own picker is for. Every name is in the language this page is
     read in, TTBLinks.langName(), and the menu is in that alphabet's order.
     Not a <label> round the lot the way field() is: a label with several
     controls in it hands every press on it to the first. */
  function speaksField() {
    var d = state.draft;
    var box = el('div', { className: 'ed-field' }, [
      el('span', { className: 'ed-label mono', id: 'ed-speaks-label', textContent: t('editSpeaks') })
    ]);

    if (d.speaks.length) {
      box.appendChild(el('ul', { className: 'ed-speaks' }, d.speaks.map(function (code) {
        var name = TTBLinks.langName(code, state.lang);
        var off = el('button', {
          type: 'button', className: 'ed-lang',
          'aria-label': t('editSpeaksRemove', { name: name })
        }, [el('span', { textContent: name }), el('span', { 'aria-hidden': 'true', textContent: '×' })]);
        off.addEventListener('click', function () {
          d.speaks = d.speaks.filter(function (c) { return c !== code; });
          redraw();
        });
        return el('li', null, [off]);
      })));
    }

    if (d.speaks.length < MAX_SPEAKS) {
      var rest = Object.keys(TTBLinks.SPEAKS).filter(function (code) {
        return d.speaks.indexOf(code) < 0;
      }).map(function (code) {
        return { code: code, name: TTBLinks.langName(code, state.lang) };
      }).sort(function (a, b) { return a.name.localeCompare(b.name, state.lang); });

      var pick = el('select', { className: 'lists-input', 'aria-labelledby': 'ed-speaks-label' },
        [el('option', { value: '', textContent: t('editSpeaksAdd') })].concat(rest.map(function (row) {
          return el('option', { value: row.code, textContent: row.name });
        })));
      pick.addEventListener('change', function () {
        if (!pick.value) return;
        d.speaks.push(pick.value);
        redraw();
      });
      box.appendChild(pick);
    }

    return box;
  }

  /* The line again in other languages, under the line: a box for each
     version, named for the language it is in, with a cross that takes it off,
     and a menu of the languages not written yet under them. A reader whose
     page is in one of them gets that version instead of the line; everybody
     else gets the line. **The line, in other languages** under **Profiles**
     in README.md.

     The first line is not tagged with a language — nothing asks which it was
     written in, and the menu offers all ten because of that — so somebody
     who wrote it in English and adds an English version has said the same
     thing twice, and the English reader gets the second. Not worth a
     question on a page whose job is to be short. */
  function linesField() {
    var d = state.draft;
    var box = el('div', { className: 'ed-fields ed-lines' });

    lineLangs().forEach(function (code) {
      if (!Object.prototype.hasOwnProperty.call(d.lines, code)) return;
      var name = TTBLinks.langName(code, state.lang);
      var id = 'ed-line-' + code;
      var text = el('textarea', {
        className: 'lists-input', maxlength: String(MAX_ABOUT), rows: '2',
        lang: code, 'aria-labelledby': id
      });
      text.value = d.lines[code];
      text.addEventListener('input', function () { d.lines[code] = text.value; touched(); });

      var off = el('button', {
        type: 'button', className: 'ed-line-off',
        'aria-label': t('editLinesRemove', { name: name }),
        textContent: '×'
      });
      off.addEventListener('click', function () {
        delete d.lines[code];
        redraw('lines');
      });

      /* Not a <label> round the pair, for the reason speaksField() gives: a
         label with two controls in it hands every press to the first. */
      box.appendChild(el('div', { className: 'ed-field' }, [
        el('div', { className: 'ed-line-head' }, [
          el('span', { className: 'ed-label mono', id: id, textContent: name }),
          off
        ]),
        text
      ]));
    });

    var rest = lineLangs().filter(function (code) {
      return !Object.prototype.hasOwnProperty.call(d.lines, code);
    }).map(function (code) {
      return { code: code, name: TTBLinks.langName(code, state.lang) };
    }).sort(function (a, b) { return a.name.localeCompare(b.name, state.lang); });

    if (rest.length) {
      var pick = el('select', { className: 'lists-input', 'aria-label': t('editLinesAdd'), 'data-pick': 'lines' },
        [el('option', { value: '', textContent: '+ ' + t('editLinesAdd') })].concat(rest.map(function (row) {
          return el('option', { value: row.code, textContent: row.name });
        })));
      pick.addEventListener('change', function () {
        if (!pick.value) return;
        var code = pick.value;
        d.lines[code] = '';
        redraw();
        /* Straight into the new box: it was added to be written in. */
        var added = dom.pane.querySelector('textarea[aria-labelledby="ed-line-' + code + '"]');
        if (added) added.focus();
      });
      box.appendChild(pick);
    }

    return box;
  }

  /* The field changes shape with every pick, so it is drawn again, and the
     menu is given the focus back — where a keyboard was, and where it goes
     next. Which menu is the one that was pressed: the languages spoken by
     default, the line's versions when it was one of those. */
  function redraw(which) {
    touched();
    drawPane();
    var pick = which === 'lines'
      ? dom.pane.querySelector('select[data-pick="lines"]')
      : dom.pane.querySelector('select[aria-labelledby="ed-speaks-label"]');
    if (pick) pick.focus();
  }

  /* ----------------------------------------------------------------- rows */

  var KIND_WORD = { link: 'editKindLink', note: 'rowsNote', heading: 'editKindHeading' };

  function word(label, onPress, className) {
    var b = el('button', { type: 'button', className: className || 'alt', textContent: label });
    b.addEventListener('click', onPress);
    return b;
  }

  function addRow(kind) {
    if (state.draft.rows.length >= MAX_ROWS) { toast(t('rowsErrMany')); return; }
    state.draft.rows.push({ title: '', url: '', note: '', kind: kind });
    state.open = state.draft.rows.length - 1;
    TTBTrack.event('edit_add', { kind: kind });
    drawPane();
    touched();
    focusOpen();
  }

  function move(from, to) {
    var rows = state.draft.rows;
    if (to < 0 || to >= rows.length || to === from) return;
    rows.splice(to, 0, rows.splice(from, 1)[0]);
    if (state.open === from) state.open = to;
    else if (from < state.open && to >= state.open) state.open -= 1;
    else if (from > state.open && to <= state.open) state.open += 1;
    drawPane();
    touched();
  }

  function focusOpen() {
    var input = dom.pane.querySelector('.ed-row.is-open .lists-input');
    if (input) input.focus();
  }

  /* The line under a closed row: what kind of row it is, and for a link,
     where it goes — what the profile prints under it. */
  function rowWhy(row) {
    if (row.kind !== 'link') return t(KIND_WORD[row.kind]);
    var play = row.url ? TTBRows.player(row.url.trim()) : null;
    if (play) return t('editKindVideo') + ' · ' + play.host;
    var host = '';
    try { host = new URL(row.url.trim()).hostname.replace(/^www\./, ''); } catch (e) { host = ''; }
    return host ? t('editKindLink') + ' · ' + host : t('editKindLink');
  }

  function rowsList() {
    var rows = state.draft.rows;
    var box = el('div', { className: 'ed-rows' });

    box.appendChild(el('div', { className: 'lists-row ed-add' }, [
      word('+ ' + t('editAddLink'), function () { addRow('link'); }),
      word('+ ' + t('editAddHeading'), function () { addRow('heading'); }),
      word('+ ' + t('editAddNote'), function () { addRow('note'); })
    ]));

    if (!rows.length) {
      box.appendChild(el('p', { className: 'lists-say ed-empty', textContent: t('editEmpty') }));
      return box;
    }

    var ul = el('ul', { className: 'ed-list' });
    rows.forEach(function (row, i) { ul.appendChild(rowItem(row, i, rows.length)); });
    box.appendChild(ul);
    return box;
  }

  function rowItem(row, i, count) {
    var open = state.open === i;
    var li = el('li', { className: 'ed-row' + (open ? ' is-open' : ''), 'data-at': String(i) });

    /* The handle: dragged by a mouse or a thumb — see drag() — or moved with
       the arrow keys once it has the focus. Only the handle drags, so that
       selecting the words in a field is still selecting words and a thumb
       anywhere else on the row still scrolls the page. */
    var grip = el('button', {
      type: 'button',
      className: 'ed-grip',
      'aria-label': t('editDrag'),
      title: t('editDrag'),
      html: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>'
    });
    grip.addEventListener('pointerdown', function (ev) { drag(ev, grip, li, i); });
    grip.addEventListener('keydown', function (ev) {
      var to = ev.key === 'ArrowUp' ? i - 1 : ev.key === 'ArrowDown' ? i + 1 : -1;
      if (to < 0 || to >= count) return;
      ev.preventDefault();
      move(i, to);
      var again = dom.pane.querySelector('.ed-row[data-at="' + to + '"] .ed-grip');
      if (again) again.focus();
    });

    if (!open) {
      var head = el('button', { type: 'button', className: 'ed-row-open' }, [
        el('span', { className: 'menu-say' }, [
          el('span', { className: 'menu-name' + (row.title ? '' : ' is-empty'), textContent: row.title || t('editUntitled') }),
          el('span', { className: 'menu-why', textContent: rowWhy(row) })
        ])
      ]);
      head.addEventListener('click', function () {
        state.open = i;
        drawPane();
        drawPreview();
        focusOpen();
      });
      li.appendChild(el('div', { className: 'ed-row-head' }, [grip, head]));
      return li;
    }

    var title = el('input', {
      type: 'text', className: 'lists-input', maxlength: String(MAX_ROW_TITLE),
      autocomplete: 'off', placeholder: t('rowsTitleHint')
    });
    title.value = row.title;
    title.addEventListener('input', function () { row.title = title.value; touched(); });

    var fields = [field(t('rowsTitle'), title)];
    if (row.kind === 'link') {
      var url = el('input', {
        type: 'url', className: 'lists-input', maxlength: String(MAX_ROW_URL),
        autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false',
        inputmode: 'url', placeholder: t('rowsAddressHint')
      });
      url.value = row.url;
      url.addEventListener('input', function () { row.url = url.value; touched(); });
      fields.push(field(t('rowsAddress'), url));
    } else if (row.kind === 'note') {
      var note = el('textarea', {
        className: 'lists-input', maxlength: String(MAX_ROW_NOTE), rows: '5',
        placeholder: t('rowsNoteHint')
      });
      note.value = row.note;
      note.addEventListener('input', function () { row.note = note.value; touched(); });
      fields.push(field(t('rowsNote'), note));
    }

    var foot = [];
    /* A link and a note swap into each other, keeping what was typed in
       both; a heading is what it is, and is removed rather than turned. */
    if (row.kind !== 'heading') {
      foot.push(word(t(row.kind === 'note' ? 'rowsAsLink' : 'rowsAsNote'), function () {
        row.kind = row.kind === 'note' ? 'link' : 'note';
        drawPane();
        touched();
        focusOpen();
      }));
    }
    foot.push(word(t('rowsRemove'), function () {
      state.draft.rows.splice(i, 1);
      state.open = -1;
      drawPane();
      touched();
    }, 'alt ed-remove'));
    foot.push(word(t('editDone'), function () {
      state.open = -1;
      drawPane();
      drawPreview();
    }));

    li.appendChild(el('div', { className: 'ed-row-head' }, [
      grip,
      el('span', { className: 'ed-kind mono', textContent: t(KIND_WORD[row.kind]) })
    ]));
    li.appendChild(el('div', { className: 'ed-fields' }, fields));
    li.appendChild(el('div', { className: 'ed-row-foot' }, foot));
    return li;
  }

  /* Dragging a row by its handle, with a mouse or a thumb alike.
   *
   * Pointer events rather than the browser's own drag and drop, because that
   * one is a mouse's: a finger on a phone never starts it, and a phone is
   * where half of these pages are written. The handle takes the pointer for
   * the length of the drag and says `touch-action: none`, so a thumb on it
   * moves the row rather than the page; a thumb anywhere else still scrolls.
   *
   * The row follows the pointer, and where it will land is worked out from
   * the pointer against the middle of each of the other rows — so a row is
   * put after one whose lower half it was let go over — and shown as a line
   * in the gap. Near the top or the foot of the window the page scrolls under
   * it, so a row can be carried past what is on screen. Nothing moves in the
   * draft until it is let go, and a press that never travelled is not a drag. */
  function drag(ev, grip, li, from) {
    if (ev.button !== 0) return;
    var ul = li.parentNode;
    var startY = ev.clientY;
    var scrolled = window.scrollY;
    var target = from;
    var moved = false;

    function mark(to) {
      var items = ul.children;
      for (var i = 0; i < items.length; i++) {
        items[i].classList.toggle('is-drop-before', moved && to !== from && to !== from + 1 && i === to);
        items[i].classList.toggle('is-drop-after', moved && to === items.length && to !== from + 1 && i === items.length - 1);
      }
    }

    function follow(y) {
      var dy = y - startY + (window.scrollY - scrolled);
      if (!moved && Math.abs(dy) < 4) return;
      if (!moved) {
        moved = true;
        li.classList.add('is-dragging');
      }
      li.style.transform = 'translateY(' + dy + 'px)';
      var items = ul.children;
      target = items.length;
      for (var i = 0; i < items.length; i++) {
        if (items[i] === li) continue;
        var box = items[i].getBoundingClientRect();
        if (y < box.top + box.height / 2) { target = i; break; }
      }
      mark(target);
    }

    var last = ev.clientY;
    var timer = null;
    function edge() {
      var gap = 70;
      var step = last < gap ? -12 : last > window.innerHeight - gap ? 12 : 0;
      if (step) {
        window.scrollBy(0, step);
        follow(last);
      }
    }

    function onMove(e) {
      last = e.clientY;
      follow(last);
    }

    function done(commit) {
      clearInterval(timer);
      grip.removeEventListener('pointermove', onMove);
      grip.removeEventListener('pointerup', onUp);
      grip.removeEventListener('pointercancel', onCancel);
      li.style.transform = '';
      li.classList.remove('is-dragging');
      mark(-1);
      var to = target > from ? target - 1 : target;
      if (commit && moved && to !== from) {
        TTBTrack.event('edit_drag', { from: from + 1, to: to + 1 });
        move(from, to);
      }
    }
    function onUp() { done(true); }
    function onCancel() { done(false); }

    ev.preventDefault();
    try { grip.setPointerCapture(ev.pointerId); } catch (e) { /* fine */ }
    grip.addEventListener('pointermove', onMove);
    grip.addEventListener('pointerup', onUp);
    grip.addEventListener('pointercancel', onCancel);
    timer = setInterval(edge, 30);
  }

  /* -------------------------------------------------------------- preview */

  function drawPreview() {
    if (!dom.screen) return;
    var d = state.draft;
    var rows = d.rows.map(function (row) {
      /* A row still being written is drawn as what it is meant to be: an
         untitled one with an ellipsis for its title, and a note or a link
         with nothing in it yet as a note or a link rather than as the
         heading it would be if it were saved like that. */
      return {
        title: flat(row.title) || '…',
        url: row.kind === 'link' ? (row.url.trim() || 'https://') : '',
        note: row.kind === 'note' ? (row.note || ' ') : ''
      };
    });

    var social = TTBLinks.of(d.links);
    var spoken = TTBLinks.spoken(d.speaks, state.lang);
    /* The line as a reader in this page's language gets it — their version
       where there is one, the line where there is not — which is what
       lineOf() in assets/lists.js picks. Nothing without the line itself,
       because readProfile() sends no versions of a line taken down. */
    var line = flat(d.about) ? (flat(d.lines[state.lang]) || flat(d.about)) : '';
    clear(dom.screen);
    dom.screen.appendChild(el('header', { className: 'lists-page-top' }, [
      state.face ? el('img', { className: 'lists-page-face', src: state.face, alt: '', width: 96, height: 96 }) : null,
      el('h1', { className: 'lists-page-name', textContent: flat(d.display) || state.user }),
      line ? el('p', { className: 'lists-page-line', textContent: line }) : null,
      social.length ? el('ul', { className: 'lists-page-social' }, social.map(function (row) {
        return el('li', null, [el('a', {
          href: row.href,
          'aria-label': row.label,
          title: row.label,
          html: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + TTBLinks.GLYPHS[row.id] + '</svg>'
        })]);
      })) : null,
      spoken.length ? el('p', { className: 'lists-speaks' }, [
        el('span', { className: 'lists-link-net mono', textContent: t('profileSpeaks') }),
        el('span', { className: 'lists-link-who', textContent: spoken.join(' · ') })
      ]) : null
    ]));

    if (rows.length) {
      var ul = TTBRows.draw(rows, { t: t, play: false, onNote: sheet.open });
      if (state.open >= 0 && ul.children[state.open]) {
        ul.children[state.open].classList.add('is-editing');
      }
      dom.screen.appendChild(ul);
    } else {
      dom.screen.appendChild(el('p', { className: 'ed-note mono', textContent: t('editPreviewEmpty') }));
    }
  }

  /* The preview over the editor, on a phone. A class on the page rather than
     a dialog, because on a wide screen the same element is simply in the
     layout; Escape and the cross both close it. */
  function showPreview(on) {
    document.body.classList.toggle('is-previewing', on);
    if (on) {
      TTBTrack.event('edit_preview');
      drawPreview();
      dom.side.scrollTop = 0;
      var shut = dom.side.querySelector('.ed-shut');
      if (shut) shut.focus();
    }
  }

  /* ------------------------------------------------------------------ bar */

  function drawBar() {
    var parts = changed();
    var dirty = parts.length > 0;
    dom.status.textContent = state.busy ? t('accountWorking') : t(dirty ? 'editDirty' : 'editClean');
    dom.status.classList.toggle('is-dirty', dirty);
    dom.save.disabled = state.busy || !dirty;
    /* Not `hidden`: .alt sets a display of its own, which outranks it. */
    dom.discard.style.display = dirty ? '' : 'none';
  }

  function discard() {
    state.draft = draftOf(state.saved);
    state.open = -1;
    state.err = '';
    TTBTrack.event('edit_discard');
    drawPane();
    drawPreview();
    drawBar();
  }

  function fail(message, row) {
    state.err = message;
    if (typeof row === 'number') state.open = row;
    render();
    if (typeof row === 'number') focusOpen();
    else dom.err.scrollIntoView({ block: 'nearest' });
  }

  /* The same checks the server runs, first, so a mistake costs a keystroke
     rather than a round trip; then what changed, one write at a time. */
  function save() {
    var parts = changed();
    if (!parts.length || state.busy) return;
    var d = state.draft;
    var rows = rowsOut(d.rows);

    for (var i = 0; i < rows.length; i++) {
      if (!rows[i].title) return fail(t('rowsErrTitle', { n: i + 1 }), i);
      /* A link with no address and a note with no note would be stored as
         headings — which is what the server makes of either — and a row
         somebody added as a note turning into a heading on Save is a
         surprise, so it is said instead. */
      if (d.rows[i].kind === 'link' && !rows[i].url) return fail(t('editErrUrl', { n: i + 1 }), i);
      if (d.rows[i].kind === 'note' && !rows[i].note.trim()) return fail(t('editErrNote', { n: i + 1 }), i);
      if (rows[i].url && !/^https:\/\/[^/]/.test(rows[i].url)) return fail(t('rowsErrUrl', { n: i + 1 }), i);
    }
    var links = linksOut(d.links);
    for (var n = 0; n < TTBLinks.NETWORKS.length; n++) {
      var net = TTBLinks.NETWORKS[n];
      if (links[net.id] && !TTBLinks.clean(net.id, links[net.id])) {
        return fail(t('accountErrLink', { name: net.label }));
      }
    }

    var bodies = {
      display: { action: 'display', display: d.display },
      about: { action: 'about', about: d.about },
      lines: { action: 'lines', lines: linesOut(d.lines) },
      links: (function () { var b = linksOut(d.links); b.action = 'links'; return b; }()),
      speaks: { action: 'speaks', speaks: d.speaks },
      rows: { action: 'rows', rows: rows }
    };

    state.busy = true;
    state.err = '';
    dom.err.hidden = true;
    drawBar();

    var chain = Promise.resolve();
    parts.forEach(function (part) {
      chain = chain.then(function () {
        return fetch(ACCOUNT_API, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(bodies[part])
        }).then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (out) {
            if (!res.ok) throw { part: part, status: res.status, out: out || {} };
            if (part === 'rows') state.saved.rows = isArray(out.rows) ? out.rows : [];
            else if (part === 'links') state.saved.links = out.links || {};
            else if (part === 'speaks') state.saved.speaks = isArray(out.speaks) ? out.speaks : [];
            else if (part === 'lines') state.saved.lines = out.lines || {};
            else state.saved[part] = out[part] || '';
          });
        });
      });
    });

    chain.then(function () {
      state.busy = false;
      TTBTrack.event('edit_save', { parts: parts.join(','), rows_count: state.saved.rows.length });
      /* What came back, not what went out: a pasted address is a handle now,
         and a line past its cap is the line that was kept. The row that was
         open stays open. */
      var open = state.open;
      state.draft = draftOf(state.saved);
      state.open = open < state.draft.rows.length ? open : -1;
      drawPane();
      drawPreview();
      drawBar();
      toast(t('listsSaved'));
    }).catch(function (why) {
      state.busy = false;
      var out = (why && why.out) || {};
      var err = out.error;
      if (why && why.status === 401) return fail(t('editErrSignedOut'));
      if (err === 'row-title' && typeof out.row === 'number') return fail(t('rowsErrTitle', { n: out.row + 1 }), out.row);
      if (err === 'row-url' && typeof out.row === 'number') return fail(t('rowsErrUrl', { n: out.row + 1 }), out.row);
      if (err === 'rows-many') return fail(t('rowsErrMany'));
      if (err === 'bad-speaks') return fail(t('editErrSpeaks'));
      if (err === 'bad-lines') return fail(t('editErrLines'));
      if (err === 'no-rows-table') return fail(t('rowsErrOff'));
      if (err === 'bad-link') {
        var named = '';
        TTBLinks.NETWORKS.forEach(function (net) { if (net.id === out.network) named = net.label; });
        return fail(t('accountErrLink', { name: named }));
      }
      return fail(t('accountErrGeneric'));
    });
  }

  /* ------------------------------------------------ nobody to edit it for */

  function signedOut() {
    return el('section', { className: 'card lists-card' }, [
      el('p', { className: 'eyebrow', textContent: t('accountOpen') }),
      el('h1', { className: 'lists-title', textContent: t('editTitle') }),
      el('p', { className: 'lists-say', textContent: t('editSignedOut') }),
      el('p', { className: 'lists-row lists-foot' }, [
        TTBTrack.click(el('a', { className: 'go', href: SHEET + 'up' + BACK, textContent: t('accountCreate') }), 'account_open', { view: 'up' }),
        TTBTrack.click(el('a', { className: 'alt', href: SHEET + 'in' + BACK, textContent: t('accountSignIn') }), 'account_open', { view: 'in' })
      ])
    ]);
  }

  function switchedOff() {
    return el('section', { className: 'card lists-card' }, [
      el('p', { className: 'eyebrow', textContent: t('accountOpen') }),
      el('h1', { className: 'lists-title', textContent: t('editTitle') }),
      el('p', { className: 'lists-say', textContent: t(state.reached ? 'accountErrOff' : 'accountErrReach') }),
      el('p', { className: 'lists-row lists-foot' }, [
        TTBTrack.click(el('a', { className: 'alt', href: '/', textContent: t('backToMap') }), 'home')
      ])
    ]);
  }

  /* ------------------------------------------------------------------- boot */

  /* The face, when the repository has one for this name. An <img> that
     either arrives or does not is the whole question. */
  function findFace() {
    var img = new Image();
    var src = '/assets/faces/' + encodeURIComponent(state.user) + '.jpg';
    img.onload = function () {
      state.face = src;
      drawPreview();
    };
    img.src = src;
  }

  function boot() {
    main = document.getElementById('main');
    applyStyle();

    Promise.all([getJSON(UI_URL), ask(ACCOUNT_API)]).then(function (loaded) {
      state.ui = loaded[0] || {};
      state.lang = pickLanguage(Object.keys(state.ui).sort());
      applyStaticStrings();
      document.title = t('editDocumentTitle');

      var account = loaded[1];
      state.reached = account.status !== 0;
      state.ready = !!account.out.ready;
      state.user = account.out.user || null;
      state.saved = {
        display: account.out.display || '',
        about: account.out.about || '',
        lines: account.out.lines || {},
        links: account.out.links || {},
        speaks: isArray(account.out.speaks) ? account.out.speaks : [],
        rows: isArray(account.out.rows) ? account.out.rows : []
      };
      state.draft = draftOf(state.saved);

      render();
      if (state.user) findFace();
    }).catch(function () {
      state.ui = {};
      state.reached = false;
      render();
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && document.body.classList.contains('is-previewing')) showPreview(false);
    });

    /* Leaving with something unsaved asks first. The browser writes the
       question; a page may only ask for it. */
    window.addEventListener('beforeunload', function (ev) {
      if (!state.draft || !state.user || !changed().length) return;
      ev.preventDefault();
      ev.returnValue = '';
    });

    /* Wider than a phone, the preview is in the layout and the class that
       lays it over the editor means nothing — drop it, so turning a tablet
       round does not leave the page stuck under it. */
    if (window.matchMedia) {
      var mq = window.matchMedia(PHONE);
      var off = function () { if (!mq.matches) document.body.classList.remove('is-previewing'); };
      if (mq.addEventListener) mq.addEventListener('change', off);
      else if (mq.addListener) mq.addListener(off);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
