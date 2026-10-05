/* Tallinn Tastebuds — /privacy.
 *
 * The policy itself is written into the page by functions/privacy.js, in the
 * language the address names, and nothing here draws it again. This file does
 * what only the browser can: wears the style the visitor chose, sends a
 * visitor who reads in another language from the bare address to theirs —
 * /privacy?lang=et and the rest, the way the map is read — and puts the
 * page's few frame words, the skip link and the way home, into the language
 * the page is in. **Privacy** in README.md.
 *
 * Plain browser JavaScript, one IIFE, ES5, like every file in assets/.
 */
(function () {
  'use strict';

  var LANGS_URL = '/data/lang/index.json';
  var LANG_URL = '/data/lang/';

  var STYLES = ['red', 'green', 'blue', 'plum'];
  var DEFAULT_STYLE = 'red';
  var STYLE_KEY = 'ttb.style';
  var LANG_KEY = 'ttb.lang';
  var DEFAULT_LANG = 'en';

  function storeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function getJSON(url) {
    return fetch(url, { headers: { accept: 'application/json' } }).then(function (res) {
      if (!res.ok) throw new Error(url + ': ' + res.status);
      return res.json();
    });
  }

  /* applyStyle() in assets/blog.js, which this copies. */
  function applyStyle() {
    var fromUrl = new URLSearchParams(window.location.search).get('style');
    var stored = storeGet(STYLE_KEY);
    var style = STYLES.indexOf(fromUrl) !== -1 ? fromUrl
              : STYLES.indexOf(stored) !== -1 ? stored
              : DEFAULT_STYLE;

    document.documentElement.setAttribute('data-style', style);

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      var wash = getComputedStyle(document.documentElement).getPropertyValue('--wash').trim();
      if (wash) meta.setAttribute('content', wash);
    }
  }

  /* The language this visitor reads in, by the order every page picks in —
     except ?lang=, which on this page is the address and not a preference,
     and is honoured by the server before this runs. */
  function preferred(langs) {
    var stored = storeGet(LANG_KEY);
    if (stored && langs.indexOf(stored) !== -1) return stored;
    var prefs = navigator.languages || [navigator.language || ''];
    for (var i = 0; i < prefs.length; i++) {
      var base = String(prefs[i]).toLowerCase().split('-')[0];
      if (langs.indexOf(base) !== -1) return base;
    }
    return DEFAULT_LANG;
  }

  /* The frame's words in the page's language, where the language file has
     them; the markup's English stands where it does not. */
  function applyStaticStrings(ui) {
    var each = function (attr, apply) {
      var nodes = document.querySelectorAll('[' + attr + ']');
      for (var i = 0; i < nodes.length; i++) {
        var s = ui[nodes[i].getAttribute(attr)];
        if (typeof s === 'string') apply(nodes[i], s);
      }
    };
    each('data-i18n', function (n, s) { n.textContent = s; });
    each('data-i18n-aria-label', function (n, s) { n.setAttribute('aria-label', s); });
  }

  function boot() {
    applyStyle();
    var shown = document.documentElement.lang || DEFAULT_LANG;
    var url = new URL(window.location.href);

    getJSON(LANGS_URL).then(function (names) {
      var langs = Object.keys(names || {});
      /* Only from the bare address, and only to a language the site speaks:
         a visitor who followed a link to one language is reading the one
         they were sent, and a ?lang= is never rewritten into another. */
      var wanted = preferred(langs);
      if (!url.searchParams.has('lang') && wanted !== shown) {
        url.searchParams.set('lang', wanted);
        window.location.replace(url.toString());
        return null;
      }
      return shown === DEFAULT_LANG ? null : getJSON(LANG_URL + shown + '.json');
    }).then(function (pack) {
      if (pack && pack.ui) applyStaticStrings(pack.ui);
    }).catch(function () { /* the English in the frame stands */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
