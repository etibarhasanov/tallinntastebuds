/* Tallinn Tastebuds — embed.html, the map on somebody else's page.
 *
 * What a host page puts in its <iframe>:
 *
 *   /embed?list=<id>       one public list's places, in its author's words
 *   /embed?type=<type id>  every open place of that kind on the map
 *   /embed?ids=a,b,c       just those places
 *   /embed                 every open place on the map
 *   and on any of them    &lang=<code> and &style=red|green|blue|plum
 *
 * It reads the public API and nothing else — /api/v1/lists/<id>,
 * /api/v1/places and /api/v1/types — so it is the API's first user, and the
 * proof that what /developers promises is enough to build a map with. No
 * cookie is read, nothing is saved or counted, and every link opens the site
 * in a new tab rather than inside the host's frame. **The map on your site**
 * in docs/handbook.md.
 *
 * Plain browser JavaScript, one IIFE, ES5, like every file in assets/.
 */
(function () {
  'use strict';

  var API = '/api/v1';
  var LANGS_URL = '/data/lang/index.json';
  var LANG_URL = '/data/lang/';

  /* The four styles and which of them draws the dark tiles — STYLES in
     assets/app.js. */
  var STYLES = { red: false, green: true, blue: false, plum: true };
  var DEFAULT_STYLE = 'red';
  var DEFAULT_LANG = 'en';
  var STYLE_KEY = 'ttb.style';
  var LANG_KEY = 'ttb.lang';

  /* The middle of Tallinn, for a map with nothing on it yet — TALLINN in
     functions/api/_lib.js. */
  var TALLINN = [59.437, 24.7536];

  var params = new URLSearchParams(window.location.search);
  var state = { lang: DEFAULT_LANG, ui: {}, dark: false, map: null, pins: [], on: null };

  function $(id) { return document.getElementById(id); }

  function storeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function t(key, fill) {
    var s = state.ui[key];
    if (s === undefined) return '';
    if (fill) {
      for (var k in fill) {
        if (Object.prototype.hasOwnProperty.call(fill, k)) s = s.split('{' + k + '}').join(fill[k]);
      }
    }
    return s;
  }

  function getJSON(url) {
    return fetch(url, { headers: { accept: 'application/json' } }).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok) {
          var e = new Error(url + ': ' + res.status);
          e.status = res.status;
          e.body = body;
          throw e;
        }
        return body;
      });
    });
  }

  /* --------------------------------------------------------- style, words */

  /* ?style=, else the one this browser chose on the map, else red — the same
     order as applyStyle() in assets/lists.js. A frame on another site can
     usually not read this site's storage, so ?style= is what a host page
     sets. */
  function applyStyle() {
    var fromUrl = params.get('style');
    var stored = storeGet(STYLE_KEY);
    var style = STYLES.hasOwnProperty(fromUrl) ? fromUrl
              : STYLES.hasOwnProperty(stored) ? stored
              : DEFAULT_STYLE;
    document.documentElement.setAttribute('data-style', style);
    state.dark = STYLES[style];
    if (state.dark) document.documentElement.style.colorScheme = 'dark';
  }

  function pickLanguage(langs) {
    var fromUrl = params.get('lang');
    if (fromUrl && langs.indexOf(fromUrl) !== -1) return fromUrl;
    var stored = storeGet(LANG_KEY);
    if (stored && langs.indexOf(stored) !== -1) return stored;
    var prefs = navigator.languages || [navigator.language || ''];
    for (var i = 0; i < prefs.length; i++) {
      var base = String(prefs[i]).toLowerCase().split('-')[0];
      if (langs.indexOf(base) !== -1) return base;
    }
    return langs.indexOf(DEFAULT_LANG) !== -1 ? DEFAULT_LANG : langs[0];
  }

  function applyStaticStrings() {
    document.documentElement.lang = state.lang;
    var each = function (attr, apply) {
      var nodes = document.querySelectorAll('[' + attr + ']');
      for (var i = 0; i < nodes.length; i++) {
        var said = t(nodes[i].getAttribute(attr));
        if (said) apply(nodes[i], said);
      }
    };
    each('data-i18n', function (n, s) { n.textContent = s; });
    each('data-i18n-aria-label', function (n, s) { n.setAttribute('aria-label', s); });
  }

  /* The words, or English as the markup has it when they cannot be read:
     the map still draws either way. */
  function loadWords() {
    return getJSON(LANGS_URL).then(function (index) {
      state.lang = pickLanguage(Object.keys(index));
      return getJSON(LANG_URL + state.lang + '.json');
    }).then(function (words) {
      state.ui = words.ui || words;
      applyStaticStrings();
    }, function () { /* the English in the markup stands */ });
  }

  /* ------------------------------------------------------------ notices */

  function show(id) {
    ['embed-loading', 'embed-error', 'embed-empty'].forEach(function (n) {
      $(n).hidden = n !== id;
    });
  }

  /* -------------------------------------------------------------- data
   * Whatever the address asks for, as one shape: a title, a line under it,
   * and the places, each { id, name, address, lat, lng, price, types, photo,
   * note, url }. A list's rows the map has are filled out of /api/v1/places
   * — the photo, the price and the kinds of place — and a row somebody added
   * off Google keeps what the list holds.
   */
  function langQuery() { return 'lang=' + encodeURIComponent(state.lang); }

  function fromList(id) {
    return getJSON(API + '/lists/' + encodeURIComponent(id)).then(function (body) {
      var list = body.list;
      var rows = list.items.filter(function (r) { return typeof r.lat === 'number' && typeof r.lng === 'number'; });
      var ids = rows.filter(function (r) { return r.place_id; }).map(function (r) { return r.place_id; });
      var known = ids.length
        ? getJSON(API + '/places?limit=100&' + langQuery() + '&ids=' + ids.map(encodeURIComponent).join(','))
        : Promise.resolve({ places: [] });
      return known.then(function (found) {
        var byId = {};
        found.places.forEach(function (p) { byId[p.id] = p; });
        return {
          title: list.title,
          sub: t('embedListSub', { n: rows.length }),
          places: rows.map(function (r) {
            var p = r.place_id && byId[r.place_id];
            return {
              id: r.place_id || 'row-' + r.position,
              name: r.name,
              address: r.address || (p && p.address) || '',
              lat: r.lat,
              lng: r.lng,
              price: p ? p.price : null,
              types: p ? p.types : [],
              photo: p ? p.photo : null,
              note: r.note || '',
              url: r.url
            };
          })
        };
      });
    });
  }

  function fromPlaces(query, title) {
    return getJSON(API + '/places?limit=100&' + langQuery() + query).then(function (body) {
      return {
        title: title,
        sub: t('embedPlacesSub', { n: body.places.length }),
        places: body.places.map(function (p) {
          return {
            id: p.id, name: p.name, address: p.address, lat: p.lat, lng: p.lng,
            price: p.price, types: p.types, photo: p.photo, note: '', url: p.url
          };
        })
      };
    });
  }

  function load(names) {
    var list = params.get('list');
    var type = params.get('type');
    var ids = params.get('ids');
    if (list) return fromList(list);
    if (type) return fromPlaces('&type=' + encodeURIComponent(type), names[type] || type);
    if (ids) return fromPlaces('&ids=' + encodeURIComponent(ids), t('embedAllTitle'));
    return fromPlaces('', t('embedAllTitle'));
  }

  /* The kinds of place, by id, in the reader's language — for the chip's
     title on ?type= and the tags on the card. */
  function loadTypes() {
    return getJSON(API + '/types').then(function (body) {
      var names = {};
      body.types.forEach(function (ty) { names[ty.id] = ty.names[state.lang] || ty.names[DEFAULT_LANG] || ty.id; });
      return names;
    }, function () { return {}; });
  }

  /* -------------------------------------------------------------- the map */

  function makeMap() {
    if (state.map) return state.map;
    state.map = L.map('embed-map', { zoomControl: false }).setView(TALLINN, 13);
    TTBBasemap.layer(L, { dark: state.dark }).addTo(state.map);
    state.map.on('click', closeCard);
    return state.map;
  }

  function pinIcon(on) {
    var size = on ? 28 : 22;
    return L.divIcon({
      className: '',
      html: '<div class="embed-pin' + (on ? ' is-on' : '') + '"></div>',
      iconSize: [size, size],
      iconAnchor: [size / 2, size]
    });
  }

  function draw(found, names) {
    var map = makeMap();
    state.pins.forEach(function (pin) { map.removeLayer(pin.marker); });
    state.pins = found.places.map(function (place) {
      var marker = L.marker([place.lat, place.lng], { icon: pinIcon(false), title: place.name, keyboard: true });
      marker.on('click', function () { openCard(place, names); });
      /* keyboard: true makes the pin focusable and calls it a button, and
         that is all it does: in Leaflet 1.9.4 the only thing that answers a
         key on a marker is bindPopup()'s Enter, and a div with a tabindex
         raises no click of its own. So the keys a button answers are heard
         here, Enter and Space, as addPin() in assets/app.js hears them on
         the map's own pins. */
      marker.on('keydown', function (ev) {
        var key = ev.originalEvent.key;
        if (key !== 'Enter' && key !== ' ' && key !== 'Spacebar') return;
        ev.originalEvent.preventDefault();
        openCard(place, names);
      });
      marker.addTo(map);
      return { place: place, marker: marker };
    });
    if (state.pins.length) {
      map.fitBounds(L.latLngBounds(state.pins.map(function (p) { return [p.place.lat, p.place.lng]; })), {
        padding: [40, 40], maxZoom: 16
      });
    }
    $('embed-title').textContent = found.title;
    $('embed-sub').textContent = found.sub;
    $('embed-chip').hidden = false;
  }

  function mark(id) {
    state.pins.forEach(function (pin) { pin.marker.setIcon(pinIcon(pin.place.id === id)); });
  }

  /* -------------------------------------------------------------- the card */

  function withLang(url) {
    if (url.indexOf(window.location.origin) !== 0 && url.indexOf('https://tallinntastebuds.ee/') !== 0) return url;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + langQuery();
  }

  function openCard(place, names) {
    state.on = place.id;
    mark(place.id);
    var photo = $('embed-photo');
    photo.hidden = !place.photo;
    if (place.photo) photo.src = place.photo;
    else photo.removeAttribute('src');
    $('embed-name').textContent = place.name;
    var price = place.price ? new Array(place.price + 1).join('€') : '';
    $('embed-meta').textContent = [place.address, price].filter(Boolean).join(' · ');
    $('embed-note').hidden = !place.note;
    $('embed-note').textContent = place.note;
    var tags = $('embed-tags');
    while (tags.firstChild) tags.removeChild(tags.firstChild);
    (place.types || []).forEach(function (id) {
      var li = document.createElement('li');
      li.textContent = names[id] || id;
      tags.appendChild(li);
    });
    tags.hidden = !tags.firstChild;
    $('embed-open').href = withLang(place.url);
    $('embed-card').hidden = false;
    /* Into the card, as selectPlace() in assets/app.js moves it into the
       panel: otherwise its one link is behind every pin still to come in the
       tab order. Never scrolling, here or in closeCard(): the frame's page is
       somebody else's to scroll, and a pin out of view would drag the map's
       container off its tiles. */
    $('embed-name').focus({ preventScroll: true });
  }

  /* Focus inside the card is about to be hidden with it, so it goes back to
     the card's pin rather than falling to the page; anywhere else — the map,
     another pin — it stays where it is. */
  function closeCard() {
    var was = state.on;
    var card = $('embed-card');
    state.on = null;
    mark(null);
    if (card.contains(document.activeElement)) {
      state.pins.forEach(function (pin) {
        if (pin.place.id === was) pin.marker.getElement().focus({ preventScroll: true });
      });
    }
    card.hidden = true;
  }

  /* -------------------------------------------------------------- the boot */

  function start() {
    show('embed-loading');
    loadTypes().then(function (names) {
      return load(names).then(function (found) {
        if (!found.places.length) {
          makeMap();
          show('embed-empty');
          return;
        }
        show(null);
        draw(found, names);
      });
    }).catch(function (e) {
      /* A list that is missing or private is nothing to show, not a fault;
         anything else is the API out of reach. */
      if (e && e.status === 404) { makeMap(); show('embed-empty'); }
      else show('embed-error');
    });
  }

  function boot() {
    applyStyle();
    $('embed-by').href = withLang('https://tallinntastebuds.ee/');
    $('embed-retry').addEventListener('click', start);
    $('embed-close').addEventListener('click', closeCard);
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && state.on) closeCard();
    });
    loadWords().then(start);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
