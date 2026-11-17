/**
 * Tallinn Tastebuds — recording a bike ride.
 *
 * Record a ride — the bike button on the map, or the button on the Your
 * rides card of /account.html, which opens the map with ?ride=1 — opens a
 * card at the foot of the map. A ride needs no destination, so nothing
 * about it hangs off a place's directions. Start asks the phone for its position over and over,
 * keeps a point every dozen metres, draws the way as it grows and counts the
 * distance, the time and the average. Finish turns the card into a question
 * — save it, under an optional name, or throw it away — and a saved ride is
 * a confirmed bike route: functions/api/rides.js keeps it, and from then on
 * the Bike tab draws it faintly under any way it runs beside. **Recorded
 * rides** in docs/handbook.md is the reasoning; this is the page half, and the
 * global is TTBRide, the way the walk's is TTBWalk.
 *
 * A WEB PAGE RECORDS ONLY WHILE IT IS LOOKED AT
 *
 * A browser stops telling a page where it is the moment the screen locks or
 * the tab goes to the back, on an iPhone at once and on Android soon after,
 * and no permission a page can ask for changes that. So the card says so
 * before the ride starts rather than after a ride that has a hole in it, it
 * asks the browser to keep the screen on while it records (the Screen Wake
 * Lock, where there is one), and a hidden page pauses the ride outright: the
 * clock stops with the points, and coming back shows Paused with Resume,
 * instead of a straight line drawn across whatever was ridden unseen.
 *
 * THE RIDE IS KEPT ON THE PHONE UNTIL IT IS SAVED
 *
 * Under DRAFT, in this browser's storage, every few points and at every
 * pause: a page reloaded mid-ride, a sign-in that went to Google and back, a
 * save that did not go through — each comes back to the same ride, paused or
 * finished, rather than to nothing. Throwing it away or saving it is what
 * clears it. Storage that throws costs only that.
 *
 * WHAT IS SENT, AND WHAT IS NOT
 *
 * The points and the seconds, once, when Save is pressed — and nothing at
 * all while riding. A point is [lat, lng, t, acc]: where, how many seconds
 * after the first point it was passed — by the clock, so a pause shows as a
 * gap — and how sure the phone was, in metres. The last two are for the day
 * rides are matched to streets, when a stretch pushed at walking pace has
 * to be told from one ridden; WHEN EACH POINT WAS PASSED in
 * functions/api/rides.js. The server takes the first and last two hundred metres
 * off before it stores anything and never answers whose ride it was; the
 * card says both, since they are the two things somebody would want to
 * know before pressing Save.
 *
 * EVERYTHING HERE FAILS QUIET
 *
 * No geolocation, no wake lock, no table on the server: each costs its own
 * part and nothing else. The faint lines under a bike route are drawn only
 * when /api/rides answers with some.
 */
(function () {
  'use strict';

  var API = '/api/rides';
  var DRAFT = 'ttb.ride';

  /* A point is kept once the phone has moved this far from the last one
     kept, and only from a fix this sure of itself: thirty metres is a street
     away, and a fix worse than that draws the ride through the houses. */
  var STEP = 12;
  var SURE = 30;

  /* A jump faster than this between two fixes is the phone guessing, not a
     bike, and is dropped — 60 km/h, downhill with a tailwind. */
  var JUMP = 60 / 3.6;

  /* The shortest ride worth saving. The server's MIN_METERS is what is left
     after its ENDS come off both ends — functions/api/rides.js — so the
     ride itself has to be this long: 300 + 2 × 200. */
  var MIN_METERS = 700;

  /* The longest name, the server's MAX_NAME restated so the field stops at
     the keystroke. */
  var MAX_NAME = 60;

  /* Within this many metres of a recorded ride, a stretch of a suggested
     way counts as ridden before: a lane's width and a GPS fix's error. */
  var ALONG = 20;

  var c = null;      // what assets/app.js handed over — mount()
  var card = null;
  var shown = false;

  /* The ride on screen: its points as [lat, lng, t, acc], when the first of
     them was passed (`t0`, which every t is counted from), the seconds
     ridden before the current stretch, when the current stretch began (0
     while paused), the last fix's time, and which state the card is
     drawing. */
  var ride = null;
  var view = 'ready';
  var problem = '';
  var saved = null;

  var watch = null;
  var lock = null;
  var ticker = null;
  var line = null;

  /* ------------------------------------------------------------- numbers */

  function metres(a, b) {
    var rad = Math.PI / 180;
    var x = (b[1] - a[1]) * rad * Math.cos((a[0] + b[0]) / 2 * rad);
    var y = (b[0] - a[0]) * rad;
    return Math.sqrt(x * x + y * y) * 6371000;
  }

  function lengthOf(points) {
    var m = 0;
    for (var i = 1; i < points.length; i++) m += metres(points[i - 1], points[i]);
    return m;
  }

  function seconds() {
    if (!ride) return 0;
    return ride.seconds + (ride.since ? Math.round((Date.now() - ride.since) / 1000) : 0);
  }

  function clock(s) {
    var h = Math.floor(s / 3600);
    var m = Math.floor(s / 60) % 60;
    var ss = s % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  function summary() {
    return c.t('rideSummary', {
      dist: c.distance(lengthOf(ride.points)),
      min: Math.max(1, Math.round(seconds() / 60))
    });
  }

  /* -------------------------------------------------------------- storage */

  function keep() {
    if (!ride) return;
    try {
      window.localStorage.setItem(DRAFT, JSON.stringify({ points: ride.points, seconds: seconds(), t0: ride.t0 }));
    } catch (e) { /* the ride is still on screen */ }
  }

  function forget() {
    try { window.localStorage.removeItem(DRAFT); } catch (e) { /* ignore */ }
  }

  function kept() {
    try {
      var d = JSON.parse(window.localStorage.getItem(DRAFT) || 'null');
      if (d && d.points && d.points.length && typeof d.seconds === 'number') {
        return { points: d.points, seconds: d.seconds, t0: d.t0 || 0, since: 0, last: 0 };
      }
    } catch (e) { /* nothing kept */ }
    return null;
  }

  /* ------------------------------------------------------------ recording */

  function start() {
    if (!navigator.geolocation) { view = 'blocked'; draw(); return; }
    ride = ride || { points: [], seconds: 0, t0: 0, since: 0, last: 0 };
    ride.since = Date.now();
    ride.last = 0;
    view = ride.points.length ? 'recording' : 'waiting';
    awake(true);
    watch = navigator.geolocation.watchPosition(fix, function (err) {
      if (err && err.code === 1) { stop(); ride = null; forget(); view = 'blocked'; draw(); }
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    ticker = window.setInterval(paintStats, 1000);
    draw();
  }

  function fix(pos) {
    if (!ride || !ride.since || pos.coords.accuracy > SURE) return;
    var at = [Math.round(pos.coords.latitude * 1e5) / 1e5, Math.round(pos.coords.longitude * 1e5) / 1e5];
    var last = ride.points[ride.points.length - 1];
    if (last) {
      var d = metres(last, at);
      if (d < STEP) return;
      if (ride.last && d / Math.max(1, (pos.timestamp - ride.last) / 1000) > JUMP) return;
    }
    if (!ride.t0) ride.t0 = pos.timestamp;
    at.push(Math.max(0, Math.round((pos.timestamp - ride.t0) / 1000)), Math.round(pos.coords.accuracy));
    ride.points.push(at);
    ride.last = pos.timestamp;
    if (view === 'waiting') { view = 'recording'; draw(); }
    paintLine();
    paintStats();
    if (ride.points.length % 10 === 0) keep();
  }

  function stop() {
    if (watch !== null && navigator.geolocation) navigator.geolocation.clearWatch(watch);
    watch = null;
    if (ticker) window.clearInterval(ticker);
    ticker = null;
    awake(false);
    if (ride && ride.since) {
      ride.seconds = seconds();
      ride.since = 0;
    }
  }

  function pause() {
    stop();
    keep();
    view = 'paused';
    draw();
  }

  function finish() {
    stop();
    keep();
    problem = '';
    view = lengthOf(ride.points) < MIN_METERS ? 'short' : 'finished';
    draw();
    if (line && ride.points.length > 1) c.map.fitBounds(line.getBounds(), { padding: [40, 40], maxZoom: 16 });
  }

  function throwAway() {
    stop();
    ride = null;
    forget();
    hide();
  }

  /* The screen kept on while recording, where the browser can. A lock the
     browser takes back on its own — the tab hidden — is asked for again
     when the ride is resumed. */
  function awake(on) {
    if (!on) {
      if (lock) { try { lock.release(); } catch (e) { /* gone */ } }
      lock = null;
      return;
    }
    if (!navigator.wakeLock || !navigator.wakeLock.request) return;
    navigator.wakeLock.request('screen').then(function (l) { lock = l; }, function () { lock = null; });
  }

  /* A page nobody is looking at hears nothing, so the ride stops with it —
     A WEB PAGE RECORDS ONLY WHILE IT IS LOOKED AT. */
  function onHidden() {
    if (document.visibilityState === 'hidden' && ride && ride.since) pause();
  }

  /* ---------------------------------------------------------------- saving */

  function save() {
    var name = card.querySelector('.ride-name');
    view = 'saving';
    draw();
    fetch(API, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save',
        name: name ? String(name.value).slice(0, MAX_NAME) : '',
        seconds: seconds(),
        line: ride.points
      })
    }).then(function (res) {
      return res.json().then(function (out) { return { status: res.status, out: out }; }, function () {
        return { status: res.status, out: {} };
      });
    }).then(function (got) {
      if (got.out && got.out.ride) {
        saved = summary();
        ride = null;
        forget();
        clearLine();
        view = 'saved';
        c.track('ride_save');
      } else {
        problem = { 'signed-out': 'rideSignedOut', often: 'rideOften', fast: 'rideFast', short: 'rideShortWhy' }[got.out && got.out.error] || 'rideFailed';
        view = 'finished';
      }
      draw();
    }, function () {
      problem = 'rideFailed';
      view = 'finished';
      draw();
    });
  }

  /* ------------------------------------------------------------- drawing */

  function paintLine() {
    if (!ride || ride.points.length < 2) return;
    /* Leaflet reads a point of two numbers or of three, and nothing of
       four, so it is handed the where without the when. */
    var path = ride.points.map(function (p) { return [p[0], p[1]]; });
    if (!line) {
      line = window.L.polyline(path, {
        color: c.colour(),
        weight: 5,
        opacity: .9,
        lineCap: 'round',
        lineJoin: 'round',
        className: 'ride-live',
        interactive: false
      }).addTo(c.map);
    } else {
      line.setLatLngs(path);
    }
  }

  function clearLine() {
    if (line) { c.map.removeLayer(line); line = null; }
  }

  function paintStats() {
    if (!card || !ride) return;
    var s = seconds();
    var m = lengthOf(ride.points);
    var cells = card.querySelectorAll('.ride-stat b');
    if (cells.length !== 3) return;
    cells[0].textContent = c.distance(m);
    cells[1].textContent = clock(s);
    cells[2].textContent = c.t('rideKmh', { n: s ? c.formatDecimal(m / s * 3.6, 0) : '0' });
  }

  function button(cls, key, run, name) {
    var b = c.el('button', { type: 'button', className: cls, textContent: c.t(key) });
    b.addEventListener('click', function () {
      if (name) c.track(name);
      run();
    });
    return b;
  }

  function say(cls, text) {
    return c.el('p', { className: cls, textContent: text });
  }

  function stats() {
    var row = c.el('div', { className: 'ride-stats' });
    ['rideDistance', 'rideTime', 'rideAverage'].forEach(function (key) {
      row.appendChild(c.el('div', { className: 'ride-stat' }, [
        c.el('b', { textContent: '–' }),
        c.el('span', { textContent: c.t(key) })
      ]));
    });
    return row;
  }

  /* One card, redrawn whole on every change of state, in the order every
     sheet here is built: eyebrow, title, the line that says why, anything
     that just happened, the fields, the one action, the ways out. */
  function draw() {
    if (!card) return;
    card.textContent = '';
    var parts = [];
    var top = c.el('p', { className: 'ride-top' });

    if (view === 'ready' || view === 'blocked') {
      top.textContent = c.t('routeModeBike');
      parts.push(top, c.el('h2', { className: 'ride-title', textContent: c.t('rideTitle') }));
      parts.push(say('ride-why', c.t('rideWhy')));
      if (view === 'blocked') {
        parts.push(say('ride-said is-bad', c.t('rideBlocked')));
      } else if (!c.signedIn()) {
        parts.push(say('ride-said', c.t('rideSignedOut')));
        parts.push(button('go', 'rideSignIn', c.signIn, 'ride_signin'));
      } else {
        parts.push(button('go', 'rideStart', start, 'ride_start'));
      }
      parts.push(button('alt', 'rideNotNow', hide));
    } else if (view === 'waiting' || view === 'recording' || view === 'paused') {
      top.appendChild(c.el('span', { className: 'ride-dot' + (view === 'paused' ? ' is-still' : ''), 'aria-hidden': 'true' }));
      top.appendChild(document.createTextNode(c.t(view === 'paused' ? 'ridePaused' : 'rideRecording')));
      parts.push(top, stats());
      parts.push(say('ride-why', c.t(view === 'waiting' ? 'rideWaiting' : view === 'paused' ? 'ridePausedWhy' : 'rideScreen')));
      if (view === 'paused') {
        parts.push(button('go', 'rideResume', start, 'ride_resume'));
        parts.push(button('alt', 'rideFinish', finish, 'ride_finish'));
      } else {
        parts.push(button('go', 'rideFinish', finish, 'ride_finish'));
        parts.push(button('alt', 'ridePause', pause, 'ride_pause'));
      }
    } else if (view === 'short') {
      top.textContent = summary();
      parts.push(top, c.el('h2', { className: 'ride-title', textContent: c.t('rideShortTitle') }));
      parts.push(say('ride-why', c.t('rideShortWhy', { dist: c.distance(MIN_METERS) })));
      parts.push(button('go', 'rideKeepGoing', start, 'ride_resume'));
      parts.push(button('alt is-danger', 'rideThrow', throwAway, 'ride_throw'));
    } else if (view === 'finished' || view === 'saving') {
      top.textContent = summary();
      parts.push(top, c.el('h2', { className: 'ride-title', textContent: c.t('rideSaveTitle') }));
      parts.push(say('ride-why', c.t('rideSaveWhy')));
      if (problem) parts.push(say('ride-said is-bad', c.t(problem, { dist: c.distance(MIN_METERS) })));
      var label = c.el('label', { className: 'ride-label', 'for': 'ride-name', textContent: c.t('rideName') });
      var field = c.el('input', {
        id: 'ride-name',
        className: 'ride-name',
        type: 'text',
        maxlength: String(MAX_NAME),
        autocomplete: 'off',
        enterkeyhint: 'done'
      });
      parts.push(c.el('div', { className: 'ride-field' }, [label, field]));
      if (problem === 'rideSignedOut') {
        parts.push(button('go', 'rideSignIn', c.signIn, 'ride_signin'));
      } else if (problem !== 'rideFast') {
        var go = button('go', view === 'saving' ? 'rideSaving' : 'rideSave', save);
        if (view === 'saving') go.disabled = true;
        parts.push(go);
      }
      parts.push(button('alt is-danger', 'rideThrow', throwAway, 'ride_throw'));
    } else if (view === 'saved') {
      top.textContent = saved || '';
      parts.push(top, c.el('h2', { className: 'ride-title', textContent: c.t('rideSaved') }));
      parts.push(say('ride-why', c.t('rideSavedWhy')));
      parts.push(button('alt', 'close', hide));
    }

    parts.forEach(function (p) { card.appendChild(p); });
    paintStats();
  }

  function show() {
    shown = true;
    card.hidden = false;
    document.body.classList.add('ride-on');
    draw();
  }

  function hide() {
    if (ride && ride.since) return;
    shown = false;
    card.hidden = true;
    document.body.classList.remove('ride-on');
    if (!ride) { view = 'ready'; clearLine(); }
  }

  /* --------------------------------------------- rides under a bike route */

  /* The rides /api/rides keeps under a way, and how many metres of the way
     run within ALONG of one of them: { rides: [line, …], along }. Nothing,
     rather than a failure, when there are none or the route cannot answer. */
  function under(way) {
    var s = 90, w = 180, n = -90, e = -180;
    way.forEach(function (p) {
      s = Math.min(s, p[0]); n = Math.max(n, p[0]);
      w = Math.min(w, p[1]); e = Math.max(e, p[1]);
    });
    return fetch(API + '?bbox=' + [s, w, n, e].map(function (v) { return v.toFixed(3); }).join(','))
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (out) {
        var rides = out && out.rides ? out.rides.map(function (r) { return r.line; }) : [];
        return { rides: rides, along: rides.length ? along(way, rides) : 0 };
      }, function () { return { rides: [], along: 0 }; });
  }

  /* The way walked in steps of a few metres, each step counted when it lies
     within ALONG of any stretch of any ride. Flat metres around the way's
     own latitude, which across one city is exact enough. */
  function along(way, rides) {
    var rad = Math.PI / 180;
    var lat0 = way[0][0];
    var kx = Math.cos(lat0 * rad) * rad * 6371000;
    var ky = rad * 6371000;
    var flat = function (p) { return [p[1] * kx, p[0] * ky]; };
    var segs = [];
    rides.forEach(function (r) {
      for (var i = 1; i < r.length; i++) segs.push([flat(r[i - 1]), flat(r[i])]);
    });
    var near = function (p) {
      for (var i = 0; i < segs.length; i++) {
        var a = segs[i][0], b = segs[i][1];
        var dx = b[0] - a[0], dy = b[1] - a[1];
        var len = dx * dx + dy * dy;
        var k = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
        var x = a[0] + k * dx - p[0], y = a[1] + k * dy - p[1];
        if (x * x + y * y <= ALONG * ALONG) return true;
      }
      return false;
    };
    var total = 0;
    for (var i = 1; i < way.length; i++) {
      var a = flat(way[i - 1]), b = flat(way[i]);
      var len = Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2));
      var steps = Math.max(1, Math.ceil(len / 5));
      for (var j = 0; j < steps; j++) {
        var k = (j + .5) / steps;
        if (near([a[0] + k * (b[0] - a[0]), a[1] + k * (b[1] - a[1])])) total += len / steps;
      }
    }
    return total;
  }

  /* ---------------------------------------------------------------- mount */

  /* `opts` is what the map hands over: its Leaflet map, its t() and el(),
     how it writes a distance and a number, the bike's colour, whether
     somebody is signed in and how to ask them to, and how a press is
     reported. A ride left on the phone from last time comes back, paused,
     with the card open on it. */
  function mount(node, opts) {
    card = node;
    c = opts;
    document.addEventListener('visibilitychange', onHidden);
    ride = kept();
    if (ride) {
      view = 'paused';
      paintLine();
      show();
    }
  }

  function open() {
    if (card) show();
  }

  window.TTBRide = {
    mount: mount,
    open: open,
    under: under,
    /* Drawn again when the account changes under an open card, so a
       sign-in from its own Sign in turns into Start recording. */
    refresh: function () { if (shown) draw(); },
    /* Repainted in the style's colour when the swatch is pressed. */
    restyle: function () { if (line) line.setStyle({ color: c.colour() }); }
  };
})();
