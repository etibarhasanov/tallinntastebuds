/* Tallinn Tastebuds — the map is the shell, and every other page opens on it.
 *
 * A walk from the map to a list, the account, the blog, the flashcards, the
 * chess page or the feedback page used to be a navigation: the map's document
 * torn down, the next one built from nothing, and everything the first one
 * held gone with it — the radio's <audio> most audibly. assets/radio.js
 * carried the station and the switch across in sessionStorage so the next
 * page could rejoin the stream, and the seam that left was the navigation
 * itself plus the stream reconnecting: a second of silence on every walk,
 * which the flashcards had already shown up by having none between one deck
 * and the next. They stay in their document. This makes the whole site do
 * the same, without making the whole site one document.
 *
 * HOW: A FRAME, NOT A ROUTER
 *
 * The page is loaded into an <iframe> inside a full-screen surface over the
 * map, and the map stays underneath it, playing. The frame is the browser's
 * own container for a whole page inside another: the page keeps its own
 * window, its own ids, its own stylesheets, listeners, timers and scroll,
 * and does not know it is anywhere but a tab. Six page scripts and twelve
 * thousand lines of this one would have had to learn to mount and unmount
 * into each other to do it the other way, and every one of them would have
 * been a chance to break a page that was not the one being changed. Nothing
 * in assets/lists.js, account.js, blog.js, flashcard.js, chess.js or
 * feedback.js changes for this, and that is the argument for it.
 *
 * Two things a framed page cannot do for itself, so this does them for it:
 * the radio, because the map's is the one that is playing — assets/radio.js
 * hands a framed page's button to the map's radio, see A PAGE INSIDE THE MAP
 * there — and the address bar and the tab's title, which belong to the map's
 * document and are written here to say what the page inside is showing.
 *
 * THE ADDRESS STAYS TRUE
 *
 * Opening a page pushes its address, so the bar reads /flashcard and a copied
 * link is a link to the flashcards, loaded whole, as it always was. From
 * there the page walks on its own — a deck, a list, the account — and each of
 * those walks is a step in the tab's history that the frame owns: this
 * document's entry is one and the same across all of them, which is why
 * nothing here pushes a second time. What that one entry says is rewritten
 * instead, every time the page inside moves — on each document that
 * arrives, on each push the page makes inside its own document (its
 * history's two writes are wrapped, see hook()), and on each popstate the
 * page gets from Back or Forward. Rewriting it is right precisely because it
 * is shared: there is one address bar and it says where the page is now.
 * The step before the first page is the map, a different entry, and landing
 * on it is where the surface closes.
 *
 * Every page keeps its own address and its own whole document. A link sent
 * to somebody, a middle click, a crawler, a fresh load of /lists: all of
 * them get the page as a page. Only a walk that starts on the map takes this
 * road, and a walk that cannot — a modifier key held, a link with a target of
 * its own, a file rather than a page — is left to the browser.
 *
 * WHAT GOES THROUGH THE TOP
 *
 * Three links inside a page cannot be followed inside the frame. The name in
 * the page's header is the way home, and home is the map this surface is
 * standing on, so that link closes the surface rather than loading a second
 * map inside it. Continue with Google is a redirect to Google, and Google
 * refuses to be framed by anybody, so that one goes through the top of the
 * tab — the whole tab leaves for Google and comes back to the page it left
 * from, as it always did. And a link to another site is left alone in the
 * same way: it leaves, through the top. A page that walks home by itself —
 * the account page after Sign out — is noticed on arrival and closed the
 * same way the name does it.
 *
 * WHAT THE MAP IS TOLD
 *
 * Only that the surface closed. A page can sign somebody in or out, save a
 * place, make a list, and the map underneath was drawn before any of that,
 * so on close the map asks /api/account again — what mount()'s onclose is
 * for. While a page is open the rest of the map is inert: not focusable, not
 * pressable, not read by a screen reader, so that the keyboard and the
 * reader are on the page the eyes are.
 *
 * WHY A GLOBAL AND NOT A MODULE
 *
 * Same as assets/radio.js and assets/basemap.js: no build step, so a classic
 * script that sets one global, loaded before assets/app.js, which mounts it.
 */
window.TTBShell = (function () {
  'use strict';

  var root = null;        // the surface, #shell in the markup
  var frame = null;       // the <iframe> inside it while a page is open
  var opener = null;      // the link that opened it, for the focus to go back to
  var ownTitle = '';      // the map's title, put back when the page closes
  var mapUrl = '';        // the map's address when the page opened, put back by home()
  var told = null;        // the map's onclose, from mount()
  var warned = null;      // and its onopen, before the surface goes up
  var watching = 0;       // requestAnimationFrame handle of watch(), while a document is awaited
  var titleWatch = null;  // MutationObserver on the page's <title>

  /* Which addresses open on the map: this site's own pages, and nothing
     else. Not the map itself — a link to "/" is the way home, and home is
     already here — and not a file: a photo, a data file, a stylesheet, which
     a browser would show as a page but which are not one. The owner's pages
     under /admin are tools rather than a walk, and admin.html keeps a token
     in its own document; both stay whole-tab. Everything else — the lists,
     a list, a profile, the account, the blog and a post, the flashcards, the
     chess page, the feedback page, the pass pages, the privacy page — is a
     page a visitor walks to, and comes back from. */
  function framed(url) {
    var a = document.createElement('a');
    a.href = url;
    if (a.protocol + '//' + a.host !== window.location.protocol + '//' + window.location.host) return false;
    var path = a.pathname;
    if (path === '/' || path === '/index.html' || path === '/admin.html') return false;
    if (/^\/(api|assets|photos|stories|data|clips|flows|admin)(\/|$)/.test(path)) return false;
    if (/\.(json|xml|txt|png|webp|jpg|jpeg|svg|ico|sql|bpmn|mp4|mp3|css|js)$/i.test(path)) return false;
    return true;
  }

  /* The <a> a click landed in, if any. The page's own scripts wrap text in
     spans inside links, so the target is rarely the anchor itself. */
  function anchorOf(node) {
    while (node && node.nodeType === 1) {
      if (node.tagName === 'A' && node.hasAttribute('href')) return node;
      node = node.parentNode;
    }
    return null;
  }

  /* A plain press: the main button, no key held. Anything else — a middle
     click, Ctrl or Cmd for a new tab, Shift for a new window — is the
     visitor asking the browser for something this surface is not, and the
     browser gets it. */
  function plain(ev) {
    return ev.button === 0 && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey && !ev.altKey;
  }

  /* ----------------------------------------------------------- the surface */

  function seal(on) {
    var kids = document.body.children;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i] === root) continue;
      if (on) kids[i].setAttribute('inert', '');
      else kids[i].removeAttribute('inert');
    }
  }

  function open(url, link) {
    if (!root) return false;
    opener = link || null;
    if (!frame) {
      mapUrl = window.location.href;
      ownTitle = document.title;
    }
    try { window.history.pushState({ shell: url }, '', url); } catch (e) { return false; }
    if (warned) warned();
    show(url);
    return true;
  }

  /* A fresh frame every time, never the last one pointed somewhere new: the
     old page's listeners, timers and radio button go with its document, and
     a page that was closed and opened again starts where a fresh load would. */
  function show(url) {
    drop();
    frame = document.createElement('iframe');
    frame.className = 'shell-frame';
    frame.title = ownTitle;
    frame.addEventListener('load', loaded);
    frame.src = url;
    root.appendChild(frame);
    root.hidden = false;
    seal(true);
    watch();
  }

  function drop() {
    if (watching) { window.cancelAnimationFrame(watching); watching = 0; }
    if (titleWatch) { titleWatch.disconnect(); titleWatch = null; }
    if (frame) { root.removeChild(frame); frame = null; }
  }

  function close() {
    if (!frame) return;
    drop();
    root.hidden = true;
    root.removeAttribute('aria-label');
    seal(false);
    document.title = ownTitle;
    if (opener && opener.focus && document.body.contains(opener)) opener.focus();
    opener = null;
    if (told) told();
  }

  /* The way home: the map's own address pushed, so that Back from the map
     is the page just left, as it would be between two documents. */
  function home() {
    if (!frame) return;
    try { window.history.pushState(null, '', mapUrl); } catch (e) { /* the surface still closes */ }
    close();
  }

  /* -------------------------------------------------- the page inside it */

  /* A new document inside the frame, as soon as there is one. The frame's
     own load event is the end of the page — every script run, every image
     in — and two things cannot wait for that: a page that is the map, which
     must close before it draws a map inside the map, and the page's history,
     which has to be wrapped before its script pushes anything. A document
     exists the moment the navigation commits, so this looks for one once a
     frame, from the frame being pointed at the address until the document
     is not the blank one the frame starts with, and again from each
     pagehide — the old document leaving for the next. A document from
     another origin cannot be read and ends the looking; nothing of this
     site's goes anywhere that can be read back. */
  function watch() {
    if (watching) window.cancelAnimationFrame(watching);
    var since = Date.now();
    var tick = function () {
      watching = 0;
      if (!frame) return;
      var win;
      try { win = frame.contentWindow; if (!win || !win.document) return; } catch (e) { return; }
      var doc;
      try { doc = win.document; if (doc.location.href === 'about:blank') doc = null; } catch (e) { return; }
      if (doc) { arrive(win, doc); return; }
      if (Date.now() - since < 15000) watching = window.requestAnimationFrame(tick);
    };
    watching = window.requestAnimationFrame(tick);
  }

  function arrive(win, doc) {
    if (win.ttbShelled === doc) return;
    win.ttbShelled = doc;
    var path = doc.location.pathname;
    if (path === '/' || path === '/index.html') { home(); return; }
    mirror(doc.location);
    hook(win);
    win.addEventListener('popstate', function () { mirror(win.location); });
    doc.addEventListener('click', inside, true);
    win.addEventListener('pagehide', watch);
  }

  /* This document's address, written to say what the page inside is at. The
     state carries it too, so a Forward that lands on this step with the
     surface closed — the visitor went home and then back — knows what to
     open. */
  function mirror(loc) {
    var url = loc.pathname + loc.search + loc.hash;
    try { window.history.replaceState({ shell: url }, '', url); } catch (e) { /* ignore */ }
  }

  /* The page's own two writes to history, wrapped so that each is mirrored
     here: a deck opening on the flashcards, a post on the blog, a search on
     a list. Own properties on the page's history object, shadowing the
     prototype's, which is why the originals are kept and called. */
  function hook(win) {
    var history = win.history;
    var push = history.pushState;
    var replace = history.replaceState;
    history.pushState = function () {
      push.apply(history, arguments);
      mirror(win.location);
    };
    history.replaceState = function () {
      replace.apply(history, arguments);
      mirror(win.location);
    };
  }

  /* A press inside the page, before the page sees it. The name is the way
     home and home is the map underneath; Google and other sites refuse a
     frame, so those leave through the top of the tab. Everything else is the
     page's own. */
  function inside(ev) {
    if (!plain(ev)) return;
    var a = anchorOf(ev.target);
    if (!a || a.target || a.hasAttribute('download')) return;
    var href = a.href;
    var here = window.location.protocol + '//' + window.location.host;
    var ours = href.indexOf(here + '/') === 0 || href === here;
    var path = ours ? href.slice(here.length).split(/[?#]/)[0] : '';
    if (ours && (path === '/' || path === '/index.html')) {
      ev.preventDefault();
      home();
      return;
    }
    if (!ours || path.indexOf('/api/') === 0) a.target = '_top';
  }

  function loaded() {
    var win, doc;
    try { win = frame.contentWindow; doc = frame.contentDocument; } catch (e) { return; }
    if (!win || !doc) return;
    arrive(win, doc);
    if (!frame) return;
    entitle(doc);
    if (titleWatch) titleWatch.disconnect();
    titleWatch = null;
    var title = doc.querySelector('title');
    if (title && window.MutationObserver) {
      titleWatch = new MutationObserver(function () { entitle(doc); });
      titleWatch.observe(title, { childList: true, characterData: true, subtree: true });
    }
    frame.focus();
  }

  /* The tab says what the page inside says, and so does the surface to a
     screen reader: a dialog with the page's own name on it. */
  function entitle(doc) {
    var said = doc.title || ownTitle;
    document.title = said;
    frame.title = said;
    root.setAttribute('aria-label', said);
  }

  /* ----------------------------------------------------------- the walks */

  /* A press on a link on the map. In the bubbling phase and after the link's
     own listeners, so a link the map answers itself — one that said
     preventDefault — is left to it, and the press is still reported by
     whatever data-track it carries. */
  document.addEventListener('click', function (ev) {
    if (ev.defaultPrevented || !plain(ev)) return;
    var a = anchorOf(ev.target);
    if (!a || a.target || a.hasAttribute('download')) return;
    if (!framed(a.href)) return;
    if (open(a.href, a)) ev.preventDefault();
  });

  /* Back and Forward. Whatever step the browser lands on, match it: a step
     with a page on it has the surface open, a step without has it closed.
     The steps a page makes inside itself are walked by the page, and the
     surface is already open on each of them; only the first step back onto
     the map, and the first step forward off it, change anything here. */
  window.addEventListener('popstate', function (ev) {
    var at = ev.state && ev.state.shell;
    if (at && !frame) {
      if (!root) return;
      ownTitle = ownTitle || document.title;
      show(at);
    } else if (!at && frame) {
      close();
    }
  });

  /* Whether a page is open over the map. The map's own history listener
     asks, so that an entry whose address is a page's is left to the page. */
  function up() {
    return !!frame;
  }

  /* The map hands over the surface and somewhere to send the news: onopen
     as a page is about to go up, for the sheets the map shuts behind it,
     and onclose once it has gone, for the account the map asks about again. */
  function mount(opts) {
    root = opts.surface;
    warned = opts.onopen || null;
    told = opts.onclose || null;
    mapUrl = window.location.href;
  }

  return { mount: mount, open: open, close: close, up: up };
})();
