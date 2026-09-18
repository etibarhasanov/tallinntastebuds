/**
 * Tallinn Tastebuds — /flashcard.html, and flashcard.tallinntastebuds.ee.
 *
 * WHAT THIS PAGE IS
 *
 * A site about eating in Tallinn is read mostly by people who cannot read the
 * menu. This is the other half of that: ten decks of Estonian, two hundred
 * and three cards, Estonian on the front and English on the back, and one card
 * at a time with two words under it — Knew it, and Show me again.
 *
 * It is on its own hostname for the reason splitwise is: it is not the map,
 * and a sixth card on the account page reading "Flashcards" would have been a
 * second product filed under somebody's saved places.
 * functions/_middleware.js is what makes the subdomain the front door to this
 * page and sends every other address on it back to the map; the page itself
 * answers at /flashcard on every host, including the previews under
 * *.tallinntastebuds.pages.dev where a subdomain of the live domain cannot
 * exist at all.
 *
 * functions/flashcard.js serves the document, the way functions/split.js
 * serves that one — and for a different reason. A group's link is pasted into
 * a chat, so that head carries the group's name. Nothing here is ever sent to
 * anybody: what that route is for is the ten decks the site ships being
 * indexed, so it writes the deck's own head and its words into the page as
 * text. Nothing here depends on that having happened — every answer this page
 * draws it fetches for itself, the route is an improvement on the load rather
 * than a requirement for it, and the <main> it writes into is emptied by
 * render() before anything is drawn.
 *
 * HOW ANYBODY FINDS IT, WHICH IS ONE ROW
 *
 * Nothing in the map's chrome points here. The only link to this page on the
 * whole site is a row on /account.html, behind a sign-in, under somebody's own
 * name — the map's chrome is for finding dinner, and a deck of Estonian is
 * something you go to rather than something that should interrupt you.
 *
 * Unlinked is not hidden, though: the decks are in sitemap.xml and indexed,
 * which is the blog's arrangement rather than the split page's. See
 * **Flashcards** in README.md.
 *
 * SIGNED OUT, EVERY DECK STILL WORKS
 *
 * The ten decks the site ships are data/decks.json, and a file has nobody to
 * check. What an account buys is that pressing Knew it is remembered — on the
 * account rather than on the device, so the deck you got half through on a
 * phone is half through on a laptop. Signed out, the run still runs, it is
 * kept in this tab and nowhere else, and the account is offered at the end of
 * it rather than in front of it. That is the shape the map's saves have and
 * very nearly the sentence they are offered with.
 *
 * THE SIGN-IN FORM IS HERE, AND IT IS THE THIRD COPY ON THE SITE
 *
 * Worth being plain about. There is one password form on this site, in
 * assets/app.js, inside the sheet the map opens; /account.html and
 * /lists.html both send people there with ?then= rather than growing a copy.
 * assets/split.js has the second, and its header argues the case: ?then= is
 * deliberately same-host, so sending somebody from a subdomain to the map to
 * sign in and back again is either an open redirect or a dead end.
 *
 * This is the same argument on a second subdomain, and a third copy of a form
 * is the point at which the argument stops being free. What makes it
 * survivable is the same thing that makes split.js's survivable: it is a copy
 * of the *form* and not of the *API*. It posts the same two fields to the
 * same /api/account with the same actions, reads the same errors out of the
 * same map, and prints the same strings out of data/ui.json — accountUsername,
 * accountPassword, accountNoReset, accountGoogle and the rest. Nothing about
 * accounts is decided here.
 *
 * If a fourth ever wants one, the answer is not a fourth copy: it is a shared
 * global beside assets/track.js — TTBAuth, drawing the form and owning the
 * three actions — and the three existing copies moved onto it. That is a
 * refactor of the sign-in on every page of this site and it is deliberately
 * not in the change that brought this page.
 *
 * ONE ADDRESS, AND IT IS A DECK
 *
 * ?d=<id> is the whole of the routing. Without it the page is the decks: the
 * ten the site ships, and yours under them. With it, it is that deck, turning
 * over. A deck somebody wrote has exactly one reader and it is its owner —
 * there is no share link here and holding an id buys nothing, which is the
 * one place this feature deliberately differs from lists and from splitwise.
 *
 * WHAT IT READS
 *
 *   /data/ui.json              every word on this page, in ten languages
 *   /api/flashcard             the decks, and how far you have got in each
 *   /api/flashcard?deck=       one deck, whole, with its cards
 *   /api/account               posted to, to sign in or create an account
 */
(function () {
  'use strict';

  var UI_URL = '/data/ui.json';
  var ACCOUNT_API = '/api/account';
  var FLASH_API = '/api/flashcard';

  /* The same two keys the map writes and every other page reads. Walking from
     the map to here should not feel like leaving. */
  var STYLE_KEY = 'ttb.style';
  var LANG_KEY = 'ttb.lang';

  var STYLES = ['red', 'green'];
  var DEFAULT_STYLE = 'red';
  var DEFAULT_LANG = 'en';

  /* The server binds all three; the fields only stop somebody at the keystroke
     instead of at the round trip. MAX_NAME and MAX_SIDE in
     functions/api/flashcard.js are the ones that count — change one, change
     the other. */
  var MAX_NAME = 60;
  var MAX_SIDE = 60;

  var state = {
    ui: {},
    lang: DEFAULT_LANG,
    reached: true,   // whether /api/flashcard answered at all
    ready: false,    // whether the database is bound and this is its half
    google: false,   // whether Continue with Google is configured here
    user: null,
    decks: [],       // every deck: the shipped ones, then yours
    deck: null,      // the one that is open, whole, with its cards
    run: null,       // the cards left to turn over, and where in them we are
    editing: false,  // a deck of your own, being written rather than turned
    view: 'in'       // which half of the sign-in form: 'in', 'up' or 'google'
  };

  /* Which deck the address is asking for, read once. */
  var asked = new URLSearchParams(window.location.search).get('d') || '';

  /* And what /api/google says came of a round trip, read the same way. The
     five words are the ones in the header of functions/api/google.js; this
     page acts on four of them and lets 'linked' alone, because connecting is
     pressed on the account page and comes back there. */
  var googleSaid = new URLSearchParams(window.location.search).get('google') || '';

  /* Which of the two hostnames this is being read on, and what that changes.
     Same three lines assets/split.js carries, and the same reasoning: on the
     subdomain this page is the bare root and the map is one domain up. */
  var ON_SUBDOMAIN = window.location.hostname.indexOf('flashcard.') === 0;
  var HOME = ON_SUBDOMAIN ? '/' : '/flashcard';
  var MAP = ON_SUBDOMAIN ? 'https://tallinntastebuds.ee/' : '/';

  var main = null;

  /* One of this page's own addresses, carrying whatever ?style= and ?lang= the
     current one arrived with. This page is served from another origin — that
     is what a subdomain is — so the localStorage the map writes those two
     choices into is empty here and there is no swatch on this page to fill it.
     The query string is then the only thing carrying a choice, and dropping it
     on the first link would put somebody who asked for green and Estonian back
     on red and English before they had pressed anything. */
  function at(path) {
    var now = new URLSearchParams(window.location.search);
    var keep = new URLSearchParams();
    ['style', 'lang'].forEach(function (k) { if (now.get(k)) keep.set(k, now.get(k)); });
    var q = keep.toString();
    return q ? path + (path.indexOf('?') === -1 ? '?' : '&') + q : path;
  }

  function deckHref(id) {
    return at(HOME + '?d=' + encodeURIComponent(id));
  }

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

  /* Asked so that "the site did not answer" and "the site answered no" stay
     apart: the first is a network this page cannot fix and the second is a
     fact about the deployment or about the deck. Copied from
     assets/account.js, which says the same thing at more length. */
  function ask(url) {
    return fetch(url, { headers: { accept: 'application/json' } })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (out) {
          return { status: res.status, ok: res.ok, out: out || {} };
        });
      })
      .catch(function () { return { status: 0, ok: false, out: {} }; });
  }

  function post(url, payload) {
    return fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (out) {
        return { ok: res.ok, out: out || {} };
      });
    }).catch(function () { return { ok: false, out: {} }; });
  }

  /* One sentence per refusal either route can send back, and the general one
     for anything else: a visitor should never be shown a word out of the
     source. The account half is the same map assets/app.js keeps, because it
     is the same API answering. */
  var ERRORS = {
    /* the accounts route */
    taken: 'accountErrTaken',
    'no-match': 'accountErrNoMatch',
    password: 'accountErrPassword',
    username: 'accountErrUsername',
    'slow-down': 'accountErrSlow',
    'no-pending': 'accountErrGooglePending',
    linked: 'accountErrGoogleTaken',
    /* this one */
    'not-found': 'flashErrGone',
    'too-many': 'flashErrTooMany',
    full: 'flashErrFull',
    name: 'flashErrName',
    front: 'flashErrFront',
    back: 'flashErrBack',
    'signed-out': 'accountErrSignedOut'
  };

  function say(out) {
    return t(ERRORS[out && out.error] || 'flashErrGeneric');
  }

  /* ------------------------------------------------------------------- boot
   * The style and the language, applied by the page itself before anything is
   * drawn. Every page on this site carries this block; see applyStyle() in
   * assets/lists.js, which is the fullest copy.
   */
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

  /* ----------------------------------------------------------------- pieces */

  function card(kids) {
    return el('section', { className: 'card lists-card' }, kids);
  }

  function heading(said, level) {
    return el(level || 'h1', { className: 'lists-title', textContent: said });
  }

  function foot(kids) {
    return el('p', { className: 'lists-row lists-foot' }, kids);
  }

  /* A hint sits inside the label, for the reason accountField() in
     assets/app.js gives: it is then part of what a screen reader reads when
     the field takes focus, rather than something only a sighted visitor
     finds. */
  function field(id, labelKey, opts) {
    opts = opts || {};
    var kids = [
      el('span', { className: 'ac-label', textContent: t(labelKey) }),
      el('input', {
        id: id,
        type: opts.type || 'text',
        autocomplete: opts.autocomplete || 'off',
        autocapitalize: opts.autocapitalize || 'none',
        autocorrect: 'off',
        spellcheck: 'false',
        maxlength: opts.maxlength || null,
        placeholder: opts.placeholder || null
      })
    ];
    if (opts.hint) kids.push(el('span', { className: 'ac-hint', textContent: opts.hint }));
    return el('label', { className: opts.className ? 'ac-field ' + opts.className : 'ac-field' }, kids);
  }

  function value(form, id) {
    var node = form.querySelector('#' + id);
    return node ? node.value.trim() : '';
  }

  /* The one refusal line a form is allowed to be carrying, put above the
     fields rather than under the button — nobody looks under a button they
     have just pressed — and cleared on the way into the next try. */
  function complain(form, message) {
    var old = form.querySelector('.ac-err');
    if (old) old.parentNode.removeChild(old);
    form.insertBefore(el('p', { className: 'ac-err', role: 'alert', textContent: message }),
                      form.firstChild);
  }

  /* A button that goes busy while the write is in flight and comes back if it
     is refused. `form`, where there is one, is the form this button is the
     action of: wiring the press to the form's submit event rather than to the
     button is what makes Enter in a field do what the button does. */
  function actor(labelKey, className, run, form) {
    var btn = el('button', { type: form ? 'submit' : 'button', className: className, textContent: t(labelKey) });
    var press = function () {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.textContent = t('accountWorking');
      run(function () {
        btn.disabled = false;
        btn.textContent = t(labelKey);
      });
    };
    if (form) form.addEventListener('submit', function (ev) { ev.preventDefault(); press(); });
    else btn.addEventListener('click', press);
    return btn;
  }

  /* Google's mark, four paths, drawn rather than fetched — the same block the
     map's sheet and the split page carry, for the reasons written out in full
     beside GOOGLE_MARK in assets/app.js. */
  var GOOGLE_MARK =
    '<svg viewBox="0 0 48 48" focusable="false">' +
    '<path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>' +
    '<path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>' +
    '<path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/>' +
    '<path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>' +
    '</svg>';

  /* This page as it stands, less the word from the last trip: a stale ?google=
     carried into the next one would report something that did not just happen.
     Everything else is kept, the deck above all, so a trip comes back to the
     deck somebody was turning over. */
  function hereWithoutGoogle() {
    var params = new URLSearchParams(window.location.search);
    params.delete('google');
    var query = params.toString();
    return window.location.pathname + (query ? '?' + query : '');
  }

  /* No ?client= on the way out, unlike the map's: the saves are the map's and
     this page has never had a device id to claim rows under. */
  function googleHref() {
    return '/api/google?then=' + encodeURIComponent(hereWithoutGoogle());
  }

  function googleGo() {
    return TTBTrack.click(
      el('a', { className: 'ac-google', href: googleHref() }, [
        el('span', { className: 'ac-google-mark', 'aria-hidden': 'true', html: GOOGLE_MARK }),
        el('span', { textContent: t('accountGoogle') })
      ]),
      'account_google', { via: 'flashcard' }
    );
  }

  /* ------------------------------------------------------------- signing in
   * Continue with Google, or two fields and a switch between making an
   * account and signing in to one — the same actions, the same fields and the
   * same strings as the map's sheet. See the header for why there is a third
   * copy of this form on the site, and what would end that.
   */
  function authForm(saying) {
    var creating = state.view === 'up';
    /* The third view, and the one nobody chooses: a Google account that has
       just proved itself and has no account here yet. Same form with the
       password half taken out. */
    var naming = state.view === 'google';
    var form = el('form', { className: 'ac-form' });

    if (naming) {
      form.appendChild(heading(t('accountGoogleName'), 'h2'));
      form.appendChild(el('p', { className: 'lists-say', textContent: t('accountGoogleNameWhy') }));
    } else {
      saying.forEach(function (node) { form.appendChild(node); });
    }

    /* Before the fields, the way the map's sheet draws it: the quick way
       first, then the rule, then the form for anybody who would rather not. */
    if (state.google && !naming) {
      form.appendChild(googleGo());
      form.appendChild(el('p', { className: 'ac-or' }, [
        el('span', { textContent: t('accountOr') })
      ]));
    }

    form.appendChild(field('fc-user', 'accountUsername', {
      autocomplete: 'username',
      maxlength: '24',
      hint: creating || naming ? t('accountUsernameHint') : ''
    }));
    if (!naming) {
      form.appendChild(field('fc-pass', 'accountPassword', {
        type: 'password',
        autocomplete: creating ? 'new-password' : 'current-password'
      }));
    }

    /* What happens if the password goes, said before the button rather than
       discovered afterwards. The same sentence the map's sheet leads with. */
    if (creating) {
      form.appendChild(el('p', { className: 'ac-warn', textContent: t('accountNoReset') }));
    }

    form.appendChild(actor(creating || naming ? 'accountCreate' : 'accountSignIn', 'go', function (done) {
      var pass = form.querySelector('#fc-pass');
      post(ACCOUNT_API, naming ? {
        action: 'google-name',
        username: value(form, 'fc-user')
      } : {
        action: creating ? 'create' : 'login',
        username: value(form, 'fc-user'),
        password: pass ? pass.value : ''
      }).then(function (a) {
        if (!a.ok) {
          done();
          complain(form, say(a.out));
          return;
        }
        TTBTrack.event(naming || creating ? 'account_create' : 'account_login',
                       { via: naming ? 'google' : 'flashcard' });
        /* Straight back through boot() rather than patching state: signing in
           changes every answer on this page, including how much of the deck on
           screen this browser is allowed to remember. */
        if (naming) window.location.href = hereWithoutGoogle();
        else window.location.reload();
      });
    }, form));

    if (!naming) {
      var swap = el('button', {
        type: 'button',
        className: 'alt',
        textContent: t(creating ? 'accountSwitchSignIn' : 'accountSwitchCreate')
      });
      swap.addEventListener('click', function () {
        state.view = creating ? 'in' : 'up';
        TTBTrack.event('account_switch', { view: state.view, via: 'flashcard' });
        render();
      });
      form.appendChild(swap);
    }

    return form;
  }

  /* The offer, which is never the first thing on this page and never in front
     of anything. Signed out, the decks above it all work; what this card is
     about is the one thing that does not, which is being remembered. */
  function authCard() {
    return card([authForm([
      el('p', { className: 'eyebrow', textContent: t('flashKeepEyebrow') }),
      heading(t('flashKeepTitle'), 'h2'),
      el('p', { className: 'lists-say', textContent: t('flashKeepWhy') })
    ])]);
  }

  /* ------------------------------------------------------------- the decks */

  function deckRow(deck) {
    var said = state.user && state.ready
      ? t('flashKnownOf', { known: deck.known, n: deck.cards })
      : t('flashCards', { n: deck.cards });

    return el('li', { className: 'menu-item' }, [
      TTBTrack.click(
        el('a', { className: 'menu-row', href: deckHref(deck.id) }, [
          el('span', { className: 'menu-say' }, [
            el('span', { className: 'menu-name', textContent: deck.name }),
            el('span', { className: 'menu-why', textContent: deck.why || said })
          ]),
          deck.why ? el('span', { className: 'lists-count', textContent: said }) : null,
          el('span', { className: 'menu-go', 'aria-hidden': 'true',
                       html: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>' })
        ]),
        'flash_open', { deck_id: deck.id, own: deck.own ? 1 : 0 }
      )
    ]);
  }

  function deckList(decks) {
    var ul = el('ul', { className: 'menu' });
    decks.forEach(function (deck) { ul.appendChild(deckRow(deck)); });
    return ul;
  }

  /* The ten the site ships, and the sentence saying what this page is for. */
  function shippedCard() {
    var ours = state.decks.filter(function (d) { return !d.own; });

    return card([
      el('p', { className: 'eyebrow', textContent: t('flashEyebrow') }),
      heading(t('flashTitle')),
      el('p', { className: 'lists-say', textContent: t('flashWhat') }),
      /* Said once, quietly, and only where it is true: the database is not
         bound or this deployment is holding the other half's. Every deck below
         still turns over — they are a file — so this is a line rather than the
         page refusing to draw. */
      state.ready ? null : el('p', { className: 'lists-say', textContent: t(state.reached ? 'flashErrOff' : 'flashErrReach') }),
      ours.length ? deckList(ours) : el('p', { className: 'lists-none', textContent: t('flashNoneShipped') })
    ]);
  }

  /* And the ones somebody wrote. Signed out this card is not drawn at all —
     the offer of an account is what stands in its place, and two cards both
     saying "you would need an account" is the page asking twice. */
  function yoursCard() {
    var mine = state.decks.filter(function (d) { return d.own; });

    return card([
      el('p', { className: 'eyebrow', textContent: t('flashYoursEyebrow') }),
      heading(t('flashYours'), 'h2'),
      mine.length
        ? deckList(mine)
        : el('p', { className: 'lists-none', textContent: t('flashYoursNone') }),
      newDeckForm()
    ]);
  }

  function newDeckForm() {
    var form = el('form', { className: 'ac-form' });
    form.appendChild(field('fc-newdeck', 'flashNewDeck', {
      maxlength: String(MAX_NAME),
      placeholder: t('flashNewDeckHint')
    }));
    form.appendChild(actor('flashMakeDeck', 'go', function (done) {
      var name = value(form, 'fc-newdeck');
      if (!name) { done(); complain(form, t('flashErrName')); return; }
      post(FLASH_API, { action: 'deck', name: name }).then(function (a) {
        if (!a.ok || !a.out.deck) { done(); complain(form, say(a.out)); return; }
        TTBTrack.event('flash_deck', { deck_id: a.out.deck.id });
        /* Straight into it, and into the half that writes rather than the half
           that turns cards over: a deck with nothing in it has nothing to turn
           and the next thing anybody wants is the first word. */
        window.location.href = deckHref(a.out.deck.id);
      });
    }, form));
    return form;
  }

  /* ------------------------------------------------------- turning them over
   * A run is the cards of one deck in the order they will be shown, and where
   * in that order we are. The ones this person has not learnt yet come first
   * and the ones they have come after, so opening a deck picks up where they
   * left off without hiding anything they might want to see again.
   *
   * Pressing Show me again puts the card back on the end of the run, so it
   * comes round once more before the deck is finished. That is the whole of
   * the scheduling, deliberately: a card that is due in three days is a
   * different feature, with a table of its own and an argument about what a
   * day is in a city the reader may not be in.
   */
  function startRun(all) {
    var cards = (state.deck && state.deck.cards) || [];
    var queue = [];
    cards.forEach(function (c) { if (all || !c.known) queue.push(c); });
    if (!all) cards.forEach(function (c) { if (c.known) queue.push(c); });
    state.run = { queue: queue, at: 0, turned: false };
  }

  function current() {
    var run = state.run;
    return run && run.at < run.queue.length ? run.queue[run.at] : null;
  }

  /* How many cards of the open deck this person knows. Read off the deck in
     hand rather than asked for: every press has already changed it here. */
  function knownCount() {
    return ((state.deck && state.deck.cards) || []).filter(function (c) { return c.known; }).length;
  }

  /* Knew it, and its opposite. Both change the card in hand before the write
     goes out and neither waits for it: this is pressed a hundred times in a
     sitting and a card that hung on the network each time would be unusable.
   *
     A write that fails is deliberately silent. What it costs is that the card
     comes round again next time — the harmless direction — and what a toast
     would cost is an interruption in the middle of the one thing this page is
     for. Signed out there is no write at all, and the run is this tab's. */
  function mark(word, knew) {
    word.known = knew;
    TTBTrack.event(knew ? 'flash_knew' : 'flash_again', { deck_id: state.deck.id });

    if (state.user && state.ready) {
      post(FLASH_API, {
        action: knew ? 'knew' : 'again',
        deck: state.deck.id,
        card: word.id
      });
    }

    if (!knew) state.run.queue.push(word);
    state.run.at += 1;
    state.run.turned = false;
    render();
  }

  /* The card itself. A <button>, so the thumb, the keyboard and the screen
     reader all get the same thing — see .flash-card in assets/flashcard.css
     for why the whole card is the target and not a word on it. */
  function faceCard(word) {
    var turned = state.run.turned;
    var face = el('div', { className: 'flash-face' }, turned
      ? [
          el('p', { className: 'flash-back', textContent: word.back }),
          el('p', { className: 'flash-turn', textContent: t('flashTurned') })
        ]
      : [
          el('p', { className: 'flash-front', textContent: word.front }),
          el('p', { className: 'flash-turn', textContent: t('flashTurn') })
        ]);

    var node = el('button', {
      type: 'button',
      className: 'flash-card',
      'aria-live': 'polite'
    }, [face]);

    node.addEventListener('click', function () {
      state.run.turned = !state.run.turned;
      render();
    });
    return node;
  }

  function runBar() {
    var run = state.run;
    var done = run.at;
    var all = run.queue.length;
    var fill = el('span', { className: 'flash-fill' });
    fill.style.width = (all ? Math.round((done / all) * 100) : 0) + '%';

    return el('div', { className: 'flash-bar' }, [
      el('span', { className: 'flash-count', textContent: t('flashAt', { at: done + 1, n: all }) }),
      el('span', { className: 'flash-track', 'aria-hidden': 'true' }, [fill])
    ]);
  }

  /* The eyebrow over the card: which deck this is, the way back out of it, and
     — on a deck of your own — the word that opens the editor.
   *
     The way out is here rather than under the card, and that is the second
     arrangement. It was an .alt in the row of controls, which meant it was
     drawn on the front of a card and replaced by Knew it and Show me again the
     moment one was turned over: halfway through a deck, having turned a card,
     there was nothing on the screen that left. Standing it in the head keeps
     it in one place whichever face is up, and leaves the row under the card
     saying only the two things that answer the card. */
  function runHead() {
    var kids = [
      el('span', { className: 'eyebrow', textContent: state.deck.name }),
      backOut()
    ];

    if (state.deck.own) {
      var edit = el('button', { type: 'button', className: 'alt', textContent: t('flashEdit') });
      edit.addEventListener('click', function () {
        state.editing = true;
        render();
      });
      kids.push(edit);
    }

    return el('div', { className: 'flash-deck' }, kids);
  }

  function studyView(word) {
    /* Nothing under the card until it has been turned. Drawing Knew it against
       a word whose meaning nobody has seen yet would be inviting a press that
       cannot mean anything — and the way out of the deck is in the head above,
       where it stands whichever face is up. */
    if (!state.run.turned) return [runHead(), faceCard(word), runBar()];

    var acts = el('div', { className: 'flash-acts' });

    var again = el('button', { type: 'button', className: 'alt', textContent: t('flashAgain') });
    again.addEventListener('click', function () { mark(word, false); });
    acts.appendChild(again);

    var knew = el('button', { type: 'button', className: 'go', textContent: t('flashKnew') });
    knew.addEventListener('click', function () { mark(word, true); });
    acts.appendChild(knew);

    return [runHead(), faceCard(word), runBar(), acts];
  }

  function backOut() {
    return TTBTrack.click(
      el('a', { className: 'alt', href: at(HOME), textContent: t('flashDecks') }),
      'flash_back', { deck_id: state.deck.id }
    );
  }

  /* ------------------------------------------------------------ the end of it */

  function doneCard() {
    var all = (state.deck.cards || []).length;
    var mine = knownCount();
    var acts = el('div', { className: 'flash-doneacts' });

    var again = el('button', { type: 'button', className: 'go', textContent: t('flashGoAgain') });
    again.addEventListener('click', function () {
      TTBTrack.event('flash_again_deck', { deck_id: state.deck.id });
      startRun(true);
      render();
    });
    acts.appendChild(again);

    /* No way out of the deck here: the head above this card carries it, and
       two of them on one screen would be the page offering the same door
       twice. Only where there is something to forget, and only where it is kept
       anywhere — signed out the run was this tab's and closing it is the
       whole of forgetting. */
    if (state.user && state.ready && mine > 0) {
      var wipe = el('button', { type: 'button', className: 'alt is-danger', textContent: t('flashForget') });
      wipe.addEventListener('click', function () {
        post(FLASH_API, { action: 'reset', deck: state.deck.id }).then(function (a) {
          if (!a.ok) { toast(say(a.out)); return; }
          TTBTrack.event('flash_reset', { deck_id: state.deck.id });
          state.deck.cards.forEach(function (c) { c.known = false; });
          startRun(true);
          render();
        });
      });
      acts.appendChild(wipe);
    }

    var kids = [
      el('p', { className: 'flash-score', textContent: mine + ' / ' + all }),
      el('p', { className: 'lists-say', textContent: mine >= all ? t('flashAllKnown') : t('flashSomeLeft', { n: all - mine }) }),
      acts
    ];

    return el('section', { className: 'card flash-done' }, kids);
  }

  /* --------------------------------------------------------- writing a deck
   * A deck of your own, as a list of pairs rather than as cards to turn over.
   * It is the same page rather than another address: the deck is already
   * loaded, and a second address for the same deck would be a second thing to
   * get wrong in a link.
   */
  function cardRow(word) {
    var drop = el('button', { type: 'button', className: 'alt is-danger', textContent: t('flashRemove') });
    drop.addEventListener('click', function () {
      if (drop.disabled) return;
      drop.disabled = true;
      post(FLASH_API, { action: 'uncard', deck: state.deck.id, card: word.id }).then(function (a) {
        if (!a.ok || !a.out.deck) { drop.disabled = false; toast(say(a.out)); return; }
        TTBTrack.event('flash_uncard', { deck_id: state.deck.id });
        state.deck = a.out.deck;
        startRun(true);
        render();
      });
    });

    return el('li', { className: 'flash-row' }, [
      el('span', { className: 'flash-pair' }, [
        el('span', { className: 'flash-side', textContent: word.front }),
        el('p', { className: 'flash-gloss', textContent: word.back })
      ]),
      drop
    ]);
  }

  function addCardForm() {
    var form = el('form', { className: 'ac-form' });
    form.appendChild(el('div', { className: 'flash-pairfields' }, [
      field('fc-front', 'flashFront', { maxlength: String(MAX_SIDE), placeholder: t('flashFrontHint') }),
      field('fc-back', 'flashBack', { maxlength: String(MAX_SIDE), placeholder: t('flashBackHint') })
    ]));
    form.appendChild(actor('flashAdd', 'go', function (done) {
      var front = value(form, 'fc-front');
      var back = value(form, 'fc-back');
      if (!front) { done(); complain(form, t('flashErrFront')); return; }
      if (!back) { done(); complain(form, t('flashErrBack')); return; }

      post(FLASH_API, { action: 'card', deck: state.deck.id, front: front, back: back }).then(function (a) {
        if (!a.ok || !a.out.deck) { done(); complain(form, say(a.out)); return; }
        TTBTrack.event('flash_card', { deck_id: state.deck.id });
        state.deck = a.out.deck;
        startRun(true);
        done();
        render();
        /* Back to the first field with everything cleared: this form is used
           twenty times in a row and the thing wanted next is always the next
           word. render() has replaced the nodes, so the field is found again
           rather than held. */
        var next = document.getElementById('fc-front');
        if (next) next.focus();
      });
    }, form));
    return form;
  }

  function editView() {
    var deck = state.deck;
    var kids = [
      el('p', { className: 'eyebrow', textContent: t('flashYoursEyebrow') }),
      heading(deck.name),
      el('p', { className: 'lists-say', textContent: t('flashEditWhy') })
    ];

    if (deck.cards.length) {
      var ul = el('ul', { className: 'flash-rows' });
      deck.cards.forEach(function (c) { ul.appendChild(cardRow(c)); });
      kids.push(ul);
    } else {
      kids.push(el('p', { className: 'lists-none', textContent: t('flashEditNone') }));
    }

    kids.push(addCardForm());

    /* The two ways out of the editor, and the one way out of the deck
       altogether. Delete is last and quiet: it is the one press on this page
       that cannot be taken back. */
    var back = el('button', { type: 'button', className: 'alt', textContent: t('flashDone') });
    back.addEventListener('click', function () {
      state.editing = false;
      startRun(false);
      render();
    });

    var drop = el('button', { type: 'button', className: 'alt is-danger', textContent: t('flashDropDeck') });
    drop.addEventListener('click', function () {
      if (!window.confirm(t('flashDropSure'))) return;
      if (drop.disabled) return;
      drop.disabled = true;
      post(FLASH_API, { action: 'drop', deck: state.deck.id }).then(function (a) {
        if (!a.ok) { drop.disabled = false; toast(say(a.out)); return; }
        TTBTrack.event('flash_drop', { deck_id: state.deck.id });
        window.location.href = at(HOME);
      });
    });

    kids.push(foot([back, drop]));
    return card(kids);
  }

  /* -------------------------------------------------------------- the deck is
   * gone, or was never there. A deck id in the address that answers with
   * nothing: somebody's own deck deleted in another tab, a shipped deck that
   * has been taken out of the file, or a link that was mistyped. All three are
   * the same sentence and the way back to the decks.
   */
  function goneCard() {
    return card([
      el('p', { className: 'eyebrow', textContent: t('flashEyebrow') }),
      heading(t('flashGoneTitle')),
      /* Which of the two it was. A deck that is not there and a site that did
         not answer both leave the page with an address and no deck, and
         telling somebody their deck has gone when the network dropped is the
         page being confidently wrong. */
      el('p', { className: 'lists-say', textContent: t(state.reached ? 'flashErrGone' : 'flashErrReach') }),
      foot([el('a', { className: 'alt', href: at(HOME), textContent: t('flashDecks') })])
    ]);
  }

  /* ---------------------------------------------------------------- the page
   * One place decides what is on screen and decides it once, after every
   * answer is in.
   */
  function render() {
    clear(main);

    /* The tab is part of what a link is: somebody with six tabs open should be
       able to tell which one is the Estonian. */
    if (state.deck) document.title = state.deck.name;

    var wrap = el('div', { className: 'lists-stack' });
    var add = function (node) { if (node) wrap.appendChild(node); };

    if (asked && !state.deck) {
      add(goneCard());
    } else if (state.deck && state.editing) {
      add(editView());
    } else if (state.deck) {
      var now = current();
      if (now) studyView(now).forEach(add);
      else {
        add(runHead());
        add(doneCard());
        if (!state.user && state.ready) add(authCard());
      }
    } else {
      add(shippedCard());
      /* The offer of an account is only drawn where an account would work.
         With the database off there is nothing behind the form but a 503, and
         the line in the card above has already said that nothing is being
         remembered. */
      if (state.user) add(yoursCard());
      else if (state.ready) add(authCard());
    }

    main.appendChild(wrap);
  }

  /* What came of a round trip to Google, said once the page has drawn and
     knows who is signed in. */
  function sayGoogle() {
    if (googleSaid === 'in') {
      if (state.user) toast(t('accountSignedIn', { name: state.user }));
    } else if (googleSaid === 'taken') {
      toast(t('accountErrGoogleTaken'));
    } else if (googleSaid === 'failed') {
      toast(t('accountErrGoogle'));
    } else {
      return;
    }

    try {
      window.history.replaceState(null, '', hereWithoutGoogle());
    } catch (e) { /* an old browser keeps the parameter, which is harmless */ }
  }

  /* ------------------------------------------------------------------- boot */

  function boot() {
    main = document.getElementById('main');

    /* The mark in the header goes to the map, and where the map is depends on
       which hostname this is. The markup carries the site's own spelling, so
       the page is right when the script never runs; this is the subdomain's. */
    if (ON_SUBDOMAIN) document.getElementById('brand-home').href = MAP;

    applyStyle();

    Promise.all([
      getJSON(UI_URL),
      /* Who is signed in, the decks, and — where the address names one — that
         deck whole with its cards, in one answer. /api/account is not read on
         the way in at all: the only thing this page ever wanted from it was a
         name to put in the sign-up field, and the form asks for that now
         rather than offering one. */
      ask(FLASH_API + (asked ? '?deck=' + encodeURIComponent(asked) : ''))
    ]).then(function (loaded) {
      state.ui = loaded[0] || {};
      state.lang = pickLanguage(Object.keys(state.ui).sort());
      applyStaticStrings();
      document.title = t('flashDocumentTitle');

      var answer = loaded[1];
      state.reached = answer.status !== 0;
      state.ready = !!answer.out.ready;
      state.google = !!answer.out.google;
      state.user = answer.out.user || null;
      state.decks = answer.out.decks || [];
      state.deck = answer.out.deck || null;

      if (state.deck) startRun(false);

      /* A deck of your own with nothing in it yet opens as the editor rather
         than as a deck. There is nothing to turn over, and anything else would
         be an empty card with a word on it telling somebody to go and find the
         way to fill it. */
      if (state.deck && state.deck.own && !state.deck.cards.length) state.editing = true;

      /* A Google account with no account here yet: the form this page draws
         for somebody signed out becomes the one that asks for a name. */
      if (googleSaid === 'name' && !state.user) state.view = 'google';

      render();
      sayGoogle();
    }).catch(function () {
      /* The strings themselves did not arrive, so there is nothing to say in
         any language. The markup's own English is what is left, and the map is
         one press away in it. */
      state.ui = {};
      render();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
