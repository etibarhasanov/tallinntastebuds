/**
 * Tallinn Tastebuds — when the owner's numbers were counted.
 *
 * /admin/stats, /admin/visitors, /admin/found and /admin/flows are worked
 * out once a UTC day and held in the colo until midnight — ownersDay() in
 * functions/api/_lib.js. Each answer says when, in `asOf`, and this turns it
 * into the line under the page's chips, in Tallinn's time, the owner's
 * clock:
 *
 *   Counted today at 02:14, Tallinn time. Counted again after 02:00 tomorrow.
 *
 * The next count is midnight UTC, which is 02:00 in Tallinn's winter and
 * 03:00 in its summer. Between Tallinn's midnight and that hour a count from
 * before midnight is still the one held, and the next is today rather than
 * tomorrow, so then — and on any count not from today — the line names both
 * days instead.
 *
 * The words are the page's own: TTBCounted.words() answers a key and its
 * values, and the page puts them through its own t(). Four pages, one sum:
 * that is why it is a file of its own, loaded before each of them.
 */
(function () {
  'use strict';

  var ZONE = 'Europe/Tallinn';

  /* A date's day in Tallinn, as YYYY-MM-DD, to compare two by. */
  function dayOf(at) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(at);
  }

  /* { key, vars } for the page's t(), or null where there is no time to
     say — an answer from before the routes carried one. */
  function words(asOf, lang) {
    var at = new Date(asOf || '');
    if (isNaN(at.getTime())) return null;
    var next = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() + 1));
    var clock = new Intl.DateTimeFormat(lang, { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    var vars = { time: clock.format(at), next: clock.format(next) };
    var today = dayOf(new Date());
    if (dayOf(at) === today && dayOf(next) !== today) return { key: 'numbersCountedToday', vars: vars };
    var date = new Intl.DateTimeFormat(lang, { timeZone: ZONE, day: 'numeric', month: 'long' });
    vars.date = date.format(at);
    vars.nextDate = date.format(next);
    return { key: 'numbersCountedOn', vars: vars };
  }

  window.TTBCounted = { words: words };
})();
