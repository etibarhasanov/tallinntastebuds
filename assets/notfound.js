/* Tallinn Tastebuds — 404.html, the page at an address nothing answers.
 *
 * Everything the page says is already in its markup, in English, so with
 * scripts off it still says it and both ways on still work. This file does
 * the three things a script has to: wears the style the visitor chose, puts
 * the words into their language, and prints the address they asked for, so a
 * typo can be seen for what it is. **Not found** in README.md.
 *
 * The words come the way the blog's and the pass pages' do: the list of
 * languages out of data/lang/index.json, then the one this visitor reads in
 * out of data/lang/<code>.json, both written by tools/languages.mjs. Every
 * address is from the root, because this page is read at any depth.
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

  /* How much of the address is printed. A real one is a few dozen
     characters; a robot's can be a paragraph, and the card is not the place
     for it. */
  var AT_MAX = 120;

  var state = { lang: DEFAULT_LANG, ui: {} };

  function storeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function t(key) {
    var s = state.ui[key];
    return s === undefined ? null : s;
  }

  function getJSON(url) {
    return fetch(url, { headers: { accept: 'application/json' } }).then(function (res) {
      if (!res.ok) throw new Error(url + ': ' + res.status);
      return res.json();
    });
  }

  /* The style, applied before anything else — applyStyle() in
     assets/blog.js, which this copies. */
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

  /* The markup's English stands wherever a key does not come back, so a
     language file that failed to load leaves the page readable rather than
     printing keys. */
  function applyStaticStrings() {
    document.documentElement.lang = state.lang;
    var each = function (attr, apply) {
      var nodes = document.querySelectorAll('[' + attr + ']');
      for (var i = 0; i < nodes.length; i++) {
        var s = t(nodes[i].getAttribute(attr));
        if (s !== null) apply(nodes[i], s);
      }
    };
    each('data-i18n', function (n, s) { n.textContent = s; });
    each('data-i18n-aria-label', function (n, s) { n.setAttribute('aria-label', s); });
    var title = t('notFoundDocumentTitle');
    if (title) document.title = title;
  }

  /* The address that was asked for, as text — never as markup, since it is
     whatever anybody typed. Decoded where it decodes, so Põhjala reads as
     Põhjala rather than P%C3%B5hjala. */
  function showAddress() {
    var node = document.getElementById('notfound-at');
    if (!node) return;
    var at = window.location.host + window.location.pathname + window.location.search;
    try { at = decodeURI(at); } catch (e) { /* as it came */ }
    node.textContent = at.length > AT_MAX ? at.slice(0, AT_MAX) + '…' : at;
    node.hidden = false;
  }

  function boot() {
    applyStyle();
    showAddress();
    getJSON(LANGS_URL)
      .then(function (names) {
        state.lang = pickLanguage(Object.keys(names || {}));
        return getJSON(LANG_URL + state.lang + '.json');
      })
      .then(function (pack) {
        state.ui = (pack && pack.ui) || {};
        applyStaticStrings();
      })
      .catch(function () { /* the English in the markup stands */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
