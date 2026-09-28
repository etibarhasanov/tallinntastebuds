/* Tallinn Tastebuds — what gets reported, to Google Analytics and to this
 * site's own count of its visitors, said once.
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
 * AND THE SITE'S OWN COUNT
 *
 * The same file tells this site, not only Google, that a page was opened and
 * how long it was on screen: /admin/visitors is drawn from what the bottom
 * of this file sends, and functions/api/_visitors.js is what is counted and
 * why. Two reports a page, and no more — one when it opens, and one each
 * time it is hidden or put away, carrying the seconds it was visible and the
 * names of the presses event() saw meanwhile — so a visit of twelve presses
 * is not twelve requests. The one thing kept in the browser for it is the
 * date of the last day this browser opened a page here, `ttb.seen`, which is
 * how a page knows it is the browser's first today and whether there was an
 * earlier one; no id is made or sent. The owner's pages under /admin/ send
 * nothing.
 *
 * TO REMOVE TRACKING
 *
 * Delete the gtag block from every page's head, or this file's script tag,
 * or both. Everything below checks for the tag and returns quietly when it
 * is missing, which is also what happens for a visitor running an ad
 * blocker, so every call site becomes a harmless no-op and none of them has
 * to change. The site's own count is the part that does not check for the
 * tag: removing Google leaves it running, and removing this file's script
 * tag stops both.
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

  /* Every press goes to both tags. Google gets the name and the parameters;
     Clarity gets the name alone, as a custom event, which is what lets its
     dashboard filter recordings and heatmaps by the button that was pressed
     rather than by where on the page a click landed. Without this a heatmap
     says a spot on the screen was pressed and a replay says what one visit
     did, and neither can answer "who pressed Keep" across a week. Clarity's
     queue takes the call before its script lands, the same as gtag's. */
  function event(name, params) {
    params = params || {};
    params.layout = layout();
    tallied[name] = (tallied[name] || 0) + 1;
    if (live()) window.gtag('event', name, params);
    if (typeof window.clarity === 'function') window.clarity('event', name);
  }

  /* Which rail this browser was dealt on the map — 'a', the full column, or
     'b', the short one — read off the key pickLayout() in assets/app.js
     writes, so every event on every page carries it and GA can be split by
     it: what the short rail's visitors press against what the full rail's
     do. Every page and not the map alone, because the question is about the
     visitor and they carry the rail with them to the lists and back. 'a'
     where nothing is written, which is every browser from before the split
     and every page opened before the map has dealt one. Read on every event
     rather than once, since the map deals it after this script has loaded;
     a storage read is nothing next to the request it rides on. Clarity gets
     it as a tag once the page is up, below, which is what lets its
     recordings be filtered the same way. */
  var LAYOUT_KEY = 'ttb.layout';

  function layout() {
    return dealt() || 'a';
  }

  /* The rail as it was dealt, or '' where none has been — the site's own
     count keeps those apart rather than filing them under the full rail. */
  function dealt() {
    var id = '';
    try { id = window.localStorage.getItem(LAYOUT_KEY); } catch (e) { id = ''; }
    return id === 'a' || id === 'b' ? id : '';
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
    /* Deferred scripts have all run by now, so a rail dealt on any earlier
       visit is in storage. A stranger's first visit to the map is the one
       exception: the map deals the rail once its places are in, which is
       later than this, so that one visit is tagged 'a' here — see LATE
       below for how the site's own count avoids the same mistake. Clarity's
       queue takes the call before its script lands, the same as an event. */
    if (typeof window.clarity === 'function') window.clarity('set', 'layout', layout());
    var marked = document.querySelectorAll('[data-track]');
    for (var i = 0; i < marked.length; i++) {
      click(marked[i], marked[i].getAttribute('data-track'));
    }
    /* Here and not as the script loads, so every other deferred script
       has run. The map is the exception: it deals the rail once its places
       are in, which is later than this, and a stranger's first visit is the
       one the comparison of the two rails most needs — so its tag carries
       data-arrive="late" and assets/app.js calls arrive() itself once the
       rail is dealt. */
    if (!LATE) arrive();
  });

  /* ------------------------------------------------ the site's own count
   * See AND THE SITE'S OWN COUNT at the top. */

  var STATS = '/api/stats';
  var SEEN_KEY = 'ttb.seen';
  var COUNTED = window.location.pathname.indexOf('/admin') !== 0;
  var LATE = !!(document.currentScript && document.currentScript.getAttribute('data-arrive') === 'late');
  var arrived = false;

  var tallied = {};    // press name -> times, since the last report
  var shown = 0;       // milliseconds on screen, since the last report
  var since = null;    // when the page last came on screen, null while hidden

  /* A beacon survives the page being put away, which is when half of these
     are sent; fetch with keepalive is the same promise where there is no
     beacon. Nothing waits on either. */
  function send(body) {
    var data = JSON.stringify(body);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(STATS, data)) return;
    } catch (e) { /* fall through to fetch */ }
    try {
      fetch(STATS, { method: 'POST', body: data, keepalive: true,
        headers: { 'content-type': 'application/json' } }).catch(function () {});
    } catch (e) { /* the count misses one, and nobody is told */ }
  }

  /* Today in UTC, the clock functions/api/_visitors.js files days by. */
  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  /* The page opened. Whether it is this browser's first today, and whether
     it had a day before that, is the date in ttb.seen against today's — and
     where storage cannot be written, neither: the page is a view and never a
     visitor, which undercounts rather than counting a visitor per page.
     Once a page, however it is reached — see LATE. */
  function arrive() {
    if (arrived || !COUNTED) return;
    arrived = true;
    var day = today();
    var last = null;
    var kept = false;
    try {
      last = window.localStorage.getItem(SEEN_KEY);
      window.localStorage.setItem(SEEN_KEY, day);
      kept = true;
    } catch (e) { kept = false; }
    send({
      kind: 'arrive',
      id: window.location.pathname,
      first: kept && last !== day,
      back: kept && /^\d{4}-\d{2}-\d{2}$/.test(last || '') && last < day,
      from: document.referrer,
      layout: dealt()
    });
  }

  function onScreen() {
    if (since === null && document.visibilityState === 'visible') since = Date.now();
  }

  /* The page hidden or put away: the stretch it was on screen and the
     presses since the last report, sent once and forgotten. */
  function putAway() {
    /* A page put away before it said it was opened — the map, closed before
       its places came in — says so now, so the view is not lost. */
    arrive();
    if (since !== null) {
      shown += Date.now() - since;
      since = null;
    }
    var secs = Math.round(shown / 1000);
    if (!secs && !Object.keys(tallied).length) return;
    send({ kind: 'leave', id: window.location.pathname, secs: secs, presses: tallied, layout: dealt() });
    shown = 0;
    tallied = {};
  }

  if (COUNTED) {
    onScreen();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') putAway();
      else onScreen();
    });
    window.addEventListener('pagehide', putAway);
    window.addEventListener('pageshow', onScreen);
  }

  return { event: event, click: click, view: view, seen: seen, arrive: arrive };
})();
