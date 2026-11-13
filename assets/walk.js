/**
 * Tallinn Tastebuds — walking a list.
 *
 * The third way to read a list, beside Map and List: its places in the
 * shortest order to walk them in, how far that is, and — for a member — a
 * walk they can start, check in on at each door, and finish. The server half
 * is functions/api/walk.js and its header says what is stored and what is
 * not; this is what the page draws.
 *
 * WHY A FILE OF ITS OWN
 *
 * assets/lists.js is the page, and it is five thousand lines of it. A walk
 * is one view of one list with a state of its own — where you are, what is
 * checked, the comment you are halfway through — and none of that is the
 * list page's business. So lists.js decides that the Walk view is on and
 * hands this file the list and a handful of its own helpers; this file
 * builds the view and asks to be redrawn when something changes. The global
 * is TTBWalk, the way the pins and the radio are globals.
 *
 * THE ORDER IS WORKED OUT HERE, AND IT IS AN ESTIMATE
 *
 * Every row a list carries has the place's coordinates on it, so the order
 * is found in the browser and no request is made for it. The distance
 * between two places is the straight line stretched by DETOUR, which is
 * what a walk through a city's streets comes to on average, and the page
 * says "about" beside every total for that reason. Asking the routing
 * service for the real walk would be one request for every pair of places
 * — forty-five of them for a top ten — to change "about 5.4 km" by a few
 * hundred metres.
 *
 * Up to EXACT places the order is the true shortest one, found the way the
 * textbook finds it (Held–Karp: the best way to have visited each set of
 * places and be standing at each of them, built up a place at a time).
 * Past that it is nearest-next, then every pair of legs uncrossed until
 * none is left to uncross, which is within a few percent and instant on a
 * list of fifty.
 *
 * It starts at the first place on the list, because that is the one thing
 * known about where a reader is: nowhere. "Start from where I am" asks the
 * phone and starts at the nearest place instead. Before a walk is started
 * the page never asks for a location on its own.
 *
 * ONCE IT IS STARTED, THE PAGE WATCHES WHERE YOU ARE
 *
 * "Check in here" was a button that did not say where. So while a walk is
 * on and the page is on screen, the phone's position is watched, and the
 * band names the nearest place left and how far it is; the button reads
 * "Check in at Pudel" and is greyed until that is inside the radius. Greyed
 * and not disabled: a fix lags a person walking, so a press always asks for
 * a fresh one and lets the server decide. The watch is the device's own
 * position and nothing else — the place somebody types into the map's
 * search is never read here — and it stops when the page is hidden, when
 * the walk is finished and when the view is left.
 *
 * THE PLACES ARE ONE LINE DOWN THE PAGE
 *
 * They were a stack of cards with the leg between them, which said what
 * each one cost and never what the shape of the whole was: it began at the
 * top of the screen and ran out at the bottom. So there is a rail — a dot a
 * place, the leg beside the line into it, how far in the walk is by then
 * under that, and a cap at either end naming where it starts and where it
 * ends. The number is on the dot, which is why the card here has one column
 * where the List view's has two, and the rail behind a checked place is the
 * colour of a check. cap() draws the ends and stop() the rest.
 *
 * AND HOW SOMEBODY ELSE WALKED IT
 *
 * The board carries a time per finisher and the parts of it are worth more
 * than the sum: pressing a time opens that person's checks in the order
 * they really made them, with the real gap between each pair. One read of
 * its own, made on the press — traceFor(), and `&who=` in
 * functions/api/walk.js.
 *
 * ON FOOT AND BY BIKE, WITHOUT ASKING WHICH
 *
 * There were two chips on the card, On foot and By bike, and all they
 * changed was the time the card estimated and a word on the board: the
 * order and the distances are the same streets either way. Somebody who
 * walks to three places and cycles to the other five had nothing to press.
 * So the card asks nothing and says both — timesLine(), the time on foot
 * and the time by bike side by side under the distance — and the legs on
 * the rail are on foot, the slower of the two. Nobody is asked how they
 * went, and it cannot be read off the clock either, since a walk may take
 * as many days as its walker likes. The server still keeps a mode with
 * every walk, `foot` unless it was told otherwise, and the board still says
 * By bike beside anybody who picked it while there were chips to pick.
 *
 * WHAT ELSE THE CARD CAN DO
 *
 * Start from where I am, See it on the map, Change the order: three tiles
 * in a row under the sentences, an icon over the words, the width of the
 * card shared between however many there are — tiles(). They were
 * underlined words once, scattered across two lines, and read as small
 * print rather than as three things to do. Start again stays underlined
 * words under them, on purpose: it takes everything with it, and should not
 * look like the others.
 *
 * YOUR ORDER IS YOURS
 *
 * "Change the order" puts a grip on every row: press it and drag the place
 * to where it goes, or focus it and use the arrow keys, and the distances
 * follow. The way back to the shortest order is on that screen and nowhere
 * else, where it reads as what it is. That order belongs to the walker and not
 * to the list: it is kept with their walk once there is one, and in this
 * page alone before that. It changes nothing about checking in, which is
 * done wherever somebody is standing.
 *
 * AND AGAIN FROM WHERE YOU ARE
 *
 * The order is found once and stays, and a walk does not go the way it was
 * planned: two places in, the next one on the page may be the far end of
 * the list while its walker stands beside the sixth. "Shortest from here",
 * on the card while a walk is on, asks the phone and puts the places left
 * in the shortest order from where it is, under the ones already checked.
 * It is a press and not something the watch does, for the reason the order
 * stays put at all; it can be pressed again after every check. What it
 * leaves behind is the walker's own order, kept the way one dragged into
 * place is.
 *
 * AND THE SAME WALK ON THE MAP
 *
 * A walk is places, and places are on the map. So the map can be handed the
 * same walk — band() below — and draws its own half: the line through the
 * places in order, a number on each, the dot where the walker is. What it
 * takes from here is the band's contents, which are this file's on both
 * pages: the nearest place, the button that checks in, the comment. One
 * walk, one state, two pages that draw it; assets/app.js holds no copy of
 * any of it.
 *
 * EVERYTHING HERE FAILS QUIET
 *
 * A route that does not answer, or a database the two tables have not
 * reached, leaves the order and the distances — which need neither — and
 * draws nothing to press.
 */
(function () {
  'use strict';

  var API = '/api/walk';

  /* The longest comment. The server's — MAX_NOTE in functions/api/walk.js —
     said again so the field stops somebody at the keystroke. */
  var MAX_NOTE = 280;

  /* Streets against the straight line, and metres covered in a minute: 4.8
     km/h on foot, which is what Google and the journey planner both assume,
     and 15 km/h on a bike through a city with lights in it. */
  var DETOUR = 1.3;
  var PACE = { foot: 80, bike: 250 };


  /* The longest list whose order is found exactly. Twelve places is four
     thousand sets of them and half a million steps, which a phone does
     before the frame is out; fifteen is eight times that. */
  var EXACT = 12;

  /* How many other people's comments a place shows. The newest three: a
     place under a list is a row, not a thread. */
  var NOTES_SHOWN = 3;

  var ICON_GRIP = '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>';
  var ICON_TICK = '<path d="M5 12.5l4.5 4.5L19 7.5"/>';
  /* The tiles' — see tiles(). A crosshair for where the phone is, a folded
     map, two arrows passing for an order changed, a pencil for a comment. */
  var ICON_HERE = '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2"/>' +
    '<path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>';
  var ICON_MAP = '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>';
  var ICON_ORDER = '<path d="M7 4v16M3.5 7.5L7 4l3.5 3.5M17 20V4M13.5 16.5L17 20l3.5-3.5"/>';
  var ICON_NOTE = '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>';

  /* The walk on screen. One at a time, because the page shows one list:
     made the first time view() is handed that list and kept across every
     redraw, since a redraw is how this file repaints itself. */
  var w = null;
  var c = null;   // what assets/lists.js handed over — see view()

  /* ------------------------------------------------------------ the order */

  /* The straight line, which is what a check is measured by — the server
     measures the same way, km() in functions/api/_lib.js. */
  function crow(a, b) {
    var rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad;
    var dLng = (b.lng - a.lng) * rad;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * 6371000 * Math.asin(Math.sqrt(s));
  }

  /* And the walk between them, as near as a straight line can say. */
  function metres(a, b) { return crow(a, b) * DETOUR; }

  /* Every place against every other, once. */
  function table(points) {
    return points.map(function (a) {
      return points.map(function (b) { return metres(a, b); });
    });
  }

  /* Held–Karp with the start fixed and the end free. best[set][j] is the
     shortest way to leave the start, visit exactly the places in `set` and
     be standing at j; the answer is the smallest best[everything][j], read
     backwards through `from`. The start is place 0 of `d` and is not in any
     set. */
  function exact(d) {
    var n = d.length - 1;
    var full = (1 << n) - 1;
    var best = [];
    var from = [];
    var set, j, k, was, cost;

    for (set = 0; set <= full; set++) { best.push([]); from.push([]); }
    for (j = 0; j < n; j++) { best[1 << j][j] = d[0][j + 1]; from[1 << j][j] = -1; }

    for (set = 1; set <= full; set++) {
      for (j = 0; j < n; j++) {
        if (!(set & (1 << j)) || best[set][j] === undefined) continue;
        for (k = 0; k < n; k++) {
          if (set & (1 << k)) continue;
          was = set | (1 << k);
          cost = best[set][j] + d[j + 1][k + 1];
          if (best[was][k] === undefined || cost < best[was][k]) {
            best[was][k] = cost;
            from[was][k] = j;
          }
        }
      }
    }

    var end = 0;
    for (j = 1; j < n; j++) if (best[full][j] < best[full][end]) end = j;

    var order = [];
    set = full;
    while (end !== -1) {
      order.unshift(end + 1);
      k = from[set][end];
      set &= ~(1 << end);
      end = k;
    }
    order.unshift(0);
    return order;
  }

  /* Nearest-next from the start, then 2-opt: reverse any stretch whose two
     ends would be nearer the other way round, until a pass finds none. The
     path is open, so the last leg has no far end to weigh. */
  function near(d) {
    var n = d.length;
    var order = [0];
    var left = [];
    var i, j, at, pick, moved, a, b, gain;

    for (i = 1; i < n; i++) left.push(i);
    while (left.length) {
      at = order[order.length - 1];
      pick = 0;
      for (i = 1; i < left.length; i++) if (d[at][left[i]] < d[at][left[pick]]) pick = i;
      order.push(left.splice(pick, 1)[0]);
    }

    do {
      moved = false;
      for (i = 1; i < n - 1; i++) {
        for (j = i + 1; j < n; j++) {
          a = d[order[i - 1]][order[i]] + (j + 1 < n ? d[order[j]][order[j + 1]] : 0);
          b = d[order[i - 1]][order[j]] + (j + 1 < n ? d[order[i]][order[j + 1]] : 0);
          gain = a - b;
          if (gain > 0.5) {
            order = order.slice(0, i).concat(order.slice(i, j + 1).reverse(), order.slice(j + 1));
            moved = true;
          }
        }
      }
    } while (moved);
    return order;
  }

  /* The places in the shortest order from `start`, as indexes into
     `points`. */
  function shortest(points, start) {
    if (points.length < 3) {
      return points.map(function (p, i) { return i; }).sort(function (a, b) {
        return (a === start ? -1 : 0) - (b === start ? -1 : 0);
      });
    }
    /* The start moved to the front, the order found, and the indexes moved
       back to the ones the caller knows. */
    var index = [start];
    points.forEach(function (p, i) { if (i !== start) index.push(i); });
    var d = table(index.map(function (i) { return points[i]; }));
    return (points.length <= EXACT ? exact(d) : near(d)).map(function (i) { return index[i]; });
  }

  /* --------------------------------------------------------------- words */

  function distance(m) {
    if (m < 1000) return c.t('walkMetres', { n: Math.max(10, Math.round(m / 10) * 10) });
    var km = Math.round(m / 100) / 10;
    var said;
    try { said = km.toLocaleString(c.lang, { maximumFractionDigits: 1 }); } catch (e) { said = String(km); }
    return c.t('walkKm', { n: said });
  }

  function minutes(n) {
    n = Math.max(1, Math.round(n));
    if (n < 60) return c.t('walkMin', { n: n });
    return c.t('walkHours', { h: Math.floor(n / 60), m: n % 60 });
  }

  /* How long a walk took, or has been going: minutes and hours inside a
     day, days and hours past one. */
  function took(ms) {
    var days = Math.floor(ms / 86400000);
    if (days < 1) return minutes(ms / 60000);
    var hours = Math.floor(ms % 86400000 / 3600000);
    var said = days === 1 ? c.t('walkDayOne') : c.t('walkDays', { n: days });
    return hours ? said + ' ' + c.t('walkHoursOnly', { h: hours }) : said;
  }

  /* "7 November", and with `clock` "7 November, 18:42". Intl first, because
     it knows the case a month takes after a number — 11 ноября, not 11
     ноябрь — and the page's own `months` where Intl has no names for the
     language and draws the month as M11: see formatMonth() in
     assets/app.js. */
  function day(ms, clock) {
    var d = new Date(ms);
    var said = '';
    try { said = d.toLocaleDateString(c.lang, { day: 'numeric', month: 'long' }); } catch (e) { /* below */ }
    if (!said || /M\d/.test(said)) {
      said = d.getDate() + ' ' + (c.t('months').split('|')[d.getMonth()] || String(d.getMonth() + 1));
    }
    if (!clock) return said;
    var mm = d.getMinutes();
    return said + ', ' + d.getHours() + ':' + (mm < 10 ? '0' : '') + mm;
  }

  /* -------------------------------------------------------------- the plan
   * What the view is drawn from: the places somebody can stand at, in the
   * order on screen, the leg into each, and the total.
   */

  function doors() {
    return w.list.items.filter(function (item) {
      return typeof item.lat === 'number' && typeof item.lng === 'number';
    });
  }

  function byPlace(place) {
    var all = doors();
    for (var i = 0; i < all.length; i++) if (all[i].place === place) return all[i];
    return null;
  }

  /* The shortest order from where it starts: the place nearest to where
     "Start from where I am" was pressed, the list's first otherwise. Kept
     until the start changes, because every redraw asks.

     From `w.from` and not from `w.here`. Once a walk is on the position is
     watched, and an order that started at wherever the phone is now would
     renumber every place as its owner walked between them. */
  function shortOrder() {
    var all = doors();
    var start = 0;
    if (w.from) {
      all.forEach(function (item, i) {
        if (metres(w.from, item) < metres(w.from, all[start])) start = i;
      });
    }
    if (!w.short || w.short.start !== start || w.short.n !== all.length) {
      w.short = { start: start, n: all.length, order: shortest(all, start) };
    }
    return w.short.order.map(function (i) { return all[i]; });
  }

  /* The walker's own order, held to the list as it is now: a place that has
     left the list drops out and one that has joined it goes on the end. */
  function ownOrder() {
    var all = doors();
    var out = [];
    w.own.forEach(function (place) {
      var item = byPlace(place);
      if (item && out.indexOf(item) === -1) out.push(item);
    });
    all.forEach(function (item) { if (out.indexOf(item) === -1) out.push(item); });
    return out;
  }

  function lengthOf(stops) {
    var total = 0;
    for (var i = 1; i < stops.length; i++) total += metres(stops[i - 1], stops[i]);
    return total;
  }

  /* How far in each stop is, as metres from the first — what the rail
     writes under each leg as a time. The last of them is the total, so it
     is the total. */
  function upto(stops) {
    var out = [0];
    for (var i = 1; i < stops.length; i++) out.push(out[i - 1] + metres(stops[i - 1], stops[i]));
    return out;
  }

  function plan() {
    var stops = w.own ? ownOrder() : shortOrder();
    var sofar = upto(stops);
    var total = sofar.length ? sofar[sofar.length - 1] : 0;
    return {
      stops: stops,
      sofar: sofar,
      total: total,
      /* How much longer the walker's own order is than the shortest. */
      more: w.own ? total - lengthOf(shortOrder()) : 0
    };
  }

  function unchecked(stops) {
    return stops.filter(function (item) { return !checkOf(item.place); });
  }

  function checkOf(place) {
    var checks = (w.data && w.data.checks) || [];
    for (var i = 0; i < checks.length; i++) if (checks[i].place === place) return checks[i];
    return null;
  }

  function started() { return !!(w.data && w.data.walk); }
  function finished() { return started() && !!w.data.walk.finished; }

  /* ------------------------------------------------------------ the server */

  function read(res) {
    return res.json().catch(function () { return {}; }).then(function (out) {
      return { status: res.status, out: out || {} };
    });
  }

  function load() {
    fetch(API + '?list=' + encodeURIComponent(w.list.id), { headers: { accept: 'application/json' } })
      .then(read)
      .then(function (answer) { land(answer.status === 200 ? answer.out : { ready: false }); })
      .catch(function () { land({ ready: false }); });
  }

  /* An answer, taken as the state. The order the walker saved is theirs
     again on whichever phone this is — unless they are in the middle of
     changing it here. */
  function land(out) {
    w.data = out;
    if (out.walk && out.walk.order && out.walk.order.length && !w.editing) w.own = out.walk.order;
    c.redraw();
  }

  function send(payload) {
    payload.list = w.list.id;
    return fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(read, function () { return { status: 0, out: {} }; });
  }

  /* Where the phone says it is, or a refusal. Asked for only inside a press
     before a walk is on. Never an answer out of the browser's cache:
     somebody told they are forty metres short walks the forty metres and
     presses again, and a fix from before they moved would tell them the
     same thing standing at the door. While the watch below is running its
     last fix is the freshest there is, and is used where it is seconds
     old — asking a second time beside a running watch is also the one
     arrangement in which some browsers never answer at all. */
  var FRESH = 15000;

  function locate() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) { reject(); return; }
      if (w.watch !== null && w.here && Date.now() - w.hereAt < FRESH) { resolve(w.here); return; }
      navigator.geolocation.getCurrentPosition(function (pos) {
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, function () { reject(); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    });
  }

  function say(text, bad) {
    w.msg = text ? { text: text, bad: !!bad } : null;
  }

  /* ------------------------------------------------------------ the presses */

  /* The two presses that order the places from where the phone is: each
     asks it, and says so when it will not answer. */
  function fromHere(then) {
    w.busy = 'here';
    say('');
    c.redraw();
    locate().then(function (here) {
      w.busy = '';
      w.here = here;
      then(here);
    }, function () {
      w.busy = '';
      say(c.t('walkNoLocation'), true);
      c.redraw();
    });
  }

  function fromMe() {
    fromHere(function (here) {
      w.from = here;
      TTBTrack.event('walk_from_me', { list_id: w.list.id });
      shortestAgain();
    });
  }

  /* AND AGAIN FROM WHERE YOU ARE — the header. The places checked go to the
     top in the order they were checked, and the ones left under them in the
     shortest order from the phone: the phone is the start handed to
     shortest(), and is dropped from what comes back. */
  function replan() {
    fromHere(function (here) {
      var left = unchecked(plan().stops);
      var done = doors().filter(function (item) { return checkOf(item.place); }).sort(function (a, b) {
        return checkOf(a.place).at - checkOf(b.place).at;
      });
      var order = shortest([here].concat(left), 0).slice(1).map(function (i) { return left[i - 1]; });
      w.own = done.concat(order).map(function (item) { return item.place; });
      w.replanned = true;
      TTBTrack.event('walk_replan', { list_id: w.list.id });
      keepOrder();
    });
  }

  function startWalk() {
    w.busy = 'start';
    c.redraw();
    send({ action: 'start', order: w.own || [] }).then(function (answer) {
      w.busy = '';
      if (answer.status !== 200) { say(c.t('walkErr'), true); c.redraw(); return; }
      TTBTrack.event('walk_start', { list_id: w.list.id });
      say('');
      land(answer.out);
    });
  }

  function checkIn() {
    w.busy = 'check';
    w.noting = null;
    say('');
    c.redraw();
    locate().then(function (here) {
      w.here = here;
      return send({ action: 'check', lat: here.lat, lng: here.lng }).then(function (answer) {
        w.busy = '';
        var out = answer.out;
        if (answer.status === 200 && out.checked) {
          var total = doors().length;
          var item = byPlace(out.checked);
          TTBTrack.event(out.walk && out.walk.finished ? 'walk_finish' : 'walk_check', { list_id: w.list.id });
          say(c.t('walkCheckedAt', { place: item ? item.name : '', n: out.checks.length, total: total }));
          w.noting = out.checked;
          w.replanned = false;
          land(out);
          return;
        }
        if (answer.status === 200) { land(out); return; }
        if (out.error === 'far') {
          TTBTrack.event('walk_far', { list_id: w.list.id });
          var nearest = out.place && byPlace(out.place);
          say(nearest
            ? c.t('walkFar', { distance: distance(out.meters), place: nearest.name, radius: w.data.radius })
            : c.t('walkFarAway', { radius: w.data.radius }), true);
        } else {
          say(c.t('walkErr'), true);
        }
        c.redraw();
      });
    }, function () {
      w.busy = '';
      say(c.t('walkNoLocation'), true);
      c.redraw();
    });
  }

  /* A comment: on the place checked in at, or with `place` '' on the whole
     of a finished walk. */
  function saveNote(place, text) {
    w.busy = 'note';
    c.redraw();
    send({ action: 'note', place: place, note: text }).then(function (answer) {
      w.busy = '';
      if (answer.status !== 200) { say(c.t('walkErr'), true); c.redraw(); return; }
      TTBTrack.event('walk_note', { list_id: w.list.id });
      w.noting = null;
      say('');
      land(answer.out);
    });
  }

  function removeNote(place, name) {
    send({ action: 'unnote', place: place, name: name }).then(function (answer) {
      if (answer.status === 200) land(answer.out);
    });
  }

  /* The order, kept with the walk where there is one. Before that it lives
     in this page and goes up with Start. */
  function keepOrder() {
    if (!started()) { c.redraw(); return; }
    send({ action: 'order', order: w.own || [] }).then(function (answer) {
      if (answer.status === 200) land(answer.out); else c.redraw();
    });
  }

  function reorder() {
    w.own = plan().stops.map(function (item) { return item.place; });
    w.editing = true;
    w.replanned = false;
    w.noting = null;
    w.asking = false;
    say('');
    c.redraw();
  }

  /* One place moved to `to`, and the page drawn again around it. The grip
     that did it has been rebuilt by the redraw, so the focus is put back on
     the same place's: a second press of an arrow key moves it again. */
  function moveTo(place, to) {
    var from = w.own.indexOf(place);
    if (from === -1 || to < 0 || to >= w.own.length || to === from) return;
    w.own.splice(to, 0, w.own.splice(from, 1)[0]);
    c.redraw();
    var grip = document.querySelector('[data-walk-grip="' + to + '"]');
    if (grip) grip.focus();
  }

  /* Dragging a place to where it goes. The row follows the finger, the rows
     it passes step out of its way by its own height, and the order changes
     once, on the drop — so the legs between the rows are stale for as long
     as the finger is down and right the moment it lifts.

     Pointer events, captured on the grip, so one handler is a mouse, a
     finger and a pen. The grip is `touch-action: none` in the stylesheet,
     which is what keeps the page from scrolling under the finger and what
     tells assets/back.js that a sideways finger here is not Back; near
     the top or the foot of the window the page is scrolled by hand
     instead, since a list is longer than a phone. */
  function carry(grip, row, place) {
    grip.addEventListener('pointerdown', function (ev) {
      if (ev.button) return;
      ev.preventDefault();
      var rows = [].slice.call(row.parentNode.children);
      var from = rows.indexOf(row);
      var to = from;
      var startY = ev.clientY;
      var startScroll = window.pageYOffset;
      var boxes = rows.map(function (r) {
        var b = r.getBoundingClientRect();
        return { mid: b.top + startScroll + b.height / 2, height: b.height };
      });

      try { grip.setPointerCapture(ev.pointerId); } catch (e) { /* the drag still works on the grip itself */ }
      row.classList.add('is-carrying');

      function moved(e) {
        if (e.clientY < 110) window.scrollBy(0, -14);
        else if (e.clientY > window.innerHeight - 150) window.scrollBy(0, 14);
        var dy = e.clientY - startY + window.pageYOffset - startScroll;
        var mid = boxes[from].mid + dy;
        to = from;
        rows.forEach(function (r, i) {
          if (i < from && mid < boxes[i].mid) to = Math.min(to, i);
          if (i > from && mid > boxes[i].mid) to = Math.max(to, i);
        });
        row.style.transform = 'translateY(' + dy + 'px)';
        rows.forEach(function (r, i) {
          if (r === row) return;
          var step = i >= to && i < from ? boxes[from].height : i <= to && i > from ? -boxes[from].height : 0;
          r.style.transform = step ? 'translateY(' + step + 'px)' : '';
        });
      }

      function dropped() {
        grip.removeEventListener('pointermove', moved);
        grip.removeEventListener('pointerup', dropped);
        grip.removeEventListener('pointercancel', dropped);
        if (to === from) c.redraw(); else moveTo(place, to);
      }

      grip.addEventListener('pointermove', moved);
      grip.addEventListener('pointerup', dropped);
      grip.addEventListener('pointercancel', dropped);
    });

    grip.addEventListener('keydown', function (ev) {
      var delta = ev.key === 'ArrowUp' ? -1 : ev.key === 'ArrowDown' ? 1 : 0;
      if (!delta) return;
      ev.preventDefault();
      moveTo(place, w.own.indexOf(place) + delta);
    });
  }

  /* An order that came out the same as the shortest is the shortest, and
     is kept as that: the card then says where it starts rather than "your
     order, 0 m longer". */
  function doneReordering() {
    var short = shortOrder().map(function (item) { return item.place; });
    if (w.own.join('|') === short.join('|')) w.own = null;
    w.editing = false;
    TTBTrack.event('walk_reorder', { list_id: w.list.id });
    keepOrder();
  }

  /* On the reordering screen: every place back where the shortest order
     has it, and the screen left open to carry on from there. */
  function resetOrder() {
    w.own = shortOrder().map(function (item) { return item.place; });
    c.redraw();
  }

  function shortestAgain() {
    w.own = null;
    w.editing = false;
    keepOrder();
  }

  /* -------------------------------------------------------- where you are
   * ONCE IT IS STARTED, THE PAGE WATCHES WHERE YOU ARE — the header. The
   * watch runs only while a walk is on, unfinished and on screen, and what
   * it changes is one line and one label in the band; so a new position
   * repaints only when the nearest place or the ten metres it rounds to
   * has changed, and never under a comment somebody is typing.
   */
  function watching() {
    return started() && !finished() && document.visibilityState !== 'hidden' && !!navigator.geolocation;
  }

  function watch() {
    if (!watching()) { unwatch(); return; }
    if (w.watch !== null) return;
    w.watch = navigator.geolocation.watchPosition(function (pos) {
      var was = nearSaid();
      w.here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      w.hereAt = Date.now();
      w.refused = false;
      /* The map moves its own dot with it — see band(). */
      if (c.onHere) c.onHere(w.here, pos.coords.accuracy);
      if (nearSaid() !== was && w.noting === null && !w.editing && !w.busy) c.redraw();
    }, function (err) {
      /* 1 is a refusal, and is said; anything else is a fix that did not
         come, and the next one may. */
      if (err && err.code === 1 && !w.refused) { w.refused = true; c.redraw(); }
    }, { enableHighAccuracy: true, maximumAge: 5000 });
  }

  function unwatch() {
    if (w && w.watch !== null && navigator.geolocation) navigator.geolocation.clearWatch(w.watch);
    if (w) w.watch = null;
  }

  /* The nearest place left and how far it is as the crow flies, or null
     before the phone has said where it is. */
  function nearest() {
    if (!w.here) return null;
    var best = null;
    doors().forEach(function (item) {
      if (checkOf(item.place)) return;
      var m = crow(w.here, item);
      if (!best || m < best.metres) best = { item: item, metres: m };
    });
    return best;
  }

  /* What the band would say about it, as one string to compare. */
  function nearSaid() {
    var n = nearest();
    return n ? n.item.place + '|' + Math.round(n.metres / 10) : '';
  }

  document.addEventListener('visibilitychange', function () { if (w && c) watch(); });

  /* ------------------------------------------------------------ the clock
   * How long the walk has been going, on the card. Wall-clock time from
   * Start, nights included: a walk may take a month, and a stopwatch to
   * pause would be one more thing to forget and one more way to shave a
   * time. It reads to the minute, so the one element that holds it is
   * rewritten twice a minute and nothing else is redrawn for it.
   */
  var tick = null;

  function clock(node) {
    if (tick) { window.clearInterval(tick); tick = null; }
    if (!node) return;
    function write() {
      node.textContent = c.t('walkPlaying', {
        date: day(w.data.walk.started),
        took: took(Date.now() - w.data.walk.started)
      });
    }
    /* Written now, before the card it is in has reached the document, and
       then for as long as it is still there. */
    write();
    tick = window.setInterval(function () {
      if (document.body.contains(node) && started()) { write(); return; }
      window.clearInterval(tick);
      tick = null;
    }, 30000);
  }

  /* Throwing the walk away so Start begins another. The card asks first —
     see head() — because it takes every check, every comment and a time on
     the board with it. */
  function startAgain() {
    w.busy = 'again';
    c.redraw();
    send({ action: 'again' }).then(function (answer) {
      w.busy = '';
      w.asking = false;
      if (answer.status !== 200) { say(c.t('walkErr'), true); c.redraw(); return; }
      TTBTrack.event('walk_again', { list_id: w.list.id });
      w.trace = null;
      w.noting = null;
      w.asked = false;
      w.replanned = false;
      say('');
      land(answer.out);
    });
  }

  /* ------------------------------------------------------------- the pieces */

  function alt(label, onClick) { return c.button(label, 'alt', onClick); }

  /* A tile: an icon over its words, a button or — with an href — a link.
     The row they stand in shares the card's width between however many
     there are, so two are halves and three are thirds. */
  function tile(icon, label, onClick, href) {
    var node = c.el(href ? 'a' : 'button', href ? { className: 'walk-tile', href: href }
      : { type: 'button', className: 'walk-tile' }, [
      c.el('span', { className: 'walk-tile-icon', 'aria-hidden': 'true',
        html: '<svg viewBox="0 0 24 24" focusable="false">' + icon + '</svg>' }),
      c.el('span', { textContent: label })
    ]);
    if (onClick) node.addEventListener('click', onClick);
    return node;
  }

  /* How long a stretch of the walk takes on foot and by bike, said side by
     side because nobody is asked which — see ON FOOT AND BY BIKE above. The
     two times are the line's weight, so they are split out of the sentence
     and drawn in the ink; walkTimes keeps them where each language puts
     them. */
  function timesLine(m) {
    var said = c.t('walkTimes', { foot: '\u0001', bike: '\u0002' });
    var times = { '\u0001': minutes(m / PACE.foot), '\u0002': minutes(m / PACE.bike) };
    return c.el('p', { className: 'walk-times mono' }, said.split(/([\u0001\u0002])/).map(function (part) {
      return times[part] ? c.el('b', { textContent: times[part] }) : part;
    }).filter(Boolean));
  }

  function head(p) {
    var total = doors().length;
    var lost = w.list.items.length - total;
    var done = (w.data && w.data.checks.length) || 0;
    var kids = [
      c.el('p', { className: 'eyebrow', textContent: c.t(finished() ? 'walkFinishedEyebrow' : 'walkEyebrow') }),
      c.heading(w.list.title)
    ];
    var about = c.t('walkSpan', { places: c.countLabel(total), distance: distance(p.total) });
    var playing = null;
    /* What is left of a walk that is on, and how far it is from the phone
       through them in order — from the first of them before the phone has
       said where it is. */
    var left = unchecked(p.stops);
    var toGo = lengthOf((w.here ? [w.here] : []).concat(left));

    if (w.editing) {
      /* Changing the order is its own screen: the totals, what to do, and
         the way back to the shortest — which lives here and nowhere else. */
      kids.push(c.el('p', { className: 'walk-facts mono', textContent: about }));
      kids.push(timesLine(p.total));
      kids.push(c.el('p', { className: 'walk-from', textContent: c.t('walkReorderHint') }));
      kids.push(c.el('div', { className: 'lists-row walk-alts' }, [alt(c.t('walkShortest'), resetOrder)]));
      return c.card(kids);
    }

    if (finished()) {
      kids.push(c.el('p', { className: 'walk-facts mono', textContent: c.t('walkDoneIn', {
        n: done, total: total, took: took(w.data.walk.finished - w.data.walk.started)
      }) }));
    } else if (started()) {
      kids.push(c.el('p', { className: 'walk-facts mono', textContent: c.t('walkToGo', {
        n: done, total: total, left: total - done
      }) }));
    } else {
      kids.push(c.el('p', { className: 'walk-facts mono', textContent: about }));
      if (total) kids.push(timesLine(p.total));
    }

    if (started()) {
      kids.push(c.el('div', { className: 'walk-bar', 'aria-hidden': 'true' }, [
        c.el('i', { style: 'width:' + (total ? Math.min(100, done / total * 100) : 0) + '%' })
      ]));
    }

    if (finished()) {
      kids.push(c.el('p', { className: 'walk-from', textContent: c.t('walkFinishedSay') }));
    } else if (total) {
      if (started()) {
        /* The clock, then what is left to walk, then what finishing is —
           the three things a walk half done was not saying. */
        playing = c.el('p', { className: 'walk-facts mono' });
        kids.push(playing);
        kids.push(c.el('p', { className: 'walk-facts mono', textContent: toGo
          ? c.t('walkLeftSpan', { n: left.length, distance: distance(toGo) })
          : about }));
        kids.push(timesLine(toGo || p.total));
        kids.push(c.el('p', { className: 'walk-from', textContent: w.replanned
          ? c.t('walkReplanned', { place: left[0].name })
          : c.t('walkGoal', { total: total }) }));
      } else {
        kids.push(c.el('p', { className: 'walk-from', textContent:
          w.own ? (p.more >= 10 ? c.t('walkYours', { more: distance(p.more) }) : c.t('walkYoursPlain'))
          : c.t(w.from ? 'walkFromHere' : 'walkFromFirst', { place: p.stops[0].name })
        }));
        kids.push(c.el('p', { className: 'walk-how', textContent: c.t('walkHow') }));
      }
    }

    /* What the walker said about the whole of it — the board under this
       card shows it to everybody. */
    if (finished() && w.noting !== '' && w.data.walk.note) {
      kids.push(c.el('p', { className: 'walk-note', textContent: w.data.walk.note }));
    }

    /* The tiles: everything else this card can do, in the order somebody
       would reach for it — see WHAT ELSE THE CARD CAN DO above. */
    var tiles = [
      finished() && w.noting !== '' ? tile(ICON_NOTE, c.t(w.data.walk.note ? 'walkNoteEdit' : 'walkNoteAdd'), function () {
        w.noting = '';
        say('');
        c.redraw();
      }) : null,
      !started() && !w.from && !w.own && total
        ? tile(ICON_HERE, c.t(w.busy === 'here' ? 'walkFinding' : 'walkFromMe'), fromMe) : null,
      started() && !finished() && left.length > 1
        ? tile(ICON_HERE, c.t(w.busy === 'here' ? 'walkFinding' : 'walkReplan'), replan) : null,
      total ? TTBTrack.click(tile(ICON_MAP, c.t('walkOnMap'), null, c.mapHref()),
        'walk_map', { list_id: w.list.id }) : null,
      !finished() && total > 2 ? tile(ICON_ORDER, c.t('walkReorder'), reorder) : null
    ].filter(Boolean);
    if (tiles.length) kids.push(c.el('div', { className: 'walk-tiles' }, tiles));
    if (started() && !w.asking) {
      kids.push(c.el('div', { className: 'lists-row walk-alts' }, [
        alt(c.t('walkAgain'), function () { w.asking = true; c.redraw(); })
      ]));
    }

    /* Start again, asked before it is done: it takes every check, every
       comment and a time on the board with it. */
    if (started() && w.asking) {
      var yes = c.button(c.t('walkAgainYes'), 'alt is-danger', startAgain);
      yes.disabled = w.busy === 'again';
      kids.push(c.el('div', { className: 'walk-ask', role: 'group', 'aria-label': c.t('walkAgain') }, [
        c.el('p', { textContent: c.t('walkAgainAsk') }),
        c.el('div', { className: 'lists-row' }, [
          yes,
          alt(c.t('walkAgainNo'), function () { w.asking = false; c.redraw(); })
        ])
      ]));
    }

    if (lost > 0) {
      kids.push(c.el('p', { className: 'walk-facts mono', textContent: c.t('walkLeftOut', { n: lost }) }));
    }
    clock(playing);
    return c.card(kids);
  }

  /* The handle a place is moved by — see carry(). */
  function gripFor(item, i, row) {
    var grip = c.el('button', {
      type: 'button',
      className: 'row-btn walk-grip',
      'aria-label': c.t('walkGrip', { place: item.name }),
      title: c.t('walkGrip', { place: item.name }),
      'data-walk-grip': String(i),
      html: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICON_GRIP + '</svg>'
    });
    carry(grip, row, item.place);
    return grip;
  }

  /* What people said at a place: the walker's own first, with the way to
     change it, then the newest few of everybody else's under their names. */
  function notesOf(item, mine) {
    var out = [];
    /* Not while the order is being changed: a row is then a thing to move,
       and is the shorter for it. */
    if (w.editing) return out;
    if (mine) {
      if (mine.note) out.push(c.el('p', { className: 'walk-note', textContent: mine.note }));
      if (w.noting !== item.place) {
        out.push(alt(c.t(mine.note ? 'walkNoteEdit' : 'walkNoteAdd'), function () {
          w.noting = item.place;
          say('');
          c.redraw();
        }));
      }
    }
    ((w.data && w.data.notes) || []).filter(function (n) {
      return n.place === item.place && n.name !== w.data.user;
    }).slice(0, NOTES_SHOWN).forEach(function (n) {
      out.push(c.el('p', { className: 'walk-note is-theirs' }, [
        c.el('a', { className: 'walk-note-by mono', href: c.profileHref(n.name), textContent: n.name }),
        ' ' + n.note,
        w.data.admin ? alt(c.t('walkNoteRemove'), function () { removeNote(n.place, n.name); }) : null
      ]));
    });
    return out;
  }

  function stop(item, i, p, next) {
    var mine = checkOf(item.place);
    var href = c.placeHref(item);
    var body = [
      href && !w.editing
        ? c.el('a', { className: 'item-name', href: href }, [c.el('span', { textContent: item.name })])
        : c.el('span', { className: 'item-name', textContent: item.name }),
      item.address ? c.el('p', { className: 'item-address mono', textContent: item.address }) : null,
      mine ? c.el('p', { className: 'walk-done mono', textContent: c.t('walkChecked', { when: day(mine.at, true) }) }) : null,
      next === item ? c.el('p', { className: 'walk-next mono', textContent: w.here
        ? c.t('walkNextFrom', { distance: distance(crow(w.here, item)) })
        : c.t('walkNext') }) : null
    ].concat(notesOf(item, mine));
    /* The way to the next one, on the map, from wherever the phone is: the
       map's own directions, opened already drawn. */
    if (next === item && href) {
      body.push(TTBTrack.click(c.el('a', {
        className: 'alt', href: href + '&go=1', textContent: c.t('directions')
      }), 'walk_directions', { list_id: w.list.id }));
    }

    /* The leg into this one, written beside the line rather than between
       two cards, and under it how far in the walk is by the time it has
       been walked — a running clock, which is the thing a list of legs
       never added up for anybody. */
    var leg = i ? c.el('p', { className: 'walk-leg mono' }, [
      c.t('walkLeg', {
        distance: distance(metres(p.stops[i - 1], item)),
        time: minutes(metres(p.stops[i - 1], item) / PACE.foot)
      }),
      c.el('span', { className: 'walk-in', textContent: c.t('walkSoFar', {
        time: minutes(p.sofar[i] / PACE.foot)
      }) })
    ]) : null;

    /* The number is on the rail now, which is why the card has no column
       for one. Checked, it is a tick on a filled dot; the next one to go
       to wears a ring. */
    var dot = mine
      ? c.el('span', { className: 'walk-dot is-done', 'aria-hidden': 'true',
          html: '<svg viewBox="0 0 24 24" focusable="false">' + ICON_TICK + '</svg>' })
      : c.el('span', { className: 'walk-dot mono' + (next === item ? ' is-next' : ''),
          'aria-hidden': 'true', textContent: String(i + 1) });

    var row = c.el('li', { className: 'walk-stop' + (mine ? ' is-done' : '') }, [
      leg,
      dot,
      c.el('div', { className: 'item' + (mine ? ' is-checked' : '') + (next === item ? ' is-next' : '') +
          (w.editing ? ' has-moves' : '') }, [
        c.el('div', { className: 'item-body' }, body)
      ])
    ]);
    if (w.editing) row.lastChild.appendChild(gripFor(item, i, row));
    return row;
  }

  /* The two ends of the rail. The order was always there and the page never
     said where it ended: the stack began at the top of the screen and ran
     out at the bottom, and the last place was the last card rather than the
     finish. A cap is a flag on the line, naming the place and — at the
     bottom — how long the whole of it is. Not while the order is being
     changed: the ends move with every drop, and a flag that moved under a
     finger would be noise. That is also what keeps carry() right, which
     reads a dropped row's new place off its index among the list's
     children — so a cap drawn while the order is being changed would put
     every place one out. */
  function cap(p, end) {
    var stops = p.stops;
    if (w.editing || stops.length < 2) return null;
    return c.el('li', { className: 'walk-cap is-' + (end ? 'end' : 'start') }, [
      c.el('i', { 'aria-hidden': 'true' }),
      c.el('p', { textContent: end
        ? c.t('walkEndAt', {
          place: stops[stops.length - 1].name,
          time: finished() ? took(w.data.walk.finished - w.data.walk.started) : minutes(p.total / PACE.foot)
        })
        : c.t('walkStartAt', { place: stops[0].name }) })
    ]);
  }

  /* ------------------------------------------------- how somebody else went

   * A row on the board is a time and nothing else — "By bike · 1 h 9 min" —
   * and the parts are the interesting half: which place to which, and how
   * long that bit took them. Every one of those times is in walk_checks
   * already, so the time is the press and under it opens that person's own
   * walk; the name beside it stays the way to their profile. One row open
   * at a time, and pressing the open one closes it.
   */

  function traceFor(name) {
    if (w.trace && w.trace.who === name) { w.trace = null; c.redraw(); return; }
    w.trace = { who: name, rows: null };
    c.redraw();
    TTBTrack.event('walk_trace', { list_id: w.list.id });
    fetch(API + '?list=' + encodeURIComponent(w.list.id) + '&who=' + encodeURIComponent(name),
      { headers: { accept: 'application/json' } })
      .then(read)
      .then(function (answer) {
        if (!w.trace || w.trace.who !== name) return;
        w.trace.rows = answer.status === 200 && Array.isArray(answer.out.checks) ? answer.out.checks : [];
        c.redraw();
      })
      .catch(function () {
        if (!w.trace || w.trace.who !== name) return;
        w.trace.rows = [];
        c.redraw();
      });
  }

  /* A place by the id a check was filed under, whether or not it has
     coordinates now: byPlace() is the walk's own and answers doors alone,
     and a check is kept when its place loses them. */
  function itemOf(place) {
    var items = w.list.items;
    for (var i = 0; i < items.length; i++) if (items[i].place === place) return items[i];
    return null;
  }

  /* One person's checks as the line they walked: a pip a place, the real
     gap between each pair, and the straight-line distance where both ends
     are still on the list to measure. A place that has left it keeps its
     time and loses its name — the check is the record, the list is not. */
  function trace() {
    if (!w.trace) return null;
    if (w.trace.rows === null) return c.el('p', { className: 'walk-trace-say mono', textContent: c.t('walkTraceWait') });
    if (!w.trace.rows.length) return c.el('p', { className: 'walk-trace-say mono', textContent: c.t('walkTraceNone') });

    var rows = w.trace.rows;
    return c.el('ol', { className: 'walk-trace' }, rows.map(function (row, i) {
      var item = itemOf(row.place);
      var was = i ? itemOf(rows[i - 1].place) : null;
      var far = was && item && typeof item.lat === 'number' && typeof was.lat === 'number'
        ? metres(was, item) : 0;
      var gap = i ? took(row.at - rows[i - 1].at) : '';
      return c.el('li', null, [
        i ? c.el('p', { className: 'walk-trace-gap mono', textContent: far
          ? c.t('walkTraceGap', { time: gap, distance: distance(far) })
          : gap }) : null,
        c.el('span', { className: 'walk-pip', 'aria-hidden': 'true' }),
        c.el('p', { className: 'walk-trace-place' }, [
          item ? item.name : c.t('walkTraceGone'),
          i === 0 || i === rows.length - 1
            ? c.el('span', { className: 'walk-trace-end',
                textContent: ' · ' + c.t(i === 0 ? 'walkTraceStart' : 'walkTraceEnd') })
            : null
        ])
      ]);
    }));
  }

  /* Everybody who finished, fastest first. Drawn only once somebody has:
     a board with nobody on it is a card saying nothing. Under the places
     while there is still walking to do, and over them once there is not —
     see view(). */
  function board() {
    var rows = (w.data && w.data.board) || [];
    if (!rows.length || w.editing) return null;
    return c.card([
      c.el('p', { className: 'eyebrow', textContent: c.t('walkBoard') }),
      c.el('ol', { className: 'walk-board' }, rows.map(function (row, i) {
        var open = w.trace && w.trace.who === row.name;
        /* How long, and By bike before it for anybody who picked that
           while the card had chips to pick it with — an hour by bike is
           not an hour on foot. Nobody is asked now, so nothing is said
           for the rest. The time is the press, because the parts are what
           it is made of — the name beside it is already the way to the
           person. */
        var time = c.el('button', {
          type: 'button',
          className: 'walk-board-open walk-took',
          'aria-expanded': open ? 'true' : 'false',
          'aria-label': c.t('walkTraceSee', { name: row.name }),
          textContent: (row.mode === 'bike' ? c.t('walkBike') + ' · ' : '') + took(row.finished - row.started)
        });
        time.addEventListener('click', function () { traceFor(row.name); });
        return c.el('li', { className: open ? 'is-open' : '' }, [
          c.el('div', { className: 'walk-board-row' }, [
            c.el('span', null, [
              (i + 1) + ' · ',
              c.el('a', { href: c.profileHref(row.name), textContent: row.name })
            ]),
            time
          ]),
          row.note ? c.el('p', { className: 'walk-note is-theirs' }, [
            row.note,
            w.data.admin && row.name !== w.data.user
              ? alt(c.t('walkNoteRemove'), function () { removeNote('', row.name); }) : null
          ]) : null,
          open ? trace() : null
        ]);
      }))
    ]);
  }

  function message() {
    if (!w.msg) return null;
    return c.el('p', {
      className: 'walk-msg' + (w.msg.bad ? ' is-no' : ' is-yes'),
      role: 'status',
      textContent: w.msg.text
    });
  }

  /* The band at the foot of the window, and the one filled action the view
     has: Done while the order is being changed, the comment while one is
     being written — on a place, or on the whole of a finished walk — and
     otherwise the next thing a walk wants: to be started, to be checked in
     on, or, finished, the way on to more lists. */
  function bandKids() {
    var kids = [message()];
    var live = !!(w.data && w.data.ready && doors().length);

    /* What a comment is being written on: a place checked in at, '' for the
       whole of a finished walk, or null. A walk just finished with nothing
       said about it is offered the field once, after the last place's own. */
    var on = w.noting;
    if (live && on === null && finished() && !w.data.walk.note && !w.asked) on = '';
    var was = on === null ? null : on === '' ? (finished() ? w.data.walk : null) : checkOf(on);

    if (w.editing) {
      kids.push(c.button(c.t('walkDone'), 'go', doneReordering));
    } else if (live && was) {
      var hint = c.t(on === '' ? 'walkRouteNoteHint' : 'walkNoteHint');
      var field = c.el('input', {
        type: 'text',
        className: 'walk-field',
        maxlength: String(MAX_NOTE),
        placeholder: hint,
        'aria-label': hint,
        autocomplete: 'off'
      });
      field.value = was.note || '';
      var form = c.el('form', { className: 'walk-form' }, [
        field,
        c.el('div', { className: 'walk-form-row' }, [
          c.el('button', { type: 'submit', className: 'go', textContent: c.t('walkNoteSave'), disabled: w.busy === 'note' }),
          alt(c.t('walkNoteSkip'), function () {
            if (on === '') w.asked = true;
            w.noting = null;
            say('');
            c.redraw();
          })
        ])
      ]);
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        if (on === '') w.asked = true;
        saveNote(on, field.value);
      });
      kids.push(form);
    } else if (!live || finished()) {
      kids.push(c.moreLists());
    } else if (!w.data.user) {
      kids.push(TTBTrack.click(c.el('a', {
        className: 'go', href: c.signInHref(), textContent: c.t('walkSignIn')
      }), 'walk_signin', { list_id: w.list.id }));
    } else if (!started()) {
      var go = c.button(c.t('walkStart'), 'go', startWalk);
      go.disabled = w.busy === 'start';
      kids.push(go);
    } else {
      /* Where, and how far: the nearest place left, by name. Inside the
         radius the button is the accent and says so; outside it is greyed
         and still pressable — ONCE IT IS STARTED, THE PAGE WATCHES WHERE YOU
         ARE. Before the phone has answered, or where it will not, the
         button is the plain one and the press is what asks. */
      var near = nearest();
      var at = near && near.metres <= w.data.radius;
      if (near && !w.msg) {
        kids.push(c.el('p', { className: 'walk-near', textContent:
          c.t(at ? 'walkAt' : 'walkNearest', { place: near.item.name }) }));
        kids.push(c.el('p', { className: 'walk-near-sub' + (at ? ' is-yes' : ''), textContent: at
          ? c.t('walkAtDoor', { distance: distance(near.metres) })
          : c.t('walkAway', { distance: distance(near.metres), radius: w.data.radius }) }));
      } else if (w.refused && !w.msg) {
        kids.push(c.el('p', { className: 'walk-msg is-no', textContent: c.t('walkNoLocation') }));
      }
      var check = c.button(
        w.busy === 'check' ? c.t('walkFinding')
          : near ? c.t('walkCheckAt', { place: near.item.name }) : c.t('walkCheck'),
        'go' + (near && !at ? ' is-wait' : ''), checkIn);
      check.disabled = w.busy === 'check';
      kids.push(check);
    }

    return kids.filter(Boolean);
  }

  function dock() {
    return c.el('div', { className: 'lists-dock walk-dock' }, bandKids());
  }

  /* --------------------------------------------------------------- the view
   * Called by renderOne() in assets/lists.js every time the page is drawn
   * with the Walk view on, with:
   *
   *   list         the list, as /api/lists answers it
   *   lang         the language the page is in
   *   t, el, card, heading, button, countLabel
   *                the page's own, so a card here is the card everywhere
   *   placeHref(item), profileHref(name), signInHref(), mapHref()
   *                where a place, a person, the sign-in sheet and this walk
   *                on the map are
   *   moreLists()  the band's way out, as the List view draws it
   *   redraw()     the page's render(), which calls this again
   *
   * and answers the nodes to put under the bar. The page calls leave() when
   * the view is switched away from.
   */
  /* The walk of this list, made the first time either page asks for it
     and kept from then on. */
  function open(ctx) {
    c = ctx;
    if (!w || w.list.id !== ctx.list.id) {
      unwatch();
      w = {
        list: ctx.list,
        data: null,       // what /api/walk last answered; null until it has
        own: null,        // the walker's own order as place ids, or null for the shortest
        short: null,      // the shortest order, remembered — see shortOrder()
        here: null,       // where the phone last said it was
        from: null,       // where "Start from where I am" was pressed — see shortOrder()
        hereAt: 0,        // and when the watch said so — see locate()
        editing: false,   // the order is being changed
        replanned: false, // "Shortest from here" was pressed and nothing has moved since — see replan()
        trace: null,      // the name on the board whose own walk is open, and its legs — see traceFor()
        noting: null,     // what a comment is being written on: a place, '' for the whole walk
        asked: false,     // the finished walk's comment has been offered once
        asking: false,    // Start again has been pressed and is being confirmed
        watch: null,      // the id of the position watch, while one runs — see watch()
        refused: false,   // the phone would not say where it is
        busy: '',         // 'here' | 'start' | 'check' | 'note' while one is in flight
        msg: null         // the line over the band's button
      };
      TTBTrack.event('walk_open', { list_id: ctx.list.id });
      load();
    }
    w.list = ctx.list;
    watch();
  }

  /* The first place in the order that is not checked, while a walk is on. */
  function nextOf(p) {
    if (!started() || finished() || w.editing) return null;
    for (var i = 0; i < p.stops.length; i++) {
      if (!checkOf(p.stops[i].place)) return p.stops[i];
    }
    return null;
  }

  function view(ctx) {
    open(ctx);
    var p = plan();
    var next = nextOf(p);
    var stops = c.el('ol', { className: 'walk-stops' }, [cap(p, false)]
      .concat(p.stops.map(function (item, i) { return stop(item, i, p, next); }))
      .concat([cap(p, true)]));
    return finished()
      ? [head(p), board(), stops, dock()]
      : [head(p), stops, board(), dock()];
  }

  /* The map's half — AND THE SAME WALK ON THE MAP. Called by walkOnMap() in
   * assets/app.js every time the map draws the walk, with the same `list`,
   * `lang`, `t`, `el`, `button`, `signInHref()`, `moreLists()` and
   * `redraw()` the list page hands view(), and optionally
   *
   *   onHere(here, accuracy)   called with every position the watch reads,
   *                            so the map's dot is the walk's
   *
   * and answers what the map draws:
   *
   *   kids      the band's contents, as the list page's band holds them
   *   stops     the places in order: { place, name, lat, lng, checked, next }
   *   started, finished, done, total
   *   near      the nearest place left, or null before the phone has answered
   */
  function band(ctx) {
    open(ctx);
    var p = plan();
    var next = nextOf(p);
    var near = started() && !finished() ? nearest() : null;
    return {
      kids: bandKids(),
      stops: p.stops.map(function (item) {
        return {
          place: item.place,
          name: item.name,
          lat: item.lat,
          lng: item.lng,
          checked: !!checkOf(item.place),
          next: item === next
        };
      }),
      started: started(),
      finished: finished(),
      done: (w.data && w.data.checks.length) || 0,
      total: p.stops.length,
      near: near ? near.item.place : null
    };
  }

  /* The view has been left for the list's other one: nothing here should
     go on asking the phone where it is, or rewriting a clock nobody sees. */
  function leave() {
    unwatch();
    clock(null);
  }

  /* When the walk on screen was started, for a page that keeps a clock of
     its own beside took() — the map's band does. 0 where there is none. */
  function since() {
    return w && started() ? w.data.walk.started : 0;
  }

  window.TTBWalk = { view: view, band: band, leave: leave, took: took, since: since };
})();
