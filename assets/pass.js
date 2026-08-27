/* Tallinn Tastebuds — the discount pass.
 *
 * Three pages share this file: deal.html shows a guest their code, verify.html
 * tells a waiter whether a scanned one is good, and staff.html puts the
 * current code on the restaurant's own screen for when a camera will not
 * cooperate. All three need the same three things — the data, the hour, and
 * the code for that hour — so all three are here.
 *
 * HOW A CODE IS MADE
 *
 *   hour = floor(now / one hour)                 a plain integer, UTC
 *   code = HMAC-SHA256(deal key, "<place>:<hour>")  first 25 bits, base 32
 *
 * The hour travels inside the QR next to the code, so the verifier checks the
 * hour the guest actually claimed rather than guessing at it. It accepts the
 * hour before and the hour after as well as the current one, which is what
 * makes the thing usable: a code made at 13:58 is still good when the waiter
 * reaches the table at 14:03, and neither phone has to have a perfect clock.
 *
 * WHAT THIS IS NOT
 *
 * There is no server here, so the deal keys ship inside data/deals.json where
 * anyone can read them. Someone who opens the file can mint codes all day.
 * That is a deliberate trade, not an oversight: the thing this defends
 * against is a screenshot going round a group chat, and an hourly code kills
 * that completely. If a deal ever starts costing real money, the upgrade is
 * a Cloudflare Pages function holding the key server-side — see the README.
 */
window.TTBPass = (function () {
  'use strict';

  var HOUR = 3600000;

  /* How many hours either side of the verifier's own clock still count. One
     covers the wait for a waiter and any plausible drift between two phones.
     Raising it lengthens the life of a screenshot by the same amount. */
  var SKEW = 1;

  /* Crockford's alphabet: no I, L, O or U, so nothing in a code can be read
     back as a one, a zero, or an unfortunate word when a waiter reads it off
     a screen aloud. */
  var ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  var CODE_LENGTH = 5;

  var DEFAULT_LANG = 'en';
  var LANG_KEY = 'ttb.lang';
  var STYLE_KEY = 'ttb.style';
  var STYLES = ['red', 'green'];

  /* ------------------------------------------------------------- building
   * The same two helpers app.js opens with. Three pages share them, which is
   * two more than is worth writing them out for.
   */
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

  /* ------------------------------------------------------------ the clock */

  function hourNow() { return Math.floor(Date.now() / HOUR); }

  /* Milliseconds until the current hour runs out, so a page can redraw itself
     the moment its code stops being the current one. */
  function untilNextHour() { return HOUR - (Date.now() % HOUR); }

  function hourStart(hour) { return new Date(hour * HOUR); }

  function clockOf(date) {
    var h = date.getHours(), m = date.getMinutes();
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  /* ------------------------------------------------------------- the code */

  function utf8(text) { return new TextEncoder().encode(String(text)); }

  /* Twenty-five bits off the front of the digest, five bits to a character.
     Reading them big-endian out of the first four bytes keeps the mapping
     obvious enough to reimplement server-side later without ambiguity. */
  function toBase32(bytes) {
    var out = '';
    var acc = 0;
    for (var i = 0; i < 4; i++) acc = acc * 256 + bytes[i];
    /* acc now holds 32 bits; take the top 25, five at a time. */
    for (var c = 0; c < CODE_LENGTH; c++) {
      var shift = 27 - c * 5;
      out += ALPHABET.charAt(Math.floor(acc / Math.pow(2, shift)) % 32);
    }
    return out;
  }

  function code(key, placeId, hour) {
    if (!window.crypto || !window.crypto.subtle) {
      return Promise.reject(new Error('insecure-context'));
    }
    return window.crypto.subtle
      .importKey('raw', utf8(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      .then(function (imported) {
        return window.crypto.subtle.sign('HMAC', imported, utf8(placeId + ':' + hour));
      })
      .then(function (signature) { return toBase32(new Uint8Array(signature)); });
  }

  /* --------------------------------------------------------------- the URL */

  /* Built from wherever this page is actually being served, so a preview
     deployment verifies against itself rather than sending a waiter to the
     live site to check a code the live site has never heard of. */
  function verifyUrl(placeId, hour, value) {
    var base = window.location.href.replace(/[^/]*(\?.*)?(#.*)?$/, '');
    return base + 'verify.html?r=' + encodeURIComponent(placeId) +
           '&h=' + hour + '&c=' + value;
  }

  /* ------------------------------------------------------------- the data */

  function getJSON(path) {
    return fetch(path, { credentials: 'same-origin' }).then(function (res) {
      if (!res.ok) throw new Error(path + ': HTTP ' + res.status);
      return res.json();
    });
  }

  function load() {
    return Promise.all([
      getJSON('data/restaurants.json'),
      getJSON('data/deals.json').catch(function () { return []; }),
      getJSON('data/ui.json')
    ]).then(function (loaded) {
      return { places: loaded[0] || [], deals: loaded[1] || [], ui: loaded[2] || {} };
    });
  }

  function find(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* ------------------------------------------------------------ the window
   * A deal may carry a run of dates. Both ends are inclusive and read in the
   * reader's own timezone, which for a Tallinn restaurant and a guest
   * standing inside it is the same one.
   */
  function today() {
    var d = new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  function windowState(deal) {
    if (deal.from && today() < deal.from) return 'notyet';
    if (deal.until && today() > deal.until) return 'ended';
    return 'open';
  }

  /* ------------------------------------------------------------- verifying
   * Every answer a waiter can get, as a single word the page turns into a
   * colour and a sentence. Nothing here is a security boundary — see the note
   * at the top of the file — it is a check that the guest is holding a live
   * page rather than a picture of one.
   */
  function verify(data, placeId, hour, claimed) {
    var deal = find(data.deals, placeId);
    if (!deal) return Promise.resolve({ status: 'unknown' });

    var place = find(data.places, placeId);
    var out = { deal: deal, place: place, hour: hour };

    if (!/^[0-9]+$/.test(String(hour)) || !/^[0-9A-Z]{5}$/.test(String(claimed))) {
      out.status = 'malformed';
      return Promise.resolve(out);
    }

    var age = hourNow() - Number(hour);
    if (age > SKEW) { out.status = 'expired'; return Promise.resolve(out); }
    if (age < -SKEW) { out.status = 'early'; return Promise.resolve(out); }

    var run = windowState(deal);
    if (run !== 'open') { out.status = run; return Promise.resolve(out); }

    return code(deal.key, placeId, Number(hour)).then(function (expected) {
      out.status = expected === String(claimed) ? 'ok' : 'mismatch';
      return out;
    }).catch(function () {
      out.status = 'error';
      return out;
    });
  }

  /* --------------------------------------------------------- look and feel
   * The pass pages borrow the site's palette and its language, so walking
   * from the map to a discount does not feel like leaving.
   */
  function storeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function applyStyle() {
    var fromUrl = new URLSearchParams(window.location.search).get('style');
    var stored = storeGet(STYLE_KEY);
    var style = STYLES.indexOf(fromUrl) !== -1 ? fromUrl
              : STYLES.indexOf(stored) !== -1 ? stored
              : 'red';
    document.documentElement.setAttribute('data-style', style);
    document.documentElement.style.colorScheme = style === 'green' ? 'dark' : 'light';
    return style;
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

  /* Interface string lookup, identical in behaviour to the map's own: current
     language, then English, then the key itself so a missing string is
     visible rather than blank. */
  function translator(ui, lang) {
    return function (key, vars) {
      var pack = ui[lang] || {};
      var s = pack[key];
      if (s === undefined) s = (ui[DEFAULT_LANG] || {})[key];
      if (s === undefined) return key;
      if (vars) {
        Object.keys(vars).forEach(function (v) {
          s = s.split('{' + v + '}').join(String(vars[v]));
        });
      }
      return s;
    };
  }

  /* A deal's own words, in the reader's language where they exist. */
  function textFor(field, lang) {
    if (!field) return '';
    return field[lang] || field[DEFAULT_LANG] || '';
  }

  return {
    el: el,
    clear: clear,
    HOUR: HOUR,
    SKEW: SKEW,
    hourNow: hourNow,
    untilNextHour: untilNextHour,
    hourStart: hourStart,
    clockOf: clockOf,
    code: code,
    verifyUrl: verifyUrl,
    load: load,
    find: find,
    windowState: windowState,
    verify: verify,
    applyStyle: applyStyle,
    pickLanguage: pickLanguage,
    translator: translator,
    textFor: textFor
  };
}());
