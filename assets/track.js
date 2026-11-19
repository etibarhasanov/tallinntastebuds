/* Tallinn Tastebuds — what gets reported, to Microsoft Clarity and to this
 * site's own count of its visitors, said once.
 *
 * The map is one address on which everything happens, and even the pages
 * that do change address — a list, a profile, the account page — are mostly
 * buttons that change nothing in the address bar. So each page reports its
 * presses by name, and this is the one place they are sent from. It used to
 * live inside assets/app.js, which was fine while the map was the only page
 * that reported anything; the day the other seven wanted to, it was either
 * seven copies of the same three functions or this file. The names are
 * listed in the README under "Analytics", page by page.
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
 * The same file tells this site, not only Clarity, that a page was opened and
 * how long it was on screen: /admin/visitors is drawn from what the bottom
 * of this file sends, and functions/api/_visitors.js is what is counted and
 * why. Two reports a page, and no more — one when it opens, and one each
 * time it is hidden or put away, carrying the seconds it was visible and the
 * names of the presses event() saw meanwhile — so a visit of twelve presses
 * is not twelve requests. Two things are kept in the browser for it, both
 * dates: the last day this browser opened a page here, `ttb.seen`, which is
 * how a page knows it is the browser's first today and whether there was an
 * earlier one; and the first day it ever did, `ttb.since`, which is how every
 * later page that day still knows whether it belongs to a new visitor or a
 * returning one. No id is made or sent. The owner's pages under /admin/ send
 * nothing, and neither does any page in a browser carrying the `ttb_owner`
 * cookie — the owner's, signed in or not; THE OWNER'S BROWSER in
 * functions/api/_admin.js — nor does a browser a program is driving, which
 * navigator.webdriver says. `owner` and `driven` on the object below say so,
 * for the three pages that post a press of their own — the map, the lists
 * and the blog.
 *
 * Every report says what it was made on — phone, tablet or desktop, device()
 * below — and those three pages put the same word on the presses they post
 * through `device` on the object, so every number on the owner's pages can
 * be read for one kind of device. BY DEVICE in functions/api/_visitors.js.
 *
 * THE ORDER THEY CAME IN
 *
 * The same report also carries the names in the order they first happened —
 * the trail — so the diagrams on /admin/flows can say how people move from
 * one step to the next, and functions/api/_flows.js is what turns a trail
 * into steps and arrows — and functions/api/_visitors.js reads the same
 * report a second way, as the views that reported at all, the ones that
 * pressed nothing, and the page before this one. Each name is in it once
 * per page, however many times it was pressed, the rule a place opened
 * already follows, and a place opened rides in it as `view`, the same
 * moment view() reports one. A journey that crosses pages — the map, then
 * a list — is two page loads, so the tab keeps the last name it reported
 * under `ttb.step` in sessionStorage and the next page sends it as the step
 * before its first.
 * One word, per tab, gone when the tab closes, and nothing that says who
 * anybody is.
 *
 * And how the page was found: the first report carries the address the
 * page was opened at and its `?from=` tag if the link had one — the owner's
 * own, or `share` from a Share button — and a report when the page is put
 * away carries the words typed into a search field meanwhile, out of the
 * `search` events every field already sends. /admin/found reads them; HOW
 * THEY FOUND IT in functions/api/_visitors.js says what they are and what
 * cannot be had.
 *
 * And what the page was about, where a press name alone cannot say: the
 * story that came up and whether it was watched to the end, the post read,
 * the deck opened, the discount's pass shown and the scan that said yes to
 * it. A page tells about() once per thing per load, and the next report
 * carries it. WHAT IT WAS ABOUT in functions/api/_visitors.js is the rest.
 *
 * The first report of a browser's first page today also says which
 * language it arrived in — the one on screen before any switch, which is
 * the one the site chose. Until 2026-11-19 the reports also split the
 * seconds on screen by language, kept every switch as a pair, carried the
 * second each name happened at and how the tab arrived, and the colour a
 * newcomer had been dealt; the count stopped filing all of them, and the
 * colour test is over — newcomers open in Red, the default every page
 * already draws, and the swatch is a choice again.
 *
 * TO REMOVE TRACKING
 *
 * Delete assets/analytics.js's script tag from every page, or this file's,
 * or both. Everything below checks for Clarity and returns quietly when it
 * is missing, which is also what happens for a visitor running an ad
 * blocker, so every call site becomes a harmless no-op and none of them has
 * to change. The site's own count is the part that does not check for it:
 * removing Clarity leaves it running, and removing this file's script tag
 * stops both.
 */
window.TTBTrack = (function () {
  'use strict';

  /* The address already counted as a view, so a place opened and closed
     and opened again is two views and the landing URL is not two. */
  var seenPath = null;

  function here() {
    return window.location.pathname + window.location.search;
  }

  /* Every press goes to Clarity by name, as a custom event, which is what
     lets its dashboard filter recordings and heatmaps by the button that was
     pressed rather than by where on the page a click landed. Without this a heatmap
     says a spot on the screen was pressed and a replay says what one visit
     did, and neither can answer "who pressed Keep" across a week. Clarity's
     queue takes the call before its script lands. Clarity takes only the
     name; the parameters are read here — the language switched to, the
     words searched — for the site's own count. */
  function event(name, params) {
    params = params || {};
    tallied[name] = (tallied[name] || 0) + 1;
    step(name);
    if (name === 'language_select') switched(params.language);
    if (name === 'search') searchedFor(params);
    if (typeof window.clarity === 'function') window.clarity('event', name);
  }

  /* A refusal from /api/account, reported as a press of its own:
     account_err_ and the error the route sent, its dashes as underscores —
     `taken`, `password`, `slow_down` — and `generic` where it sent none,
     which is a network that failed as often as a server that did. The map
     and the flashcards each carry a sign-in form, and both report a refusal
     through this so the one word is spelt one way. The name is a press like any other here; functions/api/_visitors.js is
     what also files it under SIGNING UP, which is where /admin/visitors
     reads why people who tried to make an account did not. `view` is the
     form it happened on — 'up', 'in' or 'google', the naming step. */
  function refused(out, view) {
    var said = out && typeof out.error === 'string' ? out.error.replace(/-/g, '_') : '';
    event('account_err_' + (/^[a-z_]{1,20}$/.test(said) ? said : 'generic'), { view: view });
  }

  /* Which of the directory's two looks this browser was dealt — 'a', the page
     as it was, or 'b', at rest — read off the key pickLook() in
     assets/lists.js writes, and '' where none was, which is everybody who
     was not new to the site when they first opened /lists. Set as a
     Clarity tag where there is one, so a recording can be filtered to a
     look. The site's own count is where the test is read — "The lists' two
     looks" in docs/handbook.md. */
  var LOOK_KEY = 'ttb.look';

  function look() {
    var id = '';
    try { id = window.localStorage.getItem(LOOK_KEY); } catch (e) { id = ''; }
    return id === 'a' || id === 'b' ? id : '';
  }

  /* Attaches a report to a link or button that is built inline, and hands
     the same node back so it can stay inside the array it was written in. */
  function click(node, name, params) {
    if (node) node.addEventListener('click', function () { event(name, params); });
    return node;
  }

  /* A page view for something the address bar did not show change: the map
     reports one per opened place. The count needs only that a view
     happened, so `title` is not read. */
  function view(title) {
    /* Before the address check: a deep-linked place is one the landing
       already counted, and still a step somebody took. */
    step('view');
    if (here() === seenPath) return;
    seenPath = here();
    opened += 1;
  }

  /* The address on screen has been counted already — by the landing, or by
     view() before the page walked back to it. */
  function seen() {
    seenPath = here();
  }

  /* The links written straight into the markup — the wordmark home, the
     Instagram link, the mark on a pass — have no script of their own to
     report from, so they carry the event's name as data-track and are wired
     here, once, for every page. Deferred scripts run before DOMContentLoaded,
     so the whole page is there to walk. */
  document.addEventListener('DOMContentLoaded', function () {
    /* The test a recording can be filtered by, as a Clarity tag. Deferred
       scripts have all run by now, so a look dealt on this very page is in
       storage. Clarity's queue takes the call before its script lands, the
       same as an event. */
    if (typeof window.clarity === 'function') {
      /* The directory's look, where there is one. A stranger's first open
         of /lists is dealt one before this runs — pickLook() is called as
         the page's own deferred script boots — so that visit is tagged. */
      if (look()) window.clarity('set', 'look', look());
    }
    var marked = document.querySelectorAll('[data-track]');
    for (var i = 0; i < marked.length; i++) {
      click(marked[i], marked[i].getAttribute('data-track'));
    }
    /* Here and not as the script loads, so every other deferred script
       has run. */
    arrive();
  });

  /* ------------------------------------------------ the site's own count
   * See AND THE SITE'S OWN COUNT at the top. */

  var STATS = '/api/stats';
  var SEEN_KEY = 'ttb.seen';
  var SINCE_KEY = 'ttb.since';
  var STEP_KEY = 'ttb.step';
  var OWNER = /(?:^|;\s*)ttb_owner=1(?:;|$)/.test(document.cookie);
  /* A browser a program is driving — Playwright, Puppeteer, Selenium, and
     so every Claude Code session that opens the site to look at it — says so
     in navigator.webdriver, which a person's browser never sets. Such a page
     is nobody visiting: before this, two in three desktop visits from the
     United States were three seconds long, pressed nothing and were closed
     rather than hidden. It counts nothing, like the owner's — NOT A PROGRAM
     in functions/api/stats.js is the server's half. On the site's own
     hosts only: under `pages dev` the count is a copy on the machine, and a
     session driving a change to the count has to be able to make one. */
  var DRIVEN = navigator.webdriver === true && /(^|\.)tallinntastebuds\.ee$/.test(window.location.hostname);
  var COUNTED = window.location.pathname.indexOf('/admin') !== 0 && !OWNER && !DRIVEN;
  /* Which page this is, for the count: its own address, except where its tag
     says otherwise. 404.html is the one that does — Pages serves it at
     whatever address was mistyped, and that address names no page, so it
     reports itself as /404, the address PAGES in functions/api/_visitors.js
     knows it by. */
  var PAGE = (document.currentScript && document.currentScript.getAttribute('data-page')) || window.location.pathname;
  var arrived = false;
  var DAY = /^\d{4}-\d{2}-\d{2}$/;

  var tallied = {};    // press name -> times, since the last report
  var opened = 0;      // views reported with view() — a place, a post, a deck — since the last report
  var abouts = [];     // 'what:id' the page was about, since the last report
  var told = {};       // 'what:id' -> true, once it is in abouts: once a page
  var trail = [];      // names first seen this page, in order, since the last report
  var walked = {};     // name -> true, once it is in a trail — THE ORDER THEY CAME IN
  var earlier = '';    // the last name reported, this page or the one before it in this tab
  var fresh = true;    // no report has left this page yet, so the first says the page opened
  var quiet = false;   // the first report went with nothing pressed, and nothing has been since
  var who = '';        // 'new' or 'back', once arrive() has read the dates
  var shown = 0;       // milliseconds on screen, since the last report
  var since = null;    // when the page last came on screen, null while hidden
  var lang = langNow();  // the language on screen, as <html lang> last said
  var first = false;   // this page is the browser's first today, not yet told
  var arrivedIn = '';  // the language on screen before the first switch
  var searched = [];   // { scope, term, results } typed into a search field, since the last report

  /* The query as the page was opened, read now, before the page's own
     script has had a chance to rewrite it — the map puts a place's ?spot= in
     the address as somebody opens one, and a page put away before it said
     it was opened says so then (see putAway()), so reading it in arrive()
     could file a search visitor under a place they opened rather than the
     one they landed on. The `?from=` tag
     rides in it: functions/api/_visitors.js, HOW THEY FOUND IT. */
  var LANDED = window.location.search;
  var TAGGED = (function () {
    try { return new URLSearchParams(LANDED).get('from') || ''; } catch (e) { return ''; }
  })();

  /* A beacon survives the page being put away, which is when half of these
     are sent; fetch with keepalive is the same promise where there is no
     beacon. Nothing waits on either. Every report carries the device it
     was made on, so the count can file it a second time under it — BY
     DEVICE in functions/api/_visitors.js. */
  function send(body) {
    body.device = device();
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

  /* A step of a journey, once per page — THE ORDER THEY CAME IN. */
  function step(name) {
    if (!COUNTED || walked[name]) return;
    walked[name] = true;
    trail.push(name);
  }

  /* The name a trail ends on, as the next report or the next page will send
     it, with this page's path on it: a view or the page itself says nothing
     on its own about which page it was, and a press may mean one thing on
     this page and another elsewhere — earlierOf() in
     functions/api/_flows.js is what reads the path back into a page. */
  function lastStep(names) {
    var name = names[names.length - 1];
    if (name === 'page' || name === 'view') return name + ':' + PAGE;
    return name + '@' + PAGE;
  }

  /* The page opened. Whether it is this browser's first today, and whether
     it had a day before that, is the date in ttb.seen against today's — and
     where storage cannot be written, neither: the page is a view and never a
     visitor, which undercounts rather than counting a visitor per page.
     Once a page, however it is reached.

     `who` is the same question asked of every page rather than only the
     first: a browser whose first day here is today is new all day, and one
     that came before is returning. ttb.seen cannot answer it past the first
     page, because the first page overwrites it with today, so ttb.since
     keeps the first day. A browser from before ttb.since existed takes the
     earlier day ttb.seen remembers.

     Both dates are this count's own, and the count began on 28 September
     2026, so on its first day every browser was new. */
  function arrive() {
    if (arrived || !COUNTED) return;
    arrived = true;
    var day = today();
    var last = null;
    var kept = false;
    try {
      last = window.localStorage.getItem(SEEN_KEY);
      var began = firstDay(day);
      if (began !== window.localStorage.getItem(SINCE_KEY)) window.localStorage.setItem(SINCE_KEY, began);
      window.localStorage.setItem(SEEN_KEY, day);
      who = began < day ? 'back' : 'new';
      kept = true;
    } catch (e) { kept = false; }
    first = kept && last !== day;
    send({
      kind: 'arrive',
      id: PAGE,
      /* The whole address, query and all, which the count reads only for a
         visitor a search engine sent — FOUND BY A SEARCH ENGINE in
         functions/api/_visitors.js: /blog?post=… and /?spot=… are the pages
         a search lands on, and the path alone would file them all as the
         blog and the map. The query as the page was opened — LANDED. */
      at: (PAGE + LANDED).slice(0, 200),
      first: first,
      back: who === 'back',
      who: who,
      from: document.referrer,
      /* The language the browser asks for, as two letters — the site's
         count of which languages people arrive wanting, spoken here or not.
         Read straight off the browser, never off the page, which has
         already picked one out of it. */
      asks: String(window.navigator.language || '').slice(0, 2).toLowerCase(),
      tag: TAGGED
    });
    untag();
  }

  /* The `?from=` tag off the address once it has been counted, so a reload
     is not a second visit by the link and a copy of the address shared on
     is not the owner's link any more. Only that parameter, and only if it is
     still there. */
  function untag() {
    if (!TAGGED) return;
    try {
      var url = new URL(window.location.href);
      if (!url.searchParams.has('from')) return;
      url.searchParams.delete('from');
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    } catch (e) { /* the tag stays in the address, and is counted again on a reload */ }
  }

  /* A search, for the site's own count of what people look for — HOW THEY
     FOUND IT in functions/api/_visitors.js. Every field reports one once the
     typing pauses, and the directory's pause is short enough that "piz" and
     "pizza" can both arrive; so a search that only lengthens or shortens the
     last one in the same field takes its place rather than joining it, and
     the words that are sent are the ones the typing settled on. `results`
     rides along where the field knows it, which is how a search that found
     nothing is told apart. Ten a report at most. */
  function searchedFor(params) {
    var term = String(params.search_term || '');
    var scope = String(params.scope || '');
    if (!COUNTED || !term || !scope) return;
    var entry = { scope: scope, term: term };
    if (typeof params.results === 'number') entry.results = params.results;
    var last = searched[searched.length - 1];
    if (last && last.scope === scope && (term.indexOf(last.term) === 0 || last.term.indexOf(term) === 0)) {
      searched[searched.length - 1] = entry;
    } else if (searched.length < 10) {
      searched.push(entry);
    }
  }

  /* What the page is about — see the header: `what` is story, watched, post,
     deck, pass or verified, and `id` the thing's own id out of the file the
     site ships it in. Once per thing per load, however often the page shows
     it again, and sent with the next report. */
  function about(what, id) {
    var key = what + ':' + id;
    if (!COUNTED || !id || told[key]) return;
    told[key] = true;
    abouts.push(key);
  }

  /* The first day this browser was here, as arrive() above reads it: the day
     ttb.since kept, else the earlier day ttb.seen remembers, else today. Reads and never writes, so it
     can be asked before arrive() has run as well as after it; throws where
     storage does, and the caller decides what that means. */
  function firstDay(day) {
    var last = window.localStorage.getItem(SEEN_KEY);
    var began = window.localStorage.getItem(SINCE_KEY);
    if (!DAY.test(began || '')) began = DAY.test(last || '') && last < day ? last : day;
    return began;
  }

  /* Whether this browser is new to the site — its first day here is today —
     the same `new` arrive() reports. What the directory's two looks are
     dealt by: pickLook() in assets/lists.js gives one only to somebody this
     says yes to. No where the count is off — the owner's browser, an /admin
     page — and where storage cannot be read, since a deal that cannot be
     kept is no deal. */
  function newcomer() {
    if (!COUNTED) return false;
    try { return firstDay(today()) === today(); } catch (e) { return false; }
  }

  /* Phone, tablet or desktop, by what the browser says it is driven with: a
     coarse primary pointer is a finger, and a finger on something narrower
     than 768px is a phone. A laptop with a touchscreen keeps its mouse as
     the primary pointer and counts as a desktop, which is what it is. Handed
     out as TTBTrack.device() as well, for the three pages that post a
     press of their own, so a press and a visit are filed under the same
     device by the same rule. */
  function device() {
    var coarse = false;
    try { coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); } catch (e) { coarse = false; }
    if (!coarse) return 'desktop';
    return window.innerWidth < 768 ? 'phone' : 'tablet';
  }

  function onScreen() {
    if (since === null && document.visibilityState === 'visible') since = Date.now();
  }

  function langNow() {
    return String(document.documentElement.lang || '').toLowerCase();
  }

  /* The time on screen since `since`, added to the stretch, with the clock
     left running. */
  function charge() {
    if (since === null) return;
    var now = Date.now();
    shown += now - since;
    since = now;
  }

  /* <html lang> changed. Every page sets it once as it boots, over the
     English the markup ships with. */
  function relang() {
    lang = langNow();
  }

  /* The switch was pressed. Whether the page has written the new language on
     to <html lang> yet or is about to, the observer below has not run — it
     runs once this press is over — so `lang` is still the one it was
     switched from, which is the one the browser arrived in if it is the
     first switch. */
  function switched(to) {
    to = String(to || '').toLowerCase();
    if (!lang || !to || to === lang) return;
    if (!arrivedIn) arrivedIn = lang;
  }

  /* The page hidden or put away: the stretch it was on screen, the presses,
     the places opened and the trail since the last report, sent once and
     forgotten.
     The first report of a browser's first page today also says which
     language it arrived in — the one before any switch, which is the one the
     site chose — and the first report of any page says the page opened, so
     the diagrams count the page itself as a step before the trail. */
  function putAway() {
    /* A page put away before it said it was opened — closed before its
       scripts had all run — says so now, so the view is not lost. */
    arrive();
    charge();
    since = null;
    var secs = Math.round(shown / 1000);
    if (!secs && !opened && !first && !fresh && !Object.keys(tallied).length &&
        !trail.length && !searched.length && !abouts.length) return;
    var body = { kind: 'leave', id: PAGE, secs: secs, presses: tallied, places: opened, who: who,
      trail: trail, earlier: earlier, opened: fresh, searches: searched, about: abouts };
    /* Whether this view pressed nothing is decided on its first report, and
       a first report is sent the first time the page is hidden — a glance at
       a message, a phone locked between two cards — so a visitor who came
       back and used the page had already been counted as one who looked and
       left. The first report still says so, since it may be the only one;
       the first later report that carries a trail takes it back, once.
       countLeave() in functions/api/_visitors.js is the other half. */
    if (fresh) quiet = !trail.length;
    else if (quiet && trail.length) {
      body.woke = true;
      quiet = false;
    }
    if (first) {
      body.first = true;
      body.lang = arrivedIn || lang;
      first = false;
    }
    /* Where this leaves off, for the next stretch or the next page: the last
       name of the trail, or the page itself when its first report carried
       no names, so a page nobody pressed anything on is still the step
       before whatever the tab does next. */
    var names = trail.length ? trail : (fresh ? ['page'] : []);
    send(body);
    fresh = false;
    if (names.length) {
      earlier = lastStep(names);
      try { window.sessionStorage.setItem(STEP_KEY, earlier); } catch (e) { /* the next page starts afresh */ }
    }
    shown = 0;
    tallied = {};
    opened = 0;
    trail = [];
    searched = [];
    abouts = [];
  }

  if (COUNTED) {
    if (window.MutationObserver) {
      new MutationObserver(relang).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    }
    /* Where this tab's last page left off — THE ORDER THEY CAME IN. */
    try { earlier = window.sessionStorage.getItem(STEP_KEY) || ''; } catch (e) { earlier = ''; }
    onScreen();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') putAway();
      else onScreen();
    });
    window.addEventListener('pagehide', putAway);
    window.addEventListener('pageshow', onScreen);
  }

  return { event: event, click: click, view: view, seen: seen, refused: refused, about: about, newcomer: newcomer, device: device, owner: OWNER, driven: DRIVEN };
})();
