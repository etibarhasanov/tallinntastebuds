/* Tallinn Tastebuds — what gets reported to Google Analytics, said once.
 *
 * Every page carries Google's tag in its head, exactly as the console emits
 * it, and the tag on its own records one page view per address. That was
 * enough for nothing here: the map is one address on which everything
 * happens, and even the pages that do change address — a list, a profile,
 * the account page — are mostly buttons that change nothing in the address
 * bar. GA only ever sees a URL, so without a report of its own every press
 * was invisible.
 *
 * So each page reports its presses as events, and this is the one place
 * they are sent from. It used to live inside assets/app.js, which was fine
 * while the map was the only page that reported anything; the day the other
 * seven wanted to, it was either seven copies of the same three functions
 * or this file. The events themselves are listed in the README under
 * "Analytics", page by page, and the parameters — place, list_id, language,
 * style — need registering once as custom dimensions in Admin before GA
 * will break the numbers down by them.
 *
 * WHY A GLOBAL AND NOT A MODULE
 *
 * The same reason as assets/basemap.js and assets/pass.js: no build step, no
 * bundler, and a classic script that sets one global works everywhere,
 * `file://` included. Load it before the page's own script — both are
 * `defer`, so document order is execution order.
 *
 * TO REMOVE TRACKING
 *
 * Delete the gtag block from every page's head, or this file's script tag,
 * or both. Everything below checks for the tag and returns quietly when it
 * is missing, which is also what happens for a visitor running an ad
 * blocker, so every call site becomes a harmless no-op and none of them has
 * to change.
 */
window.TTBTrack = (function () {
  'use strict';

  /* The address the tag has already counted, so a place opened and closed
     and opened again is two views and the landing URL is not two. */
  var seenPath = null;

  function here() {
    return window.location.pathname + window.location.search;
  }

  function live() {
    return typeof window.gtag === 'function';
  }

  function event(name, params) {
    if (live()) window.gtag('event', name, params || {});
  }

  /* Attaches a report to a link or button that is built inline, and hands
     the same node back so it can stay inside the array it was written in. */
  function click(node, name, params) {
    if (node) node.addEventListener('click', function () { event(name, params); });
    return node;
  }

  /* A page view for something the tag did not see change: the map reports
     one per opened place, titled with the place, so the standard Pages and
     screens report doubles as a popularity ranking. */
  function view(title) {
    if (here() === seenPath) return;
    seenPath = here();
    if (live()) {
      window.gtag('event', 'page_view', {
        page_location: window.location.href,
        page_title: title
      });
    }
  }

  /* The address on screen has been counted already — by the tag itself on
     landing, or by view() before the page walked back to it. */
  function seen() {
    seenPath = here();
  }

  /* The links written straight into the markup — the wordmark home, the
     Instagram link, the mark on a pass — have no script of their own to
     report from, so they carry the event's name as data-track and are wired
     here, once, for every page. Deferred scripts run before DOMContentLoaded,
     so the whole page is there to walk. */
  document.addEventListener('DOMContentLoaded', function () {
    var marked = document.querySelectorAll('[data-track]');
    for (var i = 0; i < marked.length; i++) {
      click(marked[i], marked[i].getAttribute('data-track'));
    }
  });

  return { event: event, click: click, view: view, seen: seen };
})();
