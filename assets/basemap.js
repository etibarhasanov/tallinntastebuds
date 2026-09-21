/* Tallinn Tastebuds — the basemap, said once.
 *
 * Four maps draw the same CARTO tiles: the map on index.html, the directory's
 * map on google.html, the pin picker in the "add a place" form on lists.html,
 * and the pin picker in admin.html.
 * Each of them used to carry its own copy of the URL, the key and the
 * attribution, and that is exactly how the picker on lists.html ended up
 * wearing "API KEY REQUIRED" diagonally across every tile for a while — the
 * key was added to two of the three copies and the third was not noticed.
 *
 * So the copies are gone and this is the one. It is a file rather than a
 * constant somebody has to remember to mirror, because a constant somebody
 * has to remember to mirror is the thing that just failed.
 *
 * WHY A GLOBAL AND NOT A MODULE
 *
 * The same reason as assets/pass.js, which three pages share the same way:
 * this site has no build step and no bundler, `file://` has to work for
 * checking a change, and a classic script that sets one global is the version
 * of this that needs neither. Load it before whichever script draws the map —
 * both are `defer`, so document order is execution order.
 *
 * THE KEY IS PUBLIC, AND THAT IS FINE
 *
 * CARTO used to serve these tiles to anyone who attributed them. They now
 * want a key, and they stamp "API KEY REQUIRED" diagonally across every tile
 * requested without one — the map still draws, it just wears the nag. The key
 * is free up to five million tiles a month, which this map will never
 * approach, and it is requested at carto.com/basemaps/apikey.
 *
 * It sits here in plain sight because it has to: this is a static site with
 * no build step and no server to hide anything behind, so anything the
 * browser needs is public. That is fine for this particular kind of key — it
 * is a meter reading, not a password, and it unlocks nothing but the tiles it
 * is already drawing. Lock it to the site's domain in the CARTO dashboard and
 * someone copying it out of here gets nothing they could not get by asking
 * for their own.
 *
 * Empty is a working state, deliberately: every map falls back to exactly
 * what it did before there was a key, watermark and all, rather than
 * breaking.
 */
window.TTBBasemap = (function () {
  'use strict';

  var KEY = 'cb1_2ci9_1_e18f20c42b2e5346aa517b42';

  /* Positron and Dark Matter. Dark is the half that needs its own tiles:
     dark cards over the pale light basemap would be unreadable. */
  var LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  var DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

  /* CARTO answers on four names. Leaflet's default spreads over a, b, c, so
     a fourth of the addresses went unused; it is written here rather than in
     the layer options because the warming below has to pick the same letter
     Leaflet would, or it fetches a URL nothing will ever ask for again. */
  var SUBDOMAINS = 'abcd';

  var TILE = 256;

  var ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
    '&copy; <a href="https://carto.com/attributions">CARTO</a>';

  /* Leaflet fills in {s}, {z}, {x}, {y} and {r}; the key is ours to add, and
     it goes on as a query string so those placeholders are untouched. */
  function url(dark) {
    var base = dark ? DARK : LIGHT;
    return KEY ? base + '?key=' + encodeURIComponent(KEY) : base;
  }

  /* Leaflet's own test, copied rather than read off it, because the warming
     runs before Leaflet is necessarily on the page. */
  function retina() {
    var dpr = window.devicePixelRatio ||
      (window.screen && window.screen.deviceXDPI / window.screen.logicalXDPI) || 1;
    return dpr > 1;
  }

  /* The tile layer itself, because every caller wanted the same four options
     and one of them quietly did not have them.

     `opts` is merged over the defaults for the things that really are per-map
     — the picker squares cap their zoom lower than the full-page map — and
     `opts.dark` picks the style. L is passed in rather than read off the
     window because two of the three callers load Leaflet on demand and know
     when it has arrived better than this file does.

     NO detectRetina, AND THAT IS THE FIX RATHER THAN THE OVERSIGHT. It was on
     here for a year and it was doing the {r} in the URL a second time: {r} is
     Leaflet's own retina switch and becomes `@2x`, which is CARTO's name for
     the same tile drawn 512px square, while detectRetina separately halves the
     tile box to 128px and asks for the zoom level below. Together they fetched
     four times as many tiles as a screen has room for and each one at four
     times the pixels — sixteen 512px images where four were wanted — which is
     a lot of network and a lot of decoding to do in the middle of a zoom.
     {r} alone is exactly one device pixel per pixel on a 2x screen, and a
     plain 256px tile on a 1x one.

     keepBuffer is two rows of tiles further than Leaflet's default one. Tiles
     are the one thing on this map that never goes stale — the streets of
     Tallinn are the same on the way back as they were on the way out — so
     holding a wider ring of them costs a little memory and saves the whole
     round trip when somebody pans back, which on a map of seventy-five places
     in one city is most of the panning there is. */
  function layer(L, opts) {
    var o = opts || {};
    var made = {
      subdomains: SUBDOMAINS,
      maxZoom: 20,
      keepBuffer: 3,
      attribution: ATTRIBUTION
    };
    for (var k in o) {
      if (Object.prototype.hasOwnProperty.call(o, k) && k !== 'dark') made[k] = o[k];
    }
    return L.tileLayer(url(o.dark), made);
  }

  /* One tile's address, built the way Leaflet builds it — same subdomain
     letter for the same tile, same `@2x`, same key. It has to be the same
     string down to the character: a warmed URL that differs from the one
     Leaflet asks for is not a head start, it is a second download. */
  function tileUrl(dark, z, x, y) {
    return url(dark)
      .replace('{s}', SUBDOMAINS.charAt(Math.abs(x + y) % SUBDOMAINS.length))
      .replace('{z}', z)
      .replace('{x}', x)
      .replace('{y}', y)
      .replace('{r}', retina() ? '@2x' : '');
  }

  /* ------------------------------------------------------------------ warming
   *
   * The map is one city and seventy-five places in it. Nobody opens it to go
   * somewhere else: they zoom in on a street, back out, and in again two
   * streets over, over the same square kilometre of tiles. So the tiles they
   * are about to want are nearly always the ones either side of the ones they
   * are looking at, and those can be in the browser's cache before the zoom
   * that asks for them rather than after it.
   *
   * That is all this does: after the map has settled, ask for the level above
   * and the level below the one on screen, over the view that is on screen,
   * with plain Image objects and no bookkeeping. The browser's HTTP cache
   * takes them — CARTO serves tiles with a year on them — and Leaflet's own
   * request a moment later is a cache hit that draws in the same frame.
   *
   * WHY NOT A SERVICE WORKER. Because the cache that matters here already
   * exists and is the browser's, and a worker would be a second thing
   * standing between this site and its own files — which on a site whose
   * scripts are cache-busted by hand with ?v= stamps is exactly the machinery
   * that has taken the map down before. The header of tools/stamp.mjs is that
   * story.
   *
   * It is polite about it. Nothing is warmed on a connection that says it is
   * metered or slow, every request is low priority so it queues behind the
   * tiles actually being drawn, and a URL already asked for is never asked
   * for twice.
   */

  var asked = {};
  var askedCount = 0;
  var inFlight = [];

  function thrifty() {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) return false;
    return !!c.saveData || /(^|-)(2g|slow-2g)$/.test(c.effectiveType || '');
  }

  function request(u) {
    if (asked[u]) return false;
    if (askedCount > 4000) { asked = {}; askedCount = 0; }
    asked[u] = true;
    askedCount++;

    var img = new Image();
    /* Behind the tiles Leaflet is drawing, never in front of them. */
    if ('fetchPriority' in img) img.fetchPriority = 'low';
    img.decoding = 'async';
    /* Held until it lands: an Image with nothing referring to it is a
       download the collector is allowed to cancel halfway. */
    inFlight.push(img);
    function done() {
      var at = inFlight.indexOf(img);
      if (at !== -1) inFlight.splice(at, 1);
    }
    img.onload = done;
    img.onerror = done;
    img.src = u;
    return true;
  }

  /* The tiles covering the map's current view at one zoom level, nearest the
     middle of the screen first — a budget that runs out should run out on the
     corners rather than wherever the loop happened to be. */
  function tilesFor(map, z) {
    var bounds = map.getBounds();
    var nw = map.project(bounds.getNorthWest(), z).divideBy(TILE).floor();
    var se = map.project(bounds.getSouthEast(), z).divideBy(TILE).floor();
    var span = Math.pow(2, z);
    var mid = map.project(map.getCenter(), z).divideBy(TILE);
    var out = [];

    for (var x = nw.x; x <= se.x; x++) {
      for (var y = nw.y; y <= se.y; y++) {
        if (x < 0 || y < 0 || x >= span || y >= span) continue;
        out.push({ x: x, y: y, d: Math.abs(x + 0.5 - mid.x) + Math.abs(y + 0.5 - mid.y) });
      }
    }
    out.sort(function (a, b) { return a.d - b.d; });
    return out;
  }

  /* In first, because zooming in is the gesture people repeat, and out
     second. CAP is the ceiling on one pass: a wide desktop window is about
     two dozen tiles, so the level above it is around a hundred, and there is
     no sense queueing a second screenful of them behind that. */
  var CAP = 120;

  function warm(map, opts) {
    var dark = opts && opts.dark;
    if (!map || thrifty()) return;

    var here = Math.round(map.getZoom());
    var levels = [here + 1, here - 1];
    var sent = 0;

    for (var i = 0; i < levels.length && sent < CAP; i++) {
      var z = levels[i];
      if (z < map.getMinZoom() || z > map.getMaxZoom()) continue;
      var tiles = tilesFor(map, z);
      for (var j = 0; j < tiles.length && sent < CAP; j++) {
        if (request(tileUrl(dark, z, tiles[j].x, tiles[j].y))) sent++;
      }
    }
  }

  /* Two, because two is what is called. The URL, the key and the attribution
     are said here so that nothing else has to know them — handing them out
     again would be the copies this file exists to end. */
  return { layer: layer, warm: warm };
})();
