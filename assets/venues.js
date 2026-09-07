/* Tallinn Tastebuds — the Google Places directory.
 *
 * /google, and nothing else on this site links to it. The map is
 * seventy-five places I have been to and it is the whole point of Tallinn
 * Tastebuds; this is the other eleven hundred, out of Google's export, with
 * Google's ratings and Google's opening hours on them. Being on this page is
 * not a recommendation and the page says so in its first paragraph, which is
 * the entire reason it is kept apart from the map rather than folded into it.
 *
 * WHAT IT DOES
 *
 * One request to /api/venues, which answers with the whole roll and five
 * minutes of cache on it, and everything after that happens in the browser: a
 * search, four narrowing controls, four orders, and a map beside the list with
 * a dot for every match. See functions/api/venues.js for why the filtering is
 * this side and not in a WHERE clause — briefly, the map needs every matching
 * pin whatever the filter says, and "open now" is a question about a week of
 * opening hours rather than something SQL can answer.
 *
 * Plain browser JavaScript, no modules, no build step, same as every other
 * file in assets/. It shares the tokens, the card, the eyebrow, the search
 * field, the price gauge and the toast with assets/styles.css and adds only
 * what a directory has in assets/venues.css.
 *
 * NOTHING HERE IS ENGLISH BY ACCIDENT
 *
 * Google files these places in English — "Sushi Restaurant", "Mon 11:00-22:00"
 * — and none of that reaches the page. The endpoint turns the category into
 * cuisine ids that data/cuisines.json and data/taxonomy.json say in ten
 * languages, and the week into seven days with the day names taken off, so
 * what arrives is "11:00-22:00" and an index. The three things left as Google
 * wrote them are the times, which are digits and a hyphen, and the name of the
 * restaurant and its street, which is what you would say to a taxi driver.
 */
(function () {
  'use strict';

  var DEFAULT_LANG = 'en';
  var LANG_KEY = 'ttb.lang';

  /* The two styles the site has, the key they are stored under and the one it
     opens on — the same names and the same default as assets/app.js, which is
     where they are actually chosen. There is no swatch on this page. */
  var STYLES = ['red', 'green'];
  var DEFAULT_STYLE = 'red';
  var STYLE_KEY = 'ttb.style';

  var API = '/api/venues';

  /* How many cards are built at once. Seven hundred articles is a second of
     layout on a phone and a scrollbar nobody can aim with, so the list grows a
     screenful at a time — and the map is what shows the whole match anyway. */
  var PAGE = 24;

  /* Monday first, which is how the endpoint numbers the week and how this city
     counts one. Used only to read the browser's own idea of the weekday. */
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  /* One "HH:MM-HH:MM" out of a day of Google's week. See spansOf(). */
  var SPAN = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/;

  /* The ratings worth offering. Four fifths of the export is 4.0 or better and
     more than half is 4.5 or better, so anything under 3.5 would be a filter
     that never removes anything. */
  var RATINGS = [4.5, 4.0, 3.5];

  /* Google's "$" to "$$$$" as the map's band of four, which is what the
     endpoint converts them to. There is no half step here: the map's own gauge
     can draw one because a hand-written band lands on 2.5, and Google's never
     does. */
  var PRICES = [1, 2, 3, 4];

  var SORTS = ['rating', 'reviews', 'name', 'near'];

  /* Where the map opens before anything has been drawn on it: the middle of
     Tallinn, wide enough to hold the whole export. Same point functions/api/
     _lib.js calls the city. */
  var CENTRE = [59.437, 24.7536];
  var ZOOM = 12;

  var state = {
    ui: {},
    lang: DEFAULT_LANG,
    /* id -> the label object for one cuisine, in every language. Two files
       feed it and they are deliberately disjoint: data/taxonomy.json already
       says asian, vegan, bakery, coffee, pub and fine-dining for the map's own
       chips, and data/cuisines.json carries the thirty-seven the export needs
       on top of those. Copying the six into the second file would be six
       translations to keep in step with another six. */
    labels: {},
    all: [],        // every venue the endpoint answered with
    shown: [],      // the ones matching the filters, in the chosen order
    pages: 1,       // how many screenfuls of cards are built
    here: null,     // { lat, lng } once somebody has agreed to be located
    selected: '',   // the venue whose card and dot are lit

    q: '',
    open: false,
    cuisine: '',
    rating: 0,
    price: 0,
    sort: 'rating'
  };

  var dom = {};
  /* Built once the language is known and read by everything that puts words in
     order — the cuisine picker and the A-Z sort. Estonian files õ after w, and
     a page that sorted its own filter list the browser's way would be the one
     thing on it not in the reader's alphabet. */
  var collator = null;
  var map = null;
  var dots = null;        // the layer holding one circle per match
  var byPlace = {};       // place id -> its circle, for lighting one up
  var toastTimer = null;
  var searchTimer = null;

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

  function storeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

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

  /* One cuisine in the reading language. Never the id: a chip reading
     "middle-eastern" at somebody is the failure this whole arrangement exists
     to avoid, so an id with no label is dropped by the callers instead. */
  function label(id) {
    var row = state.labels[id];
    if (!row) return '';
    return row[state.lang] || row[DEFAULT_LANG] || '';
  }

  function toast(message) {
    dom.toast.textContent = message;
    dom.toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { dom.toast.hidden = true; }, 3800);
  }

  function getJSON(url) {
    return fetch(url, { headers: { accept: 'application/json' } }).then(function (res) {
      if (!res.ok) throw new Error(url + ': ' + res.status);
      return res.json();
    });
  }

  /* Same folding as the map's search and the lists picker's, for the same
     reason: nobody types Põhjala with the tilde or Šašlõkk with the caron. */
  function fold(value) {
    var out = String(value == null ? '' : value).toLowerCase();
    try { out = out.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { /* older engine */ }
    return out.replace(/[\u0131\u0130]/g, 'i').replace(/\u00f8/g, 'o').replace(/\u00df/g, 'ss');
  }

  function number(n) {
    try { return Number(n).toLocaleString(state.lang); } catch (e) { return String(n); }
  }

  /* One decimal, always, so a column of ratings lines up and 4 does not sit
     next to 4.6 looking like a different kind of number. */
  function score(n) {
    try {
      return Number(n).toLocaleString(state.lang, {
        minimumFractionDigits: 1, maximumFractionDigits: 1
      });
    } catch (e) { return String(n); }
  }

  /* ------------------------------------------------------- look and feel */

  /* The style the site is wearing. The map has the swatches and writes the
     choice to localStorage; this page reads it, exactly as the lists and pass
     pages do — walking from the map to the directory should not feel like
     leaving. Everything drawn here is built out of the tokens both styles
     restate, so this one attribute is the whole of it. */
  function applyStyle() {
    var fromUrl = new URLSearchParams(window.location.search).get('style');
    var stored = storeGet(STYLE_KEY);
    var style = STYLES.indexOf(fromUrl) !== -1 ? fromUrl
              : STYLES.indexOf(stored) !== -1 ? stored
              : DEFAULT_STYLE;

    document.documentElement.setAttribute('data-style', style);
    document.documentElement.style.colorScheme = style === 'green' ? 'dark' : 'light';

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      var wash = getComputedStyle(document.documentElement).getPropertyValue('--wash').trim();
      if (wash) meta.setAttribute('content', wash);
    }
  }

  function pickLanguage(langs) {
    var fromUrl = new URLSearchParams(window.location.search).get('lang');
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
      for (var i = 0; i < nodes.length; i++) apply(nodes[i], nodes[i].getAttribute(attr));
    };
    each('data-i18n', function (n, k) { n.textContent = t(k); });
    each('data-i18n-aria-label', function (n, k) { n.setAttribute('aria-label', t(k)); });
    each('data-i18n-placeholder', function (n, k) { n.setAttribute('placeholder', t(k)); });
  }

  /* ------------------------------------------------------------- the clock
   * "Open now" is asked of Tallinn's clock and not the reader's. Somebody
   * looking this up from Lisbon at nine in the evening is asking what is open
   * in Tallinn, where it is eleven, and answering in their own timezone would
   * be wrong in the one way they could not spot.
   *
   * Same reading assets/app.js takes for story windows: Intl knows the offset
   * in force today, whatever the reader's own machine is set to.
   *
   * The fallback, for a browser built without tzdata, is that reader's own
   * clock — not Estonia's rule written out a second time. The two disagree by
   * an hour or two for somebody abroad, and they do not disagree at all for
   * anybody standing in the city this page is a directory of, which is who is
   * asking what is open now.
   */
  function tallinnClock() {
    var now = new Date();
    try {
      var parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Tallinn', hour12: false,
        weekday: 'short', hour: '2-digit', minute: '2-digit'
      }).formatToParts(now);
      var f = {};
      for (var i = 0; i < parts.length; i++) f[parts[i].type] = parts[i].value;
      var day = DAYS.indexOf(f.weekday);
      if (day !== -1) {
        return { day: day, minute: (Number(f.hour) % 24) * 60 + Number(f.minute) };
      }
    } catch (e) { /* no tzdata in this browser's build */ }

    /* getDay() counts from Sunday and the endpoint's weeks start on Monday. */
    return {
      day: (now.getDay() + 6) % 7,
      minute: now.getHours() * 60 + now.getMinutes()
    };
  }

  function clockOf(minutes) {
    var h = Math.floor(minutes / 60) % 24;
    var m = minutes % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  /* One day of Google's week as minutes past midnight.
   *
   * The endpoint sends the times exactly as Google wrote them — "11:00-22:00",
   * or "12:00-15:00, 17:00-22:00" where a kitchen shuts in the afternoon —
   * because that is what the map's own card for one of these places prints,
   * and one parser of that column is enough for the whole site. Turning a day
   * into numbers is what "open now" needs and it is four lines, so it happens
   * here rather than being a second shape sent down the wire.
   *
   * A pair whose close is earlier than its open runs past midnight: "14:00-
   * 04:00" comes back as [840, 240], and 683 of the week-days in the export
   * do that, most of them by closing at 00:00.
   */
  function spansOf(day) {
    var out = [];
    if (!day) return out;
    var chunks = String(day).split(',');
    for (var i = 0; i < chunks.length; i++) {
      var at = SPAN.exec(chunks[i]);
      if (at) out.push([Number(at[1]) * 60 + Number(at[2]), Number(at[3]) * 60 + Number(at[4])]);
    }
    return out;
  }

  /* Where a place stands right now, or null when Google gave no hours at all —
   * seventy-seven of them did not, and "we do not know" is a different sentence
   * from "shut", so the two are kept apart all the way to the card. An empty
   * week is how the endpoint says the first; a null day inside one is how it
   * says the place does not open that day.
   *
   * `at` is the minute that matters: when it is open, the one it shuts; when
   * it is shut, the next one it opens today, or null if that is tomorrow.
   */
  function opening(venue, clock) {
    if (!venue.hours) return null;

    var today = spansOf(venue.hours[clock.day]);
    var i;
    for (i = 0; i < today.length; i++) {
      var from = today[i][0], to = today[i][1];
      if (to > from ? (clock.minute >= from && clock.minute < to) : (to < from && clock.minute >= from)) {
        return { open: true, at: to };
      }
    }

    /* The other half of the same case: at two in the morning the place that is
       open is the one that opened yesterday evening. */
    var last = spansOf(venue.hours[(clock.day + 6) % 7]);
    for (i = 0; i < last.length; i++) {
      if (last[i][1] < last[i][0] && clock.minute < last[i][1]) {
        return { open: true, at: last[i][1] };
      }
    }

    var next = null;
    for (i = 0; i < today.length; i++) {
      if (today[i][0] > clock.minute && (next === null || today[i][0] < next)) next = today[i][0];
    }
    return { open: false, at: next };
  }

  function openingLine(venue, clock) {
    var now = opening(venue, clock);
    if (!now) return { text: t('venuesHoursUnknown'), open: false, known: false };
    if (now.open) return { text: t('venuesOpenUntil', { time: clockOf(now.at) }), open: true, known: true };
    if (now.at !== null) return { text: t('venuesOpensAt', { time: clockOf(now.at) }), open: false, known: true };
    return { text: t('venuesShutToday'), open: false, known: true };
  }

  /* ----------------------------------------------------------- distance
   * Straight-line, in metres. Nothing here needs a route: it is used to sort
   * the list and to say "400 m" under a name, and both of those are answers
   * about which end of town a place is in.
   */
  function metresBetween(a, b) {
    var R = 6371000;
    var toRad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toRad;
    var dLng = (b.lng - a.lng) * toRad;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }

  function distanceLine(metres) {
    if (metres < 950) return t('venuesM', { n: number(Math.round(metres / 10) * 10) });
    return t('venuesKm', { n: score(metres / 1000) });
  }

  /* ------------------------------------------------------------- the URL
   * What the page is showing, in the address bar, so a filtered directory can
   * be sent to somebody. Same idea as the map's ?type= and ?spot=, and the
   * same rule: only what somebody else could use. Which card is open is not in
   * here — it is a place on a list, not a page of its own.
   */
  function readUrl() {
    var p = new URLSearchParams(window.location.search);
    state.q = p.get('q') || '';
    state.open = p.get('open') === '1';
    state.cuisine = p.get('cuisine') || '';
    /* Both checked against the list of what the control can actually hold
       rather than against a range: a ?price=2.5 that passed a range test would
       match no venue and leave the select showing something it is not. */
    var rating = Number(p.get('rating'));
    state.rating = RATINGS.indexOf(rating) !== -1 ? rating : 0;
    var price = Number(p.get('price'));
    state.price = PRICES.indexOf(price) !== -1 ? price : 0;
    var sort = p.get('sort');
    /* Not 'near': it means "nearest to where I am standing", which is nowhere
       for whoever the link was sent to. */
    state.sort = SORTS.indexOf(sort) !== -1 && sort !== 'near' ? sort : 'rating';
  }

  function writeUrl() {
    var p = new URLSearchParams(window.location.search);
    var set = function (key, value) {
      if (value) p.set(key, String(value));
      else p.delete(key);
    };
    set('q', state.q);
    set('open', state.open ? '1' : '');
    set('cuisine', state.cuisine);
    set('rating', state.rating || '');
    set('price', state.price || '');
    set('sort', state.sort === 'rating' || state.sort === 'near' ? '' : state.sort);

    var query = p.toString();
    try {
      window.history.replaceState(
        null, '', window.location.pathname + (query ? '?' + query : '')
      );
    } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------ narrowing */

  function haystack(venue) {
    if (venue.hay === undefined) {
      var words = [venue.name, venue.address || ''];
      /* The cuisines in the reading language too, so searching "jaapani"
         finds the sushi places an Estonian reader would never have typed
         "japanese" to reach. Kept on the row once built: there is no language
         switch on this page — boot picks one and nothing changes it — so this
         can never go stale under a reader. */
      for (var i = 0; i < venue.kitchens.length; i++) words.push(label(venue.kitchens[i]));
      venue.hay = fold(words.join(' '));
    }
    return venue.hay;
  }

  function matches(venue, needle, clock) {
    if (state.cuisine && venue.kitchens.indexOf(state.cuisine) === -1) return false;
    if (state.rating && !(venue.rating >= state.rating)) return false;
    if (state.price && venue.price !== state.price) return false;
    if (state.open) {
      /* A place Google says is temporarily closed is not open now whatever its
         week says, and one with no hours at all is not something to promise. */
      if (venue.closed) return false;
      var now = opening(venue, clock);
      if (!now || !now.open) return false;
    }
    if (needle && haystack(venue).indexOf(needle) === -1) return false;
    return true;
  }

  /* The four orders the page offers, by the name the control uses. state.sort
     can only ever hold one of them: readUrl() checks what arrives in the
     address bar and the select holds nothing else. */
  var ORDERS = {
    /* Reviews break the tie, because a lone five-star rating and four hundred
       of them are not the same claim. */
    rating: function (a, b) { return (b.rating || 0) - (a.rating || 0) || (b.reviews || 0) - (a.reviews || 0); },
    reviews: function (a, b) { return (b.reviews || 0) - (a.reviews || 0); },
    name: function (a, b) {
      if (collator) return collator.compare(a.name, b.name);
      var x = fold(a.name), y = fold(b.name);
      return x < y ? -1 : x > y ? 1 : 0;
    },
    /* A place with no pin cannot be near anything, so it goes last rather
       than to the top on a comparison against null. */
    near: function (a, b) {
      return (a.away == null ? Infinity : a.away) - (b.away == null ? Infinity : b.away);
    }
  };

  function order(list) {
    var by = ORDERS[state.sort];
    /* Whatever the order, somewhere shut for good goes to the bottom of it. It
       stays in the list because a directory that quietly dropped sixty-six
       places would have somebody walking to one to find out, but it is never
       the first thing anybody is offered. */
    return list.sort(function (a, b) {
      if (!a.closed !== !b.closed) return a.closed ? 1 : -1;
      return by(a, b);
    });
  }

  function narrow() {
    var needle = fold(state.q).trim();
    var clock = tallinnClock();

    state.shown = state.all.filter(function (venue) { return matches(venue, needle, clock); });

    if (state.sort === 'near' && state.here) {
      state.shown.forEach(function (venue) {
        venue.away = (typeof venue.lat === 'number' && typeof venue.lng === 'number')
          ? metresBetween(state.here, venue) : null;
      });
    }

    order(state.shown);
    state.pages = 1;
  }

  /* ------------------------------------------------------------- the cards */

  /* Four slots, always four, the filled ones in the accent. The map's gauge in
     assets/app.js can light half a slot because a hand-written price band
     lands on 2.5; Google's never does — "$" to "$$$$" is four whole steps — so
     this one has two states rather than three. Same markup and the same
     .price rules in assets/styles.css draw it. */
  function priceGauge(band) {
    var wrap = el('span', {
      className: 'price', role: 'img', 'aria-label': t('priceOf', { n: number(band) })
    });
    for (var i = 1; i <= 4; i++) {
      wrap.appendChild(el('i', { className: i <= band ? 'on' : null, textContent: '€' }));
    }
    return wrap;
  }

  /* Google's own page for a place, built from the key rather than carried in
     the answer. The export has a maps_url column and it is deliberately not
     sent: it is forty kilobytes of the roll, and this is the documented Google
     Maps URL for exactly the same place — the key is what identifies it, and
     the name is only there so the tab has a title before Google resolves it. */
  function mapsUrl(venue) {
    return 'https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent(venue.name) + '&query_place_id=' + encodeURIComponent(venue.id);
  }

  function directionsUrl(venue) {
    return 'https://www.google.com/maps/dir/?api=1&destination=' +
      encodeURIComponent(venue.lat + ',' + venue.lng) +
      '&destination_place_id=' + encodeURIComponent(venue.id);
  }

  /* A link off the card to somebody else's site or to Google's. Everything
     built with this leaves the page, so all of it opens in a new tab; the two
     links that do not — the phone number and the door to the map — are built
     where they are used. */
  function outLink(key, href, className) {
    return el('a', {
      className: 'venue-link' + (className ? ' ' + className : ''),
      href: href,
      target: '_blank',
      rel: 'noopener',
      textContent: t(key)
    });
  }

  function card(venue, clock) {
    var node = el('article', {
      className: 'venue card' + (venue.closed ? ' is-closed' : '') +
        (state.selected === venue.id ? ' is-lit' : ''),
      'data-id': venue.id
    });

    /* The name is a button and not a heading with a link in it: pressing it
       lights this place on the map beside the list, which is a thing that
       happens on this page rather than somewhere to go. */
    node.appendChild(el('h2', { className: 'venue-name' }, [
      el('button', {
        type: 'button',
        className: 'venue-pick',
        'aria-label': t('openPlace', { name: venue.name }),
        textContent: venue.name
      })
    ]));

    var facts = el('p', { className: 'venue-facts' });
    if (typeof venue.rating === 'number') {
      facts.appendChild(el('span', {
        className: 'venue-score',
        title: t('venuesRated', { n: score(venue.rating) }),
        textContent: score(venue.rating)
      }));
      facts.appendChild(el('span', { className: 'venue-star', 'aria-hidden': 'true', textContent: '★' }));
    }
    if (typeof venue.reviews === 'number') {
      facts.appendChild(el('span', {
        className: 'venue-reviews',
        textContent: venue.reviews === 1
          ? t('venuesReviewsOne')
          : t('venuesReviews', { n: number(venue.reviews) })
      }));
    }
    if (venue.price) facts.appendChild(priceGauge(venue.price));
    if (facts.firstChild) node.appendChild(facts);

    var ids = venue.kitchens.slice();
    /* Whatever is being filtered by goes first. Only two of these fit on a
       phone without wrapping, and the table's own order runs from the most
       exact word to the broadest — which means picking Beer/pub could hand
       back a card reading "Burgers · American". True, and it looks like a
       mistake. A card should always say why it is in the list. */
    if (state.cuisine) {
      var at = ids.indexOf(state.cuisine);
      if (at > 0) ids.unshift(ids.splice(at, 1)[0]);
    }
    var kitchens = ids.map(label).filter(Boolean);
    if (kitchens.length) {
      node.appendChild(el('p', {
        className: 'venue-kitchens',
        textContent: kitchens.slice(0, 2).join(' · ')
      }));
    }

    var when = openingLine(venue, clock);
    node.appendChild(el('p', {
      className: 'venue-when' + (when.open ? ' is-open' : '') + (when.known ? '' : ' is-unknown'),
      textContent: venue.closed ? t('venuesShutFor') : when.text
    }));

    if (venue.address) {
      var where = el('p', { className: 'venue-where' }, [venue.address]);
      if (state.sort === 'near' && typeof venue.away === 'number') {
        where.appendChild(el('span', { className: 'venue-away', textContent: distanceLine(venue.away) }));
      }
      node.appendChild(where);
    }

    var links = el('p', { className: 'venue-links' });
    /* The one row that is not Google's: sixty of these are places on my
       map, and this is the door to the write-up. First in the row because it
       is the only thing on this page that carries an opinion. */
    if (venue.mapId) {
      links.appendChild(el('a', {
        className: 'venue-link venue-mine',
        href: '/?spot=' + encodeURIComponent(venue.mapId),
        textContent: t('venuesOnMap')
      }));
    }
    if (venue.phone) {
      links.appendChild(el('a', {
        className: 'venue-link',
        /* A tel: href is what makes a phone dial rather than navigate, and it
           wants the digits without the spaces the export writes them with.
           Not a new tab: it is not a page, and a browser handed one leaves an
           empty tab behind on the way to the dialler. */
        href: 'tel:' + venue.phone.replace(/[^+0-9]/g, ''),
        textContent: t('call')
      }));
    }
    if (venue.website) links.appendChild(outLink('website', venue.website));
    if (typeof venue.lat === 'number') {
      links.appendChild(outLink('directions', directionsUrl(venue)));
    }
    links.appendChild(outLink('venuesMaps', mapsUrl(venue), 'venue-google'));
    node.appendChild(links);

    return node;
  }

  function renderList() {
    var clock = tallinnClock();
    var upto = Math.min(state.shown.length, state.pages * PAGE);

    clear(dom.list);
    for (var i = 0; i < upto; i++) dom.list.appendChild(card(state.shown[i], clock));

    dom.count.textContent = state.shown.length === 0
      ? (state.q ? t('searchNone', { q: state.q }) : t('noResults'))
      : state.shown.length === 1 ? t('listCountOne') : t('listCount', { n: number(state.shown.length) });

    dom.more.hidden = upto >= state.shown.length;
    dom.clear.hidden = !(state.q || state.open || state.cuisine || state.rating || state.price);
  }

  /* --------------------------------------------------------------- the map */

  /* A dot per match rather than a pin per match. Eleven hundred of the map's
     own markers is eleven hundred elements and a page that stops scrolling;
     circles on the canvas renderer are one path each and the whole export
     draws in a frame. They are not the map's pins for the same reason the page
     is not the map: nothing on it has been visited. */
  function paintDots() {
    if (!map || !dots) return;

    dots.clearLayers();
    byPlace = {};

    var css = getComputedStyle(document.documentElement);
    var accent = css.getPropertyValue('--accent').trim() || '#a81e28';
    var muted = css.getPropertyValue('--muted').trim() || '#7d5754';
    var paper = css.getPropertyValue('--paper').trim() || '#fff0ea';

    var bounds = [];
    state.shown.forEach(function (venue) {
      if (typeof venue.lat !== 'number' || typeof venue.lng !== 'number') return;
      var lit = state.selected === venue.id;
      var dot = window.L.circleMarker([venue.lat, venue.lng], {
        radius: lit ? 9 : 5,
        color: paper,
        weight: lit ? 2.5 : 1.5,
        fillColor: venue.closed ? muted : accent,
        fillOpacity: venue.closed ? 0.5 : 0.9
      });
      dot.on('click', function () { select(venue.id, false); });
      dot.bindTooltip(venue.name, { direction: 'top', offset: [0, -6] });
      dot.addTo(dots);
      byPlace[venue.id] = dot;
      bounds.push([venue.lat, venue.lng]);
    });

    return bounds;
  }

  /* Redrawn and refitted: what a filter change does to the map. Kept apart
     from paintDots because selecting a place redraws the dots and must not
     move the view out from under the person who pressed one. */
  function refitMap() {
    var bounds = paintDots();
    if (!bounds || !bounds.length) return;
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16, animate: false });
  }

  function drawMap() {
    if (map || !window.L || !window.TTBBasemap) return;

    /* preferCanvas is the whole reason eleven hundred dots is a frame rather
       than a stall: without it Leaflet gives each circle its own SVG path in
       the document. Everything else here is Leaflet's own default. */
    map = window.L.map('venues-map', { preferCanvas: true }).setView(CENTRE, ZOOM);

    window.TTBBasemap
      .layer(window.L, { dark: document.documentElement.getAttribute('data-style') === 'green' })
      .addTo(map);

    dots = window.L.layerGroup().addTo(map);
  }

  /* ------------------------------------------------------------ selecting */

  /* One place lit in both halves at once. `fromList` says which half was
     pressed, because the other is the one that has to move: a card press pans
     the map, a dot press scrolls the list — and doing both would fight
     whichever the person is actually looking at. */
  function select(id, fromList) {
    state.selected = state.selected === id ? '' : id;

    /* A dot can be pressed for a place whose card has not been built yet: the
       list grows a screenful at a time and the map has always shown the whole
       match. Grow it until the card exists rather than scrolling to nothing. */
    if (state.selected && !fromList) {
      var at = -1;
      for (var i = 0; i < state.shown.length; i++) {
        if (state.shown[i].id === state.selected) { at = i; break; }
      }
      if (at >= 0) state.pages = Math.max(state.pages, Math.ceil((at + 1) / PAGE));
    }

    renderList();
    paintDots();

    if (!state.selected) return;

    if (fromList) {
      var dot = byPlace[state.selected];
      if (map && dot) map.setView(dot.getLatLng(), Math.max(map.getZoom(), 15), { animate: true });
    } else {
      /* On a phone the list it is being scrolled to is the half that is not on
         screen, so pressing a dot swaps them: without this the only thing a
         tap on the map does is redraw a card nobody can see. */
      if (document.body.classList.contains('venues-on-map')) showMap(false);
      var node = dom.list.querySelector('[data-id="' + state.selected + '"]');
      if (node && node.scrollIntoView) node.scrollIntoView({ block: 'nearest' });
    }
  }

  /* Under the stylesheet's breakpoint the list and the map cannot share a phone
   * screen, so one is shown at a time. The class goes on the body and the
   * stylesheet decides what it means, which keeps the width in the one file
   * that knows it.
   *
   * Revealing the map is not just a display change. Leaflet measures its
   * container when it is drawn, and this one is drawn inside a hidden column,
   * so it has always believed it was nothing by nothing — which is why the
   * fit it did at boot has to be done again the first time anybody looks at
   * it. Whatever is selected wins over the fit: somebody who pressed a card
   * and then pressed Map is asking to see that place, not the whole city.
   */
  /* How tall the pinned bar actually is, in a custom property the stylesheet
     reads. It is not a constant anywhere: five controls in ten languages wrap
     differently, a phone scrolls them sideways into one row, and the switch
     below them is only drawn under the breakpoint. The map is the window less
     this, so guessing at it would be a map that is short on one language and
     off the bottom of the screen on another. */
  function measureBar() {
    document.documentElement.style.setProperty('--venues-bar', dom.bar.offsetHeight + 'px');
  }

  function showMap(on) {
    document.body.classList.toggle('venues-on-map', on);
    dom.seeMap.setAttribute('aria-pressed', on ? 'true' : 'false');
    dom.seeList.setAttribute('aria-pressed', on ? 'false' : 'true');
    if (!on || !map) return;

    /* Straight up under the bar, because the map is as tall as the window less
       that bar and half of it would otherwise be below the fold of the phone
       that just asked to see it. scrollIntoView would put it behind the bar
       instead, which is what the offset is subtracting. */
    var top = dom.mapWrap.getBoundingClientRect().top + window.pageYOffset - dom.bar.offsetHeight;
    window.scrollTo(0, Math.max(0, top));
    map.invalidateSize();
    var dot = state.selected ? byPlace[state.selected] : null;
    if (dot) map.setView(dot.getLatLng(), Math.max(map.getZoom(), 15), { animate: false });
    else refitMap();
  }

  /* ------------------------------------------------------------- controls */

  function option(value, text) {
    return el('option', { value: value, textContent: text });
  }

  function fillControls() {
    /* Only the cuisines something in the answer actually carries, so the
       picker cannot offer a word that returns nothing. Sorted by the label
       rather than the id: the order has to be the reading language's. */
    var present = {};
    state.all.forEach(function (venue) {
      venue.kitchens.forEach(function (id) { if (label(id)) present[id] = true; });
    });
    var ids = Object.keys(present);
    ids.sort(function (a, b) {
      var x = label(a), y = label(b);
      if (collator) return collator.compare(x, y);
      return fold(x) < fold(y) ? -1 : fold(x) > fold(y) ? 1 : 0;
    });

    clear(dom.cuisine);
    dom.cuisine.appendChild(option('', t('venuesCuisineAny')));
    ids.forEach(function (id) { dom.cuisine.appendChild(option(id, label(id))); });
    if (present[state.cuisine]) dom.cuisine.value = state.cuisine;
    else state.cuisine = '';

    clear(dom.rating);
    dom.rating.appendChild(option('', t('venuesRatingAny')));
    RATINGS.forEach(function (n) {
      dom.rating.appendChild(option(String(n), t('venuesRatingFrom', { n: score(n) })));
    });
    dom.rating.value = state.rating ? String(state.rating) : '';

    clear(dom.price);
    dom.price.appendChild(option('', t('venuesPriceAny')));
    /* One to four euro signs, which is a label that needs no language. */
    PRICES.forEach(function (band) {
      dom.price.appendChild(option(String(band), new Array(band + 1).join('€')));
    });
    dom.price.value = state.price ? String(state.price) : '';

    clear(dom.sort);
    dom.sort.appendChild(option('rating', t('venuesSortRating')));
    dom.sort.appendChild(option('reviews', t('venuesSortReviews')));
    dom.sort.appendChild(option('name', t('listAlphabet')));
    dom.sort.appendChild(option('near', t('venuesSortNear')));
    dom.sort.value = state.sort;

    dom.search.value = state.q;
    dom.searchClear.hidden = !state.q;
    dom.open.setAttribute('aria-pressed', state.open ? 'true' : 'false');
  }

  /* Everything a control change does, in the one order it has to happen in:
     narrow, then draw both halves, then say so in the address bar. */
  function refresh() {
    state.selected = '';
    narrow();
    renderList();
    refitMap();
    writeUrl();
  }

  /* Sorting by distance is the only control that has to ask permission, so it
     is the only one that can fail. It reverts rather than sitting on an order
     it cannot produce: a list claiming to be nearest-first from a location
     nobody gave is worse than the order it replaced. */
  function sortByDistance() {
    if (state.here) { refresh(); return; }

    /* Reverting has to check that nearest-first is still what is chosen. The
       permission prompt is modal to the browser and not to the page, so
       somebody can pick another order while it is standing there, and
       answering No to it afterwards must not undo that. */
    var giveUp = function () {
      if (state.sort !== 'near') return;
      dom.sort.value = state.sort = 'rating';
      toast(t('locateFail'));
      refresh();
    };

    if (!navigator.geolocation) { giveUp(); return; }

    navigator.geolocation.getCurrentPosition(function (pos) {
      state.here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      refresh();
    }, giveUp, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
  }

  function wire() {
    dom.filters.addEventListener('submit', function (e) { e.preventDefault(); });

    dom.search.addEventListener('input', function () {
      state.q = dom.search.value;
      dom.searchClear.hidden = !state.q;
      /* A keystroke rebuilds eleven hundred dots and a screenful of cards, so
         it waits for the typing to stop rather than doing it per letter. */
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(refresh, 140);
    });

    dom.searchClear.addEventListener('click', function () {
      state.q = '';
      dom.search.value = '';
      dom.searchClear.hidden = true;
      dom.search.focus();
      refresh();
    });

    dom.open.addEventListener('click', function () {
      state.open = !state.open;
      dom.open.setAttribute('aria-pressed', state.open ? 'true' : 'false');
      refresh();
    });

    dom.cuisine.addEventListener('change', function () {
      state.cuisine = dom.cuisine.value;
      refresh();
    });

    dom.rating.addEventListener('change', function () {
      state.rating = Number(dom.rating.value) || 0;
      refresh();
    });

    dom.price.addEventListener('change', function () {
      state.price = Number(dom.price.value) || 0;
      refresh();
    });

    dom.sort.addEventListener('change', function () {
      state.sort = dom.sort.value;
      if (state.sort === 'near') sortByDistance();
      else refresh();
    });

    dom.clear.addEventListener('click', function () {
      state.q = '';
      state.open = false;
      state.cuisine = '';
      state.rating = 0;
      state.price = 0;
      fillControls();
      refresh();
      dom.search.focus();
    });

    dom.more.addEventListener('click', function () {
      state.pages++;
      renderList();
    });

    /* One listener for every card there will ever be, on the container that
       outlives them: the list is rebuilt whole on every change, and a listener
       per card would be eleven hundred of them to hang and drop again. */
    dom.list.addEventListener('click', function (e) {
      var button = e.target.closest ? e.target.closest('.venue-pick') : null;
      if (!button) return;
      var article = button.closest('.venue');
      if (article) select(article.getAttribute('data-id'), true);
    });

    dom.seeMap.addEventListener('click', function () { showMap(true); });
    dom.seeList.addEventListener('click', function () { showMap(false); });
  }

  /* ----------------------------------------------------------------- boot */

  function failed() {
    clear(dom.list);
    dom.count.textContent = t('venuesFail');
    dom.more.hidden = true;
    dom.clear.hidden = true;
  }

  function boot() {
    dom = {
      filters: $('venues-filters'),
      search: $('venues-search'),
      searchClear: $('venues-search-clear'),
      open: $('venues-open'),
      cuisine: $('venues-cuisine'),
      rating: $('venues-rating'),
      price: $('venues-price'),
      sort: $('venues-sort'),
      clear: $('venues-clear'),
      count: $('venues-count'),
      list: $('venues-list'),
      bar: $('venues-bar'),
      mapWrap: document.querySelector('.venues-map-wrap'),
      more: $('venues-more'),
      seeList: $('venues-see-list'),
      seeMap: $('venues-see-map'),
      toast: $('toast')
    };

    applyStyle();
    readUrl();
    wire();
    measureBar();
    window.addEventListener('resize', measureBar);

    /* The two label files and the strings are the page; the roll is what goes
       in it. Asked for together rather than in turn, because the roll is the
       slow one and waiting for ui.json first would add a round trip to it. */
    Promise.all([
      getJSON('/data/ui.json'),
      getJSON('/data/taxonomy.json'),
      getJSON('/data/cuisines.json'),
      getJSON(API).catch(function () { return null; })
    ]).then(function (loaded) {
      state.ui = loaded[0] || {};
      state.lang = pickLanguage(Object.keys(state.ui).sort());
      try { collator = new Intl.Collator(state.lang, { sensitivity: 'base' }); } catch (e) { /* folded instead */ }
      applyStaticStrings();
      /* After the strings, not before: the bar is as tall as the words in it. */
      measureBar();

      ((loaded[1] && loaded[1].types) || []).forEach(function (row) { state.labels[row.id] = row; });
      ((loaded[2] && loaded[2].cuisines) || []).forEach(function (row) { state.labels[row.id] = row; });

      drawMap();

      if (!loaded[3] || !Array.isArray(loaded[3])) { failed(); return; }
      state.all = loaded[3];

      fillControls();
      refresh();
    }).catch(function (err) {
      /* ui.json itself did not arrive, so there is no language to say so in.
         Same last resort as the lists page: English out of the pack if any of
         it landed, and the sentence written out if none of it did. It is the
         one place on this site an untranslated string is the better of two
         bad answers — the other is printing the key. */
      if (window.console && console.error) console.error(err);
      dom.count.textContent = (state.ui.en && state.ui.en.loadError) ||
        'Something went wrong loading the data. Try refreshing the page.';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
