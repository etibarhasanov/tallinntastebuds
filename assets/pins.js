/* Tallinn Tastebuds — the pins, and which one a place draws.
 *
 * Three kinds of thing get a pin on this site and they are decided in this
 * order, which is the whole of the feature:
 *
 *   1. A place on my map draws THE MARK — the mouth out of the painting, at
 *      22px, see "The mark" in README.md. Nothing a list can choose
 *      overrides it: one that chose a croissant and put Pizza Hut and a
 *      place of mine side by side gets a croissant and a mouth, because the
 *      mouth is not decoration: it is this site saying it has eaten there.
 *      It is not in GLYPHS below and there is no way to ask for it. The one
 *      thing that does draw over it is the reader's own language — LANGUAGES
 *      below — which is nobody's claim about the place.
 *
 *   2. A place a list put on the screen draws THE LIST'S pin, in the list's
 *      tone. That is the choice its owner made, and it is what makes ten
 *      pins read as one person's ten rather than as ten unrelated dots.
 *
 *   3. Anything else off Google's export draws the pin for WHAT IT IS —
 *      a cup for a café, a glass for a bar, a croissant for a bakery —
 *      picked out of the kinds the export already carries. Which is the
 *      same idea Google Maps has, in this site's own two palettes rather
 *      than in Google's one.
 *
 * WHY EMOJI AND NOT EIGHTEEN DRAWINGS
 *
 * They cost nothing — no file, no sprite, no request, and no thirteenth
 * thing to re-render when a size changes — and everybody already knows what
 * they mean, in ten languages, without a legend. The price is that the
 * picture is the reader's platform's: a croissant is Apple's on an iPhone
 * and Google's on a Pixel, and neither is ours. That trade would be the
 * wrong one for the mark, which is why the mark is a photograph and is not
 * in here; it is the right one for a decoration somebody picks in a grid.
 *
 * WHY A GLOBAL AND NOT A MODULE
 *
 * The same reason as assets/track.js and assets/basemap.js: no build step,
 * no bundler, and a classic script that sets one global works everywhere.
 * Load it before the page's own script — both are `defer`, so document order
 * is execution order.
 *
 * KEEP IT IN STEP WITH functions/api/_pins.js
 *
 * That file holds the same eight ids, because the server is what decides
 * whether the string a list wants to store is one of them. It cannot import this one and this one cannot import it — different
 * dialects, different runtimes — so they are written out twice, the way the
 * story clock in assets/app.js restates tools/clock.mjs. Change one, change
 * the other; node tools/validate.mjs fails the build if they drift.
 */
window.TTBPins = (function () {
  'use strict';

  /* ------------------------------------------------ two tables, not one
   *
   * They say different things, so they are separate lists and they do not
   * overlap. Mixing them was the first version's mistake: a list wearing a
   * croissant put a croissant on a sushi place, which reads as the map being
   * wrong about the sushi place rather than as the list being somebody's.
   *
   *   MARKERS  what a LIST wears. Eight symbols, none of them food — a pin,
   *            a flame, a flag — because a list is somebody's choice of
   *            places and not a claim about what any one of them cooks. They
   *            mark a spot, which is the only thing that is true of all ten
   *            places on a top ten.
   *
   *            Eight and not eighteen. A grid of eighteen is a decision to
   *            make before you can name your list, and the ones that went
   *            were the ones nobody would miss: a trophy and a crown say the
   *            same thing, a butterfly and a clover say nothing at all. What
   *            is left is one of each, in the order they are written below —
   *            a place, a claim, a warning, a brightness, a love, a
   *            prettiness, a treasure, a party. All eight draw in the
   *            style's accent: a colour picker under them was a second
   *            decision to make before you could name a list, for a
   *            difference the marker was already making.
   *
   *   PLACES   what a GOOGLE ROW is. Five kinds of place, not thirty-eight
   *            kitchens: the question a pin on a map answers is "what is
   *            this door", and "somewhere you sit and eat" / "coffee" /
   *            "a drink" / "a counter you queue at" / "something baked" is
   *            the whole of what that can usefully be at 22px. Which is
   *            also the split Google Maps itself draws.
   *
   * Only MARKERS is a choice. functions/api/_pins.js holds those ids and
   * nothing else, so a list cannot ask for a cup — that word belongs to
   * whatever Google says the place is.
   *
   * There is a third table below these two, LANGUAGES, and it answers a
   * different question again: not what a pin is, but what every pin is
   * drawn as while the page reads in that language. It has its own comment,
   * and it overrides both of these without touching either.
   *
   * Each row is id, emoji, and the tone it wears when nothing has chosen one
   * for it, which for a marker is always the accent. The tones are custom
   * properties both styles restate — see the token block at the top of
   * assets/styles.css — so "amber" is Red's amber on Red and Green's amber
   * on Green, and a pin follows the swatch without knowing either value.
   *
   * The id names each one; there is no comment beside a picture saying what
   * the picture is. Every emoji here that is a plain BMP symbol ends U+FE0F,
   * and it is not decoration: the heart and the sun have a text form as well
   * as a colour one, and without the selector a handful of platforms draw
   * them as black glyphs among the coloured ones. Retyping one from a
   * keyboard is the way to lose it.
   */
  var MARKERS = [
    ['pin',     '\uD83D\uDCCD'],
    ['flag',    '\uD83D\uDEA9'],
    ['flame',   '\uD83D\uDD25'],
    ['sun',     '\u2600\uFE0F'],
    ['heart',   '\u2764\uFE0F'],
    ['blossom', '\uD83C\uDF38'],
    ['gem',     '\uD83D\uDC8E'],
    ['balloon', '\uD83C\uDF88']
  ];

  /* Five kinds, three colours, and the third field is the only place a tone
     is written down at all. What you eat takes the style's own accent, what
     you drink sea, what is baked amber — three is what a five-pixel dot on
     the directory's map can actually carry (see "The dots are not the map's
     pins" in README.md), and the glyph is what tells the five apart.

     A marker has no tone because a list does not choose one: every marker
     draws in the accent, which is the colour of everything else on this site
     that is a link or a pin. Six swatches under the grid was a second
     decision to make before you could name a list, for a difference the
     marker was already making. */
  var PLACES = [
    ['eatery',    '\uD83C\uDF74', 'accent'],
    ['fast',      '\uD83C\uDF54', 'accent'],
    ['coffee',    '\u2615\uFE0F', 'sea'],
    ['bar',       '\uD83C\uDF7A', 'sea'],
    ['bakery',    '\uD83E\uDD50', 'amber']
  ];

  /* Every tone that exists, which is the three PLACES uses and no more. Not
     a palette anybody picks from — it is the list tools/validate.mjs holds
     assets/styles.css to, so a kind cannot be filed under a colour the
     stylesheet has never heard of. */
  var TONES = ['accent', 'sea', 'amber'];

  var DEFAULT_PIN = 'pin';
  var DEFAULT_TONE = 'accent';

  /* Google's words, read into one of the five. The keys are ids out of
     data/taxonomy.json and data/cuisines.json, which are deliberately
     disjoint — see "Cuisines, in ten languages" in README.md — so one object
     can hold both without a collision.

     Everything not named here is somewhere you sit and eat, which is the
     honest answer for half the export: a Thai restaurant, a pizzeria and a
     steakhouse are three cuisines and one kind of door. The thirty-eight
     kitchens still exist and the directory still filters on them; they are
     words under a card rather than a picture on a map.

     Measured over the 1,110 rows as the export stands: 547 eatery, 202
     coffee, 160 bar, 135 fast, 66 bakery. The eighteen ice cream, chocolate
     and dessert shops among them land in bakery, which is where a sweet thing you take
     away belongs — no cuisine id names them, and inventing one would put a
     chip on the directory to serve a pin. */
  var KINDS = {
    coffee: 'coffee',
    bar: 'bar',
    pub: 'bar',
    'fast-food': 'fast',
    burgers: 'fast',
    bakery: 'bakery'
  };

  /* ------------------------------------------------ what a language wears
   *
   * The third table, and it answers a different question from the two
   * above: not what a pin is, but what every pin is drawn as while the page
   * reads in that language. A row here is one picture, and under it the
   * eight markers, the five kinds of place, the mouth on my own places, the
   * picker's grid, the emblem in front of a list's title, the mark in every
   * header and the door on the rail are all that picture. Estonian is a
   * potato. Russian is an onion. Switch the language and the whole map
   * changes its mind about what it is made of — which was asked for, for a
   * video, and stays because the joke works.
   *
   * English is not in here, and that is what makes it the real map: a code
   * with no row draws the two tables above, which is also what a language
   * added tomorrow does until somebody writes it one.
   *
   * The mouth goes too. It is a photograph and not an emoji, so it is not a
   * row in any table, but under a language that wears a picture a place of
   * mine is dressed as a glyph pin wearing it, in the accent — isMark()
   * below is where that is decided — and every <img> of the mouth in the
   * markup, the mark in a header, the one in the story viewer, the face on
   * the tour, shows the picture instead: see wear() at the foot of this
   * file. What does not change is anything a list STORES: a list dressed in
   * a balloon is a balloon in the database and on an English map, the
   * picker still stores the id under the swatch however the swatch is
   * drawn, and the mouth is still nothing a stranger can hand out or take
   * away — the language is the reader's, not the list's.
   *
   * The language is read off <html lang> at the moment a glyph is asked
   * for, rather than told to this file: every page writes it there in its
   * applyStaticStrings() before it draws a pin, and the map writes it again
   * on the switch before it repaints. It is the one fact about the language
   * all the pages already agree on, so there is no second setter for a page
   * to forget, and a page that never sets it draws the real pins. The codes
   * are the ones data/ui.json speaks, and node tools/validate.mjs fails the
   * build on one it does not — `ee` here would be a row that never fires,
   * which is what "Estonian is et, not ee" in README.md is about.
   *
   * A code names a language and not a picture, so unlike the rows above
   * these do get a word beside them:
   *
   *   az, et   potato                    ru   onion
   *   hy       a bottle, cork coming out  fi   blueberries
   *   pt       a fish                     es   a pan of paella
   *   tr       a stuffed flatbread        uk   a sunflower
   */
  var LANGUAGES = {
    az: '\uD83E\uDD54',
    et: '\uD83E\uDD54',
    hy: '\uD83C\uDF7E',
    ru: '\uD83E\uDDC5',
    fi: '\uD83E\uDED0',
    pt: '\uD83D\uDC1F',
    es: '\uD83E\uDD58',
    tr: '\uD83E\uDD59',
    uk: '\uD83C\uDF3B'
  };

  /* Both tables in one lookup, because everything that draws a pin is handed
     an id and does not care which list it came off — only the picker cares,
     and it walks MARKERS itself. An id in neither is drawn as the default
     marker rather than as nothing: a list holding a glyph that has since
     been taken out of the table is a pin somebody chose once, and a hole in
     the map is a worse answer than a plain one. */
  var byId = {};
  var i;
  for (i = 0; i < MARKERS.length; i++) {
    byId[MARKERS[i][0]] = { glyph: MARKERS[i][1], tone: DEFAULT_TONE };
  }
  for (i = 0; i < PLACES.length; i++) {
    byId[PLACES[i][0]] = { glyph: PLACES[i][1], tone: PLACES[i][2] };
  }

  /* The picker's grid, and what a list is allowed to be wearing. */
  var markerIds = MARKERS.map(function (m) { return m[0]; });

  function known(id) {
    return typeof id === 'string' && Object.prototype.hasOwnProperty.call(byId, id);
  }

  /* The picture the page's language draws every glyph as, or '' for a
     language that draws the real ones. */
  function worn() {
    var code = document.documentElement.lang;
    return Object.prototype.hasOwnProperty.call(LANGUAGES, code) ? LANGUAGES[code] : '';
  }

  /* The emoji for an id, or the map pin. Never empty: a pin drawing nothing
     at all is a hole in the map, and the default says "a place", which is
     the one thing true of everything on here. Under a language in LANGUAGES
     the id is not even looked at. */
  function glyph(id) {
    return worn() || (known(id) ? byId[id].glyph : byId[DEFAULT_PIN].glyph);
  }

  function toneOf(id) {
    return known(id) ? byId[id].tone : DEFAULT_TONE;
  }

  /* Whether a pin is the mouth: only 'mark', and only while the language is
     not drawing everything as one picture. Under one, a place of mine is a
     glyph pin like the rest, wearing that picture in the accent. The size it
     draws at is still the map's to decide — pinSize() in assets/app.js — so
     a write-up-only place is a smaller potato, the way it was a smaller
     mouth. */
  function isMark(pin) {
    return pin === 'mark' && !worn();
  }

  /* What a pin's face holds: nothing for the mouth, which the stylesheet
     draws as a background, and the emoji for everything else. */
  function faceOf(pin) {
    return isMark(pin) ? '' : glyph(pin);
  }

  /* What kind of door a place off the export is, as one of the five. The
     kitchens are asked first because they are the exact word — "bakery"
     before "restaurant" — and the types after, which is the same order of
     exactness kitchensOf() in functions/api/venues.js puts two words in.

     Both arrays arrive in their own table's order rather than in the row's,
     so the first hit is the most exact word this site knows about the place
     rather than the first thing Google happened to write down.

     Falls through to the fork and knife and not to the map pin: this answers
     "what is this place", and for half the export the answer really is
     "somewhere you sit and eat". The map pin is what a LIST defaults to,
     which is a different question. */
  function forKinds(kitchens, types) {
    var all = (kitchens || []).concat(types || []);
    for (var j = 0; j < all.length; j++) {
      if (Object.prototype.hasOwnProperty.call(KINDS, all[j])) return KINDS[all[j]];
    }
    return 'eatery';
  }

  /* The marker a list wears. '' in the column is a list nobody has dressed,
     and the default is applied here rather than in the database so that
     changing it is a change to this file.

     MARKERS and not known(): a list may wear a marker and nothing else, so
     anything else — a kind of place, a glyph taken out of the table since —
     draws the map pin. cleanPin() on the server already answers '' to those,
     which makes this the second of two doors rather than the only one, and
     the one that says out loud which table a list is allowed to read from. */
  function ofList(list) {
    var chosen = list && list.pin;
    return markerIds.indexOf(chosen) >= 0 ? chosen : DEFAULT_PIN;
  }

  /* What a pin is, said in classes on one element: whether it is the mark or
     a glyph, and which tone it wears. The colour is a class rather than an
     inline style because the stylesheet owns every colour on this site — see
     design rule 1 — and because dressPin() in assets/app.js sets --pin-tone
     inline for the three states that outrank a choice (open, kept, shut). An
     inline custom property beats a class, so those three win without either
     half having to know about the other.

     'mark' is the mouth and takes no glyph at all. It is not in GLYPHS and
     nothing anybody types can reach it: only a place on my map is dressed
     with it, by the one call in assets/app.js that knows which places those
     are — and under a language that wears a picture, isMark() says it is a
     glyph after all, and it is dressed as one.

     Which element this goes on matters. On the map it is the marker's own
     node and the glyph is written into the .pin-face inside it, because
     Leaflet owns the shape of that pair; on a card it is the one element
     that is the whole pin, and paint() below does both at once. */
  function dress(node, pin) {
    if (!node) return node;
    for (var k = 0; k < TONES.length; k++) node.classList.remove('pin-tone-' + TONES[k]);
    var mark = isMark(pin);
    node.classList.toggle('is-mark', mark);
    node.classList.toggle('is-glyph', !mark);
    if (!mark) node.classList.add('pin-tone-' + toneOf(pin));
    return node;
  }

  /* One element that is the whole pin: dressed, with the emoji in it. What a
     list's own mark on a card or an index row is drawn with. */
  function paint(node, pin) {
    if (!node) return node;
    dress(node, pin);
    node.textContent = faceOf(pin);
    return node;
  }

  /* ------------------------------------------- the pictures in the markup
   *
   * A pin is asked for and answers. The mouth in a header is an <img> in
   * the markup, and nobody asks — so anything in the markup that follows
   * the language carries data-worn, and wear() dresses all of it. An <img>
   * shows the language's picture, drawn as text into an SVG the image can
   * show, so the ring, the crop and the size around it stay exactly where
   * they were; anything else, which today is the clipboard on the lists
   * door, has the picture written over its text. Each node remembers what
   * the markup gave it, so the mouth and the clipboard are written once, in
   * the HTML, and come back the moment the language stops saying otherwise.
   *
   * The SVG restates the --emoji font list rather than reading it: an SVG
   * drawn as an image reads no stylesheet and loads no web font, and the
   * platform's colour emoji face is a system font on every platform that
   * has one, which is the only font it needs. Centred the way the sky on
   * /lists centres its glyphs, with the .35em the rest of the web uses.
   *
   * Run once here — the script is deferred, so the markup is parsed — and
   * again whenever <html lang> changes, which every page's
   * applyStaticStrings() does before it draws and the map's setLanguage()
   * does on the switch. Watching the attribute rather than waiting to be
   * called is what lets a page that loads this file be dressed without a
   * line of its own; Leaflet's markers, which are built rather than
   * written, are the one thing left to repaint by hand — paintMarkers() in
   * assets/app.js. The tab's icon is deliberately not on the list: Safari
   * ignores a favicon changed after load, and Google reads the tags.
   */
  function picture(emoji) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<text x="50" y="50" dy=".35em" font-size="76" text-anchor="middle" ' +
      'font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, Android Emoji, EmojiSymbols, sans-serif">' +
      emoji + '</text></svg>'
    );
  }

  function wear() {
    var one = worn();
    var nodes = document.querySelectorAll('[data-worn]');
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var img = node.tagName === 'IMG';
      if (node.ttbOwn === undefined) node.ttbOwn = img ? node.getAttribute('src') : node.textContent;
      var want = img ? (one ? picture(one) : node.ttbOwn) : (one || node.ttbOwn);
      if (img) { if (node.getAttribute('src') !== want) node.setAttribute('src', want); }
      else if (node.textContent !== want) node.textContent = want;
    }
  }

  wear();
  new MutationObserver(wear).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['lang']
  });

  /* The two defaults are not on here, and that is the point of ofList() and
     glyph(): they apply them, so nothing outside this file has to know what
     an undressed list looks like or hold a second opinion about it. */
  return {
    /* Only ever the markers: the five place glyphs are what Google's rows
       are read as, never something to choose. */
    GLYPHS: markerIds,
    TONES: TONES,
    glyph: glyph,
    /* For the map, which writes a pin's face itself because Leaflet owns
       the pair — see dressPin() in assets/app.js. */
    faceOf: faceOf,
    toneOf: toneOf,
    forKinds: forKinds,
    ofList: ofList,
    dress: dress,
    paint: paint
  };
})();
