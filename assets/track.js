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
 * is not twelve requests. Two things are kept in the browser for it, both
 * dates: the last day this browser opened a page here, `ttb.seen`, which is
 * how a page knows it is the browser's first today and whether there was an
 * earlier one; and the first day it ever did, `ttb.since`, which is how every
 * later page that day still knows whether it belongs to a new visitor or a
 * returning one — or the day Google's `_ga` cookie says, where that is
 * earlier, since the count is younger than the site. No id is made or sent. The owner's pages under /admin/ send
 * nothing, and neither does any page in a browser carrying the `ttb_owner`
 * cookie — the owner's, signed in or not; THE OWNER'S BROWSER in
 * functions/api/_admin.js. `owner` on the object below says so, for the two
 * pages that post a press of their own.
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
 * Beside each name rides the second it happened at — on-screen seconds into
 * the stretch the report covers, the same clock `secs` is — so the diagrams
 * can say how long people spent at a step before the next one, or before
 * the page was put away. A clock that starts again with every stretch, so a
 * tab hidden and brought back starts its time afresh rather than counting
 * the hour it sat behind another app. TIME AT A STEP in
 * functions/api/_flows.js is what is made of it.
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
 * The language rides in the same reports. Every page writes the language it
 * is read in on to <html lang>, so the seconds on screen are split by what
 * that said while they passed, and a press of a language switch — the
 * `language_select` event the switches already send — is kept as the pair it
 * was, from and to. The first report of a browser's first page today also
 * says which language it arrived in.
 *
 * AND THE COLOUR SOMEBODY NEW IS GIVEN
 *
 * The four styles are a test as well as a choice. A browser whose first day
 * here is today, opening a page with no ?style= in the address and no
 * colour stored, is dealt one of the four at random before the page's own
 * script paints anything — it is written into `ttb.style`, the key every
 * page already reads its colour from, so the page has nothing to learn. The
 * deal is counted, and three things after it, once each: the first place,
 * post or deck opened on the day it was dealt (`-opened`), the first visit
 * on a later day (`-back`), and the first press of the swatch, which is
 * somebody choosing a different colour than the one they were given
 * (`-changed`). `ttb.styledeal` keeps what was dealt and what has been told.
 * Nobody else is dealt anything: a colour already chosen is kept, and so is
 * one a link carried. And the colour rides on both of the site's own
 * reports, as `style`, the way the rail rides as `layout`, so THE FOUR
 * COLOURS in functions/api/_visitors.js can count every visit's seconds,
 * pages and places under the colour it was spent in. dealStyle() below;
 * "The four styles, dealt" in README.md.
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
    var dealtLook = look();
    if (dealtLook) params.look = dealtLook;
    var given = styleDeal();
    if (given) params.style_dealt = given.style;
    if (name === 'style_select') styleTold('changed');
    tallied[name] = (tallied[name] || 0) + 1;
    step(name);
    if (name === 'language_select') switched(params.language);
    if (name === 'search') searchedFor(params);
    if (live()) window.gtag('event', name, params);
    if (typeof window.clarity === 'function') window.clarity('event', name);
  }

  /* A refusal from /api/account, reported as a press of its own:
     account_err_ and the error the route sent, its dashes as underscores —
     `taken`, `password`, `slow_down` — and `generic` where it sent none,
     which is a network that failed as often as a server that did. The map,
     splitwise and the flashcards each carry a sign-in form, and all three
     report a refusal through this so the one word is spelt one way. The
     name is a press like any other here; functions/api/_visitors.js is
     what also files it under SIGNING UP, which is where /admin/visitors
     reads why people who tried to make an account did not. `view` is the
     form it happened on — 'up', 'in' or 'google', the naming step. */
  function refused(out, view) {
    var said = out && typeof out.error === 'string' ? out.error.replace(/-/g, '_') : '';
    event('account_err_' + (/^[a-z_]{1,20}$/.test(said) ? said : 'generic'), { view: view });
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

  /* Which of the directory's two looks this browser was dealt — 'a', the page
     as it was, or 'b', at rest — read off the key pickLook() in
     assets/lists.js writes, and '' where none was, which is everybody who
     was not new to the site when they first opened /lists. Sent on every
     event only where there is one, so GA can split what the two looks'
     visitors go on to do, on every page, and a browser with no look is not
     filed under either. "The lists' two looks" in README.md. */
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

  /* A page view for something the tag did not see change: the map reports
     one per opened place, titled with the place, so the standard Pages and
     screens report doubles as a popularity ranking. */
  function view(title) {
    /* Before the address check: a deep-linked place is one the tag already
       counted, and still a step somebody took. */
    step('view');
    if (here() === seenPath) return;
    seenPath = here();
    opened += 1;
    styleTold('opened');
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
    if (typeof window.clarity === 'function') {
      window.clarity('set', 'layout', layout());
      /* The look the same way, where there is one. A stranger's first open
         of /lists is dealt one before this runs — pickLook() is called as
         the page's own deferred script boots — so that visit is tagged. */
      if (look()) window.clarity('set', 'look', look());
      /* And the colour, where one was dealt — dealStyle() ran as this file
         loaded, before every page's own script, so even the first visit is
         tagged. */
      var given = styleDeal();
      if (given) window.clarity('set', 'style', given.style);
    }
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
  var SINCE_KEY = 'ttb.since';
  var STEP_KEY = 'ttb.step';
  var OWNER = /(?:^|;\s*)ttb_owner=1(?:;|$)/.test(document.cookie);
  var COUNTED = window.location.pathname.indexOf('/admin') !== 0 && !OWNER;
  var LATE = !!(document.currentScript && document.currentScript.getAttribute('data-arrive') === 'late');
  var arrived = false;
  var DAY = /^\d{4}-\d{2}-\d{2}$/;

  var tallied = {};    // press name -> times, since the last report
  var opened = 0;      // views reported with view() — a place, a post, a deck — since the last report
  var abouts = [];     // 'what:id' the page was about, since the last report
  var told = {};       // 'what:id' -> true, once it is in abouts: once a page
  var trail = [];      // names first seen this page, in order, since the last report
  var at = [];         // the second on screen, into the stretch, each of `trail` happened at
  var walked = {};     // name -> true, once it is in a trail — THE ORDER THEY CAME IN
  var earlier = '';    // the last name reported, this page or the one before it in this tab
  var fresh = true;    // no report has left this page yet, so the first says the page opened
  var who = '';        // 'new' or 'back', once arrive() has read the dates
  var shown = 0;       // milliseconds on screen, since the last report
  var since = null;    // when the page last came on screen, null while hidden
  var spoken = {};     // language -> milliseconds of `shown` read in it
  var moved = {};      // 'from>to' -> times the switch was pressed
  var lang = langNow();  // the language on screen, as <html lang> last said
  var first = false;   // this page is the browser's first today, not yet told
  var arrivedIn = '';  // the language on screen before the first switch
  var searched = [];   // { scope, term, results } typed into a search field, since the last report

  /* The query as the page was opened, read now, before the page's own
     script has had a chance to rewrite it — the map puts a place's ?spot= in
     the address as somebody opens one, and it arrives late (see LATE), so
     reading it in arrive() could file a search visitor under a place they
     opened rather than the one they landed on. The `?from=` tag
     rides in it: functions/api/_visitors.js, HOW THEY FOUND IT. */
  var LANDED = window.location.search;
  var TAGGED = (function () {
    try { return new URLSearchParams(LANDED).get('from') || ''; } catch (e) { return ''; }
  })();

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

  /* A step of a journey, once per page — THE ORDER THEY CAME IN. */
  function step(name) {
    if (!COUNTED || walked[name]) return;
    walked[name] = true;
    trail.push(name);
    charge();
    at.push(Math.round(shown / 1000));
  }

  /* The name a trail ends on, as the next report or the next page will send
     it, with this page's path on it: a view or the page itself says nothing
     on its own about which page it was, and a press may mean one thing on
     this page and another elsewhere — earlierOf() in
     functions/api/_flows.js is what reads the path back into a page. */
  function lastStep(names) {
    var name = names[names.length - 1];
    var path = window.location.pathname;
    if (name === 'page' || name === 'view') return name + ':' + path;
    return name + '@' + path;
  }

  /* The page opened. Whether it is this browser's first today, and whether
     it had a day before that, is the date in ttb.seen against today's — and
     where storage cannot be written, neither: the page is a view and never a
     visitor, which undercounts rather than counting a visitor per page.
     Once a page, however it is reached — see LATE.

     `who` is the same question asked of every page rather than only the
     first: a browser whose first day here is today is new all day, and one
     that came before is returning. ttb.seen cannot answer it past the first
     page, because the first page overwrites it with today, so ttb.since
     keeps the first day. A browser from before ttb.since existed takes the
     earlier day ttb.seen remembers.

     Both dates are this count's own, though, and the count began on
     28 September 2026 — so on its first day every browser was new, the ones
     that had been coming for weeks included, and /admin/visitors showed no
     returning visitor at all. Google's `_ga` cookie has been on every
     visitor's device since long before and carries the day that browser
     first came, so the first day is the earlier of the two wherever the
     cookie is there to read. Only the day is read out of it and only a
     day's comparison leaves the page; a browser with Google blocked has no
     cookie and goes by the site's own dates alone. */
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
    if (first) pinPhone();
    send({
      kind: 'arrive',
      id: window.location.pathname,
      /* The whole address, query and all, which the count reads only for a
         visitor a search engine sent — FOUND BY A SEARCH ENGINE in
         functions/api/_visitors.js: /blog?post=… and /?spot=… are the pages
         a search lands on, and the path alone would file them all as the
         blog and the map. The query as the page was opened — LANDED. */
      at: (window.location.pathname + LANDED).slice(0, 200),
      first: first,
      back: who === 'back',
      who: who,
      from: document.referrer,
      layout: dealt(),
      style: styleDealt(),
      /* The language the browser asks for, as two letters — the site's
         count of which languages people arrive wanting, spoken here or not.
         Read straight off the browser, never off the page, which has
         already picked one out of it. */
      asks: String(window.navigator.language || '').slice(0, 2).toLowerCase(),
      device: device(),
      phone: phoneArm(),
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
     ttb.since kept, else the earlier day ttb.seen remembers, else today — and
     Google's day where that is earlier still. Reads and never writes, so it
     can be asked before arrive() has run as well as after it; throws where
     storage does, and the caller decides what that means. */
  function firstDay(day) {
    var last = window.localStorage.getItem(SEEN_KEY);
    var began = window.localStorage.getItem(SINCE_KEY);
    if (!DAY.test(began || '')) began = DAY.test(last || '') && last < day ? last : day;
    var ga = gaDay();
    return ga && ga < began ? ga : began;
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

  /* Somebody new on a phone, filed for the rest of the day under the rail and
     the colour they arrived with — TIME ON PHONES in
     functions/api/_visitors.js. Pinned on the day's first page rather than
     read off each report, because the rail is dealt on the map and somebody
     who lands on the flashcards has none until they get there: read fresh,
     their visit would be counted under no rail and their minutes on the map
     under one, and a cell's time would be divided by visitors it never had.
     So `<rail>:<colour>` is written once, with today, and every report until
     midnight UTC carries it; `none` for no rail yet. Only a colour that was
     dealt counts, the colours' own rule, and nothing at all for a returning
     browser, a tablet or a desktop. */
  var PHONE_KEY = 'ttb.phoneday';

  function pinPhone() {
    var colour = styleDealt();
    if (who !== 'new' || device() !== 'phone' || !colour) return;
    try {
      window.localStorage.setItem(PHONE_KEY, JSON.stringify({ day: today(), arm: (dealt() || 'none') + ':' + colour }));
    } catch (e) { /* not pinned, not counted */ }
  }

  /* The pinned `<rail>:<colour>`, or '' on any day but the one it was
     pinned. */
  function phoneArm() {
    var p = null;
    try { p = JSON.parse(window.localStorage.getItem(PHONE_KEY) || 'null'); } catch (e) { p = null; }
    return p && p.day === today() && typeof p.arm === 'string' ? p.arm : '';
  }

  /* Phone, tablet or desktop, by what the browser says it is driven with: a
     coarse primary pointer is a finger, and a finger on something narrower
     than 768px is a phone. A laptop with a touchscreen keeps its mouse as
     the primary pointer and counts as a desktop, which is what it is. */
  function device() {
    var coarse = false;
    try { coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); } catch (e) { coarse = false; }
    if (!coarse) return 'desktop';
    return window.innerWidth < 768 ? 'phone' : 'tablet';
  }

  /* The day Google's tag first saw this browser, out of the `_ga` cookie
     — GA1.<n>.<random>.<seconds> — or null where there is none. The random
     part is Google's id for the browser and is never read, let alone sent:
     only the last field, which is a time. */
  function gaDay() {
    var m = /(?:^|;\s*)_ga=GA\d\.\d+\.\d+\.(\d{9,10})(?:;|$)/.exec(document.cookie || '');
    if (!m) return null;
    var d = new Date(Number(m[1]) * 1000).toISOString().slice(0, 10);
    return DAY.test(d) ? d : null;
  }

  function onScreen() {
    if (since === null && document.visibilityState === 'visible') since = Date.now();
  }

  function langNow() {
    return String(document.documentElement.lang || '').toLowerCase();
  }

  /* The time on screen since `since`, added to the stretch and to the
     language it was read in, with the clock left running. */
  function charge() {
    if (since === null) return;
    var now = Date.now();
    shown += now - since;
    if (lang) spoken[lang] = (spoken[lang] || 0) + now - since;
    since = now;
  }

  /* <html lang> changed, so what went before is the old language's. Every
     page sets it once as it boots, over the English the markup ships with,
     and the moment before that is charged to English and rounds away. */
  function relang() {
    charge();
    lang = langNow();
  }

  /* The switch was pressed. Whether the page has written the new language on
     to <html lang> yet or is about to, the observer below has not run — it
     runs once this press is over — so `lang` is still the one it was
     switched from. */
  function switched(to) {
    to = String(to || '').toLowerCase();
    if (!lang || !to || to === lang) return;
    if (!arrivedIn) arrivedIn = lang;
    moved[lang + '>' + to] = (moved[lang + '>' + to] || 0) + 1;
  }

  /* The page hidden or put away: the stretch it was on screen and the same
     seconds by language, the presses, the places opened, the languages
     switched and the trail since the last report, sent once and forgotten.
     The first report of a browser's first page today also says which
     language it arrived in — the one before any switch, which is the one the
     site chose — and the first report of any page says the page opened, so
     the diagrams count the page itself as a step before the trail. */
  function putAway() {
    /* A page put away before it said it was opened — the map, closed before
       its places came in — says so now, so the view is not lost. */
    arrive();
    charge();
    since = null;
    var secs = Math.round(shown / 1000);
    var langs = {};
    Object.keys(spoken).forEach(function (code) {
      var s = Math.round(spoken[code] / 1000);
      if (s) langs[code] = s;
    });
    if (!secs && !opened && !first && !fresh && !Object.keys(tallied).length && !Object.keys(moved).length &&
        !trail.length && !searched.length && !abouts.length) return;
    var body = { kind: 'leave', id: window.location.pathname, secs: secs, presses: tallied,
      places: opened, langs: langs, moved: moved, who: who, layout: dealt(), style: styleDealt(), phone: phoneArm(),
      trail: trail, at: at, earlier: earlier, opened: fresh, searches: searched, about: abouts };
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
    spoken = {};
    moved = {};
    trail = [];
    at = [];
    searched = [];
    abouts = [];
  }

  /* ------------------------------------------------- the colour dealt
   * See AND THE COLOUR SOMEBODY NEW IS GIVEN at the top. STYLE_DEALS is the
   * four ids every page's STYLES knows, and STYLE_IDS in
   * functions/api/stats.js is these with the three facts after them. */
  var STYLE_KEY = 'ttb.style';
  var STYLE_DEAL_KEY = 'ttb.styledeal';
  var STYLE_DEALS = ['red', 'green', 'blue', 'plum'];

  /* What this browser was dealt and what has been told about it, or null —
     nothing dealt, or a record this file did not write. */
  function styleDeal() {
    var d = null;
    try { d = JSON.parse(window.localStorage.getItem(STYLE_DEAL_KEY) || 'null'); } catch (e) { d = null; }
    if (!d || STYLE_DEALS.indexOf(d.style) === -1 || !DAY.test(d.day || '') || !(d.told instanceof Array)) return null;
    return d;
  }

  /* The colour as it was dealt, or '' where none was — what both reports
     carry, so the count files a visit under its colour or under no arm. */
  function styleDealt() {
    var d = styleDeal();
    return d ? d.style : '';
  }

  /* Somebody new, a page with no colour in its address and none stored:
     one of the four, at random, kept and counted. A deal storage cannot keep
     is not made — a colour rolled afresh on every load would be worse than
     any of the four. */
  function dealStyle() {
    if (!COUNTED || !newcomer() || styleDeal()) return;
    var dealt = STYLE_DEALS[Math.floor(Math.random() * STYLE_DEALS.length)];
    try {
      if (new URLSearchParams(LANDED).get('style')) return;
      if (STYLE_DEALS.indexOf(window.localStorage.getItem(STYLE_KEY)) !== -1) return;
      window.localStorage.setItem(STYLE_KEY, dealt);
      window.localStorage.setItem(STYLE_DEAL_KEY, JSON.stringify({ style: dealt, day: today(), told: [] }));
      if (window.localStorage.getItem(STYLE_KEY) !== dealt) return;
    } catch (e) { return; }
    send({ kind: 'style', id: dealt });
  }

  /* One of the three facts after a deal, once each: `opened` only on the
     day it was dealt, `back` only on a later one, `changed` whenever it
     comes. Written down before it is sent, so a page that is put away
     mid-send does not tell it twice. */
  function styleTold(what) {
    if (!COUNTED) return;
    var d = styleDeal();
    if (!d || d.told.indexOf(what) !== -1) return;
    if (what === 'opened' && d.day !== today()) return;
    if (what === 'back' && d.day >= today()) return;
    d.told.push(what);
    try { window.localStorage.setItem(STYLE_DEAL_KEY, JSON.stringify(d)); } catch (e) { return; }
    send({ kind: 'style', id: d.style + '-' + what });
  }

  /* As the file loads — every page loads it before its own script, so the
     page reads the dealt colour the way it reads a chosen one. */
  dealStyle();
  styleTold('back');

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

  return { event: event, click: click, view: view, seen: seen, arrive: arrive, refused: refused, about: about, newcomer: newcomer, owner: OWNER };
})();
