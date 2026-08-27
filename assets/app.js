/* Tallinn Tastebuds — the whole application.
 *
 * Plain browser JavaScript, no modules, no build step. Leaflet is the only
 * dependency and it is already on the page by the time this file runs
 * (both script tags are deferred, so they execute in order).
 */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- config */

  var DEFAULT_LANG = 'en';
  var STORE_KEY = 'ttb.lang';
  var FALLBACK_CENTER = [59.437, 24.7536];
  var TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  var TILE_URL_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

  /* CARTO used to serve these tiles to anyone who attributed them. They now
     want a key, and they stamp "API KEY REQUIRED" diagonally across every
     tile requested without one — the map still draws, it just wears the nag.
     The key is free up to five million tiles a month, which this map will
     never approach, and it is requested at carto.com/basemaps/apikey.

     It sits here in plain sight because it has to: this is a static site with
     no build step and no server to hide anything behind, so anything the
     browser needs is public. That is fine for this particular kind of key —
     it is a meter reading, not a password, and it unlocks nothing but the
     tiles it is already drawing. Lock it to the site's domain in the CARTO
     dashboard and someone copying it out of here gets nothing they could not
     get by asking for their own.

     Empty is a working state, deliberately: the map falls back to exactly
     what it does today, watermark and all, rather than breaking. */
  var TILE_KEY = 'cb1_2ci9_1_e18f20c42b2e5346aa517b42';

  /* Two styles, which is the choice worth offering: day or night. Seven
     colours of the spectrum made the rail look like a settings screen and
     asked a question nobody came here to answer. Green is the dark one, and
     dark is the half that needs different tiles: dark cards over the pale
     Positron basemap would be unreadable. */
  var STYLES = [
    { id: 'red',   dark: false },
    { id: 'green', dark: true  }
  ];
  var DEFAULT_STYLE = 'red';

  /* The one chip that is not a type. Discounts live in data/deals.json, not
     in the taxonomy, so this id is reserved rather than declared: the
     validator refuses a taxonomy type that tries to claim it, because two
     chips answering to the same id would filter each other's places. */
  var DEAL_FILTER = 'discount';
  var PIN_R = 7;             /* every pin */
  var PIN_R_SELECTED = 10;   /* the one you are looking at */
  var STYLE_KEY = 'ttb.style';
  var TILE_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
    '&copy; <a href="https://carto.com/attributions">CARTO</a>';

  /* ----------------------------------------------------------------- state */

  var state = {
    places: [],
    deals: [],           // data/deals.json, usually empty
    types: [],
    ui: {},
    langs: [],
    q: '',
    lang: DEFAULT_LANG,
    langPinned: false,
    style: DEFAULT_STYLE,
    stylePinned: false,
    lastPick: null,
    radio: null,         // the station from data/radio.json, or nothing
    active: [],          // selected type ids, OR semantics; empty means "All"
    selected: null,      // restaurant id, or null
    view: 'list',        // 'list' | 'detail'
    lastFocus: null,
    lb: { photos: [], index: 0, base: '', name: '', opener: null }
  };

  var map = null;
  var markers = {};      // id -> L.CircleMarker
  var clusterPins = [];
  var hereMarker = null;
  var hereAccuracy = null;
  var tileLayer = null;
  var haloMarker = null;
  var toastTimer = null;

  var dom = {};

  /* --------------------------------------------------------------- helpers */

  function $(id) { return document.getElementById(id); }

  function el(tag, props, kids) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'className') node.className = v;
        else if (k === 'textContent') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else node.setAttribute(k, v === true ? '' : String(v));
      });
    }
    (kids || []).forEach(function (kid) {
      if (kid === null || kid === undefined || kid === false) return;
      node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    });
    return node;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* localStorage throws outright in some private-browsing modes, so every
     touch of it is wrapped and a failure is simply treated as "no preference". */
  function storeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function storeSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* ignore */ }
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function reduceMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isNarrow() { return window.matchMedia('(max-width: 860px)').matches; }

  /* Interface string lookup: current language, then English, then the key. */
  function t(key, vars) {
    var pack = state.ui[state.lang] || {};
    var s = pack[key];
    if (s === undefined) s = (state.ui[DEFAULT_LANG] || {})[key];
    if (s === undefined) return key;
    if (vars) {
      Object.keys(vars).forEach(function (v) {
        s = s.split('{' + v + '}').join(String(vars[v]));
      });
    }
    return s;
  }

  function typeLabel(id) {
    for (var i = 0; i < state.types.length; i++) {
      if (state.types[i].id === id) {
        return state.types[i][state.lang] || state.types[i][DEFAULT_LANG] || id;
      }
    }
    return id;
  }

  function blurbFor(place) {
    var b = place.blurb || {};
    return b[state.lang] || b[DEFAULT_LANG] || b.et || b.ru || '';
  }

  /* Month names come from ui.json, not from Intl.
     Chromium reports az as a supported locale — supportedLocalesOf returns it
     and resolvedOptions().locale says "az" — and then formats April as "M04",
     because the month-name data is not in its ICU build. There is no honest
     feature test for that, and which locales are thin varies by browser and
     version. Reading the names from the data file makes the date identical
     everywhere and removes the dependency entirely. Intl stays only as a
     fallback for a language that has not filled the key in yet. */
  function formatMonth(ym) {
    var m = /^(\d{4})-(\d{2})$/.exec(ym || '');
    if (!m) return ym || '';
    var year = m[1];
    var index = Number(m[2]) - 1;

    var names = (t('months') || '').split('|');
    if (names.length === 12 && names[index]) {
      return t('monthYear', { month: names[index], year: year });
    }

    try {
      return new Intl.DateTimeFormat(state.lang, {
        year: 'numeric', month: 'long', timeZone: 'UTC'
      }).format(new Date(Date.UTC(Number(year), index, 1)));
    } catch (e) {
      return ym;
    }
  }

  /* The data holds the number the way you would read it out, spaces and all.
     A tel: href wants it without them, so strip everything but the digits and
     the leading plus rather than storing the same number twice. */
  function telHref(phone) {
    return 'tel:' + String(phone || '').replace(/[^+0-9]/g, '');
  }

  function byId(id) {
    for (var i = 0; i < state.places.length; i++) {
      if (state.places[i].id === id) return state.places[i];
    }
    return null;
  }

  /* A place only shows a discount when one is set up, switched on, and
     inside whatever run of dates it was given. Everything else — an entry
     still being drafted, a campaign that has finished, a place that has
     closed — leaves the panel exactly as it was before any of this existed.

     assets/pass.js owns the date arithmetic and is loaded alongside this
     file; if it ever fails to arrive, no place has a deal and the map is
     none the wiser. */
  function liveDealFor(place) {
    if (!window.TTBPass || place.closed) return null;
    var deal = window.TTBPass.find(state.deals, place.id);
    if (!deal || !deal.live) return null;
    return window.TTBPass.windowState(deal) === 'open' ? deal : null;
  }

  function toast(message) {
    dom.toast.textContent = message;
    dom.toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { dom.toast.hidden = true; }, 3800);
  }

  /* ------------------------------------------------------------------ i18n */

  function pickLanguage(langs) {
    var fromUrl = new URLSearchParams(window.location.search).get('lang');
    if (fromUrl && langs.indexOf(fromUrl) !== -1) return { lang: fromUrl, pinned: true };

    var stored = storeGet(STORE_KEY);
    if (stored && langs.indexOf(stored) !== -1) return { lang: stored, pinned: true };

    var prefs = navigator.languages || [navigator.language || ''];
    for (var i = 0; i < prefs.length; i++) {
      var base = String(prefs[i]).toLowerCase().split('-')[0];
      if (langs.indexOf(base) !== -1) return { lang: base, pinned: false };
    }
    return { lang: langs.indexOf(DEFAULT_LANG) !== -1 ? DEFAULT_LANG : langs[0], pinned: false };
  }

  /* Fill in every element carrying a data-i18n / data-i18n-aria-label hook. */
  function applyStaticStrings() {
    document.documentElement.lang = state.lang;
    document.title = t('documentTitle');

    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    }
    var aria = document.querySelectorAll('[data-i18n-aria-label]');
    for (var j = 0; j < aria.length; j++) {
      aria[j].setAttribute('aria-label', t(aria[j].getAttribute('data-i18n-aria-label')));
    }

    var holders = document.querySelectorAll('[data-i18n-placeholder]');
    for (var h = 0; h < holders.length; h++) {
      holders[h].setAttribute('placeholder', t(holders[h].getAttribute('data-i18n-placeholder')));
    }

    var titled = document.querySelectorAll('[data-i18n-title]');
    for (var k = 0; k < titled.length; k++) {
      titled[k].setAttribute('title', t(titled[k].getAttribute('data-i18n-title')));
    }
  }

  /* Six codes in a row is 232px, and on a 390px phone that runs straight into
     the handle in the top left corner. So the row keeps its shape on a
     desktop and folds into the current code plus a menu on a phone, which is
     the same markup either way: CSS decides which half is showing. */
  function closeLangMenu() {
    dom.langSwitch.classList.remove('is-open');
    var now = dom.langSwitch.querySelector('.btn-lang-now');
    if (now) now.setAttribute('aria-expanded', 'false');
  }

  function renderLanguageSwitch() {
    clear(dom.langSwitch);

    var now = el('button', {
      type: 'button',
      className: 'btn btn-lang-now',
      'aria-expanded': 'false',
      'aria-label': t('language')
    }, [
      el('span', { textContent: state.lang.toUpperCase() }),
      el('span', {
        className: 'caret',
        html: '<svg viewBox="0 0 10 6" aria-hidden="true" focusable="false"><path d="M1 1l4 4 4-4"/></svg>'
      })
    ]);
    now.addEventListener('click', function () {
      var open = dom.langSwitch.classList.toggle('is-open');
      now.setAttribute('aria-expanded', String(open));
    });
    dom.langSwitch.appendChild(now);

    var list = el('div', { className: 'lang-list' });
    state.langs.forEach(function (code) {
      var name = (state.ui[code] && state.ui[code].langName) || code;
      /* The code is what the desktop row shows; the phone menu has room for
         the language's own name for it, so it carries both. */
      var btn = el('button', {
        type: 'button',
        className: 'btn btn-lang',
        lang: code,
        'aria-label': name,
        'aria-pressed': String(code === state.lang)
      }, [
        el('span', { className: 'lang-code', textContent: code.toUpperCase() }),
        el('span', { className: 'lang-name', textContent: name })
      ]);
      btn.addEventListener('click', function () { setLanguage(code); closeLangMenu(); });
      list.appendChild(btn);
    });
    dom.langSwitch.appendChild(list);
  }

  function setLanguage(code) {
    if (code === state.lang || state.langs.indexOf(code) === -1) return;
    state.lang = code;
    state.langPinned = true;
    storeSet(STORE_KEY, code);
    applyStaticStrings();
    renderLanguageSwitch();
    renderStyleSwitch();
    renderFilters();
    renderPanel();
    renderRadio();
    syncUrl();
    trackEvent('language_select', { language: code });
  }

  /* ---------------------------------------------------------------- styles
   * Two palettes, brick and forest. Each is nothing but a block of custom
   * properties in styles.css, so switching one re-colours the whole site
   * without touching a single component rule.
   */

  function isDarkStyle(id) {
    for (var i = 0; i < STYLES.length; i++) {
      if (STYLES[i].id === id) return STYLES[i].dark;
    }
    return false;
  }

  function knownStyle(id) {
    for (var i = 0; i < STYLES.length; i++) if (STYLES[i].id === id) return true;
    return false;
  }

  function pickStyle() {
    var fromUrl = new URLSearchParams(window.location.search).get('style');
    if (fromUrl && knownStyle(fromUrl)) return { style: fromUrl, pinned: true };

    var stored = storeGet(STYLE_KEY);
    if (stored && knownStyle(stored)) return { style: stored, pinned: true };

    return { style: DEFAULT_STYLE, pinned: false };
  }

  /* Leaflet fills in {s}, {z}, {x}, {y} and {r}; the key is ours to add, and
     it goes on as a query string so those placeholders are untouched. */
  function tileUrl(dark) {
    var url = dark ? TILE_URL_DARK : TILE_URL;
    return TILE_KEY ? url + '?key=' + encodeURIComponent(TILE_KEY) : url;
  }

  function makeTiles(dark) {
    return L.tileLayer(tileUrl(dark), {
      subdomains: 'abcd',
      maxZoom: 20,
      detectRetina: true,
      attribution: TILE_ATTRIBUTION
    });
  }

  function applyStyle(id) {
    document.documentElement.setAttribute('data-style', id);
    /* Tell the browser which form controls and scrollbars to draw. */
    document.documentElement.style.colorScheme = isDarkStyle(id) ? 'dark' : 'light';

    var theme = document.querySelector('meta[name="theme-color"]');
    if (theme) theme.setAttribute('content', cssVar('--wash') || '#dceaf9');
  }

  function setStyle(id, opts) {
    if (!knownStyle(id)) return;
    var wasDark = isDarkStyle(state.style);
    state.style = id;
    if (!opts || opts.pin !== false) {
      state.stylePinned = true;
      storeSet(STYLE_KEY, id);
    }

    applyStyle(id);

    /* Only rebuild the basemap when the light/dark side actually changed. */
    if (map && tileLayer && isDarkStyle(id) !== wasDark) {
      map.removeLayer(tileLayer);
      tileLayer = makeTiles(isDarkStyle(id));
      tileLayer.addTo(map);
      if (tileLayer.getContainer) tileLayer.getContainer().style.opacity = '';
    }

    paintMarkers();
    markStyleSwitch();
    syncUrl();
    if (!opts || opts.pin !== false) trackEvent('style_select', { style: id });
  }

  /* Pressed state only, so activating a swatch by keyboard keeps focus on it. */
  /* The rail is vertically centred, which collides with the brand card on a
     short window. Nudge it down only when it actually would. */
  function placeRail() {
    if (!dom.rail || !dom.brand) return;
    dom.rail.style.top = '';
    dom.rail.style.transform = '';
    /* With the sheet up the rail is anchored to its top edge by the
       stylesheet. Pinning a top as well would stretch it between the two. */
    if (isNarrow() && document.body.classList.contains('panel-open')) return;
    var need = dom.brand.getBoundingClientRect().bottom + 14;
    /* And never so far down that the foot of the rail leaves the screen. The
       locate button used to be the thing it must not land on; now that the
       button is the foot of the rail, the floor is the bottom of the window,
       less the attribution strip and the same gap the rail keeps everywhere
       else. On a window too short for both, the rail stays centred and takes
       its chances with the card, which is where it was before the nudge. */
    var floor = window.innerHeight - 46 - dom.rail.offsetHeight;
    if (need > floor) need = floor;
    if (dom.rail.getBoundingClientRect().top < need) {
      dom.rail.style.top = need + 'px';
      dom.rail.style.transform = 'none';
    }
  }

  function markStyleSwitch() {
    if (!dom.styles) return;
    var buttons = dom.styles.querySelectorAll('.swatch');
    for (var i = 0; i < buttons.length && i < STYLES.length; i++) {
      buttons[i].setAttribute('aria-pressed', String(STYLES[i].id === state.style));
    }
  }

  function renderStyleSwitch() {
    if (!dom.styles) return;
    clear(dom.styles);
    STYLES.forEach(function (style) {
      var key = 'style' + style.id.charAt(0).toUpperCase() + style.id.slice(1);
      var btn = el('button', {
        type: 'button',
        className: 'swatch sw-' + style.id,
        'aria-pressed': String(style.id === state.style),
        'aria-label': t(key),
        title: t(key)
      });
      btn.addEventListener('click', function () { setStyle(style.id); });
      dom.styles.appendChild(btn);
    });
  }

  /* ------------------------------------------------------------------- map */

  function initMap() {
    map = L.map('map', {
      zoomControl: false,
      attributionControl: true,
      center: FALLBACK_CENTER,
      zoom: 13,
      minZoom: 10,
      maxZoom: 19,
      zoomAnimation: !reduceMotion(),
      fadeAnimation: !reduceMotion()
    });

    tileLayer = makeTiles(isDarkStyle(state.style));
    tileLayer.addTo(map);

    /* The OpenStreetMap and CARTO credits are a licence condition — the
       attribution control stays on the page, always. */
    map.attributionControl.setPrefix('<a href="https://leafletjs.com/">Leaflet</a>');

    /* Which pins are close enough to share a dot depends on the zoom, and on
       nothing else, so panning does not have to recompute anything. */
    map.on('zoomend', syncMarkers);

    /* Which names fit depends on what is on the screen, so unlike the
       clustering this one has to follow the pan too. */
    map.on('zoomend moveend', paintLabels);
  }

  function buildMarkers() {
    var accent = cssVar('--accent') || '#00539c';
    var muted = cssVar('--muted') || '#536879';
    var paper = cssVar('--paper') || '#f2f8ff';

    state.places.forEach(function (place) {
      var marker = L.circleMarker([place.lat, place.lng], {
        radius: PIN_R,
        weight: 2.5,
        color: paper,
        opacity: 1,
        fillColor: place.closed ? muted : accent,
        fillOpacity: 1,
        className: 'pin',
        bubblingMouseEvents: false
      });

      marker.bindTooltip(place.name, {
        className: 'pin-tip',
        direction: 'top',
        offset: [0, -11],
        opacity: 1
      });

      marker.on('click', function () { selectPlace(place.id, { fly: false }); });

      /* Leaflet does not make vector layers keyboard-reachable, so add the
         button semantics by hand every time the path is (re)attached. */
      marker.on('add', function () {
        var path = marker.getElement();
        if (!path) return;
        path.setAttribute('tabindex', '0');
        path.setAttribute('role', 'button');
        path.setAttribute('aria-label', t('openPlace', { name: place.name }));
        path.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
            ev.preventDefault();
            selectPlace(place.id, { fly: false });
          }
        });
      });

      markers[place.id] = marker;
      marker.addTo(map);
    });

    fitToPins();
    paintMarkers();   /* also syncs; gives every pin its filmed or unfilmed face */
  }

  /* Four places sit 7km out. Fitting every one of them on a phone squeezes
     the fifty in the middle into a thumbnail, where the whole city is a
     single dot however it is drawn. So the fit has a floor: open on Tallinn,
     with the far ones a zoom-out away. */
  var FIT_FLOOR = 12;

  /* Move the map, over any distance. Leaflet's animated setView only works
     over short hops: hand it a target across the city and it starts a zoom
     animation whose CSS transition never runs, so the map ends the call
     exactly where it began — silently. That is the whole bug behind a filter
     chip that appears to do nothing. flyTo crosses the distance properly, and
     the arc it draws is the zoom-out-and-back-in the move actually is, so it
     takes every jump the current view does not already contain. */
  function travelTo(centre, zoom, animate) {
    if (!animate || reduceMotion()) { map.setView(centre, zoom, { animate: false }); return; }
    if (map.getBounds().contains(centre) && Math.abs(zoom - map.getZoom()) <= 2) {
      map.setView(centre, zoom, { animate: true });
      return;
    }
    map.flyTo(centre, zoom, { duration: .9 });
  }

  /* Frame a set of points. The zoom is worked out before the map moves rather
     than read back after a fitBounds: an animated fit does not report its new
     zoom until the animation has finished, so a floor applied afterwards
     would undo the move it was meant to correct.

     opts.floor lifts the low end (FIT_FLOOR by default, 0 to allow the whole
     way out to minZoom), opts.maxZoom caps the near end, opts.animate glides
     rather than jumps. */
  function fitLatLngs(pts, opts) {
    if (!map || !pts.length) return;
    var o = opts || {};
    var bounds = L.latLngBounds(pts);
    var pad = isNarrow() ? L.point(48, 48) : L.point(96, 96);
    var floor = o.floor == null ? FIT_FLOOR : o.floor;
    var zoom = Math.min(map.getBoundsZoom(bounds, false, pad), o.maxZoom == null ? 16 : o.maxZoom);
    travelTo(bounds.getCenter(), Math.max(zoom, floor), !!o.animate);
  }

  function fitToPins(opts) {
    var pool = visiblePlaces();
    if (!pool.length) pool = state.places;
    fitLatLngs(pool.map(function (p) { return [p.lat, p.lng]; }), opts);
  }

  /* Is any of this lot actually on the screen as it stands? Measured against
     the strip of map you can see rather than the map's full bounds: the panel
     covers the bottom of a phone and the right of a desktop, and a pin
     underneath it is not on screen in any sense a visitor would accept.

     With the sheet dragged to full height there is no strip left to judge, so
     the answer is yes — a map nobody can see is not worth moving. */
  function anyInView(places) {
    if (!map || !places.length) return false;
    var size = map.getSize();
    var right = size.x;
    var bottom = size.y;

    if (dom.panel.classList.contains('is-open')) {
      if (isNarrow()) bottom = size.y - dom.panel.offsetHeight;
      else right = size.x - dom.panel.offsetWidth;
    }
    if (bottom < 80 || right < 80) return true;

    return places.some(function (p) {
      var pt = map.latLngToContainerPoint([p.lat, p.lng]);
      return pt.x >= 0 && pt.x <= right && pt.y >= 0 && pt.y <= bottom;
    });
  }

  /* --------------------------------------------------------------- chosen
   * Whichever place is open has to be obvious on the map, especially after
   * Surprise me — otherwise the panel names somewhere and you have no idea
   * which of forty dots it is.
   *
   * Three things mark it: the pin grows and takes the brighter accent, a ring
   * is drawn around it, and its name label is pinned open instead of waiting
   * for a hover it will never get on a phone.
   */

  /* Two hex colours, mixed. Used for the faintest pin, so the ring around a
     place with nothing to look at is one opaque colour rather than a
     translucent one letting the map through. */
  function mixHex(a, b, weight) {
    function parse(h) {
      h = String(h).replace('#', '');
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    var x = parse(a);
    var y = parse(b);
    return '#' + [0, 1, 2].map(function (i) {
      var v = Math.round(x[i] * weight + y[i] * (1 - weight));
      return (v < 16 ? '0' : '') + v.toString(16);
    }).join('');
  }

  function markerColours() {
    return {
      accent: cssVar('--accent') || '#00539c',
      lit: cssVar('--accent-lit') || '#0072ce',
      muted: cssVar('--muted') || '#536879',
      paper: cssVar('--paper') || '#f2f8ff',
      here: cssVar('--here') || '#c1420b'
    };
  }

  /* How much of a place there is to look at, which is what the pin says:
     something to watch, something to look at, or the write-up alone. */
  function pinDepth(place) {
    if (place.reel) return 'reel';
    if (place.photos && place.photos.length) return 'photos';
    return 'words';
  }

  /* The pin, drawn small: a solid disc, a ring, a speck. Not a play triangle
     and a camera — those say what the word beside them already says, and at
     9px a camera is a smudge anyway. Echoing the dot is the one thing the
     badge can do that the word cannot: it makes every row a key to the map,
     so the three kinds of dot out there stop needing to be guessed at. */
  var DEPTH_GLYPH = {
    reel: '<svg viewBox="0 0 10 10" focusable="false"><circle cx="5" cy="5" r="3.9"/></svg>',
    photos: '<svg viewBox="0 0 10 10" focusable="false"><path fill-rule="evenodd" d="M5 1.1a3.9 3.9 0 100 7.8 3.9 3.9 0 000-7.8zm0 1.7a2.2 2.2 0 110 4.4 2.2 2.2 0 010-4.4z"/></svg>',
    words: '<svg viewBox="0 0 10 10" focusable="false"><circle cx="5" cy="5" r="2.2"/></svg>'
  };

  /* The pin's three-way, said in words. A dot on the map is only legible when
     you already know the code and can compare it with its neighbours; a row
     in the list has neither, so it carries the name and the dot both. Same
     order of weight as the pins: the filmed places take the accent, the
     photographed ones an outline, and the rest a hairline the eye slides
     over.

     Instagram's word and TikTok's word are not the same word, and the rest of
     the page is careful about that, so the mark is too. */
  function depthMarkKey(place) {
    var depth = pinDepth(place);
    return depth === 'reel'
      ? (reelProvider(place.reel) === 'tiktok' ? 'markVideo' : 'markReel')
      : depth === 'photos' ? 'markPhotos' : 'markNone';
  }

  function depthMark(place) {
    var depth = pinDepth(place);
    var key = depthMarkKey(place);
    return el('span', { className: 'depth-mark is-' + depth }, [
      el('span', { className: 'depth-glyph', 'aria-hidden': 'true', html: DEPTH_GLYPH[depth] }),
      el('span', { textContent: t(key) })
    ]);
  }

  /* A name standing open on the map is part of the pin, so it opens the place
     the same way the dot does. Leaflet's own `interactive` does the work: it
     lets pointer events reach the label and makes the marker the label's event
     parent, so one click handler serves both. A hover tooltip stays inert —
     it is only there because the pointer is already on the dot. */
  function tooltipFor(marker, name, permanent, chosen) {
    marker.unbindTooltip();
    marker.bindTooltip(name, {
      className: 'pin-tip' + (chosen ? ' pin-tip-on' : '') + (permanent && !chosen ? ' pin-tip-quiet' : ''),
      direction: 'top',
      offset: [0, permanent ? -14 : -11],
      opacity: 1,
      interactive: !!permanent,
      permanent: !!permanent
    });
  }

  /* ---------------------------------------------------------------- labels
   * Past a certain zoom the dots stop being enough: you are looking at a
   * street, not a city, and the question becomes which place is which. So
   * pins start carrying their names.
   *
   * Not all of them. A label is wide and a pin is 14px, so the names are laid
   * out greedily and any that would land on top of one already placed is
   * dropped. Width is estimated from the character count rather than measured,
   * because measuring means putting the label in the page first, which is the
   * thing being decided. The chosen place is placed before everything else and
   * so always keeps its name.
   *
   * Recomputed on pan as well as zoom, unlike the clustering, because which
   * labels fit depends on what is actually on the screen.
   */
  var LABEL_ZOOM = 14;
  var LABEL_H = 24;
  var soloPins = {};

  function labelBox(place) {
    var pt = map.latLngToContainerPoint([place.lat, place.lng]);
    var w = 20 + place.name.length * 7.3;   /* padding plus the display face */
    return { x: pt.x - w / 2, y: pt.y - 16 - LABEL_H, w: w, h: LABEL_H, px: pt.x, py: pt.y };
  }

  function hits(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function labelPlan() {
    var plan = {};
    if (!map || map.getZoom() < LABEL_ZOOM) return plan;

    var size = map.getSize();
    var queue = visiblePlaces().filter(function (p) { return soloPins[p.id]; });

    /* The dots are obstacles too. A name laid over a pin or a cluster count
       hides the very thing it is naming. */
    var taken = [];
    queue.forEach(function (p) {
      var pt = map.latLngToContainerPoint([p.lat, p.lng]);
      taken.push({ x: pt.x - 11, y: pt.y - 11, w: 22, h: 22 });
    });
    clusterPins.forEach(function (pin) {
      var pt = map.latLngToContainerPoint(pin.getLatLng());
      var r = (pin.options.icon.options.iconSize[0] / 2) + 3;
      taken.push({ x: pt.x - r, y: pt.y - r, w: r * 2, h: r * 2 });
    });

    /* The chosen place first, so a collision never costs it its name. */
    queue.sort(function (a, b) {
      if (a.id === state.selected) return -1;
      if (b.id === state.selected) return 1;
      return 0;
    });

    queue.forEach(function (place) {
      var box = labelBox(place);
      /* The whole label has to fit, not just the pin under it: half a name
         sliced off by the window edge is worse than no name. */
      if (box.x < 4 || box.x + box.w > size.x - 4 || box.y < 4 || box.y + box.h > size.y) return;
      for (var i = 0; i < taken.length; i++) if (hits(box, taken[i])) return;
      taken.push(box);
      plan[place.id] = true;
    });
    return plan;
  }

  function paintLabels() {
    if (!map) return;
    var plan = labelPlan();
    state.places.forEach(function (place) {
      var marker = markers[place.id];
      if (!marker) return;
      var chosen = place.id === state.selected;
      var wants = chosen || !!plan[place.id];
      var tip = marker.getTooltip();
      var isOn = !!(tip && tip.options.permanent);
      var wasChosen = !!(tip && tip.options.className &&
        tip.options.className.indexOf('pin-tip-on') !== -1);
      if (!tip || isOn !== wants || wasChosen !== chosen) {
        tooltipFor(marker, place.name, wants, chosen);
      }
    });
  }

  function clearHalo() {
    if (haloMarker && map) map.removeLayer(haloMarker);
    haloMarker = null;
  }

  /* Paints every pin for the current selection and the current style. Doubles
     as the restyle hook, so a style change keeps the selection visible. */
  function paintMarkers() {
    var c = markerColours();
    syncMarkers();

    state.places.forEach(function (place) {
      var marker = markers[place.id];
      if (!marker) return;
      var chosen = place.id === state.selected;

      /* One shape, three readings of it, for the three amounts of place
         behind it. Filmed is a solid disc at full size. Photographed is the
         same size but hollow — a paper centre inside a full-strength ring,
         which is a different silhouette rather than a paler version of the
         same one. The write-up on its own is a small, faded ring, drawn
         narrower and in a tone half mixed into the paper.
         Not three icons, because at 14px a picture inside a dot is mud and
         the map is 70 dots; but solid, hollow and small-and-faint are told
         apart at a glance, which half a shade of fill was not. The chosen
         place keeps whichever of the three it is, so selecting one never
         hides what there is to see in it. */
      var depth = pinDepth(place);
      var tone = chosen ? c.lit : (place.closed ? c.muted : c.accent);
      var solid = depth === 'reel';
      var faded = depth === 'words';

      marker.setStyle({
        radius: chosen ? PIN_R_SELECTED : (faded ? PIN_R - 2.5 : PIN_R),
        weight: chosen ? 3.5 : (faded ? 1.75 : 2.75),
        color: solid ? c.paper : (faded ? mixHex(tone, c.paper, .55) : tone),
        fillColor: solid ? tone : c.paper
      });

      if (chosen && marker.bringToFront) marker.bringToFront();
    });

    paintLabels();

    clearHalo();
    var place = state.selected ? byId(state.selected) : null;
    if (place && map) {
      haloMarker = L.circleMarker([place.lat, place.lng], {
        radius: PIN_R_SELECTED + 7,
        weight: 2,
        color: c.lit,
        opacity: .85,
        fill: false,
        className: 'pin-halo',
        interactive: false
      }).addTo(map);
      if (haloMarker.bringToBack) haloMarker.bringToBack();
    }

    if (hereMarker) {
      hereMarker.setStyle({ color: c.paper, fillColor: c.here });
    }
    if (hereAccuracy) {
      hereAccuracy.setStyle({ color: c.here, fillColor: c.here });
    }
  }

  /* Centre the chosen place in the part of the map you can actually see. The
     panel covers the right on desktop and the bottom on a phone, so centring
     on the container would park the pin underneath it. */
  var lastSheetKey = null;

  function focusOn(place, zoomIn) {
    if (!map) return;
    var size = map.getSize();
    var zoom = zoomIn ? Math.max(map.getZoom(), 15) : map.getZoom();

    var wantX = size.x / 2;
    var wantY = size.y / 2;

    if (dom.panel.classList.contains('is-open')) {
      if (isNarrow()) {
        var strip = size.y - dom.panel.offsetHeight;
        /* keep clear of the brand card at the top of the strip */
        wantY = Math.min(Math.max(strip / 2 + 26, 104), Math.max(strip - 24, 104));
      } else {
        wantX = Math.max((size.x - dom.panel.offsetWidth - 32) / 2, 80);
      }
    }

    var pt = map.project([place.lat, place.lng], zoom);
    var centre = map.unproject(pt.add(L.point(size.x / 2 - wantX, size.y / 2 - wantY)), zoom);
    travelTo(centre, zoom, true);
  }

  /* focusOn measures the sheet to find the strip of map left over, so it has
     to wait whenever the sheet is on its way to a new height. Opening one
     place while another is already open changes nothing about that height,
     and those moves stay immediate. */
  function sheetKey() {
    return state.view + '|' + (document.body.classList.contains('sheet-full') ? 'full' : 'low');
  }

  function refocus(place, zoomIn) {
    var key = sheetKey();
    var resizing = isNarrow() && key !== lastSheetKey;
    lastSheetKey = key;
    if (!resizing || reduceMotion()) { focusOn(place, zoomIn); return; }
    window.setTimeout(function () { focusOn(place, zoomIn); }, 300);
  }

  /* --------------------------------------------------------------- filters */

  function usedTypeIds() {
    var used = {};
    state.places.forEach(function (p) {
      (p.types || []).forEach(function (id) { used[id] = true; });
    });
    return state.types
      .map(function (t2) { return t2.id; })
      .filter(function (id) { return used[id]; });
  }

  function anyLiveDeal() {
    return state.places.some(function (p) { return !!liveDealFor(p); });
  }

  /* Chips are OR, so a place shows if it answers any active one — and the
     discount chip is answered by the deal rather than by the type list. */
  function matchesFilters(place) {
    if (state.active.indexOf(DEAL_FILTER) !== -1 && liveDealFor(place)) return true;
    return (place.types || []).some(function (id) {
      return state.active.indexOf(id) !== -1;
    });
  }

  function visiblePlaces() {
    if (!state.active.length) return state.places.slice();
    return state.places.filter(matchesFilters);
  }

  function renderFilters() {
    clear(dom.filters);

    var all = el('button', {
      type: 'button',
      className: 'chip',
      'aria-pressed': String(state.active.length === 0),
      textContent: t('filterAll')
    });
    all.addEventListener('click', function () {
      if (!state.active.length) return;
      state.active = [];
      applyFilters();
    });
    dom.filters.appendChild(all);

    /* First of the real filters, because it is the only one that is an offer
       rather than a description — and last to appear, since with no live deal
       anywhere it is a chip that would filter down to nothing. */
    if (anyLiveDeal()) {
      var onDeal = state.active.indexOf(DEAL_FILTER) !== -1;
      var dealChip = el('button', {
        type: 'button',
        className: 'chip',
        'aria-pressed': String(onDeal),
        textContent: t('filterDiscount')
      });
      dealChip.addEventListener('click', function () {
        var at = state.active.indexOf(DEAL_FILTER);
        if (at === -1) state.active.push(DEAL_FILTER); else state.active.splice(at, 1);
        applyFilters({ id: DEAL_FILTER, on: at === -1 });
      });
      dom.filters.appendChild(dealChip);
    }

    usedTypeIds().forEach(function (id) {
      var on = state.active.indexOf(id) !== -1;
      var chip = el('button', {
        type: 'button',
        className: 'chip',
        'aria-pressed': String(on),
        textContent: typeLabel(id)
      });
      chip.addEventListener('click', function () {
        var at = state.active.indexOf(id);
        if (at === -1) state.active.push(id); else state.active.splice(at, 1);
        applyFilters({ id: id, on: at === -1 });
      });
      dom.filters.appendChild(chip);
    });

    updateFilterFades();
  }

  /* Keep the fade classes in step with how far the chip row is scrolled. */
  function updateFilterFades() {
    var box = dom.filters;
    var max = box.scrollWidth - box.clientWidth;
    var x = box.scrollLeft;
    box.classList.toggle('can-left', max > 1 && x > 1);
    box.classList.toggle('can-right', max > 1 && x < max - 1);
  }

  /* ------------------------------------------------------------ clustering
   * Tallinn is small and the places crowd together in it. Opened on a phone
   * the map fits all 62 into about 300px of width, where a pin is 14px wide:
   * measured, 34 of them sit mostly underneath another one. So pins closer
   * together than a fingertip are drawn as one counted dot until you zoom in
   * far enough to tell them apart.
   *
   * Written here rather than pulled from Leaflet.markercluster, which does
   * not support the circleMarker every pin on this map is made of, and would
   * have meant rebuilding the whole pin layer around image markers for 62
   * points. Greedy grouping over 62 points is nothing to compute, and it
   * runs on zoom rather than on pan because clustering follows the
   * projection, which panning does not change.
   *
   * The chosen place is never swallowed: it always keeps its own pin.
   */
  var CLUSTER_PX = 44;

  /* Past this zoom nothing is grouped, whatever the spacing. Q Pizza Jaam and
     Telliskivi Šašlõkk are eleven metres apart: 37px at zoom 18, under the 44
     that groups them, so the cluster survived every zoom the click could
     reach and there was no way to get at either place. Two dots 37px apart
     are two perfectly clickable dots. Grouping exists to stop a city of pins
     turning into a smear at low zoom, and by 18 you are looking at one
     street. */
  var CLUSTER_ZOOM_MAX = 17;

  function pinGroups(places) {
    var zoom = map.getZoom();
    if (zoom > CLUSTER_ZOOM_MAX) {
      return places.map(function (p) { return [{ place: p }]; });
    }
    var pts = places.map(function (p) {
      return { place: p, pt: map.project([p.lat, p.lng], zoom) };
    });
    var taken = [];
    var groups = [];

    pts.forEach(function (seed, i) {
      if (taken[i]) return;
      taken[i] = true;
      var group = [seed];
      pts.forEach(function (other, j) {
        if (j <= i || taken[j]) return;
        if (seed.pt.distanceTo(other.pt) < CLUSTER_PX) {
          taken[j] = true;
          group.push(other);
        }
      });
      groups.push(group);
    });
    return groups;
  }

  function clearClusters() {
    clusterPins.forEach(function (pin) { if (map) map.removeLayer(pin); });
    clusterPins = [];
  }

  function clusterPin(group) {
    var count = group.length;
    var lat = 0;
    var lng = 0;
    group.forEach(function (m) { lat += m.place.lat; lng += m.place.lng; });

    var size = 26 + Math.min(count, 12);
    var label = t('clusterLabel', { count: count });
    var pin = L.marker([lat / count, lng / count], {
      icon: L.divIcon({
        className: 'cluster-pin',
        html: '<span class="cluster-dot">' + count + '</span>',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      }),
      keyboard: true,
      title: label,
      alt: label,
      zIndexOffset: -100
    });

    /* Fitting the group in the window is not the same as breaking it up, and
       it was the wrong question: two places forty pixels apart already fit,
       so fitBounds answered "you are close enough" and left the cluster
       standing however many times it was pressed. What has to happen is that
       the pins come further apart than the distance that grouped them, which
       is a zoom the group can be asked for directly — every member is within
       CLUSTER_PX of the seed by construction, so doubling the gap enough
       times always splits it, and 18 always splits it outright. */
    function breakZoom() {
      var far = 0;
      group.forEach(function (m) { far = Math.max(far, group[0].pt.distanceTo(m.pt)); });
      if (far <= 0) return CLUSTER_ZOOM_MAX + 1;
      return map.getZoom() + Math.ceil(Math.log(CLUSTER_PX / far) / Math.LN2);
    }

    function open() {
      trackEvent('cluster_open', { cluster_size: count });
      var pts = group.map(function (m) { return [m.place.lat, m.place.lng]; });
      var bounds = L.latLngBounds(pts);
      var pad = isNarrow() ? 112 : 220;
      var fit = map.getBoundsZoom(bounds, false, L.point(pad, pad));
      /* Never less than one level in: pressing it always does something. */
      var target = Math.min(
        Math.max(fit, breakZoom(), map.getZoom() + 1),
        CLUSTER_ZOOM_MAX + 1
      );
      map.setView(bounds.getCenter(), target, { animate: !reduceMotion() });
    }
    pin.on('click', open);
    pin.on('keypress', function (ev) {
      if (ev.originalEvent && ev.originalEvent.key === 'Enter') open();
    });

    return pin;
  }

  /* Decides which pins are on the map: the filtered set, minus everything a
     cluster is standing in for. */
  function syncMarkers() {
    if (!map) return;
    var alone = {};
    var pool = [];

    visiblePlaces().forEach(function (p) {
      if (p.id !== state.selected) pool.push(p);
    });
    /* Whatever the filters say, the place whose panel is open keeps its pin.
       A shared link to a place the chips exclude would otherwise open a panel
       pointing at nothing. */
    if (state.selected) alone[state.selected] = true;

    clearClusters();

    pinGroups(pool).forEach(function (group) {
      if (group.length === 1) {
        alone[group[0].place.id] = true;
        return;
      }
      var pin = clusterPin(group);
      pin.addTo(map);
      clusterPins.push(pin);
    });

    state.places.forEach(function (p) {
      var marker = markers[p.id];
      if (!marker) return;
      if (alone[p.id]) { if (!map.hasLayer(marker)) marker.addTo(map); }
      else if (map.hasLayer(marker)) map.removeLayer(marker);
    });
    soloPins = alone;
  }

  function applyFilters(change) {
    syncUrl();
    renderFilters();
    if (state.view === 'list') renderPanel();
    paintMarkers();

    /* Narrowing to a single place and leaving the map where it was makes you
       hunt for the one pin that is left, which on a filter like Discount is
       the entire answer. So the map goes to it. The place is not opened: the
       filter said where, not read me. */
    var shown = visiblePlaces();
    if (state.active.length && shown.length === 1) refocus(shown[0], true);

    /* And if the chips have left none of themselves on the screen, the map
       goes to them. This is the view you land in after Show my location: a
       street corner at zoom 15 that may hold no pin at all, where every chip
       you press used to answer with the same empty square of tiles. Pressing
       a filter is a question about places, so the map pulls back until some
       of them are in it — city-wide if that is what it takes, and to the
       whole map if the chips match nothing anywhere. */
    else if (!anyInView(shown)) fitToPins({ animate: true });

    var params = {
      filters: state.active.length ? state.active.slice().sort().join(',') : 'all',
      filter_count: state.active.length,
      places_shown: visiblePlaces().length
    };
    if (change) {
      params.filter_id = change.id;
      params.filter_state = change.on ? 'on' : 'off';
      trackEvent('filter_select', params);
    } else {
      trackEvent('filter_clear', params);
    }
  }

  /* ---------------------------------------------------------------- radio
   * A station on a button, for the same reason a restaurant map has a colour
   * rail: it is somebody's map, not a directory.
   *
   * A plain <audio> element and one URL. No SoundCloud or YouTube iframe,
   * which would cost a visitor third party cookies, a megabyte of player and
   * a track that gets taken down while nobody is looking. The element is
   * built on first press, so a visitor who never presses it pays nothing.
   *
   * Autoplay is blocked in every browser and should be: a map that starts
   * making noise on its own is a map people close. This one only ever plays
   * because somebody asked it to.
   *
   * The station lives in data/radio.json. With none set the button never
   * appears, which is the state the site ships in.
   */
  var radioEl = null;

  /* One station per language where there is one, and the default everywhere
     else. A visitor reading the map in Russian gets Наше Радио rather than a
     station they cannot follow, and nobody gets silence for want of an entry. */
  function stationFor(lang) {
    var r = state.radio;
    if (!r) return null;
    var byLang = r.byLanguage || {};
    return byLang[lang] || r['default'] || null;
  }

  function markRadio(on) {
    if (!dom.btnRadio) return;
    dom.btnRadio.setAttribute('aria-pressed', String(on));
    var label = t(on ? 'radioStop' : 'radioPlay');
    dom.btnRadio.setAttribute('aria-label', label);
    dom.btnRadio.setAttribute('title', label);
  }

  function stopRadio() {
    if (radioEl) { radioEl.pause(); radioEl.removeAttribute('src'); radioEl.load(); }
    markRadio(false);
  }

  function toggleRadio() {
    var station = stationFor(state.lang);
    if (!station || !station.url) return;

    if (dom.btnRadio.getAttribute('aria-pressed') === 'true') {
      stopRadio();
      trackEvent('radio_stop', { station: station.name || 'radio' });
      return;
    }

    if (!radioEl) {
      radioEl = document.createElement('audio');
      radioEl.preload = 'none';
      radioEl.addEventListener('error', function () {
        stopRadio();
        toast(t('radioFail'));
      });
    }
    /* A live stream has no position to resume from, so it is re-attached
       rather than un-paused: pressing play always joins it where it is now. */
    radioEl.src = station.url;
    var started = radioEl.play();
    if (started && started.catch) {
      started.catch(function () { stopRadio(); toast(t('radioFail')); });
    }
    markRadio(true);
    trackEvent('radio_play', { station: station.name || 'radio' });
  }

  function renderRadio() {
    if (!dom.btnRadio) return;
    var station = stationFor(state.lang);
    if (!station || !station.url) { dom.btnRadio.hidden = true; return; }
    dom.btnRadio.hidden = false;
    if (dom.radioName) dom.radioName.textContent = station.name || '';

    /* Changing language mid-song changes the station under it, rather than
       leaving the old one playing behind a button naming the new one. */
    if (radioEl && !radioEl.paused && radioEl.src !== station.url) {
      radioEl.src = station.url;
      var again = radioEl.play();
      if (again && again.catch) {
        again.catch(function () { stopRadio(); toast(t('radioFail')); });
      }
      trackEvent('radio_play', { station: station.name || 'radio' });
    }
    markRadio(!!(radioEl && !radioEl.paused));
  }

  /* ----------------------------------------------------------- random pick
   * Picks from whatever the filter chips currently allow, so "Asian + solo"
   * then Surprise me answers the actual question being asked. Closed places
   * are never suggested, and the same place is never returned twice running.
   */
  function randomPick() {
    var pool = visiblePlaces().filter(function (p) { return !p.closed; });

    if (!pool.length) {
      toast(t('randomNone'));
      return;
    }

    var choice = pool[0];
    if (pool.length > 1) {
      do {
        choice = pool[Math.floor(Math.random() * pool.length)];
      } while (choice.id === state.lastPick);
    }

    state.lastPick = choice.id;
    trackEvent('random_pick', { place: choice.name, pool: pool.length });
    selectPlace(choice.id, { fly: true });
  }

  /* ------------------------------------------------------------ the sheet
   * On a phone the panel is a bottom sheet, and a sheet tall enough to read
   * comfortably is a sheet that leaves no map. So it opens low and the grip
   * raises it: drag it, or tap to swap between the two heights. Dragging it
   * below the low stop closes it, which is the gesture a phone user reaches
   * for first anyway.
   *
   * The live height is written to --sheet-h rather than to the panel, so the
   * rail that sits above the sheet tracks the drag with it for free.
   */
  /* The same floor the stylesheet keeps: the sheet never grows past the point
     where the chrome strip and the chip row above it are still showing. That
     strip is the way back out when a sheet is standing open. */
  var SHEET_HEADROOM = 110;

  function safeTop() {
    var raw = getComputedStyle(document.documentElement).getPropertyValue('--safe-t');
    var n = parseFloat(raw);
    return isFinite(n) ? n : 0;
  }

  function sheetStops() {
    var h = window.innerHeight;
    var cap = Math.max(h - SHEET_HEADROOM - safeTop(), 160);
    if (document.body.classList.contains('panel-detail')) {
      return { low: Math.min(h * .50, 470, cap), high: Math.min(h * .88, 780, cap) };
    }
    /* The list is already as tall as it gets; it can only be dragged shut. */
    var list = Math.min(h * .82, 720, cap);
    return { low: list, high: list };
  }

  function sheetSnap(full) {
    document.body.classList.toggle('sheet-full', !!full);
    if (dom.sheetGrip) dom.sheetGrip.setAttribute('aria-expanded', String(!!full));
    if (state.selected && state.view === 'detail') {
      var place = byId(state.selected);
      if (place) refocus(place, false);
    }
  }

  function setSheetHeight(px) {
    document.body.style.setProperty('--sheet-h', Math.round(px) + 'px');
  }

  function releaseSheetHeight() {
    document.body.style.removeProperty('--sheet-h');
  }

  function wireSheet() {
    if (!dom.sheetGrip) return;
    var dragging = false;
    var startY = 0;
    var startH = 0;
    var height = 0;
    var moved = false;

    function begin(ev) {
      if (!isNarrow() || !dom.panel.classList.contains('is-open')) return;
      dragging = true;
      moved = false;
      startY = ev.clientY;
      startH = dom.panel.offsetHeight;
      height = startH;
      dom.panel.classList.add('is-dragging');
      if (dom.sheetGrip.setPointerCapture) dom.sheetGrip.setPointerCapture(ev.pointerId);
    }

    function move(ev) {
      if (!dragging) return;
      var stops = sheetStops();
      var delta = startY - ev.clientY;
      if (Math.abs(delta) > 4) moved = true;
      /* A little room below the low stop so a closing drag has somewhere to
         travel, and none above the high one. */
      height = Math.max(Math.min(startH + delta, stops.high), stops.low * .4);
      setSheetHeight(height);
      ev.preventDefault();
    }

    function end() {
      if (!dragging) return;
      dragging = false;
      dom.panel.classList.remove('is-dragging');
      releaseSheetHeight();

      var stops = sheetStops();
      if (!moved) { toggle(); return; }
      if (height < stops.low * .72) { closePanel(); return; }
      sheetSnap(height > (stops.low + stops.high) / 2);
    }

    function toggle() {
      var stops = sheetStops();
      if (stops.high === stops.low) return;   /* the list has one height */
      sheetSnap(!document.body.classList.contains('sheet-full'));
    }

    dom.sheetGrip.addEventListener('pointerdown', begin);
    dom.sheetGrip.addEventListener('pointermove', move);
    dom.sheetGrip.addEventListener('pointerup', end);
    dom.sheetGrip.addEventListener('pointercancel', end);
    dom.sheetGrip.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
        ev.preventDefault();
        toggle();
      }
    });

    wireSheetSwipe();
  }

  /* Swiping the sheet down closes it, from anywhere in it rather than from the
   * 26px of grip at the top. The grip is a small target on a screen the sheet
   * is covering, and a swipe down is what a hand tries first.
   *
   * It arms only at the very top of the sheet's own scroll and only on a
   * downward move, so scrolling the list still scrolls the list: the first
   * touchmove decides which of the two this is, and the browser is only told
   * to keep its hands off once the sheet is the answer. Non-passive, because
   * preventDefault on that first move is the whole mechanism.
   */
  function wireSheetSwipe() {
    var scroll = dom.panelScroll;
    if (!scroll) return;
    var armed = false;
    var active = false;
    var startY = 0;
    var startH = 0;
    var height = 0;

    function ignore(node) {
      if (!node || !node.closest) return false;
      /* An embed handles its own gestures. A text field only wants its own
         while it is the one being typed in — a swipe that starts on the
         search box before you have touched it is a swipe like any other. */
      if (node.closest('iframe')) return true;
      var field = node.closest('input, textarea');
      return !!field && field === document.activeElement;
    }

    scroll.addEventListener('touchstart', function (ev) {
      armed = false;
      if (!isNarrow() || !dom.panel.classList.contains('is-open')) return;
      if (ev.touches.length !== 1 || ignore(ev.target)) return;
      armed = scroll.scrollTop <= 0;
      active = false;
      startY = ev.touches[0].clientY;
      startH = dom.panel.offsetHeight;
      height = startH;
    }, { passive: true });

    scroll.addEventListener('touchmove', function (ev) {
      if (!armed || ev.touches.length !== 1) return;
      var dy = ev.touches[0].clientY - startY;
      if (!active) {
        if (dy < 9) {
          if (dy < -3) armed = false;   /* they are scrolling, not dismissing */
          return;
        }
        active = true;
        dom.panel.classList.add('is-dragging');
      }
      height = Math.max(startH - dy, 80);
      setSheetHeight(height);
      if (ev.cancelable) ev.preventDefault();
    }, { passive: false });

    function release() {
      if (!armed) return;
      armed = false;
      if (!active) return;
      active = false;
      dom.panel.classList.remove('is-dragging');
      releaseSheetHeight();

      var stops = sheetStops();
      if (height < stops.low * .72) { closePanel(); return; }
      sheetSnap(height > (stops.low + stops.high) / 2);
    }

    scroll.addEventListener('touchend', release);
    scroll.addEventListener('touchcancel', release);
  }

  /* Nothing above the chips drags the map. That strip is chrome, and the map
   * shows through the gaps in it: between the card and the buttons, around
   * the chips, along the edges. A thumb aimed at a chip lands a few pixels
   * off often enough that the whole city used to come with it.
   *
   * Only the drag is turned off, not the events, so everything in the strip
   * still does its job: the handle still opens Instagram, the switcher still
   * changes language, the chips still scroll, and a pin that happens to be up
   * there still opens when you tap it. Leaflet binds its own drag to
   * touchstart and mousedown on the map container, so disabling the handler
   * from a capture listener on the document unbinds them before the event
   * ever gets that far. It goes back on when the finger lifts.
   */
  function wireTopGuard() {
    var held = false;

    function above(y) {
      if (!dom.filterBar || !map || !map.dragging) return false;
      return y <= dom.filterBar.getBoundingClientRect().bottom;
    }

    function hold(ev) {
      if (held) return;
      var y = ev.touches && ev.touches.length ? ev.touches[0].clientY : ev.clientY;
      if (typeof y !== 'number' || !above(y)) return;
      held = true;
      map.dragging.disable();
    }

    function release() {
      if (!held) return;
      held = false;
      if (map && map.dragging) map.dragging.enable();
    }

    /* pointerdown covers everything modern and fires before the compatibility
       events; the other two are there for anything that only sends those. */
    ['pointerdown', 'touchstart', 'mousedown'].forEach(function (type) {
      document.addEventListener(type, hold, true);
    });
    ['pointerup', 'pointercancel', 'touchend', 'touchcancel', 'mouseup'].forEach(function (type) {
      document.addEventListener(type, release, true);
    });
  }

  /* --------------------------------------------------------- soft keyboard
   * iOS shrinks the visual viewport when the keyboard comes up but leaves the
   * layout viewport — and with it anything position:fixed — exactly where it
   * was, so a bottom sheet keeps its full height and the bottom of it, along
   * with the field being typed into, ends up behind the keys. Worse, Safari
   * then scrolls the layout viewport to try to reveal the field, which drags
   * the whole sheet off the top of the screen.
   *
   * So measure what is covered, hand it to the stylesheet, and put the page
   * scroll back where it belongs. Android resizes the layout viewport itself
   * and the measurement comes out at zero, which is the right answer there.
   * A browser without visualViewport simply keeps the behaviour it had.
   */
  /* The height the sheet is measured against, written back to CSS so it does
     not have to trust a viewport unit. dvh is right where it is supported;
     this is the same number taken from the horse's mouth, and it is what the
     drag stops use, so the two can never disagree about how tall the sheet is
     allowed to be. */
  function syncViewportHeight() {
    document.documentElement.style.setProperty('--vph', window.innerHeight + 'px');
  }

  function wireKeyboard() {
    syncViewportHeight();
    window.addEventListener('resize', syncViewportHeight);
    window.addEventListener('orientationchange', syncViewportHeight);

    var vv = window.visualViewport;
    if (!vv) return;

    function sync() {
      var covered = window.innerHeight - vv.height - vv.offsetTop;
      /* Only a keyboard, not a URL bar sliding away. */
      var kbd = covered > 90 ? Math.round(covered) : 0;
      document.documentElement.style.setProperty('--kbd', kbd + 'px');
      if (kbd && window.pageYOffset) window.scrollTo(0, 0);
    }

    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    sync();
  }

  /* ----------------------------------------------------------------- panel */

  function openPanel() {
    dom.panel.classList.add('is-open');
    dom.panel.removeAttribute('inert');
    document.body.classList.add('panel-open');
    dom.btnList.setAttribute('aria-expanded', 'true');
  }

  function closePanel(opts) {
    if (!dom.panel.classList.contains('is-open')) return;
    var was = state.selected;
    dom.panel.classList.remove('is-open');
    dom.panel.setAttribute('inert', '');
    document.body.classList.remove('panel-open', 'sheet-full');
    releaseSheetHeight();
    lastSheetKey = null;
    dom.btnList.setAttribute('aria-expanded', 'false');

    state.selected = null;
    state.view = 'list';
    renderPanel();          /* leave the crawlable list in the markup */
    paintMarkers();
    if (!opts || opts.history !== false) syncUrl();
    lastTrackedPath = window.location.pathname + window.location.search;

    /* The panel was covering half the map, so the pin it was about was parked
       off to one side. With the panel gone, settle the map on it: closing a
       place leaves you looking at where it is, which is the only reason the
       map is underneath in the first place. */
    if (was) {
      var seen = byId(was);
      if (seen) focusOn(seen, false);
    }

    var back = state.lastFocus;
    state.lastFocus = null;
    if (back && document.contains(back) && typeof back.focus === 'function') back.focus();
  }

  function selectPlace(id, opts) {
    opts = opts || {};
    var place = byId(id);
    if (!place) return;
    if (!state.lastFocus) state.lastFocus = document.activeElement;

    var fresh = !state.selected;
    state.selected = id;
    state.view = 'detail';
    renderPanel();
    openPanel();
    /* A new place starts at the low stop: the point of opening one is to see
       where it is. */
    document.body.classList.remove('sheet-full');
    if (dom.sheetGrip) dom.sheetGrip.setAttribute('aria-expanded', 'false');
    releaseSheetHeight();
    if (opts.history !== false) syncUrl(fresh);

    paintMarkers();
    refocus(place, !!opts.fly);

    dom.panelScroll.scrollTop = 0;
    var heading = dom.detail.querySelector('.place-name');
    if (heading) heading.focus();

    trackView(place.name);
  }

  function showList(focus) {
    if (!state.lastFocus) state.lastFocus = document.activeElement;
    state.selected = null;
    state.view = 'list';
    renderPanel();
    openPanel();
    document.body.classList.remove('sheet-full');
    releaseSheetHeight();
    paintMarkers();
    syncUrl();
    dom.panelScroll.scrollTop = 0;
    if (focus) {
      var heading = dom.list.querySelector('#panel-list-title');
      if (heading) heading.focus();
    }
  }

  function renderPanel() {
    document.body.classList.toggle('panel-detail', state.view === 'detail' && !!state.selected);
    if (state.view === 'detail' && state.selected) {
      renderDetail(byId(state.selected));
      dom.detail.hidden = false;
      dom.list.hidden = true;
      dom.panel.setAttribute('aria-labelledby', 'panel-title');
    } else {
      clear(dom.detail);
      renderList();
      dom.detail.hidden = true;
      dom.list.hidden = false;
      dom.panel.setAttribute('aria-labelledby', 'panel-list-title');
    }
  }

  /* ------------------------------------------------------------ price gauge
   * Four slots, always four. The filled ones carry the accent, the rest are
   * ghosted in the hairline colour. It is the only gauge on the site.
   */
  function priceGauge(n) {
    var wrap = el('span', {
      className: 'price',
      role: 'img',
      'aria-label': t('priceOf', { n: n })
    });
    for (var i = 1; i <= 4; i++) {
      wrap.appendChild(el('i', { className: i <= n ? 'on' : '', textContent: '€' }));
    }
    return wrap;
  }

  /* A tel: link is what makes this dial rather than navigate: a phone hands it
     to the dialler with the number already typed in, and a desktop passes it to
     whichever calling app is registered. That is also why it never opens a new
     tab — there is no page to open. */
  function callButton(place) {
    var link = el('a', {
      className: 'link-btn call-btn',
      href: telHref(place.phone),
      'aria-label': t('call') + ' ' + place.name + ', ' + place.phone
    }, [
      el('span', {
        className: 'call-icon',
        html: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5.2 1.6c.4 0 .8.3.9.7l.8 2.4c.1.4 0 .8-.3 1l-1.1.9c.8 1.7 2.2 3.1 3.9 3.9l.9-1.1c.2-.3.6-.4 1-.3l2.4.8c.4.1.7.5.7.9v2.3c0 .6-.5 1.1-1.1 1C7.6 14.5 1.5 8.4 1.1 1.7c0-.6.4-1.1 1-1.1h3.1z"/></svg>'
      }),
      el('span', { textContent: t('call') })
    ]);
    link.addEventListener('click', function () {
      trackEvent('call_place', { place: place.name });
    });
    return link;
  }

  /* The button leaves the map for deal.html, which is where the code and the
     QR are made. Deliberately a link rather than a panel that opens in place:
     what the guest holds up at the till should be a page of its own, with an
     address they can reopen, not a state this one happens to be in. */
  function dealBlock(place, deal) {
    var offer = window.TTBPass.textFor(deal.offer, state.lang);
    var open = el('a', {
      className: 'link-btn is-primary',
      href: 'deal.html?r=' + encodeURIComponent(place.id),
      textContent: t('passGet')
    });
    open.addEventListener('click', function () {
      trackEvent('deal_open', { place: place.name });
    });

    return el('div', { className: 'deal-block' }, [
      offer ? el('p', { className: 'deal-offer', textContent: offer }) : null,
      open
    ]);
  }

  /* The offer, small enough to read at a glance in a list row. The number is
     taken from the line the deal already carries in the reader's language
     rather than written a second time in the data, and the whole match
     travels rather than the digits, because Turkish puts the sign in front:
     "%15 indirim". An offer with no percentage in it — a free coffee, a
     second pizza — falls back to the word the filter chip uses, which is the
     honest thing a badge can say when there is no number to show. */
  function dealMark(deal) {
    var offer = window.TTBPass.textFor(deal.offer, state.lang);
    var found = /%\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*%/.exec(offer);
    return el('span', {
      className: 'deal-mark',
      textContent: found ? '−' + found[0].replace(/\s+/g, '') : t('filterDiscount')
    });
  }

  function section(labelKey, body) {
    return el('div', { className: 'section' }, [
      el('p', { className: 'eyebrow', textContent: t(labelKey) }),
      body
    ]);
  }

  function plainSection(kids) {
    return el('div', { className: 'section' }, kids);
  }

  /* ---------------------------------------------------------------- detail */

  function renderDetail(place) {
    clear(dom.detail);
    if (!place) return;

    dom.detail.className = place.closed ? 'is-closed' : '';

    /* The city sits in the brand above and in every address below, and the
       coordinates are a machine's way of saying the same thing the address
       already says. The head keeps what only it can carry: the name, and
       whether the door still opens. */
    var deal = liveDealFor(place);

    dom.detail.appendChild(el('div', { className: 'place-head' }, [
      place.closed
        ? el('span', { className: 'closed-flag', textContent: t('closed') })
        : null,
      el('h2', {
        className: 'place-name',
        id: 'panel-title',
        tabindex: '-1',
        textContent: place.name
      }),
      /* The same badge the list row carries, in the same line as the price:
         the number is the part of a discount you decide on, and it belongs
         where the deciding happens rather than a scroll further down. What
         it is off, and the way to get it, wait below with everything else
         you would read once you have decided to go. */
      el('div', { className: 'head-meta' }, [
        priceGauge(place.price),
        deal ? dealMark(deal) : null
      ])
    ]));

    if (place.closed) {
      dom.detail.appendChild(el('p', { className: 'muted-note', textContent: t('closedNote') }));
    }

    /* What there is to see comes first, straight under the name, because it
       is the reason to keep reading. It used to sit two sections down, under
       the write-up and the tags, which meant the reel
       — the one thing on the page that is not text — had to be scrolled to.
       The video leads, the photos follow it, and a place with neither says so
       here rather than leaving you to reach the bottom and work it out.

       No video means no section at all — an empty "The reel" heading over a
       placeholder made six real places look half-finished. A quiet line says
       what is actually true instead: been, not filmed. */
    if (place.reel) {
      dom.detail.appendChild(section(reelWords(reelProvider(place.reel)).heading, reelBlock(place)));
    }

    if ((place.photos || []).length) {
      dom.detail.appendChild(section('photos', photoGrid(place)));
    }

    if (!place.reel && !(place.photos || []).length) {
      /* A heading of its own, in the slot the reel and the photos use, so the
         three kinds of place read as three kinds rather than as one kind and
         two omissions. */
      dom.detail.appendChild(section('markNone',
        el('p', { className: 'not-filmed', textContent: t('notFilmed') })
      ));
    }

    var blurb = blurbFor(place);
    if (blurb) {
      dom.detail.appendChild(el('p', {
        className: 'blurb' + (/^\s*TODO/i.test(blurb) ? ' is-todo' : ''),
        textContent: blurb
      }));
    }

    if ((place.types || []).length) {
      dom.detail.appendChild(section('types',
        el('div', { className: 'tag-row' }, place.types.map(function (id) {
          return el('span', { className: 'tag', textContent: typeLabel(id) });
        }))
      ));
    }

    if ((place.mustOrder || []).length) {
      dom.detail.appendChild(section('mustOrder',
        el('ul', { className: 'dish-list' }, place.mustOrder.map(function (dish) {
          return el('li', { textContent: dish });
        }))
      ));
    }

    /* The offer in full, and the button that makes the code, at the foot of
       the read: the badge at the top says how much, and this says what of and
       hands it over. It used to sit above the reel, which put a QR you are
       meant to hold up at a till in front of somebody still deciding whether
       to walk there — the pass is worth making once you have decided, and by
       then you are at the bottom of the panel anyway, next to the directions
       that take you to the door. */
    if (deal) dom.detail.appendChild(section('passOffer', dealBlock(place, deal)));

    dom.detail.appendChild(plainSection([
      el('dl', { className: 'facts' }, [
        el('dt', { textContent: t('address') }),
        el('dd', { textContent: place.address }),
        /* phone is optional — plenty of small places only answer the door */
        place.phone ? el('dt', { textContent: t('phone') }) : null,
        place.phone
          ? el('dd', {}, [
              el('a', { href: telHref(place.phone), textContent: place.phone })
            ])
          : null,
        /* visited is optional — a place with no video has no post to date it */
        place.visited ? el('dt', { textContent: t('visited') }) : null,
        place.visited ? el('dd', { textContent: formatMonth(place.visited) }) : null
      ]),
      el('div', { className: 'link-row' }, [
        el('a', {
          className: 'link-btn is-primary',
          href: 'https://www.google.com/maps/dir/?api=1&destination=' + place.lat + ',' + place.lng,
          target: '_blank',
          rel: 'noopener',
          textContent: t('directions')
        }),
        /* Calling sits next to the directions, which is the other thing you
           do about a place rather than to read about it: how to get there,
           and how to ask whether it is worth setting off. It rode with the
           name for a while, where it was the loudest thing on a panel about
           a restaurant nobody had decided on yet. No number means no
           button, and the number itself is still in the facts above. */
        place.phone ? callButton(place) : null,
        place.website
          ? el('a', {
              className: 'link-btn',
              href: place.website,
              target: '_blank',
              rel: 'noopener',
              textContent: t('website')
            })
          : null
      ])
    ]));
  }

  /* The field is called "reel" whichever platform it points at — renaming it
     would touch every place in the data for no gain. */
  function reelProvider(url) {
    if (/^https:\/\/www\.tiktok\.com\//.test(url || '')) return 'tiktok';
    if (/^https:\/\/www\.instagram\.com\//.test(url || '')) return 'instagram';
    return null;
  }

  /* TikTok says "video", Instagram says "reel". Use each one's own word. */
  function reelWords(provider) {
    return provider === 'tiktok'
      ? { heading: 'video', play: 'videoPlay', note: 'videoNote', fallback: 'videoFallback' }
      : { heading: 'reel', play: 'reelPlay', note: 'reelNote', fallback: 'reelFallback' };
  }

  function reelBlock(place) {
    var words = reelWords(reelProvider(place.reel));
    var slot = el('div', { className: 'reel-slot' });
    var button = el('button', { type: 'button', className: 'reel-play' }, [
      el('span', { className: 'tri', html: '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2 .8l8.5 5.2L2 11.2z"/></svg>' }),
      el('span', {}, [
        el('span', { className: 'lbl', textContent: t(words.play) }),
        el('span', { className: 'sub', textContent: t(words.note) })
      ])
    ]);

    button.addEventListener('click', function () {
      slot.replaceChild(embedReel(place.reel), button);
      trackEvent('reel_play', {
        place: place.name,
        provider: reelProvider(place.reel) || 'unknown'
      });
    });

    slot.appendChild(button);
    return slot;
  }

  function embedReel(url) {
    return reelProvider(url) === 'tiktok' ? embedTikTok(url) : embedInstagram(url);
  }

  /* TikTok publishes a plain iframe player, so there is no script to load and
     nothing to re-process — unlike Instagram's embed.js, which only scans for
     blockquotes when it runs and offers no hook for ones injected later. */
  function embedTikTok(url) {
    var id = /\/video\/(\d{6,})/.exec(url);
    var wrap = el('div', { className: 'reel-embed' });

    if (id) {
      wrap.appendChild(el('div', { className: 'tiktok-frame' }, [
        el('iframe', {
          src: 'https://www.tiktok.com/embed/v2/' + id[1],
          title: t('video'),
          allow: 'encrypted-media; picture-in-picture; fullscreen',
          allowfullscreen: '',
          loading: 'lazy',
          referrerpolicy: 'strict-origin-when-cross-origin',
          frameborder: '0',
          scrolling: 'no'
        })
      ]));
    }

    wrap.appendChild(el('p', { className: 'reel-fallback' }, [
      el('a', { href: url, target: '_blank', rel: 'noopener', textContent: t('videoFallback') })
    ]));
    return wrap;
  }

  /* Instagram's embed script is only fetched once the visitor asks for it.
     Injecting it up front would drag the whole map down on mobile data. */
  function embedInstagram(url) {
    var permalink = url.indexOf('?') === -1 ? url + '?utm_source=ig_embed' : url;

    var quote = el('blockquote', {
      className: 'instagram-media',
      'data-instgrm-permalink': permalink,
      'data-instgrm-version': '14',
      style: 'background:#FFF;border:0;margin:0;max-width:540px;min-width:0;padding:0;width:100%'
    }, [
      el('a', { href: permalink, target: '_blank', rel: 'noopener', textContent: url })
    ]);

    var wrap = el('div', { className: 'reel-embed' }, [
      quote,
      el('p', { className: 'reel-fallback' }, [
        el('a', { href: url, target: '_blank', rel: 'noopener', textContent: t('reelFallback') })
      ])
    ]);

    loadEmbedScript(function () {
      try { window.instgrm.Embeds.process(); } catch (e) { /* the fallback link stays */ }
    });

    return wrap;
  }

  function loadEmbedScript(done) {
    if (window.instgrm && window.instgrm.Embeds) { done(); return; }

    if (!document.getElementById('ig-embed-js')) {
      var script = document.createElement('script');
      script.id = 'ig-embed-js';
      script.async = true;
      script.src = 'https://www.instagram.com/embed.js';
      document.body.appendChild(script);
    }

    /* embed.js may already be in flight, or may take a moment to define
       window.instgrm, so poll rather than relying on the load event. */
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (window.instgrm && window.instgrm.Embeds) {
        clearInterval(timer);
        done();
      } else if (tries > 50) {          /* ~5 s, then give up quietly */
        clearInterval(timer);
      }
    }, 100);
  }

  function photoGrid(place) {
    var base = 'photos/' + place.id + '/';
    var grid = el('div', { className: 'photo-grid' });

    place.photos.forEach(function (file, i) {
      var button = el('button', {
        type: 'button',
        'aria-label': t('photoOf', { n: i + 1, total: place.photos.length })
      }, [
        el('img', {
          src: base + file,
          alt: place.name + ' — ' + t('photoOf', { n: i + 1, total: place.photos.length }),
          loading: 'lazy',
          decoding: 'async'
        })
      ]);
      button.addEventListener('click', function () {
        openLightbox(place, i, button);
      });
      grid.appendChild(button);
    });

    return grid;
  }

  /* ------------------------------------------------------------------ list */

  /* ------------------------------------------------------------ what is new
   * A map somebody follows needs to answer "what did you add since I last
   * looked", and an alphabetical list cannot: Vabrik has sat between Uba ja
   * Humal and Vana Villem since the day it went in.
   *
   * So the five newest go in a short section above the list. Always five, so
   * the shape of the panel never depends on how many places happened to go in
   * on one day, and the section is the same size every visit.
   *
   * They are lifted, not moved. The list underneath is still the whole list,
   * in alphabetical order, with those five in their usual places — open the
   * list and you see everything, the way you always did. The section on top
   * is a shortcut to the new ones, not a chunk taken out of the list.
   *
   * The dates come from the repo's own history rather than from memory. Every
   * place carries the day it first appeared in data/restaurants.json.
   */
  var NEW_COUNT = 5;

  /* Which places are new is a fact about the map, not about the filter in
     force. Reading it off the filtered list instead would let "Fine dining",
     whose five places are all old, report all five as just added. */
  function recentlyAdded() {
    var dated = state.places.filter(function (p) { return p.added && !p.closed; });
    dated.sort(function (a, b) {
      if (a.added !== b.added) return a.added < b.added ? 1 : -1;
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
    return dated.slice(0, NEW_COUNT);
  }

  /* ---------------------------------------------------------------- search
   * Accents are the whole problem: nobody types Telliskivi Šašlõkk with the
   * carons, and Põhja Konn with the tilde. So both sides of every comparison
   * are folded down to plain unaccented lowercase first — NFD splits a letter
   * from its marks, and the marks are dropped. The dotless Turkish i has no
   * decomposition of its own, so it is mapped by hand.
   *
   * What is searched is what a person could reasonably remember: the name,
   * the street, the type labels in whatever language they are reading, and
   * the dishes. Not the write-ups, which would match half the map on a word
   * like "good" and give no clue why.
   */
  function fold(value) {
    var out = String(value == null ? '' : value).toLowerCase();
    try { out = out.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { /* older engine */ }
    return out.replace(/[\u0131\u0130]/g, 'i').replace(/\u00f8/g, 'o').replace(/\u00df/g, 'ss');
  }

  /* Every language at once, not the one on screen. Somebody reading the map
     in Turkish still types "bakery" half the time, and somebody reading it in
     English may well know the place as a pagariäri. So a type carries all
     seven of its labels into the index and any of them matches, whatever the
     switcher happens to say.
     Names, streets and dishes are never translated, so they go in once.
     The index is built once from data that cannot change afterwards; folding
     sixty-eight of these on every keystroke would be work for nothing. */
  var hayIndex = null;

  function typeWords(id) {
    for (var i = 0; i < state.types.length; i++) {
      if (state.types[i].id === id) {
        var type = state.types[i];
        return Object.keys(type).map(function (k) {
          return k === 'id' ? '' : type[k];
        }).join(' ');
      }
    }
    return id;
  }

  function buildSearchIndex() {
    hayIndex = {};
    state.places.forEach(function (place) {
      hayIndex[place.id] = fold([
        place.name,
        place.address,
        (place.types || []).map(typeWords).join(' '),
        (place.mustOrder || []).join(' ')
      ].join(' '));
    });
  }

  /* Every word has to land somewhere, so "telliskivi kohvik" narrows rather
     than widening the way a plain substring match on the whole phrase would. */
  function matches(place, words) {
    var hay = (hayIndex && hayIndex[place.id]) || '';
    for (var i = 0; i < words.length; i++) {
      if (hay.indexOf(words[i]) === -1) return false;
    }
    return true;
  }

  function searchWords() {
    var q = fold(state.q).replace(/\s+/g, ' ').replace(/^ | $/g, '');
    return q ? q.split(' ') : [];
  }

  var searchTimer = null;

  function setQuery(value) {
    var next = String(value == null ? '' : value);
    if (dom.search.value !== next) dom.search.value = next;
    if (next === state.q) return;
    state.q = next;
    dom.searchClear.hidden = !next;
    renderList();
    trackSearch(next);
  }

  /* One event per search rather than one per keystroke: the report should say
     what people went looking for, not watch them spell it. */
  function trackSearch(q) {
    if (searchTimer) clearTimeout(searchTimer);
    var term = q.trim();
    if (term.length < 2) return;
    searchTimer = setTimeout(function () {
      trackEvent('search', { search_term: term.toLowerCase() });
    }, 900);
  }

  function renderList() {
    clear(dom.listBody);

    var words = searchWords();
    var places = visiblePlaces();
    if (words.length) {
      places = places.filter(function (p) { return matches(p, words); });
    }

    var collator;
    try { collator = new Intl.Collator(state.lang, { sensitivity: 'base' }); }
    catch (e) { collator = { compare: function (a, b) { return a < b ? -1 : a > b ? 1 : 0; } }; }
    places.sort(function (a, b) { return collator.compare(a.name, b.name); });

    if (!places.length) {
      /* The note is the heading here. Something has to carry the panel's
         label and take focus when the list opens, and with no groups on
         screen this line is the only thing left that says what you are
         looking at. */
      dom.listBody.appendChild(el('h2', {
        className: 'empty-note',
        id: 'panel-list-title',
        tabIndex: -1,
        textContent: words.length ? t('searchNone', { q: state.q.trim() }) : t('noResults')
      }));
      return;
    }

    function listRow(place) {
      /* A discount used to be something you could only find by opening the
         place, which meant opening seventy of them to learn that four save
         you money. It is the one thing in a row that is an
         offer rather than a description, so it is shown where the choosing
         happens — and spelled into the label in full, since "−15%" read out
         on its own says a number and not what it comes off. */
      var deal = liveDealFor(place);
      var offer = deal ? window.TTBPass.textFor(deal.offer, state.lang) : '';

      var row = el('button', {
        type: 'button',
        className: 'list-row' + (place.closed ? ' is-closed' : ''),
        /* The row's own label is what a screen reader reads, so anything the
           row shows has to be spelled into it or it is not there at all. */
        'aria-label': t('openPlace', { name: place.name }) + ', ' + t(depthMarkKey(place)) +
          (deal ? ', ' + (offer || t('filterDiscount')) : '')
      }, [
        el('span', { className: 'list-name', textContent: place.name }),
        el('span', { className: 'list-sub' }, [
          /* After the price, which holds the same edge on every row, and
             before the types, which are the part that can run long. */
          priceGauge(place.price),
          deal ? dealMark(deal) : null,
          el('span', {
            className: 'list-types',
            textContent: (place.types || []).map(typeLabel)
              .concat(place.closed ? [t('closed')] : [])
              .join(' · ')
          })
        ]),
        /* Last in the row and among the first things the eye lands on: it
           holds the same edge on every row, so it can be read straight down
           the list without reading the rows themselves. */
        depthMark(place)
      ]);
      row.addEventListener('click', function () { selectPlace(place.id, { fly: true }); });
      return el('li', {}, [row]);
    }

    /* Each group carries its own count, so the number always sits next to the
       list it is counting rather than under a panel title, where it read as a
       claim about the whole map.

       The group name is the biggest type in the panel, and there is no longer
       a title above it. There used to be: the panel opened with "All places"
       at 24px and then, directly underneath, a quiet grey signpost reading
       JUST ADDED over five rows. The big words named the group you were not
       looking at yet. Whichever group you are actually reading now says its
       own name, at the size the panel used to spend on a heading that was
       true of the scroll as a whole and of nothing on screen. */
    var first = true;
    function section(labelKey, rows, className) {
      var name = t(labelKey);
      var count = rows.length === 1 ? t('listCountOne') : t('listCount', { n: rows.length });
      /* Spelled out rather than left to the name computation: the two spans
         are flex items with no whitespace between them, so what a screen
         reader announces for the heading — and for the panel, which this
         labels — would come out as "Just added5 places". */
      var head = el('h2', { className: 'list-label', 'aria-label': name + ', ' + count }, [
        el('span', { className: 'list-group', textContent: name }),
        el('span', { className: 'list-label-n eyebrow', textContent: count })
      ]);
      /* The first group on screen is what labels the panel and what takes
         focus when the list opens, whichever group that turns out to be. */
      if (first) {
        head.id = 'panel-list-title';
        head.tabIndex = -1;
        first = false;
      }
      dom.listBody.appendChild(head);
      var ul = el('ul', { className: 'place-list' + (className ? ' ' + className : '') });
      rows.forEach(function (place) { ul.appendChild(listRow(place)); });
      dom.listBody.appendChild(ul);
    }

    /* Only the new ones the current filter has left on screen, and only if
       there are enough of them to be worth a heading of their own. A search
       suppresses the section outright: somebody who typed a word is looking
       for a particular place, and lifting two of the answers into a section
       of their own only makes them read the same names twice. */
    var shown = {};
    places.forEach(function (p) { shown[p.id] = true; });
    var fresh = words.length ? [] : recentlyAdded().filter(function (p) { return shown[p.id]; });

    if (fresh.length > 1) section('listNew', fresh, 'is-new');
    /* "All places" over a filtered list would be a lie the count sitting next
       to it immediately contradicts, so a narrowed list falls back to naming
       its sort order instead. */
    var everything = !words.length && !state.active.length;
    section(everything ? 'listTitle' : 'listAlphabet', places);
  }

  /* -------------------------------------------------------------- lightbox */

  function openLightbox(place, index, opener) {
    state.lb = {
      photos: place.photos.slice(),
      index: index,
      base: 'photos/' + place.id + '/',
      name: place.name,
      opener: opener || document.activeElement
    };
    dom.lightbox.hidden = false;
    paintLightbox();
    dom.lbClose.focus();
  }

  function paintLightbox() {
    var lb = state.lb;
    var many = lb.photos.length > 1;
    dom.lbImg.src = lb.base + lb.photos[lb.index];
    dom.lbImg.alt = lb.name + ' — ' + t('photoOf', { n: lb.index + 1, total: lb.photos.length });
    dom.lbCaption.textContent = lb.name + ' · ' + t('photoOf', { n: lb.index + 1, total: lb.photos.length });
    dom.lbPrev.hidden = !many;
    dom.lbNext.hidden = !many;
  }

  function stepLightbox(delta) {
    var lb = state.lb;
    if (lb.photos.length < 2) return;
    lb.index = (lb.index + delta + lb.photos.length) % lb.photos.length;
    paintLightbox();
  }

  function closeLightbox() {
    if (dom.lightbox.hidden) return;
    dom.lightbox.hidden = true;
    dom.lbImg.removeAttribute('src');
    var back = state.lb.opener;
    state.lb.opener = null;
    if (back && document.contains(back) && typeof back.focus === 'function') back.focus();
  }

  /* ------------------------------------------------------------------- URL */

  /* Opening a place is a step you can come back from, so it gets a history
     entry of its own; everything else — a filter, a language, a colour —
     rewrites the entry you are on. One entry per open place, not one per
     place: switching from one to another replaces, so Back always means
     "close this", never "walk back through everywhere I looked". */
  function syncUrl(push) {
    var params = new URLSearchParams(window.location.search);
    if (state.selected) params.set('spot', state.selected);
    else params.delete('spot');
    /* Chips in the address bar: a filtered map becomes a link worth sending,
       and the landing view GA records for it says which filters it was. */
    if (state.active.length) params.set('type', state.active.join(','));
    else params.delete('type');
    if (state.langPinned) params.set('lang', state.lang);
    else params.delete('lang');
    if (state.stylePinned) params.set('style', state.style);
    else params.delete('style');

    var query = params.toString();
    var next = window.location.pathname + (query ? '?' + query : '') + window.location.hash;
    try {
      if (push) window.history.pushState(null, '', next);
      else window.history.replaceState(null, '', next);
    } catch (e) { /* ignore */ }
  }

  /* Back and Forward. The address bar is the truth here: whatever entry the
     browser lands on, match it, and write nothing back while doing so. */
  function wireHistory() {
    window.addEventListener('popstate', function () {
      var spot = new URLSearchParams(window.location.search).get('spot');
      if (spot && byId(spot)) {
        if (state.selected !== spot) selectPlace(spot, { fly: true, history: false });
        return;
      }
      if (dom.panel.classList.contains('is-open')) closePanel({ history: false });
    });
  }

  /* ------------------------------------------------------------- analytics
   * Google Analytics, only if the tag in index.html is still there.
   *
   * This is one page, so GA on its own records a single view per visit and
   * tells you nothing about what anyone did on it. Two things are reported
   * on top of that.
   *
   * A page view per opened place, which lands in GA's standard Pages and
   * screens report with no setup in the console.
   *
   * And an event per deliberate action: which filter chips get pressed,
   * which language and colour people pick, whether they press Surprise me,
   * whether they play a reel. None of that changes the address bar on its
   * own, and GA only ever sees a URL, so without these events the whole of
   * it was invisible. They show up under Reports, Engagement, Events, and
   * the parameters (filter_id, language, style) need registering once as
   * custom dimensions in Admin if you want to break the numbers down by
   * them.
   *
   * To remove tracking completely: delete the gtag block in index.html and
   * these two functions. Every call below becomes a harmless no-op.
   */

  var lastTrackedPath = null;

  function trackEvent(name, params) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', name, params || {});
  }

  function trackView(title) {
    var here = window.location.pathname + window.location.search;
    if (here === lastTrackedPath) return;   /* don't double-count the landing URL */
    lastTrackedPath = here;
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', 'page_view', {
      page_location: window.location.href,
      page_title: title
    });
  }

  /* -------------------------------------------------------------- controls */

  function wireControls() {
    /* The panel is inert while closed, so the skip link opens it rather than
       trying to move focus into something that cannot take focus. */
    var skip = document.querySelector('.skip-link');
    if (skip) {
      skip.addEventListener('click', function (ev) {
        ev.preventDefault();
        showList(true);
      });
    }

    dom.btnList.addEventListener('click', function () {
      if (dom.panel.classList.contains('is-open') && state.view === 'list') closePanel();
      else { trackEvent('list_open', { places_shown: visiblePlaces().length }); showList(true); }
    });

    dom.btnRandom.addEventListener('click', randomPick);
    dom.btnRadio.addEventListener('click', toggleRadio);

    document.addEventListener('click', function (ev) {
      if (!dom.langSwitch.contains(ev.target)) closeLangMenu();
    });

    dom.panelClose.addEventListener('click', closePanel);
    wireSheet();
    wireKeyboard();


    dom.btnLocate.addEventListener('click', function () {
      trackEvent('locate');
      if (!navigator.geolocation) { toast(t('locateFail')); return; }
      /* setView is off: the framing is done in locationfound, which knows
         where the places are and Leaflet does not. */
      map.locate({ setView: false, maxZoom: 15 });
    });

    dom.lbClose.addEventListener('click', closeLightbox);
    dom.lbPrev.addEventListener('click', function () { stepLightbox(-1); });
    dom.lbNext.addEventListener('click', function () { stepLightbox(1); });
    dom.lightbox.addEventListener('click', function (ev) {
      if (ev.target === dom.lightbox) closeLightbox();
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        if (!dom.lightbox.hidden) { closeLightbox(); return; }
        if (dom.langSwitch.classList.contains('is-open')) { closeLangMenu(); return; }
        /* Escape in a search field empties the field. Only once it is already
           empty does it go on to close the panel, which is what a browser's
           own search inputs do. */
        if (document.activeElement === dom.search && state.q) { setQuery(''); return; }
        if (dom.panel.classList.contains('is-open')) closePanel();
        return;
      }
      if (dom.lightbox.hidden) return;
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); stepLightbox(-1); }
      if (ev.key === 'ArrowRight') { ev.preventDefault(); stepLightbox(1); }
      if (ev.key === 'Tab') keepFocusInLightbox(ev);
    });

    dom.search.addEventListener('input', function () { setQuery(dom.search.value); });
    dom.searchClear.addEventListener('click', function () {
      setQuery('');
      dom.search.focus();
    });
    /* Enter on a phone means "done": drop the keyboard rather than submit
       anything, since the list has already narrowed with every keystroke. */
    dom.search.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); dom.search.blur(); }
    });

    wireTopGuard();

    dom.filters.addEventListener('scroll', updateFilterFades, { passive: true });

    /* A desktop mouse only has a vertical wheel; turn that into sideways
       travel while the pointer is over the chip row. */
    dom.filters.addEventListener('wheel', function (ev) {
      if (Math.abs(ev.deltaY) <= Math.abs(ev.deltaX)) return;
      var box = dom.filters;
      if (box.scrollWidth <= box.clientWidth) return;
      box.scrollLeft += ev.deltaY;
      ev.preventDefault();
    }, { passive: false });

    window.addEventListener('resize', function () {
      placeRail();
      if (map) map.invalidateSize({ animate: false });
      updateFilterFades();
    });
  }

  function keepFocusInLightbox(ev) {
    var focusable = [dom.lbClose, dom.lbPrev, dom.lbNext].filter(function (n) { return !n.hidden; });
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    else if (focusable.indexOf(document.activeElement) === -1) { ev.preventDefault(); first.focus(); }
  }

  /* You are not a restaurant. The dot takes the palette's --here, a hue none
     of its pins use, and stands inside the circle the device actually claims
     as its accuracy, which is a thing no pin has. Past a kilometre the
     reading says little beyond "somewhere in town", so the circle is dropped
     rather than drawn as a lie the size of a district. */
  function wireLocation() {
    map.on('locationfound', function (ev) {
      var c = markerColours();

      if (hereAccuracy) { map.removeLayer(hereAccuracy); hereAccuracy = null; }
      if (hereMarker) { map.removeLayer(hereMarker); hereMarker = null; }

      if (ev.accuracy && ev.accuracy <= 1000) {
        hereAccuracy = L.circle(ev.latlng, {
          radius: Math.max(ev.accuracy, 12),
          weight: 1,
          color: c.here,
          opacity: .45,
          fillColor: c.here,
          fillOpacity: .14,
          className: 'here-accuracy',
          interactive: false
        }).addTo(map);
        if (hereAccuracy.bringToBack) hereAccuracy.bringToBack();
      }

      hereMarker = L.circleMarker(ev.latlng, {
        radius: 6,
        weight: 3,
        color: c.paper,
        fillColor: c.here,
        fillOpacity: 1,
        className: 'pin pin-here',
        interactive: false
      }).addTo(map);
      hereMarker.bindTooltip(t('locateHere'), { className: 'pin-tip', direction: 'top', offset: [0, -10] });

      frameHere(ev.latlng);
    });

    map.on('locationerror', function () { toast(t('locateFail')); });
  }

  /* How far the nearest place can be and still be worth framing next to you.
     Past that the two of you share no useful zoom — Tallinn is a dot on one
     edge of the screen and you are a dot on the other — so the map answers
     with the city instead, and says why. */
  var HERE_MAX_M = 25000;

  /* Where the map goes once it knows where you are. Dropping you at zoom 15
     is only an answer if there is something to eat around you: on the edge of
     town, or in the next country, it is a screen of streets with no pin on
     it, and no amount of pressing filter chips fills it in. So the view is
     framed on you *and* the nearest place the chips allow — you always land
     looking at somewhere you could walk to. */
  function frameHere(latlng) {
    /* A closed place is a grey pin kept for the links pointing at it, not
       somewhere to send you, so it is only the nearest thing if nothing open
       is left to be. */
    var pool = visiblePlaces().filter(function (p) { return !p.closed; });
    if (!pool.length) pool = visiblePlaces();
    if (!pool.length) pool = state.places;
    if (!pool.length) { travelTo(latlng, Math.max(map.getZoom(), 15), true); return; }

    var nearest = null;
    var best = Infinity;
    pool.forEach(function (p) {
      var away = latlng.distanceTo(L.latLng(p.lat, p.lng));
      if (away < best) { best = away; nearest = p; }
    });

    if (best > HERE_MAX_M) {
      toast(t('locateAway'));
      fitToPins({ animate: true });
      return;
    }

    /* No floor here: you and a place 20km apart need the zoom the pair of you
       actually take, which is further out than the city fit's own floor. */
    fitLatLngs([[latlng.lat, latlng.lng], [nearest.lat, nearest.lng]], {
      animate: true,
      maxZoom: 15,
      floor: 0
    });
  }

  /* ------------------------------------------------------------------ boot */

  function getJSON(path) {
    return fetch(path, { credentials: 'same-origin' }).then(function (res) {
      if (!res.ok) throw new Error(path + ': HTTP ' + res.status);
      return res.json();
    });
  }

  /* ------------------------------------------------------ structured data
   * One JSON-LD block describing the page and everything on it, built from
   * the same restaurants.json the map draws from, so it can never drift out
   * of sync the way a hand-written block would. Google runs this script
   * before it indexes, and reads what it finds.
   *
   * Built once, in whichever language the visitor landed in. Closed places
   * are left out: marking up a business that no longer serves anyone is a
   * false statement about the world, not an SEO trick worth playing.
   */
  function schemaType(place) {
    var types = place.types || [];
    if (types.indexOf('bakery') !== -1) return 'Bakery';
    if (types.indexOf('pub') !== -1) return 'BarOrPub';
    if (types.indexOf('coffee') !== -1) return 'CafeOrCoffeeShop';
    return 'Restaurant';
  }

  /* "Ankru 8, 11713 Tallinn" -> street, postcode and town as separate fields.
     Anything that does not match that shape is passed through whole. */
  function postalAddress(address) {
    var out = { '@type': 'PostalAddress', addressCountry: 'EE' };
    var parts = String(address || '').split(',');
    var tail = (parts.length > 1 ? parts.pop() : '').trim();
    var code = tail.match(/^(\d{5})\s+(.+)$/);

    if (code) { out.postalCode = code[1]; out.addressLocality = code[2]; }
    else if (tail) { out.addressLocality = tail; }
    else { out.addressLocality = 'Tallinn'; }

    var street = parts.join(',').trim();
    if (street) out.streetAddress = street;
    return out;
  }

  function injectStructuredData() {
    var base = canonicalBase();
    var items = [];

    state.places.forEach(function (place) {
      if (place.closed) return;
      var node = {
        '@type': schemaType(place),
        name: place.name,
        address: postalAddress(place.address),
        geo: { '@type': 'GeoCoordinates', latitude: place.lat, longitude: place.lng },
        url: base + '?spot=' + encodeURIComponent(place.id)
      };
      var blurb = place.blurb && (place.blurb[state.lang] || place.blurb[DEFAULT_LANG]);
      if (blurb) node.description = blurb;
      if (place.price) node.priceRange = new Array(place.price + 1).join('\u20ac');
      items.push({ '@type': 'ListItem', position: items.length + 1, item: node });
    });

    var graph = [
      {
        '@type': 'WebSite',
        '@id': base + '#website',
        url: base,
        name: 'Tallinn Tastebuds',
        inLanguage: state.lang,
        description: t('tagline'),
        sameAs: ['https://www.instagram.com/tallinntastebuds/']
      },
      {
        '@type': 'ItemList',
        name: t('documentTitle'),
        numberOfItems: items.length,
        itemListOrder: 'https://schema.org/ItemListUnordered',
        itemListElement: items
      }
    ];

    var tag = document.createElement('script');
    tag.type = 'application/ld+json';
    tag.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
    document.head.appendChild(tag);
  }

  /* The map is one page. ?spot, ?lang and ?style are deep links into it, not
     separate documents, so point every one of them at the bare URL and let
     the search engine pool the signals there instead of splitting them.
     index.html carries the real address; this only fills in when the page is
     opened from somewhere that has none, a preview build or a local file. */
  function canonicalBase() {
    var link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      link.setAttribute('href', window.location.origin + window.location.pathname);
      document.head.appendChild(link);
    }
    var href = link.getAttribute('href') || '';
    return href.charAt(href.length - 1) === '/' ? href : href + '/';
  }

  function boot() {
    dom = {
      map: $('map'),
      brand: $('brand'),
      langSwitch: $('lang-switch'),
      filters: $('filters'),
      filterBar: $('filter-bar'),
      styles: $('styles'),
      rail: $('rail'),
      btnRandom: $('btn-random'),
      panel: $('panel'),
      panelScroll: $('panel-scroll'),
      panelClose: $('panel-close'),
      sheetGrip: $('sheet-grip'),
      btnRadio: $('btn-radio'),
      radioName: $('radio-name'),
      detail: $('panel-detail'),
      list: $('panel-list'),
      listBody: $('list-body'),
      search: $('list-search'),
      searchClear: $('search-clear'),
      btnList: $('btn-list'),
      btnLocate: $('btn-locate'),
      lightbox: $('lightbox'),
      lbImg: $('lb-img'),
      lbCaption: $('lb-caption'),
      lbClose: $('lb-close'),
      lbPrev: $('lb-prev'),
      lbNext: $('lb-next'),
      toast: $('toast')
    };

    dom.panel.setAttribute('inert', '');

    Promise.all([
      getJSON('data/restaurants.json'),
      getJSON('data/taxonomy.json'),
      getJSON('data/ui.json'),
      /* Optional in the same way the station is: no file, no deals, and the
         panel never grows the section. */
      getJSON('data/deals.json').catch(function () { return []; }),
      /* The station is optional in every sense: no file, no station, no
         button, and the rest of the map does not notice. */
      getJSON('data/radio.json').catch(function () { return null; })
    ]).then(function (loaded) {
      state.places = loaded[0] || [];
      state.types = (loaded[1] && loaded[1].types) || [];
      state.deals = loaded[3] || [];
      state.radio = loaded[4] || null;
      state.ui = loaded[2] || {};
      state.langs = Object.keys(state.ui);

      var chosen = pickLanguage(state.langs);
      state.lang = chosen.lang;
      state.langPinned = chosen.pinned;

      /* Chips before the map, so the opening view fits the filtered set. */
      var picked = new URLSearchParams(window.location.search).get('type');
      if (picked) {
        var live = usedTypeIds();
        if (anyLiveDeal()) live = live.concat(DEAL_FILTER);
        state.active = picked.split(',').filter(function (id) {
          return live.indexOf(id) !== -1;
        });
      }

      /* Style before the map, so the first tile request is already the right
         basemap and the pins are built from the right tokens. */
      var styled = pickStyle();
      state.style = styled.style;
      state.stylePinned = styled.pinned;
      applyStyle(state.style);

      buildSearchIndex();
      applyStaticStrings();
      renderLanguageSwitch();
      renderStyleSwitch();
      initMap();
      wireLocation();
      buildMarkers();
      renderFilters();
      renderPanel();
      renderRadio();
      wireControls();

      /* gtag already reported the landing URL, deep link and all. */
      lastTrackedPath = window.location.pathname + window.location.search;

      placeRail();
      injectStructuredData();

      wireHistory();

      /* The bare map goes into the entry the visitor arrived on, whether or
         not they arrived on a place. So a link straight to a place still has
         somewhere to go Back to: the map, standing on that place. */
      var spot = new URLSearchParams(window.location.search).get('spot');
      syncUrl();
      if (spot && byId(spot)) selectPlace(spot, { fly: true });
    }).catch(function (err) {
      if (window.console && console.error) console.error(err);
      var note = el('div', { className: 'noscript card' }, [
        el('p', { className: 'eyebrow', textContent: 'Tallinn' }),
        el('h2', { textContent: 'Tallinn Tastebuds' }),
        el('p', { textContent: (state.ui.en && state.ui.en.loadError) || 'Something went wrong loading the data. Try refreshing the page.' })
      ]);
      document.body.appendChild(note);
    });
  }

  boot();
}());
