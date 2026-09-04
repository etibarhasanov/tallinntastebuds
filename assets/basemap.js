/* Tallinn Tastebuds — the basemap, said once.
 *
 * Four maps draw the same CARTO tiles: the map on index.html, the pin picker
 * in the "add a place" form on lists.html, and the pin picker in admin.html.
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

  var ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
    '&copy; <a href="https://carto.com/attributions">CARTO</a>';

  /* Leaflet fills in {s}, {z}, {x}, {y} and {r}; the key is ours to add, and
     it goes on as a query string so those placeholders are untouched. */
  function url(dark) {
    var base = dark ? DARK : LIGHT;
    return KEY ? base + '?key=' + encodeURIComponent(KEY) : base;
  }

  /* The tile layer itself, because every caller wanted the same four options
     and one of them quietly did not have them. `subdomains` matters: the URL
     carries an {s} and Leaflet's default only spreads over a, b, c, so a
     fourth of the addresses CARTO serves went unused.

     `opts` is merged over the defaults for the things that really are per-map
     — the picker squares cap their zoom lower than the full-page map — and
     `opts.dark` picks the style. L is passed in rather than read off the
     window because two of the three callers load Leaflet on demand and know
     when it has arrived better than this file does. */
  function layer(L, opts) {
    var o = opts || {};
    var made = {
      subdomains: 'abcd',
      maxZoom: 20,
      detectRetina: true,
      attribution: ATTRIBUTION
    };
    for (var k in o) {
      if (Object.prototype.hasOwnProperty.call(o, k) && k !== 'dark') made[k] = o[k];
    }
    return L.tileLayer(url(o.dark), made);
  }

  return { key: KEY, url: url, layer: layer, attribution: ATTRIBUTION };
})();
