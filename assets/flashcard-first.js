/* Tallinn Tastebuds — the flashcards' first question, asked before the page
 * that wants the answer has arrived.
 *
 * window.TTBFlashFirst = { url, response } — the address boot() in
 * assets/flashcard.js would have asked /api/flashcard on the way in, and the
 * fetch() already under way for it.
 *
 * WHY IT EXISTS. That one request — the decks, the deck the address names, who
 * is signed in and every word the page prints — is the whole of what stands
 * between opening the page and seeing a card. **One request on the way in**
 * under **Flashcards** in README.md is the argument for it being one. But it
 * was asked from the bottom of assets/flashcard.js, which is the largest
 * script on the site, behind the tag, the radio and the language switch; so
 * nothing went to the server until all four had come down the wire and run,
 * and only then did the route start on the database. On a phone that was the
 * two waits end to end, the slower one second. This file is a dozen lines,
 * loaded `async` in the head, and it puts the two side by side: the
 * request goes out while the scripts are still arriving, and by the time
 * boot() wants the answer it is usually already in.
 *
 * IT IS A GUESS THAT IS CHECKED. What is asked is worked out the way boot()
 * works it out — ?d=, else where this device left off under ttb.flash.last;
 * the language out of ?lang=, ttb.lang and the browser's own, in that order —
 * and boot() takes the response only when the address it would have built is
 * the same address character for character. If the two ever drift, the cost
 * is one wasted request and the page asks for itself, exactly as it did before
 * this file; it is never the wrong deck or the wrong language. So a change to
 * what boot() asks is a change here too, and the comparison is what stops a
 * forgotten one from being a bug.
 *
 * And it asks once. boot() takes the global over as it reads it, so a copy of
 * this file that arrives after boot() has run — it is async, and on a cold
 * cache nothing promises the order — finds it taken and does nothing, rather
 * than asking a second time for an answer nobody will read.
 *
 * The rejection is marked handled here, because nothing reads the promise
 * until boot() does and a browser would otherwise report a network failure as
 * an unhandled one in the meantime. boot() still sees the failure: it reads
 * the original promise, not this catch.
 */
(function () {
  'use strict';

  if (window.TTBFlashFirst || !window.fetch) return;

  function storeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  var search = new URLSearchParams(window.location.search);

  var langs = [];
  [search.get('lang'), storeGet('ttb.lang')]
    .concat(navigator.languages || [navigator.language || ''])
    .forEach(function (tag) {
      tag = String(tag || '').toLowerCase().split('-')[0];
      if (tag && langs.indexOf(tag) === -1) langs.push(tag);
    });

  var asked = search.get('d') || storeGet('ttb.flash.last') || '';

  var query = new URLSearchParams();
  query.set('lang', langs.slice(0, 10).join(','));
  if (asked) query.set('deck', asked);

  var url = '/api/flashcard?' + query.toString();
  var response = fetch(url, { headers: { accept: 'application/json' } });
  response.catch(function () { /* boot() reads the failure off the original */ });

  window.TTBFlashFirst = { url: url, response: response };
})();
