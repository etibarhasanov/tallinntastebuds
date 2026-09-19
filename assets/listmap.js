/* Tallinn Tastebuds — the map under the lists, on a desk.
 *
 * /lists, /u/<name> and /list/<id> are one page with three depths, and above
 * 860px that page is a map: the city under the whole window, everybody's
 * lists on it as pins, and the column down the right-hand side saying which.
 * This file is the map half of it. assets/lists.js is the column, and it is
 * the only thing that calls in here.
 *
 * WHY IT IS A FILE OF ITS OWN
 *
 * assets/lists.js is four thousand lines and is about lists — making one,
 * filling it, dragging a row, the picker, the mark that says what is saved.
 * None of that wants Leaflet in front of it. So the map is here, behind one
 * small surface — mount, clouds, places, light, open — and lists.js says what
 * to draw rather than how. The two halves can be read separately, which is
 * the whole reason for the split.
 *
 * WHY A GLOBAL AND NOT A MODULE
 *
 * The same reason as assets/basemap.js, assets/pins.js and assets/track.js:
 * no build step, no bundler, `file://` has to work, and a classic script that
 * sets one global needs neither. Load it before assets/lists.js — both are
 * `defer`, so document order is execution order.
 *
 * ABOVE 860px AND NOWHERE ELSE
 *
 * wide() is the whole of that decision and every other function here is a
 * no-op while it is false. A phone gets the page exactly as it was — a column
 * of cards, each with its little sky of the city — because a 360px column
 * over a 390px map is a map you cannot see and a list you cannot read. The
 * phone layout is a decision that has not been made yet rather than one this
 * file is quietly making. See **Everybody's lists is a map on a desk** in
 * README.md.
 *
 * NOTHING IN HERE IS THE ACCESSIBLE VERSION OF ANYTHING
 *
 * The map is aria-hidden and its markers take no keyboard. Every place and
 * every list it draws is also a row in the column beside it, with its name,
 * its street and what somebody said about it — that is the readable copy, and
 * it is the one that is announced, tabbed to and searched. A pin is a second
 * way to reach a row for somebody using a mouse, which is what the whole
 * layout is for.
 *
 * LEAFLET'S STYLESHEET LANDS AFTER OURS
 *
 * It is fetched at runtime rather than sitting in the head of lists.html, so
 * unlike on index.html it arrives after assets/styles.css and beats it at
 * equal specificity. One rule of Leaflet's would otherwise take every pin on
 * this page off the screen: .leaflet-marker-icon is display:block, which stops
 * .pin-face being a grid item and so leaves it with no width at all. It is
 * answered at a higher weight in assets/lists.css — see "the map, on a desk"
 * in that file.
 */
window.TTBListMap = (function () {
  'use strict';

  /* The width the page becomes a map at. It is the map's own number —
     .lists-body.is-mapped in assets/lists.css answers the same query, and
     assets/app.js has called everything above it a desk since the panel
     became a column. A third breakpoint would be a third thing to remember
     and this page needs no opinion the rest of the site has not already had. */
  var WIDE = '(min-width: 860px)';

  /* Leaflet, off the same CDN and under the same integrity hashes
     index.html uses, so a browser that has been to the map already has it in
     cache. It is fetched here rather than in the head of lists.html because
     everybody reading a list on a phone gets none of it. */
  var LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  var LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  var LEAFLET_JS_HASH = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
  var LEAFLET_CSS_HASH = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';

  /* Where the map stands before it has been told anything: the middle of
     Tallinn, at the zoom the city fits in. Same pair as CITY in
     assets/lists.js, which the "add a place" picker drops its first pin at. */
  var CITY = [59.437, 24.7536];
  var CITY_ZOOM = 12;

  /* How much air a fitted view leaves round the outermost pin, in pixels.
     Enough that a pin on the edge of a list is a whole pin with its label
     under it rather than half of one against the window. */
  var AIR = 64;

  /* The longest list that gets its places named on the map. Ten labels over
     ten pins is the picture somebody came for — where these are, and which is
     which — and it is what a top ten is. Fifty is a wall of overlapping text
     that hides the city it is drawn on, and Leaflet does not move a label out
     of another label's way. Past this the names are in the column, where they
     were always the readable copy; the one place that is open keeps its label
     however long the list is, because that one has been asked for. */
  var NAMED = 12;

  var leafletPromise = null;
  var map = null;
  var layer = null;
  var mapPromise = null;

  /* Every marker currently on the map, filed under what it stands for: the
     list's id for a cloud, the place's id for a row on an open list. light()
     and open() dress what is already drawn rather than building it again: a
     pointer moving down twenty rows would otherwise rebuild two hundred
     markers twenty times. */
  var byKey = {};
  var litKey = '';
  var openKey = '';

  /* What the columns cover, in pixels off the right-hand edge. A fit that
     ignored them would put half a list under the card that names it. lists.js
     sets it as columns open and close — see reserve(). */
  var covered = 0;

  function wide() {
    return !!(window.matchMedia && window.matchMedia(WIDE).matches);
  }

  /* One <script> and one <link>, once, however many things ask for them.
     A failure is remembered as a failure only until the next ask: one flaky
     request on a CDN is not a broken page, and the page works without a map
     at all — the lists are the page and they are already drawn. */
  function leaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;

    leafletPromise = new Promise(function (resolve, reject) {
      if (!document.querySelector('link[data-leaflet]')) {
        var css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = LEAFLET_CSS;
        css.integrity = LEAFLET_CSS_HASH;
        css.crossOrigin = 'anonymous';
        css.setAttribute('data-leaflet', '');
        document.head.appendChild(css);
      }
      var js = document.createElement('script');
      js.src = LEAFLET_JS;
      js.integrity = LEAFLET_JS_HASH;
      js.crossOrigin = 'anonymous';
      js.onload = function () { resolve(window.L); };
      js.onerror = function () { reject(new Error('leaflet')); };
      document.head.appendChild(js);
    }).catch(function (err) {
      leafletPromise = null;
      throw err;
    });
    return leafletPromise;
  }

  /* The map itself, once. Answers null rather than throwing when Leaflet does
     not arrive, so every caller can carry on drawing the column. */
  function mount(node) {
    if (!wide() || !node) return Promise.resolve(null);
    if (mapPromise) {
      return mapPromise.then(function (m) {
        /* Leaflet measures its container once. Between one draw and the next
           the window may have crossed the breakpoint and come back, which
           takes the container through display:none and leaves Leaflet holding
           a size from before. It compares before it acts, so asking on every
           draw costs nothing when nothing has moved. */
        if (m) m.invalidateSize({ animate: false });
        return m;
      });
    }

    mapPromise = leaflet().then(function (L) {
      map = L.map(node, {
        center: CITY,
        zoom: CITY_ZOOM,
        /* No zoom buttons, the same as the map on index.html: a wheel, a
           trackpad and a double-click all zoom already, and two circles of
           chrome on the one corner the columns leave clear would be spent on
           a gesture nobody is short of. */
        zoomControl: false
      });
      /* OpenStreetMap's and CARTO's credit is a condition of the tiles rather
         than a decoration, so it goes in the one corner nothing covers. The
         columns are down the right-hand side, where Leaflet puts it. */
      map.attributionControl.setPosition('bottomleft');
      map.attributionControl.setPrefix('<a href="https://leafletjs.com/">Leaflet</a>');
      TTBBasemap.layer(L, {
        maxZoom: 19,
        dark: document.documentElement.getAttribute('data-style') === 'green'
      }).addTo(map);
      layer = L.layerGroup().addTo(map);
      return map;
    }).catch(function (err) {
      mapPromise = null;
      if (window.console && console.warn) console.warn(err);
      return null;
    });
    return mapPromise;
  }

  /* How much of the map's right-hand side is under a column. Set by lists.js
     as a place opens and closes, and read by every fit after it. */
  function reserve(px) { covered = px || 0; }

  /* Fit a set of points into the part of the map nothing is standing on.
     paddingBottomRight is what carries the columns: without it the middle of
     a fitted list sits behind the card that names it, which is the one thing
     a map beside a list must not do.

     It never animates, and that is not an oversight. A fit happens when what
     the page is about has changed — a different list, a different person — and
     flying between two subjects is a journey the reader did not make. The pan
     in open() is the opposite case and does animate. */
  function fit(points) {
    if (!map || !points.length) return;
    var L = window.L;
    map.fitBounds(L.latLngBounds(points), {
      paddingTopLeft: [AIR, AIR + 40],
      paddingBottomRight: [AIR + covered, AIR],
      animate: false,
      /* A list of three cafés on one street would otherwise fit to the
         rooftops. Seventeen is close enough to read the doors from. */
      maxZoom: 17
    });
  }

  /* One pin. The icon box is a fingertip square whatever is in it, so the
     anchor never moves when the face grows; how big the face is inside it is
     --pin-d and --pin-scale, which the stylesheet sets, because the
     stylesheet owns every measurement that is also a colour decision. See
     .lists-city in assets/lists.css and .pin-face in assets/styles.css.

     keyboard: false on every one of them. A pin is not the accessible copy of
     anything here — see the head of this file. */
  function marker(L, lat, lng, pin, extra) {
    var isMark = pin === 'mark';
    return L.marker([lat, lng], {
      keyboard: false,
      icon: L.divIcon({
        className: 'pin-mark' + (extra ? ' ' + extra : '') +
          (isMark ? ' is-mark is-reel' : ' is-glyph pin-tone-' + TTBPins.toneOf(pin)),
        html: '<span class="pin-face">' + (isMark ? '' : TTBPins.glyph(pin)) + '</span>',
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      })
    });
  }

  /* Every marker under one key, dressed or undressed in one pass. Leaflet
     hands back the icon element a marker is currently drawn as, or null while
     it is off screen, which is why this asks each time rather than holding
     the nodes. */
  function wear(key, className, on) {
    var marks = byKey[key] || [];
    for (var i = 0; i < marks.length; i++) {
      var node = marks[i].getElement();
      if (node) node.classList.toggle(className, on);
    }
  }

  /* -------------------------------------------------------------- the city
   *
   * /lists and /u/<name>: every list on the page at once, each wearing the
   * mark its owner picked, all of them quiet. It is the picture only this
   * site can draw — a page of flames in Kalamaja and balloons out east —
   * and it is what the little sky panel on each card was standing in for
   * while this page had no map.
   *
   * A row carries ten of its places and not all fifty: that is DOTS in
   * functions/api/_mostkept.js, and it is the same ten the sky panels drew.
   * The whole list arrives the moment somebody presses it.
   */
  function clouds(lists, onPress) {
    if (!map || !layer) return;
    var L = window.L;
    layer.clearLayers();
    byKey = {};
    litKey = '';
    openKey = '';

    var all = [];
    (lists || []).forEach(function (l) {
      if (!l.dots || !l.dots.length) return;
      var pin = TTBPins.ofList(l);
      byKey[l.id] = l.dots.map(function (d) {
        all.push(d);
        var m = marker(L, d[0], d[1], pin, 'is-quiet');
        if (onPress) m.on('click', function () { onPress(l); });
        m.addTo(layer);
        return m;
      });
    });
    if (all.length) fit(all);
  }

  /* Lift one list out of the scatter. Nothing moves: a map that re-fitted
     under a pointer running down twenty rows would be seasick, and the
     question this answers is "where is that one" rather than "show me it". */
  function light(id) {
    if (!map) return;
    if (litKey === id) return;
    if (litKey) wear(litKey, 'is-lit', false);
    litKey = id || '';
    if (litKey) wear(litKey, 'is-lit', true);
  }

  /* --------------------------------------------------------------- one list
   *
   * /list/<id>: the places on it, fitted. A place on my map keeps the mouth
   * even on somebody else's list, because being on the map is the verdict and
   * a list is not a way around it; everything else wears the list's own mark,
   * so ten pins read as one person's ten. See "The pins" in README.md.
   *
   * A row the catalogue has no coordinates for is not here at all. There is
   * nowhere to put a pin, and a pin that answers to no row is worse than its
   * absence — the row is still in the column with its sentence, which is where
   * it can be read. seatList() in assets/app.js keeps the same rule.
   */
  function places(items, pin, onPress) {
    if (!map || !layer) return;
    var L = window.L;
    layer.clearLayers();
    byKey = {};
    litKey = '';
    openKey = '';

    var seated = (items || []).filter(function (it) {
      return typeof it.lat === 'number' && typeof it.lng === 'number';
    });
    var named = seated.length <= NAMED;

    seated.forEach(function (it) {
      var m = marker(L, it.lat, it.lng, it.map ? 'mark' : pin);
      /* Kept on the marker so open() can name a place on a list that was too
         long for every name to be drawn — see NAMED. */
      m.ttbName = it.name;
      if (named) label(m, it.name);
      if (onPress) m.on('click', function () { onPress(it); });
      m.addTo(layer);
      byKey[it.place] = [m];
    });
    fit(seated.map(function (it) { return [it.lat, it.lng]; }));
  }

  /* The name under a pin. A tooltip rather than a second marker, so Leaflet
     keeps it under the pointer's reach and off the tab order, and permanent
     because a name you have to hover for is a name nobody finds. */
  function label(m, name) {
    m.bindTooltip(name, {
      permanent: true,
      direction: 'bottom',
      offset: [0, 12],
      className: 'lists-pin-name',
      /* Leaflet would otherwise put every one of these in the a11y tree
         twice over: once here and once as the row in the column. */
      interactive: false
    });
  }

  /* One place on the open list, lit and haloed, with the map carried to it —
     centred rather than zoomed. Opening a place on a list is not a street
     question: what somebody pressing the eighth row wants to know is where it
     is next to the other nine, and a single pin filling the window is the one
     answer that does not say. ?spot= on the map zooms because that press is
     about one door; this one is not. */
  function open(id, at) {
    if (!map) return;
    if (openKey) {
      wear(openKey, 'is-open', false);
      lift(openKey, 0);
      openKey = '';
    }
    if (!id) return;
    openKey = id;
    wear(openKey, 'is-open', true);
    /* Over everything, because it is the one the card is about. Leaflet
       otherwise stacks markers by latitude, which on a street with three
       places on it puts the haloed pin behind one of its neighbours. */
    lift(openKey, 1000);
    if (at) {
      /* Off-centre by whatever the columns cover, so the pin lands in the
         middle of the city that is actually showing rather than behind the
         card that just opened over it. */
      var point = map.latLngToContainerPoint(at);
      var to = map.containerPointToLatLng([point.x + covered / 2, point.y]);
      map.panTo(to, {
        /* Slowly enough that the eye follows the streets across and arrives
           knowing where it is — the same three quarters of a second PAN_MS
           gives the map's own travel — and not at all for somebody who has
           asked the platform for less movement. */
        animate: !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches),
        duration: .75
      });
    }
    /* A label the list was too long to draw: the one place that has been
       asked for gets its name whatever else is on the map. */
    var marks = byKey[id] || [];
    if (marks.length === 1 && marks[0].ttbName && !marks[0].getTooltip()) {
      label(marks[0], marks[0].ttbName);
    }
  }

  function lift(key, offset) {
    var marks = byKey[key] || [];
    for (var i = 0; i < marks.length; i++) marks[i].setZIndexOffset(offset);
  }

  /* Somebody dragged the window across the breakpoint, or turned a tablet
     over. Which of the two layouts this is changes what every row on the page
     is and where every link on it points, so lists.js redraws — and the query
     is asked for here rather than restated there, because a page that
     disagreed with itself about how wide it is would draw one layout and
     listen for the other. */
  function onWidth(fn) {
    if (!window.matchMedia) return;
    var q = window.matchMedia(WIDE);
    if (q.addEventListener) q.addEventListener('change', fn);
    else if (q.addListener) q.addListener(fn);
  }

  return {
    wide: wide,
    leaflet: leaflet,
    mount: mount,
    reserve: reserve,
    clouds: clouds,
    light: light,
    places: places,
    open: open,
    onWidth: onWidth
  };
})();
