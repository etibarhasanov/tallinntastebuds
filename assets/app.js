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
    { id: 'green',  dark: false },
    { id: 'blue',   dark: false },
    { id: 'indigo', dark: true  },
    { id: 'violet', dark: false }
  ];
  var DEFAULT_STYLE = 'blue';
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
  var hereMarker = null;
  var tileLayer = null;
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

  function formatMonth(ym) {
    var m = /^(\d{4})-(\d{2})$/.exec(ym || '');
    if (!m) return ym || '';
    try {
      return new Intl.DateTimeFormat(state.lang, {
        year: 'numeric', month: 'long', timeZone: 'UTC'
      }).format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)));
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

  function renderLanguageSwitch() {
    clear(dom.langSwitch);
    state.langs.forEach(function (code) {
      var btn = el('button', {
        type: 'button',
        className: 'btn btn-lang',
        lang: code,
        'aria-label': (state.ui[code] && state.ui[code].langName) || code,
        'aria-pressed': String(code === state.lang),
        textContent: code.toUpperCase()
      });
      btn.addEventListener('click', function () { setLanguage(code); });
      dom.langSwitch.appendChild(btn);
    });
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

    restyleMarkers();
    markStyleSwitch();
    syncUrl();
  }

  /* Pressed state only, so activating a swatch by keyboard keeps focus on it. */
  /* The rail is vertically centred, which collides with the brand card on a
     short window. Nudge it down only when it actually would. */
  function placeRail() {
    if (!dom.rail || !dom.brand) return;
    dom.rail.style.top = '';
    dom.rail.style.transform = '';
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

  /* Pin colours are read from the tokens, so they have to be re-read whenever
     the tokens change. */
  function restyleMarkers() {
    var accent = cssVar('--accent') || '#00539c';
    var muted = cssVar('--muted') || '#5f6b75';
    var paper = cssVar('--paper') || '#ffffff';

    state.places.forEach(function (place) {
      var marker = markers[place.id];
      if (!marker) return;
      marker.setStyle({ color: paper, fillColor: place.closed ? muted : accent });
    });

    if (hereMarker) {
      hereMarker.setStyle({ color: paper, fillColor: cssVar('--accent-lit') || '#0072ce' });
    }
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
  }

  function buildMarkers() {
    var accent = cssVar('--accent') || '#00539c';
    var muted = cssVar('--muted') || '#5f6b75';
    var paper = cssVar('--paper') || '#ffffff';

    state.places.forEach(function (place) {
      var marker = L.circleMarker([place.lat, place.lng], {
        radius: 7,
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
  }

  function fitToPins() {
    var pts = visiblePlaces().map(function (p) { return [p.lat, p.lng]; });
    if (!pts.length) pts = state.places.map(function (p) { return [p.lat, p.lng]; });
    if (!pts.length) return;
    map.fitBounds(L.latLngBounds(pts), {
      padding: isNarrow() ? [48, 48] : [96, 96],
      maxZoom: 16,
      animate: false
    });
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
        applyFilters();
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

  function applyFilters() {
    var shown = {};
    visiblePlaces().forEach(function (p) { shown[p.id] = true; });

    state.places.forEach(function (p) {
      var marker = markers[p.id];
      if (!marker) return;
      if (shown[p.id]) { if (!map.hasLayer(marker)) marker.addTo(map); }
      else if (map.hasLayer(marker)) map.removeLayer(marker);
    });

    renderFilters();
    if (state.view === 'list') renderPanel();
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
    selectPlace(choice.id, { fly: true });
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
    document.body.classList.remove('panel-open');
    dom.btnList.setAttribute('aria-expanded', 'false');

    state.selected = null;
    state.view = 'list';
    renderPanel();          /* leave the crawlable list in the markup */
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
    syncUrl();

    var target = [place.lat, place.lng];
    if (opts && opts.fly) {
      map.setView(target, Math.max(map.getZoom(), 15), { animate: !reduceMotion() });
    } else if (!map.getBounds().pad(-0.15).contains(target)) {
      map.panTo(target, { animate: !reduceMotion() });
    }

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
    syncUrl();
    dom.panelScroll.scrollTop = 0;
    if (focus) {
      var heading = dom.list.querySelector('.list-title');
      if (heading) heading.focus();
    }
  }

  function renderPanel() {
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

    dom.detail.appendChild(section('reel', reelBlock(place)));

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
        el('dt', { textContent: t('visited') }),
        el('dd', { textContent: formatMonth(place.visited) }),
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

  function reelBlock(place) {
    if (!place.reel) {
      return el('p', { className: 'muted-note', textContent: t('reelNone') });
    }

    var slot = el('div', { className: 'reel-slot' });
    var button = el('button', { type: 'button', className: 'reel-play' }, [
      el('span', { className: 'tri', html: '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2 .8l8.5 5.2L2 11.2z"/></svg>' }),
      el('span', {}, [
        el('span', { className: 'lbl', textContent: t('reelPlay') }),
        el('span', { className: 'sub', textContent: t('reelNote') })
      ])
    ]);

    button.addEventListener('click', function () {
      slot.replaceChild(embedReel(place.reel), button);
    });

    slot.appendChild(button);
    return slot;
  }

  /* Instagram's embed script is only fetched once the visitor asks for it.
     Injecting it up front would drag the whole map down on mobile data. */
  function embedReel(url) {
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
            textContent: (place.types || []).map(typeLabel).join(' · ') +
              (place.closed ? ' · ' + t('closed') : '')
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
   * tells you nothing about which places people actually open. Opening a
   * place therefore reports its own page view, which lands in GA's standard
   * Pages and screens report with no setup in the console.
   *
   * To remove tracking completely: delete the gtag block in index.html and
   * this function. The two calls below become harmless no-ops.
   */

  var lastTrackedPath = null;

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
      else showList(true);
    });

    dom.btnRandom.addEventListener('click', randomPick);

    dom.panelClose.addEventListener('click', closePanel);

    dom.btnZoomIn.addEventListener('click', function () { map.zoomIn(); });
    dom.btnZoomOut.addEventListener('click', function () { map.zoomOut(); });

    dom.btnLocate.addEventListener('click', function () {
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

  function wireLocation() {
    var accentLit = cssVar('--accent-lit') || '#0072ce';
    var paper = cssVar('--paper') || '#ffffff';

    map.on('locationfound', function (ev) {
      if (hereMarker) map.removeLayer(hereMarker);
      hereMarker = L.circleMarker(ev.latlng, {
        radius: 6,
        weight: 3,
        color: paper,
        fillColor: accentLit,
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
