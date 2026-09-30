/* Tallinn Tastebuds — a country by its two letters, and a line of them.
 *
 * window.TTBCountry.name(code, lang, unknown) is the browser's own name for
 * a country, in the language the page is being read in — Intl carries every
 * one of them in all ten, which is two hundred names nobody has to write into
 * data/ui.json. `code` is Cloudflare's two letters as countryOf() in
 * functions/api/_visits.js files them; XX is Cloudflare not knowing and T1 is
 * Tor, and both are answered with `unknown`, the page's word for it.
 *
 * window.TTBCountry.line(rows, lang, words) is several of them on one line —
 * "Estonia 7 · Finland 2 · Other 1" — for the places a list of countries has
 * to fit under a name rather than stand as a table of its own: the countries
 * under each list on /insights and on /admin/stats. `rows` is [{ id, n }]
 * most first, as every route here answers it; the first TOP are named and the
 * rest are summed into one Other where there are at least two of them to sum
 * — one row called Other would hide a name to save no room — which is the cut
 * the Country table on /insights makes, and the same number.
 *
 * WHY A FILE OF ITS OWN. assets/insights.js and assets/visitors.js each
 * carried the naming, and the lists' line would have been the third page to
 * want it; two ES5 files served raw cannot import from each other, so it is a
 * global, the arrangement assets/device.js and assets/language.js have,
 * loaded before the page's own script on every page that names a country.
 */
(function () {
  'use strict';

  /* How many countries a line names before the rest are one Other. */
  var TOP = 5;

  function name(code, lang, unknown) {
    if (code === 'XX' || code === 'T1') return unknown;
    try {
      return new Intl.DisplayNames([lang], { type: 'region' }).of(code) || code;
    } catch (e) {
      return code;
    }
  }

  /* A number as the reading language writes it — 1,024 or 1 024. */
  function num(n, lang) {
    try { return new Intl.NumberFormat(lang).format(n); } catch (e) { return String(n); }
  }

  /* `words` is { unknown, other }, the two the page already has in
     data/ui.json under insightsUnknown and insightsOther. */
  function line(rows, lang, words) {
    var named = rows.length <= TOP + 1 ? rows : rows.slice(0, TOP);
    var parts = named.map(function (r) { return name(r.id, lang, words.unknown) + ' ' + num(r.n, lang); });
    if (rows.length > TOP + 1) {
      var rest = 0;
      rows.slice(TOP).forEach(function (r) { rest += r.n; });
      parts.push(words.other + ' ' + num(rest, lang));
    }
    return parts.join(' · ');
  }

  window.TTBCountry = { name: name, line: line };
})();
