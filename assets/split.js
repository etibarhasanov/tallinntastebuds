/**
 * Tallinn Tastebuds — /split.html, and splitwise.tallinntastebuds.ee.
 *
 * WHAT THIS PAGE IS
 *
 * Five people eat somewhere on the map, one card pays, and the rest of the
 * evening is arithmetic done badly in a group chat. This is that arithmetic,
 * done once: a group somebody names, a link they send to the other four, a
 * line for each thing anybody paid for, and one sentence at the bottom saying
 * who hands what to whom.
 *
 * It is the only page on this site that is not about restaurants, which is
 * why it is on its own hostname rather than a fifth card on the account page.
 * functions/_middleware.js is what makes the subdomain the front door to this
 * page and sends every other address on it back to the map; the page itself
 * answers at /split on every host, including the previews under
 * *.tallinntastebuds.pages.dev where a subdomain cannot exist at all.
 *
 * The document this script runs in is served by functions/split.js, which
 * writes the group's own name and a line about it into the head before the
 * page is handed over — so a link pasted into a message arrives as "Split in
 * Berlin" rather than as the site's name. Nothing here depends on that having
 * happened: every answer this page draws it fetches for itself, and the route
 * is an improvement on the load rather than a requirement for it.
 *
 * THE SIGN-IN SHEET IS HERE, AND IT IS THE SECOND COPY ON THE SITE
 *
 * There is one password form on this site and it is in assets/app.js, inside
 * the sheet the map opens. /account.html and /lists.html both send people
 * there with ?then=, rather than growing a copy, and the reason is written up
 * in both: two copies of a sign-in form is one copy that quietly stops
 * matching the API.
 *
 * This page has its own, and the reason is the hostname. The sheet lives on
 * the map, the map lives at tallinntastebuds.ee, and sending somebody from
 * splitwise.tallinntastebuds.ee to another host to sign in and then back
 * again is either an open redirect or a dead end — ?then= is deliberately
 * same-host, and it should stay that way. So the choice was a form here or a
 * feature that cannot be signed into from its own address.
 *
 * What makes that survivable is that it is a copy of the *form* and not of
 * the *API*: it posts the same three fields to the same /api/account with the
 * same two actions, reads the same errors, and prints the same strings out of
 * data/ui.json — accountUsername, accountPassword, accountNoReset and the
 * rest. Nothing about accounts is decided here. If the account route ever
 * grows a step, this form has to grow it too, and the header of
 * functions/api/account.js is where that will be said first.
 *
 * WHAT MAKES ONE ACCOUNT COVER TWO HOSTNAMES
 *
 * The session cookie, scoped to the domain rather than to the host — see
 * sessionCookie() in functions/api/_lib.js. Somebody signed in on the map
 * arrives here signed in, and somebody who signs up here to split a dinner
 * can go and save places under the same name.
 *
 * ONE ADDRESS, AND HOLDING IT IS THE PERMISSION
 *
 * ?g=<code> is the whole of the routing, and it now means one thing rather
 * than three: the group, drawn for whoever is holding the code. Signed in and
 * a member, it is yours to add to; signed in and not a member, it is a group
 * with a Join on it; signed out, it is the same page with the sign-in form
 * where the controls would be. Nobody is asked for an account before they can
 * see what they are being asked to join, which is the whole argument — see
 * groupById() in functions/api/split.js for the trade that buys.
 *
 * Without a code at all it is the list of your own groups, and that one does
 * need an account, because "yours" has no meaning without one.
 *
 * MONEY
 *
 * Cents, as integers, all the way to the wire. The fields take "24.60" and
 * "24,60" — an Estonian keyboard writes the comma — and cents() turns either
 * into 2460 before anything else happens. Nothing here ever adds two decimals
 * together; the sums are all done in functions/api/split.js against integers,
 * and this page only ever draws what came back.
 *
 * WHAT IT READS
 *
 *   /data/ui.json        the strings the whole site shares
 *   /data/split.json     this page's own, in the same ten languages
 *   /api/account         posted to, to sign in or create an account
 *   /api/split           the groups they are in
 *   /api/split?group=    one group, whole
 *   /api/split?join=     what a group is called, for somebody invited to it
 */
(function () {
  'use strict';

  var UI_URL = '/data/ui.json';
  /* This page's own strings, in a file of its own rather than in data/ui.json
     with every other page's. Six hundred and ten lines in the middle of the
     one file every page on this site reads is exactly the kind of thread that
     turns removing a feature into unpicking it — see **Taking it out** under
     **Splitwise** in README.md. Same shape as ui.json: language, then key,
     then the string. */
  var SPLIT_UI_URL = '/data/split.json';
  var ACCOUNT_API = '/api/account';
  var SPLIT_API = '/api/split';

  /* The same two keys the map writes and every other page reads. Walking from
     the map to here should not feel like leaving. */
  var STYLE_KEY = 'ttb.style';
  var LANG_KEY = 'ttb.lang';

  var STYLES = ['red', 'green'];
  var DEFAULT_STYLE = 'red';
  var DEFAULT_LANG = 'en';

  /* The server binds all three; the fields only stop somebody at the keystroke
     instead of at the round trip. MAX_NAME, MAX_WHAT and MAX_CENTS in
     functions/api/split.js are the ones that count — change one, change the
     other. */
  var MAX_NAME = 60;
  var MAX_WHAT = 60;
  var MAX_CENTS = 1000000;

  var state = {
    ui: {},
    lang: DEFAULT_LANG,
    reached: true,   // whether /api/split answered at all
    ready: false,    // whether the database is bound and this is its half
    user: null,
    groups: [],      // the ones you are in, most recently spent in first
    group: null,     // the one that is open, whole
    view: 'in'       // which half of the sign-in form: 'in' or 'up'
  };

  /* Which group the address is asking for, read once. */
  var asked = new URLSearchParams(window.location.search).get('g') || '';

  /* Which of the two hostnames this is being read on, and the two addresses
     that answer to differently because of it.
   *
     On splitwise.tallinntastebuds.ee this page is the front door — the bare
     root, rewritten to /split by functions/_middleware.js — and the map is up
     on the domain above. On the site itself, and on every preview under
     *.tallinntastebuds.pages.dev where the subdomain cannot exist at all, this
     page is at /split and the map is at the root.
   *
     So both of "here" and "the map" are wrong half the time if either is
     written out once, and the map's address is the one that has to be absolute
     — a relative link home from the subdomain is a link to where you are
     already standing. It is spelled out rather than derived from the hostname
     for the same reason the middleware spells it out: one string to find when
     the domain ever changes. */
  var ON_SUBDOMAIN = window.location.hostname.indexOf('splitwise.') === 0;
  var HOME = ON_SUBDOMAIN ? '/' : '/split';
  var MAP = ON_SUBDOMAIN ? 'https://tallinntastebuds.ee/' : '/';

  var main = null;

  /* One of this page's own addresses, carrying whatever ?style= and ?lang=
     the current one arrived with.
   *
     Every other page on this site can drop those two on an internal link,
     because the map writes both choices to localStorage and every page of
     tallinntastebuds.ee reads the same store. This one is served from another
     origin — that is what a subdomain is — so the store is empty here and
     there is no swatch on this page to fill it. The query string is then the
     only thing carrying a choice, and dropping it on the first link would put
     somebody who asked for green and Estonian back on red and English before
     they had pressed anything.

     Not used for the group's own share link, which is written for the person
     it is sent to rather than for the person sending it. */
  function at(path) {
    var now = new URLSearchParams(window.location.search);
    var keep = new URLSearchParams();
    ['style', 'lang'].forEach(function (k) { if (now.get(k)) keep.set(k, now.get(k)); });
    var q = keep.toString();
    return q ? path + (path.indexOf('?') === -1 ? '?' : '&') + q : path;
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

  /* The two packs read as one from here on, so t() below is the same three
     lines every other page on this site has. Merged over the site's own rather
     than under it, though nothing is in both: the language list is ui.json's,
     because that is the file the switcher and the validator read. */
  function merge(base, extra) {
    Object.keys(base).forEach(function (lang) {
      var add = extra[lang];
      if (!add) return;
      Object.keys(add).forEach(function (key) { base[lang][key] = add[key]; });
    });
    return base;
  }

  function getJSON(url) {
    return fetch(url, { headers: { accept: 'application/json' } }).then(function (res) {
      if (!res.ok) throw new Error(url + ': ' + res.status);
      return res.json();
    });
  }

  /* Asked so that "the site did not answer" and "the site answered no" stay
     apart: the first is a network this page cannot fix and the second is a
     fact about the deployment or about the group. Copied from
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
    /* this one */
    'not-found': 'splitErrGone',
    full: 'splitErrFull',
    'too-many': 'splitErrTooMany',
    name: 'splitErrName',
    what: 'splitErrWhat',
    amount: 'splitErrAmount',
    'not-yours': 'splitErrNotYours',
    spent: 'splitErrSpent',
    'in-sums': 'splitErrInSums',
    'signed-out': 'accountErrSignedOut'
  };

  function say(out) {
    return t(ERRORS[out && out.error] || 'splitErrGeneric');
  }

  /* ----------------------------------------------------------------- money
   * Cents in, a string somebody reads out. Intl knows where the symbol goes
   * in each of the ten languages — before the number in English, after it in
   * Estonian and Finnish — and falls back to the plainest possible spelling
   * where it does not know the language at all.
   *
   * Always positive. Which way a balance points is said in words beside it,
   * because a minus sign in a column of numbers is the one thing everybody
   * reads differently.
   */
  function money(cents) {
    var n = Math.abs(cents) / 100;
    try {
      return new Intl.NumberFormat(state.lang, { style: 'currency', currency: 'EUR' }).format(n);
    } catch (e) {
      return n.toFixed(2) + ' €';
    }
  }

  /* "24.60", "24,60" and "24" all mean the same thing to somebody standing
     outside a restaurant, and one of the ten keyboards this site is read on
     puts a comma there. Anything else — a currency symbol, a minus, three
     decimals, a word — is nought, and the caller refuses the form. */
  function cents(text) {
    var s = String(text || '').replace(/\s/g, '').replace(',', '.');
    if (!/^[0-9]{1,7}(\.[0-9]{1,2})?$/.test(s)) return 0;
    var n = Math.round(parseFloat(s) * 100);
    return n >= 1 && n <= MAX_CENTS ? n : 0;
  }

  /* --------------------------------------------------------------- dressing
   * Copied whole from assets/account.js, which copied it from assets/lists.js:
   * the style and the language are chosen on the map, written to localStorage,
   * and read by every other page. A page that skipped this block renders in
   * red for somebody who chose green — see "The two styles" in README.md.
   *
   * It works across the subdomain because localStorage is per origin and this
   * one is a different origin: somebody who has only ever opened splitwise
   * gets the default style and their browser's language, which is the same
   * thing a first visit to the map gets.
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
        inputmode: opts.inputmode || null,
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
     have just pressed — and cleared on the way into the next try, so an
     answered complaint cannot stand under a form that is working. */
  function complain(form, message) {
    var old = form.querySelector('.ac-err');
    if (old) old.parentNode.removeChild(old);
    form.insertBefore(el('p', { className: 'ac-err', role: 'alert', textContent: message }),
                      form.firstChild);
  }

  /* A button that goes busy while the write is in flight and comes back if it
     is refused. Every write on this page is one of these — the three forms,
     and the words at the end of a row.
   *
     `form`, where there is one, is the form this button is the action of.
     Wiring the press to the form's own submit event rather than to the button
     is what makes Enter in a field do what the button does: a form with no
     action attribute reloads the page instead, which on this page throws away
     everything typed into it. */
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

  /* ------------------------------------------------------------------ writes
   * Every write here answers with the whole group as it now stands, and the
   * page redraws from that rather than patching the row it just changed. A
   * group is read by five people at once and every write moves the balances
   * at the bottom of it, so there is nothing to patch that would not be a
   * guess at what the other four have done since.
   */
  function change(payload, done) {
    /* One report per kind of write, named after the action the API knows it
       by: split_spend, split_settle, split_drop, split_unspend, split_unsettle. */
    TTBTrack.event('split_' + payload.action, { group_id: payload.group });
    post(SPLIT_API, payload).then(function (a) {
      if (!a.ok || !a.out.group) {
        done();
        toast(say(a.out));
        return;
      }
      state.group = a.out.group;
      render();
    });
  }

  /* ------------------------------------------------------------- signing in
   * Two fields and a switch between making an account and signing in to one —
   * the same two actions, the same two fields and the same strings as the
   * map's sheet. See the header for why there is a second copy of this on the
   * site at all.
   *
   * It is built here and worn by two cards: the front door, where somebody
   * arrived with no code and no account, and the join offer under a group
   * somebody is looking at. One form, two frames — the alternative was the
   * same eight fields written twice, which is the copy that stops matching
   * the API first.
   */
  function authForm(saying) {
    var creating = state.view === 'up';
    var form = el('form', { className: 'ac-form' });

    saying.forEach(function (node) { form.appendChild(node); });

    /* Empty, and the rule under it, exactly as the map's sheet asks — see the
       comment there for why neither sheet hands anybody a name any more. */
    form.appendChild(field('sp-user', 'accountUsername', {
      autocomplete: 'username',
      maxlength: '24',
      hint: creating ? t('accountUsernameHint') : ''
    }));
    form.appendChild(field('sp-pass', 'accountPassword', {
      type: 'password',
      autocomplete: creating ? 'new-password' : 'current-password'
    }));

    /* What happens if the password goes, said before the button rather than
       discovered afterwards. The same sentence the map's sheet leads with,
       out of the same key. */
    if (creating) {
      form.appendChild(el('p', { className: 'ac-warn', textContent: t('accountNoReset') }));
    }

    form.appendChild(actor(creating ? 'accountCreate' : 'accountSignIn', 'go', function (done) {
      var pass = form.querySelector('#sp-pass');
      post(ACCOUNT_API, {
        action: creating ? 'create' : 'login',
        username: value(form, 'sp-user'),
        password: pass ? pass.value : ''
      }).then(function (a) {
        if (!a.ok) {
          done();
          complain(form, say(a.out));
          return;
        }
        TTBTrack.event(creating ? 'account_create' : 'account_login', { via: 'split' });
        /* Straight back through boot() rather than patching state: signing in
           changes every answer on this page, including whether the group on
           screen is one this browser may write to. */
        window.location.reload();
      });
    }, form));

    var swap = el('button', {
      type: 'button',
      className: 'alt',
      textContent: t(creating ? 'accountSwitchSignIn' : 'accountSwitchCreate')
    });
    swap.addEventListener('click', function () {
      state.view = creating ? 'in' : 'up';
      TTBTrack.event('account_switch', { view: state.view, via: 'split' });
      render();
    });
    form.appendChild(swap);

    return form;
  }

  /* The front door with nobody signed in: no code in the address, so there is
     no group to show and the only thing to offer is the account that would
     give them one. */
  function authCard() {
    return card([authForm([
      el('p', { className: 'eyebrow', textContent: t('splitEyebrow') }),
      heading(t('splitTitle')),
      el('p', { className: 'lists-say', textContent: t('splitWhat') }),
      el('p', { className: 'lists-say', textContent: t('splitNeedAccount') })
    ])]);
  }

  /* Under a group somebody is looking at and is not in. They can already read
     every word of it — that is what holding the link buys — so this card is
     only about the one thing they cannot do yet, and it says which of the two
     reasons it is: no account, or an account that is not in this group.

     A full group loses the offer and keeps the sentence. There is nothing to
     press and pretending otherwise would be a button that could only fail. */
  function joinCard() {
    var full = state.group.full;

    if (!state.user) {
      return card([authForm([
        heading(t('splitJoinTitle'), 'h2'),
        el('p', { className: 'lists-say', textContent: t('splitJoinWhy') }),
        el('p', { className: 'lists-say', textContent: t('splitNeedAccount') })
      ])]);
    }

    return card([
      heading(t('splitJoinTitle'), 'h2'),
      el('p', { className: 'lists-say', textContent: t(full ? 'splitErrFull' : 'splitJoinWhy') }),
      full ? null : foot([actor('splitJoin', 'go', function (done) {
        post(SPLIT_API, { action: 'join', group: state.group.id }).then(function (a) {
          if (!a.ok) { done(); toast(say(a.out)); return; }
          TTBTrack.event('split_join', { group_id: state.group.id });
          window.location.reload();
        });
      })])
    ]);
  }

  /* ------------------------------------------------------------ your groups */

  function peopleLabel(n) {
    return n === 1 ? t('splitPeopleOne') : t('splitPeople', { n: n });
  }

  /* Where somebody stands, as a phrase rather than as a signed number. A
     minus sign in front of a sum of money is read three different ways by
     three different people; "owes 4.15" is read one way by all of them.

     Two sets of words for the same three states, because the subject is not
     the same: a row in the list of groups is about you and a row in a group's
     own column is about the person it names. */
  function standingText(balance, yours) {
    if (!balance) return t('splitEven');
    if (balance > 0) return t(yours ? 'splitYouOwed' : 'splitOwed', { amount: money(balance) });
    return t(yours ? 'splitYouOwing' : 'splitOwing', { amount: money(balance) });
  }

  function groupRow(g) {
    var line = el('p', { className: 'lists-all-meta mono' }, [
      el('span', { textContent: peopleLabel(g.people) }),
      document.createTextNode(' · '),
      el('span', {
        className: g.cents < 0 ? 'split-down' : null,
        textContent: standingText(g.cents, true)
      })
    ]);
    return el('li', { className: 'lists-index-row' }, [
      el('div', { className: 'lists-all-card' }, [
        TTBTrack.click(el('a', {
          className: 'lists-index-title lists-open',
          href: at('?g=' + encodeURIComponent(g.id)),
          textContent: g.name
        }), 'split_open', { group_id: g.id }),
        line
      ])
    ]);
  }

  /* Name it and you land in it, because the next thing anybody does after
     naming a group is send somebody the link to it. */
  function newGroupForm() {
    var form = el('form', { className: 'lists-new' });
    var box = el('input', {
      type: 'text',
      className: 'lists-input',
      maxlength: String(MAX_NAME),
      autocomplete: 'off',
      'aria-label': t('splitNewName'),
      placeholder: t('splitNewHint')
    });
    form.appendChild(box);
    form.appendChild(actor('splitCreate', 'go', function (done) {
      var name = box.value.trim();
      if (!name) { done(); box.focus(); return; }
      post(SPLIT_API, { action: 'create', name: name }).then(function (a) {
        if (!a.ok) { done(); complain(form, say(a.out)); return; }
        TTBTrack.event('split_create', { group_id: a.out.id });
        window.location.href = at('?g=' + encodeURIComponent(a.out.id));
      });
    }, form));
    return form;
  }

  function groupsCard() {
    var kids = [
      el('p', { className: 'eyebrow', textContent: t('splitEyebrow') }),
      heading(t('splitYours')),
      el('p', { className: 'lists-say', textContent: t('splitWhat') })
    ];

    if (state.groups.length) {
      var ul = el('ul', { className: 'lists-index' });
      state.groups.forEach(function (g) { ul.appendChild(groupRow(g)); });
      kids.push(ul);
    } else {
      kids.push(el('p', { className: 'lists-none', textContent: t('splitNone') }));
    }

    kids.push(newGroupForm());
    return card(kids);
  }

  /* ---------------------------------------------------------------- a group */

  /* The head of a group: its name, who is in it, and the link that gets the
     rest of them in. The link is the whole of the invitation, so it is shown
     as text as well as offered to the clipboard — a copy button is no use to
     somebody reading the code out over a table. */
  function groupHead() {
    var g = state.group;
    var url = window.location.origin + HOME + '?g=' + encodeURIComponent(g.id);

    var kids = [
      el('p', { className: 'eyebrow', textContent: t('splitEyebrow') }),
      heading(g.name),
      el('p', { className: 'lists-say', textContent: peopleLabel(g.members.length) }),
      memberList(),
      el('p', { className: 'lists-say', textContent: t('splitShare') }),
      el('p', { className: 'split-link', textContent: url })
    ];

    /* navigator.clipboard is absent over plain http and in a few browsers, and
       there is nothing to fall back to that is better than the address already
       printed above it. So the button is simply not drawn where it cannot
       work, rather than drawn and apologising — the link is right there to be
       selected, which is what somebody does anyway. */
    var copy = null;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      copy = el('button', { type: 'button', className: 'alt', textContent: t('splitCopy') });
      copy.addEventListener('click', function () {
        TTBTrack.event('split_share', { group_id: state.group.id });
        navigator.clipboard.writeText(url).then(
          function () { toast(t('splitCopied')); },
          function () { toast(t('splitErrGeneric')); }
        );
      });
    }

    kids.push(foot([
      copy,
      TTBTrack.click(el('a', { className: 'alt', href: at(HOME), textContent: t('splitYours') }), 'split_home'),
      /* Nothing to leave and nothing to take down for somebody who is only
         reading. Both of those are writes, and the server refuses them from
         here anyway — this is the page agreeing rather than offering a button
         that would come back with an apology. */
      g.member ? (g.mine ? removeButton() : leaveButton()) : null
    ]));

    return card(kids);
  }

  /* Who is in the group, as rows rather than as a comma-joined line.
   *
     It was a line for as long as the only thing anybody did with the names was
     read them. The owner can now take one out, and a control belongs on the
     row that names the person it acts on rather than at the end of a sentence
     they are somewhere inside.
   *
     The Remove is drawn only where it would work: the owner, on somebody who
     is not themselves and whose name the sums do not mention. That last test
     is done from what is already on the page — every payer, every share and
     both ends of every payment are in what the group answered with — so it
     costs no request and it agrees exactly with what the server will say. See
     drop() in functions/api/split.js, which is the copy that binds. */
  function inSums(name) {
    var found = false;
    state.group.spends.forEach(function (spend) {
      if (spend.payer === name) found = true;
      spend.among.forEach(function (a) { if (a.name === name) found = true; });
    });
    state.group.payments.forEach(function (p) {
      if (p.from === name || p.to === name) found = true;
    });
    return found;
  }

  function memberRow(m) {
    var row = el('li', { className: 'split-row' }, [
      el('span', {
        className: 'split-what',
        textContent: m.you ? m.name + ' (' + t('splitYou') + ')' : m.name
      })
    ]);
    if (state.group.mine && !m.you && !inSums(m.name)) {
      row.appendChild(actor('splitRemove', 'alt split-act', function (done) {
        if (!window.confirm(t('splitDropSure', { name: m.name }))) { done(); return; }
        change({ action: 'drop', group: state.group.id, name: m.name }, done);
      }));
    }
    return row;
  }

  function memberList() {
    var ul = el('ul', { className: 'split-rows' });
    state.group.members.forEach(function (m) { ul.appendChild(memberRow(m)); });
    return ul;
  }

  /* Leaving is for the person who opened the wrong link, and the server says
     so: the moment somebody is in the arithmetic it refuses, because taking a
     name out of a column that still counts their cents would leave the group
     not adding up. See leave() in functions/api/split.js. */
  function leaveButton() {
    return actor('splitLeave', 'alt is-danger', function (done) {
      post(SPLIT_API, { action: 'leave', group: state.group.id }).then(function (a) {
        if (!a.ok) { done(); toast(say(a.out)); return; }
        TTBTrack.event('split_leave', { group_id: state.group.id });
        window.location.href = at(HOME);
      });
    });
  }

  /* The owner's way out, and it takes everything with it. Behind a confirm
     because there is no undo and no archive: what it deletes is who owed whom
     what, which is exactly the thing nobody wants kept and nobody can rebuild
     from memory an hour later. */
  function removeButton() {
    return actor('splitDelete', 'alt is-danger', function (done) {
      if (!window.confirm(t('splitDeleteSure'))) { done(); return; }
      post(SPLIT_API, { action: 'remove', group: state.group.id }).then(function (a) {
        if (!a.ok) { done(); toast(say(a.out)); return; }
        TTBTrack.event('split_remove', { group_id: state.group.id });
        window.location.href = at(HOME);
      });
    });
  }

  /* ------------------------------------------------------- where people stand
   * The column everybody actually opens the page for, and under it the short
   * list of payments that clears it. Both come from the server — see
   * balancesOf() and settlements() in functions/api/split.js — because the
   * page must not be a second implementation of the arithmetic that could
   * disagree with the one the rows are written against.
   */
  function balanceRow(b) {
    return el('li', { className: 'split-row' }, [
      el('span', { className: 'split-what', textContent: b.name }),
      el('span', {
        className: b.cents < 0 ? 'split-money split-down' : 'split-money',
        textContent: standingText(b.cents, false)
      })
    ]);
  }

  function settleRow(s) {
    var row = el('li', { className: 'split-row' }, [
      el('span', { className: 'split-what', textContent: t('splitPays', { from: s.from, to: s.to }) }),
      el('span', { className: 'split-money split-down', textContent: money(s.cents) })
    ]);
    /* A payment is a write, so only somebody in the group is offered one. A
       reader sees the line and no button, which is the true shape of what
       they may do about it. */
    if (state.group.member) {
      row.appendChild(actor('splitMarkPaid', 'alt split-act', function (done) {
        change({ action: 'settle', group: state.group.id, from: s.from, to: s.to, cents: s.cents }, done);
      }));
    }
    return row;
  }

  function standingCard() {
    var g = state.group;
    var kids = [heading(t('splitStanding'), 'h2')];

    var balances = el('ul', { className: 'split-rows' });
    g.balances.forEach(function (b) { balances.appendChild(balanceRow(b)); });
    kids.push(balances);

    if (!g.settle.length) {
      kids.push(el('p', { className: 'lists-none', textContent: t('splitAllEven') }));
    } else {
      kids.push(heading(t('splitWho'), 'h2'));
      var who = el('ul', { className: 'split-rows' });
      g.settle.forEach(function (s) { who.appendChild(settleRow(s)); });
      kids.push(who);
    }

    return card(kids);
  }

  /* --------------------------------------------------------- adding a spend
   * What it was, how much, whose card, and who it was for. The payer defaults
   * to whoever is typing and the split defaults to everybody, which is the
   * whole of what happens at a table; the two controls are there for the
   * evening one person did not have the wine, and for the phone that comes
   * out at the end and puts in what everybody else paid.
   */
  function spendForm() {
    var g = state.group;
    var form = el('form', { className: 'ac-form' });

    form.appendChild(heading(t('splitAddTitle'), 'h2'));

    var what = field('sp-what', 'splitWhatFor', {
      maxlength: String(MAX_WHAT),
      autocapitalize: 'sentences',
      placeholder: t('splitWhatHint')
    });
    var sum = field('sp-sum', 'splitAmount', {
      className: 'split-sum',
      inputmode: 'decimal',
      maxlength: '10',
      placeholder: t('splitAmountHint')
    });
    form.appendChild(el('div', { className: 'split-pair' }, [what, sum]));

    var pick = el('select', { className: 'split-pick', id: 'sp-payer' });
    g.members.forEach(function (m) {
      pick.appendChild(el('option', {
        value: m.name,
        selected: m.you,
        textContent: m.you ? m.name + ' (' + t('splitYou') + ')' : m.name
      }));
    });
    form.appendChild(el('label', { className: 'ac-field' }, [
      el('span', { className: 'ac-label', textContent: t('splitPayer') }),
      pick
    ]));

    var among = el('div', { className: 'split-who' });
    g.members.forEach(function (m) {
      var box = el('input', { type: 'checkbox', checked: true, value: m.name });
      var opt = el('label', { className: 'split-who-opt is-on' }, [box, el('span', { textContent: m.name })]);
      box.addEventListener('change', function () {
        opt.className = box.checked ? 'split-who-opt is-on' : 'split-who-opt';
      });
      among.appendChild(opt);
    });
    form.appendChild(el('div', { className: 'ac-field' }, [
      el('span', { className: 'ac-label', textContent: t('splitAmong') }),
      among
    ]));

    form.appendChild(actor('splitAdd', 'go', function (done) {
      var amount = cents(value(form, 'sp-sum'));
      if (!amount) { done(); complain(form, t('splitErrAmount')); return; }
      if (!value(form, 'sp-what')) { done(); complain(form, t('splitErrWhat')); return; }

      var people = [];
      var boxes = among.querySelectorAll('input');
      for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) people.push(boxes[i].value);
      if (!people.length) { done(); complain(form, t('splitErrWho')); return; }

      change({
        action: 'spend',
        group: g.id,
        what: value(form, 'sp-what'),
        cents: amount,
        payer: pick.value,
        among: people
      }, done);
    }, form));

    return card([form]);
  }

  /* ------------------------------------------------------------- the receipt
   * Every line anybody put in, newest first, and under it the money that has
   * actually been handed over. Two lists rather than one: an expense buys
   * something and a payment only moves a debt, and a page that mixed them
   * would be asking everybody to work out which of the two each line was.
   */
  function spendRow(s) {
    var whoFor = s.among.length === state.group.members.length
      ? t('splitAmongAll')
      : s.among.map(function (a) { return a.name; }).join(', ');

    /* Your own share of this one, out of the shares the server wrote down
       rather than divided again here. It is the number the person reading
       actually wants, and it is left off entirely for a bill they were not
       part of — where "your share" would be nought and reading as a share. */
    var yours = null;
    s.among.forEach(function (a) { if (a.name === state.user) yours = a.cents; });

    var said = [t('splitPaid', { name: s.payer }), whoFor];
    if (yours !== null) said.push(t('splitYourShare', { amount: money(yours) }));

    var row = el('li', { className: 'split-row' }, [
      el('span', { className: 'split-what' }, [
        el('span', { textContent: s.what }),
        el('p', { className: 'split-meta', textContent: said.join(' · ') })
      ]),
      el('span', { className: 'split-money', textContent: money(s.cents) })
    ]);

    if (s.mine) {
      row.appendChild(actor('splitRemove', 'alt split-act', function (done) {
        change({ action: 'unspend', group: state.group.id, id: s.id }, done);
      }));
    }
    return row;
  }

  function paymentRow(p) {
    var row = el('li', { className: 'split-row' }, [
      el('span', { className: 'split-what', textContent: t('splitPaidTo', { from: p.from, to: p.to }) }),
      el('span', { className: 'split-money', textContent: money(p.cents) })
    ]);
    if (p.mine) {
      row.appendChild(actor('splitRemove', 'alt split-act', function (done) {
        change({ action: 'unsettle', group: state.group.id, id: p.id }, done);
      }));
    }
    return row;
  }

  function spendsCard() {
    var g = state.group;
    var kids = [heading(t('splitSpends'), 'h2')];

    if (!g.spends.length) {
      kids.push(el('p', { className: 'lists-none', textContent: t('splitSpendsNone') }));
    } else {
      var ul = el('ul', { className: 'split-rows' });
      g.spends.forEach(function (s) { ul.appendChild(spendRow(s)); });
      kids.push(ul);
    }

    /* Only once there is one. An empty "Money handed over" under an empty
       receipt would be the page explaining a second feature to somebody who
       has not used the first. */
    if (g.payments.length) {
      kids.push(heading(t('splitPayments'), 'h2'));
      var paid = el('ul', { className: 'split-rows' });
      g.payments.forEach(function (p) { paid.appendChild(paymentRow(p)); });
      kids.push(paid);
    }

    return card(kids);
  }

  /* Accounts and the database are off here — no binding, or this deployment
     holding the other environment's. Nothing on this page works without
     either, unlike the map's saves, so it says the one true thing and offers
     the way back. */
  function switchedOff() {
    return card([
      el('p', { className: 'eyebrow', textContent: t('splitEyebrow') }),
      heading(t('splitTitle')),
      el('p', {
        className: 'lists-say',
        textContent: t(state.reached ? 'splitErrOff' : 'splitErrReach')
      }),
      foot([TTBTrack.click(el('a', { className: 'alt', href: at(MAP), textContent: t('listsBack') }), 'home')])
    ]);
  }

  /* ---------------------------------------------------------------- the page
   * One place decides what is on screen and decides it once, after every
   * answer is in. Four states, and each is the whole page rather than a
   * variation on the one before it.
   */
  function render() {
    clear(main);

    /* The tab is part of what a link is: somebody with six tabs open should be
       able to tell which one is the dinner, and somebody who bookmarks a group
       should get its name rather than the site's. functions/split.js already
       wrote this into the head for a link that was pasted, and this is what
       keeps it true once the script has drawn.

       Only ever set when a group is open, and never unset: every move on this
       page is a whole page load, so there is no way back to the list of groups
       that does not go through boot() and the title it sets there. */
    if (state.group) document.title = state.group.name;

    var wrap = el('div', { className: 'lists-stack' });
    var add = function (node) { if (node) wrap.appendChild(node); };

    if (!state.ready) {
      add(switchedOff());
    } else if (state.group) {
      /* Holding the code is enough to be here, signed in or not. What being a
         member adds is the form — everything above and below it is the same
         page for everybody, which is the point of letting somebody see a
         group before they are asked to join it. */
      add(groupHead());
      add(standingCard());
      add(state.group.member ? spendForm() : joinCard());
      add(spendsCard());
    } else if (!state.user) {
      add(authCard());
    } else {
      add(groupsCard());
    }

    main.appendChild(wrap);
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
      /* Not caught, deliberately: without this file every word on this page
         would be a raw key, which is worse than the noscript card the catch
         below leaves standing. */
      getJSON(SPLIT_UI_URL),
      /* Who is signed in, which groups they are in, and — where the address
         names one — that group whole, in one answer. /api/account is not read
         on the way in at all: the only thing this page ever wanted from it
         was a name to put in the sign-up field, and the sheet asks for that
         now rather than offering one. */
      ask(SPLIT_API + (asked ? '?group=' + encodeURIComponent(asked) : ''))
    ]).then(function (loaded) {
      state.ui = merge(loaded[0] || {}, loaded[1] || {});
      state.lang = pickLanguage(Object.keys(state.ui).sort());
      applyStaticStrings();
      document.title = t('splitDocumentTitle');

      var answer = loaded[2];
      state.reached = answer.status !== 0;
      state.ready = !!answer.out.ready;
      state.user = answer.out.user || null;
      state.groups = answer.out.groups || [];
      state.group = answer.out.group || null;

      render();
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
