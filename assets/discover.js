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
 * FOUR SHELVES, IN THIS ORDER
 *
 *   New lists            newest public lists                 /api/discover
 *   Most opened places   what gets opened on the map         /api/discover
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
 * No counts and no scores on anything. The order of a shelf says what it
 * says; functions/api/discover.js is why the numbers never arrive.
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
     print it, at the zoom the full map opens near, so the name of the city is
     in the middle of the picture and the streets round it can be read. Both
     were measured off a screenshot of the map itself — the pins on it fix
     the zoom and where the label sits. A place outside the window is simply
     not on the picture; the map is one press away and has all of them. */
  var SKY = { at: [59.4371, 24.7576], zoom: 13.68 };

  var o = null;
  var node = null;
  var shelves = null;
  /* null while the route has not answered, false when it failed. */
  var data = null;
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
     colour until the streets arrive under them. The credit stays on: it is
     the tiles' licence condition, and the full map's own is out of sight
     while this page is up. */
  function sky() {
    var box = document.getElementById('discover-sky');
    if (!box || !window.L || !up()) return;
    if (!still) {
      still = L.map(box, {
        center: SKY.at,
        zoom: SKY.zoom,
        zoomSnap: 0,
        zoomControl: false,
        dragging: false,
        touchZoom: false,
        doubleClickZoom: false,
        scrollWheelZoom: false,
        boxZoom: false,
        keyboard: false,
        tap: false,
        fadeAnimation: false
      });
      still.attributionControl.setPrefix(false);
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
    var say = document.getElementById('discover-map-say');
    if (say) say.textContent = o.t('discoverMapSay', { n: open(o.places()).length });
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
     The whole of the map's card is the way to the map, and the button on it
     is the control that says so to a keyboard. The two links in the credit
     are the one thing on it that goes somewhere else. */
  function mount(opts) {
    o = opts;
    node = opts.node;
    shelves = document.getElementById('discover-shelves');
    var card = document.getElementById('discover-map');
    if (card) {
      card.addEventListener('click', function (ev) {
        if (ev.target.closest && ev.target.closest('a')) return;
        TTBTrack.event('discover_map');
        o.onMap();
      });
    }
    return { show: show, hide: hide, up: up, draw: draw };
  }

  return { mount: mount };
}());
