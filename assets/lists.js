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
    lists: [],         // the index: the ones you made
    kept: [],          // the index: the ones you bookmarked, somebody else's
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

  /* Every list opens on the map, which is where places belong: the whole list
     as pins, in the order its owner put them in. One href, built in one
     place, so the two index sections and both list heads cannot drift.

     ?list= rather than a path of its own. The map is one page and the map's
     doors are query parameters — ?spot=, ?type=, ?story=, ?account= — and
     this is another door onto the same map rather than a second map. */
  function mapHref(id) {
    return '/?list=' + encodeURIComponent(id);
  }

  function mapLink(id, className) {
    return el('a', {
      className: className || 'lists-alt',
      href: mapHref(id),
      textContent: t('listsOnMap')
    });
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
    } else {
      var ul = el('ul', { className: 'lists-index' });
      state.lists.forEach(function (l) { ul.appendChild(indexRow(l)); });
      wrap.appendChild(ul);
    }

    /* The other half of the page: the lists you kept, which are somebody
       else's. It is drawn only when there is one, and that is deliberate —
       an empty "Lists you kept" heading under an empty "Your lists" is a page
       explaining two features to somebody who has not used either. The
       heading arriving with the first keep is how anybody learns the section
       is there, the same way the map's Saved chip arrives with the first
       mark. */
    if (state.kept.length) {
      wrap.appendChild(el('h2', { className: 'lists-section', textContent: t('listsKept') }));
      var kul = el('ul', { className: 'lists-index' });
      state.kept.forEach(function (l) { kul.appendChild(keptRow(l)); });
      wrap.appendChild(kul);
    }

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
        /* How many people kept it. On your own list this is the only place
           the number appears in the index, and it is the one fact about a
           list you wrote that you cannot know by looking at it. */
        keepCount(l.keeps),
        !l.public ? el('span', { className: 'lists-private', textContent: t('listsPrivate') }) : null
      ])
    ]);
    /* Sits outside the link rather than inside it: a link inside a link is
       not a thing HTML has, and the row is a link to the list itself. */
    return el('li', { className: 'lists-index-row' }, [link, mapLink(l.id, 'lists-index-map')]);
  }

  /* A list somebody else made, which you kept. The same row with one thing
     added and one taken away: it says whose it is, and it has no private
     pill — a list you can see is a list that is public, and a private one
     would not be in this section at all. */
  function keptRow(l) {
    var link = el('a', { className: 'lists-index-link', href: '/list/' + l.id }, [
      el('span', { className: 'lists-index-title', textContent: l.title }),
      el('span', { className: 'lists-index-meta mono' }, [
        l.by ? el('span', { className: 'lists-index-by', textContent: t('listsBy', { name: l.by }) }) : null,
        el('span', { textContent: countLabel(l.n) }),
        keepCount(l.keeps)
      ])
    ]);
    return el('li', { className: 'lists-index-row' }, [link, mapLink(l.id, 'lists-index-map')]);
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
     nothing that looks like a control — except the two things that are about
     you rather than about them. Keeping it, and opening it on the map. */
  function listHead(list) {
    return card([
      el('p', { className: 'eyebrow', textContent: t('listsEyebrow') }),
      heading(list.title),
      list.by ? el('p', { className: 'lists-by mono', textContent: t('listsBy', { name: list.by }) }) : null,
      list.intro ? el('p', { className: 'lists-say', textContent: list.intro }) : null,
      el('div', { className: 'lists-row' }, [
        keepControl(list),
        mapLink(list.id),
        button(t('listsShare'), 'lists-alt', shareList),
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
   */
  function keepControl(list) {
    var count = el('span', { className: 'lists-keeps mono' });

    function paintCount(n) {
      count.textContent = !n ? '' : n === 1 ? t('listsKeptOne') : t('listsKeptN', { n: n });
      count.hidden = !n;
    }
    paintCount(list.keeps || 0);

    if (!state.me) {
      return el('span', { className: 'lists-keep-wrap' }, [
        el('a', {
          className: 'lists-alt lists-keep',
          href: accountHref('up'),
          html: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICON_KEEP + '</svg>',
          'aria-label': t('listsKeepIn')
        }, [el('span', { textContent: t('listsKeep') })]),
        count
      ]);
    }

    var b = el('button', {
      type: 'button',
      className: 'lists-alt lists-keep' + (list.kept ? ' is-kept' : ''),
      'aria-pressed': String(!!list.kept),
      html: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICON_KEEP + '</svg>'
    }, [el('span', { textContent: t(list.kept ? 'listsKeptThis' : 'listsKeep') })]);

    b.addEventListener('click', function () {
      /* The mark flips first and the request follows it. A bookmark that
         waits for a round trip before it looks pressed feels broken on a
         phone, and there is nothing here that a failure cannot put back. */
      var want = !list.kept;
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
        el('span', { className: 'lists-count mono', textContent: countLabel(list.items.length) }),
        /* Your own list has no keep button — it is already under Your lists,
           and the same list twice on one page is not a feature. The count is
           here though: it is the one fact about a list you wrote that you
           cannot learn by reading it. */
        keepCount(list.keeps)
      ]),
      el('div', { className: 'lists-row lists-acts' }, [
        mapLink(list.id),
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
        say
      ]),
      moves
    ]);
    carry(row, item, grip);
    return row;
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
     Everything above it decides `to`; this splices, redraws and tells the
     server. */
  function reorder(from, to, focus) {
    if (from === to) return;
    var items = state.list.items;

    /* Anything typed and not yet written goes first: the rows are about to be
       rebuilt, and a pending write reads its value off the node it was typed
       into. */
    flushAll();

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

    post({
      action: 'order',
      id: state.list.id,
      places: items.map(function (it) { return it.place; })
    }).then(function (a) { if (!a.ok) failed(a.out); }).catch(function () { failed({}); });
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
   * The picker searches about eight hundred places — my seventy-four and the
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
    b.addEventListener('click', function () { addForm(typed); });
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
      className: 'lists-alt picker-back',
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

    var canvas = el('div', { className: 'picker-map', id: 'picker-map' });
    var hint = el('p', { className: 'picker-note', textContent: t('listsAddPin') });
    var go = el('button', { type: 'button', className: 'lists-go', textContent: t('listsAddIt') });

    var form = el('div', { className: 'picker-add-form' }, [
      back,
      el('h3', { className: 'picker-title', textContent: t('listsAddMissing') }),
      name, address, hint, canvas,
      el('div', { className: 'lists-row lists-acts' }, [go])
    ]);
    dom.pickerBody.appendChild(form);
    name.focus();

    /* The pin's position, kept here rather than read off the marker, so the
       submit below works the same whether or not the map ever loaded. */
    var at = { lat: CITY[0], lng: CITY[1] };
    var ready = false;

    ensureLeaflet().then(function (L) {
      var map = L.map(canvas, {
        center: CITY,
        zoom: 13,
        zoomControl: true,
        attributionControl: true
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
          'contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      }).addTo(map);

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
      live: $('lists-live'),
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
      state.kept = out.kept || [];
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
