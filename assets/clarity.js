/* Tallinn Tastebuds — Microsoft Clarity, the half of analytics that watches.
 *
 * Google Analytics counts. With assets/track.js reporting every press beside
 * it, it answers "how many opened the map" and "how many pressed Show QR".
 * What neither has ever been able to answer is why somebody pressed nothing:
 * the filter row scrolled straight past, the panel opened and shut in a
 * second, the button sitting below a fold nobody reached. A count says a
 * thing did not happen and stops there.
 *
 * Clarity records the page rather than counting it — heatmaps of where
 * presses and scrolls actually land, and a replay of the DOM as it changed.
 * That is the half GA cannot do, and on a site that is one address with
 * everything happening on it, it is the half that says where the map is
 * confusing.
 *
 * WHY A FILE, AND NOT THE SNIPPET IN NINE HEADS
 *
 * Microsoft's console emits a snippet to paste into every page's head, the
 * way Google's does — and the gtag block beside this script tag is exactly
 * that paste, repeated across the eight pages that carry it. Doing the same
 * again would mean nine more copies of a snippet, and nine places to edit an
 * id that only needs to exist once. The body below is Microsoft's snippet
 * unchanged, argument for argument, with the one thing that varies lifted
 * into the constant above it. Same reason assets/track.js exists instead of
 * seven copies of three functions.
 *
 * WHAT IS RECORDED, AND WHAT IS NOT
 *
 * Every page, admin.html included, which the gtag block is not on. Clarity
 * masks the contents of every input box and dropdown in all three of its
 * masking modes and that cannot be switched off, which is what keeps
 * admin.html's GitHub token out of a replay: the token is only ever typed
 * into an <input type="password"> and held in a variable, and nothing
 * renders it as text.
 *
 * The mode itself is a dashboard setting rather than a line of code —
 * Settings -> Masking, and Balanced is the default, which masks numbers and
 * email addresses on top of the input boxes. Per-element overrides are
 * attributes: the pass card on deal.html, verify.html and staff.html carries
 * data-clarity-mask="true", and masking is inherited, so the one attribute
 * covers the code and everything drawn under it.
 *
 * That masking is tidiness rather than a lock. An hourly discount code is
 * already not a secret — data/deals.json ships the keys in public, and "And
 * it is a door, not a lock" under "It is for members" in README.md says so
 * outright — but there is no reason for a code to travel to a third party to
 * make a heatmap of a page whose only button is the way back.
 *
 * TO TURN IT OFF
 *
 * Empty the constant below, the way an empty turnstile-key in index.html
 * turns Turnstile off: nothing loads, nothing is sent, and the script tags
 * can stay where they are. Deleting this file and its nine script tags is
 * the thorough version.
 */
(function () {
  'use strict';

  /* clarity.microsoft.com -> Settings -> Setup -> Install manually. Empty
     means off, and off is what a fork of this repo should be by default:
     somebody else's deployment reporting into this project's dashboard
     would be their visitors in my numbers. */
  var PROJECT = 'yay3pxtg4w';

  if (!PROJECT) return;

  /* Microsoft's snippet, as the console emits it. The queue on window.clarity
     is what collects calls made before the tag itself has finished loading,
     so nothing has to wait for it. */
  (function (c, l, a, r, i, t, y) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, 'clarity', 'script', PROJECT);
})();
