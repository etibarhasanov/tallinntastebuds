/* Tallinn Tastebuds — Discover, the front page a phone opens on.
 *
 * window.TTBDiscover.mount(opts) draws the shelves under the map's own card in
 * #discover, and answers { show, hide, up, draw }. The map's script mounts it
 * and decides when it is up — mountDiscover() in assets/app.js, which is also
 * where the reasons for when live. This file only knows what is on the page.
 *
 * WHY THERE IS A PAGE IN FRONT OF THE MAP
 *
 * The map was the whole of the front door, and to somebody who has never been
 * here a map of unlabelled marks is a question rather than an answer: which
 * of these, and why. Lists answer it — ten places with a title somebody stood
 * behind — and so does knowing what everybody else looks at. So a phone opens
 * on those, with the map as the first and biggest thing on the page, one press
 * away and already drawn underneath.
 *
 * FOUR SHELVES AND A CARD, IN THIS ORDER
 *
 *   New lists            newest public lists                 /api/discover
 *   Most opened places   what gets opened on the map         /api/discover
 *   Play                 the game, and routes to swipe       /api/discover
 *   Popular lists        most opened lists                   /api/discover
 *   New on the map       the places added last               data/map.json
 *
 * Three of them wait on the one route and the fourth on nothing, which is why
 * the page is never empty: the map's card is in the markup, the last shelf is
 * drawn from the file the map already holds, and the other three arrive. A
 * shelf with fewer than MIN things on it is left out rather than drawn thin,
 * and a route that does not answer costs the three shelves and one sentence
 * saying so — "nothing in assets/ waits on /api/*" holds here too.
 *
 * No counts and no scores on a list or a place. The order of a shelf says
 * what it says; functions/api/discover.js is why the numbers never arrive.
 * The Play card is the one thing here that prints a number, and it is about
 * the people who went round a list — how many finished and how fast — which
 * is the board the list's own page already shows.
 *
 * WHY A FILE OF ITS OWN, AND A GLOBAL
 *
 * assets/app.js is the map, and this is a page that stands in front of it.
 * It reads nothing of the map's state but what mount() is handed — the words,
 * the places, how a month is said — so it can be read whole, which nothing
 * inside thirteen thousand lines can.
 */
window.TTBDiscover = (function () {
  'use strict';

  /* Fewer than this and a shelf is not drawn. */
  var MIN = 3;
  /* How many cards a shelf of places carries. */
  var PLACES = 8;

  /* Where the card's still map stands: on the word TALLINN as the tiles
     print it, so the name of the city is in the middle of the picture. That
     point was measured off a screenshot of the map itself, where the pins fix
     where the label sits. The zoom is a whole level, a little further out
     than the full map opens at: the first one stood at 13.68 and the owner
     asked for more of the city on the card. A place outside the window is
     simply not on the picture; the map is one press away and has all of
     them. */
  var SKY = { at: [59.4371, 24.7576], zoom: 13 };

  var o = null;
  var node = null;
  var shelves = null;
  /* null while the route has not answered, false when it failed. */
  var data = null;
  /* The reader's own walks that are still going, the one last moved first:
     empty with nobody signed in, nothing going, or not answered yet. See
     signed(). */
  var mine = [];
  /* Whether the Play card has been swiped past its first route on this load,
     which is reported once — see play(). */
  var swiped = false;
  var scrolled = 0;
  /* The card's still map, its tiles, whether those are the dark ones, and
     the pins on it. Null until the card has been on screen once. */
  var still = null;
  var stillTiles = null;
  var stillDark = false;
  var stillPins = [];

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function heading(key, href, track) {
    var head = el('div', 'discover-head');
    head.appendChild(el('h2', '', o.t(key)));
    if (href) {
      var all = el('a', 'discover-all', o.t('discoverSeeAll'));
      all.href = href;
      TTBTrack.click(all, track);
      head.appendChild(all);
    }
    return head;
  }

  function listCard(list) {
    var a = el('a', 'discover-list');
    a.href = '/list/' + encodeURIComponent(list.id);
    TTBTrack.click(a, 'discover_list');
    a.appendChild(el('span', 'discover-emblem', TTBPins.glyph(TTBPins.ofList(list))));
    a.appendChild(el('b', '', list.title));
    if (list.by) {
      /* The same byline the other four pages print, through the same swap:
         the account Google's numbers write under is printed under a name, not
         under its username — see who() in assets/googlewords.js. This card
         used to put the raw `google-statistics` into the phrase. */
      a.appendChild(el('span', 'discover-by',
        o.t('listsBy', { name: TTBGoogleWords.who(list.by) })));
    }
    if (list.taste && list.taste.length) {
      a.appendChild(el('span', 'discover-taste', list.taste.join(' · ')));
    }
    return a;
  }

  function listShelf(key, rows, href, track) {
    if (!rows || rows.length < MIN) return null;
    /* Google's six are English in the database; said here in the language. */
    TTBGoogleWords.lists(rows, o.t, o.lang());
    var box = el('section', 'discover-shelf');
    box.appendChild(heading(key, href, track));
    var row = el('div', 'discover-row');
    rows.forEach(function (list) { row.appendChild(listCard(list)); });
    box.appendChild(row);
    return box;
  }

  /* A place as a card: its first photograph, or the mark where it has none —
     a place is on the map before anybody has photographed it. `rank` is its
     place on the shelf where the shelf is an order, and absent where it is
     not. */
  function placeCard(place, line, rank) {
    var b = el('button', 'discover-place');
    b.type = 'button';
    var photo = el('span', 'discover-photo');
    var img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    if (place.photos && place.photos.length) {
      img.src = 'photos/' + place.id + '/' + place.photos[0];
    } else {
      img.src = 'assets/logo/mark-round.webp';
      photo.className += ' is-bare';
    }
    photo.appendChild(img);
    if (rank) photo.appendChild(el('span', 'discover-rank', String(rank)));
    b.appendChild(photo);
    b.appendChild(el('b', '', place.name));
    if (line) b.appendChild(el('span', 'discover-line', line));
    b.addEventListener('click', function () {
      TTBTrack.event('discover_place');
      o.onPlace(place.id);
    });
    return b;
  }

  function placeShelf(key, why, places, lineOf, ranked) {
    if (places.length < MIN) return null;
    var box = el('section', 'discover-shelf');
    box.appendChild(heading(key));
    if (why) box.appendChild(el('p', 'discover-why', o.t(why)));
    var row = el('div', 'discover-row');
    places.slice(0, PLACES).forEach(function (place, i) {
      row.appendChild(placeCard(place, lineOf(place), ranked ? i + 1 : 0));
    });
    box.appendChild(row);
    return box;
  }

  function open(places) {
    return places.filter(function (p) { return !p.closed; });
  }

  /* The street and the number, which is what an address is before its comma. */
  function street(place) {
    return String(place.address || '').split(',')[0];
  }

  function added(place) {
    return o.month(String(place.added || '').slice(0, 7));
  }

  function mostOpened() {
    var byId = {};
    open(o.places()).forEach(function (p) { byId[p.id] = p; });
    return (data.opened || []).map(function (id) { return byId[id]; })
      .filter(function (p) { return !!p; });
  }

  function newest() {
    return open(o.places())
      .filter(function (p) { return !!p.added; })
      .sort(function (a, b) { return a.added < b.added ? 1 : a.added > b.added ? -1 : 0; });
  }

  /* How long a walk took: minutes and hours inside a day, days and hours past
     one, in the list page's own words. took() in assets/walk.js is the first
     copy and is private to that page's script; this is the second, and a
     third reader is the day it becomes a global. */
  function took(ms) {
    var days = Math.floor(ms / 86400000);
    if (days < 1) {
      var n = Math.max(1, Math.round(ms / 60000));
      return n < 60 ? o.t('walkMin', { n: n }) : o.t('walkHours', { h: Math.floor(n / 60), m: n % 60 });
    }
    var hours = Math.floor(ms % 86400000 / 3600000);
    var said = days === 1 ? o.t('walkDayOne') : o.t('walkDays', { n: days });
    return hours ? said + ' ' + o.t('walkHoursOnly', { h: hours }) : said;
  }

  /* How the fastest went round, as the board says it — MODE_WORDS in
     assets/walk.js. A mode not here is one nobody said, and gets no word. */
  var WENT = { foot: 'walkFoot', bike: 'walkBike', car: 'walkCar', mixed: 'walkMixed' };

  /* PLAY: THE GAME, SAID ONCE, WITH ROUTES TO SWIPE THROUGH
   *
   * Every list can be walked — go to each place, check in at the door, on
   * foot, by bike or both, and finish onto the list's board — and the only sign of
   * it was a chip called Route on a list's own page. Four shelves of things
   * to read said nothing about there being something to do. So the page says
   * it once, in a card of its own between the places people open and the
   * lists they open: what the game is in a sentence, and routes under it.
   *
   * One route shows at a time, with the edge of the next one under the
   * card's right side, and a swipe sideways moves to it — the owner's ask of
   * 2026-11-13, so that the card is a way to find a list to go round and not
   * only the one /api/discover happened to pick. The words above the rule
   * stay put; only the row under it moves. The dots under the row say how
   * many there are and which is showing, and are buttons, so a mouse and a
   * keyboard get there too.
   *
   * The deck is the reader's own walks still going first — their list, how
   * far round they are, and Keep going — the one they last moved on leading,
   * and then the routes /api/discover offers everybody: the lists most people
   * have finished, with the fastest time, and then lists to be the first on.
   * A list that is in both is the reader's own. Each row is a link to that
   * list's Route view, which is where a walk is started and where signing in
   * is asked for; nothing here starts one. One route and there is nothing to
   * swipe, so the card is drawn as it was before there were several.
   *
   * No route to offer — the answer had none, or it is an old answer from
   * before the field — and the card is not drawn.
   */
  function deck() {
    var seen = {};
    var out = [];
    var theirs = data.routes || (data.route ? [data.route] : []);
    mine.map(function (walk) { return { route: walk, going: true }; })
      .concat(theirs.map(function (route) { return { route: route, going: false }; }))
      .forEach(function (one) {
        if (!one.route || !one.route.id || seen[one.route.id]) return;
        seen[one.route.id] = true;
        out.push(one);
      });
    return out;
  }

  function routeRow(route, going) {
    TTBGoogleWords.list(route, o.t, o.lang());
    var line;
    var press;
    if (going) {
      line = o.t('walkToGo', { n: route.checked, total: route.total, left: route.total - route.checked });
      press = o.t('discoverPlayKeep');
    } else {
      var parts = [route.places === 1 ? o.t('listCountOne') : o.t('listCount', { n: route.places })];
      if (route.finished && route.best) {
        parts.push(o.t('discoverPlayDone', { n: route.finished }),
          o.t('discoverPlayBest', { took: took(route.best) }),
          WENT[route.mode] ? o.t(WENT[route.mode]) : null);
        parts = parts.filter(Boolean);
        press = o.t('walkStart');
      } else {
        parts.push(o.t('discoverPlayNobody'));
        press = o.t('discoverPlayFirst');
      }
      line = parts.join(' · ');
    }

    var row = el('a', 'discover-route');
    row.href = '/list/' + encodeURIComponent(route.id) + '?walk=1';
    TTBTrack.click(row, 'discover_play');
    row.appendChild(el('span', 'discover-route-mark', TTBPins.glyph(TTBPins.ofList(route))));
    var say = el('span', 'discover-route-say');
    say.appendChild(el('b', '', route.title));
    say.appendChild(el('span', '', line));
    if (going && route.total) {
      var bar = el('span', 'discover-route-bar');
      var done = el('i');
      done.style.width = Math.round(route.checked / route.total * 100) + '%';
      bar.appendChild(done);
      say.appendChild(bar);
    }
    row.appendChild(say);
    row.appendChild(el('span', 'discover-route-go', press));
    return row;
  }

  function play() {
    var routes = deck();
    if (!routes.length) return null;

    var box = el('section', 'discover-play');
    box.appendChild(el('span', 'eyebrow', o.t('discoverPlayEyebrow')));
    box.appendChild(el('h2', '', o.t('discoverPlayTitle')));
    box.appendChild(el('p', '', o.t('discoverPlaySay')));

    if (routes.length === 1) {
      box.appendChild(routeRow(routes[0].route, routes[0].going));
      return box;
    }

    var track = el('div', 'discover-track');
    var dots = el('div', 'discover-dots');
    routes.forEach(function (one, i) {
      track.appendChild(routeRow(one.route, one.going));
      var dot = el('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', o.t('discoverPlayDot', { n: i + 1, total: routes.length }));
      dot.addEventListener('click', function () {
        var to = track.children[i];
        track.scrollTo({ left: to.offsetLeft - track.children[0].offsetLeft, behavior: 'smooth' });
      });
      dots.appendChild(dot);
    });

    /* Which dot is filled follows the row nearest the start of the track,
       however it got there. The first time it is not the first row is
       reported once a load: whether anybody looks past the first route is
       the question the swipe was built to answer. */
    function at() {
      var step = track.children[1].offsetLeft - track.children[0].offsetLeft;
      var i = Math.round(track.scrollLeft / step);
      for (var k = 0; k < dots.children.length; k++) {
        dots.children[k].className = k === i ? 'is-on' : '';
        if (k === i) dots.children[k].setAttribute('aria-current', 'true');
        else dots.children[k].removeAttribute('aria-current');
      }
      if (i > 0 && !swiped) {
        swiped = true;
        TTBTrack.event('discover_play_more');
      }
    }
    track.addEventListener('scroll', at, { passive: true });
    box.appendChild(track);
    box.appendChild(dots);
    dots.children[0].className = 'is-on';
    dots.children[0].setAttribute('aria-current', 'true');
    return box;
  }

  /* Two blank cards under a title, while the route is out. */
  function waiting(key) {
    var box = el('section', 'discover-shelf');
    box.appendChild(heading(key));
    var row = el('div', 'discover-row');
    row.setAttribute('aria-hidden', 'true');
    row.appendChild(el('span', 'discover-list is-waiting'));
    row.appendChild(el('span', 'discover-list is-waiting'));
    box.appendChild(row);
    return box;
  }

  function down() {
    var note = el('div', 'discover-note');
    note.appendChild(el('p', '', o.t('discoverDown')));
    var again = el('button', 'alt', o.t('discoverRetry'));
    again.type = 'button';
    again.addEventListener('click', function () {
      data = null;
      draw();
      load();
    });
    note.appendChild(again);
    return note;
  }

  /* THE CARD'S PICTURE IS THE MAP. It used to be a drawing: a shoreline and
     three roads that were nobody's, with a dot for each place over them, and
     it read as a map of somewhere else — a place in the drawn sea, a road
     that is not there. So it is the real thing now, small and still: the
     map's own tiles in the palette that is up, its own pins, its own counted
     discs, all handed over by mountDiscover() so that nothing here is a
     second opinion about what a pin looks like.

     Still means no drag, no zoom and no keyboard: the whole card is one
     button to the map, and a picture that panned under a thumb on its way
     down the page would be a second map to get lost in. The pins take no
     pointer for the same reason.

     Made on the first draw with the card on screen, because Leaflet measures
     its box and a hidden one measures nought. The pins do not wait for the
     tiles, so on a slow line the picture is the places on the card's own
     colour until the streets arrive under them.

     No credit on it, which is the owner's decision: the strip covered a
     corner of a picture this small, and the full map this card opens carries
     the OpenStreetMap and CARTO line as it always has. */
  function sky() {
    var box = document.getElementById('discover-sky');
    if (!box || !window.L || !up()) return;
    if (!still) {
      still = L.map(box, {
        center: SKY.at,
        zoom: SKY.zoom,
        zoomSnap: 0,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        touchZoom: false,
        doubleClickZoom: false,
        scrollWheelZoom: false,
        boxZoom: false,
        keyboard: false,
        tap: false,
        fadeAnimation: false
      });
    }
    still.invalidateSize();
    if (!stillTiles || stillDark !== o.dark()) {
      if (stillTiles) still.removeLayer(stillTiles);
      stillDark = o.dark();
      stillTiles = o.tiles();
      stillTiles.addTo(still);
    }
    stillPins.forEach(function (pin) { still.removeLayer(pin); });
    stillPins = o.groups(still, open(o.places())).map(function (group) {
      var lat = 0;
      var lng = 0;
      group.forEach(function (m) { lat += m.place.lat; lng += m.place.lng; });
      var one = group.length === 1;
      var pin = L.marker([lat / group.length, lng / group.length], {
        icon: one ? o.pin() : o.cluster(group.length),
        interactive: false,
        keyboard: false,
        zIndexOffset: one ? 0 : -100
      }).addTo(still);
      if (one) o.wear(pin.getElement(), group[0].place);
      return pin;
    });
  }

  /* Everything under the map's card, from whatever is known right now. Called
     again when the route answers and when the language changes. */
  function draw() {
    sky();

    shelves.textContent = '';
    var parts = [];
    if (data === null) {
      parts.push(waiting('discoverNewLists'), waiting('discoverPopularLists'));
    } else if (data === false) {
      parts.push(down());
    } else {
      parts.push(
        listShelf('discoverNewLists', data.fresh, '/lists?sort=new', 'discover_all'),
        placeShelf('discoverOpened', 'discoverOpenedSay', mostOpened(), street, true),
        play(),
        listShelf('discoverPopularLists', data.popular, '/lists', 'discover_all')
      );
    }
    parts.push(placeShelf('discoverAdded', '', newest(), added, false));
    parts.forEach(function (part) { if (part) shelves.appendChild(part); });
  }

  function load() {
    fetch('/api/discover', { credentials: 'same-origin' }).then(function (res) {
      if (!res.ok) throw new Error('discover: HTTP ' + res.status);
      return res.json();
    }).then(function (answer) {
      data = answer || {};
    }).catch(function () {
      data = false;
    }).then(draw);
  }

  /* Whether somebody is signed in, told by the map each time /api/account
     answers — on the way in, and again whenever a page over the map closes,
     which is when a walk may have moved. Signed in, the walks they have going
     are asked for and lead the Play card; signed out, or with the route not
     answering, the card is the one everybody gets. */
  function signed(yes) {
    if (!yes) {
      if (mine.length) { mine = []; if (up()) draw(); }
      return;
    }
    fetch('/api/walk?mine=1', { credentials: 'same-origin' }).then(function (res) {
      return res.ok ? res.json() : null;
    }).then(function (answer) {
      mine = (answer && (answer.walks || (answer.mine ? [answer.mine] : []))) || [];
    }).catch(function () {
      mine = [];
    }).then(function () {
      if (up() && data) draw();
    });
  }

  function up() {
    return !!node && !node.hidden;
  }

  function show() {
    if (up()) return;
    node.hidden = false;
    /* Where it was read to: an element taken off the screen forgets. */
    node.scrollTop = scrolled;
    document.body.classList.add('is-discover');
    if (data === null || data === false) {
      data = null;
      draw();
      load();
    } else {
      /* The card's map measures its box, and the box may have changed while
         the page was away. */
      sky();
    }
  }

  function hide() {
    if (!up()) return;
    scrolled = node.scrollTop;
    node.hidden = true;
    document.body.classList.remove('is-discover');
  }

  /* opts: node (#discover), t, lang(), places(), month(ym), onMap(),
     onPlace(id), and the map's own parts for the card's still map — tiles(),
     dark(), groups(map, places), cluster(count), pin(), wear(node, place).
     The whole of the map's card is the way to the map, and the Open map on
     its corner is the control that says so to a keyboard. */
  function mount(opts) {
    o = opts;
    node = opts.node;
    shelves = document.getElementById('discover-shelves');
    var card = document.getElementById('discover-map');
    if (card) {
      card.addEventListener('click', function () {
        TTBTrack.event('discover_map');
        o.onMap();
      });
    }
    return { show: show, hide: hide, up: up, draw: draw, signed: signed };
  }

  return { mount: mount };
}());
