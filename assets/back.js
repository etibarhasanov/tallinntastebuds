/* Tallinn Tastebuds — a swipe to the right is Back.
 *
 * On a phone the way back is a thumb dragged across the screen from left to
 * right, and every app anybody opens before this site answers it from
 * wherever the drag begins. A browser answers it only when the drag begins
 * on the very edge of the glass: start it an inch in, which is where a thumb
 * lands, and a page does nothing at all — or scrolls sideways, or moves the
 * map. On the lists page and on a place's write-up that read as the site
 * ignoring you. So every page a visitor reaches on this site listens for
 * the drag itself, and answers it the way the browser's own Back button
 * would: `history.back()`, nothing else. A place opened on the map closes,
 * because opening one is a history entry of its own (**Back** under
 * **Analytics** in README.md); a list goes back to the account page or the
 * map it was opened from; a post on the blog goes back to the index.
 *
 * WHAT IT IS NOT
 *
 * It is not a page that slides with the finger, the way iOS pages do. The
 * drag ends, and then the page changes. Drawing the page underneath would
 * mean knowing what the page underneath is, which no page here does — Back
 * is the browser's, and this only presses it.
 *
 * WHERE IT IS NOT
 *
 *   the map        sideways is how a map is moved. On index.html the swipe
 *                  is heard only on the panel, and only while ?spot= says a
 *                  place is open in it — with nothing open, Back is whatever
 *                  page came before the site, and a thumb across the places
 *                  column should not leave the site.
 *   the edge       a drag that begins within EDGE px of the left is the
 *                  browser's own gesture, on iOS and on Android alike, and
 *                  answering it here as well would press Back twice.
 *   something that a chip row, a photo strip, anything with
 *   moves sideways `touch-action: none`, `pan-x` or `pan-y` on it or over
 *                  it — the lightbox, the stories, a row's grip on a list of
 *                  your own, the sheet's grip, the card of a search result
 *                  on the map, which steps to the next result on a swipe —
 *                  and any ancestor that actually scrolls sideways. Those
 *                  have their own meaning for a finger going right, and were
 *                  laid out to say so in CSS: `pan-y` is the browser told to
 *                  keep its hands off everything but the up-and-down.
 *   a field        being typed in: a drag across text is selecting it.
 *   a carry        a row lifted on a list of your own is following the
 *                  finger (`is-lifted`, `is-carrying`), and the sheet on the
 *                  map being dragged (`is-dragging`) is too. The classes are
 *                  the pages' own; this reads them and sets none.
 *   a scroll       a finger that goes up or down as much as across is
 *                  scrolling. The direction is settled once, at LOCK px of
 *                  travel, and a swipe has to be twice as wide as it is tall.
 *   the flashcards a swipe on a card is an answer there, and splitwise
 *                  and the admin pages are on screens of their own; none of
 *                  the three carries this file.
 *
 * NOWHERE TO GO
 *
 * A page opened straight from a link has no entry behind it, and Back from
 * there is the browser's start page or a closed tab. The gesture goes to the
 * map instead: on this site the map is what a page is a step away from.
 * `navigation.canGoBack` says so exactly where it exists, and where it does
 * not, `history.length` says whether there is an entry at all — which can be
 * one on another site, and going there is what the Back button does too.
 *
 * WHY A FILE OF ITS OWN
 *
 * The same reason as assets/track.js: eight pages want the same few dozen lines,
 * and one file loaded after track.js, deferred like it, is one place to get
 * them wrong. It sets no global, because nothing asks it anything.
 */
(function () {
  'use strict';

  /* A drag that begins this close to the left edge is the browser's. */
  var EDGE = 24;
  /* Travel before the direction is settled, and travel before it counts. */
  var LOCK = 12;
  var SWIPE = 80;
  var HOME = '/';

  var tracking = false;
  var locked = false;
  var startX = 0;
  var startY = 0;

  function onMap() {
    return !!document.getElementById('map') && !!document.getElementById('panel');
  }

  /* Whether a finger landing on `node` is one this file may answer. */
  function allowed(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.closest('iframe')) return false;
    var field = node.closest('input, textarea, [contenteditable]');
    if (field && field === document.activeElement) return false;

    /* On the map, only a place's write-up, and only while one is open. */
    if (onMap()) {
      var panel = document.getElementById('panel');
      if (!panel.contains(node)) return false;
      if (!/(^|[?&])spot=/.test(window.location.search)) return false;
    }

    /* Up the tree: anything laid out to take a sideways finger keeps it. */
    var at = node;
    while (at && at !== document.body) {
      var style = window.getComputedStyle(at);
      var touch = style.touchAction || '';
      if (touch.indexOf('none') !== -1 || touch.indexOf('pan-x') !== -1 || touch.indexOf('pan-y') !== -1) return false;
      var overflow = style.overflowX;
      if ((overflow === 'auto' || overflow === 'scroll') && at.scrollWidth > at.clientWidth + 1) return false;
      at = at.parentNode;
    }
    return true;
  }

  function busy() {
    return !!document.querySelector('.is-lifted, .is-carrying, .is-dragging');
  }

  function goBack() {
    var nav = window.navigation;
    var can = nav && typeof nav.canGoBack === 'boolean' ? nav.canGoBack : window.history.length > 1;
    if (window.TTBTrack) window.TTBTrack.event('swipe_back', { can_go_back: can ? 1 : 0 });
    if (can) window.history.back();
    else window.location.href = HOME;
  }

  document.addEventListener('touchstart', function (ev) {
    tracking = false;
    if (ev.touches.length !== 1) return;
    var t = ev.touches[0];
    if (t.clientX < EDGE) return;
    if (!allowed(ev.target)) return;
    tracking = true;
    locked = false;
    startX = t.clientX;
    startY = t.clientY;
  }, { passive: true });

  document.addEventListener('touchmove', function (ev) {
    if (!tracking) return;
    if (ev.touches.length !== 1) { tracking = false; return; }
    var t = ev.touches[0];
    var dx = t.clientX - startX;
    var dy = t.clientY - startY;
    if (locked) return;
    if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return;
    /* Settled once: leftwards, or as much up or down as across, is not this. */
    if (dx < 0 || Math.abs(dy) * 2 > dx) { tracking = false; return; }
    locked = true;
  }, { passive: true });

  function release(ev) {
    if (!tracking) return;
    tracking = false;
    if (!locked || ev.type === 'touchcancel' || busy()) return;
    var t = ev.changedTouches && ev.changedTouches[0];
    if (!t) return;
    var dx = t.clientX - startX;
    var dy = t.clientY - startY;
    if (dx < SWIPE || Math.abs(dy) * 2 > dx) return;
    goBack();
  }

  document.addEventListener('touchend', release, { passive: true });
  document.addEventListener('touchcancel', release, { passive: true });
})();
