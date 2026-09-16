/* Tallinn Tastebuds — the feedback page.
 *
 * /feedback, where anybody says what they would change about this site and
 * puts a heart on what somebody else said. The map says where to eat and the
 * blog says why the site around it works the way it does; this is the half
 * that listens.
 *
 * WHAT IT IS MADE OF
 *
 * data/ui.json for every word, and /api/feedback for everything anybody
 * wrote. One <main>, everything built into it, the state decided once when
 * both answers are in — which is how lists.html, account.html and blog.html
 * are put together, and for the reason all three say: there is one place that
 * decides what the page is showing, so nothing can be left standing from the
 * state before.
 *
 * THE PAGE HAS ONE ORDER AND NO WAY TO CHANGE IT
 *
 * The most hearted first, with anything from the last ten minutes above them
 * so that a new thing is read before its hearts have had a chance to say
 * anything about it. The server decides it — see FRESH_MS in
 * functions/api/feedback.js — and there are deliberately no chips here to
 * pick it with: two orders on a page like this is a control that makes the
 * reader responsible for a decision they have no way to have an opinion
 * about. **Feedback** in README.md is the argument in full.
 *
 * PUTTING YOUR NAME ON IT IS A SIGN-IN, AND IT HAPPENS IN THE SAME PRESS
 *
 * Saying something needs no account at all. Choosing With a name opens the
 * account sheet's own two fields inside this card, and Post feedback then
 * makes the account or signs into it and posts, in one request — see the
 * header of functions/api/feedback.js. This is the one page on the site
 * outside the map's sheet and splitwise that draws a password field, and it
 * draws the sheet's, with the sheet's hints and the sheet's errors, rather
 * than a second design for the same form.
 *
 * NOTHING ON THIS PAGE SENDS THE BROWSER TO THE MAP AND BACK
 *
 * Including the awkward half of Continue with Google. A Google account that
 * has never been here before still has to be given a name, and that step used
 * to be the map's sheet's — the browser was sent there, named, and returned.
 * It is asked for in this composer now, above the sentence still sitting in
 * the field, and `naming` out of /api/feedback is what says to ask. The map's
 * sheet keeps its own copy of the step for its own visitors; the step itself
 * is one function that both read.
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

  /* The id this browser is known by when nobody is signed in, and the same
     key the map writes it under: a heart pressed on the map's own bookmark
     and a heart pressed here belong to the same device. */
  var CID_KEY = 'ttb.cid';

  /* What was in the field when the browser left for Google, so that coming
     back does not cost somebody the sentence they had written. Cleared the
     moment it is read. */
  var DRAFT_KEY = 'ttb.feedbackDraft';

  var UI_URL = '/data/ui.json';
  var API = '/api/feedback';

  /* The address this page is served at. Cloudflare Pages serves feedback.html
     here as well, the way it serves blog.html at /blog, and this is the
     spelling every link written by this file uses. */
  var PAGE = '/feedback';

  /* Five hundred, and the server is the one that binds it — MAX_FEEDBACK in
     functions/api/feedback.js. This is the copy that stops somebody typing
     past it rather than finding out afterwards; see **The caps** in
     README.md, which lists every number that lives in two places. */
  var MAX_TEXT = 500;
  /* Three to twenty-four, as USERNAME_RE in functions/api/_account.js. */
  var MAX_NAME = 24;

  var state = {
    ui: {},
    lang: DEFAULT_LANG,
    ready: false,   // whether /api/feedback could read its tables at all
    me: null,       // the username signed in on this browser, or null
    google: false,  // whether Continue with Google leads anywhere here
    naming: false,  // a Google account that has proved itself and wants a name
    rows: [],       // everything drawn, in the server's order
    page: 0,        // the last page asked for
    more: false,    // whether there is another one
    as: 'anon',     // which half of "Post as" is chosen
    note: '',       // what just happened, above the fields
    err: '',        // and what just went wrong
    /* What is in the three boxes. Kept here rather than read off the DOM when
       it is wanted, because a refusal redraws the page — the note and the
       error sit above the fields, which is the sixth design rule — and a
       redraw that built empty boxes would answer "wrong password" by throwing
       away the sentence somebody had just written. */
    text: '',
    user: '',
    pass: ''
  };

  var toastTimer = null;
  var main = null;

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

  function storeSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* private mode */ }
  }

  function storeDrop(key) {
    try { window.localStorage.removeItem(key); } catch (e) { /* private mode */ }
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

  function post(body) {
    return fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().then(function (out) { return { ok: res.ok, out: out }; });
    });
  }

  function toast(message) {
    var node = document.getElementById('toast');
    node.textContent = message;
    node.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.hidden = true; }, 3800);
  }

  /* What a press that did not reach the database says. The four of them —
     the heart both ways, and Remove, twice over — all say it, and it is the
     lists page's own sentence rather than a second wording of the same
     apology. The composer does not use this: what goes wrong there is
     answered above the fields, where the sixth design rule puts it. */
  function failed() {
    toast(t('listsErrGeneric'));
  }

  /* The id this browser is known by, made on the first thing it does here and
     never before: a browser that only ever reads the page is not given an id
     for something it has not done. The same arrangement, and the same key, as
     clientId() in assets/app.js — which is the other copy of this and the
     reason there is no third: two ES5 files served raw cannot import from
     each other, and a shared global for eleven lines would be a fourth script
     on every page that draws a heart. */
  function clientId() {
    var id = storeGet(CID_KEY);
    if (id) return id;
    id = (window.crypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : uuidFromBytes();
    storeSet(CID_KEY, id);
    return id;
  }

  /* Safari before 15.4 has crypto but not randomUUID. getRandomValues is
     everywhere, so the shape is assembled by hand from real entropy rather
     than falling back to Math.random. */
  function uuidFromBytes() {
    var b = new Uint8Array(16);
    window.crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;   /* version 4 */
    b[8] = (b[8] & 0x3f) | 0x80;   /* variant 1 */
    var hex = [];
    for (var i = 0; i < 16; i++) hex.push((b[i] + 0x100).toString(16).slice(1));
    return hex.slice(0, 4).join('') + '-' + hex.slice(4, 6).join('') + '-' +
           hex.slice(6, 8).join('') + '-' + hex.slice(8, 10).join('') + '-' +
           hex.slice(10, 16).join('');
  }

  /* ------------------------------------------------------- look and feel */

  /* The style the site is wearing. The map has the swatch and writes the
     choice to localStorage; this page reads it, exactly as the lists, account
     and blog pages do — walking from the map to something to read should not
     feel like leaving. Everything drawn here is built out of the tokens both
     styles restate, so this one attribute is the whole of it. */
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
    each('data-i18n-placeholder', function (n, k) { n.setAttribute('placeholder', t(k)); });
  }

  /* Where a language code is not enough to say which of its dates is meant.
     "en" resolves to en-US in every engine that has both, which draws
     "August 9, 2026" — and this site's English is the English the README and
     every write-up on the map are written in, where that date is the ninth of
     August. The other copy of this pair is in assets/blog.js, which dates a
     post; this dates a sentence somebody left. Intl first and the ui.json
     names behind it, and the header of that file has the grammar argument for
     why round that way. */
  var LOCALES = { en: 'en-GB' };

  function formatWhen(ms) {
    var d = new Date(ms);
    if (isNaN(d.getTime())) return '';
    try {
      return new Intl.DateTimeFormat(LOCALES[state.lang] || state.lang, {
        day: 'numeric', month: 'long', year: 'numeric'
      }).format(d);
    } catch (e) {
      var names = (t('months') || '').split('|');
      return t('blogDate', {
        day: d.getDate(),
        month: names[d.getMonth()] || String(d.getMonth() + 1),
        year: d.getFullYear()
      });
    }
  }

  /* ---------------------------------------------------------- the reading */

  function load(page) {
    /* Read and never minted. The id says which rows are already yours and
       which you have already hearted, and a browser that has done neither has
       nothing to tell the server — so opening the page does not hand it an
       id for something it has not done. clientId() below mints one, and only
       the presses call it. The map draws the same line at the same place:
       the id arrives with the first save, not with the first visit. */
    var mine = storeGet(CID_KEY);
    var url = API + '?page=' + page + (mine ? '&client=' + encodeURIComponent(mine) : '');
    return getJSON(url).catch(function () {
      /* Nothing on this site waits on /api/*. A page that could not be read
         is a page that says so, with everything else on it still standing. */
      return { ready: false, rows: [], more: false };
    });
  }

  function take(answer, append) {
    state.ready = !!answer.ready;
    state.me = answer.me || null;
    state.google = !!answer.google;
    state.naming = !!answer.naming;
    state.more = !!answer.more;
    state.rows = append ? state.rows.concat(answer.rows || []) : (answer.rows || []);
    /* Somebody signed in posts under their name unless they say otherwise;
       signed out, the quiet answer is the one that asks for nothing. And
       somebody halfway through naming a Google account came back here to do
       exactly that, so the choice opens on the half that asks. */
    if (!append && state.as === 'anon' && (state.me || state.naming)) state.as = 'name';
  }

  /* ---------------------------------------------------------- the drawing */

  var ICON_HEART =
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>';

  /* Google's mark in Google's four colours — the one place on this site a
     component names a colour, because the colours are Google's and naming
     them anywhere else would be wrong. The same block as GOOGLE_MARK in
     assets/app.js; see the fifth control under **The design rules**. */
  var GOOGLE_MARK =
    '<svg viewBox="0 0 48 48" focusable="false">' +
    '<path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>' +
    '<path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>' +
    '<path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/>' +
    '<path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>' +
    '</svg>';

  function heartSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICON_HEART + '</svg>';
  }

  /* How many people agreed, inside the mark. Never at nought: a "0" under
     somebody's sentence reads as a verdict on it rather than as nobody having
     pressed yet, which is why the save and keep counts are hidden there too.
     The label is the whole of what a screen reader gets, since the button
     carries no word at all — the count where there is one, and what pressing
     would do where there is not. Whether you are one of them is `aria-pressed`
     and not a third sentence. */
  function paintHeart(button, row) {
    var n = button.querySelector('.fb-heart-n');
    n.textContent = row.hearts ? String(row.hearts) : '';
    button.classList.toggle('has-n', !!row.hearts);
    button.setAttribute('aria-label', row.hearts
      ? (row.hearts === 1 ? t('feedbackHeartsOne') : t('feedbackHeartsN', { n: row.hearts }))
      : t('feedbackHeart'));
    if (!row.mine) button.setAttribute('aria-pressed', String(!!row.hearted));
  }

  function heart(row) {
    /* Your own: the mark and the number, with no edge under them. Nobody
       hearts what they wrote, and the server refuses it too — so this is not
       a button at all rather than a button that answers 403. */
    if (row.mine) {
      var fact = el('span', {
        className: 'fb-heart is-mine',
        role: 'img',
        html: heartSvg()
      }, [el('span', { className: 'fb-heart-n' })]);
      paintHeart(fact, row);
      return fact;
    }

    var b = el('button', {
      type: 'button',
      className: 'fb-heart',
      html: heartSvg()
    }, [el('span', { className: 'fb-heart-n' })]);
    paintHeart(b, row);

    /* Where the row and the mark are set together. Three things say what the
       heart is now — the press guessing, the server answering, and a failure
       putting it back — and each of them was the same three lines with
       different arithmetic in the middle. */
    function show(hearted, hearts) {
      row.hearted = hearted;
      row.hearts = Math.max(0, hearts);
      paintHeart(b, row);
    }

    b.addEventListener('click', function () {
      /* The mark flips first and the request follows it. A heart that waits
         for a round trip before it looks pressed feels broken on a phone, and
         there is nothing here a failure cannot put back — which is what the
         number remembered here is for. Remembered rather than added back
         afterwards: an answer that arrives while a second press is in flight
         would make a subtraction wrong, and cannot make this wrong. */
      var want = !row.hearted;
      var before = row.hearts || 0;
      TTBTrack.event('feedback_heart', { feedback_state: want ? 'on' : 'off' });
      show(want, before + (want ? 1 : -1));
      if (want) {
        b.classList.add('is-beating');
        setTimeout(function () { b.classList.remove('is-beating'); }, 460);
      }

      post({ action: want ? 'heart' : 'unheart', id: row.id, client: clientId() })
        .then(function (a) {
          if (!a.ok) {
            show(!want, before);
            return failed();
          }
          /* The number the table actually holds, which is not necessarily the
             one this page guessed: somebody else may have pressed it in the
             meantime, and a second press that hit the conflict clause added
             nothing at all. */
          show(!!a.out.hearted, a.out.hearts || 0);
        })
        .catch(function () {
          show(!want, before);
          failed();
        });
    });

    return b;
  }

  /* Who wrote it and when. A name is a link to the profile it belongs to, the
     way a list's byline is; an anonymous row says so in the same position, so
     the line under every sentence is the same line. */
  function byline(row) {
    var who = row.name
      ? el('span', { className: 'lists-index-by' },
          [el('a', { href: '/u/' + encodeURIComponent(row.name), textContent: row.name })])
      : el('span', { textContent: t('feedbackAnon') });

    return el('p', { className: 'lists-all-meta' },
      [who, document.createTextNode(' · ' + formatWhen(row.at))]);
  }

  /* The word that takes your own down. It asks first, because there is no way
     back: the row and its hearts go in the same batch. */
  function remove(row, item) {
    var b = el('button', { type: 'button', className: 'alt is-danger', textContent: t('feedbackRemove') });
    b.addEventListener('click', function () {
      if (!window.confirm(t('feedbackRemoveSure'))) return;
      TTBTrack.event('feedback_remove');
      b.disabled = true;
      post({ action: 'remove', id: row.id, client: clientId() }).then(function (a) {
        if (!a.ok) {
          b.disabled = false;
          return failed();
        }
        /* Out of the list as well as off the screen, or the next draw would
           bring it back. The card goes on its own rather than by redrawing
           the page: everything else on it — a sentence half typed, a heart
           somebody is watching — should not move because one row went. */
        for (var i = 0; i < state.rows.length; i++) {
          if (state.rows[i].id === row.id) { state.rows.splice(i, 1); break; }
        }
        if (item.parentNode) item.parentNode.removeChild(item);
        /* Unless that was the last of them, and the page now has a different
           thing to say. */
        if (!state.rows.length) render();
      }).catch(function () {
        b.disabled = false;
        failed();
      });
    });
    return b;
  }

  function card(row) {
    var item = el('li', { className: 'lists-index-row' });
    var acts = el('span', { className: 'fb-acts' });
    var box = el('article', { className: 'card fb-card' }, [
      el('p', { className: 'fb-text', textContent: row.text }),
      el('div', { className: 'fb-foot' }, [byline(row), acts])
    ]);
    if (row.mine) acts.appendChild(remove(row, item));
    acts.appendChild(heart(row));
    item.appendChild(box);
    return item;
  }

  /* -------------------------------------------------------- the composer */

  /* One field, built the way the account sheet builds one: a mono label over a
     16px input, with the line that has to be read under it. The ninth design
     rule is where the 16 comes from. */
  function field(id, label, hint, input) {
    return el('div', { className: 'ac-field' }, [
      el('label', { className: 'ac-label', 'for': id, textContent: label }),
      input,
      hint ? el('p', { className: 'ac-hint', textContent: hint }) : null
    ]);
  }

  /* Both answers drawn, the filled one is the answer — the lists page's own
     public/private control, which is the shape this site uses whenever a
     choice has exactly two sides and printing the state alone could not say
     which of them pressing would give you. */
  function postAs(onPick) {
    var options = state.me
      ? [['name', state.me], ['anon', t('feedbackAnon')]]
      : [['anon', t('feedbackAnon')], ['name', t('feedbackWithName')]];

    var seg = el('div', { className: 'lists-seg' }, options.map(function (pair) {
      var input = el('input', {
        type: 'radio',
        name: 'fb-as',
        value: pair[0],
        checked: state.as === pair[0]
      });
      var option = el('label', {
        className: 'lists-seg-opt' + (state.as === pair[0] ? ' is-on' : '')
      }, [input, el('span', { textContent: pair[1] })]);
      input.addEventListener('change', function () { onPick(pair[0]); });
      return option;
    }));

    return el('fieldset', { className: 'lists-vis' }, [
      el('legend', { className: 'lists-vis-legend mono', textContent: t('feedbackAs') }),
      seg
    ]);
  }

  /* The account, inside the composer. It is the map's sheet's own fields, in
     the card somebody is already typing in, and it is here rather than behind
     a link for one reason: the moment worth asking at is the moment after
     somebody has written something they want their name on, and sending them
     to another page to sign in is asking them to write it twice.
   *
     It has two shapes, and which one is drawn is the server's answer rather
     than this page's guess.
   *
     ORDINARILY, a name and a password. There is no separate Sign up and Sign
     in: the name decides — a name nobody has makes an account, one that
     exists signs you into it — and the line under the field says so before
     the button rather than after it. See enterAccount() in
     functions/api/_account.js, where `mode: 'either'` is that decision. Under
     them, where this deployment has Google configured at all, the other way
     in.
   *
     COMING BACK FROM GOOGLE having never been here before, a name and
     nothing else. Google has already proved who this is, so there is no
     password to ask for and no second way in to offer — the one thing left is
     the thing this site asks everybody, which is what to call them. That step
     used to happen on the map's sheet and the browser was sent there and
     back; it happens here now, with the sentence they were writing still in
     the field above it. nameGoogleAccount() in functions/api/_account.js is
     the same step the sheet takes, read by both. */
  function account() {
    var user = el('input', {
      type: 'text',
      id: 'fb-user',
      autocomplete: 'username',
      autocapitalize: 'none',
      autocorrect: 'off',
      spellcheck: 'false',
      maxlength: String(MAX_NAME)
    });
    user.value = state.user;
    user.addEventListener('input', function () { state.user = user.value; });

    if (state.naming) {
      return el('div', { className: 'fb-name' }, [
        el('p', { className: 'ac-why', textContent: t('accountGoogleNameWhy') }),
        field('fb-user', t('accountUsername'), t('accountUsernameHint'), user)
      ]);
    }

    var pass = el('input', {
      type: 'password',
      id: 'fb-pass',
      autocomplete: 'current-password'
    });
    pass.value = state.pass;
    pass.addEventListener('input', function () { state.pass = pass.value; });

    return el('div', { className: 'fb-name' }, [
      field('fb-user', t('accountUsername'), t('feedbackNameHint'), user),
      field('fb-pass', t('accountPassword'), t('accountNoReset'), pass),
      /* Only where it leads somewhere. Without a Google client set on this
         deployment the round trip can do nothing but come back saying it
         failed, so the button is not drawn at all — the same call the map's
         sheet makes on the same answer. */
      state.google ? el('p', { className: 'ac-or' }, [el('span', { textContent: t('accountOr') })]) : null,
      state.google ? TTBTrack.click(leaves(el('a', {
        className: 'ac-google',
        href: '/api/google?then=' + encodeURIComponent(PAGE)
      }, [
        el('span', { className: 'ac-google-mark', 'aria-hidden': 'true', html: GOOGLE_MARK }),
        el('span', { textContent: t('accountGoogle') })
      ])), 'feedback_google') : null
    ]);
  }

  /* The one link on this page that takes the browser off it. A sentence
     somebody has written is not something to lose to a round trip through
     Google, so it is written down on the way out and picked up by the
     composer on the way back in. */
  function leaves(link) {
    link.addEventListener('click', function () {
      if (state.text) storeSet(DRAFT_KEY, state.text);
    });
    return link;
  }

  /* What the server said, in this reader's language. Anything not in the list
     is the generic one: a new answer must never reach somebody as its own
     error code. */
  var ERRORS = {
    empty: 'feedbackErrEmpty',
    often: 'feedbackErrOften',
    username: 'accountErrUsername',
    password: 'accountErrPassword',
    'no-match': 'accountErrNoMatch',
    taken: 'accountErrTaken',
    'slow-down': 'accountErrSlow',
    /* The two ways the Google half can end with nothing to name: the sealed
       note has run out — it is good for fifteen minutes — or that Google
       account already has an account here, which two tabs or a back button
       will do. The remedy is the same sentence for both, and it is the map
       sheet's own: press Continue with Google again. */
    'no-pending': 'accountErrGooglePending',
    linked: 'accountErrGooglePending'
  };

  /* Which refusals mean the name-only form has nothing left to name. Without
     this the page would go on asking for a name it can no longer use, and
     every press would fail the same way — a dead end with a button in it. The
     ordinary fields come back instead, Continue with Google among them. */
  function stillNaming(error) {
    return error !== 'no-pending' && error !== 'linked';
  }

  function composer() {
    var text = el('textarea', {
      id: 'fb-text',
      className: 'lists-input fb-input',
      rows: '4',
      maxlength: String(MAX_TEXT),
      placeholder: t('feedbackHint')
    });
    text.value = state.text;

    var count = el('p', { className: 'lists-hint mono fb-count' });
    /* The ceiling is passed in rather than written into the string. It was
       "{n} / 500" for an hour, which put the cap in ten translations as well
       as in two files — eleven edits to change one number, and ten of them in
       languages nobody reviewing the change can read. */
    var paintCount = function () {
      count.textContent = t('feedbackCount', { n: text.value.length, max: MAX_TEXT });
    };
    text.addEventListener('input', function () {
      state.text = text.value;
      paintCount();
    });
    paintCount();

    var names = account();
    names.hidden = !!state.me || state.as !== 'name';

    var go = el('button', { type: 'submit', className: 'go', textContent: t('feedbackPost') });

    var form = el('form', { className: 'ac-form', action: '#', method: 'post' }, [
      /* Above the fields, both of them: nobody looks under the button they
         have already pressed. The sixth design rule. */
      state.note ? el('p', { className: 'ac-note', textContent: state.note }) : null,
      state.err ? el('p', { className: 'ac-err', textContent: state.err }) : null,
      field('fb-text', t('feedbackYours'), null, text),
      count,
      postAs(function (which) {
        state.as = which;
        names.hidden = !!state.me || which !== 'name';
      }),
      names,
      el('div', { className: 'lists-row lists-acts' }, [go])
    ]);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      say(go);
    });

    return el('section', { className: 'card lists-card' }, [form]);
  }

  function say(go) {
    var body = {
      action: 'say',
      text: state.text,
      as: state.as,
      client: clientId()
    };

    if (state.as === 'name' && !state.me) {
      body.username = state.user;
      /* Nothing to send when Google has already proved who this is: the
         account it makes has no password at all, and the route reads the
         sealed note rather than a field. */
      if (!state.naming) body.password = state.pass;
    }

    /* Against a second press while the first is in flight. Nothing re-enables
       it: every way out of this ends in render(), which builds a fresh form
       with a fresh button on it. */
    go.disabled = true;
    TTBTrack.event('feedback_post', { feedback_as: state.as });

    post(body).then(function (a) {
      if (!a.ok) {
        var why = a.out && a.out.error;
        state.err = t(ERRORS[why] || 'listsErrGeneric');
        state.note = '';
        if (state.naming && !stillNaming(why)) state.naming = false;
        return render();
      }
      storeDrop(DRAFT_KEY);
      /* Signed in on the way past, or signed in already. Either way the name
         is now the site's answer to who this is. */
      var fresh = !state.me && a.out.me;
      state.me = a.out.me || state.me;
      /* Named, if that is what this was. The sealed note is spent and the
         route has cleared it. */
      if (state.me) state.naming = false;
      state.as = a.out.said.name ? 'name' : 'anon';
      state.note = fresh ? t('feedbackPostedNew', { name: state.me }) : t('feedbackPosted');
      state.err = '';
      /* The three boxes are empty again: the sentence is on the page now, and
         a password left sitting in a field on a page somebody is going to go
         on reading is a password on a shared laptop. */
      state.text = '';
      state.user = '';
      state.pass = '';
      state.rows.unshift(a.out.said);
      state.ready = true;
      render();
      paintWho();
    }).catch(function () {
      state.err = t('listsErrGeneric');
      state.note = '';
      render();
    });
  }

  /* -------------------------------------------------------------- the page */

  function rows() {
    if (!state.ready) return el('p', { className: 'lists-none', textContent: t('feedbackFail') });
    if (!state.rows.length) return el('p', { className: 'lists-none', textContent: t('feedbackNone') });
    return el('ul', { className: 'lists-index' }, state.rows.map(card));
  }

  function more() {
    if (!state.more) return null;
    var b = el('button', { type: 'button', className: 'alt', textContent: t('listsAllMore') });
    b.addEventListener('click', function () {
      b.disabled = true;
      TTBTrack.event('feedback_more', { feedback_page: state.page + 1 });
      load(state.page + 1).then(function (answer) {
        state.page += 1;
        take(answer, true);
        render();
      });
    });
    return el('div', { className: 'lists-more' }, [b]);
  }

  /* One place decides what the page is showing, so nothing can be left
     standing from the state before. */
  function render() {
    clear(main);
    main.appendChild(el('div', { className: 'lists-stack' }, [
      el('header', { className: 'blog-head' }, [
        el('p', { className: 'eyebrow', textContent: t('eyebrow') }),
        el('h1', { className: 'blog-title', textContent: t('feedbackTitle') }),
        el('p', { className: 'blog-lead', textContent: t('feedbackLead') })
      ]),
      composer(),
      rows(),
      more()
    ]));
  }

  /* The name in the header, which is a link to the map's account sheet: the
     one place on this site that knows how to sign anybody out. */
  function paintWho() {
    var who = document.getElementById('fb-who');
    if (!who) return;
    who.hidden = !state.me;
    who.textContent = state.me || '';
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

    /* Coming back from Google. /api/google redirects here carrying one word
       saying how it went, and this page handles every one of them itself:
       `in` and `linked` arrive with a session and need nothing said, `name`
       is answered by the composer asking for a name — /api/feedback sees the
       sealed note and says `naming` — and the last two are a sentence above
       the fields. Nothing is sent to the map and back. */
    var google = new URLSearchParams(window.location.search).get('google');

    /* Whatever was in the field when this browser left for Google. Read once,
       here rather than inside the composer, because the composer is drawn
       again every time anything on this page changes and a draw should draw.
       Dropped as it is read, so a reload a day later is an empty field rather
       than a sentence somebody has forgotten writing. */
    var draft = storeGet(DRAFT_KEY);
    if (draft) {
      state.text = draft.slice(0, MAX_TEXT);
      storeDrop(DRAFT_KEY);
    }

    Promise.all([getJSON(UI_URL), load(0)]).then(function (answers) {
      state.ui = answers[0];
      state.lang = pickLanguage(Object.keys(state.ui));
      applyStaticStrings();
      take(answers[1], false);

      if (google === 'failed' || google === 'taken') {
        state.err = t(google === 'taken' ? 'accountErrGoogleTaken' : 'accountErrGoogle');
      }

      render();
      paintWho();
      document.title = t('feedbackDocumentTitle');
      mountRadio();

      /* The address carried a word from Google and has been read; taking it
         off keeps a refresh from replaying it. */
      if (google) window.history.replaceState({}, '', PAGE);
    }).catch(function (err) {
      /* Whatever went wrong, the reader gets a sentence rather than an empty
         page. Reached through state.ui rather than t(), and with the English
         written out behind it, because the thing that failed may well be
         ui.json — and t() with no strings in it returns the key, which is a
         visitor reading "loadError" off the page. Same last resort the map,
         the lists and the blog all fall back on. */
      clear(main);
      main.appendChild(el('div', { className: 'lists-stack' }, [
        el('div', { className: 'card lists-card' }, [
          el('p', { className: 'blog-lead', textContent: (state.ui.en && state.ui.en.loadError) ||
            'Something went wrong loading the data. Try refreshing the page.' })
        ])
      ]));
      if (window.console && window.console.error) window.console.error(err);
    });
  }

  boot();
})();
