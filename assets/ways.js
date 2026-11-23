/* Tallinn Tastebuds — bike ways, tried and judged by the owner on /admin/ways.
 *
 * A bike way is whatever functions/api/route.js makes of two routers and
 * the owner's rules, and the only way to know one is right is to look at it
 * where it runs. Until this page that meant asking a session for a picture.
 * Here the owner does it on a phone: tap the map where a ride starts and
 * where it ends, see the ways a rider is given this minute, and say what is
 * true of them. **Bike ways, for the owner** in docs/handbook.md.
 *
 * TWO THINGS ON ONE MAP
 *
 * A trip tried: two taps, and /api/v1/route asked by bike exactly as
 * Rattatee asks it, so what is drawn is what a rider gets — the first way
 * the one they are given, the others the buttons beside it. A way that
 * runs through a door of data/doors.json says so and has the door dotted
 * on it, since "is it using one of our gates" is the first thing asked of
 * a way that looks wrong.
 *
 * A trip pinned: one of data/bike-trips.json, the trips every change to the
 * route is held to by tools/routecheck.mjs, drawn as it is pinned. Its ways
 * are the code's as of the day it was pinned; the live site can have moved
 * since, with the map under the routers, and Ask the route now puts the
 * same question to it and says whether the answer is still the pin.
 *
 * WHAT THE OWNER CAN SAY
 *
 * That the ways are right, which is `confirmed` and the day. That something
 * is wrong, in their own words, which is `wrong` and `said`: it fixes
 * nothing by itself and is the work the next session on the route starts
 * from — the tool prints every one each time it runs. That a trip tried is
 * worth holding, which pins it. That the live answer is the right one now,
 * which pins that. And that a pin is not wanted.
 *
 * None of it is written when it is said. It is kept on the phone, in
 * localStorage, shown on the rows as not saved yet, and written all at once
 * by Save — the one filled button on the page — because a save is a commit
 * and a commit is a deploy, one of the five hundred a month: seventeen
 * confirmations are one, not seventeen.
 *
 * HOW A SAVE IS WRITTEN
 *
 * As /admin.html writes a place: through /api/admin/github, the owner's
 * door to the repository, as one commit on a branch of its own,
 * admin/ways-<time>, which the `land` job of .github/workflows/generated.yml
 * replays onto the live branch, checks, and pushes. The file is read fresh
 * from the live branch first and the changes laid over that, so a trip a
 * session pinned five minutes ago is not written over.
 *
 * The page cannot record what the routers said, which a pin needs, and
 * cannot run the route without the rides. So for a trip it pins it writes
 * what it was looking at — `saw`, the metres and seconds of each way — and
 * the land job runs tools/routecheck.mjs, which records the trip, pins what
 * the code answers and keeps the owner's yes only where those are the ways
 * they saw. WHAT THE PAGE ASKS FOR in that tool's header.
 *
 * WHAT IT COSTS
 *
 * No row and no route of its own. Two files read on opening. A trip tried
 * or asked again is one /api/v1/route, asked when the second pin lands or
 * the row is pressed and never while a finger is moving: three requests to
 * BRouter the first time that day and one lookup of `ride_sections`, 600
 * rows at the very worst — RIDDEN in functions/api/route.js. A save is
 * four requests to GitHub and a deploy.
 *
 * IN ENGLISH ALONE, like /admin.html and Doors: it is one person's page,
 * and its words are here rather than in data/ui.json.
 */
(function () {
  'use strict';

  var API = '/api/admin/github';
  var FILE = 'data/bike-trips.json';
  var RECORDINGS = 'tools/routecheck/';
  var CENTRE = [59.437, 24.7536];
  var ZOOM = 12;

  /* What is kept on the phone: `changes`, said and not saved, and `sent`,
     saved and not yet in the deployed file. */
  var KEPT = 'ttb.ways';
  /* How long a save is waited for before its changes stop being drawn over
     the file: a landing takes two or three minutes. */
  var LANDING = 20 * 60000;

  /* A way's colour is its number: the first is the one a rider is given.
     Named here as Doors names its one, since a line on Leaflet's canvas
     takes a colour and not a class; the number beside each says it twice. */
  var COLOURS = ['#c2410c', '#1d4ed8', '#15803d'];
  var PINNED = '#1c1917';

  /* Nearer than this to a way's line along its whole length, a door is one
     the way goes through. */
  var AT_DOOR = 12;

  /* The fields of a trip in the order the file keeps them: KEYS in
     tools/routecheck.mjs, which writes the same file. */
  var KEYS = ['id', 'name', 'from', 'to', 'heading', 'why', 'confirmed', 'wrong', 'said', 'fixed', 'saw', 'fresh', 'ways'];

  var CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

  var map = null;
  var drawn = null;
  var trips = null;
  var doors = [];
  var kept = { changes: {}, sent: null };
  var note = null;

  /* What the panel under the map is showing: `kind` is idle, start, asking,
     tried, pinning, trip or saying, and the rest is that view's own. */
  var view = { kind: 'idle' };

  var under = document.getElementById('ways-under');

  /* ------------------------------------------------------------- plumbing */

  function el(tag, props, kids) {
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'className') node.className = v;
      else if (k === 'textContent') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else node.setAttribute(k, v === true ? '' : String(v));
    });
    (kids || []).forEach(function (kid) {
      if (kid) node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    });
    return node;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function getJson(url) {
    return fetch(url, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error(url + ' answered ' + res.status);
      return res.json();
    });
  }

  /* Today in Tallinn, as the file writes a day. */
  function today() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn' }).format(new Date());
  }

  function day(iso) {
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  function size(way) {
    return (way.meters / 1000).toFixed(1) + ' km · ' + Math.round(way.seconds / 60) + ' min';
  }

  function round(latlng) {
    return [Number(latlng.lat.toFixed(5)), Number(latlng.lng.toFixed(5))];
  }

  /* -------------------------------------------------------------- a line
   * A pinned way's line is Google's encoded polyline at five decimals, and
   * the route answers [lat, lng] pairs at the same five: encode() and
   * decode() in tools/routecheck.mjs, written out again because a page
   * cannot load a tool.
   */
  function decode(text) {
    var out = [];
    var at = [0, 0];
    for (var i = 0; i < text.length;) {
      for (var axis = 0; axis < 2; axis++) {
        var shift = 0;
        var value = 0;
        var byte;
        do {
          byte = text.charCodeAt(i++) - 63;
          value |= (byte & 31) << shift;
          shift += 5;
        } while (byte >= 32);
        at[axis] += value & 1 ? ~(value >> 1) : value >> 1;
      }
      out.push([at[0] / 1e5, at[1] / 1e5]);
    }
    return out;
  }

  function encode(line) {
    var out = '';
    var before = [0, 0];
    line.forEach(function (p) {
      var now = [Math.round(p[0] * 1e5), Math.round(p[1] * 1e5)];
      for (var axis = 0; axis < 2; axis++) {
        var v = (now[axis] - before[axis]) << 1;
        if (v < 0) v = ~v;
        while (v >= 32) {
          out += String.fromCharCode((32 | (v & 31)) + 63);
          v >>= 5;
        }
        out += String.fromCharCode(v + 63);
      }
      before = now;
    });
    return out;
  }

  /* How far a point is from a line, in metres, near enough flat. */
  function apart(p, line) {
    var east = 111320 * Math.cos(p[0] * Math.PI / 180);
    var least = Infinity;
    for (var i = 1; i < line.length; i++) {
      var ax = (line[i - 1][1] - p[1]) * east;
      var ay = (line[i - 1][0] - p[0]) * 110540;
      var dx = (line[i][1] - p[1]) * east - ax;
      var dy = (line[i][0] - p[0]) * 110540 - ay;
      var t = Math.max(0, Math.min(1, (-ax * dx - ay * dy) / (dx * dx + dy * dy || 1)));
      least = Math.min(least, Math.sqrt((ax + t * dx) * (ax + t * dx) + (ay + t * dy) * (ay + t * dy)));
    }
    return least;
  }

  /* ---------------------------------------------------------------- a way
   * One shape for both kinds, so one function draws and lists either: a way
   * the route just answered, and a way out of a pin.
   */
  function fromRoute(way) {
    return {
      meters: way.meters, seconds: way.seconds, ridden: !!way.ridden, line: way.line,
      turns: (way.steps || []).length,
      streets: (way.steps || []).map(function (s) { return s.name; })
    };
  }

  function fromPin(way) {
    return {
      meters: way.meters, seconds: way.seconds, ridden: !!way.ridden, line: decode(way.line),
      turns: way.steps.length,
      streets: way.steps.map(function (s) { return s[2]; })
    };
  }

  /* The doors a way goes through, end to end. */
  function through(way) {
    return doors.filter(function (door) {
      return door.line.every(function (p) { return apart(p, way.line) < AT_DOOR; });
    });
  }

  /* Whether two ways are one: the same length, time and line. */
  function same(a, b) {
    return a.meters === b.meters && a.seconds === b.seconds && encode(a.line) === encode(b.line);
  }

  /* The bike route, asked as an app asks it: the ways, or the word it was
     refused with. */
  function ask(from, to, heading) {
    var q = '/api/v1/route?from=' + from.join(',') + '&to=' + to.join(',') + '&mode=bike' +
      (heading === undefined ? '' : '&heading=' + heading);
    return fetch(q).then(function (res) {
      return res.json();
    }).then(function (body) {
      if (body.error || !Array.isArray(body.line)) return { error: body.error || 'upstream' };
      return { ways: [body].concat(Array.isArray(body.others) ? body.others : []).map(fromRoute) };
    }, function () {
      return { error: 'upstream' };
    });
  }

  function refusal(word) {
    if (word === 'no-route') return 'No bike way between those two points.';
    if (word === 'bad-points') return 'One of the points is outside Estonia.';
    return 'The router is not answering. Try again in a minute.';
  }

  /* --------------------------------------------------- what is on the phone */

  function recall() {
    try {
      var read = JSON.parse(localStorage.getItem(KEPT) || 'null');
      if (read && read.changes) kept = { changes: read.changes, sent: read.sent || null };
    } catch (e) { /* A phone that keeps nothing: the changes last the visit. */ }
  }

  function remember() {
    try { localStorage.setItem(KEPT, JSON.stringify(kept)); } catch (e) { /* as above */ }
  }

  /* A change laid over the trips: `confirm`, `wrong`, `drop`, `fresh` on a
     trip that is there, and `pin`, which brings its own. The same function
     writes the file on a save and draws the rows before it. */
  function lay(list, id, change) {
    var at = -1;
    list.forEach(function (t, i) { if (t.id === id) at = i; });
    if (change.op === 'pin') {
      if (at < 0) list.push(change.trip);
      return;
    }
    if (at < 0) return;
    var trip = list[at];
    if (change.op === 'drop') {
      list.splice(at, 1);
    } else if (change.op === 'wrong') {
      trip.wrong = change.wrong;
      trip.said = change.on;
      delete trip.confirmed;
      delete trip.fixed;
    } else {
      trip.confirmed = change.on;
      delete trip.wrong;
      delete trip.said;
      delete trip.fixed;
      if (change.op === 'fresh') {
        trip.fresh = true;
        trip.saw = change.saw;
      }
    }
  }

  /* Whether the deployed file already says what a saved change said. */
  function landed(id, change) {
    var trip = (trips || []).filter(function (t) { return t.id === id; })[0];
    if (change.op === 'drop') return !trip;
    if (!trip) return false;
    if (change.op === 'wrong') return trip.wrong === change.wrong;
    if (change.op === 'pin') return true;
    return trip.confirmed === change.on;
  }

  /* The trips as the owner has left them: the file, what was saved and has
     not landed, and what is said and not saved — each trip marked with
     which. */
  function current() {
    var list = JSON.parse(JSON.stringify(trips || []));
    var marks = {};
    [[kept.sent ? kept.sent.changes : {}, 'landing'], [kept.changes, 'unsaved']].forEach(function (pair) {
      Object.keys(pair[0]).forEach(function (id) {
        lay(list, id, pair[0][id]);
        marks[id] = pair[1];
      });
    });
    var gone = [];
    Object.keys(marks).forEach(function (id) {
      var change = kept.changes[id] || (kept.sent && kept.sent.changes[id]);
      if (change.op !== 'drop') return;
      var was = (trips || []).filter(function (t) { return t.id === id; })[0];
      if (was) gone.push(Object.assign({}, was, { dropped: true }));
    });
    return list.concat(gone).map(function (t) { return Object.assign(t, { mark: marks[t.id] || '' }); });
  }

  function change(id, what) {
    if (what) kept.changes[id] = what; else delete kept.changes[id];
    note = null;
    remember();
  }

  /* -------------------------------------------------------------- the map */

  function pin(at, letter, to, moved) {
    var marker = L.marker(at, {
      draggable: !!moved,
      icon: L.divIcon({ className: '', html: '<div class="ways-end' + (to ? ' is-to' : '') + '">' + letter + '</div>', iconSize: [22, 22], iconAnchor: [11, 11] })
    }).addTo(drawn);
    if (moved) marker.on('dragend', function () { moved(round(marker.getLatLng())); });
  }

  /* The ways on the map, the first on top, each with its number; `pinned`
     dashed and dark under them where the two are being told apart. */
  function draw(ways, from, to, pinned, moved) {
    var bounds = [from, to];
    (pinned || []).forEach(function (way) {
      L.polyline(way.line, { color: PINNED, weight: 3, opacity: 0.6, dashArray: '5 7', interactive: false }).addTo(drawn);
      bounds = bounds.concat(way.line);
    });
    ways.slice().reverse().forEach(function (way, k) {
      var i = ways.length - 1 - k;
      L.polyline(way.line, { color: COLOURS[i % COLOURS.length], weight: i ? 4 : 6, opacity: i ? 0.8 : 0.92, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(drawn);
      through(way).forEach(function (door) {
        L.polyline(door.line, { color: '#fff', weight: 2.5, dashArray: '1 6', lineCap: 'round', interactive: false }).addTo(drawn);
      });
      bounds = bounds.concat(way.line);
    });
    ways.forEach(function (way, i) {
      var at = way.line[Math.floor(way.line.length * [0.5, 0.35, 0.65][i % 3])];
      L.marker(at, {
        interactive: false,
        icon: L.divIcon({ className: '', html: '<div class="ways-badge" style="background:' + COLOURS[i % COLOURS.length] + '">' + (i + 1) + '</div>', iconSize: [20, 20], iconAnchor: [10, 10] })
      }).addTo(drawn);
    });
    pin(from, 'A', false, moved && function (at) { moved(at, to); });
    pin(to, 'B', true, moved && function (at) { moved(from, at); });
    map.fitBounds(bounds, { padding: [26, 26], maxZoom: 17 });
  }

  /* ------------------------------------------------------- the panel's parts */

  function say(strong, rest) {
    return el('p', { className: 'ways-say' }, [el('strong', { textContent: strong }), rest ? ' ' + rest : null]);
  }

  function row(name, why, press, danger) {
    var button = el('button', { className: 'menu-row', type: 'button' }, [
      el('span', { className: 'menu-say' }, [
        el('span', { className: 'menu-name' + (danger ? ' is-danger' : ''), textContent: name }),
        el('span', { className: 'menu-why', textContent: why })
      ]),
      el('span', { className: 'menu-go', html: CHEVRON })
    ]);
    button.addEventListener('click', press);
    return el('li', { className: 'menu-item' }, [button]);
  }

  function choices(rows) {
    return el('ul', { className: 'menu ways-choices' }, rows);
  }

  function back(text, press) {
    var button = el('button', { className: 'ways-back', type: 'button', textContent: '‹ ' + text });
    button.addEventListener('click', press);
    return button;
  }

  function rows(ways, dashed) {
    return el('ol', { className: 'ways-rows' }, ways.map(function (way, i) {
      var num = el('span', { className: 'ways-num' + (dashed ? ' is-pinned' : ''), textContent: String(i + 1) });
      if (!dashed) num.style.background = COLOURS[i % COLOURS.length];
      var about = way.streets.filter(function (name, k, all) { return name && name !== all[k - 1]; });
      if (through(way).length) about.push('through a door');
      if (way.ridden) about.push('riders have made the most of it');
      return el('li', { className: 'ways-way' }, [num, el('div', {}, [
        el('div', { className: 'ways-size', textContent: size(way) + ' · ' + way.turns + ' turns' }),
        about.length ? el('div', { className: 'ways-streets', textContent: about.join(' · ') }) : null
      ])]);
    }));
  }

  function state(kind, text) {
    return el('p', { className: 'ways-state' + (kind ? ' is-' + kind : '') }, [el('span', { className: 'ways-dot' }), text]);
  }

  function field(label, value, area) {
    var input = el(area ? 'textarea' : 'input', area ? { rows: '3' } : { type: 'text', autocomplete: 'off' });
    input.value = value || '';
    return { box: el('label', { className: 'ac-field' }, [el('span', { className: 'ac-label', textContent: label }), input]), input: input };
  }

  function panel(kids) {
    var box = el('section', { className: 'ways-panel' }, kids);
    under.appendChild(box);
    return box;
  }

  /* Where a trip stands with the owner, as the dot's kind and its words. */
  function standing(trip) {
    if (trip.dropped) return ['', 'Taken out'];
    if (trip.confirmed) return ['yes', 'Confirmed ' + day(trip.confirmed)];
    if (trip.wrong && trip.fixed) return ['no', 'Changed ' + day(trip.fixed) + ' since you said it was wrong — look again'];
    if (trip.wrong) return ['no', 'Wrong · said ' + day(trip.said)];
    return ['', trip.ways ? 'Not looked at yet' : 'Pinned here, to be recorded when it is saved'];
  }

  /* --------------------------------------------------------------- views */

  function show(next) {
    view = next;
    paint();
  }

  function tried(from, to) {
    show({ kind: 'asking', from: from, to: to });
    ask(from, to).then(function (got) {
      /* Still the same question: the owner may have started again since. */
      if (view.kind !== 'asking' || view.from !== from || view.to !== to) return;
      show({ kind: 'tried', from: from, to: to, ways: got.ways || [], error: got.error || '' });
    });
  }

  function paint() {
    clear(under);
    drawn.clearLayers();
    if (note) under.appendChild(el('p', { className: note.bad ? 'ac-err' : 'ac-note', textContent: note.text }));
    if (view.kind === 'idle') {
      under.appendChild(say('Tap the map where the ride starts.'));
    } else if (view.kind === 'start') {
      pin(view.from, 'A', false, function (at) { show({ kind: 'start', from: at }); });
      under.appendChild(say('Now tap where it ends.', 'The start is set: drag it to move it.'));
      under.appendChild(choices([row('Start again', 'Take the pin off the map', function () { show({ kind: 'idle' }); })]));
    } else if (view.kind === 'asking') {
      pin(view.from, 'A', false);
      pin(view.to, 'B', true);
      map.fitBounds([view.from, view.to], { padding: [60, 60], maxZoom: 16 });
      under.appendChild(say('Asking the bike route…'));
    } else if (view.kind === 'tried') {
      paintTried();
    } else if (view.kind === 'pinning') {
      paintPinning();
    } else if (view.kind === 'trip') {
      paintTrip();
    } else if (view.kind === 'saying') {
      paintSaying();
    }
    paintList();
    paintSave();
  }

  function paintTried() {
    var again = [
      row('Swap the ends', 'The way back is asked for itself', function () { tried(view.to, view.from); }),
      row('Start again', 'Take both pins off the map', function () { show({ kind: 'idle' }); })
    ];
    if (view.error) {
      pin(view.from, 'A', false, function (at) { tried(at, view.to); });
      pin(view.to, 'B', true, function (at) { tried(view.from, at); });
      under.appendChild(el('p', { className: 'ac-err', textContent: refusal(view.error) }));
      under.appendChild(choices(again));
      return;
    }
    draw(view.ways, view.from, view.to, null, tried);
    panel([
      el('p', { className: 'eyebrow', textContent: 'A trip tried' }),
      el('h2', { className: 'ways-name', textContent: view.ways.length === 1 ? '1 way, as a rider is given it now' : view.ways.length + ' ways, as a rider is given them now' }),
      el('p', { className: 'ways-why', textContent: 'The first is the one a rider gets; the others are the buttons beside it. Drag A or B to move an end.' }),
      rows(view.ways),
      choices([row('Pin this trip', 'Hold these ways still, or say what is wrong with them', function () {
        show(Object.assign({}, view, { kind: 'pinning' }));
      })].concat(again))
    ]);
  }

  /* An id out of a name, as the file wants one: lower-case words joined by
     hyphens, and not one a trip already has. */
  function idFor(name) {
    var stem = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'trip';
    var taken = current().map(function (t) { return t.id; });
    var id = stem;
    for (var n = 2; taken.indexOf(id) >= 0; n++) id = stem + '-' + n;
    return id;
  }

  function paintPinning() {
    draw(view.ways, view.from, view.to);
    var name = field('Name', view.name || '');
    var words = field('What is wrong?', view.words || '', true);
    var verdict = view.verdict || 'right';
    var picks = el('div', { className: 'ways-picks', role: 'radiogroup', 'aria-label': 'How the ways look' },
      [['right', 'The ways are right'], ['wrong', 'Something is wrong'], ['later', 'Not decided yet']].map(function (pick) {
        var radio = el('input', { type: 'radio', name: 'ways-verdict', checked: pick[0] === verdict });
        radio.addEventListener('change', function () {
          verdict = pick[0];
          words.box.hidden = verdict !== 'wrong';
        });
        return el('label', { className: 'ways-pick' }, [radio, pick[1]]);
      }));
    words.box.hidden = verdict !== 'wrong';
    var err = el('p', { className: 'ac-err', hidden: true });
    var go = el('button', { className: 'go', type: 'button', textContent: 'Pin it' });
    go.addEventListener('click', function () {
      var called = name.input.value.trim();
      var wrong = words.input.value.trim();
      if (!called || (verdict === 'wrong' && !wrong)) {
        err.textContent = called ? 'Say what is wrong with it, or pick another answer.' : 'Give the trip a name.';
        err.hidden = false;
        return;
      }
      var trip = { id: idFor(called), name: called, from: view.from, to: view.to };
      if (verdict === 'right') trip.confirmed = today();
      if (verdict === 'wrong') { trip.wrong = wrong; trip.said = today(); }
      trip.saw = view.ways.map(function (way) { return [way.meters, way.seconds]; });
      change(trip.id, { op: 'pin', trip: trip });
      /* Kept beside the change so the trip can be drawn before it is saved. */
      seen[trip.id] = view.ways;
      show({ kind: 'trip', id: trip.id });
    });
    panel([
      back('Back to the ways', function () { show(Object.assign({}, view, { kind: 'tried' })); }),
      el('p', { className: 'eyebrow', textContent: 'Pin this trip' }),
      el('h2', { className: 'ways-name', textContent: 'Name it, and say how it looks' }),
      el('p', { className: 'ways-why', textContent: 'A pinned trip is checked on every change to the bike route. Its two points go into the public repository: pin a corner, not a door.' }),
      err,
      el('div', { className: 'ways-form' }, [name.box, picks, words.box]),
      go,
      el('p', { className: 'ways-why', textContent: 'Kept on this phone until you press Save.' })
    ]);
  }

  /* The ways of a trip pinned on this page and not saved yet, by its id:
     they are not in the file, so they are held here for the visit. */
  var seen = {};

  function paintTrip() {
    var trip = current().filter(function (t) { return t.id === view.id; })[0];
    if (!trip) { show({ kind: 'idle' }); return; }
    var ways = trip.ways ? trip.ways.map(fromPin) : (seen[trip.id] || []);
    var live = view.live || {};
    var differs = live.ways && !(live.ways.length === ways.length && live.ways.every(function (now, i) { return same(now, ways[i]); }));
    var lost = differs ? ways.filter(function (was) { return !live.ways.some(function (now) { return same(was, now); }); }) : [];
    var shown = differs ? live.ways : ways;

    if (shown.length) draw(shown, trip.from, trip.to, lost);
    else { pin(trip.from, 'A', false); pin(trip.to, 'B', true); map.fitBounds([trip.from, trip.to], { padding: [60, 60], maxZoom: 16 }); }

    var stands = standing(trip);
    var kids = [
      back('Close this trip', function () { show({ kind: 'idle' }); }),
      el('p', { className: 'eyebrow', textContent: 'Pinned trip' }),
      el('h2', { className: 'ways-name', textContent: trip.name }),
      state(stands[0], stands[1] + (trip.mark === 'unsaved' ? ' · not saved yet' : trip.mark === 'landing' ? ' · saved, landing' : ''))
    ];
    if (trip.wrong) kids.push(el('p', { className: 'ways-quote', textContent: trip.wrong }));
    if (trip.why) kids.push(el('p', { className: 'ways-why', textContent: trip.why + (trip.heading === undefined ? '' : ' Asked heading ' + trip.heading + '°.') }));

    if (live.asking) kids.push(say('Asking the bike route…'));
    if (live.error) kids.push(el('p', { className: 'ac-err', textContent: refusal(live.error) }));
    if (live.ways && !differs) kids.push(el('p', { className: 'ac-note', textContent: 'The live site answers the pinned ways.' }));
    if (differs) {
      kids.push(state('no', 'The live site answers something else now'));
      kids.push(el('p', { className: 'ways-why', textContent: 'Asked a moment ago. The map under the routers moved, or the pin is older than the code that is live. The pin holds the code, not the map.' }));
      kids.push(el('p', { className: 'ways-head', textContent: 'Answered now' }));
    }
    kids.push(rows(shown));
    if (lost.length) {
      kids.push(el('p', { className: 'ways-head', textContent: 'Pinned, and not answered now (dashed)' }));
      kids.push(rows(lost, true));
    }

    var wrongly = function () { show({ kind: 'saying', id: trip.id, words: trip.wrong || '' }); };
    var list = [];
    if (trip.dropped) {
      list.push(row('Put the pin back', 'Go on holding this trip', function () { change(trip.id, null); paint(); }));
    } else if (differs) {
      list.push(row('These are right', 'Pin what is answered now, confirmed today', function () {
        change(trip.id, { op: 'fresh', on: today(), saw: live.ways.map(function (way) { return [way.meters, way.seconds]; }) });
        show({ kind: 'trip', id: trip.id });
      }));
      list.push(row('Something is wrong', 'Say what, for whoever fixes the route next', wrongly));
    } else {
      if (!trip.confirmed && ways.length) {
        list.push(row('The ways are right', trip.wrong ? 'Confirm them as of today, and drop what was said' : 'Confirm them as of today', function () {
          change(trip.id, trip.mark === 'unsaved' && kept.changes[trip.id].op === 'pin'
            ? { op: 'pin', trip: Object.assign({}, kept.changes[trip.id].trip, { confirmed: today(), wrong: undefined, said: undefined }) }
            : { op: 'confirm', on: today() });
          paint();
        }));
      }
      list.push(row(trip.wrong ? 'Say it differently' : 'Something is wrong', trip.wrong ? 'Change what is wrong with it' : 'Say what, for whoever fixes the route next', wrongly));
      if (trip.ways && !live.ways) {
        list.push(row('Ask the route now', 'What the live site answers this minute', function () {
          show({ kind: 'trip', id: trip.id, live: { asking: true } });
          ask(trip.from, trip.to, trip.heading).then(function (got) {
            if (view.kind === 'trip' && view.id === trip.id) show({ kind: 'trip', id: trip.id, live: got });
          });
        }));
      }
      if (trip.mark === 'unsaved') {
        list.push(row('Undo', 'Forget what was said here since the last save', function () {
          change(trip.id, null);
          show(trips && trips.some(function (t) { return t.id === trip.id; }) ? { kind: 'trip', id: trip.id } : { kind: 'idle' });
        }));
      } else {
        list.push(row('Take the pin out', 'Stop holding this trip', function () { change(trip.id, { op: 'drop' }); paint(); }, true));
      }
    }
    kids.push(choices(list));
    panel(kids);
    if (location.hash !== '#' + trip.id) history.replaceState(null, '', '#' + trip.id);
  }

  function paintSaying() {
    var trip = current().filter(function (t) { return t.id === view.id; })[0];
    if (!trip) { show({ kind: 'idle' }); return; }
    var ways = trip.ways ? trip.ways.map(fromPin) : (seen[trip.id] || []);
    if (ways.length) draw(ways, trip.from, trip.to);
    var words = field('What is wrong?', view.words, true);
    var err = el('p', { className: 'ac-err', hidden: true, textContent: 'Say what is wrong with it.' });
    var go = el('button', { className: 'go', type: 'button', textContent: 'Mark it wrong' });
    go.addEventListener('click', function () {
      var wrong = words.input.value.trim();
      if (!wrong) { err.hidden = false; return; }
      var pending = kept.changes[trip.id];
      change(trip.id, pending && pending.op === 'pin'
        ? { op: 'pin', trip: Object.assign({}, pending.trip, { wrong: wrong, said: today(), confirmed: undefined }) }
        : { op: 'wrong', wrong: wrong, on: today() });
      show({ kind: 'trip', id: trip.id });
    });
    panel([
      back('Back to the trip', function () { show({ kind: 'trip', id: trip.id }); }),
      el('p', { className: 'eyebrow', textContent: trip.name }),
      el('h2', { className: 'ways-name', textContent: 'What is wrong?' }),
      el('p', { className: 'ways-why', textContent: 'In your own words. It stays on the trip until the ways are confirmed, and is what the next change to the route is made from.' }),
      err,
      el('div', { className: 'ways-form' }, [words.box]),
      go,
      el('p', { className: 'ways-why', textContent: 'Kept on this phone until you press Save.' })
    ]);
  }

  /* ---------------------------------------------------------------- the list */

  function paintList() {
    var count = document.getElementById('ways-count');
    var box = document.getElementById('ways-list');
    clear(box);
    if (!trips) {
      count.textContent = 'The pinned trips could not be read. Trying a trip still works.';
      return;
    }
    var list = current();
    var rank = function (t) { return t.dropped ? 4 : t.wrong ? (t.fixed ? 0 : 1) : t.confirmed ? 3 : 2; };
    var of = function (n) { return list.filter(function (t) { return rank(t) === n; }).length; };
    count.textContent = list.length - of(4) + ' trips. ' + (of(0) + of(1)) + ' you said are wrong' +
      (of(0) ? ' (' + of(0) + ' changed since, to look at again)' : '') + ', ' + of(2) + ' not looked at yet, ' + of(3) + ' confirmed.';
    list.map(function (t, i) { return [t, i]; })
      .sort(function (a, b) { return rank(a[0]) - rank(b[0]) || a[1] - b[1]; })
      .forEach(function (pair) {
        var trip = pair[0];
        var why = standing(trip)[1] + (trip.wrong ? ': ' + trip.wrong : '') +
          (trip.ways ? ' · ' + size(trip.ways[0]) + (trip.ways.length > 1 ? ' · ' + trip.ways.length + ' ways' : '') : '') +
          (trip.mark === 'unsaved' ? ' · not saved yet' : trip.mark === 'landing' ? ' · saved, landing' : '');
        var item = row(trip.name, why, function () {
          note = null;
          show({ kind: 'trip', id: trip.id });
          document.getElementById('ways-map').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        if (trip.wrong) item.querySelector('.menu-why').className += ' is-wrong';
        box.appendChild(item);
      });
  }

  /* ---------------------------------------------------------------- saving */

  function paintSave() {
    var n = Object.keys(kept.changes).length;
    document.getElementById('ways-save').hidden = !n;
    document.getElementById('ways-unsaved').textContent = n + (n === 1 ? ' change' : ' changes') + ' on this phone, not saved yet.';
  }

  function b64ToText(b64) {
    var raw = atob(String(b64).replace(/\s+/g, ''));
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function gh(path, init) {
    var opts = init || {};
    opts.headers = { 'Content-Type': 'application/json' };
    opts.cache = 'no-store';
    return fetch(API + path, opts).then(function (res) {
      if (res.status === 503) throw new Error('the site has no token to write with');
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (err) {
          throw new Error('GitHub said ' + res.status + (err.message ? ': ' + err.message : ''));
        });
      }
      return res.json();
    }, function () {
      throw new Error('the site could not be reached');
    });
  }

  /* The file as it is kept: format() in tools/routecheck.mjs, which writes
     the same file — one trip a block and one way a line. */
  function format(list) {
    return '[\n' + list.map(function (trip) {
      var lines = KEYS.filter(function (k) { return k !== 'ways' && trip[k] !== undefined; })
        .map(function (k) { return '    ' + JSON.stringify(k) + ': ' + JSON.stringify(trip[k]); });
      if (trip.ways) {
        lines.push('    "ways": [\n' + trip.ways.map(function (w) { return '      ' + JSON.stringify(w); }).join(',\n') + '\n    ]');
      }
      return '  {\n' + lines.join(',\n') + '\n  }';
    }).join(',\n') + '\n]\n';
  }

  /* The commit's words, in the repository's voice: what the owner said of
     which trip. */
  function message(changes, names) {
    var ids = Object.keys(changes);
    var said = ids.map(function (id) {
      var c = changes[id];
      var name = names[id] || id;
      if (c.op === 'drop') return name + ' is taken out.';
      if (c.op === 'wrong') return name + ' is wrong: "' + c.wrong + '"';
      if (c.op === 'fresh') return name + ' is pinned again as the live site answers it, and confirmed.';
      if (c.op === 'confirm') return name + ' is confirmed.';
      return name + ' is pinned' + (c.trip.confirmed ? ', and confirmed.' : c.trip.wrong ? ', and wrong: "' + c.trip.wrong + '"' : '.');
    });
    return 'The owner looks at ' + (ids.length === 1 ? 'a bike trip' : ids.length + ' bike trips') + ' on /admin/ways\n\n' +
      said.join('\n') + '\n\nSaid on the page and written by it. A trip it pinned is recorded, and its\n' +
      'ways pinned, by tools/routecheck.mjs when this lands.';
  }

  /* Every change on the phone as one commit on a branch of its own, which
     the land job puts on the live one — HOW A SAVE IS WRITTEN above. */
  function save() {
    var go = document.getElementById('ways-go');
    var changes = kept.changes;
    var base;
    go.disabled = true;
    go.textContent = 'Saving…';
    gh('').then(function (repo) {
      return gh('/git/ref/heads/' + repo.default_branch);
    }).then(function (ref) {
      base = ref.object.sha;
      return Promise.all([gh('/contents/' + FILE + '?ref=' + base), gh('/git/commits/' + base)]);
    }).then(function (got) {
      var list = JSON.parse(b64ToText(got[0].content));
      var names = {};
      list.forEach(function (t) { names[t.id] = t.name; });
      var tree = [];
      Object.keys(changes).forEach(function (id) {
        var c = changes[id];
        if (c.op === 'pin') {
          if (names[id]) throw new Error('there is already a trip called ' + id);
          names[id] = c.trip.name;
        }
        /* A trip taken out takes its recording with it, or the check fails
           on a recording with no trip. */
        if (c.op === 'drop' && names[id]) tree.push({ path: RECORDINGS + id + '.json.gz', mode: '100644', type: 'blob', sha: null });
        lay(list, id, c);
      });
      tree.push({ path: FILE, mode: '100644', type: 'blob', content: format(list) });
      return gh('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: got[1].tree.sha, tree: tree }) })
        .then(function (made) {
          return gh('/git/commits', { method: 'POST', body: JSON.stringify({ message: message(changes, names), tree: made.sha, parents: [base] }) });
        });
    }).then(function (commit) {
      var stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
      return gh('/git/refs', { method: 'POST', body: JSON.stringify({ ref: 'refs/heads/admin/ways-' + stamp, sha: commit.sha }) });
    }).then(function () {
      kept = { changes: {}, sent: { at: Date.now(), changes: Object.assign({}, kept.sent ? kept.sent.changes : {}, changes) } };
      remember();
      note = { text: 'Saved. The page catches up in a minute or two, once the checks have run.' };
    }, function (err) {
      var n = Object.keys(changes).length;
      note = { bad: true, text: 'Not saved: ' + err.message + '. Your ' + n + (n === 1 ? ' change is' : ' changes are') + ' still on this phone.' };
    }).then(function () {
      go.disabled = false;
      go.textContent = 'Save';
      paint();
      under.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  /* ------------------------------------------------------------------ boot */

  function boot() {
    if (!window.L || !window.TTBBasemap) {
      clear(under);
      under.appendChild(el('p', { className: 'ac-err', textContent: 'The map could not be loaded.' }));
      return;
    }
    recall();
    map = L.map('ways-map', { zoomControl: false }).setView(CENTRE, ZOOM);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    window.TTBBasemap.layer(L, { dark: false }).addTo(map);
    drawn = L.layerGroup().addTo(map);
    map.on('click', function (e) {
      if (view.kind === 'idle') show({ kind: 'start', from: round(e.latlng) });
      else if (view.kind === 'start') tried(view.from, round(e.latlng));
    });
    document.getElementById('ways-go').addEventListener('click', save);

    Promise.all([
      getJson('/' + FILE).catch(function () { return null; }),
      getJson('/data/doors.json').catch(function () { return []; })
    ]).then(function (got) {
      trips = Array.isArray(got[0]) ? got[0] : null;
      doors = (Array.isArray(got[1]) ? got[1] : []).filter(function (d) { return d && Array.isArray(d.line) && d.line.length > 1; });
      /* A save that has landed, or been waited for long enough, is the file's
         to say from here on. */
      if (kept.sent) {
        var waiting = {};
        Object.keys(kept.sent.changes).forEach(function (id) {
          if (!landed(id, kept.sent.changes[id])) waiting[id] = kept.sent.changes[id];
        });
        kept.sent = Object.keys(waiting).length && Date.now() - kept.sent.at < LANDING ? { at: kept.sent.at, changes: waiting } : null;
        remember();
      }
      var asked = location.hash.slice(1);
      show(asked && current().some(function (t) { return t.id === asked; }) ? { kind: 'trip', id: asked } : { kind: 'idle' });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
