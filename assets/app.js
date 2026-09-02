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
  /* Every pin is the mark — the mouth out of the painting, cropped round.
     The circle is left to the one dot on the map that is not a place: the one
     that says where you are. So the sizes below are diameters of a picture,
     not radii of a dot, and the box the picture is drawn in is fixed, so a
     pin can change size without Leaflet re-anchoring anything under it. */
  var PIN_D = 22;            /* every pin */
  var PIN_D_WORDS = 17;      /* the write-up-only ones, drawn smaller */
  var PIN_D_SELECTED = 34;   /* the one you are looking at */
  var PIN_D_KEPT = 29;       /* the one you were looking at, panel now shut */
  var PIN_BOX = 46;          /* the icon box each of those is centred in */
  /* How close the map settles on a single place — opening one, closing one,
     or filtering down to one. Street level: near enough that the pin sits in
     a block you can recognise and walk from, rather than in a city. */
  var FOCUS_ZOOM = 16;
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
    saves: {},           // place id -> how many people, from /api/saves
    saved: [],           // the places the signed-in account has saved
    /* Who is signed in, whether they have a recovery address on file, and
       whether the site can send email at all. All three come from
       /api/account and all three are absent until it answers. */
    account: { ready: false, user: null, recovery: false, email: false },
    selected: null,      // restaurant id, or null
    /* The place you last opened, kept lit on the map after the panel shuts.
       Closing a write-up used to put the pin back in the crowd, so the answer
       to "where was that one?" went out with the panel that raised the
       question. The mark outlives the panel and only a different place, or a
       filter that rules it out, takes it. */
    marked: null,        // restaurant id, or null
    view: 'list',        // 'list' | 'detail'
    lastFocus: null,
    lb: { photos: [], index: 0, base: '', name: '', opener: null },
    stories: [],         // data/stories.json, usually empty
    /* The queue being watched right now: which stories are up, which one is
       on screen, whether a finger is holding it still, and what to give the
       focus back to when it closes. */
    story: {
      list: [], index: 0, opener: null, muted: true,
      held: false, dragging: false, swallow: false, downX: 0, downY: 0,
      /* A photograph has no clock of its own, so the viewer keeps one for it:
         how much of its time has been spent, and when the current run of it
         started. Holding banks the first and clears the second. */
      photoSpent: 0, photoFrom: 0
    }
  };

  var map = null;
  var markers = {};      // id -> L.Marker, the mark on a divIcon
  var closedRings = {};  // id -> L.CircleMarker, the dashed ring round a shut place
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

  /* The switch reads in alphabetical order rather than in whatever order the
     blocks happen to sit in ui.json. It sorts on the code, not on the name:
     the codes are the row the desktop shows, they are Latin whatever the
     language writes itself in, and sorting on them keeps Հայերեն in the
     middle of the list where its code puts it instead of trailing the Latin
     names the way a collator would push it. Two lowercase ASCII letters, so
     a plain sort is the alphabet. */
  function sortLanguages(codes) {
    return codes.slice().sort();
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
    /* applyStaticStrings has just put "Account" back on the button through
       its data-i18n, which is the right word for a stranger and the wrong one
       for somebody signed in: the button wears their name. So it is repainted
       from the state rather than from the markup, before the rail goes and
       reads it out below. */
    paintAccountButton();
    renderStoryRing();
    if (dom.stories && !dom.stories.hidden) paintStoryText(state.story.list[state.story.index]);
    syncUrl();
    /* Every label on the page just changed language, and on a phone the rail
       buttons are the only ones whose label is not on screen to change with
       them. So they say themselves again, in the language just picked:
       somebody switching to Ukrainian is telling you they did not read the
       English one. */
    introduceRail();
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

  /* With two styles and no third one coming, two buttons were one too many:
     whichever you were looking at, one of them was already pressed and did
     nothing, and the rail read like a settings screen for a choice that is
     just day or night. So it is one button, and it shows the side you are not
     on — press the dark swatch to go dark, press the light one to come back.
     Written against STYLES rather than against the two ids, so the switch is
     still a switch if a third palette ever turns up. */
  function nextStyle() {
    for (var i = 0; i < STYLES.length; i++) {
      if (STYLES[i].id === state.style) return STYLES[(i + 1) % STYLES.length].id;
    }
    return DEFAULT_STYLE;
  }

  function styleKey(id) {
    return 'style' + id.charAt(0).toUpperCase() + id.slice(1);
  }

  function markStyleSwitch() {
    if (!dom.styles) return;
    var btn = dom.styles.querySelector('.swatch');
    if (!btn) return;
    var next = nextStyle();
    btn.className = 'swatch sw-' + next;
    btn.setAttribute('aria-label', t(styleKey(next)));
    btn.setAttribute('title', t(styleKey(next)));
    /* The label the phone shows while the rail is introducing itself names
       the style you are about to get, exactly as the title does — so a swatch
       that has just been pressed says the way back. */
    var name = dom.styles.querySelector('.style-label');
    if (name) name.textContent = t(styleKey(next));
  }

  function renderStyleSwitch() {
    if (!dom.styles) return;
    clear(dom.styles);
    var btn = el('button', { type: 'button', className: 'swatch' });
    /* Read at click time, not at render: the button outlives every switch. */
    btn.addEventListener('click', function () {
      setStyle(nextStyle());
      /* And say what it has become, the way the radio names its station:
         one press in and the swatch is showing the other side again. */
      openHint('style', 0);
    });
    dom.styles.appendChild(btn);
    dom.styles.appendChild(el('span', { className: 'style-label rail-label' }));
    markStyleSwitch();
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

  /* The icon every pin is built from. One box, one span: the box is the
     anchor and takes no pointer, the span is the mark and takes all of them,
     so a tap only ever lands on the picture you can see rather than on the
     empty corners of a 46px square. Its size and its collar are set in
     dressPin, which is the one place that knows what a pin is saying. */
  function pinIcon() {
    return L.divIcon({
      className: 'pin-mark',
      html: '<span class="pin-face"></span>',
      iconSize: [PIN_BOX, PIN_BOX],
      iconAnchor: [PIN_BOX / 2, PIN_BOX / 2],
      tooltipAnchor: [0, 0]
    });
  }

  function buildMarkers() {
    var muted = cssVar('--muted') || '#536879';

    state.places.forEach(function (place) {
      var marker = L.marker([place.lat, place.lng], {
        icon: pinIcon(),
        keyboard: false,        /* the button semantics are added by hand below */
        bubblingMouseEvents: false
      });

      marker.bindTooltip(place.name, {
        className: 'pin-tip',
        direction: 'top',
        offset: [0, -15],
        opacity: 1
      });

      marker.on('click', function () { selectPlace(place.id, { fly: false }); });

      /* Leaflet builds a fresh element every time the marker is re-attached —
         clustering takes pins off the map and puts them back all day — so the
         button semantics and the pin's face are applied on every add, not
         once at construction. */
      marker.on('add', function () {
        var node = marker.getElement();
        if (!node) return;
        node.setAttribute('tabindex', '0');
        node.setAttribute('role', 'button');
        node.setAttribute('aria-label', t('openPlace', { name: place.name }) +
          (place.closed ? ', ' + t('closed') : ''));
        node.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
            ev.preventDefault();
            selectPlace(place.id, { fly: false });
          }
        });
        dressPin(place);
      });

      markers[place.id] = marker;
      marker.addTo(map);

      /* A shut place gets a second mark rather than a quieter version of the
         first one. Greying the dot was all it had, and grey is also what a
         write-up-only place looks like from three streets away — so the one
         thing worth knowing before you walk there was said in the same
         language as how much there is to read about it. The ring is drawn
         outside the pin, dashed, so the mark underneath keeps saying what
         there is to watch: a closed place you can still see a reel of is a
         full-collared mark inside a broken circle, two facts at once. */
      if (place.closed) {
        var ring = L.circleMarker([place.lat, place.lng], {
          radius: PIN_D / 2 + 4,
          weight: 1.5,
          color: muted,
          opacity: .9,
          dashArray: '2 3',
          fill: false,
          className: 'pin-shut',
          interactive: false
        });
        closedRings[place.id] = ring;
        ring.addTo(map);
        if (ring.bringToBack) ring.bringToBack();
      }
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
   * Three things mark it: the mark grows and its collar takes the brighter
   * accent, a ring is drawn around it, and its name label is pinned open
   * instead of waiting for a hover it will never get on a phone.
   */

  function markerColours() {
    return {
      accent: cssVar('--accent') || '#00539c',
      lit: cssVar('--accent-lit') || '#0072ce',
      muted: cssVar('--muted') || '#536879',
      paper: cssVar('--paper') || '#f2f8ff',
      here: cssVar('--here') || '#c1420b'
    };
  }

  /* Chosen is the place whose panel is open; kept is the place whose panel
     was open until you shut it. Both are lit — bigger, named, haloed, never
     folded into a cluster — because both answer the same question about where
     something is. Kept is drawn a step down from chosen, so the map still
     says which of the two you are in. */
  function isChosen(place) { return !!place && place.id === state.selected; }
  function isKept(place) {
    return !!place && !!state.marked && place.id === state.marked && place.id !== state.selected;
  }
  function isLit(place) { return isChosen(place) || isKept(place); }

  function pinSize(place) {
    if (isChosen(place)) return PIN_D_SELECTED;
    if (isKept(place)) return PIN_D_KEPT;
    return pinDepth(place) === 'words' ? PIN_D_WORDS : PIN_D;
  }

  /* How much of a place there is to look at, which is what the pin says:
     something to watch, something to look at, or the write-up alone. */
  function pinDepth(place) {
    if (place.reel) return 'reel';
    if (place.photos && place.photos.length) return 'photos';
    return 'words';
  }

  /* The pin's collar, drawn small: solid, a ring, a speck. Not a play triangle
     and a camera — those say what the word beside them already says, and at
     9px a camera is a smudge anyway. Echoing the pin is the one thing the
     badge can do that the word cannot: it makes every row a key to the map,
     so the three kinds of pin out there stop needing to be guessed at. */
  var DEPTH_GLYPH = {
    reel: '<svg viewBox="0 0 10 10" focusable="false"><circle cx="5" cy="5" r="3.9"/></svg>',
    photos: '<svg viewBox="0 0 10 10" focusable="false"><path fill-rule="evenodd" d="M5 1.1a3.9 3.9 0 100 7.8 3.9 3.9 0 000-7.8zm0 1.7a2.2 2.2 0 110 4.4 2.2 2.2 0 010-4.4z"/></svg>',
    words: '<svg viewBox="0 0 10 10" focusable="false"><circle cx="5" cy="5" r="2.2"/></svg>'
  };

  /* The pin's three-way, said in words. A pin on the map is only legible when
     you already know the code and can compare it with its neighbours; a row
     in the list has neither, so it carries the name and the badge both. Same
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

  /* The dashed ring off the map, shrunk to badge size. The word "Closed" is
     the part you read; the ring is the part that tells you the broken circle
     around a dot out there is the same fact, so the map stops needing a key
     printed next to it. */
  var SHUT_GLYPH = '<svg viewBox="0 0 10 10" focusable="false"><circle cx="5" cy="5" r="3.9" stroke-dasharray="1.7 1.7"/></svg>';

  function shutMark() {
    return el('span', { className: 'shut-mark' }, [
      el('span', { className: 'shut-glyph', 'aria-hidden': 'true', html: SHUT_GLYPH }),
      el('span', { textContent: t('closed') })
    ]);
  }

  /* A closed place is not one fact but two, and the second one is the reason
     the entry is still here: the door is shut, and the reel is not. So the
     note says what is left rather than only what is gone, in whichever of
     the three shapes the place has — Instagram's word, TikTok's word, the
     photos, or nothing to see, which is the only case the plain note covers
     and the only case it ever read right in. */
  function closedNoteKey(place) {
    var depth = pinDepth(place);
    if (depth === 'reel') {
      return reelProvider(place.reel) === 'tiktok' ? 'closedVideoNote' : 'closedReelNote';
    }
    return depth === 'photos' ? 'closedPhotosNote' : 'closedNote';
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
  /* Three readings, not two: the open one wears the accent, the one you last
     had open wears the same label a shade quieter, and the rest are the grey
     names that fit. */
  function tooltipFor(marker, name, permanent, chosen, kept) {
    marker.unbindTooltip();
    marker.bindTooltip(name, {
      className: 'pin-tip' + (chosen ? ' pin-tip-on' : '') +
        (kept ? ' pin-tip-kept' : '') +
        (permanent && !chosen && !kept ? ' pin-tip-quiet' : ''),
      direction: 'top',
      offset: [0, chosen ? -23 : (kept ? -20 : (permanent ? -18 : -15))],
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
    return { x: pt.x - w / 2, y: pt.y - 19 - LABEL_H, w: w, h: LABEL_H, px: pt.x, py: pt.y };
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
      var r = Math.max(pinSize(p), PIN_D) / 2 + 2;
      taken.push({ x: pt.x - r, y: pt.y - r, w: r * 2, h: r * 2 });
    });
    clusterPins.forEach(function (pin) {
      var pt = map.latLngToContainerPoint(pin.getLatLng());
      var r = (pin.options.icon.options.iconSize[0] / 2) + 3;
      taken.push({ x: pt.x - r, y: pt.y - r, w: r * 2, h: r * 2 });
    });

    /* The lit places first, so a collision never costs one of them its name. */
    queue.sort(function (a, b) {
      if (isLit(a) === isLit(b)) return 0;
      return isLit(a) ? -1 : 1;
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
      var chosen = isChosen(place);
      var kept = isKept(place);
      /* A lit place keeps its name whatever the layout said: it is the one
         the map is being asked about. */
      var wants = chosen || kept || !!plan[place.id];
      var tip = marker.getTooltip();
      var cls = (tip && tip.options.className) || '';
      var isOn = !!(tip && tip.options.permanent);
      var wasChosen = cls.indexOf('pin-tip-on') !== -1;
      var wasKept = cls.indexOf('pin-tip-kept') !== -1;
      if (!tip || isOn !== wants || wasChosen !== chosen || wasKept !== kept) {
        tooltipFor(marker, place.name, wants, chosen, kept);
      }
    });
  }

  function clearHalo() {
    if (haloMarker && map) map.removeLayer(haloMarker);
    haloMarker = null;
  }

  /* One pin, dressed for what it is saying. The picture is the same on every
     one of them — that is the point of it — so the three readings that used
     to be solid, hollow and small-and-faint are carried by the collar drawn
     round the mark and by how big the mark is:

       filmed          full size, a solid collar in the accent
       photographed    full size, a paper gap and then a hairline — hollow
       write-up only   smaller, quieter, a hairline collar

     The chosen place keeps whichever of the three it is, so selecting one
     never hides what there is to see in it; it grows instead, and takes the
     lit tone and the halo. Closed outranks chosen: a shut place keeps the
     muted tone and the mark goes grey, which the broken circle round it says
     a second time.

     The shape work is all in the stylesheet — this hands it the two things
     only the script knows, the diameter and the tone, and the classes that
     say which of the three readings to draw. */
  function dressPin(place, colours) {
    var marker = markers[place.id];
    if (!marker) return;
    var node = marker.getElement();
    if (!node) return;              /* swallowed by a cluster, nothing to dress */

    /* Reading five custom properties off the root is a layout question, so
       the caller passes them in when it is dressing all seventy at once. */
    var c = colours || markerColours();
    var chosen = isChosen(place);
    var kept = isKept(place);
    var depth = pinDepth(place);
    var d = pinSize(place);

    node.classList.add('pin-mark');
    ['reel', 'photos', 'words'].forEach(function (kind) {
      node.classList.toggle('is-' + kind, depth === kind);
    });
    node.classList.toggle('is-chosen', chosen);
    node.classList.toggle('is-kept', kept);
    node.classList.toggle('is-shut', !!place.closed);
    node.style.setProperty('--pin-d', d + 'px');
    node.style.setProperty('--pin-tone',
      place.closed ? c.muted : ((chosen || kept) ? c.lit : c.accent));

    /* No bringToFront on an icon marker; the stacking is the z offset. The
       kept pin sits above the crowd and under the open one. */
    if (marker.setZIndexOffset) marker.setZIndexOffset(chosen ? 400 : (kept ? 300 : 0));
  }

  /* Paints every pin for the current selection and the current style. Doubles
     as the restyle hook, so a style change keeps the selection visible. */
  function paintMarkers() {
    var c = markerColours();
    syncMarkers();

    state.places.forEach(function (place) {
      var marker = markers[place.id];
      if (!marker) return;

      dressPin(place, c);

      var ring = closedRings[place.id];
      if (ring) {
        ring.setStyle({ color: c.muted });
        ring.setRadius(Math.max(pinSize(place), PIN_D) / 2 + 4);
      }
    });

    paintLabels();

    clearHalo();
    /* The halo follows the lit place, which is the open one while a panel is
       open and the one you last had open once it is shut. */
    var place = byId(state.selected || state.marked);
    if (place && map) {
      var lit = isChosen(place);
      haloMarker = L.circleMarker([place.lat, place.lng], {
        radius: pinSize(place) / 2 + 7,
        weight: 2,
        color: c.lit,
        opacity: lit ? .85 : .6,
        fill: false,
        className: 'pin-halo' + (lit ? '' : ' pin-halo-kept'),
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
    /* Never back out: a place you have gone to the trouble of opening is a
       street question, so the map comes in to FOCUS_ZOOM if it is further out
       than that and stays where it is if you had already gone closer. */
    var zoom = zoomIn ? Math.max(map.getZoom(), FOCUS_ZOOM) : map.getZoom();

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

  /* ----------------------------------------------------------------- saves
   * The bookmark, and the number next to it.
   *
   * Pressing it keeps the place — the same thing a bookmark does — and the
   * number says how many other people have kept it too. One action, not two:
   * there is nobody to perform for here, since a save is anonymous and no
   * visitor can see whose it was, so the reason Instagram and X keep a public
   * like apart from a private bookmark does not apply. The README has the
   * argument in full.
   *
   * Unlike everything else in this file, a save is not this browser's to
   * keep: it is a count of other people, so it lives in a Cloudflare D1
   * database behind /api/saves and this is the client half of it. See
   * functions/api/saves.js for the server half and the README for the honest
   * account of how unique a save actually is.
   *
   * IT TAKES AN ACCOUNT
   *
   * Pressing the mark signed out opens the account sheet instead of saving.
   * A browser used to be able to save under a random id it made for itself,
   * which meant the number under a place counted browsers: one per phone, one
   * more after clearing storage, and free to make as many as you liked. The
   * wall is a real cost — some people will press once, see a sign-up sheet
   * and go — and it is the price of the number meaning what it says.
   *
   * What is kept locally is one thing, and it is a cache and not a record:
   *
   *   ttb.saved  which places the account signed in here has saved, so the
   *              marks are already filled on the next load rather than blank
   *              until /api/account answers. The account is the truth and
   *              replaces this the moment it arrives; signing out empties it.
   *              Losing it costs the fill, never the save.
   *
   * The counts themselves are never cached locally. A number that is meant to
   * be other people is worth being told fresh.
   */

  var SAVED_KEY = 'ttb.saved';

  /* A chip id that is not a taxonomy type, reserved the way "discount" is and
     refused to the taxonomy by the same list in tools/validate.mjs: two chips
     answering to one name would each filter the other's places out. */
  var SAVED_FILTER = 'saved';

  /* Nothing on the map waits for this. The counts arrive when they arrive and
     the panel repaints if it is already open; if they never arrive — offline,
     the Function not deployed yet, the database not bound — the mark still
     works as a button and simply shows no number. A map that will not draw
     because a save count is late would be a bad trade. */
  function loadSaves() {
    return fetch('/api/saves', { headers: { accept: 'application/json' } })
      .then(function (res) { return res.ok ? res.json() : {}; })
      .then(function (counts) {
        state.saves = counts && typeof counts === 'object' ? counts : {};
        paintSave();
        /* The list is built with the counts in it, so a list already on screen
           when they land is a list without them. Rebuilt rather than patched:
           it is seventy-four rows once, on a request that has already been
           made, and patching would mean threading the number back through
           every row that might be showing it. */
        if (state.view === 'list' && dom.panel.classList.contains('is-open')) renderList();
      })
      .catch(function () { /* no counts is a fine state to be in */ });
  }

  function readSaved() {
    var raw = storeGet(SAVED_KEY);
    var ids = [];
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) ids = parsed;
      } catch (e) { /* unreadable is the same as none */ }
    }
    /* Trusted as far as: parses, is an array, holds strings, no id twice, and
       a place of that id is still on the map. The chip built from this is a
       door to a list, and a door has to open onto what it claims — an id for
       somewhere that has left restaurants.json would be counted here and then
       not drawn there. The save itself is unaffected: that lives in the
       database, and this is only which marks to fill in. */
    var seen = {};
    state.saved = ids.filter(function (id) {
      if (typeof id !== 'string' || seen[id] || !byId(id)) return false;
      seen[id] = true;
      return true;
    });
  }

  function isSaved(id) { return state.saved.indexOf(id) !== -1; }

  /* Newest first, and renderList reads that order back out: the mark you
     pressed on the way home is the one you are looking for tonight. */
  function markSaved(id, on) {
    var at = state.saved.indexOf(id);
    if (on && at === -1) state.saved.unshift(id);
    if (!on && at !== -1) state.saved.splice(at, 1);
    storeSet(SAVED_KEY, JSON.stringify(state.saved));
  }

  function savedCount() { return state.saved.length; }

  function saveCount(id) {
    var n = state.saves[id];
    return typeof n === 'number' && n > 0 ? n : 0;
  }

  /* The same mark the panel carries, at badge size and with no button under
     it: a row is already a button, and one inside another is not a thing the
     HTML allows. So this is a fact about the place, printed next to the price
     and the discount — the count is the only thing on a row that is about
     other people, and seeing it while scanning is most of the reason it is
     worth counting at all. Nothing below one, for the same reason the panel
     hides a zero: a "0" against a restaurant reads as a verdict rather than
     as nobody having got there yet. */
  var SAVE_GLYPH = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';

  function saveMark(place) {
    var n = saveCount(place.id);
    if (!n) return null;
    return el('span', { className: 'save-mark' }, [
      el('span', { className: 'save-mark-ico', 'aria-hidden': 'true', html: SAVE_GLYPH }),
      el('span', { textContent: String(n) })
    ]);
  }

  /* The mark's three jobs: be on screen only when there is a place to save,
     say whether the signed-in account has saved it, and carry the count. It is
     hidden at zero — "0" under a mark reads as a verdict on the place rather
     than as nobody having pressed it yet. */
  function paintSave() {
    var place = state.view === 'detail' && state.selected ? byId(state.selected) : null;
    dom.panelSave.hidden = !place;
    if (!place) return;

    var n = saveCount(place.id);
    var mine = isSaved(place.id);
    dom.panelSave.setAttribute('aria-pressed', String(mine));
    dom.panelSaveN.textContent = n ? String(n) : '';
    dom.panelSave.classList.toggle('has-n', !!n);

    /* Spelled into the label, because the number beside the mark is
       aria-hidden: read out on its own it is a digit with nothing saying what
       it counts. */
    var label = t('savePlace');
    if (n) label += ', ' + (n === 1 ? t('saveCountOne') : t('saveCount', { n: n }));
    dom.panelSave.setAttribute('aria-label', label);
    dom.panelSave.setAttribute('title', label);
  }

  /* ------------------------------------------------------------- Turnstile
   * The one layer that stops a script rather than a person. Optional in every
   * sense: with no key in the <meta> the script is never fetched, no token is
   * ever asked for, and the server — which has no secret either — accepts the
   * save on the strength of the cap alone. Everything below is written so
   * that any failure of it resolves to an empty token rather than to a save
   * that will not go through.
   */

  var TURNSTILE_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js' +
                      '?render=explicit&onload=ttbTurnstileReady';
  var turnstileKey = '';
  var turnstileWidget = null;
  var turnstileLoading = null;
  var turnstileWaiting = null;

  function readTurnstileKey() {
    var meta = document.querySelector('meta[name="turnstile-key"]');
    turnstileKey = (meta && meta.getAttribute('content') || '').trim();
  }

  function loadTurnstile() {
    if (turnstileWidget !== null) return Promise.resolve(turnstileWidget);
    if (turnstileLoading) return turnstileLoading;

    turnstileLoading = new Promise(function (resolve, reject) {
      var box = el('div', { className: 'turnstile-box' });
      document.body.appendChild(box);

      window.ttbTurnstileReady = function () {
        try {
          turnstileWidget = window.turnstile.render(box, {
            sitekey: turnstileKey,
            size: 'invisible',
            /* Every path out of the widget lands on the same resolver, so a
               refused or expired challenge fails the save fast instead of
               leaving the mark spinning on a promise nobody settles. */
            callback: function (token) { settleTurnstile(token); },
            'error-callback': function () { settleTurnstile(''); },
            'expired-callback': function () { settleTurnstile(''); }
          });
          resolve(turnstileWidget);
        } catch (e) { reject(e); }
      };

      var tag = document.createElement('script');
      tag.src = TURNSTILE_URL;
      tag.async = true;
      tag.defer = true;
      tag.onerror = function () { reject(new Error('turnstile unreachable')); };
      document.head.appendChild(tag);
    });

    return turnstileLoading;
  }

  function settleTurnstile(token) {
    var waiting = turnstileWaiting;
    turnstileWaiting = null;
    if (waiting) waiting(token || '');
  }

  /* Resolves to a token, or to an empty string for every way this can go
     wrong — no key, no network, a challenge that failed, or one that simply
     took too long. An empty token is refused by a server that has a secret
     set and ignored by one that has not, which is the correct behaviour in
     both cases. */
  function saveToken() {
    if (!turnstileKey) return Promise.resolve('');
    return loadTurnstile().then(function (id) {
      return new Promise(function (resolve) {
        var done = false;
        turnstileWaiting = function (token) {
          if (done) return;
          done = true;
          resolve(token);
        };
        window.setTimeout(function () {
          if (!done) { done = true; turnstileWaiting = null; resolve(''); }
        }, 6000);
        try {
          window.turnstile.reset(id);
          window.turnstile.execute(id);
        } catch (e) { settleTurnstile(''); }
      });
    }).catch(function () { return ''; });
  }

  /* ------------------------------------------------------------- the press
   * Optimistic, because a mark that waits for a round trip before it fills
   * feels broken on a phone on mobile data. The number moves at once and the
   * server's answer replaces it a moment later; anything that goes wrong puts
   * both back exactly as they were and says so.
   */
  var saveBusy = false;

  function pressSave() {
    var place = state.selected ? byId(state.selected) : null;
    if (!place || saveBusy) return;

    /* No account, no save. The sheet opens on the press rather than a toast
       telling somebody to go and find the button themselves: they have just
       said what they want, and the next thing on screen should be the way to
       get it. It opens on sign-in, not sign-up, because somebody who already
       has an account is the likelier of the two to be pressing this — and
       "Need an account?" is one tap away inside the sheet.

       If the endpoint has not answered yet, or answered that accounts are not
       usable on this deployment, there is nothing to open and nothing that
       could work; the mark says so and stays as it was. */
    if (!state.account.user) {
      if (!state.account.ready) { toast(t('saveFailed')); return; }
      openAccount('in', t('saveSignIn'));
      return;
    }

    var wasSaved = isSaved(place.id);
    var wasCount = saveCount(place.id);
    var on = !wasSaved;

    function revert() {
      markSaved(place.id, wasSaved);
      state.saves[place.id] = wasCount;
      paintSave();
    }

    markSaved(place.id, on);
    state.saves[place.id] = Math.max(0, wasCount + (on ? 1 : -1));
    paintSave();

    /* One beat of movement. A fill that simply appears reads as a colour that
       was always there; this is what makes it read as something that just
       happened. Reduced motion is not asked about — the blanket rule at the
       foot of styles.css already flattens every animation on the site. */
    dom.panelSave.classList.remove('is-beating');
    void dom.panelSave.offsetWidth;
    dom.panelSave.classList.add('is-beating');

    saveBusy = true;
    saveToken().then(function (token) {
      return fetch('/api/saves', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          place: place.id,
          on: on,
          token: token
        })
      });
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (out) {
        return { ok: res.ok, out: out || {} };
      });
    }).then(function (answer) {
      if (!answer.ok) {
        revert();
        /* The count the server sent back with the refusal is still the true
           one, so it survives the revert. */
        if (typeof answer.out.n === 'number') state.saves[place.id] = answer.out.n;
        paintSave();
        /* The session ended while this page was open — a year-long cookie, so
           rare, but the sheet is a year old on somebody's phone eventually.
           The page catches up with the server rather than arguing with it:
           signed out here too, marks cleared, and the same sheet the press
           would have opened had we known. */
        if (answer.out.error === 'sign-in') {
          state.account.user = null;
          state.saved = [];
          storeSet(SAVED_KEY, '[]');
          paintSave();
          paintAccountButton();
          renderFilters();
          if (state.view === 'list') renderPanel();
          openAccount('in', t('saveSignIn'));
          return;
        }
        toast(t(answer.out.error === 'capped' ? 'saveCapped' : 'saveFailed'));
        return;
      }
      if (typeof answer.out.n === 'number') state.saves[place.id] = answer.out.n;
      paintSave();
      syncSavedChip(on);
      trackEvent(on ? 'save_place' : 'unsave_place', {
        place_id: place.id,
        place: place.name,
        saves_total: saveCount(place.id)
      });
    }).catch(function () {
      revert();
      toast(t('saveFailed'));
    }).then(function () {
      saveBusy = false;
    });
  }

  /* The chip row and the map, after a save has changed what the saved chip
     would filter to. Only the first save and the last unsave change whether
     there is a chip at all; every press in between leaves the row exactly as
     it was and does not need it built again. */
  function syncSavedChip(on) {
    if (state.active.indexOf(SAVED_FILTER) !== -1) {
      /* The list being filtered by just changed underneath the filter, so the
         map and the panel are both out of date. And if that was the last
         mark, the chip goes out with it — which would leave the map filtered
         by a chip that is no longer drawn, with no way to press it off. So the
         filter comes off with the chip. */
      if (!savedCount()) state.active.splice(state.active.indexOf(SAVED_FILTER), 1);
      applyFilters();
      return;
    }
    if (savedCount() === (on ? 1 : 0)) renderFilters();
  }


  /* --------------------------------------------------------------- account
   * A username and a password, and nothing else required.
   *
   * It is what saving runs on: the mark opens this sheet when nobody is
   * signed in, and the list lives on the account rather than in this browser,
   * so it is the same list on the next phone. Two fields and a suggested
   * username, because the sheet is standing between somebody and a bakery
   * they wanted to remember.
   *
   * An email is optional and buys exactly one thing: the ability to reset a
   * forgotten password. Without one there is nothing that proves an account
   * is yours except knowing its password, so the sheet says so in as many
   * words rather than letting somebody find out later.
   */

  var ACCOUNT_URL = '/api/account';

  function accountPost(payload) {
    return fetch(ACCOUNT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (out) {
        return { ok: res.ok, out: out || {} };
      });
    });
  }

  /* Whether /api/account has said anything at all, either way. The rail's
     introduction waits a moment on this — see introduceRail — because the
     button it opens with is the one button on the rail that is not in the
     markup until the network says so. */
  var accountAnswered = false;

  function accountSettled() {
    if (accountAnswered) return;
    accountAnswered = true;
    /* The rail is holding the door for this answer: it can go now. */
    if (railWaiting) { railWaiting = false; introduceRail(); }
  }

  /* Who is signed in, asked once on the way in. Like the counts, nothing
     waits for it: the button appears when the answer arrives, and if it never
     does the map is exactly the map it was before accounts existed. The one
     thing that does wait on it is the rail's introduction, and only briefly. */
  function loadAccount() {
    return fetch(ACCOUNT_URL, { headers: { accept: 'application/json' } })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (out) {
        if (!out) { accountSettled(); return; }
        state.account = {
          /* The endpoint says whether accounts are actually usable — the
             database bound, the salt set. Until it says yes there is no
             button, because a sign-up sheet that can only fail is worse than
             no sign-up sheet at all. */
          ready: !!out.ready,
          user: out.user || null,
          recovery: !!out.recovery,
          email: !!out.email
        };
        /* The server is the only thing that knows. Signed in, its list
           replaces whatever ttb.saved was holding; signed out, there are no
           saves to draw and the cache goes — it is somebody else's browser
           now, or the same person after signing out somewhere else. */
        if (out.user) adoptSaved(Array.isArray(out.saved) ? out.saved : []);
        else if (state.saved.length) adoptSaved([]);
        paintAccountButton();
        accountSettled();
      })
      .catch(function () { /* signed out is a fine place to be */ accountSettled(); });
  }

  /* The account's list, as the server has it. Written through to
     localStorage all the same, so the marks are right on the next load
     before the network has answered — a cache of the account's list and
     never a second copy of it. */
  function adoptSaved(list) {
    var seen = {};
    state.saved = list.filter(function (id) {
      if (typeof id !== 'string' || seen[id] || !byId(id)) return false;
      seen[id] = true;
      return true;
    });
    storeSet(SAVED_KEY, JSON.stringify(state.saved));
    paintSave();
    renderFilters();
    if (state.view === 'list' && dom.panel.classList.contains('is-open')) renderList();
  }

  function paintAccountButton() {
    if (!dom.btnAccount) return;
    /* Drawn only once the endpoint has answered that it can do the job: a
       sign-in button on a site whose Function is not deployed, or whose
       database is not bound yet, is a button that can only disappoint. */
    var wasHidden = dom.btnAccount.hidden;
    dom.btnAccount.hidden = !state.account.ready;
    if (!state.account.ready) return;
    var name = state.account.user;
    dom.accountLabel.textContent = name || t('accountOpen');
    dom.btnAccount.setAttribute('aria-label', name ? t('accountSignedIn', { name: name }) : t('accountOpen'));
    dom.btnAccount.setAttribute('title', name ? t('accountSignedIn', { name: name }) : t('accountOpen'));
    dom.btnAccount.classList.toggle('is-on', !!name);

    /* It is the top button on the rail, and on a phone the rail says what its
       buttons are for on arrival. The introduction holds a moment for this
       answer — see introduceRail — so on any normal load it opens at the head
       of the cascade with the rest. This is the other case: an answer slower
       than the hold, which says its name when it turns up rather than
       appearing as a silent disc above a column of pills that have all had
       their say. Nothing happens on a desktop, where the label is never
       hidden in the first place. */
    if (wasHidden && railIntroduced) openHint('account', 0);
  }

  /* ------------------------------------------------------------- the sheet
   * Four states in one card: signed in, signing in, creating, recovering.
   * Which one is showing is a variable rather than four hidden blocks, so
   * there is exactly one place that decides and nothing can be left over from
   * the state before.
   */
  var accountView = 'in';        /* 'in' | 'up' | 'me' | 'recover' | 'code' */
  var accountBusy = false;
  var accountNote = '';
  var accountErr = '';
  var accountSuggest = '';

  /* The note is a parameter and not something a caller sets first, because
     opening a view clears the messages from the one before it — a caller that
     assigned accountNote and then called this would have it wiped on the way
     in. Moving between steps and saying what just happened is one action, so
     it is one call. */
  function openAccount(view, note) {
    /* Only when arriving from outside: stepping between views inside an open
       sheet must not record a field in the sheet as the thing to hand focus
       back to when it shuts. */
    if (dom.accountScrim.hidden) state.lastFocus = document.activeElement;
    accountView = view || (state.account.user ? 'me' : 'in');
    accountNote = note || '';
    accountErr = '';
    dom.accountScrim.hidden = false;
    document.body.classList.add('has-scrim');
    renderAccount();
    var first = dom.accountCard.querySelector('input, button');
    if (first) first.focus();
    /* A suggested name, so the sign-up sheet is not a blank box asking
       somebody to be creative before they can save a bakery. */
    if (accountView === 'up' && !accountSuggest) {
      fetch(ACCOUNT_URL + '?suggest=1')
        .then(function (r) { return r.json(); })
        .then(function (out) {
          accountSuggest = out.suggest || '';
          var field = dom.accountCard.querySelector('#ac-user');
          if (field && !field.value) field.value = accountSuggest;
        })
        .catch(function () {});
    }
  }

  function closeAccount() {
    dom.accountScrim.hidden = true;
    document.body.classList.remove('has-scrim');
    var back = state.lastFocus;
    state.lastFocus = null;
    if (back && document.contains(back) && back.focus) back.focus();
  }

  function accountField(id, labelKey, type, opts) {
    opts = opts || {};
    return el('label', { className: 'ac-field' }, [
      el('span', { className: 'ac-label', textContent: t(labelKey) }),
      el('input', {
        id: id,
        type: type,
        autocomplete: opts.autocomplete || 'off',
        autocapitalize: 'none',
        autocorrect: 'off',
        spellcheck: 'false',
        inputmode: opts.inputmode || null,
        maxlength: opts.maxlength || null,
        value: opts.value || ''
      })
    ]);
  }

  function accountValue(id) {
    var node = dom.accountCard.querySelector('#' + id);
    return node ? node.value.trim() : '';
  }

  /* Everything the sheet is holding, read in one go.

     This has to happen before anything sets the busy state, because showing
     that state re-renders the card and re-rendering builds the inputs afresh
     — so a value read afterwards is the field's default and not a word of
     what was typed into it. The password deliberately keeps its spaces: they
     are characters somebody chose. */
  function accountValues() {
    var pass = dom.accountCard.querySelector('#ac-pass');
    return {
      username: accountValue('ac-user'),
      password: pass ? pass.value : '',
      email: accountValue('ac-email'),
      code: accountValue('ac-code')
    };
  }

  function accountSubmit(labelKey, run) {
    var btn = el('button', {
      type: 'submit',
      className: 'ac-go',
      textContent: t(accountBusy ? 'accountWorking' : labelKey),
      disabled: accountBusy || null
    });
    return btn;
  }

  function accountSwitch(labelKey, view) {
    var link = el('button', { type: 'button', className: 'ac-alt', textContent: t(labelKey) });
    link.addEventListener('click', function () { openAccount(view); });
    return link;
  }

  /* One place turns an error code from the server into a sentence. Anything
     unrecognised falls back to the general one rather than showing a visitor
     a word out of the source. */
  var ACCOUNT_ERRORS = {
    taken: 'accountErrTaken',
    'no-match': 'accountErrNoMatch',
    password: 'accountErrPassword',
    username: 'accountErrUsername',
    email: 'accountErrEmail',
    'bad-code': 'accountErrCode',
    'slow-down': 'accountErrSlow',
    'email-taken': 'accountErrEmailTaken',
    'no-email': 'accountErrNoEmail',
    'send-failed': 'accountErrSend'
  };

  function accountFail(out) {
    accountErr = t(ACCOUNT_ERRORS[out && out.error] || 'accountErrGeneric');
    accountBusy = false;
    renderAccount();
  }

  function renderAccount() {
    clear(dom.accountCard);

    var close = el('button', {
      type: 'button',
      className: 'panel-close ac-close',
      'aria-label': t('close'),
      html: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>'
    });
    close.addEventListener('click', closeAccount);
    dom.accountCard.appendChild(close);

    var form = el('form', { className: 'ac-form' });
    form.addEventListener('submit', function (ev) { ev.preventDefault(); });
    dom.accountCard.appendChild(form);

    if (accountView === 'me') return renderAccountMe(form);
    if (accountView === 'recover') return renderAccountRecover(form);
    if (accountView === 'code') return renderAccountCode(form);
    return renderAccountAuth(form);
  }

  function accountMessages(form) {
    if (accountErr) form.appendChild(el('p', { className: 'ac-err', role: 'alert', textContent: accountErr }));
    if (accountNote) form.appendChild(el('p', { className: 'ac-note', role: 'status', textContent: accountNote }));
  }

  /* -------------------------------------------------- signed in already */
  function renderAccountMe(form) {
    form.appendChild(el('h2', { className: 'ac-title', textContent: t('accountTitle') }));
    form.appendChild(el('p', {
      className: 'ac-who',
      textContent: t('accountSignedIn', { name: state.account.user })
    }));
    accountMessages(form);

    if (state.account.email && !state.account.recovery) {
      form.appendChild(el('p', { className: 'ac-why', textContent: t('accountEmailWhy') }));
      form.appendChild(accountField('ac-email', 'accountEmail', 'email', { autocomplete: 'email' }));
      var add = accountSubmit('accountSendCode');
      add.addEventListener('click', function () {
        if (accountBusy) return;
        var v = accountValues();
        accountBusy = true; accountErr = ''; renderAccount();
        accountPost({ action: 'email-add', email: v.email }).then(function (a) {
          accountBusy = false;
          if (!a.ok) return accountFail(a.out);
          openAccount('code', t('accountEmailSent'));
        }).catch(function () { accountFail({}); });
      });
      form.appendChild(add);
    } else if (state.account.recovery) {
      form.appendChild(el('p', { className: 'ac-why', textContent: t('accountRecoveryOn') }));
    }

    var out = el('button', { type: 'button', className: 'ac-alt', textContent: t('accountSignOut') });
    out.addEventListener('click', function () {
      accountPost({ action: 'logout' }).then(function () {
        /* Only the person changes. Whether accounts work here at all, and
           whether email is configured, are facts about the deployment and
           survive somebody signing out of it — dropping `ready` would hide
           the button that is the way back in. */
        state.account = {
          ready: state.account.ready,
          user: null,
          recovery: false,
          email: state.account.email
        };
        /* The list goes with the account. Nothing is lost by signing out —
           the rows are in the database under the account, and they come
           back filled the moment somebody signs in again, here or anywhere
           else. */
        state.saved = [];
        storeSet(SAVED_KEY, '[]');
        paintSave();
        paintAccountButton();
        renderFilters();
        if (state.view === 'list') renderPanel();
        closeAccount();
      });
    });
    form.appendChild(out);
  }

  /* ------------------------------------------- signing in or signing up */
  function renderAccountAuth(form) {
    var creating = accountView === 'up';
    form.appendChild(el('h2', {
      className: 'ac-title',
      textContent: t(creating ? 'accountCreate' : 'accountSignIn')
    }));
    form.appendChild(el('p', { className: 'ac-why', textContent: t('accountWhy') }));
    accountMessages(form);

    form.appendChild(accountField('ac-user', 'accountUsername', 'text', {
      autocomplete: 'username',
      maxlength: '24',
      value: creating ? accountSuggest : ''
    }));
    form.appendChild(accountField('ac-pass', 'accountPassword', 'password', {
      autocomplete: creating ? 'new-password' : 'current-password'
    }));

    if (creating) {
      if (state.account.email) {
        form.appendChild(accountField('ac-email', 'accountEmail', 'email', { autocomplete: 'email' }));
        form.appendChild(el('p', { className: 'ac-why is-small', textContent: t('accountEmailWhy') }));
      }
      /* Always, whether or not an address was asked for. It says what happens
         if the password goes, which is true in every configuration of this
         site — with no email set up at all, or with a field that somebody
         chose to skip. It is drawn as a warning rather than a footnote: it is
         the one thing on this sheet that cannot be undone later, and it spent
         its first version as small grey text under the button, which is where
         notices go to be missed. */
      form.appendChild(el('p', { className: 'ac-warn', role: 'note' }, [
        el('span', { className: 'ac-warn-ico', 'aria-hidden': 'true', html:
          '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 3.5 21 19.5H3z"/>' +
          '<path d="M12 10v4"/><circle cx="12" cy="16.7" r=".9"/></svg>' }),
        el('span', { textContent: t('accountNoReset') })
      ]));
    }

    var go = accountSubmit(creating ? 'accountCreate' : 'accountSignIn');
    go.addEventListener('click', function () {
      if (accountBusy) return;
      var v = accountValues();
      accountBusy = true; accountErr = ''; renderAccount();
      accountPost({
        action: creating ? 'create' : 'login',
        username: v.username,
        password: v.password,
        email: creating ? v.email : ''
      }).then(function (a) {
        accountBusy = false;
        if (!a.ok) return accountFail(a.out);
        state.account.user = a.out.user;
        if (Array.isArray(a.out.saved)) adoptSaved(a.out.saved);
        paintAccountButton();
        trackEvent(creating ? 'account_create' : 'account_login', {});
        closeAccount();
        toast(t('accountSignedIn', { name: a.out.user }));
      }).catch(function () { accountFail({}); });
    });
    form.appendChild(go);

    form.appendChild(accountSwitch(creating ? 'accountSwitchSignIn' : 'accountSwitchCreate',
                                   creating ? 'in' : 'up'));
    if (!creating && state.account.email) {
      form.appendChild(accountSwitch('accountForgot', 'recover'));
    }
  }

  /* ------------------------------------------------ asking for a code */
  function renderAccountRecover(form) {
    form.appendChild(el('h2', { className: 'ac-title', textContent: t('accountRecoverTitle') }));
    form.appendChild(el('p', { className: 'ac-why', textContent: t('accountRecoverWhy') }));
    accountMessages(form);
    form.appendChild(accountField('ac-email', 'accountEmail', 'email', { autocomplete: 'email' }));

    var go = accountSubmit('accountSendCode');
    go.addEventListener('click', function () {
      if (accountBusy) return;
      var v = accountValues();
      accountBusy = true; accountErr = ''; renderAccount();
      accountPost({ action: 'recover-start', email: v.email }).then(function (a) {
        accountBusy = false;
        if (!a.ok) return accountFail(a.out);
        openAccount('code', t('accountEmailSent'));
      }).catch(function () { accountFail({}); });
    });
    form.appendChild(go);
    form.appendChild(accountSwitch('accountSwitchSignIn', 'in'));
  }

  /* --------------------------------- entering one, for either purpose */
  function renderAccountCode(form) {
    var resetting = !state.account.user;
    form.appendChild(el('h2', {
      className: 'ac-title',
      textContent: t(resetting ? 'accountRecoverTitle' : 'accountConfirmTitle')
    }));
    accountMessages(form);

    form.appendChild(accountField('ac-code', 'accountCode', 'text', {
      inputmode: 'numeric',
      maxlength: '6',
      autocomplete: 'one-time-code'
    }));
    if (resetting) {
      form.appendChild(accountField('ac-pass', 'accountNewPassword', 'password', {
        autocomplete: 'new-password'
      }));
    }

    var go = accountSubmit('accountConfirm');
    go.addEventListener('click', function () {
      if (accountBusy) return;
      var v = accountValues();
      accountBusy = true; accountErr = ''; renderAccount();
      var payload = resetting
        ? { action: 'recover-finish', code: v.code, password: v.password }
        : { action: 'email-confirm', code: v.code };

      accountPost(payload).then(function (a) {
        accountBusy = false;
        if (!a.ok) return accountFail(a.out);
        if (resetting) {
          /* The reset dropped every session, this one included, so the way
             back in is the sign-in sheet with the new password. */
          openAccount('in', t('accountResetDone'));
          return;
        }
        state.account.recovery = true;
        openAccount('me', t('accountEmailDone'));
      }).catch(function () { accountFail({}); });
    });
    form.appendChild(go);
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

  /* Chips are OR, so a place shows if it answers any active one — and two of
     them are not answered by the type list at all: the discount chip is
     answered by the deal, and the saved chip by what the account has
     pressed. */
  function matchesFilters(place) {
    if (state.active.indexOf(SAVED_FILTER) !== -1 && isSaved(place.id)) return true;
    if (state.active.indexOf(DEAL_FILTER) !== -1 && liveDealFor(place)) return true;
    return (place.types || []).some(function (id) {
      return state.active.indexOf(id) !== -1;
    });
  }

  function visiblePlaces() {
    if (!state.active.length) return state.places.slice();
    return state.places.filter(matchesFilters);
  }

  var filterOpenTimer = null;

  /* Under 860px the chip row is a drawer. Shut, the bar is one button; open,
     it is the row it always was. And shut is All: the chips are the only
     place a filter lives, so putting the row away puts the map back to every
     place. That is the rule the design rests on — a shut drawer can never be
     a filtered map, so nothing on the button has to warn you that it is one,
     and no visitor has to wonder what the map is not showing them. It costs
     the filter you had picked, which is why the row does not shut on a stray
     press of the map: the only ways out of it are the button and Escape, and
     both are deliberate.

     Above 860px none of this applies. The drawer answers a row that does not
     fit, and on a desktop it does fit: the chips stay flat on the map, the
     button is not drawn, and a filter is nobody's to take away. The width is
     CSS's to decide, so everything here asks isNarrow() before it acts. */
  function filterMenuOpen() {
    return dom.filterBar.classList.contains('is-open');
  }

  function setFilterMenu(open) {
    if (open === filterMenuOpen()) return;
    dom.filterBar.classList.toggle('is-open', open);
    dom.btnFilters.setAttribute('aria-expanded', String(open));
    window.clearTimeout(filterOpenTimer);
    if (!open) {
      dom.filterBar.classList.remove('is-opening');
      /* Exactly what pressing All does, because shutting the row is the same
         answer said a different way — on a phone. A desktop shuts nothing, so
         a stale class going out is not a visitor letting their filter go. */
      if (isNarrow() && state.active.length) {
        state.active = [];
        applyFilters();
      }
      return;
    }
    /* The class the chips' entrance is hung on, held for exactly as long as
       the entrance lasts: the longest chip delay plus its own length. Pressing
       a chip rebuilds the row, and past this point that has to be silent. */
    dom.filterBar.classList.add('is-opening');
    /* Shut, the scroller measures zero, so the edge fades can only be worked
       out once it has width — now for the chips already in view, and again
       when the slide has finished for the ones arriving with it. */
    updateFilterFades();
    filterOpenTimer = window.setTimeout(function () {
      dom.filterBar.classList.remove('is-opening');
      updateFilterFades();
    }, 640);
  }

  function closeFilterMenu() { setFilterMenu(false); }

  /* The one thing a resize can break: a window narrowing onto a filtered map
     would put the drawer's shut button in front of chips that are still
     filtering, which is the one state this design says cannot exist. So it
     arrives open instead, showing what is doing the filtering. */
  function syncFilterMenuToWidth() {
    if (isNarrow() && state.active.length) setFilterMenu(true);
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

    /* First of the real filters, and the only one that is about you rather
       than about food. It is the door to the marks you have pressed — and
       the reason the mark is the whole of it: the button that says "this one"
       and the button that keeps it are the same button, since a
       map you can narrow to your own is a saved list by another name.

       No saves means no chip: a filter whose only possible answer is an empty
       map is not worth the width, and the chip arriving with the first mark
       is how anybody learns it is there at all. */
    if (savedCount()) {
      var onSaved = state.active.indexOf(SAVED_FILTER) !== -1;
      var savedChip = el('button', {
        type: 'button',
        className: 'chip',
        'aria-pressed': String(onSaved),
        textContent: t('filterSaved')
      });
      savedChip.addEventListener('click', function () {
        var at = state.active.indexOf(SAVED_FILTER);
        if (at === -1) state.active.push(SAVED_FILTER); else state.active.splice(at, 1);
        applyFilters({ id: SAVED_FILTER, on: at === -1 });
      });
      dom.filters.appendChild(savedChip);
    }

    /* The only chip that is an offer rather than a description — and last to
       appear, since with no live deal anywhere it is a chip that would filter
       down to nothing. */
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

    /* Each chip slides in a beat after the one before it. Capped at eight
       beats, because a fourteen-word vocabulary would otherwise still be
       arriving long after the row had stopped moving. */
    var chips = dom.filters.children;
    for (var c = 0; c < chips.length; c++) {
      chips[c].style.setProperty('--i', String(Math.min(c, 7)));
    }

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
   * the map fits all 62 into about 300px of width, where a pin is 22px wide:
   * measured, 34 of them sit mostly underneath another one. So pins that
   * would cover each other are drawn as one counted dot until you zoom in
   * far enough for them to stand clear.
   *
   * Grouping is a last resort, not a tidying habit: two dots that both fit
   * on the screen without touching are two dots, however close they look.
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
  /* Exactly as wide as a pin and its halo, and not a pixel wider. A pin is
     22px with a 2.5px rim on each side, so two of them 32px apart are two
     separate circles with daylight between them — nothing to merge. Anything
     closer and one dot is sitting on the other, which is the only thing
     grouping is here to fix.

     It used to be 52, a fingertip's width, on the theory that two pins you
     cannot comfortably tap apart may as well be one. That grouped pairs the
     eye could plainly see as two, and it fed the size ramp: a longer distance
     groups more places, more places make bigger dots, and the opening view
     turned into a handful of balloons. Tapping is not the problem the dots
     were solving — overlap is — and a pair 32px apart is a pair you can zoom
     into normally. */
  var CLUSTER_PX = 32;

  /* Past this zoom nothing is grouped, whatever the spacing. Q Pizza Jaam and
     Telliskivi Šašlõkk are eleven metres apart: 37px at zoom 18, under the 44
     that groups them, so the cluster survived every zoom the click could
     reach and there was no way to get at either place. Two dots 37px apart
     are two perfectly clickable dots. Grouping exists to stop a city of pins
     turning into a smear at low zoom, and by 18 you are looking at one
     street. */
  var CLUSTER_ZOOM_MAX = 17;

  /* Past ten the exact number stops being information. "23" and "31" ask you
     to read a figure and tell you the same thing — a lot, zoom in. So up to
     ten it is counted, and above that it rounds down to a tier: 10+, 20+, 30+.

     Four tiers and not one, because 10+ on its own was doing the same
     flattening it exists to prevent. Both of these are real on this map: the
     opening view carries a cluster of twenty, and zoomed out to the floor the
     whole city is a single dot of sixty-six. Calling those the same thing —
     and drawing them the same size — is the "23 and 31" problem again, one
     order of magnitude up. The ladder stops at 50 rather than running 40, 60,
     70 to the end of the data: the top tier is the one that says "all of it,
     basically", and on a map of seventy-odd places that is what fifty means.

     The dot follows the words exactly. Below eleven it is the proportional
     ramp; at and above it, one width per tier, because a dot that says 10+
     and is drawn at three different widths is telling you a number it has
     just refused to tell you.

     The widths step by six and stop at 58. They used to run to 94, which is
     most of a phone's width in one circle: a cluster of thirty stopped being
     a mark on a map and became a hole in it, covering the streets you were
     trying to read to decide whether to zoom in. A dot only has to be big
     enough to hold its number and to rank against its neighbours, and 58
     does both. The order is still legible — 40, 46, 52, 58 — it just no
     longer buys that ordering with half the map. */
  var CLUSTER_TIERS = [
    { over: 50, label: 50, d: 58 },
    { over: 30, label: 30, d: 52 },
    { over: 20, label: 20, d: 46 },
    { over: 10, label: 10, d: 40 }
  ];

  function clusterTier(count) {
    for (var i = 0; i < CLUSTER_TIERS.length; i++) {
      if (count > CLUSTER_TIERS[i].over) return CLUSTER_TIERS[i];
    }
    return null;
  }

  function clusterCount(count) {
    var tier = clusterTier(count);
    return tier ? tier.label + '+' : String(count);
  }

  /* Two is 32, the width of a pin and its halo — the smallest a cluster can
     be and still not be mistaken for the one place it is standing in front
     of — and every further place adds half a pixel of radius, so ten is 40.
     The ramp is deliberately shallow. A cluster is a signpost, not a bar chart:
     it has to say "more here than there" and stay out of the way of the map
     underneath, and a dot that doubles its width by ten places does neither.
     The first tier picks up at exactly the width ten left off at, so 10 and
     10+ are the same circle wearing different words — which is what they
     are. */
  function clusterSize(count) {
    var tier = clusterTier(count);
    return tier ? tier.d : 30 + count;
  }

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

    /* Against a 22px pin at the small end and just under three times one at
       the big end, so a cluster is never mistaken for a place at any count. The
       count itself grows with the dot; see --cluster-d in the stylesheet. */
    var size = clusterSize(count);
    var shown = clusterCount(count);
    var label = t('clusterLabel', { count: shown });
    var pin = L.marker([lat / count, lng / count], {
      icon: L.divIcon({
        className: 'cluster-pin',
        html: '<span class="cluster-dot' + (count > 2 ? ' is-many' : '') +
              '" style="--cluster-d:' + size + 'px">' +
              '<span class="cluster-count">' + shown + '</span></span>',
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
      if (!isLit(p)) pool.push(p);
    });
    /* Whatever the filters say, the place whose panel is open keeps its pin.
       A shared link to a place the chips exclude would otherwise open a panel
       pointing at nothing. The place you last had open keeps its pin for the
       same reason: a cluster swallowing it is the map forgetting it. */
    if (state.selected) alone[state.selected] = true;
    if (state.marked && byId(state.marked)) alone[state.marked] = true;

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
      var ring = closedRings[p.id];
      if (alone[p.id]) {
        if (!map.hasLayer(marker)) marker.addTo(map);
        /* The ring is part of the pin, so it hides with it — a broken circle
           left standing where a cluster swallowed its dot reads as a place
           of its own. */
        if (ring && !map.hasLayer(ring)) { ring.addTo(map); if (ring.bringToBack) ring.bringToBack(); }
      } else {
        if (map.hasLayer(marker)) map.removeLayer(marker);
        if (ring && map.hasLayer(ring)) map.removeLayer(ring);
      }
    });
    soloPins = alone;
  }

  function applyFilters(change) {
    /* A chip that rules the marked place out takes the mark with it: a lit
       pin for a place the filter says you are not looking at is the map
       arguing with the chips. */
    if (state.marked && state.marked !== state.selected) {
      var held = byId(state.marked);
      if (!held || (state.active.length && !matchesFilters(held))) state.marked = null;
    }
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

  /* ------------------------------------------------------------ rail hints
   * On a phone the rail is a column of icons: a head and shoulders, a die, a
   * play triangle, a coloured dot and a crosshair, because a label wide
   * enough to read is a label wide enough to cover the map. Which left them
   * explaining nothing — a phone has no hover, so the title that carries the
   * meaning on a desktop is never read out loud, and a die over a map is not
   * self-evident to anybody who has not seen this page before.
   *
   * So they say what they are on arrival — and again in the new language the
   * moment one is picked — and then stop saying it. They open in the order
   * they are stacked, 300ms apart, so the eye tracks down the rail rather
   * than being asked to read the whole column at once; each holds for four
   * seconds and collapses back to its icon. Long enough to read twice, gone
   * before it is furniture.
   *
   * The class is inert above 860px, where the pills that have a label there
   * never lose it and the rest never want one, so none of this needs to ask
   * how wide the window is.
   */
  var HINT_MS = 4200;
  /* Top to bottom, which is the order they open in. */
  var HINT_KEYS = ['account', 'random', 'radio', 'style', 'locate'];
  var hintTimers = {};
  /* An introduction owed to a visitor who has had a sheet standing open ever
     since it was due. Paid off by closePanel. */
  var introPending = false;
  /* Whether the cascade has already run. */
  var railIntroduced = false;
  /* The button at the head of the rail is the one that is not in the markup:
     it waits on /api/account. So the introduction waits on it too, rather
     than starting without it and letting the account catch up out of turn —
     a pill that opens after the four below it have opened, and closes before
     they do, reads as a fifth thing rather than as the first, and on a
     fast answer it can be up and gone before the eye has got down the rail.
     The wait is short and it is capped: a slow endpoint, an unbound database
     or no Function at all must not cost the other four their labels, so
     after RAIL_WAIT_MS the rail goes ahead without it and paintAccountButton
     catches it up as before. */
  var RAIL_WAIT_MS = 1400;
  /* Whether the wait has been spent — it is worth having once, on the way in
     — and whether an introduction is still owed at the end of it. */
  var railWaited = false;
  var railWaiting = false;

  /* The colour swatch has no button of its own to grow: the group around it
     is the pill, with the swatch sitting in it where the others keep their
     icon. */
  function hintPill(key) {
    if (key === 'account') return dom.btnAccount;
    if (key === 'radio') return dom.btnRadio;
    if (key === 'style') return dom.styles;
    if (key === 'locate') return dom.btnLocate;
    return dom.btnRandom;
  }

  /* A pill with nothing to say does not get to open: the radio's label is the
     station name, and a station with no name in radio.json would otherwise
     expand the button around an empty span. Same rule takes care of the
     account button, which is hidden until /api/account has answered. */
  function hintText(btn) {
    var label = btn && btn.querySelector('.rail-label');
    return label ? (label.textContent || '').replace(/^\s+|\s+$/g, '') : '';
  }

  function closeHint(key) {
    if (hintTimers[key]) { clearTimeout(hintTimers[key]); hintTimers[key] = null; }
    var btn = hintPill(key);
    if (btn) btn.classList.remove('hint-open');
  }

  function closeHints() {
    for (var i = 0; i < HINT_KEYS.length; i++) closeHint(HINT_KEYS[i]);
  }

  function openHint(key, delay) {
    var btn = hintPill(key);
    if (!btn || btn.hidden || !hintText(btn)) return;
    closeHint(key);
    hintTimers[key] = setTimeout(function () {
      /* Never over an open sheet. With a place open the rail lies along the
         strip above it as a row, and two pills at their full width push the
         colour swatch and the locate button off the side of the screen. */
      if (btn.hidden || !hintText(btn) ||
          document.body.classList.contains('panel-open')) {
        hintTimers[key] = null;
        return;
      }
      btn.classList.add('hint-open');
      hintTimers[key] = setTimeout(function () {
        btn.classList.remove('hint-open');
        hintTimers[key] = null;
      }, HINT_MS);
    }, delay || 0);
  }

  /* On arrival, and again after a language switch — see setLanguage. */
  function introduceRail() {
    /* Not over an open sheet, and not behind the stories: the rail is a row
       along the top of a sheet, where a pill at full width pushes the buttons
       after it off the side of the screen, and it is not on screen at all
       under a story. It waits for either to go rather than being dropped, so
       a visitor who landed on a place or a story — or who switched language
       while reading one — still gets the rail explained the first time they
       are actually looking at the map. */
    if (document.body.classList.contains('panel-open') ||
        (dom.stories && !dom.stories.hidden)) {
      introPending = true;
      return;
    }
    /* Once, on the way in: after that the answer has either landed or been
       given up on, and a language switch introduces the rail as it stands. */
    if (!accountAnswered && !railWaited) {
      railWaited = true;
      railWaiting = true;
      setTimeout(function () {
        if (railWaiting) { railWaiting = false; introduceRail(); }
      }, RAIL_WAIT_MS);
      return;
    }
    railWaiting = false;
    introPending = false;
    railIntroduced = true;
    /* A cascade rather than the whole column at once: 300ms apart is slow
       enough to read down the rail and quick enough that they are all up
       together for most of the time they are up at all. */
    for (var i = 0; i < HINT_KEYS.length; i++) openHint(HINT_KEYS[i], 300 + i * 300);
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
    closeHint('radio');
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
    /* What you just started, by name, for as long as the intro label ran.
       On a phone the pill is a triangle in a circle otherwise, which says a
       stream is playing but never says whose. */
    openHint('radio', 0);
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
   * On a phone the panel is a bottom sheet with two heights, and the grip
   * moves between them: drag it, or tap to swap. A place opens at the high
   * stop — what you tapped for is the place, and the reel at the top of it
   * wants a screen — and the grip pulls it down to the low one for the map.
   * Dragging below the low stop closes it, which is the gesture a phone user
   * reaches for first anyway.
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
      /* A page the browser has zoomed in on shrinks the visual viewport in
         exactly the way a keyboard does, and the measurement below cannot
         tell the two apart: pinched to 2x, half the window reads as covered,
         so the sheet would fold itself up around a keyboard that is not
         there and then scroll the page out from under the fingers doing the
         pinching. A scale that is not 1 is a zoom, not a keyboard — the
         fields on this page are set at 16px precisely so that focusing one
         never zooms. */
      if (vv.scale && Math.abs(vv.scale - 1) > .01) {
        document.documentElement.style.setProperty('--kbd', '0px');
        return;
      }
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
    /* The rail turns into a row along the top of the sheet here, and a pill
       still wearing its label would push the buttons after it off the side of
       the screen. Whatever it was saying, it has been read. */
    closeHints();
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
    /* The place stays marked on the map. Shutting the write-up is not losing
       interest in the place — it is usually the moment you want to see where
       it is — so the pin keeps its name, its halo and its size, and the map
       goes on answering the question the panel raised. */
    if (was) state.marked = was;
    state.view = 'list';
    lastReelKey = null;
    renderPanel();          /* leave the crawlable list in the markup */
    paintMarkers();
    if (!opts || opts.history !== false) syncUrl();
    lastTrackedPath = window.location.pathname + window.location.search;

    /* The panel was covering half the map, so the pin it was about was parked
       off to one side. With the panel gone, settle the map on it: closing a
       place leaves you looking at where it is, which is the only reason the
       map is underneath in the first place. And it comes in while it is at
       it — a lit pin in the middle of the whole city is not where it is. */
    if (was) {
      var seen = byId(was);
      if (seen) focusOn(seen, true);
    }

    var back = state.lastFocus;
    state.lastFocus = null;
    if (back && document.contains(back) && typeof back.focus === 'function') back.focus();

    /* The map is finally the thing on screen. If the rail owed an
       introduction, this is the first moment it has room to make it. */
    if (introPending) introduceRail();
  }

  function selectPlace(id, opts) {
    opts = opts || {};
    var place = byId(id);
    if (!place) return;
    if (!state.lastFocus) state.lastFocus = document.activeElement;

    var fresh = !state.selected;
    state.selected = id;
    /* One mark at a time: opening a place takes it from whatever held it. */
    state.marked = id;
    state.view = 'detail';
    renderPanel();
    openPanel();
    /* Tapping a place is a request for the place, not for the map, so on a
       phone the sheet opens at its full stop: the restaurant's page, as far
       as a phone is concerned. It used to open at the half stop, on the
       reasoning that the point of opening a place is to see where it is —
       which left the reel sliced across the bottom edge of the screen and a
       scroll between you and the thing you tapped for. The strip of map above
       it still holds the pin, the chip row and the way back out, and the grip
       drags the sheet down for anyone who wants the map back. */
    var full = isNarrow();
    document.body.classList.toggle('sheet-full', full);
    if (dom.sheetGrip) dom.sheetGrip.setAttribute('aria-expanded', String(full));
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
    paintSave();
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
   *
   * A band can land on a half step — 2.5 sits between the cheap end and the
   * middle — so a slot has three states, not two: full, half, empty. The half
   * slot is one euro sign in hairline with a second one stacked on top of it,
   * clipped to its left half in the accent, which keeps the glyph itself
   * whole where a gradient fill would lean on background-clip: text.
   */
  function priceGauge(n) {
    var wrap = el('span', {
      className: 'price',
      role: 'img',
      'aria-label': t('priceOf', { n: formatPrice(n) })
    });
    for (var i = 1; i <= 4; i++) {
      /* How much of this slot the band fills: 1 or more is a full sign, half
         a slot is a half sign, at or below zero is an empty socket. */
      var fill = n - i + 1;
      if (fill >= 1) {
        wrap.appendChild(el('i', { className: 'on', textContent: '€' }));
      } else if (fill >= 0.5) {
        wrap.appendChild(el('i', { className: 'half', textContent: '€' }, [
          el('b', { 'aria-hidden': 'true', textContent: '€' })
        ]));
      } else {
        wrap.appendChild(el('i', { textContent: '€' }));
      }
    }
    return wrap;
  }

  /* The band as it reads out loud: whole numbers stay whole, half steps keep
     the one decimal they need, written with the reading language's own decimal
     mark so Estonian hears "2,5" where English hears "2.5". */
  function formatPrice(n) {
    if (typeof n !== 'number' || !isFinite(n)) return String(n);
    var digits = n % 1 === 0 ? 0 : 1;
    try {
      return n.toLocaleString(state.lang, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      });
    } catch (e) {
      return n.toFixed(digits);
    }
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
      /* The flag says it in full — a whole line to itself, and "Closed" alone
         on a map of restaurants reads as closed *today*, which is the one
         thing this site will not claim. The row badge keeps the one-word
         version: it is scanned, not read, and at "Cerrado para siempre" the
         types beside it wrapped to three lines on a phone. */
      place.closed
        ? el('div', { className: 'closed-flag' }, [
            el('span', { className: 'shut-glyph', 'aria-hidden': 'true', html: SHUT_GLYPH }),
            el('span', { textContent: t('closedFlag') })
          ])
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
      dom.detail.appendChild(el('p', {
        className: 'muted-note is-shut-note',
        textContent: t(closedNoteKey(place))
      }));
    }

    /* A few lines about the place, straight under the name, and then the
       thing there is to look at. The reel led for a while, on the reasoning
       that the one part of the page which is not text should not have to be
       scrolled to — which was true, and cost the panel its opening sentence:
       a player started under the name before anything had been said about
       the restaurant, and the write-up read as a caption under it. The
       paragraph says what this place is, the reel shows it. Three or four
       lines is not a screenful, so it is still the second thing on the
       panel rather than something to scroll for. */
    var blurb = blurbFor(place);
    if (blurb) {
      dom.detail.appendChild(el('p', {
        className: 'blurb' + (/^\s*TODO/i.test(blurb) ? ' is-todo' : ''),
        textContent: blurb
      }));
    }

    /* The reel first and the photos after it, and a place with neither says
       so in that same slot under its own heading rather than leaving you to
       reach the bottom and work it out.

       No video means no section at all — an empty "The reel" heading over a
       placeholder made six real places look half-finished. A quiet line says
       what is actually true instead: been, not filmed. */
    if (place.reel) {
      dom.detail.appendChild(section(reelWord(reelProvider(place.reel)), reelBlock(place)));
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

    if ((place.types || []).length) {
      dom.detail.appendChild(section('types',
        el('div', { className: 'tag-row' }, place.types.map(function (id) {
          return el('span', { className: 'tag', textContent: typeLabel(id) });
        }))
      ));
    }

    /* The offer in full, and the button that makes the code, straight after
       the tags: the badge at the top says how much, and this says what of and
       hands it over. It sat under the dishes for a while, at the very foot of
       the read, which put the one thing here you act on rather than read
       below a list you skim — a discount is part of deciding where to eat, so
       it belongs with the deciding. It stays below the reel and the photos
       all the same: a QR meant to be held up at a till has no business in
       front of somebody who has not seen the place yet. */
    if (deal) dom.detail.appendChild(section('passOffer', dealBlock(place, deal)));

    if ((place.mustOrder || []).length) {
      dom.detail.appendChild(section('mustOrder',
        el('ul', { className: 'dish-list' }, place.mustOrder.map(function (dish) {
          return el('li', { textContent: dish });
        }))
      ));
    }

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
        trackClick(el('a', {
          className: 'link-btn is-primary',
          href: 'https://www.google.com/maps/dir/?api=1&destination=' + place.lat + ',' + place.lng,
          target: '_blank',
          rel: 'noopener',
          textContent: t('directions')
        }), 'directions', { place: place.name }),
        /* Calling sits next to the directions, which is the other thing you
           do about a place rather than to read about it: how to get there,
           and how to ask whether it is worth setting off. It rode with the
           name for a while, where it was the loudest thing on a panel about
           a restaurant nobody had decided on yet. No number means no
           button, and the number itself is still in the facts above. */
        place.phone ? callButton(place) : null,
        place.website
          ? trackClick(el('a', {
              className: 'link-btn',
              href: place.website,
              target: '_blank',
              rel: 'noopener',
              textContent: t('website')
            }), 'website', { place: place.name })
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

  /* TikTok says "video", Instagram says "reel". Use each one's own word — in
     the heading over the player, in the frame's own name, and in the link out
     to the post underneath it. */
  function reelWord(provider) { return provider === 'tiktok' ? 'video' : 'reel'; }

  /* The player used to sit behind a "Load the reel" button, so that a visitor
     who only wanted the address never fetched anything from Instagram. It
     saved a request on the places nobody watched and charged a wait to every
     place somebody did: open the place, find the button, press it, then watch
     a player start from nothing. Opening a profile is already a deliberate
     act and the video is the reason for it, so the player is built with the
     panel now and is loaded — often buffered — by the time the write-up has
     been read. Pressing play plays. */
  function reelBlock(place) {
    var provider = reelProvider(place.reel);

    /* A language switch re-renders the open panel, which builds this block
       again. That is one visitor and one reel, so it is counted once. */
    if (lastReelKey !== place.id) {
      lastReelKey = place.id;
      trackEvent('reel_load', { place: place.name, provider: provider || 'unknown' });
    }

    return provider === 'tiktok' ? embedTikTok(place) : embedInstagram(place);
  }

  /* TikTok publishes a plain iframe player at a fixed shape — 325x739 is the
     ratio its own embed uses — so the frame it goes in is the shape of the
     finished player and nothing has to be measured. */
  function embedTikTok(place) {
    var id = /\/video\/(\d{6,})/.exec(place.reel);
    var wrap = el('div', { className: 'reel-embed' });

    if (id) {
      wrap.appendChild(el('div', { className: 'reel-frame is-tiktok' }, [
        el('iframe', {
          src: 'https://www.tiktok.com/embed/v2/' + id[1],
          title: place.name + ' — ' + t('video'),
          allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
          allowfullscreen: '',
          referrerpolicy: 'strict-origin-when-cross-origin',
          frameborder: '0',
          scrolling: 'no'
        })
      ]));
    }

    wrap.appendChild(reelFallback(place.reel, 'videoFallback'));
    return wrap;
  }

  /* Instagram publishes the same iframe player that embed.js builds for a
     blockquote — the permalink with /embed on the end — so the reel goes in
     directly and no script is involved at all.

     Going through embed.js meant fetching it, polling for window.instgrm,
     handing it a blockquote and letting it draw whatever box it had measured
     at the moment it ran. In a panel that is still sliding in, that moment is
     a bad one: the box came out short, and a reel taller than its box was cut
     off at the bottom — the player half in view that this replaces. The frame
     below opens at the shape a reel actually is and then takes Instagram's
     own measurement for the exact one. */
  function embedInstagram(place) {
    /* A link copied while browsing your own grid carries the profile name in
       front of the shortcode — a shape Instagram serves the post at but not
       the embed, so the player is addressed by the shortcode alone. The kind
       of post is kept as it was written: /p/ is where a photo lives. */
    var post = /\/(p|reels?|tv)\/([A-Za-z0-9_-]+)/.exec(place.reel);
    var src = post
      ? 'https://www.instagram.com/' + (post[1] === 'reels' ? 'reel' : post[1]) +
        '/' + post[2] + '/embed/'
      : String(place.reel).replace(/[?#].*$/, '').replace(/\/+$/, '') + '/embed/';

    var frame = el('div', { className: 'reel-frame is-instagram' }, [
      el('iframe', {
        src: src,
        title: place.name + ' — ' + t('reel'),
        allow: 'autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen',
        allowfullscreen: '',
        referrerpolicy: 'strict-origin-when-cross-origin',
        frameborder: '0',
        scrolling: 'no'
      })
    ]);

    return el('div', { className: 'reel-embed' }, [
      frame,
      reelFallback(place.reel, 'reelFallback')
    ]);
  }

  /* Neither player is ours, and both can come up blank — a deleted post, a
     browser blocking third-party frames. The way out stays under every one. */
  function reelFallback(url, key) {
    return el('p', { className: 'reel-fallback' }, [
      el('a', { href: url, target: '_blank', rel: 'noopener', textContent: t(key) })
    ]);
  }

  /* Instagram's embed page posts the height it came out at to whoever framed
     it — the message embed.js listens for, taken here instead. It arrives
     once the post has drawn and again whenever the post changes shape, and it
     is stored as the ratio of the frame rather than as a height in pixels, so
     a phone turned on its side keeps a whole reel rather than a wrong number.
     If it never arrives the frame keeps the shape it opened at, which is the
     shape of a reel; nothing here can leave a player with no room. */
  function wireReelMeasure() {
    window.addEventListener('message', function (ev) {
      if (!/^https:\/\/(www\.)?instagram\.com$/.test(ev.origin)) return;

      var frames = dom.detail.querySelectorAll('.reel-frame.is-instagram iframe');
      var frame = null;
      for (var i = 0; i < frames.length; i++) {
        if (frames[i].contentWindow === ev.source) { frame = frames[i]; break; }
      }
      if (!frame) return;

      var data = ev.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { return; }
      }

      var details = (data && data.details) || data;
      var height = Number(details && details.height);
      var width = frame.offsetWidth;
      if (!height || !width || height < 100) return;

      frame.parentNode.style.aspectRatio = width + ' / ' + height;
    });
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
        trackEvent('photo_open', { place: place.name, photo_index: i + 1 });
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

    /* Whether what is on screen is your own saves and nothing else. One
       chip, that chip, and nothing typed: the moment a second filter or a
       search joins in this is no longer the list, it is a slice of the map
       that happens to be cut out of it, and it reads like every other slice. */
    var mine = !words.length && state.active.length === 1 &&
               state.active[0] === SAVED_FILTER;

    if (mine) {
      /* The one list here that is not alphabetical. The order you saved them in is information — the newest is what you were doing most
         recently, and most likely what you came back for — and the alphabet
         throws it away for a sort nobody asked for. */
      var rank = {};
      state.saved.forEach(function (id, i) { rank[id] = i; });
      places.sort(function (a, b) { return rank[a.id] - rank[b.id]; });
    } else {
      var collator;
      try { collator = new Intl.Collator(state.lang, { sensitivity: 'base' }); }
      catch (e) { collator = { compare: function (a, b) { return a < b ? -1 : a > b ? 1 : 0; } }; }
      places.sort(function (a, b) { return collator.compare(a.name, b.name); });
    }

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

      /* The list says the same thing the map now says: this is the one you
         were just reading. It is where you come back to, so it is worth being
         findable in a list of seventy. */
      var kept = isKept(place);

      var row = el('button', {
        type: 'button',
        className: 'list-row' + (place.closed ? ' is-closed' : '') + (kept ? ' is-kept' : ''),
        /* Which is a mark on the list as well as a word in the row's label:
           aria-current is the one announcement for "the one you are on" that
           needs no wording of its own in five languages. */
        'aria-current': kept ? 'true' : null,
        /* The row's own label is what a screen reader reads, so anything the
           row shows has to be spelled into it or it is not there at all. */
        'aria-label': t('openPlace', { name: place.name }) +
          (place.closed ? ', ' + t('closed') : '') + ', ' + t(depthMarkKey(place)) +
          (deal ? ', ' + (offer || t('filterDiscount')) : '') +
          /* The count is drawn aria-hidden, so a row that shows one has to
             spell it out or a screen reader gets the digit and nothing to
             hang it on. */
          (saveCount(place.id)
            ? ', ' + (saveCount(place.id) === 1
                ? t('saveCountOne')
                : t('saveCount', { n: saveCount(place.id) }))
            : '')
      }, [
        el('span', { className: 'list-name', textContent: place.name }),
        el('span', { className: 'list-sub' }, [
          /* After the price, which holds the same edge on every row, and
             before the types, which are the part that can run long. */
          priceGauge(place.price),
          deal ? dealMark(deal) : null,
          /* It used to ride at the end of the type list, in the same grey and
             the same size as "Bakery · Coffee", which made the one thing that
             decides whether to set off at all the last word of a description.
             It sits with the badges now, where the discount sits: the row's
             two facts about the place rather than about the food. */
          place.closed ? shutMark() : null,
          saveMark(place),
          el('span', {
            className: 'list-types',
            textContent: (place.types || []).map(typeLabel).join(' · ')
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
    /* Suppressed on your own list for the reason a search suppresses it: a
       handful of places you chose yourself, cut in two by a heading about when
       the site added them, makes you read your own list twice. */
    var fresh = (words.length || mine) ? [] : recentlyAdded().filter(function (p) { return shown[p.id]; });

    if (fresh.length > 1) section('listNew', fresh, 'is-new');
    /* "All places" over a filtered list would be a lie the count sitting next
       to it immediately contradicts, so a narrowed list falls back to naming
       its sort order instead. */
    var everything = !words.length && !state.active.length;
    /* And your own saves are named as themselves. "A–Z" over them would be
       true and useless: this is the one list on the site whose point is whose
       it is, not what order it came out in. */
    section(everything ? 'listTitle' : mine ? 'listSaved' : 'listAlphabet', places);
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

  /* --------------------------------------------------------------- stories
   * The one part of this map that is not permanent.
   *
   * Everything else here is a place that will still be there next year. A
   * story is the opposite: a video that is up for a day or two and then is
   * gone, which is the whole reason anybody opens one now rather than later.
   * So the countdown is not decoration — it is the thing being said, and it
   * sits next to the name at the top of every frame.
   *
   * The shape is the one everybody already knows, because there is no version
   * of this worth teaching from scratch: the mark in the corner grows a ring,
   * pressing it fills the screen, a bar along the top per story, the left of
   * the screen goes back, the rest goes on, hold to stop it, swipe down to
   * leave. The one thing under it that is ours is the link: a story points at
   * a place on this map, and pressing it lands you on that place with the pin
   * already open, rather than in a browser somewhere else.
   *
   * A story does not have to be posted at the moment it is written, either.
   * An entry carries the day and time it goes up, and the browser is what
   * starts it: nothing is deployed at nine in the morning, the file was
   * already there, and the ring appears on the minute for whoever is looking.
   * Coming down is the same clock read the other way, and the tidying up
   * afterwards is tools/stories.mjs on a cron — see the README.
   *
   * It all lives in data/stories.json, and it is optional in the same way the
   * radio is: an empty file means no ring, no viewer, nothing changed. See
   * the README for how an entry is written.
   */

  /* The data names a file, not a path, exactly as a place's photos do: the
     folder is the same for all of them and spelling it out nine times is nine
     chances to spell it wrong. */
  var STORY_DIR = 'stories/';
  var STORY_SEEN_KEY = 'ttb.stories.seen';
  var STORY_SOUND_KEY = 'ttb.stories.sound';
  /* Press for longer than this and it is a hold, not a tap. Instagram's own
     is somewhere near this; much shorter and a slow tap pauses the video. */
  var STORY_HOLD_MS = 260;
  /* How far down a drag has to travel before it means "close this". */
  var STORY_SWIPE = 70;
  /* The countdown is drawn in minutes, so it only ever needs redrawing once a
     minute. The same tick is what retires a story the moment it runs out. */
  var STORY_TICK_MS = 60000;
  /* How long a photograph stands there, when the entry does not say. A video
     has a length of its own and a photograph does not, so this is the one
     number in the viewer that is a decision rather than a measurement: long
     enough to read a line of writing on it, short enough that nobody taps
     past it out of impatience. An entry can set its own "seconds". */
  var STORY_PHOTO_MS = 6000;
  /* How long a story stands for when its entry only says when it goes up.
     A day and a half: long enough that somebody who only opens the map in the
     evening still catches a thing posted that morning, short enough that the
     countdown is the reason to open it now rather than later. It is 36 real
     hours rather than "a day and a half of dates", so a window that steps
     over the night the clocks change is still 36 hours of somebody's life.
     tools/clock.mjs holds the same number for the validator and the cron. */
  var STORY_HOURS = 36;

  var storyHoldTimer = null;
  var storyFrame = null;
  var storyTick = null;

  /* ------------------------------------------------------------- the clock
   * Times in the data are Tallinn wall clock — "2026-09-14T21:00" is nine in
   * the evening in Tallinn, which is the only clock the person writing the
   * file and the person watching the video are both reading. Turning that
   * into an instant means knowing the offset in force on that date, and the
   * offset depends on the instant, so it is worked out twice: the first pass
   * can be an hour out, and only inside the hour the clocks change, and the
   * second pass settles it.
   */
  function tallinnOffset(utcMs) {
    try {
      var parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Tallinn', hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      }).formatToParts(new Date(utcMs));
      var f = {};
      parts.forEach(function (p) { f[p.type] = p.value; });
      var local = Date.UTC(Number(f.year), Number(f.month) - 1, Number(f.day),
                           Number(f.hour) % 24, Number(f.minute));
      return local - Math.floor(utcMs / 60000) * 60000;
    } catch (e) {
      /* No tzdata in this browser's build. Estonia keeps the EU's rule and
         has since 2002: +2 in winter, +3 from 01:00 UTC on the last Sunday in
         March to 01:00 UTC on the last Sunday in October. */
      var year = new Date(utcMs).getUTCFullYear();
      var on = lastSundayAtOne(year, 2);
      var off = lastSundayAtOne(year, 9);
      return (utcMs >= on && utcMs < off) ? 10800000 : 7200000;
    }
  }

  function lastSundayAtOne(year, month) {
    var d = new Date(Date.UTC(year, month + 1, 0, 1, 0, 0));   /* the last day of the month */
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());              /* back up to Sunday */
    return d.getTime();
  }

  function tallinnTime(stamp) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(stamp || ''));
    if (!m) return NaN;
    var wall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
    return wall - tallinnOffset(wall - tallinnOffset(wall));
  }

  /* ------------------------------------------------------------- the window
   * When a story goes up, and when it goes. One place works it out and
   * everything else asks it, because "is this up" is asked once a minute and
   * getting two answers out of it would put the ring and the viewer at odds.
   *
   *   from and until   exactly what they say
   *   from only        36 hours from the moment it goes up  <- the usual one
   *   until only       up from the moment "live" is true, until then
   */
  function storyStart(story) {
    /* No "from" is not "no idea": it is up already, which is any instant at
       or before now. */
    if (!story || !story.from) return -Infinity;
    var from = tallinnTime(story.from);
    return from === from ? from : -Infinity;
  }

  function storyEnd(story) {
    if (!story) return NaN;
    if (story.until) return tallinnTime(story.until);
    var from = story.from ? tallinnTime(story.from) : NaN;
    return from === from ? from + STORY_HOURS * 3600000 : NaN;
  }

  /* ------------------------------------------------------------- the queue */

  /* Up, in the order the file lists them. A story that is switched off, has
     not started, or has run out is not up, and nothing on the page says a
     word about it. */
  function liveStories() {
    var now = Date.now();
    return (state.stories || []).filter(function (s) {
      if (!s || s.live !== true || !(s.video || s.photo)) return false;
      var end = storyEnd(s);
      if (!(end > now)) return false;
      return !(storyStart(s) > now);
    });
  }

  /* Watched is remembered per story and per run: repost under the same id
     with a new time and the ring lights up again, which is what reposting
     means. It is the times as the file writes them rather than the instant
     they work out to, so an entry that has been left alone keeps its answer
     across a change to the default window. Only the stories still up are
     kept, so the entry in somebody's browser cannot grow for ever. */
  function storyVersion(story) {
    return (story.from || '') + '/' + (story.until || '');
  }

  function storiesSeen() {
    try {
      var raw = JSON.parse(storeGet(STORY_SEEN_KEY) || '{}');
      return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    } catch (e) { return {}; }
  }

  function storySeen(story) { return storiesSeen()[story.id] === storyVersion(story); }

  function markStorySeen(story) {
    var seen = storiesSeen();
    seen[story.id] = storyVersion(story);
    var kept = {};
    liveStories().forEach(function (s) {
      if (seen[s.id] !== undefined) kept[s.id] = seen[s.id];
    });
    storeSet(STORY_SEEN_KEY, JSON.stringify(kept));
  }

  function storyCaption(story) {
    var c = story.caption || {};
    return c[state.lang] || c[DEFAULT_LANG] || '';
  }

  function storyCtaLabel(story) {
    var label = story.linkLabel && (story.linkLabel[state.lang] || story.linkLabel[DEFAULT_LANG]);
    if (label) return label;
    var place = story.spot ? byId(story.spot) : null;
    if (place) return t('storySee', { name: place.name });
    return t('storyLink');
  }

  /* What the top line says, and the reason the whole thing exists. Minutes
     under the hour, hours under the day, days above it — the same ladder a
     phone uses, because past a point the exact number stops being the point. */
  function storyLeft(story) {
    var ms = storyEnd(story) - Date.now();
    if (!(ms >= 60000)) return t('storyLeftSoon');
    var mins = Math.floor(ms / 60000);
    if (mins < 60) return t('storyLeftMinutes', { n: mins });
    var hours = Math.floor(mins / 60);
    if (hours < 24) return t('storyLeftHours', { n: hours });
    return t('storyLeftDays', { n: Math.floor(hours / 24) });
  }

  /* ---------------------------------------------------------------- the ring
   * The mark is a picture until there is something to watch, and a button
   * from then on. Nothing in the card moves when that happens: the ring is
   * drawn outside the box the picture already occupies.
   */
  function renderStoryRing() {
    var mark = dom.brand && dom.brand.querySelector('.brand-mark');
    if (!mark) return;
    var live = liveStories();

    if (!live.length) {
      if (dom.storyRing) {
        dom.storyRing.parentNode.insertBefore(mark, dom.storyRing);
        dom.storyRing.parentNode.removeChild(dom.storyRing);
        dom.storyRing = null;
      }
      return;
    }

    if (!dom.storyRing) {
      var ring = el('button', {
        type: 'button',
        className: 'brand-ring',
        id: 'brand-ring',
        'data-i18n-aria-label': 'storiesOpen',
        'data-i18n-title': 'storiesOpen',
        'aria-label': t('storiesOpen'),
        title: t('storiesOpen')
      });
      mark.parentNode.insertBefore(ring, mark);
      ring.appendChild(mark);
      ring.addEventListener('click', function () { openStories(null, ring); });
      dom.storyRing = ring;
    }

    /* Watched them all and they are still up: the ring stays, greyed, the way
       it does everywhere else. It has stopped asking, not gone away. */
    var unseen = live.filter(function (s) { return !storySeen(s); });
    dom.storyRing.classList.toggle('is-seen', unseen.length === 0);
  }

  /* One tick a minute, which is all a countdown drawn in minutes needs, and
     it is also what takes the ring down the moment the last story runs out
     under somebody who left the tab open. */
  function startStoryClock() {
    if (storyTick || !(state.stories || []).length) return;
    storyTick = window.setInterval(function () {
      renderStoryRing();
      if (!dom.stories.hidden) {
        var story = state.story.list[state.story.index];
        if (story) dom.storyLeft.textContent = storyLeft(story);
      }
    }, STORY_TICK_MS);
  }

  /* ------------------------------------------------------------- the viewer */

  function openStories(startAt, opener) {
    var live = liveStories();
    if (!live.length) return;

    var index = 0;
    if (typeof startAt === 'number') {
      index = Math.max(0, Math.min(live.length - 1, startAt));
    } else {
      /* Straight to the first one not watched yet, and back to the top once
         they have all been seen. */
      for (var i = 0; i < live.length; i++) {
        if (!storySeen(live[i])) { index = i; break; }
        if (i === live.length - 1) index = 0;
      }
    }

    state.story.list = live;
    state.story.index = index;
    state.story.opener = opener || document.activeElement;
    /* Sound is off until somebody asks for it, and on for ever after they
       have. A map that starts talking because a ring was pressed is the kind
       of thing people close the tab over — and on a phone the browser would
       have refused anyway, so this only makes a desktop behave like the
       phone everybody already knows. */
    state.story.muted = storeGet(STORY_SOUND_KEY) !== 'on';

    /* Two things playing at once is one too many. */
    if (radioEl && !radioEl.paused) stopRadio();

    dom.stories.hidden = false;
    buildStoryBars();
    paintStory();
    dom.storyClose.focus();
    trackEvent('story_open', { stories: live.length });
  }

  function buildStoryBars() {
    clear(dom.storyBars);
    state.story.list.forEach(function () {
      dom.storyBars.appendChild(el('div', { className: 'story-bar' }, [el('span')]));
    });
  }

  /* ------------------------------------------------------- watching a story
   * A story is opened far more often than it is watched, and the gap between
   * the two is the only thing worth knowing about a reel: a run of stories
   * everybody skips at two seconds is a run of stories nobody is watching,
   * however healthy the opens look.
   *
   * So the frame loop below keeps the fraction that has gone by, and whatever
   * ends the story — the next one, the arrows, the close button, the last one
   * running out — reports how far it got on the way out. One story_view when
   * it comes up, one story_watch when it goes, per story rather than per
   * opening of the ring.
   */
  var storyWatch = null;

  function beginStoryWatch(story) {
    endStoryWatch();
    storyWatch = { story: story, done: 0, finished: false };
    trackEvent('story_view', {
      story_id: story.id,
      spot: story.spot || '',
      format: story.photo ? 'photo' : 'video',
      position: state.story.index + 1
    });
  }

  /* Videos rarely report the last hundredth of themselves before the browser
     calls them ended, so anything past 95% counts as watched to the end —
     and a story that actually ended says so itself rather than being judged
     on a fraction. */
  function endStoryWatch() {
    if (!storyWatch) return;
    var watch = storyWatch;
    storyWatch = null;
    var percent = Math.round(Math.max(0, Math.min(1, watch.done)) * 100);
    if (watch.finished) percent = 100;
    trackEvent('story_watch', {
      story_id: watch.story.id,
      spot: watch.story.spot || '',
      format: watch.story.photo ? 'photo' : 'video',
      percent_watched: percent,
      completed: percent >= 95 ? 'yes' : 'no'
    });
  }

  /* Draw whichever story the queue is standing on, and start it. */
  function paintStory() {
    var s = state.story;
    var story = s.list[s.index];
    if (!story) { closeStories(); return; }

    for (var i = 0; i < dom.storyBars.children.length; i++) {
      var fill = dom.storyBars.children[i].firstChild;
      fill.style.width = i < s.index ? '100%' : '0%';
    }

    paintStoryText(story);
    if (story.photo) showStoryPhoto(story);
    else showStoryVideo(story);

    markStorySeen(story);
    renderStoryRing();
    beginStoryWatch(story);
    startStoryProgress();
  }

  function showStoryVideo(story) {
    var s = state.story;
    var video = dom.storyVideo;

    dom.storyPhoto.hidden = true;
    dom.storyPhoto.removeAttribute('src');
    dom.storyVideo.hidden = false;

    video.pause();
    if (story.poster) video.setAttribute('poster', STORY_DIR + story.poster);
    else video.removeAttribute('poster');
    video.muted = s.muted;
    video.src = STORY_DIR + story.video;
    var started = video.play();
    if (started && started.catch) {
      started.catch(function () {
        /* Sound is refused until a browser is satisfied the visitor asked for
           it, and the rules differ per browser and per platform. Muted always
           plays, so drop to that rather than showing a still frame, and put
           the speaker button in the state that says what happened. */
        if (!video.muted) {
          s.muted = true;
          video.muted = true;
          markStorySound();
          var retry = video.play();
          if (retry && retry.catch) retry.catch(function () { /* nothing left to try */ });
        }
      });
    }
  }

  /* A photograph is the same story with the clock moved: nothing plays, so
     the viewer counts the seconds itself and the bar along the top is the
     only thing that says how long is left. */
  function showStoryPhoto(story) {
    var s = state.story;

    dom.storyVideo.pause();
    dom.storyVideo.removeAttribute('src');
    dom.storyVideo.load();
    dom.storyVideo.hidden = true;

    s.photoSpent = 0;
    s.photoFrom = now();
    dom.storyPhoto.hidden = false;
    dom.storyPhoto.alt = storyCaption(story) || t('storiesTitle');
    dom.storyPhoto.src = STORY_DIR + story.photo;
  }

  /* How long this story runs, in milliseconds. A video answers for itself
     once it has read enough of its own header; a photograph is told. */
  function storyLength(story) {
    if (story.photo) return Math.max(1000, (story.seconds || 0) * 1000 || STORY_PHOTO_MS);
    var length = dom.storyVideo.duration;
    return (length && isFinite(length) && length > 0) ? length * 1000 : 0;
  }

  function now() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }

  /* Everything on the frame that is words rather than picture. Split out
     because a language change has to redraw all of it without touching the
     video, which would otherwise start again from the top. */
  function paintStoryText(story) {
    var s = state.story;
    if (!story) return;
    dom.stories.setAttribute('aria-label',
      t('storiesTitle') + ' — ' + t('storyOf', { n: s.index + 1, total: s.list.length }));
    dom.storyLeft.textContent = storyLeft(story);

    var caption = storyCaption(story);
    dom.storyCaption.textContent = caption;
    dom.storyCaption.hidden = !caption;

    paintStoryCta(story);
    markStorySound();
  }

  /* The link, which is the reason a story is on a map rather than on a phone.
     A place id opens the place here; anything else is a plain outbound link. */
  function paintStoryCta(story) {
    var place = story.spot ? byId(story.spot) : null;
    var target = place ? null : (story.link || '');

    if (!place && !target) {
      dom.storyCta.hidden = true;
      dom.storyCta.removeAttribute('href');
      return;
    }

    dom.storyCta.hidden = false;
    dom.storyCtaLabel.textContent = storyCtaLabel(story);

    if (place) {
      /* Not an href to ?spot=: the map is already loaded underneath, and
         asking the browser to fetch the whole page again to land on a pin it
         can open in a frame would be the slowest possible way to do it. */
      dom.storyCta.setAttribute('href', '?spot=' + encodeURIComponent(place.id));
      dom.storyCta.removeAttribute('target');
      dom.storyCta.removeAttribute('rel');
    } else {
      dom.storyCta.setAttribute('href', target);
      dom.storyCta.setAttribute('target', '_blank');
      dom.storyCta.setAttribute('rel', 'noopener');
    }
  }

  function markStorySound() {
    var story = state.story.list[state.story.index];
    /* Nothing to turn off on a photograph, so the button goes rather than
       standing there doing nothing. */
    dom.storySound.hidden = !!(story && story.photo);
    dom.storySound.classList.toggle('is-muted', state.story.muted);
    var label = t(state.story.muted ? 'storyUnmute' : 'storyMute');
    dom.storySound.setAttribute('aria-label', label);
    dom.storySound.setAttribute('title', label);
  }

  function setStorySound(muted) {
    var story = state.story.list[state.story.index];
    trackEvent('story_sound', {
      sound: muted ? 'off' : 'on',
      story_id: (story && story.id) || ''
    });
    state.story.muted = muted;
    dom.storyVideo.muted = muted;
    storeSet(STORY_SOUND_KEY, muted ? 'off' : 'on');
    markStorySound();
    if (!muted) {
      var again = dom.storyVideo.play();
      if (again && again.catch) again.catch(function () { /* still refused; the picture keeps playing */ });
    }
  }

  /* The bar fills with the video rather than on a timer beside it, so what it
     shows is where the video actually is — including while it buffers. A
     photograph has nothing to ask, so there the same loop runs the clock and
     steps on at the end of it. */
  function startStoryProgress() {
    stopStoryProgress();
    storyFrame = window.requestAnimationFrame(function step() {
      storyFrame = window.requestAnimationFrame(step);
      var s = state.story;
      var story = s.list[s.index];
      var bar = dom.storyBars.children[s.index];
      if (!story || !bar) return;

      var done = 0;
      if (story.photo) {
        var spent = s.photoSpent + (s.held ? 0 : now() - s.photoFrom);
        done = Math.min(1, spent / storyLength(story));
        if (done >= 1) {
          if (storyWatch) storyWatch.finished = true;
          stepStory(1);
          return;
        }
      } else {
        var length = storyLength(story);
        done = length ? Math.min(1, (dom.storyVideo.currentTime * 1000) / length) : 0;
      }
      if (storyWatch) storyWatch.done = done;
      bar.firstChild.style.width = (done * 100).toFixed(2) + '%';
    });
  }

  function stopStoryProgress() {
    if (storyFrame) { window.cancelAnimationFrame(storyFrame); storyFrame = null; }
  }

  function stepStory(delta) {
    var s = state.story;
    var next = s.index + delta;
    /* Back from the first one is a no-op, the way it is in a story anywhere
       else. Forward past the last one is the end: that is what closes it. */
    if (next < 0) {
      /* Back from the first one starts it again rather than going nowhere. */
      var here = s.list[s.index];
      if (here && here.photo) { s.photoSpent = 0; s.photoFrom = now(); }
      else dom.storyVideo.currentTime = 0;
      return;
    }
    if (next >= s.list.length) { closeStories(); return; }
    clearHold();
    s.index = next;
    paintStory();
  }

  function holdStory(on) {
    var s = state.story;
    if (s.held === on) return;
    var story = s.list[s.index];

    if (on) {
      /* Bank what the photograph has already spent; a video is holding its
         own place and does not need telling. */
      if (story && story.photo) s.photoSpent += now() - s.photoFrom;
      s.held = true;
      dom.storyStage.classList.add('is-held');
      dom.storyVideo.pause();
      return;
    }

    clearHold();
    if (story && story.photo) { s.photoFrom = now(); return; }
    var again = dom.storyVideo.play();
    if (again && again.catch) again.catch(function () { /* ignore */ });
  }

  /* Let go of the hold without starting the video again — for when what comes
     next is a different video, or no video at all. Asking a browser to play
     and pause in the same breath is how the console fills up with warnings
     about a play() nobody watched. */
  function clearHold() {
    state.story.held = false;
    dom.storyStage.classList.remove('is-held');
  }

  function closeStories() {
    if (dom.stories.hidden) return;
    stopStoryProgress();
    endStoryWatch();
    clearHold();
    dom.storyVideo.pause();
    dom.storyVideo.removeAttribute('src');
    dom.storyVideo.load();
    dom.storyPhoto.removeAttribute('src');
    dom.stories.hidden = true;
    renderStoryRing();

    var back = state.story.opener;
    state.story.opener = null;
    if (back && document.contains(back) && typeof back.focus === 'function') back.focus();

    /* Same as closing a place: an introduction owed while the screen was
       somebody else's is made now the map is back. */
    if (introPending) introduceRail();
  }

  function wireStories() {
    dom.storyClose.addEventListener('click', closeStories);
    dom.storySound.addEventListener('click', function () { setStorySound(!state.story.muted); });

    dom.storyBack.addEventListener('click', function () { if (!swallowedTap()) stepStory(-1); });
    dom.storyFwd.addEventListener('click', function () { if (!swallowedTap()) stepStory(1); });

    dom.storyVideo.addEventListener('ended', function () {
      if (storyWatch) storyWatch.finished = true;
      stepStory(1);
    });
    /* A file that will not load is a file nobody can watch. Say so once and
       move on rather than sitting on a black rectangle. */
    dom.storyVideo.addEventListener('error', function () {
      if (dom.stories.hidden || dom.storyVideo.hidden) return;
      toast(t('storyFail'));
      stepStory(1);
    });
    dom.storyPhoto.addEventListener('error', function () {
      if (dom.stories.hidden || dom.storyPhoto.hidden) return;
      toast(t('storyFail'));
      stepStory(1);
    });

    /* On a desktop the story is a card with the map showing round it, and
       clicking the part of the screen that is not the card means the same
       thing it means everywhere else on this site. */
    dom.stories.addEventListener('click', function (ev) {
      if (ev.target === dom.stories) closeStories();
    });

    dom.storyCta.addEventListener('click', function (ev) {
      var story = state.story.list[state.story.index];
      if (!story) return;
      trackEvent('story_link', { story_id: story.id, spot: story.spot || '' });
      var place = story.spot ? byId(story.spot) : null;
      if (!place) return;                  /* an outbound link goes where it says */
      ev.preventDefault();
      closeStories();
      selectPlace(place.id, { fly: true });
    });

    /* Press, hold, drag. One set of handlers on the stage rather than on each
       half, because a drag that starts on one half and ends on the other is
       still the same gesture. */
    dom.storyStage.addEventListener('pointerdown', function (ev) {
      if (ev.button !== undefined && ev.button !== 0) return;
      var s = state.story;
      s.downX = ev.clientX;
      s.downY = ev.clientY;
      s.dragging = true;
      if (storyHoldTimer) window.clearTimeout(storyHoldTimer);
      storyHoldTimer = window.setTimeout(function () {
        storyHoldTimer = null;
        holdStory(true);
      }, STORY_HOLD_MS);
    });

    dom.storyStage.addEventListener('pointermove', function (ev) {
      var s = state.story;
      if (!s.dragging) return;
      /* A finger on the move is going somewhere, not holding still. */
      if (storyHoldTimer && Math.abs(ev.clientY - s.downY) > 10) {
        window.clearTimeout(storyHoldTimer);
        storyHoldTimer = null;
      }
    });

    dom.storyStage.addEventListener('pointerup', function (ev) {
      var s = state.story;
      if (storyHoldTimer) { window.clearTimeout(storyHoldTimer); storyHoldTimer = null; }
      if (!s.dragging) return;
      s.dragging = false;

      var down = ev.clientY - s.downY;
      var across = Math.abs(ev.clientX - s.downX);
      /* Down and mostly down: the gesture that closes a story everywhere. */
      if (down > STORY_SWIPE && across < down) {
        s.swallow = true;
        closeStories();
        return;
      }
      if (s.held) {
        /* The click that follows a hold is the end of the hold, not a tap on
           the half of the screen the finger happened to be over. */
        s.swallow = true;
        holdStory(false);
      }
    });

    dom.storyStage.addEventListener('pointercancel', function () {
      var s = state.story;
      if (storyHoldTimer) { window.clearTimeout(storyHoldTimer); storyHoldTimer = null; }
      s.dragging = false;
      if (s.held) { s.swallow = true; holdStory(false); }
    });

    /* Leaving the tab holds the story exactly where it stands, and coming
       back lets it go again — the same pause a finger does. Without this a
       photograph would spend its whole six seconds in a tab nobody was
       looking at, because the clock keeps running while the frames do not. */
    document.addEventListener('visibilitychange', function () {
      if (dom.stories.hidden) return;
      holdStory(!!document.hidden);
    });
  }

  function swallowedTap() {
    if (!state.story.swallow) return false;
    state.story.swallow = false;
    return true;
  }

  function keepFocusInStories(ev) {
    keepFocusIn(ev, [dom.storyClose, dom.storySound, dom.storyBack, dom.storyFwd, dom.storyCta]);
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
       and the landing view GA records for it says which filters it was.

       Every chip but one. The saved chip filters by what the account signed
       in here has saved, so ?type=saved sent to somebody else is a link to an empty
       map, and opened on your own laptop a link to a different one. It
       filters; it does not travel. Nothing has to strip it on the way back
       in — boot only accepts ids that are on the map — but a link nobody can
       use should not be built in the first place. */
    var shareable = state.active.filter(function (id) { return id !== SAVED_FILTER; });
    if (shareable.length) params.set('type', shareable.join(','));
    else params.delete('type');
    if (state.langPinned) params.set('lang', state.lang);
    else params.delete('lang');
    if (state.stylePinned) params.set('style', state.style);
    else params.delete('style');
    /* ?story= is a door, not a state: it opens the queue on the way in and is
       taken off the address bar there and then, so nothing anybody copies out
       of it later reopens a video that has since gone. */
    params.delete('story');

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
   * whether they play a reel, and which buttons on an open place get used —
   * directions, call, website, the deal, the photographs. None of that
   * changes the address bar on its own, and GA only ever sees a URL, so
   * without these events the whole of it was invisible. They show up under
   * Reports, Engagement, Events, and the parameters (place, filter_id,
   * language, style) need registering once as custom dimensions in Admin if
   * you want to break the numbers down by them.
   *
   * The full list, so it can be read without hunting through the file:
   *   directions, call_place, website, deal_open  — leaving for the place
   *   photo_open, reel_load                       — looking at the place
   *   story_open, story_view, story_watch, story_sound, story_link
   *                                               — the stories ring
   *   filter_select, filter_clear, filters_open, search  — narrowing down
   *   list_open, cluster_open, random_pick, locate       — the map controls
   *   radio_play, radio_stop, language_select, style_select
   *
   * To remove tracking completely: delete the gtag block in index.html and
   * these two functions. Every call below becomes a harmless no-op.
   */

  var lastTrackedPath = null;
  /* Which place the reel on screen belongs to. A language switch rebuilds
     the open panel and so builds the player again; that is not a second
     reel. Closing the panel clears it, so opening the same place later is. */
  var lastReelKey = null;

  function trackEvent(name, params) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', name, params || {});
  }

  /* Attaches a report to a link or button that is built inline, and hands
     the same node back so it can stay inside the array it was written in. */
  function trackClick(node, name, params) {
    if (node) node.addEventListener('click', function () { trackEvent(name, params); });
    return node;
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

    /* Pressing it answers the question the label was there to answer, and
       the sheet it opens wants the room. */
    dom.btnRandom.addEventListener('click', function () {
      closeHint('random');
      randomPick();
    });
    dom.btnRadio.addEventListener('click', toggleRadio);

    document.addEventListener('click', function (ev) {
      if (!dom.langSwitch.contains(ev.target)) closeLangMenu();
    });

    dom.panelClose.addEventListener('click', closePanel);
    dom.panelSave.addEventListener('click', pressSave);

    /* Same as Surprise me: pressing it answers the question the label was
       there to ask, and the sheet it opens wants the room. */
    dom.btnAccount.addEventListener('click', function () {
      closeHint('account');
      openAccount();
    });

    /* The scrim is the way out, the card is not: a press that lands on the
       card itself must not close the sheet somebody is typing into. */
    dom.accountScrim.addEventListener('click', function (ev) {
      if (ev.target === dom.accountScrim) closeAccount();
    });
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
      /* The stories cover everything, so while they are up they answer the
         keyboard first: the arrows walk the queue, space holds it the way a
         finger does, and Escape leaves. */
      if (!dom.stories.hidden) {
        if (ev.key === 'Escape') { closeStories(); return; }
        if (ev.key === 'ArrowLeft') { ev.preventDefault(); stepStory(-1); return; }
        if (ev.key === 'ArrowRight') { ev.preventDefault(); stepStory(1); return; }
        if (ev.key === ' ' || ev.key === 'Spacebar') {
          ev.preventDefault();
          holdStory(!state.story.held);
          return;
        }
        if (ev.key === 'Tab') keepFocusInStories(ev);
        return;
      }

      if (ev.key === 'Escape') {
        /* Ahead of the lightbox: the account sheet stands over everything, so
           it is the thing Escape means when it is open. */
        if (!dom.accountScrim.hidden) { closeAccount(); return; }
        if (!dom.lightbox.hidden) { closeLightbox(); return; }
        if (dom.langSwitch.classList.contains('is-open')) { closeLangMenu(); return; }
        if (isNarrow() && filterMenuOpen()) {
          closeFilterMenu();
          dom.btnFilters.focus();
          return;
        }
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

    dom.btnFilters.addEventListener('click', function () {
      var opening = !filterMenuOpen();
      if (opening) trackEvent('filters_open');
      setFilterMenu(opening);
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
      syncFilterMenuToWidth();
      updateFilterFades();
    });
  }

  /* Tab inside a full-screen dialog stays inside it. Shared by the lightbox
     and the stories, which are the two things on this site that cover the
     page: a Tab that walked out of either would be tabbing through a map
     nobody can see. */
  function keepFocusIn(ev, nodes) {
    var focusable = nodes.filter(function (n) { return n && !n.hidden; });
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    else if (focusable.indexOf(document.activeElement) === -1) { ev.preventDefault(); first.focus(); }
  }

  function keepFocusInLightbox(ev) {
    keepFocusIn(ev, [dom.lbClose, dom.lbPrev, dom.lbNext]);
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
        className: 'pin-here',
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
      /* priceRange takes a run of euro signs, and half a sign is not something
         it can express, so a half step rounds up to the nearer whole band. */
      if (place.price) node.priceRange = new Array(Math.round(place.price) + 1).join('\u20ac');
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
      btnFilters: $('btn-filters'),
      styles: $('styles'),
      rail: $('rail'),
      btnRandom: $('btn-random'),
      panel: $('panel'),
      panelScroll: $('panel-scroll'),
      panelClose: $('panel-close'),
      panelSave: $('panel-save'),
      panelSaveN: $('panel-save-n'),
      btnAccount: $('btn-account'),
      accountLabel: $('account-label'),
      accountScrim: $('account-scrim'),
      accountCard: $('account-card'),
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
      stories: $('stories'),
      storyStage: $('story-stage'),
      storyVideo: $('story-video'),
      storyPhoto: $('story-photo'),
      storyBars: $('story-bars'),
      storyLeft: $('story-left'),
      storyCaption: $('story-caption'),
      storyCta: $('story-cta'),
      storyCtaLabel: $('story-cta-label'),
      storySound: $('story-sound'),
      storyClose: $('story-close'),
      storyBack: $('story-back'),
      storyFwd: $('story-fwd'),
      storyRing: null,
      lightbox: $('lightbox'),
      lbImg: $('lb-img'),
      lbCaption: $('lb-caption'),
      lbClose: $('lb-close'),
      lbPrev: $('lb-prev'),
      lbNext: $('lb-next'),
      toast: $('toast')
    };

    dom.panel.setAttribute('inert', '');

    /* Flipped once the visitor has the thing they came for. See the note on
       the fatal card at the foot of this function. */
    var drawn = false;

    Promise.all([
      getJSON('data/restaurants.json'),
      getJSON('data/taxonomy.json'),
      getJSON('data/ui.json'),
      /* Optional in the same way the station is: no file, no deals, and the
         panel never grows the section. */
      getJSON('data/deals.json').catch(function () { return []; }),
      /* The station is optional in every sense: no file, no station, no
         button, and the rest of the map does not notice. */
      getJSON('data/radio.json').catch(function () { return null; }),
      /* And the stories the same: no file, no ring on the mark, no viewer. */
      getJSON('data/stories.json').catch(function () { return []; })
    ]).then(function (loaded) {
      state.places = loaded[0] || [];
      state.types = (loaded[1] && loaded[1].types) || [];
      state.deals = loaded[3] || [];
      state.radio = loaded[4] || null;
      state.stories = Array.isArray(loaded[5]) ? loaded[5] : [];
      state.ui = loaded[2] || {};
      state.langs = sortLanguages(Object.keys(state.ui));

      /* The cached list of the account's saves, and whether the bot check is
         switched on. Both are local and instant. The counts themselves are a
         request over the network and are not waited for — see loadSaves. */
      readSaved();
      readTurnstileKey();

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
      renderStoryRing();
      wireControls();
      wireStories();
      startStoryClock();
      wireReelMeasure();

      /* A ?type= link lands on a filtered map, and on a phone a shut row
         would be the one thing this design promises never to be. So the link
         opens it: the chips it arrived with are on screen, pressed, and one
         press from being let go of. On a desktop they already are. */
      syncFilterMenuToWidth();

      /* The map is drawn, the chips and the panel are filled in, and every
         button on the page is live. Everything below this line is bookkeeping
         the visitor never sees fail. */
      drawn = true;

      /* gtag already reported the landing URL, deep link and all. */
      lastTrackedPath = window.location.pathname + window.location.search;

      placeRail();

      /* The counts, from the one place on this site that is not a static
         file. Deliberately last and deliberately not waited for: the map is
         already drawn and usable by now, and a save count is the least
         important thing on the screen right up until somebody opens a place.
         If it never arrives, the marks show no number and still work. */
      loadSaves();
      /* And who is holding them. Same rules: last, unwaited, and the site is
         the site it always was if the answer never comes. */
      loadAccount();

      /* The JSON-LD block is for crawlers only — nobody reading the map ever
         sees it — so it must never be the reason a visitor gets the fatal
         card instead of the map. It sits alone in a try for that reason:
         everything above it has already rendered by this point. */
      try { injectStructuredData(); } catch (e) {
        if (window.console && console.error) console.error(e);
      }

      wireHistory();

      /* The bare map goes into the entry the visitor arrived on, whether or
         not they arrived on a place. So a link straight to a place still has
         somewhere to go Back to: the map, standing on that place. */
      var params = new URLSearchParams(window.location.search);
      var spot = params.get('spot');
      syncUrl();
      if (spot && byId(spot)) selectPlace(spot, { fly: true });

      /* ?story=<id> opens the queue standing on that one, which is the link
         to put in a post: it lands on the video while the video is still up,
         and on the plain map once it is not. syncUrl above has already taken
         the parameter back off the address bar. */
      var wanted = params.get('story');
      if (wanted) {
        var queue = liveStories();
        for (var q = 0; q < queue.length; q++) {
          if (queue[q].id === wanted) { openStories(q, null); break; }
        }
      }

      /* And on a phone, the rail says what it is for. Last, after the deep
         link has had its say: a link straight to a place opens the sheet, and
         the introduction is owed to the map behind it rather than spent on a
         screen the rail is only a row along the top of. */
      introduceRail();
    }).catch(function (err) {
      if (window.console && console.error) console.error(err);

      /* The card explains a page with nothing on it. Once the map has drawn,
         covering it with "something went wrong loading the data" says two
         untrue things — the data loaded fine, and refreshing will help. It
         will not: a refresh runs the same code against the same files and
         lands in the same place, which is exactly what happened to everyone
         whose browser was still holding the previous assets/app.js while
         serving them today's restaurants.json. So a failure this late keeps
         the map and goes to the console, where it belongs. */
      if (drawn) return;

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
