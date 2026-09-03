/* Tallinn Tastebuds — the lists page.
 *
 * The map is mine. A list is somebody else's, and this is the whole of it:
 * making one, filling it, saying something about each place, and the page a
 * stranger lands on when the link is sent to them.
 *
 * Plain browser JavaScript, no modules, no build step, no Leaflet — a list is
 * text and this page does not draw a map. It shares the tokens, the card, the
 * eyebrow and the toast with assets/styles.css and adds its own in
 * assets/lists.css.
 *
 * TWO ADDRESSES, ONE FILE
 *
 *   /lists.html      your own lists: the index, and the box that makes a new
 *                    one. Nothing here without an account.
 *
 *   /list/<id>       one list. Served by functions/list/[id].js, which hands
 *                    back this same document with the list's own title and
 *                    social card in the head and the list itself seeded into
 *                    the page — so a shared link unfurls as what it is, and
 *                    draws without a second round trip.
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
  var API = '/api/lists';

  /* What the server accepts, said again here so a field can stop somebody at
     the keystroke rather than at the round trip. The server is the one that
     binds — these are the same numbers as functions/api/lists.js. */
  var MAX_TITLE = 60;
  var MAX_INTRO = 200;
  var MAX_SAY = 280;
  var MAX_ITEMS = 20;

  /* The other end of the same judgement. Two places is a pair of opinions
     rather than a recommendation, so a list is three at the least: the page
     offers three empty places from the moment it is made, and the link is not
     worth sending until they are filled. Nothing is ever deleted for falling
     under it — an unfinished list is simply not sharable yet. */
  var MIN_ITEMS = 3;

  /* How long the page waits after the last keystroke before it writes a note
     to the server. Long enough that typing a sentence is one request and not
     forty; short enough that closing the tab a moment after finishing does
     not lose the sentence. Every pending write is also flushed on blur and on
     the page being hidden, which is what actually catches the closed tab. */
  var SAY_DEBOUNCE = 900;

  var state = {
    ui: {},
    lang: DEFAULT_LANG,
    /* 'index' | 'one'. Which of the two addresses this is. */
    view: 'index',
    id: '',
    me: null,          // the signed-in username, or null
    ready: false,      // whether the API says lists work at all here
    reached: true,     // whether it answered at all
    lists: [],         // the index
    list: null,        // the one being shown
    places: null,      // /api/places, loaded the first time the picker opens
    hay: null          // id -> folded searchable text
  };

  var dom = {};
  var toastTimer = null;

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

  function post(payload) {
    return fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (out) {
        return { ok: res.ok, out: out || {} };
      });
    });
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
    place: 'listsErrPlace'
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

  function heading(text, small) {
    return el(small ? 'h2' : 'h1', { className: 'lists-title', textContent: text });
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
    b.addEventListener('click', onClick);
    return b;
  }

  var ICON_UP = '<path d="M12 19V6M6 12l6-6 6 6"/>';
  var ICON_DOWN = '<path d="M12 5v13M18 12l-6 6-6-6"/>';
  var ICON_X = '<path d="M6 6l12 12M18 6L6 18"/>';
  var ICON_PIN = '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>';

  /* ----------------------------------------------------------------- render
   * One function decides which of the page's states is on screen, so nothing
   * can be left over from the one before it.
   */
  function render() {
    clear(dom.main);
    paintWho();

    if (!state.reached) return dom.main.appendChild(renderUnreachable());
    if (!state.ready) return dom.main.appendChild(renderNotReady());
    if (state.view === 'one') return dom.main.appendChild(renderOne());
    return dom.main.appendChild(renderIndex());
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
      el('a', { className: 'lists-alt', href: '/', textContent: t('listsBack') })
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
      el('a', { className: 'lists-alt', href: '/', textContent: t('listsBack') })
    ]);
  }

  /* ------------------------------------------------------------ your lists */

  function renderIndex() {
    if (!state.me) return renderInvitation();

    var wrap = el('div', { className: 'lists-stack' });

    wrap.appendChild(card([
      el('p', { className: 'eyebrow', textContent: t('listsEyebrow') }),
      heading(t('listsYours')),
      el('p', { className: 'lists-say', textContent: t('listsWhat') }),
      newListForm()
    ]));

    if (!state.lists.length) {
      wrap.appendChild(el('p', { className: 'lists-none', textContent: t('listsNone') }));
      return wrap;
    }

    var ul = el('ul', { className: 'lists-index' });
    state.lists.forEach(function (l) { ul.appendChild(indexRow(l)); });
    wrap.appendChild(ul);
    return wrap;
  }

  function newListForm() {
    var form = el('form', { className: 'lists-new' });
    var field = el('input', {
      type: 'text',
      className: 'lists-input',
      id: 'new-title',
      maxlength: String(MAX_TITLE),
      autocomplete: 'off',
      'aria-label': t('listsNewName'),
      placeholder: t('listsNewHint')
    });
    var go = el('button', { type: 'submit', className: 'lists-go', textContent: t('listsCreate') });

    form.appendChild(field);
    form.appendChild(go);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var title = field.value.trim();
      if (!title) { field.focus(); return; }
      go.disabled = true;
      go.textContent = t('accountWorking');
      post({ action: 'create', title: title }).then(function (a) {
        if (!a.ok) {
          go.disabled = false;
          go.textContent = t('listsCreate');
          return failed(a.out);
        }
        /* Straight into the empty list, because the next thing anybody wants
           after naming one is to put something on it. */
        window.location.href = '/list/' + a.out.id;
      }).catch(function () {
        go.disabled = false;
        go.textContent = t('listsCreate');
        failed({});
      });
    });
    return form;
  }

  function indexRow(l) {
    var link = el('a', { className: 'lists-index-link', href: '/list/' + l.id }, [
      el('span', { className: 'lists-index-title', textContent: l.title }),
      el('span', { className: 'lists-index-meta mono' }, [
        el('span', { textContent: countLabel(l.n) }),
        !l.public ? el('span', { className: 'lists-private', textContent: t('listsPrivate') }) : null
      ])
    ]);
    return el('li', { className: 'lists-index-row' }, [link]);
  }

  /* Signed out, on your own lists page. Not a wall in front of the map — the
     map needs no account and never will — but this page genuinely cannot show
     anything without knowing whose lists to show. So it says what a list is
     first and asks second. */
  function renderInvitation() {
    return card([
      el('p', { className: 'eyebrow', textContent: t('listsEyebrow') }),
      heading(t('listsTitle')),
      el('p', { className: 'lists-say', textContent: t('listsWhat') }),
      el('p', { className: 'lists-say', textContent: t('listsNeedAccount') }),
      el('div', { className: 'lists-row' }, [
        el('a', { className: 'lists-go', href: accountHref('up'), textContent: t('accountCreate') }),
        el('a', { className: 'lists-alt', href: accountHref('in'), textContent: t('accountSignIn') })
      ])
    ]);
  }

  /* -------------------------------------------------------------- one list */

  function renderOne() {
    var list = state.list;

    if (!list) {
      return card([
        el('p', { className: 'eyebrow', textContent: t('listsEyebrow') }),
        heading(t('listsGoneTitle')),
        el('p', { className: 'lists-say', textContent: t('listsErrGone') }),
        el('a', { className: 'lists-alt', href: '/', textContent: t('listsBack') })
      ]);
    }

    var wrap = el('div', { className: 'lists-stack' });
    wrap.appendChild(list.mine ? listHeadMine(list) : listHead(list));

    var ol = el('ol', { className: 'list-items' });
    list.items.forEach(function (item, i) {
      ol.appendChild(list.mine ? itemRowMine(item, i) : itemRow(item, i));
    });

    /* Your own list, and not yet three places long: the rest of the three are
       drawn as empty rows you can press. An empty list used to be a sentence
       saying it was empty and a button somewhere below it; three numbered
       gaps say the same thing and also say how many, which is the part a
       first list needs to be told. */
    var short = list.mine ? MIN_ITEMS - list.items.length : 0;
    for (var slot = 0; slot < short; slot++) {
      ol.appendChild(slotRow(list.items.length + slot));
    }
    wrap.appendChild(ol);

    if (!list.items.length && !list.mine) {
      wrap.appendChild(el('p', { className: 'lists-none', textContent: t('listsEmpty') }));
    }
    if (list.mine) {
      wrap.appendChild(el('div', { className: 'lists-row lists-foot' }, [
        /* Under three, the empty rows above are the invitation and a second
           one here would only ask the same question twice. */
        short > 0 ? null : button(t('listsAddMore'), 'lists-go', openPicker),
        button(t('listsDelete'), 'lists-alt is-danger', deleteList)
      ]));
    } else {
      wrap.appendChild(el('a', { className: 'lists-alt', href: '/', textContent: t('listsBack') }));
    }

    return wrap;
  }

  /* Somebody else's list: their title, their name, their sentences, and
     nothing that looks like a control. */
  function listHead(list) {
    return card([
      el('p', { className: 'eyebrow', textContent: t('listsEyebrow') }),
      heading(list.title),
      list.by ? el('p', { className: 'lists-by mono', textContent: t('listsBy', { name: list.by }) }) : null,
      list.intro ? el('p', { className: 'lists-say', textContent: list.intro }) : null,
      el('div', { className: 'lists-row' }, [
        button(t('listsShare'), 'lists-alt', shareList),
        el('span', { className: 'lists-count mono', textContent: countLabel(list.items.length) })
      ])
    ]);
  }

  /* Your own: the same card, with the title and the line under it as fields
     you can type into. No edit mode and no save button — a list is small
     enough that the page can simply be the thing, and every field writes
     itself when you leave it. */
  function listHeadMine(list) {
    var title = el('input', {
      type: 'text',
      className: 'lists-input lists-input-title',
      value: list.title,
      maxlength: String(MAX_TITLE),
      'aria-label': t('listsRename')
    });
    commitOnLeave(title, function (value) {
      var next = value.trim();
      if (!next || next === list.title) { title.value = list.title; return; }
      list.title = next;
      return post({ action: 'edit', id: list.id, title: next });
    });

    var intro = el('input', {
      type: 'text',
      className: 'lists-input',
      value: list.intro,
      maxlength: String(MAX_INTRO),
      'aria-label': t('listsIntro'),
      placeholder: t('listsIntroHint')
    });
    commitOnLeave(intro, function (value) {
      var next = value.trim();
      if (next === list.intro) return;
      list.intro = next;
      return post({ action: 'edit', id: list.id, intro: next });
    });

    var ready = list.items.length >= MIN_ITEMS;

    /* Sharing is the last thing you do to a list, so it is the last button on
       the card, and it waits until there is a list to send. Saving sits after
       it because it is the one press that is always available and always
       means the same thing. */
    var share = button(t('listsShare'), 'lists-alt', shareList);
    if (!ready) {
      share.disabled = true;
      share.title = t('listsShareNeeds');
    }

    return card([
      el('p', { className: 'eyebrow', textContent: t('listsYours') }),
      title,
      intro,
      el('div', { className: 'lists-row' }, [
        visibility(list),
        el('span', { className: 'lists-count mono', textContent: countLabel(list.items.length) })
      ]),
      el('div', { className: 'lists-row lists-acts' }, [
        share,
        button(t('listsSave'), 'lists-go', saveList)
      ]),
      ready ? null : el('p', { className: 'lists-hint mono', textContent: t('listsShareNeeds') })
    ]);
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
   * Real radios rather than buttons wearing the part, because arrow keys,
   * screen readers and the word "selected" all come with them.
   */
  function visibility(list) {
    var name = 'who-' + list.id;

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
      }, [input, el('span', { textContent: t(isPublic ? 'listsWhoLink' : 'listsWhoMe') })]);

      input.addEventListener('change', function () {
        if (!input.checked || list.public === isPublic) return;
        list.public = isPublic;
        var opts = label.parentNode.querySelectorAll('.lists-seg-opt');
        for (var i = 0; i < opts.length; i++) opts[i].classList.toggle('is-on', opts[i] === label);
        post({ action: 'edit', id: list.id, public: isPublic }).then(function (a) {
          if (!a.ok) failed(a.out);
        }).catch(function () { failed({}); });
      });

      return label;
    };

    return el('fieldset', { className: 'lists-vis' }, [
      el('legend', { className: 'lists-vis-legend mono', textContent: t('listsWho') }),
      el('div', { className: 'lists-seg' }, [option(true), option(false)])
    ]);
  }

  /* Everything on this page writes itself — a note when the typing pauses, a
     title when you leave the field — so there is nothing here that a press
     could fail to send. The button exists because that is not visible: it
     takes whatever is half typed, sends it now, and says so. */
  function saveList() {
    var focused = document.activeElement;
    if (focused && focused.blur && focused !== document.body) focused.blur();
    flushAll();
    toast(t('listsSaved'));
  }

  /* ------------------------------------------------------------- one place */

  /* Where a row points. A place on my map goes to its write-up; anything else
     goes to Google Maps, by coordinates when the catalogue has them and by
     name when it does not. A place the catalogue has lost since it was added
     points nowhere at all, and says so. */
  function placeHref(item) {
    /* `mapId` is set when the row's id is a Google key for a place that is
       also on my map: the write-up is filed under the map's own id, not
       Google's. Everything else points at itself. */
    if (item.map) return '/?spot=' + encodeURIComponent(item.mapId || item.place);
    if (item.lat !== null && item.lng !== null) {
      return 'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent(item.lat + ',' + item.lng);
    }
    if (!item.address) return '';
    return 'https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent(item.name + ' ' + item.address);
  }

  function placeName(item) {
    var href = placeHref(item);
    if (!href) {
      return el('span', { className: 'item-name is-lost', textContent: item.name });
    }
    var out = { className: 'item-name', href: href };
    if (!item.map) { out.target = '_blank'; out.rel = 'noopener'; }
    return el('a', out, [
      el('span', { textContent: item.name }),
      el('span', {
        className: 'item-where mono',
        html: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICON_PIN + '</svg>'
      })
    ]);
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

  function itemRow(item, i) {
    return el('li', { className: 'item' }, [
      el('span', { className: 'item-n mono', 'aria-hidden': 'true', textContent: String(i + 1) }),
      el('div', { className: 'item-body' }, [
        placeName(item),
        item.address ? el('p', { className: 'item-address mono', textContent: item.address }) : null,
        item.say ? el('p', { className: 'item-say', textContent: item.say }) : null
      ])
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
    debounceSay(say, item);

    var moves = el('div', { className: 'item-moves' }, [
      iconButton('listsUp', ICON_UP, function () { move(item.place, -1); }),
      iconButton('listsDown', ICON_DOWN, function () { move(item.place, 1); }),
      iconButton('listsRemove', ICON_X, function () { drop(item.place); }, 'is-danger')
    ]);

    return el('li', { className: 'item is-mine' }, [
      el('span', { className: 'item-n mono', 'aria-hidden': 'true', textContent: String(i + 1) }),
      el('div', { className: 'item-body' }, [
        placeName(item),
        item.address ? el('p', { className: 'item-address mono', textContent: item.address }) : null,
        say
      ]),
      moves
    ]);
  }

  /* ------------------------------------------------------- writing a note
   * The one field on this page somebody spends real time in, so it is the one
   * that must not lose anything. Three things write it: a pause in the typing,
   * leaving the field, and the page being hidden — which is what a phone does
   * when the tab is switched away or the screen is locked, and the last moment
   * a script gets before it may never run again.
   */
  var pending = [];   /* [{ node, run }] — writes typed but not yet sent */

  function queue(node, run) {
    for (var i = 0; i < pending.length; i++) {
      if (pending[i].node === node) { pending[i].run = run; return; }
    }
    pending.push({ node: node, run: run });
  }

  /* `leaving` says the page is going away, and it changes how the write is
     sent — see beacon() below. It is passed down rather than read off a
     variable so that the ordinary flushes, the ones a move or a removal does,
     cannot be caught by it. */
  function flush(node, leaving) {
    for (var i = pending.length - 1; i >= 0; i--) {
      if (node && pending[i].node !== node) continue;
      var job = pending[i].run;
      pending.splice(i, 1);
      var out = job(leaving);
      if (out && out.then) out.then(function (a) { if (a && !a.ok) failed(a.out); }).catch(function () {});
    }
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

  function debounceSay(node, item) {
    var timer = null;

    var write = function (leaving) {
      var value = node.value.trim().slice(0, MAX_SAY);
      if (value === (item.say || '')) return;
      item.say = value;
      var payload = { action: 'say', id: state.list.id, place: item.place, say: value };
      return leaving ? beacon(payload) : post(payload);
    };

    node.addEventListener('input', function () {
      queue(node, write);
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { flush(node); }, SAY_DEBOUNCE);
    });
    node.addEventListener('blur', function () {
      if (timer) clearTimeout(timer);
      flush(node);
    });
  }

  /* A field whose value is written when you leave it, and only if it changed.
     Used for the title and the line under it, which are one line each and do
     not want the typing-pause treatment. */
  function commitOnLeave(node, write) {
    var send = function () {
      var out = write(node.value);
      if (out && out.then) {
        out.then(function (a) { if (!a.ok) failed(a.out); }).catch(function () { failed({}); });
      }
    };
    node.addEventListener('blur', send);
    node.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); node.blur(); }
    });
  }

  /* --------------------------------------------------------------- moving */

  /* Two buttons rather than a drag. A drag is the nicer gesture on a desktop
     and the worse one on a phone, where it fights the page's own scrolling,
     and it is no gesture at all on a keyboard. Up and down are the same move
     for a thumb, a mouse and a Tab key.

     The whole order goes to the server — see order() in the API for why a
     move is not sent as a move. */
  function move(place, delta) {
    var items = state.list.items;
    var at = -1;
    for (var i = 0; i < items.length; i++) if (items[i].place === place) { at = i; break; }
    var to = at + delta;
    if (at === -1 || to < 0 || to >= items.length) return;

    /* Anything typed and not yet written goes first: the rows are about to be
       rebuilt, and a pending write reads its value off the node it was typed
       into. */
    flushAll();

    items.splice(to, 0, items.splice(at, 1)[0]);
    render();
    /* The row that moved keeps the focus, so a keyboard can press the same
       button again and walk a place up the list. */
    var row = dom.main.querySelectorAll('.item')[to];
    var btn = row && row.querySelector(delta < 0 ? '.row-btn' : '.row-btn + .row-btn');
    if (btn) btn.focus();

    post({
      action: 'order',
      id: state.list.id,
      places: items.map(function (it) { return it.place; })
    }).then(function (a) { if (!a.ok) failed(a.out); }).catch(function () { failed({}); });
  }

  function drop(place) {
    flushAll();
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
    post({ action: 'delete', id: list.id }).then(function (a) {
      if (!a.ok) return failed(a.out);
      window.location.href = '/lists.html';
    }).catch(function () { failed({}); });
  }

  /* --------------------------------------------------------------- sharing
   * The share sheet where there is one, which is every phone this site is
   * actually read on, and the clipboard everywhere else. Both end in the same
   * place: a URL in somebody's hand.
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

    if (navigator.share) {
      navigator.share(payload).catch(function () { /* dismissed, which is fine */ });
      return;
    }
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
    dom.pickerScrim.hidden = false;
    document.body.classList.add('has-scrim');
    dom.pickerSearch.value = '';
    dom.pickerClear.hidden = true;
    dom.pickerSearch.focus();

    if (state.places) { paintPicker(); return; }

    clear(dom.pickerBody);
    dom.pickerBody.appendChild(el('p', { className: 'picker-note', textContent: t('accountWorking') }));

    getJSON('/api/places').then(function (answer) {
      var places = Array.isArray(answer) ? answer : (answer && answer.places) || [];
      state.places = places;
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
    if (!state.places) return;

    var words = fold(dom.pickerSearch.value).replace(/\s+/g, ' ').replace(/^ | $/g, '');
    var terms = words ? words.split(' ') : [];

    var on = {};
    state.list.items.forEach(function (it) { on[it.place] = true; });

    /* Full: every row goes grey and says why, once, at the top. The server
       refuses the twenty-first place anyway, but finding that out by watching
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

    if (!found.length) {
      dom.pickerBody.appendChild(el('p', {
        className: 'picker-note',
        textContent: terms.length ? t('searchNone', { q: dom.pickerSearch.value.trim() }) : t('listsSearchHint')
      }));
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
  }

  function pickerRow(place, already, full) {
    var row = el('button', {
      type: 'button',
      className: 'picker-row' + (already ? ' is-on' : ''),
      disabled: already || full || null
    }, [
      el('span', { className: 'picker-name', textContent: place.name }),
      el('span', { className: 'picker-address mono', textContent: place.address || '' }),
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

    /* Anything typed and not yet written goes first, for the same reason move()
       and drop() do it: render() below rebuilds every row, and a pending write
       reads its value off the textarea it was typed into. Once that node is
       gone the write sends whatever the new node happens to hold — so adding a
       place while a sentence was half typed used to overwrite the sentence. */
    flushAll();

    /* Optimistic, the way the save mark on the map is: the row appears at once
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

  /* ------------------------------------------------------------------ wire */

  function wire() {
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
       away, the screen is locked, the browser is put in the background. A
       sentence half typed is written now or possibly never. */
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
  function wantedList() {
    var seeded = window.__TTB_LIST;
    if (seeded && seeded.id) return seeded.id;
    var m = /^\/list\/([a-z0-9][a-z0-9-]{2,47})\/?$/.exec(window.location.pathname);
    if (m) return m[1];
    return new URLSearchParams(window.location.search).get('list') || '';
  }

  function boot() {
    dom = {
      main: $('main'),
      who: $('lists-who'),
      toast: $('toast'),
      pickerScrim: $('picker-scrim'),
      pickerClose: $('picker-close'),
      pickerSearch: $('picker-search'),
      pickerClear: $('picker-clear'),
      pickerBody: $('picker-body')
    };

    var id = wantedList();
    state.id = id;
    state.view = id ? 'one' : 'index';

    /* The strings and the data at once. The strings are a static file behind a
       revalidating cache and usually free; the data is the one request this
       page cannot start without. */
    var strings = getJSON('/data/ui.json');
    var seeded = window.__TTB_LIST && window.__TTB_LIST.list;
    var data = seeded
      ? Promise.resolve({
          status: 200,
          out: { ready: true, user: window.__TTB_LIST.user || null, list: seeded }
        })
      : ask(id ? API + '?id=' + encodeURIComponent(id) : API);

    Promise.all([strings, data]).then(function (loaded) {
      state.ui = loaded[0] || {};
      state.lang = pickLanguage(Object.keys(state.ui).sort());
      applyStaticStrings();
      document.title = t('listsDocumentTitle');

      var answer = loaded[1];
      var out = answer.out;

      /* Nothing came back at all. Everything below would be a guess. */
      state.reached = answer.status !== 0;
      /* A 404 is an answer, and a specific one: the API is working and that
         list is not there — deleted, mistyped, or private and not yours. It
         leaves `ready` true so the page says that rather than something
         about the site being switched off. */
      state.ready = answer.status === 404 ? true : !!out.ready;
      state.me = out.user || null;
      state.lists = out.lists || [];
      state.list = out.list || null;

      /* A seeded page already carries the list's own title in the head; only
         a page that fetched one has to set it. */
      if (state.list) document.title = state.list.title + ' | Tallinn Tastebuds';

      wire();
      render();
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
