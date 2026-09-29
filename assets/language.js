/* Tallinn Tastebuds — the language switch, for the pages that carry their own.
 *
 * window.TTBLanguage.mount(node, langs, current, onPick, label) draws the
 * trigger — the code you are in and a chevron — and the menu under it, one row
 * per language with the name that language has for itself, into `node`, and
 * calls onPick(code) when a row is pressed. isOpen() says whether the menu is
 * dropped, for a page whose keyboard shortcuts must stand back while it is.
 *
 * WHY IT EXISTS. Every other page reads its language off the map's switch and
 * has none. The flashcards could not — on flashcard.tallinntastebuds.ee the
 * ttb.lang the map writes belongs to another origin — so they drew their own,
 * and the chess page is the second page on the map's origin that has to, for
 * the same walk-from-the-map reason. Two copies of a menu that owns two
 * document listeners is where the third would have diverged; the function was
 * written before it.
 *
 * WHAT IT DOES NOT DO. The rules it is drawn with are in assets/styles.css —
 * #lang-switch, .btn-lang-now, .lang-list — and the surface under the trigger
 * is .lang-surface in assets/lists.css. Picking a language is the page's: it
 * knows how to ask its own route for the words, so this file only reports the
 * press, after closing the menu. And the MAP's switch in assets/app.js stays
 * where it is: it is bound into the map's state and its .controls z-index
 * rules, and moving it is a change to the map on its own.
 *
 * The menu shuts on Escape, with the focus handed back to the trigger it
 * dropped from — a keyboard that closes a menu and is left standing in nothing
 * has been put somewhere it cannot see — and on a press anywhere outside it.
 * Both listeners are put on the document once, however many times the switch
 * is redrawn, and both look at whichever node was mounted last.
 */
(function () {
  'use strict';

  var bar = null;
  var listening = false;

  function mark(open) {
    if (!bar) return;
    bar.classList.toggle('is-open', open);
    var now = bar.querySelector('.btn-lang-now');
    if (now) now.setAttribute('aria-expanded', String(open));
  }

  function isOpen() {
    return !!bar && bar.classList.contains('is-open');
  }

  function listen() {
    if (listening) return;
    listening = true;
    /* A press on the switch itself is inside it and leaves it alone. */
    document.addEventListener('click', function (ev) {
      if (bar && !bar.contains(ev.target)) mark(false);
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape' || !isOpen()) return;
      var now = bar.querySelector('.btn-lang-now');
      if (bar.contains(document.activeElement) && now) now.focus();
      mark(false);
    });
  }

  function node(tag, props, kids) {
    var n = document.createElement(tag);
    Object.keys(props).forEach(function (k) {
      if (k === 'className') n.className = props[k];
      else if (k === 'textContent') n.textContent = props[k];
      else if (k === 'html') n.innerHTML = props[k];
      else n.setAttribute(k, props[k]);
    });
    (kids || []).forEach(function (kid) { n.appendChild(kid); });
    return n;
  }

  /* langs is [{ code, name }], sorted here by code so every page lists them
     the same way whatever order the route sent. */
  function mount(host, langs, current, onPick, label) {
    bar = host;
    while (host.firstChild) host.removeChild(host.firstChild);
    /* Nothing to choose between. Either the route could not read
       data/ui.json — in which case the page has no words either and is drawing
       its markup's own English — or the site speaks one language, and a switch
       with one row in it is a button that does nothing. */
    if (!langs || langs.length < 2) return;
    listen();

    var now = node('button', {
      type: 'button',
      className: 'btn btn-lang-now',
      'aria-expanded': 'false',
      'aria-label': label || 'Language'
    }, [
      node('span', { textContent: current.toUpperCase() }),
      node('span', {
        className: 'caret',
        html: '<svg viewBox="0 0 10 6" aria-hidden="true" focusable="false"><path d="M1 1l4 4 4-4"/></svg>'
      })
    ]);
    now.addEventListener('click', function () {
      var open = !host.classList.contains('is-open');
      mark(open);
      if (open && window.TTBTrack) window.TTBTrack.event('language_open');
    });
    host.appendChild(now);

    var list = node('div', { className: 'lang-list' });
    langs.slice().sort(function (a, b) {
      return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
    }).forEach(function (lang) {
      var btn = node('button', {
        type: 'button',
        className: 'btn btn-lang',
        lang: lang.code,
        'aria-label': lang.name,
        'aria-pressed': String(lang.code === current)
      }, [
        node('span', { className: 'lang-code', textContent: lang.code.toUpperCase() }),
        node('span', { className: 'lang-name', textContent: lang.name })
      ]);
      btn.addEventListener('click', function () {
        mark(false);
        onPick(lang.code);
      });
      list.appendChild(btn);
    });
    host.appendChild(list);
  }

  window.TTBLanguage = { mount: mount, isOpen: isOpen };
})();
