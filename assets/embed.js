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
 * Its pins are the map's own — the mouth on a place on the map, a list's
 * marker on a row the map does not have, assets/pins.js deciding which — and
 * past NAMES_ZOOM they carry their names where the names fit.
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

  /* The pins' sizes, PIN_BOX, PIN_D, PIN_D_WORDS and PIN_D_SELECTED in
     assets/app.js: the box Leaflet anchors, every pin, a place of mine with
     only words to it, and the open one. The stylesheet scales all four down
     on a narrow frame, as it does on the map. */
  var PIN_BOX = 46;
  var PIN_D = 22;
  var PIN_D_WORDS = 17;
  var PIN_D_OPEN = 34;

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
   * note, url, wears, depth }. A list's rows the map has are filled out of
   * /api/v1/places — the photo, the price and the kinds of place — and a row
   * somebody added off Google keeps what the list holds.
   *
   * `wears` is the pin, by pinOf()'s first two rules in assets/app.js: a
   * place on the map is the mark, and a list's row the map does not have
   * wears the marker the list's author chose. The third rule, a Google row
   * drawn as the kind of place it is, never arises: the public API hands out
   * no Google row but a list's. `depth` is pinDepth()'s three readings of
   * how much there is to see of a place of mine.
   */
  function langQuery() { return 'lang=' + encodeURIComponent(state.lang); }

  function depthOf(place) {
    if (place.reel) return 'reel';
    if (place.photo) return 'photos';
    return 'words';
  }

  function fromList(id) {
    return getJSON(API + '/lists/' + encodeURIComponent(id)).then(function (body) {
      var list = body.list;
      var rows = list.items.filter(function (r) { return typeof r.lat === 'number' && typeof r.lng === 'number'; });
      var ids = rows.filter(function (r) { return r.place_id; }).map(function (r) { return r.place_id; });
      var known = ids.length
        ? getJSON(API + '/places?limit=100&' + langQuery() + '&ids=' + ids.map(encodeURIComponent).join(','))
        : Promise.resolve({ places: [] });
      var listPin = TTBPins.ofList(list);
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
              url: r.url,
              wears: r.place_id ? 'mark' : listPin,
              depth: depthOf(p || r)
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
            price: p.price, types: p.types, photo: p.photo, note: '', url: p.url,
            wears: 'mark', depth: depthOf(p)
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

  /* The opening view is every pin, fitted exactly rather than to a whole
     zoom level: Leaflet's own snap rounded the fit down, which on the
     Azerbaijan corner's Azerbaijani places put twenty-five in the middle
     third of the frame at 10, where 10.9 fills it. zoomSnap 0 is what the map at /
     runs on too — **The map zooms by the pixel** — and the price is the same:
     between two levels the tiles are drawn scaled, a little soft.

     The fit keeps the pins out from under the chip, which stands on the
     map's top edge, and above the credit along its bottom one. */
  var FIT_PAD = 20;
  var CREDIT_H = 40;

  function makeMap() {
    if (state.map) return state.map;
    state.map = L.map('embed-map', { zoomControl: false, zoomSnap: 0 }).setView(TALLINN, 13);
    TTBBasemap.layer(L, { dark: state.dark }).addTo(state.map);
    state.map.on('click', closeCard);
    /* After a pan, at the end of a zoom, and once the opening fit is made:
       Leaflet ends all three with the same event. */
    state.map.on('moveend', paintNames);
    return state.map;
  }

  /* The box Leaflet anchors and the face inside it that takes the pointer —
     pinIcon() in assets/app.js, and dressed by dressPin() below the same
     way, so the stylesheet that draws the map's pins draws these. */
  function pinIcon() {
    return L.divIcon({
      className: 'pin-mark',
      html: '<span class="pin-face"></span>',
      iconSize: [PIN_BOX, PIN_BOX],
      iconAnchor: [PIN_BOX / 2, PIN_BOX / 2],
      tooltipAnchor: [0, 0]
    });
  }

  /* One pin, for what it is and whether it is open: dressPin() in
     assets/app.js, less what this map never has — no cluster, no place kept
     after its card was shut. The open one grows, takes the lit tone and
     stands on top. Under it, a place of mine stands above a list's marker,
     because nothing here clusters, and Telliskivi Šašlõkk under the
     Shaurma Kebab next door was a mouth nobody could see. */
  function dressPin(pin) {
    var node = pin.marker.getElement();
    if (!node) return;
    var place = pin.place;
    var on = place.id === state.on;
    var mine = place.wears === 'mark';
    TTBPins.dress(node, place.wears);
    ['reel', 'photos', 'words'].forEach(function (kind) {
      node.classList.toggle('is-' + kind, place.depth === kind);
    });
    node.classList.toggle('is-chosen', on);
    node.style.setProperty('--pin-d', (on ? PIN_D_OPEN : mine && place.depth === 'words' ? PIN_D_WORDS : PIN_D) + 'px');
    if (on) node.style.setProperty('--pin-tone', 'var(--accent-lit)');
    else node.style.removeProperty('--pin-tone');
    pin.marker.setZIndexOffset(on ? 2000 : mine ? 1000 : 0);
  }

  function draw(found, names) {
    var map = makeMap();
    state.pins.forEach(function (pin) { map.removeLayer(pin.marker); });
    state.pins = found.places.map(function (place) {
      var marker = L.marker([place.lat, place.lng], { icon: pinIcon(), title: place.name, keyboard: true });
      marker.on('click', function () { openCard(place, names); });
      marker.addTo(map);
      var face = marker.getElement().querySelector('.pin-face');
      face.textContent = place.wears === 'mark' ? '' : TTBPins.glyph(place.wears);
      var pin = { place: place, marker: marker, named: '' };
      dressPin(pin);
      return pin;
    });
    /* The chip first: the fit measures it. */
    $('embed-title').textContent = found.title;
    $('embed-sub').textContent = found.sub;
    var chip = $('embed-chip');
    chip.hidden = false;
    if (state.pins.length) {
      map.fitBounds(L.latLngBounds(state.pins.map(function (p) { return [p.place.lat, p.place.lng]; })), {
        paddingTopLeft: [FIT_PAD, chip.offsetTop + chip.offsetHeight + FIT_PAD],
        paddingBottomRight: [FIT_PAD, CREDIT_H],
        maxZoom: 16,
        animate: false
      });
    }
  }

  function paintPins() {
    state.pins.forEach(dressPin);
    paintNames();
  }

  /* ------------------------------------------------------------ the names
   * Closer in, a pin carries its name, where the name fits: labelPlan() in
   * assets/app.js, which has named the map's pins this way since zoom 14.
   * Here it is 13, a level sooner, because a list is a hundred places at
   * the very most and the map is twelve hundred.
   *
   * Laid out greedily, the open place first and always named whatever it
   * lands on, since it is the one being asked about. Every other name has to
   * fit whole inside the frame and land on no pin, no name already placed,
   * and neither the chip nor the card; one that would is left off until a
   * zoom or a pan gives it room. The width is guessed from the length of the
   * name, as the map guesses it, because measuring means drawing it first.
   */
  var NAMES_ZOOM = 13;
  var NAME_H = 24;

  /* Padding and the display face at 13px, as labelBox() in assets/app.js
     has it. */
  function nameWidth(name) {
    return 20 + name.length * 7.3;
  }

  function hits(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  /* A box the names keep off: the chip along the top, the card along the
     bottom, either only while it is showing. */
  function standing(id, size) {
    var node = $(id);
    if (node.hidden) return null;
    return { x: 0, y: node.offsetTop - 4, w: size.x, h: node.offsetHeight + 8 };
  }

  function paintNames() {
    var map = state.map;
    if (!map) return;
    var size = map.getSize();
    var close = map.getZoom() >= NAMES_ZOOM;
    var taken = [standing('embed-chip', size), standing('embed-card', size)].filter(Boolean);
    var spots = {};
    state.pins.forEach(function (pin) {
      var pt = map.latLngToContainerPoint([pin.place.lat, pin.place.lng]);
      var r = (pin.place.id === state.on ? PIN_D_OPEN : PIN_D) / 2 + 2;
      spots[pin.place.id] = pt;
      taken.push({ x: pt.x - r, y: pt.y - r, w: r * 2, h: r * 2 });
    });

    var queue = state.pins.slice().sort(function (a, b) {
      return (b.place.id === state.on) - (a.place.id === state.on);
    });
    var named = {};
    queue.forEach(function (pin) {
      var on = pin.place.id === state.on;
      if (!on && !close) return;
      var pt = spots[pin.place.id];
      var w = nameWidth(pin.place.name);
      var box = { x: pt.x - w / 2, y: pt.y - 19 - NAME_H, w: w, h: NAME_H };
      if (!on) {
        if (box.x < 4 || box.x + box.w > size.x - 4 || box.y < 4 || box.y + box.h > size.y) return;
        for (var i = 0; i < taken.length; i++) if (hits(box, taken[i])) return;
      }
      taken.push(box);
      named[pin.place.id] = on ? 'on' : 'quiet';
    });

    /* Bound again only where it changed. The name goes in as a text node: a
       row off Google carries whatever the business called itself there, and
       Leaflet writes a string with innerHTML. */
    state.pins.forEach(function (pin) {
      var now = named[pin.place.id] || '';
      if (now === pin.named) return;
      pin.named = now;
      pin.marker.unbindTooltip();
      if (!now) return;
      pin.marker.bindTooltip(document.createTextNode(pin.place.name), {
        className: 'pin-tip pin-tip-' + now,
        direction: 'top',
        offset: [0, now === 'on' ? -23 : -18],
        opacity: 1,
        interactive: true,
        permanent: true
      });
    });
  }

  /* -------------------------------------------------------------- the card */

  function withLang(url) {
    if (url.indexOf(window.location.origin) !== 0 && url.indexOf('https://tallinntastebuds.ee/') !== 0) return url;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + langQuery();
  }

  function openCard(place, names) {
    state.on = place.id;
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
    /* After the card is showing, so its name is laid out clear of it. */
    paintPins();
    keepInView(place);
  }

  /* The open pin, panned out from under its own card into the strip between
     the chip and the card, with room above it and either side of it for its
     name — or left where it is when there is no strip: on a phone a card
     with a photograph fills the frame, and moving the map under it would
     show nothing. */
  function keepInView(place) {
    var map = state.map;
    var size = map.getSize();
    var chip = $('embed-chip');
    var top = chip.offsetTop + chip.offsetHeight + NAME_H + PIN_D_OPEN;
    var bottom = $('embed-card').offsetTop - PIN_D_OPEN / 2 - 8;
    if (bottom <= top) return;
    var pt = map.latLngToContainerPoint([place.lat, place.lng]);
    var dy = pt.y < top ? pt.y - top : pt.y > bottom ? pt.y - bottom : 0;
    var side = Math.min(size.x / 2, Math.max(FIT_PAD, nameWidth(place.name) / 2 + 4));
    var dx = pt.x < side ? pt.x - side : pt.x > size.x - side ? pt.x - size.x + side : 0;
    if (dx || dy) map.panBy([dx, dy]);
  }

  function closeCard() {
    state.on = null;
    $('embed-card').hidden = true;
    paintPins();
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
