/* Tallinn Tastebuds — the id this browser is known by when nobody is signed in.
 *
 * window.TTBDevice.id() answers a v4 UUID kept under ttb.cid, made the first
 * time it is asked and never before: a browser that only ever reads a page is
 * not given an id for something it has not done. It is what the server files a
 * save, a heart or a chess move under when there is no account, and what lets
 * that same device take it back. It is not an account and identifies nobody: it
 * leaves this browser only as one opaque string on the thing it did.
 *
 * WHY A FILE OF ITS OWN. assets/app.js and assets/feedback.js each carried
 * these eleven lines, feedback.js's comment apologising for being the second
 * copy and promising there would be no third — two ES5 files served raw cannot
 * import from each other. The chess page would have been the third, so the
 * lines became a global instead, loaded after track.js on every page that
 * files something under a device. The key is the same one, so a save pressed
 * on the map and a heart pressed on the feedback page still belong to one
 * device.
 *
 * Every localStorage touch is in a try/catch: private mode and a blocked
 * store throw, and a device that cannot remember its id makes a new one per
 * page load, which costs a duplicate save and nothing else.
 */
(function () {
  'use strict';

  var CID_KEY = 'ttb.cid';

  function storeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function storeSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* private mode */ }
  }

  function id() {
    var known = storeGet(CID_KEY);
    if (known) return known;
    known = (window.crypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      /* Safari before 15.4 has crypto but not randomUUID. getRandomValues is
         everywhere, so the shape is assembled by hand from real entropy
         rather than falling back to Math.random. */
      : uuidFromBytes();
    storeSet(CID_KEY, known);
    return known;
  }

  function uuidFromBytes() {
    var b = new Uint8Array(16);
    window.crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;   /* version 4 */
    b[8] = (b[8] & 0x3f) | 0x80;   /* variant 1 */
    var hex = [];
    for (var i = 0; i < 16; i++) hex.push((b[i] + 0x100).toString(16).slice(1));
    return hex.slice(0, 4).join('') + '-' + hex.slice(4, 6).join('') + '-' +
           hex.slice(6, 8).join('') + '-' + hex.slice(8, 10).join('') + '-' +
           hex.slice(10, 16).join('');
  }

  /* Read and never minted: what a page asks when it wants to know whether this
     device has done anything yet — whose hearts to fill, whether a name is
     already tied to it — without being the reason it now has an id. */
  function known() {
    return storeGet(CID_KEY) || '';
  }

  window.TTBDevice = { id: id, known: known };
})();
