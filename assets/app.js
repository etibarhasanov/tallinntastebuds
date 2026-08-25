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

  /* One style per colour of the spectrum. Only the Indigo one is dark, and it
     is the only one that needs different tiles — dark cards over the pale
     Positron basemap would be unreadable. */
  var STYLES = [
    { id: 'red',    dark: false },
    { id: 'orange', dark: false },
    { id: 'yellow', dark: false },
    { id: 'green',  dark: true  },
    { id: 'blue',   dark: false },
    { id: 'indigo', dark: true  },
    { id: 'violet', dark: false }
  ];
  var DEFAULT_STYLE = 'blue';
  var PIN_R = 7;             /* every pin */
  var PIN_R_SELECTED = 10;   /* the one you are looking at */
  var STYLE_KEY = 'ttb.style';
  var TILE_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
    '&copy; <a href="https://carto.com/attributions">CARTO</a>';

  /* ----------------------------------------------------------------- state */

  var state = {
    places: [],
    types: [],
    ui: {},
    langs: [],
    lang: DEFAULT_LANG,
    langPinned: false,
    style: DEFAULT_STYLE,
    stylePinned: false,
    lastPick: null,
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

  function coordText(place) {
    return place.lat.toFixed(5) + ', ' + place.lng.toFixed(5);
  }

  function byId(id) {
    for (var i = 0; i < state.places.length; i++) {
      if (state.places[i].id === id) return state.places[i];
    }
    return null;
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
    syncUrl();
    trackEvent('language_select', { language: code });
  }

  /* ---------------------------------------------------------------- styles
   * Seven palettes, one per colour of the spectrum. Each is nothing but a
   * block of custom properties in styles.css, so switching one re-colours the
   * whole site without touching a single component rule.
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

  function makeTiles(dark) {
    return L.tileLayer(dark ? TILE_URL_DARK : TILE_URL, {
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
    if (theme) theme.setAttribute('content', cssVar('--wash') || '#f2f1ec');
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
    var muted = cssVar('--muted') || '#5f6b75';
    var paper = cssVar('--paper') || '#ffffff';

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

  function fitToPins() {
    var pts = visiblePlaces().map(function (p) { return [p.lat, p.lng]; });
    if (!pts.length) pts = state.places.map(function (p) { return [p.lat, p.lng]; });
    if (!pts.length) return;
    map.fitBounds(L.latLngBounds(pts), {
      padding: isNarrow() ? [48, 48] : [96, 96],
      maxZoom: 16,
      animate: false
    });
    if (map.getZoom() < FIT_FLOOR) map.setZoom(FIT_FLOOR, { animate: false });
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

  function markerColours() {
    return {
      accent: cssVar('--accent') || '#00539c',
      lit: cssVar('--accent-lit') || '#0072ce',
      muted: cssVar('--muted') || '#5f6b75',
      paper: cssVar('--paper') || '#ffffff',
      here: cssVar('--here') || '#c1420b'
    };
  }

  function tooltipFor(marker, name, permanent, chosen) {
    marker.unbindTooltip();
    marker.bindTooltip(name, {
      className: 'pin-tip' + (chosen ? ' pin-tip-on' : '') + (permanent && !chosen ? ' pin-tip-quiet' : ''),
      direction: 'top',
      offset: [0, permanent ? -14 : -11],
      opacity: 1,
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

      /* A place that has been filmed is drawn solid, one that has not is
         drawn as a ring. Two states of one shape rather than two icons: at
         14px a picture inside a dot is mud, and the map is 63 dots. The
         chosen place keeps whichever of the two it is, so the map never
         stops telling you which places have something to watch. */
      var filmed = !!place.reel;
      var tone = chosen ? c.lit : (place.closed ? c.muted : c.accent);

      marker.setStyle({
        radius: chosen ? PIN_R_SELECTED : (filmed ? PIN_R : PIN_R - 1),
        weight: chosen ? 3.5 : 2.5,
        color: filmed ? c.paper : tone,
        fillColor: filmed ? tone : c.paper
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
    map.setView(centre, zoom, { animate: !reduceMotion() });
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

  function visiblePlaces() {
    if (!state.active.length) return state.places.slice();
    return state.places.filter(function (p) {
      return (p.types || []).some(function (id) { return state.active.indexOf(id) !== -1; });
    });
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

  function pinGroups(places) {
    var zoom = map.getZoom();
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

    function open() {
      trackEvent('cluster_open', { cluster_size: count });
      var pts = group.map(function (m) { return [m.place.lat, m.place.lng]; });
      map.fitBounds(L.latLngBounds(pts), {
        padding: isNarrow() ? [56, 56] : [110, 110],
        maxZoom: Math.min(map.getZoom() + 4, 18),
        animate: !reduceMotion()
      });
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
  function sheetStops() {
    var h = window.innerHeight;
    if (document.body.classList.contains('panel-detail')) {
      return { low: Math.min(h * .50, 470), high: Math.min(h * .88, 780) };
    }
    /* The list is already as tall as it gets; it can only be dragged shut. */
    var list = Math.min(h * .82, 720);
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
  }

  /* ----------------------------------------------------------------- panel */

  function openPanel() {
    dom.panel.classList.add('is-open');
    dom.panel.removeAttribute('inert');
    document.body.classList.add('panel-open');
    dom.btnList.setAttribute('aria-expanded', 'true');
  }

  function closePanel() {
    if (!dom.panel.classList.contains('is-open')) return;
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
    syncUrl();
    lastTrackedPath = window.location.pathname + window.location.search;

    var back = state.lastFocus;
    state.lastFocus = null;
    if (back && document.contains(back) && typeof back.focus === 'function') back.focus();
  }

  function selectPlace(id, opts) {
    var place = byId(id);
    if (!place) return;
    if (!state.lastFocus) state.lastFocus = document.activeElement;

    state.selected = id;
    state.view = 'detail';
    renderPanel();
    openPanel();
    /* A new place starts at the low stop: the point of opening one is to see
       where it is. */
    document.body.classList.remove('sheet-full');
    if (dom.sheetGrip) dom.sheetGrip.setAttribute('aria-expanded', 'false');
    releaseSheetHeight();
    syncUrl();

    paintMarkers();
    refocus(place, !!(opts && opts.fly));

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
      var heading = dom.list.querySelector('.list-title');
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

    dom.detail.appendChild(el('div', { className: 'place-head' }, [
      place.closed
        ? el('span', { className: 'closed-flag', textContent: t('closed') })
        : el('p', { className: 'eyebrow', textContent: t('eyebrow') }),
      el('h2', {
        className: 'place-name',
        id: 'panel-title',
        tabindex: '-1',
        textContent: place.name
      }),
      el('div', { className: 'head-meta' }, [
        priceGauge(place.price),
        el('span', { className: 'coords', textContent: coordText(place) })
      ])
    ]));

    if (place.closed) {
      dom.detail.appendChild(el('p', { className: 'muted-note', textContent: t('closedNote') }));
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

    /* No video means no section at all — an empty "The reel" heading over a
       placeholder made six real places look half-finished. A quiet line says
       what is actually true instead: been, not filmed. */
    if (place.reel) {
      dom.detail.appendChild(section(reelWords(reelProvider(place.reel)).heading, reelBlock(place)));
    } else {
      dom.detail.appendChild(el('p', { className: 'not-filmed', textContent: t('notFilmed') }));
    }

    if ((place.mustOrder || []).length) {
      dom.detail.appendChild(section('mustOrder',
        el('ul', { className: 'dish-list' }, place.mustOrder.map(function (dish) {
          return el('li', { textContent: dish });
        }))
      ));
    }

    if ((place.photos || []).length) {
      dom.detail.appendChild(section('photos', photoGrid(place)));
    }

    dom.detail.appendChild(plainSection([
      el('dl', { className: 'facts' }, [
        el('dt', { textContent: t('address') }),
        el('dd', { textContent: place.address }),
        /* visited is optional — a place with no video has no post to date it */
        place.visited ? el('dt', { textContent: t('visited') }) : null,
        place.visited ? el('dd', { textContent: formatMonth(place.visited) }) : null,
        el('dt', { textContent: t('coordinates') }),
        el('dd', { className: 'mono', textContent: coordText(place) })
      ]),
      el('div', { className: 'link-row' }, [
        el('a', {
          className: 'link-btn is-primary',
          href: 'https://www.google.com/maps/dir/?api=1&destination=' + place.lat + ',' + place.lng,
          target: '_blank',
          rel: 'noopener',
          textContent: t('directions')
        }),
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

  function renderList() {
    clear(dom.list);

    var places = visiblePlaces();
    var collator;
    try { collator = new Intl.Collator(state.lang, { sensitivity: 'base' }); }
    catch (e) { collator = { compare: function (a, b) { return a < b ? -1 : a > b ? 1 : 0; } }; }
    places.sort(function (a, b) { return collator.compare(a.name, b.name); });

    dom.list.appendChild(el('div', { className: 'list-head' }, [
      el('p', { className: 'eyebrow', textContent: t('eyebrow') }),
      el('h2', {
        className: 'list-title',
        id: 'panel-list-title',
        tabindex: '-1',
        textContent: t('listTitle')
      }),
      el('p', {
        className: 'list-count',
        textContent: places.length === 1 ? t('listCountOne') : t('listCount', { n: places.length })
      })
    ]));

    if (!places.length) {
      dom.list.appendChild(el('p', { className: 'empty-note', textContent: t('noResults') }));
      return;
    }

    var ul = el('ul', { className: 'place-list' });
    places.forEach(function (place) {
      var row = el('button', {
        type: 'button',
        className: 'list-row' + (place.closed ? ' is-closed' : ''),
        'aria-label': t('openPlace', { name: place.name })
      }, [
        el('span', { className: 'list-name', textContent: place.name }),
        el('span', { className: 'list-sub' }, [
          priceGauge(place.price),
          el('span', {
            textContent: (place.types || []).map(typeLabel)
              .concat(place.closed ? [t('closed')] : [])
              .join(' · ')
          })
        ])
      ]);
      row.addEventListener('click', function () { selectPlace(place.id, { fly: true }); });
      ul.appendChild(el('li', {}, [row]));
    });
    dom.list.appendChild(ul);
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

  function syncUrl() {
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
    try { window.history.replaceState(null, '', next); } catch (e) { /* ignore */ }
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

    document.addEventListener('click', function (ev) {
      if (!dom.langSwitch.contains(ev.target)) closeLangMenu();
    });

    dom.panelClose.addEventListener('click', closePanel);
    wireSheet();

    dom.btnZoomIn.addEventListener('click', function () { map.zoomIn(); });
    dom.btnZoomOut.addEventListener('click', function () { map.zoomOut(); });

    dom.btnLocate.addEventListener('click', function () {
      trackEvent('locate');
      if (!navigator.geolocation) { toast(t('locateFail')); return; }
      map.locate({ setView: true, maxZoom: 15 });
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
        if (dom.panel.classList.contains('is-open')) closePanel();
        return;
      }
      if (dom.lightbox.hidden) return;
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); stepLightbox(-1); }
      if (ev.key === 'ArrowRight') { ev.preventDefault(); stepLightbox(1); }
      if (ev.key === 'Tab') keepFocusInLightbox(ev);
    });

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
    });

    map.on('locationerror', function () { toast(t('locateFail')); });
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
      detail: $('panel-detail'),
      list: $('panel-list'),
      btnList: $('btn-list'),
      btnLocate: $('btn-locate'),
      btnZoomIn: $('btn-zoom-in'),
      btnZoomOut: $('btn-zoom-out'),
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
      getJSON('data/ui.json')
    ]).then(function (loaded) {
      state.places = loaded[0] || [];
      state.types = (loaded[1] && loaded[1].types) || [];
      state.ui = loaded[2] || {};
      state.langs = Object.keys(state.ui);

      var chosen = pickLanguage(state.langs);
      state.lang = chosen.lang;
      state.langPinned = chosen.pinned;

      /* Chips before the map, so the opening view fits the filtered set. */
      var picked = new URLSearchParams(window.location.search).get('type');
      if (picked) {
        var live = usedTypeIds();
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

      applyStaticStrings();
      renderLanguageSwitch();
      renderStyleSwitch();
      initMap();
      wireLocation();
      buildMarkers();
      renderFilters();
      renderPanel();
      wireControls();

      /* gtag already reported the landing URL, deep link and all. */
      lastTrackedPath = window.location.pathname + window.location.search;

      placeRail();
      injectStructuredData();

      var spot = new URLSearchParams(window.location.search).get('spot');
      if (spot && byId(spot)) selectPlace(spot, { fly: true });
      else syncUrl();
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
